BEGIN;
\ir before.sql
DROP FUNCTION private.taxonomy_handoff_valid_v1(jsonb);
DROP FUNCTION private.taxonomy_category_path_valid_v1(uuid);
COMMIT;
