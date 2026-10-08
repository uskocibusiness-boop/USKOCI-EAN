import { useState } from 'react';
import { Animated, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationMessage } from '../../aiFirst/AiConversationShell';
import { withInter } from '../../interFont';
import { Press } from '../../Press';
import { Glyph } from '../../system/Glyph';
import { KeyValueRow } from '../../system/KeyValueRow';
import { layout } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { Screen } from '../../system/Screen';
import { ScreenChrome } from '../../system/ScreenChrome';
import { StatusChip } from '../../system/StatusChip';
import { Surface } from '../../system/Surface';
import { brandAction, fieldBox, sys } from '../../system/tokens';
import { T } from '../../Text';
import type { Summary } from '../../v2/draftSummary';
import { valueSpoken } from '../../v2/TaskFace';
import { V2Action } from '../../v2/V2Action';
import { KadarOznaka, nazadNaSpisak, useSat, useTikU, uskok } from './pomocno';
import { OBJAVLJENO_RED, PRIMERI } from './podaci';
import { Nit } from './razgovorDelovi';

/**
 * AI razgovor · varijanta B „Reč vodi“ (iz reči; pravac B5 glas slova + B3; namerno suprotna A da se razlika vidi).
 *
 * POČETAK: iznad preloma nema lika. „Reci šta ti treba.“ 32/700 je žarište, pod njom jedna rečenica i POLJE (ne pilula) sa slanjem; primeri
 * su tihi redovi ispod. Asistent 24 se pojavljuje tek uz odgovore u niti. NACRT: priznanica (KeyValueRow) bez predmeta — Zadatak, Mesto, Kada,
 * Ljudi, Cena — i red „Opis“ čija je vrednost „Još treba“ sa radnjom „Dodaj“; jedna zelena „Pregledaj zadatak“. OBJAVLJENO: „Zadatak je
 * objavljen.“ 32/700, čip „Objavljen“ miran uz reč, priznanica, jedna rečenica i jedna zelena. Brojevi ulaze gotovi; pomera se samo papir.
 */
export function RazgovorB_Pocetak() {
  const [value, setValue] = useState('');
  const ready = value.trim().length > 0;
  return <SafeAreaView edges={['top', 'bottom']} style={s.platno}>
    <ScreenChrome variant="detail" tone="conversation" onBack={nazadNaSpisak} />
    <ScrollView contentContainerStyle={s.pocetak} keyboardShouldPersistTaps="handled">
      <View style={s.rec}>
        <T accessibilityRole="header" variant="display" style={s.display}>Reci šta ti treba.</T>
        <T variant="copy" tone="muted">Opiši zadatak svojim rečima. Pre objave sve pregledaš.</T>
      </View>
      <View style={s.poljeRed}>
        <TextInput accessibilityLabel="Poruka za asistenta" value={value} onChangeText={setValue} multiline maxLength={4000}
          placeholder="Napiši ili izgovori" placeholderTextColor={sys.color.muted} style={s.polje} />
        <Press accessibilityRole="button" accessibilityLabel={ready ? 'Pošalji poruku' : 'Drži da govoriš'} haptic={ready ? 'light' : 'none'} hitSlop={0}
          onPress={() => setValue('')} style={s.dugme}>
          <View style={[s.krug, ready && s.krugSpremno]}><Glyph name={ready ? 'send' : 'mic'} size={24} tone={ready ? 'onGreen' : 'ink'} /></View>
        </Press>
      </View>
      <View>
        <T variant="meta" tone="muted" style={s.primeriNaslov}>Na primer</T>
        {PRIMERI.map((primer, index) => <ListRow key={primer} title={primer} last={index === PRIMERI.length - 1} arrow={false}
          accessibilityLabel={primer} accessibilityHint="Upisuje ovo u polje da možeš da dopuniš." onPress={() => setValue(`${primer} `)} />)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

/** Nacrt kao priznanica: samo činjenice koje su stigle; red za ono što fali kaže „Još treba“ i nudi „Dodaj“. */
function cedulja(summary: Summary): { label: string; value: string; price?: boolean }[] {
  const rows: { label: string; value: string; price?: boolean }[] = [];
  if (summary.title) rows.push({ label: 'Zadatak', value: summary.title });
  if (summary.zone) rows.push({ label: 'Mesto', value: summary.zone });
  if (summary.schedule) rows.push({ label: 'Kada', value: summary.schedule });
  if (summary.people) rows.push({ label: 'Ljudi', value: summary.people });
  if (summary.value) rows.push({ label: 'Cena', value: valueSpoken(summary.value), price: summary.value.kind === 'amount' });
  return rows;
}

export function RazgovorB_Nacrt({ messages, summary, stillNeeded, holdAt }: { messages: readonly ConversationMessage[]; summary: Summary; stillNeeded: string | null; holdAt?: number }) {
  const sat = useSat(sys.motion.enter, holdAt);
  const redovi = cedulja(summary);
  return <SafeAreaView edges={['top', 'bottom']} style={s.platno}>
    <ScreenChrome variant="detail" tone="conversation" title="Novi zadatak" onBack={nazadNaSpisak} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.nit}>
      <Nit messages={messages} after={<Animated.View style={uskok(sat.clock, 0, 'below')}>
        <T variant="meta" tone="muted" style={s.stanje}>{stillNeeded ? `Nacrt · još treba: ${stillNeeded.toLocaleLowerCase('sr-Latn-RS')}` : 'Nacrt · spremno za pregled'}</T>
        <Surface kind="panel" testID="var-b-nacrt" style={s.priznanica}>
          {redovi.map((red, index) => <KeyValueRow key={red.label} label={red.label} value={red.value} emphasis={red.price ? 'price' : undefined} last={!stillNeeded && index === redovi.length - 1} />)}
          {stillNeeded ? <KeyValueRow label={stillNeeded} value="Još treba" action={{ label: 'Dodaj', onPress: () => undefined }} last /> : null}
        </Surface>
        <V2Action label={stillNeeded ? 'Pregledaj zadatak' : 'Pregledaj i objavi'} style={[brandAction, s.radnja]} onPress={() => undefined} />
      </Animated.View>} />
    </ScrollView>
    <KadarOznaka t={holdAt} />
  </SafeAreaView>;
}

export const OBJAVLJENO_B_TRAJANJE = sys.motion.enter;

export function RazgovorB_Objavljeno({ summary, holdAt }: { summary: Summary; holdAt?: number }) {
  const sat = useSat(OBJAVLJENO_B_TRAJANJE, holdAt);
  useTikU('success', 0, sat);
  return <Screen kind="detail">
    <Animated.View style={[s.objavljeno, uskok(sat.clock, 0, 'below')]}>
      <View style={s.rec}>
        <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="display" style={s.display}>Zadatak je objavljen.</T>
        <StatusChip status="task.published" />
        <T variant="copy" tone="muted">{OBJAVLJENO_RED}</T>
      </View>
      <Surface kind="panel" style={s.priznanica}>
        {cedulja(summary).map((red, index, all) => <KeyValueRow key={red.label} label={red.label} value={red.value} emphasis={red.price ? 'price' : undefined} last={index === all.length - 1} />)}
      </Surface>
      <V2Action label="Otvori zadatak" style={brandAction} onPress={nazadNaSpisak} />
    </Animated.View>
    <KadarOznaka t={holdAt} />
  </Screen>;
}

const s = StyleSheet.create({
  platno: { flex: 1, backgroundColor: sys.conversation.ground },
  pocetak: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: layout.gutter, paddingBottom: sys.space.lg, gap: layout.section },
  rec: { gap: sys.space.md, alignItems: 'flex-start' },
  display: { color: sys.color.ink },
  poljeRed: { flexDirection: 'row', alignItems: 'flex-end', gap: sys.space.sm },
  polje: withInter({ ...fieldBox, ...sys.type.body, flex: 1, minWidth: 0, color: sys.color.ink, maxHeight: 132, textAlignVertical: 'top' }),
  dugme: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  krug: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.wash },
  krugSpremno: { backgroundColor: sys.color.green },
  primeriNaslov: { paddingBottom: sys.space.xs },
  nit: { paddingBottom: sys.space.md },
  stanje: { paddingBottom: sys.space.sm },
  priznanica: { paddingVertical: sys.space.xs },
  radnja: { marginTop: sys.space.md },
  objavljeno: { gap: layout.section },
});
