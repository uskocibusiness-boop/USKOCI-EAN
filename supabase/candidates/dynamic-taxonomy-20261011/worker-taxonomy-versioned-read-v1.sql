-- Gate A old-client compatible read. SOURCE ONLY, NOT DEPLOYED.
-- Old APKs cannot decode extra signed classification fields and must never
-- silently Save taxonomy grants they did not see. The existing private snapshot
-- selects ONLY legacy reviews (and saved receipts for those same reviews).
-- For a classified-only conversation, old clients get review:null,saved:null
-- while status/candidate remain readable and previously saved profiles persist.
-- Dedicated new read RPC returns the server-signed taxonomy review and its
-- matching Save receipt; no fabricated legacy consent, no additional UI approval.
BEGIN;
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
$function$;

CREATE OR REPLACE FUNCTION public.rpc_read_worker_ai_taxonomy(p_conversation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $read$
DECLARE v_document jsonb;v_review jsonb;v_saved jsonb;v_review_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.worker_ai_sessions
  WHERE conversation_id=p_conversation_id AND account_id=auth.uid())
 THEN RAISE EXCEPTION 'WORKER_AI_DENIED' USING errcode='42501'; END IF;
 v_document:=private.worker_ai_document(p_conversation_id);
 IF v_document IS NULL THEN RAISE EXCEPTION 'WORKER_AI_DENIED' USING errcode='42501'; END IF;
 SELECT r.envelope,r.id INTO v_review,v_review_id
 FROM private.worker_ai_reviews r
 WHERE r.conversation_id=p_conversation_id AND r.account_id=auth.uid()
   AND r.envelope ? 'classificationState'
 ORDER BY EXISTS(SELECT 1 FROM private.worker_ai_saves saved
   WHERE saved.review_id=r.id) DESC,r.created_at DESC,r.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN v_document; END IF;
 SELECT saved.receipt INTO v_saved FROM private.worker_ai_saves saved
 WHERE saved.review_id=v_review_id AND saved.account_id=auth.uid()
 ORDER BY saved.created_at DESC LIMIT 1;
 RETURN v_document||jsonb_build_object('review',v_review,'saved',v_saved);
END $read$;
REVOKE ALL ON FUNCTION public.rpc_read_worker_ai_taxonomy(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_read_worker_ai_taxonomy(uuid) TO authenticated;
COMMIT;
