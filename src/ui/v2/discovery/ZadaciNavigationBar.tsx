import { useMemo } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { ZadaciBar } from './zadaciBar';

/** Discovery moves its own host. The navigator keeps its keyboard animation and height measurement inside it. */
export function ZadaciNavigationBar({ bar, visible, ...props }: BottomTabBarProps & { bar: ZadaciBar; visible: boolean }) {
  const route = props.state.routes[props.state.index], discovery = route.name === 'zadaci';
  const options = props.descriptors[route.key].options;
  const routeStyle = StyleSheet.flatten(options.tabBarStyle);
  const fullScreen = !!routeStyle && 'display' in routeStyle && routeStyle.display === 'none';
  const motion = useMemo(() => ({ position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: bar.height,
    transform: [{ translateY: bar.hidden.interpolate({ inputRange: [0, 1], outputRange: [0, bar.height + 1] }) }] }), [bar.hidden, bar.height]);
  const hidden = fullScreen || (discovery && !visible);
  return <Animated.View testID={discovery ? visible ? 'zadaci-navigation-visible' : 'zadaci-navigation-hidden' : 'navigation-bar'}
    pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    style={[discovery ? motion : undefined, fullScreen ? styles.absent : undefined, hidden ? styles.hidden : undefined]}>
    <BottomTabBar {...props} />
  </Animated.View>;
}
const styles = StyleSheet.create({ absent: { display: 'none' }, hidden: { opacity: 0 } });
