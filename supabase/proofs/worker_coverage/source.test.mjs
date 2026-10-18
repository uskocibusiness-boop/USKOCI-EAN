import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir=new URL('../../candidates/worker-coverage-20261018/',import.meta.url);
const read=(name)=>readFileSync(new URL(name,dir),'utf8');
const body=(s)=>s.split('$function$')[1];
const md5=(s)=>createHash('md5').update(s).digest('hex');
const before=read('live-worker-need-fit.sql');
const candidate=read('country-guard.candidate.sql');
const revert=read('country-guard.revert.sql');
const pins=JSON.parse(read('country-guard.pins.json'));
test('baseline snapshot and exact revert body are pinned to observed DEV',()=>{
 assert.equal(md5(body(before)),pins.baselineBodyMd5);
 assert.equal(body(revert),body(before));
 assert.equal(md5(body(candidate)),pins.candidateBodyMd5);
});
test('only the coordinate-free country predicate changes; service, time and signed scope stay byte exact',()=>{
 const recovered=body(candidate).replace("else n.task_country_code is not null\n        and n.task_country_code=p.operating_country_code\n        and btrim",'else btrim');
 assert.equal(recovered,body(before));
});
test('both transactions refuse source drift and changed closure/ACL/security',()=>{
 for(const sql of [candidate,revert]) {
   assert.match(sql,/WORKER_COUNTRY_PREDECESSOR_DRIFT/);
   assert.match(sql,/WORKER_COUNTRY_CLOSURE_CHANGED/);
   assert.match(sql,/row\(p.proacl::text,p.proowner,p.prosecdef,p.provolatile,p.proparallel,p.proconfig::text\)/);
   assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/\b(?:insert into|update|delete from|grant)\b/i);
 }
});
