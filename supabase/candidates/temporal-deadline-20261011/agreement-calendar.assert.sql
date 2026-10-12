-- Real captured DEV parser, synthetic agreement terms. No worker, push or DB mutation.
SET TIME ZONE 'UTC';
DO $proof$
DECLARE
  v_terms jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_expected timestamptz := '2026-10-12T07:00:00+02:00'::timestamptz;
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc
      WHERE oid='private.agreement_calendar_interval(jsonb)'::regprocedure)
    IS DISTINCT FROM 'c75b53c50a362718f607da4d74c333cb'
  THEN RAISE EXCEPTION 'EXACT_AGREEMENT_PARSER_SOURCE_DRIFT'; END IF;

  -- A selected start-only task stores its beginning independently, with no
  -- proposed interval. The REAL parser returns both NULL: never reserve
  -- an imagined end or reject an otherwise valid confirmed agreement.
  v_terms := jsonb_build_object(
    'price_rsd',4000,'covered_slots',1,'schedule_source','UNSCHEDULED',
    'declared_start_at',v_expected,
    'proposed_start_at',NULL::timestamptz,
    'proposed_end_at',NULL::timestamptz
  );
  IF (v_terms->>'declared_start_at')::timestamptz IS DISTINCT FROM v_expected
  THEN RAISE EXCEPTION 'DECLARED_START_SNAPSHOT_LOST'; END IF;
  SELECT starts_at,ends_at INTO v_start,v_end
    FROM private.agreement_calendar_interval(v_terms);
  IF v_start IS NOT NULL OR v_end IS NOT NULL
  THEN RAISE EXCEPTION 'START_ONLY_FABRICATED_CALENDAR_BOOKING'; END IF;

  -- A truly unscheduled flexible task is still allowed.
  SELECT starts_at,ends_at INTO v_start,v_end FROM private.agreement_calendar_interval(
    '{"proposed_start_at":null,"proposed_end_at":null}'::jsonb);
  IF v_start IS NOT NULL OR v_end IS NOT NULL
  THEN RAISE EXCEPTION 'FLEXIBLE_CALENDAR_REGRESSION'; END IF;

  -- An actual full interval is still precise.
  SELECT starts_at,ends_at INTO v_start,v_end
    FROM private.agreement_calendar_interval(
      '{"proposed_start_at":"2026-10-12T07:00:00+02:00","proposed_end_at":"2026-10-12T09:30:00+02:00"}'::jsonb);
  IF v_start IS DISTINCT FROM v_expected OR
     v_end IS DISTINCT FROM '2026-10-12T09:30:00+02:00'::timestamptz
  THEN RAISE EXCEPTION 'FULL_AGREEMENT_INTERVAL_REGRESSION'; END IF;

  -- A repeated Serbian civil clock across DST must not collapse two distinct instants.
  SELECT starts_at,ends_at INTO v_start,v_end
    FROM private.agreement_calendar_interval(
      '{"proposed_start_at":"2026-10-25T02:30:00+02:00","proposed_end_at":"2026-10-25T02:30:00+01:00"}'::jsonb);
  IF v_end-v_start IS DISTINCT FROM interval '1 hour'
  THEN RAISE EXCEPTION 'DST_REPEATED_HOUR_COLLAPSED'; END IF;

  -- A malformed proposed interval remains forbidden. This is distinct
  -- from declared_start_at: a lone PROPOSED start never licenses a booking.
  BEGIN
    PERFORM * FROM private.agreement_calendar_interval(
      '{"proposed_start_at":"2026-10-12T07:00:00+02:00","proposed_end_at":null}'::jsonb);
    RAISE EXCEPTION 'HALF_PROPOSED_INTERVAL_ADMITTED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM * FROM private.agreement_calendar_interval(
      '{"proposed_start_at":null,"proposed_end_at":"2026-10-12T09:00:00+02:00"}'::jsonb);
    RAISE EXCEPTION 'END_ONLY_PROPOSED_INTERVAL_ADMITTED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM * FROM private.agreement_calendar_interval(
      '{"proposed_start_at":"2026-10-12T10:00:00+02:00","proposed_end_at":"2026-10-12T08:00:00+02:00"}'::jsonb);
    RAISE EXCEPTION 'REVERSED_PROPOSED_INTERVAL_ADMITTED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM * FROM private.agreement_calendar_interval(
      '{"proposed_start_at":"2026-02-30T07:00:00+01:00","proposed_end_at":"2026-03-02T08:00:00+01:00"}'::jsonb);
    RAISE EXCEPTION 'INVALID_CIVIL_DAY_ADMITTED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM * FROM private.agreement_calendar_interval(
      '{"proposed_start_at":123,"proposed_end_at":"2026-10-12T09:00:00+02:00"}'::jsonb);
    RAISE EXCEPTION 'INVALID_TIME_TYPE_ADMITTED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END $proof$;
SELECT 'START_ONLY_AGREEMENT_REAL_PARSER_PASS' AS proof;
