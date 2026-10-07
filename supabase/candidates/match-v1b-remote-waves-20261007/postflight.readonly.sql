-- MATCH-V1B read-only postflight. No write. Expected: every flag true and the certificate equal to the preflight value.
select jsonb_build_object(
 'waveIsMatchV1B',(select md5(p.prosrc) from pg_proc p where p.oid=to_regprocedure('private.dispatch_next_wave(uuid)'))='e70a2c38e03ed32175c568c7153f1fc8',
 'newFunctionsAndWave',(select bool_and(coalesce(md5(p.prosrc)=any(x.body_md5s),false)) from (values
  ('private.dispatch_next_wave(uuid)',array['e70a2c38e03ed32175c568c7153f1fc8']::text[]),
  ('private.worker_notify_room_v1b(uuid,integer)',array['9aac9da0479327fdf82b2f9298e47719']::text[]),
  ('private.candidate_profile_ids_v1b(uuid,integer,integer)',array['9a2437fd9d6bed07c8338d12501e5cba']::text[]),
  ('private.remote_wave_candidates_v1b(uuid,integer,integer)',array['3bd12de1d220804a91a7b1b036fd7ce6']::text[]),
  ('private.dispatch_config_v1b(jsonb)',array['a2c0533ce7278ab568911a155e97b953']::text[]),
  ('private.dispatch_remote_wave_v1b(uuid,jsonb,jsonb,text,integer,integer,integer,integer,integer,integer,integer)',array['b416ff2c01056af38868e3fa4a1a76b5']::text[])
) x(signature,body_md5s) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'dependenciesUnchanged',(select bool_and(coalesce(md5(p.prosrc)=any(x.body_md5s),false)) from (values
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
 'newFunctionAcl',(select bool_and(p.proacl::text='{postgres=X/postgres}' and p.prosecdef) from pg_proc p where p.oid in (
  to_regprocedure('private.worker_notify_room_v1b(uuid,integer)'),
  to_regprocedure('private.candidate_profile_ids_v1b(uuid,integer,integer)'),
  to_regprocedure('private.remote_wave_candidates_v1b(uuid,integer,integer)'),
  to_regprocedure('private.dispatch_config_v1b(jsonb)'),
  to_regprocedure('private.dispatch_remote_wave_v1b(uuid,jsonb,jsonb,text,integer,integer,integer,integer,integer,integer,integer)'))),
 'dispatchRow',(select value from private.marketplace_config where key='match_v1_dispatch'),
 'knobsValid',(select private.dispatch_config_v1b(value) from private.marketplace_config where key='match_v1_dispatch'),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready()
) as match_v1b_postflight;
