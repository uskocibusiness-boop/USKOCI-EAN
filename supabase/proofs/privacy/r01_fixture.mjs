// Test fixture: current catalog definitions captured read-only on 2026-10-28.
// No business rows or credentials. Only this bounded subset is installed into PGlite.
// Keep body hashes bound to the captured definitions; this is not a full schema dump.
export const snapshot = {
  "capturedAt": "2026-10-28T04:56:52.079242+00:00",
  "columns": [
    {
      "name": "id",
      "type": "uuid",
      "not_null": true
    },
    {
      "name": "requester_account_id",
      "type": "uuid",
      "not_null": true
    },
    {
      "name": "requester_profile_id",
      "type": "uuid",
      "not_null": true
    },
    {
      "name": "status",
      "type": "text",
      "not_null": true
    },
    {
      "name": "title",
      "type": "text",
      "not_null": true
    },
    {
      "name": "description",
      "type": "text",
      "not_null": true
    },
    {
      "name": "category",
      "type": "text",
      "not_null": true
    },
    {
      "name": "approximate_city",
      "type": "text",
      "not_null": true
    },
    {
      "name": "approximate_area",
      "type": "text",
      "not_null": true
    },
    {
      "name": "approximate_lat",
      "type": "numeric(6,2)",
      "not_null": false
    },
    {
      "name": "approximate_lng",
      "type": "numeric(7,2)",
      "not_null": false
    },
    {
      "name": "schedule_kind",
      "type": "text",
      "not_null": true
    },
    {
      "name": "starts_at",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "ends_at",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "required_slots",
      "type": "integer",
      "not_null": true
    },
    {
      "name": "mode",
      "type": "text",
      "not_null": true
    },
    {
      "name": "requester_price_rsd",
      "type": "integer",
      "not_null": false
    },
    {
      "name": "required_skills",
      "type": "text[]",
      "not_null": true
    },
    {
      "name": "required_tools",
      "type": "text[]",
      "not_null": true
    },
    {
      "name": "required_vehicles",
      "type": "text[]",
      "not_null": true
    },
    {
      "name": "verified_identity_required",
      "type": "boolean",
      "not_null": true
    },
    {
      "name": "urgent",
      "type": "boolean",
      "not_null": true
    },
    {
      "name": "public_photo_paths",
      "type": "text[]",
      "not_null": true
    },
    {
      "name": "revision",
      "type": "integer",
      "not_null": true
    },
    {
      "name": "published_at",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "created_at",
      "type": "timestamp with time zone",
      "not_null": true
    },
    {
      "name": "updated_at",
      "type": "timestamp with time zone",
      "not_null": true
    },
    {
      "name": "response_deadline",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "urgent_activated_at",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "urgent_expires_at",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "urgent_policy_version",
      "type": "text",
      "not_null": false
    },
    {
      "name": "minimum_experience_years",
      "type": "integer",
      "not_null": false
    },
    {
      "name": "execution_location_mode",
      "type": "text",
      "not_null": true
    },
    {
      "name": "approx_geog",
      "type": "geography(Point,4326)",
      "not_null": false
    },
    {
      "name": "required_licenses",
      "type": "text[]",
      "not_null": true
    },
    {
      "name": "remaining_search_closed_at",
      "type": "timestamp with time zone",
      "not_null": false
    },
    {
      "name": "remaining_search_closed_by_account_id",
      "type": "uuid",
      "not_null": false
    },
    {
      "name": "remaining_search_close_reason",
      "type": "text",
      "not_null": false
    },
    {
      "name": "task_country_code",
      "type": "text",
      "not_null": false
    },
    {
      "name": "task_timezone",
      "type": "text",
      "not_null": false
    },
    {
      "name": "price_basis",
      "type": "text",
      "not_null": false
    },
    {
      "name": "category_id",
      "type": "uuid",
      "not_null": false
    }
  ],
  "policies": [
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
  "functions": [
    {
      "signature": "rls_private.need_participant_can_read(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION rls_private.need_participant_can_read(p_need_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  select auth.uid() is not null\n     and (\n       exists (\n         select 1\n           from public.agreements a\n          where a.need_id = p_need_id\n            and a.worker_account_id = auth.uid()\n            and a.status in ('CONFIRMED', 'COMPLETED')\n       )\n       or exists (\n         select 1\n           from public.need_selections s\n          where s.need_id = p_need_id\n            and s.worker_account_id = auth.uid()\n            and s.status = 'SELECTED'\n       )\n     );\n$function$\n",
      "body_md5": "c23e2bbab829ad716435e56862a495b6"
    },
    {
      "signature": "rpc_close_remaining_search(uuid,integer,text,text)",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_close_remaining_search(p_need_id uuid, p_expected_revision integer, p_client_request_id text, p_reason text DEFAULT ''::text)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n  v_actor uuid := auth.uid();\n  v_request_id text := btrim(coalesce(p_client_request_id,''));\n  v_reason text := left(btrim(coalesce(p_reason,'')),500);\n  v_request_hash text;\n  v_existing private.remaining_search_close_commands%rowtype;\n  v_need public.needs%rowtype;\n  v_selected_slots integer := 0;\n  v_remaining integer := 0;\n  v_affected integer := 0;\n  v_result jsonb;\nbegin\n  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n  if p_need_id is null or p_expected_revision is null or p_expected_revision < 1 then\n    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';\n  end if;\n  if char_length(v_request_id) not between 8 and 200 then\n    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';\n  end if;\n\n  v_request_hash := encode(\n    extensions.digest(\n      convert_to(jsonb_build_object(\n        'needId',p_need_id,\n        'expectedRevision',p_expected_revision,\n        'reason',v_reason\n      )::text,'UTF8'),\n      'sha256'\n    ),\n    'hex'\n  );\n\n  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\\n' || v_request_id, 4410));\n\n  select * into v_existing\n    from private.remaining_search_close_commands c\n   where c.requester_account_id = v_actor\n     and c.client_request_id = v_request_id\n   for update;\n  if found then\n    if v_existing.request_hash <> v_request_hash then\n      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';\n    end if;\n    return v_existing.result || jsonb_build_object('idempotentReplay',true);\n  end if;\n\n  select * into v_need\n    from public.needs n\n   where n.id = p_need_id\n   for update;\n  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;\n  if v_need.requester_account_id <> v_actor then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;\n  if v_need.revision <> p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;\n\n  if v_need.remaining_search_closed_at is not null then\n    return jsonb_build_object(\n      'needId',v_need.id,\n      'revision',v_need.revision,\n      'requiredSlots',v_need.required_slots,\n      'remainingSearchClosed',true,\n      'closedAt',v_need.remaining_search_closed_at,\n      'idempotentReplay',true,\n      'authoritative',true\n    );\n  end if;\n\n  if not exists (select 1 from public.agreements a where a.need_id = v_need.id) then\n    raise exception 'REMAINING_SEARCH_CLOSE_REQUIRES_DOGOVOR' using errcode='P0001';\n  end if;\n\n  if v_need.status not in ('PUBLISHED','SELECTION','ACTIVE') then\n    raise exception 'NEED_REMAINING_SEARCH_NOT_OPEN' using errcode='P0001';\n  end if;\n\n  select coalesce(sum(s.covered_slots),0)::integer\n    into v_selected_slots\n    from public.need_selections s\n   where s.need_id = v_need.id\n     and s.status = 'SELECTED';\n\n  v_remaining := greatest(v_need.required_slots - v_selected_slots,0);\n  if v_selected_slots < 1 then\n    raise exception 'REMAINING_SEARCH_CLOSE_REQUIRES_SELECTED_CAPACITY' using errcode='P0001';\n  end if;\n  if v_remaining < 1 then\n    raise exception 'NO_REMAINING_SEARCH' using errcode='P0001';\n  end if;\n\n  perform set_config('uskoci.need_lifecycle','CLOSE_REMAINING_SEARCH',true);\n  update public.needs\n     set remaining_search_closed_at = statement_timestamp(),\n         remaining_search_closed_by_account_id = v_actor,\n         remaining_search_close_reason = nullif(v_reason,''),\n         updated_at = statement_timestamp()\n   where id = v_need.id;\n  perform set_config('uskoci.need_lifecycle','',true);\n\n  update public.dispatch_rounds\n     set status = 'STOPPED', stop_reason = 'REMAINING_SEARCH_CLOSED'\n   where need_id = v_need.id\n     and status in ('PLANNED','SENT');\n\n  update public.opportunity_deliveries\n     set status = 'EXPIRED'\n   where need_id = v_need.id\n     and status in ('READY','SEEN');\n\n  delete from private.dispatch_schedule where need_id = v_need.id;\n\n  -- PKG-029a (deep read 12.9): every applicant whose application closes here is told, as rpc_cancel_need does.\n  with closed as (\n    update public.marketplace_responses\n       set status = 'EXPIRED'\n     where need_id = v_need.id\n       and status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE','STALE_REVIEW_REQUIRED')\n     returning worker_account_id\n  )\n  select count(*)::integer into v_affected\n    from closed c\n    cross join lateral (select private.emit_event(c.worker_account_id, 'WORKER', 'NEED_CANCELLED', 'NEED', v_need.id,\n      v_need.revision, 'Potraga je zatvorena',\n      'Onaj ko je objavio zadatak zatvorio je potragu. Tvoja prijava više nije aktivna.',\n      'search-closed:' || v_need.id::text || ':' || v_need.revision::text || ':worker:' || c.worker_account_id::text,\n      'NORMAL', jsonb_build_object('reason', 'REMAINING_SEARCH_CLOSED'), null)) e;\n\n  perform private.audit_marketplace(\n    v_actor,\n    'REMAINING_SEARCH_CLOSED',\n    'NEED',\n    v_need.id,\n    v_need.revision,\n    jsonb_build_object(\n      'requiredSlots',v_need.required_slots,\n      'selectedSlots',v_selected_slots,\n      'closedRemainingSlots',v_remaining,\n      'affectedResponses',v_affected,\n      'reasonProvided',v_reason<>''\n    )\n  );\n\n  select * into v_need from public.needs where id = v_need.id;\n\n  v_result := jsonb_build_object(\n    'needId',v_need.id,\n    'revision',v_need.revision,\n    'status',v_need.status,\n    'requiredSlots',v_need.required_slots,\n    'selectedSlots',v_selected_slots,\n    'closedRemainingSlots',v_remaining,\n    'affectedResponses',v_affected,\n    'remainingSearchClosed',true,\n    'closedAt',v_need.remaining_search_closed_at,\n    'idempotentReplay',false,\n    'authoritative',true\n  );\n\n  insert into private.remaining_search_close_commands(\n    requester_account_id,client_request_id,request_hash,need_id,need_revision,result\n  ) values (\n    v_actor,v_request_id,v_request_hash,v_need.id,v_need.revision,v_result\n  );\n\n  return v_result;\nend;\n$function$\n",
      "body_md5": "39fa830132d714a1cc61d3bba73d5cec"
    },
    {
      "signature": "rpc_storage_account_open()",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_storage_account_open()\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n begin if auth.uid() is null then return false;end if;perform private.closure_assert_open(auth.uid());return true;end;\n$function$\n",
      "body_md5": "7350621ef256678e209aa6a28c79b58b"
    },
    {
      "signature": "is_my_task(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION public.is_my_task(p_need_id uuid)\n RETURNS boolean\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nbegin\n  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;\n  return exists(select 1 from public.needs n where n.id=p_need_id and n.requester_account_id=auth.uid());\nend;\n$function$\n",
      "body_md5": "42b6802d2f3114d1e211025c4c475e55"
    },
    {
      "signature": "rls_private.p6_discovery_test_world_accounts()",
      "definition": "CREATE OR REPLACE FUNCTION rls_private.p6_discovery_test_world_accounts()\n RETURNS uuid[]\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  select coalesce(array_agg(l.account_id order by l.account_id),array[]::uuid[])\n  from private.account_lineage_v5 l\n  where private.account_visibility_world(l.account_id)='TEST'\n$function$\n",
      "body_md5": "6193869dd532dbe5d2723c078940d10e"
    },
    {
      "signature": "covered_slots(needs)",
      "definition": "CREATE OR REPLACE FUNCTION public.covered_slots(n needs)\n RETURNS integer\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\n  select coalesce(sum(s.covered_slots), 0)::integer\r\n    from public.need_selections s\r\n   where s.need_id = n.id and s.status = 'SELECTED';\r\n$function$\n",
      "body_md5": "ac09f84c85ff8ae237c8db463a43d547"
    },
    {
      "signature": "selectable_application_count(needs)",
      "definition": "CREATE OR REPLACE FUNCTION public.selectable_application_count(n needs)\n RETURNS integer\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare actor uuid:=auth.uid(); actual public.needs; result integer;\nbegin\n  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;\n  -- Only the ID is input. Never trust owner/status/price fields in a caller-supplied composite.\n  select * into actual from public.needs t where t.id=n.id and t.requester_account_id=actor;\n  if not found then return null; end if;\n  select count(*)::integer into result from private.need_candidate_states_v5(actual.id) c\n    where c.candidate_state='SELECTABLE';\n  return result;\nend;\n$function$\n",
      "body_md5": "fe53442f8b661d6f33d22a54e2a468a8"
    },
    {
      "signature": "rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_list_my_needs_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n  v_uid uuid := auth.uid();\n  v_items jsonb;\nbegin\n  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;\n  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then\n    raise exception 'INVALID_PAGE' using errcode = '22023';\n  end if;\n  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then\n    raise exception 'INVALID_SCOPE' using errcode = '22023';\n  end if;\n\n  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;\n\n  select coalesce(jsonb_agg(q.item order by q.created_at desc, q.id desc), '[]'::jsonb) into v_items\n  from (\n    select n.created_at, n.id, jsonb_build_object(\n      'id', n.id, 'sortAt', n.created_at, 'revision', n.revision,\n      'title', n.title, 'description', n.description, 'category', n.category, 'status', n.status,\n      'urgent', n.urgent, 'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,\n      'taskCountryCode', n.task_country_code, 'taskTimezone', n.task_timezone,\n      'executionLocationMode', n.execution_location_mode,\n      'approximateArea', n.approximate_area, 'approximateCity', n.approximate_city,\n      -- covered_slots is the existing computed field public.covered_slots(needs), not a column.\n      'requiredSlots', n.required_slots, 'coveredSlots', public.covered_slots(n),\n      'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools),\n      'requiredVehicles', to_jsonb(n.required_vehicles), 'requiredLicenses', to_jsonb(n.required_licenses),\n      'minimumExperienceYears', n.minimum_experience_years,\n      'verifiedIdentityRequired', n.verified_identity_required,\n      'mode', n.mode, 'requesterPriceRsd', n.requester_price_rsd,\n      'applicationCount', (select count(*) from public.marketplace_responses r where r.need_id = n.id),\n      'publicTopology', (select g.public_topology from public.need_geography g where g.need_id = n.id),\n      'criticalConditions', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)\n    ) as item\n    from public.needs n\n    where n.requester_account_id = v_uid\n      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (n.status in ('DRAFT','PUBLISHED','SELECTION','ACTIVE')))\n      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))\n    order by n.created_at desc, n.id desc\n    limit p_limit + 1\n  ) q;\n\n  return jsonb_build_object(\n    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,\n    'hasMore', jsonb_array_length(v_items) > p_limit,\n    'asOf', statement_timestamp());\nend\n$function$\n",
      "body_md5": "dad1de3234e72d4e2f44be5e920eda61"
    },
    {
      "signature": "rpc_read_task(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_read_task(p_need_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare result jsonb;\nbegin\n  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n  -- RLS remains the authority for the task and all embedded relations.\n  -- Composite computed fields receive ONLY an ID, never a whole-row reference.\n  select jsonb_build_object(\n    'id', n.id,\n    'requester_profile_id', n.requester_profile_id,\n    'status', n.status,\n    'title', n.title,\n    'description', n.description,\n    'category', n.category,\n    'approximate_city', n.approximate_city,\n    'approximate_area', n.approximate_area,\n    'approximate_lat', n.approximate_lat,\n    'approximate_lng', n.approximate_lng,\n    'schedule_kind', n.schedule_kind,\n    'starts_at', n.starts_at,\n    'ends_at', n.ends_at,\n    'required_slots', n.required_slots,\n    'mode', n.mode,\n    'requester_price_rsd', n.requester_price_rsd,\n    'required_skills', n.required_skills,\n    'required_tools', n.required_tools,\n    'required_vehicles', n.required_vehicles,\n    'verified_identity_required', n.verified_identity_required,\n    'urgent', n.urgent,\n    'public_photo_paths', n.public_photo_paths,\n    'revision', n.revision,\n    'published_at', n.published_at,\n    'created_at', n.created_at,\n    'updated_at', n.updated_at,\n    'response_deadline', n.response_deadline,\n    'urgent_activated_at', n.urgent_activated_at,\n    'urgent_expires_at', n.urgent_expires_at,\n    'urgent_policy_version', n.urgent_policy_version,\n    'minimum_experience_years', n.minimum_experience_years,\n    'execution_location_mode', n.execution_location_mode,\n    'required_licenses', n.required_licenses,\n    'remaining_search_closed_at', n.remaining_search_closed_at,\n    'task_country_code', n.task_country_code,\n    'task_timezone', n.task_timezone,\n    'price_basis', n.price_basis,\n    'covered_slots', public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', n.id))),\n    'selectable_application_count', public.selectable_application_count(jsonb_populate_record(null::public.needs, jsonb_build_object('id', n.id))),\n    'marketplace_responses', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id) order by r.id), '[]'::jsonb) from public.marketplace_responses r where r.need_id=n.id),\n    'need_geography', (select jsonb_build_object('public_topology', g.public_topology) from public.need_geography g where g.need_id=n.id),\n    'need_requirement_details', (select jsonb_build_object('critical_conditions', d.critical_conditions) from public.need_requirement_details d where d.need_id=n.id)\n  ) into result from public.needs n where n.id=p_need_id;\n  return result;\nend;\n$function$\n",
      "body_md5": "1e01db5140248f27ab374187f01fded3"
    },
    {
      "signature": "rpc_list_my_tasks()",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_list_my_tasks()\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare actor uuid:=auth.uid(); result jsonb;\nbegin\n  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;\n  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;\n  -- The only elevated reader: no caller-supplied account; enumerate ONLY this account's own tasks.\n  -- Its document reader omits internal account IDs, close reason and private location data.\n  select coalesce(jsonb_agg(public.rpc_read_task(n.id) order by n.created_at desc, n.id desc), '[]'::jsonb)\n    into result from public.needs n where n.requester_account_id=actor;\n  return result;\nend;\n$function$\n",
      "body_md5": "2a8ff0fa8a1211414e5e1fc69c6fb4f7"
    }
  ]
};
