-- USKOCI: worker-owned execution-mode CHOICES, not skill entitlements.
-- DEV additive migration. NOT integrated into dispatch; no opportunity events.
-- Caller = verified auth.uid(), never client-supplied owner / worker account ID.
-- Explicit UI save; Gemini can only suggest, never mark consent.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';

DO $guard$
BEGIN
 IF to_regclass('private.worker_execution_mode_choices') IS NOT NULL
 OR to_regprocedure('public.rpc_set_worker_execution_modes(uuid,text[])') IS NOT NULL
 OR to_regprocedure('public.rpc_get_worker_execution_modes(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'USKOCI_WORKER_MODE_CHOICES_ALREADY_INSTALLED'; END IF;
 IF to_regclass('public.app_profiles') IS NULL
 OR to_regprocedure('auth.uid()') IS NULL
 THEN RAISE EXCEPTION 'USKOCI_WORKER_MODE_AUTH_OR_PROFILE_MISSING'; END IF;
END $guard$;

CREATE TABLE private.worker_execution_mode_choices (
 worker_profile_id uuid PRIMARY KEY REFERENCES public.app_profiles(id) ON DELETE CASCADE,
 worker_account_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
 modes text[] NOT NULL,
 consent_source text NOT NULL DEFAULT 'EXPLICIT_PROFILE_REVIEW' CHECK(consent_source='EXPLICIT_PROFILE_REVIEW'),
 confirmed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
);
-- Persisted CHECK accepts only three canonical combinations, no other input.
ALTER TABLE private.worker_execution_mode_choices
 ADD CONSTRAINT valid_worker_execution_modes CHECK (
  modes=ARRAY['ON_SITE']::text[] OR
  modes=ARRAY['REMOTE']::text[] OR
  modes=ARRAY['ON_SITE','REMOTE']::text[]
 );
CREATE INDEX worker_execution_mode_choices_account_idx
 ON private.worker_execution_mode_choices(worker_account_id);

ALTER TABLE private.worker_execution_mode_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.worker_execution_mode_choices FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rpc_get_worker_execution_modes(
 p_worker_profile_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog
AS $fn$
DECLARE v_account uuid:=auth.uid(); v_profile public.app_profiles; v_modes text[]; v_at timestamptz;
BEGIN
 IF v_account IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 SELECT p.* INTO v_profile FROM public.app_profiles p
 WHERE p.id=p_worker_profile_id AND p.account_id=v_account AND p.kind='WORKER';
 IF NOT FOUND THEN RAISE EXCEPTION 'WORKER_PROFILE_NOT_OWNED' USING errcode='42501'; END IF;
 SELECT m.modes,m.confirmed_at INTO v_modes,v_at
 FROM private.worker_execution_mode_choices m
 WHERE m.worker_profile_id=p_worker_profile_id AND m.worker_account_id=v_account;
 RETURN jsonb_build_object('workerProfileId',p_worker_profile_id,'modes',to_jsonb(coalesce(v_modes,ARRAY[]::text[])),
  'confirmed',v_at IS NOT NULL,'confirmedAt',v_at,
  'matchingAuthority','NONE','notificationAuthority','NONE');
END $fn$;

CREATE OR REPLACE FUNCTION public.rpc_set_worker_execution_modes(
 p_worker_profile_id uuid,
 p_modes text[]
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog
AS $fn$
DECLARE v_account uuid:=auth.uid(); v_profile public.app_profiles; v_modes text[];
BEGIN
 IF v_account IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 IF p_worker_profile_id IS NULL OR p_modes IS NULL OR cardinality(p_modes) NOT BETWEEN 1 AND 2
   OR array_position(p_modes,NULL) IS NOT NULL
   OR NOT (p_modes <@ ARRAY['ON_SITE','REMOTE']::text[])
   OR (SELECT count(DISTINCT x) FROM unnest(p_modes) AS x)<>cardinality(p_modes)
 THEN RAISE EXCEPTION 'WORKER_EXECUTION_MODES_INVALID' USING errcode='22023'; END IF;
 SELECT p.* INTO v_profile FROM public.app_profiles p
 WHERE p.id=p_worker_profile_id
 FOR UPDATE;
 IF NOT FOUND OR v_profile.account_id IS DISTINCT FROM v_account
   OR v_profile.kind IS DISTINCT FROM 'WORKER'
 THEN RAISE EXCEPTION 'WORKER_PROFILE_NOT_OWNED' USING errcode='42501'; END IF;
 IF v_profile.profile_status NOT IN ('DRAFT','ACTIVE')
 THEN RAISE EXCEPTION 'WORKER_PROFILE_NOT_EDITABLE' USING errcode='42501'; END IF;
 v_modes:=CASE WHEN 'ON_SITE'=ANY(p_modes) AND 'REMOTE'=ANY(p_modes)
  THEN ARRAY['ON_SITE','REMOTE']::text[]
  WHEN 'ON_SITE'=ANY(p_modes) THEN ARRAY['ON_SITE']::text[]
  ELSE ARRAY['REMOTE']::text[] END;
 INSERT INTO private.worker_execution_mode_choices(worker_profile_id,worker_account_id,modes)
 VALUES(p_worker_profile_id,v_account,v_modes)
 ON CONFLICT(worker_profile_id) DO UPDATE SET modes=excluded.modes,
   confirmed_at=statement_timestamp(),updated_at=statement_timestamp()
 WHERE private.worker_execution_mode_choices.worker_account_id=v_account
   AND private.worker_execution_mode_choices.modes IS DISTINCT FROM excluded.modes;
 RETURN jsonb_build_object('workerProfileId',p_worker_profile_id,
  'modes',to_jsonb(v_modes),'confirmed',true,
  'matchingAuthority','NONE','notificationAuthority','NONE',
  'note','PREFERENCE_ONLY_UNTIL_MATCHER_INTEGRATION');
END $fn$;

-- Supabase has explicit default grants on public functions.
REVOKE ALL ON FUNCTION public.rpc_get_worker_execution_modes(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_set_worker_execution_modes(uuid,text[])
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_worker_execution_modes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_worker_execution_modes(uuid,text[]) TO authenticated;

DO $postflight$
BEGIN
 IF has_table_privilege('authenticated','private.worker_execution_mode_choices','SELECT')
 OR has_table_privilege('service_role','private.worker_execution_mode_choices','INSERT')
 OR has_function_privilege('anon','public.rpc_set_worker_execution_modes(uuid,text[])','EXECUTE')
 OR has_function_privilege('service_role','public.rpc_set_worker_execution_modes(uuid,text[])','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.rpc_set_worker_execution_modes(uuid,text[])','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.rpc_get_worker_execution_modes(uuid)','EXECUTE')
 OR (SELECT COUNT(*) FROM private.worker_execution_mode_choices)<>0
 OR (SELECT auto_registration_enabled FROM private.work_taxonomy_control WHERE singleton)
 THEN RAISE EXCEPTION 'WORKER_EXECUTION_MODE_CHOICES_POSTFLIGHT_FAILED'; END IF;
END $postflight$;