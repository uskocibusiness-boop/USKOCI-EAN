-- Execute after 00_country_rs_core.sql in ONE transaction ending ROLLBACK.
-- Uses real row IDs only inside that uncommitted transaction; emits counts.
do $proof$
declare
  p1 public.app_profiles; p2 public.app_profiles;
  onsite_rs uuid; remote_need uuid; unknown_need uuid;
  doc jsonb; rejected boolean; got boolean; cases integer := 0;
  sample jsonb;
begin
  if has_table_privilege('anon','private.worker_country_scope_v2','SELECT')
    or has_table_privilege('authenticated','private.worker_country_scope_v2','SELECT')
    or has_table_privilege('service_role','private.worker_country_scope_v2','INSERT')
    or has_function_privilege('anon','public.rpc_read_worker_country_scope_candidate_v2(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.rpc_read_worker_country_scope_candidate_v2(uuid)','EXECUTE')
  then raise exception 'AREA_V2_ACL_FAILED'; end if;
  cases := cases + 1;

  select * into p1 from public.app_profiles
    where kind='WORKER' and profile_status in ('DRAFT','ACTIVE') order by id limit 1;
  select * into p2 from public.app_profiles
    where kind='WORKER' and profile_status in ('DRAFT','ACTIVE')
      and account_id<>p1.account_id order by id limit 1;
  select id into onsite_rs from public.needs
    where execution_location_mode='STATIONARY' and task_country_code='RS' order by id limit 1;
  select id into remote_need from public.needs
    where execution_location_mode='REMOTE' order by id limit 1;
  select id into unknown_need from public.needs
    where execution_location_mode='STATIONARY' and task_country_code is null order by id limit 1;
  if p1.id is null or p2.id is null or onsite_rs is null or remote_need is null
  then raise exception 'AREA_V2_FIXTURE_MISSING'; end if;

  -- No row = the current V1 matcher remains the only area authority.
  if private.worker_country_scope_match_v2(onsite_rs,p1.id) is not null
    or private.worker_country_scope_match_v2(onsite_rs,p2.id) is not null
  then raise exception 'AREA_V2_LEGACY_FALLBACK_FAILED'; end if;
  cases := cases + 1;

  -- An address, biography or broad phrase cannot manufacture country consent.
  foreach sample in array array[
    '{"bio":"Radim u celoj Srbiji"}'::jsonb,
    '{"bio":"radim u novom sadu i beogradu"}'::jsonb,
    '{"bio":"novi sad i beograd"}'::jsonb,
    '{"bio":"radim u nišu i kragujevcu"}'::jsonb,
    '{"location":{"operatingCountryCode":"RS","city":"Novi Sad","radiusKm":200}}'::jsonb
  ] loop
    if private.worker_country_scope_candidate_v2(sample) is not null
    then raise exception 'AREA_V2_UNSIGNED_TEXT_ADMITTED'; end if;
    cases := cases + 1;
  end loop;
  doc := private.worker_country_scope_candidate_v2(
    '{"areas":[{"kind":"COUNTRY","countryCode":"RS","scope":"ON_SITE"}]}'::jsonb);
  if doc is distinct from '{"kind":"COUNTRY","countryCode":"RS","scope":"ON_SITE"}'::jsonb
  then raise exception 'AREA_V2_COUNTRY_NORMALIZATION_FAILED'; end if;
  cases := cases + 1;
  foreach sample in array array[
    '{"areas":[]}'::jsonb,
    '{"areas":[{"kind":"COUNTRY","countryCode":"BA","scope":"ON_SITE"}]}'::jsonb,
    '{"areas":[{"kind":"ADMIN_REGION","countryCode":"RS","scope":"ON_SITE"}]}'::jsonb,
    '{"areas":[{"kind":"COUNTRY","countryCode":"RS","scope":"REMOTE"}]}'::jsonb,
    '{"areas":[{"kind":"COUNTRY","countryCode":"RS","scope":"ON_SITE","source":"bio"}]}'::jsonb,
    '{"areas":[{"kind":"LOCALITY_RADIUS","city":"Novi Sad"},{"kind":"LOCALITY_RADIUS","city":"Beograd"}]}'::jsonb
  ] loop
    rejected := false;
    begin perform private.worker_country_scope_candidate_v2(sample);
    exception when sqlstate '22023' then rejected := true; end;
    if not rejected then raise exception 'AREA_V2_UNSUPPORTED_SCOPE_ADMITTED'; end if;
    cases := cases + 1;
  end loop;

  if private.worker_country_scope_task_fit_v2('STATIONARY','RS','RS') is distinct from true
    or private.worker_country_scope_task_fit_v2('STATIONARY',null,'RS') is distinct from false
    or private.worker_country_scope_task_fit_v2('STATIONARY','BA','RS') is distinct from false
    or private.worker_country_scope_task_fit_v2('POINT_TO_POINT','RS','RS') is distinct from false
    or private.worker_country_scope_task_fit_v2('MULTI_STOP','RS','RS') is distinct from false
    or private.worker_country_scope_task_fit_v2('AREA_BASED','RS','RS') is distinct from false
    or private.worker_country_scope_task_fit_v2('REMOTE','RS','RS') is not null
  then raise exception 'AREA_V2_TASK_FIT_FAILED'; end if;
  cases := cases + 7;

  -- Guard binds the profile to its account even for a privileged caller.
  rejected := false;
  begin
    insert into private.worker_country_scope_v2(
      profile_id,account_id,country_code,source_review_id,displayed_digest,source_revision)
    values(p2.id,p1.account_id,'RS',extensions.gen_random_uuid(),repeat('a',64),0);
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'AREA_V2_FOREIGN_PROFILE_WRITE_ADMITTED'; end if;
  cases := cases + 1;

  insert into private.worker_country_scope_v2(
    profile_id,account_id,country_code,source_review_id,displayed_digest,source_revision)
  values(p1.id,p1.account_id,'RS',extensions.gen_random_uuid(),repeat('a',64),0);
  if private.worker_country_scope_match_v2(onsite_rs,p1.id) is distinct from true
    or private.worker_country_scope_match_v2(remote_need,p1.id) is not null
    or private.worker_country_scope_match_v2(onsite_rs,p2.id) is not null
    or (unknown_need is not null and private.worker_country_scope_match_v2(unknown_need,p1.id) is distinct from false)
  then raise exception 'AREA_V2_SHADOW_MATCH_FAILED'; end if;
  cases := cases + 4;

  perform set_config('request.jwt.claim.sub',p1.account_id::text,true);
  doc := public.rpc_read_worker_country_scope_candidate_v2(p1.id);
  if doc->>'effectiveSource' is distinct from 'COUNTRY_RS_SHADOW'
    or doc#>>'{area,countryCode}' is distinct from 'RS'
    or doc->>'candidateOnly' is distinct from 'true'
  then raise exception 'AREA_V2_OWNER_READ_FAILED'; end if;
  cases := cases + 1;
  rejected := false;
  begin perform public.rpc_read_worker_country_scope_candidate_v2(p2.id);
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'AREA_V2_FOREIGN_READ_ADMITTED'; end if;
  cases := cases + 1;
  perform set_config('request.jwt.claim.sub','',true);
  rejected := false;
  begin perform public.rpc_read_worker_country_scope_candidate_v2(p1.id);
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'AREA_V2_ANON_READ_ADMITTED'; end if;
  cases := cases + 1;
  raise notice 'AREA_V2_ROLLBACK_PROOF_PASS cases=%',cases;
end $proof$;

select 'AREA_V2_ROLLBACK_PROOF_PASS' as proof,
  (select count(*) from private.worker_country_scope_v2) as transient_rows;
