-- Disposable PostgreSQL proof. Reads/replaces no actual user data.
\set ON_ERROR_STOP on
BEGIN;
DO $proof$
DECLARE v uuid;
BEGIN
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>0
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 THEN RAISE EXCEPTION 'NOT_A_DISPOSABLE_EMPTY_CATALOG'; END IF;
 -- Established names that the conservative action vocabulary cannot classify.
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
 VALUES(private.taxonomy_normalize_v1('Časovi matematike'),'Časovi matematike','ESTABLISHED','OPERATOR',1);
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
 VALUES(private.taxonomy_normalize_v1('Grafički dizajn'),'Grafički dizajn','ESTABLISHED','OPERATOR',1);
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
 VALUES(private.taxonomy_normalize_v1('Servis solarnih panela'),'Servis solarnih panela','ESTABLISHED','OPERATOR',1);
 INSERT INTO private.work_taxonomy_categories(canonical_key,label,state,source,catalog_version)
 VALUES(private.taxonomy_normalize_v1('Izrada eksploziva'),'Izrada eksploziva','ESTABLISHED','OPERATOR',1);
 SELECT id INTO v FROM private.work_taxonomy_categories WHERE label='Časovi matematike';
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label)
 VALUES(v,'sr','Podučavanje matematike');
END $proof$;
DO $verify$
DECLARE v jsonb; x text;
BEGIN
 FOREACH x IN ARRAY ARRAY['Časovi matematike','Grafički dizajn','Podučavanje matematike'] LOOP
  v:=private.taxonomy_preview_v1(x);
  IF v->>'action'<>'REUSE_EXISTING' OR v->>'notificationAuthority'<>'NONE'
    OR v->>'requiresRequesterReview'<>'true'
  THEN RAISE EXCEPTION 'EXISTING_SERVICE_NOT_REUSED:%:%',x,v; END IF;
 END LOOP;
 v:=private.taxonomy_preview_v1('Servis solarnih panela');
 IF v->>'action'<>'SAFETY_REVIEW' THEN RAISE EXCEPTION 'RISK_BYPASS:%',v; END IF;
 v:=private.taxonomy_preview_v1('Izrada eksploziva');
 IF v->>'action'<>'REJECT' THEN RAISE EXCEPTION 'BLOCKED_BYPASS:%',v; END IF;
 v:=private.taxonomy_preview_v1('Nepoznate obaveze');
 IF v->>'action'<>'CLARIFY' THEN RAISE EXCEPTION 'UNKNOWN_VOCABULARY_BYPASS:%',v; END IF;
 v:=private.taxonomy_preview_v1('Dresura pasa');
 IF v->>'action'<>'PROPOSE_AUTO_PROVISIONAL'
 OR v->>'registrationEnabled'<>'false' OR v->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'NOVEL_PREVIEW_NOT_SAFE:%',v; END IF;
 IF (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) IS DISTINCT FROM false
 OR (SELECT count(*) FROM private.work_taxonomy_categories)<>4
 OR (SELECT count(*) FROM private.work_taxonomy_aliases)<>1
 OR has_function_privilege('authenticated','private.taxonomy_preview_v1(text)','EXECUTE')
 OR has_function_privilege('anon','private.taxonomy_preview_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'TAXONOMY_PREVIEW_SECURITY_OR_DML_INVARIANT'; END IF;
 RAISE NOTICE 'PREVIEW_ORDER_PASS: established names + alias reused; risk/block/unknown unchanged; push none';
END $verify$;
ROLLBACK;
