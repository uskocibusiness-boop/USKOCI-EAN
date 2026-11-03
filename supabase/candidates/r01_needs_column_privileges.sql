-- R01/F21 local candidate; not an admitted migration or a live deployment.
-- After current Auth/PostgREST and rollout compatibility proof, promote with
-- `supabase migration new ...`. Never replay the historical PKG045b rebind.
-- Execute only in a disposable local database with:
-- SET uskoci.r01.disposable = 'LOCAL_ONLY';
-- One DO statement makes revocation, regrant and assertions atomic even when
-- the caller has not opened a transaction. Any failed assertion rolls it back.
DO $r01$
DECLARE
  allowed CONSTANT text[] := ARRAY[
    'id', 'requester_profile_id', 'status', 'title', 'description', 'category',
    'approximate_city', 'approximate_area', 'approximate_lat', 'approximate_lng',
    'schedule_kind', 'starts_at', 'ends_at', 'required_slots', 'mode',
    'requester_price_rsd', 'required_skills', 'required_tools', 'required_vehicles',
    'verified_identity_required', 'urgent', 'public_photo_paths', 'revision',
    'published_at', 'created_at', 'updated_at', 'response_deadline',
    'urgent_activated_at', 'urgent_expires_at', 'urgent_policy_version',
    'minimum_experience_years', 'execution_location_mode', 'approx_geog',
    'required_licenses', 'remaining_search_closed_at', 'task_country_code',
    'task_timezone', 'price_basis'
  ];
  target_roles oid[];
  before_acl jsonb;
  after_acl jsonb;
  phase integer;
BEGIN
  IF current_setting('uskoci.r01.disposable', true) IS DISTINCT FROM 'LOCAL_ONLY' THEN
    RAISE EXCEPTION 'R01_DISPOSABLE_TARGET_REQUIRED';
  END IF;
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE public.needs IN ACCESS EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.needs'::regclass
      AND relkind = 'r' AND NOT relispartition AND relrowsecurity
      AND pg_get_userbyid(relowner) = 'postgres')
    OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = 'public.needs'::regclass
      OR inhparent = 'public.needs'::regclass) THEN
    RAISE EXCEPTION 'R01_RELATION_PRECONDITION';
  END IF;
  -- No implicit grant for category_id or any future column. Every added public
  -- field requires an explicit consumer/privacy review and an allowlist edit.
  IF EXISTS (SELECT 1 FROM unnest(allowed) c WHERE NOT EXISTS (
      SELECT 1 FROM pg_attribute WHERE attrelid = 'public.needs'::regclass
      AND attname = c AND attnum > 0 AND NOT attisdropped)) THEN
    RAISE EXCEPTION 'R01_PUBLIC_COLUMN_MISSING';
  END IF;
  target_roles := ARRAY[0::oid, 'anon'::regrole::oid, 'authenticated'::regrole::oid];
  FOR phase IN 1..2 LOOP
    -- Check all non-SELECT grants and every other principal's SELECT grants.
    -- This includes service_role and explicit column grants/grant options.
    SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.column_number, a.grantor,
      a.grantee, a.privilege_type, a.is_grantable), '[]'::jsonb) INTO after_acl
    FROM (
      SELECT 0 AS column_number, x.* FROM pg_class c
      CROSS JOIN LATERAL aclexplode(c.relacl) x
      WHERE c.oid = 'public.needs'::regclass
      UNION ALL
      SELECT c.attnum AS column_number, x.* FROM pg_attribute c
      CROSS JOIN LATERAL aclexplode(c.attacl) x
      WHERE c.attrelid = 'public.needs'::regclass AND c.attnum > 0 AND NOT c.attisdropped
    ) a WHERE a.privilege_type <> 'SELECT' OR NOT a.grantee = ANY(target_roles);
    IF phase = 1 THEN
      before_acl := after_acl;
      -- PostgreSQL table REVOKE also removes this privilege's column grants.
      -- Regrant the reviewed columns in the same atomic statement.
      REVOKE SELECT ON TABLE public.needs FROM PUBLIC, anon, authenticated;
      GRANT SELECT (
        id, requester_profile_id, status, title, description, category,
        approximate_city, approximate_area, approximate_lat, approximate_lng,
        schedule_kind, starts_at, ends_at, required_slots, mode,
        requester_price_rsd, required_skills, required_tools, required_vehicles,
        verified_identity_required, urgent, public_photo_paths, revision,
        published_at, created_at, updated_at, response_deadline,
        urgent_activated_at, urgent_expires_at, urgent_policy_version,
        minimum_experience_years, execution_location_mode, approx_geog,
        required_licenses, remaining_search_closed_at, task_country_code,
        task_timezone, price_basis
      ) ON TABLE public.needs TO authenticated;
    ELSIF after_acl IS DISTINCT FROM before_acl THEN
      RAISE EXCEPTION 'R01_UNRELATED_PRIVILEGE_CHANGED';
    END IF;
  END LOOP;
  -- Effective privileges detect inherited/PUBLIC paths, not just direct ACLs.
  -- RESTRICT is intentional: fail atomically on unknown dependent grants.
  IF has_table_privilege('authenticated', 'public.needs', 'SELECT')
    OR has_table_privilege('anon', 'public.needs', 'SELECT')
    OR EXISTS (SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = 'public.needs'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND (has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT')
        OR has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
           IS DISTINCT FROM (a.attname = ANY(allowed)))) THEN
    RAISE EXCEPTION 'R01_EFFECTIVE_COLUMN_BOUNDARY_FAILED';
  END IF;
  -- RLS, RPCs, account guards, writers and closure certificates are untouched.
  -- ACLs participate in closure digests. Do not recertify a preexisting false
  -- readiness state; complete that separate review before any live rollout.
  NOTIFY pgrst, 'reload schema';
END;
$r01$;
