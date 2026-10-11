-- Disposable cross-locale identity admission proof. No live schema or sends.
DO $proof$
DECLARE
 id_known uuid; id_preview uuid; v jsonb; before_categories bigint;
 before_version bigint;
BEGIN
 SELECT id INTO STRICT id_known FROM private.work_taxonomy_categories
 WHERE canonical_key='servis bicikala';
 SELECT count(*) INTO before_categories FROM private.work_taxonomy_categories;
 SELECT catalog_version INTO before_version FROM private.work_taxonomy_control;
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label)
 VALUES (id_known,'en','Izrada razglednice');
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=true;
 v:=private.taxonomy_register_low_risk_v1('Izrada razglednice','LOW_RISK_VERIFIED',true);
 IF v->>'action'<>'REUSE_EXISTING'
    OR (v->>'categoryId')::uuid<>id_known
    OR v->>'notificationAuthority'<>'NONE' THEN
  RAISE EXCEPTION 'CROSS_LOCALE_EXISTING_ID_NOT_REUSED'; END IF;
 v:=private.taxonomy_preview_v1('Izrada razglednice');
 IF v->>'action'<>'REUSE_EXISTING' OR (v->>'categoryId')::uuid<>id_known THEN
  RAISE EXCEPTION 'PREVIEW_REGISTRATION_ID_DRIFT'; END IF;
 BEGIN
  PERFORM private.taxonomy_register_low_risk_v1('Izrada ukrasa','LOW_RISK_VERIFIED',true);
  RAISE EXCEPTION 'CROSS_LOCALE_COLLISION_NOT_REFUSED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TAXONOMY_ALIAS_COLLISION' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>before_categories
 OR (SELECT catalog_version FROM private.work_taxonomy_control)<>before_version THEN
  RAISE EXCEPTION 'SYNONYM_REUSE_CREATED_DUPLICATE_ID';
 END IF;
 UPDATE private.work_taxonomy_control SET auto_registration_enabled=false;
 RAISE NOTICE 'DISPOSABLE_CROSS_LOCALE_NO_DUPLICATE_PASS';
END
$proof$;
