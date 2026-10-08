import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[]; stanje?: string | string[]; t?: string | string[]; [key: string]: unknown } = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
// The production Home's chrome imports the live bell; the scenes draw an inert one, so a mounted live bell is a failure.
const mockInbox = jest.fn();
jest.mock('../../../InboxBell', () => ({ InboxBell: () => { mockInbox(); throw new Error('The V1 variant scenes must not mount a live inbox.'); } }));
jest.mock('../../../entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup', BrandMark: 'BrandMark' }));
jest.mock('../../../../data/supabaseClient', () => { throw new Error('The V1 variant scenes must not load a data client.'); });
jest.mock('../../../../store/uloga', () => { throw new Error('The V1 variant scenes must not read account data.'); });

import Gallery, { SCENES } from '../../../../app/dizajn-var-V1';
import { ListRow } from '../../../system/ListRow';
import { PORODICA } from '../podaci';

/**
 * The V1 variant scenes (`/dizajn-var-V1`, creative direction 2026-10-08): every scene the owner's board photographs must draw from
 * fixtures, with no data client, no account and no live navigation, in every state and at a frozen frame, and only in an internal build.
 */
let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const render = async () => { await act(async () => { tree = create(<Gallery />); }); };
const texts = () => tree.root.findAllByType(Text).flatMap(node => node.props.children).filter((child): child is string => typeof child === 'string');

beforeEach(() => { jest.clearAllMocks(); testRuntime.__DEV__ = true; mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); testRuntime.__DEV__ = originalDev; });

it.each(['rs.uskoci.app', 'rs.uskoci.app.dev.store', undefined])('refuses fixture content in a store build (%s), regardless of the scene query', async packageName => {
  testRuntime.__DEV__ = false; mockPackage = packageName; mockParams = { scene: 'pocetna-A', internal: 'true', dev: 'true' };
  await render();
  expect(texts()).toEqual(['Nije dostupno.']);
});

it('lists the twelve scenes as rows that open them by address, and nothing of the screens until one is chosen', async () => {
  await render();
  const rows = tree.root.findAllByType(ListRow);
  expect(rows).toHaveLength(SCENES.length);
  expect(SCENES).toHaveLength(12);
  await act(async () => rows[1].props.onPress());
  expect(mockRouter.setParams).toHaveBeenCalledWith({ scene: 'pocetna-A' });
  expect(mockRouter.push).not.toHaveBeenCalled();
});

const STATES: Record<string, string[]> = {
  pocetna: ['normalno', 'puno', 'dugo', 'prazno', 'bez-termina', 'radnik', 'mir'],
  'moji-zadaci': ['lista', 'puno', 'dugo', 'prazno', 'pecat'],
  stanja: PORODICA.map(clan => clan.key),
};

describe.each(SCENES)('scene %s', scene => {
  const ekran = scene.slice(0, scene.lastIndexOf('-'));
  it.each(STATES[ekran])('draws the state %s from fixtures, with words on the screen and no live navigation', async stanje => {
    mockParams = { scene, stanje };
    await render();
    expect(texts().length).toBeGreaterThan(2);
    expect(texts()).not.toContain('Nije dostupno.');
    for (const navigate of [mockRouter.push, mockRouter.navigate, mockRouter.replace]) expect(navigate).not.toHaveBeenCalled();
  });
});

it.each(['pocetna-A', 'pocetna-C', 'moji-zadaci-C', 'stanja-C'])('%s draws a frozen frame of its motion at t = 0, 150 and 900 ms', async scene => {
  for (const t of ['0', '150', '900']) {
    mockParams = { scene, t, stanje: scene === 'moji-zadaci-C' ? 'lista' : undefined };
    await render();
    expect(texts().length).toBeGreaterThan(2);
    await act(async () => tree.unmount());
  }
});

it('the three Početna variants keep the two locked doors and the signature rows, and say what waits', async () => {
  for (const scene of ['pocetna-A', 'pocetna-B', 'pocetna-C']) {
    mockParams = { scene, stanje: 'normalno' };
    await render();
    for (const word of ['Objavi zadatak', 'Uskoči i zaradi', 'Čeka te', 'Pomoć pri selidbi', 'Danas · 14:00–16:00', 'Moji zadaci', 'Moje prijave']) expect(texts()).toContain(word);
    await act(async () => tree.unmount());
  }
});

it('Početna A leads with the person and the amount; B leads with the time; C keeps the calm row when nothing waits', async () => {
  mockParams = { scene: 'pocetna-A', stanje: 'normalno' }; await render();
  expect(texts()).toContain('Marko uskače na tvoj zadatak');
  expect(texts()).toContain('4.500 RSD');
  await act(async () => tree.unmount());
  mockParams = { scene: 'pocetna-B', stanje: 'bez-termina' }; await render();
  expect(texts()).toContain('2 prijave');
  expect(texts()).toContain('2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak');
  await act(async () => tree.unmount());
  mockParams = { scene: 'pocetna-C', stanje: 'mir' }; await render();
  expect(texts()).toContain('Ništa ne čeka tvoju odluku.');
});

it('Moji zadaci A groups by phase, B counts in words, C puts what waits first and shows the orange foot; all three share the first encounter', async () => {
  mockParams = { scene: 'moji-zadaci-A', stanje: 'lista' }; await render();
  expect(texts().some(text => text.startsWith('Čeka tvoj izbor ·'))).toBe(true);
  expect(texts()).toContain('Nacrti');
  await act(async () => tree.unmount());
  mockParams = { scene: 'moji-zadaci-B', stanje: 'lista' }; await render();
  expect(texts()).toContain('Dogovoreno');
  expect(texts()).toContain('0 od 2');
  expect(texts().some(text => /\d\/\d/.test(text))).toBe(false);
  await act(async () => tree.unmount());
  mockParams = { scene: 'moji-zadaci-C', stanje: 'lista' }; await render();
  expect(texts()).toContain('Imaš 3 prijave. Uporedi ih i izaberi.');
  await act(async () => tree.unmount());
  for (const scene of ['moji-zadaci-A', 'moji-zadaci-B', 'moji-zadaci-C']) {
    mockParams = { scene, stanje: 'prazno' }; await render();
    expect(texts().some(text => text.startsWith('Još nemaš zadatak'))).toBe(true);
    expect(texts()).toContain('Objavi prvi zadatak');
    await act(async () => tree.unmount());
  }
});
