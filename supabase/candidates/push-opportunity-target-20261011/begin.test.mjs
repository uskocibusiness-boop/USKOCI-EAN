import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const before=readFileSync(new URL('./begin-before.sql',import.meta.url),'utf8');
const after=readFileSync(new URL('./begin-candidate.sql',import.meta.url),'utf8');
const body=x=>x.match(/AS \$function\$([\s\S]*?)\$function\$/i)?.[1];
const md5=s=>createHash('md5').update(s).digest('hex');
test('the canonical live begin source is pinned; change keeps a guarded predecessor',()=>{
 assert.ok(body(before));assert.ok(body(after));
 assert.equal(md5(body(before)),'0de54bdd7ddcea92dfa697ade808155f');
 assert.match(after,/PUSH_BEGIN_PREDECESSOR_DRIFT/);
 assert.match(after,/PUSH_BEGIN_POSTFLIGHT_INVALID/);
 assert.match(after,/proacl::text as acl/);
});
test('opportunity begin checks current need and recipient before revealing opaque event',()=>{
 for(const bit of ["'OPPORTUNITY_AVAILABLE'","od.expires_at>clock_timestamp()",
  "private.accounts_same_world","private.closure_account_restricted",
  "private.safety_event_blocked(e)","e.entity_version=n.revision",
  "e.event_type=a.single_target_admission->>'eventType'",
  "od.worker_account_id=d.recipient_user_id"])
  assert.ok(after.includes(bit),bit);
 assert.ok(after.includes("then jsonb_build_object('eventId',v_event_id)"));
 assert.doesNotMatch(after,/net\.http_post|exp\.host/i);
});
