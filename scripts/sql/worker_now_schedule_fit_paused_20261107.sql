-- USKOCI 2026-11-07: close the second worker-now matching bypass.
-- A fixed-window task must fit the ordinary weekday/date calendar even when
-- the worker's preserved legacy available_now flag was true. Task urgency and
-- all stored profile/calendar/Agreement rows are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $pause_schedule$
DECLARE
  target regprocedure := 'private.schedule_fit(uuid,timestamp with time zone,timestamp with time zone,text)'::regprocedure;
  original_body text;
  original_metadata jsonb;
  changed_body text;
  reconstructed_def text;
  old_declare text := 'declare live_now boolean; at_now timestamptz:=statement_timestamp();';
  old_bypass text := $old$
  select available_now into live_now from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  -- Live intent means now, not an invented expiry or arbitrary lead-time. Future
  -- exact appointments must fit the stored weekly/windows schedule even when ON.
  if coalesce(live_now,false) and s<=at_now and at_now<e then return true; end if;
$old$;
BEGIN
  SELECT prosrc,to_jsonb(p)-'prosrc' INTO original_body,original_metadata
    FROM pg_proc p WHERE p.oid=target;
  IF md5(original_body) IS DISTINCT FROM 'e29a7bade1437e3f2067924b5179ddfd' THEN
    RAISE EXCEPTION 'WORKER_NOW_SCHEDULE_FIT_PREIMAGE_MISMATCH';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target
     AND pg_get_userbyid(p.proowner)='postgres' AND l.lanname='plpgsql'
     AND p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict
     AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
     AND p.proacl::text='{postgres=X/postgres}'
     AND pg_get_function_result(p.oid)='boolean') THEN
    RAISE EXCEPTION 'WORKER_NOW_SCHEDULE_FIT_AUTHORITY_MISMATCH';
  END IF;
  IF (length(original_body)-length(replace(original_body,old_declare,'')))<>length(old_declare)
     OR (length(original_body)-length(replace(original_body,old_bypass,'')))<>length(old_bypass) THEN
    RAISE EXCEPTION 'WORKER_NOW_SCHEDULE_FIT_SHAPE_MISMATCH';
  END IF;
  changed_body:=replace(replace(original_body,old_declare,''),old_bypass,'');
  IF position('available_now' in changed_body)>0 OR position('live_now' in changed_body)>0 THEN
    RAISE EXCEPTION 'WORKER_NOW_SCHEDULE_FIT_LEFTOVER_REFERENCE';
  END IF;
  reconstructed_def:=replace(replace(pg_get_functiondef(target),old_declare,''),old_bypass,'');
  EXECUTE reconstructed_def;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM md5(changed_body)
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata THEN
    RAISE EXCEPTION 'WORKER_NOW_SCHEDULE_FIT_POSTIMAGE_MISMATCH';
  END IF;
END $pause_schedule$;
COMMIT;
