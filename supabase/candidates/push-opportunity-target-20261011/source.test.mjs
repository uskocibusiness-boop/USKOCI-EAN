import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./candidate.sql',import.meta.url),'utf8');
const fixture=readFileSync(new URL('./disposable-fixture.sql',import.meta.url),'utf8');
const proofs=readFileSync(new URL('./disposable-assert.sql',import.meta.url),'utf8');
test('new opportunity resolver never dispatches, modifies data or makes provider calls',()=>{
 const body=sql.replace(/--[^\n]*/g,'');
 assert.match(body,/create function public\.rpc_resolve_activity_opportunity_v1\(p_expected_user_id uuid,p_event_id uuid\)/i);
 assert.doesNotMatch(body,/\b(?:insert|update|delete|truncate|net\.http_post|notify|http_|pg_sleep|set_config)\b/i);
 assert.match(body,/private\.support_auth_v5\(p_expected_user_id\)/);
 assert.match(body,/e\.event_type='OPPORTUNITY_AVAILABLE'/);
 assert.match(body,/e\.entity_version=n\.revision/);
 assert.match(body,/od\.worker_account_id=u/);
 assert.match(body,/od\.expires_at>clock_timestamp\(\)/);
 assert.match(body,/private\.accounts_same_world/);
 assert.match(body,/revoke all on function .* from public,anon/i);
 assert.match(body,/grant execute on function .* to authenticated/i);
});
test('disposable proof actively refuses all dangerous mismatches',()=>{
 for(const label of ['WRONG_EVENT_TYPE','STALE_EVENT_REVISION','WRONG_DEDUPE','DECLINED',
 'EXPIRED_DELIVERY','SUPPRESSED_INAPP','CLOSED_INAPP','CHANGED_TASK_REVISION',
 'CLOSED_TASK','OWN_TASK','OTHER_WORLD','SUSPENDED','SAFETY','CLOSURE','FOREIGN_IDENTITY_ADMITTED'])
  assert.ok(proofs.includes(label),label);
 assert.match(fixture,/create schema auth/i);
 assert.doesNotMatch(sql,/\b(?:ExpoPushToken|expoAccessToken|service_role)\b/);
});
