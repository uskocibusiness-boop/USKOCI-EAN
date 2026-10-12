-- Disposable Postgres only. Proves server mode context and safe pagination.
\set ON_ERROR_STOP on
DO $proof$
DECLARE
 onsite jsonb; remote jsonb; p1 jsonb; p2 jsonb;
 item jsonb; found boolean; bad uuid; phys uuid;
BEGIN
 onsite:=private.taxonomy_ai_catalog_context_v1('STATIONARY',100,NULL);
 remote:=private.taxonomy_ai_catalog_context_v1('REMOTE',100,NULL);
 IF onsite->>'action'<>'CATALOG_CONTEXT'
 OR remote->>'action'<>'CATALOG_CONTEXT'
 OR onsite->>'scope'<>'ON_SITE'
 OR remote->>'scope'<>'REMOTE'
 OR (onsite->>'catalogVersion')::bigint<>3
 OR (remote->>'catalogVersion')::bigint<>3
 OR (onsite->>'count')::integer+(remote->>'count')::integer<>82
 OR onsite->>'classificationAuthority'<>'NONE'
 OR onsite->>'notificationAuthority'<>'NONE'
 OR onsite->>'capabilityAuthority'<>'NONE'
 OR remote->>'notificationAuthority'<>'NONE'
 THEN RAISE EXCEPTION 'AI_CATALOG_CONTEXT_CROSS_SCOPE_OR_AUTHORITY_%_%',onsite,remote; END IF;
 SELECT x INTO item FROM jsonb_array_elements(onsite->'items') x
 WHERE x->>'label'='Krečenje zidova';
 IF item IS NULL OR item->'path'<>'["Molerski radovi","Krečenje","Krečenje zidova"]'::jsonb
 OR item->>'isLeaf'<>'true'
 THEN RAISE EXCEPTION 'DEEP_MOLER_PATH_LOST_%',item; END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_array_elements(remote->'items') x
  WHERE x->>'label' IN ('Krečenje zidova','Kupovina karata','Zamena utičnica')
 ) THEN RAISE EXCEPTION 'ONSITE_CATEGORY_LEAKED_INTO_REMOTE'; END IF;
 SELECT x INTO item FROM jsonb_array_elements(remote->'items') x
 WHERE x->>'label'='Izrada logotipa';
 IF item IS NULL OR item->'path'<>'["Digitalne usluge","Grafički dizajn","Izrada logotipa"]'::jsonb
 THEN RAISE EXCEPTION 'REMOTE_GRAPHIC_PATH_LOST_%',item; END IF;
 p1:=private.taxonomy_ai_catalog_context_v1('STATIONARY',7,NULL);
 IF p1->>'count'<>'7' OR p1->>'nextAfter' IS NULL
 THEN RAISE EXCEPTION 'INVALID_FIRST_CURSOR_PAGE_%',p1; END IF;
 p2:=private.taxonomy_ai_catalog_context_v1('STATIONARY',7,p1->>'nextAfter');
 IF p2->>'count'<>'7' THEN RAISE EXCEPTION 'INVALID_SECOND_CURSOR_PAGE'; END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p1->'items') a
  JOIN jsonb_array_elements(p2->'items') b
    ON a->>'categoryId'=b->>'categoryId'
 ) THEN RAISE EXCEPTION 'DUPLICATED_CURSOR_ITEMS'; END IF;
 IF (private.taxonomy_ai_catalog_context_v1('BAD_MODE',80,NULL))->>'action'<>'CLARIFY'
 OR (private.taxonomy_ai_catalog_context_v1('REMOTE',0,NULL))->>'action'<>'CLARIFY'
 OR (private.taxonomy_ai_catalog_context_v1('REMOTE',101,NULL))->>'action'<>'CLARIFY'
 OR has_function_privilege('authenticated','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 OR has_function_privilege('anon','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 OR NOT has_function_privilege('service_role','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'PAGING_OR_AUTHORITY_NOT_FAIL_CLOSED'; END IF;

 -- A broken cross-mode ancestry chain cannot be silently presented as a
 -- valid candidate to Gemini even if somebody misconfigures the data later.
 SELECT id INTO STRICT phys FROM private.work_taxonomy_categories
 WHERE canonical_key=private.taxonomy_normalize_v1('Fizički poslovi');
 INSERT INTO private.work_taxonomy_categories
 (canonical_key,label,parent_id,source,catalog_version,state)
 VALUES(private.taxonomy_normalize_v1('Namerno pogrešna grana'),
 'Namerno pogrešna grana',phys,'OPERATOR',3,'ESTABLISHED')
 RETURNING id INTO bad;
 INSERT INTO private.work_taxonomy_category_modes(category_id,execution_scope,source_ref)
 VALUES(bad,'REMOTE','DISPOSABLE_FORGED_SCOPE');
 IF (private.taxonomy_ai_catalog_context_v1('REMOTE',100,NULL))->>'reason'
 <> 'CATALOG_PARENT_OR_MODE_INTEGRITY_ERROR'
 THEN RAISE EXCEPTION 'ORPHAN_MODE_SHOULD_BLOCK_AI_CONTEXT'; END IF;

 RAISE NOTICE 'TAXONOMY_AI_CATALOG_MODE_PAGINATION_READ_ONLY_PASS';
END $proof$;
