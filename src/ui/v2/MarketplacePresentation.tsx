import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Platform, StyleSheet, TextInput, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MarketplaceItem, MarketplaceView, OwnedTaskCounts } from '../../data/marketplaceView';
import { initialMarketplaceView, isOwnedNeed, marketplaceItems, ownedTaskCounts } from '../../data/marketplaceView';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { useReducedMotion } from '../system/motion';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { zadataka } from '../system/plural';
import { Section } from '../system/Section';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { brandAction, fieldBox, sys } from '../system/tokens';
import { T } from '../Text';
import { withInter } from '../interFont';
import { ChoiceRow } from './offer/ChoiceRow';
import { OwnTaskCard } from './OwnTaskCard';
import { ownTaskTabs } from './ownTaskTabs';
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
const Separator = () => <View style={s.separator} />;
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
 * Moji zadaci: the person's own tasks in three sets (Aktivni · Nacrti · Istorija). UI/UX pass 2026-10-08 (composition spec 4.5): the
 * screen used to spend 172 dp on a bar, a row of tabs and a toolbar before the first card, and the cards were 304 dp each, so one fitted
 * under the other two; now it is a bar (the arrow, the name and ONE control, "Filteri"), ONE control row (the three tabs, equal
 * widths, a number only on what waits for the choice), the count of what the set shows as the first line of the list ("7 zadataka"),
 * and `Surface record` cards of about 200 dp, 12 apart, three to a screen.
 *
 * Search is one of the filters: the one "Filteri" control opens the sheet with the search field, the way of pricing and "Čeka tvoj
 * izbor", and applies them together (the sheet promises how many tasks the list will show, by the same rule Apply uses). Other
 * people's tasks are the Zadaci tab (`DiscoveryPresentation`, the map under a list sheet, owner step 4, 2026-09-24); the discovery list
 * and map that used to share this file are gone with it. My own tasks carry no creation action over their cards (Početna has "Objavi
 * zadatak"); an empty list still offers it inline. Presentation only: every callback is the route's existing command.
 *
 * No eyebrow above the title (owner, 2026-09-23): "Moje aktivnosti" over "Moji zadaci" only said where you are, and that destination is
 * retired. For the same reason the count line does not name the set a tab already names ("2 zadatka · nacrti" under the tab "Nacrti"
 * said it twice); only the view that has no tab, all of my tasks (reached from an empty state), says which set it is.
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
  const [attentionDraft, setAttentionDraft] = useState(view.attention), [queryDraft, setQueryDraft] = useState(view.query);
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
  // The sheet promises what the list will show: the same search, section, price and attention as Apply.
  const draftCount = useMemo(() => loading || error ? null
    : marketplaceItems(items, { ...view, query: queryDraft, price: priceDraft, attention: attentionDraft }, true).length,
  [items, view, queryDraft, priceDraft, attentionDraft, loading, error]);
  // The number on "Aktivni": how many active tasks wait for my choice (Početna does not repeat it, there what waits is said once, under
  // "Čeka te", from the server's own attention list). Paged: the server's own counts, never the number that happens to be loaded
  // (unknown until it answered); otherwise the counts of the whole list this build holds, and none while that is read or failed to
  // read, so no stale number stands over an error. The counts of the other two sets are spoken, never drawn (`ownTaskTabs`).
  const paged = !!props.paging, pagedCounts = props.paging?.counts ?? null;
  const counts = useMemo<OwnedTaskCounts | null>(() => paged ? pagedCounts : loading || error ? null : ownedTaskCounts(items),
    [items, paged, pagedCounts, loading, error]);
  const sections = useMemo(() => ownTaskTabs(counts), [counts]);
  // What the person chose to narrow the list with. A tab is not a refinement: an empty Nacrti or Istorija says what that tab is, and has
  // nothing to "clear" (plan 2.2). Search is one of the filters now, so it counts as one.
  const filterActive = !!view.query || view.price !== 'all' || view.attention;
  const hasFilter = filterActive;
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const openFilters = () => { Keyboard.dismiss(); setQueryDraft(view.query); setPriceDraft(view.price); setAttentionDraft(view.attention); setFilterOpen(true); };
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
    {reading ? <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'plain' }} />
      : error ? <StateView kind="error" art="tasks" title="Ne možemo da učitamo zadatke" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : hasFilter ? <StateView art="map" title="Nema zadataka u ovom prikazu" body="Promeni pretragu ili filtere."
          primary={{ label: 'Poništi filtere', onPress: () => props.onView(initialMarketplaceView()) }} />
          : view.section === 'drafts' ? <StateView art="tasks" title="Nemaš nacrt" body="Nacrt pregledaš pre objave." />
          : view.section === 'history' ? <StateView art="tasks" title="Istorija je prazna" body="Ovde su završeni, otkazani i istekli zadaci." />
          : <StateView art="tasks" title={items.length ? 'Nema aktivnih zadataka' : 'Još nemaš zadatak'}
            body={items.length ? 'Nacrti i završeni zadaci su pod Nacrti i Istorija.' : 'Reci šta ti treba. Nacrt pregledaš pre objave.'}
            primary={props.onNew ? { label: items.length ? 'Objavi novi zadatak' : 'Objavi prvi zadatak', onPress: props.onNew } : undefined}
            quiet={items.length ? { label: 'Prikaži sve moje zadatke', onPress: () => change({ section: 'all' }) } : undefined} />}
  </View>;

  // The one control of the bar. A control nobody can guess from a drawing says its word beside it (the sliders icon alone says nothing).
  // A person who has no task, or whose tasks could not be read, has nothing to narrow down: the control is not drawn then (a filtered list
  // that came back empty keeps it, because it is how the filter is cleared).
  const canFilter = filterActive || (!loading && !error && items.length > 0);
  const control = canFilter ? <HeaderIconButton label={filterLabel} glyph="filters" active={filterActive} caption="Filteri" onPress={openFilters} /> : undefined;
  // A screen that was pushed has the arrow; a route that hands its own root header keeps it, and the control stands under it.
  const bar = props.onBack ? <ProductHeader title="Moji zadaci" back={props.onBack} right={control} />
    : props.header ? <>{props.header}{control ? <View style={s.controlRow}>{control}</View> : null}</>
      : <ScreenHeader title="Moji zadaci" onProfile={props.onProfile} right={control} />;

  return <SafeAreaView edges={props.onBack ? ['top', 'bottom'] : ['top']} style={s.screen}>
    <View aria-hidden={filterOpen} accessibilityElementsHidden={filterOpen} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      {bar}
      {/* ONE control row under the bar: the three sets, equal widths, nothing beside them. A number is drawn only on "Aktivni", and
          only for the tasks that wait for my choice. */}
      <View testID="own-tasks-tabs" style={s.tabs}>
        <Segmented options={sections} value={view.section} onChange={section => change({ section, selectedId: null })} />
      </View>
      <FlatList<MarketplaceItem> ref={listRef} data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={props.refreshing ?? loading} onRefresh={props.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        // Six cards are more than one phone screen of this card; the window stays modest so a fast
        // scroll fills in quickly without holding the whole list mounted.
        initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
        ItemSeparatorComponent={Separator} ListEmptyComponent={empty} renderItem={renderItem}
        // How many tasks the set shows is the list's first line: it scrolls away with the list instead of taking a row of its own.
        ListHeaderComponent={count ? <T testID="own-tasks-count" variant="note" tone="muted" style={s.count}>{zadataka(count)}{countNote}</T> : null}
        onEndReached={paging && paging.hasMore && !paging.loadingMore && !paging.moreError ? paging.onLoadMore : undefined} onEndReachedThreshold={0.6}
        ListFooterComponent={paging && visible.length > 0 && (paging.hasMore || paging.loadingMore || paging.moreError) ? <View style={s.foot}>
          {paging.moreError ? <>
            <T variant="note" tone="muted">Ne možemo da učitamo ostale zadatke.</T>
            <V2Action label="Pokušaj ponovo" kind="quiet" onPress={paging.onLoadMore} />
          </> : paging.loadingMore ? <T variant="note" tone="muted">Učitavamo još zadataka…</T>
            : <V2Action label="Prikaži još" kind="quiet" onPress={paging.onLoadMore} />}
        </View> : null} />
      {/* No floating "+" over my own tasks (owner's information architecture, 2026-09-23): it sat on the cards and
          covered a price, and creating a task lives on Početna's "Objavi zadatak". An empty list still offers it inline. */}
    </View>
    {filterOpen ? <ProductSheet title="Filteri" closeLabel="Zatvori filtere" reduced={reduced} onClose={() => setFilterOpen(false)}
      footer={dismiss => <>
        <V2Action label={draftCount === null || paging?.hasMore ? 'Prikaži zadatke' : `Prikaži ${zadataka(draftCount)}`} disabled={draftCount === null}
          onPress={() => { change({ query: queryDraft, price: priceDraft, attention: attentionDraft, selectedId: null }); dismiss(); }} style={brandAction} />
        <V2Action label="Poništi izbor" kind="quiet" onPress={() => { setQueryDraft(''); setPriceDraft('all'); setAttentionDraft(false); }} />
      </>}>{() => <View style={s.sheetBody}>
        <Section title="Pretraga">
          <View style={s.search}>
            <Glyph name="search" size={20} tone="green" />
            <TextInput accessibilityLabel="Pretraži zadatke" placeholder="Pretraži zadatke" placeholderTextColor={sys.color.muted}
              value={queryDraft} onChangeText={query => setQueryDraft(query.slice(0, 1000))} maxLength={1000} style={s.input}
              returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
            {queryDraft ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" onPress={() => setQueryDraft('')} haptic="select" style={s.clear}>
              <Glyph name="close" size={20} /></Press> : null}
          </View>
        </Section>
        <Section title="Način cene">
          <View accessibilityRole="radiogroup" style={s.options}>
            {PRICES.map(([value, label]) => <ChoiceRow key={value} kind="radio" label={label} checked={priceDraft === value} onPress={() => setPriceDraft(value)} />)}
          </View>
        </Section>
        <ChoiceRow kind="checkbox" label="Čeka tvoj izbor" hint="Zadaci sa prijavama koje možeš da izabereš." checked={attentionDraft}
          onPress={() => setAttentionDraft(value => !value)} />
      </View>}</ProductSheet> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // The control row under the bar: the screen's edge each side, and 8 under the bar. Nothing but the three sets is in it.
  tabs: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  // A route that keeps its own root header gets the one control on a line of its own, at the end.
  controlRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: layout.gutter },
  // The list: the edge, 12 under the control row, 32 under the last card; a card from the next 12 below it.
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md, paddingBottom: layout.zone, flexGrow: 1 },
  separator: { height: layout.group },
  count: { paddingBottom: sys.space.sm },
  foot: { paddingTop: sys.space.base, alignItems: 'center', gap: sys.space.sm },
  empty: { paddingVertical: sys.space.sm, flex: 1 },
  // The sheet: the search field, the way of pricing, the checkbox; a section from the next 24 below it.
  sheetBody: { gap: layout.section },
  search: { ...fieldBox, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: 0, paddingRight: 0, backgroundColor: sys.color.wash },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: layout.touch, paddingVertical: sys.space.sm }),
  clear: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  options: { gap: sys.space.xs },
});
