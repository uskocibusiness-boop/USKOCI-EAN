// R11b: isolated PostgreSQL-compatible PGlite proof, never touches hosted DEV.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const sql=readFileSync(new URL('../../candidates/r11b_blind_review_publication.sql',import.meta.url),'utf8');
const functionOnly=sql.split('-- TESTABLE FUNCTION BEGINS (installed separately in PGlite fixture).')[1].split('-- TESTABLE FUNCTION ENDS.')[0];
const id=n=>'00000000-0011-4111-8111-'+String(n).padStart(12,'0');
const agreement=id(1),a=id(2),b=id(3),c=id(4),other=id(5);
async function setup(){
 const db=new PGlite();
 await db.exec([
  'CREATE SCHEMA private; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;',
  'CREATE TABLE public.agreements(id uuid PRIMARY KEY,requester_account_id uuid,worker_account_id uuid,current_version integer,status text);',
  'CREATE TABLE public.agreement_execution(agreement_id uuid,agreement_version integer,state text,completed_at timestamptz);',
  'CREATE TABLE private.agreement_reviews(agreement_id uuid,reviewer_account_id uuid,target_account_id uuid,rating integer);',
  functionOnly,
 ].join('\n'));
 await db.query("INSERT INTO public.agreements VALUES($1,$2,$3,2,'COMPLETED')",[agreement,a,b]);
 await db.query("INSERT INTO public.agreement_execution VALUES($1,2,'COMPLETED','2026-10-01T12:00:00Z')",[agreement]);
 return db;
}
const ready=(db,now='2026-10-02T12:00:00Z',aid=agreement)=>db.query(
 'SELECT private.agreement_review_publication_ready_v1($1::uuid,$2::timestamptz) AS ok',[aid,now]).then(r=>r.rows[0].ok);
const write=(db,reviewer,target,aid=agreement)=>db.query(
 'INSERT INTO private.agreement_reviews VALUES($1,$2,$3,5)',[aid,reviewer,target]);
test('source-level 3 public reader patches are exactly source-pinned and default private',()=>{
 assert.match(sql,/R11B_LOCAL_ONLY/);assert.match(sql,/R11B_CURRENT_READERS_DRIFT/);
 for(const sig of ['private.account_reputation(uuid)','public.rpc_list_received_reviews_v1(integer,text)',
  'public.rpc_list_review_comments_v1(uuid,integer,jsonb)'])assert.ok(sql.includes("'"+sig+"'"));
 assert.equal((sql.match(/private\.agreement_review_publication_ready_v1\(rv\.agreement_id\)/g)||[]).length,4);
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.agreement_review_publication_ready_v1/);
});
test('single review blind; second current participant publishes both across one account',async t=>{
 const db=await setup();t.after(()=>db.close());
 assert.equal(await ready(db),false);await write(db,a,b);assert.equal(await ready(db),false);
 await write(db,b,a);assert.equal(await ready(db),true);
});
test('unilateral review publishes exactly 14 days after confirmed completion',async t=>{
 const db=await setup();t.after(()=>db.close());await write(db,a,b);
 assert.equal(await ready(db,'2026-10-15T11:59:59Z'),false);
 assert.equal(await ready(db,'2026-10-15T12:00:00Z'),true);
});
test('cancellation, state conflict, version mismatch and missing completion fail closed',async t=>{
 const db=await setup();t.after(()=>db.close());await write(db,a,b);await write(db,b,a);
 await db.exec("UPDATE public.agreements SET status='CANCELLED'");
 assert.equal(await ready(db),false);
 await db.exec("UPDATE public.agreements SET status='COMPLETED'");
 await db.exec("UPDATE public.agreement_execution SET state='DISPUTED'");
 assert.equal(await ready(db),false);
 await db.exec("UPDATE public.agreement_execution SET state='COMPLETED',agreement_version=1");
 assert.equal(await ready(db),false);
 await db.exec('UPDATE public.agreement_execution SET agreement_version=2,completed_at=null');
 assert.equal(await ready(db),false);
});
test('foreign reviewer, wrong target, other Agreement, null time/identity do not unlock',async t=>{
 const db=await setup();t.after(()=>db.close());await write(db,a,b);
 await write(db,c,a);await write(db,b,a,other);
 assert.equal(await ready(db),false);
 assert.equal(await ready(db,undefined,other),false);
 assert.equal(await ready(db,null),false);
 await write(db,b,c);assert.equal(await ready(db),false);
 await db.exec('UPDATE public.agreements SET worker_account_id=requester_account_id');
 assert.equal(await ready(db,'2026-11-30T12:00:00Z'),false);
});
