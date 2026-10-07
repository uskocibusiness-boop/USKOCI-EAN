-- MATCH-V1B read-only preflight for canonical DEV leqcwgzvjsxugfgzdmth. No write. Expected: every flag true.
select jsonb_build_object(
 'ledger',(select count(*) from supabase_migrations.schema_migrations),
 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'matchV1Applied',to_regprocedure('private.worker_need_match_v1(uuid,uuid)') is not null,
 'waveIsMatchV1',(select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure('private.dispatch_next_wave(uuid)'))='0bd8b64ae629f5a62960f5f45e65132b',
 'pinsMatch',(select bool_and(coalesce(md5(p.prosrc)=any(x.body_md5s),false)) from (values
  ('private.candidate_profile_ids(uuid,integer)',array['5414fa5a122e2055c71dd37993a6ad83']::text[]),
  ('private.dispatch_cheap_candidate_admitted(uuid,uuid)',array['cec5c0a2c13af6718af53b7a80245f28']::text[]),
  ('private.dispatch_tick(integer,timestamp with time zone)',array['76280b0ad653d2fc10199bca2c3971a8']::text[]),
  ('private.match_detail_without_calendar(uuid,uuid)',array['efd50886ff898f45129d33231761d189']::text[]),
  ('private.worker_dispatch_time_admitted(uuid,uuid)',array['a58f1d1a2d21fa057867c153ae62ba4e']::text[]),
  ('private.worker_need_time_tier_v1(uuid,uuid)',array['753027749309ccc110f486cbfb4866e4']::text[]),
  ('private.worker_need_fit_v1(uuid,uuid,boolean)',array['ab221f0091d78856bb42f702ddecd016']::text[]),
  ('private.worker_need_match_v1(uuid,uuid)',array['ef94ef7de07a347824ace68789f08c41']::text[]),
  ('private.requeue_changed_worker_profiles_v1(timestamp with time zone)',array['9104edac66d52ba630b91fac58c7fcbc']::text[]),
  ('private.match_detail(uuid,uuid)',array['38c7894a8cf43a8f32bd5a30bc2cbd09']::text[]),
  ('private.need_search_time_admitted_v1(uuid,timestamp with time zone)',array['b830cd07c2a5db101a3a28096256a75b']::text[]),
  ('private.enqueue_dispatch(uuid,timestamp with time zone)',array['470ed6ab6501c69bf9ebbfe057ccd0fb']::text[])
) x(signature,body_md5s) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'pinMismatches',(select coalesce(jsonb_agg(x.signature),'[]'::jsonb) from (values
  ('private.candidate_profile_ids(uuid,integer)',array['5414fa5a122e2055c71dd37993a6ad83']::text[]),
  ('private.dispatch_cheap_candidate_admitted(uuid,uuid)',array['cec5c0a2c13af6718af53b7a80245f28']::text[]),
  ('private.dispatch_tick(integer,timestamp with time zone)',array['76280b0ad653d2fc10199bca2c3971a8']::text[]),
  ('private.match_detail_without_calendar(uuid,uuid)',array['efd50886ff898f45129d33231761d189']::text[]),
  ('private.worker_dispatch_time_admitted(uuid,uuid)',array['a58f1d1a2d21fa057867c153ae62ba4e']::text[]),
  ('private.worker_need_time_tier_v1(uuid,uuid)',array['753027749309ccc110f486cbfb4866e4']::text[]),
  ('private.worker_need_fit_v1(uuid,uuid,boolean)',array['ab221f0091d78856bb42f702ddecd016']::text[]),
  ('private.worker_need_match_v1(uuid,uuid)',array['ef94ef7de07a347824ace68789f08c41']::text[]),
  ('private.requeue_changed_worker_profiles_v1(timestamp with time zone)',array['9104edac66d52ba630b91fac58c7fcbc']::text[]),
  ('private.match_detail(uuid,uuid)',array['38c7894a8cf43a8f32bd5a30bc2cbd09']::text[]),
  ('private.need_search_time_admitted_v1(uuid,timestamp with time zone)',array['b830cd07c2a5db101a3a28096256a75b']::text[]),
  ('private.enqueue_dispatch(uuid,timestamp with time zone)',array['470ed6ab6501c69bf9ebbfe057ccd0fb']::text[])
) x(signature,body_md5s) left join pg_proc p on p.oid=to_regprocedure(x.signature) where not coalesce(md5(p.prosrc)=any(x.body_md5s),false)),
 'newFunctionsAbsent',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('worker_notify_room_v1b','candidate_profile_ids_v1b','remote_wave_candidates_v1b','dispatch_config_v1b','dispatch_remote_wave_v1b')),
 'dispatchRow',(select value from private.marketplace_config where key='match_v1_dispatch'),
 'dispatchRowHasNoNewKeys',(select jsonb_typeof(m.value)='object' and not exists(select 1 from jsonb_object_keys(m.value) as ks(key_name)
   where ks.key_name like 'remote%' or ks.key_name like 'worker%') from private.marketplace_config m where m.key='match_v1_dispatch'),
 'closureNotExecuting',not exists(select 1 from private.closure_executions_v5 where state='EXECUTING'),
 'activeWorkerProfiles',(select count(*) from public.app_profiles where kind='WORKER' and profile_status='ACTIVE'),
 'openTasks',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null),
 'openTasksWithoutAPlace',(select count(*) from public.needs where status in ('PUBLISHED','SELECTION') and published_at is not null
   and not coalesce((execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')) and approx_geog is not null,false))
) as match_v1b_preflight;
