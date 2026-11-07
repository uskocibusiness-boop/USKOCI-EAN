-- USKOCI 2026-11-07: temporary retirement of the optional worker "Dostupan sada"
-- matching signal. Keep original user values, calendar rules, date windows, task
-- urgency, need lifecycle and ordinary confirmed arrangements unchanged.
-- Re-enable only with an explicit owner decision and a new reviewed migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $pause_now$
DECLARE
  target regprocedure := 'private.worker_need_time_tier_v1(uuid,uuid)'::regprocedure;
  original_body text;
  original_attributes jsonb;
  old_def text;
  changed_body text;
  original_md5 text;
  actual_md5 text;
  occurrence_count integer;
BEGIN
  SELECT p.prosrc, to_jsonb(p) - 'prosrc', md5(p.prosrc)
    INTO original_body, original_attributes, original_md5
  FROM pg_proc p WHERE p.oid=target;
  IF original_md5 IS DISTINCT FROM 'a845d98b624ae4ac8ec33159beb8bb17' THEN
    RAISE EXCEPTION 'WORKER_NOW_PREIMAGE_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
     WHERE p.oid=target AND p.proowner='postgres'::regrole AND p.prosecdef
       AND p.provolatile='s' AND NOT p.proisstrict
       AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
       AND p.proacl::text='{postgres=X/postgres}'
       AND l.lanname='plpgsql' AND pg_get_function_result(p.oid)='integer'
  ) THEN RAISE EXCEPTION 'WORKER_NOW_AUTHORITY_MISMATCH'; END IF;
  -- All eight old "now" reads in this specific time-tier function use one
  -- exact expression. Replacing ONLY these guards preserves recurring and
  -- dated availability, while eliminating now-only priority and fallback.
  occurrence_count := (length(original_body)-length(replace(original_body,'coalesce(p.available_now,false)','')))
    /length('coalesce(p.available_now,false)');
  IF occurrence_count<>8
    OR position('p.available_now' in replace(original_body,'coalesce(p.available_now,false)',''))>0
  THEN RAISE EXCEPTION 'WORKER_NOW_UNEXPECTED_REFERENCE'; END IF;
  changed_body := replace(original_body,'coalesce(p.available_now,false)','false');
  old_def := pg_get_functiondef(target);
  IF (length(old_def)-length(replace(old_def,'coalesce(p.available_now,false)','')))
       /length('coalesce(p.available_now,false)')<>8 THEN
    RAISE EXCEPTION 'WORKER_NOW_DEFINITION_DRIFT';
  END IF;
  EXECUTE replace(old_def,'coalesce(p.available_now,false)','false');
  SELECT md5(p.prosrc) INTO actual_md5 FROM pg_proc p WHERE p.oid=target;
  IF actual_md5 IS DISTINCT FROM md5(changed_body) OR actual_md5=original_md5 THEN
    RAISE EXCEPTION 'WORKER_NOW_POSTIMAGE_MISMATCH';
  END IF;
  IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target)
     IS DISTINCT FROM original_attributes THEN
    RAISE EXCEPTION 'WORKER_NOW_METADATA_CHANGED';
  END IF;
END $pause_now$;
COMMIT;
