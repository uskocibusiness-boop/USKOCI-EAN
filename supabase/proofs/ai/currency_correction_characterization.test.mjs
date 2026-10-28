// R07a regression after the recorded prepatch characterization. No network or deployment.
// Exact DEV SQL bodies observed 2026-10-27 04:43-04:46 UTC, leqcwgzvjsxugfgzdmth.
// Narrow PGlite schema: completion/context/status and prepared-review boundaries;
// NOT Auth, full RLS/closure, concurrent locks or successful signed Save/publication.
// The real Edge guard is evaluated; test exports are appended only in the VM.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {syntheticDialogue} from './dialogue_fixture.mjs';
import {verifyPriceReviewBoundary} from './price_review_boundary_fixture.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entry=resolve(root,'supabase/functions/uskoci-ai-interview/index.ts');
const owner='22222222-2222-4222-8222-222222222222',conversation='11111111-1111-4111-8111-111111111111';
const liveDefinitions={
  "rpc_ai_apply_interview_turn_v2_service": {
    "md5": "14ace04bd1895f4d230d41baf13dd6d6",
    "definition": "CREATE OR REPLACE FUNCTION public.rpc_ai_apply_interview_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n  v_conv public.ai_conversations%rowtype;\n  v_item jsonb;\n  v_key text;\n  v_value jsonb;\n  v_display text;\n  v_evidence text;\n  v_confidence numeric;\n  v_value_type text;\n  v_fact_id uuid;\n  v_fact_ids uuid[]:='{}'::uuid[];\n  v_previous_ids uuid[];\n  v_user_message_id uuid;\n  v_assistant_message_id uuid;\n  v_proposals jsonb:=coalesce(p_proposals,'[]'::jsonb);\nbegin\n  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;\n  if coalesce(char_length(btrim(p_user_message)),0)<1 or char_length(btrim(p_user_message))>4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;\n  if coalesce(char_length(btrim(p_assistant_message)),0)<1 or char_length(btrim(p_assistant_message))>1500 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;\n  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;\n  if jsonb_typeof(v_proposals)<>'array' or jsonb_array_length(v_proposals)>12 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;\n  if p_safety='BLOCK' and jsonb_array_length(v_proposals)>0 then raise exception 'BLOCK_CANNOT_PERSIST_PROPOSALS' using errcode='22023'; end if;\n\n  select * into v_conv\n    from public.ai_conversations\n   where id=p_conversation_id\n   for update;\n  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;\n  if v_conv.account_id<>p_account_id then raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode='42501'; end if;\n  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;\n  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_CONVERSATION_REQUIRED' using errcode='P0001'; end if;\n  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;\n\n  for v_item in select value from jsonb_array_elements(v_proposals)\n  loop\n    if jsonb_typeof(v_item)<>'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;\n    v_key:=nullif(btrim(v_item->>'key'),'');\n    v_value:=v_item->'value';\n    v_display:=nullif(btrim(v_item->>'displayValue'),'');\n    v_evidence:=nullif(btrim(v_item->>'evidence'),'');\n    if v_key in('need.resolved_location','need.public_photo_paths') then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;\n    if v_key is null then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;\n    if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023',detail=v_key; end if;\n    if v_evidence is null or char_length(v_evidence)>500 then raise exception 'V2_FACT_EVIDENCE_INVALID' using errcode='22023',detail=v_key; end if;\n    begin v_confidence:=(v_item->>'confidence')::numeric; exception when others then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end;\n    if v_confidence is null or v_confidence<0 or v_confidence>1 then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end if;\n\n    select value_type into v_value_type from private.need_fact_registry where fact_key=v_key;\n    if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=v_key; end if;\n    perform private.validate_need_v2_fact(v_key,v_value);\n\n    v_fact_id:=extensions.gen_random_uuid();\n    with superseded as (\n      update public.ai_structured_facts\n         set superseded_at=statement_timestamp(),superseded_by=null\n       where conversation_id=p_conversation_id\n         and fact_key=v_key\n         and superseded_at is null\n       returning id\n    )\n    select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;\n\n    insert into public.ai_structured_facts(\n      id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,\n      confidence,evidence_excerpt,fact_schema_version,value_type,display_value\n    ) values (\n      v_fact_id,p_account_id,p_conversation_id,v_conv.bound_need_id,v_key,v_value,\n      'NEEDS_CONFIRMATION','AI_INFERENCE','NEED_DRAFT',v_confidence,v_evidence,\n      'NEED_FACT_V2',v_value_type,v_display\n    );\n\n    if cardinality(v_previous_ids)>0 then\n      update public.ai_structured_facts set superseded_by=v_fact_id where id=any(v_previous_ids);\n    end if;\n    v_fact_ids:=array_append(v_fact_ids,v_fact_id);\n  end loop;\n\n  insert into public.ai_messages(account_id,conversation_id,role,body)\n  values(p_account_id,p_conversation_id,'USER',btrim(p_user_message))\n  returning id into v_user_message_id;\n\n  insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)\n  values(p_account_id,p_conversation_id,'ASSISTANT',btrim(p_assistant_message),p_safety,v_fact_ids)\n  returning id into v_assistant_message_id;\n\n  return jsonb_build_object(\n    'conversationId',p_conversation_id,\n    'userMessageId',v_user_message_id,\n    'assistantMessageId',v_assistant_message_id,\n    'proposedCount',cardinality(v_fact_ids),\n    'proposedFactIds',to_jsonb(v_fact_ids),\n    'schemaVersion','NEED_FACT_V2',\n    'safety',p_safety,\n    'authoritative',true\n  );\nend\n$function$\n"
  },
  "rpc_ai_need_review_v2": {
    "md5": "1e6b3f195bb47e09a7bb7887f087b9cd",
    "definition": "CREATE OR REPLACE FUNCTION public.rpc_ai_need_review_v2(p_conversation_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n  v_uid uuid:=auth.uid();\n  v_conv public.ai_conversations%rowtype;\n  v_facts jsonb;\n  v_missing jsonb;\n  v_safety text;\nbegin\n  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n\n  select * into v_conv\n    from public.ai_conversations\n   where id=p_conversation_id\n   for share;\n  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;\n  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;\n  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;\n\n  -- Ignore null/unsupported rows so they cannot clear an earlier BLOCK.\n  -- No supported decision retains the existing conservative REVIEW fallback.\n  select coalesce((\n    select m.safety from public.ai_messages m\n     where m.conversation_id=p_conversation_id\n       and m.role='ASSISTANT'\n       and m.safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')\n     order by m.sequence_no desc\n     limit 1\n  ),'REVIEW') into v_safety;\n\n  select coalesce(jsonb_agg(\n    jsonb_build_object(\n      'id',f.id,\n      'key',f.fact_key,\n      'value',f.fact_value,\n      'displayValue',coalesce(f.display_value,\n        case when jsonb_typeof(f.fact_value)='string' then f.fact_value#>>'{}' else f.fact_value::text end),\n      'status',f.status,\n      'source',f.source,\n      'evidence',f.evidence_excerpt,\n      'schemaVersion',f.fact_schema_version,\n      'valueType',f.value_type,\n      'privacyClass',coalesce(r.privacy_class,'PRIVATE'),\n      'requiredForDraft',coalesce(r.required_for_draft,false),\n      'material',coalesce(r.material,true)\n    ) order by f.created_at,f.fact_key\n  ),'[]'::jsonb)\n    into v_facts\n    from public.ai_structured_facts f\n    left join private.need_fact_registry r\n      on r.fact_key=f.fact_key and f.fact_schema_version='NEED_FACT_V2'\n   where f.conversation_id=p_conversation_id\n     and f.superseded_at is null;\n\n  if v_conv.fact_schema_version='NEED_FACT_V2' then\n    select coalesce(jsonb_agg(r.fact_key order by r.fact_key),'[]'::jsonb)\n      into v_missing\n      from private.need_fact_registry r\n     where r.required_for_draft\n       and not exists (\n         select 1 from public.ai_structured_facts f\n          where f.conversation_id=p_conversation_id\n            and f.fact_key=r.fact_key\n            and f.fact_schema_version='NEED_FACT_V2'\n            and f.status='CONFIRMED'\n            and f.superseded_at is null\n       );\n  else\n    v_missing:='[]'::jsonb;\n  end if;\n\n  return jsonb_build_object(\n    'conversationId',v_conv.id,\n    'schemaVersion',v_conv.fact_schema_version,\n    'status',v_conv.status,\n    'boundNeedId',v_conv.bound_need_id,\n    'facts',v_facts,\n    'missingRequired',v_missing,\n    'safety',v_safety,\n    'canSaveDraft',\n      v_conv.fact_schema_version='NEED_FACT_V2'\n      and v_conv.status='OPEN'\n      and jsonb_array_length(v_missing)=0\n      and v_safety<>'BLOCK'\n  );\nend\n$function$\n"
  },
  "ai_task_review_source_before_media": {
    "md5": "dbd934c97eb0f37691e0692c977d35b3",
    "definition": "CREATE OR REPLACE FUNCTION private.ai_task_review_source_before_media(cid uuid)\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n select jsonb_build_object('conversation',jsonb_build_object('id',c.id,'accountId',c.account_id,\n  'purpose',c.purpose,'status',c.status,'boundNeedId',c.bound_need_id,'schemaVersion',c.fact_schema_version,'editBase',c.need_edit_base_fingerprint),\n  'need',case when c.bound_need_id is null then null else (select jsonb_build_object('id',n.id,'revision',n.revision,'status',n.status,\n    'marker',private.need_edit_base_marker(n.id)) from public.needs n where n.id=c.bound_need_id) end,\n  'facts',coalesce((select jsonb_agg(to_jsonb(f) order by f.fact_key,f.id) from public.ai_structured_facts f\n   where f.conversation_id=c.id and f.superseded_at is null),'[]'::jsonb),\n  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sequence',m.sequence_no,'safety',m.safety)\n   order by m.sequence_no) from public.ai_messages m where m.conversation_id=c.id),'[]'::jsonb),\n  'turns',coalesce((select jsonb_agg(jsonb_build_object('id',t.turn_id,'state',t.state,'attempt',t.attempt_id)\n   order by t.turn_id) from private.ai_need_turn_commands t where t.conversation_id=c.id),'[]'::jsonb))\n from public.ai_conversations c where c.id=cid;\n$function$\n"
  },
  "validate_need_v2_fact": {
    "md5": "a09d1b629431902b59636ff078ff282e",
    "definition": "CREATE OR REPLACE FUNCTION private.validate_need_v2_fact(p_key text, p_value jsonb)\n RETURNS void\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nbegin\n  if p_key='need.handoff' then\n    if not private.taxonomy_handoff_valid_v1(p_value) then\n      raise exception 'HANDOFF_INPUT_INVALID' using errcode='22023';\n    end if;\n    return;\n  end if;\n  if p_key='need.resolved_location' then\n    if p_value is null or p_value='null'::jsonb or private.normalize_resolved_location(p_value,\n      p_value#>>'{binding,taskCountryCode}',p_value#>'{binding,geography}',p_value#>>'{binding,exactAddress}') is distinct from p_value then\n      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;\n    return;\n  end if;\n  if p_key='need.task_country_code' then\n    if p_value#>>'{}' is distinct from private.require_location_country(p_value) then\n      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';\n    end if;\n    return;\n  end if;\n\n  -- A TIMESTAMPTZ fact must carry the exact ISO 8601 shape the client decoder accepts, so the\n  -- server cannot store a value that discards the whole review envelope when it is read. The\n  -- pattern is the one in src/data/serverReceipt.ts timestamp(); the two must stay identical.\n  if exists(select 1 from private.need_fact_registry\n             where fact_key=p_key and schema_version='NEED_FACT_V2' and value_type='TIMESTAMPTZ') then\n    if jsonb_typeof(p_value) is distinct from 'string'\n      or (p_value#>>'{}') !~ '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,6})?(Z|[+-]\\d{2}:\\d{2})$' then\n      raise exception 'V2_FACT_TIMESTAMP_SHAPE_INVALID' using errcode='22023', detail=p_key;\n    end if;\n  end if;\n\n  perform private.validate_need_v2_fact_pre_country(p_key,p_value);\nend;\n$function$\n"
  },
  "validate_need_v2_fact_pre_country": {
    "md5": "6bfc84d00aaf74ea1f057053c92b4649",
    "definition": "CREATE OR REPLACE FUNCTION private.validate_need_v2_fact_pre_country(p_key text, p_value jsonb)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nbegin\n  if p_key='need.task_geography' then perform private.normalize_task_geography(p_value); end if;\n  perform private.validate_need_v2_fact_pre_location(p_key,p_value);\nend;\n$function$\n"
  },
  "validate_need_v2_fact_pre_location": {
    "md5": "cfb6efa2581c8d2c0d60cc3e11f55c7c",
    "definition": "CREATE OR REPLACE FUNCTION private.validate_need_v2_fact_pre_location(p_key text, p_value jsonb)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nbegin\n  if p_key='need.price_mode'\n     and jsonb_typeof(p_value)='string'\n     and p_value#>>'{}'='FASTEST' then\n    raise exception 'V2_PRICE_MODE_RETIRED'\n      using errcode='22023', detail='FASTEST';\n  end if;\n\n  perform private.validate_need_v2_fact_pre_fastest_retirement(p_key,p_value);\nend\n$function$\n"
  },
  "rpc_ai_confirm_fact": {
    "md5": "a2f6f717eb132c3124ad13c1739823a5",
    "definition": "CREATE OR REPLACE FUNCTION public.rpc_ai_confirm_fact(p_fact_id uuid)\n RETURNS uuid\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare v_uid uuid:=auth.uid(); v_fact public.ai_structured_facts%rowtype; v_conv public.ai_conversations%rowtype;\nbegin\n  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n  select * into v_fact from public.ai_structured_facts where id=p_fact_id;\n  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;\n  if v_fact.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;\n  select * into v_conv from public.ai_conversations where id=v_fact.conversation_id for update;\n  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;\n  select * into v_fact from public.ai_structured_facts where id=p_fact_id and conversation_id=v_conv.id for update;\n  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;\n  if v_fact.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;\n  if v_fact.fact_key='need.resolved_location' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;\n  if v_fact.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;\n\n  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;\n  if v_fact.status='CONFIRMED' then\n    if v_fact.confirmed_at is null or v_fact.confirmed_by_user_id is null then raise exception 'CONFIRMED_PROVENANCE_INVALID' using errcode='P0001'; end if;\n    return p_fact_id;\n  end if;\n  update public.ai_structured_facts set status='CONFIRMED',confirmed_at=statement_timestamp(),confirmed_by_user_id=v_uid where id=p_fact_id;\n  return p_fact_id;\nend;\n$function$\n"
  }
};
const registry=[
  {
    "fact_key": "need.category",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.category",
    "value_type": "TEXT"
  },
  {
    "fact_key": "need.description",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.description",
    "value_type": "TEXT"
  },
  {
    "fact_key": "need.people_needed",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.required_slots",
    "value_type": "INTEGER"
  },
  {
    "fact_key": "need.price_basis",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": false,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.price_basis",
    "value_type": "ENUM"
  },
  {
    "fact_key": "need.price_mode",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.mode",
    "value_type": "ENUM"
  },
  {
    "fact_key": "need.price_rsd",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": false,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.requester_price_rsd",
    "value_type": "INTEGER"
  },
  {
    "fact_key": "need.schedule_kind",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.schedule_kind",
    "value_type": "ENUM"
  },
  {
    "fact_key": "need.task_country_code",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.task_country_code",
    "value_type": "TEXT"
  },
  {
    "fact_key": "need.task_geography",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "need_geography.public_topology",
    "value_type": "OBJECT"
  },
  {
    "fact_key": "need.title",
    "material": true,
    "privacy_class": "PUBLIC",
    "required_for_draft": true,
    "schema_version": "NEED_FACT_V2",
    "target_owner": "needs.title",
    "value_type": "TEXT"
  }
];
const db=new PGlite();
test.after(async()=>{await db.close();});
const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
const json=value=>JSON.stringify(value);
function bodyOf(definition) {
 const match=/\bAS\s+(\$[a-zA-Z0-9_]*\$)/i.exec(definition);
 assert.ok(match);const start=match.index+match[0].length,end=definition.indexOf(match[1],start);
 assert.ok(end>start);return definition.slice(start,end);
}
async function install(definition,md5) {
 assert.equal(createHash('md5').update(bodyOf(definition)).digest('hex'),md5);
 await db.exec(definition);
}
function migrationDefinition(file,symbol) {
 const source=readFileSync(resolve(root,file),'utf8').replace(/\r\n/g,'\n');
 const found=new RegExp('CREATE OR REPLACE FUNCTION\\s+private\\.'+symbol+'\\s*\\(','i').exec(source);assert.ok(found);
 const tail=source.slice(found.index),as=/\bAS\s+(\$[a-zA-Z0-9_]*\$)/i.exec(tail);assert.ok(as);
 const end=tail.indexOf(as[1],as.index+as[0].length);assert.ok(end>0);
 return tail.slice(0,end+as[1].length)+';';
}
function localEdgeGuard() {
 const sandbox=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,Date,TextEncoder,TextDecoder,
  ReadableStream,AbortController,setTimeout,clearTimeout,crypto:webcrypto,
  fetch:()=>assert.fail('NETWORK_FORBIDDEN_IN_CHARACTERIZATION'),
  console:{error:()=>{},info:()=>{}},Deno:{env:{get:()=>undefined},serve:()=>{}}});
 const cache=new Map(),bases=['supabase/functions/_shared','src/contracts'].map(p=>resolve(root,p)+sep);
 function load(file) {
  assert.ok(file===entry||bases.some(base=>file.startsWith(base)),'only local Edge dependencies');
  if(cache.has(file))return cache.get(file).exports;
  const source=readFileSync(file,'utf8')+(file===entry?'\nexport {guardConversationTurn,serverTimeContext,needTurnPersistenceProposals,parseV2Output};':'');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
   reportDiagnostics:true,fileName:file.replace(/\.mjs$/,'.ts')});
  assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const module={exports:{}};cache.set(file,module);
  const evaluate=new vm.Script('(function(require,module,exports){'+compiled.outputText+'\n})',{filename:file}).runInContext(sandbox);
  evaluate(specifier=>{assert.ok(specifier.startsWith('.'));return load(resolve(dirname(file),specifier));},module,module.exports);
  return module.exports;
 }
 return load(entry);
}
const edge=localEdgeGuard(),now=edge.serverTimeContext(new Date('2026-10-27T10:00:00Z'));
const proposal=(key,value,evidence='5000 RSD')=>({key,value,displayValue:String(value),evidence,confidence:1});
const guard=(input,proposals=[],facts=[],priceUnit='UNSPECIFIED')=>edge.guardConversationTurn({
 safety:'ALLOW',assistantMessage:'Cena je potvrđena.',proposals,
 dialogue:{...syntheticDialogue(),next:'ACK',priceUnit}},input,[],facts,now);
const active=async()=> (await db.query('select fact_key,fact_value,status,id from public.ai_structured_facts where conversation_id=$1 and superseded_at is null order by fact_key',[conversation])).rows;
const apply=async(input,turn)=> (await one('select public.rpc_ai_apply_interview_turn_v2_service($1,$2,$3,$4,$5,$6::jsonb) as result',
 [owner,conversation,input,turn.assistantMessage,turn.safety,json(edge.needTurnPersistenceProposals(turn))])).result;
const read=async()=> (await one('select public.rpc_ai_need_review_v2($1) as result',[conversation])).result;
const source=async()=> (await one('select private.ai_task_review_source_before_media($1) as result',[conversation])).result;

test('R07a price retraction: actual Edge, guarded candidate writer and current review bodies',async t=>{
 await db.exec([
 'create schema private;create schema extensions;create schema auth;',
 "create function auth.uid() returns uuid language sql as 'select ''"+owner+"''::uuid';",
 "create function extensions.gen_random_uuid() returns uuid language sql as 'select pg_catalog.gen_random_uuid()';",
 'create table public.ai_conversations(id uuid primary key,account_id uuid,purpose text,status text,fact_schema_version text,bound_need_id uuid,need_edit_base_fingerprint text);',
 'create table public.needs(id uuid primary key,revision integer,status text);',
 "create function private.need_edit_base_marker(uuid) returns text language sql as 'select null::text';",
 'create table private.ai_need_turn_commands(turn_id uuid,conversation_id uuid,state text,attempt_id uuid);',
 'create table private.need_fact_registry(fact_key text primary key,schema_version text,value_type text,privacy_class text,required_for_draft boolean,material boolean,target_owner text);',
 'create table public.ai_structured_facts(id uuid primary key default gen_random_uuid(),account_id uuid,conversation_id uuid,subject_need_id uuid,fact_key text,fact_value jsonb,status text,source text,scope text,confidence numeric,evidence_excerpt text,fact_schema_version text,value_type text,display_value text,created_at timestamptz default clock_timestamp(),superseded_at timestamptz,superseded_by uuid,confirmed_at timestamptz,confirmed_by_user_id uuid);',
 'create table public.ai_messages(id uuid default gen_random_uuid(),account_id uuid,conversation_id uuid,role text,body text,safety text,proposed_fact_ids uuid[],sequence_no bigint generated always as identity);'
 ].join('\n'));
 for(const row of registry)await db.query('insert into private.need_fact_registry select * from jsonb_populate_record(null::private.need_fact_registry,$1::jsonb)',[json(row)]);
 // Price validator chain is exact. Geographic-only dependencies are not invoked;
 // synthetic geographic seed rows do not prove the actual geography authority.
 await install(migrationDefinition('supabase/migrations/20261023220000_universal_crown_taxonomy_and_hourly_pricing.sql',
  'validate_need_v2_fact_pre_fastest_retirement'),'14d72565f9397f808cc2b24a7ccaf712');
 for(const {definition,md5}of Object.values(liveDefinitions))await install(definition,md5);
 const initial={'need.title':'Sintetički zadatak','need.description':'Krečenje zida','need.category':'Krečenje zidova',
  'need.people_needed':2,'need.price_mode':'MY_PRICE','need.price_rsd':5000,'need.price_basis':'TOTAL',
  'need.schedule_kind':'FLEXIBLE','need.task_country_code':'RS','need.task_geography':{mode:'STATIONARY',start:{city:'Novi Sad'}}};
 await db.query('insert into public.ai_conversations values($1,$2,$3,$4,$5,null,null)',[conversation,owner,'NEED_INTAKE','OPEN','NEED_FACT_V2']);
 for(const row of registry)await db.query("insert into public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value,status,source,scope,confidence,fact_schema_version,value_type,display_value,confirmed_at,confirmed_by_user_id) values($1,$2,$3,$4::jsonb,'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,'NEED_FACT_V2',$5,$6,now(),$1)",
 [owner,conversation,row.fact_key,json(initial[row.fact_key]),row.value_type,String(initial[row.fact_key])]);
 const before=await active(),beforeSource=await source();
 const candidate=readFileSync(resolve(root,'supabase/candidates/r07_price_retraction.sql'),'utf8');
 const baselineMetadata=await one("select proowner,proacl,prosecdef,proconfig from pg_proc where oid='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure");
 const euro=guard('u evrima',[],before);
 await t.test('current writer refuses the new control atomically before coordinated rollout',async()=>{
  assert.equal(euro.priceRetraction,'UNSUPPORTED_CURRENCY');
  assert.equal(euro.proposals.length,0);
  await assert.rejects(apply('u evrima',euro),{message:'V2_FACT_KEY_INVALID'});
  assert.deepEqual(await active(),before);
  assert.equal((await one('select count(*)::int as n from public.ai_messages')).n,0);
 });
 await t.test('candidate requires local opt-in and preserves existing function authority',async()=>{
  await assert.rejects(db.exec(candidate),{message:'R07_DISPOSABLE_TARGET_REQUIRED'});
  await db.exec("set uskoci.r07.disposable='LOCAL_ONLY'");
  await db.exec(candidate);
  assert.deepEqual(await one("select proowner,proacl,prosecdef,proconfig from pg_proc where oid='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure"),baselineMetadata);
  await assert.rejects(db.exec(candidate),{message:'R07_WRITER_SOURCE_DRIFT'});
 });
 // Real fact-write trigger, with only the separate closure exemption stubbed to
 // false. This checks canonical supersession/provenance, not Auth or closure.
 const bootstrap=readFileSync(resolve(root,'supabase/proofs/privacy/bootstrap/current-application.sql'),'utf8');
 const guardStart=bootstrap.indexOf('CREATE OR REPLACE FUNCTION private.guard_ai_fact_write()');
 const guardEnd=bootstrap.indexOf('$function$;',guardStart)+'$function$;'.length;
 await db.exec("create function auth.role() returns text language sql as 'select ''service_role''::text';create function private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb) returns boolean language sql as 'select false';");
 await install(bootstrap.slice(guardStart,guardEnd),'f9972cfc47af0358a9f4f03c2e43fe63');
 await db.exec('create trigger guard_ai_fact_write_trg before update on public.ai_structured_facts for each row execute function private.guard_ai_fact_write()');
 await t.test('EUR correction retracts all old price consent and keeps other facts',async()=>{
  const receipt=await apply('u evrima',euro);
  assert.equal(receipt.proposedCount,0);assert.equal(receipt.safety,'CLARIFY');
  assert.deepEqual(await active(),before.filter(f=>!f.fact_key.startsWith('need.price_')));
  assert.equal((await one('select count(*)::int as n from public.ai_messages')).n,2);
  for(const old of before.filter(f=>f.fact_key.startsWith('need.price_'))){
   const row=await one('select * from public.ai_structured_facts where id=$1',[old.id]);
   assert.ok(row.superseded_at);assert.equal(row.superseded_by,null);
   assert.equal(row.status,'CONFIRMED');assert.ok(row.confirmed_at);
   assert.deepEqual(row.fact_value,old.fact_value);
   await assert.rejects(db.query('select public.rpc_ai_confirm_fact($1)',[old.id]),{message:'SUPERSEDED'});
  }
 });
 await t.test('real review and source no longer expose stale price as active or ready',async()=>{
  const review=await read();assert.equal(review.canSaveDraft,false);
  assert.deepEqual(review.missingRequired,['need.price_mode']);
  assert.equal(review.facts.some(f=>f.key.startsWith('need.price_')),false);
  const after=await source();assert.notDeepEqual(after,beforeSource);
  assert.equal(after.facts.some(f=>f.key?.startsWith('need.price_')||f.fact_key?.startsWith('need.price_')),false);
 });
 await t.test('later unrelated ALLOW cannot restore readiness or the retracted amount',async()=>{
  await apply('Hvala.',{safety:'ALLOW',assistantMessage:'Nema na čemu.',proposals:[]});
  assert.equal((await read()).safety,'ALLOW');assert.equal((await read()).canSaveDraft,false);
  assert.equal((await active()).some(f=>f.fact_key.startsWith('need.price_')),false);
 });
 await t.test('a new explicit RSD price requires fresh confirmation and then restores readiness',async()=>{
  const next=guard('Cena je 6000 RSD ukupno.',[proposal('need.price_mode','MY_PRICE','6000 RSD'),
   proposal('need.price_rsd',6000,'6000 RSD'),proposal('need.price_basis','TOTAL','ukupno')],await active());
  assert.equal(next.priceRetraction,undefined);assert.equal(next.proposals.length,3);
  await apply('Cena je 6000 RSD ukupno.',next);
  const prices=(await active()).filter(f=>f.fact_key.startsWith('need.price_'));
  assert.equal(prices.length,3);assert.ok(prices.every(f=>f.status==='NEEDS_CONFIRMATION'));
  assert.equal((await read()).canSaveDraft,false);
  for(const fact of prices)await db.query('select public.rpc_ai_confirm_fact($1)',[fact.id]);
  assert.equal((await read()).canSaveDraft,true);
  assert.equal((await active()).find(f=>f.fact_key==='need.price_rsd').fact_value,6000);
 });
 await t.test('malformed, conflicting and misplaced controls never change facts or messages',async()=>{
  const facts=await active(),messages=(await one('select count(*)::int as n from public.ai_messages')).n;
  const marker={action:'INVALIDATE_PRICE',reason:'UNSUPPORTED_CURRENCY'};
  const invoke=(payload,safety='CLARIFY',account=owner)=>db.query('select public.rpc_ai_apply_interview_turn_v2_service($1,$2,$3,$4,$5,$6::jsonb)',
   [account,conversation,'u evrima','Potrebna je nova cena.',safety,json(payload)]);
  for(const payload of [[{...marker,extra:true}],[{...marker,reason:'OTHER'}],[marker,marker],
   [proposal('need.people_needed',3,'3 osobe'),marker],
   [marker,proposal('need.price_rsd',9000,'9000 RSD')]])await assert.rejects(invoke(payload));
  for(const safety of ['BLOCK','ALLOW'])await assert.rejects(invoke([marker],safety));
  await assert.rejects(invoke([marker],'CLARIFY','33333333-3333-4333-8333-333333333333'),{message:'CONVERSATION_OWNER_MISMATCH'});
  // A later invalid ordinary fact rolls the earlier supersession back too.
  await assert.rejects(invoke([marker,proposal('need.people_needed',-1,'-1 osoba')]));
  assert.deepEqual(await active(),facts);
  assert.equal((await one('select count(*)::int as n from public.ai_messages')).n,messages);
  await db.exec("update public.ai_conversations set status='ABANDONED'");
  await assert.rejects(invoke([marker]),{message:'CONVERSATION_CLOSED'});
  await db.exec("update public.ai_conversations set status='OPEN'");
  assert.deepEqual(await active(),facts);
 });
 await t.test('a bare price correction retracts consent while retaining an independent headcount',async()=>{
  const next=guard('Cena je 7000; 3 osobe.',[proposal('need.price_rsd',7000,'Cena je 7000'),
   proposal('need.people_needed',3,'3 osobe')],await active());
  assert.equal(next.priceRetraction,'AMBIGUOUS_CURRENCY');
  const receipt=await apply('Cena je 7000; 3 osobe.',next);
  assert.equal(receipt.proposedCount,1);
  assert.equal((await active()).find(f=>f.fact_key==='need.people_needed').fact_value,3);
  assert.equal((await read()).canSaveDraft,false);
 });
 await t.test('OFFERS remains an explicit choice, never an invented fallback',async()=>{
  assert.equal((await active()).some(f=>f.fact_key==='need.price_mode'),false);
  const offers=guard('Želim ponude.',[proposal('need.price_mode','OFFERS','Želim ponude')],await active());
  assert.equal(offers.priceRetraction,undefined);
  await apply('Želim ponude.',offers);
  assert.equal((await active()).find(f=>f.fact_key==='need.price_mode').fact_value,'OFFERS');
  assert.equal((await active()).some(f=>f.fact_key==='need.price_rsd'),false);
 });
 await t.test('nonprice, other-task, uncertain-task and blocked turns cannot retract price',()=>{
  const turns=[guard('Materijal je 100 EUR.',[],before),guard('3 osobe.',[proposal('need.people_needed',3,'3 osobe')],before)];
  for(const taskRelation of ['DIFFERENT_TASK','UNCLEAR'])turns.push(edge.guardConversationTurn({safety:'ALLOW',assistantMessage:'Razumem.',proposals:[],
   dialogue:{...syntheticDialogue(),next:'ACK',taskRelation}},'u evrima',[],before,now));
  turns.push(edge.guardConversationTurn({safety:'BLOCK',assistantMessage:'Odbijeno.',proposals:[]},'u evrima',[],before,now));
  for(const turn of turns)assert.equal(turn.priceRetraction,undefined);
 });
 // Admit actual owned completion/context/status bodies. Closure admission is
 // explicitly stubbed; request context, expiry, attempts and replay are real SQL.
 await db.exec(`alter table private.ai_need_turn_commands
  add column account_id uuid, add column client_request_id uuid, add column request_hash text,
  add column provider_dispatched boolean, add column cancelled_at timestamptz,
  add column lease_expires_at timestamptz, add column context_hash text,
  add column updated_at timestamptz, add column receipt jsonb;
  create function private.closure_assert_open(uuid) returns void language plpgsql as 'begin return; end';
  create function extensions.digest(bytea,text) returns bytea language sql as
   'select case when $2=''sha256'' then pg_catalog.sha256($1) else null end';`);
 for(const [name,md5] of [
  ['private.ai_need_turn_context','972099be9f9429d87bc1566334e7d8f2'],
  ['private.ai_need_turn_status','42549927e66edf70cf67f5d82cef4530'],
  ['public.rpc_ai_complete_need_turn_v2_service','80775fc093f270838096ccc104a88668'],
 ]){
  const start=bootstrap.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');
  const end=bootstrap.indexOf('$function$;',start)+'$function$;'.length;
  await install(bootstrap.slice(start,end),md5);
 }
 const seedPrice=async()=>{
  await db.exec('delete from private.ai_need_turn_commands');
  await apply('Cena je 8000 RSD ukupno.',guard('Cena je 8000 RSD ukupno.',[
   proposal('need.price_mode','MY_PRICE','8000 RSD'),proposal('need.price_rsd',8000,'8000 RSD'),
   proposal('need.price_basis','TOTAL','ukupno')],await active()));
 };
 const command=async()=>{
  const key=randomUUID(),attempt=randomUUID();
  await db.query(`insert into private.ai_need_turn_commands(turn_id,conversation_id,state,attempt_id,account_id,
   client_request_id,request_hash,provider_dispatched,lease_expires_at,context_hash)
   values($1,$2,'PROCESSING',$3,$4,$5,
    encode(extensions.digest(convert_to(jsonb_build_object('conversationId',$2::uuid,'text','u evrima')::text,'UTF8'),'sha256'),'hex'),
    true,clock_timestamp()+interval '1 minute',private.ai_need_turn_context($2)->>'sha256')`,
   [randomUUID(),conversation,attempt,owner,key]);
  return {key,attempt};
 };
 const complete=async(cmd)=> (await one(`select public.rpc_ai_complete_need_turn_v2_service($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result`,
  [owner,conversation,cmd.key,cmd.attempt,'u evrima',euro.assistantMessage,euro.safety,json(edge.needTurnPersistenceProposals(euro))])).result;
 await t.test('owned completion retracts once; replay cannot remove a later valid RSD price',async()=>{
  await seedPrice();const cmd=await command();
  const receipt=await complete(cmd);assert.equal(receipt.state,'SUCCEEDED');
  assert.equal(receipt.receipt.proposedCount,0);
  assert.equal((await active()).some(f=>f.fact_key.startsWith('need.price_')),false);
  await apply('Cena je 9000 RSD ukupno.',guard('Cena je 9000 RSD ukupno.',[
   proposal('need.price_mode','MY_PRICE','9000 RSD'),proposal('need.price_rsd',9000,'9000 RSD'),
   proposal('need.price_basis','TOTAL','ukupno')],await active()));
  const facts=await active(),messages=(await one('select count(*)::int as n from public.ai_messages')).n;
  assert.deepEqual(await complete(cmd),receipt);
  assert.deepEqual(await active(),facts);
  assert.equal((await one('select count(*)::int as n from public.ai_messages')).n,messages);
 });
 for(const scenario of ['expired','stale-context','wrong-attempt','cancelled','not-dispatched'])await t.test(`owned ${scenario} completion cannot retract current price`,async()=>{
  await seedPrice();const cmd=await command();
  if(scenario==='expired')await db.exec("update private.ai_need_turn_commands set lease_expires_at=clock_timestamp()-interval '1 second'");
  if(scenario==='stale-context')await apply('4 osobe.',guard('4 osobe.',[proposal('need.people_needed',4,'4 osobe')],await active()));
  if(scenario==='wrong-attempt')cmd.attempt=randomUUID();
  if(scenario==='cancelled')await db.exec("update private.ai_need_turn_commands set state='FAILED',cancelled_at=clock_timestamp()");
  if(scenario==='not-dispatched')await db.exec('update private.ai_need_turn_commands set provider_dispatched=false');
  const facts=await active(),messages=(await one('select count(*)::int as n from public.ai_messages')).n;
  const result=await complete(cmd);assert.notEqual(result.state,'SUCCEEDED');
  assert.deepEqual(await active(),facts);
  assert.equal((await one('select count(*)::int as n from public.ai_messages')).n,messages);
 });
 await verifyPriceReviewBoundary({t,db,bootstrap,install,owner,conversation,apply,guard,proposal,active,seedPrice});
 await t.test('live validator supports TOTAL/PER_PERSON/HOURLY and retains FASTEST retirement',async()=>{
  for(const basis of ['TOTAL','PER_PERSON','HOURLY'])await db.query('select private.validate_need_v2_fact($1,$2::jsonb)',['need.price_basis',json(basis)]);
  await assert.rejects(db.query('select private.validate_need_v2_fact($1,$2::jsonb)',['need.price_mode',json('FASTEST')]),{code:'22023'});
 });
 await t.test('existing mismatch: Edge PER_HOUR strips price despite live SQL HOURLY support',async()=>{
  const hourly=guard('Cena je 1200 RSD na sat.',[proposal('need.price_mode','MY_PRICE','1200 RSD na sat'),
   proposal('need.price_rsd',1200,'1200 RSD na sat'),proposal('need.price_basis','HOURLY','na sat')],[],'PER_HOUR');
  assert.equal(hourly.safety,'CLARIFY');assert.equal(hourly.proposals.filter(p=>p.key.startsWith('need.price_')).length,0);
  assert.match(hourly.assistantMessage,/satnica još nije cena celog zadatka/);
 });
});
