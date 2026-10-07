import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { journalFor, type AgreementActionCommand } from '../../ui/agreements/agreementActionsModel';
import type { AgreementChangeSnapshot, AgreementChangeProposal } from '../agreementClientService';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const ID='20000000-0000-4000-8000-000000000001',PID='30000000-0000-4000-8000-000000000001',KEY='40000000-0000-4000-8000-000000000001';
let mockSession={user:{id:A},accountRevision:1},mockFocused=true,mockForeground='active';
const mockListeners=new Set<(value:string)=>void>(),mockStorage={getItem:jest.fn(),setItem:jest.fn(),removeItem:jest.fn()};
const mockService={read:jest.fn(),readCommand:jest.fn(),propose:jest.fn(),respond:jest.fn(),withdraw:jest.fn(),cancel:jest.fn()};
const mockUuid=jest.fn(),mockBack=jest.fn(),mockReplace=jest.fn();
jest.mock('../agreementClientService',()=>({...jest.requireActual('../agreementClientService'),agreementChangeService:{
 read:(...args:unknown[])=>mockService.read(...args),readCommand:(...args:unknown[])=>mockService.readCommand(...args),
 propose:(...args:unknown[])=>mockService.propose(...args),respond:(...args:unknown[])=>mockService.respond(...args),
 withdraw:(...args:unknown[])=>mockService.withdraw(...args),cancel:(...args:unknown[])=>mockService.cancel(...args)}}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({})}));
jest.mock('../../store/sesija',()=>({useSesija:()=>mockSession,sesijaSada:()=>mockSession}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=>mockUuid()}));
jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{
 getItem:(...args:unknown[])=>mockStorage.getItem(...args),setItem:(...args:unknown[])=>mockStorage.setItem(...args),removeItem:(...args:unknown[])=>mockStorage.removeItem(...args)}}));
jest.mock('expo-router',()=>({router:{canGoBack:()=>false,back:()=>mockBack(),replace:(...args:unknown[])=>mockReplace(...args)},
 useFocusEffect:(effect:()=>void)=>require('react').useEffect(()=>mockFocused?effect():undefined,[effect,mockFocused])}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(['View','TextInput','ScrollView','KeyboardAvoidingView'].includes(String(key)))return String(key);
 if(key==='AppState')return {get currentState(){return mockForeground;},addEventListener:(_event:string,listener:(value:string)=>void)=>{
  mockListeners.add(listener);return {remove:()=>mockListeners.delete(listener)};}};
 return Reflect.get(target,key);
}});});
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
jest.mock('../../ui/calendar/CalendarControls',()=>({CivilField:'CivilField'}));
import { AgreementActionsScreen } from '../../ui/agreements/AgreementActionsScreen';
const terms={priceRsd:3500,currency:'RSD' as const,scopeNote:'Važeći obim',startsAt:null,endsAt:null};
const proposal:AgreementChangeProposal={proposalId:PID,agreementId:ID,baseVersion:7,proposedBy:B,status:'PENDING',createdAt:'2026-09-13T10:00:00Z',
 reason:'Dodatni posao',respondedAt:null,respondedBy:null,termsAvailable:true,terms:{...terms,priceRsd:4000}};
const initial=():AgreementChangeSnapshot=>({agreementId:ID,agreementVersion:7,agreementStatus:'CONFIRMED',requesterAccountId:A,workerAccountId:B,counterpartName:'Bojan Petrović',terms,proposals:[],
 actions:{agreementId:ID,agreementVersion:7,accountId:A,authoritative:true,canProposeChange:true,canRespondChange:false,canWithdrawChange:false,canMarkWorkDone:false,canConfirmCompletion:false,canCancel:true}});
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'UNCONFIRMED',poruka:'Ishod nije potvrđen.'};
const stored=(status='PENDING',proposedBy=A)=>ok({found:true,proposalId:PID,agreementId:ID,baseVersion:7,proposedBy,status});
let tree:ReactTestRenderer,snapshot:AgreementChangeSnapshot;
const page=()=> <AgreementActionsScreen agreementId={ID}/>;
const render=async()=>{await act(async()=>{tree=create(page());});};
const action=(label:string)=>tree.root.findByProps({label}).props;
const tap=async(label:string)=>{await act(async()=>action(label).onPress());};
const type=async(label:string,value:string)=>{await act(async()=>tree.root.findByProps({accessibilityLabel:label}).props.onChangeText(value));};
// A cancellation's reason is chosen from chips (plan 2.3); "Drugo" opens the field for the person's own words.
const chip=async(label:string)=>{await act(async()=>tree.root.findByProps({accessibilityLabel:label,accessibilityRole:'radio'}).props.onPress());};
const reason=async(words:string)=>{await chip('Drugo');await type('Razlog otkazivanja Dogovora',words);};
const text=()=>JSON.stringify(tree.toJSON());
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
beforeEach(()=>{
 jest.clearAllMocks();for(const group of [mockService,mockStorage])for(const fn of Object.values(group))fn.mockReset();
 mockSession={user:{id:A},accountRevision:1};mockFocused=true;mockForeground='active';snapshot=initial();mockUuid.mockReturnValue(KEY);
 mockStorage.getItem.mockResolvedValue(null);mockStorage.setItem.mockResolvedValue(undefined);mockStorage.removeItem.mockResolvedValue(undefined);
 mockService.read.mockImplementation(()=>Promise.resolve(ok(snapshot)));mockService.readCommand.mockResolvedValue(ok({found:false}));
 for(const name of ['propose','respond','withdraw','cancel'] as const)mockService[name].mockResolvedValue(unknown);
});
afterEach(async()=>{await act(async()=>tree?.unmount());mockListeners.clear();});
it('shows current accepted terms and offers existing authoritative actions without any write on entry',async()=>{
 await render();expect(text()).toContain('Važeći obim');expect(action('Predloži izmenu')).toBeDefined();expect(action('Otkaži Dogovor')).toBeDefined();
 expect(mockService.propose).not.toHaveBeenCalled();expect(mockService.cancel).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it('reviews actual entered terms and reason once, persists opaque metadata and deduplicates retained final taps',async()=>{
 await render();await tap('Predloži izmenu');await type('Predložena cena u RSD','4200');
 await type('Predloženi obim zadatka','');
 expect(tree.root.findByProps({accessibilityLabel:'Predloženi obim zadatka'}).props.value).toBe('');
 await type('Predloženi obim zadatka','Novi privatni obim');
 await type('Razlog predloga — opciono','Privatan razlog');await tap('Pregledaj predlog');
 expect(text()).toContain('Novi privatni obim');expect(text()).toContain('Uslovi se menjaju tek');expect(mockService.propose).not.toHaveBeenCalled();
 const gate=deferred<void>();mockStorage.setItem.mockReturnValue(gate.promise);const send=action('Pošalji predlog izmene').onPress;
 await act(async()=>{send();send();});expect(mockService.propose).not.toHaveBeenCalled();
 const raw=mockStorage.setItem.mock.calls[0][1];expect(raw).not.toMatch(/Novi privatni|Privatan razlog|4200/);
 await act(async()=>gate.resolve());expect(mockService.propose).toHaveBeenCalledTimes(1);
 expect(mockService.propose).toHaveBeenCalledWith({dogovorId:ID,ocekivanaVerzija:7,clientRequestId:KEY,izmena:{cenaIznos:4200,cenaValuta:'RSD',obim:'Novi privatni obim'},razlog:'Privatan razlog'},mockSessionAccount());
 expect(action('Proveri ishod radnje')).toBeDefined();expect(mockService.readCommand).toHaveBeenCalledTimes(1);
});
const mockSessionAccount=()=>({accountId:A,accountRevision:1});
it('requires a positive bounded price and a real change before review',async()=>{
 snapshot={...snapshot,terms:{...terms,scopeNote:''}};
 await render();await tap('Predloži izmenu');
 expect(tree.root.findAllByProps({accessibilityLabel:'Predloženi obim zadatka'})).toHaveLength(0);
 await tap('Dodaj opis obima zadatka');
 await type('Predloženi obim zadatka','Privremeni opis');await type('Predloženi obim zadatka','');
 expect(tree.root.findByProps({accessibilityLabel:'Predloženi obim zadatka'}).props.value).toBe('');
 await tap('Pregledaj predlog');expect(text()).toContain('Izmeni bar jedan');
 await type('Predložena cena u RSD','-5');await tap('Pregledaj predlog');expect(text()).toContain('pozitivan ceo iznos');
 expect(mockService.propose).not.toHaveBeenCalled();expect(tree.root.findAllByProps({label:'Pošalji predlog izmene'})).toHaveLength(0);
});
it('preserves accepted microsecond precision of an endpoint that was not edited',async()=>{
 snapshot={...snapshot,terms:{...terms,startsAt:'2026-09-15T10:00:00.123456Z',endsAt:'2026-09-15T15:00:00.654321Z'}};
 await render();await tap('Predloži izmenu');
 await act(async()=>tree.root.findByProps({label:'Vreme početka'}).props.onChange('10:30'));
 await tap('Pregledaj predlog');await tap('Pošalji predlog izmene');
 expect(mockService.propose).toHaveBeenCalledTimes(1);expect(mockService.propose.mock.calls[0][0].izmena.krajIso).toBe('2026-09-15T15:00:00.654321Z');
});
it('retires the final callback immediately after canceling its review, including same-turn retained invocation',async()=>{
 await render();await tap('Otkaži Dogovor');await reason('Privatan razlog');await tap('Pregledaj otkazivanje');
 const old=action('Otkaži Dogovor').onPress,cancel=action('Odustani od radnje').onPress;
 await act(async()=>{cancel();old();});expect(mockService.cancel).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it('cancel reason is required and a transport ACK remains unknown until canonical CANCELLED',async()=>{
 snapshot={...snapshot,title:'Prenos ormara',terms:{...terms,startsAt:'2026-10-15T10:00:00Z',endsAt:'2026-10-15T12:00:00Z'}};
 await render();await tap('Otkaži Dogovor');
 // Until a reason is chosen the decision is grey and says why; a press that gets through anyway still asks for one.
 expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:true,reason:'Izaberi razlog.'});
 await tap('Pregledaj otkazivanje');expect(text()).toContain('Unesi razlog otkazivanja');
 await chip('Rešeno je drugačije');expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:false,reason:null});
 await tap('Pregledaj otkazivanje');expect(text()).toContain('precizna lokacija se opozivaju');
 expect(text()).toContain('Prenos ormara');expect(text()).toContain('Sa kim: Bojan Petrović');expect(text()).toContain('Rešeno je drugačije');
 expect(text()).toContain('12:00–14:00');expect(mockService.cancel).not.toHaveBeenCalled();
 mockService.cancel.mockResolvedValue(ok({acknowledged:true}));await tap('Otkaži Dogovor');expect(action('Proveri ishod radnje')).toBeDefined();
 expect(mockService.cancel).toHaveBeenCalledWith(ID,'Rešeno je drugačije',mockSessionAccount());
 expect(text()).not.toContain('Dogovor je otkazan.');snapshot={...snapshot,agreementStatus:'CANCELLED'};
 await tap('Proveri ishod radnje');expect(text()).toContain('Dogovor je otkazan.');expect(mockService.cancel).toHaveBeenCalledTimes(1);
});
it.each([true,false])('reviews the exact other-party proposal before accepting=%s and confirms its immutable persisted status',async accept=>{
 snapshot={...snapshot,proposals:[proposal],actions:{...snapshot.actions,canProposeChange:false,canRespondChange:true}};
 await render();await tap(accept?'Prihvati izmenu':'Odbij predlog');expect(text()).toContain('Dodatni posao');
 expect(mockService.respond).not.toHaveBeenCalled();mockService.readCommand.mockResolvedValue(stored(accept?'ACCEPTED':'REJECTED',B));
 await tap(accept?'Prihvati izmenu':'Odbij predlog');expect(mockService.respond).toHaveBeenCalledWith(proposal,accept,mockSessionAccount());
 expect(action('Prikaži aktuelni Dogovor')).toBeDefined();
});
it('withdraws only the author’s pending proposal through its existing writer',async()=>{
 const own={...proposal,proposedBy:A};snapshot={...snapshot,proposals:[own],actions:{...snapshot.actions,canProposeChange:false,canWithdrawChange:true}};
 await render();await tap('Povuci predlog');mockService.readCommand.mockResolvedValue(stored('WITHDRAWN'));
 await tap('Povuci predlog');expect(mockService.withdraw).toHaveBeenCalledWith(PID,mockSessionAccount());expect(text()).toContain('Predlog izmene je povučen.');
});
it('hides unauthorized actions and keeps acceptance unavailable when terms cannot be reviewed',async()=>{
 snapshot={...snapshot,terms:null,proposals:[{...proposal,terms:null,termsAvailable:false}],actions:{...snapshot.actions,canProposeChange:false,canCancel:false,canRespondChange:true}};
 await render();expect(tree.root.findAllByProps({label:'Predloži izmenu'})).toHaveLength(0);expect(tree.root.findAllByProps({label:'Otkaži Dogovor'})).toHaveLength(0);
 expect(action('Prihvati izmenu').disabled).toBe(true);
});
it('restores unknown proposal read-only and demands exact body re-entry under the old key without generating another key',async()=>{
 const original:AgreementActionCommand={kind:'PROPOSE',value:{dogovorId:ID,ocekivanaVerzija:7,clientRequestId:KEY,izmena:{cenaIznos:4200},razlog:'Isti razlog'}};
 mockStorage.getItem.mockResolvedValue(JSON.stringify(journalFor(original)));await render();expect(mockService.propose).not.toHaveBeenCalled();
 await tap('Ponovo unesi predlog');expect(mockUuid).not.toHaveBeenCalled();await type('Predložena cena u RSD','4300');await type('Razlog predloga — opciono','Isti razlog');
 await tap('Pregledaj predlog');expect(text()).toContain('razlikuje od prvobitnog');expect(mockStorage.setItem).not.toHaveBeenCalled();
 await type('Predložena cena u RSD','4200');await tap('Pregledaj predlog');await tap('Pošalji predlog izmene');
 expect(mockService.propose.mock.calls[0][0].clientRequestId).toBe(KEY);expect(mockUuid).not.toHaveBeenCalled();
});
it.each(['blur','account','background'])('blocks a late %s response and retained final callback from updating another scope',async change=>{
 await render();await tap('Otkaži Dogovor');await reason('Razlog');await tap('Pregledaj otkazivanje');
 const gate=deferred<unknown>();mockService.cancel.mockReturnValue(gate.promise);const old=action('Otkaži Dogovor').onPress;
 await act(async()=>old());
 await act(async()=>{if(change==='blur')mockFocused=false;else if(change==='account')mockSession={user:{id:B},accountRevision:2};else {mockForeground='background';mockListeners.forEach(fn=>fn('background'));}tree.update(page());});
 const reads=mockService.read.mock.calls.length;await act(async()=>{gate.resolve(ok({acknowledged:true}));old();});
 expect(mockService.cancel).toHaveBeenCalledTimes(1);expect(mockService.read).toHaveBeenCalledTimes(reads);expect(mockStorage.removeItem).not.toHaveBeenCalled();
});
it('uses whole-screen keyboard avoidance and a scroll container, and has a deterministic back fallback',async()=>{
 await render();expect(tree.root.findAllByType('KeyboardAvoidingView' as never)).toHaveLength(1);expect(tree.root.findAllByType('ScrollView' as never)).toHaveLength(1);
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Nazad'}).props.onPress());expect(mockReplace).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID}});
});
it('the hub has one green action: the other side\'s proposal when it waits, else proposing; a changed value says what it replaces',async()=>{
 const green=(label:string)=>action(label).style?.backgroundColor===require('../../ui/system/tokens').sys.color.green;
 await render();expect(green('Predloži izmenu')).toBe(true);await act(async()=>tree.unmount());
 snapshot={...snapshot,proposals:[proposal],actions:{...snapshot.actions,canRespondChange:true}};await render();
 expect(green('Prihvati izmenu')).toBe(true);expect(green('Predloži izmenu')).toBe(false);
 expect(text()).toContain('4.000 RSD');expect(text()).toContain('umesto 3.500 RSD');expect(text()).toContain('bez promene');
 // The proposal is headed by the person who made it, from the same reply the Dogovor already names them in (round 6).
 expect(text()).toContain('Bojan Petrović predlaže');expect(text()).not.toContain('Predlog druge strane');
});
it('form and review are two steps of one flow whose X leaves the step without any write',async()=>{
 await render();await tap('Otkaži Dogovor');expect(text()).toContain('Korak 1 od 2');
 // The step's one action is pinned in the flow's foot under the scroll, never at the end of the form (round 6, scene 11).
 expect(tree.root.findByType('ScrollView' as never).findAllByProps({label:'Pregledaj otkazivanje'})).toHaveLength(0);
 expect(tree.root.findByProps({testID:'flow-footer'}).findAllByProps({label:'Pregledaj otkazivanje'}).length).toBeGreaterThan(0);
 await tap('Odustani od unosa');expect(action('Predloži izmenu')).toBeDefined();
 await tap('Otkaži Dogovor');await reason('Razlog');await tap('Pregledaj otkazivanje');expect(text()).toContain('Korak 2 od 2');
 expect(text()).toContain('Dogovor se završava otkazivanjem. Deljeni kontakt i precizna lokacija se opozivaju. Radnja sama ne određuje krivicu ili dug.');
 expect(action('Otkaži Dogovor').kind).toBe('destructive');
 expect(text()).toContain('Naziv Dogovora nije dostupan');expect(text()).toContain('Termin nije potvrđen');
 await tap('Odustani od radnje');expect(mockService.cancel).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();expect(action('Otkaži Dogovor')).toBeDefined();
});
it('the system Back closes a step of the flow like its X, and leaves the screen only from the hub',async()=>{
 const {BackHandler}=require('react-native');const handlers:(()=>boolean)[]=[];
 const spy=jest.spyOn(BackHandler,'addEventListener').mockImplementation(((_:string,fn:()=>boolean)=>{handlers.push(fn);return {remove:()=>handlers.splice(handlers.indexOf(fn),1)};}) as never);
 try{
  await render();expect(handlers).toHaveLength(1);await tap('Otkaži Dogovor');await reason('Razlog');
  expect(handlers).toHaveLength(1);let handled=false;await act(async()=>{handled=handlers[0]();});expect(handled).toBe(true);
  expect(action('Otkaži Dogovor')).toBeDefined();expect(handlers).toHaveLength(1);expect(mockService.cancel).not.toHaveBeenCalled();expect(mockReplace).not.toHaveBeenCalled();
  await act(async()=>{handled=handlers[0]();});expect(handled).toBe(true);expect(mockReplace).toHaveBeenCalledTimes(1);
 }finally{spy.mockRestore();}
});
it('after a failed refresh with terms on screen, the refresh stays offered in the bar',async()=>{
 await render();mockService.read.mockResolvedValue({ok:false,kod:'UNAVAILABLE',poruka:'Proveri vezu.'});
 await tap('Osveži uslove Dogovora');expect(text()).toContain('Proveri vezu.');expect(action('Osveži uslove Dogovora').disabled).toBe(false);
});
it.each(['PROPOSE','CANCEL'] as const)('Back retires an unstarted %s retry before blur while keeping its journal for read-only return',async kind=>{
 await render();
 if(kind==='PROPOSE'){
  await tap('Predloži izmenu');await type('Predložena cena u RSD','4200');await tap('Pregledaj predlog');await tap('Pošalji predlog izmene');
 }else{
  await tap('Otkaži Dogovor');await reason('Razlog');await tap('Pregledaj otkazivanje');await tap('Otkaži Dogovor');
 }
 const writer=kind==='PROPOSE'?mockService.propose:mockService.cancel;
 expect(writer).toHaveBeenCalledTimes(1);
 const gate=deferred<void>();mockStorage.setItem.mockReturnValue(gate.promise);
 const retry=action(kind==='PROPOSE'?'Ponovo pošalji predlog':'Ponovo otkaži Dogovor').onPress;
 await act(async()=>retry());
 const back=tree.root.findByProps({accessibilityLabel:'Nazad'}).props.onPress;
 try{
  await act(async()=>{back();back();});
  await act(async()=>gate.resolve());
  expect(writer).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockService.read).toHaveBeenCalledTimes(2);
  expect(mockStorage.removeItem).not.toHaveBeenCalled();
  mockStorage.getItem.mockResolvedValue(mockStorage.setItem.mock.calls[1][1]);
  await act(async()=>{mockFocused=false;tree.update(page());});
  await act(async()=>{mockFocused=true;tree.update(page());});
  await act(async()=>retry());
  expect(writer).toHaveBeenCalledTimes(1);
  expect(action(kind==='PROPOSE'?'Ponovo unesi predlog':'Ponovo unesi otkazivanje')).toBeDefined();
  expect(mockStorage.removeItem).not.toHaveBeenCalled();
 }finally{await act(async()=>gate.resolve());}
});
it('foreground notifications in the Back-to-blur gap do not reopen the retired changes screen',async()=>{
 await render();const back=tree.root.findByProps({accessibilityLabel:'Nazad'}).props.onPress;
 await act(async()=>back());
 await act(async()=>{mockForeground='background';mockListeners.forEach(fn=>fn('background'));});
 await act(async()=>{mockForeground='active';mockListeners.forEach(fn=>fn('active'));});
 expect(mockService.read).toHaveBeenCalledTimes(1);
 await act(async()=>back());expect(mockReplace).toHaveBeenCalledTimes(1);
});
it('Android hub Back consumes repeated exit presses and retires a pending retry before its writer starts',async()=>{
 const {BackHandler}=require('react-native');const handlers:(()=>boolean)[]=[];
 const spy=jest.spyOn(BackHandler,'addEventListener').mockImplementation(((_:string,fn:()=>boolean)=>{handlers.push(fn);return {remove:()=>handlers.splice(handlers.indexOf(fn),1)};}) as never);
 const gate=deferred<void>();
 try{
  await render();await tap('Otkaži Dogovor');await reason('Razlog');await tap('Pregledaj otkazivanje');await tap('Otkaži Dogovor');
  mockStorage.setItem.mockReturnValue(gate.promise);await tap('Ponovo otkaži Dogovor');
  expect(handlers).toHaveLength(1);
  let first=false,second=false;await act(async()=>{first=handlers[0]();second=handlers[0]();});
  expect(first).toBe(true);expect(second).toBe(true);expect(mockReplace).toHaveBeenCalledTimes(1);
  await act(async()=>gate.resolve());
  expect(mockService.cancel).toHaveBeenCalledTimes(1);expect(mockService.read).toHaveBeenCalledTimes(2);
  expect(mockStorage.removeItem).not.toHaveBeenCalled();
 }finally{await act(async()=>gate.resolve());spy.mockRestore();}
});

// Plan 2.6 / 2.3: the reasons for cancelling are chips, a price that was never saved is said in words, and the menu of the Dogovor
// opens the form it names.
describe('the reasons for cancelling a Dogovor are chips',()=>{
 // (`deep: false`: a Press is several nodes carrying the same props; the outermost one is the chip.)
 const chips=()=>tree.root.findAllByProps({accessibilityRole:'radio'},{deep:false}).map(node=>[node.props.accessibilityLabel,node.props.accessibilityState.checked]);
 const field=()=>tree.root.findAllByProps({accessibilityLabel:'Razlog otkazivanja Dogovora'});
 it('offers five reasons and "Drugo", with no field until the person asks for one',async()=>{
  await render();await tap('Otkaži Dogovor');
  expect(chips()).toEqual([['Promenio se termin',false],['Zadatak više nije potreban',false],['Rešeno je drugačije',false],['Ne mogu da ispoštujem dogovor',false],
   ['Druga strana se ne javlja',false],['Drugo',false]]);
  expect(field()).toHaveLength(0);
  expect(chips().every(([label])=>!/posao|poslu|posla/i.test(String(label)))).toBe(true);
 });
 it('makes a chip the reason, and the review and the command carry exactly its words',async()=>{
  await render();await tap('Otkaži Dogovor');
  await chip('Promenio se termin');
  expect(chips().filter(([,checked])=>checked)).toEqual([['Promenio se termin',true]]);expect(field()).toHaveLength(0);
  await tap('Pregledaj otkazivanje');expect(text()).toContain('Promenio se termin');
  mockService.cancel.mockResolvedValue(ok({acknowledged:true}));await tap('Otkaži Dogovor');
  expect(mockService.cancel).toHaveBeenCalledWith(ID,'Promenio se termin',mockSessionAccount());
 });
 it('opens the field on "Drugo", takes the person\'s own words, and goes back to a chip without keeping them',async()=>{
  await render();await tap('Otkaži Dogovor');
  await chip('Drugo');expect(field()).toHaveLength(1);expect(chips().filter(([,checked])=>checked)).toEqual([['Drugo',true]]);
  expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:true,reason:'Izaberi razlog.'});
  await type('Razlog otkazivanja Dogovora','Moj razlog');expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:false,reason:null});
  await chip('Rešeno je drugačije');expect(field()).toHaveLength(0);expect(chips().filter(([,checked])=>checked)).toEqual([['Rešeno je drugačije',true]]);
  await tap('Pregledaj otkazivanje');expect(text()).toContain('Rešeno je drugačije');expect(text()).not.toContain('Moj razlog');
 });
 it('clears the reason when "Drugo" is chosen over a chip, so the decision is grey again until the person writes one',async()=>{
  await render();await tap('Otkaži Dogovor');
  await chip('Druga strana se ne javlja');expect(action('Pregledaj otkazivanje').disabled).toBe(false);
  await chip('Drugo');expect(field()).toHaveLength(1);expect(tree.root.findByProps({accessibilityLabel:'Razlog otkazivanja Dogovora'}).props.value).toBe('');
  expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:true,reason:'Izaberi razlog.'});
 });
 it('starts every form from nothing chosen',async()=>{
  await render();await tap('Otkaži Dogovor');await chip('Promenio se termin');await tap('Odustani od unosa');
  await tap('Otkaži Dogovor');expect(chips().every(([,checked])=>checked===false)).toBe(true);
  expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:true,reason:'Izaberi razlog.'});
 });
 it('keeps the plain field when the very same request has to be entered again, since its words must match the first attempt',async()=>{
  const original:AgreementActionCommand={kind:'CANCEL',agreementId:ID,version:7,reason:'Isti razlog'};
  mockStorage.getItem.mockResolvedValue(JSON.stringify(journalFor(original)));await render();
  await tap('Ponovo unesi otkazivanje');
  expect(chips()).toEqual([]);expect(field()).toHaveLength(1);
  expect(action('Pregledaj otkazivanje')).toMatchObject({disabled:true,reason:'Unesi razlog.'});
  await type('Razlog otkazivanja Dogovora','Isti razlog');await tap('Pregledaj otkazivanje');expect(text()).toContain('Korak 2 od 2');
 });
 it('does not turn a proposal\'s optional reason into chips',async()=>{
  await render();await tap('Predloži izmenu');
  expect(chips()).toEqual([]);expect(tree.root.findAllByProps({accessibilityLabel:'Razlog predloga — opciono'})).toHaveLength(1);
  expect(action('Pregledaj predlog').disabled).toBe(false);
 });
});

describe('a price that was never saved is said in words',()=>{
 const noAmount=/(^|[^\d.])0 RSD/;
 it('in the terms in force, and in a proposal that would replace it',async()=>{
  snapshot={...snapshot,terms:{...terms,priceRsd:0},proposals:[proposal],actions:{...snapshot.actions,canRespondChange:true}};
  await render();
  expect(text()).toContain('Iznos nije sačuvan');expect(text()).not.toMatch(noAmount);
  expect(text()).toContain('4.000 RSD');expect(text()).toContain('umesto Iznos nije sačuvan');
 });
 it('in the form, under the field, and in the review',async()=>{
  snapshot={...snapshot,terms:{...terms,priceRsd:0}};
  await render();await tap('Predloži izmenu');await type('Predložena cena u RSD','4200');
  expect(tree.root.findAllByType('T' as never).some(node=>node.children.join('')==='umesto Iznos nije sačuvan')).toBe(true);expect(text()).not.toMatch(noAmount);
  await tap('Pregledaj predlog');expect(text()).toContain('4.200 RSD');expect(text()).toContain('umesto Iznos nije sačuvan');expect(text()).not.toMatch(noAmount);
 });
 it('and never in the amount\'s style: a word is not drawn as a figure',async()=>{
  snapshot={...snapshot,terms:{...terms,priceRsd:0}};
  await render();
  const money=tree.root.findAll(node=>typeof node.type==='string'&&node.props.accessibilityLabel==='Cena: Iznos nije sačuvan');
  expect(money.length).toBeGreaterThan(0);
  const words=money[0].findAllByType('T' as never).find(node=>node.props.children==='Iznos nije sačuvan')!;
  expect(words.props.variant).toBe('body');
 });
 it('while a real price keeps the amount\'s own weight',async()=>{
  await render();
  const money=tree.root.findAll(node=>typeof node.type==='string'&&node.props.accessibilityLabel==='Cena: 3.500 RSD');
  expect(money.length).toBeGreaterThan(0);
  expect(money[0].findAllByType('T' as never).find(node=>node.props.children==='3.500 RSD')!.props.variant).toBe('bodyStrong');
 });
});

describe('arriving from the Dogovor\'s menu',()=>{
 const arrive=async(start?:'PROPOSE'|'CANCEL')=>{await act(async()=>{tree=create(<AgreementActionsScreen agreementId={ID} start={start}/>);});};
 it('opens the cancellation form once the terms have been read, and sends nothing',async()=>{
  await arrive('CANCEL');
  expect(text()).toContain('Korak 1 od 2');expect(text()).toContain('Razlog otkazivanja Dogovora');expect(tree.root.findAllByProps({accessibilityRole:'radio'}).length).toBeGreaterThan(0);
  expect(mockService.cancel).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
 });
 it('opens the proposal form for "Izmeni uslove"',async()=>{
  await arrive('PROPOSE');
  expect(text()).toContain('Korak 1 od 2');expect(tree.root.findAllByProps({accessibilityLabel:'Predložena cena u RSD'})).toHaveLength(1);
 });
 it('leaves the form when the person closes it, and does not open it again',async()=>{
  await arrive('CANCEL');await tap('Odustani od unosa');
  expect(action('Predloži izmenu')).toBeDefined();expect(text()).not.toContain('Korak 1 od 2');
  await act(async()=>{tree.update(<AgreementActionsScreen agreementId={ID} start="CANCEL"/>);});
  expect(text()).not.toContain('Korak 1 od 2');
 });
 it('opens the hub, not a form, when the command is not permitted or no form is named',async()=>{
  snapshot={...snapshot,actions:{...snapshot.actions,canCancel:false}};
  await arrive('CANCEL');expect(text()).not.toContain('Korak 1 od 2');expect(action('Predloži izmenu')).toBeDefined();
  await act(async()=>tree.unmount());snapshot=initial();
  await arrive();expect(text()).not.toContain('Korak 1 od 2');expect(action('Otkaži Dogovor')).toBeDefined();
 });
});

describe('"Prikaži aktuelni Dogovor" shows the Dogovor (it used to show this hub again)',()=>{
 const respondAndConfirm=async()=>{
  snapshot={...snapshot,proposals:[proposal],actions:{...snapshot.actions,canProposeChange:false,canRespondChange:true}};
  await render();await tap('Prihvati izmenu');mockService.readCommand.mockResolvedValue(stored('ACCEPTED',B));await tap('Prihvati izmenu');
  expect(action('Prikaži aktuelni Dogovor')).toBeDefined();
 };
 it('retires the journal, reads the terms once more and goes back to the Dogovor',async()=>{
  await respondAndConfirm();
  const reads=mockService.read.mock.calls.length;
  await tap('Prikaži aktuelni Dogovor');
  expect(mockStorage.removeItem).toHaveBeenCalledTimes(1);expect(mockService.read.mock.calls.length).toBe(reads+1);
  expect(mockReplace).toHaveBeenCalledTimes(1);expect(mockReplace).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID}});
 });
 it('stays, with the reason on screen, when the terms cannot be read after the outcome is acknowledged',async()=>{
  await respondAndConfirm();
  mockService.read.mockResolvedValue({ok:false,kod:'UNAVAILABLE',poruka:'Proveri vezu.'});
  await tap('Prikaži aktuelni Dogovor');
  expect(mockReplace).not.toHaveBeenCalled();expect(text()).toContain('Proveri vezu.');
 });
 it('is pressed once: a second press while the first one is reading starts nothing more',async()=>{
  await respondAndConfirm();
  const press=action('Prikaži aktuelni Dogovor').onPress;
  await act(async()=>{press();press();});
  expect(mockStorage.removeItem).toHaveBeenCalledTimes(1);expect(mockReplace).toHaveBeenCalledTimes(1);
 });
});
