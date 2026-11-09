-- Remove only the completed, unscheduled synthetic CALL probe.
-- The original two-row evidence is archived before this migration is applied.
-- No business relation, scheduler command, dispatch routine or provider is changed.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $cleanup$
DECLARE
  actual record;
  columns_seen jsonb;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_OWNER_REQUIRED';
  END IF;
  IF to_regclass('private.capacity4_transaction_probe') IS NULL
     OR to_regprocedure('private.capacity4_transaction_probe_v1()') IS NULL THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_PREIMAGE_MISSING';
  END IF;
  -- A concurrent diagnostic write must finish or cause a bounded refusal.
  LOCK TABLE private.capacity4_transaction_probe IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM cron.job
     WHERE jobname = 'uskoci_dispatch_call_probe_20261108'
        OR command ILIKE '%capacity4_transaction_probe%') THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_JOB_PRESENT';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_stat_activity
     WHERE pid <> pg_backend_pid() AND state IN ('active','idle in transaction')
       AND query ILIKE '%capacity4_transaction_probe%') THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_CALL_RUNNING';
  END IF;
  SELECT md5(p.prosrc) AS body_md5, p.proacl::text AS acl,
         pg_get_userbyid(p.proowner) AS owner, p.proconfig, p.prosecdef,
         p.prokind, l.lanname
    INTO actual FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid='private.capacity4_transaction_probe_v1()'::regprocedure;
  IF actual.body_md5 IS DISTINCT FROM '62051bf43e88a090ab14e98ab453f245'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR actual.owner IS DISTINCT FROM 'postgres' OR actual.proconfig IS NOT NULL
     OR actual.prosecdef OR actual.prokind <> 'p' OR actual.lanname <> 'plpgsql' THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_PROCEDURE_DRIFT';
  END IF;
  -- PL/pgSQL body references are not always registered in pg_depend.
  IF EXISTS (SELECT 1 FROM pg_proc
     WHERE oid <> 'private.capacity4_transaction_probe_v1()'::regprocedure
       AND prosrc ILIKE '%capacity4_transaction_probe%') THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_ROUTINE_REFERENCE';
  END IF;
  SELECT pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl,
         c.relrowsecurity, c.relforcerowsecurity, c.relkind,
         obj_description(c.oid,'pg_class') AS description
    INTO actual FROM pg_class c WHERE c.oid='private.capacity4_transaction_probe'::regclass;
  IF actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres}'
     OR actual.relrowsecurity IS NOT TRUE OR actual.relforcerowsecurity
     OR actual.relkind <> 'r' OR actual.description IS DISTINCT FROM
       'USKOCI disposable transaction CALL probe 20261108; synthetic diagnostic rows only' THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_TABLE_DRIFT';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
         'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),
         'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum)
    INTO columns_seen FROM pg_attribute a LEFT JOIN pg_attrdef d
      ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='private.capacity4_transaction_probe'::regclass
      AND a.attnum>0 AND NOT a.attisdropped;
  IF columns_seen IS DISTINCT FROM
    '[{"name":"phase","type":"text","notNull":true,"default":null,"identity":"","generated":""},
      {"name":"transaction_id","type":"bigint","notNull":true,"default":null,"identity":"","generated":""},
      {"name":"observed_at","type":"timestamp with time zone","notNull":true,"default":"clock_timestamp()","identity":"","generated":""}]'::jsonb
     -- PostgreSQL 18 also catalogs NOT NULL; attnotnull is checked above.
     OR (SELECT count(*) FROM pg_constraint
           WHERE conrelid='private.capacity4_transaction_probe'::regclass AND contype<>'n') <> 2
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
           WHERE conrelid='private.capacity4_transaction_probe'::regclass AND contype='p'
             AND pg_get_constraintdef(oid)='PRIMARY KEY (phase)' AND convalidated)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
           WHERE conrelid='private.capacity4_transaction_probe'::regclass AND contype='c'
             AND pg_get_constraintdef(oid)=$check$CHECK ((phase = ANY (ARRAY['before'::text, 'after'::text])))$check$
             AND convalidated)
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='private.capacity4_transaction_probe'::regclass
           AND NOT tgisinternal)
     OR EXISTS (SELECT 1 FROM pg_constraint
           WHERE confrelid='private.capacity4_transaction_probe'::regclass) THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_SCHEMA_DRIFT';
  END IF;
  -- Pin the two diagnostic observations; an unexpected row is never deleted.
  IF (SELECT count(*) FROM private.capacity4_transaction_probe) <> 2
     OR NOT EXISTS (SELECT 1 FROM private.capacity4_transaction_probe
           WHERE phase='before' AND transaction_id=203348825
             AND observed_at='2026-11-08 23:06:00.153974+00'::timestamptz)
     OR NOT EXISTS (SELECT 1 FROM private.capacity4_transaction_probe
           WHERE phase='after' AND transaction_id=203348826
             AND observed_at='2026-11-08 23:06:00.164508+00'::timestamptz) THEN
    RAISE EXCEPTION 'R13_PROBE_CLEANUP_ROWS_DRIFT';
  END IF;
  -- RESTRICT is intentional. Any new dependent object aborts the transaction.
  DROP PROCEDURE private.capacity4_transaction_probe_v1();
  DROP TABLE private.capacity4_transaction_probe;
END $cleanup$;
COMMIT;
