import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The Mapa tab and the root `/prilike` list became the one Zadaci tab (owner's information architecture, 2026-09-23).
// Both addresses stay alive as redirects, because an older build's notification, a route remembered before sign-in and
// a shared link can still name them. This suite mounts the REAL Expo Router runtime — root Stack, the real `(app)` Tabs
// layout and the real redirect screens — and checks where such an address actually lands.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../Press', () => { const React = require('react'); const { Pressable } = require('react-native');
  return { Press: (props: Record<string, unknown>) => React.createElement(Pressable, props) }; });
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => 'uskoci://' + path,
  resolveScheme: () => 'uskoci', addEventListener: () => ({ remove() {} }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => false }));
jest.mock('../Text', () => ({ T: 'T' }));
// These tests mount the whole app router; alone the heaviest takes about 1.7 s, but on a loaded worker (the full suite with six
// workers, a CI runner) it passed the default 5 s (8 Oct 2026, after Moji zadaci gained its phase groups). The checks are unchanged.
jest.setTimeout(20000);

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ExpoRoot, router, Stack } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import RealTabsLayout from '../../app/(app)/_layout';
import RetiredMapa from '../../app/(app)/mapa';
import RetiredPrilike from '../../app/(app)/prilike';

function RootLayout() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(app)" /></Stack>; }
const Screen = (name: string) => function Stub() { return <Text>{`screen:${name}`}</Text>; };
/**
 * Every route of the real `(app)` group, read from disk. The tab router's own REPLACE works with the position of a route
 * in its `routes` list, so a navigator holding only the handful of screens a case visits has different positions from
 * the app's thirty-eight, and a history case could pass here by accident while failing on the phone.
 */
const APP = join(__dirname, '..', '..', 'app', '(app)');
function routeNames(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? routeNames(join(dir, name), `${prefix}${name}/`)
    : name.endsWith('.tsx') && name !== '_layout.tsx' ? [`${prefix}${name.slice(0, -4)}`] : []);
}
const STUB_NAMES: Record<string, string> = { index: 'pocetna', 'prilike/[id]': 'zadatak', 'prilike/[id]/prijava': 'prijava' };
const REAL: Record<string, React.ComponentType> = { mapa: RetiredMapa, prilike: RetiredPrilike };
const APP_ROUTES = routeNames(APP);
const routes = inMemoryContext({ _layout: RootLayout, '(app)/_layout': RealTabsLayout,
  ...Object.fromEntries(APP_ROUTES.map(name => [`(app)/${name}`, REAL[name] ?? Screen(STUB_NAMES[name] ?? name)])) });

let tree: ReactTestRenderer;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const shown = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(text => String(text).startsWith('screen:'));
const tab = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0];
const selectedTabs = () => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string'
  && node.props.accessibilityState?.selected).map(node => node.props.accessibilityLabel);
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test.each(['/mapa', '/prilike'])('a link to the retired %s opens Zadaci, with the Zadaci tab selected', async path => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location={path} />); });
  await settle();
  expect(shown()).toContain('screen:zadaci');
  expect(tab('Zadaci')).toBeDefined();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
});

test('the three tabs are Početna, Zadaci and Dogovori, and a task opened from Zadaci keeps Zadaci selected', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  const labels = [...new Set(tree.root.findAll(node => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string')
    .map(node => node.props.accessibilityLabel))];
  expect(labels).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  await act(async () => router.navigate('/zadaci')); await settle();
  await act(async () => router.navigate({ pathname: '/prilike/[id]', params: { id: 'task-1' } })); await settle();
  expect(shown()).toContain('screen:zadatak');
  // The bar is hidden on a task (a detail is not a root screen); where it is drawn, Zadaci is the section.
  expect(selectedTabs().filter(label => label !== 'Zadaci')).toEqual([]);
});

test('Back from Zadaci reached through a retired address does not bounce into Zadaci again', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/mapa')); await settle();
  expect(shown()).toContain('screen:zadaci');
  await act(async () => router.back()); await settle();
  expect(shown()).toContain('screen:pocetna');
  expect([...new Set(selectedTabs())]).toEqual(['Početna']);
});

/** The names in the `(app)` tab navigator's Back history, read from the live navigation state. */
function tabHistory(): string[] {
  type Nav = { type?: string; routes?: { name: string; key: string; state?: Nav }[]; history?: { key: string }[] };
  const find = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => find(route.state)).find(Boolean);
  const tabs = find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState());
  return (tabs?.history ?? []).map(entry => tabs!.routes!.find(route => route.key === entry.key)!.name);
}

test('a retired address never stays in the Back history, whether reached from Početna or opened cold', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/prilike')); await settle();
  expect(tabHistory()).toEqual(['index', 'zadaci']);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/mapa" />); });
  await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
  // Nothing behind Zadaci: the system Back leaves the app instead of redirecting into Zadaci again.
  expect(tabHistory()).toEqual(['zadaci']); expect(router.canGoBack()).toBe(false);
});

// After signing in through "Uskoči i zaradi" the app lands on Početna and the root layout replaces it with Zadaci
// (src/app/_layout.tsx). Zadaci is second in the tab list, and this tab router's own replace dropped the history entry
// before that position — Početna — so Back from Zadaci left the app.
test('the sign-in shortcut replaces Početna with Zadaci and Back still returns to Početna', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.replace('/zadaci')); await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
  expect(tabHistory()).toEqual(['index', 'zadaci']);
  await act(async () => router.back()); await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Početna']);
});

// A task opened cold with nothing behind it replaces itself with Zadaci on its back arrow (prilike/[id].tsx). It must
// not stay behind Zadaci, or Back from Zadaci would open the task again and its arrow would send you back to Zadaci.
test('a task opened cold and replaced by Zadaci does not stay in the Back history', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/prilike/task-1" />); });
  await settle();
  expect(shown()).toContain('screen:zadatak');
  await act(async () => router.replace('/zadaci')); await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
  expect(tabHistory()).toEqual(['zadaci']);
});

/** The route the `(app)` tab navigator has on screen, and how many routes it holds. */
function tabState(): { focused: string; count: number } {
  type Nav = { type?: string; index?: number; routes?: { name: string; key: string; state?: Nav }[] };
  const find = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => find(route.state)).find(Boolean);
  const tabs = find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState())!;
  return { focused: tabs.routes![tabs.index!].name, count: tabs.routes!.length };
}

// Every REPLACE in this navigator is a jump that drops the screen being left (verifier, 2026-09-24). The router's own
// replace dropped the history entry just before the new route's POSITION in the route list, so which screen vanished
// depended on where the two screens were registered: the sent application form stayed behind Moje prijave while Moje
// prijave itself fell out of the history, and a screen opened cold stayed behind the one that replaced it.
test('an application sent from a task opened on Početna lands on Moje prijave, and Back skips the sent form', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  // The navigator holds the app's real routes in the real order, or the positions below are not the phone's.
  expect(tabState().count).toBe(APP_ROUTES.length);
  await act(async () => router.navigate({ pathname: '/prilike/[id]', params: { id: 't1' } })); await settle();
  await act(async () => router.navigate({ pathname: '/prilike/[id]/prijava', params: { id: 't1' } })); await settle();
  expect(tabHistory()).toEqual(['index', 'prilike/[id]', 'prilike/[id]/prijava']);
  // prilike/[id]/prijava.tsx: a sent application replaces its form with Moje prijave.
  await act(async () => router.replace({ pathname: '/moje-prijave', params: { prijavaId: 'p1' } })); await settle();
  expect(tabState().focused).toBe('moje-prijave');
  expect(tabHistory()).toEqual(['index', 'prilike/[id]', 'moje-prijave']);
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('prilike/[id]');
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
});

// raspored.tsx: the calendar opened cold (a notification, a shared link) has nothing behind it and its arrow replaces it
// with Dogovori. Back from Dogovori must not open the calendar again.
test('Raspored opened cold and replaced by Dogovori does not stay in the Back history', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/raspored" />); });
  await settle();
  expect(tabState().focused).toBe('raspored');
  await act(async () => router.replace('/dogovori')); await settle();
  expect(tabState().focused).toBe('dogovori');
  expect(tabHistory()).toEqual(['dogovori']); expect(router.canGoBack()).toBe(false);
});

// potrebe.tsx: Moji zadaci opened cold replaces itself with Početna on its arrow.
test('Moji zadaci opened cold and replaced by Početna does not stay in the Back history', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/potrebe" />); });
  await settle();
  expect(tabState().focused).toBe('potrebe');
  await act(async () => router.replace('/')); await settle();
  expect(tabState().focused).toBe('index');
  expect(tabHistory()).toEqual(['index']); expect(router.canGoBack()).toBe(false);
});

/** The route names of the `(app)` tab navigator, in the order it holds them. */
function tabRouteNames(): string[] {
  type Nav = { type?: string; routes?: { name: string; key: string; state?: Nav }[] };
  const find = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => find(route.state)).find(Boolean);
  return find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState())!.routes!.map(route => route.name);
}

// The tab router's replace works with positions in the route list, so these cases only prove the phone's behaviour when
// the navigator holds every screen in the order the real layout registers them.
test('the navigator holds every (app) screen in the order the real layout registers them', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  const source = require('node:fs').readFileSync(join(APP, '_layout.tsx'), 'utf8') as string;
  const declared = [...source.matchAll(/<Tabs\.Screen name="([^"]+)"/g)].map(match => match[1]);
  expect([...declared].sort()).toEqual([...APP_ROUTES].sort());
  expect(tabRouteNames()).toEqual(declared);
});

// nova.tsx pushes the review (pregled-zadatka) over the finished AI conversation; after a successful publication the
// review replaces itself with the task it published ("Otvori zadatak"), or with Moji zadaci after a saved draft
// (pregled-zadatka.tsx). Back from there must return to where the person started the task, never into the finished
// conversation or its review (review r3 item 3).
test('after publishing, Back from the opened task returns home, not to the finished conversation or the review', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/nova')); await settle();
  await act(async () => router.push({ pathname: '/pregled-zadatka', params: { conversationId: 'c1' } })); await settle();
  expect(tabHistory()).toEqual(['index', 'nova', 'pregled-zadatka']);
  await act(async () => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: 'n1' } })); await settle();
  expect(tabState().focused).toBe('potrebe/[id]/pregled');
  expect(tabHistory()).toEqual(['index', 'potrebe/[id]/pregled']);
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
  expect(router.canGoBack()).toBe(false);
});

test('publication landing on Zadaci has one Back to Početna after several earlier screens', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/zadaci')); await settle();
  await act(async () => router.navigate('/potrebe')); await settle();
  await act(async () => router.navigate('/nova')); await settle();
  await act(async () => router.push({ pathname: '/pregled-zadatka', params: { conversationId: 'c1' } })); await settle();
  await act(async () => router.replace({ pathname: '/zadaci', params: {
    publishedNeedId: '11111111-1111-4111-8111-111111111111', publishedRevision: '1',
  } })); await settle();
  expect(tabState().focused).toBe('zadaci');
  expect(tabHistory()).toEqual(['index', 'zadaci']);
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
  expect(router.canGoBack()).toBe(false);
});

test('a task published from Moji zadaci goes Back to Moji zadaci and then home; a saved draft lands on Moji zadaci alone', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/potrebe')); await settle();
  await act(async () => router.navigate('/nova')); await settle();
  await act(async () => router.push({ pathname: '/pregled-zadatka', params: { conversationId: 'c1' } })); await settle();
  await act(async () => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: 'n1' } })); await settle();
  expect(tabHistory()).toEqual(['index', 'potrebe', 'potrebe/[id]/pregled']);
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('potrebe');
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
  await act(async () => tree.unmount());
  // "Sačuvaj nacrt": the review replaces itself with Moji zadaci, which is already in the history.
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/potrebe')); await settle();
  await act(async () => router.navigate('/nova')); await settle();
  await act(async () => router.push({ pathname: '/pregled-zadatka', params: { conversationId: 'c1' } })); await settle();
  await act(async () => router.replace('/potrebe')); await settle();
  expect(tabState().focused).toBe('potrebe');
  expect(tabHistory()).toEqual(['index', 'potrebe']);
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
});

// "Izmeni u razgovoru" and the review's back arrow replace the review with the conversation: that flow is not over.
test('going back from the review into the conversation keeps the conversation, and only the review leaves', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/nova')); await settle();
  await act(async () => router.push({ pathname: '/pregled-zadatka', params: { conversationId: 'c1' } })); await settle();
  await act(async () => router.replace({ pathname: '/nova', params: { conversationId: 'c1' } })); await settle();
  expect(tabState().focused).toBe('nova');
  expect(tabHistory()).toEqual(['index', 'nova']);
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
});

test('two review returns preserve the original intake entry key and params without accumulating Back history', async () => {
  type Nav = { type?: string; routes?: { name: string; key: string; params?: Record<string, unknown>; state?: Nav }[] };
  const findTabs = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => findTabs(route.state)).find(Boolean);
  const intakeRoute = () => findTabs(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState())!
    .routes!.find(route => route.name === 'nova')!;
  const originalParams = { entryKey: '11111111-1111-4111-8111-111111111111' };
  const conversationId = '22222222-2222-4222-8222-222222222222';
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate({ pathname: '/nova', params: originalParams })); await settle();
  const originalKey = intakeRoute().key;
  expect(intakeRoute().params).toEqual(originalParams);
  expect(tabHistory()).toEqual(['index', 'nova']);

  for (const intakeReturn of ['opaque-review-return-first', 'opaque-review-return-second']) {
    // The assigned conversation belongs to the review URL, while the mounted intake still
    // has its original entryKey. Returning with conversationId would change OwnedIntake's key.
    await act(async () => router.push({ pathname: '/pregled-zadatka', params: { conversationId, intakeReturn } }));
    await settle();
    expect(tabState()).toEqual({ focused: 'pregled-zadatka', count: APP_ROUTES.length });
    expect(tabHistory()).toEqual(['index', 'nova', 'pregled-zadatka']);
    expect(intakeRoute()).toMatchObject({ key: originalKey, params: originalParams });
    await act(async () => router.replace({ pathname: '/nova', params: originalParams })); await settle();
    expect(tabState()).toEqual({ focused: 'nova', count: APP_ROUTES.length });
    expect(intakeRoute().key).toBe(originalKey);
    expect(intakeRoute().params).toEqual(originalParams);
    expect(intakeRoute().params).not.toHaveProperty('conversationId');
    expect(intakeRoute().params).not.toHaveProperty('intakeReturn');
    expect(tabHistory()).toEqual(['index', 'nova']);
  }
  await act(async () => router.back()); await settle();
  expect(tabState().focused).toBe('index');
  expect(tabHistory()).toEqual(['index']);
  expect(router.canGoBack()).toBe(false);
});
