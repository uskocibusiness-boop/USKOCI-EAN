// Fresh, metadata-only R01 owner-page compatibility evidence, 2026-11-03.
// Original historical fixture/capture bytes remain in their existing files.
// No current Auth/PostgREST, DEV candidate application or release claim.
export const ownerPageSnapshot = {
  "project_ref": "leqcwgzvjsxugfgzdmth",
  "source_head": "79ecdb1b90658dd642c28fd6cbe83463315dd232",
  "reader_metadata_captured_at": "2026-11-03T12:21:16.403803+00:00",
  "helper_metadata_captured_at": "2026-11-03 12:22:19.84716+00",
  "dependency_metadata_captured_at": "2026-11-03T12:22:35.411199+00:00",
  "source": "READ ONLY system catalogs; no application/Auth rows or application function execution",
  "limitations": [
    "Metadata capture is not Auth/PostgREST or R01 parity admission.",
    "The executable proof retains documented substitutes for account closure, classification, events and geography.",
    "The LOCAL_ONLY column candidate is unchanged; no DEV grants or certificates were changed."
  ],
  "need_relation": {
    "acl": [
      "postgres=arwdDxtm/postgres",
      "anon=Dxtm/postgres",
      "authenticated=arwDxtm/postgres",
      "service_role=arwdDxtm/postgres"
    ],
    "rls": true,
    "owner": "postgres",
    "force_rls": false
  },
  "need_columns": [
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
      "type": "extensions.geography(Point,4326)",
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
  "need_policies": [
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
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "01d695467d5fa39dec180086cb07de40",
      "signature": "private.own_task_counts(uuid)",
      "definition_md5": "4d0829799f882b287f7ec8f5c65d6917",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": false,
        "authenticated_execute": false
      },
      "security_definer": true,
      "definition": "CREATE OR REPLACE FUNCTION private.own_task_counts(a uuid)\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  select jsonb_build_object(\n    'total', count(*),\n    'active', count(*) filter (where n.status in ('PUBLISHED','SELECTION','ACTIVE')),\n    'drafts', count(*) filter (where n.status = 'DRAFT'),\n    'history', count(*) filter (where n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')),\n    'waiting', count(*) filter (where n.status in ('PUBLISHED','SELECTION','ACTIVE')\n      and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0\n      and coalesce(public.selectable_application_count(n), 0) > 0))\n  from public.needs n where n.requester_account_id = a\n$function$\n"
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "509d6c345c84cc6a597bde46d9ae6b75",
      "signature": "public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)",
      "definition_md5": "dae2f244c3ab670656faa14b6802dfdf",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true,
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_list_my_needs_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n  v_uid uuid := auth.uid();\n  v_items jsonb;\nbegin\n  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;\n  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then\n    raise exception 'INVALID_PAGE' using errcode = '22023';\n  end if;\n  if p_scope is null or p_scope not in ('ALL','ACTIVE','DRAFTS','HISTORY','WAITING') then\n    raise exception 'INVALID_SCOPE' using errcode = '22023';\n  end if;\n\n  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;\n\n  -- EX-04 S1 (A09). Every item IS the rpc_read_task document that rpc_list_my_tasks returns, so the card, the price basis and the selectable count\n  -- cannot drift from the ordinary read; sortAt is the keyset value. The scopes are the client's own sections: Aktivni = PUBLISHED, SELECTION, ACTIVE;\n  -- Nacrti = DRAFT; Istorija = COMPLETED, CANCELLED, EXPIRED, ARCHIVED; WAITING = an active task with a place left and a selectable application.\n  with page as materialized (\n    select n.created_at, n.id\n    from public.needs n\n    where n.requester_account_id = v_uid\n      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))\n      and case p_scope\n            when 'ALL' then true\n            when 'ACTIVE' then n.status in ('PUBLISHED','SELECTION','ACTIVE')\n            when 'DRAFTS' then n.status = 'DRAFT'\n            when 'HISTORY' then n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')\n            else n.status in ('PUBLISHED','SELECTION','ACTIVE')\n              and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0\n              and coalesce(public.selectable_application_count(n), 0) > 0\n          end\n    order by n.created_at desc, n.id desc\n    limit p_limit + 1\n  )\n  select coalesce(jsonb_agg(public.rpc_read_task(p.id) || jsonb_build_object('sortAt', p.created_at) order by p.created_at desc, p.id desc), '[]'::jsonb)\n    into v_items from page p;\n\n  return jsonb_build_object(\n    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,\n    'hasMore', jsonb_array_length(v_items) > p_limit,\n    -- The five counts of the tabs ride with the first page; a later page does not pay for them again.\n    'counts', case when p_before_at is null then private.own_task_counts(v_uid) end,\n    'asOf', statement_timestamp());\nend\n$function$\n"
    }
  ],
  "dependencies": [
    {
      "acl": [
        "postgres=X/postgres",
        "service_role=X/postgres",
        "authenticated=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=public, pg_temp"
      ],
      "present": true,
      "body_md5": "ac09f84c85ff8ae237c8db463a43d547",
      "signature": "public.covered_slots(public.needs)",
      "definition_md5": "72ea2b656f8820051ea944e127f49c41",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "service_role=X/postgres",
        "authenticated=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "42b6802d2f3114d1e211025c4c475e55",
      "signature": "public.is_my_task(uuid)",
      "definition_md5": "5b83c8bf482261d8d2a11195c0371c63",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "65f41c2ec10d1bb926f34ecf04b36ec4",
      "signature": "public.p6_discovery_area(text,text,boolean)",
      "definition_md5": "19b248a7990edbfd30082b6711135bea",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "cee687f43419dfb2fa9cc9233e8bea34",
      "signature": "public.p6_discovery_civil(text)",
      "definition_md5": "200244cd9e9e64242365e2a1eb9e4a4e",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "e1c81ce573875504d60e025c07573ee6",
      "signature": "public.p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone)",
      "definition_md5": "a5f0936eae296bd6b5a447a8ec0c8062",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "ebfe1252f1798d89bbffb35b6eef6167",
      "signature": "public.p6_discovery_key(text)",
      "definition_md5": "b00ef54f232e30bfd7aea5677e7f3829",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "40109e93b620146aa8d536907d28c91b",
      "signature": "public.p6_discovery_trim(text)",
      "definition_md5": "fcba20ed5078db635b194b54748670a2",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "d9ab01e57fb2f667ee865f69aa246741",
      "signature": "public.p6_discovery_unquote(text)",
      "definition_md5": "3d2228f056ccf829de632fbf335bfe17",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "39fa830132d714a1cc61d3bba73d5cec",
      "signature": "public.rpc_close_remaining_search(uuid,integer,text,text)",
      "definition_md5": "bddf3da28b7a682891c2bb77fbaaaa59",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "a5ce63c8874fbd3550730dd46d4044d7",
      "signature": "public.rpc_discovery_v1(jsonb)",
      "definition_md5": "d795a9ba1d8865a3df887ef3728ff3b7",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "service_role=X/postgres",
        "authenticated=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "2a8ff0fa8a1211414e5e1fc69c6fb4f7",
      "signature": "public.rpc_list_my_tasks()",
      "definition_md5": "1d66fe6d246a74b28cd8694bdbd59a65",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "service_role=X/postgres",
        "authenticated=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "1e01db5140248f27ab374187f01fded3",
      "signature": "public.rpc_read_task(uuid)",
      "definition_md5": "abd68dacd327eeb6bd65956ed38db661",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": false
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "7350621ef256678e209aa6a28c79b58b",
      "signature": "public.rpc_storage_account_open()",
      "definition_md5": "04337720544e1f60b8ba635ea01e4814",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres",
        "service_role=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "fe53442f8b661d6f33d22a54e2a468a8",
      "signature": "public.selectable_application_count(public.needs)",
      "definition_md5": "1e7a5030bb534aa2fd7874e6ae5fa8af",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": true,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "c23e2bbab829ad716435e56862a495b6",
      "signature": "rls_private.need_participant_can_read(uuid)",
      "definition_md5": "fb9231d26b4ef986352aeb304818e7d2",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": false,
        "authenticated_execute": true
      },
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "6193869dd532dbe5d2723c078940d10e",
      "signature": "rls_private.p6_discovery_test_world_accounts()",
      "definition_md5": "4ee16169f4ee6ba7f79f4bd11b172ad8",
      "effective_access": {
        "anon_execute": false,
        "service_role_execute": false,
        "authenticated_execute": true
      },
      "security_definer": true
    }
  ]
};
