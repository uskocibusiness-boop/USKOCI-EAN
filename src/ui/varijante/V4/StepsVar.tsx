import { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../../contracts/projections';
import { agreementStepModel, stepsSummary, type OwnRating, type StepStatus } from '../../agreements/agreementStepsModel';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { tick } from '../../system/haptics';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';
import { useLabClock, useProgress } from './lab';
import { ZnakPecat } from './parts';

/**
 * The step bar of a Dogovor as the V4 variants draw it: a LOCAL copy of `AgreementSteps` with two additions the report proposes
 * for the system component. `seal`: the first step, once done, is the handshake mark at 28 instead of a green check (pravac B2
 * "ostatak", P11). `moment`: the step "Potvrđeno" has just been reached while the person looks (pravac C.4): the line runs to
 * its mark over `enter`, the mark turns from the dot into the check over `toggle`, the next step's dot settles in, and the
 * success tick lands when the check is whole. The words of the steps never move (rule: a state word is a fact).
 */
const MARK = 24;
const DOT = 10;
const LINE = 2;
/** Where a dot that has just become the current one starts from, as `AgreementSteps` has it. */
const DOT_FROM = 0.6;
/** The moment "Potvrđeno": the line's share (`enter`) and then the check (`toggle`). */
export const POTVRDA_MS = sys.motion.enter + sys.motion.toggle;
const LINE_END = sys.motion.enter / POTVRDA_MS;

function Line({ on, none, fill }: { on: boolean; none: boolean; fill?: Animated.AnimatedInterpolation<number> }) {
  if (none) return <View style={[s.line, s.lineNone]} />;
  if (!fill) return <View style={[s.line, on && s.lineOn]} />;
  // The grey line stays; the green one grows over it from the left (transform only).
  return <View style={s.line}><Animated.View style={[s.lineFill, { transform: [{ scaleX: fill }] }]} /></View>;
}

function Mark({ status, seal, confirming, progress, popping }: { status: StepStatus; seal: boolean; confirming: boolean; progress: Animated.Value; popping: boolean }) {
  if (confirming) {
    // The current look fades out as the done look fades in: two marks in one place, only opacity moves.
    const was = progress.interpolate({ inputRange: [LINE_END, Math.min(1, LINE_END + 0.2)], outputRange: [1, 0], extrapolate: 'clamp' });
    const now = progress.interpolate({ inputRange: [LINE_END, 1], outputRange: [0, 1], extrapolate: 'clamp' });
    return <View style={s.mark}>
      <Animated.View style={[s.markFill, s.markCurrent, { opacity: was }]}><View style={s.dot} /></Animated.View>
      <Animated.View style={[s.markFill, s.markDone, { opacity: now }]}><Glyph name="check" size={16} tone="onGreen" /></Animated.View>
    </View>;
  }
  if (status === 'done') return seal ? <ZnakPecat /> : <View style={[s.mark, s.markDone]}><Glyph name="check" size={16} tone="onGreen" /></View>;
  if (status === 'current') {
    const scale = popping ? progress.interpolate({ inputRange: [LINE_END, 1], outputRange: [DOT_FROM, 1], extrapolate: 'clamp' }) : 1;
    return <View style={[s.mark, s.markCurrent]}><Animated.View style={[s.dot, { transform: [{ scale }] }]} /></View>;
  }
  return <View style={[s.mark, s.markAhead]} />;
}

export function StepsVar({ state, ownRating = 'NOT_APPLICABLE', seal = false, moment = false }: {
  state: DogovorProjekcija['stanje']; ownRating?: OwnRating;
  /** The first step, done, is the mark of USKOČI (the seal of the Dogovor). */
  seal?: boolean;
  /** "Potvrđeno" was reached just now, while the person looks. */
  moment?: boolean;
}) {
  const steps = agreementStepModel(state, ownRating);
  const progress = useProgress(POTVRDA_MS);
  const frozen = useLabClock(), reduced = useReducedMotion();
  useEffect(() => {
    if (!moment || frozen !== null) return;
    // The tick of an outcome, on the first frame that shows it whole (MOTION N5); under reduced motion the picture is whole at once.
    const id = setTimeout(() => tick('success'), reduced ? 0 : sys.motion.enter);
    return () => clearTimeout(id);
  }, [moment, frozen, reduced]);
  const position = steps.findIndex(step => step.status === 'current');
  const half = LINE_END / 2;
  const firstHalf = progress.interpolate({ inputRange: [0, half], outputRange: [0, 1], extrapolate: 'clamp' });
  const secondHalf = progress.interpolate({ inputRange: [half, LINE_END], outputRange: [0, 1], extrapolate: 'clamp' });
  return <View testID="var-steps" style={s.wrap}>
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Koraci Dogovora"
      accessibilityValue={position >= 0 ? { min: 1, max: steps.length, now: position + 1, text: stepsSummary(steps) } : { text: stepsSummary(steps) }}
      style={s.row}>
      {steps.map((step, index) => {
        const confirming = moment && index === 2;
        return <View key={step.key} style={s.step} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={s.markRow}>
            <Line none={index === 0} on={index > 0 && steps[index - 1].status === 'done'} fill={confirming ? secondHalf : undefined} />
            <Mark status={step.status} seal={seal && index === 0} confirming={confirming} progress={progress} popping={moment && index === 3} />
            <Line none={index === steps.length - 1} on={step.status === 'done'} fill={moment && index === 1 ? firstHalf : undefined} />
          </View>
          <T variant="meta" style={[s.label, step.status === 'current' && s.labelCurrent, step.status === 'upcoming' && s.labelAhead]}>{step.label}</T>
        </View>;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, minWidth: 0, alignItems: 'center', gap: sys.space.xs },
  markRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: LINE, borderRadius: sys.radius.pill, backgroundColor: sys.color.line, overflow: 'hidden' },
  lineOn: { backgroundColor: sys.color.green },
  lineNone: { backgroundColor: 'transparent' },
  lineFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: sys.color.green, transformOrigin: 'left' },
  mark: { width: MARK, height: MARK, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  markFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: sys.color.green },
  markCurrent: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.green },
  markAhead: { backgroundColor: sys.color.surface, borderWidth: 1.5, borderColor: sys.color.lineStrong },
  dot: { width: DOT, height: DOT, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  label: { color: sys.color.ink, textAlign: 'center', paddingHorizontal: 2 },
  labelCurrent: { fontWeight: '600' },
  labelAhead: { color: sys.color.muted },
});
