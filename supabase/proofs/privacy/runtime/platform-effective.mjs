// Supplemental evidence only: never grants a strict-schema exception.
import {canonical} from '../r01-bootstrap-parity.mjs';
import {valueHash} from './managed-diagnostics.mjs';

const schema = {
  storage_access: {key: 2, booleans: ['allowed','grantable','is_owner'], strings: []},
  role_reachability: {key: 2, booleans: ['usage','set_role'], strings: []},
  schema_access: {key: 2, booleans: ['usage','create'], strings: []},
  extension_routines: {key: 4, booleans: ['security_definer','strict','leakproof',
    'anon_execute','authenticated_execute','service_execute','postgres_execute'],
  strings: ['owner','language','volatility','parallel','definition_md5','body_md5',
    'binary_md5','config_md5','acl_md5']},
  namespace_presence: {key: 1, booleans: ['present'], strings: []},
};
const principals = ['anon','authenticated','authenticator','postgres','service_role',
  'supabase_admin','supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin','supabase_storage_admin'];
const targets = principals.filter(x => x !== 'authenticator').concat('supabase_privileged_role').sort();
const hex = /^[a-f0-9]{64}$/;
function need(condition) { if (!condition) throw new Error('PLATFORM_EFFECTIVE_REFUSED'); }
function exact(object, keys) {
  need(object !== null && typeof object === 'object' && !Array.isArray(object));
  need(canonical(Object.keys(object).sort()) === canonical([...keys].sort()));
}

export function effectiveManifest(data, querySha) {
  exact(data, ['unit','format_version','captured_at','read_only','server_version_num',
    'search_path','database','principals','targets','groups']);
  need(data.unit === 'R01_PLATFORM_EFFECTIVE_CAPTURE' && data.format_version === 1 &&
    data.read_only === 'on' && data.server_version_num === 170006 &&
    data.search_path === 'pg_catalog' && data.database === 'postgres' &&
    typeof data.captured_at === 'string' && Number.isFinite(Date.parse(data.captured_at)) && hex.test(querySha));
  need(canonical(data.principals) === canonical(principals) && canonical(data.targets) === canonical(targets));
  exact(data.groups, Object.keys(schema));
  const groups = {};
  for (const [group, contract] of Object.entries(schema)) {
    const rows = data.groups[group];
    need(Array.isArray(rows) && rows.length > 0 && rows.length <= 5000);
    const seen = new Set();
    groups[group] = rows.map(row => {
      exact(row, ['key', ...contract.booleans, ...contract.strings]);
      need(Array.isArray(row.key) && row.key.length === contract.key &&
        row.key.every(x => typeof x === 'string' && x.length <= 2048));
      const key = valueHash(row.key);
      need(!seen.has(key)); seen.add(key);
      for (const field of contract.booleans) need(typeof row[field] === 'boolean');
      for (const field of contract.strings) {
        need(typeof row[field] === 'string' || row[field] === null);
        if (field.endsWith('_md5')) need(row[field] === null || /^[a-f0-9]{32}$/.test(row[field]));
        else need(typeof row[field] === 'string' && row[field].length > 0 && row[field].length <= 1024);
      }
      return {key_sha256: key, row_sha256: valueHash(row),
        fields: Object.fromEntries([...contract.booleans,...contract.strings].sort().map(field => [field,valueHash(row[field])])),
        booleans: Object.fromEntries(contract.booleans.map(field => [field,row[field]]))};
    }).sort((a,b) => a.key_sha256.localeCompare(b.key_sha256, 'en'));
  }
  return {unit:'R01_PLATFORM_EFFECTIVE_FINGERPRINTS', format_version:1, query_sha256:querySha,
    capture_sha256:valueHash(data), groups};
}

function validateManifest(manifest) {
  exact(manifest,['unit','format_version','query_sha256','capture_sha256','groups']);
  need(manifest.unit === 'R01_PLATFORM_EFFECTIVE_FINGERPRINTS' && manifest.format_version === 1 &&
    hex.test(manifest.query_sha256) && hex.test(manifest.capture_sha256));
  exact(manifest.groups,Object.keys(schema));
  for (const [group,contract] of Object.entries(schema)) {
    const rows = manifest.groups[group]; const seen = new Set();
    need(Array.isArray(rows) && rows.length > 0 && rows.length <= 5000);
    for (const row of rows) {
      exact(row,['key_sha256','row_sha256','fields','booleans']);
      need(hex.test(row.key_sha256) && hex.test(row.row_sha256) && !seen.has(row.key_sha256));
      seen.add(row.key_sha256);
      exact(row.fields,[...contract.booleans,...contract.strings]);
      exact(row.booleans,contract.booleans);
      need(Object.values(row.fields).every(x => typeof x === 'string' && hex.test(x)));
      for (const field of contract.booleans) need(typeof row.booleans[field] === 'boolean' &&
        valueHash(row.booleans[field]) === row.fields[field]);
    }
  }
}

export function compareEffective(expected, data, querySha) {
  validateManifest(expected);
  need(expected.query_sha256 === querySha);
  const observed = effectiveManifest(data, querySha);
  const differences = [];
  for (const group of Object.keys(schema)) {
    const a = new Map(expected.groups[group].map(row => [row.key_sha256,row]));
    const b = new Map(observed.groups[group].map(row => [row.key_sha256,row]));
    for (const key of [...new Set([...a.keys(),...b.keys()])].sort()) {
      const first=a.get(key), second=b.get(key);
      if (first?.row_sha256 === second?.row_sha256 && canonical(first.fields) === canonical(second.fields)) continue;
      const fields=[...new Set([...Object.keys(first?.fields??{}),...Object.keys(second?.fields??{})])]
        .filter(field => first?.fields[field] !== second?.fields[field]).sort();
      differences.push({group,key_sha256:key,kind:!first?'added':!second?'missing':'changed',
        expected_sha256:first?.row_sha256??null,observed_sha256:second?.row_sha256??null,fields,
        expected_fields:first?.fields??null,observed_fields:second?.fields??null,
        expected_booleans:first?.booleans??null,observed_booleans:second?.booleans??null});
    }
  }
  return {unit:'R01_PLATFORM_EFFECTIVE_COMPARISON',format_version:1,query_sha256:querySha,
    expected_capture_sha256:expected.capture_sha256,observed_capture_sha256:observed.capture_sha256,
    equal:differences.length===0,difference_count:differences.length,differences,
    limitations:'Read-only effective privileges and four extension routine inventories only. No schema waiver, fixture, Auth/HTTP or candidate acceptance.'};
}
