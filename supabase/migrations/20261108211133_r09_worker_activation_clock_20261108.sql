-- Controlled DEV adoption only; no production approval or R13 Cron switch.
-- Tested core comes from scripts/sql/r09_worker_activation_20261108.sql.
-- The additional rollout guard refuses to suppress any currently admitted pair.
-- R09_ISOLATED_TEST_MIGRATION_START
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog;

-- DEV adoption: keep the observed zero-pending-pair boundary stable.
LOCK TABLE public.needs IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.app_profiles IN SHARE ROW EXCLUSIVE MODE;

-- Fail before mutation if any owner changed since the inspected live state.
CREATE TEMP TABLE uskoci_r09_activation_guard (
  signature text PRIMARY KEY, metadata jsonb NOT NULL
) ON COMMIT DROP;
DO $preimage$
DECLARE f record; body_hash text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.app_profiles'::regclass
      AND attname IN ('worker_dispatch_eligible_since','worker_dispatch_clock_source') AND NOT attisdropped)
     OR to_regprocedure('private.guard_worker_dispatch_clock_v1()') IS NOT NULL THEN
    RAISE EXCEPTION 'R09_ACTIVATION_CLOCK_ALREADY_EXISTS';
  END IF;
  -- Current BEFORE guard order is part of the safe observation backfill.
  IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.app_profiles'::regclass
      AND NOT t.tgisinternal AND (t.tgtype & 2)=2 AND t.tgenabled<>'O') THEN
    RAISE EXCEPTION 'R09_PROFILE_TRIGGER_STATE_DRIFT';
  END IF;
  IF (SELECT coalesce(jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname),'[]'::jsonb)
      FROM pg_trigger t WHERE t.tgrelid='public.app_profiles'::regclass
       AND NOT t.tgisinternal AND (t.tgtype & 2)=2)
     IS DISTINCT FROM '["CREATE TRIGGER app_profiles_set_updated_at BEFORE UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()", "CREATE TRIGGER guard_profile_write_trg BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_profile_write()", "CREATE TRIGGER guard_worker_equipment_retired_v1 BEFORE INSERT OR UPDATE OF tools, vehicles ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_worker_equipment_retired_v1()", "CREATE TRIGGER pre_v3_closure_profile BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.closure_guard_owned_write(''ACCOUNT'', ''account_id'')", "CREATE TRIGGER pre_v3_requester_identity BEFORE UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_requester_identity_writer()", "CREATE TRIGGER pre_v3_worker_fact_authority BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_worker_fact_authority()", "CREATE TRIGGER z_w02_persistent_availability BEFORE INSERT OR UPDATE ON public.app_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_persistent_availability()"]'::jsonb THEN
    RAISE EXCEPTION 'R09_PROFILE_TRIGGER_DRIFT';
  END IF;
  FOR f IN SELECT * FROM (VALUES
    ('private.dispatch_cheap_candidate_admitted(uuid,uuid)','cec5c0a2c13af6718af53b7a80245f28'),
    ('private.guard_profile_write()','319fef6fe239a21ecf134476ed2b90a4'),
    ('private.complete_worker_profile_v1(uuid,uuid,text)','2a0a7c10a3671d6cd49fad21fe65d824'),
    ('private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)','7fabcc71502e065e638364fc3d58b761'),
    ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','55ba7bf41ce39d9c914929270b916570'),
    ('private.data_export_dataset_catalog()','e08e712c811ab2a093e48ca75a436c25'),
    ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','c3bde16e2175c7ec33c1a171e0ad04a3'),
    ('private.guard_need_write()','314b93f7f89d3d52dbcf17a2a2552502'),
    ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad'),
    ('private.closure_guard_owned_write()','f13117fd601dcb82de423b78f25acb4f'),
    ('private.guard_persistent_availability()','cf05c663227f4f1d51a28f463b895bf7'),
    ('private.guard_requester_identity_writer()','c9d7f6593950e858b319f316cdbf6422'),
    ('private.guard_worker_equipment_retired_v1()','abb19096d5f0f00cd7f1817d3223a5d2'),
    ('private.guard_worker_fact_authority()','a6be4e85f69592615e8c5b8272028d0d'),
    ('private.worker_ai_source_hash(uuid)','416e1e92c90545ff2a3f4c942db793f7'),
    ('private.worker_ai_source(uuid)','27416a26166d8c0d910d3eda9ee82dce'),
    ('public.set_updated_at()','fbb247b78e5a461958844a3c37feb1e5'),
    ('private.closure_assert_open(uuid,uuid)','dc9bc4c718593850da4fdb49e612dbd2'),
    ('private.worker_availability_document(uuid)','fbfe4e849840eaaff4729fec266e1937'),
    ('private.worker_capacity_document(uuid)','01cfe29179cc15858f20a1bf736c16b2'),
    ('private.worker_location_document(uuid)','8745e96b743bb8104ecc9c20c53c5e30'),
    ('private.closure_account_key(uuid)','2dde6ad2462255b188e4f03ffe88edcd'),
    ('private.media_asset_document(private.owned_media_assets)','2b5b71600bad9bcc49ec1db0044256a7'),
    ('public.rpc_apply_profile_avatar(uuid,text)','bb219571e1c338dc0620f20cc164ea44'),
    ('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)','4f522b3df65e00f6985e50e66d388bbc')
  ) v(signature,expected_md5) LOOP
    SELECT md5(prosrc) INTO body_hash FROM pg_proc WHERE oid=to_regprocedure(f.signature);
    IF body_hash IS DISTINCT FROM f.expected_md5 THEN
      RAISE EXCEPTION 'R09_ACTIVATION_PREIMAGE_DRIFT:%',f.signature;
    END IF;
    INSERT INTO pg_temp.uskoci_r09_activation_guard
      SELECT f.signature,to_jsonb(p)-'prosrc' FROM pg_proc p WHERE oid=to_regprocedure(f.signature);
  END LOOP;
END
$preimage$;

DO $rollout$
BEGIN
  IF EXISTS (SELECT 1 FROM public.needs n CROSS JOIN public.app_profiles p
    WHERE p.kind='WORKER' AND p.profile_status='ACTIVE'
      AND n.published_at IS NOT NULL
      AND private.dispatch_cheap_candidate_admitted(n.id,p.id)) THEN
    RAISE EXCEPTION 'R09_ROLLOUT_PENDING_OPPORTUNITIES_REQUIRE_REVIEW';
  END IF;
END
$rollout$;

-- The existing profile remains the single owner. No new ledger/table, public
-- RPC, grants, network call, taxonomy writer or account lifecycle is created.
ALTER TABLE public.app_profiles
  ADD COLUMN worker_dispatch_eligible_since timestamptz,
  ADD COLUMN worker_dispatch_clock_source text;
ALTER TABLE public.app_profiles ADD CONSTRAINT app_profiles_worker_dispatch_clock_check CHECK (
  (worker_dispatch_eligible_since IS NULL AND worker_dispatch_clock_source IS NULL)
  OR (kind='WORKER' AND worker_dispatch_eligible_since IS NOT NULL
      AND isfinite(worker_dispatch_eligible_since)
      AND worker_dispatch_clock_source IS NOT NULL
      AND worker_dispatch_clock_source IN ('FIRST_ACTIVATION','ROLLOUT_ACTIVE_OBSERVED'))
);

-- One observation boundary, never created_at/updated_at or a guessed earlier
-- first activation. Existing opportunities/notifications are not deleted.
-- The ALTER lock is still held. A migration-only, late BEFORE trigger retains
-- updated_at solely when this UPDATE changes the two new metadata fields and
-- nothing else. All existing profile guards remain enabled. No user/profile
-- source change is falsely signalled to an already-open AI conversation.
CREATE FUNCTION pg_temp.r09_preserve_backfill_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog
AS $backfill$
BEGIN
 IF TG_RELID<>'public.app_profiles'::regclass OR TG_OP<>'UPDATE'
  OR OLD.kind<>'WORKER' OR OLD.profile_status<>'ACTIVE'
  OR OLD.worker_dispatch_eligible_since IS NOT NULL OR OLD.worker_dispatch_clock_source IS NOT NULL
  OR NEW.worker_dispatch_clock_source IS DISTINCT FROM 'ROLLOUT_ACTIVE_OBSERVED'
  OR NEW.worker_dispatch_eligible_since IS DISTINCT FROM statement_timestamp()
  OR (to_jsonb(NEW)-ARRAY['updated_at','worker_dispatch_eligible_since','worker_dispatch_clock_source'])
   IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','worker_dispatch_eligible_since','worker_dispatch_clock_source']) THEN
   RAISE EXCEPTION 'R09_BACKFILL_NOT_METADATA_ONLY';
 END IF;
 NEW.updated_at:=OLD.updated_at;
 RETURN NEW;
END $backfill$;
CREATE TRIGGER zz_r09_observation_backfill BEFORE UPDATE ON public.app_profiles
 FOR EACH ROW EXECUTE FUNCTION pg_temp.r09_preserve_backfill_updated_at();
UPDATE public.app_profiles
  SET worker_dispatch_eligible_since=statement_timestamp(),
      worker_dispatch_clock_source='ROLLOUT_ACTIVE_OBSERVED'
  WHERE kind='WORKER' AND profile_status='ACTIVE';
DROP TRIGGER zz_r09_observation_backfill ON public.app_profiles;
DROP FUNCTION pg_temp.r09_preserve_backfill_updated_at();

CREATE FUNCTION private.guard_worker_dispatch_clock_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog
AS $clock$
BEGIN
  -- Existing narrowly authorized closure owns erasure too. Its exact patch
  -- below clears both fields; this is not a general service_role bypass.
  IF TG_OP='UPDATE' AND auth.role()='service_role'
     AND private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),to_jsonb(NEW)) THEN
    RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.worker_dispatch_eligible_since IS NOT NULL OR NEW.worker_dispatch_clock_source IS NOT NULL THEN
      RAISE EXCEPTION 'WORKER_DISPATCH_CLOCK_IS_SERVER_OWNED' USING ERRCODE='42501';
    END IF;
  ELSIF NEW.worker_dispatch_eligible_since IS DISTINCT FROM OLD.worker_dispatch_eligible_since
     OR NEW.worker_dispatch_clock_source IS DISTINCT FROM OLD.worker_dispatch_clock_source THEN
    RAISE EXCEPTION 'WORKER_DISPATCH_CLOCK_IS_SERVER_OWNED' USING ERRCODE='42501';
  END IF;
  IF NEW.kind='WORKER' AND NEW.profile_status='ACTIVE'
     AND NEW.worker_dispatch_eligible_since IS NULL THEN
    -- This trigger sorts AFTER all current BEFORE profile guards; an inserted
    -- worker is still DRAFT until the existing confirmed activation writer.
    NEW.worker_dispatch_eligible_since:=clock_timestamp();
    NEW.worker_dispatch_clock_source:='FIRST_ACTIVATION';
  END IF;
  RETURN NEW;
END
$clock$;
REVOKE ALL ON FUNCTION private.guard_worker_dispatch_clock_v1()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_worker_dispatch_clock_v1
  BEFORE INSERT OR UPDATE ON public.app_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_worker_dispatch_clock_v1();

-- Patch the dispatcher gate and its protected publication witness, preserve
-- worker AI source identity, and extend the existing export/closure projections.
-- CREATE OR REPLACE retains each owner's OID, ACL, security and search_path.
DO $owners$
DECLARE definition text; before_text text; after_text text;
BEGIN
  definition:=pg_get_functiondef('private.worker_ai_source(uuid)'::regprocedure);
  before_text:=$before$'profile',to_jsonb(p),'location'$before$;
  after_text:=$after$'profile',to_jsonb(p)-ARRAY['worker_dispatch_eligible_since','worker_dispatch_clock_source'],'location'$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:private.worker_ai_source(uuid)';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)'::regprocedure);
  before_text:=$before$extensions.digest(to_jsonb(p)::text,'sha256')$before$;
  after_text:=$after$extensions.digest((to_jsonb(p)-ARRAY['worker_dispatch_eligible_since','worker_dispatch_clock_source'])::text,'sha256')$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:public.rpc_claim_media_upload_service';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('public.rpc_apply_profile_avatar(uuid,text)'::regprocedure);
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:public.rpc_apply_profile_avatar';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('private.guard_need_write()'::regprocedure);
  before_text:=$before$  if new.status is distinct from old.status then$before$;
  after_text:=$after$  -- R09: the publication/revision witness cannot be refreshed by an empty
  -- or unrelated lifecycle token. CONFIRM_EDIT and authorized closure return
  -- above; the only remaining publication writer is canonical DRAFT->PUBLISHED.
  if new.revision is distinct from old.revision then
    raise exception 'NEED_REVISION_IS_SERVER_OWNED' using errcode='42501';
  end if;
  if new.published_at is distinct from old.published_at
     and (token is distinct from 'PUBLISH' or old.status <> 'DRAFT' or new.status <> 'PUBLISHED') then
    raise exception 'PUBLISHED_AT_IS_SERVER_OWNED' using errcode='42501';
  end if;

  if new.status is distinct from old.status then$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:private.guard_need_write()';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('private.dispatch_cheap_candidate_admitted(uuid,uuid)'::regprocedure);
  before_text:=$before$      and coalesce(pref.proactive_notifications, true) = true$before$;
  after_text:=$after$      and coalesce(pref.proactive_notifications, true) = true
      -- R09: old tasks stay discoverable; only a publication after the
      -- worker's immutable notification clock is proactively announced.
      and p.worker_dispatch_eligible_since is not null
      and n.published_at > p.worker_dispatch_eligible_since$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:private.dispatch_cheap_candidate_admitted(uuid,uuid)';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure);
  before_text:=$before$'operating_country_code',null,'profile_status','CLOSED')$before$;
  after_text:=$after$'operating_country_code',null,'profile_status','CLOSED',
  'worker_dispatch_eligible_since',null,'worker_dispatch_clock_source',null)$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure);
  before_text:=$before$"operatingCountryCode", "skills", "status"]$before$;
  after_text:=$after$"operatingCountryCode", "skills", "status", "dispatchEligibleSince", "dispatchClockSource"]$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:private.data_export_dataset_catalog()';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
  definition:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)'::regprocedure);
  before_text:=$before$'operatingCountryCode',t.operating_country_code) as value from public.app_profiles t where t.account_id=p_account_id$before$;
  after_text:=$after$'operatingCountryCode',t.operating_country_code,'dispatchEligibleSince',t.worker_dispatch_eligible_since,'dispatchClockSource',t.worker_dispatch_clock_source) as value from public.app_profiles t where t.account_id=p_account_id$after$;
  IF length(definition)-length(replace(definition,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'R09_ACTIVATION_PATCH_ANCHOR:private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
END
$owners$;

DO $metadata$
DECLARE f record;
BEGIN
  FOR f IN SELECT * FROM pg_temp.uskoci_r09_activation_guard LOOP
    IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE oid=to_regprocedure(f.signature)) IS DISTINCT FROM f.metadata THEN
      RAISE EXCEPTION 'R09_ACTIVATION_OWNER_METADATA_CHANGED:%',f.signature;
    END IF;
  END LOOP;
END
$metadata$;

COMMENT ON COLUMN public.app_profiles.worker_dispatch_eligible_since IS
  'Server-owned proactive opportunity threshold. FIRST_ACTIVATION is stamped once at activation; ROLLOUT_ACTIVE_OBSERVED is an honest observation, not a claimed historic first activation. Does not filter Discovery or manual applications.';
COMMENT ON COLUMN public.app_profiles.worker_dispatch_clock_source IS
  'Provenance for worker_dispatch_eligible_since. Immutable across ordinary edits/reactivation; erased by the existing account closure redaction.';
COMMIT;
