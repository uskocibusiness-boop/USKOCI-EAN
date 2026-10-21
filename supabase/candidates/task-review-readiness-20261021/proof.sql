do $proof$
declare u uuid:=extensions.gen_random_uuid();pid uuid;n uuid;c uuid;r jsonb;rr jsonb;
 auth_role text:=current_user;fn text;fid uuid;
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

 c:=(public.rpc_ai_open_need_edit_conversation_v2(n)->>'conversationId')::uuid;
 foreach fn in array array['rpc_prepare_ai_task_review','rpc_prepare_ai_task_review_taxonomy'] loop
  begin
   -- Synthetic missing handoff, preserving the actual read/prepare path.
   update public.ai_structured_facts set superseded_at=clock_timestamp()
    where conversation_id=c and fact_key='need.handoff' and superseded_at is null;
   execute 'set local role authenticated';
   execute format('select public.%I($1,null,null)',fn) into r using c;
   if r->'canAccept' is distinct from 'false'::jsonb or not(r->'missingRequired' @> '["need.handoff"]')
    then raise exception 'TRV01_HANDOFF:%',fn;end if;
   execute format('set local role %I',auth_role);
   if not exists(select 1 from private.ai_task_reviews v where v.id=(r->>'reviewId')::uuid
    and r->>'displayedContentDigest'=encode(extensions.digest(jsonb_build_object('envelope',r-'displayedContentDigest','policy',v.policy_binding)::text,'sha256'),'hex'))
    then raise exception 'TRV01_UNSIGNED:%',fn;end if;
   raise sqlstate 'ZV001';
  exception when sqlstate 'ZV001' then null;end;
  begin
   select id into fid from public.ai_structured_facts where conversation_id=c and fact_key='need.price_mode' and superseded_at is null;
   perform public.rpc_ai_correct_fact_v2(fid,'"MY_PRICE"','Fiksna cena');
   execute 'set local role authenticated';
   execute format('select public.%I($1,null,null)',fn) into r using c;
   if r->'canAccept' is distinct from 'false'::jsonb or not(r->'missingRequired' @> '["need.price_rsd"]')
    then raise exception 'TRV01_PRICE:%',fn;end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZV001';
  exception when sqlstate 'ZV001' then null;end;
  begin
   select id into fid from public.ai_structured_facts where conversation_id=c and fact_key='need.schedule_kind' and superseded_at is null;
   perform public.rpc_ai_correct_fact_v2(fid,'"FIXED_WINDOW"','Tačan termin');
   execute 'set local role authenticated';
   execute format('select public.%I($1,null,null)',fn) into r using c;
   if r->'canAccept' is distinct from 'false'::jsonb or not(r->'missingRequired' @> '["need.starts_at"]')
    then raise exception 'TRV01_START:%',fn;end if;
   execute format('set local role %I',auth_role);
   raise sqlstate 'ZV001';
  exception when sqlstate 'ZV001' then null;end;
 end loop;
 execute 'set local role authenticated';
 r:=public.rpc_prepare_ai_task_review(c,null,null);
 rr:=public.rpc_prepare_ai_task_review(c,null,null);
 if r->'canAccept' is distinct from 'true'::jsonb or r->'missingRequired'<>'[]'::jsonb or r is distinct from rr
 then raise exception 'TRV01_VALID_REPLAY';end if;
 execute format('set local role %I',auth_role);
 raise sqlstate 'ZV002';
 exception when sqlstate 'ZV002' then null;end;
 if exists(select 1 from auth.users where id=u) then raise exception 'TRV01_FIXTURE_LEAK';end if;
end $proof$;
commit;
