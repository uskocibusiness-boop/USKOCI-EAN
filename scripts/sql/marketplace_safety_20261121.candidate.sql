-- USKOCI 2026-11-21: marketplace safety package (owner-approved local work).
-- SOURCE-ONLY CANDIDATE. No DEV/PROD execution is authorized by this file.
--   1. A blocked pair (private.safety_pair_blocked, either direction) never sees the other side's open task in
--      discovery, the open-task list or the task read, and the requester never sees the blocked worker among the
--      candidates. The hidden row is simply absent (same as "not found"); no block reason is projected.
--      rpc_discovery_v1, rpc_list_open_tasks_v3 and rpc_read_task are SECURITY INVOKER readers of public.needs, so the
--      one authority is the needs_public_discovery RLS policy; their bodies stay unchanged (guarded below).
--      Keyset cursors stay valid: the filter only removes rows, it never changes sort keys or filterKey/scopeKey.
--   2. Owner decision 2026-11-20: a worker whose newest sent application for a task is WITHDRAWN cannot apply to
--      that task again (APPLICATION_WITHDRAWN_FINAL, P0001, no write). Idempotent replay of an earlier command is kept.
--   3. Phone numbers are never shared: a new PHONE grant and a PHONE reveal are refused (PHONE_SHARING_DISABLED,
--      42501); revoking an older PHONE grant still works; the workspace keeps the theirPhone key as null.
--      EXACT_LOCATION grants and reveals are unchanged.
-- Preimages: scripts/sql/rollback_marketplace_safety_preimage_20261121.sql (read-only DEV capture, md5-verified).
DO $source_only$
BEGIN
  RAISE EXCEPTION 'MARKETPLACE_SAFETY_SOURCE_ONLY';
END
$source_only$;

-- MARKETPLACE_SAFETY_20261121_ISOLATED_START
-- Remove the guard only in a disposable PG17 fixture or after a separately reviewed Supabase CLI migration
-- has been prepared. Never run this script in the SQL editor.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- The policy is the authority for the three invoker readers only while they stay invoker readers of the same body.
DO $invoker_readers_guard$
DECLARE
  expected jsonb := jsonb_build_object(
    'public.rpc_discovery_v1(jsonb)', 'dc53bf4f14b1e35fdb1e12ff883d1edb',
    'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamp with time zone,uuid)', '8e8ee643e72c9efab746b6a9e7f6ec08',
    'public.rpc_read_task(uuid)', '6989659ffc9d6445333ab06e6df9c597');
  sig text;
  actual record;
BEGIN
  FOR sig IN SELECT jsonb_object_keys(expected) LOOP
    SELECT md5(p.prosrc) body_md5, p.prosecdef, p.proconfig INTO actual
      FROM pg_proc p WHERE p.oid = to_regprocedure(sig);
    IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM expected->>sig OR actual.prosecdef IS DISTINCT FROM false
       OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
    THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_INVOKER_READER_DRIFT' USING detail = sig; END IF;
  END LOOP;
  SELECT md5(p.prosrc) body_md5, pg_get_userbyid(p.proowner) owner, p.proacl::text acl, p.prosecdef, p.proconfig,
         p.provolatile, p.prorettype::regtype::text rettype
    INTO actual FROM pg_proc p WHERE p.oid = to_regprocedure('private.safety_pair_blocked(uuid,uuid)');
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM '698fb21abb0379743bc7ab09d9f946ad' OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.provolatile IS DISTINCT FROM 's'
     OR actual.rettype IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PAIR_BLOCKED_DRIFT'; END IF;
END
$invoker_readers_guard$;

-- One evaluation per statement (InitPlan), the same rule as private.safety_pair_blocked: an ACTIVE block in either
-- direction. Both branches are index lookups (the primary key for the blocker side, the new partial index for the
-- blocked side), so the policy never calls a SECURITY DEFINER function per needs row.
DO $block_helper$
DECLARE
  r text;
  actual record;
BEGIN
  IF to_regprocedure('rls_private.viewer_block_counterparties()') IS NOT NULL
     OR to_regclass('private.account_blocks_blocked_active_idx') IS NOT NULL
  THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_BLOCK_HELPER_PREIMAGE_DRIFT'; END IF;
  IF (SELECT nspacl::text FROM pg_namespace WHERE nspname = 'rls_private') IS DISTINCT FROM '{postgres=UC/postgres,authenticated=U/postgres}'
     OR (SELECT string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY a.attname)
           FROM pg_attribute a WHERE a.attrelid = to_regclass('private.account_blocks')
            AND a.attname IN ('active','blocked_account_id','blocker_account_id') AND NOT a.attisdropped)
        IS DISTINCT FROM 'active:boolean,blocked_account_id:uuid,blocker_account_id:uuid'
  THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_BLOCK_HELPER_CONTEXT_DRIFT'; END IF;

  CREATE INDEX account_blocks_blocked_active_idx
    ON private.account_blocks (blocked_account_id, blocker_account_id) WHERE active;

  CREATE FUNCTION rls_private.viewer_block_counterparties()
   RETURNS uuid[]
   LANGUAGE sql
   STABLE SECURITY DEFINER
   SET search_path TO 'pg_catalog'
  AS $fn$
  -- Accounts in an ACTIVE block with the caller, in either direction (private.safety_pair_blocked semantics).
  -- Used only inside RLS as an InitPlan; the caller sees rows disappear, never a reason.
  select coalesce(array_agg(distinct x.other order by x.other), array[]::uuid[])
  from (
    select b.blocked_account_id as other from private.account_blocks b
     where b.active and b.blocker_account_id = auth.uid()
    union all
    select b.blocker_account_id from private.account_blocks b
     where b.active and b.blocked_account_id = auth.uid()
  ) x
  $fn$;
  REVOKE ALL ON FUNCTION rls_private.viewer_block_counterparties() FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION rls_private.viewer_block_counterparties() FROM %I', r);
    END IF;
  END LOOP;
  GRANT EXECUTE ON FUNCTION rls_private.viewer_block_counterparties() TO authenticated;

  SELECT pg_get_userbyid(p.proowner) owner, p.proacl::text acl, p.prosecdef, p.proconfig, p.provolatile INTO actual
    FROM pg_proc p WHERE p.oid = to_regprocedure('rls_private.viewer_block_counterparties()');
  IF actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.provolatile IS DISTINCT FROM 's'
  THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_BLOCK_HELPER_POSTIMAGE_MISMATCH'; END IF;
END
$block_helper$;

DO $discovery_policy_block$
DECLARE
  actual record;
BEGIN
  SELECT md5(p.qual) qual_md5, p.permissive, p.roles::text roles, p.cmd, p.with_check INTO actual
    FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'needs' AND p.policyname = 'needs_public_discovery';
  IF NOT FOUND OR actual.qual_md5 IS DISTINCT FROM '7d2b4a721dfb96bc3a5cac893aefe939' OR actual.permissive IS DISTINCT FROM 'PERMISSIVE'
     OR actual.roles IS DISTINCT FROM '{authenticated}' OR actual.cmd IS DISTINCT FROM 'SELECT' OR actual.with_check IS NOT NULL
     OR (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.needs'::regclass) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_DISCOVERY_POLICY_PREIMAGE_DRIFT'; END IF;

  ALTER POLICY needs_public_discovery ON public.needs
    USING (((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))))
      AND NOT (requester_account_id = ANY (COALESCE(( SELECT rls_private.viewer_block_counterparties()), ARRAY[]::uuid[])))));

  SELECT p.qual, p.permissive, p.roles::text roles, p.cmd, p.with_check INTO actual
    FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'needs' AND p.policyname = 'needs_public_discovery';
  IF actual.permissive IS DISTINCT FROM 'PERMISSIVE' OR actual.roles IS DISTINCT FROM '{authenticated}'
     OR actual.cmd IS DISTINCT FROM 'SELECT' OR actual.with_check IS NOT NULL
     OR position('rls_private.viewer_block_counterparties()' in actual.qual) = 0
     OR position('rls_private.p6_discovery_test_world_accounts()' in actual.qual) = 0
     OR position('''PUBLISHED''::text, ''SELECTION''::text' in actual.qual) = 0
     OR EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'needs'
                AND p.policyname = 'v5_closed_account_visibility' AND p.permissive IS DISTINCT FROM 'RESTRICTIVE')
  THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_DISCOVERY_POLICY_POSTIMAGE_MISMATCH'; END IF;
END
$discovery_policy_block$;

DO $candidates_block$ DECLARE target regprocedure := 'public.rpc_list_need_candidates(uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), classified as ($old$,$new$    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
      -- A blocked pair (either direction) is absent from the requester's candidates.
      and not private.safety_pair_blocked(v_actor, r.worker_account_id)
  ), classified as ($new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '4096a29c4ef6dbaeb987a58a9c9dba32' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_CANDIDATES_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_CANDIDATES_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '754d506f7367b111505972cce43b4b10' OR actual.metadata IS DISTINCT FROM original_metadata
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_CANDIDATES_POSTIMAGE_MISMATCH'; END IF;
END $candidates_block$;

DO $candidates_page_block$ DECLARE target regprocedure := 'public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), page as materialized ($old$,$new$    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
      -- A blocked pair (either direction) is absent before paging: keyset cursor and total stay consistent.
      and not private.safety_pair_blocked(v_actor, r.worker_account_id)
  ), page as materialized ($new$],
 ARRAY[$old$The keys of the whole set are read
  -- with no function call;$old$,$new$The keys of the whole set are read
  -- with only the blocked-pair check;$new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '11b6ca6fa48ac74b76c6e7cd09c25c3c' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_CANDIDATES_PAGE_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_CANDIDATES_PAGE_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'f1b2109e7e5d0d751ce30a28c001d6fa' OR actual.metadata IS DISTINCT FROM original_metadata
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_CANDIDATES_PAGE_POSTIMAGE_MISMATCH'; END IF;
END $candidates_page_block$;

DO $submit_withdrawn_final$ DECLARE target regprocedure := 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;
$old$,$new$  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  -- Owner decision 2026-11-20: a withdrawn application is final for this task. The newest sent application
  -- decides, the same row rpc_get_my_task_relations shows; a replay of an earlier command already returned above.
  if (select r.status from public.marketplace_responses r
       where r.need_id = p_need_id and r.worker_account_id = u and r.status <> 'DRAFT'
       order by r.created_at desc, r.id desc limit 1) = 'WITHDRAWN' then
    raise exception using errcode='P0001', message='APPLICATION_WITHDRAWN_FINAL',
      hint='Povukli ste prijavu za ovaj zadatak. Ponovna prijava nije moguća.';
  end if;
$new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'ad117da224ba9e4a3f7d70611aeaa6d8' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_SUBMIT_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_SUBMIT_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM 'dc49b5ad5382f5877644b4b6cddcc119' OR actual.metadata IS DISTINCT FROM original_metadata
 OR position('pg_advisory_xact_lock' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)) = 0
 OR position('IDEMPOTENCY_KEY_REUSED' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)) = 0
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_SUBMIT_POSTIMAGE_MISMATCH'; END IF;
END $submit_withdrawn_final$;

DO $phone_grant_closed$ DECLARE target regprocedure := 'public.rpc_set_contact_grant(uuid,text,boolean)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$  if p_granted is null then
    raise exception 'GRANT_DECISION_REQUIRED' using errcode = '22004';
  end if;
$old$,$new$  if p_granted is null then
    raise exception 'GRANT_DECISION_REQUIRED' using errcode = '22004';
  end if;
  -- Phone numbers are never shared (messages stay in the app); revoking an older PHONE grant remains possible.
  if p_channel = 'PHONE' and p_granted then
    raise exception 'PHONE_SHARING_DISABLED' using errcode = '42501';
  end if;
$new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '5a6d710106832c1da7bc147a704f9301' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PHONE_GRANT_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PHONE_GRANT_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '2ccbbc41665d98d14d2fb2de679d047b' OR actual.metadata IS DISTINCT FROM original_metadata
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PHONE_GRANT_POSTIMAGE_MISMATCH'; END IF;
END $phone_grant_closed$;

DO $phone_reveal_closed$ DECLARE target regprocedure := 'public.rpc_reveal_contact(uuid,text)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$    raise exception using errcode='22023', message='UNSUPPORTED_CHANNEL';
  end if;
$old$,$new$    raise exception using errcode='22023', message='UNSUPPORTED_CHANNEL';
  end if;
  -- Phone numbers are never revealed, whatever an older grant says.
  if p_channel = 'PHONE' then
    raise exception using errcode='42501', message='PHONE_SHARING_DISABLED';
  end if;
$new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '358bc1d98aecdd33b4e464ca11a1b401' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PHONE_REVEAL_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PHONE_REVEAL_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '7432a455a1543ad41b92798e45454b96' OR actual.metadata IS DISTINCT FROM original_metadata
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_PHONE_REVEAL_POSTIMAGE_MISMATCH'; END IF;
END $phone_reveal_closed$;

DO $workspace_phone_null$ DECLARE target regprocedure := 'public.rpc_get_agreement_workspace(uuid)'::regprocedure; actual record; d text; original_metadata jsonb; patch text[];
patches text[][] := ARRAY[
 ARRAY[$old$      'theirPhone', case
        when a.status = 'CONFIRMED' and exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id
             and g.channel = 'PHONE'
             and g.granted_to_account_id = v_uid
             and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at)
             and (g.expires_at is null or g.expires_at > statement_timestamp())
        ) then (
          select nullif(btrim(acc.phone), '')
            from public.app_accounts acc
           where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end
        )
        else null
      end,
$old$,$new$      -- Phone numbers are never shared; the key stays for compatible clients.
      'theirPhone', null::text,
$new$]
];
BEGIN
 SELECT md5(p.prosrc) body_md5,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '0eb9b60cf7a52bdef85d8dc166690e0b' OR actual.owner IS DISTINCT FROM 'postgres'
 OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' OR actual.prosecdef IS DISTINCT FROM true
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR actual.prokind IS DISTINCT FROM 'f'
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_WORKSPACE_PREIMAGE_DRIFT'; END IF;
 original_metadata:=actual.metadata; d:=pg_get_functiondef(target);
 FOREACH patch SLICE 1 IN ARRAY patches LOOP IF array_length(string_to_array(d,patch[1]),1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_WORKSPACE_ANCHOR_DRIFT'; END IF; d:=replace(d,patch[1],patch[2]); END LOOP;
 EXECUTE d;
 SELECT md5(p.prosrc) body_md5,to_jsonb(p)-'prosrc' metadata INTO actual FROM pg_proc p WHERE p.oid=target;
 IF actual.body_md5 IS DISTINCT FROM '3884817e3fcc4717f9d3143d715305b5' OR actual.metadata IS DISTINCT FROM original_metadata
 OR position('acc.phone' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)) > 0
 OR position('''theirPhone'', null::text' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid=target)) = 0
 THEN RAISE EXCEPTION 'MARKETPLACE_SAFETY_WORKSPACE_POSTIMAGE_MISMATCH'; END IF;
END $workspace_phone_null$;

COMMIT;
-- MARKETPLACE_SAFETY_20261121_ISOLATED_END
