import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';
import { easedProgress, type Kadar } from './kadar';

/**
 * A LOCAL copy of the system's `Arrive` (V41's "art arrive": a small rise, a tilt that straightens, full opacity, once, over
 * `sys.motion.arrive`) with ONE addition for the design lab: `kadar` freezes the picture at `t` ms on the same curve, so a
 * screenshot can show the settling that a still image otherwise loses. The numbers are `Arrive`'s own and are not changed;
 * the system file is not touched (V1 variants, 2026-10-08).
 */
export function ArriveVar({ children, delay = 80, kadar = null }: { children: ReactNode; delay?: number; kadar?: Kadar }) {
  const reduced = useReducedMotion();
  const frame = (at: number) => easedProgress(at, delay, sys.motion.arrive.duration, sys.motion.arrive.easing);
  const progress = useRef(new Animated.Value(reduced ? 1 : kadar === null ? 0 : frame(kadar))).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    if (kadar !== null) { progress.setValue(frame(kadar)); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.arrive.duration, delay,
      easing: Easing.bezier(...sys.motion.arrive.easing), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, delay, kadar, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  const translateY = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [4, -3, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['-3deg', '1deg', '0deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.65, 1, 1] });
  return <Animated.View style={{ opacity, transform: [{ translateY }, { rotate }] }}>{children}</Animated.View>;
}
