import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The round 5 device-check gallery (owner step 11b): every scene renders the real presentation components from fixtures
// without throwing, returns to the scene list, and reaches no data service or navigation.
const mockBack = jest.fn(), mockPush = jest.fn(), mockReplace = jest.fn(), mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a),
  navigate: (...a: unknown[]) => mockNavigate(...a), canGoBack: () => true }, useFocusEffect: () => undefined,
  // A scene can be opened by its address (`?scene=`), for the design lab; the tests open them from the list.
  useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
// Only Android Back is replaced, so the scenes' own hardware-back listeners can be heard.
const mockBackHandlers: { list: (() => boolean)[] } = { list: [] };
jest.mock('react-native', () => { const rn = jest.requireActual('react-native'); return new Proxy(rn, { get(target, key) {
  if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
    mockBackHandlers.list.push(handler); return { remove: () => { mockBackHandlers.list = mockBackHandlers.list.filter(item => item !== handler); } }; } };
  return Reflect.get(target, key);
} }); });
jest.mock('../src/data/supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('unexpected transport'); } }));
jest.mock('../src/data/supportCaseClientService', () => ({ supportCaseClientService: new Proxy({}, { get: () => () => { throw new Error('unexpected support read'); } }) }));
jest.mock('../src/data/agreementClientService', () => ({ agreementClientService: { mojiDogovori: () => { throw new Error('unexpected agreement read'); } } }));
import Gallery from '../src/app/dizajn-privatnost';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const scenes = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityRole === 'button'
  && /^[A-ZŠĐČĆŽ][^:]+: /.test(node.props.accessibilityLabel) && typeof node.type !== 'string').map(node => node.props.accessibilityLabel as string);

it('reaches every scene by its visible label and comes back to the list with "Nazad"', async () => {
  await act(async () => { tree = create(<Gallery />); });
  const labels = [...new Set(scenes())];
  expect(labels.length).toBeGreaterThanOrEqual(45);
  for (const label of labels) {
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress());
    const back = tree.root.findAll(node => node.props.accessibilityLabel === 'Nazad' && typeof node.props.onPress === 'function');
    expect(back.length).toBeGreaterThan(0);
    await act(async () => back[back.length - 1].props.onPress());
    expect(scenes()).toContain(label);
  }
  expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
// It walks every scene (46 since the round 5 review) in one test: a longer budget than a single-screen test, so a loaded
// machine does not fail it.
}, 60_000);

it('Android Back inside a scene returns to the list, as "Nazad" does, and leaves no listener behind', async () => {
  await act(async () => { tree = create(<Gallery />); });
  expect(mockBackHandlers.list).toHaveLength(0);
  await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Izvoz: Kopija nije dostupna' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(mockBackHandlers.list.length).toBeGreaterThan(0);
  let handled = false; await act(async () => { handled = mockBackHandlers.list[mockBackHandlers.list.length - 1](); });
  expect(handled).toBe(true); expect(scenes()).toContain('Izvoz: Kopija nije dostupna'); expect(mockBackHandlers.list).toHaveLength(0);
  expect(mockBack).not.toHaveBeenCalled();
});

it('the support scenes\' own arrow returns to the list and reaches no route', async () => {
  await act(async () => { tree = create(<Gallery />); });
  for (const label of ['Podrška: Lista zahteva', 'Novi zahtev: Forma', 'Zahtev: Razgovor i odluka']) {
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress());
    const arrows = tree.root.findAll(node => node.props.accessibilityLabel === 'Nazad' && typeof node.props.onPress === 'function');
    // The first "Nazad" is the scene's own arrow; the last is the gallery's strip.
    expect(arrows.length).toBeGreaterThan(1);
    await act(async () => arrows[0].props.onPress());
    expect(scenes()).toContain(label);
  }
  expect(mockBack).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('the closure start in the gallery asks its real question and starts nothing', async () => {
  await act(async () => { tree = create(<Gallery />); });
  await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Zatvaranje: Pregled spreman' && typeof node.props.onPress === 'function')[0].props.onPress());
  await act(async () => tree.root.findAll(node => node.props.label === 'Pokreni zatvaranje naloga')[0].props.onPress());
  const confirm = tree.root.findByProps({ testID: 'confirm-sheet-confirm' });
  expect(confirm.props.accessibilityLabel).toBe('Da, trajno zatvori nalog');
  await act(async () => confirm.props.onPress());
  expect(mockPush).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
});
