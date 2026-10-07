import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { sys } from '../system/tokens';
import type { DayMarkKind } from './planner';

/** The side of the box a mark is drawn in. The box is always there, so a day without a mark is as tall as a day with one. */
export const DAY_MARK_SIZE = 10;

/** What each mark means, for the day's spoken name: a mark is never the only way the day says it. */
export const DAY_MARK_SPOKEN: Readonly<Record<DayMarkKind, string>> = {
  waiting: 'nešto čeka tebe', active: 'ima Dogovor', open: 'ima zadatak ili prijavu na čekanju', finished: 'ima završen Dogovor',
};

/**
 * The one mark under a day number in the week and in the month (owner, 2026-10-07): a green dot for a Dogovor, an orange ring when
 * something waits for you, a dashed outline for an open task or application of yours, a grey dot for finished work. Shape and colour
 * say it together, and the day's spoken name says it in words. On a chosen day (filled green) the mark is white.
 */
export function DayMark({ kind, onGreen = false }: { kind: DayMarkKind | null; onGreen?: boolean }) {
  const color = onGreen ? sys.color.onDark : kind === 'waiting' ? sys.color.orangeInk : kind === 'active' ? sys.color.green : sys.color.muted;
  return <View testID="day-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: DAY_MARK_SIZE, height: DAY_MARK_SIZE }}>
    {kind ? <Svg width={DAY_MARK_SIZE} height={DAY_MARK_SIZE} viewBox="0 0 10 10">
      {kind === 'active' || kind === 'finished' ? <Circle cx={5} cy={5} r={3} fill={color} /> : null}
      {kind === 'waiting' ? <Circle cx={5} cy={5} r={3.2} fill="none" stroke={color} strokeWidth={1.8} /> : null}
      {kind === 'open' ? <Circle cx={5} cy={5} r={3.3} fill="none" stroke={color} strokeWidth={1.4} strokeDasharray="2.1 1.7" /> : null}
    </Svg> : null}
  </View>;
}
