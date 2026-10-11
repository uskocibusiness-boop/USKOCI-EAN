-- Rollback is function-only: it does not reopen terminal attempts or change data.
INSERT INTO public.notification_push_attempts(id,transport_state,ticket_received_at) VALUES(6,'TICKET_PENDING','2026-09-26T16:11:48+00');
DO $test$
BEGIN
 PERFORM private.edge_worker_tick_v5('2026-10-11T21:00:00+00'::timestamptz);
 IF NOT EXISTS (SELECT 1 FROM public.notification_push_attempts WHERE id=1 AND transport_state='UNKNOWN') THEN RAISE EXCEPTION 'ROLLBACK_REOPENED_ATTEMPT'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.notification_push_attempts WHERE id=6 AND transport_state='TICKET_PENDING') THEN RAISE EXCEPTION 'ORIGINAL_SOURCE_NOT_RESTORED'; END IF;
END $test$;
SELECT 'STALLED_RECEIPT_ROLLBACK_PASS' proof;
