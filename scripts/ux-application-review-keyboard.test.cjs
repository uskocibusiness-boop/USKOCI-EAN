'use strict';
// Real composer + ProductSheet lifecycle. Native keyboard/scroll boundaries are
// controlled; Android layout/IME behavior still requires installed-device proof.
const test=require('node:test'),assert=require('node:assert/strict');
const {React,RTR,createHarness,mount,nodes,unmount}=require('./ux-component-harness.cjs');
async function composer(){
 const h=createHarness(),listeners=new Map(),scrolls=[],calls=[];let visible=false,dismisses=0;
 const host=(file,names)=>h.stubs[file]=Object.fromEntries(names.map(name=>[name,h.host(name)]));
 for(const [file,names]of [
  ['src/ui/product/ProductDetails.tsx',['ProductHeader']],['src/ui/system/FactRow.tsx',['FactRow']],
  ['src/ui/system/FlowFooter.tsx',['FlowFooter']],['src/ui/system/InfoButton.tsx',['InfoButton']],
  ['src/ui/system/KeyValueRow.tsx',['KeyValueRow']],['src/ui/system/MoneySummary.tsx',['MoneySummary']],
  ['src/ui/system/StateView.tsx',['StateView']],['src/ui/system/StatusChip.tsx',['StatusChip']],
  ['src/ui/v2/QuietReadState.tsx',['QuietReadState']],
 ])host(file,names);
 h.stubs['src/ui/v2/ApplicationPeopleInput.tsx']={ApplicationPeopleInput:h.host('ApplicationPeopleInput'),applicationPeopleCount:v=>Number(v)};
 h.stubs['src/ui/v2/DogovorenoMoment.tsx']={MomentRise:h.host('MomentRise'),useMomentPart:()=>({interpolate:()=>0})};
 h.stubs['src/ui/v2/TaskFace.tsx']={placesText:()=>({text:'Jedno mesto',spoken:'Jedno mesto'}),taskValue:()=>({}),valueSpoken:()=> 'Tražim ponude'};
 h.stubs['src/ui/system/motion.ts']={useReducedMotion:()=>true};h.stubs['src/ui/system/haptics.ts']={tick(){}};
 h.stubs['src/ui/interFont.ts']={withInter:x=>x};
 Object.assign(h.stubs['src/ui/system/tokens.ts'],{fieldBox:{},sheetLift:{detached:{}}});
 Object.assign(h.stubs['src/ui/system/tokens.ts'].sys.motion,{arrive:{duration:1},exit:1,dialog:{from:1,enter:1}});
 Object.assign(h.native,{Modal:'Modal',Pressable:'Pressable',KeyboardAvoidingView:'KeyboardAvoidingView',Animated:{View:'AnimatedView'},
  Keyboard:{isVisible:()=>visible,dismiss:()=>{dismisses++},addListener:(name,fn)=>{listeners.set(name,fn);return{remove:()=>listeners.delete(name)}}}});
 h.native.ScrollView=React.forwardRef((p,ref)=>{React.useImperativeHandle(ref,()=>({scrollTo:value=>scrolls.push(value)}),[]);return React.createElement('NativeScrollView',p,p.children)});
 h.stubs['react-native-gesture-handler']={GestureHandlerRootView:'GestureHandlerRootView'};
 h.stubs['react-native-safe-area-context']={SafeAreaInsetsContext:React.createContext(null)};
 h.stubs['src/hooks/useSystemReducedMotion.ts']={useSystemReducedMotion:()=>true};
 h.stubs['react-native-reanimated']={...h.stubs['react-native-reanimated'],__esModule:true,cancelAnimation(){},useSharedValue:value=>({value})};
 const need={id:'need',revizija:1,naslov:'Čas engleskog',vremeTekst:'Fleksibilno',taskTimezone:'Europe/Belgrade',rezimCene:'OFFERS',osnovaCene:null,ponudjenaCena:null,pokrivenost:{preostalo:1,potrebno:1,pokriveno:0}};
 let props={need,opportunity:{...need,primaNovePrijave:true,podrucjeTekst:'Na daljinu'},draft:{price:'1000',people:'1',note:'Probna prijava radi provere Dogovora.',start:null,end:null},
  change:value=>{props={...props,draft:value}},submit:()=>calls.push('submit'),back:()=>calls.push('back'),busy:false,pending:false,uncertain:false,refresh(){},error:null,confirmed:false,openApplications(){},canSubmit:true};
 const C=h.load('src/ui/v2/ApplicationComposerPresentation.tsx').ApplicationComposerPresentation,r=await mount(C,props);
 const redraw=patch=>RTR.act(async()=>{props={...props,...patch};r.update(React.createElement(C,props))});
 const action=async label=>{const n=nodes(r,n=>n.type==='V2Action'&&n.props.label===label)[0];assert.ok(n,label);assert.ok(!n.props.disabled);await RTR.act(async()=>n.props.onPress())};
 return {r,scrolls,calls,action,redraw,get props(){return props},get dismisses(){return dismisses},
  keyboard:async(shown,emit=true)=>{visible=shown;if(emit)await RTR.act(async()=>listeners.get(shown?'keyboardDidShow':'keyboardDidHide')?.())},stop:()=>unmount(r)};
}
test('review waits for the active IME to hide, then opens at top with exact offer and retained note',async()=>{
 const h=await composer();try{
  await h.keyboard(true,false);await h.action('Pregledaj prijavu');assert.equal(h.dismisses,1);
  assert.equal(nodes(h.r,n=>n.type==='Modal').length,0,'No modal mounted into the keyboard-closing viewport');assert.deepEqual(h.calls,[]);
  await h.keyboard(false);assert.equal(nodes(h.r,n=>n.type==='Modal').length,1);assert.deepEqual(h.scrolls,[{y:0,animated:false}]);
  assert.equal(nodes(h.r,n=>n.type==='MoneySummary')[0].props.amount,'1.000 RSD');
  assert.ok(nodes(h.r,n=>n.type==='T').some(n=>n.children.includes('Probna prijava radi provere Dogovora.')));
  await h.action('Izmenite prijavu');assert.equal(nodes(h.r,n=>n.type==='Modal').length,0);assert.equal(h.props.draft.price,'1000');assert.equal(h.props.draft.note,'Probna prijava radi provere Dogovora.');
  await h.action('Pregledaj prijavu');assert.equal(nodes(h.r,n=>n.type==='Modal').length,1);assert.equal(h.scrolls.length,2);assert.deepEqual(h.calls,[]);
  await h.action('Pošaljite ovu prijavu');assert.deepEqual(h.calls,['submit']);
 }finally{await h.stop()}
});
test('review opened without IME resets again at native Modal show, not only its early mount effect',async()=>{
 const h=await composer();try{
  await h.action('Pregledaj prijavu');const modal=nodes(h.r,n=>n.type==='Modal')[0];assert.ok(modal);
  assert.deepEqual(h.scrolls,[{y:0,animated:false}]);
  // Android may change native offset while taking modal focus after the React effect.
  await RTR.act(async()=>modal.props.onShow());assert.deepEqual(h.scrolls,[{y:0,animated:false},{y:0,animated:false}]);
  await h.redraw({error:'Unrelated retained message'});assert.equal(h.scrolls.length,2,'Ordinary rerenders do not fight user scrolling');
  assert.deepEqual(h.calls,[]);
 }finally{await h.stop()}
});
test('a stale shown listener state cannot stall opening when the native keyboard is already hidden',async()=>{
 const h=await composer();try{
  await h.keyboard(true);await h.keyboard(false,false);await h.action('Pregledaj prijavu');
  assert.equal(nodes(h.r,n=>n.type==='Modal').length,1);assert.deepEqual(h.calls,[]);
 }finally{await h.stop()}
});
test('back or unmount retires a pending keyboard review without sending or clearing draft',async()=>{
 for(const exit of ['back','unmount']){
  const h=await composer();await h.keyboard(true);await h.action('Pregledaj prijavu');
  if(exit==='back'){
   await RTR.act(async()=>nodes(h.r,n=>n.type==='ProductHeader')[0].props.back());await h.keyboard(false);
   assert.equal(nodes(h.r,n=>n.type==='Modal').length,0);assert.deepEqual(h.calls,['back']);assert.equal(h.props.draft.price,'1000');await h.stop();
  }else{await h.stop();await h.keyboard(false);assert.deepEqual(h.calls,[]);}
 }
});
test('a changed draft or lost admission cannot open the pending keyboard-delayed review',async()=>{
 for(const mutation of [h=>({draft:{...h.props.draft,price:'2000'}}),()=>({canSubmit:false}),()=>({busy:true})]){
  const h=await composer();try{await h.keyboard(true);await h.action('Pregledaj prijavu');assert.equal(nodes(h.r,n=>n.type==='Modal').length,0);
   await h.redraw(mutation(h));await h.keyboard(false);assert.equal(nodes(h.r,n=>n.type==='Modal').length,0);assert.deepEqual(h.calls,[]);
  }finally{await h.stop()}
 }
});
