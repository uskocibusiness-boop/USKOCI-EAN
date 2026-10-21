-- H2 read capability: closed H1 rows may open the deployed, owner-only H2 transcript. No hide or delete API.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $pre$ begin
  if to_regprocedure('public.rpc_list_owned_ai_history_v1(text,timestamptz,uuid,integer)') is null
    or to_regprocedure('public.rpc_list_owned_ai_history_messages_v1(text,uuid,uuid,integer)') is null
    or to_regprocedure('private.closure_assert_open(uuid,uuid)') is null
    or to_regclass('public.ai_conversations') is null
    or to_regclass('public.ai_structured_facts') is null
    or to_regclass('public.needs') is null
    or to_regclass('private.worker_ai_sessions') is null
    or to_regclass('private.worker_ai_reviews') is null
    or to_regclass('private.worker_ai_saves') is null
  then raise exception 'AI_HISTORY_H2_CAPABILITY_PREDECESSOR_REQUIRED'; end if;
end $pre$;

create or replace function public.rpc_list_owned_ai_history_v1(
  p_purpose text,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare
  owner_id uuid := auth.uid();
  result_rows jsonb := '[]'::jsonb;
  next_cursor jsonb := null;
  item record;
  row_count integer := 0;
  row_title text;
  title_source text;
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform private.closure_assert_open(owner_id);
  if p_purpose is null or p_purpose not in ('NEED_INTAKE','PROFILE')
  then raise exception 'AI_HISTORY_PURPOSE_INVALID' using errcode='22023'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 20
  then raise exception 'AI_HISTORY_LIMIT_INVALID' using errcode='22023'; end if;
  if (p_before_created_at is null) <> (p_before_id is null)
  then raise exception 'AI_HISTORY_CURSOR_INVALID' using errcode='22023'; end if;

  for item in
    select c.id, c.created_at, c.completed_at, c.retention_abandoned_at, c.status, c.bound_need_id,
      n.title as linked_title,
      (select f.fact_value #>> '{}'
       from public.ai_structured_facts f
       where p_purpose = 'NEED_INTAKE' and f.account_id = owner_id and f.conversation_id = c.id
         and f.fact_key = 'need.title' and f.fact_schema_version = 'NEED_FACT_V2'
         and f.value_type = 'TEXT' and f.scope = 'NEED_DRAFT' and f.status = 'CONFIRMED'
         and f.superseded_at is null and jsonb_typeof(f.fact_value) = 'string'
       order by f.created_at desc, f.id desc limit 1) as confirmed_title,
      (p_purpose = 'PROFILE' and exists(
        select 1 from private.worker_ai_reviews r
        join private.worker_ai_saves s on s.review_id = r.id and s.account_id = owner_id
        where r.conversation_id = c.id and r.account_id = owner_id)) as has_saved_profile
    from public.ai_conversations c
    left join public.needs n on n.id = c.bound_need_id and n.requester_account_id = owner_id
    where c.account_id = owner_id and c.purpose = p_purpose
      and (p_purpose <> 'NEED_INTAKE' or c.fact_schema_version = 'NEED_FACT_V2')
      and (p_purpose <> 'PROFILE' or exists(
        select 1 from private.worker_ai_sessions s
        where s.conversation_id = c.id and s.account_id = owner_id))
      and (p_before_created_at is null or (c.created_at, c.id) < (p_before_created_at, p_before_id))
    order by c.created_at desc, c.id desc
    limit p_limit + 1
  loop
    row_count := row_count + 1;
    if row_count > p_limit then exit; end if;
    row_title := null;
    title_source := 'GENERIC';
    if p_purpose = 'NEED_INTAKE' then
      row_title := nullif(btrim(item.linked_title), '');
      if row_title is not null and char_length(row_title) <= 140 and row_title !~ '[[:cntrl:]]' then
        title_source := 'LINKED_TASK_TITLE';
      else
        row_title := nullif(btrim(item.confirmed_title), '');
        if row_title is not null and char_length(row_title) <= 140 and row_title !~ '[[:cntrl:]]' then
          title_source := 'CONFIRMED_NEED_TITLE';
        end if;
      end if;
      if title_source <> 'GENERIC' then
        row_title := btrim(left(regexp_replace(row_title, '[[:space:]]+', ' ', 'g'), 80));
      else
        row_title := 'Razgovor o zadatku';
      end if;
    else
      -- Initial candidate inherits the current profile, so it cannot prove which services this session proposed.
      row_title := 'Razgovor o radnom profilu';
    end if;
    result_rows := result_rows || jsonb_build_array(jsonb_build_object(
      'conversationId', item.id,
      'createdAt', item.created_at,
      'closedAt', case when item.status = 'OPEN' then null
        else coalesce(item.completed_at, item.retention_abandoned_at) end,
      'status', item.status,
      'title', row_title,
      'titleSource', title_source,
      'hasSavedProfile', item.has_saved_profile,
      'visibility', 'VISIBLE',
      -- Both a new task conversation and a bound edit can resume by conversation ID;
      -- the owning screen still rechecks status, scope and revision before any write.
      'canContinue', item.status = 'OPEN',
      -- H2 is deployed and admitted by the owner-only closed transcript RPC.
      'canRead', item.status in ('COMPLETED','ABANDONED')
    ));
    next_cursor := jsonb_build_object('createdAt', item.created_at, 'conversationId', item.id);
  end loop;
  if row_count <= p_limit then next_cursor := null; end if;
  return jsonb_build_object(
    'schemaVersion', 'AI_HISTORY_V1', 'accountId', owner_id, 'purpose', p_purpose,
    'observedAt', statement_timestamp(), 'rows', result_rows,
    'nextCursor', next_cursor, 'authoritative', true
  );
end $f$;

revoke all on function public.rpc_list_owned_ai_history_v1(text,timestamptz,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_owned_ai_history_v1(text,timestamptz,uuid,integer)
  to authenticated;
comment on function public.rpc_list_owned_ai_history_v1(text,timestamptz,uuid,integer) is
  'Owner-scoped metadata with closed H2 text-read capability for NEED_FACT_V2 task and real worker PROFILE conversations. No hide/delete.';

notify pgrst, 'reload schema';
commit;
