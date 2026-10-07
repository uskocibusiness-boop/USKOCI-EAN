// CANCEL-INFO + PROFILE-TRUST disposable behaviour proof: real Auth, real PostgREST, real database; loopback only. Never DEV.
//
//   SEED      14 real accounts (6 workers with 0, 3, 4, 5, 12 and 9 Dogovori, 8 requesters) through the product writers: application, selection,
//             "gotovo" + confirmation, cancellation by either side (normal, while blocked, after "gotovo", a 2,100-character reason), star reviews,
//             blocks; plus labelled bypasses for what a closure leaves behind (a deleted event, a replaced message text), a moderated comment,
//             another world, a suspended profile and a closure restriction.
//   BEFORE    the four RPCs do not exist (PostgREST PGRST202): FAIL.
//   REFUSALS  drift, wrong order and revert-before-apply are refused atomically (catalog and certificate unchanged).
//   APPLY     CANCEL-INFO then PROFILE-TRUST: exactly the new functions and the two config rows, metadata and ACL as designed, certificate unchanged.
//   AFTER     truth tables (cancellation facts, WORK_TRUST_V1), visibility in both modes + fail-closed rows, gates, D12 + A09 rules against the DEV
//             D12 reader, keyset paging, clamps, validation, anonymous and cross-account denial, grants, no 40001, timing.
//   REVERT    exact: catalog, config rows and certificate as before; the RPCs are gone again (FAIL again).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as rtModule from '../pre_v3/closure_runtime.mjs';
import {createFixtures, weeklyRule} from '../ex06/lib/fixtures.mjs';
import {assert, sql, rows, q, randomUUID, env, CI, PT, ciManifest, ptManifest, md5, out, run, psqlFile, refused, asAccount, asAccountValue,
  catalog, functionCount, closure, conflicts40001, applied, absent, makeReport, stripVolatile, firstDifference} from './lib.mjs';

const {ok} = rtModule;
const {report, write, pass, fail, check, bypass} = makeReport('CANCEL_INFO_AND_PROFILE_TRUST', 'report.json');
const surface = JSON.parse(fs.readFileSync(path.join(out, 'surface-report.json'), 'utf8'));
assert.equal(surface.result, 'PASS');
assert.equal(surface.d12.surface, 'VIEW_FIXTURE', 'this proof writes fixture comments into the read-equivalent D12 surface of surface.mjs');
const COMMENTS = surface.d12.base;
const PREFIX = 'Otkazujem Dogovor. Razlog: ';
const RPC = {cancel: 'rpc_agreement_cancellation_v1', trust: 'rpc_public_work_trust_v1', stats: 'rpc_my_work_stats_v1', reviews: 'rpc_list_received_reviews_v1'};
const sha256 = text => createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------- PostgREST helpers
async function call(account, name, args = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await account.client.rpc(name, args);
      return r.error ? {ok: false, error: {code: r.error.code, message: r.error.message}} : {ok: true, data: r.data};
    } catch (error) {   // a transport hiccup (fetch failed) of an idempotent read is retried, never a refusal
      if (attempt >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}
const okCall = async (account, name, args) => { const r = await call(account, name, args); assert.ok(r.ok, `RPC_FAILED ${name}: ${JSON.stringify(r.error)}`); return r.data; };
const anonCall = async (name, args = {}) => { const r = await rtModule.anon.rpc(name, args); return r.error ? {ok: false, error: {code: r.error.code, message: r.error.message}} : {ok: true, data: r.data}; };

const fx = createFixtures(rtModule, {needPath: 'direct'});
const allDays = () => [weeklyRule(randomUUID(), {weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '24:00', label: 'PT svaki dan'})];
const skill = 'pt-' + randomUUID().slice(0, 8);
const outcomes = new Map();   // worker label -> counts the proof expects, kept while seeding (the oracle)
const outcome = (w, key, n = 1) => { const o = outcomes.get(w.label); o[key] += n; };

async function worker(label, displayName) {
  const w = await fx.createWorker({label, displayName, skills: [skill], radiusKm: 50, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: allDays(), windows: []}});
  outcomes.set(label, {sent: 0, agreed: 0, completed: 0, active: 0, byWorker: 0, byRequester: 0, unknown: 0});
  return w;
}
async function requester(label, displayName) {
  const r = await fx.createRequester({label});
  sql(`begin; set local session_replication_role = replica; update public.app_profiles set display_name = ${q(displayName)} where id = ${q(r.profileId)}::uuid; commit;`);
  return {...r, displayName};
}
async function task(requesterAccount, label) {
  return fx.createNeedFromFacts(requesterAccount, {'need.title': 'PT zadatak ' + label, 'need.description': 'Sinteticki zadatak PROFILE-TRUST dokaza na jednokratnoj bazi.',
    'need.category': 'PT dokaz', 'need.required_skills': [skill], 'need.required_tools': [], 'need.required_vehicles': [], 'need.minimum_experience_years': 0,
    'need.people_needed': 1, 'need.schedule_kind': 'FLEXIBLE', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}},
    'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS'}, {path: 'direct'});
}
async function apply(w, need) {
  const a = await fx.submitApplication(w, need, {price: 3000});
  assert.ok(a.ok, 'APPLICATION_REFUSED:' + JSON.stringify(a.error));
  outcome(w, 'sent');
  return a.data;
}
async function agreement(r, w, label) {
  const need = await task(r, label);
  const application = await apply(w, need);
  const id = await fx.selectResponse(r, need, application);
  assert.match(String(id), /^[0-9a-f-]{36}$/);
  outcome(w, 'agreed'); outcome(w, 'active');
  return {id, needId: need.needId, requester: r, worker: w, label};
}
async function complete(a) {
  await okCall(a.worker, 'rpc_mark_work_done', {p_agreement_id: a.id});
  await okCall(a.requester, 'rpc_confirm_completion', {p_agreement_id: a.id});
  outcome(a.worker, 'active', -1); outcome(a.worker, 'completed');
}
async function cancel(a, by, reason, {side = by === a.worker ? 'byWorker' : 'byRequester'} = {}) {
  await okCall(by, 'rpc_cancel_agreement', {p_agreement_id: a.id, p_reason: reason});
  outcome(a.worker, 'active', -1); outcome(a.worker, side);
}
async function review(reviewer, a, target, rating, tags) {
  return okCall(reviewer, 'rpc_submit_agreement_review', {p_agreement_id: a.id, p_target_account_id: target.id, p_rating: rating, p_tags: tags, p_client_request_id: randomUUID()});
}
async function block(who, target, blocked = true) {
  const state = await okCall(who, 'rpc_get_account_block', {p_target_account_id: target.id});
  return okCall(who, 'rpc_set_account_block', {p_target_account_id: target.id, p_blocked: blocked, p_expected_revision: state.revision, p_client_request_id: randomUUID()});
}
function comment(reviewId, text) {
  const rv = rows(`select reviewer_account_id, target_account_id, created_at from private.agreement_reviews where id = ${q(reviewId)}::uuid`)[0];
  sql(`insert into ${COMMENTS} (review_id, author_account_id, target_account_id, comment, comment_sha256, created_at)
       values (${q(reviewId)}::uuid, ${q(rv.reviewer_account_id)}::uuid, ${q(rv.target_account_id)}::uuid, ${q(text)}, ${q(sha256(text))}, ${q(rv.created_at)}::timestamptz)`);
}
const updatedAt = id => sql(`select to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US') from public.agreements where id = ${q(id)}::uuid`);
const isoToUtcMicro = iso => { const d = new Date(iso); const micro = String(iso).match(/\.(\d+)/)?.[1]?.padEnd(6, '0').slice(0, 6) ?? '000000';
  return d.toISOString().slice(0, 19) + '.' + micro; };
function deleteCancellationEvent(id, why) {
  sql(`delete from public.user_activity_events where dedupe_key = ${q('agreement-cancelled:' + id)}`);
  bypass('public.user_activity_events: deleted the AGREEMENT_CANCELLED event of one Dogovor', why);
}
function redactReasonMessage(id, why) {
  sql(`begin; set local session_replication_role = replica;
    update public.agreement_messages set body = ${q('Sadr' + String.fromCharCode(382) + 'aj uklonjen pri zatvaranju naloga.')}
     where agreement_id = ${q(id)}::uuid and left(body, 27) = ${q(PREFIX)}; commit;`);
  bypass('public.agreement_messages: replaced the reason text the way the closure patch does (triggers off)', why);
}

// ---------------------------------------------------------------- the run
let baseCatalog = null, baseClosure = null, state = 'BASE';
const ids = {};
try {
  fx.pauseSchedulers();
  baseCatalog = catalog(); baseClosure = closure();
  const base40001 = conflicts40001();
  assert.equal(baseClosure.ready, true);
  assert.ok(absent(ciManifest) && absent(ptManifest), 'NEW_FUNCTIONS_ALREADY_PRESENT');
  report.observations.chain = fx.chainCounts(); report.observations.surface = surface; write();
  pass('PT_CHAIN_READY_CERTIFICATE_READY_DEPENDENCIES_ARE_THE_DEV_BODIES', {certificate: baseClosure.certificate, dependencies: surface.dependencies.map(d => d.state)});

  // ------------------------------------------------------------ SEED
  const W = {w0: await worker('pt-w0', 'PT Nula'), w3: await worker('pt-w3', 'PT Tri'), w4: await worker('pt-w4', 'PT Cetiri'), w5: await worker('pt-w5', 'PT Pet'),
    w12: await worker('pt-w12', 'PT Dvanaest'), w5r: await worker('pt-w5r', 'PT Pet R'), wu: await worker('pt-wu', 'PT Nepoznat')};
  const R = {ra: await requester('pt-ra', 'PT Ana'), rb: await requester('pt-rb', 'PT Boris'), rc: await requester('pt-rc', 'PT Ceca'), rd: await requester('pt-rd', 'PT Dejan'),
    re: await requester('pt-re', 'PT Ema'), rf: await requester('pt-rf', 'PT Filip'), rg: await requester('pt-rg', 'PT Goran'), ru: await requester('pt-ru', 'PT Uros')};
  sql(`begin; set local session_replication_role = replica; update public.app_profiles set avatar_path = ${q(R.ra.id + '/avatar.jpg')} where id = ${q(R.ra.profileId)}::uuid; commit;`);
  bypass('app_profiles.display_name / avatar_path of the requester fixtures', 'a visible face must be distinguishable from a masked one');

  // W3: 2 completed + 1 cancelled by the worker -> 3 qualifying: no percentage
  const w3 = [];
  for (let i = 0; i < 3; i++) w3.push(await agreement(R.ra, W.w3, 'w3-' + i));
  await complete(w3[0]); await complete(w3[1]);
  await cancel(w3[2], W.w3, 'Ne mogu da dodjem tog dana.');
  ids.c2 = w3[2].id;
  // W4: 4 completed -> 4 qualifying: no percentage (the boundary below 5)
  for (let i = 0; i < 4; i++) await complete(await agreement(R.ra, W.w4, 'w4-' + i));
  // W5: 4 completed + 1 cancelled by the worker AFTER saying "gotovo" -> 5 qualifying: 80
  const w5 = [];
  for (let i = 0; i < 5; i++) w5.push(await agreement(R.ra, W.w5, 'w5-' + i));
  for (let i = 0; i < 4; i++) await complete(w5[i]);
  await okCall(W.w5, 'rpc_mark_work_done', {p_agreement_id: w5[4].id});
  await cancel(w5[4], W.w5, 'Ipak ne mogu da zavrsim.');
  ids.c8 = w5[4].id;
  // W5R: 5 completed + 2 cancelled by the requester -> 5 qualifying: 100 (a requester's cancellation never counts against the worker)
  const w5r = [];
  for (let i = 0; i < 7; i++) w5r.push(await agreement(R.ra, W.w5r, 'w5r-' + i));
  for (let i = 0; i < 5; i++) await complete(w5r[i]);
  await cancel(w5r[5], R.ra, 'Vise mi ne treba.');
  await cancel(w5r[6], R.ra, 'Nasao sam nekog drugog.');
  redactReasonMessage(w5r[6].id, 'C5: the canceller closed the account, the reason text is replaced');
  ids.c5 = w5r[6].id;
  // W12: 9 completed (reviewed by 7 requesters), 1 cancelled by the worker (a 2,100-character reason), 1 by the requester, 1 open, plus 2 more applications
  const w12 = [];
  for (const [i, r] of [R.ra, R.ra, R.ra, R.rb, R.rc, R.rd, R.re, R.rf, R.rg, R.ra, R.ra, R.ra].entries()) w12.push(await agreement(r, W.w12, 'w12-' + (i + 1)));
  for (let i = 0; i < 9; i++) await complete(w12[i]);
  const longReason = 'Duzi razlog. '.repeat(170).slice(0, 2100);
  await cancel(w12[9], W.w12, longReason);
  await cancel(w12[10], R.ra, 'Promenio sam plan.');
  ids.c9 = w12[9].id; ids.c1 = w12[10].id; ids.open = w12[11].id;
  const pendingNeed = await task(R.ra, 'w12-pending');
  await apply(W.w12, pendingNeed);
  const withdrawnNeed = await task(R.ra, 'w12-withdrawn');
  const withdrawn = await apply(W.w12, withdrawnNeed);
  await fx.withdrawApplication(W.w12, withdrawn, {reason: 'PT dokaz'});
  // WU: 5 completed + four cancellations whose facts were partly removed later
  const wu = [];
  for (let i = 0; i < 9; i++) wu.push(await agreement(R.ru, W.wu, 'wu-' + i));
  for (let i = 0; i < 5; i++) await complete(wu[i]);
  await block(R.ru, W.wu, true);
  await cancel(wu[5], W.wu, 'Otkazujem dok je blokirano.');            // C3: blocked at that moment, no reason message
  await block(R.ru, W.wu, false);
  await cancel(wu[6], W.wu, 'Obican razlog radnika.');                  // C4: the event is deleted later, the side comes from the message
  await cancel(wu[7], R.ru, 'Obican razlog narucioca.');               // C6: event deleted and message replaced, the side still comes from the message
  await block(R.ru, W.wu, true);
  await cancel(wu[8], W.wu, 'I ovaj dok je blokirano.', {side: 'unknown'});   // C7: blocked, then the event is deleted: the side is not recorded any more
  await block(R.ru, W.wu, false);
  deleteCancellationEvent(wu[6].id, 'C4: the recipient (requester) closed the account; a closure deletes the closing recipient\'s events');
  deleteCancellationEvent(wu[7].id, 'C6: as C4 for the worker as recipient');
  redactReasonMessage(wu[7].id, 'C6: the canceller (requester) closed the account as well');
  deleteCancellationEvent(wu[8].id, 'C7: blocked at the cancellation (no message) and the recipient closed later');
  ids.c3 = wu[5].id; ids.c4 = wu[6].id; ids.c6 = wu[7].id; ids.c7 = wu[8].id;

  // reviews received by W12, then the states D12 and A09 speak about
  const rv = {};
  rv.r1 = (await review(R.ra, w12[0], W.w12, 5, ['RELIABLE', 'ON_TIME'])).reviewId; comment(rv.r1, 'Odlican posao, sve po dogovoru.');
  rv.r2 = (await review(R.ra, w12[1], W.w12, 4, [])).reviewId;                                  // star-only
  rv.r4 = (await review(R.rb, w12[3], W.w12, 2, ['AS_AGREED'])).reviewId; comment(rv.r4, 'Kasnio je sat vremena.');
  rv.r5 = (await review(R.rc, w12[4], W.w12, 3, [])).reviewId; comment(rv.r5, 'Solidno.');
  rv.r6 = (await review(R.rd, w12[5], W.w12, 1, [])).reviewId; comment(rv.r6, 'Komentar koji je moderacija sakrila.');
  rv.r7 = (await review(R.re, w12[6], W.w12, 5, ['CAREFUL'])).reviewId; comment(rv.r7, 'Sve pohvale.');
  rv.r8 = (await review(R.rf, w12[7], W.w12, 4, [])).reviewId; comment(rv.r8, 'Dobro.');
  rv.r9 = (await review(R.rg, w12[8], W.w12, 5, ['RESPECTFUL'])).reviewId; comment(rv.r9, 'Preporucujem.');
  const back = (await review(W.w12, w12[0], R.ra, 5, ['CLEAR_COMMUNICATION'])).reviewId; comment(back, 'Jasan dogovor.');
  bypass(`${COMMENTS}: 9 written comments inserted as the owner`, 'D12 is not replayed by this chain; the comments are written exactly as rpc_submit_agreement_review_v2 stores them (sha256, created_at of the review)');
  await block(R.rb, W.w12, true);                                                                // A09: the AUTHOR blocked the reviewed person
  await block(W.w12, R.rc, true);                                                                // the reviewed person blocked the author
  sql(`update ${COMMENTS} set hidden_at = statement_timestamp(), hidden_reason_code = 'ABUSE_REPORT' where review_id = ${q(rv.r6)}::uuid`);
  bypass('a comment hidden by moderation (hidden_at)', 'the audited service-role HIDE of D12 is not on this chain');
  await fx.admitTestWorld(R.re.id);                                                              // another world
  sql(`begin; set local session_replication_role = replica; update public.app_profiles set profile_status = 'SUSPENDED' where id = ${q(R.rf.profileId)}::uuid; commit;`);
  sql(`insert into private.account_closure_requests(account_id, state, revision) values (${q(R.rg.id)}::uuid, 'READY', 1)`);
  bypass('RF requester profile SUSPENDED and RG under a closure restriction (READY request)', 'D12 hides a non-ACTIVE or closure-restricted author');
  report.observations.seed = {workers: Object.keys(W).length, requesters: Object.keys(R).length, outcomes: Object.fromEntries(outcomes),
    agreements: Number(sql(`select count(*) from public.agreements where worker_account_id = any(array[${Object.values(W).map(w => q(w.id) + '::uuid').join(',')}])`)),
    reviewsOfW12: Number(sql(`select count(*) from private.agreement_reviews where target_account_id = ${q(W.w12.id)}::uuid`)), auth: fx.authStats()};
  write();
  check('PT_SEEDED_WORKERS_0_3_4_5_7_9_12_DOGOVORI_CANCELLATIONS_REVIEWS_BLOCKS', report.observations.seed.agreements === 3 + 4 + 5 + 7 + 12 + 9 && report.observations.seed.reviewsOfW12 === 8,
    report.observations.seed);

  // ------------------------------------------------------------ BEFORE: the RPCs do not exist
  const before = {};
  before.cancel = await call(R.ra, RPC.cancel, {p_agreement_ids: [ids.c1]});
  before.trust = await call(R.ra, RPC.trust, {p_profile_id: W.w12.profileId});
  before.stats = await call(W.w12, RPC.stats, {});
  before.reviews = await call(W.w12, RPC.reviews, {p_limit: 20, p_after: null});
  check('PT_BEFORE_THE_FOUR_RPCS_DO_NOT_EXIST_FAIL', Object.values(before).every(r => !r.ok && r.error.code === 'PGRST202'), before);

  // ------------------------------------------------------------ REFUSALS leave nothing behind
  const ciCandidate = fs.readFileSync(CI + 'candidate.sql', 'utf8'), ptCandidate = fs.readFileSync(PT + 'candidate.sql', 'utf8');
  const ciRevert = fs.readFileSync(CI + 'revert.sql', 'utf8'), ptRevert = fs.readFileSync(PT + 'revert.sql', 'utf8');
  refused(ciCandidate.replaceAll(ciManifest.dependencyPins[0].body_md5, '0'.repeat(32)), 'CANCEL_INFO_DEPENDENCY_DRIFT');
  refused(ciCandidate.replaceAll(ciManifest.newFunctions[1].body_md5, '0'.repeat(32)), 'CANCEL_INFO_NEW_FUNCTION_DRIFT');
  refused(ciRevert, 'CANCEL_INFO_REVERT_PREIMAGE_DRIFT');
  refused(ptCandidate, 'PROFILE_TRUST_REQUIRES_CANCEL_INFO');
  refused(ptRevert, 'PROFILE_TRUST_REVERT_PREIMAGE_DRIFT');
  assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure);
  pass('PT_DRIFT_ORDER_AND_REVERT_BEFORE_APPLY_REFUSALS_ARE_ATOMIC', {catalogUnchanged: true, certificateUnchanged: true});

  // ------------------------------------------------------------ APPLY CANCEL-INFO
  const fnBefore = functionCount();
  psqlFile(CI + 'candidate.sql'); state = 'CANCEL_INFO';
  assert.ok(applied(ciManifest)); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  assert.equal(functionCount(), fnBefore + 2);
  refused(ciCandidate, 'CANCEL_INFO_ALREADY_OR_PARTIALLY_APPLIED');
  const ciCatalog = catalog();
  pass('CI_APPLIED_TWO_NEW_FUNCTIONS_CERTIFICATE_UNCHANGED_NO_NEW_40001_REPEAT_REFUSED');
  // ------------------------------------------------------------ APPLY PROFILE-TRUST
  refused(ptCandidate.replaceAll(ptManifest.dependencyPins[0].body_md5, '0'.repeat(32)), 'PROFILE_TRUST_DEPENDENCY_DRIFT');
  assert.equal(catalog(), ciCatalog);
  psqlFile(PT + 'candidate.sql'); state = 'BOTH';
  assert.ok(applied(ptManifest)); assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  assert.equal(functionCount(), fnBefore + 8);
  refused(ptCandidate, 'PROFILE_TRUST_ALREADY_OR_PARTIALLY_APPLIED');
  refused(ciRevert, 'CANCEL_INFO_REVERT_BLOCKED_BY_PROFILE_TRUST');
  const configRows = rows(`select key, value from private.marketplace_config where key in ('profile_trust_visibility','received_reviews_detail') order by key`);
  check('PT_APPLIED_SIX_NEW_FUNCTIONS_TWO_CONFIG_ROWS_AT_THE_PRIVACY_DEFAULTS_CERTIFICATE_UNCHANGED',
    configRows.length === 2 && configRows[0].value.mode === 'OWN_ONLY' && configRows[1].value.mode === 'COMMENTED_ONLY', {configRows, certificate: baseClosure.certificate});
  await fx.reloadSchema();

  // ------------------------------------------------------------ grants and metadata
  const SIGS = [...ciManifest.newFunctions, ...ptManifest.newFunctions];
  const grants = rows(`select x.sig, p.prosecdef, p.provolatile, p.proconfig, p.proacl::text as acl,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role, has_function_privilege('public', p.oid, 'EXECUTE') as public
    from unnest(array[${SIGS.map(f => q(f.signature)).join(',')}]) x(sig) join pg_proc p on p.oid = to_regprocedure(x.sig)`);
  check('PT_GRANTS_PUBLIC_RPCS_AUTHENTICATED_ONLY_PRIVATE_HELPERS_OWNER_ONLY_ALL_DEFINER_STABLE_FIXED_SEARCH_PATH',
    grants.length === SIGS.length && grants.every(g => g.prosecdef && g.provolatile === 's' && JSON.stringify(g.proconfig) === '["search_path=pg_catalog"]' && !g.anon && !g.public && !g.service_role
      && g.authenticated === g.sig.startsWith('public.')), grants);

  // ------------------------------------------------------------ CANCEL-INFO truth table
  const mine = async (account, list) => (await okCall(account, RPC.cancel, {p_agreement_ids: list})).items;
  const one = async (account, id) => (await mine(account, [id]))[0];
  const helper = id => JSON.parse(sql(`select private.agreement_cancellation_facts_v1(${q(id)}::uuid)::text`));
  const cases = [
    {name: 'C1_REQUESTER_CANCELS', id: ids.c1, party: R.ra, other: W.w12, by: 'REQUESTER', byMe: true, reason: 'Promenio sam plan.', state: 'KEPT', source: 'EVENT'},
    {name: 'C2_WORKER_CANCELS', id: ids.c2, party: W.w3, other: R.ra, by: 'WORKER', byMe: true, reason: 'Ne mogu da dodjem tog dana.', state: 'KEPT', source: 'EVENT'},
    {name: 'C3_WORKER_CANCELS_WHILE_BLOCKED_NO_REASON_KEPT', id: ids.c3, party: W.wu, other: R.ru, by: 'WORKER', byMe: true, reason: null, state: 'NOT_KEPT', source: 'EVENT'},
    {name: 'C4_EVENT_GONE_SIDE_FROM_THE_MESSAGE', id: ids.c4, party: W.wu, other: R.ru, by: 'WORKER', byMe: true, reason: 'Obican razlog radnika.', state: 'KEPT', source: 'MESSAGE'},
    {name: 'C5_REASON_TEXT_REPLACED_AT_CLOSURE', id: ids.c5, party: R.ra, other: W.w5r, by: 'REQUESTER', byMe: true, reason: null, state: 'REMOVED', source: 'EVENT'},
    {name: 'C6_EVENT_GONE_AND_TEXT_REPLACED_SIDE_STILL_KNOWN', id: ids.c6, party: R.ru, other: W.wu, by: 'REQUESTER', byMe: true, reason: null, state: 'REMOVED', source: 'MESSAGE'},
    {name: 'C7_NOTHING_LEFT_SIDE_UNKNOWN_NEVER_GUESSED', id: ids.c7, party: W.wu, other: R.ru, by: null, byMe: null, reason: null, state: 'NOT_KEPT', source: null},
    {name: 'C8_WORKER_CANCELS_AFTER_SAYING_GOTOVO', id: ids.c8, party: W.w5, other: R.ra, by: 'WORKER', byMe: true, reason: 'Ipak ne mogu da zavrsim.', state: 'KEPT', source: 'EVENT'},
    {name: 'C9_LONG_REASON_KEPT_TO_ITS_STORED_LENGTH', id: ids.c9, party: W.w12, other: R.ra, by: 'WORKER', byMe: true, reason: (PREFIX + longReason.trim()).slice(0, 2000).slice(PREFIX.length), state: 'KEPT', source: 'EVENT'},
  ];
  const truth = [];
  for (const c of cases) {
    const a = await one(c.party, c.id), b = await one(c.other, c.id), h = helper(c.id);
    const good = a && b && a.agreementId === c.id && a.cancelled === true && a.cancelledBy === c.by && a.cancelledByMe === c.byMe
      && b.cancelledByMe === (c.byMe === null ? null : !c.byMe) && a.reason === c.reason && b.reason === c.reason && a.reasonState === c.state
      && h.sideSource === c.source && isoToUtcMicro(a.cancelledAt) === updatedAt(c.id) && JSON.stringify(stripVolatile(a)) === JSON.stringify({...stripVolatile(b), cancelledByMe: a.cancelledByMe});
    const expected = {id: c.id, partyRole: c.party.role, by: c.by, byMe: c.byMe, reason: c.reason === null ? null : c.reason.length > 60 ? c.reason.slice(0, 60) + '...(' + c.reason.length + ')' : c.reason,
      state: c.state, source: c.source};
    truth.push({case: c.name, good, expected, seen: a, sideSource: h.sideSource});
    check('CI_' + c.name, good, {expected, party: a, other: b, sideSource: h.sideSource, updatedAt: updatedAt(c.id)});
  }
  report.observations.cancellationTruthTable = truth; write();
  check('CI_C9_REASON_LENGTH_IS_2000_MINUS_THE_27_CHARACTER_PREFIX', (await one(W.w12, ids.c9)).reason.length === 1973, {length: (await one(W.w12, ids.c9)).reason.length});
  const openItem = await one(W.w12, ids.open);
  check('CI_OPEN_DOGOVOR_IS_NOT_CANCELLED_AND_CARRIES_NO_FACTS', openItem.cancelled === false && openItem.cancelledAt === null && openItem.cancelledBy === null
    && openItem.cancelledByMe === null && openItem.reason === null && openItem.reasonState === null, openItem);
  const batch = await mine(W.w12, [ids.c9, ids.c1, ids.open, ids.c2, randomUUID(), ids.c9]);
  check('CI_BATCH_ORDER_KEPT_DUPLICATES_ONCE_FOREIGN_AND_UNKNOWN_IDS_LEFT_OUT', JSON.stringify(batch.map(x => x.agreementId)) === JSON.stringify([ids.c9, ids.c1, ids.open]), batch.map(x => x.agreementId));
  const outsider = await mine(R.rb, [ids.c1, ids.c2, ids.c9]);
  check('CI_A_THIRD_ACCOUNT_THAT_KNOWS_THE_IDS_SEES_NOTHING', outsider.length === 0, outsider);
  const invalid = {
    empty: await call(W.w12, RPC.cancel, {p_agreement_ids: []}),
    tooMany: await call(W.w12, RPC.cancel, {p_agreement_ids: Array.from({length: 101}, () => randomUUID())}),
    nullElement: await call(W.w12, RPC.cancel, {p_agreement_ids: [ids.c1, null]}),
    nullArray: await call(W.w12, RPC.cancel, {p_agreement_ids: null}),
  };
  const twoDim = asAccount(W.w12.id, `public.rpc_agreement_cancellation_v1(array[array[${q(ids.c1)}::uuid]])`);
  check('CI_INVALID_ID_LISTS_REFUSED_INVALID_AGREEMENT_IDS', Object.values(invalid).every(r => !r.ok && r.error.message === 'INVALID_AGREEMENT_IDS' && r.error.code === '22023')
    && !twoDim.ok && twoDim.error.includes('INVALID_AGREEMENT_IDS'), {invalid, twoDim: twoDim.error?.slice(-200)});
  const anonCancel = await anonCall(RPC.cancel, {p_agreement_ids: [ids.c1]});
  const noClaims = run(`select public.rpc_agreement_cancellation_v1(array[${q(ids.c1)}::uuid])`);
  check('CI_ANONYMOUS_DENIED_AND_A_CALL_WITHOUT_AN_ACCOUNT_IS_AUTH_REQUIRED', !anonCancel.ok && !noClaims.ok && noClaims.error.includes('AUTH_REQUIRED'),
    {anon: anonCancel.error, noClaims: noClaims.error?.slice(-200)});
  const restrictedCancel = asAccount(R.rg.id, `public.rpc_agreement_cancellation_v1(array[${q(w12[8].id)}::uuid])`);
  const restrictedHttp = await call(R.rg, RPC.cancel, {p_agreement_ids: [w12[8].id]});
  check('CI_A_CLOSURE_RESTRICTED_CALLER_IS_ACCOUNT_CLOSING_IN_SQL_AND_THROUGH_POSTGREST',
    !restrictedCancel.ok && restrictedCancel.error.includes('ACCOUNT_CLOSING') && !restrictedHttp.ok && restrictedHttp.error.message === 'ACCOUNT_CLOSING', {sql: restrictedCancel.error?.slice(-200), http: restrictedHttp.error});

  // ------------------------------------------------------------ PROFILE-TRUST: WORK_TRUST_V1 truth table (own stats) against the seeding oracle
  const expectedPercent = o => (o.completed + o.byWorker >= 5 ? Math.floor(100 * o.completed / (o.completed + o.byWorker)) : null);
  const statsTable = [];
  for (const [key, w] of Object.entries(W)) {
    const o = outcomes.get(w.label), s = await okCall(w, RPC.stats, {});
    const good = s.hasWorkerProfile === true && s.profileId === w.profileId && s.applicationsSent === o.sent && s.agreementsMade === o.agreed && s.agreementsCompleted === o.completed
      && s.agreementsActive === o.active && s.cancelledByMe === o.byWorker && s.cancelledByRequester === o.byRequester && s.cancelledSideUnknown === o.unknown
      && s.reliabilityPercent === expectedPercent(o) && s.reliabilityState === (expectedPercent(o) === null ? 'TOO_FEW' : 'AVAILABLE') && s.reliabilityMinimum === 5
      && /^[0-9]{4}-[0-9]{2}-01$/.test(s.memberSince) && s.definition === 'WORK_TRUST_V1';
    statsTable.push({worker: key, expected: {...o, reliabilityPercent: expectedPercent(o)}, got: s, good});
  }
  report.observations.workTrustTruthTable = statsTable.map(r => ({worker: r.worker, expected: r.expected,
    got: (({applicationsSent, agreementsMade, agreementsCompleted, agreementsActive, cancelledByMe, cancelledByRequester, cancelledSideUnknown, reliabilityPercent, reliabilityState}) =>
      ({applicationsSent, agreementsMade, agreementsCompleted, agreementsActive, cancelledByMe, cancelledByRequester, cancelledSideUnknown, reliabilityPercent, reliabilityState}))(r.got), good: r.good}));
  write();
  const percents = Object.fromEntries(statsTable.map(r => [r.worker, r.got.reliabilityPercent]));
  check('PT_WORK_TRUST_V1_TRUTH_TABLE_OWN_STATS_EQUAL_THE_SEEDING_ORACLE', statsTable.every(r => r.good), report.observations.workTrustTruthTable);
  check('PT_RELIABILITY_0_3_4_ARE_NULL_5_IS_80_12_IS_90_REQUESTER_CANCELLATIONS_100_UNKNOWN_SIDE_NOT_COUNTED_71',
    percents.w0 === null && percents.w3 === null && percents.w4 === null && percents.w5 === 80 && percents.w12 === 90 && percents.w5r === 100 && percents.wu === 71, percents);
  const memberSince = w => sql(`select to_char(date_trunc('month', created_at at time zone 'Europe/Belgrade'), 'YYYY-MM-DD') from public.app_profiles where id = ${q(w.profileId)}::uuid`);

  // ------------------------------------------------------------ public trust: OWN_ONLY (default)
  const trustAs = (viewer, w) => call(viewer, RPC.trust, {p_profile_id: w.profileId ?? w});
  const ownOnly = {};
  for (const [key, w] of Object.entries(W)) {
    const other = (await trustAs(R.ra, w)).data, self = (await trustAs(w, w)).data, pub = (await okCall(R.ra, 'rpc_get_public_profile', {p_profile_id: w.profileId}));
    const o = outcomes.get(w.label);
    ownOnly[key] = {other, self, publicProfileCompletedCount: pub.trust.completedCount,
      good: other.completedCount === o.completed && other.completedCount === pub.trust.completedCount && other.agreedCount === null && other.reliabilityPercent === null
        && other.memberSince === null && other.reliabilityState === 'HIDDEN' && other.visibility === 'OWN_ONLY' && other.self === false
        && self.self === true && self.completedCount === o.completed && self.agreedCount === o.agreed && self.reliabilityPercent === expectedPercent(o)
        && self.memberSince === memberSince(w) && self.reliabilityState === (expectedPercent(o) === null ? 'TOO_FEW' : 'AVAILABLE')};
  }
  report.observations.trustOwnOnly = ownOnly; write();
  check('PT_OWN_ONLY_OTHERS_SEE_ONLY_COMPLETED_COUNT_EQUAL_TO_THE_PUBLIC_PROFILE_THE_PERSON_SEES_EVERYTHING', Object.values(ownOnly).every(x => x.good),
    Object.fromEntries(Object.entries(ownOnly).map(([k, v]) => [k, {good: v.good, other: v.other, self: v.self}])));
  // fail closed: a bad or missing row is OWN_ONLY
  const visRow = sql(`select value::text from private.marketplace_config where key = 'profile_trust_visibility'`);
  const hiddenWith = async valueSql => {
    sql(valueSql === null ? `delete from private.marketplace_config where key = 'profile_trust_visibility'`
      : `update private.marketplace_config set value = ${valueSql} where key = 'profile_trust_visibility'`);
    const t = (await trustAs(R.ra, W.w12)).data;
    return t.reliabilityState === 'HIDDEN' && t.visibility === 'OWN_ONLY' && t.reliabilityPercent === null;
  };
  const failClosed = {unknownWord: await hiddenWith(`'{"mode":"EVERYONE"}'::jsonb`), lowerCase: await hiddenWith(`'{"mode":"public"}'::jsonb`),
    jsonString: await hiddenWith(`'"PUBLIC"'::jsonb`), noRow: await hiddenWith(null)};
  sql(`insert into private.marketplace_config(key, value, updated_at) values ('profile_trust_visibility', ${q(visRow)}::jsonb, statement_timestamp())`);
  bypass('private.marketplace_config profile_trust_visibility written to bad values, deleted and restored', 'fail-closed proof');
  check('PT_VISIBILITY_FAILS_CLOSED_UNKNOWN_WORD_LOWER_CASE_WRONG_JSON_TYPE_AND_NO_ROW_ARE_OWN_ONLY', Object.values(failClosed).every(Boolean), failClosed);
  // switch to PUBLIC with the documented script, then back
  refused(fs.readFileSync(PT + 'switch-own-only.sql', 'utf8'), 'PROFILE_TRUST_SWITCH_PROFILE_TRUST_VISIBILITY_UNEXPECTED_STATE');
  psqlFile(PT + 'switch-public.sql');
  const publicMode = {};
  for (const [key, w] of Object.entries(W)) {
    const t = (await trustAs(R.ra, w)).data, o = outcomes.get(w.label);
    publicMode[key] = {t, good: t.visibility === 'PUBLIC' && t.completedCount === o.completed && t.agreedCount === o.agreed && t.reliabilityPercent === expectedPercent(o)
      && t.memberSince === memberSince(w) && t.reliabilityState === (expectedPercent(o) === null ? 'TOO_FEW' : 'AVAILABLE') && t.self === false};
  }
  refused(fs.readFileSync(PT + 'switch-public.sql', 'utf8'), 'PROFILE_TRUST_SWITCH_PROFILE_TRUST_VISIBILITY_UNEXPECTED_STATE');
  const blockedInPublic = (await trustAs(R.rb, W.w12)).data;
  psqlFile(PT + 'switch-own-only.sql');
  const backHidden = (await trustAs(R.ra, W.w12)).data;
  check('PT_PUBLIC_MODE_ANY_ADMITTED_VIEWER_READS_RELIABILITY_AND_MEMBER_SINCE_THE_GATES_STILL_HOLD_AND_THE_SWITCH_BACK_HIDES',
    Object.values(publicMode).every(x => x.good) && blockedInPublic === null && backHidden.reliabilityState === 'HIDDEN',
    {publicMode: Object.fromEntries(Object.entries(publicMode).map(([k, v]) => [k, v.good])), blockedInPublic, backHidden});
  // gates
  const unknownProfile = (await trustAs(R.ra, randomUUID())).data;
  const requesterFace = (await trustAs(W.w12, R.ra.profileId)).data;
  const blockedByAuthor = (await trustAs(R.rb, W.w12)).data, blockedByWorker = (await trustAs(R.rc, W.w12)).data;
  const otherWorld = (await trustAs(R.re, W.w12)).data;
  const restrictedViewerSql = asAccount(R.rg.id, `public.rpc_public_work_trust_v1(${q(W.w12.profileId)}::uuid)`);
  const restrictedViewerHttp = await trustAs(R.rg, W.w12);
  const nullId = await call(R.ra, RPC.trust, {p_profile_id: null});
  const anonTrust = await anonCall(RPC.trust, {p_profile_id: W.w12.profileId});
  // Through PostgREST the pre-request guard (rpc_closure_api_guard) refuses a closure-restricted caller before the function runs; the
  // function's own gate answers null exactly like rpc_get_public_profile. Either way the caller learns nothing.
  const restrictedHttpFenced = (!restrictedViewerHttp.ok && restrictedViewerHttp.error.message === 'ACCOUNT_CLOSING') || (restrictedViewerHttp.ok && restrictedViewerHttp.data === null);
  report.observations.restrictedViewerThroughPostgrest = restrictedViewerHttp.ok ? 'FUNCTION_GATE_NULL' : 'PRE_REQUEST_GUARD_' + restrictedViewerHttp.error.message;
  check('PT_TRUST_GATES_UNKNOWN_REQUESTER_FACE_BLOCKED_EITHER_WAY_OTHER_WORLD_RESTRICTED_VIEWER_NULL_ID_AND_ANONYMOUS',
    unknownProfile === null && requesterFace === null && blockedByAuthor === null && blockedByWorker === null && otherWorld === null
      && restrictedViewerSql.ok && restrictedViewerSql.value === null && restrictedHttpFenced
      && !nullId.ok && nullId.error.message === 'PROFILE_ID_REQUIRED' && !anonTrust.ok,
    {unknownProfile, requesterFace, blockedByAuthor, blockedByWorker, otherWorld, restrictedViewerSql, restrictedViewerHttp: restrictedViewerHttp.error, nullId: nullId.error, anonTrust: anonTrust.error});
  const anonStats = await anonCall(RPC.stats, {}), anonReviews = await anonCall(RPC.reviews, {p_limit: 20, p_after: null});
  const restrictedStats = asAccount(R.rg.id, 'public.rpc_my_work_stats_v1()');
  check('PT_OWN_READS_ANONYMOUS_DENIED_AND_A_CLOSURE_RESTRICTED_CALLER_IS_ACCOUNT_CLOSING', !anonStats.ok && !anonReviews.ok && !restrictedStats.ok && restrictedStats.error.includes('ACCOUNT_CLOSING'),
    {anonStats: anonStats.error, anonReviews: anonReviews.error, restrictedStats: restrictedStats.error?.slice(-200)});
  // an account without a worker profile (defensive branch; every DEV account has both faces)
  const noWorker = await fx.createRequester({label: 'pt-noworker'});
  const dropped = run(`begin; set local session_replication_role = replica; delete from public.app_profiles where account_id = ${q(noWorker.id)}::uuid and kind = 'WORKER'; commit;`);
  if (dropped.ok) {
    bypass('app_profiles: removed the WORKER face of one fresh account', 'the hasWorkerProfile=false branch');
    const s = await okCall(noWorker, RPC.stats, {});
    check('PT_OWN_STATS_WITHOUT_A_WORKER_PROFILE_ARE_ZEROS_AND_NULL', s.hasWorkerProfile === false && s.applicationsSent === 0 && s.agreementsMade === 0 && s.reliabilityPercent === null
      && s.memberSince === null, s);
  } else report.observations.noWorkerBranch = 'NOT_EXERCISED: ' + dropped.error.slice(-200);

  // ------------------------------------------------------------ received reviews: D12 rules + A09, both modes
  const listAs = async (account, args) => okCall(account, RPC.reviews, args);
  const commented = await listAs(W.w12, {p_limit: 20, p_after: null});
  const byId = Object.fromEntries(Object.entries(rv).map(([k, v]) => [v, k]));
  const d12 = await okCall(W.w12, 'rpc_list_review_comments_v1', {p_profile_id: W.w12.profileId, p_limit: 50, p_after: null});
  const d12Ids = d12.items.map(i => i.reviewId);
  const commentedIds = commented.items.map(i => i.reviewId);
  const r4 = commented.items.find(i => i.reviewId === rv.r4), r1 = commented.items.find(i => i.reviewId === rv.r1);
  check('PT_COMMENTED_ONLY_LISTS_EXACTLY_THE_D12_COMMENTS_OF_THE_REVIEWED_PERSON_PLUS_THE_A09_COMMENT_OF_AN_AUTHOR_WHO_BLOCKED_THEM',
    commented.mode === 'COMMENTED_ONLY' && JSON.stringify(commentedIds) === JSON.stringify([rv.r4, rv.r1]) && JSON.stringify(d12Ids) === JSON.stringify([rv.r1])
      && commented.totalCount === 8 && commented.notListedCount === 6 && commented.hasMore === false && commented.nextAfter === null
      && r4.reviewer.masked === true && r4.reviewer.profileId === null && r4.reviewer.displayName === null && r4.reviewer.avatarPath === null && r4.reviewer.role === 'REQUESTER'
      && r4.comment === 'Kasnio je sat vremena.' && r4.agreementId === w12[3].id && r4.rating === 2 && JSON.stringify(r4.tags) === '["AS_AGREED"]'
      && r1.reviewer.masked === false && r1.reviewer.profileId === R.ra.profileId && r1.reviewer.displayName === 'PT Ana' && r1.reviewer.avatarPath === R.ra.id + '/avatar.jpg'
      && r1.comment === 'Odlican posao, sve po dogovoru.' && r1.receivedAs === 'WORKER' && r1.taskTitle === 'PT zadatak w12-1' && r1.agreementId === w12[0].id,
    {commented: commented.items.map(i => ({review: byId[i.reviewId], masked: i.reviewer.masked, comment: i.comment})), d12: d12Ids.map(i => byId[i]), totalCount: commented.totalCount,
      notListedCount: commented.notListedCount});
  psqlFile(PT + 'switch-reviews-all.sql');
  const all = await listAs(W.w12, {p_limit: 20, p_after: null});
  const expectAll = [['r9', true, null], ['r8', true, null], ['r7', true, null], ['r6', false, null], ['r5', true, null], ['r4', true, 'Kasnio je sat vremena.'], ['r2', false, null],
    ['r1', false, 'Odlican posao, sve po dogovoru.']];
  const gotAll = all.items.map(i => [byId[i.reviewId], i.reviewer.masked, i.comment]);
  check('PT_ALL_MODE_EVERY_REVIEW_FACE_AND_COMMENT_BY_THE_RULES_RESTRICTED_SUSPENDED_OTHER_WORLD_HIDDEN_I_BLOCKED_AUTHOR_BLOCKED_ME_STAR_ONLY',
    all.mode === 'ALL' && JSON.stringify(gotAll) === JSON.stringify(expectAll) && all.totalCount === 8 && all.notListedCount === 0
      && all.items.every(i => i.receivedAs === 'WORKER' && i.reviewer.role === 'REQUESTER' && typeof i.taskTitle === 'string' && Array.isArray(i.tags) && !('cursor' in i)),
    {expected: expectAll, got: gotAll});
  // keyset paging, stable and complete
  const pages = [];
  let after = null;
  for (let i = 0; i < 5; i++) { const p = await listAs(W.w12, {p_limit: 3, p_after: after}); pages.push(p); if (!p.hasMore) break; after = p.nextAfter; }
  const paged = pages.flatMap(p => p.items.map(i => i.reviewId));
  check('PT_KEYSET_PAGES_OF_3_ARE_STABLE_COMPLETE_AND_WITHOUT_DUPLICATES', pages.length === 3 && JSON.stringify(paged) === JSON.stringify(all.items.map(i => i.reviewId))
    && pages[0].hasMore && pages[1].hasMore && !pages[2].hasMore && pages[2].nextAfter === null && /^[0-9T:.-]+Z[|][0-9a-f-]{36}$/.test(pages[0].nextAfter),
    {pages: pages.map(p => ({items: p.items.map(i => byId[i.reviewId]), hasMore: p.hasMore, nextAfter: p.nextAfter}))});
  const clamp = {zero: (await listAs(W.w12, {p_limit: 0, p_after: null})).limit, big: (await listAs(W.w12, {p_limit: 1000, p_after: null})).limit,
    none: (await listAs(W.w12, {})).limit, negative: (await listAs(W.w12, {p_limit: -5})).limit};
  check('PT_LIMIT_CLAMPED_TO_1_50_DEFAULT_20', clamp.zero === 1 && clamp.big === 50 && clamp.none === 20 && clamp.negative === 1, clamp);
  const badCursors = {};
  for (const [k, v] of Object.entries({garbage: 'garbage', jsonObject: '{"createdAt":"x"}', impossibleDate: '2026-13-45T99:99:99.000000Z|' + randomUUID(),
    upperCaseId: '2026-10-07T10:00:00.000000Z|' + randomUUID().toUpperCase(), noFraction: '2026-10-07T10:00:00Z|' + randomUUID(), trailing: pages[0].nextAfter + ' '})) {
    const r = await call(W.w12, RPC.reviews, {p_limit: 3, p_after: v});
    badCursors[k] = !r.ok && r.error.message === 'INVALID_PAGE' && r.error.code === '22023';
  }
  check('PT_P_AFTER_VALIDATION_EVERY_MALFORMED_CURSOR_IS_INVALID_PAGE', Object.values(badCursors).every(Boolean), badCursors);
  const raList = await listAs(R.ra, {p_limit: 20, p_after: null});
  check('PT_CROSS_ACCOUNT_ANOTHER_ACCOUNT_SEES_ONLY_ITS_OWN_RECEIVED_REVIEWS',
    raList.items.length === 1 && raList.items[0].reviewId === back && raList.items[0].receivedAs === 'REQUESTER' && raList.items[0].reviewer.profileId === W.w12.profileId
      && raList.items[0].reviewer.role === 'WORKER' && raList.items[0].comment === 'Jasan dogovor.' && raList.totalCount === 1, raList);
  psqlFile(PT + 'switch-reviews-commented-only.sql');
  const backToCommented = await listAs(W.w12, {p_limit: 20, p_after: null});
  check('PT_REVIEWS_SWITCH_BACK_TO_COMMENTED_ONLY', backToCommented.mode === 'COMMENTED_ONLY' && backToCommented.items.length === 2, backToCommented.items.map(i => byId[i.reviewId]));
  // the stars still count: the public aggregate is unchanged by anything the list shows
  const rep = (await okCall(R.ra, 'rpc_get_public_profile', {p_profile_id: W.w12.profileId})).trust;
  check('PT_THE_PUBLIC_AGGREGATE_STILL_COUNTS_EVERY_REVIEW', rep.reviewCount === 8 && rep.ratingAverage === Math.round((5 + 4 + 2 + 3 + 1 + 5 + 4 + 5) / 8 * 100) / 100, rep);

  // ------------------------------------------------------------ late gates: a suspended worker profile and a closure-restricted subject read as nothing
  sql(`begin; set local session_replication_role = replica; update public.app_profiles set profile_status = 'SUSPENDED' where id = ${q(W.w0.profileId)}::uuid; commit;`);
  sql(`insert into private.account_closure_requests(account_id, state, revision) values (${q(W.wu.id)}::uuid, 'READY', 1)`);
  bypass('W0 worker profile SUSPENDED and WU under a closure restriction', 'the subject gates of the public trust read');
  const suspended = (await trustAs(R.ra, W.w0)).data, restrictedSubject = (await trustAs(R.ra, W.wu)).data;
  check('PT_SUSPENDED_PROFILE_AND_CLOSURE_RESTRICTED_SUBJECT_READ_AS_NOTHING', suspended === null && restrictedSubject === null, {suspended, restrictedSubject});

  // ------------------------------------------------------------ timing on the seeded set (server execution, one cold call in a fresh backend then warm calls) + PostgREST
  const timed = (accountId, expression) => {
    const r = run(`begin;
select set_config('request.jwt.claims', ${q(JSON.stringify({sub: accountId, role: 'authenticated'}))}, true);
select set_config('request.jwt.claim.sub', ${q(accountId)}, true);
set local role authenticated;
do $t$ declare t0 timestamptz; v jsonb; ms numeric[]:='{}'; i integer;
begin
  for i in 1..5 loop t0:=clock_timestamp(); v:=${expression}; ms:=ms||round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,3); end loop;
  perform set_config('pt.ms', to_jsonb(ms)::text, false);
end $t$;
select 'RESULT:' || current_setting('pt.ms');
rollback;`);
    assert.ok(r.ok, 'TIMING_FAILED:' + r.error);
    const ms = JSON.parse(r.output.split('\n').filter(l => l.startsWith('RESULT:')).at(-1).slice(7));
    const warm = ms.slice(1).sort((a, b) => a - b);
    return {coldMs: ms[0], warmMedianMs: warm[Math.floor(warm.length / 2)], allMs: ms};
  };
  const httpMs = async (account, name, args) => {
    const runs = [];
    for (let i = 0; i < 3; i++) { const started = Date.now(); const r = await call(account, name, args); assert.ok(r.ok); runs.push(Date.now() - started); }
    return runs.sort((a, b) => a - b)[1];
  };
  const w12Ids = w12.map(a => a.id);
  report.observations.timing = {
    trustOfW12: {...timed(R.ra.id, `public.rpc_public_work_trust_v1(${q(W.w12.profileId)}::uuid)`), httpMedianMs: await httpMs(R.ra, RPC.trust, {p_profile_id: W.w12.profileId})},
    statsOfW12: {...timed(W.w12.id, 'public.rpc_my_work_stats_v1()'), httpMedianMs: await httpMs(W.w12, RPC.stats, {})},
    reviewsOfW12: {...timed(W.w12.id, 'public.rpc_list_received_reviews_v1(20, null)'), httpMedianMs: await httpMs(W.w12, RPC.reviews, {p_limit: 20, p_after: null})},
    cancellationOf12: {...timed(W.w12.id, `public.rpc_agreement_cancellation_v1(array[${w12Ids.map(i => q(i) + '::uuid').join(',')}])`),
      httpMedianMs: await httpMs(W.w12, RPC.cancel, {p_agreement_ids: w12Ids})},
    publicProfileOfW12ForComparison: timed(R.ra.id, `public.rpc_get_public_profile(${q(W.w12.profileId)}::uuid)`),
  };
  write();
  check('PT_TIMING_EVERY_NEW_READ_UNDER_50_MS_WARM_ON_THE_SEEDED_SET', Object.entries(report.observations.timing).every(([, t]) => t.warmMedianMs < 50), report.observations.timing);

  // ------------------------------------------------------------ REVERT: exact
  psqlFile(PT + 'revert.sql'); state = 'CANCEL_INFO';
  assert.equal(catalog(), ciCatalog, 'PROFILE_TRUST_REVERT_DID_NOT_RESTORE_THE_CATALOG');
  refused(ptRevert, 'PROFILE_TRUST_REVERT_PREIMAGE_DRIFT');
  psqlFile(CI + 'revert.sql'); state = 'BASE';
  assert.equal(catalog(), baseCatalog, 'CANCEL_INFO_REVERT_DID_NOT_RESTORE_THE_CATALOG');
  assert.deepEqual(closure(), baseClosure); assert.equal(conflicts40001(), base40001);
  assert.equal(Number(sql(`select count(*) from private.marketplace_config where key in ('profile_trust_visibility','received_reviews_detail')`)), 0);
  pass('PT_EXACT_REVERT_CATALOG_CONFIG_ROWS_AND_CERTIFICATE_AS_BEFORE');
  await fx.reloadSchema();
  const reverted = [await call(R.ra, RPC.cancel, {p_agreement_ids: [ids.c1]}), await call(R.ra, RPC.trust, {p_profile_id: W.w12.profileId}),
    await call(W.w12, RPC.stats, {}), await call(W.w12, RPC.reviews, {p_limit: 20, p_after: null})];
  check('PT_REVERTED_THE_FOUR_RPCS_ARE_GONE_FAIL_AGAIN', reverted.every(r => !r.ok && r.error.code === 'PGRST202'), reverted);
  report.observations.auth = fx.authStats();
} catch (error) {
  fail('PT_RUN', String(error?.stack ?? error).slice(0, 2400));
  try { report.observations.backendsAtFailure = fx.diagnoseActiveBackends({terminate: false}); } catch { /* best effort */ }
} finally {
  try {
    if (state === 'BOTH') { psqlFile(PT + 'revert.sql'); state = 'CANCEL_INFO'; }
    if (state === 'CANCEL_INFO') { psqlFile(CI + 'revert.sql'); state = 'BASE'; }
    if (baseCatalog) { assert.equal(catalog(), baseCatalog); assert.deepEqual(closure(), baseClosure); }
  } catch (error) { fail('PT_FINAL_STATE', String(error).slice(0, 600)); }
}
report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
write();
const t = report.observations.timing;
const f1 = v => (v === undefined || v === null) ? 'n/a' : String(Math.round(v * 100) / 100);
const lines = [
  '### CANCEL-INFO + PROFILE-TRUST disposable proof (real Auth and PostgREST, bounded relevant-body fidelity)', '',
  `Result: **${report.result}** - ${report.checks.filter(c => c.result === 'PASS').length} checks passed, ${report.failures.length} failed${report.failures.length ? ': ' + report.failures.map(x => x.name).join(', ') : ''}.`, '',
  `Seed: ${JSON.stringify(report.observations.seed?.outcomes ?? {})}`, '',
  '| worker | Dogovori | completed | by worker | by requester | side unknown | reliabilityPercent |', '|---|---|---|---|---|---|---|',
  ...(report.observations.workTrustTruthTable ?? []).map(r => `| ${r.worker} | ${r.got.agreementsMade} | ${r.got.agreementsCompleted} | ${r.got.cancelledByMe} | ${r.got.cancelledByRequester} | ${r.got.cancelledSideUnknown} | ${r.got.reliabilityPercent ?? 'null'} |`), '',
  '| read (seeded set) | cold ms | warm median ms | PostgREST median ms |', '|---|---|---|---|',
  ...(t ? Object.entries(t).map(([k, v]) => `| ${k} | ${f1(v.coldMs)} | ${f1(v.warmMedianMs)} | ${v.httpMedianMs ?? 'n/a'} |`) : []), '',
  `Bypasses (labelled, disposable database only): ${report.bypasses.length}.`,
];
fs.writeFileSync(path.join(out, 'summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = report.result === 'PASS' ? 0 : 1;
