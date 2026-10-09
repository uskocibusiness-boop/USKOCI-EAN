begin;set local statement_timeout='90s';create temporary table people_rpc_obs(k text,v jsonb) on commit drop;grant all on people_rpc_obs to authenticated;set local session_replication_role=replica;insert into auth.users(id)values('3be09387-df17-47ba-a4cc-8e19b8aba49f');insert into public.app_accounts(id,email)values('3be09387-df17-47ba-a4cc-8e19b8aba49f','3be09387-df17-47ba-a4cc-8e19b8aba49f@proof.invalid');insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values('c8295fc6-07a9-4f83-adb7-666f1724440f','3be09387-df17-47ba-a4cc-8e19b8aba49f','REQUESTER','Local proof','Novi Sad','ACTIVE','{}',1,false),('15c39755-332d-4e89-8602-5f80e2f5f406','3be09387-df17-47ba-a4cc-8e19b8aba49f','WORKER','Local proof','Novi Sad','ACTIVE','{ciscenje}',1,true);insert into auth.users(id)values('37ee47f0-7fd0-46ee-bbca-01c7bf385069');insert into public.app_accounts(id,email)values('37ee47f0-7fd0-46ee-bbca-01c7bf385069','37ee47f0-7fd0-46ee-bbca-01c7bf385069@proof.invalid');insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values('f403b290-a5f8-4fb6-91e4-44e89d4834b2','37ee47f0-7fd0-46ee-bbca-01c7bf385069','REQUESTER','Local proof','Novi Sad','ACTIVE','{}',1,false),('d1f2fca8-bd92-4163-b050-ff4c8a53236b','37ee47f0-7fd0-46ee-bbca-01c7bf385069','WORKER','Local proof','Novi Sad','ACTIVE','{ciscenje}',1,true);insert into auth.users(id)values('96873b8b-e50e-41df-b2b7-7ffd2256c0c4');insert into public.app_accounts(id,email)values('96873b8b-e50e-41df-b2b7-7ffd2256c0c4','96873b8b-e50e-41df-b2b7-7ffd2256c0c4@proof.invalid');insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values('21eb3f07-7bf2-4e97-9f5b-53a222652d37','96873b8b-e50e-41df-b2b7-7ffd2256c0c4','REQUESTER','Local proof','Novi Sad','ACTIVE','{}',1,false),('8473a6f4-4ca6-4595-9d00-2bdeeee296f0','96873b8b-e50e-41df-b2b7-7ffd2256c0c4','WORKER','Local proof','Novi Sad','ACTIVE','{ciscenje}',1,true);insert into auth.users(id)values('04edab84-b3fe-465b-a1f5-df89e996b5ea');insert into public.app_accounts(id,email)values('04edab84-b3fe-465b-a1f5-df89e996b5ea','04edab84-b3fe-465b-a1f5-df89e996b5ea@proof.invalid');insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values('29d80f05-3bb7-4313-92ed-476e74805728','04edab84-b3fe-465b-a1f5-df89e996b5ea','REQUESTER','Local proof','Novi Sad','ACTIVE','{}',1,false),('ba77111c-295b-4f1c-a808-6b0bff81717d','04edab84-b3fe-465b-a1f5-df89e996b5ea','WORKER','Local proof','Novi Sad','ACTIVE','{ciscenje}',1,true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline)values('a303a708-2d67-43bc-8898-5b9ecc014ee3','3be09387-df17-47ba-a4cc-8e19b8aba49f','c8295fc6-07a9-4f83-adb7-666f1724440f','PUBLISHED','People local proof','Disposable fixture','PROOF','{}','Novi Sad','Liman','MY_PRICE',3,'FLEXIBLE',statement_timestamp()-interval '1 hour','Europe/Belgrade',1,9000,'TOTAL',statement_timestamp()+interval '2 hours');insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline)values('c44f2b67-51d4-4704-b88d-d40f58dc1ad7','3be09387-df17-47ba-a4cc-8e19b8aba49f','c8295fc6-07a9-4f83-adb7-666f1724440f','PUBLISHED','People local proof','Disposable fixture','PROOF','{}','Novi Sad','Liman','MY_PRICE',3,'FLEXIBLE',statement_timestamp()-interval '1 hour','Europe/Belgrade',1,9000,'TOTAL',statement_timestamp()+interval '2 hours');insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline)values('6656f405-b3ec-451e-978f-844aa9509087','3be09387-df17-47ba-a4cc-8e19b8aba49f','c8295fc6-07a9-4f83-adb7-666f1724440f','PUBLISHED','People local proof','Disposable fixture','PROOF','{}','Novi Sad','Liman','MY_PRICE',3,'FLEXIBLE',statement_timestamp()-interval '1 hour','Europe/Belgrade',1,9000,'TOTAL',statement_timestamp()+interval '2 hours');insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline)values('c50afde3-bd29-41d7-b0f6-acdf414e8d0e','3be09387-df17-47ba-a4cc-8e19b8aba49f','c8295fc6-07a9-4f83-adb7-666f1724440f','PUBLISHED','People local proof','Disposable fixture','PROOF','{}','Novi Sad','Liman','MY_PRICE',3,'FLEXIBLE',statement_timestamp()-interval '1 hour','Europe/Belgrade',1,10000,'TOTAL',statement_timestamp()+interval '2 hours');update public.needs set revision=2 where id='c44f2b67-51d4-4704-b88d-d40f58dc1ad7';insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note) values('8f6a1b59-eb67-42cb-837b-93a0e1141851','c44f2b67-51d4-4704-b88d-d40f58dc1ad7','04edab84-b3fe-465b-a1f5-df89e996b5ea','ba77111c-295b-4f1c-a808-6b0bff81717d','OFFER','STALE_REVIEW_REQUIRED',1,1,9000,3,'Old full-team offer');insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)values('8f6a1b59-eb67-42cb-837b-93a0e1141851',1,1,9000,3,'Old full-team offer',repeat('a',64));update public.needs set revision=2 where id='6656f405-b3ec-451e-978f-844aa9509087';insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note) values('10d22fa7-9da9-41c4-b93c-3563f409a270','6656f405-b3ec-451e-978f-844aa9509087','04edab84-b3fe-465b-a1f5-df89e996b5ea','ba77111c-295b-4f1c-a808-6b0bff81717d','OFFER','STALE_REVIEW_REQUIRED',1,1,9000,3,'Old full-team offer');insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)values('10d22fa7-9da9-41c4-b93c-3563f409a270',1,1,9000,3,'Old full-team offer',repeat('a',64));set local session_replication_role=origin;set local role authenticated;do $rpc$ declare a jsonb;b jsonb;c jsonb;replayed jsonb;g uuid;g2 uuid;begin
 perform set_config('request.jwt.claim.sub','04edab84-b3fe-465b-a1f5-df89e996b5ea',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "04edab84-b3fe-465b-a1f5-df89e996b5ea", "role": "authenticated"}',true);
 perform public.rpc_resolve_stale_response_after_need_edit('8f6a1b59-eb67-42cb-837b-93a0e1141851',1,2,'stale-update','UPDATE',1,3000,null,null,'Local changed headcount');
 perform public.rpc_resolve_stale_response_after_need_edit('10d22fa7-9da9-41c4-b93c-3563f409a270',1,2,'stale-keep','KEEP',null,null,null,null,null);
 perform set_config('request.jwt.claim.sub','37ee47f0-7fd0-46ee-bbca-01c7bf385069',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "37ee47f0-7fd0-46ee-bbca-01c7bf385069", "role": "authenticated"}',true);
 begin perform public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',0,3000,null,null,'Local proof','bad-zero');raise exception 'ZERO_PEOPLE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'INVALID_COVERED_SLOTS' then raise;end if;end;
 begin perform public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',4,12000,null,null,'Local proof','bad-four');raise exception 'TOO_MANY_PEOPLE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'NEED_REMAINING_CAPACITY_EXCEEDED' then raise;end if;end;
 begin perform public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',1,9000,null,null,'Local proof','bad-price');raise exception 'WRONG_PRICE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'FIXED_PRICE_MISMATCH' then raise;end if;end;
 a:=public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',1,3000,null,null,'Local proof','part-one');
 replayed:=public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',1,3000,null,null,'Local proof','part-one');
 if replayed->>'responseId' is distinct from a->>'responseId' or replayed->>'idempotentReplay' is distinct from 'true' then raise exception 'REPLAY_DRIFT';end if;
 begin perform public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',2,6000,null,null,'Local proof','part-one');raise exception 'CHANGED_REPLAY_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','04edab84-b3fe-465b-a1f5-df89e996b5ea',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "04edab84-b3fe-465b-a1f5-df89e996b5ea", "role": "authenticated"}',true); c:=public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'ba77111c-295b-4f1c-a808-6b0bff81717d',3,9000,null,null,'Local proof','whole-team');
 perform set_config('request.jwt.claim.sub','3be09387-df17-47ba-a4cc-8e19b8aba49f',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "3be09387-df17-47ba-a4cc-8e19b8aba49f", "role": "authenticated"}',true); g:=public.rpc_select_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,(a->>'responseId')::uuid,(a->>'version')::integer,a->>'contentHash','choose-one');
 begin perform public.rpc_select_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,(c->>'responseId')::uuid,(c->>'version')::integer,c->>'contentHash','overfill-open');raise exception 'OVERFILL_ACCEPTED';exception when others then if sqlerrm<>'OVERFILL' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','96873b8b-e50e-41df-b2b7-7ffd2256c0c4',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "96873b8b-e50e-41df-b2b7-7ffd2256c0c4", "role": "authenticated"}',true); b:=public.rpc_submit_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,'8473a6f4-4ca6-4595-9d00-2bdeeee296f0',2,6000,null,null,'Local proof','remaining-two');
 perform set_config('request.jwt.claim.sub','3be09387-df17-47ba-a4cc-8e19b8aba49f',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "3be09387-df17-47ba-a4cc-8e19b8aba49f", "role": "authenticated"}',true); g2:=public.rpc_select_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,(b->>'responseId')::uuid,(b->>'version')::integer,b->>'contentHash','choose-two');
 begin perform public.rpc_select_response('a303a708-2d67-43bc-8898-5b9ecc014ee3',1,(c->>'responseId')::uuid,(c->>'version')::integer,c->>'contentHash','overfill');raise exception 'OVERFILL_ACCEPTED';exception when others then if sqlerrm not in ('OVERFILL','NEED_NOT_OPEN','NEED_FULL') then raise;end if;end;
 perform set_config('request.jwt.claim.sub','37ee47f0-7fd0-46ee-bbca-01c7bf385069',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "37ee47f0-7fd0-46ee-bbca-01c7bf385069", "role": "authenticated"}',true); a:=public.rpc_submit_response('c50afde3-bd29-41d7-b0f6-acdf414e8d0e',1,'d1f2fca8-bd92-4163-b050-ff4c8a53236b',1,3333,null,null,'Local proof','rounded-one');
 perform set_config('request.jwt.claim.sub','3be09387-df17-47ba-a4cc-8e19b8aba49f',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "3be09387-df17-47ba-a4cc-8e19b8aba49f", "role": "authenticated"}',true); g:=public.rpc_select_response('c50afde3-bd29-41d7-b0f6-acdf414e8d0e',1,(a->>'responseId')::uuid,(a->>'version')::integer,a->>'contentHash','rounded-choose-one');
 perform set_config('request.jwt.claim.sub','96873b8b-e50e-41df-b2b7-7ffd2256c0c4',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "96873b8b-e50e-41df-b2b7-7ffd2256c0c4", "role": "authenticated"}',true);
 begin perform public.rpc_submit_response('c50afde3-bd29-41d7-b0f6-acdf414e8d0e',1,'8473a6f4-4ca6-4595-9d00-2bdeeee296f0',2,6666,null,null,'Local proof','rounded-unit-first-wrong');raise exception 'ROUNDED_UNIT_FIRST_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'FIXED_PRICE_MISMATCH' then raise;end if;end;
 b:=public.rpc_submit_response('c50afde3-bd29-41d7-b0f6-acdf414e8d0e',1,'8473a6f4-4ca6-4595-9d00-2bdeeee296f0',2,6667,null,null,'Local proof','rounded-two');
 perform set_config('request.jwt.claim.sub','3be09387-df17-47ba-a4cc-8e19b8aba49f',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub": "3be09387-df17-47ba-a4cc-8e19b8aba49f", "role": "authenticated"}',true); g2:=public.rpc_select_response('c50afde3-bd29-41d7-b0f6-acdf414e8d0e',1,(b->>'responseId')::uuid,(b->>'version')::integer,b->>'contentHash','rounded-choose-two');
 if (select sum((v.terms->>'price_rsd')::integer) from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.need_id='c50afde3-bd29-41d7-b0f6-acdf414e8d0e') is distinct from 10000::bigint then raise exception 'ROUNDED_TERMS_DRIFT';end if;
 insert into people_rpc_obs values('rounded',jsonb_build_object('one',a,'two',b,'termsSum',10000));
 insert into people_rpc_obs values('ids',jsonb_build_object('a',a,'b',b,'g1',g,'g2',g2));
end $rpc$;
reset role;do $barrier$ begin begin execute '
-- Application proportional TOTAL price. Existing helper only; no stored business data changes.
set local lock_timeout=''5s'';
set local statement_timeout=''120s'';
set local search_path=pg_catalog;
lock table public.needs in access exclusive mode;
lock table public.marketplace_responses,public.marketplace_response_versions in share row exclusive mode;
do $admission$ begin if exists(select 1 from public.marketplace_response_versions v join public.marketplace_responses r on r.id=v.response_id join public.needs n on n.id=r.need_id where n.mode=''MY_PRICE'' and n.price_basis=''TOTAL'' and v.covered_slots<n.required_slots) then raise exception ''PEOPLE_PRICE_PARTIAL_ADMISSION_PREVENTS_REVERT'';end if;end $admission$;
do $pre$ begin
 if private.retention_ai_source_ready() is distinct from true
  or private.closure_source_digest_v5() is null or private.closure_erasure_program_digest_v5() is null
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
  or private.closure_erasure_binding_v5() is null
  or private.closure_erasure_binding_v5()->>''sourceSha256'' is distinct from private.closure_source_digest_v5()
 then raise exception ''PEOPLE_PRICE_CERTIFICATE_NOT_READY'';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'')) is distinct from ''66aab6df0d625e24e0073c27bfe2aa91'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''public.rpc_select_response(uuid,integer,uuid,integer,text,text)'')) is distinct from ''6a8fd871a60779bc438119b21a900dca'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: public.rpc_select_response(uuid,integer,uuid,integer,text,text)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)'')) is distinct from ''9634b0333c3bd5dab208286f04d8e556'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''private.need_candidate_states_v5(uuid)'')) is distinct from ''112ed258e838b2cae22b248ac94ebe7c'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''private.need_candidate_states_v5(uuid,uuid[])'')) is distinct from ''20092ecb2a781776ddb0ce9c46ba8aa5'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid,uuid[])''; end if;
end $pre$;
create temporary table people_price_before on commit drop as
 select private.closure_source_digest_v5() as source, private.closure_erasure_program_digest_v5() as program,
 private.closure_erasure_binding_v5() as binding,
 (select to_jsonb(c) from private.closure_source_v5 c where singleton) as source_cert,
 (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure_cert;
do $replace$
declare o oid; original text; definition text; meta jsonb; note text; replacement text := $body$
begin
  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode=''22023'', message=''INVALID_PRICE'';
  end if;

  if n.mode = ''MY_PRICE'' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode=''P0001'', message=''FIXED_PRICE_NOT_READY'';
    end if;
    -- pkg025b. A null basis is the rule this product has always had: the application''s price is
    -- the task''s price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode=''22023'', message=''FIXED_PRICE_MISMATCH'';
      end if;
    elsif n.price_basis = ''PER_PERSON'' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode=''22023'',
          message=''FIXED_PRICE_MISMATCH'',
          detail=format(''basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s'',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = ''TOTAL'' then
      -- The price of the whole task, so one application carries the whole task. No split, no
      -- rounding: owner''s decision of 2026-09-19. Hiring people separately is what PER_PERSON is for.
      if p_covered_slots <> n.required_slots then
        raise exception using
          errcode=''22023'',
          message=''TOTAL_PRICE_REQUIRES_ALL_SLOTS'',
          detail=format(''required=%s,covered=%s'', n.required_slots, p_covered_slots);
      end if;
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using
          errcode=''22023'',
          message=''FIXED_PRICE_MISMATCH'',
          detail=format(''basis=TOTAL,total=%s,sent=%s'', n.requester_price_rsd, p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode=''22023'', message=''UNKNOWN_PRICE_BASIS'';
    end if;
  end if;

end;
$body$;
begin
 o:=to_regprocedure(''private.assert_application_price_v5(public.needs,integer,integer)'');
 select prosrc,to_jsonb(p)-''prosrc'',obj_description(p.oid,''pg_proc'') into strict original,meta,note from pg_proc p where p.oid=o;
 if md5(original) is distinct from ''1f6cd7c39d5fc70d82cfa8653737246c'' then raise exception ''PEOPLE_PRICE_PREIMAGE_DRIFT'';end if;
 if md5(replacement) is distinct from ''bd7ef02925c03d99ff7fd549219214cb'' then raise exception ''PEOPLE_PRICE_PAYLOAD_DRIFT'';end if;
 definition:=pg_get_functiondef(o);
 if (length(definition)-length(replace(definition,original,'''')))<>length(original) then raise exception ''PEOPLE_PRICE_AMBIGUOUS_BODY'';end if;
 execute replace(definition,original,replacement);
 if (select md5(prosrc) from pg_proc where oid=o) is distinct from ''bd7ef02925c03d99ff7fd549219214cb''
   or (select to_jsonb(p)-''prosrc'' from pg_proc p where oid=o) is distinct from meta
   or obj_description(o,''pg_proc'') is distinct from note then raise exception ''PEOPLE_PRICE_METADATA_DRIFT'';end if;
end $replace$;
do $post$ begin
 if private.retention_ai_source_ready() is distinct from true
  or exists(select 1 from people_price_before b where b.source is distinct from private.closure_source_digest_v5()
    or b.program is distinct from private.closure_erasure_program_digest_v5()
    or b.binding is distinct from private.closure_erasure_binding_v5()
    or b.source_cert is distinct from (select to_jsonb(c) from private.closure_source_v5 c where singleton)
    or b.erasure_cert is distinct from (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)) then raise exception ''PEOPLE_PRICE_CERTIFICATE_CHANGED'';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'')) is distinct from ''66aab6df0d625e24e0073c27bfe2aa91'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''public.rpc_select_response(uuid,integer,uuid,integer,text,text)'')) is distinct from ''6a8fd871a60779bc438119b21a900dca'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: public.rpc_select_response(uuid,integer,uuid,integer,text,text)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)'')) is distinct from ''9634b0333c3bd5dab208286f04d8e556'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''private.need_candidate_states_v5(uuid)'')) is distinct from ''112ed258e838b2cae22b248ac94ebe7c'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid)''; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure(''private.need_candidate_states_v5(uuid,uuid[])'')) is distinct from ''20092ecb2a781776ddb0ce9c46ba8aa5'' then raise exception ''PEOPLE_PRICE_CALLER_DRIFT: private.need_candidate_states_v5(uuid,uuid[])''; end if;
end $post$;
';raise exception 'REVERT_WAS_ALLOWED_AFTER_PARTIAL';exception when others then if sqlerrm<>'PEOPLE_PRICE_PARTIAL_ADMISSION_PREVENTS_REVERT' then raise;end if;end;end $barrier$;select jsonb_build_object('observations',(select jsonb_object_agg(k,v) from people_rpc_obs),'stale',(select jsonb_agg(jsonb_build_object('price',price_rsd,'people',covered_slots,'version',current_version) order by covered_slots) from public.marketplace_responses where id in ('8f6a1b59-eb67-42cb-837b-93a0e1141851','10d22fa7-9da9-41c4-b93c-3563f409a270')),'terms',(select jsonb_agg(jsonb_build_object('price',v.terms->>'price_rsd','people',v.terms->>'covered_slots') order by v.terms->>'covered_slots') from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.need_id='a303a708-2d67-43bc-8898-5b9ecc014ee3'));rollback;