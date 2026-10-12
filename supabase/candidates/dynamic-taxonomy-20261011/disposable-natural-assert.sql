-- Standalone disposable proof; must run after disposable-meaning-assert.sql.
-- The preview does NOT establish real AI semantic understanding, send authority,
-- actual worker capability, requester approval, or an approved publish revision.
DO $test$
DECLARE
 painting uuid;
 p jsonb;
 v text;
 original_count bigint;
 original_audit bigint;
 original_version bigint;
 original_skills bigint;
 original_snapshots bigint;
BEGIN
 SELECT id INTO STRICT painting FROM private.work_taxonomy_categories
 WHERE canonical_key='krecenje zidova';
 INSERT INTO private.work_taxonomy_sentence_prefixes(normalized_prefix,provenance_ref)
 VALUES
 ('treba mi neko da','synthetic-reviewed-utterance-v1'),
 ('treba mi majstor da','synthetic-reviewed-utterance-v1'),
 ('trazim majstora za','synthetic-reviewed-utterance-v1'),
 ('potrebno je','synthetic-reviewed-utterance-v1');
 INSERT INTO private.work_taxonomy_service_verbs(category_id,normalized_action,source_ref)
 VALUES (painting,'okreci','synthetic-reviewed-inflected-verb-v1');
 INSERT INTO private.work_taxonomy_service_scopes
 (category_id,normalized_scope,scope_role,source_ref)
 VALUES (painting,'dnevnu sobu','PLACE','synthetic-reviewed-v1');
 SELECT count(*) INTO original_count FROM private.work_taxonomy_categories;
 SELECT count(*) INTO original_audit FROM private.work_taxonomy_audit;
 SELECT catalog_version INTO original_version FROM private.work_taxonomy_control;
 SELECT count(*) INTO original_skills FROM private.work_taxonomy_worker_capabilities;
 SELECT count(*) INTO original_snapshots FROM private.work_taxonomy_need_snapshots;

 FOREACH v IN ARRAY ARRAY[
   'Treba mi neko da okreči dnevnu sobu od 25 kvadrata',
   'Треба ми неко да окречи дневну собу од 25 квадрата',
   'Treba mi majstor da okreči dnevnu sobu od 25 m2'
 ] LOOP
   p:=private.taxonomy_natural_task_preview_v1(v);
   IF p->>'action'<>'REUSE_EXISTING'
      OR (p->>'categoryId')::uuid<>painting
      OR (p->>'areaSqm')::integer<>25
      OR p->>'normalizedAction'<>'okreci'
      OR p->>'normalizedScope'<>'dnevnu sobu'
      OR p->>'proofType'<>'VERIFIED_GRAMMAR'
      OR p->>'notificationAuthority'<>'NONE'
      OR p->>'requiresRequesterReview'<>'true'
      OR p->>'requiresFullEligibility'<>'true'
   THEN RAISE EXCEPTION 'NATURAL_PAINTING_EXTRACTION_FAILED: % -> %',v,p;
   END IF;
 END LOOP;
 p:=private.taxonomy_natural_task_preview_v1(
 'Tražim majstora za krečenje stana od 80 m²');
 IF p->>'action'<>'REUSE_EXISTING'
    OR (p->>'categoryId')::uuid<>painting
    OR (p->>'areaSqm')::integer<>80 THEN
   RAISE EXCEPTION 'APARTMENT_AREA_NOT_PARSED: %',p;
 END IF;
 p:=private.taxonomy_natural_task_preview_v1(
 'Potrebno je krečenje 2 sobe od 30 m2');
 IF p->>'action'<>'REUSE_EXISTING'
    OR (p->>'categoryId')::uuid<>painting
    OR (p->>'areaSqm')::integer<>30 THEN
   RAISE EXCEPTION 'QUANTITY_NOT_TASK_SCOPE: %',p;
 END IF;
 p:=private.taxonomy_natural_task_preview_v1('Krečenje sobe');
 IF p->>'action'<>'REUSE_EXISTING'
    OR (p->>'categoryId')::uuid<>painting
    OR p->>'areaSqm' IS NOT NULL THEN
   RAISE EXCEPTION 'BARE_SERVICE_NOT_CLASSIFIED: %',p;
 END IF;
 -- Unknown work or unverified scope cannot create a new category or notification.
 FOREACH v IN ARRAY ARRAY[
  'Treba mi neko da okreči automobila od 25 kvadrata',
  'Treba mi neko da okreči dnevnu sobu od 25000 kvadrata',
  'Treba mi neko da okreči dnevnu sobu od 0 kvadrata',
  'Treba mi neko da okreči dnevnu sobu od 25 kvadrata i ugradi utičnicu',
  'Treba mi neko da okreči sobu i zameni prozor',
  'Treba mi neko da okreči kupatilo',
  'Trazim nekoga ko bi mogao da mi okreci dnevnu sobu',
  'Treba mi neko da okreči dnevnu sobu od 25 kvadrata kod komšije',
  'Potrebno je farbanje stolarije',
  'Potrebno je gletovanje plafona'
 ] LOOP
   p:=private.taxonomy_natural_task_preview_v1(v);
   IF p->>'action'<>'CLARIFY' OR p ? 'categoryId' THEN
    RAISE EXCEPTION 'UNVERIFIED_TASK_GOT_SERVICE: % -> %',v,p;
   END IF;
 END LOOP;
 p:=private.taxonomy_natural_task_preview_v1(
 'Treba mi neko da okreči sobu i servisira dron');
 IF p->>'action'<>'SAFETY_REVIEW' THEN
  RAISE EXCEPTION 'RISK_IN_SENTENCE_WAS_HIDDEN_BY_EXTRACTOR: %',p;
 END IF;
 p:=private.taxonomy_natural_task_preview_v1(
 'Treba mi neko da izradi eksploziv');
 IF p->>'action'<>'REJECT' THEN
  RAISE EXCEPTION 'BLOCKED_CONTENT_IN_SENTENCE_WAS_LOST: %',p;
 END IF;
 p:=private.taxonomy_natural_task_preview_v1('<script>okreci</script>');
 IF p->>'action'<>'CLARIFY' OR p->>'reason'<>'INVALID_TEXT' THEN
  RAISE EXCEPTION 'MALFORMED_NATURAL_TEXT_NOT_REJECTED';
 END IF;
 IF has_function_privilege('anon','private.taxonomy_natural_task_preview_v1(text)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_natural_task_preview_v1(text)','EXECUTE')
 OR NOT has_function_privilege('service_role','private.taxonomy_natural_task_preview_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'NATURAL_TASK_PREVIEW_EXPOSED'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>original_count
 OR (SELECT count(*) FROM private.work_taxonomy_audit)<>original_audit
 OR (SELECT catalog_version FROM private.work_taxonomy_control)<>original_version
 OR (SELECT count(*) FROM private.work_taxonomy_worker_capabilities)<>original_skills
 OR (SELECT count(*) FROM private.work_taxonomy_need_snapshots)<>original_snapshots
 THEN RAISE EXCEPTION 'READ_ONLY_NATURAL_PREVIEW_MUTATED_CATALOG_OR_WORKERS'; END IF;
 RAISE NOTICE 'DISPOSABLE_NATURAL_TASK_PREVIEW_PASS';
END
$test$;
