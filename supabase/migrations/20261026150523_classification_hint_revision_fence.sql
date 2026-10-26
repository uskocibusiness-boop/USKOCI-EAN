begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $gate$ begin
  if md5(pg_get_functiondef('public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text)'::regprocedure)) <> '2da7df02b126517c42b8e86e3d2a3d67'
    then raise exception 'CHR01_PREIMAGE_CHANGED: store hint'; end if;
  if md5(pg_get_functiondef('public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint)'::regprocedure)) <> '04e7ccade9f74fc9eb64d30f17d9258c'
    then raise exception 'CHR01_PREIMAGE_CHANGED: get hint'; end if;
  if md5(pg_get_functiondef('public.rpc_taxonomy_consume_turn_hint_service(uuid,text)'::regprocedure)) <> '6cb020a4b1ea40279e1f94ea371e4138'
    then raise exception 'CHR01_PREIMAGE_CHANGED: consume hint'; end if;
  if to_regprocedure('private.classification_conversation_revision_v1(uuid)') is not null
    or to_regprocedure('public.rpc_taxonomy_consume_turn_hint_revision_service(uuid,bigint,text)') is not null
    then raise exception 'CHR01_PREIMAGE_CHANGED: revision contract exists'; end if;
end $gate$;

CREATE FUNCTION private.classification_conversation_revision_v1(cid uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
 select case c.purpose
  when 'PROFILE' then (select s.revision::bigint from private.worker_ai_sessions s
    where s.conversation_id=c.id and s.account_id=c.account_id)
  when 'NEED_INTAKE' then (select coalesce(max(m.sequence_no),0)::bigint from public.ai_messages m
    where m.conversation_id=c.id and m.account_id=c.account_id)
  else null end
 from public.ai_conversations c
 where c.id=cid and c.status='OPEN' and c.purpose in('PROFILE','NEED_INTAKE');
$function$;
REVOKE ALL ON FUNCTION private.classification_conversation_revision_v1(uuid) FROM public,anon,authenticated,service_role;

CREATE INDEX classification_turn_hints_revision_open_idx
 ON private.classification_turn_hints(conversation_id,draft_revision,created_at DESC)
 WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_store_classification_turn_hint_service(
 p_conversation_id uuid,p_draft_revision bigint,p_service text,p_mode text,p_ambiguity_prompt text,p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
declare v_current bigint;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'TAXONOMY_HINT_DENIED' using errcode='42501'; end if;
 if p_conversation_id is null or p_draft_revision is null or p_draft_revision<0
  or p_service is null or char_length(btrim(p_service)) not between 1 and 200
  or p_mode is not null and p_mode not in('ON_SITE','REMOTE')
  or p_ambiguity_prompt is null or char_length(btrim(p_ambiguity_prompt)) not between 8 and 600
  or p_reason is not null and char_length(p_reason)>300
 then raise exception 'TAXONOMY_HINT_INVALID' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('classification-hint:'||p_conversation_id::text,0));
 v_current:=private.classification_conversation_revision_v1(p_conversation_id);
 if v_current is null then return jsonb_build_object('stored',false,'reason','CONVERSATION_NOT_OPEN'); end if;
 if v_current<>p_draft_revision then return jsonb_build_object('stored',false,'reason','STALE_REVISION','currentRevision',v_current); end if;
 delete from private.classification_turn_hints where created_at<clock_timestamp()-interval '7 days';
 delete from private.classification_turn_hints
  where conversation_id=p_conversation_id and consumed_at is null and draft_revision=p_draft_revision;
 insert into private.classification_turn_hints(conversation_id,draft_revision,service,mode,ambiguity_prompt,reason)
 values(p_conversation_id,p_draft_revision,btrim(p_service),p_mode,btrim(p_ambiguity_prompt),nullif(btrim(p_reason),''));
 return jsonb_build_object('stored',true,'draftRevision',p_draft_revision);
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_get_unconsumed_turn_hint_service(p_conversation_id uuid,p_draft_revision bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
declare v_row private.classification_turn_hints%rowtype;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'TAXONOMY_HINT_DENIED' using errcode='42501'; end if;
 if p_conversation_id is null or p_draft_revision is null or p_draft_revision<0 then
  raise exception 'TAXONOMY_HINT_INVALID' using errcode='22023'; end if;
 if private.classification_conversation_revision_v1(p_conversation_id) is distinct from p_draft_revision then return null; end if;
 select * into v_row from private.classification_turn_hints
  where conversation_id=p_conversation_id and draft_revision=p_draft_revision
    and consumed_at is null and created_at>clock_timestamp()-interval '1 day'
  order by created_at desc,id desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('conversationId',v_row.conversation_id,'draftRevision',v_row.draft_revision,
  'service',v_row.service,'mode',v_row.mode,'ambiguityPrompt',v_row.ambiguity_prompt,'reason',v_row.reason);
end $function$;

CREATE FUNCTION public.rpc_taxonomy_consume_turn_hint_revision_service(
 p_conversation_id uuid,p_draft_revision bigint,p_service text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
declare v_count integer;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'TAXONOMY_HINT_DENIED' using errcode='42501'; end if;
 if p_conversation_id is null or p_draft_revision is null or p_draft_revision<0 then
  raise exception 'TAXONOMY_HINT_INVALID' using errcode='22023'; end if;
 update private.classification_turn_hints set consumed_at=clock_timestamp()
  where conversation_id=p_conversation_id and draft_revision=p_draft_revision and consumed_at is null
    and (p_service is null or service is not distinct from p_service);
 get diagnostics v_count=row_count;
 return jsonb_build_object('consumed',v_count,'draftRevision',p_draft_revision);
end $function$;

REVOKE ALL ON FUNCTION public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text) FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint) FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_consume_turn_hint_service(uuid,text) FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_taxonomy_consume_turn_hint_revision_service(uuid,bigint,text) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_store_classification_turn_hint_service(uuid,bigint,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_get_unconsumed_turn_hint_service(uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_taxonomy_consume_turn_hint_revision_service(uuid,bigint,text) TO service_role;

commit;
