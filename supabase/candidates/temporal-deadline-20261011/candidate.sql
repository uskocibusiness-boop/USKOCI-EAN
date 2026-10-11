-- USKOČI: ISOLATED SQL CANDIDATE, NOT APPLIED TO DEV/PROD.
-- Explicit completion deadline must override relative publication-week expiry.
-- Only private.need_search_time_admitted_v1; no dispatch/event/device writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pre$
BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc
     WHERE oid='private.need_search_time_admitted_v1(uuid,timestamptz)'::regprocedure)
   IS DISTINCT FROM 'b830cd07c2a5db101a3a28096256a75b'
 THEN RAISE EXCEPTION 'NEED_TIME_SOURCE_DRIFT' USING errcode='PT409'; END IF;
END $pre$;

CREATE OR REPLACE FUNCTION private.need_search_time_admitted_v1(
 p_need_id uuid, p_at timestamptz DEFAULT statement_timestamp())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 n public.needs%rowtype;
 execution_end timestamptz;
BEGIN
 IF p_need_id IS NULL OR p_at IS NULL OR NOT isfinite(p_at) THEN RETURN false; END IF;
 SELECT * INTO n FROM public.needs WHERE id=p_need_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF n.response_deadline IS NOT NULL AND
   (NOT isfinite(n.response_deadline) OR n.response_deadline <= p_at) THEN RETURN false; END IF;
 IF n.starts_at IS NOT NULL AND NOT isfinite(n.starts_at) THEN RETURN false; END IF;
 IF n.ends_at IS NOT NULL THEN
   IF NOT isfinite(n.ends_at) OR n.ends_at <= p_at THEN RETURN false; END IF;
   IF n.starts_at IS NOT NULL AND n.starts_at >= n.ends_at THEN RETURN false; END IF;
 END IF;
 IF n.schedule_kind='FIXED_WINDOW' THEN
   execution_end:=coalesce(n.ends_at,n.starts_at);
   RETURN execution_end IS NOT NULL AND isfinite(execution_end) AND p_at<execution_end;
 ELSIF n.schedule_kind IN ('TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') THEN
   -- An explicit completion deadline is authoritative. Only when it is
   -- absent may the server derive a default relative window.
   execution_end:=coalesce(n.ends_at,
     private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone));
   RETURN execution_end IS NOT NULL AND isfinite(execution_end) AND p_at<execution_end;
 ELSIF n.schedule_kind IN ('FLEXIBLE','REMOTE_ANYTIME') THEN
   -- End-only deadline is already checked above; no invented duration.
   RETURN true;
 END IF;
 RETURN false;
END
$function$;

DO $post$
BEGIN
 IF (SELECT position('execution_end:=coalesce(n.ends_at,' IN prosrc)
       FROM pg_proc WHERE oid='private.need_search_time_admitted_v1(uuid,timestamptz)'::regprocedure)=0
 THEN RAISE EXCEPTION 'NEED_TIME_POSTFLIGHT_FAIL' USING errcode='PT409'; END IF;
END $post$;
COMMIT;
