// Catalog-derived DEV admin path versus actual disposable supabase_admin session.
// Never treats different raw catalog settings as strict metadata equality.
const fields=['unit','format_version','read_only','server_version_num','database',
  'session_role','admin_role_exists','admin_superuser','role_config_entries',
  'role_path_entries','role_path_has_user_macro','role_path_has_ordered_schemas',
  'default_role_db_overrides','admin_role_all_db_settings','expected_namespace_count',
  'admin_usable_namespace_count','shadow_namespace_count','effective_path'];
const booleans=['admin_role_exists','admin_superuser','role_path_has_user_macro',
  'role_path_has_ordered_schemas'];
const integers=['role_config_entries','role_path_entries','default_role_db_overrides',
  'admin_role_all_db_settings','expected_namespace_count','admin_usable_namespace_count',
  'shadow_namespace_count'];
const path=['public','auth','extensions'];
const hex=/^[a-f0-9]{64}$/;
function need(condition){if(!condition)throw new Error('R01_ADMIN_PATH_FORMAT_REFUSED');}
function exact(data,keys){
 need(data && typeof data==='object' && !Array.isArray(data));
 need(JSON.stringify(Object.keys(data).sort())===JSON.stringify([...keys].sort()));
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function adminPathObservation(data){
 exact(data,fields);
 need(data.unit==='R01_ADMIN_EFFECTIVE_PATH_CAPTURE' && data.format_version===1 &&
   data.read_only==='on' && data.server_version_num===170006 && data.database==='postgres');
 need(data.session_role==='postgres'||data.session_role==='supabase_admin');
 for(const key of booleans) need(typeof data[key]==='boolean');
 for(const key of integers)need(Number.isSafeInteger(data[key]) && data[key]>=0);
 need(data.effective_path===null ||
   (Array.isArray(data.effective_path) && data.effective_path.length<=20 &&
    data.effective_path.every(x=>typeof x==='string'&&x.length<=64)));
 return data;
}
export function validateAdminPathBaseline(expected,sha){
 exact(expected,['unit','format_version','query_sha256','observation']);
 need(expected.unit==='R01_ADMIN_PATH_DEV_BASELINE' && expected.format_version===1 &&
   hex.test(sha)&&expected.query_sha256===sha);
 const dev=adminPathObservation(expected.observation);
 need(dev.session_role==='postgres' && dev.effective_path===null &&
    booleans.every(k=>dev[k]) && dev.role_config_entries===2 &&
    dev.role_path_entries===1 && dev.default_role_db_overrides===0 &&
    dev.admin_role_all_db_settings===1 &&
    dev.expected_namespace_count===3 && dev.admin_usable_namespace_count===3 &&
    dev.shadow_namespace_count===0);
 return dev;
}
export function compareAdminEffectivePath(expected,data,sha){
 const dev=validateAdminPathBaseline(expected,sha);
 const observed=adminPathObservation(data);
 const diffs=[];
 for(const field of ['unit','format_version','read_only','server_version_num','database',
    ...booleans,...integers]){
   if(observed[field]!==dev[field])diffs.push(field);
 }
 if(observed.session_role!=='supabase_admin') diffs.push('session_role');
 if(!same(observed.effective_path,path)) diffs.push('effective_path');
 return {unit:'R01_ADMIN_EFFECTIVE_PATH_COMPARISON',format_version:1,query_sha256:sha,
   effective_disposable_path_verified:diffs.length===0,difference_count:diffs.length,differences:diffs,
   limitations:'DEV evidence is catalog-derived, not an actual hosted supabase_admin session. '+
     'Disposable session must be actual supabase_admin with exactly public/auth/extensions. '+
     'No raw metadata waiver, dynamic-SQL proof, Auth/HTTP, extension ACL or R01 acceptance.'};
}
