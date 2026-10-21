import { memo, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Animated, AppState, Easing, View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

const SOURCE = require('../../../assets/ai/uskoci-assistant.png');

/** Existing USKOČI robot identity, shared by task and work-profile interviews.
 * Static art identifies the assistant; it never signals capture, speech or a completed action. It stands at 24 beside what it says in the
 * thread, at 44 in compact context, and at 88 or 128 for an opening. The same
 * character identifies the assistant without implying a server result. */
export type AiAssistantArtProps = {
  size: 24 | 44 | 88 | 128;
  animated?: boolean;
};

/** Existing USKOČI robot identity, shared by task and work-profile interviews.
 * Static art identifies the assistant at small sizes (24); living HD breathing and blink/wink micro-motions
 * bring it alive at hero sizes (88 and 128) using pure native-driver Animated transforms (B22). */
export const AiAssistantArt = memo(function AiAssistantArt({ size, animated }: AiAssistantArtProps) {
  const reduced = useReducedMotion();
  const shouldAnimate = animated ?? (size >= 88);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const winkAnim = useRef(new Animated.Value(0)).current;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!shouldAnimate || reduced || !foreground) {
      floatAnim.setValue(0);
      blinkAnim.setValue(0);
      winkAnim.setValue(0);
      return;
    }

    // 1. Organic breathing float & gentle 2.5D micro-tilt
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: sys.motion.assistant.floatHalf,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: sys.motion.assistant.floatHalf,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    );
    floatLoop.start();

    // 2. Periodic natural eye blink and friendly wink
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const scheduleNextBlink = () => {
      if (cancelled) return;
      const delay = sys.motion.assistant.nextBlinkMin + Math.random() * sys.motion.assistant.nextBlinkJitter;
      timer = setTimeout(() => {
        if (cancelled || AppState.currentState !== 'active') return;
        const isWink = Math.random() < 0.3;
        if (isWink) {
          Animated.sequence([
            Animated.timing(winkAnim, { toValue: 1, duration: sys.motion.assistant.winkClose, easing: Easing.ease, useNativeDriver: true }),
            Animated.timing(winkAnim, { toValue: 0, duration: sys.motion.assistant.winkOpen, easing: Easing.ease, useNativeDriver: true }),
          ]).start(() => scheduleNextBlink());
        } else {
          Animated.sequence([
            Animated.timing(blinkAnim, { toValue: 1, duration: sys.motion.assistant.blinkClose, easing: Easing.ease, useNativeDriver: true }),
            Animated.timing(blinkAnim, { toValue: 0, duration: sys.motion.assistant.blinkOpen, easing: Easing.ease, useNativeDriver: true }),
          ]).start(() => scheduleNextBlink());
        }
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      floatLoop.stop();
    };
  }, [shouldAnimate, reduced, foreground, floatAnim, blinkAnim, winkAnim]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -size * 0.045],
  });
  const rotate = floatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '1.2deg', '-0.8deg'],
  });
  const scale = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const leftEyeStyle = {
    position: 'absolute' as const,
    left: size * 0.33,
    top: size * 0.53,
    width: size * 0.19,
    height: size * 0.19,
    borderRadius: size * 0.095,
    backgroundColor: '#0F1215',
  };

  const rightEyeStyle = {
    position: 'absolute' as const,
    left: size * 0.61,
    top: size * 0.54,
    width: size * 0.18,
    height: size * 0.18,
    borderRadius: size * 0.09,
    backgroundColor: '#0F1215',
  };

  const slitColor = '#3FF3B8';
  const leftSlitStyle = {
    position: 'absolute' as const,
    left: size * 0.35,
    top: size * 0.62,
    width: size * 0.15,
    height: Math.max(2, size * 0.02),
    borderRadius: size * 0.01,
    backgroundColor: slitColor,
  };
  const rightSlitStyle = {
    position: 'absolute' as const,
    left: size * 0.63,
    top: size * 0.63,
    width: size * 0.14,
    height: Math.max(2, size * 0.02),
    borderRadius: size * 0.01,
    backgroundColor: slitColor,
  };

  const leftLidOpacity = blinkAnim;
  const rightLidOpacity = Animated.add(blinkAnim, winkAnim);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        transform: shouldAnimate ? [{ translateY }, { rotate }, { scale }] : undefined,
      }}
    >
      <Image
        source={SOURCE}
        contentFit="contain"
        transition={0}
        cachePolicy="memory"
        allowDownscaling
        accessible={false}
        style={{ width: size, height: size }}
      />
      {shouldAnimate && size >= 88 ? (
        <>
          <Animated.View style={[leftEyeStyle, { opacity: leftLidOpacity }]} />
          <Animated.View style={[leftSlitStyle, { opacity: leftLidOpacity }]} />
          <Animated.View style={[rightEyeStyle, { opacity: rightLidOpacity }]} />
          <Animated.View style={[rightSlitStyle, { opacity: rightLidOpacity }]} />
        </>
      ) : null}
    </Animated.View>
  );
});

export type AssistantWelcomeMemory = { key: string | undefined; consumed: boolean };

/** One short opacity arrival for an empty conversation. Not a hand-wave or listening animation.
 * The shell owns the memory so hiding the opening for the keyboard cannot replay it. */
export function AiAssistantWelcome({ conversationKey, memory }: {
  conversationKey?: string;
  memory: MutableRefObject<AssistantWelcomeMemory>;
}) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const first = memory.current.key !== conversationKey || !memory.current.consumed;
    memory.current = { key: conversationKey, consumed: true };
    opacity.stopAnimation(); opacity.setValue(1);
    if (!first || reduced || AppState.currentState !== 'active') return;
    opacity.setValue(0);
    // Follow the app's B22 native-driver policy; no Reanimated view lifecycle or per-frame JS.
    const run = Animated.timing(opacity, { toValue: 1, duration: sys.motion.enter,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true, isInteraction: false });
    const settle = () => { run.stop(); opacity.setValue(1); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') settle(); });
    run.start();
    return () => { subscription.remove(); settle(); };
  }, [conversationKey, memory, opacity, reduced]);
  return <Animated.View style={{ opacity }}><AiAssistantArt size={88} /></Animated.View>;
}
