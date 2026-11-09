-- REVIEWED SCOPE ONLY: Uskoci Test account 9d34d27a-f947-4e0f-9442-b7d192a9b468.
-- Changes existing owned published task/profile visibility REAL -> TEST.
-- Does not create users, tasks, applications, Agreements, capabilities or notifications.
-- Run only after the coordinating agent confirms the existing owner authorization covers this correction.
-- Close/idle both app sessions during this short operation. Execute this whole batch atomically.
-- A serialization/preimage conflict aborts: inspect fresh state; do not blindly retry/rebase fingerprints.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
DO $lineage_correction$
DECLARE
  v_state jsonb;
  v_receipt jsonb;
BEGIN
  -- Same admission-writer lock serializes competing lineage admissions for this account.
  PERFORM pg_advisory_xact_lock(hashtextextended('uskoci:account-lineage:9d34d27a-f947-4e0f-9442-b7d192a9b468',150));
  SELECT state INTO v_state FROM (
with a(id) as(values('9d34d27a-f947-4e0f-9442-b7d192a9b468'::uuid)),
own_needs as(select n.* from public.needs n,a where n.requester_account_id=a.id),
owned_profiles as(select p.* from public.app_profiles p,a where p.account_id=a.id)
select jsonb_build_object(
 'lineage',private.account_lineage(a.id),
 'lineageRevision',coalesce((select revision from private.account_lineage_v5 where account_id=a.id),0),
 'lineageEvents',(select count(*) from private.account_lineage_events_v5 where account_id=a.id),
 'world',private.account_visibility_world(a.id),
 'peerLineage',private.account_lineage('0640a1bd-5e0a-4462-9dca-f49420582c8a'),
 'peerWorld',private.account_visibility_world('0640a1bd-5e0a-4462-9dca-f49420582c8a'),
 'sameWorld',private.accounts_same_world(a.id,'0640a1bd-5e0a-4462-9dca-f49420582c8a'),
 'ownNeeds',(select count(*) from own_needs),
 'publishedNeeds',(select count(*) from own_needs where status='PUBLISHED'),
 'publishedNeedPresent',exists(select 1 from own_needs where id='bf62b479-f1d0-4d45-89a5-f849f2daa2b9' and status='PUBLISHED'),
 'activeWorkerPresent',exists(select 1 from owned_profiles where id='b235b667-e570-4dc8-a120-097cded5b6d8' and kind='WORKER' and profile_status='ACTIVE'),
 'needsHash',(select md5(coalesce(jsonb_agg(to_jsonb(n) order by n.id),'[]'::jsonb)::text) from own_needs n),
 'profilesHash',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb)::text) from owned_profiles p),
 'capabilitiesHash',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.category_id),'[]'::jsonb)::text) from private.work_taxonomy_worker_capabilities c where c.worker_account_id=a.id),
 'confirmedModesHash',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.category_id,c.execution_scope),'[]'::jsonb)::text) from private.taxonomy_confirmed_worker_modes_v1 c where c.worker_account_id=a.id),
 'needBindingsHash',(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.request_key),'[]'::jsonb)::text) from private.work_taxonomy_need_bindings_v1 b where b.owner_account_id=a.id),
 'workerBindingsHash',(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.request_key),'[]'::jsonb)::text) from private.work_taxonomy_worker_bindings_v1 b where b.owner_account_id=a.id),
 'savedAreasHash',md5(private.worker_saved_areas_v1(a.id)::text),
 'aiTestAdmissionHash',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.account_id),'[]'::jsonb)::text) from private.ai_test_accounts_v5 t where t.account_id=a.id),
 'interactionCount',
 (select count(*) from public.agreements x where a.id in(x.requester_account_id,x.worker_account_id))+
 (select count(*) from public.marketplace_responses x where x.worker_account_id=a.id or x.need_id in(select id from own_needs))+
 (select count(*) from public.need_selections x where x.need_id in(select id from own_needs))+
 (select count(*) from private.preselection_qa_questions x where x.asker_account_id=a.id or x.need_id in(select id from own_needs))+
 (select count(*) from private.agreement_reviews x where a.id in(x.reviewer_account_id,x.target_account_id))+
 (select count(*) from private.agreement_review_comments_v1 x where a.id in(x.author_account_id,x.target_account_id))+
 (select count(*) from private.account_blocks x where a.id in(x.blocker_account_id,x.blocked_account_id))+
 (select count(*) from public.access_grants x where a.id in(x.granted_by_account_id,x.granted_to_account_id))+
 (select count(*) from public.agreement_messages x where x.sender_account_id=a.id)+
 (select count(*) from private.group_messages_v5 x where x.sender_account_id=a.id)+
 (select count(*) from public.opportunity_deliveries x where x.worker_account_id=a.id or x.need_id in(select id from own_needs))+
 (select count(*) from public.user_activity_events e where (e.recipient_user_id=a.id and e.event_type='OPPORTUNITY_AVAILABLE') or e.entity_id in(select id from own_needs)),
 'guardFunctionsHash',(select md5(jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,'body',md5(p.prosrc),'owner',p.proowner::regrole::text,'acl',p.proacl::text) order by n.nspname,p.proname)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','rls_private') and p.proname in('rpc_admit_account_lineage_service','account_lineage','account_visibility_world','accounts_same_world','viewer_same_world','account_is_non_production','p6_discovery_test_world_accounts','worker_need_fit_v1','rpc_begin_push_send')),
 'needDiscoveryPolicyHash',(select md5(coalesce(jsonb_agg(to_jsonb(pol) order by pol.policyname),'[]'::jsonb)::text) from pg_policies pol where pol.schemaname='public' and pol.tablename='needs'),
 'writerServiceOnly',has_function_privilege('service_role','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
 and not has_function_privilege('anon','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
) as state from a
  ) observed;
  IF v_state IS DISTINCT FROM '{"world":"REAL","lineage":"UNCLASSIFIED","ownNeeds":2,"needsHash":"bb1725a54fda8c2963e6dca9292d45a4","peerWorld":"TEST","sameWorld":false,"peerLineage":"OWNER_BUSINESS","profilesHash":"69088027b3b4d206bc035e1609e58c21","lineageEvents":0,"publishedNeeds":1,"savedAreasHash":"76929e5262fbae48dee918fc12b37937","lineageRevision":0,"capabilitiesHash":"fac4284ca4d9d443252cd7dc0612c09e","interactionCount":0,"needBindingsHash":"2e76fa0cc76fa758ff4a96ce2eb2a8ae","writerServiceOnly":true,"confirmedModesHash":"c61b721cee7db3dd55d457e7979895e9","guardFunctionsHash":"903d86aa0a00da91dc0a15aaf54284d6","workerBindingsHash":"064f25f8f220cc2f5bffe1f0b5ddf0e4","activeWorkerPresent":true,"aiTestAdmissionHash":"e50a800ef99f91e23e503c3ae1abfb01","publishedNeedPresent":true,"needDiscoveryPolicyHash":"a6d682f65a5165cafb4d9876d605f027"}'::jsonb THEN
    RAISE EXCEPTION 'ACCOUNT_LINEAGE_PREIMAGE_MISMATCH';
  END IF;
  v_receipt := public.rpc_admit_account_lineage_service(
    '9d34d27a-f947-4e0f-9442-b7d192a9b468'::uuid,
    'DEV_ACCEPTANCE_QA',
    'Owner-designated DEV test account; existing AI test admission; zero marketplace relationships before correction.',
    'owner-dev-test-account-correction-20261109',
    0
  );
  IF v_receipt->>'accountId' IS DISTINCT FROM '9d34d27a-f947-4e0f-9442-b7d192a9b468'
     OR v_receipt->>'lineage' IS DISTINCT FROM 'DEV_ACCEPTANCE_QA'
     OR v_receipt->>'revision' IS DISTINCT FROM '1'
     OR v_receipt->>'changed' IS DISTINCT FROM 'true'
     OR v_receipt->>'authoritative' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'ACCOUNT_LINEAGE_RECEIPT_INVALID';
  END IF;
  SELECT state INTO v_state FROM (
with a(id) as(values('9d34d27a-f947-4e0f-9442-b7d192a9b468'::uuid)),
own_needs as(select n.* from public.needs n,a where n.requester_account_id=a.id),
owned_profiles as(select p.* from public.app_profiles p,a where p.account_id=a.id)
select jsonb_build_object(
 'lineage',private.account_lineage(a.id),
 'lineageRevision',coalesce((select revision from private.account_lineage_v5 where account_id=a.id),0),
 'lineageEvents',(select count(*) from private.account_lineage_events_v5 where account_id=a.id),
 'world',private.account_visibility_world(a.id),
 'peerLineage',private.account_lineage('0640a1bd-5e0a-4462-9dca-f49420582c8a'),
 'peerWorld',private.account_visibility_world('0640a1bd-5e0a-4462-9dca-f49420582c8a'),
 'sameWorld',private.accounts_same_world(a.id,'0640a1bd-5e0a-4462-9dca-f49420582c8a'),
 'ownNeeds',(select count(*) from own_needs),
 'publishedNeeds',(select count(*) from own_needs where status='PUBLISHED'),
 'publishedNeedPresent',exists(select 1 from own_needs where id='bf62b479-f1d0-4d45-89a5-f849f2daa2b9' and status='PUBLISHED'),
 'activeWorkerPresent',exists(select 1 from owned_profiles where id='b235b667-e570-4dc8-a120-097cded5b6d8' and kind='WORKER' and profile_status='ACTIVE'),
 'needsHash',(select md5(coalesce(jsonb_agg(to_jsonb(n) order by n.id),'[]'::jsonb)::text) from own_needs n),
 'profilesHash',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb)::text) from owned_profiles p),
 'capabilitiesHash',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.category_id),'[]'::jsonb)::text) from private.work_taxonomy_worker_capabilities c where c.worker_account_id=a.id),
 'confirmedModesHash',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.category_id,c.execution_scope),'[]'::jsonb)::text) from private.taxonomy_confirmed_worker_modes_v1 c where c.worker_account_id=a.id),
 'needBindingsHash',(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.request_key),'[]'::jsonb)::text) from private.work_taxonomy_need_bindings_v1 b where b.owner_account_id=a.id),
 'workerBindingsHash',(select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.request_key),'[]'::jsonb)::text) from private.work_taxonomy_worker_bindings_v1 b where b.owner_account_id=a.id),
 'savedAreasHash',md5(private.worker_saved_areas_v1(a.id)::text),
 'aiTestAdmissionHash',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.account_id),'[]'::jsonb)::text) from private.ai_test_accounts_v5 t where t.account_id=a.id),
 'interactionCount',
 (select count(*) from public.agreements x where a.id in(x.requester_account_id,x.worker_account_id))+
 (select count(*) from public.marketplace_responses x where x.worker_account_id=a.id or x.need_id in(select id from own_needs))+
 (select count(*) from public.need_selections x where x.need_id in(select id from own_needs))+
 (select count(*) from private.preselection_qa_questions x where x.asker_account_id=a.id or x.need_id in(select id from own_needs))+
 (select count(*) from private.agreement_reviews x where a.id in(x.reviewer_account_id,x.target_account_id))+
 (select count(*) from private.agreement_review_comments_v1 x where a.id in(x.author_account_id,x.target_account_id))+
 (select count(*) from private.account_blocks x where a.id in(x.blocker_account_id,x.blocked_account_id))+
 (select count(*) from public.access_grants x where a.id in(x.granted_by_account_id,x.granted_to_account_id))+
 (select count(*) from public.agreement_messages x where x.sender_account_id=a.id)+
 (select count(*) from private.group_messages_v5 x where x.sender_account_id=a.id)+
 (select count(*) from public.opportunity_deliveries x where x.worker_account_id=a.id or x.need_id in(select id from own_needs))+
 (select count(*) from public.user_activity_events e where (e.recipient_user_id=a.id and e.event_type='OPPORTUNITY_AVAILABLE') or e.entity_id in(select id from own_needs)),
 'guardFunctionsHash',(select md5(jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,'body',md5(p.prosrc),'owner',p.proowner::regrole::text,'acl',p.proacl::text) order by n.nspname,p.proname)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','rls_private') and p.proname in('rpc_admit_account_lineage_service','account_lineage','account_visibility_world','accounts_same_world','viewer_same_world','account_is_non_production','p6_discovery_test_world_accounts','worker_need_fit_v1','rpc_begin_push_send')),
 'needDiscoveryPolicyHash',(select md5(coalesce(jsonb_agg(to_jsonb(pol) order by pol.policyname),'[]'::jsonb)::text) from pg_policies pol where pol.schemaname='public' and pol.tablename='needs'),
 'writerServiceOnly',has_function_privilege('service_role','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
 and not has_function_privilege('anon','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
) as state from a
  ) observed;
  IF v_state IS DISTINCT FROM '{"world":"TEST","lineage":"DEV_ACCEPTANCE_QA","ownNeeds":2,"needsHash":"bb1725a54fda8c2963e6dca9292d45a4","peerWorld":"TEST","sameWorld":true,"peerLineage":"OWNER_BUSINESS","profilesHash":"69088027b3b4d206bc035e1609e58c21","lineageEvents":1,"publishedNeeds":1,"savedAreasHash":"76929e5262fbae48dee918fc12b37937","lineageRevision":1,"capabilitiesHash":"fac4284ca4d9d443252cd7dc0612c09e","interactionCount":0,"needBindingsHash":"2e76fa0cc76fa758ff4a96ce2eb2a8ae","writerServiceOnly":true,"confirmedModesHash":"c61b721cee7db3dd55d457e7979895e9","guardFunctionsHash":"903d86aa0a00da91dc0a15aaf54284d6","workerBindingsHash":"064f25f8f220cc2f5bffe1f0b5ddf0e4","activeWorkerPresent":true,"aiTestAdmissionHash":"e50a800ef99f91e23e503c3ae1abfb01","publishedNeedPresent":true,"needDiscoveryPolicyHash":"a6d682f65a5165cafb4d9876d605f027"}'::jsonb THEN
    RAISE EXCEPTION 'ACCOUNT_LINEAGE_POSTIMAGE_MISMATCH';
  END IF;
  RAISE NOTICE 'ACCOUNT_LINEAGE_POSTIMAGE_MATCH: account %, revision 1, TEST', v_receipt->>'accountId';
END;
$lineage_correction$;
COMMIT;

