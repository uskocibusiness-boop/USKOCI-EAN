-- PROFILE-TRUST read-only preflight for canonical DEV leqcwgzvjsxugfgzdmth (after CANCEL-INFO). No write. Expected: every flag true,
-- the drift lists empty, agreementWorkerProfileOfAnotherAccount 0.
select jsonb_build_object(
 'ledger',(select count(*) from supabase_migrations.schema_migrations),
 'latestVersion',(select max(version) from supabase_migrations.schema_migrations),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5(),
 'closureNotExecuting',not exists(select 1 from private.closure_executions_v5 where state='EXECUTING'),
 'cancelInfoApplied',(select md5(prosrc) from pg_proc where oid=to_regprocedure('private.agreement_cancellation_facts_v1(uuid)')) is not distinct from '65eec38f58d81667f14a046f3596a243',
 'dependencyDrift',(select coalesce(jsonb_agg(x.signature order by x.signature),'[]'::jsonb) from (values
   ('public.rpc_get_public_profile(uuid)','9ecc0b69096f1167d02e0bb7b9656bc0'),
   ('private.safety_pair_blocked(uuid,uuid)','698fb21abb0379743bc7ab09d9f946ad'),
   ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad'),
   ('private.accounts_same_world(uuid,uuid)','16f541f952d4e1e2dbb4fc87e594d572'),
   ('private.account_visibility_world(uuid)','876cfc16f0ed1c4d32b128e8e18bdcda'),
   ('private.account_lineage(uuid)','c08602534ee5e0f0aa826db0913fde81')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature) where md5(p.prosrc) is distinct from x.body_md5),
 'readShapesAsExpected',(select count(*) from pg_attribute a where a.attrelid=to_regclass('private.agreement_review_comments_v1') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('review_id','uuid'),('author_account_id','uuid'),('target_account_id','uuid'),('comment','text'),('hidden_at','timestamp with time zone')))=5
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('private.agreement_reviews') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('id','uuid'),('agreement_id','uuid'),('reviewer_account_id','uuid'),('target_account_id','uuid'),('rating','integer'),('tags','text[]'),('created_at','timestamp with time zone')))=7
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('private.account_blocks') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('blocker_account_id','uuid'),('blocked_account_id','uuid'),('active','boolean')))=3
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('public.app_profiles') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('id','uuid'),('account_id','uuid'),('kind','text'),('profile_status','text'),('display_name','text'),('avatar_path','text'),('created_at','timestamp with time zone')))=7
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('public.agreements') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('id','uuid'),('need_id','uuid'),('status','text'),('requester_account_id','uuid'),('requester_profile_id','uuid'),('worker_account_id','uuid'),('worker_profile_id','uuid')))=7
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('public.marketplace_responses') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('worker_account_id','uuid'),('worker_profile_id','uuid'),('status','text')))=3
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('public.needs') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('id','uuid'),('title','text')))=2
   and (select count(*) from pg_attribute a where a.attrelid=to_regclass('private.marketplace_config') and a.attnum>0 and not a.attisdropped
     and (a.attname::text,format_type(a.atttypid,a.atttypmod)) in (('key','text'),('value','jsonb'),('updated_at','timestamp with time zone')))=3,
 'newFunctionsAndRowsAbsent',not exists(select 1 from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace)
                 and p.proname in ('profile_trust_visibility_v1','received_reviews_detail_v1','work_trust_counts_v1','rpc_public_work_trust_v1','rpc_my_work_stats_v1','rpc_list_received_reviews_v1'))
  and not exists(select 1 from private.marketplace_config where key in ('profile_trust_visibility','received_reviews_detail')),
 'agreementWorkerProfileOfAnotherAccount',(select count(*) from public.agreements a join public.app_profiles p on p.id=a.worker_profile_id where p.account_id<>a.worker_account_id),
 'activeWorkerProfiles',(select count(*) from public.app_profiles where kind='WORKER' and profile_status='ACTIVE'),
 'agreementsByStatus',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.agreements group by status) s),
 'reviews',(select count(*) from private.agreement_reviews),
 'comments',(select count(*) from private.agreement_review_comments_v1)
) as profile_trust_preflight;
