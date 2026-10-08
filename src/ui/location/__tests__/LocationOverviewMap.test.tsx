import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LocationOverviewMap } from '../LocationOverviewMap';
import { LocationOverviewMap as WebOverview } from '../LocationOverviewMap.web';
import { LOCATION_MAP_CREDITS, overviewDisplayPoints, type LocationOverviewMapProps } from '../LocationOverviewMap.types';

let mockFocused = true, mockStyle: string | null = 'https://tiles.openfreemap.org/styles/positron';
let mockSession: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
const mockJump = jest.fn(), mockFit = jest.fn(), mockSelect = jest.fn();
const mockListeners = new Set<(state: string) => void>();
const mockApp = { currentState: 'active', addEventListener: (_: string, listener: (state: string) => void) => {
  mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
} };
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(
  () => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../mapStyle', () => ({ useMapStyle: () => mockStyle }));
jest.mock('@maplibre/maplibre-react-native', () => ({ Map: 'NativeMap', Marker: 'NativeMarker',
  Camera: require('react').forwardRef((props: object, ref: unknown) => {
    require('react').useImperativeHandle(ref, () => ({ jumpTo: mockJump, fitBounds: mockFit }));
    return require('react').createElement('NativeCamera', props);
  }),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return mockApp;
    return ['View', 'ActivityIndicator', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));

let tree: ReactTestRenderer;
const first = { id: 'a', label: 'Preuzimanje', latitude: 45.123456, longitude: 19.654321 };
const second = { id: 'b', label: 'Isporuka', latitude: 44.812345, longitude: 20.432109 };
const initial: LocationOverviewMapProps = { points: [first, second], scopeKey: 'account-a:agreement:rev1',
  coarse: false, interactive: true, height: 280, onSelectPoint: mockSelect };
const maps = () => tree.root.findAllByType('NativeMap' as React.ElementType);
const markers = () => tree.root.findAllByType('NativeMarker' as React.ElementType);
const camera = () => tree.root.findByType('NativeCamera' as React.ElementType);
const words = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async (props: Partial<LocationOverviewMapProps> = {}) => act(async () => { tree = create(<LocationOverviewMap {...initial} {...props} />); });
const update = async (props: Partial<LocationOverviewMapProps> = {}) => act(async () => tree.update(<LocationOverviewMap {...initial} {...props} />));
async function ready() {
  await act(async () => {
    tree.root.findByProps({ testID: 'location-overview-frame' }).props.onLayout({ nativeEvent: { layout: { width: 320, height: 280 } } });
    maps()[0].props.onDidFinishLoadingMap();
  });
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockFocused = true; mockStyle = 'https://tiles.openfreemap.org/styles/positron';
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockApp.currentState = 'active';
  mockJump.mockReset(); mockFit.mockReset();
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

it('rounds all coarse native geometry before map/camera props and fits every confirmed stop', async () => {
  await render({ coarse: true }); await ready();
  expect(markers().map(marker => marker.props.lngLat)).toEqual([[19.65, 45.12], [20.43, 44.81]]);
  expect(camera().props.initialViewState).toEqual({ center: [19.65, 45.12], zoom: 10 });
  expect(mockFit).toHaveBeenCalledWith([19.65, 44.81, 20.43, 45.12], {
    padding: { top: 52, bottom: 52, left: 52, right: 52 }, duration: 0,
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456');
  expect(JSON.stringify(tree.toJSON())).not.toContain('19.654321');
  // The stops of a route are numbered pins: a small place pin beside each number, and never the app's own mark.
  const pins = tree.root.findAllByType('FactArt' as React.ElementType);
  expect(pins).toHaveLength(2); expect(pins.map(pin => pin.props.kind)).toEqual(['pin', 'pin']);
  expect(markers().map(marker => marker.props.anchor)).toEqual(['center', 'center']);
});

it('groups coincident rounded stops without dropping numbers and uses one actual center', async () => {
  await render({ coarse: true, points: [first, { ...second, latitude: 45.123499, longitude: 19.654399 }], selectedId: 'b' }); await ready();
  expect(markers()).toHaveLength(1); expect(words()).toContain('1, 2');
  expect(mockJump).toHaveBeenCalledWith(expect.objectContaining({ center: [19.65, 45.12], zoom: 10 }));
  expect(mockFit).not.toHaveBeenCalled();
  await act(async () => markers()[0].props.onPress()); expect(mockSelect).toHaveBeenCalledWith('b');
});

it.each([false, true])('shows only a plain place pin, standing on its point, for one valid displayed point (coarse=%s)', async coarse => {
  await render({ coarse, points: [{ ...first, latitude: NaN }, second] }); await ready();
  const marker = markers()[0];
  // The owner, 8 Oct 2026: "običan pin mesta" and not the app's mark. Its tip is the place, so it stands on the point (anchor bottom).
  const pin = marker.findAllByType('FactArt' as React.ElementType);
  expect(pin).toHaveLength(1); expect(pin[0].props.kind).toBe('pin'); expect(pin[0].props.size).toBe(40);
  expect(marker.props.anchor).toBe('bottom');
  expect(marker.findAllByType('T' as React.ElementType)).toHaveLength(0);
  expect(marker.findByProps({ accessible: true }).props.accessibilityLabel).toContain('2. Isporuka');
  await act(async () => marker.props.onPress());
  expect(mockSelect).toHaveBeenCalledWith('b');
});

it('fills the bounded parent and refits the same map to actual resized geometry while credits stay scrollable', async () => {
  await render({ height: 'fill', testID: 'expanded-map' }); await ready();
  const map = maps()[0];
  const session = tree.root.findAllByType('View' as React.ElementType).find(node => node.props.testID === 'expanded-map')!;
  const frame = tree.root.findByProps({ testID: 'location-overview-frame' });
  const credits = tree.root.findByProps({ testID: 'location-overview-credits' });
  for (const node of [session.parent!.parent!, session, frame]) {
    expect(StyleSheet.flatten(node.props.style)).toMatchObject({ flex: 1, minHeight: 0 });
    expect(StyleSheet.flatten(node.props.style).height).toBeUndefined();
  }
  expect(StyleSheet.flatten(credits.props.style)).toMatchObject({ flexGrow: 0, flexShrink: 1, maxHeight: '50%' });
  expect(credits.findAllByType('Press' as React.ElementType).map(link => link.props.accessibilityLabel))
    .toEqual(LOCATION_MAP_CREDITS.map(credit => credit.text));
  mockFit.mockClear();
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 240, height: 120 } } }));
  expect(maps()[0]).toBe(map);
  expect(mockFit).toHaveBeenLastCalledWith([19.654321, 44.812345, 20.432109, 45.123456], {
    padding: { top: 30, bottom: 30, left: 52, right: 52 }, duration: 0,
  });
  mockFit.mockClear();
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 240, height: 120 } } }));
  expect(mockFit).not.toHaveBeenCalled();
});

it('keeps the OpenFreeMap credit as one small line inside the corner of a preview, not as a text under the map', async () => {
  await render({ height: 280 }); await ready();
  const frame = tree.root.findByProps({ testID: 'location-overview-frame' });
  const credits = frame.findByProps({ testID: 'location-overview-credits' });
  // Inside the map's own frame and over its corner, so the map is the last thing on the page; it takes no touch that is not on a link.
  expect(credits.props.pointerEvents).toBe('box-none'); expect(StyleSheet.flatten(credits.props.style)).toMatchObject({ position: 'absolute' });
  const links = credits.findAllByType('Press' as React.ElementType);
  expect(links.map(link => link.props.accessibilityLabel)).toEqual(LOCATION_MAP_CREDITS.map(credit => credit.text));
  // Fine print: it does not grow with the system's text size, so the three links stay on one line.
  for (const text of credits.findAllByType('T' as React.ElementType)) expect(text.props.maxFontSizeMultiplier).toBe(1);
});

it('does not refit for equal refreshed rows and disables preview gestures and selection', async () => {
  await render(); await ready(); mockFit.mockClear();
  await update({ points: initial.points.map(point => ({ ...point })), interactive: false });
  expect(mockFit).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled();
  expect(maps()[0].props).toMatchObject({ dragPan: false, touchZoom: false, doubleTapZoom: false, doubleTapHoldZoom: false, touchPitch: false, touchRotate: false });
  await act(async () => markers()[0].props.onPress()); expect(mockSelect).not.toHaveBeenCalled();
});

it('centers a deliberately selected coarse stop, preserves its pan on equal props, then fits all on deselection', async () => {
  await render({ coarse: true }); await ready(); mockFit.mockClear();
  await update({ coarse: true, selectedId: 'b' });
  expect(mockJump).toHaveBeenCalledTimes(1);
  expect(mockJump).toHaveBeenLastCalledWith({ center: [20.43, 44.81], zoom: 10,
    padding: { top: 52, bottom: 52, left: 52, right: 52 } });
  expect(mockFit).not.toHaveBeenCalled();
  await update({ coarse: true, selectedId: 'b', points: initial.points.map(point => ({ ...point })), onSelectPoint: () => undefined });
  expect(mockJump).toHaveBeenCalledTimes(1); expect(mockFit).not.toHaveBeenCalled();
  await update({ coarse: true });
  expect(mockJump).toHaveBeenCalledTimes(1);
  expect(mockFit).toHaveBeenCalledTimes(1);
  expect(mockFit).toHaveBeenLastCalledWith([19.65, 44.81, 20.43, 45.12], expect.objectContaining({ duration: 0 }));
});

it('never creates a fallback pin for empty or invalid geometry and preserves source stop numbers', async () => {
  await render({ points: [] }); expect(maps()).toHaveLength(0); expect(words()).toContain('Nema potvrđenih tačaka');
  await update({ points: [{ ...first, latitude: NaN }, { ...second, longitude: 181 }] }); expect(maps()).toHaveLength(0);
  expect(overviewDisplayPoints([{ ...first, latitude: NaN }, second], true)).toEqual([{ ...second, latitude: 44.81, longitude: 20.43, number: 2 }]);
  await update({ points: [{ ...first, latitude: NaN }, second] });
  expect(markers()).toHaveLength(1); expect(words()).toContain('Neka mesta nemaju potvrđenu tačku');
});

it('repeats an explicit camera action without remounting or resetting an ordinary refreshed map', async () => {
  await render({ cameraIntent: 0 }); await ready(); const map = maps()[0]; mockFit.mockClear();
  await update({ cameraIntent: 1 });
  expect(mockFit).toHaveBeenCalledTimes(1);
  await update({ cameraIntent: 2 });
  expect(mockFit).toHaveBeenCalledTimes(2);
  await update({ cameraIntent: 2, points: initial.points.map(point => ({ ...point })) });
  expect(mockFit).toHaveBeenCalledTimes(2);
  await update({ cameraIntent: 3, selectedId: 'b' });
  await update({ cameraIntent: 4, selectedId: 'b' });
  expect(mockJump).toHaveBeenCalledTimes(2);
  expect(maps()[0]).toBe(map);
});

it('waits for the style, times out, retries explicitly, and rejects late success from the retired map', async () => {
  mockStyle = null; await render(); expect(maps()).toHaveLength(0);
  mockStyle = 'https://tiles.openfreemap.org/styles/positron'; await update(); const old = maps()[0].props;
  await act(async () => jest.advanceTimersByTime(15_000)); expect(words()).toContain('Mapa nije učitana');
  expect(maps()).toHaveLength(1);
  await act(async () => tree.root.findByType('Action' as React.ElementType).props.onPress());
  await act(async () => { old.onDidFinishLoadingMap(); old.onDidFailLoadingMap(); });
  expect(words()).toContain('Učitavamo mapu');
  expect(maps()).toHaveLength(1); await ready();
  await act(async () => old.onDidFailLoadingMap()); expect(maps()).toHaveLength(1);
});

it('retains the current overview behind its deadline notice and recovers only on real load success', async () => {
  await render(); const current = maps()[0];
  await act(async () => jest.advanceTimersByTime(15_001));
  expect(maps()[0]).toBe(current); expect(words()).toContain('Mapa nije učitana');
  await act(async () => markers()[0].props.onPress()); expect(mockSelect).not.toHaveBeenCalled();
  await act(async () => current.props.onDidFinishLoadingMap());
  expect(maps()[0]).toBe(current); expect(words()).not.toContain('Mapa nije učitana');
  await act(async () => markers()[0].props.onPress()); expect(mockSelect).toHaveBeenCalledWith(first.id);
});

it('an actual overview error after its display deadline unmounts and cannot be revived by late success', async () => {
  await render(); const callbacks = maps()[0].props;
  await act(async () => jest.advanceTimersByTime(15_001));
  await act(async () => { callbacks.onDidFailLoadingMap(); callbacks.onDidFinishLoadingMap(); });
  expect(maps()).toHaveLength(0); expect(words()).toContain('Mapa nije učitana');
});

it('treats a native loading failure as terminal for that attempt and gates logout before a rerender', async () => {
  await render(); const old = maps()[0].props;
  await act(async () => old.onDidFailLoadingMap()); expect(maps()).toHaveLength(0);
  await act(async () => old.onDidFinishLoadingMap()); expect(words()).toContain('Mapa nije učitana');
  await act(async () => tree.root.findByType('Action' as React.ElementType).props.onPress()); await ready();
  const select = markers()[0].props.onPress;
  mockSession = { user: null, accountRevision: 2 };
  await act(async () => select()); expect(mockSelect).not.toHaveBeenCalled();
  await update(); expect(maps()).toHaveLength(0);
});

it.each(['blur', 'scope', 'geometry-ABA', 'account-ABA', 'background'] as const)('retires native callbacks and point selection after %s', async change => {
  await render(); await ready(); const oldMap = maps()[0].props, oldMarker = markers()[0].props;
  if (change === 'blur') { mockFocused = false; await update(); expect(maps()).toHaveLength(0); mockFocused = true; await update(); }
  else if (change === 'scope') await update({ scopeKey: 'account-a:other:rev2' });
  else if (change === 'geometry-ABA') { await update({ points: [second] }); await update(); }
  else if (change === 'account-ABA') {
    mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
    mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
  } else {
    await act(async () => { mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background')); });
    expect(maps()).toHaveLength(0);
    await act(async () => { mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active')); });
  }
  await act(async () => { oldMarker.onPress(); oldMap.onDidFinishLoadingMap(); oldMap.onDidFailLoadingMap(); });
  expect(mockSelect).not.toHaveBeenCalled(); expect(words()).toContain('Učitavamo mapu');
  await ready(); expect(maps()).toHaveLength(1);
});

it.each([
  { height: 280, failure: 'rejection' }, { height: 280, failure: 'synchronous throw' },
  { height: 'fill', failure: 'rejection' }, { height: 'fill', failure: 'synchronous throw' },
] as const)('keeps all official credits reachable and reports a current link $failure at height $height', async ({ height, failure }) => {
  jest.spyOn(Linking, 'openURL').mockImplementation(() => {
    if (failure === 'synchronous throw') throw new Error('offline');
    return Promise.reject(new Error('offline'));
  });
  await render({ height }); const links = tree.root.findAllByType('Press' as React.ElementType);
  expect(links.map(link => link.props.accessibilityLabel)).toEqual(LOCATION_MAP_CREDITS.map(credit => credit.text));
  await act(async () => links[0].props.onPress());
  expect(Linking.openURL).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
  expect(words()).toContain('Veza ka izvoru mape nije otvorena');
  if (height === 'fill') expect(tree.root.findByProps({ testID: 'location-overview-credits' })
    .findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
});

it('web fallback discloses no coordinates and imports no rendered native map', async () => {
  await act(async () => { tree = create(<WebOverview {...initial} />); });
  expect(maps()).toHaveLength(0); expect(words()).toContain('Mapa je dostupna u mobilnoj aplikaciji');
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456');
});
