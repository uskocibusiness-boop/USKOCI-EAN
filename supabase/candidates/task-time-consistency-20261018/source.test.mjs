import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const root='supabase/candidates/task-time-consistency-20261018/';
const read=name=>readFileSync(root+name,'utf8').replace(/\r\n/g,'\n');
const body=source=>source.match(/AS \$function\$([\s\S]*?)\$function\$/)[1];
const md5=value=>createHash('md5').update(value).digest('hex');
const functions=source=>[...source.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$\s*;/g)].map(m=>m[0]);
const manifest=JSON.parse(read('manifest.json'));
test('five exact predecessors and candidates retain signatures and pinned bodies',()=>{
 const before=functions(read('before.sql')),after=functions(read('candidate.sql'));
 assert.equal(before.length,5);assert.equal(after.length,5);
 for(let i=0;i<before.length;i++){
  assert.equal(md5(body(before[i])),manifest.functions[i].predecessorBodyMd5);
  assert.equal(md5(body(after[i])),manifest.functions[i].candidateBodyMd5);
  const clean=body(after[i])
   .replace(/  -- Existing agreements and idempotent selection receipts returned above\.[\s\S]*?  end if;\n\n/,'')
   .replace(/  -- New work uses the same actual task-time boundary as search\/dispatch\.[\s\S]*?  end if;\n\n/,'')
   .replace(/    -- KEEP\/UPDATE is a new application to the current task\.[\s\S]*?    end if;\n/,'')
   .replace('        or not private.need_search_time_admitted_v1(n.id,statement_timestamp())\n','');
  assert.equal(clean,body(before[i]),manifest.functions[i].signature+' changed outside the bounded temporal gate');
 }
});
test('writes check wall clock after lock and after replay, withdrawal remains independent',()=>{
 const code=functions(read('candidate.sql'));
 for(const f of code.slice(0,3)){
  const gate=f.indexOf("NEED_EXECUTION_WINDOW_EXPIRED");
  assert.ok(f.lastIndexOf('for update;',gate)>0);
  assert.ok(f.indexOf('idempotentReplay')<gate || f.indexOf('return v_command.agreement_id')<gate);
  assert.match(f.slice(0,gate),/need_search_time_admitted_v1\([^,]+,clock_timestamp\(\)\)/);
  assert.match(f.slice(gate,gate+90),/errcode='PT409'/);
 }
 assert.ok(code[1].indexOf("if v_action = 'WITHDRAW' then")<code[1].indexOf("NEED_EXECUTION_WINDOW_EXPIRED"));
 for(const f of code.slice(3)){
  assert.ok(f.indexOf("when c.has_agreement or c.status='SELECTED'")<f.indexOf('need_search_time_admitted_v1'));
 }
});
test('deployment preserves ACLs and runs no business DML or lifecycle tick',()=>{
 for(const name of ['candidate.sql','revert.sql']){
  const sql=read(name),shell=sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$\s*;/g,'');
  assert.match(sql,/BEGIN;/);assert.match(sql,/COMMIT;/);
  assert.doesNotMatch(shell,/\b(update|insert into|delete from|truncate|expire_lifecycle|dispatch_tick)\b/i);
  assert.doesNotMatch(shell,/\b(GRANT|REVOKE)\b/);
 }
 assert.ok(read('assert.sql').includes('EXISTING_AGREEMENT_TERMS_STATUS_AND_SLOTS_UNCHANGED'));
});

