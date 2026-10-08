import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';
import { taskRelationIndex } from '../taskRelation';
import { discoveryV1RouteIntentKey } from '../discoveryV1RouteCoordinator';
import { discoveryV1ViewPlan } from '../discoveryV1MarketplaceAdapter';
import { initialMarketplaceView, type MarketplaceView } from '../marketplaceView';

/**
 * R28, "Za mene" (DISCOVERY-ZAMENE, applied to DEV 2026-10-07): the switch is one OPTIONAL key of the request's filter, present only when it is on. This drives the REAL
 * route, screen, coordinator and owners over a fake server, the way the lifecycle suite does, and holds what the client has to do about the key: carry it in every
 * read of the traversal, start a NEW traversal when it changes (a new anchor, never an old one reused), and answer the one refusal that is about the person
 * (P6_FOR_ME_PROFILE_REQUIRED: no active work profile) by turning the switch off, reading the list again without it, and saying why.
 */
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const AT = '2026-10-08T05:00:00.000000Z', EX = '2026-10-08T05:30:00.000000Z', A = 'a'.repeat(32);
let mockFocused = true;
const mockSource = { odnosiPremaZadacima: jest.fn(async (ids: readonly string[]) => taskRelationIndex([], ids)) };
const mockRouter = { navigate: jest.fn() };
const mockCalls: DiscoveryV1OwnerRequest[] = [];
let mockTransport: (request: DiscoveryV1OwnerRequest) => Promise<unknown>;

jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockRouter.navigate(...args) },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]);
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.dev' } } }));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
}));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => ({ target: null, handled: jest.fn(), retire: jest.fn() }) }));
// The real transport module (it names the refusal), with only its factory replaced by the fake server.
jest.mock('../discoveryV1ClientTransport', () => ({ ...jest.requireActual('../discoveryV1ClientTransport'),
  createDiscoveryV1SupabaseTransport: () => (request: unknown) => mockTransport(request as DiscoveryV1OwnerRequest) }));
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn(async () => null) } }));
jest.mock('../needUrgencyClientService', () => ({ readNeedUrgencies: jest.fn(async () => new Map()) }));
jest.mock('../discoveryV1PresentationBridge', () => ({ DiscoveryV1PresentationBridge: 'Bridge' }));

import { DiscoveryV1Route } from '../../ui/v2/discovery/DiscoveryV1Route';
import { DISCOVERY_V1_FOR_ME_REFUSED } from '../discoveryV1ClientTransport';
import { DISCOVERY_V1_WARM_RETURN_MS } from '../discoveryV1WarmReturn';
import { FOR_ME_SWITCH_EXISTS } from '../../ui/workerProfile/workerProfileFacts';

const rowId = (n: number) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;
const anchor = () => ({ version: 'DISCOVERY_V1', filterKey: A, timeAt: AT, publishedThrough: AT, expiresAt: EX });
const item = (n: number): any => ({ id: rowId(n), revision: 1, sortAt: AT, publishedAt: AT, title: `Task ${n}`, category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: 'STATIONARY', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  verifiedIdentityRequired: false, approximateCity: 'Novi Sad', approximateArea: 'Liman', pin: { lat: 45.25, lng: 19.83, precision: 'COARSE_1KM' },
  requiredSlots: 1, coveredSlots: 0, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [], minimumExperienceYears: null,
  priceMode: 'OFFERS', requesterPriceRsd: null, priceBasis: null, requesterProfileId: PROFILE, responseDeadline: null, acceptsApplications: true,
  publicTopology: null, criticalConditions: null });

/** A server of 3 tasks. With `forMe` it answers 1 task, the way the real one narrows the list, the map and their counts to the caller's profile. */
function server(request: DiscoveryV1OwnerRequest): unknown {
  mockCalls.push(request);
  const forMe = (request as any).filter?.forMe === true, count = forMe ? 1 : 3;
  if (request.mode === 'MAP') {
    return { version: 'DISCOVERY_V1', mode: 'MAP', asOf: AT, filterKey: A, anchor: anchor(), coverageBounds: (request as any).bounds, effectiveGrid: 8,
      wholeBounds: [19.5, 44.7, 21.9, 45.4], buckets: [{ kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) }],
      counts: { kind: 'exact_live', observedAt: AT, mapped: count, withoutPoint: 0 } };
  }
  if (request.mode === 'PAGE') {
    return { version: 'DISCOVERY_V1', mode: 'PAGE', asOf: AT, filterKey: A, anchor: anchor(), items: Array.from({ length: count }, (_, i) => item(i)), hasMore: false,
      nextCursor: null, counts: { kind: 'exact_live', observedAt: AT, mapped: count, listed: count, inArea: count, withoutPoint: 0, undated: 0 },
      availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['OFFERS'] } };
  }
  if (request.mode === 'PLACES') {
    return { version: 'DISCOVERY_V1', mode: 'PLACES', asOf: AT, filterKey: A, anchor: anchor(), items: [{ key: 'novi sad, liman', text: 'Novi Sad, Liman', count }],
      hasMore: false, nextCursor: null, counts: { kind: 'exact_live', observedAt: AT, everywhere: count, inArea: null } };
  }
  throw new Error('UNEXPECTED_MODE');
}
/** The server of a person whose work profile is not active: it refuses the key and answers everything else. */
const refusing = async (request: DiscoveryV1OwnerRequest) => {
  if ((request as any).filter?.forMe === true) { mockCalls.push(request); throw new Error(DISCOVERY_V1_FOR_ME_REFUSED); }
  return server(request);
};

let tree: ReactTestRenderer | undefined;
const bridge = () => tree!.root.findAllByType('Bridge' as unknown as React.ElementType)[0];
const errorState = () => tree!.root.findAllByProps({ title: 'Ne možemo da učitamo zadatke' });
const flush = async () => { for (let i = 0; i < 80; i++) await act(async () => { await Promise.resolve(); }); };
const modes = () => mockCalls.map(request => request.mode);
const carriesKey = (request: DiscoveryV1OwnerRequest) => 'filter' in request && 'forMe' in (request as any).filter;
let info: jest.SpyInstance;
let clock: jest.SpyInstance | undefined;
beforeEach(() => {
  mockFocused = true; mockCalls.length = 0; mockTransport = async request => server(request); mockRouter.navigate.mockClear();
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; info.mockRestore(); clock?.mockRestore(); clock = undefined; });
const mount = async () => { await act(async () => { tree = create(<DiscoveryV1Route />); }); await flush(); };
const askForMe = async (on: boolean) => {
  mockCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, forMe: on }); });
  await flush();
};

describe('the view and the request', () => {
  const view = (patch: Partial<MarketplaceView> = {}): MarketplaceView => ({ ...initialMarketplaceView(), mode: 'map', ...patch });

  test('"Za mene" is a key of the filter only while it is on: off, the request is the one the server has always read', () => {
    expect(discoveryV1ViewPlan(view({ forMe: true })).filter).toEqual({ text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null, forMe: true });
    for (const off of [view(), view({ forMe: false })]) expect('forMe' in discoveryV1ViewPlan(off).filter).toBe(false);
    // it is a scope, not a place: remote work keeps it, and the list's own scope (area, point) is untouched by it
    const remote = discoveryV1ViewPlan(view({ forMe: true, where: 'remote', area: [19, 44, 21, 46] }));
    expect(remote.filter.forMe).toBe(true); expect(remote.pageScope).toEqual({ kind: 'ALL' });
  });

  test('a change of it is a different traversal: the route reads again with a new anchor, and the same value is not a change', () => {
    expect(discoveryV1RouteIntentKey(view({ forMe: true }))).not.toBe(discoveryV1RouteIntentKey(view()));
    expect(discoveryV1RouteIntentKey(view({ forMe: false }))).toBe(discoveryV1RouteIntentKey(view()));
    expect(discoveryV1RouteIntentKey(view({ forMe: true, sheet: 'full', listOffset: 400 }))).toBe(discoveryV1RouteIntentKey(view({ forMe: true })));
  });

  test('the transport names the one refusal that is about the person, and every other server text stays the generic failure', async () => {
    // The module is replaced by the fake server above, so the real factory is taken from the actual one.
    const { createDiscoveryV1SupabaseTransport } = jest.requireActual('../discoveryV1ClientTransport') as typeof import('../discoveryV1ClientTransport');
    const answer = (message: string) => createDiscoveryV1SupabaseTransport({ rpc: async () => ({ data: null, error: { message } }) } as never)(
      { mode: 'EXACT_PUBLIC', needId: rowId(0) } as DiscoveryV1OwnerRequest, new AbortController().signal);
    await expect(answer('P6_FOR_ME_PROFILE_REQUIRED')).rejects.toThrow(DISCOVERY_V1_FOR_ME_REFUSED);
    await expect(answer('P6_INVALID_FILTER')).rejects.toThrow('DISCOVERY_V1_READ_FAILED');
    await expect(answer('private provider text')).rejects.toThrow('DISCOVERY_V1_READ_FAILED');
    await expect(answer('AUTH_REQUIRED')).rejects.toThrow('AUTH_REQUIRED');
  });
});

describe('the Zadaci route with "Za mene"', () => {
  test('the switch exists exactly as far as the build says, and the way to the work profile is the route\'s', async () => {
    await mount();
    expect(bridge().props.forMeAvailable).toBe(FOR_ME_SWITCH_EXISTS);
    await act(async () => { bridge().props.onWorkProfile(); });
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/radnik');
  });

  test('asking for it reads the list and the map again with the key, over a new anchor; asking for every task takes the key away again', async () => {
    await mount();
    expect(bridge().props.snapshot.items).toHaveLength(3);
    expect(mockCalls.some(carriesKey)).toBe(false); // a first visit is the request the server has always read

    await askForMe(true);
    expect(bridge().props.snapshot.items).toHaveLength(1);
    expect(bridge().props.snapshot.view.forMe).toBe(true);
    expect(bridge().props.forMeRefused).toBe(false);
    expect(modes()[0]).toBe('PAGE');
    expect((mockCalls[0] as any).anchor).toBeNull();
    // every read of the traversal carries the key: the list, the map, and nothing is read without it
    expect(mockCalls.filter(request => request.mode === 'PAGE' || request.mode === 'MAP').every(request => (request as any).filter.forMe === true)).toBe(true);
    expect(mockCalls.some(request => request.mode === 'MAP')).toBe(true);

    await askForMe(false);
    expect(bridge().props.snapshot.items).toHaveLength(3);
    expect(modes()[0]).toBe('PAGE');
    expect((mockCalls[0] as any).anchor).toBeNull();
    expect(mockCalls.some(carriesKey)).toBe(false);
    expect(bridge().props.snapshot.view.forMe).toBeFalsy();
  });

  test('the places of the search are read over the same scope', async () => {
    await mount();
    await askForMe(true);
    mockCalls.length = 0;
    await act(async () => { bridge().props.actions.onSearchDraft({ ...bridge().props.snapshot.view, query: '', place: null }, null); });
    await act(async () => { await new Promise(done => setTimeout(done, 300)); });
    await flush();
    const places = mockCalls.filter(request => request.mode === 'PLACES');
    expect(places.length).toBeGreaterThan(0);
    expect(places.every(request => (request as any).filter.forMe === true)).toBe(true);
  });

  test('a refusal (no active work profile) turns the switch back off, reads the list again without the key, and says why once', async () => {
    mockTransport = refusing;
    await mount();
    await askForMe(true);
    expect(bridge().props.forMeRefused).toBe(true);
    expect(errorState()).toHaveLength(0); expect(bridge().props.error).toBe(false);
    expect(bridge().props.snapshot.view.forMe).toBeFalsy();
    expect(bridge().props.snapshot.items).toHaveLength(3); // every task, as before
    // the refused read, then the list read again without the key
    const pages = mockCalls.filter(request => request.mode === 'PAGE');
    expect(pages.map(carriesKey)).toEqual([true, false]);

    // closing the line retires the sentence; asking again is a new attempt, and its refusal says it again
    await act(async () => { bridge().props.onDismissForMeRefused(); });
    expect(bridge().props.forMeRefused).toBe(false);
    await askForMe(true);
    expect(bridge().props.forMeRefused).toBe(true);
    expect(bridge().props.snapshot.items).toHaveLength(3);
  });

  test('a refusal is not a failure of the read: no error state, and an ordinary failure still is one', async () => {
    mockTransport = async request => { if ((request as any).filter?.forMe === true) { mockCalls.push(request); throw new Error('DISCOVERY_V1_READ_FAILED'); } return server(request); };
    await mount();
    await askForMe(true);
    expect(bridge().props.forMeRefused).toBe(false);
    expect(bridge().props.error).toBe(true);
  });

  test('a view kept from before the work profile went inactive is read again without the key on the way back, and the refusal is said', async () => {
    await mount();
    await askForMe(true);
    expect(bridge().props.snapshot.view.forMe).toBe(true);
    mockFocused = false;
    await act(async () => { tree!.update(<DiscoveryV1Route />); });
    await flush();
    mockTransport = refusing;
    const real = Date.now.bind(Date);
    clock = jest.spyOn(Date, 'now').mockImplementation(() => real() + DISCOVERY_V1_WARM_RETURN_MS + 1000);
    mockCalls.length = 0;
    mockFocused = true;
    await act(async () => { tree!.update(<DiscoveryV1Route />); });
    await flush();
    expect(errorState()).toHaveLength(0);
    expect(bridge().props.forMeRefused).toBe(true);
    expect(bridge().props.snapshot.view.forMe).toBeFalsy();
    expect(bridge().props.snapshot.items).toHaveLength(3);
    expect(mockCalls.filter(request => request.mode === 'PAGE').map(carriesKey)).toEqual([true, false]);
  });
});
