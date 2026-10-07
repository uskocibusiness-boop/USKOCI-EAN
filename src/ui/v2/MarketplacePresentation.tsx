import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MagnifyingGlass, SlidersHorizontal, X } from 'phosphor-react-native';
import type { MarketplaceItem, MarketplaceView, OwnedTaskCounts } from '../../data/marketplaceView';
import { initialMarketplaceView, isOwnedNeed, marketplaceItems, ownedTaskCounts } from '../../data/marketplaceView';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { useReducedMotion } from '../system/motion';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { zadataka } from '../system/plural';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { useWindowRoom } from '../system/textScale';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { withInter } from '../interFont';
import { OwnTaskCard } from './OwnTaskCard';
import { SCREEN_SIDE, TAB_GAP, ownTaskTabs } from './ownTaskTabs';
import { V2Action } from './V2Action';

/**
 * EX-04 S1: what a paged read of my own tasks says besides the tasks. Absent, the list is the whole list and counts itself; present, the tasks are the
 * ones loaded so far, the counts are the server's, and the foot offers the next page.
 */
export type MarketplacePaging = { counts: OwnedTaskCounts | null; hasMore: boolean; loadingMore: boolean; moreError: boolean; onLoadMore: () => void };

export type MarketplacePresentationProps = { items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  /** A route-owned root header. Pushed screens still keep their existing Back header. */
  header?: ReactNode;
  /** Paged builds only (the ex04a package). */
  paging?: MarketplacePaging;
  view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onProfile: () => void; onNew?: () => void;
  /** The card's foot opens the applications that wait for my choice. */
  onApplications?: (item: MarketplaceItem) => void;
  /** Set when the screen was pushed rather than being a tab: my own tasks are reached from Početna. */
  onBack?: () => void };

const PRICES = [['all', 'Svi načini'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']] as const;
const Separator = () => <View style={{ height: 12 }} />;
/** How many tasks the set the person is looking at holds, by the server's counts. */
function setCount(counts: OwnedTaskCounts, view: MarketplaceView): number {
  if (view.attention) return view.section === 'drafts' || view.section === 'history' ? 0 : counts.waiting;
  return view.section === 'active' ? counts.active : view.section === 'drafts' ? counts.drafts : view.section === 'history' ? counts.history : counts.total;
}
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input that could lose focus. */
const CLIP_OFFSCREEN = Platform.OS === 'android';

/**
 * One row of the list. Memoised on primitives and the row's own object, so a keystroke in the
 * search field or an open filter sheet re-renders the screen and not every card under it; the
 * `onOpen` it receives is the list's one stable function, and the closure over `item` is made here.
 */
const MarketplaceRow = memo(function MarketplaceRow({ item, index, animate, onOpen, onApplications }: {
  item: MarketplaceItem; index: number; animate: boolean; onOpen: (item: MarketplaceItem) => void;
  onApplications?: (item: MarketplaceItem) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  const applications = useMemo(() => onApplications ? () => onApplications(item) : undefined, [onApplications, item]);
  // This list is made of my own tasks only (`marketplaceItems(…, owned = true)`); a task of someone else has no row here.
  return isOwnedNeed(item) ? <Appear index={index} animate={animate}><OwnTaskCard item={item} onOpen={open} onApplications={applications} /></Appear> : null;
});

/**
 * Moji zadaci: the requester's own Tasks in three sets (Aktivni · Nacrti · Istorija), one capsule segmented control that
 * has its whole row, a toolbar under it (how many tasks the set shows, search, filters), then the cards. Other people's tasks
 * are the Zadaci tab (`DiscoveryPresentation`, the map under a list sheet, owner step 4, 2026-09-24); the discovery list and
 * map that used to share this file are gone with it. My own tasks carry no creation action over their cards (Početna has
 * "Objavi zadatak"); an empty list still offers it inline. Presentation only: every callback is the route's existing command.
 *
 * The tabs do not share their row (UI/UX pass, plan item 8.1, 2026-10-02). On the owner's 361 dp phone the two round buttons
 * beside them left the tabs 209 dp of 321, the row scrolled and the third tab read "Istorij". The row is now the tabs' alone,
 * spread over the width; what stands on them, and whether it fits, is `ownTaskTabs`. A text size beyond what fits scrolls the
 * row (the scroller stretches to the width, so it scrolls only when it has to) instead of cutting a label.
 */
export function MarketplacePresentation(props: MarketplacePresentationProps) {
  const { items, loading, error, view, onOpen } = props, reduced = useReducedMotion();
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest
  // read). The rows get one function that never changes and calls whatever is current at press time.
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const openItem = useCallback((item: MarketplaceItem) => openRef.current(item), []);
  // The same for the card's foot, which opens the applications that wait for my choice.
  const applicationsRef = useRef(props.onApplications); applicationsRef.current = props.onApplications;
  const hasApplications = !!props.onApplications;
  const openApplications = useCallback((item: MarketplaceItem) => applicationsRef.current?.(item), []);
  const [filterOpen, setFilterOpen] = useState(false), [priceDraft, setPriceDraft] = useState(view.price);
  const [attentionDraft, setAttentionDraft] = useState(view.attention);
  const [searchOpen, setSearchOpen] = useState(!!view.query);
  const listRef = useRef<FlatList<MarketplaceItem>>(null);
  const criteria = JSON.stringify([view.section, view.query, view.price, view.attention]);
  const previousCriteria = useRef(criteria);
  useEffect(() => {
    // FlatList retains its native offset when rows change. A new set starts at the top; a reread or return to the
    // same set keeps the reading position, including while an unapplied filter draft is opened or cancelled.
    if (previousCriteria.current !== criteria) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    previousCriteria.current = criteria;
  }, [criteria]);
  const visible = useMemo(() => marketplaceItems(items, view, true), [items, view]);
  // The sheet promises what the list will show: the same search and section as Apply.
  const draftCount = useMemo(() => loading || error ? null
    : marketplaceItems(items, { ...view, price: priceDraft, attention: attentionDraft }, true).length,
  [items, view, priceDraft, attentionDraft, loading, error]);
  // The numbers on the tabs: how many active tasks wait for my choice (the badge on "Aktivni"; Početna does not repeat it, there
  // what waits is said once, under "Čeka te", from the server's own attention list) and how many tasks the other two sets hold.
  // Paged: the server's own counts, never the number that happens to be loaded (unknown until it answered); otherwise the counts
  // of the whole list this build holds, and none while that is read or failed to read, so no stale number stands over an error.
  const paged = !!props.paging, pagedCounts = props.paging?.counts ?? null;
  const counts = useMemo<OwnedTaskCounts | null>(() => paged ? pagedCounts : loading || error ? null : ownedTaskCounts(items),
    [items, paged, pagedCounts, loading, error]);
  // Whether the counts fit beside the labels is decided from the room the row has (`ownTaskTabs`); a label is never cut for one.
  const room = useWindowRoom();
  const sections = useMemo(() => ownTaskTabs(counts, room), [counts, room]);
  // What the person chose to narrow the list with. A tab is not a refinement: an empty Nacrti or Istorija says what that tab is, and has
  // nothing to "clear" (plan 2.2).
  const hasFilter = !!view.query || view.price !== 'all' || view.attention;
  const filterActive = view.price !== 'all' || view.attention;
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const toggleSearch = () => { Keyboard.dismiss(); if (searchOpen && view.query) change({ query: '', selectedId: null }); setSearchOpen(open => !open); };
  const openFilters = () => { Keyboard.dismiss(); setPriceDraft(view.price); setAttentionDraft(view.attention); setFilterOpen(true); };
  // No eyebrow above the title (owner, 2026-09-23): "Moje aktivnosti" over "Moji zadaci" only said where you are, and that
  // destination is retired. For the same reason the count line does not name the set a tab already names ("2 zadatka · nacrti"
  // under the tab "Nacrti" said it twice, and wrapped in the toolbar's narrower room); only the view that has no tab, all of
  // my tasks (reached from an empty state), says which set it is.
  const countNote = view.section === 'all' ? ' · svi zadaci' : '';
  // Paged: an exact number only when it is the server's count of an unrefined set, or the refined set was read to its end; otherwise none (never a partial number).
  const refined = !!view.query.trim() || view.price !== 'all', paging = props.paging;
  const count = loading || error ? null : !paging ? visible.length
    : refined ? (paging.hasMore || paging.loadingMore ? null : visible.length)
      : paging.counts ? setCount(paging.counts, view) : paging.hasMore ? null : visible.length;
  // A refinement of a set that is still being read has no answer yet, so it says it is reading instead of saying there is nothing.
  const reading = loading || (!!paging && visible.length === 0 && !paging.moreError && (paging.hasMore || paging.loadingMore));
  const filterLabel = filterActive ? 'Filteri, aktivni' : 'Filteri';
  // A task that arrives while you are looking says so; the ones that were already there do not
  // replay every time the list is pulled. `Appear` holds that distinction.
  const appear = useAppear();
  appear.settle(visible.map(keyOf), criteria);
  // `useAppear` returns a new object each render over the same two refs; read it through a ref so
  // `renderItem` keeps its identity and the list does not re-render every cell on every render.
  const appearRef = useRef(appear); appearRef.current = appear;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <MarketplaceRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} onOpen={openItem}
      onApplications={hasApplications ? openApplications : undefined} />, [openItem, hasApplications, openApplications]);

  // The one state view (2026-09-24): reading, not read, nothing in this view, nothing yet — each in the same look.
  const empty = <View style={s.empty}>
    {reading ? <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />
      : error ? <StateView kind="error" art="tasks" title="Zadatke trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : hasFilter ? <StateView art="map" title="Nema zadataka u ovom prikazu" body="Promeni pretragu ili poništi filtere."
          primary={{ label: 'Obriši uslove', onPress: () => props.onView(initialMarketplaceView()) }} />
          : view.section === 'drafts' ? <StateView art="tasks" title="Nemaš nacrt" body="Nacrt pregledaš pre objave." />
          : view.section === 'history' ? <StateView art="tasks" title="Istorija je prazna" body="Ovde su završeni, otkazani i istekli zadaci." />
          : <StateView art="tasks" title={items.length ? 'Nema aktivnih zadataka' : 'Još nemaš zadatak'}
            body={items.length ? 'Nacrti i završeni zadaci su u svojim prikazima.' : 'Reci šta ti treba. Nacrt pregledaš pre objave.'}
            primary={props.onNew ? { label: items.length ? 'Napravi novi zadatak' : 'Napravi prvi zadatak', onPress: props.onNew } : undefined}
            quiet={items.length ? { label: 'Prikaži sve moje zadatke', onPress: () => change({ section: 'all' }) } : undefined} />}
  </View>;

  return <SafeAreaView edges={props.onBack ? ['top', 'bottom'] : ['top']} style={s.screen}>
    <View aria-hidden={filterOpen} accessibilityElementsHidden={filterOpen} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      {props.onBack ? <ProductHeader title="Moji zadaci" back={props.onBack} />
        : props.header ?? <ScreenHeader title="Moji zadaci" onProfile={props.onProfile} />}
      {/* The tabs have the whole row to themselves, spread over it (plan item 8.1: beside two 48 dp buttons they had 209 dp of 321
          and the third read "Istorij"). The scroller is the resilience fallback for a text size beyond what fits: it stretches to
          the row, so it scrolls only when it has to, and a label is never cut. */}
      <View testID="own-tasks-tabs" style={s.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.tabsContent}>
          <Segmented appearance="pill" contentSized options={sections} value={view.section} onChange={section => change({ section, selectedId: null })} style={s.tabTrack} />
        </ScrollView>
      </View>
      {/* Under them: how many tasks the set shows, which used to scroll away as the list's header, and the two controls. Filters
          say their word (a bare sliders icon says nothing); search keeps the magnifier everyone knows. */}
      <View testID="own-tasks-toolbar" style={s.toolbar}>
        <View style={s.toolbarCount}>
          {count ? <T testID="own-tasks-count" variant="note" tone="muted">{zadataka(count)}{countNote}</T> : null}
        </View>
        <HeaderIconButton label="Pretraga" hint="Otvara polje za pretragu zadataka." icon={MagnifyingGlass} active={searchOpen} onPress={toggleSearch} />
        <HeaderIconButton label={filterLabel} icon={SlidersHorizontal} active={filterActive} caption="Filteri" onPress={openFilters} />
      </View>
      {searchOpen ? <View style={s.search}>
        <MagnifyingGlass size={21} color={sys.color.green} />
        <TextInput accessibilityLabel="Pretraži zadatke" autoFocus placeholder="Pretraži zadatke" placeholderTextColor={sys.color.muted}
          value={view.query} onChangeText={query => change({ query: query.slice(0, 1000), selectedId: null })} maxLength={1000} style={s.input}
          returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
        {view.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" onPress={() => change({ query: '', selectedId: null })} haptic="select" style={s.clear}>
          <X size={18} weight="bold" color={sys.color.ink} /></Press> : null}
      </View> : null}
      <FlatList<MarketplaceItem> ref={listRef} data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={props.refreshing ?? loading} onRefresh={props.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        // Six cards are more than one phone screen of this card; the window stays modest so a fast
        // scroll fills in quickly without holding the whole list mounted.
        initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
        ItemSeparatorComponent={Separator} ListEmptyComponent={empty} renderItem={renderItem}
        onEndReached={paging && paging.hasMore && !paging.loadingMore && !paging.moreError ? paging.onLoadMore : undefined} onEndReachedThreshold={0.6}
        ListFooterComponent={paging && visible.length > 0 && (paging.hasMore || paging.loadingMore || paging.moreError) ? <View style={s.foot}>
          {paging.moreError ? <>
            <T variant="note" tone="muted">Nije uspelo učitavanje još zadataka.</T>
            <V2Action label="Pokušaj ponovo" kind="quiet" onPress={paging.onLoadMore} />
          </> : paging.loadingMore ? <T variant="note" tone="muted">Učitavamo još zadataka…</T>
            : <V2Action label="Prikaži još" kind="quiet" onPress={paging.onLoadMore} />}
        </View> : null} />
      {/* No floating "+" over my own tasks (owner's information architecture, 2026-09-23): it sat on the cards and
          covered a price, and creating a task lives on Početna's "Objavi zadatak". An empty list still offers it inline. */}
    </View>
    {filterOpen ? <ProductSheet title="Filteri" closeLabel="Zatvori filtere" reduced={reduced} onClose={() => setFilterOpen(false)}>{dismiss => <>
        <T variant="label" style={s.groupLabel}>Način cene</T>
        <View accessibilityRole="radiogroup" style={s.options}>
          {PRICES.map(([value, label]) => <Press key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: priceDraft === value }} aria-checked={priceDraft === value}
            haptic="select" onPress={() => setPriceDraft(value)} style={[s.option, priceDraft === value && s.optionChecked]}>
            <View style={[s.radio, priceDraft === value && s.radioChecked]}>{priceDraft === value ? <View style={s.radioDot} /> : null}</View>
            <T variant={priceDraft === value ? 'bodyStrong' : 'body'} style={s.optionText}>{label}</T>
          </Press>)}
        </View>
        <Press accessibilityRole="checkbox" accessibilityLabel="Treba moja radnja" accessibilityState={{ checked: attentionDraft }} aria-checked={attentionDraft} haptic="select"
          onPress={() => setAttentionDraft(value => !value)} style={[s.option, attentionDraft && s.optionChecked]}>
          <View style={[s.check, attentionDraft && s.checked]}>{attentionDraft ? <Check size={14} weight="bold" color={sys.color.surface} /> : null}</View>
          <View style={s.grow}><T variant="bodyStrong" style={s.optionText}>Treba moja radnja</T><T variant="note" tone="muted">Zadaci sa prijavama koje možeš da izabereš.</T></View>
        </Press>
        <V2Action label={draftCount === null || paging?.hasMore ? 'Prikaži zadatke' : `Prikaži ${zadataka(draftCount)}`} disabled={draftCount === null}
          onPress={() => { change({ price: priceDraft, attention: attentionDraft, selectedId: null }); dismiss(); }} style={brandAction} />
        <View style={s.sheetRow}>
          <V2Action label="Poništi izbor" kind="quiet" onPress={() => { setPriceDraft('all'); setAttentionDraft(false); }} />
          <V2Action label="Odustani od filtera" kind="quiet" onPress={dismiss} />
        </View>
      </>}</ProductSheet> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  // The tab row: the screen's 20 dp each side, and nothing but the tabs in it. The scroller stretches to the row (`flexGrow`) and
  // the track spreads the three tabs over it (`space-between`, never closer than `TAB_GAP`), so nothing scrolls until a text size
  // leaves no room; `ownTaskTabs` measures what fits, from these same numbers.
  tabs: { paddingHorizontal: SCREEN_SIDE, paddingTop: 6 },
  tabsContent: { flexGrow: 1 },
  tabTrack: { flexGrow: 1, justifyContent: 'space-between', gap: TAB_GAP },
  // The toolbar: the count says how many tasks the set shows (it may take a second line at a large text size, never an ellipsis);
  // the two controls keep their 48 dp touch area and end the row. 4 dp above them and the list's own 4 below, each beside the 2 dp
  // the 44 dp circle leaves inside its 48 dp area, so the row costs 52 dp and carries the count line that used to cost the list a row of its own.
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: SCREEN_SIDE, paddingTop: 4 },
  toolbarCount: { flex: 1, minWidth: 0 },
  foot: { paddingTop: 16, alignItems: 'center', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginBottom: 8, paddingLeft: 14, paddingRight: 6, backgroundColor: sys.color.wash,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: 10 }),
  clear: { width: 44, height: 44, borderRadius: sys.radius.chip, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, flex: 1 },
  groupLabel: { color: sys.color.muted, marginTop: 4 },
  options: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  optionChecked: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft }, optionText: { color: sys.color.ink, flex: 1 },
  radio: { width: 22, height: 22, borderRadius: sys.radius.pill, borderWidth: 1.5, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  radioChecked: { borderColor: sys.color.green }, radioDot: { width: 11, height: 11, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  // A checkbox is a square box: the row corner (12) on a 22 box drew a circle, which reads as a radio.
  check: { width: 22, height: 22, borderRadius: sys.radius.check, borderWidth: 1.5, borderColor: sys.color.green, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  checked: { backgroundColor: sys.color.green },
  sheetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
