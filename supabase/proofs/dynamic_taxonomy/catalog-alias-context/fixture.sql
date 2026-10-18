-- Disposable PostgreSQL only. Minimal tables required by the exact live reader.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA private;
CREATE TABLE private.work_taxonomy_control(singleton boolean PRIMARY KEY,catalog_version bigint NOT NULL);
CREATE TABLE private.work_taxonomy_categories(
 id uuid PRIMARY KEY,canonical_key text NOT NULL UNIQUE,label text NOT NULL,
 parent_id uuid REFERENCES private.work_taxonomy_categories(id),state text NOT NULL,catalog_version bigint NOT NULL);
CREATE TABLE private.work_taxonomy_category_modes(category_id uuid REFERENCES private.work_taxonomy_categories(id),execution_scope text,PRIMARY KEY(category_id,execution_scope));
CREATE TABLE private.work_taxonomy_aliases(category_id uuid REFERENCES private.work_taxonomy_categories(id),label text,locale text,normalized_key text);
CREATE FUNCTION private.taxonomy_execution_scope_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
 SELECT CASE $1 WHEN 'REMOTE' THEN 'REMOTE' WHEN 'STATIONARY' THEN 'ON_SITE' ELSE NULL END
$f$;
CREATE OR REPLACE FUNCTION private.taxonomy_admission_fingerprint_v1()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
SELECT md5(
 coalesce((SELECT string_agg(c.id::text||'/'||c.canonical_key||'/'||
      coalesce(c.parent_id::text,'ROOT')||'/'||c.state||'/'||c.catalog_version::text,'|' ORDER BY c.id::text)
      FROM private.work_taxonomy_categories c),'')
 || '#'
 || coalesce((SELECT string_agg(m.category_id::text||'/'||m.execution_scope,'|' ORDER BY m.category_id::text,m.execution_scope)
      FROM private.work_taxonomy_category_modes m),'')
 || '#'
 || coalesce((SELECT string_agg(a.category_id::text||'/'||a.locale||'/'||a.normalized_key,'|' ORDER BY a.category_id::text,a.locale,a.normalized_key)
      FROM private.work_taxonomy_aliases a),'')
);
$function$
;

INSERT INTO private.work_taxonomy_control VALUES(true,4);
INSERT INTO private.work_taxonomy_categories VALUES
 ('00000000-0000-4000-8000-000000000001','digitalne usluge','Digitalne usluge',NULL,'ESTABLISHED',1),
 ('00000000-0000-4000-8000-000000000002','3d printovanje','3D printovanje','00000000-0000-4000-8000-000000000001','ESTABLISHED',1),
 ('00000000-0000-4000-8000-000000000003','fotografisanje','Fotografisanje',NULL,'ESTABLISHED',1),
 ('00000000-0000-4000-8000-000000000004','nacrt','Nepotvrđena kategorija',NULL,'CANDIDATE',1);
INSERT INTO private.work_taxonomy_category_modes VALUES
 ('00000000-0000-4000-8000-000000000001','REMOTE'),
 ('00000000-0000-4000-8000-000000000001','ON_SITE'),
 ('00000000-0000-4000-8000-000000000002','REMOTE'),
 ('00000000-0000-4000-8000-000000000003','ON_SITE'),
 ('00000000-0000-4000-8000-000000000004','REMOTE');
INSERT INTO private.work_taxonomy_aliases VALUES
 ('00000000-0000-4000-8000-000000000002','3D štampa','sr','3d stampa'),
 ('00000000-0000-4000-8000-000000000002','3D štampa','sr-Latn','3d stampa'),
 ('00000000-0000-4000-8000-000000000002','Izrada 3D figurica','sr','izrada 3d figurica'),
 ('00000000-0000-4000-8000-000000000003','Snimanje fotografija','sr','snimanje fotografija'),
 ('00000000-0000-4000-8000-000000000004','Neodobrena usluga','sr','neodobrena usluga');
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA private TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;
