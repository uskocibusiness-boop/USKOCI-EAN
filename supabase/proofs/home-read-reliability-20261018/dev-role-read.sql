-- Read-only DEV integration probe. No fixture/business writes; always rollback.
-- Uses existing eligible owners, actual authenticated RLS and real PostGIS.
-- Returns counts/digests only, never titles, contact data or actor IDs.
begin read only;
set local statement_timeout = '20s';
do $probe$
declare actors jsonb;
begin
  select jsonb_agg(jsonb_build_object('id',id,'ownIds',
    (select coalesce(jsonb_agg(n.id),'[]') from public.needs n where n.requester_account_id=a.id)) order by id) into actors from (
    select id from auth.users
    where not private.closure_account_restricted(id)
    order by id limit 3
  ) a;
  if coalesce(jsonb_array_length(actors),0)=0 then raise exception 'NO_ELIGIBLE_PROBE_ACTORS'; end if;
  perform set_config('uskoci.probe_actors',actors::text,true);
end $probe$;
set local role authenticated;
do $probe$
declare a jsonb; uid uuid; ordinary jsonb; exact_row jsonb; viewport jsonb;
  cursor_page jsonb; preview jsonb; eligible jsonb; first_item jsonb;
  own_ids uuid[]; reports jsonb:='[]'; preview_code text; invalid_code text;
begin
  for a in select value from jsonb_array_elements(current_setting('uskoci.probe_actors')::jsonb) loop
    uid:=(a->>'id')::uuid;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',uid::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.path','/rpc/rpc_list_open_tasks_v3',true);
    perform public.rpc_closure_api_guard();
    select array_agg(value::uuid) into own_ids from jsonb_array_elements_text(a->'ownIds');
    -- Check the repair predicate against admin-loaded ownership without granting
    -- the invoker access to the private needs.requester_account_id column.
    if exists (select 1 from public.needs m where
      (not exists (select 1 from public.app_profiles own_profile
        where own_profile.id=m.requester_profile_id and own_profile.account_id=uid))
      is distinct from (not (m.id=any(coalesce(own_ids,'{}'::uuid[]))))) then
      raise exception 'OWN_PROFILE_BINDING_MISMATCH'; end if;
    ordinary:=public.rpc_list_open_tasks_v3(null,'{}',200,null,null);
    if (ordinary->>'hasMore')::boolean then raise exception 'PROBE_DATA_EXCEEDS_BOUNDED_BASELINE'; end if;
    first_item:=ordinary->'items'->0;
    exact_row:=public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',coalesce(first_item->>'id','00000000-0000-4000-8000-000000000000')),3,null,null);
    viewport:=public.rpc_list_open_tasks_v3('{"west":18,"south":44,"east":22,"north":47}','{"remote":"EXCLUDE"}',200,null,null);
    cursor_page:=public.rpc_list_open_tasks_v3(null,'{}',200,
      coalesce((first_item->>'sortAt')::timestamptz,'2000-01-01'::timestamptz),
      coalesce((first_item->>'id')::uuid,'00000000-0000-4000-8000-000000000000'::uuid));
    select coalesce(jsonb_agg(item order by ordinal),'[]') into eligible
      from (select item,ordinal from jsonb_array_elements(ordinary->'items') with ordinality e(item,ordinal)
        where not ((item->>'id')::uuid=any(coalesce(own_ids,'{}'::uuid[])))
          and item->'acceptsApplications'='true'::jsonb order by ordinal limit 3) q;
    preview_code:='OK'; preview:=null;
    begin preview:=public.rpc_list_open_tasks_v3(null,'{"homePreview":true}',3,null,null);
    exception when sqlstate '22023' then preview_code:=sqlstate; end;
    if preview_code='OK' and preview->'items' is distinct from eligible then
      raise exception 'PREVIEW_ELIGIBILITY_OR_ORDER_MISMATCH'; end if;
    invalid_code:='UNEXPECTED_SUCCESS';
    begin perform public.rpc_list_open_tasks_v3(null,'{"homePreview":true,"remote":"ONLY"}',3,null,null);
    exception when sqlstate '22023' then invalid_code:=sqlstate; end;
    if invalid_code<>'22023' then raise exception 'MIXED_FILTER_NOT_REFUSED'; end if;
    reports:=reports||jsonb_build_array(jsonb_build_object(
      'actorDigest',md5(uid::text),'ordinaryCount',jsonb_array_length(ordinary->'items'),
      'ordinaryDigest',md5((ordinary-'asOf')::text),
      'exactDigest',md5((exact_row-'asOf')::text),
      'viewportCount',jsonb_array_length(viewport->'items'),'viewportDigest',md5((viewport-'asOf')::text),
      'cursorDigest',md5((cursor_page-'asOf')::text),
      'previewCode',preview_code,'previewCount',jsonb_array_length(preview->'items'),
      'expectedPreviewCount',jsonb_array_length(eligible),
      'previewMatchesEligible',case when preview_code='OK' then preview->'items'=eligible else null end,
      'mixedFilterCode',invalid_code));
  end loop;
  perform set_config('uskoci.probe_report',reports::text,true);
end $probe$;
reset role;
select current_setting('uskoci.probe_report')::jsonb as role_read_report;
rollback;
