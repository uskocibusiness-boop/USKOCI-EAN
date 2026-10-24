-- ==============================================================================
-- USKOCI BASELINE CLIENT RPCS CONSOLIDATION
-- Migration: 20261025000000_baseline_core_client_rpcs.sql
-- Consolidates 12 live client-invoked RPC functions into migration history.
-- ==============================================================================


-- --- rpc_discovery_v1 and helpers ---
create or replace function public.p6_discovery_trim(value text) returns text language sql immutable security invoker set search_path=pg_catalog as $f$
 select btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$f$;
create or replace function public.p6_discovery_key(value text) returns text language sql immutable security invoker set search_path=pg_catalog as $f$
 select lower(regexp_replace(public.p6_discovery_trim(value),U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g') collate pg_catalog."sr-Latn-RS-x-icu")
$f$;
create or replace function public.p6_discovery_unquote(value text) returns text language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin
 if length(t)>1 then
  a:=left(t,1); b:=right(t,1);
  if (a,b) in (('"','"'),('„','“'),('“','”'),('''','''')) then
   inner_text:=substr(t,2,length(t)-2);
   if inner_text !~ '["„“”]' and (a<>'''' or strpos(inner_text,'''')=0) then
    return nullif(public.p6_discovery_trim(inner_text),'');
   end if;
  end if;
 end if;
 return nullif(t,'');
end $f$;
create or replace function public.p6_discovery_area(area text,city text,remote boolean) returns text language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;
 if a is null then return coalesce(c,'Lokacija nije navedena'); end if;
 if c is null or exists(select 1 from unnest(string_to_array(a,',')) s
   where lower(public.p6_discovery_trim(s) collate pg_catalog."sr-Latn-RS-x-icu")=lower(c collate pg_catalog."sr-Latn-RS-x-icu")) then return a; end if;
 return a||', '||c;
end $f$;
create or replace function public.p6_discovery_days(kind text,starts timestamptz,ends timestamptz,zone text,anchor_at timestamptz)
returns text[] language plpgsql stable security invoker set search_path=pg_catalog as $f$
declare first_day text; last_day text; today date; instant timestamptz; local_time timestamp; z text:=coalesce(zone,'UTC');
begin
 if starts is not null and isfinite(starts) then
  first_day:=to_char(date_trunc('milliseconds',starts) at time zone z,'YYYY-MM-DD');
 end if;
 if ends is not null and isfinite(ends) then
  instant:=date_trunc('milliseconds',ends); local_time:=instant at time zone z;
  if to_char(local_time,'HH24:MI:SS')='00:00:00' then instant:=instant-interval '1 millisecond'; end if;
  last_day:=to_char(instant at time zone z,'YYYY-MM-DD');
 end if;
 if first_day is not null then return array[first_day,case when last_day>=first_day then last_day when kind='FIXED_WINDOW' then first_day else '9999-12-31' end]; end if;
 if last_day is not null then return case when kind='FIXED_WINDOW' then null else array['0000-01-01',last_day] end; end if;
 today:=(anchor_at at time zone z)::date;
 return case kind
  when 'TODAY_FLEXIBLE' then array[today::text,today::text]
  when 'TOMORROW_FLEXIBLE' then array[(today+1)::text,(today+1)::text]
  when 'WEEK_FLEXIBLE' then array[today::text,(today+(7-extract(isodow from today)::integer))::text]
  when 'FLEXIBLE' then array['0000-01-01','9999-12-31']
  when 'REMOTE_ANYTIME' then array['0000-01-01','9999-12-31'] else null end;
exception when invalid_parameter_value or datetime_field_overflow then return null;
end $f$;
create or replace function public.p6_discovery_civil(value text) returns boolean language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare y integer; m integer; d integer; last_day integer;
begin
 if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
 y:=left(value,4)::integer; m:=substr(value,6,2)::integer; d:=right(value,2)::integer;
 if m<1 or m>12 then return false; end if;
 last_day:=(array[31,case when y%4=0 and (y%100<>0 or y%400=0) then 29 else 28 end,31,30,31,30,31,31,30,31,30,31])[m];
 return d between 1 and last_day;
end $f$;

create or replace function public.rpc_discovery_v1(p_request jsonb) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog as $f$
declare
 r jsonb:=p_request; f jsonb; a jsonb; scope jsonb; cursor_doc jsonb; result jsonb;
 query_text text; locality text; price text; location_mode text; when_mode text; scope_mode text; request_mode text;
 filter_key text; scope_key text; need_id uuid; people integer; page_limit integer;
 now_at timestamptz:=statement_timestamp(); time_at timestamptz; through_at timestamptz; expires_at timestamptz;
 before_at timestamptz; before_id uuid; before_section integer;
 west numeric; south numeric; east numeric; north numeric; point_lat numeric; point_lng numeric;
 range_from text; range_to text; iso_pattern text:='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(r) is distinct from 'object' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
 request_mode:=r->>'mode';
 if request_mode='EXACT_PUBLIC' then
  if r-array['mode','needId']<>'{}' or not(r?&array['mode','needId']) or jsonb_typeof(r->'needId')<>'string'
    or r->>'needId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  need_id:=(r->>'needId')::uuid; time_at:=now_at; through_at:=now_at; page_limit:=1;
  f:='{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null}';
  scope:='{"kind":"ALL"}';
 elsif request_mode='PAGE' then
  if r-array['mode','filter','anchor','scope','limit','after']<>'{}' or not(r?&array['mode','filter','anchor','scope','limit','after'])
    or jsonb_typeof(r->'limit')<>'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)
    or (r->>'limit')::numeric not between 1 and 100 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  page_limit:=(r->>'limit')::integer; f:=r->'filter'; scope:=r->'scope';
 else raise exception 'P6_MODE_NOT_IMPLEMENTED' using errcode='22023'; end if;
 if jsonb_typeof(f) is distinct from 'object' or f-array['text','price','where','places','when','dates','place']<>'{}'
   or not(f?&array['text','price','where','places','when','dates','place'])
   or jsonb_typeof(f->'text')<>'string' or octet_length(f->>'text')>16000
   or coalesce(f->>'price','') not in ('all','MY_PRICE','OFFERS') or coalesce(f->>'where','') not in ('any','onsite','remote')
   or coalesce(f->>'when','') not in ('any','today','tomorrow','week','weekend','next7')
   or jsonb_typeof(f->'places')<>'number' or (f->>'places')::numeric<>trunc((f->>'places')::numeric)
   or (f->>'places')::numeric not between 1 and 10 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
 query_text:=lower(public.p6_discovery_trim(f->>'text') collate pg_catalog."sr-Latn-RS-x-icu");
 price:=f->>'price'; location_mode:=f->>'where'; people:=(f->>'places')::integer; when_mode:=f->>'when';
 if f->'dates'<>'null'::jsonb then
  if jsonb_typeof(f->'dates')<>'object' or (f->'dates')-array['from','to']<>'{}'
    or not public.p6_discovery_civil(f#>>'{dates,from}') or not public.p6_discovery_civil(f#>>'{dates,to}')
    or f#>>'{dates,from}'>f#>>'{dates,to}' then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  range_from:=f#>>'{dates,from}'; range_to:=f#>>'{dates,to}'; when_mode:='any';
 end if;
 if f->'place'<>'null'::jsonb then
  if jsonb_typeof(f->'place')<>'string' or octet_length(f->>'place')>16000 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  locality:=nullif(public.p6_discovery_key(f->>'place'),'');
 end if;
 if location_mode='remote' then locality:=null; scope:='{"kind":"ALL"}'; end if;
 f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,
   'dates',case when range_from is null then null else jsonb_build_object('from',range_from,'to',range_to) end,'place',locality);
 filter_key:=md5(f::text);
 if request_mode='PAGE' then
  if r->'anchor'='null'::jsonb then
   if r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
   time_at:=now_at; through_at:=now_at; expires_at:=now_at+interval '30 minutes';
  else
   a:=r->'anchor';
   if jsonb_typeof(a)<>'object' or a-array['version','filterKey','timeAt','publishedThrough','expiresAt']<>'{}'
     or not(a?&array['version','filterKey','timeAt','publishedThrough','expiresAt'])
     or a->>'version' is distinct from 'DISCOVERY_V1' or a->>'filterKey' is distinct from filter_key
     or coalesce(a->>'timeAt','')!~iso_pattern or coalesce(a->>'publishedThrough','')!~iso_pattern or coalesce(a->>'expiresAt','')!~iso_pattern
     then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;
   time_at:=(a->>'timeAt')::timestamptz; through_at:=(a->>'publishedThrough')::timestamptz; expires_at:=(a->>'expiresAt')::timestamptz;
   if not isfinite(time_at) or time_at>now_at or through_at<>time_at or expires_at<>time_at+interval '30 minutes' then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;
   if expires_at<=now_at then raise exception 'P6_ANCHOR_EXPIRED' using errcode='22023'; end if;
  end if;
 end if;
 if jsonb_typeof(scope) is distinct from 'object' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 scope_mode:=scope->>'kind';
 if scope_mode='ALL' then
  if scope-array['kind']<>'{}' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 elsif scope_mode='AREA' then
  if scope-array['kind','bounds']<>'{}' or jsonb_typeof(scope->'bounds') is distinct from 'array' or jsonb_array_length(scope->'bounds')<>4
    or exists(select 1 from jsonb_array_elements(scope->'bounds') x where jsonb_typeof(x)<>'number') then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  west:=(scope#>>'{bounds,0}')::numeric; south:=(scope#>>'{bounds,1}')::numeric; east:=(scope#>>'{bounds,2}')::numeric; north:=(scope#>>'{bounds,3}')::numeric;
  if abs(west)>180 or abs(east)>180 or south< -90 or north>90 or south>north then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  scope:=jsonb_build_object('kind',scope_mode,'bounds',jsonb_build_array(west::double precision,south::double precision,east::double precision,north::double precision));
 elsif scope_mode in ('POINT_LIST','POINT_MEMBERS') then
  if scope-array['kind','point']<>'{}' or jsonb_typeof(scope->'point') is distinct from 'object' or (scope->'point')-array['lat','lng']<>'{}'
    or jsonb_typeof(scope#>'{point,lat}') is distinct from 'number' or jsonb_typeof(scope#>'{point,lng}') is distinct from 'number' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  point_lat:=(scope#>>'{point,lat}')::numeric; point_lng:=(scope#>>'{point,lng}')::numeric;
  if abs(point_lat)>90 or abs(point_lng)>180 or round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  scope:=jsonb_build_object('kind',scope_mode,'point',jsonb_build_object('lat',point_lat::double precision,'lng',point_lng::double precision));
 else raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 scope_key:=md5(jsonb_build_object('filterKey',filter_key,'scope',scope,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text);
 cursor_doc:=r->'after';
 if request_mode='PAGE' and cursor_doc<>'null'::jsonb then
  if jsonb_typeof(cursor_doc)<>'object' or cursor_doc-array['scopeKey','section','sortAt','id']<>'{}'
    or not(cursor_doc?&array['scopeKey','section','sortAt','id']) or cursor_doc->>'scopeKey' is distinct from scope_key
    or cursor_doc->'section' not in ('0'::jsonb,'1'::jsonb) or coalesce(cursor_doc->>'sortAt','')!~iso_pattern
    or coalesce(cursor_doc->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
  before_at:=(cursor_doc->>'sortAt')::timestamptz; before_id:=(cursor_doc->>'id')::uuid; before_section:=(cursor_doc->>'section')::integer;
  if before_at>through_at or (scope_mode in ('ALL','POINT_MEMBERS') and before_section<>0) then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
 end if;
 with base as materialized (
  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,
   n.task_country_code,n.task_timezone,n.verified_identity_required,n.approximate_city,n.approximate_area,n.approximate_lat,n.approximate_lng,
   n.required_slots,n.required_skills,n.required_tools,n.required_vehicles,n.required_licenses,n.minimum_experience_years,n.mode,
   n.requester_price_rsd,n.price_basis,n.requester_profile_id,n.response_deadline,
   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,
   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,
   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,
   case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
   (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode='PAGE' and n.published_at<=through_at)
 ), shared as materialized (
  select b.*,case when range_from is not null then array[range_from,range_to] else case when_mode
   when 'today' then array[today::text,today::text] when 'tomorrow' then array[(today+1)::text,(today+1)::text]
   when 'week' then array[today::text,(today+7-extract(isodow from today)::integer)::text]
   when 'next7' then array[today::text,(today+6)::text]
   when 'weekend' then array[(today+greatest(0,6-extract(isodow from today)::integer))::text,(today+7-extract(isodow from today)::integer)::text] else null end end as wanted
  from base b where (price='all' or b.mode=price)
   and (location_mode='any' or location_mode='remote' and b.execution_location_mode='REMOTE'
     or location_mode='onsite' and b.execution_location_mode is not null and b.execution_location_mode<>'REMOTE')
   and (people=1 or greatest(0,coalesce(nullif(b.required_slots,0),1)-coalesce(b.covered_now,0))>=people)
   and (locality is null or b.execution_location_mode is distinct from 'REMOTE' and public.p6_discovery_key(b.area_text)=locality
     and public.p6_discovery_key(b.area_text) not in ('na daljinu','lokacija nije navedena'))
   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text||' '||array_to_string(coalesce(b.required_skills,'{}')||coalesce(b.required_tools,'{}')||coalesce(b.required_vehicles,'{}'),' ')) collate pg_catalog."sr-Latn-RS-x-icu"),query_text)>0)
 ), qualified as materialized (
  select s.*,(wanted is null or days[1]<=wanted[2] and days[2]>=wanted[1]) is true as time_ok,
   case when scope_mode='ALL' then true when not has_point then false when scope_mode='AREA' then
    approximate_lat between south and north and (west<=east and approximate_lng between west and east or west>east and (approximate_lng>=west or approximate_lng<=east))
    else approximate_lat=point_lat and approximate_lng=point_lng end as in_area
  from shared s
 ), scoped as materialized (
  select q.*,case when scope_mode in ('AREA','POINT_LIST') and not has_point then 1 else 0 end as section
  from qualified q where in_area or not has_point and scope_mode in ('AREA','POINT_LIST')
 ), page as materialized (
  select * from scoped where time_ok and (before_id is null or section>before_section or section=before_section and (published_at,id)<(before_at,before_id))
  order by section,published_at desc,id desc limit page_limit+1
 ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as (
  select s.section,s.published_at,s.id,jsonb_build_object(
   'id',s.id,'revision',s.revision,'sortAt',to_char(s.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedAt',s.published_at,'title',s.title,'category',s.category,'status',s.status,'urgent',s.urgent,
   'scheduleKind',s.schedule_kind,'startsAt',s.starts_at,'endsAt',s.ends_at,'executionLocationMode',s.execution_location_mode,
   'taskCountryCode',s.task_country_code,'taskTimezone',s.task_timezone,'verifiedIdentityRequired',s.verified_identity_required,
   'approximateCity',nullif(btrim(s.approximate_city),''),'approximateArea',nullif(btrim(s.approximate_area),''),
   'pin',case when not s.has_point then null else jsonb_build_object('lat',s.approximate_lat,'lng',s.approximate_lng,'precision','COARSE_1KM') end,
   'requiredSlots',s.required_slots,'coveredSlots',s.covered_now,'requiredSkills',to_jsonb(s.required_skills),'requiredTools',to_jsonb(s.required_tools),
   'requiredVehicles',to_jsonb(s.required_vehicles),'requiredLicenses',to_jsonb(s.required_licenses),'minimumExperienceYears',s.minimum_experience_years,
   'priceMode',s.mode,'requesterPriceRsd',s.requester_price_rsd,'priceBasis',s.price_basis,'requesterProfileId',s.requester_profile_id,
   'responseDeadline',s.response_deadline,'acceptsApplications',s.required_slots>s.covered_now and (s.response_deadline is null or s.response_deadline>now_at),
   'publicTopology',(select g.public_topology from public.need_geography g where g.need_id=s.id),
   'criticalConditions',(select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id=s.id)) as item from shown s
 ) select jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'items',coalesce((select jsonb_agg(item order by section,published_at desc,id desc) from projected),'[]'::jsonb),
  'hasMore',(select count(*)>page_limit from page),
  'nextCursor',case when (select count(*)>page_limit from page) then (select jsonb_build_object('scopeKey',scope_key,'section',section,
   'sortAt',to_char(published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'id',id) from shown order by section desc,published_at,id limit 1) else null end,
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,
   'mapped',case when scope_mode='POINT_MEMBERS' then (select count(*) from scoped where time_ok) else (select count(*) from qualified where time_ok) end,
   'listed',(select count(*) from scoped where time_ok),'inArea',(select count(*) from scoped where time_ok and in_area),
   'withoutPoint',(select count(*) from scoped where time_ok and section=1),
   'undated',(select count(*) from scoped where wanted is not null and days is null)),
  'availability',jsonb_build_object('hasKnownWorkMode',exists(select 1 from base where execution_location_mode is not null),
   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes))) into result;
 if request_mode='EXACT_PUBLIC' then return result-array['anchor','filterKey','counts','availability']; end if;
 return result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
 raise exception 'P6_INVALID_REQUEST' using errcode='22023';
end $f$;



GRANT EXECUTE ON FUNCTION public.rpc_discovery_v1(jsonb) TO authenticated, service_role;


-- --- rpc_get_worker_execution_modes ---
CREATE OR REPLACE FUNCTION public.rpc_get_worker_execution_modes(
 p_worker_profile_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog
AS $fn$
DECLARE v_account uuid:=auth.uid(); v_profile public.app_profiles; v_modes text[]; v_at timestamptz;
BEGIN
 IF v_account IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
 SELECT p.* INTO v_profile FROM public.app_profiles p
 WHERE p.id=p_worker_profile_id AND p.account_id=v_account AND p.kind='WORKER';
 IF NOT FOUND THEN RAISE EXCEPTION 'WORKER_PROFILE_NOT_OWNED' USING errcode='42501'; END IF;
 SELECT m.modes,m.confirmed_at INTO v_modes,v_at
 FROM private.worker_execution_mode_choices m
 WHERE m.worker_profile_id=p_worker_profile_id AND m.worker_account_id=v_account;
 RETURN jsonb_build_object('workerProfileId',p_worker_profile_id,'modes',to_jsonb(coalesce(v_modes,ARRAY[]::text[])),
  'confirmed',v_at IS NOT NULL,'confirmedAt',v_at,
  'matchingAuthority','NONE','notificationAuthority','NONE');
END $fn$;;


-- --- rpc_get_my_task_relations ---
create or replace function public.rpc_get_my_task_relations(p_need_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_need_ids is null or cardinality(p_need_ids) < 1 or cardinality(p_need_ids) > 100
     or array_position(p_need_ids, null) is not null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(x.item order by x.need_id), '[]'::jsonb) into v_items
  from (
    select n.id as need_id, jsonb_build_object(
        'needId', n.id, 'relation', 'OWNER',
        'applicationId', null, 'applicationState', null, 'agreementId', null) as item
      from public.needs n
     where n.id = any(p_need_ids)
       and n.requester_account_id = v_uid
    union all
    -- The newest application that was ever sent; a DRAFT was never sent and is nobody's relation.
    select mine.need_id, jsonb_build_object(
        'needId', mine.need_id, 'relation', 'APPLIED',
        'applicationId', mine.application_id,
        'applicationState', private.my_application_state(
          mine.raw_status, mine.submitted_revision, mine.current_revision, mine.need_status, mine.agreement_id is not null),
        'agreementId', mine.agreement_id) as item
      from (
        select distinct on (r.need_id)
          r.need_id, r.id as application_id, r.status as raw_status,
          r.submitted_against_need_revision as submitted_revision,
          n.revision as current_revision, n.status as need_status,
          (select a.id from public.agreements a
            where a.selected_response_id = r.id
            order by a.created_at desc, a.id desc limit 1) as agreement_id
        from public.marketplace_responses r
        join public.needs n on n.id = r.need_id
        where r.need_id = any(p_need_ids)
          and r.worker_account_id = v_uid
          and r.status <> 'DRAFT'
          and n.requester_account_id <> v_uid
        order by r.need_id, r.created_at desc, r.id desc
      ) mine
  ) x;

  return jsonb_build_object('items', v_items, 'asOf', statement_timestamp());
end
$function$;;


GRANT EXECUTE ON FUNCTION public.rpc_get_my_task_relations TO authenticated, service_role;


-- --- rpc_read_safety_target ---
create or replace function public.rpc_read_safety_target(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare v_actor uuid := auth.uid(); v_profile public.app_profiles; v_block private.account_blocks;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_profile_id is null then raise exception 'SAFETY_TARGET_INPUT_INVALID' using errcode='22023'; end if;
 -- Exactly the visibility of rpc_get_public_profile: anything it hides has no safety target either.
 select p.* into v_profile from public.app_profiles p
  where p.id=p_profile_id and p.profile_status='ACTIVE' and p.kind in ('REQUESTER','WORKER');
 if not found or v_profile.account_id=v_actor then return null; end if;
 if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
 if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
 if not private.accounts_same_world(v_actor,v_profile.account_id) then return null; end if;
 -- The caller's own outgoing choice only. An incoming block is never disclosed; a block in either
 -- direction has already returned null above, so a returned target is never an active block.
 select * into v_block from private.account_blocks
  where blocker_account_id=v_actor and blocked_account_id=v_profile.account_id;
 return jsonb_build_object('profileId',v_profile.id,'accountId',v_actor,'targetAccountId',v_profile.account_id,
  'blocked',coalesce(v_block.active,false),'revision',coalesce(v_block.revision,0),'authoritative',true);
end;
$function$;;


GRANT EXECUTE ON FUNCTION public.rpc_read_safety_target TO authenticated, service_role;


-- --- rpc_read_task ---
CREATE OR REPLACE FUNCTION public.rpc_read_task(p_need_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  -- RLS remains the authority for the task and all embedded relations.
  -- Composite computed fields receive ONLY an ID, never a whole-row reference.
  select jsonb_build_object(
    'id', n.id,
    'requester_profile_id', n.requester_profile_id,
    'status', n.status,
    'title', n.title,
    'description', n.description,
    'category', n.category,
    'approximate_city', n.approximate_city,
    'approximate_area', n.approximate_area,
    'approximate_lat', n.approximate_lat,
    'approximate_lng', n.approximate_lng,
    'schedule_kind', n.schedule_kind,
    'starts_at', n.starts_at,
    'ends_at', n.ends_at,
    'required_slots', n.required_slots,
    'mode', n.mode,
    'requester_price_rsd', n.requester_price_rsd,
    'required_skills', n.required_skills,
    'required_tools', n.required_tools,
    'required_vehicles', n.required_vehicles,
    'verified_identity_required', n.verified_identity_required,
    'urgent', n.urgent,
    'public_photo_paths', n.public_photo_paths,
    'revision', n.revision,
    'published_at', n.published_at,
    'created_at', n.created_at,
    'updated_at', n.updated_at,
    'response_deadline', n.response_deadline,
    'urgent_activated_at', n.urgent_activated_at,
    'urgent_expires_at', n.urgent_expires_at,
    'urgent_policy_version', n.urgent_policy_version,
    'minimum_experience_years', n.minimum_experience_years,
    'execution_location_mode', n.execution_location_mode,
    'required_licenses', n.required_licenses,
    'remaining_search_closed_at', n.remaining_search_closed_at,
    'task_country_code', n.task_country_code,
    'task_timezone', n.task_timezone,
    'price_basis', n.price_basis,
    'covered_slots', public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', n.id))),
    'selectable_application_count', public.selectable_application_count(jsonb_populate_record(null::public.needs, jsonb_build_object('id', n.id))),
    'marketplace_responses', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id) order by r.id), '[]'::jsonb) from public.marketplace_responses r where r.need_id=n.id),
    'need_geography', (select jsonb_build_object('public_topology', g.public_topology) from public.need_geography g where g.need_id=n.id),
    'need_requirement_details', (select jsonb_build_object('critical_conditions', d.critical_conditions) from public.need_requirement_details d where d.need_id=n.id)
  ) into result from public.needs n where n.id=p_need_id;
  return result;
end;
$function$;;


GRANT EXECUTE ON FUNCTION public.rpc_read_task TO authenticated, service_role;


-- --- rpc_list_my_tasks ---
CREATE OR REPLACE FUNCTION public.rpc_list_my_tasks()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;
  -- The only elevated reader: no caller-supplied account; enumerate ONLY this account's own tasks.
  -- Its document reader omits internal account IDs, close reason and private location data.
  select coalesce(jsonb_agg(public.rpc_read_task(n.id) order by n.created_at desc, n.id desc), '[]'::jsonb)
    into result from public.needs n where n.requester_account_id=actor;
  return result;
end;
$function$;;


GRANT EXECUTE ON FUNCTION public.rpc_list_my_tasks TO authenticated, service_role;


-- --- rpc_list_my_needs_page ---
CREATE OR REPLACE FUNCTION public.rpc_list_my_needs_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;

  select coalesce(jsonb_agg(q.item order by q.created_at desc, q.id desc), '[]'::jsonb) into v_items
  from (
    select n.created_at, n.id, jsonb_build_object(
      'id', n.id, 'sortAt', n.created_at, 'revision', n.revision,
      'title', n.title, 'description', n.description, 'category', n.category, 'status', n.status,
      'urgent', n.urgent, 'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,
      'taskCountryCode', n.task_country_code, 'taskTimezone', n.task_timezone,
      'executionLocationMode', n.execution_location_mode,
      'approximateArea', n.approximate_area, 'approximateCity', n.approximate_city,
      -- covered_slots is the existing computed field public.covered_slots(needs), not a column.
      'requiredSlots', n.required_slots, 'coveredSlots', public.covered_slots(n),
      'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools),
      'requiredVehicles', to_jsonb(n.required_vehicles), 'requiredLicenses', to_jsonb(n.required_licenses),
      'minimumExperienceYears', n.minimum_experience_years,
      'verifiedIdentityRequired', n.verified_identity_required,
      'mode', n.mode, 'requesterPriceRsd', n.requester_price_rsd,
      'applicationCount', (select count(*) from public.marketplace_responses r where r.need_id = n.id),
      'publicTopology', (select g.public_topology from public.need_geography g where g.need_id = n.id),
      'criticalConditions', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)
    ) as item
    from public.needs n
    where n.requester_account_id = v_uid
      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (n.status in ('DRAFT','PUBLISHED','SELECTION','ACTIVE')))
      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))
    order by n.created_at desc, n.id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$
;;


GRANT EXECUTE ON FUNCTION public.rpc_list_my_needs_page TO authenticated, service_role;


-- --- rpc_get_my_agreement_review_v2 ---
create or replace function public.rpc_get_my_agreement_review_v2(p_agreement_id uuid) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $f$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews; own_review jsonb; own_comment text;
begin
 -- D12: the legacy context (same participant gate, same eligibility incl. the closure restriction, same tag catalog) plus the author's OWN comment inside the review and the comment policy.
 -- The presence of THIS function is the capability a new client tests; an older server answers PGRST202 and the client falls back to the legacy pair.
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 select * into r from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u;
 if found then
  select c.comment into own_comment from private.agreement_review_comments_v1 c where c.review_id=r.id;
  own_review:=private.review_receipt(r,false)||jsonb_build_object('comment',own_comment);
 end if;
 return jsonb_build_object('accountId',u,'agreementId',a.id,
 'targetAccountId',case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end,
 'eligible',own_review is null and not private.closure_account_restricted(u) and a.status='COMPLETED' and exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED'),
 'review',own_review,'tagCatalog',jsonb_build_object('version','PRE_V3_REVIEW_TAGS_V1','maxTags',3,'tags',to_jsonb(private.review_tag_catalog())),
 'commentPolicy',jsonb_build_object('supported',true,'maxLength',500,'version','REVIEW_COMMENT_V1'),
 'authoritative',true);
end;
$f$;;


GRANT EXECUTE ON FUNCTION public.rpc_get_my_agreement_review_v2 TO authenticated, service_role;


-- --- rpc_submit_agreement_review_v2 ---
create or replace function public.rpc_submit_agreement_review_v2(p_agreement_id uuid, p_target_account_id uuid, p_rating jsonb, p_tags jsonb, p_client_request_id uuid, p_comment jsonb default null) returns jsonb language plpgsql security definer set search_path = pg_catalog as $f$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews;
 rating_value numeric; tags_value text[]; h text; target_role text;
 comment_value text; comment_sha text; stored_comment text; stored_sha text;
begin
 -- D12: the legacy review command (same auth, validation order, locks, eligibility, star hash, audit row and REVIEW_RECEIVED event, byte for byte in behaviour) plus ONE optional comment
 -- that is stored in the SAME transaction as the stars and never later. The legacy function stays untouched and keeps serving every installed build.
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_agreement_id is null or p_target_account_id is null or p_target_account_id=u or p_client_request_id is null
 or jsonb_typeof(p_rating) is distinct from 'number' or length(p_rating::text)>30 then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 rating_value:=(p_rating#>>'{}')::numeric;
 if rating_value not between 1 and 5 or trunc(rating_value)<>rating_value then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 if jsonb_typeof(p_tags) is distinct from 'array' then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 if jsonb_array_length(p_tags)>3 or exists(select 1 from jsonb_array_elements(p_tags) t
  where jsonb_typeof(t.value)<>'string' or not (t.value#>>'{}'=any(private.review_tag_catalog()))) then
  raise exception 'REVIEW_TAGS_INVALID' using errcode='22023';
 end if;
 tags_value:=array(select t.value#>>'{}' from jsonb_array_elements(p_tags) t order by (t.value#>>'{}') collate "C");
 if not private.review_tags_valid(tags_value) then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 -- The star hash keeps the legacy formula exactly (so every stored hash and every replay through either function stays compatible); the comment is bound by its own digest in its own row.
 h:=encode(extensions.digest(jsonb_build_object('agreementId',p_agreement_id,'target',p_target_account_id,
  'rating',rating_value::integer,'tags',to_jsonb(tags_value))::text,'sha256'),'hex');
 comment_value:=private.review_comment_input_v1(p_comment);
 comment_sha:=case when comment_value is null then null else encode(extensions.digest(convert_to(comment_value,'UTF8'),'sha256'),'hex') end;
 -- Same successful command remains an immutable read, even after a later block.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-command:'||u::text||':'||p_client_request_id::text,9120));
 select * into r from private.agreement_reviews where reviewer_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  -- A comment that differs from the stored one (or one added to a stored star-only review) is another command under the same id.
  select c.comment,c.comment_sha256 into stored_comment,stored_sha from private.agreement_review_comments_v1 c where c.review_id=r.id;
  if stored_sha is distinct from comment_sha then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return private.review_receipt(r,true)||jsonb_build_object('comment',stored_comment);
 end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id) for share;
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 if p_target_account_id<>(case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end) then
  raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501';
 end if;
 if a.status<>'COMPLETED' or not exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED') then
  raise exception 'REVIEW_NOT_COMPLETED' using errcode='55000';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-agreement:'||a.id::text||':'||u::text,9120));
 if exists(select 1 from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u) then
  raise exception 'REVIEW_ALREADY_SUBMITTED' using errcode='55000';
 end if;
 -- A block cannot remove the counterpart's completed-work review entitlement (stars and comment alike; a refusal would reveal the block).
 -- P8 suppresses ordinary deliveries, including this event, for blocked pairs. The comment is hidden from readers while the pair is blocked, at read time.
 insert into private.agreement_reviews(agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash)
 values(a.id,u,p_target_account_id,rating_value::integer,tags_value,p_client_request_id,h) returning * into r;
 if comment_value is not null then
  insert into private.agreement_review_comments_v1(review_id,author_account_id,target_account_id,comment,comment_sha256,created_at)
  values(r.id,r.reviewer_account_id,r.target_account_id,comment_value,comment_sha,r.created_at);
 end if;
 perform private.audit_marketplace(u,'AGREEMENT_REVIEW_SUBMITTED','AGREEMENT',a.id,a.current_version,jsonb_build_object('reviewId',r.id));
 target_role:=case when u=a.requester_account_id then 'WORKER' else 'REQUESTER' end;
 perform private.emit_event(p_target_account_id,target_role,'REVIEW_RECEIVED','AGREEMENT',a.id,a.current_version,
  'Nova ocena','Dobili ste ocenu za zavr'||chr(353)||'en Dogovor.','agreement-review:'||r.id::text,'NORMAL','{}'::jsonb,null);
 return private.review_receipt(r,false)||jsonb_build_object('comment',comment_value);
end;
$f$;;


GRANT EXECUTE ON FUNCTION public.rpc_submit_agreement_review_v2 TO authenticated, service_role;


-- --- rpc_list_review_comments_v1 ---
create or replace function public.rpc_list_review_comments_v1(p_profile_id uuid, p_limit integer default 20, p_after jsonb default null) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $f$
declare v_actor uuid:=auth.uid(); v_profile public.app_profiles; v_limit integer; v_after_at timestamptz; v_after_id uuid; v_items jsonb; v_more boolean;
begin
 -- D12: the gated reader of the written comments ABOUT the person whose public profile is open. One paged, account-level list (a review is account-level reputation, both roles pooled);
 -- only reviews that carry a visible comment appear (a star-only review has no text row, but the public count and average still include it, so for a small count the rating of a star-only review can be inferred by subtraction from the
 -- listed ratings: an owner-visible consequence, README_D12_CANDIDATE.md); stars, the count and the average are never changed by anything here.
 -- DESIGN DEFAULT D-DEC-7 (the owner accepted the defaults of the design): ONE account-level list usable from both profile kinds, so the same reviewIds and texts appear under the REQUESTER and the WORKER profile of one person and each item names the role
 -- of its author: an observer who has seen both faces can LINK them by comparing lists. A role-scoped list is a function-only change (add: and the target role of the Agreement equals v_profile.kind) that needs no certificate move; it is NOT implemented here.
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_profile_id is null then raise exception 'PROFILE_ID_REQUIRED' using errcode='22023'; end if;
 v_limit:=least(greatest(coalesce(p_limit,20),1),50);
 if p_after is not null and jsonb_typeof(p_after)<>'null' then
  if jsonb_typeof(p_after)<>'object' or jsonb_typeof(p_after->'createdAt') is distinct from 'string' or jsonb_typeof(p_after->'reviewId') is distinct from 'string' then
   raise exception 'INVALID_PAGE' using errcode='22023';
  end if;
  begin
   v_after_at:=(p_after->>'createdAt')::timestamptz; v_after_id:=(p_after->>'reviewId')::uuid;
  exception when data_exception then raise exception 'INVALID_PAGE' using errcode='22023';
  end;
 end if;
 -- The gate stack of rpc_get_public_profile, in the same order and with the same safe failure: an ACTIVE profile only, closure-restricted viewer or subject, a blocked pair and another world all read as "nothing here".
 select p.* into v_profile from public.app_profiles p where p.id=p_profile_id and p.profile_status='ACTIVE' and p.kind in('REQUESTER','WORKER');
 if not found then return null; end if;
 if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
 if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
 if not private.accounts_same_world(v_actor,v_profile.account_id) then return null; end if;
 -- Read-time gating of every row: a hidden comment, an author under a closure restriction, a pair VIEWER/author that is blocked either way (the viewer-versus-subject pair is gated above), another world, or an author profile that is not ACTIVE is not listed.
 -- DELIBERATELY NO viewer-independent block gate: a block between the author and the reviewed person must NOT remove the comment for third viewers, otherwise either party could censor or re-publish the text for everybody by toggling a block (the author edit/delete path
 -- the owner forbade, through a side door). It still hides the text from the one person who blocked its author, because that person is the VIEWER here. Hiding for everyone is the audited moderation HIDE only.
 -- KNOWN CONSEQUENCE (owner-visible, NOT decided here): the block is symmetric, so when the AUTHOR blocks the reviewed person (or blocked them before writing) that person is the viewer of a blocked pair and no longer sees the comment
 -- about them (nor its agreementId, so they cannot report it from here), is not notified, and every third viewer still sees it; the block costs the author nothing and the only remedy is the audited service-role HIDE. Options: README_D12_CANDIDATE.md.
 -- No write-time refusal exists for any of this (it would reveal a block); the author's profile is the face of the Agreement role in which the review was written. The only place an account id can appear is inside avatarPath, exactly as rpc_get_public_profile returns it.
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.review_id desc),'[]'::jsonb) into v_items from (
  select c.created_at,c.review_id,
   jsonb_build_object('reviewId',c.review_id,'rating',rv.rating,'comment',c.comment,'createdAt',c.created_at,
    'agreementId',case when v_actor=c.target_account_id then rv.agreement_id else null end,
    'author',jsonb_build_object('profileId',ap.id,'role',ap.kind,'displayName',nullif(btrim(ap.display_name),''),'avatarPath',ap.avatar_path)) as item
  from private.agreement_review_comments_v1 c
  join private.agreement_reviews rv on rv.id=c.review_id
  join public.agreements ag on ag.id=rv.agreement_id
  join public.app_profiles ap on ap.id=case when ag.requester_account_id=c.author_account_id then ag.requester_profile_id else ag.worker_profile_id end
   and ap.account_id=c.author_account_id
  where c.target_account_id=v_profile.account_id and c.hidden_at is null
   and ap.profile_status='ACTIVE' and ap.kind in('REQUESTER','WORKER')
   and not private.closure_account_restricted(c.author_account_id)
   and not private.safety_pair_blocked(v_actor,c.author_account_id)
   and private.accounts_same_world(v_actor,c.author_account_id)
   and (v_after_at is null or (c.created_at,c.review_id)<(v_after_at,v_after_id))
  order by c.created_at desc,c.review_id desc
  limit v_limit+1
 ) x;
 v_more:=jsonb_array_length(v_items)>v_limit;
 if v_more then v_items:=v_items-v_limit; end if;
 return jsonb_build_object('profileId',v_profile.id,'items',v_items,'hasMore',v_more,
  'nextAfter',case when v_more then jsonb_build_object('createdAt',v_items->(v_limit-1)->'createdAt','reviewId',v_items->(v_limit-1)->'reviewId') else null end,
  'authoritative',true);
end;
$f$;;


GRANT EXECUTE ON FUNCTION public.rpc_list_review_comments_v1 TO authenticated, service_role;


-- --- rpc_mark_agreement_messages_read ---
CREATE OR REPLACE FUNCTION public.rpc_mark_agreement_messages_read(p_agreement_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_agreement_id is null then raise exception 'INVALID_AGREEMENT' using errcode = '22023'; end if;
  -- Only a party of this Dogovor may settle its notifications; anyone else is told what the workspace tells them.
  if not exists (select 1 from public.agreements a where a.id = p_agreement_id
                   and v_uid in (a.requester_account_id, a.worker_account_id)) then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- The same visibility rule as rpc_mark_activity_event_read: only an event with an in-app delivery counts.
  update public.user_activity_events e set read_at = statement_timestamp()
    where e.recipient_user_id = v_uid and e.entity_type = 'AGREEMENT' and e.entity_id = p_agreement_id
      and e.event_type = 'MESSAGE_RECEIVED' and not(e.payload ? 'group_message_id') and e.read_at is null
      and exists (select 1 from public.notification_deliveries visible
        where visible.event_id = e.id and visible.recipient_user_id = v_uid
          and visible.channel = 'IN_APP' and visible.state <> 'SUPPRESSED');
  get diagnostics v_count = row_count;
  return v_count;
end
$function$;


GRANT EXECUTE ON FUNCTION public.rpc_mark_agreement_messages_read TO authenticated, service_role;


-- --- rpc_list_my_agreements_page ---
CREATE OR REPLACE FUNCTION public.rpc_list_my_agreements_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
  v_restricted boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  -- EX-04 S3 (RC-03): whether MY rating of a finished Dogovor is still due is part of the page, so the client never has to ask once per Dogovor. It is exactly the answer of
  -- rpc_get_my_agreement_review(...).eligible: no review of mine yet, my account is not under a closure restriction, and the Dogovor and its execution are COMPLETED.
  v_restricted := private.closure_account_restricted(v_uid);
  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), '[]'::jsonb) into v_items
  from (
    select a.created_at, a.id,
      jsonb_build_object(
        'id', a.id, 'sortAt', a.created_at,
        'currentVersion', a.current_version,
        'status', coalesce(ae.state, a.status),
        'agreementStatus', a.status,
        'title', n.title,
        'approximateArea', n.approximate_area,
        'approximateCity', n.approximate_city,
        'requiredSlots', n.required_slots,
        'startsAt', n.starts_at,
        'terms', av.terms,
        'requesterAccountId', a.requester_account_id,
        'workerAccountId', a.worker_account_id, 'requesterProfileId', a.requester_profile_id, 'workerProfileId', a.worker_profile_id,
        'requesterName', rp.display_name,
        'workerName', wp.display_name,
        'executionMode', ae.mode,
        'requesterDeadlineAt', ae.requester_deadline_at,
        'problemOpened', (ae.problem_opened_at is not null),
        'myPhoneShared', exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_by_account_id = v_uid
             and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at) and (g.expires_at is null or g.expires_at > statement_timestamp())),
        'theirPhone', case
          when a.status = 'CONFIRMED' and exists (
            select 1 from public.access_grants g
             where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_to_account_id = v_uid
               and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at) and (g.expires_at is null or g.expires_at > statement_timestamp())
          ) then (
            select nullif(btrim(acc.phone), '') from public.app_accounts acc
             where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end)
          else null
        end,
        'pendingChange', (
          select jsonb_build_object('id', c.id, 'proposedByMe', c.proposed_by_account_id = v_uid, 'createdAt', c.created_at)
            from public.agreement_change_proposals c
           where c.agreement_id = a.id and c.status = 'PENDING'
           order by c.created_at desc, c.id desc
           limit 1),
        'createdAt', a.created_at,
        'ratingDue', coalesce(a.status = 'COMPLETED' and ae.state = 'COMPLETED' and not v_restricted
          and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid), false)
      ) as payload
    from public.agreements a
    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
    where v_uid in (a.requester_account_id, a.worker_account_id)
      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))
      and (p_before_at is null or (a.created_at, a.id) < (p_before_at, p_before_id))
    order by a.created_at desc, a.id desc
    limit p_limit + 1
  ) x;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;
do $postflight$
declare e record; actual text; meta text;
begin
 for e in select * from jsonb_to_recordset('[{"signature": "public.rpc_get_agreement_workspace(uuid)", "body_md5": "0eb9b60cf7a52bdef85d8dc166690e0b"}, {"signature": "public.rpc_list_my_agreements()", "body_md5": "06489ae3fe13b822cb3d026381ac3899"}, {"signature": "public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)", "body_md5": "02c73cc4db95c2198f54888d7a377003"}]'::jsonb) as x(signature text, body_md5 text) loop
  select md5(p.prosrc) into actual from pg_proc p where p.oid=to_regprocedure(e.signature);
  if actual is distinct from e.body_md5 then
   raise exception 'R01_READBACK_MISMATCH: %',e.signature;
  end if;
 end loop;
 select (select coalesce(jsonb_agg(jsonb_build_object(
 'oid',p.oid,'signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl::text,
 'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'language',p.prolang,
 'config',p.proconfig,'args',p.proargtypes::text,'result',p.prorettype)
 order by p.oid::regprocedure::text),'[]'::jsonb)::text
 from pg_proc p where p.oid in (to_regprocedure('public.rpc_get_agreement_workspace(uuid)'),to_regprocedure('public.rpc_list_my_agreements()'),to_regprocedure('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'))) into meta;
 if meta is distinct from current_setting('uskoci.r01_metadata') then
  raise exception 'R01_METADATA_CHANGED';
 end if;
 if private.closure_erasure_program_digest_v5() is distinct from current_setting('uskoci.r01_closure_program_digest') then
  raise exception 'R01_CLOSURE_PROGRAM_DIGEST_CHANGED';
 end if;
 if not coalesce(private.retention_ai_source_ready(),false) then
  raise exception 'R01_CLOSURE_SOURCE_NOT_READY_AFTER';
 end if;
end;
$postflight$;
commit;;


GRANT EXECUTE ON FUNCTION public.rpc_list_my_agreements_page TO authenticated, service_role;
