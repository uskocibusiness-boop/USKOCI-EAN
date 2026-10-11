-- Isolated contract assertions against the ACTUAL SQL candidate, never DEV.
DO $check$
DECLARE
 v jsonb; w jsonb; first_id uuid; alias_id uuid; version_before bigint; n integer; i integer;
BEGIN
 IF private.taxonomy_normalize_v1('Кречење стана') <> 'krecenje stana'
 OR private.taxonomy_normalize_v1('Krečenje stana') <> 'krecenje stana'
 OR private.taxonomy_normalize_v1('  PODEŠAVANJE  3D  ŠTAMPAČA ') <> 'podesavanje 3d stampaca' THEN
  RAISE EXCEPTION 'NORMALIZER_FAIL';
 END IF;
 IF has_table_privilege('service_role','private.work_taxonomy_worker_capabilities','INSERT')
    OR has_table_privilege('service_role','private.work_taxonomy_need_snapshots','INSERT')
    OR has_table_privilege('service_role','private.work_taxonomy_relations','INSERT') THEN
  RAISE EXCEPTION 'SERVICE_ROLE_MUST_NOT_FABRICATE_CONFIRMED_SKILLS';
 END IF;
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control) THEN
  RAISE EXCEPTION 'FLAG_MUST_DEFAULT_OFF';
 END IF;
 IF has_function_privilege('anon',
       'private.taxonomy_register_low_risk_v1(text,text,boolean)','EXECUTE')
    OR has_function_privilege('authenticated',
       'private.taxonomy_register_low_risk_v1(text,text,boolean)','EXECUTE') THEN
  RAISE EXCEPTION 'UNSAFE_PUBLIC_EXECUTE';
 END IF;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1('Servis dronova','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'NEGATIVE_DISABLED_FAILED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'TAXONOMY_AUTO_REGISTRATION_DISABLED' THEN RAISE; END IF;
 END;
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=true;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1('Servis dronova','AI_ASSERTED',true);
  RAISE EXCEPTION 'NEGATIVE_UNVERIFIED_FAILED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'TAXONOMY_ADMISSION_REFUSED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1('Drugo','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'NEGATIVE_UNCLEAR_FAILED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'TAXONOMY_AMBIGUOUS_LABEL' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1('<script>','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'NEGATIVE_INJECTION_FAILED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'TAXONOMY_INVALID_LABEL' THEN RAISE; END IF;
 END;
 v := private.taxonomy_register_low_risk_v1('Servis dronova','LOW_RISK_VERIFIED',true);
 IF v->>'action'<>'CREATE_AUTO_PROVISIONAL' OR v->>'notificationAuthority'<>'NONE' THEN
  RAISE EXCEPTION 'CREATE_FAILED: %',v; END IF;
 first_id := (v->>'categoryId')::uuid;
 w := private.taxonomy_register_low_risk_v1('Сервис дронова','LOW_RISK_VERIFIED',true);
 IF w->>'action'<>'REUSE_EXISTING' OR (w->>'categoryId')::uuid <> first_id THEN
  RAISE EXCEPTION 'CYRILLIC_REUSE_FAILED'; END IF;
 SELECT catalog_version INTO version_before FROM private.work_taxonomy_control;
 IF (v->>'catalogVersion')::bigint<>version_before THEN
  RAISE EXCEPTION 'VERSION_BUMP_ONLY_ON_NEW_FAILED'; END IF;
 INSERT INTO private.work_taxonomy_aliases (category_id,locale,label)
 VALUES (first_id,'sr','Servisiranje dronova');
 w := private.taxonomy_register_low_risk_v1('Servisiranje dronova','LOW_RISK_VERIFIED',true);
 IF w->>'action'<>'REUSE_EXISTING' OR (w->>'categoryId')::uuid<>first_id THEN
  RAISE EXCEPTION 'ALIAS_REUSE_FAILED'; END IF;
 FOR i IN 1..50 LOOP
  v := private.taxonomy_register_low_risk_v1('Servis preciznog senzora '||i,'LOW_RISK_VERIFIED',true);
  IF v->>'action'<>'CREATE_AUTO_PROVISIONAL' THEN RAISE EXCEPTION 'OPEN_CATALOG_FAILED'; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM private.work_taxonomy_categories WHERE state='AUTO_PROVISIONAL';
 IF n<>51 THEN RAISE EXCEPTION 'CATEGORY_COUNT_EXPECTED_51_GOT_%',n; END IF;
 SELECT count(*) INTO n FROM private.work_taxonomy_worker_capabilities;
 IF n<>0 THEN RAISE EXCEPTION 'AI_REGISTERED_WORKER_CAPABILITY'; END IF;
 IF EXISTS (SELECT 1 FROM private.work_taxonomy_relations WHERE verification='VERIFIED') THEN
  RAISE EXCEPTION 'AI_CREATED_VERIFIED_RELATION'; END IF;
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=false;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1('Nova vrsta usluge','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'NEGATIVE_ROLLBACK_GATE_FAILED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'TAXONOMY_AUTO_REGISTRATION_DISABLED' THEN RAISE; END IF;
 END;
 IF NOT EXISTS (SELECT 1 FROM private.work_taxonomy_categories WHERE id=first_id) THEN
  RAISE EXCEPTION 'DISABLE_DESTROYED_HISTORY'; END IF;
 RAISE NOTICE 'DISPOSABLE_TAXONOMY_FOUNDATION_PASS categories=%',51;
END
$check$;
