// Bounded DEV verification with two explicitly provisioned synthetic accounts.
// No admin credential, provider call, publication, push, deletion, or automatic
// mutation retry. Private credentials and raw responses must stay outside Git.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const child = require('node:child_process');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const PROJECT = 'leqcwgzvjsxugfgzdmth';
const flag = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const privatePath = flag('--private-state'), outputPath = flag('--output');
const readOnlyFollowup = process.argv.includes('--read-only-followup');
const nonpartyAgreement = flag('--nonparty-agreement');
if (!privatePath || !outputPath) throw Error('Use --private-state outside Git and --output for the sanitized receipt');
if (path.resolve(privatePath).startsWith(ROOT + path.sep)) throw Error('PRIVATE_STATE_MUST_BE_OUTSIDE_REPOSITORY');
if ((fs.statSync(privatePath).mode & 0o077) !== 0) throw Error('PRIVATE_STATE_MUST_BE_MODE_0600');
const state = JSON.parse(fs.readFileSync(privatePath, 'utf8'));
if (state.project !== PROJECT || state.actors?.length !== 2 || (state.probeStarted && !readOnlyFollowup)) throw Error('EXACT_NEW_FIXTURE_INTENT_REQUIRED_NO_BLIND_RETRY');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8')).build.preview.env;
const origin = config.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
// The accepted preview keeps the modern publishable value in the historical
// Expo variable name for supported-client compatibility; validate the value.
const key = config.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? config.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (origin !== `https://${PROJECT}.supabase.co` || !key?.startsWith('sb_publishable_')) throw Error('CANONICAL_DEV_PUBLIC_KEY_REQUIRED');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
if (readOnlyFollowup && (!state.probeStarted || !uuid(nonpartyAgreement)
  || state.actors.some(actor => actor.needOpenState !== 'CONFIRMED' || !uuid(actor.conversationId)))) throw Error('CONFIRMED_EXISTING_FIXTURE_REQUIRED');
const modules = new Map();
function load(relative) {
  const file = ['', '.ts', '.tsx'].map(ext => path.resolve(ROOT, relative + ext)).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!file) throw Error('SOURCE_MODULE_MISSING');
  if (modules.has(file)) return modules.get(file).exports;
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  if (compiled.diagnostics?.length) throw Error('SOURCE_TRANSPILE_FAILED');
  const mod = { exports: {} }; modules.set(file, mod);
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(path.relative(ROOT, path.resolve(path.dirname(file), name))) : require(name), mod, mod.exports);
  return mod.exports;
}
const pageDecoder = load('src/data/discoveryV1Contract').decodeDiscoveryV1Page;
const spatial = load('src/data/discoveryV1SpatialContract');
const receipt = { schema: readOnlyFollowup ? 'USKOCI_R01_PRIVATE_READ_BOUNDARY_V1' : 'USKOCI_R01_P6_ORDINARY_AUTH_V1', completed: false, startedAtUtc: new Date().toISOString(), project: PROJECT,
  sourceCommit: child.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  harnessSha256: hash(fs.readFileSync(__filename)), actors: [], checks: [],
  boundary: readOnlyFollowup
    ? 'Read-only signed HTTP follow-up using the same two confirmed synthetic accounts. Positive own-conversation reads; negative access to populated private location/agreement/message tables, a real nonparty agreement reveal, and direct Storage listings. No participant location grant/revocation, signed URL, media upload/download, logout, Android or public-release claim.'
    : 'Real signed ordinary Auth HTTP and current client decoders. Fixture identities were created with the Auth admin API and admitted to TEST separately; this does not test signup email delivery, devices, 5001 live rows, storage, exact-location revocation, or public release.',
  providerCalls: 0, adminBusinessWrites: 0, deletions: 0, publications: 0, pushSends: 0 };
const raw = [];
const persist = () => fs.writeFileSync(privatePath, JSON.stringify(state), { mode: 0o600 });
function save() {
  receipt.finishedAtUtc = new Date().toISOString();
  receipt.passed = receipt.checks.filter(x => x.pass).length;
  receipt.failed = receipt.checks.filter(x => !x.pass).length;
  receipt.status = receipt.failed ? 'FAIL' : receipt.completed ? 'PASS_WITH_STATED_BOUNDARY' : 'IN_PROGRESS';
  fs.writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(path.dirname(privatePath), readOnlyFollowup ? 'r01-private-read-responses.json' : 'r01-private-responses.json'), JSON.stringify(raw), { mode: 0o600 });
  persist();
}
async function request(name, actor, resource, body, method) {
  if (readOnlyFollowup && body !== undefined && resource !== '/auth/v1/token?grant_type=password'
    && resource !== '/rest/v1/rpc/rpc_reveal_contact' && !/^\/storage\/v1\/object\/list\/(?:profile-media|agreement-voice|data-export-artifacts)$/.test(resource)) throw Error('READ_ONLY_FOLLOWUP_ENDPOINT_REQUIRED');
  const start = performance.now();
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (actor?.session?.access_token) headers.Authorization = `Bearer ${actor.session.access_token}`;
  let result;
  try {
    const response = await fetch(origin + resource, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000) });
    const text = await response.text();
    result = { status: response.status, data: text ? JSON.parse(text) : null, elapsedMs: Math.round(performance.now() - start) };
  } catch { result = { status: 0, data: null, elapsedMs: Math.round(performance.now() - start), transportUnknown: true }; }
  // Session-bearing Auth responses are already held in the private state only.
  if (!resource.startsWith('/auth/')) raw.push({ name, ...result });
  return result;
}
function check(name, result, predicate, details) {
  let pass = false; try { pass = !!predicate(result); } catch { /* A decoder rejection is a real failed check. */ }
  receipt.checks.push({ name, pass, httpStatus: result.status, elapsedMs: result.elapsedMs,
    sqlstate: result.data?.code ?? null, ...(details ?? {}) });
  save();
  return pass;
}
const rpc = (name, actor, method, body = {}) => request(name, actor, '/rest/v1/rpc/' + method, body);
const denied = r => r.status === 401 || r.status === 403;
const hidden = r => denied(r) || r.status === 200 && Array.isArray(r.data) && r.data.length === 0;
async function main() {
  if (!readOnlyFollowup) { state.probeStarted = receipt.startedAtUtc; persist(); }
  for (const actor of state.actors) {
    if (!uuid(actor.id) || !actor.email?.endsWith('@uskoci-test.invalid') || actor.state !== 'CREATED_CONFIRMED_TEST') throw Error('SYNTHETIC_ACTOR_REQUIRED');
    const login = await request('login-' + actor.label, null, '/auth/v1/token?grant_type=password', { email: actor.email, password: actor.password });
    if (!check('ordinary-password-login-' + actor.label, login, r => r.status === 200 && r.data.user?.id === actor.id
      && r.data.user.app_metadata?.qa_fixture_run === state.run && r.data.user.role === 'authenticated' && r.data.user.email_confirmed_at)) throw Error('ORDINARY_AUTH_FAILED');
    actor.session = login.data; persist();
    const [header, claims] = login.data.access_token.split('.').slice(0, 2).map(x => JSON.parse(Buffer.from(x, 'base64url').toString()));
    if (claims.sub !== actor.id || claims.role !== 'authenticated' || !uuid(claims.session_id) || !['ES256', 'RS256'].includes(header.alg)) throw Error('SIGNED_ORDINARY_SESSION_REQUIRED');
    receipt.actors.push({ label: actor.label, accountIdSha256: hash(actor.id), jwtAlgorithm: header.alg, jwtRole: claims.role, sessionIdPresent: true });
    const own = await request('auth-user-' + actor.label, actor, '/auth/v1/user');
    if (!check('auth-user-verified-' + actor.label, own, r => r.status === 200 && r.data.id === actor.id)) throw Error('AUTH_USER_READBACK_FAILED');
  }
  const [a, b] = state.actors;
  if (readOnlyFollowup) {
    receipt.nonpartyAgreementIdSha256 = hash(nonpartyAgreement);
    for (const actor of [a, b]) {
      let r = await request('own-conversation-still-readable-' + actor.label, actor,
        `/rest/v1/ai_conversations?select=id,account_id&id=eq.${actor.conversationId}`);
      check('positive-own-conversation-' + actor.label, r, x => x.status === 200 && x.data.length === 1 && x.data[0].account_id === actor.id);
      for (const [table, fields] of [['need_sensitive', 'need_id,exact_address,access_notes,exact_lat,exact_lng'],
        ['agreements', 'id,requester_account_id,worker_account_id'], ['agreement_messages', 'id,agreement_id'], ['access_grants', 'id,agreement_id']]) {
        r = await request('private-table-' + table + '-' + actor.label, actor, `/rest/v1/${table}?select=${fields}&limit=1`);
        check('nonparty-' + table + '-hidden-' + actor.label, r, hidden);
      }
      for (const channel of ['EXACT_LOCATION', 'PHONE']) {
        r = await rpc('nonparty-contact-' + channel + '-' + actor.label, actor, 'rpc_reveal_contact', { p_agreement_id: nonpartyAgreement, p_channel: channel });
        check('real-nonparty-' + channel + '-denied-' + actor.label, r, x => x.status === 403 && x.data?.code === '42501' && x.data?.message === 'NOT_PARTY');
      }
      for (const bucket of ['profile-media', 'agreement-voice', 'data-export-artifacts']) {
        r = await request('storage-list-' + bucket + '-' + actor.label, actor, '/storage/v1/object/list/' + bucket,
          { prefix: '', limit: 1, offset: 0, sortBy: { column: 'name', order: 'asc' } });
        check('direct-storage-list-empty-' + bucket + '-' + actor.label, r, hidden);
      }
    }
    receipt.fixtureConversationsCreated = 0; receipt.completed = true; save();
    console.log(JSON.stringify({ status: receipt.status, passed: receipt.passed, failed: receipt.failed, proof: outputPath }));
    if (receipt.failed) process.exitCode = 1;
    return;
  }
  for (const [actor, other] of [[a, b], [b, a]]) {
    let r = await request('own-account-' + actor.label, actor, `/rest/v1/app_accounts?select=id,email,city&id=eq.${actor.id}`);
    check('own-account-positive-' + actor.label, r, x => x.status === 200 && x.data.length === 1 && x.data[0].id === actor.id && x.data[0].city === '');
    r = await request('other-account-' + actor.label, actor, `/rest/v1/app_accounts?select=id,email,phone&id=eq.${other.id}`);
    check('other-account-email-phone-hidden-' + actor.label, r, hidden);
    for (const projection of ['remaining_search_close_reason', 'remaining_search_closed_by_account_id', '*']) {
      r = await request('private-need-column-' + projection + '-' + actor.label, actor, '/rest/v1/needs?select=' + encodeURIComponent(projection) + '&limit=1');
      check('private-need-projection-denied-' + projection + '-' + actor.label, r, denied);
    }
    r = await request('public-need-' + actor.label, actor, '/rest/v1/needs?select=id,title,status,revision&limit=1');
    check('supported-need-projection-' + actor.label, r, x => x.status === 200 && Array.isArray(x.data));
    actor.needOpenKey = crypto.randomUUID(); actor.needOpenState = 'DISPATCHING'; persist();
    r = await rpc('owned-conversation-open-' + actor.label, actor, 'rpc_ai_open_need_conversation_owned_v2', { p_client_request_id: actor.needOpenKey });
    if (!check('owned-conversation-open-' + actor.label, r, x => x.status === 200 && x.data.authoritative === true
      && uuid(x.data.conversationId) && x.data.clientRequestId === actor.needOpenKey)) throw Error('OPEN_OUTCOME_UNCONFIRMED_NO_RETRY');
    actor.conversationId = r.data.conversationId; actor.needOpenState = 'CONFIRMED'; persist();
  }
  for (const [actor, other] of [[a, b], [b, a]]) {
    let r = await request('own-conversation-' + actor.label, actor, `/rest/v1/ai_conversations?select=id,account_id,purpose&id=eq.${actor.conversationId}`);
    check('own-conversation-positive-' + actor.label, r, x => x.status === 200 && x.data.length === 1 && x.data[0].account_id === actor.id);
    r = await request('other-conversation-' + actor.label, actor, `/rest/v1/ai_conversations?select=id,account_id,purpose&id=eq.${other.conversationId}`);
    check('other-conversation-hidden-' + actor.label, r, hidden);
    r = await rpc('other-conversation-review-' + actor.label, actor, 'rpc_ai_need_review_v2', { p_conversation_id: other.conversationId });
    check('other-conversation-rpc-denied-' + actor.label, r, x => denied(x) || x.status === 404);
    r = await rpc('home-attention-' + actor.label, actor, 'rpc_home_attention');
    check('home-attention-ordinary-auth-' + actor.label, r, x => x.status === 200 && x.data !== null);
  }
  const filter = { text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null };
  const page = { mode: 'PAGE', filter, anchor: null, scope: { kind: 'ALL' }, limit: 2, after: null };
  let first = await rpc('p6-first', a, 'rpc_discovery_v1', { p_request: page });
  if (check('p6-page-signed-http-and-current-decoder', first, r => r.status === 200 && pageDecoder(r.data, 2))) {
    const ids = first.data.items.map(x => x.id); let previous = first.data, traversed = 1;
    while (previous.hasMore && traversed < 10) {
      const r = await rpc('p6-next-' + traversed, a, 'rpc_discovery_v1', { p_request: { ...page, anchor: first.data.anchor, after: previous.nextCursor } });
      if (!check('p6-continuation-' + traversed, r, x => x.status === 200 && pageDecoder(x.data, 2))) break;
      ids.push(...r.data.items.map(x => x.id)); previous = r.data; traversed += 1;
    }
    check('p6-live-keysets-no-duplicates', first, () => ids.length === new Set(ids).size && !previous.hasMore, { pages: traversed, visibleRows: ids.length });
    const map = await rpc('p6-map', a, 'rpc_discovery_v1', { p_request: { mode: 'MAP', filter, anchor: first.data.anchor, bounds: [-180, -90, 180, 90], grid: 24 } });
    check('p6-map-signed-http-and-current-decoder', map, r => r.status === 200 && spatial.decodeDiscoveryV1Map(r.data));
    const places = await rpc('p6-places', a, 'rpc_discovery_v1', { p_request: { mode: 'PLACES', filter, anchor: null, prefix: '', facetArea: null, limit: 30, after: null } });
    check('p6-places-signed-http-and-current-decoder', places, r => r.status === 200 && spatial.decodeDiscoveryV1Places(r.data, 30));
  }
  let r = await rpc('p6-anon', null, 'rpc_discovery_v1', { p_request: page }); check('p6-anon-denied', r, denied);
  r = await request('needs-anon', null, '/rest/v1/needs?select=id&limit=1'); check('needs-anon-denied', r, denied);
  r = await rpc('legal-public-readiness', null, 'rpc_get_legal_bundle');
  check('legal-unpublished-guard-retained', r, x => x.status === 200 && x.data.ready === false && x.data.reason === 'LEGAL_DOCUMENTS_NOT_PUBLISHED');
  r = await rpc('anon-private-delete-negative', null, 'rpc_delete_abandoned_intake_conversation', { p_conversation_id: a.conversationId });
  check('anon-conversation-delete-denied', r, denied);
  r = await request('owner-read-after-anon-refusal', a, `/rest/v1/ai_conversations?select=id&id=eq.${a.conversationId}`);
  check('denied-command-preserves-owned-conversation', r, x => x.status === 200 && x.data.length === 1);
  receipt.fixtureConversationsCreated = 2;
  receipt.completed = true;
  save();
  console.log(JSON.stringify({ status: receipt.status, passed: receipt.passed, failed: receipt.failed, proof: outputPath }));
  if (receipt.failed) process.exitCode = 1;
}
main().catch(error => {
  receipt.stopped = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'UNEXPECTED_HARNESS_ERROR';
  receipt.checks.push({ name: 'complete-bounded-run', pass: false, safeCode: receipt.stopped }); save();
  console.error(receipt.stopped); process.exitCode = 1;
});
