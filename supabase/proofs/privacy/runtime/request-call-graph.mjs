// Bounded lexical cross-catalog request-path diagnostic only; NOT an R01 admission.
const rootKeys=['unit','format_version','read_only','database','server_version_num',
  'root_count','matched_roots','max_depth','frontier_unvisited','dynamic_count',
  'role_change_count','extension_ddl_count','nodes','edges','policies'];
const nodeKeys=['key','root','kind','body_md5','binary_md5','config_md5','owner_md5',
  'acl_md5','security_definer','language','anon_execute','authenticated_execute','service_execute'];
const edgeKeys=['source','target'];
const policyKeys=['name','command','permissive','using_md5','check_md5','role_md5'];
const hex=/^[a-f0-9]{32}$/,sha64=/^[a-f0-9]{64}$/;
function need(value) { if(!value) throw new Error('R01_REQUEST_PATH_FORMAT_REFUSED'); }
function exact(data,keys) { need(data!==null&&typeof data==='object'&&!Array.isArray(data));
 need(JSON.stringify(Object.keys(data).sort())===JSON.stringify([...keys].sort())); }
const safeHash=v=>v===null||(typeof v==='string'&&hex.test(v));
const bool=v=>typeof v==='boolean';
const canonical=o=>Array.isArray(o)?'['+o.map(canonical).join(',')+']':
 o&&typeof o==='object'?'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}':
 JSON.stringify(o);
const equal=(a,b)=>canonical(a)===canonical(b);
export function requestPathObservation(data) {
 exact(data,rootKeys);
 need(data.unit==='R01_REQUEST_PATH_CATALOG_CAPTURE'&&data.format_version===1&&
  data.read_only==='on'&&data.database==='postgres'&&data.server_version_num===170006&&
  data.root_count===11&&data.matched_roots===11&&
  Number.isInteger(data.max_depth)&&data.max_depth>=0&&data.max_depth<=8&&
  data.frontier_unvisited===0&&data.dynamic_count===0&&
  data.role_change_count===0&&data.extension_ddl_count===0);
 need(Array.isArray(data.nodes)&&data.nodes.length>=11&&data.nodes.length<=256);
 let previous='';const identities=new Set();let roots=0;
 for(const node of data.nodes) {
  exact(node,nodeKeys);
  need(hex.test(node.key)&&node.key>previous); previous=node.key;identities.add(node.key);
  need(bool(node.root)&&bool(node.security_definer)&&
   ['EXTENSION','APP_OR_PLATFORM'].includes(node.kind)&&
   ['anon_execute','authenticated_execute','service_execute'].every(k=>bool(node[k]))&&
   ['body_md5','binary_md5','config_md5','owner_md5','acl_md5'].every(k=>safeHash(node[k]))&&
   node.body_md5!==null&&node.owner_md5!==null&&
   typeof node.language==='string'&&node.language.length>0&&node.language.length<=32);
  if(node.root) roots++;
 }
 need(roots===11);
 need(Array.isArray(data.edges)&&data.edges.length<=2500);
 previous='';
 for(const edge of data.edges) {
  exact(edge,edgeKeys);
  need(hex.test(edge.source)&&hex.test(edge.target)&&identities.has(edge.source)&&identities.has(edge.target));
  const key=edge.source+'|'+edge.target;need(key>previous);previous=key;
 }
 need(Array.isArray(data.policies)&&data.policies.length===6);
 previous='';
 for(const policy of data.policies) {
  exact(policy,policyKeys);
  need(typeof policy.name==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(policy.name)&&
   policy.name>previous&&typeof policy.command==='string'&&policy.command.length===1&&
   bool(policy.permissive)&&['using_md5','check_md5','role_md5'].every(k=>safeHash(policy[k]))&&
   policy.role_md5!==null);
  previous=policy.name;
 }
 return data;
}
export function validateRequestPathBaseline(expected,querySha) {
 exact(expected,['unit','format_version','query_sha256','observation']);
 need(expected.unit==='R01_REQUEST_PATH_DEV_BASELINE'&&expected.format_version===1&&
  sha64.test(querySha)&&expected.query_sha256===querySha);
 return requestPathObservation(expected.observation);
}
export function compareRequestPath(expected,current,querySha) {
 const dev=validateRequestPathBaseline(expected,querySha);
 const local=requestPathObservation(current);
 const sourceDrift=[], administrativeDrift=[];
 const devNodes=new Map(dev.nodes.map(n=>[n.key,n]));
 const localNodes=new Map(local.nodes.map(n=>[n.key,n]));
 for(const id of new Set([...devNodes.keys(),...localNodes.keys()])) {
  const a=devNodes.get(id),b=localNodes.get(id);
  if(!a||!b) {sourceDrift.push({key:id,fields:['identity']});continue;}
  const fields=nodeKeys.filter(k=>k!=='key'&&a[k]!==b[k]);
  const sensitive=fields.filter(k=>!['owner_md5','acl_md5'].includes(k)||
    (k==='owner_md5'&&(a.security_definer||b.security_definer)));
  const admin=fields.filter(k=>['owner_md5','acl_md5'].includes(k));
  if(sensitive.length)sourceDrift.push({key:id,fields:sensitive});
  if(admin.length)administrativeDrift.push({key:id,fields:admin});
 }
 if(!equal(dev.edges,local.edges))sourceDrift.push({key:'graph',fields:['edges']});
 if(!equal(dev.policies,local.policies))sourceDrift.push({key:'needs_policies',fields:['policies']});
 if(dev.max_depth!==local.max_depth)sourceDrift.push({key:'graph',fields:['max_depth']});
 const metadata_equal=sourceDrift.length===0&&administrativeDrift.length===0;
 return {unit:'R01_REQUEST_PATH_CATALOG_COMPARISON',format_version:1,query_sha256:querySha,
  qualified_source_equal:sourceDrift.length===0,
  raw_metadata_equal:metadata_equal,
  source_difference_count:sourceDrift.length,source_differences:sourceDrift,
  administrative_difference_count:administrativeDrift.length,
  administrative_differences:administrativeDrift,
  nodes_checked:local.nodes.length,edges_checked:local.edges.length,
  policy_count:local.policies.length,frontier_unvisited:local.frontier_unvisited,
  limitations:'Lexically recognized qualified calls to depth 8 only; overloads, unqualified calls, '+
    'comments, runtime dispatch and dynamic SQL not proven absent. Privileged function owners '+
    'and ACL drift remain strict schema differences. No limited admission, Auth/HTTP, fixture, '+
    'candidate migration, Storage lifecycle or deployment acceptance.'};
}
