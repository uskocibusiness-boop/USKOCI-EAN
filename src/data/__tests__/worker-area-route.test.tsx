import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerLocation } from '../../contracts/location';

/**
 * The work-area route (/profil/lokacija), recomposed 2026-09-24: the save stands in the screen's
 * sticky footer, the form stays on screen while it is read again, and the states without data are the one StateView.
 * The route still saves through the revision-bound writer with an explicit confirmation.
 */
const mockMarkets = [
  { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn', defaultTimezone: 'Europe/Belgrade' },
];
const mockRefresh = jest.fn(), mockSaveCall = jest.fn(), mockWriter = jest.fn();
const mockModeRefresh = jest.fn();
let mockParams: { mode?: string; profileId?: string } = {};
let mockModeView: import('../../hooks/useWorkerExecutionModes').WorkerExecutionModeView = { kind: 'confirmed', modes: ['ON_SITE'] };
jest.mock('../../hooks/useWorkerExecutionModes', () => ({ useWorkerExecutionModes: () => ({ view: mockModeView, refresh: mockModeRefresh }) }));
type Editor = { data: WorkerLocation | null; loading: boolean; busy: boolean; error: string | null; uncertain: boolean; saved: boolean };
let mockEditor: Editor;
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: 'account-a' }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: 'account-a' }, accountRevision: 1 }),
}));
jest.mock('../marketClientService', () => ({ marketClientService: { list: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({
  data: { ok: true, podatak: mockMarkets }, loading: false, error: false, refresh: jest.fn(),
}) }));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: () => ({ ...mockEditor, refresh: mockRefresh, save: mockSaveCall }) }));
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: jest.fn(), save: (...a: unknown[]) => mockWriter(...a) } }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));

import Route, { WorkerLocationForm } from '../../app/(app)/profil/lokacija';

const location = (): WorkerLocation => ({ accountId: 'account-a', profileId: 'worker-a', revision: 'revision-a',
  operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25, approximatePosition: null } as WorkerLocation);
const idle = (patch: Partial<Editor> = {}): Editor => ({ data: location(), loading: false, busy: false, error: null, uncertain: false, saved: false, ...patch });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const buttons = (label: string) => tree.root.findAll(node => String(node.type) === 'Button' && node.props.label === label);
async function render() { await act(async () => { tree = create(<Route />); }); }
beforeEach(() => { jest.clearAllMocks(); mockEditor = idle(); mockParams = {}; mockModeView = { kind: 'confirmed', modes: ['ON_SITE'] }; });
afterEach(async () => { await act(async () => tree?.unmount()); });

















describe('saved profile point confirmation', () => {
  beforeEach(() => { mockParams = { mode: 'point', profileId: 'worker-a' }; });
  const map = () => tree.root.findByType('ResolvedPinMap' as any);
  const update = async () => { await act(async () => tree.update(<Route />)); };

  it('has only a human-selected coarse point, preserves saved city/country/radius and confirms the owned revision', async () => {
    mockWriter.mockResolvedValue({ ok: true, podatak: { location: location() } });
    await render();
    expect(texts()).toContain('Novi Sad · 25 km');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Grad ili mesto rada' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityRole: 'radiogroup' })).toHaveLength(0);
    expect(map().props.position).toBeNull(); // A city name must never fabricate coordinates.
    expect(buttons('Potvrdi tačku')[0].props.disabled).toBe(true);
    await act(async () => buttons('Potvrdi tačku')[0].props.onPress());
    expect(mockSaveCall).not.toHaveBeenCalled();
    await act(async () => map().props.onChoose({ latitude: 45.2671, longitude: 19.8335 }));
    expect(map().props.position).toEqual({ latitude: 45.27, longitude: 19.83 });
    await act(async () => buttons('Potvrdi tačku')[0].props.onPress());
    await act(async () => mockSaveCall.mock.calls[0][0]());
    expect(mockWriter).toHaveBeenCalledWith({ expectedRevision: 'revision-a', confirmed: true,
      value: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25, approximatePosition: { latitude: 45.27, longitude: 19.83 } } });
  });

  it('cannot use a point callback to change the AI-owned city or radius', async () => {
    mockWriter.mockResolvedValue({ ok: true, podatak: { location: location() } });
    await render();
    await act(async () => tree.root.findByType(WorkerLocationForm).props.onSave({
      operatingCountryCode: 'HU', city: 'Budapest', radiusKm: 200, approximatePosition: { latitude: 45.27, longitude: 19.83 },
    }));
    await act(async () => mockSaveCall.mock.calls[0][0]());
    expect(mockWriter.mock.calls[0][0].value).toEqual({ operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25,
      approximatePosition: { latitude: 45.27, longitude: 19.83 } });
  });

  it.each(['remote', 'unconfirmed', 'loading', 'unavailable', 'other-profile', 'missing-profile'])(
    '%s cannot open the on-site map or submit coordinates', async state => {
      if (state === 'remote') mockModeView = { kind: 'confirmed', modes: ['REMOTE'] };
      else if (state === 'other-profile') mockParams.profileId = 'worker-other';
      else if (state === 'missing-profile') delete mockParams.profileId;
      else mockModeView = { kind: state as 'loading' | 'unavailable' | 'unconfirmed' };
      await render();
      expect(tree.root.findAllByType('ResolvedPinMap' as any)).toHaveLength(0);
      expect(buttons('Potvrdi tačku')).toHaveLength(0);
      expect(mockSaveCall).not.toHaveBeenCalled();
      if (state === 'unavailable') {
        await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
        expect(mockModeRefresh).toHaveBeenCalledTimes(1); expect(mockRefresh).toHaveBeenCalledTimes(1);
      }
    });

  it('keeps an unsaved point through a mode refresh, blocks a retained save, and never restores a map for remote work', async () => {
    await render();
    await act(async () => map().props.onChoose({ latitude: 45.27, longitude: 19.83 }));
    const retained = buttons('Potvrdi tačku')[0].props.onPress;
    mockModeView = { kind: 'loading' }; await update();
    expect(map().props.disabled).toBe(true); expect(buttons('Potvrdi tačku')).toHaveLength(0);
    await act(async () => retained()); expect(mockSaveCall).not.toHaveBeenCalled();
    mockModeView = { kind: 'confirmed', modes: ['ON_SITE'] }; await update();
    expect(map().props.position).toEqual({ latitude: 45.27, longitude: 19.83 });
    mockModeView = { kind: 'confirmed', modes: ['REMOTE'] }; await update();
    expect(tree.root.findAllByType('ResolvedPinMap' as any)).toHaveLength(0);
    await act(async () => retained()); expect(mockSaveCall).not.toHaveBeenCalled();
  });

  it('rejects a retained callback after a location revision changes and reconciles unknown outcomes without writing again', async () => {
    await render();
    await act(async () => map().props.onChoose({ latitude: 45.27, longitude: 19.83 }));
    const retained = buttons('Potvrdi tačku')[0].props.onPress;
    mockEditor = idle({ data: { ...location(), revision: 'revision-b' } }); await update();
    await act(async () => retained()); expect(mockSaveCall).not.toHaveBeenCalled();
    mockEditor = idle({ uncertain: true, error: 'Čuvanje nije potvrđeno.' }); await update();
    expect(map().props.disabled).toBe(true); expect(buttons('Potvrdi tačku')).toHaveLength(0);
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(mockRefresh).toHaveBeenCalledTimes(1); expect(mockSaveCall).not.toHaveBeenCalled();
  });
});
