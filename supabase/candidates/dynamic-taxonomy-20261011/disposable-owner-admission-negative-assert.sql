-- Disposable PG negative authority and legacy-staleness test.
\set ON_ERROR_STOP on
DO $proof$
DECLARE v_parent uuid;v_plan jsonb;v_proposed jsonb;v_id uuid;
BEGIN
 IF private.taxonomy_normalize_v1('Кречење зидова')
   IS DISTINCT FROM private.taxonomy_normalize_v1('Krečenje zidova')
 THEN RAISE EXCEPTION 'CYRILLIC_LATIN_KEY_DIVERGENCE'; END IF;
 SELECT id INTO STRICT v_parent FROM private.work_taxonomy_categories WHERE label='Molerski radovi';
 -- The candidate is safe in this fixture; review and owner approval are required.
 v_plan:=jsonb_build_object(
 'action','CREATE_CHILD','catalogVersion',5,'mode','ON_SITE',
 'reason','Worker explicitly wants this specific interior painting task.',
 'parentId',v_parent,'path',jsonb_build_array('Krečenje plafona')
 );
 v_proposed:=public.rpc_taxonomy_prepare_admission_service(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '20000000-0000-4000-8000-000000000003',
 'WORKER_CAPABILITY','10000000-0000-4000-8000-000000000001',v_plan);
 v_id:=(v_proposed->>'admissionId')::uuid;
 PERFORM set_config('test.auth_uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
 PERFORM public.rpc_taxonomy_approve_admission(v_id,v_proposed->>'planDigest',repeat('a',64));
 -- Simulate exactly the unversioned legacy writer, in disposable PG only.
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,state,source,catalog_version)
 VALUES(private.taxonomy_normalize_v1('Nezavisna servisna grana'),'Nezavisna servisna grana',v_parent,'ESTABLISHED','SYSTEM',5);
 BEGIN
   PERFORM public.rpc_taxonomy_commit_admission_service(v_id);
   RAISE EXCEPTION 'STALENESS_WRITER_IGNORED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMISSION_STALE_CATALOG_REPLAN' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_categories
    WHERE canonical_key=private.taxonomy_normalize_v1('Krečenje plafona'))
   OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>5 THEN
  RAISE EXCEPTION 'PARTIAL_WRITE_AFTER_STALENESS'; END IF;
 -- It must reject a worker requesting REMOTE mode from an ON_SITE-only service.
 BEGIN
   PERFORM public.rpc_taxonomy_prepare_admission_service(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '20000000-0000-4000-8000-000000000004',
    'NEED_SERVICE','10000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','REUSE_EXISTING','catalogVersion',5,'mode','REMOTE',
       'reason','I might be able to make this available remotely later.',
       'categoryId',(SELECT id FROM private.work_taxonomy_categories WHERE label='Krečenje zidova'))
   );
   RAISE EXCEPTION 'REMOTE_MODE_GAINED_WITHOUT_SUPPORT';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMISSION_UNKNOWN_CATEGORY_OR_MODE' THEN RAISE; END IF;
 END;
 -- An unsafe ancestor is not sanitized by a harmless-looking final leaf.
 BEGIN
   PERFORM public.rpc_taxonomy_prepare_admission_service(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '20000000-0000-4000-8000-000000000005',
    'NEED_SERVICE','10000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','CREATE_CHILD','catalogVersion',5,'mode','ON_SITE',
      'reason','Any dangerous scope has to be reviewed by safety operators first.',
      'parentId',v_parent,'path',jsonb_build_array('Prodaja eksploziva','Farbanje plafona'))
   );
   RAISE EXCEPTION 'UNSAFE_ANCESTOR_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMISSION_SAFETY_REVIEW_REQUIRED' THEN RAISE; END IF;
 END;
 -- A privileged database fixture simulates row corruption AFTER user approval.
 -- Commit must rehash rather than trust mutable JSON once approval was issued.
 v_proposed:=public.rpc_taxonomy_prepare_admission_service(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '20000000-0000-4000-8000-000000000006',
  'NEED_SERVICE','10000000-0000-4000-8000-000000000002',
  jsonb_build_object('action','CREATE_CHILD','catalogVersion',5,'mode','ON_SITE',
    'reason','Verified interior finishing proposal submitted for owner review.',
    'parentId',v_parent,'path',jsonb_build_array('Farbanje plafona'))
 );
 v_id:=(v_proposed->>'admissionId')::uuid;
 PERFORM public.rpc_taxonomy_approve_admission(v_id,v_proposed->>'planDigest',repeat('b',64));
 UPDATE private.work_taxonomy_admissions_v1
  SET plan=jsonb_set(plan,'{path}','["Farbanje tuđeg zahteva"]'::jsonb)
  WHERE id=v_id;
 BEGIN
   PERFORM public.rpc_taxonomy_commit_admission_service(v_id);
   RAISE EXCEPTION 'TAMPERED_APPROVED_PAYLOAD_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMISSION_PLAN_TAMPERED' THEN RAISE; END IF;
 END;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_categories
 WHERE label IN ('Farbanje tuđeg zahteva','Farbanje plafona'))
 THEN RAISE EXCEPTION 'TAMPERED_PLAN_CREATED_CATEGORY'; END IF;
 RAISE NOTICE 'CATALOG_MODE_STALE_VERSION_AND_CYRILLIC_DISPOSABLE_PASS';
END $proof$;
