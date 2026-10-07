-- DISCOVERY-ZAMENE read-only postflight. No write. Expected: every flag true.
select jsonb_build_object(
 'readerAfter',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)'))='dc69802e3ba209232a8be095f60e9c9f',
 'helpers',(select bool_and(md5(p.prosrc) is not distinct from x.body_md5 and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}') from (values
  ('public.discovery_for_me_state_v1()','bd4dcf16863e7564a5d82ac22aca1418'),
  ('public.discovery_for_me_v1(uuid)','60c104139cebbccfa16a570fc3386c0c')) x(signature,body_md5) left join pg_proc p on p.oid=to_regprocedure(x.signature)),
 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
 'closureDigest',private.closure_source_digest_v5(),
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready()
) as discovery_zamene_postflight;
