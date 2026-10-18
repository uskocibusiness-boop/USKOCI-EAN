import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import type { MarketplaceItem } from '../data/marketplaceView';
import { FACT_KINDS, FACT_SIZES, FactArt, type FactTone } from '../ui/system/FactArt';
import { Glyph, GLYPH_NAMES, GLYPH_SIZES, GLYPH_TONES } from '../ui/system/Glyph';
import { Pictogram, pictogramCatalog, type PictogramGroup } from '../ui/system/Pictogram';
import { PickerGrid, PickerTile } from '../ui/system/PickerTile';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { ChromeIconButton } from '../ui/system/ScreenChrome';
import { TabBarPreview } from '../ui/system/TabBarItem';
import { TaskCard } from '../ui/v2/TaskCard';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';
import { router } from 'expo-router';

/**
 * The USKOČI icon and pictogram board, on the real phone (owner's master UI/UX directive, step E, 2026-09-23).
 * Reached only by its address (uskociapp://dizajn-tabla) in the internal build; the store package shows nothing.
 * It draws every system icon on the size ladder (16, 20, 24, 32, 48, 64: the flat mark up to 24, the sticker above), the TWO
 * CUTS of the new system side by side at the sizes a card uses (sticker on the left, flat mark on the right; UI/UX pass
 * 2026-10-02, item 1.3), the two oranges of the accent tone, the four tones, every pictogram, the picker states on a real
 * selector, and the icons inside a real task card, on white and on ivory. The icons come from `FACT_KINDS`, so a new kind
 * appears here by being added. Nothing here reads or writes data.
 *
 * UI/UX pass, wave 2 (2026-10-02, items 2.1 and 2.3): the three sections at the top draw the new bottom tab bar from the parts the
 * real bar is made of (tap it: the capsule, the green pill, the cross-fade of the icon and its one pop), every control glyph of the
 * closed Glyph registry at its three sizes and in its tones, and a bare control beside the same control with a word, so the owner can
 * hold them in his hand and judge the bold 24 glyph and the caption on the real screen.
 *
 * It is NOT a before and after. Both cuts are drawn in the new single-tone colours: the old two-tone sticker (orange per
 * kind, the lighter emerald) cannot be put back without redrawing it, so the owner compares with the build already on his
 * phone, and with the screenshots taken before this pass, not with anything on this board.
 */
const SYSTEM = FACT_KINDS;
/** The sizes a card, a chip or a tab draws: the ones where the flat mark is drawn. */
const SMALL = [16, 20, 24];
/**
 * The kinds that wear the accent tone by default, and two that can: each drawn as the sticker (26) and as the flat mark (24)
 * in the accent. They are two oranges on purpose: the mark must be 3:1 against white and the vivid orange is 2.5:1.
 */
const ACCENT_KINDS = ['bell', 'star', 'alert', 'pin', 'calendar'] as const;
const TONES: [FactTone, string][] = [['brand', 'brand · zelena'], ['accent', 'accent · samo za pažnju'], ['quiet', 'quiet · nije aktivno'], ['danger', 'danger · nešto nije u redu']];
/** A handful of kinds that show the tones best: the ones a card, a tab and a notification actually put in orange or grey. */
const TONE_KINDS = ['calendar', 'users', 'pin', 'money', 'tasks', 'offers', 'alert', 'bell', 'star', 'check', 'publish', 'send'] as const;
const GROUPS: [PictogramGroup, string][] = [['vozila', 'Vozila'], ['alat', 'Oprema i alat'], ['usluge', 'Usluge'], ['ljudi', 'Ljudi i kapacitet']];
const IVORY = '#FBF7EF';
const noop = () => {};

/**
 * The card reads its one requirement line from the task's own conditions, then its vehicles, then its tools
 * (`detalji.zahtevi`), never from `uslovi`, which also holds skills. The samples carry each of the three, so the board
 * shows the info, vehicle and tool drawings where they are used, at 16 px (card review r3 item 11).
 */
const zahtevi = (patch: Partial<{ bitniUslovi: string[]; vozila: string[]; alati: string[] }>) => ({ kategorija: '', geografija: null,
  rezimLokacije: 'STATIONARY', zahtevi: { vestine: [], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch } });
const task = {
  id: 'tabla', naslov: 'Prenos ormana do kombija', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '24. sep · 17:00–19:00', statusTekst: 'Otvoren',
  uslovi: [], pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: { lat: 45.25, lng: 19.83 }, narucilacProfilId: 'p', rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
  ponudjenaCena: { iznos: 5500, prikaz: '5.500 RSD' }, narucilacIme: 'Nikola', narucilacOcena: '4,8', narucilacBrojOcena: 12,
  detalji: zahtevi({ bitniUslovi: ['Zgrada bez lifta', 'Orman je rasklopljen'] }),
} as unknown as MarketplaceItem;
const SAMPLES: MarketplaceItem[] = [task,
  { ...task, id: 'tabla-vozilo', naslov: 'Prevoz stvari do vikendice', rezimCene: 'OFFERS', detalji: zahtevi({ vozila: ['Kombi'] }) } as unknown as MarketplaceItem,
  { ...task, id: 'tabla-alat', naslov: 'Montaža police u hodniku', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000, prikaz: '2.000 RSD' },
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, detalji: zahtevi({ alati: ['Bušilica'] }) } as unknown as MarketplaceItem];

function Section({ title, children, ground = sys.color.surface }: { title: string; children: ReactNode; ground?: string }) {
  return <View style={[s.section, { backgroundColor: ground }]}>
    <T variant="heading" accessibilityRole="header" style={s.ink}>{title}</T>
    {children}
  </View>;
}

export default function DizajnTabla() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [vozila, setVozila] = useState<string[]>(['kombi', 'automobil']);
  const [usluga, setUsluga] = useState('selidba');
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const toggle = (kind: string) => setVozila(list => list.includes(kind) ? list.filter(k => k !== kind) : [...list, kind]);
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Tabla ikonica i piktograma" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={s.content}>
      {/* Wave 2, item 2.1: the new bar, built from the real parts. Not a navigation: nothing here goes anywhere. */}
      <Section title="Donja traka · dodirni da probaš">
        <T variant="meta" tone="muted">Isti delovi kao u pravoj traci: kapsula koja se pojavi iza izabrane stavke, zelena crtica na njenoj gornjoj ivici, ikonica koja se preliva iz oznake u nalepnicu i jedan mali poskok. Ako je u sistemu isključen pokret, promena je trenutna.</T>
        <TabBarPreview />
        <T variant="meta" tone="muted">Ovo nije pre i posle: staru traku poredi sa gradnjom koja je već na telefonu.</T>
      </Section>
      {/* Wave 2, item 2.3: every control glyph of the registry, at the three sizes, in the tones, and as an on-state. */}
      <Section title={`Glyph ikone kontrola · ${GLYPH_SIZES.join(' · ')}`}>
        <T variant="meta" tone="muted">Redom: 16 u tekstu, 20 u redu, 24 u traci; pa tonovi na 24; pa na zelenoj podlozi; pa uključeno (puna ikona). Debljina se bira sama: debela do 16 i za kvačicu, X, plus i minus, tanka od 20.</T>
        {GLYPH_NAMES.map(name => <View key={name} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{name}</T>
          <View style={s.pair}>{GLYPH_SIZES.map(size => <Glyph key={size} name={name} size={size} />)}</View>
          <View style={s.pair}>{GLYPH_TONES.filter(tone => tone !== 'onGreen').map(tone => <Glyph key={tone} name={name} size={24} tone={tone} />)}</View>
          <View style={s.onGreen}><Glyph name={name} size={24} tone="onGreen" /></View>
          <Glyph name={name} size={24} on />
        </View>)}
      </Section>
      {/* Wave 2, item 2.3: a bare control and the same control with its name, side by side. */}
      <Section title="Komande u traci · ikona i ikona sa rečju">
        <T variant="meta" tone="muted">Gore samo ikona (krug 44, debela ikona 24). Dole ista komanda sa rečju: samo za komande koje se ne pogađaju po slici. Reč je ime komande, ne uputstvo gde si.</T>
        <View style={s.commands}>
          <ChromeIconButton label="Filteri" glyph="filters" onPress={noop} />
          <ChromeIconButton label="Raspored obaveza" glyph="calendar" onPress={noop} />
          <ChromeIconButton label="Pretraga" glyph="search" onPress={noop} />
          <ChromeIconButton label="Više radnji" glyph="more" onPress={noop} />
        </View>
        <View style={s.commands}>
          <ChromeIconButton label="Filteri zadataka" glyph="filters" caption="Filteri" onPress={noop} />
          <ChromeIconButton label="Raspored obaveza" glyph="calendar" caption="Raspored" onPress={noop} />
          <ChromeIconButton label="Pretraga zadataka" glyph="search" caption="Pretraga" onPress={noop} />
        </View>
        <View style={s.commands}>
          <ChromeIconButton label="Filteri uključeni" glyph="filters" caption="Filteri" active onPress={noop} />
          <ChromeIconButton label="Filteri nisu dostupni" glyph="filters" caption="Filteri" disabled onPress={noop} />
          <ChromeIconButton label="Raspored bez kruga" glyph="calendar" caption="Raspored" quiet onPress={noop} />
        </View>
      </Section>
      <Section title={`Sistemske ikonice · ${FACT_SIZES.join(' · ')}`}>
        {SYSTEM.map(kind => <View key={kind} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{kind}</T>
          {FACT_SIZES.map(size => <FactArt key={size} kind={kind} size={size} />)}
        </View>)}
      </Section>
      {/* The two cuts of the NEW system at the three sizes a card draws. Not a before and after: both are in the new tones. */}
      <Section title={`Dva reza: nalepnica (levo) i oznaka (desno) · ${SMALL.join(' · ')}`}>
        <T variant="meta" tone="muted">Oba reza su u novim bojama. Staru dvobojnu nalepnicu ne možemo da vratimo bez ponovnog crtanja, pa uporedi sa gradnjom koja je već na telefonu.</T>
        {SYSTEM.map(kind => <View key={kind} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{kind}</T>
          <View style={s.pair}>{SMALL.map(size => <FactArt key={size} kind={kind} size={size} cut="art" />)}</View>
          <View style={s.pair}>{SMALL.map(size => <FactArt key={size} kind={kind} size={size} cut="mark" />)}</View>
        </View>)}
      </Section>
      {/* The accent tone in both cuts, side by side: the vivid orange of the sticker and the darker orange of the mark. */}
      <Section title="Dva narandžasta: nalepnica 26 (levo) · oznaka 24 (desno)">
        <T variant="meta" tone="muted">Mala oznaka mora da ima 3:1 prema beloj podlozi, a živa narandžasta ima 2,5:1, pa je oznaka tamnija i može da deluje malo smeđe.</T>
        {ACCENT_KINDS.map(kind => <View key={kind} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{kind}</T>
          <View style={s.pair}><FactArt kind={kind} size={26} tone="accent" /></View>
          <View style={s.pair}><FactArt kind={kind} size={24} tone="accent" /></View>
        </View>)}
      </Section>
      {/* One tone rule: green by default, orange only for what needs you, grey when not active, red when something is wrong. */}
      {TONES.map(([tone, title]) => <Section key={tone} title={`Ton · ${title} · 20`}>
        <View style={s.wrap}>{TONE_KINDS.map(kind => <FactArt key={kind} kind={kind} size={20} tone={tone} />)}</View>
      </Section>)}
      <Section title="Sistemske ikonice na slonovači" ground={IVORY}>
        <View style={s.wrap}>{SYSTEM.slice(0, 12).map(kind => <FactArt key={kind} kind={kind} size={32} />)}</View>
      </Section>
      {/* A card's facts are drawn at 16 px, below the rows above: every kind at that size, in one wrap. */}
      <Section title="Sistemske ikonice na kartici · 16">
        <View style={s.wrap}>{SYSTEM.map(kind => <FactArt key={kind} kind={kind} size={16} />)}</View>
      </Section>
      {GROUPS.map(([group, title]) => <Section key={group} title={`${title} · 32 · 40 · 48 · 64`}>
        {pictogramCatalog.filter(p => p.group === group).map(p => <View key={p.kind} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{p.label}</T>
          {[32, 40, 48, 64].map(size => <Pictogram key={size} kind={p.kind} size={size} />)}
        </View>)}
      </Section>)}
      <Section title="Izbor: koja vozila imaš? (više odgovora)">
        <PickerGrid>
          {(['bicikl', 'skuter', 'automobil', 'kombi', 'kamion', 'prikolica'] as const).map(kind =>
            <PickerTile key={kind} kind={kind} label={pictogramCatalog.find(p => p.kind === kind)!.label} selected={vozila.includes(kind)}
              disabled={kind === 'kamion'} reason={kind === 'kamion' ? 'Treba vozačka C' : undefined} onPress={() => toggle(kind)} />)}
        </PickerGrid>
      </Section>
      <Section title="Izbor: šta ti treba? (jedan odgovor)" ground={IVORY}>
        <PickerGrid>
          {(['selidba', 'ciscenje', 'basta', 'montaza'] as const).map(kind =>
            <PickerTile key={kind} kind={kind} mode="single" label={pictogramCatalog.find(p => p.kind === kind)!.label}
              selected={usluga === kind} onPress={() => setUsluga(kind)} />)}
        </PickerGrid>
      </Section>
      <Section title="Na pravoj kartici zadatka">
        {SAMPLES.map(sample => <TaskCard key={sample.id} item={sample} onOpen={() => {}} />)}
      </Section>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  content: { paddingBottom: 48 },
  section: { paddingHorizontal: 20, paddingVertical: 24, gap: 14, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  ink: { color: sys.color.ink },
  iconRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, minHeight: 64 },
  name: { width: 88 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  commands: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  // The one place a glyph is drawn white: on the green of the primary action.
  onGreen: { backgroundColor: sys.color.green, borderRadius: sys.radius.control, padding: 6 },
});
