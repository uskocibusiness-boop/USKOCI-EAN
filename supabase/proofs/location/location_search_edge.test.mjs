// Actual TypeScript Edge handler; every env/fetch value is synthetic.
// This verifies the adapter and auth transport, not a live geocoder or deployment.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const entry = resolve(root, 'supabase/functions/uskoci-location-search/index.ts');
const source = ts.transpileModule(readFileSync(entry, 'utf8'), {
  fileName: entry, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.deepEqual(source.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error), []);
const userId = '11111111-1111-4111-8111-111111111111';
const defaultMarket = { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn-RS', defaultTimezone: 'Europe/Belgrade' };
const defaultPlace = { place_id: 123456, display_name: 'SYNTHETIC_PRIVATE_PLACE', lat: '44.123456', lon: '20.654321', address: { country_code: 'rs' },
  licence: 'PROVIDER_PRIVATE_EXTRA', osm_type: 'node', boundingbox: ['PRIVATE_BOUNDING_BOX'] };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function fixture(options = {}) {
  const calls = [], logs = [], envReads = [], timers = new Map();
  const env = { SUPABASE_URL: 'https://database.test.invalid', SUPABASE_ANON_KEY: 'SYNTHETIC_ANON_KEY',
    SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC_SERVICE_KEY_MUST_NEVER_BE_READ',
    LOCATIONIQ_ACCESS_TOKEN: 'SYNTHETIC_PROVIDER_SECRET', ...options.env };
  let handler, timerId = 0, now = 1_000_000;
  class FixedDate extends Date { static now() { return now; } }
  const context = vm.createContext({ exports: {}, Request, Response, Headers, URL, URLSearchParams, TextDecoder, AbortController, Intl, Date: FixedDate,
    setTimeout: (fn, ms) => { assert.equal(ms, 7000); const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    Deno: { env: { get: key => { envReads.push(key); return env[key]; } }, serve: fn => { handler = fn; } },
    fetch: async (url, init = {}) => {
      const path = new URL(url).pathname;
      const kind = path === '/auth/v1/user' ? 'auth' : path === '/rest/v1/rpc/rpc_list_location_markets' ? 'markets'
        : new URL(url).origin === 'https://eu1.locationiq.com' && ['/v1/search', '/v1/reverse'].includes(path) ? 'provider' : null;
      assert.ok(kind, 'unexpected route: no writer or provider fallback is allowed');
      calls.push({ kind, url: String(url), ...init, headers: Object.fromEntries(new Headers(init.headers)) });
      if (options[kind]) return options[kind](calls.at(-1));
      if (kind === 'auth') return json({ id: userId, role: 'authenticated', email: 'PRIVATE_USER_EMAIL', user_metadata: { private: 'PRIVATE_USER_METADATA' } });
      if (kind === 'markets') return json('marketRows' in options ? options.marketRows : [defaultMarket]);
      return json('places' in options ? options.places : [defaultPlace]);
    },
  });
  new vm.Script(source.outputText, { filename: entry }).runInContext(context);
  assert.equal(typeof handler, 'function');
  const invoke = (overrides = {}) => {
    const { body = { text: '  SYNTHETIC_PRIVATE_QUERY &countrycodes=xx  ', countryCode: 'RS' }, ...requestOverrides } = overrides;
    const request = new Request('https://edge.test.invalid/uskoci-location-search', { method: 'POST',
      headers: { Authorization: 'Bearer SYNTHETIC_USER_SESSION', 'Content-Type': 'application/json' },
      body: typeof body === 'string' || body instanceof ReadableStream ? body : JSON.stringify(body), ...requestOverrides });
    return handler(request);
  };
  return { calls, logs, envReads, timers, invoke, advance: ms => { now += ms; }, expire: () => { for (const fn of timers.values()) fn(); },
    handle: request => handler(request) };
}
async function assertRejected(f, status, code, request) {
  const response = await f.invoke(request);
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { code });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assertSafeDiagnostics(f);
  assert.equal(f.timers.size, 0);
  return response;
}
const diagnosticStages = new Set(['REQUEST', 'CONFIG', 'AUTH_FETCH', 'AUTH_BODY', 'MARKETS_FETCH', 'MARKETS_BODY',
  'PROVIDER_CONFIG', 'RATE_LIMIT', 'PROVIDER_FETCH', 'PROVIDER_BODY', 'PROVIDER_NORMALIZE']);
const diagnosticReasons = new Set(['INVALID_QUERY', 'AUTH_REQUIRED', 'CONFIG_UNAVAILABLE', 'COUNTRY_NOT_AVAILABLE',
  'PROVIDER_ACTIVATION_BLOCKED', 'RATE_LIMITED', 'NETWORK_ERROR', 'REDIRECT_BLOCKED', 'HTTP_ERROR',
  'BODY_LIMIT', 'BODY_UNAVAILABLE', 'BODY_CANCELLED', 'BODY_READ_FAILED', 'INVALID_JSON',
  'MARKET_ROWS_INVALID', 'PROVIDER_404_UNRECOGNIZED', 'NORMALIZED_ROWS_INVALID', 'DEADLINE_EXCEEDED', 'CANCELLED']);
const normalizationReasons = new Set(['ARRAY_SHAPE', 'ROW_LIMIT', 'ROW_SHAPE', 'COUNTRY_MISMATCH',
  'LABEL_INVALID', 'COORDINATE_INVALID', 'ID_INVALID', 'DUPLICATE_ID']);
const coordinateReasons = new Set(['JSON_NUMBER', 'MISSING_OR_TYPE', 'LENGTH', 'EMPTY', 'WHITESPACE_DECIMAL',
  'SCIENTIFIC', 'LEADING_PLUS', 'LEADING_ZERO', 'MALFORMED', 'NON_FINITE', 'OUT_OF_RANGE']);
function assertSafeDiagnostics(f) {
  for (const args of f.logs) {
    assert.equal(args.length, 1);
    assert.equal(typeof args[0], 'string');
    const event = JSON.parse(args[0]);
    assert.deepEqual(Object.keys(event).sort(), event.reason === 'NORMALIZED_ROWS_INVALID'
      ? event.normalizationReason === 'COORDINATE_INVALID'
        ? ['coordinateReason', 'event', 'normalizationReason', 'reason', 'stage', 'upstreamStatus']
        : ['event', 'normalizationReason', 'reason', 'stage', 'upstreamStatus']
      : ['event', 'reason', 'stage', 'upstreamStatus']);
    assert.equal(event.event, 'LOCATION_SEARCH_FAILURE');
    assert.ok(diagnosticStages.has(event.stage));
    assert.ok(diagnosticReasons.has(event.reason));
    if (event.reason === 'NORMALIZED_ROWS_INVALID') assert.ok(normalizationReasons.has(event.normalizationReason));
    if (event.normalizationReason === 'COORDINATE_INVALID') assert.ok(coordinateReasons.has(event.coordinateReason));
    assert.ok(event.upstreamStatus === null || Number.isInteger(event.upstreamStatus) && event.upstreamStatus >= 100 && event.upstreamStatus <= 599);
    assert.ok(args[0].length < 260, 'diagnostics stay bounded');
  }
  const serialized = JSON.stringify(f.logs);
  for (const forbidden of ['SYNTHETIC_', 'PRIVATE_', userId, 'https://', 'countrycodes', '44.123456', '20.654321']) {
    assert.ok(!serialized.includes(forbidden), `private data leaked to diagnostic: ${forbidden}`);
  }
}
function assertDiagnostic(f, stage, reason, upstreamStatus, normalizationReason, coordinateReason) {
  assertSafeDiagnostics(f);
  assert.equal(f.logs.length, 1);
  assert.deepEqual(JSON.parse(f.logs[0][0]), { event: 'LOCATION_SEARCH_FAILURE', stage, reason, upstreamStatus,
    ...(normalizationReason ? { normalizationReason } : {}),
    ...(coordinateReason ? { coordinateReason } : {}),
  });
}
const providerCalls = f => f.calls.filter(call => call.kind === 'provider');
async function reached(f, kind) {
  for (let i = 0; i < 100 && !f.calls.some(call => call.kind === kind); i++) await Promise.resolve();
  assert.ok(f.calls.some(call => call.kind === kind), `did not reach ${kind}`);
}

test('authenticated LocationIQ EU GET emits only the client envelope, with query-key isolation and no writes', async () => {
  const f = fixture(), result = await f.invoke();
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body, { candidates: [{ label: defaultPlace.display_name, countryCode: 'RS',
    position: { latitude: 44.123456, longitude: 20.654321 }, providerHint: 'locationiq', candidateId: '123456' }] });
  assert.deepEqual(f.calls.map(call => call.kind), ['auth', 'markets', 'provider']);
  for (const call of f.calls.slice(0, 2)) {
    assert.equal(call.headers.authorization, 'Bearer SYNTHETIC_USER_SESSION');
    assert.equal(call.headers.apikey, 'SYNTHETIC_ANON_KEY');
    assert.ok(!JSON.stringify(call).includes('SYNTHETIC_PRIVATE_QUERY'));
    assert.ok(!JSON.stringify(call).includes('SYNTHETIC_PROVIDER_SECRET'));
  }
  assert.equal(f.calls[0].method, 'GET'); assert.equal(f.calls[1].method, 'POST'); assert.equal(f.calls[1].body, '{}');
  const provider = providerCalls(f)[0];
  assert.equal(provider.method, 'GET'); assert.equal(provider.body, undefined);
  assert.equal(new URL(provider.url).origin + new URL(provider.url).pathname, 'https://eu1.locationiq.com/v1/search');
  assert.deepEqual(Object.fromEntries(new URL(provider.url).searchParams), { key: 'SYNTHETIC_PROVIDER_SECRET', format: 'json', addressdetails: '1', countrycodes: 'rs', limit: '10', q: 'SYNTHETIC_PRIVATE_QUERY &countrycodes=xx' });
  assert.deepEqual(provider.headers, { accept: 'application/json' });
  assert.ok(!provider.url.includes('SYNTHETIC_USER_SESSION')); assert.ok(!provider.url.includes('SYNTHETIC_ANON_KEY'));
  for (const call of f.calls) {
    assert.equal(call.redirect, 'error'); assert.equal(call.cache, 'no-store'); assert.equal(call.credentials, 'omit');
    assert.equal(call.referrerPolicy, 'no-referrer'); assert.ok(call.signal instanceof AbortSignal);
  }
  for (const marker of ['SYNTHETIC_USER_SESSION', 'SYNTHETIC_ANON_KEY', 'PRIVATE_USER_', 'PROVIDER_PRIVATE_EXTRA', 'PRIVATE_BOUNDING_BOX', 'SYNTHETIC_PROVIDER_SECRET']) assert.ok(!JSON.stringify(body).includes(marker));
  assert.deepEqual([...new Set(f.envReads)].sort(), ['LOCATIONIQ_ACCESS_TOKEN', 'SUPABASE_ANON_KEY', 'SUPABASE_URL']);
  assert.deepEqual(f.logs, []); assert.equal(f.timers.size, 0);
});

test('preflight is anonymous; unsupported methods and missing/malformed bearer never fetch', async () => {
  const f = fixture();
  assert.equal((await f.handle(new Request('https://edge.test.invalid', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await f.handle(new Request('https://edge.test.invalid', { method: 'GET' }))).status, 405);
  for (const authorization of ['', 'Basic synthetic', 'Bearer ', 'Bearer two tokens']) {
    await assertRejected(f, 401, 'AUTH_REQUIRED', { headers: { Authorization: authorization, 'Content-Type': 'application/json' } });
  }
  assert.deepEqual(f.calls, []);
});

test('required input, exact keys, country and Unicode limits reject before any transport', async () => {
  const invalid = [null, [], {}, { text: 'x' }, { countryCode: 'RS' }, { text: '', countryCode: 'RS' },
    { text: 'x', countryCode: 'rs' }, { text: 'x', countryCode: 'RS,GB' }, { text: 'x\n', countryCode: 'RS' },
    { text: '😀'.repeat(1001), countryCode: 'RS' },
    { text: 'x', countryCode: 'RS', endpoint: 'https://attacker.test.invalid/search' },
    { text: 'x', countryCode: 'RS', accountId: userId }, { text: 'x', countryCode: 'RS', scopeKey: 'PRIVATE_SCOPE' },
    { text: 'x', countryCode: 'RS', key: 'ATTACKER_KEY' }, { text: 'x', countryCode: 'RS', format: 'jsonv2' },
    { countryCode: 'RS', position: { latitude: 44, longitude: 20 }, mode: 'unknown' }];
  for (const body of invalid) {
    const f = fixture(); await assertRejected(f, 400, 'INVALID_QUERY', { body }); assert.deepEqual(f.calls, []);
  }
  const f = fixture(); await assertRejected(f, 400, 'INVALID_QUERY', { body: '{broken' }); assert.deepEqual(f.calls, []);
  await assertRejected(f, 400, 'INVALID_QUERY', { headers: { Authorization: 'Bearer SYNTHETIC_USER_SESSION', 'Content-Type': 'text/plain' } });
});

test('1000 Unicode characters and actual numeric zero coordinates remain valid without invented coordinates', async () => {
  const f = fixture({ places: [{ ...defaultPlace, lat: '0', lon: '-0', place_id: '9007199254740993123' }] });
  const result = await f.invoke({ body: { text: '😀'.repeat(1000), countryCode: 'RS' } });
  assert.equal(result.status, 200);
  const [candidate] = (await result.json()).candidates;
  assert.deepEqual(candidate.position, { latitude: 0, longitude: 0 });
  assert.equal(candidate.candidateId, '9007199254740993123');
});

test('expired tokens, service/anon identities and missing users cannot call markets or a geocoder', async () => {
  for (const auth of [() => json({ error: 'PRIVATE_AUTH_BODY' }, 401), () => json({ error: 'PRIVATE_AUTH_BODY' }, 403),
    () => json({ id: userId, role: 'service_role' }), () => json({ id: userId, role: 'anon' }), () => json({}), () => json({ id: 'bad', role: 'authenticated' })]) {
    const f = fixture({ auth }); await assertRejected(f, 401, 'AUTH_REQUIRED'); assert.deepEqual(f.calls.map(call => call.kind), ['auth']);
  }
});

test('Auth outages and malformed responses fail closed without private error leakage', async () => {
  for (const auth of [() => json({ secret: 'PRIVATE_AUTH_BODY' }, 500), () => new Response('PRIVATE_AUTH_BODY'),
    () => { throw new Error('PRIVATE_AUTH_BODY SYNTHETIC_USER_SESSION'); }]) {
    const f = fixture({ auth }); await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(f.calls.length, 1);
  }
});

test('missing Supabase configuration makes no network call', async () => {
  const f = fixture({ env: { SUPABASE_ANON_KEY: undefined } });
  await assertRejected(f, 503, 'SERVER_CONFIG_ERROR'); assert.deepEqual(f.calls, []);
});

test('registered BUILDING and LIVE are queryable, unknown/WAITLIST/COMING countries are not', async () => {
  for (const productStatus of ['BUILDING', 'LIVE']) {
    const f = fixture({ marketRows: [{ ...defaultMarket, productStatus }], places: [] });
    assert.equal((await f.invoke()).status, 200); assert.equal(providerCalls(f).length, 1);
  }
  for (const marketRows of [[], [{ ...defaultMarket, countryCode: 'GB' }], ...['WAITLIST', 'COMING'].map(productStatus => [{ ...defaultMarket, productStatus }])]) {
    const f = fixture({ marketRows }); await assertRejected(f, 403, 'COUNTRY_NOT_AVAILABLE'); assert.equal(providerCalls(f).length, 0);
  }
});

test('market RPC auth denial, error or corrupt authority never falls back to RS or cached authorization', async () => {
  for (const status of [401, 403]) {
    const f = fixture({ markets: () => json({ private: 'PRIVATE_RPC_BODY' }, status) });
    await assertRejected(f, 401, 'AUTH_REQUIRED'); assert.equal(providerCalls(f).length, 0);
  }
  for (const marketRows of [null, {}, [defaultMarket, defaultMarket], [{ ...defaultMarket, productStatus: 'ALLOW' }],
    [{ ...defaultMarket, defaultTimezone: 'invalid/timezone' }], [{ ...defaultMarket, countryCode: 'rs' }], [{ ...defaultMarket, extra: true }],
    [{ countryCode: 'RS', productStatus: 'BUILDING' }]]) {
    const f = fixture({ marketRows }); await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(providerCalls(f).length, 0);
  }
  let authCalls = 0;
  const f = fixture({ auth: () => ++authCalls === 1 ? json({ id: userId, role: 'authenticated' }) : json({}, 401) });
  assert.equal((await f.invoke()).status, 200); await assertRejected(f, 401, 'AUTH_REQUIRED'); assert.equal(providerCalls(f).length, 1);
});

test('absent/invalid LocationIQ token remains explicitly blocked without any secret fallback', async () => {
  for (const LOCATIONIQ_ACCESS_TOKEN of [undefined, '', ' ', 'bad token', 'bad\nkey', 'bad\u0000key', 'x'.repeat(4097)]) {
    const f = fixture({ env: { LOCATIONIQ_ACCESS_TOKEN, GEOCODER_BEARER_TOKEN: 'OBSOLETE_SECRET' } });
    await assertRejected(f, 503, 'PROVIDER_ACTIVATION_BLOCKED'); assert.equal(providerCalls(f).length, 0);
    assert.ok(!f.envReads.includes('GEOCODER_BEARER_TOKEN')); assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'));
  }
});

test('fixed provider cannot be changed by old generic configuration; key remains a single encoded parameter', async () => {
  const f = fixture({ env: { GEOCODER_ENDPOINT: 'https://nominatim.openstreetmap.org/search', GEOCODER_PROVIDER_HINT: 'wrong',
    GEOCODER_USER_AGENT: 'OBSOLETE_UA', GEOCODER_BEARER_TOKEN: 'OBSOLETE_SECRET', LOCATIONIQ_ACCESS_TOKEN: 'SYNTHETIC_KEY&q=must-not-replace' }, places: [] });
  const result = await f.invoke(); assert.equal(result.status, 200); assert.deepEqual(await result.json(), { candidates: [] });
  const provider = providerCalls(f)[0], url = new URL(provider.url);
  assert.equal(url.origin + url.pathname, 'https://eu1.locationiq.com/v1/search');
  assert.equal(url.searchParams.get('key'), 'SYNTHETIC_KEY&q=must-not-replace');
  assert.equal(url.searchParams.getAll('q').length, 1); assert.equal(url.searchParams.get('q'), 'SYNTHETIC_PRIVATE_QUERY &countrycodes=xx');
  assert.equal(provider.headers.authorization, undefined);
  assert.ok(f.envReads.every(key => !key.startsWith('GEOCODER_')));
});

test('corrupt LocationIQ JSON results reject the entire response, including a preceding valid candidate', async () => {
  const corrupt = [{ lat: undefined }, { lat: 44 }, { lon: null }, { lat: '' }, { lat: ' 44 ' }, { lat: '0x10' },
    { lat: '1e2' }, { lat: 'NaN' }, { lat: 'Infinity' }, { lat: '90.000001' }, { lon: '-180.000001' },
    { display_name: '' }, { display_name: 'bad\nlabel' }, { display_name: '😀'.repeat(1001) },
    { address: {} }, { address: { country_code: 'RS' } }, { address: { country_code: 'gb' } },
    { place_id: undefined }, { place_id: '001' }, { place_id: 0 }, { place_id: 9007199254740992 }, { place_id: 'x' }];
  for (const change of corrupt) {
    const f = fixture({ places: [defaultPlace, { ...defaultPlace, place_id: 2, ...change }] });
    await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(providerCalls(f).length, 1);
  }
  for (const places of [{ candidates: [] }, null, [defaultPlace, defaultPlace], Array.from({ length: 11 }, (_, i) => ({ ...defaultPlace, place_id: i + 1 }))]) {
    const f = fixture({ places }); await assertRejected(f, 502, 'UNAVAILABLE');
  }
});

test('upstream errors, redirects and non-JSON payloads are sanitized without retry or URL disclosure', async () => {
  for (const provider of [() => json({ private: 'PRIVATE_PROVIDER_BODY' }, 401), () => json({}, 403), () => json({}, 500),
    () => new Response('PRIVATE_PROVIDER_BODY SYNTHETIC_PROVIDER_SECRET'),
    () => { throw new Error('PRIVATE_PROVIDER_BODY SYNTHETIC_PRIVATE_QUERY'); },
    call => { throw new Error(`PROVIDER_REQUEST_FAILED ${call.url}`); },
    () => { const result = json([defaultPlace]); Object.defineProperty(result, 'redirected', { value: true }); return result; }]) {
    const f = fixture({ provider }); await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(providerCalls(f).length, 1);
  }
});

test('LocationIQ quota responses become bounded RATE_LIMITED with no body or retry', async () => {
  const f = fixture({ provider: call => json({ error: 'Rate Limited Day', private: call.url }, 429) });
  await assertRejected(f, 429, 'RATE_LIMITED');
  assert.equal(providerCalls(f).length, 1);
});

test('only documented LocationIQ no-match 404 becomes an empty candidate result', async () => {
  const f = fixture({ provider: () => json({ error: 'Unable to geocode' }, 404) });
  const result = await f.invoke(); assert.equal(result.status, 200); assert.deepEqual(await result.json(), { candidates: [] });
  for (const payload of [{ error: 'Imagery not found' }, { error: 'PRIVATE_UNKNOWN_ERROR' }, { error: 'Unable to geocode', extra: 'PRIVATE_ERROR' }]) {
    const g = fixture({ provider: () => json(payload, 404) }); await assertRejected(g, 502, 'UNAVAILABLE');
  }
});

test('authenticated-user burst and minute limits do not depend on session-token rotation', async () => {
  const f = fixture({ places: [] });
  assert.equal((await f.invoke()).status, 200);
  await assertRejected(f, 429, 'RATE_LIMITED');
  f.advance(999); await assertRejected(f, 429, 'RATE_LIMITED');
  f.advance(1); assert.equal((await f.invoke()).status, 200);
  for (let i = 0; i < 8; i++) { f.advance(1000); assert.equal((await f.invoke()).status, 200); }
  f.advance(1000);
  await assertRejected(f, 429, 'RATE_LIMITED', { headers: { Authorization: 'Bearer DIFFERENT_TOKEN_SAME_USER', 'Content-Type': 'application/json' } });
  assert.equal(providerCalls(f).length, 10);
  f.advance(60_000); assert.equal((await f.invoke()).status, 200);
  assert.equal(providerCalls(f).length, 11); assertSafeDiagnostics(f);
});

test('one in-flight request per user is released after completion without blocking another user', async () => {
  let release, authId = userId;
  const f = fixture({ auth: () => json({ id: authId, role: 'authenticated' }),
    provider: () => new Promise(resolve => { release = resolve; }) });
  const pending = f.invoke(); await reached(f, 'provider'); f.advance(5000);
  const blocked = await f.invoke(); assert.equal(blocked.status, 429); assert.deepEqual(await blocked.json(), { code: 'RATE_LIMITED' });
  assert.equal(providerCalls(f).length, 1);
  const releaseFirst = release;
  authId = '22222222-2222-4222-8222-222222222222';
  const other = f.invoke();
  for (let i = 0; i < 100 && providerCalls(f).length < 2; i++) await Promise.resolve();
  assert.equal(providerCalls(f).length, 2);
  release(json([])); releaseFirst(json([]));
  assert.equal((await other).status, 200); assert.equal((await pending).status, 200);
  authId = userId; f.advance(1000);
  const next = f.invoke();
  for (let i = 0; i < 100 && providerCalls(f).length < 3; i++) await Promise.resolve();
  release(json([])); assert.equal((await next).status, 200);
  assertDiagnostic(f, 'RATE_LIMIT', 'RATE_LIMITED', null); assert.equal(f.timers.size, 0);
});

test('authenticated rate cache is bounded and expires inactive user entries', async () => {
  let id = 0;
  const f = fixture({ auth: () => json({ id: `${String(++id).padStart(8, '0')}-1111-4111-8111-111111111111`, role: 'authenticated' }), places: [] });
  for (let i = 0; i < 1024; i++) assert.equal((await f.invoke()).status, 200);
  await assertRejected(f, 429, 'RATE_LIMITED'); assert.equal(providerCalls(f).length, 1024);
  f.advance(60_000); assert.equal((await f.invoke()).status, 200);
  assert.equal(providerCalls(f).length, 1025); assertDiagnostic(f, 'RATE_LIMIT', 'RATE_LIMITED', null);
});

test('declared and streamed body byte limits reject without trusting Content-Length', async () => {
  const f = fixture();
  await assertRejected(f, 400, 'INVALID_QUERY', { body: ' '.repeat(8193) }); assert.equal(f.calls.length, 0);
  await assertRejected(f, 400, 'INVALID_QUERY', { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', 'Content-Length': '999999' } });
  for (const kind of ['auth', 'markets', 'provider']) for (const declared of [true, false]) {
    const g = fixture({ [kind]: () => new Response(' '.repeat(declared ? 1 : 131073), { headers: declared ? { 'Content-Length': '131073' } : {} }) });
    await assertRejected(g, 502, 'UNAVAILABLE');
    assert.equal(g.calls.at(-1).kind, kind);
  }
});

test('one bounded deadline covers Auth, market and provider transports even if fetch ignores abort', async () => {
  for (const kind of ['auth', 'markets', 'provider']) {
    let release;
    const f = fixture({ [kind]: () => new Promise(resolve => { release = resolve; }) });
    const pending = f.invoke(); await reached(f, kind); f.expire();
    const result = await pending; assert.equal(result.status, 504); assert.deepEqual(await result.json(), { code: 'UNAVAILABLE' });
    const callCount = f.calls.length; release(json(kind === 'auth' ? { id: userId, role: 'authenticated' } : kind === 'markets' ? [defaultMarket] : [defaultPlace]));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(f.calls.length, callCount);
    assertDiagnostic(f, `${kind.toUpperCase()}_FETCH`, 'DEADLINE_EXCEEDED', null);
    assert.equal(f.timers.size, 0);
  }
});

test('deadline interrupts response body streaming, and caller cancellation cancels the provider request', async () => {
  let bodyCancelled = false;
  const f = fixture({ provider: () => new Response(new ReadableStream({ pull() {}, cancel() { bodyCancelled = true; } })) });
  const pending = f.invoke(); await reached(f, 'provider');
  for (let i = 0; i < 10; i++) await Promise.resolve();
  f.expire(); assert.equal((await pending).status, 504); assert.equal(bodyCancelled, true);
  assertDiagnostic(f, 'PROVIDER_BODY', 'DEADLINE_EXCEEDED', 200);
  const controller = new AbortController(), g = fixture({ provider: () => new Promise(() => {}) });
  const cancelled = g.invoke({ signal: controller.signal }); await reached(g, 'provider'); controller.abort();
  const result = await cancelled; assert.equal(result.status, 499); assert.deepEqual(await result.json(), { code: 'CANCELLED' });
  assert.equal(providerCalls(g)[0].signal.aborted, true);
  assertDiagnostic(g, 'PROVIDER_FETCH', 'CANCELLED', null); assert.equal(g.timers.size, 0);
});

test('failure diagnostics distinguish provider failures without logging query, body, identity, URL or thrown message', async () => {
  const cases = [
    [() => json({ error: 'PRIVATE_UNKNOWN_ERROR' }, 404), 'PROVIDER_BODY', 'PROVIDER_404_UNRECOGNIZED', 404],
    [() => json({ error: 'PRIVATE_PROVIDER_BODY' }, 403), 'PROVIDER_FETCH', 'HTTP_ERROR', 403],
    [() => json({ error: 'PRIVATE_PROVIDER_BODY' }, 500), 'PROVIDER_FETCH', 'HTTP_ERROR', 500],
    [() => new Response('PRIVATE_PROVIDER_BODY SYNTHETIC_PROVIDER_SECRET'), 'PROVIDER_BODY', 'INVALID_JSON', 200],
    [() => new Response('PRIVATE_PROVIDER_BODY', { headers: { 'Content-Length': '131073' } }), 'PROVIDER_BODY', 'BODY_LIMIT', 200],
    [() => json([{ ...defaultPlace, lat: 'NaN' }]), 'PROVIDER_NORMALIZE', 'NORMALIZED_ROWS_INVALID', 200, 'COORDINATE_INVALID', 'NON_FINITE'],
    [call => { throw new Error(`PRIVATE_PROVIDER_BODY ${call.url} ${userId}`); }, 'PROVIDER_FETCH', 'NETWORK_ERROR', null],
    [() => { const result = json([defaultPlace]); Object.defineProperty(result, 'redirected', { value: true }); return result; }, 'PROVIDER_FETCH', 'REDIRECT_BLOCKED', null],
  ];
  for (const [provider, stage, reason, upstreamStatus, normalizationReason, coordinateReason] of cases) {
    const f = fixture({ provider });
    await assertRejected(f, 502, 'UNAVAILABLE');
    assert.equal(providerCalls(f).length, 1, 'diagnostics never retry a request');
    assertDiagnostic(f, stage, reason, upstreamStatus, normalizationReason, coordinateReason);
  }
  const rate = fixture({ provider: () => json({ error: 'PRIVATE_RATE_BODY' }, 429) });
  await assertRejected(rate, 429, 'RATE_LIMITED');
  assertDiagnostic(rate, 'PROVIDER_FETCH', 'RATE_LIMITED', 429);
});

test('pre-provider failures have their own stage and never masquerade as provider HTTP responses', async () => {
  for (const [options, status, code, stage, reason] of [
    [{ env: { SUPABASE_ANON_KEY: undefined } }, 503, 'SERVER_CONFIG_ERROR', 'CONFIG', 'CONFIG_UNAVAILABLE'],
    [{ auth: () => json({ error: 'PRIVATE_AUTH_BODY' }, 401) }, 401, 'AUTH_REQUIRED', 'AUTH_FETCH', 'AUTH_REQUIRED'],
    [{ auth: () => new Response('PRIVATE_AUTH_BODY') }, 502, 'UNAVAILABLE', 'AUTH_BODY', 'INVALID_JSON'],
    [{ markets: () => { throw new Error('PRIVATE_RPC_BODY'); } }, 502, 'UNAVAILABLE', 'MARKETS_FETCH', 'NETWORK_ERROR'],
    [{ marketRows: [{ ...defaultMarket, extra: 'PRIVATE_RPC_BODY' }] }, 502, 'UNAVAILABLE', 'MARKETS_BODY', 'MARKET_ROWS_INVALID'],
    [{ env: { LOCATIONIQ_ACCESS_TOKEN: undefined } }, 503, 'PROVIDER_ACTIVATION_BLOCKED', 'PROVIDER_CONFIG', 'PROVIDER_ACTIVATION_BLOCKED'],
  ]) {
    const f = fixture(options); await assertRejected(f, status, code);
    assert.equal(providerCalls(f).length, 0);
    assertDiagnostic(f, stage, reason, null);
  }
});

test('successful match and documented no-match produce no failure diagnostics', async () => {
  for (const provider of [() => json([defaultPlace]), () => json([]), () => json({ error: 'Unable to geocode' }, 404)]) {
    const f = fixture({ provider }); assert.equal((await f.invoke()).status, 200); assert.deepEqual(f.logs, []);
  }
});

test('each rejected result shape reports only its fixed normalization reason, preserving whole-response rejection', async () => {
  for (const [places, normalizationReason] of [
    [{ candidates: [defaultPlace] }, 'ARRAY_SHAPE'],
    [Array.from({ length: 11 }, (_, i) => ({ ...defaultPlace, place_id: i + 1 })), 'ROW_LIMIT'],
    [[defaultPlace, null], 'ROW_SHAPE'],
    [[defaultPlace, { ...defaultPlace, place_id: 2, address: { country_code: 'gb' } }], 'COUNTRY_MISMATCH'],
    [[defaultPlace, { ...defaultPlace, place_id: 2, display_name: 'PRIVATE_INVALID_LABEL\n' }], 'LABEL_INVALID'],
    [[defaultPlace, { ...defaultPlace, place_id: 2, lon: 'PRIVATE_INVALID_COORDINATE' }], 'COORDINATE_INVALID'],
    [[defaultPlace, { ...defaultPlace, place_id: 'PRIVATE_INVALID_ID' }], 'ID_INVALID'],
    [[defaultPlace, { ...defaultPlace }], 'DUPLICATE_ID'],
  ]) {
    const f = fixture({ places });
    await assertRejected(f, 502, 'UNAVAILABLE');
    assert.equal(providerCalls(f).length, 1);
    assertDiagnostic(f, 'PROVIDER_NORMALIZE', 'NORMALIZED_ROWS_INVALID', 200, normalizationReason,
      normalizationReason === 'COORDINATE_INVALID' ? 'MALFORMED' : undefined);
  }
});

test('coordinate diagnostics distinguish representations without admitting any previously rejected coordinate', async () => {
  for (const [lat, coordinateReason] of [
    [44.123456, 'JSON_NUMBER'], [null, 'MISSING_OR_TYPE'], [true, 'MISSING_OR_TYPE'],
    ['1'.repeat(41), 'LENGTH'], ['', 'EMPTY'], [' 44.123456 ', 'WHITESPACE_DECIMAL'],
    ['4.4e1', 'SCIENTIFIC'], ['+44.123456', 'LEADING_PLUS'], ['044.123456', 'LEADING_ZERO'],
    ['PRIVATE_INVALID_COORDINATE', 'MALFORMED'], ['0x10', 'MALFORMED'], ['NaN', 'NON_FINITE'],
    ['1e999', 'NON_FINITE'], [91, 'OUT_OF_RANGE'], ['91', 'OUT_OF_RANGE'], ['9.1e1', 'OUT_OF_RANGE'],
  ]) {
    const f = fixture({ places: [{ ...defaultPlace, lat }] });
    await assertRejected(f, 502, 'UNAVAILABLE');
    assertDiagnostic(f, 'PROVIDER_NORMALIZE', 'NORMALIZED_ROWS_INVALID', 200, 'COORDINATE_INVALID', coordinateReason);
    assert.equal(providerCalls(f).length, 1);
  }
  const lon = fixture({ places: [{ ...defaultPlace, lon: 181 }] });
  await assertRejected(lon, 502, 'UNAVAILABLE');
  assertDiagnostic(lon, 'PROVIDER_NORMALIZE', 'NORMALIZED_ROWS_INVALID', 200, 'COORDINATE_INVALID', 'OUT_OF_RANGE');
});


test('reverse uses fixed EU endpoint and query key after Auth/market admission, returning only a private proposal', async () => {
  const f = fixture({ places: defaultPlace });
  const result = await f.invoke({ body: { mode: 'reverse', position: { latitude: 45.255, longitude: 19.845 }, countryCode: 'RS' } });
  assert.equal(result.status, 200);const body=await result.json();assert.equal(body.candidates.length,1);
  assert.deepEqual(f.calls.map(c=>c.kind),['auth','markets','provider']);
  const request=providerCalls(f)[0],url=new URL(request.url);
  assert.equal(url.origin+url.pathname,'https://eu1.locationiq.com/v1/reverse');
  assert.deepEqual(Object.fromEntries(url.searchParams),{key:'SYNTHETIC_PROVIDER_SECRET',format:'json',addressdetails:'1',lat:'45.255',lon:'19.845',zoom:'18'});
  assert.deepEqual(request.headers,{accept:'application/json'});assert.deepEqual(f.logs,[]);
  assert.equal(body.candidates[0].label,defaultPlace.display_name);
  assert.ok(!JSON.stringify(body).includes('SYNTHETIC_PROVIDER_SECRET'));
});

test('reverse rejects malformed/private extra input before any network',async()=>{
  for(const position of [null,[],{}, {latitude:'45',longitude:19},{latitude:91,longitude:19},{latitude:45,longitude:181}, {latitude:45,longitude:19,address:'PRIVATE'}]){
    const f=fixture();await assertRejected(f,400,'INVALID_QUERY',{body:{mode:'reverse',countryCode:'RS',position}});assert.deepEqual(f.calls,[]);
  }
  const f=fixture();await assertRejected(f,400,'INVALID_QUERY',{body:{mode:'reverse',countryCode:'RS',position:{latitude:45,longitude:19},text:'PRIVATE'}});assert.deepEqual(f.calls,[]);
});

test('reverse preserves authentication, country and whole-result validation',async()=>{
  const query={body:{mode:'reverse',countryCode:'RS',position:{latitude:45,longitude:19}}};
  const unauth=fixture({auth:()=>json({error:'PRIVATE'},401)});await assertRejected(unauth,401,'AUTH_REQUIRED',query);assert.equal(providerCalls(unauth).length,0);
  const disabled=fixture({marketRows:[{...defaultMarket,productStatus:'WAITLIST'}]});await assertRejected(disabled,403,'COUNTRY_NOT_AVAILABLE',query);assert.equal(providerCalls(disabled).length,0);
  for(const places of [[defaultPlace],{...defaultPlace,address:{country_code:'hr'}},{...defaultPlace,lat:'NaN'}])await assertRejected(fixture({places}),502,'UNAVAILABLE',query);
});

test('forward and reverse share one authenticated burst/concurrency quota',async()=>{
  const f=fixture({places:defaultPlace});const body={mode:'reverse',countryCode:'RS',position:{latitude:0,longitude:0}};
  assert.equal((await f.invoke({body})).status,200);await assertRejected(f,429,'RATE_LIMITED');assert.equal(providerCalls(f).length,1);
});
