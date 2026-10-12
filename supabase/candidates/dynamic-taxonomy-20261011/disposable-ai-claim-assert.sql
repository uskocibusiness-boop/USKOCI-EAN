-- Actual SQL assertion: model-supplied IDs, area and work meaning grant nothing.
DO $test$
DECLARE
 original text := 'Treba mi neko da okreči dnevnu sobu od 25 kvadrata.';
 srv jsonb;
 proposal jsonb;
 reviewed jsonb;
 count_before bigint;
 audit_before bigint;
BEGIN
 SELECT count(*) INTO count_before FROM private.work_taxonomy_categories;
 SELECT count(*) INTO audit_before FROM private.work_taxonomy_audit;
 srv:=private.taxonomy_natural_task_preview_v1(original);
 IF srv->>'action'<>'REUSE_EXISTING' OR srv->>'areaSqm'<>'25' THEN
  RAISE EXCEPTION 'TRAILING_PUNCTUATION_NATURAL_PREVIEW_FAIL: %',srv; END IF;
 proposal:=jsonb_build_object(
  'categoryId',srv->>'categoryId',
  'normalizedAction',srv->>'normalizedAction',
  'normalizedScope',srv->>'normalizedScope',
  'areaSqm',25);
 reviewed:=private.taxonomy_ai_claim_review_v1(original,proposal);
 IF reviewed->>'action'<>'READY_FOR_REQUESTER_REVIEW'
 OR reviewed->>'proofType'<>'INDEPENDENT_SERVER_GRAMMAR'
 OR reviewed->>'requiresRequesterReview'<>'true'
 OR reviewed->>'publishAuthority'<>'NONE'
 OR reviewed->>'notificationAuthority'<>'NONE'
 OR reviewed->>'categoryId' IS DISTINCT FROM srv->>'categoryId' THEN
  RAISE EXCEPTION 'VALIDATED_AI_CLAIM_WRONGLY_GRANTED_AUTHORITY: %',reviewed;
 END IF;
 -- A model cannot rewrite a verified category, scope or quantity.
 FOREACH proposal IN ARRAY ARRAY[
  jsonb_build_object('categoryId',gen_random_uuid()::text,'normalizedAction','okreci','normalizedScope','dnevnu sobu','areaSqm',25),
  jsonb_build_object('categoryId',srv->>'categoryId','normalizedAction','gletovanje','normalizedScope','dnevnu sobu','areaSqm',25),
  jsonb_build_object('categoryId',srv->>'categoryId','normalizedAction','okreci','normalizedScope','automobila','areaSqm',25),
  jsonb_build_object('categoryId',srv->>'categoryId','normalizedAction','okreci','normalizedScope','dnevnu sobu','areaSqm',250),
  jsonb_build_object('categoryId',srv->>'categoryId','normalizedAction','okreci','normalizedScope','dnevnu sobu','areaSqm','25'),
  jsonb_build_object('categoryId',srv->>'categoryId','normalizedAction','okreci','normalizedScope','dnevnu sobu'),
  '{}'::jsonb, 'null'::jsonb, '[]'::jsonb
 ] LOOP
  reviewed:=private.taxonomy_ai_claim_review_v1(original,proposal);
  IF reviewed->>'action'<>'CLARIFY'
   OR reviewed->>'reason'<>'AI_CLAIM_NOT_VERIFIED'
   OR reviewed ? 'categoryId'
   OR reviewed->>'publishAuthority'<>'NONE'
   OR reviewed->>'notificationAuthority'<>'NONE'
  THEN RAISE EXCEPTION 'UNTRUSTED_AI_CLAIM_NOT_DENIED: % -> %',proposal,reviewed; END IF;
 END LOOP;

 -- A tempting "painting" proposal MUST NOT override the original multiple-
 -- trade request or its unsafe text, even with otherwise matching fields.
 reviewed:=private.taxonomy_ai_claim_review_v1(
  'Treba mi neko da okreči sobu i zameni prozor',proposal);
 IF reviewed->>'action'<>'CLARIFY' THEN
  RAISE EXCEPTION 'UNVERIFIED_COMPOUND_CLAIM_PASSED'; END IF;
 reviewed:=private.taxonomy_ai_claim_review_v1(
  'Treba mi neko da okreči sobu i servisira dron',proposal);
 IF reviewed->>'action'<>'SAFETY_REVIEW' THEN
  RAISE EXCEPTION 'RISKY_WORK_CONTEXT_IGNORED'; END IF;
 reviewed:=private.taxonomy_ai_claim_review_v1(
  'Treba mi neko da izradi eksploziv',proposal);
 IF reviewed->>'action'<>'REJECT' THEN
  RAISE EXCEPTION 'PROHIBITED_CONTEXT_IGNORED'; END IF;
 IF has_function_privilege('anon','private.taxonomy_ai_claim_review_v1(text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_ai_claim_review_v1(text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'AI_REVIEW_MUST_NOT_BE_PUBLIC_RPC'; END IF;
 IF (SELECT count(*) FROM private.work_taxonomy_categories)<>count_before
 OR (SELECT count(*) FROM private.work_taxonomy_audit)<>audit_before THEN
  RAISE EXCEPTION 'AI_CLAIM_REVIEW_CHANGED_CATALOG'; END IF;
 RAISE NOTICE 'DISPOSABLE_AI_CLAIM_SERVER_REVIEW_PASS';
END
$test$;
