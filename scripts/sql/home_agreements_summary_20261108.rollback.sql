-- Candidate rollback for coordinator review. Retire a future client first.
-- Refuse to remove a changed reader or helper. Never cascade; no data is deleted.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $rollback$
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
      RAISE EXCEPTION 'HOME_AGREEMENTS_ROLLBACK_MISMATCH';
    END IF;
  END LOOP;
END;
$rollback$;
DROP FUNCTION public.rpc_home_agreement_prompts_page_v1(integer,jsonb);
DROP FUNCTION public.rpc_home_agreements_summary_v1();
DROP FUNCTION private.home_agreement_facts_v1();
COMMIT;
