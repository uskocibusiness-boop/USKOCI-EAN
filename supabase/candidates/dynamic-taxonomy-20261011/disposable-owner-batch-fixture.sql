-- Disposable ONLY. After single-plan fixture+proof: catalog version 5.
\set ON_ERROR_STOP on
INSERT INTO private.worker_ai_reviews(id,account_id,envelope,expires_at) VALUES
('10000000-0000-4000-8000-000000000007','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours'),
('10000000-0000-4000-8000-000000000009','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours'),
('10000000-0000-4000-8000-000000000010','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours'),
('10000000-0000-4000-8000-000000000011','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"canAccept":true}'::jsonb,now()+interval '2 hours');
INSERT INTO private.ai_task_reviews(id,account_id,envelope,expires_at) VALUES
('10000000-0000-4000-8000-000000000008','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"canAccept":true}'::jsonb,now()+interval '2 hours'),
('10000000-0000-4000-8000-000000000012','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"canAccept":true}'::jsonb,now()+interval '2 hours');

-- Isolated mock of NEW review builder: signs candidate plans IN the SAME
-- review digest as the normal worker skill list / requester category and mode.
-- Real app must display ordinary service names / mode, never the internal IDs.
CREATE OR REPLACE FUNCTION private.disposable_sign_batch_review(
 p_purpose text,p_review_id uuid,p_plans jsonb,
 p_skills jsonb DEFAULT '[]'::jsonb,
 p_reviewed_modes jsonb DEFAULT '[]'::jsonb,
 p_geography_mode text DEFAULT 'STATIONARY'
) RETURNS text LANGUAGE plpgsql AS $sign$
DECLARE v_doc jsonb;v_policy jsonb;v_base text;v_digest text;v_fingerprint text;
 v_version bigint;
BEGIN
 SELECT catalog_version INTO STRICT v_version FROM private.work_taxonomy_control WHERE singleton;
 v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
 IF p_purpose='WORKER_CAPABILITY' THEN
  SELECT envelope,base_hash INTO STRICT v_doc,v_base FROM private.worker_ai_reviews
   WHERE id=p_review_id;
  v_doc:=(v_doc-'displayedContentDigest')||jsonb_build_object(
   'profile',jsonb_build_object('skills',p_skills),
   'reviewedServiceModes',p_reviewed_modes,
   'classificationCandidates',p_plans,
   'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint
  );
  v_digest:=encode(extensions.digest((v_doc||jsonb_build_object('baseHash',v_base))::text,'sha256'),'hex');
  UPDATE private.worker_ai_reviews SET envelope=v_doc||jsonb_build_object('displayedContentDigest',v_digest)
   WHERE id=p_review_id;
 ELSIF p_purpose='NEED_SERVICE' THEN
  SELECT envelope,policy_binding INTO STRICT v_doc,v_policy FROM private.ai_task_reviews
   WHERE id=p_review_id;
  v_doc:=(v_doc-'displayedContentDigest')||jsonb_build_object(
   'publicProjection',jsonb_build_array(jsonb_build_object(
      'key','need.category','value',p_skills->>0)),
   'location',jsonb_build_object('geography',jsonb_build_object('mode',p_geography_mode)),
   'classificationCandidates',p_plans,
   'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint
  );
  v_digest:=encode(extensions.digest(jsonb_build_object('envelope',v_doc,'policy',v_policy)::text,'sha256'),'hex');
  UPDATE private.ai_task_reviews SET envelope=v_doc||jsonb_build_object('displayedContentDigest',v_digest)
   WHERE id=p_review_id;
 ELSE RAISE EXCEPTION 'DISPOSABLE_PURPOSE_INVALID'; END IF;
 RETURN v_digest;
END $sign$;
