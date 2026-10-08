import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationMessage } from '../../aiFirst/AiConversationShell';
import { Press } from '../../Press';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { Screen } from '../../system/Screen';
import { ScreenChrome } from '../../system/ScreenChrome';
import { Section } from '../../system/Section';
import { StatusChip } from '../../system/StatusChip';
import { Surface } from '../../system/Surface';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import type { Summary } from '../../v2/draftSummary';
import { valueSpoken } from '../../v2/TaskFace';
import { V2Action } from '../../v2/V2Action';
import { KadarOznaka, OTKRIVANJE_MS, Pozornica, dolazak, nazadNaSpisak, pecat, useSat, useTikU, uskok } from './pomocno';
import { OBJAVLJENO_RED, PRIMERI } from './podaci';
import { AiAssistantArtVarA, Nit, Pilula } from './razgovorDelovi';

/**
 * AI razgovor · varijanta A „Asistent i sto“ (iz predmeta; pravac C.24 početak, C.6 nacrt, C.1 Objavljeno; potezi B1 + B3 + B6).
 *
 * POČETAK: asistent 128 je jedini lik u aplikaciji i jedini predmet ≥ 48 na ekranu; pod njim „Reci šta ti treba.“ i tri rečenice-primera
 * kao redovi (nikad kategorije), pilula za pisanje sa mikrofonom dole. NACRT: kad asistent razume činjenicu, njen predmet 28 (pin,
 * kalendar, ljudi, etiketa) USKOČI odozgo u karticu nacrta, jedan za drugim (120 ms, 60 ms razmaka); ono što još ne zna ostaje siva
 * silueta sa „Dodaj“. Ništa se ne izmišlja: red postoji samo za činjenicu koja je stigla. Tik `light` na poslednjem. OBJAVLJENO: papir sa
 * pinom i olovkom 144 sleže kroz dolazak (B6), pilula „Objavljen“ pada uz naslov (B3), jedna rečenica, jedno zeleno „Otvori zadatak“ na
 * sredini. Sve na satu trenutka; `holdAt` je kadar za laboratoriju.
 */
export function RazgovorA_Pocetak() {
  return <SafeAreaView edges={['top', 'bottom']} style={s.platno}>
    <ScreenChrome variant="detail" tone="conversation" title="Novi zadatak" onBack={nazadNaSpisak} />
    <ScrollView contentContainerStyle={s.pocetak} keyboardShouldPersistTaps="handled">
      <View style={s.dobrodoslica}>
        <AiAssistantArtVarA size={128} />
        <T accessibilityRole="header" variant="title" style={s.naslov}>Reci šta ti treba.</T>
        <T variant="copy" tone="muted" style={s.sredina}>Opiši zadatak svojim rečima. Pre objave sve pregledaš.</T>
      </View>
      <Section title="Na primer">
        {PRIMERI.map((primer, index) => <ListRow key={primer} title={primer} last={index === PRIMERI.length - 1} arrow={false}
          trailing={<Glyph name="arrow-up-right" tone="muted" />} accessibilityLabel={primer} accessibilityHint="Upisuje ovo u poruku da možeš da dopuniš." onPress={() => undefined} />)}
      </Section>
    </ScrollView>
    <Pilula />
  </SafeAreaView>;
}

/** Razmak između predmeta koji sleću u nacrt: 60 ms (pravac C.6). Tokena nema (stagger 40): ime ovde, predlog `sys.motion.stagger` × 1,5 u izveštaju. */
const NALEPNICA_RAZMAK = 60;

type Nalepnica = { art: FactArtKind; text: string };
function nalepnice(summary: Summary): Nalepnica[] {
  const rows: Nalepnica[] = [];
  if (summary.zone) rows.push({ art: summary.zone === 'Na daljinu' ? 'remote' : 'pin', text: summary.zone });
  if (summary.schedule) rows.push({ art: 'calendar', text: summary.schedule });
  if (summary.people) rows.push({ art: 'users', text: summary.people });
  if (summary.value) rows.push({ art: summary.value.kind === 'amount' ? 'money' : 'offers', text: valueSpoken(summary.value) });
  return rows;
}

export function RazgovorA_Nacrt({ messages, summary, stillNeeded, holdAt }: { messages: readonly ConversationMessage[]; summary: Summary; stillNeeded: string | null; holdAt?: number }) {
  const redovi = nalepnice(summary);
  const total = (redovi.length - 1) * NALEPNICA_RAZMAK + OTKRIVANJE_MS + sys.motion.enter;
  const sat = useSat(total, holdAt);
  useTikU('light', (redovi.length - 1) * NALEPNICA_RAZMAK + OTKRIVANJE_MS, sat);
  return <SafeAreaView edges={['top', 'bottom']} style={s.platno}>
    <ScreenChrome variant="detail" tone="conversation" title="Novi zadatak" onBack={nazadNaSpisak} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.nit}>
      <Nit messages={messages} after={<Surface kind="panel" testID="var-a-nacrt" style={s.nacrt}>
        <View style={s.stanje}><View style={[s.tacka, !stillNeeded && s.tackaSpremno]} /><T variant="label" style={s.stanjeRec}>{stillNeeded ? 'Nacrt' : 'Spremno za pregled'}</T></View>
        <T variant="cardTitleCompact" style={s.nacrtNaslov}>{summary.title ?? 'Zadatak u nastajanju'}</T>
        <View style={s.cinjenice}>
          {redovi.map((red, index) => <Animated.View key={red.art} style={[s.cinjenica, uskok(sat.clock, index * NALEPNICA_RAZMAK, 'above', OTKRIVANJE_MS)]}>
            <FactArt kind={red.art} size={28} />
            <T variant="note" style={s.cinjenicaTekst}>{red.text}</T>
          </Animated.View>)}
          {stillNeeded ? <Press accessibilityRole="button" accessibilityLabel={`Dodaj: ${stillNeeded}`} accessibilityHint="Otvara pitanje u razgovoru." haptic="select" scaleTo={sys.motion.scale.row} onPress={() => undefined} style={s.cinjenica}>
            <FactArt kind="document" size={28} muted />
            <T variant="note" tone="green" style={s.dodaj}>{`Dodaj: ${stillNeeded.toLocaleLowerCase('sr-Latn-RS')}`}</T>
          </Press> : null}
        </View>
        <Animated.View style={uskok(sat.clock, total - sys.motion.enter, 'below')}>
          <V2Action label={stillNeeded ? 'Pregledaj zadatak' : 'Pregledaj i objavi'} style={brandAction} onPress={() => undefined} />
        </Animated.View>
      </Surface>} />
    </ScrollView>
    <Pilula />
    <KadarOznaka t={holdAt} />
  </SafeAreaView>;
}

const PREDMET = sys.motion.arrive.duration;
export const OBJAVLJENO_A_TRAJANJE = PREDMET + sys.motion.toggle + sys.motion.enter;

export function RazgovorA_Objavljeno({ holdAt }: { holdAt?: number }) {
  const sat = useSat(OBJAVLJENO_A_TRAJANJE, holdAt);
  useTikU('success', PREDMET, sat);
  return <Screen kind="detail" scroll={false}>
    <Pozornica>
      <Animated.View style={dolazak(sat.clock, 0)}><FactArt kind="publish" size={144} /></Animated.View>
      <Animated.View style={[s.reci, uskok(sat.clock, sys.motion.enter, 'below')]}>
        <View style={s.naslovRed}>
          <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="title" style={s.naslov}>Zadatak je objavljen.</T>
          <Animated.View style={pecat(sat.clock, PREDMET)}><StatusChip status="task.published" /></Animated.View>
        </View>
        <T variant="copy" tone="muted" style={s.sredina}>{OBJAVLJENO_RED}</T>
      </Animated.View>
      <Animated.View style={[s.radnja, uskok(sat.clock, sys.motion.enter * 2, 'below')]}>
        <V2Action label="Otvori zadatak" style={brandAction} onPress={nazadNaSpisak} />
      </Animated.View>
    </Pozornica>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  platno: { flex: 1, backgroundColor: sys.conversation.ground },
  pocetak: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: layout.chatList, paddingBottom: sys.space.lg, gap: layout.section },
  dobrodoslica: { alignItems: 'center', gap: sys.space.md, alignSelf: 'center', maxWidth: 440, width: '100%' },
  naslov: { color: sys.color.ink, textAlign: 'center' },
  sredina: { textAlign: 'center' },
  nit: { paddingBottom: sys.space.md },
  nacrt: { marginHorizontal: 0, gap: sys.space.md, paddingVertical: sys.space.md },
  stanje: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  tacka: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  tackaSpremno: { backgroundColor: sys.color.green },
  stanjeRec: { color: sys.color.muted, letterSpacing: 0 },
  nacrtNaslov: { color: sys.color.ink },
  cinjenice: { gap: sys.space.sm },
  cinjenica: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 28 },
  cinjenicaTekst: { flex: 1, minWidth: 0, color: sys.color.fact },
  dodaj: { flex: 1, minWidth: 0, fontWeight: '600' },
  reci: { alignItems: 'center', gap: sys.space.sm, maxWidth: 320 },
  naslovRed: { alignItems: 'center', gap: sys.space.md },
  radnja: { alignSelf: 'center', maxWidth: 320, width: '100%' },
});
