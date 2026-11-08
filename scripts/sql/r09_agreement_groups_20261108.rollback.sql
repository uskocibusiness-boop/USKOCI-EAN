-- Roll back the client before removing its additive reader. No business rows,
-- old readers, Agreement/review writers, RLS policies or indexes are changed.
BEGIN;
DO $rollback$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)'))
      IS DISTINCT FROM '9149868e6241948f89d3f54f378e4946'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.agreement_list_instant_v1(text)'))
      IS DISTINCT FROM '069eb961b036f7a2cc733c9f61d72d66'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('private.agreement_list_search_v1(text)'))
      IS DISTINCT FROM 'fc532bd40c1c7d03f22dc0faa3e4b393' THEN
    RAISE EXCEPTION 'AGREEMENT_GROUPS_ROLLBACK_BODY_MISMATCH';
  END IF;
END;
$rollback$;
DROP FUNCTION public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb);
DROP FUNCTION private.agreement_list_instant_v1(text);
DROP FUNCTION private.agreement_list_search_v1(text);
COMMIT;
