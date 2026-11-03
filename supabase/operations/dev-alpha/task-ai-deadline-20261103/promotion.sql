BEGIN;SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'TASK_DEADLINE_CONTEXT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"6603130dcd5df2f0493668e318eee0caffe4c7c249e0f15d6b108537caf2cbe9","source":"da67d3b605b7d5b7e3af8d3264bc55aa87d7249c61436e3ef9d17d5791237a81","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'TASK_DEADLINE_CLOSURE_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)') AND md5(pg_get_functiondef(oid))='34c30e54765bccbfe7b3e58a949001d2' AND to_jsonb(p)-'prosrc'='{"oid":"21446","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_open_need_edit_conversation_v2","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','public.rpc_ai_open_need_edit_conversation_v2(uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('private.validate_need_v2_fact(text,jsonb)') AND md5(pg_get_functiondef(oid))='20e2800046e49187eb96349d9b329e2e' AND to_jsonb(p)-'prosrc'='{"oid":"22219","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"validate_need_v2_fact","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"2278","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_key","p_value"],"proargtypes":["25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','private.validate_need_v2_fact(text,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('public.rpc_prepare_ai_task_review(uuid,timestamp with time zone,jsonb)') AND md5(pg_get_functiondef(oid))='fc5c940f842293a57bc97acebfa39e38' AND to_jsonb(p)-'prosrc'='{"oid":"22903","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_ai_task_review","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_response_deadline","p_location"],"proargtypes":["2950","1184","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 3802 :consttypmod -1 :constcollid 0 :constlen -1 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":2}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','public.rpc_prepare_ai_task_review(uuid,timestamp with time zone,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamp with time zone,jsonb)') AND md5(pg_get_functiondef(oid))='497715aad00ef148251045ac59ff22ef' AND to_jsonb(p)-'prosrc'='{"oid":"30872","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_ai_task_review_taxonomy","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_response_deadline","p_location"],"proargtypes":["2950","1184","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 3802 :consttypmod -1 :constcollid 0 :constlen -1 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":2}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamp with time zone,jsonb)';END IF;
 IF to_regprocedure('private.ai_task_response_deadline_v1(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'TASK_DEADLINE_ALREADY_PRESENT';END IF;
IF to_regprocedure('public.rpc_prepare_ai_task_review_deadline(uuid,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'TASK_DEADLINE_ALREADY_PRESENT';END IF;
IF to_regprocedure('public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'TASK_DEADLINE_ALREADY_PRESENT';END IF;
 IF EXISTS(SELECT 1 FROM private.need_fact_registry WHERE fact_key='need.response_deadline') THEN RAISE EXCEPTION 'TASK_DEADLINE_ALREADY_REGISTERED';END IF;
 END $guard$;
INSERT INTO private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner) VALUES('need.response_deadline','NEED_FACT_V2','OBJECT',false,'PUBLIC',true,'needs.response_deadline');
CREATE OR REPLACE FUNCTION private.validate_need_v2_fact(p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if p_key='need.response_deadline' then
    if p_value is null or jsonb_typeof(p_value) is distinct from 'object' then
      raise exception 'RESPONSE_DEADLINE_FACT_INVALID' using errcode='22023';
    end if;
    if p_value='{"kind":"NONE"}'::jsonb then return; end if;
    if p_value->>'kind'<>'AT' or not (p_value ?& array['kind','at'])
      or p_value-array['kind','at']<>'{}'::jsonb
      or jsonb_typeof(p_value->'at')<>'string'
      or (p_value->>'at') !~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-4]):[0-5][0-9])$'
      or (right(p_value->>'at',6) ~ '^[+-]14:' and right(p_value->>'at',2)<>'00')
    then raise exception 'RESPONSE_DEADLINE_FACT_INVALID' using errcode='22023'; end if;
    begin perform (p_value->>'at')::timestamptz;
    exception when others then raise exception 'RESPONSE_DEADLINE_FACT_INVALID' using errcode='22023'; end;
    return;
  end if;
  if p_key='need.handoff' then
    if not private.taxonomy_handoff_valid_v1(p_value) then
      raise exception 'HANDOFF_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;
  if p_key='need.resolved_location' then
    if p_value is null or p_value='null'::jsonb or private.normalize_resolved_location(p_value,
      p_value#>>'{binding,taskCountryCode}',p_value#>'{binding,geography}',p_value#>>'{binding,exactAddress}') is distinct from p_value then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    return;
  end if;
  if p_key='need.task_country_code' then
    if p_value#>>'{}' is distinct from private.require_location_country(p_value) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;

  -- A TIMESTAMPTZ fact must carry the exact ISO 8601 shape the client decoder accepts, so the
  -- server cannot store a value that discards the whole review envelope when it is read. The
  -- pattern is the one in src/data/serverReceipt.ts timestamp(); the two must stay identical.
  if exists(select 1 from private.need_fact_registry
             where fact_key=p_key and schema_version='NEED_FACT_V2' and value_type='TIMESTAMPTZ') then
    if jsonb_typeof(p_value) is distinct from 'string'
      or (p_value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
      raise exception 'V2_FACT_TIMESTAMP_SHAPE_INVALID' using errcode='22023', detail=p_key;
    end if;
  end if;

  perform private.validate_need_v2_fact_pre_country(p_key,p_value);
end;
$function$;
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

  -- Returning an existing row must retain the closure boundary of INSERT.
  perform private.closure_assert_open(v_uid);

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

  -- A repeated open is recovery of the same current edit, not a new AI job.
  -- Existing legacy duplicates with real messages outrank empty seeded copies.
  -- The task lock serializes openers. NOWAIT avoids a need/conversation lock
  -- inversion with a simultaneous turn/review; contention must not create a copy.
  select c.id into v_conversation_id
    from public.ai_conversations c
   where c.account_id=v_uid and c.bound_need_id=v_need.id
     and c.purpose='NEED_INTAKE' and c.fact_schema_version='NEED_FACT_V2'
     and c.status='OPEN' and c.completed_at is null and c.retention_abandoned_at is null
     and c.need_edit_base_fingerprint is not null
     and c.need_edit_base_fingerprint=private.need_edit_base_marker(v_need.id)
     and not exists (
       select 1 from private.ai_task_reviews r
       join private.ai_task_review_commands command on command.review_id=r.id
       where r.conversation_id=c.id
     )
   order by (select max(m.sequence_no) from public.ai_messages m
             where m.conversation_id=c.id and m.account_id=v_uid) desc nulls last,
            c.created_at desc,c.id desc
   limit 1 for update of c nowait;
  if v_conversation_id is not null then
    return jsonb_build_object('conversationId',v_conversation_id,'needId',v_need.id,
      'revision',v_need.revision,'status',v_need.status,'authoritative',true);
  end if;

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
      when 'need.response_deadline' then
        if v_need.response_deadline is not null then
          v_value:=jsonb_build_object('kind','AT','at',to_jsonb(v_need.response_deadline)#>>'{}');
          v_display:='Prijave do '||(to_jsonb(v_need.response_deadline)#>>'{}');
        end if;
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
CREATE FUNCTION private.ai_task_response_deadline_v1(p_conversation_id uuid)
 RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE u uuid:=auth.uid(); c public.ai_conversations; fact jsonb; deadline timestamptz;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 PERFORM private.closure_assert_open(u);
 LOCK TABLE private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs IN SHARE MODE;
 SELECT * INTO c FROM public.ai_conversations WHERE id=p_conversation_id FOR UPDATE;
 IF NOT FOUND OR c.account_id<>u THEN RAISE EXCEPTION 'TASK_REVIEW_NOT_FOUND' USING errcode='42501'; END IF;
 IF c.status<>'OPEN' OR c.purpose<>'NEED_INTAKE' OR c.fact_schema_version<>'NEED_FACT_V2'
 THEN RAISE EXCEPTION 'TASK_REVIEW_NOT_EDITABLE' USING errcode='55000'; END IF;
 SELECT value->'value' INTO fact FROM jsonb_array_elements(public.rpc_ai_need_review_v2(c.id)->'facts')
 WHERE value->>'key'='need.response_deadline' AND value->>'status'<>'UNKNOWN';
 IF fact IS NOT NULL THEN
  PERFORM private.validate_need_v2_fact('need.response_deadline',fact);
  IF fact->>'kind'='AT' THEN deadline:=(fact->>'at')::timestamptz; END IF;
 END IF;
 IF deadline IS NOT NULL AND deadline<=clock_timestamp()
 THEN RAISE EXCEPTION 'RESPONSE_DEADLINE_INVALID' USING errcode='22023'; END IF;
 RETURN deadline;
END;
$function$;
CREATE FUNCTION public.rpc_prepare_ai_task_review_deadline(p_conversation_id uuid,p_location jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT public.rpc_prepare_ai_task_review(p_conversation_id,private.ai_task_response_deadline_v1(p_conversation_id),p_location);
$function$;
CREATE FUNCTION public.rpc_prepare_ai_task_review_deadline_taxonomy(p_conversation_id uuid,p_location jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT public.rpc_prepare_ai_task_review_taxonomy(p_conversation_id,private.ai_task_response_deadline_v1(p_conversation_id),p_location);
$function$;
REVOKE ALL ON FUNCTION private.ai_task_response_deadline_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
revoke all on function public.rpc_prepare_ai_task_review_deadline(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_prepare_ai_task_review_deadline(uuid,jsonb) to authenticated;
revoke all on function public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb) to authenticated;


DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170006' THEN RAISE EXCEPTION 'TASK_DEADLINE_CONTEXT';END IF;
 IF jsonb_build_object('source',private.closure_source_digest_v5(),'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),'erasure_binding',private.closure_erasure_binding_v5()) IS DISTINCT FROM '{"schema":"6603130dcd5df2f0493668e318eee0caffe4c7c249e0f15d6b108537caf2cbe9","source":"da67d3b605b7d5b7e3af8d3264bc55aa87d7249c61436e3ef9d17d5791237a81","erasure":"0935fabefce8549bb2d42dcb3be7cf8c3796ceb5108e87b569f678b09670568b","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb THEN RAISE EXCEPTION 'TASK_DEADLINE_CLOSURE_DRIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)') AND md5(pg_get_functiondef(oid))='95167e0037e4b1a2fc73b6e793f277c8' AND to_jsonb(p)-'prosrc'='{"oid":"21446","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_ai_open_need_edit_conversation_v2","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','public.rpc_ai_open_need_edit_conversation_v2(uuid)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('private.validate_need_v2_fact(text,jsonb)') AND md5(pg_get_functiondef(oid))='f9fc13f4bffc87350285de788acb530a' AND to_jsonb(p)-'prosrc'='{"oid":"22219","proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"validate_need_v2_fact","prorows":0,"pronargs":2,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"2278","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_key","p_value"],"proargtypes":["25","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','private.validate_need_v2_fact(text,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('public.rpc_prepare_ai_task_review(uuid,timestamp with time zone,jsonb)') AND md5(pg_get_functiondef(oid))='fc5c940f842293a57bc97acebfa39e38' AND to_jsonb(p)-'prosrc'='{"oid":"22903","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_ai_task_review","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_response_deadline","p_location"],"proargtypes":["2950","1184","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 3802 :consttypmod -1 :constcollid 0 :constlen -1 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":2}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','public.rpc_prepare_ai_task_review(uuid,timestamp with time zone,jsonb)';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE oid=to_regprocedure('public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamp with time zone,jsonb)') AND md5(pg_get_functiondef(oid))='497715aad00ef148251045ac59ff22ef' AND to_jsonb(p)-'prosrc'='{"oid":"30872","proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_prepare_ai_task_review_taxonomy","prorows":0,"pronargs":3,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_conversation_id","p_response_deadline","p_location"],"proargtypes":["2950","1184","3802"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 3802 :consttypmod -1 :constcollid 0 :constlen -1 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":2}'::jsonb) THEN RAISE EXCEPTION 'TASK_DEADLINE_PREDECESSOR_DRIFT:%','public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamp with time zone,jsonb)';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('private.ai_task_response_deadline_v1(uuid)') AND md5(pg_get_functiondef(oid))='cca748c3272bf076bbb23cec411b1c65' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}') THEN RAISE EXCEPTION 'TASK_DEADLINE_POSTIMAGE';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_prepare_ai_task_review_deadline(uuid,jsonb)') AND md5(pg_get_functiondef(oid))='2b442c5523852cdda69c2c55cd024851' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'TASK_DEADLINE_POSTIMAGE';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_prepare_ai_task_review_deadline_taxonomy(uuid,jsonb)') AND md5(pg_get_functiondef(oid))='502680828987812575b2f47ff7e03899' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres}') THEN RAISE EXCEPTION 'TASK_DEADLINE_POSTIMAGE';END IF;
 IF (SELECT to_jsonb(r) FROM private.need_fact_registry r WHERE fact_key='need.response_deadline') IS DISTINCT FROM '{"fact_key":"need.response_deadline","schema_version":"NEED_FACT_V2","value_type":"OBJECT","required_for_draft":false,"privacy_class":"PUBLIC","material":true,"target_owner":"needs.response_deadline"}'::jsonb THEN RAISE EXCEPTION 'TASK_DEADLINE_REGISTRY_DRIFT';END IF;
 END $guard$;
NOTIFY pgrst,'reload schema';COMMIT;
