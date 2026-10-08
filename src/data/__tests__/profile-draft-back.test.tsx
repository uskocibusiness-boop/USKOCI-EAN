import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The first test pays for loading both editors and their presentation; on a loaded machine that is more than Jest's 5 s default.
jest.setTimeout(30_000);
const mockBack = { handlers: [] as (() => boolean)[] };
let mockFocused = true;
let mockSession = { user: { id: 'owner-a' }, accountRevision: 1 };
let mockEditor: { data: Record<string, unknown>; busy: boolean; uncertain: boolean; loading: boolean; error: null;
  saved: boolean; refresh: jest.Mock; save: jest.Mock };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: () => mockEditor }));
jest.mock('../requesterProfileClientService', () => ({ requesterProfileClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
      mockBack.handlers.push(handler);
      return { remove: () => { mockBack.handlers = mockBack.handlers.filter(item => item !== handler); } };
    } };
    return ['View', 'TextInput', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsScreen: 'SettingsScreen', SettingsText: 'T', SettingsAction: 'Button',
  // "Lični podaci" (T4a, 2026-10-07; "Izmeni profil" until 8 Oct 2026) also draws the rows of "O meni" and the city under the name.
  SettingsGroup: 'SettingsGroup', SettingsRow: 'SettingsRow' }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
// One data source for the life of the test, as in the app: a source that is new on every render would restart the work-profile read on every render.
const mockIzvor = { mojRadnikProfil: async () => null };
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockIzvor }));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation', () => ({ WorkerProfileFrame: 'WorkerProfileFrame' }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationField: 'LocationField', locationStyles: { section: {} } }));
jest.mock('../../ui/location/CountryField', () => ({ CountryField: 'CountryField', useCountryOptions: () => ({ countries: ['RS'] }),
  selectableCountry: (_countries: unknown, country: string) => country === 'RS' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PinMap' }));
jest.mock('../../ui/location/WorkerAreaSearch', () => ({ WorkerAreaSearch: 'AreaSearch' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
// Only the native sheet host is substituted: the actual confirmation and route guards execute.
jest.mock('../../ui/product/ProductSheet', () => ({ SHEET_TOUCH: 48, ProductSheet: ({ children, footer, onClose }: any) =>
  require('react').createElement(require('react').Fragment, null,
    typeof children === 'function' ? children(onClose) : children, footer?.(onClose)) }));

import { router } from 'expo-router';
import Personal from '../../app/(app)/profil/podaci';
import Area from '../../app/(app)/profil/lokacija';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

let tree: ReactTestRenderer;
type Kind = 'name' | 'area';
const cases: Kind[] = ['name', 'area'];
const route = (kind: Kind) => kind === 'name' ? <Personal /> : <Area />;
const frame = () => tree.root.findAll(node => ['SettingsScreen', 'WorkerProfileFrame'].includes(String(node.type)))[0];
const back = async () => { await act(async () => { const p = frame().props; (p.onBack ?? p.back)(); }); };
// The radius is chosen from the distances, one tap each (there is no numeric field any more): "50 km" is a change from the saved 25.
const input = (kind: Kind) => kind === 'name' ? tree.root.findByProps({ accessibilityLabel: 'Ime za prikaz' })
  : tree.root.findByProps({ accessibilityLabel: '50 km' });
const edit = async (kind: Kind) => { await act(async () => kind === 'name' ? input(kind).props.onChangeText('Novo ime') : input(kind).props.onPress()); };
const edited = (kind: Kind) => kind === 'name' ? input(kind).props.value === 'Novo ime' : input(kind).props.accessibilityState.checked === true;
const tap = async (id: string) => { await act(async () => tree.root.findByProps({ testID: id }).props.onPress()); };
async function render(kind: Kind) {
  mockEditor.data = kind === 'name' ? { displayName: 'Prethodno ime', revision: 'r1' }
    : { accountId: 'owner-a', profileId: 'worker-a', revision: 'r1', operatingCountryCode: 'RS', city: 'Novi Sad',
      radiusKm: 25, approximatePosition: null };
  await act(async () => { tree = create(route(kind)); });
}
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockBack.handlers = []; mockSession = { user: { id: 'owner-a' }, accountRevision: 1 };
  mockEditor = { data: {}, busy: false, uncertain: false, loading: false, error: null, saved: false, refresh: jest.fn(), save: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each(cases)('%s: toolbar cancel preserves typed draft; Android Back asks again and confirmed discard leaves once without saving', async kind => {
  await render(kind); await edit(kind); await back();
  expect(router.back).not.toHaveBeenCalled();
  await tap('confirm-sheet-cancel');
  expect(edited(kind)).toBe(true);
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  let handled = false;
  await act(async () => { handled = mockBack.handlers.at(-1)!(); });
  expect(handled).toBe(true); expect(router.back).not.toHaveBeenCalled();
  const oldConfirm = tree.root.findByType(ConfirmSheet).props.onConfirm;
  await tap('confirm-sheet-confirm');
  await act(async () => oldConfirm());
  expect(router.back).toHaveBeenCalledTimes(1); expect(mockEditor.save).not.toHaveBeenCalled();
});

it.each(cases)('%s: unchanged values leave without a discard prompt', async kind => {
  await render(kind); await back();
  expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
});

it.each(cases)('%s: a stale discard confirmation cannot navigate after focus or account changes', async kind => {
  await render(kind); await edit(kind); await back();
  const confirm = tree.root.findByType(ConfirmSheet).props.onConfirm;
  mockFocused = false;
  await act(async () => tree.update(route(kind)));
  await act(async () => confirm());
  expect(router.back).not.toHaveBeenCalled(); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  mockFocused = true;
  await act(async () => tree.update(route(kind)));
  await back();
  const next = tree.root.findByType(ConfirmSheet).props.onConfirm;
  mockSession = { user: { id: 'owner-b' }, accountRevision: 2 };
  await act(async () => next());
  expect(router.back).not.toHaveBeenCalled(); expect(mockEditor.save).not.toHaveBeenCalled();
});

it.each(cases)('%s: an unconfirmed save is not described as an unsaved draft', async kind => {
  await render(kind); await edit(kind);
  mockEditor = { ...mockEditor, uncertain: true };
  await act(async () => tree.update(route(kind)));
  await back();
  expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  expect(mockEditor.save).not.toHaveBeenCalled();
});
