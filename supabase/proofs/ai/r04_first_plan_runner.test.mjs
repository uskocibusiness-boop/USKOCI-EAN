import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {validateRuntime,dockerStartArgs,bind,nativeSchema,fixtureSql,completionSql} from './run_first_plan_concurrency.mjs';
import {account} from './r06_first_plan_fixture.mjs';

test('native first-plan runner refuses external connections and owns only a fresh socket-only container',()=>{
 validateRuntime({});
 for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','PGHOST','PGSERVICE','DATABASE_URL','SUPABASE_DB_URL'])
  assert.throws(()=>validateRuntime({[key]:'external'}),/R04_EXTERNAL_RUNTIME_REFUSED/);
 const args=dockerStartArgs('uskoci-r04-00000000-0000-4000-8000-000000000000');
 assert.equal(args[args.indexOf('--network')+1],'none');
 assert.ok(args.includes('supabase/postgres:17.6.1.165'));
 assert.ok(args.includes('--rm'));assert.ok(!args.includes('--volume'));assert.ok(!args.includes('--publish'));
 assert.ok(args.at(-1).includes("listen_addresses=''"));
 assert.throws(()=>dockerStartArgs('existing-container'));
});

test('synthetic SQL parameter binder quotes data without interpreting apostrophes or parameter-like text',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const value="O'Brien; $2; DROP TABLE example;";
 const result=await db.query(bind('SELECT $1::text value,$2::jsonb payload',[value,{text:value}]));
 assert.deepEqual(result.rows,[{value,payload:{text:value}}]);
});

test('native fixture uses real closure bodies and generated completion SQL; closed account prevents writes',async t=>{
 const db=new PGlite({extensions:{pgcrypto}});t.after(()=>db.close());await db.exec(nativeSchema());
 await db.exec(await fixtureSql('NEED'));
 await db.query('INSERT INTO private.account_closure_requests VALUES($1,\'READY\')',[account]);
 await assert.rejects(()=>db.exec(completionSqlText),/ACCOUNT_CLOSING/);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.ai_messages')).rows[0].n,0);
 await db.query('DELETE FROM private.account_closure_requests');
 const result=await db.query(completionSqlText);
 assert.equal(result.rows[0].result.firstPlan.state,'RESOLVED');
 assert.equal((await db.query('SELECT count(*)::int n FROM private.work_taxonomy_categories')).rows[0].n,3);
});
const completionSqlText=await completionSql('NEED');
