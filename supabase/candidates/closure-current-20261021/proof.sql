-- F01 current-schema rollback proof. No certificate admission, Auth deletion,
-- Storage call, external provider, policy activation, or original user mutation.
DO $proof$
DECLARE owner_id uuid:=extensions.gen_random_uuid(); peer_id uuid:=extensions.gen_random_uuid();
 cid uuid:=extensions.gen_random_uuid(); category_id uuid; pid uuid; nid uuid; hid uuid;
 exported jsonb; snapshot jsonb; binding jsonb; rowdoc jsonb; patch jsonb; entry jsonb; rel text;
 expected_handoff jsonb:='{"required":true,"shippingCountries":["RS"]}';
BEGIN
 IF cardinality(private.closure_redaction_relations_v5())<>96
 OR jsonb_array_length(private.data_export_dataset_catalog())<>73 THEN RAISE EXCEPTION 'F01_ROSTER_COUNTS'; END IF;
 IF private.retention_ai_source_ready() OR private.closure_erasure_binding_v5() IS NOT NULL THEN
  RAISE EXCEPTION 'F01_UNEXPECTED_CERTIFICATE_ADMISSION';END IF;
 BEGIN
  INSERT INTO auth.users(id,aud,role,email,created_at,updated_at) VALUES
   (owner_id,'authenticated','authenticated','f01-current-'||owner_id||'@proof.invalid',now(),now()),
   (peer_id,'authenticated','authenticated','f01-current-'||peer_id||'@proof.invalid',now(),now());
  PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claims','{}',true);
  INSERT INTO public.ai_conversations(id,account_id,purpose,status,fact_schema_version)
   VALUES(cid,owner_id,'PROFILE','OPEN','LEGACY_TEXT_V1');
  SELECT id INTO STRICT pid FROM public.app_profiles WHERE account_id=owner_id AND kind='REQUESTER';
  INSERT INTO public.needs(requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,execution_location_mode)
   VALUES(owner_id,pid,'DRAFT','F01 canary','F01 owner content','Test','OFFERS',1,'FLEXIBLE','REMOTE') RETURNING id INTO nid;
  INSERT INTO public.need_requirement_details(need_id,critical_conditions,handoff) VALUES(nid,ARRAY['F01_OWNER_CONDITION'],expected_handoff);
  SELECT m.category_id INTO STRICT category_id FROM private.work_taxonomy_category_modes m WHERE m.execution_scope='REMOTE' LIMIT 1;
  INSERT INTO private.work_taxonomy_worker_capabilities(worker_account_id,category_id,confirmed_at,origin) VALUES(owner_id,category_id,now(),'WORKER_CONFIRMED');
  INSERT INTO private.taxonomy_confirmed_worker_modes_v1(worker_account_id,category_id,execution_scope,source_review_id,source_request_key,handoff)
   VALUES(owner_id,category_id,'REMOTE',extensions.gen_random_uuid(),extensions.gen_random_uuid(),expected_handoff);
  INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,source_fingerprint,catalog_version,proposals,payload_digest)
   VALUES('WORKER_CAPABILITY',owner_id,cid,extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid(),repeat('a',64),1,
    '[{"service":"F01_OWNER_CANARY","handoff":{"required":true,"shippingCountries":["RS"]},"lease_token":"FORBIDDEN_EXPORT"}]',repeat('b',64)) RETURNING id INTO hid;
  INSERT INTO private.work_taxonomy_gemini_turn_hints_v1(purpose,account_id,conversation_id,client_request_id,turn_id,attempt_id,source_fingerprint,catalog_version,proposals,payload_digest)
   VALUES('WORKER_CAPABILITY',peer_id,extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid(),repeat('a',64),1,
    '[{"service":"F01_PEER_CANARY"}]',repeat('b',64));
  SELECT jsonb_agg(to_jsonb(x)) INTO exported FROM private.closure_taxonomy_export_rows_v1(owner_id) x;
  IF exported::text NOT LIKE '%F01_OWNER_CANARY%' OR exported::text LIKE '%F01_PEER_CANARY%' OR exported::text LIKE '%FORBIDDEN_EXPORT%' THEN
   RAISE EXCEPTION 'F01_OWNED_EXPORT_OR_SECRET_LEAK';END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(exported) x WHERE x->>'key'='taxonomyServiceModes' AND x#>'{value,handoff}'=expected_handoff) THEN RAISE EXCEPTION 'F01_MODE_HANDOFF_OMITTED';END IF;
  binding:=jsonb_build_object('delivery',jsonb_build_object('datasets',(SELECT jsonb_agg(value||'{"mode":"INCLUDE"}'::jsonb) FROM jsonb_array_elements(private.data_export_dataset_catalog()))));
  snapshot:=private.data_export_snapshot(owner_id,extensions.gen_random_uuid(),binding,now())::jsonb;
  IF snapshot#>'{datasets,needRequirements,0,handoff}' IS DISTINCT FROM expected_handoff THEN RAISE EXCEPTION 'F01_NEED_HANDOFF_OMITTED';END IF;
  IF snapshot::text LIKE '%F01_PEER_CANARY%' OR snapshot::text LIKE '%FORBIDDEN_EXPORT%' THEN RAISE EXCEPTION 'F01_SNAPSHOT_LEAK';END IF;
  entry:=private.closure_taxonomy_project_v1('private.dev_worker_profile_reset_snapshots_v1',jsonb_build_object('payload',jsonb_build_object('confirmed_modes',jsonb_build_array(jsonb_build_object('worker_account_id',owner_id,'handoff',expected_handoff)))),owner_id);
  IF entry#>'{payload,confirmed_modes,0,handoff}' IS DISTINCT FROM expected_handoff THEN RAISE EXCEPTION 'F01_RESET_HANDOFF_OMITTED';END IF;
  -- Every new relation yields a concrete erasure plan, not an unclassified NULL.
  FOR rel IN SELECT value->>'relation' FROM jsonb_array_elements(private.closure_taxonomy_inventory_v1()) LOOP
   rowdoc:=jsonb_build_object('id',extensions.gen_random_uuid(),'request_key',extensions.gen_random_uuid(),'source_review_id',extensions.gen_random_uuid(),'conversation_id',cid,
    'need_id',nid,'need_revision',1,'result','{"service":"F01_OWNER_CANARY"}'::jsonb,'plans','[{"service":"F01_OWNER_CANARY"}]'::jsonb);
   patch:=private.closure_redaction_patch_v5(rel,rowdoc,owner_id,extensions.gen_random_uuid());
   IF patch IS NULL OR patch->>'operation' NOT IN ('DELETE','UPDATE') THEN RAISE EXCEPTION 'F01_MISSING_PATCH:%',rel;END IF;
  END LOOP;
  SELECT to_jsonb(t) INTO rowdoc FROM private.work_taxonomy_gemini_turn_hints_v1 t WHERE id=hid;
  INSERT INTO private.retention_holds(account_id,hold_key,conversation_id,active,revision) VALUES(owner_id,'F01_ROLLBACK_HOLD',cid,true,1);
  IF private.closure_redaction_patch_v5('private.work_taxonomy_gemini_turn_hints_v1',rowdoc,owner_id,extensions.gen_random_uuid()) IS NOT NULL THEN RAISE EXCEPTION 'F01_HOLD_IGNORED';END IF;
  BEGIN
   INSERT INTO private.account_closure_requests(account_id,state,revision) VALUES(owner_id,'READY',1);
   BEGIN UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals='[{"service":"REANIMATE"}]' WHERE id=hid;
    RAISE EXCEPTION 'F01_LATE_WRITE_ALLOWED';EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;
   RAISE SQLSTATE 'ZF001';
  EXCEPTION WHEN SQLSTATE 'ZF001' THEN NULL;END;
  BEGIN UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET account_id=peer_id WHERE id=hid;
   RAISE EXCEPTION 'F01_OWNER_MOVE_ALLOWED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'F01_OWNER_IMMUTABLE' THEN RAISE;END IF;END;
  RAISE SQLSTATE 'ZF002';
 EXCEPTION WHEN SQLSTATE 'ZF002' THEN NULL;END;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id IN(owner_id,peer_id)) THEN RAISE EXCEPTION 'F01_FIXTURE_REMAINS';END IF;
END;$proof$;
