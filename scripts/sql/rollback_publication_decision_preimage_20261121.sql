-- USKOCI DEV rollback preimage captured 2026-11-21 (read-only SELECT of pg_get_functiondef).
-- Restore only as a controlled rollback of publication_decision_final_20261121.candidate.sql.
-- CREATE OR REPLACE preserves current ownership and ACLs; metadata is recorded above each definition.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
-- public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb) | functiondef_md5=a88ed8ac30a5a001e69ffe59999c1b61 | prosrc_md5=f6c506b0d6f53d4c6c0ffdff0c9121c4 | owner=postgres | acl={postgres=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_record_need_publication_decision_service(p_need_id uuid, p_expected_revision integer, p_policy_id text, p_jurisdiction text, p_outcome text, p_rule_ids text[], p_decision_source text, p_safe_reason_codes text[] DEFAULT '{}'::text[], p_provider_ref text DEFAULT NULL::text, p_model_ref text DEFAULT NULL::text, p_reviewer_provenance jsonb DEFAULT '{}'::jsonb, p_service_provenance jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_need public.needs%rowtype;
  v_bundle_id uuid;
  v_policy_id text;
  v_policy_version integer;
  v_jurisdiction text;
  v_rule_ids text[];
  v_safe_reason_codes text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_fp jsonb;
  v_identity_payload jsonb;
  v_identity text;
  v_decision_id uuid;
  v_sequence bigint;
  v_context jsonb;
  v_decision_at timestamptz;
begin
  if p_need_id is null or p_expected_revision is null then
    raise exception 'DECISION_NEED_REVISION_REQUIRED' using errcode='22004';
  end if;
  if coalesce(btrim(p_policy_id), '') = ''
     or coalesce(btrim(p_jurisdiction), '') = '' then
    raise exception 'POLICY_ID_JURISDICTION_REQUIRED' using errcode='22023';
  end if;
  if p_outcome is null or p_outcome not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then
    raise exception 'DECISION_OUTCOME_INVALID' using errcode='22023';
  end if;
  if p_decision_source is distinct from 'PUBLICATION_EVALUATOR_V1' then
    raise exception 'DECISION_SOURCE_REQUIRED' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(p_reviewer_provenance, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_service_provenance, 'null'::jsonb)) <> 'object'
     or coalesce(p_service_provenance, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'DECISION_PROVENANCE_INVALID' using errcode='22023';
  end if;

  if p_rule_ids is null or cardinality(p_rule_ids) not between 1 and 64 or array_ndims(p_rule_ids)<>1
     or exists(select 1 from unnest(p_rule_ids) r where r is null or r !~ '^[A-Z][A-Z0-9_-]{0,63}$')
     or (select count(distinct r) from unnest(p_rule_ids) r)<>cardinality(p_rule_ids)
     or p_safe_reason_codes is null or cardinality(p_safe_reason_codes)>64 or coalesce(array_ndims(p_safe_reason_codes),1)<>1
     or exists(select 1 from unnest(p_safe_reason_codes) r where r is null or r !~ '^[A-Z][A-Z0-9_-]{0,63}$')
     or (select count(distinct r) from unnest(p_safe_reason_codes) r)<>cardinality(p_safe_reason_codes)
     or octet_length(p_service_provenance::text)>65536 or octet_length(p_reviewer_provenance::text)>8192 then
    raise exception 'DECISION_OUTPUT_INVALID' using errcode='22023';
  end if;
  v_context:=private.need_publication_context(p_need_id,p_expected_revision,null);
  if v_context->>'kind'<>'READY' then raise exception 'PUBLICATION_CONTEXT_NOT_READY' using errcode='P0001',detail=v_context->>'code'; end if;
  if p_service_provenance is distinct from jsonb_build_object('evaluationContext',v_context->'binding') then
    raise exception 'PUBLICATION_CONTEXT_STALE' using errcode='PT409';
  end if;
  if p_policy_id is distinct from v_context#>>'{binding,policyId}' or p_jurisdiction is distinct from v_context#>>'{binding,jurisdiction}' then
    raise exception 'PUBLICATION_POLICY_STALE' using errcode='PT409';
  end if;
  if exists(select 1 from unnest(p_rule_ids) id where not exists(
       select 1 from jsonb_array_elements(v_context#>'{policy,rules}') r where r->>'ruleId'=id and (r->'outcomes') ? p_outcome))
     or exists(select 1 from unnest(p_safe_reason_codes) code where not exists(
       select 1 from jsonb_array_elements(v_context#>'{policy,rules}') r where r->>'ruleId'=any(p_rule_ids) and (r->'safeReasonCodes') ? code)) then
    raise exception 'DECISION_OUTPUT_NOT_IN_POLICY' using errcode='22023';
  end if;

  select * into v_need
    from public.needs
   where id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='PT409';
  end if;

  if not exists (
    select 1 from public.need_geography g
     where g.need_id = p_need_id
       and jsonb_typeof(g.public_topology) = 'object'
  ) then
    raise exception 'PUBLIC_GEOGRAPHY_NOT_CANONICAL' using errcode='P0001';
  end if;

  if not private.media_refs_ready(v_need.requester_account_id,v_need.public_photo_paths) then
    raise exception 'PUBLIC_MEDIA_REVIEW_AUTHORITY_NOT_READY' using errcode='P0001';
  end if;

  v_bundle_id := private.current_publication_policy_bundle(
    btrim(p_policy_id),
    btrim(p_jurisdiction),
    clock_timestamp()
  );
  if v_bundle_id is null then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  select b.policy_id, b.version, b.jurisdiction
    into v_policy_id, v_policy_version, v_jurisdiction
    from private.publication_policy_bundles b
   where b.id = v_bundle_id;

  select coalesce(array_agg(x.rule_id order by x.rule_id), '{}'::text[])
    into v_rule_ids
    from (
      select distinct btrim(rid) as rule_id
        from unnest(coalesce(p_rule_ids, '{}'::text[])) rid
       where btrim(rid) <> ''
    ) x;

  if cardinality(v_rule_ids) = 0 then
    raise exception 'RULE_PROVENANCE_REQUIRED' using errcode='22023';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_bundle_id
     and r.rule_id = any(v_rule_ids);

  if v_rule_count <> cardinality(v_rule_ids) then
    raise exception 'RULE_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select coalesce(array_agg(x.reason_code order by x.reason_code), '{}'::text[])
    into v_safe_reason_codes
    from (
      select distinct btrim(rc) as reason_code
        from unnest(coalesce(p_safe_reason_codes, '{}'::text[])) rc
       where btrim(rc) <> ''
    ) x;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='PT409';
  end if;

  v_identity_payload := jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_expected_revision,
    'canonicalFingerprint', v_fp->>'canonicalFingerprint',
    'policyBundleId', v_bundle_id,
    'policyId', v_policy_id,
    'policyVersion', v_policy_version,
    'jurisdiction', v_jurisdiction,
    'ruleIds', to_jsonb(v_rule_ids),
    'outcome', p_outcome,
    'safeReasonCodes', to_jsonb(v_safe_reason_codes),
    'decisionSource', btrim(p_decision_source),
    'providerRef', nullif(btrim(coalesce(p_provider_ref,'')),''),
    'modelRef', nullif(btrim(coalesce(p_model_ref,'')),''),
    'reviewerProvenance', p_reviewer_provenance,
    'serviceProvenance', p_service_provenance
  );
  v_identity := encode(
    extensions.digest(convert_to(v_identity_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  if not private.publication_policy_bundle_ready(v_bundle_id,v_jurisdiction,clock_timestamp()) then raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001'; end if;

  insert into private.need_publication_decisions(
    need_id,
    need_revision,
    fingerprint_schema_version,
    canonical_fingerprint,
    private_materiality_marker,
    public_geography_snapshot,
    public_media_refs,
    policy_bundle_id,
    policy_id,
    policy_version,
    jurisdiction,
    rule_ids,
    rule_provenance_snapshot,
    outcome,
    safe_reason_codes,
    decision_source,
    provider_ref,
    model_ref,
    reviewer_provenance,
    service_provenance,
    decision_identity
  ) values (
    p_need_id,
    p_expected_revision,
    'NEED_PUBLICATION_FINGERPRINT_V1',
    v_fp->>'canonicalFingerprint',
    v_fp->>'privateMaterialityMarker',
    v_fp->'publicGeography',
    array(select jsonb_array_elements_text(v_fp->'publicMediaRefs')),
    v_bundle_id,
    v_policy_id,
    v_policy_version,
    v_jurisdiction,
    v_rule_ids,
    v_rule_snapshot,
    p_outcome,
    v_safe_reason_codes,
    btrim(p_decision_source),
    nullif(btrim(coalesce(p_provider_ref,'')),''),
    nullif(btrim(coalesce(p_model_ref,'')),''),
    p_reviewer_provenance,
    p_service_provenance,
    v_identity
  )
  on conflict (decision_identity) do nothing
  returning id, decision_sequence, created_at into v_decision_id, v_sequence, v_decision_at;

  if v_decision_id is null then
    select d.id, d.decision_sequence, d.created_at
      into v_decision_id, v_sequence, v_decision_at
      from private.need_publication_decisions d
     where d.decision_identity = v_identity;
  end if;

  return jsonb_build_object(
    'decisionId', v_decision_id,
    'decisionSequence', v_sequence,
    'needId', p_need_id,
    'needRevision', p_expected_revision,
    'canonicalFingerprint', v_fp->>'canonicalFingerprint',
    'policyBundleId', v_bundle_id,
    'policyVersion', v_policy_version,
    'jurisdiction', v_jurisdiction,
    'outcome', p_outcome,
    'decisionAt', v_decision_at,
    'ruleIds', to_jsonb(v_rule_ids),
    'safeReasonCodes', to_jsonb(v_safe_reason_codes),
    'publishable', p_outcome='ALLOW',
    'authoritative', true
  );
end;
$function$
;
-- public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text) | functiondef_md5=e49706bdd2653f54ef3d80497f6e3a73 | prosrc_md5=9d20dbb6063d8025d7255b10affdd566 | owner=postgres | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | security_definer=t | config={search_path=pg_catalog}
CREATE OR REPLACE FUNCTION public.rpc_publish_need_canonical(p_need_id uuid, p_expected_revision integer, p_decision_sequence bigint, p_response_deadline timestamp with time zone, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_payload jsonb;
  v_request_hash text;
  v_existing private.need_publish_commands%rowtype;
  v_need public.needs%rowtype;
  v_decision private.need_publication_decisions%rowtype;
  v_bundle private.publication_policy_bundles%rowtype;
  v_fp jsonb;
  v_context jsonb;
  v_public_media text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_result jsonb;
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_need_id is null or p_expected_revision is null or p_decision_sequence is null then
    raise exception 'PUBLISH_ID_REVISION_DECISION_REQUIRED' using errcode='22004';
  end if;
  if p_expected_revision <= 0 or p_decision_sequence <= 0 then
    raise exception 'PUBLISH_REVISION_DECISION_INVALID' using errcode='22023';
  end if;
  if char_length(v_request_id) < 8 or char_length(v_request_id) > 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  v_request_payload := jsonb_build_object(
    'needId', p_need_id,
    'expectedRevision', p_expected_revision,
    'decisionSequence', p_decision_sequence,
    'responseDeadline', p_response_deadline
  );
  v_request_hash := encode(
    extensions.digest(convert_to(v_request_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || E'\n' || v_request_id, 0)
  );

  select * into v_existing
    from private.need_publish_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if p_response_deadline is not null and p_response_deadline <= clock_timestamp() then
    raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023';
  end if;

  -- PKG-028b: a fixed-time task whose start has already passed cannot be offered to anyone. Checked before
  -- the publication context, and only on the caller's own task, so nobody learns another person's schedule.
  if exists (select 1 from public.needs n
              where n.id = p_need_id and n.requester_account_id = v_actor
                and n.schedule_kind = 'FIXED_WINDOW' and n.starts_at <= clock_timestamp()) then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;

  -- A recorded successful command is returned above even after its deadline or
  -- policy expiry; a new command must satisfy the entire current context.
  v_context:=private.need_publication_context(p_need_id,p_expected_revision,v_actor);
  if v_context->>'kind'<>'READY' then raise exception 'PUBLICATION_CONTEXT_NOT_READY' using errcode='P0001',detail=v_context->>'code'; end if;

  select * into v_need
    from public.needs n
   where n.id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception 'NEED_NOT_OWNED' using errcode='42501';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='PT409';
  end if;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='PT409';
  end if;
  v_public_media := array(
    select jsonb_array_elements_text(v_fp->'publicMediaRefs')
  );

  select * into v_decision
    from private.need_publication_decisions d
   where d.decision_sequence = p_decision_sequence;
  if not found then
    raise exception 'PUBLICATION_DECISION_NOT_FOUND' using errcode='P0002';
  end if;
  if v_decision.need_id <> p_need_id
     or v_decision.need_revision <> p_expected_revision then
    raise exception 'PUBLICATION_DECISION_SCOPE_MISMATCH' using errcode='P0001';
  end if;
  if v_decision.service_provenance->'evaluationContext' is distinct from v_context->'binding' then
    raise exception 'PUBLICATION_DECISION_CONTEXT_STALE' using errcode='PT409';
  end if;
  if v_decision.canonical_fingerprint <> v_fp->>'canonicalFingerprint'
     or v_decision.private_materiality_marker <> v_fp->>'privateMaterialityMarker'
     or v_decision.public_geography_snapshot is distinct from v_fp->'publicGeography'
     or v_decision.public_media_refs is distinct from v_public_media then
    raise exception 'PUBLICATION_DECISION_FINGERPRINT_STALE' using errcode='P0001';
  end if;

  if exists (
    select 1
      from private.need_publication_decisions newer
     where newer.need_id = p_need_id
       and newer.need_revision = p_expected_revision
       and newer.decision_sequence > v_decision.decision_sequence
  ) then
    raise exception 'PUBLICATION_DECISION_STALE' using errcode='P0001';
  end if;

  if v_decision.outcome <> 'ALLOW' then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(
       v_decision.policy_bundle_id,
       v_decision.jurisdiction,
       v_now
     ) then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  if private.current_publication_policy_bundle(
       v_decision.policy_id,
       v_decision.jurisdiction,
       v_now
     ) is distinct from v_decision.policy_bundle_id then
    raise exception 'PUBLICATION_POLICY_STALE' using errcode='P0001';
  end if;

  select * into v_bundle
    from private.publication_policy_bundles b
   where b.id = v_decision.policy_bundle_id;
  if not found
     or v_bundle.policy_id <> v_decision.policy_id
     or v_bundle.version <> v_decision.policy_version
     or v_bundle.jurisdiction <> v_decision.jurisdiction then
    raise exception 'PUBLICATION_POLICY_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_decision.policy_bundle_id
     and r.rule_id = any(v_decision.rule_ids);

  if v_rule_count <> cardinality(v_decision.rule_ids)
     or v_rule_snapshot is distinct from v_decision.rule_provenance_snapshot then
    raise exception 'PUBLICATION_POLICY_RULE_PROVENANCE_STALE' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(v_decision.policy_bundle_id,v_decision.jurisdiction,clock_timestamp()) then raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001'; end if;
  if p_response_deadline is not null and p_response_deadline<=clock_timestamp() then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;

  -- Same transaction: any later failure rolls back source cancellation and deliveries.
  perform private.finalize_task_replacement(p_need_id);
  perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);
  update public.needs n
     set status = 'PUBLISHED',
         published_at = v_now,
         response_deadline = p_response_deadline
   where n.id = p_need_id
     and n.status = 'DRAFT'
     and n.revision = p_expected_revision
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then
    raise exception 'NEED_PUBLISH_CONFLICT' using errcode='PT409';
  end if;

  if not exists (
    select 1 from private.dispatch_schedule s where s.need_id = p_need_id
  ) then
    raise exception 'DISPATCH_SCHEDULE_MISSING' using errcode='P0001';
  end if;

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'status', v_need.status,
    'publishedAt', v_need.published_at,
    'responseDeadline', v_need.response_deadline,
    'idempotentReplay', false
  );

  insert into private.need_publish_commands(
    requester_account_id,
    client_request_id,
    request_hash,
    need_id,
    expected_revision,
    decision_id,
    decision_sequence,
    canonical_fingerprint,
    policy_bundle_id,
    response_deadline,
    result
  ) values (
    v_actor,
    v_request_id,
    v_request_hash,
    p_need_id,
    p_expected_revision,
    v_decision.id,
    v_decision.decision_sequence,
    v_decision.canonical_fingerprint,
    v_decision.policy_bundle_id,
    p_response_deadline,
    v_result
  );

  return v_result;
end;
$function$
;
DO $rollback_postflight$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure) IS DISTINCT FROM 'f6c506b0d6f53d4c6c0ffdff0c9121c4'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)'::regprocedure) IS DISTINCT FROM '9d20dbb6063d8025d7255b10affdd566'
  THEN RAISE EXCEPTION 'PUBLICATION_DECISION_ROLLBACK_POSTIMAGE_DRIFT'; END IF;
END
$rollback_postflight$;
COMMIT;
