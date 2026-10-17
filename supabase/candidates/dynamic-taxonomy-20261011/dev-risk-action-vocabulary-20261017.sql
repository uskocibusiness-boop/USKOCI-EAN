-- USKOCI DEV, 2026-10-17: smallest reversible vocabulary-only correction.
-- This does NOT create categories, aliases, reviews, worker abilities, matches or push.
-- Nor does it enable taxonomy auto registration. It only changes LOW_RISK_CANDIDATE
-- triage for two ordinary service noun/verb forms confirmed missing on DEV.
-- This is NOT an open-ended safety policy or final new-category admission.
-- Preconditions and invariant checks intentionally fail closed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE _uskoci_risk_before ON COMMIT DROP AS
 SELECT (SELECT count(*) FROM private.work_taxonomy_categories) AS category_count,
        (SELECT count(*) FROM private.work_taxonomy_aliases) AS alias_count,
        (SELECT count(*) FROM private.work_taxonomy_audit) AS audit_count,
        (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton) AS auto_enabled;
DO $guard$
BEGIN
 IF to_regclass('private.work_taxonomy_risk_actions') IS NULL
 OR to_regprocedure('private.taxonomy_risk_triage_v1(text)') IS NULL
 OR (SELECT auto_enabled FROM _uskoci_risk_before) IS DISTINCT FROM false
 OR EXISTS(SELECT 1 FROM private.work_taxonomy_risk_actions
   WHERE normalized_action IN ('dresura','sklapanje') AND enabled IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'USKOCI_RISK_VOCABULARY_PRECONDITION_FAILED'; END IF;
END $guard$;
INSERT INTO private.work_taxonomy_risk_actions(normalized_action,policy_version,enabled)
 VALUES ('dresura',1,true),('sklapanje',1,true)
 ON CONFLICT (normalized_action) DO NOTHING;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM private.work_taxonomy_risk_actions
   WHERE normalized_action IN ('dresura','sklapanje') AND enabled)=2
 AND private.taxonomy_risk_triage_v1('Dresura pasa')='LOW_RISK_CANDIDATE'
 AND private.taxonomy_risk_triage_v1('Sklapanje namestaja')='LOW_RISK_CANDIDATE'
 AND private.taxonomy_risk_triage_v1('Izrada eksploziva')='BLOCKED'
 AND private.taxonomy_risk_triage_v1('Servis solarnih panela')='REVIEW_REQUIRED'
 AND private.taxonomy_risk_triage_v1('Ostalo poslovi')='NEEDS_CLARIFICATION'
 AND (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)=false
 AND (SELECT count(*) FROM private.work_taxonomy_categories)=(SELECT category_count FROM _uskoci_risk_before)
 AND (SELECT count(*) FROM private.work_taxonomy_aliases)=(SELECT alias_count FROM _uskoci_risk_before)
 AND (SELECT count(*) FROM private.work_taxonomy_audit)=(SELECT audit_count FROM _uskoci_risk_before)
 THEN RETURN; END IF;
 RAISE EXCEPTION 'USKOCI_RISK_VOCABULARY_POSTCHECK_FAILED';
END $verify$;
COMMIT;
-- DEV rollback after checking dependency/use: DELETE FROM
-- private.work_taxonomy_risk_actions WHERE normalized_action IN ('dresura','sklapanje')
-- AND policy_version=1; never remove an action adopted by a later policy.
