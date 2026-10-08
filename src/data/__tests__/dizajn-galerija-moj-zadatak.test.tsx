import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The gallery of the owner's own task and of the publish review (`/dizajn-objava`), in the states the owner sees on his phone (UI/UX pass of
 * 2026-10-08, wave "Telefon", agent T): a task nobody has applied to, applications waiting for a choice, "Tražim ponude" with the meaning behind its
 * small ⓘ, a task for three people with one agreed, a search that was closed for the rest. Each scene draws the real presentation with fixture data,
 * reads and writes nothing, and a store build shows nothing at all.
 */
let mockPackage: string | undefined = 'rs.uskoci.app.dev';
const mockRouter = { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ router: mockRouter, useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 361, height: 780, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar', FaceEdge: 'FaceEdge', FACE_EDGE: 2 }));
// The native map and the place form are drawn by their own suites.
jest.mock('../../ui/location/LocationMapPreview', () => ({ LocationMapPreview: 'MapPreview' }));
jest.mock('../../ui/location/NeedLocationForm', () => ({ NeedLocationForm: 'NeedLocationForm' }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationScreen: 'LocationScreen' }));
// A gallery never reaches a data service: the photo component that would read one is a stand-in, and the client throws if anything asks it for a connection.
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKonfigurisan: () => false, supabaseKlijent: () => { throw new Error('a gallery must not reach the data client'); } }));

import DizajnObjava from '../../app/dizajn-objava';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const labels = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => String(node.props.accessibilityLabel));
const open = async (group: string, scene: string) => {
  await act(async () => { tree = create(<DizajnObjava />); });
  const row = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === `${group}: ${scene}`)[0];
  expect(row).toBeDefined();
  await act(async () => row.props.onPress());
};
const MINE = 'Nacrt i moj zadatak';
beforeEach(() => { jest.clearAllMocks(); mockPackage = 'rs.uskoci.app.dev'; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = undefined as unknown as ReactTestRenderer; testRuntime.__DEV__ = originalDev; });

it('shows nothing but its refusal in a store build', async () => {
  mockPackage = 'rs.uskoci.app'; testRuntime.__DEV__ = false;
  await act(async () => { tree = create(<DizajnObjava />); });
  expect(text()).toBe('Nije dostupno.');
});

describe('the owner\'s own task: one block of state, the facts, and every action on the screen', () => {
  it('a task nobody has applied to says "Još nema prijava" once, with the edit beside it and no green action', async () => {
    await open(MINE, 'Objavljen, još nema prijava');
    const copy = text();
    expect(copy).toContain('Još nema prijava'); expect(copy).toContain('Objavljen');
    expect(copy).not.toMatch(/Čekaš prijave|zvonc|Vidiš ih ovde/);
    expect(tree.root.findAllByProps({ label: 'Izmeni zadatak' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ label: 'Pogledaj prijave' })).toHaveLength(0);
    expect(labels()).not.toContain('Više radnji');
  });

  it('applications waiting for a choice are the faces, the count and the ONE green action', async () => {
    await open(MINE, 'Objavljen, prijave čekaju izbor');
    expect(text()).toContain('3 prijave');
    expect(tree.root.findAllByProps({ label: 'Pogledaj prijave' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(3);
  });

  it('"Tražim ponude" is a fact with its picture, and what it means is one tap away behind a small ⓘ, not a sentence under it', async () => {
    await open(MINE, 'Tražim ponude, dve prijave');
    expect(text()).toContain('Tražim ponude');
    expect(text()).not.toMatch(/Svako ko se prijavi|Ne navodiš iznos/);
    expect(labels()).toContain('Objašnjenje: Tražim ponude');
  });

  it('a task for several people says how many in words, and the people already agreed after it, never as "1/3"', async () => {
    await open(MINE, 'Treba troje, jedan dogovoren');
    expect(text()).toContain('Treba 3 osobe'); expect(text()).toContain('1 dogovoreno'); expect(text()).not.toMatch(/\d\/\d/);
  });

  it('a closed search says so in one line and offers nothing more to choose', async () => {
    await open(MINE, 'Dogovoreno, potraga zatvorena');
    expect(text()).toContain('1 od 2 dogovoreno · preostala potraga je zatvorena');
    expect(tree.root.findAllByProps({ label: 'Pogledaj prijave' })).toHaveLength(0);
    // Nothing more can be closed once it is closed.
    expect(labels()).not.toContain('Ne traži više nikoga');
  });

  it('says when it was published, quietly and at the end, only when the read carries the time (the scene is a preview of what the server will make possible)', async () => {
    await open(MINE, 'Objavljen pre 2 sata (kad server pošalje vreme)');
    expect(text()).toContain('Objavljen pre 2 sata');
    await act(async () => tree.unmount());
    await open(MINE, 'Objavljen, prijave čekaju izbor');
    expect(text()).not.toMatch(/Objavljen pre/);
  });

  it('what cancels a live task nobody is agreed with is the red row that ends the page, and a task with an agreed place does not offer it', async () => {
    await open(MINE, 'Objavljen, prijave čekaju izbor');
    expect(labels()).toContain('Otkaži zadatak'); expect(labels()).not.toContain('Više radnji');
    // Red rows come last: nothing that follows the cancel row on the page is another row of the end.
    const rows = tree.root.findAll(node => String(node.type) === 'Press' && ['Otkaži zadatak', 'Ne traži više nikoga'].includes(String(node.props.accessibilityLabel)));
    expect(rows.map(node => node.props.accessibilityLabel)).toEqual(['Otkaži zadatak']);
    await act(async () => tree.unmount());
    await open(MINE, 'Treba troje, jedan dogovoren');
    expect(labels()).not.toContain('Otkaži zadatak'); expect(labels()).toContain('Ne traži više nikoga');
  });

  it('what ends something is a row at the end of the page, on the screen, with the lifecycle\'s own question', async () => {
    await open(MINE, 'Nacrt spreman za pregled');
    expect(labels()).toContain('Obriši nacrt'); expect(labels()).not.toContain('Više radnji');
    expect(tree.root.findAllByProps({ label: 'Izmeni nacrt' }).length).toBeGreaterThan(0);
  });
});
