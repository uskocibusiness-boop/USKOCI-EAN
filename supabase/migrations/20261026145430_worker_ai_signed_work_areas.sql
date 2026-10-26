begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- WA01: the Edge function is the only component allowed to turn model-owned
-- areaRequests into canonical coordinates/source references.  Preserve that
-- trust boundary while carrying the resolved value through the signed profile.
do $gate$ begin
  if md5(pg_get_functiondef('private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean)'::regprocedure)) <> '547bf89492bdd1fbb7343c8c441823b0'
    then raise exception 'WA01_PREIMAGE_CHANGED: worker_ai_patch'; end if;
  if md5(pg_get_functiondef('private.worker_ai_initial(uuid)'::regprocedure)) <> 'af7537f8694d77b3b5303a67cda15f16'
    then raise exception 'WA01_PREIMAGE_CHANGED: worker_ai_initial'; end if;
  if md5(pg_get_functiondef('private.worker_ai_source(uuid)'::regprocedure)) <> 'cde537a6bf7692bd72587384f2abcacb'
    then raise exception 'WA01_PREIMAGE_CHANGED: worker_ai_source'; end if;
  if md5(pg_get_functiondef('private.worker_saved_areas_v1(uuid)'::regprocedure)) <> '4b9e8a4114dc962f58aa5488b2ee9675'
    then raise exception 'WA01_PREIMAGE_CHANGED: worker_saved_areas_v1'; end if;
  if md5(pg_get_functiondef('private.validate_worker_areas_v1(jsonb)'::regprocedure)) <> '22233ee6f1029842db9fe465ddb5398f'
    then raise exception 'WA01_PREIMAGE_CHANGED: validate_worker_areas_v1'; end if;
end $gate$;

CREATE OR REPLACE FUNCTION private.worker_ai_source(aid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select jsonb_build_object('profile',to_jsonb(p),'location',private.worker_location_document(p.id),
  'availability',private.worker_availability_document(p.id),'capacity',private.worker_capacity_document(p.id),
  'workAreas',private.worker_saved_areas_v1(aid))
 from public.app_profiles p where p.account_id=aid and p.kind='WORKER';
$function$;

CREATE OR REPLACE FUNCTION private.worker_ai_initial(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p public.app_profiles;
begin
 select * into p from public.app_profiles where account_id=aid and kind='WORKER';
 if found and p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 return jsonb_build_object('displayName',coalesce(p.display_name,''),'bio',coalesce(p.bio,''),
  'skills',coalesce(to_jsonb(p.skills),'[]'::jsonb),'tools',coalesce(to_jsonb(p.tools),'[]'::jsonb),
  'vehicles',coalesce(to_jsonb(p.vehicles),'[]'::jsonb),'licenses',coalesce(to_jsonb(p.licenses),'[]'::jsonb),
  'teamCapacity',coalesce(p.team_capacity,1),'workAreas',private.worker_saved_areas_v1(aid),
  'location',coalesce(private.worker_location_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('operatingCountryCode',null,'city','','radiusKm',15,'approximatePosition',null)),
  'availability',coalesce(private.worker_availability_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('timezone','Europe/Belgrade','availableNow',false,'rules','[]'::jsonb,'windows','[]'::jsonb)));
end $function$;

CREATE OR REPLACE FUNCTION private.worker_ai_patch(base jsonb, patch jsonb, pid uuid, aid uuid, manual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb:=base; k text; v jsonb; loc jsonb; av jsonb; op jsonb; old jsonb; item jsonb;
 rules jsonb; windows jsonb; wanted_days jsonb; remaining jsonb; next_id uuid;
begin
 if patch ?| array['tools','vehicles'] then raise exception 'WORKER_EQUIPMENT_RETIRED' using errcode='22023'; end if;
 if jsonb_typeof(patch) is distinct from 'object' or octet_length(patch::text)>262144
  or patch-array['displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability','workAreas']<>'{}'::jsonb
 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
 -- Authenticated manual patching cannot attest geocoder output. Only the
 -- service-only completed-turn RPC may submit already-resolved workAreas.
 if manual and patch?'workAreas' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
 foreach k in array array['displayName','bio'] loop
  if not patch?k then continue; end if; v:=patch->k;
  if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>(case k when 'displayName' then 160 else 4000 end)
   or (case when k='bio' then regexp_replace(v#>>'{}',E'[\n\r\t]','','g') else v#>>'{}' end) ~ '[[:cntrl:]]' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,array[k],to_jsonb(btrim(v#>>'{}')));
 end loop;
 foreach k in array array['skills','tools','vehicles','licenses'] loop
  if not patch?k then continue; end if; v:=patch->k;
  if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>50 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) is distinct from 'string'
    or length(btrim(x#>>'{}')) not between 1 and 500 or (x#>>'{}') ~ '[[:cntrl:]]')
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,array[k],v);
 end loop;
 if patch?'teamCapacity' then
  if jsonb_typeof(patch->'teamCapacity') is distinct from 'number' or (patch->>'teamCapacity') !~ '^([1-9]|[1-4][0-9]|50)$'
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,'{teamCapacity}',patch->'teamCapacity');
 end if;
 if patch?'workAreas' then
  v:=private.validate_worker_areas_v1(patch->'workAreas');
  result:=jsonb_set(result,'{workAreas}',v);
 end if;
 if patch?'location' then
  v:=patch->'location';
  if jsonb_typeof(v) is distinct from 'object' or v-array['operatingCountryCode','city','radiusKm','approximatePosition']<>'{}'::jsonb
   or (not manual and v?'approximatePosition') then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  loc:=base->'location'||v;
  if jsonb_typeof(loc->'city') is distinct from 'string' or length(btrim(loc->>'city'))>160
   or (loc->>'city') ~ '[[:cntrl:]]' or jsonb_typeof(loc->'radiusKm') is distinct from 'number'
   or (loc->>'radiusKm') !~ '^([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  if loc->'operatingCountryCode'<>'null'::jsonb then perform private.require_location_country(loc->'operatingCountryCode'); end if;
  if (v?'city' and v->'city' is distinct from base#>'{location,city}') or
     (v?'operatingCountryCode' and v->'operatingCountryCode' is distinct from base#>'{location,operatingCountryCode}') then
   if not(manual and v?'approximatePosition') then loc:=jsonb_set(loc,'{approximatePosition}','null'); end if;
  end if;
  if loc->'approximatePosition'<>'null'::jsonb then
   item:=loc->'approximatePosition';
   if jsonb_typeof(item) is distinct from 'object' or item-array['latitude','longitude']<>'{}'::jsonb
    or jsonb_typeof(item->'latitude') is distinct from 'number' or jsonb_typeof(item->'longitude') is distinct from 'number'
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   if (item->>'latitude')::numeric not between -90 and 90 or (item->>'longitude')::numeric not between -180 and 180
    or (item->>'latitude')::numeric<>round((item->>'latitude')::numeric,2)
    or (item->>'longitude')::numeric<>round((item->>'longitude')::numeric,2) then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end if;
  result:=jsonb_set(result,'{location}',loc);
 end if;
 if patch?'availability' then
  v:=patch->'availability'; av:=base->'availability'; rules:=av->'rules'; windows:=av->'windows';
  if jsonb_typeof(v) is distinct from 'object' or v-array['timezone','availableNow','ruleChanges','windowsUpsert','windowIdsRemove']<>'{}'::jsonb
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  foreach k in array array['timezone','availableNow'] loop if v?k then av:=jsonb_set(av,array[k],v->k); end if; end loop;
  foreach k in array array['ruleChanges','windowsUpsert','windowIdsRemove'] loop
   if v?k and (jsonb_typeof(v->k) is distinct from 'array' or jsonb_array_length(v->k)>(case when k='ruleChanges' then 256 else 512 end))
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end loop;
  for op in select value from jsonb_array_elements(coalesce(v->'ruleChanges','[]')) loop
   if jsonb_typeof(op) is distinct from 'object' or op-array['ruleId','weekdays','value']<>'{}'::jsonb
    or not(op?&array['ruleId','weekdays','value']) or jsonb_typeof(op->'weekdays') is distinct from 'array'
    or jsonb_array_length(op->'weekdays') not between 1 and 7
    or exists(select 1 from jsonb_array_elements(op->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$')
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   wanted_days:=op->'weekdays';
   if jsonb_array_length(wanted_days)<>(select count(distinct d) from jsonb_array_elements(wanted_days) d) then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   if op->'ruleId'<>'null'::jsonb then
    select x into old from jsonb_array_elements(rules) x where x->'id'=op->'ruleId';
    if not found or not(old->'weekdays' @> wanted_days) then raise exception 'WORKER_AI_RULE_STALE' using errcode='PT409'; end if;
    select coalesce(jsonb_agg(d),'[]') into remaining from jsonb_array_elements(old->'weekdays') d where not(wanted_days @> jsonb_build_array(d));
    select coalesce(jsonb_agg(x),'[]') into rules from jsonb_array_elements(rules) x where x->'id'<>old->'id';
    if jsonb_array_length(remaining)>0 then rules:=rules||jsonb_build_array(jsonb_set(old,'{weekdays}',remaining)); end if;
   end if;
   if op->'value'<>'null'::jsonb then
    item:=op->'value';
    if jsonb_typeof(item) is distinct from 'object' or item-array['startTime','endTime','startsOn','endsOn','label','active']<>'{}'::jsonb
    then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
    next_id:=extensions.gen_random_uuid();
    rules:=rules||jsonb_build_array(item||jsonb_build_object('id',next_id,'weekdays',wanted_days));
   elsif op->'ruleId'='null'::jsonb then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(v->'windowIdsRemove','[]')) loop
   if not exists(select 1 from jsonb_array_elements(windows) x where x->'id'=item) then raise exception 'WORKER_AI_WINDOW_STALE' using errcode='PT409'; end if;
   select coalesce(jsonb_agg(x),'[]') into windows from jsonb_array_elements(windows) x where x->'id'<>item;
  end loop;
  for op in select value from jsonb_array_elements(coalesce(v->'windowsUpsert','[]')) loop
   if jsonb_typeof(op) is distinct from 'object' or not(op?'id') then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   item:=op;
   if op->'id'='null'::jsonb then item:=jsonb_set(op,'{id}',to_jsonb(extensions.gen_random_uuid()));
   elsif not exists(select 1 from jsonb_array_elements(windows) x where x->'id'=op->'id') then raise exception 'WORKER_AI_WINDOW_STALE' using errcode='PT409';
   else select coalesce(jsonb_agg(x),'[]') into windows from jsonb_array_elements(windows) x where x->'id'<>op->'id'; end if;
   windows:=windows||jsonb_build_array(item);
  end loop;
  av:=av||jsonb_build_object('rules',rules,'windows',windows);
  av:=private.normalize_worker_ai_availability(pid,aid,av);
  result:=jsonb_set(result,'{availability}',av);
 end if;
 return result;
end $function$;

-- Pure contract checks: canonical resolved areas pass; authenticated/manual
-- callers and malformed/non-canonical coordinate payloads fail closed.
do $proof$
declare
  base jsonb:=jsonb_build_object('workAreas','[]'::jsonb);
  areas jsonb:=jsonb_build_array(jsonb_build_object(
    'kind','RADIUS','countryCode','RS','label','Novi Sad · do 30 km','city','Novi Sad',
    'sourceRef','osm:relation:123','latitude',45.27,'longitude',19.83,'radiusKm',30));
  got jsonb;
begin
  got:=private.worker_ai_patch(base,jsonb_build_object('workAreas',areas),extensions.gen_random_uuid(),extensions.gen_random_uuid(),false);
  if got->'workAreas' is distinct from areas then raise exception 'WA01_CANONICAL_AREA_NOT_PRESERVED'; end if;
  begin
    perform private.worker_ai_patch(base,jsonb_build_object('workAreas',areas),extensions.gen_random_uuid(),extensions.gen_random_uuid(),true);
    raise exception 'WA01_MANUAL_AREA_ACCEPTED';
  exception when sqlstate '22023' then null; end;
  begin
    perform private.worker_ai_patch(base,jsonb_build_object('workAreas',jsonb_set(areas,'{0,latitude}','45.271'::jsonb)),extensions.gen_random_uuid(),extensions.gen_random_uuid(),false);
    raise exception 'WA01_UNROUNDED_AREA_ACCEPTED';
  exception when sqlstate '22023' then null; end;
end $proof$;

REVOKE ALL ON FUNCTION private.worker_ai_source(uuid) FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.worker_ai_initial(uuid) FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean) FROM public,anon,authenticated,service_role;

commit;
