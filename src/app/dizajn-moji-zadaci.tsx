import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { PotrebaProjekcija } from '../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type OwnedTaskCounts } from '../data/marketplaceView';
import type { NeedEnding } from '../data/needEnding';
import { novac } from '../lib/novac';
import { Press } from '../ui/Press';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { MarketplacePresentation, type MarketplacePaging } from '../ui/v2/MarketplacePresentation';

/**
 * Moji zadaci on fixtures, for the design lab and for the internal build: uskociapp://dizajn-moji-zadaci?scene=lista. Nothing here
 * reads or writes anything: every task is an example, every command is inert (a press on a card only says so), and a store build
 * shows nothing.
 *
 * Scenes: `lista` is the usual list (an active set of five, with drafts and finished tasks behind the other two tabs), `puno` a long
 * active set (twelve tasks, more than three screens), `dugi` long titles and places, `nacrti` and `istorija` the other two tabs,
 * `prazno` a person with no task yet, `prazan-skup` tasks that exist but not in the set that is chosen, `ucitavanje` and `greska`
 * the two states a read can be in, `veliki` the list at the large-text layout (the lab has no system font, so the layout class is
 * forced, as the other galleries do), `stranice` a list read a page at a time with its "Prikaži još" foot.
 */
const SCENES = ['lista', 'puno', 'dugi', 'nacrti', 'istorija', 'prazno', 'prazan-skup', 'ucitavanje', 'greska', 'veliki', 'stranice'] as const;
type Scene = typeof SCENES[number];
const LABELS: Record<Scene, string> = { lista: 'Lista', puno: 'Dvanaest zadataka', dugi: 'Dugi nazivi', nacrti: 'Nacrti', istorija: 'Istorija', prazno: 'Prazno',
  'prazan-skup': 'Prazan skup', ucitavanje: 'Učitavanje', greska: 'Greška', veliki: 'Veliki tekst', stranice: 'Po stranicama' };
const isScene = (value: unknown): value is Scene => typeof value === 'string' && (SCENES as readonly string[]).includes(value);
const noop = () => {};

const NO_RULES: NonNullable<PotrebaProjekcija['detalji']>['zahtevi'] = { vestine: [], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false };
type Seed = Partial<PotrebaProjekcija> & { kraj?: NeedEnding };
let serial = 0;
/** A task of mine as the read hands it over: priced by the person, one place, a fixed window, nobody has applied. */
const task = (seed: Seed & Pick<PotrebaProjekcija, 'naslov'>): MarketplaceItem => ({
  id: `moj-${++serial}`, revizija: 1, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Liman, Novi Sad', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-24T08:00:00Z', endsAt: '2026-10-24T10:00:00Z' }, vremeTekst: '24. okt · 10:00–12:00', uslovi: [],
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
  ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: novac(4500) }, priblizno: null, ...seed } as unknown as MarketplaceItem);

const ACTIVE: MarketplaceItem[] = [
  task({ naslov: 'Montaža dve police u hodniku', stanje: 'CEKA_PRIJAVE', brojPrijava: 4, brojPrijavaZaIzbor: 3, osnovaCene: 'PER_PERSON',
    pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: novac(2000) }, podrucjeTekst: 'Grbavica, Novi Sad' }),
  task({ naslov: 'Košenje travnjaka u dvorištu', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null, podrucjeTekst: 'Telep, Novi Sad',
    schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-10-11T22:00:00Z', endsAt: '2026-10-18T22:00:00Z' }, vremeTekst: 'Ove nedelje' }),
  task({ naslov: 'Pomoć pri selidbi', stanje: 'DELIMICNO_POPUNJENA', brojPrijava: 2, brojPrijavaZaIzbor: 1, osnovaCene: 'PER_PERSON',
    pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 }, ponudjenaCena: { iznos: 3500, valuta: 'RSD', prikaz: novac(3500) },
    podrucjeTekst: 'Novo naselje, Novi Sad', vremeTekst: '14. okt · 09:00–13:00' }),
  task({ naslov: 'Prevod uputstva na engleski', stanje: 'POPUNJENA', brojPrijava: 3, brojPrijavaZaIzbor: 0, ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: novac(2500) },
    pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, podrucjeTekst: 'Na daljinu', vremeTekst: 'Po dogovoru',
    detalji: { kategorija: 'Administrativna pomoć', geografija: { mode: 'REMOTE' }, rezimLokacije: 'REMOTE', zahtevi: NO_RULES } }),
  task({ naslov: 'Šetnja psa u kraju', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null, podrucjeTekst: 'Detelinara, Novi Sad',
    schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null }, vremeTekst: 'Danas, fleksibilno' }),
];
const MORE: MarketplaceItem[] = ['Bojenje ograde', 'Čišćenje podruma', 'Sklapanje kreveta', 'Nošenje peska', 'Popravka slavine', 'Okopavanje bašte', 'Pomoć oko računara'].map((naslov, at) =>
  task({ naslov, stanje: at % 3 === 0 ? 'CEKA_PRIJAVE' : 'OBJAVLJENA', brojPrijava: at % 3 === 0 ? 2 : 0, brojPrijavaZaIzbor: at % 3 === 0 ? 2 : 0,
    podrucjeTekst: ['Liman', 'Telep', 'Grbavica', 'Detelinara', 'Novo naselje', 'Podbara', 'Adice'][at] + ', Novi Sad',
    ponudjenaCena: { iznos: 2000 + at * 500, valuta: 'RSD', prikaz: novac(2000 + at * 500) } }));
const DRAFTS: MarketplaceItem[] = [
  task({ naslov: 'Pomoć oko bašte', stanje: 'NACRT', podrucjeTekst: 'Podbara, Novi Sad', ponudjenaCena: undefined, rezimCene: 'OFFERS', osnovaCene: null }),
  task({ naslov: 'Prenos ormara', stanje: 'NACRT', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 } }),
];
const HISTORY: MarketplaceItem[] = [
  task({ naslov: 'Farbanje ograde', stanje: 'ZATVORENA', kraj: 'COMPLETED', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, vremeTekst: '20. sep · 08:00' }),
  task({ naslov: 'Nošenje peska u dvorište', stanje: 'ZATVORENA', kraj: 'CANCELLED', vremeTekst: '18. sep · 16:00' }),
  task({ naslov: 'Pomoć pri sređivanju tavana', stanje: 'ZATVORENA', kraj: 'EXPIRED', vremeTekst: '12. sep · 10:00' }),
];
const LONG: MarketplaceItem[] = [
  task({ naslov: 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade', stanje: 'CEKA_PRIJAVE',
    brojPrijava: 12, brojPrijavaZaIzbor: 12, osnovaCene: 'PER_PERSON', pokrivenost: { ukupno: 12, popunjeno: 3, preostalo: 9, udeo: 0.25 },
    ponudjenaCena: { iznos: 125000, valuta: 'RSD', prikaz: novac(125000) }, podrucjeTekst: 'Novo naselje, Bulevar Evrope, Novi Sad, blizu Ekonomske škole',
    vremeTekst: 'Fleksibilan raspon · 24. sep – 30. sep, radnim danima posle 17:00' }),
  task({ naslov: 'Selidba kancelarije sa arhivom i nameštajem na drugi kraj grada', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null,
    urgency: { level: 'HITNO', expiresAt: '2099-01-01T00:00:00Z' } as PotrebaProjekcija['urgency'], podrucjeTekst: 'Petrovaradinska tvrđava, Novi Sad' }),
  task({ naslov: 'Pomoć oko bašte', ponudjenaCena: undefined, osnovaCene: null }),
];

const counts = (items: readonly MarketplaceItem[]): OwnedTaskCounts => {
  const owned = items as readonly PotrebaProjekcija[];
  return { total: owned.length, active: owned.filter(item => item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA').length,
    waiting: owned.filter(item => item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA' && item.pokrivenost.preostalo > 0 && (item.brojPrijavaZaIzbor ?? 0) > 0).length,
    drafts: owned.filter(item => item.stanje === 'NACRT').length, history: owned.filter(item => item.stanje === 'ZATVORENA').length };
};

type Setup = { items: MarketplaceItem[]; section?: MarketplaceView['section']; loading?: boolean; error?: boolean; large?: boolean; paged?: boolean };
function setupOf(scene: Scene): Setup {
  switch (scene) {
    case 'puno': return { items: [...ACTIVE, ...MORE, ...DRAFTS, ...HISTORY] };
    case 'dugi': return { items: LONG };
    case 'nacrti': return { items: [...ACTIVE, ...DRAFTS, ...HISTORY], section: 'drafts' };
    case 'istorija': return { items: [...ACTIVE, ...DRAFTS, ...HISTORY], section: 'history' };
    case 'prazno': return { items: [] };
    case 'prazan-skup': return { items: [...DRAFTS, ...HISTORY] };
    case 'ucitavanje': return { items: [], loading: true };
    case 'greska': return { items: [], error: true };
    case 'veliki': return { items: [...LONG, ...ACTIVE], large: true };
    case 'stranice': return { items: [...ACTIVE, ...MORE], paged: true };
    default: return { items: [...ACTIVE, ...DRAFTS, ...HISTORY] };
  }
}

function MojiZadaci({ scene }: { scene: Scene }) {
  const setup = setupOf(scene);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), section: setup.section ?? 'active' }));
  const [said, setSaid] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (text: string) => { setSaid(text); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setSaid(null), 2500); };
  const paging: MarketplacePaging | undefined = setup.paged ? { counts: counts(setup.items), hasMore: true, loadingMore: false, moreError: false, onLoadMore: () => say('Učitavamo još zadataka.') } : undefined;
  const body = <MarketplacePresentation items={setup.items} loading={!!setup.loading} error={!!setup.error} view={view} onView={setView} paging={paging}
    onRefresh={noop} onOpen={item => say(`Otvara zadatak ${item.naslov}.`)} onApplications={item => say(`Otvara prijave za ${item.naslov}.`)}
    onProfile={noop} onNew={() => say('Otvara objavu zadatka.')} onBack={() => router.back()} />;
  return <View style={s.fill}>
    {setup.large ? <LayoutClassOverride.Provider value={LARGE_LAYOUT}>{body}</LayoutClassOverride.Provider> : body}
    {said ? <View pointerEvents="none" style={s.said}><T variant="note" tone="onGreen">{said}</T></View> : null}
  </View>;
}

export default function DizajnMojiZadaci() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const requested = typeof params.scene === 'string' && isScene(params.scene) ? params.scene : undefined;
  const [scene, setScene] = useState<Scene>(requested ?? 'lista');
  // An address that names another scene (the lab moves between them without reloading the page) moves the strip with it.
  useEffect(() => { if (requested) setScene(requested); }, [requested]);
  if (!internal) return <View style={s.fill}><T>Nije dostupno.</T></View>;
  return <View style={s.screen}>
    {/* Each scene is mounted fresh, so its tab, its search and its filters start where the scene says. */}
    <View key={scene} style={s.fill}><MojiZadaci scene={scene} /></View>
    <View style={s.rule} />
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {SCENES.map(key => <Press key={key} accessibilityRole="button" accessibilityLabel={`Galerija: ${LABELS[key]}`} accessibilityState={{ selected: scene === key }}
          haptic="select" onPress={() => setScene(key)} style={[s.chip, scene === key && s.chipOn]}>
          <T variant="meta" style={scene === key ? s.chipTextOn : s.chipText}>{LABELS[key]}</T>
        </Press>)}
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  fill: { flex: 1 },
  said: { position: 'absolute', left: sys.space.base, right: sys.space.base, bottom: sys.space.base, padding: sys.space.md, borderRadius: sys.radius.control, backgroundColor: sys.color.ink },
  rule: { height: sys.rule.width, backgroundColor: sys.rule.color },
  strip: { backgroundColor: sys.color.surface },
  chips: { paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, gap: sys.space.sm },
  chip: { minHeight: 48, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  chipText: { color: sys.color.ink },
  chipTextOn: { color: sys.color.green, fontWeight: '700' },
});
