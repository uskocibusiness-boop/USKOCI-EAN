-- PROFILE-TRUST read-only postflight. No write. Expected: newFunctions true, configRowsAtDefault true, the certificate equal to the
-- preflight value, completedCountMismatches 0 (the helper reproduces completedCount of rpc_get_public_profile for every worker profile).
select jsonb_build_object(
 'newFunctions',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5 and p.proacl::text is not distinct from x.acl and p.prosecdef
    and p.provolatile='s' and p.proconfig=array['search_path=pg_catalog']) from (values
   ('private.profile_trust_visibility_v1()','e590c5e928bd0e354eefb48284576738','{postgres=X/postgres}'),
   ('private.received_reviews_detail_v1()','990523c10a4e40152068570cdb71371d','{postgres=X/postgres}'),
   ('private.work_trust_counts_v1(uuid)','b5a39dfa80fe43990c264205edd0ed06','{postgres=X/postgres}'),
   ('public.rpc_public_work_trust_v1(uuid)','525d5b614cf725fa6280ac9f62f62943','{postgres=X/postgres,authenticated=X/postgres}'),
   ('public.rpc_my_work_stats_v1()','d8aa036fe16400d569b18667a85d0199','{postgres=X/postgres,authenticated=X/postgres}'),
   ('public.rpc_list_received_reviews_v1(integer,text)','9462ed163b1e4a465c68ad72d18f0e3d','{postgres=X/postgres,authenticated=X/postgres}')) x(signature,body_md5,acl) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'anonCannotExecute',not (has_function_privilege('anon','public.rpc_public_work_trust_v1(uuid)','EXECUTE') or has_function_privilege('anon','public.rpc_my_work_stats_v1()','EXECUTE')
    or has_function_privilege('anon','public.rpc_list_received_reviews_v1(integer,text)','EXECUTE')),
 'authenticatedCanExecute',has_function_privilege('authenticated','public.rpc_public_work_trust_v1(uuid)','EXECUTE') and has_function_privilege('authenticated','public.rpc_my_work_stats_v1()','EXECUTE')
    and has_function_privilege('authenticated','public.rpc_list_received_reviews_v1(integer,text)','EXECUTE'),
 'configRowsAtDefault',(select value from private.marketplace_config where key='profile_trust_visibility') is not distinct from jsonb_build_object('schema','PROFILE_TRUST_VISIBILITY_V1','mode','OWN_ONLY','owner','PROFILE-TRUST 2026-10-07')
    and (select value from private.marketplace_config where key='received_reviews_detail') is not distinct from jsonb_build_object('schema','RECEIVED_REVIEWS_DETAIL_V1','mode','COMMENTED_ONLY','owner','PROFILE-TRUST 2026-10-07'),
 'visibility',private.profile_trust_visibility_v1(),
 'receivedReviewsDetail',private.received_reviews_detail_v1(),
 'dependencyDrift',(select coalesce(jsonb_agg(x.signature order by x.signature),'[]'::jsonb) from (values
   ('public.rpc_get_public_profile(uuid)','9ecc0b69096f1167d02e0bb7b9656bc0'),
   ('private.safety_pair_blocked(uuid,uuid)','698fb21abb0379743bc7ab09d9f946ad'),
   ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad'),
   ('private.accounts_same_world(uuid,uuid)','16f541f952d4e1e2dbb4fc87e594d572'),
   ('private.account_visibility_world(uuid)','876cfc16f0ed1c4d32b128e8e18bdcda'),
   ('private.account_lineage(uuid)','c08602534ee5e0f0aa826db0913fde81'),
   ('private.agreement_cancellation_facts_v1(uuid)','65eec38f58d81667f14a046f3596a243')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature) where md5(p.prosrc) is distinct from x.body_md5),
 'completedCountMismatches',(select count(*) from public.app_profiles p where p.kind='WORKER'
    and (private.work_trust_counts_v1(p.id)->>'completed')::bigint is distinct from
        (select count(*) from public.agreements a where a.worker_profile_id=p.id and a.status='COMPLETED')),
 'workerProfilesWithReliability',(select count(*) from public.app_profiles p where p.kind='WORKER' and private.work_trust_counts_v1(p.id)->>'reliabilityPercent' is not null),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready()
) as profile_trust_postflight;
