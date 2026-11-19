-- SOURCE-ONLY candidate. Not a migration and not applied to DEV.
-- Requires the selectable_application_count fast path to be promoted first.
-- Home replaces the complete rpc_list_my_tasks() read with one bounded summary:
-- exact list counts, the first six rows in the existing global created_at/id order,
-- and the first readable draft updated within the existing seven-day prompt window.
-- Keep the client mapper's current Home preview predicate and never infer a count from
-- the bounded preview. rpc_read_task remains the single task-card projection authority.

DO $preflight$
begin
  if to_regprocedure('public.rpc_home_owned_tasks_summary_v1()') is not null then
    raise exception 'HOME_TASK_SUMMARY_ALREADY_EXISTS';
  end if;
  if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.rpc_read_task(uuid)')
    and p.proowner=(select oid from pg_roles where rolname='postgres') and not p.prosecdef
    and p.provolatile='s' and p.proconfig=array['search_path=pg_catalog']
    and has_function_privilege('authenticated',p.oid,'EXECUTE')) then
    raise exception 'HOME_TASK_SUMMARY_READ_TASK_DRIFT';
  end if;
  if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.rpc_storage_account_open()')
    and p.proowner=(select oid from pg_roles where rolname='postgres') and p.prosecdef
    and p.provolatile='v' and p.proconfig=array['search_path=pg_catalog']
    and has_function_privilege('authenticated',p.oid,'EXECUTE')) then
    raise exception 'HOME_TASK_SUMMARY_ACCOUNT_GUARD_DRIFT';
  end if;
  if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.covered_slots(public.needs)')
    and p.proowner=(select oid from pg_roles where rolname='postgres') and p.prosecdef
    and p.provolatile='s' and p.proconfig=array['search_path=public, pg_temp']
    and has_function_privilege('authenticated',p.oid,'EXECUTE')) then
    raise exception 'HOME_TASK_SUMMARY_COVERED_SLOTS_DRIFT';
  end if;
  if not exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.selectable_application_count(public.needs)')
    and p.proowner=(select oid from pg_roles where rolname='postgres') and p.prosecdef
    and p.provolatile='s' and p.proconfig=array['search_path=pg_catalog']
    and md5(p.prosrc)='9d3aaa8ff15bb19bfed8b6a99fa86e14'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')) then
    raise exception 'HOME_TASK_SUMMARY_SELECTABLE_COUNT_DRIFT';
  end if;
  if not exists (select 1 from pg_class c where c.oid='public.needs'::regclass and c.relrowsecurity) then
    raise exception 'HOME_TASK_SUMMARY_NEEDS_RLS_DRIFT';
  end if;
end;
$preflight$;

CREATE FUNCTION public.rpc_home_owned_tasks_summary_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_as_of timestamptz := date_trunc('milliseconds', statement_timestamp());
  v_counts jsonb;
  v_items jsonb;
  v_fresh_draft jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if not public.rpc_storage_account_open() then
    raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501';
  end if;

  with owned as materialized (
    select n.id, n.status, n.created_at, n.updated_at, n.title, n.required_slots,
      case when n.status in ('PUBLISHED','SELECTION','ACTIVE')
        then public.covered_slots(n) else 0 end as covered_slots,
      case when n.status in ('PUBLISHED','SELECTION','ACTIVE')
        then coalesce(public.selectable_application_count(n),0) else 0 end as selectable_count,
      regexp_replace(btrim(translate(coalesce(n.title,''), U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', repeat(' ',19))), '[[:space:]]+', ' ', 'g') as normalized_title
    from public.needs n
    where n.requester_account_id = v_uid
  ), classified as materialized (
    select o.*,
      case
        when length(o.normalized_title) > 1 and (
          (left(o.normalized_title,1) = '"' and right(o.normalized_title,1) = '"') or
          (left(o.normalized_title,1) = '„' and right(o.normalized_title,1) = '“') or
          (left(o.normalized_title,1) = '“' and right(o.normalized_title,1) = '”') or
          (left(o.normalized_title,1) = '''' and right(o.normalized_title,1) = '''')
        ) then btrim(substr(o.normalized_title,2,length(o.normalized_title)-2))
        else o.normalized_title
      end <> '' as readable_title,
      (o.updated_at is null or date_trunc('milliseconds', o.updated_at) >= v_as_of - interval '7 days') as fresh_draft
    from owned o
  ), counts as (
    select jsonb_build_object(
      'total', count(*),
      'active', count(*) filter (where status in ('PUBLISHED','SELECTION','ACTIVE')),
      'drafts', count(*) filter (where status = 'DRAFT'),
      'history', count(*) filter (where status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')),
      'waiting', count(*) filter (where status in ('PUBLISHED','SELECTION','ACTIVE')
        and greatest(1, required_slots) - greatest(0, least(greatest(1, required_slots), covered_slots)) > 0
        and selectable_count > 0)
    ) as value
    from classified
  ), preview_ids as (
    select id, created_at
    from classified
    where (status = 'PUBLISHED' and selectable_count = 0)
       or (status = 'SELECTION' and covered_slots = 0 and selectable_count = 0)
       or (status = 'DRAFT' and fresh_draft and readable_title)
    order by created_at desc, id desc
    limit 6
  ), fresh_draft_id as (
    select id, created_at
    from classified
    where status = 'DRAFT' and fresh_draft and readable_title
    order by created_at desc, id desc
    limit 1
  ), requested_ids as (
    select id, created_at from preview_ids
    union
    select id, created_at from fresh_draft_id
  ), documents as materialized (
    select r.id, r.created_at,
      public.rpc_read_task(r.id) || jsonb_build_object('sortAt',r.created_at) as document
    from requested_ids r
  )
  select
    (select value from counts),
    coalesce((select jsonb_agg(d.document order by d.created_at desc,d.id desc)
      from documents d join preview_ids p using (id)), '[]'::jsonb),
    (select d.document from documents d join fresh_draft_id f using (id))
  into v_counts, v_items, v_fresh_draft;

  return jsonb_build_object(
    'schemaVersion', 1,
    'accountId', v_uid,
    'asOf', v_as_of,
    'counts', v_counts,
    'items', v_items,
    'freshDraft', v_fresh_draft
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.rpc_home_owned_tasks_summary_v1() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_home_owned_tasks_summary_v1() TO authenticated;
