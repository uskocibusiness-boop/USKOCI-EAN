import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const mockContext=jest.fn(),mockRead=jest.fn(),mockOwnerFeed=jest.fn(),mockPublicFeed=jest.fn(),mockAsk=jest.fn(),mockAnswer=jest.fn(),mockDisposition=jest.fn(),mockAiSubmit=jest.fn(),mockAiRecover=jest.fn(),mockAiCancel=jest.fn(),mockLoad=jest.fn(),mockSave=jest.fn(),mockClear=jest.fn();
const A='11111111-1111-4111-8111-111111111111',N='22222222-2222-4222-8222-222222222222',mockKey='33333333-3333-4333-8333-333333333333';
let mockOwner={user:{id:A},accountRevision:1};let mockApp:(value:string)=>void=()=>{};
let mockFocus:()=>void=()=>{},mockBlur:()=>void=()=>{};
jest.mock('../../../store/sesija',()=>({sesijaSada:()=>mockOwner,useSesija:()=>mockOwner}));
jest.mock('expo-router',()=>({useFocusEffect:(f:()=>unknown)=>require('react').useEffect(()=>{
 mockFocus=()=>{const cleanup=f();mockBlur=typeof cleanup==='function'?cleanup as ()=>void:()=>{};};
 mockFocus();return()=>mockBlur();
},[f])}));
jest.mock('react-native',()=>{const o=jest.requireActual('react-native');return new Proxy(o,{get:(obj,k)=>['View','ActivityIndicator','KeyboardAvoidingView','TextInput'].includes(String(k))?k:k==='AppState'?{currentState:'active',addEventListener:(_e:string,f:(s:string)=>void)=>{mockApp=f;return{remove:jest.fn()};}}:Reflect.get(obj,k)});});
jest.mock('../../../data/qaRecoveryClientService',()=>({qaRecoveryClientService:{context:(...a:unknown[])=>mockContext(...a),read:(...a:unknown[])=>mockRead(...a)}}));
jest.mock('../../../data/preselectionQaClientService',()=>({preselectionQaClientService:{ownerQuestions:(...a:unknown[])=>mockOwnerFeed(...a),publicQa:(...a:unknown[])=>mockPublicFeed(...a),askQuestion:(...a:unknown[])=>mockAsk(...a),answerQuestion:(...a:unknown[])=>mockAnswer(...a),dispositionQuestion:(...a:unknown[])=>mockDisposition(...a)}}));
jest.mock('../../../data/qaSubmissionClientService',()=>({qaSubmissionClientService:{submit:(...a:unknown[])=>mockAiSubmit(...a),recover:(...a:unknown[])=>mockAiRecover(...a),cancel:(...a:unknown[])=>mockAiCancel(...a)}}));
jest.mock('../qaIntent',()=>({...jest.requireActual('../qaIntent'),qaIntentJournal:{load:(...a:unknown[])=>mockLoad(...a),save:(...a:unknown[])=>mockSave(...a),clear:(...a:unknown[])=>mockClear(...a)}}));
jest.mock('@react-native-async-storage/async-storage',()=>({}));
jest.mock('../../../lib/idempotencija',()=>({noviUuidZahtevId:()=>mockKey}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
import {TaskQaScreen} from '../TaskQaScreen';
import {TaskQaPresentation} from '../TaskQaPresentation';
import {ConfirmSheet} from '../../system/ConfirmSheet';
import {ScreenChrome} from '../../system/ScreenChrome';
import {qaTextHash} from '../qaTextHash';
const ok=(podatak:unknown)=>({ok:true,podatak});
const context=(patch={})=>({accountId:A,needId:N,needRevision:2,title:'Montaža police',mode:'PUBLIC',publicRevision:true,activeWorker:true,canAsk:false,canComposeAnswer:false,ratePolicyState:'NOT_READY',questionMaxChars:null,answerMaxChars:null,...patch});
const status=(patch={})=>({accountId:A,needId:N,clientRequestId:mockKey,classificationId:N,type:'ASK',needRevision:2,questionId:null,textSha256:qaTextHash('Da li ima lift?'),state:'PROCESSING',outcome:null,materiality:null,safeReasonCodes:[],canCancel:true,receipt:null,authoritative:true,...patch});
const absent=()=>status({classificationId:null,type:null,needRevision:null,textSha256:null,state:'ABSENT'});
const pending=()=>({type:'ASK',accountId:A,needId:N,needRevision:2,clientRequestId:mockKey,textSha256:qaTextHash('Da li ima lift?')});

it('technical classification cancellation explains failure and unlocks only explicit new input',async()=>{
 mockLoad.mockResolvedValue(pending());mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));
 mockAiRecover.mockResolvedValue(ok(status({state:'CANCELLED',canCancel:false,safeReasonCodes:['QA_PROCESSING_FAILED']})));
 await render();expect(allText()).toContain('Provera teksta nije uspela');
 expect(allText()).not.toContain('pravila su promenjeni');expect(mockClear).toHaveBeenCalledWith(A,N,mockKey);
 expect(mockAiSubmit).not.toHaveBeenCalled();expect(button('Pošalji pitanje')).toBeDefined();
});
let tree:ReactTestRenderer;
// Round 6: commands are V2Action, the chrome's icon buttons and the pill's send; each is found by the name it is pressed
// and heard by, on the outermost element that carries it.
const button=(label:string)=>tree.root.findAll(n=>typeof n.type!=='string'&&(n.props.label===label||n.props.accessibilityLabel===label))[0];
const allText=()=>tree.root.findAll(n=>typeof n.type==='string').flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ');
async function render(onBack=jest.fn(),needId:string|null=N,initialQuestionId?:string){await act(async()=>{tree=create(<TaskQaScreen needId={needId} onBack={onBack} initialQuestionId={initialQuestionId}/>);});}
async function type(value:string,label='Tekst pitanja'){await act(async()=>tree.root.findByProps({accessibilityLabel:label}).props.onChangeText(value));}
beforeEach(()=>{jest.clearAllMocks();mockOwner={user:{id:A},accountRevision:1};mockContext.mockResolvedValue(ok(context()));mockRead.mockResolvedValue(ok({found:false,command:null}));mockPublicFeed.mockResolvedValue(ok([]));mockOwnerFeed.mockResolvedValue(ok([]));mockLoad.mockResolvedValue(null);mockSave.mockResolvedValue(undefined);mockClear.mockResolvedValue(undefined);mockAiSubmit.mockResolvedValue({ok:false,kod:'QA_CLASSIFICATION_UNCONFIRMED',poruka:'Ishod nije potvrđen.'});mockAiRecover.mockResolvedValue(ok(absent()));mockAiCancel.mockResolvedValue(ok(status({state:'CANCELLED',canCancel:false})));});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('shows honest unavailable gate and never sends on entry',async()=>{await render();expect(allText()).toContain('Slanje novih pitanja trenutno nije dostupno');expect(button('Pošalji pitanje')).toBeUndefined();expect(mockAiSubmit).not.toHaveBeenCalled();});
it('restores key read first and absent does not automatically replay',async()=>{mockLoad.mockResolvedValue(pending());await render();expect(mockRead).toHaveBeenCalledWith(N,mockKey,{accountId:A,accountRevision:1});expect(mockAiSubmit).not.toHaveBeenCalled();await act(async()=>button('Pošalji ponovo')!.props.onPress());expect(mockAiSubmit).not.toHaveBeenCalled();expect(allText()).toContain('upiši isti tekst');await type('Da li ima lift?','Isti tekst kao ranije');await act(async()=>button('Pošalji ponovo')!.props.onPress());expect(mockAiSubmit).toHaveBeenCalledWith({type:'ASK',needId:N,needRevision:2,text:'Da li ima lift?',clientRequestId:mockKey},{accountId:A,accountRevision:1});});
it('persists opaque command before one explicit double-tap dispatch',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');mockSave.mockImplementation(async()=>{expect(mockAiSubmit).not.toHaveBeenCalled();});const press=button('Pošalji pitanje')!.props.onPress;await act(async()=>{press();press();});expect(mockAiSubmit).toHaveBeenCalledTimes(1);expect(mockSave).toHaveBeenCalledWith(pending());});
it('durable storage failure and account ABA each prevent dispatch',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');let done!:()=>void;mockSave.mockReturnValue(new Promise<void>(r=>{done=r;}));await act(async()=>button('Pošalji pitanje')!.props.onPress());mockOwner={user:{id:A},accountRevision:3};await act(async()=>{done();});expect(mockAiSubmit).not.toHaveBeenCalled();});
it('background during persistence prevents any late send; resume only reads',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');let done!:()=>void;mockSave.mockReturnValue(new Promise<void>(r=>{done=r;}));await act(async()=>button('Pošalji pitanje')!.props.onPress());await act(async()=>{mockApp('background');done();});expect(mockAiSubmit).not.toHaveBeenCalled();mockLoad.mockResolvedValue(pending());await act(async()=>mockApp('active'));expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockRead).toHaveBeenCalled();});
it('restores only exact receipt and states question is still awaiting answer',async()=>{mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,command:{type:'ASK',needRevision:2,textSha256:pending().textSha256,receipt:{questionId:mockKey,status:'PENDING_ANSWER',needRevision:2,idempotentReplay:true}}}));await render();expect(allText()).toContain('Javno se prikazuje kada stigne odgovor');expect(mockClear).toHaveBeenCalledWith(A,N,mockKey);expect(mockAiSubmit).not.toHaveBeenCalled();});
it('does not leak non-current answered feed when task changed during read',async()=>{mockPublicFeed.mockResolvedValue(ok([{questionId:mockKey,needRevision:1,questionText:'OLD_SECRET',answerText:'OLD',edited:false}]));await render();expect(allText()).not.toContain('OLD_SECRET');expect(allText()).toContain('Zadatak je izmenjen');});
it('owner sees pending first and explicit old revision without an answer action',async()=>{mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true})));mockOwnerFeed.mockResolvedValue(ok([{questionId:mockKey,needRevision:1,questionText:'OLD',status:'PENDING_ANSWER',answerText:null,edited:false},{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));await render();expect(allText().indexOf('CURRENT')).toBeLessThan(allText().indexOf('OLD'));expect(allText()).toContain('ne opisuju trenutne uslove');expect(tree.root.findAll(n=>typeof n.type!=='string'&&n.props.label==='Odgovori')).toHaveLength(1);});
it('saved submit closure is retired after refresh',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');const old=button('Pošalji pitanje')!.props.onPress;await act(async()=>button('Osveži pitanja i ishod radnje')!.props.onPress());await act(async()=>old());expect(mockAiSubmit).not.toHaveBeenCalled();});
it('restored provider processing never offers replay and cancellation is explicit',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));await render();
 expect(allText()).toContain('Ne znamo da li je prethodno slanje uspelo');expect(allText()).not.toContain('potvrdu da je prethodno slanje stiglo');
 expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockAiCancel).not.toHaveBeenCalled();expect(button('Pošalji ponovo')).toBeUndefined();
 await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 expect(mockAiCancel).toHaveBeenCalledWith({type:'ASK',needId:N,needRevision:2,clientRequestId:mockKey,textSha256:pending().textSha256},{accountId:A,accountRevision:1});
 expect(mockClear).toHaveBeenCalledWith(A,N,mockKey);expect(allText()).toContain('Slanje je otkazano');
});
it('canonical commit winning cancellation is shown as sent, never falsely cancelled',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));
 mockAiCancel.mockResolvedValue(ok(status({state:'COMMITTED',canCancel:false,outcome:'ALLOW',receipt:{questionId:mockKey,status:'PENDING_ANSWER',needRevision:2,idempotentReplay:true}})));
 await render();await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 expect(allText()).toContain('Pitanje je poslato');expect(allText()).not.toContain('Slanje je otkazano');expect(mockClear).toHaveBeenCalledTimes(1);
});
it('unknown cancellation keeps persisted intent and reads again without a new submit',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));mockAiCancel.mockResolvedValue({ok:false,kod:'UNKNOWN',poruka:'Nepotvrđeno'});
 await render();await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 expect(mockClear).not.toHaveBeenCalled();expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockAiRecover.mock.calls.length).toBeGreaterThan(1);
});
it('ready classification only continues the same key with explicitly re-entered matching text',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status({state:'READY',outcome:'ALLOW'})));await render();
 expect(allText()).toContain('Tekst je proveren, ali još nije objavljen');expect(allText()).not.toContain('potvrdu da je prethodno slanje stiglo');
 expect(mockAiSubmit).not.toHaveBeenCalled();await type('Da li ima lift?','Isti tekst kao ranije');await act(async()=>button('Pošalji ponovo')!.props.onPress());
 expect(mockAiSubmit).toHaveBeenCalledTimes(1);expect(mockAsk).not.toHaveBeenCalled();
});
it('a mismatched classifier hash cannot clear the intent or offer retry/cancel',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status({textSha256:'f'.repeat(64)})));await render();
 expect(mockClear).not.toHaveBeenCalled();expect(button('Pošalji ponovo')).toBeUndefined();expect(button('Odustani od ovog slanja')).toBeUndefined();
});
it('material answer rejection directs the owner back to canonical Task edit without publishing',async()=>{
 const intent={...pending(),type:'ANSWER',questionId:N};mockLoad.mockResolvedValue(intent);
 mockAiRecover.mockResolvedValue(ok(status({type:'ANSWER',questionId:N,state:'REJECTED',outcome:'ALLOW',materiality:'MATERIAL',canCancel:false})));
 await render();expect(button('Nazad na zadatak radi izmene')).toBeDefined();expect(allText()).toContain('menja uslove zadatka');expect(mockAnswer).not.toHaveBeenCalled();expect(mockAiSubmit).not.toHaveBeenCalled();
});
it('a grey send button says why, and the reason leaves once the question is written',async()=>{
 mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();
 // The reason rides on the grey send as its spoken hint (the pill of Poruke draws no line for an empty field).
 expect(button('Pošalji pitanje')!.props.disabled).toBe(true);expect(button('Pošalji pitanje')!.props.accessibilityHint).toBe('Upiši pitanje pre slanja.');
 await type('Da li ima lift?');expect(button('Pošalji pitanje')!.props.disabled).toBe(false);expect(button('Pošalji pitanje')!.props.accessibilityHint).toBeUndefined();
 expect(mockAiSubmit).not.toHaveBeenCalled();
});
it('leaving while cancellation awaits a receipt cannot clear newer local state',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));let resolve!:(v:unknown)=>void;
 mockAiCancel.mockReturnValue(new Promise(r=>{resolve=r;}));await render();await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 await act(async()=>{mockApp('background');resolve(ok(status({state:'CANCELLED',canCancel:false})));});expect(mockClear).not.toHaveBeenCalled();
});
it('skip and report ask through the confirm sheet first; only the confirm journals and sends the disposition',async()=>{
 mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true})));
 mockOwnerFeed.mockResolvedValue(ok([{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));
 mockDisposition.mockResolvedValue({ok:false,kod:'UNKNOWN',poruka:'Nepotvrđeno'});await render();
 await act(async()=>button('Prijavi pitanje')!.props.onPress());
 expect(mockSave).not.toHaveBeenCalled();expect(mockDisposition).not.toHaveBeenCalled();
 const sheet=tree.root.findByType(ConfirmSheet);expect(sheet.props.tone).toBe('danger');
 await act(async()=>sheet.findByProps({testID:'confirm-sheet-cancel'}).props.onPress());expect(mockDisposition).not.toHaveBeenCalled();
 await act(async()=>button('Preskoči pitanje')!.props.onPress());expect(mockDisposition).not.toHaveBeenCalled();
 await act(async()=>tree.root.findByType(ConfirmSheet).findByProps({testID:'confirm-sheet-confirm'}).props.onPress());
 expect(mockSave).toHaveBeenCalledTimes(1);expect(mockDisposition).toHaveBeenCalledWith(N,'IGNORE',mockKey);
});
it('an over-long text greys the send and says why above the pill',async()=>{
 mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:5})));await render();await type('Da li ima lift?');
 expect(button('Pošalji pitanje')!.props.disabled).toBe(true);expect(allText()).toContain('skrati tekst');expect(mockSave).not.toHaveBeenCalled();
});
it('a failed first read offers one retry and says so as an alert',async()=>{
 mockContext.mockResolvedValue({ok:false,kod:'UNAVAILABLE',poruka:'Proveri vezu i pokušaj ponovo.'});await render();
 expect(allText()).toContain('Pitanja nisu učitana');expect(allText()).toContain('Proveri vezu');
 mockContext.mockResolvedValue(ok(context()));await act(async()=>button('Pokušaj ponovo')!.props.onPress());expect(allText()).toContain('Još nema objavljenih odgovora');
});
it('the presentation alone reads nothing and draws the thread with the answer behind its label',async()=>{
 const noop=()=>{};
 await act(async()=>{tree=create(<TaskQaPresentation title="Montaža police" mode="PUBLIC" loaded busy={false} message="" receipt="" canRetryRead material={false}
  recovery={null} cannotAsk={null} composer={{answering:null,revisionChanged:false,maxChars:500}} text="" canAnswer={false} pending={[]} set={[]} historical={[]}
  answered={[{questionId:N,needRevision:2,questionText:'Da li ima lift?',answerVersion:1,answerText:'Nema, treći sprat.',edited:true} as never]}
  onBack={noop} onRefresh={noop} onText={noop} onSend={noop} onRetry={noop} onCancel={noop} onChoose={noop} onDispose={noop} onCloseAnswer={noop} onEditTask={noop}/>);});
 expect(allText()).toContain('Da li ima lift?');expect(allText()).toContain('Odgovor · izmenjen');expect(allText()).not.toContain('Anonimno pitanje');
 expect(mockContext).not.toHaveBeenCalled();expect(mockLoad).not.toHaveBeenCalled();
});
// Round 6 emulator critique (row 11): the recovery panel and its field speak plainly, the retry says why it is grey,
// a missing Radni profil has a way forward, the row being answered says so, and only a real problem is red.
it('the retry is grey with its reason until the same text is written, and the panel speaks without jargon',async()=>{
 mockLoad.mockResolvedValue(pending());await render();
 expect(button('Pošalji ponovo')!.props.disabled).toBe(true);expect(button('Pošalji ponovo')!.props.reason).toBe('Upiši isti tekst pre ponavljanja.');
 const field=tree.root.findByProps({accessibilityLabel:'Isti tekst kao ranije'});expect(field.props.placeholder).toBe('Napiši isti tekst…');
 expect(allText()).toContain('Isti tekst kao ranije');expect(allText()).toContain('Provera prethodnog slanja');
 expect(allText()).not.toContain('identifikator');expect(allText()).not.toContain('radnju');expect(allText()).not.toContain('obrađuje');
 await type('Da li ima lift?','Isti tekst kao ranije');
 expect(button('Pošalji ponovo')!.props.disabled).toBe(false);expect(button('Pošalji ponovo')!.props.reason).toBeNull();
 expect(mockAiSubmit).not.toHaveBeenCalled();
});
it('a text checked but not yet published is said plainly with the retry, never as a red alert',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status({state:'READY',outcome:'ALLOW'})));await render();
 const line=tree.root.findAll(n=>n.props.children==='Tekst je proveren, ali još nije objavljen. Upiši isti tekst pa pošalji ponovo.')[0];
 expect(line).toBeDefined();expect(line.props.tone).not.toBe('danger');expect(line.props.accessibilityRole).toBeUndefined();
 expect(button('Pošalji ponovo')).toBeDefined();expect(button('Odustani od ovog slanja')).toBeDefined();
 // The same text written wrongly is a real problem and stays red.
 await type('Nešto drugo','Isti tekst kao ranije');await act(async()=>button('Pošalji ponovo')!.props.onPress());
 const wrong=tree.root.findAll(n=>typeof n.props.children==='string'&&n.props.children.includes('Prethodni tekst nije sačuvan'))[0];
 expect(wrong.props.tone).toBe('danger');expect(wrong.props.accessibilityRole).toBe('alert');expect(mockAiSubmit).not.toHaveBeenCalled();
});
it('a missing Radni profil offers the way there, only when the route gives one',async()=>{
 const onWorkerProfile=jest.fn();mockContext.mockResolvedValue(ok(context({activeWorker:false})));
 await act(async()=>{tree=create(<TaskQaScreen needId={N} onBack={jest.fn()} onWorkerProfile={onWorkerProfile}/>);});
 expect(allText()).toContain('potreban je aktivan Radni profil');
 await act(async()=>button('Dopuni radni profil')!.props.onPress());expect(onWorkerProfile).toHaveBeenCalledTimes(1);
 await act(async()=>tree.unmount());await render();expect(allText()).toContain('potreban je aktivan Radni profil');expect(button('Dopuni radni profil')).toBeUndefined();
});
it('the question being answered says so instead of offering its actions',async()=>{
 mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true})));
 mockOwnerFeed.mockResolvedValue(ok([{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));await render();
 expect(allText()).not.toContain('Odgovaraš');await act(async()=>button('Odgovori')!.props.onPress());
 expect(allText()).toContain('Odgovaraš');expect(button('Odgovori')).toBeUndefined();expect(button('Preskoči pitanje')).toBeUndefined();expect(button('Prijavi pitanje')).toBeUndefined();
 await act(async()=>button('Zatvori odgovor')!.props.onPress());expect(allText()).not.toContain('Odgovaraš');expect(button('Preskoči pitanje')).toBeDefined();
});
it('a version filter is said plainly, not as a red alert, under one steady title',async()=>{
 mockPublicFeed.mockResolvedValue(ok([{questionId:mockKey,needRevision:1,questionText:'OLD',answerText:'OLD',edited:false}]));await render();
 const line=tree.root.findAll(n=>n.props.children==='Zadatak je izmenjen. Ranija pitanja pripadaju starijoj verziji.')[0];
 expect(line).toBeDefined();expect(line.props.tone).not.toBe('danger');expect(line.props.accessibilityRole).toBeUndefined();
 const chrome=tree.root.findByType(ScreenChrome);expect(chrome.props.title).toBe('Pitanja o zadatku');expect(chrome.props.subtitle).toBe('Montaža police');
});
it('a skip confirmed after the questions were read again writes nothing',async()=>{
 mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true})));
 mockOwnerFeed.mockResolvedValue(ok([{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));await render();
 await act(async()=>button('Preskoči pitanje')!.props.onPress());const confirm=tree.root.findByType(ConfirmSheet).findByProps({testID:'confirm-sheet-confirm'}).props.onPress;
 await act(async()=>button('Osveži pitanja i ishod radnje')!.props.onPress());await act(async()=>confirm());
 expect(mockSave).not.toHaveBeenCalled();expect(mockDisposition).not.toHaveBeenCalled();
});
it('Back retires the question visit before blur, including repeated Back and a retained send',async()=>{
 const back=jest.fn();mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));
 await render(back);await type('Da li ima lift?');const old=tree.root.findByType(TaskQaPresentation).props;
 await act(async()=>{old.onBack();old.onBack();old.onSend();});
 expect(back).toHaveBeenCalledTimes(1);expect(mockSave).not.toHaveBeenCalled();expect(mockAiSubmit).not.toHaveBeenCalled();
});
it.each([false,true])('Back during answer persistence leaves recovery intact without dispatch (foreground=%s)',async foreground=>{
 const back=jest.fn();mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true,answerMaxChars:1000})));
 mockOwnerFeed.mockResolvedValue(ok([{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));
 await render(back);await act(async()=>button('Odgovori')!.props.onPress());await type('Lift postoji.','Tekst odgovora');
 let done!:()=>void;mockSave.mockReturnValue(new Promise<void>(resolve=>{done=resolve;}));
 await act(async()=>tree.root.findByType(TaskQaPresentation).props.onSend());expect(mockSave).toHaveBeenCalledTimes(1);
 await act(async()=>{tree.root.findByType(TaskQaPresentation).props.onBack();if(foreground){mockApp('background');mockApp('active');}done();});
 expect(back).toHaveBeenCalledTimes(1);expect(mockLoad).toHaveBeenCalledTimes(1);
 expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockClear).not.toHaveBeenCalled();
 // A genuine return recovers the saved identity by reading it; it never replays the answer automatically.
 mockLoad.mockResolvedValue({...pending(),type:'ANSWER',questionId:N,textSha256:qaTextHash('Lift postoji.')});
 await act(async()=>{mockBlur();mockFocus();});
 expect(mockRead).toHaveBeenCalledWith(N,mockKey,{accountId:A,accountRevision:1});expect(mockAiSubmit).not.toHaveBeenCalled();
 expect(allText()).toContain('Provera prethodnog slanja');
});
it('callbacks from an old visit cannot leave or change the answer after a genuine refocus',async()=>{
 const back=jest.fn();mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true})));
 mockOwnerFeed.mockResolvedValue(ok([{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));
 await render(back);await act(async()=>button('Odgovori')!.props.onPress());await type('Sačuvan odgovor.','Tekst odgovora');
 const old=tree.root.findByType(TaskQaPresentation).props;
 await act(async()=>{mockBlur();mockFocus();});
 await act(async()=>{old.onBack();old.onCloseAnswer();old.onText('STARI POZIV');});
 expect(back).not.toHaveBeenCalled();expect(tree.root.findByType(TaskQaPresentation).props.text).toBe('Sačuvan odgovor.');
 expect(allText()).toContain('Odgovaraš');
 await act(async()=>tree.root.findByType(TaskQaPresentation).props.onBack());expect(back).toHaveBeenCalledTimes(1);
});
it('the invalid task error still has a working one-shot Back without reading or sending',async()=>{
 const back=jest.fn();await render(back,null);expect(allText()).toContain('Ponovo otvori zadatak');
 const leave=tree.root.findByType(TaskQaPresentation).props.onBack;await act(async()=>{leave();leave();});
 expect(back).toHaveBeenCalledTimes(1);expect(mockLoad).not.toHaveBeenCalled();expect(mockContext).not.toHaveBeenCalled();expect(mockAiSubmit).not.toHaveBeenCalled();
});


describe('exact question selected from the task',()=>{
 const q={questionId:mockKey,needRevision:2,questionText:'Da li ima lift?',status:'ANSWERED_PUBLIC',createdAt:'2026-10-09T10:00:00Z',answerVersion:1,answerText:'Ima lift.',edited:false};
 const owner=()=>{mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true,answerMaxChars:1000})));mockOwnerFeed.mockResolvedValue(ok([q]));};
 const shown=()=>tree.root.findByType(TaskQaPresentation).props;
 it('prefills the chosen answer, preserves changes across refresh/refocus and never reopens after closing',async()=>{
  owner();await render(jest.fn(),N,mockKey);
  expect(shown().composer?.answeringId).toBe(mockKey);expect(shown().text).toBe('Ima lift.');
  await act(async()=>shown().onText('Lift je mali.'));
  await act(async()=>shown().onRefresh());expect(shown().text).toBe('Lift je mali.');
  await act(async()=>mockBlur());await act(async()=>mockFocus());expect(shown().text).toBe('Lift je mali.');
  await act(async()=>shown().onCloseAnswer());await act(async()=>shown().onRefresh());
  expect(shown().composer).toBeNull();expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockAnswer).not.toHaveBeenCalled();
 });
 it('opens an empty answer for a pending question and retries the initial read without losing that intent',async()=>{
  owner();mockOwnerFeed.mockResolvedValue(ok([{...q,status:'PENDING_ANSWER',answerText:null,answerVersion:null}]));
  mockContext.mockResolvedValueOnce({ok:false,poruka:'Veza nije dostupna.'});
  await render(jest.fn(),N,mockKey);expect(shown().composer).toBeNull();
  await act(async()=>shown().onRefresh());expect(shown().composer?.answeringId).toBe(mockKey);expect(shown().text).toBe('');
 });
 it.each(['PUBLIC','DENIED','OLD','IGNORED','REPORTED','MISSING'])('never selects a %s target',async(kind)=>{
  owner();if(kind==='PUBLIC'){mockContext.mockResolvedValue(ok(context()));mockPublicFeed.mockResolvedValue(ok([{...q,answeredAt:'2026-10-09T10:00:00Z'}]));}
  if(kind==='DENIED')mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:false})));
  if(kind==='OLD')mockOwnerFeed.mockResolvedValue(ok([{...q,needRevision:1}]));
  if(kind==='IGNORED'||kind==='REPORTED')mockOwnerFeed.mockResolvedValue(ok([{...q,status:kind}]));
  await render(jest.fn(),N,kind==='MISSING'?N:mockKey);
  expect(shown().composer).toBeNull();expect(mockAiSubmit).not.toHaveBeenCalled();
 });
 it.each(['PROCESSING','COMMITTED'])('recovered %s command takes priority even if recovery finishes it',async(state)=>{
  owner();mockLoad.mockResolvedValue({...pending(),type:'ANSWER',questionId:mockKey});
  mockAiRecover.mockResolvedValue(ok(status({type:'ANSWER',questionId:mockKey,state,
   receipt:state==='COMMITTED'?{questionId:mockKey,status:'ANSWERED_PUBLIC',needRevision:2,answerVersion:2,edited:true}:null})));
  await render(jest.fn(),N,mockKey);expect(shown().composer).toBeNull();expect(mockAiSubmit).not.toHaveBeenCalled();
  if(state==='COMMITTED')expect(mockClear).toHaveBeenCalled();
 });
 it.each(['blur','account'])('a delayed owner read cannot select after %s changes',async(change)=>{
  owner();let done!:(v:unknown)=>void;mockOwnerFeed.mockReturnValue(new Promise(resolve=>{done=resolve;}));
  await render(jest.fn(),N,mockKey);
  if(change==='blur')await act(async()=>mockBlur());else mockOwner={user:{id:A},accountRevision:2};
  await act(async()=>done(ok([q])));expect(shown().composer).toBeNull();expect(mockAiSubmit).not.toHaveBeenCalled();
 });
});
