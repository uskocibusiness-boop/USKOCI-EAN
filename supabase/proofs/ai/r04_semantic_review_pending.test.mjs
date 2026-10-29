// R04/F05: execute the EXACT new projection body in isolated in-memory PGlite.
// Only SQL prerequisite helpers below are synthetic; no Auth, DEV, Gemini,
// signed review/Save/binder, DDL rollout or catalog mutation is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const account='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const workerConversation='33333333-3333-4333-8333-333333333333';
const needConversation='44444444-4444-4444-8444-444444444444';
const category='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const competitor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const service='Montaža gotovog ormara';
const source=readFileSync('supabase/candidates/r04_semantic_review_pending_projection.sql','utf8');
const candidate=source.match(/CREATE OR REPLACE FUNCTION private\.taxonomy_review_candidate_projection_v2\([\s\S]*?END \$function\$;/)?.[0];
if(!candidate) throw new Error('R04_CANDIDATE_FUNCTION_MISSING');
const fixtureSql=`
CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  'SELECT nullif(current_setting(''test.uid'',true),'''')::uuid';
CREATE FUNCTION extensions.digest(bytea,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS
  'SELECT decode(md5(encode($1,''hex'')),''hex'')';
CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS
  'SELECT decode(md5($1),''hex'')';
CREATE TABLE private.work_taxonomy_control(singleton boolean primary key,catalog_version bigint);
INSERT INTO private.work_taxonomy_control VALUES(true,17);
CREATE TABLE private.work_taxonomy_categories(
 id uuid primary key,parent_id uuid,label text,canonical_key text,state text);
CREATE TABLE private.work_taxonomy_category_modes(category_id uuid,execution_scope text);
CREATE TABLE private.work_taxonomy_aliases(category_id uuid,normalized_key text);
CREATE TABLE private.worker_ai_sessions(account_id uuid,conversation_id uuid,
 candidate jsonb,revision int,base_hash text);
CREATE TABLE public.ai_conversations(id uuid,account_id uuid,purpose text);
CREATE TABLE private.work_taxonomy_gemini_turn_hints_v1(
 id uuid,created_at timestamptz,purpose text,account_id uuid,conversation_id uuid,
 client_request_id uuid,source_fingerprint text,catalog_version bigint,proposals jsonb);
CREATE FUNCTION private.taxonomy_normalize_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS
  'SELECT lower(btrim(regexp_replace($1,''[[:space:]]+'','' '',''g'')))';
CREATE FUNCTION private.taxonomy_risk_triage_v1(text) RETURNS text LANGUAGE sql IMMUTABLE AS
  'SELECT CASE WHEN private.taxonomy_normalize_v1($1) IN (''klima'',''nameštaj'')
    THEN ''NEEDS_CLARIFICATION'' ELSE ''LOW_RISK_CANDIDATE'' END';
CREATE FUNCTION private.taxonomy_category_path_valid_v1(uuid) RETURNS boolean
  LANGUAGE sql STABLE AS 'SELECT EXISTS(SELECT 1 FROM private.work_taxonomy_categories
    WHERE id=$1 AND state=''ESTABLISHED'')';
CREATE FUNCTION private.taxonomy_admission_fingerprint_v1() RETURNS text LANGUAGE sql STABLE AS
  'SELECT repeat(''a'',32)';
CREATE FUNCTION private.ai_task_review_source(uuid) RETURNS jsonb LANGUAGE sql STABLE AS
  'SELECT jsonb_build_object(''conversationId'',$1)';
CREATE FUNCTION private.taxonomy_review_exact_projection_v1(text,jsonb,jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $exact$
DECLARE svc text; md text; cid uuid;
BEGIN
 svc:=$2->>0;md:=$3->0->>'mode';
 SELECT c.id INTO cid FROM private.work_taxonomy_categories c
   JOIN private.work_taxonomy_category_modes m ON m.category_id=c.id AND m.execution_scope=md
   WHERE c.state='ESTABLISHED' AND
     (c.canonical_key=private.taxonomy_normalize_v1(svc)
       OR EXISTS(SELECT 1 FROM private.work_taxonomy_aliases a
         WHERE a.category_id=c.id AND a.normalized_key=private.taxonomy_normalize_v1(svc)))
   LIMIT 1;
 IF cid IS NULL THEN
   RETURN jsonb_build_object('status','PENDING_CLASSIFICATION',
      'classificationCandidates','[]'::jsonb,'reviewedServiceModes','[]'::jsonb,
      'classificationCatalogVersion',null,'classificationCatalogFingerprint',null);
 END IF;
 RETURN jsonb_build_object('status','READY',
    'classificationCandidates',jsonb_build_array(jsonb_build_object(
      'action','REUSE_EXISTING','service',svc,'mode',md,'categoryId',cid,
      'reason','Exact canonical name or stored alias.','catalogVersion',17)),
    'reviewedServiceModes',CASE WHEN $1='WORKER_CAPABILITY'
      THEN jsonb_build_array(jsonb_build_object('service',svc,'mode',md))
      ELSE '[]'::jsonb END,
    'classificationCatalogVersion',17,'classificationCatalogFingerprint',repeat('a',32));
END $exact$;
INSERT INTO private.work_taxonomy_categories VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'Sklapanje ormara','sklapanje ormara','ESTABLISHED'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'Čišćenje klima','čišćenje klima','ESTABLISHED'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',null,'Montaža grejanja','montaža grejanja','ESTABLISHED');
INSERT INTO private.work_taxonomy_category_modes VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ON_SITE'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','REMOTE'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ON_SITE'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','REMOTE'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','ON_SITE');
INSERT INTO private.worker_ai_sessions VALUES
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
  '{"skills":["Montaža gotovog ormara"]}'::jsonb,1,'worker-base');
INSERT INTO public.ai_conversations VALUES
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','NEED_INTAKE');
INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
 (id,created_at,purpose,account_id,conversation_id,client_request_id,
  source_fingerprint,catalog_version,proposals)
SELECT '55555555-5555-4555-8555-555555555555',clock_timestamp(),'WORKER_CAPABILITY',
 s.account_id,s.conversation_id,'66666666-6666-4666-8666-666666666666',
 encode(extensions.digest(convert_to(s.candidate::text||'|'||s.revision::text||'|'||s.base_hash,'UTF8'),'sha256'),'hex'),
 17,'[]'::jsonb FROM private.worker_ai_sessions s;
INSERT INTO private.work_taxonomy_gemini_turn_hints_v1
 (id,created_at,purpose,account_id,conversation_id,client_request_id,
  source_fingerprint,catalog_version,proposals)
SELECT '77777777-7777-4777-8777-777777777777',clock_timestamp(),'NEED_SERVICE',
 c.account_id,c.id,'88888888-8888-4888-8888-888888888888',
 encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex'),
 17,'[]'::jsonb FROM public.ai_conversations c;
SELECT set_config('test.uid','11111111-1111-4111-8111-111111111111',false);
`;
const make=(mode,id=category,text=service)=>({
 service:text,mode,action:'REUSE_EXISTING',categoryId:id,
 parentId:'',proposedPath:[],
 reason:'Model predlaže isti konkretan posao uz obavezan korisnički pregled.',
 catalogVersion:17
});

test('R04/F05 signed-review input remains nonauthoritative even with a valid existing leaf ID',async()=>{
 const db=new PGlite();
 try{
   await db.exec(fixtureSql);
   await db.exec(candidate);
   const update=async(purpose,proposals)=>db.query(
     'UPDATE private.work_taxonomy_gemini_turn_hints_v1 SET proposals=$2::jsonb WHERE purpose=$1',
     [purpose,JSON.stringify(proposals)]);
   const read=async(purpose,modes,svc=service,who=account)=> {
     const {rows}=await db.query(
       'SELECT private.taxonomy_review_candidate_projection_v2($1,$2::jsonb,$3::jsonb,$4::uuid,$5::uuid) result',
       [purpose,JSON.stringify([svc]),JSON.stringify(modes.map(mode=>({service:svc,mode}))),
        who,purpose==='WORKER_CAPABILITY'?workerConversation:needConversation]);
     return rows[0].result;
   };
   // Semantically proposed same ID in BOTH modes: comparisons, not capability.
   await update('WORKER_CAPABILITY',[make('ON_SITE'),make('REMOTE')]);
   const both=await read('WORKER_CAPABILITY',['ON_SITE','REMOTE']);
   assert.equal(both.status,'REVIEW_REQUIRED');
   assert.deepEqual(both.classificationCandidates,[]);
   assert.deepEqual(both.reviewedServiceModes,[]);
   assert.deepEqual(both.semanticReviewCandidates.map(x=>[x.service,x.mode,x.categoryId,x.categoryLabel]),
     [[service,'ON_SITE',category,'Sklapanje ormara'],[service,'REMOTE',category,'Sklapanje ormara']]);
   assert.equal(both.classificationAuthority,'NONE');
   assert.equal(both.capabilityAuthority,'NONE');
   assert.equal(both.notificationAuthority,'NONE');

   // This is NOT a way to silently join two distinct services/IDs under BOTH.
   await update('WORKER_CAPABILITY',[make('ON_SITE'),make('REMOTE',competitor)]);
   const conflict=await read('WORKER_CAPABILITY',['ON_SITE','REMOTE']);
   assert.equal(conflict.status,'PENDING_CLASSIFICATION');
   assert.deepEqual(conflict.classificationCandidates,[]);

   // Invented ID / wrong mode / non-leaf category never reaches READY.
   for(const invalid of [
     [make('ON_SITE','99999999-9999-4999-8999-999999999999'),'ON_SITE'],
     [make('REMOTE','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'REMOTE'],
   ]) {
     await update('WORKER_CAPABILITY',[invalid[0]]);
     const value=await read('WORKER_CAPABILITY',[invalid[1]]);
     assert.equal(value.status,'PENDING_CLASSIFICATION');
   }

   // Plain "klima" remains ambiguous despite a model-supplied existing ID.
   await update('WORKER_CAPABILITY',[make('ON_SITE',category,'klima')]);
   assert.equal((await read('WORKER_CAPABILITY',['ON_SITE'],'klima')).status,'PENDING_CLASSIFICATION');

   // A stored alias elsewhere is not permitted to be reinterpreted as a new
   // semantic equivalence for a second category.
   await db.exec("INSERT INTO private.work_taxonomy_aliases VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','montaža gotovog ormara')");
   await update('WORKER_CAPABILITY',[make('ON_SITE')]);
   assert.equal((await read('WORKER_CAPABILITY',['ON_SITE'])).status,'READY');
   await db.exec("DELETE FROM private.work_taxonomy_aliases");

   // Current revision fences even a correctly shaped stale Gemini source.
   await db.exec('UPDATE private.worker_ai_sessions SET revision=2');
   assert.equal((await read('WORKER_CAPABILITY',['ON_SITE'])).status,'PENDING_CLASSIFICATION');
   await db.exec('UPDATE private.worker_ai_sessions SET revision=1');

   // Requested NEED has an independently bound source and the same no-READY rule.
   await update('NEED_SERVICE',[make('ON_SITE')]);
   const requester=await read('NEED_SERVICE',['ON_SITE']);
   assert.equal(requester.status,'REVIEW_REQUIRED');
   assert.equal(requester.semanticReviewCandidates[0].categoryId,category);
   assert.deepEqual(requester.classificationCandidates,[]);

   // The projection rejects any other owner; a claimed ID never grants access.
   await assert.rejects(read('NEED_SERVICE',['ON_SITE'],service,other),
     /TAXONOMY_REVIEW_OWNER_MISMATCH/);
 } finally {await db.close();}
});
