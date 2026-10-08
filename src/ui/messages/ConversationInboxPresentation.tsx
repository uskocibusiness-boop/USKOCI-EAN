import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { inicijali } from '../../lib/inicijali';
import { trenutak, type Trenutak } from '../../lib/trenutak';
import { T } from '../Text';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { ListRow } from '../system/ListRow';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { layout } from '../system/layout';
import { neprocitanih, osoba } from '../system/plural';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { ListSkeleton } from '../notifications/ListSkeleton';

/**
 * The admitted reader's contract owns these facts (`MY_CONVERSATIONS_PAGE_V1`). Two things the Poruke design draws are NOT in that
 * projection today, so nothing supplies them yet and nothing is invented: that the Dogovor is closed (a lock, and the "Završeni" set),
 * and how many people a group has ("Grupa · 3 osobe"). A reader that learns them fills these optional fields and the row draws them; the
 * route fills `closed` from the Dogovori it already reads (R17).
 */
export type ConversationInboxRow = ConversationInboxItem & Readonly<{ closed?: boolean; memberCount?: number }>;
export const conversationRowKey = (row: ConversationInboxRow): string => `${row.kind}:${row.id}`;

export type ConversationInboxPresentationProps = {
  /** null means no authoritative page yet; [] is a successfully read empty inbox. Order is the server's order. */
  items: readonly ConversationInboxRow[] | null;
  loading: boolean; refreshing: boolean; error: boolean;
  paging: boolean; pageError: boolean; hasMore: boolean;
  /** Account/focus retirement and navigation admission belong to the caller. */
  disabled?: boolean; openingDisabled?: boolean; openingKey?: string | null;
  unavailableKeys?: ReadonlySet<string>; openErrorKey?: string | null;
  onOpen: (row: ConversationInboxRow) => void; onRefresh: () => void; onLoadMore: () => void;
  /** Only supply an already-authorized photo node. The presentation never fetches photos or message media. */
  renderAvatar?: (row: ConversationInboxRow) => ReactNode;
  /** Optional route chrome, outside the scrolling list. Does not create a bell or any data read. */
  header?: ReactNode;
  /** The supplied chrome already contains the visible section heading. Default keeps standalone/gallery rendering. */
  titleInHeader?: boolean;
  /** The existing Dogovori screen includes Agreements without messages. Optional real route callback only. */
  onAgreements?: () => void;
  /**
   * R17: the Dogovori that are over (ids), read by the route from the Dogovori the app already reads. When every row says whether its Dogovor
   * is closed (`closed` on the row, or its Dogovor in or out of this set), the list can be told in two sets, "Aktivni" and "Završeni". With
   * `null` (not read yet, or the read failed) and no `closed` on the rows there is one list and no control: nothing is guessed.
   */
  closedAgreements?: ReadonlySet<string> | null;
  bottomInset?: number; zona?: string; sada?: Date;
};

type ListItem = { key: string; item: ConversationInboxRow; moment: Trenutak | null; closed: boolean | undefined };

/**
 * One row per conversation, in the server's order. Do not sort/group by counterpart or event time: multiple tasks with one
 * person are distinct conversations. The moment of the last message is read in SERBIAN time unless the caller names a zone.
 */
export function conversationInboxRows(items: readonly ConversationInboxRow[], options: { zona?: string; sada?: Date;
  closedAgreements?: ReadonlySet<string> | null } = {}): ListItem[] {
  const zone = { zona: options.zona ?? DOGOVORENA_ZONA, ...(options.sada ? { sada: options.sada } : {}) };
  // Whether the Dogovor is over: what the row says, else what the Dogovori read says; undefined is "not known", never "open".
  const closedOf = (item: ConversationInboxRow) => item.closed !== undefined ? item.closed
    : options.closedAgreements ? options.closedAgreements.has(item.routeAgreementId) : undefined;
  return items.map(item => ({ key: conversationRowKey(item), item, moment: trenutak(item.lastMessage.createdAt, zone), closed: closedOf(item) }));
}

/**
 * What stands with the task under a row (proposal J2): the clock for a message of today, otherwise the day as the app says it
 * ("Juče", "3. okt"). Never both: the list has no day headings, so the stamp carries the day.
 */
export const conversationStamp = (moment: Trenutak | null): string | null => moment ? moment.dan === 'Danas' ? moment.sat : moment.dan : null;

/** The row's first line: the other person, or the group (with its size when the reader knows it). */
export function conversationTitle(item: ConversationInboxRow): string {
  if (item.kind === 'GROUP') return item.memberCount && item.memberCount > 0 ? `Grupa · ${osoba(item.memberCount)}` : 'Grupa';
  return item.counterpart?.displayName?.trim() || 'Razgovor';
}

/** Preserve a media caption as well as kind. No invented duration, sender identity or delivery/read status. */
export function conversationPreview(message: ConversationInboxRow['lastMessage']): string {
  const caption = message.preview?.trim();
  const content = message.kind === 'PHOTO' ? ['Fotografija', caption].filter(Boolean).join(' · ')
    : message.kind === 'VOICE' ? ['Glasovna poruka', caption].filter(Boolean).join(' · ')
      : caption || 'Tekst poruke nije dostupan';
  return `${message.mine ? 'Ti: ' : ''}${content}`;
}

/**
 * The words under the name are a preview, not the message: two lines at most on an ordinary phone, so a row stays about as high as the
 * system's row is (the row has no line limit of its own). A screen reader hears the whole preview in the row's one label.
 */
export const PREVIEW_CHARACTERS = 72;
/** The task in the quiet line under the preview says what the conversation is about, as a hint, so it is cut too (the label has all of it). */
export const TASK_CHARACTERS = 48;
/** At most `limit` letters, the last of them an ellipsis when something was cut; counted in letters, never cut inside one. */
function clipped(text: string, limit: number): string {
  const letters = Array.from(text);
  return letters.length <= limit ? text : `${letters.slice(0, limit - 1).join('').trimEnd()}…`;
}
export const conversationPreviewLine = (preview: string): string => clipped(preview, PREVIEW_CHARACTERS);
export const conversationTaskLine = (title: string): string => clipped(title, TASK_CHARACTERS);

const EMPTY_KEYS: ReadonlySet<string> = new Set();
const EMPTY_ITEMS: readonly ConversationInboxRow[] = [];
const rowKey = (row: ListItem) => row.key;

type ConversationSet = 'active' | 'closed';
const SETS = [{ key: 'active' as const, label: 'Aktivni' }, { key: 'closed' as const, label: 'Završeni' }];

export function ConversationInboxPresentation({ items, loading, refreshing, error, paging, pageError, hasMore,
  disabled = false, openingDisabled = false, openingKey = null, unavailableKeys = EMPTY_KEYS, openErrorKey = null,
  onOpen, onRefresh, onLoadMore, renderAvatar, header, titleInHeader = false, onAgreements, closedAgreements = null, bottomInset = 0, zona, sada,
}: ConversationInboxPresentationProps) {
  const [set, setSet] = useState<ConversationSet>('active');
  const rows = useMemo(() => conversationInboxRows(items ?? EMPTY_ITEMS, { zona, sada, closedAgreements }), [items, zona, sada, closedAgreements]);
  // One list, or two when every row says whether its Dogovor is closed. The conversations themselves are never reordered.
  const closedKnown = rows.length > 0 && rows.every(row => row.closed !== undefined);
  const shown = useMemo(() => closedKnown ? rows.filter(row => (row.closed === true) === (set === 'closed')) : rows, [rows, closedKnown, set]);
  const lastKey = shown.length ? shown[shown.length - 1].key : null;
  const reading = loading || refreshing;
  const readDisabled = disabled || reading || paging;
  const openDisabled = disabled || openingDisabled || openingKey !== null;
  // Keep RefreshControl mounted while reading; the caller still owns async single-flight admission.
  const refresh = useCallback(() => { if (!readDisabled) onRefresh(); }, [readDisabled, onRefresh]);
  const renderItem = useCallback(({ item: row }: ListRenderItemInfo<ListItem>) => <ConversationRow item={row.item} moment={row.moment} closed={row.closed === true}
    last={row.key === lastKey}
    unavailable={unavailableKeys.has(row.key)} failed={openErrorKey === row.key} opening={openingKey === row.key}
    openDisabled={openDisabled} onOpen={onOpen} photo={renderAvatar?.(row.item)} />,
  [lastKey, unavailableKeys, openErrorKey, openingKey, openDisabled, onOpen, renderAvatar]);

  const notice = items !== null && error ? <Surface kind="note" style={s.notice}>
    <T variant="note" accessibilityRole="alert">Razgovori nisu osveženi.</T>
    <T variant="note" tone="muted">Poslednji učitani razgovori ostaju prikazani. Osveži ih da nastaviš.</T>
    <V2Action label="Osveži razgovore" kind="quiet" compact onPress={onRefresh} disabled={readDisabled} loading={reading} />
  </Surface> : null;
  const control = closedKnown ? <Segmented value={set} onChange={setSet} options={SETS} /> : null;
  const listHeader = titleInHeader && !control && !notice ? null : <View style={s.heading}>
    {!titleInHeader ? <T variant="pageTitle" accessibilityRole="header">Poruke</T> : null}
    {control}
    {notice}
  </View>;

  const emptyTitle = !closedKnown ? 'Još nema razgovora' : set === 'closed' ? 'Još nema završenih razgovora' : 'Nema aktivnih razgovora';
  const emptyBody = !closedKnown ? 'Poruke iz tvojih Dogovora i grupnih razgovora pojaviće se ovde.'
    : set === 'closed' ? 'Razgovori završenih Dogovora stoje ovde, da ih možeš pročitati.' : 'Završene razgovore vidiš pod „Završeni“.';
  const empty = items === null
    ? error && !reading
      ? <StateView kind="error" title="Razgovori nisu učitani" body="Proveri vezu pa pokušaj ponovo."
          primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: readDisabled }} />
      // The rows that are coming, in their geometry (a face in its slot, two lines), and the one sentence a screen reader hears.
      : <View accessibilityLiveRegion="polite" style={s.loading}>
        <ListSkeleton rows={5} face />
        <T variant="meta" tone="muted" style={s.center}>Učitavamo razgovore…</T>
      </View>
    : error ? null
      : <StateView kind="empty" art="chat" title={emptyTitle} body={emptyBody}
          primary={onAgreements && emptyTitle === 'Još nema razgovora' ? { label: 'Otvori Dogovore', onPress: onAgreements, disabled: openDisabled } : undefined} />;
  const footer = items !== null && (hasMore || pageError || paging) ? <View style={s.footer}>
    {pageError ? <T variant="note" accessibilityRole="alert">Stariji razgovori nisu učitani. Pokušaj ponovo da nastaviš.</T> : null}
    <V2Action label={pageError ? 'Pokušaj ponovo' : 'Učitaj starije razgovore'} kind="quiet" onPress={onLoadMore}
      disabled={readDisabled} loading={paging} accessibilityLabel={pageError ? 'Ponovo učitaj starije razgovore' : undefined} />
  </View> : null;

  return <View style={s.screen}>
    {header}
    <FlatList data={shown} keyExtractor={rowKey} renderItem={renderItem}
      ListHeaderComponent={listHeader} ListEmptyComponent={empty} ListFooterComponent={footer}
      contentContainerStyle={[s.content, { paddingBottom: Math.max(0, bottomInset) + layout.zone }]}
      refreshing={items !== null && reading} onRefresh={refresh}
      keyboardShouldPersistTaps="handled" initialNumToRender={12} />
  </View>;
}

type RowProps = { item: ConversationInboxRow; moment: Trenutak | null; last: boolean; closed: boolean;
  openDisabled: boolean; opening: boolean; unavailable: boolean; failed: boolean; photo?: ReactNode;
  onOpen: (row: ConversationInboxRow) => void };
const ConversationRow = memo(function ConversationRow({ item, moment, last, closed, openDisabled, opening, unavailable, failed, photo, onOpen }: RowProps) {
  const title = conversationTitle(item);
  const preview = conversationPreview(item.lastMessage);
  // Private unread is explicitly unknown in V1, even if an upstream caller accidentally supplies a number.
  const unread = item.kind === 'GROUP' && item.unreadMessageCount !== null && Number.isSafeInteger(item.unreadMessageCount)
    && item.unreadMessageCount > 0 ? item.unreadMessageCount : null;
  const status = unavailable ? 'Razgovor trenutno nije dostupan.' : failed ? 'Razgovor nije otvoren. Pokušaj ponovo.' : null;
  const stamp = conversationStamp(moment);
  const time = moment ? `${moment.dan}, ${moment.sat}` : null;
  const label = [title, item.task.title, closed ? 'Dogovor je zatvoren' : null, preview, time, unread === null ? null : neprocitanih(unread), status].filter(Boolean).join('. ');
  // The line under the words says when and what it is about, like a notification does ("14:05 · Montaža police"); while it opens or when it
  // cannot be opened it says that instead.
  const meta = opening ? 'Otvaramo razgovor…' : status ?? ([stamp, conversationTaskLine(item.task.title)].filter(Boolean).join(' · ') || undefined);
  // The face is the one thing of the row's slot: a photo, the person's letters, or the picture of a group. Decoration only: the row speaks.
  const face = <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.face}>
    {photo ?? (item.kind === 'GROUP' ? <FactArt kind="users" size={48} /> : <Avatar initials={inicijali(item.counterpart?.displayName)} size={layout.slotFace} />)}
  </View>;
  // At the end of the row: how many messages of a group are unread (the only unread the server counts) and the lock of a closed Dogovor.
  const trailing = unread !== null || closed ? <View style={s.trailing}>
    {unread !== null ? <View style={s.unread}><T variant="meta" style={s.unreadText}>{unread.toLocaleString('sr-Latn-RS')}</T></View> : null}
    {closed ? <View testID="conversation-lock" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><FactArt kind="lock" size={16} muted /></View> : null}
  </View> : undefined;
  return <ListRow faceSlot leading={face} title={title} subtitle={conversationPreviewLine(preview)} meta={meta} trailing={trailing} last={last}
    disabled={unavailable || opening} onPress={() => { if (!openDisabled) onOpen(item); }}
    accessibilityLabel={label} accessibilityHint={unavailable ? undefined : failed ? 'Pokušaj ponovo da otvoriš razgovor.' : 'Otvara razgovor uz ovaj zadatak.'} />;
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  // The edge of every screen (20), the first row 8 under the bar, the end of the scroll 32 from the last row; a column on a tablet.
  content: { flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  heading: { gap: layout.group, paddingBottom: sys.space.sm },
  notice: { gap: sys.space.xs },
  face: { width: layout.slotFace, height: layout.slotFace, alignItems: 'center', justifyContent: 'center' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  unread: { minWidth: 24, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.xs, borderRadius: sys.radius.pill, backgroundColor: sys.color.ink },
  unreadText: { color: sys.color.surface, textAlign: 'center', fontVariant: ['tabular-nums'] },
  loading: { gap: sys.space.base },
  center: { textAlign: 'center', maxWidth: '100%' },
  footer: { paddingVertical: sys.space.base, gap: sys.space.sm },
});
