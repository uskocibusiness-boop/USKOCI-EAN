-- A passing assertion here demonstrates the original regression, not readiness.
SELECT proof.reset();
SELECT proof.require(md5(pg_get_functiondef('public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)'::regprocedure))
 = 'f0b4b83e5aba8b0a6e834f35f97a72c9','EXACT_PREDECESSOR_REQUIRED');
SELECT proof.require((SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1 WHERE active AND execution_scope='REMOTE'),
 'SAVED_REMOTE_FIXTURE_REQUIRED');
SELECT proof.require((SELECT expires_at<clock_timestamp() FROM private.worker_ai_reviews WHERE id=proof.original()),
 'SAVED_REVIEW_IS_HISTORICALLY_EXPIRED');
SELECT proof.expect_pending('BASELINE_DID_NOT_REPRODUCE_SAVED_MODE_LOSS');

