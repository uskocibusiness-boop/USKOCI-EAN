-- H2 source candidate: a bounded, owner-only text transcript for closed H1 conversations.
-- Generated with Supabase CLI migration new; deliberately not applied to DEV or production.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $pre$ begin
  if to_regprocedure('public.rpc_list_owned_ai_history_v1(text,timestamptz,uuid,integer)') is null
    or to_regprocedure('private.closure_assert_open(uuid,uuid)') is null
    or to_regclass('public.ai_conversations') is null
    or to_regclass('public.ai_messages') is null
    or to_regclass('private.worker_ai_sessions') is null
  then raise exception 'AI_HISTORY_H2_PREDECESSOR_REQUIRED'; end if;
end $pre$;

create function public.rpc_list_owned_ai_history_messages_v1(
  p_purpose text,
  p_conversation_id uuid,
  p_before_message_id uuid default null,
  p_limit integer default 50
) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare
  owner_id uuid := auth.uid();
  conversation_status text;
  before_sequence bigint;
  result_rows jsonb := '[]'::jsonb;
  next_before_message_id uuid := null;
  item record;
  row_count integer := 0;
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform private.closure_assert_open(owner_id);
  if p_purpose is null or p_purpose not in ('NEED_INTAKE','PROFILE')
  then raise exception 'AI_HISTORY_PURPOSE_INVALID' using errcode='22023'; end if;
  if p_conversation_id is null
  then raise exception 'AI_HISTORY_CONVERSATION_INVALID' using errcode='22023'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 50
  then raise exception 'AI_HISTORY_LIMIT_INVALID' using errcode='22023'; end if;

  -- SECURITY DEFINER bypasses RLS. Check the account and canonical H1 membership
  -- explicitly on every page; legacy task records and sessionless PROFILEs stay out.
  select c.status into conversation_status
  from public.ai_conversations c
  where c.id = p_conversation_id and c.account_id = owner_id and c.purpose = p_purpose
    and (p_purpose <> 'NEED_INTAKE' or c.fact_schema_version = 'NEED_FACT_V2')
    and (p_purpose <> 'PROFILE' or exists(
      select 1 from private.worker_ai_sessions s
      where s.conversation_id = c.id and s.account_id = owner_id))
  for share of c;
  if not found then raise exception 'AI_HISTORY_NOT_FOUND' using errcode='42501'; end if;
  if conversation_status not in ('COMPLETED','ABANDONED')
  then raise exception 'AI_HISTORY_NOT_CLOSED' using errcode='42501'; end if;

  -- The global identity sequence is internal only. A cursor must name an owned
  -- message in this exact conversation; foreign and unknown IDs fail alike.
  if p_before_message_id is not null then
    select m.sequence_no into before_sequence
    from public.ai_messages m
    where m.id = p_before_message_id and m.account_id = owner_id
      and m.conversation_id = p_conversation_id
      and m.role in ('USER','ASSISTANT');
    if not found then raise exception 'AI_HISTORY_CURSOR_INVALID' using errcode='22023'; end if;
  end if;

  for item in
    select m.id, m.role, m.body, m.created_at
    from public.ai_messages m
    where m.account_id = owner_id and m.conversation_id = p_conversation_id
      and m.role in ('USER','ASSISTANT')
      and (before_sequence is null or m.sequence_no < before_sequence)
    order by m.sequence_no desc
    limit p_limit + 1
  loop
    row_count := row_count + 1;
    if row_count > p_limit then exit; end if;
    result_rows := result_rows || jsonb_build_array(jsonb_build_object(
      'id', item.id, 'role', item.role, 'body', item.body, 'createdAt', item.created_at
    ));
    next_before_message_id := item.id;
  end loop;
  if row_count <= p_limit then next_before_message_id := null; end if;
  return jsonb_build_object(
    'schemaVersion', 'AI_HISTORY_MESSAGES_V1', 'accountId', owner_id,
    'purpose', p_purpose, 'conversationId', p_conversation_id,
    'status', conversation_status, 'observedAt', statement_timestamp(),
    'rows', result_rows, 'hasMore', row_count > p_limit,
    'nextBeforeMessageId', next_before_message_id, 'authoritative', true
  );
end $f$;

revoke all on function public.rpc_list_owned_ai_history_messages_v1(text,uuid,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_owned_ai_history_messages_v1(text,uuid,uuid,integer)
  to authenticated;
comment on function public.rpc_list_owned_ai_history_messages_v1(text,uuid,uuid,integer) is
  'Owner-only, closed NEED_FACT_V2 or worker PROFILE AI text transcript; 50+1 descending internal sequence, opaque owned message ID cursor. No write, hide or deletion authority.';

notify pgrst, 'reload schema';
commit;
