-- Read-only result contract. Only synthetic catalog records; zero outbound.
DO $assert$
DECLARE
 known uuid; other uuid; v jsonb; before_cat bigint; before_audit bigint;
BEGIN
 SELECT id INTO STRICT known FROM private.work_taxonomy_categories
 WHERE canonical_key='servis bicikala';
 SELECT id INTO STRICT other FROM private.work_taxonomy_categories
 WHERE canonical_key='servis preciznog senzora 1';
 SELECT count(*) INTO before_cat FROM private.work_taxonomy_categories;
 SELECT count(*) INTO before_audit FROM private.work_taxonomy_audit;
 v:=private.taxonomy_preview_v1('Сервис бицикала');
 IF v->>'action'<>'REUSE_EXISTING'
    OR (v->>'categoryId')::uuid<>known
    OR v->>'notificationAuthority'<>'NONE' THEN
  RAISE EXCEPTION 'PREVIEW_CYRILLIC_EXISTING_FAILED'; END IF;
 v:=private.taxonomy_preview_v1('Servis bicikla');
 IF v->>'action'<>'REUSE_EXISTING' OR (v->>'categoryId')::uuid<>known THEN
  RAISE EXCEPTION 'PREVIEW_ALIAS_REUSE_FAILED'; END IF;
 v:=private.taxonomy_preview_v1('Dresiranje pasa');
 IF v->>'action'<>'PROPOSE_AUTO_PROVISIONAL'
    OR v->>'registrationEnabled'<>'false'
    OR v->>'normalizedKey'<>'dresiranje pasa'
    OR v->>'requiresRequesterReview'<>'true'
    OR v ? 'categoryId' THEN
  RAISE EXCEPTION 'PREVIEW_NOVEL_CATEGORY_FAILED: %',v; END IF;
 v:=private.taxonomy_preview_v1('Fotografisanje proslave');
 IF v->>'action'<>'PROPOSE_AUTO_PROVISIONAL' THEN
  RAISE EXCEPTION 'PREVIEW_NEW_WORK_NOT_RECOGNIZED'; END IF;
 v:=private.taxonomy_preview_v1('Servis dronova');
 IF v->>'action'<>'SAFETY_REVIEW' THEN RAISE EXCEPTION 'DRONE_NOT_REVIEWED'; END IF;
 v:=private.taxonomy_preview_v1('Ugradnja solarnih panela');
 IF v->>'action'<>'SAFETY_REVIEW' THEN RAISE EXCEPTION 'SOLAR_NOT_REVIEWED'; END IF;
 v:=private.taxonomy_preview_v1('Izrada eksploziva');
 IF v->>'action'<>'REJECT' THEN RAISE EXCEPTION 'PROHIBITED_CATEGORY_NOT_REJECTED'; END IF;
 v:=private.taxonomy_preview_v1('Obuka robota');
 IF v->>'action'<>'CLARIFY' THEN RAISE EXCEPTION 'UNKNOWN_ACTION_NOT_CLARIFIED'; END IF;
 v:=private.taxonomy_preview_v1('<script>alert(1)</script>');
 IF v->>'action'<>'CLARIFY' THEN RAISE EXCEPTION 'INJECTION_NOT_CLARIFIED'; END IF;
 INSERT INTO private.work_taxonomy_aliases(category_id,locale,label)
 VALUES (known,'sr','Izrada ukrasa'),(other,'en','Izrada ukrasa');
 v:=private.taxonomy_preview_v1('Izrada ukrasa');
 IF v->>'action'<>'CLARIFY' OR v->>'reason'<>'AMBIGUOUS_ALIAS_COLLISION' THEN
  RAISE EXCEPTION 'CROSS_LOCALE_COLLISION_NOT_CLARIFIED'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>before_cat
 OR (SELECT count(*) FROM private.work_taxonomy_audit)<>before_audit THEN
  RAISE EXCEPTION 'PREVIEW_MUTATED_CATALOG_OR_AUDIT';
 END IF;
 RAISE NOTICE 'DISPOSABLE_TAXONOMY_READ_ONLY_PREVIEW_PASS';
END
$assert$;
