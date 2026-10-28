// Exact hashed per-routine ACL tuple diagnostic; NEVER accepts a schema waiver.
import {createHash} from 'node:crypto';
const systemRoles=['PUBLIC','dashboard_user','postgres','supabase_admin','anon','authenticated',
 'authenticator','service_role','supabase_auth_admin','supabase_storage_admin',
 'supabase_functions_admin','supabase_realtime_admin'];
const namesByHash=new Map(systemRoles.map(name=>[createHash('md5').update(name).digest('hex'),name]));
const names={pgcrypto:36,'uuid-ossp':10,pg_stat_statements:3};
const roles=['anon','authenticated','authenticator','postgres','service_role','supabase_admin',
 'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin','supabase_storage_admin'];
const root=['unit','format_version','read_only','server_version_num','database',
 'dashboard_role','dashboard_reachability','routines'];
const routineFields=['key_hash','extension','owner_md5','acl_null','acl'];
const aclFields=['grantee_md5','grantor_md5','privilege','grantable','owner_entry','dashboard_entry'];
const roleFields=['login','superuser','createrole','bypassrls','inherit'];
const hex=/^[a-f0-9]{32}$/,sha=/^[a-f0-9]{64}$/;
function need(x){if(!x)throw new Error('R01_EXTENSION_ACL_TUPLES_FORMAT_REFUSED');}
function exact(o,fields){need(o!==null&&typeof o==='object'&&!Array.isArray(o));
 need(JSON.stringify(Object.keys(o).sort())===JSON.stringify([...fields].sort()));}
function truthyBits(o,fields){exact(o,fields);need(fields.every(f=>typeof o[f]==='boolean'));}
function tupleKey(a){return [a.grantee_md5,a.grantor_md5,a.privilege].join('|');}
function canonical(o){if(Array.isArray(o))return '['+o.map(canonical).join(',')+']';
 if(o&&typeof o==='object')return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
 return JSON.stringify(o);}
export function extensionAclTupleObservation(data){
 exact(data,root);
 need(data.unit==='R01_EXTENSION_ACL_TUPLES_CAPTURE' && data.format_version===1 &&
   data.read_only==='on' && data.database==='postgres'&&data.server_version_num===170006);
 if(data.dashboard_role!==null)truthyBits(data.dashboard_role,roleFields);
 need(Array.isArray(data.dashboard_reachability) && data.dashboard_reachability.length===roles.length);
 for(let i=0;i<roles.length;i++){
  const row=data.dashboard_reachability[i];truthyBits({usage:row?.usage,set:row?.set},['usage','set']);
  exact(row,['principal','usage','set']);need(row.principal===roles[i]);
  if(data.dashboard_role===null)need(!row.usage&&!row.set);
 }
 need(Array.isArray(data.routines)&&data.routines.length===49);
 const counts=Object.fromEntries(Object.keys(names).map(x=>[x,0]));
 let last='';
 for(const r of data.routines){
  exact(r,routineFields);
  need(hex.test(r.key_hash)&&r.key_hash>last && hex.test(r.owner_md5) && r.acl_null===false);
  last=r.key_hash; need(Object.hasOwn(names,r.extension));counts[r.extension]++;
  need(Array.isArray(r.acl)&&r.acl.length<=20 && r.acl.length>=1);
  let previous='';
  for(const a of r.acl){
   exact(a,aclFields);
   need(hex.test(a.grantee_md5)&&hex.test(a.grantor_md5)&&
     a.privilege==='EXECUTE'&&['grantable','owner_entry','dashboard_entry'].every(f=>typeof a[f]==='boolean'));
   const key=tupleKey(a);need(key>previous);previous=key;
   if(data.dashboard_role===null)need(a.dashboard_entry===false);
  }
 }
 need(Object.entries(names).every(([name,n])=>counts[name]===n));
 return data;
}
export function validateExtensionAclTupleBaseline(expected,queryHash){
 exact(expected,['unit','format_version','query_sha256','observation']);
 need(expected.unit==='R01_EXTENSION_ACL_TUPLES_DEV_BASELINE'&&expected.format_version===1&&
   sha.test(queryHash)&&expected.query_sha256===queryHash);
 const dev=extensionAclTupleObservation(expected.observation);
 need(dev.dashboard_role!==null&&dev.dashboard_role.login===false&&
   dev.dashboard_role.superuser===false&&dev.dashboard_role.bypassrls===false&&
   dev.dashboard_role.createrole===true&&dev.dashboard_role.inherit===true);
 need(dev.dashboard_reachability.filter(x=>x.usage||x.set).length===1 &&
   dev.dashboard_reachability.find(x=>x.principal==='supabase_admin')?.set===true);
 need(dev.routines.every(r=>r.acl.filter(a=>a.dashboard_entry).length===1));
 return dev;
}
const multiset=(items)=>{const m=new Map();for(const item of items){const k=canonical(item);m.set(k,(m.get(k)||0)+1);}return m;};
function subtract(a,b){const aMap=multiset(a),bMap=multiset(b),diff=[];
 for(const [key,n] of aMap){const delta=n-(bMap.get(key)||0);for(let i=0;i<delta;i++)diff.push(JSON.parse(key));}
 return diff;
}
export function compareExtensionAclTuples(expected,capture,queryHash,scope){
 const dev=validateExtensionAclTupleBaseline(expected,queryHash);
 const native=extensionAclTupleObservation(capture);
 // Scope comparison must consume the exact same current capture and agree on 49 identities.
 need(scope?.unit==='R01_EXTENSION_ACL_SCOPE_COMPARISON' &&
   scope.caller_mismatch_count===0 && scope.full_acl_count_drift===true &&
   scope.owner_acl_metadata_delta_count===49);
 const byDev=new Map(dev.routines.map(r=>[r.key_hash,r]));
 const metadata=[];const summary={dev_only:0,native_only:0,dev_dashboard_only:0,native_dashboard_only:0,
   owner_changed:0,owner_tuple_changes:0,grantor_only_cases:0,grant_option_variants:0};
 const ext={pgcrypto:{dev_only:0,native_only:0},'uuid-ossp':{dev_only:0,native_only:0},pg_stat_statements:{dev_only:0,native_only:0}};
 for(const row of native.routines){
  const before=byDev.get(row.key_hash);need(before!==undefined && before.extension===row.extension);
  const devOnly=subtract(before.acl,row.acl),nativeOnly=subtract(row.acl,before.acl);
  const ownerChanged=before.owner_md5!==row.owner_md5;
  if(ownerChanged)summary.owner_changed++;
  summary.dev_only+=devOnly.length;summary.native_only+=nativeOnly.length;
  ext[row.extension].dev_only+=devOnly.length;ext[row.extension].native_only+=nativeOnly.length;
  summary.dev_dashboard_only+=devOnly.filter(x=>x.dashboard_entry).length;
  summary.native_dashboard_only+=nativeOnly.filter(x=>x.dashboard_entry).length;
  summary.owner_tuple_changes+=devOnly.filter(x=>x.owner_entry).length+nativeOnly.filter(x=>x.owner_entry).length;
  // Detect grantor-only differences by comparing grantor-independent ACL bags.
  const compact=a=>({grantee_md5:a.grantee_md5,privilege:a.privilege,grantable:a.grantable});
  if(canonical(multiset(before.acl.map(compact)).size)===canonical(multiset(row.acl.map(compact)).size)&&
   subtract(before.acl.map(compact),row.acl.map(compact)).length===0 &&
   subtract(row.acl.map(compact),before.acl.map(compact)).length===0 &&
   (devOnly.length||nativeOnly.length))summary.grantor_only_cases++;
  const noOption=a=>({grantee_md5:a.grantee_md5,grantor_md5:a.grantor_md5,privilege:a.privilege});
  if(subtract(before.acl.map(noOption),row.acl.map(noOption)).length===0&&
   subtract(row.acl.map(noOption),before.acl.map(noOption)).length===0 &&
   (devOnly.length||nativeOnly.length))summary.grant_option_variants++;
  if(ownerChanged||devOnly.length||nativeOnly.length){
   metadata.push({key_hash:row.key_hash,extension:row.extension,owner_changed:ownerChanged,
    dev_only:devOnly.length,native_only:nativeOnly.length,
    dev_dashboard_only:devOnly.filter(x=>x.dashboard_entry).length,
    native_dashboard_only:nativeOnly.filter(x=>x.dashboard_entry).length,
    // No raw names, grantors or function bodies in public CI receipts.
    dev_owner_option_only:devOnly.filter(x=>x.owner_entry).length,
    native_owner_option_only:nativeOnly.filter(x=>x.owner_entry).length});
  }
 }
 function roleSummary(capture){
  const byExt=Object.fromEntries(Object.keys(names).map(ext=>[ext,{
    grantees:{},grantors:{},owner_entries:{},grantable_entries:0,unclassified_entries:0
  }]));
  const add=(obj,key)=>{obj[key]=(obj[key]||0)+1;};
  for(const row of capture.routines){
    const group=byExt[row.extension];
    for(const acl of row.acl){
      const grantee=namesByHash.get(acl.grantee_md5)||'UNCLASSIFIED';
      const grantor=namesByHash.get(acl.grantor_md5)||'UNCLASSIFIED';
      add(group.grantees,grantee);
      add(group.grantors,grantor);
      if(acl.owner_entry)add(group.owner_entries,grantee);
      if(acl.grantable)group.grantable_entries++;
      if(grantee==='UNCLASSIFIED'||grantor==='UNCLASSIFIED')group.unclassified_entries++;
    }
  }
  return byExt;
 }
 const role_grants={dev:roleSummary(dev),disposable:roleSummary(native)};
 const exactEqual=metadata.length===0&&canonical(dev.dashboard_role)===canonical(native.dashboard_role);
 return {unit:'R01_EXTENSION_ACL_TUPLES_DIAGNOSTIC',format_version:1,query_sha256:queryHash,
   exact_acl_equal:exactEqual,request_scope_match:true,
   dashboard_role_present_on_dev:dev.dashboard_role!==null,
   dashboard_role_present_on_disposable:native.dashboard_role!==null,
   admin_reachability_changed:canonical(dev.dashboard_reachability)!==canonical(native.dashboard_reachability),
   counts:summary,by_extension:ext,role_grants,changed_routines:metadata.length,per_routine:metadata,
   limitations:'Hashed full grantor/grantee/privilege/grant-option diagnostics only. '+
     'Does not waive any owner, grantor, dashboard or strict metadata difference. '+
     'Dynamic SQL, admin rights, Auth/PostgREST, Storage lifecycle and candidate remain unproven.'};
}
