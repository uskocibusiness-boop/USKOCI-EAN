-- USKOCI 2026-11-21: a cancelled Dogovor closes its pending change proposal, and the
-- Dogovor lists expose a pending change only for a CONFIRMED Dogovor.
-- Owner-approved DEV transfer 22.11.2026 (item 6, Dogovor logic). Never PROD.
-- Preimages were read with SELECT only on DEV leqcwgzvjsxugfgzdmth; exact definitions are in
-- rollback_agreement_cancel_pending_preimage_20261121.sql. Ownership, ACL, SECURITY DEFINER,
-- search_path, locking order, idempotency, messages, events and safety/closure guards are unchanged.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- 1) rpc_cancel_agreement: in the same transaction that sets CANCELLED, every still-pending
-- proposal of this Dogovor becomes SUPERSEDED (an existing terminal status; no responder,
-- because nobody answered it). Both proposal write guards admit this terminal update.
DO $cancel_closes_pending$
DECLARE
  target regprocedure := 'public.rpc_cancel_agreement(uuid,text)'::regprocedure;
  d text;
  original_metadata jsonb;
  expected text;
  anchor text := $old$  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
$old$;
  replacement text := $new$  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
  -- A cancelled Dogovor has no open change: a pending proposal can no longer be answered or
  -- withdrawn, so it is closed here, atomically with the cancellation.
  update public.agreement_change_proposals
     set status = 'SUPERSEDED', responded_at = statement_timestamp()
   where agreement_id = p_agreement_id and status = 'PENDING';
$new$;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM 'e592af7aead2172ff769f38aada8e056'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_CANCEL_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,anchor),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_CANCEL_ANCHOR_DRIFT';
  END IF;
  expected := md5(replace((SELECT prosrc FROM pg_proc WHERE oid=target),anchor,replacement));
  EXECUTE replace(d,anchor,replacement);
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM expected
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_CANCEL_POSTIMAGE_DRIFT'; END IF;
END
$cancel_closes_pending$;

-- 2) rpc_list_my_agreements_page: pendingChange only for a CONFIRMED Dogovor.
DO $list_pending_confirmed_only$
DECLARE
  target regprocedure := 'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'::regprocedure;
  d text;
  original_metadata jsonb;
  expected text;
  anchor text := $old$           where c.agreement_id = a.id and c.status = 'PENDING'
$old$;
  replacement text := $new$           where c.agreement_id = a.id and c.status = 'PENDING' and a.status = 'CONFIRMED'
$new$;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM '0f14c3a0a462096f5c3641fbd5629f43'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_LIST_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,anchor),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_LIST_ANCHOR_DRIFT';
  END IF;
  expected := md5(replace((SELECT prosrc FROM pg_proc WHERE oid=target),anchor,replacement));
  EXECUTE replace(d,anchor,replacement);
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM expected
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_LIST_POSTIMAGE_DRIFT'; END IF;
END
$list_pending_confirmed_only$;

-- 3) rpc_list_my_agreement_groups_page: the same rule; attention and rank 0 follow from it.
DO $groups_pending_confirmed_only$
DECLARE
  target regprocedure := 'public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)'::regprocedure;
  d text;
  original_metadata jsonb;
  expected text;
  anchor text := $old$WHERE c.agreement_id=a.id AND c.status='PENDING' ORDER BY$old$;
  replacement text := $new$WHERE c.agreement_id=a.id AND c.status='PENDING' AND a.agreement_status='CONFIRMED' ORDER BY$new$;
  actual record;
BEGIN
  SELECT md5(prosrc) body_md5, pg_get_userbyid(proowner) owner, proacl::text acl,
         prosecdef, proconfig, prokind, to_jsonb(p)-'prosrc' metadata
    INTO actual FROM pg_proc p WHERE p.oid=target;
  IF NOT FOUND OR actual.body_md5 IS DISTINCT FROM '9149868e6241948f89d3f54f378e4946'
     OR actual.owner IS DISTINCT FROM 'postgres'
     OR actual.acl IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     OR actual.prosecdef IS DISTINCT FROM true
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR actual.prokind IS DISTINCT FROM 'f'
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_GROUPS_PREIMAGE_DRIFT'; END IF;
  original_metadata := actual.metadata;
  d := pg_get_functiondef(target);
  IF array_length(string_to_array(d,anchor),1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_GROUPS_ANCHOR_DRIFT';
  END IF;
  expected := md5(replace((SELECT prosrc FROM pg_proc WHERE oid=target),anchor,replacement));
  EXECUTE replace(d,anchor,replacement);
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM expected
     OR (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM original_metadata
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_GROUPS_POSTIMAGE_DRIFT'; END IF;
END
$groups_pending_confirmed_only$;

-- 4) One bounded backfill: a proposal left PENDING on an already CANCELLED Dogovor (before
-- this fix) is closed the same way. DEV had 0 PENDING proposals at capture time.
DO $close_orphan_pending$
DECLARE closed integer;
BEGIN
  UPDATE public.agreement_change_proposals c
     SET status = 'SUPERSEDED', responded_at = statement_timestamp()
    FROM public.agreements a
   WHERE a.id = c.agreement_id AND a.status = 'CANCELLED' AND c.status = 'PENDING';
  GET DIAGNOSTICS closed = ROW_COUNT;
  RAISE NOTICE 'AGREEMENT_CANCEL_PENDING_BACKFILL closed=%', closed;
  IF EXISTS (SELECT 1 FROM public.agreement_change_proposals c JOIN public.agreements a ON a.id = c.agreement_id
              WHERE a.status = 'CANCELLED' AND c.status = 'PENDING')
  THEN RAISE EXCEPTION 'AGREEMENT_CANCEL_PENDING_BACKFILL_INCOMPLETE'; END IF;
END
$close_orphan_pending$;

COMMIT;
