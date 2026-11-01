BEGIN;
SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';SET LOCAL lock_timeout='3s';
SET LOCAL uskoci.r07.attention_dev_target='leqcwgzvjsxugfgzdmth';
DO $r07_revert_pre$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r07.attention_dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.application_calendar_conflict_v1(uuid)') AND p.oid=32140
 AND md5(pg_get_functiondef(p.oid))='d0709018ab2179a7b3decc9c4832fbd8'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"application_calendar_conflict_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_response_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.application_calendar_conflict_v1(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_binding_v5()') AND p.oid=24189
 AND md5(pg_get_functiondef(p.oid))='6c1b9fa576fcba9754f19be2ecdf0fb5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"closure_erasure_binding_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_erasure_binding_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_program_digest_v5()') AND p.oid=24205
 AND md5(pg_get_functiondef(p.oid))='e11cc0b1eb33e63d182247424e4027bd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_erasure_program_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_erasure_program_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_schema_digest_v5_139()') AND p.oid=23565
 AND md5(pg_get_functiondef(p.oid))='5165a1c4787401db76b0a5cc894731e0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_schema_digest_v5_139","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_schema_digest_v5_139()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()') AND p.oid=23194
 AND md5(pg_get_functiondef(p.oid))='3754d150d83b916422e184a50e5bd126'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_source_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_source_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.data_export_policy_binding()') AND p.oid=22343
 AND md5(pg_get_functiondef(p.oid))='d4f5d842858a4c4d69d580db20687a53'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"data_export_policy_binding","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.data_export_policy_binding()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.my_application_state(text,integer,integer,text,boolean)') AND p.oid=24408
 AND md5(pg_get_functiondef(p.oid))='c9a5468bc93ebfd125427a3b49965ce0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"my_application_state","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_raw_status","p_submitted_revision","p_current_revision","p_need_status","p_has_agreement"],"proargtypes":["25","23","23","25","16"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"i","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.my_application_state(text,integer,integer,text,boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.own_application_rows(uuid)') AND p.oid=26585
 AND md5(pg_get_functiondef(p.oid))='71ccf5a27143c653e13f9b38bd69a082'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"own_application_rows","prorows":1000,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":true,"prosecdef":true,"prorettype":"2249","prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t"],"proargnames":["p_account","application_id","sort_at","need_id","current_need_revision","submitted_against_need_revision","current_version","raw_response_status","price_rsd","covered_slots","scope_note","submitted_at","title","description","raw_need_status","approximate_city","approximate_area","starts_at","ends_at","schedule_kind","execution_location_mode","task_timezone","price_mode","price_basis","required_slots","agreement_id","application_state","application_rank"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":["2950","2950","1184","2950","23","23","23","25","23","23","25","1184","25","25","25","25","25","1184","1184","25","25","25","25","25","23","2950","25","23"],"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.own_application_rows(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()') AND p.oid=22438
 AND md5(pg_get_functiondef(p.oid))='b638ceff5865a966d56de63e94b9dbfd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"retention_ai_source_ready","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.retention_ai_source_ready()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_closure_api_guard()') AND p.oid=23208
 AND md5(pg_get_functiondef(p.oid))='5058f4c9de3e084477ca618031c53252'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_closure_api_guard","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"2278","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_closure_api_guard()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)') AND p.oid=26586
 AND md5(pg_get_functiondef(p.oid))='db36c4ef547a5734ddb5550a7c2a05f9'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_applications_page","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_scope","p_limit","p_before_at","p_before_id","p_before_rank"],"proargtypes":["25","23","1184","2950","23"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull false :location -1 :constvalue 7 [ 28 0 0 0 65 76 76 ]} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 30 0 0 0 0 0 0 0 ]} {CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 2950 :consttypmod -1 :constcollid 0 :constlen 16 :constbyval false :constisnull true :location -1 :constvalue <>} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull true :location -1 :constvalue <>})","pronargdefaults":5}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_applications()') AND p.oid=21652
 AND md5(pg_get_functiondef(p.oid))='ec33f90bb74bab2bf9a50fe879df21a4'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_applications","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_applications()'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r07_revert_pre$;
CREATE TEMP TABLE r07_attention_prior_functions ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','rls_private');
CREATE OR REPLACE FUNCTION private.own_application_rows(p_account uuid)
 RETURNS TABLE(application_id uuid, sort_at timestamp with time zone, need_id uuid, current_need_revision integer, submitted_against_need_revision integer, current_version integer, raw_response_status text, price_rsd integer, covered_slots integer, scope_note text, submitted_at timestamp with time zone, title text, description text, raw_need_status text, approximate_city text, approximate_area text, starts_at timestamp with time zone, ends_at timestamp with time zone, schedule_kind text, execution_location_mode text, task_timezone text, price_mode text, price_basis text, required_slots integer, agreement_id uuid, application_state text, application_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  -- EX-04 S2 (B10): the ONE builder of "my applications". Every column of rpc_list_my_applications() and of the page, plus the facts of the task that the card needs
  -- (full term, execution mode, price mode and basis, people), the one state function, the one rank. The page and the counts read it, so a count can never differ from the list.
  select r.id, coalesce(r.submitted_at, r.created_at), r.need_id, n.revision, r.submitted_against_need_revision, r.current_version, r.status,
         r.price_rsd, r.covered_slots, r.scope_note, r.submitted_at,
         n.title, n.description, n.status, n.approximate_city, n.approximate_area, n.starts_at, n.ends_at, n.schedule_kind, n.execution_location_mode, n.task_timezone,
         n.mode, n.price_basis, n.required_slots,
         ag.id, st.state,
         case when st.state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0 when st.state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1 else 2 end
  from public.marketplace_responses r
  join public.needs n on n.id = r.need_id
  left join lateral (select a.id from public.agreements a where a.selected_response_id = r.id order by a.created_at desc, a.id desc limit 1) ag on true
  cross join lateral (select private.my_application_state(r.status, r.submitted_against_need_revision, n.revision, n.status,
    ag.id is not null and not exists (select 1 from public.agreements x where x.id = ag.id and x.status = 'CANCELLED')) as state) st
  where r.worker_account_id = p_account and r.status <> 'DRAFT'
$function$;
CREATE OR REPLACE FUNCTION public.rpc_list_my_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  with own_rows as (
    select
      r.id as application_id,
      r.need_id,
      n.revision as current_need_revision,
      r.submitted_against_need_revision,
      r.current_version,
      r.status as raw_response_status,
      r.price_rsd,
      r.covered_slots,
      r.scope_note,
      r.submitted_at,
      n.title,
      n.description,
      n.status as raw_need_status,
      n.approximate_city,
      n.approximate_area,
      n.starts_at,
      (
        select a.id
          from public.agreements a
         where a.selected_response_id = r.id
         order by a.created_at desc, a.id desc
         limit 1
      ) as agreement_id
    from public.marketplace_responses r
    join public.needs n on n.id = r.need_id
    where r.worker_account_id = v_actor
      and r.status <> 'DRAFT'
  ), mapped as (
    select
      o.*,
      case
        -- PKG-029b (deep read 7.49): an application whose Agreement was cancelled is no longer chosen.
        when (o.agreement_id is not null and not exists (select 1 from public.agreements ag
                where ag.id = o.agreement_id and ag.status = 'CANCELLED'))
             or o.raw_response_status = 'SELECTED'
          then 'SELECTED'
        when o.raw_response_status = 'WITHDRAWN'
          then 'WITHDRAWN'
        when o.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
             or o.submitted_against_need_revision is distinct from o.current_need_revision
          then 'STALE_REVIEW_REQUIRED'
        when o.raw_response_status in ('NOT_SELECTED','EXPIRED')
             or o.raw_need_status not in ('PUBLISHED','SELECTION')
          then 'CLOSED'
        when o.raw_response_status = 'VIEWED'
          then 'VIEWED'
        when o.raw_response_status = 'SHORTLISTED'
          then 'SHORTLISTED'
        when o.raw_response_status in ('SUBMITTED','DELIVERED')
          then 'SUBMITTED'
        else 'CLOSED'
      end as application_state
    from own_rows o
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'applicationId', m.application_id,
        'needId', m.need_id,
        'needRevision', m.current_need_revision,
        'submittedNeedRevision', m.submitted_against_need_revision,
        'version', m.current_version,
        'state', m.application_state,
        'title', m.title,
        'description', m.description,
        'approximateCity', nullif(btrim(m.approximate_city), ''),
        'approximateArea', nullif(btrim(m.approximate_area), ''),
        'startsAt', m.starts_at,
        'priceRsd', m.price_rsd,
        'coveredSlots', m.covered_slots,
        'scopeNote', coalesce(m.scope_note, ''),
        'agreementId', m.agreement_id,
        'requiresStaleReview', m.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
        'canWithdraw',
          m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and m.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and m.submitted_against_need_revision = m.current_need_revision
          and m.raw_need_status in ('PUBLISHED','SELECTION')
          and m.agreement_id is null,
        'submittedAt', m.submitted_at
      )
      order by
        case
          when m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0
          when m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1
          else 2
        end,
        m.submitted_at desc nulls last,
        m.application_id
    ),
    '[]'::jsonb
  )
  into v_result
  from mapped m;

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'applicationId')::uuid)) order by ord), '[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);

  return v_result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_list_my_applications_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_before_rank integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
  v_counts jsonb;
  v_scope_rank integer;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_at is null) <> (p_before_id is null) or (p_before_at is null) <> (p_before_rank is null)
     or (p_before_rank is not null and p_before_rank not in (0, 1, 2)) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ATTENTION','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;
  -- ATTENTION = what waits for the applicant (rank 0), ACTIVE = a still-open application (rank 1), HISTORY = the rest (rank 2): the three sections of the screen.
  v_scope_rank := case p_scope when 'ATTENTION' then 0 when 'ACTIVE' then 1 when 'HISTORY' then 2 end;
  if p_before_rank is not null and v_scope_rank is not null and p_before_rank <> v_scope_rank then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  -- EX-04 S2 (B10 Moje prijave). The order is the one rpc_list_my_applications() has always had: what waits for me first, then the open ones, then the rest, each
  -- newest submission first, the id as the last tie-breaker. The keyset carries all three values of that order (rank, sortAt, id), so a page boundary can fall anywhere,
  -- inside a tie or between two sections, and no application is skipped or repeated for a reason of the order itself.
  with own as materialized (
    select * from private.own_application_rows(v_actor)
  ), page as (
    select o.* from own o
    where (v_scope_rank is null or o.application_rank = v_scope_rank)
      and (p_before_at is null
           or o.application_rank > p_before_rank
           or (o.application_rank = p_before_rank and (o.sort_at < p_before_at or (o.sort_at = p_before_at and o.application_id > p_before_id))))
    order by o.application_rank, o.sort_at desc, o.application_id
    limit p_limit + 1
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'applicationId', p.application_id, 'id', p.application_id, 'sortAt', p.sort_at,
        'needId', p.need_id, 'needRevision', p.current_need_revision,
        'submittedNeedRevision', p.submitted_against_need_revision, 'version', p.current_version,
        'state', p.application_state, 'title', p.title, 'description', p.description,
        'approximateCity', nullif(btrim(p.approximate_city), ''), 'approximateArea', nullif(btrim(p.approximate_area), ''),
        'startsAt', p.starts_at, 'endsAt', p.ends_at, 'scheduleKind', p.schedule_kind,
        'executionLocationMode', p.execution_location_mode, 'taskTimezone', p.task_timezone,
        'priceMode', p.price_mode, 'priceBasis', p.price_basis, 'requiredSlots', p.required_slots,
        'priceRsd', p.price_rsd, 'coveredSlots', p.covered_slots,
        'scopeNote', coalesce(p.scope_note, ''), 'agreementId', p.agreement_id,
        'requiresStaleReview', p.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', p.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
        'canWithdraw',
          p.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and p.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and p.submitted_against_need_revision = p.current_need_revision
          and p.raw_need_status in ('PUBLISHED','SELECTION')
          and p.agreement_id is null,
        'submittedAt', p.submitted_at
      ) order by p.application_rank, p.sort_at desc, p.application_id), '[]'::jsonb) from page p),
    -- The four counts of the tabs ride with the first page; a later page does not pay for them again.
    case when p_before_at is null then (select jsonb_build_object(
        'total', count(*),
        'attention', count(*) filter (where o.application_rank = 0),
        'active', count(*) filter (where o.application_rank = 1),
        'finished', count(*) filter (where o.application_rank = 2)) from own o) end
  into v_items, v_counts;

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'applicationId')::uuid)) order by ord), '[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'counts', v_counts,
    'asOf', statement_timestamp());
end
$function$;
DO $delta$ BEGIN
 IF EXISTS(SELECT 1 FROM r07_attention_prior_functions before FULL JOIN
 (SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private','rls_private')) after USING(oid)
 WHERE before.oid IS NULL OR after.oid IS NULL OR
 CASE WHEN before.oid IN (26585,21652,26586) THEN before.attributes-'prosrc' IS DISTINCT FROM after.attributes-'prosrc'
 ELSE before.attributes IS DISTINCT FROM after.attributes END)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_UNRELATED_FUNCTION_DELTA'; END IF;
 END; $delta$;
DO $r07_revert_post$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('uskoci.r07.attention_dev_target',true) IS DISTINCT FROM 'leqcwgzvjsxugfgzdmth'
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CONTEXT_REFUSED'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.application_calendar_conflict_v1(uuid)') AND p.oid=32140
 AND md5(pg_get_functiondef(p.oid))='d0709018ab2179a7b3decc9c4832fbd8'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"application_calendar_conflict_v1","prorows":0,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_response_id"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.application_calendar_conflict_v1(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_binding_v5()') AND p.oid=24189
 AND md5(pg_get_functiondef(p.oid))='6c1b9fa576fcba9754f19be2ecdf0fb5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"closure_erasure_binding_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_erasure_binding_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_erasure_program_digest_v5()') AND p.oid=24205
 AND md5(pg_get_functiondef(p.oid))='e11cc0b1eb33e63d182247424e4027bd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_erasure_program_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_erasure_program_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_schema_digest_v5_139()') AND p.oid=23565
 AND md5(pg_get_functiondef(p.oid))='5165a1c4787401db76b0a5cc894731e0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_schema_digest_v5_139","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_schema_digest_v5_139()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()') AND p.oid=23194
 AND md5(pg_get_functiondef(p.oid))='3754d150d83b916422e184a50e5bd126'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"closure_source_digest_v5","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.closure_source_digest_v5()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.data_export_policy_binding()') AND p.oid=22343
 AND md5(pg_get_functiondef(p.oid))='d4f5d842858a4c4d69d580db20687a53'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"data_export_policy_binding","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.data_export_policy_binding()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.my_application_state(text,integer,integer,text,boolean)') AND p.oid=24408
 AND md5(pg_get_functiondef(p.oid))='c9a5468bc93ebfd125427a3b49965ce0'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"my_application_state","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":false,"prorettype":"25","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_raw_status","p_submitted_revision","p_current_revision","p_need_status","p_has_agreement"],"proargtypes":["25","23","23","25","16"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"i","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.my_application_state(text,integer,integer,text,boolean)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.own_application_rows(uuid)') AND p.oid=26585
 AND md5(pg_get_functiondef(p.oid))='e7547da52f5846c0fb7e88ae1f1766c5'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"own_application_rows","prorows":1000,"pronargs":1,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":true,"prosecdef":true,"prorettype":"2249","prosqlbody":null,"prosupport":"-","proargmodes":["i","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t","t"],"proargnames":["p_account","application_id","sort_at","need_id","current_need_revision","submitted_against_need_revision","current_version","raw_response_status","price_rsd","covered_slots","scope_note","submitted_at","title","description","raw_need_status","approximate_city","approximate_area","starts_at","ends_at","schedule_kind","execution_location_mode","task_timezone","price_mode","price_basis","required_slots","agreement_id","application_state","application_rank"],"proargtypes":["2950"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":["2950","2950","1184","2950","23","23","23","25","23","23","25","1184","25","25","25","25","25","1184","1184","25","25","25","25","25","23","2950","25","23"],"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.own_application_rows(uuid)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()') AND p.oid=22438
 AND md5(pg_get_functiondef(p.oid))='b638ceff5865a966d56de63e94b9dbfd'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"14","proname":"retention_ai_source_ready","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"16","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"18078","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','private.retention_ai_source_ready()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_closure_api_guard()') AND p.oid=23208
 AND md5(pg_get_functiondef(p.oid))='5058f4c9de3e084477ca618031c53252'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_closure_api_guard","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"2278","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"v","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_closure_api_guard()'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)') AND p.oid=26586
 AND md5(pg_get_functiondef(p.oid))='5cefaaea7a837cfaf5707cf5d42bd765'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_applications_page","prorows":0,"pronargs":5,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":["p_scope","p_limit","p_before_at","p_before_id","p_before_rank"],"proargtypes":["25","23","1184","2950","23"],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":"({CONST :consttype 25 :consttypmod -1 :constcollid 100 :constlen -1 :constbyval false :constisnull false :location -1 :constvalue 7 [ 28 0 0 0 65 76 76 ]} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location -1 :constvalue 4 [ 30 0 0 0 0 0 0 0 ]} {CONST :consttype 1184 :consttypmod -1 :constcollid 0 :constlen 8 :constbyval true :constisnull true :location -1 :constvalue <>} {CONST :consttype 2950 :consttypmod -1 :constcollid 0 :constlen 16 :constbyval false :constisnull true :location -1 :constvalue <>} {CONST :consttype 23 :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull true :location -1 :constvalue <>})","pronargdefaults":5}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)'; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.rpc_list_my_applications()') AND p.oid=21652
 AND md5(pg_get_functiondef(p.oid))='e323f8f5d4cc97e141be657074e416b8'
 AND to_jsonb(p)-'prosrc'-'oid'='{"proacl":["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"],"probin":null,"procost":100,"prokind":"f","prolang":"13619","proname":"rpc_list_my_applications","prorows":0,"pronargs":0,"proowner":"16388","proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prorettype":"3802","prosqlbody":null,"prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,"proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,"pronamespace":"2200","proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb)
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_FUNCTION_DRIFT:%','public.rpc_list_my_applications()'; END IF;
IF (SELECT jsonb_build_object('source',private.closure_source_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'schema',private.closure_schema_digest_v5_139(),'erasure',private.closure_erasure_program_digest_v5(),
 'source_ready',private.retention_ai_source_ready(),'erasure_binding',private.closure_erasure_binding_v5(),
 'export_binding',private.data_export_policy_binding())) IS DISTINCT FROM '{"schema":"df82c2cb19edfa86ee092fb6fdc97528b82a2482f05ae64c45939268346af84c","source":"0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56","erasure":"5e121db0bd932accd4b007f80098db67ebc97e99f29e0b76f06378de0f9c4d96","certificate":"0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb","source_ready":false,"export_binding":null,"erasure_binding":null}'::jsonb
 THEN RAISE EXCEPTION 'R07_ATTENTION_DEV_CLOSURE_STATE_CHANGED'; END IF;
END; $r07_revert_post$;
NOTIFY pgrst,'reload schema';

COMMIT;
