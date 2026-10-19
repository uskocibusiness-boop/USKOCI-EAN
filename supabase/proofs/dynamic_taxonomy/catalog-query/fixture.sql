-- Disposable PG only. No production rows, account sessions or network calls.
\set ON_ERROR_STOP on
\ir ../catalog-alias-context/fixture.sql
\ir current-dependencies.sql
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO service_role;
CREATE SCHEMA proof;
CREATE FUNCTION proof.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE FUNCTION proof.require(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION proof.reject(statement text,message text,code text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;state text;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT,state=RETURNED_SQLSTATE; END;
 PERFORM proof.require(actual=message AND state=code,'EXPECTED '||code||' '||message||', GOT '||coalesce(state,'SUCCESS')||' '||coalesce(actual,''));
END $$;
-- More than the old global shortlist, with a real multi-page same-alias set.
INSERT INTO private.work_taxonomy_categories
 SELECT proof.id(1000+n),'proba usluge '||lpad(n::text,4,'0'),'Proba usluge '||lpad(n::text,4,'0'),null,'ESTABLISHED',4
 FROM generate_series(1,220) n;
INSERT INTO private.work_taxonomy_category_modes
 SELECT proof.id(1000+n),'REMOTE' FROM generate_series(1,220) n;
INSERT INTO private.work_taxonomy_category_modes
 SELECT proof.id(1000+n),'ON_SITE' FROM generate_series(1,220) n WHERE n%2=0;
INSERT INTO private.work_taxonomy_aliases
 SELECT proof.id(1000+n),'Zajednička usluga','synthetic-'||n,'zajednicka usluga' FROM generate_series(1,130) n;
-- Ancestry exceeds twenty levels. All modes are explicitly present at each node.
INSERT INTO private.work_taxonomy_categories
 SELECT proof.id(2000+n),'duboka grana '||lpad(n::text,4,'0'),'Duboka grana '||lpad(n::text,4,'0'),
  CASE n WHEN 1 THEN proof.id(1) ELSE proof.id(1999+n) END,'ESTABLISHED',4 FROM generate_series(1,25) n;
INSERT INTO private.work_taxonomy_category_modes
 SELECT proof.id(2000+n),mode FROM generate_series(1,25) n CROSS JOIN unnest(ARRAY['ON_SITE','REMOTE']) mode;
CREATE TABLE proof.before_data AS SELECT jsonb_build_object(
 'categories',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM private.work_taxonomy_categories c),
 'aliases',(SELECT jsonb_agg(to_jsonb(a) ORDER BY category_id,locale,label) FROM private.work_taxonomy_aliases a),
 'modes',(SELECT jsonb_agg(to_jsonb(m) ORDER BY category_id,execution_scope) FROM private.work_taxonomy_category_modes m),
 'control',(SELECT jsonb_agg(to_jsonb(c)) FROM private.work_taxonomy_control c)) value;
CREATE TABLE proof.before_functions AS SELECT oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) definition_md5,
 proowner,proacl,proconfig FROM pg_proc WHERE oid IN(
 'private.taxonomy_ai_catalog_context_v1(text,integer,text)'::regprocedure,
 'private.taxonomy_admission_fingerprint_v1()'::regprocedure,
 'private.taxonomy_normalize_v1(text)'::regprocedure);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
