import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { sys } from '../../ui/system/tokens';

let mockReduced = false;
let mockAccount = { accountRevision: 0, user: null as null | { id: string } };
let mockWindow = { width: 390, height: 844, fontScale: 1 };
let mockInsets = { top: 33, bottom: 0, left: 0, right: 0 };
const mockForeground = new Set<(state: string) => void>();
const mockReadyLayout = jest.fn();
const mockSceneReady = jest.fn();

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    if (key === 'AppState') return { addEventListener: (_: string, callback: (state: string) => void) => {
      mockForeground.add(callback);
      return { remove: () => mockForeground.delete(callback) };
    } };
    return ['View', 'ScrollView', 'Pressable', 'Text', 'ActivityIndicator'].includes(String(key))
      ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('expo-image', () => ({ Image: 'OriginalImage' }));
jest.mock('../../hooks/useEntrySplashReady', () => ({ useEntrySplashReady: () => ({
  onLayout: mockReadyLayout, onSceneReady: mockSceneReady,
}) }));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReduced }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount, useSesija: () => mockAccount }));
jest.mock('../../ui/Press', () => ({ Press: 'Pressable' }));
jest.mock('../../ui/Text', () => ({ T: 'Text' }));
import { EntryWelcome } from '../../ui/entry/EntryWelcome';

let tree: ReactTestRenderer;
const requester = jest.fn();
const worker = jest.fn();
const signIn = jest.fn();
const signUp = jest.fn();
const element = (busy = false, error: string | null = null) => <EntryWelcome
  onRequester={requester} onWorker={worker} onSignIn={signIn} onSignUp={signUp} busy={busy} error={error} />;
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const render = async () => { await act(async () => { tree = create(element()); }); };
const deferred = () => {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockForeground.clear();
  mockReduced = false;
  mockAccount = { accountRevision: 0, user: null };
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  mockInsets = { top: 33, bottom: 0, left: 0, right: 0 };
  requester.mockResolvedValue(undefined);
  worker.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('uses the approved three-image welcome with two named intent controls and direct authentication', async () => {
  await render();
  expect(tree.root.findByProps({ testID: 'entry-logo' }).props.source).toEqual(
    require('../../../assets/brand/premium-entry/logo.png'));
  expect(tree.root.findByProps({ testID: 'entry-art-publish' }).props.source).toEqual(
    require('../../../assets/brand/premium-entry/publish.png'));
  expect(tree.root.findByProps({ testID: 'entry-art-discover' }).props.source).toEqual(
    require('../../../assets/brand/premium-entry/discover.png'));
  expect(button('Objavi zadatak').props.disabled).toBe(false);
  expect(button('Uskoči i zaradi').props.disabled).toBe(false);
  expect(button('Objavi zadatak').props.accessibilityRole).toBe('button');
  expect(button('Uskoči i zaradi').props.accessibilityHint).toMatch(/Isti nalog može/);
  expect(requester).not.toHaveBeenCalled();
  expect(worker).not.toHaveBeenCalled();
  await press('Prijavi se');
  await press('Napravi nalog');
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(signUp).toHaveBeenCalledTimes(1);
});

it('only releases the splash scene after all bundled images load, while retaining the root layout fence', async () => {
  await render();
  tree.root.findByProps({ testID: 'entry-welcome' }).props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } });
  expect(mockReadyLayout).toHaveBeenCalledTimes(1);
  expect(mockSceneReady).not.toHaveBeenCalled();
  const image = (id: string) => tree.root.findByProps({ testID: id });
  await act(async () => image('entry-logo').props.onLoad());
  await act(async () => image('entry-art-publish').props.onLoad());
  expect(mockSceneReady).not.toHaveBeenCalled();
  await act(async () => image('entry-art-discover').props.onLoad());
  await act(async () => image('entry-art-discover').props.onLoad());
  expect(mockSceneReady).toHaveBeenCalledTimes(1);
});

it.each([[390, 844, 33, 140], [320, 568, 24, 122]])(
  'keeps the artwork and auth in a scrollable safe-area composition at %i×%i', async (width, height, top, size) => {
    mockWindow = { width, height, fontScale: 2 };
    mockInsets = { ...mockInsets, top, bottom: 24 };
    await render();
    const scroll = tree.root.findByProps({ testID: 'entry-scroll' });
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
    const card = StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-card' }).props.style);
    const artwork = StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-art-publish' }).props.style);
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(content.paddingTop).toBeGreaterThanOrEqual(top);
    expect(content.paddingBottom).toBeGreaterThanOrEqual(48);
    expect(card.backgroundColor).toBe(sys.color.surface);
    expect(artwork.width).toBe(size);
    expect(artwork.height).toBe(size);
    expect(button('Prijavi se').props.disabled).toBe(false);
    expect(button('Napravi nalog').props.disabled).toBe(false);
  });

it('delivers each intent immediately once and blocks conflicting controls during its pending operation', async () => {
  const work = deferred();
  requester.mockReturnValue(work.promise);
  await render();
  const oldPress = button('Objavi zadatak').props.onPress;
  await act(async () => { oldPress(); oldPress(); });
  expect(requester).toHaveBeenCalledTimes(1);
  expect(requester.mock.calls[0][0].isCurrent()).toBe(true);
  for (const label of ['Objavi zadatak', 'Uskoči i zaradi', 'Prijavi se', 'Napravi nalog']) {
    expect(button(label).props.disabled).toBe(true);
  }
  expect(tree.root.findByProps({ testID: 'entry-preparing' })).toBeDefined();
  expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityState).toEqual({ busy: true });
  await act(async () => work.resolve());
  expect(requester.mock.calls[0][0].isCurrent()).toBe(false);
  expect(button('Objavi zadatak').props.disabled).toBe(false);
  expect(tree.root.findAllByProps({ testID: 'entry-preparing' })).toHaveLength(0);
});

it('invalidates a cancelled choice and keeps a newer opposite choice when the old callback completes late', async () => {
  const first = deferred();
  const next = deferred();
  requester.mockReturnValue(first.promise);
  worker.mockReturnValue(next.promise);
  await render();
  await press('Objavi zadatak');
  const oldCurrent = requester.mock.calls[0][0].isCurrent;
  await press('Otkaži izbor');
  expect(oldCurrent()).toBe(false);
  await press('Uskoči i zaradi');
  expect(worker).toHaveBeenCalledTimes(1);
  const newCurrent = worker.mock.calls[0][0].isCurrent;
  await act(async () => first.resolve());
  expect(newCurrent()).toBe(true);
  expect(button('Uskoči i zaradi').props.disabled).toBe(true);
  await act(async () => next.resolve());
  expect(newCurrent()).toBe(false);
  expect(button('Uskoči i zaradi').props.disabled).toBe(false);
});

it.each(['background', 'inactive', 'account', 'reflow', 'reduced', 'unmount'])(
  'invalidates a delivered intent on %s and ignores its late failure', async boundary => {
    const work = deferred();
    requester.mockReturnValue(work.promise);
    await render();
    await press('Objavi zadatak');
    const isCurrent = requester.mock.calls[0][0].isCurrent;
    expect(isCurrent()).toBe(true);
    await act(async () => {
      if (boundary === 'unmount') tree.unmount();
      else if (boundary === 'account') { mockAccount = { accountRevision: 2, user: null }; tree.update(element()); }
      else if (boundary === 'reflow') { mockWindow = { ...mockWindow, fontScale: 2 }; tree.update(element()); }
      else if (boundary === 'reduced') { mockReduced = true; tree.update(element()); }
      else mockForeground.forEach(callback => callback(boundary));
    });
    expect(isCurrent()).toBe(false);
    await act(async () => work.reject(new Error('late failure')));
    if (boundary !== 'unmount') expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
  });

it('rejects a stale account revision before React rerenders and never dispatches under a signed-in account', async () => {
  await render();
  mockAccount = { accountRevision: 1, user: null };
  await press('Objavi zadatak');
  expect(requester).not.toHaveBeenCalled();
  await act(async () => tree.update(element()));
  mockAccount = { accountRevision: 1, user: { id: 'member' } };
  await press('Uskoči i zaradi');
  await press('Prijavi se');
  expect(worker).not.toHaveBeenCalled();
  expect(signIn).not.toHaveBeenCalled();
});

it('shows a retryable error without implying the intent was saved', async () => {
  requester.mockRejectedValue(new Error('storage failed'));
  await render();
  await press('Objavi zadatak');
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).children).toEqual(
    ['Izbor trenutno nije sačuvan. Pokušaj ponovo.']);
  expect(button('Objavi zadatak').props.disabled).toBe(false);
  expect(requester.mock.calls[0][0].isCurrent()).toBe(false);
  await press('Uskoči i zaradi');
  expect(worker).toHaveBeenCalledTimes(1);
});

it('remains static under reduced motion and disables all entry actions while auth is busy', async () => {
  mockReduced = true;
  const work = deferred();
  worker.mockReturnValue(work.promise);
  await render();
  await press('Uskoči i zaradi');
  expect(worker).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(0);
  await act(async () => work.resolve());
  await act(async () => tree.update(element(true)));
  for (const label of ['Objavi zadatak', 'Uskoči i zaradi', 'Prijavi se', 'Napravi nalog']) {
    expect(button(label).props.disabled).toBe(true);
  }
});
