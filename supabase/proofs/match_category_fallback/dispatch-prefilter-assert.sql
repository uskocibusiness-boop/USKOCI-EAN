\set ON_ERROR_STOP on
-- SYNTHETIC DISPOSABLE POSTGRES ONLY. This calls the byte-exact current
-- private.dispatch_cheap_candidate_admitted and worker_need_match_v1 bodies.
-- Calendar/world/identity helpers are stubs; dispatch_next_wave is NOT called.
BEGIN;
SAVEPOINT dispatch_prefilter_cases;
CREATE FUNCTION private.prove_dispatch_gate(expect_admitted boolean, case_label text)
RETURNS void LANGUAGE plpgsql AS $proof$
DECLARE admitted boolean;
BEGIN
 admitted:=private.dispatch_cheap_candidate_admitted(
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222');
 IF admitted IS DISTINCT FROM expect_admitted
 THEN RAISE EXCEPTION 'DISPATCH_GATE_FAIL_%_expected_%_got_%',case_label,expect_admitted,admitted; END IF;
END $proof$;
-- Separate requester, cleaning, same city, future/calendar synthetic flag on.
SELECT private.prove_dispatch_gate(true,'qualified_cleaning');
-- Unknown and unrelated AI categories MUST NOT pass the real dispatch prefilter.
UPDATE public.needs SET category='Dostava hrane',required_skills='{}';
SELECT private.prove_dispatch_gate(false,'unrelated_delivery');
UPDATE public.needs SET category=NULL;
SELECT private.prove_dispatch_gate(false,'null_category_is_not_wildcard');
UPDATE public.needs SET category='Čišćenje stana';
SELECT private.prove_dispatch_gate(true,'restored_cleaning');
-- Identity ownership and status hard blockers.
UPDATE public.needs SET requester_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT private.prove_dispatch_gate(false,'own_need');
UPDATE public.needs SET requester_account_id='44444444-4444-4444-8444-444444444444';
UPDATE public.app_profiles SET profile_status='SUSPENDED'
 WHERE id='22222222-2222-4222-8222-222222222222';
SELECT private.prove_dispatch_gate(false,'suspended_worker');
UPDATE public.app_profiles SET profile_status='ACTIVE'
 WHERE id='22222222-2222-4222-8222-222222222222';
-- Proactive pause is explicitly applied by the ACTUAL dispatch prefilter.
UPDATE public.worker_match_preferences SET proactive_notifications=false
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
SELECT private.prove_dispatch_gate(false,'proactive_paused');
UPDATE public.worker_match_preferences SET proactive_notifications=true
 WHERE worker_profile_id='22222222-2222-4222-8222-222222222222';
SELECT private.prove_dispatch_gate(true,'proactive_resumed');
-- The boolean calendar tier is a synthetic helper, NOT a full calendar proof.
UPDATE private.synthetic_time SET allowed=false
 WHERE pid='22222222-2222-4222-8222-222222222222';
SELECT private.prove_dispatch_gate(false,'calendar_stub_rejected');
UPDATE private.synthetic_time SET allowed=true
 WHERE pid='22222222-2222-4222-8222-222222222222';
SELECT private.prove_dispatch_gate(true,'calendar_stub_restored');
-- Concrete duplicate-prevention predicate is a REAL dispatch prefilter check.
INSERT INTO public.opportunity_deliveries(worker_account_id,need_id,need_revision)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',1);
SELECT private.prove_dispatch_gate(false,'same_worker_same_need_revision_already_delivered');
UPDATE public.needs SET revision=2;
SELECT private.prove_dispatch_gate(true,'new_revision_does_not_hit_old_dedupe');
UPDATE public.needs SET revision=1;
SELECT private.prove_dispatch_gate(false,'return_to_old_revision_rejects_duplicate');
DELETE FROM public.opportunity_deliveries;
SELECT private.prove_dispatch_gate(true,'dedupe_removed');
-- Onsite city fallback without a worker GPS center; no claims of 10-km geometry.
UPDATE public.needs SET approximate_city='Petrovaradin',
 execution_location_mode='STATIONARY';
SELECT private.prove_dispatch_gate(false,'petrovaradin_without_center');
UPDATE public.needs SET approximate_city='Novi Sad';
SELECT private.prove_dispatch_gate(true,'same_city_fallback');
UPDATE public.needs SET approximate_city='Petrovaradin',
 execution_location_mode='REMOTE';
SELECT private.prove_dispatch_gate(true,'remote_ignores_area');
-- Explicit required skills override the AI category for automatic selection.
UPDATE public.needs SET category='Čišćenje stana',
 required_skills=ARRAY['Selidbe'], execution_location_mode='STATIONARY',
 approximate_city='Novi Sad';
SELECT private.prove_dispatch_gate(false,'explicit_moving_skill_overrides_cleaning_category');
UPDATE public.needs SET required_skills='{}';
SELECT private.prove_dispatch_gate(true,'fallback_restored_after_explicit_override');
-- No data from this script persists, not even in the disposable database.
ROLLBACK TO SAVEPOINT dispatch_prefilter_cases;
RELEASE SAVEPOINT dispatch_prefilter_cases;
ROLLBACK;
