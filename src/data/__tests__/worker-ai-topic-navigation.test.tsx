import React, { useState } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Real Expo Router + the actual Tabs adapter. A replace-shaped mock previously hid
// the unsupported POP_TO sent by dismissTo from these compatibility entries.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => 'uskoci://' + path,
  resolveScheme: () => 'uskoci', addEventListener: () => ({ remove() {} }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => { const React = require('react'); const { Pressable } = require('react-native');
  return { Press: (props: object) => React.createElement(Pressable, props) }; });
jest.mock('../../ui/workerProfile/WorkerProfilePresentation', () => ({ WorkerProfileFrame: 'Frame' }));
jest.mock('../../ui/system/StateView', () => ({ StateView: 'StateView' }));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => false }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: 'owner-a' }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: 'owner-a' }, accountRevision: 1 }) }));
import { ExpoRoot, router, Stack } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import RealTabs from '../../app/(app)/_layout';
import { WorkerAiTopicEntry } from '../../ui/workerProfile/WorkerAiTopicEntry';
import { takeAiCorrection } from '../aiCorrectionIntent';

jest.setTimeout(20_000);
const CONVERSATION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let conversationMounts = 0;
function Conversation() {
  const [draft] = useState(() => { conversationMounts++; return 'Sačuvana neposlata poruka'; });
  return <Text testID="conversation">{draft}</Text>;
}
function Root() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(app)" /></Stack>; }
const APP = join(__dirname, '../../app/(app)');
function names(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? names(join(dir, name), `${prefix}${name}/`)
    : name.endsWith('.tsx') && name !== '_layout.tsx' ? [`${prefix}${name.slice(0, -4)}`] : []);
}
const real: Record<string, React.ComponentType> = {
  'profil/razgovor': Conversation,
  'profil/dostupnost': () => <WorkerAiTopicEntry part="time" />,
  'profil/lokacija': () => <WorkerAiTopicEntry part="area" />,
};
const routes = inMemoryContext({ _layout: Root, '(app)/_layout': RealTabs,
  ...Object.fromEntries(names(APP).map(name => [`(app)/${name}`, real[name] ?? (() => <Text>{name}</Text>)])) });
type Nav = { type?: string; index?: number; routes?: { name: string; key: string; params?: Record<string, unknown>; state?: Nav }[];
  history?: { key: string }[] };
function state(): Nav {
  const find = (value: Nav | undefined): Nav | undefined => !value ? undefined : value.type === 'tab' ? value
    : value.routes?.map(route => find(route.state)).find(Boolean);
  return find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState())!;
}
const history = () => state().history!.map(entry => state().routes!.find(route => route.key === entry.key)!.name);
let tree: ReactTestRenderer;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { conversationMounts = 0; jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

it.each([['/profil/dostupnost', 'worker.time'], ['/profil/lokacija', 'worker.area']] as const)(
  '%s reuses the owned conversation and Back skips the compatibility route', async (path, target) => {
    await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); }); await settle();
    await act(async () => router.navigate({ pathname: '/profil/razgovor', params: { conversationId: CONVERSATION } })); await settle();
    const original = state().routes!.find(route => route.name === 'profil/razgovor')!;
    const mountsBefore = conversationMounts;
    await act(async () => router.navigate(path)); await settle();
    const current = state().routes![state().index!];
    expect(current.name).toBe('profil/razgovor'); expect(current.key).toBe(original.key);
    // A topic replaces URL params, but retains the mounted conversation route.
    // worker-conversation-parts separately mounts the real worker route and proves
    // it retains its owned conversation ID and unsent draft when these params change.
    expect(conversationMounts).toBe(mountsBefore);
    expect(tree.root.findByProps({ testID: 'conversation' }).props.children).toBe('Sačuvana neposlata poruka');
    expect(takeAiCorrection(String(current.params?.aiCorrection), { accountId: 'owner-a', accountRevision: 1 }, 'worker', CONVERSATION)?.target).toBe(target);
    expect(history()).toEqual(['index', 'profil/razgovor']);
    await act(async () => router.back()); await settle();
    expect(state().routes![state().index!].name).toBe('index');
  });
