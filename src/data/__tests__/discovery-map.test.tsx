import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MarketplaceItem, PublicViewport } from '../marketplaceView';
import type { NearbyCameraTarget } from '../../ui/v2/DiscoveryMap.types';
import { Linking, StyleSheet } from 'react-native';
let mockFocused = true, mockReduced = false, mockRetain = false;
let mockPackage: string | undefined = 'rs.uskoci.preview';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));
const mockExpand = jest.fn(), mockEase = jest.fn(), mockJump = jest.fn(), mockZoom = jest.fn(), mockFit = jest.fn();
const mockNearbyLoad = jest.fn();
jest.mock('../../ui/v2/discovery/nearbyLocation', () => ({ loadNearbyLocation: () => mockNearbyLoad() }));
jest.mock('@maplibre/maplibre-react-native', () => {
 const React = require('react');
 return { Map: 'NativeMap', Images: 'Images', Layer: 'Layer', ViewAnnotation: 'Annotation',
 Camera: React.forwardRef((props: any, ref: any) => { React.useImperativeHandle(ref, () => ({ easeTo: mockEase, jumpTo: mockJump, zoomTo: mockZoom, fitBounds: mockFit })); return React.createElement('Camera', props); }),
 GeoJSONSource: React.forwardRef(({ children, ...props }: any, ref: any) => { React.useImperativeHandle(ref, () => ({ getClusterExpansionZoom: mockExpand })); return React.createElement('Source', props, children); }) };
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } }); });
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { AREA_SETTLE_MS, DiscoveryMap, NEARBY_ZOOM } from '../../ui/v2/DiscoveryMap';
import { clearBandBounds, latitudeAtRow, MIN_CLEAR_BAND, rowOfLatitude } from '../../ui/v2/discovery/mapClearBand';
import { DiscoveryMap as WebMap } from '../../ui/v2/DiscoveryMap.web';
import { sys } from '../../ui/system/tokens';
import { useNearbyMap } from '../../ui/v2/discovery/useNearbyMap';
const row = (id = 'one', lat = 0, lng = 0) => ({ id, naslov: 'Privatan naslov van source properties', priblizno: { lat, lng } } as MarketplaceItem);
let rows = [row()], key = 'owner:1', viewport: PublicViewport | null = null, selectedId: string | null = null;
let nearby: NearbyCameraTarget | null = null;
const select = jest.fn(), setViewport = jest.fn(), search = jest.fn(), list = jest.fn(), clear = jest.fn();
const userIntent = jest.fn();
function Screen() { return <DiscoveryMap canRetainMap={() => mockRetain} items={rows} scopeKey={key} viewport={viewport} selectedId={selectedId} centerNearby={nearby} onSelect={select} onViewport={setViewport} onArea={search} onList={list} onClear={clear} onUserIntent={userIntent} />; }
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const native = () => tree.root.findByType('NativeMap' as React.ElementType);
const source = () => tree.root.findAll(node => String(node.type) === 'Source' && node.props.id === 'public-needs')[0];
const sources = () => tree.root.findByProps({ accessibilityLabel: 'Izvori mape: © OpenStreetMap, © OpenMapTiles, OpenFreeMap' });
const sourceData = () => JSON.parse(source().props.data);
const ready = async () => act(async () => {
 tree.root.find(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function')
  .props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } });
 native().props.onDidFinishLoadingMap();
});
const region = { center: [0, 0], zoom: 4, bounds: [-1, -1, 1, 1] };
const cluster = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { cluster: true, cluster_id: 7 } };
const pressFeature = async (features: unknown[]) => act(async () => source().props.onPress({ nativeEvent: { features }, stopPropagation: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); nearby = null; rows = [row()]; key = 'owner:1'; viewport = null; selectedId = null; mockFocused = true; mockReduced = false; mockRetain = false; mockPackage = 'rs.uskoci.preview'; for (const fn of [mockExpand, mockEase, mockJump, mockZoom, mockFit, select, setViewport, search, list, clear]) fn.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
test('native clustering contains only rounded existing public points; zero is admitted', async () => {
 rows = [row(), row('two', 45.25444, 19.83444), { id: 'absent' } as MarketplaceItem]; await render();
 expect(source().props.cluster).toBe(true); expect(sourceData().features).toHaveLength(2);
 expect(sourceData().features[0].geometry.coordinates).toEqual([0, 0]); expect(sourceData().features[1].geometry.coordinates).toEqual([19.83, 45.25]);
 expect(sourceData().features[0].properties).toEqual({ needId: 'one' }); expect(source().props.data).not.toContain('Privatan');
});
test('only an existing current public ID selects; unknown and malformed features are rejected', async () => {
 await render(); await ready(); const feature = sourceData().features[0]; await pressFeature([feature]); expect(select).toHaveBeenCalledWith('one'); select.mockClear();
 await pressFeature([{ ...feature, properties: { needId: 'unknown' } }]);
 for (const coordinates of [[181, 0], [0, 91], [NaN, 0], [0], null]) await pressFeature([{ ...feature, geometry: { type: 'Point', coordinates } }]);
 await pressFeature([]); expect(select).not.toHaveBeenCalled();
});
test('rendered geometry resolves only the owned ID; selected pin keeps the canonical coarse point', async () => {
 rows = [row('novi-sad', 45.25444, 19.83444)]; await render(); await ready();
 const feature = sourceData().features[0];
 await pressFeature([{ ...feature, geometry: { type: 'Point', coordinates: [19.830093383789, 45.249960548] } }]);
 expect(select).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledWith('novi-sad');
 selectedId = 'novi-sad'; await update();
 expect(tree.root.findByType('Annotation' as React.ElementType).props.lngLat).toEqual([19.83, 45.25]);
 expect(rows[0]).toMatchObject({ priblizno: { lat: 45.25444, lng: 19.83444 } });
});
test('pin selection reuses the identical encoded public payload without serializing its collection again', async () => {
 rows = [row('first', 45.25444, 19.83444), row('second', 44.81234, 20.46123)];
 const stringify = jest.spyOn(JSON, 'stringify');
 const encodes = () => stringify.mock.calls.filter(([value]) => value?.type === 'FeatureCollection').length;
 await render(); await ready();
 const payload = source().props.data, features = sourceData().features;
 expect(typeof payload).toBe('string');
 expect(sourceData()).toEqual({ type: 'FeatureCollection', features: [
  { type: 'Feature', id: 'first', geometry: { type: 'Point', coordinates: [19.83, 45.25] }, properties: { needId: 'first' } },
  { type: 'Feature', id: 'second', geometry: { type: 'Point', coordinates: [20.46, 44.81] }, properties: { needId: 'second' } },
 ] });
 const initialEncodes = encodes(); expect(initialEncodes).toBe(1);
 for (const feature of features) {
  await pressFeature([feature]); selectedId = feature.properties.needId; await update();
  expect(select).toHaveBeenLastCalledWith(selectedId);
  expect(tree.root.findByType('Annotation' as React.ElementType).props.lngLat).toEqual(feature.geometry.coordinates);
  expect(source().props.data).toBe(payload); expect(encodes()).toBe(initialEncodes);
 }
});
test.each(['dataset', 'account', 'blur', 'remote'])('old rendered pin cannot select after %s changes', async kind => {
 await render(); await ready(); const callback = source().props.onPress, feature = sourceData().features[0];
 if (kind === 'dataset') rows = [row('new', 45, 19)];
 if (kind === 'account') key = 'owner:2';
 if (kind === 'blur') mockFocused = false;
 if (kind === 'remote') rows = [{ ...row(), detalji: { rezimLokacije: 'REMOTE' } } as MarketplaceItem];
 await update();
 await act(async () => callback({ nativeEvent: { features: [feature] }, stopPropagation: jest.fn() }));
 expect(select).not.toHaveBeenCalled();
});
test('cluster expands installed v11 cluster ID; reduced motion jumps without animation', async () => {
 mockReduced = true; mockExpand.mockResolvedValue(11); await render(); await ready(); await pressFeature([cluster]);
 expect(mockExpand).toHaveBeenCalledWith(7); expect(mockJump).toHaveBeenCalledWith({ center: [0, 0], zoom: 11 }); expect(mockEase).not.toHaveBeenCalled();
});
test.each(['dataset', 'account', 'blur'])('late cluster result is discarded after %s retires', async kind => {
 let resolve!: (value: number) => void; mockExpand.mockReturnValue(new Promise<number>(done => { resolve = done; })); await render(); await ready(); await pressFeature([cluster]);
 if (kind === 'dataset') rows = [row('new', 45, 19)]; if (kind === 'account') key = 'owner:2'; if (kind === 'blur') mockFocused = false; await update();
 await act(async () => resolve(10)); expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
});
// Discovery V47: the list follows the map. Critique B8's "Pretraži ovu oblast" pill (and the button before it) is gone:
// a move of the person's own settles, the map waits AREA_SETTLE_MS, and hands up exactly the settled bounds. What the old
// tests guarded still holds: the camera's own moves never become an area, the area is exactly the settled viewport, and a
// malformed native region offers nothing.
const moved = (value: object) => ({ nativeEvent: { ...value, userInteraction: true } });
const wait = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

test('manual pan supersedes publication before area settlement; automatic and departed callbacks do not', async () => {
 userIntent.mockClear(); await render(); await ready();
 await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: false } }));
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 expect(userIntent).not.toHaveBeenCalled();
 const oldWillChange = native().props.onRegionWillChange;
 await act(async () => oldWillChange(moved(region)));
 expect(userIntent).toHaveBeenCalledTimes(1); expect(search).not.toHaveBeenCalled();
 mockFocused = false; await update(); mockFocused = true; await update();
 await act(async () => oldWillChange(moved(region)));
 expect(userIntent).toHaveBeenCalledTimes(1);
});
test('a move of the person\'s own settles, and after a short wait the list follows exactly the bounds the map shows', async () => {
 await render(); await ready();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(0);
 // The camera's own settle (a fit, a chosen pin) is remembered as where the map stands, and is never an area.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region })); expect(setViewport).toHaveBeenCalledWith(region);
 await wait(5_000); expect(search).not.toHaveBeenCalled();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS - 1); expect(search).not.toHaveBeenCalled();
 await wait(1); expect(search).toHaveBeenCalledTimes(1);
 // With nothing over the map (no tools, no sheet, no card) what the person sees is the whole view: the list and the map read the same bounds.
 expect(search).toHaveBeenCalledWith(region.bounds, region.bounds);
 expect(AREA_SETTLE_MS).toBe(450);
 // A malformed region offers nothing.
 await act(async () => native().props.onRegionDidChange(moved({ ...region, bounds: [-181, -1, 1, 1] })));
 await wait(AREA_SETTLE_MS * 2); expect(search).toHaveBeenCalledTimes(1);
});
test('a pan in several strokes asks once, for where it ended; taking hold of the map again restarts the wait', async () => {
 await render(); await ready();
 const second = { ...region, bounds: [0, 0, 2, 2] }, third = { ...region, bounds: [1, 1, 3, 3] };
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS - 100);
 await act(async () => native().props.onRegionDidChange(moved(second)));
 await wait(AREA_SETTLE_MS - 100); expect(search).not.toHaveBeenCalled();
 await wait(100); expect(search.mock.calls).toEqual([[second.bounds, second.bounds]]);
 // The person takes hold of the map before the wait is over: that settle was not where they stopped.
 await act(async () => native().props.onRegionDidChange(moved(third)));
 await act(async () => native().props.onRegionWillChange(moved(third)));
 await wait(AREA_SETTLE_MS * 2); expect(search).toHaveBeenCalledTimes(1);
 // The app's own move starting does not cancel a wait of the person's.
 await act(async () => native().props.onRegionDidChange(moved(third)));
 await act(async () => native().props.onRegionWillChange({ nativeEvent: { ...third, userInteraction: false } }));
 await wait(AREA_SETTLE_MS); expect(search.mock.calls).toEqual([[second.bounds, second.bounds], [third.bounds, third.bounds]]);
});
test('a cluster tap or "moja lokacija" counts as the person\'s move; a chosen pin brought into view never does', async () => {
 await render(); await ready(); await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 // A cluster tap flies the camera in by the app's hand; the map reports that settle as the app's, and where it lands is the person's.
 mockExpand.mockResolvedValue(9); await pressFeature([cluster]);
 const opened = { ...region, zoom: 9, bounds: [-0.1, -0.1, 0.1, 0.1] };
 await act(async () => native().props.onRegionDidChange({ nativeEvent: opened })); await wait(AREA_SETTLE_MS);
 expect(search.mock.calls).toEqual([[opened.bounds, opened.bounds]]);
 // The intent is used once: the next settle of the app's own is not the person's.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region })); await wait(AREA_SETTLE_MS * 2);
 expect(search).toHaveBeenCalledTimes(1);
 // "Moja lokacija" moves the camera by the app's hand too (the person asked for it), and the list follows where it settles.
 nearby = { key: 1, center: [0.2, 0.2] }; await update();
 const here = { ...region, zoom: 12, center: [0.2, 0.2], bounds: [0.15, 0.15, 0.25, 0.25] };
 await act(async () => native().props.onRegionDidChange({ nativeEvent: here })); await wait(AREA_SETTLE_MS);
 expect(search.mock.calls[1]).toEqual([here.bounds, here.bounds]);
 // A pin brought into view by the camera (a chosen pin) is never the person's move, however recent the last one was.
 selectedId = 'one'; await update();
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, bounds: [-0.2, -0.2, 0.2, 0.2] } }));
 await wait(AREA_SETTLE_MS * 2); expect(search).toHaveBeenCalledTimes(2);
 // An intent too old to be this settle's is not carried over either.
 selectedId = null; await update();
 mockExpand.mockResolvedValue(9); await pressFeature([cluster]); await wait(5_000);
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, bounds: [-3, -3, 3, 3] } })); await wait(AREA_SETTLE_MS);
 expect(search.mock.calls.filter(([bounds]) => JSON.stringify(bounds) === JSON.stringify([-3, -3, 3, 3]))).toHaveLength(0);
});
// Review of V47 (coverage): the wait after a move of the person's own belongs to the map that is on screen. A map taken
// away, or a screen left for another one, never hands an area up to the list afterwards.
test('the area wait never fires after the map is unmounted or while its screen is not in front', async () => {
 await render(); await ready();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS - 1);
 await act(async () => tree.unmount());
 await wait(AREA_SETTLE_MS * 2); expect(search).not.toHaveBeenCalled();
 // Blurred: the screen is still mounted under the one in front, and its map no longer owns the list.
 await render(); await ready();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 mockFocused = false; await update();
 await wait(AREA_SETTLE_MS * 2); expect(search).not.toHaveBeenCalled();
 // Back in front, a move of the person's own is followed again.
 mockFocused = true; await update(); await ready();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS); expect(search).toHaveBeenCalledTimes(1);
});
test('a tap on the empty map closes whatever card is open', async () => {
 await render(); await ready();
 await act(async () => native().props.onPress({ nativeEvent: {} }));
 expect(clear).toHaveBeenCalledTimes(1);
});
test('the region the camera settles into on first load is known without being remembered', async () => {
 // The region event that the initial camera fit produces arrives before the map reports itself ready, and it
 // used to be discarded — and nothing else produces a viewport.
 await render();
 // The camera fit settles, and the map has not called itself ready yet.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 // Not remembered: a position seen while the map is still loading must never become the viewport
 // a person returns to.
 expect(setViewport).not.toHaveBeenCalled();
 await ready();
 // That first region is the camera's own and never becomes the list's area.
 await wait(AREA_SETTLE_MS * 2); expect(search).not.toHaveBeenCalled();
 // And from ready on, where the person moves the map is remembered as before, and the list follows it.
 await act(async () => native().props.onRegionDidChange(moved(region)));
 expect(setViewport).toHaveBeenCalledWith(region);
 await wait(AREA_SETTLE_MS);
 expect(search).toHaveBeenCalledWith(region.bounds, region.bounds);
});
test('display deadline stays retryable, while actual success of the same current native map recovers without a remount', async () => {
 viewport = region as PublicViewport; await render(); const current = native(), late = current.props.onDidFinishLoadingMap;
 expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ bounds: region.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
 await act(async () => jest.advanceTimersByTime(15_001));
 expect(tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' })).toBeTruthy();
 await act(async () => current.props.onDidFinishRenderingFrameFully());
 expect(tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' })).toBeTruthy();
 await act(async () => late());
 expect(native()).toBe(current); expect(tree.root.findAllByProps({ label: 'Pokušaj ponovo sa mapom' })).toHaveLength(0);
 expect(sources()).toBeTruthy();
 expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ bounds: region.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
});
test.each(['retry', 'account', 'blur', 'unmount'])('late success of a %s-retired map cannot acknowledge its replacement', async retirement => {
 viewport = region as PublicViewport; await render(); const old = native().props;
 await act(async () => jest.advanceTimersByTime(15_001));
 if (retirement === 'retry') await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' }).props.onPress());
 if (retirement === 'account') { key = 'owner:2'; await update(); }
 if (retirement === 'blur') { mockFocused = false; await update(); mockFocused = true; await update(); }
 if (retirement === 'unmount') { await act(async () => tree.unmount()); await render(); }
 await act(async () => { old.onDidFinishLoadingMap(); old.onDidFinishRenderingFrameFully(); old.onDidFailLoadingMap(); });
 expect(tree.root.findAllByProps({ label: 'Pokušaj ponovo sa mapom' })).toHaveLength(0);
 expect(tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('Učitavamo mapu…'))).toHaveLength(1);
 await ready(); expect(sources()).toBeTruthy();
 expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ bounds: region.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
});
test.each([false, true])('an actual native error remains terminal even when display deadline already fired: %s', async afterDeadline => {
 await render(); const callbacks = native().props;
 if (afterDeadline) await act(async () => jest.advanceTimersByTime(15_001));
 await act(async () => { callbacks.onDidFailLoadingMap(); callbacks.onDidFinishLoadingMap(); callbacks.onDidFinishRenderingFrameFully(); });
 expect(tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' })).toBeTruthy();
});
test('a web build without development has no map: it says so and offers the list, and draws no sketch', async () => {
 const dev = (global as { __DEV__?: boolean }).__DEV__; (global as { __DEV__?: boolean }).__DEV__ = false;
 try {
  await act(async () => { tree = create(<WebMap items={rows} scopeKey={key} selectedId={null} viewport={null} onSelect={select} onViewport={setViewport} onArea={search} onList={list} />); });
  expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'discovery-map-sketch' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ label: 'Pogledaj listu' }).props.onPress()); expect(list).toHaveBeenCalledTimes(1);
 } finally { (global as { __DEV__?: boolean }).__DEV__ = dev; }
});
test('in development the web build draws a SKETCH of a map for the design lab: pins that select, the same furniture, never a real map', async () => {
 rows = [row('a', 45.25, 19.83), row('b', 45.27, 19.86)];
 await act(async () => { tree = create(<WebMap items={rows} scopeKey={key} selectedId={null} viewport={null} onSelect={select} onViewport={setViewport} onArea={search} onList={list} onClear={clear} />); });
 expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
 await act(async () => tree.root.findByProps({ testID: 'discovery-map-sketch' }).props.onLayout({ nativeEvent: { layout: { width: 361, height: 780 } } }));
 // one pin per public point, each a button that selects its own task; a tap on the ground closes a card; the sources stand in the same row as on the phone
 const pins = tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Privatan naslov van source properties');
 expect(pins).toHaveLength(2);
 await act(async () => pins[0].props.onPress()); expect(select).toHaveBeenCalledWith('a');
 await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mapa približnih lokacija zadatka' }).props.onPress()); expect(clear).toHaveBeenCalledTimes(1);
 expect(tree.root.findByProps({ accessibilityLabel: 'Izvori mape: © OpenStreetMap, © OpenMapTiles, OpenFreeMap' }).props.accessibilityRole).toBe('button');
 expect(tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('Skica mape za laboratoriju'))).toHaveLength(1);
});
// The owner's phone of 8 Oct 2026: no + and − on the map (it is zoomed with two fingers, as the map apps people know are); only "moja lokacija" stays, and the
// screen draws it. The map offers no zoom control and no longer asks for a zoom level of its own.
test('the map has no zoom buttons: it is zoomed with two fingers, and nothing of it calls the camera\'s zoom', async () => {
 await render(); await ready(); await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Uvećaj mapu' })).toHaveLength(0);
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Umanji mapu' })).toHaveLength(0);
 expect(tree.root.findAllByProps({ testID: 'discovery-map-zoom' })).toHaveLength(0);
 expect(mockZoom).not.toHaveBeenCalled();
 // two fingers and a double tap are the SDK's own; the app turns off only what it does not use
 expect(native().props).toMatchObject({ touchPitch: false, touchRotate: false });
});
test('a cluster flies at the camera pace when motion is allowed', async () => {
 mockExpand.mockResolvedValue(9); await render(); await ready(); await pressFeature([cluster]);
 expect(mockEase).toHaveBeenCalledWith({ center: [0, 0], zoom: 9, duration: sys.motion.camera }); expect(mockJump).not.toHaveBeenCalled();
});
test('DEV map diagnostic emits only six deduplicated names and elapsed time without changing native-error refusal', async () => {
 mockPackage = 'rs.uskoci.dev'; const log = jest.spyOn(console, 'info').mockImplementation(() => {});
 await render(); const callbacks = native().props;
 await act(async () => { jest.advanceTimersByTime(15_001); });
 await act(async () => {
  callbacks.onDidFinishLoadingMap(); callbacks.onDidFinishLoadingMap();
  callbacks.onDidFinishRenderingFrameFully(); callbacks.onDidFinishRenderingFrameFully();
  callbacks.onDidFailLoadingMap(); callbacks.onDidFailLoadingMap();
 });
 expect(tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' })).toBeTruthy();
 await act(async () => tree.unmount());
 const events = log.mock.calls.map(args => {
  expect(args).toHaveLength(1); expect(args[0]).toMatch(/^\[USKOCI_MAP_LOAD\] /);
  const value = JSON.parse(args[0].slice('[USKOCI_MAP_LOAD] '.length));
  expect(value).toHaveLength(2); expect(Number.isInteger(value[1]) && value[1] >= 0).toBe(true); return value[0];
 });
 expect(events).toEqual(['map-mounted', 'deadline', 'map-loaded', 'frame-fully', 'native-error', 'retired']);
});
test.each(['rs.uskoci', 'rs.uskoci.preview', 'another.dev', undefined])('DEV map diagnostic stays silent for package %s', async appPackage => {
 mockPackage = appPackage; const log = jest.spyOn(console, 'info').mockImplementation(() => {});
 await render(); await ready(); await act(async () => native().props.onDidFailLoadingMap());
 await act(async () => tree.unmount()); expect(log).not.toHaveBeenCalled();
});

// "Moja lokacija" (the owner, 8 Oct 2026: "da se mapa fiksira i prikažu zadaci oko mene"): the camera goes to the person at the zoom of a neighbourhood, with
// the person in the middle of the clear part of the map (the padding of every other camera move), and, being the person's own request, the list follows where it
// settles. The person is never a pin or a stored place: the public points the map draws are the tasks' alone.
test.each([false, true])('"Moja lokacija" centers once at a neighbourhood zoom in the clear part of the map, and the list follows (reduced motion: %s)', async reduced => {
  mockReduced = reduced; await render(); await ready();
  await act(async () => native().props.onRegionDidChange(moved(region)));
  await wait(AREA_SETTLE_MS); search.mockClear();
  nearby = { key: 1, center: [20.412345, 44.812345] }; await update();
  // the room the tools above (none here) and the list below (the first fit's 56) leave: 26 over the pin's half, 24 and 56 under, 50 each side
  const options = { center: nearby.center, zoom: NEARBY_ZOOM, padding: { top: 26, right: 50, bottom: 80, left: 50 } };
  expect(NEARBY_ZOOM).toBe(12);
  if (reduced) { expect(mockJump).toHaveBeenCalledWith(options); expect(mockEase).not.toHaveBeenCalled(); }
  else { expect(mockEase).toHaveBeenCalledWith({ ...options, duration: sys.motion.camera }); expect(mockJump).not.toHaveBeenCalled(); }
  await update(); expect((reduced ? mockJump : mockEase)).toHaveBeenCalledTimes(1);
  const here = { ...region, center: nearby.center, zoom: 12, bounds: [20.37, 44.78, 20.45, 44.84] };
  await act(async () => native().props.onRegionDidChange({ nativeEvent: here }));
  // the move was asked for by the person, so the list follows it: the tasks around them (the map's area, never a pin and never a filter)
  await wait(AREA_SETTLE_MS - 1); expect(search).not.toHaveBeenCalled();
  await wait(1); expect(search).toHaveBeenCalledTimes(1); expect(search).toHaveBeenCalledWith(here.bounds, here.bounds);
  expect(select).not.toHaveBeenCalled();
  expect(sourceData().features[0].geometry.coordinates).toEqual([0, 0]);
  expect(source().props.data).not.toContain('20.412345');
});
test('the person\'s dot is drawn as one native point for as long as the screen says where they are, and is never one of the tasks\' public points', async () => {
  rows = [row('a', 45.25, 19.83)]; await render(); await ready();
  const meSources = () => tree.root.findAll(node => String(node.type) === 'Source' && node.props.id === 'me');
  expect(meSources()).toHaveLength(0);
  const me = (): { type: string; geometry: { coordinates: number[] } } => JSON.parse(meSources()[0].props.data);
  await act(async () => tree.update(<DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={null} me={[20.4, 44.8]} onSelect={select} onViewport={setViewport} onArea={search} onList={list} />));
  expect(me()).toMatchObject({ type: 'Feature', geometry: { type: 'Point', coordinates: [20.4, 44.8] } });
  expect(tree.root.findAllByProps({ id: 'me-dot' })).toHaveLength(1);
  expect(tree.root.findByProps({ id: 'me-dot' }).props.paint['circle-color']).toBe(sys.color.artRole.location.front);
  // the tasks' own source is untouched by it
  expect(sourceData().features).toHaveLength(1); expect(sourceData().features[0].properties).toEqual({ needId: 'a' });
  await act(async () => tree.update(<DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={null} me={null} onSelect={select} onViewport={setViewport} onArea={search} onList={list} />));
  expect(meSources()).toHaveLength(0);
});
test('Nearby waits for map readiness and does not move a blurred map', async () => {
  nearby = { key: 2, center: [20.4, 44.8] }; await render(); expect(mockEase).not.toHaveBeenCalled();
  await ready(); expect(mockEase).toHaveBeenCalledTimes(1);
  mockFocused = false; nearby = { key: 3, center: [19.8, 45.2] }; await update(); expect(mockEase).toHaveBeenCalledTimes(1);
});
test('Nearby then manual pan then refresh/remount restores the pan without replaying location', async () => {
  let receive!: (value: { timestamp: number; coords: { latitude: number; longitude: number } }) => void;
  const remove = jest.fn();
  mockNearbyLoad.mockResolvedValue({ Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: async () => ({ granted: true }),
    hasServicesEnabledAsync: async () => true, watchPositionAsync: async (_options: unknown, next: typeof receive) => { receive = next; return { remove }; } });
  let capture!: ReturnType<typeof useNearbyMap>, visible = true;
  // Real hook + real DiscoveryMap: the hook survives the map being removed during a read, like DiscoveryPresentation.
  function NearbyScreen() {
    capture = useNearbyMap(key, mockFocused);
    const [saved, save] = React.useState<PublicViewport | null>(null);
    return visible ? <DiscoveryMap items={rows} scopeKey={key} viewport={saved} selectedId={null} centerNearby={capture.target}
      onNearbyConsumed={capture.consume} onSelect={select} onViewport={save} onArea={search} onList={list} /> : null;
  }
  await act(async () => { tree = create(<NearbyScreen />); }); await ready();
  await act(async () => { capture.start(); });
  await act(async () => receive({ timestamp: Date.now(), coords: { latitude: 44.8, longitude: 20.4 } }));
  expect(mockEase).toHaveBeenCalledTimes(1); expect(capture.target).toBeNull(); expect(remove).toHaveBeenCalledTimes(1);
  const elsewhere: PublicViewport = { center: [19.8, 45.2], zoom: 10, bounds: [19.7, 45.1, 19.9, 45.3] };
  await act(async () => native().props.onRegionDidChange(moved(elsewhere)));
  visible = false; await act(async () => tree.update(<NearbyScreen />));
  visible = true; await act(async () => tree.update(<NearbyScreen />));
  expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ bounds: elsewhere.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  await ready(); expect(mockEase).toHaveBeenCalledTimes(1); expect(mockJump).not.toHaveBeenCalled(); expect(capture.target).toBeNull();
});
test('the map\'s sources are one small line in the bottom left corner above the list, with no box and a touch of 44, not a competing scrolling rail', async () => {
  await render(); await ready();
  expect(native().props.attribution).toBe(false);
  const control = sources();
  expect(control.props.accessibilityRole).toBe('button');
  expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(44);
  expect(tree.root.findAll(node => node.props.persistentScrollbar)).toHaveLength(0);
  // the words: both required names, 12 px, in ONE line, quiet, and drawn without a box (no background of their own; a halo only)
  const words = control.findAllByType('T' as React.ElementType)[0];
  expect(words.children).toEqual(['© OpenStreetMap · © OpenMapTiles']);
  expect(words.props.variant).toBe('label'); expect(words.props.numberOfLines).toBe(1);
  const style = StyleSheet.flatten(words.props.style);
  expect(style.backgroundColor).toBeUndefined(); expect(style.color).toBe(sys.color.muted);
  expect(sys.type.label.fontSize).toBeGreaterThanOrEqual(12);
  // the row they stand in is the one above the list: left, with the right kept for "moja lokacija" when the screen draws it
  const row = tree.root.findByProps({ testID: 'discovery-map-credits' });
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ position: 'absolute', left: sys.space.base });
  await act(async () => tree.update(<DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={null} locateShown onSelect={select} onViewport={setViewport} onArea={search} onList={list} />));
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'discovery-map-credits' }).props.style).right).toBe(sys.space.base + 44 + 8);
});

// P5 exercises the real camera boundary, never fake GPS or area filtering.
const workAreaTarget = { key: 'saved-work-area', bounds: [19.5, 45, 20.2, 45.6] as [number, number, number, number] };
function workAreaPage(extra: Record<string, unknown> = {}) {
  return <DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={selectedId}
    onSelect={select} onViewport={setViewport} onArea={search} onList={list} onUserIntent={userIntent}
    {...{ initialWorkArea: workAreaTarget, ...extra }} />;
}
test('P5 work-area: the saved footprint fits once without becoming a filter, a pin or GPS', async () => {
  const handled = jest.fn();
  await act(async () => { tree = create(workAreaPage({ onInitialWorkAreaHandled: handled })); }); await ready();
  expect(mockFit).toHaveBeenLastCalledWith(workAreaTarget.bounds, expect.objectContaining({ duration: 0 }));
  expect(handled).toHaveBeenCalledWith(workAreaTarget.key);
  expect(search).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  expect(sourceData().features).toHaveLength(rows.length);
  const calls = mockFit.mock.calls.length;
  await act(async () => tree.update(workAreaPage({ onInitialWorkAreaHandled: handled })));
  expect(mockFit).toHaveBeenCalledTimes(calls); expect(handled).toHaveBeenCalledTimes(1);
});
test('P5 work-area: late layout delays the fit instead of consuming an unperformed request', async () => {
  await act(async () => { tree = create(workAreaPage()); });
  await act(async () => native().props.onDidFinishLoadingMap());
  expect(mockFit).not.toHaveBeenCalled(); await ready();
  expect(mockFit).toHaveBeenLastCalledWith(workAreaTarget.bounds, expect.anything());
});
test('P5 work-area: a remembered viewport wins over the optional seed', async () => {
  viewport = { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9] };
  await act(async () => { tree = create(workAreaPage()); }); await ready();
  expect(mockFit).not.toHaveBeenCalled();
  expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState.bounds).toEqual(viewport.bounds);
});
test('P5 work-area: manual pan before readiness wins over a delayed seed', async () => {
  await act(async () => { tree = create(workAreaPage()); });
  await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } })); await ready();
  expect(mockFit).not.toHaveBeenCalled();
});
test('P5 work-area: a selected task keeps priority and no invented point enters GeoJSON', async () => {
  selectedId = rows[0].id;
  await act(async () => { tree = create(workAreaPage({ publicationCameraToken: 'publication' })); }); await ready();
  expect(mockFit.mock.calls.some(([bounds]) => JSON.stringify(bounds) === JSON.stringify(workAreaTarget.bounds))).toBe(false);
  expect(sourceData().features.every((feature: any) => feature.properties.needId !== workAreaTarget.key)).toBe(true);
});

// Retained native identity is independent from each permanently retired focus owner.
test('ready task-detail return keeps native instance while old async cluster and pan callbacks stay retired', async () => {
 mockRetain = true;
 let resolve!: (value: number) => void;
 mockExpand.mockReturnValue(new Promise<number>(done => { resolve = done; }));
 await render(); await ready();
 const mapBefore = native(), oldRegion = mapBefore.props.onRegionDidChange;
 await pressFeature([cluster]);
 await act(async () => oldRegion(moved(region)));
 mockFocused = false; await update();
 mockFocused = true; await update();
 expect(native()).toBe(mapBefore);
 setViewport.mockClear(); search.mockClear();
 await act(async () => { resolve(10); oldRegion(moved(region)); });
 await wait(AREA_SETTLE_MS * 2);
 expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled();
 expect(setViewport).not.toHaveBeenCalled(); expect(search).not.toHaveBeenCalled();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS);
 expect(search).toHaveBeenCalledTimes(1);
});

test.each(['loading', 'failed', 'not-detail', 'account'])('retention cannot reuse native map after %s', async reason => {
 mockRetain = true; await render();
 if (reason !== 'loading') await ready();
 const mapBefore = native();
 if (reason === 'failed') await act(async () => native().props.onDidFailLoadingMap());
 if (reason === 'not-detail') mockRetain = false;
 mockFocused = false; await update();
 if (reason === 'account') key = 'account:2';
 mockFocused = true; await update();
 expect(native()).not.toBe(mapBefore);
});

test('native failure while a retained detail is on top prevents reuse on return', async () => {
 mockRetain = true; await render(); await ready(); const mapBefore = native();
 mockFocused = false; await update();
 await act(async () => mapBefore.props.onDidFailLoadingMap());
 mockFocused = true; await update();
 expect(native()).not.toBe(mapBefore);
});

// Audit fix 2: the list follows the part of the map the person can see. The map is north-up and unpitched, so a row of pixels is one latitude.
describe('the clear band between the search tools and the sheet', () => {
  const view = [20.3, 44.7, 20.5, 44.9] as [number, number, number, number];
  test('rows and latitudes are each other\'s inverse, and the edges of the view are its bounds', () => {
    expect(rowOfLatitude(view, 800, 44.9)).toBeCloseTo(0, 9); expect(rowOfLatitude(view, 800, 44.7)).toBeCloseTo(800, 9);
    for (const row of [0, 60, 333, 500, 800]) expect(rowOfLatitude(view, 800, latitudeAtRow(view, 800, row))).toBeCloseTo(row, 6);
    // Web Mercator: the middle row is not the middle latitude.
    expect(latitudeAtRow(view, 800, 400)).not.toBeCloseTo(44.8, 6);
  });
  test('the band keeps the width and each uncovered edge exactly, and a band too thin to mean anything is the whole view', () => {
    expect(clearBandBounds(view, 800, 60, 500)).toEqual([20.3, 44.775081, 20.5, 44.885024]);
    expect(clearBandBounds(view, 800, 0, 800)).toBe(view);
    expect(clearBandBounds(view, 800, 0, 500)).toEqual([20.3, 44.775081, 20.5, 44.9]);
    expect(clearBandBounds(view, 800, 60, 60 + MIN_CLEAR_BAND - 1)).toBe(view);
    expect(clearBandBounds(view, 0, 60, 500)).toBe(view);
    expect(clearBandBounds(view, 800, -20, 900)).toBe(view);
  });
});
