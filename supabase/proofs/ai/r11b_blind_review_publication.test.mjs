// R11b: one bounded PGlite engine, complete unchanged LOCAL_ONLY candidate,
// and exact current reader/helper bodies. No network or hosted DEV writes.
// Synthetic relation shapes omit unrelated constraints/triggers/RLS; auth claims
// are injected. This does not prove Auth/PostgREST, review submission, push,
// closure admission or native behavior. Candidate MD5 pins are not an ACL preflight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { blindReviewSnapshot } from './r11b_blind_review_fixture.mjs';
const sql=readFileSync(new URL('../../candidates/r11b_blind_review_publication.sql',import.meta.url),'utf8');
const id=n=>'00000000-0011-4111-8111-'+String(n).padStart(12,'0');
const agreement=id(1),a=id(2),b=id(3),c=id(4),other=id(5),real=id(7);
const aRequester=id(102),aWorker=id(103),bRequester=id(104),bWorker=id(105),cWorker=id(106);
const need=id(201),helper='private.agreement_review_publication_ready_v1(uuid,timestamp with time zone)';
const db=new PGlite();
test.after(()=>db.close());
const rows=async(query,args=[]) => (await db.query(query,args)).rows;
const scalar=async(query,args=[])=>Object.values((await rows(query,args))[0])[0];
const hash=value=>createHash('md5').update(value).digest('hex');
let reviewSequence;
async function as(actor,action,role='authenticated'){
 assert(['anon','authenticated','service_role'].includes(role));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor??'']);
 await db.exec(`set role ${role}`);
 try{return await action();}finally{await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false)");}
}
async function metadata(){
 const result=[];
 for(const f of blindReviewSnapshot.functions){
  const [actual]=await rows(`select pg_get_userbyid(proowner) as owner,prosecdef as security_definer,
   proconfig as config,(select jsonb_agg(x::text order by x::text) from unnest(proacl) x) as acl,
   md5(prosrc) as body_md5,md5(pg_get_functiondef(oid)) as definition_md5
   from pg_proc where oid=to_regprocedure($1)`,[f.signature]);
  result.push({signature:f.signature,...actual});
 }
 return result;
}
async function install(){
 const before=await metadata();
 await db.exec("set uskoci.r11b_blind.disposable='LOCAL_ONLY'");
 await db.exec(sql); // Full environment guard, five MD5 pins, helper, ACL, patch, COMMIT.
 const after=await metadata();
 const patched=new Set(['private.account_reputation(uuid)','public.rpc_get_account_reputation(uuid)',
  'public.rpc_list_received_reviews_v1(integer,text)','public.rpc_list_review_comments_v1(uuid,integer,jsonb)']);
 for(let i=0;i<before.length;i++){
  const {body_md5:oldBody,definition_md5:oldDef,...oldMetadata}=before[i];
  const {body_md5:newBody,definition_md5:newDef,...newMetadata}=after[i];
  assert.deepEqual(newMetadata,oldMetadata,`${before[i].signature} authority must be preserved`);
  if(patched.has(before[i].signature)){assert.notEqual(newBody,oldBody);assert.notEqual(newDef,oldDef);}
  else{assert.equal(newBody,oldBody);assert.equal(newDef,oldDef);}
 }
 for(const role of ['anon','authenticated','service_role'])
  assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\')',[role,helper]),false);
}
async function setup({apply=true}={}){
 await db.exec(`reset role; set search_path=pg_catalog;
  drop schema if exists private cascade; drop schema if exists auth cascade; drop schema if exists public cascade;
  create schema private; create schema auth; create schema public;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql stable as $f$
   select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $f$;
  create table public.app_accounts(id uuid primary key);
  create table public.app_profiles(id uuid primary key,account_id uuid,profile_status text,kind text,display_name text,avatar_path text);
  create table public.needs(id uuid primary key,title text);
  create table public.agreements(id uuid primary key,requester_account_id uuid,worker_account_id uuid,
   requester_profile_id uuid,worker_profile_id uuid,need_id uuid,current_version integer,status text);
  create table public.agreement_execution(agreement_id uuid,agreement_version integer,state text,completed_at timestamptz);
  create table private.agreement_reviews(id uuid primary key,agreement_id uuid,reviewer_account_id uuid,target_account_id uuid,
   rating integer,tags text[],created_at timestamptz);
  create table private.agreement_review_comments_v1(review_id uuid primary key,author_account_id uuid,target_account_id uuid,
   comment text,created_at timestamptz,hidden_at timestamptz);
  create table private.account_blocks(blocker_account_id uuid,blocked_account_id uuid,active boolean);
  create table private.account_closure_requests(account_id uuid,state text);
  create table private.account_lineage_v5(account_id uuid primary key,lineage text);
  create table private.marketplace_config(key text primary key,value jsonb);
  select set_config('request.jwt.claim.sub','',false);
  set uskoci.r11b_blind.disposable='NOT_ADMITTED';`);
 for(const f of blindReviewSnapshot.functions)await db.exec(f.definition);
 await db.exec(`revoke all on all functions in schema private,public,auth from public,anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  grant execute on all functions in schema public to authenticated,service_role;`);
 const actual=await metadata();
 assert.deepEqual(actual,blindReviewSnapshot.functions.map(f=>({signature:f.signature,owner:f.owner,
  security_definer:f.security_definer,config:f.config,acl:[...f.acl].sort(),body_md5:f.body_md5,definition_md5:f.definition_md5})),
 'every function must match the captured current definition and authority before candidate execution');
 reviewSequence=1000;
 await db.query('insert into public.app_accounts values($1),($2),($3),($4)',[a,b,c,real]);
 await db.query(`insert into private.account_lineage_v5 values($1,'SYNTHETIC_ACCEPTANCE_FIXTURE'),
  ($2,'SYNTHETIC_ACCEPTANCE_FIXTURE'),($3,'SYNTHETIC_ACCEPTANCE_FIXTURE'),($4,'UNCLASSIFIED')`,[a,b,c,real]);
 for(const [profile,account,kind] of [[aRequester,a,'REQUESTER'],[aWorker,a,'WORKER'],[bRequester,b,'REQUESTER'],
  [bWorker,b,'WORKER'],[cWorker,c,'WORKER']])
  await db.query("insert into public.app_profiles values($1,$2,'ACTIVE',$3,'Synthetic profile',null)",[profile,account,kind]);
 await db.query("insert into public.needs values($1,'Synthetic completed task')",[need]);
 await addAgreement(agreement,a,b,aRequester,bWorker);
 if(apply)await install();
}
async function addAgreement(agreementId,requester,worker,requesterProfile,workerProfile,completedAt='2026-10-01T12:00:00Z'){
 await db.query("insert into public.agreements values($1,$2,$3,$4,$5,$6,2,'COMPLETED')",
  [agreementId,requester,worker,requesterProfile,workerProfile,need]);
 await db.query("insert into public.agreement_execution values($1,2,'COMPLETED',$2::timestamptz)",[agreementId,completedAt]);
}
const ready=(now='2026-10-02T12:00:00Z',agreementId=agreement)=>scalar(
 'select private.agreement_review_publication_ready_v1($1::uuid,$2::timestamptz)',[agreementId,now]);
async function write(reviewer,target,agreementId=agreement,rating=5,comment=null){
 const review=id(reviewSequence++);
 await db.query(`insert into private.agreement_reviews values($1,$2,$3,$4,$5,'{}',
  coalesce((select completed_at from public.agreement_execution where agreement_id=$2),
   '2026-10-01T12:00:00Z'::timestamptz)+interval '1 hour 0.123456 seconds')`,
  [review,agreementId,reviewer,target,rating]);
 if(comment!==null)await db.query(`insert into private.agreement_review_comments_v1
  select $1,$2,$3,$4,created_at,null from private.agreement_reviews where id=$1`,[review,reviewer,target,comment]);
 return review;
}
const reputation=(viewer,target=b)=>as(viewer,()=>scalar('select public.rpc_get_account_reputation($1)',[target]));
const received=(viewer=b,limit=20,after=null)=>as(viewer,()=>scalar('select public.rpc_list_received_reviews_v1($1,$2)',[limit,after]));
const comments=(viewer=c,profile=bWorker,limit=20,after=null)=>as(viewer,
 ()=>scalar('select public.rpc_list_review_comments_v1($1,$2,$3::jsonb)',[profile,limit,after===null?null:JSON.stringify(after)]));
const denied=(promise,message)=>assert.rejects(promise,e=>e.code==='42501'&&(!message||e.message===message));

test('R11b full candidate on current reader and helper bodies',async t=>{
 await db.exec('create role anon;create role authenticated;create role service_role');
 assert.equal(blindReviewSnapshot.publication_helper_exists,false);
 for(const f of blindReviewSnapshot.functions){
  assert.equal(hash(f.definition),f.definition_md5,f.signature);
  const body=f.definition.match(/AS \$function\$([\s\S]*)\$function\$/)?.[1];
  assert(body,f.signature);assert.equal(hash(body),f.body_md5,f.signature);
 }
 await t.test('complete candidate refuses unadmitted, hosted-role and changed preimages atomically',async()=>{
  await setup({apply:false});const before=await metadata();
  const refusal=async message=>{
   await assert.rejects(db.exec(sql),e=>e.code==='55000'&&e.message===message);
   await db.exec('rollback');
   assert.equal(await scalar('select to_regprocedure($1) is null',[helper]),true);
  };
  await refusal('R11B_LOCAL_ONLY');assert.deepEqual(await metadata(),before);
  await db.exec("set uskoci.r11b_blind.disposable='LOCAL_ONLY';create role cli_login_postgres");
  await refusal('R11B_LOCAL_ONLY');await db.exec('drop role cli_login_postgres');
  assert.deepEqual(await metadata(),before);
  const original=blindReviewSnapshot.functions.find(f=>f.signature==='private.account_reputation(uuid)').definition;
  await db.exec(original.replace(' select jsonb_build_object',' -- synthetic preimage drift\n select jsonb_build_object'));
  const drifted=await metadata();await refusal('R11B_CURRENT_READERS_DRIFT');assert.deepEqual(await metadata(),drifted);
  await db.exec(original);assert.deepEqual(await metadata(),before);
  await install();const applied=await metadata();
  await assert.rejects(db.exec(sql),e=>e.code==='55000'&&e.message==='R11B_LOCAL_ONLY');
  await db.exec('rollback');assert.deepEqual(await metadata(),applied);
 });
 await t.test('single review is blind and the reciprocal current-participant review publishes both',async()=>{
  await setup();assert.equal(await ready(),false);
  await write(a,b);assert.equal(await ready(),false);
  await write(b,a);assert.equal(await ready(),true);
 });
 await t.test('unilateral publication starts exactly 14 days after confirmed completion',async()=>{
  await setup();await write(a,b);
  assert.equal(await ready('2026-10-15T11:59:59.999999Z'),false);
  assert.equal(await ready('2026-10-15T12:00:00Z'),true);
 });
 await t.test('cancellation, execution conflict, version mismatch and absent completion fail closed',async()=>{
  await setup();await write(a,b);await write(b,a);
  await db.exec("update public.agreements set status='CANCELLED'");assert.equal(await ready(),false);
  await db.exec("update public.agreements set status='COMPLETED';update public.agreement_execution set state='DISPUTED'");assert.equal(await ready(),false);
  await db.exec("update public.agreement_execution set state='COMPLETED',agreement_version=1");assert.equal(await ready(),false);
  await db.exec('update public.agreement_execution set agreement_version=2,completed_at=null');assert.equal(await ready(),false);
 });
 await t.test('foreign reviewer, wrong target, other agreement and null inputs do not unlock',async()=>{
  await setup();await write(a,b);await write(c,a);await write(b,a,other);
  assert.equal(await ready(),false);assert.equal(await ready(undefined,other),false);assert.equal(await ready(null),false);
  assert.equal(await ready(undefined,null),false);
  await write(b,c);assert.equal(await ready(),false);
  await db.exec('update public.agreements set worker_account_id=requester_account_id');
  assert.equal(await ready('2026-11-30T12:00:00Z'),false);
 });
 await t.test('real aggregate, received rows and public comments agree on blindness, counts, both roles and pages',async()=>{
  await setup({apply:false});
  const completedAt=await scalar("select (statement_timestamp()-interval '1 day')::text");
  await db.query('update public.agreement_execution set completed_at=$1::timestamptz',[completedAt]);
  const first=await write(a,b,agreement,5,'SYNTHETIC_COMMENT_A');
  assert.equal((await reputation(c)).reviewCount,1,'current unpatched aggregate reproduces the early leak');
  assert.equal((await received()).totalCount,1);assert.equal((await comments()).items.length,1);
  await install();
  assert.deepEqual(await reputation(c),{accountId:b,reviewCount:0,averageRating:null,state:'NO_REVIEWS',authoritative:true});
  assert.equal((await received()).totalCount,0);assert.deepEqual((await received()).items,[]);
  assert.deepEqual((await comments()).items,[]);
  await write(b,a,agreement,4);
  assert.equal((await reputation(c)).reviewCount,1);assert.equal((await reputation(c)).averageRating,5);
  const mine=await received();assert.equal(mine.items[0].receivedAs,'WORKER');assert.equal(mine.items[0].comment,'SYNTHETIC_COMMENT_A');
  assert.equal((await comments()).items[0].agreementId,null,'third viewers receive no private agreement link');
  assert.equal((await comments(b)).items[0].agreementId,agreement);
  const reverse=id(20),starOnly=id(21);
  await addAgreement(reverse,b,c,bRequester,cWorker,completedAt);
  const second=await write(c,b,reverse,3,'SYNTHETIC_COMMENT_C');await write(b,c,reverse,4);
  await addAgreement(starOnly,a,b,aRequester,bWorker,completedAt);const stars=await write(a,b,starOnly,1);await write(b,a,starOnly,4);
  const rating=await reputation(c);assert.equal(rating.reviewCount,3);assert.equal(rating.averageRating,3);
  assert.deepEqual(await reputation(b),rating,'one shared account aggregate for both directions');
  const workerView=await comments(c,bWorker),requesterView=await comments(c,bRequester);
  assert.deepEqual(workerView.items,requesterView.items,'profile kind changes context, not published account comments');
  assert.deepEqual(workerView.items.map(x=>x.reviewId).sort(),[first,second].sort());
  const commented=await received();assert.equal(commented.mode,'COMMENTED_ONLY');assert.equal(commented.totalCount,3);
  assert.equal(commented.notListedCount,1);assert.deepEqual(new Set(commented.items.map(x=>x.receivedAs)),new Set(['WORKER','REQUESTER']));
  let page=await received(b,1);assert.equal(page.hasMore,true);const firstPage=page.items[0].reviewId;
  page=await received(b,1,page.nextAfter);assert.equal(page.hasMore,false);assert.equal(page.nextAfter,null);
  assert.deepEqual([firstPage,page.items[0].reviewId].sort(),[first,second].sort());
  let publicPage=await comments(c,bWorker,1);assert.equal(publicPage.hasMore,true);const commentId=publicPage.items[0].reviewId;
  publicPage=await comments(c,bWorker,1,publicPage.nextAfter);assert.equal(publicPage.hasMore,false);
  assert.deepEqual([commentId,publicPage.items[0].reviewId].sort(),[first,second].sort());
  await db.exec(`insert into private.marketplace_config values('received_reviews_detail','{"mode":"ALL"}')`);
  const all=await received();assert.equal(all.mode,'ALL');assert.equal(all.notListedCount,0);
  assert.deepEqual(all.items.map(x=>x.reviewId).sort(),[first,second,stars].sort());
  assert.equal(all.items.find(x=>x.reviewId===stars).comment,null);
  await assert.rejects(received(b,20,'not-a-cursor'),e=>e.code==='22023');
  await assert.rejects(comments(c,bWorker,20,{createdAt:'invalid',reviewId:first}),e=>e.code==='22023');
  const foreign=await received(c);assert.equal(foreign.items.length,1);
  assert.equal(foreign.items[0].agreementId,reverse,'own received list must not return another account\'s reviews');
  await denied(as(b,()=>rows('select * from private.agreement_reviews')));
  await denied(as(b,()=>rows('select private.account_reputation($1)',[a])));
  await denied(as(b,()=>rows(`select ${helper.slice(0,helper.indexOf('('))}($1)`,[agreement])));
 });
 await t.test('current world, closure, block and moderation boundaries survive publication gating',async()=>{
  await setup();const review=await write(a,b,agreement,5,'SYNTHETIC_COMMENT_A');await write(b,a);
  assert.equal((await reputation(c)).reviewCount,1);
  await denied(reputation(real),'REPUTATION_NOT_AVAILABLE');assert.equal(await comments(real),null);
  await denied(reputation(null),'AUTH_REQUIRED');await denied(received(null),'AUTH_REQUIRED');await denied(comments(null),'AUTH_REQUIRED');
  await denied(as(null,()=>rows('select public.rpc_get_account_reputation($1)',[b]),'anon'));
  await db.query('insert into private.account_blocks values($1,$2,true)',[a,b]);
  const authorBlocked=await received();assert.equal(authorBlocked.items[0].comment,'SYNTHETIC_COMMENT_A');
  assert.equal(authorBlocked.items[0].reviewer.masked,true);assert.equal((await comments()).items.length,1);
  assert.equal((await comments(b)).items.length,0);
  await db.exec('delete from private.account_blocks');
  await db.query('insert into private.account_blocks values($1,$2,true)',[b,a]);
  const viewerBlocked=await received();assert.deepEqual(viewerBlocked.items,[]);assert.equal(viewerBlocked.notListedCount,1);
  assert.equal((await comments()).items.length,1,'a participant block cannot hide a review from all third viewers');
  await denied(reputation(a),'REPUTATION_NOT_AVAILABLE');
  await db.exec('delete from private.account_blocks');
  await db.query('update private.agreement_review_comments_v1 set hidden_at=statement_timestamp() where review_id=$1',[review]);
  assert.deepEqual((await comments()).items,[]);assert.deepEqual((await received()).items,[]);
  assert.equal((await reputation(c)).reviewCount,1,'moderation hides text without rewriting published stars');
  await db.exec('update private.agreement_review_comments_v1 set hidden_at=null');
  await db.query("update public.app_profiles set profile_status='SUSPENDED' where id=$1",[aRequester]);
  assert.deepEqual((await comments()).items,[]);assert.deepEqual((await received()).items,[]);
  await db.query("update public.app_profiles set profile_status='ACTIVE' where id=$1",[aRequester]);
  await db.query("update private.account_lineage_v5 set lineage='UNCLASSIFIED' where account_id=$1",[a]);
  assert.deepEqual((await comments()).items,[]);assert.deepEqual((await received()).items,[]);
  await db.query("update private.account_lineage_v5 set lineage='SYNTHETIC_ACCEPTANCE_FIXTURE' where account_id=$1",[a]);
  await db.query("insert into private.account_closure_requests values($1,'READY')",[a]);
  assert.deepEqual((await comments()).items,[]);assert.deepEqual((await received()).items,[]);
  await db.exec('delete from private.account_closure_requests');
  await db.query("insert into private.account_closure_requests values($1,'READY')",[b]);
  await denied(reputation(c),'REPUTATION_NOT_AVAILABLE');await denied(received(),'ACCOUNT_CLOSING');assert.equal(await comments(),null);
  await db.exec('delete from private.account_closure_requests');
  // Fault injection retains the earlier NULL-world negative. Current lineage
  // normally maps UNCLASSIFIED to REAL; missing lineage is not called NULL here.
  const sameWorld=blindReviewSnapshot.functions.find(f=>f.signature==='private.accounts_same_world(uuid,uuid)').definition;
  try{
   await db.exec(sameWorld.replace('select private.account_visibility_world(p_a) = private.account_visibility_world(p_b);','select null::boolean;'));
   await denied(reputation(c),'REPUTATION_NOT_AVAILABLE');
  }finally{await db.exec(sameWorld);}
  assert.equal((await reputation(c)).reviewCount,1);
 });
});
