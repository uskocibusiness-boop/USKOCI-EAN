import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const dir = 'supabase/candidates/temporal-deadline-20261011/';
const read = file => readFileSync(dir+file,'utf8');
const manifest = JSON.parse(read('start-only-api-bundle.manifest.json'));
const fn = sql => {
 const a=sql.indexOf('CREATE OR REPLACE FUNCTION');
 assert.notEqual(a,-1);
 const end=sql.indexOf('$function$;',a);
 assert.notEqual(end,-1);
 return sql.slice(a,end+'$function$;'.length)+'\n';
};
const body = code => {
 const m=code.match(/AS \$function\$([\s\S]*?)\$function\$/);
 assert.ok(m,'missing function body'); return m[1];
};
const md5=code=>createHash('md5').update(code).digest('hex');
const forward=read('start-only-api-forward.sql');
const revert=read('start-only-api-revert.sql');
test('atomic forward/revert packages cover exactly 7 captured RPCs with pinned source',()=>{
 assert.equal(manifest.length,7);
 for(const m of manifest){
  const candidate=fn(read(m.file));
  assert.equal(md5(body(candidate)),m.candidateMd5,m.file+' proposed source drift');
  assert.ok([...revert.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/g)]
    .some(match=>md5(body(match[0]))===m.predecessorMd5),m.file+' predecessor drift');
  assert.ok(forward.includes(candidate),m.file+' missing exact forward definition');
  assert.ok(forward.includes(m.candidateMd5));
  assert.ok(forward.includes(m.predecessorMd5));
  assert.ok(revert.includes(m.candidateMd5));
  assert.ok(revert.includes(m.predecessorMd5));
 }
});
test('bundles are transaction-pinned with exact ACL, volatility and search path',()=>{
 for(const sql of [forward,revert]){
  assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,7);
  for(const marker of ['BEGIN;','COMMIT;','SET LOCAL lock_timeout','SET LOCAL statement_timeout','DO $preflight$','DO $postflight$','p.prosecdef=true','p.provolatile=','p.proparallel=','p.proacl::text','p.proconfig::text']){
   assert.ok(sql.includes(marker),marker);
  }
  assert.doesNotMatch(sql,/\b(?:update|delete|insert|truncate)\s+(?:into\s+|from\s+)?(?:public\.|private\.)?(?:needs|app_profiles|marketplace_responses|agreement_versions|notification_deliveries)\b/i);
 }
});
