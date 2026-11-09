-- Candidate for coordinator review only; not a canonical/applied migration.
-- Account-owned Home facts and a separate bounded live prompt traversal.
-- No Agreement/term/price/review writer or existing RPC is changed.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $preflight$
DECLARE expected record;
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_home_attention()'))
      IS DISTINCT FROM 'f3bc12de53c96fb50f011350c6cb9c9d'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)'))
      IS DISTINCT FROM '9149868e6241948f89d3f54f378e4946'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.agreement_list_instant_v1(text)'))
      IS DISTINCT FROM '069eb961b036f7a2cc733c9f61d72d66'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.agreement_review_deadline_v1(uuid)'))
      IS DISTINCT FROM 'a86bf830d7e536e75d1a6c680e4d2876' THEN
    RAISE EXCEPTION 'HOME_AGREEMENTS_PREIMAGE_MISMATCH';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('public.rpc_home_attention()',true,'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)',true,'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('private.agreement_list_instant_v1(text)',false,'{postgres=X/postgres}'),
    ('private.agreement_review_deadline_v1(uuid)',true,'{postgres=X/postgres}')
  ) AS dependencies(signature,definer,acl) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef=expected.definer
      AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.proacl::text=expected.acl) THEN
      RAISE EXCEPTION 'HOME_AGREEMENTS_AUTHORITY_MISMATCH';
    END IF;
  END LOOP;
  IF to_regprocedure('private.home_agreement_facts_v1()') IS NOT NULL
    OR to_regprocedure('public.rpc_home_agreements_summary_v1()') IS NOT NULL
    OR to_regprocedure('public.rpc_home_agreement_prompts_page_v1(integer,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'HOME_AGREEMENTS_ALREADY_EXISTS';
  END IF;
END;
$preflight$;

-- Private helper is invoked only inside the guarded definer entries below.
-- auth.uid() is the only account selector; no caller-supplied account is accepted.
CREATE FUNCTION private.home_agreement_facts_v1()
RETURNS TABLE(id uuid,need_id uuid,current_version integer,created_at timestamptz,
  title text,state text,mine_role text,counterpart_profile_id uuid,counterpart_name text,
  terms_known boolean,start_at timestamptz,end_at timestamptz,
  change_id uuid,change_mine boolean,rating_due boolean)
LANGUAGE sql STABLE SET search_path=pg_catalog
AS $function$
  SELECT a.id,a.need_id,a.current_version,a.created_at,n.title,coalesce(ae.state,a.status),
    CASE WHEN a.requester_account_id=auth.uid() THEN 'narucilac' ELSE 'uskocer' END,
    CASE WHEN a.requester_account_id=auth.uid() THEN a.worker_profile_id ELSE a.requester_profile_id END,
    CASE WHEN a.requester_account_id=auth.uid() THEN wp.display_name ELSE rp.display_name END,
    jsonb_typeof(av.terms)='object',
    coalesce(private.agreement_list_instant_v1(av.terms->>'proposed_start_at'),
      private.agreement_list_instant_v1(av.terms->>'declared_start_at')),
    CASE WHEN private.agreement_list_instant_v1(av.terms->>'proposed_start_at')
      < private.agreement_list_instant_v1(av.terms->>'proposed_end_at')
      THEN private.agreement_list_instant_v1(av.terms->>'proposed_end_at') END,
    change.id,change.proposed_by_account_id=auth.uid(),
    coalesce(a.status='COMPLETED' AND ae.state='COMPLETED'
      AND NOT private.closure_account_restricted(auth.uid())
      AND statement_timestamp()<private.agreement_review_deadline_v1(a.id)
      AND NOT EXISTS(SELECT 1 FROM private.agreement_reviews rv
        WHERE rv.agreement_id=a.id AND rv.reviewer_account_id=auth.uid()),false)
  FROM public.agreements a
  JOIN public.agreement_versions av ON av.agreement_id=a.id AND av.version=a.current_version
  JOIN public.needs n ON n.id=a.need_id
  JOIN public.app_profiles rp ON rp.id=a.requester_profile_id
  JOIN public.app_profiles wp ON wp.id=a.worker_profile_id
  LEFT JOIN public.agreement_execution ae ON ae.agreement_id=a.id
  LEFT JOIN LATERAL (SELECT c.id,c.proposed_by_account_id FROM public.agreement_change_proposals c
    WHERE c.agreement_id=a.id AND c.status='PENDING' ORDER BY c.created_at DESC,c.id DESC LIMIT 1) change ON true
  WHERE auth.uid() IN (a.requester_account_id,a.worker_account_id);
$function$;

CREATE FUNCTION public.rpc_home_agreements_summary_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_now timestamptz:=statement_timestamp();
  v_week_from timestamptz;
  v_week_to timestamptz;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT public.rpc_storage_account_open() OR private.closure_account_restricted(v_uid) THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_OPEN' USING errcode='42501';
  END IF;
  v_week_from:=date_trunc('week',v_now AT TIME ZONE 'Europe/Belgrade') AT TIME ZONE 'Europe/Belgrade';
  v_week_to:=(date_trunc('week',v_now AT TIME ZONE 'Europe/Belgrade')+interval '1 week') AT TIME ZONE 'Europe/Belgrade';
  WITH facts AS MATERIALIZED (SELECT * FROM private.home_agreement_facts_v1()),
  active AS MATERIALIZED (SELECT * FROM facts WHERE state IN ('CONFIRMED','AWAITING_REQUESTER')),
  upcoming AS MATERIALIZED (SELECT * FROM active WHERE state='CONFIRMED' AND start_at IS NOT NULL
    AND CASE WHEN end_at IS NOT NULL THEN end_at>v_now ELSE start_at>=v_now END),
  featured AS (SELECT * FROM upcoming ORDER BY start_at,created_at DESC,id DESC LIMIT 1),
  prompts AS MATERIALIZED (
    SELECT a.*,CASE WHEN change_id IS NOT NULL THEN 'CHANGE' ELSE 'TERM' END AS reason,
      CASE WHEN change_id IS NOT NULL THEN 0 ELSE 1 END AS rank
    FROM active a WHERE change_id IS NOT NULL AND NOT change_mine
      OR state='CONFIRMED' AND terms_known AND start_at IS NULL AND change_id IS NULL
  ), preview AS (SELECT * FROM prompts ORDER BY rank,created_at DESC,id DESC LIMIT 4)
  SELECT jsonb_build_object('schemaVersion',1,'accountId',v_uid,'asOf',v_now,
    'counts',jsonb_build_object(
      'hasAny',EXISTS(SELECT 1 FROM public.agreements a WHERE v_uid IN(a.requester_account_id,a.worker_account_id)),
      'active',(SELECT count(*) FROM active),
      'upcoming',(SELECT count(*) FROM upcoming),
      'withoutExactTerm',(SELECT count(*) FROM active WHERE terms_known AND end_at IS NULL),
      'awaitingFinish',(SELECT count(*) FROM active WHERE state='CONFIRMED' AND end_at<=v_now),
      'remainingThisWeek',(SELECT count(*) FROM upcoming u WHERE u.end_at IS NOT NULL
        AND u.start_at<v_week_to AND u.end_at>v_week_from AND u.id<>(SELECT id FROM featured))),
    'next',(SELECT jsonb_build_object('id',id,'needId',need_id,'version',current_version,
      'title',title,'role',mine_role,'counterpartProfileId',counterpart_profile_id,'counterpartName',counterpart_name,
      'startAt',start_at,'endAt',end_at) FROM featured),
    'ratings',jsonb_build_object('due',(SELECT count(*) FROM facts WHERE rating_due),
      'agreementId',(SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] END FROM facts WHERE rating_due)),
    'prompts',jsonb_build_object('total',(SELECT count(*) FROM prompts),
      'changes',(SELECT count(*) FROM prompts WHERE reason='CHANGE'),
      'terms',(SELECT count(*) FROM prompts WHERE reason='TERM'),
      'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'needId',need_id,'version',current_version,
        'title',title,'reason',reason,'changeId',change_id,'createdAt',created_at)
        ORDER BY rank,created_at DESC,id DESC) FROM preview),'[]'::jsonb))) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Stable keyset position is (immutable creation time, id), not a mutable reason.
-- viewAt excludes newly created agreements; authorization, pending proposals and
-- current terms are always reevaluated. This is a live traversal, not a row snapshot.
CREATE FUNCTION public.rpc_home_agreement_prompts_page_v1(p_limit integer DEFAULT 20,p_cursor jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_now timestamptz:=statement_timestamp();
  v_view_at timestamptz;
  v_before_at timestamptz;
  v_before_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT public.rpc_storage_account_open() OR private.closure_account_restricted(v_uid) THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_OPEN' USING errcode='42501';
  END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>30 THEN RAISE EXCEPTION 'HOME_PROMPTS_INVALID_PAGE' USING errcode='22023'; END IF;
  v_view_at:=v_now;
  IF p_cursor IS NOT NULL THEN
    IF jsonb_typeof(p_cursor)<>'object'
      OR p_cursor-ARRAY['schemaVersion','accountId','viewAt','at','id']<>'{}'::jsonb
      OR NOT(p_cursor ?& ARRAY['schemaVersion','accountId','viewAt','at','id'])
      OR p_cursor->'schemaVersion'<>'1'::jsonb
      OR jsonb_typeof(p_cursor->'accountId')<>'string' OR p_cursor->>'accountId'<>v_uid::text
      OR jsonb_typeof(p_cursor->'id')<>'string'
      OR p_cursor->>'id' !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      OR private.agreement_list_instant_v1(p_cursor->>'viewAt') IS NULL
      OR private.agreement_list_instant_v1(p_cursor->>'at') IS NULL THEN
      RAISE EXCEPTION 'HOME_PROMPTS_INVALID_PAGE' USING errcode='22023';
    END IF;
    v_view_at:=private.agreement_list_instant_v1(p_cursor->>'viewAt');
    v_before_at:=private.agreement_list_instant_v1(p_cursor->>'at');
    v_before_id:=(p_cursor->>'id')::uuid;
    IF v_view_at>v_now OR v_before_at>v_view_at THEN RAISE EXCEPTION 'HOME_PROMPTS_INVALID_PAGE' USING errcode='22023'; END IF;
    IF v_now>v_view_at+interval '30 minutes' THEN RAISE EXCEPTION 'HOME_PROMPTS_EXPIRED' USING errcode='22023'; END IF;
  END IF;
  WITH prompts AS MATERIALIZED (
    SELECT f.*,CASE WHEN change_id IS NOT NULL THEN 'CHANGE' ELSE 'TERM' END AS reason
    FROM private.home_agreement_facts_v1() f WHERE created_at<=v_view_at
      AND state IN('CONFIRMED','AWAITING_REQUESTER')
      AND (change_id IS NOT NULL AND NOT change_mine
        OR state='CONFIRMED' AND terms_known AND start_at IS NULL AND change_id IS NULL)
  ), remaining AS MATERIALIZED (
    SELECT * FROM prompts WHERE p_cursor IS NULL OR (created_at,id)<(v_before_at,v_before_id)
  ), page AS MATERIALIZED (SELECT * FROM remaining ORDER BY created_at DESC,id DESC LIMIT p_limit)
  SELECT jsonb_build_object('schemaVersion',1,'accountId',v_uid,'asOf',v_now,'viewAt',v_view_at,
    'counts',jsonb_build_object('total',(SELECT count(*) FROM prompts),'remaining',(SELECT count(*) FROM remaining)),
    'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'needId',need_id,'version',current_version,
      'title',title,'reason',reason,'changeId',change_id,'createdAt',created_at)
      ORDER BY created_at DESC,id DESC) FROM page),'[]'::jsonb),
    'hasMore',(SELECT count(*)>p_limit FROM remaining),
    'nextCursor',CASE WHEN (SELECT count(*)>p_limit FROM remaining) THEN
      (SELECT jsonb_build_object('schemaVersion',1,'accountId',v_uid,'viewAt',v_view_at,'at',created_at,'id',id)
        FROM page ORDER BY created_at,id LIMIT 1) END) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Proposed minimal ACL: two deliberate authenticated entries; no client access
-- to the private helper, no anonymous entry, no direct table permission.
REVOKE ALL ON FUNCTION private.home_agreement_facts_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_home_agreements_summary_v1(),public.rpc_home_agreement_prompts_page_v1(integer,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_home_agreements_summary_v1(),public.rpc_home_agreement_prompts_page_v1(integer,jsonb)
  TO authenticated;
DO $postflight$
DECLARE expected record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('public.rpc_home_agreements_summary_v1()',true,'{postgres=X/postgres,authenticated=X/postgres}','1debcf182b1a333a974fb2fd352672fb'),
    ('public.rpc_home_agreement_prompts_page_v1(integer,jsonb)',true,'{postgres=X/postgres,authenticated=X/postgres}','aa07862def7c2fc4a6b9ee7faef6d0f6'),
    ('private.home_agreement_facts_v1()',false,'{postgres=X/postgres}','8c759e93b3dbb6cc58d073c73bfe9873')
  ) AS additions(signature,definer,acl,body_md5) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef=expected.definer AND p.provolatile='s'
      AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.proacl::text=expected.acl AND md5(p.prosrc)=expected.body_md5) THEN
      RAISE EXCEPTION 'HOME_AGREEMENTS_POSTIMAGE_MISMATCH';
    END IF;
  END LOOP;
END;
$postflight$;
COMMIT;
