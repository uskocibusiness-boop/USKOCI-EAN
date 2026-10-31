-- R08/S14: narrow REMOTE-only worker activation, LOCAL_ONLY candidate, NEVER a migration.
-- The live RPC currently rejects a missing city even for a fully confirmed REMOTE-only worker.
-- Keep every existing owner/DRAFT/name/skill/activation/requeue contract and fail closed
-- unless EVERY saved skill maps uniquely to an existing, active, consented REMOTE category.
-- Do not trust the profile-wide mode hint: it explicitly has matchingAuthority=NONE.
-- This may run only in isolated PostgreSQL after R01/R10/approval gates; it changes no DEV.
BEGIN;
DO $admission$
BEGIN
 IF current_setting('uskoci.r08.remote_only.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
 OR current_database()<>'postgres' OR current_user<>'postgres'
 OR to_regrole('cli_login_postgres') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_REMOTE_LOCAL_ONLY' USING errcode='55000'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('public.rpc_complete_worker_profile(uuid)')))
    IS DISTINCT FROM 'ba85aa79219961646c387ab64156a073'
 OR to_regprocedure('private.taxonomy_normalize_v1(text)') IS NULL
 OR to_regclass('private.taxonomy_confirmed_worker_modes_v1') IS NULL
 OR to_regclass('private.work_taxonomy_worker_capabilities') IS NULL
 OR to_regclass('private.work_taxonomy_categories') IS NULL
 OR to_regclass('private.work_taxonomy_aliases') IS NULL
 OR to_regprocedure('private.worker_remote_only_activation_ready_v1(uuid,text[])') IS NOT NULL
 THEN RAISE EXCEPTION 'R08_REMOTE_OWNER_DRIFT' USING errcode='55000'; END IF;
END; $admission$;

-- TESTABLE FUNCTION BEGINS.
CREATE FUNCTION private.worker_remote_only_activation_ready_v1(p_account uuid,p_skills text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog' AS $f$
DECLARE v_skill text;v_norm text;v_category uuid;v_matches bigint;
BEGIN
 IF p_account IS NULL OR p_skills IS NULL OR cardinality(p_skills)=0 THEN RETURN false; END IF;
 -- Any still-active on-site/unknown mode blocks a city-free activation, including
 -- services omitted from the current display or retained from another review.
 IF EXISTS(SELECT 1 FROM private.taxonomy_confirmed_worker_modes_v1 m
   JOIN private.work_taxonomy_worker_capabilities cap
    ON cap.worker_account_id=m.worker_account_id AND cap.category_id=m.category_id
   WHERE m.worker_account_id=p_account AND m.active
    AND cap.excluded IS FALSE AND m.execution_scope IS DISTINCT FROM 'REMOTE')
 THEN RETURN false; END IF;
 FOREACH v_skill IN ARRAY p_skills LOOP
  IF v_skill IS NULL OR char_length(btrim(v_skill)) NOT BETWEEN 3 AND 120 THEN RETURN false; END IF;
  v_norm:=private.taxonomy_normalize_v1(v_skill);
  IF v_norm IS NULL OR v_norm='' THEN RETURN false; END IF;
  SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_matches,v_category
  FROM private.work_taxonomy_categories c
  WHERE c.state='ESTABLISHED' AND
    (c.canonical_key=v_norm OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
      WHERE a.category_id=c.id AND a.normalized_key=v_norm));
  IF v_matches<>1 OR v_category IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
   SELECT 1 FROM private.work_taxonomy_worker_capabilities cap
   JOIN private.taxonomy_confirmed_worker_modes_v1 m
    ON m.worker_account_id=cap.worker_account_id AND m.category_id=cap.category_id
   WHERE cap.worker_account_id=p_account AND cap.category_id=v_category
    AND cap.excluded IS FALSE AND m.active IS TRUE AND m.execution_scope='REMOTE'
    AND m.confirmed_at IS NOT NULL
  ) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END; $f$;
-- TESTABLE FUNCTION ENDS.
REVOKE ALL ON FUNCTION private.worker_remote_only_activation_ready_v1(uuid,text[])
 FROM PUBLIC,anon,authenticated,service_role;

-- Exact-source, fail-closed surgical patch. Never changes legacy city requirements
-- for ON_SITE, BOTH, unknown modes, missing categories, or unsigned skill lists.
DO $patch$
DECLARE v_old text;v_new text;v_anchor text;
BEGIN
 v_old:=pg_get_functiondef(to_regprocedure('public.rpc_complete_worker_profile(uuid)'));
 v_anchor:='if char_length(btrim(v_profile.city)) < 2 then';
 IF v_old IS NULL OR length(v_old)-length(replace(v_old,v_anchor,''))<>length(v_anchor)
 THEN RAISE EXCEPTION 'R08_REMOTE_ACTIVATION_ANCHOR_DRIFT' USING errcode='55000'; END IF;
 v_new:=replace(v_old,v_anchor,
  'if char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_uid,v_profile.skills) IS NOT TRUE then');
 EXECUTE v_new;
 IF position('private.worker_remote_only_activation_ready_v1(v_uid,v_profile.skills) IS NOT TRUE'
   in pg_get_functiondef(to_regprocedure('public.rpc_complete_worker_profile(uuid)')))=0
 THEN RAISE EXCEPTION 'R08_REMOTE_ACTIVATION_NOT_GATED' USING errcode='55000'; END IF;
END; $patch$;
COMMIT;
