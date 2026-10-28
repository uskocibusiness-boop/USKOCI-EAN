import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {scrubComparison, scrubSqlFailure, validateEnvironment, validateGeneratedInputs, validatePostgresAdmission} from './run.mjs';

const pins = JSON.parse(readFileSync(new URL('./pins.json', import.meta.url), 'utf8'));
const sql = "BEGIN;\nDO $$ BEGIN IF current_setting('uskoci.r01.bootstrap', true) IS DISTINCT FROM 'LOCAL_ONLY' " +
  "OR current_user <> 'postgres' OR current_database() <> 'postgres' THEN RAISE EXCEPTION 'NO'; END IF; END $$;\nCOMMIT;\n";
const hash = value => createHash('sha256').update(value).digest('hex');
const generation = () => ({unit: 'R01_BOOTSTRAP_OBJECT_PROVENANCE', format_version: 1,
  status: 'GENERATED_NOT_EXECUTED', input_capture_sha256: 'a'.repeat(64), sql_sha256: hash(sql),
  pre_request: 'pgrst.db_pre_request=public.rpc_closure_api_guard', prerequisite_extensions: pins.extensions});
const expected = {unit: 'R01_BOOTSTRAP_FINGERPRINTS', format_version: 1, server_version_num: 170006};

test('source admission rejects a changed SQL body, missing guard, extension drift and psql escape', () => {
  validateGeneratedInputs(sql, generation(), expected);
  assert.throws(() => validateGeneratedInputs(sql + 'SELECT 1;', generation(), expected), /SOURCE_DRIFT/);
  const noGuard = sql.replace('LOCAL_ONLY', 'ANYWHERE');
  assert.throws(() => validateGeneratedInputs(noGuard, {...generation(), sql_sha256: hash(noGuard)}, expected), /GUARD/);
  const escape = sql + '\\connect remote\n';
  assert.throws(() => validateGeneratedInputs(escape, {...generation(), sql_sha256: hash(escape)}, expected), /META_COMMAND/);
  const wrongVersion = generation();
  wrongVersion.prerequisite_extensions = pins.extensions.map(e => e.name === 'postgis' ? {...e, version: '3.6.0'} : e);
  assert.throws(() => validateGeneratedInputs(sql, wrongVersion, expected));
  assert.throws(() => validateGeneratedInputs(sql, generation(), {...expected, server_version_num: 180000}));
});

test('PostgreSQL admission accepts the observed privileged group with effective inherited usage', () => {
  validatePostgresAdmission({server_version_num: 170006, user: 'postgres', database: 'postgres',
    socket: true, postgres_superuser: false, supautils_privileged_role: 'supabase_privileged_role',
    supautils_privileged_context: 'sighup', postgres_privileged_usage: true});
});

test('PostgreSQL admission fails closed on membership-only, absent configuration and target drift', () => {
  const valid = {server_version_num: 170006, user: 'postgres', database: 'postgres', socket: true,
    postgres_superuser: false, supautils_privileged_role: 'supabase_privileged_role',
    supautils_privileged_context: 'sighup', postgres_privileged_usage: true};
  for (const change of [{postgres_privileged_usage: false, postgres_privileged_member: true},
    {postgres_privileged_usage: null}, {postgres_privileged_usage: 'true'},
    {supautils_privileged_role: null}, {supautils_privileged_role: 'postgres'},
    {supautils_privileged_role: 'other_privileged_group'}, {supautils_privileged_context: 'user'},
    {supautils_privileged_context: null}, {postgres_superuser: true}, {postgres_superuser: null},
    {user: 'supabase_admin'}, {database: 'other'}, {socket: false}, {socket: 1},
    {server_version_num: 180003}]) {
    assert.throws(() => validatePostgresAdmission({...valid, ...change}), /PG_RUNTIME_REFUSED/);
  }
  assert.throws(() => validatePostgresAdmission(null), /PG_RUNTIME_REFUSED/);
});

const environment = () => ({RUNNER_OS: 'Linux', GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_BASE_REF: 'feature/uskoci-cisto', GITHUB_SHA: '1'.repeat(40), GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1', RUNNER_TEMP: '/tmp/runner', GITHUB_WORKSPACE: '/tmp/repository'});

test('runtime target admission rejects non-PR events, unrelated base branches and remote tool configuration', () => {
  validateEnvironment(environment(), 'linux');
  for (const change of [{GITHUB_EVENT_NAME: 'pull_request_target'}, {GITHUB_BASE_REF: 'main'},
    {GITHUB_RUN_ID: '../escape'}, {RUNNER_TEMP: 'relative'}, {DOCKER_HOST: 'tcp://remote:2375'},
    {SUPABASE_ACCESS_TOKEN: 'private-test-marker'}, {SUPABASE_WORKDIR: '/tmp/linked'}]) {
    assert.throws(() => validateEnvironment({...environment(), ...change}, 'linux'));
  }
  assert.throws(() => validateEnvironment(environment(), 'win32'));
});

test('public mismatch report contains hashes instead of raw catalog identities or unapproved fields', () => {
  const marker = 'PRIVATE_SOURCE_OR_SETTING_MARKER';
  const comparison = {unit: 'R01_BOOTSTRAP_METADATA_COMPARISON', metadata_equal: false,
    raw_capture: marker, differences: [{group: 'function_inventory', key: marker, kind: 'changed',
      expected_sha256: 'a'.repeat(64), observed_sha256: 'b'.repeat(64), fields: ['body_md5'], definition: marker}]};
  const result = scrubComparison(comparison);
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.equal(result.differences[0].key_sha256, hash(marker));
  assert.equal(result.metadata_equal, false);
  assert.equal(result.difference_count, 1);
});

test('malformed comparison cannot turn mismatches or raw text into accepted public evidence', () => {
  const row = {group: 'schemas', key: 'public', kind: 'changed',
    expected_sha256: 'a'.repeat(64), observed_sha256: 'b'.repeat(64), fields: ['acl']};
  const comparison = {unit: 'R01_BOOTSTRAP_METADATA_COMPARISON', metadata_equal: false, differences: [row]};
  assert.throws(() => scrubComparison({...comparison, metadata_equal: true}));
  assert.throws(() => scrubComparison({...comparison, differences: [{...row, expected_sha256: 'private-text'}]}));
  assert.throws(() => scrubComparison({...comparison, differences: [{...row, fields: ['raw secret text']}]}));
  assert.throws(() => scrubComparison({...comparison, differences: [{...row, group: 'raw secret text'}]}));
  assert.equal(scrubComparison({...comparison, metadata_equal: true, differences: []}).metadata_equal, true);
});

test('SQL diagnostics retain only SQLSTATE, bounded guard names and a hash', () => {
  const privateText = 'SYNTHETIC_PRIVATE_VALUE';
  const stderr = 'psql:<stdin>:12345: ERROR:  42501: R01_BOOTSTRAP_NOT_ADMITTED ' + privateText + '\nCONTEXT: SELECT secret;';
  const result = scrubSqlFailure(stderr);
  assert.deepEqual(result.sqlstates, ['42501']);
  assert.deepEqual(result.source_lines, [12345]);
  assert.deepEqual(result.guards, ['R01_BOOTSTRAP_NOT_ADMITTED']);
  assert.equal(result.stderr_sha256, hash(stderr));
  assert.equal(JSON.stringify(result).includes(privateText), false);
  assert.equal(JSON.stringify(result).includes('SELECT secret'), false);
  assert.deepEqual(scrubSqlFailure('unstructured private output').sqlstates, []);
});
