import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {extensionProvenanceObservation, compareExtensionProvenance} from './extension-provenance.mjs';
import {scrubSqlFailure} from './run.mjs';

const md5 = value => createHash('md5').update(value).digest('hex');
const queryHash = 'a'.repeat(64);
const names = ['pg_stat_statements', 'pgcrypto', 'uuid-ossp'];
const fixture = () => ({unit: 'R01_EXTENSION_PROVENANCE_CAPTURE', format_version: 1,
  read_only: 'on', server_version_num: 170006, database: 'postgres', capture_role: 'supabase_admin',
  delegation: {privileged_role_md5: md5('supabase_privileged_role'),
    privileged_extensions_superuser_md5: md5('supabase_admin'), postgres_superuser: false,
    postgres_privileged_usage: true, extension_allowlist: names.map(name => ({name, listed: true}))},
  extensions: names.map(name => ({name, present: true, owner_md5: md5('supabase_admin'),
    routines: [{key_hash: md5(name + '-routine'), owner_md5: md5('supabase_admin'),
      acl_null: false, acl_md5: md5(name + '-acl')}]}))});
const runner = readFileSync(new URL('./run.mjs', import.meta.url), 'utf8');
const query = readFileSync(new URL('./extension-provenance.sql', import.meta.url), 'utf8');

test('unchanged native owner/ACL snapshots do not claim DEV parity or modify inputs', () => {
  const before = fixture(), after = fixture();
  const untouched = JSON.stringify({before, after});
  const result = compareExtensionProvenance(before, after, queryHash);
  assert.equal(result.local_prerequisite_delta_observed, false);
  assert.deepEqual(result.changed_delegation_fields, []);
  assert.equal(result.extensions.every(row => !row.extension_owner_changed &&
    !row.owner_changed_routines.length && !row.acl_changed_routines.length), true);
  assert.match(result.limitations, /No delta does not establish DEV parity/);
  assert.equal(Object.hasOwn(result, 'metadata_equal'), false);
  assert.equal(Object.hasOwn(result, 'admitted'), false);
  assert.equal(JSON.stringify({before, after}), untouched);
});

test('pre/post snapshots locate extension and routine ownership changes without asserting their cause', () => {
  const before = fixture(), after = fixture();
  before.extensions[1].owner_md5 = md5('postgres');
  before.extensions[1].routines[0].owner_md5 = md5('postgres');
  const result = compareExtensionProvenance(before, after, queryHash);
  assert.equal(result.local_prerequisite_delta_observed, true);
  assert.equal(result.extensions[1].extension_owner_changed, true);
  assert.deepEqual(result.extensions[1].owner_changed_routines, [after.extensions[1].routines[0].key_hash]);
  assert.deepEqual(result.extensions[1].acl_changed_routines, []);
  assert.equal(result.extensions[0].extension_owner_changed, false);
  assert.match(result.limitations, /not its mechanism or hosted provisioning history/);
});

test('ACL fingerprint or NULL representation changes remain visible without owner changes', () => {
  for (const mutate of [row => {row.acl_md5 = md5('different grantor or option');},
    row => {row.acl_null = true;}]) {
    const before = fixture(), after = fixture();
    mutate(after.extensions[0].routines[0]);
    const result = compareExtensionProvenance(before, after, queryHash);
    assert.equal(result.local_prerequisite_delta_observed, true);
    assert.deepEqual(result.extensions[0].acl_changed_routines, [after.extensions[0].routines[0].key_hash]);
    assert.deepEqual(result.extensions[0].owner_changed_routines, []);
  }
});

test('absent native extension can become present, and removed routines are not concealed', () => {
  const before = fixture(), after = fixture();
  before.extensions[0] = {name: names[0], present: false, owner_md5: null, routines: []};
  after.extensions[2].routines = [];
  const result = compareExtensionProvenance(before, after, queryHash);
  assert.equal(result.extensions[0].before_present, false);
  assert.equal(result.extensions[0].after_present, true);
  assert.deepEqual(result.extensions[0].added_routines, [after.extensions[0].routines[0].key_hash]);
  assert.deepEqual(result.extensions[2].removed_routines, [before.extensions[2].routines[0].key_hash]);
});

test('only fixed delegation fields are exposed, including missing configuration', () => {
  const before = fixture(), after = fixture();
  after.delegation.privileged_role_md5 = null;
  after.delegation.postgres_privileged_usage = null;
  after.delegation.extension_allowlist[1].listed = null;
  const result = compareExtensionProvenance(before, after, queryHash);
  assert.deepEqual(result.changed_delegation_fields,
    ['privileged_role_md5', 'postgres_privileged_usage', 'extension_allowlist']);
  assert.equal(JSON.stringify(result).includes('supabase_privileged_role'), false);
});

test('malformed, unapproved, reordered or raw-sensitive observations fail closed', () => {
  const mutations = [x => {x.read_only = 'off';}, x => {x.server_version_num = 180003;},
    x => {x.database = 'hosted';}, x => {x.capture_role = 'postgres';},
    x => {x.extra = 'PRIVATE_TOKEN';}, x => {x.delegation.jwt_secret = 'PRIVATE_TOKEN';},
    x => {x.delegation.privileged_role_md5 = 'PRIVATE_ROLE';},
    x => {x.delegation.privileged_role_md5 = [md5('secret')];},
    x => {x.delegation.extension_allowlist.reverse();}, x => {x.extensions.reverse();},
    x => {x.extensions[0].name = 'unexpected_extension';},
    x => {x.extensions[0].owner_md5 = null;},
    x => {x.extensions[0].routines[0].definition = 'PRIVATE_FUNCTION_BODY';},
    x => {x.extensions[0].routines[0].acl_md5 = 'PRIVATE_ACL';},
    x => {x.extensions[0].routines[0].key_hash = x.extensions[1].routines[0].key_hash;},
    x => {x.extensions[0].routines.push(x.extensions[0].routines[0]);},
    x => {x.extensions[0].present = false; x.extensions[0].owner_md5 = null;}];
  for (const mutate of mutations) {
    const value = fixture(); mutate(value);
    assert.throws(() => extensionProvenanceObservation(value), /FORMAT_REFUSED/);
    assert.throws(() => compareExtensionProvenance(value, fixture(), queryHash), /FORMAT_REFUSED/);
    assert.throws(() => compareExtensionProvenance(fixture(), value, queryHash), /FORMAT_REFUSED/);
  }
  assert.throws(() => compareExtensionProvenance(fixture(), fixture(), 'private query'), /FORMAT_REFUSED/);
});

test('collector is read-only, bound to three extensions and three allowlisted settings, without raw catalog identities', () => {
  const source = query.replace(/^--.*$/gm, '');
  assert.match(source, /BEGIN TRANSACTION READ ONLY;/);
  assert.match(source, /SET LOCAL search_path = pg_catalog;/);
  assert.match(source, /ROLLBACK;\s*$/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|COPY|DO)\b/i);
  assert.deepEqual([...source.matchAll(/'supautils\.([^']+)'/g)].map(match => match[1]).filter((v, i, a) => a.indexOf(v) === i).sort(),
    ['privileged_extensions', 'privileged_extensions_superuser', 'privileged_role']);
  assert.doesNotMatch(source, /pg_authid|rolpassword|pg_get_functiondef|prosrc|proconfig/);
  assert.match(source, /pg_get_function_identity_arguments\(p\.oid\)/);
  assert.match(source, /md5\(pg_get_userbyid\(a\.grantor\)\),a\.privilege_type,a\.is_grantable/);
});

test('runner captures and publishes both sides around unchanged prerequisites before any parity decision', () => {
  const before = runner.indexOf("const extensionBefore = extensionProvenanceObservation");
  const auth = runner.indexOf("sql('AUTH_SEARCH_INDEXES'");
  const extensions = runner.indexOf("sql('PLATFORM_EXTENSIONS'");
  const after = runner.indexOf("const extensionAfter = extensionProvenanceObservation");
  const admission = runner.indexOf("const extensions = JSON.parse(sql('EXTENSION_ADMISSION'");
  assert.ok(before > 0 && before < auth && auth < extensions && extensions < after && after < admission);
  for (const path of ['extension-provenance-before.json', 'extension-provenance-after.json', 'extension-provenance-diff.json']) {
    assert.ok(runner.indexOf(path) > before && runner.indexOf(path) < admission);
  }
  assert.match(runner, /extension_provenance_query: join\(here, 'extension-provenance\.sql'\)/);
  assert.match(runner, /extension_provenance_diagnostic: join\(here, 'extension-provenance\.mjs'\)/);
  assert.match(runner, /'EXTENSION_PROVENANCE_BEFORE', 'EXTENSION_PROVENANCE_AFTER',/);
  assert.doesNotMatch(runner, /receipt\.[a-z_]+\s*=\s*extensionProvenance\./);
});

test('every existing admission gate still throws despite an unchanged diagnostic snapshot', () => {
  const start = runner.indexOf("stage = 'STRICT_PARITY';");
  const end = runner.indexOf("receipt.result = 'METADATA_EQUAL';", start);
  assert.ok(start >= 0 && end > start);
  const gateSource = runner.slice(start, end);
  const unchanged = compareExtensionProvenance(fixture(), fixture(), queryHash);
  const context = () => ({stage: '', receipt: {}, extensionProvenance: unchanged,
    comparison: {status: 0}, scrubbed: {metadata_equal: true},
    managedNetComparison: {equal: true}, nativeNetComparison: {provenance_verified: true},
    hostedComparison: {provenance_verified: true}, adminPathComparison: {effective_disposable_path_verified: true},
    aclComparison: {caller_scope_verified: true}, storageComparison: {owner_grant_representation_verified: true},
    requestPathComparison: {qualified_source_equal: true},
    required: (valid, code) => {if (!valid) throw new Error(code);}});
  const cases = [
    ['comparison', 'status', 1, 'METADATA_PARITY_DIFFERENT'],
    ['scrubbed', 'metadata_equal', false, 'METADATA_PARITY_DIFFERENT'],
    ['managedNetComparison', 'equal', false, 'MANAGED_NET_HOOK_DIFFERENT'],
    ['nativeNetComparison', 'provenance_verified', false, 'NATIVE_NET_PROVENANCE_DIFFERENT'],
    ['hostedComparison', 'provenance_verified', false, 'HOSTED_LOGIN_DEPENDENCY_DIFFERENT'],
    ['adminPathComparison', 'effective_disposable_path_verified', false, 'ADMIN_EFFECTIVE_PATH_DIFFERENT'],
    ['aclComparison', 'caller_scope_verified', false, 'EXTENSION_ACL_CALLER_SCOPE_DIFFERENT'],
    ['storageComparison', 'owner_grant_representation_verified', false, 'STORAGE_OWNER_ACL_DIFFERENT'],
    ['requestPathComparison', 'qualified_source_equal', false, 'REQUEST_PATH_SOURCE_DIFFERENT']];
  for (const [object, field, value, code] of cases) {
    const env = context(); env[object][field] = value;
    assert.throws(() => runInNewContext(gateSource, env), new RegExp(code));
  }
  assert.doesNotThrow(() => runInNewContext(gateSource, context()));
});

test('new diagnostic stages use existing scrubbed SQL failure output', () => {
  const marker = 'PRIVATE_SETTING_OR_SQL_TEXT';
  const result = scrubSqlFailure(`psql:<stdin>:20: ERROR:  42501: ${marker}`);
  assert.deepEqual(result.source_lines, [20]);
  assert.deepEqual(result.sqlstates, ['42501']);
  assert.equal(JSON.stringify(result).includes(marker), false);
});
