DO $r03_pre$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r03.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R03_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_binding_v5()') AND p.oid=24189
 AND md5(pg_get_functiondef(p.oid))='6c1b9fa576fcba9754f19be2ecdf0fb5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"closure_erasure_binding_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_erasure_binding_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_program_digest_v5()') AND p.oid=24205
 AND md5(pg_get_functiondef(p.oid))='e11cc0b1eb33e63d182247424e4027bd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_erasure_program_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_erasure_program_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_schema_digest_v5_139()') AND p.oid=23565
 AND md5(pg_get_functiondef(p.oid))='5165a1c4787401db76b0a5cc894731e0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_schema_digest_v5_139","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_schema_digest_v5_139()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()') AND p.oid=23194
 AND md5(pg_get_functiondef(p.oid))='3754d150d83b916422e184a50e5bd126'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_source_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_source_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.data_export_policy_binding()') AND p.oid=22343
 AND md5(pg_get_functiondef(p.oid))='d4f5d842858a4c4d69d580db20687a53'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"data_export_policy_binding","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.data_export_policy_binding()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.need_candidate_states_v5(uuid)') AND p.oid=25184
 AND md5(pg_get_functiondef(p.oid))='f87f872758b5caa618ab96864fe96ade'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"need_candidate_states_v5","prorows":1000,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":true,"prosecdef":true,"prorettype":"2249","prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t"],"proargnames":["p_need_id","response_id","candidate_state"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":["2950","2950","25"],"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.need_candidate_states_v5(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.own_task_counts(uuid)') AND p.oid=26483
 AND md5(pg_get_functiondef(p.oid))='4d0829799f882b287f7ec8f5c65d6917'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"own_task_counts","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["a"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.own_task_counts(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()') AND p.oid=22438
 AND md5(pg_get_functiondef(p.oid))='b638ceff5865a966d56de63e94b9dbfd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"retention_ai_source_ready","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.retention_ai_source_ready()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.covered_slots(public.needs)') AND p.oid=20877
 AND md5(pg_get_functiondef(p.oid))='72ea2b656f8820051ea944e127f49c41'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"covered_slots","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=public, pg_temp"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["n"],"proargtypes":["17658"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.covered_slots(public.needs)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)') AND p.oid=24409
 AND md5(pg_get_functiondef(p.oid))='cd6e58cca7deb8f3d6cd69888635c252'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_needs_page","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_scope","p_limit","p_before_at","p_before_id"],"proargtypes":["25","23","1184","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull false :location -1 :constvalue 7 [ 28 0 0 0 65 76 76 ]} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 30 0 0 0 0 0 0 0 ]} {CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 2950 :consttypmod -1 :constcollid 0 :constlen 16 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":4}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_tasks()') AND p.oid=25284
 AND md5(pg_get_functiondef(p.oid))='1d66fe6d246a74b28cd8694bdbd59a65'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_tasks","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_tasks()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_read_task(uuid)') AND p.oid=25283
 AND md5(pg_get_functiondef(p.oid))='abd68dacd327eeb6bd65956ed38db661'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_read_task","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_read_task(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_storage_account_open()') AND p.oid=23212
 AND md5(pg_get_functiondef(p.oid))='04337720544e1f60b8ba635ea01e4814'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_storage_account_open","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_storage_account_open()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.selectable_application_count(public.needs)') AND p.oid=25187
 AND md5(pg_get_functiondef(p.oid))='1e7a5030bb534aa2fd7874e6ae5fa8af'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"selectable_application_count","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["n"],"proargtypes":["17658"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.selectable_application_count(public.needs)'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R03_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r03_pre$;
CREATE TEMP TABLE r03_reader_prior_functions ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','rls_private');
CREATE OR REPLACE FUNCTION public.rpc_list_my_needs_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','DRAFTS','HISTORY','WAITING') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;

  -- EX-04 S1 (A09). Every item IS the rpc_read_task document that rpc_list_my_tasks returns, so the card, the price basis and the selectable count
  -- cannot drift from the ordinary read; sortAt is the keyset value. The scopes are the client's own sections: Aktivni = PUBLISHED, SELECTION, ACTIVE;
  -- Nacrti = DRAFT; Istorija = COMPLETED, CANCELLED, EXPIRED, ARCHIVED; WAITING = an active task with a place left and a selectable application.
  with page as materialized (
    select n.created_at, n.id
    from public.needs n
    where n.requester_account_id = v_uid
      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))
      and case p_scope
            when 'ALL' then true
            when 'ACTIVE' then n.status in ('PUBLISHED','SELECTION','ACTIVE')
            when 'DRAFTS' then n.status = 'DRAFT'
            when 'HISTORY' then n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
            else n.status in ('PUBLISHED','SELECTION','ACTIVE')
              and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0
              and coalesce(public.selectable_application_count(n), 0) > 0
          end
    order by n.created_at desc, n.id desc
    limit p_limit + 1
  )
  select coalesce(jsonb_agg(public.rpc_read_task(p.id) || jsonb_build_object('sortAt', p.created_at) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v_items from page p;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    -- The five counts of the tabs ride with the first page; a later page does not pay for them again.
    'counts', case when p_before_at is null then private.own_task_counts(v_uid) end,
    'asOf', statement_timestamp());
end
$function$;
-- No business/Auth fixture writes, no existing account, provider or push call.
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
  with page as materialized (
    select n.created_at, n.id
    from public.needs n
    where n.requester_account_id = v_uid
      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))
      and case p_scope
            when 'ALL' then true
            when 'ACTIVE' then n.status in ('PUBLISHED','SELECTION','ACTIVE')
            when 'DRAFTS' then n.status = 'DRAFT'
            when 'HISTORY' then n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
            else n.status in ('PUBLISHED','SELECTION','ACTIVE')
              and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0
              and coalesce(public.selectable_application_count(n), 0) > 0
          end
    order by n.created_at desc, n.id desc
    limit p_limit + 1
  )
  select coalesce(jsonb_agg(public.rpc_read_task(p.id) || jsonb_build_object('sortAt', p.created_at) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v_items from page p;


 SELECT jsonb_build_object('items',v_items,'hasMore',false,'counts',private.own_task_counts(v_uid),'asOf',statement_timestamp()) INTO v_result;
 IF v_result->'items'<>'[]'::jsonb OR v_result->'counts'<>'{"total":0,"active":0,"drafts":0,"history":0,"waiting":0}'::jsonb
 THEN RAISE EXCEPTION 'R03_EMPTY_PAGE_INVALID'; END IF;
END; $empty$;
DO $delta$ BEGIN
 IF EXISTS(SELECT 1 FROM r03_reader_prior_functions before FULL JOIN
 (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private','rls_private')) after USING(oid)
 WHERE before.oid IS NULL OR after.oid IS NULL OR
 CASE WHEN before.oid=24409 THEN before.attributes-'prosrc' IS DISTINCT FROM after.attributes-'prosrc'
 ELSE before.attributes IS DISTINCT FROM after.attributes END)
 THEN RAISE EXCEPTION 'R03_DEV_UNRELATED_FUNCTION_DELTA'; END IF;
 END; $delta$;
DO $r03_post$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r03.dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R03_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_binding_v5()') AND p.oid=24189
 AND md5(pg_get_functiondef(p.oid))='6c1b9fa576fcba9754f19be2ecdf0fb5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"closure_erasure_binding_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_erasure_binding_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_program_digest_v5()') AND p.oid=24205
 AND md5(pg_get_functiondef(p.oid))='e11cc0b1eb33e63d182247424e4027bd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_erasure_program_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_erasure_program_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_schema_digest_v5_139()') AND p.oid=23565
 AND md5(pg_get_functiondef(p.oid))='5165a1c4787401db76b0a5cc894731e0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_schema_digest_v5_139","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_schema_digest_v5_139()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()') AND p.oid=23194
 AND md5(pg_get_functiondef(p.oid))='3754d150d83b916422e184a50e5bd126'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_source_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.closure_source_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.data_export_policy_binding()') AND p.oid=22343
 AND md5(pg_get_functiondef(p.oid))='d4f5d842858a4c4d69d580db20687a53'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"data_export_policy_binding","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.data_export_policy_binding()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.need_candidate_states_v5(uuid)') AND p.oid=25184
 AND md5(pg_get_functiondef(p.oid))='f87f872758b5caa618ab96864fe96ade'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"need_candidate_states_v5","prorows":1000,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":true,"prosecdef":true,"prorettype":"2249","prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t"],"proargnames":["p_need_id","response_id","candidate_state"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":["2950","2950","25"],"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.need_candidate_states_v5(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.own_task_counts(uuid)') AND p.oid=26483
 AND md5(pg_get_functiondef(p.oid))='4d0829799f882b287f7ec8f5c65d6917'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"own_task_counts","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["a"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.own_task_counts(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()') AND p.oid=22438
 AND md5(pg_get_functiondef(p.oid))='b638ceff5865a966d56de63e94b9dbfd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"retention_ai_source_ready","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','private.retention_ai_source_ready()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.covered_slots(public.needs)') AND p.oid=20877
 AND md5(pg_get_functiondef(p.oid))='72ea2b656f8820051ea944e127f49c41'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"covered_slots","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=public, pg_temp"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["n"],"proargtypes":["17658"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.covered_slots(public.needs)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)') AND p.oid=24409
 AND md5(pg_get_functiondef(p.oid))='dae2f244c3ab670656faa14b6802dfdf'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_needs_page","prorows":0,"pronargs":4,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_scope","p_limit","p_before_at","p_before_id"],"proargtypes":["25","23","1184","2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull false :location -1 :constvalue 7 [ 28 0 0 0 65 76 76 ]} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 30 0 0 0 0 0 0 0 ]} {CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 2950 :consttypmod -1 :constcollid 0 :constlen 16 :constbyval false :constisnull true :location -1 :constvalue <>})","pronargdefaults":4}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_tasks()') AND p.oid=25284
 AND md5(pg_get_functiondef(p.oid))='1d66fe6d246a74b28cd8694bdbd59a65'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_tasks","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_tasks()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_read_task(uuid)') AND p.oid=25283
 AND md5(pg_get_functiondef(p.oid))='abd68dacd327eeb6bd65956ed38db661'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","service_role=X/postgres","authenticated=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_read_task","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_need_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_read_task(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_storage_account_open()') AND p.oid=23212
 AND md5(pg_get_functiondef(p.oid))='04337720544e1f60b8ba635ea01e4814'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_storage_account_open","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.rpc_storage_account_open()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.selectable_application_count(public.needs)') AND p.oid=25187
 AND md5(pg_get_functiondef(p.oid))='1e7a5030bb534aa2fd7874e6ae5fa8af'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"selectable_application_count","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"23","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["n"],"proargtypes":["17658"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R03_DEV_FUNCTION_DRIFT:%','public.selectable_application_count(public.needs)'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R03_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r03_post$;
NOTIFY pgrst,'reload schema';
