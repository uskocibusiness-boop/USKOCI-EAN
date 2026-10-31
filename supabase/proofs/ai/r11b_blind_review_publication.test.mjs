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

test('R11b patches all three current reader shapes and hides early ratings in every projection',async t=>{
 const db=await setup();t.after(()=>db.close());
 const profile=id(6);
 await db.exec([
  'CREATE TABLE public.app_profiles(id uuid PRIMARY KEY,account_id uuid);',
  'CREATE TABLE private.agreement_review_comments_v1(agreement_id uuid,target_account_id uuid,hidden_at timestamptz);',
  "CREATE FUNCTION private.account_reputation(account_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $f$ SELECT jsonb_build_object('count',count(*)::int) from private.agreement_reviews where target_account_id=account_id; $f$;",
  "CREATE FUNCTION public.rpc_list_received_reviews_v1(p_limit integer,p_after text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $f$ DECLARE v_actor uuid:='"+b+"'; BEGIN RETURN (SELECT count(*)::integer FROM private.agreement_reviews rv where rv.target_account_id = v_actor); END; $f$;",
  "CREATE FUNCTION public.rpc_list_review_comments_v1(p_profile_id uuid,p_limit integer,p_after jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $f$ DECLARE v_profile public.app_profiles; BEGIN SELECT * INTO v_profile FROM public.app_profiles WHERE id=p_profile_id; RETURN (SELECT count(*)::integer FROM private.agreement_review_comments_v1 c JOIN private.agreement_reviews rv ON rv.agreement_id=c.agreement_id AND rv.target_account_id=c.target_account_id where c.target_account_id=v_profile.account_id and c.hidden_at is null); END; $f$;",
 ].join('\n'));
 await db.query('INSERT INTO public.app_profiles VALUES($1,$2)',[profile,b]);
 await db.query('INSERT INTO private.agreement_review_comments_v1 VALUES($1,$2,NULL)',[agreement,b]);
 await db.exec("UPDATE public.agreement_execution SET completed_at=statement_timestamp()-interval '1 day'");
 const patch='DO $patch$'+sql.split('DO $patch$')[1].split('COMMIT;')[0];
 await db.exec(patch);
 const signatures=['private.account_reputation(uuid)','public.rpc_list_received_reviews_v1(integer,text)',
  'public.rpc_list_review_comments_v1(uuid,integer,jsonb)'];
 for(const sig of signatures){
  const def=(await db.query('SELECT pg_get_functiondef(to_regprocedure($1)) as definition',[sig])).rows[0].definition;
  assert.match(def,/private\.agreement_review_publication_ready_v1\(rv\.agreement_id\)/);
 }
 const publicRows=async()=>[
  (await db.query("SELECT (private.account_reputation($1::uuid)->>'count')::integer n",[b])).rows[0].n,
  (await db.query('SELECT public.rpc_list_received_reviews_v1(20,NULL) n')).rows[0].n,
  (await db.query('SELECT public.rpc_list_review_comments_v1($1::uuid,20,NULL) n',[profile])).rows[0].n,
 ];
 await write(db,a,b);
 assert.deepEqual(await publicRows(),[0,0,0]);
 await write(db,b,a);
 assert.deepEqual(await publicRows(),[1,1,1]);
});
