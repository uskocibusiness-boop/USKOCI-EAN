-- Every assertion is transactional and uses no real account/Need data.
DO $proof$
DECLARE v jsonb; p jsonb; q jsonb;
BEGIN
 v:=private.taxonomy_review_exact_projection_v1(
 'WORKER_CAPABILITY','["Krečenje zidova","Izrada prezentacija"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"},{"service":"Izrada prezentacija","mode":"REMOTE"}]'::jsonb);
 IF v->>'status'<>'READY' OR jsonb_array_length(v->'classificationCandidates')<>2
    OR jsonb_array_length(v->'reviewedServiceModes')<>2
    OR v#>>'{classificationCandidates,0,categoryId}'<>'11111111-1111-4111-8111-111111111111'
    OR v#>>'{classificationCandidates,1,categoryId}'<>'22222222-2222-4222-8222-222222222222'
    OR length(v->>'classificationCatalogFingerprint')<>32
 THEN RAISE EXCEPTION 'EXACT_WORKER_REVIEW_FAILED: %',v; END IF;
 IF v#>>'{classificationCandidates,1,mode}'<>'REMOTE' OR
    v#>>'{classificationCandidates,0,mode}'<>'ON_SITE'
 THEN RAISE EXCEPTION 'MODE_CROSS_INHERITANCE'; END IF;
 -- An existing verified server alias reuses SAME canonical UUID.
 v:=private.taxonomy_review_exact_projection_v1(
 'NEED_SERVICE','["Pravljenje prezentacija"]'::jsonb,
 '[{"service":"Pravljenje prezentacija","mode":"REMOTE"}]'::jsonb);
 IF v->>'status'<>'READY' OR v#>>'{classificationCandidates,0,categoryId}'
    <>'22222222-2222-4222-8222-222222222222'
    OR jsonb_array_length(v->'reviewedServiceModes')<>0 THEN
  RAISE EXCEPTION 'NEED_ALIAS_REUSE_FAILED %',v;END IF;
 v:=private.taxonomy_review_exact_projection_v1(
 'WORKER_CAPABILITY','["Izrada prezentacija"]'::jsonb,'[]'::jsonb);
 IF v->>'status'='READY' THEN RAISE EXCEPTION 'EMPTY_GLOBAL_MODE_GRANTS_CONSENT'; END IF;
 v:=private.taxonomy_review_exact_projection_v1(
 'WORKER_CAPABILITY','["Krečenje zidova","Izrada prezentacija"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 IF v->>'status'<>'SERVICE_MODE_CONFIRMATION_REQUIRED'
    OR jsonb_array_length(v->'classificationCandidates')<>0 THEN
  RAISE EXCEPTION 'PARTIAL_WORKER_CONSENT_GRANTED: %',v;END IF;
 v:=private.taxonomy_review_exact_projection_v1(
 'WORKER_CAPABILITY','["Izrada prezentacija"]'::jsonb,
 '[{"service":"Izrada prezentacija","mode":"ON_SITE"}]'::jsonb);
 IF v->>'status'<>'PENDING_CLASSIFICATION' THEN RAISE EXCEPTION 'REMOTE_SCOPE_LEAK';END IF;
 v:=private.taxonomy_review_exact_projection_v1(
 'NEED_SERVICE','["Restauracija antičkih globusa"]'::jsonb,
 '[{"service":"Restauracija antičkih globusa","mode":"ON_SITE"}]'::jsonb);
 IF v->>'status'<>'PENDING_CLASSIFICATION' OR jsonb_array_length(v->'classificationCandidates')<>0
 THEN RAISE EXCEPTION 'UNKNOWN_FORCE_CLASSIFIED'; END IF;
 v:=private.taxonomy_review_exact_projection_v1(
 'NEED_SERVICE','["Iznajmljivanje klizaljki"]'::jsonb,
 '[{"service":"Iznajmljivanje klizaljki","mode":"ON_SITE"}]'::jsonb);
 IF v#>>'{classificationCandidates,0,categoryId}'<>'44444444-4444-4444-8444-444444444444'
 THEN RAISE EXCEPTION 'SKATING_SERVICES_COLLAPSED';END IF;
 -- Never sign another worker service that was not part of current saved skills.
 v:=private.taxonomy_review_exact_projection_v1(
 'WORKER_CAPABILITY','["Krečenje zidova"]'::jsonb,
 '[{"service":"Časovi umetničkog klizanja","mode":"ON_SITE"}]'::jsonb);
 IF v->>'status'='READY' THEN RAISE EXCEPTION 'FOREIGN_SKILL_ACCEPTED';END IF;
 -- Model or client cannot sneak a duplicate owner mode into the signed batch.
 v:=private.taxonomy_review_exact_projection_v1(
 'WORKER_CAPABILITY','["Krečenje zidova"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"},{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 IF v->>'status'='READY' THEN RAISE EXCEPTION 'DUPLICATE_CONSENT_ACCEPTED';END IF;
 -- Catalog changes change review fence; they cannot be missed by a static version.
 p:=private.taxonomy_review_exact_projection_v1(
 'NEED_SERVICE','["Krečenje zidova"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 INSERT INTO private.work_taxonomy_aliases VALUES
 ('33333333-3333-4333-8333-333333333333','sr','novi potvrdjeni sinonim');
 q:=private.taxonomy_review_exact_projection_v1(
 'NEED_SERVICE','["Krečenje zidova"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 IF p->>'classificationCatalogFingerprint'=q->>'classificationCatalogFingerprint'
 THEN RAISE EXCEPTION 'FINGERPRINT_FAILED_TO_FENCE_LEGACY_WRITER'; END IF;
 -- An alias that ambiguously points at different established categories cannot approve either.
 INSERT INTO private.work_taxonomy_aliases VALUES
 ('33333333-3333-4333-8333-333333333333','sr','krečenje zidova');
 v:=private.taxonomy_review_exact_projection_v1(
 'NEED_SERVICE','["Krečenje zidova"]'::jsonb,
 '[{"service":"Krečenje zidova","mode":"ON_SITE"}]'::jsonb);
 IF v->>'status'<>'PENDING_CLASSIFICATION' THEN
 RAISE EXCEPTION 'AMBIGUOUS_ALIAS_ACCEPTED: %',v; END IF;
END $proof$;
-- Only definer-owned review RPC may invoke this helper, not public API roles.
DO $priv$
BEGIN
 IF has_function_privilege('anon','private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('service_role','private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'REVIEW_PROJECTION_PUBLIC_EXECUTE'; END IF;
END $priv$;
