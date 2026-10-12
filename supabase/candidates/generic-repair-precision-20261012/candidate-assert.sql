\set ON_ERROR_STOP on
-- Assert narrower intermediary matcher against real captured dispatch prefilter.
DO $proof$
DECLARE
 laptop uuid := '80000000-0000-4000-8000-000000000001';
 printer uuid := '80000000-0000-4000-8000-000000000002';
 generalist uuid := '80000000-0000-4000-8000-000000000003';
 printer_job uuid := '82000000-0000-4000-8000-000000000001';
 laptop_job uuid := '82000000-0000-4000-8000-000000000002';
BEGIN
 IF NOT private.dispatch_cheap_candidate_admitted(printer_job,printer) THEN
  RAISE EXCEPTION 'SPECIALIST_EXACT_PRINTER_NO_LONGER_MATCHES';
 END IF;
 IF NOT private.dispatch_cheap_candidate_admitted(laptop_job,laptop) THEN
  RAISE EXCEPTION 'SPECIALIST_EXACT_LAPTOP_NO_LONGER_MATCHES';
 END IF;
 IF private.dispatch_cheap_candidate_admitted(printer_job,laptop)
   OR private.dispatch_cheap_candidate_admitted(laptop_job,printer) THEN
  RAISE EXCEPTION 'CROSS_SPECIALIST_REPAIR_FALSE_POSITIVE';
 END IF;
 IF private.dispatch_cheap_candidate_admitted(printer_job,generalist)
   OR private.dispatch_cheap_candidate_admitted(laptop_job,generalist) THEN
  RAISE EXCEPTION 'GENERIC_HANDYMAN_AUTHORIZES_UNCONFIRMED_SPECIALTY';
 END IF;
 -- Existing 11-kind exact same-service matching must remain intact.
 IF NOT private.dispatch_cheap_candidate_admitted(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222') THEN
  RAISE EXCEPTION 'EXISTING_CLEANING_REGRESSION';
 END IF;
 RAISE NOTICE 'REPAIR_PRECISION_PASS: exact confirmed specialists yes, cross-domain and generic guesses no';
END $proof$;
SELECT private.dispatch_next_wave('82000000-0000-4000-8000-000000000001') AS printer_wave;
DO $proof$
DECLARE cnt integer;
BEGIN
 SELECT count(*) INTO cnt FROM public.opportunity_deliveries
 WHERE need_id='82000000-0000-4000-8000-000000000001';
 IF cnt<>1 THEN RAISE EXCEPTION 'PRINTER_WAVE_WRONG_COUNT_%',cnt; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.opportunity_deliveries
  WHERE need_id='82000000-0000-4000-8000-000000000001'
    AND worker_account_id='81000000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'PRINTER_WAVE_WRONG_RECIPIENT'; END IF;
 RAISE NOTICE 'REPAIR_PRECISION_REAL_DISPATCH_PASS: exact printer expert only';
END $proof$;
