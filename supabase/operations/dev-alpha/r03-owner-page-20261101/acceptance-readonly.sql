BEGIN TRANSACTION READ ONLY;SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='25s';
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

SELECT 'R03_ACTUAL_PG_EMPTY_PROJECTION_PASS' result,false authenticated_positive_functional_acceptance,statement_timestamp() checked_at;ROLLBACK;