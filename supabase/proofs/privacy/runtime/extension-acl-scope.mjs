// Read-only, bounded ACL semantics for the 49 known extension routines.
// This DOES NOT authorize changing owners/ACLs or waive strict catalog differences.
const rootFields=['unit','format_version','read_only','database','server_version_num','routines'];
const fields=['key_hash','extension','owner_md5','null_acl','full_acl_md5',
 'request_acl_md5','full_acl_count','request_acl_count','security_definer',
 'strict','volatility','parallel','leakproof','language','body_md5','binary_md5',
 'config_md5','definition_md5','anon_exec','authenticated_exec',
 'authenticator_exec','service_exec'];
const booleanFields=['null_acl','security_definer','strict','leakproof','anon_exec',
 'authenticated_exec','authenticator_exec','service_exec'];
const md5Fields=['key_hash','owner_md5','full_acl_md5','request_acl_md5',
 'body_md5','binary_md5','config_md5','definition_md5'];
const extensions={'pg_stat_statements':3,pgcrypto:36,'uuid-ossp':10};
const scopedFields=['extension','null_acl','request_acl_md5','request_acl_count',
 'security_definer','strict','volatility','parallel','leakproof','language',
 'body_md5','binary_md5','config_md5','definition_md5','anon_exec',
 'authenticated_exec','authenticator_exec','service_exec'];
const hex32=/^[a-f0-9]{32}$/,hex64=/^[a-f0-9]{64}$/;
const need=condition=>{if(!condition)throw new Error('R01_EXTENSION_ACL_FORMAT_REFUSED');};
function exact(obj,keys){
 need(obj!==null && typeof obj==='object' && !Array.isArray(obj));
 need(JSON.stringify(Object.keys(obj).sort())===JSON.stringify([...keys].sort()));
}
export function extensionAclObservation(data){
 exact(data,rootFields);
 need(data.unit==='R01_EXTENSION_ACL_SCOPE_CAPTURE'&&data.format_version===1&&
  data.read_only==='on'&&data.database==='postgres'&&data.server_version_num===170006&&
  Array.isArray(data.routines)&&data.routines.length===49);
 const counts=Object.fromEntries(Object.keys(extensions).map(n=>[n,0]));
 let last='';
 for(const row of data.routines){
  exact(row,fields);
  need(hex32.test(row.key_hash) && row.key_hash>last);last=row.key_hash;
  need(Object.hasOwn(extensions,row.extension));counts[row.extension]++;
  for(const f of booleanFields)need(typeof row[f]==='boolean');
  for(const f of md5Fields)need(row[f]===null||hex32.test(row[f]));
  need(row.key_hash!==null&&row.owner_md5!==null&&row.full_acl_md5!==null&&
   row.request_acl_md5!==null&&row.body_md5!==null&&row.definition_md5!==null);
  need(Number.isSafeInteger(row.full_acl_count)&&row.full_acl_count>=0&&
   Number.isSafeInteger(row.request_acl_count)&&row.request_acl_count>=0&&
   row.request_acl_count<=row.full_acl_count);
  need(['i','s','v'].includes(row.volatility)&&['s','r','u'].includes(row.parallel)&&
   typeof row.language==='string'&&row.language.length>0&&row.language.length<=64);
  need(row.security_definer===false); // No extension admin bypass accepted in this limited scope.
 }
 need(Object.entries(extensions).every(([name,n])=>counts[name]===n));
 return data;
}
export function validateExtensionAclBaseline(expected,sha){
 exact(expected,['unit','format_version','query_sha256','observation']);
 need(expected.unit==='R01_EXTENSION_ACL_DEV_BASELINE'&&expected.format_version===1&&
  hex64.test(sha)&&expected.query_sha256===sha);
 return extensionAclObservation(expected.observation);
}
export function compareExtensionAclScope(expected,observed,sha){
 const dev=validateExtensionAclBaseline(expected,sha);
 const current=extensionAclObservation(observed);
 const baseline=new Map(dev.routines.map(row=>[row.key_hash,row]));
 const changed=[];const metadataDelta=[];
 for(const row of current.routines){
  const prior=baseline.get(row.key_hash);need(prior!==undefined);
  const differing=scopedFields.filter(f=>row[f]!==prior[f]);
  if(differing.length)changed.push({key_hash:row.key_hash,fields:differing});
  const other=['owner_md5','full_acl_md5','full_acl_count'].filter(f=>row[f]!==prior[f]);
  if(other.length)metadataDelta.push({key_hash:row.key_hash,fields:other});
 }
 // Full ACL count changes may indicate an added/removed administrative or caller grant;
 // do not certify caller scope without an explicit review of those extra tuples.
 const countChange=metadataDelta.some(d=>d.fields.includes('full_acl_count'));
 return {unit:'R01_EXTENSION_ACL_SCOPE_COMPARISON',format_version:1,query_sha256:sha,
  caller_scope_verified:changed.length===0&&!countChange,
  caller_mismatch_count:changed.length,caller_mismatches:changed,
  full_acl_count_drift:countChange,
  owner_acl_metadata_equal:metadataDelta.length===0,
  owner_acl_metadata_delta_count:metadataDelta.length,
  owner_acl_metadata_differences:metadataDelta,
  limitations:'Only exactly 49 pinned extension routines, request-role EXECUTE and direct '+
   'grantor-independent tuples plus function code/settings. All owner and full ACL '+
   'differences remain strict catalog mismatches. No admission/waiver for grantor '+
   'authority, extension administration, dynamic SQL, Storage, Auth or PostgREST.'};
}
