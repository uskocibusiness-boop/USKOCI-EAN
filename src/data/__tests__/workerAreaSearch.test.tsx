import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerLocation } from '../../contracts/location';
import type { ConfiguredLocationResolution } from '../configuredLocationResolver';
import { WorkerLocationForm } from '../../app/(app)/profil/lokacija';

let mockFocused = true;
const mockProductionSearch = jest.fn();
jest.mock('../productionLocationResolver', () => ({ createProductionLocationResolver: () => ({ search: mockProductionSearch, cancel: jest.fn() }) }));
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: jest.fn() }));
jest.mock('expo-router', () => ({ router: {}, useFocusEffect: (effect: () => unknown) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
// The old Button is gone (2026-09-24); the area search actions are V2Action, drawn here under the same name.
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationField: 'LocationField',
  LocationScreen: 'LocationScreen', locationStyles: { section: {}, notice: {} } }));
jest.mock('../../ui/location/CountryField', () => ({ CountryField: 'CountryField', useCountryOptions: () => ({ countries: ['RS', 'BA'] }),
  selectableCountry: (_countries: unknown, country: string) => ['RS', 'BA'].includes(country) }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PinMap' }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});

type Props = React.ComponentProps<typeof WorkerLocationForm>;
let tree: ReactTestRenderer, props: Props;
const location: WorkerLocation = { accountId: 'owner-A', profileId: 'worker-A', revision: 'revision-A', operatingCountryCode: 'RS',
  city: 'Novi Sad', radiusKm: 25, approximatePosition: { latitude: 45.25, longitude: 19.83 } };
const proposals: ConfiguredLocationResolution = { status: 'PROPOSALS', requiresConfirmation: true, candidates: [{
  label: 'Synthetic public city', countryCode: 'RS', position: { latitude: 44.123456, longitude: 20.654321 },
  origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'approved-provider', candidateHint: 'provider-precise-id' },
}] };
const resolver = (result: ConfiguredLocationResolution = proposals) => ({ search: jest.fn().mockResolvedValue(result), cancel: jest.fn() });
const pending = () => {
  let resolve!: (value: ConfiguredLocationResolution) => void;
  const promise = new Promise<ConfiguredLocationResolution>(done => { resolve = done; });
  return { promise, resolve };
};
const button = (label: string) => tree.root.findAllByType('Button' as React.ElementType).find(node => node.props.label === label)!;
const field = (label: string) => tree.root.findAllByType('LocationField' as React.ElementType).find(node => node.props.label === label)!;
const map = () => tree.root.findByType('PinMap' as React.ElementType);
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = async (label: string) => { await act(async () => { void button(label).props.onPress(); }); };
const edit = async (label: string, value: string) => { await act(async () => field(label).props.onChangeText(value)); };
// The radius is chosen from the distances, one tap each (owner's phone, 8 Oct 2026: it stood twice, as a field and as chips): there is no numeric field.
const chip = (km: number) => tree.root.findByProps({ accessibilityLabel: `${km} km` });
const choose = async (km: number) => { await act(async () => chip(km).props.onPress()); };
async function render(overrides: Partial<Props> = {}) {
  props = { location, busy: false, uncertain: false, onSave: jest.fn(), ...overrides };
  await act(async () => { tree = create(<WorkerLocationForm {...props} />); });
}
async function update(overrides: Partial<Props> = {}) {
  props = { ...props, ...overrides };await act(async () => tree.update(<WorkerLocationForm {...props} />));
}
beforeEach(() => { mockFocused = true; jest.clearAllMocks(); mockProductionSearch.mockResolvedValue({ status: 'PROVIDER_ACTIVATION_BLOCKED' }); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('explains city-only fallback until a worker confirms a coarse map center', async () => {
  await render({ location: { ...location, approximatePosition: null } });
  expect(text()).toContain('Bez označenog centra zadaci se porede po gradu, ne po radijusu.');
  expect(map().props.position).toBeNull();
  expect(props.onSave).not.toHaveBeenCalled();
  await press('Sačuvaj područje rada');
  expect(props.onSave).toHaveBeenCalledWith({
    operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25, approximatePosition: null,
  });
});

it('explains the selected radius without choosing or saving any point implicitly', async () => {
  await render();
  expect(text()).toContain('Centar je označen. Sačuvaj područje da bi radijus važio.');
  expect(props.onSave).not.toHaveBeenCalled();
  expect(map().props.position).toEqual(location.approximatePosition);
});

it('does not query on mount or typing and uses the production resolver only after explicit search', async () => {
  await render();expect(mockProductionSearch).not.toHaveBeenCalled();await edit('Grad ili mesto rada', 'Beograd');
  expect(mockProductionSearch).not.toHaveBeenCalled();await press('Pronađi područje za uneti grad');
  expect(mockProductionSearch).toHaveBeenCalledWith({ text: 'Beograd', countryCode: 'RS', scopeKey: expect.any(String) });
  expect(text()).toContain('Pretraga područja još nije aktivirana');expect(props.onSave).not.toHaveBeenCalled();
});

it('sends only public city input and rounds candidates before Worker state/map, then saves only on the explicit save action', async () => {
  const search = resolver();await render({ resolver: search });await press('Pronađi područje za uneti grad');
  expect(search.search.mock.calls[0][0]).toEqual({ text: 'Novi Sad', countryCode: 'RS', scopeKey: expect.any(String) });
  expect(map().props.position).toEqual(location.approximatePosition);expect(props.onSave).not.toHaveBeenCalled();
  await press('Izaberi područje: Synthetic public city');
  expect(map().props.position).toEqual({ latitude: 44.12, longitude: 20.65 });
  expect(props.onSave).not.toHaveBeenCalled();
  await press('Sačuvaj područje rada');
  expect(props.onSave).toHaveBeenCalledWith({ operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25,
    approximatePosition: { latitude: 44.12, longitude: 20.65 } });
  expect(JSON.stringify((props.onSave as jest.Mock).mock.calls)).not.toMatch(/44\.123456|20\.654321|provider-precise-id|origin|address/);
});

it('radius edits preserve the base while city A-B-A clears it and rejects old candidates', async () => {
  await render({ resolver: resolver() });await choose(50);
  expect(map().props.position).toEqual(location.approximatePosition);
  await press('Pronađi područje za uneti grad');const old = button('Izaberi područje: Synthetic public city').props.onPress;
  await edit('Grad ili mesto rada', 'Beograd');await edit('Grad ili mesto rada', 'Novi Sad');await act(async () => old());
  expect(map().props.position).toBeNull();await press('Sačuvaj područje rada');
  expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ city: 'Novi Sad', radiusKm: 50, approximatePosition: null }));
});

it('country A-B-A clears the base and discards a late lookup from the first country', async () => {
  const late = pending(), search = resolver();search.search.mockReturnValueOnce(late.promise);
  await render({ resolver: search });await press('Pronađi područje za uneti grad');
  await act(async () => tree.root.findByType('CountryField' as React.ElementType).props.onChange('BA'));
  await act(async () => tree.root.findByType('CountryField' as React.ElementType).props.onChange('RS'));
  await act(async () => late.resolve(proposals));expect(map().props.position).toBeNull();
  expect(button('Izaberi područje: Synthetic public city')).toBeUndefined();
});

it('manual map choice rounds before state and cancels an older search without letting it replace the base', async () => {
  const late = pending(), search = resolver();search.search.mockReturnValueOnce(late.promise);
  await render({ resolver: search });await press('Pronađi područje za uneti grad');
  await act(async () => map().props.onChoose({ latitude: 43.876543, longitude: 21.123456 }));
  expect(map().props.position).toEqual({ latitude: 43.88, longitude: 21.12 });
  await act(async () => late.resolve(proposals));expect(button('Izaberi područje: Synthetic public city')).toBeUndefined();
  await press('Sačuvaj područje rada');
  expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ approximatePosition: { latitude: 43.88, longitude: 21.12 } }));
});

it('removing the base invalidates old candidate clicks', async () => {
  await render({ resolver: resolver() });await press('Pronađi područje za uneti grad');
  const retained = button('Izaberi područje: Synthetic public city').props.onPress;
  await press('Ukloni približnu tačku');await act(async () => retained());expect(map().props.position).toBeNull();
});

it('loading, cancellation, error/retry and empty states do not autochoose a point', async () => {
  const late = pending(), search = resolver();search.search.mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce({ status: 'UNAVAILABLE' }).mockResolvedValueOnce({ status: 'PROPOSALS', candidates: [], requiresConfirmation: true });
  await render({ resolver: search });await press('Pronađi područje za uneti grad');expect(text()).toContain('Tražimo predloge');
  await press('Otkaži pretragu područja');await act(async () => late.resolve(proposals));
  expect(button('Izaberi područje: Synthetic public city')).toBeUndefined();
  await press('Pronađi područje za uneti grad');expect(text()).toContain('Predlozi područja trenutno nisu dostupni');
  await press('Ponovi pretragu područja');expect(text()).toContain('Nema predloga za uneti grad');
  expect(map().props.position).toEqual(location.approximatePosition);expect(props.onSave).not.toHaveBeenCalled();
});

it('shows a rate limit and keeps manual base selection available without an automatic retry', async () => {
  const search = resolver();search.search.mockResolvedValue({ status: 'RATE_LIMITED' });
  await render({ resolver: search });await press('Pronađi područje za uneti grad');
  expect(text()).toContain('Previše pretraga za kratko vreme');expect(search.search).toHaveBeenCalledTimes(1);
  expect(map().props.disabled).toBeFalsy();expect(props.onSave).not.toHaveBeenCalled();
});

it('blur/refocus drops candidates and a retained click cannot select a point', async () => {
  await render({ resolver: resolver() });await press('Pronađi područje za uneti grad');
  const retained = button('Izaberi područje: Synthetic public city').props.onPress;
  mockFocused = false;await update();mockFocused = true;await update();await act(async () => retained());
  expect(map().props.position).toEqual(location.approximatePosition);expect(props.onSave).not.toHaveBeenCalled();
});

it('account/profile/revision changes remount Worker drafts and reject a previous account result', async () => {
  const late = pending(), search = resolver();search.search.mockReturnValueOnce(late.promise);
  await render({ resolver: search });await choose(100);await press('Pronađi područje za uneti grad');
  await update({ location: { ...location, accountId: 'owner-B', profileId: 'worker-B', city: 'Mostar', operatingCountryCode: 'BA', radiusKm: 15, approximatePosition: null } });
  await act(async () => late.resolve(proposals));expect(button('Izaberi područje: Synthetic public city')).toBeUndefined();
  expect(field('Grad ili mesto rada').props.value).toBe('Mostar');
  // The new account's radius (15, not among the distances) has its own chip, selected; the old account's choice (100) did not carry over.
  expect(chip(15).props.accessibilityState.checked).toBe(true);expect(chip(100).props.accessibilityState.checked).toBe(false);
  expect(map().props.position).toBeNull();
});

it('a busy/ready transition invalidates an in-flight result', async () => {
  const late = pending(), search = resolver();search.search.mockReturnValueOnce(late.promise);
  await render({ resolver: search });await press('Pronađi područje za uneti grad');await update({ busy: true });await update({ busy: false });
  await act(async () => late.resolve(proposals));expect(button('Izaberi područje: Synthetic public city')).toBeUndefined();
});
