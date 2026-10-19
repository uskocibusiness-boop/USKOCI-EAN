BEGIN;
SELECT proof.require(private.taxonomy_risk_triage_v1('3D štampa')='NEEDS_CLARIFICATION', 'BEFORE_NOUN_PHRASE_BLOCKED');
SELECT proof.require(private.taxonomy_risk_triage_v1('Časovi engleskog')='NEEDS_CLARIFICATION', 'BEFORE_NATURAL_SERVICE_BLOCKED');
SELECT proof.reset();
SELECT proof.require(proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],ARRAY['Digitalni zanati','Izrada test figurica'])->>'status'='PENDING_CLASSIFICATION', 'BEFORE_STRUCTURAL_PARENT_BLOCKED');
SELECT proof.reset();
SELECT proof.expect_error($s$SELECT proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],
 ARRAY['Izrada nivo jedan','Izrada nivo dva','Izrada nivo tri','Izrada nivo cetiri',
 'Izrada nivo pet','Izrada nivo sest','Izrada nivo sedam','Izrada nivo osam'])$s$,'TAXONOMY_CAPTURE_PLAN_INVALID');
-- Reproduce the late-capture race: the previous implementation attaches an old
-- successful turn to the source of a later completion.
SELECT proof.reset();
SELECT proof.prepare('CREATE_NEW_BRANCH',ARRAY['REMOTE'],ARRAY['Izrada test figurica']);
DELETE FROM private.work_taxonomy_gemini_turn_hints_v1;
UPDATE private.worker_ai_sessions SET revision=2;
SELECT proof.require(proof.capture('WORKER_CAPABILITY')->>'action'='HINT_CAPTURED','BEFORE_OLD_WORKER_TURN_BORROWS_NEW_REVISION');
SELECT proof.reset();SELECT proof.seed_need_completion();
INSERT INTO public.ai_messages VALUES(proof.id(46),proof.id(2),proof.id(1),'ASSISTANT',2);
SELECT proof.require(proof.capture('NEED_SERVICE')->>'action'='HINT_CAPTURED','BEFORE_OLD_NEED_TURN_BORROWS_NEW_MESSAGES');
SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.function_before b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE md5(pg_get_functiondef(p.oid))<>b.definition_md5 OR p.proowner<>b.proowner
 OR p.proacl IS DISTINCT FROM b.proacl OR p.proconfig IS DISTINCT FROM b.proconfig),'BEFORE_OR_ROLLBACK_EXACT_FUNCTIONS');
ROLLBACK;
SELECT 'NATURAL_BRANCH_BEFORE_REPRODUCED' result;
