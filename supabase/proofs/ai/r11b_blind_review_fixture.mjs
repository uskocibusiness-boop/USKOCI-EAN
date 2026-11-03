// R11b/S13 current reader/helper definitions, captured READ ONLY on 2026-11-03.
// The existing test executes the complete unchanged candidate against these
// definitions. Only synthetic fixture rows are used; this is not DEV acceptance.
export const blindReviewSnapshot = {
  "project_ref": "leqcwgzvjsxugfgzdmth",
  "source_head": "ab2ccf104c8cd0a2a65224d68ddd1c3dbf6311ce",
  "readers_captured_at": "2026-11-03T12:48:17.102344+00:00",
  "helpers_captured_at": "2026-11-03T12:48:36.218415+00:00",
  "lineage_captured_at": "2026-11-03T12:48:45.92434+00:00",
  "source": "READ ONLY system catalogs; no application functions invoked or business/Auth rows read",
  "publication_helper_exists": false,
  "limitations": [
    "The source candidate is LOCAL_ONLY, not an admitted hosted migration.",
    "Its definition MD5 guard does not itself pin owner/ACL; the isolated proof records and checks current metadata and preservation separately.",
    "The fixture uses simplified synthetic relation shapes and injected auth claims, not full hosted RLS/Auth/PostgREST or lifecycle.",
    "No DEV grants, reviews, closure certificates or deployments were changed."
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
      "body_md5": "c08602534ee5e0f0aa826db0913fde81",
      "signature": "private.account_lineage(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION private.account_lineage(p_account_id uuid)\n RETURNS text\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  select coalesce((select l.lineage from private.account_lineage_v5 l where l.account_id = p_account_id), 'UNCLASSIFIED');\n$function$\n",
      "captured_at": "2026-11-03T12:48:45.92434+00:00",
      "definition_md5": "8fb2092aa40b93b733f5e7181c355c55",
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "876cfc16f0ed1c4d32b128e8e18bdcda",
      "signature": "private.account_visibility_world(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION private.account_visibility_world(p_account_id uuid)\n RETURNS text\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  select case when coalesce(private.account_lineage(p_account_id), 'UNCLASSIFIED')\n                in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR',\n                    -- PKG-029e, owner decision 2026-09-21 (\"dok testiramo\"): the owner's own accounts share the\n                    -- test world while testing. Take these two out again before real users arrive.\n                    'OWNER_PERSONAL','OWNER_BUSINESS') then 'TEST' else 'REAL' end;\n$function$\n",
      "definition_md5": "109bc82d7b7b466218fb6823493fda4e",
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "f4999250c315e0253374d4611291c7ad",
      "signature": "private.closure_account_restricted(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION private.closure_account_restricted(a uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$ select exists(select 1 from private.account_closure_requests r where r.account_id=a\n and r.state in('READY','EXECUTING','FAILED','CLOSED')); $function$\n",
      "definition_md5": "9ce14bacf456210147ba14235d7ba8de",
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "990523c10a4e40152068570cdb71371d",
      "signature": "private.received_reviews_detail_v1()",
      "definition": "CREATE OR REPLACE FUNCTION private.received_reviews_detail_v1()\n RETURNS text\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  -- PROFILE-TRUST (2026-10-07): which of the caller's received reviews are listed one by one. One data row,\n  -- private.marketplace_config 'received_reviews_detail' {\"mode\": \"COMMENTED_ONLY\" | \"ALL\"}. The accepted D12 default keeps a\n  -- star-only review aggregate-only (its author was never told the reviewed person would see it individually); listing every\n  -- review is the owner's decision, so anything other than exactly \"ALL\" reads as COMMENTED_ONLY.\n  select case when (select c.value->>'mode' from private.marketplace_config c where c.key = 'received_reviews_detail') = 'ALL'\n    then 'ALL' else 'COMMENTED_ONLY' end;\n$function$\n",
      "definition_md5": "aef0198cece45daf174f1daeb1c20f35",
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "698fb21abb0379743bc7ab09d9f946ad",
      "signature": "private.safety_pair_blocked(uuid,uuid)",
      "definition": "CREATE OR REPLACE FUNCTION private.safety_pair_blocked(a uuid, b uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$ select exists(select 1 from private.account_blocks x where x.active\n and ((x.blocker_account_id=a and x.blocked_account_id=b) or (x.blocker_account_id=b and x.blocked_account_id=a))); $function$\n",
      "definition_md5": "5a4787a7d82ab8dea576c27b5e47d87a",
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "f03e558ff56a31a0b49e394714b628cd",
      "signature": "private.account_reputation(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION private.account_reputation(account_id uuid)\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n select jsonb_build_object('accountId',account_id,'reviewCount',count(*),\n 'averageRating',case when count(*)=0 then null else round(avg(rating),2) end,\n 'state',case when count(*)=0 then 'NO_REVIEWS' else 'RATED' end,'authoritative',true)\n from private.agreement_reviews where target_account_id=account_id;\n$function$\n",
      "definition_md5": "05e252f69f7e0dff14527f83cac18ada",
      "security_definer": true
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "owner": "postgres",
      "config": [
        "search_path=pg_catalog"
      ],
      "present": true,
      "body_md5": "16f541f952d4e1e2dbb4fc87e594d572",
      "signature": "private.accounts_same_world(uuid,uuid)",
      "definition": "CREATE OR REPLACE FUNCTION private.accounts_same_world(p_a uuid, p_b uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\n  select private.account_visibility_world(p_a) = private.account_visibility_world(p_b);\n$function$\n",
      "definition_md5": "2d6beb6df93bc8eb6ae2622de8319ac5",
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
      "body_md5": "4166221185edf108338898ba04f5e48a",
      "signature": "public.rpc_get_account_reputation(uuid)",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_get_account_reputation(p_account_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\nbegin\n if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;\n if p_account_id is null or not exists(select 1 from public.app_accounts where id=p_account_id)\n or private.closure_account_restricted(auth.uid()) or private.closure_account_restricted(p_account_id)\n or (auth.uid()<>p_account_id and private.safety_pair_blocked(auth.uid(),p_account_id)) then\n  raise exception 'REPUTATION_NOT_AVAILABLE' using errcode='42501';\n end if;\n return private.account_reputation(p_account_id);\nend;\n$function$\n",
      "definition_md5": "dcf8e88289bf45aef0ce45f663386a9d",
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
      "body_md5": "9462ed163b1e4a465c68ad72d18f0e3d",
      "signature": "public.rpc_list_received_reviews_v1(integer,text)",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_list_received_reviews_v1(p_limit integer DEFAULT 20, p_after text DEFAULT NULL::text)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare\n  v_actor uuid := auth.uid();\n  v_limit integer;\n  v_after_at timestamptz;\n  v_after_id uuid;\n  v_mode text;\n  v_page jsonb;\n  v_items jsonb;\n  v_more boolean;\n  v_total bigint;\n  v_listed bigint;\nbegin\n  -- PROFILE-TRUST (2026-10-07): the CALLER's received reviews, newest first, keyset paged (createdAt, reviewId), at most 50 a page.\n  -- Every item is the caller's own Dogovor (agreementId, taskTitle). Which reviews are listed one by one is the owner's open\n  -- decision (private.received_reviews_detail_v1(), default COMMENTED_ONLY: the accepted D12 default keeps star-only reviews\n  -- aggregate-only); totalCount and notListedCount make the list add up to the public reviewCount.\n  -- The comment follows the D12 reader rules (public.rpc_list_review_comments_v1) for the reviewed person as viewer, with the owner's\n  -- decision A09 (2026-10-02): a hidden (moderated) comment, an author under a closure restriction, an author in another world and an\n  -- author whose profile is not ACTIVE show no comment and no face; a comment whose AUTHOR blocked the caller IS shown with the\n  -- author's face masked (agreementId stays, so it can be reported); a comment by someone the CALLER blocked is not shown and the\n  -- face is masked. The stars of every review count in the aggregate whatever is shown here.\n  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;\n  if private.closure_account_restricted(v_actor) then raise exception 'ACCOUNT_CLOSING' using errcode = '42501'; end if;\n  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);\n  if p_after is not null then\n    if p_after !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z[|][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then\n      raise exception 'INVALID_PAGE' using errcode = '22023';\n    end if;\n    begin\n      v_after_at := split_part(p_after, '|', 1)::timestamptz;\n      v_after_id := split_part(p_after, '|', 2)::uuid;\n    exception when data_exception then\n      raise exception 'INVALID_PAGE' using errcode = '22023';\n    end;\n  end if;\n  v_mode := private.received_reviews_detail_v1();\n  with base as (\n    select rv.id, rv.created_at, rv.rating, rv.tags, rv.agreement_id,\n      rv.reviewer_account_id = ag.requester_account_id as by_requester,\n      n.title,\n      ap.id as author_profile_id, ap.display_name as author_name, ap.avatar_path as author_avatar,\n      coalesce(ap.profile_status = 'ACTIVE' and ap.kind in ('REQUESTER', 'WORKER'), false) as author_active,\n      cm.review_id is not null as has_comment, cm.comment, cm.hidden_at,\n      exists(select 1 from private.account_blocks b where b.active\n              and b.blocker_account_id = rv.reviewer_account_id and b.blocked_account_id = v_actor) as author_blocked_me,\n      exists(select 1 from private.account_blocks b where b.active\n              and b.blocker_account_id = v_actor and b.blocked_account_id = rv.reviewer_account_id) as i_blocked_author,\n      private.closure_account_restricted(rv.reviewer_account_id) as author_restricted,\n      private.accounts_same_world(v_actor, rv.reviewer_account_id) as same_world\n    from private.agreement_reviews rv\n    join public.agreements ag on ag.id = rv.agreement_id\n    join public.needs n on n.id = ag.need_id\n    left join public.app_profiles ap\n      on ap.id = case when rv.reviewer_account_id = ag.requester_account_id then ag.requester_profile_id else ag.worker_profile_id end\n     and ap.account_id = rv.reviewer_account_id\n    left join private.agreement_review_comments_v1 cm\n      on cm.review_id = rv.id and cm.author_account_id = rv.reviewer_account_id and cm.target_account_id = rv.target_account_id\n    where rv.target_account_id = v_actor\n  ), decided as (\n    select b.*,\n      (b.author_active and not b.author_restricted and b.same_world and not b.author_blocked_me and not b.i_blocked_author) as face_visible,\n      (b.has_comment and b.hidden_at is null and b.author_active and not b.author_restricted and b.same_world\n        and not b.i_blocked_author) as comment_visible\n    from base b\n  ), listed as (\n    select d.* from decided d where v_mode = 'ALL' or d.comment_visible\n  ), page as (\n    select l.* from listed l\n     where v_after_at is null or (l.created_at, l.id) < (v_after_at, v_after_id)\n     order by l.created_at desc, l.id desc\n     limit v_limit + 1\n  )\n  select\n    (select coalesce(jsonb_agg(jsonb_build_object(\n        'reviewId', p.id,\n        'rating', p.rating,\n        'tags', to_jsonb(p.tags),\n        'createdAt', p.created_at,\n        'agreementId', p.agreement_id,\n        'taskTitle', p.title,\n        'receivedAs', case when p.by_requester then 'WORKER' else 'REQUESTER' end,\n        'reviewer', case when p.face_visible\n          then jsonb_build_object('profileId', p.author_profile_id, 'role', case when p.by_requester then 'REQUESTER' else 'WORKER' end,\n                                  'displayName', nullif(btrim(p.author_name), ''), 'avatarPath', p.author_avatar, 'masked', false)\n          else jsonb_build_object('profileId', null, 'role', case when p.by_requester then 'REQUESTER' else 'WORKER' end,\n                                  'displayName', null, 'avatarPath', null, 'masked', true) end,\n        'comment', case when p.comment_visible then p.comment end,\n        'cursor', to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') || '|' || p.id::text)\n        order by p.created_at desc, p.id desc), '[]'::jsonb) from page p),\n    (select count(*) from decided),\n    (select count(*) from listed)\n  into v_page, v_total, v_listed;\n  v_more := jsonb_array_length(v_page) > v_limit;\n  if v_more then v_page := v_page - v_limit; end if;\n  select coalesce(jsonb_agg(e.item - 'cursor' order by e.ord), '[]'::jsonb) into v_items\n    from jsonb_array_elements(v_page) with ordinality e(item, ord);\n  return jsonb_build_object(\n    'schema', 'RECEIVED_REVIEWS_V1',\n    'mode', v_mode,\n    'items', v_items,\n    'hasMore', v_more,\n    'nextAfter', case when v_more then v_page->(v_limit - 1)->>'cursor' end,\n    'limit', v_limit,\n    'totalCount', v_total,\n    'notListedCount', v_total - v_listed,\n    'asOf', statement_timestamp(),\n    'authoritative', true);\nend;\n$function$\n",
      "definition_md5": "839db76bca79fb3bac96c371a4cfd156",
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
      "body_md5": "0712dcb3bfb25ec782f40c0fe47f17c3",
      "signature": "public.rpc_list_review_comments_v1(uuid,integer,jsonb)",
      "definition": "CREATE OR REPLACE FUNCTION public.rpc_list_review_comments_v1(p_profile_id uuid, p_limit integer DEFAULT 20, p_after jsonb DEFAULT NULL::jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$\ndeclare v_actor uuid:=auth.uid(); v_profile public.app_profiles; v_limit integer; v_after_at timestamptz; v_after_id uuid; v_items jsonb; v_more boolean;\nbegin\n -- D12: the gated reader of the written comments ABOUT the person whose public profile is open. One paged, account-level list (a review is account-level reputation, both roles pooled);\n -- only reviews that carry a visible comment appear (a star-only review has no text row, but the public count and average still include it, so for a small count the rating of a star-only review can be inferred by subtraction from the\n -- listed ratings: an owner-visible consequence, README_D12_CANDIDATE.md); stars, the count and the average are never changed by anything here.\n -- DESIGN DEFAULT D-DEC-7 (the owner accepted the defaults of the design): ONE account-level list usable from both profile kinds, so the same reviewIds and texts appear under the REQUESTER and the WORKER profile of one person and each item names the role\n -- of its author: an observer who has seen both faces can LINK them by comparing lists. A role-scoped list is a function-only change (add: and the target role of the Agreement equals v_profile.kind) that needs no certificate move; it is NOT implemented here.\n if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;\n if p_profile_id is null then raise exception 'PROFILE_ID_REQUIRED' using errcode='22023'; end if;\n v_limit:=least(greatest(coalesce(p_limit,20),1),50);\n if p_after is not null and jsonb_typeof(p_after)<>'null' then\n  if jsonb_typeof(p_after)<>'object' or jsonb_typeof(p_after->'createdAt') is distinct from 'string' or jsonb_typeof(p_after->'reviewId') is distinct from 'string' then\n   raise exception 'INVALID_PAGE' using errcode='22023';\n  end if;\n  begin\n   v_after_at:=(p_after->>'createdAt')::timestamptz; v_after_id:=(p_after->>'reviewId')::uuid;\n  exception when data_exception then raise exception 'INVALID_PAGE' using errcode='22023';\n  end;\n end if;\n -- The gate stack of rpc_get_public_profile, in the same order and with the same safe failure: an ACTIVE profile only, closure-restricted viewer or subject, a blocked pair and another world all read as \"nothing here\".\n select p.* into v_profile from public.app_profiles p where p.id=p_profile_id and p.profile_status='ACTIVE' and p.kind in('REQUESTER','WORKER');\n if not found then return null; end if;\n if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;\n if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;\n if not private.accounts_same_world(v_actor,v_profile.account_id) then return null; end if;\n -- Read-time gating of every row: a hidden comment, an author under a closure restriction, a pair VIEWER/author that is blocked either way (the viewer-versus-subject pair is gated above), another world, or an author profile that is not ACTIVE is not listed.\n -- DELIBERATELY NO viewer-independent block gate: a block between the author and the reviewed person must NOT remove the comment for third viewers, otherwise either party could censor or re-publish the text for everybody by toggling a block (the author edit/delete path\n -- the owner forbade, through a side door). It still hides the text from the one person who blocked its author, because that person is the VIEWER here. Hiding for everyone is the audited moderation HIDE only.\n -- KNOWN CONSEQUENCE (owner-visible, NOT decided here): the block is symmetric, so when the AUTHOR blocks the reviewed person (or blocked them before writing) that person is the viewer of a blocked pair and no longer sees the comment\n -- about them (nor its agreementId, so they cannot report it from here), is not notified, and every third viewer still sees it; the block costs the author nothing and the only remedy is the audited service-role HIDE. Options: README_D12_CANDIDATE.md.\n -- No write-time refusal exists for any of this (it would reveal a block); the author's profile is the face of the Agreement role in which the review was written. The only place an account id can appear is inside avatarPath, exactly as rpc_get_public_profile returns it.\n select coalesce(jsonb_agg(x.item order by x.created_at desc,x.review_id desc),'[]'::jsonb) into v_items from (\n  select c.created_at,c.review_id,\n   jsonb_build_object('reviewId',c.review_id,'rating',rv.rating,'comment',c.comment,'createdAt',c.created_at,\n    'agreementId',case when v_actor=c.target_account_id then rv.agreement_id else null end,\n    'author',jsonb_build_object('profileId',ap.id,'role',ap.kind,'displayName',nullif(btrim(ap.display_name),''),'avatarPath',ap.avatar_path)) as item\n  from private.agreement_review_comments_v1 c\n  join private.agreement_reviews rv on rv.id=c.review_id\n  join public.agreements ag on ag.id=rv.agreement_id\n  join public.app_profiles ap on ap.id=case when ag.requester_account_id=c.author_account_id then ag.requester_profile_id else ag.worker_profile_id end\n   and ap.account_id=c.author_account_id\n  where c.target_account_id=v_profile.account_id and c.hidden_at is null\n   and ap.profile_status='ACTIVE' and ap.kind in('REQUESTER','WORKER')\n   and not private.closure_account_restricted(c.author_account_id)\n   and not private.safety_pair_blocked(v_actor,c.author_account_id)\n   and private.accounts_same_world(v_actor,c.author_account_id)\n   and (v_after_at is null or (c.created_at,c.review_id)<(v_after_at,v_after_id))\n  order by c.created_at desc,c.review_id desc\n  limit v_limit+1\n ) x;\n v_more:=jsonb_array_length(v_items)>v_limit;\n if v_more then v_items:=v_items-v_limit; end if;\n return jsonb_build_object('profileId',v_profile.id,'items',v_items,'hasMore',v_more,\n  'nextAfter',case when v_more then jsonb_build_object('createdAt',v_items->(v_limit-1)->'createdAt','reviewId',v_items->(v_limit-1)->'reviewId') else null end,\n  'authoritative',true);\nend;\n$function$\n",
      "definition_md5": "a45554c0b1e1d5093b6d9a7fa7ee832f",
      "security_definer": true
    }
  ]
};
