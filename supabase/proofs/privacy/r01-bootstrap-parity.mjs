// Strict metadata admission, not an Auth/PostgREST or application acceptance test.
// The output contains object identities and hashes, never function/default text.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const sectionKeys = {
  application_relations: ['schema', 'name'],
  managed_relation_contract: ['schema', 'name'],
  constraints: ['schema', 'relation', 'name'],
  indexes: ['schema', 'relation', 'name'],
  policies: ['schema', 'relation', 'name'],
  triggers: ['schema', 'relation', 'name'],
  function_inventory: ['schema', 'name', 'identity_arguments'],
  schemas: ['name'],
  memberships: ['role', 'member', 'grantor'],
  default_acl: ['owner', 'schema', 'kind'],
  safe_role_settings: ['database', 'role', 'setting'],
};
const extraKeys = {
  roles: ['name'], extensions: ['name'], sequences: ['schema', 'name'],
  event_triggers: ['name'], needs_column_select: ['role', 'column'],
};
const unsupportedKeys = ['aggregate_or_window_functions', 'casts', 'collations',
  'custom_types', 'inheritance', 'nonordinary_application_relations', 'operators', 'rewrite_rules'];
const requiredKeys = ['auth_identities', 'auth_users', 'authenticator', 'closure_pre_request', 'needs'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
function requireCondition(condition, label) {
  if (!condition) throw new Error(`Invalid R01 metadata: ${label}`);
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  requireCondition(value !== undefined && (typeof value !== 'number' ||
    (Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)))), 'unsafe/non-JSON numeric value');
  return JSON.stringify(value);
}
function exactKeys(object, expected, label) {
  requireCondition(isObject(object) && canonical(Object.keys(object).sort()) === canonical([...expected].sort()), label);
}
function identity(row, fields) {
  requireCondition(isObject(row), 'object row');
  for (const field of fields) requireCondition(Object.hasOwn(row, field) &&
    (row[field] === null || typeof row[field] === 'string'), `identity field ${field}`);
  return JSON.stringify(fields.map(field => row[field]));
}
function fingerprintRows(rows, keys, label) {
  requireCondition(Array.isArray(rows), `missing array ${label}`);
  const seen = new Set();
  return rows.map(row => {
    const key = identity(row, keys);
    requireCondition(!seen.has(key), `duplicate identity in ${label}`);
    seen.add(key);
    return {key, sha256: hash(row), fields: Object.fromEntries(Object.keys(row).sort().map(k => [k, hash(row[k])]))};
  }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

export function buildManifest(input) {
  const data = input?.data ?? input;
  requireCondition(isObject(data), 'object capture');
  requireCondition(data.unit === 'R01_BOOTSTRAP_METADATA_ONLY' && data.format_version === 3, 'capture format 3 required');
  requireCondition(data.transaction_read_only === 'on', 'read-only capture required');
  requireCondition(Number.isInteger(data.server_version_num) && Math.floor(data.server_version_num / 10000) === 17, 'PostgreSQL 17 required');
  requireCondition(data.normalization?.search_path === 'pg_catalog', 'pinned pg_catalog search path required');
  exactKeys(data.required_objects, requiredKeys, 'required-object inventory');
  requireCondition(Object.values(data.required_objects).every(v => v === true), 'required object missing');
  exactKeys(data.unsupported_shapes, unsupportedKeys, 'unsupported-shape inventory');
  requireCondition(Object.values(data.unsupported_shapes).every(v => Array.isArray(v) && v.length === 0), 'unsupported object shape present');
  exactKeys(data.catalog_sections, Object.keys(sectionKeys), 'catalog sections');
  exactKeys(data.normalized_sections, Object.keys(sectionKeys), 'section digests');
  const groups = {};
  for (const [name, keys] of Object.entries(sectionKeys)) {
    const rows = data.catalog_sections[name];
    groups[name] = fingerprintRows(rows, keys, name);
    const digest = data.normalized_sections[name];
    requireCondition(isObject(digest) && digest.row_count === rows.length && /^[a-f0-9]{32}$/.test(digest.md5), `section count/digest ${name}`);
  }
  for (const [name, keys] of Object.entries(extraKeys)) groups[name] = fingerprintRows(data[name], keys, name);
  for (const sequence of data.sequences) {
    for (const field of ['start', 'increment', 'min', 'max', 'cache']) {
      const value = sequence[field];
      requireCondition(typeof value === 'string' && /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(value) &&
        BigInt(value) >= -(2n ** 63n) && BigInt(value) < 2n ** 63n, `sequence bigint string ${field}`);
    }
  }
  // Duplicated convenience fields must agree with the complete catalog. A partial
  // or accidentally concatenated capture cannot manufacture a passing manifest.
  for (const name of ['function_inventory', 'schemas', 'memberships', 'default_acl', 'safe_role_settings']) {
    requireCondition(canonical(data[name]) === canonical(data.catalog_sections[name]), `inconsistent ${name}`);
  }
  for (const [duplicate, section] of [['managed_auth_relations', 'managed_relation_contract'],
    ['managed_auth_constraints', 'constraints'], ['managed_auth_triggers', 'triggers']]) {
    requireCondition(Array.isArray(data[duplicate]) && canonical(data[duplicate]) ===
      canonical(data.catalog_sections[section].filter(row => row.schema === 'auth')), `inconsistent ${duplicate}`);
  }
  const needs = data.catalog_sections.application_relations.find(r => r.schema === 'public' && r.name === 'needs');
  requireCondition(needs && canonical(needs) === canonical(data.needs_relation), 'Need relation missing or inconsistent');
  const needPolicies = data.catalog_sections.policies.filter(r => r.schema === 'public' && r.relation === 'needs');
  requireCondition(canonical(needPolicies) === canonical(data.needs_policies), 'Need policies inconsistent');
  requireCondition(Array.isArray(data.function_definitions), 'function definitions missing');
  const definitions = new Map();
  for (const row of data.function_definitions) {
    const key = identity(row, sectionKeys.function_inventory);
    requireCondition(!definitions.has(key) && typeof row.definition === 'string', 'duplicate/invalid function definition');
    definitions.set(key, row.definition);
  }
  requireCondition(definitions.size === data.function_inventory.length, 'function definition count');
  for (const row of data.function_inventory) {
    const definition = definitions.get(identity(row, sectionKeys.function_inventory));
    requireCondition(typeof definition === 'string' && createHash('md5').update(definition).digest('hex') === row.pinned_definition_md5,
      'function definition/hash mismatch');
  }
  return {
    unit: 'R01_BOOTSTRAP_FINGERPRINTS', format_version: 1,
    server_version_num: data.server_version_num,
    groups,
    limitations: 'Metadata equality only. No Auth, PostgREST, data, reference fixtures, closure readiness, native or deployment acceptance.',
  };
}

function validateManifest(manifest) {
  requireCondition(isObject(manifest) && manifest.unit === 'R01_BOOTSTRAP_FINGERPRINTS' && manifest.format_version === 1, 'fingerprint format');
  requireCondition(Number.isInteger(manifest.server_version_num) && Math.floor(manifest.server_version_num / 10000) === 17, 'fingerprint PostgreSQL version');
  exactKeys(manifest.groups, [...Object.keys(sectionKeys), ...Object.keys(extraKeys)], 'fingerprint groups');
  for (const [name, rows] of Object.entries(manifest.groups)) {
    requireCondition(Array.isArray(rows), `fingerprint array ${name}`);
    const keys = new Set();
    for (const row of rows) {
      requireCondition(isObject(row) && typeof row.key === 'string' && !keys.has(row.key), `fingerprint identity ${name}`);
      requireCondition(/^[a-f0-9]{64}$/.test(row.sha256) && isObject(row.fields) &&
        Object.values(row.fields).every(v => /^[a-f0-9]{64}$/.test(v)), `fingerprint hashes ${name}`);
      keys.add(row.key);
    }
  }
}

export function compareCapture(expected, capture) {
  validateManifest(expected);
  const observed = buildManifest(capture);
  const differences = [];
  if (expected.server_version_num !== observed.server_version_num) {
    differences.push({group: 'runtime', key: 'server_version_num', kind: 'changed', expected: expected.server_version_num, observed: observed.server_version_num});
  }
  for (const [name, rows] of Object.entries(expected.groups)) {
    const before = new Map(rows.map(row => [row.key, row]));
    const after = new Map(observed.groups[name].map(row => [row.key, row]));
    for (const key of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      const a = before.get(key), b = after.get(key);
      if (a?.sha256 === b?.sha256) continue;
      const fields = [...new Set([...Object.keys(a?.fields ?? {}), ...Object.keys(b?.fields ?? {})])].sort()
        .filter(field => a?.fields[field] !== b?.fields[field]);
      differences.push({group: name, key, kind: !a ? 'added' : !b ? 'missing' : 'changed',
        expected_sha256: a?.sha256 ?? null, observed_sha256: b?.sha256 ?? null, fields});
    }
  }
  return {unit: 'R01_BOOTSTRAP_METADATA_COMPARISON', metadata_equal: differences.length === 0,
    compared_groups: Object.keys(expected.groups).length, differences,
    limitations: observed.limitations};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, expectedPath, capturePath] = process.argv.slice(2);
    const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    let result;
    if (command === 'manifest' && expectedPath && !capturePath) result = buildManifest(read(expectedPath));
    else if (command === 'compare' && expectedPath && capturePath) result = compareCapture(read(expectedPath), read(capturePath));
    else throw new Error('Usage: r01-bootstrap-parity.mjs manifest CAPTURE.json | compare EXPECTED.json CAPTURE.json');
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.metadata_equal === false) process.exitCode = 1;
  } catch (error) {
    // Never echo raw malformed input or source definitions in a public CI log.
    process.stderr.write(`${error instanceof SyntaxError ? 'Invalid JSON input' : error.message}\n`);
    process.exitCode = 2;
  }
}
