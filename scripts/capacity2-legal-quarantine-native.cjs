'use strict';
// Opt-in real PostgreSQL concurrency proof, exclusively on a disposable local
// server. No URL, credential or hosted project connection is accepted here.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { fixture, candidate, migrationPath, accountId, preimage } = require('./capacity2-legal-quarantine-fixture.cjs');
const installation = process.env.USKOCI_POSTGRES_ROOT;
if (!installation || !process.env.USKOCI_PG_MODULE) throw new Error('Explicit local PostgreSQL installation and node-postgres module are required');
const { Client } = require(process.env.USKOCI_PG_MODULE);
const bin = path.join(installation, 'usr/lib/postgresql/17/bin');
const env = { ...process.env, LD_LIBRARY_PATH: path.join(installation, 'usr/lib/x86_64-linux-gnu') };
const port = 55435;
const output = process.argv[2] || path.join(__dirname, '../docs/plan/proofs/capacity2-legal-quarantine-native-20261108.json');
const result = { observedAt: new Date().toISOString(), migration: migrationPath,
 acceptanceRpc: 'public.rpc_accept_reviewed_legal_bundle(text,text,text)',
 migrationSha256: createHash('sha256').update(candidate).digest('hex'),
 boundary: 'Disposable local PostgreSQL, real registry/RPC SQL and real concurrent sessions. Not DEV, Android, legal advice or approval.', scenarios: [] };

async function withFixture(fn) {
 const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'uskoci-legal-quarantine-pg-'));
 const data = path.join(temporary, 'data'), logPath = path.join(temporary, 'server.log');
 let server;
 const clients = new Set();
 try {
  const init = spawnSync(path.join(bin, 'initdb'), ['-D', data, '-L', path.join(installation, 'usr/share/postgresql/17'),
   '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { env, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const log = fs.openSync(logPath, 'w');
  server = spawn(path.join(bin, 'postgres'), ['-D', data, '-p', String(port), '-c', 'unix_socket_directories=',
   '-c', 'listen_addresses=127.0.0.1', '-c', 'max_connections=10', '-c', 'shared_buffers=32MB'], { env, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  for (let attempt = 0; attempt < 100; attempt++) {
   if (server.exitCode !== null) throw new Error('Isolated server exited: ' + fs.readFileSync(logPath, 'utf8'));
   if (spawnSync(path.join(bin, 'pg_isready'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres'], { env, stdio: 'ignore' }).status === 0) break;
   assert.ok(attempt < 99, 'Isolated server readiness deadline');
   await new Promise(resolve => setTimeout(resolve, 25));
  }
  const connect = async () => {
   const c = new Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', application_name: 'capacity2_legal_fixture' });
   clients.add(c); c.on('error', () => {});
   await c.connect();
   assert.equal((await c.query("select current_setting('data_directory') as directory")).rows[0].directory, data,
    'Refuse any pre-existing server on the reserved fixture port');
   return c;
  };
  class NativeDb {
   constructor() { this.ready = connect().then(c => { this.client = c; }); }
   async query(sql, args = []) { await this.ready; return this.client.query(sql, args); }
   async exec(sql) { return this.query(sql); }
   async close() { if (this.client) await this.client.end(); }
  }
  const f = await fixture(NativeDb);
  result.postgres = await f.value('select version() as value');
  await fn(f, connect);
 } finally {
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGINT'); await stopped; }
  await Promise.allSettled([...clients].map(c => c.end()));
  fs.rmSync(temporary, { recursive: true, force: true });
 }
}

async function lockWait(observer, pid) {
 for (let i = 0; i < 100; i++) {
  const row = (await observer.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0];
  if (row?.wait_event_type === 'Lock') return;
  await new Promise(resolve => setTimeout(resolve, 10));
 }
 assert.fail('Expected real PostgreSQL lock wait was not observed');
}
async function prepareAcceptor(client, transaction) {
 if (transaction) await client.query('begin');
 await client.query("select set_config('request.jwt.claim.sub',$1,false)", [accountId]);
 await client.query('set role authenticated');
}
const termsHash = preimage.documents.find(d => d.document_kind === 'TERMS').content_sha256;
const privacyHash = preimage.documents.find(d => d.document_kind === 'PRIVACY').content_sha256;
assert.match(termsHash, /^[a-f0-9]{64}$/); assert.match(privacyHash, /^[a-f0-9]{64}$/);
const acceptSql = `select public.rpc_accept_reviewed_legal_bundle('native_quarantine_acceptance_1','${termsHash}','${privacyHash}') as value`;

async function main() {
 await withFixture(async (f, connect) => {
  const acceptor = await connect(), observer = await connect();
  await prepareAcceptor(acceptor, false);
  await f.db.exec(candidate.replace(/\ncommit;\s*$/, '\n'));
  const pid = (await acceptor.query('select pg_backend_pid() as pid')).rows[0].pid;
  const pending = acceptor.query(acceptSql).then(() => ({ accepted: true }), e => ({ error: e.message }));
  await lockWait(observer, pid);
  assert.equal((await observer.query('select public.rpc_get_legal_bundle() as value')).rows[0].value.ready, true,
   'Ordinary readers see the committed state and are not blocked by the withdrawal lock');
  await f.db.exec('commit');
  assert.match((await pending).error, /LEGAL_DOCUMENTS_NOT_PUBLISHED/);
  assert.equal(await f.value('select count(*)::integer as value from public.account_legal_acceptance_events'), 0);
  assert.equal((await f.value('select public.rpc_get_legal_bundle() as value')).ready, false);
  result.scenarios.push({ name: 'withdrawal wins before acceptance reads', realLockWait: true,
   ordinaryReadRemainsAvailable: true, acceptanceRejectedAfterCommit: true, acceptanceRows: 0, pass: true });
 });
 for (const commit of [true, false]) await withFixture(async (f, connect) => {
  const acceptor = await connect(), observer = await connect();
  await prepareAcceptor(acceptor, true);
  assert.equal((await acceptor.query(acceptSql)).rows[0].value.accepted, true);
  const pid = await f.value('select pg_backend_pid() as value');
  const pending = f.run().then(() => ({ withdrawn: true }), e => ({ error: e.message }));
  await lockWait(observer, pid);
  await acceptor.query(commit ? 'commit' : 'rollback');
  const outcome = await pending;
  if (commit) assert.match(outcome.error, /R12_QUARANTINE_ACCEPTANCE_REQUIRES_REVIEW/);
  else assert.equal(outcome.withdrawn, true);
  assert.equal(await f.value('select count(*)::integer as value from public.account_legal_acceptance_events'), commit ? 1 : 0);
  assert.equal((await f.value('select public.rpc_get_legal_bundle() as value')).ready, commit);
  assert.equal((await f.value('select public.rpc_get_processor_map_status() as value')).ready, commit);
  result.scenarios.push({ name: commit ? 'earlier acceptance commits' : 'earlier acceptance rolls back', realLockWait: true,
   migration: commit ? 'refused atomically for review' : 'withdrawn after rollback', acceptanceRows: commit ? 1 : 0, pass: true });
 });
 fs.mkdirSync(path.dirname(output), { recursive: true });
 fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
 console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
