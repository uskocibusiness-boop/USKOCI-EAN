import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';
import { easedProgress, uskokDelay, type Kadar } from './kadar';

/**
 * B1 "Uskok sa smerom" (creative direction 2026-10-08), as a LOCAL wrapper for the V1 variants: the one entrance of the app
 * (8 dp, `enter` 240 ms, `easeOut`, the stagger of `Appear`), with the one thing `Appear` does not have yet: a DIRECTION. What
 * arrives from the other side (an application, a message, a candidate) comes in from ABOVE; what you lay on the table
 * (your task, your Dogovor) comes in from BELOW, as today. The proposal for the system is `Appear` gaining `from: 'above' | 'below'`
 * (one `withInitialValues` sign); until then this file plays the same numbers on RN `Animated` (native driver, transform and
 * opacity only). Whether the view moves is decided once, at mount (rule R4); under reduced motion it is a plain `View`.
 *
 * `kadar` (lab only): the frame at `t` ms, frozen on the same curve, so a screenshot can show the arrival.
 */
/** How far outside its place the thing starts: 8 dp, the rise of `Appear` and of the outcome bar. */
const RISE = sys.space.sm;

export function UskokVar({ from, index = 0, animate = true, kadar = null, children, style }: {
  from: 'above' | 'below'; index?: number; animate?: boolean; kadar?: Kadar; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const still = useRef(reduced || !animate).current;
  const frame = (at: number) => easedProgress(at, uskokDelay(index), sys.motion.enter, sys.motion.easeOut);
  const progress = useRef(new Animated.Value(still ? 1 : kadar === null ? 0 : frame(kadar))).current;
  useEffect(() => {
    if (still) return;
    if (kadar !== null) { progress.setValue(frame(kadar)); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.enter, delay: uskokDelay(index),
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [still, kadar, index, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  if (still) return <View style={style}>{children}</View>;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from === 'above' ? -RISE : RISE, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
