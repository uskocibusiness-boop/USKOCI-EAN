// Narrow read-only hosted CLI login dependency proof; not an R01 boundary waiver.
const principals = ['anon','authenticated','authenticator','postgres','service_role',
  'supabase_admin','supabase_auth_admin','supabase_functions_admin',
  'supabase_realtime_admin','supabase_storage_admin'];
const roleFields = ['superuser','createrole','createdb','replication','bypassrls','login','inherit'];
const rootFields = ['unit','format_version','read_only','server_version_num','database',
  'principals','hosted_role','membership','reachability','shared_dependency_count',
  'role_settings_count','routine_literal_mentions'];
const hex = /^[a-f0-9]{64}$/;
function need(condition) {if (!condition) throw new Error('R01_HOSTED_LOGIN_FORMAT_REFUSED');}
function exact(record, fields) {
  need(record && typeof record === 'object' && !Array.isArray(record));
  need(JSON.stringify(Object.keys(record).sort()) === JSON.stringify([...fields].sort()));
}
function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort()
    .map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
function same(a,b) {return canonical(a)===canonical(b);}
function exactBooleanMap(record, fields) {
  exact(record,fields);
  need(fields.every(field=>typeof record[field] === 'boolean'));
}
export function hostedLoginObservation(capture) {
  exact(capture,rootFields);
  need(capture.unit === 'R01_HOSTED_LOGIN_DEPENDENCY_CAPTURE' && capture.format_version === 1 &&
    capture.read_only === 'on' && capture.database === 'postgres' &&
    capture.server_version_num === 170006 && same(capture.principals,principals));
  if (capture.hosted_role !== null) exactBooleanMap(capture.hosted_role,roleFields);
  need(Array.isArray(capture.membership) && capture.membership.length<=10);
  for (const row of capture.membership) {
    exact(row,['role','member','admin','inherit','set']);
    need(typeof row.role === 'string' && typeof row.member === 'string' &&
      row.role.length > 0 && row.member.length > 0 &&
      ['admin','inherit','set'].every(field=>typeof row[field] === 'boolean'));
  }
  need(Array.isArray(capture.reachability) && capture.reachability.length === principals.length);
  for (let i=0;i<principals.length;i++) {
    const row=capture.reachability[i];
    exact(row,['principal','usage','set']);
    need(row.principal === principals[i] && typeof row.usage === 'boolean' &&
      typeof row.set === 'boolean');
  }
  for (const field of ['shared_dependency_count','role_settings_count','routine_literal_mentions']) {
    need(Number.isSafeInteger(capture[field]) && capture[field]>=0);
  }
  return capture;
}
function devRole() {
  return {superuser:false,createrole:false,createdb:false,replication:false,
    bypassrls:false,login:true,inherit:false};
}
const expectedMembership=[{role:'postgres',member:'cli_login_postgres',admin:false,inherit:false,set:true}];
function reachability(hosted) {
  return principals.map(principal=>({principal,usage:hosted && principal==='supabase_admin',
    set:hosted && principal==='supabase_admin'}));
}
export function validateHostedLoginBaseline(expected, querySha) {
  exact(expected,['unit','format_version','query_sha256','observation']);
  need(expected.unit === 'R01_HOSTED_LOGIN_DEV_BASELINE' && expected.format_version === 1 &&
    hex.test(querySha) && expected.query_sha256===querySha);
  const dev=hostedLoginObservation(expected.observation);
  need(same(dev.hosted_role,devRole()) && same(dev.membership,expectedMembership) &&
    same(dev.reachability,reachability(true)) &&
    dev.shared_dependency_count===0 && dev.role_settings_count===0 &&
    dev.routine_literal_mentions===0);
  return dev;
}
export function compareHostedLoginDependency(expected, capture, querySha) {
  const dev=validateHostedLoginBaseline(expected,querySha);
  const observed=hostedLoginObservation(capture);
  const differences=[];
  for (const key of ['unit','format_version','read_only','server_version_num','database','principals']) {
    if (!same(observed[key],dev[key])) differences.push(key);
  }
  if (observed.hosted_role !== null) differences.push('hosted_role');
  if (!same(observed.membership,[])) differences.push('membership');
  if (!same(observed.reachability,reachability(false))) differences.push('reachability');
  for (const key of ['shared_dependency_count','role_settings_count','routine_literal_mentions']) {
    if (observed[key] !== 0) differences.push(key);
  }
  return {unit:'R01_HOSTED_LOGIN_DEPENDENCY_COMPARISON',format_version:1,
    query_sha256:querySha,provenance_verified:differences.length===0,
    difference_count:differences.length,differences,
    limitations:'Only hosted CLI login absence and request-principal reachability; '+
      'DEV supabase_admin is privileged and may SET the hosted role. '+
      'A zero literal scan or pg_shdepend count does not rule out dynamic SQL. '+
      'No effective admin search_path, extensions ACL, RLS, Auth/HTTP, candidate, or strict parity waiver.'};
}
