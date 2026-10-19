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
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
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
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));
jest.mock('../../ui/system/ListRow', () => ({ ListRow: 'Button' }));
jest.mock('../nativeCurrentLocation', () => ({ captureCurrentLocation: jest.fn() }));
jest.mock('../../ui/permissions/locationPermission', () => ({ askForLocation: jest.fn().mockResolvedValue('continue') }));

import { NeedLocationForm, saveBlockReason } from '../../ui/location/NeedLocationForm';
import { LocationPointEditor } from '../../ui/location/LocationPointEditor';
import { LocationChoice } from '../../ui/location/LocationControls';
import { locationSlots } from '../../lib/location';
import type { ConfiguredLocationResolution } from '../configuredLocationResolver';
import type { MarketConfig } from '../../contracts/market';
import { captureCurrentLocation, type CurrentLocationResult } from '../nativeCurrentLocation';
import { WorkerLocationForm, radiusChoices } from '../../app/(app)/profil/lokacija';
import { StyleSheet } from 'react-native';
import { brandAction } from '../../ui/system/tokens';

const review = (): NeedLocationReview => ({ accountId: 'account-a', conversationId: 'conversation-a', editable: true,
  confirmed: true, revision: 'revision-a', value: { geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } },
    taskCountryCode: 'RS', exactAddress: 'Privatna ulica 17, stan 2', accessNotes: 'Privatna šifra ulaza 1234' } } as NeedLocationReview);
const location = (): WorkerLocation => ({ accountId: 'account-a', profileId: 'worker-a', revision: 'revision-a',
  operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25, approximatePosition: { latitude: 45.26, longitude: 19.83 } } as WorkerLocation);

let tree: ReactTestRenderer;
const saveButton = (label = 'Sačuvaj mesto') => tree.root.findByProps({ label });
async function openChoice(label: string) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress()); }
async function chooseCountry(label: string) {
  if (!tree.root.findAllByProps({ accessibilityLabel: label }).length) {
    await openChoice('Država rada');
  }
  await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
}
async function edit(label: string, text: string) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(text)); }
async function save(label?: string) { await act(async () => saveButton(label).props.onPress()); }
const text = () => tree.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); });

type FormProps = React.ComponentProps<typeof NeedLocationForm>;
const point = (slot: 'start' | 'end' | 'serviceArea' | `waypoints/${number}` = 'start', latitudeE6 = 45251234) => ({
  slot, latitudeE6, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' as const },
});
const resolvedReview = (base = review()): NeedLocationReview => ({ ...base, value: { ...base.value,
  resolvedLocation: { version: 1, binding: { taskCountryCode: base.value.taskCountryCode!, geography: base.value.geography!, exactAddress: base.value.exactAddress },
    points: locationSlots(base.value.geography!).map(slot => point(slot)) },
} });
const candidate = (label: string, id: string, latitude = 45.25) => ({ label, countryCode: 'RS',
  position: { latitude, longitude: 19.83 }, origin: { kind: 'PROVIDER_CANDIDATE' as const, providerHint: 'fixture', candidateHint: id } });
const proposals = (...candidates: ReturnType<typeof candidate>[]) => ({ status: 'PROPOSALS' as const, candidates, requiresConfirmation: true as const });
const configured = (result: ConfiguredLocationResolution = { status: 'UNAVAILABLE' }) => ({
  search: jest.fn().mockResolvedValue(result), reverse: jest.fn().mockResolvedValue({ status: 'UNAVAILABLE' }), cancel: jest.fn(),
});
const availableCountries = () => ({ countries: mockMarkets as readonly MarketConfig[], loading: false, error: null, refresh: jest.fn() });
let props: FormProps;
async function renderNeed(overrides: Partial<FormProps> = {}) {
  props = { review: review(), busy: false, uncertain: false, onSave: jest.fn(), resolver: configured(), countries: availableCountries(), ...overrides };
  await act(async () => { tree = create(<NeedLocationForm {...props} />); });
}
async function updateNeed(overrides: Partial<FormProps>) {
  props = { ...props, ...overrides }; await act(async () => tree.update(<NeedLocationForm {...props} />));
}
const action = (label: string) => tree.root.findAllByType('Button' as React.ElementType)
  .find(node => (node.props.accessibilityLabel ?? node.props.label) === label)!;
async function press(label: string) { await act(async () => { void action(label).props.onPress(); }); }
const map = () => tree.root.findAllByType('ResolvedPinMap' as React.ElementType)[0];
async function move(latitude = 45.27, longitude = 19.86) {
  if (!map()) await press('Označi na mapi');
  await act(async () => map().props.onChoose({ latitude, longitude }));
}
async function selectSlot(slot: string) {
  const selector = tree.root.findByType(LocationChoice);
  await act(async () => selector.props.onChange(slot));
}

describe('human map confirmation of immutable AI task geography', () => {
  it('shows AI facts read-only and preserves them byte-for-byte when applying a confirmed point', async () => {
    const loaded = review();
    await renderNeed({ review: loaded, reviewOnly: true, onEditInConversation: jest.fn() });
    expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
    expect(text()).toContain('Novi Sad');
    // The private address may seed the owner's map lookup; access notes stay in the read-only disclosure.
    expect(text()).not.toContain(loaded.value.accessNotes!);
    await openChoice('Privatni detalji iz razgovora');
    expect(text()).toContain(loaded.value.exactAddress!); expect(text()).toContain(loaded.value.accessNotes!);
    expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
    expect(saveButton('Primeni potvrđene tačke').props.disabled).toBe(true);
    await move(); await press('Potvrdi tačku: Mesto rada'); await save('Primeni potvrđene tačke');
    const value = (props.onSave as jest.Mock).mock.calls[0][0];
    expect({ ...value, resolvedLocation: null }).toEqual({ ...loaded.value, resolvedLocation: null });
    expect(value.resolvedLocation.binding).toEqual({ taskCountryCode: 'RS', geography: loaded.value.geography, exactAddress: loaded.value.exactAddress });
    expect(value.resolvedLocation.points[0]).toMatchObject({ slot: 'start', latitudeE6: 45270000, longitudeE6: 19860000 });
    expect(JSON.stringify(value.geography)).not.toMatch(/latitude|longitude|Privatna/);
    expect(props.onEditInConversation).not.toHaveBeenCalled();
    await press('Izmeni kroz razgovor'); expect(props.onEditInConversation).toHaveBeenCalledTimes(1);
  });

  it('restores confirmed points without searching, exposes no checkbox, and keeps private inputs absent during correction', async () => {
    await renderNeed({ review: resolvedReview() });
    expect(props.resolver!.search).not.toHaveBeenCalled();
    expect(map().props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    expect(saveButton().props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ accessibilityRole: 'checkbox' })).toHaveLength(0);
    await press('Nije tu');
    expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
    await press('Zatvori'); await save();
    expect(props.onSave).toHaveBeenCalledWith(props.review.value);
  });

  it.each(['confirm', 'discard'] as const)('keeps delayed GPS pending after a same-review rerender until explicit %s', async finish => {
    let resolveGps!: (result: CurrentLocationResult) => void;
    const gps = new Promise<CurrentLocationResult>(resolve => { resolveGps = resolve; });
    jest.mocked(captureCurrentLocation).mockReturnValueOnce(gps);
    const loaded = resolvedReview();
    await renderNeed({ review: loaded });
    await press('Nije tu'); await press('Zatvori'); await press('Ovde gde sam');
    expect(captureCurrentLocation).toHaveBeenCalled();
    await updateNeed({}); // Same account, revision and facts; only the parent's callbacks are refreshed.
    const retainedSave = saveButton().props.onPress;
    await act(async () => { resolveGps({ kind: 'POINT', point: { latitude: 45.29, longitude: 19.87,
      accuracyMeters: 5, capturedAt: '2026-10-19T12:00:00.000Z' } }); });
    expect(map().props.position).toEqual({ latitude: 45.29, longitude: 19.87 });
    expect(saveButton().props.disabled).toBe(true);
    await act(async () => retainedSave()); await save();
    expect(props.onSave).not.toHaveBeenCalled();
    if (finish === 'confirm') await press('Potvrdi tačku: Mesto rada');
    else await press('Odbaci nepotvrđenu tačku');
    expect(saveButton().props.disabled).toBe(false); await save();
    const saved = (props.onSave as jest.Mock).mock.calls[0][0];
    expect(saved.resolvedLocation.points[0]).toMatchObject(finish === 'confirm'
      ? { slot: 'start', latitudeE6: 45290000, longitudeE6: 19870000 } : loaded.value.resolvedLocation!.points[0]);
    expect(saved.resolvedLocation.binding).toEqual(loaded.value.resolvedLocation!.binding);
  });

  it('a city result frames the map but neither proposes a precise pin nor enables saving', async () => {
    const base = review(), resolver = configured(proposals(candidate('Novi Sad', 'city')));
    await renderNeed({ review: { ...base, value: { ...base.value, exactAddress: null, accessNotes: null } }, resolver });
    expect(resolver.search).toHaveBeenCalledWith(expect.objectContaining({ text: 'Novi Sad', countryCode: 'RS' }));
    expect(map().props.position).toBeNull(); expect(map().props.cameraHint).toEqual([{ latitude: 45.25, longitude: 19.83 }]);
    expect(saveButton().props.disabled).toBe(true); await save(); expect(props.onSave).not.toHaveBeenCalled();
    expect(action('Potvrdi tačku: Mesto rada')).toBeUndefined();
  });

  it('ambiguous results require a human choice and explicit confirmation; lookup text never rewrites the AI place', async () => {
    const resolver = configured(proposals(candidate('Prva ulica, Novi Sad', 'first'), candidate('Druga ulica, Novi Sad', 'second', 45.28)));
    await renderNeed({ resolver });
    expect(map().props.position).toBeNull();
    await press('Izaberi predlog: Druga ulica, Novi Sad');
    expect(saveButton().props.disabled).toBe(true); await save(); expect(props.onSave).not.toHaveBeenCalled();
    await press('Potvrdi tačku: Mesto rada'); await save();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: review().value.geography, exactAddress: review().value.exactAddress,
      resolvedLocation: expect.objectContaining({ points: [expect.objectContaining({ latitudeE6: 45280000,
        origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'fixture', candidateHint: 'second' } })] }) }));
  });

  it('allows resolver search as point clarification without introducing a manual address or route editor', async () => {
    await renderNeed();
    await press('Pronađi drugo mesto'); await edit('Mesto rada — pronađi mesto', 'Druga ulica, Novi Sad');
    expect(tree.root.findAllByType('TextInput' as React.ElementType).map(node => node.props.accessibilityLabel))
      .toEqual(['Mesto rada — pronađi mesto']);
    await press('Pronađi na mapi');
    expect(props.resolver!.search).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Druga ulica, Novi Sad' }));
    expect(props.onSave).not.toHaveBeenCalled(); expect(props.review.value).toEqual(review().value);
  });

  it('requires every route point, prevents switching while pending and preserves stop order and descriptions', async () => {
    const base = review(), geography = { mode: 'MULTI_STOP' as const, start: { city: 'Novi Sad' },
      waypoints: [{ city: 'Inđija' }, { city: 'Stara Pazova' }], end: { city: 'Beograd' } };
    await renderNeed({ review: { ...base, value: { ...base.value, geography } } });
    for (const [slot, title] of [['start', 'Polazište'], ['waypoints/0', 'Stanica 1'], ['waypoints/1', 'Stanica 2'], ['end', 'Odredište']]) {
      await selectSlot(slot); await move();
      const original = tree.root.findByType(LocationChoice).props.value;
      await selectSlot(slot === 'end' ? 'start' : 'end');
      expect(tree.root.findByType(LocationChoice).props.value).toBe(original);
      expect(saveButton().props.disabled).toBe(true); await save(); expect(props.onSave).not.toHaveBeenCalled();
      await press(`Potvrdi tačku: ${title}`);
      if (slot !== 'end') { await save(); expect(props.onSave).not.toHaveBeenCalled(); }
    }
    await save();
    const value = (props.onSave as jest.Mock).mock.calls[0][0];
    expect(value.geography).toEqual(geography);
    expect(value.resolvedLocation.points.map((pin: { slot: string }) => pin.slot)).toEqual(['start', 'waypoints/0', 'waypoints/1', 'end']);
    expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
  });

  it('discard restores the latest confirmed point and preserves the other route point without writing', async () => {
    const base = review(), loaded = resolvedReview({ ...base, value: { ...base.value,
      geography: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beograd' } } } });
    await renderNeed({ review: loaded });
    const oldSave = saveButton().props.onPress;
    await act(async () => { map().props.onChoose({ latitude: 45.26, longitude: 19.84 }); oldSave(); });
    expect(props.onSave).not.toHaveBeenCalled(); expect(saveButton().props.disabled).toBe(true);
    await press('Odbaci nepotvrđenu tačku');
    expect(props.onSave).not.toHaveBeenCalled();
    expect(map().props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    await move(45.28, 19.86); await press('Potvrdi tačku: Polazište');
    await move(45.29, 19.87); await press('Odbaci nepotvrđenu tačku');
    expect(map().props.position).toEqual({ latitude: 45.28, longitude: 19.86 });
    await save();
    expect((props.onSave as jest.Mock).mock.calls[0][0].resolvedLocation.points).toEqual([
      expect.objectContaining({ slot: 'start', latitudeE6: 45280000, longitudeE6: 19860000 }), loaded.value.resolvedLocation!.points[1],
    ]);
  });

  it.each(['start', 'serviceArea', 'both'] as const)('retains AREA_BASED %s topology without adding or removing semantic points', async topology => {
    const base = review(), geography = { mode: 'AREA_BASED' as const,
      ...(topology !== 'serviceArea' ? { start: { city: 'Novi Sad', area: 'Liman' } } : {}),
      ...(topology !== 'start' ? { serviceArea: { city: 'Novi Sad', area: 'Petrovaradin' } } : {}),
    };
    const loaded = resolvedReview({ ...base, value: { ...base.value, geography } });
    await renderNeed({ review: loaded }); await save();
    expect(props.onSave).toHaveBeenCalledWith(loaded.value);
    expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
  });

  it.each(['accountId', 'conversationId', 'revision'] as const)('resets local pending points on %s change and rejects callbacks even after A→B→A', async field => {
    const loaded = resolvedReview(); await renderNeed({ review: loaded, onEditInConversation: jest.fn() });
    const staleSave = saveButton().props.onPress, staleEdit = action('Izmeni kroz razgovor').props.onPress;
    const staleConfirm = tree.root.findByType(LocationPointEditor).props.onConfirm;
    await move();
    const staleDiscard = action('Odbaci nepotvrđenu tačku').props.onPress;
    await updateNeed({ review: { ...loaded, [field]: 'incarnation-b' } });
    expect(map().props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    expect(action('Odbaci nepotvrđenu tačku')).toBeUndefined();
    await updateNeed({ review: loaded });
    await act(async () => { staleSave(); staleEdit(); staleConfirm(point('start', 46000000)); staleDiscard(); });
    expect(props.onSave).not.toHaveBeenCalled(); expect(props.onEditInConversation).not.toHaveBeenCalled();
    expect(map().props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    await save(); expect(props.onSave).toHaveBeenCalledWith(loaded.value);
  });

  it('rejects mismatched restored bindings and resets state if the reviewed geography changes', async () => {
    const loaded = resolvedReview(); await renderNeed({ review: loaded });
    const staleSave = saveButton().props.onPress;
    await updateNeed({ review: { ...loaded, value: { ...loaded.value, geography: { mode: 'STATIONARY', start: { city: 'Beograd' } } } } });
    expect(saveButton().props.disabled).toBe(true); expect(text()).toContain('Beograd');
    await act(async () => staleSave()); await save(); expect(props.onSave).not.toHaveBeenCalled();
    expect(map()?.props.position ?? null).toBeNull();
  });

  it.each(['busy', 'uncertain', 'read-only'] as const)('blocks retained and current map/save/edit actions when %s', async state => {
    await renderNeed({ review: resolvedReview(), onEditInConversation: jest.fn() });
    const saveOld = saveButton().props.onPress, editOld = action('Izmeni kroz razgovor').props.onPress;
    const pointOld = tree.root.findByType(LocationPointEditor).props.onConfirm;
    await updateNeed({ review: { ...props.review, editable: state !== 'read-only' }, busy: state === 'busy', uncertain: state === 'uncertain' });
    const button = saveButton();
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(brandAction.backgroundColor);
    expect(button.props.loading).toBe(state === 'busy'); expect(button.props.disabled).toBe(true);
    await act(async () => { saveOld(); editOld(); pointOld(point()); button.props.onPress(); });
    expect(props.onSave).not.toHaveBeenCalled(); expect(props.onEditInConversation).not.toHaveBeenCalled();
  });

  it.each(['missing-geography', 'missing-country', 'invalid-country', 'unsupported-country', 'remote'] as const)(
    '%s has no editable map and sends no invented location', async kind => {
      const base = review();
      const value = kind === 'remote' ? { ...base.value, geography: { mode: 'REMOTE' as const } }
        : kind === 'missing-geography' ? { ...base.value, geography: null }
          : { ...base.value, taskCountryCode: kind === 'missing-country' ? null : kind === 'invalid-country' ? 'rs' : 'ZZ' };
      await renderNeed({ review: { ...base, value }, onEditInConversation: jest.fn() });
      expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(0);
      expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
      expect(props.resolver!.search).not.toHaveBeenCalled();
      if (action('Sačuvaj mesto')) await save();
      expect(props.onSave).not.toHaveBeenCalled();
      if (kind === 'remote') { expect(text()).toContain('nije potrebna potvrda tačke'); expect(text()).not.toContain(base.value.exactAddress!); }
      await press('Izmeni kroz razgovor'); expect(props.onEditInConversation).toHaveBeenCalledTimes(1);
    });

  it.each(['loading', 'error', 'coming'] as const)('fails closed for %s country availability while retaining confirmed points for recovery', async state => {
    const ready = availableCountries(), loaded = resolvedReview(); await renderNeed({ review: loaded });
    const staleSave = saveButton().props.onPress;
    await updateNeed({ countries: { ...ready, loading: state === 'loading', error: state === 'error' ? 'offline' : null,
      countries: state === 'coming' ? ready.countries.map(item => ({ ...item, productStatus: 'COMING' as const })) : ready.countries } });
    expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(0); expect(saveButton().props.disabled).toBe(true);
    await act(async () => staleSave()); await save(); expect(props.onSave).not.toHaveBeenCalled();
    if (state === 'error') { await press('Ponovo proveri dostupnost'); expect(ready.refresh).toHaveBeenCalledTimes(1); }
    await updateNeed({ countries: ready });
    expect(map().props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    await save(); expect(props.onSave).toHaveBeenCalledWith(loaded.value);
  });

  it('keeps the apply action outside scrolling content and search keyboard taps handled', async () => {
    await renderNeed({ review: resolvedReview(), layout: 'screen', reviewOnly: true });
    const scroll = tree.root.findByType('ScrollView' as React.ElementType);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.findAllByProps({ label: 'Primeni potvrđene tačke' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'flow-footer' }).findByProps({ label: 'Primeni potvrđene tačke' })).toBeTruthy();
  });
});

describe('map confirmation block reason', () => {
  const live = { busy: false, uncertain: false, editable: true, pendingPoint: false, countryChosen: true, countrySelectable: true };
  it('explains pending and incomplete points and uses the spinner while busy', () => {
    expect(saveBlockReason({ ...live, pendingPoint: true })).toContain('Potvrdi tačku na mapi');
    expect(saveBlockReason({ ...live, allPointsConfirmed: false })).toContain('sve potrebne tačke');
    expect(saveBlockReason({ ...live, busy: true, pendingPoint: true })).toBeNull(); expect(saveBlockReason(live)).toBeNull();
  });
  it('directs missing semantic facts to the conversation, never to a country or route form', () => {
    expect(saveBlockReason({ ...live, countryChosen: false })).toContain('kroz razgovor');
    expect(saveBlockReason({ ...live, geographyReady: false })).toContain('kroz razgovor');
    expect(saveBlockReason({ ...live, countrySelectable: false })).toContain('nije dostupna');
  });
});
describe('actual native Worker location form', () => {
  it('country change clears coordinates and WAITLIST/COMING countries cannot authorize save', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await openChoice('Država rada');
    expect(tree.root.findByProps({ accessibilityLabel: 'Hrvatska' }).props.disabled).toBe(true);
    await chooseCountry('Hrvatska'); await save('Sačuvaj područje rada');
    expect(onSave).not.toHaveBeenCalled();
    await chooseCountry('Bosna i Hercegovina');
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
