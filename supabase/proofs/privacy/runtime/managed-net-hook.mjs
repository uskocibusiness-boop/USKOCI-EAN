// Exact read-only DEV contract. No object changes and no schema exception.
const rootFields = ['unit', 'format_version', 'webhook_schema_absent', 'net_get_invoker',
  'net_post_invoker', 'helper', 'event'];
const booleanFields = ['webhook_schema_absent', 'net_get_invoker', 'net_post_invoker'];
const objectFields = {
  helper: ['owner_md5', 'security_definer', 'config_md5', 'acl_md5', 'body_md5', 'definition_md5'],
  event: ['owner_md5', 'event_md5', 'enabled_md5', 'tags_md5', 'function_md5'],
};
const hex = /^[a-f0-9]{32}$/;
function need(condition) { if (!condition) throw new Error('MANAGED_NET_HOOK_FORMAT_REFUSED'); }
function exact(object, keys) {
  need(object !== null && typeof object === 'object' && !Array.isArray(object));
  need(JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...keys].sort()));
}

// Validates a public-safe projection before publishing; absent objects remain
// explicit null observations and are rejected by comparison after all captures.
export function managedNetHookObservation(data) {
  exact(data, rootFields);
  need(data.unit === 'R01_MANAGED_NET_HOOK_CAPTURE' && data.format_version === 1);
  const observed = {unit: data.unit, format_version: data.format_version};
  for (const field of booleanFields) {
    need(typeof data[field] === 'boolean' || data[field] === null);
    observed[field] = data[field];
  }
  for (const [group, fields] of Object.entries(objectFields)) {
    if (data[group] === null) { observed[group] = null; continue; }
    exact(data[group], fields);
    observed[group] = {};
    for (const field of fields) {
      const value = data[group][field];
      if (field === 'security_definer') need(typeof value === 'boolean');
      else need(value === null || (typeof value === 'string' && hex.test(value)));
      observed[group][field] = value;
    }
  }
  return observed;
}

export function validateManagedNetHookBaseline(expected, querySha) {
  exact(expected, ['unit', 'format_version', 'query_sha256', 'observed']);
  need(expected.unit === 'R01_MANAGED_NET_HOOK_BASELINE' && expected.format_version === 1 &&
    /^[a-f0-9]{64}$/.test(querySha) && expected.query_sha256 === querySha);
  const baseline = managedNetHookObservation(expected.observed);
  need(booleanFields.every(field => baseline[field] === true) && baseline.helper !== null &&
    baseline.event !== null && baseline.helper.security_definer === false);
  return baseline;
}

export function compareManagedNetHook(expected, data, querySha) {
  const baseline = validateManagedNetHookBaseline(expected, querySha);
  const observed = managedNetHookObservation(data);
  const differences = [];
  for (const field of booleanFields) {
    if (baseline[field] !== observed[field]) differences.push(field);
  }
  for (const [group, fields] of Object.entries(objectFields)) {
    if (observed[group] === null) differences.push(group);
    else for (const field of fields) {
      if (baseline[group][field] !== observed[group][field]) differences.push(`${group}.${field}`);
    }
  }
  return {unit: 'R01_MANAGED_NET_HOOK_COMPARISON', format_version: 1, query_sha256: querySha,
    equal: differences.length === 0, difference_count: differences.length, differences,
    expected: baseline, observed,
    limitations: 'Exact managed hook metadata only; strict catalog parity remains mandatory. No fixture, Auth/HTTP or candidate acceptance.'};
}
