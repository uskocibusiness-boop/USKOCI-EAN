import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { sys } from '../../system/tokens';

type Phase = 'closed' | 'opening' | 'open' | 'closing';

/**
 * How long an opening body waits for its first measurement before it simply appears. A measurement that never comes must
 * not leave the section invisible; the motion is decoration, the open section is the fact.
 */
export const MEASURE_GIVE_UP_MS = 300;

/**
 * The body of an open section, opened and closed over `enter` / `exit` on the decelerating curve (owner, 2026-10-07: every
 * section opens and closes smoothly, and the next one opens as one is chosen). Under reduced motion it is simply there, and
 * then gone.
 *
 * The motion is the height of a clipping frame, and only while it moves. The body is drawn in normal flow once it has
 * opened, so its height is always its natural height (Yoga's, never an animation's): a calendar that grows a sixth week
 * after it opened, or a list that gains a row, cannot be cut. While it moves, the body is laid out absolutely inside the
 * frame, so what is measured is its natural height and not the frame's. Both states are one tree: the body is never
 * mounted again, so a typed word or the calendar's month survives opening, closing and everything between.
 *
 * It is React Native's own Animated on the JS driver: a height is not something the native driver can move. (The system's
 * rule R1 keeps height out of motion; the owner asked for this one explicitly. It is a short move of one small frame.)
 */
export function Collapsible({ open, reduced, onSettled, onLayout, testID, children }: {
  open: boolean; reduced: boolean;
  /** The body has finished opening (`true`) or closing (`false`). Also called once for the state it starts in. */
  onSettled?: (open: boolean) => void;
  /** The frame's own layout, for a caller that places things by it. */
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string; children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const [natural, setNatural] = useState<number | null>(null);
  const height = useRef(new Animated.Value(0)).current;
  const now = useRef({ phase, natural, onSettled });
  now.current = { phase, natural, onSettled };

  // What the caller asks for.
  useEffect(() => {
    const standing = now.current.phase;
    if (open) {
      if (standing === 'open' || standing === 'opening') return;
      if (reduced) { setPhase('open'); return; }
      // A body that comes back is a new body: what was measured before is not what is about to be.
      if (standing === 'closed') { height.setValue(0); setNatural(null); }
      setPhase('opening');
    } else {
      if (standing === 'closed' || standing === 'closing') return;
      if (reduced) { setPhase('closed'); return; }
      if (standing === 'open') height.setValue(now.current.natural ?? 0);
      setPhase('closing');
    }
  }, [open, reduced, height]);

  // The motion itself.
  useEffect(() => {
    if (phase === 'opening') {
      if (natural === null) {
        const giveUp = setTimeout(() => setPhase('open'), MEASURE_GIVE_UP_MS);
        return () => clearTimeout(giveUp);
      }
      const run = Animated.timing(height, { toValue: natural, duration: sys.motion.enter, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: false });
      run.start(({ finished }) => { if (finished) setPhase('open'); });
      return () => run.stop();
    }
    if (phase === 'closing') {
      const run = Animated.timing(height, { toValue: 0, duration: sys.motion.exit, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: false });
      run.start(({ finished }) => { if (finished) setPhase('closed'); });
      return () => run.stop();
    }
  }, [phase, natural, height]);

  // Told once the body has arrived or left (and once for the state it began in), never in the middle of a move.
  useEffect(() => {
    if (phase === 'open') now.current.onSettled?.(true);
    else if (phase === 'closed') now.current.onSettled?.(false);
  }, [phase]);

  if (phase === 'closed') return null;
  const moving = phase === 'opening' || phase === 'closing';
  const measure = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    setNatural(current => current === next ? current : next);
  };
  return <Animated.View testID={testID} onLayout={onLayout} style={moving ? [s.frame, { height }] : undefined}>
    <View testID={testID ? `${testID}-natural` : undefined} style={moving ? s.natural : undefined} onLayout={measure}>{children}</View>
  </Animated.View>;
}

const s = StyleSheet.create({
  frame: { overflow: 'hidden' },
  natural: { position: 'absolute', top: 0, left: 0, right: 0 },
});
