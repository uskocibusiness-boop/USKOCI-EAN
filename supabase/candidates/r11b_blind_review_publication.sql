-- R11b/S13 BLIND PUBLICATION: LOCAL_ONLY future rollout candidate, not deployed.
-- 31 Oct DEV metadata PIN: source reader bodies and ACL/owner stay unchanged
-- except for narrow filter; review push delivery and erasure remain separate gates.
BEGIN;
DO $guard$
BEGIN
 IF current_setting('uskoci.r11b_blind.disposable',true) IS DISTINCT FROM 'LOCAL_ONLY'
  OR current_user<>'postgres' OR current_database()<>'postgres'
  OR to_regrole('cli_login_postgres') IS NOT NULL
  OR to_regprocedure('private.agreement_review_publication_ready_v1(uuid,timestamp with time zone)') IS NOT NULL
 THEN RAISE EXCEPTION 'R11B_LOCAL_ONLY' USING errcode='55000'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('private.account_reputation(uuid)'))) IS DISTINCT FROM '05e252f69f7e0dff14527f83cac18ada'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_list_received_reviews_v1(integer,text)'))) IS DISTINCT FROM '839db76bca79fb3bac96c371a4cfd156'
 OR md5(pg_get_functiondef(to_regprocedure('public.rpc_list_review_comments_v1(uuid,integer,jsonb)'))) IS DISTINCT FROM 'a45554c0b1e1d5093b6d9a7fa7ee832f'
 THEN RAISE EXCEPTION 'R11B_CURRENT_READERS_DRIFT' USING errcode='55000'; END IF;
END; $guard$;

-- TESTABLE FUNCTION BEGINS (installed separately in PGlite fixture).
CREATE FUNCTION private.agreement_review_publication_ready_v1(
 p_agreement_id uuid,p_as_of timestamptz DEFAULT statement_timestamp())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $r11$
 SELECT p_agreement_id IS NOT NULL AND p_as_of IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.agreements a
  JOIN public.agreement_execution ae ON ae.agreement_id=a.id
  WHERE a.id=p_agreement_id AND a.requester_account_id IS NOT NULL AND a.worker_account_id IS NOT NULL
   AND a.requester_account_id<>a.worker_account_id
   AND a.status='COMPLETED' AND ae.state='COMPLETED'
   AND ae.agreement_version=a.current_version AND ae.completed_at IS NOT NULL
   AND (ae.completed_at+interval '14 days'<=p_as_of OR (
    EXISTS(SELECT 1 FROM private.agreement_reviews r
      WHERE r.agreement_id=a.id AND r.reviewer_account_id=a.requester_account_id
       AND r.target_account_id=a.worker_account_id)
    AND EXISTS(SELECT 1 FROM private.agreement_reviews r
      WHERE r.agreement_id=a.id AND r.reviewer_account_id=a.worker_account_id
       AND r.target_account_id=a.requester_account_id)
   ))
 );
$r11$;
REVOKE ALL ON FUNCTION private.agreement_review_publication_ready_v1(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;
-- TESTABLE FUNCTION ENDS.

-- Exact DEV definitions checked above before any replacement; no blanket waiver.
-- CREATE OR REPLACE preserves every original signature/owner/ACL/search_path.
DO $patch$
DECLARE v_old text;v_new text;v_anchor text;v_replacement text;v_signature text;
BEGIN
 FOR v_signature,v_anchor,v_replacement IN SELECT * FROM (VALUES
  ('private.account_reputation(uuid)',
   'from private.agreement_reviews where target_account_id=account_id;',
   'from private.agreement_reviews rv where rv.target_account_id=account_id and private.agreement_review_publication_ready_v1(rv.agreement_id);'),
  ('public.rpc_list_received_reviews_v1(integer,text)',
   'where rv.target_account_id = v_actor',
   'where rv.target_account_id = v_actor and private.agreement_review_publication_ready_v1(rv.agreement_id)'),
  ('public.rpc_list_review_comments_v1(uuid,integer,jsonb)',
   'where c.target_account_id=v_profile.account_id and c.hidden_at is null',
   'where c.target_account_id=v_profile.account_id and c.hidden_at is null and private.agreement_review_publication_ready_v1(rv.agreement_id)')
 ) v(signature,anchor,replacement) LOOP
  v_old:=pg_get_functiondef(to_regprocedure(v_signature));
  IF v_old IS NULL OR length(v_old)-length(replace(v_old,v_anchor,''))<>length(v_anchor)
  THEN RAISE EXCEPTION 'R11B_READER_ANCHOR_DRIFT' USING errcode='55000'; END IF;
  v_new:=replace(v_old,v_anchor,v_replacement);
  EXECUTE v_new;
  IF position('private.agreement_review_publication_ready_v1(rv.agreement_id)' in
     pg_get_functiondef(to_regprocedure(v_signature)))=0
  THEN RAISE EXCEPTION 'R11B_READER_NOT_GATED' USING errcode='55000'; END IF;
 END LOOP;
END; $patch$;
COMMIT;
