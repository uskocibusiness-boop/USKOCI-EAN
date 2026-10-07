import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Platform, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { useAppear } from '../system/Appear';
import { Glyph } from '../system/Glyph';
import { ChromeIconButton } from '../system/ScreenChrome';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { dogovora } from '../system/plural';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { AgreementRow, GroupHeader } from '../agreements/AgreementListCard';
import {
  awaitsMyConfirmation, filterHistory, groupActiveAgreements, HISTORY_FILTERS, isActiveAgreement, type HistoryFilter,
} from '../agreements/agreementListModel';

/** Aktivni and Istorija (round-1 critique A11): "Svi" repeated both, and the count line repeated the tabs' own counts. */
export type AgreementCollectionSection = 'active' | 'history';
type Props = {
  items: readonly DogovorProjekcija[]; loading: boolean; refreshing?: boolean; error: boolean;
  section: AgreementCollectionSection; confirmationOnly: boolean;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void;
  onRefresh: () => void; onOpen: (agreement: DogovorProjekcija) => void;
  /**
   * Opens the rating of a finished Dogovor straight from its card (round-1 critique A2). The route owns the guard and
   * the navigation. Without it the card still says the rating waits, as words inside the card's own press.
   */
  onRate?: (agreement: DogovorProjekcija) => void;
  /** Opens the planner (Raspored). The pill beside the tabs says its name; the route owns the navigation. */
  onCalendar: () => void; onProfile: () => void; onHome: () => void;
  /** The root bar. The screen draws `ScreenHeader` (profile · mark · bell); the design gallery hands in a still one. */
  header?: ReactNode;
  /** Istorija shows "Sve · Završeni · Otkazani". The route may keep the choice through the foreground gate; without it the list keeps its own. */
  historyFilter?: HistoryFilter; onHistoryFilter?: (value: HistoryFilter) => void;
  /** "Now" for the day groups ("Danas", "Sutra"…). The screen leaves it out; the tests and the gallery fix it. */
  now?: Date;
};
const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'history', label: 'Istorija' }] as const;
/** The Aktivni list is groups, each a heading followed by its cards; one flat list keeps the virtualised window and the row memo. */
type ListRow = { id: string; kind: 'group'; title: string } | { id: string; kind: 'item'; item: DogovorProjekcija };
const keyOf = (row: ListRow) => row.id;
/** A heading is closer to the card under it than the card above it is: the heading carries its own top space. */
const Separator = ({ leadingItem }: { leadingItem?: ListRow }) => <View style={leadingItem?.kind === 'group' ? s.afterGroup : s.separator} />;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. No row holds a text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
/** The minute the day groups are taken at: a number that changes once a minute, so rows memoised on it are not drawn again inside one. */
const minuteOf = (now?: Date) => Math.floor((now ?? new Date()).getTime() / 60_000) * 60_000;
/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen, onRate } = props;
  // "Čeka tvoju potvrdu" narrows the active Dogovori only: nothing in history waits for a confirmation.
  const filtering = section === 'active' && confirmationOnly;
  // Istorija's chips: the route may keep the choice through the foreground gate; a list drawn without that keeps its own.
  const [ownHistoryFilter, setOwnHistoryFilter] = useState<HistoryFilter>('all');
  const historyFilter = props.historyFilter ?? ownHistoryFilter;
  const setHistoryFilter = props.onHistoryFilter ?? setOwnHistoryFilter;
  const now = minuteOf(props.now);
  const activeItems = useMemo(() => items.filter(isActiveAgreement), [items]);
  const historyItems = useMemo(() => items.filter(item => !isActiveAgreement(item)), [items]);
  // Aktivni is groups ("Čeka tebe" first, then the days), each a heading and its cards; Istorija keeps the newest-first order
  // the server gave, narrowed by its chips. One flat list, so the window and the row memo stay as they were.
  const rows = useMemo<ListRow[]>(() => {
    if (section === 'history') return filterHistory(historyItems, historyFilter).map(item => ({ id: item.id, kind: 'item' as const, item }));
    const pool = filtering ? activeItems.filter(awaitsMyConfirmation) : activeItems;
    return groupActiveAgreements(pool, new Date(now)).flatMap(group => [{ id: `group:${group.key}`, kind: 'group' as const, title: group.title },
      ...group.items.map(item => ({ id: item.id, kind: 'item' as const, item }))]);
  }, [section, filtering, activeItems, historyItems, historyFilter, now]);
  const waiting = useMemo(() => items.filter(awaitsMyConfirmation).length, [items]);
  const settledRead = !loading && !error;
  // Each set says how many Dogovori it holds, as a quiet count on its tab, and only once the read has settled. An empty
  // set shows no number: a zero on a badge reads as news. What waits for me is on the cards and the chip.
  const activeCount = activeItems.length, historyCount = historyItems.length;
  const sections = useMemo(() => {
    if (!settledRead) return SECTIONS;
    const counts: Record<AgreementCollectionSection, number> = { active: activeCount, history: historyCount };
    return SECTIONS.map(option => counts[option.key] ? { ...option, badge: counts[option.key], badgeLabel: dogovora(counts[option.key]) } : option);
  }, [historyCount, activeCount, settledRead]);
  const appear = useAppear();
  appear.settle(rows.filter(row => row.kind === 'item').map(keyOf), JSON.stringify([section, filtering, historyFilter]));
  // `useAppear` returns a new object each render over the same two refs, and the route's `onOpen`
  // is a fresh closure each render; both are read through refs so `renderItem` keeps its identity.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const rateRef = useRef(onRate); rateRef.current = onRate;
  const openItem = useCallback((item: DogovorProjekcija) => openRef.current(item), []);
  const rateItem = useCallback((item: DogovorProjekcija) => rateRef.current?.(item), []);
  const rates = !!onRate;
  const renderItem = useCallback(({ item: row, index }: ListRenderItemInfo<ListRow>) => row.kind === 'group'
    ? <GroupHeader title={row.title} />
    : <AgreementRow item={row.item} index={index} now={now} animate={appearRef.current.isNew(row.id)} onOpen={openItem}
      onRate={rates ? rateItem : undefined} />, [openItem, rateItem, rates, now]);
  // A set that is empty while the other one is not leads to the one that has Dogovori, with the filter off, so the
  // way forward never lands on another empty view (review r3 item 7).
  const target: AgreementCollectionSection = (section === 'active' && !filtering) || !activeCount ? 'history' : 'active';
  const showOther = () => { props.onSection(target); props.onConfirmationOnly(false); };
  // A chip of Istorija that holds nothing while the other chips do: the way forward is "Sve", not another set.
  const narrowedEmpty = section === 'history' && historyFilter !== 'all' && historyCount > 0;
  // The one state view (2026-09-24): reading, not read, nothing in this set, nothing yet — each in the same look.
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 3, rows: 2 }} />
      : error ? <StateView kind="error" art="agreements" title="Dogovore trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : items.length ? <StateView art="agreements"
          title={filtering ? 'Nijedan Dogovor ne čeka tvoju potvrdu' : section === 'active' ? 'Nema aktivnih Dogovora'
            : narrowedEmpty ? (historyFilter === 'cancelled' ? 'Nema otkazanih Dogovora' : 'Nema završenih Dogovora') : 'Još nema završenih Dogovora'}
          primary={narrowedEmpty ? { label: 'Prikaži sve', onPress: () => setHistoryFilter('all') }
            : { label: target === 'history' ? 'Pogledaj istoriju' : 'Pogledaj aktivne Dogovore', onPress: showOther }} />
          : <StateView art="agreements" title="Još nemaš Dogovor"
            body="Kada izabereš nekoga za svoj zadatak, ili kada tvoja prijava bude izabrana, Dogovor se pojavljuje ovde."
            primary={{ label: 'Idi na Početnu', onPress: props.onHome }} />}
  </View>;
  // Aktivni: the one filter. Istorija: "Sve · Završeni · Otkazani". A chip is a choice of what is shown, not a command.
  const chips = section === 'active' ? (waiting || confirmationOnly ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka tvoju potvrdu"
    accessibilityState={{ checked: confirmationOnly }} onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select"
    style={[s.chip, confirmationOnly && s.chipOn]}>
    {confirmationOnly ? <Glyph name="check" size={16} tone="green" /> : null}
    <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka tvoju potvrdu</T>
  </Press> : null) : settledRead && historyCount ? <View style={s.chipRow}>
    {HISTORY_FILTERS.map(option => {
      const on = historyFilter === option.key;
      return <Press key={option.key} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: on }}
        onPress={() => setHistoryFilter(option.key)} haptic="select" style={[s.chip, on && s.chipOn]}>
        {on ? <Glyph name="check" size={16} tone="green" /> : null}
        <T variant="meta" style={[s.chipText, on && s.chipTextOn]}>{option.label}</T>
      </Press>;
    })}
  </View> : null;
  // Istorija holds the strip of its chips while they are on their way (the read) and while it has history to filter, so the list does
  // not slide down when the read settles.
  const holdsStrip = section === 'history' && !error && (loading || historyCount > 0);
  return <SafeAreaView edges={['top']} style={s.screen}>
    {/* The root bar is the same on all three tabs: profile · mark · bell (round-1 critique A12). */}
    {props.header ?? <ScreenHeader title="Dogovori" onProfile={props.onProfile} />}
    {/* Capsule tabs carry their counts once. "Raspored" ends the same row, with its word; the filter follows only when needed. */}
    <View style={s.controls}>
      <View style={s.tabRow}>
        {/* Tabs scroll within their own space on narrow/large-text screens; their text keeps full contrast at the edge. */}
        <View style={s.tabs}><Segmented contentSized scroll options={sections} value={section} onChange={props.onSection} /></View>
        <ChromeIconButton glyph="calendar" caption="Raspored" label="Raspored" onPress={props.onCalendar} />
      </View>
      {chips || holdsStrip ? <View style={s.toolbar}>{chips}</View> : null}
    </View>
    <FlatList<ListRow> data={loading || error ? [] : rows} keyExtractor={keyOf} refreshing={props.refreshing ?? loading}
      onRefresh={props.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      // Six of these cards are more than one phone screen; a modest window fills a fast scroll quickly.
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
      ItemSeparatorComponent={Separator} renderItem={renderItem} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  controls: { paddingHorizontal: 20, paddingTop: 4 },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  tabs: { flex: 1, minWidth: 0 },
  // Istorija keeps this strip's height whether its chips are drawn yet or not, so the list does not slide down when the read settles.
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: sys.touch.min, paddingHorizontal: 12, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.surface },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, flex: 1 },
  separator: { height: 12 },
  afterGroup: { height: 12 },
});
