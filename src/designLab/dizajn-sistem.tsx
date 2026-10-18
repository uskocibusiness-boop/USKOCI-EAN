import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';
import { Avatar } from '../ui/system/Avatar';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { FactArt } from '../ui/system/FactArt';
import { FactRow } from '../ui/system/FactRow';
import { FlowFooter } from '../ui/system/FlowFooter';
import { Glyph } from '../ui/system/Glyph';
import { KeyValueRow } from '../ui/system/KeyValueRow';
import { layout } from '../ui/system/layout';
import { ListRow } from '../ui/system/ListRow';
import { Screen } from '../ui/system/Screen';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { Section } from '../ui/system/Section';
import { Segmented, type SegmentedOption } from '../ui/system/Segmented';
import { STATE_SCENES, StateScene, stateFooter, type StateSceneKey } from '../ui/system/StateGallery';
import { StatusChip } from '../ui/system/StatusChip';
import { Surface } from '../ui/system/Surface';
import { LARGE_LAYOUT, LayoutClassOverride } from '../ui/system/textScale';
import { brandAction, sys } from '../ui/system/tokens';

/**
 * The gallery of the system's primitives (UI/UX pass 2026-10-08, F8a): `Screen`, `Section`, `ListRow`, `FactRow`, `KeyValueRow`,
 * `Surface`, the `Segmented` in its two shapes and the `FlowFooter` with its reason, drawn from fixtures so the lead can photograph
 * them on the emulator and in the design lab. Reached only by its address (uskociapp://dizajn-sistem, `?scene=redovi`) in the internal
 * build; the store package shows nothing. Nothing here reads or writes data, and every press does nothing.
 *
 * Scenes: `normalno` (everything on one screen), `redovi`, `zapisi`, `uslovi`, `izbor`, `podnozje`, `dugi` (the longest names the
 * app meets), and `veliki` (text scale 1.3 and more: the stacked layout, forced at the phone's own text size).
 *
 * Large text: the layout class is the window's, and a screen cannot change the system's font. `veliki` therefore tells the
 * components "large" (`LayoutClassOverride`), which is what `useLayoutClass` answers at text scale 1.3; and in the web design lab, which
 * has no text scale, it also zooms the frame 1.3 times at the same relative width, so the words are as large against the screen as they
 * are at 1.3 on a 361 dp phone. On a phone, the real setting is the check: set the font to 1.3 and open any other scene.
 */
type SceneKey = 'normalno' | 'redovi' | 'zapisi' | 'uslovi' | 'izbor' | 'podnozje' | 'dugi' | 'veliki' | 'stanja';
const SCENES: { key: SceneKey; label: string; hint: string }[] = [
  { key: 'normalno', label: 'Normalno', hint: 'Sve zajedno, kako ga vidiš na telefonu' },
  { key: 'redovi', label: 'Redovi i odeljci', hint: 'Section, ListRow, jedna ivica teksta' },
  { key: 'zapisi', label: 'Zapisi i okviri', hint: 'Surface: zapis, okvir, plutajuće, napomena' },
  { key: 'uslovi', label: 'Činjenice i uslovi', hint: 'FactRow i KeyValueRow' },
  { key: 'izbor', label: 'Izbor skupa', hint: 'Segmented sa 2, 3 i 5 opcija' },
  { key: 'podnozje', label: 'Podnožje sa razlogom', hint: 'FlowFooter i Screen toka' },
  { key: 'dugi', label: 'Dugi nazivi', hint: 'Najduže reči koje aplikacija sreće' },
  { key: 'veliki', label: 'Veliki tekst (1,3)', hint: 'Složen raspored, bez elipsi' },
  { key: 'stanja', label: 'Stanja', hint: 'Prazno, učitavanje, greška, bez veze, nije sigurno' },
];

const noop = () => undefined;
/** The relative width of the frame at text scale 1.3: a 361 dp phone is 361 / 1.3 = 278 wide before the zoom. */
const TEXT_ZOOM = 1.3;
const ZOOM_FRAME = 278;

const dot = <View style={{ width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange }} />;
const art = (kind: 'pin' | 'bell' | 'users' | 'clock' | 'calendar' | 'support' | 'info' | 'lock' | 'document' | 'agreements' | 'chat') => <FactArt kind={kind} size={32} />;

/* ------------------------------------------------------------------------------------------------------------- the pieces */

function Rows({ long = false }: { long?: boolean }) {
  return <>
    <Section title="Kako mogu da uskočim">
      <ListRow leading={art('users')} title={long ? 'Radni profil za montažu nameštaja, selidbe i manje popravke u stanu' : 'Radni profil'}
        subtitle={long ? 'Aktivan · Novi Sad, Petrovaradin, Sremska Kamenica i okolina do 25 km' : 'Aktivan · Novi Sad'} onPress={noop} />
      <ListRow leading={art('pin')} title="Područje rada" subtitle="Do 15 km od Limana" onPress={noop} />
      <ListRow leading={art('clock')} title="Dostupnost" subtitle="Kada mogu da radim" onPress={noop} />
      <ListRow leading={art('calendar')} title="Raspored" subtitle="Dogovoreni termini" onPress={noop} last />
    </Section>
    <Section title="Nalog i pomoć" action={{ label: 'Pomoć', onPress: noop }}>
      <ListRow leading={art('bell')} title="Podešavanja obaveštenja" trailing={dot} onPress={noop} />
      <ListRow leading={art('support')} title="Podrška" subtitle="Privatni zahtevi, odgovori i ponovni pregled." onPress={noop} />
      <ListRow leading={art('info')} title="O aplikaciji" meta="Verzija 1.0.0" onPress={noop} last />
    </Section>
    <Section title="Red koji kaže šta je izabrano i otvara izbor">
      <ListRow title="Gde" value="Novi Sad" expanded={false} onPress={noop} />
      <ListRow title="Kada" value={long ? 'Ovog meseca, radnim danima posle podne i vikendom' : 'Ovog meseca'} expanded onPress={noop} />
      <ListRow title="Vrsta pomoći" value="Sve vrste" expanded={false} onPress={noop} last />
    </Section>
    <Section title="Privatnost">
      <ListRow tone="quiet" leading={art('lock')} title="Privatnost i podaci" subtitle="Šta je javno, rokovi čuvanja, zatvaranje naloga." onPress={noop} />
      <ListRow tone="quiet" leading={art('document')} title="Pravila i saglasnosti" onPress={noop} last />
    </Section>
    <Section title="Podaci o aplikaciji">
      <ListRow title="Verzija" subtitle="1.0.0 · izdanje 214" />
      <ListRow title="Poslednja provera" subtitle="Danas u 09:12" last />
    </Section>
    <Section title="Osobe">
      <ListRow faceSlot leading={<Avatar initials="MJ" size={56} />} title={long ? 'Aleksandra Konstantinović-Radovanović' : 'Marko Jovanović'}
        subtitle="Prenos ormana do kombija" meta="18:19 · Otvara razgovor" trailing={<StatusChip status="task.agreed" />} onPress={noop} />
      <ListRow faceSlot leading={<Avatar initials="JP" size={56} />} title="Jelena Petrović" subtitle="Montaža police u hodniku" onPress={noop} last />
    </Section>
    <Section>
      <ListRow title="Odjavi se" tone="danger" onPress={noop} last />
    </Section>
  </>;
}

function Records({ long = false }: { long?: boolean }) {
  const title = long ? 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade' : 'Prenos ormana do kombija';
  return <>
    <Section title="Zapisi" action={{ label: 'Svi zadaci', onPress: noop }}>
      <View style={s.stack}>
        <Surface kind="record" onPress={noop} accessibilityLabel={`${title}, 5.500 RSD`}>
          <View style={s.cardHead}>
            <T variant="heading" style={s.grow}>{title}</T>
            <T variant="priceRow">5.500 RSD</T>
          </View>
          <View style={s.recordFacts}>
            <FactRow art="pin" value={long ? 'Bulevar oslobođenja 12, Novo naselje, Novi Sad, blizu Ekonomske škole' : 'Liman, Novi Sad'} />
            <FactRow art="clock" value="Sutra · 09:00–11:00" />
            <FactRow art="users" value="Potrebno: 2 osobe" note="0 od 2 popunjeno" />
          </View>
        </Surface>
        <Surface kind="record" onPress={noop} accessibilityLabel="Montaža police u hodniku, dogovoreno">
          <StatusChip status="task.agreed" />
          <T variant="heading" style={s.cardTitle}>Montaža police u hodniku</T>
          <View style={s.recordFacts}>
            <FactRow art="calendar" value="26. sep · 17:00–19:00" />
            <FactRow art="money" value="3.000 RSD" />
          </View>
        </Surface>
      </View>
    </Section>
    <Section title="Okvir, plutajuće, napomena">
      <View style={s.stack}>
        <Surface kind="panel">
          <T variant="bodyStrong">Tvoja statistika</T>
          <KeyValueRow label="Prijave" value="12" />
          <KeyValueRow label="Dogovoreno" value="7" />
          <KeyValueRow label="Završeno" value="5" last />
        </Surface>
        <View style={s.map}>
          <Surface kind="float" style={s.pill}>
            <Glyph name="search" tone="muted" />
            <T variant="body" tone="muted">Traži zadatke u blizini</T>
          </Surface>
        </View>
        <Surface kind="note"><T variant="note">Tačnu adresu vidi samo osoba sa kojom se dogovoriš.</T></Surface>
        <Surface kind="note" tone="warn"><T variant="note">Termin još nije potvrđen. Dogovori vreme u razgovoru.</T></Surface>
        <Surface kind="note" tone="danger"><T variant="note">Ovu radnju ne možeš da vratiš.</T></Surface>
      </View>
    </Section>
  </>;
}

function Terms({ long = false }: { long?: boolean }) {
  return <>
    <Section title="Činjenice">
      <View style={s.facts}>
        <FactRow size="detail" art="pin" value={long ? 'Bulevar oslobođenja 12, Novo naselje, Novi Sad, kod Ekonomske škole, ulaz iz dvorišta' : 'Liman, Novi Sad'} />
        <FactRow size="detail" art="clock" value="Sutra · 09:00–11:00" note="Po vremenu u Srbiji" />
        <FactRow size="detail" art="users" value="Potrebno: 2 osobe" note="0 od 2 popunjeno" />
      </View>
    </Section>
    <Section title="Uslovi" action={{ label: 'Izmeni sve', onPress: noop }}>
      <KeyValueRow label="Termin" value="26. sep · 17:00–19:00" action={{ label: 'Izmeni', onPress: noop }} />
      <KeyValueRow label="Dogovoreno ukupno" value="5.500 RSD" emphasis="price" />
      <KeyValueRow label="Ljudi" value="2 osobe" />
      <KeyValueRow label="Stanje" value={<StatusChip status="task.agreed" />} />
      <KeyValueRow label={long ? 'Opis i napomena o pristupu stanu i zgradi' : 'Obim'} last
        value={long ? 'Prenos ormana u dva dela sa trećeg sprata do kombija ispred ulaza, bez lifta, uz zaštitu stepeništa i vrata' : 'Prenos ormana u dva dela'} />
    </Section>
  </>;
}

const TWO: SegmentedOption<'active' | 'history'>[] = [{ key: 'active', label: 'Aktivni', badge: 3, badgeTone: 'attention', badgeLabel: '3 čekaju tebe' },
  { key: 'history', label: 'Istorija', badge: 7, badgeLabel: '7 završenih' }];
const THREE: SegmentedOption<'a' | 'n' | 'i'>[] = [{ key: 'a', label: 'Aktivni' }, { key: 'n', label: 'Nacrti' }, { key: 'i', label: 'Istorija' }];
const FIVE: SegmentedOption<'all' | 'ag' | 'ap' | 'av' | 'ar'>[] = [{ key: 'all', label: 'Sve' }, { key: 'ag', label: 'Dogovori' },
  { key: 'ap', label: 'Moje prijave' }, { key: 'av', label: 'Dostupnost' }, { key: 'ar', label: 'Arhiva' }];
const LONG_THREE: SegmentedOption<'a' | 'n' | 'i'>[] = [{ key: 'a', label: 'Čekaju tvoj odgovor' }, { key: 'n', label: 'Nacrti zadataka' }, { key: 'i', label: 'Završeni dogovori' }];

function Choices({ long = false }: { long?: boolean }) {
  const [two, setTwo] = useState<'active' | 'history'>('active');
  const [shared, setShared] = useState<'active' | 'history'>('active');
  const [three, setThree] = useState<'a' | 'n' | 'i'>('a');
  const [five, setFive] = useState<'all' | 'ag' | 'ap' | 'av' | 'ar'>('ag');
  return <>
    <Section title="Dve opcije, broj samo za ono što čeka tebe">
      <Segmented options={TWO} value={two} onChange={setTwo} />
    </Section>
    <Section title="U redu sa dugmetom: inline, bez fiksne širine">
      <View style={s.sharedRow}>
        <Segmented options={TWO} value={shared} onChange={setShared} inline />
        <ChromeIconButton label="Raspored" glyph="calendar" onPress={noop} />
      </View>
    </Section>
    <Section title="Tri opcije, iste širine">
      <View style={s.stack}>
        <Segmented options={long ? LONG_THREE : THREE} value={three} onChange={setThree} />
        <Segmented options={long ? LONG_THREE : THREE} value={three} onChange={setThree} contentSized scroll />
      </View>
    </Section>
    <Section title="Pet opcija: jedini bočni skrol">
      <Segmented options={FIVE} value={five} onChange={setFive} />
    </Section>
  </>;
}

/* --------------------------------------------------------------------------------------------------------------- scenes */

function Overview({ long = false }: { long?: boolean }) {
  return <>
    <Choices long={long} />
    <Records long={long} />
    <Terms long={long} />
    <Rows long={long} />
  </>;
}

function Footer({ back }: { back: () => void }) {
  const [mode, setMode] = useState<'razlog' | 'spremno' | 'dva'>('razlog');
  const options: SegmentedOption<'razlog' | 'spremno' | 'dva'>[] = [{ key: 'razlog', label: 'Sa razlogom' }, { key: 'spremno', label: 'Spremno' }, { key: 'dva', label: 'Dve radnje' }];
  const footer = <FlowFooter reason={mode === 'razlog' ? 'Izaberi dan i vreme da nastaviš.' : undefined}>
    <V2Action label="Dalje" onPress={noop} disabled={mode === 'razlog'} style={brandAction} />
    {mode === 'dva' ? <V2Action label="Sačuvaj kao nacrt" kind="quiet" onPress={noop} /> : null}
  </FlowFooter>;
  return <Screen kind="flow" header={<ScreenChrome variant="flow" title="Novi termin" step="Korak 2 od 4" onClose={back} />} footer={footer}>
    <Segmented options={options} value={mode} onChange={setMode} />
    <Section title="Kada ti odgovara?">
      <KeyValueRow label="Dan" value="Sutra" action={{ label: 'Izmeni', onPress: noop }} />
      <KeyValueRow label="Vreme" value={mode === 'razlog' ? 'Nije izabrano' : '09:00–11:00'} last />
    </Section>
    <Surface kind="note"><T variant="note">Podnožje stoji ispod sadržaja i diže se sa tastaturom. Jedna zelena radnja, razlog iznad nje kad ne može.</T></Surface>
  </Screen>;
}

/** What the scene is, at the size it is drawn. */
function Scene({ scene, back }: { scene: SceneKey; back: () => void }) {
  const label = SCENES.find(option => option.key === scene)!.label;
  if (scene === 'podnozje') return <Footer back={back} />;
  const header = <DetailTopBar title={`Sistem · ${label.toLowerCase()}`} onBack={back} />;
  return <Screen kind="detail" header={header}>
    {scene === 'redovi' ? <Rows /> : scene === 'zapisi' ? <Records /> : scene === 'uslovi' ? <Terms /> : scene === 'izbor' ? <Choices />
      : scene === 'dugi' ? <Overview long /> : <Overview />}
  </Screen>;
}

/** Text scale 1.3: the components are told "large", and the web lab, which has no text scale, zooms the frame at the same relative width. */
function Large({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  return <LayoutClassOverride.Provider value={LARGE_LAYOUT}>
    {Platform.OS === 'web'
      ? <View style={[s.zoomFrame, { height: height / TEXT_ZOOM, zoom: TEXT_ZOOM } as ViewStyle]}>{children}</View>
      : children}
  </LayoutClassOverride.Provider>;
}

/** An address parameter is one word, even when the router hands over a list of them. */
const word = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/**
 * The state scenes (`?scene=stanja`, F8b): an index of the states and, under it, one state at a time, FULL SCREEN under its bar, because the
 * place of the block (a third of the way down) is only what a screen shows when the block has a whole screen. `&stanje=greska` opens one
 * directly and `&veliki=1` draws any scene at text scale 1.3.
 */
function StatesIndex({ open, back }: { open: (key: StateSceneKey) => void; back: () => void }) {
  return <Screen kind="detail" header={<DetailTopBar title="Sistem · stanja" onBack={back} />}>
    <Section title="Stanja">
      {STATE_SCENES.map((option, at) => <ListRow key={option.key} leading={art('info')} title={option.label} subtitle={option.hint || undefined}
        onPress={() => open(option.key)} last={at === STATE_SCENES.length - 1} />)}
    </Section>
  </Screen>;
}

function StateFrame({ state, back }: { state: StateSceneKey; back: () => void }) {
  const found = STATE_SCENES.find(option => option.key === state)!;
  const footer = stateFooter(state);
  return <Screen kind={footer ? 'flow' : 'detail'} scroll={found.scroll ?? false} footer={footer}
    header={<DetailTopBar title={`Stanja · ${found.label.toLowerCase()}`} onBack={back} />}>
    <StateScene scene={state} />
  </Screen>;
}

export default function DizajnSistem() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[]; stanje?: string | string[]; veliki?: string | string[] }>();
  const fromAddress = SCENES.find(option => option.key === word(params.scene))?.key ?? null;
  const stateFromAddress = STATE_SCENES.find(option => option.key === word(params.stanje))?.key ?? null;
  const [scene, setScene] = useState<SceneKey | null>(fromAddress);
  const [state, setState] = useState<StateSceneKey | null>(stateFromAddress);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const back = () => setScene(null);
  if (!scene) return <Screen kind="detail" header={<DetailTopBar title="Sistem · primitivi" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />}>
    <Section title="Scene">
      {SCENES.map((option, at) => <ListRow key={option.key} leading={art('info')} title={option.label} subtitle={option.hint} onPress={() => setScene(option.key)}
        last={at === SCENES.length - 1} />)}
    </Section>
  </Screen>;
  // Each scene is mounted fresh, so its choices start where the scene says.
  const drawn = scene === 'stanja'
    ? state ? <StateFrame key={state} state={state} back={() => setState(null)} /> : <StatesIndex open={setState} back={back} />
    : <Scene key={scene} scene={scene} back={back} />;
  return scene === 'veliki' || word(params.veliki) === '1' ? <Large>{drawn}</Large> : drawn;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1, minWidth: 0 },
  stack: { gap: layout.group },
  facts: { gap: sys.space.sm },
  recordFacts: { gap: sys.space.sm, marginTop: sys.space.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  cardTitle: { marginTop: sys.space.sm },
  // What lies over a map: a ground the float can lift off.
  map: { backgroundColor: sys.map.ground, borderRadius: sys.radius.card, padding: layout.mapInset, minHeight: 96, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  zoomFrame: { width: ZOOM_FRAME, alignSelf: 'center', backgroundColor: sys.color.ground, overflow: 'hidden' },
});
