// Shared helpers of the CANCEL-INFO + PROFILE-TRUST disposable proofs. Loopback only (closure_runtime's guard); never DEV.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';

export const {assert, sql, rows, q, randomUUID, env} = rt;
export const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
export const CI = 'supabase/candidates/cancel-info-20261007/', PT = 'supabase/candidates/profile-trust-20261007/';
export const ZP = 'supabase/candidates/zone-perf-20261007/', MV = 'supabase/candidates/match-v1-20261007/', DZ = 'supabase/candidates/discovery-zamene-20261007/';
export const ciManifest = JSON.parse(fs.readFileSync(CI + 'manifest.json', 'utf8'));
export const ptManifest = JSON.parse(fs.readFileSync(PT + 'manifest.json', 'utf8'));
export const md5 = text => createHash('md5').update(text).digest('hex');
export const out = env.TRUST_ARTIFACT_DIR;
assert.ok(out);
fs.mkdirSync(out, {recursive: true});

/** One psql process with a statement timeout; never throws: {ok, output, error, timedOut, wallMs}. */
export function run(text, {timeoutS = 90} = {}) {
  const started = Date.now();
  try {
    const output = execFileSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'],
      {input: `set statement_timeout='${timeoutS}s';\nset lock_timeout='5s';\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: (timeoutS + 30) * 1000, maxBuffer: 1 << 26}).trim();
    return {ok: true, output, wallMs: Date.now() - started};
  } catch (error) {
    const detail = String(error.stderr ?? '') + String(error.message ?? '');
    return {ok: false, timedOut: /statement timeout|canceling statement|ETIMEDOUT/i.test(detail), error: detail.slice(-900), wallMs: Date.now() - started};
  }
}
export const lastLine = text => text.split('\n').filter(Boolean).at(-1);
export function psqlFile(file) {
  const r = run(fs.readFileSync(file, 'utf8'), {timeoutS: 120});
  assert.ok(r.ok, 'APPLY_FAILED:' + file + ':' + r.error);
  return r;
}
/** The text must be refused, with exactly this name in the error, and leave the catalog as it was (the caller compares). */
export function refused(text, expected) {
  const r = run(text, {timeoutS: 120});
  assert.ok(!r.ok, 'NOT_REFUSED:' + expected);
  assert.ok(String(r.error).includes(expected), 'WRONG_REFUSAL ' + expected + ': ' + String(r.error).slice(-500));
  return r.error;
}
/** A SQL expression evaluated as an authenticated account (JWT claims as PostgREST sets them), in a rolled-back transaction. */
export function asAccount(accountId, expression, {timeoutS = 60} = {}) {
  const claims = JSON.stringify({sub: accountId, role: 'authenticated'});
  const r = run(`begin;
select set_config('request.jwt.claims', ${q(claims)}, true);
select set_config('request.jwt.claim.sub', ${q(accountId)}, true);
set local role authenticated;
select 'RESULT:' || coalesce((${expression})::text, 'null');
rollback;`, {timeoutS});
  if (!r.ok) return {ok: false, error: r.error};
  const line = r.output.split('\n').filter(l => l.startsWith('RESULT:')).at(-1);
  assert.ok(line, 'NO_RESULT_LINE');
  return {ok: true, value: JSON.parse(line.slice('RESULT:'.length))};
}
export function asAccountValue(accountId, expression) {
  const r = asAccount(accountId, expression);
  assert.ok(r.ok, 'AS_ACCOUNT_FAILED:' + expression + ':' + r.error);
  return r.value;
}
/** Every function of public/private: signature, body md5, metadata without the OID, comment; plus every private.marketplace_config row. */
export const catalog = () => sql(`select md5(coalesce((select string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')),'')
  ||'#'||coalesce((select string_agg(c.key||'='||c.value::text,E'\\n' order by c.key) from private.marketplace_config c),''))`);
export const functionCount = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`));
export const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,
  private.retention_ai_source_ready() as ready`)[0];
export const conflicts40001 = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'`));
export const bodyMd5 = signature => sql(`select coalesce(md5(prosrc),'') from pg_proc where oid=to_regprocedure(${q(signature)})`);
export const applied = manifest => manifest.newFunctions.every(f => bodyMd5(f.signature) === f.body_md5);
export const absent = manifest => manifest.newFunctions.every(f => bodyMd5(f.signature) === '');

/** A plain copy for reports: an Auth client (an account object carries its client), a function and a true cycle are never serialised. */
export function sanitize(value, ancestors = []) {
  if (typeof value === 'function') return undefined;
  if (!value || typeof value !== 'object') return value;
  if (ancestors.includes(value)) return '[circular]';
  const next = [...ancestors, value];
  if (Array.isArray(value)) return value.map(v => { const s = sanitize(v, next); return s === undefined ? null : s; });
  const copy = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'client') continue;
    const s = sanitize(v, next);
    if (s !== undefined) copy[k] = s;
  }
  return copy;
}
export const safeJson = (value, space = 2) => JSON.stringify(sanitize(value), null, space);
/** A report with PASS / FAIL checks; a failed check is recorded and the run continues where that is meaningful. */
export function makeReport(unit, file) {
  const report = {unit, result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true, actualPostgrest: true, actualDatabase: true,
    liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], failures: [], bypasses: [], observations: {}};
  const write = () => fs.writeFileSync(path.join(out, file), safeJson(report) + '\n');
  const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
  const fail = (name, detail) => { report.checks.push({name, result: 'FAIL', detail}); report.failures.push({name, detail}); write(); console.error('FAIL ' + name + ' ' + String(safeJson(detail, 0)).slice(0, 900)); };
  const check = (name, good, detail) => (good ? pass(name, detail) : fail(name, detail));
  const bypass = (what, why) => { report.bypasses.push({what, why}); write(); };
  return {report, write, pass, fail, check, bypass};
}
export const stripVolatile = value => {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'asOf').map(([k, v]) => [k, stripVolatile(v)]));
  return value;
};
export const firstDifference = (a, b, at = '$') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDifference(a[k], b[k], `${at}.${k}`); if (d) return d; }
  }
  return at;
};
