import React, { useState } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { taskRelationIndex, type TaskRelationIndex } from '../taskRelation';
import type { DiscoveryV1MapMarker } from '../discoveryV1MarketplaceAdapter';
let mockReduced = false, mockFocused = true;
const mockNativeSheetState = { value: 0 };
const mockNativeIndex = { value: -1 }, mockNativePosition = { value: 0 };
const mockNativeDetents = { value: { detents: [] as number[] } };
const mockNativeAnimation = { value: { status: 2 } };
const mockNativeContentGesture = { value: 0 }, mockNativeHandleGesture = { value: 0 };
const mockNativeTemporary = { value: false }, mockNativeScrollStatus = { value: 1 };
const mockDefaultScroll = jest.fn(), mockDefaultBeginDrag = jest.fn(), mockDefaultEndDrag = jest.fn(), mockDefaultMomentumBegin = jest.fn(), mockDefaultMomentumEnd = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => ({
  ...jest.requireActual('../../../__mocks__/@gorhom/bottom-sheet'),
  ANIMATION_STATUS: { UNDETERMINED: 0, RUNNING: 1, STOPPED: 2, INTERRUPTED: 3 },
  SCROLLABLE_STATUS: { LOCKED: 0, UNLOCKED: 1, UNDETERMINED: 2 },
  useScrollEventsHandlersDefault: () => ({ handleOnScroll: mockDefaultScroll, handleOnBeginDrag: mockDefaultBeginDrag,
    handleOnEndDrag: mockDefaultEndDrag, handleOnMomentumBegin: mockDefaultMomentumBegin, handleOnMomentumEnd: mockDefaultMomentumEnd }),
  useBottomSheetInternal: () => ({ animatedSheetState: mockNativeSheetState, animatedIndex: mockNativeIndex,
    animatedPosition: mockNativePosition, animatedDetentsState: mockNativeDetents, animatedAnimationState: mockNativeAnimation,
    animatedContentGestureState: mockNativeContentGesture, animatedHandleGestureState: mockNativeHandleGesture,
    isInTemporaryPosition: mockNativeTemporary, animatedScrollableStatus: mockNativeScrollStatus }),
}));
const mockReactions = new Set<{ prepare: () => unknown; react: (next: unknown, previous: unknown) => void; previous: unknown }>();
const mockRnDeliveries: (() => void)[] = [];
const mockCellLayouts = new Map<string, jest.Mock>();
const mockNearbyPermission = jest.fn(), mockNearbyWatch = jest.fn();
jest.mock('../../ui/v2/discovery/nearbyLocation', () => ({ loadNearbyLocation: async () => ({ Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: () => mockNearbyPermission(), hasServicesEnabledAsync: async () => true,
  watchPositionAsync: (...args: unknown[]) => mockNearbyWatch(...args) }) }));
// The window: React Native's Jest default (a 2× text size, so "large text") unless a test says otherwise.
let mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const List = ({ data, renderItem, CellRendererComponent, ListEmptyComponent, ListHeaderComponent, scrollEventsHandlersHook, ...props }: any) => {
    const nativeHandlers = scrollEventsHandlersHook?.({ current: null }, { value: 0 });
    return React.createElement('List', { ...props, nativeHandlers },
    ListHeaderComponent,
    data.length ? data.map((item: any, index: number) => {
      if (!CellRendererComponent) return React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }));
      if (!mockCellLayouts.has(item.id)) mockCellLayouts.set(item.id, jest.fn());
      return React.createElement(CellRendererComponent, { key: item.id, cellKey: item.id, item, index,
        testID: `native-cell-${item.id}`, onLayout: mockCellLayouts.get(item.id) }, renderItem({ item, index }));
    }) : ListEmptyComponent);
  };
  // One stable function: a new one on every read would be a new component type, and React would mount the sheet again.
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => undefined };
  const useWindowDimensions = () => mockWindow;
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return List;
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    if (key === 'useWindowDimensions') return useWindowDimensions;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
// Evaluate the UI-thread styles at explicit sheet positions; native gesture/frame timing still needs device review.
jest.mock('react-native-reanimated', () => {
  const React = require('react'), shared = jest.requireActual('../../../__mocks__/react-native-reanimated');
  return { ...shared, useSharedValue: (value: unknown) => React.useRef({ value, get(): unknown { return this.value; },
    set(next: unknown) { this.value = typeof next === 'function' ? next(this.value) : next; } }).current,
    useAnimatedStyle: (updater: () => object) => updater(),
    useAnimatedReaction: (prepare: () => unknown, react: (next: unknown, previous: unknown) => void) => {
      const entry = React.useRef({ prepare, react, previous: null }).current;
      entry.prepare = prepare; entry.react = react;
      React.useEffect(() => { mockReactions.add(entry); return () => { mockReactions.delete(entry); }; }, []);
    },
    runOnJS: (fn: (...args: unknown[]) => void) => (...args: unknown[]) => { mockRnDeliveries.push(() => fn(...args)); },
  };
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
jest.mock('../../ui/v2/TaskPublisherPortrait', () => ({ TaskPublisherPortrait: 'TaskPublisherPortrait' }));
import { AREA_ANNOUNCE_MS, DiscoveryPresentation, HIDDEN, OFFSET_SETTLE_MS, RESTORE_STALL_MS, type DiscoveryV1PresentationSeam } from '../../ui/v2/DiscoveryPresentation';
import { DiscoveryPeek } from '../../ui/v2/discovery/DiscoveryPeek';
import { DiscoverySearchBar } from '../../ui/v2/discovery/DiscoverySearchBar';
import { ActionSheet } from '../../ui/system/ActionSheet';
import { TaskCard } from '../../ui/v2/TaskCard';
import { materialControl, sys } from '../../ui/system/tokens';
/** TaskCard is memoised; the test renderer holds the function it wraps. */
const CARD = (TaskCard as unknown as { type: React.ElementType }).type;

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; round-1 critique A5–A7, B8, B12). The map is under a list sheet; the
 * sheet is the list (no Lista/Mapa switch), starts where the pin coverage says, and is never reached by a gesture only.
 * Own tasks are distinctly labeled without changing public visibility/counts. A pin opens its card over the map; a point several
 * tasks share opens as one place. Filters are a draft applied at once. Presentation only: the route's guards are
 * pinned by the route suites.
 */
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Beograd',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 44.8 + Number(id.length) / 100, lng: 20.4 + id.charCodeAt(0) / 1000 },
  ...patch } as unknown as MarketplaceItem);
const at = (lat: number, lng: number) => ({ priblizno: { lat, lng } });
let rows: MarketplaceItem[] = [], loading = false, refreshing = false, error = false, relations: TaskRelationIndex | undefined, scopeKey = 'a:1';
let relationsPending = false, relationsError = false;
let tracing = false;
let publicationFocus: { token: string; id: string; kind: 'map' | 'list' } | undefined;
let publicationUnavailable: 'missing' | 'error' | undefined;
let collectionStatus: 'loading' | 'error' | undefined;
let p6Seam: DiscoveryV1PresentationSeam | undefined;
const nativeTrace = jest.fn();
const relationIndex = (own: string[], applied: string[] = [], covered = rows.map(item => item.id)) => taskRelationIndex([
  ...own.map(needId => ({ needId, relation: 'OWNER' })),
  ...applied.map(needId => ({ needId, relation: 'APPLIED', applicationId: `application-${needId}`, applicationState: 'SUBMITTED' })),
], covered);
let snapshot: MarketplaceView, initial: MarketplaceView;
/** Set once a task is opened: like the route, the screen then takes no more changes of its view (it is not in front). */
let navigated = false;
const open = jest.fn(), refresh = jest.fn(), newTask = jest.fn(), profile = jest.fn(), openPublished = jest.fn();
const userIntent = jest.fn();
function Screen() {
  const [view, setView] = useState(initial); snapshot = view;
  return <DiscoveryPresentation items={rows} loading={loading} refreshing={refreshing} error={error} scopeKey={scopeKey} view={view}
    collectionStatus={collectionStatus} p6Seam={p6Seam}
    publicationFocus={publicationFocus} publicationUnavailable={publicationUnavailable} onOpenPublishedTask={openPublished}
    trace={tracing ? nativeTrace : undefined}
    onUserIntent={userIntent}
    onView={next => { if (!navigated) setView(next); }}
    onOpen={open} onRefresh={refresh} onProfile={profile} onNew={newTask} relations={relations} relationsPending={relationsPending} relationsError={relationsError} />;
}
let tree: ReactTestRenderer;
const scrollToOffset = jest.fn(), scrollToEnd = jest.fn();
// The list's ref is its native scroll view on a phone; here it is a stand-in that hears where the list is asked to scroll.
const render = async () => act(async () => { tree = create(<Screen />, { createNodeMock: element => element.type === 'List' ? { scrollToOffset, scrollToEnd } : null }); });
const update = async () => act(async () => tree.update(<Screen />));
const sampleUi = () => { for (const entry of mockReactions) { const next = entry.prepare(); entry.react(next, entry.previous); entry.previous = next; } };
const deliverUi = async () => act(async () => { sampleUi(); while (mockRnDeliveries.length) mockRnDeliveries.shift()!(); });
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const pressable = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const action = (label: string | RegExp) => tree.root.findAllByType('Action' as React.ElementType)
  .find(node => typeof label === 'string' ? node.props.label === label : label.test(node.props.label))!;
const click = async (label: string | RegExp) => act(async () => action(label).props.onPress());
const texts = (root: ReactTestInstance = tree.root) => root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const map = () => tree.root.findByType('DiscoveryMap' as React.ElementType);
const sheets = () => tree.root.findAllByType(BottomSheet);
const listSheet = () => sheets().find(node => !node.props.detached)!;
const peek = () => sheets().find(node => node.props.detached);
// The cards in the list (TaskCard says "Otvori priliku"). Since review r3 item 7 a place's rows say "Pogledaj zadatak",
// as the single card's action does, so this reads the list sheet alone and never counts a pin card's rows.
const cards = () => listSheet().findAll(node => String(node.type) === 'Press' && /^Otvori (?:priliku|Zadatak) /.test(node.props.accessibilityLabel ?? ''))
  .map(node => String(node.props.accessibilityLabel).replace(/^Otvori (?:priliku|Zadatak) Pomoć /, ''));
// Discovery V47: the search is a panel opened from the pill over the map. Its words are a draft that "Prikaži N zadataka"
// applies; the one green action is found by its label, which says the count (or that nothing is left).
const panel = () => tree.root.findAllByType('Modal' as React.ElementType);
const list = () => tree.root.findByType('List' as React.ElementType);
// CellRendererComponent receives the final cell wrapper's absolute content position,
// unlike renderItem's child layout. Forwarding the supplied native handler is required.
const nativeCell = (index = rows.length - 1) => list().findAll(node => String(node.type) === 'View' && node.props.testID === `native-cell-${rows[index].id}`)[0];
const cellLayout = (index = rows.length - 1) => nativeCell(index).props.onLayout;
const measureEnd = async (content: number, footer = 0, index = rows.length - 1) => act(async () => {
  const padding = StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom;
  cellLayout(index)({ nativeEvent: { layout: { y: content - padding - footer - 100, height: 100 } } });
});
const readyList = async (content = 3000, window = 400) => {
  // A real viewport is meaningful only inside a measured native body/full sheet.
  if (typeof listSheet().props.snapPoints[2] !== 'number') await layOutBody();
  await act(async () => {
    list().props.onLayout?.({ nativeEvent: { layout: { height: window } } });
    list().props.onContentSizeChange(400, content);
    mockNativeSheetState.value = 2; // Gorhom SHEET_STATE.EXTENDED: native scroll locking is now released
  });
  await deliverUi();
};
/** The body under the chrome, laid out: the sheet's heights become numbers. */
const layOutBody = async (height = 800) => act(async () => tree.root.findByProps({ testID: 'discovery-body' }).props.onLayout({ nativeEvent: { layout: { height } } }));
/** A quick chip over the map (a toggle, spoken as selected or not). */
const quick = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label
  && node.props.accessibilityState && 'selected' in node.props.accessibilityState)[0];
const removable = () => tree.root.findAll(node => /^Ukloni /.test(String(node.props.accessibilityLabel ?? '')));
const tomorrowFlexible = { schedule: { kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null } };
const showAction = () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat|^Nema zadataka za ove uslove$/.test(node.props.label))!;
const radioOf = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)[0];
const search = async (words: string) => {
  await tap('Pretraži zadatke');
  await act(async () => press('Pretraži mesta i zadatke').props.onChangeText(words));
  await act(async () => showAction().props.onPress());
};
beforeEach(() => {
  tracing = false; nativeTrace.mockClear();
  mockNativeSheetState.value = 0;
  mockNativeIndex.value = -1; mockNativePosition.value = 0; mockNativeDetents.value = { detents: [] };
  mockNativeAnimation.value = { status: 2 }; mockNativeContentGesture.value = mockNativeHandleGesture.value = 0;
  mockNativeTemporary.value = false; mockNativeScrollStatus.value = 1;
  scopeKey = 'a:1'; mockReactions.clear(); mockRnDeliveries.length = 0; mockCellLayouts.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  initial = { ...initialMarketplaceView(), mode: 'map' }; loading = refreshing = error = mockReduced = relationsPending = relationsError = navigated = false; mockFocused = true; relations = undefined;
  publicationFocus = undefined; publicationUnavailable = undefined; collectionStatus = undefined; p6Seam = undefined;
  mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
  rows = [row('a'), row('bb'), row('ccc')];
  for (const fn of [open, refresh, newTask, profile, openPublished, scrollToOffset, scrollToEnd, userIntent]) fn.mockReset();
  for (const fn of [mockDefaultScroll, mockDefaultBeginDrag, mockDefaultEndDrag, mockDefaultMomentumBegin, mockDefaultMomentumEnd]) fn.mockReset();
  (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
});
// The sheet's top line: the honest count, which is also the button that opens the list (Discovery V47).
const countLine = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'list-count')[0];
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('one deliberate count tap opens the full list from peek, joined directly to the measured search tools', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`join${i}`));
  await render(); await layOutBody(760);
  await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(116));
  expect(listSheet().props.index).toBe(0);
  await act(async () => countLine().props.onPress());
  expect(listSheet().props.index).toBe(2);
  expect(listSheet().props.snapPoints[2]).toBe(760 - 116);
  expect(tree.root.findByType(DiscoverySearchBar).props.chipsShown).toBe(true);
});

test('only the physically full sheet background joins search without a floating radius, edge or shadow', async () => {
  await render();
  const Background = listSheet().props.backgroundComponent;
  let background: ReactTestRenderer;
  await act(async () => { background = create(<Background style={{}} animatedIndex={{ value: 1 }} animatedPosition={{ value: 400 }} />); });
  const style = () => StyleSheet.flatten(background!.root.findByProps({ testID: 'discovery-sheet-background' }).props.style);
  expect(style()).toMatchObject({ borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet, borderWidth: 1 });
  await act(async () => background!.update(<Background style={{}} animatedIndex={{ value: 2 }} animatedPosition={{ value: 116 }} />));
  expect(style()).toMatchObject({ backgroundColor: sys.color.surface, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 0 });
  expect(style().boxShadow ?? style().elevation).toEqual(style().boxShadow ? [] : 0);
  await act(async () => background!.unmount());
});

test('a new search that leaves only unlocated work raises a remembered half list while preserving the camera', async () => {
  const viewport = { center: [20.4, 44.8] as [number, number], zoom: 11, bounds: [20.2, 44.6, 20.6, 45] as [number, number, number, number] };
  initial = { ...initial, sheet: 'half', viewport };
  rows = [row('local'), row('without', { priblizno: null })];
  await render(); await search('without');
  expect(cards()).toEqual(['without']);
  expect(listSheet().props.index).toBe(2);
  expect(snapshot.viewport).toEqual(viewport);
  await dragSheet(1);
  await search('with'); // A different query can leave the same count; the new intent still opens the result.
  expect(cards()).toEqual(['without']);
  expect(listSheet().props.index).toBe(2);
  expect(snapshot.viewport).toEqual(viewport);
});

test('a zero-result full list keeps a gesture-free map return without changing its actual search', async () => {
  rows = [row('a')];
  initial = { ...initial, sheet: 'half', area: [0, 0, 1, 1], viewport: { center: [0, 0], zoom: 4, bounds: [0, 0, 1, 1] } };
  await render(); await layOutBody();
  await act(async () => countLine().props.onPress());
  expect(listSheet().props.index).toBe(2);
  expect(cards()).toEqual([]);
  expect(action('Prikaži sve zadatke')).toBeDefined();
  listSheet().props.animatedPosition.value = 800 - Number(listSheet().props.snapPoints[2]);
  await deliverUi();
  expect(tree.root.findByProps({ testID: 'discovery-map-layer' }).props.pointerEvents).toBe('none');
  expect(press('Mapa').props.accessibilityRole).toBe('button');
  expect(StyleSheet.flatten(press('Mapa').props.style)).toMatchObject({ backgroundColor: sys.color.surface });
  const area = snapshot.area, viewport = snapshot.viewport;
  await tap('Mapa');
  expect(listSheet().props.index).toBe(0);
  expect(snapshot.area).toEqual(area);
  expect(snapshot.viewport).toEqual(viewport);
  expect(cards()).toEqual([]);
  listSheet().props.animatedPosition.value = 800 - Number(listSheet().props.snapPoints[0]);
  await deliverUi();
  expect(tree.root.findByProps({ testID: 'discovery-map-layer' }).props.pointerEvents).toBe('auto');
  expect(refresh).not.toHaveBeenCalled();
});

test('only explicit search, map and list choices retire a pending publication landing', async () => {
  await render(); await layOutBody();
  await act(async () => map().props.onViewport({ center: [19.8, 45.2], zoom: 10, bounds: [19.7, 45.1, 19.9, 45.3] }));
  expect(userIntent).not.toHaveBeenCalled();
  await act(async () => map().props.onUserIntent());
  expect(userIntent).toHaveBeenCalledTimes(1);
  await act(async () => countLine().props.onPress());
  expect(userIntent).toHaveBeenCalledTimes(2);
  await tap('Pretraži zadatke');
  expect(userIntent).toHaveBeenCalledTimes(3);
});

test('published public point opens the exact task card even when another task shares its pin', async () => {
  rows = [row('a', { priblizno: { lat: 44.79, lng: 20.45 } }), row('bb', { priblizno: { lat: 44.79, lng: 20.45 } })];
  initial = { ...initial, selectedId: 'bb', sheet: 'peek' };
  publicationFocus = { token: 'published:bb:1', id: 'bb', kind: 'map' };
  await render();
  expect(listSheet().props.index).toBe(0);
  expect(map().props).toMatchObject({ selectedId: 'bb', selectedPlace: null, publicationCameraToken: publicationFocus.token });
  expect(tree.root.findByType(DiscoveryPeek).props.item.id).toBe('bb');
  expect(cards()).toEqual(['a', 'bb']);
});

test('published remote task opens the full list with its public row first and the original count intact', async () => {
  rows = [row('a'), row('remote', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }), row('bb')];
  initial = { ...initial, sheet: 'full', listOffset: 0 };
  publicationFocus = { token: 'published:remote:1', id: 'remote', kind: 'list' };
  await render();
  expect(listSheet().props.index).toBe(2);
  expect(cards()).toEqual(['remote', 'a', 'bb']);
  expect(texts(tree.root.findByProps({ testID: 'list-count-words' }))).toBe('3 zadatka');
  expect(tree.root.findAllByType(DiscoveryPeek)).toHaveLength(0);
});

test('a published task absent from the public read offers its owned detail without inventing a public row', async () => {
  publicationUnavailable = 'missing';
  await render();
  expect(texts()).toContain('Objavljen zadatak trenutno nije dostupan u pretrazi.');
  expect(cards()).toEqual(['a', 'bb', 'ccc']);
  await tap('Otvori moj objavljen zadatak');
  expect(openPublished).toHaveBeenCalledTimes(1);
});

test('the remote quick filter clears an old point and place, keeps the camera and shows remote work without a map', async () => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19.8, 45.2, 19.9, 45.3] as [number, number, number, number] };
  initial = { ...initial, viewport, area: viewport.bounds, pinPlace: '45.25,19.83', place: 'Novi Sad', price: 'OFFERS', query: 'Pomoć' };
  rows = [row('local', { ...at(45.25, 19.83), podrucjeTekst: 'Novi Sad', rezimCene: 'OFFERS' }),
    row('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' }, rezimCene: 'OFFERS' }), row('unknown', { priblizno: null })];
  await render();
  await act(async () => quick('Na daljinu').props.onPress());
  expect(snapshot).toMatchObject({ where: 'remote', area: null, place: null, pinPlace: null, viewport, price: 'OFFERS', query: 'Pomoć', sheet: 'full' });
  expect(cards()).toEqual(['online']);
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
  expect(pressable('U blizini')).toHaveLength(0);
  expect(texts()).not.toContain('bez tačke na mapi');
  expect(listSheet().props.backdropComponent).toBeUndefined();
  await layOutBody(800);
  await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(112));
  expect(listSheet().props.snapPoints[2]).toBe(800 - 112);
});

test('the full list fills below search, dims only the map while rising, and keeps its camera when returning', async () => {
  mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19.8, 45.2, 19.9, 45.3] as [number, number, number, number] };
  initial = { ...initial, viewport, sheet: 'half', listOffset: 160 };
  await render(); await layOutBody(760);
  await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(116));
  const layer = () => tree.root.findByProps({ testID: 'discovery-map-layer' });
  const top = 116;
  expect(listSheet().props.snapPoints[2]).toBe(760 - top);
  expect(layer().props.importantForAccessibility).toBe('auto');
  const pins = map().props.items;
  const position = listSheet().props.animatedPosition;
  let shade: ReactTestRenderer;
  const drawShade = (index: number) => listSheet().props.backdropComponent({ animatedIndex: { value: index }, animatedPosition: position });
  await act(async () => { shade = create(drawShade(1.5)); });
  const dim = () => shade!.root.findByProps({ testID: 'discovery-sheet-dim' });
  expect(StyleSheet.flatten(dim().props.style)).toMatchObject({ top, opacity: 0.09 });
  expect(dim().props.pointerEvents).toBe('none');
  expect(dim().props.importantForAccessibility).toBe('no-hide-descendants');
  await act(async () => shade!.update(drawShade(1)));
  expect(StyleSheet.flatten(dim().props.style).opacity).toBe(0);
  await act(async () => shade!.unmount());
  position.value = top;
  await act(async () => listSheet().props.onChange(2));
  await deliverUi();
  expect(layer().props.importantForAccessibility).toBe('no-hide-descendants');
  expect(layer().props.pointerEvents).toBe('none');
  expect(StyleSheet.flatten(layer().props.style).opacity).toBe(0);
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'discovery-search-backing' }).props.style).opacity).toBe(1);
  expect(press('Pretraži zadatke')).toBeTruthy();
  expect(map().props.items).toBe(pins);
  expect(snapshot.viewport).toEqual(viewport); expect(snapshot.listOffset).toBe(160);
  await tap('Mapa');
  position.value = 760 - Number(listSheet().props.snapPoints[0]);
  await act(async () => listSheet().props.onChange(0));
  await deliverUi();
  expect(layer().props.importantForAccessibility).toBe('auto');
  expect(layer().props.pointerEvents).toBe('auto');
  expect(StyleSheet.flatten(layer().props.style).opacity).toBe(1);
  expect(map().props.items).toBe(pins);
  expect(snapshot.viewport).toEqual(viewport); expect(snapshot.listOffset).toBe(160);
});

test('an interrupted half-to-full rise returning to the original half stop leaves the map usable without any finish callback', async () => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19.8, 45.2, 19.9, 45.3] as [number, number, number, number] };
  initial = { ...initial, viewport, sheet: 'half' };
  await render(); await layOutBody(760);
  const layer = () => tree.root.findByProps({ testID: 'discovery-map-layer' });
  const position = listSheet().props.animatedPosition;
  const halfPosition = 760 - Number(listSheet().props.snapPoints[1]);
  const fullPosition = 760 - Number(listSheet().props.snapPoints[2]);
  position.value = halfPosition;
  // Gorhom's actual callback sequence: original index remains 1 while it starts towards 2.
  await act(async () => listSheet().props.onAnimate?.(1, 2));
  position.value = (halfPosition + fullPosition) / 2;
  await update();
  // The gesture interrupts the spring and returns to 1. handleOnAnimate and completion both suppress callbacks
  // when the target equals animatedCurrentIndex. Deliberately do NOT send an invented onChange(1) here.
  position.value = halfPosition;
  await update();
  expect(listSheet().props.index).toBe(1);
  expect(layer().props.pointerEvents).toBe('auto');
  expect(layer().props.accessibilityElementsHidden).toBe(false);
  expect(layer().props.importantForAccessibility).toBe('auto');
  expect(StyleSheet.flatten(layer().props.style).opacity).toBe(1);
  expect(snapshot.viewport).toEqual(viewport);
  await act(async () => map().props.onSelect('bb'));
  expect(snapshot.selectedId).toBe('bb'); expect(peek()).toBeDefined();
});

test.each([false, true])('a button-requested full sheet cancelled back to native half uses physical coverage without onChange (touches full: %s)', async touchesFull => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19.8, 45.2, 19.9, 45.3] as [number, number, number, number] };
  initial = { ...initial, viewport, sheet: 'half' };
  await render(); await layOutBody(760);
  const layer = () => tree.root.findByProps({ testID: 'discovery-map-layer' });
  const position = listSheet().props.animatedPosition;
  const halfPosition = 760 - Number(listSheet().props.snapPoints[1]);
  const fullPosition = 760 - Number(listSheet().props.snapPoints[2]);
  position.value = halfPosition; await deliverUi();
  await act(async () => countLine().props.onPress());
  expect(listSheet().props.index).toBe(2); // requested destination, native's last settled index is still 1
  expect(layer().props.pointerEvents).toBe('auto');
  // Many intermediate frames schedule no repeated JS delivery while the physical boundary stays uncovered.
  for (const fraction of [0.2, 0.4, 0.7, 0.9]) {
    position.value = halfPosition + (fullPosition - halfPosition) * fraction; sampleUi();
  }
  expect(mockRnDeliveries).toHaveLength(0);
  if (touchesFull) {
    position.value = fullPosition; sampleUi(); sampleUi(); sampleUi();
    expect(mockRnDeliveries).toHaveLength(1);
    await deliverUi();
    expect(layer().props.pointerEvents).toBe('none');
    expect(layer().props.accessibilityElementsHidden).toBe(true);
  }
  // No onChange(2), no onAnimate back to 1, and no onChange(1): exactly the suppressed native callbacks.
  position.value = halfPosition;
  await deliverUi(); await update();
  expect(listSheet().props.index).toBe(2); // prove the physical boundary does not accidentally rely on a corrected request
  expect(layer().props.pointerEvents).toBe('auto');
  expect(layer().props.accessibilityElementsHidden).toBe(false);
  expect(layer().props.importantForAccessibility).toBe('auto');
  expect(StyleSheet.flatten(layer().props.style).opacity).toBe(1);
  expect(snapshot.viewport).toEqual(viewport);
  await act(async () => map().props.onSelect('bb'));
  expect(snapshot.selectedId).toBe('bb'); expect(peek()).toBeDefined();
});

test.each(['scope', 'focus'] as const)('a queued covered-map delivery from a retired %s owner cannot hide the current map', async retirement => {
  initial = { ...initial, sheet: 'half' };
  await render(); await layOutBody(760);
  await deliverUi(); // deliver the newly mounted native sheet's independent readiness observation
  const position = listSheet().props.animatedPosition;
  position.value = 760 - Number(listSheet().props.snapPoints[2]);
  sampleUi();
  expect(mockRnDeliveries).toHaveLength(1);
  const late = mockRnDeliveries.shift()!;
  if (retirement === 'scope') { scopeKey = 'b:2'; await update(); }
  else { mockFocused = false; await update(); mockFocused = true; await update(); }
  position.value = 760 - Number(listSheet().props.snapPoints[1]);
  await act(async () => late());
  const layer = () => tree.root.findByProps({ testID: 'discovery-map-layer' });
  expect(layer().props.pointerEvents).toBe('auto');
  expect(layer().props.accessibilityElementsHidden).toBe(false);
  // The new owner's first observation still runs even if an earlier owner's covered value was the same.
  position.value = 760 - Number(listSheet().props.snapPoints[2]);
  await deliverUi();
  expect(layer().props.pointerEvents).toBe('none');
  expect(layer().props.accessibilityElementsHidden).toBe(true);
});

test('a settled unchanged FULL return replaces only the native sheet and restores the saved deep offset', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 40 }, (_, i) => row(`keep${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await layOutBody();
    const oldSheet = listSheet(), frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 12000, frame);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 8000, animated: false });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 8000 } } });
      listSheet().props.onChange(2);
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    const oldScroll = list().props.onScroll;
    scrollToOffset.mockClear();
    mockFocused = false; await update();
    rows = rows.map(item => ({ ...item })); // A fresh but equal read keeps the same logical collection.
    mockFocused = true; await update();
    expect(listSheet()).not.toBe(oldSheet);
    expect(listSheet().props).toMatchObject({ index: 2, animateOnMount: false });
    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(snapshot.listOffset).toBe(8000);
    expect(cards()).toEqual(rows.map(item => item.id));

    // The retired mount cannot overwrite the new visit. The fresh FULL native sheet restores only after
    // its own unlocked/settled geometry is known.
    await act(async () => {
      oldScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    await readyList(frame + 12000, frame);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 8000, animated: false });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 8000 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);

    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 7900 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(7900);
  } finally { jest.useRealTimers(); }
});

test('a settled unchanged peek return keeps its native mount, viewport and selected pin', async () => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12,
    bounds: [19.8, 45.2, 19.9, 45.3] as [number, number, number, number] };
  initial = { ...initial, sheet: 'peek', selectedId: 'bb', viewport };
  await render(); await layOutBody();
  const oldSheet = listSheet();
  mockFocused = false; await update();
  mockFocused = true; await update();
  expect(listSheet()).toBe(oldSheet);
  expect(snapshot).toMatchObject({ sheet: 'peek', selectedId: 'bb', viewport });
  expect(tree.root.findByType(DiscoveryPeek).props.item.id).toBe('bb');
});

const nativeDetent = (index: number) => {
  mockNativeDetents.value = { detents: [700, 400, 100] };
  mockNativeIndex.value = index; mockNativePosition.value = mockNativeDetents.value.detents[index];
};
const nativeScroll = async (y: number) => act(async () => {
  const event = { contentOffset: { y } };
  list().props.nativeHandlers?.handleOnScroll(event, {});
  list().props.onScroll({ nativeEvent: event });
});
const dragSheet = async (index: number) => {
  // A real later drag has a native start before its settled onChange, including when it interrupts a request.
  await deliverUi(); mockNativeHandleGesture.value = 4; await deliverUi();
  nativeDetent(index); mockNativeHandleGesture.value = 5; mockNativeSheetState.value = index === 2 ? 2 : 0;
  await act(async () => listSheet().props.onChange(index)); await deliverUi();
};

test.each(['native probe', 'onChange'] as const)('confirming a requested peek through %s avoids a redundant native subtree commit', async confirmation => {
  rows = Array.from({ length: 6 }, (_, i) => row(`settlement${i}`));
  const committed = jest.fn();
  await act(async () => {
    tree = create(<React.Profiler id="discovery" onRender={committed}><Screen /></React.Profiler>,
      { createNodeMock: element => element.type === 'List' ? { scrollToOffset, scrollToEnd } : null });
  });
  await layOutBody(); await deliverUi(); await deliverUi();
  expect(listSheet().props.index).toBe(0); expect(snapshot.sheet).toBe('peek');
  committed.mockClear();
  nativeDetent(0); mockNativeSheetState.value = 1;
  if (confirmation === 'native probe') await deliverUi();
  else await act(async () => listSheet().props.onChange(0));
  // Matching native evidence clears command ownership without rewriting the unchanged React index.
  // A render here also re-registers Gorhom's scrollable during its initial native settlement.
  expect(committed).not.toHaveBeenCalled();
  nativeDetent(1); await deliverUi();
  // The pending request was actually fulfilled: a later native detent is no longer rejected by it.
  expect(listSheet().props.index).toBe(1); expect(snapshot.sheet).toBe('half');
  expect(committed).toHaveBeenCalled();
});

test('two unchanged deep FULL returns each rebuild native presentation and restore the same logical offset', async () => {
  rows = Array.from({ length: 40 }, (_, i) => row(`native${i}`));
  initial = { ...initial, sheet: 'full', listOffset: 8000 };
  await render(); await readyList(15000); nativeDetent(2); await deliverUi();
  await nativeScroll(8000);
  let sheet = listSheet();
  for (let visit = 0; visit < 2; visit++) {
    scrollToOffset.mockClear();
    mockFocused = false; await update(); mockFocused = true; await update();
    expect(listSheet()).not.toBe(sheet);
    expect(listSheet().props).toMatchObject({ index: 2, animateOnMount: false });
    expect(snapshot.listOffset).toBe(8000);
    // A fresh native mount must earn its own geometry/readiness before restoring the saved logical offset.
    expect(scrollToOffset).not.toHaveBeenCalled();
    await readyList(15000);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 8000, animated: false });
    await nativeScroll(8000);
    expect(snapshot.listOffset).toBe(8000);
    sheet = listSheet();
  }
});

test('a genuinely settled native full detent replaces a stale half request before a changed-data fallback', async () => {
  initial = { ...initial, sheet: 'half', listOffset: 160 };
  await render(); await readyList(); nativeDetent(2); await deliverUi();
  await nativeScroll(160);
  expect(snapshot.sheet).toBe('full'); expect(listSheet().props.index).toBe(2);
  const sheet = listSheet();
  mockFocused = false; await update(); rows = [...rows, row('changed')]; mockFocused = true; await update();
  expect(listSheet()).not.toBe(sheet); expect(listSheet().props.index).toBe(2);
  expect(snapshot.listOffset).toBe(160);
});

test.each(['locked', 'mismatch', 'drag', 'momentum'] as const)('a retired FULL mount cannot use a hidden %s witness to certify the new visit', async kind => {
  tracing = true; initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await readyList(); nativeDetent(2); await deliverUi(); await nativeScroll(160);
  const oldSheet = listSheet(), oldHandlers = list().props.nativeHandlers;
  mockFocused = false; await update();
  await act(async () => {
    const event = { contentOffset: { y: kind === 'mismatch' ? 80 : 160 } };
    if (kind === 'locked') mockNativeScrollStatus.value = 0;
    if (kind === 'drag') oldHandlers.handleOnBeginDrag(event, {});
    else if (kind === 'momentum') oldHandlers.handleOnMomentumBegin(event, {});
    else oldHandlers.handleOnScroll(event, {});
    mockNativeScrollStatus.value = 1;
  });
  scrollToOffset.mockClear(); nativeTrace.mockClear();
  mockFocused = true; await update(); await deliverUi();
  expect(listSheet()).not.toBe(oldSheet);
  expect(snapshot.listOffset).toBe(160);
  expect(scrollToOffset).not.toHaveBeenCalled();
  expect(nativeTrace.mock.calls.some(call => call[0] === 'ack' && call[4] === true)).toBe(false);
  await readyList();
  expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 160, animated: false });
  await nativeScroll(160);
  expect(snapshot.listOffset).toBe(160);
});

test.each(['momentum', 'temporary', 'animation'] as const)('a retired FULL %s state cannot hold the fresh return mount', async kind => {
  initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await readyList(); nativeDetent(2); await deliverUi(); await nativeScroll(160);
  const oldSheet = listSheet(), oldHandlers = list().props.nativeHandlers, event = { contentOffset: { y: 160 } };
  mockFocused = false; await update();
  await act(async () => {
    if (kind === 'momentum') oldHandlers.handleOnMomentumBegin(event, {});
    if (kind === 'temporary') mockNativeTemporary.value = true;
    if (kind === 'animation') mockNativeAnimation.value.status = 1;
  });
  scrollToOffset.mockClear();
  mockFocused = true; await update(); await deliverUi();
  expect(listSheet()).not.toBe(oldSheet);
  expect(scrollToOffset).not.toHaveBeenCalled();
  expect(snapshot.listOffset).toBe(160);

  // The new native sheet owns the new visit. Once its own state is idle/unlocked and its geometry is measured,
  // restoration proceeds without accepting any completion from the retired sheet.
  await act(async () => {
    if (kind === 'momentum') oldHandlers.handleOnMomentumEnd(event, {});
    mockNativeTemporary.value = false; mockNativeAnimation.value.status = 2;
  });
  await readyList();
  expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 160, animated: false });
  await nativeScroll(160);
  expect(snapshot.listOffset).toBe(160);
});

test.each(['running', 'interrupted', 'content gesture', 'handle gesture', 'temporary', 'between detents', 'out of range'] as const)(
  'a native %s sample cannot replace the requested detent', async kind => {
    initial = { ...initial, sheet: 'half' }; await render(); await readyList(); nativeDetent(2);
    if (kind === 'running') mockNativeAnimation.value.status = 1;
    if (kind === 'interrupted') mockNativeAnimation.value.status = 3;
    if (kind === 'content gesture') mockNativeContentGesture.value = 2;
    if (kind === 'handle gesture') mockNativeHandleGesture.value = 4;
    if (kind === 'temporary') mockNativeTemporary.value = true;
    if (kind === 'between detents') mockNativePosition.value = 120;
    if (kind === 'out of range') mockNativeIndex.value = 3;
    await deliverUi();
    expect(snapshot.sheet).toBe('half'); expect(listSheet().props.index).toBe(1);
  });

test('a queued full-detent sample cannot undo a newer requested peek', async () => {
  initial = { ...initial, sheet: 'half' }; await render(); await readyList(); nativeDetent(2);
  sampleUi(); // Full is observed on the UI thread, but its JS delivery is delayed.
  await act(async () => countLine().props.onPress()); await tap('Mapa');
  expect(listSheet().props.index).toBe(0);
  await deliverUi();
  expect(listSheet().props.index).toBe(0); expect(snapshot.sheet).toBe('peek');
});

test('a full request matching an already settled native detent refreshes a rejected queued sample', async () => {
  initial = { ...initial, sheet: 'half', listOffset: 160 };
  await render(); await readyList(); nativeDetent(2); sampleUi();
  scrollToOffset.mockClear();
  await act(async () => countLine().props.onPress()); // The native sheet is already full, so there is no new animation/event.
  await deliverUi();
  expect(listSheet().props.index).toBe(2);
  expect(scrollToOffset).toHaveBeenCalledWith({ offset: 160, animated: false });
});

test('a fresh sample carrying the new peek command cannot reconcile the previous full stop', async () => {
  initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await readyList(); nativeDetent(2); await deliverUi(); await nativeScroll(160);
  const event = { contentOffset: { y: 160 } };
  await act(async () => list().props.nativeHandlers.handleOnMomentumBegin(event, {})); await deliverUi();
  await tap('Mapa');
  // The newest request has reached React, but its native animation has not started yet.
  await act(async () => list().props.nativeHandlers.handleOnMomentumEnd(event, {})); await deliverUi();
  expect(listSheet().props.index).toBe(0); expect(snapshot.sheet).toBe('peek');
});

test.each(['handle', 'content'] as const)('a new native %s gesture can interrupt an outstanding requested detent', async kind => {
  initial = { ...initial, sheet: 'full' };
  await render(); await readyList(); nativeDetent(2); await deliverUi();
  await tap('Mapa'); await deliverUi();
  const gesture = kind === 'handle' ? mockNativeHandleGesture : mockNativeContentGesture;
  gesture.value = 4; await deliverUi(); // A new gesture, observed after this command reached the native observer.
  nativeDetent(1); gesture.value = 5; mockNativeSheetState.value = 0; await deliverUi();
  expect(listSheet().props.index).toBe(1); expect(snapshot.sheet).toBe('half');
});

test('a gesture settled before its start reaches JS is resampled after request retirement', async () => {
  initial = { ...initial, sheet: 'full' };
  await render(); await readyList(); nativeDetent(2); await deliverUi();
  await tap('Mapa'); await deliverUi();
  mockNativeHandleGesture.value = 4; sampleUi();
  nativeDetent(1); mockNativeHandleGesture.value = 5; mockNativeSheetState.value = 0; sampleUi();
  await deliverUi(); await deliverUi(); // JS retires the request; the next UI frame resamples the already idle stop.
  expect(listSheet().props.index).toBe(1); expect(snapshot.sheet).toBe('half');
});

test('a queued retained witness and old native handler cannot certify a changed extent', async () => {
  tracing = true; initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await readyList(); nativeDetent(2); await deliverUi(); await nativeScroll(160);
  const oldHandler = list().props.nativeHandlers.handleOnScroll;
  mockFocused = false; await update(); mockFocused = true; await update(); sampleUi();
  rows = rows.map(item => ({ ...item, naslov: `${item.naslov} changed` })); await update();
  nativeTrace.mockClear(); scrollToOffset.mockClear();
  await act(async () => oldHandler({ contentOffset: { y: 160 } }, {}));
  await deliverUi();
  expect(nativeTrace.mock.calls.some(call => call[0] === 'ack' && call[4] === true)).toBe(false);
  expect(snapshot.listOffset).toBe(160);
  const sheet = listSheet(); mockFocused = false; await update(); mockFocused = true; await update();
  expect(listSheet()).not.toBe(sheet); // The pending restore was never falsely completed.
});

test('the native witness forwards all default scroll handlers and their context', async () => {
  await render();
  const event = { contentOffset: { y: 160 } }, context = { initialContentOffsetY: 20 };
  const handlers = list().props.nativeHandlers;
  await act(async () => {
    handlers.handleOnScroll(event, context); handlers.handleOnBeginDrag(event, context); handlers.handleOnEndDrag(event, context);
    handlers.handleOnMomentumBegin(event, context); handlers.handleOnMomentumEnd(event, context);
  });
  for (const handler of [mockDefaultScroll, mockDefaultBeginDrag, mockDefaultEndDrag, mockDefaultMomentumBegin, mockDefaultMomentumEnd]) {
    expect(handler).toHaveBeenCalledTimes(1); expect(handler).toHaveBeenCalledWith(event, context);
  }
});

test.each([1, 2])('an interrupted spring toward index %s remounts even when React never requested a new index', async target => {
  initial = { ...initial, sheet: 'half', listOffset: 160 };
  await render(); await layOutBody(760);
  const oldSheet = listSheet();
  await act(async () => oldSheet.props.onAnimate?.(1, target));
  mockFocused = false; await update();
  mockFocused = true; await update();
  expect(listSheet()).not.toBe(oldSheet);
  expect(listSheet().props.index).toBe(1);
  expect(snapshot.listOffset).toBe(160);
});

test.each(['rows', 'requirements', 'schedule', 'price basis', 'publisher', 'relation', 'height', 'width', 'font scale', 'scope', 'reverted rows'] as const)(
  'a settled return remounts when %s changed while away', async changed => {
  initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await layOutBody(760); await readyList();
  await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 160 } } }); listSheet().props.onChange(2); });
  const oldSheet = listSheet();
  mockFocused = false; await update();
  if (changed === 'rows') rows = [...rows, row('new-layout-row')];
  else if (changed === 'requirements') rows = [row('a', { detalji: { zahtevi: { bitniUslovi: ['Dug uslov koji menja visinu kartice'] } } }), ...rows.slice(1)];
  else if (changed === 'schedule') rows = [row('a', tomorrowFlexible), ...rows.slice(1)];
  else if (changed === 'price basis') rows = [row('a', { osnovaCene: 'PER_PERSON' }), ...rows.slice(1)];
  else if (changed === 'publisher') rows = [row('a', { narucilacIme: 'Novo javno ime' }), ...rows.slice(1)];
  else if (changed === 'relation') relations = relationIndex(['a']);
  else if (changed === 'height') mockWindow = { ...mockWindow, height: mockWindow.height + 120 };
  else if (changed === 'width') mockWindow = { ...mockWindow, width: mockWindow.width - 120 };
  else if (changed === 'font scale') mockWindow = { ...mockWindow, fontScale: 1.3 };
  else if (changed === 'scope') scopeKey = 'b:2';
  else {
    const originalRows = rows;
    rows = [row('temporary')]; await update(); rows = originalRows;
  }
  await update();
  mockFocused = true; await update();
  expect(listSheet()).not.toBe(oldSheet);
  expect(snapshot.listOffset).toBe(160);
});

test('return after opening a task during a collapse rebuilds the native sheet at its requested stop and retires the old finish', async () => {
  const viewport = { center: [19.83, 45.25] as [number, number], zoom: 12, bounds: [19.8, 45.2, 19.9, 45.3] as [number, number, number, number] };
  initial = { ...initial, viewport, sheet: 'full', listOffset: 160, price: 'MY_PRICE' };
  await render(); await layOutBody(760);
  const oldSheet = listSheet(), lateFinish = oldSheet.props.onChange;
  await tap('Mapa');
  expect(listSheet().props.index).toBe(0);
  // The collapse is in flight: no native onChange has arrived when the still-visible row is pressed.
  open.mockImplementation(() => { navigated = true; });
  await tap('Otvori priliku Pomoć a');
  expect(open).toHaveBeenCalledWith(rows[0]);
  mockFocused = false; await update();
  expect(listSheet()).toBe(oldSheet); // no second native mount while the outgoing screen is behind detail
  await act(async () => lateFinish(2));
  scrollToOffset.mockClear();
  navigated = false; mockFocused = true; await update();
  expect(listSheet().props).toMatchObject({ index: 0, animateOnMount: false, enablePanDownToClose: false });
  expect(listSheet()).not.toBe(oldSheet);
  expect(Number(listSheet().props.snapPoints[0])).toBeGreaterThan(HIDDEN);
  expect(listSheet().findByProps({ testID: 'list-sheet-content' }).props.accessibilityElementsHidden).toBe(false);
  expect(countLine()).toBeDefined();
  expect(cards()).toEqual(['a', 'bb', 'ccc']);
  expect(scrollToOffset).not.toHaveBeenCalled(); // collapsed native list stays locked; keep the target for full height
  await act(async () => lateFinish(2)); // a delivery already queued before blur must not reopen the restored sheet
  expect(listSheet().props.index).toBe(0);
  expect(snapshot).toMatchObject({ sheet: 'peek', viewport, listOffset: 160, price: 'MY_PRICE' });
  await act(async () => countLine().props.onPress());
  expect(listSheet().props.index).toBe(2);
  nativeDetent(2); // The new sheet physically reaches full; a requested index alone cannot release restoration.
  await readyList();
  expect(scrollToOffset).toHaveBeenCalledWith({ offset: 160, animated: false });
});

test('return with a selected pin preserves its preview and closing it restores the list header', async () => {
  initial = { ...initial, sheet: 'half', listOffset: 160 };
  await render(); await layOutBody(760);
  await act(async () => map().props.onSelect('bb'));
  expect(listSheet().props.snapPoints[0]).toBe(HIDDEN);
  const oldSheet = listSheet(), lateFinish = oldSheet.props.onChange;
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => lateFinish(1));
  expect(snapshot.selectedId).toBe('bb'); expect(peek()).toBeDefined();
  expect(listSheet()).not.toBe(oldSheet);
  expect(listSheet().props.index).toBe(0);
  await tap('Zatvori pregled zadatka');
  expect(Number(listSheet().props.snapPoints[0])).toBeGreaterThan(HIDDEN);
  expect(listSheet().findByProps({ testID: 'list-sheet-content' }).props.accessibilityElementsHidden).toBe(false);
  expect(countLine()).toBeDefined();
});

test('a retired sheet cannot save an old scroll, cancel the current restore or consume its content-size retry', async () => {
  jest.useFakeTimers();
  try {
    initial = { ...initial, sheet: 'full', listOffset: 160 };
    await render(); await layOutBody(760); await readyList();
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 160 } } }));
    const oldScroll = list().props.onScroll, oldDrag = list().props.onScrollBeginDrag, oldContent = list().props.onContentSizeChange, oldRefresh = list().props.onRefresh;
    await act(async () => oldScroll({ nativeEvent: { contentOffset: { y: 260 } } }));
    mockFocused = false; await update();
    await act(async () => { jest.advanceTimersByTime(OFFSET_SETTLE_MS); });
    expect(snapshot.listOffset).toBe(160); // leaving without opening a row retires the pending save
    mockFocused = true; await update(); scrollToOffset.mockClear();
    await act(async () => {
      oldScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      oldDrag(); oldContent(0, 1000); oldRefresh();
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(160);
    expect(refresh).not.toHaveBeenCalled();
    expect(scrollToOffset).not.toHaveBeenCalled();
    await readyList(1000);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 160, animated: false });
  } finally { jest.useRealTimers(); }
});

test('an accepted scroll still saves after folding the search header changes its viewport', async () => {
  jest.useFakeTimers();
  try {
    initial = { ...initial, sheet: 'full' };
    await render(); await readyList();
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } }));
    expect(tree.root.findByType(DiscoverySearchBar).props.chipsShown).toBe(false);
    await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(71));
    await act(async () => { jest.advanceTimersByTime(OFFSET_SETTLE_MS); });
    expect(snapshot.listOffset).toBe(200);
  } finally { jest.useRealTimers(); }
});

test.each([false, true])('native mount zero cannot replace saved scroll; restore waits for unlocked layout and an acknowledged offset (loading: %s)', async startsLoading => {
  jest.useFakeTimers();
  try {
    initial = { ...initial, sheet: 'full', listOffset: 160 };
    loading = startsLoading;
    await render(); await layOutBody(760); scrollToOffset.mockClear();
    await act(async () => {
      list().props.onLayout?.({ nativeEvent: { layout: { height: 400 } } });
      list().props.onContentSizeChange(400, 1200);
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(160);
    expect(scrollToOffset).not.toHaveBeenCalled(); // Gorhom would force an early imperative request back to zero
    if (startsLoading) {
      mockNativeSheetState.value = 2; await deliverUi(); // native unlock can precede the resource read
      loading = false; await update();
      expect(scrollToOffset).not.toHaveBeenCalled(); // the previous loading view's height cannot authorize a row restore
      await act(async () => list().props.onContentSizeChange(400, 1200));
    }
    mockNativeSheetState.value = 2; await deliverUi();
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 160, animated: false });
    // A zero queued before the accepted request is not proof that restoration completed.
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(160);
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 160 } } }));
    mockNativeSheetState.value = 1; await deliverUi(); // OPENED/locked while the person collapses the sheet
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(160);
    mockNativeSheetState.value = 2; await deliverUi();
    await act(async () => {
      list().props.onScrollBeginDrag({ nativeEvent: {} });
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(0); // real scrolling back to the top remains possible
  } finally { jest.useRealTimers(); }
});

test('deep return keeps its saved offset while virtualized content grows past provisional scroll acknowledgements', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 80 }, (_, i) => row(`deep${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 1800);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1800, animated: false });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    await act(async () => list().props.onContentSizeChange(400, frame + 6000));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 6000, animated: false });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 6000 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    await act(async () => list().props.onContentSizeChange(400, frame + 10000));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 8000, animated: false });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 8000.2 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
      list().props.onContentSizeChange(400, frame + 15000);
    });
    expect(scrollToOffset).toHaveBeenCalledTimes(3);
    expect(snapshot.listOffset).toBe(8000);
  } finally { jest.useRealTimers(); }
});

// Journey #6 (cycle 2): a restore that asks for an offset beyond what the list has rendered advances with every measured row. The saved end of a 100-row
// list stopped 2000 px short and waited for ever. When nothing new is measured for RESTORE_STALL_MS the same request is made again, then the tail is asked for
// (scrollToEnd renders it); then the restore settles where the list is. The P6 screen only; taking hold of the list has always ended a restore.
// The order: the same request again (the native list can lag behind React Native's layout), then the tail, then settle.
const stalls = () => nativeTrace.mock.calls.filter(call => call[0] === 'stall').map(call => call.slice(1));
test('a P6 restore that stops short of the saved offset asks again, then for the tail, then settles where the list is', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 80 }, (_, i) => row(`stall${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    p6Seam = p6Seam_(); tracing = true;
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 1800);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1800, animated: false });
    await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } }); });
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS - 1); });
    expect(scrollToOffset).toHaveBeenCalledTimes(1); expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    // First the same request again ...
    expect(scrollToOffset).toHaveBeenCalledTimes(2); expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1800, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled(); expect(snapshot.listOffset).toBe(8000);
    // ... then the tail ...
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS); });
    expect(scrollToEnd).toHaveBeenCalledTimes(1); expect(scrollToEnd).toHaveBeenCalledWith({ animated: false }); expect(snapshot.listOffset).toBe(8000);
    // ... and then it settles where the list is.
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS + OFFSET_SETTLE_MS); });
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    expect(snapshot.listOffset).toBe(1800);
    expect(stalls().map(call => call[0])).toEqual([1, 2, 3]);
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(scrollToOffset).toHaveBeenCalledTimes(2); expect(scrollToEnd).toHaveBeenCalledTimes(1); expect(snapshot.listOffset).toBe(1800);
  } finally { jest.useRealTimers(); }
});
const acks = () => nativeTrace.mock.calls.filter(call => call[0] === 'ack').map(call => call.slice(1));
// Journey #8 (cycles 13-20): the last exact request of a deep restore (the target is reachable: the content is as long as the saved offset needs) can land while the native
// list is still shorter than React Native's layout says. It clamps to where it already is, no offset event follows, and the restore waited for that event for ever. The watchdog
// covers every P6 restore request: the same request again, never the tail while the target is reachable (that would overshoot the saved offset), then it settles on the saved offset.
test('a P6 restore whose exact request the native list does not acknowledge asks again, never for the tail, and settles on the saved offset', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 80 }, (_, i) => row(`exact${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    p6Seam = p6Seam_(); tracing = true;
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 8000);
    expect(scrollToOffset).toHaveBeenCalledTimes(1); expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 8000, animated: false });
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS - 1); });
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(scrollToOffset).toHaveBeenCalledTimes(2); expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 8000, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS); });
    expect(scrollToOffset).toHaveBeenCalledTimes(3); expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS + OFFSET_SETTLE_MS); });
    expect(stalls().map(call => call[0])).toEqual([1, 2, 3]);
    expect(acks().at(-1)).toEqual([8000, 8000, 8000, false]);
    expect(snapshot.listOffset).toBe(8000);
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(scrollToOffset).toHaveBeenCalledTimes(3); expect(scrollToEnd).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
test('a P6 restore acknowledged after its exact request was asked again is complete: nothing more is asked', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 80 }, (_, i) => row(`exact${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    p6Seam = p6Seam_(); tracing = true;
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 8000);
    await measureEnd(frame + 8000);
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS); });
    expect(scrollToOffset).toHaveBeenCalledTimes(2);
    // The native list has caught up with the layout: the same request now lands, and it says so.
    await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 8000 } } }); jest.advanceTimersByTime(OFFSET_SETTLE_MS); });
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS * 5); });
    expect(scrollToOffset).toHaveBeenCalledTimes(2); expect(scrollToEnd).not.toHaveBeenCalled();
    expect(stalls().map(call => call[0])).toEqual([1]);
    expect(snapshot.listOffset).toBe(8000);
  } finally { jest.useRealTimers(); }
});
test('growth of the list restarts the wait, dragging ends the restore, and the legacy reader never runs the watchdog', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 80 }, (_, i) => row(`stall${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    p6Seam = p6Seam_();
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 1800);
    await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } }); jest.advanceTimersByTime(RESTORE_STALL_MS - 1); });
    await act(async () => list().props.onContentSizeChange(400, frame + 6000));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 6000, animated: false });
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS - 1); });
    expect(scrollToEnd).not.toHaveBeenCalled(); expect(scrollToOffset).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(scrollToOffset).toHaveBeenCalledTimes(3); expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS); });
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    // A person who takes hold of the list has ended the restore: nothing more is asked of it.
    await act(async () => { list().props.onScrollBeginDrag({ nativeEvent: {} }); jest.advanceTimersByTime(RESTORE_STALL_MS * 5); });
    expect(scrollToEnd).toHaveBeenCalledTimes(1); expect(scrollToOffset).toHaveBeenCalledTimes(3);
    await act(async () => tree.unmount());
    // The legacy reader waits as it always did.
    scrollToOffset.mockClear(); scrollToEnd.mockClear();
    p6Seam = undefined; initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await layOutBody();
    await readyList(frame + 1800);
    await act(async () => { list().props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } }); jest.advanceTimersByTime(RESTORE_STALL_MS * 10); });
    expect(scrollToEnd).not.toHaveBeenCalled(); expect(snapshot.listOffset).toBe(8000);
  } finally { jest.useRealTimers(); }
});

test.each(['cell-first', 'content-first'])('a truly shorter virtualized list clamps only when final cell and content agree (%s)', async order => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 20 }, (_, i) => row(`short${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 1800);
    const nativeLayout = mockCellLayouts.get(rows[rows.length - 1].id)!, lastLayout = cellLayout();
    const padding = StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom;
    const finalEvent = { nativeEvent: { layout: { y: frame + 4000 - padding - 200, height: 200 } } };
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } });
      if (order === 'cell-first') lastLayout(finalEvent);
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000); // a last row with older content size is not a valid clamp
    await act(async () => list().props.onContentSizeChange(400, frame + 4000));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 4000, animated: false });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 4000 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    if (order === 'content-first') {
      expect(snapshot.listOffset).toBe(8000);
      await act(async () => lastLayout(finalEvent)); // no second same-offset scroll event is necessary
    }
    expect(nativeLayout).toHaveBeenCalledWith(finalEvent);
    expect(snapshot.listOffset).toBe(4000);
    expect(scrollToOffset).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

test('a partial window that fits cannot erase a deep target, and dragging retires its later geometry callbacks', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 20 }, (_, i) => row(`partial${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame - 100);
    expect(snapshot.listOffset).toBe(8000); expect(scrollToOffset).not.toHaveBeenCalled();
    await act(async () => list().props.onContentSizeChange(400, frame + 1000));
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 1000, animated: false });
    await act(async () => {
      list().props.onScrollBeginDrag({ nativeEvent: {} });
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 900 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    await measureEnd(frame + 3000);
    await act(async () => list().props.onContentSizeChange(400, frame + 3000));
    expect(snapshot.listOffset).toBe(900); expect(scrollToOffset).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('a retired final-cell callback cannot certify the new sheet data end', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 20 }, (_, i) => row(`retired${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 1800);
    const oldLayout = cellLayout();
    const padding = StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom;
    mockFocused = false; await update(); mockFocused = true; await update();
    await readyList(frame + 1800);
    await act(async () => {
      oldLayout({ nativeEvent: { layout: { y: frame + 1800 - padding - 100, height: 100 } } });
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    await measureEnd(frame + 1800);
    expect(snapshot.listOffset).toBe(1800);
  } finally { jest.useRealTimers(); }
});

test('a final cell waits for the actual optional footer height before accepting a shorter list', async () => {
  jest.useFakeTimers();
  try {
    initial = { ...initial, sheet: 'full', listOffset: 8000, when: 'tomorrow' };
    rows = [row('dated', tomorrowFlexible), row('undated')];
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 1000);
    await measureEnd(frame + 1000, 80, 0);
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 1000 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    const oldFooter = list().props.ListFooterComponent;
    const oldCell = nativeCell(0), oldContent = list().props.onContentSizeChange;
    rows = rows.map(item => ({ ...item })); await update();
    expect(list().props.ListFooterComponent.key).toBe(oldFooter.key);
    expect(nativeCell(0)).toBe(oldCell);
    rows = [{ ...rows[0], naslov: 'Promenjen raspored kartice' }, rows[1]]; await update();
    // Changed row content needs a new native layout even when the footer has the same height.
    expect(list().props.ListFooterComponent.key).not.toBe(oldFooter.key);
    expect(nativeCell(0)).not.toBe(oldCell);
    await measureEnd(frame + 1000, 80, 0);
    await act(async () => {
      oldContent(400, frame + 1000);
      oldFooter.props.onLayout({ nativeEvent: { layout: { height: 80 } } });
    });
    expect(snapshot.listOffset).toBe(8000);
    await act(async () => list().props.ListFooterComponent.props.onLayout({ nativeEvent: { layout: { height: 80 } } }));
    expect(snapshot.listOffset).toBe(8000); // Fresh geometry must not reuse the previous data's scroll acknowledgement.
    await act(async () => {
      // The container's actual height did not change, so native emits no new content-size callback.
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 1000 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(1000);
    expect(scrollToOffset).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

test.each([0, 2000])('a width change reuses only a provisional content bound until its current end agrees (growth: %s)', async growth => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 20 }, (_, i) => row(`resize${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    await render(); await readyList();
    const frame = StyleSheet.flatten(list().props.style).height;
    await act(async () => list().props.onContentSizeChange(400, frame + 1000));
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 1000 } } }));
    const oldCell = cellLayout(), oldContent = list().props.onContentSizeChange;
    mockWindow = { ...mockWindow, width: mockWindow.width - 100 }; await update();
    const padding = StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom;
    await act(async () => {
      oldCell({ nativeEvent: { layout: { y: frame + 1000 - padding - 100, height: 100 } } });
      oldContent(400, frame + 1000);
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 1000 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(8000);
    await measureEnd(frame + 1000 + growth);
    if (growth) {
      expect(snapshot.listOffset).toBe(8000); // The old height cannot certify this longer current end.
      await act(async () => {
        list().props.onContentSizeChange(400, frame + 1000 + growth);
        list().props.onScroll({ nativeEvent: { contentOffset: { y: 1000 + growth } } });
        jest.advanceTimersByTime(OFFSET_SETTLE_MS);
      });
    }
    // No fresh content callback is needed when final-cell geometry confirms the unchanged native height.
    expect(snapshot.listOffset).toBe(1000 + growth);
  } finally { jest.useRealTimers(); }
});

test.each([false, true])('an authoritative empty read clears an impossible offset while loading and failure preserve it (failure: %s)', async failed => {
  initial = { ...initial, sheet: 'full', listOffset: 8000 };
  rows = []; loading = !failed; error = failed;
  await render(); await readyList(300);
  expect(snapshot.listOffset).toBe(8000);
  loading = error = false; await update();
  expect(snapshot.listOffset).toBe(0);
  expect(scrollToOffset).not.toHaveBeenCalled();
});

test.each([100, -100])('return clamps against content %s dp longer than its owned viewport and never waits for an unreachable offset', async excess => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 12 }, (_, i) => row(`t${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 640 };
    await render(); await readyList();
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 640 } } }));
    mockFocused = false; await update(); rows = [row('one')]; mockFocused = true; await update();
    const frame = StyleSheet.flatten(list().props.style).height;
    scrollToOffset.mockClear(); await readyList(frame + excess, frame);
    await measureEnd(frame + excess);
    const target = Math.max(0, excess);
    if (target > 0) {
      expect(scrollToOffset).toHaveBeenCalledWith({ offset: target, animated: false });
      expect(snapshot.listOffset).toBe(640); // issuing a command alone has not confirmed restoration
      await act(async () => {
        list().props.onScroll({ nativeEvent: { contentOffset: { y: target } } });
        jest.advanceTimersByTime(OFFSET_SETTLE_MS);
      });
    } else {
      expect(scrollToOffset).not.toHaveBeenCalled(); // all current rows fit; no native scroll event will arrive
      expect(tree.root.findByType(DiscoverySearchBar).props.chipsShown).toBe(true);
    }
    expect(snapshot.listOffset).toBe(target);
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(0); // the impossible old target cannot keep suppressing later scroll events
  } finally { jest.useRealTimers(); }
});

test('native return restores into an explicitly bounded viewport without waiting for a second native layout event', async () => {
  jest.useFakeTimers();
  try {
    tracing = true; initial = { ...initial, sheet: 'full', listOffset: 313 };
    await render(); await layOutBody(767);
    await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(71));
    await readyList(2611.4, 600);
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 312.8 } } }));
    mockFocused = false; await update(); mockFocused = true; await update();
    scrollToOffset.mockClear(); nativeTrace.mockClear();

    // R19d/e return: the first native layout reports the entire content. There may be no
    // second bounded onLayout after EXTENDED, so waiting for one leaves the list at zero.
    await readyList(2611.4, 2611.4);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 313, animated: false });
    const frame = listSheet().props.snapPoints[2] - 68; // compact grab/count header before native measurement
    expect(StyleSheet.flatten(list().props.style)).toMatchObject({ height: frame, flexGrow: 0, flexShrink: 0 });
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(313);
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(nativeTrace.mock.calls.some(call => call[0] === 'clamp0')).toBe(false);
    expect(tree.root.findByType(DiscoverySearchBar).props.chipsShown).toBe(false);

    // No second layout is delivered: only the real scroll acknowledgement completes it.
    await act(async () => {
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 312.8 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(nativeTrace).toHaveBeenCalledWith('ack', 312.8, 313, 313);
    expect(tree.root.findByType(DiscoverySearchBar).props.chipsShown).toBe(false);
    await act(async () => {
      list().props.onScrollBeginDrag({ nativeEvent: {} });
      list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
      jest.advanceTimersByTime(OFFSET_SETTLE_MS);
    });
    expect(snapshot.listOffset).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('diagnostic trace distinguishes rejection, request, acknowledgement, pre-open and post-ack zero without reading event data', async () => {
  tracing = true; initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await layOutBody(760);
  await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 96 }, privateText: 'never-log-native' } }));
  expect(nativeTrace.mock.calls.some(call => call[0] === 'scroll-reject' && call[1] === 96)).toBe(true);
  await readyList(1200, 400);
  expect(nativeTrace).toHaveBeenCalledWith('request', 160, 160, 1200, StyleSheet.flatten(list().props.style).height);
  await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 160 }, privateText: 'never-log-native' } }));
  expect(nativeTrace).toHaveBeenCalledWith('ack', 160, 160, 160);
  await tap('Otvori priliku Pomoć a');
  expect(nativeTrace.mock.calls.some(call => call[0] === 'preopen' && call[1] === 160 && call[2] === 160 && call[4] === 2)).toBe(true);
  await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
  expect(nativeTrace.mock.calls.some(call => call[0] === 'scroll0' && call[1] === true && call[2] === true && call[3] === -1 && call[6] === 160)).toBe(true);
  expect(JSON.stringify(nativeTrace.mock.calls)).not.toMatch(/never-log-native|Pomoć|Beograd|a:1/);
  expect(nativeTrace.mock.calls.every(call => call.slice(1).every((value: unknown) => typeof value === 'boolean' || typeof value === 'number'))).toBe(true);
});

test('diagnostic trace names the measured zero clamp separately from a search change', async () => {
  tracing = true; initial = { ...initial, sheet: 'full', listOffset: 160 };
  await render(); await readyList(300, 400);
  await measureEnd(300);
  expect(nativeTrace).toHaveBeenCalledWith('clamp0', 160, 300, StyleSheet.flatten(list().props.style).height, 160);
  expect(snapshot.listOffset).toBe(0);
  await search('bb');
  expect(nativeTrace.mock.calls.some(call => call[0] === 'search-change')).toBe(true);
});

test('one screen: the map under the tools and the list as its sheet; no Lista/Mapa switch and no "Pogledaj listu"', async () => {
  await render();
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['a', 'bb', 'ccc']);
  for (const retired of ['Lista', 'Mapa', 'Pogledaj listu', 'Prikaz zadataka']) expect(pressable(retired)).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
  expect(listSheet().props).toMatchObject({ enablePanDownToClose: false, enableDynamicSizing: false });
  expect(cards()).toEqual(['a', 'bb', 'ccc']);
  // Discovery V47: the search over the map is one pill that says the search in two lines and opens the panel; the words
  // searched there narrow the list, and the chip under the count takes them away again, keeping everything else.
  expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Svi zadaci, Bilo kada' });
  expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
  await search('bb');
  expect(snapshot.query).toBe('bb'); expect(cards()).toEqual(['bb']); expect(panel()).toHaveLength(0);
  expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: '„bb“, Bilo kada' });
  await tap('Ukloni uslov: „bb“'); expect(snapshot.query).toBe(''); expect(cards()).toEqual(['a', 'bb', 'ccc']);
});

test('portraits mount only for visible rows and unmount behind a pin, a collapsed sheet or an unfocused route', async () => {
  rows = rows.map(item => ({ ...item, narucilacIme: 'Ana', narucilacProfilId: 'profile-a' }));
  initial = { ...initial, sheet: 'full' }; await render();
  const portraits = () => list().findAllByType('TaskPublisherPortrait' as React.ElementType).map(node => node.props.item.id);
  expect(portraits()).toEqual([]);
  await act(async () => list().props.onViewableItemsChanged({ viewableItems: [
    { item: rows[0], isViewable: true }, { item: rows[1], isViewable: false },
  ] }));
  expect(portraits()).toEqual(['a']);
  await act(async () => map().props.onSelect('bb'));
  expect(portraits()).toEqual([]);
  // Closing a pin deliberately returns to the collapsed map sheet; photos resume only when the list opens.
  await tap('Zatvori pregled zadatka'); expect(portraits()).toEqual([]);
  await dragSheet(2); expect(portraits()).toEqual(['a']);
  await act(async () => listSheet().props.onChange(0)); expect(portraits()).toEqual([]);
  await act(async () => listSheet().props.onChange(1)); expect(portraits()).toEqual([]);
  await act(async () => listSheet().props.onChange(2)); expect(portraits()).toEqual(['a']);
  mockFocused = false; await update(); expect(portraits()).toEqual([]);
});

test('confirmed own, applied, other and uncovered tasks stay visible with distinct truthful labels on list and pin', async () => {
  rows = [row('mine'), row('other'), row('applied'), row('remote', { priblizno: null })];
  relations = relationIndex(['mine'], ['applied'], ['mine', 'other', 'applied']);
  await render();
  expect(cards()).toEqual(['mine', 'other', 'applied', 'remote']);
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['mine', 'other', 'applied', 'remote']);
  const relationOf = (id: string) => tree.root.findAllByType(CARD).find(node => node.props.item.id === id)!.props.relation;
  expect(relationOf('mine')).toBe('OWNED'); expect(relationOf('other')).toBeUndefined();
  expect(relationOf('applied')).toBe('APPLIED'); expect(relationOf('remote')).toBe('UNKNOWN');
  expect(texts()).toContain('Tvoj zadatak'); expect(texts()).toContain('Prijava poslata'); expect(texts()).toContain('Tvoj status nije potvrđen');
  // The top line stays a single glanceable count; its accessible name retains the map context.
  expect(texts()).toContain('4 zadatka');
  expect(countLine().props.accessibilityLabel).toBe('4 zadatka · 1 zadatak bez tačke na mapi');
  await act(async () => map().props.onSelect('mine'));
  expect(texts(peek()!)).toContain('Tvoj zadatak');
  await tap('Zatvori pregled zadatka');
  relations = undefined; relationsError = true; await update();
  expect(cards()).toEqual(['mine', 'other', 'applied', 'remote']); expect(texts()).toContain('4 zadatka');
  expect(texts()).not.toContain('Tvoj zadatak'); expect(texts()).not.toContain('Prijava poslata');
  await tap('Proveri status zadataka'); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => map().props.onSelect('mine'));
  expect(texts(peek()!)).toContain('Tvoj status nije potvrđen');
});

test.each([
  ['six tasks, four without a pin', 6, 4, 1],
  ['six tasks, all on the map', 6, 0, 0],
  ['two tasks on the map', 2, 0, 1],
  ['three tasks, none on the map', 3, 3, 2],
])('the sheet starts by pin coverage: %s', async (_name, count, withoutPin, index) => {
  rows = Array.from({ length: count }, (_, i) => row(`t${i}`, i < withoutPin ? { priblizno: null } : at(44.7 + i / 50, 20.4)));
  await render();
  expect(listSheet().props.index).toBe(index);
});

test('a ready map mounts at its actual peek detent and animates the first native draw', async () => {
  tracing = true;
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
  await render();
  expect(nativeTrace.mock.calls.find(call => call[0] === 'seed')?.at(-1)).toBe(0);
  expect(listSheet().props).toMatchObject({ index: 0, animateOnMount: true });
  expect(snapshot.sheet).toBe('peek');
  await layOutBody();
  expect(listSheet().props.animateOnMount).toBe(true);
  expect(countLine().props.accessibilityLabel).toBe('6 zadataka');
});

// Gorhom's `index` effect returns early while `animateOnMount` is set and its mount animation has not finished, and never re-runs: a request for
// another detent is then lost (React says FULL, the native sheet stays put; a dimmed empty screen with only the "Mapa" pill, found on the emulator).
// The P6 screen is rebuilt on every return, so it never depends on that animation, whichever detent it starts at. The legacy first draw keeps it.
test.each([
  ['remembered full', 'full', 2], ['remembered half', 'half', 1], ['remembered peek', 'peek', 0], ['first', undefined, 0],
] as const)('a P6 screen started at the %s detent mounts the native sheet there without animating in', async (_label, sheet, index) => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
  initial = { ...initial, ...(sheet ? { sheet } : {}), listOffset: 0 };
  p6Seam = p6Seam_();
  await render();
  expect(listSheet().props).toMatchObject({ index, animateOnMount: false });
});

// Android: a lost synchronous style write can leave a freshly mounted Gorhom body at its hidden mount props (opacity 0 / off-screen) while index and
// position already report the stop (found on the CI emulator after returns from a task). The P6 sheet is nudged by a hundredth of a pixel a few times
// after it mounts, so that Gorhom evaluates its position and Reanimated writes the body's style again, and it rests on its exact snap points.
const asPlatform = async (os: string, run: () => Promise<void>) => {
  const { Platform } = jest.requireActual('react-native');
  const before = Platform.OS; Platform.OS = os;
  try { await run(); } finally { Platform.OS = before; }
};
const kicks = () => nativeTrace.mock.calls.filter(call => call[0] === 'kick').map(call => call.slice(1));
test('the P6 sheet is nudged by a hundredth of a pixel after it mounts on Android, and rests on its exact snap points', async () => {
  await asPlatform('android', async () => {
    jest.useFakeTimers();
    try {
      rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
      initial = { ...initial, sheet: 'full', listOffset: 0 };
      p6Seam = p6Seam_(); tracing = true;
      await render(); await layOutBody();
      const exact = [...listSheet().props.snapPoints] as number[];
      expect(typeof exact[2]).toBe('number');
      const advance = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
      const resting = () => expect(listSheet().props.snapPoints).toEqual(exact);
      const nudged = () => {
        const now = listSheet().props.snapPoints as number[];
        expect(now[2]).toBeCloseTo(exact[2] - 0.01, 6); expect(now[0]).toBe(exact[0]); expect(now[1]).toBe(exact[1]);
      };
      await advance(399); resting();
      await advance(1); nudged();
      await advance(800); resting();
      await advance(1_400); nudged();
      await advance(2_400); resting();
      await advance(3_000); nudged();
      await advance(4_000); resting();
      await advance(60_000); resting();
      expect(kicks()).toEqual([[1, 400], [2, 1_200], [3, 2_600], [4, 5_000], [5, 8_000], [6, 12_000]]);
    } finally { jest.useRealTimers(); }
  });
});
test('the nudge follows the stop the sheet rests at, and the rest of the screen never reads the nudged points', async () => {
  await asPlatform('android', async () => {
    jest.useFakeTimers();
    try {
      rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
      initial = { ...initial, sheet: 'half', listOffset: 0 };
      p6Seam = p6Seam_();
      await render(); await layOutBody();
      const exact = [...listSheet().props.snapPoints] as number[];
      await act(async () => { jest.advanceTimersByTime(400); });
      const now = listSheet().props.snapPoints as number[];
      expect(now[1]).toBeCloseTo(exact[1] - 0.01, 6); expect(now[2]).toBe(exact[2]);
      // Mounted once: nudging is not a new native mount.
      expect(sheets().filter(node => !node.props.detached)).toHaveLength(1);
    } finally { jest.useRealTimers(); }
  });
});
test('a hand on the list ends the nudging: no later nudge springs the sheet (and locks the list) under a scroll', async () => {
  await asPlatform('android', async () => {
    jest.useFakeTimers();
    try {
      rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
      initial = { ...initial, sheet: 'full', listOffset: 0 };
      p6Seam = p6Seam_(); tracing = true;
      await render(); await layOutBody();
      const exact = [...listSheet().props.snapPoints] as number[];
      await act(async () => { jest.advanceTimersByTime(1_200); });          // nudges 1 and 2 have run (the second leaves the sheet on its exact points)
      expect(kicks()).toEqual([[1, 400], [2, 1_200]]);
      await act(async () => { list().props.onScrollBeginDrag({ nativeEvent: {} }); });
      await act(async () => { jest.advanceTimersByTime(60_000); });
      expect(kicks()).toEqual([[1, 400], [2, 1_200]]);
      expect(listSheet().props.snapPoints).toEqual(exact);
    } finally { jest.useRealTimers(); }
  });
});

// Independent review, finding 2: the restore watchdog ran while the list could not restore (the person lowered the sheet: the native list is locked), counted stalls, asked for the
// tail into the locked list (which resets it to the top) and finally settled, so the restore was over without the list ever being there.
test('a P6 restore does not count, scroll or settle while the list cannot restore; raising the sheet asks again', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 80 }, (_, i) => row(`gate${i}`));
    initial = { ...initial, sheet: 'full', listOffset: 8000 };
    p6Seam = p6Seam_(); tracing = true;
    await render(); await layOutBody();
    const frame = StyleSheet.flatten(list().props.style).height;
    await readyList(frame + 8000);
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    mockNativeSheetState.value = 1; await deliverUi();                       // OPENED: the sheet is not at its stop, the native list is locked
    await act(async () => { jest.advanceTimersByTime(RESTORE_STALL_MS * 6); });
    expect(stalls()).toEqual([]); expect(scrollToEnd).not.toHaveBeenCalled(); expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(acks()).toEqual([]);
    mockNativeSheetState.value = 2; await deliverUi();                       // back at its stop: the restore was never over, so it asks again
    expect(scrollToOffset.mock.calls.length).toBeGreaterThan(1);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 8000, animated: false });
  } finally { jest.useRealTimers(); }
});

test('the legacy reader, another platform and a screen that is not in front never nudge the sheet', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
    initial = { ...initial, sheet: 'full', listOffset: 0 }; tracing = true;
    const settle = async () => { await layOutBody(); const exact = [...listSheet().props.snapPoints]; await act(async () => { jest.advanceTimersByTime(30_000); });
      expect(listSheet().props.snapPoints).toEqual(exact); expect(kicks()).toEqual([]); };
    await asPlatform('android', async () => { p6Seam = undefined; await render(); await settle(); await act(async () => tree.unmount()); });
    await asPlatform('ios', async () => { p6Seam = p6Seam_(); await render(); await settle(); await act(async () => tree.unmount()); });
    await asPlatform('android', async () => { p6Seam = p6Seam_(); mockFocused = false; await render(); await settle(); });
  } finally { jest.useRealTimers(); }
});

test('while reading, the sheet is half open over breathing placeholders; the start is chosen once the read lands', async () => {
  loading = true; rows = []; await render();
  expect(listSheet().props.index).toBe(1); expect(texts()).toContain('Učitavamo zadatke…');
  // The top line is never blank: while the list is read it says so, and it is still the way into the list.
  expect(countLine().props.accessibilityLabel).toBe('Učitavamo zadatke…');
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
  loading = false; rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await update();
  expect(listSheet().props.index).toBe(0);
  // Chosen once: a later read does not move the sheet the person has placed.
  await dragSheet(1); rows = [...rows]; await update();
  expect(listSheet().props.index).toBe(1);
});

// Discovery V47: the in-header "Prikaži listu" / "Prikaži mapu" words are gone. Nothing is still reached by a gesture
// only: the top line itself is the button that opens the list, and at the full height a floating "Mapa" brings the map.
test('the sheet\'s top line opens the whole list in one tap; dragging still offers half height', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(pressable('Prikaži listu')).toHaveLength(0); expect(pressable('Prikaži mapu')).toHaveLength(0);
  expect(listSheet().props.index).toBe(0);
  expect(countLine().props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: '6 zadataka', accessibilityHint: 'Otvara celu listu.',
    accessibilityState: { expanded: false }, accessibilityLiveRegion: 'polite' });
  // Centred, as the one line the top of the sheet says.
  expect(StyleSheet.flatten(countLine().findByType('T' as React.ElementType).props.style).textAlign).toBe('center');
  await act(async () => countLine().props.onPress()); expect(listSheet().props.index).toBe(2);
  // At the full height the count is words, not a button: the way back to the map is "Mapa". They are still heard when
  // they change (a polite live region).
  expect(countLine()).toBeUndefined(); expect(texts()).toContain('6 zadataka');
  expect(tree.root.findByProps({ testID: 'list-count-words' }).props.accessibilityLiveRegion).toBe('polite');
  // The map's `onList` still opens the whole list (the prop's contract; the map draws no button for it here).
  await act(async () => listSheet().props.onChange(0)); await act(async () => map().props.onList()); expect(listSheet().props.index).toBe(2);
});

test.each([[1, '1 zadatak'], [3, '3 zadatka'], [5, '5 zadataka'], [11, '11 zadataka'], [21, '21 zadatak'], [24, '24 zadatka']])(
  'the top line counts %i tasks in honest Serbian: "%s"', async (count, words) => {
    rows = Array.from({ length: count }, (_, i) => row(`t${i}`, at(44 + i / 100, 20.4))); await render();
    expect(countLine().props.accessibilityLabel).toBe(words);
  });

test('at the full height a floating dark-green "Mapa" lowers the list to its top line; it fades only when motion is allowed', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(pressable('Mapa')).toHaveLength(0);
  await dragSheet(2);
  const pill = press('Mapa');
  expect(pill.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Spušta listu i prikazuje mapu.' });
  expect(StyleSheet.flatten(pill.props.style)).toMatchObject({ backgroundColor: sys.color.green, minHeight: 48 });
  expect(pill.findByType('MapTrifold' as React.ElementType).props.color).toBe(sys.color.onGreen);
  expect(StyleSheet.flatten(pill.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.onGreen);
  expect(pill.parent!.props.entering).toBeDefined();
  // It stands over the list's end, which keeps 80 clear under it (the pill is 48 high, 16 above the bottom).
  expect(StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(80);
  await tap('Mapa'); expect(listSheet().props.index).toBe(0); expect(pressable('Mapa')).toHaveLength(0);
  expect(StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom).toBe(sys.space.xxl);
  // Under reduced motion it is simply there, and simply gone.
  await act(async () => tree.unmount()); mockReduced = true; await render();
  await dragSheet(2);
  expect(press('Mapa').parent!.props.entering).toBeUndefined(); expect(press('Mapa').parent!.props.exiting).toBeUndefined();
  // A list with nothing on the map offers no way to a map that shows nothing.
  await act(async () => tree.unmount()); mockReduced = false; rows = [row('remote', { priblizno: null })]; await render();
  expect(listSheet().props.index).toBe(2); expect(pressable('Mapa')).toHaveLength(0);
});

// Discovery V47 (addendum 2, Airbnb's selected pin in USKOČI's look): one floating card over the map, just above the tab
// bar, with the list's top line stepped out of sight behind it. The WHOLE card opens the task; a round × in its corner, a
// tap on the empty map, a pull up of the list or Back close it, and closing brings the top line back.
test('a chosen pin opens one floating card whose whole face opens the task; ×, the empty map or a pull up close it and bring the top line back', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOutBody();
  const top = listSheet().props.snapPoints[0];
  expect(top).toBeGreaterThan(HIDDEN);
  await act(async () => map().props.onSelect('t1'));
  expect(snapshot).toMatchObject({ selectedId: 't1', selectedPlace: null }); expect(listSheet().props.index).toBe(0);
  expect(map().props.selectedId).toBe('t1');
  expect(peek()!.props).toMatchObject({ detached: true, accessibilityLabel: 'Zadatak na mapi', bottomInset: sys.space.md, handleComponent: null });
  expect(peek()!.props.backdropComponent).toBeUndefined();
  // The list's top line is not a second strip under the card: it sinks behind it, draws nothing there (no hairline, no
  // shadow as a sliver under the card), and a screen reader does not reach anything in it.
  expect(listSheet().props.snapPoints[0]).toBe(HIDDEN);
  expect(listSheet().props.accessibilityLabel).toBeNull();
  const content = () => listSheet().findByProps({ testID: 'list-sheet-content' });
  expect(content().props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  const Sunk = listSheet().props.backgroundComponent;
  let drawn!: ReactTestRenderer; await act(async () => { drawn = create(<Sunk style={{}} />); });
  expect(StyleSheet.flatten(drawn.root.findByType('View' as React.ElementType).props.style).opacity).toBe(0);
  // Its coming up is said to a screen reader: the focus stays on the map, so nothing else would tell it.
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Pregled zadatka: Pomoć t1');
  // No separate "Pogledaj zadatak" button: the whole card is the one press, named for what it opens.
  expect(tree.root.findAll(node => node.props.label === 'Pogledaj zadatak')).toHaveLength(0);
  const card = press('Otvori zadatak: Pomoć t1');
  expect(card.props.accessibilityRole).toBe('button');
  await act(async () => card.props.onPress()); expect(open).toHaveBeenCalledWith(rows[1]); expect(open.mock.calls[0][0].id).toBe('t1');
  // ×: the selection is cleared and the top line comes back.
  await tap('Zatvori pregled zadatka');
  expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  expect(listSheet().props.snapPoints[0]).toBe(top);
  expect(listSheet().props.accessibilityLabel).toBe('Lista zadataka');
  expect(content().props).toMatchObject({ accessibilityElementsHidden: false, importantForAccessibility: 'auto' });
  expect(listSheet().props.backgroundComponent).not.toBe(Sunk);
  // A tap on the empty map closes it too.
  await act(async () => map().props.onSelect('t2')); expect(peek()).toBeDefined();
  await act(async () => map().props.onClear()); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  // Pulling the list up is looking at the list: the card does not stay over it.
  await act(async () => map().props.onSelect('t0')); expect(peek()).toBeDefined();
  await dragSheet(1); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
});

// Emulator, round 3c: a card inside a card. The floating card is the card; what it says sits in it bare. Owner decision
// (2026-09-24): no photos in the list, the map preview or any card; a task's photos appear only in the task itself.
test('pin and discovery list keep the truthful task face without redundant surrounding frames', async () => {
  rows = [row('a'), row('bb', { naslov: 'Selidba klavira u Zemunu', podrucjeTekst: 'Zemun, Beograd', osnovaCene: 'TOTAL', narucilacIme: 'Mila',
    narucilacOcena: '4,8', narucilacBrojOcena: 12, pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 0.33 },
    schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T10:00:00+02:00', endsAt: '2026-09-26T12:00:00+02:00' }, taskTimezone: 'Europe/Belgrade' }),
  row('ponude', { rezimCene: 'OFFERS', ponudjenaCena: undefined })];
  await render();
  await act(async () => map().props.onSelect('bb'));
  const card = press('Otvori zadatak: Selidba klavira u Zemunu');
  const words = texts(peek()!);
  expect(words).toContain('Selidba klavira u Zemunu'); expect(words).toContain('Zemun, Beograd'); expect(words).toContain('26. sep · 10:00–12:00');
  expect(words).toContain('2.000 RSD'); expect(words).toContain('ukupno'); expect(words).toContain('1/3'); expect(words).toContain('Mila');
  expect(card.props.accessibilityValue.text).toContain('2.000 RSD ukupno');
  expect(card.props.accessibilityValue.text).toContain('1 od 3 mesta popunjeno');
  // Nothing in it is framed as a card of its own, and nothing is a photo or a place for one.
  const edged = card.findAll(node => String(node.type) === 'View' && (StyleSheet.flatten(node.props.style)?.borderWidth ?? 0) > 0);
  expect(edged).toHaveLength(0);
  // Bundled FactArt pictograms may use Image; task photos/remote image sources must still never enter these cards.
  const isTaskPhoto = (node: ReactTestInstance) => /Photo/i.test(String(node.type)) || /photo|foto/i.test(String(node.props.testID ?? ''))
    || (/Image/i.test(String(node.type)) && !!node.props.source?.uri);
  expect(peek()!.findAll(isTaskPhoto)).toHaveLength(0);
  expect(listSheet().findAll(isTaskPhoto)).toHaveLength(0);
  // A task that asks for offers says so in words that never look like an amount.
  await tap('Zatvori pregled zadatka'); await act(async () => map().props.onSelect('ponude'));
  expect(texts(peek()!)).toContain('Tražim ponude');
  // Each result is a distinct, scannable task card in the sheet.
  const listed = listSheet().findAllByType(CARD);
  expect(listed.length).toBeGreaterThan(0); expect(listed.every(node => node.props.compact && !node.props.bare)).toBe(true);
});

test('tasks on one public point are one place: its card says how many and each row opens its own task', async () => {
  rows = [row('s1', at(44.79, 20.45)), row('s2', at(44.7902, 20.4501)), row('other', at(44.9, 20.5))];
  await render();
  await act(async () => map().props.onSelect('s2'));
  expect(snapshot).toMatchObject({ selectedId: null, selectedPlace: '44.79,20.45' });
  expect(map().props.selectedPlace).toBe('44.79,20.45');
  expect(peek()!.props.accessibilityLabel).toBe('Zadaci na ovom mestu');
  expect(texts(peek()!)).toContain('2 zadatka na ovom mestu');
  // One verb for one action: each row says what the single card's action says (review r3 item 7).
  const inPeek = peek()!.findAll(node => String(node.type) === 'Press' && /^Pogledaj zadatak /.test(node.props.accessibilityLabel ?? ''));
  expect(inPeek.map(node => node.props.accessibilityLabel)).toEqual(['Pogledaj zadatak Pomoć s1', 'Pogledaj zadatak Pomoć s2']);
  expect(peek()!.findAll(node => /^Otvori priliku /.test(String(node.props.accessibilityLabel ?? '')))).toHaveLength(0);
  await act(async () => inPeek[1].props.onPress()); expect(open).toHaveBeenCalledWith(rows[1]);
  // The map's own place press lands on the same place; a place of one is just that task.
  await act(async () => map().props.onSelectPlace('44.90,20.50')); expect(snapshot).toMatchObject({ selectedId: 'other', selectedPlace: null });
});

// A selected place keeps mapped tasks at that point first, with point-free work in a separate section.
test('a crowded place lists its own tasks then point-free work, without widening its map area', async () => {
  rows = [...['p1', 'p2', 'p3', 'p4'].map(id => row(id, at(44.79, 20.45))), row('far', at(45.2, 19.8)),
    row('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
  await render();
  await act(async () => map().props.onSelectPlace('44.79,20.45'));
  expect(texts(peek()!)).toContain('4 zadatka na ovom mestu');
  await click('Prikaži sve u listi');
  expect(snapshot).toMatchObject({ pinPlace: '44.79,20.45', area: null, selectedPlace: null }); expect(listSheet().props.index).toBe(2);
  expect(cards()).toEqual(['p1', 'p2', 'p3', 'p4', 'online']);
  expect(tree.root.findAll(node => node.props.testID === 'section-remote')).toHaveLength(1);
  expect(tree.root.findAll(node => node.props.testID === 'section-unlocated')).toHaveLength(0);
  expect(texts(tree.root.findByProps({ testID: 'list-count-words' }))).toBe('5 zadataka');
  // The map still draws every task.
  expect(map().props.items).toHaveLength(6);
  // It is said by the search pill, "Na ovom mestu", and the pill's × takes it away; nothing is added under the count.
  expect(press('Pretraži zadatke').props.accessibilityValue.text).toMatch(/^Na ovom mestu, /);
  expect(removable()).toHaveLength(0);
  await tap('Prikaži sve zadatke'); expect(snapshot).toMatchObject({ pinPlace: null, area: null }); expect(cards()).toHaveLength(6);
  // The next move of the map the person makes lets it go as well, and the list follows the map's area again.
  await act(async () => map().props.onSelectPlace('44.79,20.45')); await click('Prikaži sve u listi');
  expect(snapshot.pinPlace).toBe('44.79,20.45');
  await act(async () => map().props.onArea([20.4, 44.7, 20.5, 44.9]));
  expect(snapshot).toMatchObject({ pinPlace: null, area: [20.4, 44.7, 20.5, 44.9] });
  expect(cards()).toEqual(['p1', 'p2', 'p3', 'p4', 'online']);
});

describe('Pretraga i uslovi (Discovery V47)', () => {
  const flexible = (kind: string) => ({ schedule: { kind, startsAt: null, endsAt: null } });
  beforeEach(() => { rows = [row('danas', flexible('TODAY_FLEXIBLE')), row('sutra', flexible('TOMORROW_FLEXIBLE')),
    row('ponude', { rezimCene: 'OFFERS', ponudjenaCena: undefined, ...flexible('TOMORROW_FLEXIBLE') })]; });
  const radio = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)[0];
  const choose = async (label: string) => act(async () => radio(label).props.onPress());
  const chip = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label
    && node.props.accessibilityState && 'selected' in node.props.accessibilityState)[0];

  test('a draft applied at once with "Prikaži N zadataka", which counts what the list will show', async () => {
    await render(); await tap('Uslovi pretrage');
    expect(panel()).toHaveLength(1);
    expect(showAction().props.label).toBe('Prikaži 3 zadatka');
    await choose('Sutra'); expect(showAction().props.label).toBe('Prikaži 2 zadatka');
    await tap('Cena'); await choose('Tražim ponude'); expect(showAction().props.label).toBe('Prikaži 1 zadatak');
    expect(radio('Tražim ponude').props.accessibilityState).toEqual({ checked: true });
    expect(snapshot.when).toBe('any'); // nothing applies before the person says so
    await act(async () => showAction().props.onPress());
    expect(snapshot).toMatchObject({ when: 'tomorrow', price: 'OFFERS' }); expect(cards()).toEqual(['ponude']);
    expect(panel()).toHaveLength(0);
    // "Uslovi pretrage" counts what is on, in green: the "+" beside it is the screen's one orange accent (review r3 item 6).
    expect(press('Uslovi pretrage, 2 aktivna')).toBeTruthy();
    const badge = press('Uslovi pretrage, 2 aktivna').findByProps({ testID: 'conditions-badge' });
    expect(StyleSheet.flatten(badge.props.style).backgroundColor).toBe(sys.color.ink);
    expect(texts(badge)).toBe('2');
    // The pill says them, and each one that is on is a chosen quick chip that takes itself away.
    expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Svi zadaci, Sutra · Tražim ponude' });
    expect(chip('Sutra').props.accessibilityState).toEqual({ selected: true });
    await act(async () => chip('Sutra').props.onPress()); expect(snapshot.when).toBe('any');
    await act(async () => chip('Tražim ponude').props.onPress()); expect(snapshot.price).toBe('all'); expect(cards()).toHaveLength(3);
    expect(press('Uslovi pretrage')).toBeTruthy();
  });
  test('closing the panel any other way leaves the list exactly as it was; "Obriši uslove" empties the draft', async () => {
    await render(); await tap('Uslovi pretrage');
    await choose('Danas'); await tap('Koliko vas dolazi'); await act(async () => press('Povećaj broj osoba').props.onPress());
    await tap('Zatvori pretragu');
    expect(panel()).toHaveLength(0);
    expect(snapshot).toMatchObject({ when: 'any', places: 1, price: 'all' });
    await tap('Uslovi pretrage');
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true }); // the discarded draft is gone
    await choose('Danas'); await tap('Cena'); await choose('Navedena cena');
    await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Obriši uslove')!.props.onPress());
    expect(radio('Sve').props.accessibilityState).toEqual({ checked: true });
    await tap('Kada');
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true });
    expect(showAction().props.label).toBe('Prikaži 3 zadatka');
  });
  test('"Kako se radi" is offered only when a task says how it is done, in the panel and as quick chips', async () => {
    await render(); await tap('Uslovi pretrage');
    expect(texts()).not.toContain('Kako se radi'); expect(texts()).toContain('Kada'); expect(texts()).toContain('Koliko vas dolazi');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Na daljinu')).toHaveLength(0);
    await tap('Zatvori pretragu'); await act(async () => tree.unmount());
    rows = [...rows, row('daljina', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
    await render(); await tap('Uslovi pretrage');
    expect(texts()).toContain('Kako se radi');
    await tap('Kako se radi'); await choose('Na daljinu'); expect(showAction().props.label).toBe('Prikaži 1 zadatak');
    await tap('Zatvori pretragu');
    expect(chip('Na daljinu').props.accessibilityState).toEqual({ selected: false });
  });
  // Discovery V47: the chips over the map toggle the very filters the panel sets, at once, and only those the loaded tasks
  // can back (a task that says how it is done; a price mode some task uses; a task with two open places).
  test('a quick chip toggles the same filter the panel sets, and only chips the tasks can back are offered', async () => {
    // The three-person draft must match a real row so the apply action can actually be pressed.
    rows = rows.map(item => item.id === 'ponude' ? { ...item, pokrivenost: { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 } } : item);
    await render();
    const offered = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityState && 'selected' in node.props.accessibilityState
      && !/^Uslovi|^Dodaj/.test(node.props.accessibilityLabel)).map(node => node.props.accessibilityLabel);
    expect(offered()).toEqual(['Danas', 'Sutra', 'Ove nedelje', 'Navedena cena', 'Tražim ponude', '2+ mesta']);
    await act(async () => chip('Danas').props.onPress());
    expect(snapshot.when).toBe('today'); expect(cards()).toEqual(['danas']);
    await tap('Uslovi pretrage, 1 aktivan');
    expect(radio('Danas').props.accessibilityState).toEqual({ checked: true });
    // The panel's choice shows on the chip the same way.
    await choose('Sutra'); await act(async () => showAction().props.onPress());
    expect(chip('Sutra').props.accessibilityState).toEqual({ selected: true }); expect(chip('Danas').props.accessibilityState).toEqual({ selected: false });
    await act(async () => chip('2+ mesta').props.onPress()); expect(snapshot.places).toBe(2);
    await act(async () => chip('2+ mesta').props.onPress()); expect(snapshot.places).toBe(1);
    // The choice the panel can make beyond two people is said on the same chip, and removed by it.
    await tap('Uslovi pretrage, 1 aktivan');
    await tap('Koliko vas dolazi');
    for (const _ of [1, 2]) await act(async () => press('Povećaj broj osoba').props.onPress());
    expect(showAction().props).toMatchObject({ label: 'Prikaži 1 zadatak', disabled: false });
    await act(async () => showAction().props.onPress());
    expect(snapshot.places).toBe(3); expect(chip('3+ mesta').props.accessibilityState).toEqual({ selected: true });
  });
  test('a place chosen in "Gde" is said by the pill and under the count, and taken away there', async () => {
    rows = [row('a', { podrucjeTekst: 'Liman, Novi Sad' }), row('b', { podrucjeTekst: 'Vračar, Beograd' })];
    await render(); await tap('Pretraži zadatke');
    await choose('Vračar, Beograd, 1 zadatak'); await act(async () => showAction().props.onPress());
    expect(snapshot.place).toBe('Vračar, Beograd'); expect(cards()).toEqual(['b']);
    expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Vračar, Beograd, Bilo kada' });
    await tap('Ukloni uslov: Vračar, Beograd'); expect(snapshot.place).toBeNull(); expect(cards()).toEqual(['a', 'b']);
  });
});

test('secondary entries stay reachable from one menu without taking map space with a second header', async () => {
  await render();
  expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
  expect(press('Pretraži zadatke')).toBeTruthy();
  await tap('Još mogućnosti');
  const menu = tree.root.findByType(ActionSheet);
  expect(menu.props.actions.map((action: { label: string }) => action.label)).toEqual(['Objavi zadatak', 'Moj profil']);
  expect(newTask).not.toHaveBeenCalled(); expect(profile).not.toHaveBeenCalled();
  await act(async () => menu.props.actions[0].onPress()); expect(newTask).toHaveBeenCalledTimes(1);
  await act(async () => menu.props.actions[1].onPress()); expect(profile).toHaveBeenCalledTimes(1);
  await act(async () => menu.props.onClose());
  expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
});

test('reading, not read and nothing in this view keep their meanings, through the one state view', async () => {
  error = true; rows = []; await render();
  expect(texts()).toContain('Zadatke trenutno nije moguće učitati'); await click('Pokušaj ponovo'); expect(refresh).toHaveBeenCalledTimes(1);
  // The top line says it too, never a blank.
  expect(countLine().props.accessibilityLabel).toBe('Zadaci nisu učitani');
  await act(async () => tree.unmount());
  error = false; rows = []; await render();
  // Owner, 2026-10-07: the map and the list always show every task, so nothing found is never about the person's profile.
  expect(texts()).toContain('Trenutno nema otvorenih zadataka'); expect(texts()).toContain('Kad neko objavi zadatak, videćeš ga ovde i na mapi.');
  expect(texts()).not.toContain('radnom profilu'); expect(action('Dopuni radni profil')).toBeUndefined();
  refresh.mockClear(); await click('Osveži zadatke'); expect(refresh).toHaveBeenCalledTimes(1); expect(profile).not.toHaveBeenCalled();
  expect(countLine().props.accessibilityLabel).toBe('Nema zadataka');
  await act(async () => tree.unmount());
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(listSheet().props.index).toBe(0);
  // Words that find nothing: the panel's one action says so and cannot apply them; the list keeps what it had.
  await tap('Pretraži zadatke'); await act(async () => press('Pretraži mesta i zadatke').props.onChangeText('nema takvog'));
  expect(showAction().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
  await tap('Zatvori pretragu'); expect(snapshot.query).toBe('');
  // A list that is already empty under its search (a search kept from before) rises so the reason is seen.
  await act(async () => tree.unmount()); initial = { ...initial, query: 'nema takvog' }; await render();
  expect(texts()).toContain('Nema zadataka u ovom prikazu'); expect(listSheet().props.index).toBe(1);
  // The one reset of the app: "Obriši uslove", on the empty list as in the panel.
  expect(tree.root.findAll(node => node.props.label === 'Poništi filtere')).toHaveLength(0);
  await click('Obriši uslove'); expect(snapshot.query).toBe(''); expect(cards()).toHaveLength(6);
});

test.each(['loading','error'] as const)('an incomplete %s collection never claims an authoritative empty filtered result',async status=>{
  collectionStatus=status;rows=[row('published')];
  initial={...initial,query:'nema ovih reči',sheet:'full'};
  await render();
  expect(cards()).toEqual([]);
  expect(texts()).toContain(status==='loading'?'Učitavamo zadatke…':'Zadatke trenutno nije moguće učitati');
  expect(texts()).toContain(status==='loading'?'Učitavamo ostale zadatke…':'Ostali zadaci nisu učitani');
  expect(texts()).not.toContain('Nema zadataka u ovom prikazu');
  expect(texts()).not.toContain('Trenutno nema otvorenih zadataka');
  expect(action('Dopuni radni profil')).toBeUndefined();
  expect(action('Obriši uslove')).toBeUndefined();
});

test.each(['loading','error'] as const)('an incomplete %s collection outside the map area remains unknown, not empty',async status=>{
  collectionStatus=status;rows=[row('published',at(44.8,20.4))];
  initial={...initial,area:[19.7,45.1,19.9,45.3],sheet:'full'};
  await render();
  expect(cards()).toEqual([]);
  expect(map().props.items).toHaveLength(1);
  expect(texts()).toContain(status==='loading'?'Učitavamo zadatke…':'Zadatke trenutno nije moguće učitati');
  expect(texts()).not.toContain('Nema zadataka u ovoj oblasti');
  expect(action('Prikaži sve zadatke')).toBeUndefined();
});

test('pull to refresh is the list\'s own; the list follows the area the map hands up, and the pill\'s × takes it away', async () => {
  refreshing = true; await render();
  expect(list().props.refreshing).toBe(true);
  await act(async () => list().props.onRefresh()); expect(refresh).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(0);
  await act(async () => map().props.onArea([20, 44, 21, 45])); expect(snapshot.area).toEqual([20, 44, 21, 45]);
  await tap('Prikaži sve zadatke'); expect(snapshot.area).toBeNull();
});

// Review of V47, item 3: the "Ova oblast ×" chip under the count came and went with every move of the map, and the
// sheet's measured top line, and the sheet with it, jumped each time. The area is said by the search pill instead, whose
// × at its right end takes it away; the × lies over the pill's end, so the pill is exactly as tall with it as without.
test('a map area adds nothing under the count; the search pill says it, and its × (48 wide, over its end) takes it away', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(tree.root.findAllByProps({ testID: 'clear-where' })).toHaveLength(0);
  const before = StyleSheet.flatten(press('Pretraži zadatke').props.style);
  await act(async () => map().props.onArea([20.3, 44.7, 20.5, 44.9]));
  expect(removable()).toHaveLength(0);
  const clear = tree.root.findByProps({ testID: 'clear-where' });
  expect(clear.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Prikaži sve zadatke', hitSlop: 0 });
  expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ position: 'absolute', top: 0, bottom: 0, width: 48 });
  const after = StyleSheet.flatten(press('Pretraži zadatke').props.style);
  expect([after.minHeight, after.paddingVertical, after.borderWidth]).toEqual([before.minHeight, before.paddingVertical, before.borderWidth]);
  expect(after.paddingRight).toBe(48);
  expect(press('Pretraži zadatke').props.accessibilityValue.text).toMatch(/^Ova oblast, /);
  await tap('Prikaži sve zadatke'); expect(snapshot.area).toBeNull();
  expect(tree.root.findAllByProps({ testID: 'clear-where' })).toHaveLength(0);
});

// Discovery V47: the list follows the map, and the map keeps every pin whatever the area. A task with no public point
// (online work, or a task placed nowhere) is never lost to an area. Distinct headings explain each kind without
// inventing a coordinate or interpreting a missing point as remote work.
test('with or without a map area, remote and unlocated tasks remain distinct real groups with exact counts', async () => {
  rows = [row('in1', at(44.81, 20.41)), row('far', at(45.5, 19.5)), row('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }),
    row('in2', at(44.82, 20.42)), row('nowhere', { priblizno: null })];
  await render();
  expect(cards()).toEqual(['in1', 'far', 'in2', 'online', 'nowhere']);
  expect(countLine().props.accessibilityLabel).toBe('5 zadataka · 2 zadatka bez tačke na mapi');
  expect(texts(tree.root.findByProps({ testID: 'section-remote' }))).toBe('Na daljinu 1');
  expect(texts(tree.root.findByProps({ testID: 'section-unlocated' }))).toBe('Bez označenog mesta 1');
  expect(texts(tree.root.findByProps({ testID: 'section-map' }))).toBe('Na mapi 3');
  await act(async () => map().props.onArea([20.3, 44.7, 20.5, 44.9]));
  expect(cards()).toEqual(['in1', 'in2', 'online', 'nowhere']);
  const heading = tree.root.findAll(node => node.props.testID === 'section-remote');
  expect(heading).toHaveLength(1);
  expect(heading[0].props).toMatchObject({ accessibilityRole: 'header', accessibilityLabel: 'Na daljinu, 1 zadatak' });
  expect(texts(heading[0])).toBe('Na daljinu 1');
  expect(texts(countLine())).toBe('4 zadatka');
  // The heading stands right before the first task without a point.
  const order = listSheet().findAll(node => ['section-map', 'section-remote', 'section-unlocated'].includes(node.props.testID)
    || (String(node.type) === 'Press' && /^Otvori priliku /.test(node.props.accessibilityLabel ?? ''))).map(node => node.props.testID ?? node.props.accessibilityLabel);
  expect(order).toEqual(['section-map', 'Otvori priliku Pomoć in1', 'Otvori priliku Pomoć in2', 'section-remote', 'Otvori priliku Pomoć online', 'section-unlocated', 'Otvori priliku Pomoć nowhere']);
  expect(countLine().props.accessibilityLabel).toBe('2 zadatka u oblasti · 2 zadatka bez tačke na mapi');
  // The map keeps every pin: moving it never takes one away.
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['in1', 'far', 'online', 'in2', 'nowhere']);
  // An area with none of its own still keeps the tasks without a point, and says so.
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  expect(cards()).toEqual(['online', 'nowhere']); expect(countLine().props.accessibilityLabel).toBe('U oblasti nema zadataka · 2 zadatka bez tačke na mapi');
  expect(texts(countLine())).toBe('2 zadatka');
  // "Prikaži N zadataka" counts the same list.
  await tap('Uslovi pretrage');
  expect(showAction().props.label).toBe('Prikaži 2 zadatka');
});

test('an area that holds nothing says so and offers every task back; the sheet the person placed stays where it is', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(listSheet().props.index).toBe(0);
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  // Moving the map never moves the sheet: the reason is on the top line itself.
  expect(listSheet().props.index).toBe(0); expect(countLine().props.accessibilityLabel).toBe('U oblasti nema zadataka');
  expect(texts()).toContain('Nema zadataka u ovoj oblasti');
  await click('Prikaži sve zadatke'); expect(snapshot.area).toBeNull(); expect(cards()).toHaveLength(6);
});

test('a chosen pin is never dropped when the list follows the map, and the same area twice changes nothing', async () => {
  await render();
  await act(async () => map().props.onSelect('bb'));
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  expect(snapshot).toMatchObject({ selectedId: 'bb', area: [0, 0, 1, 1] }); expect(peek()).toBeDefined();
  const before = snapshot;
  await act(async () => map().props.onArea([0, 0, 1, 1])); expect(snapshot).toBe(before);
});

test('choosing a place in the search brings its pins into view once, as the camera\'s own move, and never sets the area', async () => {
  rows = [row('ns1', { podrucjeTekst: 'Liman, Novi Sad', ...at(45.24, 19.84) }), row('ns2', { podrucjeTekst: 'Liman, Novi Sad', ...at(45.25, 19.85) }),
    row('bg', { podrucjeTekst: 'Vračar, Beograd', ...at(44.8, 20.47) })];
  initial = { ...initial, area: [20.4, 44.7, 20.6, 44.9] };
  await render();
  expect(map().props.fitTo).toBeNull();
  await tap('Pretraži zadatke'); await act(async () => radioOf('Liman, Novi Sad, 2 zadatka').props.onPress());
  await act(async () => showAction().props.onPress());
  expect(snapshot).toMatchObject({ place: 'Liman, Novi Sad', area: null });
  expect(map().props.fitTo).toMatchObject({ key: 1, bounds: [19.82, 45.22, 19.87, 45.27] });
  // The map says it brought them into view; the request is then gone, so a map mounted again does not fly there again.
  await act(async () => map().props.onFitted(1)); expect(map().props.fitTo).toBeNull();
  // Applying the same place again does not fly the map again.
  await tap('Pretraži zadatke'); await act(async () => showAction().props.onPress()); expect(map().props.fitTo).toBeNull();
});

// Discovery V47: where the sheet rests, how far the list is scrolled and where the camera stands live in the route's view
// (in memory), so a return to Zadaci finds all three as they were.
test('where the sheet rests and how far the list is scrolled are kept in the route\'s view and found again', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 12 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
    expect(snapshot.sheet).toBe('peek');
    await dragSheet(2); expect(snapshot.sheet).toBe('full');
    await readyList();
    const list = () => tree.root.findByType('List' as React.ElementType);
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 640 } } }));
    expect(snapshot.listOffset).toBeUndefined();
    await act(async () => { jest.advanceTimersByTime(OFFSET_SETTLE_MS); });
    expect(snapshot.listOffset).toBe(640);
    // The screen is drawn again from the view it left (the camera was already kept there).
    const kept = snapshot; await act(async () => tree.unmount()); initial = kept; scrollToOffset.mockReset(); await render();
    expect(listSheet().props.index).toBe(2);
    await readyList();
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false });
    // A list read anew (it was empty while it read) is scrolled back where it was once it has rows again.
    scrollToOffset.mockReset(); loading = true; await update(); loading = false; await update(); await readyList();
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false });
    // A new search starts the list at its top.
    scrollToOffset.mockReset(); await act(async () => map().props.onArea([20.3, 44.6, 20.5, 45]));
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false }); expect(snapshot.listOffset).toBe(0);
  } finally { jest.useRealTimers(); }
});

// Review of V47, item 13: folding the chips gives the list their room; a list only a little longer than its window then
// fit, fell back to its top and brought them back, over and over. They now fold only for a list that stays longer than
// its window without them, and come back only at its very top.
test('at the full height the quick chips fold only for a list longer than its window without them, and return at its top', async () => {
  jest.useFakeTimers();
  try {
    mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };
    rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOutBody();
    const chips = () => tree.root.findAllByProps({ accessibilityLabel: 'Brzi filteri' });
    const scroll = async (y: number) => act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y } } }));
    await act(async () => list().props.onContentSizeChange(400, 3000));
    await scroll(300);
    expect(chips()).toHaveLength(1); // not at the full height
    await dragSheet(2);
    await readyList();
    const [low, , full] = listSheet().props.snapPoints as number[];
    const window = full - low;
    // A list only a little longer than its window (less than the chips' room, 56, and 8 more): the chips stay.
    await scroll(0); await act(async () => list().props.onContentSizeChange(400, window + 60)); await scroll(30);
    expect(chips()).toHaveLength(1);
    // A long list folds them once scrolled; the pill stays.
    await act(async () => list().props.onContentSizeChange(400, window + 64)); await scroll(30);
    expect(chips()).toHaveLength(0); expect(press('Pretraži zadatke')).toBeTruthy();
    // Back up a little: still folded. At the very top: back.
    await scroll(4); expect(chips()).toHaveLength(0);
    await scroll(0); expect(chips()).toHaveLength(1);
    // The Filteri toolbar stays mounted: a separate 60dp rail plus its 8dp gap reclaims 68dp. The 8dp hysteresis remains.
    await act(async () => chips()[0].props.onLayout({ nativeEvent: { layout: { height: 60 } } }));
    await act(async () => list().props.onContentSizeChange(400, window + 70)); await scroll(30);
    expect(chips()).toHaveLength(1);
    await scroll(0); await act(async () => list().props.onContentSizeChange(400, window + 76)); await scroll(30);
    expect(chips()).toHaveLength(0);
  } finally { jest.useRealTimers(); }
});

// Review r3 item 4: a list whose tasks all lack a pin must be seen, not left under a top line over an empty map.
test('when a search or filter leaves only tasks without a point on the map, the list rises to the whole screen', async () => {
  rows = [...Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))), row('prevod', { priblizno: null })];
  await render();
  expect(listSheet().props.index).toBe(0);
  await search('prevod');
  expect(cards()).toEqual(['prevod']);
  expect(listSheet().props.index).toBe(2);
  // A new filter with no map result also opens the usable list from half height.
  await tap('Ukloni uslov: „prevod“'); await dragSheet(1);
  await search('prevod'); expect(listSheet().props.index).toBe(2);
});

// DN-01: ownership labels are independent of public count and sheet geometry.
test('pending, confirmed and failed ownership keep identical counts, rows and sheet start', async () => {
  rows = Array.from({ length: 5 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); relationsPending = true;
  await render();
  expect(texts()).toContain('5 zadataka'); expect(listSheet().props.index).toBe(0);
  expect(texts()).toContain('Proveravam tvoj status…');
  relations = relationIndex(['t0', 't1']); relationsPending = false; await update();
  expect(texts()).toContain('5 zadataka'); expect(listSheet().props.index).toBe(0);
  // A failed read is not pending: the list counts what it shows.
  await act(async () => tree.unmount()); relations = undefined; await render();
  expect(texts()).toContain('5 zadataka');
});

// Review r3 item 3: the first fit of the pins keeps them above where the sheet starts.
test('camera layout is ready only after body and tools measurements replace whole-window estimates', async () => {
  mockWindow = { width: 411, height: 924, scale: 2.625, fontScale: 1 };
  rows = [row('one', at(45.25, 19.83)), row('two', at(45.26, 19.85))];
  await render();
  expect(map().props.cameraLayoutReady).toBe(false);
  expect(map().props.fitBottom).toBe(474);
  await layOutBody(790);
  expect(map().props.cameraLayoutReady).toBe(false);
  await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(124));
  expect(map().props.cameraLayoutReady).toBe(true);
  expect(map().props.fitBottom).toBe(407);
  expect(listSheet().props.snapPoints[1]).toBe(395);
});

test('the map is told where the sheet starts, so the first fit keeps the pins above it', async () => {
  const layOut = async () => layOutBody(800);
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOut();
  // The source strip lives below search, already in top camera padding; it is not counted again at the bottom.
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[0] + sys.space.md);
  await act(async () => tree.unmount());
  rows = rows.slice(0, 3); await render(); await layOut();
  expect(listSheet().props.index).toBe(1);
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[1] + sys.space.md);
  expect(map().props.fitBottom).toBeGreaterThan(listSheet().props.snapPoints[0] + sys.space.md);
});

// DN-01: the same map fits every visible public pin before the labels arrive.
test('the map mounts without waiting for ownership and keeps the same pins after it resolves', async () => {
  rows = Array.from({ length: 5 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); relationsPending = true;
  await render();
  const body = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
    && JSON.stringify(StyleSheet.flatten(node.props.style)) === JSON.stringify({ flex: 1 }))[0];
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(1);
  expect(map().props.items).toHaveLength(5);
  const publicPins = map().props.items;
  relations = relationIndex(['t0', 't1']); relationsPending = false; await update();
  expect(map().props.items).toHaveLength(5);
  expect(map().props.items).toBe(publicPins);
  expect(listSheet().props.index).toBe(0);
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[0] + sys.space.md);
  // A later read of the labels (a new list) does not take the map away again.
  relationsPending = true; await update();
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(1);
});

// The card sits just above the tab bar (its gap under it counts) and spans its whole face, padding included.
// Fixed zoom uses its measured cover only to hide when covered; the source strip never follows the card.
test('a chosen pin\'s card tells the map how much it covers, and closing it gives that back', async () => {
  await render();
  expect(map().props.coverBottom).toBe(0);
  await act(async () => map().props.onSelect('bb'));
  const card = tree.root.findByType(DiscoveryPeek);
  const whole = card.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function' && node.props.onLayout.name === 'measureCard');
  expect(whole).toHaveLength(1);
  await act(async () => whole[0].props.onLayout({ nativeEvent: { layout: { height: 200 } } }));
  expect(map().props.coverBottom).toBe(200 + sys.space.md + sys.space.md);
  await tap('Zatvori pregled zadatka'); expect(peek()).toBeUndefined(); expect(map().props.coverBottom).toBe(0);
  // A place's rows sit in the card's padding, which is added to them.
  rows = [row('s1', at(44.79, 20.45)), row('s2', at(44.79, 20.45))]; await act(async () => tree.unmount()); await render();
  await act(async () => map().props.onSelectPlace('44.79,20.45'));
  const content = tree.root.findByType(DiscoveryPeek).findAll(node => String(node.type) === 'View' && node.props.onLayout?.name === 'measureRows');
  await act(async () => content[0].props.onLayout({ nativeEvent: { layout: { height: 150 } } }));
  expect(map().props.coverBottom).toBe(2 * sys.space.base + 150 + sys.space.md + sys.space.md);
  await tap('Zatvori pregled zadataka'); expect(peek()).toBeUndefined();
});

// Review of V47, item 11 (restores the weakened test): a sheet at its top line rises to half when a filter leaves
// nothing, so the reason can be read. The list here starts at its top line (six tasks, all on the map), and the one
// thing that changes is a quick chip; without the rise the sheet would stay at its top line.
test('a sheet resting at its top line rises to half when a quick chip leaves nothing, so the reason is seen', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, { ...at(44.7 + i / 50, 20.4), ...tomorrowFlexible }));
  await render();
  expect(listSheet().props.index).toBe(0);
  await act(async () => quick('Danas').props.onPress());
  expect(snapshot.when).toBe('today'); expect(cards()).toEqual([]);
  expect(texts()).toContain('Nema zadataka u ovom prikazu');
  expect(listSheet().props.index).toBe(1);
});

// A full empty list retains a quiet map return beside its primary search recovery action.
test('an empty list can remain fully open over the map without duplicating its green recovery action', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, { ...at(44.7 + i / 50, 20.4), ...tomorrowFlexible }));
  // A camera the person already looked at: the map stays even when the filter leaves no pin on it.
  initial = { ...initial, viewport: { center: [20.4, 44.8], zoom: 11, bounds: [20.2, 44.6, 20.6, 45] } };
  await render();
  await dragSheet(2); expect(press('Mapa')).toBeTruthy();
  await act(async () => quick('Danas').props.onPress());
  expect(cards()).toEqual([]); expect(listSheet().props.index).toBe(2);
  expect(StyleSheet.flatten(press('Mapa').props.style).backgroundColor).toBe(sys.color.surface);
  expect(action('Obriši uslove')).toBeDefined();
  // Its top line remains a count; the full recovery surface is not forced back to half height.
  expect(countLine()).toBeUndefined(); expect(texts(tree.root.findByProps({ testID: 'list-count-words' }))).toBe('Nema zadataka');
  await act(async () => listSheet().props.onChange(2)); expect(listSheet().props.index).toBe(2); expect(press('Mapa')).toBeDefined();
  // With tasks again, the whole list is open to it.
  await act(async () => quick('Danas').props.onPress()); await dragSheet(2);
  expect(listSheet().props.index).toBe(2); expect(press('Mapa')).toBeTruthy();
});

// Review of V47, item 14: Back with the whole list up over the map lowers it, as it closes the card and the panel.
test('Android Back with the whole list up over the map lowers it to its top line, only while the screen is in front', async () => {
  const listeners: (() => boolean)[] = [], remove = jest.fn();
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
    listeners.push(handler); return { remove };
  }) as never);
  try {
    rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
    expect(listeners).toHaveLength(0);
    await dragSheet(2);
    expect(listeners).toHaveLength(1);
    let consumed = false; await act(async () => { consumed = listeners[0](); });
    expect(consumed).toBe(true); expect(listSheet().props.index).toBe(0); expect(remove).toHaveBeenCalledTimes(1);
    // A task opened over the map: Back belongs to it, not to this list.
    mockFocused = false; await act(async () => listSheet().props.onChange(2));
    expect(listeners).toHaveLength(1);
    // A list with nothing on the map takes the whole screen; Back then leaves the screen as usual.
    mockFocused = true; await act(async () => tree.unmount()); rows = [row('remote', { priblizno: null })]; listeners.length = 0; await render();
    expect(listSheet().props.index).toBe(2); expect(listeners).toHaveLength(0);
  } finally { spy.mockRestore(); }
});

// Review of V47, item 12: a restore still waiting for the rows must not pull the list away from the person, and a scroll
// not yet written when a task is opened must not be lost (the route takes no changes once the task is in front).
test('a waiting restore is dropped when the list is taken hold of or refreshed; opening a task writes the scroll first', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 12 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
    initial = { ...initial, sheet: 'full', listOffset: 640 }; await render();
    expect(scrollToOffset).not.toHaveBeenCalled();
    // The person takes hold of the list before the rows are long enough: the list is not moved under their finger.
    scrollToOffset.mockReset();
    await act(async () => list().props.onScrollBeginDrag({ nativeEvent: {} }));
    await readyList(2000);
    expect(scrollToOffset).not.toHaveBeenCalled();
    // A refresh drops it too.
    await act(async () => tree.unmount()); scrollToOffset.mockReset(); await render();
    expect(scrollToOffset).not.toHaveBeenCalled(); scrollToOffset.mockReset();
    await act(async () => list().props.onRefresh()); expect(refresh).toHaveBeenCalledTimes(1);
    await readyList(2000);
    expect(scrollToOffset).not.toHaveBeenCalled();
    // Scrolled, and a task opened at once: the scroll is written before the task opens.
    open.mockImplementation(() => { navigated = true; });
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }));
    await tap('Otvori priliku Pomoć t3');
    expect(open).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(OFFSET_SETTLE_MS * 2); });
    expect(snapshot.listOffset).toBe(300);
  } finally { jest.useRealTimers(); }
});

// Review of V47, item 9: TalkBack hears the count line (a polite live region); iOS has none, so VoiceOver hears the new
// count once the list's area has stayed still for a second (a new move inside that second starts it again).
test('on iOS the new count is said once the list\'s area has stayed still for a second', async () => {
  jest.useFakeTimers();
  try {
    rows = [row('in1', at(44.81, 20.41)), row('in2', at(44.82, 20.42)), row('far', at(45.5, 19.5))]; await render();
    const announce = AccessibilityInfo.announceForAccessibility as jest.Mock; announce.mockClear();
    await act(async () => map().props.onArea([20.3, 44.7, 20.5, 44.9]));
    await act(async () => { jest.advanceTimersByTime(AREA_ANNOUNCE_MS / 2); });
    await act(async () => map().props.onArea([20.3, 44.7, 20.6, 44.9]));
    await act(async () => { jest.advanceTimersByTime(AREA_ANNOUNCE_MS - 1); }); expect(announce).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(announce.mock.calls).toEqual([['2 zadatka u oblasti']]);
    // A screen left before the second is over says nothing.
    await act(async () => map().props.onArea([0, 0, 1, 1])); mockFocused = false; await update();
    await act(async () => { jest.advanceTimersByTime(AREA_ANNOUNCE_MS * 2); }); expect(announce).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('the search panel waits for public rows, but counts them while ownership is still pending', async () => {
  loading = true; rows = []; await render();
  expect(press('Pretraži zadatke').props.accessibilityValue.text).not.toMatch(/\d+ zadat/);
  await tap('Uslovi pretrage');
  expect(action('Učitavamo zadatke…').props.disabled).toBe(true);
  await tap('Gde'); expect(radioOf('Svi zadaci')).toBeDefined();
  await tap('Zatvori pretragu'); await act(async () => tree.unmount());
  loading = false; relationsPending = true; rows = [row('a'), row('bb')]; await render();
  await tap('Pretraži zadatke');
  expect(action('Prikaži 2 zadatka').props.disabled).toBe(false); expect(radioOf('Svi zadaci, 2 zadatka')).toBeDefined();
  await tap('Zatvori pretragu'); await act(async () => tree.unmount());
  relationsPending = false; error = true; rows = []; await render(); await tap('Uslovi pretrage');
  expect(action('Zadaci nisu učitani').props.disabled).toBe(true);
});

// Review of V47, item 20: "now" is read again when the panel opens, so a panel opened after midnight knows the new day.
test('the search panel reads today again when it opens', async () => {
  jest.useFakeTimers({ now: new Date('2026-09-24T21:58:00Z') });
  try {
    await render();
    jest.setSystemTime(new Date('2026-09-24T22:02:00Z')); // 00:02 on the 25th in Belgrade
    await tap('Uslovi pretrage');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const day = (n: number) => tree.root.findAll(node => String(node.type) === 'Press' && new RegExp(`, ${n}\\. sep`).test(node.props.accessibilityLabel ?? ''))[0];
    expect(day(24).props.accessibilityLabel).toMatch(/prošao dan$/); expect(day(25).props.accessibilityLabel).toMatch(/, danas$/);
  } finally { jest.useRealTimers(); }
});

// Review of V47, item 20: a chosen pin whose task a new read no longer has is let go, not kept as a hidden selection.
test('a chosen pin whose task is gone from a newly landed read is let go', async () => {
  await render();
  await act(async () => map().props.onSelect('bb')); expect(peek()).toBeDefined();
  rows = [row('a'), row('ccc')]; await update();
  expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
});

// Review of V47, item 21 (coverage): the note under the list for the tasks a time choice leaves out.
test('a time choice says under the list how many tasks it leaves out because they name no day', async () => {
  rows = [row('danas', { schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null } }), row('bez-datuma'), row('bez-datuma-2')];
  await render();
  expect(list().props.ListFooterComponent).toBeNull();
  await act(async () => quick('Danas').props.onPress());
  expect(cards()).toEqual(['danas']);
  expect(list().props.ListFooterComponent.props.children.props.children).toBe('2 zadatka bez datuma nisu u ovom izboru.');
  await act(async () => quick('Danas').props.onPress()); expect(list().props.ListFooterComponent).toBeNull();
});

// R10: large text gets the whole search row, instead of four squeezed lines beside two tools.
test('at large text the search stays two lines with separate tools and the pin preview may use more room', async () => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1 }; await render();
  const lines = () => press('Pretraži zadatke').findAllByType('T' as React.ElementType).map(node => node.props.numberOfLines);
  expect(lines()).toEqual([1, 1]);
  await act(async () => map().props.onSelect('bb'));
  expect(peek()!.props.maxDynamicContentSize).toBe(640 * 0.5);
  await act(async () => tree.unmount());
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1.3 }; await render();
  expect(lines()).toEqual([1, 1]);
  const searchRow = tree.root.findByProps({ testID: 'discovery-search-row' });
  expect(searchRow.findAllByProps({ accessibilityLabel: 'Uslovi pretrage' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'discovery-search-tools' }).findByProps({ accessibilityLabel: 'Uslovi pretrage' })).toBeTruthy();
  await act(async () => map().props.onSelect('bb'));
  expect(peek()!.props.maxDynamicContentSize).toBe(640 * 0.75);
});

// Material controls: the shared search surface owns its edge; quick filters use the approved raised/recessed treatment.
// Selection stays explicit through the selected well, stronger edge, ink words, accessibility state and check.
test('over the map: search and tools share one edge; material quick-chip selection stays visible', async () => {
  await render();
  expect(StyleSheet.flatten(press('Pretraži zadatke').props.style).borderWidth).toBeUndefined();
  const free = StyleSheet.flatten(quick('Navedena cena').props.style);
  expect(free).toMatchObject({ backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, ...materialControl.raised });
  expect(quick('Navedena cena').props.accessibilityState.selected).toBe(false);
  expect(free.minHeight).toBeGreaterThanOrEqual(48);
  await act(async () => quick('Navedena cena').props.onPress());
  const chosen = quick('Navedena cena'), style = StyleSheet.flatten(chosen.props.style);
  expect(style).toMatchObject({ backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.lineStrong, ...materialControl.inset });
  expect(chosen.props.accessibilityState.selected).toBe(true);
  expect(style.minHeight).toBeGreaterThanOrEqual(48);
  expect(chosen.findByType('Check' as React.ElementType).props.color).toBe(sys.color.ink);
  expect(StyleSheet.flatten(chosen.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.ink);
  // A condition under the count removes itself by name, and takes 48 to a finger.
  await act(async () => tree.unmount()); initial = { ...initial, query: 'Pomoć' }; await render();
  const remove = press('Ukloni uslov: „Pomoć“');
  expect(StyleSheet.flatten(remove.props.style).minHeight + remove.props.hitSlop.top + remove.props.hitSlop.bottom).toBeGreaterThanOrEqual(48);
});

test('full list uses the map band below search while a selected preview still reserves readable credits after resizing', async () => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 2 }; await render(); await layOutBody(500);
  const searchBar = tree.root.findByProps({ testID: 'discovery-search-row' }).parent!;
  await act(async () => searchBar.props.onLayout({ nativeEvent: { layout: { y: 12, height: 144 } } }));
  await act(async () => map().props.onCreditsHeight(56));
  const clearTop = 156;
  expect(500 - listSheet().props.snapPoints[2]).toBe(clearTop);
  await act(async () => map().props.onSelect('bb'));
  const preview = () => tree.root.findByType(DiscoveryPeek);
  const cap = peek()!.props.maxDynamicContentSize;
  expect(cap).toBeLessThan(640 * 0.75);
  const body = preview().findAll(node => String(node.type) === 'View' && node.props.onLayout?.name === 'measureCard')[0];
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  const creditsEdge = () => 500 - HIDDEN - map().props.coverBottom;
  expect(creditsEdge() - sys.space.md - 56).toBeGreaterThanOrEqual(156 + sys.space.md);
  // A larger map increases the cap even if the preview's long content needs no new layout.
  await layOutBody(600);
  expect(peek()!.props.maxDynamicContentSize).toBeGreaterThan(cap);
  expect(map().props.coverBottom).toBe(Math.round(peek()!.props.maxDynamicContentSize) + 2 * sys.space.md);
  expect(snapshot.selectedId).toBe('bb'); expect(open).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});

test.each([false, true])('a tall filter header scrolls at the full stop below search, keeping lower map stops clear of credits (empty: %s)', async empty => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 2 };
  initial = { ...initial, query: empty ? 'Nema takvog zadatka' : 'Pomoć', place: 'Beograd', when: 'next7',
    viewport: { center: [20.45, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.6, 44.9] } };
  rows = rows.map(item => ({ ...item, schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null } } as MarketplaceItem));
  await render(); await layOutBody(430);
  const bar = tree.root.findByProps({ testID: 'discovery-search-row' }).parent!;
  await act(async () => bar.props.onLayout({ nativeEvent: { layout: { y: 12, height: 144 } } }));
  await act(async () => map().props.onCreditsHeight(48));
  const header = () => tree.root.findByProps({ testID: 'discovery-list-header' });
  await act(async () => tree.root.findByProps({ testID: 'discovery-list-header-lead' }).props.onLayout({ nativeEvent: { layout: { height: 88 } } }));
  await act(async () => header().props.onLayout({ nativeEvent: { layout: { height: 240 } } }));
  expect(listSheet().props.snapPoints).toEqual([96, 202, 274]);
  expect(StyleSheet.flatten(list().props.style)).toMatchObject({ height: 274, flexGrow: 0, flexShrink: 0 });
  expect(430 - listSheet().props.snapPoints[2]).toBe(156);
  expect(430 - listSheet().props.snapPoints[1]).toBe(156 + 48 + 2 * sys.space.md);
  expect(list().findByProps({ testID: 'discovery-scrolling-header' }).findByProps({ testID: 'discovery-list-header' })).toBe(header());
  expect(tree.root.findAllByProps({ testID: 'discovery-list-header' })).toHaveLength(1);
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'discovery-scrolling-header' }).props.style).marginHorizontal).toBe(-sys.space.lg);
  expect(removable()).toHaveLength(3);
  // Repeating native measurement in the new container leaves the same cap/mode rather than an expanding header loop.
  await act(async () => header().props.onLayout({ nativeEvent: { layout: { height: 240 } } }));
  expect(listSheet().props.snapPoints[2]).toBe(274);
  await act(async () => listSheet().props.onChange(2));
  expect(listSheet().props.index).toBe(2);
  expect(StyleSheet.flatten(list().props.style).height).toBe(274); // same highest-detent viewport at half and full
  if (empty) expect(StyleSheet.flatten(press('Mapa').props.style).backgroundColor).toBe(sys.color.surface);
  await tap('Ukloni uslov: Beograd');
  expect(snapshot.place).toBeNull(); expect(refresh).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  // Once the map has room again the exact same header can return to the fixed slot.
  await layOutBody(700);
  expect(tree.root.findAllByProps({ testID: 'discovery-scrolling-header' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'discovery-list-header' })).toHaveLength(1);
  expect(StyleSheet.flatten(list().props.style).height).toBe(listSheet().props.snapPoints[2] - 240);
});

describe('U blizini: an explicit camera-only location capture', () => {
  let receive: (value: { timestamp: number; coords: { latitude: number; longitude: number } }) => void;
  const remove = jest.fn();
  beforeEach(() => {
    mockNearbyPermission.mockReset().mockResolvedValue({ granted: true });
    mockNearbyWatch.mockReset().mockImplementation(async (_options, next) => { receive = next; return { remove }; });
    remove.mockClear();
  });
  test('offers a real 48 dp chip first, asks only on tap, and keeps list/filter data unchanged', async () => {
    rows = [row('a'), row('b')]; await render();
    const chip = press('U blizini');
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' }).findAllByType('Press' as React.ElementType)[0]).toBe(chip);
    expect(mockNearbyPermission).not.toHaveBeenCalled(); expect(mockNearbyWatch).not.toHaveBeenCalled();
    const before = { ...snapshot }, beforeCards = cards();
    await tap('U blizini'); expect(mockNearbyPermission).toHaveBeenCalledTimes(1); expect(press('U blizini').props.disabled).toBe(true);
    // Even an old native press callback cannot start a second attempt.
    await act(async () => chip.props.onPress()); expect(mockNearbyWatch).toHaveBeenCalledTimes(1);
    await act(async () => receive({ timestamp: Date.now(), coords: { latitude: 44.812345, longitude: 20.412345 } }));
    expect(map().props.centerNearby).toEqual({ key: 1, center: [20.412345, 44.812345] }); expect(remove).toHaveBeenCalledTimes(1);
    expect(cards()).toEqual(beforeCards); expect(map().props.items).toEqual(rows);
    expect(snapshot).toMatchObject({ query: before.query, price: before.price, area: before.area, viewport: before.viewport, place: before.place });
    expect(JSON.stringify(snapshot)).not.toContain('20.412345'); expect(refresh).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  });
  test('permission refusal leaves the map usable and offers settings without starting a watch', async () => {
    mockNearbyPermission.mockResolvedValue({ granted: false }); await render(); await tap('U blizini');
    expect(mockNearbyWatch).not.toHaveBeenCalled(); expect(map()).toBeTruthy();
    expect(texts()).toContain('Dozvoli lokaciju u podešavanjima'); expect(press('Podešavanja lokacije')).toBeTruthy();
    expect(press('U blizini').props.disabled).toBe(false);
  });
  test('consuming Nearby keeps an otherwise empty map mounted until its native viewport arrives', async () => {
    rows = []; await render(); expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
    await tap('U blizini');
    await act(async () => receive({ timestamp: Date.now(), coords: { latitude: 44.8, longitude: 20.4 } }));
    const request = map().props.centerNearby;
    await act(async () => map().props.onNearbyConsumed(request.key));
    expect(map().props.centerNearby).toBeNull(); expect(snapshot.viewport).toBeNull();
    const settled = { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9] };
    await act(async () => map().props.onViewport(settled)); expect(snapshot.viewport).toEqual(settled);
  });
});

// P6: the server orders a whole-list page by time, so the three kinds of task interleave. A heading for every run of a kind cut the list
// into one-card sections (found on the emulator); the cards already name their own place. An area or a place brings the headings back,
// because the server then puts the mapped section first.
const p6Seam_ = (): DiscoveryV1PresentationSeam => ({
  map: { markers: [], selectedKey: null, wholeBounds: [19, 44, 21, 46], onSelect: jest.fn() },
  peek: null, counts: null, pageHasMore: false, onArea: jest.fn(), onClearPeek: jest.fn(), onShowPlace: jest.fn(), onShowAll: jest.fn(), onNextPage: jest.fn(),
});
const runHeadings = () => tree.root.findAll(node => ['section-map', 'section-remote', 'section-unlocated'].includes(node.props.testID));
test('a whole-list P6 page keeps the server order without run headings, and an area brings them back', async () => {
  rows = [row('m1', at(44.81, 20.41)), row('r1', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }), row('m2', at(44.82, 20.42)),
    row('n1', { priblizno: null }), row('r2', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
  p6Seam = p6Seam_(); await render();
  expect(cards()).toEqual(['m1', 'r1', 'm2', 'n1', 'r2']);
  expect(runHeadings()).toHaveLength(0);
  await act(async () => tree.unmount());
  initial = { ...initial, area: [20.3, 44.7, 20.5, 44.9] }; p6Seam = p6Seam_(); await render();
  expect(runHeadings().length).toBeGreaterThan(0);
  // The same page read by the legacy reader keeps its own headings.
  await act(async () => tree.unmount());
  initial = { ...initialMarketplaceView(), mode: 'map' }; p6Seam = undefined; await render();
  expect(runHeadings().length).toBeGreaterThan(0);
});

// Independent review (P6 client finding): a P6 pin tap never lowered the list sheet, while the coordinator wrote `sheet: 'peek'` into the view it
// persists, so a touch at the half detent showed the card over the half-height sheet and a return restored a different sheet. The presentation now
// lowers the sheet to its top line as the legacy pin selection does, for a task and for a place; a cluster is navigation only and leaves it alone.
const serverTask: DiscoveryV1MapMarker = { kind: 'TASK', key: 'task:t1', point: { lat: 44.72, lng: 20.4 }, taskId: 't1', taskCount: 1 };
const serverPlace: DiscoveryV1MapMarker = { kind: 'PLACE', key: 'place:44.74:20.4', point: { lat: 44.74, lng: 20.4 }, taskCount: 2 };
const serverCluster: DiscoveryV1MapMarker = { kind: 'CLUSTER', key: 'cluster:1', point: { lat: 44.8, lng: 20.4 }, taskCount: 5, distinctPointCount: 3,
  memberBounds: [20.3, 44.7, 20.5, 44.9] };
const p6Rows = () => Array.from({ length: 4 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
test.each([['task', serverTask], ['place', serverPlace]] as const)(
  'a P6 %s marker chosen at the half detent lowers the list sheet to its top line, as a legacy pin does, and reaches the seam', async (_kind, marker) => {
  rows = p6Rows(); initial = { ...initial, sheet: 'half' }; p6Seam = p6Seam_();
  await render(); await layOutBody();
  expect(listSheet().props.index).toBe(1);
  userIntent.mockClear();
  await act(async () => map().props.p6Server.onSelect(marker));
  expect(listSheet().props.index).toBe(0);
  expect(p6Seam!.map.onSelect).toHaveBeenCalledTimes(1); expect(p6Seam!.map.onSelect).toHaveBeenCalledWith(marker);
  expect(userIntent).toHaveBeenCalled();
  // The seam's own map fields and the clear action pass through unchanged.
  expect(map().props.p6Server).toMatchObject({ selectedKey: null, wholeBounds: [19, 44, 21, 46], onClear: p6Seam!.onClearPeek });
});
test('a P6 cluster tap is navigation only: it reaches the seam and leaves the sheet where it is', async () => {
  rows = p6Rows(); initial = { ...initial, sheet: 'half' }; p6Seam = p6Seam_();
  await render(); await layOutBody();
  await act(async () => map().props.p6Server.onSelect(serverCluster));
  expect(listSheet().props.index).toBe(1);
  expect(p6Seam!.map.onSelect).toHaveBeenCalledTimes(1); expect(p6Seam!.map.onSelect).toHaveBeenCalledWith(serverCluster);
});
test('the legacy pin selection at the half detent still lowers the sheet the same way', async () => {
  initial = { ...initial, sheet: 'half' };
  await render(); await layOutBody();
  expect(listSheet().props.index).toBe(1); expect(map().props.p6Server).toBeUndefined();
  await act(async () => map().props.onSelect('bb'));
  expect(listSheet().props.index).toBe(0); expect(snapshot.selectedId).toBe('bb'); expect(peek()).toBeDefined();
});

// EX-03 (mount behaviour, owner approval 2026-09-30): the list sinks behind a pin's card and comes back, and its rows are the same native views all along. Measured on the HONOR before
// this: every card open and close re-created every row (the cell key followed a layout signature that held the card), a burst of native views and Reanimated tags that died at once,
// repeated through every draw of the card's icons (a frame of 500 ms in display-list recording, 1.1 s before the card data moved into the touch's own turn).
test('EX-03: a pin card opening and closing leaves every row of the list mounted', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOutBody();
  // The test renderer's `.instance` is the node mock (null here); the identity of a mounted host view is its fiber's stateNode, new for every view that is mounted again.
  const rowViews = () => listSheet().findAll(node => String(node.type) === 'Press' && /^Otvori (?:priliku|Zadatak) /.test(node.props.accessibilityLabel ?? ''))
    .map(node => (node as unknown as { _fiber: { stateNode: object } })._fiber.stateNode);
  // Compared as booleans on purpose: a failed toBe on two host instances makes Jest print their whole object graphs, which runs the worker out of memory.
  const sameViews = (now: object[], then: object[]) => now.map((view, at) => view === then[at]);
  const allSame = [true, true, true, true, true, true];
  const before = rowViews();
  expect(before).toHaveLength(6);
  expect(before.every(Boolean)).toBe(true);
  await act(async () => map().props.onSelect('t1'));
  expect(listSheet().props.snapPoints[0]).toBe(HIDDEN);                   // the list sank behind the card ...
  const open = rowViews();
  expect(open).toHaveLength(6);
  expect(sameViews(open, before)).toEqual(allSame);                       // ... and no row was re-created
  await tap('Zatvori pregled zadatka');
  expect(listSheet().props.snapPoints[0]).toBeGreaterThan(HIDDEN);        // the top line is back ...
  const closed = rowViews();
  expect(closed).toHaveLength(6);
  expect(sameViews(closed, before)).toEqual(allSame);                     // ... on the very same rows
});

// Audit fix 8 (owner, 2026-10-07: the map and the list always show every task): an empty list says plainly why, and offers the one way out that fits.
const AT_NOW = '2026-10-07T10:00:00.000000Z';
const p6Counts = (mapped: number, listed = 0) => ({ kind: 'exact_live' as const, observedAt: AT_NOW, mapped, listed, inArea: listed, withoutPoint: 0, undated: 0 });
describe('an empty P6 list says what is true', () => {
  test('an area with nothing, while tasks exist elsewhere: zoom out or move the map, or show every task', async () => {
    rows = []; initial = { ...initial, area: [20.3, 44.7, 20.5, 44.9], sheet: 'half' }; p6Seam = { ...p6Seam_(), counts: p6Counts(7) };
    await render();
    expect(texts()).toContain('Nema zadataka u ovoj oblasti'); expect(texts()).toContain('Umanji mapu ili je pomeri da vidiš zadatke u okolini.');
    expect(texts()).not.toContain('radnom profilu');
    await click('Prikaži sve zadatke'); expect(p6Seam!.onShowAll).toHaveBeenCalledTimes(1);
  });
  test('conditions that match no task anywhere: the conditions are cleared, not the map', async () => {
    rows = []; initial = { ...initial, area: [20.3, 44.7, 20.5, 44.9], price: 'MY_PRICE', sheet: 'half' }; p6Seam = { ...p6Seam_(), counts: p6Counts(0) };
    await render();
    expect(texts()).toContain('Nema zadataka u ovom prikazu'); expect(texts()).toContain('Nijedan zadatak ne odgovara ovim uslovima.');
    expect(action('Prikaži sve zadatke')).toBeUndefined();
    await click('Obriši uslove'); expect(snapshot.price).toBe('all');
  });
  test('no task at all, under an area and no conditions: nothing is open yet, and the list can be read again', async () => {
    rows = []; initial = { ...initial, area: [20.3, 44.7, 20.5, 44.9], sheet: 'half' }; p6Seam = { ...p6Seam_(), counts: p6Counts(0) };
    await render();
    expect(texts()).toContain('Trenutno nema otvorenih zadataka'); expect(action('Obriši uslove')).toBeUndefined();
    await click('Osveži zadatke'); expect(refresh).toHaveBeenCalledTimes(1);
  });
});

// Audit fix 6: P6 holds one area's pages, which change with every move of the map; a chip read from them came and went while the person panned.
// The server's availability (every published task) says which chips have anything to say.
describe('P6 quick chips follow the server availability, not the loaded page', () => {
  const chipLabels = () => tree.root.findByType(DiscoverySearchBar).props.chips.map((chip: { label: string }) => chip.label);
  const dated = { schedule: { kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null } };
  const narrow = (patch: Record<string, unknown> = {}) => row('narrow', { pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, ...patch });
  test('chips come from the availability and stay while a read has not answered and the area holds nothing', async () => {
    rows = [narrow(dated)];
    p6Seam = { ...p6Seam_(), availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['OFFERS'] } };
    await render();
    // The loaded row names a price and no work mode; the server says every task is OFFERS and some name a work mode.
    expect(chipLabels()).toEqual(['Na daljinu', 'Na licu mesta', 'Danas', 'Sutra', 'Ove nedelje', 'Tražim ponude']);
    // A pan: the new area holds nothing and its read has not answered yet. The rail does not move.
    rows = []; p6Seam = { ...p6Seam!, availability: null }; await update();
    expect(chipLabels()).toEqual(['Na daljinu', 'Na licu mesta', 'Danas', 'Sutra', 'Ove nedelje', 'Tražim ponude']);
    // The server says nothing names its days: the time chips are not offered, whatever the page holds.
    rows = [narrow(dated)]; p6Seam = { ...p6Seam!, availability: { hasKnownWorkMode: false, hasKnownSchedule: false, priceModes: ['MY_PRICE', 'OFFERS'] } };
    await update();
    expect(chipLabels()).toEqual(['Navedena cena', 'Tražim ponude']);
  });
  test('"2+ mesta" stays once a read showed a task with room for two; the legacy reader still reads its rows', async () => {
    rows = [narrow()]; p6Seam = { ...p6Seam_(), availability: { hasKnownWorkMode: false, hasKnownSchedule: false, priceModes: [] } };
    await render(); expect(chipLabels()).toEqual([]);
    rows = [row('roomy')]; await update(); expect(chipLabels()).toEqual(['2+ mesta']);
    rows = [narrow()]; await update(); expect(chipLabels()).toEqual(['2+ mesta']);
    await act(async () => tree.unmount());
    p6Seam = undefined; rows = [narrow()]; await render();
    expect(chipLabels()).not.toContain('2+ mesta');
  });
});

// Audit fixes 2 and 7: the map hands the list what the person can see and keeps its whole view for its buckets; the rows the list shows get their details.
test('P6: the area the map hands up reaches the seam with the whole view, and the rows on screen are reported for their details', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
  const onVisibleRange = jest.fn();
  p6Seam = { ...p6Seam_(), onVisibleRange }; initial = { ...initial, sheet: 'full' };
  await render();
  await act(async () => map().props.onArea([20.3, 44.75, 20.5, 44.88], [20.3, 44.7, 20.5, 44.9]));
  expect(p6Seam!.onArea).toHaveBeenCalledWith([20.3, 44.75, 20.5, 44.88], [20.3, 44.7, 20.5, 44.9]);
  await act(async () => list().props.onViewableItemsChanged({ viewableItems: [
    { item: rows[3], index: 3, isViewable: true }, { item: rows[2], index: 2, isViewable: true }, { item: rows[5], index: 5, isViewable: false },
  ] }));
  expect(onVisibleRange).toHaveBeenLastCalledWith(2, 3);
});
