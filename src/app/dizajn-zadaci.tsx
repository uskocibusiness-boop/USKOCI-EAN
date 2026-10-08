import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import type { NeedDetailProjection, PrilikaProjekcija } from '../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../data/marketplaceView';
import { taskRelationIndex, type TaskRelation } from '../data/taskRelation';
import { novac } from '../lib/novac';
import type { DiscoveryV1SearchSnapshot, SearchPreviewView } from '../data/discoveryV1SearchOwner';
import { discoveryV1SearchPreviewKey } from '../data/discoveryV1SearchOwner';
import { DiscoveryPresentation } from '../ui/v2/DiscoveryPresentation';
import { DiscoverySearchPanel, type SearchStep } from '../ui/v2/discovery/DiscoverySearchPanel';
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
 * with `n` tasks (1, 6, 40, 1000), `lista-prazno`, `lista-ucitavanje` and `lista-greska` its three other states; `detalj` is the
 * task opened, with `detalj-veliki`, `detalj-prijavljen` (an application already sent), `detalj-moj` (my own task),
 * `detalj-zatvoren` (full places), `detalj-ucitavanje`, `detalj-greska` and `detalj-nedostupan`, and `detalj-uklapanje` (the two quiet rows of what my own plans and
 * work area say about it). `lista-za-mene` is the list with the "Svi zadaci | Za mene" switch on, `lista-za-mene-odbijeno` the line that says why it was refused
 * (no active work profile). `pretraga` is the search panel over the server's city list (letters typed into "Gde" bring the parts of a city under the cities, as the server would),
 * `pretraga-kada` and `pretraga-sta` with that section open.
 */
const SCENES = ['kartice', 'kartice-veliki', 'lista', 'lista-prazno', 'lista-ucitavanje', 'lista-greska', 'detalj', 'detalj-veliki', 'detalj-prijavljen',
  'detalj-moj', 'detalj-zatvoren', 'detalj-ucitavanje', 'detalj-greska', 'detalj-nedostupan', 'detalj-uklapanje', 'lista-za-mene', 'lista-za-mene-odbijeno',
  'pretraga', 'pretraga-kada', 'pretraga-sta'] as const;
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
  task({ id: 'a2', naslov: 'Košenje travnjaka u dvorištu', podrucjeTekst: 'Telep, Novi Sad', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null,
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Dragan Petrović', narucilacOcena: null, narucilacBrojOcena: 0,
    schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-10-12T00:00:00Z', endsAt: '2026-10-18T21:00:00Z' }, vremeTekst: 'Ove nedelje' }),
  task({ id: 'a3', naslov: 'Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara', podrucjeTekst: 'Grbavica, Novi Sad',
    pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 }, osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 3500, valuta: 'RSD', prikaz: novac(3500) },
    narucilacIme: 'Aleksandra Stojanović-Petrović', narucilacOcena: '4,9', narucilacBrojOcena: 128,
    detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ vozila: ['Kombi'] }) } }),
  task({ id: 'a4', naslov: 'Prevod kratkog uputstva na engleski', podrucjeTekst: 'Na daljinu', priblizno: null, rezimCene: 'MY_PRICE', osnovaCene: null,
    ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: novac(2500) }, pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 },
    detalji: { kategorija: 'Administrativna pomoć', geografija: { mode: 'REMOTE' }, rezimLokacije: 'REMOTE', zahtevi: rules() },
    schedule: { kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null }, vremeTekst: 'Po dogovoru' }),
  task({ id: 'a5', naslov: 'Šetnja psa u kraju', podrucjeTekst: 'Detelinara, Novi Sad', rezimCene: 'MY_PRICE', ponudjenaCena: undefined, osnovaCene: null,
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Jelena N.', narucilacOcena: '5,0', narucilacBrojOcena: 1,
    schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null }, vremeTekst: 'Danas, fleksibilno' }),
  task({ id: 'a6', naslov: 'Montaža dve police', podrucjeTekst: 'Novo naselje, Novi Sad', ponudjenaCena: { iznos: 1800, valuta: 'RSD', prikaz: novac(1800) },
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Nikola Ilić', narucilacOcena: '4,2', narucilacBrojOcena: 14,
    detalji: { kategorija: 'Montaža', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ alati: ['Bušilica'] }) } }),
];
const AGES: Record<string, string> = { a1: 'pre 2 dana', a2: 'Upravo', a3: 'pre 3 sata', a4: 'juče', a5: 'pre 25 min', a6: 'pre 2 nedelje' };

/** Tasks with their points spread over a city, in the shapes the real list meets: mapped, remote, with no point. */
function many(count: number): PrilikaProjekcija[] {
  return Array.from({ length: count }, (_, index) => {
    const base = FIXTURES[index % FIXTURES.length];
    const remote = base.detalji?.rezimLokacije === 'REMOTE';
    return { ...base, id: `m${index}`, naslov: index < FIXTURES.length ? base.naslov : `${base.naslov} · ${String(index + 1).padStart(4, '0')}`,
      narucilacProfilId: `profil-m${index}`,
      priblizno: remote ? null : { lat: Number((45.2 + (index % 17) * .01).toFixed(2)), lng: Number((19.78 + (Math.floor(index / 17) % 9) * .02).toFixed(2)) } };
  });
}

const RELATION_NONE: TaskRelation = { kind: 'NONE' };

function List({ items, loading = false, error = false, forMe = false, refused = false }: { items: PrilikaProjekcija[]; loading?: boolean; error?: boolean; forMe?: boolean; refused?: boolean }) {
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map', ...(forMe ? { forMe: true } : {}) }));
  const relations = useMemo(() => taskRelationIndex([], items.map(item => item.id)), [items]);
  return <DiscoveryPresentation items={items as readonly MarketplaceItem[]} loading={loading} error={error} scopeKey={`gallery:${items.length}`}
    view={view} onView={setView} onOpen={noop} onRefresh={noop} onProfile={noop} onNew={noop} onNotifications={noop} relations={relations}
    forMeAvailable={forMe || refused} forMeRefused={refused} onWorkProfile={noop} onDismissForMeRefused={noop} />;
}

/** The search panel over the server's cities (and, with letters typed, the parts of a city). A fixed "now" keeps the days of its calendar still. */
const CITIES = [{ key: 'novi sad', text: 'Novi Sad', count: 23 }, { key: 'beograd', text: 'Beograd', count: 13 }, { key: 'subotica', text: 'Subotica', count: 4 }, { key: 'niš', text: 'Niš', count: 2 }];
const PARTS = [{ key: 'liman, novi sad', text: 'Liman, Novi Sad', count: 9 }, { key: 'limanski park, novi sad', text: 'Limanski park, Novi Sad', count: 2 }];
function Search({ start }: { start: SearchStep }) {
  const view = useMemo<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }), []);
  const [letters, setLetters] = useState('');
  const snapshot = useMemo<DiscoveryV1SearchSnapshot>(() => ({ active: true, generation: 1, key: discoveryV1SearchPreviewKey({ ...view, placeSearch: letters } as SearchPreviewView, null), status: 'ready',
    count: 41, undated: 0, availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
    places: letters ? CITIES.filter(city => city.text.toLowerCase().includes(letters.toLowerCase())) : CITIES, parts: letters ? PARTS : [],
    placeHasMore: false, placePaging: false, everywhere: 41, inMapArea: null, facetError: false }), [view, letters]);
  return <DiscoverySearchPanel items={[]} view={view} mine={undefined} now={new Date('2026-10-12T08:00:00Z')} mapArea={null} start={start} reduced={false}
    p6Search={{ snapshot, onDraft: (draft: { placeSearch?: string }) => setLetters(draft.placeSearch ?? ''), onNextPlaces: noop }} canNearby onApply={noop} onClose={noop} />;
}

function Cards({ large }: { large: boolean }) {
  const cards = [
    { item: FIXTURES[0] }, { item: FIXTURES[1] }, { item: FIXTURES[2] }, { item: FIXTURES[3] },
    { item: FIXTURES[4], relation: 'APPLIED' as const }, { item: FIXTURES[5], relation: 'OWNED' as const },
  ];
  const body = <TaskAgeContext.Provider value={id => AGES[id] ?? null}>
    <SafeAreaView edges={['top']} style={s.screen}>
      <ScrollView contentContainerStyle={s.list}>
        {cards.map(({ item, relation }) => <TaskCard key={item.id} item={item} relation={relation} onOpen={noop} />)}
      </ScrollView>
    </SafeAreaView>
  </TaskAgeContext.Provider>;
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body;
}

type DetailState = { loading?: boolean; error?: boolean; missing?: boolean; relation?: TaskRelation; canApply?: boolean; need?: PrilikaProjekcija | null; fit?: { overlapTitle?: string; distanceKm?: number } };
function Detail({ large, state = {} }: { large: boolean; state?: DetailState }) {
  const need = state.need === undefined ? FIXTURES[0] : state.need;
  const body = <PublicNeedPresentation need={need} loading={!!state.loading} error={!!state.error} missing={!!state.missing} stale={false} busy={false}
    canApply={state.canApply ?? true} canRetry back={noop} retry={noop} apply={noop} relation={state.relation ?? RELATION_NONE} onOwnTask={noop}
    onOwnApplication={noop} onOtherTasks={noop} onRequesterProfile={noop} fit={state.fit} />;
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body;
}

export default function DizajnZadaci() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string; n?: string }>();
  if (!internal) return <View style={s.screen} />;
  const scene: Scene = (SCENES as readonly string[]).includes(params.scene ?? '') ? params.scene as Scene : 'kartice';
  const n = [1, 6, 40, 1000].includes(Number(params.n)) ? Number(params.n) : 6;
  switch (scene) {
    case 'kartice': return <Cards large={false} />;
    case 'kartice-veliki': return <Cards large />;
    case 'lista': return <List items={many(n)} />;
    case 'lista-prazno': return <List items={[]} />;
    case 'lista-ucitavanje': return <List items={[]} loading />;
    case 'lista-greska': return <List items={[]} error />;
    case 'detalj': return <Detail large={false} />;
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
    case 'pretraga': return <Search start="gde" />;
    case 'pretraga-kada': return <Search start="kada" />;
    case 'pretraga-sta': return <Search start="sta" />;
  }
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // The list's own measure: the edge of every screen and 12 between records.
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, gap: layout.group },
});
