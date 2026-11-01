// Test-source metadata only, captured READ ONLY on 2026-11-01; no business data.
// Exact current Discovery bodies; the consumer declares the isolated collation substitute.
// No DEV grant changes, live Auth/PostgREST, PostGIS or full R01 admission is implied.
export const discoverySnapshot = {
  "project_ref": "leqcwgzvjsxugfgzdmth",
  "current_reader_metadata_captured_at": "2026-11-01T16:56:40.19741+00:00",
  "helper_metadata_captured_at": "2026-11-01 17:02:40.104653+00",
  "source": "READ ONLY system catalogs, no application/Auth rows or application function invocation",
  "current_reader_policies": [
    {
      "cmd": "SELECT",
      "qual": "(EXISTS ( SELECT 1\n   FROM public.needs n\n  WHERE ((n.id = need_geography.need_id) AND (n.status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])))))",
      "roles": [
        "authenticated"
      ],
      "tablename": "need_geography",
      "permissive": "PERMISSIVE",
      "policyname": "need_geography_market_read",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "(EXISTS ( SELECT 1\n   FROM public.needs n\n  WHERE ((n.id = need_geography.need_id) AND public.is_my_task(n.id))))",
      "roles": [
        "authenticated"
      ],
      "tablename": "need_geography",
      "permissive": "PERMISSIVE",
      "policyname": "need_geography_owner_read",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "public.rpc_storage_account_open()",
      "roles": [
        "authenticated"
      ],
      "tablename": "need_geography",
      "permissive": "RESTRICTIVE",
      "policyname": "v5_closed_account_visibility",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "(EXISTS ( SELECT 1\n   FROM public.needs n\n  WHERE ((n.id = need_requirement_details.need_id) AND (n.status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])))))",
      "roles": [
        "authenticated"
      ],
      "tablename": "need_requirement_details",
      "permissive": "PERMISSIVE",
      "policyname": "need_requirement_details_market_read",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "(EXISTS ( SELECT 1\n   FROM public.needs n\n  WHERE ((n.id = need_requirement_details.need_id) AND public.is_my_task(n.id))))",
      "roles": [
        "authenticated"
      ],
      "tablename": "need_requirement_details",
      "permissive": "PERMISSIVE",
      "policyname": "need_requirement_details_owner_read",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "public.rpc_storage_account_open()",
      "roles": [
        "authenticated"
      ],
      "tablename": "need_requirement_details",
      "permissive": "RESTRICTIVE",
      "policyname": "v5_closed_account_visibility",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "tablename": "needs",
      "permissive": "PERMISSIVE",
      "policyname": "needs_owner_insert",
      "schemaname": "public",
      "with_check": "((requester_account_id = auth.uid()) AND (status = 'DRAFT'::text))"
    },
    {
      "cmd": "SELECT",
      "qual": "(requester_account_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "tablename": "needs",
      "permissive": "PERMISSIVE",
      "policyname": "needs_owner_select",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "qual": "((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))",
      "roles": [
        "authenticated"
      ],
      "tablename": "needs",
      "permissive": "PERMISSIVE",
      "policyname": "needs_owner_update",
      "schemaname": "public",
      "with_check": "((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))"
    },
    {
      "cmd": "SELECT",
      "qual": "rls_private.need_participant_can_read(id)",
      "roles": [
        "authenticated"
      ],
      "tablename": "needs",
      "permissive": "PERMISSIVE",
      "policyname": "needs_participant_read",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[])))))",
      "roles": [
        "authenticated"
      ],
      "tablename": "needs",
      "permissive": "PERMISSIVE",
      "policyname": "needs_public_discovery",
      "schemaname": "public",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "qual": "( SELECT public.rpc_storage_account_open() AS rpc_storage_account_open)",
      "roles": [
        "authenticated"
      ],
      "tablename": "needs",
      "permissive": "RESTRICTIVE",
      "policyname": "v5_closed_account_visibility",
      "schemaname": "public",
      "with_check": null
    }
  ],
  "prior_fixture_current_body_hashes": [
    {
      "signature": "public.covered_slots(public.needs)",
      "body_md5": "ac09f84c85ff8ae237c8db463a43d547"
    },
    {
      "signature": "public.is_my_task(uuid)",
      "body_md5": "42b6802d2f3114d1e211025c4c475e55"
    },
    {
      "signature": "public.rpc_close_remaining_search(uuid,integer,text,text)",
      "body_md5": "39fa830132d714a1cc61d3bba73d5cec"
    },
    {
      "signature": "public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)",
      "body_md5": "dad1de3234e72d4e2f44be5e920eda61"
    },
    {
      "signature": "public.rpc_list_my_tasks()",
      "body_md5": "2a8ff0fa8a1211414e5e1fc69c6fb4f7"
    },
    {
      "signature": "public.rpc_read_task(uuid)",
      "body_md5": "1e01db5140248f27ab374187f01fded3"
    },
    {
      "signature": "public.rpc_storage_account_open()",
      "body_md5": "7350621ef256678e209aa6a28c79b58b"
    },
    {
      "signature": "public.selectable_application_count(public.needs)",
      "body_md5": "fe53442f8b661d6f33d22a54e2a468a8"
    },
    {
      "signature": "rls_private.need_participant_can_read(uuid)",
      "body_md5": "c23e2bbab829ad716435e56862a495b6"
    },
    {
      "signature": "rls_private.p6_discovery_test_world_accounts()",
      "body_md5": "6193869dd532dbe5d2723c078940d10e"
    }
  ],
  "functions": [
    {
      "signature": "public.p6_discovery_trim(text)",
      "body_md5": "40109e93b620146aa8d536907d28c91b",
      "definer": false,
      "config": [
        "search_path=pg_catalog"
      ],
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "definition": "CREATE OR REPLACE FUNCTION public.p6_discovery_trim(value text)\n RETURNS text\n LANGUAGE sql\n IMMUTABLE\n SET search_path TO 'pg_catalog'\nAS $function$\n select btrim(value, U&'\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF')\n$function$\n"
    },
    {
      "signature": "public.p6_discovery_unquote(text)",
      "body_md5": "d9ab01e57fb2f667ee865f69aa246741",
      "definer": false,
      "config": [
        "search_path=pg_catalog"
      ],
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "definition": "CREATE OR REPLACE FUNCTION public.p6_discovery_unquote(value text)\n RETURNS text\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;\nbegin\n if length(t)>1 then\n  a:=left(t,1); b:=right(t,1);\n  if (a,b) in (('\"','\"'),('„','“'),('“','”'),('''','''')) then\n   inner_text:=substr(t,2,length(t)-2);\n   if inner_text !~ '[\"„“”]' and (a<>'''' or strpos(inner_text,'''')=0) then\n    return nullif(public.p6_discovery_trim(inner_text),'');\n   end if;\n  end if;\n end if;\n return nullif(t,'');\nend $function$\n"
    },
    {
      "signature": "public.p6_discovery_area(text,text,boolean)",
      "body_md5": "65f41c2ec10d1bb926f34ecf04b36ec4",
      "definer": false,
      "config": [
        "search_path=pg_catalog"
      ],
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "definition": "CREATE OR REPLACE FUNCTION public.p6_discovery_area(area text, city text, remote boolean)\n RETURNS text\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);\nbegin\n if remote then return 'Na daljinu'; end if;\n if a is null then return coalesce(c,'Lokacija nije navedena'); end if;\n if c is null or exists(select 1 from unnest(string_to_array(a,',')) s\n   where lower(public.p6_discovery_trim(s) collate pg_catalog.\"sr-Latn-RS-x-icu\")=lower(c collate pg_catalog.\"sr-Latn-RS-x-icu\")) then return a; end if;\n return a||', '||c;\nend $function$\n"
    },
    {
      "signature": "public.p6_discovery_civil(text)",
      "body_md5": "cee687f43419dfb2fa9cc9233e8bea34",
      "definer": false,
      "config": [
        "search_path=pg_catalog"
      ],
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "definition": "CREATE OR REPLACE FUNCTION public.p6_discovery_civil(value text)\n RETURNS boolean\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare y integer; m integer; d integer; last_day integer;\nbegin\n if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;\n y:=left(value,4)::integer; m:=substr(value,6,2)::integer; d:=right(value,2)::integer;\n if m<1 or m>12 then return false; end if;\n last_day:=(array[31,case when y%4=0 and (y%100<>0 or y%400=0) then 29 else 28 end,31,30,31,30,31,31,30,31,30,31])[m];\n return d between 1 and last_day;\nend $function$\n"
    },
    {
      "signature": "public.p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone)",
      "body_md5": "e1c81ce573875504d60e025c07573ee6",
      "definer": false,
      "config": [
        "search_path=pg_catalog"
      ],
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "definition": "CREATE OR REPLACE FUNCTION public.p6_discovery_days(kind text, starts timestamp with time zone, ends timestamp with time zone, zone text, anchor_at timestamp with time zone)\n RETURNS text[]\n LANGUAGE plpgsql\n STABLE\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare first_day text; last_day text; today date; instant timestamptz; local_time timestamp; z text:=coalesce(zone,'UTC');\nbegin\n if starts is not null and isfinite(starts) then\n  first_day:=to_char(date_trunc('milliseconds',starts) at time zone z,'YYYY-MM-DD');\n end if;\n if ends is not null and isfinite(ends) then\n  instant:=date_trunc('milliseconds',ends); local_time:=instant at time zone z;\n  if to_char(local_time,'HH24:MI:SS')='00:00:00' then instant:=instant-interval '1 millisecond'; end if;\n  last_day:=to_char(instant at time zone z,'YYYY-MM-DD');\n end if;\n if first_day is not null then return array[first_day,case when last_day>=first_day then last_day when kind='FIXED_WINDOW' then first_day else '9999-12-31' end]; end if;\n if last_day is not null then return case when kind='FIXED_WINDOW' then null else array['0000-01-01',last_day] end; end if;\n today:=(anchor_at at time zone z)::date;\n return case kind\n  when 'TODAY_FLEXIBLE' then array[today::text,today::text]\n  when 'TOMORROW_FLEXIBLE' then array[(today+1)::text,(today+1)::text]\n  when 'WEEK_FLEXIBLE' then array[today::text,(today+(7-extract(isodow from today)::integer))::text]\n  when 'FLEXIBLE' then array['0000-01-01','9999-12-31']\n  when 'REMOTE_ANYTIME' then array['0000-01-01','9999-12-31'] else null end;\nexception when invalid_parameter_value or datetime_field_overflow then return null;\nend $function$\n"
    },
    {
      "signature": "public.p6_discovery_key(text)",
      "body_md5": "ebfe1252f1798d89bbffb35b6eef6167",
      "definer": false,
      "config": [
        "search_path=pg_catalog"
      ],
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "definition": "CREATE OR REPLACE FUNCTION public.p6_discovery_key(value text)\n RETURNS text\n LANGUAGE sql\n IMMUTABLE\n SET search_path TO 'pg_catalog'\nAS $function$\n select lower(regexp_replace(public.p6_discovery_trim(value),U&'[\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF]+',' ','g') collate pg_catalog.\"sr-Latn-RS-x-icu\")\n$function$\n"
    },
    {
      "signature": "public.rpc_discovery_v1(jsonb)",
      "definer": false,
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_discovery_v1(p_request jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n r jsonb:=p_request; f jsonb; a jsonb; scope jsonb; cursor_doc jsonb; result jsonb;\n query_text text; locality text; price text; location_mode text; when_mode text; scope_mode text; request_mode text;\n filter_key text; scope_key text; need_id uuid; people integer; page_limit integer;\n now_at timestamptz:=statement_timestamp(); time_at timestamptz; through_at timestamptz; expires_at timestamptz;\n before_at timestamptz; before_id uuid; before_section integer;\n west numeric; south numeric; east numeric; north numeric; point_lat numeric; point_lng numeric;\n range_from text; range_to text; iso_pattern text:='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$';\nbegin\n if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n if jsonb_typeof(r) is distinct from 'object' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;\n request_mode:=r->>'mode';\n if request_mode='EXACT_PUBLIC' then\n  if r-array['mode','needId']<>'{}' or not(r?&array['mode','needId']) or jsonb_typeof(r->'needId')<>'string'\n    or r->>'needId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;\n  need_id:=(r->>'needId')::uuid; time_at:=now_at; through_at:=now_at; page_limit:=1;\n  f:='{\"text\":\"\",\"price\":\"all\",\"where\":\"any\",\"places\":1,\"when\":\"any\",\"dates\":null,\"place\":null}';\n  scope:='{\"kind\":\"ALL\"}';\n elsif request_mode='PAGE' then\n  if r-array['mode','filter','anchor','scope','limit','after']<>'{}' or not(r?&array['mode','filter','anchor','scope','limit','after'])\n    or jsonb_typeof(r->'limit')<>'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)\n    or (r->>'limit')::numeric not between 1 and 100 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;\n  page_limit:=(r->>'limit')::integer; f:=r->'filter'; scope:=r->'scope';\n else raise exception 'P6_MODE_NOT_IMPLEMENTED' using errcode='22023'; end if;\n if jsonb_typeof(f) is distinct from 'object' or f-array['text','price','where','places','when','dates','place']<>'{}'\n   or not(f?&array['text','price','where','places','when','dates','place'])\n   or jsonb_typeof(f->'text')<>'string' or octet_length(f->>'text')>16000\n   or coalesce(f->>'price','') not in ('all','MY_PRICE','OFFERS') or coalesce(f->>'where','') not in ('any','onsite','remote')\n   or coalesce(f->>'when','') not in ('any','today','tomorrow','week','weekend','next7')\n   or jsonb_typeof(f->'places')<>'number' or (f->>'places')::numeric<>trunc((f->>'places')::numeric)\n   or (f->>'places')::numeric not between 1 and 10 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;\n query_text:=lower(public.p6_discovery_trim(f->>'text') collate pg_catalog.\"sr-Latn-RS-x-icu\");\n price:=f->>'price'; location_mode:=f->>'where'; people:=(f->>'places')::integer; when_mode:=f->>'when';\n if f->'dates'<>'null'::jsonb then\n  if jsonb_typeof(f->'dates')<>'object' or (f->'dates')-array['from','to']<>'{}'\n    or not public.p6_discovery_civil(f#>>'{dates,from}') or not public.p6_discovery_civil(f#>>'{dates,to}')\n    or f#>>'{dates,from}'>f#>>'{dates,to}' then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;\n  range_from:=f#>>'{dates,from}'; range_to:=f#>>'{dates,to}'; when_mode:='any';\n end if;\n if f->'place'<>'null'::jsonb then\n  if jsonb_typeof(f->'place')<>'string' or octet_length(f->>'place')>16000 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;\n  locality:=nullif(public.p6_discovery_key(f->>'place'),'');\n end if;\n if location_mode='remote' then locality:=null; scope:='{\"kind\":\"ALL\"}'; end if;\n f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,\n   'dates',case when range_from is null then null else jsonb_build_object('from',range_from,'to',range_to) end,'place',locality);\n filter_key:=md5(f::text);\n if request_mode='PAGE' then\n  if r->'anchor'='null'::jsonb then\n   if r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;\n   time_at:=now_at; through_at:=now_at; expires_at:=now_at+interval '30 minutes';\n  else\n   a:=r->'anchor';\n   if jsonb_typeof(a)<>'object' or a-array['version','filterKey','timeAt','publishedThrough','expiresAt']<>'{}'\n     or not(a?&array['version','filterKey','timeAt','publishedThrough','expiresAt'])\n     or a->>'version' is distinct from 'DISCOVERY_V1' or a->>'filterKey' is distinct from filter_key\n     or coalesce(a->>'timeAt','')!~iso_pattern or coalesce(a->>'publishedThrough','')!~iso_pattern or coalesce(a->>'expiresAt','')!~iso_pattern\n     then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;\n   time_at:=(a->>'timeAt')::timestamptz; through_at:=(a->>'publishedThrough')::timestamptz; expires_at:=(a->>'expiresAt')::timestamptz;\n   if not isfinite(time_at) or time_at>now_at or through_at<>time_at or expires_at<>time_at+interval '30 minutes' then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;\n   if expires_at<=now_at then raise exception 'P6_ANCHOR_EXPIRED' using errcode='22023'; end if;\n  end if;\n end if;\n if jsonb_typeof(scope) is distinct from 'object' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n scope_mode:=scope->>'kind';\n if scope_mode='ALL' then\n  if scope-array['kind']<>'{}' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n elsif scope_mode='AREA' then\n  if scope-array['kind','bounds']<>'{}' or jsonb_typeof(scope->'bounds') is distinct from 'array' or jsonb_array_length(scope->'bounds')<>4\n    or exists(select 1 from jsonb_array_elements(scope->'bounds') x where jsonb_typeof(x)<>'number') then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n  west:=(scope#>>'{bounds,0}')::numeric; south:=(scope#>>'{bounds,1}')::numeric; east:=(scope#>>'{bounds,2}')::numeric; north:=(scope#>>'{bounds,3}')::numeric;\n  if abs(west)>180 or abs(east)>180 or south< -90 or north>90 or south>north then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n  scope:=jsonb_build_object('kind',scope_mode,'bounds',jsonb_build_array(west::double precision,south::double precision,east::double precision,north::double precision));\n elsif scope_mode in ('POINT_LIST','POINT_MEMBERS') then\n  if scope-array['kind','point']<>'{}' or jsonb_typeof(scope->'point') is distinct from 'object' or (scope->'point')-array['lat','lng']<>'{}'\n    or jsonb_typeof(scope#>'{point,lat}') is distinct from 'number' or jsonb_typeof(scope#>'{point,lng}') is distinct from 'number' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n  point_lat:=(scope#>>'{point,lat}')::numeric; point_lng:=(scope#>>'{point,lng}')::numeric;\n  if abs(point_lat)>90 or abs(point_lng)>180 or round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n  scope:=jsonb_build_object('kind',scope_mode,'point',jsonb_build_object('lat',point_lat::double precision,'lng',point_lng::double precision));\n else raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;\n scope_key:=md5(jsonb_build_object('filterKey',filter_key,'scope',scope,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'))::text);\n cursor_doc:=r->'after';\n if request_mode='PAGE' and cursor_doc<>'null'::jsonb then\n  if jsonb_typeof(cursor_doc)<>'object' or cursor_doc-array['scopeKey','section','sortAt','id']<>'{}'\n    or not(cursor_doc?&array['scopeKey','section','sortAt','id']) or cursor_doc->>'scopeKey' is distinct from scope_key\n    or cursor_doc->'section' not in ('0'::jsonb,'1'::jsonb) or coalesce(cursor_doc->>'sortAt','')!~iso_pattern\n    or coalesce(cursor_doc->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'\n    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;\n  before_at:=(cursor_doc->>'sortAt')::timestamptz; before_id:=(cursor_doc->>'id')::uuid; before_section:=(cursor_doc->>'section')::integer;\n  if before_at>through_at or (scope_mode in ('ALL','POINT_MEMBERS') and before_section<>0) then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;\n end if;\n with base as materialized (\n  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,\n   n.task_country_code,n.task_timezone,n.verified_identity_required,n.approximate_city,n.approximate_area,n.approximate_lat,n.approximate_lng,\n   n.required_slots,n.required_skills,n.required_tools,n.required_vehicles,n.required_licenses,n.minimum_experience_years,n.mode,\n   n.requester_price_rsd,n.price_basis,n.requester_profile_id,n.response_deadline,\n   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,\n   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,\n   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,\n   case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,\n   (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today\n  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null\n   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode='PAGE' and n.published_at<=through_at)\n ), shared as materialized (\n  select b.*,case when range_from is not null then array[range_from,range_to] else case when_mode\n   when 'today' then array[today::text,today::text] when 'tomorrow' then array[(today+1)::text,(today+1)::text]\n   when 'week' then array[today::text,(today+7-extract(isodow from today)::integer)::text]\n   when 'next7' then array[today::text,(today+6)::text]\n   when 'weekend' then array[(today+greatest(0,6-extract(isodow from today)::integer))::text,(today+7-extract(isodow from today)::integer)::text] else null end end as wanted\n  from base b where (price='all' or b.mode=price)\n   and (location_mode='any' or location_mode='remote' and b.execution_location_mode='REMOTE'\n     or location_mode='onsite' and b.execution_location_mode is not null and b.execution_location_mode<>'REMOTE')\n   and (people=1 or greatest(0,coalesce(nullif(b.required_slots,0),1)-coalesce(b.covered_now,0))>=people)\n   and (locality is null or b.execution_location_mode is distinct from 'REMOTE' and public.p6_discovery_key(b.area_text)=locality\n     and public.p6_discovery_key(b.area_text) not in ('na daljinu','lokacija nije navedena'))\n   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text||' '||array_to_string(coalesce(b.required_skills,'{}')||coalesce(b.required_tools,'{}')||coalesce(b.required_vehicles,'{}'),' ')) collate pg_catalog.\"sr-Latn-RS-x-icu\"),query_text)>0)\n ), qualified as materialized (\n  select s.*,(wanted is null or days[1]<=wanted[2] and days[2]>=wanted[1]) is true as time_ok,\n   case when scope_mode='ALL' then true when not has_point then false when scope_mode='AREA' then\n    approximate_lat between south and north and (west<=east and approximate_lng between west and east or west>east and (approximate_lng>=west or approximate_lng<=east))\n    else approximate_lat=point_lat and approximate_lng=point_lng end as in_area\n  from shared s\n ), scoped as materialized (\n  select q.*,case when scope_mode in ('AREA','POINT_LIST') and not has_point then 1 else 0 end as section\n  from qualified q where in_area or not has_point and scope_mode in ('AREA','POINT_LIST')\n ), page as materialized (\n  select * from scoped where time_ok and (before_id is null or section>before_section or section=before_section and (published_at,id)<(before_at,before_id))\n  order by section,published_at desc,id desc limit page_limit+1\n ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as (\n  select s.section,s.published_at,s.id,jsonb_build_object(\n   'id',s.id,'revision',s.revision,'sortAt',to_char(s.published_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),\n   'publishedAt',s.published_at,'title',s.title,'category',s.category,'status',s.status,'urgent',s.urgent,\n   'scheduleKind',s.schedule_kind,'startsAt',s.starts_at,'endsAt',s.ends_at,'executionLocationMode',s.execution_location_mode,\n   'taskCountryCode',s.task_country_code,'taskTimezone',s.task_timezone,'verifiedIdentityRequired',s.verified_identity_required,\n   'approximateCity',nullif(btrim(s.approximate_city),''),'approximateArea',nullif(btrim(s.approximate_area),''),\n   'pin',case when not s.has_point then null else jsonb_build_object('lat',s.approximate_lat,'lng',s.approximate_lng,'precision','COARSE_1KM') end,\n   'requiredSlots',s.required_slots,'coveredSlots',s.covered_now,'requiredSkills',to_jsonb(s.required_skills),'requiredTools',to_jsonb(s.required_tools),\n   'requiredVehicles',to_jsonb(s.required_vehicles),'requiredLicenses',to_jsonb(s.required_licenses),'minimumExperienceYears',s.minimum_experience_years,\n   'priceMode',s.mode,'requesterPriceRsd',s.requester_price_rsd,'priceBasis',s.price_basis,'requesterProfileId',s.requester_profile_id,\n   'responseDeadline',s.response_deadline,'acceptsApplications',s.required_slots>s.covered_now and (s.response_deadline is null or s.response_deadline>now_at),\n   'publicTopology',(select g.public_topology from public.need_geography g where g.need_id=s.id),\n   'criticalConditions',(select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id=s.id)) as item from shown s\n ) select jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,\n  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),\n   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')),\n  'items',coalesce((select jsonb_agg(item order by section,published_at desc,id desc) from projected),'[]'::jsonb),\n  'hasMore',(select count(*)>page_limit from page),\n  'nextCursor',case when (select count(*)>page_limit from page) then (select jsonb_build_object('scopeKey',scope_key,'section',section,\n   'sortAt',to_char(published_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'),'id',id) from shown order by section desc,published_at,id limit 1) else null end,\n  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,\n   'mapped',case when scope_mode='POINT_MEMBERS' then (select count(*) from scoped where time_ok) else (select count(*) from qualified where time_ok) end,\n   'listed',(select count(*) from scoped where time_ok),'inArea',(select count(*) from scoped where time_ok and in_area),\n   'withoutPoint',(select count(*) from scoped where time_ok and section=1),\n   'undated',(select count(*) from scoped where wanted is not null and days is null)),\n  'availability',jsonb_build_object('hasKnownWorkMode',exists(select 1 from base where execution_location_mode is not null),\n   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes))) into result;\n if request_mode='EXACT_PUBLIC' then return result-array['anchor','filterKey','counts','availability']; end if;\n return result;\nexception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then\n raise exception 'P6_INVALID_REQUEST' using errcode='22023';\nend $function$\n",
      "body_md5": "a5ce63c8874fbd3550730dd46d4044d7"
    }
  ]
};
