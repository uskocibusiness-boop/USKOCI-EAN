// One missing dependency prerequisite, not strict parity or R01 admission.
import {createHash} from 'node:crypto';
const roots=['unit','format_version','read_only','server_version_num','database','extension_version','capture_role',
 'helper','event','resolution','delegation','principals'];
const roles=['anon','authenticated','authenticator','service_role'];
const helperFields=['source_sha256','config_kind','invoker','event_return','plpgsql'];
const eventFields=['create_extension_only','invokes_helper'];
const resolutionFields=['catalog_first','ddl_commands_builtin','extension_builtin','roles_builtin','visible_shadow_routines'];
const principalFields=['principal','present','superuser','createrole','database_create','authority_usage_count','authority_set_count'];
const hashes={hosted:'754e58111dbe32030af4d91591dfd78cb3cf8e8f4f56a5fcc199bb0cf7f4ac2b',
 native:'55abda380efd46b37b26d3c6e4f3b514e28b7c7c1df44f5ae0315ece4052370d'};
const privilegedRoleHash=createHash('sha256').update('supabase_privileged_role').digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const bool=x=>typeof x==='boolean';
const count=x=>Number.isSafeInteger(x)&&x>=0;
const need=x=>{if(!x)throw new Error('R01_NATIVE_NET_INVOKER_FORMAT_REFUSED');};
function exact(o,fields){need(o!==null&&typeof o==='object'&&!Array.isArray(o));
 need(JSON.stringify(Object.keys(o).sort())===JSON.stringify([...fields].sort()));}
export function nativeNetInvokerObservation(data){
 exact(data,roots);
 need(data.unit==='R01_NATIVE_NET_INVOKER_CAPTURE'&&data.format_version===1&&data.read_only==='on'
  &&data.server_version_num===170006&&data.database==='postgres'
  &&['postgres','supabase_admin','OTHER'].includes(data.capture_role));
 need(data.extension_version===null||typeof data.extension_version==='string'&&/^\d+(\.\d+){1,3}$/.test(data.extension_version));
 if(data.helper!==null){exact(data.helper,helperFields);need(hex(data.helper.source_sha256)
  &&['INHERITED','EMPTY_SEARCH_PATH','OTHER'].includes(data.helper.config_kind)
  &&['invoker','event_return','plpgsql'].every(k=>bool(data.helper[k])));}
 if(data.event!==null){exact(data.event,eventFields);need(eventFields.every(k=>bool(data.event[k])||data.event[k]===null));}
 exact(data.resolution,resolutionFields);
 need(resolutionFields.slice(0,4).every(k=>bool(data.resolution[k])||data.resolution[k]===null)
   &&count(data.resolution.visible_shadow_routines));
 exact(data.delegation,['registered','role_sha256']);
 need(bool(data.delegation.registered)&&(data.delegation.role_sha256===null||hex(data.delegation.role_sha256)));
 need(Array.isArray(data.principals)&&data.principals.length===roles.length);
 for(let i=0;i<roles.length;i++){
  const p=data.principals[i];exact(p,principalFields);
  need(p.principal===roles[i]&&bool(p.present)
   &&['superuser','createrole','database_create'].every(k=>bool(p[k])||p[k]===null)
   &&count(p.authority_usage_count)&&count(p.authority_set_count));
 }
 return data;
}
// psql -qAt returns the transaction-local path acknowledgement, then one JSON row.
// Never search for a plausible JSON substring in incomplete or extra query output.
export function parseNativeNetInvokerOutput(source){
 need(typeof source==='string'&&source.length<=32768);
 const lines=source.trim().split(/\r?\n/);
 need(lines.length===2&&lines[0]==='t');
 let data;
 try{data=JSON.parse(lines[1]);}catch{need(false);}
 return nativeNetInvokerObservation(data);
}
function failures(data,side){
 const result=[];
 const add=(condition,field)=>{if(!condition)result.push(side+'.'+field);};
 add(data.capture_role===(side==='hosted'?'postgres':'supabase_admin'),'capture_role');
 add(data.extension_version==='0.20.4','extension_version');
 add(data.helper!==null&&data.helper.source_sha256===hashes[side],'helper.source');
 add(data.helper?.config_kind===(side==='hosted'?'EMPTY_SEARCH_PATH':'INHERITED'),'helper.config');
 for(const k of ['invoker','event_return','plpgsql'])add(data.helper?.[k]===true,'helper.'+k);
 for(const k of eventFields)add(data.event?.[k]===true,'event.'+k);
 for(const k of resolutionFields.slice(0,4))add(data.resolution[k]===true,'resolution.'+k);
 add(data.resolution.visible_shadow_routines===0,'resolution.visible_shadow_routines');
 add(data.delegation.registered&&data.delegation.role_sha256===privilegedRoleHash,'delegation');
 for(const p of data.principals){
  add(p.present&&p.superuser===false&&p.createrole===false&&p.database_create===false
   &&p.authority_usage_count===0&&p.authority_set_count===0,'principal.'+p.principal);
 }
 return result;
}
export function validateNativeNetInvokerBaseline(expected,querySha){
 exact(expected,['unit','format_version','query_sha256','observation']);
 need(expected.unit==='R01_NATIVE_NET_INVOKER_DEV_BASELINE'&&expected.format_version===1
  &&hex(querySha)&&expected.query_sha256===querySha);
 const hosted=nativeNetInvokerObservation(expected.observation);
 need(failures(hosted,'hosted').length===0);
 return hosted;
}
export function compareNativeNetInvoker(expected,current,querySha){
 validateNativeNetInvokerBaseline(expected,querySha);
 const native=nativeNetInvokerObservation(current);
 const differences=failures(native,'native');
 return {unit:'R01_NATIVE_NET_INVOKER_COMPARISON',format_version:1,query_sha256:querySha,
  observed_context_prerequisite_verified:differences.length===0,
  difference_count:differences.length,differences,r01_boundary_admitted:false,
  limitations:'Only paired observed helper invoker name resolution, direct request-role database/role flags and USAGE/SET routes. '+
   'No helper execution, CREATE EXTENSION attempt, arbitrary future search_path/temp state, '+
   'ADMIN OPTION-mediated grants, indirect SECURITY DEFINER/dynamic SQL reachability, full Supautils behavior, image/build history, '+
   'strict parity, Auth/PostgREST, fixture, candidate or deployment admission.'};
}
