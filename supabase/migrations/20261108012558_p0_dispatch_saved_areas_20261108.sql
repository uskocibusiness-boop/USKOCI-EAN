-- Restore the canonical far-pin/saved-work-area fallback in the capped reader.
-- Only candidate enumeration changes. Daily cap, canonical match, deduplication,
-- nearby priority, candidate limit, RLS and dispatch transaction policy remain.
DO $dispatch_saved_areas$
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
 SELECT pg_get_functiondef(p.oid),p.prosrc INTO definition,body FROM pg_proc p WHERE p.oid=target
  AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[];
 IF body IS NULL OR md5(body)<>'9a2437fd9d6bed07c8338d12501e5cba'
  OR (length(body)-length(replace(body,old_predicate,'')))/length(old_predicate)<>1
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.candidate_profile_ids(uuid,integer)'))
     IS DISTINCT FROM 'b7a2884b1fc29bd99e0baf62487382c9'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.dispatch_cheap_candidate_admitted(uuid,uuid)'))
     IS DISTINCT FROM 'cec5c0a2c13af6718af53b7a80245f28'
 THEN RAISE EXCEPTION 'P0_DISPATCH_CANDIDATE_PREIMAGE_DRIFT'; END IF;
 EXECUTE replace(definition,old_predicate,new_predicate);
 IF (SELECT prosrc FROM pg_proc WHERE oid=target) IS DISTINCT FROM replace(body,old_predicate,new_predicate)
 THEN RAISE EXCEPTION 'P0_DISPATCH_CANDIDATE_REPLACEMENT_MISMATCH'; END IF;
END
$dispatch_saved_areas$;
