import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const mockReview=jest.fn(),mockStart=jest.fn(),mockRead=jest.fn(),mockLoad=jest.fn(),mockSave=jest.fn(),mockClear=jest.fn(),mockLogout=jest.fn(),mockPush=jest.fn(),mockNavigate=jest.fn(),mockClose=jest.fn();
const A='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',mockKey='33333333-3333-4333-8333-333333333333';
let mockOwner={user:{id:A},accountRevision:1},mockFocused=true;
const mockAppListeners=new Set<(state:string)=>void>();
jest.mock('../../../store/sesija',()=>({sesijaSada:()=>mockOwner,useSesija:()=>mockOwner}));
jest.mock('expo-router',()=>({useFocusEffect:(f:()=>unknown)=>require('react').useEffect(()=>mockFocused?f():undefined,[f,mockFocused]),useRouter:()=>({push:mockPush,navigate:mockNavigate})}));
jest.mock('react-native',()=>{const original=jest.requireActual('react-native');return new Proxy(original,{get:(o,k)=>['View','ActivityIndicator','Modal','ScrollView'].includes(String(k))?k:k==='AppState'?{currentState:'active',addEventListener:(_:string,listener:(state:string)=>void)=>{mockAppListeners.add(listener);return{remove:()=>mockAppListeners.delete(listener)};}}:Reflect.get(o,k)});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('../../Press',()=>({Press:'Press'}));
jest.mock('../../Text',()=>({T:'T'}));
jest.mock('../../../data/closureExecutionClientService',()=>({...jest.requireActual('../../../data/closureExecutionClientService'),closureExecutionClientService:{review:(...a:unknown[])=>mockReview(...a),read:(...a:unknown[])=>mockRead(...a),start:(...a:unknown[])=>mockStart(...a)}}));
jest.mock('../../../data/accountClosureClientService',()=>({accountClosureClientService:{read:jest.fn(),prepare:jest.fn(),readReceipt:jest.fn()}}));
jest.mock('../../../data/authClientService',()=>({authClientService:{signOutLocal:(...a:unknown[])=>mockLogout(...a)}}));
jest.mock('../../../data/supabaseClient',()=>({supabaseKlijent:jest.fn()}));
jest.mock('../closureIntent',()=>({closureIntentJournal:{load:(...a:unknown[])=>mockLoad(...a),save:(...a:unknown[])=>mockSave(...a),clear:(...a:unknown[])=>mockClear(...a)}}));
jest.mock('../../../lib/idempotencija',()=>({noviUuidZahtevId:()=>mockKey}));
jest.mock('../../settings/SettingsPresentation',()=>{const component=(name:string)=>({children,...props}:any)=>require('react').createElement(name,props,children);return Object.fromEntries(['SettingsScreen','SettingsIntro','SettingsPanel','SettingsInfo','SettingsText','SettingsAction','SettingsGroup','SettingsRow'].map(n=>[n,component(n)]));});
import {ClosureDialog,ClosureEntry} from '../ClosureDialog';
import {ConfirmSheet} from '../../system/ConfirmSheet';
import {InlineNote} from '../../privacy/InlineNote';
const ok=(podatak:unknown)=>({ok:true,podatak}),ready=()=>({accountId:A,requestId:R,revision:1,ready:true,policySha256:'a'.repeat(64),blockers:[],code:null,retainedDatasets:[],authoritative:true});
const pending=()=>({kind:'START',accountId:A,requestId:R,expectedRevision:1,clientRequestId:mockKey,policySha256:'a'.repeat(64)});
let tree:ReactTestRenderer;
// Any element that carries the label: a SettingsAction or row (mocked hosts) or the danger action (a real V2Action).
const button=(label:string)=>tree.root.findAll(n=>n.props.label===label)[0];
const sheets=()=>tree.root.findAllByType(ConfirmSheet);
const confirmButton=()=>sheets()[0]?.findByProps({testID:'confirm-sheet-confirm'});
const cancelButton=()=>sheets()[0]?.findByProps({testID:'confirm-sheet-cancel'});
const text=()=>tree.root.findAll(n=>typeof n.type==='string').flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ');
const element=()=><ClosureDialog onClose={mockClose}/>;
const render=async()=>{await act(async()=>{tree=create(element());});};
const update=async()=>{await act(async()=>tree.update(element()));};
const appState=async(state:string)=>{await act(async()=>{for(const listener of mockAppListeners)listener(state);});};
// Deep read 8.18: the start asks once more before the irreversible step, now in a danger sheet.
const askStart=async()=>{await act(async()=>button('Pokreni zatvaranje naloga').props.onPress());};
beforeEach(()=>{jest.clearAllMocks();mockAppListeners.clear();mockOwner={user:{id:A},accountRevision:1};mockFocused=true;mockLoad.mockResolvedValue(null);mockSave.mockResolvedValue(undefined);mockClear.mockResolvedValue(undefined);mockReview.mockResolvedValue(ok(ready()));mockRead.mockResolvedValue(ok({found:false,receipt:null,execution:null}));mockStart.mockResolvedValue({ok:false,kod:'CLOSURE_OUTCOME_UNKNOWN',poruka:'Ishod nije potvrđen.'});});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('reads only on entry and starts once after explicit double tap, saving the key first',async()=>{await render();expect(mockStart).not.toHaveBeenCalled();mockSave.mockImplementation(async()=>{expect(mockStart).not.toHaveBeenCalled();});await askStart();expect(mockStart).not.toHaveBeenCalled();expect(text()).toContain('To ne možeš da poništiš');expect(sheets()[0].props).toMatchObject({confirmLabel:'Da, trajno zatvori nalog',cancelLabel:'Odustani',tone:'danger'});const press=confirmButton().props.onPress;await act(async()=>{press();press();});expect(mockStart).toHaveBeenCalledTimes(1);expect(mockSave).toHaveBeenCalledWith(pending());expect(mockRead).toHaveBeenCalledWith(mockKey,{accountId:A,accountRevision:1});});
it('restores persisted unknown key with read only; absent does not auto-submit',async()=>{mockLoad.mockResolvedValue(pending());await render();expect(mockRead).toHaveBeenCalledWith(mockKey,{accountId:A,accountRevision:1});expect(mockStart).not.toHaveBeenCalled();expect(mockReview).not.toHaveBeenCalled();expect(button('Pošalji zahtev za zatvaranje ponovo')).toBeDefined();await act(async()=>button('Pošalji zahtev za zatvaranje ponovo').props.onPress());expect(mockStart).toHaveBeenCalledTimes(1);expect(mockStart.mock.calls[0][0]).toEqual(pending());});
it('restored executing receipt does not become completed without worker evidence',async()=>{mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,receipt:{},execution:{state:'EXECUTING',accountId:A,generation:R}}));await render();expect(text()).toContain('Zatvaranje još nije završeno');expect(text()).not.toContain('Nalog je zatvoren.');expect(mockStart).not.toHaveBeenCalled();expect(button('Pokreni zatvaranje naloga')).toBeUndefined();});
it('server-ready false displays the gate: the final action stands last, grey, with its reason, and nothing is started or invented',async()=>{mockReview.mockResolvedValue(ok({...ready(),ready:false,code:'CLOSURE_POLICY_NOT_READY',retainedDatasets:null}));await render();expect(text()).toContain('Potpuna pravila zatvaranja i čuvanja još nisu objavljena');
 // UI/UX pass 2026-10-07: not missing without a word but grey with the reason beside it (the owner's rule); it cannot start anything.
 const final=tree.root.findAll(n=>n.props.label==='Pokreni zatvaranje naloga'&&'reason' in n.props)[0];expect(final.props).toMatchObject({disabled:true,reason:'Zatvaranje trenutno nije dostupno.'});
 await act(async()=>button('Pokreni zatvaranje naloga').props.onPress());expect(sheets()).toHaveLength(0);expect(mockStart).not.toHaveBeenCalled();expect(mockSave).not.toHaveBeenCalled();expect(text()).not.toMatch(/\d+ (dan|dana|sat|sata)/);});
it('the first tap only asks; cancelling leaves nothing started',async()=>{await render();await askStart();expect(mockSave).not.toHaveBeenCalled();expect(mockStart).not.toHaveBeenCalled();await act(async()=>cancelButton().props.onPress());expect(button('Pokreni zatvaranje naloga')).toBeDefined();expect(sheets()).toHaveLength(0);expect(mockStart).not.toHaveBeenCalled();});
it('closing the review retires its confirmation before unmount and closes only once',async()=>{
 await render();await askStart();const kept=sheets()[0].props.onConfirm,close=button('Zatvori pregled').props.onPress;
 await act(async()=>{close();close();await kept();});
 expect(mockStart).not.toHaveBeenCalled();expect(mockSave).not.toHaveBeenCalled();
 expect(mockClose).toHaveBeenCalledTimes(1);expect(sheets()).toHaveLength(0);
});
it('export exit dispatches once and retires a competing retained start question',async()=>{
 await render();const go=button('Izvoz podataka').props.onPress,ask=button('Pokreni zatvaranje naloga').props.onPress;
 await act(async()=>{go();go();ask();});
 expect(mockClose).toHaveBeenCalledTimes(1);expect(mockNavigate).toHaveBeenCalledTimes(1);
 expect(mockNavigate).toHaveBeenCalledWith('/profil/izvoz');expect(sheets()).toHaveLength(0);expect(mockStart).not.toHaveBeenCalled();
});
it('an export exit retained across blur/refocus cannot close or navigate the later visit',async()=>{
 await render();const retained=button('Izvoz podataka').props.onPress;
 mockFocused=false;await update();mockFocused=true;await update();
 await act(async()=>retained());expect(mockClose).not.toHaveBeenCalled();expect(mockNavigate).not.toHaveBeenCalled();
 await act(async()=>button('Izvoz podataka').props.onPress());expect(mockClose).toHaveBeenCalledTimes(1);
 expect(mockNavigate).toHaveBeenCalledTimes(1);
});
it('closing during durable intent persistence keeps the intent but prevents a later network start',async()=>{
 let finish!:()=>void;mockSave.mockReturnValueOnce(new Promise<void>(resolve=>{finish=resolve;}));
 await render();await askStart();await act(async()=>{confirmButton().props.onPress();});
 expect(mockSave).toHaveBeenCalledTimes(1);expect(mockStart).not.toHaveBeenCalled();
 await act(async()=>button('Zatvori pregled').props.onPress());
 await act(async()=>finish());
 expect(mockStart).not.toHaveBeenCalled();expect(mockClear).not.toHaveBeenCalled();
});
it('a foreground return restores a fresh review while prior visit actions remain retired',async()=>{
 await render();const retained=button('Pokreni zatvaranje naloga').props.onPress,oldClose=button('Zatvori pregled').props.onPress;
 await appState('background');await appState('active');expect(mockReview).toHaveBeenCalledTimes(2);
 await act(async()=>{retained();oldClose();});expect(sheets()).toHaveLength(0);expect(mockClose).not.toHaveBeenCalled();
 await askStart();expect(sheets()).toHaveLength(1);
});
it('a dismissed visit cannot restart its reads on a foreground event before unmount',async()=>{
 await render();await act(async()=>button('Zatvori pregled').props.onPress());
 await appState('background');await appState('active');
 expect(mockReview).toHaveBeenCalledTimes(1);expect(mockLoad).toHaveBeenCalledTimes(1);expect(mockClose).toHaveBeenCalledTimes(1);
});
it('the initial loading review can close and ignores its later read completion',async()=>{
 let finish!:(value:unknown)=>void;mockReview.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
 await render();await act(async()=>button('Zatvori pregled').props.onPress());expect(mockClose).toHaveBeenCalledTimes(1);
 await act(async()=>finish(ok(ready())));
 expect(button('Pokreni zatvaranje naloga')).toBeUndefined();expect(mockStart).not.toHaveBeenCalled();
});
it('Android modal Back retires the question before the host unmounts the dialog',async()=>{
 await act(async()=>{tree=create(<ClosureEntry/>);});
 await act(async()=>button('Zatvaranje naloga').props.onPress());await askStart();
 const kept=sheets()[0].props.onConfirm,nativeBack=tree.root.findByType('Modal' as never).props.onRequestClose;
 await act(async()=>{nativeBack();await kept();});
 expect(mockSave).not.toHaveBeenCalled();expect(mockStart).not.toHaveBeenCalled();
 expect(tree.root.findAllByType(ClosureDialog)).toHaveLength(0);
});
it('cannot submit after local durable storage failure',async()=>{mockSave.mockRejectedValue(new Error('unavailable'));await render();await askStart();await act(async()=>confirmButton().props.onPress());expect(mockStart).not.toHaveBeenCalled();});
it('account ABA during key persistence fences the network write',async()=>{let resolve!:()=>void;mockSave.mockReturnValue(new Promise<void>(r=>{resolve=r;}));await render();await askStart();await act(async()=>{confirmButton().props.onPress();});mockOwner={user:{id:A},accountRevision:3};await act(async()=>{resolve();});expect(mockStart).not.toHaveBeenCalled();});
it('closed receipt accurately reports retained identity/evidence and offers existing local logout',async()=>{mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,receipt:{},execution:{state:'CLOSED',accountId:A,generation:R,closedAt:'2026-09-13T01:00:00Z',retainedDatasets:[]}}));await render();expect(text()).toContain('Identifikator naloga i evidencije');expect(text()).toContain('Podaci za prijavu su uklonjeni');await act(async()=>button('Odjavi se sa ovog uređaja').props.onPress());expect(mockLogout).toHaveBeenCalledWith({accountId:A,accountRevision:1});});
it('explains partial AF22 erasure and a real support exit without a fake completion or duration',async()=>{
 mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,receipt:{},execution:{state:'EXECUTING',accountId:A,generation:R,adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',ordinaryContentErased:true,completedSteps:74,totalSteps:74,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED']}}));
 await render();expect(text()).toContain('Obični podaci aplikacije su uklonjeni');expect(text()).toContain('nalog nije zatvoren');expect(text()).not.toContain('Nalog je zatvoren.');expect(text()).not.toContain('Ograničeno čuvanje:');expect(text()).toContain('Provereni koraci: 74 od 74.');
 const support=button('Otvori privatnu podršku').props.onPress;await act(async()=>{support();support();});expect(mockPush).toHaveBeenCalledWith('/podrska');expect(mockPush).toHaveBeenCalledTimes(1);expect(mockClose).toHaveBeenCalledTimes(1);expect(mockStart).not.toHaveBeenCalled();
});
it('guards support navigation on account incarnation and shows the approved final ordinary erasure',async()=>{
 mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,receipt:{},execution:{state:'EXECUTING',accountId:A,generation:R,adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',ordinaryContentErased:true,completedSteps:74,totalSteps:74,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED']}}));await render();
 const go=button('Otvori privatnu podršku').props.onPress;mockOwner={user:{id:A},accountRevision:3};await act(async()=>go());expect(mockPush).not.toHaveBeenCalled();
});
it('complete AF22 receipt states limited pseudonymous records rather than retaining all plaintext',async()=>{
 mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,receipt:{},execution:{state:'CLOSED',accountId:A,generation:R,adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',ordinaryContentErased:true,pseudonymousAuditRetained:true,exceptions:[],retainedDatasets:[],closedAt:'2026-09-13T09:00:00Z'}}));await render();
 expect(text()).toContain('Obični lični i privatni podaci aplikacije su uklonjeni');expect(text()).toContain('minimalni pseudonimni zapisi');expect(text()).not.toContain('Identifikator naloga i evidencije obuhvaćene objavljenim pravilima');
});
// Round 5: the question is a sheet that holds the answer it was given. The answer is fenced by the question's own token and
// by the review it asked about, so an answer kept across a refresh, a refocus or a new review starts nothing.
it('an answer kept across a refresh starts nothing',async()=>{
 await render();await askStart();const kept=sheets()[0].props.onConfirm;
 await act(async()=>button('Osveži pregled').props.onPress());expect(sheets()).toHaveLength(0);
 await act(async()=>{await kept();});expect(mockSave).not.toHaveBeenCalled();expect(mockStart).not.toHaveBeenCalled();
});
it('an answer kept across a refocus starts nothing, and a fresh question still starts once',async()=>{
 await render();await askStart();const kept=sheets()[0].props.onConfirm;
 mockFocused=false;await update();expect(sheets()).toHaveLength(0);mockFocused=true;await update();
 await act(async()=>{await kept();});expect(mockSave).not.toHaveBeenCalled();expect(mockStart).not.toHaveBeenCalled();
 // A fresh question on the new review still works, once.
 await askStart();await act(async()=>confirmButton().props.onPress());expect(mockStart).toHaveBeenCalledTimes(1);
});
it('the question is retired when the flow loses focus',async()=>{
 await render();await askStart();expect(sheets()).toHaveLength(1);
 mockFocused=false;await update();expect(sheets()).toHaveLength(0);expect(mockStart).not.toHaveBeenCalled();
});
it('asks only once while a question is open',async()=>{
 await render();await askStart();await askStart();expect(sheets()).toHaveLength(1);
});
it.each([['ACTIVE_AGREEMENT','/dogovori'],['OPEN_TASK','/potrebe'],['ACTIVE_APPLICATION','/moje-prijave']])('a %s blocker leads to its place only while live',async(code,path)=>{
 mockReview.mockResolvedValue(ok({...ready(),ready:false,code:'CLOSURE_BLOCKED',blockers:[code,'PENDING_WORKFLOW'],retainedDatasets:null}));await render();
 expect(text()).toContain('Sačekaj završetak započete obrade.');expect(tree.root.findAll(n=>n.type===('SettingsRow' as React.ElementType)&&n.props.label==='Sačekaj završetak započete obrade.')).toHaveLength(0);
 const go=button(require('../../../data/closureExecutionClientService').closureBlockerLabels[code]).props.onPress;
 await act(async()=>{go();go();});expect(mockNavigate).toHaveBeenCalledWith(path);expect(mockNavigate).toHaveBeenCalledTimes(1);expect(mockClose).toHaveBeenCalledTimes(1);
 mockNavigate.mockClear();mockOwner={user:{id:A},accountRevision:3};await act(async()=>go());expect(mockNavigate).not.toHaveBeenCalled();
});
// Round 5 review: one look for "failed". An unconfirmed request waits for the person; a failed read is a failure.
it('an unconfirmed request is drawn as waiting, a failed read as failed',async()=>{
 mockLoad.mockResolvedValue(pending());await render();
 const note=()=>tree.root.findAllByType(InlineNote).find(n=>n.props.alert);
 expect(note()?.props).toMatchObject({tone:'warn',children:'Ovaj zahtev još nije potvrđen. Isti zahtev ostaje sačuvan; možeš ga izričito ponoviti.'});
 mockRead.mockResolvedValue({ok:false,kod:'X',poruka:'Stanje trenutno nije dostupno.'});
 await act(async()=>button('Proveri stanje zahteva').props.onPress());
 expect(note()?.props).toMatchObject({tone:'danger',children:'Stanje trenutno nije dostupno.'});
});
it('the flow\'s X is spoken as leaving the review, never as the closing itself',async()=>{
 await render();expect(tree.root.findAll(n=>n.props.label==='Zatvori pregled'&&typeof n.props.onPress==='function').length).toBeGreaterThan(0);
 expect(tree.root.findAll(n=>n.props.label==='Zatvori')).toHaveLength(0);
});
it('a read that fails before anything is known says so, with the check as its one way forward',async()=>{
 mockReview.mockResolvedValue({ok:false,kod:'X',poruka:'Pregled trenutno nije dostupan.'});await render();
 expect(text()).toContain('Stanje zatvaranja nije učitano');expect(text()).toContain('Pregled trenutno nije dostupan.');
 await act(async()=>button('Pokušaj ponovo').props.onPress());expect(mockReview).toHaveBeenCalledTimes(2);
});
// Round 5c review: the caught "not confirmed" words wait only while a saved start or preparation is there to check.
it('a command that could not be read waits while its saved request remains, and is a failure without one',async()=>{
 const note=()=>tree.root.findAllByType(InlineNote).find(n=>n.props.alert);
 const caught='Stanje zahteva nije potvrđeno. Sačuvani zahtev ostaje za proveru.';
 mockLoad.mockResolvedValue(pending());await render();
 mockRead.mockRejectedValue(new Error('lost'));
 await act(async()=>button('Pošalji zahtev za zatvaranje ponovo').props.onPress());
 expect(note()?.props).toMatchObject({tone:'warn',children:caught});expect(mockStart).not.toHaveBeenCalled();
 await act(async()=>tree.unmount());
 mockLoad.mockResolvedValue(null);mockSave.mockRejectedValue(new Error('unavailable'));await render();await askStart();
 await act(async()=>confirmButton().props.onPress());
 expect(note()?.props).toMatchObject({tone:'danger',children:caught});expect(mockStart).not.toHaveBeenCalled();
});
// UI/UX pass 2026-10-07 (team T4c): the consequence is the first thing said, the irreversible action is the last thing on the
// screen, and when it is not allowed it stands there grey with the reason beside it.
const orderOf=(labels:string[])=>[...new Set(tree.root.findAll(n=>labels.includes(n.props.label)).map(n=>n.props.label as string))];
it('the consequence is said first, with no sentence of orientation above it, and the irreversible action is the very last control',async()=>{
 await render();
 expect(text()).not.toContain('Pre pokretanja proveri obaveze');
 expect(text().indexOf('Pregled pre zatvaranja.')).toBeLessThan(text().indexOf('Posle pokretanja'));
 expect(text().indexOf('Posle pokretanja')).toBeLessThan(text().indexOf('Pokrenuto zatvaranje ne možeš otkazati iz aplikacije.'));
 expect(orderOf(['Izvoz podataka','Osveži pregled','Pokreni zatvaranje naloga'])).toEqual(['Izvoz podataka','Osveži pregled','Pokreni zatvaranje naloga']);
 // Allowed, so it is live (not grey), outlined in the danger colour, and it says no reason.
 const final=tree.root.findAll(n=>n.props.label==='Pokreni zatvaranje naloga'&&'disabled' in n.props)[0];
 expect(final.props.disabled).toBe(false);expect(final.props.kind).toBe('destructive');expect(final.props.reason).toBeUndefined();
 expect(tree.root.findAll(n=>n.props.label==='Proveri stanje zahteva')).toHaveLength(0);
});
it.each([
 ['CLOSURE_BLOCKED','Najpre reši obaveze navedene iznad.'],['CLOSURE_PREPARATION_REQUIRED','Najpre pripremi pregled.'],['CLOSURE_POLICY_NOT_READY','Zatvaranje trenutno nije dostupno.'],
])('when closing is not allowed (%s) the final action is last and grey and says why',async(code,reason)=>{
 mockReview.mockResolvedValue(ok({...ready(),ready:false,code,blockers:code==='CLOSURE_BLOCKED'?['OPEN_TASK']:[],retainedDatasets:null}));await render();
 const final=tree.root.findAll(n=>n.props.label==='Pokreni zatvaranje naloga'&&'reason' in n.props)[0];
 expect(final.props).toMatchObject({disabled:true,reason});
 // Last in the scrolled content (the pinned footer under it holds the check or the preparation).
 const labels=tree.root.findByType('ScrollView' as never).findAll(n=>typeof n.props.label==='string').map(n=>n.props.label as string);
 expect(labels[labels.length-1]).toBe('Pokreni zatvaranje naloga');
 await act(async()=>button('Pokreni zatvaranje naloga').props.onPress());expect(sheets()).toHaveLength(0);expect(mockStart).not.toHaveBeenCalled();
});
it('before anything is started the check is the review read again; once a request exists it checks the request',async()=>{
 mockReview.mockResolvedValue(ok({...ready(),ready:false,code:'CLOSURE_BLOCKED',blockers:['OPEN_TASK'],retainedDatasets:null}));await render();
 expect(button('Proveri ponovo')).toBeDefined();expect(tree.root.findAll(n=>n.props.label==='Proveri stanje zahteva')).toHaveLength(0);
 await act(async()=>tree.unmount());
 mockLoad.mockResolvedValue(pending());await render();
 expect(button('Proveri stanje zahteva')).toBeDefined();expect(tree.root.findAll(n=>n.props.label==='Osveži pregled'||n.props.label==='Proveri ponovo')).toHaveLength(0);
});
