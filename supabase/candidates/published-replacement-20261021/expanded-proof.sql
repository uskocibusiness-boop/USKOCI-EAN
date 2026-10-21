-- PED02 migration gate. Synthetic accounts/source, real review/edit/publication RPCs.
-- Intentional subtransaction rollback removes ALL fixtures, including service decisions.
do $proof$
declare u uuid:=extensions.gen_random_uuid(); pid uuid; n uuid; c uuid; target uuid; c2 uuid;
 review jsonb; refreshed jsonb; cmd jsonb; corrected jsonb; ctx jsonb; dec jsonb; published jsonb;
 worker uuid:=extensions.gen_random_uuid(); wid uuid; response_id uuid:=extensions.gen_random_uuid(); no_op jsonb;
 key uuid:=extensions.gen_random_uuid(); before_row jsonb; after_row jsonb; rev integer;
begin
 begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(u,'authenticated','authenticated','ped02-'||u||'@proof.invalid',now(),now());
  select id into strict pid from public.app_profiles where account_id=u and kind='REQUESTER';
  update public.app_profiles set display_name='PED02 proba',city='Novi Sad' where id=pid;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,mode,required_slots,schedule_kind,execution_location_mode,task_country_code,task_timezone,revision,published_at,response_deadline)
  values(u,pid,'PUBLISHED','PED02 Dizajn logotipa','Potreban je novi logo za radionicu.','Dizajn logotipa','',
   'OFFERS',1,'FLEXIBLE','REMOTE','RS','Europe/Belgrade',1,now(),now()+interval '2 days') returning id into n;
  perform set_config('uskoci.need_lifecycle','',true);perform set_config('uskoci.need_region','',true);
  insert into public.need_geography(need_id,public_topology) values(n,'{"mode":"REMOTE"}');
  insert into public.need_requirement_details(need_id,critical_conditions,handoff) values(n,'{}','{"required":false}');
  select to_jsonb(t) into before_row from public.needs t where id=n;
  insert into auth.users(id,aud,role,email,created_at,updated_at)
   values(worker,'authenticated','authenticated','ped02-worker-'||worker||'@proof.invalid',now(),now());
  select id into strict wid from public.app_profiles where account_id=worker and kind='WORKER';
  perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
  perform set_config('uskoci.profile_mutation','COMPLETE_WORKER_PROFILE',true);
  update public.app_profiles set display_name='PED02 Worker',city='Novi Sad',skills=array['Dizajn'],profile_status='ACTIVE' where id=wid;
  perform set_config('uskoci.profile_mutation','',true);
  perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at)
   values(response_id,n,worker,wid,'OFFER','SUBMITTED',1,1,1,1000,now());
  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,content_hash)
   values(response_id,1,1,1,1000,repeat('b',64));
  c:=(public.rpc_ai_open_need_edit_conversation_v2(n)->>'conversationId')::uuid;
  no_op:=public.rpc_prepare_ai_task_review(c,null,null);
  begin
   perform public.rpc_accept_ai_task_review((no_op->>'reviewId')::uuid,no_op->>'displayedContentDigest',extensions.gen_random_uuid());
   raise exception 'PED02_NOOP_ALLOWED';
  exception when others then if sqlerrm<>'NO_MATERIAL_CHANGE' then raise;end if;end;
  if exists(select 1 from public.needs where id=(no_op#>>'{replacement,targetNeedId}')::uuid)
   or (select status from public.marketplace_responses where id=response_id)<>'SUBMITTED'
   then raise exception 'PED02_NOOP_MUTATION';end if;

  perform public.rpc_ai_correct_fact_v2((select id from public.ai_structured_facts where conversation_id=c and fact_key='need.title' and superseded_at is null),
   to_jsonb('PED02 Logo i vizitkarte'::text),'Logo i vizitkarte');
  review:=public.rpc_prepare_ai_task_review(c,null,null);
  if review#>>'{replacement,sourceNeedId}' is distinct from n::text or review#>>'{replacement,targetBaseRevision}'<>'0'
   then raise exception 'PED02_REVIEW_SOURCE';end if;
  refreshed:=public.rpc_prepare_ai_task_review(c,null,null);
  if refreshed->>'reviewId' is distinct from review->>'reviewId' then raise exception 'PED02_REFRESH_CHANGED_REVIEW';end if;
  cmd:=public.rpc_accept_ai_task_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',key);
  target:=(cmd->>'needId')::uuid;
  if target=n or target::text is distinct from review#>>'{replacement,targetNeedId}' or cmd->>'needRevision'<>'1' then raise exception 'PED02_TARGET';end if;
  select to_jsonb(t) into after_row from public.needs t where id=n;
  if before_row is distinct from after_row then raise exception 'PED02_SOURCE_CHANGED_BY_ACCEPT';end if;
  if public.rpc_accept_ai_task_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',key) is distinct from cmd
   then raise exception 'PED02_ACCEPT_REPLAY';end if;
  if (select bound_need_id from public.ai_conversations where id=c)<>n then raise exception 'PED02_SOURCE_CONVERSATION_REBOUND';end if;
  -- Reopening the candidate must retain provenance across correction/revision.
  c2:=(public.rpc_ai_open_need_edit_conversation_v2(target)->>'conversationId')::uuid;
  perform public.rpc_ai_correct_fact_v2((select id from public.ai_structured_facts where conversation_id=c2 and fact_key='need.description' and superseded_at is null),
   to_jsonb('Logo i vizitkarte za novu radionicu.'::text),'Logo i vizitkarte za novu radionicu.');
  corrected:=public.rpc_prepare_ai_task_review(c2,null,null);
  if corrected#>>'{replacement,sourceNeedId}'<>n::text or corrected#>>'{replacement,targetNeedId}'<>target::text
   or corrected#>>'{replacement,targetBaseRevision}'<>'1' then raise exception 'PED02_CORRECTION_LOST_ANCESTRY';end if;
  cmd:=public.rpc_accept_ai_task_review((corrected->>'reviewId')::uuid,corrected->>'displayedContentDigest',extensions.gen_random_uuid());
  rev:=(cmd->>'needRevision')::integer;
  if cmd->>'needId'<>target::text or rev<>2 then raise exception 'PED02_CORRECTION_TARGET';end if;
  if (select to_jsonb(t) from public.needs t where id=n) is distinct from before_row then raise exception 'PED02_SOURCE_CHANGED_BY_CORRECTION';end if;
  -- No valid decision: publication failure must leave source active.
  begin
   perform public.rpc_publish_need_canonical(target,rev,9223372036854775806,null,'ped02-no-decision-'||u);
   raise exception 'PED02_INVALID_DECISION_ALLOWED';
  exception when others then if sqlerrm='PED02_INVALID_DECISION_ALLOWED' then raise;end if;end;
  if (select to_jsonb(t) from public.needs t where id=n) is distinct from before_row then raise exception 'PED02_FAILED_PUBLISH_CHANGED_SOURCE';end if;
  ctx:=private.need_publication_context(target,rev,u);
  if ctx->>'kind'<>'READY' then raise exception 'PED02_CONTEXT_NOT_READY: %',ctx;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','service_role')::text,true);
  dec:=public.rpc_record_need_publication_decision_service(target,rev,'RS_PUBLICATION_POLICY_MINIMUM','RS','ALLOW',array['RS-MIN-001'],
   'PUBLICATION_EVALUATOR_V1',array['CLEAR_CONCRETE_TASK'],'PED02_SQL_PROOF','NO_PROVIDER_CALLED','{}',jsonb_build_object('evaluationContext',ctx->'binding'));
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  -- Source cancellation races with replacement: stale source is never revived.
  begin
   perform public.rpc_cancel_need(n,1,'PED02 rollback race');
   begin
    perform public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-stale-'||u);
    raise exception 'PED02_STALE_SOURCE_ALLOWED';
   exception when others then if sqlerrm<>'REPLACEMENT_SOURCE_STALE' then raise;end if;end;
   raise sqlstate 'ZP003';
  exception when sqlstate 'ZP003' then null;end;
  -- A real owner selection after review locks replacement; rollback restores fixture.
  begin
   perform public.rpc_select_response(n,1,response_id,1,repeat('b',64),'ped02-select-'||u);
   begin
    perform public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-selected-'||u);
    raise exception 'PED02_SELECTED_SOURCE_ALLOWED';
   exception when others then if sqlerrm<>'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' then raise;end if;end;
   raise sqlstate 'ZP003';
  exception when sqlstate 'ZP003' then null;end;
  published:=public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-publish-'||u);
  if published->>'status'<>'PUBLISHED' or (select status from public.needs where id=n)<>'CANCELLED'
   or (select status from public.needs where id=target)<>'PUBLISHED' then raise exception 'PED02_ATOMIC_SWAP';end if;
  if public.rpc_publish_need_canonical(target,rev,(dec->>'decisionSequence')::bigint,null,'ped02-publish-'||u)->>'idempotentReplay'<>'true'
   then raise exception 'PED02_PUBLISH_REPLAY';end if;
  if (select status from public.marketplace_responses where id=response_id)<>'EXPIRED'
   or exists(select 1 from public.marketplace_responses where need_id=target)
   or (select count(*) from public.user_activity_events where entity_id=n and recipient_user_id=worker and event_type='NEED_CANCELLED')<>1
   then raise exception 'PED02_APPLICANT_CLOSURE';end if;
  raise sqlstate 'ZP002';
 exception when sqlstate 'ZP002' then null;end;
 if exists(select 1 from auth.users where id=u) then raise exception 'PED02_FIXTURE_LEAK';end if;
end $proof$;
