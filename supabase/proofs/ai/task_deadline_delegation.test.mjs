// Pure parsing/validation boundary. Actual signed prepare, ownership, closure,
// Save, publication and lost ACK run in r04_need_semantic_save_chain.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../../../docs/candidates/task-ai-deadline-20261021/forward_candidate.sql',import.meta.url),'utf8');
const definition=name=>sql.match(new RegExp('CREATE (?:OR REPLACE )?FUNCTION '+name.replaceAll('.','\\.')+'\\([\\s\\S]*?\\$function\\$;'))[0];
async function setup(t){
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE SCHEMA private');
 for(const name of ['private.validate_need_v2_fact','private.ai_task_response_deadline_v1'])await db.exec(definition(name));
 return db;
}
const run=(db,value,status='NEEDS_CONFIRMATION')=>db.query('SELECT private.ai_task_response_deadline_v1($1::jsonb) result',
 [JSON.stringify(value===undefined?[]:[{key:'need.response_deadline',value,status}])]).then(r=>r.rows[0].result);
test('optional deadline preserves its instant; NONE and unknown do not invent a deadline',async t=>{
 const db=await setup(t);
 assert.equal(await run(db),null);
 assert.equal(Date.parse(await run(db,{kind:'AT',at:'2099-10-10T16:00:00+01:00'})),Date.parse('2099-10-10T15:00:00Z'));
 assert.equal(await run(db,{kind:'NONE'}),null);
 assert.equal(await run(db,{kind:'AT',at:'2099-10-10T15:00:00Z'},'UNKNOWN'),null);
});
test('past, malformed and extra-field deadline facts are refused',async t=>{
 const db=await setup(t);
 for(const value of [{kind:'AT',at:'2020-01-01T00:00:00Z'},{kind:'AT',at:'2099-02-30T00:00:00Z'},{kind:'NONE',at:'2099-01-01T00:00:00Z'},{}])
  await assert.rejects(run(db,value),/RESPONSE_DEADLINE_/);
});
