/**
 * P6-10: a touch on a task or place bucket answers at once (the bucket's halo), while the exact read that fills the card is on its way; a read that does not
 * apply takes the halo away, the newest touch keeps it, and the DEV package traces the milliseconds to the halo and to the card data.
 */
let mockPackage: string | undefined = 'rs.uskoci.dev';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));
jest.mock('../discoveryV1ClientTransport', () => ({ createDiscoveryV1SupabaseTransport: () => ({}) }));
jest.mock('../discoveryV1OverlayOwner', () => ({ createDiscoveryV1ExistingOverlayLoaders: () => ({}), discoveryV1OverlayRelation: () => ({ kind: 'NONE' }) }));
const mockCoordinator: any = {};
jest.mock('../discoveryV1RouteCoordinator', () => ({ createDiscoveryV1RouteCoordinator: () => mockCoordinator }));
const mockBridge: { props: any } = { props: null };
jest.mock('../discoveryV1PresentationBridge', () => ({ DiscoveryV1PresentationBridge: (props: any) => { mockBridge.props = props; return null; } }));
jest.mock('../../ui/system/StateView', () => ({ StateView: () => null }));

import { act, create } from 'react-test-renderer';
import { DiscoveryV1Screen } from '../../ui/v2/discovery/DiscoveryV1Screen';

const marker = (kind: 'TASK' | 'PLACE' | 'CLUSTER', key: string): any => ({ kind, key, point: { lat: 45.25, lng: 19.83 }, taskCount: 1,
  ...(kind === 'TASK' ? { taskId: '11111111-1111-4111-8111-111111111111' } : {}), ...(kind === 'CLUSTER' ? { memberBounds: [19.7, 45.1, 20, 45.4] } : {}) });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => act(async () => { await new Promise(done => setTimeout(done, 0)); });

let selectedKey: string | null;
let info: jest.SpyInstance;
const realFrame = global.requestAnimationFrame;
let frames: Array<() => void> = [];
const runFrames = () => act(async () => { const due = frames.splice(0); due.forEach(run => run()); await Promise.resolve(); });
const traced = () => info.mock.calls.map(call => String(call[0])).filter(line => line.includes('"pin"'));

beforeEach(() => {
  mockPackage = 'rs.uskoci.dev'; selectedKey = null; mockBridge.props = null; frames = [];
  global.requestAnimationFrame = ((callback: (time: number) => void) => { frames.push(() => callback(0)); return frames.length; }) as typeof global.requestAnimationFrame;
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
  mockCoordinator.restore = jest.fn(async () => ({ kind: 'applied' }));
  mockCoordinator.retire = jest.fn();
  mockCoordinator.selectMarker = jest.fn();
  mockCoordinator.peekNow = () => null;
  mockCoordinator.snapshot = () => ({ screen: { active: true, view: { id: 'view' }, items: [], mapMarkers: [] }, view: { id: 'view' }, overlay: null, search: null, selectedMarkerKey: selectedKey, loadingMore: false });
});
afterEach(() => { info.mockRestore(); global.requestAnimationFrame = realFrame; });

const render = async () => {
  let tree: any;
  await act(async () => {
    tree = create(<DiscoveryV1Screen source={{} as any} scopeKey="scope" initialView={{} as any} isCurrent={() => true} onPersistView={() => {}}
      onOpen={() => {}} onProfile={() => {}} onNew={() => {}} onNotifications={() => {}} />);
  });
  await flush();
  return tree;
};
const touch = (bucket: any) => act(async () => { mockBridge.props.actions.onSelectMarker(bucket); });
const halo = () => mockBridge.props.selectedMarkerKey;

test('a touched task bucket shows its halo before the read answers, and keeps it when the card lands', async () => {
  const read = deferred<any>();
  mockCoordinator.selectMarker = jest.fn(() => read.promise);
  const tree = await render();
  expect(halo()).toBeNull();
  await touch(marker('TASK', 'task:a'));
  expect(halo()).toBe('task:a');                          // the read has not answered yet
  await act(async () => { selectedKey = 'task:a'; read.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:a');                          // the coordinator's own selection has taken over
  const lines = traced();
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^\[USKOCI_P6_TRACE\] \["pin","\d{1,4}\/\d{1,4}"\]$/);
  await act(async () => { tree.unmount(); });
});

test('a read that does not apply takes the halo away again, and a cluster is navigation only', async () => {
  const read = deferred<any>();
  mockCoordinator.selectMarker = jest.fn(() => read.promise);
  const tree = await render();
  await touch(marker('PLACE', 'place:a'));
  expect(halo()).toBe('place:a');
  await act(async () => { read.resolve({ kind: 'PLACE', applied: false, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBeNull();
  expect(traced()).toHaveLength(0);                       // nothing was selected, so nothing is timed
  mockCoordinator.selectMarker = jest.fn(async () => ({ kind: 'CLUSTER', bounds: [19.7, 45.1, 20, 45.4], snapshot: {} }));
  await touch(marker('CLUSTER', 'cluster:a'));
  expect(halo()).toBeNull();
  await flush();
  expect(halo()).toBeNull();
  expect(traced()).toHaveLength(0);
  await act(async () => { tree.unmount(); });
});

test('a stale read gives the halo up, and the newest touch keeps it when an older read finishes late', async () => {
  const first = deferred<any>(), second = deferred<any>();
  mockCoordinator.selectMarker = jest.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const tree = await render();
  await touch(marker('TASK', 'task:a'));
  await touch(marker('TASK', 'task:b'));
  expect(halo()).toBe('task:b');
  await act(async () => { first.resolve({ kind: 'stale' }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:b');                          // the older read's end does not take the newer halo away
  expect(traced()).toHaveLength(0);
  await act(async () => { selectedKey = 'task:b'; second.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:b');
  expect(traced()).toHaveLength(1);
  await act(async () => { tree.unmount(); });
});

test('touching the same bucket twice keeps its halo while the newer read runs, and only the newer read is timed', async () => {
  const first = deferred<any>(), second = deferred<any>();
  mockCoordinator.selectMarker = jest.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const tree = await render();
  await touch(marker('TASK', 'task:a'));
  await touch(marker('TASK', 'task:a'));
  await act(async () => { first.resolve({ kind: 'stale' }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:a');                          // the older read's end does not blink the halo away
  expect(traced()).toHaveLength(0);
  await act(async () => { selectedKey = 'task:a'; second.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:a');
  expect(traced()).toHaveLength(1);
  await act(async () => { tree.unmount(); });
});

test('a store build traces nothing and still answers the touch', async () => {
  mockPackage = 'rs.uskoci';
  const read = deferred<any>();
  mockCoordinator.selectMarker = jest.fn(() => read.promise);
  const tree = await render();
  await touch(marker('TASK', 'task:a'));
  expect(halo()).toBe('task:a');
  await act(async () => { selectedKey = 'task:a'; read.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(traced()).toHaveLength(0);
  await act(async () => { tree.unmount(); });
});

test('EX-03: a card the session already knows follows the halo by one frame, before the exact read answers, and the touch builds no snapshot itself', async () => {
  const read = deferred<any>();
  let peek: any, snapshots = 0;
  mockCoordinator.peekNow = () => peek ?? null;                           // the cheap look at the card: no snapshot of the whole list and map
  mockCoordinator.snapshot = () => { snapshots++; return { screen: { active: true, view: { id: 'view' }, items: [], mapMarkers: [], peek }, view: { id: 'view' }, overlay: null, search: null, selectedMarkerKey: selectedKey, loadingMore: false }; };
  mockCoordinator.selectMarker = jest.fn(() => { peek = { kind: 'TASK', item: { id: '11111111-1111-4111-8111-111111111111' } }; return read.promise; });   // a loaded row: the card is set at once
  const tree = await render();
  expect(mockBridge.props.snapshot.peek).toBeUndefined();
  const before = snapshots;
  await touch(marker('TASK', 'task:a'));
  expect(halo()).toBe('task:a');                                          // the halo is committed first ...
  expect(mockBridge.props.snapshot.peek).toBeUndefined();                 // ... alone: the card is not in that commit
  expect(snapshots).toBe(before);                                         // and nothing has built a snapshot yet
  await runFrames();                                                      // one frame later
  expect(mockBridge.props.snapshot.peek).toBe(peek);                      // the card, while the read has not answered
  expect(snapshots).toBe(before + 1);
  expect(traced()).toHaveLength(0);
  await act(async () => { selectedKey = 'task:a'; read.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  const lines = traced();
  expect(lines).toHaveLength(1);                                          // traced once, when the read confirmed it, with the time the CARD was handed over
  expect(lines[0]).toMatch(/^\[USKOCI_P6_TRACE\] \["pin","\d{1,4}\/\d{1,4}"\]$/);
  await act(async () => { tree.unmount(); });
});

test('EX-03: a newer touch before the frame commits only its own card', async () => {
  const reads = [deferred<any>(), deferred<any>()];
  let peek: any, snapshots = 0, n = 0;
  mockCoordinator.peekNow = () => peek ?? null;
  mockCoordinator.snapshot = () => { snapshots++; return { screen: { active: true, view: { id: 'view' }, items: [], mapMarkers: [], peek }, view: { id: 'view' }, overlay: null, search: null, selectedMarkerKey: selectedKey, loadingMore: false }; };
  mockCoordinator.selectMarker = jest.fn(() => { peek = { kind: 'TASK', item: { id: 'card-' + n } }; return reads[n++].promise; });
  const tree = await render();
  const before = snapshots;
  await touch(marker('TASK', 'task:a'));
  await touch(marker('TASK', 'task:b'));
  await runFrames();
  expect(snapshots).toBe(before + 1);                                     // the older touch's frame did not commit
  expect(mockBridge.props.snapshot.peek).toBe(peek);
  expect(halo()).toBe('task:b');
  await act(async () => { tree.unmount(); });
});

test('EX-03: a task that is not loaded leaves the card that is showing until the read answers', async () => {
  const read = deferred<any>();
  const shown = { kind: 'TASK', item: { id: '22222222-2222-4222-8222-222222222222' } };
  mockCoordinator.peekNow = () => shown;                                  // the session sets no new card
  mockCoordinator.snapshot = () => ({ screen: { active: true, view: { id: 'view' }, items: [], mapMarkers: [], peek: shown }, view: { id: 'view' }, overlay: null, search: null, selectedMarkerKey: selectedKey, loadingMore: false })
  mockCoordinator.selectMarker = jest.fn(() => read.promise);            // nothing known: nothing to publish early
  const tree = await render();
  await touch(marker('TASK', 'task:a'));
  await flush();
  expect(mockBridge.props.snapshot.peek).toBe(shown);                     // unchanged: no early publication of anything
  expect(traced()).toHaveLength(0);
  await act(async () => { read.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(traced()).toHaveLength(1);
  await act(async () => { tree.unmount(); });
});

// Audit fixes 2 and 7: the screen hands the coordinator the list's area with the map's whole frame, and the rows the list shows.
test('a settled pan reaches the coordinator with the list area and the map frame, and the visible rows reach the overlay window', async () => {
  mockCoordinator.settleMap = jest.fn(async () => ({ kind: 'applied' }));
  mockCoordinator.showRows = jest.fn(() => true);
  const tree = await render();
  await act(async () => { mockBridge.props.actions.onArea([19.6, 44.6, 20.4, 45.4], [19.5, 44.5, 20.5, 45.5]); });
  expect(mockCoordinator.settleMap).toHaveBeenCalledWith([19.6, 44.6, 20.4, 45.4], [19.5, 44.5, 20.5, 45.5]);
  await act(async () => { mockBridge.props.actions.onVisibleRange(120, 131); });
  expect(mockCoordinator.showRows).toHaveBeenCalledWith(120, 131);
  await act(async () => { tree.unmount(); });
});
