'use strict';
// Opt-in real PostgreSQL 17/PostGIS integration, loopback only. The P6 RPC
// is the exact current migrated definition; the production decoder,
// transport, owner, projection and coordinator execute unchanged.
// No hosted load, provider call, Android RAM or native UI claim.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { startFixture, stopFixture } = require('./p0-discovery-native-benchmark.cjs');
const { clients, rpcFor, filter } = require('./p6-discovery-integration-harness.cjs');
const ROOT = path.resolve(__dirname, '..');
const sql = name => fs.readFileSync(path.join(__dirname, 'sql', name), 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
const evidence = { capturedAt: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  sourceFiles: {}, checks: [], scale: [],
  boundary: 'Native isolated PostgreSQL 17/PostGIS + actual migrated RPC + actual transport/decoder/owners/adapter. No hosted load or phone.',
  limitations: [
    'Existing R05 fixture has synthetic account/world lineage and taxonomy/area eligibility seams. Ordinary hosted Auth is a separate proof.',
    'All pagination walks run in Node on a local machine. The actual screen is separately checked for one initial 50-row PAGE and lazy continuation; 30000 rows are never loaded on a phone.',
    'One sequential SQL connection; no concurrency/capacity, provider, Realtime or Android performance claim.',
    'Optional profile/relations/urgency loaders are inert injected boundaries and their request sizes are checked. Real profile HTTP is a separate boundary.',
    'Timing includes the local RPC wrapper. p99 at small page counts is just the maximum and does not establish an SLO.',
  ] };
for (const name of ['src/data/discoveryV1Contract.ts', 'src/data/discoveryV1SpatialContract.ts', 'src/data/discoveryV1ClientTransport.ts',
  'src/data/discoveryV1Owner.ts', 'src/data/discoveryV1SearchOwner.ts', 'src/data/discoveryV1ScreenSession.ts', 'src/data/discoveryV1RouteCoordinator.ts',
  'src/data/discoveryV1MarketplaceAdapter.ts', 'src/app/(app)/zadaci.tsx',
  'supabase/migrations/20261108095246_r02_discovery_schedule_20261108.sql'])
  evidence.sourceFiles[name] = sha256(fs.readFileSync(path.join(ROOT, name)));
const pass = (name, details = {}) => { const check = { name, result: 'PASS', ...details }; evidence.checks.push(check); console.log(JSON.stringify(check)); };

async function main() {
  const f = await startFixture(), { db, value, actor, raw } = f;
  const preimage = JSON.parse(sql('r02_discovery_schedule_20261108.preimage.json'));
  await db.exec(preimage.definition);
  await db.exec(sql('r02_discovery_schedule_20261108.sql'));
  evidence.postgres = await value('select version() as value');
  evidence.postgis = await value('select extensions.postgis_full_version() as value');
  evidence.reader = await value("select jsonb_build_object('bodyMd5',md5(prosrc),'securityDefiner',prosecdef,'config',proconfig,'acl',proacl::text) as value from pg_proc where oid='public.rpc_discovery_v1(jsonb)'::regprocedure");
  assert.equal(evidence.reader.bodyMd5, 'c75535d3f77b2216ed424843ef57ef04', 'Exact body independently read back from DEV at 2026-11-08T15:30Z');
  assert.equal(evidence.reader.securityDefiner, false);
  const sample = await value('select to_jsonb(n) as value from public.needs n where status=\'PUBLISHED\' order by id limit 1');
  const actorId = await value("select account_id as value from private.account_lineage_v5 where account_id<>$1 and world=private.account_visibility_world($1) order by account_id limit 1", [sample.requester_account_id]);
  assert.ok(actorId);
  const fields = JSON.parse(sql('r05_discovery_contract_20261107.preimage.json')).needsState.columns.map(c => c.name).filter(c => c !== 'approx_geog');
  // Only this disposable database is changed. Existing hosted users/rows are never written.
  await db.exec("update public.needs set status='DRAFT';delete from public.need_selections;create temporary table p6_scale_ids(i int primary key,id uuid unique);");
  await db.exec("insert into p6_scale_ids select i,md5('p6-full-walk-20261108-'||i)::uuid from generate_series(1,30000)i;");
  await db.query(`insert into public.needs(${fields.join(',')}) select ${fields.map(c => 'x.' + c).join(',')}
    from p6_scale_ids g cross join lateral jsonb_populate_record(null::public.needs,$1::jsonb||jsonb_build_object(
      'id',g.id,'title',case when g.i%100=0 then 'Posebno P6 ' else 'Izolovan P6 ' end||g.i,
      'status','PUBLISHED','published_at',statement_timestamp()-interval '1 hour'-(g.i/2)*interval '1 microsecond',
      'execution_location_mode',case when g.i%3=0 then 'REMOTE' else 'STATIONARY' end,
      'schedule_kind','FLEXIBLE','starts_at',null,'ends_at',null,
      'approximate_city',case when g.i%3=0 then '' else 'Grad'||lpad((g.i%40)::text,2,'0') end,
      'approximate_area',case when g.i%3=0 then '' else 'Zona'||lpad((g.i%200)::text,3,'0') end,
      'approximate_lat',case when g.i%3=0 then null else 45+(g.i%50)::numeric/100 end,
      'approximate_lng',case when g.i%3=0 then null else 19+((g.i/50)%50)::numeric/100 end,
      'required_slots',5,'required_skills','[]'::jsonb,'required_tools','[]'::jsonb,'required_vehicles','[]'::jsonb,
      'mode','MY_PRICE','price_basis','HOURLY','requester_price_rsd',1200,'response_deadline',null))x`, [sample]);

  for (const total of [100, 1000, 5000, 5001, 10000, 30000]) {
    await db.exec('reset role');
    await db.query("update public.needs n set status=case when s.i<=$1 then 'PUBLISHED' else 'DRAFT' end from p6_scale_ids s where n.id=s.id", [total]);
    await db.exec('analyze public.needs;analyze public.need_selections;');
    const expected = (await db.query("select id from public.needs where status='PUBLISHED' order by published_at desc,id desc")).rows.map(row => row.id);
    assert.equal(expected.length, total);
    await actor(actorId);
    const durations = [], responseSizes = [], pageSizes = [], cursors = new Set();
    const rpc = rpcFor(async request => {
      const start = process.hrtime.bigint(), result = await raw(request);
      durations.push(Number(process.hrtime.bigint() - start) / 1e6); responseSizes.push(Buffer.byteLength(JSON.stringify(result)));
      pageSizes.push(result.items.length); assert.ok(result.items.length <= 100);
      if (result.nextCursor) { const key = JSON.stringify(result.nextCursor); assert.equal(cursors.has(key), false); cursors.add(key); }
      return result;
    });
    const h = clients(rpc.client), owner = h.owner();
    owner.begin(filter(), { kind: 'ALL' }, 100);
    assert.equal((await owner.firstPage()).kind, 'applied');
    const acceptedAnchor = owner.snapshot().page.anchor;
    while (owner.snapshot().page.hasMore) {
      assert.ok(rpc.calls.length <= Math.ceil(total / 100));
      assert.equal((await owner.nextPage()).kind, 'applied');
      assert.deepEqual(owner.snapshot().page.anchor, acceptedAnchor);
    }
    const page = owner.snapshot().page;
    assert.deepEqual(page.items.map(row => row.id), expected);
    assert.equal(new Set(page.items.map(row => row.id)).size, total);
    assert.equal(page.counts.listed, total);
    assert.equal(rpc.calls.length, Math.ceil(total / 100));
    const beforeNoop = rpc.calls.length;
    assert.equal((await owner.nextPage()).kind, 'noop'); assert.equal(rpc.calls.length, beforeNoop);
    assert.ok(page.items.every(row => row.pin === null || row.pin.precision === 'COARSE_1KM'));
    assert.ok(page.items.every(row => row.executionLocationMode !== 'REMOTE' || row.pin === null));
    assert.ok(page.items.every(row => row.priceBasis === 'HOURLY' && row.requesterPriceRsd === 1200 && row.requiredSlots === 5));
    owner.retire();
    durations.sort((a, b) => a - b);
    const result = { total, pages: rpc.calls.length, acceptedRows: page.items.length, duplicateRows: 0, missingRows: 0,
      maxResponseRows: Math.max(...pageSizes), maxResponseBytes: Math.max(...responseSizes),
      p50Ms: percentile(durations, .5), p95Ms: percentile(durations, .95), p99Ms: percentile(durations, .99),
      stableAnchor: true, stableCursors: true, fullExpectedOrder: true };
    evidence.scale.push(result); pass(`Complete real PAGE traversal: ${total}`, result);
  }

  const rpc = rpcFor(raw), h = clients(rpc.client), route = h.coordinator();
  assert.equal((await route.open(h.view({ where: 'onsite', area: [19, 45, 20, 46], viewport: { center: [19.5, 45.5], zoom: 10, bounds: [19, 45, 20, 46] } }))).kind, 'applied');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rpc.calls.filter(c => c.request.mode === 'PAGE').length, 1);
  assert.equal(route.snapshot().screen.items.length, 50);
  assert.ok(route.snapshot().screen.counts.listed >= 20000);
  assert.ok(route.snapshot().screen.mapMarkers.length <= 256);
  assert.equal(route.snapshot().screen.mapRead.error, null);
  assert.ok(h.overlayCalls.every(row => row.rows <= 100));
  const listBefore = route.snapshot().screen.items.map(row => row.id);
  await route.nextPage(); assert.equal(route.snapshot().screen.items.length, 100);
  assert.deepEqual(route.snapshot().screen.items.slice(0, 50).map(row => row.id), listBefore);
  pass('Real coordinator first view is bounded, map is aggregated, continuation is lazy', {
    totalMatching: route.snapshot().screen.counts.listed, initialRows: 50, rowsAfterExplicitNext: 100,
    maxMapBuckets: route.snapshot().screen.mapMarkers.length, optionalRowBound: 100,
  });

  const selectedRpc = rpcFor(raw), selected = clients(selectedRpc.client).owner();
  selected.begin(filter({ text: 'Posebno' }), { kind: 'ALL' }, 50);
  await selected.firstPage(); while (selected.snapshot().page.hasMore) await selected.nextPage();
  assert.equal(selected.snapshot().page.items.length, 300); assert.equal(selected.snapshot().page.counts.listed, 300);
  assert.ok(selected.snapshot().page.items.every(row => row.title.startsWith('Posebno')));
  pass('Selective search keeps exact count and completes every page', { acceptedRows: 300, pages: selectedRpc.calls.length });

  const spatialOwner = clients(rpc.client).owner(); spatialOwner.begin(filter({ where: 'onsite' })); await spatialOwner.firstPage();
  const map = await spatialOwner.loadMap([19, 45, 20, 46]); assert.equal(map.kind, 'applied');
  assert.equal(map.value.buckets.reduce((sum, bucket) => sum + (bucket.kind === 'TASK' ? 1 : bucket.taskCount), 0), 20000);
  assert.ok(map.value.buckets.length <= 256);
  const placeFirst = await spatialOwner.firstPlaces('', null, 10); assert.equal(placeFirst.kind, 'applied');
  let placePages = 1;
  while (spatialOwner.snapshot().places.hasMore) { await spatialOwner.nextPlaces(); assert.ok(++placePages <= 30); }
  const places = spatialOwner.snapshot().places;
  assert.equal(places.items.reduce((sum, place) => sum + place.count, 0), 20000);
  assert.equal(new Set(places.items.map(place => place.key)).size, places.items.length);
  const publicRow = spatialOwner.snapshot().page.items[0], point = publicRow.pin;
  assert.equal((await spatialOwner.firstMembers({ lat: point.lat, lng: point.lng }, 3)).kind, 'applied');
  let memberPages = 1;
  while (spatialOwner.snapshot().members.hasMore) { await spatialOwner.nextMembers(); assert.ok(++memberPages <= 10); }
  const members = spatialOwner.snapshot().members;
  assert.ok(members.items.length > 3);
  assert.equal(members.items.length, members.counts.listed);
  assert.equal(new Set(members.items.map(row => row.id)).size, members.items.length);
  assert.ok(members.items.every(row => row.pin.lat === point.lat && row.pin.lng === point.lng));
  assert.equal((await spatialOwner.readExact(publicRow.id)).value.items[0].id, publicRow.id);
  pass('Real MAP, PLACES, POINT_MEMBERS and EXACT_PUBLIC share coarse public data', {
    mappedRows: 20000, buckets: map.value.buckets.length, places: places.items.length, placePages,
    pointMembers: members.items.length, memberPages, pinPrecision: 'COARSE_1KM',
  });

  const search = h.load('src/data/discoveryV1SearchOwner.ts').createDiscoveryV1SearchOwner(h.transport);
  await search.preview(h.view({ where: 'onsite' }), null, 10);
  let searchPlacePages = 1;
  while (search.snapshot().placeHasMore) { await search.nextPlaces(); assert.ok(++searchPlacePages <= 10); }
  assert.equal(search.snapshot().places.length, 40);
  assert.equal(new Set(search.snapshot().places.map(row => row.key)).size, 40);
  assert.equal(search.snapshot().places.reduce((sum, row) => sum + row.count, 0), 20000);
  assert.equal(search.snapshot().facetError, false);
  pass('Real search PLACES preserves its anchor across complete CITY pagination', { cityRows: 40, cityPages: searchPlacePages, matchingTasks: 20000 });

  // One task closes after page one; another is published after the anchor.
  // A later page must skip the closed row, and the new row appears only after refresh.
  await db.exec('reset role');
  const beforeRows = (await db.query("select id from public.needs where status='PUBLISHED' order by published_at desc,id desc limit 160")).rows;
  const closedId = beforeRows[100].id;
  await actor(actorId);
  const changing = clients(rpc.client).owner(); changing.begin(filter(), { kind: 'ALL' }, 50); await changing.firstPage();
  const anchor = changing.snapshot().page.anchor;
  await db.exec('reset role');
  await db.query("update public.needs set status='CANCELLED' where id=$1", [closedId]);
  const newId = '70000000-0000-4000-8000-999999999999';
  await db.query(`insert into public.needs(${fields.join(',')}) select ${fields.map(c => 'x.' + c).join(',')}
    from jsonb_populate_record(null::public.needs,$1::jsonb||jsonb_build_object('id',$2::uuid,'title','New after anchor P6',
      'status','PUBLISHED','published_at',statement_timestamp())) x`, [sample, newId]);
  await actor(actorId); await changing.nextPage(); await changing.nextPage();
  assert.equal(changing.snapshot().page.items.some(row => row.id === closedId || row.id === newId), false);
  assert.deepEqual(changing.snapshot().page.anchor, anchor);
  changing.begin(filter(), { kind: 'ALL' }, 50); await changing.firstPage();
  assert.equal(changing.snapshot().page.items[0].id, newId);
  assert.equal((await changing.readExact(closedId)).value.items.length, 0);
  pass('Close/new publication during traversal and explicit refresh retain keyset semantics', { newlyPublishedOnlyAfterRefresh: true, closedRowAbsent: true });

  // An invalid/expired scope cannot silently return an unrelated page.
  const currentPage = changing.snapshot().page;
  const request = { mode: 'PAGE', filter: filter(), scope: { kind: 'ALL' }, limit: 50, anchor: currentPage.anchor, after: currentPage.nextCursor };
  await assert.rejects(raw({ ...request, after: { ...request.after, scopeKey: '0'.repeat(32) } }), /P6_INVALID_CURSOR/);
  const old = new Date(Date.now() - 31 * 60_000).toISOString(), end = new Date(Date.parse(old) + 30 * 60_000).toISOString();
  await assert.rejects(raw({ ...request, anchor: { ...request.anchor, timeAt: old, publishedThrough: old, expiresAt: end }, after: null }), /P6_ANCHOR_EXPIRED/);
  await db.exec('reset role'); await actor(null, 'anon'); await assert.rejects(raw(request), error => error.code === '42501');
  await actor(null); await assert.rejects(raw(request), /AUTH_REQUIRED/);
  pass('Real SQL refuses wrong cursor, expired anchor, anon and absent identity');
  route.retire(); selected.retire(); spatialOwner.retire(); search.retire(); changing.retire();
  evidence.summary = { pass: evidence.checks.length, fail: 0, phoneInstalled: false, productionFlagChanged: false, hostedDataMutations: 0 };
  const output = process.argv[2]; assert.ok(output, 'Explicit evidence output path required');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(stopFixture);
