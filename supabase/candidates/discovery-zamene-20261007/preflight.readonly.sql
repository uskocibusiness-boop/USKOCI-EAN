-- DISCOVERY-ZAMENE read-only preflight (after MATCH-V1 is applied). No write. Expected: every flag true.
select jsonb_build_object(
 'ledger',(select count(*) from supabase_migrations.schema_migrations),
 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),
 'matchV1Applied',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5) from (values
  ('private.worker_need_time_tier_v1(uuid,uuid)','753027749309ccc110f486cbfb4866e4'),
  ('private.worker_need_fit_v1(uuid,uuid,boolean)','ab221f0091d78856bb42f702ddecd016'),
  ('private.worker_need_match_v1(uuid,uuid)','ef94ef7de07a347824ace68789f08c41')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'readerIsP6V3',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)'))='1c60224483697732c496df5b9207f08f',
 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
 'helpersAbsent',to_regprocedure('public.discovery_for_me_state_v1()') is null and to_regprocedure('public.discovery_for_me_v1(uuid)') is null,
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'openPointToPointWithoutPoint',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION')
   and execution_location_mode='POINT_TO_POINT' and (approximate_lat is null or approximate_lng is null)),
 'openPointToPointWithoutPointButStartRecorded',(select count(*) from public.needs n join public.need_sensitive s on s.need_id=n.id
   where n.status in ('PUBLISHED','SELECTION') and n.execution_location_mode='POINT_TO_POINT'
   and (n.approximate_lat is null or n.approximate_lng is null)
   and exists(select 1 from jsonb_array_elements(coalesce(s.resolved_location->'value'->'points','[]'::jsonb)) x where x->>'slot'='start'))
) as discovery_zamene_preflight;
