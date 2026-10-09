import React from 'react';
import { Image, Linking, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { publicInitialBounds, type MarketplaceItem, type PublicViewport } from '../marketplaceView';
// The map suites mount the whole native map stand-in many times under fake timers; on a loaded developer machine (Metro, other agents) one test can pass Jest's 5 s while the waits it pins are in fake time.
jest.setTimeout(30000);
let mockFocused = true, mockReduced = false, mockRendered: unknown[] = [], mockLeaves: unknown[] = [];
const mockExpand = jest.fn(), mockEase = jest.fn(), mockJump = jest.fn(), mockZoom = jest.fn(), mockProject = jest.fn(), mockUnproject = jest.fn(), mockFit = jest.fn(), mockQuery = jest.fn();
const mockAnnotationRefresh = jest.fn();
let mockPackage: string | undefined = 'com.example';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const host = (name: string, handle: () => object) => React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, handle); return React.createElement(name, props, children);
  });
  return { Layer: 'Layer', Images: 'Images', ViewAnnotation: host('Annotation', () => ({ refresh: mockAnnotationRefresh })),
    Map: host('NativeMap', () => ({ queryRenderedFeatures: mockQuery, project: mockProject, unproject: mockUnproject })),
    Camera: host('Camera', () => ({ easeTo: mockEase, jumpTo: mockJump, zoomTo: mockZoom, fitBounds: mockFit })),
    GeoJSONSource: host('Source', () => ({ getClusterExpansionZoom: mockExpand, getClusterLeaves: async () => mockLeaves })) };
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } }); });
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
// The shared Jest stand-in for Reanimated, with one change: an animated style is worked out on every render and a shared
// value keeps its value, so fixed controls and their physical sheet-coverage boundary can be read.
jest.mock('react-native-reanimated', () => {
  const React = require('react'), shared = jest.requireActual('../../../__mocks__/react-native-reanimated');
  return { ...shared, useSharedValue: (value: unknown) => React.useRef({ value }).current, useAnimatedStyle: (updater: () => object) => updater() };
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/system/ActionSheet', () => ({ ActionSheet: 'MapSources' }));
import { DiscoveryMap, PillAnnotation, PILL_LIMIT } from '../../ui/v2/DiscoveryMap';
import { DISCOVERY_V1_PIN_IMAGES, PIN_CHOSEN_SCALE, PIN_ICON_SIZE } from '../../ui/v2/discovery/DiscoveryV1ServerMarkerLayer';
import { PricePill } from '../../ui/v2/discovery/PricePill';
import { BrandMark } from '../../ui/entry/BrandAssets';
import { noTaskRelations, taskRelationIndex } from '../taskRelation';
import { sys } from '../../ui/system/tokens';
import { expression, latest, type StylePropertySpecification } from '@maplibre/maplibre-gl-style-spec';

/**
 * The Zadaci map's pins (owner step 4, 2026-09-24; critique B10). The native source still carries only IDs and rounded
 * points; the map says which pins stand on their own at this zoom, and those become price pills drawn from the current
 * read. Tasks rounded to one public point are one place that can be reached, and a chosen pin is brought into view.
 */
const row = (id: string, lat: number, lng: number, patch: Record<string, unknown> = {}) => ({ id, naslov: `Posao ${id}`, rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, priblizno: { lat, lng }, pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 },
  uslovi: [], podrucjeTekst: 'Beograd', vremeTekst: 'Po dogovoru', ...patch } as unknown as MarketplaceItem);
const HITNO = { urgency: { level: 'HITNO', expiresAt: '2999-01-01T00:00:00Z' } };
const base = () => [row('money', 44.81, 20.46), row('offer', 44.83, 20.41, { rezimCene: 'OFFERS', ponudjenaCena: undefined }),
  row('stack-1', 44.79, 20.45), row('stack-2', 44.7904, 20.4498), row('urgent', 44.80, 20.50, HITNO), row('noprice', 44.85, 20.40, { ponudjenaCena: undefined })];
const feature = (needId: string) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { needId } });
let rows = base(), selectedId: string | null = null, selectedPlace: string | null = null, extra: Record<string, unknown> = {};
const select = jest.fn(), selectPlace = jest.fn(), setViewport = jest.fn(), search = jest.fn(), list = jest.fn(), clear = jest.fn(), fitted = jest.fn();
function Screen() {
  return <DiscoveryMap items={rows} scopeKey="a:1" viewport={null as PublicViewport | null} selectedId={selectedId} selectedPlace={selectedPlace}
    onSelect={select} onSelectPlace={selectPlace} onViewport={setViewport} onArea={search} onList={list} onClear={clear} onFitted={fitted} {...extra} />;
}
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const native = () => tree.root.findByType('NativeMap' as React.ElementType);
const source = () => tree.root.findByType('Source' as React.ElementType);
const sourceData = () => JSON.parse(source().props.data);
const annotations = () => tree.root.findAllByType('Annotation' as React.ElementType);
const pills = () => tree.root.findAllByType(PricePill).map(pill => pill.props);
const ready = async () => act(async () => { native().props.onDidFinishLoadingMap(); });
const measureFrame = async (height = 790) => act(async () => tree.root.find(node => String(node.type) === 'View'
  && typeof node.props.onLayout === 'function').props.onLayout({ nativeEvent: { layout: { width: 400, height } } }));
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style);
beforeEach(() => {
  jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = base(); selectedId = null; selectedPlace = null; extra = {}; mockFocused = true; mockReduced = false; mockPackage = 'com.example';
  mockRendered = ['money', 'offer', 'stack-1', 'stack-2', 'urgent', 'noprice', 'money'].map(feature); mockLeaves = [];
  mockQuery.mockReset().mockImplementation(async () => mockRendered);
  mockAnnotationRefresh.mockReset();
  for (const fn of [mockExpand, mockEase, mockJump, mockZoom, mockProject, mockUnproject, mockFit, select, selectPlace, setViewport, search, list, clear, fitted]) fn.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('the small brand mark sends distinct enamel stops to native SVG without invalid offset warnings', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await act(async () => { tree = create(<BrandMark size={24} />); });
  const gradients = tree.root.findAll(node => typeof node.type === 'string' && Array.isArray(node.props.gradient));
  const offsets = Object.fromEntries(gradients.map(node => [String(node.props.name).split('-').at(-1),
    node.props.gradient.filter((_: number, index: number) => index % 2 === 0)]));
  expect(offsets).toEqual({ green: [0, 0.21, 0.57, 0.86, 1], orange: [0, 0.22, 0.58, 0.88, 1],
    rim: [0, 0.38, 0.68, 1], light: [0, 0.32, 1] });
  expect(warn.mock.calls.flat().join(' ')).not.toContain('not a valid number or percentage string');
});

test('pins that stand alone become price pills; the native source still holds only IDs and rounded points', async () => {
  await render(); await ready();
  expect(sourceData().features.map((item: { properties: object }) => item.properties)).toEqual(rows.map(item => ({ needId: item.id })));
  expect(source().props.data).not.toMatch(/RSD|Ponude|Posao/);
  expect(source().props.cluster).toBe(true);
  // One pill per public point: the duplicate rendered feature and the second task of the stack add none.
  expect(annotations()).toHaveLength(5);
  expect(pills().map(pill => [pill.content.text, pill.content.tone, !!pill.urgent])).toEqual([
    ['6.000 RSD', 'money', false], ['Ponude', 'offer', false], ['2 zadatka', 'count', false], ['6.000 RSD', 'money', true], ['', 'none', false]]);
});

test('a word about money never wears the money colour or weight; the amount does; HITNO keeps its danger cue', async () => {
  const draw = async (content: React.ComponentProps<typeof PricePill>['content'], urgent = false) => {
    let pill!: ReactTestRenderer; await act(async () => { pill = create(<PricePill content={content} urgent={urgent} />); });
    const words = pill.root.findAllByType('T' as React.ElementType)[0];
    const frame = pill.root.findByProps({ testID: 'price-pill' });
    return { words: words && flat(words), variant: words?.props.variant, frame: flat(frame), lightning: pill.root.findAllByType('Lightning' as React.ElementType) };
  };
  const money = await draw({ text: '6.000 RSD', tone: 'money', spoken: '6.000 RSD' });
  // The size is the system's meta (13) through the text variant, never a size written by hand; the line is set tighter.
  expect(money.variant).toBe('meta');
  expect(money.words).toMatchObject({ color: sys.color.money, fontWeight: '600', lineHeight: 16 });
  expect(money.words.fontSize).toBeUndefined();
  expect(money.frame).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.line });
  const offer = await draw({ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' });
  expect(offer.words.color).toBe(sys.color.muted); expect(offer.words.color).not.toBe(sys.color.money); expect(offer.words.fontWeight).not.toBe('600');
  const none = await draw({ text: '', tone: 'none', spoken: 'Cena nije navedena' });
  expect(none.words).toBeUndefined();
  const urgent = await draw({ text: '6.000 RSD', tone: 'money', spoken: '6.000 RSD' }, true);
  expect(urgent.frame.borderColor).toBe(sys.color.danger); expect(urgent.lightning[0].props.color).toBe(sys.color.danger);
  let chosen!: ReactTestRenderer; await act(async () => { chosen = create(<PricePill content={{ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' }} selected />); });
  expect(flat(chosen.root.findByProps({ testID: 'price-pill' }))).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.orangeHalo });
  expect(flat(chosen.root.findAllByType('T' as React.ElementType)[0]).color).toBe(sys.color.orangeInk);
});

test('positive account relations label individual pins without putting private overlay facts into public GeoJSON', async () => {
  extra = { relations: taskRelationIndex([
    { needId: 'money', relation: 'OWNER' },
    { needId: 'offer', relation: 'APPLIED', applicationId: 'private-application-id', applicationState: 'SUBMITTED' },
    { needId: 'stack-1', relation: 'OWNER' },
  ], rows.map(item => item.id)) };
  await render(); await ready();
  const byText = (text: string) => pills().find(pill => pill.content.text === text)!;
  expect(byText('6.000 RSD').relation).toBe('OWNED');
  expect(byText('Ponude').relation).toBe('APPLIED');
  expect(byText('2 zadatka').relation).toBeUndefined();
  const labels = annotations().flatMap(node => node.findAll(child => String(child.type) === 'View' && child.props.accessibilityLabel)
    .map(child => child.props.accessibilityLabel));
  expect(labels.some(label => label.includes('Tvoj zadatak'))).toBe(true);
  expect(labels.some(label => label.includes('Prijava je već poslata'))).toBe(true);
  expect(source().props.data).not.toMatch(/OWNED|OWNER|APPLIED|private-application|relation/);
  // Retiring the account overlay removes both badges; UNKNOWN never becomes a guess about ownership/application.
  extra = { relations: noTaskRelations }; await update();
  expect(pills().every(pill => pill.relation === undefined)).toBe(true);
});

test('selected urgent own task keeps selection, urgency and relationship distinct; a shared point has no individual badge', async () => {
  extra = { relations: taskRelationIndex([{ needId: 'urgent', relation: 'OWNER' }], rows.map(item => item.id)) };
  selectedId = 'urgent'; await render(); await ready();
  const selected = pills().find(pill => pill.selected);
  expect(selected).toMatchObject({ urgent: true, relation: 'OWNED' });
  const pill = annotations().find(node => node.props.id === 'selected-need')!.findByType(PricePill);
  expect(flat(pill.findByProps({ testID: 'price-pill' }))).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.orangeHalo });
  expect(pill.findAllByProps({ testID: 'pin-relation-OWNED' })).toHaveLength(1);
  selectedId = null; selectedPlace = '44.79,20.45'; await update();
  expect(pills().find(item => item.selected)).toMatchObject({ content: { tone: 'count' } });
  expect(pills().find(item => item.selected)!.relation).toBeUndefined();
});

// Review r3 item 8: the native side keys annotations by id. An id that stayed `pill-<point>` while the content changed let
// an insert-before-remove in one commit leave a dead pill; the id now changes with what the pill says, as its key does.
test('a pill\'s native id changes with what it says, as its key does', async () => {
  await render(); await ready();
  const ids = () => annotations().map(node => String(node.props.id));
  expect(ids()).toContain('pill-44.81,20.46-6.000 RSD-false');
  expect(ids()).toContain('pill-44.80,20.50-6.000 RSD-true');
  rows = rows.map(item => item.id === 'money' ? { ...item, ponudjenaCena: { iznos: 7000, valuta: 'RSD', prikaz: '7.000 RSD' } } as MarketplaceItem : item);
  await update(); await act(async () => { jest.advanceTimersByTime(400); });
  expect(ids()).toContain('pill-44.81,20.46-7.000 RSD-false'); expect(ids()).not.toContain('pill-44.81,20.46-6.000 RSD-false');
  expect(new Set(ids()).size).toBe(ids().length);
});

test('pressing a pill chooses its task, and a pill several tasks share chooses the place', async () => {
  await render(); await ready();
  const byText = (text: string) => annotations().find(node => node.findByType(PricePill).props.content.text === text)!;
  await act(async () => byText('Ponude').props.onPress()); expect(select).toHaveBeenCalledWith('offer');
  await act(async () => byText('2 zadatka').props.onPress()); expect(selectPlace).toHaveBeenCalledWith('44.79,20.45'); expect(select).toHaveBeenCalledTimes(1);
});

test('the chosen task or place is one green pill of its own at the canonical point', async () => {
  await render(); await ready();
  selectedId = 'money'; await update();
  const chosen = annotations().filter(node => node.props.id === 'selected-need');
  expect(chosen).toHaveLength(1); expect(chosen[0].props.lngLat).toEqual([20.46, 44.81]);
  expect(chosen[0].findByType(PricePill).props).toMatchObject({ selected: true, content: { text: '6.000 RSD', tone: 'money' } });
  // Since review r3 item 8 a pill's native id carries its content, as its React key does; the chosen point has none.
  expect(annotations().filter(node => String(node.props.id).startsWith('pill-44.81,20.46'))).toHaveLength(0);
  selectedId = null; selectedPlace = '44.79,20.45'; await update();
  const place = annotations().find(node => node.props.id === 'selected-place')!;
  expect(place.findByType(PricePill).props).toMatchObject({ selected: true, content: { text: '2 zadatka', tone: 'count' } });
});

test('a cluster that is only one stacked point opens the place instead of zooming to a spot where one pin hides the other', async () => {
  await render(); await ready();
  const cluster = { type: 'Feature', geometry: { type: 'Point', coordinates: [20.45, 44.79] }, properties: { cluster: true, cluster_id: 3, point_count: 2 } };
  mockLeaves = [feature('stack-1'), feature('stack-2')];
  await act(async () => source().props.onPress({ nativeEvent: { features: [cluster] }, stopPropagation: jest.fn() }));
  expect(selectPlace).toHaveBeenCalledWith('44.79,20.45'); expect(mockExpand).not.toHaveBeenCalled();
  // A cluster of different points still opens by zooming in.
  mockLeaves = [feature('stack-1'), feature('money')]; mockExpand.mockResolvedValue(14);
  await act(async () => source().props.onPress({ nativeEvent: { features: [cluster] }, stopPropagation: jest.fn() }));
  expect(mockExpand).toHaveBeenCalledWith(3); expect(selectPlace).toHaveBeenCalledTimes(1);
});

test('selecting a public pin from a regional view frames its neighborhood without using old-zoom projection or changing area', async () => {
  const viewport = { center: [20.45, 44.8], zoom: 6, bounds: [16, 41, 25, 48] };
  extra = { viewport, toolsBottom: 60, focusBottom: 300 };
  rows[0] = row('money', 44.81444, 20.46444);
  await render(); await measureFrame(800); await ready();
  // Both an already-debounced pan and an immediately preceding pinch must not leak into selection's area intent.
  await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...viewport, userInteraction: true } }));
  selectedId = 'money'; await update();
  // The pin is framed clear of the tools above (the pill and its capsules, 60) by half a pin, and above the card below (300) by a gap.
  expect(mockEase).toHaveBeenCalledWith({ center: [20.46, 44.81], zoom: 12,
    padding: { top: 86, right: 50, bottom: 324, left: 50 }, duration: sys.motion.camera });
  expect(mockProject).not.toHaveBeenCalled(); expect(mockUnproject).not.toHaveBeenCalled();
  expect(rows[0].priblizno).toEqual({ lat: 44.81444, lng: 20.46444 });
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.46, 44.81], zoom: 12,
    bounds: [20.4, 44.78, 20.5, 44.85], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).not.toHaveBeenCalled();
  // Changing the sheet, rows or layout after this single selection is not another request to move the camera.
  rows = [...rows, row('later', 45.25, 19.83)];
  extra = { ...extra, toolsBottom: 90, focusBottom: 90 }; await update(); await measureFrame(600);
  expect(mockEase).toHaveBeenCalledTimes(1); expect(mockFit).not.toHaveBeenCalled();
});

test('the cluster font survives the Android string-array expression bridge', async () => {
  await render();
  const layout = tree.root.findByProps({ id: 'need-cluster-count' }).props.layout;
  // MLRNStyleValue marks a string-first array as an expression, even for text-font. Use the installed real parser:
  // the previous bare ['Noto Sans Regular'] fails here as an unknown expression, despite valid full-style JSON.
  // The library exports raw JSON with widened strings; its parser expects the narrower specification type.
  const fontSpec = latest.layout_symbol['text-font'] as unknown as StylePropertySpecification;
  const font = expression.createPropertyExpression(layout['text-font'], 'text-font', fontSpec);
  expect(font.result).toBe('success');
  if (font.result !== 'success') throw new Error(font.value.map(error => error.message).join('; '));
  expect(font.value.evaluate({ zoom: 8 })).toEqual(['Noto Sans Regular']);
  expect(expression.createPropertyExpression(['Noto Sans Regular'], 'text-font', fontSpec).result).toBe('error');
});

test('the native fallback survives failed rich-pin discovery and fits under a successful pill without a second ring', async () => {
  mockQuery.mockRejectedValueOnce(new Error('native query failed'));
  await render(); await ready();
  expect(annotations()).toHaveLength(0);
  const fallback = () => tree.root.findByProps({ id: 'need-pins' }).props;
  expect(fallback().filter).toEqual(['!', ['has', 'point_count']]);
  expect(tree.root.findByProps({ id: 'need-pin-marks' }).props.layout['icon-image']).toBe('uskoci-task');
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(annotations()).toHaveLength(5);
  const outerDiameter = 2 * (fallback().paint['circle-radius'] + fallback().paint['circle-stroke-width']);
  const pillHeight = flat(tree.root.findAllByProps({ testID: 'price-pill' })[0]).minHeight;
  expect(outerDiameter).toBeLessThan(pillHeight);
  // No optimistic hide filter: every unclustered source point remains drawn if its annotation is missing or fails.
  expect(fallback().filter).toEqual(['!', ['has', 'point_count']]);
  expect(source().props.hitbox).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
});

test.each(['saved', 'native'])('a newly selected pin preserves a closer %s zoom', async kind => {
  extra = { viewport: { center: [19.83, 45.25], zoom: kind === 'saved' ? 15 : 6, bounds: [19.8, 45.2, 19.9, 45.3] } };
  await render(); await measureFrame(); await ready();
  if (kind !== 'saved') await act(async () => native().props.onRegionDidChange({ nativeEvent: {
    center: [20.45, 44.8], zoom: 14.5, bounds: [20.44, 44.79, 20.46, 44.81], userInteraction: false,
  } }));
  selectedId = 'money'; await update();
  expect(mockEase).toHaveBeenCalledWith(expect.objectContaining({ center: [20.46, 44.81], zoom: kind === 'saved' ? 15 : 14.5 }));
});

test('a stacked public point receives one neighborhood frame with bounded padding and no animation under Reduce Motion', async () => {
  mockReduced = true; extra = { toolsBottom: 250, focusBottom: 300 };
  await render(); await measureFrame(460); await ready();
  selectedPlace = '44.79,20.45'; await update();
  expect(mockJump).toHaveBeenCalledTimes(1);
  expect(mockJump).toHaveBeenCalledWith(expect.objectContaining({ center: [20.45, 44.79], zoom: 12 }));
  const options = mockJump.mock.calls[0][0];
  expect(460 - options.padding.top - options.padding.bottom).toBeGreaterThanOrEqual(96);
  expect(options.duration).toBeUndefined(); expect(mockEase).not.toHaveBeenCalled();
});

test('a selection restored with a saved viewport does not become a new camera request', async () => {
  selectedId = 'money'; extra = { viewport: { center: [20.44, 44.8], zoom: 15, bounds: [20.4, 44.7, 20.5, 44.9] }, cameraLayoutReady: false };
  await render(); await measureFrame(); await ready();
  extra = { ...extra, cameraLayoutReady: true }; await update();
  expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled(); expect(mockFit).not.toHaveBeenCalled();
});

// R13: the old constructor froze a 534dp pre-layout bottom estimate on a 790dp map. Top199 + bottom558
// left only33dp to fit the local pins. The measured sheet is395dp, not half the entire phone window.
test('initial framing waits for native readiness, frame and measured overlays, then fits once without changing search area', async () => {
  extra = { cameraLayoutReady: false, toolsBottom: 124, fitBottom: 534 };
  await render();
  const provisional = tree.root.findByType('Camera' as React.ElementType).props.initialViewState;
  expect(provisional.padding).toEqual({ top: 24, right: 50, bottom: 24, left: 50 });
  await ready(); expect(mockFit).not.toHaveBeenCalled();
  await measureFrame(); expect(mockFit).not.toHaveBeenCalled();
  const viewport = { center: [20.45, 44.8], zoom: 12, bounds: [20.4, 44.7, 20.5, 44.9] };
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...viewport, userInteraction: false } }));
  expect(setViewport).not.toHaveBeenCalled();
  extra = { cameraLayoutReady: true, toolsBottom: 124, fitBottom: 467 }; await update();
  expect(mockFit).toHaveBeenCalledTimes(1);
  expect(mockFit).toHaveBeenCalledWith(publicInitialBounds(rows), {
    padding: { top: 150, right: 50, bottom: 491, left: 50 }, duration: 0, // half a pin clear of the tools (124) over the top, a gap and the row of furniture over the bottom
  });
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...viewport, userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(setViewport).toHaveBeenCalledWith(viewport); expect(search).not.toHaveBeenCalled();
  // Later data, tools, sheet positions and rotation are not permission to steal the camera again.
  rows = [...rows, row('later', 45.25, 19.83)];
  extra = { cameraLayoutReady: true, toolsBottom: 60, fitBottom: 76 }; await update(); await measureFrame(820);
  expect(mockFit).toHaveBeenCalledTimes(1);
});

test('very large overlay measurements leave a usable initial fit window instead of the native one-pixel clamp', async () => {
  extra = { cameraLayoutReady: true, toolsBottom: 250, fitBottom: 300 };
  await render(); await measureFrame(460); await ready();
  const padding = mockFit.mock.calls[0][1].padding;
  expect(460 - padding.top - padding.bottom).toBeGreaterThanOrEqual(96);
  expect(padding.top).toBeGreaterThan(0); expect(padding.bottom).toBeGreaterThan(0);
  expect(search).not.toHaveBeenCalled();
});

test('saved visible bounds survive delayed layout and never receive an automatic initial task fit', async () => {
  const viewport = { center: [19.83, 45.25], zoom: 14, bounds: [19.8, 45.2, 19.9, 45.3] };
  extra = { viewport, cameraLayoutReady: false, toolsBottom: 124, fitBottom: 534 };
  await render(); await measureFrame(); await ready();
  expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ bounds: viewport.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  extra = { ...extra, cameraLayoutReady: true, fitBottom: 467 }; await update();
  expect(mockFit).not.toHaveBeenCalled();
});

test('returning to a narrow saved view restores its observed bounds once, not its padded target or all task points', async () => {
  const viewport = { center: [20.46, 44.81], zoom: 15, bounds: [20.455, 44.795, 20.465, 44.813] };
  selectedId = 'money'; extra = { viewport, cameraLayoutReady: false, toolsBottom: 160, focusBottom: 340 };
  await render(); await measureFrame(620); await ready();
  const initial = tree.root.findByType('Camera' as React.ElementType).props.initialViewState;
  expect(initial).toEqual({ bounds: viewport.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  expect(initial).not.toHaveProperty('center');
  extra = { ...extra, cameraLayoutReady: true, viewport: { ...viewport, bounds: [20.45, 44.79, 20.47, 44.82] } };
  await update(); await measureFrame(640);
  expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toBe(initial);
  expect(mockFit).not.toHaveBeenCalled(); expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled();
  expect(search).not.toHaveBeenCalled();
  expect(sourceData().features[0].geometry.coordinates).toEqual([20.46, 44.81]);
});

test.each(['pan', 'pinch', 'pin', 'nearby', 'fitTo'])('a deliberate %s before layout wins over the pending first fit', async intent => {
  extra = { cameraLayoutReady: false, toolsBottom: 124, fitBottom: 534 };
  await render(); await measureFrame(); await ready();
  const viewport = { center: [20.45, 44.8], zoom: 12, bounds: [20.4, 44.7, 20.5, 44.9] };
  if (intent === 'pan') {
    await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
    await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...viewport, userInteraction: true } }));
  }
  if (intent === 'pinch') {
    await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
    await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...viewport, zoom: 13, userInteraction: true } }));
  }
  if (intent === 'pin') {
    selectedId = 'money'; await update(); expect(mockEase).not.toHaveBeenCalled();
  }
  if (intent === 'nearby') {
    extra = { ...extra, centerNearby: { key: 8, center: [19.84, 45.26] } }; await update();
    // "Moja lokacija": the person in the middle of the map that is left clear between the tools above and the list below, at the zoom of a neighbourhood.
    expect(mockEase).toHaveBeenCalledWith(expect.objectContaining({ center: [19.84, 45.26], zoom: 12, duration: sys.motion.camera }));
    const { padding } = mockEase.mock.calls[0][0];
    expect(padding.top).toBeGreaterThan(100); expect(790 - padding.top - padding.bottom).toBeGreaterThanOrEqual(96);
  }
  if (intent === 'fitTo') {
    extra = { ...extra, fitTo: { key: 9, bounds: [19.8, 45.2, 19.9, 45.3], bottom: 200 } }; await update();
    expect(mockFit).not.toHaveBeenCalled();
  }
  extra = { ...extra, cameraLayoutReady: true, fitBottom: 467 }; await update();
  if (intent === 'fitTo') {
    expect(mockFit).toHaveBeenCalledTimes(1);
    expect(mockFit).toHaveBeenCalledWith([19.8, 45.2, 19.9, 45.3], expect.objectContaining({ duration: sys.motion.camera }));
    expect(fitted).toHaveBeenCalledWith(9);
  } else expect(mockFit).not.toHaveBeenCalled();
  if (intent === 'pin') expect(mockEase).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(2_000); });
  // The list reads what is seen below the tools; the map keeps the whole view.
  if (intent === 'pan' || intent === 'pinch') expect(search).toHaveBeenCalledWith([20.4, 44.7, 20.5, 44.868653], viewport.bounds);
  else expect(search).not.toHaveBeenCalled();
});

test('a selection made before map readiness remains in charge when layout arrives later', async () => {
  extra = { cameraLayoutReady: false, toolsBottom: 124, fitBottom: 534 };
  await render(); selectedId = 'money'; await update();
  expect(mockEase).not.toHaveBeenCalled(); expect(mockFit).not.toHaveBeenCalled();
  await ready();
  expect(mockEase).not.toHaveBeenCalled();
  await measureFrame(); extra = { ...extra, cameraLayoutReady: true, fitBottom: 467 }; await update();
  expect(mockEase).toHaveBeenCalledTimes(1); expect(mockFit).not.toHaveBeenCalled();
  expect(mockEase).toHaveBeenCalledWith(expect.objectContaining({ center: [20.46, 44.81], zoom: 12, duration: sys.motion.camera }));
});

test.each(['pan', 'pinch', 'clear', 'dataset', 'remote', 'scope', 'blur', 'fitTo', 'nearby'])('a pending pin focus cannot take back the camera after %s', async reason => {
  extra = { cameraLayoutReady: false };
  await render(); await ready(); selectedId = 'money'; await update();
  expect(mockEase).not.toHaveBeenCalled();
  if (reason === 'pan') await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
  if (reason === 'pinch') {
    await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
    await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.45, 44.8], zoom: 14,
      bounds: [20.4, 44.7, 20.5, 44.9], userInteraction: true } }));
  }
  if (reason === 'clear') selectedId = null;
  if (reason === 'dataset') rows = [...rows, row('later', 45.25, 19.83)];
  if (reason === 'remote') rows = rows.map(item => item.id === 'money' ? { ...item, detalji: { rezimLokacije: 'REMOTE' } } as MarketplaceItem : item);
  if (reason === 'scope') extra = { ...extra, scopeKey: 'another:2' };
  if (reason === 'blur') mockFocused = false;
  if (reason === 'fitTo') extra = { ...extra, fitTo: { key: 31, bounds: [19.8, 45.2, 19.9, 45.3], bottom: 200 } };
  if (reason === 'nearby') extra = { ...extra, centerNearby: { key: 32, center: [19.84, 45.26] } };
  await update();
  if (reason === 'blur') { mockFocused = true; await update(); }
  await measureFrame(); await ready(); extra = { ...extra, cameraLayoutReady: true }; await update();
  // Other explicit destinations may run; the retired pin must not, including after a later measurement.
  const pinMoves = () => [...mockEase.mock.calls, ...mockJump.mock.calls].filter(([options]) => options.center[0] === 20.46 && options.center[1] === 44.81);
  expect(pinMoves()).toHaveLength(0);
  await measureFrame(820); await update(); expect(pinMoves()).toHaveLength(0);
});

test('only the latest explicit selection survives a wait for measured layout', async () => {
  extra = { cameraLayoutReady: false };
  await render(); await ready(); selectedId = 'money'; await update(); selectedId = 'offer'; await update();
  await measureFrame(); extra = { ...extra, cameraLayoutReady: true }; await update();
  expect(mockEase).toHaveBeenCalledTimes(1);
  expect(mockEase).toHaveBeenCalledWith(expect.objectContaining({ center: [20.41, 44.83], zoom: 12 }));
});

// Latest owner decision: attribution stays fixed at bottom-left; raised sheet/card may cover it.
test.each([false, true])('keeps map sources fixed while the sheet/card move and excludes the covered control (reduced motion: %s)', async reduced => {
  mockReduced = reduced;
  const sheetTop = { value: 600 };
  extra = { sheetTop, toolsBottom: 60, controlsMinTop: 72, creditsBottom: 88 };
  await render();
  const frame = tree.root.find(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }));
  await ready();
  const layer = () => flat(tree.root.findByProps({ testID: 'discovery-map-credits-layer' }));
  const credits = () => tree.root.findByProps({ testID: 'discovery-map-credits' });
  const settle = async () => { await update(); await update(); };
  expect(layer()).toMatchObject({ height: 44, position: 'absolute', bottom: 88 + sys.space.xs });
  expect(layer().transform).toBeUndefined();
  // No zoom buttons: the map is zoomed with two fingers.
  for (const label of ['Uvećaj mapu', 'Umanji mapu']) expect(tree.root.findAllByProps({ accessibilityLabel: label })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'discovery-map-zoom' })).toHaveLength(0);
  expect(flat(credits())).toMatchObject({ position: 'absolute', left: sys.space.base, right: sys.space.base });
  extra = { ...extra, coverBottom: 250 }; await settle();
  expect(layer().bottom).toBe(88 + sys.space.xs);
  extra = { ...extra, coverBottom: 460 }; await settle();
  expect(layer().bottom).toBe(88 + sys.space.xs);
  expect(credits().findAll(node => node.props.accessibilityRole === 'button')).toHaveLength(1);
  expect(credits().findByType('T' as React.ElementType).props.children).toBe('© OpenStreetMap · © OpenMapTiles');
  extra = { ...extra, coverBottom: 0 }; await settle();
  sheetTop.value = 280; await settle();
  expect(layer().bottom).toBe(88 + sys.space.xs);
  extra = { ...extra, creditsCovered: true }; await settle();
  expect(tree.root.findByProps({ testID: 'discovery-map-credits-layer' }).props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true });
  sheetTop.value = 64; await settle(); expect(layer().bottom).toBe(88 + sys.space.xs);
  expect(layer().transform).toBeUndefined();
  expect(select).not.toHaveBeenCalled(); expect(search).not.toHaveBeenCalled();
});

test('the sources are one 44 high touch, and keep clear of "moja lokacija" at the right end of the row when the screen draws it', async () => {
  extra = { sheetTop: { value: 600 }, toolsBottom: 60, controlsMinTop: 72 };
  await render();
  await measureFrame(800); await ready();
  const credits = () => flat(tree.root.findByProps({ testID: 'discovery-map-credits' }));
  expect(credits()).toMatchObject({ position: 'absolute', left: sys.space.base, right: sys.space.base });
  const link = tree.root.findByProps({ accessibilityLabel: 'Izvori mape: © OpenStreetMap, © OpenMapTiles, OpenFreeMap' });
  expect(flat(link).minHeight).toBeGreaterThanOrEqual(44);
  extra = { ...extra, locateShown: true }; await update();
  expect(credits().right).toBe(sys.space.base + 44 + 8);
});

test('with the list full the map is a strip: no gesture, hidden from a screen reader, a tap asks for the half height, and the controls still work', async () => {
  const stripPress = jest.fn();
  extra = { sheetTop: { value: 132 }, toolsBottom: 60, controlsMinTop: 72, locked: false, onStripPress: stripPress };
  await render(); await measureFrame(800); await ready();
  const box = () => tree.root.findByProps({ testID: 'discovery-map-box' });
  expect(box().props).toMatchObject({ pointerEvents: 'auto', accessibilityElementsHidden: false, importantForAccessibility: 'auto' });
  expect(tree.root.findAllByProps({ testID: 'discovery-map-strip' })).toHaveLength(0);
  extra = { ...extra, locked: true }; await update();
  expect(box().props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  const strip = tree.root.findByProps({ testID: 'discovery-map-strip' });
  expect(strip.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Prikaži više mape', accessibilityHint: 'Spušta listu do pola.' });
  await act(async () => strip.props.onPress());
  expect(stripPress).toHaveBeenCalledTimes(1);
  // the strip lies under the sources in the tree, so they keep their own touch
  const order = (testID: string) => tree.root.findAll(node => node.props.testID === testID && typeof node.type === 'string')
    .map(node => tree.root.findAll(other => typeof other.type === 'string').indexOf(node))[0];
  expect(order('discovery-map-strip')).toBeLessThan(order('discovery-map-credits'));
  // the sources keep their place in the row whether the map is locked or not; "moja lokacija" has the right end of it
  expect(flat(tree.root.findByProps({ testID: 'discovery-map-credits' })).right).toBe(sys.space.base);
  extra = { ...extra, locateShown: true }; await update();
  expect(flat(tree.root.findByProps({ testID: 'discovery-map-credits' })).right).toBe(sys.space.base + 44 + 8);
  extra = { ...extra, locked: false }; await update();
  expect(tree.root.findAllByProps({ testID: 'discovery-map-strip' })).toHaveLength(0);
});

test('compact visible attribution opens all three original provider links without a scrolling rail', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(); await ready();
  const credits = tree.root.findByProps({ testID: 'discovery-map-credits' });
  expect(credits.findByType('T' as React.ElementType).props.children).toBe('© OpenStreetMap · © OpenMapTiles');
  await act(async () => credits.findByProps({ accessibilityRole: 'button' }).props.onPress());
  const panel = tree.root.findByType('MapSources' as React.ElementType);
  expect(panel.props.actions.map((action: { label: string }) => action.label)).toEqual(['© OpenStreetMap', '© OpenMapTiles', 'OpenFreeMap']);
  for (const action of panel.props.actions) await act(async () => action.onPress());
  expect(openURL.mock.calls.map(([url]) => url)).toEqual([
    'https://www.openstreetmap.org/copyright', 'https://www.openmaptiles.org/', 'https://openfreemap.org/',
  ]);
  expect(select).not.toHaveBeenCalled(); expect(search).not.toHaveBeenCalled();
});

const annotationLayout = (annotation: ReactTestInstance) => annotation.find(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function').props.onLayout;
const pillSize = { nativeEvent: { layout: { width: 90, height: 48 } } };
test.each(['layout,frame', 'frame,layout'])(
  'vector logo snapshot waits for actual native attachment and layout in order %s, with no image-load event', async sequence => {
    selectedId = 'money'; await render(); await ready();
    const chosen = () => annotations().find(node => node.props.id === 'selected-need')!;
    const events: Record<string, () => void> = {
      layout: () => annotationLayout(chosen())(pillSize),
      frame: native().props.onDidFinishRenderingFrameFully,
    };
    expect(chosen().findByType(BrandMark).props.size).toBeCloseTo(30 * 1.06);
    expect(chosen().findAllByType(Image)).toHaveLength(0);
    const order = sequence.split(',');
    for (let index = 0; index < order.length; index++) {
      await act(async () => events[order[index]]());
      await act(async () => { jest.advanceTimersByTime(20); });
      expect(mockAnnotationRefresh).toHaveBeenCalledTimes(index === order.length - 1 ? 1 : 0);
    }
    expect(native().props.onDidFinishRenderingFrameFully).toBeUndefined();
    // A duplicate queued native frame is harmless; there is no continuing frame subscription/refresh loop.
    await act(async () => { events.frame(); jest.advanceTimersByTime(1000); });
    expect(mockAnnotationRefresh).toHaveBeenCalledTimes(1);
  },
);

test('same selected vector annotation resnapshots on native reattachment without any image-load event', async () => {
  const owns = jest.fn(() => true);
  const draw = (nativeReady: boolean) => <PillAnnotation id="same-selected" point={{ lng: 20.46, lat: 44.81 }}
    label="Izabran zadatak" content={{ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' }} selected nativeReady={nativeReady} owns={owns} />;
  await act(async () => { tree = create(draw(true)); });
  const initialPill = tree.root.findByType(PricePill);
  await act(async () => { annotationLayout(annotations()[0])(pillSize); jest.advanceTimersByTime(20); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(draw(false)));
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(draw(true)));
  await act(async () => { jest.advanceTimersByTime(20); });
  expect(tree.root.findByType(PricePill)).toBe(initialPill);
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(2);
  // If ownership retires between readiness and the draw, its queued snapshot is discarded.
  await act(async () => tree.update(draw(false)));
  await act(async () => tree.update(draw(true)));
  owns.mockReturnValue(false);
  await act(async () => { jest.advanceTimersByTime(20); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(2);
});

test('fresh focus requires its own frame and layout; a retired pin cannot redraw into the new map', async () => {
  selectedId = 'money'; await render(); await ready();
  const chosen = () => annotations().find(node => node.props.id === 'selected-need')!;
  const oldLayout = annotationLayout(chosen()), oldFrame = native().props.onDidFinishRenderingFrameFully;
  await act(async () => { oldLayout(pillSize); oldFrame(); });
  await act(async () => { jest.advanceTimersByTime(20); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(1);
  mockFocused = false; await update(); mockFocused = true; await update(); await ready();
  await act(async () => { oldLayout(pillSize); oldFrame(); jest.advanceTimersByTime(20); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(1);
  await act(async () => { annotationLayout(chosen())(pillSize); });
  await act(async () => { jest.advanceTimersByTime(20); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(1);
  await act(async () => native().props.onDidFinishRenderingFrameFully());
  await act(async () => { jest.advanceTimersByTime(20); });
  expect(mockAnnotationRefresh).toHaveBeenCalledTimes(2);
});

test('zero or invalid vector annotation layout cannot snapshot, and unmount cancels the pending draw', async () => {
  await act(async () => { tree = create(<PillAnnotation id="layout-owned" point={{ lng: 20.46, lat: 44.81 }}
    label="Zadatak" content={{ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' }} nativeReady owns={() => true} />); });
  const layout = annotationLayout(annotations()[0]);
  for (const width of [0, Number.NaN]) {
    await act(async () => { layout({ nativeEvent: { layout: { width, height: 48 } } }); jest.advanceTimersByTime(20); });
    expect(mockAnnotationRefresh).not.toHaveBeenCalled();
  }
  await act(async () => layout(pillSize));
  await act(async () => tree.unmount());
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(mockAnnotationRefresh).not.toHaveBeenCalled();
});

test('many pins stay a bounded number of pills; native logo markers cover the remaining public points', async () => {
  rows = Array.from({ length: 60 }, (_, index) => row(`n${index}`, 44 + index / 50, 20));
  mockRendered = rows.map(item => feature(item.id));
  await render(); await ready();
  expect(annotations()).toHaveLength(PILL_LIMIT);
  const logo = tree.root.findByProps({ id: 'need-pin-marks' });
  expect(logo.props.filter).toEqual(['!', ['has', 'point_count']]);
  expect(logo.props.layout).toMatchObject({ 'icon-image': 'uskoci-task', 'icon-allow-overlap': true, 'icon-ignore-placement': true });
  expect(tree.root.findByType('Images' as React.ElementType).props.images['uskoci-task']).toBeDefined();
  expect(source().props.hitbox).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
});

// Discovery V47 (the selected pin, Airbnb's pattern in USKOČI's look): the chosen pin is the one filled dark-green pill
// with white words; every other stays white, and HITNO keeps its own marker on either.
test('the chosen pin stays white with an orange selection; urgency retains its independent glyph', async () => {
  rows = [...base(), row('hitno-izabran', 44.9, 20.3, HITNO)];
  mockRendered = rows.map(item => feature(item.id));
  await render(); await ready();
  selectedId = 'hitno-izabran'; await update();
  const drawn = tree.root.findAllByType(PricePill);
  expect(drawn.filter(pill => pill.props.selected)).toHaveLength(1);
  const chosen = drawn.find(pill => pill.props.selected)!;
  expect(chosen.props).toMatchObject({ selected: true, urgent: true });
  expect(flat(chosen.findByProps({ testID: 'price-pill' }))).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.orangeHalo });
  expect(flat(chosen.findAllByType('T' as React.ElementType)[0]).color).toBe(sys.color.orangeInk);
  for (const other of drawn.filter(pill => !pill.props.selected)) {
    expect(flat(other.findByProps({ testID: 'price-pill' })).backgroundColor).toBe(sys.color.surface);
  }
});

// A place chosen in the search: the camera brings its pins into view once, as its own move, and says it did. It never
// becomes the list's area, and a map mounted again later does not fly there again.
test('a fit to a chosen place is the camera\'s own move, made once, and never an area', async () => {
  extra = { toolsBottom: 60, fitTo: { key: 1, bounds: [20.4, 44.78, 20.47, 44.82], bottom: 200 } };
  await render();
  expect(mockFit).not.toHaveBeenCalled();
  await ready(); expect(mockFit).not.toHaveBeenCalled();
  await measureFrame(800);
  expect(mockFit).toHaveBeenCalledWith([20.4, 44.78, 20.47, 44.82], { padding: { top: 86, right: 50, bottom: 224, left: 50 }, duration: sys.motion.camera });
  expect(fitted).toHaveBeenCalledWith(1);
  await update(); expect(mockFit).toHaveBeenCalledTimes(1);
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.43, 44.8], zoom: 13, bounds: [20.4, 44.78, 20.47, 44.82], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).not.toHaveBeenCalled();
  // Under reduced motion it jumps.
  await act(async () => tree.unmount()); mockReduced = true; mockFit.mockReset();
  extra = { fitTo: { key: 2, bounds: [20.4, 44.78, 20.47, 44.82], bottom: 100 } }; await render(); await measureFrame(800); await ready();
  expect(mockFit.mock.calls[0][1].duration).toBe(0);
});

test('an explicit fit also waits for measured layout and retains a useful map window at large text', async () => {
  extra = { cameraLayoutReady: false, toolsBottom: 250, fitTo: { key: 17, bounds: [19.8, 45.2, 19.9, 45.3], bottom: 300 } };
  await render(); await ready(); await measureFrame(460);
  expect(mockFit).not.toHaveBeenCalled(); expect(fitted).not.toHaveBeenCalled();
  extra = { ...extra, cameraLayoutReady: true }; await update();
  expect(mockFit).toHaveBeenCalledTimes(1); expect(fitted).toHaveBeenCalledWith(17);
  const [bounds, options] = mockFit.mock.calls[0];
  expect(bounds).toEqual([19.8, 45.2, 19.9, 45.3]);
  expect(460 - options.padding.top - options.padding.bottom).toBeGreaterThanOrEqual(96);
  expect(options.duration).toBe(sys.motion.camera);
  await measureFrame(600); await update(); expect(mockFit).toHaveBeenCalledTimes(1);
});

// Review of V47 (coverage): a "moja lokacija" move marks the next settle as the person's (the list then holds the tasks around them). A fit the app makes right
// after it (a place chosen in the search) is the camera's own move, and its settle must not become the list's area on the earlier move's account.
test('a "moja lokacija" move followed at once by a programmatic fit sets no area', async () => {
  extra = { toolsBottom: 60, viewport: { center: [20.45, 44.8], zoom: 12, bounds: [20.4, 44.7, 20.5, 44.9] } };
  await render(); await measureFrame(800); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.45, 44.8], zoom: 12, bounds: [20.4, 44.7, 20.5, 44.9], userInteraction: false } }));
  extra = { ...extra, centerNearby: { key: 4, center: [19.84, 45.26] } }; await update();
  expect(mockEase).toHaveBeenCalledTimes(1);
  extra = { ...extra, fitTo: { key: 7, bounds: [20.4, 44.78, 20.47, 44.82], bottom: 200 } }; await update();
  expect(mockFit).toHaveBeenCalledTimes(1); expect(fitted).toHaveBeenCalledWith(7);
  // The fit settles (the map says: not the person's), well inside the time a zoom tap counts for.
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.43, 44.8], zoom: 13, bounds: [20.4, 44.78, 20.47, 44.82], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).not.toHaveBeenCalled();
});

// A tap on a pill may also reach the map as a tap on the ground under it; that one is the pill's, not an empty-map tap.
test('a tap on the empty map closes the card; the tap that chose a pill does not', async () => {
  await render(); await ready();
  const byText = (text: string) => annotations().find(node => node.findByType(PricePill).props.content.text === text)!;
  await act(async () => byText('Ponude').props.onPress());
  await act(async () => native().props.onPress({ nativeEvent: {} }));
  expect(select).toHaveBeenCalledWith('offer'); expect(clear).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(500); });
  await act(async () => native().props.onPress({ nativeEvent: {} }));
  expect(clear).toHaveBeenCalledTimes(1);
});

// P6: the server's buckets are native layers of one GeoJSON source (a bitmap annotation per bucket never drew on the emulator). A cluster opens
// the way a native one does (the camera goes into it, and the list and the map follow where it lands); a task or a place moves no camera,
// because the MAP read it came from must keep covering what is on screen.
const layerMarkers = [
  { kind: 'CLUSTER', key: 'cluster:1', point: { lat: 44.8, lng: 20.45 }, taskCount: 5, distinctPointCount: 3, memberBounds: [20.4, 44.78, 20.5, 44.85] },
  { kind: 'TASK', key: 'task:1', point: { lat: 44.9, lng: 20.6 }, taskId: '00000000-0000-4000-8000-000000000001', taskCount: 1 },
  { kind: 'PLACE', key: 'place:44.7:20.3', point: { lat: 44.7, lng: 20.3 }, taskCount: 30 },
];
const press = (key: string) => source().props.onPress({ nativeEvent: { features: [{ properties: { key } }] }, stopPropagation: jest.fn() });
const layerIds = () => tree.root.findAllByType('Layer' as React.ElementType).map(node => node.props.id);
test('the server buckets are one GeoJSON source with their own layers, and the legacy clustering source is not mounted', async () => {
  extra = { p6Server: { markers: layerMarkers, selectedKey: 'task:1', wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() } };
  await render(); await measureFrame(800); await ready();
  expect(source().props.id).toBe('p6-buckets');
  expect(tree.root.findAllByType('Source' as React.ElementType)).toHaveLength(1);
  // Each bucket says only what its capsule shows: its sprite, its count ('' for a task: the capsule is its mark) and its place in the stack.
  // Order: areas under places under single tasks (north under south within a kind).
  expect(JSON.parse(source().props.data).features).toEqual([
    { type: 'Feature', geometry: { type: 'Point', coordinates: [20.45, 44.8] }, properties: { key: 'cluster:1', kind: 'CLUSTER', count: 5, label: '5',
      image: 'p6-pin-count-1', chosenImage: 'p6-pin-count-1-chosen', order: 0 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [20.6, 44.9] }, properties: { key: 'task:1', kind: 'TASK', count: 1, label: '',
      image: 'p6-pin-task', chosenImage: 'p6-pin-task-chosen', order: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [20.3, 44.7] }, properties: { key: 'place:44.7:20.3', kind: 'PLACE', count: 30, label: '30',
      image: 'p6-pin-count-2', chosenImage: 'p6-pin-count-2-chosen', order: 1 } },
  ]);
  expect(JSON.parse(source().props.data).features.every((feature: { properties: object }) => !JSON.stringify(feature.properties).includes('taskId'))).toBe(true);
  expect(source().props.cluster).toBeUndefined();
  // Two layers: every capsule, and the chosen one alone on top of them.
  expect(layerIds()).toEqual(['p6-pins', 'p6-chosen']);
  const layer = (id: string) => tree.root.findAllByType('Layer' as React.ElementType).find(node => node.props.id === id)!;
  expect(layer('p6-pins').props.filter).toEqual(['!=', ['get', 'key'], 'task:1']);
  expect(layer('p6-chosen').props.filter).toEqual(['==', ['get', 'key'], 'task:1']);
  expect(annotations()).toHaveLength(0);
});

// AGENTS §3.6.7: a white capsule, the chosen one 6 % larger with the orange halo and label, drawn above the rest in a stable order, all in
// native layers (no view annotations). Every expression is checked by the installed style parser, as the Android bridge reads it.
test('the P6 pins are white capsules in one ordered layer, and the chosen capsule is 6 % larger on its own top layer', async () => {
  extra = { p6Server: { markers: layerMarkers, selectedKey: 'place:44.7:20.3', wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() } };
  await render(); await measureFrame(800); await ready();
  const layers = tree.root.findAllByType('Layer' as React.ElementType);
  const [pins, chosen] = layers;
  expect([pins.props.type, chosen.props.type]).toEqual(['symbol', 'symbol']);
  // Every capsule: one symbol (sprite and count together), stacked by its own unique order, never hidden by another.
  expect(pins.props.layout).toMatchObject({ 'symbol-sort-key': ['get', 'order'], 'icon-image': ['get', 'image'], 'icon-size': PIN_ICON_SIZE,
    'icon-allow-overlap': true, 'icon-ignore-placement': true, 'text-field': ['get', 'label'], 'text-allow-overlap': true });
  expect(chosen.props.layout).toMatchObject({ 'icon-image': ['get', 'chosenImage'], 'icon-allow-overlap': true, 'text-field': ['get', 'label'] });
  expect(chosen.props.layout['icon-size'] / pins.props.layout['icon-size']).toBeCloseTo(1.06, 10);
  expect(chosen.props.layout['text-size'] / pins.props.layout['text-size']).toBeCloseTo(PIN_CHOSEN_SCALE, 10);
  expect(chosen.props.paint['text-color']).toBe(sys.color.orangeInk);
  // The sprites the layers name are the ones the map registers, and nothing else draws a pin (no halo or disc circles any more).
  const images = tree.root.findByType('Images' as React.ElementType).props.images;
  for (const name of Object.keys(DISCOVERY_V1_PIN_IMAGES)) expect(images[name]).toBeDefined();
  expect(layers.every(node => node.props.type === 'symbol')).toBe(true);
  // The installed parser accepts every layout and paint value of both layers (the Android bridge reads string-first arrays as expressions).
  for (const node of layers) {
    for (const [group, values] of [['layout_symbol', node.props.layout], ['paint_symbol', node.props.paint]] as const) {
      for (const [name, value] of Object.entries(values as Record<string, unknown>)) {
        const spec = (latest as unknown as Record<string, Record<string, StylePropertySpecification>>)[group][name];
        expect(spec).toBeDefined();
        // The bridge takes only a string-first array as an expression; a number pair (the count's offset) stays a plain value.
        const literal = Array.isArray(value) && typeof value[0] !== 'string';
        const parsed = expression.createPropertyExpression(literal ? ['literal', value] : value, name, spec);
        if (parsed.result !== 'success') throw new Error(`${node.props.id} ${name}: ${parsed.value.map(error => error.message).join('; ')}`);
      }
    }
  }
  const evaluate = (value: unknown, group: 'layout_symbol' | 'paint_symbol', name: string, properties: Record<string, unknown>) => {
    const spec = (latest as unknown as Record<string, Record<string, StylePropertySpecification>>)[group][name];
    const parsed = expression.createPropertyExpression(value, name, spec);
    if (parsed.result !== 'success') throw new Error(name);
    return parsed.value.evaluate({ zoom: 12 }, { type: 'Point', properties } as never);
  };
  // An area's count is green, a place's count is ink, as on the legacy map; the font survives the bridge.
  expect(evaluate(pins.props.paint['text-color'], 'paint_symbol', 'text-color', { kind: 'CLUSTER' }).toString()).toBe(evaluate(sys.color.green, 'paint_symbol', 'text-color', {}).toString());
  expect(evaluate(pins.props.paint['text-color'], 'paint_symbol', 'text-color', { kind: 'PLACE' }).toString()).toBe(evaluate(sys.color.ink, 'paint_symbol', 'text-color', {}).toString());
  expect(evaluate(pins.props.layout['text-font'], 'layout_symbol', 'text-font', {})).toEqual(['Noto Sans Regular']);
});

test('the stacking order is stable across reads, and a count beyond 999 says "999+" in the widest capsule', async () => {
  const many = [
    { kind: 'TASK', key: 'task:south', point: { lat: 44.70, lng: 20.4 }, taskId: '00000000-0000-4000-8000-000000000002', taskCount: 1 },
    { kind: 'CLUSTER', key: 'cluster:big', point: { lat: 44.9, lng: 20.4 }, taskCount: 1200, distinctPointCount: 40, memberBounds: [20.3, 44.8, 20.5, 45] },
    { kind: 'TASK', key: 'task:north', point: { lat: 44.80, lng: 20.4 }, taskId: '00000000-0000-4000-8000-000000000003', taskCount: 1 },
    { kind: 'PLACE', key: 'place:44.75:20.4', point: { lat: 44.75, lng: 20.4 }, taskCount: 3 },
  ];
  extra = { p6Server: { markers: many, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() } };
  await render(); await measureFrame(800); await ready();
  const props = () => Object.fromEntries(JSON.parse(source().props.data).features.map((feature: { properties: { key: string } }) => [feature.properties.key, feature.properties]));
  expect(props()['cluster:big']).toMatchObject({ label: '999+', image: 'p6-pin-count-4', order: 0 });
  expect(props()['place:44.75:20.4']).toMatchObject({ label: '3', image: 'p6-pin-count-1', order: 1 });
  // Two single tasks: the northern one under the southern one.
  expect(props()['task:north'].order).toBeLessThan(props()['task:south'].order);
  const first = props();
  extra = { p6Server: { markers: [...many].reverse(), selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() } };
  await update();
  for (const key of Object.keys(first)) expect(props()[key].order).toBe(first[key].order);
});

test("a P6 cluster fits the camera to its members as the person's own move; a task or a place moves nothing", async () => {
  const onSelect = jest.fn();
  extra = { p6Server: { markers: layerMarkers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect }, toolsBottom: 60, fitBottom: 300 };
  await render(); await measureFrame(800); await ready();
  mockFit.mockClear(); mockEase.mockClear(); mockJump.mockClear();
  await act(async () => press('cluster:1'));
  expect(mockFit).toHaveBeenCalledTimes(1);
  expect(mockFit).toHaveBeenCalledWith([20.4, 44.78, 20.5, 44.85], { padding: { top: 86, right: 50, bottom: 324, left: 50 }, duration: sys.motion.camera });
  expect(onSelect).toHaveBeenCalledWith(layerMarkers[0]);
  // The camera lands: opening the cluster was the person's move, so the area follows where it settled.
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.45, 44.815], zoom: 12, bounds: [20.38, 44.7, 20.52, 44.9], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  // The list reads what is seen below the 60 dp of tools (the 800 dp frame has no sheet here); the buckets read the whole view.
  expect(search).toHaveBeenCalledTimes(1); expect(search).toHaveBeenCalledWith([20.38, 44.7, 20.52, 44.885024], [20.38, 44.7, 20.52, 44.9]);
  // A task or a place moves no camera and asks for no area.
  mockFit.mockClear(); search.mockClear();
  await act(async () => press('task:1'));
  await act(async () => press('place:44.7:20.3'));
  expect(mockFit).not.toHaveBeenCalled(); expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled();
  expect(onSelect.mock.calls.map(call => call[0].kind)).toEqual(['CLUSTER', 'TASK', 'PLACE']);
  await act(async () => { jest.advanceTimersByTime(2_000); }); expect(search).not.toHaveBeenCalled();
});

// A slow device reports the settle of the camera's flight seconds after the tap (found on the CI emulator: the list did not follow the opened
// cluster). What the settle shows decides, for CLUSTER_OPEN_MS, not only the clock of the intent.
const membersBounds = [20.4, 44.78, 20.5, 44.85];
const clusterMap = () => {
  const onSelect = jest.fn(), onViewportSettled = jest.fn();
  extra = { p6Server: { markers: layerMarkers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect, onViewportSettled }, toolsBottom: 60, fitBottom: 300 };
  return { onViewportSettled };
};
const settleAt = (bounds: number[]) => native().props.onRegionDidChange({ nativeEvent: { center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], zoom: 12, bounds, userInteraction: false } });
test("a P6 cluster's settle reported seconds late is still the person's own move: the list follows where it landed", async () => {
  const { onViewportSettled } = clusterMap();
  await render(); await measureFrame(800); await ready();
  await act(async () => settleAt([20.1, 44.5, 20.8, 45.1]));                // the first fit's settle: the read already covers it
  await act(async () => press('cluster:1'));
  await act(async () => { jest.advanceTimersByTime(4_000); });
  await act(async () => settleAt([20.38, 44.7, 20.52, 44.9]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).toHaveBeenCalledTimes(1); expect(search).toHaveBeenCalledWith([20.38, 44.7, 20.52, 44.885024], [20.38, 44.7, 20.52, 44.9]);
  expect(onViewportSettled).not.toHaveBeenCalled();
  // The open is used once: the next settle of the camera's own is not the person's.
  await act(async () => settleAt([20.3, 44.6, 20.6, 44.95]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).toHaveBeenCalledTimes(1); expect(onViewportSettled).toHaveBeenCalledTimes(1);
});
test("a late settle that does not show the cluster's members, or comes after the open expired, only refreshes the markers", async () => {
  const { onViewportSettled } = clusterMap();
  await render(); await measureFrame(800); await ready();
  await act(async () => settleAt([20.1, 44.5, 20.8, 45.1]));                // the first fit's settle: the read already covers it
  await act(async () => press('cluster:1'));
  await act(async () => { jest.advanceTimersByTime(4_000); });
  await act(async () => settleAt([20.0, 44.0, 20.2, 44.2]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).not.toHaveBeenCalled(); expect(onViewportSettled).toHaveBeenCalledWith([20.0, 44.0, 20.2, 44.2]);
  // Opened again, but the flight is reported only after the allowance: it is not taken as the person's.
  onViewportSettled.mockClear();
  await act(async () => press('cluster:1'));
  await act(async () => { jest.advanceTimersByTime(11_000); });
  await act(async () => settleAt([20.38, 44.7, 20.52, 44.9]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).not.toHaveBeenCalled(); expect(onViewportSettled).toHaveBeenCalledWith([20.38, 44.7, 20.52, 44.9]);
  // The person taking hold of the map retires the open: a later settle of the camera's own is not theirs either.
  await act(async () => press('cluster:1'));
  await act(async () => native().props.onRegionWillChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds: membersBounds, userInteraction: true } }));
  onViewportSettled.mockClear();
  await act(async () => { jest.advanceTimersByTime(4_000); });
  await act(async () => settleAt([20.38, 44.7, 20.52, 44.9]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).not.toHaveBeenCalled(); expect(onViewportSettled).toHaveBeenCalledTimes(1);
});

test('the DEV trace names how a P6 settle was classified: the late cluster flight, the person, and the camera alone', async () => {
  mockPackage = 'rs.uskoci.dev';
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  clusterMap();
  await render(); await measureFrame(800); await ready();
  await act(async () => settleAt([20.1, 44.5, 20.8, 45.1]));
  await act(async () => press('cluster:1'));
  await act(async () => { jest.advanceTimersByTime(4_000); });
  await act(async () => settleAt([20.38, 44.7, 20.52, 44.9]));
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9], userInteraction: true } }));
  await act(async () => settleAt([20.28, 44.68, 20.32, 44.72]));
  const lines = info.mock.calls.map(call => String(call[0])).filter(line => line.includes('"settled"'));
  expect(lines).toEqual(['[USKOCI_P6_TRACE] ["settled","QUIET_MOVE"]', '[USKOCI_P6_TRACE] ["settled","OWN_CLUSTER"]',
    '[USKOCI_P6_TRACE] ["settled","OWN_MOVE"]', '[USKOCI_P6_TRACE] ["settled","QUIET_MOVE"]']);
});

test('a P6 cluster under Reduce Motion fits at once, and a press before the map is ready selects nothing', async () => {
  const onSelect = jest.fn();
  extra = { p6Server: { markers: layerMarkers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect }, toolsBottom: 60, fitBottom: 300 };
  mockReduced = true;
  await render(); await measureFrame(800);
  await act(async () => press('cluster:1'));
  expect(mockFit).not.toHaveBeenCalledWith([20.4, 44.78, 20.5, 44.85], expect.anything()); expect(onSelect).not.toHaveBeenCalled();
  await ready(); mockFit.mockClear();
  await act(async () => press('cluster:1'));
  expect(mockFit).toHaveBeenCalledWith([20.4, 44.78, 20.5, 44.85], { padding: { top: 86, right: 50, bottom: 324, left: 50 }, duration: 0 });
  // A press that names no bucket of this read selects nothing.
  onSelect.mockClear();
  await act(async () => source().props.onPress({ nativeEvent: { features: [{ properties: { key: 'gone' } }] }, stopPropagation: jest.fn() }));
  await act(async () => source().props.onPress({ nativeEvent: { features: [] }, stopPropagation: jest.fn() }));
  expect(onSelect).not.toHaveBeenCalled();
});

test('a new read replaces the buckets of the same source, and the DEV trace counts them', async () => {
  mockPackage = 'rs.uskoci.dev';
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  extra = { p6Server: { markers: layerMarkers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() } };
  await render(); await measureFrame(800); await ready();
  extra = { p6Server: { markers: [layerMarkers[1]], selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() } };
  await update();
  expect(JSON.parse(source().props.data).features.map((feature: { properties: { key: string } }) => feature.properties.key)).toEqual(['task:1']);
  expect(tree.root.findAllByType('Source' as React.ElementType)).toHaveLength(1);
  const lines = info.mock.calls.map(call => String(call[0])).filter(line => line.startsWith('[USKOCI_P6_TRACE]'));
  expect(lines).toEqual(['[USKOCI_P6_TRACE] ["markers","3/1"]', '[USKOCI_P6_TRACE] ["markers","1/1"]']);
});

// P6: a camera move that is not the person's own leaves the buckets of the region it left, so the settled region is reported (the list is not
// asked to follow); the person's own move still asks for the area, and the first fit, made over the very bounds that were read, asks for nothing.
const p6Markers = [{ kind: 'TASK', key: 'task:1', point: { lat: 44.9, lng: 20.6 }, taskId: '00000000-0000-4000-8000-000000000001', taskCount: 1 }];
test('a P6 settle that is not the person\'s own reports its region for the markers, and never asks for an area', async () => {
  const onSelect = jest.fn(), onViewportSettled = jest.fn();
  extra = { p6Server: { markers: p6Markers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect, onViewportSettled }, toolsBottom: 60, fitBottom: 300 };
  await render(); await measureFrame(800); await ready();
  // The first fit and the settle it causes: the read already covers it.
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.45, 44.8], zoom: 9, bounds: [20.1, 44.5, 20.8, 45.1], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(onViewportSettled).not.toHaveBeenCalled(); expect(search).not.toHaveBeenCalled(); expect(setViewport).toHaveBeenCalledTimes(1);
  // A later move that is not the person's own (a fit to a chosen place): the buckets must cover what is now on screen.
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.3, 44.7], zoom: 13, bounds: [20.28, 44.68, 20.32, 44.72], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(onViewportSettled).toHaveBeenCalledTimes(1); expect(onViewportSettled).toHaveBeenCalledWith([20.28, 44.68, 20.32, 44.72]);
  expect(search).not.toHaveBeenCalled();
  // The person's own move asks for the area and not for the quiet read.
  onViewportSettled.mockClear();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9], userInteraction: true } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).toHaveBeenCalledWith([20.3, 44.7, 20.5, 44.885024], [20.3, 44.7, 20.5, 44.9]); expect(onViewportSettled).not.toHaveBeenCalled();
});

// Audit fix 2: the list reads what the person can see, not the part of the map under the search tools, the list sheet or a chosen pin's card.
test('the list reads the band between the tools and the sheet or card; the buckets keep the whole view', async () => {
  const sheetTop = { value: 500 };
  extra = { p6Server: { markers: p6Markers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() }, toolsBottom: 60, sheetTop };
  await render(); await measureFrame(800); await ready();
  const own = (bounds: number[]) => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds, userInteraction: true } });
  await act(async () => own([20.3, 44.7, 20.5, 44.9]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).toHaveBeenLastCalledWith([20.3, 44.775081, 20.5, 44.885024], [20.3, 44.7, 20.5, 44.9]);
  // The sheet is read when the wait ends: it sank behind a card 300 dp high, which now covers more than the sheet's sliver.
  sheetTop.value = 799; extra = { ...extra, coverBottom: 300 }; await update();
  await act(async () => own([20.3, 44.7, 20.5, 44.9]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).toHaveBeenLastCalledWith([20.3, 44.775081, 20.5, 44.885024], [20.3, 44.7, 20.5, 44.9]);
  // A sheet at its full height leaves no band worth reading: the whole view is used rather than a sliver.
  sheetTop.value = 80; extra = { ...extra, coverBottom: 0 }; await update();
  await act(async () => own([20.3, 44.7, 20.5, 44.9]));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(search).toHaveBeenLastCalledWith([20.3, 44.7, 20.5, 44.9], [20.3, 44.7, 20.5, 44.9]);
});

// Audit fix 3: on the P6 path the chosen bucket is the map's to keep in sight. The camera moves only when the card (or the sheet) covers it, at the same
// zoom and longitude, and that move is the camera's own (the markers follow it, the list does not).
test('a chosen P6 pin that the card covers comes into the clear band; one the person can see stays put', async () => {
  const low = { kind: 'TASK', key: 'task:low', point: { lat: 44.73, lng: 20.45 }, taskId: '00000000-0000-4000-8000-000000000004', taskCount: 1 };
  const high = { kind: 'TASK', key: 'task:high', point: { lat: 44.82, lng: 20.35 }, taskId: '00000000-0000-4000-8000-000000000005', taskCount: 1 };
  const onViewportSettled = jest.fn(), sheetTop = { value: 732 };
  const seam = (selectedKey: string | null) => ({ markers: [low, high], selectedKey, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn(), onViewportSettled });
  extra = { p6Server: seam(null), toolsBottom: 60, sheetTop, coverBottom: 0 };
  await render(); await measureFrame(800); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.45, 44.8], zoom: 9, bounds: [20.1, 44.5, 20.8, 45.1], userInteraction: false } }));
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9], userInteraction: true } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  mockEase.mockClear(); mockJump.mockClear(); mockFit.mockClear(); search.mockClear();
  // The touch: the pin is where the finger was, so nothing moves.
  extra = { ...extra, p6Server: seam('task:low') }; await update();
  expect(mockEase).not.toHaveBeenCalled();
  // The card lands, 300 dp high with its gaps: the low pin (about 85 % down the frame) is under it, so the camera brings it to the band's middle.
  extra = { ...extra, coverBottom: 300 }; await update();
  expect(mockEase).toHaveBeenCalledTimes(1);
  const [{ center, ...move }] = mockEase.mock.calls[0];
  expect(center[0]).toBeCloseTo(20.4, 9); expect(center[1]).toBe(44.73);         // the map's own longitude, the pin's latitude
  expect(move).toEqual({ padding: { top: 60, right: 0, bottom: 300, left: 0 }, duration: sys.motion.camera });   // no zoom: it stays
  // That move settles as the camera's own: the buckets follow it, the list does not.
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.76], zoom: 12, bounds: [20.3, 44.66, 20.5, 44.86], userInteraction: false } }));
  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(onViewportSettled).toHaveBeenCalledWith([20.3, 44.66, 20.5, 44.86]); expect(search).not.toHaveBeenCalled();
  // A pin high on the map, clear of the card, is not moved.
  mockEase.mockClear();
  extra = { ...extra, coverBottom: 0, p6Server: seam('task:high') }; await update();
  extra = { ...extra, coverBottom: 300 }; await update();
  expect(mockEase).not.toHaveBeenCalled();
});

test('a choice the P6 map is mounted with stays put, and Reduce Motion jumps instead of flying', async () => {
  const low = { kind: 'TASK', key: 'task:low', point: { lat: 44.73, lng: 20.45 }, taskId: '00000000-0000-4000-8000-000000000004', taskCount: 1 };
  const seam = (selectedKey: string | null) => ({ markers: [low], selectedKey, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn() });
  extra = { p6Server: seam('task:low'), toolsBottom: 60, coverBottom: 300, viewport: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9] } };
  await render(); await measureFrame(800); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9], userInteraction: false } }));
  extra = { ...extra, coverBottom: 320 }; await update();
  expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  mockReduced = true;
  extra = { p6Server: seam(null), toolsBottom: 60, coverBottom: 0, viewport: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9] } };
  await render(); await measureFrame(800); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9], userInteraction: false } }));
  extra = { ...extra, p6Server: seam('task:low'), coverBottom: 300 }; await update();
  expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).toHaveBeenCalledTimes(1);
  const [{ center, ...move }] = mockJump.mock.calls[0];
  expect(center[0]).toBeCloseTo(20.4, 9); expect(center[1]).toBe(44.73);
  expect(move).toEqual({ padding: { top: 60, right: 0, bottom: 300, left: 0 } });
});

test('a P6 map restored with its saved viewport reports the region it settles into, and the legacy map never does', async () => {
  const onViewportSettled = jest.fn(), saved = { center: [20.45, 44.8], zoom: 10, bounds: [20.2, 44.6, 20.7, 45] };
  extra = { viewport: saved, p6Server: { markers: p6Markers, selectedKey: null, wholeBounds: [20.2, 44.6, 20.7, 45], onSelect: jest.fn(), onViewportSettled } };
  await render(); await measureFrame(800); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...saved, userInteraction: false } }));
  expect(onViewportSettled).toHaveBeenCalledWith([20.2, 44.6, 20.7, 45]);
  await act(async () => tree.unmount());
  onViewportSettled.mockClear(); extra = { viewport: saved };
  await render(); await measureFrame(800); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...saved, userInteraction: false } }));
  expect(onViewportSettled).not.toHaveBeenCalled();
});
