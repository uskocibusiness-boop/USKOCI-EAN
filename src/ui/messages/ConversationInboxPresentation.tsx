import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { inicijali } from '../../lib/inicijali';
import { trenutak, type Trenutak } from '../../lib/trenutak';
import { T } from '../Text';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { layout } from '../system/layout';
import { neprocitanih, osoba } from '../system/plural';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { V2Action } from '../v2/V2Action';
import { ListSkeleton } from '../notifications/ListSkeleton';
import { TimedRow } from '../notifications/TimedRow';

/**
 * The admitted reader's contract owns these facts (`MY_CONVERSATIONS_PAGE_V1`). Two things the Poruke design draws are NOT in that
 * projection today, so nothing supplies them yet and nothing is invented: that the Dogovor is closed (the "Završeni" set), and how
 * many people a group has ("Grupa · 3 osobe"). A reader that learns them fills these optional fields and the row draws them; the route
 * fills `closed` from the Dogovori it already reads (R17).
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
  /** Only supply an already-authorized photo node, drawn at 48. The presentation never fetches photos or message media. */
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
 * What stands at the end of the name's line (proposal J2): the clock for a message of today, otherwise the day as the app says it
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
  // The pull spinner is for a pull only: a read the screen starts by itself (a tab switched back, a focus) used to raise it, and on Android
  // it is a white disc over the top of the list, which sat half grown on the Aktivni/Završeni switch on the owner's phone (8 Oct 2026).
  const pull = usePullRefresh(refresh, reading);
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

  const incomplete = hasMore || pageError || paging;
  const emptyTitle = incomplete ? closedKnown ? set === 'closed' ? 'Nema završenih među učitanim razgovorima' : 'Nema aktivnih među učitanim razgovorima'
    : 'Razgovori još nisu učitani do kraja'
    : !closedKnown ? 'Još nema razgovora' : set === 'closed' ? 'Još nema završenih razgovora' : 'Nema aktivnih razgovora';
  const emptyBody = incomplete ? 'Učitaj starije razgovore da nastaviš pregled.' : !closedKnown ? 'Čim nastane Dogovor, ovde je razgovor.'
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
      // Nobody has talked yet: the first encounter, the two panels at the size of a door; the quieter sets keep their 96.
      : <StateView kind="empty" hero={!closedKnown} art="chat" title={emptyTitle} body={emptyBody}
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
      refreshing={items !== null && pull.refreshing} onRefresh={pull.onRefresh}
      keyboardShouldPersistTaps="handled" initialNumToRender={12} />
  </View>;
}

type RowProps = { item: ConversationInboxRow; moment: Trenutak | null; last: boolean; closed: boolean;
  openDisabled: boolean; opening: boolean; unavailable: boolean; failed: boolean; photo?: ReactNode;
  onOpen: (row: ConversationInboxRow) => void };

/** The face of a row, and the whole of its slot: the face stands on the edge of the screen, in line with the control and the bar above it. */
const FACE = 48;

/**
 * One conversation (UI/UX pass, 2026-10-08, the owner's phone): the face, then three lines and each of them ONE line. The person (or
 * the group) with the time of the last message at the end of the same line, what was said, and what it is about, in grey. A preview that
 * is longer than the room is cut by the line, not by a count of letters: the whole of it is in the conversation, and the row's one
 * label says all of it to a screen reader. A closed Dogovor draws nothing of its own (the lock explained nothing; the "Završeni" set
 * already says it is over) and a row draws no arrow: the whole row is the way in. At a large text size the time has no room beside the
 * name: the name may take two lines and the time goes to the front of the line of the task.
 */
const ConversationRow = memo(function ConversationRow({ item, moment, last, closed, openDisabled, opening, unavailable, failed, photo, onOpen }: RowProps) {
  const { stacked } = useLayoutClass();
  const title = conversationTitle(item);
  const preview = conversationPreview(item.lastMessage);
  // Private unread is explicitly unknown in V1, even if an upstream caller accidentally supplies a number.
  const unread = item.kind === 'GROUP' && item.unreadMessageCount !== null && Number.isSafeInteger(item.unreadMessageCount)
    && item.unreadMessageCount > 0 ? item.unreadMessageCount : null;
  const status = unavailable ? 'Razgovor trenutno nije dostupan.' : failed ? 'Razgovor nije otvoren. Pokušaj ponovo.' : null;
  const stamp = conversationStamp(moment);
  const time = moment ? `${moment.dan}, ${moment.sat}` : null;
  const label = [title, item.task.title, closed ? 'Dogovor je zatvoren' : null, preview, time, unread === null ? null : neprocitanih(unread), status].filter(Boolean).join('. ');
  // The third line says what the conversation is about; while it opens, or when it cannot be opened, it says that instead.
  const about = opening ? 'Otvaramo razgovor…' : status ?? item.task.title;
  const aboutLine = stacked && stamp && !opening && !status ? `${stamp} · ${about}` : about;
  const off = unavailable || opening;
  // The face is the one thing of the row's slot: a photo, the person's letters, or the picture of a group. Decoration only: the row speaks.
  const face = <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.face}>
    {photo ?? (item.kind === 'GROUP' ? <FactArt kind="users" size={FACE} /> : <Avatar initials={inicijali(item.counterpart?.displayName)} size={FACE} />)}
  </View>;
  return <TimedRow leading={face} slot={FACE} title={title} titleLines={stacked ? 2 : 1} time={stacked ? null : stamp} last={last} disabled={off}
    interactionDisabled={openDisabled}
    onPress={() => { if (!openDisabled) onOpen(item); }} accessibilityLabel={label}
    accessibilityHint={unavailable ? undefined : failed ? 'Pokušaj ponovo da otvoriš razgovor.' : 'Otvara razgovor uz ovaj zadatak.'}>
    <View style={s.line}>
      <T variant="note" tone="muted" numberOfLines={1} style={s.grow}>{preview}</T>
      {unread !== null ? <View style={s.unread}><T variant="meta" style={s.unreadText}>{unread.toLocaleString('sr-Latn-RS')}</T></View> : null}
    </View>
    <T variant="meta" tone="muted" numberOfLines={1}>{aboutLine}</T>
  </TimedRow>;
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  // The edge of every screen (20), the first row 8 under the bar, the end of the scroll 32 from the last row; a column on a tablet.
  content: { flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  heading: { gap: layout.group, paddingBottom: sys.space.sm },
  notice: { gap: sys.space.xs },
  face: { width: FACE, height: FACE, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  grow: { flex: 1, minWidth: 0 },
  // The count of a group is 20 high, the height of the line it stands in, so a group's row is as tall as any other.
  unread: { minWidth: 20, height: 20, paddingHorizontal: sys.space.xs, borderRadius: sys.radius.pill, backgroundColor: sys.color.ink, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: sys.color.surface, textAlign: 'center', fontVariant: ['tabular-nums'] },
  loading: { gap: sys.space.base },
  center: { textAlign: 'center', maxWidth: '100%' },
  footer: { paddingVertical: sys.space.base, gap: sys.space.sm },
});
