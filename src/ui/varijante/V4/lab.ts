import { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';

/**
 * V4 laboratory helpers (variants of the Dogovor, the rating and the profile; pravac "Preko stola", 8. okt 2026). Nothing here
 * reads or writes data, and nothing here is production code: a chosen variant is carried into the app in a later wave.
 *
 * `LabClock` is the one thing the lab adds to a scene: a moment in milliseconds after the trigger at which every motion of the
 * scene stands still, so a picture can show t = 0, 150, 400 and 900 ms of a movement the lab cannot film. Null (the app, and a
 * scene drawn without a frame) lets the motion run. The values a frozen scene shows are the values the real curve has at that
 * moment, computed with the same easing the motion uses, so a frame is a true still of the movement and not a drawing of it.
 */
export const noop = () => {};

export const LabClock = createContext<number | null>(null);
export const useLabClock = () => useContext(LabClock);

/** The frames the lab photographs of one movement (zadatak §4): right after the trigger, mid-way, settled, and well after. */
export const FRAME_TIMES = [0, 150, 400, 900] as const;

/** Where a decelerating movement of `duration` ms (after `delay` ms) stands at `t` ms: 0 before it starts, 1 once it has settled. */
export function easedAt(t: number, duration: number, delay = 0, curve: readonly [number, number, number, number] = sys.motion.easeOut): number {
  if (duration <= 0) return t >= delay ? 1 : 0;
  const share = Math.max(0, Math.min(1, (t - delay) / duration));
  return Easing.bezier(curve[0], curve[1], curve[2], curve[3])(share);
}

/**
 * One progress value 0 → 1 on the native driver, decelerating (rule R2: every entrance is handed `easeOut` explicitly). Under
 * reduced motion it is 1 at once (rule R7: a state change is instant); in the lab it is frozen at the value the curve has at
 * `LabClock`. Only `transform` and `opacity` are ever driven by it (rule R1).
 */
export function useProgress(duration: number, delay = 0, curve: readonly [number, number, number, number] = sys.motion.easeOut): Animated.Value {
  const frozen = useLabClock();
  const reduced = useReducedMotion();
  const start = frozen !== null ? easedAt(frozen, duration, delay, curve) : reduced ? 1 : 0;
  const value = useRef(new Animated.Value(start)).current;
  useEffect(() => {
    if (frozen !== null) { value.setValue(easedAt(frozen, duration, delay, curve)); return; }
    if (reduced) { value.setValue(1); return; }
    value.setValue(0);
    const run = Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.bezier(curve[0], curve[1], curve[2], curve[3]), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [frozen, reduced, duration, delay, curve, value]);
  return value;
}
