// Bounded Storage ACL owner grant-option evidence; never waives strict catalog drift.
const roles=['anon','authenticated','authenticator','postgres','service_role','supabase_admin',
 'supabase_auth_admin','supabase_functions_admin','supabase_realtime_admin','supabase_storage_admin'];
const privileges=['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
const root=['unit','format_version','read_only','database','server_version_num',
 'owner_md5','acl_null','acl','effective'];
const entryFields=['grantee_md5','grantor_md5','privilege','grantable','owner_entry'];
const effectFields=['role','privilege','allowed','grantable','owner'];
const md5=/^[a-f0-9]{32}$/,sha=/^[a-f0-9]{64}$/;
function need(cond){if(!cond)throw new Error('R01_STORAGE_ACL_FORMAT_REFUSED');}
function exact(obj,fields){
 need(obj!==null&&typeof obj==='object'&&!Array.isArray(obj));
 need(JSON.stringify(Object.keys(obj).sort())===JSON.stringify([...fields].sort()));
}
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort()
 .map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function same(a,b){return canonical(a)===canonical(b);}
export function storageAclObservation(data){
 exact(data,root);
 need(data.unit==='R01_STORAGE_OWNER_ACL_CAPTURE'&&data.format_version===1&&
  data.read_only==='on'&&data.database==='postgres'&&data.server_version_num===170006&&
  md5.test(data.owner_md5)&&data.acl_null===false&&
  Array.isArray(data.acl)&&data.acl.length===32&&
  Array.isArray(data.effective)&&data.effective.length===80);
 let last='';let ownerEntries=0;
 for(const item of data.acl){
  exact(item,entryFields);
  need(md5.test(item.grantee_md5)&&md5.test(item.grantor_md5)&&
   privileges.includes(item.privilege)&&typeof item.grantable==='boolean'&&
   typeof item.owner_entry==='boolean');
  const key=[item.grantee_md5,item.grantor_md5,item.privilege].join('|');
  need(key>last);last=key;ownerEntries+=item.owner_entry?1:0;
 }
 need(ownerEntries===8);
 for(let i=0;i<data.effective.length;i++){
  const e=data.effective[i];exact(e,effectFields);
  need(e.role===roles[Math.floor(i/8)]&&e.privilege===privileges[i%8]&&
   typeof e.allowed==='boolean'&&typeof e.grantable==='boolean'&&typeof e.owner==='boolean');
 }
 return data;
}
export function validateStorageAclBaseline(expected,querySha){
 exact(expected,['unit','format_version','query_sha256','observation']);
 need(expected.unit==='R01_STORAGE_ACL_DEV_BASELINE'&&expected.format_version===1&&
  sha.test(querySha)&&expected.query_sha256===querySha);
 const dev=storageAclObservation(expected.observation);
 need(dev.acl.filter(x=>x.owner_entry&&x.grantable).length===8);
 need(dev.effective.filter(x=>x.role==='supabase_storage_admin').every(x=>x.owner&&x.grantable));
 return dev;
}
export function compareStorageOwnerAcl(expected,current,querySha){
 const dev=validateStorageAclBaseline(expected,querySha);
 const now=storageAclObservation(current);
 const errors=[];const ownerDelta=[];
 if(dev.owner_md5!==now.owner_md5)errors.push('owner_md5');
 for(let i=0;i<32;i++){
  const a=dev.acl[i],b=now.acl[i];
  for(const f of ['grantee_md5','grantor_md5','privilege','owner_entry']){
   if(a[f]!==b[f])errors.push('acl.'+i+'.'+f);
  }
  if(a.grantable!==b.grantable){
   if(a.owner_entry&&a.grantable===true&&b.grantable===false)ownerDelta.push(i);
   else errors.push('acl.'+i+'.grantable');
  }
 }
 if(!same(dev.effective,now.effective))errors.push('effective');
 if(ownerDelta.length!==8)errors.push('owner_grant_delta_count');
 return {unit:'R01_STORAGE_OWNER_ACL_COMPARISON',format_version:1,
  query_sha256:querySha,owner_grant_representation_verified:errors.length===0,
  eight_owner_grant_bits_differ:ownerDelta.length===8,changed_owner_entries:ownerDelta.length,
  effective_privileges_equal:same(dev.effective,now.effective),
  difference_count:errors.length,differences:errors,
  limitations:'Exactly 32 Storage table ACL tuples and 80 effective privilege checks; '
   +'only the eight owner explicit grant-option bits can differ. Strict metadata '
   +'still fails; no Storage file lifecycle, export/erasure, Auth/HTTP or blanket waiver.'};
}
