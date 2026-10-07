import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { sys } from '../system/tokens';
import { cancellationLine } from './agreementListModel';
import { agreementStepModel, deadlineNote, stepsSummary, type OwnRating, type StepStatus } from './agreementStepsModel';

/** The drawn mark is 24 dp: a check, a dot or an outline. The connector between two marks is a 2 dp line. */
const MARK = 24;

/**
 * One step's mark. Shape and colour together: a green check behind us, a filled green dot where we are, a grey outline ahead and
 * the same grey outline all along for a cancelled Dogovor.
 */
function Mark({ status }: { status: StepStatus }) {
  if (status === 'done') return <View style={[s.mark, s.markDone]}><Glyph name="check" size={16} tone="onGreen" /></View>;
  if (status === 'current') return <View style={[s.mark, s.markCurrent]}><View style={s.dot} /></View>;
  return <View style={[s.mark, s.markAhead]} />;
}

/**
 * The step bar of a Dogovor, right under its tabs (plan 2.6): Dogovoreno, Zadatak je gotov, Potvrđeno, Ocena. It is computed from
 * the Dogovor's STATE (`agreementStepModel`), so it says where the Dogovor stands whatever its history holds. One summary for a
 * screen reader ("Zadatak je gotov: trenutni korak…"); the marks are drawing only.
 *
 * Under the second step stands one grey line: the real time the other side has to confirm, or that the automatic completion is
 * stopped while a problem is open. A cancelled Dogovor is grey as a whole and says so in one line: "Otkazano", and when the reader
 * gives them, when, by whom and why - never a reason that the data does not hold.
 */
export function AgreementSteps({ state, ownRating, deadlineIso, problemOpen = false, cancellation, now }: {
  state: DogovorProjekcija['stanje'];
  ownRating?: OwnRating;
  /** The server's own confirmation window end (`rokPotvrdeIso`). */
  deadlineIso?: string | null;
  problemOpen?: boolean;
  /** What the Dogovor carries about its cancellation; the projection holds none of it today, so this is usually left out. */
  cancellation?: { at?: string | null; by?: string | null; reason?: string | null } | null;
  /** Fixed by tests. */
  now?: Date;
}) {
  const steps = agreementStepModel(state, ownRating);
  const cancelled = state === 'CANCELLED';
  const note = deadlineNote({ state, deadlineIso, problemOpen });
  const position = steps.findIndex(step => step.status === 'current');
  return <View testID="agreement-steps" style={s.wrap}>
    {/* Named "Koraci Dogovora", not "Tok Dogovora": that is the history row below, and two controls must not share a name. */}
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Koraci Dogovora"
      accessibilityValue={position >= 0 ? { min: 1, max: steps.length, now: position + 1, text: stepsSummary(steps) } : { text: stepsSummary(steps) }}
      style={s.row}>
      {steps.map((step, index) => <View key={step.key} testID={`agreement-step-${step.key}`} style={s.step}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={s.markRow}>
          <View style={[s.line, index === 0 && s.lineNone, index > 0 && steps[index - 1].status === 'done' && s.lineOn]} />
          <Mark status={step.status} />
          <View style={[s.line, index === steps.length - 1 && s.lineNone, step.status === 'done' && s.lineOn]} />
        </View>
        <T variant="meta" style={[s.label, step.status === 'current' && s.labelCurrent, (step.status === 'upcoming' || cancelled) && s.labelAhead]}>{step.label}</T>
      </View>)}
    </View>
    {/* Under the second step: it starts where the first column ends. */}
    {note ? <View style={s.noteRow}><View style={s.noteGap} /><T testID="agreement-steps-note" variant="meta" tone="muted" style={s.note}>{note}</T></View> : null}
    {cancelled ? <T testID="agreement-steps-cancelled" variant="note" tone="muted" style={s.cancelled}>{cancellationLine(cancellation, now)}</T> : null}
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: sys.space.sm, paddingVertical: sys.space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, minWidth: 0, alignItems: 'center', gap: sys.space.xs },
  markRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: 2, borderRadius: 1, backgroundColor: sys.color.line },
  lineOn: { backgroundColor: sys.color.green },
  lineNone: { backgroundColor: 'transparent' },
  mark: { width: MARK, height: MARK, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: sys.color.green },
  markCurrent: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.green },
  markAhead: { backgroundColor: sys.color.surface, borderWidth: 1.5, borderColor: sys.color.lineStrong },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  label: { color: sys.color.ink, textAlign: 'center', paddingHorizontal: 2 },
  labelCurrent: { fontWeight: '600' },
  labelAhead: { color: sys.color.muted },
  noteRow: { flexDirection: 'row' },
  noteGap: { flex: 1 },
  note: { flex: 3 },
  cancelled: { textAlign: 'left' },
});
