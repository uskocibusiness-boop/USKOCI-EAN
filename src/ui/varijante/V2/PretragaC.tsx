import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { layout } from '../../system/layout';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';
import { KORACI, PRAZAN, PretragaList, PretragaPodnozje, SECTION_LABEL, Urednik, brojZadataka, rezime, type Izmena, type Korak, type Nacrt } from './pretragaShared';
import { Uskok } from './shared';

/** Debljina linije napretka: 4 dp (nacrt), zaobljena; ostatak dodira je u 48 visokom polju iznad nje. */
const LINIJA = sys.space.xs;

/**
 * Varijanta C pretrage „Korak po korak“ (iz pokreta; pravac B1). Struktura: JEDAN odeljak po kadru panela; izbor koji dovršava pitanje sam vodi
 * na sledeći korak posle 240 ms, a nov kadar uskače odozgo (samo transform i providnost, bez animacije visine); tanka linija napretka 4 dp
 * od šest delova (prošli zeleno, sadašnji mastilo), dodir dela preskače na bilo koji korak; mesta su lista do celog ekrana; dno je uvek
 * „Prikaži N zadataka“. Pod smanjenim pokretom korak se menja odmah. `kadar` zamrzava ulazak kadra za niz snimaka laboratorije.
 */
export function PretragaC({ start = 'gde', kadar }: { start?: Korak; kadar?: number }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState<Nacrt>(PRAZAN);
  const [step, setStep] = useState<Korak>(start);
  const [typed, setTyped] = useState('');
  const [frame, setFrame] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const index = KORACI.indexOf(step);
  const go = (next: Korak) => { Keyboard.dismiss(); setStep(next); setFrame(current => current + 1); };
  const onChange: Izmena = (patch, complete) => {
    setN(current => ({ ...current, ...patch }));
    if (!complete) return;
    const next = KORACI[index + 1];
    if (!next) return;
    if (timer.current) clearTimeout(timer.current);
    if (reduced) { go(next); return; }
    // Izbor se prvo vidi izabran, pa kadar ode dalje: isti `enter` kao uskok koji sledi.
    timer.current = setTimeout(() => go(next), sys.motion.enter);
  };
  return <PretragaList footer={<PretragaPodnozje count={brojZadataka(n)} onReset={() => { setN(PRAZAN); setTyped(''); }} />}>
    <View style={s.napredak} accessibilityRole="tablist">
      {KORACI.map((korak, at) => <Press key={korak} accessibilityRole="tab" accessibilityLabel={`${SECTION_LABEL[korak]}: ${rezime(korak, n)}`}
        accessibilityState={{ selected: korak === step }} onPress={() => go(korak)} haptic="select" hitSlop={0} scaleTo={1} style={s.deo}>
        <View style={[s.crta, at < index && s.crtaGotovo, korak === step && s.crtaSada]} />
      </Press>)}
    </View>
    <Uskok key={frame} from="above" kadar={kadar} play={frame > 0 || kadar !== undefined} style={s.fill}>
      <ScrollView style={s.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        <View style={s.glava}>
          <T variant="heading" accessibilityRole="header" style={s.ink}>{SECTION_LABEL[step]}</T>
          <T variant="meta" tone="muted" style={s.brojac}>{`${index + 1} od ${KORACI.length}`}</T>
        </View>
        <Urednik step={step} n={n} onChange={onChange} typed={typed} onType={setTyped} />
      </ScrollView>
    </Uskok>
  </PretragaList>;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  ink: { color: sys.color.ink },
  // Šest delova linije, 4 između, 20 od ivice; svaki deo je dodir od 48 sa linijom na dnu.
  napredak: { flexDirection: 'row', gap: sys.space.xs, paddingHorizontal: layout.gutter },
  deo: { flex: 1, height: layout.touch, justifyContent: 'flex-end' },
  crta: { height: LINIJA, borderRadius: sys.radius.pill, backgroundColor: sys.color.line },
  crtaGotovo: { backgroundColor: sys.color.green },
  crtaSada: { backgroundColor: sys.color.ink },
  body: { paddingHorizontal: layout.gutter, paddingTop: sys.space.base, paddingBottom: sys.space.base, gap: sys.space.md },
  glava: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: sys.space.md },
  brojac: { fontVariant: ['tabular-nums'] },
});
