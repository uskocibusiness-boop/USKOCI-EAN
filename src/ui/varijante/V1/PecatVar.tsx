import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';
import { easedProgress, type Kadar } from './kadar';

/**
 * B3 "Pečat" (creative direction 2026-10-08), as a LOCAL wrapper for the V1 variants: the state pill of something YOU laid on the
 * table falls onto it, 1,25 × → 1 with its opacity 0 → 1, and lands without a bounce. The word inside enters already final: the
 * container moves, never the text (rule P5). The direction asks for 140 ms, which `sys.motion` does not have; the nearest token is
 * `toggle` (180), used here, and the proposal is a `sys.motion.stamp` of 140. `tilted` keeps the pill at −4° (a stamp on a
 * receipt); a pill in a list card lands straight. Under reduced motion the pill is simply there. `kadar` (lab) freezes a frame.
 */
/** The size the stamp lands from, and its tilt on a receipt (direction B3). */
const FROM_SCALE = 1.25;
const TILT = '-4deg';

export function PecatVar({ animate = true, kadar = null, delay = 0, tilted = false, children }: {
  animate?: boolean; kadar?: Kadar; /** ms after the scene starts, so a stamp can follow an arrival. */ delay?: number;
  tilted?: boolean; children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const still = useRef(reduced || !animate).current;
  const frame = (at: number) => easedProgress(at, delay, sys.motion.toggle, sys.motion.easeOut);
  const progress = useRef(new Animated.Value(still ? 1 : kadar === null ? 0 : frame(kadar))).current;
  useEffect(() => {
    if (still) return;
    if (kadar !== null) { progress.setValue(frame(kadar)); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.toggle, delay, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [still, kadar, delay, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  const tilt = tilted ? [{ rotate: TILT }] : [];
  if (still) return <View style={[s.stamp, tilted && { transform: tilt }]}>{children}</View>;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [FROM_SCALE, 1] });
  return <Animated.View style={[s.stamp, { opacity: progress, transform: [{ scale }, ...tilt] }]}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  // The pill is as wide as its word, so the fall scales around the pill's own middle and not the row's.
  stamp: { alignSelf: 'flex-start' },
});
