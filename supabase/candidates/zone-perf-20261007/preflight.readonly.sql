-- ZONE-PERF read-only preflight for canonical DEV leqcwgzvjsxugfgzdmth. No write. Expected: every flag true.
select jsonb_build_object(
 'ledger',(select count(*) from supabase_migrations.schema_migrations),
 'ledgerIs227',(select count(*) from supabase_migrations.schema_migrations)=227,
 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),
 'latestIsEx06eR3',(select max(version) from supabase_migrations.schema_migrations)='20261005101102',
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'helperIsPredecessor',(select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure('private.availability_timezone_valid(text)'))='013f884ca649cb5246f39eaf9f2e0ec9',
 'helperIsNotYetPostimage',(select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure('private.availability_timezone_valid(text)')) is distinct from 'be95520dabe35febd8e9fa15f0ce0309',
 'helperMetadata',(select jsonb_build_object('language',l.lanname,'volatility',p.provolatile,'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text)
   from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure('private.availability_timezone_valid(text)')),
 'catalogHasFastPathNames',(select count(*) from pg_catalog.pg_timezone_names where name in ('Europe/Belgrade','UTC'))=2,
 'closureNotExecuting',not exists(select 1 from private.closure_executions_v5 where state='EXECUTING'),
 'activeWorkerProfiles',(select count(*) from public.app_profiles where kind='WORKER' and profile_status='ACTIVE'),
 'openTasks',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null)
) as zone_perf_preflight;
