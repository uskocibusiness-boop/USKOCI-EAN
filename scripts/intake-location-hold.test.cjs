'use strict';
// Owner, 23.11.2026: while the place is confirmed on the map, the AI's next question about something else waits.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHarness}=require('./ux-component-harness.cjs');
const {orderIntakeLocation}=createHarness().load('src/ui/v2/intakeLocationOrder.ts');

const msg=(id,fromAi,body,extra={})=>({id,fromAi,body,proposedFactIds:[],safety:'ALLOW',...extra});
const base={scope:'c1',causalMessageId:'a1',canRelease:true,preserveHistory:false,confirmationKey:'k'};
const ids=r=>r.messages.map(m=>m.id);

test('the budget question waits under the map and comes after the confirmed point', () => {
  const messages=[msg('u1',false,'Bulevar oslobođenja 10, Novi Sad'),msg('a1',true,'Koji je planirani budžet?')];
  const roles={a1:'ordinary'};
  const held=orderIntakeLocation(null,{...base,messages,roles,pendingLocation:true,confirmedLocation:false});
  assert.deepEqual(ids(held),['u1'],'only the place is in front of the person');
  const after=orderIntakeLocation(held.state,{...base,messages,roles,pendingLocation:false,confirmedLocation:true});
  assert.deepEqual(ids(after),['u1','a1'],'after the confirmation the conversation goes on');
});

test('replies of the place conversation itself stay visible', () => {
  const messages=[msg('u1',false,'Kod pijace'),msg('a1',true,'Kod koje pijace tačno?')];
  const r=orderIntakeLocation(null,{...base,messages,roles:{a1:'CLARIFY'},pendingLocation:true,confirmedLocation:false});
  assert.deepEqual(ids(r),['u1','a1']);
});

test('putting the map away ("Kasnije") brings the held question back', () => {
  const messages=[msg('u1',false,'Liman'),msg('a1',true,'Kada Vam odgovara?')];
  const roles={a1:'ordinary'};
  const held=orderIntakeLocation(null,{...base,messages,roles,pendingLocation:true,confirmedLocation:false});
  assert.deepEqual(ids(held),['u1']);
  const back=orderIntakeLocation(held.state,{...base,messages,roles,pendingLocation:false,confirmedLocation:false,dismissed:true});
  assert.deepEqual(ids(back),['u1','a1']);
});
