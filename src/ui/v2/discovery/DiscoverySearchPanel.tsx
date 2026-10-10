import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { discoveryV1Opportunity } from '../../../data/discoveryV1MarketplaceAdapter';
import { Keyboard, Platform, ScrollView, StyleSheet, View, type TextInput, useWindowDimensions } from 'react-native';
import { atLeast, dateRange, discoveryItems, placeKey, placeSuggestions, remoteDiscoveryScope, saysWorkMode, serbianToday, undatedCount, workMode,
  type DateRange, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { DISCOVERY_V1_PLACES_BY_CITY, discoveryV1SearchPreviewKey, type DiscoveryV1SearchSnapshot, type SearchPreviewView } from '../../../data/discoveryV1SearchOwner';
import { Press } from '../../Press';
import { T } from '../../Text';
import { TurningCaret } from '../../system/Disclosure';
import { FlowFooter } from '../../system/FlowFooter';
import { Surface } from '../../system/Surface';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { layout } from '../../system/layout';
import { zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { brandAction, sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { DateRangeGrid } from './DateRangeGrid';
import { CLEAR, FILTER_GROUP, FILTER_WHEN, PRICE, SEARCH_WORDS, WHEN, WHERE, quoted, said, undatedWords, whenWords } from './discoveryWords';
import { PLACE_WORDS, PlacePicker } from './PlacePicker';
import type { PlaceRow } from './popularCities';
import type { RecentSearch } from './recentSearches';
import { searchBackdropKind, useReducedTransparency } from './SearchBackdrop';
import { Choice, GroupTitle, PlaceRow as Row, SearchField } from './SearchParts';
import { SearchSheet } from './SearchSheet';

/**
 * The panel is TWO things (the owner's phone of 8 Oct 2026: "filteri odvojeni od pretrage"; the approved plan, U4 and U5): the SEARCH, which is a word and a place
 * and fills the whole screen (a field for the words, the places with how many tasks each, and what was searched before), and the FILTERS, which are conditions
 * and rise as a sheet from the bottom (when, how the work is done, the amount). The pill opens the first, the round button beside it the second; `mode` says
 * which. Both are one draft over the whole view, so what the other leaves is kept as it is. In the search a choice of a place (or of a search made before) is
 * the end of it: it is applied and the screen is the list again, with what was found. In the filters the choices are a draft, and the one green action applies it
 * and says how many tasks the list will then show.
 */
export type PanelMode = 'search' | 'filters';

/** Everything the search panel chooses, as a draft: in the filters nothing reaches the list before "Prikaži N zadataka". */
export type SearchDraft = { query: string; place: string | null; area: PublicBounds | null;
  /** One public point the list is narrowed to (a place's "Prikaži sve u listi"); any other "Gde" choice replaces it. */
  pinPlace: string | null;
  when: WhenFilter; dates: DateRange | null; where: WhereFilter; places: number; price: MarketplaceView['price'] };
export const NO_SEARCH: SearchDraft = { query: '', place: null, area: null, pinPlace: null, when: 'any', dates: null, where: 'any', places: 1, price: 'all' };
export const draftOf = (view: MarketplaceView): SearchDraft => remoteDiscoveryScope({ query: view.query, place: view.place ?? null, area: view.area,
  pinPlace: view.pinPlace ?? null, when: view.when ?? 'any', dates: dateRange(view.dates), where: view.where ?? 'any', places: atLeast(view.places),
  price: view.price });
/**
 * What the panel can count by: the list and what is mine are known (`ready`); the list is still read (`loading`) or
 * could not be read (`error`), so there is nothing to count; or the list is known but not yet which of its tasks are mine
 * (`pending`), so a count could still drop a moment later and none is said.
 */
export type SearchReadiness = 'ready' | 'loading' | 'error' | 'pending';
/** What the server is asked about: the draft and, apart from it, the city whose parts are asked for (the letters of its name). */
export type SearchPreviewDraft = SearchDraft & { placeSearch?: string };
export type DiscoveryV1SearchPanelSeam = {
  snapshot: DiscoveryV1SearchSnapshot;
  onDraft: (draft: SearchPreviewDraft, mapArea: PublicBounds | null) => void;
  onNextPlaces: () => void;
};

/** "Gde" at its "everything": no place, no map area, no single point. The words searched are another choice and stay. */
const ANYWHERE = { place: null, area: null, pinPlace: null } as const satisfies Partial<SearchDraft>;

/**
 * The search over the Zadaci map (owner, 2026-10-07; the approved plan, U4): the whole screen, the field "Šta tražiš" at the top with the keyboard up, and
 * under it "Gde": every task, the work done remotely, the cities the tasks are in with their counts (the server's city list; the places the tasks name when it is not
 * there) and the biggest cities of Serbia (see `PlacePicker`), then what was searched before. A place chosen from the rows applies at once together with the words
 * typed; the keyboard's search key and the green action apply the words (and the place chosen before). Nothing here filters: the conditions are the filters' own.
 *
 * The filters (U5) are a sheet: "Kada" (the days, or a range of them), "Gde" (how the work is done) and "Iznos", each a row of choices that are all in sight, and
 * at the foot the quiet "Očisti" and the one green action, which says how many tasks the list will show (a polite live region, so the new number is heard). While the
 * list is not known yet nothing is counted: the action says the list is being read, or that it could not be, and cannot be pressed; while only what is mine is still
 * read it applies the draft without a number. × or Back leaves the list exactly as it was.
 */
export function DiscoverySearchPanel({ items, view, mine, now, mapArea, blurTarget, mode, reduced, readiness = 'ready', p6Search, recent = [], onApply, onClose, onOpenTask }: {
  items: readonly MarketplaceItem[]; view: MarketplaceView; mine: ReadonlySet<string> | undefined; now: Date;
  /** The map's visible area when the camera has settled somewhere, for the counts of the search; null when unknown. */
  mapArea: PublicBounds | null;
  /** The underlying Discovery scene, never the search cards themselves. Android needs the explicit native target. */
  blurTarget?: RefObject<View | null>;
  mode: PanelMode;
  reduced: boolean;
  /** Whether the list it counts is known; see `SearchReadiness`. */
  readiness?: SearchReadiness;
  /** Optional P6 server-owned count/facet seam. A stale preview never falls back to the bounded loaded PAGE. */
  p6Search?: DiscoveryV1SearchPanelSeam;
  /** What this person searched before, newest first (the search only). */
  recent?: readonly RecentSearch[];
  onApply: (draft: SearchDraft) => void; onClose: () => void;
  onOpenTask?: (item: MarketplaceItem) => void;
}) {
  const [draft, setDraft] = useState<SearchDraft>(() => draftOf(view));
  const [datesOpen, setDatesOpen] = useState(false);
  const [openSection, setOpenSection] = useState<'when' | 'where' | 'amount' | null>('when');
  /** The first tap of a range: where it starts, until its end is tapped (the draft already holds that one day). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  /** The city whose parts the rows show (the row that "leads to" its parts); '' for the cities. It is not part of the draft: it filters no task. */
  const [within, setWithin] = useState('');
  const [typing, setTyping] = useState(false);
  // Choosing a place consumes only this visit's new input. An already applied task query remains intentional.
  const [committedQuery, setCommittedQuery] = useState(view.query);
  const placeSearch = within || (typing ? draft.query : '');
  const [closing, setClosing] = useState(false);
  const large = useTextScale() >= 1.3;
  const { width } = useWindowDimensions();
  const stackedActions = large || width < 360;
  const reducedTransparency = useReducedTransparency();
  const backdrop = searchBackdropKind({ os: Platform.OS, version: Platform.Version, hasTarget: !!blurTarget, reducedTransparency });
  const viewOf = (value: SearchDraft): MarketplaceView => ({ ...view, ...value });
  const serverOwned = !!p6Search;
  const localCount = useMemo(() => serverOwned ? 0 : discoveryItems(items, viewOf(draft), mine, now).length, [serverOwned, items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localUndated = useMemo(() => serverOwned ? 0 : undatedCount(items, viewOf(draft), mine, now), [serverOwned, items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverKey = discoveryV1SearchPreviewKey({ ...viewOf(draft), placeSearch } as SearchPreviewView, mapArea);
  const serverCurrent = !!p6Search && p6Search.snapshot.active && p6Search.snapshot.key === serverKey;
  const effectiveReadiness: SearchReadiness = p6Search
    ? !serverCurrent || p6Search.snapshot.status === 'loading' || p6Search.snapshot.status === 'idle' ? 'loading'
      : p6Search.snapshot.status === 'error' ? 'error' : 'ready'
    : readiness;
  const counted = effectiveReadiness === 'ready';
  const count = p6Search ? serverCurrent ? p6Search.snapshot.count ?? 0 : 0 : localCount;
  const undated = p6Search ? serverCurrent ? p6Search.snapshot.undated ?? 0 : 0 : localUndated;
  // P6 availability is whole-collection authority. While its preview is changing, keep the control visible rather
  // than infer absence from a bounded page; a selected old value also remains removable.
  const workModes = draft.where !== 'any' || (view.where ?? 'any') !== 'any'
    || (p6Search ? !serverCurrent || p6Search.snapshot.availability?.hasKnownWorkMode !== false : saysWorkMode(items));
  // The route hands a fresh clone of its view with every snapshot, so `mapArea` is a new array each time: keyed by identity this effect asked for
  // a preview after every preview (a request loop while the panel was open). It follows the area's value.
  const mapAreaKey = mapArea ? mapArea.join(',') : '';
  useEffect(() => { p6Search?.onDraft({ ...draft, placeSearch }, mapArea); }, [p6Search?.onDraft, draft, placeSearch, mapAreaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = serbianToday(now);
  const edit = (patch: Partial<SearchDraft>) => setDraft(current => remoteDiscoveryScope({ ...current, ...patch }));

  // Once the panel has begun to leave, nothing in it is acted on again: a second "Prikaži" or × during the exit
  // must not apply the draft twice or close twice.
  const [leaving] = useState({ value: false });
  const chosenTask = useRef<{ item: MarketplaceItem; key: string } | null>(null);
  const alive = useRef(true);
  const searchInput = useRef<TextInput | null>(null), shownOnce = useRef(false);
  // Android must own the Modal window before requesting the keyboard. An early autoFocus only places the cursor.
  const focusSearch = () => {
    if (!alive.current || leaving.value || shownOnce.current || mode !== 'search') return;
    shownOnce.current = true; searchInput.current?.focus();
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; chosenTask.current = null; }; }, []);
  const taskState = useRef({ serverKey, serverCurrent, p6Search, onOpenTask });
  taskState.current = { serverKey, serverCurrent, p6Search, onOpenTask };
  const closed = () => {
    if (!alive.current) return;
    const selected = chosenTask.current; chosenTask.current = null;
    const latest = taskState.current;
    const stillListed = selected && latest.serverKey === selected.key && latest.serverCurrent
      && latest.p6Search?.snapshot.status === 'ready'
      && latest.p6Search.snapshot.tasks?.some(item => item.id === selected.item.id
        && item.revision === (selected.item as MarketplaceItem & { revision?: number }).revision);
    onClose();
    if (selected && stillListed) latest.onOpenTask?.(selected.item);
  };
  const beginClose = () => {
    if (leaving.value) return;
    leaving.value = true;
    Keyboard.dismiss();
    if (reduced) closed(); else setClosing(true);
  };
  const onCloseButton = () => { if (!leaving.value) beginClose(); };
  const requestClose = () => {
    if (leaving.value) return;
    // Android Modal owns Back: first leave the keyboard, keeping this same draft and field mounted.
    if (Platform.OS === 'android' && Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    beginClose();
  };
  const applyDraft = (next: SearchDraft) => {
    if (leaving.value) return;
    onApply(next);
    beginClose();
  };
  const apply = () => applyDraft(draft);
  /** A choice in the search that is the end of it: the draft with the choice is applied, and the screen is the list again. */
  const choose = (patch: Partial<SearchDraft>) => {
    const next = remoteDiscoveryScope({ ...draft, ...patch });
    setDraft(next); applyDraft(next);
  };
  // Each half takes away only its own: the search (the words and the place, and the work done remotely, which the search offers too) or the filters (the days, the work mode, the amount).
  const clearAll = () => {
    if (mode === 'search') {
      setDraft(current => ({ ...current, query: NO_SEARCH.query, place: NO_SEARCH.place, area: NO_SEARCH.area, pinPlace: NO_SEARCH.pinPlace,
        where: current.where === 'remote' ? NO_SEARCH.where : current.where }));
      setWithin('');
      setTyping(false); setCommittedQuery('');
    } else {
      setDraft(current => ({ ...current, when: NO_SEARCH.when, dates: NO_SEARCH.dates, where: NO_SEARCH.where, places: NO_SEARCH.places, price: NO_SEARCH.price }));
      setRangeStart(null);
    }
  };

  // The one green action. What it can say depends on authoritative membership count; a stale P6 preview never falls
  // back to the number of rows already loaded.
  const show = effectiveReadiness === 'loading' ? { label: 'Učitavamo zadatke…', disabled: true }
    : effectiveReadiness === 'error' ? { label: 'Zadaci nisu učitani', disabled: true }
      : effectiveReadiness === 'pending' ? { label: 'Prikaži zadatke', disabled: false }
        : count > 0 ? { label: `Prikaži ${zadataka(count)}`, disabled: false } : { label: 'Nema zadataka za ove uslove', disabled: true };
  const emptyReason = counted && count === 0 ? 'Pokušaj sa širom oblašću ili drugim danom.' : null;
  const retryPreview = effectiveReadiness === 'error' && p6Search
    ? () => p6Search.onDraft({ ...draft, placeSearch }, mapArea) : undefined;
  // The foot every flow has (UI/UX pass 2026-10-08): the quiet "Očisti" beside the one green action, which says how many tasks the list will show;
  // when it cannot be pressed the reason stands in a line above it. At a large text size or a narrow window the two stand one under the other.
  const footer = <FlowFooter testID="search-footer" reason={retryPreview ? 'Zadaci nisu učitani. Tvoji izbori su sačuvani.' : emptyReason ?? undefined}>
    <View testID="search-actions" style={[s.actions, stackedActions && s.actionsStacked]}>
      <V2Action label={CLEAR} kind="quiet" tone="neutral" compact style={s.reset} onPress={clearAll} />
      <View testID="search-show" accessibilityLiveRegion="polite" style={[s.grow, stackedActions && s.showStacked]}>
        <V2Action label={retryPreview ? 'Pokušaj ponovo' : show.label} disabled={!retryPreview && show.disabled} onPress={retryPreview ?? apply} style={brandAction} />
      </View>
    </View>
  </FlowFooter>;

  if (mode === 'search') {
    // Gde: legacy mode derives from the full loaded collection. P6 uses exact PLACES rows/counts and never derives a zero or a locality list from the bounded PAGE
    // slice. The place counts never include the words typed in the field. While the work done remotely is chosen there are no places to offer (it has none, and the
    // server's preview asks for none): the picker says so and leads to "Svi zadaci", which is the way to a city.
    const localPlaces = p6Search ? [] : placeSuggestions(items, viewOf(draft), mine, now);
    const known = (value: number | null) => counted ? value : null;
    const placesRead = p6Search ? serverCurrent : true;
    const rows: PlaceRow[] = (p6Search ? serverCurrent ? p6Search.snapshot.places.map(place => ({ text: place.text, count: place.count })) : [] : localPlaces)
      .map(place => ({ text: place.text, count: known(place.count) }));
    // The parts of the city drilled into ("Liman, Novi Sad"): the server's AREA rows, apart from the city rows above, with the same honesty about counts.
    const partRows: PlaceRow[] = p6Search && serverCurrent ? p6Search.snapshot.parts.map(place => ({ text: place.text, count: known(place.count) })) : [];
    // A place that is chosen stays in the list and can be taken away, even if a fresh read leaves it no tasks.
    if (draft.place && placesRead && !rows.some(place => placeKey(place.text) === placeKey(draft.place!)) && !partRows.some(place => placeKey(place.text) === placeKey(draft.place!))) {
      rows.push({ text: draft.place, count: p6Search ? null : known(0) });
    }
    const everywhere = p6Search ? serverCurrent ? known(p6Search.snapshot.everywhere) : null
      : known(discoveryItems(items, viewOf({ ...draft, ...ANYWHERE, query: '', where: draft.where === 'remote' ? 'any' : draft.where }), mine, now).length);
    // How many tasks are done remotely: known where the loaded tasks are all of them; the server's preview has no such count, so none is said there.
    const remoteCount = p6Search ? null : known(discoveryItems(items, viewOf({ ...draft, ...ANYWHERE, query: '', where: 'remote' }), mine, now).filter(item => workMode(item) === 'remote').length);
    const facetDown = !!p6Search && serverCurrent && p6Search.snapshot.facetError;
    const placesComplete = counted && placesRead && !facetDown && !(p6Search && p6Search.snapshot.placeHasMore);
    // Choosing a place leaves the work done remotely (which has no place): a place and "Na daljinu" are not one search.
    const place = (text: string) => choose({ ...ANYWHERE, place: text, query: typing ? committedQuery : draft.query,
      where: draft.where === 'remote' ? 'any' : draft.where });
    const tasks = draft.query.trim() && counted && serverCurrent ? p6Search?.snapshot.tasks ?? [] : [];
    const header = <View style={s.searchHeader}>
      <ChromeIconButton glyph="back" label="Zatvori pretragu" hint="Lista ostaje kakva je bila." quiet onPress={onCloseButton} />
      <View style={s.grow}>
        <SearchField testID="search-what-field" inputRef={searchInput} value={draft.query} onChangeText={query => {
          setTyping(true); setWithin(''); if (!query) setCommittedQuery(''); edit({ query });
        }} label={SEARCH_WORDS.what}
          placeholder={SEARCH_WORDS.whatPlaceholder} clearLabel="Obriši reč" returnKeyType="search" onSubmit={() => { if (!show.disabled) apply(); }} />
      </View>
    </View>;
    return <SearchSheet reduced={reduced} backdrop={backdrop} blurTarget={blurTarget} closing={closing} screen header={header} onShown={focusSearch}
      title={SEARCH_WORDS.searchTitle} closeLabel="Zatvori pretragu" closeHint="Lista ostaje kakva je bila."
      footer={footer} onCloseButton={onCloseButton} onRequestClose={requestClose} onClosed={closed}>
      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sections}>
        {onOpenTask && tasks.length ? <View testID="search-task-suggestions" style={s.recent}>
          <T variant="bodyStrong" accessibilityRole="header">Zadaci</T>
          {tasks.map(item => <Row key={item.id} text={item.title} note={[item.approximateArea, item.approximateCity].filter(Boolean).join(', ')}
            label={`Otvori zadatak: ${item.title}${item.approximateCity ? `, ${item.approximateCity}` : ''}`} role="button" onPress={() => {
              const latest = taskState.current;
              if (!alive.current || leaving.value || !latest.serverCurrent || latest.serverKey !== serverKey
                || latest.p6Search?.snapshot.status !== 'ready'
                || !latest.p6Search.snapshot.tasks?.some(current => current.id === item.id && current.revision === item.revision)) return;
              chosenTask.current = { item: discoveryV1Opportunity(item), key: serverKey }; beginClose();
            }} />)}
        </View> : null}
        <T variant="bodyStrong" accessibilityRole="header" style={s.groupName}>Mesta</T>
        <PlacePicker within={placeSearch} onWithin={city => { setWithin(city); if (!city && typing) { edit({ query: committedQuery }); setTyping(false); } }}
          anywhere={{ checked: !draft.place && !draft.area && !draft.pinPlace && draft.where !== 'remote', count: everywhere, onPress: () => choose({ ...ANYWHERE, where: draft.where === 'remote' ? 'any' : draft.where }) }}
          remote={{ available: workModes, checked: draft.where === 'remote', count: remoteCount, onPress: () => choose({ where: 'remote' }) }}
          remoteNote={draft.where === 'remote' ? SEARCH_WORDS.remoteNote : null}
          places={rows} parts={partRows} cities={!!p6Search && DISCOVERY_V1_PLACES_BY_CITY} serverFiltered={!!p6Search} chosenPlace={draft.place} ready={counted && placesRead}
          complete={placesComplete}
          more={p6Search && serverCurrent && p6Search.snapshot.placeHasMore
            ? { label: p6Search.snapshot.placePaging ? 'Učitavamo još mesta…' : 'Prikaži još mesta', busy: p6Search.snapshot.placePaging, onPress: p6Search.onNextPlaces } : null}
          note={facetDown ? PLACE_WORDS.facetDown : null} onPlace={place} />
        {recent.length ? <View testID="search-recent" style={s.recent}>
          <GroupTitle>{SEARCH_WORDS.recent}</GroupTitle>
          {recent.map(entry => {
            const words = [entry.query ? quoted(entry.query) : null, entry.place].filter((part): part is string => !!part).join(' · ');
            return <Row key={`${entry.query}|${entry.place ?? ''}`} art="clock" text={words} label={`${SEARCH_WORDS.recent}: ${words}`} role="button"
              onPress={() => choose({ query: entry.query, place: entry.place, area: null, pinPlace: null, where: draft.where === 'remote' && entry.place ? 'any' : draft.where })} />;
          })}
        </View> : null}
      </ScrollView>
    </SearchSheet>;
  }

  // The filters. A day the filters do not offer but the list was narrowed to (the week, the next seven days) is still a choice here, so it can be seen and taken away.
  const extraWhen = draft.when !== 'any' && !draft.dates && !FILTER_WHEN.some(([key]) => key === draft.when) ? [[draft.when, said(WHEN, draft.when)] as const] : [];
  const whenOptions = [...FILTER_WHEN, ...extraWhen];
  const whenValue = draft.dates || draft.when === 'any' ? null : draft.when;
  const toggleDates = () => { Keyboard.dismiss(); setRangeStart(null); setDatesOpen(current => !current); };
  const tapDay = (day: string) => {
    if (day < today) return;
    // The first tap is a whole choice already: that one day, applied as it is if nothing more is tapped. A day before it
    // starts again; the second tap, on it or after it, ends the range.
    if (rangeStart === null || day < rangeStart) { setRangeStart(day); edit({ dates: { from: day, to: day }, when: 'any' }); return; }
    setRangeStart(null);
    edit({ dates: { from: rangeStart, to: day }, when: 'any' });
  };
  const section = (key: NonNullable<typeof openSection>, title: string, summary: string, children: ReactNode) =>
    <FilterSection key={key} id={key} title={title} summary={summary} open={openSection === key}
      onToggle={() => setOpenSection(current => current === key ? null : key)}>{children}</FilterSection>;
  return <SearchSheet reduced={reduced} backdrop={backdrop} blurTarget={blurTarget} closing={closing} ratio={FILTERS_RATIO} separated
    title={SEARCH_WORDS.filtersTitle} closeLabel="Zatvori filtere" closeHint="Lista ostaje kakva je bila."
    footer={footer} onCloseButton={onCloseButton} onRequestClose={requestClose} onClosed={onClose}>
    <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sections}>
      {section('when', FILTER_GROUP.when, whenWords(draft, now), <>
        {/* A day that is chosen is taken away by tapping it again: there is no "any day" choice among the days. */}
        <Choice compact label={FILTER_GROUP.when} options={whenOptions} value={whenValue}
          onChange={when => { setRangeStart(null); edit({ when: draft.when === when && !draft.dates ? 'any' : when, dates: null }); }} />
        <Press testID="search-date-toggle" accessibilityRole="button" accessibilityLabel="Datumi"
          accessibilityValue={{ text: draft.dates ? whenWords(draft, now) : 'Izaberi datume' }} accessibilityState={{ expanded: datesOpen }}
          onPress={toggleDates} haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.dateToggle}>
          <T variant="copy" style={[s.grow, draft.dates ? s.dateOn : s.ink]}>{draft.dates ? whenWords(draft, now) : 'Izaberi datume'}</T>
          <TurningCaret open={datesOpen} />
        </Press>
        {datesOpen ? <View testID="search-date-editor" style={s.dateEditor}>
          <DateRangeGrid today={today} from={rangeStart ?? draft.dates?.from ?? null} to={rangeStart ? null : draft.dates?.to ?? null} now={now} onDay={tapDay} />
          <T variant="note" tone="muted" accessibilityLiveRegion="polite">{rangeStart ? 'Izaberi poslednji dan.' : 'Izaberi prvi i poslednji dan.'}</T>
          {draft.dates ? <V2Action label="Gotovo" kind="secondary" onPress={() => { setDatesOpen(false); setRangeStart(null); }} /> : null}
        </View> : null}
        {counted && undated ? <T variant="note" tone="muted">{undatedWords(undated)}</T> : null}
      </>)}
      {workModes ? section('where', FILTER_GROUP.where, said(WHERE, draft.where), <>
        <Choice compact label={FILTER_GROUP.where} options={WHERE} value={draft.where} onChange={where => edit({ where })} />
      </>) : null}
      {section('amount', FILTER_GROUP.amount, said(PRICE, draft.price), <>
        <Choice compact label={FILTER_GROUP.amount} options={PRICE} value={draft.price} onChange={price => edit({ price })} />
      </>)}
    </ScrollView>
  </SearchSheet>;
}

/** More room for the date grid; only one section is expanded at a time. */
const FILTERS_RATIO = 0.92;

function FilterSection({ id, title, summary, open, onToggle, children }: {
  id: string; title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return <Surface kind="float" testID={`filters-${id}`} style={s.filterSection}>
    <Press testID={`filters-${id}-toggle`} accessibilityRole="button" accessibilityLabel={title}
      accessibilityValue={{ text: summary }} accessibilityState={{ expanded: open }} onPress={onToggle}
      haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.filterHeading}>
      <View style={s.grow}><T variant={open ? 'heading' : 'bodyStrong'} tone={open ? 'ink' : 'muted'}>{title}</T>
        {!open ? <T variant="note" style={s.ink}>{summary}</T> : null}</View>
      <TurningCaret open={open} />
    </Press>
    {open ? <View testID={`filters-${id}-body`} style={s.filterBody}>{children}</View> : null}
  </Surface>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  scroll: { flex: 1 },
  // The groups stand 20 from the edge like every screen; a group is its name and its choices, parted from the next by air, not by a line or a card.
  sections: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: sys.space.base, gap: sys.space.lg },
  groupName: { color: sys.color.ink },
  filterSection: { paddingHorizontal: sys.space.base, paddingVertical: sys.space.xs },
  filterHeading: { minHeight: layout.rowMin, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.sm },
  filterBody: { gap: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.base },
  recent: { gap: sys.space.xs },
  // The search's first row: the way back and the field, the field as wide as is left.
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingLeft: sys.space.sm, paddingRight: sys.space.base, paddingTop: sys.space.sm, paddingBottom: sys.space.xs },
  dateToggle: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: sys.touch.min,
    paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm, backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  dateOn: { color: sys.color.ink, fontWeight: '600' },
  dateEditor: { gap: sys.space.sm },
  reset: { paddingHorizontal: 0, flexShrink: 1, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  // At 320 dp / large text, the clear label otherwise takes nearly the whole row and turns the primary label into
  // a column of letters. The primary gets the full width; reset stays a quiet link with a 48 dp touch target.
  actionsStacked: { flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  showStacked: { flex: 0, width: '100%' },
});
