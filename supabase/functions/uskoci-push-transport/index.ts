/** Service-only existing-ledger worker. No client recipients, payload or URL.
 * Ticket = Expo queued; receipt OK = FCM/APNs accepted; neither = device delivered.
 * No logs: Expo error messages can contain transport addresses.
 */
import { notificationPushCopy } from '../_shared/pushNotificationCopy.mjs';
import { isSupabaseServiceRequest, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
export {};
type Row = Record<string, unknown>;
const row = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
const only = (x: Row, keys: string[]) => Object.keys(x).every(k => keys.includes(k)) && keys.every(k => k in x);
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const ticket = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(x);
const live = (x: unknown): x is string => typeof x === 'string' && Number.isFinite(Date.parse(x)) && Date.parse(x) > Date.now();
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
class Invalid extends Error {}
class StreamReadFailure extends Error {}
let running = false;
// A minute cron may drain several recipients, but never run unbounded work.
// Four send lanes and one receipt batch lane share the DB's six-lease limit;
// that database limit (not this isolate-local flag) protects parallel isolates.
const TICK_SEND_LIMIT = 100;
const TICK_RECEIPT_LIMIT = 100;
// Never hold a partial batch waiting for another lease. A SQL WAIT flushes it,
// allowing the same six global leases to serve both sends and receipt checks.
const RECEIPT_BATCH_LIMIT = 6;
const TICK_DEADLINE_MS = 50000;
const CLAIM_WINDOW_MS = 30000;
const RPC_DEADLINE_MS = 3000;
const PROVIDER_DEADLINE_MS = 5000;
const MAX_OFFLINE_TTL_SECONDS = 3600;
async function request(url: string, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
 let aborted: (() => void) | undefined;
 const signal = init.signal;
 if (signal.aborted) throw new Invalid();
 try {
  return await Promise.race([fetch(url, init).then(response => {
   if (signal.aborted) { void response.body?.cancel().catch(() => undefined); throw new Invalid(); }
   return response;
  }), new Promise<never>((_, reject) => { aborted = () => reject(new Invalid()); signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted(); })]);
 } finally { if (aborted) signal.removeEventListener('abort', aborted); }
}
async function read(stream: ReadableStream<Uint8Array> | null, max: number, signal: AbortSignal): Promise<unknown> {
 if (!stream) throw new Invalid();
 const reader = stream.getReader(); let total = 0; const chunks: Uint8Array[] = [];
 const cancel = () => { void reader.cancel().catch(() => undefined); };
 signal.addEventListener('abort', cancel, { once: true });
 try {
  while (true) {
   if (signal.aborted) throw new Invalid();
   let part: ReadableStreamReadResult<Uint8Array>;
   try { part = await reader.read(); } catch { throw new StreamReadFailure(); }
   if (signal.aborted) throw new Invalid();
   if (part.done) break;
   total += part.value.length; if (total > max) throw new Invalid(); chunks.push(part.value);
  }
  const bytes = new Uint8Array(total); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
 } finally { signal.removeEventListener('abort', cancel); cancel(); }
}
type Result = 'TICKET' | 'PROVIDER_ACCEPTED' | 'DEVICE_NOT_REGISTERED' | 'RETRYABLE' | 'RECEIPT_RATE_EXCEEDED' | 'FATAL' | 'UNKNOWN' | 'RECEIPT_PENDING';
type ProviderResult = { result: Result; ticketId: string | null };
type Claim = { kind: 'SEND' | 'RECEIPT'; attemptId: string; leaseId: string; leaseExpiresAt: string; ticketId: string | null };
function validClaim(value: unknown, kind: 'SEND' | 'RECEIPT'): value is Claim {
 return row(value) && only(value, ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'ticketId']) && value.kind === kind
  && uuid(value.attemptId) && uuid(value.leaseId) && live(value.leaseExpiresAt)
  && (kind === 'SEND' ? value.ticketId === null : ticket(value.ticketId));
}
function expoResult(value: unknown, receipt: boolean): ProviderResult {
 if (!row(value)) throw new Invalid();
 if (value.status === 'ok') {
  if (receipt && only(value, ['status'])) return { result: 'PROVIDER_ACCEPTED', ticketId: null };
  if (!receipt && only(value, ['status', 'id']) && ticket(value.id)) return { result: 'TICKET', ticketId: value.id };
  throw new Invalid();
 }
 if (value.status !== 'error' || Object.keys(value).some(k => !['status', 'message', 'details'].includes(k))
  || (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > 4096))
  || !row(value.details) || typeof value.details.error !== 'string') throw new Invalid();
 // Never retain provider messages, credentials, token or arbitrary detail fields.
 const error = value.details.error;
 return { result: error === 'DeviceNotRegistered' ? 'DEVICE_NOT_REGISTERED' : error === 'MessageRateExceeded' ? (receipt ? 'RECEIPT_RATE_EXCEEDED' : 'RETRYABLE')
  : ['MessageTooBig', 'MismatchSenderId', 'InvalidCredentials', 'InvalidPushToken'].includes(error) ? 'FATAL' : 'UNKNOWN', ticketId: null };
}
Deno.serve(async req => {
 if (req.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
 const service = readSupabaseServiceKey(name => Deno.env.get(name));
 if (!service || !isSupabaseServiceRequest(req.headers, name => Deno.env.get(name))) return json({ code: 'FORBIDDEN' }, 403);
 // A disabled tick performs no DB/provider IO; a service-only probe may
 // record its actual disabled state without claiming work or reading Expo keys.
 const enabled = Deno.env.get('EXPO_PUSH_TRANSPORT_ENABLED') === 'true';
 if (running) return json({ kind: 'BUSY' }, 429);
 running = true;
 const controller = new AbortController();
 const cancel = () => controller.abort(); req.signal.addEventListener('abort', cancel, { once: true });
 if (req.signal.aborted) cancel();
 const startedAt = Date.now();
 const timer = setTimeout(cancel, TICK_DEADLINE_MS);
 const signal = controller.signal;
 let reportFailure: (() => Promise<void>) | undefined;
 try {
  const input = await read(req.body, 256, signal);
  if (!row(input)) return json({ code: 'INVALID_REQUEST' }, 400);
  const targeted = input.action === 'single_target' || input.action === 'single_target_receipt';
  if (targeted ? (!only(input, ['action', 'admissionId']) || !uuid(input.admissionId))
   : (!only(input, ['action']) || !['tick', 'probe'].includes(String(input.action)))) return json({ code: 'INVALID_REQUEST' }, 400);
  if (targeted && Deno.env.get('EXPO_PUSH_SINGLE_TARGET_ENABLED') !== 'true') return json({ kind: 'DISABLED' });
  if (!enabled && input.action === 'tick') return json({ kind: 'DISABLED' });
  const rawURL = Deno.env.get('SUPABASE_URL'); if (!rawURL) throw new Invalid();
  const base = new URL(rawURL);
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash) throw new Invalid();
  async function bounded<T>(milliseconds: number, operation: (localSignal: AbortSignal) => Promise<T>): Promise<T> {
   if (signal.aborted) throw new Invalid();
   const local = new AbortController();
   const abort = () => local.abort();
   signal.addEventListener('abort', abort, { once: true });
   if (signal.aborted) abort();
   const deadline = setTimeout(abort, milliseconds);
   try { return await operation(local.signal); }
   finally { clearTimeout(deadline); signal.removeEventListener('abort', abort); local.abort(); }
  }
  async function rpc(name: 'rpc_claim_push_transport' | 'rpc_begin_push_send' | 'rpc_complete_push_transport' | 'rpc_record_push_readiness' | 'rpc_claim_push_single_target' | 'rpc_claim_push_single_target_receipt' | 'rpc_get_push_transport_metrics', args: Row) {
   if (signal.aborted) throw new Invalid();
   return bounded(RPC_DEADLINE_MS, async localSignal => {
    const result = await request(`${base.origin}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal: localSignal,
     headers: supabaseServiceHeaders(service!, { 'Content-Type': 'application/json' }), body: JSON.stringify(args) });
    if (!result.ok) { void result.body?.cancel().catch(() => undefined); throw new Invalid(); }
    return read(result.body, 16384, localSignal);
   });
  }
  async function observe(observation: 'PROBE_ENABLED' | 'PROBE_DISABLED' | 'TICK_OK' | 'TICK_DEGRADED' | 'TICK_FAILED') {
   const receipt = await rpc('rpc_record_push_readiness', { p_sender_version: 'PRE_V3_PUSH_READINESS_V1', p_observation: observation });
   if (!row(receipt) || !only(receipt, ['recorded', 'observation', 'observedAt', 'authoritative']) || receipt.recorded !== true ||
    receipt.observation !== observation || receipt.authoritative !== true || typeof receipt.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(receipt.observedAt))) throw new Invalid();
  }
  if (input.action === 'probe') {
   await observe(enabled ? 'PROBE_ENABLED' : 'PROBE_DISABLED');
   return json({ kind: 'READINESS_RECORDED', enabled });
  }
  // Targeted actions never record a global tick observation.
  if (!targeted) reportFailure = () => observe('TICK_FAILED');
  const claimed = { SEND: 0, RECEIPT: 0 };
  // Serialize only short claim RPCs in this invocation. Running them together
  // would contend on the DB's advisory claim lock and mistake contention for
  // an empty queue. Begin/provider/settle work remains parallel and durable.
  let claimTail: Promise<void> = Promise.resolve();
  async function globalClaim(kind: 'SEND' | 'RECEIPT') {
   const previous = claimTail;
   let release!: () => void;
   claimTail = new Promise<void>(resolve => { release = resolve; });
   await previous;
   try {
    if (signal.aborted) throw new Invalid();
    if (Date.now() >= startedAt + CLAIM_WINDOW_MS || claimed[kind] >= (kind === 'SEND' ? TICK_SEND_LIMIT : TICK_RECEIPT_LIMIT))
     return { kind: 'STOP' };
    const value = await rpc('rpc_claim_push_transport', { p_kind: kind });
    if (row(value) && value.kind === kind) claimed[kind] += 1;
    return value;
   } finally { release(); }
  }
  async function pause(milliseconds: number) {
   if (signal.aborted) throw new Invalid();
   await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(waiter); signal.removeEventListener('abort', abort); reject(new Invalid()); };
    const waiter = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
   });
  }
  async function settle(claim: Claim, parsed: ProviderResult) {
   if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
   const done = await rpc('rpc_complete_push_transport', { p_attempt_id: claim.attemptId, p_lease_id: claim.leaseId, p_result: parsed.result, p_ticket_id: parsed.ticketId });
   const states: Record<Result, string[]> = { TICKET: ['TICKET_PENDING'], PROVIDER_ACCEPTED: ['PROVIDER_ACCEPTED'], DEVICE_NOT_REGISTERED: ['FINAL'],
    RETRYABLE: claim.kind === 'SEND' ? ['RETRYABLE', 'FINAL'] : ['TICKET_PENDING'], RECEIPT_RATE_EXCEEDED: ['RETRYABLE', 'FINAL'], FATAL: ['FINAL'], UNKNOWN: ['UNKNOWN'], RECEIPT_PENDING: ['TICKET_PENDING'] };
   if (!row(done) || !only(done, ['attemptId', 'state']) || done.attemptId !== claim.attemptId || !states[parsed.result].includes(String(done.state))) throw new Invalid();
   return String(done.state);
  }
  // An unreadable provider response is not a valid "receipt not ready" reply.
  // Keep both outcomes pending in SQL (never resend), but do not report an
  // upstream outage as a healthy tick. Counts contain no tickets or raw errors.
  const receiptReadFailures = { http: 0, transport: 0, invalid: 0 };
  const failedReceiptReads = () => receiptReadFailures.http + receiptReadFailures.transport + receiptReadFailures.invalid;
  async function readReceipts(ids: string[]): Promise<Map<string, ProviderResult>> {
   const outcomes = new Map<string, ProviderResult>();
   let failure: 'transport' | 'invalid' = 'transport';
   try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const access = Deno.env.get('EXPO_ACCESS_TOKEN'); if (access) headers.Authorization = `Bearer ${access}`;
    await bounded(PROVIDER_DEADLINE_MS, async localSignal => {
     const response = await request('https://exp.host/--/api/v2/push/getReceipts',
      { method: 'POST', headers, body: JSON.stringify({ ids }), signal: localSignal, redirect: 'error' });
     if (!response.ok) { void response.body?.cancel().catch(() => undefined); receiptReadFailures.http += 1; return; }
     failure = 'invalid';
     try {
      const envelope = await read(response.body, 32768, localSignal);
      if (!row(envelope) || !only(envelope, ['data']) || !row(envelope.data)
       || Object.keys(envelope.data).some(id => !ids.includes(id))) throw new Invalid();
      for (const id of ids) {
       if (!Object.hasOwn(envelope.data, id)) continue;
       try { outcomes.set(id, expoResult(envelope.data[id], true)); }
       catch { receiptReadFailures.invalid += 1; }
      }
     } catch (error) {
      if (localSignal.aborted || error instanceof StreamReadFailure) failure = 'transport';
      throw error;
     }
    });
   } catch { receiptReadFailures[failure] += 1; }
   return outcomes;
  }
  async function once(kind: 'SEND' | 'RECEIPT', admissionId?: string) {
   const claim = admissionId
    ? await rpc(kind === 'SEND' ? 'rpc_claim_push_single_target' : 'rpc_claim_push_single_target_receipt', { p_admission_id: admissionId })
    : await globalClaim(kind);
   if (row(claim) && only(claim, ['kind']) && claim.kind === 'NONE') return 'NONE';
   if (!admissionId && row(claim) && only(claim, ['kind']) && claim.kind === 'STOP') return 'STOP';
   if (!admissionId && row(claim) && only(claim, ['kind', 'retryAfterMs']) && claim.kind === 'WAIT'
     && Number.isInteger(claim.retryAfterMs) && Number(claim.retryAfterMs) >= 100 && Number(claim.retryAfterMs) <= 1000) {
    await pause(Number(claim.retryAfterMs));
    return 'WAIT';
   }
   if (!validClaim(claim, kind)) throw new Invalid();
   let body: Row | Row[];
   let deliveryExpiresAt: number | null = null;
   if (kind === 'SEND') {
    const begin = await rpc('rpc_begin_push_send', { p_attempt_id: claim.attemptId, p_lease_id: claim.leaseId });
    if (row(begin) && only(begin, ['kind']) && begin.kind === 'SUPPRESSED') return 'SUPPRESSED';
    const beginKeys = ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'expoPushToken', 'priority', 'eventType'];
    // Compatibility bridge: legacy receipts have no eventId. These four
    // server-authorized event kinds may add one opaque identity; no Need ID/body.
    const optionalKeys = row(begin) ? [
     ...(Object.hasOwn(begin, 'eventId') ? ['eventId'] : []),
     ...(Object.hasOwn(begin, 'deliveryExpiresAt') ? ['deliveryExpiresAt'] : []),
    ] : [];
    if (!row(begin) || !only(begin, [...beginKeys, ...optionalKeys])
     || (Object.hasOwn(begin, 'eventId') && (!['MESSAGE_RECEIVED', 'OPPORTUNITY_AVAILABLE', 'RESPONSE_RECEIVED', 'RESPONSE_UPDATED'].includes(String(begin.eventType)) || !uuid(begin.eventId)))
     || (Object.hasOwn(begin, 'deliveryExpiresAt') && (typeof begin.deliveryExpiresAt !== 'string' || !Number.isFinite(Date.parse(begin.deliveryExpiresAt)))) || begin.kind !== 'SEND'
     || begin.attemptId !== claim.attemptId || begin.leaseId !== claim.leaseId || begin.leaseExpiresAt !== claim.leaseExpiresAt || !live(begin.leaseExpiresAt)
     || typeof begin.expoPushToken !== 'string' || begin.expoPushToken.length > 256 || !/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(begin.expoPushToken)
     || !['NORMAL', 'HIGH'].includes(String(begin.priority))
     || typeof begin.eventType !== 'string' || !/^[A-Z][A-Z0-9_]{2,63}$/.test(begin.eventType)) throw new Invalid();
    const copy = notificationPushCopy(begin.eventType, begin.priority === 'HIGH' ? 'HITNO' : 'NORMAL');
    // Older installed clients admit only {kind:'INBOX'}. Keep that default until
    // the owned exact-target client has shipped and its cold/live tap is proven.
    const exactMessage = Deno.env.get('EXPO_PUSH_MESSAGE_TARGET_ENABLED') === 'true'
      && begin.eventType === 'MESSAGE_RECEIVED' && uuid(begin.eventId);
    // This second feature gate applies ONLY to one admitted recipient/device.
    // A global push tick never carries an opportunity event even if the flag is on.
    const exactOpportunity = targeted && Deno.env.get('EXPO_PUSH_OPPORTUNITY_TARGET_ENABLED') === 'true'
      && begin.eventType === 'OPPORTUNITY_AVAILABLE' && uuid(begin.eventId);
    const exactApplication = Deno.env.get('EXPO_PUSH_APPLICATION_TARGET_ENABLED') === 'true'
      && ['RESPONSE_RECEIVED', 'RESPONSE_UPDATED'].includes(String(begin.eventType)) && uuid(begin.eventId);
    const data = exactMessage || exactOpportunity || exactApplication
      ? { kind: 'INBOX', eventType: begin.eventType, eventId: (begin.eventId as string).toLowerCase() }
      : { kind: 'INBOX' };
    deliveryExpiresAt = typeof begin.deliveryExpiresAt === 'string' ? Date.parse(begin.deliveryExpiresAt) : null;
    // The server owns expiry. Older begin receipts and one-shot admissions
    // retain TTL 0; a verified expiry allows offline delivery for at most 1h.
    const ttl = targeted || deliveryExpiresAt === null ? 0
      : Math.max(0, Math.min(MAX_OFFLINE_TTL_SECONDS, Math.floor((deliveryExpiresAt - Date.now()) / 1000)));
    body = [{ to: begin.expoPushToken, title: copy.title, body: copy.body,
     data, channelId: 'default', sound: 'default', priority: begin.priority === 'HIGH' ? 'high' : 'normal', ttl }];
   } else body = { ids: [claim.ticketId] };
   let parsed: ProviderResult = { result: kind === 'SEND' ? 'UNKNOWN' : 'RECEIPT_PENDING', ticketId: null };
   try {
    if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const access = Deno.env.get('EXPO_ACCESS_TOKEN'); if (access) headers.Authorization = `Bearer ${access}`;
    // Literal provider URLs; no redirects or caller-controlled target component.
    if (kind === 'SEND' && deliveryExpiresAt !== null && deliveryExpiresAt <= Date.now()) {
     // No provider request was made. Close a now-expired claimed attempt.
     parsed = { result: 'FATAL', ticketId: null };
    } else if (kind === 'RECEIPT') {
     if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
     const outcomes = await readReceipts([claim.ticketId as string]);
     parsed = outcomes.get(claim.ticketId as string) ?? parsed;
    } else await bounded(PROVIDER_DEADLINE_MS, async localSignal => {
    const response = await request('https://exp.host/--/api/v2/push/send',
     { method: 'POST', headers, body: JSON.stringify(body), signal: localSignal, redirect: 'error' });
    if (!response.ok) {
     void response.body?.cancel().catch(() => undefined);
     // Only explicit throttle rejection is known safe to resend. 5xx/network/
     // deadline may follow provider acceptance; SQL preserves them as UNKNOWN.
     parsed.result = response.status === 429 ? 'RETRYABLE'
      : response.status >= 400 && response.status < 500 ? 'FATAL' : 'UNKNOWN';
    } else {
     const envelope = await read(response.body, 32768, localSignal);
     if (!row(envelope) || !only(envelope, ['data'])) throw new Invalid();
     if (!Array.isArray(envelope.data) || envelope.data.length !== 1) throw new Invalid();
     parsed = expoResult(envelope.data[0], false);
    }
    });
   } catch { /* No blind resend and no raw provider exception reaches output. */ }
   return settle(claim, parsed);
  }
  // Exactly one selected lane. Never fall through to global receipt/send scans.
  if (targeted) {
   const state = await once(input.action === 'single_target' ? 'SEND' : 'RECEIPT', input.admissionId as string);
   return json({ kind: 'SINGLE_TARGET_COMPLETED', state, receiptReadFailures });
  }
  type Summary = { processed: number; failures: number; states: Record<string, number>; lastState: string };
  const summaries: Record<'SEND' | 'RECEIPT', Summary> = {
   SEND: { processed: 0, failures: 0, states: {}, lastState: 'NONE' },
   RECEIPT: { processed: 0, failures: 0, states: {}, lastState: 'NONE' },
  };
  async function drainReceipts() {
   const summary = summaries.RECEIPT;
   let stop = false;
   try {
    while (!signal.aborted && Date.now() < startedAt + CLAIM_WINDOW_MS) {
     const batch: Claim[] = [];
     let waitMs = 0;
     try {
      while (batch.length < RECEIPT_BATCH_LIMIT) {
       const claim = await globalClaim('RECEIPT');
       if (row(claim) && only(claim, ['kind']) && (claim.kind === 'NONE' || claim.kind === 'STOP')) { stop = true; break; }
       if (row(claim) && only(claim, ['kind', 'retryAfterMs']) && claim.kind === 'WAIT'
        && Number.isInteger(claim.retryAfterMs) && Number(claim.retryAfterMs) >= 100 && Number(claim.retryAfterMs) <= 1000) {
        waitMs = Number(claim.retryAfterMs); break;
       }
       if (!validClaim(claim, 'RECEIPT')) throw new Invalid();
       batch.push(claim);
      }
     } catch { summary.failures += 1; stop = true; }
     if (signal.aborted) throw new Invalid();
     if (batch.length === 0) {
      if (stop) break;
      if (waitMs) await pause(waitMs);
      continue;
     }
     // The server owns each lease and ticket; no client-supplied IDs are read.
     // Flush even on WAIT/NONE/STOP. Waiting while holding all available leases
     // would block both this batch and the independent send lanes.
     const active = batch.filter(claim => live(claim.leaseExpiresAt));
     if (active.length !== batch.length) { summary.failures += batch.length - active.length; stop = true; }
     if (active.length > 0) {
      const ids = [...new Set(active.map(claim => claim.ticketId as string))];
      const pending: ProviderResult = { result: 'RECEIPT_PENDING', ticketId: null };
      const failuresBefore = failedReceiptReads();
      const outcomes = await readReceipts(ids);
      // Settle this batch, then leave new tickets for a later bounded tick.
      // Valid-but-missing receipts remain ordinary pending work and do not stop.
      if (failedReceiptReads() > failuresBefore) stop = true;
      // Settle independently, including after another member loses its SQL ACK.
      // A failed member keeps its durable lease for the existing SQL recovery.
      const settled = await Promise.allSettled(active.map(claim => settle(claim, outcomes.get(claim.ticketId as string) ?? pending)));
      for (const result of settled) {
       if (result.status === 'rejected') { summary.failures += 1; stop = true; continue; }
       summary.processed += 1; summary.lastState = result.value;
       summary.states[result.value] = (summary.states[result.value] ?? 0) + 1;
      }
     }
     if (stop) break;
    }
   } catch { summary.failures += 1; }
  }
  async function drain(kind: 'SEND' | 'RECEIPT') {
   const summary = summaries[kind];
   try {
    while (!signal.aborted && Date.now() < startedAt + CLAIM_WINDOW_MS) {
     const state = await once(kind);
     if (state === 'NONE' || state === 'STOP') break;
     if (state === 'WAIT') continue;
     summary.processed += 1; summary.lastState = state;
     summary.states[state] = (summary.states[state] ?? 0) + 1;
     // Stop this send lane on an uncertain or throttled provider. Do not turn
     // an outage into 100 uncertain deliveries or an immediate retry storm.
     if (kind === 'SEND' && ['UNKNOWN', 'RETRYABLE'].includes(state)) break;
    }
   } catch { summary.failures += 1; }
  }
  // Receipts have their own progress budget and never wait behind all sends.
  await Promise.all([drainReceipts(), drain('SEND'), drain('SEND'), drain('SEND'), drain('SEND')]);
  if (signal.aborted) throw new Invalid();
  let queue: unknown = null;
  try {
   const metrics = await rpc('rpc_get_push_transport_metrics', {});
   const counts = ['pendingDeliveries', 'sendAttemptsDue', 'receiptAttemptsDue', 'activeLeases'];
   const ages = ['oldestPendingDeliverySeconds', 'oldestSendAttemptSeconds', 'oldestReceiptAttemptSeconds'];
   if (!row(metrics) || !only(metrics, ['observedAt', ...counts, ...ages])
    || typeof metrics.observedAt !== 'string' || !Number.isFinite(Date.parse(metrics.observedAt))
    || counts.some(key => !Number.isSafeInteger(metrics[key]) || Number(metrics[key]) < 0)
    || ages.some(key => metrics[key] !== null && (typeof metrics[key] !== 'number' || !Number.isFinite(metrics[key]) || Number(metrics[key]) < 0))) throw new Invalid();
   queue = metrics;
  } catch { /* Deployment bridge: unavailable telemetry never resends or masks a settled push. */ }
  const unhealthy = failedReceiptReads() > 0 || Object.values(summaries).some(s => s.failures > 0 || ['UNKNOWN', 'FINAL', 'RETRYABLE'].some(state => s.states[state] > 0));
  await observe(unhealthy ? 'TICK_DEGRADED' : 'TICK_OK');
  return json({ kind: 'TICK_COMPLETED', receipt: summaries.RECEIPT.lastState, send: summaries.SEND.lastState,
   processed: { send: summaries.SEND.processed, receipt: summaries.RECEIPT.processed },
   failures: { send: summaries.SEND.failures, receipt: summaries.RECEIPT.failures }, receiptReadFailures, queue });
 } catch {
  // No late writes after cancellation; failed telemetry never masks the original
  // unknown outcome and never causes a resend. Stale/no observation stays UNKNOWN.
  if (!signal.aborted && reportFailure) { try { await reportFailure(); } catch { /* bounded, no raw error */ } }
  return json({ code: 'PUSH_UNAVAILABLE' }, signal.aborted ? 504 : 503);
 }
 finally { clearTimeout(timer); req.signal.removeEventListener('abort', cancel); controller.abort(); running = false; }
});
