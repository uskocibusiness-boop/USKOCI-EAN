-- R10/R12: read-only closure-source roster inventory, NOT an admission or recertification.
-- Reads only system catalogs and one technical singleton certificate. No business/Auth records,
-- no DDL, no grants, no fixture, no service/Storage call and no source-hash rewriting.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='25s';
WITH digester AS MATERIALIZED (
  SELECT p.prosrc FROM pg_proc p
  WHERE p.oid=to_regprocedure('private.closure_source_digest_v5()')
    AND md5(p.prosrc)='41e54d223122b58decd25cf66191470a'
), roster_text AS MATERIALIZED (
  SELECT split_part(split_part(prosrc,'from unnest(array[',2),']) signature',1) AS source_text
  FROM digester
), signatures AS MATERIALIZED (
  SELECT (hits.matches)[1] AS signature
  FROM roster_text r
  CROSS JOIN LATERAL regexp_matches(r.source_text,
    $$'((public|private)\.[a-z_][a-z0-9_]*\([^']*\))'$$,'g') AS hits(matches)
), body_inventory AS MATERIALIZED (
  SELECT s.signature,p.oid,md5(p.prosrc) body_md5,
    md5(p.proconfig::text) config_md5,md5(p.proacl::text) acl_md5,
    md5(pg_get_userbyid(p.proowner)) owner_md5,p.prosecdef
  FROM signatures s LEFT JOIN pg_proc p ON p.oid=to_regprocedure(s.signature)
)
SELECT jsonb_build_object(
  'unit','R10_R12_CLOSURE_ROSTER_READONLY','format_version',1,
  'read_only',current_setting('transaction_read_only'),
  'database',current_database(),
  'server_version_num',current_setting('server_version_num')::integer,
  'digester_source_pinned',(SELECT count(*)=1 FROM digester),
  'retention_source_pinned',(SELECT count(*)=1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('private.retention_ai_source_ready()')
      AND md5(p.prosrc)='b89891cd3eb5f327bd642a160e5a2e81'),
  'roster_count',(SELECT count(*) FROM signatures),
  'roster_unique',(SELECT count(DISTINCT signature)=count(*) FROM signatures),
  'resolved_count',(SELECT count(oid) FROM body_inventory),
  'definer_count',(SELECT count(*) FROM body_inventory WHERE prosecdef),
  'schema_relation_count',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname IN ('public','private') OR c.oid='storage.objects'::regclass)
      AND c.relkind IN ('r','p')),
  'roster_md5',(SELECT md5(string_agg(signature||':'||body_md5,E'\n' ORDER BY signature))
     FROM body_inventory),
  'source_digest',private.closure_source_digest_v5(),
  'source_certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
  'source_ready',private.retention_ai_source_ready(),
  'schema_digest',private.closure_schema_digest_v5_139(),
  'erasure_program_digest',private.closure_erasure_program_digest_v5(),
  'source_roster',(SELECT jsonb_agg(jsonb_build_object(
    'signature',signature,'body_md5',body_md5,'config_md5',config_md5,
    'acl_md5',acl_md5,'owner_md5',owner_md5,'security_definer',prosecdef)
    ORDER BY signature) FROM body_inventory)
) AS proof;
ROLLBACK;
