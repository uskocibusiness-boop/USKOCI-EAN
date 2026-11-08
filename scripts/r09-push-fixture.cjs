'use strict';
// Execute the shipped handler and captured SQL. Only Auth ingress, isolated
// dependencies not reached by the tested global lane, and Expo HTTP are seams.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, webcrypto } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql/r09_push_capacity_20261108.preimage.json'), 'utf8'));
const candidate = fs.readFileSync(path.join(__dirname, 'sql/r09_push_capacity_20261108.sql'), 'utf8');
assert.equal(fs.readFileSync(path.join(root,'supabase/migrations/20261108010233_r09_push_capacity_20261108.sql'),'utf8'),candidate,
 'The tested SQL must be the actual forward migration, not a divergent candidate.');
const rollback = fs.readFileSync(path.join(__dirname, 'sql/r09_push_capacity_20261108.rollback.sql'), 'utf8');
const SECRET = 'sb_secret_fixture_push_01234567890123456789';
const ORIGIN = 'https://fixture-push.supabase.co';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function edgeHarness(options = {}) {
 let handler;
 const calls = [], logs = [], observations = [], starts = [], completed = [];
 const queues = { SEND: [], RECEIPT: [] }, attempts = new Map();
 const clock = options.clock ?? { now: Date.now() };
 class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [options.clock ? clock.now : Date.now()])); }
  static now() { return options.clock ? clock.now : Date.now(); }
 }
 const env = {
  SUPABASE_URL: ORIGIN, SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET }),
  EXPO_PUSH_TRANSPORT_ENABLED: 'true', EXPO_PUSH_SINGLE_TARGET_ENABLED: 'true',
  EXPO_PUSH_MESSAGE_TARGET_ENABLED: 'true', EXPO_PUSH_APPLICATION_TARGET_ENABLED: 'true',
  ...options.env,
 };
 let activeSend = 0, activeReceipt = 0, peakSend = 0, peakTotal = 0, waits = options.waits ?? 0;
 let claimActive = 0, peakClaim = 0;
 function add(kind, patch = {}) {
  const value = { id: randomUUID(), lease: randomUUID(), expiry: new Date(Clock.now() + 90000).toISOString(),
   token: 'ExpoPushToken[' + randomUUID().replaceAll('-', '') + ']', eventId: randomUUID(),
   eventType: 'MESSAGE_RECEIVED', deliveryExpiry: new Date(Clock.now() + 7200000).toISOString(),
   ticketId: kind === 'RECEIPT' ? 'ticket_' + randomUUID() : null, ...patch };
  attempts.set(value.id, value); queues[kind].push(value); return value;
 }
 async function defaultRpc(name, args) {
  if (name === 'rpc_claim_push_transport' || name === 'rpc_claim_push_single_target' || name === 'rpc_claim_push_single_target_receipt') {
   claimActive++; peakClaim = Math.max(peakClaim, claimActive);
   try {
    if (options.claimDelay) await pause(options.claimDelay);
    if (waits > 0 && name === 'rpc_claim_push_transport') { waits--; return { kind: 'WAIT', retryAfterMs: 100 }; }
    const kind = name === 'rpc_claim_push_transport' ? args.p_kind : name.endsWith('_receipt') ? 'RECEIPT' : 'SEND';
    const next = queues[kind].shift(); if (!next) return { kind: 'NONE' };
    next.kind = kind;
    if (options.onClaim) options.onClaim(next);
    return { kind, attemptId: next.id, leaseId: next.lease, leaseExpiresAt: next.expiry, ticketId: next.ticketId };
   } finally { claimActive--; }
  }
  if (name === 'rpc_begin_push_send') {
   const a = attempts.get(args.p_attempt_id); assert.ok(a); assert.equal(args.p_lease_id, a.lease);
   starts.push(a.id);
   if (a.suppressed) return { kind: 'SUPPRESSED' };
   return { kind: 'SEND', attemptId: a.id, leaseId: a.lease, leaseExpiresAt: a.expiry,
    expoPushToken: a.token, priority: a.priority ?? 'NORMAL', eventType: a.eventType,
    ...(a.noEventId ? {} : { eventId: a.eventId }),
    ...(a.legacy ? {} : { deliveryExpiresAt: a.deliveryExpiry }) };
  }
  if (name === 'rpc_complete_push_transport') {
   const a = attempts.get(args.p_attempt_id); assert.ok(a); assert.equal(args.p_lease_id, a.lease);
   assert.equal(completed.some(c => c.p_attempt_id === a.id), false, 'No repeated settlement');
   completed.push(args);
   const state = { TICKET: 'TICKET_PENDING', PROVIDER_ACCEPTED: 'PROVIDER_ACCEPTED', DEVICE_NOT_REGISTERED: 'FINAL',
    RETRYABLE: 'RETRYABLE', RECEIPT_RATE_EXCEEDED: 'RETRYABLE', FATAL: 'FINAL', UNKNOWN: 'UNKNOWN', RECEIPT_PENDING: 'TICKET_PENDING' }[args.p_result];
   assert.ok(state); return { attemptId: a.id, state };
  }
  if (name === 'rpc_record_push_readiness') {
   observations.push(args.p_observation);
   return { recorded: true, observation: args.p_observation, observedAt: new Clock().toISOString(), authoritative: true };
  }
  if (name === 'rpc_get_push_transport_metrics') return { observedAt: new Clock().toISOString(),
   pendingDeliveries: queues.SEND.length, sendAttemptsDue: 0, receiptAttemptsDue: queues.RECEIPT.length, activeLeases: 0,
   oldestPendingDeliverySeconds: queues.SEND.length ? 12 : null, oldestSendAttemptSeconds: null, oldestReceiptAttemptSeconds: null };
  throw new Error('Unexpected fixture RPC ' + name);
 }
 async function fetchFixture(input, init = {}) {
  const url = new URL(input), args = JSON.parse(init.body);
  const call = { url: url.href, args, signal: init.signal, headers: new Headers(init.headers) }; calls.push(call);
  if (url.origin === ORIGIN) {
   assert.equal(call.headers.get('apikey'), SECRET); assert.equal(call.headers.get('authorization'), null);
   assert.match(url.pathname, /^\/rest\/v1\/rpc\/rpc_/);
   const name = url.pathname.split('/').pop();
   if (options.rpc) return json(await options.rpc(name, args, defaultRpc));
   return json(await defaultRpc(name, args));
  }
  assert.equal(url.origin, 'https://exp.host', 'No live network can escape');
  assert.ok(['/--/api/v2/push/send', '/--/api/v2/push/getReceipts'].includes(url.pathname));
  const isSend = url.pathname.endsWith('/send');
  if (isSend) activeSend++; else activeReceipt++;
  peakSend = Math.max(peakSend, activeSend); peakTotal = Math.max(peakTotal, activeSend + activeReceipt);
  try {
   if (options.provider) return await options.provider(call, { isSend, json, pause });
   await pause(options.providerDelay ?? 1);
   return isSend ? json({ data: [{ status: 'ok', id: 'ticket_' + randomUUID() }] })
    : json({ data: Object.fromEntries(args.ids.map(id => [id, { status: 'ok' }])) });
  } finally { if (isSend) activeSend--; else activeReceipt--; }
 }
 const cache = new Map();
 function load(filename) {
  const full = path.resolve(root, filename);
  assert.ok(full.startsWith(root + path.sep));
  if (cache.has(full)) return cache.get(full).exports;
  const mod = { exports: {} }; cache.set(full, mod);
  const source = options.entrySource && full.endsWith('/uskoci-push-transport/index.ts') ? options.entrySource : fs.readFileSync(full, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
   module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true,
  }, reportDiagnostics: true });
  assert.deepEqual(compiled.diagnostics, []);
  new Function('require','module','exports','Deno','fetch','crypto','Date','setTimeout','clearTimeout','console', compiled.outputText)(
   spec => { assert.ok(spec.startsWith('.')); return load(path.relative(root, path.resolve(path.dirname(full), spec))); }, mod, mod.exports,
   { env: { get: name => env[name] }, serve: fn => { handler = fn; } }, fetchFixture, webcrypto, Clock,
   options.setTimeout ?? setTimeout, clearTimeout,
   { log: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) });
  return mod.exports;
 }
 load('supabase/functions/uskoci-push-transport/index.ts');
 const invoke = (body = { action: 'tick' }, opts = {}) => handler(new Request(ORIGIN + '/functions/v1/uskoci-push-transport', {
  method: opts.method ?? 'POST', headers: { 'Content-Type': 'application/json', apikey: SECRET, ...opts.headers },
  body: opts.method === 'GET' ? undefined : JSON.stringify(body), signal: opts.signal,
 }));
 return { invoke, handler, calls, logs, observations, starts, completed, add, queues, attempts, clock,
  get peakSend() { return peakSend; }, get peakTotal() { return peakTotal; }, get peakClaim() { return peakClaim; } };
}

async function sqlFixture() {
 const db = new PGlite();
 await db.exec(`create schema private; create schema extensions; create schema auth;
  create role anon; create role authenticated; create role service_role;
  create function extensions.gen_random_uuid() returns uuid language sql as $$ select gen_random_uuid() $$;
  create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
  create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
  -- Shape-only dependencies for the unreachable opportunity single-target branch.
  create table public.needs(id uuid primary key,status text,requester_account_id uuid,revision integer);
  create table public.app_profiles(id uuid,account_id uuid,kind text,profile_status text);
  create table public.opportunity_deliveries(worker_profile_id uuid,worker_account_id uuid,need_id uuid,need_revision integer,status text,expires_at timestamptz);
  create function private.accounts_same_world(uuid,uuid) returns boolean language sql as $$ select false $$;
  create function private.closure_account_restricted(uuid) returns boolean language sql as $$ select true $$;
 `);
 for (const table of capture.tables) {
  await db.exec(`create table ${table.name} (${table.columns.map(c => `"${c.name}" ${c.type}${c.default ? ` default ${c.default}` : ''}${c.notNull ? ' not null' : ''}`).join(',')});`);
  for (const c of table.constraints) await db.exec(`alter table ${table.name} add constraint "${c.name}" ${c.definition};`);
  for (const index of table.indexes ?? []) {
   const name = index.match(/INDEX (\S+)/)[1];
   if (!(await db.query('select to_regclass($1) as id', [name])).rows[0].id) await db.exec(index);
  }
 }
 await db.exec(`create function private.safety_event_blocked(public.user_activity_events) returns boolean language sql as $$ select true $$;`);
 for (const f of capture.functions) {
  await db.exec(f.definition);
  await db.exec(`revoke all on function ${f.signature} from public,anon,authenticated,service_role;`);
  if (f.schema === 'public') await db.exec(`grant execute on function ${f.signature} to service_role;`);
 }
 await db.exec("select set_config('request.jwt.claim.role','service_role',false);");
 const query = async (sql, args = []) => (await db.query(sql, args)).rows;
 const value = async (sql, args = []) => (await query(sql, args))[0]?.value;
 const claim = kind => value('select public.rpc_claim_push_transport($1) as value',[kind]);
 const begin = a => value('select public.rpc_begin_push_send($1,$2) as value',[a.attemptId,a.leaseId]);
 const complete = (a,result,ticket = null) => value('select public.rpc_complete_push_transport($1,$2,$3,$4) as value',[a.attemptId,a.leaseId,result,ticket]);
 async function recipient() {
  const user = randomUUID(), session = randomUUID(), device = randomUUID();
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
  await db.query(`insert into public.notification_push_devices(id,user_id,expo_push_token,platform,revision,bound_session_id,bound_revision)
   values($1,$2,$3,'ANDROID',0,$4,0)`,[device,user,'ExpoPushToken['+randomUUID().replaceAll('-','')+']',session]);
  return { user,session,device };
 }
 async function delivery(actor, opts = {}) {
  const event = randomUUID(), id = randomUUID();
  await db.query(`insert into public.user_activity_events(id,recipient_user_id,recipient_role,event_type,entity_type,entity_id,dedupe_key)
   values($1,$2,'WORKER',$3,'AGREEMENT',$4,$5)`,[event,actor.user,opts.eventType ?? 'MESSAGE_RECEIVED',randomUUID(),'evt:'+event]);
  await db.query(`insert into public.notification_deliveries(id,event_id,recipient_user_id,recipient_role,channel,priority,state,title,body,dedupe_key,created_at,expires_at)
   values($1,$2,$3,'WORKER','PUSH',$4,'CREATED','Fixture','Fixture',$5,clock_timestamp()-make_interval(secs=>$6),
   case when $7::integer is null then null else clock_timestamp()+make_interval(secs=>$7) end)`,
  [id,event,actor.user,opts.priority ?? 'NORMAL','del:'+id,opts.age ?? 0,opts.expiresIn === undefined ? 3600 : opts.expiresIn]);
  return { id,event,...actor };
 }
 return { db,query,value,claim,begin,complete,recipient,delivery,candidate,rollback,capture };
}
module.exports = { edgeHarness,sqlFixture,capture,candidate,rollback,json,pause,SECRET,ORIGIN };
