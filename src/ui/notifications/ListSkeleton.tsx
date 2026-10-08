import { Animated, StyleSheet, View } from 'react-native';
import { useBreath } from '../system/Arrive';
import { layout } from '../system/layout';
import { sys } from '../system/tokens';

/** The face of a conversation and its slot, and the height of its row: 12, the name 24, the preview 20, the task 18, 12. */
const FACE = 48;
const CONVERSATION_ROW = 86;

/**
 * What a list of rows shows while its first read is on its way (UI/UX pass, 2026-10-08; composition spec T7): placeholders of the
 * geometry of the row that is coming — the picture in its slot, two lines, the same 12 above and below, the same 64 dp (86 with a
 * face, which has three lines) — so nothing moves when the real rows arrive, and the whole list breathes as ONE (one loop for the list, never one per block).
 *
 * Presentation only, and for the three lists of this family (Početna, Obaveštenja, Poruke); the system's `Skeleton` draws cards. When
 * the system gets a row variant of its own (F8b), this file goes and the three callers take that one.
 *
 * The picture is a circle of 32 (`face`: 48, the face of a conversation, which has three lines and is 86 high), the first line is 16
 * high and the second 12; `heading` puts a group heading's bar over
 * the rows; `switches` swaps the picture for the pill of a switch at the end of the row (a settings list has no pictures). It is hidden
 * from a screen reader; the sentence the caller puts under it ("Učitavamo obaveštenja…") says what is happening.
 */
export function ListSkeleton({ rows = 4, face = false, heading = false, switches = false, label }: {
  rows?: number; face?: boolean; heading?: boolean;
  /** Rows of a settings list: no picture, and a switch where the picture would be at the other end (R33's screen, 56 dp rows). */
  switches?: boolean;
  /** For a caller that has no sentence of its own under it: the one thing a screen reader is told about the whole block. */ label?: string;
}) {
  const opacity = useBreath();
  const slot = face ? FACE : layout.slot;
  const art = face ? FACE : 32;
  return <Animated.View accessible={label ? true : undefined} accessibilityLabel={label} importantForAccessibility="no-hide-descendants"
    accessibilityElementsHidden={!label} style={[s.list, { opacity }]}>
    {heading ? <View style={s.heading} /> : null}
    {Array.from({ length: rows }, (_, index) => <View key={index} style={[s.row, { minHeight: face ? CONVERSATION_ROW : layout.rowMin }]}>
      {switches ? null : <View style={[s.slot, { width: slot }]}><View style={{ width: art, height: art, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton }} /></View>}
      <View style={s.lines}>
        <View style={[s.line, { width: index % 2 ? '52%' : '64%' }]} />
        <View style={[s.line, s.second]} />
        {face ? <View style={[s.line, s.second, s.third]} /> : null}
      </View>
      {switches ? <View style={s.pill} /> : null}
    </View>)}
  </Animated.View>;
}

const s = StyleSheet.create({
  list: { gap: 0 },
  heading: { width: 96, height: 20, marginVertical: sys.space.xs, borderRadius: sys.radius.chip, backgroundColor: sys.color.skeleton },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md },
  slot: { alignItems: 'center', justifyContent: 'center' },
  lines: { flex: 1, minWidth: 0, gap: sys.space.sm },
  line: { height: 16, borderRadius: sys.radius.chip, backgroundColor: sys.color.skeleton },
  second: { width: '40%', height: 12 },
  third: { width: '28%' },
  // The size of the platform switch the real row draws (51 by 31), so the row does not change height when it arrives.
  pill: { width: 51, height: 31, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton },
});
