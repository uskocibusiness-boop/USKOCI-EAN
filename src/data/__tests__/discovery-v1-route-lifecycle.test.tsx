import { AppState } from 'react-native';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';
import { taskRelationIndex } from '../taskRelation';

// These tests drive the real route, screen and coordinator through whole visits; one of them takes about 3 s alone and passes Jest's 5 s on a loaded developer machine (Metro, other agents).
// What they pin is the order of the reads, not their speed, so the real-time limit is only a safety net and is widened (2026-10-08).
jest.setTimeout(30000);

// The P6 route unmounts its screen on blur and rebuilds it from the saved view on focus. This drives the REAL route, screen, coordinator and owners
// over a fake server through that whole cycle: the return must show the same list (read depth restored) and never the error state. The fake server
// answers the way the database does: it echoes a MAP request's bounds through double precision at 15 significant digits, while the map's own
// viewport (what the screen persists) carries 16-17 digits.
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const AT = '2026-09-29T05:00:00.000000Z', EX = '2026-09-29T05:30:00.000000Z', A = 'a'.repeat(32), B = 'b'.repeat(32);
let mockFocused = true, mockRevision = 1;
let mockSource = { odnosiPremaZadacima: jest.fn(async (ids: readonly string[]) => taskRelationIndex([], ids)) };
const mockOriginalSource = mockSource;
const mockRouter = { navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) };
const mockTransportCalls: DiscoveryV1OwnerRequest[] = [];
let mockTransport: (request: DiscoveryV1OwnerRequest) => Promise<unknown>;

jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockRouter.navigate(...args), back: () => mockRouter.back(), canGoBack: () => mockRouter.canGoBack() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]);
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.dev' } } }));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: ACCOUNT }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: mockRevision }),
}));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => ({ target: null, handled: jest.fn(), retire: jest.fn() }) }));
jest.mock('../discoveryV1ClientTransport', () => ({ createDiscoveryV1SupabaseTransport: () => (request: any) => mockTransport(request) }));
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn(async () => null) } }));
jest.mock('../needUrgencyClientService', () => ({ readNeedUrgencies: jest.fn(async () => new Map()) }));
jest.mock('../discoveryV1PresentationBridge', () => ({ DiscoveryV1PresentationBridge: 'Bridge' }));

import { DiscoveryV1Route } from '../../ui/v2/discovery/DiscoveryV1Route';
import { DISCOVERY_V1_WARM_RETURN_MS } from '../discoveryV1WarmReturn';

const rowId = (n: number) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;
const anchor = () => ({ version: 'DISCOVERY_V1', filterKey: A, timeAt: AT, publishedThrough: AT, expiresAt: EX });
const item = (n: number): any => ({ id: rowId(n), revision: 1, sortAt: AT, publishedAt: AT, title: `Task ${n}`, category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: 'STATIONARY', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  verifiedIdentityRequired: false, approximateCity: 'Novi Sad', approximateArea: 'Liman', pin: { lat: Number((45.25 + (n % 10) / 100).toFixed(2)), lng: 19.83, precision: 'COARSE_1KM' },
  requiredSlots: 1, coveredSlots: 0, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [], minimumExperienceYears: null,
  priceMode: 'OFFERS', requesterPriceRsd: null, priceBasis: null, requesterProfileId: PROFILE, responseDeadline: null, acceptsApplications: true,
  publicTopology: null, criticalConditions: null });

/** `select jsonb_build_array('19.371235347487277'::numeric::double precision)` answers 19.3712353474873 (extra_float_digits is 0). */
const databaseEcho = (bounds: readonly number[]) => bounds.map(value => Number(value.toPrecision(15)));
/** What the native map reports for its visible area: 16-17 significant digits, which no server echo reproduces. */
const NATIVE_BOUNDS = [19.371235347487277, 44.85134028015267, 21.899999999999999, 45.796000000000006];
const CANONICAL_BOUNDS = [19.371235, 44.85134, 21.9, 45.796];

/** A server of 100 tasks in pages of 50 with a whole-bounds hint, answering the way the SQL does (coverage echoes the request). */
function server(request: DiscoveryV1OwnerRequest): unknown {
  mockTransportCalls.push(request);
  if (request.mode === 'MAP') {
    return { version: 'DISCOVERY_V1', mode: 'MAP', asOf: AT, filterKey: A, anchor: anchor(), coverageBounds: databaseEcho(request.bounds), effectiveGrid: 8,
      wholeBounds: [19.5, 44.7, 21.9, 45.4], buckets: [{ kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) }],
      counts: { kind: 'exact_live', observedAt: AT, mapped: 100, withoutPoint: 0 } };
  }
  if (request.mode === 'PAGE') {
    const start = request.after ? Number((request.after as any).id.slice(-12)) : 0;
    const size = Math.min(50, request.limit), rows = Array.from({ length: size }, (_, i) => item(start + i));
    const more = start + size < 100;
    return { version: 'DISCOVERY_V1', mode: 'PAGE', asOf: AT, filterKey: A, anchor: anchor(), items: rows, hasMore: more,
      nextCursor: more ? { scopeKey: B, section: 0, sortAt: AT, id: rowId(start + size - 1) } : null,
      counts: { kind: 'exact_live', observedAt: AT, mapped: 100, listed: 100, inArea: 100, withoutPoint: 0, undated: 0 },
      availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['OFFERS'] } };
  }
  if (request.mode === 'PLACES') {
    return { version: 'DISCOVERY_V1', mode: 'PLACES', asOf: AT, filterKey: A, anchor: anchor(), items: [{ key: 'novi sad, liman', text: 'Novi Sad, Liman', count: 30 }],
      hasMore: false, nextCursor: null, counts: { kind: 'exact_live', observedAt: AT, everywhere: 100, inArea: null } };
  }
  if (request.mode === 'EXACT_PUBLIC') {
    return { version: 'DISCOVERY_V1', mode: 'EXACT_PUBLIC', asOf: AT, items: [item(Number(request.needId.slice(-12)) - 1)], hasMore: false, nextCursor: null };
  }
  throw new Error('UNEXPECTED_MODE');
}

let tree: ReactTestRenderer | undefined;
const bridge = () => tree!.root.findAllByType('Bridge' as unknown as React.ElementType)[0];
const errorState = () => tree!.root.findAllByProps({ title: 'Ne možemo da učitamo zadatke' });
const flush = async () => { for (let i = 0; i < 80; i++) await act(async () => { await Promise.resolve(); }); };
const modes = () => mockTransportCalls.map(request => request.mode);
const pendingRead = () => { let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let info: jest.SpyInstance;
const traced = () => info.mock.calls.map(call => String(call[0])).filter(line => line.startsWith('[USKOCI_P6_TRACE]'));
beforeEach(() => {
  mockFocused = true; mockRevision = 1; mockSource = mockOriginalSource; mockTransportCalls.length = 0; mockTransport = async request => server(request); mockRouter.navigate.mockClear(); mockRouter.back.mockClear(); mockRouter.canGoBack.mockReturnValue(false);
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
});

test('a delayed filter and area read publish refreshing immediately without removing the previous picture', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const oldIds = bridge().props.snapshot.items.map((row: any) => row.id);
  for (const kind of ['filter', 'area'] as const) {
    const gate = pendingRead(); mockTransport = async request => { await gate.promise; return server(request); };
    await act(async () => {
      if (kind === 'filter') bridge().props.onView({ ...bridge().props.snapshot.view, query: 'knjige' });
      else bridge().props.actions.onArea(NATIVE_BOUNDS);
    });
    expect(bridge().props.refreshing).toBe(true); expect(bridge().props.loading).toBe(false);
    expect(bridge().props.snapshot.items.map((row: any) => row.id)).toEqual(oldIds);
    expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
    await act(async () => { gate.resolve(); }); await flush();
    expect(bridge().props.refreshing).toBe(false); expect(bridge().props.error).toBe(false);
  }
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, sheet: 'full', listOffset: 120 }); });
  expect(bridge().props.refreshing).toBe(false); expect(mockTransportCalls).toHaveLength(0);
});

test.each(['older first', 'newer first'])('overlapping filter replies (%s) cannot drop the pending hold or publish the older intent', async order => {
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const gates = [pendingRead(), pendingRead()]; let called = 0;
  mockTransport = async request => {
    if (request.mode === 'PAGE') { const index = called++; await gates[index].promise; }
    return server(request);
  };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, query: 'prvo' }); });
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, query: 'drugo' }); });
  expect(bridge().props.refreshing).toBe(true);
  await act(async () => { gates[order === 'older first' ? 0 : 1].resolve(); }); await flush();
  expect(bridge().props.snapshot.view.query).toBe('drugo'); expect(bridge().props.refreshing).toBe(true);
  await act(async () => { gates[order === 'older first' ? 1 : 0].resolve(); }); await flush();
  expect(bridge().props.snapshot.view.query).toBe('drugo'); expect(bridge().props.refreshing).toBe(false);
  expect(bridge().props.error).toBe(false);
});

test('failed replacement ends refreshing with error; retry succeeds without a stuck busy label', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const gate = pendingRead(); mockTransport = async request => { await gate.promise; return server(request); };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, query: 'knjige' }); });
  expect(bridge().props.refreshing).toBe(true);
  await act(async () => { gate.reject(new Error('DISCOVERY_V1_READ_FAILED')); }); await flush();
  expect(bridge().props.refreshing).toBe(false); expect(bridge().props.error).toBe(true);
  mockTransport = async request => server(request);
  await act(async () => { bridge().props.onRefresh(); }); await flush();
  expect(bridge().props.refreshing).toBe(false); expect(bridge().props.error).toBe(false);
});

test('paging publishes its busy state before reply and duplicate callbacks cannot clear it', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const gate = pendingRead(); mockTransportCalls.length = 0;
  mockTransport = async request => { await gate.promise; return server(request); };
  await act(async () => { bridge().props.actions.onNextPage(); });
  expect(bridge().props.loadingMore).toBe(true); expect(bridge().props.refreshing).toBe(false);
  await act(async () => { bridge().props.actions.onNextPage(); });
  expect(bridge().props.loadingMore).toBe(true); expect(bridge().props.snapshot.items).toHaveLength(50);
  await act(async () => { gate.resolve(); }); await flush();
  expect(bridge().props.loadingMore).toBe(false); expect(bridge().props.snapshot.items).toHaveLength(100);
  expect(modes()).toEqual(['PAGE']);
});

test('an old pending replacement cannot publish into an account revision that has already returned', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const gate = pendingRead(); mockTransport = async request => { await gate.promise; return server(request); };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, query: 'stari razgovor' }); });
  expect(bridge().props.refreshing).toBe(true);
  mockRevision++; mockTransport = async request => server(request);
  await act(async () => { tree!.update(<DiscoveryV1Route />); }); await flush();
  const next = bridge().props.snapshot;
  expect(bridge().props.refreshing).toBe(false);
  await act(async () => { gate.resolve(); }); await flush();
  expect(bridge().props.snapshot).toEqual(next); expect(bridge().props.refreshing).toBe(false);
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; info.mockRestore(); clock?.mockRestore(); clock = undefined; });
let clock: jest.SpyInstance | undefined;
/** The warm window has passed: the picture the route kept is no longer offered, so the next return reads like a first visit. */
const pastWarmWindow = () => {
  const real = Date.now.bind(Date);
  clock = jest.spyOn(Date, 'now').mockImplementation(() => real() + DISCOVERY_V1_WARM_RETURN_MS + 1000);
};
/** Another screen comes in front (the route retires its screen), something happens while it is away, and the person comes back. */
const leaveAndReturn = async (whileAway?: () => Promise<void> | void) => {
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  expect(tree!.root.findAllByType('Bridge' as unknown as React.ElementType)).toHaveLength(0);
  await whileAway?.();
  await flush();
  mockTransportCalls.length = 0;
  mockFocused = true;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
};

test('the database echo of native viewport bounds is a different double, so the fake server proves the trap', () => {
  expect(databaseEcho(NATIVE_BOUNDS)).not.toEqual(NATIVE_BOUNDS);
  expect(databaseEcho(CANONICAL_BOUNDS)).toEqual(CANONICAL_BOUNDS);
});

test('a return from another screen rebuilds the same list, restores its read depth and never shows the error state', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(bridge()).toBeDefined();
  expect(bridge().props.snapshot.items).toHaveLength(50);
  // The first visit: no camera yet, so the map is seeded over the world and then read over the server's whole bounds.
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);
  expect(bridge().props.snapshot.mapWholeBounds).toEqual([19.5, 44.7, 21.9, 45.4]);
  expect(traced()).toEqual(['[USKOCI_P6_TRACE] ["restored","50/1"]']);

  // The person reads a second page, the map reports where it is, and the list is scrolled deep at the full stop.
  await act(async () => { bridge().props.actions.onNextPage(); });
  await flush();
  expect(bridge().props.snapshot.items).toHaveLength(100);
  const settled = { center: [20.6, 45.3], zoom: 8, bounds: NATIVE_BOUNDS };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, viewport: settled, sheet: 'full', listOffset: 4200 }); });
  await flush();
  expect(bridge().props.snapshot.view).toMatchObject({ pages: 2, sheet: 'full', listOffset: 4200 });

  // Another screen comes in front: the screen is retired ...
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  expect(tree!.root.findAllByType('Bridge' as unknown as React.ElementType)).toHaveLength(0);

  // ... and on the way back, after the warm window, it is rebuilt from the saved view, the map read over the camera's own bounds.
  mockTransportCalls.length = 0;
  pastWarmWindow();
  mockFocused = true;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(bridge()).toBeDefined();
  expect(bridge().props.snapshot.items).toHaveLength(100);
  expect(bridge().props.snapshot.view).toMatchObject({ pages: 2, sheet: 'full', listOffset: 4200, viewport: settled });
  expect(modes()).toEqual(['PAGE', 'MAP', 'PAGE']);
  expect((mockTransportCalls[1] as any).bounds).toEqual(CANONICAL_BOUNDS);
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
});

test('clearing a filter reads the map again over the camera the person left, without the error state', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);
  const settled = { center: [20.6, 45.3], zoom: 8, bounds: NATIVE_BOUNDS };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, viewport: settled }); });
  await flush();

  // Remote work has no place: the list alone is read again.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, where: 'remote' }); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(modes()).toEqual(['PAGE']);

  // Clearing it reads the list and the map over the same viewport the person left.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, where: 'any' }); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(modes()).toEqual(['PAGE', 'MAP']);
  expect((mockTransportCalls[1] as any).bounds).toEqual(CANONICAL_BOUNDS);
  expect(bridge().props.snapshot.items).toHaveLength(50);
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
});

test('settling the map on a native viewport reads the list and the map over that area', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.actions.onArea(NATIVE_BOUNDS); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(modes().sort()).toEqual(['MAP', 'PAGE']);
  const map = mockTransportCalls.find(request => request.mode === 'MAP') as any, listed = mockTransportCalls.find(request => request.mode === 'PAGE') as any;
  expect(map.bounds).toEqual(CANONICAL_BOUNDS);
  expect(listed.scope).toEqual({ kind: 'AREA', bounds: CANONICAL_BOUNDS });
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
});

test('the error of one read stays until a later read applies, and only then goes away', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(bridge().props.error).toBe(false);
  mockTransport = async () => { throw new Error('DISCOVERY_V1_READ_FAILED'); };
  await act(async () => { bridge().props.actions.onArea(NATIVE_BOUNDS); });
  await flush();
  expect(bridge().props.error).toBe(true);
  expect(traced()).toContain('[USKOCI_P6_TRACE] ["read-failed","DISCOVERY_V1_READ_FAILED"]');

  // A change that reads nothing (the sheet moved) does not pretend the failed read succeeded.
  mockTransport = async request => server(request);
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, sheet: 'full' }); });
  await flush();
  expect(bridge().props.error).toBe(true);

  // The next read that applies clears it.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, where: 'remote' }); });
  await flush();
  expect(modes()).toEqual(['PAGE']);
  expect(bridge().props.error).toBe(false);
  expect(bridge().props.snapshot.items).toHaveLength(50);
});

test('a return that cannot read the map still ends in the honest error state with a way to try again', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  mockTransport = async request => { if (request.mode === 'MAP') throw new Error('DISCOVERY_V1_READ_FAILED'); return server(request); };
  pastWarmWindow();
  mockFocused = true;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  const shown = errorState();
  expect(shown.length).toBeGreaterThan(0);
  expect(shown[0].props.primary.label).toBe('Pokušaj ponovo');
  expect(traced()).toContain('[USKOCI_P6_TRACE] ["restore-failed","DISCOVERY_V1_READ_FAILED"]');
});

test('a cluster tap reads nothing itself, a task reads its exact row, a place reads its members', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockTransportCalls.length = 0;
  const cluster = { kind: 'CLUSTER', key: 'cluster:1', point: { lat: 45.25, lng: 19.83 }, taskCount: 5, distinctPointCount: 3, memberBounds: [19.8, 45.2, 19.9, 45.3] };
  await act(async () => { bridge().props.actions.onSelectMarker(cluster); });
  await flush();
  expect(mockTransportCalls).toHaveLength(0);
  expect(bridge().props.error).toBe(false);

  const task = { kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) };
  await act(async () => { bridge().props.actions.onSelectMarker(task); });
  await flush();
  expect(modes()).toEqual(['EXACT_PUBLIC']);
  expect(bridge().props.snapshot.peek).toMatchObject({ kind: 'TASK', item: { id: rowId(0) } });
  expect(bridge().props.selectedMarkerKey).toBe(task.key);

  mockTransportCalls.length = 0;
  const place = { kind: 'PLACE', key: 'place:45.25:19.83', point: { lat: 45.25, lng: 19.83 }, taskCount: 30 };
  await act(async () => { bridge().props.actions.onSelectMarker(place); });
  await flush();
  expect(modes()).toEqual(['PAGE']);
  expect((mockTransportCalls[0] as any).scope).toEqual({ kind: 'POINT_MEMBERS', point: { lat: 45.25, lng: 19.83 } });
  expect(bridge().props.snapshot.peek).toMatchObject({ kind: 'PLACE' });
  expect(bridge().props.selectedMarkerKey).toBe(place.key);
});

test('a settled region that is not the person\'s own reads the map alone and keeps the list, the peek and the error state as they are', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  const task = { kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) };
  await act(async () => { bridge().props.actions.onSelectMarker(task); });
  await flush();
  const listBefore = bridge().props.snapshot.items, peekBefore = bridge().props.snapshot.peek;
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.actions.onViewportSettled(NATIVE_BOUNDS); });
  await flush();
  expect(modes()).toEqual(['MAP']);
  expect((mockTransportCalls[0] as any).bounds).toEqual(CANONICAL_BOUNDS);
  expect(bridge().props.snapshot.items).toEqual(listBefore);
  expect(bridge().props.snapshot.peek).toEqual(peekBefore);
  expect(bridge().props.selectedMarkerKey).toBe(task.key);
  expect(bridge().props.snapshot.view.area).toBeNull();
  expect(bridge().props.error).toBe(false);
  // The same region again is where the map already is.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.actions.onViewportSettled(NATIVE_BOUNDS); });
  await flush();
  expect(mockTransportCalls).toHaveLength(0);
});

test('a search draft asked again for the same words reads once, and its previews never clear a list error', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  const draft = { query: 'Liman', place: null, area: null, pinPlace: null, when: 'any', dates: null, where: 'any', places: 1, price: 'all' };
  mockTransportCalls.length = 0;
  jest.useFakeTimers();
  try {
    for (let again = 0; again < 4; again++) {
      await act(async () => { bridge().props.actions.onSearchDraft(draft, [...NATIVE_BOUNDS]); });
      await act(async () => { jest.advanceTimersByTime(400); });
    }
  } finally { jest.useRealTimers(); }
  await flush();
  // One PAGE count and one PLACES facet read, however often the panel asked.
  expect(modes().sort()).toEqual(['PAGE', 'PLACES']);
  expect(bridge().props.search.status).toBe('ready');
  expect(bridge().props.error).toBe(false);
});

test('a change of view is handed back at once, so the next change is built on it and a chosen place is not read away', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  const start = bridge().props.snapshot.view;
  let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  mockTransport = async request => { await gate; return server(request); };
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...start, place: 'Liman, Novi Sad' }); });
  // No read has landed, yet the presentation is already handed the view it asked for.
  expect(bridge().props.snapshot.view.place).toBe('Liman, Novi Sad');
  // Its next change, built on the view it was handed (the sheet settles), keeps the place.
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, sheet: 'peek' }); });
  release();
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(mockTransportCalls.filter(request => request.mode === 'PAGE').map(request => (request as any).filter.place)).toEqual(['Liman, Novi Sad']);
  expect(bridge().props.snapshot.view).toMatchObject({ place: 'Liman, Novi Sad', sheet: 'peek' });
});

// EX-03 warm return (owner approval 2026-09-30): a return inside the warm window shows the picture the screen left, at once, and reads neither the list nor the map again.
test('EX-03: a quick return shows the same picture at once and reads neither the list nor the map again', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  await act(async () => { bridge().props.actions.onNextPage(); });
  await flush();
  const settled = { center: [20.6, 45.3], zoom: 8, bounds: NATIVE_BOUNDS };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, viewport: settled, sheet: 'full', listOffset: 4200 }); });
  await flush();
  const relationReads = mockSource.odnosiPremaZadacima.mock.calls.length;
  info.mockClear();

  await leaveAndReturn();
  expect(errorState()).toHaveLength(0);
  expect(bridge().props.snapshot.items).toHaveLength(100);
  expect(bridge().props.snapshot.view).toMatchObject({ pages: 2, sheet: 'full', listOffset: 4200, viewport: settled });
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
  expect(bridge().props.loading).toBe(false);
  expect(modes()).toEqual([]);                                            // no PAGE, no MAP
  expect(mockSource.odnosiPremaZadacima.mock.calls.length).toBe(relationReads + 1);   // the account relations are asked again, in the background
  expect(traced()).toEqual(['[USKOCI_P6_TRACE] ["restored","100/1"]', expect.stringMatching(/^\[USKOCI_P6_TRACE\] \["warm","\d{1,3}\/100"\]$/)]);
});

test('EX-03: the pin selected when the screen left is still selected, with its card, and nothing is read for it on the way back', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  const marker = bridge().props.snapshot.mapMarkers[0];
  await act(async () => { bridge().props.actions.onSelectMarker(marker); });
  await flush();
  expect(bridge().props.snapshot.peek).toMatchObject({ kind: 'TASK' });

  await leaveAndReturn();
  expect(bridge().props.snapshot.peek).toMatchObject({ kind: 'TASK', item: { id: rowId(0) } });
  expect(bridge().props.selectedMarkerKey).toBe(marker.key);
  expect(bridge().props.snapshot.view).toMatchObject({ selectedId: rowId(0), sheet: 'peek' });
  expect(modes()).toEqual([]);
});

test('EX-03: a read that is replacing the list when the screen leaves is not kept, the return reads like a first visit and shows no error', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  const original = mockTransport;
  mockTransport = async request => { if (request.mode === 'PAGE') await held; return original(request); };
  await act(async () => { bridge().props.onRefresh(); });                // pull to refresh: a read that replaces the list and waits
  await flush();

  await leaveAndReturn(() => { mockTransport = original; release(); });
  expect(errorState()).toHaveLength(0);
  expect(bridge().props.snapshot.items).toHaveLength(50);
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);                        // a first visit again
});

test('EX-03: a screen that left in its error state is not kept', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  const original = mockTransport;
  mockTransport = async () => { throw new Error('DISCOVERY_V1_READ_FAILED'); };
  await act(async () => { bridge().props.actions.onNextPage(); });
  await flush();
  expect(bridge().props.error).toBe(true);

  await leaveAndReturn(() => { mockTransport = original; });
  expect(errorState()).toHaveLength(0);
  expect(bridge().props.error).toBe(false);
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);
});

test('EX-03: what the route kept goes with the route', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  await act(async () => tree!.unmount());                                 // sign-out or an account change: the whole route goes
  tree = undefined;
  mockTransportCalls.length = 0;
  mockFocused = true;
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);                        // a new route reads its own first visit
});


test('explicit task detail keeps the same presentation and loaded depth, but old visit callbacks never revive', async () => {
 await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
 await act(async () => bridge().props.actions.onNextPage()); await flush();
 const before = bridge(), oldProps = before.props;
 await act(async () => before.props.onOpen(before.props.snapshot.items[0]));
 expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
 mockFocused = false; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
 expect(bridge()).toBe(before);
 mockTransportCalls.length = 0;
 mockFocused = true; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
 expect(bridge()).toBe(before); expect(bridge().props.snapshot.items).toHaveLength(100);
 expect(modes()).toEqual([]);
 const currentView = bridge().props.snapshot.view;
 await act(async () => {
   oldProps.onView({ ...currentView, query: 'stale' }); oldProps.actions.onNextPage();
   oldProps.actions.onClearPeek(); oldProps.onOpen(oldProps.snapshot.items[0]);
 }); await flush();
 expect(bridge().props.snapshot.view).toEqual(currentView); expect(modes()).toEqual([]);
 expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
});

test.each(['expired', 'account', 'source'])('held detail surface is discarded after %s before focus resumes', async reason => {
 await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
 const before = bridge(); await act(async () => before.props.onOpen(before.props.snapshot.items[0]));
 mockFocused = false; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
 expect(bridge()).toBe(before);
 if (reason === 'expired') pastWarmWindow();
 else if (reason === 'source') mockSource = { ...mockSource };
 else mockRevision++;
 mockFocused = true; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
 expect(bridge()).not.toBe(before); expect(errorState()).toHaveLength(0);
});

test('background while detail covers the retained route tears down the hidden surface', async () => {
 const listeners = new Set<(state: string) => void>();
 // Expo already mocks this method; spy.mockRestore would reset that shared mock's implementation.
 const originalAdd = AppState.addEventListener;
 AppState.addEventListener = jest.fn((_event: string, listener: (state: string) => void) => {
   listeners.add(listener); return { remove: () => { listeners.delete(listener); } };
 }) as typeof AppState.addEventListener;
 try {
   await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
   const before = bridge(); await act(async () => before.props.onOpen(before.props.snapshot.items[0]));
   mockFocused = false; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
   expect(bridge()).toBe(before);
   await act(async () => { for (const listener of listeners) listener('background'); }); await flush();
   expect(bridge()).toBeUndefined();
   mockFocused = true; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
   expect(bridge()).not.toBe(before);
 } finally { AppState.addEventListener = originalAdd; }
});


test('source A-B-A cannot revive old route navigation callbacks during the same focus', async () => {
 await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
 const sourceA = mockSource, old = bridge().props;
 mockSource = { ...mockSource }; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
 mockSource = sourceA; await act(async () => tree!.update(<DiscoveryV1Route />)); await flush();
 await act(async () => { old.onProfile(); old.onNew(); old.onNotifications(); });
 expect(mockRouter.navigate).not.toHaveBeenCalled();
 await act(async () => bridge().props.onProfile());
 expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
 expect(mockRouter.navigate).toHaveBeenCalledWith('/profil');
});


test.each([false, true])('header Back uses history when available (%s), otherwise Home, and ignores a second press', async history => {
  mockRouter.canGoBack.mockReturnValue(history);
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const back = bridge().props.onBack;
  await act(async () => { back(); back(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(history ? 1 : 0);
  expect(mockRouter.navigate).toHaveBeenCalledTimes(history ? 0 : 1);
  if (!history) expect(mockRouter.navigate).toHaveBeenCalledWith('/');
});

test('a captured header Back cannot navigate after the account revision changes or the route blurs', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush();
  const first = bridge().props.onBack;
  mockRevision++;
  await act(async () => { first(); tree!.update(<DiscoveryV1Route />); }); await flush();
  const second = bridge().props.onBack;
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); }); await flush();
  await act(async () => { first(); second(); });
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled();
});
