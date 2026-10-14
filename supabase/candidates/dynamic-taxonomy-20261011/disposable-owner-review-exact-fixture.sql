-- Disposable PostgreSQL 16/17 only; minimal but shape-faithful catalog.
CREATE SCHEMA private;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION private.taxonomy_normalize_v1(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT btrim(regexp_replace(lower(coalesce(p_value,'')),'[[:space:]]+',' ','g'))
$$;
CREATE TABLE private.work_taxonomy_control(
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 catalog_version bigint NOT NULL);
INSERT INTO private.work_taxonomy_control VALUES(true,9);
CREATE TABLE private.work_taxonomy_categories(
 id uuid PRIMARY KEY,canonical_key text NOT NULL UNIQUE,label text NOT NULL,
 parent_id uuid,state text NOT NULL,catalog_version bigint NOT NULL);
CREATE TABLE private.work_taxonomy_category_modes(
 category_id uuid NOT NULL,execution_scope text NOT NULL,
 PRIMARY KEY(category_id,execution_scope));
CREATE TABLE private.work_taxonomy_aliases(
 category_id uuid NOT NULL,locale text NOT NULL,normalized_key text NOT NULL);
CREATE FUNCTION private.taxonomy_admission_fingerprint_v1() RETURNS text
LANGUAGE sql STABLE AS $$
 SELECT md5(coalesce((SELECT string_agg(id::text||'/'||canonical_key||'/'||
 coalesce(parent_id::text,'ROOT')||'/'||state||'/'||catalog_version::text,
 '|' ORDER BY id::text) FROM private.work_taxonomy_categories),'')
 ||'#'||coalesce((SELECT string_agg(category_id::text||'/'||execution_scope,'|'
 ORDER BY category_id::text,execution_scope) FROM private.work_taxonomy_category_modes),'')
 ||'#'||coalesce((SELECT string_agg(category_id::text||'/'||locale||'/'||normalized_key,'|'
 ORDER BY category_id::text,locale,normalized_key) FROM private.work_taxonomy_aliases),''))
$$;
INSERT INTO private.work_taxonomy_categories VALUES
('11111111-1111-4111-8111-111111111111','krečenje zidova','Krečenje zidova',null,'ESTABLISHED',9),
('22222222-2222-4222-8222-222222222222','izrada prezentacija','Izrada prezentacija',null,'ESTABLISHED',9),
('33333333-3333-4333-8333-333333333333','časovi umetničkog klizanja','Časovi umetničkog klizanja',null,'ESTABLISHED',9),
('44444444-4444-4444-8444-444444444444','iznajmljivanje klizaljki','Iznajmljivanje klizaljki',null,'ESTABLISHED',9);
INSERT INTO private.work_taxonomy_category_modes VALUES
('11111111-1111-4111-8111-111111111111','ON_SITE'),
('22222222-2222-4222-8222-222222222222','REMOTE'),
('33333333-3333-4333-8333-333333333333','ON_SITE'),
('44444444-4444-4444-8444-444444444444','ON_SITE');
INSERT INTO private.work_taxonomy_aliases VALUES
('22222222-2222-4222-8222-222222222222','sr','pravljenje prezentacija');

-- Minimal row types needed to PARSE the existing canonical review builder.
-- Do not execute the full builder with synthetic account or privacy data.
CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY);
CREATE TABLE public.needs(id uuid PRIMARY KEY);
