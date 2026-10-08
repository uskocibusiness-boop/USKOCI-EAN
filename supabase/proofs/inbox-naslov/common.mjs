// INBOX-NASLOV proofs: helpers shared by the predecessor check, the behaviour proof and the load proof. Disposable database on the
// loopback only (closure_runtime refuses any other target); never DEV.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';

export const {assert, sql, rows, q, randomUUID, ok, env} = rt;
export {rt};
export const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
export const P = 'supabase/candidates/inbox-naslov-20261008/';
export const manifest = JSON.parse(fs.readFileSync(P + 'manifest.json', 'utf8'));
export const INBOX = manifest.functions[0].signature;
export const out = env.INBOX_NASLOV_ARTIFACT_DIR;
assert.ok(out, 'INBOX_NASLOV_ARTIFACT_DIR');
fs.mkdirSync(out, {recursive: true});
export const md5 = text => createHash('md5').update(text).digest('hex');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const lastLine = text => text.split('\n').filter(Boolean).at(-1);

export function makeReport(unit, file) {
  const report = {unit, result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true, actualPostgrest: true, actualDatabase: true,
    liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], failures: [], observations: {}};
  const write = () => fs.writeFileSync(path.join(out, file), JSON.stringify(report, null, 2) + '\n');
  const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
  const fail = (name, detail) => { report.failures.push({name, detail}); write(); console.error('FAIL ' + name + ' ' + JSON.stringify(detail).slice(0, 1500)); };
  return {report, write, pass, fail};
}

/** One psql session with its own statement timeout; a failure or a timeout is a RESULT ({ok:false, stderr}), never an exception. */
export function run(text, {timeoutS = 120, lockS = 5} = {}) {
  const started = Date.now();
  try {
    const output = execFileSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'],
      {input: `set statement_timeout='${timeoutS}s';\nset lock_timeout='${lockS}s';\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
        timeout: (timeoutS + 30) * 1000, maxBuffer: 1 << 28}).trim();
    return {ok: true, output, wallMs: Date.now() - started};
  } catch (error) {
    const stderr = String(error.stderr ?? '');
    const detail = stderr + String(error.message ?? '');
    return {ok: false, timedOut: /statement timeout|canceling statement|ETIMEDOUT/i.test(detail), stderr,
      error: detail.length > 2000 ? detail.slice(0, 900) + '\n ... \n' + detail.slice(-1000) : detail, wallMs: Date.now() - started};
  }
}
export function must(text, options) {
  const result = run(text, options);
  assert.ok(result.ok, 'SQL_FAILED:' + result.error);
  return result.output;
}
export function applyFile(file, timeoutS = 180) {
  const result = run(fs.readFileSync(file, 'utf8'), {timeoutS});
  assert.ok(result.ok, 'APPLY_FAILED:' + file + ':' + result.error);
  return result;
}
/** The text must be refused with the expected label; the caller checks that nothing changed. */
export function refused(text, expected, timeoutS = 180) {
  const result = run(text, {timeoutS});
  assert.ok(!result.ok, 'NOT_REFUSED:' + expected);
  assert.ok(result.stderr.includes(expected), 'WRONG_REFUSAL ' + expected + ': ' + result.error.slice(-900));
  return result.stderr.split('\n').find(line => line.includes(expected))?.trim() ?? '';
}
/** The JSON value of a one-row, one-column select. */
export const json = text => JSON.parse(lastLine(must(text)));

export const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);
export const definitionMd5 = signature => sql(`select md5(pg_get_functiondef(oid)) from pg_proc where oid=to_regprocedure(${q(signature)})`);
/** Every function of public/private: signature, body md5, all pg_proc metadata but the oid, comment. */
export const catalogRows = () => rows(`select p.oid::regprocedure::text as signature, md5(p.prosrc) as body, md5(((to_jsonb(p)-'prosrc'-'oid')::text)) as meta,
  coalesce(obj_description(p.oid,'pg_proc'),'') as comment from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
  order by 1`);
export const catalog = () => sql(`select md5(string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`);
/** Tables, columns, constraints, indexes, policies, triggers and table grants of public/private: what a function-only package must leave alone. */
export const schemaPrint = () => sql(`select md5(string_agg(x, E'\\n' order by x)) from (
  select 'col:'||c.oid::regclass::text||'.'||a.attname::text||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'') as x
    from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
  union all select 'con:'||conrelid::regclass::text||':'||conname::text||':'||pg_get_constraintdef(oid) from pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace)
  union all select 'idx:'||indexrelid::regclass::text||':'||pg_get_indexdef(indexrelid) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
  union all select 'pol:'||schemaname::text||'.'||tablename::text||':'||policyname::text||':'||permissive::text||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where schemaname in ('public','private')
  union all select 'trg:'||tgrelid::regclass::text||':'||tgname::text||':'||tgenabled::text||':'||pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid in (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private'))
  union all select 'acl:'||c.oid::regclass::text||':'||coalesce(c.relacl::text,'') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
) s`);
export const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,
  private.retention_ai_source_ready() as ready`)[0];
export const conflicts40001 = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%400' || '01%'`));

/** The SQL of one inbox call as a signed-in person (auth.uid() from the JWT claims, role authenticated), the way PostgREST runs it. */
const callSql = (uid, args, role = 'authenticated') => {
  const claims = uid === null ? '' : `select set_config('request.jwt.claims', ${q(JSON.stringify({sub: uid, role: 'authenticated'}))}, true);
select set_config('request.jwt.claim.sub', ${q(uid)}, true);`;
  const value = v => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : q(v));
  return `begin;
${claims}
set local role ${role};
do $ib_call$ declare r jsonb; begin
  begin
    r := public.rpc_list_inbox(${value(args.p_role)}::text, ${value(args.p_limit)}::integer, ${value(args.p_before_at)}::timestamptz, ${value(args.p_before_id)}::uuid);
    perform set_config('ib.out', 'OK ' || r::text, true);
  exception when others then
    perform set_config('ib.out', 'ERR ' || sqlstate || ' ' || sqlerrm, true);
  end;
end $ib_call$;
select '@@IB@@' || current_setting('ib.out');
rollback;`;
};
/**
 * Many inbox calls in ONE psql session (each in its own rolled-back transaction). Returns per call {ok:true, text, value} with the
 * exact jsonb text the function returned, or {ok:false, sqlstate, message}.
 */
export function inboxCalls(calls, {timeoutS = 300} = {}) {
  if (!calls.length) return [];
  const output = must(calls.map(c => callSql(c.uid, c.args, c.role)).join('\n'), {timeoutS});
  const lines = output.split('\n').filter(line => line.startsWith('@@IB@@')).map(line => line.slice(6));
  assert.equal(lines.length, calls.length, 'INBOX_CALL_COUNT');
  return lines.map(line => {
    if (line.startsWith('OK ')) { const text = line.slice(3); return {ok: true, text, value: JSON.parse(text)}; }
    const m = /^ERR (\w{5}) (.*)$/.exec(line);
    assert.ok(m, 'INBOX_CALL_UNREADABLE:' + line.slice(0, 200));
    return {ok: false, sqlstate: m[1], message: m[2]};
  });
}
export const inbox = (uid, args, role) => inboxCalls([{uid, args, role}])[0];
/** The same response without asOf, and every item without taskTitle: what must be byte-identical before and after. */
export const comparable = value => {
  const copy = structuredClone(value);
  delete copy.asOf;
  copy.items = copy.items.map(item => { const {taskTitle, ...rest} = item; return rest; });
  return JSON.stringify(copy);
};
/** In SQL: the exact jsonb text of a response without asOf and without any item's taskTitle (canonical jsonb output, byte for byte). */
export const comparableSql = text => sql(`select jsonb_set(x - 'asOf', '{items}', (select coalesce(jsonb_agg(i.value - 'taskTitle' order by i.ordinality), '[]'::jsonb)
  from jsonb_array_elements(x->'items') with ordinality i))::text from (select ${q(text)}::jsonb as x) s`);

/**
 * Every page of inboxes, following the cursor of the last item of each page (the client's paging), as the signed-in person, in ONE
 * psql session (one rolled-back transaction per walk). walks = [{uid, role, limit}]. Returns per walk
 * {pages: [exact jsonb text of each page], comparables: [exact jsonb text of each page without asOf and without any taskTitle]}.
 */
export function walks(list, {timeoutS = 300} = {}) {
  if (!list.length) return [];
  const value = v => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : q(v));
  const text = list.map(w => `begin;
select set_config('request.jwt.claims', ${q(JSON.stringify({sub: w.uid, role: 'authenticated'}))}, true);
select set_config('request.jwt.claim.sub', ${q(w.uid)}, true);
set local role authenticated;
do $ib_walk$ declare r jsonb; full_pages jsonb := '[]'; cmp jsonb := '[]'; ba timestamptz; bi uuid; n integer := 0; begin
  loop
    r := public.rpc_list_inbox(${value(w.role)}::text, ${Number(w.limit)}::integer, ba, bi);
    full_pages := full_pages || jsonb_build_array(r::text);
    cmp := cmp || jsonb_build_array(jsonb_set(r - 'asOf', '{items}', (select coalesce(jsonb_agg(i.value - 'taskTitle' order by i.ordinality), '[]'::jsonb)
      from jsonb_array_elements(r->'items') with ordinality i))::text);
    n := n + 1;
    exit when not (r->>'hasMore')::boolean or n >= 1000;
    ba := (r->'items'->-1->>'occurredAt')::timestamptz; bi := (r->'items'->-1->>'id')::uuid;
  end loop;
  perform set_config('ib.out', jsonb_build_object('pages', full_pages, 'comparables', cmp)::text, true);
end $ib_walk$;
select '@@IB@@' || current_setting('ib.out');
rollback;`).join('\n');
  const output = must(text, {timeoutS});
  const lines = output.split('\n').filter(line => line.startsWith('@@IB@@')).map(line => JSON.parse(line.slice(6)));
  assert.equal(lines.length, list.length, 'WALK_COUNT');
  return lines;
}
