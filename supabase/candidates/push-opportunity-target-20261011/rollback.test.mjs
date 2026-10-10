import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const dir=new URL('./',import.meta.url),read=p=>readFileSync(new URL(p,dir),'utf8');
const before=read('begin-before.sql'),rollback=read('rollback.sql');
const body=s=>s.match(/AS \$function\$([\s\S]*?)\$function\$/i)?.[1];
const md5=s=>createHash('md5').update(s).digest('hex');
test('rollback restores the exact canonical begin body, no guessed hand-edited variant',()=>{
 assert.ok(body(before)); assert.equal(body(rollback),body(before));
 assert.equal(md5(body(before)),'0de54bdd7ddcea92dfa697ade808155f');
 for(const pin of ['380a2f203da2a7ad344bd80f061abd13',
  'ac72682ce0b16066e726b374586923ca',
  'fca73a3a992b6dd3e9830d8baf0ff866','OPPORTUNITY_ROLLBACK_SOURCE_DRIFT',
  'OPPORTUNITY_ROLLBACK_POSTFLIGHT_FAILED','proacl::text as acl','restrict;'])
  assert.ok(rollback.includes(pin),pin);
});
test('rollback drops only the new functions and never touches data, devices or transport',()=>{
 assert.match(rollback,/drop function private\.admit_push_opportunity_single_target_v1\(/i);
 assert.match(rollback,/drop function public\.rpc_resolve_activity_opportunity_v1\(/i);
 assert.doesNotMatch(rollback,/\b(?:insert|update|delete|truncate|net\.http_post|notify)\b/i);
 assert.doesNotMatch(rollback,/drop\s+(?:table|schema|index|trigger)\b/i);
});
