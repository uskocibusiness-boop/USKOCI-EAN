// MATCH-V1B proofs: helpers shared by the behaviour proof and the load proof. Disposable database on the loopback only; never DEV.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';

export const {assert, sql, rows, q, randomUUID, ok, env} = rt;
export {rt};
export const DB = env.DB_URL;
assert.equal(DB, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
export const NIL = '00000000-0000-0000-0000-000000000000';
export const Z = 'supabase/candidates/zone-perf-20261007/', M = 'supabase/candidates/match-v1-20261007/';
export const D = 'supabase/candidates/discovery-zamene-20261007/', B = 'supabase/candidates/match-v1b-remote-waves-20261007/';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export const zManifest = readJson(Z + 'manifest.json'), mManifest = readJson(M + 'manifest.json');
export const dManifest = readJson(D + 'manifest.json'), bManifest = readJson(B + 'manifest.json');
export const out = env.MATCH_V1_ARTIFACT_DIR;
export const WAVE = 'private.dispatch_next_wave(uuid)';
export const TZ = 'private.availability_timezone_valid(text)';
export const KEY = 'match_v1_dispatch';
export const md5 = text => createHash('md5').update(text).digest('hex');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const lastLine = text => text.split('\n').filter(Boolean).at(-1);

export function makeReport(unit, file) {
  const report = {unit, result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, actualAuth: true, actualPostgrest: true, actualDatabase: true,
    liveAccess: false, providerCalls: 0, pushSends: 0, checks: [], failures: [], observations: {}};
  const write = () => fs.writeFileSync(path.join(out, file), JSON.stringify(report, null, 2) + '\n');
  const pass = (name, detail) => { report.checks.push({name, result: 'PASS', ...(detail === undefined ? {} : {detail})}); write(); console.log('PASS ' + name); };
  const fail = (name, detail) => { report.failures.push({name, detail}); write(); console.error('FAIL ' + name + ' ' + JSON.stringify(detail).slice(0, 800)); };
  return {report, write, pass, fail};
}

/** One psql session with its own statement timeout; a failure or a timeout is a RESULT ({ok:false, timedOut, stderr}), never an exception. */
export function run(text, {timeoutS = 90, lockS = 5} = {}) {
  const started = Date.now();
  try {
    const output = execFileSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'],
      {input: `set statement_timeout='${timeoutS}s';\nset lock_timeout='${lockS}s';\n${text}`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: (timeoutS + 30) * 1000, maxBuffer: 1 << 26}).trim();
    return {ok: true, output, wallMs: Date.now() - started};
  } catch (error) {
    const stderr = String(error.stderr ?? '');
    const detail = stderr + String(error.message ?? '');
    return {ok: false, timedOut: /statement timeout|canceling statement|ETIMEDOUT/i.test(detail), stderr, lockTableFull: /out of shared memory/i.test(detail), error: detail.length > 1500 ? detail.slice(0, 700) + '\n ... \n' + detail.slice(-800) : detail, wallMs: Date.now() - started};
  }
}
export function applyFile(file, timeoutS = 180) {
  const result = run(fs.readFileSync(file, 'utf8'), {timeoutS});
  assert.ok(result.ok, 'APPLY_FAILED:' + file + ':' + result.error);
  return result;
}
export function refused(text, expected, timeoutS = 180) {
  const result = run(text, {timeoutS});
  assert.ok(!result.ok, 'NOT_REFUSED:' + expected);
  assert.ok(result.stderr.includes(expected), 'WRONG_REFUSAL ' + expected + ': ' + result.error.slice(-700));
}

export const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);
export const catalog = () => sql(`select md5(string_agg(p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||((to_jsonb(p)-'prosrc'-'oid')::text)||':'||coalesce(obj_description(p.oid,'pg_proc'),''),E'\\n' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`);
export const closure = () => rows(`select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,
  (select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,
  private.retention_ai_source_ready() as ready`)[0];
export const conflicts40001 = () => Number(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'`));
export const aclOf = signature => sql(`select coalesce(proacl::text,'') from pg_proc where oid=to_regprocedure(${q(signature)})`);

/** The one row. */
export const row = () => JSON.parse(sql(`select value::text from private.marketplace_config where key=${q(KEY)}`));
export const setKnobs = patch => sql(`update private.marketplace_config set value = value || ${q(JSON.stringify(patch))}::jsonb, updated_at = statement_timestamp() where key=${q(KEY)}`);
export const dropKnobs = (...keys) => sql(`update private.marketplace_config set value = value ${keys.map(k => '- ' + q(k)).join(' ')}, updated_at = statement_timestamp() where key=${q(KEY)}`);
/** The documented one-row update of the MATCH-V1 ceiling. */
export const setCeiling = n => sql(`update private.marketplace_config set value = jsonb_set(value,'{ceiling}','${Number(n)}'::jsonb), updated_at = statement_timestamp() where key=${q(KEY)}`);
/** The MATCH-V1 profile re-queue watermark: far ahead (no changed profile is picked up) or a given SQL timestamp expression. */
export const requeueWatermark = expr => sql(`update private.marketplace_config set value = jsonb_build_object('after', ${expr}, 'afterAccount', ${q(NIL)}), updated_at = statement_timestamp() where key='match_v1_profile_requeue'`);
