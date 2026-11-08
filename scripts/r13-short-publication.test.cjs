'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const r13=read('scripts/sql/r13_instant_push_and_capacity_dispatch_20261108.sql');
const forward=read('supabase/migrations/20261108141444_r13_short_publication_transaction_20261108.sql');
test('R13 publication is queue-only, without heavy in-transaction matching',()=>{
 const part=r13.slice(r13.indexOf('CREATE OR REPLACE FUNCTION private.enqueue_on_need_change()'),r13.indexOf('-- 4. Worker default availability'));
 assert.ok(part.length>450);
 assert.ok(part.includes('perform private.enqueue_dispatch(new.id, statement_timestamp());'));
 assert.ok(!part.includes('perform private.dispatch_next_wave(new.id);'));
});
test('R13 repair guards source fingerprint and unchanged privileges',()=>{
 for(const key of ['ea56b40af1ebd687d1713f75e619392c','3f7d263b9e1724e683c9c920ed782550','R13_SHORT_PUBLICATION_PREIMAGE_DRIFT','R13_SHORT_PUBLICATION_POSTIMAGE_DRIFT','v_acl','v_owner','v_privileged','v_settings','execute v_new_definition'])assert.ok(forward.includes(key),key);
 assert.ok(forward.includes("set local statement_timeout='10s'"));
});
