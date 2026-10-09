import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LocationPointEditor } from '../../ui/location/LocationPointEditor';
import { createConfiguredLocationResolver, type ConfiguredLocationResolution } from '../configuredLocationResolver';
import AiLocationGallery from '../../app/dizajn-ai-mesto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PermissionsAndroid, Platform } from 'react-native';
import { answeringHost } from '../../ui/permissions/testing/answeringHost';

let mockFocused = true;
let mockGalleryPackage = 'rs.uskoci.dev', mockGalleryParams: { scene?: unknown } = {};
const mockGalleryRouter = { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockGalleryPackage } }; } }));
jest.mock('expo-router', () => ({ get router() { return mockGalleryRouter; }, useLocalSearchParams: () => mockGalleryParams,
  useFocusEffect: (effect: () => unknown) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../ui/aiFirst/AiConversationShell', () => ({ AiConversationShell: (props: { status: unknown }) =>
  require('react').createElement('AiShell', props, props.status) }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationField: 'LocationField', LocationDetails: 'LocationDetails' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PinMap' }));
jest.mock('../../ui/system/ListRow', () => ({ ListRow: 'Button' }));
jest.mock('../nativeCurrentLocation', () => ({ captureCurrentLocation: jest.fn() }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'View') return 'View';
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

type Props = React.ComponentProps<typeof LocationPointEditor>;
let tree: ReactTestRenderer;
let props: Props;
const candidate = { label: 'Synthetic private candidate', countryCode: 'RS', position: { latitude: 44.123456, longitude: 20.654321 },
  origin: { kind: 'PROVIDER_CANDIDATE' as const, providerHint: 'approved-provider', candidateHint: 'candidate-1' } };
const proposals: ConfiguredLocationResolution = { status: 'PROPOSALS', candidates: [candidate], requiresConfirmation: true };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const configured = (result: ConfiguredLocationResolution = proposals) => ({ search: jest.fn().mockResolvedValue(result), reverse: jest.fn().mockResolvedValue(result), cancel: jest.fn() });
const buttons = () => tree.root.findAllByType('Button' as React.ElementType);
// A proposal shows the address and is named by what the tap does: find actions by their spoken name.
const named = (node: { props: { [key: string]: unknown } }) => String(node.props.accessibilityLabel ?? node.props.label);
const button = (label: string) => buttons().find(node => named(node) === label)!;
const field = (suffix: string) => tree.root.findAllByType('LocationField' as React.ElementType).find(node => node.props.label.endsWith(suffix))!;
const map = () => tree.root.findByType('PinMap' as React.ElementType);
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = async (label: string) => { await act(async () => { void button(label).props.onPress(); }); };
const change = async (suffix: string, value: string) => { await act(async () => field(suffix).props.onChangeText(value)); };
async function render(overrides: Partial<Props> = {}) {
  props = { slot: 'start', title: 'Početak', countryCode: 'RS', scopeKey: 'account-incarnation-A/start/1', disabled: false,
    onInvalidate: jest.fn(), onConfirm: jest.fn(), ...overrides };
  await act(async () => { tree = create(<LocationPointEditor {...props} />); });
}
async function update(overrides: Partial<Props> = {}) {
  props = { ...props, ...overrides }; await act(async () => tree.update(<LocationPointEditor {...props} />));
}
beforeEach(() => { mockFocused = true; mockGalleryPackage = 'rs.uskoci.dev'; mockGalleryParams = {}; jest.clearAllMocks(); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each(['pronađi mesto', 'privatna adresa (opciono)', 'privatne napomene za pristup (opciono)'])(
  'keeps the last native text event in a burst for %s without admitting a stale confirmation', async suffix => {
    await render({ resolver: configured(), initialQuery: 'Place' }); await press('Pronađi na mapi');
    await press(`Izaberi predlog: ${candidate.label}`);
    const confirm = button('Potvrdi tačku: Početak').props.onPress;
    const edit = field(suffix).props.onChangeText;
    await act(async () => { edit('Trg'); edit('Trg republike'); edit('Trg republike, Beograd'); confirm(); });
    expect(field(suffix).props.value).toBe('Trg republike, Beograd');
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(map().props.position).toEqual(suffix === 'pronađi mesto' ? null : candidate.position);
  });

it.each(['blur', 'disabled', 'selection', 'search', 'confirmation'] as const)(
  'does not revive a retained text callback after %s', async boundary => {
    await render({ resolver: configured(), initialQuery: 'Place' }); await press('Pronađi na mapi');
    const edit = field('pronađi mesto').props.onChangeText;
    if (boundary === 'blur') { mockFocused = false; await update(); mockFocused = true; await update(); }
    else if (boundary === 'disabled') { await update({ disabled: true }); await update({ disabled: false }); }
    else if (boundary === 'search') await press('Pronađi na mapi');
    else { await press(`Izaberi predlog: ${candidate.label}`); if (boundary === 'confirmation') await press('Potvrdi tačku: Početak'); }
    const value = field('pronađi mesto').props.value, position = map().props.position;
    await act(async () => edit('A retired native event'));
    expect(field('pronađi mesto').props.value).toBe(value); expect(map().props.position).toEqual(position);
  });

it('retires text events synchronously when a reply lease is acquired then cancelled before commit', async () => {
  const onPromptReady = jest.fn();
  await render({ resolver: configured({ status: 'UNAVAILABLE' }), initialQuery: 'Place', presentation: 'conversation', autoLocate: true, onPromptReady });
  await press('Pronađi drugo mesto');
  const edit = field('pronađi mesto').props.onChangeText;
  const prompt = onPromptReady.mock.calls.at(-1)?.[0]; expect(prompt).toBeTruthy();
  await act(async () => { const lease = prompt.acquire(); expect(lease).toBeTruthy(); lease.cancel(); edit('Stale lease edit'); });
  expect(field('pronađi mesto').props.value).toBe('Place');
  await change('pronađi mesto', 'New edit'); expect(field('pronađi mesto').props.value).toBe('New edit');
});

it('prefills a visible query without automatic lookup and honestly shows unavailable activation', async () => {
  await render({ initialQuery: 'Novi Sad' });
  expect(field('pronađi mesto').props.value).toBe('Novi Sad');
  expect(text()).not.toContain('Pretraga mesta još nije aktivirana');expect(props.onInvalidate).not.toHaveBeenCalled();
  await press('Pronađi na mapi');
  expect(text()).toContain('Pretraga mesta još nije aktivirana');expect(map().props.position).toBeNull();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('uses the real configured adapter and emits a provider pin only on explicit confirmation, without autofilling address', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, redirected: false, json: async () => ({ candidates: [{
    label: candidate.label, countryCode: 'RS', position: candidate.position, providerHint: candidate.origin.providerHint, candidateId: candidate.origin.candidateHint,
  }] }) });
  const resolver = createConfiguredLocationResolver({ endpoint: 'https://approved.test.invalid/search', providerHint: 'approved-provider' }, fetcher);
  await render({ resolver });
  await change('privatna adresa (opciono)', 'Manually typed private address');
  await change('pronađi mesto', 'Explicitly submitted place');expect(fetcher).not.toHaveBeenCalled();
  await press('Pronađi na mapi');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ countryCode: 'RS', text: 'Explicitly submitted place' });
  expect(map().props.position).toBeNull();expect(props.onConfirm).not.toHaveBeenCalled();
  await press(`Izaberi predlog: ${candidate.label}`);
  expect(map().props.position).toEqual(candidate.position);
  expect(field('privatna adresa (opciono)').props.value).toBe('Manually typed private address');
  expect(props.onConfirm).not.toHaveBeenCalled();expect(text()).toContain('Izmena tačke još nije potvrđena');
  const confirm = button('Potvrdi tačku: Početak').props.onPress;
  await act(async () => { confirm(); confirm(); });
  expect(props.onConfirm).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 44123456, longitudeE6: 20654321,
    origin: candidate.origin, address: 'Manually typed private address' });
});

it.each(['UNAVAILABLE', 'PROVIDER_ACTIVATION_BLOCKED', 'INVALID_QUERY', 'RATE_LIMITED'] as const)('shows the %s state without inventing a candidate', async status => {
  await render({ resolver: configured({ status }), initialQuery: 'Place' });await press('Pronađi na mapi');
  expect(text()).toContain(status === 'UNAVAILABLE' ? 'Predlozi trenutno nisu dostupni' : status === 'INVALID_QUERY'
    ? 'Unesi mesto i proveri izabranu državu' : status === 'RATE_LIMITED' ? 'Previše pretraga za kratko vreme' : 'Pretraga mesta još nije aktivirana');
  expect(map().props.position).toBeNull();expect(button('Potvrdi tačku: Početak').props.disabled).toBe(true);
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('allows explicit retry after an error and shows a truthful empty result', async () => {
  const resolver = configured({ status: 'UNAVAILABLE' });
  resolver.search.mockResolvedValueOnce({ status: 'UNAVAILABLE' }).mockResolvedValueOnce({ status: 'PROPOSALS', candidates: [], requiresConfirmation: true });
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  expect(resolver.search).toHaveBeenCalledTimes(1);await press('Pokušaj ponovo');
  expect(resolver.search).toHaveBeenCalledTimes(2);expect(text()).toContain('Nema predloga za uneti tekst');
  expect(map().props.position).toBeNull();
});

it('shows loading and ignores a late result after explicit cancellation even if the injected resolver ignores cancel', async () => {
  const result = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValue(result.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  expect(text()).toContain('Tražimo predloge');expect(button('Tražimo mesto…').props.disabled).toBe(true);
  await press('Otkaži pretragu');
  await act(async () => result.resolve(proposals));
  expect(buttons().some(node => named(node).startsWith('Izaberi predlog'))).toBe(false);expect(map().props.position).toBeNull();
});

it('text edits retire the selected candidate and reject its retained confirmation callback', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  await press(`Izaberi predlog: ${candidate.label}`);const oldConfirm = button('Potvrdi tačku: Početak').props.onPress;
  await change('pronađi mesto', 'Different place');
  await act(async () => oldConfirm());expect(props.onConfirm).not.toHaveBeenCalled();expect(map().props.position).toBeNull();
});

it('editing private text retires lookup and stale confirmation but retains the explicitly selected pin', async () => {
  const pending = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValueOnce(pending.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  await change('privatna adresa (opciono)', 'Another private address');await act(async () => pending.resolve(proposals));
  expect(buttons().some(node => named(node).startsWith('Izaberi predlog'))).toBe(false);
  await press('Pronađi na mapi');await press(`Izaberi predlog: ${candidate.label}`);
  const oldConfirm = button('Potvrdi tačku: Početak').props.onPress;
  await change('privatne napomene za pristup (opciono)', 'Private note');
  expect(map().props.position).toEqual(candidate.position);
  await act(async () => oldConfirm()); expect(props.onConfirm).not.toHaveBeenCalled();
  await press('Potvrdi tačku: Početak');
  expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ origin: candidate.origin,
    latitudeE6: 44123456, longitudeE6: 20654321, address: 'Another private address', accessNotes: 'Private note' }));
});

it('shows existing private details and replaces the address with the candidate only on explicit action', async () => {
  await render({ resolver: configured(), initialQuery: 'Place', point: { slot: 'start', latitudeE6: 45000000,
    longitudeE6: 19000000, origin: { kind: 'MANUAL_PIN' }, address: 'Old address', accessNotes: 'Bell 2' } });
  await press('Pronađi na mapi'); await press(`Izaberi predlog: ${candidate.label}`);
  expect(tree.root.findByType('LocationDetails' as React.ElementType).props.summary).toBe('Old address · Bell 2');
  expect(field('privatna adresa (opciono)').props.value).toBe('Old address');
  const useAddress = button('Koristi predlog kao privatnu adresu').props.onPress;
  await act(async () => useAddress());
  expect(field('privatna adresa (opciono)').props.value).toBe(candidate.label);
  expect(map().props.position).toEqual(candidate.position); expect(props.onConfirm).not.toHaveBeenCalled();
  await change('privatna adresa (opciono)', 'Corrected address');
  await act(async () => useAddress());
  expect(field('privatna adresa (opciono)').props.value).toBe('Corrected address');
  await press('Potvrdi tačku: Početak');
  expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: 'Corrected address', accessNotes: 'Bell 2' }));
});

it('a map move changes the proposed origin to MANUAL_PIN and keeps private fields explicitly entered by the user', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');await press(`Izaberi predlog: ${candidate.label}`);
  await act(async () => map().props.onChoose({ latitude: 45.123456, longitude: 19.654321 }));
  await change('privatne napomene za pristup (opciono)', 'Manual access note');
  await press('Potvrdi tačku: Početak');
  expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45123456, longitudeE6: 19654321,
    origin: { kind: 'MANUAL_PIN' }, accessNotes: 'Manual access note' });
});

it('rejects a retained candidate click after cancellation without restoring its position', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  const retained = button(`Izaberi predlog: ${candidate.label}`).props.onPress;await press('Otkaži pretragu');
  await act(async () => retained());expect(map().props.position).toBeNull();expect(props.onConfirm).not.toHaveBeenCalled();
});

it('A-B-A account/point scopes cannot revive old candidates or selected-pin confirmation', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  const retainedCandidate = button(`Izaberi predlog: ${candidate.label}`).props.onPress;
  await press(`Izaberi predlog: ${candidate.label}`);const retainedConfirm = button('Potvrdi tačku: Početak').props.onPress;
  await update({ scopeKey: 'account-B/end/1', slot: 'end' });await update({ scopeKey: 'account-incarnation-A/start/1', slot: 'start' });
  await act(async () => { retainedCandidate(); retainedConfirm(); });
  expect(map().props.position).toBeNull();expect(props.onConfirm).not.toHaveBeenCalled();
});

it('country changes discard a pending result from the old country', async () => {
  const result = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValue(result.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');await update({ countryCode: 'BA' });
  await act(async () => result.resolve(proposals));
  expect(buttons().some(node => named(node).startsWith('Izaberi predlog'))).toBe(false);expect(map().props.position).toBeNull();
});

it('blur/refocus clears candidates and prevents retained clicks and confirmation', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  const retained = button(`Izaberi predlog: ${candidate.label}`).props.onPress;
  await press(`Izaberi predlog: ${candidate.label}`);const oldConfirm = button('Potvrdi tačku: Početak').props.onPress;
  mockFocused = false;await update();expect(map().props.disabled).toBe(true);
  mockFocused = true;await update();
  await act(async () => { retained(); oldConfirm(); });
  // Blur no longer throws the seed away with the candidates: an empty field left the point ask
  // unusable for the rest of the session. The retained handlers are still dead, which is the point.
  expect(map().props.position).toBeNull();expect(field('pronađi mesto').props.value).toBe('Place');expect(props.onConfirm).not.toHaveBeenCalled();
});

it('a temporary disabled state invalidates an in-flight lookup before the editor is enabled again', async () => {
  const result = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValue(result.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  await update({ disabled: true });await update({ disabled: false });await act(async () => result.resolve(proposals));
  expect(buttons().some(node => named(node).startsWith('Izaberi predlog'))).toBe(false);expect(map().props.position).toBeNull();
});


it('looks up an address only on request, then preserves the manual pin until explicit confirmation', async () => {
  const resolver=configured();await render({resolver});const manual={latitude:45.255,longitude:19.845};
  await act(async()=>map().props.onChoose(manual));expect(resolver.reverse).not.toHaveBeenCalled();
  await press('Pronađi adresu za ovaj pin');expect(resolver.reverse).toHaveBeenCalledWith({position:manual,countryCode:'RS',scopeKey:props.scopeKey});
  expect(map().props.position).toEqual(manual);expect(field('privatna adresa (opciono)').props.value).toBe('');
  await press('Koristi privatnu adresu: '+candidate.label);expect(field('privatna adresa (opciono)').props.value).toBe(candidate.label);
  expect(map().props.position).toEqual(manual);expect(props.onConfirm).not.toHaveBeenCalled();
  await press('Potvrdi tačku: Početak');expect(props.onConfirm).toHaveBeenCalledWith({slot:'start',latitudeE6:45255000,longitudeE6:19845000,origin:{kind:'MANUAL_PIN'},address:candidate.label});
});

it('reverse outage and a late result cannot remove or replace a newer manual pin',async()=>{
  const pending=deferred<ConfiguredLocationResolution>();const resolver=configured();resolver.reverse.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({status:'UNAVAILABLE'});
  await render({resolver});await act(async()=>map().props.onChoose({latitude:45,longitude:19}));await press('Pronađi adresu za ovaj pin');
  const newer={latitude:45.1,longitude:19.1};await act(async()=>map().props.onChoose(newer));await act(async()=>pending.resolve(proposals));
  expect(map().props.position).toEqual(newer);expect(button('Koristi privatnu adresu: '+candidate.label)).toBeUndefined();
  await press('Pronađi adresu za ovaj pin');expect(map().props.position).toEqual(newer);expect(button('Potvrdi tačku: Početak').props.disabled).toBe(false);
});

it('cancelling reverse lookup preserves an explicitly confirmed provider pin and rejects late proposals', async () => {
  const pending = deferred<ConfiguredLocationResolution>(), resolver = configured(); resolver.reverse.mockReturnValue(pending.promise);
  await render({ resolver, initialQuery: 'Place' }); await press('Pronađi na mapi'); await press(`Izaberi predlog: ${candidate.label}`);
  await press('Potvrdi tačku: Početak'); expect(props.onConfirm).toHaveBeenCalledTimes(1);
  const invalidations = (props.onInvalidate as jest.Mock).mock.calls.length;
  await press('Pronađi adresu za ovaj pin'); await press('Otkaži pretragu'); await act(async () => pending.resolve(proposals));
  expect(map().props.position).toEqual(candidate.position); expect(props.onInvalidate).toHaveBeenCalledTimes(invalidations);
  expect(button('Koristi privatnu adresu: '+candidate.label)).toBeUndefined();
  expect(props.onConfirm).toHaveBeenCalledTimes(1);
});

describe('autoLocate', () => {
  it('looks up the seeded query once, without being pressed', async () => {
    const resolver = configured();
    await render({ resolver: resolver as never, autoLocate: true, initialQuery: 'Lenke Dunđerski 11, Novi Sad' });
    expect(resolver.search).toHaveBeenCalledTimes(1);
    expect(resolver.search.mock.calls[0][0]).toMatchObject({ text: 'Lenke Dunđerski 11, Novi Sad', countryCode: 'RS' });
  });

  it('does not look anything up when it is not asked to', async () => {
    const resolver = configured();
    await render({ resolver: resolver as never, initialQuery: 'Lenke Dunđerski 11, Novi Sad' });
    expect(resolver.search).not.toHaveBeenCalled();
  });

  it('never moves a point the person already confirmed', async () => {
    const resolver = configured();
    await render({ resolver: resolver as never, autoLocate: true, initialQuery: 'Novi Sad',
      point: { slot: 'start', latitudeE6: 45_255_000, longitudeE6: 19_845_000, origin: { kind: 'MANUAL_PIN' } } });
    expect(resolver.search).not.toHaveBeenCalled();
  });

  it('does not look up an empty seed', async () => {
    const resolver = configured();
    await render({ resolver: resolver as never, autoLocate: true, initialQuery: '   ' });
    expect(resolver.search).not.toHaveBeenCalled();
  });
});

describe('compact conversation proposal', () => {
  it('omits only exact visible parent summaries, preserving a standalone role and a different source description', async () => {
    const resolver = configured({ status: 'UNAVAILABLE' });
    await render({ resolver, presentation: 'conversation', initialQuery: 'Place',
      conversationSummary: { title: 'Početak', description: 'Place' } });
    const headings = () => tree.root.findAllByType('T' as React.ElementType).filter(node => node.children.join('') === 'Početak');
    expect(headings()).toHaveLength(0); expect(text()).not.toContain('Opis iz razgovora:');
    expect(text()).toContain('Dopuni opis mesta ili ga označi na mapi.');
    await press('Označi na mapi');
    expect(map().props.position).toBeNull(); expect(text()).not.toContain('Svi vide približno područje.');
    await update({ conversationSummary: { title: 'Početak', description: 'Place ' } });
    expect(text()).toContain('Opis iz razgovora:'); expect(text()).toContain('Place');
    await update({ conversationSummary: undefined });
    expect(headings()).toHaveLength(1); expect(text()).toContain('Opis iz razgovora:');
    expect(text()).toContain('Dopuni opis mesta ili ga označi na mapi.');
    expect(map().props.position).toBeNull(); expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onInvalidate).not.toHaveBeenCalled(); expect(resolver.search).not.toHaveBeenCalled();
  });

  it('places a single specific proposal, uses a compact map, and confirms only on the explicit action', async () => {
    const resolver = configured();
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: candidate.label,
      conversationSummary: { title: 'Početak', description: candidate.label } });
    expect(resolver.search).toHaveBeenCalledTimes(1);
    expect(props.onInvalidate).not.toHaveBeenCalled();
    expect(map().props).toMatchObject({ position: candidate.position, height: 156, compact: true });
    expect(text()).toContain('Da li je ovo početak?');
    expect(text()).toContain(candidate.label);
    expect(text()).not.toContain('Svi vide približno područje.');
    expect(button('Potvrdi tačku: Početak').props.label).toBe('Da, ovo je početak');
    expect(tree.root.findAllByType('LocationField' as React.ElementType)).toHaveLength(0);
    expect(button('Pronađi na mapi')).toBeUndefined(); expect(button('Koristi moju lokaciju')).toBeUndefined();
    expect(button('Pronađi adresu za ovaj pin')).toBeUndefined(); expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 44123456, longitudeE6: 20654321, origin: candidate.origin, address: candidate.label });
    expect(resolver.search).toHaveBeenCalledTimes(1); expect(resolver.reverse).not.toHaveBeenCalled();
  });

  it('expands the same chat pin full-screen, reverse-geocodes a moved point and returns without losing it', async () => {
    const resolver = configured();
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: candidate.label,
      conversationSummary: { title: 'Početak', description: candidate.label } });
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1);
    // Owner, 2026-10-07: the expand control sits in the small map's own top-right corner, not as a button under it.
    expect(button('Uvećaj mapu za: Početak')).toBeUndefined();
    expect(map().props.expand).toMatchObject({ label: 'Uvećaj mapu za: Početak', disabled: false });
    await act(async () => map().props.expand.onPress());
    let maps = tree.root.findAllByType('PinMap' as React.ElementType);
    expect(maps).toHaveLength(2);
    const expanded = maps.find(node => node.props.fill === true)!;
    expect(expanded.props).toMatchObject({ position: candidate.position, compact: true, fill: true });
    expect(expanded.props.expand).toBeUndefined();
    const moved = { latitude: 45.251234, longitude: 19.831234 };
    await act(async () => { expanded.props.onChoose(moved); });
    expect(resolver.reverse).toHaveBeenCalledWith({ position: moved, countryCode: 'RS', scopeKey: props.scopeKey });
    maps = tree.root.findAllByType('PinMap' as React.ElementType);
    expect(maps.every(node => node.props.position.latitude === moved.latitude && node.props.position.longitude === moved.longitude)).toBe(true);
    expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Zatvori');
    maps = tree.root.findAllByType('PinMap' as React.ElementType);
    expect(maps).toHaveLength(1); expect(maps[0].props.position).toEqual(moved);
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234,
      origin: { kind: 'MANUAL_PIN' }, address: candidate.label });
  });

  // Owner, 2026-10-07: a pin the person moves (on the small or the expanded map) becomes the task's place. Its address
  // comes from the existing reverse lookup of that exact pin; an answer for an earlier pin never replaces it.
  it('makes the pin the person moved the new place, ahead of any late answer for an earlier pin', async () => {
    const resolver = configured();
    const first = deferred<ConfiguredLocationResolution>(), second = deferred<ConfiguredLocationResolution>();
    resolver.reverse.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: candidate.label,
      conversationSummary: { title: 'Početak', description: candidate.label } });
    await act(async () => map().props.expand.onPress());
    const expanded = () => tree.root.findAllByType('PinMap' as React.ElementType).find(node => node.props.fill === true)!;
    await act(async () => { expanded().props.onChoose({ latitude: 45.25, longitude: 19.83 }); });
    await act(async () => { expanded().props.onChoose({ latitude: 45.26, longitude: 19.84 }); });
    await act(async () => first.resolve({ status: 'PROPOSALS', requiresConfirmation: true,
      candidates: [{ ...candidate, label: 'Stara adresa 1, Novi Sad', position: { latitude: 45.25, longitude: 19.83 } }] }));
    expect(button('Potvrdi tačku: Početak').props.disabled).toBe(true); // Still reading the address of the pin that counts.
    await act(async () => second.resolve({ status: 'PROPOSALS', requiresConfirmation: true,
      candidates: [{ ...candidate, label: '67, Булевар ослобођења, Нови Сад', position: { latitude: 45.2601, longitude: 19.8402 } }] }));
    expect(tree.root.findAllByType('PinMap' as React.ElementType).every(node =>
      node.props.position.latitude === 45.26 && node.props.position.longitude === 19.84)).toBe(true);
    expect(text()).toContain('67, Bulevar oslobođenja, Novi Sad'); expect(text()).not.toContain('Stara adresa');
    // Confirmed in the large map itself.
    const inLarge = tree.root.findByType('Modal' as React.ElementType).findAllByType('Button' as React.ElementType)
      .find(node => named(node) === 'Potvrdi tačku: Početak')!;
    await act(async () => { inLarge.props.onPress(); });
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45260000, longitudeE6: 19840000,
      origin: { kind: 'MANUAL_PIN' }, address: '67, Bulevar oslobođenja, Novi Sad' });
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1); // The large map closes on confirmation.
  });

  it('turns the small map’s expand control off with the rest of the editor and rejects a retained press', async () => {
    const saved = { slot: 'start' as const, latitudeE6: 45200000, longitudeE6: 19800000, origin: { kind: 'MANUAL_PIN' as const } };
    await render({ resolver: configured(), point: saved, presentation: 'conversation', autoLocate: true, initialQuery: 'Place' });
    expect(map().props.expand.disabled).toBe(false);
    const retained = map().props.expand.onPress;
    mockFocused = false; await update();
    expect(map().props.expand.disabled).toBe(true);
    await act(async () => retained());
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1);
  });

  it('opens the large map from Nije tu instead of forcing precise correction inside 156 px', async () => {
    await render({ resolver: configured(), presentation: 'conversation', autoLocate: true, initialQuery: candidate.label });
    await press('Nije tu');
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(2);
    expect(tree.root.findAllByType('PinMap' as React.ElementType).some(node => node.props.fill === true)).toBe(true);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('places a movable proposal pin for a short street plus locality seed while keeping bare city unresolved', async () => {
    const street = { ...candidate, label: 'Synthetic Street, Synthetic Locality, Serbia',
      position: { latitude: 45.2524, longitude: 19.8621 } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [street], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true,
      initialQuery: 'Synthetic Street, Synthetic Locality',
      conversationSummary: { title: 'Polazište', description: 'Synthetic Street, Synthetic Locality' } });
    expect(map().props).toMatchObject({ position: street.position, height: 156, compact: true });
    expect(text()).toContain('Da li je ovo početak?');
    expect(button('Potvrdi tačku: Početak')).toBeDefined();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('keeps a city-only result as camera context instead of inventing an exact point', async () => {
    const city = { ...candidate, label: 'Novi Sad, South Backa, Serbia',
      position: { latitude: 45.2671, longitude: 19.8335 } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [city], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true,
      initialQuery: 'Novi Sad',
      conversationSummary: { title: 'Početak', description: 'Novi Sad' } });
    expect(map().props).toMatchObject({ position: null, cameraHint: [city.position], height: 156, compact: true });
    expect(map().props.cameraHintZoom).toBeUndefined();
    expect(map().props.cameraHintZoom).toBeUndefined();
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
    expect(props.onInvalidate).not.toHaveBeenCalled();
  });

  it('zooms a street-only fallback close enough to read the street without inventing the house pin', async () => {
    const street = { ...candidate, label: 'Lenke Dunđerski, Novi Sad',
      position: { latitude: 45.2512, longitude: 19.8244 } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [street], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true,
      initialQuery: 'Lenke Dunđerski 10, Novi Sad',
      conversationSummary: { title: 'Početak', description: 'Lenke Dunđerski 10, Novi Sad' } });
    expect(map().props).toMatchObject({ position: null, cameraHint: [street.position], cameraHintZoom: 16.5, height: 156, compact: true });
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('does not turn a city fallback into a street-address pin', async () => {
    const city = { ...candidate, label: 'Novi Sad, South Backa, Serbia',
      position: { latitude: 45.2671, longitude: 19.8335 } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [city], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true,
      initialQuery: 'Lenke Dunđerski 10, Novi Sad',
      conversationSummary: { title: 'Početak', description: 'Lenke Dunđerski 10, Novi Sad' } });
    expect(resolver.search).toHaveBeenCalledTimes(1);
    expect(map().props).toMatchObject({ position: null, cameraHint: [city.position], height: 156, compact: true });
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
    expect(text()).toContain('Tačna tačka nije pronađena. Dodirni pravo mesto na mapi ili ispravi opis.');
    expect(text()).not.toContain('Mapa je samo orijentir');
    expect(props.onInvalidate).not.toHaveBeenCalled();
    await act(async () => map().props.onChoose({ latitude: 45.2512, longitude: 19.8244 }));
    expect(map().props.position).toEqual({ latitude: 45.2512, longitude: 19.8244 });
    expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      slot: 'start', latitudeE6: 45251200, longitudeE6: 19824400, origin: { kind: 'MANUAL_PIN' },
    }));
  });

  it('shows a weak orientation result and lets the person correct the search without another AI turn', async () => {
    const city = { ...candidate, label: 'Београд, Србија' };
    const exact = { ...candidate, label: '10, Kneza Mihaila, Stari grad, Beograd, Srbija' };
    const resolver = configured({ status: 'PROPOSALS', candidates: [city], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Knez Mihailova 10, Beograd' });
    expect(text()).toContain('Mapa kao orijentir:  Beograd, Srbija');
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
    await press('Pronađi drugo mesto');
    expect(field('pronađi mesto').props.value).toBe('Knez Mihailova 10, Beograd');
    await change('pronađi mesto', 'Kneza Mihaila 10, Stari grad, Beograd');
    expect(resolver.search).toHaveBeenCalledTimes(1);
    resolver.search.mockResolvedValue({ status: 'PROPOSALS', candidates: [exact], requiresConfirmation: true });
    await press('Pronađi na mapi');
    expect(resolver.search).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Kneza Mihaila 10, Stari grad, Beograd' }));
    expect(map().props.position).toEqual(exact.position);
    expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: exact.label, origin: exact.origin }));
  });

  it('ignores a corrected-search result after the location editor loses focus', async () => {
    const resolver = configured({ status: 'PROPOSALS', candidates: [], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Unknown street' });
    await press('Pronađi drugo mesto'); await change('pronađi mesto', candidate.label);
    const pending = deferred<ConfiguredLocationResolution>(); resolver.search.mockReturnValue(pending.promise);
    await press('Pronađi na mapi');
    mockFocused = false; await update();
    await act(async () => pending.resolve(proposals));
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  // OSM / LocationIQ return Serbian labels in Cyrillic (seen 2026-10-07 for a Novi Sad street address); the person speaks Latin.
  it('places the pin for a Cyrillic provider label of the spoken Latin address and shows the address in Latin', async () => {
    const house = { ...candidate, label: '10, Булевар ослобођења, Роткварија, Нови Сад, Србија',
      position: { latitude: 45.2589, longitude: 19.8327 } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [house], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Bulevar oslobođenja 10, Novi Sad',
      conversationSummary: { title: 'Početak', description: 'Bulevar oslobođenja 10, Novi Sad' } });
    expect(map().props).toMatchObject({ position: house.position, height: 156, compact: true });
    expect(text()).toContain('Da li je ovo početak?');
    expect(text()).not.toContain('Tačna tačka nije pronađena');
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ latitudeE6: 45258900, longitudeE6: 19832700,
      address: '10, Bulevar oslobođenja, Rotkvarija, Novi Sad, Srbija' }));
  });

  it('treats several results for the same house a few metres apart as one place', async () => {
    const house = { ...candidate, label: '10, Булевар ослобођења, Нови Сад, Србија', position: { latitude: 45.258900, longitude: 19.832700 } };
    const shop = { ...candidate, label: 'Lokal, 10, Булевар ослобођења, Нови Сад, Србија', position: { latitude: 45.258930, longitude: 19.832760 },
      origin: { ...candidate.origin, candidateHint: 'candidate-2' } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [shop, house], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Bulevar oslobođenja 10, Novi Sad',
      conversationSummary: { title: 'Početak', description: 'Bulevar oslobođenja 10, Novi Sad' } });
    expect(map().props.position).toEqual(shop.position);
    expect(text()).toContain('Da li je ovo početak?');
    expect(button('Potvrdi tačku: Početak')).toBeDefined();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('zooms to a Cyrillic street-only fallback without inventing the house pin', async () => {
    const street = { ...candidate, label: 'Булевар ослобођења, Нови Сад, Србија', position: { latitude: 45.2550, longitude: 19.8400 } };
    const resolver = configured({ status: 'PROPOSALS', candidates: [street], requiresConfirmation: true });
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Bulevar oslobođenja 10, Novi Sad',
      conversationSummary: { title: 'Početak', description: 'Bulevar oslobođenja 10, Novi Sad' } });
    expect(map().props).toMatchObject({ position: null, cameraHint: [street.position], cameraHintZoom: 16.5 });
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
  });

  it('keeps ambiguous results unresolved but immediately frames their region, then confirms only an explicitly placed pin', async () => {
    const other = { ...candidate, label: 'Another actual result', position: { latitude: 45, longitude: 19 },
      origin: { ...candidate.origin, candidateHint: 'candidate-2' } };
    const resolver = configured({ ...proposals, candidates: [candidate, other] } as ConfiguredLocationResolution);
    const correct = jest.fn();
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Place', onCorrectInConversation: correct });
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1);
    expect(map().props.position).toBeNull();
    expect(map().props.cameraHint).toEqual([candidate.position, other.position]);
    expect(button('Potvrdi tačku: Početak')).toBeUndefined();
    expect(button('Izaberi predlog: ' + other.label)).toBeDefined();
    expect(button('Izaberi predlog: ' + candidate.label)).toBeDefined();
    expect(button('Označi na mapi')).toBeUndefined();
    expect(text()).toContain('Pronađeno je više mesta. Izaberi ono koje tražiš, pa proveri tačku.');
    expect(props.onInvalidate).not.toHaveBeenCalled(); // Framing candidates is context, not a user edit.
    await press('Dopuni mesto u razgovoru'); expect(correct).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(resolver.search).toHaveBeenCalledTimes(1); expect(resolver.reverse).not.toHaveBeenCalled();
    await act(async () => map().props.onChoose(other.position));
    expect(map().props.position).toEqual(other.position); expect(props.onConfirm).not.toHaveBeenCalled();
    expect(map().props.cameraHint).toBeUndefined();
    expect(props.onInvalidate).toHaveBeenCalledTimes(1); // A real pin movement still activates the discard guard.
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45000000, longitudeE6: 19000000, origin: { kind: 'MANUAL_PIN' } });
    expect(resolver.search).toHaveBeenCalledTimes(1);
  });

  it('offers paged ambiguous places in Latin and confirms only the explicitly chosen proposal', async () => {
    const places = Array.from({ length: 4 }, (_, index) => ({ ...candidate,
      label: `Трг републике ${index + 1}, Београд`, position: { latitude: 44 + index / 10, longitude: 20 },
      origin: { ...candidate.origin, candidateHint: `place-${index}` } }));
    const resolver = configured({ ...proposals, candidates: places });
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Trg republike, Beograd' });
    expect(buttons().filter(node => named(node).startsWith('Izaberi predlog'))).toHaveLength(3);
    const oldChoice = button('Izaberi predlog: Trg republike 1, Beograd').props.onPress;
    expect(map().props.position).toBeNull(); expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Još predloga'); expect(buttons().filter(node => named(node).startsWith('Izaberi predlog'))).toHaveLength(1);
    await act(async () => oldChoice()); expect(map().props.position).toBeNull();
    await press('Izaberi predlog: Trg republike 4, Beograd');
    expect(map().props.position).toEqual(places[3].position); expect(props.onConfirm).not.toHaveBeenCalled();
    expect(text()).toContain('Da li je ovo početak?');
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: 'Trg republike 4, Beograd', origin: places[3].origin }));
    expect(resolver.search).toHaveBeenCalledTimes(1);
  });

  it('keeps the last conversation address edit and retires it when correction is closed', async () => {
    const point = { slot: 'start' as const, latitudeE6: 44123456, longitudeE6: 20654321, origin: candidate.origin, address: candidate.label };
    await render({ point, resolver: configured(), presentation: 'conversation' }); await press('Nije tu'); await press('Zatvori');
    const edit = field('adresa za ovaj pin (opciono)').props.onChangeText;
    await act(async () => { edit('Trg'); edit('Trg republike, Beograd'); });
    expect(field('adresa za ovaj pin (opciono)').props.value).toBe('Trg republike, Beograd');
    await press('Završi izmenu'); await act(async () => edit('Retired correction'));
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: 'Trg republike, Beograd', latitudeE6: point.latitudeE6 }));
  });

  it.each([
    [{ status: 'PROPOSALS', candidates: [], requiresConfirmation: true }, 'Mesto nije pronađeno.'],
    [{ status: 'UNAVAILABLE' }, 'Pretraga mesta nije uspela.'],
    [{ status: 'RATE_LIMITED' }, 'Previše pretraga za kratko vreme.'],
  ] as const)('asks for an actual manual pin without equating failure with no results: %j', async (result, copy) => {
    const resolver = configured(result);
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Place' });
    expect(text()).toContain(copy);
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(0);
    expect(button('Potvrdi tačku: Početak')).toBeUndefined(); expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Označi na mapi'); expect(map().props.position).toBeNull();
    await act(async () => map().props.onChoose({ latitude: 45.2, longitude: 19.8 }));
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45200000, longitudeE6: 19800000, origin: { kind: 'MANUAL_PIN' } });
    expect(resolver.search).toHaveBeenCalledTimes(1);
  });

  it('preserves saved notes, refreshes the moved pin address, and retires its old confirm', async () => {
    const resolver = configured(), point = { slot: 'start' as const, latitudeE6: 45200000, longitudeE6: 19800000,
      origin: { kind: 'MANUAL_PIN' as const }, address: 'Saved private address', accessNotes: 'Saved note' };
    await render({ resolver, point, presentation: 'conversation', autoLocate: true, initialQuery: 'Place' });
    expect(resolver.search).not.toHaveBeenCalled(); const old = button('Potvrdi tačku: Početak').props.onPress;
    await act(async () => map().props.onChoose({ latitude: 45.3, longitude: 19.9 }));
    await act(async () => old()); expect(props.onConfirm).not.toHaveBeenCalled();
    await press('Potvrdi tačku: Početak');
    expect(props.onConfirm).toHaveBeenCalledWith({ ...point, latitudeE6: 45300000, longitudeE6: 19900000, address: candidate.label });
  });

  it.each<ConfiguredLocationResolution>([{ status: 'UNAVAILABLE' }, { status: 'PROPOSALS', candidates: [], requiresConfirmation: true }])(
    'never reuses the old address after moving a saved pin when reverse returns %j', async result => {
      const resolver = configured(result), onPromptReady = jest.fn(), point = { slot: 'start' as const,
        latitudeE6: 45200000, longitudeE6: 19800000, origin: { kind: 'MANUAL_PIN' as const },
        address: 'Saved private address', accessNotes: 'Saved note' };
      await render({ resolver, point, onPromptReady, presentation: 'conversation', autoLocate: true, initialQuery: 'Original place query' });
      expect(onPromptReady.mock.calls.at(-1)?.[0].context.proposal.label).toBe(point.address);
      await act(async () => map().props.onChoose({ latitude: 45.3, longitude: 19.9 }));
      expect(map().props.position).toEqual({ latitude: 45.3, longitude: 19.9 });
      expect(onPromptReady.mock.calls.at(-1)?.[0].context.proposal.label).toBe('Tačka izabrana na mapi');
      await act(async () => map().props.expand.onPress());
      expect(text()).toContain('Tačka na mapi');
      expect(text()).not.toContain(point.address);
      expect(text()).not.toContain('Original place query');
      await press('Zatvori');
      await press('Potvrdi tačku: Početak');
      expect(props.onConfirm).toHaveBeenCalledTimes(1);
      expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45300000, longitudeE6: 19900000,
        origin: { kind: 'MANUAL_PIN' }, accessNotes: point.accessNotes });
    });

  it('does not turn a late disabled lookup into a proposal or admit an old correction callback', async () => {
    const pending = deferred<ConfiguredLocationResolution>(), resolver = configured(), correct = jest.fn();
    resolver.search.mockReturnValue(pending.promise);
    await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Place', onCorrectInConversation: correct });
    const old = button('Ispravi u razgovoru').props.onPress;
    await update({ disabled: true }); await act(async () => { pending.resolve(proposals); old(); });
    expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(0);
    expect(button('Potvrdi tačku: Početak')).toBeUndefined(); expect(correct).not.toHaveBeenCalled(); expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

describe('use where I am', () => {
  const capture = jest.requireMock('../nativeCurrentLocation').captureCurrentLocation as jest.Mock;
  beforeEach(() => capture.mockReset());

  it('is not offered where it was never asked for, so the long form gains no permission prompt', async () => {
    await render({ resolver: configured() as never, initialQuery: 'Novi Sad' });
    expect(buttons().some(node => node.props.label === 'Koristi moju lokaciju')).toBe(false);
  });

  it('asks for the position only when pressed, and never on opening', async () => {
    await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
    expect(capture).not.toHaveBeenCalled();
    capture.mockResolvedValue({ kind: 'POINT', point: { latitude: 45.2551, longitude: 19.8451, accuracyMeters: 8, capturedAt: '2026-09-18T10:00:00Z' } });
    await press('Koristi moju lokaciju');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(map().props.position).toEqual({ latitude: 45.2551, longitude: 19.8451 });
  });

  it('places a pin the person still has to confirm, never a confirmed point', async () => {
    capture.mockResolvedValue({ kind: 'POINT', point: { latitude: 45.2551, longitude: 19.8451, accuracyMeters: 8, capturedAt: '2026-09-18T10:00:00Z' } });
    await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
    await press('Koristi moju lokaciju');
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onInvalidate).toHaveBeenCalled();
  });

  it('says a refusal plainly and leaves the other ways open', async () => {
    capture.mockResolvedValue({ kind: 'DENIED' });
    await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
    await press('Koristi moju lokaciju');
    expect(text()).toContain('Pristup lokaciji nije dozvoljen');
    expect(buttons().some(node => node.props.label === 'Pronađi na mapi')).toBe(true);
  });

  it('does not treat an unavailable reading as a position', async () => {
    capture.mockResolvedValue({ kind: 'UNAVAILABLE' });
    await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
    await press('Koristi moju lokaciju');
    expect(text()).toContain('Ne možemo da očitamo gde si');
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  // Design proposal N (owner, 2026-10-07): right before the system's location window the person is told why, in one question.
  // The question comes only when the window is about to open: nothing is asked of a phone that has already said yes.
  describe('the question before the system\'s window', () => {
    const point = { kind: 'POINT', point: { latitude: 45.2551, longitude: 19.8451, accuracyMeters: 8, capturedAt: '2026-09-18T10:00:00Z' } };
    let host: ReturnType<typeof answeringHost> | undefined;
    const holds = (fine: boolean, coarse: boolean) => jest.spyOn(PermissionsAndroid, 'check').mockImplementation(async (permission: string) =>
      permission === PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION ? fine : coarse);
    beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'android'); capture.mockResolvedValue(point); });
    afterEach(() => { host?.stop(); host = undefined; jest.restoreAllMocks(); });

    it('"Dozvoli": the position is then read, and a pin is proposed as before', async () => {
      holds(false, false); host = answeringHost('allow');
      await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
      await press('Koristi moju lokaciju');
      expect(host.asked).toEqual(['location']);
      expect(capture).toHaveBeenCalledTimes(1);
      expect(map().props.position).toEqual({ latitude: 45.2551, longitude: 19.8451 });
    });

    it('"Ne sada": nothing is read and nothing is said; the button is as it was and the other ways stay open', async () => {
      holds(false, false); host = answeringHost('later');
      await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
      await press('Koristi moju lokaciju');
      expect(host.asked).toEqual(['location']);
      expect(capture).not.toHaveBeenCalled();
      expect(button('Koristi moju lokaciju')).toBeDefined(); expect(button('Koristi moju lokaciju').props.disabled).toBe(false);
      expect(text()).not.toContain('Pristup lokaciji nije dozvoljen'); expect(text()).not.toContain('Ne možemo da očitamo gde si');
      expect(props.onConfirm).not.toHaveBeenCalled();
      expect(buttons().some(node => node.props.label === 'Pronađi na mapi')).toBe(true);
      // And the person can still ask again.
      host.stop(); host = answeringHost('allow');
      await press('Koristi moju lokaciju');
      expect(capture).toHaveBeenCalledTimes(1);
    });

    it.each([[true, false], [false, true], [true, true]])('is not asked when the phone already allows it (fine=%s, coarse=%s)', async (fine, coarse) => {
      holds(fine, coarse); host = answeringHost('later');
      await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
      await press('Koristi moju lokaciju');
      expect(host.asked).toEqual([]); expect(capture).toHaveBeenCalledTimes(1);
    });

    it('is not asked on opening, only on the press', async () => {
      holds(false, false); host = answeringHost('later');
      await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
      expect(host.asked).toEqual([]);
    });

    it('with no host to draw the question the position is read directly, as before', async () => {
      holds(false, false);
      await render({ resolver: configured() as never, autoLocate: true, initialQuery: 'Novi Sad' });
      await press('Koristi moju lokaciju');
      expect(capture).toHaveBeenCalledTimes(1);
    });
  });
});

describe('inert compact location gallery', () => {
  const mount = async () => act(async () => { tree = create(<AiLocationGallery />); });
  it.each(['rs.uskoci', 'rs.uskoci.preview', 'other.dev'])('refuses package %s before mounting an editor', async packageName => {
    mockGalleryPackage = packageName; await mount();
    expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(0); expect(text()).toContain('Nije dostupno.');
  });
  it.each([{ scene: 'unknown' }, { scene: ['proposal'] }])('rejects malformed scene %j', async params => {
    mockGalleryParams = params; await mount();
    expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(0); expect(text()).toContain('Nepoznat prikaz galerije.');
  });
  it.each(['proposal', 'ambiguous', 'unavailable', 'saved'])('renders the exact compact editor for %s with only local transitions', async scene => {
    mockGalleryParams = { scene }; await mount();
    expect(tree.root.findByType(LocationPointEditor).props.presentation).toBe('conversation');
    expect(text()).toContain('lokalni primer, bez čuvanja');
    if (scene === 'unavailable') {
      expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(0);
      expect(button('Potvrdi tačku: Mesto rada')).toBeUndefined();
      expect(text()).toContain('Pretraga mesta nije uspela.');
      await press('Označi na mapi'); expect(map().props.position).toBeNull();
      await act(async () => map().props.onChoose({ latitude: 45.25, longitude: 19.85 }));
      expect(map().props.position).toEqual({ latitude: 45.25, longitude: 19.85 });
    } else if (scene === 'ambiguous') {
      expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1);
      expect(map().props.position).toBeNull();
      expect(button('Potvrdi tačku: Mesto rada')).toBeUndefined();
      expect(button('Označi na mapi')).toBeUndefined();
      expect(text()).toContain('Pronađeno je više mesta. Izaberi ono koje tražiš, pa proveri tačku.');
      expect(buttons().filter(node => named(node).startsWith('Izaberi predlog')).length).toBeGreaterThan(1);
      await act(async () => map().props.onChoose({ latitude: 45.25, longitude: 19.85 }));
      expect(map().props.position).toEqual({ latitude: 45.25, longitude: 19.85 });
    } else expect(map().props.position).toEqual({ latitude: 45.2546, longitude: 19.8507 });
    await press('Potvrdi tačku: Mesto rada');
    expect(text()).toContain('Tačka je potvrđena samo u ovoj probi.');
    expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    expect(jest.requireMock('../nativeCurrentLocation').captureCurrentLocation).not.toHaveBeenCalled();
    expect(mockGalleryRouter.replace).not.toHaveBeenCalled();
  });
  it('offers local composer correction/reset and a safe exit, with no command or production resolver dependency', async () => {
    await mount(); await press('Nije tu'); await press('Ispravi u razgovoru');
    const shell = tree.root.findByType('AiShell' as React.ElementType);
    await act(async () => { shell.props.onChange('Probna ispravka'); shell.props.onSend(); });
    expect(tree.root.findByType('AiShell' as React.ElementType).props).toMatchObject({ value: 'Probna ispravka', canSend: false });
    expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    await press('Ponovi prikaz'); expect(tree.root.findAllByType(LocationPointEditor)).toHaveLength(1);
    mockGalleryRouter.canGoBack.mockReturnValueOnce(false);
    await act(async () => tree.root.findByType('AiShell' as React.ElementType).props.onBack());
    expect(mockGalleryRouter.replace).toHaveBeenCalledWith('/dizajn-ai');
    const code = readFileSync(join(__dirname, '../../app/dizajn-ai-mesto.tsx'), 'utf8');
    expect(code).not.toMatch(/(?:import|require).*?(?:supabase|ClientService|productionLocationResolver|expo-location|https?:)/i);
    expect(code).not.toMatch(/\b(?:fetch|rpc|invoke|captureCurrentLocation)\s*\(/);
  });
});


it('retires unresolved camera context on disable and rejects the retained map action', async () => {
  const other = { ...candidate, position: { latitude: 45, longitude: 19 },
    origin: { ...candidate.origin, candidateHint: 'candidate-2' } };
  const resolver = configured({ ...proposals, candidates: [candidate, other] } as ConfiguredLocationResolution);
  await render({ resolver, presentation: 'conversation', autoLocate: true, initialQuery: 'Known place' });
  expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1);
  const oldChoose = map().props.onChoose;
  expect(map().props.position).toBeNull();
  expect(map().props.cameraHint).toEqual([candidate.position, other.position]);
  await update({ disabled: true });
  expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(0);
  await act(async () => oldChoose(other.position));
  expect(props.onConfirm).not.toHaveBeenCalled(); expect(props.onInvalidate).not.toHaveBeenCalled();
  await update({ disabled: false });
  // Re-enabling starts a fresh automatic lookup. Its ambiguous result frames the region again
  // without reviving the retired map action or selecting a point.
  expect(tree.root.findAllByType('PinMap' as React.ElementType)).toHaveLength(1);
  expect(map().props.position).toBeNull();
  expect(map().props.cameraHint).toEqual([candidate.position, other.position]);
  expect(resolver.search).toHaveBeenCalledTimes(2);
});
