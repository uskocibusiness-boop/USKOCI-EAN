import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ResolvedPinMap } from '../../ResolvedPinMap';
import { ResolvedPinMap as WebPinMap } from '../../ResolvedPinMap.web';
import type { ResolvedPinMapProps } from '../../ResolvedPinMap.types';
import { sys } from '../../../system/tokens';

let mockFocused = true;
const mockJump = jest.fn();
const mockProject = jest.fn();
const mockUnproject = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('@maplibre/maplibre-react-native', () => ({ Marker: 'NativeMarker',
  Map: require('react').forwardRef((props: object, ref: unknown) => {
    require('react').useImperativeHandle(ref, () => ({ project: mockProject, unproject: mockUnproject }));
    return require('react').createElement('NativeMap', props);
  }),
  Camera: require('react').forwardRef((props: object, ref: unknown) => {
    require('react').useImperativeHandle(ref, () => ({ jumpTo: mockJump }));
    return require('react').createElement('NativeCamera', props);
  }),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator', 'Image'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../Press', () => ({ Press: 'Press' }));
jest.mock('../../../v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../../system/ActionSheet', () => ({ ActionSheet: 'MapSourcesPanel' }));
jest.mock('../../LocationControls', () => ({ locationStyles: { notice: {} } }));

let tree: ReactTestRenderer;
const onChoose = jest.fn();
const initial: ResolvedPinMapProps = { position: null, onChoose, scopeKey: 'account-incarnation:point:revision' };
const map = () => tree.root.findByType('NativeMap' as React.ElementType);
const annotation = () => tree.root.findByType('NativeMarker' as React.ElementType);
const handle = () => annotation().findByProps({ collapsable: false });
const frame = () => tree.root.find(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
const gesture = (pageX: number, pageY: number, count = 1) => ({ nativeEvent: { pageX, pageY, touches: Array(count).fill({}) }, stopPropagation: jest.fn() });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const markerImage = () => tree.root.findByType('Image' as React.ElementType);
const tap = (longitude: number, latitude: number) => ({ nativeEvent: { lngLat: [longitude, latitude], point: [1, 1] } });
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
async function render(props: Partial<ResolvedPinMapProps> = {}) {
  await act(async () => { tree = create(<ResolvedPinMap {...initial} {...props} />); });
}
async function ready() { await act(async () => map().props.onDidFinishLoadingMap()); }
async function dragReady(center = [19, 45], zoom = 15) {
  await ready();
  await act(async () => { frame().props.onLayout({ nativeEvent: { layout: { width: 340, height: 320 } } });
    markerImage().props.onLoad(); map().props.onRegionDidChange({ nativeEvent: { center, zoom } }); });
}
beforeEach(() => { mockFocused = true; jest.clearAllMocks(); jest.useFakeTimers(); mockProject.mockResolvedValue([170, 160]); mockUnproject.mockResolvedValue([20.123456, 44.654321]); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

const links = () => tree.root.findAllByType('Press' as React.ElementType);

it('shows a neutral real map with no pin or selection when position is absent', async () => {
  await render();
  expect(map().props.mapStyle).toBe('https://tiles.openfreemap.org/styles/positron');
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
  await ready();
  expect(text()).toContain('Tačka nije izabrana');
  expect(onChoose).not.toHaveBeenCalled();
});

it('keeps all source links in a compact overlay outside the accessible map frame', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));
  await render({ compact: true, height: 156, disabled: true, position: { latitude: 45, longitude: 19 } });
  expect(map().props).toMatchObject({ attribution: false, compass: false, logo: false });
  expect(map().props.attributionPosition).toBeUndefined();
  expect(links()).toHaveLength(0); // Nothing to credit while the map is still loading.
  await ready();
  expect(links()).toHaveLength(1);
  expect(links()[0].props.accessibilityRole).toBe('button');
  expect(links()[0].props.accessibilityLabel).toBe('Izvori mape: © OpenStreetMap, © OpenMapTiles, OpenFreeMap');
  expect(frame().findAllByType('Press' as React.ElementType)).toHaveLength(0);
  expect(StyleSheet.flatten(frame().props.style).height).toBe(156);
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'discovery-map-credits-layer' }).props.style)).toMatchObject({ position: 'absolute', bottom: sys.space.xs });
  expect(StyleSheet.flatten(links()[0].props.style)).toMatchObject({ minHeight: 44, maxWidth: '100%' });
  const jumps = mockJump.mock.calls.length;
  await act(async () => links()[0].props.onPress());
  const panel = tree.root.findByType('MapSourcesPanel' as React.ElementType);
  expect(panel.props.actions.map((action: { label: string }) => action.label)).toEqual(['© OpenStreetMap', '© OpenMapTiles', 'OpenFreeMap']);
  for (const action of panel.props.actions) await act(async () => action.onPress());
  expect(openURL.mock.calls.map(([url]) => url)).toEqual(['https://www.openstreetmap.org/copyright', 'https://www.openmaptiles.org/', 'https://openfreemap.org/']);
  await act(async () => panel.props.onClose());
  expect(tree.root.findAllByType('MapSourcesPanel' as React.ElementType)).toHaveLength(0);
  expect(mockJump).toHaveBeenCalledTimes(jumps);
  expect(onChoose).not.toHaveBeenCalled();
});

it('retires the source panel with the point identity and rejects the old open callback', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await ready();
  const oldOpen = links()[0].props.onPress;
  await act(async () => oldOpen());
  expect(tree.root.findAllByType('MapSourcesPanel' as React.ElementType)).toHaveLength(1);
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={{ latitude: 44, longitude: 20 }} />));
  await act(async () => oldOpen());
  expect(tree.root.findAllByType('MapSourcesPanel' as React.ElementType)).toHaveLength(0);
  expect(onChoose).not.toHaveBeenCalled();
});

it('opening sources cancels an in-flight pin projection without accepting its late coordinate', async () => {
  const pending = deferred<[number, number]>(); mockUnproject.mockReturnValue(pending.promise);
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => { void handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockUnproject).toHaveBeenCalledTimes(1);
  await act(async () => links()[0].props.onPress());
  await act(async () => pending.resolve([20, 44]));
  expect(tree.root.findAllByType('MapSourcesPanel' as React.ElementType)).toHaveLength(1);
  expect(onChoose).not.toHaveBeenCalled();
});

// r6 row 8 (2026-09-24): under "Na javnoj mapi prikazuje se približno područje" the map drew the same orange pin with a
// tail as the private picker, over the city name. The public approximate view now draws a translucent green disc with a
// hairline and no tail. The existing brand is now inside that halo; the map still speaks once as an area and never carries private precision.
it('draws the public approximate point as an area, not a pin, and speaks it once', async () => {
  await render({ position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true, disabled: true }); await ready();
  expect(annotation().props).toMatchObject({ id: 'location-area', lngLat: [19.65, 45.12], anchor: 'center' });
  expect(tree.root.findAllByType('Image' as React.ElementType)).toHaveLength(1);
  const disc = annotation().findByProps({ accessibilityLabel: 'Približno područje na mapi' });
  expect(disc.props).toMatchObject({ accessible: true, accessibilityRole: 'image', pointerEvents: 'none' });
  expect(disc.props.style).toMatchObject({ width: 64, height: 64, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.greenEdge });
  expect(disc.props.onStartShouldSetResponder).toBeUndefined();
  const fill = disc.children[0] as ReactTestInstance;
  expect(fill.props.style).toMatchObject({ backgroundColor: sys.color.green, opacity: 0.16 });
  expect(frame().props).toMatchObject({ accessible: true, accessibilityRole: 'image',
    accessibilityLabel: 'Približno područje na mapi. Geografska širina 45.12; geografska dužina 19.65.' });
  expect(map().props).toMatchObject({ accessibilityLabel: 'Mapa približnog područja', importantForAccessibility: 'no-hide-descendants' });
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456');
  expect(JSON.stringify(tree.toJSON())).not.toContain('19.654321');
  expect(text()).not.toContain('Dodirni mapu'); expect(text()).not.toContain('Geografska');
  await act(async () => map().props.onPress(tap(20.12, 44.65)));
  expect(onChoose).not.toHaveBeenCalled();
});

// The map's spoken name follows its mode, and the orange pin stays wherever a point is exact or can be moved: the
// private Dogovor point, the picker, and the worker's coarse base (profil/lokacija drags it).
it.each([
  [{}, 'Mapa predložene lokacije', 'auto'],
  [{ coarse: true }, 'Mapa približnog područja rada', 'auto'],
  [{ disabled: true }, 'Mapa prikazane tačke', 'no-hide-descendants'],
] as const)('names the map by its mode %j and keeps the pin for an exact or editable point', async (mode, name, importance) => {
  await render({ position: { latitude: 45.25, longitude: 19.83 }, ...mode }); await ready();
  expect(map().props).toMatchObject({ accessibilityLabel: name, importantForAccessibility: importance });
  expect(annotation().props).toMatchObject({ id: 'location-proposal', anchor: 'bottom' });
  expect(markerImage().props.style).toEqual({ width: 44, height: 48 });
  expect(handle().props.accessibilityLabel).toBe('Oznaka izabrane tačke na mapi');
  if ('disabled' in mode) {
    expect(frame().props.accessibilityLabel).toBe('Tačka na mapi. Geografska širina 45.250000; geografska dužina 19.830000.');
  } else {
    expect(frame().props.accessible).toBe(false);
  }
});

it('renders only the two-decimal coarse position and emits only a user-selected coarse proposal', async () => {
  await render({ position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true });
  expect(annotation().props.lngLat).toEqual([19.65, 45.12]);
  await act(async () => map().props.onPress(tap(20.123456, 44.654321)));
  expect(onChoose).not.toHaveBeenCalled();
  await ready();
  expect(mockJump).toHaveBeenCalledWith({ center: [19.65, 45.12], zoom: 10 });
  await act(async () => map().props.onPress(tap(20.123456, 44.654321)));
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.65, longitude: 20.12 });
  expect(annotation().props.lngLat).toEqual([19.65, 45.12]); // Parent owns accepting the proposal.
});

it('a real map pan proposes the new center but zoom and automatic camera changes do not', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await ready();
  const settled = (zoom: number, userInteraction: boolean, center: [number, number]) => {
    map().props.onRegionWillChange({ nativeEvent: { zoom: 15, center: [19, 45], userInteraction } });
    map().props.onRegionDidChange({ nativeEvent: { zoom, center, userInteraction } });
  };
  await act(async () => settled(15, false, [19.8, 45.8]));
  expect(onChoose).not.toHaveBeenCalled();
  await act(async () => settled(16, true, [19.8, 45.8]));
  expect(onChoose).not.toHaveBeenCalled();
  await act(async () => settled(15, true, [19.84, 45.25]));
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledWith({ latitude: 45.25, longitude: 19.84 });
  // The marker remains at its parent-confirmed position until the person accepts.
  expect(annotation().props.lngLat).toEqual([19, 45]);
});

it('keeps the original native overlay asset and resolves real marker movement through native projection once', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  expect(annotation().props.lngLat).toEqual([19, 45]); expect(annotation().props.anchor).toBe('bottom');
  expect(handle().props).toMatchObject({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Oznaka izabrane tačke na mapi' });
  expect(handle().props.onStartShouldSetResponder()).toBe(true);
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(onChoose).not.toHaveBeenCalled();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  expect(map().props.dragPan).toBe(false);
  await act(async () => handle().props.onResponderMove(gesture(110, 130)));
  expect(handle().props.style[1]).toEqual({ transform: [{ translateX: 10 }, { translateY: 30 }] });
  await act(async () => { handle().props.onResponderRelease(gesture(110, 130)); handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockProject).toHaveBeenCalledWith([19, 45]); expect(mockUnproject).toHaveBeenCalledTimes(1); expect(mockUnproject).toHaveBeenCalledWith([180, 190]);
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.654321, longitude: 20.123456 });
  expect(annotation().props.lngLat).toEqual([19, 45]); expect(map().props.dragPan).toBe(true);
});

it('rejects a retained tap/drag callback after the input position or disabled state changes', async () => {
  const props = { ...initial, position: { latitude: 45, longitude: 19 } };
  await render(props); await dragReady();
  const oldTap = map().props.onPress, oldDragEnd = handle().props.onResponderRelease;
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => tree.update(<ResolvedPinMap {...props} position={{ latitude: 44, longitude: 20 }} disabled />));
  await act(async () => { oldTap(tap(21, 43)); oldDragEnd(gesture(110, 130)); map().props.onPress(tap(21, 43)); });
  expect(onChoose).not.toHaveBeenCalled(); expect(handle().props.onStartShouldSetResponder()).toBe(false);
});

it('does not let a previous scope revive after A → B → A', async () => {
  await render({ scopeKey: 'A' }); await ready();
  const oldTap = map().props.onPress, oldLoaded = map().props.onDidFinishLoadingMap;
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="B" />));
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="A" />));
  await act(async () => { oldLoaded(); oldTap(tap(19, 45)); });
  expect(text()).toContain('Učitavamo mapu'); expect(onChoose).not.toHaveBeenCalled();
  await ready(); await act(async () => map().props.onPress(tap(20, 44)));
  expect(onChoose).toHaveBeenCalledTimes(1);
});

it('unmounts the map on blur and rejects old callbacks after refocus', async () => {
  await render(); await ready(); const retained = map().props.onPress;
  mockFocused = false;
  await act(async () => tree.update(<ResolvedPinMap {...initial} />));
  expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
  await act(async () => retained(tap(19, 45))); expect(onChoose).not.toHaveBeenCalled();
  mockFocused = true;
  await act(async () => tree.update(<ResolvedPinMap {...initial} />)); await ready();
  await act(async () => retained(tap(19, 45))); expect(onChoose).not.toHaveBeenCalled();
});

it('recovers the same owned pin map after its display deadline only when the real load succeeds', async () => {
  await render(); const current = map(), callbacks = current.props;
  await act(async () => jest.advanceTimersByTime(15_001));
  await act(async () => callbacks.onPress(tap(19, 45)));
  expect(text()).toContain('Mapa nije učitana'); expect(onChoose).not.toHaveBeenCalled();
  await act(async () => callbacks.onDidFinishLoadingMap());
  expect(map()).toBe(current); expect(text()).not.toContain('Mapa nije učitana');
  await act(async () => map().props.onPress(tap(19, 45)));
  expect(onChoose).toHaveBeenCalledWith({ latitude: 45, longitude: 19 });
});

it('retries a new real map after a deadline and rejects all callbacks of the retired attempt', async () => {
  await render(); const old = map().props;
  await act(async () => jest.advanceTimersByTime(15_001));
  expect(text()).toContain('Mapa nije učitana');
  await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' }).props.onPress());
  await act(async () => { old.onDidFinishLoadingMap(); old.onDidFailLoadingMap(); old.onPress(tap(19, 45)); });
  expect(onChoose).not.toHaveBeenCalled();
  expect(text()).toContain('Učitavamo mapu'); await ready();
  await act(async () => { old.onPress(tap(19, 45)); map().props.onPress(tap(20, 44)); });
  expect(onChoose).toHaveBeenCalledTimes(1); expect(onChoose).toHaveBeenCalledWith({ latitude: 44, longitude: 20 });
});

it('rejects malformed positions and native coordinates without manufacturing a pin', async () => {
  await render({ position: { latitude: 91, longitude: 19 } }); await ready();
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
  for (const event of [tap(Infinity, 44), tap(19, NaN), tap(181, 44), tap(19, -91), { nativeEvent: { lngLat: null } }]) {
    await act(async () => map().props.onPress(event));
  }
  expect(onChoose).not.toHaveBeenCalled();
});

it('web fallback reports native map requirement without rendering or choosing a point', async () => {
  await act(async () => { tree = create(<WebPinMap {...initial} position={{ latitude: 45.123456, longitude: 19.123456 }} />); });
  expect(text()).toContain('mobilnu aplikaciju');
  expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456'); expect(onChoose).not.toHaveBeenCalled();
});

it('announces real selected coordinates outside the Android bitmap and updates only after parent acceptance', async () => {
  await render(); await ready();
  await act(async () => map().props.onPress(tap(19.8312344, 45.2512344)));
  expect(text()).not.toContain('Geografska širina');
  const position = onChoose.mock.calls[0][0];
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={position} />));
  await act(async () => markerImage().props.onLoad());
  const status = tree.root.findByProps({ accessibilityLabel: 'Predložena tačka na mapi. Geografska širina 45.251234; geografska dužina 19.831234.' });
  expect(status.props.accessible).toBe(true);
  expect(annotation().findAllByProps({ accessibilityRole: 'text' })).toHaveLength(0);
  expect(text()).toContain('Dodirni mapu ili prevuci oznaku do pravog mesta.');
  await act(async () => map().props.onRegionDidChange({ nativeEvent: { center: [19.8312344, 45.2512344], zoom: 15 } }));
  expect(text()).toContain('Tačka je na sredini mape. Pomeri oznaku ako treba.');
});

it('camera readiness requires the current native center and zoom, then clears on movement', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } }); await ready();
  await act(async () => markerImage().props.onLoad());
  for (const state of [{ center: [19.83, 45.25], zoom: 1 }, { center: [0, 0], zoom: 15 }, { center: [NaN, 45.25], zoom: 15 }, null]) {
    await act(async () => map().props.onRegionDidChange({ nativeEvent: state }));
    expect(text()).not.toContain('Tačka je na sredini mape');
  }
  await act(async () => map().props.onRegionDidChange({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  expect(text()).toContain('Tačka je na sredini mape');
  await act(async () => map().props.onRegionWillChange());
  expect(text()).not.toContain('Tačka je na sredini mape');
});

it('coarse accessibility rounds both coordinates and never announces private precision', async () => {
  await render({ position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true }); await ready();
  expect(tree.root.findByProps({ accessibilityLabel: 'Približna tačka na mapi. Geografska širina 45.12; geografska dužina 19.65.' })).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456');
  expect(JSON.stringify(tree.toJSON())).not.toContain('19.654321');
});

it('clears selected-coordinate and idle state on point removal, account switch, blur and unmount', async () => {
  const position = { latitude: 45.25, longitude: 19.83 };
  await render({ position }); await ready(); const oldIdle = map().props.onRegionDidChange;
  await act(async () => markerImage().props.onLoad());
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  await act(async () => tree.update(<ResolvedPinMap {...initial} />));
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  expect(text()).not.toContain('Geografska'); expect(text()).not.toContain('Tačka je na sredini mape');
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={position} scopeKey="other-account" />));
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  expect(text()).not.toContain('Tačka je na sredini mape');
  mockFocused = false;
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={position} scopeKey="other-account" />));
  expect(text()).not.toContain('Geografska');
  await act(async () => tree.unmount());
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
});

it('keeps decoded image readiness separate from actual camera idle without any offscreen refresh', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } }); await ready();
  const marker = markerImage();
  expect(marker.props).toMatchObject({ accessible: false, fadeDuration: 0, resizeMode: 'contain', style: { width: 44, height: 48 } });
  expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await act(async () => {
    map().props.onRegionDidChange({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } });
    jest.advanceTimersByTime(500);
  });
  expect(mockProject).not.toHaveBeenCalled();
  expect(text()).not.toContain('Tačka je na sredini mape');
  await act(async () => marker.props.onLoad());
  expect(text()).toContain('Tačka je na sredini mape');
  expect(annotation().props.onDragEnd).toBeUndefined();
});

it('retains early decoded pixels until map readiness but rejects stale image events after point or scope changes', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } });
  const oldImage = markerImage().props;
  await act(async () => oldImage.onLoad());
  expect(text()).not.toContain('Tačka je na sredini mape');
  await ready();
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={{ latitude: 45.26, longitude: 19.84 }} />));
  await act(async () => { oldImage.onLoad(); oldImage.onError(); });
  expect(text()).not.toContain('Mapa nije učitana');
  await act(async () => markerImage().props.onLoad());
  const currentImage = markerImage().props;
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={{ latitude: 45.26, longitude: 19.84 }} disabled />));
  await act(async () => { currentImage.onLoad(); currentImage.onError(); });
  expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await act(async () => markerImage().props.onLoad());
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="other-account" />));
  await act(async () => { currentImage.onLoad(); currentImage.onError(); });
  expect(text()).not.toContain('Mapa nije učitana');
  mockFocused = false;
  await act(async () => tree.update(<ResolvedPinMap {...initial} />));
  await act(async () => { oldImage.onLoad(); currentImage.onLoad(); });
  await act(async () => tree.unmount());
  await act(async () => { currentImage.onLoad(); currentImage.onError(); });
  expect(mockProject).not.toHaveBeenCalled();
});

it('fails the map visibly if its local marker cannot load and does not accept late image success as recovery', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } }); await ready();
  const marker = markerImage().props;
  await act(async () => marker.onError());
  expect(text()).toContain('Mapa nije učitana'); expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await act(async () => { marker.onLoad(); map().props.onDidFinishLoadingMap(); map().props.onPress(tap(19.84, 45.26)); });
  expect(mockProject).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
  expect(text()).not.toContain('Tačka je na sredini mape');
});

it('an explicit native error after the display deadline cannot recover from a late load', async () => {
  await render(); const callbacks = map().props;
  await act(async () => jest.advanceTimersByTime(15_001));
  await act(async () => { callbacks.onDidFailLoadingMap(); callbacks.onDidFinishLoadingMap(); callbacks.onPress(tap(19, 45)); });
  expect(text()).toContain('Mapa nije učitana'); expect(onChoose).not.toHaveBeenCalled();
});

it.each(['project', 'unproject'] as const)('fences late native %s after cancel, failed map, timeout, disable, point ABA, account ABA, blur or unmount', async phase => {
  for (const change of ['cancel', 'map-failure', 'timeout', 'disabled', 'point-ABA', 'account-ABA', 'blur', 'unmount']) {
    mockFocused = true; onChoose.mockClear(); mockProject.mockReset(); mockUnproject.mockReset();
    const delayed = deferred<[number, number]>(), props = { ...initial, position: { latitude: 45, longitude: 19 }, scopeKey: 'A' };
    mockProject.mockReturnValue(phase === 'project' ? delayed.promise : Promise.resolve([170, 160]));
    mockUnproject.mockReturnValue(phase === 'unproject' ? delayed.promise : Promise.resolve([20, 44]));
    await render(props); await dragReady();
    const retained = handle().props;
    await act(async () => { retained.onResponderGrant(gesture(100, 100)); retained.onResponderRelease(gesture(110, 130)); });
    await act(async () => {
      if (change === 'cancel') retained.onResponderTerminate();
      if (change === 'map-failure') map().props.onDidFailLoadingMap();
      if (change === 'timeout') jest.advanceTimersByTime(15_001);
      if (change === 'disabled') tree.update(<ResolvedPinMap {...props} disabled />);
      if (change === 'point-ABA') tree.update(<ResolvedPinMap {...props} position={{ latitude: 44, longitude: 20 }} />);
      if (change === 'account-ABA') tree.update(<ResolvedPinMap {...props} scopeKey="B" />);
      if (change === 'blur') { mockFocused = false; tree.update(<ResolvedPinMap {...props} />); }
      if (change === 'unmount') tree.unmount();
    });
    if (change.endsWith('ABA')) await act(async () => tree.update(<ResolvedPinMap {...props} />));
    await act(async () => delayed.resolve(phase === 'project' ? [170, 160] : [20, 44]));
    expect(onChoose).not.toHaveBeenCalled();
    expect(mockUnproject).toHaveBeenCalledTimes(phase === 'project' ? 0 : 1);
    await act(async () => tree.unmount());
  }
});

it('cancels invalid native projection or movement without manufacturing coordinates or locking the map', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  for (const result of [null, [NaN, 1], [170], 'wrong']) {
    mockProject.mockResolvedValueOnce(result); mockUnproject.mockClear();
    await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(gesture(110, 130)); });
    expect(mockUnproject).not.toHaveBeenCalled(); expect(map().props.dragPan).toBe(true);
  }
  mockProject.mockRejectedValueOnce(new Error('Native projection unavailable'));
  await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockUnproject).not.toHaveBeenCalled();
  for (const end of [gesture(100, 100), gesture(101, 101), gesture(1000, 1000), gesture(110, 130, 2)]) {
    await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(end); });
    expect(mockUnproject).not.toHaveBeenCalled(); expect(map().props.dragPan).toBe(true);
  }
  expect(onChoose).not.toHaveBeenCalled();
});

it('keeps coarse drag private precision out and does not let old cancellation cancel the next coordinate gesture', async () => {
  const props = { ...initial, position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true };
  await render(props); await dragReady([19.65, 45.12], 10);
  const old = handle().props;
  await act(async () => tree.update(<ResolvedPinMap {...props} position={{ latitude: 44.111111, longitude: 20.222222 }} />));
  await dragReady([20.22, 44.11], 10);
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => old.onResponderTerminate());
  expect(map().props.dragPan).toBe(false);
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(mockProject).toHaveBeenLastCalledWith([20.22, 44.11]);
  expect(onChoose).toHaveBeenCalledTimes(1); expect(onChoose).toHaveBeenCalledWith({ latitude: 44.65, longitude: 20.12 });
});

it('cancels an active marker gesture when the viewport moves or its measured frame changes', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => map().props.onRegionWillChange());
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(mockUnproject).not.toHaveBeenCalled(); expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await dragReady();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => frame().props.onLayout({ nativeEvent: { layout: { width: 640, height: 320 } } }));
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(mockUnproject).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
});

it('allows a visible marker to be dragged after a user-changed viewport becomes idle without demanding a centered camera', async () => {
  await render({ position: { latitude: 45, longitude: 19 } });
  await dragReady([19.001, 45.001], 14);
  expect(text()).not.toContain('Tačka je na sredini mape');
  expect(handle().props.onStartShouldSetResponder()).toBe(true);
  await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockUnproject).toHaveBeenCalledWith([180, 190]);
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.654321, longitude: 20.123456 });
});

it('retires camera readiness synchronously before retained responder callbacks can run in the same native turn', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  const beforeCameraMove = handle().props;
  act(() => {
    map().props.onRegionWillChange();
    expect(beforeCameraMove.onStartShouldSetResponder()).toBe(false);
    beforeCameraMove.onResponderGrant(gesture(100, 100));
  });
  expect(mockProject).not.toHaveBeenCalled();
  await dragReady(); const beforeResize = handle().props;
  act(() => {
    frame().props.onLayout({ nativeEvent: { layout: { width: 640, height: 320 } } });
    expect(beforeResize.onStartShouldSetResponder()).toBe(false);
    beforeResize.onResponderGrant(gesture(100, 100));
  });
  expect(mockProject).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
});


it('frames all real candidates as camera context without selecting a winner or changing their coordinates', async () => {
  const cameraHint = [{ latitude: 45.2, longitude: 19.8 }, { latitude: 45.3, longitude: 19.9 }];
  await render({ cameraHint }); await ready();
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState).toMatchObject({
    bounds: [19.8, 45.2, 19.9, 45.3], padding: { top: 24, bottom: 24, left: 24, right: 24 },
  });
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.maxZoom).toBe(18);
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
  expect(onChoose).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled();
  await act(async () => map().props.onPress(tap(19.85, 45.25)));
  expect(onChoose).toHaveBeenCalledWith({ latitude: 45.25, longitude: 19.85 });
  expect(cameraHint).toEqual([{ latitude: 45.2, longitude: 19.8 }, { latitude: 45.3, longitude: 19.9 }]);
});

it('uses a closer street zoom for a compact chat pin without changing ordinary map zoom', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.84 }, compact: true }); await ready();
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState)
    .toEqual({ center: [19.84, 45.25], zoom: 17 });
  expect(mockJump).toHaveBeenCalledWith({ center: [19.84, 45.25], zoom: 17 });
});

it('can zoom one passive resolver hint to a street while keeping it unselected', async () => {
  const hint = [{ latitude: 45.2512, longitude: 19.8244 }];
  await render({ cameraHint: hint, cameraHintZoom: 16.5, compact: true }); await ready();
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState)
    .toEqual({ center: [19.8244, 45.2512], zoom: 16.5 });
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
  expect(onChoose).not.toHaveBeenCalled();
});

it('keeps a real point authoritative over a camera hint and never carries a hint across scope changes', async () => {
  const cameraHint = [{ latitude: 45.2, longitude: 19.8 }, { latitude: 45.3, longitude: 19.9 }];
  await render({ position: { latitude: 44, longitude: 20 }, cameraHint }); await ready();
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState).toEqual({ center: [20, 44], zoom: 15 });
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="new-account-context" />));
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState).toEqual({ center: [0, 0], zoom: 1 });
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
  expect(onChoose).not.toHaveBeenCalled();
});

it.each([
  { cameraHint: [] },
  { cameraHint: [{ latitude: NaN, longitude: 19 }] },
  { cameraHint: Array(21).fill({ latitude: 45, longitude: 19 }) },
])(
  'rejects invalid or unbounded camera context without synthesizing a marker', async ({ cameraHint }) => {
    await render({ cameraHint }); await ready();
    expect(tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState).toEqual({ center: [0, 0], zoom: 1 });
    expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
    expect(onChoose).not.toHaveBeenCalled();
  });

it('keeps coincident camera results at a nonzero extent and coarse hints at public precision', async () => {
  await render({ coarse: true, cameraHint: [{ latitude: 45.123456, longitude: 19.654321 }] }); await ready();
  const bounds = tree.root.findByType('NativeCamera' as React.ElementType).props.initialViewState.bounds;
  expect((bounds[0] + bounds[2]) / 2).toBeCloseTo(19.65, 8);
  expect((bounds[1] + bounds[3]) / 2).toBeCloseTo(45.12, 8);
  expect(bounds[2] - bounds[0]).toBeCloseTo(0.01, 8); expect(bounds[3] - bounds[1]).toBeCloseTo(0.01, 8);
  expect(tree.root.findByType('NativeCamera' as React.ElementType).props.maxZoom).toBe(13);
  expect(onChoose).not.toHaveBeenCalled();
});

it('keeps web camera context passive under the existing native-only editor limitation', async () => {
  await act(async () => { tree = create(<WebPinMap {...initial} cameraHint={[{ latitude: 45, longitude: 19 }]} />); });
  expect(text()).toContain('Otvori mobilnu aplikaciju');
  expect(onChoose).not.toHaveBeenCalled();
});

// Owner, 2026-10-07: the small chat map carries its own expand control in its top-right corner, a 44 dp target that opens
// the full-screen pin editor. It is opt-in (only the conversation's compact map asks for it), it is there while the tiles
// load, and a disabled map answers it with nothing.
it('draws an opt-in expand control in the frame’s top-right corner with a 44 dp target and its spoken name', async () => {
  const onPress = jest.fn();
  await render({ position: { latitude: 45.25, longitude: 19.83 }, compact: true, height: 156,
    expand: { label: 'Uvećaj mapu za: Mesto zadatka', onPress } });
  const expand = () => frame().findByProps({ accessibilityLabel: 'Uvećaj mapu za: Mesto zadatka' });
  expect(expand().props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Otvara mapu preko celog ekrana.',
    accessibilityState: { disabled: false }, hitSlop: 0 });
  expect(expand().props.style).toMatchObject({ position: 'absolute', top: sys.space.sm, right: sys.space.sm, width: 44, height: 44,
    backgroundColor: sys.color.surface });
  await act(async () => expand().props.onPress()); expect(onPress).toHaveBeenCalledTimes(1);
  await ready();
  expect(frame().findAllByProps({ accessibilityLabel: 'Uvećaj mapu za: Mesto zadatka' })).toHaveLength(1);
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={{ latitude: 45.25, longitude: 19.83 }} compact height={156}
    expand={{ label: 'Uvećaj mapu za: Mesto zadatka', onPress, disabled: true }} />));
  expect(expand().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  await act(async () => expand().props.onPress()); expect(onPress).toHaveBeenCalledTimes(1);
  expect(onChoose).not.toHaveBeenCalled();
});

it('draws no expand control unless asked, so the full-screen map and every other map stay as they were', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 }, compact: true, fill: true }); await ready();
  expect(tree.root.findAll(node => String(node.props.accessibilityLabel ?? '').startsWith('Uvećaj mapu'))).toHaveLength(0);
});
