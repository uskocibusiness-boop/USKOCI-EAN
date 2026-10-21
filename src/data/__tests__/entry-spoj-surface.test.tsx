import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

let mockPhase: 'loading' | 'intro' | 'welcome' = 'welcome';
let mockReduced = false;
let mockFrameTime: number | null = null;
let mockIntentTime: number | null = null;
const mockSharedAssignments: Array<() => void> = [];
// A native style handle survives renders. Removing it does not reset previously
// committed native values; tests can also execute its latest mapper without a
// React update, after delayed shared-value assignments arrive on the UI runtime.
const mockStyleReaders = new WeakMap<object, () => Record<string, unknown>>();
// One store answers both names (ui/system/motion, 2026-09-24): mocking it covers useSystemReducedMotion and every
// component that reads useReducedMotion directly, so the whole tree sees the value this suite chose.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/entry/spojBrandMath', () => {
  const actual = jest.requireActual('../../ui/entry/spojBrandMath');
  return { ...actual, brandFrame: (time: number, ...args: unknown[]) => actual.brandFrame(mockFrameTime ?? time, ...args) };
});
jest.mock('../../ui/entry/entryV49Math', () => {
  const actual = jest.requireActual('../../ui/entry/entryV49Math');
  return { ...actual, entryV49Intro: (time: number, ...args: unknown[]) => actual.entryV49Intro(mockFrameTime ?? time, ...args),
    entryV49Intent: (time: number, ...args: unknown[]) => actual.entryV49Intent(mockIntentTime ?? time, ...args) };
});
let mockAccount = { accountRevision: 0, user: null as null | { id: string } };
let mockFontScale = 1;
let mockWindow = { width: 390, height: 844 };
let mockInsets = { top: 33, bottom: 0, left: 0, right: 0 };
const mockFinish = jest.fn();
const mockForeground = new Set<(state: string) => void>();
const mockTiming = jest.fn((value: number) => value);
const mockCancel = jest.fn();
const mockReadyLayout = jest.fn();
const mockSceneReady = jest.fn();
const mockImageMounted = jest.fn();
const mockImageUnmounted = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ ...mockWindow, fontScale: mockFontScale });
    if (key === 'AppState') return { addEventListener: (_: string, callback: (state: string) => void) => { mockForeground.add(callback); return { remove: () => mockForeground.delete(callback) }; } };
    return ['View', 'ScrollView', 'Pressable', 'Text', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native-reanimated', () => ({ __esModule: true,
  default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  useReducedMotion: () => mockReduced,
  Easing: { linear: (t: number) => t, bezierFn: () => (t: number) => t },
  useAnimatedProps: () => ({}), useAnimatedStyle: (read: () => Record<string, unknown>) => {
    const React = jest.requireActual('react');
    const handle = React.useRef({}).current;
    for (const key of Object.keys(handle)) delete handle[key];
    Object.assign(handle, read()); mockStyleReaders.set(handle, read);
    return handle;
  },
  useFrameCallback: () => {
    const React = jest.requireActual('react');
    return React.useRef({ setActive: jest.fn() }).current;
  },
  useSharedValue: (value: number) => {
    const React = jest.requireActual('react');
    const cell = React.useRef(value);
    return React.useRef({ get: () => cell.current, set: jest.fn((next: number) => {
      // Native shared-value writes cross runtimes. Tests explicitly decide
      // when old assignments reach UI instead of making the setter synchronous.
      mockSharedAssignments.push(() => { cell.current = next; });
    }) }).current;
  },
  withTiming: (...args: Parameters<typeof mockTiming>) => mockTiming(...args), cancelAnimation: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: () => void) => fn() }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', SvgXml: 'SvgXml', G: 'G', Path: 'Path', Rect: 'Rect', Defs: 'Defs', ClipPath: 'ClipPath', Image: 'SvgImage', Use: 'Use', Ellipse: 'Ellipse', LinearGradient: 'LinearGradient', RadialGradient: 'RadialGradient', Stop: 'Stop' }));
jest.mock('expo-image', () => ({ Image: (props: Record<string, unknown>) => {
  const React = jest.requireActual('react');
  const nativeIdentity = React.useRef({});
  React.useEffect(() => {
    mockImageMounted(nativeIdentity.current);
    return () => mockImageUnmounted(nativeIdentity.current);
  }, []);
  return React.createElement('OriginalImage', { ...props, nativeIdentity: nativeIdentity.current });
} }));
jest.mock('../../hooks/useEntryIntro', () => ({ useEntryIntro: () => ({ phase: mockPhase, prepared: mockPhase !== 'loading', finish: mockFinish }) }));
jest.mock('../../hooks/useEntrySplashReady', () => ({ useEntrySplashReady: () => ({ readiness: 'ready', onLayout: mockReadyLayout, onSceneReady: mockSceneReady }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount, useSesija: () => mockAccount }));
jest.mock('../../ui/Press', () => ({ Press: 'Pressable' }));
import { EntryWelcome } from '../../ui/entry/EntryWelcome';

let tree: ReactTestRenderer;
const requester = jest.fn(), worker = jest.fn(), signIn = jest.fn(), signUp = jest.fn();
const element = (busy = false) => <EntryWelcome onRequester={requester} onWorker={worker} onSignIn={signIn} onSignUp={signUp} busy={busy} />;
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const render = async () => { await act(async () => { tree = create(element()); }); };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockForeground.clear(); mockSharedAssignments.length = 0; mockFrameTime = null; mockIntentTime = null; mockPhase = 'welcome'; mockReduced = false; mockFontScale = 1; mockWindow = { width: 390, height: 844 }; mockInsets = { top: 33, bottom: 0, left: 0, right: 0 }; mockAccount = { accountRevision: 0, user: null }; requester.mockResolvedValue(undefined); worker.mockResolvedValue(undefined); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it('shows the vector lockup and two real intent controls without dispatching on mount', async () => {
  await render();
  expect(button('Objavi zadatak').props.disabled).toBe(false);
  expect(button('Uskoči i zaradi').props.disabled).toBe(false);
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'USKOČI').length).toBeGreaterThan(0);
  expect(requester).not.toHaveBeenCalled(); expect(worker).not.toHaveBeenCalled();
  await press('Prijavi se'); expect(signIn).toHaveBeenCalledTimes(1);
  await press('Napravi nalog'); expect(signUp).toHaveBeenCalledTimes(1);
});
it('keeps entry illustration assets local and decorative, with usable authentication controls', async () => {
  await render();
  const photos = tree.root.findAllByType('OriginalImage' as React.ElementType);
  expect(photos.length).toBeGreaterThan(0);
  for (const photo of photos) {
    expect(photo.props.accessible).toBe(false);
    expect(JSON.stringify(photo.props.source)).not.toMatch(/https?:/);
  }
  for (const name of ['Prijavi se', 'Napravi nalog']) expect(StyleSheet.flatten(button(name).props.style).minHeight).toBeGreaterThanOrEqual(48);
});
it.each([['Prijavi se', false, signIn], ['Napravi nalog', false, signUp],
  ['Prijavi se', true, signIn], ['Napravi nalog', true, signUp]] as const)(
  'opens %s during the decorative intro without requiring Preskoči (reduced motion: %s)', async (label, reduced, callback) => {
    mockPhase = 'intro'; mockWindow = { width: 320, height: 568 }; mockReduced = reduced;
    await render();
    const footer = tree.root.findByProps({ testID: 'entry-auth-footer' });
    expect(footer.type).toBe('View');
    expect(StyleSheet.flatten(footer.props.style).opacity).toBe(1);
    expect(footer.props.importantForAccessibility).toBe('auto');
    expect(button(label).props.disabled).toBe(false);
    expect(tree.root.findByType('ScrollView' as React.ElementType).props.scrollEnabled).toBe(true);
    expect(mockFinish).not.toHaveBeenCalled();
    await press(label);
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  },
);
it('keeps the intro auth action guarded when the account changes before tap', async () => {
  mockPhase = 'intro'; await render();
  const retained = button('Prijavi se').props.onPress;
  mockAccount = { accountRevision: 2, user: null };
  await act(async () => retained());
  expect(mockFinish).not.toHaveBeenCalled();
  expect(signIn).not.toHaveBeenCalled();
});

// This checks the mounted entry actually used by /auth. The retired reference
// screen's source-string checks could pass while the real entry lost its insets.
it.each([[0, 0, 1], [48, 34, 1], [96, 48, 2], [24, 80, 2]])(
  'keeps measured auth actions reachable with top %i, bottom %i and text scale %i', async (top, bottom, scale) => {
    mockInsets = { top, bottom, left: 0, right: 0 }; mockFontScale = scale;
    await render();
    const measuredFooterHeight = 210;
    await act(async () => tree.root.findByProps({ testID: 'entry-auth-footer' }).props.onLayout({
      nativeEvent: { layout: { width: 390, height: measuredFooterHeight, x: 0, y: 0 } },
    }));
    const brand = StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-brand-panel' }).props.style);
    const footer = StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-auth-footer' }).props.style);
    const scroll = tree.root.findByType('ScrollView' as React.ElementType);
    expect(brand.top).toBeGreaterThanOrEqual(top);
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).minHeight)
      .toBeGreaterThanOrEqual(footer.top + measuredFooterHeight + bottom);
    for (const label of ['Prijavi se', 'Napravi nalog']) expect(button(label).props.disabled).toBe(false);
    await press('Prijavi se'); expect(signIn).toHaveBeenCalledTimes(1);
    await press('Napravi nalog'); expect(signUp).toHaveBeenCalledTimes(1);
  },
);

it('preserves both image instances and their native ancestors through intro, selection, cancellation and completion', async () => {
  mockPhase = 'intro'; await render();
  const images = tree.root.findAllByType('OriginalImage' as React.ElementType);
  const refs = images.map(image => image.props.nativeIdentity);
  const sources = images.map(image => image.props.source);
  const ancestorIds = ['entry-requester-scene', 'entry-worker-scene', 'entry-requester-photo-frame', 'entry-worker-photo-frame'];
  const ancestors = ancestorIds.map(testID => tree.root.findByProps({ testID }));
  const preserved = () => {
    const current = tree.root.findAllByType('OriginalImage' as React.ElementType);
    expect(current).toHaveLength(2);
    current.forEach((image, index) => {
      expect(image === images[index]).toBe(true);
      expect(image.props.nativeIdentity).toBe(refs[index]);
      expect(image.props.source).toBe(sources[index]);
    });
    ancestorIds.forEach((testID, index) => {
      const node = tree.root.findByProps({ testID });
      expect(node === ancestors[index]).toBe(true);
      expect(node.props.collapsable).toBe(false);
    });
    expect(mockImageMounted).toHaveBeenCalledTimes(2);
    expect(mockImageUnmounted).not.toHaveBeenCalled();
  };
  mockPhase = 'welcome'; await act(async () => tree.update(element())); preserved();
  await press('Objavi zadatak'); preserved();
  await press('Otkaži izbor'); preserved();
  await press('Uskoči i zaradi'); preserved();
  await act(async () => mockForeground.forEach(callback => callback('background'))); preserved();
  let finish!: () => void;
  worker.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  await press('Uskoči i zaradi'); await advance(760); preserved();
  await act(async () => finish()); preserved();
  await press('Objavi zadatak'); preserved();
  mockReduced = true; await act(async () => tree.update(element())); preserved();
  await press('Uskoči i zaradi'); preserved();
});
it('does not let a retained auth handler bypass an in-flight intent or a changed session', async () => {
  await render(); const oldSignUp = button('Napravi nalog').props.onPress;
  await press('Objavi zadatak'); await act(async () => oldSignUp()); expect(signUp).not.toHaveBeenCalled();
  await press('Otkaži izbor'); const oldSignIn = button('Prijavi se').props.onPress;
  mockAccount = { accountRevision: 2, user: null }; await act(async () => oldSignIn()); expect(signIn).not.toHaveBeenCalled();
});
it.each([0, 3500, 3590, 3895, 4200, 4380])('keeps native panel material valid during intro at %i ms', async time => {
  mockPhase = 'intro'; mockFrameTime = time; await render();
  const style = StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-brand-panel' }).props.style);
  expect(typeof style.backgroundColor).toBe('string');
  for (const shadow of style.boxShadow ?? []) {
    expect(Number.isFinite(shadow.blurRadius)).toBe(true);
    expect(shadow.blurRadius).toBeGreaterThanOrEqual(0);
    const alpha = Number(shadow.color.match(/,([^,]+)\)$/)?.[1]);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThanOrEqual(1);
  }
});
it.each([['Objavi zadatak', 'requester', 'worker'], ['Uskoči i zaradi', 'worker', 'requester']])('keeps the selected intent legible during %s transition', async (label, chosen, other) => {
  mockFrameTime = 4380; await render();
  const style = (id: string) => StyleSheet.flatten(tree.root.findByProps({ testID: id }).props.style);
  expect(style('entry-auth-footer').opacity).toBe(1);
  mockIntentTime = 500;
  await press(label);
  expect(style('entry-auth-footer').opacity).toBe(0);
  expect(style(`entry-${chosen}-scene`).opacity).toBe(1);
  expect(style(`entry-${other}-scene`).opacity).toBe(0);
  expect(Number.isFinite(style(`entry-${chosen}-photo-frame`).transform[1].scale)).toBe(true);
  expect(tree.root.findByProps({ testID: 'entry-brand-panel' })).toBeTruthy();
});
it.each([['Objavi zadatak', requester], ['Uskoči i zaradi', worker]] as const)(
  'restores the attached native mappers after returning from %s, despite late intro and selection clocks', async (label, callback) => {
    mockPhase = 'intro'; await render();
    const ids = ['requester', 'worker'].flatMap(intent => ['scene', 'copy', 'photo-frame', 'note'].map(part => `entry-${intent}-${part}`));
    const handles = ids.map(id => tree.root.findByProps({ testID: id }).props.style.at(-1));
    const images = tree.root.findAllByType('OriginalImage' as React.ElementType).map(image => image.props.nativeIdentity);
    const values = () => ids.map((id, index) => {
      const attached = tree.root.findByProps({ testID: id }).props.style.at(-1);
      expect(attached).toBe(handles[index]);
      const read = mockStyleReaders.get(attached); expect(read).toBeDefined();
      return read!();
    });
    const final = () => {
      values().forEach((value, index) => expect(value).toEqual({ opacity: 1, transform: ids[index].endsWith('-scene')
        ? [{ translateX: 0 }] : ids[index].endsWith('-photo-frame') ? [{ translateY: 0 }, { scale: 1 }] : [{ translateY: 0 }] }));
      tree.root.findAllByType('OriginalImage' as React.ElementType).forEach((image, index) => expect(image.props.nativeIdentity).toBe(images[index]));
    };
    // Welcome can commit while the old intro clock is still at its empty frame.
    mockPhase = 'welcome'; await act(async () => tree.update(element())); final();
    let back!: () => void;
    callback.mockReturnValue(new Promise<void>(resolve => { back = resolve; }));
    mockIntentTime = 500; await press(label);
    expect(values().some(value => value.opacity === 0)).toBe(true);
    expect(values().some(value => JSON.stringify(value.transform).includes('scale') && JSON.stringify(value.transform) !== JSON.stringify([{ translateY: 0 }, { scale: 1 }]))).toBe(true);
    await advance(760); expect(callback).toHaveBeenCalledTimes(1);
    await act(async () => back()); final();
    // No React rerender: the attached UI mapper must overwrite its old native
    // selection values rather than rely on unchanged static React style props.
    for (const assignment of mockSharedAssignments.splice(0)) { assignment(); final(); }
    for (const time of [0, 41, 4380]) { mockFrameTime = time; mockIntentTime = 760; final(); }
    expect(button('Objavi zadatak').props.disabled).toBe(false);
    expect(button('Uskoči i zaradi').props.disabled).toBe(false);
    expect(mockImageMounted).toHaveBeenCalledTimes(2); expect(mockImageUnmounted).not.toHaveBeenCalled();
  });
it('keeps the newer opposite selection when a cancelled retained Auth callback completes late, then restores both columns', async () => {
  let oldBack!: () => void, newBack!: () => void;
  requester.mockReturnValue(new Promise<void>(resolve => { oldBack = resolve; }));
  worker.mockReturnValue(new Promise<void>(resolve => { newBack = resolve; }));
  mockIntentTime = 500; await render();
  await press('Objavi zadatak'); await advance(760); await press('Otkaži izbor');
  await press('Uskoči i zaradi'); await advance(760);
  const other = tree.root.findByProps({ testID: 'entry-requester-scene' }).props.style.at(-1);
  await act(async () => oldBack());
  expect(mockStyleReaders.get(other)!().opacity).toBe(0);
  expect(button('Uskoči i zaradi').props.disabled).toBe(true);
  await act(async () => newBack());
  for (const intent of ['requester', 'worker']) {
    const handle = tree.root.findByProps({ testID: `entry-${intent}-scene` }).props.style.at(-1);
    expect(mockStyleReaders.get(handle)!()).toEqual({ opacity: 1, transform: [{ translateX: 0 }] });
  }
  expect(requester).toHaveBeenCalledTimes(1); expect(worker).toHaveBeenCalledTimes(1);
});
it('commits the complete static welcome before delayed UI clock writes, including late old assignments', async () => {
  mockPhase = 'intro'; await render();
  const photoRefs = tree.root.findAllByType('OriginalImage' as React.ElementType).map(image => image.props.nativeIdentity);
  await act(async () => tree.root.findByProps({ testID: 'entry-brand-panel' }).props.onLayout({
    nativeEvent: { layout: { x: 24, y: 33, width: 288.6, height: 151 } },
  }));
  // Both t=0 and the prepared t=41 writes remain queued in another runtime.
  expect(mockSharedAssignments.length).toBeGreaterThan(0);
  mockPhase = 'welcome'; await act(async () => tree.update(element()));
  const finalComposition = () => {
    tree.root.findAllByType('OriginalImage' as React.ElementType).forEach((image, index) => expect(image.props.nativeIdentity).toBe(photoRefs[index]));
    expect(mockImageMounted).toHaveBeenCalledTimes(2);
    expect(mockImageUnmounted).not.toHaveBeenCalled();
    for (const id of ['entry-green-field', 'entry-orange-field', 'entry-requester-scene', 'entry-worker-scene']) {
      const node = tree.root.findByProps({ testID: id });
      expect(node.type).toBe(id.endsWith('-scene') ? 'AnimatedView' : 'View');
      expect(StyleSheet.flatten(node.props.style)).toMatchObject({ opacity: 1, transform: [{ translateX: 0 }] });
    }
    for (const id of ['entry-slogan', 'entry-auth-footer', 'entry-requester-copy', 'entry-worker-copy',
      'entry-requester-note', 'entry-worker-note', 'entry-requester-photo-frame', 'entry-worker-photo-frame']) {
      const node = tree.root.findByProps({ testID: id });
      expect(node.type).toBe(id.startsWith('entry-requester-') || id.startsWith('entry-worker-') ? 'AnimatedView' : 'View');
      const style = StyleSheet.flatten(node.props.style);
      expect(style.opacity).toBe(1); expect(style.transform[0]).toEqual({ translateY: 0 });
    }
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-center-seam' }).props.style).opacity).toBeGreaterThan(.99);
    expect(button('Objavi zadatak').props.disabled).toBe(false);
    expect(button('Prijavi se').props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ testID: 'entry-word-reveal' })).toHaveLength(0);
  };
  finalComposition();
  for (const assignment of mockSharedAssignments.splice(0)) {
    await act(async () => { assignment(); tree.update(element()); });
    finalComposition();
  }
  await press('Prijavi se'); expect(signIn).toHaveBeenCalledTimes(1);
});
it('starts an explicit choice from the final scene even if the old intro clock is still zero', async () => {
  mockPhase = 'intro'; await render();
  mockPhase = 'welcome'; await act(async () => tree.update(element()));
  // Do not deliver any shared-value assignment, including the final clock set.
  mockIntentTime = 500;
  await press('Uskoči i zaradi');
  for (const id of ['entry-worker-copy', 'entry-worker-photo-frame']) {
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: id }).props.style).opacity).toBe(1);
  }
  expect(tree.root.findByProps({ testID: 'entry-green-field' }).type).toBe('View');
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-auth-footer' }).props.style).opacity).toBe(0);
  expect(worker).not.toHaveBeenCalled();
  await advance(759); expect(worker).not.toHaveBeenCalled();
  await advance(1); expect(worker).toHaveBeenCalledTimes(1);
});
it.each([['Objavi zadatak', requester], ['Uskoči i zaradi', worker]] as const)('disables conflicting controls immediately and delivers %s exactly once after 760ms', async (label, callback) => {
  await render(); const oldPress = button(label).props.onPress;
  await act(async () => { oldPress(); oldPress(); });
  for (const name of ['Objavi zadatak', 'Uskoči i zaradi', 'Prijavi se', 'Napravi nalog']) expect(button(name).props.disabled).toBe(true);
  const groups = tree.root.findAll(node => ['entry-intents', 'entry-auth-footer'].includes(node.props.testID) && node.props.importantForAccessibility === 'no-hide-descendants');
  expect(groups).toHaveLength(2);
  groups.forEach(group => expect(group.props.pointerEvents).toBe('none'));
  expect(tree.root.findByProps({ testID: 'entry-brand-panel' })).toBeDefined();
  await advance(759); expect(callback).not.toHaveBeenCalled();
  await advance(1); expect(callback).toHaveBeenCalledTimes(1);
});
it('keeps the selected state while the real owned callback is pending', async () => {
  let finish!: () => void; requester.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  await render(); await press('Objavi zadatak'); await advance(760);
  expect(button('Objavi zadatak').props.disabled).toBe(true);
  expect(tree.root.findByProps({ testID: 'entry-intent-preparation' }).props.importantForAccessibility).toBe('auto');
  expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityState).toEqual({ busy: true });
  await act(async () => finish()); expect(button('Objavi zadatak').props.disabled).toBe(false);
  expect(tree.root.findAllByProps({ testID: 'entry-intent-preparation' })).toHaveLength(0);
});
it.each(['Objavi zadatak', 'Uskoči i zaradi'])('shows real preparation at the completed %s doorway even before the JS timer runs', async label => {
  await render(); mockIntentTime = 0; await press(label);
  const status = tree.root.findByProps({ testID: 'entry-intent-preparation' });
  const handle = status.props.style.at(-1);
  expect(status.props.accessibilityElementsHidden).toBe(true);
  for (const time of [0, 500, 759]) { mockIntentTime = time; expect(mockStyleReaders.get(handle)!().opacity).toBe(0); }
  mockIntentTime = 760;
  expect(mockStyleReaders.get(handle)!().opacity).toBe(1);
  expect(requester).not.toHaveBeenCalled(); expect(worker).not.toHaveBeenCalled();
  expect(status.findAllByProps({ accessibilityLabel: 'USKOČI' }).length).toBeGreaterThan(0);
  expect(status.findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(1);
  expect(status.findAllByProps({ accessibilityRole: 'progressbar' })[0].props.accessibilityLabel).toBe('Pripremamo prijavu');
});
it('shows immediate static preparation for a reduced-motion pending choice without starting a clock', async () => {
  worker.mockReturnValue(new Promise(() => {})); mockReduced = true; await render(); await press('Uskoči i zaradi');
  const overlay = tree.root.findByProps({ testID: 'entry-intent-doorway' });
  expect(mockStyleReaders.get(overlay.props.style.at(-1))!()).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] });
  const status = tree.root.findByProps({ testID: 'entry-intent-preparation' });
  expect(mockStyleReaders.get(status.props.style.at(-1))!()).toEqual({ opacity: 1 });
  expect(status.props.importantForAccessibility).toBe('auto'); expect(mockTiming).not.toHaveBeenCalled();
});
it.each(['background', 'inactive', 'cancel', 'account', 'unmount', 'reflow'])('invalidates the delivered selection on %s before late completion', async boundary => {
  let reject!: (error: Error) => void;
  requester.mockReturnValue(new Promise<void>((_done, fail) => { reject = fail; }));
  await render(); await press('Objavi zadatak'); await advance(760);
  const current = requester.mock.calls[0][0].isCurrent;
  expect(current()).toBe(true);
  await act(async () => {
    if (boundary === 'unmount') tree.unmount();
    else if (boundary === 'cancel') button('Otkaži izbor').props.onPress();
    else if (boundary === 'account') mockAccount = { user: null, accountRevision: 2 };
    else if (boundary === 'reflow') { mockFontScale = 2; tree.update(element()); }
    else mockForeground.forEach(callback => callback(boundary));
  });
  expect(current()).toBe(false);
  await act(async () => reject(new Error('late failed storage')));
  expect(current()).toBe(false);
  if (boundary !== 'unmount') expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
});
it('restores both choices with retry text after current storage failure without claiming confirmation', async () => {
  requester.mockRejectedValue(new Error('storage failed'));
  await render(); await press('Objavi zadatak'); await advance(760);
  expect(tree.root.findAllByProps({ testID: 'entry-intent-preparation' })).toHaveLength(0);
  expect(button('Objavi zadatak').props.disabled).toBe(false); expect(button('Uskoči i zaradi').props.disabled).toBe(false);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).children).toEqual(['Izbor trenutno nije sačuvan. Pokušaj ponovo.']);
  expect(requester.mock.calls[0][0].isCurrent()).toBe(false);
});
it.each(['background', 'inactive'])('cancels a pending choice on %s', async state => {
  await render(); await press('Objavi zadatak');
  await act(async () => mockForeground.forEach(callback => callback(state)));
  await advance(1000); expect(requester).not.toHaveBeenCalled(); expect(button('Objavi zadatak').props.disabled).toBe(false);
});
it('cancels on explicit cancellation and allows a fresh opposite choice', async () => {
  await render(); await press('Objavi zadatak'); await press('Otkaži izbor'); await advance(1000);
  expect(requester).not.toHaveBeenCalled(); await press('Uskoči i zaradi'); await advance(760); expect(worker).toHaveBeenCalledTimes(1);
});
it('rejects A→B→A before callback even when React has not rerendered yet', async () => {
  await render(); await press('Objavi zadatak'); mockAccount = { accountRevision: 2, user: null };
  await advance(760); expect(requester).not.toHaveBeenCalled();
  await act(async () => tree.update(element())); expect(button('Objavi zadatak').props.disabled).toBe(false);
});
it('does not deliver after unmount', async () => {
  await render(); await press('Objavi zadatak'); await act(async () => tree.unmount()); await advance(1000);
  expect(requester).not.toHaveBeenCalled(); expect(mockForeground.size).toBe(0);
});
it('reduces selection motion to an immediate real callback', async () => {
  mockReduced = true; await render(); await press('Uskoči i zaradi');
  expect(worker).toHaveBeenCalledTimes(1); expect(mockTiming).not.toHaveBeenCalled();
});
it('cancels an in-progress sweep when the system preference changes and accepts an immediate fresh choice', async () => {
  await render(); await press('Objavi zadatak');
  mockReduced = true; await act(async () => tree.update(element()));
  await advance(1000); expect(requester).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'entry-intent-fill' })).toHaveLength(0);
  await press('Uskoči i zaradi'); expect(worker).toHaveBeenCalledTimes(1);
});
it('keeps both intentions and their supporting text accessible with large text and scrolling', async () => {
  mockFontScale = 2; await render();
  expect(tree.root.findAllByType('Text' as React.ElementType).some(node => node.children.includes('Više vremena za ono što voliš.'))).toBe(true);
  expect(tree.root.findAllByType('Text' as React.ElementType).some(node => node.children.includes('Tvoje vreme i trud imaju vrednost.'))).toBe(true);
  expect(button('Objavi zadatak').props.disabled).toBe(false);
  expect(button('Uskoči i zaradi').props.disabled).toBe(false);
  expect(tree.root.findByType('ScrollView' as React.ElementType).props.scrollEnabled).toBe(true);
});
it('waits for measured geometry before starting the intro while auth stays available', async () => {
  mockPhase = 'intro'; await render(); expect(mockTiming).not.toHaveBeenCalled();
  expect(mockSceneReady).not.toHaveBeenCalled();
  expect(button('Objavi zadatak').props.disabled).toBe(true);
  expect(button('Prijavi se').props.disabled).toBe(false);
  expect(button('Napravi nalog').props.disabled).toBe(false);
  await act(async () => tree.root.findByProps({ testID: 'entry-brand-panel' }).props.onLayout({ nativeEvent: { layout: { x: 24, y: 158.765625, width: 342, height: 227.328125 } } }));
  // Layout alone cannot release the cover: the source t=0 artwork is empty.
  // Layout only mounts prepared artwork. The real clock's cover acknowledgement
  // and later UI-frame resume are covered in its focused suite.
  expect(mockSceneReady).not.toHaveBeenCalled();
  expect(mockTiming).not.toHaveBeenCalled();
  await press('Preskoči uvod'); expect(mockFinish).toHaveBeenCalledTimes(1);
});
