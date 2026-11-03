// Derive expected digests from a read-only DEV capture. Never update a certificate.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const hash=(s,a='sha256')=>createHash(a).update(s).digest('hex');
const signature=s=>s.replaceAll(', ', ',');
const body=f=>{
 const start=f.definition.indexOf('AS $function$'),end=f.definition.lastIndexOf('$function$');
 assert.ok(start>=0&&end>start,'Missing function body');
 return hash(f.definition.slice(start+'AS $function$'.length,end),'md5');
};
export async function deriveClosure(capture,derived){
 assert.equal(capture.project_ref,'leqcwgzvjsxugfgzdmth');assert.equal(capture.read_only,'on');
 for(const key of ['source','schema','erasure'])assert.equal(hash(capture[key+'_input']),capture.actual[key],key+' capture integrity');
 const schema=JSON.parse(capture.schema_input),erasure=JSON.parse(capture.erasure_input);
 let source=capture.source_input;
 const prefix=source.slice(0,260).split(':');
 assert.equal(prefix[0],capture.actual.schema);assert.equal(prefix[1],capture.actual.erasure);
 assert.match(source.slice(0,260),/^(?:[a-f0-9]{64}:){4}$/);
 const db=new PGlite();
 try{
  const canonical=async value=>(await db.query('SELECT $1::jsonb::text value',[JSON.stringify(value)])).rows[0].value;
  assert.equal(await canonical(schema),capture.schema_input,'PG canonical schema bytes');
  assert.equal(await canonical(erasure),capture.erasure_input,'PG canonical erasure bytes');
  for(const after of derived.changed){
   const before=derived.before.find(f=>f.signature===after.signature),old=body(before),next=body(after),sig=signature(after.signature);
   const token=sig+':'+old,entry=source.slice(260).split('\n').find(line=>line.startsWith(sig+':'));
   if(entry){
    assert.equal(entry,token,'Source roster preimage');
    assert.equal(source.split(token).length,2,'Duplicate roster signature');source=source.replace(token,sig+':'+next);
   }
   const member=erasure.functions.find(f=>f.signature===sig);
   if(member){assert.equal(member.source,old,'Erasure function preimage');member.source=next;}
   // The changed functions are not trigger owners. Reject future scope expansion.
   assert.ok(!schema.some(t=>(t.triggers??[]).some(t=>t[2]===old)),'Trigger change needs explicit projection');
  }
  const hints=schema.find(t=>t.table==='private.work_taxonomy_gemini_turn_hints_v1');assert.ok(hints);
  assert.ok(!hints.columns.some(c=>c[0]==='catalog_resolution'));
  assert.deepEqual(hints.constraints,capture.schema_constraints.map(c=>c.definition));
  hints.columns.push(['catalog_resolution','jsonb',false]);
  const constraints=[...capture.schema_constraints,{name:derived.columnCheckName,definition:derived.columnCheck}];
  assert.equal(new Set(constraints.map(c=>c.name)).size,constraints.length);
  hints.constraints=constraints.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).map(c=>c.definition);
  const nextSchema=hash(await canonical(schema)),nextErasure=hash(await canonical(erasure));
  source=nextSchema+':'+nextErasure+':'+prefix[2]+':'+prefix[3]+':'+source.slice(260);
  return {...capture.actual,schema:nextSchema,erasure:nextErasure,source:hash(source)};
 }finally{await db.close();}
}
