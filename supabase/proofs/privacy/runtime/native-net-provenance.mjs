// Narrow, fail-closed proof of the pinned native pg_net hook's provenance.
// NOT a catalog parity waiver, a search_path equivalence proof, or Auth admission.
const schema = {
  root: ['unit','format_version','read_only','search_path','server_version_num',
    'database','extension_version','helper','event','dependencies','legacy_branches'],
  helper: ['source_sha256','normalized_sha256','native_literal_count',
    'hosted_literal_count','config_kind','invoker'],
  event: ['create_extension_only','invokes_helper'],
  dependencies: ['total','only_event'],
  legacy_branches: ['native_active','hosted_active'],
};
const hex = /^[a-f0-9]{64}$/;
const pinned = Object.freeze({
  hosted: '754e58111dbe32030af4d91591dfd78cb3cf8e8f4f56a5fcc199bb0cf7f4ac2b',
  normalized: '55abda380efd46b37b26d3c6e4f3b514e28b7c7c1df44f5ae0315ece4052370d',
});
const refuse = () => { throw new Error('R01_NATIVE_PROVENANCE_FORMAT_REFUSED'); };
const need = condition => { if (!condition) refuse(); };
const exact = (object, fields) => {
  need(object !== null && typeof object === 'object' && !Array.isArray(object));
  need(JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...fields].sort()));
};

export function nativeNetObservation(data) {
  exact(data, schema.root);
  need(data.unit === 'R01_NATIVE_NET_PROVENANCE_CAPTURE' && data.format_version === 1 &&
    data.read_only === 'on' && data.search_path === 'pg_catalog' &&
    data.database === 'postgres' && data.server_version_num === 170006 &&
    data.extension_version === '0.20.4');
  exact(data.helper, schema.helper);
  exact(data.event, schema.event);
  exact(data.dependencies, schema.dependencies);
  exact(data.legacy_branches, schema.legacy_branches);
  need(hex.test(data.helper.source_sha256) && hex.test(data.helper.normalized_sha256));
  need(['EMPTY_SEARCH_PATH','INHERITED','OTHER'].includes(data.helper.config_kind) &&
    Number.isInteger(data.helper.native_literal_count) && data.helper.native_literal_count >= 0 &&
    Number.isInteger(data.helper.hosted_literal_count) && data.helper.hosted_literal_count >= 0 &&
    typeof data.helper.invoker === 'boolean');
  need(schema.event.every(key => typeof data.event[key] === 'boolean'));
  need(Number.isInteger(data.dependencies.total) && data.dependencies.total >= 0 &&
    typeof data.dependencies.only_event === 'boolean');
  need(schema.legacy_branches.every(key => typeof data.legacy_branches[key] === 'boolean'));
  return data;
}

export function validateNativeNetBaseline(expected, querySha) {
  exact(expected, ['unit','format_version','query_sha256','observation']);
  need(expected.unit === 'R01_NATIVE_NET_PROVENANCE_DEV_BASELINE' &&
    expected.format_version === 1 && hex.test(querySha) && expected.query_sha256 === querySha);
  const dev = nativeNetObservation(expected.observation);
  need(dev.helper.source_sha256 === pinned.hosted &&
    dev.helper.normalized_sha256 === pinned.normalized &&
    dev.helper.config_kind === 'EMPTY_SEARCH_PATH' &&
    dev.helper.native_literal_count === 0 && dev.helper.hosted_literal_count === 1 &&
    dev.helper.source_sha256 !== dev.helper.normalized_sha256 &&
    dev.helper.invoker && dev.event.create_extension_only && dev.event.invokes_helper &&
    dev.dependencies.total === 1 && dev.dependencies.only_event &&
    !dev.legacy_branches.native_active && !dev.legacy_branches.hosted_active);
  return dev;
}

export function compareNativeNetProvenance(expected, raw, querySha) {
  const dev = validateNativeNetBaseline(expected, querySha);
  const observed = nativeNetObservation(raw);
  const differences = [];
  for (const name of ['read_only','search_path','server_version_num','database','extension_version']) {
    if (observed[name] !== dev[name]) differences.push(name);
  }
  for (const group of ['event','dependencies','legacy_branches']) {
    for (const field of schema[group]) {
      if (observed[group][field] !== dev[group][field]) differences.push(group + '.' + field);
    }
  }
  const helper = observed.helper;
  if (helper.normalized_sha256 !== dev.helper.normalized_sha256) differences.push('helper.normalized_sha256');
  if (helper.source_sha256 !== dev.helper.normalized_sha256) differences.push('helper.source_sha256');
  if (helper.native_literal_count !== 1) differences.push('helper.native_literal_count');
  if (helper.hosted_literal_count !== 0) differences.push('helper.hosted_literal_count');
  if (helper.config_kind !== 'INHERITED') differences.push('helper.config_kind');
  if (helper.invoker !== dev.helper.invoker) differences.push('helper.invoker');
  return {
    unit: 'R01_NATIVE_NET_PROVENANCE_COMPARISON', format_version: 1,
    query_sha256: querySha, provenance_verified: differences.length === 0,
    difference_count: differences.length, differences,
    limitations: 'Only pinned native source and event-dependency provenance for pg_net 0.20.4; '
      + 'inherited search_path equivalence, hosted-role dependencies, owner/ACL, '
      + 'strict catalog parity, fixture, Auth, HTTP, candidate and live access remain unproven.'
  };
}
