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
// Owner, 26.11.2026: an application is one step - the form is what is sent; no review sheet opens in between.
test('one step: Pošaljite prijavu closes the keyboard and sends the form as it stands, once, with no review sheet',async()=>{
 const h=await composer();try{
  await h.keyboard(true,false);await h.action('Pošaljite prijavu');
  assert.equal(h.dismisses,1,'the keyboard closes before sending');
  assert.deepEqual(h.calls,['submit']);
  assert.equal(nodes(h.r,n=>n.type==='Modal').length,0,'no review sheet');
  assert.equal(h.props.draft.price,'1000');assert.equal(h.props.draft.note,'Probna prijava radi provere Dogovora.');
 }finally{await h.stop()}
});
test('one step: nothing is sent while the form cannot be sent',async()=>{
 const h=await composer();try{
  await h.redraw({canSubmit:false});
  const send=nodes(h.r,n=>n.type==='V2Action'&&n.props.label==='Pošaljite prijavu')[0];assert.ok(send);assert.equal(send.props.disabled,true);
  await RTR.act(async()=>send.props.onPress());assert.deepEqual(h.calls,[]);
 }finally{await h.stop()}
});
