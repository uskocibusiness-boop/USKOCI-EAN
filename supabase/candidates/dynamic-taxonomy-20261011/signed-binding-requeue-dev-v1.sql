-- DEV Gate B/C bridge: recover discovery after an ALREADY VERIFIED signed binding.
-- No direct notifications, no wildcard matching, no implied scope consent.
-- Keep all decisions in existing strict worker_need_fit_v1/dispatch_next_wave.
-- The trigger runs after binder writes its last durable receipt, in the SAME tx.
-- Errors in queue scheduling never invalidate an owner's successful Save/binding.
CREATE OR REPLACE FUNCTION private.taxonomy_signed_binding_requeue_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, private
AS $function$
DECLARE v_valid boolean:=false;
BEGIN
  IF TG_OP<>'INSERT'
    OR NEW.result->>'dispatchAuthority'<>'NONE'
    OR NEW.result->>'notificationAuthority'<>'NONE' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='work_taxonomy_need_bindings_v1' THEN
    IF NEW.result->>'status'<>'BOUND_NEED_REVISION' THEN RETURN NEW; END IF;
    -- Recheck CURRENT requester revision and category. The binder holds the
    -- same Need row lock and has just inserted the signed snapshot.
    SELECT EXISTS(
      SELECT 1 FROM public.needs n
      JOIN private.work_taxonomy_need_snapshots snap
        ON snap.need_id=n.id AND snap.need_revision=n.revision
       AND snap.category_id=n.category_id
      WHERE n.id=NEW.need_id AND n.requester_account_id=NEW.owner_account_id
        AND n.revision=NEW.need_revision AND n.category_id=NEW.category_id
        AND n.status IN ('PUBLISHED','SELECTION')
        AND n.remaining_search_closed_at IS NULL
        AND (n.response_deadline IS NULL OR n.response_deadline>statement_timestamp())
        AND snap.reviewed_by_requester AND snap.classification_state='CONFIRMED'
    ) INTO v_valid;
    IF v_valid THEN
      -- Requeue, not dispatch. The next scheduler tick still enforces every
      -- signed service/scope, capacity, area, time, budget and duplicate gate.
      PERFORM private.enqueue_dispatch(NEW.need_id,statement_timestamp());
    END IF;
  ELSIF TG_TABLE_NAME='work_taxonomy_worker_bindings_v1' THEN
    IF NEW.result->>'status'<>'BOUND_WORKER_SERVICES' THEN RETURN NEW; END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.app_profiles p
      JOIN private.taxonomy_confirmed_worker_modes_v1 m
        ON m.worker_account_id=p.account_id
       AND m.source_review_id=NEW.source_review_id
       AND m.source_request_key=NEW.request_key
       AND m.active
      WHERE p.id=NEW.profile_id AND p.account_id=NEW.owner_account_id
        AND p.kind='WORKER' AND p.profile_status='ACTIVE'
    ) INTO v_valid;
    IF v_valid THEN
      -- Existing bounded/idempotent world-scoped requeue (max 200 Need rows).
      -- Nothing here grants an ability or emits a notification.
      PERFORM private.requeue_open_needs_for_worker_v5(NEW.owner_account_id);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Queue failures must never undo a verified owner Save/UUID receipt.
  -- Only a sanitized SQLSTATE; no account IDs, addresses, skills or task text.
  RAISE LOG 'TAXONOMY_BOUND_REQUEUE_FAILED:%',SQLSTATE;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION private.taxonomy_signed_binding_requeue_v1() FROM PUBLIC;
CREATE TRIGGER taxonomy_signed_need_bound_requeue_v1
AFTER INSERT ON private.work_taxonomy_need_bindings_v1
FOR EACH ROW EXECUTE FUNCTION private.taxonomy_signed_binding_requeue_v1();
CREATE TRIGGER taxonomy_signed_worker_bound_requeue_v1
AFTER INSERT ON private.work_taxonomy_worker_bindings_v1
FOR EACH ROW EXECUTE FUNCTION private.taxonomy_signed_binding_requeue_v1();
