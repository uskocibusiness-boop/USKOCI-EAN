-- R10 optional usage/audio projection in the existing 73-dataset contract: FORWARD.
-- No policy, readiness pin, legal content, reservation, usage, or account is changed.
-- measuredAudioBytes is decimal text: exact bigint values cannot round in JSON clients.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE uskoci_r10_usage_guard(signature text PRIMARY KEY, metadata jsonb) ON COMMIT DROP;
DO $r10_guard$
DECLARE expected record; p pg_proc%rowtype;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('private.data_export_dataset_catalog()','f897294aed6972dd1c41a88da42ea1ab'),
    ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','3e20cccd6b54b161970c6960fa33136b')
  ) x(signature,body_md5) LOOP
    SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(expected.signature);
    IF md5(p.prosrc) IS DISTINCT FROM expected.body_md5 THEN RAISE EXCEPTION 'R10_USAGE_SOURCE_PREIMAGE_DRIFT:%',expected.signature; END IF;
    IF pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.proisstrict
       OR p.prokind<>'f' OR p.proleakproof OR p.proparallel<>'u' OR p.procost<>100 OR p.prorows<>0
       OR p.pronargdefaults<>0 OR p.provariadic<>0
       OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='sql')
       OR p.provolatile::text<>(CASE WHEN expected.signature='private.data_export_dataset_catalog()' THEN 'i' ELSE 's' END)
       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
       OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}' THEN
      RAISE EXCEPTION 'R10_USAGE_AUTHORITY_PREIMAGE_DRIFT:%',expected.signature;
    END IF;
    INSERT INTO pg_temp.uskoci_r10_usage_guard VALUES(expected.signature,to_jsonb(p)-'prosrc');
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='private.ai_test_usage_v5'::regclass AND c.contype='p'
    AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='operation_id' AND NOT attisdropped)]::smallint[]) THEN
    RAISE EXCEPTION 'R10_USAGE_OPERATION_KEY_REQUIRED';
  END IF;
  IF (SELECT array_agg(attname::text||':'||format_type(atttypid,atttypmod) ORDER BY attname)
       FROM pg_attribute WHERE attrelid='private.ai_test_usage_v5'::regclass AND attnum>0 AND NOT attisdropped)
       IS DISTINCT FROM ARRAY['account_id:uuid','model:text','operation_id:uuid','output_tokens:integer','prompt_tokens:integer','recorded_at:timestamp with time zone','total_tokens:integer']::text[] THEN
    RAISE EXCEPTION 'R10_USAGE_RELATION_SHAPE_DRIFT';
  END IF;
  IF jsonb_array_length(private.data_export_dataset_catalog())<>73
       OR private.data_export_projection_sha_v5() IS DISTINCT FROM 'd3a687cacca08056156fbc58a171aece3e029c0351ad68e6cf617d0bd6bed8d1' THEN
    RAISE EXCEPTION 'R10_USAGE_DATASET_CONTRACT_DRIFT';
  END IF;
END $r10_guard$;
DO $r10_patch$
DECLARE definition text; old_fragment text; new_fragment text;
BEGIN
  SELECT pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure) INTO definition;
  old_fragment:=$r10_old${"key": "testAllocations", "fields": ["allocatedMaximumMicrousd", "createdAt", "kind", "measuredProviderCharge", "settledAt", "settledMicrousd", "settlementBasis"], "dataClass": "AUDIT_SECURITY_LOGS", "ownershipFilter": "t.account_id=REQUEST_ACCOUNT"}$r10_old$;
  new_fragment:=$r10_new${"key":"testAllocations","fields":["allocatedMaximumMicrousd","createdAt","kind","measuredAudioBytes","measuredProviderCharge","measuredTranscriptChars","model","outputTokens","promptTokens","settledAt","settledMicrousd","settlementBasis","totalTokens","usageRecordedAt"],"dataClass":"AUDIT_SECURITY_LOGS","ownershipFilter":"t.account_id=REQUEST_ACCOUNT"}$r10_new$;
  IF (length(definition)-length(replace(definition,old_fragment,'')))/length(old_fragment)<>1 THEN
    RAISE EXCEPTION 'R10_USAGE_FRAGMENT_DRIFT';
  END IF;
  EXECUTE replace(definition,old_fragment,new_fragment);
  SELECT pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure) INTO definition;
  old_fragment:=$r10_old$select 'testAllocations' as key,jsonb_build_object('kind',t.kind,'allocatedMaximumMicrousd',t.max_cost_microusd,'measuredProviderCharge',coalesce(t.settlement_basis='MEASURED',false),'settledMicrousd',t.settled_microusd,'settlementBasis',t.settlement_basis,'settledAt',t.settled_at,'createdAt',t.created_at) as value from private.ai_test_reservations_v5 t where t.account_id=p_account_id$r10_old$;
  new_fragment:=$r10_new$select 'testAllocations' as key,jsonb_build_object('kind',t.kind,'allocatedMaximumMicrousd',t.max_cost_microusd,'measuredProviderCharge',coalesce(t.settlement_basis='MEASURED',false),'settledMicrousd',t.settled_microusd,'settlementBasis',t.settlement_basis,'settledAt',t.settled_at,'createdAt',t.created_at,
 'model',case when char_length(u.model) between 1 and 100 and char_length(btrim(u.model))>0 then u.model else null end,
 'promptTokens',case when u.prompt_tokens between 0 and 10000000 then u.prompt_tokens else null end,
 'outputTokens',case when u.output_tokens between 0 and 10000000 then u.output_tokens else null end,
 'totalTokens',case when u.total_tokens between 0 and 20000000 then u.total_tokens else null end,
 'usageRecordedAt',case when isfinite(u.recorded_at) then u.recorded_at else null end,
 'measuredAudioBytes',case when t.kind='STT' and t.measured_audio_bytes>0 then t.measured_audio_bytes::text else null end,
 'measuredTranscriptChars',case when t.kind='STT' and t.measured_transcript_chars>=0 then t.measured_transcript_chars else null end
 ) as value from private.ai_test_reservations_v5 t
 left join private.ai_test_usage_v5 u on u.operation_id=t.operation_id and u.account_id=t.account_id
 where t.account_id=p_account_id$r10_new$;
  IF (length(definition)-length(replace(definition,old_fragment,'')))/length(old_fragment)<>1 THEN
    RAISE EXCEPTION 'R10_USAGE_FRAGMENT_DRIFT';
  END IF;
  EXECUTE replace(definition,old_fragment,new_fragment);
END $r10_patch$;
DO $r10_verify$
DECLARE expected record; p pg_proc%rowtype; previous jsonb;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('private.data_export_dataset_catalog()','45a2458b8e93a33649e885ad1ba41b4d'),
    ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','8130be4bf875702981ec408a33af62ca')
  ) x(signature,body_md5) LOOP
    SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(expected.signature);
    SELECT metadata INTO STRICT previous FROM pg_temp.uskoci_r10_usage_guard WHERE signature=expected.signature;
    IF md5(p.prosrc) IS DISTINCT FROM expected.body_md5 OR (to_jsonb(p)-'prosrc') IS DISTINCT FROM previous THEN
      RAISE EXCEPTION 'R10_USAGE_POSTIMAGE_DRIFT:%',expected.signature;
    END IF;
  END LOOP;
  IF jsonb_array_length(private.data_export_dataset_catalog())<>73
       OR private.data_export_projection_sha_v5() IS DISTINCT FROM 'd9cf862ba967b8a3411bfcee9f57718e4c780896302525c4849bf2891d6f12ee' THEN
    RAISE EXCEPTION 'R10_USAGE_POSTIMAGE_CONTRACT_DRIFT';
  END IF;
END $r10_verify$;
COMMIT;
