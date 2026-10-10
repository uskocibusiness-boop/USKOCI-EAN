import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',K='44444444-4444-4444-8444-444444444444';
let mockAccount=A,mockRevision=1,mockFocused=true,mockParams:{conversationId?:string}={conversationId:C};
let mockRealAvailability=false,mockRealManual=false,mockFontScale=1;
// ONE NAME (owner, 8 Oct 2026): the profile is saved under the ACCOUNT's name; the hook is mocked (the real one reads the server). No name by default.
let mockAccountName:{state:string;name?:string|null}={state:'ready',name:null};
const mockListeners=new Set<(s:string)=>void>();
const mockBackHandlers=new Set<()=>boolean>();
const mockApi={read:jest.fn(),open:jest.fn(),send:jest.fn(),recoverTurn:jest.fn(),cancelTurn:jest.fn(),patch:jest.fn(),prepare:jest.fn(),save:jest.fn(),abandon:jest.fn()};
const mockJournal={load:jest.fn(),save:jest.fn(),clear:jest.fn()};let mockStored:unknown=null;
const mockRouter={back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(),setParams:jest.fn()};
const mockVoice={controller:{cancel:jest.fn()},state:{phase:'IDLE'}};const mockVoiceHook=jest.fn((_options:unknown)=>mockVoice);
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(['View','ScrollView','KeyboardAvoidingView','Switch','RefreshControl','TextInput'].includes(String(key)))return key;
 if(key==='Platform')return{OS:'android'};
 if(key==='useWindowDimensions')return()=>({width:320,height:640,scale:2,fontScale:mockFontScale});
 if(key==='AppState')return{currentState:'active',addEventListener:(_:string,fn:(s:string)=>void)=>{mockListeners.add(fn);return{remove:()=>mockListeners.delete(fn)};}};
 if(key==='BackHandler')return{addEventListener:(_:string,fn:()=>boolean)=>{mockBackHandlers.add(fn);return{remove:()=>mockBackHandlers.delete(fn)};}};
 return Reflect.get(target,key);}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('@expo/ui/community/datetime-picker',()=>({DateTimePicker:'DateTimePicker'}));
jest.mock('../../ui/system/motion',()=>({useReducedMotion:()=>true}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},useLocalSearchParams:()=>mockParams,useFocusEffect:(fn:()=>void)=>require('react').useEffect(()=>mockFocused?fn():undefined,[fn,mockFocused])}));
jest.mock('../../store/sesija',()=>({useSesija:()=>({user:{id:mockAccount},accountRevision:mockRevision}),sesijaSada:()=>({user:{id:mockAccount},accountRevision:mockRevision})}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:jest.fn()}));
jest.mock('../../ui/profile/useAccountName',()=>({useAccountName:()=>mockAccountName}));
jest.mock('../workerAiClientService',()=>({get workerAiClientService(){return mockApi;}}));
jest.mock('../workerAiTurnIntentJournal',()=>({get workerAiTurnIntentJournal(){return mockJournal;}}));
jest.mock('../../features/voice/useHoldToTalk',()=>({useHoldToTalk:(options:unknown)=>mockVoiceHook(options)}));
jest.mock('../../ui/aiFirst/VoiceComposer',()=>({VoiceComposer:'VoiceComposer'}));
jest.mock('../../ui/aiFirst/AiConversationShell',()=>({AiConversationShell:({actions,status,children,newConversation,...props}:any)=>{
 const React=require('react');return React.createElement('Shell',props,
  newConversation?React.createElement('NewConversation',{label:'Novi razgovor',...newConversation}):null,status,actions,children);
}}));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation',()=>({WorkerProfileFrame:(props:any)=>mockRealAvailability
 ?require('react').createElement(jest.requireActual('../../ui/workerProfile/WorkerProfilePresentation').WorkerProfileFrame,props)
 :require('react').createElement('Frame',props,props.children,props.footer),WorkerProfileStatus:'Status'}));
jest.mock('../../ui/workerProfile/WorkerAiPresentation',()=>({WorkerAiActivation:'Activation',WorkerAiCard:'Card',WorkerAiReviewDetails:'Review',
 WorkerAiNotificationsNote:(props:any)=>require('react').createElement(jest.requireActual('../../ui/workerProfile/WorkerAiPresentation').WorkerAiNotificationsNote,props),
 WorkerAiManual:(props:any)=>require('react').createElement(mockRealManual?jest.requireActual('../../ui/workerProfile/WorkerAiPresentation').WorkerAiManual:'Manual',props)}));
jest.mock('../../ui/calendar/AvailabilityForm',()=>({AvailabilityForm:(props:any)=>require('react').createElement(mockRealAvailability
 ?jest.requireActual('../../ui/calendar/AvailabilityForm').AvailabilityForm:'Availability',props)}));
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
import Screen from '../../app/(app)/profil/razgovor';
import type { WorkerAiProfile } from '../workerAiClientService';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { ActionSheet } from '../../ui/system/ActionSheet';
import { CalendarScreen } from '../../ui/calendar/CalendarControls';
const intent=()=>({accountId:A,conversationId:C,clientRequestId:K});
const turn=(state='PROCESSING',id=K)=>({turnId:B,conversationId:C,clientRequestId:id,attemptId:A,state,retryAllowed:false,authoritative:true});
const recovery=(state:string|null=null,extras={})=>({schemaVersion:'WORKER_PROFILE_V1',accountId:A,conversationId:C,profileId:B,conversationStatus:'OPEN',clientRequestId:K,turn:state?turn(state):null,providerDispatched:false,cancelled:false,canCancel:true,retryAllowed:state===null,authoritative:true,...extras});
const availability=()=>({timezone:'Europe/Belgrade',availableNow:false,rules:[],windows:[]});
const candidate=():WorkerAiProfile=>({displayName:'',bio:'',skills:['Montaža'],tools:[],vehicles:[],licenses:[],teamCapacity:1,
 location:{city:'',operatingCountryCode:'RS',radiusKm:10,approximatePosition:null},availability:availability()});
const snapshot=(t:unknown=null)=>({schemaVersion:'WORKER_PROFILE_V1',accountId:A,conversationId:C,profileId:B,status:'OPEN',profileStatus:'DRAFT',revision:0,candidate:candidate(),safety:'ALLOW',stale:false,messages:[],turn:t,review:null,saved:null});
const ok=(podatak:unknown)=>({ok:true,podatak});let tree:ReactTestRenderer;
const shell=()=>tree.root.findByType('Shell' as any),action=(label:string)=>tree.root.findByProps({label});
const visibleText=()=>tree.root.findAllByType('T' as any).flatMap(node=>node.children.filter(child=>typeof child==='string')).join(' ');
const flush=async()=>{await act(async()=>{});};
const deferred=()=>{let resolve!:(value:unknown)=>void;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
// Editing by hand and the week moved behind "···" (an ActionSheet, 2026-09-24); a test opens the menu, reads the row and
// closes the menu without a choice, as Back does.
const manualDisabled=async()=>{await act(async()=>{shell().props.onOptions();});
 const [row]=tree.root.findAll(node=>node.props.accessibilityRole==='menuitem'&&node.props.accessibilityLabel==='Ručno uredi podatke');
 const disabled=row.props.accessibilityState.disabled;await act(async()=>{tree.root.findByType(ActionSheet).props.onClose();});return disabled;};
const render=async()=>{await act(async()=>{tree=create(<Screen/>);});};
const click=async(label:string)=>{await act(async()=>{action(label).props.onPress();});};
// "Novi razgovor" is asked in an in-app ConfirmSheet (it was Alert.alert); a test presses its buttons.
const sheets=()=>tree.root.findAllByType(ConfirmSheet);
const answer=async(testID:'confirm-sheet-confirm'|'confirm-sheet-cancel')=>{await act(async()=>{tree.root.findByType(ConfirmSheet).findByProps({testID}).props.onPress();});};
beforeEach(()=>{jest.clearAllMocks();mockAccount=A;mockRevision=1;mockFocused=true;mockParams={conversationId:C};mockStored=null;
 mockRealAvailability=false;mockRealManual=false;mockFontScale=1;mockAccountName={state:'ready',name:null};mockBackHandlers.clear();
 mockRouter.canGoBack.mockReturnValue(true);
 mockJournal.load.mockImplementation(async()=>mockStored);mockJournal.save.mockImplementation(async(i:unknown)=>{mockStored=i;});mockJournal.clear.mockImplementation(async()=>{mockStored=null;});
 mockApi.read.mockResolvedValue(ok(snapshot()));mockApi.open.mockResolvedValue(ok(snapshot()));mockApi.recoverTurn.mockImplementation(async(_cid,key)=>ok({...recovery(),clientRequestId:key}));
 mockApi.send.mockResolvedValue({ok:false,kod:'UNKNOWN',poruka:'Ishod nije potvrđen'});mockApi.cancelTurn.mockImplementation(async()=>{mockApi.recoverTurn.mockResolvedValue(ok(recovery('FAILED',{cancelled:true,canCancel:false,retryAllowed:false})));return ok(recovery('FAILED',{cancelled:true,canCancel:false,retryAllowed:false}));});
});
afterEach(async()=>{await act(async()=>tree?.unmount());});
const succeedWorkerTurn=()=>{
 mockApi.send.mockImplementation(async(_cid,_text,key)=>ok(turn('SUCCEEDED',key)));
 mockApi.recoverTurn.mockImplementation(async(_cid,key)=>ok({...recovery('SUCCEEDED'),clientRequestId:key,turn:turn('SUCCEEDED',key)}));
};
// A saved AI profile is not the same as a worker with a point for radius
// matching. This opt-in handoff is only shown after a canonical saved result.
const completedWithArea=(point:WorkerAiProfile['location']['approximatePosition'])=>({
 ...snapshot(),status:'COMPLETED',profileStatus:'ACTIVE',
 candidate:{...candidate(),location:{...candidate().location,city:'Novi Sad',approximatePosition:point}},
 saved:{reviewId:K,conversationId:C,accountId:A,profileId:B,profileStatus:'ACTIVE',saved:true,authoritative:true},
});
it('after AI save, a worker without a map center is told the truth and can open the existing area editor',async()=>{
 mockApi.read.mockResolvedValue(ok(completedWithArea(null)));
 await render();
 expect(visibleText()).toContain('zadaci se porede po gradu, ne po radijusu');
 expect(visibleText()).toContain('bez GPS dozvole');
 expect(action('Podesi radijus na mapi')).toBeTruthy();
 expect(action('Otvori sačuvani profil')).toBeTruthy();
 await click('Podesi radijus na mapi');
 expect(mockRouter.replace).toHaveBeenCalledWith('/profil/lokacija');
 expect(mockApi.save).not.toHaveBeenCalled();
 expect(mockApi.patch).not.toHaveBeenCalled();
});
it('a confirmed map center keeps a single saved-profile primary action',async()=>{
 mockApi.read.mockResolvedValue(ok(completedWithArea({latitude:45.25,longitude:19.84})));
 await render();
 expect(tree.root.findAllByProps({label:'Podesi radijus na mapi'})).toHaveLength(0);
 expect(visibleText()).not.toContain('zadaci se porede po gradu');
 await click('Otvori sačuvani profil');
 expect(mockRouter.replace).toHaveBeenCalledWith('/profil/radnik');
 expect(mockApi.save).not.toHaveBeenCalled();
});
it('an unsaved AI draft is not treated as a finished work area',async()=>{
 await render();
 expect(tree.root.findAllByProps({label:'Podesi radijus na mapi'})).toHaveLength(0);
 expect(visibleText()).not.toContain('zadaci se porede po gradu');
});

it('a new empty interview starts with the invitation instead of an empty profile card',async()=>{
 mockApi.read.mockResolvedValue(ok({...snapshot(),candidate:{...candidate(),skills:[]}}));
 await render();
 expect(shell().props.card(false)).toBeNull();
 expect(shell().props.welcome).toBe('Koje zadatke želiš da preuzimaš?');
 expect(shell().props.canEdit).toBe(true);
 expect(await manualDisabled()).toBe(false);
 expect(mockApi.send).not.toHaveBeenCalled();expect(mockApi.prepare).not.toHaveBeenCalled();
});
it('duplicate active events preserve the worker chat, typed draft and in-flight answer without another read',async()=>{
 const sending=deferred();mockApi.send.mockReturnValueOnce(sending.promise);
 await render();act(()=>shell().props.onChange('Moj nacrt'));await act(async()=>shell().props.onSend());
 const transport=mockApi.send.mock.calls[0][3],reads=mockApi.read.mock.calls.length,thread=shell();
 await act(async()=>transport.onText('Odgovor u toku'));
 await act(async()=>{for(const listener of [...mockListeners]){listener('active');listener('active');}});
 expect(shell()).toBe(thread);expect(shell().props.value).toBe('Moj nacrt');
 expect(shell().props.streamingText).toBe('Odgovor u toku');expect(transport.signal.aborted).toBe(false);
 expect(mockApi.read).toHaveBeenCalledTimes(reads);expect(mockApi.send).toHaveBeenCalledTimes(1);
 await act(async()=>{for(const listener of [...mockListeners])listener('background');});
 expect(transport.signal.aborted).toBe(true);expect(tree.root.findAllByType('Shell' as any)).toHaveLength(0);
 await act(async()=>sending.resolve({ok:false,kod:'UNKNOWN',poruka:'Nepotvrđeno'}));
 await act(async()=>{for(const listener of [...mockListeners])listener('active');});
 expect(mockApi.read.mock.calls.length).toBeGreaterThan(reads);
 expect(mockApi.send).toHaveBeenCalledTimes(1);expect(shell()).toBeTruthy();
});
it.each(['immediate','readback','retry'])('worker draft ownership: identical spoken text preserves the typed draft after %s success',async outcome=>{
 if(outcome==='immediate')succeedWorkerTurn();
 await render();act(()=>shell().props.onChange('  Radim vikendom.  '));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'Radim vikendom.',isCurrent:()=>true,session:{mode:'hold'}})).toBe(true));
 const sent=mockApi.send.mock.calls[0].slice(0,3);
 if(outcome!=='immediate'){
  succeedWorkerTurn();await click(outcome==='retry'?'Pošalji ponovo':'Proveri razgovor');
 }
 expect(shell().props.value).toBe('  Radim vikendom.  ');expect(shell().props.canEdit).toBe(true);
 expect(mockJournal.save.mock.calls[0][0]).toEqual({accountId:A,conversationId:C,clientRequestId:sent[2]});
 expect(mockStored).toBeNull();expect(mockApi.send).toHaveBeenCalledTimes(outcome==='retry'?2:1);
 if(outcome==='retry')expect(mockApi.send.mock.calls[1].slice(0,3)).toEqual(sent);
});
it('worker draft ownership: typed success clears its unchanged raw whitespace draft',async()=>{
 succeedWorkerTurn();await render();act(()=>shell().props.onChange('  Radim vikendom.  '));
 await act(async()=>shell().props.onSend());expect(mockApi.send.mock.calls[0][1]).toBe('Radim vikendom.');
 expect(shell().props.value).toBe('');expect(shell().props.canEdit).toBe(true);expect(mockStored).toBeNull();
});
it.each(['immediate','retry'])('worker draft ownership: typed %s success preserves a later native edit even when its text returns to the original',async outcome=>{
 const sending=deferred();mockApi.send.mockReturnValueOnce(sending.promise);
 await render();act(()=>shell().props.onChange('  Radim vikendom.  '));const lateEdit=shell().props.onChange;
 await act(async()=>shell().props.onSend());const sent=mockApi.send.mock.calls[0].slice(0,3);
 // Native edits queued before the composer was disabled still belong to the user, even after an edit-away-and-back.
 await act(async()=>{lateEdit('Noviji nacrt');lateEdit('  Radim vikendom.  ');});
 expect(shell().props.value).toBe('  Radim vikendom.  ');
 if(outcome==='immediate')succeedWorkerTurn();
 await act(async()=>sending.resolve(outcome==='immediate'?ok(turn('SUCCEEDED',sent[2])):{ok:false,kod:'UNKNOWN',poruka:'Nepotvrđeno'}));
 if(outcome==='retry'){succeedWorkerTurn();await click('Pošalji ponovo');expect(mockApi.send.mock.calls[1].slice(0,3)).toEqual(sent);}
 expect(shell().props.value).toBe('  Radim vikendom.  ');expect(shell().props.canEdit).toBe(true);
 expect(mockApi.send).toHaveBeenCalledTimes(outcome==='retry'?2:1);expect(mockStored).toBeNull();
});
it('worker draft ownership: a remounted ID-only intent restores no text and cannot own a fresh draft',async()=>{
 await render();act(()=>shell().props.onChange('Privatni nacrt'));await act(async()=>shell().props.onSend());
 const requestId=mockApi.send.mock.calls[0][2];expect(mockStored).toEqual({accountId:A,conversationId:C,clientRequestId:requestId});
 await act(async()=>tree.unmount());succeedWorkerTurn();await render();expect(shell().props.value).toBe('');
 act(()=>shell().props.onChange('Sveži nacrt'));
 await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});
 expect(shell().props.value).toBe('Sveži nacrt');expect(mockApi.send).toHaveBeenCalledTimes(1);expect(mockStored).toBeNull();
});
it.each(['success','unknown'])('Back leaves a running worker turn immediately and recovers its IDs after late %s without resending',async outcome=>{
 const sending=deferred();mockApi.send.mockReturnValueOnce(sending.promise);mockRouter.canGoBack.mockReturnValue(outcome==='success');
 await render();act(()=>shell().props.onChange('Poruka koja se obrađuje'));await act(async()=>shell().props.onSend());
 const requestId=mockApi.send.mock.calls[0][2],transport=mockApi.send.mock.calls[0][3],retained=shell().props;
 await act(async()=>transport.onText('Početak odgovora'));expect(shell().props.streamingText).toBe('Početak odgovora');
 const reads=mockApi.read.mock.calls.length;
 await act(async()=>{retained.onBack();retained.onBack();});
 if(outcome==='success')expect(mockRouter.back).toHaveBeenCalledTimes(1);
 else expect(mockRouter.replace).toHaveBeenCalledWith('/profil/radnik');
 expect(mockRouter.back.mock.calls.length+mockRouter.replace.mock.calls.length).toBe(1);
 expect(transport.signal.aborted).toBe(true);expect(mockVoice.controller.cancel).toHaveBeenCalledWith('navigation');
 expect(mockStored).toEqual({accountId:A,conversationId:C,clientRequestId:requestId});
 expect(tree.root.findAllByType('Shell' as any)).toHaveLength(0);
 await act(async()=>{transport.onText('Kasni privatni odgovor');retained.onChange('Kasna izmena');retained.onSend();retained.onOptions();
  sending.resolve(outcome==='success'?ok(turn('SUCCEEDED',requestId)):{ok:false,kod:'UNKNOWN',poruka:'Nepotvrđeno'});});
 expect(mockApi.read).toHaveBeenCalledTimes(reads);expect(mockApi.recoverTurn).not.toHaveBeenCalled();expect(mockJournal.clear).not.toHaveBeenCalled();
 expect(mockApi.cancelTurn).not.toHaveBeenCalled();expect(mockApi.abandon).not.toHaveBeenCalled();expect(mockApi.send).toHaveBeenCalledTimes(1);
 expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
 mockApi.recoverTurn.mockResolvedValue(ok({...recovery('PROCESSING',{providerDispatched:true,canCancel:false,retryAllowed:false}),clientRequestId:requestId}));
 mockApi.read.mockResolvedValue(ok(snapshot(turn('PROCESSING',requestId))));
 await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});
 expect(mockApi.recoverTurn).toHaveBeenCalledWith(C,requestId);expect(shell().props.pending).toBe(true);expect(shell().props.canSend).toBe(false);
 mockApi.recoverTurn.mockResolvedValue(ok({...recovery('SUCCEEDED',{providerDispatched:true,canCancel:false,retryAllowed:false}),clientRequestId:requestId}));
 mockApi.read.mockResolvedValue(ok(snapshot(turn('SUCCEEDED',requestId))));await click('Proveri razgovor');
 expect(mockJournal.clear).toHaveBeenCalledWith({accountId:A,conversationId:C,clientRequestId:requestId});expect(shell().props.canEdit).toBe(true);
 expect(mockApi.send).toHaveBeenCalledTimes(1);
});
it.each(['blur-refocus','account-ABA','route'])('a retained worker Back cannot navigate after %s',async change=>{
 await render();const oldBack=shell().props.onBack;
 if(change==='blur-refocus'){
  await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});
 }else if(change==='account-ABA')await act(async()=>{mockRevision+=2;tree.update(<Screen/>);});
 else await act(async()=>{mockParams={conversationId:B};tree.update(<Screen/>);});
 await act(async()=>oldBack());expect(mockRouter.back).not.toHaveBeenCalled();expect(mockRouter.replace).not.toHaveBeenCalled();
 await act(async()=>shell().props.onBack());expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it('Back during intent persistence leaves the saved IDs recoverable but never dispatches the departed message',async()=>{
 const storing=deferred();mockJournal.save.mockImplementationOnce(async value=>{await storing.promise;mockStored=value;});
 await render();act(()=>shell().props.onChange('Još nije poslato'));await act(async()=>shell().props.onSend());
 await act(async()=>shell().props.onBack());expect(mockRouter.back).toHaveBeenCalledTimes(1);
 await act(async()=>storing.resolve(undefined));expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.clear).not.toHaveBeenCalled();
 const saved=mockStored as ReturnType<typeof intent>;expect(saved).toMatchObject({accountId:A,conversationId:C});
 await act(async()=>tree.unmount());await render();expect(mockApi.recoverTurn).toHaveBeenCalledWith(C,saved.clientRequestId);
 expect(mockApi.send).not.toHaveBeenCalled();expect(shell().props.canEdit).toBe(false);
});
it('a late departed turn and retained Back cannot update a reincarnated account',async()=>{
 const sending=deferred();mockApi.send.mockReturnValueOnce(sending.promise);
 await render();act(()=>shell().props.onChange('Prvobitna poruka'));await act(async()=>shell().props.onSend());
 const oldBack=shell().props.onBack,transport=mockApi.send.mock.calls[0][3];await act(async()=>oldBack());
 expect(mockRouter.back).toHaveBeenCalledTimes(1);
 mockJournal.load.mockImplementation(async account=>account===A?mockStored:null);
 await act(async()=>{mockAccount=B;mockRevision++;tree.update(<Screen/>);});
 act(()=>shell().props.onChange('Nacrt drugog naloga'));const reads=mockApi.read.mock.calls.length;
 await act(async()=>{oldBack();transport.onText('Stari odgovor');sending.resolve(ok(turn('SUCCEEDED')));});
 expect(mockRouter.back).toHaveBeenCalledTimes(1);expect(mockApi.read).toHaveBeenCalledTimes(reads);expect(mockJournal.clear).not.toHaveBeenCalled();
 expect(shell().props.value).toBe('Nacrt drugog naloga');expect(shell().props.streamingText).toBe('');expect(mockApi.send).toHaveBeenCalledTimes(1);
 await act(async()=>{mockAccount=A;mockRevision++;tree.update(<Screen/>);});await act(async()=>oldBack());
 expect(mockRouter.back).toHaveBeenCalledTimes(1);expect(mockJournal.clear).not.toHaveBeenCalled();
});
const reviewed=()=>({...snapshot(),review:{reviewId:K,revision:0,expiresAt:new Date(Date.now()+60000).toISOString(),canAccept:true,activate:true,missingRequired:[]}});
const enterPanel=async(panel:string)=>{
 if(panel==='review'){
  mockApi.prepare.mockResolvedValue(ok({}));mockApi.read.mockResolvedValue(ok(reviewed()));
  await act(async()=>shell().props.card(false).props.review());
 }else{
  await act(async()=>shell().props.onOptions());
  const label=panel==='manual'?'Ručno uredi podatke':'Uredi nedelju i posebne datume';
  await act(async()=>tree.root.findAll(node=>node.props.accessibilityRole==='menuitem'&&node.props.accessibilityLabel===label)[0].props.onPress());
 }
};
const panelSubmit=(panel:string)=>panel==='manual'?()=>tree.root.findByType('Manual' as any).props.apply({headline:'Novi naslov'})
 :panel==='availability'?()=>tree.root.findByType('Availability' as any).props.onSave({...availability(),availableNow:true})
 :()=>action('Sačuvaj i aktiviraj profil').props.onPress();
const panelBack=(panel:string)=>panel==='availability'?tree.root.findByType(CalendarScreen).props.back:tree.root.findByType('Frame' as any).props.back;
const manualField=(label:string)=>tree.root.findByProps({accessibilityLabel:label});
const editManual=(label:string,value:string)=>act(()=>manualField(label).props.onChangeText(value));
const hardwareBack=async()=>{let handled=false;await act(async()=>{handled=[...mockBackHandlers].reverse().some(fn=>fn());});return handled;};
const manualBack=async(entry:string)=>{if(entry==='hardware')expect(await hardwareBack()).toBe(true);else await act(async()=>panelBack('manual')());};

it.each(['toolbar','hardware'])('%s manual Back asks before discarding, Continue retains fields, and confirm never patches',async entry=>{
 mockRealManual=true;await render();await enterPanel('manual');
 editManual('O meni','Moj novi opis');editManual('Alat i oprema','Bušilica\nMerdevine');
 await manualBack(entry);expect(sheets()).toHaveLength(1);expect(mockRouter.back).not.toHaveBeenCalled();
 expect(mockApi.patch).not.toHaveBeenCalled();await answer('confirm-sheet-cancel');
 expect(manualField('O meni').props.value).toBe('Moj novi opis');
 expect(manualField('Alat i oprema').props.value).toBe('Bušilica\nMerdevine');
 await manualBack(entry);await answer('confirm-sheet-confirm');expect(shell()).toBeTruthy();
 expect(mockApi.patch).not.toHaveBeenCalled();expect(mockApi.save).not.toHaveBeenCalled();
 await enterPanel('manual');expect(manualField('O meni').props.value).toBe('');
});
it.each(['toolbar','hardware'])('%s clean manual Back returns directly, including an edit reverted to its original value',async entry=>{
 mockRealManual=true;await render();await enterPanel('manual');
 editManual('O meni','Ana');editManual('O meni','');
 await manualBack(entry);expect(sheets()).toHaveLength(0);expect(shell()).toBeTruthy();
 expect(mockRouter.back).not.toHaveBeenCalled();expect(mockApi.patch).not.toHaveBeenCalled();
});
it('manual fields survive privacy unmount and resume only within the same owner and candidate revision',async()=>{
 mockRealManual=true;await render();await enterPanel('manual');editManual('O meni','Privatni lokalni opis');
 const oldEdit=manualField('O meni').props.onChangeText,oldApply=action('Primeni na pregled profila').props.onPress;
 await manualBack('toolbar');const oldConfirm=tree.root.findByType(ConfirmSheet).props.onConfirm!;
 await act(async()=>{for(const listener of [...mockListeners])listener('background');});
 expect(tree.root.findAllByType('TextInput' as any)).toHaveLength(0);expect(visibleText()).not.toContain('Privatni lokalni opis');
 await act(async()=>oldConfirm());expect(sheets()).toHaveLength(0);
 await act(async()=>{for(const listener of [...mockListeners])listener('active');});
 act(()=>{oldEdit('Kasni unos sakrivenog obrasca');oldApply();});
 expect(manualField('O meni').props.value).toBe('Privatni lokalni opis');
 expect(mockApi.patch).not.toHaveBeenCalled();
 await manualBack('toolbar');expect(sheets()).toHaveLength(1);await answer('confirm-sheet-cancel');
 mockApi.read.mockResolvedValue(ok({...snapshot(),revision:1,candidate:{...candidate(),bio:'Noviji predlog'}}));
 await click('Proveri razgovor');
 expect(manualField('O meni').props.value).toBe('Privatni lokalni opis');
 expect(manualField('O meni').props.editable).toBe(false);
 expect(action('Primeni na pregled profila').props.disabled).toBe(true);
 expect(visibleText()).toContain('Predlog profila je promenjen');
 await click('Primeni na pregled profila');expect(mockApi.patch).not.toHaveBeenCalled();
 await click('Odbaci izmene i nastavi');await answer('confirm-sheet-confirm');await enterPanel('manual');
 expect(manualField('O meni').props.value).toBe('Noviji predlog');
 expect(manualField('O meni').props.editable).toBe(true);
});
it.each(['account','conversation'])('a retained manual discard and private draft cannot cross a changed %s',async kind=>{
 mockRealManual=true;await render();await enterPanel('manual');editManual('O meni','Stari privatni unos');
 await manualBack('toolbar');const oldConfirm=tree.root.findByType(ConfirmSheet).props.onConfirm!;
 await act(async()=>{if(kind==='account')mockRevision+=2;else mockParams={conversationId:B};tree.update(<Screen/>);});
 await act(async()=>oldConfirm());expect(shell()).toBeTruthy();await enterPanel('manual');
 expect(manualField('O meni').props.value).toBe('');
 expect(mockApi.patch).not.toHaveBeenCalled();expect(mockRouter.back).not.toHaveBeenCalled();
});
it('a failed manual refresh preserves the private draft and a visible Back choice before retry',async()=>{
 mockRealManual=true;await render();await enterPanel('manual');editManual('O meni','Zadržan unos');
 mockApi.read.mockResolvedValueOnce({ok:false,kod:'READ_FAILED',poruka:'Profil nije učitan.'});
 await click('Proveri razgovor');expect(tree.root.findAllByType('TextInput' as any)).toHaveLength(0);
 await manualBack('hardware');expect(sheets()).toHaveLength(1);await answer('confirm-sheet-cancel');
 await act(async()=>tree.root.findByType('Status' as any).props.retry());
 expect(manualField('O meni').props.value).toBe('Zadržan unos');
 expect(mockApi.patch).not.toHaveBeenCalled();
});
it('manual processing and unknown patch outcomes block toolbar/hardware discard until explicit readback',async()=>{
 mockRealManual=true;await render();await enterPanel('manual');editManual('O meni','Nepotvrđena ispravka');
 await manualBack('toolbar');const oldConfirm=tree.root.findByType(ConfirmSheet).props.onConfirm!;
 const saving=deferred();mockApi.patch.mockReturnValueOnce(saving.promise);
 await click('Primeni na pregled profila');await act(async()=>oldConfirm());
 await manualBack('toolbar');await manualBack('hardware');
 expect(sheets()).toHaveLength(0);expect(tree.root.findAllByType('Shell' as any)).toHaveLength(0);
 expect(mockApi.patch).toHaveBeenCalledTimes(1);
 await act(async()=>saving.resolve({ok:false,kod:'UNKNOWN',poruka:'Ishod nije potvrđen.'}));
 await manualBack('toolbar');await manualBack('hardware');expect(sheets()).toHaveLength(0);
 expect(visibleText()).toContain('Prvo proveri ishod izmene');
 expect(manualField('O meni').props.value).toBe('Nepotvrđena ispravka');
 await click('Proveri razgovor');await manualBack('toolbar');expect(sheets()).toHaveLength(1);
 await answer('confirm-sheet-cancel');expect(mockApi.patch).toHaveBeenCalledTimes(1);
 expect(manualField('O meni').props.value).toBe('Nepotvrđena ispravka');
});
it('a keystroke invalidates a retained manual discard decision',async()=>{
 mockRealManual=true;await render();await enterPanel('manual');editManual('O meni','Prvi unos');
 await manualBack('toolbar');const oldConfirm=tree.root.findByType(ConfirmSheet).props.onConfirm!;
 editManual('O meni','Noviji unos');await act(async()=>oldConfirm());
 expect(manualField('O meni').props.value).toBe('Noviji unos');expect(sheets()).toHaveLength(0);
 expect(mockApi.patch).not.toHaveBeenCalled();
});
it('the review says the profile drives new-task notifications for matching tasks (owner 2026-10-07)',async()=>{
 await render();await enterPanel('review');
 const note=tree.root.findAll(node=>node.props?.testID==='worker-review-notifications-note');
 expect(note.length).toBeGreaterThan(0);
 expect(note[0].props.children).toBe('Podaci iz tvog radnog profila koriste se za obaveštenja o novim i već otvorenim zadacima koji odgovaraju tvojim veštinama, području i vremenu.');
 expect(note[0].props.tone).toBeUndefined();
});
it('a retired-field review refusal keeps a guarded restart path after same-review readback',async()=>{
 await render();await enterPanel('review');
 mockApi.save.mockResolvedValue({ok:false,kod:'WORKER_AI_STALE',poruka:'Pokreni nov razgovor.'});
 await click('Sačuvaj i aktiviraj profil');
 expect(action('Novi razgovor').props.disabled).toBe(true);
 expect(action('Sačuvaj i aktiviraj profil').props.disabled).toBe(true);
 await click('Novi razgovor');expect(mockApi.abandon).not.toHaveBeenCalled();expect(sheets()).toHaveLength(0);
 await click('Proveri stanje');
 expect(action('Novi razgovor').props.disabled).toBe(false);
 expect(action('Sačuvaj i aktiviraj profil').props.disabled).toBe(true);
 await click('Sačuvaj i aktiviraj profil');expect(mockApi.save).toHaveBeenCalledTimes(1);
 await click('Novi razgovor');expect(sheets()).toHaveLength(1);
 await answer('confirm-sheet-cancel');expect(mockApi.abandon).not.toHaveBeenCalled();
 mockApi.abandon.mockImplementation(async()=>{mockApi.read.mockResolvedValue(ok({...reviewed(),status:'ABANDONED'}));return ok({...reviewed(),status:'ABANDONED'});});
 await click('Novi razgovor');await answer('confirm-sheet-confirm');
 expect(mockApi.abandon).toHaveBeenCalledWith(C);expect(mockRouter.replace).toHaveBeenCalledWith('/profil/razgovor');
 expect(mockApi.patch).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
it('P5: the worker calendar retires editing for the whole conversation read',async()=>{
 mockRealAvailability=true;await render();await enterPanel('availability');
 const retainedChange=tree.root.findByType('Switch' as any).props.onValueChange;
 const reading=deferred();mockApi.read.mockReturnValueOnce(reading.promise);
 await click('Proveri razgovor');
 expect(tree.root.findByType('Switch' as any).props.disabled).toBe(true);
 await act(async()=>retainedChange(true));
 expect(tree.root.findByType('Switch' as any).props.value).toBe(false);
 expect(tree.root.findAllByProps({label:'Primeni na pregled profila'})).toHaveLength(0);
 await act(async()=>reading.resolve(ok({...snapshot(),revision:1,candidate:{...candidate(),availability:{...availability(),availableNow:true}}})));
 expect(tree.root.findByType('Switch' as any).props.disabled).toBe(false);
 expect(tree.root.findByType('Switch' as any).props.value).toBe(true);
 expect(mockApi.patch).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
it.each([1,1.6])('worker availability has one Android vertical scroll path and reachable guarded save/recovery at font scale %s',async scale=>{
 mockRealAvailability=true;mockFontScale=scale;await render();await enterPanel('availability');
 expect(tree.root.findAllByType('ScrollView' as any)).toHaveLength(1);
 expect(tree.root.findByType(CalendarScreen).props.scroll).toBe(false);
 expect(tree.root.findByType('KeyboardAvoidingView' as any).props.behavior).toBe('height');
 await act(async()=>tree.root.findByType('Switch' as any).props.onValueChange(true));
 const apply=action('Primeni na pregled profila');
 for(let ancestor=apply.parent;ancestor;ancestor=ancestor.parent)expect(ancestor.type).not.toBe('ScrollView');
 const saving=deferred();mockApi.patch.mockReturnValueOnce(saving.promise);await act(async()=>apply.props.onPress());
 await act(async()=>panelBack('availability')());expect(mockRouter.back).not.toHaveBeenCalled();
 expect(visibleText()).toContain('Sačekaj potvrdu pre povratka u razgovor.');
 expect(tree.root.findAllByType('ScrollView' as any)).toHaveLength(1);
 expect(mockApi.patch).toHaveBeenCalledWith(C,0,{availability:{timezone:'Europe/Belgrade',availableNow:true,ruleChanges:[],windowsUpsert:[],windowIdsRemove:[]}});
 await act(async()=>saving.resolve({ok:false,kod:'UNKNOWN',poruka:'Ishod čuvanja nije potvrđen.'}));
 expect(visibleText()).toContain('Ishod čuvanja nije potvrđen.');
 const reconcile=action('Proveri razgovor');expect(reconcile.props.disabled).toBe(false);
 for(let ancestor=reconcile.parent;ancestor;ancestor=ancestor.parent)expect(ancestor.type).not.toBe('ScrollView');
 await click('Proveri razgovor');expect(mockApi.patch).toHaveBeenCalledTimes(1);
 expect(tree.root.findAllByType('ScrollView' as any)).toHaveLength(1);
});
it.each(['manual','availability','review'])('Back from %s retires retained form writes before chat or route departure',async panel=>{
 await render();const chatBack=shell().props.onBack;await enterPanel(panel);
 await act(async()=>chatBack());expect(mockRouter.back).not.toHaveBeenCalled();
 const props=panel==='manual'?tree.root.findByType('Manual' as any).props:panel==='availability'?tree.root.findByType('Availability' as any).props:action('Sačuvaj i aktiviraj profil').props;
 const retained=()=>panel==='manual'?props.apply({headline:'Skrivena izmena'}):panel==='availability'?props.onSave({...availability(),availableNow:true}):props.onPress();
 await act(async()=>panelBack(panel)());expect(shell()).toBeTruthy();
 await act(async()=>retained());await act(async()=>shell().props.onBack());await act(async()=>retained());
 expect(mockApi.patch).not.toHaveBeenCalled();expect(mockApi.save).not.toHaveBeenCalled();expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it.each(['manual','availability','review'])('busy %s form explains its Back guard and waits for its actual save',async panel=>{
 const saving=deferred();await render();await enterPanel(panel);
 if(panel==='review')mockApi.save.mockReturnValueOnce(saving.promise);else mockApi.patch.mockReturnValueOnce(saving.promise);
 const retainedBack=panelBack(panel);
 await act(async()=>{panelSubmit(panel)();retainedBack();});
 await act(async()=>panelBack(panel)());
 expect(tree.root.findAllByType('Shell' as any)).toHaveLength(0);expect(mockRouter.back).not.toHaveBeenCalled();
 expect(visibleText()).toContain('Sačekaj potvrdu pre povratka u razgovor.');
 await act(async()=>saving.resolve(ok(panel==='review'?reviewed():snapshot())));
 expect(panel==='review'?mockApi.save:mockApi.patch).toHaveBeenCalledTimes(1);
});
it('accessible speech appends an editable profile message without dispatch; explicit Send uses the edited body',async()=>{
 await render();act(()=>shell().props.onChange('Već ukucano.'));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'Radim vikendom.',isCurrent:()=>true,session:{mode:'accessible'}})).toBe(true));
 expect(shell().props.value).toBe('Već ukucano.\nRadim vikendom.');expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.save).not.toHaveBeenCalled();
 act(()=>shell().props.onChange('Radim subotom od 10.'));await act(async()=>shell().props.onSend());
 expect(mockApi.send).toHaveBeenCalledTimes(1);expect(mockApi.send.mock.calls[0][1]).toBe('Radim subotom od 10.');
});
it('speech cannot overfill or overwrite a profile draft',async()=>{
 await render();act(()=>shell().props.onChange('a'.repeat(3999)));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'Još.',isCurrent:()=>true,session:{mode:'accessible'}})).toBe(false));
 expect(shell().props.value).toBe('a'.repeat(3999));expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.save).not.toHaveBeenCalled();
});
it.each(['stale-capture','blur-refocus','account-ABA'] as const)('late profile speech from %s cannot fill a new composer',async reason=>{
 await render();act(()=>shell().props.onChange('Aktuelni tekst'));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 if(reason==='blur-refocus'){await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});}
 if(reason==='account-ABA'){await act(async()=>{mockRevision=3;tree.update(<Screen/>);});}
 const before=shell().props.value;
 for(const mode of ['accessible','hold'])await act(async()=>expect(receive({text:'stari privatni govor',isCurrent:()=>reason!=='stale-capture',session:{mode}})).toBe(false));
 expect(shell().props.value).toBe(before);expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.save).not.toHaveBeenCalled();
});
// Owner, 2026-09-23: what is said while the microphone is held is the message. It goes out through the same send as the
// button (journal first, then one provider call with its own key), and the typed draft stays where it is.
it('held speech is sent as its own profile message on release, through the journal and the send path',async()=>{
 await render();act(()=>shell().props.onChange('Već ukucano.'));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:' Radim vikendom. ',isCurrent:()=>true,session:{mode:'hold'}})).toBe(true));
 expect(mockJournal.save).toHaveBeenCalledTimes(1);expect(mockApi.send).toHaveBeenCalledTimes(1);
 expect(mockJournal.save.mock.invocationCallOrder[0]).toBeLessThan(mockApi.send.mock.invocationCallOrder[0]);
 expect(mockApi.send.mock.calls[0][1]).toBe('Radim vikendom.');expect(mockApi.send.mock.calls[0][2]).toBe(mockJournal.save.mock.calls[0][0].clientRequestId);
 expect(shell().props.value).toBe('Već ukucano.');
 // The attempt is unconfirmed: more held speech is refused rather than starting a second provider call.
 const again=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(again({text:'Još nešto.',isCurrent:()=>true,session:{mode:'hold'}})).toBe(false));
 expect(mockApi.send).toHaveBeenCalledTimes(1);
});
// Review r4 ra item 2: the sentence just sent is on screen (and in voice mode's exchange) until the read brings it back,
// so the previous answer is never shown as the reply to it.
it('shows the message it just sent until the read confirms it, and nothing for an intent restored without text',async()=>{
 await render();expect(shell().props.sentMessage).toBeNull();
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:' Radim vikendom. ',isCurrent:()=>true,session:{mode:'hold'}})).toBe(true));
 expect(shell().props.pending).toBe(true);expect(shell().props.sentMessage).toBe('Radim vikendom.');
 await act(async()=>tree.unmount());
 // A restored intent carries only ids: it is pending, and there are no words to show.
 mockStored=intent();mockApi.recoverTurn.mockResolvedValue(ok(recovery('PROCESSING')));
 await render();await flush();
 expect(shell().props.pending).toBe(true);expect(shell().props.sentMessage).toBeNull();
});
// Verify r4b ra item A: the worker side stores the person's message when its turn is claimed, so a turn that is still
// processing already has it in the read. It is shown once, in the thread, and never again as "šalje se".
it('a sent message the read already holds is shown once, not again as still being sent',async()=>{
 mockApi.recoverTurn.mockImplementation(async(_cid,key)=>ok({...recovery('PROCESSING'),clientRequestId:key}));
 await render();
 mockApi.read.mockResolvedValue(ok({...snapshot(turn('PROCESSING')),messages:[{id:'m1',role:'USER',body:'Radim vikendom.',sequence:1}]}));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:' Radim vikendom. ',isCurrent:()=>true,session:{mode:'hold'}})).toBe(true));
 expect(mockApi.recoverTurn).toHaveBeenCalled();
 expect(shell().props.pending).toBe(true);expect(shell().props.sentMessage).toBeNull();
 expect(shell().props.messages).toEqual([{id:'m1',fromAi:false,body:'Radim vikendom.'}]);
 // A read whose last message is something else keeps the sentence on screen as not yet read back.
 mockApi.read.mockResolvedValue(ok({...snapshot(turn('PROCESSING')),messages:[{id:'m0',role:'ASSISTANT',body:'Čime se baviš?',sequence:1}]}));
 await click('Proveri razgovor');
 expect(shell().props.pending).toBe(true);expect(shell().props.sentMessage).toBe('Radim vikendom.');
});
it('held speech that is empty or over the limit is refused without a send',async()=>{
 await render();const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'   ',isCurrent:()=>true,session:{mode:'hold'}})).toBe(false));
 await act(async()=>expect(receive({text:'a'.repeat(4001),isCurrent:()=>true,session:{mode:'hold'}})).toBe(false));
 expect(mockJournal.save).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
it('keeps editing by hand and the week behind "···", and offers no menu when the proposal cannot be changed',async()=>{
 await render();expect(tree.root.findAllByProps({label:'Ručno uredi podatke'})).toHaveLength(0);
 await act(async()=>{shell().props.onOptions();});
 const row=(label:string)=>tree.root.findAll(node=>node.props.accessibilityRole==='menuitem'&&node.props.accessibilityLabel===label)[0];
 expect(row('Ručno uredi podatke').props.accessibilityState.disabled).toBe(false);
 expect(row('Uredi nedelju i posebne datume')).toBeDefined();
 await act(async()=>{row('Ručno uredi podatke').props.onPress();});
 expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);expect(tree.root.findAllByType('Manual' as never)).toHaveLength(1);
 await act(async()=>tree.unmount());mockApi.read.mockResolvedValue(ok({...snapshot(),stale:true}));await render();
 expect(shell().props.onOptions).toBeUndefined();
});
it('restores opaque pending key before any open or provider request and exposes safe cancel',async()=>{
 mockStored=intent();mockParams={};await render();expect(mockApi.open).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
 expect(mockApi.recoverTurn).toHaveBeenCalledWith(C,K);expect(mockRouter.setParams).toHaveBeenCalledWith({conversationId:C});
 expect(shell().props.canSend).toBe(false);expect(await manualDisabled()).toBe(true);
 expect(action('Otkaži prethodno slanje').props.disabled).toBe(false);expect(tree.root.findAllByProps({label:'Pošalji ponovo'})).toHaveLength(0);
 await click('Otkaži prethodno slanje');expect(mockApi.cancelTurn).toHaveBeenCalledWith(C,K);expect(mockJournal.clear).toHaveBeenCalledWith(intent());expect(shell().props.canEdit).toBe(true);
});
it('lost preclaim response keeps typed body in memory and retries only the same persisted ID explicitly',async()=>{
 await render();act(()=>shell().props.onChange('Sačuvan samo u memoriji'));await act(async()=>{shell().props.onSend();});
 const key=mockApi.send.mock.calls[0][2];expect(mockJournal.save).toHaveBeenCalledWith({accountId:A,conversationId:C,clientRequestId:key});
 expect(JSON.stringify(mockJournal.save.mock.calls)).not.toContain('Sačuvan');expect(mockApi.send).toHaveBeenCalledTimes(1);
 expect(shell().props.value).toBe('Sačuvan samo u memoriji');expect(await manualDisabled()).toBe(true);
 await click('Pošalji ponovo');expect(mockApi.send).toHaveBeenCalledTimes(2);expect(mockApi.send.mock.calls[1].slice(0,3)).toEqual(mockApi.send.mock.calls[0].slice(0,3));
});
it('a server without dispatched-exit capability cannot enable retry, cancellation or manual save',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.clear).not.toHaveBeenCalled();expect(await manualDisabled()).toBe(true);
 expect(tree.root.findAllByProps({label:'Otkaži prethodno slanje'})).toHaveLength(0);expect(tree.root.findAllByProps({label:'Pošalji ponovo'})).toHaveLength(0);
 await click('Proveri razgovor');expect(mockApi.send).not.toHaveBeenCalled();expect(action('Novi razgovor')).toBeTruthy();
});
it('canonical completed history retires key after restart without a provider call',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok({...snapshot(turn('SUCCEEDED')),messages:[{id:B,role:'USER',body:'Canonical text',sequence:1}]}));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('SUCCEEDED',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();expect(mockJournal.clear).toHaveBeenCalledWith(intent());expect(mockApi.send).not.toHaveBeenCalled();expect(shell().props.messages[0].body).toBe('Canonical text');expect(shell().props.canEdit).toBe(true);
});
it.each(['background','account'])('scope loss during journal write prevents network dispatch: %s',async how=>{
 let release!:(v?:unknown)=>void;mockJournal.save.mockImplementationOnce(()=>new Promise(r=>{release=r;}));await render();act(()=>shell().props.onChange('Unsaved text'));
 act(()=>shell().props.onSend());await flush();expect(mockJournal.save).toHaveBeenCalledTimes(1);
 await act(async()=>{if(how==='background')mockListeners.forEach(fn=>fn('background'));else{mockRevision++;tree.update(<Screen/>);}release();});
 expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.clear).not.toHaveBeenCalled();
});
it('foreign account cannot restore or send the previous account key',async()=>{
 mockStored=intent();mockJournal.load.mockImplementation(async aid=>aid===A?mockStored:null);await render();
 await act(async()=>{mockAccount=B;mockRevision++;tree.update(<Screen/>);});expect(mockJournal.load).toHaveBeenLastCalledWith(B);expect(mockApi.send).not.toHaveBeenCalled();
 expect(mockJournal.clear).not.toHaveBeenCalled();
});
it('a still-unresolved server cancellation response retains journal and disabled draft',async()=>{
 mockStored=intent();await render();mockApi.cancelTurn.mockImplementationOnce(async()=>{const r=recovery('PROCESSING',{providerDispatched:true,canCancel:false,retryAllowed:false});mockApi.recoverTurn.mockResolvedValue(ok(r));return ok(r);});
 await click('Otkaži prethodno slanje');expect(mockJournal.clear).not.toHaveBeenCalled();expect(shell().props.canEdit).toBe(false);
});

it('confirmed cancellation preserves typed draft then permits safe editing',async()=>{
 await render();act(()=>shell().props.onChange('Retained draft'));await act(async()=>shell().props.onSend());
 await click('Otkaži prethodno slanje');expect(shell().props.value).toBe('Retained draft');expect(shell().props.canEdit).toBe(true);expect(mockApi.send).toHaveBeenCalledTimes(1);
});
it('explicit abandon clears dispatched journal only after exact canonical parent state',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 mockApi.abandon.mockImplementation(async()=>{mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{conversationStatus:'ABANDONED',providerDispatched:true,canCancel:false,retryAllowed:false})));
  mockApi.read.mockResolvedValue(ok({...snapshot(turn('UNKNOWN_OUTCOME')),status:'ABANDONED'}));return ok({...snapshot(),status:'ABANDONED'});});
 await render();await click('Novi razgovor');expect(mockJournal.clear).not.toHaveBeenCalled();
 expect(tree.root.findByType(ConfirmSheet).props).toMatchObject({title:'Pokrenuti nov razgovor?',cancelLabel:'Nastavi ovaj razgovor',confirmLabel:'Novi razgovor'});
 await answer('confirm-sheet-cancel');expect(sheets()).toHaveLength(0);expect(mockApi.abandon).not.toHaveBeenCalled();
 await click('Novi razgovor');await answer('confirm-sheet-confirm');expect(mockApi.abandon).toHaveBeenCalledTimes(1);expect(mockApi.abandon).toHaveBeenCalledWith(C);expect(mockJournal.clear).toHaveBeenCalledWith(intent());
 expect(mockRouter.replace).toHaveBeenCalledWith('/profil/razgovor');expect(mockApi.send).not.toHaveBeenCalled();
});
it.each(['COMPLETED','ABANDONED'])('starts a fresh route from a confirmed %s conversation without abandoning or sending again',async status=>{
 mockApi.read.mockResolvedValue(ok({...snapshot(),status}));
 await render();await click('Novi razgovor');await answer('confirm-sheet-confirm');
 expect(mockApi.read).toHaveBeenCalledTimes(2);expect(mockRouter.replace).toHaveBeenCalledWith('/profil/razgovor');
 expect(mockApi.abandon).not.toHaveBeenCalled();expect(mockApi.open).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
 expect(mockJournal.clear).not.toHaveBeenCalled();
});
it('a completed view cannot leave while canonical recovery still has an unresolved open turn',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok({...snapshot(turn('UNKNOWN_OUTCOME')),status:'COMPLETED'}));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();await click('Novi razgovor');await answer('confirm-sheet-confirm');
 expect(mockApi.recoverTurn).toHaveBeenCalledTimes(2);expect(mockStored).toEqual(intent());
 expect(mockJournal.clear).not.toHaveBeenCalled();expect(mockRouter.replace).not.toHaveBeenCalled();
 expect(mockApi.abandon).not.toHaveBeenCalled();expect(mockApi.open).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
it('failed terminal readback keeps the current route instead of starting a fresh conversation',async()=>{
 mockApi.read.mockResolvedValueOnce(ok({...snapshot(),status:'COMPLETED'}));
 await render();mockApi.read.mockResolvedValueOnce({ok:false,kod:'NETWORK',poruka:'Proveri vezu.'});
 await click('Novi razgovor');await answer('confirm-sheet-confirm');
 expect(mockRouter.replace).not.toHaveBeenCalled();expect(mockApi.abandon).not.toHaveBeenCalled();expect(mockApi.open).not.toHaveBeenCalled();
});
it('scope loss during terminal readback prevents the previous account from navigating',async()=>{
 mockApi.read.mockResolvedValue(ok({...snapshot(),status:'COMPLETED'}));await render();
 const reading=deferred();mockApi.read.mockReturnValueOnce(reading.promise);
 await click('Novi razgovor');await answer('confirm-sheet-confirm');
 await act(async()=>{mockRevision++;tree.update(<Screen/>);reading.resolve(ok({...snapshot(),status:'COMPLETED'}));});
 expect(mockRouter.replace).not.toHaveBeenCalled();expect(mockApi.abandon).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
it('keeps the new-conversation question open with a busy confirm while the old one is abandoned, and closes it once that settles',async()=>{
 // The screen returns its command to the sheet; a `void` there would close the question before the command is sent.
 let settle!:(value:unknown)=>void;mockApi.abandon.mockImplementationOnce(()=>new Promise(done=>{settle=done;}));
 // A saved profile changed under this conversation: "Novi razgovor" is offered.
 mockApi.read.mockResolvedValue(ok({...snapshot(),stale:true}));
 await render();await click('Novi razgovor');await answer('confirm-sheet-confirm');
 expect(mockApi.abandon).toHaveBeenCalledTimes(1);expect(sheets()).toHaveLength(1);
 expect(tree.root.findByType(ConfirmSheet).findByProps({testID:'confirm-sheet-confirm'}).props.accessibilityState).toEqual({disabled:true,busy:true});
 mockApi.read.mockResolvedValue(ok({...snapshot(),status:'ABANDONED'}));
 await act(async()=>settle(ok({...snapshot(),status:'ABANDONED'})));
 expect(sheets()).toHaveLength(0);expect(mockRouter.replace).toHaveBeenCalledWith('/profil/razgovor');
});

it.each([{safety:'BLOCK'},{safety:'REVIEW'},{stale:true},{status:'ABANDONED'},{status:'COMPLETED'}])('revokes microphone scope whenever its visible composer becomes unavailable: %p',async state=>{
 await render();expect((mockVoiceHook.mock.calls.at(-1) as unknown[])[0]).toMatchObject({conversationId:C});
 mockApi.read.mockResolvedValue(ok({...snapshot(),...state}));
 await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});
 expect((mockVoiceHook.mock.calls.at(-1) as unknown[])[0]).toMatchObject({conversationId:null});expect(shell().props.voice).toBeUndefined();
});
it('retains microphone command scope during a legitimate pending turn',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn())));mockApi.recoverTurn.mockResolvedValue(ok(recovery('PROCESSING',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();expect((mockVoiceHook.mock.calls.at(-1) as unknown[])[0]).toMatchObject({conversationId:C});
});
it('dispatched unknown exposes explicit exit with cost copy and requires canonical readback before a fresh message',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));
 await render();expect(action('Odustani od odgovora').props.disabled).toBe(false);
 expect(visibleText()).toContain('poruka je ipak poslata');expect(shell().props.canEdit).toBe(false);
 mockApi.cancelTurn.mockImplementationOnce(async()=>{const value=recovery('FAILED',{providerDispatched:true,cancelled:true,canCancel:false,retryAllowed:false});
  mockApi.recoverTurn.mockResolvedValue(ok(value));mockApi.read.mockResolvedValue(ok(snapshot(turn('FAILED'))));return ok(value);});
 await click('Odustani od odgovora');expect(mockJournal.clear).toHaveBeenCalledWith(intent());expect(shell().props.canEdit).toBe(true);
 expect(mockApi.send).not.toHaveBeenCalled();act(()=>shell().props.onChange('Nova izričita poruka'));await act(async()=>shell().props.onSend());
 expect(mockApi.send).toHaveBeenCalledTimes(1);expect(mockApi.send.mock.calls[0][2]).not.toBe(K);
});
it('lost dispatched exit ACK stays blocked until remount recovers the same cancelled request',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));
 mockApi.cancelTurn.mockResolvedValueOnce({ok:false,kod:'UNKNOWN',poruka:'Ishod nije potvrđen'});
 await render();await click('Odustani od odgovora');expect(mockJournal.clear).not.toHaveBeenCalled();expect(shell().props.canEdit).toBe(false);
 await act(async()=>tree.unmount());mockApi.recoverTurn.mockResolvedValue(ok(recovery('FAILED',{providerDispatched:true,cancelled:true,canCancel:false,retryAllowed:false})));
 mockApi.read.mockResolvedValue(ok(snapshot(turn('FAILED'))));await render();expect(mockJournal.clear).toHaveBeenCalledWith(intent());
 expect(shell().props.canEdit).toBe(true);expect(mockApi.send).not.toHaveBeenCalled();
});
it('completion winning the exit race keeps the actual completed profile proposal visible',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));await render();
 mockApi.cancelTurn.mockImplementationOnce(async()=>{const value=recovery('SUCCEEDED',{providerDispatched:true,canCancel:false,retryAllowed:false});
  mockApi.recoverTurn.mockResolvedValue(ok(value));mockApi.read.mockResolvedValue(ok({...snapshot(turn('SUCCEEDED')),messages:[{id:B,role:'ASSISTANT',body:'Stvarni završen odgovor'}]}));return ok(value);});
 await click('Odustani od odgovora');expect(shell().props.messages).toEqual([{id:B,fromAi:true,body:'Stvarni završen odgovor'}]);
 expect(visibleText()).not.toContain('Odgovor je zaustavljen');expect(mockJournal.clear).toHaveBeenCalledWith(intent());
 expect(mockApi.send).not.toHaveBeenCalled();
});
it('late dispatched exit after account reincarnation cannot clear the old journal or update the new screen',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));await render();
 let release!:(value:unknown)=>void;mockApi.cancelTurn.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 act(()=>action('Odustani od odgovora').props.onPress());await flush();
 await act(async()=>{mockRevision++;tree.update(<Screen/>);});
 await act(async()=>release(ok(recovery('FAILED',{providerDispatched:true,cancelled:true,canCancel:false,retryAllowed:false}))));
 expect(mockJournal.clear).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});

it('P5 worker review: one reachable card action prepares the existing review, never saves or activates implicitly', async () => {
  mockApi.prepare.mockResolvedValue({ ok: false, kod: 'UNAVAILABLE', poruka: 'Proveri stanje.' });
  await render(); const card = shell().props.card(false);
  expect(card.props.showReview).toBe(true); expect(card.props.disabled).toBe(false); expect(typeof card.props.review).toBe('function');
  expect(card.props.reviewInFooter).toBeUndefined(); expect(shell().props.footerAction).toBeUndefined();
  expect(mockApi.prepare).not.toHaveBeenCalled(); expect(mockApi.save).not.toHaveBeenCalled();
  await act(async () => card.props.review());
  expect(mockApi.prepare).toHaveBeenCalledWith(C, 0, true); expect(mockApi.save).not.toHaveBeenCalled();
});
it('P5 worker review: no empty-profile call to action and no review during an unresolved turn', async () => {
  mockApi.read.mockResolvedValue(ok({ ...snapshot(), candidate: { ...candidate(), skills: [] } }));
  await render(); expect(shell().props.card(false)).toBeNull(); expect(shell().props.footerAction).toBeUndefined(); await act(async () => tree.unmount());
  mockApi.read.mockResolvedValue(ok(snapshot(turn()))); await render();
  const card = shell().props.card(false); expect(card.props.showReview).toBe(true); expect(card.props.disabled).toBe(true); expect(card.props.reviewReason).toBeTruthy();
  await act(async () => card.props.review()); expect(mockApi.prepare).not.toHaveBeenCalled();
});
