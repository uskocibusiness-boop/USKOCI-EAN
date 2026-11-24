import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Modal, Platform, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { V2Action } from './V2Action';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import type { AgreementCancellations } from '../../data/agreementCancellationClientService';
import type { OwnAgreementCounts } from '../../data/ownAgreementGroupsPage';
import { Press } from '../Press';
import { useAppear } from '../system/Appear';
import { usePullRefresh } from '../system/usePullRefresh';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { zadataka } from '../system/plural';
import { StateView } from '../system/StateView';
import { SkeletonList } from '../system/Skeleton';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { HowItWorks } from '../home/HowItWorks';
import { SearchField } from './discovery/SearchParts';
import { agreementGroupMatchesSearch, agreementSearchQuery, AGREEMENT_SEARCH_MAX_LENGTH } from '../agreements/agreementSearch';
import { AgreementRoleRail } from '../agreements/AgreementRoleRail';
import { AgreementTaskRow } from '../agreements/AgreementListCard';
import { AgreementTaskCard } from '../agreements/AgreementTaskCard';
import { DiscoveryChipRow, type QuickChip } from './discovery/DiscoveryChipRow';
import { DateRangeGrid } from './discovery/DateRangeGrid';
import { QuietReadState } from './QuietReadState';
import { GroupHeader } from '../agreements/GroupHeader';
import {
  agreementAttention, filterHistory, groupActiveAgreementTasks, HISTORY_FILTERS, type HistoryFilter,
  filterAgreementRole, groupAgreementTasks, isActiveAgreementTask, type AgreementTaskGroup, type AgreementRoleFilter,
} from '../agreements/agreementListModel';

/** The root and its previous-collaborations view share the same owned list and filters. */
export type AgreementCollectionSection = 'active' | 'history';
type Props = {
  pagination?: { hasMore: boolean; loadingMore: boolean; moreError: boolean; loadedGroups: number;
    counts: OwnAgreementCounts | null; onMore: () => void };
  search?: { query: string; open: boolean; onChange: (value: string) => void; onToggle: () => void };
  items: readonly DogovorProjekcija[]; loading: boolean; refreshing?: boolean; refreshError?: boolean; error: boolean;
  section: AgreementCollectionSection; confirmationOnly: boolean;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void;
  onRefresh: () => void; onOpen: (agreement: DogovorProjekcija) => void;
  /** Optional owner-only task-wide read; missing values make no coverage claim. */
  ownerCapacities?: ReadonlyMap<string, NeedSearchState> | null;
  onOpenOwnerTask?: (taskId: string, witness: DogovorProjekcija) => void;
  /** The task card (owner's design 22.11.2026) opens one Dogovor screen per task. */
  onOpenTask?: (group: AgreementTaskGroup) => void;
  /**
   * Opens the rating of a finished Dogovor straight from its card (round-1 critique A2). The route owns the guard and
   * the navigation. Without it the card still says the rating waits, as words inside the card's own press.
   */
  onRate?: (agreement: DogovorProjekcija) => void;
  /** Opens the planner (Raspored); the route owns the navigation. */
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
/** The Aktivni list is groups, each a heading followed by its cards; one flat list keeps the virtualised window and the row memo. */
type ListRow = { id: string; kind: 'group'; title: string } | { id: string; kind: 'item'; task: AgreementTaskGroup };
const keyOf = (row: ListRow) => row.id;
/** Group titles belong to the next card; keep the full separation between two task cards. */
const Separator = ({ leadingItem }: { leadingItem?: ListRow }) => <View style={leadingItem?.kind === 'group' ? s.headingSeparator : s.separator} />;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. No row holds a text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
/** The minute the day groups are taken at: a number that changes once a minute, so rows memoised on it are not drawn again inside one. */
const minuteOf = (now?: Date) => Math.floor((now ?? new Date()).getTime() / 60_000) * 60_000;
/** Count the tasks shown in this group, not the separate people collaborating on each task. */
/** A civil day in Serbian time, YYYY-MM-DD. */
const serbianDayOf = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dayLabel = (day: string) => { const [y, m, d] = day.split('-'); return `${Number(d)}. ${Number(m)}. ${y}.`; };
/** A task is in the date range when one of its Dogovori starts on a day inside it; no range keeps everything. */
function inRange(task: AgreementTaskGroup, range: { from: string; to: string | null } | null): boolean {
  if (!range) return true;
  const to = range.to ?? range.from;
  return task.items.some(item => {
    const at = item.prihvacenPocetak ?? item.tacanTermin?.pocetak ?? null;
    if (!at) return false;
    const time = Date.parse(at);
    if (!Number.isFinite(time)) return false;
    const day = serbianDayOf(new Date(time));
    return day >= range.from && day <= to;
  });
}
const waitingTitle = (count: number) => `Čeka Vas · ${zadataka(count)}`;
/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen, onRate } = props;
  const [ownSearch, setOwnSearch] = useState({ active: { query: '', open: false }, history: { query: '', open: false } });
  const search = props.search ?? { ...ownSearch[section],
    onChange: (query: string) => setOwnSearch(value => ({ ...value, [section]: { open: true, query: query.slice(0, AGREEMENT_SEARCH_MAX_LENGTH) } })),
    onToggle: () => setOwnSearch(value => ({ ...value, [section]: value[section].open ? { query: '', open: false } : { ...value[section], open: true } })) };
  const query = agreementSearchQuery(search.query);
  const searchOffsets = useRef({ active: { query: '', offset: 0 }, history: { query: '', offset: 0 } });
  if (searchOffsets.current[section].query !== query) searchOffsets.current[section] = { query, offset: 0 };
  const scrollOffsets = useRef<Record<AgreementCollectionSection, number>>({ active: 0, history: 0 });
  const stale = !!props.refreshError && !loading && !error;
  // The pull spinner answers a pull only; a read of its own (a focus, a tab) does not raise it (the owner's "dot", 8 Oct 2026).
  const pull = usePullRefresh(props.onRefresh, !!(props.refreshing ?? loading));
  // "Čeka Vas" (owner 22.11.2026) is a filter, not a section: it narrows the active Dogovori to those waiting for my action.
  const filtering = section === 'active' && confirmationOnly;
  // Istorija's chips: the route may keep the choice through the foreground gate; a list drawn without that keeps its own.
  const [ownHistoryFilter, setOwnHistoryFilter] = useState<HistoryFilter>('all');
  const historyFilter = props.historyFilter ?? ownHistoryFilter;
  const setHistoryFilter = props.onHistoryFilter ?? setOwnHistoryFilter;
  const [ownRoleFilter, setOwnRoleFilter] = useState<AgreementRoleFilter>('all');
  // Date filter (from - to): the accepted start of a Dogovor, in Serbian time.
  const [dateRange, setDateRange] = useState<{ from: string; to: string | null } | null>(null);
  const [pendingRange, setPendingRange] = useState<{ from: string; to: string | null } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const roleFilter = props.roleFilter ?? ownRoleFilter;
  const setRoleFilter = props.onRoleFilter ?? setOwnRoleFilter;
  const roleItems = useMemo(() => filterAgreementRole(items, roleFilter), [items, roleFilter]);
  // This is a filter over actual collaborations, not a second account/persona switch.
  // Keep an active filter available even when its last result disappears, so it can be cleared.
  const loadedBothRoles = useMemo(() => new Set(items.flatMap(item => {
    const role = item.ucesnici.find(person => person.viSte)?.uloga;
    return role ? [role] : [];
  })).size > 1, [items]);
  const counts = props.pagination?.counts;
  const hasBothRoles = counts?.hasBothRoles ?? loadedBothRoles;
  const now = minuteOf(props.now);
  const todayDay = serbianDayOf(new Date(now));
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
    if (section === 'history') return historyItems.filter(task => filterHistory(task.items, historyFilter).length > 0 && agreementGroupMatchesSearch(task, query, historyFilter) && inRange(task, dateRange))
      .map(task => ({ id: task.key, kind: 'item' as const, task }));
    const pool = activeItems.filter(task => (!filtering || task.items.some(item => agreementAttention(item) !== null)) && agreementGroupMatchesSearch(task, query) && inRange(task, dateRange));
    const groups = groupActiveAgreementTasks(pool, new Date(now));
    let upcomingStarted = false;
    return groups.flatMap(group => {
      const upcoming = group.key === 'tomorrow' || group.key === 'week' || group.key === 'later';
      // A clean list: what waits for me stays on top (the server's order) without a "Čeka Vas" heading.
      const heading: ListRow[] = upcoming && upcomingStarted || group.key === 'waiting' ? [] : [{ id: upcoming ? 'group:upcoming' : `group:${group.key}`, kind: 'group',
        title: upcoming ? 'Sledeće' : group.key === 'undated' ? 'Bez tačnog termina' : group.key === 'past' ? 'Ranije, još otvoreno' : group.title }];
      if (upcoming) upcomingStarted = true;
      // Keep the accepted chronology and whole task groups, including overdue
      // unfinished work. The cards themselves carry the exact day and time.
      return [...heading, ...group.items.map(task => ({ id: task.key, kind: 'item' as const, task }))];
    });
  }, [section, filtering, activeItems, historyItems, historyFilter, now, query, dateRange]);
  const loadedWaiting = useMemo(() => roleItems.filter(item => agreementAttention(item) !== null).length, [roleItems]);
  const waiting = counts?.activeAttention ?? counts?.attention ?? loadedWaiting;
  const settledRead = !loading && !error;
  const freshRead = settledRead && !stale;
  // The count belongs to "Čeka tebe". In history a direct link keeps outstanding actions discoverable.
  const loadedAttention = useMemo(() => activeItems.filter(task => task.items.some(item => agreementAttention(item) !== null)).length, [activeItems]);
  const attention = counts?.activeAttention ?? loadedAttention;
  const activeCount = counts?.active ?? activeItems.length, historyCount = counts?.history ?? historyItems.length;
  const appear = useAppear();
  // The waiting state was on screen before these rows: they are news, so the first few arrive once (M-02). A warm return
  // with rows already there and a change of set or filter stay still.
  const sawLoading = useRef(false);
  if (loading) sawLoading.current = true;
  appear.settle(rows.filter(row => row.kind === 'item').map(keyOf), JSON.stringify([section, filtering, historyFilter, roleFilter, query]), { afterLoading: sawLoading.current });
  // `useAppear` returns a new object each render over the same two refs, and the route's `onOpen`
  // is a fresh closure each render; both are read through refs so `renderItem` keeps its identity.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const rateRef = useRef(onRate); rateRef.current = onRate;
  const openItem = useCallback((item: DogovorProjekcija) => openRef.current(item), []);
  const rateItem = useCallback((item: DogovorProjekcija) => rateRef.current?.(item), []);
  const rates = !!onRate;
  const cancellations = props.cancellations;
  const ownerCapacities = props.ownerCapacities;
  const ownerTaskRef = useRef(props.onOpenOwnerTask); ownerTaskRef.current = props.onOpenOwnerTask;
  const openOwnerTask = useCallback((taskId: string, witness: DogovorProjekcija) => ownerTaskRef.current?.(taskId, witness), []);
  const taskRef = useRef(props.onOpenTask); taskRef.current = props.onOpenTask;
  const openTask = useCallback((group: AgreementTaskGroup) => taskRef.current?.(group), []);
  const renderItem = useCallback(({ item: row, index }: ListRenderItemInfo<ListRow>) => row.kind === 'group'
    ? <GroupHeader title={row.title} first={index === 0} />
    : taskRef.current ? <AgreementTaskCard group={row.task} index={index} animate={appearRef.current.isNew(row.id)} stale={stale}
      onOpen={openTask} onRate={rates ? rateItem : undefined} />
    : <AgreementTaskRow group={row.task} index={index} now={now} animate={appearRef.current.isNew(row.id)} stale={stale} onOpen={openItem}
      searchQuery={query} expanded={expandedKey === row.task.key} onExpand={expand} cancellations={cancellations}
      ownerCapacities={ownerCapacities} onOpenOwnerTask={props.onOpenOwnerTask ? openOwnerTask : undefined}
      prioritize={section === 'history' ? historyFilter : filtering ? 'confirmation' : 'all'}
      onRate={rates ? rateItem : undefined} />, [openItem, openTask, rateItem, rates, now, cancellations, ownerCapacities, props.onOpenOwnerTask, openOwnerTask, expandedKey, expand, section, historyFilter, filtering, stale, query]);
  // A set that is empty while the other one is not leads to the one that has Dogovori, with the filter off, so the
  // way forward never lands on another empty view (review r3 item 7).
  const target: AgreementCollectionSection = (section === 'active' && !filtering) || !activeCount ? 'history' : 'active';
  const showOther = () => { props.onSection(target); props.onConfirmationOnly(false); };
  // A chip of Istorija that holds nothing while the other chips do: the way forward is "Sve", not another set.
  const narrowedEmpty = section === 'history' && historyFilter !== 'all' && historyCount > 0;
  const emptyRole = roleFilter !== 'all' && (counts ? counts.active + counts.history === 0 && counts.hasAny : roleItems.length === 0 && items.length > 0);
  const clearRole = () => {
    setRoleFilter('all'); props.onConfirmationOnly(false); setHistoryFilter('all');
  };
  const historyInActive = section === 'history' && (counts?.historyInActive ?? activeItems.some(task => task.items.some(item => item.stanje === 'COMPLETED' || item.stanje === 'CANCELLED')));
  const historyEmptyTitle = historyFilter === 'completed' ? 'Nema završenih Dogovora'
    : historyFilter === 'cancelled' ? 'Nema otkazanih Dogovora' : 'Još nema prethodnih saradnji';
  // Reading, a failed read, nothing in this set and nothing yet remain distinct. Nothing yet leads to the two
  // ways a Dogovor begins (look at the tasks; publish one) when the route can take the person there, and otherwise to Početna.
  const first = props.onTasks ? { label: 'Pogledajte zadatke', onPress: props.onTasks } : { label: 'Idite na Početnu', onPress: props.onHome };
  const second = props.onTasks ? props.onPublish ? { label: 'Objavi zadatak', onPress: props.onPublish } : { label: 'Idite na Početnu', onPress: props.onHome } : undefined;
  const empty = <View style={s.empty}>
    {/* Owner, 24.11.2026: while the first read is on its way, cards of the same shape stand where the Dogovori will be, so nothing jumps. */}
    {loading ? <SkeletonList variant="record" count={3} foot label={section === 'history' ? 'Učitavamo prethodne saradnje' : 'Učitavamo Dogovore'} />
      : error ? <StateView kind="error" art="agreements" title="Ne možemo da učitamo Dogovore" body="Pokušajte ponovo da proverite stanje."
        primary={{ label: 'Pokušajte ponovo', onPress: props.onRefresh }} />
        : query ? <StateView compact art="agreements" title={stale || props.refreshing ? 'Rezultati pretrage nisu potvrđeni' : 'Nema rezultata u ovom pregledu'}
          body={stale || props.refreshing ? 'Pretraga obuhvata samo poslednje učitane podatke. Osvežite Dogovore.' : 'Pokušajte sa drugim naslovom, imenom saradnika ili prikazanim mestom. Izabrana uloga i ishod ostaju važeći.'}
          primary={stale || props.refreshing ? { label: 'Osvežite Dogovore', onPress: props.onRefresh } : { label: 'Obrišite pretragu', onPress: () => search.onChange('') }} />
        : emptyRole ? <StateView compact art="agreements" title="Nema Dogovora u ovoj ulozi" primary={{ label: 'Prikažite sve uloge', onPress: clearRole }} />
        : (counts?.hasAny ?? items.length > 0) ? <StateView compact art="agreements"
          title={filtering ? 'Nijedan Dogovor ne čeka Vašu potvrdu' : section === 'active' ? 'Nema aktivnih Dogovora'
            : historyInActive && !narrowedEmpty ? 'Saradnje su uz aktivne zadatke' : historyEmptyTitle}
          body={historyInActive ? 'Završene i otkazane saradnje ostaju uz isti zadatak dok još ima obaveza. Pronađite ih u Dogovorima.' : undefined}
          primary={narrowedEmpty ? { label: 'Prikažite sve', onPress: () => setHistoryFilter('all') }
            : target === 'history' ? first : { label: 'Pogledajte Dogovore', onPress: showOther }} />
          : <StateView hero art="agreements" title={section === 'history' ? historyEmptyTitle : 'Još nemate Dogovora'}
            body={section === 'history' ? 'Ovde će biti završeni i otkazani Dogovori.' : 'Dogovor nastaje kada izaberete prijavu ili druga strana prihvati Vašu prijavu.'}
            primary={first} quiet={second} />}
  </View>;
  // Keep controls backed by a settled read. An initial read or a failed read must not offer filters over stale rows.
  const chips = section === 'active' ? stale && confirmationOnly ? <Press accessibilityRole="button" accessibilityLabel="Prikažite sve aktivne"
    onPress={() => props.onConfirmationOnly(false)} haptic="select" style={s.chip}>
    <T variant="meta" style={s.chipText}>Prikažite sve aktivne</T>
  </Press> : (freshRead && (waiting || confirmationOnly) ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka Vas"
    accessibilityState={{ checked: confirmationOnly }} onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select"
    style={[s.chip, confirmationOnly && s.chipOn]}>
    {confirmationOnly ? <Glyph name="check" size={16} tone="green" /> : null}
    <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka Vas</T>
  </Press> : null) : settledRead && historyCount ? <View accessibilityRole="radiogroup" accessibilityLabel="Ishod Dogovora" style={s.outcomeRow}>
    {HISTORY_FILTERS.map(option => {
      const on = historyFilter === option.key;
      return <Press key={option.key} accessibilityRole="radio" accessibilityLabel={option.key === 'all' ? 'Svi ishodi' : option.label}
        accessibilityState={{ checked: on }} onPress={() => setHistoryFilter(option.key)} haptic="select"
        style={[s.outcomeChoice, on && s.outcomeChoiceOn]}>
        <T variant="meta" style={[s.outcomeText, on && s.outcomeTextOn]}>{option.label}</T>
      </Press>;
    })}
  </View> : null;
  const searchControl = search.open || search.query || settledRead && items.length > 0
    ? <ChromeIconButton glyph="search" label={search.open ? 'Zatvorite pretragu Dogovora' : 'Pretražite Dogovore'} active={search.open}
      onPress={() => { if (search.open) Keyboard.dismiss(); search.onToggle(); }} /> : null;
  // Owner's Dogovori screen (22.11.2026): back, a search by task name, a filter button; below, quick capsules as on the map.
  const capsules: QuickChip[] = [
    { key: 'active', label: 'Aktivni', selected: section === 'active' && roleFilter === 'all' && !filtering,
      onPress: () => { props.onSection('active'); setRoleFilter('all'); props.onConfirmationOnly(false); } },
    { key: 'mine', label: 'Moji zadaci', selected: section === 'active' && roleFilter === 'narucilac',
      onPress: () => { props.onSection('active'); setRoleFilter(roleFilter === 'narucilac' ? 'all' : 'narucilac'); props.onConfirmationOnly(false); } },
    { key: 'worker', label: 'Uskačem', selected: section === 'active' && roleFilter === 'uskocer',
      onPress: () => { props.onSection('active'); setRoleFilter(roleFilter === 'uskocer' ? 'all' : 'uskocer'); props.onConfirmationOnly(false); } },
    { key: 'waiting', label: 'Čeka Vas', selected: section === 'active' && confirmationOnly,
      onPress: () => { props.onSection('active'); props.onConfirmationOnly(!(section === 'active' && confirmationOnly)); } },
    { key: 'history', label: 'Završeni', selected: section === 'history',
      onPress: () => { props.onSection(section === 'history' ? 'active' : 'history'); props.onConfirmationOnly(false); } },
  ];
  const dateLabel = dateRange ? `${dayLabel(dateRange.from)} – ${dayLabel(dateRange.to ?? dateRange.from)}` : null;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.topBar}>
      <ChromeIconButton glyph="back" label={section === 'history' ? 'Nazad na aktivne Dogovore' : 'Nazad na Početnu'}
        onPress={() => { if (section === 'history') { props.onSection('active'); return; } props.onHome?.(); }} />
      <View style={s.searchGrow}>
        <SearchField testID="agreement-search-input" label="Pretraga Dogovora po nazivu zadatka" placeholder="Naziv zadatka" clearLabel="Obrišite pretragu"
          value={search.query} onChangeText={value => { if (!search.open) search.onToggle(); search.onChange(value); }}
          maxLength={AGREEMENT_SEARCH_MAX_LENGTH} returnKeyType="search" onSubmit={() => Keyboard.dismiss()} />
      </View>
      <ChromeIconButton glyph="filters" label={dateLabel ? `Filteri, datum ${dateLabel}` : 'Filteri'} active={!!dateRange} onPress={() => setFiltersOpen(true)} />
    </View>
    <DiscoveryChipRow chips={capsules} testID="agreement-capsules" />
    {dateLabel ? <View style={s.activeFilter}>
      <T variant="meta" tone="muted">Datum: {dateLabel}</T>
      <Press accessibilityRole="button" accessibilityLabel="Uklonite filter datuma" onPress={() => setDateRange(null)} haptic="select" style={s.clearFilter}>
        <Glyph name="close" size={16} tone="muted" />
      </Press>
    </View> : null}
    {query && props.refreshing && !loading && !error ? <T variant="note" tone="muted" style={s.searchNote} accessibilityLiveRegion="polite">Osvežavamo rezultate. Pretraga trenutno obuhvata poslednje učitane podatke.</T> : null}
    {filtersOpen ? <Modal visible transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zatvorite filtere" style={s.scrim} onPress={() => setFiltersOpen(false)} />
      <View style={s.sheet}>
        <T variant="title" accessibilityRole="header">Filteri</T>
        <T variant="note" tone="muted">Izaberite datum od – do. Prikazuju se Dogovori sa terminom u tom periodu.</T>
        <DateRangeGrid today={todayDay} now={new Date(now)} from={pendingRange?.from ?? null} to={pendingRange?.to ?? null}
          onDay={day => setPendingRange(current => !current || current.to || day < current.from ? { from: day, to: null } : { from: current.from, to: day })} />
        <View style={s.sheetActions}>
          <V2Action tone="neutral" kind="quiet" label="Poništite" onPress={() => { setPendingRange(null); setDateRange(null); setFiltersOpen(false); }} />
          <V2Action tone="neutral" label="Primenite" disabled={!pendingRange} onPress={() => { setDateRange(pendingRange); setFiltersOpen(false); }} />
        </View>
        {props.onCalendar ? <Press accessibilityRole="button" accessibilityLabel="Otvorite Raspored" onPress={() => { setFiltersOpen(false); props.onCalendar?.(); }}
          haptic="select" style={s.calendarLink}><Glyph name="calendar" size={20} tone="green" /><T variant="note" tone="green">Otvorite Raspored</T></Press> : null}
      </View>
    </Modal> : null}
    {props.refreshError && !loading && !error ? <View style={s.refreshNotice} accessibilityLiveRegion="polite">
      <Surface kind="note" tone="warn">
        <T variant="note">Nismo uspeli da osvežimo Dogovore. Prikazano je poslednje učitano stanje.</T>
        <Press accessibilityRole="button" accessibilityLabel="Ponovo osvežite Dogovore"
          onPress={props.onRefresh} haptic="select" style={s.refreshAction}>
          <Glyph name="refresh" size={20} tone="green" />
          <T variant="note" tone="green">Pokušajte ponovo</T>
        </Press>
      </Surface>
    </View> : null}
    <FlatList<ListRow> key={`${section}:${query}`} data={loading || error ? [] : rows} keyExtractor={keyOf} refreshing={pull.refreshing}
      ListHeaderComponent={section === 'active' && settledRead && !search.open ? <HowItWorks topic="agreements" /> : null}
      contentOffset={{ x: 0, y: query ? searchOffsets.current[section].offset : scrollOffsets.current[section] }}
      onScroll={event => { const y = Math.max(0, event.nativeEvent.contentOffset.y);
        if (query) searchOffsets.current[section].offset = y; else scrollOffsets.current[section] = y; }} scrollEventThrottle={32}
      onRefresh={pull.onRefresh} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      onEndReached={() => { if (freshRead && !props.refreshing && props.pagination?.hasMore && !props.pagination.loadingMore && !props.pagination.moreError) props.pagination.onMore(); }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={settledRead ? <View>
        {props.pagination?.hasMore ? <View style={s.more}>
          {props.pagination.moreError ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Nismo učitali naredne saradnje. Prethodno učitane su sačuvane.</T> : null}
          {counts ? <T variant="meta" tone="muted">Prikazano {props.pagination.loadedGroups} od {counts.matching} zadataka.</T> : null}
          <Press accessibilityRole="button" accessibilityLabel={props.pagination.moreError ? 'Pokušajte ponovo da učitate saradnje' : 'Učitajte još saradnji'}
            accessibilityState={{ disabled: !!props.pagination.loadingMore || !!props.refreshing || stale, busy: props.pagination.loadingMore }}
            disabled={!!props.pagination.loadingMore || !!props.refreshing || stale} onPress={props.pagination.onMore} style={s.moreAction}>
            <T variant="note" tone="green">{props.pagination.loadingMore ? 'Učitavamo još saradnji…' : props.pagination.moreError ? 'Pokušajte ponovo' : 'Učitajte još saradnji'}</T>
          </Press>
        </View> : null}
        {section === 'active' && items.length === 0 ? <Press accessibilityRole="button" accessibilityLabel="Prethodne saradnje"
          onPress={() => { props.onSection('history'); props.onConfirmationOnly(false); }} style={s.historyLink}>
          <T variant="body" style={s.attentionText}>Prethodne saradnje</T><Glyph name="caret-right" size={20} />
        </Press> : null}
      </View> : null}
      // Six of these cards are more than one phone screen; a modest window fills a fast scroll quickly.
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
      ItemSeparatorComponent={Separator} renderItem={renderItem} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // Local rhythm keeps all controls visible while bringing the first task closer; touch targets retain their full height.
  search: { gap: sys.space.sm, paddingVertical: sys.space.sm },
  sectionTabs: { paddingBottom: sys.space.xs },
  controls: { paddingHorizontal: layout.gutter, paddingTop: sys.space.xs },
  refreshNotice: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  refreshAction: { minHeight: layout.touch, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  historyLink: { minHeight: layout.touch, marginTop: layout.group, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  more: { paddingTop: layout.group, gap: sys.space.sm },
  moreAction: { minHeight: layout.touch, justifyContent: 'center', alignItems: 'center' },
  // Keep the label beside the first line when large text wraps the outcome choices on a narrow screen.
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm, minHeight: layout.touch, paddingTop: sys.space.xs },
  filterNameSlot: { minHeight: layout.touch, justifyContent: 'center', flexShrink: 0 },
  filterName: { fontWeight: '600' },
  outcomeRow: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.xs },
  outcomeChoice: { minHeight: layout.touch, paddingHorizontal: sys.space.xs, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  outcomeChoiceOn: { borderBottomColor: sys.color.green },
  outcomeText: { color: sys.color.muted, fontWeight: '600' },
  outcomeTextOn: { color: sys.color.green },
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.surface },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  attentionLink: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  attentionText: { flex: 1, color: sys.color.ink, fontWeight: '600' },
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, flexGrow: 1 },
  empty: { flex: 1 },
  separator: { height: layout.group },
  headingSeparator: { height: sys.space.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingHorizontal: sys.space.sm, paddingTop: sys.space.xs },
  searchGrow: { flex: 1, minWidth: 0 },
  activeFilter: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingHorizontal: layout.gutter },
  clearFilter: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchNote: { paddingHorizontal: layout.gutter },
  scrim: { flex: 1, backgroundColor: 'rgba(10, 31, 20, 0.32)' },
  sheet: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    padding: layout.gutter, gap: sys.space.md, paddingBottom: sys.space.xl * 2 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: sys.space.sm },
  calendarLink: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 44 },
});
