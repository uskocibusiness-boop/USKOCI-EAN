-- Synthetic acceptance of 82 curated catalog entries on disposable Postgres.
\set ON_ERROR_STOP on
DO $test$
DECLARE
 moler uuid; paint uuid; wall uuid; decorative uuid; everyday uuid;
 ticket uuid; groceries uuid; physical uuid; electrician uuid; outlet uuid;
 graphic uuid; logo uuid; courier uuid; remote_mode text;
 worker_moler uuid:=gen_random_uuid(); worker_physical uuid:=gen_random_uuid();
 worker_electrician uuid:=gen_random_uuid(); worker_graphic uuid:=gen_random_uuid();
 need_paint uuid:=gen_random_uuid(); need_ticket uuid:=gen_random_uuid();
 need_decorative uuid:=gen_random_uuid(); need_outlet uuid:=gen_random_uuid();
 need_logo uuid:=gen_random_uuid(); v jsonb;
BEGIN
 IF (SELECT COUNT(*) FROM private.work_taxonomy_categories)<>82
 OR (SELECT COUNT(*) FROM private.work_taxonomy_categories WHERE parent_id IS NOT NULL)<>67
 OR (SELECT COUNT(*) FROM private.work_taxonomy_category_modes)<>82
 OR (SELECT COUNT(*) FROM private.work_taxonomy_standard_coverage)<>6
 OR (SELECT COUNT(*) FROM private.work_taxonomy_aliases)<>0
 THEN RAISE EXCEPTION 'SERVICE_CATALOG_COUNT_INVALID'; END IF;
 SELECT id INTO STRICT moler FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Molerski radovi');
 SELECT id INTO STRICT paint FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Krečenje');
 SELECT id INTO STRICT wall FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Krečenje zidova');
 SELECT id INTO STRICT decorative FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Dekorativne molerske tehnike');
 SELECT id INTO STRICT everyday FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Svakodnevna pomoć');
 SELECT id INTO STRICT ticket FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Kupovina karata');
 SELECT id INTO STRICT groceries FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Kupovina namirnica');
 SELECT id INTO STRICT physical FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Fizički poslovi');
 SELECT id INTO STRICT electrician FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Električarski radovi');
 SELECT id INTO STRICT outlet FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Zamena utičnica');
 SELECT id INTO STRICT graphic FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Grafički dizajn');
 SELECT id INTO STRICT logo FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Izrada logotipa');
 SELECT id INTO STRICT courier FROM private.work_taxonomy_categories WHERE canonical_key=private.taxonomy_normalize_v1('Dostava');

 IF (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=paint)<>moler
 OR (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=wall)<>paint
 OR (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=ticket) IS NULL
 OR (SELECT parent_id FROM private.work_taxonomy_categories WHERE id=logo)<>graphic
 THEN RAISE EXCEPTION 'HIERARCHY_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM private.work_taxonomy_standard_coverage
   WHERE parent_category_id=physical OR child_category_id=ticket
      OR child_category_id=outlet OR child_category_id=decorative)
 THEN RAISE EXCEPTION 'UNSAFE_BROAD_COVERAGE'; END IF;
 v:=private.taxonomy_browse_children_v1('ON_SITE',everyday);
 IF v->>'action'<>'BROWSE' OR (v->>'count')::int<>3
 THEN RAISE EXCEPTION 'EVERYDAY_SERVICES_NOT_BROWSABLE_%',v; END IF;
 IF (private.taxonomy_browse_children_v1('REMOTE',everyday))->>'action'<>'PARENT_NOT_IN_SCOPE'
 THEN RAISE EXCEPTION 'EVERYDAY_LEAKED_INTO_REMOTE'; END IF;
 IF (private.taxonomy_browse_children_v1('ON_SITE',graphic))->>'action'<>'PARENT_NOT_IN_SCOPE'
 THEN RAISE EXCEPTION 'GRAPHIC_LEAKED_INTO_ON_SITE'; END IF;
 IF (private.taxonomy_browse_children_v1('REMOTE',graphic))->>'count'<>'2'
 THEN RAISE EXCEPTION 'REMOTE_LOGO_SUBTREE_MISSING'; END IF;

 INSERT INTO private.work_taxonomy_worker_capabilities
 (worker_account_id,category_id,confirmed_at,origin) VALUES
 (worker_moler,moler,now(),'WORKER_CONFIRMED'),
 (worker_physical,physical,now(),'WORKER_CONFIRMED'),
 (worker_electrician,electrician,now(),'WORKER_CONFIRMED'),
 (worker_graphic,graphic,now(),'WORKER_CONFIRMED');
 INSERT INTO public.needs(id) VALUES
 (need_paint),(need_ticket),(need_decorative),(need_outlet),(need_logo);
 INSERT INTO private.work_taxonomy_need_snapshots
 (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,source,classification_state)
 VALUES
 (need_paint,1,wall,3,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_ticket,1,ticket,3,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_decorative,1,decorative,3,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_outlet,1,outlet,3,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_logo,1,logo,3,true,'REQUESTER_CORRECTED','CONFIRMED');

 IF private.taxonomy_capability_tier_inherited_v1(need_paint,1,worker_moler)<>'INHERITED_STANDARD'
 THEN RAISE EXCEPTION 'STANDARD_MOLER_DID_NOT_RECEIVE_PAINTING'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_decorative,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'SPECIALIST_GRANTED_TO_GENERIC_MOLER'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_ticket,1,worker_physical)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'PHYSICAL_WORKER_GRANTED_TICKET_PURCHASE'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_outlet,1,worker_electrician)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'RISKY_ELECTRICIAN_WORK_GRANTED_BY_PARENT'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_logo,1,worker_graphic)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'GRAPHIC_ROOT_GRANTED_ALL_SPECIALIST_CHILDREN'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_ticket,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'MOLER_GRANTED_UNRELATED_PURCHASE'; END IF;
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 OR (SELECT catalog_version FROM private.work_taxonomy_control WHERE singleton)<>3
 THEN RAISE EXCEPTION 'UNSAFE_AUTOGROWTH_OR_VERSION'; END IF;
 RAISE NOTICE 'CURATED_SERVICES_82_AND_SAFE_MATCHING_PASS';
END $test$;
