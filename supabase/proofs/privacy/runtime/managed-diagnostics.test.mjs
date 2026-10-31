import assert from 'node:assert/strict';
import test from 'node:test';
import {describeAcl, describeManagedRow, valueHash} from './managed-diagnostics.mjs';

test('ACL ordering is normalized while grantor, privilege and grant option remain significant', () => {
  const first = describeAcl('{postgres=U*/owner,anon=U/owner}');
  assert.deepEqual(first, describeAcl('{anon=U/owner,postgres=U*/owner}'));
  for (const acl of ['{postgres=U/owner,anon=U/owner}', '{postgres=U*/other,anon=U/owner}',
    '{postgres=U*/owner,anon=UC/owner}']) {
    assert.notEqual(describeAcl(acl).semantics_sha256, first.semantics_sha256);
  }
  assert.notEqual(describeAcl(null).semantics_sha256, describeAcl('{}').semantics_sha256);
});

test('PUBLIC grant and unknown quoting cannot be confused with a named role or empty ACL', () => {
  assert.equal(describeAcl('{=r/postgres}').tuples[0].grantee_sha256, valueHash(''));
  for (const acl of ['{anon=rr/postgres}', '{"role,quoted"=r/postgres}', '{anon=Z/postgres}', 'raw']) {
    assert.throws(() => describeAcl(acl), /^Error: MANAGED_DIAGNOSTIC_REFUSED$/);
  }
});

test('diagnostics expose no raw identifiers, defaults, settings or unexpected properties', () => {
  const marker = 'SYNTHETIC_PRIVATE_MARKER';
  const row = {schema: marker, name: marker, owner: marker, acl: '{' + marker + '=r/' + marker + '}',
    columns: [{name: marker, position: 1, default_or_generated: marker, acl: null, [marker]: marker}],
    [marker]: marker};
  const result = describeManagedRow('managed_relation_contract', row);
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.equal(result.unreported_field_count, 1);
  assert.equal(result.columns[0].unreported_field_count, 1);
  const setting = describeManagedRow('safe_role_settings', {database: null, role: marker, setting: marker});
  assert.equal(JSON.stringify(setting).includes(marker), false);
});

test('column-level fingerprints distinguish the changed attribute and preserve column ACL evidence', () => {
  const row = {schema: 'realtime', name: 'messages', columns: [
    {name: 'id', position: 1, type: 'uuid', not_null: true, acl: null},
    {name: 'topic', position: 2, type: 'text', not_null: true, acl: '{anon=r/postgres}'}]};
  const before = describeManagedRow('managed_relation_contract', row);
  const changed = structuredClone(row);
  changed.columns[1].not_null = false;
  const after = describeManagedRow('managed_relation_contract', changed);
  assert.deepEqual(before.columns[0], after.columns[0]);
  assert.notEqual(before.columns[1].field_hashes.not_null, after.columns[1].field_hashes.not_null);
  assert.deepEqual(before.columns[1].acl, after.columns[1].acl);
  assert.throws(() => describeManagedRow('function_inventory', {name: 'secret'}));
});
