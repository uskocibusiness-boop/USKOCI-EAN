// Diagnostic only: changes across local prerequisites are never a parity waiver.
const names = ['pg_stat_statements', 'pgcrypto', 'uuid-ossp'];
const hex = /^[a-f0-9]{32}$/;
const digest = value => typeof value === 'string' && hex.test(value);
const delegationFields = ['privileged_role_md5', 'privileged_extensions_superuser_md5',
  'postgres_superuser', 'postgres_privileged_usage', 'extension_allowlist'];
function need(condition) {
  if (!condition) throw new Error('R01_EXTENSION_PROVENANCE_FORMAT_REFUSED');
}
function exact(value, fields) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value));
  need(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort()));
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function extensionProvenanceObservation(data) {
  exact(data, ['unit', 'format_version', 'read_only', 'server_version_num', 'database',
    'capture_role', 'delegation', 'extensions']);
  need(data.unit === 'R01_EXTENSION_PROVENANCE_CAPTURE' && data.format_version === 1 &&
    data.read_only === 'on' && data.server_version_num === 170006 &&
    data.database === 'postgres' && data.capture_role === 'supabase_admin');
  exact(data.delegation, delegationFields);
  for (const field of delegationFields.slice(0, 2)) {
    need(data.delegation[field] === null || digest(data.delegation[field]));
  }
  for (const field of ['postgres_superuser', 'postgres_privileged_usage']) {
    need(data.delegation[field] === null || typeof data.delegation[field] === 'boolean');
  }
  need(Array.isArray(data.delegation.extension_allowlist) && data.delegation.extension_allowlist.length === names.length);
  need(Array.isArray(data.extensions) && data.extensions.length === names.length);
  const identities = new Set();
  for (let index = 0; index < names.length; index++) {
    const setting = data.delegation.extension_allowlist[index];
    exact(setting, ['name', 'listed']);
    need(setting.name === names[index] && (setting.listed === null || typeof setting.listed === 'boolean'));
    const extension = data.extensions[index];
    exact(extension, ['name', 'present', 'owner_md5', 'routines']);
    need(extension.name === names[index] && typeof extension.present === 'boolean');
    need(extension.present ? digest(extension.owner_md5) : extension.owner_md5 === null);
    need(Array.isArray(extension.routines) && extension.routines.length <= 1000);
    need(extension.present || extension.routines.length === 0);
    let previous = '';
    for (const routine of extension.routines) {
      exact(routine, ['key_hash', 'owner_md5', 'acl_null', 'acl_md5']);
      need(digest(routine.key_hash) && routine.key_hash > previous && !identities.has(routine.key_hash) &&
        digest(routine.owner_md5) && digest(routine.acl_md5) && typeof routine.acl_null === 'boolean');
      previous = routine.key_hash;
      identities.add(routine.key_hash);
    }
  }
  return data;
}
export function compareExtensionProvenance(before, after, queryHash) {
  extensionProvenanceObservation(before);
  extensionProvenanceObservation(after);
  need(typeof queryHash === 'string' && /^[a-f0-9]{64}$/.test(queryHash));
  const extensions = before.extensions.map((original, index) => {
    const current = after.extensions[index];
    const oldRows = new Map(original.routines.map(row => [row.key_hash, row]));
    const newRows = new Map(current.routines.map(row => [row.key_hash, row]));
    return {name: original.name, before_present: original.present, after_present: current.present,
      extension_owner_changed: original.present && current.present && original.owner_md5 !== current.owner_md5,
      routines_before: oldRows.size, routines_after: newRows.size,
      added_routines: [...newRows.keys()].filter(key => !oldRows.has(key)),
      removed_routines: [...oldRows.keys()].filter(key => !newRows.has(key)),
      owner_changed_routines: [...newRows.keys()].filter(key => oldRows.has(key) &&
        oldRows.get(key).owner_md5 !== newRows.get(key).owner_md5),
      acl_changed_routines: [...newRows.keys()].filter(key => oldRows.has(key) &&
        (oldRows.get(key).acl_null !== newRows.get(key).acl_null || oldRows.get(key).acl_md5 !== newRows.get(key).acl_md5))};
  });
  return {unit: 'R01_EXTENSION_PROVENANCE_DIAGNOSTIC', format_version: 1, query_sha256: queryHash,
    local_prerequisite_delta_observed: canonical(before) !== canonical(after),
    changed_delegation_fields: delegationFields.filter(field =>
      canonical(before.delegation[field]) !== canonical(after.delegation[field])),
    extensions,
    limitations: 'Read-only snapshots immediately before and after existing local prerequisites. ' +
      'A delta locates a change within this interval, not its mechanism or hosted provisioning history. ' +
      'No delta does not establish DEV parity. Never waives strict metadata, ACL, managed-hook or other admission gates.'};
}
