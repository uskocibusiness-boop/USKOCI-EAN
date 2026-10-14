-- Disposable PostgreSQL safety proof. All accounts are synthetic.
\set ON_ERROR_STOP on
DO $proof$
DECLARE own uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; cat uuid; ans jsonb; total integer;
BEGIN
 SELECT id INTO STRICT cat FROM private.work_taxonomy_categories WHERE label='Krečenje zidova';
 SELECT count(*) INTO total FROM private.work_taxonomy_categories;
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,
  ARRAY['Krečenje zidova','Popravka retro sata','Izrada prezentacija']);
 IF (ans->>'assignedCount')::int<>1
   OR ans->'unmappedSkillLabels'<>to_jsonb(ARRAY['Popravka retro sata','Izrada prezentacija'])
   OR (SELECT count(*) FROM private.work_taxonomy_categories)<>total
   OR (SELECT count(*) FROM private.work_taxonomy_worker_capabilities WHERE worker_account_id=own AND NOT excluded)<>1
 THEN RAISE EXCEPTION 'SAFE_SYNC_UNMAPPED_OR_WRITES'; END IF;
 IF (SELECT skills FROM public.app_profiles WHERE account_id=own)
  IS DISTINCT FROM ARRAY['Krečenje zidova','Popravka retro sata','Izrada prezentacija']
 THEN RAISE EXCEPTION 'SAFE_SYNC_LOST_HUMAN_SKILLS'; END IF;
 UPDATE private.work_taxonomy_worker_capabilities SET allow_related_offers=true
 WHERE worker_account_id=own AND category_id=cat;
 INSERT INTO private.work_taxonomy_related_acceptances(worker_account_id,source_category_id)
 VALUES(own,cat);
 UPDATE public.app_profiles SET skills='{}'::text[] WHERE account_id=own;
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,'{}'::text[]);
 IF (ans->>'assignedCount')::int<>0 OR (ans->>'revokedCount')::int<>1
 OR (ans->>'revokedRelatedAcceptances')::int<>1 OR EXISTS(
   SELECT 1 FROM private.work_taxonomy_worker_capabilities
    WHERE worker_account_id=own AND (NOT excluded OR allow_related_offers))
 THEN RAISE EXCEPTION 'SAFE_SYNC_DID_NOT_REVOKE'; END IF;
 UPDATE public.app_profiles SET skills=ARRAY['Krečenje zidova'] WHERE account_id=own;
 ans:=private.sync_worker_skills_to_taxonomy_capabilities(own,ARRAY['Krečenje zidova']);
 IF (ans->>'assignedCount')::int<>1 OR EXISTS(
  SELECT 1 FROM private.work_taxonomy_worker_capabilities
   WHERE worker_account_id=own AND (excluded OR allow_related_offers))
 THEN RAISE EXCEPTION 'SAFE_SYNC_READD_OPTIN'; END IF;
 BEGIN
  PERFORM private.sync_worker_skills_to_taxonomy_capabilities(own,ARRAY['Izrada prezentacija']);
  RAISE EXCEPTION 'UNEXPECTED_SKILLS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TAXONOMY_PROFILE_SKILLS_MISMATCH' THEN RAISE; END IF;
 END;
 IF position('rpc_taxonomy_ensure_path_service' in
  pg_get_functiondef('private.sync_worker_skills_to_taxonomy_capabilities(uuid,text[])'::regprocedure))>0
 THEN RAISE EXCEPTION 'LEGACY_WRITE_PATH_STILL_PRESENT'; END IF;
 RAISE NOTICE 'WORKER_SAFE_SYNC_DISPOSABLE_PASS';
END $proof$;
