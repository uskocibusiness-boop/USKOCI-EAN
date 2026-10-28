// Pure synthetic PostgreSQL timezone/interval math; NOT real match/dispatch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('TODAY local end, availability, blackout and DST matrix (11 cases)',async()=>{
 const db=new PGlite();
 try{
   const source=readFileSync(new URL('./today_window_synthetic.sql',import.meta.url),'utf8');
   const statements=await db.exec(source);
   const row=statements.flatMap(x=>x.rows??[]).find(r=>r.capture)?.capture;
   assert(row,'synthetic timeline capture required');
   assert.equal(row.unit,'R05_TODAY_FLEXIBLE_SYNTHETIC_DAY_MATRIX');
   assert.equal(row.cases,11);
   assert.deepEqual(row.mismatches,[]);
   const values=new Map(row.results.map(r=>[r.label,r]));
   assert.deepEqual([values.get('spring_DST_23h').tier,values.get('spring_DST_23h').hours],[2,23]);
   assert.deepEqual([values.get('fall_DST_25h').tier,values.get('fall_DST_25h').hours],[2,25]);
   assert.equal(values.get('expired_next_midnight').tier,null);
   assert.equal(values.get('later_today').tier,2);
   assert.equal(values.get('fully_blocked').tier,null);
 } finally {await db.close();}
});
