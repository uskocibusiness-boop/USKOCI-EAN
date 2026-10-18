-- PASS reproduces the pre-fix bug through actual submitted/selected RPC bodies.
DO $f$
DECLARE kind text;app jsonb;agreement uuid;
BEGIN
 FOREACH kind IN ARRAY ARRAY['FLEXIBLE','REMOTE_ANYTIME'] LOOP
  PERFORM proof.reset(kind,statement_timestamp()-interval '1 hour');
  PERFORM proof.require(NOT private.need_search_time_admitted_v1(proof.id(201)),
   'BEFORE_SEARCH_ALREADY_REJECTS_EXPIRED_COMPLETION');
  PERFORM proof.require((private.match_detail_for_calendar_interval(proof.id(201),proof.id(102),null,null)->>'responseAllowed')::boolean,
   'BEFORE_ACTUAL_MANUAL_WRAPPER_IGNORES_EXPIRED_SOFT_TIME');
  app:=proof.submit();
  PERFORM proof.require(app->>'status'='SUBMITTED','BEFORE_EXPIRED_COMPLETION_APPLICATION_SUCCEEDS');
  PERFORM proof.require((SELECT candidate_state='SELECTABLE' FROM private.need_candidate_states_v5(proof.id(201))
   WHERE response_id=(app->>'responseId')::uuid),'BEFORE_EXPIRED_COMPLETION_STILL_SELECTABLE');
  agreement:=proof.select_response((app->>'responseId')::uuid);
  PERFORM proof.require(agreement IS NOT NULL AND (SELECT count(*)=1 FROM public.agreements),
   'BEFORE_EXPIRED_COMPLETION_NEW_AGREEMENT_SUCCEEDS');
 END LOOP;
 PERFORM proof.reset();
 app:=proof.submit();
 UPDATE public.needs SET revision=2,ends_at=statement_timestamp()-interval '1 hour' WHERE id=proof.id(201);
 UPDATE public.marketplace_responses SET status='STALE_REVIEW_REQUIRED' WHERE id=(app->>'responseId')::uuid;
 PERFORM proof.require(proof.reconfirm((app->>'responseId')::uuid)->>'status'='SUBMITTED',
   'BEFORE_EXPIRED_COMPLETION_RECONFIRM_SUCCEEDS');
END $f$;
SELECT 'task time consistency: pre-fix manual admission gap reproduced' AS result;

