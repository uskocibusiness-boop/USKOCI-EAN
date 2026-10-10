// B09 / PKG-049 SERVER PRICE AUTHORITY: CHARACTERIZATION PROOF (round 3, after the three-lens reviews R1 and R2). No server change is made or proposed here: the authority
// (private.assert_application_price_v5, called by rpc_submit_response, rpc_select_response, rpc_resolve_stale_response_after_need_edit and both need_candidate_states_v5 overloads)
// is ALREADY live on canonical DEV since ledger 189 (PKG-033a). This proof is the EVIDENCE REFRESH the owner asked for (docs: b09/B09_PRICE_AUTHORITY_FINDING_20261001.md): it runs on a
// DISPOSABLE chain with actual Auth and actual PostgREST (real JWTs), through the REAL client TypeScript, and it is built to turn RED if the rule is weakened (phase P8 weakens it on purpose,
// on the disposable chain only). Nothing in this file has run against a database at the time of writing: the first CI run is the first observation.
//
// Phases:  P0 people and historical rows (created through the RPCs BEFORE any chain stage), chain stages (EX-04D candidate, in-proof B24 conversion of the two price-chain functions, one transaction each)
//          P1 pin gate (FAILS on a core difference), vocabulary, authority      P1b DIRECT PostgREST TABLE WRITES as a modified client (price integrity is claimed to be RPC-only)
//          P2 modified-client matrix      P3 replay and idempotency      P4 stale reconfirm      P5 selection, the accepted amount, hash/version pins, several applications
//          P6 the real client services: task read, submit, readback, refusal mapping      P7 Agreement change (CHARACTERISED, open owner decision D3)
//          P8 weakening probes (non-vacuity: observed outcome equals the weakened outcome)      P9 data neutrality (rows from before the chain stages AND from P2..P7), certificate, catalog.
// Label: every verdict holds for the CHAIN, never for DEV. The pin gate says whether the chain's price-chain BODIES equal the 2026-10-01 DEV readback ("PRICE-CHAIN BODIES == DEV": those bodies only)
// or which differences are explained; every pass line carries the short label and the list of packages the chain lacks.
// B24 HAZARD: the chain's stale-resolver and legacy rpc_confirm_need_edit are the PRE-B24 bodies (they raise SQLSTATE 40001 for a stale version or revision) and PostgREST 14 re-executes
// a 40001 without end. The in-proof stage converts exactly those two bodies, ONE TRANSACTION EACH (the md5 it produces is measured against the DEV md5 BEFORE anything is executed). Only the four
// documented chain-drift guards may be tolerated; any other failure of the stage (a SQL defect, a timeout) fails the run. P4(h) (HTTP 409 / PT409) runs whenever the stale resolver IS the DEV
// body; when it is not, no call below can trigger a 40001 site, the skip is a recorded GAP and the result is PASS_WITH_GAPS. Every HTTP call has a deadline.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from '../ex04/ts_loader.mjs';
import * as pins from './pkg049_pins.mjs';
import * as lib from './pkg049_lib.mjs';
const {assert, sql, rows, q, randomUUID, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const EX04D_CANDIDATE = 'supabase/candidates/ex04d_candidates_page.sql';
const EX04D_SHA256 = 'ff11ea470d2afa09b6651a5f1b55bc68d19578862841e12a4c83287924564a09';   // sha256 of the candidate text without its trailing newline (EX-04 S4, proved and applied to DEV, ledger 219)
const B24_PART1 = 'supabase/candidates/b24_nonretried_conflicts_part1.sql';
const PAGE_SIGNATURE = 'public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)';
const AGREEMENTS_PAGE_SIGNATURE = 'public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)';
const FLIP_FIXTURE = 'triggers disabled, no revision bump (defence in depth, R10): a fixture-level state, not a reachable one';
const SIG = Object.fromEntries(pins.PINS.map(pin => [pin.id, pin.signature]));
const DEADLINE_MS = 30000;
const reportPath = env.PRE_V3_ARTIFACT_DIR + '/pkg049-report.json', markdownPath = env.PRE_V3_ARTIFACT_DIR + '/pkg049-report.md';
const report = {
  package: 'PKG-049 / B09 server price authority: characterization proof (no server change)', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, devAccess: false, providerCalls: 0, serverChange: false,
  label: null, labelShort: null, result: 'RUNNING', gaps: [], stages: {}, checks: [], directWrites: null, matrix: [], replay: {}, stale: {}, selection: {}, client: {}, clientFlows: [], d3: null, weakening: null, neutrality: null, notVerified: [], transientRetries: 0,
};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
/** Every pass line carries the SHORT label first (it is evidence about the disposable chain, never about DEV) and is stored with it: the markdown and the workflow summary print it too. */
const pass = name => { report.checks.push({name, labelShort: report.labelShort, result: 'PASS'}); save(); console.log(lib.passLine(report.labelShort, name)); };
const sha = text => createHash('sha256').update(text).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const flag = value => value === 't';
/** Objects built inside the ts_loader VM have the VM's own Object.prototype, so a strict deepEqual against a literal fails on the prototype alone: compare their JSON form. */
const plain = value => JSON.parse(JSON.stringify(value));

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// transport: one PostgREST request (an RPC or a table request) with a deadline and a plain {status, data, error} answer (a refusal is data here, never a throw)
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function settle(label, factory) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  let response;
  try { response = await factory().abortSignal(controller.signal); }
  catch (error) { throw new Error(`HTTP_TRANSPORT_FAILURE ${label}: ${String(error?.message ?? error).slice(0, 200)}`); }
  finally { clearTimeout(timer); }
  if (response.status === 0 || /abort/i.test(String(response.error?.message ?? ''))) throw new Error(`HTTP_DEADLINE_${DEADLINE_MS}ms ${label} (a SQLSTATE 40001 retried without end by PostgREST 14 would hang here: see the B24 note in the header)`);
  return {status: response.status, data: response.data ?? null, error: response.error ? {code: response.error.code ?? null, message: response.error.message ?? null, details: response.error.details ?? null, hint: response.error.hint ?? null} : null};
}
/** PostgREST answers PGRST000/001/002 (HTTP 503) while it reloads its schema cache after DDL: the request was NOT executed, so it is sent again (counted in the report). Nothing else is ever retried. */
const SCHEMA_CACHE_UNAVAILABLE = new Set(['PGRST000', 'PGRST001', 'PGRST002']);
async function resend(send) {
  for (let attempt = 0; ; attempt++) {
    const answer = await send();
    if (answer.error && (SCHEMA_CACHE_UNAVAILABLE.has(answer.error.code) || answer.status === 503) && attempt < 20) { report.transientRetries += 1; await sleep(500); continue; }
    return answer;
  }
}
const call = (client, name, args) => resend(() => settle(name, () => client.rpc(name, args)));
/** A TABLE request as a modified client sends it (`factory` builds the supabase-js request each time it is sent). */
const callTable = (label, factory) => resend(() => settle(label, factory));
const mustOk = (response, label) => { assert.equal(response.error, null, `${label}: expected success, got ${JSON.stringify(response.error)}`); return response.data; };
/** SQLSTATEs of the refusals that are not the helper's (read from the RPC sources: ru5 submit, p0d03 select, ru4 stale resolver). */
const OTHER_SQLSTATE = {STALE_REVIEW_REQUIRED: 'P0001', RESPONSE_NOT_SELECTABLE: 'P0001', NEED_NOT_OPEN: 'P0001', IDEMPOTENCY_KEY_REUSED: '22023', NEED_REMAINING_CAPACITY_EXCEEDED: '22023', INVALID_COVERED_SLOTS: '22023',
  TEAM_CAPACITY_EXCEEDED: '22023', NOT_REQUESTER: '42501', PROFILE_NOT_OWNED_BY_ACCOUNT: '42501'};
/** PostgREST: 42501 is 403 (401 for an anonymous caller), PT409 is 409, every other SQLSTATE used here is 400. */
const httpFor = sqlstate => sqlstate === '42501' ? 403 : sqlstate === 'PT409' ? 409 : 400;
/** An EXACT refusal: the message, the SQLSTATE and the HTTP status all match (never "any error"). `expect` may override {sqlstate, status}. */
const mustRefuse = (response, message, label, expect = {}) => {
  const sqlstate = expect.sqlstate ?? pins.sqlstateOf(message) ?? OTHER_SQLSTATE[message];
  assert.ok(sqlstate, 'NO_SQLSTATE_KNOWN_FOR ' + message);
  const status = expect.status ?? httpFor(sqlstate);
  assert.ok(lib.isRefusal(response, message, sqlstate, status), `${label}: expected HTTP ${status} ${sqlstate} ${message}, got ${JSON.stringify(lib.outcomeOf(response))}`);
};
const mustMatch = (response, expect, label) => assert.deepEqual(lib.outcomeProblems(response, expect), [], `${label}: ${JSON.stringify(lib.outcomeOf(response))}`);
/** A PostgREST client that records the RPC names it was asked to call (to prove a client-side refusal sends nothing). */
function counted(client, log) {
  return new Proxy(client, {get(target, property) {
    if (property === 'rpc') return (name, args) => { log.push(name); return target.rpc(name, args); };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// database reads (as postgres, on the disposable stack)
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const exists = signature => sql(`select to_regprocedure(${q(signature)}) is not null`) === 't';
const readMd5 = signature => { const value = sql(pins.md5Sql(q)(signature)); return value === '' ? null : value; };
const bodyOf = signature => sql(`select replace(prosrc, chr(13), '') from pg_proc where oid = to_regprocedure(${q(signature)})`);
const closure = () => rows(`select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, (select sha256 from private.closure_erasure_source_v5 where singleton) erasure,
  private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5()->>'sourceSha256' binding`)[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const canExecute = (role, signature) => flag(sql(`select has_function_privilege(${q(role)}, ${q(signature)}, 'EXECUTE')`));
const meta = signature => rows(`select p.prosecdef secdef, p.provolatile volatility, coalesce(array_to_string(p.proconfig, ';'), '') config from pg_proc p where p.oid = to_regprocedure(${q(signature)})`)[0];
const argumentsOf = signature => sql(`select pg_get_function_arguments(to_regprocedure(${q(signature)}))`);
/** Everything a refused command must leave alone: counts and fingerprints of every price-bearing table, plus the idempotency ledgers.
 * Scoped to the accounts THIS proof created (a background worker of the chain may legitimately touch rows that are not ours).
 * NOTE: a refusal raised inside one RPC rolls its own transaction back, so "nothing written" is a transactional invariant, not independent evidence: the EXACT outcome is the evidence. */
function fpSql() {
  const workers = [worker, reader, stranger].map(person => q(person.id)).join(', '), mine = q(requester.id);
  return `select jsonb_build_object(
  'responses', (select count(*) from public.marketplace_responses where worker_account_id in (${workers})),
  'responses_fp', (select md5(coalesce(string_agg(id::text || ':' || current_version || ':' || price_rsd || ':' || covered_slots || ':' || status, ',' order by id), '')) from public.marketplace_responses where worker_account_id in (${workers})),
  'versions', (select count(*) from public.marketplace_response_versions v join public.marketplace_responses r on r.id = v.response_id where r.worker_account_id in (${workers})),
  'versions_fp', (select md5(coalesce(string_agg(v.response_id::text || ':' || v.version || ':' || v.price_rsd || ':' || v.covered_slots || ':' || v.content_hash, ',' order by v.response_id, v.version), '')) from public.marketplace_response_versions v join public.marketplace_responses r on r.id = v.response_id where r.worker_account_id in (${workers})),
  'snapshots', (select count(*) from private.response_application_snapshots s join public.marketplace_responses r on r.id = s.response_id where r.worker_account_id in (${workers})),
  'submit_commands', (select count(*) from private.response_submit_commands where worker_account_id in (${workers})),
  'resolution_commands', (select count(*) from private.response_revision_resolution_commands where worker_account_id in (${workers})),
  'selections', (select count(*) from public.need_selections where selected_by_account_id = ${mine}),
  'selection_commands', (select count(*) from private.selection_commands where requester_account_id = ${mine}),
  'activations', (select count(*) from private.connection_activations where requester_account_id = ${mine}),
  'agreements', (select count(*) from public.agreements where requester_account_id = ${mine}),
  'agreement_versions', (select count(*) from public.agreement_versions av join public.agreements a on a.id = av.agreement_id where a.requester_account_id = ${mine}),
  'proposals', (select count(*) from public.agreement_change_proposals p join public.agreements a on a.id = p.agreement_id where a.requester_account_id = ${mine}),
  'needs_fp', (select md5(coalesce(string_agg(id::text || ':' || mode || ':' || coalesce(price_basis, '-') || ':' || coalesce(requester_price_rsd::text, '-') || ':' || required_slots || ':' || revision || ':' || status, ',' order by id), '')) from public.needs where requester_account_id = ${mine}))`;
}
const fp = () => JSON.parse(sql(fpSql()));
const needState = need => rows(`select (select count(*) from public.marketplace_responses where need_id = ${q(need)}) responses,
  (select count(*) from public.marketplace_response_versions v join public.marketplace_responses r on r.id = v.response_id where r.need_id = ${q(need)}) versions,
  (select count(*) from public.need_selections where need_id = ${q(need)}) selections, (select count(*) from public.agreements where need_id = ${q(need)}) agreements`)[0];
const needStatus = need => sql(`select status from public.needs where id = ${q(need)}`);
/** The content hash of a stored version as the server composes it; `price` overrides the stored amount (a hash that binds a DIFFERENT price). */
const HASH_SQL = (mode, price = 'v.price_rsd') => `encode(sha256(convert_to(jsonb_build_object('needRevision', v.need_revision, 'pricingMode', ${q(mode)}, 'priceRsd', ${price}, 'coveredSlots', v.covered_slots,
  'proposedStartAt', v.proposed_start_at, 'proposedEndAt', v.proposed_end_at, 'scopeNote', btrim(v.scope_note), 'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED', 'workerTeamCapacity', p.team_capacity,
  'workerSkills', to_jsonb(p.skills), 'workerTools', to_jsonb(p.tools), 'workerLicenses', to_jsonb(p.licenses), 'workerVehicles', to_jsonb(p.vehicles))::text, 'UTF8')), 'hex')`;
const hashOf = (response, mode, price) => sql(`select ${HASH_SQL(mode, String(Number(price)))} from public.marketplace_response_versions v join public.marketplace_responses r on r.id = v.response_id and v.version = r.current_version
  join public.app_profiles p on p.id = r.worker_profile_id where r.id = ${q(response)}`);
/** The stored head, the current version and its snapshot of one response, with a check that the content hash binds the STORED price. */
const stored = (response, mode) => rows(`select r.status, r.current_version, r.price_rsd head_price, r.covered_slots head_covered, r.submitted_against_need_revision head_revision, v.price_rsd version_price, v.covered_slots version_covered,
  v.need_revision version_revision, v.content_hash, s.requester_price_rsd snapshot_task_price, s.pricing_mode snapshot_mode, s.covered_slots snapshot_covered, (v.content_hash = ${HASH_SQL(mode)}) hash_binds_stored_price
  from public.marketplace_responses r join public.marketplace_response_versions v on v.response_id = r.id and v.version = r.current_version
  left join private.response_application_snapshots s on s.response_id = r.id and s.response_version = v.version join public.app_profiles p on p.id = r.worker_profile_id where r.id = ${q(response)}`)[0];
const responseState = response => rows(`select status, current_version, price_rsd, covered_slots, submitted_against_need_revision from public.marketplace_responses where id = ${q(response)}`)[0];
const agreementTerms = (agreement, version) => rows(`select av.terms, av.content_hash, av.status from public.agreement_versions av where av.agreement_id = ${q(agreement)} and av.version = ${version}`)[0];

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// fixtures: people through the real Auth path, tasks through the same lifecycle guard the app's own publication uses
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
let requester, worker, reader, stranger;
const loaders = [];   // every ts_loader instance, so the report can name the exact client source bytes that ran
const faces = id => Object.fromEntries(rows(`select kind, id from public.app_profiles where account_id = ${q(id)}`).map(row => [row.kind, row.id]));
async function person(label, {capacity = 1} = {}) {
  const actor = await rt.actor('pkg049-' + label), ids = faces(actor.id);
  actor.profile = ids.REQUESTER; actor.workerProfile = ids.WORKER;
  sql(`update public.app_profiles set city = 'Novi Sad', skills = '{"Fizicki poslovi"}' where id = ${q(actor.workerProfile)};`);
  mustOk(await call(actor.client, 'rpc_complete_worker_profile', {p_profile_id: actor.workerProfile}), 'complete worker profile ' + label);
  sql(`begin; set local session_replication_role = replica; update public.app_profiles set team_capacity = ${capacity}, available_now = true where id = ${q(actor.workerProfile)}; commit;`);
  return actor;
}
const taskSql = value => value === null || value === undefined ? 'null' : String(Number(value));
function newNeed(task, title) {
  const id = randomUUID();
  sql(`begin; select set_config('uskoci.need_lifecycle', 'PUBLISH', true);
    insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, mode, required_slots, schedule_kind, response_deadline, published_at, requester_price_rsd, price_basis)
    values(${q(id)}, ${q(requester.id)}, ${q(requester.profile)}, 'PUBLISHED', ${q('PKG-049 ' + title)}, 'Disposable PKG-049 fixture', 'PROOF', 'Novi Sad', 'Liman', ${q(task.mode)}, ${task.slots}, 'FLEXIBLE',
      statement_timestamp() + interval '2 days', statement_timestamp(), ${taskSql(task.price)}, ${task.basis === null || task.basis === undefined ? 'null' : q(task.basis)}); commit;`);
  return id;
}
/** A DRAFT task of the requester (the positive control of P1b: the owner may edit a DRAFT directly, and a DRAFT has no applications by construction). Inserted as the database owner, like newNeed. */
function newDraftNeed(task, title) {
  const id = randomUUID();
  sql(`insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, mode, required_slots, schedule_kind, requester_price_rsd, price_basis)
    values(${q(id)}, ${q(requester.id)}, ${q(requester.profile)}, 'DRAFT', ${q('PKG-049 ' + title)}, 'Disposable PKG-049 fixture', 'PROOF', 'Novi Sad', 'Liman', ${q(task.mode)}, ${task.slots}, 'FLEXIBLE', ${taskSql(task.price)}, ${task.basis === null || task.basis === undefined ? 'null' : q(task.basis)});`);
  assert.equal(needStatus(id), 'DRAFT');
  return id;
}
/** The ids of the price-bearing rows (needs, applications, Agreements) in scope: `all` = every row of the database, `ours` = the rows of the accounts THIS proof created. */
const rowIds = scope => JSON.parse(sql(scope === 'all'
  ? `select jsonb_build_object('needs', (select coalesce(jsonb_agg(id order by id), '[]') from public.needs), 'responses', (select coalesce(jsonb_agg(id order by id), '[]') from public.marketplace_responses),
      'agreements', (select coalesce(jsonb_agg(id order by id), '[]') from public.agreements))`
  : `select jsonb_build_object('needs', (select coalesce(jsonb_agg(id order by id), '[]') from public.needs where requester_account_id = ${q(requester.id)}),
      'responses', (select coalesce(jsonb_agg(id order by id), '[]') from public.marketplace_responses where worker_account_id in (${[worker, reader, stranger].map(person => q(person.id)).join(', ')})),
      'agreements', (select coalesce(jsonb_agg(id order by id), '[]') from public.agreements where requester_account_id = ${q(requester.id)}))`));
/** The price tuples of the given rows as one fingerprint per table (a tuple that moves, or a row that disappears, changes the md5). */
const priceTuples = ids => JSON.parse(sql(`select jsonb_build_object(
  'needs', (select md5(coalesce(string_agg(id::text || ':' || mode || ':' || coalesce(price_basis, '-') || ':' || coalesce(requester_price_rsd::text, '-') || ':' || required_slots, ',' order by id), '')) from public.needs where id in (select jsonb_array_elements_text(${q(JSON.stringify(ids.needs))}::jsonb)::uuid)),
  'responses', (select md5(coalesce(string_agg(id::text || ':' || current_version || ':' || price_rsd || ':' || covered_slots, ',' order by id), '')) from public.marketplace_responses where id in (select jsonb_array_elements_text(${q(JSON.stringify(ids.responses))}::jsonb)::uuid)),
  'versions', (select md5(coalesce(string_agg(response_id::text || ':' || version || ':' || price_rsd || ':' || covered_slots || ':' || content_hash, ',' order by response_id, version), '')) from public.marketplace_response_versions where response_id in (select jsonb_array_elements_text(${q(JSON.stringify(ids.responses))}::jsonb)::uuid)),
  'agreement_versions', (select md5(coalesce(string_agg(agreement_id::text || ':' || version || ':' || coalesce(terms->>'price_rsd', '-') || ':' || coalesce(terms->>'covered_slots', '-') || ':' || content_hash, ',' order by agreement_id, version), '')) from public.agreement_versions where agreement_id in (select jsonb_array_elements_text(${q(JSON.stringify(ids.agreements))}::jsonb)::uuid)))`));
/** A task edit after publication: the guard's own CONFIRM_EDIT token (revision + 1, the after_need_revision trigger stales the applications), then the task is published again.
 * Fixture-level: the real command (rpc_confirm_need_edit_from_review) needs AI review artifacts, and publication is the owner's, so the republish bypasses triggers. Returns the new revision. */
function editTask(need, changes) {
  const before = Number(sql(`select revision from public.needs where id = ${q(need)}`));
  const sets = ["status = 'DRAFT'", 'revision = revision + 1', 'published_at = null', 'response_deadline = null', 'urgent = false', 'urgent_activated_at = null', 'urgent_expires_at = null', 'urgent_policy_version = null'];
  if ('price' in changes) sets.push('requester_price_rsd = ' + taskSql(changes.price));
  if ('basis' in changes) sets.push('price_basis = ' + (changes.basis === null ? 'null' : q(changes.basis)));
  if ('title' in changes) sets.push('title = ' + q(changes.title));
  if ('slots' in changes) sets.push('required_slots = ' + Number(changes.slots));
  sql(`begin; select set_config('uskoci.need_lifecycle', 'CONFIRM_EDIT', true); update public.needs set ${sets.join(', ')} where id = ${q(need)} and status in ('PUBLISHED', 'SELECTION'); commit;`);
  sql(`begin; set local session_replication_role = replica; update public.needs set status = 'PUBLISHED', published_at = statement_timestamp(), response_deadline = statement_timestamp() + interval '2 days' where id = ${q(need)} and status = 'DRAFT'; commit;`);
  const after = Number(sql(`select revision from public.needs where id = ${q(need)}`));
  assert.equal(after, before + 1, 'FIXTURE_EDIT_BUMPS_THE_REVISION');
  assert.equal(needStatus(need), 'PUBLISHED');
  return after;
}
/** A change the guard would refuse and no trigger would notice (no revision bump): the DB-level shape of "the task moved under an application". Triggers off, so it is a FIXTURE (FLIP_FIXTURE). */
const flip = (need, assignments) => sql(`begin; set local session_replication_role = replica; update public.needs set ${assignments} where id = ${q(need)}; commit;`);
const submitArgs = (need, {covered = 1, price, key = randomUUID(), revision = 1, profile = worker.workerProfile, note = null}) => ({p_need_id: need, p_need_revision: revision, p_worker_profile_id: profile, p_covered_slots: covered,
  p_price_rsd: price, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: note, p_client_request_id: key});
const resolveArgs = (response, {version, revision, action, covered = null, price = null, key = randomUUID()}) => ({p_response_id: response, p_expected_response_version: version, p_expected_need_revision: revision, p_client_request_id: key,
  p_action: action, p_covered_slots: covered, p_price_rsd: price, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null});
const selectArgs = (need, receipt, key = randomUUID()) => ({p_need_id: need, p_need_revision: receipt.needRevision, p_response_id: receipt.responseId, p_response_version: receipt.version, p_content_hash: receipt.contentHash, p_client_request_id: key});
/** A canonical application through the real RPC (it must succeed under every weakening too): the setup of a scenario, never its subject. */
async function applyCanonical(task, covered, title, actor = worker) {
  const need = newNeed(task, title), price = lib.canonicalPrice(task, covered);
  assert.notEqual(price, null, 'SCENARIO_NEEDS_A_CANONICAL_PRICE ' + title);
  const receipt = mustOk(await call(actor.client, 'rpc_submit_response', submitArgs(need, {covered, price, profile: actor.workerProfile})), 'canonical submit ' + title);
  return {need, receipt, price};
}
/** The page reader exists only after EX-04D and PostgREST learns it from its schema cache: wait for it, and FAIL when it never appears (the second overload is not optional). */
async function pageReady(client, need) {
  for (let attempt = 0; attempt < 60; attempt++) { const response = await client.rpc('rpc_list_need_candidates_page', {p_need_id: need, p_limit: 1}); if (!response.error) return true; await sleep(500); }
  throw new Error('READER_NOT_READY (rpc_list_need_candidates_page never answered: the EX-04D second need_candidate_states_v5 overload is mandatory for this proof)');
}
/** Applications and Agreements created through the real RPCs BEFORE the neutrality snapshot: P9 compares the price tuples of these (and of every older row) before and after the run. */
async function seedHistory() {
  const seeds = [];
  for (const [id, task, covered, offered] of [['seed_my_price', {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3}, 2, null], ['seed_offers', {mode: 'OFFERS', price: null, basis: null, slots: 1}, 1, 4500]]) {
    const need = newNeed(task, 'history ' + id), price = offered ?? lib.canonicalPrice(task, covered);
    const receipt = mustOk(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered, price})), 'history submit ' + id);
    const agreement = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), 'history select ' + id);
    seeds.push({id, need, response: receipt.responseId, agreement, price});
  }
  return seeds;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function main() {
  // =============================================================== P0 people and historical rows (BEFORE any chain stage), then the chain stages
  const closureStart = closure(); assert.equal(closureStart.ready, true); assert.equal(closureStart.live, closureStart.certified);
  // people through the real Auth path: a requester, a worker who may bring up to 50 people, a second worker for the real-client flows, a stranger (capacity 1)
  requester = await person('requester'); worker = await person('worker', {capacity: 50}); reader = await person('reader', {capacity: 6}); stranger = await person('stranger');
  // historical applications and Agreements through the real RPCs, created BEFORE the chain stages and BEFORE the snapshot: a stage that rewrote data would change the tuples P9 compares at the end
  const seeds = await seedHistory();
  const existing = rowIds('all'), tuplesBefore = priceTuples(existing);
  report.neutrality = {preexistingRows: {needs: existing.needs.length, responses: existing.responses.length, agreements: existing.agreements.length}, seeded: seeds, tuplesBefore};
  const candidateText = readFileSync(EX04D_CANDIDATE, 'utf8');
  assert.equal(sha(candidateText.replace(/\n$/, '')), EX04D_SHA256, 'EX04D_RECORDED_TEXT_DRIFT');
  if (!exists(SIG.ncs_2)) {
    try { sql(candidateText); report.stages.ex04dCandidate = 'APPLIED (exact DEV text, sha256 pinned; two new functions, nothing replaced)'; }
    catch (error) { report.stages.ex04dCandidate = 'NOT APPLIED: ' + String(error?.message ?? error).slice(0, 300); throw new Error('EX04D_CANDIDATE_NOT_APPLIED (the second need_candidate_states_v5 overload is mandatory): ' + report.stages.ex04dCandidate); }
  } else report.stages.ex04dCandidate = 'ALREADY PRESENT';
  assert.match(report.stages.ex04dCandidate, /^(APPLIED|ALREADY PRESENT)/);
  assert.ok(exists(SIG.ncs_2), 'THE_SECOND_NEED_CANDIDATE_STATES_OVERLOAD_EXISTS'); assert.ok(exists(PAGE_SIGNATURE), 'THE_CANDIDATE_PAGE_READER_EXISTS');
  // B24 Part 1 applicability on the PRISTINE chain (relaxed mode does not relax existence, uniqueness, the quoted-site count or the "no PT409 yet" check), measured before the in-proof stage
  const b24Targets = pins.parseB24Part1Targets(readFileSync(B24_PART1, 'utf8'));
  assert.equal(b24Targets.length, 54, 'B24_PART1_TARGET_TABLE_PARSED');
  const b24Observed = rows(`select n.nspname || '.' || p.proname fn, count(*) overloads, max((length(p.prosrc) - length(replace(p.prosrc, '''40001''', ''))) / 7) sites, bool_or(position('PT409' in p.prosrc) > 0) has_pt409
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname || '.' || p.proname = any(array[${b24Targets.map(target => q(target.fn)).join(', ')}]::text[]) group by 1`);
  const b24Part1 = {targets: b24Targets.length, ...pins.b24Applicability(b24Targets, b24Observed)};
  // the in-proof stage: B24 Part 1's own mechanics for exactly the two price-chain functions, ONE TRANSACTION EACH (an uncalled rpc_confirm_need_edit cannot veto the stale resolver conversion P4(h) needs).
  // Only the four documented chain-drift guards are tolerated (the pin gate reports the drift); any other error, and a drift guard on a body that WAS the known pre-image, FAILS the run.
  const b24PriceChain = pins.b24PriceChainTargets();
  assert.deepEqual(b24PriceChain.map(target => target.id), ['stale_resolver', 'confirm_need_edit']);
  const b24Stages = [];
  for (const target of b24PriceChain) {
    const decision = pins.b24StageDecision(readMd5(target.signature), target), conversion = target.preMd5.slice(0, 8) + ' -> ' + target.devMd5.slice(0, 8);
    if (decision.action === 'NOT_NEEDED') { b24Stages.push({id: target.id, applied: false, status: 'NOT NEEDED (the body already equals the DEV body)'}); continue; }
    try { sql(pins.b24PriceChainSql(q, [target])); b24Stages.push({id: target.id, applied: true, status: 'APPLIED (' + conversion + '; the derived md5 equalled the DEV md5 before anything was executed)'}); }
    catch (error) {
      const verdict = pins.classifyB24StageError(error?.message, {preImageMatched: decision.preImageMatched});
      if (!verdict.tolerated) throw new Error('B24_PRICE_CHAIN_STAGE_FAILED ' + target.id + ' (' + verdict.reason + '): ' + String(error?.message ?? error).slice(0, 600));
      b24Stages.push({id: target.id, applied: false, guard: verdict.guard, status: 'NOT APPLIED (' + verdict.guard + ': the chain body is not the pinned pre-image; the pin gate reports it)'});
    }
  }
  report.stages.b24PriceChain = pins.summarizeB24Stages(b24Stages); report.stages.b24PriceChainDetail = b24Stages;
  sql("notify pgrst, 'reload schema'");
  const closureBefore = closure(); assert.deepEqual(closureBefore, closureStart, 'THE_PEOPLE_THE_HISTORY_AND_THE_CHAIN_STAGES_MOVED_THE_CERTIFICATE');
  report.closureBefore = closureBefore;
  const surfaceBefore = surface();
  const serverHeader = await fetch(env.RU5_DEVICE_SUPABASE_URL + '/rest/v1/', {headers: {apikey: env.RU5_DEVICE_ANON_KEY}}).then(response => ({server: response.headers.get('server'), via: response.headers.get('via')})).catch(() => ({server: null, via: null}));
  report.postgrestHeader = serverHeader;
  // the pin gate is READ here (it needs only the catalog) so that every pass line from now on carries its label; its failure rule is asserted in P1
  const gate = pins.runPinGate(readMd5, pins.PINS, report.stages.b24PriceChain);
  report.pinGate = gate; report.label = gate.label; report.labelShort = gate.labelShort; save();
  console.log('LABEL: ' + gate.label);
  // the P0 and P1 pass names say which packages the chain lacks (the later passes carry the short label, which says the chain is NOT DEV)
  const labelWithLacks = gate.label.includes(pins.CHAIN_LACKS_TOKEN) ? gate.label : gate.label + '; ' + pins.CHAIN_LACKS_TOKEN;
  pass('P0_PEOPLE_AND_SEEDED_HISTORY_BEFORE_THE_CHAIN_STAGES_THEN_EX04D_AND_THE_B24_PRICE_CHAIN_CONVERSION_ONE_TRANSACTION_EACH_CERTIFICATE_UNMOVED (' + pins.CHAIN_LACKS_TOKEN + ')');

  // =============================================================== P1 pins, vocabulary, authority (the gate FAILS the run on a core difference)
  const helperBody = exists(SIG.helper) ? bodyOf(SIG.helper) : null;
  const vocabulary = helperBody !== null ? pins.compareVocabulary(pins.extractVocabulary(helperBody), pins.HELPER_VOCABULARY, pins.helperRaiseCheck(helperBody)) : {equal: false, added: [], removed: [...pins.HELPER_VOCABULARY], raiseProblems: ['HELPER_ABSENT']};
  const swallow = {ncs_1: exists(SIG.ncs_1) ? pins.swallowListMissing(bodyOf(SIG.ncs_1)) : ['(absent)'], ncs_2: exists(SIG.ncs_2) ? pins.swallowListMissing(bodyOf(SIG.ncs_2)) : ['(absent)']};
  const evaluation = pins.evaluatePinGate(gate, {vocabulary, swallow});
  report.pinEvaluation = evaluation; report.vocabulary = {...vocabulary, swallowListMissing: swallow}; save();
  console.log('PIN_GATE ' + (evaluation.ok ? 'PASS' : 'FAIL') + ' | equal=' + gate.equal.join(',') + ' | different=' + gate.different.map(item => item.id + (item.explanation === 'UNEXPLAINED' ? '(UNEXPLAINED)' : '')).join(',') + ' | missing=' + gate.missing.map(item => item.id).join(',')
    + (evaluation.warnings.length ? ' | warnings=' + evaluation.warnings.join(';') : ''));
  assert.deepEqual(evaluation.failures, [], 'PIN_GATE_FAILED (a core pin differs without an explanation, the helper vocabulary changed or a swallow list has a gap): ' + gate.label);
  report.chainFidelity = {
    note: 'The chain is the DEV-equivalent replay source147 -> PKG-050 plus the exact EX-04D text and the in-proof conversion of exactly two PRE-B24 bodies. It does NOT carry the DEV ledger 202-219 items listed in chainLacks; '
      + 'its certified set (76) and needs column ACL differ from DEV (88 functions, column grants after PKG-045b P0), and its certificate is chain-internal only (before = after, never equal to DEV 58447d77).',
    chainLacks: [...pins.CHAIN_LACKS],
    b24PriceChainStage: report.stages.b24PriceChain,
    b24Part1,
    fortyZeroOneInBody: Object.fromEntries(pins.PINS.filter(pin => exists(pin.signature)).map(pin => [pin.id, flag(sql(`select position('40001' in prosrc) > 0 from pg_proc where oid = to_regprocedure(${q(pin.signature)})`))])),
    certificate: {chainDigestPrefix: closureBefore.live.slice(0, 8), devDigestPrefix: pins.DEV_PINS_SOURCE.closureDigestPrefix, note: 'chain-internal only: before = after is provable on the chain, equality with DEV is not'},
  };
  const authority = {};
  for (const id of ['submit', 'select', 'stale_resolver', 'helper', 'propose', 'respond']) authority[id] = {anonExecute: canExecute('anon', SIG[id]), authenticatedExecute: canExecute('authenticated', SIG[id]), serviceRoleExecute: canExecute('service_role', SIG[id])};
  report.authority = authority;
  for (const id of ['submit', 'select', 'stale_resolver', 'helper', 'propose', 'respond']) assert.equal(authority[id].anonExecute, false, 'ANON_MUST_NOT_EXECUTE ' + id);
  for (const id of ['submit', 'select', 'stale_resolver', 'propose', 'respond']) assert.equal(authority[id].authenticatedExecute, true, 'AUTHENTICATED_MUST_EXECUTE ' + id);
  assert.equal(authority.helper.authenticatedExecute, false, 'THE_HELPER_IS_NOT_CALLABLE_BY_AUTHENTICATED'); assert.equal(authority.helper.serviceRoleExecute, false);
  const helperMeta = meta(SIG.helper), selectMeta = meta(SIG.select), submitMeta = meta(SIG.submit);
  assert.deepEqual(helperMeta, {secdef: false, volatility: 'i', config: 'search_path=pg_catalog'}, 'HELPER_METADATA');
  assert.deepEqual(selectMeta, {secdef: true, volatility: 'v', config: 'search_path=public, pg_temp'}, 'SELECT_METADATA');
  assert.deepEqual(submitMeta, {secdef: true, volatility: 'v', config: 'search_path=pg_catalog'}, 'SUBMIT_METADATA');
  const overloads = name => Number(sql(`select count(*) from pg_proc where proname = ${q(name)} and pronamespace = 'public'::regnamespace`));
  assert.equal(overloads('rpc_submit_response'), 1); assert.equal(overloads('rpc_select_response'), 1);
  assert.equal(argumentsOf(SIG.submit), 'p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text');
  assert.equal(argumentsOf(SIG.select), 'p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text', 'SELECTION_HAS_NO_PRICE_ARGUMENT');
  assert.equal(argumentsOf(SIG.respond), 'p_proposal_id uuid, p_accept boolean', 'THE_ACCEPT_CALL_CARRIES_NO_AMOUNT');
  report.signatures = {submit: argumentsOf(SIG.submit), select: argumentsOf(SIG.select), respond: argumentsOf(SIG.respond)};
  pass('P1_PIN_GATE_PASSED_VOCABULARY_RAISE_COUNT_AND_SWALLOW_LISTS_EQUAL_AND_AUTHORITY_RECORDED (' + labelWithLacks + ')');

  // =============================================================== P1b DIRECT PostgREST TABLE WRITES as a modified client
  // The premise of the whole authority claim is "price integrity is RPC-only" (finding section 6, PF-4). Every attack of lib.DIRECT_WRITE_PLAN is sent with a real JWT and must give the pinned outcome (the
  // expected outcome is derived from the migration sources the unit tests tie the plan to) AND leave the stored price surface byte-identical. Only the positive control writes.
  {
    const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3};
    const application = await applyCanonical(per, 2, 'direct writes application');
    const selected = await applyCanonical(per, 2, 'direct writes agreement');
    const agreementId = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(selected.need, selected.receipt)), 'direct writes: select');
    const selectionId = sql(`select id from public.need_selections where need_id = ${q(selected.need)}`);
    assert.match(selectionId, /^[0-9a-f-]{36}$/);
    const draft = newDraftNeed(per, 'direct writes control');
    const R1 = application.receipt.responseId, N1 = application.need, R2 = selected.receipt.responseId, N2 = selected.need, w = worker.client, r = requester.client;
    const forged = {
      version: {response_id: R1, version: 99, need_revision: 1, price_rsd: 1, covered_slots: 2, content_hash: 'f'.repeat(64)},
      response: {need_id: N1, worker_account_id: worker.id, worker_profile_id: worker.workerProfile, response_kind: 'APPLICATION', status: 'SUBMITTED', submitted_against_need_revision: 1, price_rsd: 1, covered_slots: 1},
      agreementVersion: {agreement_id: agreementId, version: 99, status: 'CONFIRMED', terms: {price_rsd: 1, covered_slots: 2, response_version: 1}, content_hash: 'f'.repeat(64), created_by_account_id: requester.id},
      agreement: {need_id: N2, selection_id: selectionId, selected_response_id: R2, requester_account_id: requester.id, requester_profile_id: requester.profile, worker_account_id: worker.id, worker_profile_id: worker.workerProfile, status: 'CONFIRMED'},
      selection: {need_id: N2, need_revision: 1, selected_by_account_id: requester.id, client_request_id: 'pkg049-forged-' + randomUUID(), covered_slots: 1},
    };
    const REQUESTS = {
      worker_update_response_versions: () => w.from('marketplace_response_versions').update({price_rsd: 1}).eq('response_id', R1).select(),
      worker_insert_response_versions: () => w.from('marketplace_response_versions').insert(forged.version).select(),
      worker_delete_response_versions: () => w.from('marketplace_response_versions').delete().eq('response_id', R1).select(),
      worker_update_responses: () => w.from('marketplace_responses').update({price_rsd: 1}).eq('id', R1).select(),
      worker_insert_responses: () => w.from('marketplace_responses').insert(forged.response).select(),
      worker_delete_responses: () => w.from('marketplace_responses').delete().eq('id', R1).select(),
      requester_update_agreement_versions: () => r.from('agreement_versions').update({terms: {price_rsd: 1, covered_slots: 2, response_version: 1}}).eq('agreement_id', agreementId).select(),
      requester_insert_agreement_versions: () => r.from('agreement_versions').insert(forged.agreementVersion).select(),
      requester_delete_agreement_versions: () => r.from('agreement_versions').delete().eq('agreement_id', agreementId).select(),
      requester_update_agreements: () => r.from('agreements').update({current_version: 99}).eq('id', agreementId).select(),
      requester_insert_agreements: () => r.from('agreements').insert(forged.agreement).select(),
      requester_delete_agreements: () => r.from('agreements').delete().eq('id', agreementId).select(),
      requester_update_need_selections: () => r.from('need_selections').update({covered_slots: 1}).eq('need_id', N2).select(),
      requester_insert_need_selections: () => r.from('need_selections').insert(forged.selection).select(),
      requester_delete_need_selections: () => r.from('need_selections').delete().eq('need_id', N2).select(),
      requester_update_needs_price: () => r.from('needs').update({requester_price_rsd: 1}).eq('id', N1).select(),
      requester_update_needs_basis: () => r.from('needs').update({price_basis: 'TOTAL'}).eq('id', N1).select(),
      requester_delete_needs: () => r.from('needs').delete().eq('id', N1).select(),
      control_requester_update_draft_needs_price: () => r.from('needs').update({requester_price_rsd: 3100}).eq('id', draft).select(),
    };
    assert.deepEqual(Object.keys(REQUESTS).sort(), lib.DIRECT_WRITE_PLAN.map(item => item.id).sort(), 'EVERY_ATTACK_OF_THE_PLAN_HAS_A_REQUEST_AND_NO_REQUEST_IS_OFF_PLAN');
    assert.deepEqual(lib.directWritePlanProblems(), [], 'THE_DIRECT_WRITE_PLAN_IS_SOUND');
    // the price surface an attack must leave alone: every column of the rows an attack targets (a changed updated_at is a change), plus the counts of the tables an insert would grow
    const surfaceOf = () => JSON.parse(sql(`select jsonb_build_object(
      'need_with_application', (select to_jsonb(n) from public.needs n where n.id = ${q(N1)}),
      'application', (select to_jsonb(x) from public.marketplace_responses x where x.id = ${q(R1)}),
      'application_versions', (select coalesce(jsonb_agg(to_jsonb(v) order by v.version), '[]') from public.marketplace_response_versions v where v.response_id = ${q(R1)}),
      'need_with_agreement', (select to_jsonb(n) from public.needs n where n.id = ${q(N2)}),
      'selected_response', (select to_jsonb(x) from public.marketplace_responses x where x.id = ${q(R2)}),
      'selected_response_versions', (select coalesce(jsonb_agg(to_jsonb(v) order by v.version), '[]') from public.marketplace_response_versions v where v.response_id = ${q(R2)}),
      'selections', (select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]') from public.need_selections s where s.need_id = ${q(N2)}),
      'agreements', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]') from public.agreements a where a.need_id = ${q(N2)}),
      'agreement_versions', (select coalesce(jsonb_agg(to_jsonb(av) order by av.agreement_id, av.version), '[]') from public.agreement_versions av join public.agreements a on a.id = av.agreement_id where a.need_id = ${q(N2)}),
      'counts', jsonb_build_object('responses', (select count(*) from public.marketplace_responses where need_id in (${q(N1)}, ${q(N2)})), 'selections', (select count(*) from public.need_selections where need_id in (${q(N1)}, ${q(N2)})),
        'agreements', (select count(*) from public.agreements where need_id in (${q(N1)}, ${q(N2)}))))`));
    // read controls: the same people CAN read what they cannot write, so a refusal below is about the write and not about a request that never authenticated
    const readControls = {
      workerReadsOwnApplication: (await call(worker.client, 'rpc_list_my_applications', {})).data?.some?.(entry => entry.applicationId === R1) === true,
      workerReadsOwnResponseRow: (await callTable('read control: worker reads his response row', () => w.from('marketplace_responses').select('id, price_rsd').eq('id', R1))).data?.length === 1,
      requesterReadsTheAgreementVersion: (await callTable('read control: requester reads the agreement version', () => r.from('agreement_versions').select('agreement_id, terms').eq('agreement_id', agreementId))).data?.length === 1,
      requesterReadsTheTask: (await callTable('read control: requester reads his published task', () => r.from('needs').select('id, requester_price_rsd').eq('id', N1))).data?.length === 1,
    };
    for (const [name, value] of Object.entries(readControls)) assert.equal(value, true, 'READ_CONTROL_' + name);
    let last = surfaceOf(), lastFp = fp();
    assert.equal(last.counts.responses, 2); assert.equal(last.counts.agreements, 1); assert.equal(last.counts.selections, 1);
    const outcomes = [];
    for (const item of lib.DIRECT_WRITE_PLAN) {
      const response = await callTable(item.id, REQUESTS[item.id]);
      const problems = lib.directWriteProblems(response, item.kind, item.table);
      const now = surfaceOf(), nowFp = fp(), identical = lib.sameJson(last, now) && lib.sameJson(lastFp, nowFp);
      if (item.control) {
        const stored = Number(sql(`select requester_price_rsd from public.needs where id = ${q(draft)}`));
        if (stored !== 3100) problems.push(`the control did not write: the DRAFT price is ${stored}, expected 3100`);
        if (Array.isArray(response.data) && response.data[0]?.requester_price_rsd !== 3100) problems.push('the control representation does not show the written price 3100');
      }
      outcomes.push({id: item.id, actor: item.actor, table: item.table, op: item.op, kind: item.kind, control: item.control === true, chainSpecific: item.chainSpecific === true, note: item.note ?? null,
        observed: response.error ? `HTTP ${response.status} ${response.error.code} ${response.error.message}` : `HTTP ${response.status} ${Array.isArray(response.data) ? response.data.length + ' row(s)' : typeof response.data}`,
        problems, surfaceIdentical: item.control ? null : identical});
      last = now; lastFp = nowFp;   // the control writes, so the baseline moves with it (it is the last attack)
    }
    const attacks = outcomes.filter(item => !item.control);
    report.directWrites = {note: 'Expected outcomes are DERIVED from the migration sources (the response tables revoke insert, update, delete from anon and authenticated; agreements, agreement_versions and need_selections hold table-level grants and RLS with SELECT policies only; '
      + 'needs_owner_update is DRAFT-only and DELETE is revoked) and tied to them by the unit tests: the first CI run is the first observation. Rows marked chain-specific depend on the needs privileges of THIS chain (table-level SELECT; DEV has PKG-045b P0 column privileges and is not observed).',
      readControls, fixtures: {applicationNeed: N1, applicationResponse: R1, agreementNeed: N2, agreement: agreementId, selection: selectionId, draftNeed: draft}, rows: outcomes, attacks: attacks.length, chainSpecificAttacks: attacks.filter(item => item.chainSpecific).length};
    save();
    const failures = outcomes.flatMap(item => [...item.problems.map(problem => `${item.id}: ${problem} (observed ${item.observed})`), ...(item.surfaceIdentical === false ? [`${item.id}: THE_STORED_PRICE_SURFACE_CHANGED`] : [])]);
    assert.deepEqual(failures, [], 'P1B_DIRECT_TABLE_WRITES: every attack must give the pinned outcome and leave the stored price surface byte-identical');
    assert.equal(outcomes.length, lib.DIRECT_WRITE_PLAN.length); assert.equal(attacks.length, 18, 'P1B_ATTACK_COUNT_FLOOR');
    pass(`P1B_${attacks.length}_DIRECT_TABLE_WRITES_BY_A_MODIFIED_CLIENT_REFUSED_OR_FILTERED_WITH_THE_PINNED_OUTCOME_THE_STORED_PRICE_SURFACE_BYTE_IDENTICAL_AND_THE_POSITIVE_CONTROL_WRITES (${report.directWrites.chainSpecificAttacks} needs attacks are chain-specific: the chain has table-level needs privileges, DEV has PKG-045b P0 column privileges)`);
  }

  // =============================================================== P2 the modified-client matrix over real PostgREST
  {
    let last = fp(), refusals = 0, accepted = 0, cases = 0, canonRows = 0, pinnedRows = 0, canonRefusals = 0, pinnedRefusals = 0;
    const checkStored = (receipt, need, task, covered, sent, label) => {
      assert.deepEqual(lib.receiptProblems(receipt, {mode: task.mode, covered}), [], label + ' the success receipt keeps its eleven keys and values (I6)');
      const row = stored(receipt.responseId, task.mode);
      assert.equal(row.head_price, sent, label + ' head price is the SENT price, verbatim'); assert.equal(row.version_price, sent, label + ' version price is the SENT price, verbatim');
      assert.equal(row.head_covered, covered, label); assert.equal(row.version_covered, covered, label); assert.equal(row.snapshot_covered, covered, label);
      assert.equal(row.snapshot_task_price, task.price ?? null, label + ' the snapshot records the TASK price beside the application'); assert.equal(row.snapshot_mode, task.mode, label);
      assert.equal(row.content_hash, receipt.contentHash, label); assert.equal(row.hash_binds_stored_price, true, label + ' the content hash binds the stored price'); assert.equal(row.status, 'SUBMITTED', label);
      assert.deepEqual(needState(need), {responses: 1, versions: 1, selections: 0, agreements: 0}, label);
    };
    for (const shape of lib.TASK_SHAPES) for (const covered of shape.covered) {
      const {refusals: refused, oks} = lib.candidateSents(shape.task, covered), tag = `${shape.id} c${covered}`;
      cases += 1;
      const first = newNeed(shape.task, 'matrix ' + tag);
      last = fp();
      for (const item of refused) {
        const label = `${tag} sent ${item.sent} (${item.label})`, cell = lib.cellLabel(shape, item);
        const response = await call(worker.client, 'rpc_submit_response', submitArgs(first, {covered, price: item.sent}));
        mustRefuse(response, item.expect.message, label);
        const detail = lib.expectedDetail(shape.task, covered, item.sent, item.expect.message);
        if (detail !== null) assert.equal(response.error.details, detail, label + ' DETAIL');
        const now = fp(); assert.deepEqual(now, last, 'NOTHING_WRITTEN ' + label); last = now;
        report.matrix.push({shape: tag, mode: shape.task.mode, basis: shape.task.basis, taskPrice: shape.task.price, slots: shape.task.slots, covered, sent: item.sent, kind: item.label, outcome: 'REFUSED', message: item.expect.message,
          sqlstate: pins.sqlstateOf(item.expect.message), httpStatus: response.status, defined: cell.defined, decision: cell.decision, status: lib.statusOf(cell)});
        refusals += 1; if (cell.defined) { canonRows += 1; canonRefusals += 1; } else { pinnedRows += 1; pinnedRefusals += 1; }
      }
      for (const [index, item] of oks.entries()) {
        const label = `${tag} sent ${item.sent} (${item.label})`, need = index === 0 ? first : newNeed(shape.task, `matrix ${tag} ok${index}`), cell = lib.cellLabel(shape, item);
        const response = await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered, price: item.sent}));
        checkStored(mustOk(response, label), need, shape.task, covered, item.sent, label);
        last = fp();
        report.matrix.push({shape: tag, mode: shape.task.mode, basis: shape.task.basis, taskPrice: shape.task.price, slots: shape.task.slots, covered, sent: item.sent, kind: item.label, outcome: 'ACCEPTED_VERBATIM', httpStatus: response.status,
          defined: cell.defined, decision: cell.decision, status: lib.statusOf(cell)});
        accepted += 1; if (cell.defined) canonRows += 1; else pinnedRows += 1;
      }
    }
    // floors written down separately from the generator: an empty or shrunken loop cannot pass
    assert.equal(lib.TASK_SHAPES.length, lib.MATRIX_EXPECTED.shapes, 'MATRIX_SHAPES'); assert.equal(lib.TASK_SHAPES.flatMap(shape => shape.covered).length, lib.MATRIX_EXPECTED.cases, 'MATRIX_COVERED_CASES_DECLARED');
    assert.equal(cases, lib.MATRIX_EXPECTED.cases, 'MATRIX_COVERED_CASES_RUN'); assert.equal(refusals, lib.MATRIX_EXPECTED.refusals, 'MATRIX_REFUSALS'); assert.equal(accepted, lib.MATRIX_EXPECTED.accepted, 'MATRIX_ACCEPTED');
    assert.equal(report.matrix.length, refusals + accepted); assert.equal(canonRows + pinnedRows, refusals + accepted);
    report.matrixTotals = {refusalsAsserted: refusals, acceptedVerbatim: accepted, shapes: lib.TASK_SHAPES.length, coveredCases: cases, canonRows, pinnedRows, canonRefusals, pinnedRefusals};
    pass(`P2_MATRIX_CANON_CELLS_${canonRefusals}_REFUSALS_WITH_EXACT_MESSAGE_SQLSTATE_HTTP_400_AND_DETAIL_${canonRows - canonRefusals}_AMOUNTS_STORED_VERBATIM_WITH_A_HASH_THAT_BINDS_THEM_AND_THE_ELEVEN_KEY_RECEIPT`);
    pass(`P2_MATRIX_PINNED_TO_TODAY_CELLS_${pinnedRefusals}_REFUSALS_AND_${pinnedRows - pinnedRefusals}_ACCEPTED_AMOUNTS_UNDER_OPEN_OWNER_DECISIONS_D1_D4_D6_CHARACTERISED_NOT_JUDGED (${refusals} refusals and ${accepted} accepted amounts in all)`);
    // an amount the int4 parameter cannot carry never reaches the rule: refused by the transport as a data exception, nothing written
    const outside = newNeed({mode: 'OFFERS', price: null, basis: null, slots: 1}, 'int4 overflow'), beforeOutside = fp();
    const over = await call(worker.client, 'rpc_submit_response', submitArgs(outside, {covered: 1, price: lib.INT4_MAX + 1}));
    mustMatch(over, {statuses: [400], codes: ['22003', '22P02'], notCode: 'PGRST202'}, 'ABOVE_INT4_IS_A_DATA_EXCEPTION_NOT_A_MISSING_FUNCTION'); assert.deepEqual(fp(), beforeOutside);
    report.matrixOverflow = {sent: lib.INT4_MAX + 1, status: over.status, code: over.error.code, message: String(over.error.message).slice(0, 120), expected: '22003 (the first observation of the code; 22P02 is tolerated, PGRST202 is not)'};
    // capacity checks fire BEFORE the price check (the price in these calls is wrong on purpose)
    const capacity = newNeed({mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3}, 'capacity first');
    mustRefuse(await call(worker.client, 'rpc_submit_response', submitArgs(capacity, {covered: 4, price: 3000})), 'NEED_REMAINING_CAPACITY_EXCEEDED', 'remaining capacity precedes the price');
    mustRefuse(await call(worker.client, 'rpc_submit_response', submitArgs(capacity, {covered: 0, price: 3000})), 'INVALID_COVERED_SLOTS', 'covered slots precede the price');
    const teamNeed = newNeed({mode: 'MY_PRICE', price: 9000, basis: 'TOTAL', slots: 3}, 'team capacity first');
    const team = await call(stranger.client, 'rpc_submit_response', submitArgs(teamNeed, {covered: 3, price: 1, profile: stranger.workerProfile}));
    mustRefuse(team, 'TEAM_CAPACITY_EXCEEDED', 'team capacity (stranger, capacity 1, covers 3) precedes the price (sent 1 would be FIXED_PRICE_MISMATCH)');
    assert.equal(team.error.details, 'covered=3,teamCapacity=1', 'THE_SUBMIT_DOOR_SAYS_HOW_MANY_PEOPLE_WERE_COVERED_AND_THE_TEAM_CAPACITY (the detail of ru5 submit; the stale-reconfirm door raises the same message with no detail)');
    assert.deepEqual(needState(capacity), {responses: 0, versions: 0, selections: 0, agreements: 0}); assert.deepEqual(needState(teamNeed), {responses: 0, versions: 0, selections: 0, agreements: 0});
    report.matrixCapacity = {remainingCapacityBeforePrice: true, coveredSlotsBeforePrice: true, teamCapacityBeforePrice: true, teamCapacityDetail: team.error.details};
    // anonymous callers and a stranger's profile: EXACT outcomes
    const guarded = newNeed({mode: 'MY_PRICE', price: 3000, basis: null, slots: 1}, 'authority'), beforeGuard = fp();
    const anonymous = await call(rt.anon, 'rpc_submit_response', submitArgs(guarded, {covered: 1, price: 3000}));
    mustMatch(anonymous, {statuses: [401, 403], codes: ['42501']}, 'AN_ANONYMOUS_CALLER_IS_REFUSED_BY_THE_ACL');
    const foreignProfile = await call(stranger.client, 'rpc_submit_response', submitArgs(guarded, {covered: 1, price: 3000, profile: worker.workerProfile}));
    mustRefuse(foreignProfile, 'PROFILE_NOT_OWNED_BY_ACCOUNT', 'A_PROFILE_OF_ANOTHER_ACCOUNT_IS_REFUSED'); assert.deepEqual(fp(), beforeGuard);
    report.authorityNegatives = {anonymousSubmit: {status: anonymous.status, code: anonymous.error.code}, foreignProfile: {status: foreignProfile.status, code: foreignProfile.error.code, message: foreignProfile.error.message}};
    pass('P2_PRECEDENCE_OVERFLOW_TEAM_CAPACITY_AND_EXACT_AUTHORITY_NEGATIVES');
  }

  // =============================================================== P3 replay and idempotency
  {
    const task = {mode: 'MY_PRICE', price: 3000, basis: null, slots: 1}, need = newNeed(task, 'replay'), key = randomUUID();
    const args = submitArgs(need, {covered: 1, price: 3000, key});
    const receipt = mustOk(await call(worker.client, 'rpc_submit_response', args), 'first submit');
    assert.equal(receipt.idempotentReplay, false); assert.deepEqual(needState(need), {responses: 1, versions: 1, selections: 0, agreements: 0});
    const ledger = k => Number(sql(`select count(*) from private.response_submit_commands where worker_account_id = ${q(worker.id)} and client_request_id = ${q(k)}`));
    assert.equal(ledger(key), 1);
    let last = fp();
    const replay = mustOk(await call(worker.client, 'rpc_submit_response', args), 'replay');
    assert.equal(replay.idempotentReplay, true); for (const field of ['responseId', 'version', 'contentHash', 'needRevision', 'coveredSlots', 'status']) assert.equal(replay[field], receipt[field], 'REPLAY_RETURNS_THE_STORED_RESULT ' + field);
    assert.deepEqual(fp(), last); report.replay.keyed = true; report.replay.sameKeySameCommandReturnsTheStoredResult = true;
    pass('P3_SAME_KEY_SAME_COMMAND_RETURNS_THE_STORED_RESULT_AND_WRITES_NOTHING');
    // the replay check comes BEFORE the price check: each of these prices is non-canonical or invalid and would be refused by the price rule if it ran first
    const mismatchedPrices = [3001, 2999, 0, -1];
    for (const price of mismatchedPrices) { mustRefuse(await call(worker.client, 'rpc_submit_response', {...args, p_price_rsd: price}), 'IDEMPOTENCY_KEY_REUSED', 'same key, price ' + price); assert.deepEqual(fp(), last); }
    report.replay.replayBeforePriceCheck = mismatchedPrices.length;
    pass('P3_SAME_KEY_WITH_ANOTHER_PRICE_IS_THE_IDEMPOTENCY_MISMATCH_NOT_A_PRICE_REFUSAL');
    // a refused command is not stored: its key is not burnt, and the stored application keeps the price it was accepted at
    const retry = randomUUID();
    mustRefuse(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered: 1, price: 3001, key: retry})), 'FIXED_PRICE_MISMATCH', 'a resubmission at a wrong price');
    assert.equal(ledger(retry), 0, 'A_REFUSED_COMMAND_LEAVES_NO_LEDGER_ROW'); assert.deepEqual(fp(), last);
    assert.equal(stored(receipt.responseId, task.mode).head_price, 3000); assert.equal(stored(receipt.responseId, task.mode).current_version, 1);
    const second = mustOk(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered: 1, price: 3000, key: retry})), 'the same key, now canonical');
    assert.equal(second.idempotentReplay, false); assert.equal(second.version, 2); assert.equal(ledger(retry), 1); last = fp();
    report.replay.refusedKeyReusable = true;
    pass('P3_A_REFUSED_KEY_CAN_BE_RETRIED_AND_THE_STORED_PRICE_IS_NEVER_TOUCHED_BY_A_REFUSAL');
    // replay precedes every check, including the task moving under the stored result
    const revision = editTask(need, {price: 4000}); assert.equal(revision, 2);
    const stale = mustOk(await call(worker.client, 'rpc_submit_response', args), 'replay after the task changed');
    assert.equal(stale.idempotentReplay, true); assert.equal(stale.contentHash, receipt.contentHash); report.replay.replayAfterTaskEdit = true;
    last = fp();
    mustRefuse(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered: 1, price: 3000, revision: 1})), 'STALE_REVIEW_REQUIRED', 'a new key at the old revision (P0001 in submit: the pair the client pins)'); report.replay.revisionBeforePrice = true;
    mustRefuse(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered: 1, price: 3000, revision: 2})), 'FIXED_PRICE_MISMATCH', 'the CURRENT revision at the OLD price: the helper judges against the current task'); report.replay.newKeyJudgedAgainstTheCurrentTask = true;
    assert.deepEqual(fp(), last);
    pass('P3_REPLAY_PRECEDES_THE_REVISION_AND_PRICE_CHECKS_AND_A_NEW_KEY_IS_JUDGED_AGAINST_THE_CURRENT_TASK');
    // a double tap: two identical commands at once give one version and exactly one replay
    const tap = newNeed(task, 'double tap'), tapArgs = submitArgs(tap, {covered: 1, price: 3000});
    const [one, two] = await Promise.all([call(worker.client, 'rpc_submit_response', tapArgs), call(worker.client, 'rpc_submit_response', tapArgs)]);
    const results = [mustOk(one, 'tap 1'), mustOk(two, 'tap 2')];
    assert.equal(results.filter(item => item.idempotentReplay === true).length, 1); assert.equal(results[0].responseId, results[1].responseId); assert.equal(results[0].contentHash, results[1].contentHash);
    assert.deepEqual(needState(tap), {responses: 1, versions: 1, selections: 0, agreements: 0}); report.replay.doubleTapOneVersion = true; pass('P3_A_DOUBLE_TAP_PRODUCES_ONE_VERSION');
  }

  // =============================================================== P4 stale reconfirm: both paths are judged against the CURRENT task
  {
    const workerMods = loadModules({client: worker.client, accountId: worker.id}); loaders.push(workerMods);
    const ru4 = workerMods.load('data/ru4Production').ru4Production;
    const resolveAs = (actor, response, version, revision, action, extra = {}) => call(actor.client, 'rpc_resolve_stale_response_after_need_edit', resolveArgs(response, {version, revision, action, ...extra}));
    const resolve = (...args) => resolveAs(worker, ...args);
    /** A refusal at the reconfirmation door: the EXACT outcome, nothing written, and the application is still the same STALE_REVIEW_REQUIRED head at the version it had. */
    const refuseResolve = async (response, version, revision, action, extra, message, label, expect = {}, actor = worker) => {
      const before = fp(), head = responseState(response);
      assert.equal(head.status, 'STALE_REVIEW_REQUIRED', 'THE_APPLICATION_IS_STALE_BEFORE ' + label);
      mustRefuse(await resolveAs(actor, response, version, revision, action, extra), message, label, expect);
      assert.deepEqual(fp(), before, 'NOTHING_WRITTEN ' + label); assert.deepEqual(responseState(response), head, 'THE_APPLICATION_IS_UNTOUCHED_AND_STILL_STALE ' + label);
    };
    const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3};
    const refusals = {keep: 0, update: 0, viaClient: 0, capacity: 0};
    // (a) the task price moves 3000 -> 4000 per person
    {
      const {need, receipt} = await applyCanonical(per, 2, 'stale price');
      const revision = editTask(need, {price: 4000});
      assert.equal(responseState(receipt.responseId).status, 'STALE_REVIEW_REQUIRED', 'THE_EDIT_STALED_THE_APPLICATION');
      await refuseResolve(receipt.responseId, 1, revision, 'KEEP', {}, 'FIXED_PRICE_MISMATCH', 'KEEP re-asserts the stored 6000 against the CURRENT 4000 x 2'); refusals.keep += 1;
      for (const price of [6000, 4000, 8001, 7999, 0]) {
        await refuseResolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 2, price}, price === 0 ? 'INVALID_PRICE' : 'FIXED_PRICE_MISMATCH', 'UPDATE at ' + price); refusals.update += 1;
      }
      // the same refusals through the REAL client wrapper (null defaults, legacyRpcFailure mapping, the real Serbian sentence)
      const viaClient = input => ru4.resolveChangedApplication({prijavaId: receipt.responseId, ocekivanaVerzija: 1, ocekivanaPotrebaRevizija: revision, clientRequestId: randomUUID(), ...input});
      const beforeClient = fp(), headBefore = stored(receipt.responseId, per.mode);
      assert.deepEqual(plain(await viaClient({akcija: 'KEEP'})), {ok: false, kod: 'FIXED_PRICE_MISMATCH', poruka: lib.SERBIAN_COPY.legacy.FIXED_PRICE_MISMATCH}, 'THE_CLIENT_KEEP_REFUSAL'); refusals.viaClient += 1;
      assert.deepEqual(plain(await viaClient({akcija: 'UPDATE', pokrivenaMesta: 2, cenaRsd: 8001})), {ok: false, kod: 'FIXED_PRICE_MISMATCH', poruka: lib.SERBIAN_COPY.legacy.FIXED_PRICE_MISMATCH}, 'THE_CLIENT_UPDATE_REFUSAL'); refusals.viaClient += 1;
      assert.deepEqual(plain(await viaClient({akcija: 'UPDATE', pokrivenaMesta: 2, cenaRsd: 0})), {ok: false, kod: 'INVALID_PRICE', poruka: lib.SERBIAN_COPY.legacy.INVALID_PRICE}, 'THE_CLIENT_ZERO_PRICE_REFUSAL'); refusals.viaClient += 1;
      assert.deepEqual(fp(), beforeClient); assert.deepEqual(stored(receipt.responseId, per.mode), headBefore, 'THE_STORED_HEAD_PRICE_IS_UNCHANGED_AFTER_THE_CLIENT_REFUSALS'); assert.equal(headBefore.head_price, 6000);
      assert.equal(responseState(receipt.responseId).status, 'STALE_REVIEW_REQUIRED'); assert.equal(responseState(receipt.responseId).current_version, 1);
      const key = randomUUID(), ok = mustOk(await resolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 2, price: 8000, key}), 'UPDATE at the new canonical price');
      assert.equal(ok.version, 2); assert.equal(ok.needRevision, 2); assert.equal(ok.status, 'SUBMITTED'); assert.equal(ok.idempotentReplay, false); assert.notEqual(ok.contentHash, receipt.contentHash);
      const row = stored(receipt.responseId, per.mode);
      assert.equal(row.head_price, 8000); assert.equal(row.version_price, 8000); assert.equal(row.snapshot_task_price, 4000); assert.equal(row.head_revision, 2); assert.equal(row.hash_binds_stored_price, true); assert.equal(row.status, 'SUBMITTED');
      const replay = mustOk(await resolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 2, price: 8000, key}), 'replay'); assert.equal(replay.idempotentReplay, true); assert.equal(replay.contentHash, ok.contentHash);
      const afterReplay = fp();
      mustRefuse(await resolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 2, price: 8001, key}), 'IDEMPOTENCY_KEY_REUSED', 'the same key with another price (22023, never 40001)'); assert.deepEqual(fp(), afterReplay);
      report.stale.priceEdit = {keepRefused: refusals.keep, updateOffCanonicalRefused: refusals.update, clientRefusals: refusals.viaClient, updateCanonicalStoredVerbatim: row.head_price, replayStored: replay.idempotentReplay, reusedKeyRefused: true};
    }
    // (b) the task changes but its price does not: KEEP still passes (through the real client), and keeps the price verbatim (a positive control for the refusals above)
    {
      const {need, receipt} = await applyCanonical(per, 2, 'stale title');
      const revision = editTask(need, {title: 'PKG-049 stale title edited'});
      const keep = await ru4.resolveChangedApplication({prijavaId: receipt.responseId, ocekivanaVerzija: 1, ocekivanaPotrebaRevizija: revision, clientRequestId: randomUUID(), akcija: 'KEEP'});
      assert.deepEqual(plain(keep), {ok: true, podatak: {status: 'SUBMITTED', version: 2}}, 'KEEP at an unchanged canonical price through the real client');
      assert.equal(stored(receipt.responseId, per.mode).head_price, 6000); assert.equal(stored(receipt.responseId, per.mode).version_price, 6000); assert.equal(stored(receipt.responseId, per.mode).status, 'SUBMITTED');
      report.stale.titleEdit = {keepAccepted: keep.ok, priceVerbatim: stored(receipt.responseId, per.mode).head_price};
    }
    // (c) the basis moves PER_PERSON -> TOTAL (and the amount to 9000): 2 of 3 people can no longer be kept
    {
      const {need, receipt} = await applyCanonical(per, 2, 'stale basis');
      const revision = editTask(need, {price: 9000, basis: 'TOTAL'});
      await refuseResolve(receipt.responseId, 1, revision, 'KEEP', {}, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'KEEP of 2 of 3 people under TOTAL'); refusals.keep += 1;
      await refuseResolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 3, price: 3000}, 'FIXED_PRICE_MISMATCH', 'the bare per-person amount under TOTAL'); refusals.update += 1;
      await refuseResolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 2, price: 9000}, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'partial coverage under TOTAL'); refusals.update += 1;
      const ok = mustOk(await resolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 3, price: 9000}), 'UPDATE to the whole task at the TOTAL'); assert.equal(ok.version, 2);
      assert.equal(stored(receipt.responseId, 'MY_PRICE').head_covered, 3); assert.equal(stored(receipt.responseId, 'MY_PRICE').head_price, 9000);
      report.stale.basisEdit = {keepRefused: 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', updateWholeTaskAccepted: stored(receipt.responseId, 'MY_PRICE').head_price};
    }
    // (d) a flat (null basis) task for TWO people moves 3000 -> 3500: the open owner decision D1 (NULL basis with more than one person), characterised as it behaves today, not judged
    {
      const flat = {mode: 'MY_PRICE', price: 3000, basis: null, slots: 2};
      const {need, receipt} = await applyCanonical(flat, 2, 'stale flat');
      const revision = editTask(need, {price: 3500});
      await refuseResolve(receipt.responseId, 1, revision, 'KEEP', {}, 'FIXED_PRICE_MISMATCH', 'KEEP of 3000 under a flat 3500'); refusals.keep += 1;
      assert.equal(mustOk(await resolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 2, price: 3500}), 'UPDATE to the flat 3500').version, 2);
      report.stale.flatEdit = {keepRefused: 'FIXED_PRICE_MISMATCH', updateAccepted: stored(receipt.responseId, flat.mode).head_price, ...lib.cellReport(lib.OPEN_CELLS.D1)};
    }
    // (e) the number of people moves 2 -> 3 on a TOTAL task: the application that covered the whole task no longer does
    {
      const total = {mode: 'MY_PRICE', price: 6000, basis: 'TOTAL', slots: 2};
      const {need, receipt} = await applyCanonical(total, 2, 'stale slots');
      const revision = editTask(need, {slots: 3});
      await refuseResolve(receipt.responseId, 1, revision, 'KEEP', {}, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'KEEP of 2 people after the task asks for 3'); refusals.keep += 1;
      assert.equal(mustOk(await resolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 3, price: 6000}), 'UPDATE to all 3 at the TOTAL').version, 2);
      report.stale.slotsEdit = {keepRefused: 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', updateAllSlotsAccepted: stored(receipt.responseId, total.mode).head_price};
    }
    // (f) OFFERS: the rule is "positive", on this door too. The zero refusal is canon; the acceptance of the amount 1 is the open owner decision D4 (the OFFERS bounds), characterised, not judged
    {
      const offers = {mode: 'OFFERS', price: null, basis: null, slots: 2};
      const need = newNeed(offers, 'stale offers'), first = mustOk(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered: 2, price: 5000})), 'offers submit');
      const revision = editTask(need, {title: 'PKG-049 stale offers edited'});
      await refuseResolve(first.responseId, 1, revision, 'UPDATE', {covered: 2, price: 0}, 'INVALID_PRICE', 'OFFERS update at zero'); refusals.update += 1;
      const kept = mustOk(await resolve(first.responseId, 1, revision, 'UPDATE', {covered: 2, price: 1}), 'OFFERS update at one'); assert.equal(kept.version, 2); assert.equal(stored(first.responseId, 'OFFERS').head_price, 1);
      report.stale.offers = {zeroRefused: 'INVALID_PRICE', zeroRefusedStatus: lib.statusOf({defined: true, decision: null}), anyPositiveAccepted: stored(first.responseId, 'OFFERS').head_price, ...lib.cellReport(lib.OPEN_CELLS.D4)};
    }
    // (g) capacity checks precede the price check at THIS door too (the price sent is wrong on purpose: 1 would be FIXED_PRICE_MISMATCH)
    {
      const {need, receipt} = await applyCanonical(per, 2, 'stale capacity');
      const revision = editTask(need, {price: 4000});
      await refuseResolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 0, price: 1}, 'INVALID_COVERED_SLOTS', 'covered slots precede the price at the reconfirmation door'); refusals.capacity += 1;
      await refuseResolve(receipt.responseId, 1, revision, 'UPDATE', {covered: 4, price: 1}, 'NEED_REMAINING_CAPACITY_EXCEEDED', 'remaining capacity (3) precedes the price at the reconfirmation door'); refusals.capacity += 1;
      const small = await applyCanonical(per, 1, 'stale team capacity', stranger), smallRevision = editTask(small.need, {price: 4000});
      await refuseResolve(small.receipt.responseId, 1, smallRevision, 'UPDATE', {covered: 2, price: 1}, 'TEAM_CAPACITY_EXCEEDED', 'team capacity (stranger, 1) precedes the price at the reconfirmation door', {}, stranger); refusals.capacity += 1;
      report.stale.capacityBeforePrice = {invalidCoveredSlots: true, remainingCapacity: true, teamCapacity: true, refusals: refusals.capacity};
    }
    // (h) B24: a stale version or revision is a deterministic conflict, so it must answer HTTP 409 (PT409) at once. It runs WHENEVER the stale resolver on the chain IS the DEV body (read from the catalog: whether
    // this process converted it or the chain already carried it); the pre-B24 body would hang PostgREST 14, so when it is not the DEV body the skip is a recorded GAP with the true reason (PASS_WITH_GAPS).
    const resolverPin = pins.PINS.find(pin => pin.id === 'stale_resolver'), resolverMd5 = readMd5(SIG.stale_resolver);
    const resolverHas40001 = flag(sql(`select position('40001' in prosrc) > 0 from pg_proc where oid = to_regprocedure(${q(SIG.stale_resolver)})`));
    const resolverStage = b24Stages.find(stage => stage.id === 'stale_resolver');
    if (resolverMd5 === resolverPin.devMd5 && !resolverHas40001) {
      const {receipt} = await applyCanonical(per, 2, 'pt409'), before = fp();
      mustRefuse(await resolve(receipt.responseId, 99, 1, 'KEEP'), 'STALE_REVIEW_REQUIRED', 'a stale response version raises PT409, answered by PostgREST with HTTP 409 at once', {sqlstate: 'PT409', status: 409});
      mustRefuse(await resolve(receipt.responseId, 1, 99, 'KEEP'), 'STALE_REVIEW_REQUIRED', 'a stale need revision raises PT409, answered by PostgREST with HTTP 409 at once', {sqlstate: 'PT409', status: 409});
      assert.deepEqual(fp(), before);
      report.stale.pt409 = {status: 409, code: 'PT409', message: 'STALE_REVIEW_REQUIRED', cases: ['response version', 'need revision'], note: 'finding T14 / invariant I5; no hang, no retry', resolverMd5, resolverIsTheDevBody: true, convertedByThisRun: resolverStage?.applied === true};
    } else {
      const reason = `the stale resolver on this chain (md5 ${resolverMd5 ?? 'ABSENT'}) is not the DEV body (${resolverPin.devMd5})` + (resolverHas40001 ? ': it still carries the SQLSTATE 40001 sites that PostgREST 14 retries without end, so a stale version or revision call would hang' : '')
        + `; the in-proof B24 conversion of the stale resolver: ${resolverStage?.status ?? 'not run'}`;
      report.stale.pt409 = {skipped: true, reason, resolverMd5, resolverIsTheDevBody: false};
      report.gaps.push('PT409 (HTTP 409 for a stale response version or need revision) NOT demonstrated: ' + reason);
    }
    report.stale.refusalTotals = refusals;
    // floors, written down from the scenarios above: KEEP refused in (a), (c), (d), (e); UPDATE refused 5 x in (a), 2 x in (c), 1 x in (f); 3 through the real client; 3 capacity-before-price in (g)
    assert.deepEqual(refusals, {keep: 4, update: 8, viaClient: 3, capacity: 3}, 'P4_REFUSAL_FLOORS');
    pass(`P4_STALE_RECONFIRM_KEEP_AND_UPDATE_ARE_JUDGED_AGAINST_THE_CURRENT_TASK_EXACT_REFUSALS_STILL_STALE_NOTHING_WRITTEN_REAL_CLIENT_AND_CAPACITY_BEFORE_PRICE (${refusals.keep} KEEP, ${refusals.update} UPDATE, ${refusals.viaClient} via the client, ${refusals.capacity} capacity; `
      + `PT409 / HTTP 409 coverage: ${report.stale.pt409.skipped ? 'NOT RUN, a recorded gap' : 'observed'}; scenario (d) is the open D1 cell, the acceptance of the amount 1 in (f) the open D4 cell)`);
  }

  // =============================================================== P5 selection: no price argument, and the accepted amount is the stored version price
  const agreements = [];
  {
    const one = async (id, task, covered, price, openCell = null) => {
      const {need, receipt} = price === undefined ? await applyCanonical(task, covered, 'select ' + id) : {need: newNeed(task, 'select ' + id), receipt: null};
      const app = receipt ?? mustOk(await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered, price})), 'offers submit ' + id);
      const sent = price ?? lib.canonicalPrice(task, covered), key = randomUUID();
      const agreementId = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, app, key)), 'select ' + id);
      assert.match(agreementId, /^[0-9a-f-]{36}$/);
      const version = rows(`select price_rsd, covered_slots, content_hash from public.marketplace_response_versions where response_id = ${q(app.responseId)} and version = ${app.version}`)[0];
      const terms = agreementTerms(agreementId, 1);
      assert.equal(version.price_rsd, sent, id); assert.equal(Number(terms.terms.price_rsd), version.price_rsd, id + ': the Agreement amount is the stored version price');
      assert.equal(terms.terms.covered_slots, version.covered_slots, id); assert.equal(terms.terms.response_version, app.version, id); assert.equal(terms.content_hash, version.content_hash, id);
      assert.equal(terms.content_hash, app.contentHash, id + ': the pinned hash is the Agreement hash');
      // the activation row exists exactly once per Agreement and carries platform cost 0: that zero is guaranteed by the table's own CHECK (platform_cost_rsd = 0) and by the policy row, NOT by the price rule
      const activations = rows(`select platform_cost_rsd from private.connection_activations where agreement_id = ${q(agreementId)}`);
      assert.equal(activations.length, 1, 'ONE_ACTIVATION_ROW_PER_AGREEMENT ' + id); assert.equal(activations[0].platform_cost_rsd, 0, 'THE_PLATFORM_COST_IS_ITS_OWN_ZERO ' + id);
      const platform = activations[0].platform_cost_rsd;
      assert.equal(Number(sql(`select count(*) from public.agreements where need_id = ${q(need)}`)), 1);
      // selection replay: the same key is the same Agreement and writes nothing
      const afterSelect = fp(), replay = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, app, key)), 'select replay ' + id);
      assert.equal(replay, agreementId); assert.deepEqual(fp(), afterSelect);
      // a new key after the selection: a task that is now full is ACTIVE and refused first (NEED_NOT_OPEN, detail ACTIVE); a task with room is open, so the application's own status refuses it (RESPONSE_NOT_SELECTABLE,
      // detail SELECTED). The message is PINNED per scenario (never "either"); both are P0001 (HTTP 400) and write nothing
      const expectedSecond = lib.secondSelectionOutcome(task.slots, covered);
      const again = await call(requester.client, 'rpc_select_response', selectArgs(need, app));
      mustRefuse(again, expectedSecond.message, 'A_SECOND_SELECTION_IS_REFUSED ' + id); assert.equal(again.error.details, expectedSecond.detail, 'THE_DETAIL_SAYS_WHICH_STATUS_REFUSED ' + id); assert.deepEqual(fp(), afterSelect);
      agreements.push({id, agreementId, need, responseId: app.responseId, task, covered, taskPrice: task.price, versionPrice: version.price_rsd, requester: requester.id, worker: worker.id});
      report.selection[id] = {taskPrice: task.price, basis: task.basis, covered, storedVersionPrice: version.price_rsd, agreementV1Price: Number(terms.terms.price_rsd), agreementCovered: terms.terms.covered_slots, hashEqual: terms.content_hash === version.content_hash,
        platformCostRsd: platform, activationRows: activations.length, replayAgreement: replay === agreementId, secondSelectionRefused: again.error.message, secondSelectionDetail: again.error.details, ...(openCell === null ? {} : lib.cellReport(openCell))};
    };
    await one('null_basis', {mode: 'MY_PRICE', price: 3000, basis: null, slots: 1}, 1);
    await one('per_person', {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 6}, 2);
    await one('total', {mode: 'MY_PRICE', price: 9000, basis: 'TOTAL', slots: 3}, 3);
    await one('offers_int4_max', {mode: 'OFFERS', price: null, basis: null, slots: 2}, 2, lib.INT4_MAX, lib.OPEN_CELLS.D4);   // the int4-max acceptance is the open OFFERS bound D4
    pass('P5_SELECTION_COPIES_THE_STORED_VERSION_PRICE_REPLAYS_ONE_ACTIVATION_ROW_EACH_AND_A_SECOND_SELECTION_IS_REFUSED_WITH_THE_PINNED_MESSAGE_AND_DETAIL (the platform cost 0 is the activation table CHECK, not the price rule; offers_int4_max is the open D4 cell)');

    // several applications to ONE task: each selected application becomes its own Agreement at its own price (finding section 5)
    {
      const multi = async (id, task, plan, openCell = null) => {
        const need = newNeed(task, 'multi ' + id), submitted = [];
        for (const entry of plan) {
          const price = entry.price ?? lib.canonicalPrice(task, entry.covered);
          submitted.push({entry, price, receipt: mustOk(await call(entry.actor.client, 'rpc_submit_response', submitArgs(need, {covered: entry.covered, price, profile: entry.actor.workerProfile})), `multi submit ${id}`)});
        }
        const made = [];
        for (const {entry, price, receipt} of submitted) {
          const agreementId = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), `multi select ${id} c${entry.covered}`);
          const terms = agreementTerms(agreementId, 1);
          assert.equal(Number(terms.terms.price_rsd), price, `${id}: the Agreement is at the application's OWN price`); assert.equal(terms.terms.covered_slots, entry.covered); assert.equal(terms.terms.response_version, receipt.version); assert.equal(terms.content_hash, receipt.contentHash);
          made.push({agreementId, price, covered: entry.covered});
        }
        assert.equal(needState(need).agreements, plan.length, id + ': one Agreement per selected application'); assert.equal(new Set(made.map(item => item.agreementId)).size, plan.length);
        assert.equal(needStatus(need), 'ACTIVE', id + ': the task is full once every place is taken');
        report.selection[id] = {agreements: made.length, prices: made.map(item => item.price), covered: made.map(item => item.covered), needStatus: needStatus(need), ...(openCell === null ? {} : lib.cellReport(openCell))};
      };
      await multi('two_partial_per_person', {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 6}, [{actor: worker, covered: 2}, {actor: reader, covered: 4}]);   // 2 x 3000 and 4 x 3000
      assert.deepEqual(report.selection.two_partial_per_person.prices, [6000, 12000]);
      await multi('two_offers', {mode: 'OFFERS', price: null, basis: null, slots: 3}, [{actor: worker, covered: 1, price: 5000}, {actor: reader, covered: 2, price: 12345}], lib.OPEN_CELLS.D4);   // the accepted OFFERS amounts are the open D4 cell
      assert.deepEqual(report.selection.two_offers.prices, [5000, 12345]);
      pass('P5_TWO_PARTIAL_APPLICATIONS_ON_ONE_TASK_EACH_BECOME_THEIR_OWN_AGREEMENT_AT_THEIR_OWN_PRICE_PER_PERSON_AND_OFFERS (the OFFERS amounts 5000 and 12345 are the open D4 cell)');
    }

    // the call carries no price: the signature (P1) and an attempt to give it one. Exact outcomes.
    const probe = await applyCanonical({mode: 'MY_PRICE', price: 3000, basis: null, slots: 1}, 1, 'select with a price'), beforeProbe = fp();
    const extra = await call(requester.client, 'rpc_select_response', {...selectArgs(probe.need, probe.receipt), p_price_rsd: 1});
    mustMatch(extra, {statuses: [404], codes: ['PGRST202']}, 'A_SELECT_CALL_CANNOT_BE_GIVEN_A_PRICE'); assert.deepEqual(fp(), beforeProbe);
    report.selection.priceArgumentRefused = {status: extra.status, code: extra.error.code};
    for (const [label, client] of [['a stranger', stranger.client], ['the worker', worker.client]]) {
      mustRefuse(await call(client, 'rpc_select_response', selectArgs(probe.need, probe.receipt)), 'NOT_REQUESTER', label + ' cannot select'); assert.deepEqual(fp(), beforeProbe);
    }
    mustMatch(await call(rt.anon, 'rpc_select_response', selectArgs(probe.need, probe.receipt)), {statuses: [401, 403], codes: ['42501']}, 'AN_ANONYMOUS_CALLER_CANNOT_SELECT'); assert.deepEqual(fp(), beforeProbe);
    pass('P5_NO_PRICE_ARGUMENT_AND_ONLY_THE_REQUESTER_SELECTS_EXACT_OUTCOMES');

    // selection is bound to the pinned (revision, version, content hash): a modified requester client cannot select at another price
    {
      const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3};
      const {need, receipt} = await applyCanonical(per, 2, 'select pins'), before = fp();
      const flipHex = hash => hash.slice(0, 63) + (hash.endsWith('0') ? '1' : '0');
      const otherPriceHash = hashOf(receipt.responseId, per.mode, 6001);
      assert.match(otherPriceHash, /^[a-f0-9]{64}$/); assert.notEqual(otherPriceHash, receipt.contentHash, 'A_DIFFERENT_PRICE_GIVES_A_DIFFERENT_HASH'); assert.equal(hashOf(receipt.responseId, per.mode, 6000), receipt.contentHash, 'THE_HASH_FORMULA_REPRODUCES_THE_SERVERS');
      // the SAME message (STALE_REVIEW_REQUIRED, P0001) comes from five guards: the DETAIL says WHICH one refused, so each attempt is tied to its own guard (lib.FORGED_PIN_PLAN, tied to the p0d03 source by a unit test)
      const forgedFor = {flipped_hash_digit: {...receipt, contentHash: flipHex(receipt.contentHash)}, hash_binding_another_price: {...receipt, contentHash: otherPriceHash},
        response_version_plus_one: {...receipt, version: receipt.version + 1}, need_revision_plus_one: {...receipt, needRevision: receipt.needRevision + 1}};
      assert.deepEqual(Object.keys(forgedFor).sort(), lib.FORGED_PIN_PLAN.map(item => item.id).sort(), 'EVERY_FORGED_ATTEMPT_OF_THE_PLAN_IS_BUILT');
      const refusedBy = {};
      for (const item of lib.FORGED_PIN_PLAN) {
        const refusal = await call(requester.client, 'rpc_select_response', selectArgs(need, forgedFor[item.id]));
        mustRefuse(refusal, 'STALE_REVIEW_REQUIRED', 'selection with ' + item.label);
        assert.equal(refusal.error.details, item.detail, `THE_DETAIL_NAMES_THE_GUARD_THAT_REFUSED (${item.label} -> ${item.detail}): ${JSON.stringify(refusal.error)}`); refusedBy[item.id] = refusal.error.details;
        assert.deepEqual(fp(), before, 'NOTHING_WRITTEN ' + item.label); assert.equal(needState(need).agreements, 0); assert.equal(stored(receipt.responseId, per.mode).status, 'SUBMITTED');
      }
      assert.deepEqual([...new Set(Object.values(refusedBy))].sort(), ['content_hash', 'need_revision', 'response_version'], 'THREE_DISTINCT_GUARDS_WERE_REACHED');
      const agreementId = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), 'the pinned (revision, version, hash) selects');
      assert.equal(Number(agreementTerms(agreementId, 1).terms.price_rsd), 6000, 'THE_AGREEMENT_IS_AT_THE_STORED_PRICE_AFTER_THE_FORGED_ATTEMPTS');
      report.selection.pinnedTriple = {forgedAttemptsRefused: lib.FORGED_PIN_PLAN.map(item => item.label), refusedByGuard: refusedBy, refusal: 'STALE_REVIEW_REQUIRED P0001 HTTP 400', agreementPrice: 6000};
      pass('P5_SELECTION_IS_BOUND_TO_THE_PINNED_REVISION_VERSION_AND_CONTENT_HASH_EACH_FORGED_ATTEMPT_IS_REFUSED_BY_ITS_OWN_GUARD_AND_A_HASH_THAT_BINDS_ANOTHER_PRICE_IS_REFUSED (content_hash x2, response_version, need_revision)');
    }

    // selection re-asserts the rule against the CURRENT task (the helper's own refusals; no earlier guard can fire here: the status, revision, version and hash are all valid)
    {
      const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3};
      const {need, receipt} = await applyCanonical(per, 2, 'select flip');
      await pageReady(requester.client, need);
      const candidate = async () => (mustOk(await call(requester.client, 'rpc_list_need_candidates', {p_need_id: need}), 'candidates')).find(item => item.responseId === receipt.responseId);
      const pageItem = async () => { const page = mustOk(await call(requester.client, 'rpc_list_need_candidates_page', {p_need_id: need, p_limit: 10}), 'page'); const item = page.items.find(entry => entry.responseId === receipt.responseId); assert.ok(item, 'THE_PAGE_HAS_THE_APPLICATION'); return item; };
      // the DEV-faithful read of the computed column: through rpc_read_task (PKG-045b P0 revoked table SELECT on public.needs on DEV; the app reads it only through rpc_read_task)
      const countOf = async () => mustOk(await call(requester.client, 'rpc_read_task', {p_need_id: need}), 'rpc_read_task').selectable_application_count;
      const seen = await candidate(); assert.equal(seen.state, 'SELECTABLE'); assert.equal(seen.canSelect, true); assert.equal(seen.priceRsd, 6000); assert.equal(await countOf(), 1);
      assert.equal((await pageItem()).state, 'SELECTABLE', 'THE_PAGE_READER_SHOWS_IT_SELECTABLE_WHILE_THE_TASK_AGREES');
      flip(need, "price_basis = 'TOTAL'");
      const stale = await candidate(); assert.equal(stale.state, 'STALE', 'THE_CANDIDATE_READER_CALLS_THE_HELPER'); assert.equal(stale.canSelect, false);
      const countWhileStale = await countOf(); assert.equal(countWhileStale, 0, 'THE_COMPUTED_COUNT_FOLLOWS_THE_HELPER');
      const staleOnPage = await pageItem(); assert.equal(staleOnPage.state, 'STALE', 'THE_PAGE_READER_CALLS_THE_HELPER'); assert.equal(staleOnPage.canSelect, false);
      const before = fp();
      mustRefuse(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'selection under the flipped basis');
      assert.deepEqual(fp(), before); assert.equal(needState(need).agreements, 0); assert.equal(stored(receipt.responseId, 'MY_PRICE').status, 'SUBMITTED');
      flip(need, "price_basis = 'PER_PERSON', requester_price_rsd = 3100");
      const beforePrice = fp();   // the fixture just moved the task, so the "nothing written" baseline is taken after it
      assert.equal((await candidate()).state, 'STALE'); assert.equal((await pageItem()).state, 'STALE'); assert.equal(await countOf(), 0);
      mustRefuse(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), 'FIXED_PRICE_MISMATCH', 'selection under a moved price'); assert.deepEqual(fp(), beforePrice);
      flip(need, "requester_price_rsd = 3000");
      assert.equal((await candidate()).state, 'SELECTABLE', 'THE_REFUSAL_WAS_THE_PRICE_RULE_NOT_ANOTHER_STATE'); assert.equal((await pageItem()).state, 'SELECTABLE', 'THE_PAGE_READER_IS_SELECTABLE_AFTER_THE_RESTORE'); assert.equal(await countOf(), 1);
      const agreementId = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), 'selection once the task agrees again'); assert.match(agreementId, /^[0-9a-f-]{36}$/);
      report.selection.reassertAgainstCurrentTask = {fixture: FLIP_FIXTURE, basisFlipRefused: 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', priceFlipRefused: 'FIXED_PRICE_MISMATCH', candidateStateWhileDisagreeing: stale.state, pageReaderStateWhileDisagreeing: staleOnPage.state,
        selectableCountWhileDisagreeing: countWhileStale, selectableAfterRestore: true, countReadThrough: 'rpc_read_task'};
      pass('P5_SELECTION_AND_BOTH_CANDIDATE_READERS_RE_ASSERT_THE_RULE_AGAINST_THE_CURRENT_TASK (' + FLIP_FIXTURE + ')');
    }
    // a task edited after the application: the guards that PRECEDE the price rule (revision pin, response status) refuse it. These refusals hold even with the helper removed (P8 does not claim them), so nothing price-related is asserted here
    // except the last step: the reconfirmed application is selected at the NEW price, never the old one.
    {
      const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3};
      const {need, receipt} = await applyCanonical(per, 2, 'select after edit');
      const revision = editTask(need, {price: 4000}), before = fp();
      mustRefuse(await call(requester.client, 'rpc_select_response', selectArgs(need, receipt)), 'STALE_REVIEW_REQUIRED', 'the old pinned revision is refused by the revision pin (before the price rule)');
      mustRefuse(await call(requester.client, 'rpc_select_response', selectArgs(need, {...receipt, needRevision: revision})), 'RESPONSE_NOT_SELECTABLE', 'the new revision pinned to the stale application is refused by the status guard (before the price rule)');
      assert.deepEqual(fp(), before); assert.equal(needState(need).agreements, 0);
      const resolved = mustOk(await call(worker.client, 'rpc_resolve_stale_response_after_need_edit', resolveArgs(receipt.responseId, {version: 1, revision, action: 'UPDATE', covered: 2, price: 8000})), 'reconfirm at the new price');
      const agreementId = mustOk(await call(requester.client, 'rpc_select_response', selectArgs(need, resolved)), 'selection of the reconfirmed version');
      assert.equal(Number(agreementTerms(agreementId, 1).terms.price_rsd), 8000, 'THE_AGREEMENT_IS_AT_THE_NEW_PRICE_NEVER_THE_OLD_ONE');
      report.selection.guardsBeforeThePriceRule = {oldPinRefusedByTheRevisionGuard: 'STALE_REVIEW_REQUIRED', newRevisionStaleApplicationRefusedByTheStatusGuard: 'RESPONSE_NOT_SELECTABLE', note: 'refused by guards that precede the price rule: not price evidence',
        priceRelevantPositive: {reconfirmedAgreementPrice: Number(agreementTerms(agreementId, 1).terms.price_rsd)}};
      pass('P5_THE_GUARDS_THAT_PRECEDE_THE_PRICE_RULE_REFUSE_A_STALE_PIN_AND_THE_RECONFIRMED_APPLICATION_IS_SELECTED_AT_THE_NEW_PRICE');
    }
  }

  // =============================================================== P6 the REAL client services against the real server
  {
    const log = [], readerClient = counted(reader.client, log);
    const wMods = loadModules({client: readerClient, accountId: reader.id}), rMods = loadModules({client: requester.client, accountId: requester.id}); loaders.push(wMods, rMods);
    const submitService = wMods.load('data/applicationSelectionClientService'), presentation = wMods.load('data/needDetailPresentation'), mine = wMods.load('data/applicationClientService').applicationClientService;
    const needService = wMods.load('data/needClientService').needClientService, legacy = wMods.load('data/legacyRpcFailure');
    const candidates = rMods.load('data/candidateClientService').candidateClientService, select = rMods.load('data/applicationSelectionClientService').applicationSelectionClientService;
    const agreementService = rMods.load('data/agreementClientService').agreementClientService;
    // D1: a NULL-basis task for several people is open (characterised, not judged); D4: the amount an OFFERS applicant types is open
    const flows = [
      {id: 'null_basis', task: {mode: 'MY_PRICE', price: 3000, basis: null, slots: 3}, people: 2, typed: null, label: lib.OPEN_CELLS.D1},
      {id: 'per_person', task: {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3}, people: 2, typed: null, label: {defined: true, decision: null}},
      // This historical server accepts the full crew. Explicitly choose that case;
      // today's UI also permits partial crews, proven in the separate proportional-price package.
      {id: 'total', task: {mode: 'MY_PRICE', price: 9000, basis: 'TOTAL', slots: 3}, people: 3, typed: null, label: {defined: true, decision: null}},
      {id: 'offers', task: {mode: 'OFFERS', price: null, basis: null, slots: 3}, people: 2, typed: 12345, label: lib.OPEN_CELLS.D4},
    ];
    for (const flow of flows) {
      const need = newNeed(flow.task, 'client ' + flow.id);
      // the task as the APPLICANT's app reads it: the real needClientService (rpc_read_task, the real decoder), never a hand-built object
      const task = await needService.potreba(need);
      assert.ok(task, 'THE_APPLICANT_READS_THE_TASK ' + flow.id);
      assert.equal(task.rezimCene, flow.task.mode, flow.id + ' decoded price mode'); assert.equal(task.osnovaCene, flow.task.basis ?? null, flow.id + ' decoded price basis (osnovaCene)');
      assert.equal(task.ponudjenaCena?.iznos ?? null, flow.task.price ?? null, flow.id + ' decoded task price'); assert.equal(task.pokrivenost.ukupno, flow.task.slots, flow.id + ' decoded required slots');
      const people = flow.people;
      const price = presentation.fixedApplicationPrice(task, people) ?? flow.typed;
      assert.ok(Number.isInteger(price) && price > 0, 'THE_CLIENT_COMPOSES_A_PRICE ' + flow.id);
      assert.equal(price, lib.canonicalPrice(flow.task, people) ?? flow.typed, 'THE_CLIENTS_DERIVATION_FROM_THE_DECODED_TASK_EQUALS_THE_SERVERS_RULE ' + flow.id);
      const submitted = await submitService.applicationSelectionClientService.podnesiPrijavu({potrebaId: need, potrebaRevizija: task.revizija, radnikProfilId: reader.workerProfile, pokrivenaMesta: people, cenaRsd: price,
        predlozeniPocetak: null, predlozeniKraj: null, napomena: null, clientRequestId: randomUUID()});
      assert.equal(submitted.ok, true, flow.id + ' ' + JSON.stringify(submitted));
      const row = stored(submitted.podatak.prijavaId, flow.task.mode); assert.equal(row.head_price, price); assert.equal(row.version_price, price); assert.equal(row.hash_binds_stored_price, true);
      const own = (await mine.mojePrijave()).find(item => item.prijavaId === submitted.podatak.prijavaId);
      assert.ok(own, 'MY_APPLICATIONS_SHOWS_IT ' + flow.id); assert.equal(own.cena.iznos, price, 'the worker reads the stored price back'); assert.equal(own.pokrivaMesta, people);
      const listed = (await candidates.prijaveZaPotrebu(need)).find(item => item.prijavaId === submitted.podatak.prijavaId);
      assert.ok(listed, 'THE_REQUESTER_SEES_IT ' + flow.id); assert.equal(listed.cena.iznos, price); assert.equal(listed.stanje, 'SELECTABLE'); assert.equal(listed.mozeIzabrati, true); assert.equal(listed.hash, submitted.podatak.hash);
      const chosen = await select.izaberiPrijavu({potrebaId: need, potrebaRevizija: task.revizija, prijavaId: listed.prijavaId, prijavaVerzija: listed.verzija, mesta: listed.pokrivaMesta, prijavaHash: listed.hash, clientRequestId: randomUUID()});
      assert.equal(chosen.ok, true, flow.id + ' ' + JSON.stringify(chosen));
      const agreement = await agreementService.dogovor(chosen.podatak.dogovorId);
      assert.equal(agreement.cena.iznos, price, 'the Dogovor shows the server price'); assert.equal(agreement.verzija, 1);
      report.client[flow.id] = {status: lib.statusOf(flow.label), decodedTask: {mode: task.rezimCene, basis: task.osnovaCene, price: task.ponudjenaCena?.iznos ?? null, slots: task.pokrivenost.ukupno}, people, composedPrice: price, storedPrice: row.head_price,
        workerReadback: own.cena.prikaz, requesterReadback: listed.cena.prikaz, agreementReadback: agreement.cena.prikaz};
    }
    assert.equal(Object.keys(report.client).filter(key => flows.some(flow => flow.id === key)).length, flows.length);
    report.clientFlows = flows.map(flow => ({id: flow.id, ...report.client[flow.id]}));   // rendered as a table in the markdown report and the workflow summary (the CANON / PINNED_TO_TODAY status of null_basis D1 and offers D4 is visible there)
    pass('P6_THE_TASK_DECODED_BY_THE_REAL_CLIENT_GIVES_THE_PRICE_THE_SERVER_ACCEPTS_AND_EVERY_READBACK_SHOWS_THE_SERVER_PRICE (null_basis D1 and offers D4 pinned to today)');
    // refusals through the real client: the Serbian sentence is the outcome, compared with the LITERAL owner copy (lib.SERBIAN_COPY); whether it is "conclusive" is RECORDED (finding D10), not judged
    const refusalFlows = [
      {message: 'FIXED_PRICE_NOT_READY', task: {mode: 'MY_PRICE', price: null, basis: null, slots: 1}, people: 1, price: 3000},
      {message: 'FIXED_PRICE_MISMATCH', task: {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3}, people: 2, price: 3000},
      {message: 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', task: {mode: 'MY_PRICE', price: 9000, basis: 'TOTAL', slots: 3}, people: 1, price: 9000},
    ];
    report.client.refusals = {};
    for (const item of refusalFlows) {
      const need = newNeed(item.task, 'client refusal ' + item.message), before = fp(), calls = log.length;
      const result = await submitService.applicationSelectionClientService.podnesiPrijavu({potrebaId: need, potrebaRevizija: 1, radnikProfilId: reader.workerProfile, pokrivenaMesta: item.people, cenaRsd: item.price,
        predlozeniPocetak: null, predlozeniKraj: null, napomena: null, clientRequestId: randomUUID()});
      assert.equal(result.ok, false); assert.equal(result.kod, item.message); assert.equal(result.poruka, lib.SERBIAN_COPY.application[item.message], 'THE_LITERAL_SERBIAN_SENTENCE ' + item.message); assert.equal(log.length, calls + 1, 'ONE_RPC_WAS_SENT'); assert.deepEqual(fp(), before);
      report.client.refusals[item.message] = {kod: result.kod, poruka: result.poruka, conclusiveApplicationRefusal: submitService.conclusiveApplicationRefusal(result)};
    }
    // both client maps know the five helper messages and say the owner's literal sentence for each (the new-offer map and the reconfirmation map)
    const errors = submitService.applicationSelectionErrors;
    for (const code of pins.HELPER_VOCABULARY.map(item => item.message)) {
      assert.equal(errors[code], lib.SERBIAN_COPY.application[code], 'THE_APPLICATION_ERROR_MAP_SAYS ' + code); assert.equal(legacy.knownLegacyRefusal(code), true, 'THE_LEGACY_MAP_HAS ' + code);
      assert.deepEqual(plain(legacy.legacyRpcFailure({message: code}, 'FALLBACK', 'fallback')), {ok: false, kod: code, poruka: lib.SERBIAN_COPY.legacy[code]}, 'THE_LEGACY_SENTENCE_FOR ' + code);
    }
    const sent = log.length, invalid = await submitService.applicationSelectionClientService.podnesiPrijavu({potrebaId: newNeed({mode: 'OFFERS', price: null, basis: null, slots: 1}, 'client invalid'), potrebaRevizija: 1,
      radnikProfilId: reader.workerProfile, pokrivenaMesta: 1, cenaRsd: 0, predlozeniPocetak: null, predlozeniKraj: null, napomena: null, clientRequestId: randomUUID()});
    assert.equal(invalid.ok, false); assert.equal(invalid.kod, 'APPLICATION_COMMAND_INVALID'); assert.equal(log.length, sent, 'A_ZERO_PRICE_NEVER_LEAVES_THE_CLIENT');
    // a refusal the client does not know (a NEW server message) never leaks backend text: it is the generic "outcome not confirmed"
    const stub = loadModules({client: {rpc: async () => ({data: null, error: {code: '22023', message: 'PKG049_A_MESSAGE_NOBODY_LISTS', details: null, hint: null}})}, accountId: reader.id}); loaders.push(stub);
    const unknown = await stub.load('data/applicationSelectionClientService').applicationSelectionClientService.podnesiPrijavu({potrebaId: randomUUID(), potrebaRevizija: 1, radnikProfilId: reader.workerProfile, pokrivenaMesta: 1,
      cenaRsd: 3000, predlozeniPocetak: null, predlozeniKraj: null, napomena: null, clientRequestId: randomUUID()});
    assert.equal(unknown.ok, false); assert.equal(unknown.kod, 'APPLICATION_SELECTION_UNCONFIRMED'); assert.equal(JSON.stringify(unknown).includes('PKG049_A_MESSAGE_NOBODY_LISTS'), false);
    report.client.unknownMessage = {kod: unknown.kod, leaksBackendText: false};
    // selection through the real client under a moved task: the sentence of the price rule (the task move is a FIXTURE: no revision bump, triggers off)
    const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3}, {need, receipt} = await applyCanonical(per, 2, 'client select flip', reader);
    flip(need, "price_basis = 'TOTAL'");
    const refused = await select.izaberiPrijavu({potrebaId: need, potrebaRevizija: 1, prijavaId: receipt.responseId, prijavaVerzija: receipt.version, mesta: 2, prijavaHash: receipt.contentHash, clientRequestId: randomUUID()});
    assert.equal(refused.ok, false); assert.equal(refused.kod, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS'); assert.equal(refused.poruka, lib.SERBIAN_COPY.application.TOTAL_PRICE_REQUIRES_ALL_SLOTS, 'THE_LITERAL_SERBIAN_SENTENCE'); assert.equal(needState(need).agreements, 0);
    report.client.selectionRefusal = {fixture: FLIP_FIXTURE, kod: refused.kod, poruka: refused.poruka};
    report.client.sources = [...new Map(loaders.flatMap(loader => loader.sources).map(item => [item.path, item])).values()].sort((a, b) => a.path.localeCompare(b.path));
    pass('P6_PRICE_REFUSALS_ARE_THE_CLIENTS_OWN_LITERAL_SENTENCES_A_ZERO_PRICE_NEVER_LEAVES_THE_CLIENT_AND_SELECTION_REFUSES_THE_SAME_WAY (selection flip: ' + FLIP_FIXTURE + ')');
  }

  // =============================================================== P7 Agreement change: CHARACTERISED, not judged. OPEN OWNER DECISION D3.
  {
    const D3 = lib.OPEN_CELLS.D3;
    const d3 = {label: 'OPEN OWNER DECISION D3 (characterised as it behaves today, NOT judged): may a MY_PRICE Agreement be repriced by consent?', acceptCallArguments: report.signatures.respond, rows: [], invalidPatches: [], cellStatus: lib.statusOf(D3)};
    const propose = (client, agreement, version, patch, key = randomUUID()) => call(client, 'rpc_propose_agreement_change_v2', {p_agreement_id: agreement, p_expected_version: version, p_patch: patch, p_reason: 'PKG-049 D3 characterization', p_client_request_id: key});
    const respond = (client, proposal, accept) => call(client, 'rpc_respond_agreement_change', {p_proposal_id: proposal, p_accept: accept});
    const price = (agreement, version) => Number(agreementTerms(agreement, version).terms.price_rsd);
    const myPriceAgreements = agreements.filter(entry => entry.task.mode === 'MY_PRICE');
    assert.equal(myPriceAgreements.length, 3, 'P7_ONE_AGREEMENT_PER_BASIS (null, PER_PERSON, TOTAL)');
    // the agreements page reader is NOT optional: pkg023a creates it (replayed by stage 04, pkg027 proof) and the leg below always runs. The EX-04C version of the same reader (rating state) is not on the chain: see notVerified.
    assert.ok(exists(AGREEMENTS_PAGE_SIGNATURE), 'THE_AGREEMENTS_PAGE_READER_EXISTS (pkg023a, replayed by stage 04): the page-reader leg of the Agreement readback is mandatory');
    const offerCard = async responseId => {
      const list = mustOk(await call(worker.client, 'rpc_list_my_applications', {}), 'my applications'), card = list.find(entry => entry.applicationId === responseId);
      assert.ok(card, 'THE_OFFER_CARD_EXISTS'); return card;
    };
    for (const item of myPriceAgreements) {
      const rowReport = {basis: item.task.basis, taskPrice: item.taskPrice, covered: item.covered, agreementV1Price: price(item.agreementId, 1), accepted: [], status: lib.statusOf(D3)};
      assert.equal(rowReport.agreementV1Price, item.versionPrice);
      const proposals = () => Number(sql(`select count(*) from public.agreement_change_proposals where agreement_id = ${q(item.agreementId)}`));
      // the amounts the change flow refuses (INVALID_PRICE): written nothing
      for (const patch of [{price_rsd: 0}, {price_rsd: -1}, {price_rsd: lib.INT4_MAX + 1}, {price_rsd: 3000.5}, {price_rsd: '3000'}, {price_rsd: null}]) {
        const before = proposals(), response = await propose(worker.client, item.agreementId, 1, patch);
        mustRefuse(response, 'INVALID_PRICE', 'change patch ' + JSON.stringify(patch)); assert.equal(proposals(), before);
        if (item === myPriceAgreements[0]) d3.invalidPatches.push({patch: JSON.stringify(patch), message: response.error.message, sqlstate: response.error.code});
      }
      // any whole number 1..2147483647 is accepted by the OTHER party's consent, whatever the task says; the accept call carries no amount
      let version = 1;
      for (const [proposer, responder, amount] of [[worker, requester, 1], [requester, worker, lib.INT4_MAX], [worker, requester, item.taskPrice]]) {
        const proposal = mustOk(await propose(proposer.client, item.agreementId, version, {price_rsd: amount}), `propose ${amount}`);
        assert.match(proposal, /^[0-9a-f-]{36}$/);
        const answer = mustOk(await respond(responder.client, proposal, true), `accept ${amount}`);
        assert.equal(answer.accepted, true); assert.equal(answer.agreementVersion, version + 1); version += 1;
        assert.equal(price(item.agreementId, version), amount, 'THE_ACCEPTED_AMOUNT_IS_THE_PROPOSED_ONE');
        rowReport.accepted.push({version, amount, equalsTaskPrice: amount === item.taskPrice});
        if (rowReport.accepted.length === 1) {
          // the readback after the FIRST accepted amendment (amount 1): the Dogovor shows the amended amount while the worker's offer card keeps the application's own price: recorded, not judged (D3)
          const workspace = mustOk(await call(requester.client, 'rpc_get_agreement_workspace', {p_agreement_id: item.agreementId}), 'workspace after the amendment');
          const card = await offerCard(item.responseId), dogovorPrice = Number(workspace.terms.price_rsd);
          assert.equal(dogovorPrice, amount, 'THE_DOGOVOR_SHOWS_THE_AMENDED_AMOUNT');
          // ASSERTED (not merely recorded): the card key exists and is a whole number, the card keeps the application's own price and the Dogovor differs. An owner D3 lock turns exactly this assertion red, on purpose.
          assert.deepEqual(lib.offerCardProblems(card, {applicationPrice: item.versionPrice, dogovorPrice}), [], 'THE_OFFER_CARD_KEEPS_THE_APPLICATION_PRICE_WHILE_THE_DOGOVOR_SHOWS_THE_AMENDED_AMOUNT (open D3, pinned to today)');
          rowReport.offerCardDivergence = {offerCardPrice: card.priceRsd, dogovorPrice, diverges: card.priceRsd !== dogovorPrice, asserted: true, label: lib.statusOf(D3)};
          if (!d3.offerCardDivergence) d3.offerCardDivergence = {basis: item.task.basis, ...rowReport.offerCardDivergence};
        }
      }
      assert.equal(price(item.agreementId, 1), item.versionPrice, 'VERSION_1_IS_UNTOUCHED_HISTORY');
      assert.equal(Number(sql(`select requester_price_rsd from public.needs where id = ${q(item.need)}`)), item.taskPrice, 'THE_TASK_PRICE_IS_UNTOUCHED');
      const refusedProposal = mustOk(await propose(worker.client, item.agreementId, version, {price_rsd: 5000}), 'propose then reject');
      const rejected = mustOk(await respond(requester.client, refusedProposal, false), 'reject'); assert.equal(rejected.accepted, false); assert.equal(rejected.agreementVersion, version);
      assert.equal(Number(sql(`select current_version from public.agreements where id = ${q(item.agreementId)}`)), version);
      // the Agreement readback after the accepted amendments: the workspace and both list readers show the CURRENT terms (price of the last accepted version, the response version unchanged)
      const finalAmount = price(item.agreementId, version);
      const workspace = mustOk(await call(requester.client, 'rpc_get_agreement_workspace', {p_agreement_id: item.agreementId}), 'workspace');
      assert.equal(workspace.currentVersion, version); assert.equal(Number(workspace.terms.price_rsd), finalAmount, 'THE_WORKSPACE_TERMS_PRICE_IS_THE_LAST_ACCEPTED_AMOUNT'); assert.equal(workspace.terms.response_version, 1, 'THE_AMENDMENT_LEAVES_THE_RESPONSE_VERSION_ALONE');
      const listed = mustOk(await call(requester.client, 'rpc_list_my_agreements', {}), 'list').find(entry => entry.id === item.agreementId);
      assert.ok(listed, 'THE_LIST_HAS_THE_AGREEMENT'); assert.equal(listed.currentVersion, version); assert.equal(Number(listed.terms.price_rsd), finalAmount, 'THE_LIST_TERMS_PRICE_IS_THE_LAST_ACCEPTED_AMOUNT');
      const page = mustOk(await call(requester.client, 'rpc_list_my_agreements_page', {p_scope: 'ALL', p_limit: 100, p_before_at: null, p_before_id: null}), 'list page');
      const pageItem = page.items.find(entry => entry.id === item.agreementId);
      assert.ok(pageItem, 'THE_PAGE_HAS_THE_AGREEMENT'); assert.equal(Number(pageItem.terms.price_rsd), finalAmount, 'THE_PAGE_TERMS_PRICE_IS_THE_LAST_ACCEPTED_AMOUNT');
      rowReport.finalVersion = version; rowReport.finalAmount = finalAmount; rowReport.workspaceTermsPrice = Number(workspace.terms.price_rsd); rowReport.workspaceTermsPriceEqualsFinalAmount = true; rowReport.listReadersAgree = true; rowReport.pageReaderChecked = true;
      d3.rows.push(rowReport);
    }
    assert.equal(d3.rows.length, 3, 'P7_D3_ROWS'); assert.ok(d3.rows.every(row => row.accepted.length === 3), 'P7_THREE_ACCEPTED_AMENDMENTS_PER_ROW'); assert.ok(d3.offerCardDivergence, 'P7_THE_OFFER_CARD_DIVERGENCE_IS_RECORDED');
    // an OFFERS Agreement is bilateral by design (its price IS the offer); recorded for contrast
    const offersAgreement = agreements.find(entry => entry.task.mode === 'OFFERS');
    const proposal = mustOk(await propose(worker.client, offersAgreement.agreementId, 1, {price_rsd: 4321}), 'offers change'); mustOk(await respond(requester.client, proposal, true), 'offers accept');
    d3.offersContrast = {agreementV1Price: offersAgreement.versionPrice, acceptedV2Price: price(offersAgreement.agreementId, 2)};
    d3.pinnedToToday = 'This block pins the behaviour of today (bilateral consent, no tie to the task price, basis or mode; the offer card keeps the application price while the Dogovor shows the amended one). An owner-selected D3 lock turns exactly this block RED; update it deliberately in that candidate. Cell status: ' + lib.statusOf(D3) + '.';
    d3.notCovered = 'A price patch spelled 100.0 (stored as the text 100.0, finding SA-SEL-20) cannot be sent through JSON.stringify and is not exercised here.';
    report.d3 = d3;
    pass('P7_AGREEMENT_CHANGE_CHARACTERISED_ANY_WHOLE_NUMBER_BY_CONSENT_NO_AMOUNT_IN_THE_ACCEPT_CALL_READBACKS_SHOW_THE_LAST_ACCEPTED_AMOUNT_OPEN_OWNER_DECISION_D3');
  }

  // the price tuples of EVERY row this run created in P1b..P7 (the rows P8 does not own), taken immediately before P8 and compared again in P9: the weaken/restore DDL of P8 must not have touched them
  const known = new Set([...existing.needs, ...existing.responses, ...existing.agreements]), ours = rowIds('ours');
  const createdIds = {needs: ours.needs.filter(id => !known.has(id)), responses: ours.responses.filter(id => !known.has(id)), agreements: ours.agreements.filter(id => !known.has(id))};
  assert.ok(createdIds.needs.length >= 30 && createdIds.responses.length >= 25 && createdIds.agreements.length >= 12, 'P9_THE_SECOND_SNAPSHOT_IS_NOT_VACUOUS: ' + JSON.stringify({needs: createdIds.needs.length, responses: createdIds.responses.length, agreements: createdIds.agreements.length}));
  const createdTuplesBeforeP8 = priceTuples(createdIds);

  // =============================================================== P8 weakening probes: the proof is not vacuous
  {
    const per = {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3};
    const PRED = {
      async submit() {   // the submit door: a price one unit off is refused and nothing is written
        const need = newNeed({mode: 'MY_PRICE', price: 3000, basis: null, slots: 1}, 'probe submit'), before = fp();
        const response = await call(worker.client, 'rpc_submit_response', submitArgs(need, {covered: 1, price: 3001}));
        return {holds: lib.isRefusal(response, 'FIXED_PRICE_MISMATCH', '22023') && lib.sameJson(fp(), before), observed: lib.observedLabel(response, 'ACCEPTED'),
          corroborated: response.error ? true : needState(need).versions === 1 && stored(response.data.responseId, 'MY_PRICE').head_price === 3001};
      },
      async keep() {     // the stale-reconfirm door: KEEP at the old price is refused after the task price moved
        const {need, receipt} = await applyCanonical(per, 2, 'probe keep'), revision = editTask(need, {price: 4000}), before = fp();
        const response = await call(worker.client, 'rpc_resolve_stale_response_after_need_edit', resolveArgs(receipt.responseId, {version: 1, revision, action: 'KEEP'}));
        return {holds: lib.isRefusal(response, 'FIXED_PRICE_MISMATCH', '22023') && lib.sameJson(fp(), before), observed: lib.observedLabel(response, 'ACCEPTED'),
          corroborated: response.error ? true : responseState(receipt.responseId).current_version === 2 && stored(receipt.responseId, 'MY_PRICE').head_price === 6000};
      },
      async select() {   // the selection door: a task that moved (no revision bump) cannot be selected at the old terms
        const {need, receipt} = await applyCanonical(per, 2, 'probe select');
        flip(need, "price_basis = 'TOTAL'"); const before = fp();
        const response = await call(requester.client, 'rpc_select_response', selectArgs(need, receipt));
        return {holds: lib.isRefusal(response, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', '22023') && lib.sameJson(fp(), before) && needState(need).agreements === 0, observed: lib.observedLabel(response, 'AGREEMENT_CREATED'),
          corroborated: response.error ? true : needState(need).agreements === 1};
      },
      async candidates() {   // the candidate reader (need_candidate_states_v5(uuid)): the same moved task shows the application as STALE, not selectable
        const {need, receipt} = await applyCanonical(per, 2, 'probe candidates');
        flip(need, "price_basis = 'TOTAL'");
        const response = await call(requester.client, 'rpc_list_need_candidates', {p_need_id: need});
        const item = response.error ? null : response.data.find(entry => entry.responseId === receipt.responseId);
        return {holds: item !== null && item !== undefined && item.state === 'STALE' && item.canSelect === false, observed: response.error ? 'LIST_RAISED ' + response.error.message : item?.state ?? 'ITEM_MISSING', corroborated: true};
      },
      async page() {   // the page reader (need_candidate_states_v5(uuid, uuid[])): the same moved task shows the application as STALE on the page
        const {need, receipt} = await applyCanonical(per, 2, 'probe page');
        flip(need, "price_basis = 'TOTAL'");
        const response = await call(requester.client, 'rpc_list_need_candidates_page', {p_need_id: need, p_limit: 10});
        const item = response.error ? null : response.data.items.find(entry => entry.responseId === receipt.responseId);
        return {holds: item !== null && item !== undefined && item.state === 'STALE' && item.canSelect === false, observed: response.error ? 'PAGE_RAISED ' + response.error.message : item?.state ?? 'ITEM_MISSING', corroborated: true};
      },
    };
    assert.deepEqual(Object.keys(PRED).sort(), [...lib.PREDICATES].sort(), 'EVERY_PREDICATE_OF_THE_PLAN_IS_IMPLEMENTED');
    assert.deepEqual(lib.probePlanProblems(), [], 'THE_PROBE_PLAN_IS_SOUND');
    const evaluate = async names => { const out = {}; for (const name of names) out[name] = await PRED[name](); return out; };
    const control = await evaluate(lib.PREDICATES);
    for (const [name, result] of Object.entries(control)) assert.equal(result.holds, true, 'CONTROL_THE_UNWEAKENED_RULE_HOLDS ' + name + ' ' + JSON.stringify(result));
    const pinsBeforeProbes = pins.runPinGate(readMd5).observed;
    const outcomes = [];
    for (const probe of lib.PROBE_PLAN) {
      const original = sql(`select pg_get_functiondef(to_regprocedure(${q(SIG[probe.pin])}))`), edit = lib[probe.edit](original);
      assert.equal(edit.applied, true, `PROBE_NOT_APPLICABLE ${probe.id}: ${edit.reason} (the anchor edit did not match the chain body: a weakening that cannot be applied proves nothing)`);
      let weakened;
      try {
        sql(lib.asStatement(edit.text)); await sleep(1500);   // the DDL notifies PostgREST; let its schema cache settle before the next request
        weakened = await evaluate(lib.PREDICATES);
      } finally { sql(lib.asStatement(original)); await sleep(1500); }
      const restored = await evaluate(lib.PREDICATES);
      const verdict = lib.evaluateProbe({weakened, primary: probe.primary, requireOthersHold: probe.othersMustHold});
      outcomes.push({id: probe.id, applied: true, detected: verdict.detected, problems: verdict.problems, primary: [...probe.primary], expected: Object.fromEntries(probe.primary.map(name => [name, lib.WEAKENED_OUTCOME[name]])),
        weakened: Object.fromEntries(Object.entries(weakened).map(([name, result]) => [name, {holds: result.holds, observed: result.observed, corroborated: result.corroborated}])),
        restoredAllHold: Object.values(restored).every(result => result.holds === true), restored: Object.fromEntries(Object.entries(restored).map(([name, result]) => [name, result.holds]))});
      assert.equal(verdict.detected, true, `PROBE_NOT_DETECTED ${probe.id}: ${verdict.problems.join(' | ')} :: ${JSON.stringify(weakened)}`);
      for (const [name, result] of Object.entries(restored)) assert.equal(result.holds, true, `AFTER_THE_EXACT_RESTORE_EVERY_DOOR_HOLDS_AGAIN ${probe.id}/${name}`);
    }
    // the coupling (finding R3): a refusal NOBODY lists, raised through the helper, breaks every requester read that goes through need_candidate_states_v5 instead of showing STALE:
    // the list, the page, and the task read (rpc_read_task, which evaluates the computed column selectable_application_count; DEV exposes that column only through rpc_read_task)
    {
      const original = sql(`select pg_get_functiondef(to_regprocedure(${q(SIG.helper)}))`), edit = lib.unlistedMessageHelper(original);
      assert.equal(edit.applied, true, 'PROBE_NOT_APPLICABLE unlisted_helper_message');
      const {need} = await applyCanonical(per, 2, 'probe coupling'), raised = {};
      try {
        sql(lib.asStatement(edit.text)); await sleep(1500);
        raised.rpc_list_need_candidates = await call(requester.client, 'rpc_list_need_candidates', {p_need_id: need});
        raised.rpc_list_need_candidates_page = await call(requester.client, 'rpc_list_need_candidates_page', {p_need_id: need, p_limit: 10});
        raised.rpc_read_task = await call(requester.client, 'rpc_read_task', {p_need_id: need});
      } finally { sql(lib.asStatement(original)); await sleep(1500); }
      for (const [name, response] of Object.entries(raised)) assert.ok(response.error && response.error.message === 'PKG049_UNLISTED_PROBE', `AN_UNLISTED_HELPER_MESSAGE_BREAKS ${name}: ${JSON.stringify(response.error)}`);
      for (const name of Object.keys(raised)) { const healthy = await call(requester.client, name, name === 'rpc_read_task' ? {p_need_id: need} : name.endsWith('_page') ? {p_need_id: need, p_limit: 10} : {p_need_id: need}); assert.equal(healthy.error, null, 'HEALTHY_AFTER_THE_RESTORE ' + name); }
      outcomes.push({id: 'unlisted_helper_message_breaks_the_candidate_reads', applied: true, detected: true, coupling: 'a new helper message needs BOTH need_candidate_states_v5 overloads patched in the same package; it reaches the list, the page and the task read (selectable_application_count)',
        raisedBy: Object.fromEntries(Object.entries(raised).map(([name, response]) => [name, response.error.message])), restoredAllHold: true});
    }
    const pinsAfterProbes = pins.runPinGate(readMd5).observed;
    assert.deepEqual(pinsAfterProbes, pinsBeforeProbes, 'EVERY_WEAKENED_BODY_IS_RESTORED_BYTE_FOR_BYTE');
    assert.equal(outcomes.length, lib.PROBE_PLAN.length + 1, 'EVERY_PROBE_RAN'); assert.ok(outcomes.every(item => item.applied === true && item.detected === true), 'EVERY_PROBE_WAS_APPLIED_AND_DETECTED');
    // the select, candidates and page predicates set their state with flip(): a trigger-off fixture (defence in depth, R10), not a reachable state; the submit and keep predicates use the reachable edit
    report.weakening = {control, probes: outcomes, applied: outcomes.filter(item => item.applied).length, detected: outcomes.filter(item => item.detected).length, total: outcomes.length,
      fixturePredicates: ['select', 'candidates', 'page'], fixtureNote: FLIP_FIXTURE, fixture: FLIP_FIXTURE};
    pass(`P8_THE_PROOF_TURNS_RED_WHEN_THE_RULE_IS_WEAKENED (${report.weakening.detected} of ${report.weakening.total} probes detected by the OBSERVED weakened outcome; every body restored exactly; the select, candidates and page predicates use a fixture: ${FLIP_FIXTURE})`);
  }

  // =============================================================== P9 data neutrality, certificate, catalog
  {
    // two snapshots, so the comparison CAN fail: (1) every row that existed BEFORE the chain stages, seeded applications and Agreements included (created through the RPCs before the EX-04D and B24 stages: a stage that rewrote
    // data would move them); (2) every row created in P1b..P7, taken immediately before P8 (the weaken/restore DDL of P8 must not move them)
    assert.ok(existing.needs.length >= 2 && existing.responses.length >= 2 && existing.agreements.length >= 2, 'P9_NOT_VACUOUS: the first snapshot holds the seeded historical rows ' + JSON.stringify(report.neutrality.preexistingRows));
    const tuplesAfter = priceTuples(existing), createdTuplesAfter = priceTuples(createdIds);
    assert.deepEqual(tuplesAfter, tuplesBefore, 'HISTORICAL_PRICE_TUPLES_FROM_BEFORE_EVERY_CHAIN_STAGE_ARE_BYTE_IDENTICAL');
    assert.deepEqual(createdTuplesAfter, createdTuplesBeforeP8, 'PRICE_TUPLES_OF_THE_ROWS_CREATED_IN_P1B_TO_P7_ARE_BYTE_IDENTICAL_AFTER_P8');
    const closureAfter = closure(); assert.deepEqual(closureAfter, closureBefore, 'THE_CERTIFICATE_DID_NOT_MOVE');
    const surfaceAfter = surface();
    assert.deepEqual(surfaceAfter.filter(line => !surfaceBefore.includes(line)), [], 'NO_FUNCTION_CHANGED_OR_APPEARED'); assert.deepEqual(surfaceBefore.filter(line => !surfaceAfter.includes(line)), [], 'NO_FUNCTION_DISAPPEARED_OR_CHANGED');
    const finalGate = pins.runPinGate(readMd5); assert.deepEqual(finalGate.observed, gate.observed, 'THE_PIN_GATE_IS_THE_SAME_AFTER_THE_WHOLE_RUN');
    report.neutrality = {...report.neutrality, tuplesAfter, identical: true, createdRows: {needs: createdIds.needs.length, responses: createdIds.responses.length, agreements: createdIds.agreements.length}, createdTuplesBeforeP8, createdTuplesAfter, createdIdentical: true,
      certificateBefore: closureBefore, certificateAfter: closureAfter, catalogLinesBefore: surfaceBefore.length, catalogLinesAfter: surfaceAfter.length, catalogIdentical: true};
    pass(`P9_PRICE_TUPLES_OF_${existing.needs.length}_NEEDS_${existing.responses.length}_APPLICATIONS_AND_${existing.agreements.length}_AGREEMENTS_FROM_BEFORE_EVERY_CHAIN_STAGE_AND_OF_${createdIds.needs.length}_NEEDS_${createdIds.responses.length}_APPLICATIONS_AND_${createdIds.agreements.length}_AGREEMENTS_OF_P1B_TO_P7_ARE_UNCHANGED_AND_THE_CERTIFICATE_AND_WHOLE_CATALOG_ARE_UNCHANGED_BY_THE_RUN (the certificate is chain-internal: before = after)`);
  }
  report.client.sources = [...new Map(loaders.flatMap(loader => loader.sources).map(item => [item.path, item])).values()].sort((a, b) => a.path.localeCompare(b.path));
  report.notVerified = [
    'DEV: nothing here ran against DEV (DEV has 0 open MY_PRICE tasks); the verdicts hold for the disposable chain and carry the label of the pin gate (' + gate.label + ')',
    'the chain is not DEV: ' + pins.CHAIN_LACKS.join('; ') + '; its certified set (76) and certificate are chain-internal (before = after only)',
    'direct table writes (P1b): the expected outcomes are DERIVED from the migration sources and are first observed by the CI run; the needs attacks are chain-specific (the chain has table-level privileges on public.needs, DEV has the PKG-045b P0 column privileges, which this proof does not observe)',
    'the Agreement page-reader leg reads the pkg023a version of rpc_list_my_agreements_page (replayed by stage 04); the EX-04C version (rating state) is not on the chain',
    'rpc_read_task (pinned, adjacent) is SECURITY INVOKER: on DEV it runs under the PKG-045b P0 column grants, on this chain under table-level SELECT; P5, P6 and the P8 coupling probe read the task and the computed selectable_application_count only through it',
    'NOT DEMONSTRATED (T6 / R10): a price_basis-only task edit through the REAL command is not characterised: price_basis is outside guard_need_write\'s material list, the legacy rpc_confirm_need_edit carries no basis, the owner\'s direct update is DRAFT-only, and editTask always bumps the revision by fixture, so whether a basis-only edit stales the applications through the real path is unobserved (a structural limit of this chain, so it is listed here and not as a run gap)',
    'PostgREST version: the disposable supabase CLI stack does not pin it (header recorded in the report); DEV runs 14.5; the 40001 retry hazard is avoided (or, with the in-proof conversion, replaced by an observed PT409 -> HTTP 409), not reproduced',
    'native device behaviour: the real client TypeScript ran under a transpile-only VM with the live Auth session; no React Native screen, no APK, no phone',
    'installed APKs older than 2026-09-21 (bare per-person amount): their server-side refusals are covered by the matrix, their on-screen behaviour is not',
    'OFFERS lower/upper bound (D4), reject-versus-derive (D2), NULL basis for new multi-person tasks (D1), the Agreement price lock (D3) and one-person PER_PERSON / TOTAL tasks (D6) are OPEN owner decisions: characterised (rows labelled PINNED_TO_TODAY), not judged',
    'a price patch spelled 100.0 in an Agreement change (stored as text) cannot be produced through JSON.stringify',
    'the task edit is a fixture (the guard\'s CONFIRM_EDIT token plus an untriggered republish) and the basis/price flips are fixtures with triggers disabled (defence in depth, R10): the real rpc_confirm_need_edit_from_review needs AI review artifacts',
    'a refused RPC rolls its own transaction back, so "nothing written" is a transactional invariant, not independent evidence; the exact outcome (message, SQLSTATE, HTTP status) is the evidence',
    'the SQLSTATE of an amount above int4 (22003) is observed here for the first time; the proof tolerates 22003 and 22P02 and rejects PGRST202',
  ];
  report.result = lib.resultOf(report.gaps); save();   // PASS_WITH_GAPS when something the proof was designed to demonstrate was left out (the gaps are in the report, the markdown and the workflow summary)
  writeFileSync(markdownPath, lib.renderReportMarkdown(report));
  if (report.gaps.length) console.log('RESULT ' + report.result + ': ' + report.gaps.join(' | '));
}

main().catch(error => {
  report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save();
  try { writeFileSync(markdownPath, lib.renderReportMarkdown(report)); } catch { /* the JSON report is the record */ }
  console.error(report.failure); process.exit(1);
});
