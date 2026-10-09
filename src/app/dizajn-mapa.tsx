import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { PrilikaProjekcija } from '../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../data/marketplaceView';
import { taskRelationIndex } from '../data/taskRelation';
import { needScheduleText } from '../data/needDetailPresentation';
import { novac } from '../lib/novac';
import { DiscoveryPresentation, type DiscoveryTrace, type DiscoveryV1PresentationSeam } from '../ui/v2/DiscoveryPresentation';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';
import { MapLabelsProbe } from '../ui/location/MapLabelsProbe';

/**
 * Inert native rendering fixture, never a server dataset or a concurrent-user load test.
 * Exact internal package only: uskociapp://dizajn-mapa?count=1, count=1000 or scene=point-members.
 * The real Discovery component keeps its filters, map, sheet and virtualization. Its map tiles/attribution and
 * explicit local Nearby control are unchanged; fixtures have no media and no profile/contact/action reads.
 * Opening a row pushes this route's inert detail, so Back exercises native screen detachment and retained list state.
 */
type Count = 1 | 1000;
type GalleryTask = PrilikaProjekcija & { detalji: NonNullable<PrilikaProjekcija['detalji']> };
const noop = () => {};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TITLES = ['Prenos ormana do kombija', 'Montaža dve police', 'Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara',
  'Košenje trave', 'Priprema sale i prenošenje stolova pre događaja', 'Šetnja psa u kraju'];
const CENTERS = [{ city: 'Novi Sad', lat: 45.25, lng: 19.84 }, { city: 'Novi Sad', lat: 45.25, lng: 19.84 },
  { city: 'Beograd', lat: 44.81, lng: 20.46 }, { city: 'Niš', lat: 43.32, lng: 21.90 }];

function fixtures(count: number): GalleryTask[] {
  return Array.from({ length: count }, (_, index): GalleryTask => {
    // Per ten: eight public geographic tasks, one remote, one on-site with an unavailable public pin.
    const remote = index % 10 === 8, noPin = index % 10 === 9;
    const center = CENTERS[Math.floor(index / 10) % CENTERS.length];
    const slots = 1 + index % 4, filled = index % 3 === 0 && slots > 1 ? 1 : 0;
    const offers = index % 3 === 0, missingPrice = !offers && index % 7 === 0;
    const amount = 1500 + index % 12 * 500;
    const title = remote ? index % 20 === 8 ? 'Prevod kratkog uputstva na engleski' : 'Sređivanje tabele troškova na daljinu'
      : TITLES[index % TITLES.length];
    return {
      id: uuid(index + 1), naslov: `${title} · ${String(index + 1).padStart(4, '0')}`,
      opis: 'Lokalni probni zadatak za pregled rasporeda, filtera i povratka iz detalja. Nije objavljen i na njega se ne može prijaviti.',
      statusTekst: 'Otvoren', primaNovePrijave: true, rokZaPrijaveIso: null,
      podrucjeTekst: remote ? 'Na daljinu' : center.city, taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
      vremeTekst: remote ? 'Po dogovoru' : '26. sep · 10:00–12:00',
      schedule: remote ? { kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null }
        : index % 4 === 1 ? { kind: 'FLEXIBLE', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-30T18:00:00Z' }
          : { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:00:00Z' },
      pokrivenost: { ukupno: slots, popunjeno: filled, preostalo: slots - filled, udeo: filled / slots },
      uslovi: index % 5 === 0 && !remote ? ['Ponesi rukavice', 'Zgrada bez lifta'] : [],
      narucilacProfilId: uuid(10001 + index), narucilacAvatarId: null,
      narucilacIme: `Probna osoba ${index % 20 + 1}`, narucilacOcena: null, narucilacBrojOcena: null,
      // Two-decimal public points deliberately repeat, exercising clusters and same-point groups.
      priblizno: remote || noPin ? null : { lat: Number((center.lat + (Math.floor(index / 40) % 9 - 4) * .01).toFixed(2)),
        lng: Number((center.lng + (Math.floor(index / 4) % 9 - 4) * .01).toFixed(2)) },
      rezimCene: offers ? 'OFFERS' : 'MY_PRICE', osnovaCene: index % 4 === 0 ? 'PER_PERSON' : 'TOTAL',
      ...(offers || missingPrice ? {} : { ponudjenaCena: { iznos: amount, valuta: 'RSD', prikaz: novac(amount) } }),
      detalji: { kategorija: remote ? 'Administrativna pomoć' : 'Pomoć u kući',
        geografija: remote ? { mode: 'REMOTE' } : { mode: 'STATIONARY', start: { city: center.city } },
        rezimLokacije: remote ? 'REMOTE' : 'STATIONARY',
        zahtevi: { vestine: [], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false } },
    };
  });
}

const leave = () => router.canGoBack() ? router.back() : router.replace('/dizajn-tabla');

export default function DizajnMapa() {
  const params = useLocalSearchParams<{ count?: string | string[]; detail?: string | string[]; discoveryTrace?: string | string[];
    relation?: string | string[]; scene?: string | string[] }>();
  const internal = Constants.expoConfig?.android?.package === 'rs.uskoci.dev';
  const count = params.count === undefined || params.count === '1' ? 1 : params.count === '1000' ? 1000 : null;
  const detail = params.detail === undefined ? null : typeof params.detail === 'string' && /^(0|[1-9]\d{0,2})$/.test(params.detail)
    ? Number(params.detail) : -1;
  const relation = params.relation ?? 'none';
  const pointMembers = params.scene === 'point-members';
  const mapLabels = params.scene === 'map-labels';
  if (!internal || count === null || (relation !== 'none' && relation !== 'owned' && relation !== 'applied')
    || (params.scene !== undefined && !pointMembers && !mapLabels)
    || ((pointMembers || mapLabels) && (params.count !== undefined || params.detail !== undefined || params.relation !== undefined))
    || (mapLabels && params.discoveryTrace !== undefined)
    || (detail !== null && (detail < 0 || detail >= count))) {
    return <SafeAreaView style={s.screen}><T style={s.unavailable}>{internal ? 'Nepoznat prikaz galerije.' : 'Nije dostupno.'}</T>
      <GalleryFooter count={null} onBack={leave} /></SafeAreaView>;
  }
  if (pointMembers) return <PointMembersGallery />;
  if (mapLabels) return <MapLabelsProbe onBack={leave} />;
  return <LocalGallery key={`${count}:${relation}`} count={count} detail={detail} relation={relation} traceEnabled={params.discoveryTrace === '1'} />;
}

/** Only fifty local rows: the production seam owns the separate total. No paging or database capacity claim. */
function PointMembersGallery() {
  const point = { lat: 45.25, lng: 19.84 }, key = 'place:45.25:19.84';
  const items = useMemo(() => fixtures(70).filter(row => row.priblizno !== null).slice(0, 50)
    .map(row => ({ ...row, priblizno: { lat: 45.25, lng: 19.84 },
    podrucjeTekst: 'Novi Sad', detalji: { ...row.detalji, rezimLokacije: 'STATIONARY' as const,
      geografija: { mode: 'STATIONARY' as const, start: { city: 'Novi Sad' } } } })), []);
  const [selected, setSelected] = useState(true);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map', sheet: 'peek' }));
  const clear = () => setSelected(false);
  const seam: DiscoveryV1PresentationSeam = {
    map: { markers: [{ kind: 'PLACE', key, point, taskCount: 4000 }], selectedKey: selected ? key : null,
      wholeBounds: [19.79, 45.20, 19.89, 45.30], onSelect: marker => { if (marker.key === key) setSelected(true); } },
    peek: selected ? { key, item: null, place: items, placeTotalCount: 4000 } : null,
    counts: { kind: 'exact_live', observedAt: '2026-10-09T04:00:00Z', listed: 4000, mapped: 4000,
      inArea: 4000, withoutPoint: 0, undated: 0 },
    pageHasMore: false, onArea: noop, onClearPeek: clear, onShowPlace: clear, onShowAll: clear, onNextPage: noop,
  };
  return <View style={s.screen}><View style={s.grow}>
    <DiscoveryPresentation items={items} loading={false} error={false} scopeKey="local-map-gallery:point-members"
      view={view} onView={setView} onOpen={noop} onRefresh={noop} onProfile={noop} p6Seam={seam} />
  </View><GalleryFooter count={null} onBack={leave} pointMembers /></View>;
}

const TRACE_EVENTS = new Set(['seed', 'preopen', 'request', 'ack', 'clamp0', 'ready', 'content']);

function LocalGallery({ count, detail, traceEnabled, relation }: {
  count: Count; detail: number | null; traceEnabled: boolean; relation: 'none' | 'owned' | 'applied';
}) {
  // Optional diagnosis only in this exact DEV package. Never log task/account text, IDs or native event objects.
  const traceGate = useRef(traceEnabled); traceGate.current = traceEnabled;
  const traceCount = useRef(0), traceSamples = useRef(0);
  const trace = useCallback<DiscoveryTrace>((event, ...values) => {
    if (!traceGate.current || traceCount.current >= 120 || !TRACE_EVENTS.has(event) || values.length > 20
      || values.some(value => typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value)))) return;
    if (event === 'content' && traceSamples.current++ >= 32) return;
    const safe = values.map(value => typeof value === 'boolean' ? value : Math.round(Math.max(-10_000_000, Math.min(10_000_000, value)) * 10) / 10);
    console.info(`[USKOCI_DISCOVERY_TRACE] ${JSON.stringify([++traceCount.current, event, ...safe])}`);
  }, []);
  const items = useMemo(() => fixtures(count), [count]);
  // Explicit local relation scenes exercise the real overlays without reading/changing a real profile or application.
  const relations = useMemo(() => taskRelationIndex(relation === 'none' ? [] : [relation === 'owned'
    ? { needId: items[0].id, relation: 'OWNER' }
    : { needId: items[0].id, relation: 'APPLIED', applicationId: uuid(20001), applicationState: 'SUBMITTED' }],
  items.map(item => item.id)), [items, relation]);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }));
  const open = (item: MarketplaceItem) => {
    const index = items.findIndex(row => row.id === item.id);
    if (index >= 0) router.push({ pathname: '/dizajn-mapa', params: { count: String(count), detail: String(index),
      ...(relation === 'none' ? {} : { relation }) } });
  };
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: '/dizajn-mapa', params: { count: String(count) } });
  const item = detail === null ? null : items[detail];
  return <View style={s.screen}>
    {item ? <SafeAreaView edges={['top']} style={s.grow}><ScrollView contentContainerStyle={s.detail}>
      <T variant="meta">LOKALNI PROBNI DETALJ · {detail! + 1}/{count}</T>
      <T variant="heading">{item.naslov}</T>
      <T>{item.podrucjeTekst}</T><T>{item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst}</T>
      <T>{item.rezimCene === 'OFFERS' ? 'Tražim ponude' : item.ponudjenaCena?.prikaz ?? 'Cena nije navedena'}</T>
      <T>{item.opis}</T>
      <T tone="muted">Nazad vraća isti ekran mape i liste. Ovde nema slanja, prijave ili čuvanja u bazu.</T>
    </ScrollView></SafeAreaView> : <View style={s.grow}>
      <DiscoveryPresentation items={items} loading={false} error={false} scopeKey={`local-map-gallery:${count}`}
        view={view} onView={setView} onOpen={open} onRefresh={noop} onProfile={noop} relations={relations}
        trace={traceEnabled ? trace : undefined} />
    </View>}
    <GalleryFooter count={count} onBack={item ? back : leave} detail={!!item} />
  </View>;
}

function GalleryFooter({ count, detail = false, onBack, pointMembers = false }: {
  count: Count | null; detail?: boolean; onBack: () => void; pointMembers?: boolean;
}) {
  return <SafeAreaView edges={['bottom']} style={s.footer}>
    <View style={s.footerRow}>
      <T variant="meta" accessibilityLabel={pointMembers ? 'DEV galerija, 4000 ukupno, 50 učitano, bez podataka iz baze'
        : count ? `DEV galerija, ${count} lokalnih probnih zadataka, bez podataka iz baze` : 'DEV galerija'}
        style={s.context}>{pointMembers ? 'DEV · 4.000 ukupno / 50 učitano · bez baze'
          : count ? `DEV · ${count === 1000 ? '1.000 zadataka' : '1 zadatak'} · bez baze` : 'DEV galerija'}</T>
      <Press accessibilityRole="button" accessibilityLabel={detail ? 'Nazad na probnu mapu' : 'Izađi iz galerije'}
        onPress={onBack} style={s.exit}><T variant="action">{detail ? 'Nazad' : 'Izađi'}</T></Press>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface }, grow: { flex: 1 },
  detail: { padding: sys.space.lg, gap: sys.space.base }, unavailable: { flex: 1, padding: sys.space.lg },
  footer: { borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base },
  context: { flex: 1 }, exit: { minHeight: 48, paddingHorizontal: sys.space.base, justifyContent: 'center' },
});
