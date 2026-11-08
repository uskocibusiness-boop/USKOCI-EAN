-- R09/F20 source candidate; not a canonical migration or DEV deployment.
-- Only the two existing dispatch/suppression owners change. No data rewrite,
-- new queue, network call, transport retry, scheduler, grants or indexes.
-- A committed active or accepted OFFER suppresses only its worker/Need/submitted revision.
DO $source_only$ BEGIN RAISE EXCEPTION 'R09_APPLICANT_SOURCE_ONLY'; END $source_only$;

-- R09_APPLICANT_ISOLATED_MIGRATION_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE uskoci_r09_applicant_guard(
  signature text PRIMARY KEY, metadata jsonb NOT NULL, after_md5 text NOT NULL
) ON COMMIT DROP;
DO $preimage$
DECLARE f record; current_row pg_proc%rowtype;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('private.dispatch_cheap_candidate_admitted(uuid,uuid)','5f3862949a6b93ab99c29c549ff9a837','34dcf47d654d5960fbf7254c28745a04','postgres','{postgres=X/postgres}'),
    ('private.push_suppression(public.notification_deliveries)','25d3fae40c1f67689e1c50ee1898005b','ebd9c03035630bde62bf9fd8a27378c2','postgres','{postgres=X/postgres}'),
    ('private.dispatch_next_wave(uuid)','d3cdfe2bdd6e5d40a74e6029793c89c5','d3cdfe2bdd6e5d40a74e6029793c89c5','postgres','{postgres=X/postgres}'),
    ('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)','398e85c4420da9c4765ae0ff6197a59e','398e85c4420da9c4765ae0ff6197a59e','postgres','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),
    ('public.rpc_claim_push_transport(text)','7c9145f1b9696f9ed6e4a29949228b58','7c9145f1b9696f9ed6e4a29949228b58','postgres','{postgres=X/postgres,service_role=X/postgres}'),
    ('public.rpc_begin_push_send(uuid,uuid)','e693b140450a9bb1cf6d3178b0ad80c1','e693b140450a9bb1cf6d3178b0ad80c1','postgres','{postgres=X/postgres,service_role=X/postgres}'),
    ('public.rpc_complete_push_transport(uuid,uuid,text,text)','d87908db1908b8c88fe66228c5b07f9f','d87908db1908b8c88fe66228c5b07f9f','postgres','{postgres=X/postgres,service_role=X/postgres}'),
    ('private.candidate_profile_ids_v1b(uuid,integer,integer)','c1505cb7784898875f37ecbc9c52d23c','c1505cb7784898875f37ecbc9c52d23c','postgres','{postgres=X/postgres}'),
    ('private.remote_wave_candidates_v1b(uuid,integer,integer)','3bd12de1d220804a91a7b1b036fd7ce6','3bd12de1d220804a91a7b1b036fd7ce6','postgres','{postgres=X/postgres}')
  ) v(signature,before_md5,after_md5,owner_name,expected_acl) LOOP
    SELECT * INTO current_row FROM pg_proc WHERE oid=to_regprocedure(f.signature);
    IF NOT FOUND OR md5(current_row.prosrc) IS DISTINCT FROM f.before_md5
       OR pg_get_userbyid(current_row.proowner) IS DISTINCT FROM f.owner_name
       OR current_row.proacl::text IS DISTINCT FROM f.expected_acl
       OR NOT current_row.prosecdef
       OR current_row.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] THEN
      RAISE EXCEPTION 'R09_APPLICANT_PREIMAGE_DRIFT:%',f.signature;
    END IF;
    INSERT INTO pg_temp.uskoci_r09_applicant_guard
      VALUES(f.signature,to_jsonb(current_row)-'prosrc',f.after_md5);
  END LOOP;
END $preimage$;

DO $patch$
DECLARE definition text; old_text text:=$anchor$      and n.published_at > p.worker_dispatch_eligible_since
$anchor$;
BEGIN
  definition:=pg_get_functiondef('private.dispatch_cheap_candidate_admitted(uuid,uuid)'::regprocedure);
  IF (length(definition)-length(replace(definition,old_text,'')))<>length(old_text) THEN
    RAISE EXCEPTION 'R09_APPLICANT_PATCH_ANCHOR:private.dispatch_cheap_candidate_admitted(uuid,uuid)';
  END IF;
  EXECUTE replace(definition,old_text,$replacement$      and n.published_at > p.worker_dispatch_eligible_since
      -- F20: a committed active or accepted offer already expresses interest in this
      -- exact publication. Account identity (not a possibly replaced profile)
      -- owns the suppression; Discovery/manual application stay unchanged.
      and not exists (
        select 1 from public.marketplace_responses r
        where r.need_id = n.id
          and r.worker_account_id = p.account_id
          and r.submitted_against_need_revision = n.revision
          and r.response_kind = 'OFFER'
          and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED'))
$replacement$);
END $patch$;

DO $patch$
DECLARE definition text; old_text text:=$anchor$  select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
$anchor$;
BEGIN
  definition:=pg_get_functiondef('private.push_suppression(public.notification_deliveries)'::regprocedure);
  IF (length(definition)-length(replace(definition,old_text,'')))<>length(old_text) THEN
    RAISE EXCEPTION 'R09_APPLICANT_PATCH_ANCHOR:private.push_suppression(public.notification_deliveries)';
  END IF;
  EXECUTE replace(definition,old_text,$replacement$  -- F20: the event's immutable Need revision is the notification identity.
  -- Recheck before both first claim and SEND_STARTED, including the default-ON
  -- path with no preferences row. A later Need edit must not reinterpret an
  -- older event, and an opportunity status alone cannot prove a manual offer.
  if e.event_type='OPPORTUNITY_AVAILABLE' and e.entity_type='NEED'
     and e.recipient_role='WORKER' and exists (
       select 1 from public.marketplace_responses r
       where r.need_id=e.entity_id
         and r.worker_account_id=e.recipient_user_id
         and r.submitted_against_need_revision=e.entity_version
         and r.response_kind='OFFER'
         and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED')) then
    return 'ALREADY_RESPONDED';
  end if;

  select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
$replacement$);
END $patch$;

DO $readback$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_temp.uskoci_r09_applicant_guard g
      LEFT JOIN pg_proc p ON p.oid=to_regprocedure(g.signature)
      WHERE p.oid IS NULL OR (to_jsonb(p)-'prosrc') IS DISTINCT FROM g.metadata
        OR md5(p.prosrc) IS DISTINCT FROM g.after_md5) THEN
    RAISE EXCEPTION 'R09_APPLICANT_READBACK_MISMATCH';
  END IF;
END $readback$;
COMMIT;
