import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {inventory,semanticKeys,resetSections} from './manifest.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
const capture=JSON.parse(readFileSync(dir+'predecessor.json','utf8'));
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const get=n=>{const f=capture.functions.find(x=>x.name===n);assert.ok(f,n);return f.definition;};
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'UNIQUE_ANCHOR:'+a.slice(0,90));return s.replace(a,b);};
const replacements=new Map();
const add=(name,definition)=>replacements.set(name,definition);
const begin=(name,sql)=>add(name,replace(get(name),'BEGIN\n','BEGIN\n '+sql+'\n'));
const relationNames=inventory.map(x=>x.relation);
assert.equal(new Set(relationNames).size,20);
const immutable=(name,result,body)=>`CREATE OR REPLACE FUNCTION private.${name}() RETURNS ${result} LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $f01$ SELECT ${body}; $f01$;\n`;
const helpers=immutable('closure_taxonomy_inventory_v1','jsonb',q(JSON.stringify(inventory))+'::jsonb')
 +immutable('closure_taxonomy_semantic_keys_v1','text[]','ARRAY['+semanticKeys.map(q).join(',')+']::text[]')
 +immutable('closure_taxonomy_reset_sections_v1','jsonb',q(JSON.stringify(resetSections))+'::jsonb')
 +readFileSync(dir+'helpers.sql','utf8');

// Exact existing definitions are retained; each transformation has a unique anchor.
let d=get('closure_redaction_relations_v5');
const match=d.match(/AS \$function\$([\s\S]*?)\$function\$/);assert.ok(match);
const oldRelations=[...match[1].matchAll(/'((?:public|private)\.[a-z0-9_]+)'/g)].map(m=>m[1]);
assert.equal(oldRelations.length,76);assert.ok(oldRelations.every(x=>!relationNames.includes(x)));
add('closure_redaction_relations_v5',d.replace(match[1],` SELECT ARRAY[${[...relationNames,...oldRelations].map(q).join(',')}]::text[]; `));
add('closure_redaction_scope_v5',replace(get('closure_redaction_scope_v5'),'begin\n',`begin\n if r=ANY(ARRAY[${relationNames.map(q).join(',')}]::text[]) then return private.closure_taxonomy_scope_v1(r);end if;\n`));
d=get('closure_redaction_patch_v5');
d=replace(d," if r='public.agreement_invalidations_v1' then",` if r=ANY(ARRAY[${relationNames.map(q).join(',')}]::text[]) then return private.closure_taxonomy_patch_v1(r,t,a,g);end if;\n if r='public.agreement_invalidations_v1' then`);
d=replace(d," if p='{}'::jsonb or t@>p then return null;end if;", " if r='public.needs' then p:=p||jsonb_build_object('category_id',null);end if;\n if p='{}'::jsonb or t@>p then return null;end if;");
add('closure_redaction_patch_v5',d);
d=get('data_export_dataset_catalog');
add('data_export_dataset_catalog',replace(d,"'::jsonb $function$","'::jsonb || private.closure_taxonomy_export_catalog_v1() $function$"));
d=get('data_export_snapshot');
d=replace(d,'),\n projected as (', '\n union all select key,value from private.closure_taxonomy_export_rows_v1(p_account_id)),\n projected as (');
add('data_export_snapshot',replace(d,"'OWN_ACCOUNT_V5_10'","'OWN_ACCOUNT_V5_11'"));
d=get('data_export_policy_binding');
add('data_export_policy_binding',replace(replace(d,"'OWN_ACCOUNT_V5_10'","'OWN_ACCOUNT_V5_11'"),"jsonb_array_length(m->'datasets')<>52","jsonb_array_length(m->'datasets')<>72"));

const ownerArgs={rpc_taxonomy_prepare_admission_service:'p_owner_account_id',rpc_taxonomy_commit_reviewed_batch_service:'p_owner_account_id',rpc_taxonomy_bind_reviewed_worker_service:'p_owner_account_id',rpc_taxonomy_bind_reviewed_need_service:'p_owner_account_id',rpc_taxonomy_capture_gemini_turn_hints_service:'p_account_id',rpc_taxonomy_assign_worker_categories_service:'p_worker_account_id',rpc_set_worker_execution_modes:'auth.uid()'};
for(const [name,arg] of Object.entries(ownerArgs))begin(name,`PERFORM private.closure_assert_open(${arg});`);
begin('rpc_taxonomy_approve_admission','PERFORM private.closure_assert_open(auth.uid());');
begin('rpc_taxonomy_commit_admission_service','PERFORM private.closure_assert_open(owner_account_id) FROM private.work_taxonomy_admissions_v1 WHERE id=p_admission_id;');
begin('rpc_taxonomy_finalize_reviewed_batch_service','PERFORM private.closure_assert_open(owner_account_id) FROM private.work_taxonomy_review_outbox_v1 WHERE id=p_outbox_id;');
begin('sync_worker_skills_to_taxonomy_capabilities',`IF private.closure_taxonomy_profile_erasing_v1(p_account_id) THEN
 RETURN jsonb_build_object('success',true,'workerAccountId',p_account_id,'assignedCount',0,'assignedCategoryIds','[]'::jsonb,
 'retainedExistingCategoryCount',0,'retainedExistingCategoryIds','[]'::jsonb,'revokedCount',0,'revokedRelatedAcceptances',0,
 'unmappedSkillLabels','[]'::jsonb,'openNeedsRequeued',0,'newCapabilityAuthority','NONE','notificationAuthority','NONE');END IF;
 PERFORM private.closure_assert_open(p_account_id);`);

// Bounded materialized admission obtains the shared account lock BEFORE row locks.
d=get('rpc_taxonomy_claim_reviewed_batches_service');
d=replace(d,'WITH selected AS (','WITH candidates AS MATERIALIZED (');
d=replace(d,"WHERE (state IN ('PENDING','RETRY') AND retry_after<=statement_timestamp())\n     OR (state='CLAIMED' AND lease_until<statement_timestamp())", "WHERE NOT private.closure_account_restricted(owner_account_id) AND ((state IN ('PENDING','RETRY') AND retry_after<=statement_timestamp())\n     OR (state='CLAIMED' AND lease_until<statement_timestamp()))");
d=replace(d,'SELECT id FROM private.work_taxonomy_review_outbox_v1','SELECT id,owner_account_id FROM private.work_taxonomy_review_outbox_v1');
d=replace(d,'ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT p_limit\n ),','ORDER BY created_at,id LIMIT p_limit\n ), admitted AS MATERIALIZED (SELECT id FROM candidates WHERE private.closure_taxonomy_try_owner_v1(owner_account_id)),\n selected AS (SELECT q.id FROM private.work_taxonomy_review_outbox_v1 q JOIN admitted a ON a.id=q.id WHERE (q.state IN (\'PENDING\',\'RETRY\') AND q.retry_after<=statement_timestamp()) OR (q.state=\'CLAIMED\' AND q.lease_until<statement_timestamp()) FOR UPDATE OF q SKIP LOCKED),');
add('rpc_taxonomy_claim_reviewed_batches_service',d);
d=get('rpc_taxonomy_bind_ready_reviews_service');
d=replace(d,'  SELECT * FROM private.work_taxonomy_review_outbox_v1 q\n  WHERE q.state=', '  WITH candidates AS MATERIALIZED (SELECT q.id,q.owner_account_id FROM private.work_taxonomy_review_outbox_v1 q\n  WHERE NOT private.closure_account_restricted(q.owner_account_id) AND q.state=');
d=replace(d,'  FOR UPDATE SKIP LOCKED LIMIT p_limit\n LOOP','  LIMIT p_limit), admitted AS MATERIALIZED (SELECT id FROM candidates WHERE private.closure_taxonomy_try_owner_v1(owner_account_id))\n  SELECT q.* FROM private.work_taxonomy_review_outbox_v1 q JOIN admitted a ON a.id=q.id WHERE q.state=\'COMMITTED\' AND q.binding_state IN (\'PENDING\',\'RETRY\') AND q.binding_retry_after<=statement_timestamp() FOR UPDATE OF q SKIP LOCKED\n LOOP');
add('rpc_taxonomy_bind_ready_reviews_service',d);
for(const name of ['rpc_taxonomy_reconcile_reviewed_outbox_service','taxonomy_reconcile_pending_reviews_v1']){
 d=get(name);d=replace(d,' missing AS (',' missing AS MATERIALIZED (');
 if(name.startsWith('rpc_')){
  d=replace(d,'WHERE NOT EXISTS (SELECT 1 FROM private.work_taxonomy_review_outbox_v1 q','WHERE NOT private.closure_account_restricted(a.account_id) AND NOT EXISTS (SELECT 1 FROM private.work_taxonomy_review_outbox_v1 q');
  d=replace(d,' inserted AS (',' admitted AS MATERIALIZED (SELECT * FROM missing WHERE private.closure_taxonomy_try_owner_v1(account_id)),\n inserted AS (');
  d=replace(d,'purpose,plans FROM missing','purpose,plans FROM admitted');
 }else{
  d=replace(d,'SELECT * FROM saved s WHERE','SELECT * FROM saved s WHERE NOT private.closure_account_restricted(s.account_id) AND');
  d=replace(d,' ins AS (',' admitted AS MATERIALIZED (SELECT * FROM missing WHERE private.closure_taxonomy_try_owner_v1(account_id)),\n ins AS (');
  d=replace(d,'FROM missing ON CONFLICT','FROM admitted ON CONFLICT');
 }
 add(name,d);
}

const helperSignatures=[
 'private.closure_taxonomy_inventory_v1()','private.closure_taxonomy_semantic_keys_v1()','private.closure_taxonomy_reset_sections_v1()',
 'private.closure_taxonomy_scope_v1(text)','private.closure_taxonomy_owner_immutable_v1()','private.closure_taxonomy_held_v1(text,jsonb,uuid)',
 'private.closure_taxonomy_patch_v1(text,jsonb,uuid,uuid)','private.closure_taxonomy_try_owner_v1(uuid)',
 'private.closure_taxonomy_profile_erasing_v1(uuid)','private.closure_taxonomy_snapshot_guard_v1()',
 'private.closure_taxonomy_semantic_v1(jsonb)','private.closure_taxonomy_project_v1(text,jsonb,uuid)',
 'private.closure_taxonomy_export_rows_v1(uuid)','private.closure_taxonomy_export_catalog_v1()',
];
const exportHelpers=helperSignatures.filter(s=>!/held|patch|try_owner|profile_erasing|snapshot_guard|owner_immutable/.test(s));
d=get('data_export_projection_sha_v5');
add('data_export_projection_sha_v5',replace(replace(d,"]) signature",`,${exportHelpers.map(q).join(',')}]) signature`),'having count(*)=6',`having count(*)=${6+exportHelpers.length}`));
const covered=[...helperSignatures,...capture.functions.filter(f=>replacements.has(f.name)||['taxonomy_pending_saved_event_v1','taxonomy_signed_binding_requeue_v1'].includes(f.name)).map(f=>f.signature.replaceAll(', ',','))];
d=get('closure_source_digest_v5');const existing=[...d.matchAll(/'((?:public|private)\.[a-z0-9_]+\([^']*\))'/g)].map(m=>m[1]);assert.equal(existing.length,108);
const additions=[...new Set(covered)].filter(s=>!existing.includes(s));
add('closure_source_digest_v5',replace(replace(d,"]) signature",`,${additions.map(q).join(',')}]) signature`),'having count(*)=108',`having count(*)=${108+additions.length}`));
d=get('closure_erasure_program_digest_v5');
add('closure_erasure_program_digest_v5',replace(d,' or p.oid in(select tgfoid',` or p.oid in(select to_regprocedure(x) from unnest(ARRAY[${covered.map(q).join(',')}]::text[]) x)\n or p.oid in(select tgfoid`));

const tableShape=t=>({columns:t.columns.map(c=>({name:c.name,type:c.type,notNull:c.notNull,default:c.default,identity:c.identity,generated:c.generated})),constraints:(t.constraints??[]).map(c=>({name:c.name,definition:c.definition})),triggers:t.triggers??[]});
const preflight=`DO $f01$ DECLARE x jsonb;actual jsonb; BEGIN
 IF to_regprocedure('private.closure_taxonomy_inventory_v1()') IS NOT NULL THEN RAISE EXCEPTION 'F01_ALREADY_INSTALLED';END IF;
 IF EXISTS(SELECT 1 FROM private.closure_executions_v5 WHERE state='EXECUTING') THEN RAISE EXCEPTION 'F01_CLOSURE_EXECUTING';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(${q(JSON.stringify(capture.functions.map(f=>({signature:f.signature,bodyMd5:f.bodyMd5,owner:f.owner,acl:f.acl,config:f.config}))))}::jsonb) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(x->>'signature') AND md5(p.prosrc)=x->>'bodyMd5'
   AND pg_get_userbyid(p.proowner)=x->>'owner' AND to_jsonb(p.proacl::text) IS NOT DISTINCT FROM x->'acl'
   AND to_jsonb(p.proconfig) IS NOT DISTINCT FROM x->'config') THEN RAISE EXCEPTION 'F01_UNKNOWN_FUNCTION_PREDECESSOR: %',x->>'signature';END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(${q(JSON.stringify(capture.tables.map(t=>({name:t.name,...tableShape(t)}))))}::jsonb) LOOP
  SELECT jsonb_build_object('columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass(x->>'name') AND a.attnum>0 AND NOT a.attisdropped),
   'constraints',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=to_regclass(x->>'name')),'[]'::jsonb),
   'triggers',coalesce((SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=to_regclass(x->>'name') AND NOT t.tgisinternal),'[]'::jsonb)) INTO actual;
  IF actual IS DISTINCT FROM x-'name' THEN RAISE EXCEPTION 'F01_UNKNOWN_TABLE_PREDECESSOR: %',x->>'name';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY[${[...new Set(inventory.map(x=>x.dataClass))].map(q).join(',')}]::text[]) c WHERE NOT EXISTS(SELECT 1 FROM private.closure_dataset_catalog_v5 d WHERE d.data_class=c)) THEN RAISE EXCEPTION 'F01_DATA_CLASS_MISSING';END IF;
 IF EXISTS(SELECT 1 FROM public.needs n JOIN private.dev_phase1_20261014_needs_snapshot s ON s.id=n.id WHERE n.requester_account_id IS DISTINCT FROM s.requester_account_id) THEN RAISE EXCEPTION 'F01_NEED_SNAPSHOT_OWNER_CONFLICT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.needs'::regclass AND attname='category_id' AND atttypid='uuid'::regtype AND NOT attnotnull AND NOT attisdropped) THEN RAISE EXCEPTION 'F01_NEED_CATEGORY_SHAPE';END IF;
END $f01$;\n`;
const guards=inventory.map(x=>`CREATE TRIGGER closure_f01_immutable BEFORE UPDATE ON ${x.relation} FOR EACH ROW EXECUTE FUNCTION private.closure_taxonomy_owner_immutable_v1(${q(x.ownerColumn)});
CREATE TRIGGER closure_f01_owned BEFORE INSERT OR UPDATE OR DELETE ON ${x.relation} FOR EACH ROW EXECUTE FUNCTION ${x.key==='archivedTaskDispatch'?'private.closure_taxonomy_snapshot_guard_v1()':`private.closure_guard_owned_write(${q(x.mode)},${q(x.ownerColumn)})`};`).join('\n');
const catalog=inventory.map(x=>`UPDATE private.closure_dataset_catalog_v5 SET relations=relations||ARRAY[${q(x.relation)}] WHERE data_class=${q(x.dataClass)} AND NOT ${q(x.relation)}=ANY(relations);`).join('\n');
const revokes=helperSignatures.map(s=>`REVOKE ALL ON FUNCTION ${s} FROM PUBLIC,anon,authenticated,service_role;`).join('\n');
const statements=definitions=>definitions.map(d=>d.trim().replace(/;$/,'')+';\n').join('\n');
const generated='-- GENERATED by build.mjs; functional extension only; certificates deliberately unchanged.\nBEGIN;\nSET LOCAL search_path=pg_catalog;\n'+preflight+'\n'+helpers+'\n'+statements([...replacements.values()])+'\n'+guards+'\n'+catalog+'\n'+revokes+'\nCOMMIT;\n';
const products={'candidate.sql':generated,'manifest.generated.json':JSON.stringify({scope:'SOURCE_CANDIDATE_NOT_CERTIFIED',sourceDigest:capture.sourceDigest,certified:capture.certified,replacedFunctions:[...replacements.keys()],newFunctions:helperSignatures,sourceRoster:108+additions.length,tables:relationNames,candidateSha256:createHash('sha256').update(generated).digest('hex'),fullClosureProof:false},null,2)+'\n'};
for(const [name,body] of Object.entries(products))if(process.argv.includes('--check'))assert.equal(readFileSync(dir+name,'utf8'),body,name);else writeFileSync(dir+name,body);
console.log(JSON.stringify({generated:Object.keys(products),replacedFunctions:replacements.size,newFunctions:helperSignatures.length,relations:inventory.length,sourceRoster:108+additions.length,certificatesChanged:false}));
