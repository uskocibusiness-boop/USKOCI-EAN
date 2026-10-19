BEGIN;
SELECT proof.require(NOT EXISTS(SELECT 1 FROM proof.mode_before b JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE md5(pg_get_functiondef(p.oid))<>b.definition_md5 OR p.proowner<>b.proowner
 OR p.proacl IS DISTINCT FROM b.proacl OR p.proconfig IS DISTINCT FROM b.proconfig),'EXACT_PREDECESSOR_OR_ROLLBACK');
DO $$ DECLARE p jsonb; BEGIN
 PERFORM proof.reset();
 DELETE FROM private.work_taxonomy_category_modes WHERE category_id=proof.id(501) AND execution_scope='REMOTE';
 p:=proof.prepare('CREATE_CHILD',ARRAY['REMOTE'],ARRAY['Restauracija muzičkih kutija'],proof.id(501));
 PERFORM proof.require(p->>'status'='PENDING_CLASSIFICATION','BEFORE_PARENT_MODE_BLOCKS_NEW_LEAF');
 PERFORM proof.reset();PERFORM proof.seed_service();
 PERFORM proof.expect_error($q$SELECT proof.prepare_mode('Restauracija muzičkih kutija','REMOTE','EXTEND_MODE',proof.id(601))$q$,'TAXONOMY_CAPTURE_PLAN_INVALID');
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES(proof.id(601),'REMOTE','SYNTHETIC');
 PERFORM proof.require(private.taxonomy_ai_catalog_context_v1('REMOTE',100,null)->>'reason'='CATALOG_PARENT_OR_MODE_INTEGRITY_ERROR',
  'BEFORE_OLD_READER_REJECTS_DIRECT_REMOTE_CHILD');
 PERFORM proof.reject($q$SELECT public.rpc_taxonomy_query_catalog_service('{"operation":"EXACT","text":"Restauracija muzičkih kutija"}')$q$,
  'TAXONOMY_QUERY_PARENT_OR_MODE_INTEGRITY','55000');
END $$;
ROLLBACK;
SELECT 'PARENT_MODE_PREDECESSOR_REPRODUCED' result;
