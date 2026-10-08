import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../system/motion';
import { sys } from '../../system/tokens';
import { inOutQuad, type Kadar } from './kadar';

/**
 * B7 "Dah" (creative direction 2026-10-08), as a LOCAL component for the V1 variants: a green dot that breathes means "this is
 * live now" ("Slobodan sam sada" switched on, a Dogovor under way). The halo grows from 1 to 1,8 × and fades from 0,35 to 0 over
 * `loop.glow` (1600 ms), then rests for as long; one loop on a screen, only while the screen is focused (the scene is mounted only
 * while it is looked at), still under reduced motion. An orange dot never breathes: it waits. The proposal for the system is a
 * small `LiveDot` beside `Arrive`'s `useBreath`. `kadar` (lab only) freezes the breath at `t` ms.
 */
/** The diameter of the live dot: the direction says Ø 10, which the space ladder (8, 12) does not have, so it is named here. */
const DOT = 10;
/** How far the halo grows and how visible it starts (direction B7: 1 → 1,8; 0,35 → 0). */
const HALO_SCALE = 1.8;
const HALO_ALPHA = 0.35;

/** Where the breath stands at `at` ms: rising over one glow, then at rest for one glow. */
function breathAt(at: number): number {
  const glow = sys.motion.loop.glow, phase = at % (2 * glow);
  return phase < glow ? inOutQuad(phase / glow) : 0;
}

export function DahVar({ kadar = null, testID }: { kadar?: Kadar; testID?: string }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(kadar === null ? 0 : breathAt(kadar))).current;
  useEffect(() => {
    if (reduced) { progress.setValue(0); return; }
    if (kadar !== null) { progress.setValue(breathAt(kadar)); return; }
    const glow = sys.motion.loop.glow;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: glow, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(glow),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, kadar, progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, HALO_SCALE] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [HALO_ALPHA, 0] });
  return <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.box}>
    {reduced ? null : <Animated.View style={[s.halo, { opacity, transform: [{ scale }] }]} />}
    <View style={s.dot} />
  </View>;
}

const s = StyleSheet.create({
  box: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  halo: { ...StyleSheet.absoluteFill, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  dot: { width: DOT, height: DOT, borderRadius: sys.radius.pill, backgroundColor: sys.color.green, borderWidth: 1, borderColor: sys.color.surface },
});
