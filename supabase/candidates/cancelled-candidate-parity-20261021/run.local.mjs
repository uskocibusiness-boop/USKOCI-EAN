// CCP01. Proof-only runner for an already prepared disposable Postgres clone.
// It cannot apply the candidate function bodies; the SQL proof rolls back.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const urlText = process.env.CCP_DISPOSABLE_DB_URL;
assert.ok(urlText, 'CCP_DISPOSABLE_DB_URL is required');
const url = new URL(urlText);
assert.ok(['postgresql:', 'postgres:'].includes(url.protocol), 'Postgres URL required');
assert.equal(url.hostname, '127.0.0.1', 'Only loopback disposable database allowed');
assert.equal(url.port, '54322', 'Only local disposable Postgres port 54322 allowed');
assert.equal(url.pathname, '/postgres', 'Only local disposable database postgres allowed');
assert.equal(url.username, 'postgres', 'Only local disposable postgres role allowed');
assert.ok(!url.search && !url.hash, 'Unexpected connection URL options');
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--source-check'),
  'Use --source-check or no argument for proof-only');

const forward = readFileSync(resolve(dir, 'forward.sql'), 'utf8');
const proof = readFileSync(resolve(dir, 'projection.regression.sql'), 'utf8');
assert.equal((forward.match(/exists\(select 1 from public\.agreements a where a\.selected_response_id=r\.id and a\.status<>'CANCELLED'\) as has_agreement/g) ?? []).length, 2,
  'Both candidate overloads must exclude canceled Agreements');
assert.match(proof, /select public\.rpc_cancel_agreement\(/i);
assert.match(proof, /public\.rpc_list_need_candidates_page\(/i);
assert.match(proof, /\\echo PASS CCP01/);
const firstSql = proof.replace(/^(?:(?:--[^\n]*\n)|(?:\\set ON_ERROR_STOP on[^\n]*\n)|\s)*/i, '');
assert.match(firstSql, /^begin\s*;/i);
assert.doesNotMatch(proof, /\bcommit\s*;/i);
assert.match(proof, /rollback;\s*$/i);
console.log('PASS CCP01 source shape and disposable target guard');
if (process.argv[2] === '--source-check') process.exit(0);

function psql(file) {
  // Build a minimal child environment so inherited libpq variables (notably
  // PGHOSTADDR and PGSERVICE) cannot override the checked connection target.
  const childEnv = Object.fromEntries(
    ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP'].flatMap((key) =>
      process.env[key] ? [[key, process.env[key]]] : []),
  );
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', file], {
    cwd: resolve(dir, '../../..'),
    env: {
      ...childEnv,
      PGHOST: url.hostname,
      PGPORT: url.port,
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.slice(1),
    },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 2 ** 20,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`CCP01 psql failed for ${basename(file)} (exit ${result.status})`);
  }
  process.stdout.write(result.stdout ?? '');
}

psql(resolve(dir, 'projection.regression.sql'));
