'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const MODULE='src/ui/workerProfile/ApplicationServiceOffer.tsx';
const input={accountId:'owner',accountRevision:1,applicationId:'application',needId:'need',profileId:'profile'};
const result=state=>({ok:true,podatak:{state}});
const alreadyPresent={ok:false,kod:'APPLICATION_SERVICE_ALREADY_PRESENT',poruka:'Ova usluga i način rada već su u Vašem profilu.'};
async function setup(reads=[result('SAVED')]){
 const calls=[],timers=new Map(),focus={};let i=0,tid=0;const control={valid:true,read:()=>reads[Math.min(i++,reads.length-1)],save:()=>result('SAVED')};
 const h=createHarness({
  'expo-router':{useFocusEffect:fn=>React.useEffect(()=>{focus.callback=fn;focus.cleanup=fn();return()=>{focus.cleanup?.();focus.cleanup=null;};},[fn])},
  'src/data/applicationServiceClientService.ts':{applicationServiceAccountCurrent:()=>control.valid,applicationServiceClientService:{
   read:async (value,prepare=false)=>{calls.push({kind:'read',prepare,input:{...value}});return await control.read(value,prepare);},
   save:async (value,review)=>{calls.push({kind:'save',input:{...value}});return await control.save(value,review);},
  }},
 },{[MODULE]:{setTimeout:fn=>{timers.set(++tid,fn);return tid;},clearTimeout:id=>timers.delete(id)}});
 const C=h.load(MODULE).ApplicationServiceOffer;const r=await mount(C,{input,openProfile:()=>calls.push({kind:'profile'})});
 return {r,C,calls,timers,control,focus,
  blur:()=>{focus.cleanup?.();focus.cleanup=null;},refocus:()=>{focus.cleanup=focus.callback();},
  tick:async()=>{const next=timers.entries().next().value;assert.ok(next,'Queued timer');timers.delete(next[0]);await RTR.act(async()=>{next[1]();});},
  stop:()=>unmount(r),
 };
}
const count=(h,kind)=>h.calls.filter(x=>x.kind===kind).length;
const button=h=>nodes(h.r,n=>n.type==='V2Action')[0];
const alreadyNotice=h=>nodes(h.r,n=>n.type==='T'&&JSON.stringify(n.props.children).includes('Ova usluga je već u Vašem profilu.'));

test('UX01 passive already-present service has no redundant offer or write',async()=>{
 const h=await setup([alreadyPresent]);
 assert.equal(nodes(h.r,n=>n.props.testID==='application-service-offer').length,0);
 assert.deepEqual(h.calls.map(x=>[x.kind,x.prepare]),[['read',false]]);await h.stop();
});
test('UX01 explicit add keeps already-present confirmation without a duplicate Save',async()=>{
 const h=await setup([result('NONE'),alreadyPresent]);await press(target(h.r,'Dodajte'));
 assert.equal(alreadyNotice(h).length,1);assert.equal(count(h,'save'),0);
 assert.deepEqual(h.calls.filter(x=>x.kind==='read').map(x=>x.prepare),[false,true]);
 await RTR.act(async()=>{h.blur();h.refocus();});assert.equal(alreadyNotice(h).length,1);
 assert.equal(h.calls.at(-1).prepare,false);assert.equal(count(h,'save'),0);await h.stop();
});
test('UX01 uncertain explicit add can confirm already-present through a read-only retry',async()=>{
 const h=await setup([result('NONE'),{ok:false,kod:'APPLICATION_SERVICE_UNCONFIRMED',poruka:'Nepoznat ishod.'},alreadyPresent]);
 await press(target(h.r,'Dodajte'));assert.equal(button(h).props.error,'Nepoznat ishod.');
 await press(target(h.r,'Pokušajte ponovo'));assert.equal(alreadyNotice(h).length,1);
 assert.deepEqual(h.calls.filter(x=>x.kind==='read').map(x=>x.prepare),[false,true,false]);assert.equal(count(h,'save'),0);await h.stop();
});
test('UX01 hidden passive service does not hide a later check failure',async()=>{
 const h=await setup([alreadyPresent,{ok:false,kod:'APPLICATION_SERVICE_UNCONFIRMED',poruka:'Nepoznat ishod.'}]);
 await RTR.act(async()=>{h.blur();h.refocus();});
 assert.equal(button(h).props.error,'Nepoznat ishod.');assert.equal(button(h).props.label,'Pokušajte ponovo');
 assert.equal(alreadyNotice(h).length,0);assert.equal(count(h,'save'),0);await h.stop();
});
test('UX01 explicit confirmation does not carry over to a new account owner',async()=>{
 const h=await setup([result('NONE'),alreadyPresent]);await press(target(h.r,'Dodajte'));
 assert.equal(alreadyNotice(h).length,1);
 await RTR.act(async()=>h.r.update(React.createElement(h.C,{input:{...input,accountId:'new-owner',accountRevision:2},openProfile:()=>{}})));
 assert.equal(nodes(h.r,n=>n.props.testID==='application-service-offer').length,0);
 assert.equal(h.calls.at(-1).input.accountId,'new-owner');assert.equal(h.calls.at(-1).prepare,false);
 assert.equal(count(h,'save'),0);await h.stop();
});

test('UX01 blur while polling settles local wait; return reads once without Save',async()=>{
 const h=await setup([result('SAVED'),result('CONFIRMED')]);assert.equal(h.timers.size,1);
 await RTR.act(async()=>h.blur());assert.equal(h.timers.size,0);assert.equal(count(h,'read'),1);
 await RTR.act(async()=>h.refocus());assert.equal(count(h,'read'),2);assert.equal(count(h,'save'),0);
 assert.ok(nodes(h.r,n=>n.type==='T'&&JSON.stringify(n.props.children).includes('Dodato u radni profil.')).length);await h.stop();
});
test('UX01 same-tick blur/refocus queues one fresh read after old finally',async()=>{
 const h=await setup([result('SAVED'),result('NONE')]);
 await RTR.act(async()=>{h.blur();h.refocus();});assert.equal(count(h,'read'),2);assert.equal(button(h).props.loading,false);
 assert.ok(h.calls.every(x=>x.kind!=='read'||x.prepare===false));await h.stop();
});
test('UX01 pending read serializes fast refocus and ignores obsolete result',async()=>{
 const old=deferred();const h=await setup([old.promise,result('NONE')]);
 await RTR.act(async()=>{h.blur();h.refocus();h.blur();h.refocus();});assert.equal(count(h,'read'),1);
 await RTR.act(async()=>old.resolve(result('CONFIRMED')));assert.equal(count(h,'read'),2);assert.equal(button(h).props.loading,false);
 assert.equal(count(h,'save'),0);await h.stop();
});
test('UX01 unmount cancels local wait without further network reads',async()=>{
 const h=await setup();await h.stop();assert.equal(h.timers.size,0);assert.equal(count(h,'read'),1);assert.equal(count(h,'save'),0);
});
test('UX01 normal explicit addition saves once and observes confirmation',async()=>{
 const h=await setup([result('NONE'),result('READY'),result('CONFIRMED')]);
 await press(target(h.r,'Dodajte'));assert.equal(count(h,'save'),1);assert.deepEqual(h.calls.filter(x=>x.kind==='read').map(x=>x.prepare),[false,true,false]);await h.stop();
});
test('UX01 leaving before preparation resolves cannot turn stale consent into Save',async()=>{
 const h=await setup([result('NONE')]);const pending=deferred();h.control.read=()=>pending.promise;
 await press(target(h.r,'Dodajte'));await RTR.act(async()=>{h.blur();h.refocus();});
 h.control.read=()=>result('NONE');await RTR.act(async()=>pending.resolve(result('READY')));
 assert.equal(count(h,'save'),0);assert.equal(count(h,'read'),3);assert.equal(h.calls.at(-1).prepare,false);await h.stop();
});
test('UX01 pending Save is not duplicated or unlocked by blur/refocus',async()=>{
 const h=await setup([result('NONE'),result('READY'),result('CONFIRMED')]);const pending=deferred();h.control.save=()=>pending.promise;
 await press(target(h.r,'Dodajte'));assert.equal(count(h,'save'),1);
 await RTR.act(async()=>{h.blur();h.refocus();button(h).props.onPress();});assert.equal(count(h,'save'),1);assert.equal(count(h,'read'),2);
 await RTR.act(async()=>pending.resolve(result('SAVED')));assert.equal(count(h,'read'),3);assert.equal(count(h,'save'),1);assert.equal(h.calls.at(-1).prepare,false);await h.stop();
});
test('UX01 changed account cannot accept late result or start a recovery read',async()=>{
 const old=deferred();const h=await setup([old.promise]);h.control.valid=false;
 await RTR.act(async()=>{h.blur();h.refocus();});await RTR.act(async()=>old.resolve(result('CONFIRMED')));
 assert.equal(count(h,'read'),1);assert.equal(count(h,'save'),0);
 assert.equal(nodes(h.r,n=>n.type==='T'&&JSON.stringify(n.props.children).includes('Dodato u radni profil.')).length,0);await h.stop();
});
test('UX01 changed owner does not let prior result replace new profile state',async()=>{
 const old=deferred();const h=await setup([old.promise,result('NONE')]);
 await RTR.act(async()=>h.r.update(React.createElement(h.C,{input:{...input,accountId:'new-owner',accountRevision:2},openProfile:()=>{}})));
 await RTR.act(async()=>old.resolve(result('CONFIRMED')));assert.equal(count(h,'read'),2);assert.equal(button(h).props.loading,false);
 assert.equal(nodes(h.r,n=>n.type==='T'&&JSON.stringify(n.props.children).includes('Dodato u radni profil.')).length,0);await h.stop();
});
test('UX01 uncertain retry remains read-only',async()=>{
 const h=await setup([{ok:false,kod:'APPLICATION_SERVICE_UNCONFIRMED',poruka:'Nepoznat ishod.'},result('NONE')]);
 await press(target(h.r,'Pokušajte ponovo'));assert.deepEqual(h.calls.map(x=>[x.kind,x.prepare]),[['read',false],['read',false]]);await h.stop();
});
test('UX01 observation stays bounded to four polling waits',async()=>{
 const h=await setup();for(let i=0;i<4;i++)await h.tick();assert.equal(h.timers.size,0);assert.equal(count(h,'read'),5);assert.equal(button(h).props.label,'Osvežite');assert.equal(button(h).props.loading,false);await h.stop();
});
