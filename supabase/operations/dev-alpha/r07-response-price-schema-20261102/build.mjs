// Offline derivation. Two nullable columns; no price writer or certificate update.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = new URL('./', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
export const preimage = JSON.parse(read('preimage.json'));
export const metadataQuery = read('metadata.sql').trim().replace(/;$/, '');
export const closureQuery = `SELECT jsonb_build_object('schema',private.closure_schema_digest_v5_139(),
 'source',private.closure_source_digest_v5(),'erasure',private.closure_erasure_program_digest_v5(),
 'certificate',(SELECT sha256 FROM private.closure_source_v5 WHERE singleton),
 'source_ready',private.retention_ai_source_ready(),'export_binding',private.data_export_policy_binding(),
 'erasure_binding',private.closure_erasure_binding_v5())`;
const q = s => "'" + s.replaceAll("'", "''") + "'";
const hash = s => createHash('sha256').update(s).digest('hex');
export const ddl = preimage.tables.map(t => `ALTER TABLE public.${t.name} ADD COLUMN price_basis text
 CONSTRAINT ${t.name}_price_basis_check CHECK (price_basis IN ('TOTAL','HOURLY'));`).join('\n');
export const rollbackDdl = preimage.tables.map(t => `ALTER TABLE public.${t.name} DROP COLUMN price_basis RESTRICT;`).join('\n');
// attnum of the appended column can advance after DROP/re-ADD. Preserve every
// existing column's ordinal, and normalize only the new column's catalog slot.
const normalize = tables => tables.map(t => ({ ...t, columns: t.columns.map(c => c.name === 'price_basis' ? { ...c, number: 0 } : c) }));
const normalizedMetadata = `SELECT jsonb_agg(t.value || jsonb_build_object('columns',
 (SELECT jsonb_agg(CASE WHEN c.value->>'name'='price_basis' THEN c.value || '{"number":0}'::jsonb ELSE c.value END ORDER BY c.ordinality)
 FROM jsonb_array_elements(t.value->'columns') WITH ORDINALITY c)) ORDER BY t.ordinality)
 FROM jsonb_array_elements((${metadataQuery})) WITH ORDINALITY t`;
export function buildPackage(pre) {
 assert.equal(pre.closure.source_ready, false);
 assert.equal(pre.post_closure.source_ready, false);
 for (const k of ['erasure','certificate','export_binding','erasure_binding','source_ready']) assert.deepEqual(pre.closure[k], pre.post_closure[k]);
 const postTables = pre.tables.map(t => ({ ...t,
  columns: [...t.columns, { name:'price_basis',number:0,type:'text',not_null:false,default:null,acl:null,identity:'',generated:'',collation:'100' }],
  constraints: [...t.constraints, { name:t.name+'_price_basis_check',validated:true,definition:"CHECK ((price_basis = ANY (ARRAY['TOTAL'::text, 'HOURLY'::text])))" }].sort((a,b)=>a.name.localeCompare(b.name,'en')),
 }));
 const guard = after => `IF current_database()<>${q(pre.database)} OR current_user<>${q(pre.owner)} OR current_setting('server_version_num')<>${q(pre.server_version_num)} THEN RAISE EXCEPTION 'R07_SCHEMA_CONTEXT_DRIFT'; END IF;
 IF (${normalizedMetadata}) IS DISTINCT FROM ${q(JSON.stringify(normalize(after ? postTables : pre.tables)))}::jsonb THEN RAISE EXCEPTION 'R07_SCHEMA_TABLE_DRIFT'; END IF;
 ${pre.functions.map(f=>`IF md5(pg_get_functiondef(to_regprocedure(${q(f.signature)}))) IS DISTINCT FROM ${q(f.md5)} THEN RAISE EXCEPTION 'R07_SCHEMA_FUNCTION_DRIFT'; END IF;`).join('\n ')}
 IF (${closureQuery}) IS DISTINCT FROM ${q(JSON.stringify(after ? pre.post_closure : pre.closure))}::jsonb THEN RAISE EXCEPTION 'R07_SCHEMA_CLOSURE_DRIFT'; END IF;`;
 const procs = `SELECT p.oid,to_jsonb(p) attributes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private','rls_private')`;
 const start = `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
 LOCK TABLE public.marketplace_response_versions,public.marketplace_responses IN ACCESS EXCLUSIVE MODE;
 CREATE TEMP TABLE r07_schema_functions ON COMMIT DROP AS ${procs};\n`;
 const finish = `DO $delta$ BEGIN IF EXISTS(SELECT 1 FROM r07_schema_functions b FULL JOIN (${procs}) a USING(oid) WHERE b.attributes IS DISTINCT FROM a.attributes) THEN RAISE EXCEPTION 'R07_SCHEMA_FUNCTION_DELTA'; END IF; END $delta$;
 NOTIFY pgrst,'reload schema'; COMMIT;\n`;
 const exists = `EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.marketplace_responses'::regclass AND attname='price_basis' AND NOT attisdropped)`;
 return {
  'preflight.sql':`BEGIN TRANSACTION READ ONLY; DO $guard$ BEGIN ${guard(false)} END $guard$; SELECT 'R07_RESPONSE_SCHEMA_PREIMAGE_MATCH' result; ROLLBACK;\n`,
  'promotion.sql':start+`DO $apply$ BEGIN IF ${exists} THEN ${guard(true)} ELSE ${guard(false)}\n${ddl}\n${guard(true)} END IF; END $apply$;\n`+finish,
  'postflight.sql':`BEGIN TRANSACTION READ ONLY; DO $guard$ BEGIN ${guard(true)} END $guard$; SELECT 'R07_RESPONSE_SCHEMA_POSTIMAGE_MATCH' result; ROLLBACK;\n`,
  'rollback.sql':start+`DO $rollback$ BEGIN ${guard(true)}
 IF EXISTS(SELECT 1 FROM public.marketplace_responses WHERE price_basis IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.marketplace_response_versions WHERE price_basis IS NOT NULL)
 THEN RAISE EXCEPTION 'R07_SCHEMA_ROLLBACK_WOULD_LOSE_UNITS'; END IF;
 ${rollbackDdl}\n${guard(false)} END $rollback$;\n`+finish,
 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const files = buildPackage(preimage);
 files['manifest.json'] = JSON.stringify({status:'PREPARED_NOT_APPLIED',project:preimage.project_ref,
  scope:'Add nullable response/response-version price_basis only; hourly writers remain disabled',
  preimage_sha256:hash(read('preimage.json')),metadata_sha256:hash(read('metadata.sql')),
  forecast_sha256:hash(read('forecast-schema.sql')),schema_digest_source_sha256:hash(read('schema-digest-source.sql')),
  closure_before:preimage.closure,closure_after:preimage.post_closure,
  files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,hash(s)]))},null,2)+'\n';
 for(const [name,content] of Object.entries(files)) {
  if(process.argv.includes('--check')) assert.equal(read(name),content,'Generated drift: '+name);
  else writeFileSync(new URL(name,root),content);
 }
 console.log('R07_RESPONSE_SCHEMA_PACKAGE_PASS');
}
