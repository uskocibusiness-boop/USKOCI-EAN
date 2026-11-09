'use strict';
// Opt-in read-only hosted proof using two EXISTING dedicated QA logins.
// Never creates/reset accounts, invokes Gemini, prints credentials/tokens or
// writes business records. The credential path is supplied out of band.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { clients, filter } = require('./p6-discovery-integration-harness.cjs');
const ROOT = path.resolve(__dirname, '..');
const output = process.argv[2], credentialPath = process.env.USKOCI_QA_CREDENTIAL_FILE;
assert.ok(output && credentialPath, 'Explicit evidence path and existing dedicated QA credential file required');
const preview = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8')).build.preview.env;
assert.equal(preview.EXPO_PUBLIC_SUPABASE_URL, 'https://leqcwgzvjsxugfgzdmth.supabase.co');
const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
const result = { observedAt: new Date().toISOString(), project: 'leqcwgzvjsxugfgzdmth',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  method: 'Two pre-existing dedicated QA email/password logins; ordinary authenticated JWT via Supabase Auth and real HTTPS PostgREST. Actual P6 transport, decoders and owner.',
  sourceFiles: {}, actors: [], checks: [],
  limitations: ['Small existing DEV corpus only. No synthetic business rows inserted and no hosted capacity claim.',
    'Not Android, native rendering, physical installation, complete publication/matching flow or provider proof.',
    'No legal acceptance/write is attempted. The legal release gate remains unchanged.',
    'EXACT_PUBLIC names an exact task ID, never a private precise location. Coarse map privacy is checked at the wire decoder.'],
  businessWrites: 0, providerCalls: 0, productionFlagChanged: false };
for (const name of ['src/data/discoveryV1Contract.ts', 'src/data/discoveryV1SpatialContract.ts', 'src/data/discoveryV1Owner.ts', 'src/data/discoveryV1ClientTransport.ts'])
  result.sourceFiles[name] = createHash('sha256').update(fs.readFileSync(path.join(ROOT, name))).digest('hex');
const check = (name, details = {}) => { const value = { name, result: 'PASS', ...details }; result.checks.push(value); console.log(JSON.stringify(value)); };
const make = () => createClient(preview.EXPO_PUBLIC_SUPABASE_URL, preview.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  for (const label of ['1', '2']) {
    assert.ok(credentials[label]?.email && credentials[label]?.password);
    const sb = make();
    try {
      const signed = await sb.auth.signInWithPassword(credentials[label]);
      if (signed.error) throw new Error(`DEDICATED_QA_AUTH_FAILED:${signed.error.status}:${signed.error.code}`);
      const verified = await sb.auth.getUser();
      assert.equal(verified.error, null); assert.equal(verified.data.user.role, 'authenticated');
      let requests = 0;
      const wrapped = { rpc: (name, args) => { requests++; return sb.rpc(name, args); } };
      const h = clients(wrapped), owner = h.owner();
      owner.begin(filter(), { kind: 'ALL' }, 1);
      const first = await owner.firstPage(); assert.equal(first.kind, 'applied');
      const anchor = first.value.anchor;
      let pages = 1;
      while (owner.snapshot().page.hasMore) {
        assert.ok(++pages <= 50, 'This is a small read-only DEV proof, never a hosted load test');
        await owner.nextPage(); assert.deepEqual(owner.snapshot().page.anchor, anchor);
      }
      const page = owner.snapshot().page;
      assert.equal(new Set(page.items.map(row => row.id)).size, page.items.length);
      assert.equal(page.items.length, page.counts.listed);
      check(`QA actor ${label}: ordinary-Auth PAGE and complete keyset continuation`, { pages, publicRows: page.items.length, duplicateRows: 0 });

      const map = await owner.loadMap([-180, -90, 180, 90]); assert.equal(map.kind, 'applied');
      assert.ok(map.value.buckets.length <= 256);
      const places = await owner.firstPlaces('', null, 10); assert.equal(places.kind, 'applied');
      const cityRaw = await h.transport({ mode: 'PLACES', filter: filter(), anchor: null, prefix: '', facetArea: null, limit: 10, after: null, groupBy: 'CITY' }, new AbortController().signal);
      const city = h.decodeDiscoveryV1Places(cityRaw, 10);
      check(`QA actor ${label}: MAP, PLACES AREA and CITY pass actual decoders`, { mapBuckets: map.value.buckets.length, areas: places.value.items.length, cities: city.items.length });

      assert.ok(page.items.length > 0, 'EXACT_PUBLIC proof requires at least one real visible task');
      const exact = await owner.readExact(page.items[0].id); assert.equal(exact.kind, 'applied');
      assert.equal(exact.value.items[0].id, page.items[0].id);
      check(`QA actor ${label}: EXACT_PUBLIC returns the requested coarse public projection`);
      for (const changes of [{ where: 'onsite' }, { where: 'remote' }, { price: 'MY_PRICE', minBudgetRsd: 1200 },
        { places: 2 }, { text: page.items[0].title.slice(0, 16) }, { when: 'today' }]) {
        owner.begin(filter(changes), { kind: 'ALL' }, 50); await owner.firstPage();
        assert.ok(owner.snapshot().page.items.length <= 50);
        if (changes.where === 'remote') assert.ok(owner.snapshot().page.items.every(row => row.pin === null));
      }
      check(`QA actor ${label}: onsite/remote, price, people, text and time filters are accepted`);
      const forMe = await wrapped.rpc('rpc_discovery_v1', { p_request: { mode: 'PAGE', filter: filter({ forMe: true }), anchor: null, scope: { kind: 'ALL' }, limit: 50, after: null } });
      let forMeOutcome;
      if (forMe.error) { assert.equal(forMe.error.message, 'P6_FOR_ME_PROFILE_REQUIRED'); forMeOutcome = 'ACTIVE_PROFILE_REQUIRED'; }
      else { h.decodeDiscoveryV1Page(forMe.data, 50); forMeOutcome = 'ACCEPTED_PUBLIC_PAGE'; }
      check(`QA actor ${label}: ForMe gives a validated page or the explicit profile refusal`, { outcome: forMeOutcome });

      for (const columns of ['*', 'remaining_search_close_reason', 'remaining_search_closed_by_account_id']) {
        const read = await sb.from('needs').select(columns).limit(1);
        assert.ok(read.error); assert.equal(read.error.code, '42501');
      }
      check(`QA actor ${label}: whole-row and private closure columns remain denied`, { sqlstate: '42501', operations: 3 });
      result.actors.push({ label: `dedicated-qa-${label}`, role: 'authenticated', publicRows: page.items.length, pageRequests: pages, p6Requests: requests });
      owner.retire();
    } finally {
      // Only this proof's freshly created session is ended; do not sign out
      // other devices or revoke the fixture account's global sessions.
      await sb.auth.signOut({ scope: 'local' });
    }
  }
  const anon = make();
  const denied = await anon.rpc('rpc_discovery_v1', { p_request: { mode: 'PAGE', filter: filter(), anchor: null, scope: { kind: 'ALL' }, limit: 1, after: null } });
  assert.ok(denied.error); assert.equal(denied.error.code, '42501');
  check('Unauthenticated HTTPS P6 call is denied', { sqlstate: '42501' });
  result.summary = { pass: result.checks.length, fail: 0, ordinaryAuthenticatedActors: result.actors.length };
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}
main().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
