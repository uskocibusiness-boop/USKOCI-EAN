import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { sys } from '../system/tokens';
import type { DayMarkKind } from './planner';

/** The side of the box a mark is drawn in. The box is always there, so a day without a mark is as tall as a day with one. */
export const DAY_MARK_SIZE = 10;

/** What each mark means, for the day's spoken name: a mark is never the only way the day says it. */
export const DAY_MARK_SPOKEN: Readonly<Record<DayMarkKind, string>> = {
  waiting: 'nešto čeka tebe', active: 'ima Dogovor', finished: 'ima završen Dogovor',
};

/**
 * The one mark under a day number in the week and in the month: a DOT, for a day that has a Dogovor on it, and no other shape (the
 * owner's phone, 8 Oct 2026: "crtice i tačkasti krug ispod dana bez značenja"; the dashed ring was for a task or an application of mine,
 * which Raspored no longer holds). The colour says the rest and the day's spoken name says it in words: orange when something waits for
 * you, green for a Dogovor ahead, grey for finished work. On a chosen day (filled green) the dot is white.
 */
export function DayMark({ kind, onGreen = false }: { kind: DayMarkKind | null; onGreen?: boolean }) {
  // The orange of a mark that has no words beside it is the one made for orange on white (the action orange is 2.5:1 there).
  const color = onGreen ? sys.color.onDark : kind === 'waiting' ? sys.color.orangeInk : kind === 'active' ? sys.color.green : sys.color.muted;
  return <View testID="day-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: DAY_MARK_SIZE, height: DAY_MARK_SIZE }}>
    {kind ? <Svg width={DAY_MARK_SIZE} height={DAY_MARK_SIZE} viewBox="0 0 10 10"><Circle cx={5} cy={5} r={3.2} fill={color} /></Svg> : null}
  </View>;
}
