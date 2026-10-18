-- First run must fail ALIAS_CONTEXT_MISSING on before.sql; after migration all checks pass.
DO $proof$
DECLARE v jsonb; node jsonb; page2 jsonb; old_fingerprint text; original_version bigint;
BEGIN
 v:=private.taxonomy_ai_catalog_context_v1('REMOTE',100,NULL);
 IF NOT(v ? 'catalogFingerprint') THEN RAISE EXCEPTION 'ALIAS_CONTEXT_MISSING'; END IF;
 IF v->>'catalogFingerprint'<>private.taxonomy_admission_fingerprint_v1()
 OR v->>'classificationAuthority'<>'NONE' OR v->>'capabilityAuthority'<>'NONE'
 OR v->>'notificationAuthority'<>'NONE' OR v->>'count'<>'2'
 THEN RAISE EXCEPTION 'ALIAS_CATALOG_AUTHORITY_OR_SCOPE'; END IF;
 SELECT value INTO STRICT node FROM jsonb_array_elements(v->'items')
 WHERE value->>'label'='3D printovanje';
 IF node->'aliases'<>'["3D štampa","Izrada 3D figurica"]'::jsonb
 OR node->'path'<>'["Digitalne usluge","3D printovanje"]'::jsonb
 THEN RAISE EXCEPTION 'ALIAS_CATALOG_EXACT_LINK'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'items') n WHERE n->>'label' IN ('Fotografisanje','Nepotvrđena kategorija'))
 THEN RAISE EXCEPTION 'ALIAS_CATALOG_UNSUPPORTED_NODE'; END IF;
 SELECT value INTO STRICT node FROM jsonb_array_elements(v->'items') WHERE value->>'label'='Digitalne usluge';
 IF node->'aliases'<>'[]'::jsonb THEN RAISE EXCEPTION 'ALIAS_EMPTY_REQUIRED'; END IF;
 v:=private.taxonomy_ai_catalog_context_v1('REMOTE',1,NULL);
 page2:=private.taxonomy_ai_catalog_context_v1('REMOTE',1,v->>'nextAfter');
 IF v->>'catalogFingerprint'<>page2->>'catalogFingerprint'
 OR v->'items'->0->>'categoryId'=page2->'items'->0->>'categoryId'
 THEN RAISE EXCEPTION 'ALIAS_PAGING_CONTINUITY'; END IF;
 old_fingerprint:=v->>'catalogFingerprint';
 SELECT catalog_version INTO original_version FROM private.work_taxonomy_control;
 INSERT INTO private.work_taxonomy_aliases VALUES('00000000-0000-4000-8000-000000000002','Dodatni provereni naziv','sr','dodatni provereni naziv');
 v:=private.taxonomy_ai_catalog_context_v1('REMOTE',100,NULL);
 IF old_fingerprint=v->>'catalogFingerprint' OR (v->>'catalogVersion')::bigint<>original_version
 THEN RAISE EXCEPTION 'ALIAS_MUTATION_WITHOUT_VERSION_NOT_DETECTED'; END IF;
 DELETE FROM private.work_taxonomy_aliases WHERE normalized_key='dodatni provereni naziv';
 IF (private.taxonomy_ai_catalog_context_v1('BAD',100,NULL))->>'action'<>'CLARIFY'
 OR (private.taxonomy_ai_catalog_context_v1('REMOTE',101,NULL))->>'action'<>'CLARIFY'
 THEN RAISE EXCEPTION 'ALIAS_READER_INPUT_GUARD'; END IF;
 RAISE NOTICE 'ALIAS_CONTEXT_EXACT_SCOPE_FINGERPRINT_PAGING_PASS';
END $proof$;
SET ROLE service_role;
SELECT CASE WHEN private.taxonomy_ai_catalog_context_v1('REMOTE',100,NULL)->>'action'='CATALOG_CONTEXT' THEN true ELSE false END as service_role_can_read;
RESET ROLE;
DO $acl$
BEGIN
 IF has_function_privilege('anon','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 OR has_function_privilege('authenticated','private.taxonomy_ai_catalog_context_v1(text,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'ALIAS_PUBLIC_ACCESS'; END IF;
END $acl$;
