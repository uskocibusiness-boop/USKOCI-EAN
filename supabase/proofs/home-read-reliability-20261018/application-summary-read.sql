-- No business writes: compare the deployed Home count source with the old complete read.
-- Run as three existing actors through the authenticated role and the actual API preflight.
begin read only;
set local statement_timeout = '20s';
do $probe$
declare actors jsonb;
begin
  select jsonb_agg(id) into actors from (
    select u.id from auth.users u
    where not private.closure_account_restricted(u.id)
    order by (select count(*) from public.marketplace_responses r where r.worker_account_id = u.id and r.status <> 'DRAFT') desc, u.id
    limit 3
  ) a;
  if coalesce(jsonb_array_length(actors), 0) = 0 then raise exception 'No existing actors'; end if;
  perform set_config('uskoci.probe_actors', actors::text, true);
end $probe$;
set local role authenticated;
do $probe$
declare actor jsonb; uid uuid; whole jsonb; page jsonb; expected jsonb;
  reports jsonb := '[]'; agreement_page jsonb; item jsonb; seen uuid[]; item_id uuid;
  cursor_at timestamptz; cursor_id uuid; previous_at timestamptz; previous_id uuid;
  pages integer; items integer;
begin
  for actor in select value from jsonb_array_elements(current_setting('uskoci.probe_actors')::jsonb) loop
    uid := (actor #>> '{}')::uuid;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.path', '/rpc/rpc_list_my_applications_page', true);
    perform public.rpc_closure_api_guard();
    whole := public.rpc_list_my_applications();
    page := public.rpc_list_my_applications_page('ALL', 1);
    select jsonb_build_object('total', count(*),
      'attention', count(*) filter (where value->>'attentionRequired' = 'true'),
      'active', count(*) filter (where value->>'attentionRequired' <> 'true' and value->>'state' in ('SUBMITTED','VIEWED','SHORTLISTED')),
      'finished', count(*) filter (where value->>'attentionRequired' <> 'true' and value->>'state' not in ('SUBMITTED','VIEWED','SHORTLISTED')))
    into expected from jsonb_array_elements(whole);
    if page->'counts' is distinct from expected then raise exception 'Application count mismatch for %', md5(uid::text); end if;
    if jsonb_array_length(page->'items') <> least(jsonb_array_length(whole), 1)
      or (page->>'hasMore')::boolean is distinct from (jsonb_array_length(whole) > 1)
      then raise exception 'Application page envelope mismatch'; end if;

    perform set_config('request.path', '/rpc/rpc_list_my_agreements_page', true);
    perform public.rpc_closure_api_guard();
    cursor_at := null; cursor_id := null; seen := '{}'; pages := 0; items := 0;
    loop
      pages := pages + 1;
      if pages > 20 then raise exception 'Agreement page budget exceeded'; end if;
      agreement_page := public.rpc_list_my_agreements_page('ALL', 100, cursor_at, cursor_id);
      if jsonb_typeof(agreement_page->'hasMore') is distinct from 'boolean'
        or jsonb_typeof(agreement_page->'items') is distinct from 'array'
        or jsonb_array_length(agreement_page->'items') > 100 then raise exception 'Invalid agreement envelope'; end if;
      previous_at := cursor_at; previous_id := cursor_id;
      for item in select value from jsonb_array_elements(agreement_page->'items') loop
        item_id := (item->>'id')::uuid;
        if item_id is null or item_id = any(seen) or item->>'sortAt' is null then raise exception 'Invalid agreement identity'; end if;
        if previous_at is not null and ((item->>'sortAt')::timestamptz, item_id) >= (previous_at, previous_id)
          then raise exception 'Agreement keyset does not advance'; end if;
        seen := array_append(seen, item_id); items := items + 1;
        previous_at := (item->>'sortAt')::timestamptz; previous_id := item_id;
      end loop;
      exit when not (agreement_page->>'hasMore')::boolean;
      if jsonb_array_length(agreement_page->'items') = 0 then raise exception 'Empty agreement continuation'; end if;
      cursor_at := previous_at; cursor_id := previous_id;
    end loop;
    reports := reports || jsonb_build_array(jsonb_build_object('actorHash', md5(uid::text),
      'counts', expected, 'countParity', true, 'wholeApplicationRows', jsonb_array_length(whole),
      'summaryPageRows', jsonb_array_length(page->'items'),
      'wholeJsonTextBytes', octet_length(whole::text), 'pageJsonTextBytes', octet_length(page::text),
      'agreementPages', pages, 'agreementRows', items, 'agreementCursorContract', true));
  end loop;
  perform set_config('uskoci.probe_report', reports::text, true);
end $probe$;
reset role;
select current_setting('uskoci.probe_report')::jsonb as role_read_report;
rollback;
