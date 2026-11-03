// Offline derivation of one current reader correction. Never connects or deploys.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
export const preimage=JSON.parse(read('preimage.json'));
export const signature='public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)';
export const original=preimage.functions.find(f=>f.signature===signature);
const candidate=readFileSync(new URL('../../../candidates/r03_owner_page_existing_helper.sql',root),'utf8');
const hash=(s,kind='sha256')=>createHash(kind).update(s).digest('hex');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
export const pageBody=candidate.split('page_body CONSTANT text := $r03_body$')[1]?.split('$r03_body$;')[0];
assert.equal(hash(pageBody,'md5'),'509d6c345c84cc6a597bde46d9ae6b75');
export const postimage={...original,definition:original.definition.replace(/AS \$function\$[\s\S]*\$function\$/,()=>`AS $function$${pageBody}$function$`),
 body_md5:hash(pageBody,'md5'),body_lf_md5:hash(pageBody,'md5')};
postimage.definition_md5=hash(postimage.definition,'md5');
const ddl=f=>f.definition.trimEnd()+';\n';
export const closureQuery=`SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())`;
const closureGuard=`IF (${closureQuery}) IS DISTINCT FROM ${quote(JSON.stringify(preimage.closure))}::jsonb
 THEN RAISE EXCEPTION 'R03_DEV_CLOSURE_STATE_CHANGED'; END IF;`;
const contextGuard=intent=>`IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 ${intent?"OR current_setting('uskoci.r03.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'":''}
 THEN RAISE EXCEPTION 'R03_DEV_CONTEXT_REFUSED'; END IF;`;
const functionGuard=functions=>functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure(${quote(f.signature)}) AND p.oid=${f.oid}
 AND md5(pg_get_functiondef(p.oid))=${quote(f.definition_md5)}
 AND to_jsonb(p)-'prosrc'-'oid'=${quote(JSON.stringify(f.attributes))}::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%',${quote(f.signature)}; END IF;`).join('\n');
const guard=(name,page,intent=false)=>`DO $${name}$ BEGIN\n${contextGuard(intent)}\n${functionGuard(preimage.functions.map(f=>f===original?page:f))}\n${closureGuard}\nEND; $${name}$;\n`;
const catalogBefore=`CREATE TEMP TABLE r03_reader_prior_functions ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','rls_private');\n`;
const catalogAfter=`DO $delta$ BEGIN
 IF EXISTS(SELECT 1 FROM r03_reader_prior_functions before FULL JOIN
 (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private','rls_private')) after USING(oid)
 WHERE before.oid IS NULL OR after.oid IS NULL OR
 CASE WHEN before.oid=${original.oid} THEN before.attributes-'prosrc' IS DISTINCT FROM after.attributes-'prosrc'
 ELSE before.attributes IS DISTINCT FROM after.attributes END)
 THEN RAISE EXCEPTION 'R03_DEV_UNRELATED_FUNCTION_DELTA'; END IF;
 END; $delta$;\n`;
// Real hosted acceptance is intentionally no-row. Positive owned/foreign values
// and actual client mapping are tested in package.test.mjs before promotion.
export const acceptance=`-- No business/Auth fixture writes, no existing account, provider or push call.
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $auth$ BEGIN
 BEGIN PERFORM public.rpc_list_my_needs_page('ALL',30,NULL,NULL);
  RAISE EXCEPTION 'R03_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '28000' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE; END IF; END;
END; $auth$;
RESET ROLE;
-- Execute the exact new page query/count result against real relation shapes,
-- using SQL NULL ownership so no user/business row can qualify.
DO $empty$ DECLARE v_uid uuid:=NULL;v_items jsonb;p_scope text:='ALL';p_limit integer:=30;
 p_before_at timestamptz:=NULL;p_before_id uuid:=NULL;v_result jsonb;
BEGIN
${pageBody.slice(pageBody.indexOf('  with page as materialized ('),pageBody.indexOf('  return jsonb_build_object('))}
 SELECT jsonb_build_object('items',v_items,'hasMore',false,'counts',private.own_task_counts(v_uid),'asOf',statement_timestamp()) INTO v_result;
 IF v_result->'items'<>'[]'::jsonb OR v_result->'counts'<>'{"total":0,"active":0,"drafts":0,"history":0,"waiting":0}'::jsonb
 THEN RAISE EXCEPTION 'R03_EMPTY_PAGE_INVALID'; END IF;
END; $empty$;\n`;
export function wrap(sql){return `BEGIN;\nSET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';SET LOCAL lock_timeout='3s';
SET LOCAL uskoci.r03.dev_target='leqcwgzvjsxugfgzdmth';\n${sql}\nCOMMIT;\n`;}
export const acceptanceReadOnly="BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n"+
 acceptance+"\nSELECT 'R03_ACTUAL_PG_EMPTY_PROJECTION_PASS' result,false authenticated_positive_functional_acceptance,statement_timestamp() checked_at;ROLLBACK;";
export function generate(){
 assert.equal(preimage.project_ref,'leqcwgzvjsxugfgzdmth');assert.equal(preimage.read_only,'on');
 assert.equal(preimage.server_version_num,170006);assert.equal(preimage.capture_role,'postgres');
 assert.equal(preimage.functions.length,14);
 for(const f of preimage.functions){assert.ok(f.oid);assert.equal(hash(f.definition,'md5'),f.definition_md5);}
 for(const name of ['private.closure_source_digest_v5()','private.closure_erasure_program_digest_v5()'])
  assert(!preimage.functions.find(f=>f.signature===name).definition.includes('rpc_list_my_needs_page'),
   'reader is not a source/erasure roster member; any changed roster requires new review');
 const forward=guard('r03_pre',original,true)+catalogBefore+ddl(postimage)+acceptance+
  catalogAfter+guard('r03_post',postimage,true)+"NOTIFY pgrst,'reload schema';\n";
 const rollback=guard('r03_revert_pre',postimage,true)+catalogBefore+ddl(original)+catalogAfter+
  guard('r03_revert_post',original,true)+"NOTIFY pgrst,'reload schema';\n";
 const flight=(page,result)=>`BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n${guard('r03_flight',page)}
 SELECT '${result}' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;\n`;
 const outputs={'forward.sql':forward,'promotion.sql':wrap(forward),'rollback.sql':wrap(rollback),
  'preflight.sql':flight(original,'R03_DEV_PREIMAGE_MATCH'),'postflight.sql':flight(postimage,'R03_DEV_POSTIMAGE_MATCH'),
  'acceptance.sql':acceptance,'acceptance-readonly.sql':acceptanceReadOnly,'postimage.json':JSON.stringify(postimage,null,2)+'\n'};
 outputs['manifest.json']=JSON.stringify({unit:'R03_DEV_OWNER_PAGE_PACKAGE',status:'PREPARED_NOT_APPLIED',project_ref:preimage.project_ref,
  captured_at:preimage.captured_at,changed_functions:[signature],new_functions:0,new_tables:0,acl_changes:0,
  source_candidate:'supabase/candidates/r03_owner_page_existing_helper.sql',source_candidate_sha256:hash(candidate),
  frozen_page_body_md5:postimage.body_md5,preimage_sha256:hash(read('preimage.json')),
  files:Object.fromEntries(Object.entries(outputs).map(([name,s])=>[name,hash(s)])),
  limitations:['Project identity is the connector binding; the GUC is only an intent marker.',
   'Original LOCAL_ONLY candidate and its broader ready=true rollout gate are untouched.',
   'This reviewed reader-only DEV operation requires the complete captured closure state unchanged, including false/null values; it never recertifies or enables retention/export/closure.',
   'Only existing reader body changes. Exact all-function delta guard, ACL/config/owner preservation and code-only inverse rollback are required.',
   'Hosted acceptance has AUTH_REQUIRED and a NULL-owner zero-row projection only. Positive current-client acceptance is isolated SQL plus VM, followed by actual signed-in Android after root review/apply.',
   'No full R01, real Auth/PostgREST, old native/OTA fleet, R10 or release admission is claimed.']},null,2)+'\n';
 return outputs;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outputs=generate();
 if(process.argv[2]==='--write')for(const[name,s]of Object.entries(outputs))writeFileSync(new URL(name,root),s);
 else if(process.argv[2]==='--check'){for(const[name,s]of Object.entries(outputs))assert.equal(read(name),s,name);console.log('R03 exact package generation PASS');}
 else throw Error('Use --write or --check. This program never deploys.');
}
