-- Read-only. Does not apply the local candidate.
select now() as checked_at, current_setting('server_version') as postgres_version,
 p.oid::regprocedure::text as signature, md5(p.prosrc) as body_md5,
 p.prosecdef as security_definer, p.provolatile as volatility, p.proconfig,
 p.proacl::text as acl, pg_get_userbyid(p.proowner) as owner,
 md5(p.prosrc)='a9b0985991f4ebfe4e95143e5cf57222' as expected_predecessor,
 md5(p.prosrc)='804b3b469128e65d46015c7f81f7adee' as exact_candidate_body
from pg_proc p where p.oid=to_regprocedure('public.rpc_discovery_v1(jsonb)');
