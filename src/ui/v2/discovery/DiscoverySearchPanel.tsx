import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Keyboard, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { atLeast, dateRange, discoveryItems, placeKey, placeSuggestions, remoteDiscoveryScope, saysWorkMode, serbianToday, undatedCount,
  type DateRange, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { discoveryV1SearchPreviewKey, type DiscoveryV1SearchSnapshot, type SearchPreviewView } from '../../../data/discoveryV1SearchOwner';
import { Press } from '../../Press';
import { T } from '../../Text';
import { TurningCaret } from '../../system/Disclosure';
import { osoba, zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { brandAction, sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { DateRangeGrid } from './DateRangeGrid';
import { ANY_WHAT, CLEAR_ALL, PRICE, SECTION_LABEL, WHEN, WHERE, quoted, said, undatedWords, whenWords, whereWords } from './discoveryWords';
import { PLACE_WORDS, PlacePicker } from './PlacePicker';
import type { PlaceRow } from './popularCities';
import { searchBackdropKind, useReducedTransparency } from './SearchBackdrop';
import { Choice, SearchField, Stepper } from './SearchParts';
import { SEARCH_STEPS, SearchSection, type SearchStep } from './SearchSection';
import { SearchSheet } from './SearchSheet';

export type { SearchStep } from './SearchSection';

/** Everything the search panel chooses, as a draft: nothing reaches the list before "Prikaži N zadataka". */
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
/** What the server is asked about: the draft and, apart from it, the letters typed in "Gde" to find a place by its name. */
export type SearchPreviewDraft = SearchDraft & { placeSearch?: string };
export type DiscoveryV1SearchPanelSeam = {
  snapshot: DiscoveryV1SearchSnapshot;
  onDraft: (draft: SearchPreviewDraft, mapArea: PublicBounds | null) => void;
  onNextPlaces: () => void;
};
/** What the panel hands over with the draft: the person chose "U blizini", which moves the camera to them and filters nothing. */
export type SearchApplyOptions = { nearby?: boolean };

/** "Gde" at its "everything": no place, no map area, no single point. The words searched in "Šta" are another choice and stay. */
const ANYWHERE = { place: null, area: null, pinPlace: null } as const satisfies Partial<SearchDraft>;

/**
 * Whether a screen reader is on, followed while the panel is open. With one on, revealing an editor never takes over
 * scrolling and a choice never moves the open section: focus stays on the control the person just used. The platform may
 * lack either call (a test double, the web), and then nothing is known and nothing changes.
 */
export function useScreenReader(): boolean {
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true, revision = 0;
    try {
      const request = revision;
      const answer = AccessibilityInfo.isScreenReaderEnabled?.();
      answer?.then?.(enabled => { if (alive && request === revision && typeof enabled === 'boolean') setReader(enabled); }, () => undefined);
    } catch { /* Nothing is known; manual editor expansion keeps its usual reveal. */ }
    let listener: { remove?: () => void } | undefined;
    try {
      listener = AccessibilityInfo.addEventListener?.('screenReaderChanged', (enabled: boolean) => { if (alive) { revision++; setReader(!!enabled); } });
    } catch { listener = undefined; }
    return () => { alive = false; listener?.remove?.(); };
  }, []);
  return reader;
}

/**
 * The search over the Zadaci map, as an Airbnb-style panel (owner, 2026-10-07; UX plan 2.19): a tall white sheet over the
 * screen it opened on, which is blurred behind it. The questions are separate cards in the order Gde, Kada, Šta, Cena,
 * Broj ljudi, Način rada; one is open at a time, a closed one says what is chosen in it, and a choice that completes a
 * question opens the next (a place, a day range once confirmed, the typed word on "Gotovo", a price, a way of working).
 * Nothing that takes several taps or letters (the number of people, a word being typed) moves on by itself.
 *
 * "Gde" is a list of places that fills the screen as soon as it is scrolled; the × then brings the sheet back. Every
 * choice is a draft: the footer's one green action applies it all and says how many tasks the list will then show (a
 * polite live region, so the new number is heard), "Obriši uslove" empties the draft, and × or Back leaves the list exactly
 * as it was. While the list is not known yet the panel counts nothing: the action says the list is being read, or that it
 * could not be, and cannot be pressed; while only what is mine is still read it applies the draft without a number.
 *
 * "Gde" offers every task, the map's area, the person's own position (once, applied with the draft), the places the tasks
 * name with their counts, and the biggest cities of Serbia (see `PlacePicker`). The letters typed there only find places.
 */
export function DiscoverySearchPanel({ items, view, mine, now, mapArea, blurTarget, start = 'gde', reduced, readiness = 'ready',
  p6Search, canNearby = false, onApply, onClose }: {
  items: readonly MarketplaceItem[]; view: MarketplaceView; mine: ReadonlySet<string> | undefined; now: Date;
  /** The map's visible area when the camera has settled somewhere, for "Ova oblast"; null when unknown. */
  mapArea: PublicBounds | null;
  /** The underlying Discovery scene, never the search cards themselves. Android needs the explicit native target. */
  blurTarget?: RefObject<View | null>;
  /** Entry context opens that section; unavailable work-mode controls fall back to Gde. */
  start?: SearchStep;
  reduced: boolean;
  /** Whether the list it counts is known; see `SearchReadiness`. */
  readiness?: SearchReadiness;
  /** Optional P6 server-owned count/facet seam. A stale preview never falls back to the bounded loaded PAGE. */
  p6Search?: DiscoveryV1SearchPanelSeam;
  /** Whether "U blizini" is offered (the screen can move its map to the person). */
  canNearby?: boolean;
  onApply: (draft: SearchDraft, options?: SearchApplyOptions) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchDraft>(() => draftOf(view));
  const [activeStep, setActiveStep] = useState<SearchStep | null>(() => start === 'kako'
    && (view.where ?? 'any') === 'any' && !saysWorkMode(items) ? 'gde' : start);
  const [datesOpen, setDatesOpen] = useState(false);
  /** The first tap of a range: where it starts, until its end is tapped (the draft already holds that one day). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  /** The letters typed in "Gde" to find a place. They are not part of the draft: they filter no task. */
  const [placeSearch, setPlaceSearch] = useState('');
  /** "U blizini" is chosen: applied with the draft, it moves the map to the person. It is no filter, so it is not in the draft. */
  const [nearbyChosen, setNearbyChosen] = useState(false);
  /** The place list fills the screen (scrolled), until the × brings the sheet back. */
  const [wide, setWide] = useState(false);
  const [closing, setClosing] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const mounted = useRef(true), frame = useRef<number | null>(null);
  const sectionY = useRef<Partial<Record<SearchStep, number>>>({}), bodyY = useRef<Partial<Record<SearchStep, number>>>({});
  const calendarY = useRef<number | null>(null);
  /** What the list is to be scrolled to once it has arrived: a section, or the calendar inside Kada. */
  const reveal = useRef<{ step: SearchStep; calendar: boolean } | null>(null);
  const reader = useScreenReader();
  const reducedTransparency = useReducedTransparency();
  const backdrop = searchBackdropKind({ os: Platform.OS, version: Platform.Version, hasTarget: !!blurTarget, reducedTransparency });
  const behavior = useRef({ reader, reduced }); behavior.current = { reader, reduced };
  const retireReveal = useCallback(() => {
    reveal.current = null;
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; retireReveal(); }; }, [retireReveal]);
  const large = useTextScale() >= 1.3;
  const { width } = useWindowDimensions();
  const stackedActions = large || width < 360;
  // The people label needs more room than the footer: at 361dp / 1.15 it had only ~81dp beside the stepper.
  const stackedPeople = large || width < 380;
  const viewOf = (value: SearchDraft): MarketplaceView => ({ ...view, ...value });
  const localCount = useMemo(() => discoveryItems(items, viewOf(draft), mine, now).length, [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localUndated = useMemo(() => undatedCount(items, viewOf(draft), mine, now), [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverKey = discoveryV1SearchPreviewKey({ ...viewOf(draft), placeSearch } as SearchPreviewView, mapArea);
  const serverCurrent = !!p6Search && p6Search.snapshot.active && p6Search.snapshot.key === serverKey;
  const effectiveReadiness: SearchReadiness = p6Search
    ? !serverCurrent || p6Search.snapshot.status === 'loading' || p6Search.snapshot.status === 'idle' ? 'loading'
      : p6Search.snapshot.status === 'error' ? 'error' : 'ready'
    : readiness;
  const counted = effectiveReadiness === 'ready';
  const count = p6Search ? serverCurrent ? p6Search.snapshot.count ?? 0 : 0 : localCount;
  const undated = p6Search ? serverCurrent ? p6Search.snapshot.undated ?? 0 : 0 : localUndated;
  // P6 availability is whole-collection authority. While its preview is changing, keep the control visible rather than
  // infer absence from a bounded page; a selected old value also remains removable.
  const workModes = draft.where !== 'any' || (view.where ?? 'any') !== 'any'
    || (p6Search ? !serverCurrent || p6Search.snapshot.availability?.hasKnownWorkMode !== false : saysWorkMode(items));
  const order = useMemo(() => SEARCH_STEPS.filter(step => step !== 'kako' || workModes), [workModes]);
  // The route hands a fresh clone of its view with every snapshot, so `mapArea` is a new array each time: keyed by identity this effect asked for
  // a preview after every preview (a request loop while the panel was open). It follows the area's value.
  const mapAreaKey = mapArea ? mapArea.join(',') : '';
  useEffect(() => { p6Search?.onDraft({ ...draft, placeSearch }, mapArea); }, [p6Search?.onDraft, draft, placeSearch, mapAreaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!workModes && activeStep === 'kako') { retireReveal(); setActiveStep('gde'); } }, [workModes, activeStep, retireReveal]);
  // The place list fills the screen only while "Gde" is the open section.
  useEffect(() => { if (activeStep !== 'gde') setWide(false); }, [activeStep]);
  const today = serbianToday(now);
  const edit = (patch: Partial<SearchDraft>) => setDraft(current => remoteDiscoveryScope({ ...current, ...patch }));
  const clearAll = () => { retireReveal(); setDraft(NO_SEARCH); setRangeStart(null); setPlaceSearch(''); setNearbyChosen(false); };

  // The list scrolls to a section once it has opened, or to the calendar once it has been laid out, and never while a screen
  // reader holds focus. Each position is where that card or part last stood; a card above that is still closing has moved
  // by the time the one below has arrived (it leaves faster than the next one comes).
  const scrollToReveal = useCallback(() => {
    const intent = reveal.current;
    if (!intent || !mounted.current) return;
    const card = sectionY.current[intent.step];
    if (card === undefined || behavior.current.reader) { reveal.current = null; return; }
    let y = card - sys.space.md;
    if (intent.calendar) {
      const body = bodyY.current[intent.step], calendar = calendarY.current;
      if (body === undefined || calendar === null) return;
      y = card + Math.max(0, body + calendar - sys.touch.min - sys.space.md) - sys.space.md;
    }
    reveal.current = null;
    scroll.current?.scrollTo?.({ y: Math.max(0, y), animated: !behavior.current.reduced });
  }, []);
  const queueReveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { frame.current = null; scrollToReveal(); });
  }, [scrollToReveal]);
  const positionSection = (step: SearchStep, y: number) => { if (Number.isFinite(y) && y >= 0) sectionY.current[step] = y; };
  const positionBody = (step: SearchStep, y: number) => { if (Number.isFinite(y) && y >= 0) bodyY.current[step] = y; };
  const settled = (step: SearchStep, open: boolean) => {
    const intent = reveal.current;
    if (open && intent && intent.step === step && !intent.calendar) queueReveal();
  };

  const openStep = (step: SearchStep | null) => {
    Keyboard.dismiss(); retireReveal();
    if (step) reveal.current = { step, calendar: false };
    setActiveStep(step);
  };
  const toggleStep = (step: SearchStep) => openStep(activeStep === step ? null : step);
  /** A choice that completes its question opens the next one; with a screen reader on, focus stays where it is. */
  const advance = (from: SearchStep) => {
    if (behavior.current.reader) return;
    openStep(order[order.indexOf(from) + 1] ?? null);
  };
  const toggleDates = () => {
    Keyboard.dismiss(); setRangeStart(null); retireReveal();
    if (!datesOpen) { calendarY.current = null; reveal.current = { step: 'kada', calendar: true }; }
    setDatesOpen(current => !current);
  };
  const tapDay = (day: string) => {
    if (day < today) return;
    // The first tap is a whole choice already: that one day, applied as it is if nothing more is tapped. A day before it
    // starts again; the second tap, on it or after it, ends the range.
    if (rangeStart === null || day < rangeStart) { setRangeStart(day); edit({ dates: { from: day, to: day }, when: 'any' }); return; }
    setRangeStart(null);
    edit({ dates: { from: rangeStart, to: day }, when: 'any' });
  };
  /** "Gotovo" under the calendar: the days chosen so far are the choice, and the next question opens. */
  const confirmDates = () => { setDatesOpen(false); setRangeStart(null); advance('kada'); };

  // Gde: legacy mode derives from the full loaded collection. P6 uses exact PLACES rows/counts and never derives
  // a zero or a locality list from the bounded PAGE slice. The place counts never include the words searched in "Šta".
  const localPlaces = useMemo(() => placeSuggestions(items, viewOf(draft), mine, now), [items, view, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localEverywhere = useMemo(() => discoveryItems(items, viewOf({ ...draft, ...ANYWHERE, query: '' }), mine, now).length,
    [items, view, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localInMapArea = useMemo(() => mapArea ? discoveryItems(items, viewOf({ ...draft, ...ANYWHERE, query: '', area: mapArea }), mine, now).length : 0,
    [items, view, mapArea, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = (value: number | null) => counted ? value : null;
  const placesRead = p6Search ? serverCurrent : true;
  const rows: PlaceRow[] = (p6Search ? serverCurrent ? p6Search.snapshot.places.map(place => ({ text: place.text, count: place.count })) : [] : localPlaces)
    .map(place => ({ text: place.text, count: known(place.count) }));
  // A place that is chosen stays in the list and can be taken away, even if the other conditions (or a fresh read) leave it no tasks.
  if (draft.place && placesRead && !rows.some(place => placeKey(place.text) === placeKey(draft.place!))) {
    rows.push({ text: draft.place, count: p6Search ? null : known(0) });
  }
  const everywhere = p6Search ? serverCurrent ? known(p6Search.snapshot.everywhere) : null : known(localEverywhere);
  const inMapArea = p6Search ? serverCurrent ? known(p6Search.snapshot.inMapArea) : null : known(localInMapArea);
  const facetDown = !!p6Search && serverCurrent && p6Search.snapshot.facetError;
  const placesComplete = counted && placesRead && !facetDown && !(p6Search && p6Search.snapshot.placeHasMore);
  const choosePlaceFlow = (patch: Partial<SearchDraft>, nearby = false) => {
    edit(patch); setNearbyChosen(nearby); setPlaceSearch(''); advance('gde');
  };

  // The one green action. What it can say depends on authoritative membership count; a stale P6 preview never falls
  // back to the number of rows already loaded.
  const show = effectiveReadiness === 'loading' ? { label: 'Učitavamo zadatke…', disabled: true }
    : effectiveReadiness === 'error' ? { label: 'Zadaci nisu učitani', disabled: true }
      : effectiveReadiness === 'pending' ? { label: 'Prikaži zadatke', disabled: false }
        : count > 0 ? { label: `Prikaži ${zadataka(count)}`, disabled: false } : { label: 'Nema zadataka za ove uslove', disabled: true };
  const emptyReason = counted && count === 0 ? 'Probaj širu oblast ili drugi dan.' : null;

  // Once the panel has begun to leave, nothing in it is acted on again: a second "Prikaži" or × during the 170 ms of its exit
  // must not apply the draft twice or close twice.
  const leaving = useRef(false);
  const beginClose = () => {
    if (leaving.current) return;
    leaving.current = true; retireReveal();
    if (reduced) onClose(); else setClosing(true);
  };
  /** The × and a tap outside: with the place list over the whole screen they bring the sheet back, otherwise they close the panel. */
  const onCloseButton = () => { if (leaving.current) return; if (wide) setWide(false); else beginClose(); };
  const requestClose = () => {
    if (leaving.current) return;
    // Android Modal owns Back: first leave the keyboard, keeping this same draft and editor mounted.
    if (Platform.OS === 'android' && Keyboard.isVisible()) { retireReveal(); Keyboard.dismiss(); return; }
    onCloseButton();
  };
  const apply = () => {
    if (leaving.current) return;
    onApply(draft, nearbyChosen && draft.where !== 'remote' ? { nearby: true } : undefined);
    beginClose();
  };

  const common = (step: SearchStep) => ({ step, open: activeStep === step, large, reduced, onToggle: toggleStep,
    onPosition: positionSection, onBodyPosition: positionBody, onSettled: settled });
  const gdeSummary = nearbyChosen && draft.where !== 'remote' ? 'U blizini' : whereWords({ ...draft, query: '' });
  const footer = <View testID="search-actions" style={[s.footer, stackedActions && s.footerStacked]}>
    <V2Action label={CLEAR_ALL} accessibilityLabel="Obriši sve uslove pretrage" kind="quiet" tone="neutral" compact style={s.reset} onPress={clearAll} />
    <View testID="search-show" accessibilityLiveRegion="polite" style={[s.grow, stackedActions && s.showStacked]}>
      <V2Action label={show.label} disabled={show.disabled} reason={emptyReason} onPress={apply} style={brandAction} />
    </View>
  </View>;

  return <SearchSheet reduced={reduced} backdrop={backdrop} blurTarget={blurTarget} expanded={wide} closing={closing}
    title={wide ? SECTION_LABEL.gde : start === 'gde' ? 'Pretraga' : 'Filteri'}
    closeLabel={wide ? 'Smanji spisak mesta' : 'Zatvori pretragu'} closeHint={wide ? 'Vraća na pretragu.' : 'Lista ostaje kakva je bila.'}
    footer={footer} onCloseButton={onCloseButton} onRequestClose={requestClose} onClosed={onClose}>
    <ScrollView ref={scroll} style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sections}
      onScrollBeginDrag={() => { retireReveal(); if (activeStep === 'gde') setWide(true); }}>
      <SearchSection {...common('gde')} label={SECTION_LABEL.gde} summary={gdeSummary} art="pin">
        <PlacePicker typed={placeSearch} onType={setPlaceSearch} remote={draft.where === 'remote'}
          anywhere={{ checked: !draft.place && !draft.area && !draft.pinPlace && !nearbyChosen, count: everywhere, onPress: () => choosePlaceFlow(ANYWHERE) }}
          area={{ available: !!mapArea, checked: !draft.place && !!draft.area && !draft.pinPlace && !nearbyChosen, count: inMapArea,
            onPress: () => { if (mapArea) choosePlaceFlow({ ...ANYWHERE, area: mapArea }); } }}
          nearby={{ available: canNearby && draft.where !== 'remote', checked: nearbyChosen, onPress: () => choosePlaceFlow(ANYWHERE, true) }}
          places={rows} chosenPlace={draft.place} ready={counted && placesRead} complete={placesComplete}
          more={p6Search && serverCurrent && p6Search.snapshot.placeHasMore
            ? { label: p6Search.snapshot.placePaging ? 'Učitavamo još mesta…' : 'Prikaži još mesta', busy: p6Search.snapshot.placePaging, onPress: p6Search.onNextPlaces } : null}
          note={facetDown ? PLACE_WORDS.facetDown : null}
          onPlace={text => choosePlaceFlow({ ...ANYWHERE, place: text })}
          onWord={text => { edit({ query: text }); setPlaceSearch(''); openStep('sta'); }} />
      </SearchSection>
      <SearchSection {...common('kada')} label={SECTION_LABEL.kada} summary={whenWords(draft, now)} art="calendar">
        <Choice compact label="Kada" options={WHEN} value={draft.dates ? null : draft.when}
          onChange={when => { setRangeStart(null); edit({ when, dates: null }); advance('kada'); }} />
        <Press testID="search-date-toggle" accessibilityRole="button" accessibilityLabel="Datumi"
          accessibilityValue={{ text: draft.dates ? whenWords(draft, now) : 'Izaberi datume' }} accessibilityState={{ expanded: datesOpen }}
          onPress={toggleDates} haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.dateToggle}>
          <T variant="copy" style={[s.grow, draft.dates ? s.dateOn : s.ink]}>{draft.dates ? whenWords(draft, now) : 'Izaberi datume'}</T>
          <TurningCaret open={datesOpen} />
        </Press>
        {datesOpen ? <View testID="search-date-editor" style={s.dateEditor}
          onLayout={event => {
            const y = event.nativeEvent.layout.y;
            if (!mounted.current || !Number.isFinite(y) || y < 0) return;
            calendarY.current = y;
            if (reveal.current?.calendar) queueReveal();
          }}>
          <DateRangeGrid today={today} from={rangeStart ?? draft.dates?.from ?? null} to={rangeStart ? null : draft.dates?.to ?? null} now={now} onDay={tapDay} />
          <T variant="note" tone="muted" accessibilityLiveRegion="polite">{rangeStart ? 'Izaberi poslednji dan.' : 'Izaberi prvi i poslednji dan.'}</T>
          {draft.dates ? <V2Action label="Gotovo" kind="secondary" onPress={confirmDates} /> : null}
        </View> : null}
        {counted && undated ? <T variant="note" tone="muted">{undatedWords(undated)}</T> : null}
      </SearchSection>
      <SearchSection {...common('sta')} label={SECTION_LABEL.sta} summary={draft.query.trim() ? quoted(draft.query) : ANY_WHAT} art="tool">
        <SearchField testID="search-what-field" value={draft.query} onChangeText={query => edit({ query })} label="Šta tražiš"
          placeholder="Npr. selidba, farbanje, košenje" clearLabel="Obriši reč" returnKeyType="done" onSubmit={() => advance('sta')} />
        <T variant="note" tone="muted">Traži se u naslovima, mestu i uslovima zadataka.</T>
      </SearchSection>
      <SearchSection {...common('cena')} label={SECTION_LABEL.cena} summary={said(PRICE, draft.price)} art="money">
        <Choice label="Cena" options={PRICE} value={draft.price} onChange={price => { edit({ price }); advance('cena'); }} />
      </SearchSection>
      <SearchSection {...common('koliko')} label={SECTION_LABEL.koliko} summary={osoba(draft.places)} art="users">
        <View testID="search-people-layout" style={[s.peopleRow, stackedPeople && s.peopleStacked]}>
          <Stepper value={draft.places} expanded={stackedPeople} onChange={places => edit({ places })} />
        </View>
        <T variant="note" tone="muted">Prikazujemo zadatke koji imaju dovoljno slobodnih mesta za toliko ljudi.</T>
        {/* A number is counted with several taps, so it never moves on by itself; "Gotovo" says it is the number. */}
        <V2Action label="Gotovo" kind="secondary" onPress={() => advance('koliko')} />
      </SearchSection>
      {workModes ? <SearchSection {...common('kako')} label={SECTION_LABEL.kako} summary={said(WHERE, draft.where)} art="remote">
        <Choice label="Način rada" options={WHERE} value={draft.where} onChange={where => { edit({ where }); advance('kako'); }} />
      </SearchSection> : null}
    </ScrollView>
  </SearchSheet>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  scroll: { flex: 1 },
  sections: { paddingHorizontal: sys.space.base, paddingTop: sys.space.xs, paddingBottom: sys.space.base, gap: sys.space.md },
  dateToggle: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: sys.touch.min,
    paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm, backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  dateOn: { color: sys.color.ink, fontWeight: '600' },
  dateEditor: { gap: sys.space.sm },
  peopleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.md },
  peopleStacked: { flexDirection: 'column', alignItems: 'stretch' },
  reset: { paddingHorizontal: 0, flexShrink: 1, alignSelf: 'flex-start' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.lg, paddingTop: sys.space.md,
    paddingBottom: sys.space.md, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
  // At 320 dp / large text, the clear label otherwise takes nearly the whole row and turns the primary label into
  // a column of letters. The primary gets the full width; reset stays a quiet link with a 48 dp touch target.
  footerStacked: { flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  showStacked: { flex: 0, width: '100%' },
});
