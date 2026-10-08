// INBOX-NASLOV disposable runtime proof: real Auth, real PostgREST, real database; loopback only; never DEV.
//   FAIL before : on the DEV body (b7928c50) no notification carries taskTitle.
//   PASS after  : every item carries taskTitle = the title of its task, or null exactly where the contract says (unknown entity kind or row,
//                 erased or deleted task, no right); every other key, the order, the pages, unreadCount and the errors are byte-identical;
//                 accounts stay isolated; refusals are atomic; the exact revert restores the DEV body, the catalog and the BEFORE answers.
// People are real Auth accounts; tasks are the labelled direct insert of the fixtures (as every Discovery/MATCH proof); applications,
// the selection (the Dogovor), the withdrawal and the cancellation go through the product's RPCs; the other notifications are written by
// private.emit_event, the one event writer of the product, with the entity kind and id DEV uses for that event type.
import fs from 'node:fs';
import * as C from './common.mjs';
import {createFixtures} from '../ex06/lib/fixtures.mjs';

const {assert, sql, rows, q, randomUUID, rt, P, INBOX, manifest} = C;
const {report, write, pass} = C.makeReport('INBOX-NASLOV', 'report.json');
const fx = createFixtures(rt, {needPath: 'direct'});
const tag = randomUUID().slice(0, 8);
const F = manifest.functions[0];
const candidate = fs.readFileSync(P + 'candidate.sql', 'utf8');
const inTx = fs.readFileSync(P + 'candidate.in-transaction.sql', 'utf8');
const revertSql = fs.readFileSync(P + 'revert.sql', 'utf8');
const preflight = fs.readFileSync(P + 'preflight.readonly.sql', 'utf8');
const postflight = fs.readFileSync(P + 'postflight.readonly.sql', 'utf8');
const idList = ids => 'array[' + ids.map(id => q(id) + '::uuid').join(',') + ']::uuid[]';
const readerState = () => ({body: C.bodyMd5(INBOX), definition: C.definitionMd5(INBOX)});

// ---------------------------------------------------------------- the client decoders (src/data/inboxClientService.ts): today's and the one with taskTitle
const isId = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDate = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
function decode(raw, withTitle) {
  if (!isObject(raw) || !Array.isArray(raw.items) || typeof raw.hasMore !== 'boolean' || !Number.isSafeInteger(raw.unreadCount) || raw.unreadCount < 0 || !isDate(raw.asOf)) throw new Error('INBOX_INVALID_PROJECTION');
  const items = raw.items.map(v => {
    if (!isObject(v) || !isId(v.id) || !isDate(v.occurredAt) || !(v.readAt === null || isDate(v.readAt)) || !['REQUESTER', 'WORKER'].includes(String(v.role))
      || typeof v.title !== 'string' || typeof v.body !== 'string' || typeof v.eventType !== 'string' || typeof v.family !== 'string') throw new Error('INBOX_INVALID_PROJECTION');
    if (withTitle && !(v.taskTitle === undefined || v.taskTitle === null || typeof v.taskTitle === 'string')) throw new Error('INBOX_INVALID_PROJECTION');
    const taskTitle = withTitle && typeof v.taskTitle === 'string' && v.taskTitle.trim() ? v.taskTitle : undefined;
    return {id: v.id, occurredAt: v.occurredAt, readAt: v.readAt, role: v.role, title: v.title, body: v.body, eventType: v.eventType, family: v.family, ...(taskTitle ? {taskTitle} : {})};
  });
  if (new Set(items.map(x => x.id)).size !== items.length || (raw.hasMore && items.length === 0)) throw new Error('INBOX_INVALID_PROJECTION');
  return items;
}

// ---------------------------------------------------------------- the product's words for each event type (what the emitting functions store)
const COPY = {
  OPPORTUNITY_AVAILABLE: ['Nova prilika koja ti može odgovarati', 'Pogledaj zadatak i odluči da li se prijavljuješ.'],
  RESPONSE_RECEIVED: ['Nova prijava', 'Imaš novu prijavu za Zadatak.'],
  RESPONSE_VIEWED: ['Prijava je pregledana', 'Tvoja prijava je pregledana.'],
  RESPONSE_SELECTED: ['Tvoja prijava je izabrana', 'Otvori Dogovor za detalje zadatka.'],
  RESPONSE_WITHDRAWN: ['Prijava je povučena', 'Jedna prijava za tvoj Zadatak je povučena.'],
  NEED_CANCELLED: ['Zadatak je otkazan', 'Zadatak za koji imaš prijavu je otkazan.'],
  NEED_REVISED: ['Zadatak je izmenjen', 'Pregledaj aktuelne uslove prijave.'],
  MESSAGE_RECEIVED: ['Nova poruka', 'Imaš novu poruku u Dogovoru.'],
  REVIEW_RECEIVED: ['Nova ocena', 'Stigla je ocena za završen Dogovor.'],
  EXECUTION_STATE_CHANGED: ['Dogovor je označen kao završen', 'Dogovor je označen kao završen.'],
  AGREEMENT_CANCELLED: ['Dogovor je otkazan', 'Druga strana je otkazala Dogovor.'],
  COMPLETION_REQUIRED: ['Završetak čeka tvoju potvrdu', 'Dogovor je označen kao završen.'],
  CLARIFICATION_CREATED: ['Novo pitanje', 'Stiglo je anonimno pitanje o Zadatku.'],
};
// The eleven (entity kind, event type) pairs canonical DEV holds today (read-only, 2026-10-08): each must be shown with its title.
const DEV_PAIRS = Object.keys(manifest.devEventsReadAt20261008);
const cases = [];
function emit(label, person, role, type, entityType, entityId, expected, {payload = {}} = {}) {
  const [title, body] = COPY[type];
  const id = sql(`select private.emit_event(${q(person.id)}::uuid, ${q(role)}, ${q(type)}, ${q(entityType)}, ${q(entityId)}::uuid, 1, ${q(title)}, ${q(body)},
    ${q(`inbox-naslov-proof:${tag}:${cases.length}`)}, 'NORMAL', ${q(JSON.stringify(payload))}::jsonb, null)`);
  assert.match(id, /^[0-9a-f-]{36}$/, 'EMIT_FAILED ' + label);
  cases.push({label, who: person.label, recipient: person.id, role, type, entityType, entityId, expected, eventId: id, source: 'private.emit_event'});
  return id;
}

try {
  // ---------------------------------------------------------------- the chain is the DEV state of everything the package touches
  report.observations.schedulers = fx.pauseSchedulers();
  assert.deepEqual(readerState(), {body: F.before_md5, definition: F.before_definition_md5}, 'READER_IS_NOT_THE_DEV_BODY');
  const pre = C.json(preflight);
  for (const flag of ['readerIsDev', 'dependencies', 'columns', 'erasureMarkers', 'certificateReady']) assert.equal(pre[flag], true, 'PREFLIGHT ' + flag);
  assert.equal(pre.alreadyApplied, false);
  const baseCatalog = C.catalog(), baseRows = C.catalogRows(), baseSchema = C.schemaPrint(), baseClosure = C.closure(), base40001 = C.conflicts40001();
  assert.equal(baseClosure.ready, true);
  report.observations.preflight = pre;
  report.observations.chain = fx.chainCounts();
  pass('INBOX_NASLOV_PREDECESSOR_IS_THE_DEV_READER_AND_THE_PREFLIGHT_IS_GREEN', {reader: F.before_md5, definition: F.before_definition_md5,
    certificate: baseClosure.certificate, retriedLiteralFunctionsOnTheChain: base40001});

  // ---------------------------------------------------------------- people, tasks, applications, Dogovori (real Auth, product RPCs)
  const workerSpec = label => ({label, skills: ['ib-' + tag], radiusKm: 15, location: {city: 'Novi Sad'},
    availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}});
  const R = await fx.createRequester({label: 'ib-requester'});
  const W1 = await fx.createWorker(workerSpec('ib-w1'));
  const W2 = await fx.createWorker(workerSpec('ib-w2'));
  const X = await fx.createWorker(workerSpec('ib-x'));
  const Y = await fx.createRequester({label: 'ib-y'});
  const people = {R, W1, W2, X, Y};
  for (const [label, p] of Object.entries(people)) p.label = label;
  const N = {};
  for (const [key, title] of [['police', `Montaža police u hodniku ${tag}`], ['kosenje', `Košenje trave u dvorištu ${tag}`],
    ['ciscenje', `Čišćenje stana posle selidbe ${tag}`], ['selidba', `Selidba garsonjere sa Limana ${tag}`], ['orman', `Prevoz ormana iz Novog Sada ${tag}`]]) {
    const made = await fx.createNeedFromFacts(R, {'need.title': title, 'need.description': 'Sinteticki zadatak INBOX-NASLOV dokaza na jednokratnoj bazi.',
      'need.category': 'INBOX-NASLOV dokaz', 'need.required_skills': ['ib-' + tag], 'need.required_tools': [], 'need.required_vehicles': [],
      'need.minimum_experience_years': 0, 'need.people_needed': 1, 'need.schedule_kind': 'FLEXIBLE',
      'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}, 'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS'}, {path: 'direct'});
    N[key] = {...made, id: made.needId, title};
    assert.equal(sql(`select title from public.needs where id=${q(made.needId)}::uuid`), title, 'TITLE_STORED_AS_GIVEN');
  }
  const A = {};
  const applyTo = async (key, worker, needKey) => {
    const a = await fx.submitApplication(worker, N[needKey]);
    assert.ok(a.ok, 'APPLICATION_REFUSED ' + key + ': ' + JSON.stringify(a.error));
    A[key] = {...a.data, id: a.data.responseId};
    return a.data;
  };
  await applyTo('p1', W1, 'police');
  await applyTo('p2', W2, 'police');
  await applyTo('p3', W2, 'kosenje');
  await applyTo('p4', W1, 'ciscenje');
  await applyTo('p5', W1, 'selidba');
  await fx.selectResponse(R, N.police, A.p1);
  await fx.selectResponse(R, N.selidba, A.p5);
  const agreementOf = (needKey, worker) => rows(`select id from public.agreements where need_id=${q(N[needKey].id)}::uuid and worker_account_id=${q(worker.id)}::uuid`)[0]?.id;
  const D = {d1: agreementOf('police', W1), d2: agreementOf('selidba', W1)};
  assert.ok(D.d1 && D.d2, 'AGREEMENTS_CREATED');
  await fx.withdrawApplication(W1, A.p4);
  await fx.cancelNeed(R, N.kosenje);
  pass('INBOX_NASLOV_FIXTURES_BUILT_THROUGH_THE_PRODUCT', {needs: Object.keys(N).length, applications: Object.keys(A).length, agreements: 2,
    flows: ['rpc_submit_response x5', 'rpc_select_response x2', 'rpc_withdraw_response', 'rpc_cancel_need']});

  // ---------------------------------------------------------------- notifications: every DEV pair with its title, and every null case of the contract
  const T = key => N[key].title;
  // the eleven DEV pairs, each to a person with the right
  emit('X: opportunity for a task he never applied to', X, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', N.police.id, T('police'));
  emit('W2: opportunity', W2, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', N.police.id, T('police'));
  emit('R: a new application (W2 on police)', R, 'REQUESTER', 'RESPONSE_RECEIVED', 'RESPONSE', A.p2.id, T('police'));
  emit('W1: the Dogovor has a new message', W1, 'WORKER', 'MESSAGE_RECEIVED', 'AGREEMENT', D.d1, T('police'));
  emit('R: the Dogovor has a new message', R, 'REQUESTER', 'MESSAGE_RECEIVED', 'AGREEMENT', D.d1, T('police'));
  emit('W1: his application was viewed', W1, 'WORKER', 'RESPONSE_VIEWED', 'RESPONSE', A.p1.id, T('police'));
  emit('W1: his application was selected', W1, 'WORKER', 'RESPONSE_SELECTED', 'RESPONSE', A.p1.id, T('police'));
  emit('R: a review', R, 'REQUESTER', 'REVIEW_RECEIVED', 'AGREEMENT', D.d1, T('police'));
  emit('W1: a review', W1, 'WORKER', 'REVIEW_RECEIVED', 'AGREEMENT', D.d1, T('police'));
  emit('W2: the task he applied to is cancelled', W2, 'WORKER', 'NEED_CANCELLED', 'NEED', N.kosenje.id, T('kosenje'));
  emit('W1: execution state changed', W1, 'WORKER', 'EXECUTION_STATE_CHANGED', 'AGREEMENT', D.d1, T('police'));
  emit('R: the Dogovor is cancelled (the owner\'s case)', R, 'REQUESTER', 'AGREEMENT_CANCELLED', 'AGREEMENT', D.d1, T('police'));
  emit('W1: the Dogovor is cancelled (the owner\'s case)', W1, 'WORKER', 'AGREEMENT_CANCELLED', 'AGREEMENT', D.d1, T('police'));
  emit('R: completion waits for him', R, 'REQUESTER', 'COMPLETION_REQUIRED', 'AGREEMENT', D.d1, T('police'));
  emit('R: an application was withdrawn', R, 'REQUESTER', 'RESPONSE_WITHDRAWN', 'RESPONSE', A.p4.id, T('ciscenje'));
  // the other rights of a NEED event
  emit('W2: a task he applied to was revised', W2, 'WORKER', 'NEED_REVISED', 'NEED', N.police.id, T('police'));
  emit('R: his own task was revised', R, 'REQUESTER', 'NEED_REVISED', 'NEED', N.police.id, T('police'));
  // no right: null
  emit('X: cancellation of a task he never applied to', X, 'WORKER', 'NEED_CANCELLED', 'NEED', N.police.id, null);
  emit('X: somebody else\'s application', X, 'WORKER', 'RESPONSE_VIEWED', 'RESPONSE', A.p1.id, null);
  emit('X: somebody else\'s Dogovor', X, 'WORKER', 'AGREEMENT_CANCELLED', 'AGREEMENT', D.d1, null);
  emit('W2: a Dogovor of the task he applied to, but not his', W2, 'WORKER', 'MESSAGE_RECEIVED', 'AGREEMENT', D.d1, null);
  emit('W2: the application of W1 on the same task', W2, 'WORKER', 'RESPONSE_SELECTED', 'RESPONSE', A.p1.id, null);
  // unknown row or kind: null
  emit('X: an opportunity for a task that does not exist', X, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', randomUUID(), null);
  emit('R: an application that does not exist', R, 'REQUESTER', 'RESPONSE_RECEIVED', 'RESPONSE', randomUUID(), null);
  emit('W1: a Dogovor that does not exist', W1, 'WORKER', 'MESSAGE_RECEIVED', 'AGREEMENT', randomUUID(), null);
  emit('R: a CLARIFICATION (not an entity kind of the contract)', R, 'REQUESTER', 'CLARIFICATION_CREATED', 'CLARIFICATION', randomUUID(), null, {payload: {needId: N.police.id}});
  // erased by an account closure (below) and deleted (below): null
  emit('W1: the Dogovor of an erased task', W1, 'WORKER', 'AGREEMENT_CANCELLED', 'AGREEMENT', D.d2, null);
  emit('R: the Dogovor of an erased task', R, 'REQUESTER', 'MESSAGE_RECEIVED', 'AGREEMENT', D.d2, null);
  emit('W1: an erased task he applied to', W1, 'WORKER', 'NEED_CANCELLED', 'NEED', N.selidba.id, null);
  emit('W1: his application on an erased task', W1, 'WORKER', 'RESPONSE_VIEWED', 'RESPONSE', A.p5.id, null);
  emit('X: an opportunity for an erased task', X, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', N.selidba.id, null);
  emit('X: an opportunity for a deleted task', X, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', N.orman.id, null);
  // a suppressed in-app delivery is not listed at all (before and after)
  const hidden = emit('R: a suppressed notification (never listed)', R, 'REQUESTER', 'AGREEMENT_CANCELLED', 'AGREEMENT', D.d1, T('police'));
  sql(`update public.notification_deliveries set state='SUPPRESSED', suppression_reason='CATEGORY_OFF' where event_id=${q(hidden)}::uuid and channel='IN_APP'`);
  cases.at(-1).hidden = true;
  // the account closure writes its certified patch into the task (private.closure_redaction_patch_v5, the erasure program's own words)
  const patch = JSON.parse(sql(`select (private.closure_redaction_patch_v5('public.needs', to_jsonb(m), m.requester_account_id, gen_random_uuid())->'patch')::text
    from public.needs m where m.id=${q(N.selidba.id)}::uuid`));
  assert.equal(patch.title, 'Obrisan zadatak'); assert.equal(patch.category, 'OBRISANO');
  const keys = Object.keys(patch);
  sql(`begin; set local session_replication_role = replica;
    update public.needs n set ${keys.map(k => `${k} = r.${k}`).join(', ')}
    from public.needs m cross join lateral jsonb_populate_record(m, ${q(JSON.stringify(patch))}::jsonb) r where n.id=${q(N.selidba.id)}::uuid and m.id=n.id;
    commit;`);
  assert.deepEqual(rows(`select title, category from public.needs where id=${q(N.selidba.id)}::uuid`)[0], {title: 'Obrisan zadatak', category: 'OBRISANO'});
  // a deleted task: no product path deletes a published task (rpc_delete_draft_need deletes drafts); the row is removed directly
  sql(`begin; set local session_replication_role = replica; delete from public.needs where id=${q(N.orman.id)}::uuid; commit;`);
  assert.equal(sql(`select count(*) from public.needs where id=${q(N.orman.id)}::uuid`), '0');
  // two notifications read through the product (readAt and unreadCount must stay byte-identical as well)
  for (const c of cases.filter(c => c.who === 'R' && !c.hidden).slice(0, 2)) await C.ok(R.client.rpc('rpc_mark_activity_event_read', {p_event_id: c.eventId}));
  pass('INBOX_NASLOV_NOTIFICATIONS_WRITTEN', {emitted: cases.length, devPairs: DEV_PAIRS.length, erasedBy: 'private.closure_redaction_patch_v5', patchKeys: keys.length});

  // ---------------------------------------------------------------- the contract, independently of the SQL: the oracle over the stored rows
  const ids = Object.values(people).map(p => p.id);
  const events = rows(`select e.id, e.recipient_user_id, e.recipient_role, e.event_type, e.entity_type, e.entity_id,
      exists(select 1 from public.notification_deliveries v where v.event_id=e.id and v.recipient_user_id=e.recipient_user_id and v.channel='IN_APP' and v.state<>'SUPPRESSED') as visible
    from public.user_activity_events e where e.recipient_user_id = any(${idList(ids)})`);
  const byId = new Map(events.map(e => [e.id, e]));
  const entityIds = [...new Set(events.map(e => e.entity_id))];
  const responses = rows(`select id, need_id, worker_account_id from public.marketplace_responses where id = any(${idList(entityIds)})
    or need_id = any(${idList(entityIds)}) or need_id in (select need_id from public.marketplace_responses where id = any(${idList(entityIds)}))
    or need_id in (select need_id from public.agreements where id = any(${idList(entityIds)}))`);
  const agreements = rows(`select id, need_id, requester_account_id, worker_account_id from public.agreements where id = any(${idList(entityIds)})`);
  const needIds = [...new Set([...entityIds, ...responses.map(r => r.need_id), ...agreements.map(a => a.need_id)])];
  const needs = new Map(rows(`select id, title, category, requester_account_id from public.needs where id = any(${idList(needIds)})`).map(n => [n.id, n]));
  const responseById = new Map(responses.map(r => [r.id, r])), agreementById = new Map(agreements.map(a => [a.id, a]));
  const erased = n => n.category === 'OBRISANO' || n.title === 'Obrisan zadatak';
  function oracle(e) {
    const me = e.recipient_user_id;
    if (e.entity_type === 'NEED') {
      const n = needs.get(e.entity_id);
      if (!n || erased(n)) return null;
      const applied = responses.some(r => r.need_id === n.id && r.worker_account_id === me);
      return n.requester_account_id === me || e.event_type === 'OPPORTUNITY_AVAILABLE' || applied ? n.title : null;
    }
    if (e.entity_type === 'RESPONSE') {
      const r = responseById.get(e.entity_id), n = r && needs.get(r.need_id);
      if (!n || erased(n)) return null;
      return r.worker_account_id === me || n.requester_account_id === me ? n.title : null;
    }
    if (e.entity_type === 'AGREEMENT') {
      const a = agreementById.get(e.entity_id), n = a && needs.get(a.need_id);
      if (!n || erased(n)) return null;
      return a.requester_account_id === me || a.worker_account_id === me ? n.title : null;
    }
    return null;
  }
  for (const c of cases) assert.equal(oracle(byId.get(c.eventId)), c.expected, 'ORACLE_DISAGREES_WITH_THE_CONTRACT_TABLE: ' + c.label);
  const productEvents = events.filter(e => !cases.some(c => c.eventId === e.id));
  report.observations.productFlowEvents = productEvents.map(e => ({who: Object.values(people).find(p => p.id === e.recipient_user_id).label, type: e.event_type,
    entity: e.entity_type, expected: oracle(e) === null ? null : 'TITLE'}));
  pass('INBOX_NASLOV_CONTRACT_TABLE_AND_ORACLE_AGREE', {cases: cases.length, productFlowEvents: productEvents.length});

  // ---------------------------------------------------------------- one snapshot of every answer: a matrix of people x filters x page sizes, every page
  const MATRIX = [];
  for (const person of Object.values(people)) for (const role of [null, 'REQUESTER', 'WORKER']) for (const limit of [1, 2, 7, 100]) MATRIX.push({uid: person.id, who: person.label, role, limit});
  const snapshot = () => C.walks(MATRIX);
  const ERRORS = [
    {uid: R.id, args: {p_role: 'ADMIN', p_limit: 30}}, {uid: R.id, args: {p_role: null, p_limit: 0}}, {uid: R.id, args: {p_role: null, p_limit: 101}},
    {uid: R.id, args: {p_role: null, p_limit: null}}, {uid: R.id, args: {p_role: null, p_limit: 30, p_before_at: '2026-01-01T00:00:00Z', p_before_id: null}},
    {uid: R.id, args: {p_role: null, p_limit: 30, p_before_at: null, p_before_id: randomUUID()}},
    {uid: null, args: {p_role: null, p_limit: 30}}, {uid: null, args: {p_role: null, p_limit: 30}, role: 'anon'},
  ];
  const errors = () => C.inboxCalls(ERRORS).map(r => (r.ok ? 'OK' : r.sqlstate + ' ' + r.message));
  const http = async () => {
    const out = {};
    for (const person of Object.values(people)) out[person.label] = await C.ok(person.client.rpc('rpc_list_inbox', {p_role: null, p_limit: 100, p_before_at: null, p_before_id: null}));
    const anonCall = await rt.anon.rpc('rpc_list_inbox', {p_role: null, p_limit: 30, p_before_at: null, p_before_id: null});
    out.anon = {code: anonCall.error?.code ?? null, message: anonCall.error?.message ?? null, data: anonCall.data ?? null};
    return out;
  };
  const visibleOf = person => events.filter(e => e.recipient_user_id === person.id && e.visible).map(e => e.id).sort();
  const itemsOf = (snap, who) => snap[MATRIX.findIndex(m => m.who === who && m.role === null && m.limit === 100)].pages.flatMap(p => JSON.parse(p).items);

  // ---------------------------------------------------------------- BEFORE: the DEV body
  const before = snapshot(), beforeErrors = errors(), beforeHttp = await http();
  let missing = 0, listed = 0;
  for (const person of Object.values(people)) {
    const items = itemsOf(before, person.label);
    assert.deepEqual(items.map(i => i.id).sort(), visibleOf(person), 'BEFORE_ISOLATION ' + person.label);
    listed += items.length; missing += items.filter(i => !('taskTitle' in i)).length;
    for (const item of decode(beforeHttp[person.label], false)) assert.ok(!('taskTitle' in item));
  }
  assert.ok(listed > 0 && missing === listed, 'BEFORE_ALREADY_HAS_TASK_TITLE');
  assert.ok(!cases.find(c => c.hidden && itemsOf(before, 'R').some(i => i.id === c.eventId)), 'SUPPRESSED_LISTED');
  assert.deepEqual(beforeErrors.slice(0, 6), Array(6).fill(0).map((_, i) => i === 0 ? '22023 INVALID_ROLE' : '22023 INVALID_PAGE'));
  assert.equal(beforeErrors[6], '28000 AUTH_REQUIRED');
  assert.match(beforeErrors[7], /^42501 permission denied for function rpc_list_inbox/);
  assert.deepEqual(JSON.parse(before[MATRIX.findIndex(m => m.who === 'Y' && m.role === null && m.limit === 100)].comparables[0]), {items: [], hasMore: false, unreadCount: 0});
  pass('INBOX_NASLOV_FAILS_BEFORE_NO_ITEM_CARRIES_TASK_TITLE_ON_THE_DEV_BODY', {listed, withoutTaskTitle: missing, walks: MATRIX.length,
    pages: before.reduce((s, w) => s + w.pages.length, 0), errors: beforeErrors});

  // ---------------------------------------------------------------- refusals before the apply: atomic, nothing left behind
  const unchanged = label => {
    assert.equal(C.catalog(), baseCatalog, label + ' CATALOG_CHANGED');
    assert.equal(C.schemaPrint(), baseSchema, label + ' SCHEMA_CHANGED');
    assert.deepEqual(C.closure(), baseClosure, label + ' CERTIFICATE_CHANGED');
  };
  const wrapped = (setup, body) => 'begin;\n' + setup + '\n' + body + '\nrollback;\n';
  const redefine = (signature, from, to) => `do $ib_drift$ begin
  if strpos(pg_get_functiondef(${q(signature)}::regprocedure), ${q(from)}) = 0 then raise exception 'DRIFT_ANCHOR_MISSING'; end if;
  execute replace(pg_get_functiondef(${q(signature)}::regprocedure), ${q(from)}, ${q(to)});
end $ib_drift$;`;
  const refusals = {};
  refusals.revertBeforeApply = C.refused(revertSql, 'INBOX_NASLOV_REVERT_PREIMAGE_DRIFT');
  refusals.predecessorDrift = C.refused(wrapped(redefine(INBOX, 'v_unread bigint;', 'v_unread bigint; -- drift'), inTx), 'INBOX_NASLOV_PREDECESSOR_DRIFT');
  refusals.dependencyDrift = C.refused(wrapped(redefine('private.category_of_event(text)', "then 'opportunities'", "then 'opportunities' "), inTx), 'INBOX_NASLOV_DEPENDENCY_DRIFT');
  refusals.schemaDrift = C.refused(wrapped('alter table public.needs alter column category drop not null;', inTx), 'INBOX_NASLOV_SCHEMA_DRIFT');
  refusals.erasureMarkerDrift = C.refused(wrapped(redefine('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', "'title','Obrisan zadatak'", "'title','Izbrisan zadatak'"), inTx),
    'INBOX_NASLOV_ERASURE_MARKER_DRIFT');
  refusals.certificateNotReady = C.refused(wrapped(`do $ib_cert$ begin execute 'create or replace function private.retention_ai_source_ready() returns boolean language sql stable set search_path to ''pg_catalog'' as $f$ select false $f$'; end $ib_cert$;`, inTx),
    'INBOX_NASLOV_CERTIFICATE_NOT_READY');
  const payloadAnchor = 'limit 1\n  ) t on true;';
  assert.equal(candidate.split(payloadAnchor).length, 2, 'PAYLOAD_ANCHOR_ONCE');   // exactly once: in the payload literal of the new body
  refusals.payloadDrift = C.refused(candidate.replace(payloadAnchor, 'limit 2\n  ) t on true;'), 'INBOX_NASLOV_PAYLOAD_DRIFT');
  unchanged('REFUSALS');
  assert.deepEqual(readerState(), {body: F.before_md5, definition: F.before_definition_md5});
  // the wrapper variant applies and rolls back whole
  const inside = C.must(wrapped('', inTx + `\nselect '@@IB@@'||md5(prosrc)||' '||md5(pg_get_functiondef(oid)) from pg_proc where oid=to_regprocedure(${q(INBOX)});`));
  assert.equal(inside.split('\n').find(l => l.startsWith('@@IB@@')).slice(6), F.after_md5 + ' ' + F.after_definition_md5);
  unchanged('WRAPPER_ROLLBACK');
  assert.deepEqual(readerState(), {body: F.before_md5, definition: F.before_definition_md5});
  pass('INBOX_NASLOV_REFUSALS_ARE_ATOMIC_AND_NAMED_AND_THE_WRAPPER_VARIANT_ROLLS_BACK_WHOLE', refusals);

  // ---------------------------------------------------------------- APPLY
  C.applyFile(P + 'candidate.sql');
  await fx.reloadSchema();
  assert.deepEqual(readerState(), {body: F.after_md5, definition: F.after_definition_md5});
  const post = C.json(postflight);
  for (const flag of ['readerAfter', 'dependencies', 'columns', 'erasureMarkers', 'certificateReady']) assert.equal(post[flag], true, 'POSTFLIGHT ' + flag);
  assert.equal(post.closureDigest, baseClosure.digest); assert.equal(post.erasureProgramDigest, baseClosure.program);
  const afterRows = C.catalogRows();
  const changed = afterRows.filter(r => JSON.stringify(r) !== JSON.stringify(baseRows.find(b => b.signature === r.signature)));
  assert.deepEqual(changed.map(r => r.signature), ['rpc_list_inbox(text,integer,timestamp with time zone,uuid)'], 'ONLY_THE_READER_CHANGED');
  assert.equal(afterRows.length, baseRows.length, 'NO_FUNCTION_ADDED_OR_REMOVED');
  assert.equal(changed[0].meta, baseRows.find(b => b.signature === changed[0].signature).meta, 'READER_METADATA_UNCHANGED');
  assert.equal(C.schemaPrint(), baseSchema, 'SCHEMA_CHANGED');
  assert.deepEqual(C.closure(), baseClosure, 'CERTIFICATE_MOVED');
  assert.equal(C.conflicts40001(), base40001);
  pass('INBOX_NASLOV_APPLIED_ONE_BODY_METADATA_SCHEMA_AND_CERTIFICATE_UNCHANGED', {after: F.after_md5, definition: F.after_definition_md5, postflight: post});

  // ---------------------------------------------------------------- AFTER: byte-identical but for taskTitle, which is the contract
  const after = snapshot(), afterErrors = errors(), afterHttp = await http();
  let pages = 0;
  MATRIX.forEach((m, i) => {
    assert.equal(after[i].pages.length, before[i].pages.length, 'PAGE_COUNT ' + JSON.stringify(m));
    after[i].comparables.forEach((text, j) => { assert.equal(text, before[i].comparables[j], 'NOT_BYTE_IDENTICAL ' + JSON.stringify(m) + ' page ' + j); pages++; });
    for (const page of after[i].pages) {
      const value = JSON.parse(page);
      assert.ok(value.items.length <= m.limit);
      for (const item of value.items) {
        assert.ok('taskTitle' in item, 'TASK_TITLE_KEY_MISSING');
        assert.equal(item.taskTitle, oracle(byId.get(item.id)), 'TASK_TITLE ' + JSON.stringify({who: m.who, type: item.eventType}));
        assert.ok(Object.keys(item).every(k => ['id', 'body', 'role', 'title', 'family', 'readAt', 'eventType', 'taskTitle', 'occurredAt'].includes(k)), 'NO_OTHER_NEW_KEY');
      }
    }
  });
  pass('INBOX_NASLOV_EVERY_OTHER_KEY_ORDER_PAGE_AND_UNREAD_COUNT_BYTE_IDENTICAL', {walks: MATRIX.length, pagesCompared: pages});
  const result = {};
  for (const c of cases) {
    const item = itemsOf(after, c.who).find(i => i.id === c.eventId);
    if (c.hidden) { assert.equal(item, undefined, 'SUPPRESSED_LISTED_AFTER'); continue; }
    assert.ok(item, 'NOT_LISTED ' + c.label);
    assert.equal(item.taskTitle, c.expected, 'CASE ' + c.label);
    result[c.label] = item.taskTitle === null ? null : 'TITLE';
  }
  const shown = new Set(cases.filter(c => c.expected !== null && !c.hidden).map(c => c.entityType + '/' + c.type));
  for (const pair of DEV_PAIRS) assert.ok(shown.has(pair), 'DEV_PAIR_NOT_COVERED ' + pair);
  for (const e of productEvents.filter(x => x.visible)) {
    const item = itemsOf(after, Object.values(people).find(p => p.id === e.recipient_user_id).label).find(i => i.id === e.id);
    assert.equal(item.taskTitle, oracle(e), 'PRODUCT_FLOW_EVENT ' + e.event_type);
  }
  pass('INBOX_NASLOV_PASSES_AFTER_EVERY_ITEM_CARRIES_ITS_TASK_TITLE_OR_NULL', {cases: result, devPairsShown: DEV_PAIRS,
    productFlowEvents: productEvents.filter(x => x.visible).map(e => e.event_type + (oracle(e) === null ? ':null' : ':title'))});
  for (const person of Object.values(people)) {
    const items = itemsOf(after, person.label);
    assert.deepEqual(items.map(i => i.id).sort(), visibleOf(person), 'AFTER_ISOLATION ' + person.label);
  }
  // the titles of this proof's tasks each person sees (every other item is checked against the oracle above)
  const titlesOf = who => [...new Set(itemsOf(after, who).map(i => i.taskTitle).filter(t => t !== null && (t.includes(tag) || t === 'Obrisan zadatak')))].sort();
  assert.deepEqual(titlesOf('X'), [T('police')], 'X_SEES_ONLY_THE_TASK_OFFERED_TO_HIM');
  assert.deepEqual(titlesOf('W2'), [T('kosenje'), T('police')].sort());
  const within = (who, allowed, required) => {
    assert.ok(titlesOf(who).every(t => allowed.includes(t)), 'FOREIGN_TITLE ' + who + ' ' + JSON.stringify(titlesOf(who)));
    for (const t of required) assert.ok(titlesOf(who).includes(t), 'MISSING_TITLE ' + who + ' ' + t);
  };
  within('W1', [T('ciscenje'), T('police')], [T('police')]);
  within('R', [T('ciscenje'), T('kosenje'), T('police')], [T('ciscenje'), T('police')]);
  assert.deepEqual(itemsOf(after, 'Y'), []);
  for (const who of ['R', 'W1', 'W2', 'X', 'Y']) assert.ok(!titlesOf(who).includes(T('orman')) && !titlesOf(who).includes(T('selidba')) && !titlesOf(who).includes('Obrisan zadatak'));
  report.observations.foreignItems = Object.fromEntries(Object.keys(people).map(who => [who, itemsOf(after, who).filter(i => i.taskTitle !== null && !i.taskTitle.includes(tag)).length]));
  pass('INBOX_NASLOV_ACCOUNTS_STAY_ISOLATED_AND_SEE_ONLY_THEIR_OWN_TASKS', {X: titlesOf('X').length, W2: titlesOf('W2').length, R: titlesOf('R').length, Y: 0,
    itemsAboutOtherTasks: report.observations.foreignItems});
  assert.deepEqual(afterErrors, beforeErrors, 'ERRORS_CHANGED');
  for (const person of Object.values(people)) {
    assert.equal(C.comparable(afterHttp[person.label]), C.comparable(beforeHttp[person.label]), 'HTTP_NOT_IDENTICAL ' + person.label);
    const sqlItems = itemsOf(after, person.label);
    afterHttp[person.label].items.forEach((item, j) => assert.equal(item.taskTitle, sqlItems[j].taskTitle, 'HTTP_TASK_TITLE ' + person.label));
    decode(afterHttp[person.label], false);
    const decoded = decode(afterHttp[person.label], true);
    decoded.forEach((item, j) => assert.equal(item.taskTitle, afterHttp[person.label].items[j].taskTitle ?? undefined));
  }
  assert.deepEqual(afterHttp.anon, beforeHttp.anon, 'ANON_HTTP_CHANGED');
  pass('INBOX_NASLOV_ERRORS_POSTGREST_AND_BOTH_CLIENT_DECODERS_UNCHANGED_OR_READY', {errors: afterErrors, anon: afterHttp.anon.code});

  // ---------------------------------------------------------------- a repeated or a partial application is named; nothing changes
  const appliedCatalog = C.catalog();
  refusals.repeated = C.refused(candidate, 'INBOX_NASLOV_ALREADY_OR_PARTIALLY_APPLIED');
  refusals.otherVariant = C.refused(wrapped(redefine(INBOX, 'v_unread bigint;', 'v_unread bigint; -- another variant'), inTx), 'INBOX_NASLOV_ALREADY_OR_PARTIALLY_APPLIED');
  assert.equal(C.catalog(), appliedCatalog);
  assert.deepEqual(C.closure(), baseClosure);
  pass('INBOX_NASLOV_REPEATED_OR_PARTIAL_APPLICATION_REFUSED', {repeated: refusals.repeated, otherVariant: refusals.otherVariant});

  // ---------------------------------------------------------------- the exact REVERT
  C.applyFile(P + 'revert.sql');
  await fx.reloadSchema();
  assert.deepEqual(readerState(), {body: F.before_md5, definition: F.before_definition_md5}, 'REVERT_NOT_THE_DEV_BODY');
  unchanged('REVERT');
  const reverted = snapshot();
  MATRIX.forEach((m, i) => {
    assert.equal(reverted[i].pages.length, before[i].pages.length);
    reverted[i].pages.forEach((page, j) => {
      const a = JSON.parse(page), b = JSON.parse(before[i].pages[j]);
      delete a.asOf; delete b.asOf;
      assert.equal(JSON.stringify(a), JSON.stringify(b), 'REVERT_NOT_BYTE_IDENTICAL ' + JSON.stringify(m));
      assert.equal(reverted[i].comparables[j], before[i].comparables[j]);
    });
  });
  assert.deepEqual(errors(), beforeErrors);
  refusals.revertTwice = C.refused(revertSql, 'INBOX_NASLOV_REVERT_PREIMAGE_DRIFT');
  unchanged('REVERT_TWICE');
  pass('INBOX_NASLOV_EXACT_REVERT_RESTORES_THE_DEV_BODY_THE_CATALOG_AND_THE_BEFORE_ANSWERS', {body: F.before_md5, definition: F.before_definition_md5,
    catalog: 'equal', schema: 'equal', certificate: 'equal'});
  // and the package applies again on the restored predecessor (the cycle closes), then is reverted again
  C.applyFile(P + 'candidate.sql');
  assert.deepEqual(readerState(), {body: F.after_md5, definition: F.after_definition_md5});
  C.applyFile(P + 'revert.sql');
  unchanged('CYCLE');
  assert.equal(C.conflicts40001(), base40001);
  pass('INBOX_NASLOV_APPLY_REVERT_CYCLE_CLOSES_CERTIFICATE_NEVER_MOVED_NO_RETRIED_ERRCODE', {certificate: baseClosure.certificate, retriedLiteralFunctions: base40001});

  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = String(error?.stack ?? error).slice(0, 4000);
  console.error('FAIL INBOX_NASLOV ' + report.failure);
  process.exitCode = 1;
} finally {
  report.observations.auth = fx.authStats();
  write();
  console.log(report.result + ' INBOX-NASLOV');
}
