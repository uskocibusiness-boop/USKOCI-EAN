/**
 * EX-03 warm return at the screen (owner approval 2026-09-30): a screen handed a coordinator the route kept shows its picture in its very first render, takes it over (claim,
 * attach: the coordinator then refreshes the optional overlay itself) and reads nothing else; on the way out it parks the coordinator instead of retiring it, unless it leaves in
 * its error state. A screen with nothing kept, or without a holder, behaves exactly as before.
 */
let mockPackage: string | undefined = 'rs.uskoci.dev';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));
jest.mock('../discoveryV1ClientTransport', () => ({ createDiscoveryV1SupabaseTransport: () => ({}) }));
jest.mock('../discoveryV1OverlayOwner', () => ({ createDiscoveryV1ExistingOverlayLoaders: () => ({}), discoveryV1OverlayRelation: () => ({ kind: 'NONE' }) }));
const mockCoordinator: any = {};
jest.mock('../discoveryV1RouteCoordinator', () => ({ createDiscoveryV1RouteCoordinator: () => mockCoordinator }));
const mockBridge: { props: any } = { props: null };
jest.mock('../discoveryV1PresentationBridge', () => ({ DiscoveryV1PresentationBridge: (props: any) => { mockBridge.props = props; return null; } }));
const mockStateViews: any[] = [];
jest.mock('../../ui/system/StateView', () => ({ StateView: (props: any) => { mockStateViews.push(props); return null; } }));
const mockQuietReads: any[] = [];
jest.mock('../../ui/v2/QuietReadState', () => ({ QuietReadState: (props: any) => { mockQuietReads.push(props); return null; } }));

import { act, create } from 'react-test-renderer';
import { DiscoveryV1Screen } from '../../ui/v2/discovery/DiscoveryV1Screen';

const SOURCE: any = {}, INITIAL: any = { id: 'initial-view' };
const flush = () => act(async () => { await new Promise(done => setTimeout(done, 0)); });
const snapshotOf = (rows = 2, view: any = { id: 'kept-view' }) => ({
  screen: { active: true, view, items: Array.from({ length: rows }, (_, id) => ({ id })), mapMarkers: [{}], peek: null },
  view, overlay: null, search: null, selectedMarkerKey: null, loadingMore: false,
});
const keptCoordinator = (): any => ({ attach: jest.fn(() => true), snapshot: () => snapshotOf(), restore: jest.fn(), retire: jest.fn(),
  nextPage: jest.fn(async () => ({ kind: 'applied' })) });
const warmReturn = (candidate: any): any => ({ candidate: jest.fn(() => candidate), claim: jest.fn(), discard: jest.fn(), park: jest.fn() });

let info: jest.SpyInstance, persist: jest.Mock, current: boolean;
const traced = () => info.mock.calls.map(call => String(call[0])).filter(line => line.startsWith('[USKOCI_P6_TRACE]'));

beforeEach(() => {
  mockPackage = 'rs.uskoci.dev'; mockBridge.props = null; mockStateViews.length = 0; mockQuietReads.length = 0; persist = jest.fn(); current = true;
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
  mockCoordinator.restore = jest.fn(async () => ({ kind: 'applied' }));
  mockCoordinator.retire = jest.fn();
  mockCoordinator.snapshot = () => snapshotOf(0, { id: 'cold-view' });
});
afterEach(() => info.mockRestore());

const render = async (warm?: any) => {
  let tree: any;
  await act(async () => {
    tree = create(<DiscoveryV1Screen source={SOURCE} scopeKey="scope" initialView={INITIAL} isCurrent={() => current} onPersistView={persist}
      onOpen={() => {}} onProfile={() => {}} onNew={() => {}} onNotifications={() => {}} warmReturn={warm} />);
  });
  await flush();
  return tree;
};
const leave = (tree: any) => act(async () => { tree.unmount(); });

test('a screen handed a kept coordinator shows its picture in the first render and reads nothing', async () => {
  const kept = keptCoordinator(), warm = warmReturn({ coordinator: kept, ageMs: 42_000 });
  const tree = await render(warm);
  expect(mockQuietReads).toHaveLength(0);                                    // known content, no first-read state
  expect(mockBridge.props.snapshot.items).toHaveLength(2);
  expect(warm.candidate).toHaveBeenCalledWith('scope', SOURCE, INITIAL);
  expect(kept.attach).toHaveBeenCalledTimes(1);
  expect(kept.attach.mock.calls[0][0]).toEqual({ isCurrent: expect.any(Function), onOptionalState: expect.any(Function) });
  expect(warm.claim).toHaveBeenCalledWith(kept);
  expect(kept.restore).not.toHaveBeenCalled();
  expect(mockCoordinator.restore).not.toHaveBeenCalled();
  expect(persist).toHaveBeenCalledWith({ id: 'kept-view' });                 // the route learns the view the kept coordinator holds
  expect(mockBridge.props.loading).toBe(false);
  expect(traced()).toEqual(['[USKOCI_P6_TRACE] ["restored","2/1"]', '[USKOCI_P6_TRACE] ["warm","42/2"]']);
  await leave(tree);
});

test('the callbacks handed to the kept coordinator belong to the new screen', async () => {
  const kept = keptCoordinator(), warm = warmReturn({ coordinator: kept, ageMs: 1000 });
  const tree = await render(warm);
  const { isCurrent, onOptionalState } = kept.attach.mock.calls[0][0];
  expect(isCurrent()).toBe(true);
  current = false;
  expect(isCurrent()).toBe(false);
  current = true;
  persist.mockClear();
  await act(async () => { onOptionalState(); });                             // an overlay answer publishes the picture again
  expect(persist).toHaveBeenCalledTimes(1);
  await leave(tree);
});

test('a screen with nothing kept reads like a first visit and discards what the route still holds', async () => {
  const warm = warmReturn(null);
  const tree = await render(warm);
  expect(warm.discard).toHaveBeenCalledWith(mockCoordinator);
  expect(warm.claim).not.toHaveBeenCalled();
  expect(mockCoordinator.restore).toHaveBeenCalledWith({ ...INITIAL, where: 'onsite' });
  expect(mockQuietReads.length).toBeGreaterThan(0);                           // a first-read explanation, until the read lands
  expect(mockQuietReads[0].title).toBe('Učitavamo zadatke…');
  expect(mockStateViews).toHaveLength(0);                                    // no placeholder cards
  expect(traced()).toEqual(['[USKOCI_P6_TRACE] ["restored","0/1"]']);        // no warm line
  await leave(tree);
});

test('leaving parks the coordinator instead of retiring it, cold or warm', async () => {
  const kept = keptCoordinator(), warm = warmReturn({ coordinator: kept, ageMs: 1000 });
  await leave(await render(warm));
  expect(warm.park).toHaveBeenCalledWith('scope', SOURCE, kept);
  expect(kept.retire).not.toHaveBeenCalled();
  const cold = warmReturn(null);
  await leave(await render(cold));
  expect(cold.park).toHaveBeenCalledWith('scope', SOURCE, mockCoordinator);
  expect(mockCoordinator.retire).not.toHaveBeenCalled();
});

test('a screen that leaves in its error state retires the coordinator instead of keeping it', async () => {
  const kept = keptCoordinator(), warm = warmReturn({ coordinator: kept, ageMs: 1000 });
  kept.nextPage = jest.fn(async () => { throw new Error('DISCOVERY_V1_TRANSPORT_FAILED'); });
  const tree = await render(warm);
  await act(async () => { mockBridge.props.actions.onNextPage(); });
  await flush();
  expect(mockBridge.props.error).toBe(true);
  await leave(tree);
  expect(warm.park).not.toHaveBeenCalled();
  expect(kept.retire).toHaveBeenCalledTimes(1);
});

test('a screen without a holder retires its coordinator as before', async () => {
  const tree = await render();
  await leave(tree);
  expect(mockCoordinator.retire).toHaveBeenCalledTimes(1);
});

test('a kept coordinator that cannot be attached, retired meanwhile, is replaced and the screen reads like a first visit', async () => {
  const kept = keptCoordinator(), warm = warmReturn({ coordinator: kept, ageMs: 10 });
  kept.attach = jest.fn(() => false);
  const tree = await render(warm);
  expect(warm.claim).not.toHaveBeenCalled();
  expect(warm.discard).toHaveBeenCalledWith(mockCoordinator);
  expect(mockCoordinator.restore).toHaveBeenCalledWith({ ...INITIAL, where: 'onsite' });
  expect(mockBridge.props.snapshot.view).toEqual({ id: 'cold-view' });
  expect(traced()).toEqual(['[USKOCI_P6_TRACE] ["restored","0/1"]']);
  await leave(tree);
  expect(warm.park).toHaveBeenCalledTimes(1);
  expect(warm.park).toHaveBeenCalledWith('scope', SOURCE, mockCoordinator);  // the one that failed is not parked again
  expect(kept.retire).toHaveBeenCalled();
});
