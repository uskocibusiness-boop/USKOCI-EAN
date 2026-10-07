-- DISCOVERY-GRAD read-only preflight for canonical DEV leqcwgzvjsxugfgzdmth. No write. Expected: every flag true,
-- certificate 3a785d42... / 2027655d... (the values of 2026-10-08), the retried-literal count 0 (B24).
select jsonb_build_object(
 'ledger',(select count(*) from supabase_migrations.schema_migrations),
 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),
 'readerIsDiscoveryZamene',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)'))='dc69802e3ba209232a8be095f60e9c9f',
 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
 'dependencies',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5) from (values
  ('public.p6_discovery_key(text)','ebfe1252f1798d89bbffb35b6eef6167'),
  ('public.p6_discovery_trim(text)','40109e93b620146aa8d536907d28c91b'),
  ('public.p6_discovery_unquote(text)','35706ddc2125e8cacf74ee370f82ff2f'),
  ('public.p6_discovery_area(text,text,boolean)','041441c14c18230a8da05a97c53ab350'),
  ('public.discovery_for_me_state_v1()','bd4dcf16863e7564a5d82ac22aca1418'),
  ('public.discovery_for_me_v1(uuid)','60c104139cebbccfa16a570fc3386c0c')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'helperAbsent',to_regprocedure('public.discovery_fold_v1(text)') is null,
 'collationReady',exists(select 1 from pg_collation where collname='sr-Latn-RS-x-icu' and collprovider='i'),
 'retriedLiteralFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%40001%'),
 'openTasks',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null and remaining_search_closed_at is null),
 'openTasksWithoutCityButAreaWithComma',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null
   and nullif(btrim(coalesce(approximate_city,'')),'') is null and strpos(coalesce(approximate_area,''),',')>0),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5()
) as discovery_grad_preflight;
