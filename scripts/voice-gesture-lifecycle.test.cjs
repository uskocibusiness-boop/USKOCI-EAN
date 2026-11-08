'use strict';
// Real hook, microphone/panel, composer, playback and arbiter. Only native
// adapters, Auth/outbox transport and clocks are substitutes. Not Android E2E.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {React,RTR,createHarness,deferred,mount,nodes,target,press,unmount}=require('./ux-component-harness.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({permission='granted',startError=false,screenReader=false}={}){
 const h=createHarness(),session={user:{id:id(1)},accountRevision:1},appListeners=new Set(),accessListeners=new Set();
 const {createFakeRecorder,createFakePlayer,createFakeFiles}=h.load('src/features/voiceMessages/testing/fakes.ts');
 const {createAudioArbiter}=h.load('src/features/voiceMessages/ports.ts');
 const {createVoiceMessageComposer}=h.load('src/features/voiceMessages/voiceMessageComposer.ts');
 const files=createFakeFiles(),arbiter=createAudioArbiter(),recorders=[],players=[],timers=new Set();
 const calls={upload:[],send:[],read:0,refresh:0,reconcile:0};let sequence=10,now=0,admitted=true;
 const outboxState={phase:'ready',capturing:false,entries:[],error:null};
 const outbox={getSnapshot:()=>outboxState,sendVoice:async voice=>{calls.send.push(voice);outboxState.entries.push({command:{voice}});},reconcile:async()=>{calls.reconcile++;}};
 const options={accountId:id(1),accountRevision:1,agreementId:id(2),version:1,isCurrent:()=>admitted,writable:true,canRecord:true,messages:[],historyError:false,refresh:async()=>{calls.refresh++;}};
 h.native.AppState={currentState:'active',addEventListener:(_,fn)=>{appListeners.add(fn);return{remove:()=>appListeners.delete(fn)};}};
 h.native.AccessibilityInfo={isScreenReaderEnabled:async()=>screenReader,addEventListener:(_,fn)=>{accessListeners.add(fn);return{remove:()=>accessListeners.delete(fn)};}};
 Object.assign(h.stubs,{
  'react-native-reanimated':{__esModule:true,default:{View:'AnimatedView'}},
  'expo-router':{useFocusEffect:fn=>React.useEffect(fn,[fn])},
  'src/store/sesija.ts':{sesijaSada:()=>session},
  'src/hooks/useAgreementOutbox.ts':{useAgreementVoiceOutbox:()=>({model:outbox,state:outboxState})},
  'src/data/agreementVoiceClientService.ts':{agreementVoiceClientService:{
   upload:async(ref,bytes,scope,signal)=>{calls.upload.push({ref,bytes,scope,signal});return{ok:true,podatak:{state:'READY',assetId:id(++sequence),voice:{durationMs:4200},attachedMessageId:null}};},
   read:async()=>{calls.read++;return{ok:false,kod:'UNEXPECTED_READ',poruka:'Unexpected read'};},cancel:async()=>({ok:true,podatak:{state:'CANCELLED'}}),
   playback:async()=>({ok:true,podatak:{bytes:new ArrayBuffer(64)}})}},
  'src/data/agreementPhotoJournal.ts':{agreementVoiceJournal:{load:async()=>[],save:async()=>{},clear:async()=>{}}},
  'src/features/voiceMessages/nativeVoiceFiles.ts':{nativeVoiceFiles:files.port},
  'src/features/voiceMessages/nativeAudioAdapters.ts':{
   createNativeVoiceRecorder:()=>{const r=createFakeRecorder({permission,file:{uri:`file:///cache/voice-${recorders.length}.m4a`,durationMs:4200}});r.state.startError=startError;recorders.push(r);files.put(r.state.file.uri);return r.port;},
   createNativeVoicePlayer:()=>{const p=createFakePlayer();players.push(p);return p.port;}},
  'src/features/voiceMessages/audioArbiter.ts':{sharedAudioArbiter:arbiter},
  'src/features/voiceMessages/voiceMessageComposer.ts':{createVoiceMessageComposer:opts=>createVoiceMessageComposer({...opts,now:()=>now,
   timers:{setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)}})},
  'src/lib/idempotencija.ts':{noviUuidZahtevId:()=>id(++sequence)},
  'src/ui/system/haptics.ts':{tick:()=>{}},
 });
 const {useAgreementVoice}=h.load('src/hooks/useAgreementVoice.ts');
 const {AgreementVoiceMic,AgreementVoicePanel}=h.load('src/ui/media/AgreementVoiceControls.tsx');
 function Host(){const voice=useAgreementVoice(options);return React.createElement(React.Fragment,null,
  React.createElement('VoiceState',{voice}),React.createElement(AgreementVoiceMic,{voice}),React.createElement(AgreementVoicePanel,{voice,writable:options.writable}));}
 const r=await mount(Host,{}),voice=()=>nodes(r,n=>n.type==='VoiceState')[0].props.voice;
 const mic=()=>nodes(r,n=>n.props.accessibilityLabel==='Držite za glasovnu poruku')[0];
 const grant=()=>RTR.act(async()=>{mic().props.onResponderGrant({nativeEvent:{pageX:20,pageY:40}});await tick();});
 const release=()=>RTR.act(async()=>{mic().props.onResponderRelease();await tick();});
 const background=state=>RTR.act(async()=>{h.native.AppState.currentState=state;for(const fn of [...appListeners])fn(state);await tick();});
 let stopped=false;
 return{r,voice,mic,grant,release,options,session,calls,files,recorders,players,timers,arbiter,appListeners,accessListeners,background,
  recorder:()=>recorders.at(-1),advance:ms=>RTR.act(async()=>{now+=ms;for(const fn of [...timers])fn();await tick();}),
  rerender:()=>RTR.act(async()=>r.update(React.createElement(Host,{}))),
  stop:async()=>{if(!stopped){stopped=true;await unmount(r);await tick();}}};
}

for(const permission of ['later','denied','blocked','unavailable'])test(`voice mic can retry after ${permission} without leaving the conversation`,async()=>{
 const h=await fixture({permission});try{
  await h.grant();assert.equal(h.voice().recording.phase,'idle');assert.equal(h.voice().recording.canRecord,true);
  await h.release();h.recorder().state.permission='granted';await h.grant();
  assert.equal(h.recorder().state.permissionAsked,2);assert.equal(h.voice().recording.phase,'recording');assert.equal(h.calls.upload.length,0);
 }finally{await h.stop();}
});
test('voice mic can retry a failed native start with the same conversation owner',async()=>{
 const h=await fixture({startError:true});try{
  await h.grant();assert.equal(h.voice().recording.error.code,'RECORDING_FAILED');assert.equal(h.recorder().state.cancelled,1);
  await h.release();h.recorder().state.startError=false;await h.grant();assert.equal(h.voice().recording.phase,'recording');assert.equal(h.recorder().state.started,1);
 }finally{await h.stop();}
});
test('voice mic can retry after a system interruption discards a too-short recording',async()=>{
 const h=await fixture();try{
  await h.grant();h.recorder().state.file={...h.recorder().state.file,durationMs:100};
  await RTR.act(async()=>{h.recorder().interrupt('AUDIO_FOCUS');await tick();});assert.equal(h.voice().recording.phase,'idle');
  await h.release();await h.grant();assert.equal(h.recorder().state.started,2);assert.equal(h.voice().recording.phase,'recording');assert.equal(h.calls.upload.length,0);
 }finally{await h.stop();}
});
test('interrupted valid recording requires explicit send and does not block the next recording',async()=>{
 const h=await fixture();try{
  await h.grant();await RTR.act(async()=>{h.recorder().interrupt('AUDIO_FOCUS');await tick();});assert.equal(h.voice().recording.phase,'review');
  await h.release();assert.equal(h.calls.send.length,0);await press(target(h.r,'Pošaljite snimak'));assert.equal(h.calls.send.length,1);
  assert.equal(h.voice().recording.phase,'idle');await h.grant();assert.equal(h.recorder().state.started,2);
 }finally{await h.stop();}
});
test('maximum-duration stop keeps review explicit and releases the old gesture for another recording',async()=>{
 const h=await fixture();try{
  await h.grant();await h.advance(300000);assert.equal(h.voice().recording.phase,'review');assert.equal(h.timers.size,0);
  await h.release();assert.equal(h.calls.send.length,0);await press(target(h.r,'Pošaljite snimak'));assert.equal(h.calls.send.length,1);
  await h.grant();assert.equal(h.recorder().state.started,2);
 }finally{await h.stop();}
});
test('ordinary explicit finger release still sends one recording and permits the next hold',async()=>{
 const h=await fixture();try{
  await h.grant();assert.equal(h.voice().recording.phase,'recording');await h.release();
  assert.equal(h.calls.upload.length,1);assert.equal(h.calls.send.length,1);assert.equal(h.voice().recording.phase,'idle');
  await h.release();assert.equal(h.calls.send.length,1);await h.grant();assert.equal(h.recorder().state.started,2);
 }finally{await h.stop();}
});
test('release during permission request cannot send or open a late microphone',async()=>{
 const h=await fixture(),permission=deferred();try{
  h.recorder().port.requestPermission=()=>permission.promise;await h.grant();assert.equal(h.voice().recording.phase,'requesting');
  await h.release();await RTR.act(async()=>{permission.resolve('granted');await tick();});
  assert.equal(h.recorder().state.started,0);assert.equal(h.calls.send.length,0);assert.equal(h.voice().recording.phase,'idle');
 }finally{await h.stop();}
});
test('background and unmount cancel microphone, clear subscriptions and never send',async()=>{
 const h=await fixture();try{
  await h.grant();const original=h.recorder();await h.background('background');assert.equal(original.state.recording,false);assert.equal(original.listenerCount(),0);assert.equal(h.timers.size,0);assert.equal(h.arbiter.current(),null);
  await h.background('active');await h.grant();const current=h.recorder();assert.equal(current.state.recording,true);
  await h.stop();assert.equal(current.state.recording,false);assert.equal(current.listenerCount(),0);assert.equal(h.appListeners.size,0);assert.equal(h.accessListeners.size,0);assert.equal(h.calls.send.length,0);
 }finally{await h.stop();}
});
test('screen-reader recording keeps the explicit review and send step',async()=>{
 const h=await fixture({screenReader:true});try{
  await press(target(h.r,'Snimite glasovnu poruku'));assert.equal(h.voice().recording.phase,'recording');
  await press(target(h.r,'Zaustavite snimanje i pregledajte glasovnu poruku'));assert.equal(h.voice().recording.phase,'review');assert.equal(h.calls.send.length,0);
  await press(target(h.r,'Pošaljite snimak'));assert.equal(h.calls.send.length,1);
  await press(target(h.r,'Snimite glasovnu poruku'));assert.equal(h.recorder().state.started,2);
 }finally{await h.stop();}
});
test('late permission from a retired visit cannot clear or send the new visit hold',async()=>{
 const h=await fixture(),permission=deferred();try{
  const old=h.recorder();old.port.requestPermission=()=>permission.promise;await h.grant();await h.background('background');await h.background('active');await h.grant();
  const current=h.recorder();assert.notEqual(current,old);assert.equal(current.state.recording,true);
  await RTR.act(async()=>{permission.resolve('granted');await tick();});assert.equal(old.state.started,0);assert.equal(current.state.recording,true);assert.equal(h.calls.send.length,0);
  await h.release();assert.equal(h.calls.send.length,1);assert.equal(current.state.stopped,1);
 }finally{await h.stop();}
});
test('message switching and unmount release the player and remove private temporary files',async()=>{
 const h=await fixture();try{
  const message=n=>({id:id(n),glas:{assetId:id(n+100),trajanjeMs:4200}});
  await RTR.act(async()=>h.voice().toggle(message(50)));const player=h.players.at(-1),first=h.files.log.written.at(-1);
  assert.equal(player.state.playing,true);assert.equal(h.arbiter.current(),'playback');assert.equal(player.listenerCount(),1);
  await RTR.act(async()=>h.voice().toggle(message(51)));const second=h.files.log.written.at(-1);
  assert.notEqual(second,first);assert.ok(h.files.log.removed.includes(first));assert.equal(h.voice().playback.assetId,id(151));assert.equal(player.listenerCount(),1);
  await h.stop();assert.equal(player.state.playing,false);assert.equal(player.listenerCount(),0);assert.equal(player.state.loaded,null);assert.ok(h.files.log.removed.includes(second));assert.equal(h.arbiter.current(),null);
 }finally{await h.stop();}
});
