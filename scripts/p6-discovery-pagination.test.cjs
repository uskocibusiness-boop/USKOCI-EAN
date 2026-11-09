'use strict';
// Actual production TS transport/owner/session/coordinator, controlled RPC
// responses. The separate native and hosted runners prove SQL and HTTP.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { clients, rpcFor, syntheticServer, filter, deferred, id } = require('./p6-discovery-integration-harness.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const total of [100, 1000, 5000, 5001, 10000, 30000]) {
  test(`P6 actual coordinator remains lazy with ${total} matching tasks`, async () => {
    const server = syntheticServer(total), rpc = rpcFor(server.answer), h = clients(rpc.client), c = h.coordinator();
    await c.open(h.view({ where: 'onsite', area: [19, 45, 20, 46], viewport: { center: [19.5, 45.5], zoom: 9, bounds: [19, 45, 20, 46] } }));
    await tick();
    assert.equal(c.snapshot().screen.items.length, 50);
    assert.equal(c.snapshot().screen.counts.listed, total);
    assert.equal(rpc.calls.filter(c => c.request.mode === 'PAGE').length, 1);
    assert.equal(rpc.calls.filter(c => c.request.mode === 'MAP').length, 1);
    assert.equal(c.snapshot().screen.mapMarkers.length, 1);
    assert.ok(h.overlayCalls.every(c => c.rows <= 100));
    const a = c.nextPage(), b = c.nextPage(); await Promise.all([a, b]);
    assert.equal(rpc.calls.filter(c => c.request.mode === 'PAGE').length, 2);
    assert.equal(c.snapshot().screen.items.length, 100);
    assert.equal(new Set(c.snapshot().screen.items.map(row => row.id)).size, 100);
    c.retire();
  });
}

test('P6 rapid filter change fences a late previous PAGE and sends no remote MAP', async () => {
  const pending = deferred(), server = syntheticServer(1000);
  let delayed = false;
  const rpc = rpcFor(request => {
    if (!delayed) { delayed = true; return pending.promise; }
    return server.answer(request);
  });
  const h = clients(rpc.client), c = h.coordinator();
  const oldView = h.view({ where: 'onsite' });
  const old = c.open(oldView);
  const latest = await c.updateView(h.view({ where: 'remote', query: 'novi upit' }));
  assert.equal(latest.kind, 'applied');
  pending.resolve(server.answer(rpc.calls[0].request));
  assert.equal((await old).kind, 'stale');
  assert.equal(c.snapshot().view.query, 'novi upit');
  assert.equal(c.snapshot().view.where, 'remote');
  assert.ok(c.snapshot().screen.items.every(row => row.detalji.rezimLokacije === 'REMOTE' && row.priblizno === null));
  assert.equal(rpc.calls.some(call => call.request.mode === 'MAP'), false);
  c.retire();
});

test('P6 explicit refresh starts a fresh anchor and retains no previous continuation', async () => {
  const server = syntheticServer(5001), rpc = rpcFor(server.answer), h = clients(rpc.client), c = h.coordinator();
  const view = h.view({ where: 'remote' });
  await c.open(view); await c.nextPage();
  const firstAnchor = rpc.calls[1].request.anchor;
  await c.open(view); await c.nextPage();
  assert.notDeepEqual(rpc.calls[3].request.anchor, firstAnchor);
  assert.equal(c.snapshot().screen.items.length, 100);
  assert.equal(rpc.calls[2].request.after, null); assert.equal(rpc.calls[2].request.anchor, null);
  c.retire();
});

test('P6 changed account/visit rejects the original in-flight answer and clears retired state', async () => {
  const pending = deferred(), server = syntheticServer(1000), rpc = rpcFor(() => pending.promise);
  let current = true;
  const h = clients(rpc.client, { isCurrent: () => current }), owner = h.owner();
  owner.begin(filter()); const reading = owner.firstPage(); current = false;
  pending.resolve(server.answer(rpc.calls[0].request));
  assert.equal((await reading).kind, 'stale'); assert.equal(owner.snapshot().page, null);
  current = true; owner.retire();
  assert.equal(owner.snapshot().active, false); assert.equal(owner.snapshot().page, null);
});

test('P6 suspended A-B-A lifecycle cannot accept the earlier account read', async () => {
  const pending = deferred(), server = syntheticServer(1000), rpc = rpcFor(request => request.after ? pending.promise : server.answer(request));
  const h = clients(rpc.client), c = h.coordinator();
  await c.open(h.view({ where: 'remote' }));
  const more = c.nextPage(); assert.equal(c.detach(), true);
  c.attach({ isCurrent: () => true, onOptionalState: () => {} });
  pending.resolve(server.answer(rpc.calls.at(-1).request));
  assert.equal((await more).kind, 'stale');
  assert.equal(c.snapshot().screen.items.length, 50); assert.equal(c.snapshot().loadingMore, false);
  c.retire();
});

test('P6 expired anchor is renewed once before the requested next page', async () => {
  const server = syntheticServer(1000); let expired = false;
  const rpc = rpcFor(request => {
    if (request.after && !expired) { expired = true; throw new Error('P6_ANCHOR_EXPIRED'); }
    return server.answer(request);
  });
  const h = clients(rpc.client), c = h.coordinator();
  await c.open(h.view({ where: 'remote' }));
  assert.equal((await c.nextPage()).kind, 'applied');
  assert.deepEqual(rpc.calls.map(call => !!call.request.anchor), [false, true, false, true]);
  assert.notDeepEqual(rpc.calls[1].request.anchor, rpc.calls[3].request.anchor);
  assert.equal(c.snapshot().screen.items.length, 100); assert.equal(c.snapshot().loadingMore, false);
  c.retire();
});

test('P6 repeated anchor refusal stays an error and never retries without a bound', async () => {
  const server = syntheticServer(1000);
  const rpc = rpcFor(request => { if (request.after) throw new Error('P6_ANCHOR_EXPIRED'); return server.answer(request); });
  const h = clients(rpc.client), c = h.coordinator();
  await c.open(h.view({ where: 'remote' }));
  await assert.rejects(c.nextPage(), /DISCOVERY_V1_ANCHOR_EXPIRED/);
  assert.equal(rpc.calls.length, 4); assert.equal(c.snapshot().loadingMore, false);
  assert.equal(c.snapshot().screen.items.length, 50); c.retire();
});

test('P6 MAP failure does not erase a valid PAGE and MAP retry is independent', async () => {
  const server = syntheticServer(1000); let failed = false;
  const rpc = rpcFor(request => {
    if (request.mode === 'MAP' && !failed) { failed = true; throw new Error('CONTROLLED_MAP_ERROR'); }
    return server.answer(request);
  });
  const h = clients(rpc.client), c = h.coordinator();
  assert.equal((await c.open(h.view({ where: 'onsite' }))).kind, 'applied');
  assert.equal(c.snapshot().screen.items.length, 50); assert.ok(c.snapshot().screen.mapRead.error);
  await c.retryMap();
  assert.equal(c.snapshot().screen.mapRead.error, null); assert.equal(c.snapshot().screen.items.length, 50);
  assert.equal(rpc.calls.filter(c => c.request.mode === 'PAGE').length, 1); c.retire();
});

test('P6 EXACT_PUBLIC can select a task outside the loaded first PAGE', async () => {
  const server = syntheticServer(30000), rpc = rpcFor(server.answer), h = clients(rpc.client), c = h.coordinator();
  await c.open(h.view({ where: 'remote' }));
  const selected = await c.selectMarker({ kind: 'TASK', taskId: id(1), key: 'chosen', point: { lat: 45.25, lng: 19.84 }, taskCount: 1 });
  assert.equal(selected.applied, true); assert.equal(c.snapshot().screen.peek.item.id, id(1));
  assert.equal(c.snapshot().screen.items.length, 50);
  assert.equal(rpc.calls.at(-1).request.mode, 'EXACT_PUBLIC');
  assert.deepEqual(c.snapshot().screen.peek.item.priblizno, { lat: 45.25, lng: 19.84 });
  c.retire();
});

test('P6 HTTP transport deadline aborts a stalled request without automatic resend', async () => {
  const pending = deferred(), rpc = rpcFor(() => pending.promise), timers = [];
  const h = clients(rpc.client, { timers: { 'src/data/discoveryV1ClientTransport.ts': {
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {},
  } } });
  const owner = h.owner(); owner.begin(filter()); const response = owner.firstPage();
  assert.equal(timers[0].ms, 15000); timers[0].fn();
  await assert.rejects(response, /DISCOVERY_V1_READ_TIMEOUT/);
  assert.equal(rpc.calls.length, 1); assert.equal(rpc.calls[0].signal.aborted, true); assert.equal(owner.snapshot().page, null);
  pending.resolve(null); owner.retire();
});

// Negative controls: these tests fail on 559928ef. The old implementation
// accepts a repeated continuation, or replaces the search anchor silently.
for (const domain of ['PAGE', 'MEMBERS', 'PLACES']) {
  test(`P6 ${domain} rejects a repeated continuation cursor and keeps a retryable page`, async () => {
    const server = syntheticServer(1000); let replay = true, initial;
    const rpc = rpcFor(request => {
      if (request.after && replay) return structuredClone(initial);
      const result = server.answer(request);
      if ((domain === 'PLACES' ? request.mode === 'PLACES' : request.mode === 'PAGE') && !request.after) initial = result;
      return result;
    });
    const h = clients(rpc.client), owner = h.owner(); owner.begin(filter()); await owner.firstPage();
    let next, snapshot;
    if (domain === 'PAGE') { next = () => owner.nextPage(); snapshot = () => owner.snapshot().page; }
    if (domain === 'MEMBERS') {
      await owner.firstMembers({ lat: 45.25, lng: 19.84 }, 50); next = () => owner.nextMembers(); snapshot = () => owner.snapshot().members;
    }
    if (domain === 'PLACES') { await owner.firstPlaces('', null, 10); next = () => owner.nextPlaces(); snapshot = () => owner.snapshot().places; }
    const before = snapshot();
    await assert.rejects(next(), /CURSOR_STALLED/);
    assert.equal(snapshot(), before, 'Retain exact previous accepted page and cursor');
    replay = false; assert.equal((await next()).kind, 'applied');
    assert.equal(snapshot().items.length, before.items.length * 2); owner.retire();
  });
}

test('P6 search PLACES rejects a foreign anchor and preserves the same retry request', async () => {
  const server = syntheticServer(1000); let corrupt = true;
  const rpc = rpcFor(request => {
    const raw = server.answer(request);
    if (request.mode === 'PLACES' && request.after && corrupt) {
      raw.filterKey = 'b'.repeat(32); raw.anchor = { ...raw.anchor, filterKey: raw.filterKey };
    }
    return raw;
  });
  const h = clients(rpc.client), search = h.load('src/data/discoveryV1SearchOwner.ts').createDiscoveryV1SearchOwner(h.transport);
  await search.preview(h.view({ where: 'onsite' }), null, 10);
  const before = search.snapshot(); await assert.rejects(search.nextPlaces(), /ANCHOR_DRIFT/);
  assert.deepEqual(search.snapshot().places, before.places); assert.equal(search.snapshot().placePaging, false);
  assert.equal(search.snapshot().facetError, true);
  const failed = rpc.calls.at(-1).request;
  corrupt = false; await search.nextPlaces(); assert.deepEqual(rpc.calls.at(-1).request, failed);
  assert.equal(search.snapshot().places.length, 20); search.retire();
});

test('P6 search PLACES rejects a repeated cursor without claiming successful loading', async () => {
  const server = syntheticServer(1000); let repeat = true, first;
  const rpc = rpcFor(request => {
    if (request.mode === 'PLACES' && request.after && repeat) return structuredClone(first);
    const raw = server.answer(request); if (request.mode === 'PLACES' && !request.after) first = raw; return raw;
  });
  const h = clients(rpc.client), search = h.load('src/data/discoveryV1SearchOwner.ts').createDiscoveryV1SearchOwner(h.transport);
  await search.preview(h.view({ where: 'onsite' }), null, 10);
  const before = search.snapshot(); await assert.rejects(search.nextPlaces(), /CURSOR_STALLED/);
  assert.deepEqual(search.snapshot().places, before.places); assert.equal(search.snapshot().placePaging, false);
  repeat = false; await search.nextPlaces(); assert.equal(search.snapshot().places.length, 20); search.retire();
});

test('P6 actual route no longer reads a publication handoff; preview and production keep their declared gate', () => {
  const { ROOT } = require('./ux-component-harness.cjs');
  const route = fs.readFileSync(path.join(ROOT, 'src/app/(app)/zadaci.tsx'), 'utf8');
  assert.match(route, /selectDiscoveryReader\(\{ publicationHandoff: false, proofParam \}\)/);
  assert.equal(route.includes('usePublicationLanding'), false);
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_P6_DISCOVERY_READER, '1');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_P6_DISCOVERY_READER, '0');
});
