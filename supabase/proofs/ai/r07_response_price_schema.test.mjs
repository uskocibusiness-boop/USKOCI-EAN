// Current DEV table shapes + real generated guarded package in isolated PG.
// Auth/closed-account context and unrelated closure bindings are explicit
// fixtures. This proves schema compatibility, not hosted Auth or complete R10.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {buildPackage,preimage,metadataQuery,closureQuery,ddl} from '../../operations/dev-alpha/r07-response-price-schema-20261102/build.mjs';
const root=new URL('../../operations/dev-alpha/r07-response-price-schema-20261102/',import.meta.url);
const db=new PGlite({extensions:{pgcrypto}});
after(()=>db.close());
const value=async sql=>Object.values((await db.query(sql)).rows[0])[0];
const rows=async sql=>(await db.query(sql)).rows;
const fail=async(sql,message)=>{await assert.rejects(db.exec(sql),new RegExp(message));await db.exec('ROLLBACK');};
const legacyInsert=`INSERT INTO public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,price_rsd)
 VALUES('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','APPLICATION','SUBMITTED',1,4500);
 INSERT INTO public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,content_hash)
 VALUES('11111111-1111-4111-8111-111111111111',1,1,4500,1,'immutable-legacy-content-hash');`;
const snapshot=()=>value(`SELECT jsonb_build_object('response',(SELECT to_jsonb(r)-'price_basis' FROM public.marketplace_responses r),
 'versions',(SELECT jsonb_agg(to_jsonb(v)-'price_basis' ORDER BY version) FROM public.marketplace_response_versions v))`);
test('checked-in SQL is exactly derived and digest implementation is the captured DEV function',()=>{
 for(const [name,sql] of Object.entries(buildPackage(preimage))) assert.equal(readFileSync(new URL(name,root),'utf8'),sql,name);
 const digest=readFileSync(new URL('schema-digest-source.sql',root),'utf8');
 assert.equal(createHash('md5').update(digest).digest('hex'),preimage.functions.find(f=>f.signature==='private.closure_schema_digest_v5_139()').md5);
});
test('two-column expansion fixes command readback without enabling hourly writers',async t=>{
 await db.exec(`CREATE SCHEMA private; CREATE SCHEMA extensions; CREATE SCHEMA storage;
 CREATE TABLE storage.objects(id uuid); CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE ROLE authenticated; CREATE ROLE anon;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`);
 for(const table of preimage.tables.toReversed()){
  const columns=table.columns.map(c=>`${c.name} ${c.type}${c.default?' DEFAULT '+c.default:''}${c.not_null?' NOT NULL':''}`);
  const constraints=table.constraints.filter(c=>!c.definition.startsWith('FOREIGN KEY')).map(c=>`CONSTRAINT ${c.name} ${c.definition}`);
  await db.exec(`CREATE TABLE public.${table.name} (${[...columns,...constraints].join(',')}); ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY; GRANT SELECT ON public.${table.name} TO authenticated,anon;`);
 }
 // Same owned-row predicate as the live worker policy. No requester/Need/Auth
 // infrastructure is simulated here; that remains a separate HTTP acceptance.
 await db.exec(`CREATE POLICY responses_worker_read ON public.marketplace_responses FOR SELECT TO authenticated USING(worker_account_id=auth.uid());
 CREATE POLICY response_versions_read ON public.marketplace_response_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.marketplace_responses r WHERE r.id=response_id));
 CREATE POLICY fixture_closed_account ON public.marketplace_responses AS RESTRICTIVE FOR SELECT TO authenticated USING(current_setting('fixture.closed',true) IS DISTINCT FROM 'true');
 CREATE POLICY fixture_closed_account ON public.marketplace_response_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(current_setting('fixture.closed',true) IS DISTINCT FROM 'true');
 CREATE TABLE private.closure_source_v5(singleton boolean,sha256 text); INSERT INTO private.closure_source_v5 VALUES(true,'fixture-certificate');`);
 await db.exec(readFileSync(new URL('schema-digest-source.sql',root),'utf8'));
 await db.exec(`CREATE FUNCTION private.closure_source_digest_v5() RETURNS text LANGUAGE sql STABLE AS $$SELECT md5(private.closure_schema_digest_v5_139())$$;
 CREATE FUNCTION private.closure_erasure_program_digest_v5() RETURNS text LANGUAGE sql STABLE AS $$SELECT 'fixture-erasure'::text$$;
 CREATE FUNCTION private.retention_ai_source_ready() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
 CREATE FUNCTION private.data_export_policy_binding() RETURNS text LANGUAGE sql STABLE AS $$SELECT null::text$$;
 CREATE FUNCTION private.closure_erasure_binding_v5() RETURNS text LANGUAGE sql STABLE AS $$SELECT null::text$$;`);
 await db.exec(legacyInsert);
 const original=await snapshot();
 const fixture={...preimage,database:await value('select current_database()'),owner:await value('select current_user'),
  server_version_num:await value("select current_setting('server_version_num')"),tables:await value(metadataQuery),
  functions:[],closure:await value(closureQuery)};
 await db.exec('BEGIN; SET LOCAL search_path=pg_catalog');
 const forecast=await value(readFileSync(new URL('forecast-schema.sql',root),'utf8'));
 await db.exec('ROLLBACK');
 await db.exec('BEGIN;'+ddl);fixture.post_closure=await value(closureQuery);await db.exec('ROLLBACK');
 assert.equal(forecast,fixture.post_closure.schema,'read-only forecast matches real PG DDL');
 const pack=buildPackage(fixture);
 await t.test('current preimage reproduces 42703; real hosted guard refuses another catalog',async()=>{
  await fail('SELECT price_basis FROM public.marketplace_responses LIMIT 0','price_basis');
  await fail(buildPackage(preimage)['promotion.sql'],'R07_SCHEMA_CONTEXT_DRIFT|R07_SCHEMA_TABLE_DRIFT');
  await db.exec(pack['preflight.sql']);
 });
 await t.test('atomic promotion preserves stored rows, hashes, grants, RLS and all function bodies',async()=>{
  await db.exec(pack['promotion.sql']);await db.exec(pack['postflight.sql']);
  assert.deepEqual(await snapshot(),original);
  assert.deepEqual(await rows('SELECT price_rsd,price_basis FROM public.marketplace_responses'),[{price_rsd:4500,price_basis:null}]);
  assert.equal(await value('SELECT price_basis FROM public.marketplace_response_versions'),null);
 });
 await t.test('existing writers can still omit units; both supported units pass, invented units fail',async()=>{
  await db.exec(`INSERT INTO public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,content_hash)
   VALUES('11111111-1111-4111-8111-111111111111',2,1,4500,1,'immutable-second-version');`);
  assert.equal(await value('SELECT price_basis FROM public.marketplace_response_versions WHERE version=2'),null);
  for(const table of preimage.tables){
   for(const unit of ['TOTAL','HOURLY']){await db.exec(`BEGIN; UPDATE public.${table.name} SET price_basis='${unit}'; ROLLBACK;`);}
   await fail(`BEGIN; UPDATE public.${table.name} SET price_basis='PER_PERSON';`,'price_basis_check');
  }
 });
 await t.test('added column obeys existing owner/anonymous/closed-account row access and cannot be written by client',async()=>{
  await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false)");
  assert.equal((await rows('SELECT price_basis FROM public.marketplace_responses')).length,1);
  assert.equal((await rows('SELECT price_basis FROM public.marketplace_response_versions')).length,2);
  await fail("UPDATE public.marketplace_responses SET price_basis='HOURLY'",'permission denied');
  await db.exec("SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false)");
  assert.equal((await rows('SELECT price_basis FROM public.marketplace_responses')).length,0);
  await db.exec("SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false); SELECT set_config('fixture.closed','true',false)");
  assert.equal((await rows('SELECT price_basis FROM public.marketplace_responses')).length,0);
  await db.exec('RESET ROLE; SET ROLE anon');
  assert.equal((await rows('SELECT price_basis FROM public.marketplace_response_versions')).length,0);
  await db.exec('RESET ROLE');
 });
 await t.test('repeat promotion is idempotent; rollback refuses even one stored unit in either table',async()=>{
  await db.exec(pack['promotion.sql']);
  for(const table of preimage.tables){
   await db.exec(`UPDATE public.${table.name} SET price_basis='TOTAL'`);
   await fail(pack['rollback.sql'],'ROLLBACK_WOULD_LOSE_UNITS');
   assert.equal(await value(`SELECT count(*)::int FROM public.${table.name} WHERE price_basis='TOTAL'`),table.name==='marketplace_responses'?1:2);
   await db.exec(`UPDATE public.${table.name} SET price_basis=null`);
  }
 });
 await t.test('rollback and reapply retain existing data; schema drift refuses atomic application',async()=>{
  const before=await snapshot();await db.exec(pack['rollback.sql']);await db.exec(pack['preflight.sql']);
  assert.deepEqual(await snapshot(),before);
  await db.exec('ALTER TABLE public.marketplace_response_versions ADD COLUMN unexpected text');
  await fail(pack['promotion.sql'],'R07_SCHEMA_TABLE_DRIFT');
  assert.equal(await value("SELECT count(*)::int FROM information_schema.columns WHERE column_name='price_basis'"),0);
  await db.exec('ALTER TABLE public.marketplace_response_versions DROP COLUMN unexpected');
  await db.exec(pack['promotion.sql']);await db.exec(pack['postflight.sql']);
  assert.deepEqual(await snapshot(),before);
 });
});
