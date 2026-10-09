import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Platform, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { AgreementCancellations } from '../../data/agreementCancellationClientService';
import { Press } from '../Press';
import { useAppear } from '../system/Appear';
import { usePullRefresh } from '../system/usePullRefresh';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ChromeIconButton } from '../system/ScreenChrome';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { dogovora } from '../system/plural';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { AgreementTaskRow } from '../agreements/AgreementListCard';
import { GroupHeader } from '../agreements/GroupHeader';
import {
  agreementAttention, awaitsMyConfirmation, filterHistory, groupActiveAgreementTasks, HISTORY_FILTERS, type HistoryFilter,
  AGREEMENT_ROLE_FILTERS, filterAgreementRole, groupAgreementTasks, isActiveAgreementTask, type AgreementTaskGroup, type AgreementRoleFilter,
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
  /** Opens the planner (Raspored). The icon beside the tabs says its name to a screen reader; the route owns the navigation. */
  onCalendar: () => void; onProfile: () => void; onHome: () => void;
  /**
   * The two ways to a first Dogovor, for the empty list: look at the tasks (to apply) or publish one. The route owns the navigation.
   * Without them the empty list can only lead to Početna, which is all a list drawn by itself can do.
   */
  onTasks?: () => void; onPublish?: () => void;
  /** The root bar. The screen draws `ScreenHeader` (profile · mark · bell); the design gallery hands in a still one. */
  header?: ReactNode;
  /** Istorija shows "Sve · Završeni · Otkazani". The route may keep the choice through the foreground gate; without it the list keeps its own. */
  historyFilter?: HistoryFilter; onHistoryFilter?: (value: HistoryFilter) => void;
  roleFilter?: AgreementRoleFilter; onRoleFilter?: (value: AgreementRoleFilter) => void;
  expandedTaskKey?: string | null; onExpandedTask?: (key: string | null, witness: DogovorProjekcija) => void;
  /** "Now" for the day groups ("Danas", "Sutra"…). The screen leaves it out; the tests and the gallery fix it. */
  now?: Date;
  /**
   * When, by whom and why the cancelled Dogovori of the list were cancelled (CANCEL-INFO, `agreementCancellationService`). The
   * route reads it for the current section, including cancelled siblings of active tasks; no answer says only "Otkazan".
   */
  cancellations?: AgreementCancellations | null;
};
const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'history', label: 'Istorija' }] as const;
/** The Aktivni list is groups, each a heading followed by its cards; one flat list keeps the virtualised window and the row memo. */
type ListRow = { id: string; kind: 'group'; title: string } | { id: string; kind: 'item'; task: AgreementTaskGroup };
const keyOf = (row: ListRow) => row.id;
/** A heading is closer to the card under it than the card above it is: the heading carries its own top space (12 + the card gap 12 = 24 above, 12 below). */
const Separator = () => <View style={s.separator} />;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. No row holds a text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
/** The minute the day groups are taken at: a number that changes once a minute, so rows memoised on it are not drawn again inside one. */
const minuteOf = (now?: Date) => Math.floor((now ?? new Date()).getTime() / 60_000) * 60_000;
/** The words a screen reader hears for the number on Aktivni: what waits for the person, with the verb of its count ("1 Dogovor čeka tebe", "3 Dogovora čekaju tebe"). */
const waitingSpoken = (count: number) => `${dogovora(count)} ${count === 1 ? 'čeka' : 'čekaju'} tebe`;
/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen, onRate } = props;
  // The pull spinner answers a pull only; a read of its own (a focus, a tab) does not raise it (the owner's "dot", 8 Oct 2026).
  const pull = usePullRefresh(props.onRefresh, !!(props.refreshing ?? loading));
  // "Čeka tvoju potvrdu" narrows the active Dogovori only: nothing in history waits for a confirmation.
  const filtering = section === 'active' && confirmationOnly;
  // Istorija's chips: the route may keep the choice through the foreground gate; a list drawn without that keeps its own.
  const [ownHistoryFilter, setOwnHistoryFilter] = useState<HistoryFilter>('all');
  const historyFilter = props.historyFilter ?? ownHistoryFilter;
  const setHistoryFilter = props.onHistoryFilter ?? setOwnHistoryFilter;
  const [ownRoleFilter, setOwnRoleFilter] = useState<AgreementRoleFilter>('all');
  const roleFilter = props.roleFilter ?? ownRoleFilter;
  const setRoleFilter = props.onRoleFilter ?? setOwnRoleFilter;
  const roleItems = useMemo(() => filterAgreementRole(items, roleFilter), [items, roleFilter]);
  const now = minuteOf(props.now);
  const tasks = useMemo(() => groupAgreementTasks(roleItems), [roleItems]);
  const activeItems = useMemo(() => tasks.filter(isActiveAgreementTask), [tasks]);
  const historyItems = useMemo(() => tasks.filter(task => !isActiveAgreementTask(task)), [tasks]);
  const [ownExpandedKey, setOwnExpandedKey] = useState<string | null>(null);
  const expandedKey = props.expandedTaskKey === undefined ? ownExpandedKey : props.expandedTaskKey;
  const expandRef = useRef(props.onExpandedTask); expandRef.current = props.onExpandedTask;
  const expand = useCallback((key: string | null, witness: DogovorProjekcija) => {
    if (expandRef.current) expandRef.current(key, witness); else setOwnExpandedKey(key);
  }, []);
  // Aktivni is groups ("Čeka tebe" first, then the days), each a heading and its cards; Istorija keeps the newest-first order
  // the server gave, narrowed by its chips. One flat list, so the window and the row memo stay as they were.
  const rows = useMemo<ListRow[]>(() => {
    if (section === 'history') return historyItems.filter(task => filterHistory(task.items, historyFilter).length > 0)
      .map(task => ({ id: task.key, kind: 'item' as const, task }));
    const pool = filtering ? activeItems.filter(task => task.items.some(awaitsMyConfirmation)) : activeItems;
    return groupActiveAgreementTasks(pool, new Date(now)).flatMap(group => [{ id: `group:${group.key}`, kind: 'group' as const, title: group.title },
      ...group.items.map(task => ({ id: task.key, kind: 'item' as const, task }))]);
  }, [section, filtering, activeItems, historyItems, historyFilter, now]);
  const waiting = useMemo(() => roleItems.filter(awaitsMyConfirmation).length, [roleItems]);
  const settledRead = !loading && !error;
  // The two sets are told apart by their words, not by counts: a number is drawn ONLY for what needs the person, as the orange
  // count on Aktivni ("Čeka tebe"), and only once the read has settled; a count of how many there are says nothing to act on.
  // It is the size of the list's own first group, so the tab and the group name the same Dogovori.
  const attention = useMemo(() => activeItems.filter(task => task.items.some(item => agreementAttention(item) !== null)).length, [activeItems]);
  const sections = useMemo(() => !settledRead || !attention ? SECTIONS
    : SECTIONS.map(option => option.key === 'active' ? { ...option, badge: attention, badgeLabel: waitingSpoken(attention), badgeTone: 'attention' as const } : option),
  [attention, settledRead]);
  const activeCount = activeItems.length, historyCount = historyItems.length;
  const appear = useAppear();
  // The skeleton was on screen before these rows: they are news, so the first few arrive once (M-02). A warm return (rows already there,
  // no skeleton) and a change of set or filter stay still.
  const sawSkeleton = useRef(false);
  if (loading) sawSkeleton.current = true;
  appear.settle(rows.filter(row => row.kind === 'item').map(keyOf), JSON.stringify([section, filtering, historyFilter, roleFilter]), { afterLoading: sawSkeleton.current });
  // `useAppear` returns a new object each render over the same two refs, and the route's `onOpen`
  // is a fresh closure each render; both are read through refs so `renderItem` keeps its identity.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const rateRef = useRef(onRate); rateRef.current = onRate;
  const openItem = useCallback((item: DogovorProjekcija) => openRef.current(item), []);
  const rateItem = useCallback((item: DogovorProjekcija) => rateRef.current?.(item), []);
  const rates = !!onRate;
  const cancellations = props.cancellations;
  const renderItem = useCallback(({ item: row, index }: ListRenderItemInfo<ListRow>) => row.kind === 'group'
    ? <GroupHeader title={row.title} first={index === 0} />
    : <AgreementTaskRow group={row.task} index={index} now={now} animate={appearRef.current.isNew(row.id)} onOpen={openItem}
      expanded={expandedKey === row.task.key} onExpand={expand} cancellations={cancellations}
      prioritize={section === 'history' ? historyFilter : filtering ? 'confirmation' : 'all'}
      onRate={rates ? rateItem : undefined} />, [openItem, rateItem, rates, now, cancellations, expandedKey, expand, section, historyFilter, filtering]);
  // A set that is empty while the other one is not leads to the one that has Dogovori, with the filter off, so the
  // way forward never lands on another empty view (review r3 item 7).
  const target: AgreementCollectionSection = (section === 'active' && !filtering) || !activeCount ? 'history' : 'active';
  const showOther = () => { props.onSection(target); props.onConfirmationOnly(false); };
  // A chip of Istorija that holds nothing while the other chips do: the way forward is "Sve", not another set.
  const narrowedEmpty = section === 'history' && historyFilter !== 'all' && historyCount > 0;
  const emptyRole = roleFilter !== 'all' && roleItems.length === 0 && items.length > 0;
  const clearRole = () => {
    setRoleFilter('all'); props.onConfirmationOnly(false); setHistoryFilter('all');
    if (!groupAgreementTasks(items).some(task => isActiveAgreementTask(task) === (section === 'active'))) props.onSection(section === 'active' ? 'history' : 'active');
  };
  const historyInActive = section === 'history' && activeItems.some(task => task.items.some(item => item.stanje === 'COMPLETED' || item.stanje === 'CANCELLED'));
  // The one state view: reading, not read, nothing in this set, nothing yet - each in the same look. Nothing yet leads to the two
  // ways a Dogovor begins (look at the tasks; publish one) when the route can take the person there, and otherwise to Početna.
  const first = props.onTasks ? { label: 'Pogledaj zadatke', onPress: props.onTasks } : { label: 'Idi na Početnu', onPress: props.onHome };
  const second = props.onTasks ? props.onPublish ? { label: 'Objavi zadatak', onPress: props.onPublish } : { label: 'Idi na Početnu', onPress: props.onHome } : undefined;
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 3, rows: 2 }} />
      : error ? <StateView kind="error" art="agreements" title="Ne možemo da učitamo Dogovore" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : emptyRole ? <StateView art="agreements" title="Nema Dogovora u ovoj ulozi" primary={{ label: 'Prikaži sve uloge', onPress: clearRole }} />
        : items.length ? <StateView art="agreements"
          title={filtering ? 'Nijedan Dogovor ne čeka tvoju potvrdu' : section === 'active' ? 'Nema aktivnih Dogovora'
            : narrowedEmpty ? (historyFilter === 'cancelled' ? 'Nema otkazanih Dogovora' : 'Nema završenih Dogovora') : historyInActive ? 'Saradnje su uz aktivne zadatke' : 'Još nema završenih Dogovora'}
          body={historyInActive ? 'Završene i otkazane saradnje ostaju uz isti zadatak dok još ima obaveza. Pronađi ih u Aktivni.' : undefined}
          primary={narrowedEmpty ? { label: 'Prikaži sve', onPress: () => setHistoryFilter('all') }
            : { label: target === 'history' ? 'Pogledaj istoriju' : 'Pogledaj aktivne Dogovore', onPress: showOther }} />
          : <StateView hero art="agreements" title="Još nemaš Dogovor" body="Dogovor nastaje kad izabereš prijavu ili te izaberu."
            primary={first} quiet={second} />}
  </View>;
  // Aktivni: the one filter. Istorija: "Sve · Završeni · Otkazani". A chip is a choice of what is shown, not a command.
  const chips = section === 'active' ? (waiting || confirmationOnly ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka tvoju potvrdu"
    accessibilityState={{ checked: confirmationOnly }} onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select"
    style={[s.chip, confirmationOnly && s.chipOn]}>
    {confirmationOnly ? <Glyph name="check" size={16} tone="green" /> : null}
    <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka tvoju potvrdu</T>
  </Press> : null) : settledRead && historyCount ? <View accessibilityRole="radiogroup" accessibilityLabel="Stanje završenih Dogovora" style={s.chipRow}>
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
    {/* The one row of controls: two sets of equal width that never scroll and are never cut, and the planner as an icon at its end
        (its name is its spoken label). The filter follows only when needed. */}
    <View style={s.controls}>
      <View style={s.tabRow}>
        <View style={s.tabs}><Segmented options={sections} value={section} onChange={props.onSection} /></View>
        <ChromeIconButton glyph="calendar" label="Raspored" onPress={props.onCalendar} />
      </View>
      {items.length > 0 || loading || roleFilter !== 'all' ? <View style={s.toolbar}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Tvoja uloga u Dogovorima" style={s.chipRow}>
          {AGREEMENT_ROLE_FILTERS.map(option => {
            const selected = roleFilter === option.key;
            return <Press key={option.key} accessibilityRole="radio" accessibilityLabel={option.spoken} accessibilityState={{ checked: selected }}
              onPress={() => { setRoleFilter(option.key); props.onConfirmationOnly(false); }} haptic="select" style={[s.chip, selected && s.chipOn]}>
              {selected ? <Glyph name="check" size={16} tone="green" /> : null}
              <T variant="meta" style={[s.chipText, selected && s.chipTextOn]}>{option.label}</T>
            </Press>;
          })}
        </View>
      </View> : null}
      {chips || holdsStrip ? <View style={s.toolbar}>{chips}</View> : null}
    </View>
    <FlatList<ListRow> data={loading || error ? [] : rows} keyExtractor={keyOf} refreshing={pull.refreshing}
      onRefresh={pull.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      // Six of these cards are more than one phone screen; a modest window fills a fast scroll quickly.
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
      ItemSeparatorComponent={Separator} renderItem={renderItem} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // The bar, 8, the row of controls, 12 (the list's own top), then the content: the root template of the composition spec.
  controls: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  tabs: { flex: 1, minWidth: 0 },
  // Istorija keeps this strip's height whether its chips are drawn yet or not, so the list does not slide down when the read settles.
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: layout.touch, paddingTop: sys.space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.surface },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md, paddingBottom: layout.zone, flexGrow: 1 },
  empty: { flex: 1 },
  separator: { height: layout.group },
});
