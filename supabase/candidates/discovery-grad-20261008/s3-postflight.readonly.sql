-- DISCOVERY-GRAD S3 read-only postflight. No write. Expected: readerS3 true and the certificate equal to the preflight.
select jsonb_build_object(
 'readerS3',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)'))='225edbb8e090395db004b256e7447269',
 'readerAcl',(select proacl::text from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
 'helper',(select md5(prosrc) from pg_proc where oid=to_regprocedure('public.discovery_fold_v1(text)'))='41353abe05d434d513495ae5974b9802',
 'certificateReady',private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)
   and private.closure_source_digest_v5()=(select sha256 from private.closure_erasure_source_v5 where singleton)
   and private.retention_ai_source_ready(),
 'closureDigest',private.closure_source_digest_v5(),
 'erasureProgramDigest',private.closure_erasure_program_digest_v5()
) as discovery_grad_s3_postflight;
