-- Execute after candidate + direct-write-guard; fixtures always roll back.
do $proof$
declare aid uuid:=extensions.gen_random_uuid(); pid uuid; s jsonb; r jsonb; saved jsonb; marker text;
begin
 begin
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(aid,'authenticated','authenticated','eqp01-'||aid||'@proof.invalid',now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Disposable EQP01 worker"}',now(),now());
  select id into pid from public.app_profiles where account_id=aid and kind='WORKER';
  if pid is null then raise exception 'EQP01_NO_BOOTSTRAP'; end if;
  update public.app_profiles set tools=array['Historical drill'],vehicles=array['Historical van'] where id=pid;
  perform set_config('request.jwt.claim.sub',aid::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',aid,'role','authenticated')::text,true);
  set local role authenticated;
  s:=public.rpc_open_worker_ai(extensions.gen_random_uuid());
  begin
   perform public.rpc_patch_worker_ai((s->>'conversationId')::uuid,(s->>'revision')::integer,'{"tools":["Fresh drill"]}');
   raise exception 'EQP01_PATCH_UNEXPECTEDLY_ALLOWED';
  exception when sqlstate '22023' then if sqlerrm<>'WORKER_EQUIPMENT_RETIRED' then raise; end if; end;
  begin
   update public.app_profiles set vehicles='{}' where id=pid;
   raise exception 'EQP01_DIRECT_WRITE_UNEXPECTEDLY_ALLOWED';
  exception when sqlstate '22023' then if sqlerrm<>'WORKER_EQUIPMENT_RETIRED' then raise; end if; end;
  s:=public.rpc_patch_worker_ai((s->>'conversationId')::uuid,(s->>'revision')::integer,'{"bio":"Reviewed useful description"}');
  r:=public.rpc_prepare_worker_ai_review((s->>'conversationId')::uuid,(s->>'revision')::integer,false);
  if r->>'equipmentPolicy'<>'PRESERVE_LEGACY_NO_WRITE_V1' then raise exception 'EQP01_POLICY_MISSING'; end if;
  reset role;
  if (select r->>'displayedContentDigest'<>encode(extensions.digest(((r-'displayedContentDigest')||jsonb_build_object('baseHash',v.base_hash))::text,'sha256'),'hex') from private.worker_ai_reviews v where v.id=(r->>'reviewId')::uuid) then raise exception 'EQP01_POLICY_UNSIGNED'; end if;
  set local role authenticated;
  saved:=public.rpc_save_worker_ai_review((r->>'reviewId')::uuid,r->>'displayedContentDigest',extensions.gen_random_uuid());
  if saved->'saved'<>'true'::jsonb or saved<>public.rpc_save_worker_ai_review((r->>'reviewId')::uuid,r->>'displayedContentDigest',extensions.gen_random_uuid()) then raise exception 'EQP01_SAVE_REPLAY'; end if;
  reset role;
  if not exists(select 1 from public.app_profiles where id=pid and bio='Reviewed useful description' and tools=array['Historical drill'] and vehicles=array['Historical van']) then raise exception 'EQP01_LEGACY_CHANGED'; end if;
  -- All three preparation paths sign the policy. Existing immutable rows are untouched.
  set local role authenticated;
  s:=public.rpc_open_worker_ai(extensions.gen_random_uuid());
  r:=public.rpc_prepare_worker_ai_review_taxonomy((s->>'conversationId')::uuid,(s->>'revision')::integer,false);
  if r->>'equipmentPolicy'<>'PRESERVE_LEGACY_NO_WRITE_V1' then raise exception 'EQP01_TAXONOMY_POLICY_MISSING'; end if;
  reset role;
  -- Retired data cannot be copied into a new response by either authoritative path.
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rpc_submit_response','rpc_resolve_stale_response_after_need_edit') and (p.prosrc like '%v_profile.tools%' or p.prosrc like '%v_profile.vehicles%')) then raise exception 'EQP01_RESPONSE_EQUIPMENT'; end if;
  raise exception 'EQP01_ROLLBACK_OK' using errcode='P1001';
 exception when sqlstate 'P1001' then if sqlerrm<>'EQP01_ROLLBACK_OK' then raise; end if; end;
 if exists(select 1 from auth.users where id=aid) then raise exception 'EQP01_FIXTURE_LEAK'; end if;
end $proof$;
