import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

export function AnimatedRadar({
  size = 22,
  color = sys.color.ink,
  sweepColor = sys.color.orange,
  animate = true,
}: {
  size?: number;
  color?: string;
  sweepColor?: string;
  animate?: boolean;
}) {
  const rotation = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!animate || reduced || !foreground || process.env.NODE_ENV === 'test') {
      rotation.setValue(0.125);
      return;
    }
    rotation.setValue(0);
    const anim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: sys.motion.radarSweep,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [animate, reduced, foreground, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background static radar grid & target blip */}
      <Svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
        {/* Outer Ring */}
        <Ellipse cx={12} cy={12} rx={10.5} ry={10.5} stroke={color} strokeWidth={1.2} strokeOpacity={0.25} fill="none" />
        {/* Middle Ring */}
        <Ellipse cx={12} cy={12} rx={6.5} ry={6.5} stroke={color} strokeWidth={1} strokeOpacity={0.18} fill="none" />
        {/* Center Target Dot */}
        <Ellipse cx={12} cy={12} rx={1.8} ry={1.8} fill={color} />
        {/* Subtle Crosshairs */}
        <Path d="M12 2 v20 M2 12 h20" stroke={color} strokeWidth={0.8} strokeOpacity={0.15} />
        {/* Found Task Target Blip */}
        <Ellipse cx={16} cy={8} rx={1.5} ry={1.5} fill={sweepColor} opacity={0.85} />
      </Svg>

      {/* Rotating Radar Sweep Ray */}
      <Animated.View style={{ width: size, height: size, transform: [{ rotate: spin }] }}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Defs>
            <LinearGradient id="sweepSector" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={sweepColor} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={sweepColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>
          {/* Sweeping Wedge */}
          <Path d="M12 12 L22 12 A10 10 0 0 0 19.07 4.93 Z" fill="url(#sweepSector)" />
          {/* Leading Beam Line */}
          <Path d="M12 12 L22 12" stroke={sweepColor} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}
