-- PASS here reproduces the missing baseline, not the repaired behavior.
SELECT proof.context_reset();
UPDATE private.worker_ai_sessions SET revision=1,candidate=jsonb_set(candidate,'{bio}','"Only description changed"')
 WHERE conversation_id=proof.fresh();
SELECT proof.add_current_hint(ARRAY['ON_SITE','REMOTE']);
SELECT proof.require(md5(pg_get_functiondef('public.rpc_read_worker_ai_context_service(uuid,uuid)'::regprocedure))
 ='24b1dbfde5aa4dfa1277b5ac294effe0','EXACT_CONTEXT_PREDECESSOR');
SELECT proof.require(NOT(proof.context()?'serviceModeContext')
 AND proof.context()#>>'{candidate,bio}'='Only description changed',
 'BEFORE_REPRODUCES_BIO_EDIT_WITH_NO_SAVED_MODE_CONTEXT');
SELECT proof.require((SELECT count(*)=1 FROM private.taxonomy_confirmed_worker_modes_v1
 WHERE active AND execution_scope='REMOTE'),'SAVED_REMOTE_EXISTS_BUT_PROVIDER_CANNOT_SEE_IT');
SELECT 'worker mode context: missing baseline reproduced' AS result;

