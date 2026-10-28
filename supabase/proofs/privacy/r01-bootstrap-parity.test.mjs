import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildManifest, compareCapture} from './r01-bootstrap-parity.mjs';

function fixture() {
  const definition = "CREATE OR REPLACE FUNCTION public.rpc_closure_api_guard() RETURNS void LANGUAGE sql AS 'SELECT NULL::void';\n";
  const needs = {schema: 'public', name: 'needs', owner: 'postgres', rls: true,
    columns: [{position: 1, name: 'id', default_or_generated: "'SYNTHETIC_PRIVATE_DEFAULT'::text"}],
    dropped_column_positions: [2]};
  const fn = {schema: 'public', name: 'rpc_closure_api_guard', identity_arguments: '',
    pinned_definition_md5: createHash('md5').update(definition).digest('hex'),
    security_definer: true, settings: ['search_path=public'], acl: '{postgres=X/postgres}'};
  const sections = {application_relations: [needs], managed_relation_contract: [],
    constraints: [], indexes: [], policies: [], triggers: [], function_inventory: [fn],
    schemas: [], memberships: [], default_acl: [], safe_role_settings: []};
  return {unit: 'R01_BOOTSTRAP_METADATA_ONLY', format_version: 3, transaction_read_only: 'on',
    server_version_num: 170006, normalization: {search_path: 'pg_catalog'},
    required_objects: {needs: true, auth_users: true, auth_identities: true, authenticator: true, closure_pre_request: true},
    unsupported_shapes: Object.fromEntries(['aggregate_or_window_functions', 'casts', 'collations', 'custom_types',
      'inheritance', 'nonordinary_application_relations', 'operators', 'rewrite_rules'].map(k => [k, []])),
    catalog_sections: sections,
    normalized_sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, {row_count: v.length, md5: '0'.repeat(32)}])),
    ...Object.fromEntries(['function_inventory', 'schemas', 'memberships', 'default_acl', 'safe_role_settings'].map(k => [k, sections[k]])),
    roles: [{name: 'authenticated', bypassrls: false}], extensions: [{name: 'postgis', version: '3.3.7'}],
    sequences: [{schema: 'public', name: 'id_seq', start: '1', increment: '1', min: '1', max: '9223372036854775807', cache: '1'}],
    event_triggers: [], needs_column_select: [{role: 'authenticated', column: 'private_reason', effective_select: true}],
    managed_auth_relations: [], managed_auth_constraints: [], managed_auth_triggers: [],
    needs_relation: needs, needs_policies: [],
    function_definitions: [{schema: fn.schema, name: fn.name, identity_arguments: '', definition}],
  };
}
const compareMutation = mutate => {
  const baseline = fixture();
  const manifest = buildManifest(baseline);
  const changed = structuredClone(baseline);
  mutate(changed);
  return compareCapture(manifest, changed);
};

test('captures compare equally despite observation time/session and JSON object key order', () => {
  const first = fixture();
  const next = JSON.parse(JSON.stringify(first));
  next.captured_at = '2026-10-28'; next.session_role = 'another_capture_role';
  next.roles[0] = {bypassrls: false, name: 'authenticated'};
  assert.equal(compareCapture(buildManifest(first), next).metadata_equal, true);
});
test('manifest and differences do not contain source definitions or default literals', () => {
  const baseline = fixture();
  const manifest = buildManifest(baseline);
  const next = fixture(); next.needs_relation.columns[0].default_or_generated = "'ANOTHER_PRIVATE_DEFAULT'";
  const result = compareCapture(manifest, next);
  const output = JSON.stringify({manifest, result});
  assert.equal(result.metadata_equal, false);
  assert.deepEqual(result.differences[0].fields, ['columns']);
  for (const marker of ['SYNTHETIC_PRIVATE_DEFAULT', 'ANOTHER_PRIVATE_DEFAULT', 'CREATE OR REPLACE', 'SELECT NULL']) assert.ok(!output.includes(marker));
});
for (const [name, mutation, group] of [
  ['column ACL/effective access', x => { x.needs_column_select[0].effective_select = false; }, 'needs_column_select'],
  ['RLS disabled', x => { x.needs_relation.rls = false; }, 'application_relations'],
  ['security definer', x => { x.function_inventory[0].security_definer = false; }, 'function_inventory'],
  ['function search path', x => { x.function_inventory[0].settings = ['search_path=private']; }, 'function_inventory'],
  ['function ACL', x => { x.function_inventory[0].acl = '{=X/postgres}'; }, 'function_inventory'],
  ['role bypass', x => { x.roles[0].bypassrls = true; }, 'roles'],
  ['PostGIS version', x => { x.extensions[0].version = '3.4.0'; }, 'extensions'],
  ['dropped column position', x => { x.needs_relation.dropped_column_positions = []; }, 'application_relations'],
  ['one-bit sequence maximum', x => { x.sequences[0].max = '9223372036854775806'; }, 'sequences'],
]) test(`rejects ${name} drift even when supplied section digest is unchanged`, () => {
  const result = compareMutation(mutation);
  assert.equal(result.metadata_equal, false);
  assert.equal(result.differences[0].group, group);
});
test('missing/extra objects and changed PostgreSQL patch are blocked', () => {
  const result = compareMutation(x => {
    x.roles = [{name: 'unexpected_role', bypassrls: false}]; x.server_version_num = 170007;
  });
  assert.equal(result.metadata_equal, false);
  assert.deepEqual(result.differences.map(x => x.kind).sort(), ['added', 'changed', 'missing']);
});
for (const [name, mutation] of [
  ['old capture', x => { x.format_version = 1; }],
  ['writable capture', x => { x.transaction_read_only = 'off'; }],
  ['wrong path', x => { x.normalization.search_path = 'public'; }],
  ['PostgreSQL18', x => { x.server_version_num = 180003; }],
  ['missing required object', x => { x.required_objects.auth_users = false; }],
  ['unsupported cast', x => { x.unsupported_shapes.casts.push({source: 'text'}); }],
  ['missing unsupported inventory', x => { delete x.unsupported_shapes.casts; }],
  ['missing catalog section', x => { delete x.catalog_sections.constraints; }],
  ['truncated section', x => { x.normalized_sections.application_relations.row_count = 2; }],
  ['duplicate role', x => { x.roles.push({...x.roles[0]}); }],
  ['mismatched function DDL', x => { x.function_definitions[0].definition += '-- altered'; }],
  ['missing function DDL', x => { x.function_definitions = []; }],
  ['inconsistent convenience field', x => { x.needs_relation = {...x.needs_relation, owner: 'other'}; }],
  ['unsafe JSON number', x => { x.sequences[0].max = 9223372036854775807; }],
  ['numeric sequence input', x => { x.sequences[0].start = 1; }],
  ['noncanonical sequence input', x => { x.sequences[0].start = '01'; }],
  ['bigint overflow', x => { x.sequences[0].max = '9223372036854775808'; }],
  ['missing managed Auth relations', x => { delete x.managed_auth_relations; }],
  ['inconsistent managed Auth constraints', x => { x.managed_auth_constraints = [{schema: 'auth', relation: 'users', name: 'unexpected'}]; }],
  ['inconsistent managed Auth triggers', x => { x.managed_auth_triggers = [{schema: 'auth', relation: 'users', name: 'unexpected'}]; }],
]) test(`fails closed for ${name}`, () => assert.throws(() => buildManifest((() => {
  const x = fixture(); mutation(x); return x;
})()), /Invalid R01 metadata/));
test('a missing expected manifest section cannot silently narrow the comparison', () => {
  const manifest = buildManifest(fixture()); delete manifest.groups.roles;
  assert.throws(() => compareCapture(manifest, fixture()), /fingerprint groups/);
});
