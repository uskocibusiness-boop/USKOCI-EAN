'use strict';
// Loads the actual P6 transport, owners, projection and route coordinator.
// Only unused native/network defaults are inert; callers supply the actual
// database/HTTP RPC or an explicitly labelled synthetic response boundary.
const assert = require('node:assert/strict');
const { createHarness, deferred } = require('./ux-component-harness.cjs');
const id = n => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const filter = (change = {}) => ({ text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null, ...change });

function clients(client, options = {}) {
  const h = createHarness({
    'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw new Error('No ambient API client in P6 integration proof'); } },
    'src/store/sesija.ts': { sesijaSada: () => ({ user: null, accountRevision: 0 }) },
    'expo-constants': { default: { expoConfig: { android: { package: 'rs.uskoci.preview.qa' } } } },
  }, options.timers ?? {});
  const transport = h.load('src/data/discoveryV1ClientTransport.ts').createDiscoveryV1SupabaseTransport(client);
  const page = h.load('src/data/discoveryV1Contract.ts');
  const spatial = h.load('src/data/discoveryV1SpatialContract.ts');
  const overlayCalls = [];
  const overlays = {
    relations: async ids => {
      assert.ok(ids.length <= 100); overlayCalls.push({ mode: 'relations', rows: ids.length });
      return { owned: new Set(), applied: new Set(), relation: () => ({ kind: 'UNKNOWN' }) };
    },
    profile: async () => { throw new Error('The actual coordinator should use the injected bounded batch'); },
    profiles: async ids => {
      assert.ok(ids.length <= 100); overlayCalls.push({ mode: 'profiles', rows: ids.length });
      return new Map(ids.map(value => [value, null]));
    },
    urgencies: async rows => {
      assert.ok(rows.length <= 100); overlayCalls.push({ mode: 'urgencies', rows: rows.length }); return new Map();
    },
  };
  return { ...h, transport, overlayCalls, ...page, ...spatial,
    owner: () => h.load('src/data/discoveryV1Owner.ts').createDiscoveryV1Owner(transport, options.isCurrent),
    coordinator: () => h.load('src/data/discoveryV1RouteCoordinator.ts').createDiscoveryV1RouteCoordinator(transport, overlays, options.isCurrent),
    view: (change = {}) => ({ ...h.load('src/data/marketplaceView.ts').initialMarketplaceView(), ...change }),
  };
}

function rpcFor(read) {
  const calls = [];
  const client = { rpc(name, args) {
    assert.equal(name, 'rpc_discovery_v1');
    assert.deepEqual(Object.keys(args), ['p_request']);
    return { abortSignal: async signal => {
      const request = args.p_request;
      calls.push({ request, signal });
      try { return { data: await read(request, signal), error: null }; }
      catch (error) { return { data: null, error: { message: error.message, code: error.code } }; }
    } };
  } };
  return { client, calls };
}

const instant = '2026-11-08T12:00:00.123456Z';
function item(n, patch = {}) {
  return { id: id(n), revision: 1, sortAt: instant, publishedAt: instant, title: `P6 zadatak ${n}`, category: 'Pomoć',
    status: 'PUBLISHED', urgent: false, scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null,
    executionLocationMode: 'STATIONARY', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade', verifiedIdentityRequired: false,
    approximateCity: 'Novi Sad', approximateArea: 'Liman', pin: { lat: 45.25, lng: 19.84, precision: 'COARSE_1KM' },
    requiredSlots: 5, coveredSlots: 2, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
    minimumExperienceYears: null, priceMode: 'MY_PRICE', requesterPriceRsd: 1200, priceBasis: 'HOURLY', requesterProfileId: id(999999),
    responseDeadline: null, acceptsApplications: true, publicTopology: null, criticalConditions: [], ...patch };
}

// A deliberately named model for client race tests. Native tests use the
// deployed SQL body and never this function as a database substitute.
function syntheticServer(total = 30000) {
  let clock = 0;
  const answer = request => {
    const asOf = '2026-11-08T12:01:01.123456Z';
    if (request.mode === 'EXACT_PUBLIC') return { version: 'DISCOVERY_V1', mode: 'EXACT_PUBLIC', asOf,
      items: [item(Number(request.needId.slice(-12)))], hasMore: false, nextCursor: null };
    const key = require('node:crypto').createHash('md5').update(JSON.stringify([request.filter,
      ...(request.mode === 'PLACES' ? [request.prefix, request.facetArea, request.groupBy ?? null] : [])])).digest('hex');
    const anchor = request.anchor ?? { version: 'DISCOVERY_V1', filterKey: key,
      timeAt: `2026-11-08T12:01:00.${String(++clock).padStart(6, '0')}Z`,
      publishedThrough: `2026-11-08T12:01:00.${String(clock).padStart(6, '0')}Z`,
      expiresAt: `2026-11-08T12:31:00.${String(clock).padStart(6, '0')}Z` };
    if (request.mode === 'MAP') return { version: 'DISCOVERY_V1', mode: 'MAP', asOf, filterKey: key, anchor,
      coverageBounds: request.bounds, effectiveGrid: 8, wholeBounds: [19.83, 45.24, 19.85, 45.26],
      buckets: [{ kind: 'PLACE', key: '45.25,19.84', point: { lat: 45.25, lng: 19.84 }, taskCount: total }],
      counts: { kind: 'exact_live', observedAt: asOf, mapped: total, withoutPoint: 0 } };
    if (request.mode === 'PLACES') {
      const start = request.after ? Number(request.after.text.slice(-2)) + 1 : 0;
      const length = Math.min(request.limit, 40 - start), hasMore = start + length < 40;
      const items = Array.from({ length }, (_, i) => ({ key: 'grad' + String(start + i).padStart(2, '0'),
        text: 'Grad' + String(start + i).padStart(2, '0'), count: Math.max(1, Math.floor(total / 40)) }));
      return { version: 'DISCOVERY_V1', mode: 'PLACES', asOf, filterKey: key, anchor, items, hasMore,
        nextCursor: hasMore ? { ...items.at(-1) } : null,
        counts: { kind: 'exact_live', observedAt: asOf, everywhere: total, inArea: null } };
    }
    assert.equal(request.mode, 'PAGE');
    const remaining = request.after ? Number(request.after.id.slice(-12)) - 1 : total;
    const length = Math.min(request.limit, remaining), last = remaining - length + 1, hasMore = remaining > length;
    return { version: 'DISCOVERY_V1', mode: 'PAGE', asOf, filterKey: key, anchor,
      items: Array.from({ length }, (_, i) => item(remaining - i, request.filter.where === 'remote'
        ? { executionLocationMode: 'REMOTE', pin: null } : {})), hasMore,
      nextCursor: hasMore ? { scopeKey: 'a'.repeat(32), section: 0, sortAt: instant, id: id(last) } : null,
      counts: { kind: 'exact_live', observedAt: asOf, mapped: total, listed: total, inArea: total, withoutPoint: 0, undated: total },
      availability: { hasKnownWorkMode: true, hasKnownSchedule: false, priceModes: ['MY_PRICE'] } };
  };
  return { answer };
}

module.exports = { clients, rpcFor, syntheticServer, item, id, instant, filter, deferred };
