import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./operator-admission.sql',import.meta.url),'utf8');
test('operator admission is separate, fixed to one WORKER and one event/device and unavailable to app roles',()=>{
 for(const required of ["current_user<>'postgres'","'OPPORTUNITY_AVAILABLE'","od.expires_at>=p_expires_at",
 'p_receipt_deadline<=p_expires_at','p_device_revision','p_bound_session_id',
 'private.push_suppression(d)','private.push_session_valid','not private.safety_event_blocked(e)',
 'p_recipient_user_id','on function private.admit_push_opportunity_single_target_v1']) assert.ok(sql.includes(required),required);
 assert.doesNotMatch(sql,/net\.http_post|exp\.host|sendPushNotification|dispatch_next_wave|dispatch_tick/i);
 assert.match(sql,/insert into public\.notification_push_attempts\(/);
 assert.doesNotMatch(sql,/insert into public\.(?:notification_deliveries|opportunity_deliveries|user_activity_events)/);
 assert.match(sql,/from public,anon,authenticated,service_role/);
});
