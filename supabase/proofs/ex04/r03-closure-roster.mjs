// Snapshot shape guard only; never changes a certificate, grants or acceptance state.
const root=['unit','format_version','read_only','database','server_version_num',
 'digester_source_pinned','retention_source_pinned','roster_count','roster_unique',
 'resolved_count','definer_count','schema_relation_count','roster_md5',
 'source_digest','source_certificate','source_ready','schema_digest',
 'erasure_program_digest','source_roster'];
const rowKeys=['signature','body_md5','config_md5','acl_md5','owner_md5','security_definer'];
const md5=/^[a-f0-9]{32}$/,sha=/^[a-f0-9]{64}$/;
const signature=/^(public|private)\.[a-z_][a-z0-9_]*\([a-z0-9_,.\[\] ]*\)$/;
const deny=()=>{throw new Error('R10_CLOSURE_ROSTER_CAPTURE_REFUSED');};
function need(cond){if(!cond)deny();}
function exact(obj,fields){
 need(obj!==null&&typeof obj==='object'&&!Array.isArray(obj));
 need(JSON.stringify(Object.keys(obj).sort())===JSON.stringify([...fields].sort()));
}
export function validateClosureRosterCapture(raw){
 exact(raw,root);
 need(raw.unit==='R10_R12_CLOSURE_ROSTER_READONLY'&&raw.format_version===1&&
    raw.read_only==='on'&&raw.database==='postgres'&&raw.server_version_num===170006);
 need(raw.digester_source_pinned===true&&raw.retention_source_pinned===true&&
    raw.roster_count===148&&raw.roster_unique===true&&raw.resolved_count===148&&
    Number.isSafeInteger(raw.definer_count)&&raw.definer_count>=0&&raw.definer_count<=148&&
    Number.isSafeInteger(raw.schema_relation_count)&&raw.schema_relation_count>0&&
    md5.test(raw.roster_md5));
 for(const key of ['source_digest','source_certificate','schema_digest','erasure_program_digest'])
   need(sha.test(raw[key]));
 need(typeof raw.source_ready==='boolean'&&Array.isArray(raw.source_roster)&&
   raw.source_roster.length===148);
 let last='';
 for(const row of raw.source_roster){
   exact(row,rowKeys);
   need(signature.test(row.signature)&&row.signature>last&&md5.test(row.body_md5)&&
     md5.test(row.owner_md5)&&typeof row.security_definer==='boolean');
   last=row.signature;
   for(const key of ['config_md5','acl_md5'])need(row[key]===null||md5.test(row[key]));
 }
 return raw;
}
export function summarizeClosureRoster(raw){
 const v=validateClosureRosterCapture(raw);
 const mismatch=v.source_digest!==v.source_certificate;
 // Catalog status is deliberately narrower than readiness: never certify
 // erasure/retention policy, external Auth/Storage adapters, or R03 rollout.
 const blockers=[
   ...(!v.source_ready?['RETENTION_SOURCE_NOT_READY']:[]),
   ...(mismatch?['SOURCE_CERTIFICATE_DIFFERENT']:[])
 ];
 return {unit:'R10_R12_CLOSURE_ROSTER_DIAGNOSTIC',format_version:1,
   catalog_capture_valid:true,source_functions_checked:148,
   relations_observed:v.schema_relation_count,
   source_ready_observed:v.source_ready,source_certificate_equal:!mismatch,
   blockers,external_authorization_admitted:false,
   result:blockers.length?'BLOCKED_NOT_ADMITTED':'CATALOG_ONLY_NEEDS_EXTERNAL_PROOF',
   limitations:'Current DEV metadata and source hashes only. No scope freeze, legal retention '+
     'policy, full 168-relation copy/erasure audit, external Storage/Auth execution, '+
     'source recertification, R01 HTTP or R03 deployment.'};
}
