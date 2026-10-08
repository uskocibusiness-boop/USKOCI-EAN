// INBOX-NASLOV load proof: what taskTitle costs on a realistic inbox. Loopback only (never DEV).
// The SAME synthetic rows (labelled 'IB load', written with triggers off: no product writer makes bulk rows; the reader only reads them) are
// measured with the DEV body (BEFORE), with INBOX-NASLOV applied (AFTER) and after the exact revert (BACK), as the signed-in person:
// server time of one call (one backend per request kind: the first call cold, then eleven warm; median and minimum of the warm ones), and the
// HTTP time of the PostgREST call the app makes (median of five). Every AFTER answer must equal the BEFORE answer without taskTitle.
import fs from 'node:fs';
import path from 'node:path';
import * as C from './common.mjs';

const {assert, sql, rows, q, rt, P, INBOX, manifest, env} = C;
const {report, write, pass} = C.makeReport('INBOX-NASLOV load', 'load-report.json');
const F = manifest.functions[0];
const EVENTS = Number(env.IB_LOAD_EVENTS ?? 10000);
const median = values => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
report.observations.events = EVENTS;

function measure(uid, {role = null, limit = 30, beforeAt = null, beforeId = null}, runs = 11) {
  const v = x => (x === null ? 'null' : q(x));
  const out = C.must(`begin;
select set_config('request.jwt.claims', ${q(JSON.stringify({sub: uid, role: 'authenticated'}))}, true);
select set_config('request.jwt.claim.sub', ${q(uid)}, true);
set local role authenticated;
do $ib_t$ declare t0 timestamptz; r jsonb; times jsonb := '[]'; begin
  for i in 1..${runs + 1} loop
    t0 := clock_timestamp();
    r := public.rpc_list_inbox(${v(role)}::text, ${Number(limit)}, ${v(beforeAt)}::timestamptz, ${v(beforeId)}::uuid);
    times := times || to_jsonb(round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2));
  end loop;
  perform set_config('ib.last', jsonb_build_object('times', times, 'items', jsonb_array_length(r->'items'), 'hasMore', r->'hasMore', 'unread', r->'unreadCount',
    'titled', (select count(*) from jsonb_array_elements(r->'items') x where x->>'taskTitle' is not null),
    'keyed', (select count(*) from jsonb_array_elements(r->'items') x where x ? 'taskTitle'),
    'cmp', jsonb_set(r - 'asOf', '{items}', (select coalesce(jsonb_agg(i.value - 'taskTitle' order by i.ordinality), '[]'::jsonb)
      from jsonb_array_elements(r->'items') with ordinality i))::text)::text, true);
end $ib_t$;
select '@@IB@@' || current_setting('ib.last');
rollback;`, {timeoutS: 300});
  const x = JSON.parse(out.split('\n').find(line => line.startsWith('@@IB@@')).slice(6));
  const times = x.times.map(Number), warm = times.slice(1);
  return {coldMs: times[0], medianMs: median(warm), minMs: Math.min(...warm), maxMs: Math.max(...warm), items: x.items, hasMore: x.hasMore,
    unread: x.unread, titled: Number(x.titled), keyed: Number(x.keyed), cmp: x.cmp};
}
async function httpMs(client, runs = 5) {
  const times = [];
  for (let i = 0; i < runs + 1; i++) {
    const t0 = performance.now();
    await C.ok(client.rpc('rpc_list_inbox', {p_role: null, p_limit: 100, p_before_at: null, p_before_id: null}));
    times.push(performance.now() - t0);
  }
  return Math.round(median(times.slice(1)) * 10) / 10;
}

try {
  const paused = sql("select to_regclass('cron.job') is not null") === 't'
    ? sql("select count(*) from (select cron.alter_job(j.jobid, active := false) from cron.job j where j.active and j.jobname like 'uskoci%') x") : 'no cron';
  report.observations.schedulersPaused = paused;
  assert.equal(C.bodyMd5(INBOX), F.before_md5, 'READER_IS_NOT_THE_DEV_BODY');
  const baseClosure = C.closure();
  assert.equal(baseClosure.ready, true);

  // ---------------------------------------------------------------- people (real Auth) and the labelled synthetic rows
  const W = await rt.actor('ib-load-w'), Rq = await rt.actor('ib-load-r'), V = await rt.actor('ib-load-v');
  const prof = (id, kind) => rows(`select id from public.app_profiles where account_id=${q(id)}::uuid and kind=${q(kind)}`)[0].id;
  const ids = {W: W.id, Wp: prof(W.id, 'WORKER'), R: Rq.id, Rp: prof(Rq.id, 'REQUESTER'), V: V.id};
  const WORDS = ['Montaža police', 'Selidba nameštaja', 'Košenje trave', 'Krečenje stana', 'Čišćenje posle renoviranja', 'Popravka slavine', 'Dostava paketa',
    'Pranje prozora', 'Uređenje bašte', 'Đubrenje voćnjaka', 'Pomoć pri selidbi', 'Sečenje drva', 'Peglanje veša', 'Zamena brave', 'Nošenje kutija'];
  const arr = list => `array[${list.map(x => q(x)).join(',')}]`;
  const started = Date.now();
  C.must(`begin; set local session_replication_role = replica;
create temporary table ib_needs on commit drop as select gen_random_uuid() as id, g from generate_series(1, 3000) g;
insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, required_skills, required_tools, required_vehicles,
  required_licenses, minimum_experience_years, verified_identity_required, approximate_city, approximate_area, approximate_lat, approximate_lng, mode, required_slots,
  schedule_kind, starts_at, ends_at, execution_location_mode, task_country_code, task_timezone, response_deadline, published_at)
select n.id, ${q(ids.R)}::uuid, ${q(ids.Rp)}::uuid, (array['PUBLISHED','CANCELLED','COMPLETED','EXPIRED','ACTIVE'])[1 + n.g % 5],
  (${arr(WORDS)})[1 + n.g % ${WORDS.length}] || ' ' || n.g, 'Sinteticki zadatak INBOX-NASLOV merenja.', 'IB load', '{}', '{}', '{}', '{}', 0, false,
  'Novi Sad', '', 45.25, 19.84, 'OFFERS', 1, 'FLEXIBLE', null, null, 'STATIONARY', 'RS', 'Europe/Belgrade', statement_timestamp() + interval '2 days',
  statement_timestamp() - (n.g || ' minutes')::interval
from ib_needs n;
-- the worker's own applications (needs 31..1530) and, on the 30 "popular" needs, 200 applications each by other workers
create temporary table ib_resp on commit drop as select gen_random_uuid() as id, n.id as need_id, n.g from ib_needs n where n.g between 31 and 1530;
insert into public.marketplace_responses(id, need_id, worker_account_id, worker_profile_id, response_kind, status, submitted_against_need_revision, current_version,
  covered_slots, price_rsd, scope_note, bounded_message, submitted_at)
select r.id, r.need_id, ${q(ids.W)}::uuid, ${q(ids.Wp)}::uuid, 'APPLICATION', (array['SUBMITTED','VIEWED','SELECTED','NOT_SELECTED','WITHDRAWN','EXPIRED'])[1 + r.g % 6],
  1, 1, 1, 3000, '', '', statement_timestamp() from ib_resp r;
insert into public.marketplace_responses(id, need_id, worker_account_id, worker_profile_id, response_kind, status, submitted_against_need_revision, current_version,
  covered_slots, price_rsd, scope_note, bounded_message, submitted_at)
select gen_random_uuid(), n.id, gen_random_uuid(), gen_random_uuid(), 'APPLICATION', 'SUBMITTED', 1, 1, 1, 3000, '', '', statement_timestamp()
from ib_needs n cross join generate_series(1, 200) k where n.g <= 30;
-- 600 Dogovori between the requester and the worker
create temporary table ib_agr on commit drop as select gen_random_uuid() as id, r.need_id, r.id as response_id, r.g from ib_resp r where r.g <= 630;
insert into public.agreements(id, need_id, selection_id, selected_response_id, requester_account_id, requester_profile_id, worker_account_id, worker_profile_id,
  current_version, status)
select a.id, a.need_id, gen_random_uuid(), a.response_id, ${q(ids.R)}::uuid, ${q(ids.Rp)}::uuid, ${q(ids.W)}::uuid, ${q(ids.Wp)}::uuid, 1,
  (array['CONFIRMED','COMPLETED','CANCELLED'])[1 + a.g % 3] from ib_agr a;
-- the worker's ${EVENTS} notifications, ten kinds in turn; NEED_CANCELLED alternates between a task he applied to and a popular one he did not
with x as (select (select array_agg(id order by g) from ib_needs) as needs, (select array_agg(id order by g) from ib_resp) as resps,
  (select array_agg(need_id order by g) from ib_resp) as resp_needs, (select array_agg(id order by g) from ib_agr) as agrs)
insert into public.user_activity_events(id, recipient_user_id, recipient_role, event_type, entity_type, entity_id, entity_version, urgency, payload, dedupe_key, created_at, read_at)
select gen_random_uuid(), ${q(ids.W)}::uuid, 'WORKER',
  (array['OPPORTUNITY_AVAILABLE','OPPORTUNITY_AVAILABLE','OPPORTUNITY_AVAILABLE','OPPORTUNITY_AVAILABLE','NEED_CANCELLED','RESPONSE_VIEWED','RESPONSE_SELECTED',
    'MESSAGE_RECEIVED','AGREEMENT_CANCELLED','REVIEW_RECEIVED'])[1 + g % 10],
  (array['NEED','NEED','NEED','NEED','NEED','RESPONSE','RESPONSE','AGREEMENT','AGREEMENT','AGREEMENT'])[1 + g % 10],
  case when g % 10 < 4 then x.needs[1 + (g * 7) % 3000]
       when g % 10 = 4 then case when g % 20 = 4 then x.needs[1 + g % 30] else x.resp_needs[1 + g % 1500] end
       when g % 10 < 7 then x.resps[1 + g % 1500]
       else x.agrs[1 + g % 600] end,
  1, 'NORMAL', '{}'::jsonb, 'ib-load:w:' || g, statement_timestamp() - (g * 7 || ' minutes')::interval,
  case when g % 10 < 7 then statement_timestamp() - (g * 7 - 1 || ' minutes')::interval end
from generate_series(1, ${EVENTS}) g cross join x;
-- the requester: 2,000 notifications about applications to his tasks
with x as (select (select array_agg(id order by g) from ib_resp) as resps)
insert into public.user_activity_events(id, recipient_user_id, recipient_role, event_type, entity_type, entity_id, entity_version, urgency, payload, dedupe_key, created_at, read_at)
select gen_random_uuid(), ${q(ids.R)}::uuid, 'REQUESTER', 'RESPONSE_RECEIVED', 'RESPONSE', x.resps[1 + g % 1500], 1, 'NORMAL', '{}'::jsonb, 'ib-load:r:' || g,
  statement_timestamp() - (g * 11 || ' minutes')::interval, null
from generate_series(1, 2000) g cross join x;
-- the worst case: the newest 101 notifications of another worker are cancellations of popular tasks he never applied to
with x as (select (select array_agg(id order by g) from ib_needs) as needs)
insert into public.user_activity_events(id, recipient_user_id, recipient_role, event_type, entity_type, entity_id, entity_version, urgency, payload, dedupe_key, created_at, read_at)
select gen_random_uuid(), ${q(ids.V)}::uuid, 'WORKER', case when g <= 101 then 'NEED_CANCELLED' else 'OPPORTUNITY_AVAILABLE' end, 'NEED',
  case when g <= 101 then x.needs[1 + g % 30] else x.needs[1 + g % 3000] end, 1, 'NORMAL', '{}'::jsonb, 'ib-load:v:' || g,
  statement_timestamp() - (g * 5 || ' minutes')::interval, null
from generate_series(1, 2000) g cross join x;
insert into public.notification_deliveries(id, event_id, recipient_user_id, recipient_role, channel, priority, state, suppression_reason, title, body, dedupe_key, created_at)
select gen_random_uuid(), e.id, e.recipient_user_id, e.recipient_role, 'IN_APP', 'NORMAL', case when e.read_at is null then 'CREATED' else 'READ' end, null,
  'Obavestenje ' || e.event_type, 'Otvori za trenutne informacije.', e.dedupe_key || ':in_app', e.created_at
from public.user_activity_events e where e.dedupe_key like 'ib-load:%';
insert into public.notification_deliveries(id, event_id, recipient_user_id, recipient_role, channel, priority, state, suppression_reason, title, body, dedupe_key, created_at)
select gen_random_uuid(), e.id, e.recipient_user_id, e.recipient_role, 'PUSH', 'NORMAL', 'SUPPRESSED', 'PUSH_OFF',
  'Obavestenje ' || e.event_type, 'Otvori za trenutne informacije.', e.dedupe_key || ':push', e.created_at
from public.user_activity_events e where e.dedupe_key like 'ib-load:%';
commit;
analyze public.needs; analyze public.marketplace_responses; analyze public.agreements; analyze public.user_activity_events; analyze public.notification_deliveries;`,
  {timeoutS: 600});
  const counts = rows(`select (select count(*) from public.user_activity_events where recipient_user_id=${q(ids.W)}::uuid)::integer as worker_events,
    (select count(*) from public.user_activity_events where recipient_user_id=${q(ids.R)}::uuid)::integer as requester_events,
    (select count(*) from public.user_activity_events where recipient_user_id=${q(ids.V)}::uuid)::integer as worst_case_events,
    (select count(*) from public.user_activity_events)::integer as all_events, (select count(*) from public.notification_deliveries)::integer as all_deliveries,
    (select count(*) from public.needs)::integer as needs, (select count(*) from public.marketplace_responses)::integer as applications,
    (select count(*) from public.agreements)::integer as agreements`)[0];
  assert.equal(counts.worker_events, EVENTS);
  report.observations.rows = {...counts, seedSeconds: Math.round((Date.now() - started) / 1000)};
  pass('INBOX_NASLOV_LOAD_ROWS_SEEDED', report.observations.rows);
  const cursorAt = n => rows(`select created_at as at, id from public.user_activity_events where recipient_user_id=${q(ids.W)}::uuid
    order by created_at desc, id desc offset ${n - 1} limit 1`)[0];
  const deep = cursorAt(Math.floor(EVENTS / 2));
  const REQUESTS = {
    'worker, 30 (the app default)': [ids.W, {limit: 30}],
    'worker, 100 (101 rows read)': [ids.W, {limit: 100}],
    'worker, role WORKER, 100': [ids.W, {role: 'WORKER', limit: 100}],
    'worker, 100 from the middle (cursor)': [ids.W, {limit: 100, beforeAt: deep.at, beforeId: deep.id}],
    'requester, 100': [ids.R, {limit: 100}],
    'worst case, 100 cancellations of crowded tasks never applied to': [ids.V, {limit: 100}],
  };
  const phase = () => Object.fromEntries(Object.entries(REQUESTS).map(([k, [uid, args]]) => [k, measure(uid, args)]));

  phase();   // a warm-up round, discarded: the first round of a fresh stack pays for cold buffers (seen in run 37781816542: 21 ms median, 7 ms minimum)
  const before = phase();
  const httpBefore = await httpMs(W.client);
  C.applyFile(P + 'candidate.sql');
  assert.equal(C.bodyMd5(INBOX), F.after_md5);
  await new Promise(resolve => setTimeout(resolve, 1500));
  const after = phase();
  const httpAfter = await httpMs(W.client);
  C.applyFile(P + 'revert.sql');
  assert.equal(C.bodyMd5(INBOX), F.before_md5);
  const back = phase();
  assert.deepEqual(C.closure(), baseClosure, 'CERTIFICATE_MOVED');

  const table = [];
  for (const key of Object.keys(REQUESTS)) {
    const b = before[key], a = after[key], k = back[key];
    assert.equal(a.cmp, b.cmp, 'NOT_BYTE_IDENTICAL ' + key);
    assert.equal(k.cmp, b.cmp, 'BACK_NOT_BYTE_IDENTICAL ' + key);
    assert.equal(b.keyed, 0); assert.equal(k.keyed, 0); assert.equal(a.keyed, a.items);
    assert.ok(a.items <= 100);
    // a generous ceiling against a pathological plan (a scan of the tasks instead of key lookups), not a benchmark claim
    assert.ok(a.medianMs <= b.medianMs * 2 + 10, `SLOWER_THAN_ALLOWED ${key}: ${b.medianMs} -> ${a.medianMs}`);
    table.push({request: key, items: a.items, titled: a.titled, beforeMs: [b.medianMs, b.minMs], afterMs: [a.medianMs, a.minMs], backMs: [k.medianMs, k.minMs],
      coldMs: [b.coldMs, a.coldMs], deltaMedianMs: Math.round((a.medianMs - b.medianMs) * 100) / 100});
  }
  const worst = after['worst case, 100 cancellations of crowded tasks never applied to'];
  assert.equal(worst.titled, 0, 'NO_TITLE_WITHOUT_A_RIGHT');
  assert.ok(after['worker, 100 (101 rows read)'].titled > 0);
  report.load = {table, httpMs: {before: httpBefore, after: httpAfter}};
  pass('INBOX_NASLOV_LOAD_SAME_ANSWERS_AND_THE_COST_OF_THE_TITLE_MEASURED', report.load);
  const md = ['### INBOX-NASLOV load (server time of one call as the signed-in person; median (min) of 11 warm calls, ms; CI runner, DEV hardware differs)', '',
    `${counts.worker_events} notifications of the worker, ${counts.all_events} in all, ${counts.needs} tasks, ${counts.applications} applications, ${counts.agreements} Dogovori.`, '',
    '| request | items (with title) | DEV body | INBOX-NASLOV | after revert | delta |', '|---|---|---|---|---|---|',
    ...table.map(r => `| ${r.request} | ${r.items} (${r.titled}) | ${r.beforeMs[0]} (${r.beforeMs[1]}) | ${r.afterMs[0]} (${r.afterMs[1]}) | ${r.backMs[0]} (${r.backMs[1]}) | ${r.deltaMedianMs} |`),
    '', `HTTP (PostgREST, worker, 100 items, median of 5): ${httpBefore} ms -> ${httpAfter} ms.`, ''].join('\n');
  fs.writeFileSync(path.join(C.out, 'load-summary.md'), md);
  console.log(md);
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failures.push({name: 'INBOX_NASLOV_LOAD', detail: String(error?.stack ?? error).slice(0, 3000)});
  console.error('FAIL INBOX_NASLOV_LOAD ' + String(error?.stack ?? error).slice(0, 3000));
  process.exitCode = 1;
} finally {
  write();
  console.log(report.result + ' INBOX-NASLOV load');
}
