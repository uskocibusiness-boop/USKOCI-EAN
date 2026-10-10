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
  // A native-driver transform / display:none from Discovery must not survive into another root.
  // Keep the host stable throughout Discovery's detents, and detach it only at a navigation mode boundary.
  const mode = discovery ? 'discovery' : fullScreen ? 'full' : 'root';
  return <Animated.View key={mode} testID={discovery ? visible ? 'zadaci-navigation-visible' : 'zadaci-navigation-hidden' : 'navigation-bar'}
    pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    style={[discovery ? motion : styles.ordinary, fullScreen ? styles.absent : undefined, hidden ? styles.hidden : styles.visible]}>
    <BottomTabBar {...props} />
  </Animated.View>;
}
const styles = StyleSheet.create({ ordinary: { transform: [{ translateY: 0 }] }, absent: { display: 'none' }, hidden: { opacity: 0 }, visible: { display: 'flex', opacity: 1 } });
