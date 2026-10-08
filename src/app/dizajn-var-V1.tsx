import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { initialMarketplaceView, type MarketplaceView } from '../data/marketplaceView';
import { HomePresentation } from '../ui/home/HomePresentation';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { FactArt } from '../ui/system/FactArt';
import { ListRow } from '../ui/system/ListRow';
import { Screen } from '../ui/system/Screen';
import { Section } from '../ui/system/Section';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { MarketplacePresentation } from '../ui/v2/MarketplacePresentation';
import { readKadar, type Kadar } from '../ui/varijante/V1/kadar';
import { MojiZadaciA } from '../ui/varijante/V1/MojiZadaciA';
import { MojiZadaciB } from '../ui/varijante/V1/MojiZadaciB';
import { MojiZadaciC } from '../ui/varijante/V1/MojiZadaciC';
import { PocetnaA } from '../ui/varijante/V1/PocetnaA';
import { PocetnaB } from '../ui/varijante/V1/PocetnaB';
import { PocetnaC } from '../ui/varijante/V1/PocetnaC';
import { PocetnaTraka, Telefon, noop } from '../ui/varijante/V1/PocetnaZajednicko';
import { PORODICA, PORODICA_SADA, clanPorodice, isMojiZadaciStanje, isPocetnaStanje, mojiZadaciPodaci, pocetnaPodaci } from '../ui/varijante/V1/podaci';
import { StanjaA, StanjaB, StanjaC, StanjaSada } from '../ui/varijante/V1/Stanja';

/**
 * The V1 variant scenes for the design lab and the internal build (creative direction 2026-10-08, group V1: Početna; Moji zadaci and
 * the first encounter; the state family): `/dizajn-var-V1?scene=<ekran>-<A|B|C|sada>[&stanje=<state>][&t=<ms>]`. Without `scene` the
 * screen lists every scene as a row that opens it. Every scene is the WHOLE screen (no gallery frame), from FAKE data, every command
 * inert; a store build shows nothing. `sada` is today's production screen on the same data, so the owner sees "before" beside "after".
 * `t` freezes a variant's motion at that instant, for the frames a still image cannot show.
 */
const EKRANI = [
  { key: 'pocetna', naziv: 'Početna', hint: 'Čeka te, Raspored, Moji zadaci i Moje prijave; vrata i potpis zaključani' },
  { key: 'moji-zadaci', naziv: 'Moji zadaci + prvi susret', hint: 'Lista i prazno stanje' },
  { key: 'stanja', naziv: 'Prazna stanja kao porodica', hint: '&stanje=moji-zadaci | moje-prijave | dogovori | poruke | obavestenja | zadaci | filter | greska | bez-veze' },
] as const;
const VARIJANTE = [
  { key: 'sada', naziv: 'Sada' }, { key: 'A', naziv: 'A' }, { key: 'B', naziv: 'B' }, { key: 'C', naziv: 'C' },
] as const;
type Ekran = typeof EKRANI[number]['key'];
type Varijanta = typeof VARIJANTE[number]['key'];
const NAZIVI: Record<Ekran, Record<Varijanta, string>> = {
  pocetna: { sada: 'Sada', A: 'A · Lice koje čeka', B: 'B · Danas u 14', C: 'C · Sto se postavlja' },
  'moji-zadaci': { sada: 'Sada', A: 'A · Papir na stolu', B: 'B · Dva broja', C: 'C · Noga koja uskače' },
  stanja: { sada: 'Sada', A: 'A · Predmet vrata', B: 'B · Jedna rečenica', C: 'C · Scena koja stiže' },
};
export const SCENES = EKRANI.flatMap(ekran => VARIJANTE.map(varijanta => `${ekran.key}-${varijanta.key}`));

/** An address parameter is one word, even when the router hands over a list of them. */
const word = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function parse(scene: string | undefined): { ekran: Ekran; varijanta: Varijanta } | null {
  if (!scene) return null;
  const at = scene.lastIndexOf('-');
  if (at < 0) return null;
  const ekran = scene.slice(0, at), varijanta = scene.slice(at + 1);
  if (!EKRANI.some(option => option.key === ekran) || !VARIJANTE.some(option => option.key === varijanta)) return null;
  return { ekran: ekran as Ekran, varijanta: varijanta as Varijanta };
}

/** Today's Početna on the scene's data, with the still tab bar under it. */
function PocetnaSada({ stanje }: { stanje: string | undefined }) {
  const data = pocetnaPodaci(isPocetnaStanje(stanje) ? stanje : 'normalno');
  return <Telefon>
    <HomePresentation home={data.home} header={<PocetnaTraka />} loading={false} refreshing={false} error={false}
      onPublish={noop} onEarn={noop} onProfile={noop} onOpen={noop} onRatings={noop} onMyTasks={noop} onMyApplications={noop} onRefresh={noop} onPlanner={noop}
      availableNow={data.availableNow !== undefined ? { value: data.availableNow, onChange: noop } : undefined} />
  </Telefon>;
}

/** Today's Moji zadaci on the scene's data (the pushed screen with its arrow). */
function MojiZadaciSada({ stanje }: { stanje: string | undefined }) {
  const items = mojiZadaciPodaci(isMojiZadaciStanje(stanje) ? stanje : 'lista');
  const [view, setView] = useState<MarketplaceView>(() => initialMarketplaceView());
  return <MarketplacePresentation items={items} loading={false} error={false} view={view} onView={setView} onRefresh={noop}
    onOpen={noop} onApplications={noop} onProfile={noop} onNew={noop} onBack={noop} />;
}

function Scena({ ekran, varijanta, stanje, kadar }: { ekran: Ekran; varijanta: Varijanta; stanje: string | undefined; kadar: Kadar }) {
  if (ekran === 'pocetna') {
    if (varijanta === 'sada') return <PocetnaSada stanje={stanje} />;
    const data = pocetnaPodaci(isPocetnaStanje(stanje) ? stanje : 'normalno');
    if (varijanta === 'A') return <PocetnaA home={data.home} availableNow={data.availableNow} kadar={kadar} />;
    if (varijanta === 'B') return <PocetnaB home={data.home} availableNow={data.availableNow} />;
    return <PocetnaC home={data.home} availableNow={data.availableNow} kadar={kadar} />;
  }
  if (ekran === 'moji-zadaci') {
    if (varijanta === 'sada') return <MojiZadaciSada stanje={stanje} />;
    const items = mojiZadaciPodaci(isMojiZadaciStanje(stanje) ? stanje : 'lista');
    if (varijanta === 'A') return <MojiZadaciA items={items} />;
    if (varijanta === 'B') return <MojiZadaciB items={items} />;
    return <MojiZadaciC items={items} kadar={kadar} stamp={stanje === 'pecat'} />;
  }
  const clan = clanPorodice(varijanta === 'sada' ? PORODICA_SADA : PORODICA, stanje);
  if (varijanta === 'sada') return <StanjaSada clan={clan} />;
  if (varijanta === 'A') return <StanjaA clan={clan} />;
  if (varijanta === 'B') return <StanjaB clan={clan} />;
  return <StanjaC clan={clan} kadar={kadar} />;
}

/** The list of scenes, each a row that opens it (the address then carries `scene`, so the lab can also come straight to it). */
function Spisak() {
  return <Screen kind="detail" header={<DetailTopBar title="Varijante V1" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />}>
    {EKRANI.map(ekran => <Section key={ekran.key} title={ekran.naziv}>
      {VARIJANTE.map((varijanta, at) => <ListRow key={varijanta.key} leading={<FactArt kind="info" size={32} />} title={NAZIVI[ekran.key][varijanta.key]}
        subtitle={at === 0 ? ekran.hint : undefined} onPress={() => router.setParams({ scene: `${ekran.key}-${varijanta.key}` })} last={at === VARIJANTE.length - 1} />)}
    </Section>)}
  </Screen>;
}

export default function DizajnVarV1() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[]; stanje?: string | string[]; t?: string | string[] }>();
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const scene = parse(word(params.scene)), stanje = word(params.stanje), kadar = readKadar(params.t);
  if (!scene) return <Spisak />;
  // Each scene is mounted fresh for its address, so its motion starts where the address says.
  return <View key={`${scene.ekran}-${scene.varijanta}|${stanje ?? ''}|${kadar ?? 'live'}`} style={s.screen}>
    <Scena ekran={scene.ekran} varijanta={scene.varijanta} stanje={stanje} kadar={kadar} />
  </View>;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.ground } });
