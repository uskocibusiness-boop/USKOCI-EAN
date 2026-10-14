-- Disposable PostgreSQL 16/17: safely retire implicit skill-to-capability
-- writer. Text survives, remote identity is not mistaken for an ON_SITE grant,
-- old rows are revoked on withdrawal, and re-addition alone grants NOTHING.
\set ON_ERROR_STOP on
DO $proof$
DECLARE
 own uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 cat uuid;remote_cat uuid;ans jsonb;total integer;
BEGIN
 SELECT id INTO STRICT cat FROM private.work_taxonomy_categories WHERE label='Krečenje zidova';
 SELECT id INTO STRICT remote_cat FROM private.work_taxonomy_categories WHERE label='Izrada prezentacija';
 SELECT count(*) INTO total FROM private.work_taxonomy_categories;
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,
  ARRAY['Krečenje zidova','Popravka retro sata','Izrada prezentacija']);
 IF (ans->>'assignedCount')::int<>0
   OR (ans->>'retainedExistingCategoryCount')::int<>2
   OR ans->>'newCapabilityAuthority'<>'NONE'
   OR ans->>'notificationAuthority'<>'NONE'
   OR ans->'unmappedSkillLabels'<>to_jsonb(ARRAY['Popravka retro sata'])
   OR (SELECT count(*) FROM private.work_taxonomy_categories)<>total
   OR EXISTS(SELECT 1 FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id=own)
 THEN RAISE EXCEPTION 'PROFILE_SYNC_GRANTED_OR_DROPPED_SERVICE'; END IF;
 IF (SELECT skills FROM public.app_profiles WHERE account_id=own)
 IS DISTINCT FROM ARRAY['Krečenje zidova','Popravka retro sata','Izrada prezentacija']
 THEN RAISE EXCEPTION 'SAFE_SYNC_LOST_HUMAN_SKILLS'; END IF;
 -- An existing signed permission is already in history. Profile Save must not
 -- update its timestamp, revive exclusions or invent an alternate mode.
 INSERT INTO private.work_taxonomy_worker_capabilities(
   worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
 VALUES(own,cat,statement_timestamp()-interval '1 hour',true,false,'WORKER_CONFIRMED'),
       (own,remote_cat,statement_timestamp()-interval '1 hour',false,false,'WORKER_CONFIRMED');
 INSERT INTO private.work_taxonomy_related_acceptances(worker_account_id,source_category_id)
 VALUES(own,cat);
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,
  ARRAY['Krečenje zidova','Popravka retro sata','Izrada prezentacija']);
 IF (ans->>'assignedCount')::int<>0 OR (ans->>'revokedCount')::int<>0 OR EXISTS(
  SELECT 1 FROM private.work_taxonomy_worker_capabilities
  WHERE worker_account_id=own AND excluded)
 THEN RAISE EXCEPTION 'UNCHANGED_SKILLS_REVOKED_EXISTING_CAPABILITIES'; END IF;
 -- Now withdraw all offered services. Old and REMOTE capabilities must both
 -- become inactive. No old related-offer opt-in may remain.
 UPDATE public.app_profiles SET skills='{}'::text[] WHERE account_id=own;
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,'{}'::text[]);
 IF (ans->>'assignedCount')::int<>0 OR (ans->>'revokedCount')::int<>2
  OR (ans->>'revokedRelatedAcceptances')::int<>1 OR EXISTS(
    SELECT 1 FROM private.work_taxonomy_worker_capabilities
    WHERE worker_account_id=own AND (NOT excluded OR allow_related_offers))
 THEN RAISE EXCEPTION 'SAFE_SYNC_DID_NOT_REVOKE'; END IF;
 -- Re-add via text only: cannot revive the old ON_SITE permission.
 UPDATE public.app_profiles SET skills=ARRAY['Krečenje zidova'] WHERE account_id=own;
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,ARRAY['Krečenje zidova']);
 IF (ans->>'assignedCount')::int<>0 OR (ans->>'retainedExistingCategoryCount')::int<>1
 OR EXISTS(
  SELECT 1 FROM private.work_taxonomy_worker_capabilities
  WHERE worker_account_id=own AND (NOT excluded OR allow_related_offers))
 THEN RAISE EXCEPTION 'PROFILE_SYNC_READD_GRANTED_CAPABILITY'; END IF;
 BEGIN
  PERFORM private.sync_worker_skills_to_taxonomy_capabilities(own,ARRAY['Izrada prezentacija']);
  RAISE EXCEPTION 'UNEXPECTED_SKILLS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TAXONOMY_PROFILE_SKILLS_MISMATCH' THEN RAISE; END IF;
 END;
 IF position('rpc_taxonomy_ensure_path_service' in
  pg_get_functiondef('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'::regprocedure))>0
 OR position('INSERT INTO private.work_taxonomy_worker_capabilities' in
  pg_get_functiondef('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'::regprocedure))>0
 OR position('requeue_open_needs_for_worker_v5(' in
  pg_get_functiondef('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'::regprocedure))>0
 THEN RAISE EXCEPTION 'LEGACY_IMPLICIT_GRANT_OR_DISPATCH_STILL_PRESENT'; END IF;
 RAISE NOTICE 'WORKER_SAFE_REVOKE_ONLY_DISPOSABLE_PASS';
END $proof$;
