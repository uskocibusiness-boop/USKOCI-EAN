\set ON_ERROR_STOP on
-- Source-pinned private dark-launch acceptance; disposable test database only.
DO $proof$
DECLARE v jsonb; p jsonb;
BEGIN
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'AUTO_CREATION_NOT_OFF'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_categories) <> 0
 THEN RAISE EXCEPTION 'DARK_INSTALL_CREATED_LIVE_CATEGORY'; END IF;
 IF has_table_privilege('service_role','private.work_taxonomy_categories','INSERT')
 OR has_table_privilege('service_role','private.work_taxonomy_control','UPDATE')
 OR has_table_privilege('service_role','private.work_taxonomy_worker_capabilities','INSERT')
 OR has_table_privilege('service_role','private.work_taxonomy_need_snapshots','INSERT')
 OR has_table_privilege('authenticated','private.work_taxonomy_categories','SELECT')
 OR has_function_privilege('anon','private.taxonomy_register_low_risk_v1(text,text,boolean)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_preview_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'SERVICE_DML_OR_CLIENT_ACCESS_OPEN'; END IF;
 v:=private.taxonomy_preview_v1('Dresiranje pasa');
 IF v->>'action'<>'PROPOSE_AUTO_PROVISIONAL'
 OR v->>'notificationAuthority'<>'NONE'
 OR v->>'registrationEnabled'<>'false'
 THEN RAISE EXCEPTION 'DARK_PREVIEW_NOT_SAFE_%',v; END IF;
 p:=private.taxonomy_existing_ai_category_preview_v1(
   'Dresiranje pasa','Potrebna dresura psa.','{}'::text[]);
 IF p->>'action'<>'NOVEL_SERVICE_REVIEW'
 OR p->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'EXISTING_AI_BRIDGE_DARK_NOT_SAFE_%',p; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>0 THEN
  RAISE EXCEPTION 'DARK_PREVIEW_INSERTED_ROWS';
 END IF;
 RAISE NOTICE 'TAXONOMY_DARK_PASS: private 15 tables; off; service DML denied; AI returns review only';
END $proof$;

-- Even trusted service caller with apparently "reviewed" flags must be denied.
DO $proof$
BEGIN
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1(
   'Dresiranje pasa','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'DARK_REGISTER_BYPASS';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='DARK_REGISTER_BYPASS' OR SQLERRM <> 'TAXONOMY_AUTO_REGISTRATION_DISABLED'
  THEN RAISE EXCEPTION 'WRONG_DARK_REGISTER_RESPONSE_%',SQLERRM; END IF;
 END;
 RAISE NOTICE 'DARK_REGISTER_DISABLED_PASS';
END $proof$;
