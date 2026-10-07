import { memo, useCallback, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { inicijali } from '../../lib/inicijali';
import { trenutak, type Trenutak } from '../../lib/trenutak';
import { Press } from '../Press';
import { T } from '../Text';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { ConversationArt } from '../system/ConversationArt';
import { StateView } from '../system/StateView';
import { neprocitanih, osoba } from '../system/plural';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';

/**
 * The admitted reader's contract owns these facts (`MY_CONVERSATIONS_PAGE_V1`). Two things the Poruke design draws are NOT in that
 * projection today, so nothing supplies them yet and nothing is invented: that the Dogovor is closed (a lock before the task), and
 * how many people a group has ("Grupa · 3 osobe"). A reader that learns them fills these optional fields and the row draws them.
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
  bottomInset?: number; zona?: string; sada?: Date;
};

type ListRow = { key: string; item: ConversationInboxRow; moment: Trenutak | null };

/**
 * One row per conversation, in the server's order. Do not sort/group by counterpart or event time: multiple tasks with one
 * person are distinct conversations. The moment of the last message is read in SERBIAN time unless the caller names a zone.
 */
export function conversationInboxRows(items: readonly ConversationInboxRow[], options: { zona?: string; sada?: Date } = {}): ListRow[] {
  const zone = { ...options, zona: options.zona ?? DOGOVORENA_ZONA };
  return items.map(item => ({ key: conversationRowKey(item), item, moment: trenutak(item.lastMessage.createdAt, zone) }));
}

/**
 * What stands at the right of a row (proposal J2): the clock for a message of today, otherwise the day as the app says it
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
const rowKey = (row: ListRow) => row.key;

export function ConversationInboxPresentation({ items, loading, refreshing, error, paging, pageError, hasMore,
  disabled = false, openingDisabled = false, openingKey = null, unavailableKeys = EMPTY_KEYS, openErrorKey = null,
  onOpen, onRefresh, onLoadMore, renderAvatar, header, titleInHeader = false, onAgreements, bottomInset = 0, zona, sada,
}: ConversationInboxPresentationProps) {
  const { stacked } = useLayoutClass();
  const rows = useMemo(() => conversationInboxRows(items ?? EMPTY_ITEMS, { zona, sada }), [items, zona, sada]);
  const reading = loading || refreshing;
  const readDisabled = disabled || reading || paging;
  const openDisabled = disabled || openingDisabled || openingKey !== null;
  // Keep RefreshControl mounted while reading; the caller still owns async single-flight admission.
  const refresh = useCallback(() => { if (!readDisabled) onRefresh(); }, [readDisabled, onRefresh]);
  const renderItem = useCallback(({ item: row }: ListRenderItemInfo<ListRow>) => <ConversationRow item={row.item} moment={row.moment} stacked={stacked}
    unavailable={unavailableKeys.has(row.key)} failed={openErrorKey === row.key} opening={openingKey === row.key}
    disabled={openDisabled || unavailableKeys.has(row.key)} onOpen={onOpen} photo={renderAvatar?.(row.item)} />,
  [stacked, unavailableKeys, openErrorKey, openingKey, openDisabled, onOpen, renderAvatar]);

  const listHeader = titleInHeader && !(items !== null && error) ? null : <View style={s.heading}>
    {!titleInHeader ? <T variant="pageTitle" accessibilityRole="header">Poruke</T> : null}
    {items !== null && error ? <View style={s.notice}>
      <T variant="note" accessibilityRole="alert">Razgovori nisu osveženi.</T>
      <T variant="note" tone="muted">Poslednji učitani razgovori ostaju prikazani. Osveži ih da nastaviš.</T>
      <V2Action label="Osveži razgovore" kind="quiet" compact onPress={onRefresh} disabled={readDisabled} loading={reading} />
    </View> : null}
  </View>;
  const empty = items === null
    ? error && !reading
      ? <StateView kind="error" title="Razgovori nisu učitani" body="Proveri vezu pa pokušaj ponovo."
          primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: readDisabled }} />
      : <StateView kind="loading" title="Učitavamo razgovore…" skeleton={{ count: 4, rows: 2, variant: 'plain' }} />
    : error ? null : <View style={s.empty}>
      <ConversationArt size={144} />
      <T variant="title" accessibilityRole="header" style={s.center}>Još nema razgovora</T>
      <T variant="copy" tone="muted" style={s.center}>Poruke iz tvojih Dogovora i grupnih razgovora pojaviće se ovde.</T>
      {onAgreements ? <V2Action label="Otvori Dogovore" kind="secondary" onPress={onAgreements} disabled={openDisabled} /> : null}
    </View>;
  const footer = items !== null && (hasMore || pageError || paging) ? <View style={s.footer}>
    {pageError ? <T variant="note" accessibilityRole="alert">Stariji razgovori nisu učitani. Pokušaj ponovo da nastaviš.</T> : null}
    <V2Action label={pageError ? 'Pokušaj ponovo' : 'Učitaj starije razgovore'} kind="quiet" onPress={onLoadMore}
      disabled={readDisabled} loading={paging} accessibilityLabel={pageError ? 'Ponovo učitaj starije razgovore' : undefined} />
  </View> : null;

  return <View style={s.screen}>
    {header}
    <FlatList data={rows} keyExtractor={rowKey} renderItem={renderItem}
      ListHeaderComponent={listHeader} ListEmptyComponent={empty} ListFooterComponent={footer}
      contentContainerStyle={[s.content, { paddingBottom: Math.max(0, bottomInset) + sys.space.xl }]}
      refreshing={items !== null && reading} onRefresh={refresh}
      keyboardShouldPersistTaps="handled" initialNumToRender={12} />
  </View>;
}

type RowProps = { item: ConversationInboxRow; moment: Trenutak | null; stacked: boolean;
  disabled: boolean; opening: boolean; unavailable: boolean; failed: boolean; photo?: ReactNode;
  onOpen: (row: ConversationInboxRow) => void };
const ConversationRow = memo(function ConversationRow({ item, moment, stacked, disabled, opening, unavailable, failed, photo, onOpen }: RowProps) {
  const title = conversationTitle(item);
  const preview = conversationPreview(item.lastMessage);
  // Private unread is explicitly unknown in V1, even if an upstream caller accidentally supplies a number.
  const unread = item.kind === 'GROUP' && item.unreadMessageCount !== null && Number.isSafeInteger(item.unreadMessageCount)
    && item.unreadMessageCount > 0 ? item.unreadMessageCount : null;
  const status = unavailable ? 'Razgovor trenutno nije dostupan.' : failed ? 'Razgovor nije otvoren. Pokušaj ponovo.' : null;
  const stamp = conversationStamp(moment);
  const time = moment ? `${moment.dan}, ${moment.sat}` : null;
  const closed = item.closed === true;
  const label = [title, item.task.title, closed ? 'Dogovor je zatvoren' : null, preview, time, unread === null ? null : neprocitanih(unread), status].filter(Boolean).join('. ');
  return <Press accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={unavailable ? undefined : failed ? 'Pokušaj ponovo da otvoriš razgovor.' : 'Otvara razgovor uz ovaj zadatak.'}
    accessibilityState={{ disabled, busy: opening }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={1}
    onPress={() => onOpen(item)} style={s.row}>
    <View style={s.avatar} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {photo ?? (item.kind === 'GROUP' ? <FactArt kind="users" size={40} /> : <Avatar initials={inicijali(item.counterpart?.displayName)} size={56} />)}
    </View>
    <View style={s.copy}>
      <View style={[s.rowHeading, stacked && s.rowHeadingStacked]}>
        <T variant="bodyStrong" numberOfLines={stacked ? undefined : 1} style={s.name}>{title}</T>
        {stamp ? <T variant="meta" tone="muted" style={s.time}>{stamp}</T> : null}
      </View>
      {/* A closed Dogovor has a lock before its task, so the row says it can only be read. */}
      <View style={s.taskLine}>
        {closed ? <View testID="conversation-lock" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><FactArt kind="lock" size={16} muted /></View> : null}
        <T variant="note" tone="muted" numberOfLines={stacked ? 3 : 2} style={s.taskTitle}>{item.task.title}</T>
      </View>
      <View style={s.previewRow}>
        <T variant="note" tone="ink" numberOfLines={stacked ? undefined : 2} style={s.preview}>{preview}</T>
        {unread !== null ? <View style={s.unread}><T variant="meta" style={s.unreadText}>{unread.toLocaleString('sr-Latn-RS')}</T></View> : null}
      </View>
      {status ? <T variant="note" tone="muted" accessibilityRole={failed ? 'alert' : undefined}>{status}</T> : null}
      {opening ? <View style={s.opening}><ActivityIndicator size="small" color={sys.color.ink} />
        <T variant="meta" tone="muted">Otvaramo razgovor…</T></View> : null}
    </View>
  </Press>;
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  content: { flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: sys.space.lg },
  heading: { paddingTop: sys.space.sm, paddingBottom: sys.space.sm, gap: sys.space.md },
  notice: { gap: sys.space.xs, paddingVertical: sys.space.sm },
  // The whole row is one 72+ target: the face (56), the person or group, the task, the last words and the stamp.
  row: { minHeight: 72, paddingVertical: sys.space.base, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  avatar: { width: 56, height: 56, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  taskLine: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.xs },
  taskTitle: { flexShrink: 1, minWidth: 0 },
  rowHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  rowHeadingStacked: { flexDirection: 'column', gap: sys.space.xs },
  name: { flexShrink: 1, flexGrow: 1, minWidth: 0, color: sys.color.ink },
  time: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: sys.space.sm },
  preview: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0, fontWeight: '400' },
  unread: { minWidth: 24, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.xs,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.ink },
  unreadText: { color: sys.color.surface, textAlign: 'center', fontVariant: ['tabular-nums'] },
  opening: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, marginTop: sys.space.xs },
  empty: { paddingVertical: sys.space.xxl, alignItems: 'center', gap: sys.space.md },
  center: { textAlign: 'center', maxWidth: '100%' },
  footer: { paddingVertical: sys.space.base, gap: sys.space.sm },
});
