import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NeedLocationReview, WorkerLocation } from '../../contracts/location';

const mockMarkets = [
  { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn', defaultTimezone: 'Europe/Belgrade' },
  { countryCode: 'BA', productStatus: 'LIVE', defaultCurrencyCode: 'BAM', defaultLanguageTag: 'bs', defaultTimezone: 'Europe/Sarajevo' },
  { countryCode: 'HR', productStatus: 'COMING', defaultCurrencyCode: 'EUR', defaultLanguageTag: 'hr', defaultTimezone: 'Europe/Zagreb' },
];
jest.mock('../marketClientService', () => ({ marketClientService: { list: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({
  data: { ok: true, podatak: mockMarkets }, loading: false, error: false, refresh: jest.fn(),
}) }));

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: jest.fn() }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));

import { NeedLocationForm, saveBlockReason } from '../../ui/location/NeedLocationForm';
import { WorkerLocationForm, radiusChoices } from '../../app/(app)/profil/lokacija';
import { StyleSheet } from 'react-native';
import { sys } from '../../ui/system/tokens';

const review = (): NeedLocationReview => ({ accountId: 'account-a', conversationId: 'conversation-a', editable: true,
  confirmed: true, revision: 'revision-a', value: { geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } },
    taskCountryCode: 'RS', exactAddress: 'Privatna ulica 17, stan 2', accessNotes: 'Privatna šifra ulaza 1234' } } as NeedLocationReview);
const location = (): WorkerLocation => ({ accountId: 'account-a', profileId: 'worker-a', revision: 'revision-a',
  operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25, approximatePosition: { latitude: 45.26, longitude: 19.83 } } as WorkerLocation);

let tree: ReactTestRenderer;
const saveButton = (label = 'Sačuvaj mesto') => tree.root.findByProps({ label });
async function openChoice(label: string) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress()); }
async function chooseMode(label: string) {
  if (!tree.root.findAllByProps({ accessibilityLabel: label }).length) {
    const country = ['Srbija', 'Bosna i Hercegovina', 'Hrvatska'].includes(label);
    const field = country ? tree.root.findAllByProps({ accessibilityLabel: 'Država rada' }).length ? 'Država rada' : 'Država zadatka' : 'Način rada';
    // The task form folds country and mode into "Država i način rada" once a country is set (2026-09-23).
    if (!tree.root.findAllByProps({ accessibilityLabel: field }).length && tree.root.findAllByProps({ accessibilityLabel: 'Država i način rada' }).length) await openChoice('Država i način rada');
    await openChoice(field);
  }
  await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
}
async function edit(label: string, text: string) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(text)); }
async function save(label?: string) { await act(async () => saveButton(label).props.onPress()); }
const text = () => tree.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('actual native Need location form', () => {
  it('keeps private details out of the initial form and preserves edits across disclosure', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Tačna adresa (privatno, opciono)' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Mesto rada — deo grada (opciono)' })).toHaveLength(0);
    await openChoice('Privatni detalji zadatka');
    await edit('Tačna adresa (privatno, opciono)', 'Sačuvana privatna ispravka');
    await openChoice('Privatni detalji zadatka'); await openChoice('Privatni detalji zadatka');
    expect(tree.root.findByProps({ accessibilityLabel: 'Tačna adresa (privatno, opciono)' }).props.value).toBe('Sačuvana privatna ispravka');
    await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ exactAddress: 'Sačuvana privatna ispravka' }));
  });

  it('the save action is the confirmation, without a second checkbox', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findAllByProps({ accessibilityRole: 'checkbox' })).toHaveLength(0);
    expect(saveButton().props.disabled).toBe(false);
    await save();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('requires point confirmation before saving and does not publish the precise point in geography', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await act(async () => tree.root.findByType('ResolvedPinMap' as never).props.onChoose({ latitude: 45.251234, longitude: 19.831234 }));
    act(() => { saveButton().props.onPress(); });
    expect(onSave).not.toHaveBeenCalled();
    act(() => { tree.root.findByProps({ label: 'Potvrdi tačku: Mesto rada' }).props.onPress(); });
    act(() => { saveButton().props.onPress(); });
    expect(onSave.mock.calls[0][0].resolvedLocation.points[0]).toMatchObject({ slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' } });
    expect(JSON.stringify(onSave.mock.calls[0][0].geography)).not.toMatch(/latitude|longitude|Privatna/);
  });

  it('discard restores the latest confirmed point and preserves the other route point without saving a draft', async () => {
    const onSave = jest.fn(), base = review();
    const geography = { mode: 'POINT_TO_POINT' as const, start: { city: 'Novi Sad' }, end: { city: 'Beograd' } };
    const startPoint = { slot: 'start' as const, latitudeE6: 45251234, longitudeE6: 19831234,
      origin: { kind: 'MANUAL_PIN' as const }, address: 'Potvrđena polazna adresa', accessNotes: 'Zvono 2' };
    const endPoint = { slot: 'end' as const, latitudeE6: 44812345, longitudeE6: 20461234,
      origin: { kind: 'MANUAL_PIN' as const }, address: 'Potvrđena adresa odredišta' };
    const resolvedLocation = { version: 1 as const, binding: { taskCountryCode: 'RS', geography,
      exactAddress: base.value.exactAddress }, points: [startPoint, endPoint] };
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, geography, resolvedLocation } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    const map = () => tree.root.findByType('ResolvedPinMap' as never);
    const move = async (latitude: number, longitude: number) => {
      await act(async () => map().props.onChoose({ latitude, longitude }));
    };
    const discard = async () => {
      await act(async () => tree.root.findByProps({ label: 'Odbaci nepotvrđenu tačku' }).props.onPress());
    };

    await move(45.26, 19.84); await move(45.27, 19.85);
    expect(saveButton().props.disabled).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Tačka koju uređuješ' }).props.accessibilityValue.text).toContain('čeka potvrdu');
    await save(); expect(onSave).not.toHaveBeenCalled();
    await discard();
    expect(onSave).not.toHaveBeenCalled();
    expect(map().props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    expect(saveButton().props.disabled).toBe(false);
    await save(); expect(onSave.mock.calls[0][0].resolvedLocation).toEqual(resolvedLocation);

    // A new explicit confirmation becomes the baseline, not the original server value.
    await move(45.28, 19.86);
    await act(async () => tree.root.findByProps({ label: 'Potvrdi tačku: Polazište' }).props.onPress());
    await save();
    const latest = onSave.mock.calls[1][0].resolvedLocation;
    expect(latest.points[0]).toMatchObject({ slot: 'start', latitudeE6: 45280000, longitudeE6: 19860000 });
    expect(latest.points[1]).toEqual(endPoint);
    await move(45.29, 19.87);
    await save(); expect(onSave).toHaveBeenCalledTimes(2);
    await discard();
    expect(map().props.position).toEqual({ latitude: 45.28, longitude: 19.86 });
    await save(); expect(onSave.mock.calls[2][0].resolvedLocation).toEqual(latest);
  });

  it.each(['city', 'country'] as const)('changing %s and returning cannot revive the confirmed baseline of a pending point', async field => {
    const onSave = jest.fn(), base = review();
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS',
      geography: base.value.geography!, exactAddress: base.value.exactAddress }, points: [
      { slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' } },
    ] } } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    await act(async () => tree.root.findByType('ResolvedPinMap' as never).props.onChoose({ latitude: 45.26, longitude: 19.84 }));
    if (field === 'city') {
      await edit('Mesto rada — grad ili mesto', 'Beograd'); await edit('Mesto rada — grad ili mesto', 'Novi Sad');
    } else {
      await chooseMode('Bosna i Hercegovina'); await chooseMode('Srbija');
    }
    expect(tree.root.findAllByProps({ label: 'Odbaci nepotvrđenu tačku' })).toHaveLength(0);
    await save();
    expect(onSave.mock.calls[0][0].resolvedLocation).toBeNull();
    expect(tree.root.findByType('ResolvedPinMap' as never).props.position).toBeNull();
  });
  it('requires an explicit country for historical location without assuming Serbia', async () => {
    const onSave = jest.fn();
    const historical = review();
    await act(async () => { tree = create(<NeedLocationForm review={{ ...historical, value: { ...historical.value, taskCountryCode: null } }} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Država zadatka' }).props.accessibilityValue.text).toBe('Nije izabrano');
    await save(); expect(onSave).not.toHaveBeenCalled();
    // The reason is a line ABOVE the grey action (the system's foot says it the same way), and the action itself carries none.
    expect(text()).toContain('Izaberi državu u „Država i način rada“'); expect(saveButton().props.reason).toBeUndefined();
    await chooseMode('Srbija'); await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ taskCountryCode: 'RS' }));
  });

  it('saves an existing review in one press and preserves its private fields', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    expect(saveButton().props.disabled).toBe(false);
    // A live save has no reason line above it; what stands there is only what the save will do.
    expect(text()).not.toMatch(/Izaberi državu|Potvrdi tačku na mapi|Ne znamo da li/);
    await save();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } },
      exactAddress: 'Privatna ulica 17, stan 2', accessNotes: 'Privatna šifra ulaza 1234' }));
  });

  it('remote sends no old geography points, exact address, or access notes', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await chooseMode('Na daljinu');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Tačna adresa (privatno, opciono)' })).toHaveLength(0);
    await save();
    const payload = onSave.mock.calls[0][0];
    expect(payload).toMatchObject({ geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null });
    expect(Object.keys(payload.geography)).toEqual(['mode']);
    expect(JSON.stringify(payload)).not.toContain('Privatna');
  });

  it('saving after a private edit confirms the current value without a checkbox', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await openChoice('Privatni detalji zadatka');
    await edit('Tačna adresa (privatno, opciono)', 'Nova privatna adresa 2');
    await save(); expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ exactAddress: 'Nova privatna adresa 2' }));
  });

  it('does not send an incomplete route and explains the missing place', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await chooseMode('Od mesta do mesta'); await save();
    expect(onSave).not.toHaveBeenCalled();
    expect(text()).toContain('Unesi mesto');
    await edit('Odredište — grad ili mesto', 'Beograd');
    await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beograd' } } }));
  });

  it('switching from stationary to area-based does not submit a hidden starting point', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await chooseMode('Na području');
    await edit('Područje rada — grad ili mesto', 'Beograd');
    await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: { mode: 'AREA_BASED', serviceArea: { city: 'Beograd' } } }));
    expect(onSave.mock.calls[0][0].geography).not.toHaveProperty('start');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Početna tačka — grad ili mesto' })).toHaveLength(0);
    expect(tree.root.findByProps({ label: 'Dodaj početnu tačku (opciono)' })).toBeTruthy();
  });

  it('shows an existing area-based starting point and removes it only through its explicit control', async () => {
    const onSave = jest.fn(), base = review();
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, geography: {
      mode: 'AREA_BASED', start: { city: 'Novi Sad', area: 'Liman' }, serviceArea: { city: 'Beograd' },
    } } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Početna tačka — grad ili mesto' }).props.value).toBe('Novi Sad');
    expect(text()).toContain('Liman');
    await openChoice('Početna tačka — dodatni javni opis');
    expect(tree.root.findByProps({ accessibilityLabel: 'Početna tačka — deo grada (opciono)' }).props.value).toBe('Liman');
    await save();
    expect(onSave.mock.calls[0][0].geography).toEqual(loaded.value.geography);
    await act(async () => tree.root.findByProps({ label: 'Ukloni početnu tačku' }).props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Početna tačka — grad ili mesto' })).toHaveLength(0);
    await save();
    expect(onSave.mock.calls[1][0].geography).toEqual({ mode: 'AREA_BASED', serviceArea: { city: 'Beograd' } });
  });

  it('preserves confirmed start-only AREA_BASED topology when reopening and confirming its private point', async () => {
    const onSave = jest.fn(), base = review();
    const geography = { mode: 'AREA_BASED' as const, start: { city: 'Novi Sad', area: 'Liman' } };
    const resolvedLocation = { version: 1 as const, binding: { taskCountryCode: 'RS', geography, exactAddress: base.value.exactAddress },
      points: [{ slot: 'start' as const, latitudeE6: 45251234, longitudeE6: 19831234,
        origin: { kind: 'MANUAL_PIN' as const }, address: 'Privatna početna tačka', accessNotes: 'Zvono 2' }] };
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, geography, resolvedLocation } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findByType('ResolvedPinMap' as never).props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    expect(text()).not.toContain('Prvo unesi državu i javno mesto');
    act(() => { tree.root.findByProps({ label: 'Potvrdi tačku: Polazište' }).props.onPress(); });
    act(() => { saveButton().props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].geography).toEqual(geography);
    expect(onSave.mock.calls[0][0].geography).not.toHaveProperty('serviceArea');
    expect(onSave.mock.calls[0][0].resolvedLocation).toEqual(resolvedLocation);
  });

  it.each(['busy', 'uncertain', 'read-only'] as const)('blocks command submission when %s', async state => {
    const onSave = jest.fn();
    const loaded = review();
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    await act(async () => tree.update(<NeedLocationForm review={{ ...loaded, editable: state !== 'read-only' }} busy={state === 'busy'} uncertain={state === 'uncertain'} onSave={onSave} />));
    // The one green save keeps its words; at work it spins (loading) instead of changing its label.
    const button = tree.root.findByProps({ label: 'Sačuvaj mesto' });
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(sys.color.green);
    expect(button.props.loading).toBe(state === 'busy');
    expect(button.props.disabled).toBe(true);
    await act(async () => button.props.onPress());
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('saveBlockReason (round 6)', () => {
  const live = { busy: false, uncertain: false, editable: true, pendingPoint: false, countryChosen: true, countrySelectable: true };
  it('says a pending point is the reason, and nothing while the save is at work', () => {
    expect(saveBlockReason({ ...live, pendingPoint: true })).toBe('Potvrdi tačku na mapi, pa sačuvaj mesto.');
    expect(saveBlockReason({ ...live, busy: true, pendingPoint: true })).toBeNull();
    expect(saveBlockReason(live)).toBeNull();
  });
  it('speaks without grammatical gender', () => {
    const all = [{ ...live, editable: false }, { ...live, uncertain: true }, { ...live, pendingPoint: true }, { ...live, countryChosen: false },
      { ...live, countrySelectable: false }].map(state => saveBlockReason(state) ?? '').join(' ');
    expect(all).not.toMatch(/sačuvao|\/la\b/);
  });
});

describe('actual native Worker location form', () => {
  it('country change clears coordinates and WAITLIST/COMING countries cannot authorize save', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await openChoice('Država rada');
    expect(tree.root.findByProps({ accessibilityLabel: 'Hrvatska' }).props.disabled).toBe(true);
    await chooseMode('Hrvatska'); await save('Sačuvaj područje rada');
    expect(onSave).not.toHaveBeenCalled();
    await chooseMode('Bosna i Hercegovina');
    await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ operatingCountryCode: 'BA', city: 'Novi Sad', approximatePosition: null }));
  });

  it('save itself confirms the work area and retains coordinates only for the saved city', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ city: 'Novi Sad', approximatePosition: { latitude: 45.26, longitude: 19.83 } }));
  });

  it('clears old approximate coordinates when the worker enters another city', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await edit('Grad ili mesto rada', 'Beograd');
    await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ city: 'Beograd', radiusKm: 25, approximatePosition: null }));
  });

  // Owner's phone, 8 Oct 2026: the same radius stood twice, as a field with "100" and as chips. The distances are the ONE control, so a radius that is not
  // between 1 and 200 can no longer be typed at all; what was saved earlier and is not among them gets a chip of its own.
  it('has no numeric radius field: the distance is chosen from the pills (a radiogroup), so no invalid radius can be entered', async () => {
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={jest.fn()} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Radijus rada u kilometrima' })).toHaveLength(0);
    expect(tree.root.findByProps({ accessibilityRole: 'radiogroup' }).props.accessibilityLabel).toBe('Radijus rada');
    const radios = tree.root.findAllByProps({ accessibilityRole: 'radio' }).map(node => node.props.accessibilityLabel);
    expect(radios).toEqual(['5 km', '10 km', '20 km', '25 km', '50 km', '100 km', '200 km']);
    expect(tree.root.findAllByProps({ accessibilityRole: 'radio' }).filter(node => node.props.accessibilityState.checked).map(node => node.props.accessibilityLabel)).toEqual(['25 km']);
  });

  it.each([
    ['20', [5, 10, 20, 50, 100, 200]], ['30', [5, 10, 20, 30, 50, 100, 200]], ['1', [1, 5, 10, 20, 50, 100, 200]],
    ['200', [5, 10, 20, 50, 100, 200]], ['0', [5, 10, 20, 50, 100, 200]], ['201', [5, 10, 20, 50, 100, 200]], ['abc', [5, 10, 20, 50, 100, 200]],
  ])('the distances for a saved radius of %s are %j (a saved value outside them gets its own chip, a value the server would refuse gets none)', (radius, expected) => {
    expect(radiusChoices(radius)).toEqual(expected);
  });

  // A radius pill prepares the value; only the save sends it.
  it('a radius pill selects the distance without sending and the save confirms it', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    const pill = () => tree.root.findByProps({ accessibilityLabel: '20 km' });
    expect(pill().props.accessibilityRole).toBe('radio'); expect(pill().props.accessibilityState.checked).toBe(false);
    await act(async () => pill().props.onPress());
    expect(pill().props.accessibilityState.checked).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: '25 km' }).props.accessibilityState.checked).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ radiusKm: 20 }));
  });

  it('a busy form keeps its pills still', async () => {
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy uncertain={false} onSave={jest.fn()} />); });
    const pill = tree.root.findByProps({ accessibilityLabel: '50 km' });
    expect(pill.props.accessibilityState).toEqual({ checked: false, disabled: true });
    await act(async () => pill.props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: '25 km' }).props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(pill.props.accessibilityState.checked).toBe(false);
  });
});
