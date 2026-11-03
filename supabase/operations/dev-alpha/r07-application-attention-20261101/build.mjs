// Offline, exact-body correction of application attention. Never connects or deploys.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=new URL('./',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
export const preimage=JSON.parse(read('preimage.json'));
export const signatures={rows:'private.own_application_rows(uuid)',whole:'public.rpc_list_my_applications()',
 page:'public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)'};
export const originals=Object.fromEntries(Object.entries(signatures).map(([key,name])=>[key,preimage.functions.find(f=>f.signature===name)]));
const hash=(s,kind='sha256')=>createHash(kind).update(s).digest('hex');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const once=(text,from,to)=>{assert.equal(text.split(from).length,2,'Expected one exact source fragment: '+from);return text.replace(from,()=>to);};
// Selection is an immutable application fact. Attention is a separate live
// witness from the exact latest Agreement used by the existing projection.
// Parent Need completion cannot settle another worker's bilateral Agreement.
const selectedAction=id=>`exists (select 1 from public.agreements a
          left join public.agreement_execution ae on ae.agreement_id = a.id
          where a.id = ${id} and a.status in ('CONFIRMED','SUPERSEDED')
            and coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER'))`;
const attention=(state,id)=>`(${state} = 'STALE_REVIEW_REQUIRED'
        or (${state} = 'SELECTED' and ${selectedAction(id)}))`;
function replaceBody(original,change){
 const body=original.definition.split('AS $function$')[1]?.split('$function$')[0];assert.ok(body);
 const next=change(body);assert.notEqual(next,body);
 const definition=once(original.definition,body,next);
 return {...original,definition,definition_md5:hash(definition,'md5'),body_md5:hash(next,'md5'),body_lf_md5:hash(next.replaceAll('\r\n','\n'),'md5')};
}
export const postimages={
 rows:replaceBody(originals.rows,body=>once(body,
  "case when st.state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0",
  `case when ${attention('st.state','ag.id')} then 0`)),
 whole:replaceBody(originals.whole,body=>{
  body=once(body,'  ), mapped as (','  ), state_rows as (');
  body=once(body,'    from own_rows o\n  )',`    from own_rows o
  ), mapped as (
    select st.*, ${attention('st.application_state','st.agreement_id')} as attention_required
    from state_rows st
  )`);
  body=once(body,"'attentionRequired', m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED')","'attentionRequired', m.attention_required");
  return once(body,"when m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0","when m.attention_required then 0");
 }),
 page:replaceBody(originals.page,body=>once(body,
  "'attentionRequired', p.application_state in ('STALE_REVIEW_REQUIRED','SELECTED')",
  "'attentionRequired', p.application_rank = 0")),
};
export const closureQuery=`SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())`;
const closureGuard=`IF (${closureQuery}) IS DISTINCT FROM ${quote(JSON.stringify(preimage.closure))}::jsonb
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CLOSURE_STATE_CHANGED'; END IF;`;
const contextGuard=intent=>`IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 ${intent?"OR current_setting('uskoci.r07.attention_dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'":''}
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CONTEXT_REFUSED'; END IF;`;
const functionGuard=functions=>functions.map(f=>`IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure(${quote(f.signature)}) AND p.oid=${f.oid}
 AND md5(pg_get_functiondef(p.oid))=${quote(f.definition_md5)}
 AND to_jsonb(p)-'prosrc'-'oid'=${quote(JSON.stringify(f.attributes))}::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%',${quote(f.signature)}; END IF;`).join('\n');
const guard=(name,images,intent=false)=>`DO $${name}$ BEGIN\n${contextGuard(intent)}\n${functionGuard(preimage.functions.map(f=>Object.values(images).find(x=>x.signature===f.signature)??f))}\n${closureGuard}\nEND; $${name}$;\n`;
const ddl=images=>Object.values(images).map(f=>f.definition.trimEnd()+';\n').join('');
export const catalogBefore=`CREATE TEMP TABLE r07_attention_prior_functions ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','rls_private');\n`;
export const catalogAfter=`DO $delta$ BEGIN
 IF EXISTS(SELECT 1 FROM r07_attention_prior_functions before FULL JOIN
 (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private','rls_private')) after USING(oid)
 WHERE before.oid IS NULL OR after.oid IS NULL OR
 CASE WHEN before.oid IN (${Object.values(originals).map(f=>f.oid).join(',')}) THEN before.attributes-'prosrc' IS DISTINCT FROM after.attributes-'prosrc'
 ELSE before.attributes IS DISTINCT FROM after.attributes END)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_UNRELATED_FUNCTION_DELTA'; END IF;
 END; $delta$;\n`;
// Hosted acceptance is deliberately no-user/no-row. It executes the exact new
// query bodies against actual relation shapes without forging an Auth subject.
const bodyOf=f=>f.definition.split('AS $function$')[1].split('$function$')[0];
export const acceptance=`-- No existing account, business/Auth fixture, provider or push call.
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $auth$ BEGIN
 BEGIN PERFORM public.rpc_list_my_applications();RAISE EXCEPTION 'R07_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE;END IF;END;
 BEGIN PERFORM public.rpc_list_my_applications_page('ALL',30,NULL,NULL,NULL);RAISE EXCEPTION 'R07_EXPECTED_AUTH_REQUIRED';
 EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE;END IF;END;
END;$auth$;
RESET ROLE;
DO $empty$ DECLARE v_actor uuid:=NULL;v_result jsonb;v_items jsonb;v_counts jsonb;v_scope_rank integer:=NULL;
 p_before_at timestamptz:=NULL;p_before_id uuid:=NULL;p_before_rank integer:=NULL;p_limit integer:=30;
BEGIN
${bodyOf(postimages.whole).slice(bodyOf(postimages.whole).indexOf('  with own_rows as ('),bodyOf(postimages.whole).indexOf('  return v_result;'))}
 IF v_result<>'[]'::jsonb THEN RAISE EXCEPTION 'R07_EMPTY_WHOLE_INVALID';END IF;
${bodyOf(postimages.page).slice(bodyOf(postimages.page).indexOf('  with own as materialized ('),bodyOf(postimages.page).indexOf('  return jsonb_build_object('))}
 IF v_items<>'[]'::jsonb OR v_counts<>'{"total":0,"attention":0,"active":0,"finished":0}'::jsonb
 THEN RAISE EXCEPTION 'R07_EMPTY_PAGE_INVALID';END IF;
END;$empty$;\n`;
export function wrap(sql){return `BEGIN;\nSET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';SET LOCAL lock_timeout='3s';
SET LOCAL uskoci.r07.attention_dev_target='leqcwgzvjsxugfgzdmth';\n${sql}\nCOMMIT;\n`;}
export function generate(){
 assert.equal(preimage.project_ref,'leqcwgzvjsxugfgzdmth');assert.equal(preimage.read_only,'on');
 assert.equal(preimage.server_version_num,170006);assert.equal(preimage.capture_role,'postgres');
 assert.equal(preimage.functions.length,12);
 for(const f of preimage.functions){assert.ok(f.oid);assert.equal(hash(f.definition,'md5'),f.definition_md5);}
 for(const name of ['private.closure_source_digest_v5()','private.closure_erasure_program_digest_v5()'])
  for(const changed of Object.values(signatures))assert(!preimage.functions.find(f=>f.signature===name).definition.includes(changed.split('(')[0]),
   'changed reader is not a source/erasure roster member; changed roster requires new review');
 const forward=guard('r07_pre',originals,true)+catalogBefore+ddl(postimages)+acceptance+
  catalogAfter+guard('r07_post',postimages,true)+"NOTIFY pgrst,'reload schema';\n";
 const rollback=guard('r07_revert_pre',postimages,true)+catalogBefore+ddl(originals)+catalogAfter+
  guard('r07_revert_post',originals,true)+"NOTIFY pgrst,'reload schema';\n";
 const flight=(images,result)=>`BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';\n${guard('r07_flight',images)}
 SELECT '${result}' result,false AS authenticated_positive_functional_acceptance;ROLLBACK;\n`;
 const outputs={'forward.sql':forward,'promotion.sql':wrap(forward),'rollback.sql':wrap(rollback),
  'preflight.sql':flight(originals,'R07_ATTENTION_DEV_PREIMAGE_MATCH'),'postflight.sql':flight(postimages,'R07_ATTENTION_DEV_POSTIMAGE_MATCH'),
  'acceptance.sql':acceptance,'postimages.json':JSON.stringify(postimages,null,2)+'\n'};
 outputs['manifest.json']=JSON.stringify({unit:'R07_DEV_APPLICATION_ATTENTION_PACKAGE',status:'PREPARED_NOT_APPLIED',project_ref:preimage.project_ref,
  captured_at:preimage.captured_at,changed_functions:Object.values(signatures),new_functions:0,new_tables:0,acl_changes:0,
  source:'Exact current DEV definitions plus build.mjs bounded body replacements',preimage_sha256:hash(read('preimage.json')),
  builder_sha256:hash(read('build.mjs')),files:Object.fromEntries(Object.entries(outputs).map(([name,s])=>[name,hash(s)])),
  limitations:['Project identity is the connector binding; the GUC is only an intent marker.',
   'R10 source_ready=false and NULL export/erasure bindings stay unchanged; no certification or activation occurs.',
   'Only three existing function bodies change; full catalog delta, ACL/config/owner preservation and exact inverse rollback are mandatory.',
   'Selection status, Agreement link, application terms and writer behavior stay unchanged. No new acknowledgment marker is introduced.',
   'Hosted acceptance is AUTH_REQUIRED plus exact NULL-owner projection; positive real Auth/native acceptance remains a separate root step.',
   'Original EX04B and R07 hourly candidates remain historical/staged source; future promotion must retain this lifecycle distinction.',
   'No full R01, R10, supported old fleet, provider, push or production admission is claimed.']},null,2)+'\n';
 return outputs;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outputs=generate();
 if(process.argv[2]==='--write')for(const[name,s]of Object.entries(outputs))writeFileSync(new URL(name,root),s);
 else if(process.argv[2]==='--check'){for(const[name,s]of Object.entries(outputs))assert.equal(read(name),s,name);console.log('R07 attention exact package generation PASS');}
 else throw Error('Use --write or --check. This program never deploys.');
}
