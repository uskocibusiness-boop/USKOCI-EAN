import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationMessage } from '../../aiFirst/AiConversationShell';
import { AiAssistantArt } from '../../aiFirst/AiAssistantArt';
import { Press } from '../../Press';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { Screen } from '../../system/Screen';
import { ScreenChrome } from '../../system/ScreenChrome';
import { Surface } from '../../system/Surface';
import { brandAction, sys } from '../../system/tokens';
import { T } from '../../Text';
import type { Summary } from '../../v2/draftSummary';
import { valueSpoken } from '../../v2/TaskFace';
import { V2Action } from '../../v2/V2Action';
import { KadarOznaka, Pozornica, kadar, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { OBJAVLJENO_RED, PRIMERI } from './podaci';
import { MARKER_VISINA, MapaTile, Marker, Nit, Pilula } from './razgovorDelovi';

/**
 * AI razgovor · varijanta C „Pin sleće“ (iz pokreta; pravac B1 Uskok predmeta + haptika na kontaktu; R3 E3).
 *
 * POČETAK: pilula za pisanje stoji u SREDINI ekrana, na mekom plavom sjaju glasa (isti sjaj kao glasovni režim), asistent 88 iznad,
 * primeri ispod: ekran poziva da se progovori. NACRT: razgovor je tek počeo da se slaže i nacrt ne staje u karticu: on je plutajuća
 * TRAKA tik iznad pilule (`float`), jedan red činjenica i „Pregledaj“, i uskače ODOZDO (moje ide na sto, B1) kad stigne. OBJAVLJENO:
 * marker mape aplikacije pada na malu mapu (240 ms, bez odskoka, D3), krug raste i bledi 600 ms, tik `light` na dodiru; „Zadatak je
 * objavljen.“, rečenica, zeleno „Otvori zadatak“. Jedan veći crtež (mapa) + jedan mali (marker) u kadru.
 */
export function RazgovorC_Pocetak() {
  return <SafeAreaView edges={['top', 'bottom']} style={s.platno}>
    <ScreenChrome variant="detail" tone="conversation" title="Novi zadatak" onBack={nazadNaSpisak} />
    <ScrollView contentContainerStyle={s.pocetak} keyboardShouldPersistTaps="handled">
      <View style={s.dobrodoslica}>
        <AiAssistantArt size={88} />
        <T accessibilityRole="header" variant="title" style={s.naslov}>Reci šta ti treba.</T>
      </View>
      <View style={s.pozornicaPilule}>
        <View pointerEvents="none" style={s.sjaj} />
        <Pilula placeholder="Napiši ili izgovori" />
      </View>
      <View>
        <T variant="meta" tone="muted" style={s.primeriNaslov}>Na primer</T>
        {PRIMERI.map((primer, index) => <ListRow key={primer} title={primer} last={index === PRIMERI.length - 1} arrow={false}
          trailing={<Glyph name="arrow-up-right" tone="muted" />} accessibilityLabel={primer} accessibilityHint="Upisuje ovo u poruku da možeš da dopuniš." onPress={() => undefined} />)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

export function RazgovorC_Nacrt({ messages, summary, stillNeeded, holdAt }: { messages: readonly ConversationMessage[]; summary: Summary; stillNeeded: string | null; holdAt?: number }) {
  const sat = useSat(sys.motion.enter, holdAt);
  const delovi = [summary.title, summary.zone || null, summary.schedule ?? null, summary.people, summary.value ? valueSpoken(summary.value) : null].filter((d): d is string => !!d);
  return <SafeAreaView edges={['top', 'bottom']} style={s.platno}>
    <ScreenChrome variant="detail" tone="conversation" title="Novi zadatak" onBack={nazadNaSpisak} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.nit}><Nit messages={messages} /></ScrollView>
    <Pilula above={<Animated.View style={uskok(sat.clock, 0, 'below')}>
      <Surface kind="float" testID="var-c-nacrt" style={s.traka}>
        <Press accessibilityRole="button" accessibilityLabel={`Nacrt: ${delovi.join(', ')}${stillNeeded ? `. Još treba: ${stillNeeded}` : ''}`} accessibilityHint="Otvara pregled svih podataka pre objave."
          haptic="select" scaleTo={1} onPress={() => undefined} style={s.trakaRed}>
          <View style={[s.tacka, !stillNeeded && s.tackaSpremno]} />
          <View style={s.trakaTekst}>
            <T variant="note" numberOfLines={2} style={s.trakaDelovi}>{delovi.join(' · ')}</T>
            {stillNeeded ? <T variant="meta" tone="muted">{`Još treba: ${stillNeeded.toLocaleLowerCase('sr-Latn-RS')}`}</T> : null}
          </View>
          <T variant="note" tone="green" style={s.pregledaj}>Pregledaj</T>
          <Glyph name="caret-right" size={20} tone="green" />
        </Press>
      </Surface>
    </Animated.View>} />
    <KadarOznaka t={holdAt} />
  </SafeAreaView>;
}

const MAPA = 144;
const PAD = sys.motion.enter;
/** Krug koji raste i bledi od dodira: 600 ms (pravac C.9). Tokena nema (glow 1600 je petlja): ime ovde; predlog `sys.motion.ripple`. */
const KRUG_MS = 600;
/** Odakle marker kreće: 48 dp iznad mesta, nikad kao skok preko ekrana. */
const PAD_VISINA = sys.space.huge;
export const OBJAVLJENO_C_TRAJANJE = PAD + KRUG_MS + sys.motion.enter;

export function RazgovorC_Objavljeno({ holdAt }: { holdAt?: number }) {
  const sat = useSat(OBJAVLJENO_C_TRAJANJE, holdAt);
  useTikU('light', PAD, sat);
  useTikU('success', PAD + sys.motion.toggle, sat);
  const marker = { opacity: kadar(sat.clock, 0, sys.motion.press, [0, 1]), transform: [{ translateY: kadar(sat.clock, 0, PAD, [-PAD_VISINA, 0]) }] };
  const krug = { opacity: kadar(sat.clock, PAD, PAD + KRUG_MS, [0.5, 0]), transform: [{ scale: kadar(sat.clock, PAD, PAD + KRUG_MS, [0.6, 1.8]) }] };
  return <Screen kind="detail" scroll={false}>
    <Pozornica>
      <View style={s.mapa} accessible accessibilityRole="image" accessibilityLabel="Zadatak je na mapi">
        <MapaTile size={MAPA} />
        <Animated.View pointerEvents="none" style={[s.krug, krug]} />
        <Animated.View style={[s.marker, marker]}><Marker /></Animated.View>
      </View>
      <Animated.View style={[s.reci, uskok(sat.clock, PAD, 'below')]}>
        <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="title" style={s.naslov}>Zadatak je objavljen.</T>
        <T variant="copy" tone="muted" style={s.naslov}>{OBJAVLJENO_RED}</T>
      </Animated.View>
      <Animated.View style={[s.radnja, uskok(sat.clock, PAD + sys.motion.enter, 'below')]}>
        <V2Action label="Otvori zadatak" style={brandAction} onPress={nazadNaSpisak} />
      </Animated.View>
    </Pozornica>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const KRUG = 56;
const s = StyleSheet.create({
  platno: { flex: 1, backgroundColor: sys.conversation.ground },
  pocetak: { flexGrow: 1, justifyContent: 'center', paddingBottom: sys.space.lg, gap: layout.section },
  dobrodoslica: { alignItems: 'center', gap: sys.space.md, paddingHorizontal: layout.gutter },
  naslov: { color: sys.color.ink, textAlign: 'center' },
  pozornicaPilule: { justifyContent: 'center' },
  // Isti sjaj kao glasovni režim (`VoiceComposer` GlowPill): meka plava kapsula ispod pilule; miruje dok mikrofon ne čuje.
  sjaj: { position: 'absolute', left: layout.gutter, right: layout.gutter, top: sys.space.xs, bottom: sys.space.sm, borderRadius: sys.radius.sheet,
    backgroundColor: sys.color.artRole.location.front, opacity: 0.14, transform: [{ scaleX: 1.04 }, { scaleY: 1.2 }] },
  primeriNaslov: { paddingBottom: sys.space.xs, paddingHorizontal: layout.gutter },
  nit: { paddingBottom: sys.space.md },
  traka: { marginHorizontal: sys.space.sm, paddingVertical: sys.space.sm, paddingHorizontal: sys.space.md },
  trakaRed: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch },
  tacka: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  tackaSpremno: { backgroundColor: sys.color.green },
  trakaTekst: { flex: 1, minWidth: 0, gap: 2 },
  trakaDelovi: { color: sys.color.ink },
  pregledaj: { fontWeight: '600' },
  mapa: { width: MAPA, height: MAPA, alignItems: 'center', justifyContent: 'center' },
  krug: { position: 'absolute', width: KRUG, height: KRUG, borderRadius: sys.radius.pill, borderWidth: 2, borderColor: sys.color.artRole.location.front,
    left: (MAPA - KRUG) / 2, top: (MAPA - KRUG) / 2 + sys.space.md },
  marker: { position: 'absolute', top: (MAPA - MARKER_VISINA) / 2 - sys.space.base },
  reci: { alignItems: 'center', gap: sys.space.sm, maxWidth: 320 },
  radnja: { alignSelf: 'center', maxWidth: 320, width: '100%' },
});
