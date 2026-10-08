import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { PrilikaProjekcija } from '../contracts/projections';
import type { DiscoveryV1SearchSnapshot, SearchPreviewView } from '../data/discoveryV1SearchOwner';
import { discoveryV1SearchPreviewKey } from '../data/discoveryV1SearchOwner';
import { initialMarketplaceView, type MarketplaceView } from '../data/marketplaceView';
import type { TaskRelation } from '../data/taskRelation';
import { T } from '../ui/Text';
import { ListRow } from '../ui/system/ListRow';
import { Section } from '../ui/system/Section';
import { layout } from '../ui/system/layout';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { PublicNeedPresentation } from '../ui/v2/PublicNeedPresentation';
import { TaskCard } from '../ui/v2/TaskCard';
import { DiscoveryPeek } from '../ui/v2/discovery/DiscoveryPeek';
import { DiscoverySearchPanel, type SearchStep } from '../ui/v2/discovery/DiscoverySearchPanel';
import { useTaskRecord } from '../ui/v2/discovery/TaskRecordBody';
import { TaskAgeContext } from '../ui/v2/discovery/taskAge';
import { DetaljA } from '../ui/varijante/V2/DetaljA';
import { DetaljB } from '../ui/varijante/V2/DetaljB';
import { DetaljC } from '../ui/varijante/V2/DetaljC';
import { KarticaA, KarticaATelo } from '../ui/varijante/V2/KarticaA';
import { KarticaB, KarticaBTelo } from '../ui/varijante/V2/KarticaB';
import { KarticaC, KarticaCTelo } from '../ui/varijante/V2/KarticaC';
import { PretragaA } from '../ui/varijante/V2/PretragaA';
import { PretragaB } from '../ui/varijante/V2/PretragaB';
import { PretragaC } from '../ui/varijante/V2/PretragaC';
import { DELOVI_LIMAN, GRADOVI, ODNOS, POUZDANOST, SADA, SVUDA_BROJ, ZADACI, ZADATAK_DUG, razlogZa, starostOd } from '../ui/varijante/V2/fixtures';
import { ListaOkvir, PeekOkvir, TrakaTabova } from '../ui/varijante/V2/shared';

/**
 * Laboratorija varijanti grupe V2 (kreativni pravac „Preko stola“, 8. okt 2026): kartica i lista Zadataka sa karticom pina, detalj zadatka i
 * pretraga, svaka u tri varijante koje se razlikuju po STRUKTURI (A iz predmeta/osobe, B iz broja/reči, C iz pokreta) i u današnjem obliku
 * (`sada`), na istim lažnim podacima. Samo interno izdanje: ništa ne čita ni ne piše, svaka komanda nema, a izdanje za prodavnicu pokazuje
 * „Nije dostupno.“. Adresa: /dizajn-var-V2?scene=<ekran>-<A|B|C|sada>[-<stanje>]&kadar=<ms> (kadar zamrzava pokret za niz snimaka).
 */
type Ekran = 'kartica' | 'peek' | 'detalj' | 'pretraga';
type Varijanta = 'sada' | 'A' | 'B' | 'C';
type Stanje = 'dugo' | 'veliki' | 'ponude' | 'pokret' | 'kada';
const EKRANI: readonly Ekran[] = ['kartica', 'peek', 'detalj', 'pretraga'];
const VARIJANTE: readonly Varijanta[] = ['sada', 'A', 'B', 'C'];
const STANJA: readonly Stanje[] = ['dugo', 'veliki', 'ponude', 'pokret', 'kada'];
/** Koja stanja koji ekran ima, da spisak scena ne obećava ono čega nema. */
const STANJA_EKRANA: Record<Ekran, readonly Stanje[]> = { kartica: ['dugo', 'veliki', 'pokret'], peek: [], detalj: ['dugo', 'ponude', 'veliki', 'pokret'], pretraga: ['kada', 'pokret'] };
const NAZIV: Record<Ekran, string> = { kartica: 'Kartica i lista', peek: 'Kartica pina na mapi', detalj: 'Detalj zadatka', pretraga: 'Pretraga' };
const IME_VARIJANTE: Record<Ekran, Record<Varijanta, string>> = {
  kartica: { sada: 'Sada', A: 'Etiketa', B: 'Cena vodi', C: 'Osoba govori' },
  peek: { sada: 'Sada', A: 'Etiketa', B: 'Cena vodi', C: 'Osoba govori' },
  detalj: { sada: 'Sada', A: 'Objavio kao kartica poverenja', B: 'Traka činjenica', C: 'Prvo osoba, pa odgovor' },
  pretraga: { sada: 'Sada', A: 'Gradovi brojem', B: 'Pilula kao rečenica', C: 'Korak po korak' },
};

type Scena = { ekran: Ekran; varijanta: Varijanta; stanje?: Stanje };
export function parseScene(value: unknown): Scena | null {
  if (typeof value !== 'string') return null;
  const [ekran, varijanta, stanje, extra] = value.split('-');
  if (extra !== undefined || !(EKRANI as readonly string[]).includes(ekran) || !(VARIJANTE as readonly string[]).includes(varijanta)) return null;
  if (stanje !== undefined && (!(STANJA as readonly string[]).includes(stanje) || varijanta === 'sada')) return null;
  const scena: Scena = { ekran: ekran as Ekran, varijanta: varijanta as Varijanta };
  if (stanje) scena.stanje = stanje as Stanje;
  if (scena.stanje && !STANJA_EKRANA[scena.ekran].includes(scena.stanje)) return null;
  // Pokret ima samo varijanta C (kartica, detalj, pretraga); „veliki“ detalj samo B (traka u jednoj koloni).
  if (scena.stanje === 'pokret' && scena.varijanta !== 'C') return null;
  if (scena.ekran === 'detalj' && scena.stanje === 'veliki' && scena.varijanta !== 'B') return null;
  return scena;
}
export const sceneId = (scena: Scena) => [scena.ekran, scena.varijanta, scena.stanje].filter(Boolean).join('-');
/** Svaka scena koju ruta ume da nacrta, za spisak i za pušački test. */
export const SVE_SCENE: string[] = EKRANI.flatMap(ekran => VARIJANTE.flatMap(varijanta => [
  sceneId({ ekran, varijanta }),
  ...(varijanta === 'sada' ? [] : STANJA_EKRANA[ekran].map(stanje => sceneId({ ekran, varijanta, stanje }))),
])).filter(id => parseScene(id) !== null);

const noop = () => undefined;
const RELATION_NONE: TaskRelation = { kind: 'NONE' };
const ZADACI_DUGO: PrilikaProjekcija[] = [ZADATAK_DUG, ZADACI[2], ZADACI[1]];

/* ------------------------------------------------------------------------------------------------------- kartica */

function Lista({ varijanta, items, nova = false, kadar }: { varijanta: Varijanta; items: PrilikaProjekcija[]; nova?: boolean; kadar?: number }) {
  return <TaskAgeContext.Provider value={starostOd}>
    <ListaOkvir count={items.length}>
      {items.map((item, index) => {
        const relation = ODNOS[item.id];
        switch (varijanta) {
          case 'sada': return <TaskCard key={item.id} item={item} relation={relation} onOpen={noop} />;
          case 'A': return <KarticaA key={item.id} item={item} relation={relation} razlog={razlogZa(item)} onOpen={noop} />;
          case 'B': return <KarticaB key={item.id} item={item} relation={relation} onOpen={noop} />;
          case 'C': return <KarticaC key={item.id} item={item} relation={relation} onOpen={noop} nova={nova && index === 0} kadar={nova && index === 0 ? kadar : undefined} />;
        }
      })}
    </ListaOkvir>
  </TaskAgeContext.Provider>;
}

/** Nova kartica stiže dok gledaš: lista bez prve, pa posle kratkog čekanja prva uskače odozgo (C). Sa `kadar` je zamrznuta u tom trenutku. */
function ListaPokret({ kadar }: { kadar?: number }) {
  const [stigla, setStigla] = useState(kadar !== undefined);
  useEffect(() => {
    if (stigla) return;
    // 700 ms: dovoljno da se lista prvo vidi mirna, pa da nova kartica uskoči; nije token pokreta nego scenario laboratorije.
    const timer = setTimeout(() => setStigla(true), 700);
    return () => clearTimeout(timer);
  }, [stigla]);
  return <Lista varijanta="C" items={stigla ? ZADACI : ZADACI.slice(1)} nova kadar={kadar} />;
}

function PeekTelo({ varijanta, item }: { varijanta: Exclude<Varijanta, 'sada'>; item: PrilikaProjekcija }) {
  const model = useTaskRecord(item, ODNOS[item.id]);
  switch (varijanta) {
    case 'A': return <KarticaATelo model={model} razlog={razlogZa(item)} clearOfClose />;
    case 'B': return <KarticaBTelo model={model} clearOfClose />;
    case 'C': return <KarticaCTelo model={model} clearOfClose />;
  }
}

function Peek({ varijanta }: { varijanta: Varijanta }) {
  const item = ZADACI[0];
  if (varijanta === 'sada') return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.mapa}>
      <DiscoveryPeek item={item} place={[]} relation={task => ODNOS[task.id]} active bottomInset={sys.space.md} reduced={false}
        onOpen={noop} onShowPlace={noop} onClose={noop} />
    </View>
    <TrakaTabova />
  </SafeAreaView>;
  return <TaskAgeContext.Provider value={starostOd}><PeekOkvir><PeekTelo varijanta={varijanta} item={item} /></PeekOkvir></TaskAgeContext.Provider>;
}

/* -------------------------------------------------------------------------------------------------------- detalj */

function Detalj({ varijanta, need, kadar }: { varijanta: Varijanta; need: PrilikaProjekcija; kadar?: number }) {
  switch (varijanta) {
    case 'sada': return <PublicNeedPresentation need={need} loading={false} error={false} missing={false} stale={false} busy={false} canApply canRetry
      back={noop} retry={noop} apply={noop} relation={RELATION_NONE} onOwnTask={noop} onOwnApplication={noop} onOtherTasks={noop} onRequesterProfile={noop} />;
    case 'A': return <DetaljA need={need} pouzdanost={POUZDANOST[need.narucilacProfilId] ?? null} />;
    case 'B': return <DetaljB need={need} />;
    case 'C': return <DetaljC need={need} kadar={kadar} />;
  }
}

/* ------------------------------------------------------------------------------------------------------ pretraga */

/** Današnja pretraga nad serverskom listom gradova, kao u galeriji Zadataka. */
function PretragaSada({ start }: { start: SearchStep }) {
  const view = useMemo<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }), []);
  const [letters, setLetters] = useState('');
  const snapshot = useMemo<DiscoveryV1SearchSnapshot>(() => ({ active: true, generation: 1, key: discoveryV1SearchPreviewKey({ ...view, placeSearch: letters } as SearchPreviewView, null), status: 'ready',
    count: SVUDA_BROJ, undated: 0, availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
    places: letters ? GRADOVI.filter(city => city.text.toLowerCase().includes(letters.toLowerCase())) : GRADOVI, parts: letters ? DELOVI_LIMAN : [],
    placeHasMore: false, placePaging: false, everywhere: SVUDA_BROJ, inMapArea: null, facetError: false }), [view, letters]);
  return <DiscoverySearchPanel items={[]} view={view} mine={undefined} now={SADA} mapArea={null} start={start} reduced={false}
    p6Search={{ snapshot, onDraft: (draft: { placeSearch?: string }) => setLetters(draft.placeSearch ?? ''), onNextPlaces: noop }} canNearby onApply={noop} onClose={noop} />;
}

function Pretraga({ varijanta, start, kadar }: { varijanta: Varijanta; start: SearchStep; kadar?: number }) {
  switch (varijanta) {
    case 'sada': return <PretragaSada start={start} />;
    case 'A': return <PretragaA start={start} />;
    case 'B': return <PretragaB start={start} />;
    case 'C': return <PretragaC start={start} kadar={kadar} />;
  }
}

/* ---------------------------------------------------------------------------------------------------------- ruta */

function Spisak() {
  return <SafeAreaView edges={['top']} style={s.screen}>
    <ScrollView contentContainerStyle={s.spisak}>
      <T variant="pageTitle" accessibilityRole="header" style={s.ink}>Varijante V2</T>
      <T variant="note" tone="muted">Laboratorija na lažnim podacima. Dodir otvara scenu preko cele širine ekrana.</T>
      {EKRANI.map(ekran => <Section key={ekran} title={NAZIV[ekran]}>
        {SVE_SCENE.filter(id => id.startsWith(`${ekran}-`)).map((id, index, all) => {
          const scena = parseScene(id)!;
          return <ListRow key={id} title={IME_VARIJANTE[ekran][scena.varijanta]} subtitle={scena.stanje ? `stanje: ${scena.stanje}` : undefined} value={id}
            last={index === all.length - 1} onPress={() => router.push({ pathname: '/dizajn-var-V2', params: { scene: id } })} />;
        })}
      </Section>)}
    </ScrollView>
  </SafeAreaView>;
}

export default function DizajnVarV2() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string; kadar?: string }>();
  if (!internal) return <View style={s.screen}><T variant="body" style={s.unavailable}>Nije dostupno.</T></View>;
  const scena = parseScene(params.scene);
  if (!scena) return <Spisak />;
  const kadarRaw = Number(params.kadar);
  const kadar = scena.stanje === 'pokret' && typeof params.kadar === 'string' && Number.isFinite(kadarRaw) && kadarRaw >= 0 ? kadarRaw : undefined;
  const large = scena.stanje === 'veliki';
  let body: ReactNode;
  switch (scena.ekran) {
    case 'kartica':
      body = scena.stanje === 'pokret' ? <ListaPokret kadar={kadar} /> : <Lista varijanta={scena.varijanta} items={scena.stanje === 'dugo' ? ZADACI_DUGO : ZADACI} />;
      break;
    case 'peek': body = <Peek varijanta={scena.varijanta} />; break;
    case 'detalj':
      body = <Detalj varijanta={scena.varijanta} need={scena.stanje === 'dugo' ? ZADATAK_DUG : scena.stanje === 'ponude' ? ZADACI[1] : ZADACI[0]} kadar={kadar} />;
      break;
    case 'pretraga': body = <Pretraga varijanta={scena.varijanta} start={scena.stanje === 'kada' ? 'kada' : 'gde'} kadar={kadar} />; break;
  }
  return large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : <>{body}</>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink },
  unavailable: { padding: layout.gutter, color: sys.color.ink },
  mapa: { flex: 1, backgroundColor: sys.map.ground },
  spisak: { paddingHorizontal: layout.gutter, paddingTop: sys.space.base, paddingBottom: layout.zone, gap: layout.section },
});
