CREATE OR REPLACE FUNCTION private.worker_ai_turn_document(tid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select jsonb_build_object('turnId',t.turn_id,'conversationId',t.conversation_id,'clientRequestId',t.client_request_id,
  'state',case when state='PROCESSING' and lease_expires_at<statement_timestamp() then 'UNKNOWN_OUTCOME' else state end,
  'attemptId',attempt_id,'retryAllowed',false,'authoritative',true)
 from private.worker_ai_turns t where turn_id=tid;
$function$
;

CREATE OR REPLACE FUNCTION private.worker_ai_document(cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','conversationId',s.conversation_id,'accountId',s.account_id,
  'profileId',s.profile_id,'status',c.status,'profileStatus',coalesce((select p.profile_status from public.app_profiles p where p.id=s.profile_id),'DRAFT'),
  'revision',s.revision,'candidate',s.candidate,'safety',s.safety,
  'stale',s.base_hash<>private.worker_ai_source_hash(s.account_id),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'body',m.body,'sequence',m.sequence_no) order by m.sequence_no)
    from (select * from public.ai_messages where conversation_id=cid order by sequence_no desc limit 100) m),'[]'::jsonb),
  'turn',(select private.worker_ai_turn_document(t.turn_id) from private.worker_ai_turns t where t.conversation_id=cid order by t.created_at desc,t.turn_id desc limit 1),
  'review',(select r.envelope from private.worker_ai_reviews r where r.conversation_id=cid AND NOT(r.envelope ? 'classificationState') order by
    exists(select 1 from private.worker_ai_saves z where z.review_id=r.id) desc,r.created_at desc,r.id desc limit 1),
  'saved',(select z.receipt from private.worker_ai_saves z join private.worker_ai_reviews r on r.id=z.review_id where r.conversation_id=cid AND NOT(r.envelope ? 'classificationState') limit 1))
 from private.worker_ai_sessions s join public.ai_conversations c on c.id=s.conversation_id and c.account_id=s.account_id and c.purpose='PROFILE'
 where s.conversation_id=cid;
$function$
;
