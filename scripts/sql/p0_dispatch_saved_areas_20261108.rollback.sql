-- Restore only the previous capped candidate body; abort after later changes.
DO $dispatch_saved_areas_rollback$
DECLARE
 target regprocedure := to_regprocedure('private.candidate_profile_ids_v1b(uuid,integer,integer)');
 definition text;
 body text;
 old_predicate constant text := $old_predicate$and (pref.worker_profile_id is null or pref.approximate_geog is null)$old_predicate$;
 new_predicate constant text := $new_predicate$and (
        pref.worker_profile_id is null
        or pref.approximate_geog is null
        or (
          not extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)
          and jsonb_array_length(private.worker_saved_areas_v1(p.account_id)) > 0
        )
      )$new_predicate$;
BEGIN
 IF target IS NULL THEN RAISE EXCEPTION 'P0_DISPATCH_CANDIDATE_MISSING'; END IF;
 SELECT pg_get_functiondef(p.oid),p.prosrc INTO definition,body FROM pg_proc p WHERE p.oid=target;
 IF md5(replace(body,new_predicate,old_predicate))<>'9a2437fd9d6bed07c8338d12501e5cba'
  OR (length(body)-length(replace(body,new_predicate,'')))/length(new_predicate)<>1
 THEN RAISE EXCEPTION 'P0_DISPATCH_CANDIDATE_ROLLBACK_DRIFT'; END IF;
 EXECUTE replace(definition,new_predicate,old_predicate);
END
$dispatch_saved_areas_rollback$;
