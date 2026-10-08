import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[]; [key: string]: unknown } = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
const mockInbox = jest.fn();
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ router: mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
  return ['View', 'ScrollView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }));
jest.mock('../../ui/entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup' }));
jest.mock('../../ui/home/HomeIllustration', () => ({ HomeIllustration: 'HomeIllustration' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: () => { mockInbox(); throw new Error('The Home gallery must not mount a live inbox.'); } }));
jest.mock('../supabaseClient', () => { throw new Error('The Home gallery must not load a data client.'); });
jest.mock('../../store/uloga', () => { throw new Error('The Home gallery must not read account data.'); });

import Gallery from '../../app/dizajn-pocetna';
import { HomePresentation } from '../../ui/home/HomePresentation';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const text = () => tree.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async () => { await act(async () => { tree = create(<Gallery />); }); };

beforeEach(() => { jest.clearAllMocks(); testRuntime.__DEV__ = false; mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); testRuntime.__DEV__ = originalDev; });

it.each(['rs.uskoci.app', 'rs.uskoci.app.dev.store', undefined])('refuses fixture content in a store build (%s), regardless of the scene query', async packageName => {
  mockPackage = packageName;
  mockParams = { scene: 'flexible', internal: 'true', dev: 'true' };
  await render();
  expect(text()).toBe('Nije dostupno.');
  expect(tree.root.findAllByType(HomePresentation)).toHaveLength(0);
  expect(mockInbox).not.toHaveBeenCalled();
});

it('retains the development-runtime boundary used by the other galleries', async () => {
  testRuntime.__DEV__ = true; mockPackage = 'rs.uskoci.app';
  await render();
  expect(tree.root.findAllByType(HomePresentation)).toHaveLength(1);
});

it.each([
  // 2026-10-07 (Raspored): the scenes that drew an "Aktivni Dogovor" card are replaced. `long` is the longest the card may meet,
  // `loose` an active Dogovor with no day to show it on (no confirmed term, or a term that passed unfinished: one quiet line, no
  // card), `quiet` a working account with nothing waiting and nothing scheduled, `empty` a brand-new account.
  ['upcoming', 'Danas · 14:00–16:00', 'Jelena Nikolić'],
  ['long', 'Četvrtak, 15. okt · 22:00 – petak, 16. okt 06:00', 'Aleksandra Konstantinović-Radovanović'],
  ['loose', '2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak', '2 aktivna · 1 nacrt'],
  ['quiet', 'Ništa ne čeka tvoju odluku.', '2 aktivna · 1 nacrt'],
  ['empty', 'Još nemaš zadatak', 'Još nemaš prijavu'],
  ['unavailable', 'Ne možemo da učitamo Dogovore.', 'Ne možemo da učitamo ono što te čeka.'],
])('renders the real Home for %s without a gallery wrapper or live action', async (scene, first, second) => {
  mockParams = { scene };
  await render();
  const presentation = tree.root.findByType(HomePresentation);
  expect(presentation.parent?.type).toBe(Gallery);
  expect(tree.root.findAllByType('SafeAreaView' as React.ElementType)).toHaveLength(1);
  expect(tree.root.findAllByType('ScrollView' as React.ElementType)).toHaveLength(1);
  expect(text()).toContain(first); expect(text()).toContain(second);
  // The block exists where an appointment lies ahead (a card), where an active Dogovor has no confirmed term (one quiet line)
  // and where the read failed (its own words); the others draw none and no placeholder for it.
  expect(text().includes('Raspored')).toBe(['upcoming', 'long', 'loose', 'unavailable'].includes(scene));
  // Only an appointment ahead is a card; the quiet line of `loose` never shows the Dogovor's own title or its display sentence.
  expect(text().includes('Montaža police u hodniku') || text().includes('Prenos troseda')).toBe(scene === 'upcoming' || scene === 'long');
  if (scene === 'loose') {
    expect(text()).not.toContain('Krečenje stana u belo'); expect(text()).not.toContain('Termin nije potvrđen');
    expect(presentation.props.home.agreements.value.rows[0]).not.toHaveProperty('raspored');
    // "Početna ne laže": a Dogovor without a term is asked about under "Čeka te", so nothing there says that nothing waits.
    expect(text()).toContain('Predloži termin'); expect(text()).toContain('Termin još nije dogovoren.');
    expect(text()).not.toContain('Ništa ne čeka tvoju odluku.');
  }
  // The brand-new account's one quiet row (N4: "Kako radi", three steps, "Sakrij") stands in the empty scene and nowhere else.
  expect(text().includes('Kako radi')).toBe(scene === 'empty');
  if (scene === 'empty') for (const step of ['Objavi ili pronađi', 'Dogovori se', 'Oceni']) expect(text()).toContain(step);
  // What is counted is Dogovori, in every scene: never "zadatak" for an agreement.
  expect(text()).not.toMatch(/zadatak bez|zadatka bez|zadataka bez/);
  if (scene === 'upcoming') expect(text()).toContain('Ove nedelje još 2 Dogovora · 1 Dogovor bez tačnog termina');
  if (scene === 'long') expect(text()).toContain('Ove nedelje još 12 Dogovora · 21 Dogovor bez tačnog termina · 3 Dogovora čekaju završetak');
  await act(async () => {
    for (const control of tree.root.findAll(node => ['Press', 'Action'].includes(String(node.type)))) control.props.onPress?.();
    tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh();
  });
  expect(mockInbox).not.toHaveBeenCalled();
  for (const navigate of Object.values(mockRouter)) expect(navigate).not.toHaveBeenCalled();
});

// 2026-10-08: the scenes that show what the phone adds to "Čeka te" and the states of the screen itself. Each is the real Home with its
// own fixture and no live action: `waits` holds every kind of row it can hold (a choice of applications, a change to answer, a Dogovor
// with no term, a draft, a rating) and the work profile still to be set up; `worker` the "Slobodan sam sada" switch of an active profile;
// `stale` the last overview kept after a failed read; `loading` the first read on its way.
it.each([
  ['waits', ['Pomoć pri selidbi', 'Odgovori na predlog izmene', 'Predloži termin', 'Termin još nije dogovoren.', 'Nastavi nacrt',
    'Oceni 2 završena Dogovora', 'Podesi radni profil', 'Raspored']],
  ['worker', ['Slobodan sam sada', 'Uključeno. Važi dok ga ne isključiš.', 'Ništa ne čeka tvoju odluku.']],
  ['stale', ['Nema veze. Prikazano je poslednje učitano.', 'Pomoć pri selidbi', 'Danas · 14:00–16:00']],
  ['loading', ['Objavi zadatak', 'Moji zadaci', 'Moje prijave']],
])('renders the real Home for the scene %s with its own words and no live action', async (scene, words) => {
  mockParams = { scene };
  await render();
  expect(tree.root.findByType(HomePresentation).parent?.type).toBe(Gallery);
  for (const word of words) expect(text()).toContain(word);
  // The profile's setup row stands only where the profile still has to be set up; the switch only where it is active.
  expect(text().includes('Podesi radni profil')).toBe(scene === 'waits');
  expect(text().includes('Slobodan sam sada')).toBe(scene === 'worker');
  expect(text().includes('Nema veze')).toBe(scene === 'stale');
  await act(async () => {
    for (const control of tree.root.findAll(node => ['Press', 'Action'].includes(String(node.type)))) control.props.onPress?.();
    tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh();
  });
  expect(mockInbox).not.toHaveBeenCalled();
  for (const navigate of Object.values(mockRouter)) expect(navigate).not.toHaveBeenCalled();
});

it.each([undefined, 'not-a-scene', ['flexible'], ['empty', 'upcoming']])('falls back to the fixed upcoming example for an unallowlisted query (%j)', async scene => {
  mockParams = { scene };
  await render();
  expect(text()).toContain('Montaža police u hodniku');
  expect(text()).toContain('Danas · 14:00–16:00');
});
