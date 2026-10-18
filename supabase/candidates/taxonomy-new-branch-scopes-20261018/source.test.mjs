import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='supabase/candidates/taxonomy-new-branch-scopes-20261018/';
const read=name=>readFileSync(dir+name,'utf8').replace(/\r\n/g,'\n');
const functions=source=>[...source.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$\s*;/g)].map(m=>m[0]);
const body=source=>source.split('$function$')[1];
const md5=value=>createHash('md5').update(value).digest('hex');
const manifest=JSON.parse(read('manifest.json'));
test('two exact current predecessors and rollback bodies are pinned',()=>{
 const before=functions(read('before.sql')),after=functions(read('candidate.sql')),revert=functions(read('revert.sql'));
 assert.equal(before.length,2);assert.equal(after.length,2);assert.deepEqual(revert,before);
 for(let i=0;i<before.length;i++){
  assert.equal(md5(body(before[i])),manifest.functions[i].predecessorBodyMd5);
  assert.equal(md5(body(after[i])),manifest.functions[i].candidateBodyMd5);
  assert.ok(read('candidate.sql').includes(manifest.functions[i].predecessorDefinitionMd5));
 }
});
test('parent UUID fix changes only the missing standard UUID group',()=>{
 const before=body(functions(read('before.sql'))[1]),after=body(functions(read('candidate.sql'))[1]);
 assert.equal(after.replace(
  "'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'",
  ()=>"'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'"),before);
});
test('writer changes only same-transaction new-node scope continuity',()=>{
 const before=body(functions(read('before.sql'))[0]);
 let after=body(functions(read('candidate.sql'))[0]);
 after=after.replace(' v_created_ids uuid[]:=ARRAY[]::uuid[];\n','')
  .replace('     v_created_ids:=array_append(v_created_ids,v_category);\n','');
 const start=after.indexOf('     IF v_current_parent IS DISTINCT FROM v_parent THEN');
 const end=after.indexOf('\n    ELSE\n',start);
 assert.ok(start>0&&end>start);
 after=after.slice(0,start)+`     IF v_current_parent IS DISTINCT FROM v_parent OR NOT EXISTS(
       SELECT 1 FROM private.work_taxonomy_category_modes
       WHERE category_id=v_category AND execution_scope=v_mode)
     THEN RAISE EXCEPTION 'BATCH_SEMANTIC_OR_MODE_COLLISION' USING errcode='22023'; END IF;`+after.slice(end);
 assert.equal(after,before);
 for(const name of ['candidate.sql','revert.sql']){
  const shell=read(name).replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$\s*;/g,'');
  assert.doesNotMatch(shell,/\b(update|insert into|delete from|truncate|GRANT|REVOKE)\b/i);
 }
});
