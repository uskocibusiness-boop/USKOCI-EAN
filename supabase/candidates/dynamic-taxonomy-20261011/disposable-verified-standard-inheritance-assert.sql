-- Disposable PostgreSQL 16/17 only: zero Supabase credentials and no push.
\set ON_ERROR_STOP on
DO $proof$
DECLARE
 moler uuid; physical uuid; digital uuid; dostava uuid;
 paint uuid; walls uuid; specialist uuid; ticket uuid; crossmode uuid;
 worker_moler uuid:=gen_random_uuid(); worker_physical uuid:=gen_random_uuid();
 worker_paint uuid:=gen_random_uuid();
 need_paint uuid:=gen_random_uuid(); need_wall uuid:=gen_random_uuid();
 need_specialist uuid:=gen_random_uuid(); need_ticket uuid:=gen_random_uuid();
 need_multi uuid:=gen_random_uuid(); v bigint; got text; denied boolean;
BEGIN
 SELECT id INTO STRICT moler FROM private.work_taxonomy_categories WHERE canonical_key='molerski radovi';
 SELECT id INTO STRICT physical FROM private.work_taxonomy_categories WHERE canonical_key='fizicki poslovi';
 SELECT id INTO STRICT digital FROM private.work_taxonomy_categories WHERE canonical_key='digitalne usluge';
 SELECT id INTO STRICT dostava FROM private.work_taxonomy_categories WHERE canonical_key='dostava';
 SELECT catalog_version INTO STRICT v FROM private.work_taxonomy_control WHERE singleton;
 IF v<>2 THEN RAISE EXCEPTION 'UNEXPECTED_CATALOG_VERSION'; END IF;

 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Krečenje'),'Krečenje',moler,'OPERATOR',v,'ESTABLISHED')
 RETURNING id INTO paint;
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Krečenje zidova'),'Krečenje zidova',paint,'OPERATOR',v,'ESTABLISHED')
 RETURNING id INTO walls;
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Specijalna dekorativna tehnika'),
 'Specijalna dekorativna tehnika',moler,'OPERATOR',v,'ESTABLISHED')
 RETURNING id INTO specialist;
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Kupovina karata'),
 'Kupovina karata',dostava,'OPERATOR',v,'ESTABLISHED')
 RETURNING id INTO ticket;
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Onlajn krečenje'),
 'Onlajn krečenje',moler,'OPERATOR',v,'ESTABLISHED')
 RETURNING id INTO crossmode;

 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES
 (paint,'ON_SITE','DISPOSABLE_OPERATOR'),
 (walls,'ON_SITE','DISPOSABLE_OPERATOR'),
 (specialist,'ON_SITE','DISPOSABLE_OPERATOR'),
 (ticket,'ON_SITE','DISPOSABLE_OPERATOR'),
 (crossmode,'REMOTE','DISPOSABLE_OPERATOR');

 INSERT INTO public.needs(id) VALUES(need_paint),(need_wall),(need_specialist),(need_ticket),(need_multi);
 INSERT INTO private.work_taxonomy_need_snapshots
 (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,source,classification_state)
 VALUES
 (need_paint,1,paint,v,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_wall,1,walls,v,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_specialist,1,specialist,v,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_ticket,1,ticket,v,true,'REQUESTER_CORRECTED','CONFIRMED'),
 (need_multi,1,walls,v,true,'REQUESTER_CORRECTED','CONFIRMED');
 INSERT INTO private.work_taxonomy_need_skills(need_id,need_revision,category_id)
 VALUES(need_multi,1,ticket);
 INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,origin)
 VALUES
 (worker_moler,moler,now(),'WORKER_CONFIRMED'),
 (worker_physical,physical,now(),'WORKER_CONFIRMED'),
 (worker_paint,paint,now(),'WORKER_CONFIRMED');

 -- No implicit generic parent match BEFORE verified standard inclusion.
 IF private.taxonomy_capability_tier_inherited_v1(need_paint,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'UNVERIFIED_PARENT_WILDCARD'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_paint,1,worker_paint)<>'EXACT'
 THEN RAISE EXCEPTION 'DIRECT_PAINTING_REGRESSED'; END IF;
 IF private.taxonomy_capability_tier_v1(need_paint,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'BASE_MATCHER_UNEXPECTEDLY_CHANGED'; END IF;

 -- A controlled operator explicitly verifies ordinary moler -> painting,
 -- then painting -> wall painting. This whitelist is NOT created by AI.
 INSERT INTO private.work_taxonomy_standard_coverage
  (parent_category_id,child_category_id,evidence_ref)
 VALUES(moler,paint,'DISPOSABLE_CURATED_STANDARD_MOLER'),
       (paint,walls,'DISPOSABLE_CURATED_STANDARD_WALLS');
 IF private.taxonomy_capability_tier_inherited_v1(need_paint,1,worker_moler)<>'INHERITED_STANDARD'
 OR private.taxonomy_capability_tier_inherited_v1(need_wall,1,worker_moler)<>'INHERITED_STANDARD'
 THEN RAISE EXCEPTION 'MOLER_STANDARD_CHILDREN_NOT_INCLUDED'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_specialist,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'SPECIALIST_IMPLIED_BY_PARENT'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_ticket,1,worker_physical)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'GENERIC_PHYSICAL_WORKER_GOT_TICKET_PURCHASE'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_multi,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'EXPLICIT_EXTRA_REQUIREMENT_BYPASSED'; END IF;
 IF private.taxonomy_capability_tier_inherited_v1(need_paint,1,worker_physical)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'UNRELATED_PHYSICAL_WORKER_MATCHED_MOLER'; END IF;

 -- A worker's explicit opt-out from ANY intermediate or target category wins.
 INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,origin,excluded)
 VALUES(worker_moler,paint,now(),'WORKER_CORRECTED',true);
 IF private.taxonomy_capability_tier_inherited_v1(need_wall,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'INTERMEDIATE_OPTOUT_BYPASSED'; END IF;
 DELETE FROM private.work_taxonomy_worker_capabilities
 WHERE worker_account_id=worker_moler AND category_id=paint;
 INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,origin,excluded)
 VALUES(worker_moler,walls,now(),'WORKER_CORRECTED',true);
 IF private.taxonomy_capability_tier_inherited_v1(need_wall,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'TARGET_OPTOUT_BYPASSED'; END IF;
 DELETE FROM private.work_taxonomy_worker_capabilities
 WHERE worker_account_id=worker_moler AND category_id=walls;
 IF private.taxonomy_capability_tier_inherited_v1(need_wall,1,worker_moler)<>'INHERITED_STANDARD'
 THEN RAISE EXCEPTION 'OPTOUT_RESTORATION_FAILED'; END IF;

 -- New or unreviewed category NEVER becomes standard by name or ancestry.
 UPDATE private.work_taxonomy_categories SET state='AUTO_PROVISIONAL' WHERE id=walls;
 IF private.taxonomy_capability_tier_inherited_v1(need_wall,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'PROVISIONAL_CHILD_GRANTED_INHERITANCE'; END IF;
 UPDATE private.work_taxonomy_categories SET state='ESTABLISHED' WHERE id=walls;
 UPDATE private.work_taxonomy_need_snapshots
 SET reviewed_by_requester=false,classification_state='NEEDS_CLARIFICATION'
 WHERE need_id=need_wall;
 IF private.taxonomy_capability_tier_inherited_v1(need_wall,1,worker_moler)<>'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'UNCONFIRMED_NEED_WAS_MATCHED'; END IF;

 -- No client role can install inheritance authority.
 IF has_table_privilege('authenticated','private.work_taxonomy_standard_coverage','INSERT')
 OR has_table_privilege('service_role','private.work_taxonomy_standard_coverage','INSERT')
 OR has_function_privilege('authenticated','private.taxonomy_capability_tier_inherited_v1(uuid,integer,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','private.taxonomy_capability_tier_inherited_v1(uuid,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'UNSAFE_INHERITANCE_GRANTS'; END IF;

 -- Child-mode and direct-parent proof; no cross-mode inheritance.
 denied:=false;
 BEGIN
   INSERT INTO private.work_taxonomy_standard_coverage
    (parent_category_id,child_category_id,evidence_ref)
   VALUES(moler,crossmode,'DISPOSABLE_FORBIDDEN_REMOTE_CHILD');
 EXCEPTION WHEN raise_exception THEN
   denied:=SQLERRM='TAXONOMY_COVERAGE_NOT_VERIFIED_PARENT_SCOPE';
 END;
 IF NOT denied THEN RAISE EXCEPTION 'CROSS_MODE_EDGE_ADMITTED'; END IF;
 denied:=false;
 BEGIN
   INSERT INTO private.work_taxonomy_standard_coverage
    (parent_category_id,child_category_id,evidence_ref)
   VALUES(digital,specialist,'DISPOSABLE_FORGED_WRONG_PARENT');
 EXCEPTION WHEN raise_exception THEN
   denied:=SQLERRM='TAXONOMY_COVERAGE_NOT_VERIFIED_PARENT_SCOPE';
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FORGED_PARENT_EDGE_ADMITTED'; END IF;

 -- Reparenting is forbidden, hence even a >2 node cycle is impossible.
 denied:=false;
 BEGIN
   UPDATE private.work_taxonomy_categories SET parent_id=walls WHERE id=moler;
 EXCEPTION WHEN raise_exception THEN
   denied:=SQLERRM='TAXONOMY_PARENT_REASSIGNMENT_FORBIDDEN';
 END;
 IF NOT denied THEN RAISE EXCEPTION 'CATEGORY_CYCLE_NOT_BLOCKED'; END IF;

 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 OR (SELECT COUNT(*) FROM private.work_taxonomy_aliases)<>0
 THEN RAISE EXCEPTION 'AUTO_GROWTH_OR_SYNONYM_POLLUTION'; END IF;

 RAISE NOTICE 'TAXONOMY_VERIFIED_STANDARD_INHERITANCE_PASS';
END $proof$;
