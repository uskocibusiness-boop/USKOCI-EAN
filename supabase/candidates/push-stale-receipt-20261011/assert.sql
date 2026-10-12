-- A disabled/missing provider must never prevent stale receipt expiration.
DO $test$
DECLARE result jsonb;
BEGIN
  result:=private.edge_worker_tick_v5('2026-10-11T21:00:00+00'::timestamptz);
  IF result->>'kind' IS DISTINCT FROM 'NOT_CONFIGURED' THEN RAISE EXCEPTION 'UNEXPECTED_WORKER_CALL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_push_attempts WHERE id=1 AND transport_state='UNKNOWN' AND outcome='FATAL' AND error_code='RECEIPT_UNAVAILABLE' AND lease_id IS NULL) THEN RAISE EXCEPTION 'STALE_TICKET_NOT_FINALIZED'; END IF;
  IF EXISTS (SELECT 1 FROM public.notification_push_attempts WHERE id IN (2,3,5) AND transport_state<>'TICKET_PENDING') THEN RAISE EXCEPTION 'LIVE_OR_UNLEASED_TICKET_CHANGED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_push_attempts WHERE id=4 AND transport_state='PROVIDER_ACCEPTED') THEN RAISE EXCEPTION 'ACCEPTED_TICKET_CHANGED'; END IF;
  PERFORM private.edge_worker_tick_v5('2026-10-11T21:00:00+00'::timestamptz);
  IF (SELECT count(*) FROM public.notification_push_attempts WHERE transport_state='UNKNOWN')<>1 THEN RAISE EXCEPTION 'CLEANUP_NOT_IDEMPOTENT'; END IF;
END $test$;
SELECT 'STALLED_RECEIPT_SAFE_MAINTENANCE_PASS' proof;
