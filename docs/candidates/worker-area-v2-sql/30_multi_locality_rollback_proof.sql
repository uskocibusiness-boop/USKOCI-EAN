-- Execute after 00_country_rs_core.sql and 20_multi_locality_core.sql in
-- ONE transaction ending ROLLBACK. Synthetic catalog entries never persist.
do $proof$
declare
  p1 public.app_profiles; p2 public.app_profiles; task public.needs;
  no_point_need uuid; place_a uuid := extensions.gen_random_uuid();
  place_b uuid := extensions.gen_random_uuid();
  unknown_place uuid := extensions.gen_random_uuid();
  candidate jsonb; doc jsonb; sample jsonb; rejected boolean;
begin
  if has_table_privilege('anon','private.worker_area_place_catalog_v2','SELECT')
    or has_table_privilege('authenticated','private.worker_multi_locality_scope_v2','SELECT')
    or has_table_privilege('service_role','private.worker_multi_locality_area_v2','INSERT')
    or has_function_privilege('anon','public.rpc_read_worker_multi_locality_candidate_v2(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.rpc_read_worker_multi_locality_candidate_v2(uuid)','EXECUTE')
  then raise exception 'MULTI_LOCALITY_ACL_FAILED'; end if;

  select * into p1 from public.app_profiles
    where kind='WORKER' and profile_status in ('DRAFT','ACTIVE') order by id limit 1;
  select * into p2 from public.app_profiles
    where kind='WORKER' and profile_status in ('DRAFT','ACTIVE')
      and account_id<>p1.account_id order by id limit 1;
  select * into task from public.needs
    where execution_location_mode='STATIONARY' and task_country_code='RS'
      and approximate_lat is not null and approximate_lng is not null
    order by id limit 1;
  select id into no_point_need from public.needs
    where execution_location_mode='STATIONARY' and task_country_code='RS'
      and (approximate_lat is null or approximate_lng is null) order by id limit 1;
  if p1.id is null or p2.id is null or task.id is null
  then raise exception 'MULTI_LOCALITY_FIXTURE_MISSING'; end if;

  -- A worker without V2 areas uses the existing V1 matcher, unchanged.
  if private.worker_multi_locality_match_v2(task.id,p1.id) is not null
    or private.worker_multi_locality_match_v2(task.id,p2.id) is not null
  then raise exception 'MULTI_LOCALITY_V1_FALLBACK_FAILED'; end if;

  insert into private.worker_area_place_catalog_v2(
    place_id,country_code,canonical_label,center_lat,center_lng,
    source_system,source_ref,catalog_revision,verified_at)
  values
    (place_a,'RS','Test mesto A',
      case when task.approximate_lat > 44 then 42.000000 else 46.000000 end,
      task.approximate_lng,
      'ROLLBACK_FIXTURE','place-A',1,clock_timestamp()),
    (place_b,'RS','Test mesto B',task.approximate_lat,task.approximate_lng,
      'ROLLBACK_FIXTURE','place-B',1,clock_timestamp());

  candidate := jsonb_build_object('areas',jsonb_build_array(
    jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
      'radiusKm',20,'scope','ON_SITE'),
    jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_b,
      'radiusKm',30,'scope','ON_SITE')));
  doc := private.worker_multi_locality_candidate_v2(candidate);
  if doc->>'effectiveSource' is distinct from 'MULTI_LOCALITY_SHADOW'
    or jsonb_array_length(doc->'areas') <> 2
    or doc#>>'{areas,0,label}' is distinct from 'Test mesto A'
    or doc#>>'{areas,1,label}' is distinct from 'Test mesto B'
    or doc#>>'{areas,0,radiusKm}' is distinct from '20'
    or doc::text like '%center_lat%'
  then raise exception 'MULTI_LOCALITY_NORMALIZATION_FAILED'; end if;

  if private.worker_multi_locality_candidate_v2('{}'::jsonb) is not null
  then raise exception 'MULTI_LOCALITY_LEGACY_CANDIDATE_FAILED'; end if;
  foreach sample in array array[
    '{"areas":[]}'::jsonb,
    '{"areas":[{"kind":"ADMIN_REGION","regionCode":"RS12","scope":"ON_SITE"}]}'::jsonb,
    '{"areas":[{"kind":"LOCALITY_RADIUS","city":"Novi Sad","radiusKm":20,"scope":"ON_SITE"}]}'::jsonb,
    jsonb_build_object('areas',jsonb_build_array(
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',unknown_place,
        'radiusKm',20,'scope','ON_SITE'))),
    jsonb_build_object('areas',jsonb_build_array(
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
        'radiusKm',20,'scope','ON_SITE'),
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
        'radiusKm',30,'scope','ON_SITE'))),
    jsonb_build_object('areas',jsonb_build_array(
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
        'scope','ON_SITE'))),
    jsonb_build_object('areas',jsonb_build_array(
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
        'radiusKm',4,'scope','ON_SITE'))),
    jsonb_build_object('areas',jsonb_build_array(
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
        'radiusKm',201,'scope','ON_SITE'))),
    jsonb_build_object('areas',jsonb_build_array(
      jsonb_build_object('kind','LOCALITY_RADIUS','placeId',place_a,
        'radiusKm',20,'scope','ON_SITE','label','Untrusted')))
  ] loop
    rejected := false;
    begin perform private.worker_multi_locality_candidate_v2(sample);
    exception when sqlstate '22023' then rejected := true; end;
    if not rejected then raise exception 'MULTI_LOCALITY_BAD_CANDIDATE_ADMITTED'; end if;
  end loop;

  if private.worker_multi_locality_task_fit_v2('STATIONARY','RS',
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is distinct from true
    or private.worker_multi_locality_task_fit_v2('STATIONARY','RS',
      task.approximate_lat,task.approximate_lng,
      case when task.approximate_lat > 44 then 42.000000 else 46.000000 end,
      task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('STATIONARY','RS',
      40,18,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('STATIONARY',null,
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('STATIONARY','BA',
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('STATIONARY','RS',
      null,null,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('POINT_TO_POINT','RS',
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('MULTI_STOP','RS',
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('AREA_BASED','RS',
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is distinct from false
    or private.worker_multi_locality_task_fit_v2('REMOTE','RS',
      task.approximate_lat,task.approximate_lng,task.approximate_lat,task.approximate_lng,20) is not null
  then raise exception 'MULTI_LOCALITY_TASK_FIT_FAILED'; end if;

  rejected := false;
  begin
    insert into private.worker_multi_locality_scope_v2(
      profile_id,account_id,source_review_id,displayed_digest,source_revision)
    values(p2.id,p1.account_id,extensions.gen_random_uuid(),repeat('a',64),0);
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'MULTI_LOCALITY_FOREIGN_PROFILE_ADMITTED'; end if;

  insert into private.worker_multi_locality_scope_v2(
    profile_id,account_id,source_review_id,displayed_digest,source_revision)
  values(p1.id,p1.account_id,extensions.gen_random_uuid(),repeat('a',64),0);
  insert into private.worker_multi_locality_area_v2(
    profile_id,ordinal,place_id,catalog_revision,radius_km)
  values(p1.id,1,place_a,1,20),(p1.id,2,place_b,1,30);
  if private.worker_multi_locality_match_v2(task.id,p1.id) is distinct from true
    or private.worker_multi_locality_match_v2(task.id,p2.id) is not null
    or (no_point_need is not null
      and private.worker_multi_locality_match_v2(no_point_need,p1.id) is distinct from false)
  then raise exception 'MULTI_LOCALITY_SHADOW_MATCH_FAILED'; end if;

  -- Mixed COUNTRY and MULTI_LOCALITY receipts never create wider access.
  insert into private.worker_country_scope_v2(
    profile_id,account_id,country_code,source_review_id,displayed_digest,source_revision)
  values(p1.id,p1.account_id,'RS',extensions.gen_random_uuid(),repeat('a',64),0);
  if private.worker_multi_locality_match_v2(task.id,p1.id) is distinct from false
  then raise exception 'MULTI_LOCALITY_CONFLICT_NOT_BLOCKED'; end if;
  delete from private.worker_country_scope_v2 where profile_id=p1.id;

  perform set_config('request.jwt.claim.sub',p1.account_id::text,true);
  doc := public.rpc_read_worker_multi_locality_candidate_v2(p1.id);
  if doc->>'effectiveSource' is distinct from 'MULTI_LOCALITY_SHADOW'
    or jsonb_array_length(doc->'areas') <> 2
    or doc#>>'{areas,0,label}' is distinct from 'Test mesto A'
    or doc->>'candidateOnly' is distinct from 'true'
    or doc::text like '%center_lat%'
  then raise exception 'MULTI_LOCALITY_OWNER_READ_FAILED'; end if;
  rejected := false;
  begin perform public.rpc_read_worker_multi_locality_candidate_v2(p2.id);
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'MULTI_LOCALITY_FOREIGN_READ_ADMITTED'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  rejected := false;
  begin perform public.rpc_read_worker_multi_locality_candidate_v2(p1.id);
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'MULTI_LOCALITY_ANON_READ_ADMITTED'; end if;

  rejected := false;
  begin update private.worker_area_place_catalog_v2 set center_lat=44
    where place_id=place_a;
  exception when sqlstate '42501' then rejected := true; end;
  if not rejected then raise exception 'MULTI_LOCALITY_CATALOG_MUTATION_ADMITTED'; end if;
  raise notice 'AREA_V2_MULTI_LOCALITY_ROLLBACK_PROOF_PASS';
end $proof$;

-- Exercise the public read RPC as the actual authenticated database role,
-- with only the owner's JWT claim. Direct private-table grants remain absent.
select set_config('request.jwt.claim.sub',account_id::text,true),
  set_config('uskoci.area_v2_test_profile',id::text,true)
from public.app_profiles
where kind='WORKER' and profile_status in ('DRAFT','ACTIVE')
order by id limit 1;
set local role authenticated;
do $auth$
declare doc jsonb;
begin
  doc := public.rpc_read_worker_multi_locality_candidate_v2(
    current_setting('uskoci.area_v2_test_profile')::uuid);
  if doc->>'effectiveSource' is distinct from 'MULTI_LOCALITY_SHADOW'
    or jsonb_array_length(doc->'areas') <> 2
  then raise exception 'MULTI_LOCALITY_AUTHENTICATED_OWNER_READ_FAILED'; end if;
end $auth$;
reset role;

select 'AREA_V2_MULTI_LOCALITY_ROLLBACK_PROOF_PASS' as proof,
  (select count(*) from private.worker_area_place_catalog_v2) as transient_places,
  (select count(*) from private.worker_multi_locality_area_v2) as transient_areas;
