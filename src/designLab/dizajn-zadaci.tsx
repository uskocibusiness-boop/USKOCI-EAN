import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import type { NeedDetailProjection, PrilikaProjekcija } from '../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type PublicBounds } from '../data/marketplaceView';
import { taskRelationIndex, type TaskRelation } from '../data/taskRelation';
import type { TaskCardRelation } from '../ui/v2/TaskFace';
import { novac } from '../lib/novac';
import type { DiscoveryV1SearchSnapshot, SearchPreviewView } from '../data/discoveryV1SearchOwner';
import { discoveryV1SearchPreviewKey } from '../data/discoveryV1SearchOwner';
import { DiscoveryPresentation } from '../ui/v2/DiscoveryPresentation';
import { DiscoveryPeek } from '../ui/v2/discovery/DiscoveryPeek';
import { DiscoverySearchPanel, type PanelMode } from '../ui/v2/discovery/DiscoverySearchPanel';
import type { RecentSearch } from '../ui/v2/discovery/recentSearches';
import { DistanceFromContext, type DistanceFrom } from '../ui/v2/discovery/taskDistance';
import { PublicNeedPresentation } from '../ui/v2/PublicNeedPresentation';
import { TaskCard } from '../ui/v2/TaskCard';
import { TaskAgeContext } from '../ui/v2/discovery/taskAge';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { layout } from '../ui/system/layout';
import { sys } from '../ui/system/tokens';

/**
 * The family of Zadaci on fixtures, for the design lab and for the internal build: uskociapp://dizajn-zadaci?scene=kartice.
 * Nothing here reads or writes anything: every task is an example, every command is inert, and a store build shows nothing.
 *
 * Scenes: `kartice` is the list card in every state it meets (an amount, offers, no price, a long title, a long name, a condition,
 * a task of mine, one applied to), `kartice-veliki` the same at large text; `lista` is the whole screen (map under a list sheet)
 * with `n` tasks (1, 6, 8, 40, 1000), at the height `sheet` says (`peek`, `half`, `full`; the default is where the screen starts by itself), with the
 * card of the pin `pin` (a task's id, `m1`) standing at the bottom, and at large text with `large=1` (the lab has no text size of its own: this draws
 * the stacked layout the screen takes at 1,3); the lab draws a SKETCH of the map (not geography), and the bottom navigation is the real route's, so
 * its coming and going is looked at on `/zadaci` itself. `lista-prazno`, `lista-ucitavanje` and `lista-greska` are its three other states; `detalj` is the
 * task opened, with `detalj-veliki`, `detalj-prijavljen` (an application already sent), `detalj-moj` (my own task),
 * `detalj-zatvoren` (full places), `detalj-ucitavanje`, `detalj-greska` and `detalj-nedostupan`, and `detalj-uklapanje` (the two quiet rows of what my own plans and
 * work area say about it). `lista-za-mene` is the list with the "Svi zadaci | Za mene" switch on, `lista-za-mene-odbijeno` the line that says why it was refused
 * (no active work profile). The panel is two things (the approved plan, U4 and U5): `pretraga` is the SEARCH, which fills the screen (the field "Šta tražiš", "Gde" with
 * the server's cities and their counts, "Na daljinu · N", the popular cities that have none, and what was searched before; a city that leads to its parts is tapped to see
 * them), `pretraga-sta` the same with a word already typed; `filteri` is the FILTERS, a sheet from the bottom (Kada, Gde, Iznos and the foot "Očisti" + "Prikaži N zadataka"),
 * `filteri-izabrano` with a day and an amount chosen, and `pretraga-kada` is its older name. `kartica-na-mapi` is the card of a chosen pin (the same face as the list card),
 * `kartica-na-mapi-dugo` with a long title and a long name; `kartice`, `kartice-veliki`, `kartica-na-mapi` and `kartica-na-mapi-dugo` take `near=1`: the person has said where
 * they are ("Moja lokacija"), so the place says how far the task is ("Liman, Novi Sad · oko 3 km"). `detalj-ponude` is a task that takes offers (its one action is "Pošalji
 * ponudu", the fixed price's is "Pošalji prijavu").
 */
const SCENES = ['kartice', 'kartice-veliki', 'lista', 'lista-prazno', 'lista-ucitavanje', 'lista-greska', 'detalj', 'detalj-veliki', 'detalj-prijavljen',
  'detalj-moj', 'detalj-zatvoren', 'detalj-ucitavanje', 'detalj-greska', 'detalj-nedostupan', 'detalj-uklapanje', 'lista-za-mene', 'lista-za-mene-odbijeno',
  'pretraga', 'pretraga-sta', 'filteri', 'filteri-izabrano', 'pretraga-kada', 'kartica-na-mapi', 'kartica-na-mapi-dugo', 'detalj-ponude'] as const;
type Scene = typeof SCENES[number];
const noop = () => {};

/** The requirements of a task that asks for nothing, and a patch over it. */
const rules = (patch: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection['zahtevi'] => ({ vestine: [], alati: [], vozila: [], dozvole: [],
  bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch });
type Seed = Partial<PrilikaProjekcija> & Pick<PrilikaProjekcija, 'id' | 'naslov'>;
const task = (seed: Seed): PrilikaProjekcija => ({
  statusTekst: 'Otvoren', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Liman, Novi Sad', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-12T08:00:00Z', endsAt: '2026-10-12T10:00:00Z' }, vremeTekst: '12. okt · 10:00–12:00',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], narucilacProfilId: `profil-${seed.id}`, narucilacAvatarId: null,
  narucilacIme: 'Marija Ilić', narucilacOcena: '4,7', narucilacBrojOcena: 3, priblizno: { lat: 45.25, lng: 19.84 }, rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
  ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: novac(6000) },
  detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules() }, ...seed });

const FIXTURES: PrilikaProjekcija[] = [
  task({ id: 'a1', naslov: 'Unos ormara na treći sprat', opis: 'Ormar je rasklopljen u kutijama, u prizemlju zgrade. Treba ga uneti na treći sprat i ostaviti u sobi. Zgrada nema lift.',
    detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY',
      zahtevi: rules({ bitniUslovi: ['Zgrada bez lifta'], alati: ['Trake za nošenje'] }) } }),
  task({ id: 'a2', naslov: 'Košenje travnjaka u dvorištu', podrucjeTekst: 'Telep, Novi Sad', priblizno: { lat: 45.24, lng: 19.8 }, rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null,
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Dragan Petrović', narucilacOcena: null, narucilacBrojOcena: 0,
    schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-10-12T00:00:00Z', endsAt: '2026-10-18T21:00:00Z' }, vremeTekst: 'Ove nedelje' }),
  task({ id: 'a3', naslov: 'Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara', podrucjeTekst: 'Grbavica, Novi Sad', priblizno: { lat: 45.24, lng: 19.83 },
    pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 }, osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 3500, valuta: 'RSD', prikaz: novac(3500) },
    narucilacIme: 'Aleksandra Stojanović-Petrović', narucilacOcena: '4,9', narucilacBrojOcena: 128,
    detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ vozila: ['Kombi'] }) } }),
  task({ id: 'a4', naslov: 'Prevod kratkog uputstva na engleski', podrucjeTekst: 'Na daljinu', priblizno: null, rezimCene: 'MY_PRICE', osnovaCene: null,
    ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: novac(2500) }, pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 },
    detalji: { kategorija: 'Administrativna pomoć', geografija: { mode: 'REMOTE' }, rezimLokacije: 'REMOTE', zahtevi: rules() },
    schedule: { kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null }, vremeTekst: 'Po dogovoru' }),
  task({ id: 'a5', naslov: 'Šetnja psa u kraju', podrucjeTekst: 'Detelinara, Novi Sad', priblizno: { lat: 45.27, lng: 19.81 }, rezimCene: 'MY_PRICE', ponudjenaCena: undefined, osnovaCene: null,
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Jelena N.', narucilacOcena: '5,0', narucilacBrojOcena: 1,
    schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null }, vremeTekst: 'Danas, fleksibilno' }),
  task({ id: 'a6', naslov: 'Montaža dve police', podrucjeTekst: 'Novo naselje, Novi Sad', priblizno: { lat: 45.28, lng: 19.82 }, ponudjenaCena: { iznos: 1800, valuta: 'RSD', prikaz: novac(1800) },
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Nikola Ilić', narucilacOcena: '4,2', narucilacBrojOcena: 14,
    detalji: { kategorija: 'Montaža', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ alati: ['Bušilica'] }) } }),
];
const AGES: Record<string, string> = { a1: 'pre 2 dana', a2: 'Upravo', a3: 'pre 3 sata', a4: 'juče', a5: 'pre 25 min', a6: 'pre 2 nedelje' };

/**
 * Tasks with their points spread over a city, in the shapes the real list meets: mapped, remote, and placed nowhere (a task with a place's name and
 * no point on the map, one in five and one in seven, so a list of eight has three that are not on the map).
 */
function many(count: number): PrilikaProjekcija[] {
  return Array.from({ length: count }, (_, index) => {
    const base = FIXTURES[index % FIXTURES.length];
    const remote = base.detalji?.rezimLokacije === 'REMOTE';
    const nowhere = index % 5 === 4 || index % 7 === 6;
    return { ...base, id: `m${index}`, naslov: index < FIXTURES.length ? base.naslov : `${base.naslov} · ${String(index + 1).padStart(4, '0')}`,
      narucilacProfilId: `profil-m${index}`,
      priblizno: remote || nowhere ? null : { lat: Number((45.2 + (index % 17) * .01).toFixed(2)), lng: Number((19.78 + (Math.floor(index / 17) % 9) * .02).toFixed(2)) } };
  });
}

const RELATION_NONE: TaskRelation = { kind: 'NONE' };
/** Where a person who asked for "Moja lokacija" stands (the scenes that take `near=1`): the tasks above are 1 to 3 km from here. */
const ME: DistanceFrom = [19.835, 45.255];

function List({ items, loading = false, error = false, forMe = false, refused = false, sheet, pin, large = false }: {
  items: PrilikaProjekcija[]; loading?: boolean; error?: boolean; forMe?: boolean; refused?: boolean;
  /** Where the list rests when the scene opens (otherwise where the screen starts by itself), and the task whose pin's card stands at the bottom. */
  sheet?: MarketplaceView['sheet']; pin?: string; large?: boolean;
}) {
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map', ...(forMe ? { forMe: true } : {}),
    ...(sheet ? { sheet } : {}), ...(pin ? { selectedId: pin, sheet: 'peek' as const } : {}) }));
  const relations = useMemo(() => taskRelationIndex([], items.map(item => item.id)), [items]);
  const screen = <DiscoveryPresentation items={items as readonly MarketplaceItem[]} loading={loading} error={error} scopeKey={`gallery:${items.length}`}
    view={view} onView={setView} onOpen={noop} onRefresh={noop} onProfile={noop} onNew={noop} onNotifications={noop} relations={relations}
    // The build the owner holds has the switch: "Za mene" is a capsule in the row whenever the scene is a list (on in `lista-za-mene`).
    forMeAvailable forMeRefused={refused} onWorkProfile={noop} onDismissForMeRefused={noop} />;
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{screen}</LayoutClassOverride.Provider> : screen;
}

/** The search panel over the server's cities (and, with letters typed, the parts of a city). A fixed "now" keeps the days of its calendar still. */
const CITIES = [{ key: 'novi sad', text: 'Novi Sad', count: 23 }, { key: 'beograd', text: 'Beograd', count: 13 }, { key: 'subotica', text: 'Subotica', count: 4 }, { key: 'niš', text: 'Niš', count: 2 }];
const PARTS = [{ key: 'liman, novi sad', text: 'Liman, Novi Sad', count: 9 }, { key: 'limanski park, novi sad', text: 'Limanski park, Novi Sad', count: 2 }];
/** The visible part of the map the search is opened over: its key is the one the snapshot answers for. */
const AREA: PublicBounds = [19.7, 45.2, 19.9, 45.3];
/** What this person searched before (newest first): a word and a place, a word, a place. */
const RECENT: readonly RecentSearch[] = [{ query: 'selidba', place: 'Novi Sad' }, { query: 'farbanje', place: null }, { query: '', place: 'Beograd' }];
const NO_RECENT: readonly RecentSearch[] = [];
const NO_PATCH: Partial<MarketplaceView> = {};
function Panel({ mode, patch = NO_PATCH, recent = NO_RECENT }: { mode: PanelMode; patch?: Partial<MarketplaceView>; recent?: readonly RecentSearch[] }) {
  const view = useMemo<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map', ...patch }), [patch]);
  const [letters, setLetters] = useState('');
  const snapshot = useMemo<DiscoveryV1SearchSnapshot>(() => ({ active: true, generation: 1, key: discoveryV1SearchPreviewKey({ ...view, placeSearch: letters } as SearchPreviewView, AREA), status: 'ready',
    count: 41, undated: 0, availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
    places: letters ? CITIES.filter(city => city.text.toLowerCase().includes(letters.toLowerCase())) : CITIES, parts: letters ? PARTS : [],
    placeHasMore: false, placePaging: false, everywhere: 41, inMapArea: 7, facetError: false }), [view, letters]);
  return <DiscoverySearchPanel items={[]} view={view} mine={undefined} now={new Date('2026-10-12T08:00:00Z')} mapArea={AREA} mode={mode} reduced={false} recent={recent}
    p6Search={{ snapshot, onDraft: (draft: { placeSearch?: string }) => setLetters(draft.placeSearch ?? ''), onNextPlaces: noop }} onApply={noop} onClose={noop} />;
}
const WORD_TYPED: Partial<MarketplaceView> = { query: 'selidba' };
const FILTERS_CHOSEN: Partial<MarketplaceView> = { when: 'weekend', price: 'MY_PRICE' };

function Cards({ large, near = false }: { large: boolean; near?: boolean }) {
  const cards = [
    { item: FIXTURES[0] }, { item: FIXTURES[1] }, { item: FIXTURES[2] }, { item: FIXTURES[3] },
    { item: FIXTURES[4], relation: 'APPLIED' as const }, { item: FIXTURES[5], relation: 'OWNED' as const },
  ];
  const body = <TaskAgeContext.Provider value={id => AGES[id] ?? null}><DistanceFromContext.Provider value={near ? ME : null}>
    <SafeAreaView edges={['top']} style={s.screen}>
      <ScrollView contentContainerStyle={s.list}>
        {cards.map(({ item, relation }) => <TaskCard key={item.id} item={item} relation={relation} onOpen={noop} />)}
      </ScrollView>
    </SafeAreaView>
  </DistanceFromContext.Provider></TaskAgeContext.Provider>;
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body;
}

/** The card of a chosen pin over the map's ground, as the map draws it (the map itself is not part of this scene). */
function Peek({ item, relation, near = false }: { item: PrilikaProjekcija; relation?: TaskCardRelation; near?: boolean }) {
  return <TaskAgeContext.Provider value={id => AGES[id] ?? null}><DistanceFromContext.Provider value={near ? ME : null}>
    <SafeAreaView edges={['top']} style={s.map}>
      <DiscoveryPeek item={item as MarketplaceItem} place={[]} relation={() => relation} active bottomInset={sys.space.md} reduced={false}
        onOpen={noop} onShowPlace={noop} onClose={noop} />
    </SafeAreaView>
  </DistanceFromContext.Provider></TaskAgeContext.Provider>;
}

type DetailState = { loading?: boolean; error?: boolean; missing?: boolean; relation?: TaskRelation; canApply?: boolean; need?: PrilikaProjekcija | null; fit?: { overlapTitle?: string; distanceKm?: number };
  /** What the public work-trust read would say about the person who posted it; only the gallery makes it up. */ reliabilityPercent?: number };
function Detail({ large, state = {} }: { large: boolean; state?: DetailState }) {
  const need = state.need === undefined ? FIXTURES[0] : state.need;
  const body = <PublicNeedPresentation need={need} loading={!!state.loading} error={!!state.error} missing={!!state.missing} stale={false} busy={false}
    canApply={state.canApply ?? true} canRetry back={noop} retry={noop} apply={noop} relation={state.relation ?? RELATION_NONE} onOwnTask={noop}
    onOwnApplication={noop} onOtherTasks={noop} onRequesterProfile={noop} fit={state.fit} reliabilityPercent={state.reliabilityPercent} />;
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body;
}

export default function DizajnZadaci() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string; n?: string; sheet?: string; pin?: string; large?: string; near?: string }>();
  if (!internal) return <View style={s.screen} />;
  const scene: Scene = (SCENES as readonly string[]).includes(params.scene ?? '') ? params.scene as Scene : 'kartice';
  const n = [1, 6, 8, 40, 1000].includes(Number(params.n)) ? Number(params.n) : 6;
  const sheet = (['peek', 'half', 'full'] as const).find(name => name === params.sheet);
  const pin = typeof params.pin === 'string' && /^m\d{1,4}$/.test(params.pin) ? params.pin : undefined;
  const near = params.near === '1';
  switch (scene) {
    case 'kartice': return <Cards large={false} near={near} />;
    case 'kartice-veliki': return <Cards large near={near} />;
    case 'lista': return <List items={many(n)} sheet={sheet} pin={pin} large={params.large === '1'} />;
    case 'lista-prazno': return <List items={[]} />;
    case 'lista-ucitavanje': return <List items={[]} loading />;
    case 'lista-greska': return <List items={[]} error />;
    case 'detalj': return <Detail large={false} state={{ reliabilityPercent: 90 }} />;
    case 'detalj-veliki': return <Detail large />;
    case 'detalj-prijavljen': return <Detail large={false} state={{ relation: { kind: 'APPLIED', applicationId: 'prijava-1', agreementId: null } }} />;
    case 'detalj-moj': return <Detail large={false} state={{ relation: { kind: 'OWNER' } }} />;
    case 'detalj-zatvoren': return <Detail large={false} state={{ canApply: false,
      need: task({ ...FIXTURES[0], pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }) }} />;
    case 'detalj-ucitavanje': return <Detail large={false} state={{ loading: true, need: null }} />;
    case 'detalj-greska': return <Detail large={false} state={{ error: true, need: null }} />;
    case 'detalj-nedostupan': return <Detail large={false} state={{ missing: true, need: null }} />;
    case 'detalj-uklapanje': return <Detail large={false} state={{ fit: { overlapTitle: 'Montaža police u Detelinari', distanceKm: 8.4 } }} />;
    case 'lista-za-mene': return <List items={many(2)} forMe />;
    case 'lista-za-mene-odbijeno': return <List items={many(n)} refused />;
    case 'pretraga': return <Panel mode="search" recent={RECENT} />;
    case 'pretraga-sta': return <Panel mode="search" patch={WORD_TYPED} recent={RECENT} />;
    case 'filteri':
    case 'pretraga-kada': return <Panel mode="filters" />;
    case 'filteri-izabrano': return <Panel mode="filters" patch={FILTERS_CHOSEN} />;
    case 'kartica-na-mapi': return <Peek item={FIXTURES[0]} near={near} />;
    case 'kartica-na-mapi-dugo': return <Peek item={FIXTURES[2]} relation="APPLIED" near={near} />;
    case 'detalj-ponude': return <Detail large={false} state={{ need: FIXTURES[1] }} />;
  }
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  map: { flex: 1, backgroundColor: sys.map.ground },
  // The list's own measure: the edge of every screen and 12 between records.
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, gap: layout.group },
});
