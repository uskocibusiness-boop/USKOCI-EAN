#!/usr/bin/env node
/**
 * Authenticated DEV/ALPHA AI acceptance harness.
 *
 * Runs the real product chain end to end with a real Supabase Auth session:
 *   AUTH -> conversation -> real provider turns -> proposed facts -> review
 *   -> confirmation -> canonical writers -> authoritative readback.
 *
 * It never uses the service role, never sets JWT claims by hand and never
 * touches a table directly: every write goes through the same RPCs the app
 * calls, so auth.uid() and RLS apply exactly as they do for a phone.
 *
 * Credentials come from the environment only. The password, the access token
 * and the refresh token are never printed, never written to the report and
 * never stored. The report holds ids, states, fact values and timings.
 *
 * Required environment:
 *   DEV_ACCEPTANCE_EMAIL     dedicated QA/acceptance account, confirmed and
 *                            admitted to the AI test gate
 *   DEV_ACCEPTANCE_PASSWORD  its password, from a secret store
 * Optional:
 *   DEV_ACCEPTANCE_URL              default https://leqcwgzvjsxugfgzdmth.supabase.co
 *   DEV_ACCEPTANCE_PUBLISHABLE_KEY  default the committed publishable key
 *   DEV_ACCEPTANCE_MAX_PROVIDER_CALLS  default 12, hard ceiling for one run
 *   DEV_ACCEPTANCE_SCENARIOS        worker | need | both (default both)
 *   DEV_ACCEPTANCE_OUT              default artifacts/dev-acceptance
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const CANONICAL_URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const url = (process.env.DEV_ACCEPTANCE_URL ?? CANONICAL_URL).replace(/\/+$/, '');
const publishable = process.env.DEV_ACCEPTANCE_PUBLISHABLE_KEY ?? 'sb_publishable_o_I-YOn57oPCrIboF0OjPQ_c3DHmOZW';
const email = process.env.DEV_ACCEPTANCE_EMAIL ?? '';
const password = process.env.DEV_ACCEPTANCE_PASSWORD ?? '';
const scenarios = (process.env.DEV_ACCEPTANCE_SCENARIOS ?? 'both').toLowerCase();
const maxProviderCalls = Number(process.env.DEV_ACCEPTANCE_MAX_PROVIDER_CALLS ?? 12);
const out = resolve(process.env.DEV_ACCEPTANCE_OUT ?? 'artifacts/dev-acceptance');

if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) fail('TARGET_NOT_CANONICAL');
if (!email || !password) fail('ACCEPTANCE_CREDENTIALS_MISSING');
if (!Number.isInteger(maxProviderCalls) || maxProviderCalls < 1 || maxProviderCalls > 20) fail('PROVIDER_CALL_CEILING_INVALID');

function fail(code) { console.error(code); process.exit(2); }

/** Nothing secret ever reaches stdout or the report. */
const secrets = [password];
const scrub = value => {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of secrets) if (secret) text = text.split(secret).join('***');
  return text.replace(/(eyJ[A-Za-z0-9._-]{20,})/g, '<jwt>');
};
const log = (...parts) => console.log(parts.map(p => (typeof p === 'string' ? p : scrub(p))).join(' '));

const report = {
  unit: 'DEV_ALPHA_AI_ACCEPTANCE',
  startedAt: new Date().toISOString(),
  target: url,
  authentication: 'REAL_SUPABASE_AUTH_PASSWORD_GRANT',
  serviceRoleUsed: false,
  claimsForged: false,
  providerCalls: 0,
  providerCallCeiling: maxProviderCalls,
  scenarios: {},
  result: 'RUNNING',
};

let token = null;
let accountId = null;

async function api(path, init = {}, { authenticated = true, timeout = 45000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url + path, {
      ...init,
      redirect: 'error',
      signal: controller.signal,
      headers: {
        apikey: publishable,
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 400) }; }
    return { status: response.status, ok: response.ok, body };
  } finally { clearTimeout(timer); }
}

const rpc = async (name, args) => {
  const result = await api(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args ?? {}) });
  if (!result.ok) throw new Error(`${name} -> ${result.status} ${scrub(result.body)}`);
  return result.body;
};

/** One real provider turn. The Edge function streams; we read the whole SSE. */
async function providerTurn(fn, conversationId, clientRequestId, text) {
  if (report.providerCalls >= maxProviderCalls) throw new Error('PROVIDER_CALL_CEILING_REACHED');
  report.providerCalls += 1;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { apikey: publishable, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ conversationId, clientRequestId, text }),
    });
    const raw = await response.text();
    const events = raw.split('\n').filter(line => line.startsWith('data: '))
      .map(line => { try { return JSON.parse(line.slice(6)); } catch { return null; } }).filter(Boolean);
    const final = events.find(event => event.kind === 'final') ?? null;
    const error = events.find(event => event.kind === 'safe_error') ?? null;
    let json = null;
    if (!events.length) { try { json = JSON.parse(raw); } catch { json = { raw: raw.slice(0, 400) }; } }
    return {
      status: response.status,
      assistantText: events.filter(e => e.kind === 'text_delta').map(e => e.text).join(''),
      final, error, json, ms: Date.now() - started,
      kinds: [...new Set(events.map(e => e.kind))],
    };
  } finally { clearTimeout(timer); }
}

async function authenticate() {
  const result = await api('/auth/v1/token?grant_type=password',
    { method: 'POST', body: JSON.stringify({ email, password }) }, { authenticated: false });
  if (!result.ok || !result.body?.access_token || !result.body?.user?.id) {
    report.authenticationFailure = { status: result.status, code: result.body?.error_code ?? null };
    throw new Error('ACCEPTANCE_LOGIN_REJECTED');
  }
  token = result.body.access_token;
  secrets.push(result.body.access_token, result.body.refresh_token ?? '');
  accountId = result.body.user.id;
  const me = await api('/auth/v1/user');
  if (!me.ok || me.body?.id !== accountId || me.body?.role !== 'authenticated' || !me.body?.email_confirmed_at) {
    throw new Error('ACCEPTANCE_SESSION_NOT_CONFIRMED');
  }
  report.account = { id: accountId, emailConfirmed: true, role: me.body.role };
  log('AUTH ok, real user session for account', accountId);
}

/** WORKER_PROFILE: multi-turn, one correction, one deliberately vague fact. */
const WORKER_TURNS = [
  { label: 'services and tools', text: 'Zdravo. Radim selidbe i montažu nameštaja. Imam bušilicu i set ključeva.' },
  { label: 'vehicle and team capacity', text: 'Imam kombi. Najčešće radimo u dvoje, ja i još jedan čovek.' },
  { label: 'working area and radius', text: 'Radim u Novom Sadu i okolini, u krugu od 25 kilometara.' },
  { label: 'regular availability', text: 'Radnim danima sam slobodan od 9 do 17, a subotom do 14.' },
  { label: 'correction of an earlier fact', text: 'Ispravka: subotom ipak ne radim, samo radnim danima.' },
  { label: 'deliberately vague fact the model must not invent', text: 'Mislim da imam i neku licencu, ali stvarno nisam siguran koju tačno.' },
];

/** NEED: the owner's example, with an addition, a correction and a vague fact. */
const NEED_TURNS = [
  { label: 'initial intent', text: 'Treba mi sutra oko 17h dvojica ljudi da prenesu trosed sa Limana na Detelinaru. Lift je na obe lokacije. Treba kombi. Budžet oko 6000 dinara.' },
  { label: 'later addition', text: 'Da dopunim: trosed je razvlačivi, pa je malo teži nego običan.' },
  { label: 'correction of an earlier fact', text: 'Ipak neka bude u 18h, ne u 17h.' },
  { label: 'deliberately vague fact the model must not invent', text: 'Ne znam tačno koliko kilograma ima, nisam merio.' },
];

async function workerScenario() {
  const scenario = { turns: [], facts: [], writers: {}, readback: {} };
  const resume = process.env.DEV_ACCEPTANCE_WORKER_CONVERSATION ?? '';
  const opened = resume
    ? await rpc('rpc_read_worker_ai', { p_conversation_id: resume })
    : await rpc('rpc_open_worker_ai', { p_client_request_id: randomUUID() });
  scenario.conversationId = opened.conversationId;
  scenario.profileId = opened.profileId;
  scenario.initialCandidate = opened.candidate;
  scenario.resumed = Boolean(resume);
  log('WORKER conversation', opened.conversationId, 'profile', opened.profileId, resume ? '(resumed)' : '');

  let snapshot = opened;
  for (const turn of resume ? [] : WORKER_TURNS) {
    if (report.providerCalls >= maxProviderCalls) { scenario.stoppedAt = 'PROVIDER_CALL_CEILING'; break; }
    const key = randomUUID();
    const result = await providerTurn('uskoci-worker-interview', scenario.conversationId, key, turn.text);
    snapshot = await rpc('rpc_read_worker_ai', { p_conversation_id: scenario.conversationId });
    scenario.turns.push({
      label: turn.label, userText: turn.text, httpStatus: result.status, kinds: result.kinds,
      assistantText: result.assistantText || null, failure: result.error?.code ?? result.json?.code ?? null,
      turnState: result.final?.turn?.state ?? snapshot?.turn?.state ?? null,
      providerDispatched: result.final?.turn?.providerDispatched ?? null,
      ms: result.ms, candidateAfterTurn: snapshot?.candidate ?? null, revision: snapshot?.revision ?? null,
    });
    log('WORKER turn', turn.label, '->', result.status, result.error?.code ?? result.json?.code ?? 'ok');
    if (result.error || (result.json && result.json.code)) { scenario.stoppedAt = 'PROVIDER_TURN_FAILED'; break; }
  }

  scenario.candidateBeforeReview = snapshot?.candidate ?? null;
  if (!scenario.stoppedAt) {
    let review = await rpc('rpc_prepare_worker_ai_review',
      { p_conversation_id: scenario.conversationId, p_expected_revision: snapshot.revision, p_activate: true });
    log('WORKER review prepared, canAccept', review.canAccept, 'missing', JSON.stringify(review.missingRequired));

    // The model refuses to invent a country, so the review asks the owner for it. This is
    // the ordinary manual correction the review screen offers: the same patch RPC, with a
    // value the owner supplies, never a value the model guessed.
    const wantsCountry = Array.isArray(review.missingRequired)
      && review.missingRequired.some(item => String(item).toLowerCase().includes('drž'));
    if (!review.canAccept && wantsCountry && (process.env.DEV_ACCEPTANCE_OWNER_COUNTRY ?? '')) {
      const country = process.env.DEV_ACCEPTANCE_OWNER_COUNTRY;
      const current = snapshot.candidate.location ?? {};
      scenario.ownerCorrection = { field: 'location.operatingCountryCode', value: country, suppliedBy: 'OWNER_IN_REVIEW' };
      snapshot = await rpc('rpc_patch_worker_ai', {
        p_conversation_id: scenario.conversationId,
        p_expected_revision: snapshot.revision,
        p_patch: { location: { city: current.city, radiusKm: current.radiusKm, operatingCountryCode: country } },
      });
      log('WORKER owner supplied the country in review:', country);
      review = await rpc('rpc_prepare_worker_ai_review',
        { p_conversation_id: scenario.conversationId, p_expected_revision: snapshot.revision, p_activate: true });
      log('WORKER review re-prepared, canAccept', review.canAccept, 'missing', JSON.stringify(review.missingRequired));
    }

    scenario.review = { reviewId: review.reviewId, canAccept: review.canAccept, missingRequired: review.missingRequired, profile: review.profile };
    if (review.canAccept) {
      scenario.receipt = await rpc('rpc_save_worker_ai_review',
        { p_review_id: review.reviewId, p_displayed_digest: review.displayedContentDigest, p_client_request_id: randomUUID() });
      log('WORKER saved, profileStatus', scenario.receipt.profileStatus);
    } else scenario.stoppedAt = 'REVIEW_NOT_ACCEPTABLE';
  }

  // Authoritative readback through the same owner-facing readers the app uses.
  scenario.readback.profile = await rpc('rpc_get_worker_profile_for_edit', {});
  scenario.readback.capacity = await rpc('rpc_get_worker_capacity', {});
  scenario.readback.conversation = await rpc('rpc_read_worker_ai', { p_conversation_id: scenario.conversationId });
  return scenario;
}

async function needScenario() {
  const scenario = { turns: [], review: null, readback: {} };
  const resume = process.env.DEV_ACCEPTANCE_NEED_CONVERSATION ?? '';
  const opened = resume
    ? { conversationId: resume }
    : await rpc('rpc_ai_open_need_conversation_owned_v2', { p_client_request_id: randomUUID() });
  scenario.conversationId = opened.conversationId;
  scenario.resumed = Boolean(resume);
  log('NEED conversation', scenario.conversationId, resume ? '(resumed)' : '');

  // A single follow-up message may be supplied to keep the shared provider budget small
  // while still exercising an addition, a correction and a deliberately vague fact.
  const turns = process.env.DEV_ACCEPTANCE_NEED_MESSAGE
    ? [{ label: 'addition, correction and vague fact in one message', text: process.env.DEV_ACCEPTANCE_NEED_MESSAGE }]
    : NEED_TURNS;
  for (const turn of turns) {
    if (report.providerCalls >= maxProviderCalls) { scenario.stoppedAt = 'PROVIDER_CALL_CEILING'; break; }
    const key = randomUUID();
    const result = await providerTurn('uskoci-ai-interview', scenario.conversationId, key, turn.text);
    const status = await rpc('rpc_ai_read_need_turn_v2', { p_conversation_id: scenario.conversationId, p_client_request_id: key });
    scenario.turns.push({
      label: turn.label, userText: turn.text, httpStatus: result.status, kinds: result.kinds,
      assistantText: result.assistantText || null, failure: result.error?.code ?? result.json?.code ?? null,
      turnState: status?.state ?? null, retryAllowed: status?.retryAllowed ?? null,
      receipt: status?.receipt ?? null, ms: result.ms,
    });
    log('NEED turn', turn.label, '->', result.status, result.error?.code ?? result.json?.code ?? 'ok');
    if (result.error || (result.json && result.json.code)) { scenario.stoppedAt = 'PROVIDER_TURN_FAILED'; break; }
  }

  // Facts as the owner sees them before any confirmation.
  const facts = await api(`/rest/v1/ai_structured_facts?conversation_id=eq.${scenario.conversationId}` +
    '&superseded_at=is.null&select=id,fact_key,fact_value,display_value,status,source,created_at&order=created_at.asc');
  scenario.proposedFacts = facts.body;

  if (!scenario.stoppedAt) {
    const review = await rpc('rpc_ai_need_review_v2', { p_conversation_id: scenario.conversationId });
    scenario.needReview = review;
    const prepared = await rpc('rpc_prepare_ai_task_review',
      { p_conversation_id: scenario.conversationId, p_response_deadline: null, p_location: null });
    scenario.review = { reviewId: prepared.reviewId, canAccept: prepared.canAccept, missingRequired: prepared.missingRequired ?? null,
      publicProjection: prepared.publicProjection, location: prepared.location };
    log('NEED review prepared, canAccept', prepared.canAccept);
    if (prepared.canAccept) {
      const key = randomUUID();
      scenario.accepted = await rpc('rpc_accept_ai_task_review',
        { p_review_id: prepared.reviewId, p_displayed_content_digest: prepared.displayedContentDigest, p_client_request_id: key });
      log('NEED accepted, need', scenario.accepted?.needId ?? '(see receipt)');
      scenario.publishReadiness = await rpc('rpc_read_latest_ai_task_review', { p_conversation_id: scenario.conversationId });
    } else scenario.stoppedAt = 'REVIEW_NOT_ACCEPTABLE_WITHOUT_RESOLVED_LOCATION';
  }

  const needId = scenario.accepted?.needId ?? null;
  if (needId) {
    const need = await api(`/rest/v1/needs?id=eq.${needId}&select=id,status,revision,title,description,category,price_mode,price_rsd,` +
      'schedule_kind,starts_at,ends_at,slots,required_skills,required_tools,required_vehicles,required_licenses,approximate_city');
    scenario.readback.need = need.body;
    const geo = await api(`/rest/v1/need_geography?need_id=eq.${needId}&select=need_id,public_topology`);
    scenario.readback.geography = geo.body;
  }
  return scenario;
}

// One owner-directed turn at a time. The CI environment supplies the existing
// QA account's credential; each call uses the same Auth/RPC/Edge boundaries as
// the app and keeps the AI's question in the sanitized report.
async function customNeedScenario() {
  const conversationId = process.env.DEV_ACCEPTANCE_CONVERSATION_ID ?? '';
  const message = process.env.DEV_ACCEPTANCE_MESSAGE ?? '';
  const reviewId = process.env.DEV_ACCEPTANCE_REVIEW_ID ?? '';
  const requestId = process.env.DEV_ACCEPTANCE_REQUEST_ID ?? '';
  if (scenarios === 'custom_need_turn') {
    if (!message || message.length > 2000) throw new Error('CUSTOM_MESSAGE_REQUIRED_OR_TOO_LONG');
    const opened = conversationId
      ? { conversationId }
      : await rpc('rpc_ai_open_need_conversation_owned_v2', { p_client_request_id: randomUUID() });
    const key = randomUUID();
    const response = await providerTurn('uskoci-ai-interview', opened.conversationId, key, message);
    const turn = await rpc('rpc_ai_read_need_turn_v2', { p_conversation_id: opened.conversationId, p_client_request_id: key });
    const result = { conversationId: opened.conversationId, userText: message, assistantText: response.assistantText,
      httpStatus: response.status, error: response.error ?? response.json?.code ?? null,
      final: response.final, turnState: turn?.state ?? null, retryAllowed: turn?.retryAllowed ?? null };
    if (result.error || response.status !== 200) report.result = 'INCOMPLETE';
    return result;
  }
  if (scenarios === 'custom_need_review') {
    if (!conversationId) throw new Error('CUSTOM_CONVERSATION_REQUIRED');
    const preview = await rpc('rpc_ai_need_review_v2', { p_conversation_id: conversationId });
    const review = await rpc('rpc_prepare_ai_task_review',
      { p_conversation_id: conversationId, p_response_deadline: null, p_location: null });
    return { conversationId, preview, reviewId: review.reviewId, canAccept: review.canAccept,
      missingRequired: review.missingRequired, publicProjection: review.publicProjection,
      location: review.location, safety: review.safety };
  }
  if (scenarios === 'custom_need_publish') {
    if (!reviewId || !requestId) throw new Error('CUSTOM_REVIEW_AND_REQUEST_REQUIRED');
    let read = await rpc('rpc_read_ai_task_review', { p_review_id: reviewId });
    if (!read?.review?.canAccept) throw new Error('CUSTOM_REVIEW_NOT_ACCEPTABLE');
    let command = read.command;
    if (!command) command = await rpc('rpc_accept_ai_task_review', {
      p_review_id: reviewId, p_displayed_content_digest: read.review.displayedContentDigest,
      p_client_request_id: requestId,
    });
    if (command.clientRequestId !== requestId) throw new Error('CUSTOM_COMMAND_ID_MISMATCH');
    let evaluated = null;
    if (command.state === 'ACCEPTED') {
      evaluated = await api('/functions/v1/uskoci-publication-evaluate', {
        method: 'POST', body: JSON.stringify({ needId: command.needId,
          expectedRevision: command.needRevision, acceptedReviewId: reviewId }),
      }, { timeout: 55000 });
      read = await rpc('rpc_read_ai_task_review', { p_review_id: reviewId });
      command = read.command;
    }
    if (command.state === 'EVALUATED' && command.evaluation?.kind === 'DECISION'
      && command.evaluation.decision?.outcome === 'ALLOW') {
      command = await rpc('rpc_publish_accepted_ai_task_review',
        { p_review_id: reviewId, p_client_request_id: requestId });
    }
    const need = command.needId
      ? await api(`/rest/v1/needs?id=eq.${command.needId}&select=id,status,revision,title,description,approximate_city`)
      : null;
    if (command.state !== 'PUBLISHED' || need?.body?.[0]?.status !== 'PUBLISHED') report.result = 'INCOMPLETE';
    return { reviewId, command, evaluationHttpStatus: evaluated?.status ?? null,
      evaluation: evaluated?.body ?? null, readback: need?.body ?? null };
  }
  throw new Error('CUSTOM_SCENARIO_UNKNOWN');
}

/**
 * Close an unknown-outcome turn the way the app does: the owning signed-in account
 * calls the canonical cancel RPC. It marks the turn FAILED with a cancellation time
 * and keeps provider_dispatched true, so a real dispatch is never denied.
 */
async function cancelTurn(spec) {
  const [conversationId, clientRequestId] = spec.split(':');
  const before = await rpc('rpc_ai_recover_need_turn_v2', { p_conversation_id: conversationId, p_client_request_id: clientRequestId });
  log('CANCEL before:', JSON.stringify({ state: before?.turn?.state, providerDispatched: before?.providerDispatched, canCancel: before?.canCancel }));
  const after = await rpc('rpc_ai_cancel_need_turn_v2', { p_conversation_id: conversationId, p_client_request_id: clientRequestId });
  log('CANCEL after :', JSON.stringify({ state: after?.turn?.state, providerDispatched: after?.providerDispatched, cancelled: after?.cancelled }));
  return { conversationId, clientRequestId, before, after };
}

try {
  mkdirSync(out, { recursive: true });
  await authenticate();
  if (process.env.DEV_ACCEPTANCE_CANCEL) {
    report.scenarios.turnCancellation = await cancelTurn(process.env.DEV_ACCEPTANCE_CANCEL);
    report.result = report.scenarios.turnCancellation.after?.turn?.state === 'FAILED' ? 'PASS' : 'INCOMPLETE';
    throw { skipScenarios: true };
  }
  if (scenarios.startsWith('custom_need_')) {
    report.scenarios.customNeed = await customNeedScenario();
    if (report.result === 'RUNNING') report.result = 'PASS';
    throw { skipScenarios: true };
  }
  if (scenarios === 'both' || scenarios === 'worker') report.scenarios.workerProfile = await workerScenario();
  if (scenarios === 'both' || scenarios === 'need') report.scenarios.need = await needScenario();
  const stopped = Object.values(report.scenarios).some(s => s.stoppedAt);
  report.result = stopped ? 'INCOMPLETE' : 'PASS';
} catch (error) {
  if (!error?.skipScenarios) {
    report.result = 'FAIL';
    report.failure = scrub(error instanceof Error ? error.message : String(error));
  }
} finally {
  report.finishedAt = new Date().toISOString();
  const file = resolve(out, 'ai-acceptance-report.json');
  writeFileSync(file, `${scrub(JSON.stringify(report, null, 2))}\n`, 'utf8');
  log('report written to', file, 'result', report.result, 'provider calls', String(report.providerCalls));
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
