-- Strict service+mode proof on isolated PostgreSQL only.
\set ON_ERROR_STOP on
DO $scope$
DECLARE v_owner uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_paint uuid;v_remote uuid;
BEGIN
 IF (SELECT enabled FROM private.taxonomy_match_scope_control_v1 WHERE singleton) THEN
  RAISE EXCEPTION 'MODE_GUARD_MUST_START_OFF'; END IF;
 SELECT id INTO STRICT v_paint FROM private.work_taxonomy_categories WHERE label='Krečenje zidova';
 SELECT id INTO STRICT v_remote FROM private.work_taxonomy_categories WHERE label='Izrada prezentacija';
 -- A confirmed canonical worker ability without service-specific scope consent
 -- grants no matching rights, even when global modes include both.
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000001',v_owner)
 OR private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_INFERRED_SKILL_SCOPE'; END IF;
 INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
  worker_account_id,category_id,execution_scope,source_review_id,source_request_key)
 VALUES
 (v_owner,v_remote,'REMOTE','10000000-0000-4000-8000-000000000030',
  '20000000-0000-4000-8000-000000000030'),
 (v_owner,v_paint,'ON_SITE','10000000-0000-4000-8000-000000000030',
  '20000000-0000-4000-8000-000000000030');
 IF NOT private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000001',v_owner)
 OR NOT private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 OR private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000003',v_owner)
 OR NOT private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000004',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_EXACT_SCOPE_MISMATCH'; END IF;
 -- Revoking only this service's signed mode must block that service immediately.
 UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=false
 WHERE worker_account_id=v_owner AND category_id=v_remote AND execution_scope='REMOTE';
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000001',v_owner)
 OR NOT private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_IGNORED_SERVICE_MODE_REVOCATION'; END IF;
 UPDATE private.taxonomy_confirmed_worker_modes_v1 SET active=true
 WHERE worker_account_id=v_owner AND category_id=v_remote AND execution_scope='REMOTE';
 -- A current snapshot is not authority if the requester has not confirmed it.
 UPDATE private.work_taxonomy_need_snapshots
 SET reviewed_by_requester=false,classification_state='NEEDS_CLARIFICATION'
 WHERE need_id='60000000-0000-4000-8000-000000000001' AND need_revision=1;
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000001',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_UNSIGNED_CURRENT_NEED_MATCHED'; END IF;
 UPDATE private.work_taxonomy_need_snapshots
 SET reviewed_by_requester=true,classification_state='CONFIRMED'
 WHERE need_id='60000000-0000-4000-8000-000000000001' AND need_revision=1;
 -- Removing global REMOTE consent blocks only remote, not on-site.
 UPDATE private.worker_execution_mode_choices SET modes=ARRAY['ON_SITE']
 WHERE worker_account_id=v_owner;
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000001',v_owner)
 OR NOT private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_IGNORED_GLOBAL_WITHDRAWAL'; END IF;
 -- Removing the actual capability always blocks its per-service scope.
 UPDATE private.work_taxonomy_worker_capabilities SET excluded=true
 WHERE worker_account_id=v_owner AND category_id=v_paint;
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_EXCLUDED_SKILL_MATCHED'; END IF;
 UPDATE private.work_taxonomy_worker_capabilities SET excluded=false
 WHERE worker_account_id=v_owner AND category_id=v_paint;
 -- An edited revision with only an older confirmed snapshot must not inherit
 -- past requester review.
 UPDATE public.needs SET revision=2
 WHERE id='60000000-0000-4000-8000-000000000002';
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_STALE_NEED_REVISION_MATCHED'; END IF;
 UPDATE public.needs SET revision=1
 WHERE id='60000000-0000-4000-8000-000000000002';
 -- A mode row without the originating reviewed Save command is not authority.
 DELETE FROM private.worker_ai_saves WHERE account_id=v_owner;
 IF private.taxonomy_scope_eligible_v1('60000000-0000-4000-8000-000000000002',v_owner)
 THEN RAISE EXCEPTION 'MODE_GUARD_UNSAVED_SCOPE_MATCHED'; END IF;
 IF has_function_privilege('anon',
   'private.taxonomy_scope_eligible_v1(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'private.taxonomy_scope_eligible_v1(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'MODE_GUARD_PUBLIC_ACCESS'; END IF;
 RAISE NOTICE 'EXACT_SERVICE_SCOPE_DISPOSABLE_PASS';
END $scope$;
