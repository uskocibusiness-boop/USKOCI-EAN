import React from 'react';
import { Animated } from 'react-native';
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
import { VoiceComposer, VoiceMode, VoiceNotice } from '../../ui/aiFirst/VoiceComposer';
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

describe('voice mode', () => {
  const session = { accountId: 'a', accountRevision: 1, conversationId: 'c', generation: 1, gestureId: 'GESTURE_SYNTHETIC', startedAt: 0 };
  const mode = (c: ReturnType<typeof controller>, state: VoiceSnapshot, extra: Partial<React.ComponentProps<typeof VoiceMode>> = {}) =>
    <VoiceMode voice={{ controller: c as unknown as HoldToTalkController, state, disabled: false, onKeepText: jest.fn() }}
      prompt="Reci šta ti treba." answer={null} said={null} thinking={false} onClose={jest.fn()} {...extra} />;
  const mic = () => tree.root.findByProps({ testID: 'voice-mode-mic' });
  it('a tap starts listening, a second tap sends what was said through the screen, and nothing is kept locally', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    expect(text()).toContain('kao tekst');
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'hold');
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' }, audioLevel: 0.4 }, { onClose })));
    expect(mic().props.accessibilityLabel).toBe('Pošalji izgovoreno');
    await act(async () => mic().props.onPress());
    expect(c.release).toHaveBeenCalledWith('GESTURE_SYNTHETIC');
    // Sent: voice mode stays open for the answer, which arrives as text.
    await act(async () => tree.update(mode(c, { ...idle, phase: 'FINALIZING', session: { ...session, mode: 'hold' } }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: { ...session, mode: 'hold' } }, { onClose, thinking: true, said: 'Treba mi prevoz.' })));
    expect(onClose).not.toHaveBeenCalled(); expect(c.cancel).not.toHaveBeenCalled();
    expect(text()).toContain('Stiže odgovor…');
  });
  it('closing while listening throws the capture away and sends nothing', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' } }, { onClose })));
    await act(async () => tree.root.findByProps({ testID: 'voice-mode-close' }).props.onPress());
    expect(c.cancel).toHaveBeenCalledWith('gesture'); expect(c.release).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith('closed');
  });
  it('closing after the second tap does not take the message back: it is already on its way through the screen', async () => {
    const c = controller(), onClose = jest.fn(), hold = { ...session, mode: 'hold' as const };
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: hold }, { onClose })));
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'FINALIZING', session: hold }, { onClose })));
    await act(async () => tree.root.findByProps({ testID: 'voice-mode-close' }).props.onPress());
    expect(onClose).toHaveBeenCalledWith('closed');
    await act(async () => tree.unmount());
    expect(c.cancel).not.toHaveBeenCalled(); expect(c.release).toHaveBeenCalledTimes(1);
  });
  it('the answer stays visible beside new words; the previous transcript returns when the microphone rests', async () => {
    const c = controller(), hold = { ...session, mode: 'hold' as const };
    const exchange = { said: 'Treba mi prevoz.', answer: 'Odakle i dokle?' };
    await act(async () => { tree = create(mode(c, idle, exchange)); });
    expect(text()).toContain('Odakle i dokle?');
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: hold, finalText: 'Iz Novog Sada' }, exchange)));
    expect(text()).toContain('Iz Novog Sada'); expect(text()).toContain('Odakle i dokle?'); expect(text()).not.toContain('Treba mi prevoz.');
    await act(async () => tree.update(mode(c, idle, exchange)));
    expect(text()).toContain('Odakle i dokle?');
  });
  it('review before sending is a switch that starts nothing; with it the capture goes to the field and voice mode steps aside', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    const review = tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' });
    await act(async () => review.props.onPress());
    expect(c.begin).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' }).props.accessibilityState.checked).toBe(true);
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
    const reviewed = { ...session, mode: 'accessible' as const };
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: reviewed }, { onClose })));
    expect(mic().props.accessibilityLabel).toBe('Zaustavi i pregledaj tekst');
    await act(async () => tree.update(mode(c, { ...idle, phase: 'FINALIZING', session: reviewed }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: reviewed }, { onClose })));
    expect(onClose).toHaveBeenCalledWith('review');
  });
  // Verify r4c (zaštite item 7): FINALIZING and IDLE can arrive in one render. A reviewed capture that goes from LISTENING
  // straight to IDLE with its session kept still closes voice mode for review; a cancel (session cleared) does not.
  it('closes for review when a reviewed capture goes from LISTENING straight to IDLE with its session kept', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' }).props.onPress());
    await act(async () => mic().props.onPress());
    const reviewed = { ...session, mode: 'accessible' as const };
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: reviewed }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: reviewed }, { onClose })));
    expect(onClose).toHaveBeenCalledTimes(1); expect(onClose).toHaveBeenCalledWith('review');
  });
  it('stays open when a reviewed capture is cancelled from LISTENING (session cleared)', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' }).props.onPress());
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'accessible' as const } }, { onClose })));
    await act(async () => tree.update(mode(c, idle, { onClose })));
    expect(onClose).not.toHaveBeenCalled();
  });
  it('a failed capture keeps voice mode open with the error and the way to the kept text', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' } }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: { ...session, mode: 'hold' }, error: 'CAPTURE_FAILED', fallbackText: 'Treba mi' }, { onClose })));
    expect(onClose).not.toHaveBeenCalled();
    expect(text()).toContain('Govorni unos je prekinut.');
    expect(tree.root.findAllByProps({ label: 'Uredi sačuvani tekst' })).toHaveLength(1);
  });
  it('while the screen cannot take a message the microphone is disabled and the line says why', async () => {
    const c = controller();
    await act(async () => { tree = create(<VoiceMode voice={{ controller: c as unknown as HoldToTalkController, state: idle, disabled: true, onKeepText: jest.fn() }}
      prompt="Reci šta ti treba." answer={null} said="Treba mi prevoz." thinking onClose={jest.fn()} />); });
    expect(mic().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
    await act(async () => mic().props.onPress());
    expect(c.begin).not.toHaveBeenCalled();
    // Review r4 ra item 10 (was: the line under the exchange said "Stiže odgovor…" too, in a second live region). The
    // exchange says it once; the line is not drawn while the answer is being written.
    expect(tree.root.findAllByProps({ testID: 'voice-mode-line' })).toHaveLength(0);
    expect(text().match(/Stiže odgovor…/g)).toHaveLength(1);
    await act(async () => tree.update(<VoiceMode voice={{ controller: c as unknown as HoldToTalkController, state: idle, disabled: true, onKeepText: jest.fn() }}
      prompt="Reci šta ti treba." answer={null} said="Treba mi prevoz." thinking={false} onClose={jest.fn()} />));
    expect(tree.root.findByProps({ testID: 'voice-mode-line' }).props.children).toBe('Prethodna poruka još nije poslata. Zatvori i proveri razgovor.');
  });
  // Review r4 ra item 5: only a finalised reviewed capture put text in the field; a tap while the microphone was still on
  // its way, or a cancel when the app went to the background, ends with nothing there, and voice mode stays open.
  it.each(['PERMISSION_PENDING', 'PREPARING', 'STARTING', 'LISTENING'] as const)('a reviewed capture stopped from %s leaves voice mode open', async phase => {
    const c = controller(), onClose = jest.fn(), reviewed = { ...session, mode: 'accessible' as const };
    await act(async () => { tree = create(mode(c, idle, { onClose, reviewFirst: true })); });
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
    await act(async () => tree.update(mode(c, { ...idle, phase, session: reviewed }, { onClose, reviewFirst: true })));
    await act(async () => tree.update(mode(c, idle, { onClose, reviewFirst: true })));
    expect(onClose).not.toHaveBeenCalled();
  });
  it('opens with the review already on when asked, and says it is a checkbox', async () => {
    const c = controller();
    await act(async () => { tree = create(mode(c, idle, { reviewFirst: true })); });
    const review = tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' });
    // Review r4 ra item 12: drawn as a checkbox, so a screen reader hears one (it was announced as a switch).
    expect(review.props.accessibilityRole).toBe('checkbox');
    expect(review.props.accessibilityState.checked).toBe(true);
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
  });
  it('the glow follows only a measured foreground recording and resets under reduced motion or inactive states', async () => {
    // Advance the native timing target deterministically. No assertion depends on Animated.View's displayName.
    const timing = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: jest.fn(() => { (value as Animated.Value).setValue(config.toValue as number); }),
      stop: jest.fn(), reset: jest.fn(),
    }));
    const c = controller();
    const listening = { ...idle, phase: 'LISTENING' as const, session: { ...session, mode: 'hold' as const } };
    await act(async () => { tree = create(mode(c, { ...listening, audioLevel: 0.9 })); });
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.9, useNativeDriver: true, isInteraction: false }));
    const pulse = timing.mock.calls[timing.mock.calls.length - 1][0] as Animated.Value;
    const value = () => (pulse as Animated.Value & { __getValue(): number }).__getValue();
    expect(value()).toBeCloseTo(0.9);
    const glow = tree.root.findByProps({ testID: 'voice-glow' });
    expect(tree.root.findAll(node => node.props.animationType !== undefined)[0].props.animationType).toBe('fade');
    for (const [audioLevel, expected] of [[0.25, 0.25], [2, 1], [-1, 0]] as const) {
      await act(async () => tree.update(mode(c, { ...listening, audioLevel })));
      expect(value()).toBe(expected);
    }
    for (const audioLevel of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      timing.mockClear();
      await act(async () => tree.update(mode(c, { ...listening, audioLevel })));
      expect(value()).toBe(0); expect(timing).not.toHaveBeenCalled();
    }
    await act(async () => tree.update(mode(c, { ...listening, audioLevel: 0.9 })));
    await act(async () => {
      mockAppState = 'background'; mockAppStateListeners.forEach(listener => listener(mockAppState));
    });
    expect(value()).toBe(0);
    await act(async () => {
      mockAppState = 'active'; mockAppStateListeners.forEach(listener => listener(mockAppState));
    });
    expect(value()).toBeCloseTo(0.9);
    timing.mockClear(); mockReduced = true;
    await act(async () => tree.update(mode(c, { ...listening, audioLevel: 0.9 })));
    expect(value()).toBe(0); expect(timing).not.toHaveBeenCalled();
    expect(tree.root.findAll(node => node.props.animationType !== undefined)[0].props.animationType).toBe('none');
    expect(tree.root.findByProps({ testID: 'voice-glow' })).toBe(glow);
    mockReduced = false;
    await act(async () => tree.update(mode(c, { ...listening, audioLevel: 0.9 })));
    for (const state of [idle, { ...idle, error: 'CAPTURE_FAILED' as const }]) {
      timing.mockClear();
      await act(async () => tree.update(mode(c, state)));
      expect(value()).toBe(0); expect(timing).not.toHaveBeenCalled();
    }
    expect(c.begin).not.toHaveBeenCalled(); expect(c.release).not.toHaveBeenCalled();
  });
  it('a screen reader always reviews: there is no switch to turn it off', async () => {
    mockReader = true; const c = controller();
    await act(async () => { tree = create(mode(c, idle)); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' })).toHaveLength(0);
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
  });
});
