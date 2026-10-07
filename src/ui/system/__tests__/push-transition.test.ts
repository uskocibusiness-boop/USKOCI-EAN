import { Children, createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Easing } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabLayout from '../../../app/(app)/_layout';
import { sys } from '../tokens';

/**
 * The transition of a screen that is PUSHED inside the `(app)` navigator (motion pass, M-01; spec N1). It is the most frequent
 * movement in the app, around thirty screens use it, and until this item it had a duration and no curve: a navigator
 * `transitionSpec` replaces the preset's whole config, and a timing without an `easing` runs on React Native's own ease-in-out,
 * which has covered 3 % of the way after the first tenth of the time. Rule R2 of `sys.motion`: every entrance is passed
 * `easeOut` explicitly, and a push is as long as an entrance (240 ms).
 *
 * This reads the options the layout hands the navigator, like `__tests__/tabLayoutSafeAreaContract.test.ts` (which is not
 * extended: other work changes it). It is configuration, not a rendered transition: how it feels is for a phone to say.
 */
let mockReducedMotion = false;
jest.mock('../../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReducedMotion }));
jest.mock('expo-router', () => {
  const Tabs = () => null;
  Tabs.Screen = () => null;
  return { Tabs };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: jest.fn() }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'useWindowDimensions' ? mockDimensions : Reflect.get(target, key) });
});
const mockDimensions = jest.fn();
jest.mock('../../referenceEntry/ReferenceEntryHero', () => ({ CanonicalMark: () => null }));

type Options = { animation?: string; transitionSpec?: { animation: string; config: { duration: number; easing: (t: number) => number } };
  tabBarStyle?: { display?: string } };
type ScreenProps = { name: string; options: Options };

/** The navigator's options as the layout hands them over: every registered screen, and the options the root screens share. */
function navigator() {
  mockDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 24, left: 0, right: 0, bottom: 0 });
  let tree!: ReactTestRenderer;
  act(() => { tree = create(createElement(TabLayout)); });
  const layout = tree.root.findByType(Tabs);
  const screens = (Children.toArray(layout.props.children) as ReactElement<ScreenProps>[]).map(screen => screen.props);
  const route = { name: 'index', key: 'home' };
  const shared: Options = layout.props.screenOptions({ route, navigation: {
    getState: () => ({ index: 0, routes: [route], history: [{ type: 'route', key: route.key }] }),
  } });
  act(() => tree.unmount());
  return { screens, shared };
}

/** The three roots are switched to, never pushed; the redirects hand over to Zadaci without moving. */
const ROOTS = ['index', 'zadaci', 'dogovori'];
const REDIRECTS = ['moje-aktivnosti', 'prilike', 'mapa'];
const pushedScreens = (screens: ScreenProps[]) => screens.filter(screen => !ROOTS.includes(screen.name) && !REDIRECTS.includes(screen.name)
  && screen.options.tabBarStyle?.display === 'none');

afterEach(() => { mockReducedMotion = false; });

describe('a pushed screen enters on the one curve of every entrance, over the length of one (M-01, R2)', () => {
  it('shifts in, over exactly `sys.motion.push`, which is 240 ms: as long as something arriving, never longer', () => {
    const { screens } = navigator();
    const pushed = pushedScreens(screens);
    expect(pushed.length).toBeGreaterThan(25); // around thirty screens are pushed, not switched to
    expect(sys.motion.push).toBe(240);
    expect(sys.motion.push).toBeLessThanOrEqual(sys.motion.enter);
    for (const { name, options } of pushed) {
      expect([name, options.animation, options.transitionSpec?.animation, options.transitionSpec?.config.duration])
        .toEqual([name, 'shift', 'timing', sys.motion.push]);
    }
  });

  it('is passed `easeOut` explicitly: the curve of `sys.motion.easeOut`, not the library\'s own ease-in-out that a missing easing falls back to', () => {
    const { screens } = navigator();
    const { easing } = pushedScreens(screens)[0].options.transitionSpec!.config;
    expect(typeof easing).toBe('function');
    const out = Easing.bezier(...sys.motion.easeOut), fallback = Easing.inOut(Easing.ease);
    for (const t of [0, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) expect(easing(t)).toBeCloseTo(out(t), 6);
    // It decelerates: well on its way after a tenth of the time, where the fallback has hardly left.
    expect(easing(0.1)).toBeGreaterThan(0.3);
    expect(fallback(0.1)).toBeLessThan(0.05);
    // And it has arrived before the end: nine tenths of the way by about a third of the time.
    expect(easing(0.4)).toBeGreaterThan(0.9);
    expect(fallback(0.4)).toBeLessThan(0.4);
  });

  it('is ONE transition for every pushed screen: the same spec, not thirty spellings of it', () => {
    const { screens } = navigator();
    const [first, ...rest] = pushedScreens(screens);
    for (const { name, options } of rest) expect([name, options.transitionSpec]).toEqual([name, first.options.transitionSpec]);
    for (const { name, options } of rest) expect([name, options.transitionSpec === first.options.transitionSpec]).toEqual([name, true]);
  });

  it('leaves the three roots instant (a tab is not a place you went to) and the redirects still', () => {
    const { screens, shared } = navigator();
    expect(shared.animation).toBe('none');
    for (const name of ROOTS) {
      const options = screens.find(screen => screen.name === name)!.options;
      expect([name, options.animation, options.transitionSpec]).toEqual([name, undefined, undefined]);
    }
    for (const name of REDIRECTS) expect([name, screens.find(screen => screen.name === name)!.options.animation]).toEqual([name, 'none']);
  });

  it('moves nothing under reduced motion: every pushed screen is `none` with no spec at all (R7)', () => {
    mockReducedMotion = true;
    const { screens } = navigator();
    const pushed = pushedScreens(screens);
    expect(pushed.length).toBeGreaterThan(25);
    for (const { name, options } of pushed) expect([name, options.animation, options.transitionSpec]).toEqual([name, 'none', undefined]);
  });
});
