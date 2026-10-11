-- Disposable PostgreSQL proof: old live Gemini NEED_FACT_V2 interface is
-- need.category TEXT + need.description TEXT + explicit required_skills [].
-- This proof does NOT call Gemini, change canonical NEEDS or send anything.
DO $test$
DECLARE
 painting uuid;
 p jsonb;
 before_cat bigint;
 before_alias bigint;
 before_audit bigint;
 before_version bigint;
BEGIN
 SELECT id INTO STRICT painting
 FROM private.work_taxonomy_categories
 WHERE canonical_key='krecenje zidova';
 SELECT count(*) INTO before_cat FROM private.work_taxonomy_categories;
 SELECT count(*) INTO before_alias FROM private.work_taxonomy_aliases;
 SELECT count(*) INTO before_audit FROM private.work_taxonomy_audit;
 SELECT catalog_version INTO before_version FROM private.work_taxonomy_control;

 -- The actual AI already interprets the whole conversational description;
 -- DO NOT demand that its structured category equal a hardcoded utterance.
 FOREACH p IN ARRAY ARRAY[
  jsonb_build_object('category','Krečenje sobe',
    'description','Treba da okrečim stan od 90 kvadrata. Kuhinja i dnevna soba.',
    'skills','[]'::jsonb),
  jsonb_build_object('category','Кречење стана',
    'description','Želim molera za dve sobe u Novom Sadu.', 'skills','[]'::jsonb),
  jsonb_build_object('category','Farbanje zidova',
    'description','Sređujem dnevnu sobu i tražim majstora.',
    'skills','[]'::jsonb),
  jsonb_build_object('category','Krečenje 2 sobe',
    'description','Potrebna usluga sledeće nedelje. 35 m2.',
    'skills','[]'::jsonb)
 ] LOOP
  DECLARE result jsonb;
  BEGIN
   result:=private.taxonomy_existing_ai_category_preview_v1(
     p->>'category',p->>'description',ARRAY[]::text[]);
   IF result->>'action'<>'SUGGEST_EXISTING_SERVICE'
      OR (result->>'categoryId')::uuid<>painting
      OR result->>'requiresRequesterReview'<>'true'
      OR result->>'requiresTaskRevisionBinding'<>'true'
      OR result->>'descriptionSemanticallyVerified'<>'false'
      OR result->>'explicitRequiredSkillsPresent'<>'false'
      OR result->>'classificationAuthority'<>'NONE'
      OR result->>'notificationAuthority'<>'NONE'
   THEN RAISE EXCEPTION 'REAL_GEMINI_V2_CATEGORY_NOT_NORMALIZED: % -> %',
      p,result;
   END IF;
  END;
 END LOOP;

 -- Preserves separately stated requirements; it never infers or overwrites
 -- need.required_skills for the sake of fitting a worker.
 p:=private.taxonomy_existing_ai_category_preview_v1(
   'Krečenje stana','Majstor za stan',ARRAY['gletovanje zidova']::text[]);
 IF p->>'action'<>'SUGGEST_EXISTING_SERVICE'
  OR p->>'explicitRequiredSkillsPresent'<>'true'
  OR p ? 'inferredSkills' OR p ? 'requiredSkills' THEN
   RAISE EXCEPTION 'EXPLICIT_REQUIREMENTS_WERE_REINTERPRETED'; END IF;

 -- A model can propose a genuinely novel kind: no silent insertion and NO
 -- forced classification into one of the old eleven or a nearby category.
 p:=private.taxonomy_existing_ai_category_preview_v1(
   'Montaza 3d stampaca','Treba montirati novi 3D štampač',ARRAY[]::text[]);
 IF p->>'action'<>'NOVEL_SERVICE_REVIEW'
  OR p ? 'categoryId'
  OR p->>'requiresSemanticDeduplication'<>'true'
  OR p->>'notificationAuthority'<>'NONE' THEN
   RAISE EXCEPTION 'NOVEL_MODEL_PROPOSAL_WAS_AUTOMATICALLY_APPROVED: %',p;
 END IF;

 -- Even a good-looking label does not attest that the full description
 -- asks for exactly that one trade. Semantic confirmation remains outstanding.
 p:=private.taxonomy_existing_ai_category_preview_v1(
  'Krečenje stana','Farbanje automobila, ne stana',ARRAY[]::text[]);
 IF p->>'action'<>'SUGGEST_EXISTING_SERVICE'
  OR p->>'descriptionSemanticallyVerified'<>'false' THEN
  RAISE EXCEPTION 'MODEL_DESCRIPTION_MISMATCH_WAS_MARKED_VERIFIED'; END IF;

 p:=private.taxonomy_existing_ai_category_preview_v1(
  'Krečenje stana','Za posao treba i servisiranje drona',ARRAY[]::text[]);
 IF p->>'action'<>'SAFETY_REVIEW' THEN
  RAISE EXCEPTION 'REGULATED_DETAIL_LOST_WHEN_USING_SHORT_AI_CATEGORY'; END IF;
 p:=private.taxonomy_existing_ai_category_preview_v1(
  'Krečenje stana','Tražim izradu eksploziva',ARRAY[]::text[]);
 IF p->>'action'<>'REJECT' THEN
  RAISE EXCEPTION 'UNSAFE_DETAIL_LOST_WHEN_USING_SHORT_AI_CATEGORY'; END IF;

 p:=private.taxonomy_existing_ai_category_preview_v1(
  'Farbanje automobila','Tražim majstora za auto',ARRAY[]::text[]);
 IF p->>'action'<>'CLARIFY'
 OR p->>'reason'<>'POSSIBLE_EXISTING_SERVICE' THEN
  RAISE EXCEPTION 'UNVERIFIED_OBJECT_MERGED_WITH_PAINTING'; END IF;
 p:=private.taxonomy_existing_ai_category_preview_v1(
  'Krečenje stana','Majstor za stan',NULL::text[]);
 IF p->>'action'<>'CLARIFY'
 OR p->>'reason'<>'EXPLICIT_REQUIREMENTS_UNKNOWN' THEN
  RAISE EXCEPTION 'UNKNOWN_SKILL_REQUIREMENTS_WERE_TREATED_AS_EMPTY'; END IF;
 p:=private.taxonomy_existing_ai_category_preview_v1(
  'Krečenje stana','Majstor za stan',ARRAY['']::text[]);
 IF p->>'action'<>'CLARIFY'
 OR p->>'reason'<>'EXPLICIT_REQUIREMENTS_INVALID' THEN
  RAISE EXCEPTION 'INVALID_SKILL_REQUIREMENTS_ACCEPTED'; END IF;

 IF has_function_privilege('anon',
  'private.taxonomy_existing_ai_category_preview_v1(text,text,text[])','EXECUTE')
 OR has_function_privilege('authenticated',
  'private.taxonomy_existing_ai_category_preview_v1(text,text,text[])','EXECUTE')
 THEN RAISE EXCEPTION 'MODEL_BRIDGE_EXPOSED_TO_PUBLIC'; END IF;

 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>before_cat
 OR (SELECT count(*) FROM private.work_taxonomy_aliases)<>before_alias
 OR (SELECT count(*) FROM private.work_taxonomy_audit)<>before_audit
 OR (SELECT catalog_version FROM private.work_taxonomy_control)<>before_version
 THEN RAISE EXCEPTION 'MODEL_BRIDGE_WROTE_CATEGORY_RECORDS'; END IF;
 RAISE NOTICE 'DISPOSABLE_REAL_AI_CATEGORY_BRIDGE_PASS';
END
$test$;
