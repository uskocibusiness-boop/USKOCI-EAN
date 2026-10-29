-- R01/F21 EXISTING public-table NONROW PRIVILEGES. SOURCE-ONLY / NEVER HOSTED.
-- A 2026-10-29 DEV READ-ONLY catalog check found exactly 21 ordinary public
-- tables (17 anon, 19 authenticated). On each granted role the three unwanted
-- privileges TRUNCATE, TRIGGER, REFERENCES were supplied together by postgres.
-- RLS does NOT constrain TRUNCATE. This change affects no SELECT/INSERT/UPDATE/
-- DELETE, no table columns, no RLS, no functions, no default ACL and no data.
-- This is NOT an applied migration, an Auth/PostgREST proof or a release gate.
-- Only after R01 strict current-schema/closure and same-role client validation
-- may it be reviewed as a promotion candidate with an explicit rollback plan.
-- PGlite PG18 is admitted for isolated SQL semantics ONLY, not live parity.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $r01_existing$
DECLARE
 v_expected CONSTANT jsonb := $r01_expected$[
  {
    "table_name": "access_grants",
    "anon_expected": true,
    "auth_expected": false
  },
  {
    "table_name": "agreement_change_proposals",
    "anon_expected": false,
    "auth_expected": true
  },
  {
    "table_name": "agreement_execution",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "agreement_messages",
    "anon_expected": true,
    "auth_expected": false
  },
  {
    "table_name": "agreement_versions",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "agreements",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "ai_structured_facts",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "app_accounts",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "app_profiles",
    "anon_expected": false,
    "auth_expected": true
  },
  {
    "table_name": "dispatch_rounds",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "gemini_debug_log",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "marketplace_response_versions",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "marketplace_responses",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "need_selections",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "need_sensitive",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "needs",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "opportunity_deliveries",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "profile_availability_rules",
    "anon_expected": false,
    "auth_expected": true
  },
  {
    "table_name": "profile_availability_windows",
    "anon_expected": false,
    "auth_expected": true
  },
  {
    "table_name": "user_activity_events",
    "anon_expected": true,
    "auth_expected": true
  },
  {
    "table_name": "worker_match_preferences",
    "anon_expected": true,
    "auth_expected": true
  }
]$r01_expected$::jsonb;
 v_target record;
 v_table pg_class%ROWTYPE;
 v_count integer;
 v_anon_count integer;
 v_auth_count integer;
 v_baseline jsonb;
 v_after jsonb;
 v_policies jsonb;
 v_column_acls jsonb;
 v_defaults jsonb;
 v_expected_names text[];
BEGIN
 IF current_setting('uskoci.r01.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
    OR current_user<>'postgres'
    OR current_database()<>'postgres'
    OR current_setting('server_version_num')::integer/10000 NOT IN (17,18)
    OR to_regrole('cli_login_postgres') IS NOT NULL THEN
   RAISE EXCEPTION 'R01_NONROW_DISPOSABLE_ONLY' USING errcode='55000';
 END IF;
 IF jsonb_array_length(v_expected)<>21 OR
    (SELECT count(DISTINCT x.table_name) FROM jsonb_to_recordset(v_expected)
       AS x(table_name text,anon_expected boolean,auth_expected boolean))<>21 THEN
   RAISE EXCEPTION 'R01_NONROW_TARGET_LIST_INVALID' USING errcode='55000';
 END IF;
 SELECT array_agg(x.table_name ORDER BY x.table_name) INTO v_expected_names
   FROM jsonb_to_recordset(v_expected)
    AS x(table_name text,anon_expected boolean,auth_expected boolean);

 -- Fail closed on any unreviewed public table with those effective privileges.
 SELECT count(*) INTO v_count FROM pg_class c WHERE c.relnamespace='public'::regnamespace
   AND c.relkind IN ('r','p')
   AND (has_table_privilege('anon',c.oid,'TRUNCATE')
     OR has_table_privilege('anon',c.oid,'TRIGGER')
     OR has_table_privilege('anon',c.oid,'REFERENCES')
     OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
     OR has_table_privilege('authenticated',c.oid,'TRIGGER')
     OR has_table_privilege('authenticated',c.oid,'REFERENCES'));
 IF v_count<>21 OR EXISTS(SELECT 1 FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
    AND c.relname<>ALL(v_expected_names)
    AND (has_table_privilege('anon',c.oid,'TRUNCATE')
      OR has_table_privilege('anon',c.oid,'TRIGGER')
      OR has_table_privilege('anon',c.oid,'REFERENCES')
      OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
      OR has_table_privilege('authenticated',c.oid,'TRIGGER')
      OR has_table_privilege('authenticated',c.oid,'REFERENCES'))) THEN
   RAISE EXCEPTION 'R01_NONROW_UNREVIEWED_PUBLIC_GRANTS' USING errcode='55000';
 END IF;

 -- Snapshot every unrelated existing table ACL tuple and the complete
 -- policy/column/default-ACL inventory. Only 3 source-owned target privileges
 -- for two client roles may disappear.
 SELECT coalesce(jsonb_agg(jsonb_build_array(c.oid::text,a.grantor::text,
   a.grantee::text,a.privilege_type::text,a.is_grantable)
   ORDER BY c.oid,a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
 INTO v_baseline
 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
  AND NOT (c.relname=ANY(v_expected_names)
    AND a.grantee IN ('anon'::regrole::oid,'authenticated'::regrole::oid)
    AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES'));
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]'::jsonb)
   INTO v_policies FROM pg_policy p;
 SELECT coalesce(jsonb_agg(jsonb_build_array(a.attrelid::text,a.attnum,
   a.attacl::text) ORDER BY a.attrelid,a.attnum),'[]'::jsonb)
   INTO v_column_acls FROM pg_attribute a
   WHERE a.attrelid IN (SELECT c.oid FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p'))
     AND a.attnum>0 AND NOT a.attisdropped;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]'::jsonb)
  INTO v_defaults FROM pg_default_acl d;

 FOR v_target IN SELECT * FROM jsonb_to_recordset(v_expected)
    AS x(table_name text,anon_expected boolean,auth_expected boolean)
    ORDER BY table_name LOOP
   SELECT * INTO v_table FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relname=v_target.table_name
       AND c.relkind='r';
   IF NOT FOUND OR v_table.relowner<>'postgres'::regrole::oid
      OR NOT v_table.relrowsecurity OR v_table.relispartition
      OR v_table.relacl IS NULL
      OR EXISTS(SELECT 1 FROM pg_inherits h
          WHERE h.inhrelid=v_table.oid OR h.inhparent=v_table.oid)
      OR (has_table_privilege('anon',v_table.oid,'TRUNCATE') IS DISTINCT FROM v_target.anon_expected)
      OR (has_table_privilege('anon',v_table.oid,'TRIGGER') IS DISTINCT FROM v_target.anon_expected)
      OR (has_table_privilege('anon',v_table.oid,'REFERENCES') IS DISTINCT FROM v_target.anon_expected)
      OR (has_table_privilege('authenticated',v_table.oid,'TRUNCATE') IS DISTINCT FROM v_target.auth_expected)
      OR (has_table_privilege('authenticated',v_table.oid,'TRIGGER') IS DISTINCT FROM v_target.auth_expected)
      OR (has_table_privilege('authenticated',v_table.oid,'REFERENCES') IS DISTINCT FROM v_target.auth_expected)
      OR NOT has_table_privilege('service_role',v_table.oid,'TRUNCATE')
      OR NOT has_table_privilege('service_role',v_table.oid,'TRIGGER')
      OR NOT has_table_privilege('service_role',v_table.oid,'REFERENCES')
   THEN RAISE EXCEPTION 'R01_NONROW_TARGET_PREDECESSOR_DRIFT: %',v_target.table_name
      USING errcode='55000'; END IF;
   SELECT count(*) INTO v_anon_count FROM aclexplode(v_table.relacl) a
     WHERE a.grantee='anon'::regrole::oid AND
           a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
       AND a.grantor='postgres'::regrole::oid AND NOT a.is_grantable;
   SELECT count(*) INTO v_auth_count FROM aclexplode(v_table.relacl) a
     WHERE a.grantee='authenticated'::regrole::oid AND
           a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
       AND a.grantor='postgres'::regrole::oid AND NOT a.is_grantable;
   IF v_anon_count<>CASE WHEN v_target.anon_expected THEN 3 ELSE 0 END
     OR v_auth_count<>CASE WHEN v_target.auth_expected THEN 3 ELSE 0 END
     OR EXISTS(SELECT 1 FROM aclexplode(v_table.relacl) a
       WHERE a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
         AND a.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
         AND (a.grantee=0 OR a.grantor<>'postgres'::regrole::oid OR a.is_grantable))
   THEN RAISE EXCEPTION 'R01_NONROW_DIRECT_GRANTS_CHANGED: %',v_target.table_name
      USING errcode='55000'; END IF;
 END LOOP;
 -- Every prerequisite above completes BEFORE the first mutation.
 FOR v_target IN SELECT * FROM jsonb_to_recordset(v_expected)
    AS x(table_name text,anon_expected boolean,auth_expected boolean)
    ORDER BY table_name LOOP
   EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM anon, authenticated',
       v_target.table_name);
 END LOOP;

 -- The inherited/public path must also be closed, not merely a direct GRANT.
 IF EXISTS(SELECT 1 FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
   AND (has_table_privilege('anon',c.oid,'TRUNCATE')
     OR has_table_privilege('anon',c.oid,'TRIGGER')
     OR has_table_privilege('anon',c.oid,'REFERENCES')
     OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
     OR has_table_privilege('authenticated',c.oid,'TRIGGER')
     OR has_table_privilege('authenticated',c.oid,'REFERENCES'))) THEN
   RAISE EXCEPTION 'R01_NONROW_EFFECTIVE_POSTCONDITION_FAILED' USING errcode='55000';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_array(c.oid::text,a.grantor::text,
   a.grantee::text,a.privilege_type::text,a.is_grantable)
   ORDER BY c.oid,a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
 INTO v_after
 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
  AND NOT (c.relname=ANY(v_expected_names)
    AND a.grantee IN ('anon'::regrole::oid,'authenticated'::regrole::oid)
    AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES'));
 IF v_after IS DISTINCT FROM v_baseline OR
    (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]'::jsonb)
     FROM pg_policy p) IS DISTINCT FROM v_policies OR
    (SELECT coalesce(jsonb_agg(jsonb_build_array(a.attrelid::text,a.attnum,
       a.attacl::text) ORDER BY a.attrelid,a.attnum),'[]'::jsonb)
     FROM pg_attribute a WHERE a.attrelid IN (SELECT c.oid FROM pg_class c
       WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p'))
       AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM v_column_acls OR
    (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.defaclrole,
       d.defaclnamespace,d.defaclobjtype),'[]'::jsonb)
       FROM pg_default_acl d) IS DISTINCT FROM v_defaults THEN
   RAISE EXCEPTION 'R01_NONROW_UNRELATED_AUTHORITY_CHANGED' USING errcode='55000';
 END IF;
END $r01_existing$;
COMMIT;
