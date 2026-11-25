-- Owner decision 25.11.2026: once agreed, the term is not renegotiated through the app. Each party of a Dogovor marks
-- its own working period (a day, from-to, half or whole day). The period is private to its author, fills that person's
-- schedule, and an overlap with another of their periods only warns; it never refuses.
CREATE TABLE private.agreement_personal_periods (
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agreement_id, account_id),
  CONSTRAINT agreement_personal_periods_range CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '14 days')
);
CREATE INDEX agreement_personal_periods_account_time ON private.agreement_personal_periods (account_id, starts_at, ends_at);
ALTER TABLE private.agreement_personal_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.agreement_personal_periods FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rpc_set_my_agreement_period(p_agreement_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_agreement public.agreements;
  v_overlaps jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000'; END IF;
  IF p_agreement_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL OR NOT isfinite(p_starts_at) OR NOT isfinite(p_ends_at)
    OR p_ends_at <= p_starts_at OR p_ends_at - p_starts_at > interval '14 days' THEN
    RAISE EXCEPTION 'PERIOD_INVALID' USING errcode = '22023';
  END IF;
  SELECT * INTO v_agreement FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND OR v_uid NOT IN (v_agreement.requester_account_id, v_agreement.worker_account_id) THEN
    RAISE EXCEPTION 'AGREEMENT_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_agreement.status <> 'CONFIRMED' THEN RAISE EXCEPTION 'AGREEMENT_NOT_ACTIVE' USING errcode = '22023'; END IF;
  PERFORM private.closure_assert_open(v_uid, NULL);
  INSERT INTO private.agreement_personal_periods (agreement_id, account_id, starts_at, ends_at, updated_at)
  VALUES (p_agreement_id, v_uid, p_starts_at, p_ends_at, now())
  ON CONFLICT (agreement_id, account_id) DO UPDATE SET starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = now();
  -- Only a warning: the person's other marked periods that overlap this one.
  SELECT coalesce(jsonb_agg(p.agreement_id ORDER BY p.starts_at), '[]'::jsonb) INTO v_overlaps
  FROM private.agreement_personal_periods p
  JOIN public.agreements a ON a.id = p.agreement_id AND a.status = 'CONFIRMED'
  WHERE p.account_id = v_uid AND p.agreement_id <> p_agreement_id AND p.starts_at < p_ends_at AND p.ends_at > p_starts_at;
  RETURN jsonb_build_object('authoritative', true, 'agreementId', p_agreement_id, 'startsAt', p_starts_at, 'endsAt', p_ends_at,
    'overlaps', v_overlaps);
END $fn$;

CREATE FUNCTION public.rpc_clear_my_agreement_period(p_agreement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000'; END IF;
  DELETE FROM private.agreement_personal_periods WHERE agreement_id = p_agreement_id AND account_id = v_uid;
  RETURN jsonb_build_object('authoritative', true, 'agreementId', p_agreement_id, 'cleared', true);
END $fn$;

CREATE FUNCTION public.rpc_get_my_agreement_periods(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to OR NOT isfinite(p_from) OR NOT isfinite(p_to) OR p_to - p_from > interval '800 days' THEN
    RAISE EXCEPTION 'PERIOD_RANGE_INVALID' USING errcode = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('agreementId', p.agreement_id, 'startsAt', p.starts_at, 'endsAt', p.ends_at,
    'agreementStatus', a.status) ORDER BY p.starts_at, p.agreement_id), '[]'::jsonb) INTO v_rows
  FROM private.agreement_personal_periods p
  JOIN public.agreements a ON a.id = p.agreement_id AND v_uid IN (a.requester_account_id, a.worker_account_id)
  WHERE p.account_id = v_uid AND p.starts_at < p_to AND p.ends_at > p_from;
  RETURN jsonb_build_object('authoritative', true, 'from', p_from, 'to', p_to, 'periods', v_rows);
END $fn$;

REVOKE ALL ON FUNCTION public.rpc_set_my_agreement_period(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_clear_my_agreement_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_get_my_agreement_periods(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_my_agreement_period(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_clear_my_agreement_period(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_my_agreement_periods(timestamptz, timestamptz) TO authenticated, service_role;
