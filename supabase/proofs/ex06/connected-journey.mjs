// Four real Auth actors, one product-published task and bounded real RPCs. Loopback only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createFixtures} from './lib/fixtures.mjs';
import {catalogDigestSql, assertChainFacts, CHAIN_FACTS_SQL} from '../ex05_s01/lib/harness.mjs';

assert.equal(process.env.CONNECTED_JOURNEY_DISPOSABLE, 'FOUR_ACTORS_V1');
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL, process.env.DB_URL);
const rt = await import('../pre_v3/closure_runtime.mjs');
const {q, rows, sql, randomUUID} = rt;
const fx = createFixtures(rt, {needPath: 'product', authRetry: {backoffMs: 0}});
const out = process.env.CONNECTED_JOURNEY_ARTIFACT_DIR;
assert.ok(out?.startsWith('/tmp/'));
fs.mkdirSync(out, {recursive: true});
const report = {unit: 'CONNECTED_FOUR_ACTORS', sourceSha: process.env.GITHUB_SHA, result: 'RUNNING', checks: [],
  actualAuth: true, actualProductPublication: true, syntheticAIProposalAndEvaluator: true, actualProvider: false,
  liveAccess: false, pushSends: 0, simultaneousScenarioRequests: 1, population: null,
  limits: ['Four scenario accounts on a historical relevant-function replay; not full DEV235.',
    'Synthetic AI proposal and evaluator fixture; actual review/accept/publish RPCs.',
    'Sequential lifecycle and message authority proof, not 40000 active users, throughput, native UI or push.']};
const write = () => fs.writeFileSync(path.join(out, 'connected-journey-report.json'), JSON.stringify(report, null, 2) + '\n');
const pass = (name, detail = {}) => { report.checks.push({name, result: 'PASS', ...detail}); write(); console.log('PASS ' + name); };
const raw = (who, name, args) => who.client.rpc(name, args).abortSignal(AbortSignal.timeout(20000));
async function call(who, name, args) {
  const result = await raw(who, name, args);
  assert.equal(result.error, null, name + ':' + result.error?.code + ':' + result.error?.message);
  return result.data;
}
async function denied(who, name, args, message) {
  const result = await raw(who, name, args);
  assert.ok(result.error, 'EXPECTED_DENIAL:' + name);
  if (message) assert.equal(result.error.message, message);
}
const state = id => rows(`select n.status, n.revision, public.fn_need_covered_slots(n.id) covered,
  n.required_slots, n.remaining_search_closed_at from public.needs n where n.id=${q(id)}::uuid`)[0];
const fingerprint = id => sql(`select md5(to_jsonb(a)::text) from public.agreements a where id=${q(id)}::uuid`);
const group = (who, id) => call(who, 'rpc_read_group_context_v5', {p_expected_user_id: who.id, p_agreement_id: id, p_management_after_id: null});
const groupArgs = (who, id, body, key = randomUUID()) => ({p_expected_user_id: who.id, p_group_id: id, p_body: body, p_client_request_id: key});
const groupPage = (who, id) => call(who, 'rpc_read_group_messages_v5', {p_expected_user_id: who.id, p_group_id: id, p_after_sequence: null, p_before_sequence: null});
const ids = page => page.messages.map(message => message.messageId);
const privateArgs = (who, id) => ({p_expected_user_id: who.id, p_agreement_id: id, p_limit: 50, p_before_created_at: null, p_before_id: null});
const privatePage = (who, id) => call(who, 'rpc_read_agreement_messages_page_v2', privateArgs(who, id));
const privateSend = (who, id, body) => call(who, 'rpc_send_agreement_message_v2', {
  p_expected_user_id: who.id, p_agreement_id: id, p_client_message_id: 'journey-' + randomUUID(), p_body: body});
const readSearch = (who, task) => call(who, 'rpc_get_need_search_state', {p_need_id: task.needId});
const authCount = () => Number(sql('select count(*) from auth.users'));
const catalog = () => sql(catalogDigestSql());
const FACTS = {'need.title': 'Connected lifecycle fixture', 'need.description': 'Isolated product journey with two selected people.',
  'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'], 'need.price_mode': 'OFFERS',
  'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 2, 'need.task_country_code': 'RS',
  'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}};
const WORKER = {skills: ['fizicki poslovi'], tools: [], vehicles: [], licenses: [], radiusKm: 15};
let beforeCertificate, beforeCatalog;
write();
try {
  assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)));
  beforeCertificate = fx.closureState(); beforeCatalog = catalog();
  assert.equal(beforeCertificate.ready, true);
  assert.equal(beforeCertificate.live, beforeCertificate.certified);
  assert.equal(beforeCertificate.live, beforeCertificate.erasure);
  assert.equal(beforeCertificate.live, beforeCertificate.binding);
  report.schedulers = fx.pauseSchedulers(); // Isolated cron only; never park or suspend background workers.
  const beforeAuth = authCount();
  const R = await fx.createRequester({label: 'connected-r'});
  const A = await fx.createWorker({...WORKER, label: 'connected-a'});
  const B = await fx.createWorker({...WORKER, label: 'connected-b'});
  const C = await fx.createWorker({...WORKER, label: 'connected-c'});
  assert.equal(new Set([R.id, A.id, B.id, C.id]).size, 4);
  assert.equal(authCount() - beforeAuth, 4); assert.equal(fx.authStats().retries, 0);
  report.population = {scenarioAuthAccounts: 4, existingBootstrapAuthAccounts: beforeAuth, taskCount: 1};
  pass('FOUR_DISTINCT_AUTH_ACTORS_NO_AUTH_RETRY');

  const made = await fx.createNeedFromFacts(R, FACTS);
  assert.equal(made.materialisation, 'PRODUCT_PATH'); assert.deepEqual(made.droppedFacts, []);
  const back = fx.readBackNeed(made.needId, made.intent); assert.deepEqual(back.mismatches, []);
  const task = {needId: made.needId, needRevision: Number(back.row.revision)};
  const apply = async person => {
    const response = await fx.submitApplication(person, task, {price: 3000, scopeNote: 'PRIVATE_TERMS_ONLY'});
    assert.equal(response.ok, true, 'APPLICATION_REFUSED:' + response.error?.message); return response.data;
  };
  const aa = await apply(A), ab = await apply(B);
  const aid = await fx.selectResponse(R, task, aa);
  assert.equal(state(task.needId).covered, 1); assert.equal((await group(A, aid)).available, false);
  const p1 = await privateSend(R, aid, 'PRIVATE_NOT_GROUP_HISTORY');
  const readAt = () => sql(`select coalesce(read_at::text,'UNREAD') from public.user_activity_events
    where dedupe_key=${q('agreement_message:' + p1)} and recipient_user_id=${q(A.id)}::uuid`);
  assert.equal(readAt(), 'UNREAD');
  assert.ok(ids(await privatePage(A, aid)).includes(p1));
  const exact = await call(A, 'rpc_read_agreement_message_window_v2', {p_expected_user_id: A.id,
    p_agreement_id: aid, p_target_message_id: p1, p_before_count: 10, p_after_count: 10});
  assert.ok(ids(exact).includes(p1)); assert.equal(readAt(), 'UNREAD');
  await denied(B, 'rpc_read_agreement_message_window_v2', {p_expected_user_id: B.id,
    p_agreement_id: aid, p_target_message_id: p1, p_before_count: 10, p_after_count: 10}, 'MEDIA_NOT_FOUND');
  const ack = await call(A, 'rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: A.id,
    p_agreement_id: aid, p_message_ids: [p1]});
  assert.equal(ack.markedEventCount, 1); assert.notEqual(readAt(), 'UNREAD');
  await denied(B, 'rpc_read_agreement_messages_page_v2', privateArgs(B, aid), 'MEDIA_NOT_FOUND');
  await denied(C, 'rpc_read_agreement_messages_page_v2', privateArgs(C, aid), 'MEDIA_NOT_FOUND');
  const bid = await fx.selectResponse(R, task, ab);
  assert.notEqual(aid, bid); assert.equal(state(task.needId).covered, 2); assert.equal(state(task.needId).status, 'ACTIVE');
  const initial = await group(A, aid), gid = initial.group.groupId;
  assert.equal(initial.group.members.length, 3); assert.equal((await group(B, bid)).group.groupId, gid);
  const management = await group(R, aid);
  assert.equal(management.group.management.length, 2);
  assert.ok(!JSON.stringify(initial).includes('PRIVATE_TERMS_ONLY'));
  assert.deepEqual(ids(await groupPage(R, gid)), []);
  pass('PRODUCT_PUBLICATION_TWO_SELECTIONS_ONE_GROUP_PRIVATE_TERMS_HIDDEN');

  const g1Args = groupArgs(A, gid, 'G1 before cancellation');
  const g1 = await call(A, 'rpc_send_group_message_v5', g1Args);
  assert.equal((await call(A, 'rpc_send_group_message_v5', g1Args)).messageId, g1.messageId);
  await denied(A, 'rpc_send_group_message_v5', {...g1Args, p_body: 'Different body'}, 'GROUP_MESSAGE_KEY_REUSED');
  assert.deepEqual(ids(await groupPage(B, gid)), [g1.messageId]);
  await denied(C, 'rpc_read_group_messages_v5', {p_expected_user_id: C.id, p_group_id: gid, p_after_sequence: null, p_before_sequence: null}, 'GROUP_NOT_AVAILABLE');
  const unread = (await group(R, aid)).group.unreadCount;
  assert.deepEqual(ids(await groupPage(R, gid)), [g1.messageId]);
  assert.equal((await group(R, aid)).group.unreadCount, unread);
  const mark = await call(R, 'rpc_mark_group_messages_read_v5', {p_expected_user_id: R.id, p_group_id: gid, p_message_ids: [g1.messageId]});
  assert.equal(mark.markedCount, 1); assert.equal((await group(R, aid)).group.unreadCount, unread - 1);
  pass('GROUP_VISIBILITY_REPLAY_AND_EXPLICIT_READ_ACK');

  const otherBefore = fingerprint(bid);
  await call(A, 'rpc_cancel_agreement', {p_agreement_id: aid, p_reason: 'Isolated lifecycle proof'});
  assert.equal(fingerprint(bid), otherBefore); assert.equal(state(task.needId).covered, 1); assert.equal(state(task.needId).status, 'SELECTION');
  const g2 = await call(R, 'rpc_send_group_message_v5', groupArgs(R, gid, 'G2 after cancellation'));
  assert.deepEqual(ids(await groupPage(A, gid)), [g1.messageId]);
  assert.equal((await group(A, aid)).group.canSend, false);
  await denied(A, 'rpc_send_group_message_v5', groupArgs(A, gid, 'No longer allowed'), 'GROUP_READ_ONLY');
  assert.equal((await call(A, 'rpc_send_group_message_v5', g1Args)).messageId, g1.messageId);
  assert.deepEqual(ids(await groupPage(B, gid)), [g1.messageId, g2.messageId]);
  pass('CANCELLATION_PRESERVES_OTHER_AGREEMENT_AND_REVOKES_FUTURE_GROUP_VISIBILITY');

  const search = await readSearch(R, task);
  await call(R, 'rpc_close_remaining_search', {p_need_id: task.needId, p_expected_revision: search.revision,
    p_client_request_id: 'close-' + randomUUID(), p_reason: 'Isolated journey'});
  const closed = await readSearch(R, task);
  assert.equal(closed.searchAuthority, 'CLOSED'); assert.equal(closed.missingSlots, 1); assert.equal(closed.canReopen, true);
  assert.ok(closed.closedAt);
  const reopen = {p_need_id: task.needId, p_expected_revision: closed.revision, p_expected_closed_at: closed.closedAt,
    p_client_request_id: 'reopen-' + randomUUID(), p_reason: 'Isolated journey'};
  await denied(C, 'rpc_get_need_search_state', {p_need_id: task.needId}, 'NEED_NOT_FOUND');
  await denied(C, 'rpc_reopen_remaining_search', reopen, 'NEED_NOT_OWNED');
  await denied(R, 'rpc_reopen_remaining_search', {...reopen, p_expected_revision: closed.revision + 1}, 'STALE_REVIEW_REQUIRED');
  await denied(R, 'rpc_reopen_remaining_search', {...reopen, p_expected_closed_at: '2020-01-01T00:00:00Z'}, 'STALE_SEARCH_STATE');
  assert.equal((await readSearch(R, task)).closedAt, closed.closedAt);
  const opened = await call(R, 'rpc_reopen_remaining_search', reopen);
  assert.equal(opened.reopenedRemainingSlots, 1);
  assert.equal(opened.idempotentReplay, false);
  assert.deepEqual(await call(R, 'rpc_reopen_remaining_search', reopen), {...opened, idempotentReplay: true});
  assert.equal((await readSearch(R, task)).searchAuthority, 'OPEN');
  pass('OWNER_ONLY_CLOSE_REOPEN_EXACT_REVISION_AND_CLOSURE_WITNESS');

  const cid = await fx.selectResponse(R, task, await apply(C));
  assert.equal(state(task.needId).covered, 2); assert.equal((await group(C, cid)).group.groupId, gid);
  assert.deepEqual(ids(await groupPage(C, gid)), []);
  const g3 = await call(R, 'rpc_send_group_message_v5', groupArgs(R, gid, 'G3 after replacement'));
  assert.deepEqual(ids(await groupPage(C, gid)), [g3.messageId]);
  assert.deepEqual(ids(await groupPage(A, gid)), [g1.messageId]);
  assert.deepEqual(ids(await groupPage(B, gid)), [g1.messageId, g2.messageId, g3.messageId]);
  const p3 = await privateSend(C, cid, 'Replacement private message');
  assert.ok(ids(await privatePage(R, cid)).includes(p3));
  for (const who of [A, B]) await denied(who, 'rpc_read_agreement_messages_page_v2', privateArgs(who, cid), 'MEDIA_NOT_FOUND');
  pass('REPLACEMENT_SAME_GROUP_NO_HISTORY_BACKFILL_PRIVATE_TO_REQUESTER_ONLY');
  assert.deepEqual(fx.closureState(), beforeCertificate); assert.equal(catalog(), beforeCatalog);
  report.certificate = {unchanged: true, ready: true, digest: beforeCertificate.live};
  report.catalogUnchanged = true; report.auth = fx.authStats(); report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL'; report.failure = String(error?.message ?? error).replace(/eyJ[A-Za-z0-9._-]+/g, '<jwt>').slice(0, 1500);
  process.exitCode = 1;
} finally {
  // No fixture deletion, mass deactivation or session sign-out. Workflow always discards the whole disposable stack.
  report.auth = fx.authStats(); write(); console.log(report.result + ' CONNECTED_FOUR_ACTORS');
}
