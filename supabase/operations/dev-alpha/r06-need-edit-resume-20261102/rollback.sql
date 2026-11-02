BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='25s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'R06_EDIT_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)') AND md5(pg_get_functiondef(p.oid))='34c30e54765bccbfe7b3e58a949001d2' AND to_jsonb(p)-'prosrc'='{"oid":"21446","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_open_need_edit_conversation_v2","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_EDIT_FUNCTION_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.need_edit_base_marker(uuid)'))) IS DISTINCT FROM '3cbd47dd7bfe9c177dd459967160c578' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.guard_need_edit_base_marker()'))) IS DISTINCT FROM '903f80c9b2ac6f65cb20a2aa5c423d89' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_assert_open(uuid,uuid)'))) IS DISTINCT FROM '1d0e22224d546c4756f216acfe103246' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.guard_retention_ai_origin()'))) IS DISTINCT FROM 'cbaa2a0ca12bcf431bd61cea7be01d78' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.need_publication_fingerprint_snapshot(uuid)'))) IS DISTINCT FROM '0e5a7addc917e24cb688bd280c023cdd' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"6603130dcd5df2f0493668e318eee0caffe4c7c249e0f15d6b108537caf2cbe9","source":"da67d3b605b7d5b7e3af8d3264bc55aa87d7249c61436e3ef9d17d5791237a81","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'R06_EDIT_CLOSURE_DRIFT';END IF;
 END $guard$;
CREATE TEMP TABLE r06_edit_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private');
CREATE OR REPLACE FUNCTION public.rpc_ai_open_need_edit_conversation_v2(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_need public.needs%rowtype;
  v_sensitive public.need_sensitive%rowtype;
  v_geo jsonb;
  v_conditions text[]:='{}'::text[];
  v_conversation_id uuid;
  v_key text;
  v_type text;
  v_value jsonb;
  v_display text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null then raise exception 'NEED_ID_REQUIRED' using errcode='22004'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  select * into v_sensitive from public.need_sensitive where need_id=v_need.id for share;
  select g.public_topology into v_geo from public.need_geography g where g.need_id=v_need.id;
  select coalesce(d.critical_conditions,'{}'::text[]) into v_conditions
    from public.need_requirement_details d where d.need_id=v_need.id;
  if not found then v_conditions:='{}'::text[]; end if;

  if v_geo is null then
    if v_need.execution_location_mode='REMOTE' then
      v_geo:=jsonb_build_object('mode','REMOTE','start',null,'end',null,'waypoints','[]'::jsonb,'serviceArea',null);
    else
      raise exception 'NEED_EDIT_GEOGRAPHY_NOT_READY' using errcode='P0001';
    end if;
  end if;
  perform private.validate_need_v2_fact('need.task_geography',v_geo);

  insert into public.ai_conversations(account_id,purpose,status,bound_need_id,fact_schema_version)
  values(v_uid,'NEED_INTAKE','OPEN',v_need.id,'NEED_FACT_V2')
  returning id into v_conversation_id;

  for v_key,v_type in
    select fact_key,value_type from private.need_fact_registry
     where schema_version='NEED_FACT_V2'
     order by fact_key
  loop
    v_value:=null;
    v_display:=null;

    case v_key
      when 'need.title' then v_value:=to_jsonb(v_need.title); v_display:=v_need.title;
      when 'need.description' then v_value:=to_jsonb(v_need.description); v_display:=v_need.description;
      when 'need.category' then v_value:=to_jsonb(v_need.category); v_display:=v_need.category;
      when 'need.price_mode' then v_value:=to_jsonb(v_need.mode); v_display:=v_need.mode;
      when 'need.price_rsd' then
        if v_need.requester_price_rsd is not null then v_value:=to_jsonb(v_need.requester_price_rsd); v_display:=v_need.requester_price_rsd::text||' RSD'; end if;
      when 'need.schedule_kind' then v_value:=to_jsonb(v_need.schedule_kind); v_display:=v_need.schedule_kind;
      when 'need.starts_at' then
        if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at); v_display:=to_jsonb(v_need.starts_at)#>>'{}'; end if;
      when 'need.ends_at' then
        if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at); v_display:=to_jsonb(v_need.ends_at)#>>'{}'; end if;
      when 'need.price_basis' then
        -- PKG-027e: an edit keeps what the price is for; without this the edit writer clears it.
        if v_need.mode='MY_PRICE' and v_need.price_basis is not null then
          v_value:=to_jsonb(v_need.price_basis);
          v_display:=case v_need.price_basis when 'PER_PERSON' then 'Po osobi' else 'Ukupno' end;
        end if;
      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;
      when 'need.required_skills' then v_value:=to_jsonb(coalesce(v_need.required_skills,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_skills,'{}'::text[]),', ');
      when 'need.required_tools' then v_value:=to_jsonb(coalesce(v_need.required_tools,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_tools,'{}'::text[]),', ');
      when 'need.required_vehicles' then v_value:=to_jsonb(coalesce(v_need.required_vehicles,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_vehicles,'{}'::text[]),', ');
      when 'need.required_licenses' then v_value:=to_jsonb(coalesce(v_need.required_licenses,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_licenses,'{}'::text[]),', ');
      when 'need.minimum_experience_years' then
        if v_need.minimum_experience_years is not null then v_value:=to_jsonb(v_need.minimum_experience_years); v_display:=v_need.minimum_experience_years::text; end if;
      when 'need.verified_identity_required' then v_value:=to_jsonb(coalesce(v_need.verified_identity_required,false)); v_display:=case when coalesce(v_need.verified_identity_required,false) then 'Da' else 'Ne' end;
      when 'need.task_country_code' then
        if v_need.task_country_code is not null then v_value:=to_jsonb(v_need.task_country_code); v_display:=v_need.task_country_code; end if;
      when 'need.task_geography' then v_value:=v_geo; v_display:=coalesce(v_geo->'start'->>'label',v_geo->'serviceArea'->>'label',v_geo->>'mode');
      when 'need.handoff' then
        if v_need.execution_location_mode='REMOTE' then
          select d.handoff into v_value from public.need_requirement_details d where d.need_id=v_need.id;
          v_display:=private.taxonomy_handoff_display_v1(v_value);
        end if;
      when 'need.critical_conditions' then
        select array_remove(v_conditions,'Predaja: '||private.taxonomy_handoff_display_v1(d.handoff))
          into v_conditions from public.need_requirement_details d where d.need_id=v_need.id;
        v_value:=to_jsonb(coalesce(v_conditions,'{}'::text[])); v_display:=array_to_string(v_conditions,', ');
      when 'need.public_photo_paths' then v_value:=to_jsonb(coalesce(v_need.public_photo_paths,'{}'::text[])); v_display:=case when cardinality(coalesce(v_need.public_photo_paths,'{}'::text[]))=0 then 'Bez fotografija' else cardinality(v_need.public_photo_paths)::text||' fotografija' end;
      when 'need.exact_address' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.exact_address),'') is not null then v_value:=to_jsonb(v_sensitive.exact_address); v_display:=v_sensitive.exact_address; end if;
      when 'need.access_notes' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.access_notes),'') is not null then v_value:=to_jsonb(v_sensitive.access_notes); v_display:=v_sensitive.access_notes; end if;
      else null;
    end case;

    if v_value is not null and v_value<>'null'::jsonb then
      perform private.validate_need_v2_fact(v_key,v_value);
      insert into public.ai_structured_facts(
        account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
        confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
        fact_schema_version,value_type,display_value
      ) values (
        v_uid,v_conversation_id,v_need.id,v_key,v_value,'CONFIRMED','SYSTEM_DERIVED','NEED_DRAFT',
        1,null,v_uid,statement_timestamp(),'NEED_FACT_V2',v_type,
        coalesce(nullif(left(v_display,1000),''),'—')
      );
    end if;
  end loop;

  -- Clone the already-confirmed private value last, after its public binding facts.
  -- Preserve the original human's provenance; do not manufacture a new confirmation.
  if v_sensitive.resolved_location is not null then
    if private.resolved_location_record_valid(v_sensitive.resolved_location,v_need.task_country_code,v_geo,
      v_sensitive.exact_address,v_uid) is distinct from true then
      raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
    insert into public.ai_structured_facts(account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(v_uid,v_conversation_id,v_need.id,'need.resolved_location',v_sensitive.resolved_location->'value','CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',
      1,null,(v_sensitive.resolved_location->>'confirmedByAccountId')::uuid,(v_sensitive.resolved_location->>'confirmedAt')::timestamptz,
      'NEED_FACT_V2','OBJECT','Potvrđene tačke: '||jsonb_array_length(v_sensitive.resolved_location#>'{value,points}')::text);
  end if;

  return jsonb_build_object(
    'conversationId',v_conversation_id,
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'authoritative',true
  );
end;
$function$;
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'R06_EDIT_CONTEXT_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)') AND md5(pg_get_functiondef(p.oid))='1a2c01d15767152735b34865fe8bbf44' AND to_jsonb(p)-'prosrc'='{"oid":"21446","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_open_need_edit_conversation_v2","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'R06_EDIT_FUNCTION_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.need_edit_base_marker(uuid)'))) IS DISTINCT FROM '3cbd47dd7bfe9c177dd459967160c578' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.guard_need_edit_base_marker()'))) IS DISTINCT FROM '903f80c9b2ac6f65cb20a2aa5c423d89' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.closure_assert_open(uuid,uuid)'))) IS DISTINCT FROM '1d0e22224d546c4756f216acfe103246' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.guard_retention_ai_origin()'))) IS DISTINCT FROM 'cbaa2a0ca12bcf431bd61cea7be01d78' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.need_publication_fingerprint_snapshot(uuid)'))) IS DISTINCT FROM '0e5a7addc917e24cb688bd280c023cdd' THEN RAISE EXCEPTION 'R06_EDIT_DEPENDENCY_DRIFT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"6603130dcd5df2f0493668e318eee0caffe4c7c249e0f15d6b108537caf2cbe9","source":"da67d3b605b7d5b7e3af8d3264bc55aa87d7249c61436e3ef9d17d5791237a81","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'R06_EDIT_CLOSURE_DRIFT';END IF;
 END $guard$;
DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r06_edit_functions b FULL JOIN (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','rls_private')) a USING(oid) WHERE b.oid IS NULL OR a.oid IS NULL OR CASE WHEN b.oid='public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure THEN b.attributes-'prosrc' IS DISTINCT FROM a.attributes-'prosrc' ELSE b.attributes IS DISTINCT FROM a.attributes END) THEN RAISE EXCEPTION 'R06_EDIT_UNRELATED_DELTA';END IF;END $delta$;
COMMIT;
