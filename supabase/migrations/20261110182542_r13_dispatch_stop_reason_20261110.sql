-- DEV-only diagnostic correction. No dispatch, queue row, event or schedule is executed.
-- Preserve the deployed wave owner and expose the reason already recorded by it.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $project$
BEGIN
 IF current_user <> 'postgres' OR current_database() <> 'postgres'
  OR (SELECT system_identifier::text FROM pg_control_system()) <> '7676203829645141156'
 THEN RAISE EXCEPTION 'R13_REASON_DEV_PROJECT_MISMATCH'; END IF;
END $project$;
-- R13_REASON_ISOLATED_START: isolated tests omit only the physical hosted identity above.
DO $patch$
DECLARE
 d text; actual record;
 old_text text := $old$    || case when chunked and inserted >= batch then jsonb_build_object('chunk',true,'txNotifyBudget',tx_budget) else '{}'::jsonb end;$old$;
 new_text text := $new$    || case when inserted = 0 then jsonb_build_object('reason','NO_ELIGIBLE_CANDIDATES') else '{}'::jsonb end
    || case when chunked and inserted >= batch then jsonb_build_object('chunk',true,'txNotifyBudget',tx_budget) else '{}'::jsonb end;$new$;
BEGIN
 SELECT md5(prosrc) AS body_md5, pg_get_userbyid(proowner) AS owner,
  proacl::text AS acl,prosecdef,proconfig,prokind INTO actual
 FROM pg_proc WHERE oid=to_regprocedure('private.dispatch_next_wave(uuid)');
 IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM 'd3cdfe2bdd6e5d40a74e6029793c89c5'
  OR actual.owner IS DISTINCT FROM 'postgres' OR actual.acl IS DISTINCT FROM '{postgres=X/postgres}'
  OR actual.prosecdef IS DISTINCT FROM true OR actual.prokind IS DISTINCT FROM 'f'
  OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']
 THEN RAISE EXCEPTION 'R13_REASON_PREIMAGE_DRIFT'; END IF;
 d := pg_get_functiondef('private.dispatch_next_wave(uuid)'::regprocedure);
 IF array_length(string_to_array(d,old_text),1) <> 2 THEN RAISE EXCEPTION 'R13_REASON_ANCHOR_DRIFT'; END IF;
 EXECUTE replace(d,old_text,new_text);
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.dispatch_next_wave(uuid)'::regprocedure)
  IS DISTINCT FROM 'bd1d2fd351d8273ddc0cce9e29514ca7'
 THEN RAISE EXCEPTION 'R13_REASON_POSTIMAGE_DRIFT'; END IF;
END $patch$;
COMMIT;
