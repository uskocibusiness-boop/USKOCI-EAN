'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const value={accountId:'owner',profileId:'profile',revision:'r1',timezone:'Europe/Belgrade',availableNow:true,
 rules:[{id:'r1',weekdays:[1,2,3,4,5],startTime:'09:00:00',endTime:'17:00:00',startsOn:'2026-01-01',endsOn:null,label:'',active:true}],windows:[]};
const text=r=>JSON.stringify(r.toJSON());
const component=()=>createHarness().load('src/ui/workerProfile/SavedAvailability.tsx').SavedAvailability;
test('UX04 saved days, hours and time zone are visible without opening AI',async()=>{
 const r=await mount(component(),{view:{kind:'ready',value},disabled:false});const s=text(r);
 for(const expected of ['Pon · Uto · Sre · Čet · Pet','09:00–17:00','Po vremenu u Srbiji','Dogovori ostaju obaveze'])assert.ok(s.includes(expected),expected);
 assert.ok(!s.includes('Mogu odmah'));await unmount(r);
});
test('UX04 paused rules and start/end dates are not advertised as current free time',async()=>{
 const r=await mount(component(),{view:{kind:'ready',value:{...value,rules:[{...value.rules[0],active:false,startsOn:'2027-02-01',endsOn:'2027-04-30',weekdays:[6,0],label:'Vikend'}]}},disabled:false});
 const s=text(r);for(const e of ['Sub · Ned','pauzirano','1. feb 2027','30. apr 2027','Vikend'])assert.ok(s.includes(e),e);await unmount(r);
});
test('UX04 dated availability and unavailability retain their meaning and zone',async()=>{
 const r=await mount(component(),{view:{kind:'ready',value:{...value,rules:[],windows:[{id:'w1',startsAt:'2026-11-09T08:00:00Z',endsAt:'2026-11-09T10:00:00Z',state:'AVAILABLE',label:'Poseban termin'},{id:'w2',startsAt:'2026-11-10T08:00:00Z',endsAt:'2026-11-10T10:00:00Z',state:'UNAVAILABLE',label:'Odsutan'}]}},disabled:false});
 const s=text(r);for(const e of ['Slobodno za rad','Zauzeto','09:00','11:00','Poseban termin','Odsutan'])assert.ok(s.includes(e),e);await unmount(r);
});
test('UX04 empty and unavailable are different and never claim always available',async()=>{
 const C=component(),r=await mount(C,{view:{kind:'ready',value:{...value,rules:[]}},disabled:false});
 assert.ok(text(r).includes('Redovni termini nisu podešeni.'));assert.ok(!text(r).includes('svakog dana'));
 await RTR.act(async()=>r.update(React.createElement(C,{view:{kind:'unavailable'},disabled:false})));assert.ok(text(r).includes('trenutno nije dostupan'));assert.ok(!text(r).includes('09:00'));await unmount(r);
});
test('UX04 retry is explicit and display stays read-only',async()=>{
 let calls=0;const r=await mount(component(),{view:{kind:'unavailable'},retry:()=>calls++,disabled:false});assert.equal(calls,0);
 await press(target(r,'Proverite sačuvani raspored'));assert.equal(calls,1);await unmount(r);
});
test('UX04 loading hides old schedule rather than disguising it as current',async()=>{
 const C=component(),r=await mount(C,{view:{kind:'ready',value},disabled:false});
 await RTR.act(async()=>r.update(React.createElement(C,{view:{kind:'loading'},disabled:false})));assert.ok(!text(r).includes('09:00'));assert.ok(text(r).includes('Učitavamo'));await unmount(r);
});
test('UX04 long saved schedules disclose in bounded increments; revision resets display',async()=>{
 const C=component(),many={...value,rules:Array.from({length:18},(_,i)=>({...value.rules[0],id:String(i),label:`Pravilo_${i}`}))};const r=await mount(C,{view:{kind:'ready',value:many},disabled:false});
 assert.ok(text(r).includes('Pravilo_7'));assert.ok(!text(r).includes('Pravilo_8'));await press(target(r,'Prikažite još termina'));assert.ok(text(r).includes('Pravilo_15'));assert.ok(!text(r).includes('Pravilo_16'));
 await RTR.act(async()=>r.update(React.createElement(C,{view:{kind:'ready',value:{...many,revision:'r2'}},disabled:false})));assert.ok(!text(r).includes('Pravilo_8'));await unmount(r);
});
async function hookSetup(first={ok:true,podatak:value}){
 const focus={},listeners=new Set(),session={user:{id:'owner'},accountRevision:1},control={next:()=>first},calls=[];let latest;
 const h=createHarness({
  'expo-router':{useFocusEffect:fn=>React.useEffect(()=>{focus.fn=fn;focus.cleanup=fn();return()=>{focus.cleanup?.();focus.cleanup=null;};},[fn])},
  'react-native':{AppState:{currentState:'active',addEventListener:(_,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)};}}},
  'src/store/sesija.ts':{useSesija:()=>session,sesijaSada:()=>session},
  'src/data/workerAvailabilityClientService.ts':{workerAvailabilityClientService:{read:async()=>{calls.push('read');return await control.next();}}},
 });
 const useAvailability=h.load('src/hooks/useWorkerAvailability.ts').useWorkerAvailability;
 function C(p){latest=useAvailability(p.profileId,p.read);return React.createElement('result',{view:latest.view});}
 const r=await mount(C,{profileId:'profile',read:1});
 return{h,r,C,session,control,calls,focus,view:()=>latest.view,refresh:()=>latest.refresh(),
  app:state=>{h.stubs['react-native'].AppState.currentState=state;for(const fn of listeners)fn(state);},stop:()=>unmount(r)};
}
test('UX04 owned reader accepts only the expected account and profile',async()=>{
 const h=await hookSetup();assert.equal(h.view().kind,'ready');h.control.next=()=>({ok:true,podatak:{...value,profileId:'other'}});
 await RTR.act(async()=>h.refresh());assert.equal(h.view().kind,'unavailable');h.control.next=()=>({ok:true,podatak:{...value,accountId:'other'}});
 await RTR.act(async()=>h.refresh());assert.equal(h.view().kind,'unavailable');await h.stop();
});
test('UX04 failure is unavailable, not empty schedule; explicit refresh recovers',async()=>{
 const h=await hookSetup({ok:false,kod:'NETWORK'});assert.equal(h.view().kind,'unavailable');h.control.next=()=>({ok:true,podatak:value});
 await RTR.act(async()=>h.refresh());assert.equal(h.view().kind,'ready');assert.equal(h.calls.length,2);await h.stop();
});
test('UX04 pending result is discarded on blur and on account change',async()=>{
 const pending=deferred(),h=await hookSetup(pending.promise);await RTR.act(async()=>{h.focus.cleanup();h.focus.cleanup=null;});
 await RTR.act(async()=>pending.resolve({ok:true,podatak:value}));assert.equal(h.view().kind,'loading');
 assert.equal(h.calls.length,1);await h.stop();
 const late=deferred(),changed=await hookSetup(late.promise);changed.session.accountRevision++;
 await RTR.act(async()=>late.resolve({ok:true,podatak:value}));assert.equal(changed.view().kind,'loading');assert.equal(changed.calls.length,1);await changed.stop();
});
test('UX04 background clears facts and resumed foreground reads a fresh receipt',async()=>{
 const h=await hookSetup();await RTR.act(async()=>h.app('background'));assert.equal(h.view().kind,'loading');
 await RTR.act(async()=>h.app('active'));assert.equal(h.view().kind,'ready');assert.equal(h.calls.length,2);await h.stop();
});
test('UX04 profile readback invalidates the displayed revision and rejects older response',async()=>{
 const pending=deferred(),h=await hookSetup(pending.promise);h.control.next=()=>({ok:true,podatak:{...value,revision:'r2'}});
 await RTR.act(async()=>h.r.update(React.createElement(h.C,{profileId:'profile',read:2})));
 await RTR.act(async()=>pending.resolve({ok:true,podatak:value}));assert.equal(h.view().value.revision,'r2');assert.equal(h.calls.length,2);await h.stop();
});
test('UX04 missing profile never invokes a speculative reader',async()=>{
 const h=await hookSetup();await RTR.act(async()=>h.r.update(React.createElement(h.C,{profileId:null,read:2})));assert.equal(h.calls.length,1);assert.equal(h.view().kind,'loading');await h.stop();
});
