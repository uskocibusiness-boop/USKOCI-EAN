-- Exact DEV definitions captured read-only; no profile/conversation data.
CREATE OR REPLACE FUNCTION private.worker_ai_source(aid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select jsonb_build_object('profile',to_jsonb(p),'location',private.worker_location_document(p.id),
  'availability',private.worker_availability_document(p.id),'capacity',private.worker_capacity_document(p.id))
 from public.app_profiles p where p.account_id=aid and p.kind='WORKER';
$function$
;

CREATE OR REPLACE FUNCTION private.worker_ai_source_hash(aid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select encode(extensions.digest(coalesce(private.worker_ai_source(aid),'null'::jsonb)::text,'sha256'),'hex');
$function$
;

CREATE OR REPLACE FUNCTION private.worker_ai_initial(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles;
begin
 select * into p from public.app_profiles where account_id=aid and kind='WORKER';
 if found and p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 return jsonb_build_object('displayName',coalesce(p.display_name,''),'bio',coalesce(p.bio,''),
  'skills',coalesce(to_jsonb(p.skills),'[]'::jsonb),'tools',coalesce(to_jsonb(p.tools),'[]'::jsonb),
  'vehicles',coalesce(to_jsonb(p.vehicles),'[]'::jsonb),'licenses',coalesce(to_jsonb(p.licenses),'[]'::jsonb),
  'teamCapacity',coalesce(p.team_capacity,1),
  'location',coalesce(private.worker_location_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('operatingCountryCode',null,'city','','radiusKm',15,'approximatePosition',null)),
  'availability',coalesce(private.worker_availability_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('timezone','Europe/Belgrade','availableNow',false,'rules','[]'::jsonb,'windows','[]'::jsonb)));
end $function$
;

CREATE OR REPLACE FUNCTION private.taxonomy_admission_fingerprint_v1()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
SELECT md5(
 coalesce((SELECT string_agg(c.id::text||'/'||c.canonical_key||'/'||
      coalesce(c.parent_id::text,'ROOT')||'/'||c.state||'/'||c.catalog_version::text,'|' ORDER BY c.id::text)
      FROM private.work_taxonomy_categories c),'')
 || '#'
 || coalesce((SELECT string_agg(m.category_id::text||'/'||m.execution_scope,'|' ORDER BY m.category_id::text,m.execution_scope)
      FROM private.work_taxonomy_category_modes m),'')
 || '#'
 || coalesce((SELECT string_agg(a.category_id::text||'/'||a.locale||'/'||a.normalized_key,'|' ORDER BY a.category_id::text,a.locale,a.normalized_key)
      FROM private.work_taxonomy_aliases a),'')
);
$function$
;

CREATE OR REPLACE FUNCTION private.taxonomy_normalize_v1(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT btrim(regexp_replace(
   translate(
     replace(replace(replace(replace(replace(replace(lower(btrim(coalesce(p_value,''))),
       'ђ','dj'),'љ','lj'),'њ','nj'),'џ','dz'),'đ','dj'),'ß','ss'),
     'абвгдежзијклмнопрстћуфхцчшčćšž',
     'abvgdezzijklmnoprstcufhccsccsz'
   ),
   '[[:space:]]+', ' ', 'g'
 ))
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_save_worker_ai_review(p_review_id uuid, p_displayed_digest text, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; cmd private.worker_ai_saves; p public.app_profiles; value jsonb; receipt jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 if p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-save:'||auth.uid()::text||p_client_request_id::text,0));
 select * into r from private.worker_ai_reviews where id=p_review_id and account_id=auth.uid();
 if not found or r.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into s from private.worker_ai_sessions where conversation_id=r.conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into cmd from private.worker_ai_saves where account_id=auth.uid() and client_request_id=p_client_request_id;
 if found and cmd.review_id<>r.id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='PT409'; end if;
 select * into cmd from private.worker_ai_saves where review_id=r.id;
 if found then return cmd.receipt; end if;
 perform 1 from public.ai_conversations where id=s.conversation_id and account_id=auth.uid() and purpose='PROFILE' and status='OPEN' for update;
 if not found then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if r.revision<>s.revision or r.base_hash<>private.worker_ai_source_hash(auth.uid()) or r.expires_at<clock_timestamp()
  or r.envelope->'profile'<>s.candidate or r.envelope->'canAccept'<>'true'::jsonb or s.safety in ('BLOCK','REVIEW')
  or exists(select 1 from private.worker_ai_turns where conversation_id=s.conversation_id and state='PROCESSING')
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is not null and (p.id<>s.profile_id or p.profile_status not in ('DRAFT','ACTIVE')) then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 value:=r.envelope->'profile';
 -- WPP01: legacy keys stay on the wire, but may not request a retired-field change.
 -- Compare the reviewed values exactly with the locked current profile (or bootstrap
 -- defaults). Never silently discard a change the owner just reviewed.
 if value->'licenses' is distinct from coalesce(to_jsonb(p.licenses),'[]'::jsonb)
  or value->'teamCapacity' is distinct from to_jsonb(coalesce(p.team_capacity,1))
 then raise exception 'WORKER_AI_STALE' using errcode='PT409'; end if;
 if p.id is null then
  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills,tools,vehicles)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills')),array(select jsonb_array_elements_text(value->'tools')),
   array(select jsonb_array_elements_text(value->'vehicles'))) returning * into p;
 else
  update public.app_profiles set display_name=value->>'displayName',bio=value->>'bio',
   skills=array(select jsonb_array_elements_text(value->'skills')),tools=array(select jsonb_array_elements_text(value->'tools')),
   vehicles=array(select jsonb_array_elements_text(value->'vehicles')) where id=p.id;
 end if;
 if value->'location'<>private.worker_location_document(p.id)-array['profileId','accountId','revision'] then
  perform public.rpc_save_worker_location(private.worker_location_document(p.id)->>'revision',value->'location',true);
 end if;
 perform public.rpc_save_worker_availability(private.worker_availability_document(p.id)->>'revision',value->'availability');
 -- WPP01: preserve existing deprecated capacity; new profiles use the stored default.
 if (r.envelope->>'activate')::boolean then perform public.rpc_complete_worker_profile(p.id); end if;
 update public.ai_conversations set status='COMPLETED',completed_at=clock_timestamp() where id=s.conversation_id;
 receipt:=jsonb_build_object('reviewId',r.id,'conversationId',s.conversation_id,'accountId',auth.uid(),'profileId',p.id,
  'profileStatus',(select profile_status from public.app_profiles where id=p.id),'saved',true,'authoritative',true);
 insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt) values(r.id,auth.uid(),p_client_request_id,receipt);
 return receipt;
end $function$
;

CREATE OR REPLACE FUNCTION private.taxonomy_review_exact_projection_v1(p_purpose text, p_services jsonb, p_service_modes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_version bigint;v_fingerprint text;v_after text;v_version_after bigint;
 v_item jsonb;v_service text;v_mode text;v_key text;v_identity text;
 v_services text[]:=ARRAY[]::text[];v_modes text[]:=ARRAY[]::text[];
 v_refs text[]:=ARRAY[]::text[];v_plan jsonb;v_results jsonb:='[]'::jsonb;
 v_visible jsonb:='[]'::jsonb;v_reviewed_modes jsonb:='[]'::jsonb;
 v_category uuid;v_matches integer;v_idx integer;v_service_key text;v_scope_count integer;
 v_status text:='READY';
BEGIN
 IF p_purpose IS NULL OR p_purpose NOT IN ('WORKER_CAPABILITY','NEED_SERVICE')
    OR jsonb_typeof(p_services) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_services) NOT BETWEEN 1 AND 12
    OR jsonb_typeof(p_service_modes) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_service_modes) NOT BETWEEN 1 AND 24
    OR pg_column_size(p_services)>4000 OR pg_column_size(p_service_modes)>8000 THEN
   v_status:='REVIEW_REQUIRED';
 ELSE
   FOR v_item IN SELECT value FROM jsonb_array_elements(p_services) LOOP
     IF jsonb_typeof(v_item) <> 'string'
       OR char_length(btrim(v_item#>>'{}')) NOT BETWEEN 3 AND 120
       OR v_item#>>'{}' ~ '[[:cntrl:]<>]' THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_key:=private.taxonomy_normalize_v1(v_item#>>'{}');
     IF v_key=ANY(v_services) OR char_length(v_key) NOT BETWEEN 3 AND 160 THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_services:=array_append(v_services,v_key);
   END LOOP;
   IF p_purpose='NEED_SERVICE' AND jsonb_array_length(p_services)<>1 THEN
     v_status:='REVIEW_REQUIRED';
   END IF;
 END IF;
 IF v_status='READY' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(p_service_modes) LOOP
     IF jsonb_typeof(v_item)<>'object'
       OR NOT(v_item ?& array['service','mode'])
       OR (SELECT count(*) FROM jsonb_object_keys(v_item))<>2
       OR jsonb_typeof(v_item->'service')<>'string'
       OR jsonb_typeof(v_item->'mode')<>'string'
       OR (v_item->>'mode') NOT IN('ON_SITE','REMOTE') THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_key:=private.taxonomy_normalize_v1(v_item->>'service');
     v_mode:=v_item->>'mode';
     v_identity:=v_key||'|'||v_mode;
     IF NOT(v_key=ANY(v_services)) OR v_identity=ANY(v_modes) THEN
       v_status:='REVIEW_REQUIRED';EXIT;
     END IF;
     v_modes:=array_append(v_modes,v_identity);
     v_service:=(
       SELECT x.value#>>'{}' FROM jsonb_array_elements(p_services) AS x(value)
       WHERE private.taxonomy_normalize_v1(x.value#>>'{}')=v_key LIMIT 1);
     v_visible:=v_visible||jsonb_build_array(
       jsonb_build_object('service',v_service,'mode',v_mode));
   END LOOP;
   IF p_purpose='NEED_SERVICE' AND jsonb_array_length(v_visible)<>1 THEN
     v_status:='REVIEW_REQUIRED';
   END IF;
   IF EXISTS (SELECT 1 FROM unnest(v_services) AS s(value)
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_visible) AS m(value)
        WHERE private.taxonomy_normalize_v1(m.value->>'service')=s.value)) THEN
     v_status:='SERVICE_MODE_CONFIRMATION_REQUIRED';
   END IF;
 END IF;
 IF v_status='READY' THEN
   SELECT catalog_version INTO v_version
     FROM private.work_taxonomy_control WHERE singleton=true;
   v_fingerprint:=private.taxonomy_admission_fingerprint_v1();
   IF v_version IS NULL OR v_fingerprint IS NULL THEN v_status:='CATALOG_UNAVAILABLE'; END IF;
 END IF;
 IF v_status='READY' THEN
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_visible) LOOP
     v_service:=v_item->>'service';
     v_mode:=v_item->>'mode';
     v_key:=private.taxonomy_normalize_v1(v_service);
     -- Only the server's established canonical identity / stored aliases.
     -- Any semantic relation, parent or AI confidence is NOT an identity.
     SELECT count(DISTINCT c.id),min(c.id::text)::uuid INTO v_matches,v_category
       FROM private.work_taxonomy_categories c
       JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id
       WHERE c.state='ESTABLISHED' AND m.execution_scope=v_mode
         AND (c.canonical_key=v_key OR EXISTS(
           SELECT 1 FROM private.work_taxonomy_aliases a
           WHERE a.category_id=c.id AND a.normalized_key=v_key));
     IF v_matches<>1 THEN v_status:='PENDING_CLASSIFICATION';EXIT; END IF;
     v_identity:=v_category::text||'|'||v_mode;
     IF v_identity=ANY(v_refs) THEN v_status:='REVIEW_REQUIRED';EXIT; END IF;
     v_refs:=array_append(v_refs,v_identity);
     v_plan:=jsonb_build_object(
       'action','REUSE_EXISTING','service',v_service,'mode',v_mode,
       'categoryId',v_category,'catalogVersion',v_version,
       'reason','Verified existing canonical identity or registered server alias');
     v_results:=v_results||jsonb_build_array(v_plan);
   END LOOP;
 END IF;
 IF v_status='READY' THEN
   SELECT catalog_version INTO v_version_after FROM private.work_taxonomy_control WHERE singleton=true;
   v_after:=private.taxonomy_admission_fingerprint_v1();
   IF v_version IS DISTINCT FROM v_version_after OR v_fingerprint IS DISTINCT FROM v_after THEN
     v_status:='STALE_CATALOG';
   END IF;
 END IF;
 IF v_status<>'READY' THEN
   -- An incomplete projection cannot produce a half-authoritative subset.
   RETURN jsonb_build_object('status',v_status,'classificationCandidates','[]'::jsonb,
     'reviewedServiceModes','[]'::jsonb,'visibleServices','[]'::jsonb,
     'classificationCatalogVersion',NULL,'classificationCatalogFingerprint',NULL);
 END IF;
 IF p_purpose='WORKER_CAPABILITY' THEN v_reviewed_modes:=v_visible; END IF;
 RETURN jsonb_build_object('status','READY','classificationCandidates',v_results,
   'reviewedServiceModes',v_reviewed_modes,'visibleServices',v_visible,
   'classificationCatalogVersion',v_version,
   'classificationCatalogFingerprint',v_fingerprint);
END $function$
;

CREATE OR REPLACE FUNCTION public.rpc_taxonomy_bind_reviewed_worker_service(p_owner_account_id uuid, p_request_key uuid, p_source_review_id uuid, p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE
 v_existing private.work_taxonomy_worker_bindings_v1%ROWTYPE;
 v_batch private.work_taxonomy_review_batches_v1%ROWTYPE;
 v_review private.worker_ai_reviews%ROWTYPE;
 v_save private.worker_ai_saves%ROWTYPE;
 v_profile public.app_profiles%ROWTYPE;
 v_digest text;v_item jsonb;v_plan jsonb;v_category uuid;
 v_key text;v_mode text;v_seen text[]:=ARRAY[]::text[];
 v_modes text[]:=ARRAY[]::text[];v_onsite boolean:=false;v_remote boolean:=false;
 v_result jsonb;v_count integer:=0;v_skills jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'WORKER_BINDER_SERVICE_ROLE_REQUIRED' USING errcode='42501';
 END IF;
 IF p_owner_account_id IS NULL OR p_request_key IS NULL
   OR p_source_review_id IS NULL OR p_profile_id IS NULL THEN
  RAISE EXCEPTION 'WORKER_BINDER_INPUT_INVALID' USING errcode='22023';
 END IF;
 -- Replays are read-only and bound to the very same worker/review/request.
 SELECT * INTO v_existing FROM private.work_taxonomy_worker_bindings_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.source_review_id<>p_source_review_id OR v_existing.profile_id<>p_profile_id
  THEN RAISE EXCEPTION 'WORKER_BINDER_REQUEST_KEY_REUSED' USING errcode='22023'; END IF;
  RETURN v_existing.result;
 END IF;
 SELECT * INTO v_batch FROM private.work_taxonomy_review_batches_v1
  WHERE owner_account_id=p_owner_account_id AND request_key=p_request_key
   AND source_review_id=p_source_review_id AND purpose='WORKER_CAPABILITY'
  FOR SHARE;
 IF NOT FOUND OR v_batch.result->>'status'<>'COMMITTED'
   OR v_batch.result->'requiresBinding' IS DISTINCT FROM 'true'::jsonb
   OR v_batch.result->'capabilityAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR v_batch.result->'notificationAuthority' IS DISTINCT FROM '"NONE"'::jsonb
   OR jsonb_typeof(v_batch.plans)<>'array'
   OR jsonb_typeof(v_batch.result->'items')<>'array'
   OR jsonb_array_length(v_batch.plans) NOT BETWEEN 1 AND 24
   OR jsonb_array_length(v_batch.result->'items')<>jsonb_array_length(v_batch.plans)
 THEN RAISE EXCEPTION 'WORKER_BINDER_ADMISSION_NOT_COMMITTED' USING errcode='42501'; END IF;
 SELECT * INTO v_review FROM private.worker_ai_reviews
  WHERE id=p_source_review_id AND account_id=p_owner_account_id FOR SHARE;
 IF NOT FOUND OR v_review.envelope->>'classificationState'<>'READY'
   OR v_review.envelope->>'displayedContentDigest' IS DISTINCT FROM v_batch.review_digest
   OR v_review.envelope->'classificationCandidates' IS DISTINCT FROM v_batch.plans
   OR v_review.envelope->'canAccept' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(v_review.envelope->'reviewedServiceModes')<>'array'
   OR jsonb_array_length(v_review.envelope->'reviewedServiceModes')
       <>jsonb_array_length(v_batch.plans)
   OR v_review.envelope->>'profileId' IS DISTINCT FROM p_profile_id::text
 THEN RAISE EXCEPTION 'WORKER_BINDER_REVIEW_NOT_BOUND' USING errcode='42501'; END IF;
 v_digest:=encode(extensions.digest(
  ((v_review.envelope-'displayedContentDigest')
    ||jsonb_build_object('baseHash',v_review.base_hash))::text,'sha256'),'hex');
 IF v_digest IS DISTINCT FROM v_batch.review_digest THEN
   RAISE EXCEPTION 'WORKER_BINDER_REVIEW_DIGEST_INVALID' USING errcode='42501'; END IF;
 SELECT * INTO v_save FROM private.worker_ai_saves
  WHERE review_id=p_source_review_id AND account_id=p_owner_account_id
    AND client_request_id=p_request_key FOR SHARE;
 IF NOT FOUND OR v_save.created_at>v_review.expires_at
   OR v_save.receipt->'saved' IS DISTINCT FROM 'true'::jsonb
   OR v_save.receipt->>'profileId' IS DISTINCT FROM p_profile_id::text
   OR v_save.receipt->>'profileStatus'<>'ACTIVE'
 THEN RAISE EXCEPTION 'WORKER_BINDER_SAVE_OR_ACTIVATION_REQUIRED' USING errcode='42501'; END IF;
 -- A delayed outbox command from an OLD Save must never re-enable modes
 -- superseded by a newer user-confirmed worker review for this same profile.
 IF EXISTS(SELECT 1 FROM private.worker_ai_saves newer
   WHERE newer.account_id=p_owner_account_id
     AND newer.created_at>v_save.created_at
     AND newer.receipt->>'profileId'=p_profile_id::text)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_SAVE_EXISTS' USING errcode='PT409'; END IF;
 -- Hold current worker profile throughout the transaction. Reject any edit
 -- after the reviewed Save, even if the new skill text happens to be identical.
 SELECT * INTO v_profile FROM public.app_profiles
  WHERE id=p_profile_id AND account_id=p_owner_account_id AND kind='WORKER'
  FOR UPDATE;
 v_skills:=v_review.envelope#>'{profile,skills}';
 IF NOT FOUND OR v_profile.profile_status<>'ACTIVE'
   OR v_profile.updated_at>v_save.created_at
   OR jsonb_typeof(v_skills)<>'array'
   OR to_jsonb(v_profile.skills) IS DISTINCT FROM v_skills
 THEN RAISE EXCEPTION 'WORKER_BINDER_CURRENT_PROFILE_REQUIRED' USING errcode='PT409'; END IF;
 -- Make every scope and category EXACT. A related branch never certifies ability.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_plan:=v_batch.plans->v_count;
   v_item:=v_batch.result->'items'->v_count;
   v_key:=private.taxonomy_normalize_v1(v_item->>'service');
   v_mode:=v_item->>'mode';
   IF v_plan->>'mode' IS DISTINCT FROM v_mode
     OR private.taxonomy_normalize_v1(v_plan->>'service') IS DISTINCT FROM v_key
     OR v_plan->>'action' NOT IN ('REUSE_EXISTING','CREATE_CHILD','CREATE_NEW_BRANCH')
     OR v_mode NOT IN ('ON_SITE','REMOTE')
     OR jsonb_typeof(v_item->'categoryId')<>'string'
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_skills) offered(value)
       WHERE private.taxonomy_normalize_v1(offered.value#>>'{}')=v_key)
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(
        v_review.envelope->'reviewedServiceModes') m(value)
       WHERE private.taxonomy_normalize_v1(m.value->>'service')=v_key
         AND m.value->>'mode'=v_mode)
     OR v_key||'|'||v_mode=ANY(v_seen)
   THEN RAISE EXCEPTION 'WORKER_BINDER_SERVICE_OR_MODE_NOT_REVIEWED' USING errcode='42501'; END IF;
   v_seen:=array_append(v_seen,v_key||'|'||v_mode);
   v_category:=(v_item->>'categoryId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
      JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id
      WHERE c.id=v_category AND c.state='ESTABLISHED'
        AND cm.execution_scope=v_mode
        AND (c.canonical_key=v_key OR EXISTS(
          SELECT 1 FROM private.work_taxonomy_aliases a
          WHERE a.category_id=c.id AND a.normalized_key=v_key)))
   THEN RAISE EXCEPTION 'WORKER_BINDER_CATEGORY_STALE' USING errcode='42501'; END IF;
   -- A past withdrawal (excluded=true) is NOT permanent: the owner may
   -- deliberately offer this service again in a NEW signed Save. ONLY this
   -- binder may restore it, with zero inherited related-offer consent.
   IF v_mode='ON_SITE' THEN v_onsite:=true; ELSE v_remote:=true; END IF;
 END LOOP;
 -- A recent explicit global-mode change must not be overwritten by a delayed
 -- binder from an older review. All updates below are ONE DB transaction.
 IF EXISTS(SELECT 1 FROM private.worker_execution_mode_choices choice
   WHERE choice.worker_profile_id=p_profile_id AND choice.updated_at>v_save.created_at)
 THEN RAISE EXCEPTION 'WORKER_BINDER_NEWER_GLOBAL_MODE' USING errcode='PT409'; END IF;
 IF v_onsite THEN v_modes:=array_append(v_modes,'ON_SITE'); END IF;
 IF v_remote THEN v_modes:=array_append(v_modes,'REMOTE'); END IF;
 INSERT INTO private.worker_execution_mode_choices(
   worker_profile_id,worker_account_id,modes,consent_source,confirmed_at,updated_at)
 VALUES(p_profile_id,p_owner_account_id,v_modes,'EXPLICIT_PROFILE_REVIEW',
   statement_timestamp(),statement_timestamp())
 ON CONFLICT(worker_profile_id) DO UPDATE
   SET modes=excluded.modes,consent_source='EXPLICIT_PROFILE_REVIEW',
       confirmed_at=statement_timestamp(),updated_at=statement_timestamp();
 -- Catalog identities and per-service scope are granted only AFTER the
 -- signed review, saved receipt and current profile all passed.
 FOR v_count IN 0..jsonb_array_length(v_batch.plans)-1 LOOP
   v_item:=v_batch.result->'items'->v_count;
   v_category:=(v_item->>'categoryId')::uuid;v_mode:=v_item->>'mode';
   INSERT INTO private.work_taxonomy_worker_capabilities(
      worker_account_id,category_id,confirmed_at,allow_related_offers,excluded,origin)
   VALUES(p_owner_account_id,v_category,statement_timestamp(),false,false,'WORKER_CONFIRMED')
   ON CONFLICT(worker_account_id,category_id) DO UPDATE
     SET confirmed_at=statement_timestamp(),updated_at=statement_timestamp(),
         excluded=false,allow_related_offers=false,origin='WORKER_CONFIRMED';
   INSERT INTO private.taxonomy_confirmed_worker_modes_v1(
     worker_account_id,category_id,execution_scope,source_review_id,source_request_key,
     confirmed_at,active)
   VALUES(p_owner_account_id,v_category,v_mode,p_source_review_id,p_request_key,
     statement_timestamp(),true)
   ON CONFLICT(worker_account_id,category_id,execution_scope) DO UPDATE
    SET source_review_id=excluded.source_review_id,
        source_request_key=excluded.source_request_key,
        confirmed_at=statement_timestamp(),active=true;
 END LOOP;
 -- The CURRENT complete review replaces old per-service permission. Retain
 -- history, but deactivate obsolete modes; never manufacture a related opt-in.
 UPDATE private.taxonomy_confirmed_worker_modes_v1 old
 SET active=false
 WHERE old.worker_account_id=p_owner_account_id AND old.active
   AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_batch.result->'items') item(value)
     WHERE (item.value->>'categoryId')::uuid=old.category_id
       AND item.value->>'mode'=old.execution_scope);
 v_result:=jsonb_build_object('status','BOUND_WORKER_SERVICES',
   'workerProfileId',p_profile_id,'serviceModeCount',jsonb_array_length(v_batch.plans),
   'catalogVersion',v_batch.catalog_version,'dispatchAuthority','NONE',
   'notificationAuthority','NONE','relatedOfferAuthority','NONE');
 INSERT INTO private.work_taxonomy_worker_bindings_v1(
   owner_account_id,request_key,source_review_id,profile_id,catalog_version,result)
 VALUES(p_owner_account_id,p_request_key,p_source_review_id,p_profile_id,
   v_batch.catalog_version,v_result);
 RETURN v_result;
END $function$
;

