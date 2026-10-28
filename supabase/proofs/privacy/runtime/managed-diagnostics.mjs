// Read-only, non-accepting diagnostics. Raw names, SQL and setting values never leave this module.
import {createHash} from 'node:crypto';
import {canonical, compareCapture} from '../r01-bootstrap-parity.mjs';

export const valueHash = value => createHash('sha256').update(canonical(value)).digest('hex');
const textHash = value => createHash('sha256').update(value).digest('hex');
const keys = {
  managed_relation_contract: ['schema', 'name'], indexes: ['schema', 'relation', 'name'],
  schemas: ['name'], memberships: ['role', 'member', 'grantor'],
  default_acl: ['owner', 'schema', 'kind'], safe_role_settings: ['database', 'role', 'setting'],
  roles: ['name'], extensions: ['name'],
};
const fields = {
  managed_relation_contract: ['schema', 'name', 'owner', 'acl', 'rls', 'force_rls', 'kind',
    'columns', 'options', 'tablespace', 'persistence', 'is_partition', 'access_method',
    'replica_identity', 'dropped_column_positions'],
  indexes: ['schema', 'relation', 'name', 'constraints', 'definition', 'immediate',
    'is_exclusion', 'is_primary', 'is_unique', 'live', 'nulls_not_distinct', 'options',
    'ready', 'replica_identity', 'valid'],
  schemas: ['name', 'owner', 'acl'],
  memberships: ['role', 'member', 'grantor', 'admin_option', 'inherit_option', 'set_option'],
  default_acl: ['owner', 'schema', 'kind', 'acl'],
  safe_role_settings: ['database', 'role', 'setting'],
  roles: ['name', 'bypassrls', 'canlogin', 'createdb', 'createrole', 'inherit', 'replication', 'superuser'],
  extensions: ['name', 'schema', 'version', 'owner'],
};
const columnFields = ['name', 'position', 'type', 'acl', 'not_null', 'default_or_generated',
  'identity', 'generated', 'collation', 'storage', 'compression'];
function requireValid(condition) {
  if (!condition) throw new Error('MANAGED_DIAGNOSTIC_REFUSED');
}
function fingerprints(row, allowed) {
  return Object.fromEntries(allowed.filter(k => Object.hasOwn(row, k)).map(k => [k, valueHash(row[k])]));
}

export function describeAcl(acl) {
  if (acl === null) return {is_null: true, tuples: null, semantics_sha256: valueHash(null)};
  requireValid(typeof acl === 'string' && acl.startsWith('{') && acl.endsWith('}'));
  const tuples = [];
  for (const item of acl.slice(1, -1) === '' ? [] : acl.slice(1, -1).split(',')) {
    // Current captured platform roles are simple identifiers. Unknown quoting fails closed.
    const match = /^([A-Za-z_][A-Za-z0-9_$]*|)=((?:[arwdDxtmXUCTc]\*?)*)\/([A-Za-z_][A-Za-z0-9_$]*)$/.exec(item);
    requireValid(match !== null);
    const seen = new Set();
    for (const token of match[2].matchAll(/([arwdDxtmXUCTc])(\*)?/g)) {
      requireValid(!seen.has(token[1]));
      seen.add(token[1]);
      tuples.push({grantee_sha256: valueHash(match[1]), grantor_sha256: valueHash(match[3]),
        privilege: token[1], grantable: token[2] === '*'});
    }
  }
  tuples.sort((a, b) => canonical(a).localeCompare(canonical(b), 'en'));
  return {is_null: false, tuples, semantics_sha256: valueHash(tuples)};
}

export function describeManagedRow(group, row) {
  requireValid(Object.hasOwn(keys, group) && row !== null && typeof row === 'object' && !Array.isArray(row));
  requireValid(keys[group].every(k => Object.hasOwn(row, k) && (row[k] === null || typeof row[k] === 'string')));
  const result = {group, key_sha256: textHash(JSON.stringify(keys[group].map(k => row[k]))),
    row_sha256: valueHash(row), field_hashes: fingerprints(row, fields[group]),
    unreported_field_count: Object.keys(row).filter(k => !fields[group].includes(k)).length};
  if (Object.hasOwn(row, 'acl')) result.acl = describeAcl(row.acl);
  if (group === 'managed_relation_contract') {
    requireValid(Array.isArray(row.columns));
    const seen = new Set();
    result.columns = row.columns.map(column => {
      requireValid(typeof column.name === 'string' && !seen.has(column.name));
      seen.add(column.name);
      const result = {name_sha256: valueHash(column.name), field_hashes: fingerprints(column, columnFields),
        unreported_field_count: Object.keys(column).filter(k => !columnFields.includes(k)).length};
      if (Object.hasOwn(column, 'acl')) result.acl = describeAcl(column.acl);
      return result;
    });
  }
  return result;
}

export function buildManagedDiagnostics(expected, input) {
  // Use the same strict validator/comparator; this output never changes its decision.
  const comparison = compareCapture(expected, input);
  const capture = input?.data ?? input;
  const rows = [];
  for (const difference of comparison.differences) {
    if (!Object.hasOwn(keys, difference.group)) continue;
    const source = capture.catalog_sections[difference.group] ?? capture[difference.group];
    const row = source.find(r => JSON.stringify(keys[difference.group].map(k => r[k])) === difference.key);
    const description = row ? describeManagedRow(difference.group, row) : null;
    requireValid((description?.row_sha256 ?? null) === difference.observed_sha256);
    rows.push({group: difference.group, key_sha256: textHash(difference.key), kind: difference.kind,
      expected_sha256: difference.expected_sha256, observed_sha256: difference.observed_sha256,
      observed: description});
  }
  return {unit: 'R01_MANAGED_DIAGNOSTICS', format_version: 1,
    capture_canonical_sha256: valueHash(capture), metadata_equal: comparison.metadata_equal,
    difference_count: comparison.differences.length, diagnostic_row_count: rows.length,
    unreported_difference_count: comparison.differences.length - rows.length, rows,
    limitations: 'Diagnostic hashes and ACL tuples only; no waiver, schema equality, HTTP or R01 acceptance.'};
}
