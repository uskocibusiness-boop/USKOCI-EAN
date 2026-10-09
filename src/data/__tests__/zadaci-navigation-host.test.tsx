import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NavigationContainer, createNavigationContainerRef } from 'expo-router/react-navigation';
import { BottomTabBar, createBottomTabNavigator } from 'expo-router/js-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ZadaciNavigationBar } from '../../ui/v2/discovery/ZadaciNavigationBar';
import { zadaciBarStyle, type ZadaciBar } from '../../ui/v2/discovery/zadaciBar';

// Real navigator and BottomTabBar: no mock of the host that previously obscured the physical sheet.
const Navigator = createBottomTabNavigator(), Blank = () => null;
const navigation = createNavigationContainerRef<{ index: undefined; zadaci: undefined; detail: undefined }>();
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 40, bottom: 24, left: 0, right: 0 } };
function Shell({ bar, visible }: { bar: ZadaciBar; visible: boolean }) {
  return <SafeAreaProvider initialMetrics={metrics}><NavigationContainer ref={navigation}>
    <Navigator.Navigator initialRouteName="zadaci" backBehavior="history"
      tabBar={props => <ZadaciNavigationBar {...props} bar={bar} visible={visible} />}
      screenOptions={({ route }) => ({ headerShown: false, animation: 'none', tabBarStyle: route.name === 'zadaci'
        ? zadaciBarStyle({ height: bar.height - 24, marginBottom: 24 }, bar) : route.name === 'detail' ? { display: 'none' } : { height: 56, marginBottom: 24 } })}>
      <Navigator.Screen name="index" component={Blank} /><Navigator.Screen name="zadaci" component={Blank} />
      <Navigator.Screen name="detail" component={Blank} />
    </Navigator.Navigator>
  </NavigationContainer></SafeAreaProvider>;
}
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
test('PEEK/HALF and other routes keep one real bar inside a distinct stable motion host', async () => {
  const bar = { hidden: new Animated.Value(1), height: 80 };
  await act(async () => { tree = create(<Shell bar={bar} visible={false} />); });
  const host = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.testID?.startsWith('zadaci-navigation'))[0];
  expect(tree.root.findAllByType(BottomTabBar)).toHaveLength(1);
  const peek = StyleSheet.flatten(host().props.style) as Record<string, any>, transform = peek.transform;
  expect(peek).toMatchObject({ position: 'absolute', height: 80, opacity: 0 });
  expect(transform[0].translateY.__getValue()).toBe(81);
  expect(host().props.pointerEvents).toBe('none'); expect(host().props.importantForAccessibility).toBe('no-hide-descendants');
  await act(async () => { bar.hidden.setValue(0); tree.update(<Shell bar={bar} visible />); });
  expect(StyleSheet.flatten(host().props.style).transform).toBe(transform);
  expect(host().props.pointerEvents).toBe('box-none');
  await act(async () => { bar.hidden.setValue(1); tree.update(<Shell bar={bar} visible={false} />); });
  expect(StyleSheet.flatten(host().props.style).opacity).toBe(0);
  const taller = { ...bar, height: 96 };
  await act(async () => tree.update(<Shell bar={taller} visible={false} />));
  expect((StyleSheet.flatten(host().props.style) as any).transform[0].translateY.__getValue()).toBe(97);
  await act(async () => navigation.navigate('index'));
  const ordinary = tree.root.findAll(node => typeof node.type !== 'string' && node.props.testID === 'navigation-bar')[0];
  expect(StyleSheet.flatten(ordinary.props.style)?.position).toBeUndefined(); expect(ordinary.props.pointerEvents).toBe('box-none');
  await act(async () => navigation.navigate('detail'));
  const full = tree.root.findAll(node => typeof node.type !== 'string' && node.props.testID === 'navigation-bar')[0];
  expect(StyleSheet.flatten(full.props.style).display).toBe('none');
  await act(async () => navigation.goBack()); expect(navigation.getCurrentRoute()?.name).toBe('index');
});
