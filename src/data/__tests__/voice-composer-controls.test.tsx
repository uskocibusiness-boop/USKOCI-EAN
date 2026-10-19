import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { HoldToTalkController, VoiceSnapshot } from '../../features/voice/holdToTalk';
import type { AgreementVoiceController } from '../../hooks/useAgreementVoice';
const mockAlert=jest.fn();let mockReader=false,mockReduced=false;
let mockAppState = 'active';
const mockAppStateListeners = new Set<(state: string) => void>();
jest.mock('react-native',()=>{const actual=jest.requireActual('react-native');return new Proxy(actual,{get(target,key){
  if(key==='AccessibilityInfo')return{isScreenReaderEnabled:async()=>mockReader,addEventListener:()=>({remove:jest.fn()})};
  if(key==='AppState')return{get currentState(){return mockAppState;},addEventListener:(_event:string,listener:(state:string)=>void)=>{mockAppStateListeners.add(listener);return{remove:()=>mockAppStateListeners.delete(listener)};}};
  if(key==='Alert')return{alert:(...args:unknown[])=>mockAlert(...args)};
  return ['View','Pressable'].includes(String(key))?key:Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
jest.mock('../../ui/entry/BrandAssets',()=>({BrandMark:'BrandMark'}));
jest.mock('../../ui/system/motion',()=>({useReducedMotion:()=>mockReduced}));
jest.mock('../../ui/system/usePressLift',()=>({usePressLift:()=>({style:{},give:jest.fn(),settle:jest.fn()})}));
jest.mock('../../ui/system/Glyph',()=>({Glyph:'Glyph'}));
jest.mock('../../features/voice/useHoldToTalk',()=>({VOICE_PROCESSING_NOTICE:'Approved transient Google speech notice.'}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=> 'GESTURE_SYNTHETIC'}));
const mockTick=jest.fn();
// Rule R5: the held microphone is felt where listening really begins and where the finger lets go, never at touch-down.
jest.mock('../../ui/system/haptics',()=>({tick:(...a:unknown[])=>mockTick(...a),forgetTicks:jest.fn()}));
import { VoiceComposer, VoiceNotice } from '../../ui/aiFirst/VoiceComposer';
import { AgreementVoiceMic } from '../../ui/media/AgreementVoiceControls';
let tree:ReactTestRenderer;
const idle:VoiceSnapshot={phase:'IDLE',session:null,finalText:'',interimText:'',audioLevel:null,fallbackText:'',error:null};

it.each(['', 'Treba mi pomoć'])('a missing final offers editing only when there are actual retained words: %s', async retained => {
  const c = controller(), keep = jest.fn();
  await act(async () => { tree = create(<VoiceNotice controller={c as unknown as HoldToTalkController}
    state={{ ...idle, error: 'FINAL_TRANSCRIPT_MISSING', fallbackText: retained }} disabled={false} onKeepText={keep} />); });
  const words = tree.root.findAllByType('T' as React.ElementType).map(node => node.props.children).join(' ');
  expect(tree.root.findAllByProps({ label: 'Uredi sačuvani tekst' })).toHaveLength(retained ? 1 : 0);
  if (retained) expect(words).toContain('Prepoznati deo možeš da pregledaš');
  else { expect(words).toContain('Govor nije prepoznat'); expect(words).not.toMatch(/sačuvan|Prepoznati deo/i); }
  expect(c.useFallback).not.toHaveBeenCalled(); expect(keep).not.toHaveBeenCalled();
});
const controller=()=>({begin:jest.fn(()=>true),release:jest.fn(),cancel:jest.fn(),useFallback:jest.fn()});
const text=()=>JSON.stringify(tree.toJSON());
afterEach(async()=>{await act(async()=>tree?.unmount());jest.restoreAllMocks();});beforeEach(()=>{mockReader=false;mockReduced=false;mockAppState='active';mockAppStateListeners.clear();jest.clearAllMocks();});
it('hold release finalizes once while edit/send remain the parent controller responsibility',async()=>{
  const c=controller(),keep=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={keep}/>);});
  const mic=tree.root.findByProps({accessibilityLabel:'Drži da govoriš'});
  await act(async()=>mic.props.onResponderGrant({nativeEvent:{pageY:200}}));
  await act(async()=>{mic.props.onResponderRelease();mic.props.onResponderRelease();});
  expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC','hold');expect(c.release).toHaveBeenCalledTimes(1);
  expect(keep).not.toHaveBeenCalled();
});
it.each([
  { tap: false, preview: true, mode: 'accessible' },
  { tap: true, preview: false, mode: 'hold' },
  { tap: true, preview: true, mode: 'accessible' },
])('keeps gesture and transcript delivery independent: $tap / $preview', async ({ tap, preview, mode }) => {
  const c = controller(), keep = jest.fn();
  const props = { controller: c as unknown as HoldToTalkController, disabled: false, onKeepText: keep, tapToTalk: tap, reviewFirst: preview };
  await act(async () => { tree = create(<VoiceComposer {...props} state={idle} />); });
  const start = tree.root.findByProps({ testID: 'voice-mic' });
  await act(async () => tap ? start.props.onPress() : start.props.onResponderGrant({ nativeEvent: { pageY: 200 } }));
  expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', mode);
  const session = { mode } as VoiceSnapshot['session'];
  // A preference change cannot reinterpret an already running gesture or its delivery.
  await act(async () => tree.update(<VoiceComposer {...props} tapToTalk={!tap} reviewFirst={!preview} state={{ ...idle, phase: 'LISTENING', session }} />));
  const finish = tree.root.findByProps({ testID: 'voice-mic' });
  expect(finish.props.accessibilityLabel).toBe(tap ? preview ? 'Zaustavi i pregledaj tekst' : 'Zaustavi i pošalji'
    : 'Slušamo — pusti za pregled');
  await act(async () => { if (tap) finish.props.onPress(); else finish.props.onResponderRelease(); });
  expect(c.release).toHaveBeenCalledTimes(1); expect(keep).not.toHaveBeenCalled();
});
it('a screen reader always reviews even when the optional preview is off', async () => {
  mockReader = true; const c = controller();
  await act(async () => { tree = create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle}
    disabled={false} reviewFirst={false} onKeepText={jest.fn()} />); });
  await act(async () => tree.root.findByProps({ testID: 'voice-mic' }).props.onPress());
  expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
});
it('two taps before the capture-state render release the owned gesture instead of losing it to a second begin', async () => {
  const c = controller();
  await act(async () => { tree = create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle}
    disabled={false} tapToTalk onKeepText={jest.fn()} />); });
  const mic = tree.root.findByProps({ testID: 'voice-mic' });
  await act(async () => { mic.props.onPress(); mic.props.onPress(); });
  expect(c.begin).toHaveBeenCalledTimes(1); expect(c.release).toHaveBeenCalledWith('GESTURE_SYNTHETIC');
});
it('cancelling from the notice releases the gesture preference lock for the next capture', async () => {
  const c = controller(), props = { controller: c as unknown as HoldToTalkController, disabled: false, onKeepText: jest.fn() };
  await act(async () => { tree = create(<VoiceComposer {...props} state={idle} tapToTalk />); });
  await act(async () => tree.root.findByProps({ testID: 'voice-mic' }).props.onPress());
  await act(async () => tree.update(<VoiceComposer {...props} state={{ ...idle, phase: 'LISTENING' }} tapToTalk />));
  await act(async () => tree.update(<VoiceComposer {...props} state={idle} tapToTalk />));
  await act(async () => tree.update(<VoiceComposer {...props} state={idle} />));
  expect(tree.root.findByProps({ testID: 'voice-mic' }).props.onResponderGrant).toEqual(expect.any(Function));
  await act(async () => tree.root.findByProps({ testID: 'voice-mic' }).props.onResponderGrant({ nativeEvent: { pageY: 200 } }));
  expect(c.begin).toHaveBeenCalledTimes(2);
});
it('is felt where listening really begins and where the finger lets go; a hold called off is "cancel", never "gestureEnd"',async()=>{
  const c=controller();
  const props={controller:c as unknown as HoldToTalkController,disabled:false,onKeepText:jest.fn()};
  await act(async()=>{tree=create(<VoiceComposer {...props} state={idle}/>);});
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderGrant({nativeEvent:{pageY:200}}));
  expect(mockTick).not.toHaveBeenCalled();
  await act(async()=>tree.update(<VoiceComposer {...props} state={{...idle,phase:'LISTENING'}}/>));
  expect(mockTick.mock.calls).toEqual([['gestureStart']]);
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderRelease());
  expect(mockTick.mock.calls).toEqual([['gestureStart'],['gestureEnd']]);
  await act(async()=>tree.unmount());mockTick.mockClear();
  await act(async()=>{tree=create(<VoiceComposer {...props} state={idle}/>);});
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderGrant({nativeEvent:{pageY:200}}));
  await act(async()=>tree.update(<VoiceComposer {...props} state={{...idle,phase:'LISTENING'}}/>));
  await act(async()=>{const mic=tree.root.findByProps({testID:'voice-mic'});mic.props.onResponderMove({nativeEvent:{pageY:120}});mic.props.onResponderRelease();});
  expect(mockTick.mock.calls).toEqual([['gestureStart'],['cancel']]);
});
it('moving outside the press rectangle does not send; only physical responder release finalizes',async()=>{
  const c=controller();
  const props={controller:c as unknown as HoldToTalkController,disabled:false,onKeepText:jest.fn()};
  await act(async()=>{tree=create(<VoiceComposer {...props} state={idle}/>);});
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderGrant({nativeEvent:{pageY:200}}));
  await act(async()=>tree.update(<VoiceComposer {...props} state={{...idle,phase:'LISTENING'}}/>));
  const mic=tree.root.findByProps({testID:'voice-mic'});
  expect(mic.props.onPressOut).toBeUndefined();
  // A sideways move leaves a 52dp press rectangle but is neither finger-up nor upward cancellation.
  await act(async()=>mic.props.onResponderMove({nativeEvent:{pageX:500,pageY:200}}));
  expect(c.release).not.toHaveBeenCalled();expect(c.cancel).not.toHaveBeenCalled();
  await act(async()=>{mic.props.onResponderRelease();mic.props.onResponderRelease();});
  expect(c.release).toHaveBeenCalledTimes(1);
});
it.each(['termination','upward gesture'])('%s cancels held speech without dispatching a transcript on later release',async reason=>{
  const c=controller();
  const props={controller:c as unknown as HoldToTalkController,disabled:false,onKeepText:jest.fn()};
  await act(async()=>{tree=create(<VoiceComposer {...props} state={idle}/>);});
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderGrant({nativeEvent:{pageY:200}}));
  await act(async()=>tree.update(<VoiceComposer {...props} state={{...idle,phase:'LISTENING'}}/>));
  const mic=tree.root.findByProps({testID:'voice-mic'});
  await act(async()=>{
    if(reason==='termination')mic.props.onResponderTerminate();
    else mic.props.onResponderMove({nativeEvent:{pageY:120}});
    mic.props.onResponderRelease();
  });
  expect(c.cancel).toHaveBeenCalledTimes(1);expect(c.cancel).toHaveBeenCalledWith('gesture');
  expect(c.release).not.toHaveBeenCalled();
});
it('a tap that ends before the microphone listens asks the composer to explain holding; a real hold does not',async()=>{
  const c=controller(),short=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={jest.fn()} onTooShort={short}/>);});
  const tap=tree.root.findByProps({accessibilityLabel:'Drži da govoriš'});
  await act(async()=>{tap.props.onResponderGrant({nativeEvent:{pageY:200}});tap.props.onResponderRelease();});
  expect(short).toHaveBeenCalledTimes(1);
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderGrant({nativeEvent:{pageY:200}}));
  await act(async()=>tree.update(<VoiceComposer controller={c as unknown as HoldToTalkController} state={{...idle,phase:'LISTENING'}} disabled={false} onKeepText={jest.fn()} onTooShort={short}/>));
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onResponderRelease());
  expect(short).toHaveBeenCalledTimes(1);expect(c.release).toHaveBeenCalledTimes(2);
});
// Verify r4b ra item B: a click from Switch Access or Voice Access reaches the held microphone only as `activate`; it
// asks for the advice (and its way to voice mode) instead of doing nothing, starts no capture, and a disabled
// microphone asks for nothing. With a screen reader the microphone is a plain start/stop button and needs no action.
it('a click without a hold is the activate action: it asks for the advice and starts nothing',async()=>{
  const c=controller(),short=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={jest.fn()} onTooShort={short}/>);});
  const mic=tree.root.findByProps({testID:'voice-mic'});
  expect(mic.props.accessibilityActions).toEqual([{name:'activate'}]);
  await act(async()=>mic.props.onAccessibilityAction({nativeEvent:{actionName:'activate'}}));
  expect(short).toHaveBeenCalledTimes(1);expect(c.begin).not.toHaveBeenCalled();expect(c.release).not.toHaveBeenCalled();
  await act(async()=>tree.update(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled onKeepText={jest.fn()} onTooShort={short}/>));
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onAccessibilityAction({nativeEvent:{actionName:'activate'}}));
  expect(short).toHaveBeenCalledTimes(1);
  await act(async()=>tree.unmount());mockReader=true;
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={jest.fn()} onTooShort={short}/>);});
  expect(tree.root.findByProps({testID:'voice-mic'}).props.accessibilityActions).toBeUndefined();
});
it('screen reader sees explicit Stop, not an instruction to release a held finger',async()=>{
  mockReader=true;const c=controller();const listening={...idle,phase:'LISTENING' as const};
  await act(async()=>{tree=create(<><VoiceComposer controller={c as unknown as HoldToTalkController} state={listening} disabled={false} onKeepText={jest.fn()}/>
    <VoiceNotice controller={c as unknown as HoldToTalkController} state={listening} disabled={false} onKeepText={jest.fn()}/></>);});
  expect(tree.root.findByProps({accessibilityLabel:'Zaustavi i pregledaj tekst'})).toBeDefined();
  expect(text()).toContain('Zaustavi, pregledaj tekst i izaberi Pošalji.');
  // 2026-09-24: the composer has no mode switch of its own any more; tapping instead of holding is voice mode.
  expect(tree.root.findAllByProps({label:'Govor bez držanja'})).toHaveLength(0);
});
describe('Agreement held voice-message control',()=>{
  const setupVoice=(screenReader=false,review=false)=>({
    recording:{phase:'idle',canRecord:true},screenReader,review,
    begin:jest.fn(),release:jest.fn(),endHold:jest.fn(),cancel:jest.fn(),
  });
  const draw=(voice:ReturnType<typeof setupVoice>)=><AgreementVoiceMic voice={voice as unknown as AgreementVoiceController}/>;
  const mic=()=>tree.root.findByProps({accessibilityRole:'button'});
  it.each([false,true])('keeps recording outside the press rectangle and delegates actual release once (review=%s)',async review=>{
    const voice=setupVoice(false,review);
    await act(async()=>{tree=create(draw(voice));});
    await act(async()=>mic().props.onResponderGrant({nativeEvent:{pageY:200}}));
    voice.recording.phase='recording';
    await act(async()=>tree.update(draw(voice)));
    expect(mic().props.onPressOut).toBeUndefined();expect(mic().props.onPress).toBeUndefined();
    await act(async()=>mic().props.onResponderMove({nativeEvent:{pageX:500,pageY:200}}));
    expect(voice.endHold).not.toHaveBeenCalled();expect(voice.release).not.toHaveBeenCalled();
    await act(async()=>{mic().props.onResponderRelease();mic().props.onResponderRelease();});
    expect(voice.begin).toHaveBeenCalledTimes(1);expect(voice.release).toHaveBeenCalledTimes(1);
    expect(voice.cancel).not.toHaveBeenCalled();
  });
  it.each(['termination','upward gesture'])('%s discards instead of ending/sending the recording',async reason=>{
    const voice=setupVoice();
    await act(async()=>{tree=create(draw(voice));});
    await act(async()=>mic().props.onResponderGrant({nativeEvent:{pageY:200}}));
    await act(async()=>{
      if(reason==='termination')mic().props.onResponderTerminate();
      else mic().props.onResponderMove({nativeEvent:{pageY:120}});
      mic().props.onResponderRelease();
    });
    expect(voice.cancel).toHaveBeenCalledTimes(1);
    expect(voice.release).not.toHaveBeenCalled();expect(voice.endHold).not.toHaveBeenCalled();
  });
  it('retains the screen-reader start/stop path and disabled held admission',async()=>{
    const voice=setupVoice(true,true);
    await act(async()=>{tree=create(draw(voice));});
    expect(mic().props.onResponderGrant).toBeUndefined();
    await act(async()=>mic().props.onPress());expect(voice.begin).toHaveBeenCalledTimes(1);
    voice.recording.phase='recording';await act(async()=>tree.update(draw(voice)));
    await act(async()=>mic().props.onPress());expect(voice.release).toHaveBeenCalledTimes(1);
    voice.screenReader=false;voice.recording={phase:'idle',canRecord:false};
    await act(async()=>tree.update(draw(voice)));
    expect(mic().props.onStartShouldSetResponder()).toBe(false);
    await act(async()=>mic().props.onResponderGrant({nativeEvent:{pageY:200}}));
    expect(voice.begin).toHaveBeenCalledTimes(1);
  });
});
it('keeps first-speech preparation cancellable and accessible', async () => {
  mockReader = true; const c = controller();
  // One tree shape throughout, so the microphone keeps the gesture it started.
  await act(async () => { tree = create(<><VoiceComposer controller={c as unknown as HoldToTalkController}
    state={idle} disabled={false} onKeepText={jest.fn()} />
    <VoiceNotice controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={jest.fn()} /></>); });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pokreni govorni unos' }).props.onPress());
  const preparing = { ...idle, phase: 'PREPARING' as const };
  await act(async () => { tree.update(<><VoiceComposer controller={c as unknown as HoldToTalkController}
    state={preparing} disabled={true} onKeepText={jest.fn()} />
    <VoiceNotice controller={c as unknown as HoldToTalkController} state={preparing} disabled={true} onKeepText={jest.fn()} /></>); });
  const pending = tree.root.findByProps({ accessibilityLabel: 'Pripremamo govorni unos…' });
  expect(pending.props.disabled).toBe(false);
  await act(async () => pending.props.onPress());
  expect(c.release).toHaveBeenCalledWith('GESTURE_SYNTHETIC');
  await act(async () => tree.root.findByProps({ label: 'Otkaži govor' }).props.onPress());
  expect(c.cancel).toHaveBeenCalledWith('gesture');
});
it('the notice hands kept text back only through the screen, and shows the way to the phone settings after a denial',async()=>{
  const c=controller(),keep=jest.fn();
  await act(async()=>{tree=create(<VoiceNotice controller={c as unknown as HoldToTalkController} state={{...idle,fallbackText:'Treba mi prevoz',error:'CAPTURE_FAILED'}}
    disabled={false} onKeepText={keep}/>);});
  await act(async()=>tree.root.findByProps({label:'Uredi sačuvani tekst'}).props.onPress());
  expect(c.useFallback).toHaveBeenCalledWith(keep);
  await act(async()=>tree.update(<VoiceNotice controller={c as unknown as HoldToTalkController} state={{...idle,error:'MIC_PERMISSION_DENIED'}} disabled={false} onKeepText={keep}/>));
  expect(tree.root.findAllByProps({label:'Podešavanja telefona'})).toHaveLength(1);
});

describe('active voice notice recovery', () => {
  it('cancel from the active notice sends nothing; finalizing has no cancellation action', async () => {
    const c = controller(), props = { controller: c as unknown as HoldToTalkController, disabled: false, onKeepText: jest.fn() };
    await act(async () => { tree = create(<VoiceNotice {...props} state={{ ...idle, phase: 'LISTENING' }} />); });
    await act(async () => tree.root.findByProps({ label: 'Otkaži govor' }).props.onPress());
    expect(c.cancel).toHaveBeenCalledWith('gesture'); expect(c.release).not.toHaveBeenCalled();
    await act(async () => tree.update(<VoiceNotice {...props} state={{ ...idle, phase: 'FINALIZING' }} />));
    expect(tree.root.findAllByProps({ label: 'Otkaži govor' })).toHaveLength(0);
  });
  it.each([false, true])('explains tap delivery precisely (preview %s)', async preview => {
    const c = controller(), session = { mode: preview ? 'accessible' : 'hold' } as VoiceSnapshot['session'];
    await act(async () => { tree = create(<VoiceNotice controller={c as unknown as HoldToTalkController} disabled={false}
      onKeepText={jest.fn()} tapToTalk state={{ ...idle, phase: 'LISTENING', session }} />); });
    expect(text()).toContain(preview ? 'Zaustavi, pregledaj tekst' : 'Dodirni mikrofon da pošalješ');
    expect(text()).not.toContain('Pusti da pošalješ');
  });
});
