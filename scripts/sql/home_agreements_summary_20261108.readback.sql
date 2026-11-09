-- Coordinator-only post-apply check for the small existing DEV dataset.
-- Executes the public readers under authenticated with local JWT claims, not HTTP Auth.
-- No identifiers, titles, terms, addresses, phones or tokens enter the output.
-- Refuses a large dataset; no row, function, ACL or migration is changed.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $readback$
DECLARE
  account_id uuid; ordinal integer:=0; checked_role text;
  summary jsonb; legacy jsonb; attention jsonb; page jsonb; cursor_value jsonb;
  prompts jsonb; expected jsonb; receipt jsonb:='[]'::jsonb;
  page_calls integer; code text; message text;
BEGIN
  IF (SELECT count(*) FROM public.app_accounts)>100 OR (SELECT count(*) FROM public.agreements)>100 THEN
    RAISE EXCEPTION 'HOME_READBACK_SMALL_DATASET_REQUIRED';
  END IF;
  FOR account_id IN SELECT id FROM public.app_accounts ORDER BY id LOOP
    ordinal:=ordinal+1;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub',account_id::text,true);
      PERFORM set_config('request.jwt.claim.role','authenticated',true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account_id,'role','authenticated')::text,true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      checked_role:=current_user;
      summary:=public.rpc_home_agreements_summary_v1();
      legacy:=public.rpc_list_my_agreements_page('ALL',100,NULL,NULL);
      attention:=public.rpc_home_attention();
      prompts:='[]'::jsonb; cursor_value:=NULL; page_calls:=0;
      LOOP
        page:=public.rpc_home_agreement_prompts_page_v1(20,cursor_value);
        page_calls:=page_calls+1;
        IF page->>'accountId'<>account_id::text OR jsonb_array_length(page->'items')>20 THEN
          RAISE EXCEPTION 'HOME_READBACK_PAGE_BINDING';
        END IF;
        prompts:=prompts||(page->'items');
        EXIT WHEN NOT (page->>'hasMore')::boolean;
        IF page_calls>=5 OR page->'nextCursor' IS NULL OR page->'nextCursor'='null'::jsonb THEN
          RAISE EXCEPTION 'HOME_READBACK_PAGE_BOUND';
        END IF;
        cursor_value:=page->'nextCursor';
      END LOOP;
      EXECUTE 'RESET ROLE';
      IF (legacy->>'hasMore')::boolean THEN RAISE EXCEPTION 'HOME_READBACK_LEGACY_INCOMPLETE'; END IF;
      -- Compare against the existing public ALL projection, never the new private helper.
      WITH rows AS (SELECT value AS r FROM jsonb_array_elements(legacy->'items')),
      facts AS (SELECT r,
        coalesce(private.agreement_list_instant_v1(r#>>'{terms,proposed_start_at}'),
          private.agreement_list_instant_v1(r#>>'{terms,declared_start_at}')) AS start_at,
        CASE WHEN private.agreement_list_instant_v1(r#>>'{terms,proposed_start_at}')
          <private.agreement_list_instant_v1(r#>>'{terms,proposed_end_at}')
          THEN private.agreement_list_instant_v1(r#>>'{terms,proposed_end_at}') END AS end_at
        FROM rows),
      active AS (SELECT * FROM facts WHERE r->>'status' IN('CONFIRMED','AWAITING_REQUESTER')),
      upcoming AS (SELECT * FROM active WHERE r->>'status'='CONFIRMED' AND start_at IS NOT NULL
        AND CASE WHEN end_at IS NOT NULL THEN end_at>statement_timestamp() ELSE start_at>=statement_timestamp() END),
      featured AS (SELECT * FROM upcoming ORDER BY start_at,(r->>'createdAt')::timestamptz DESC,r->>'id' DESC LIMIT 1),
      expected_prompts AS (SELECT * FROM active WHERE r->'pendingChange'<>'null'::jsonb AND NOT (r#>>'{pendingChange,proposedByMe}')::boolean
        OR r->>'status'='CONFIRMED' AND jsonb_typeof(r->'terms')='object' AND start_at IS NULL AND r->'pendingChange'='null'::jsonb)
      SELECT jsonb_build_object(
        'hasAny',(SELECT count(*)>0 FROM rows),
        'active',(SELECT count(*) FROM active),
        'upcoming',(SELECT count(*) FROM upcoming),
        'withoutExactTerm',(SELECT count(*) FROM active WHERE jsonb_typeof(r->'terms')='object' AND end_at IS NULL),
        'awaitingFinish',(SELECT count(*) FROM active WHERE r->>'status'='CONFIRMED' AND end_at<=statement_timestamp()),
        'remainingThisWeek',(SELECT count(*) FROM upcoming WHERE end_at IS NOT NULL
          AND start_at<(date_trunc('week',statement_timestamp() AT TIME ZONE 'Europe/Belgrade')+interval '1 week') AT TIME ZONE 'Europe/Belgrade'
          AND end_at>date_trunc('week',statement_timestamp() AT TIME ZONE 'Europe/Belgrade') AT TIME ZONE 'Europe/Belgrade'
          AND r->>'id'<>(SELECT r->>'id' FROM featured)),
        'nextMatches',(summary#>>'{next,id}') IS NOT DISTINCT FROM (SELECT r->>'id' FROM featured),
        'ratingsDue',(SELECT count(*) FROM rows WHERE (r->>'ratingDue')::boolean),
        'promptCount',(SELECT count(*) FROM expected_prompts),
        'promptIdsMatch',coalesce((SELECT jsonb_agg(r->>'id' ORDER BY r->>'id') FROM expected_prompts),'[]'::jsonb)
          =coalesce((SELECT jsonb_agg(value->>'id' ORDER BY value->>'id') FROM jsonb_array_elements(prompts)),'[]'::jsonb)) INTO expected;
      receipt:=receipt||jsonb_build_array(jsonb_build_object('accountOrdinal',ordinal,'status','CHECKED','role',checked_role,
        'accountBinding',summary->>'accountId'=account_id::text,
        'legacyRows',jsonb_array_length(legacy->'items'),'summaryCounts',summary->'counts',
        'summaryCountsMatch',(summary->'counts')=(expected-ARRAY['nextMatches','ratingsDue','promptCount','promptIdsMatch']),
        'nextMatches',(expected->>'nextMatches')::boolean,
        'ratingsMatch',(summary#>>'{ratings,due}')::integer=(expected->>'ratingsDue')::integer
          AND (summary#>>'{ratings,due}')::integer=(attention#>>'{ratings,due}')::integer,
        'promptCount',(summary#>>'{prompts,total}')::integer,'promptPageCalls',page_calls,
        'allPromptIdsMatch',(expected->>'promptIdsMatch')::boolean,
        'promptCountMatches',(summary#>>'{prompts,total}')::integer=(expected->>'promptCount')::integer,
        'privatePromptFieldsAbsent',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prompts) r
          WHERE r-ARRAY['id','needId','version','title','reason','changeId','createdAt']<>'{}'::jsonb)));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,message=MESSAGE_TEXT;
      EXECUTE 'RESET ROLE';
      receipt:=receipt||jsonb_build_array(jsonb_build_object('accountOrdinal',ordinal,'status','REFUSED_OR_ERROR','sqlState',code,
        'error',CASE WHEN message~'^[A-Z_]+$' THEN message ELSE 'REDACTED_ERROR' END));
    END;
  END LOOP;
  PERFORM set_config('uskoci.home.readback',jsonb_build_object('observedAt',statement_timestamp(),
    'method','SQL authenticated role with local claims; not HTTP Auth','accounts',receipt)::text,true);
END;
$readback$;
SELECT current_setting('uskoci.home.readback')::jsonb AS proof;
ROLLBACK;
