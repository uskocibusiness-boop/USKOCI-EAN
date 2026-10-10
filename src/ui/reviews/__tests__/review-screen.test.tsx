import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd', K='cccccccc-cccc-4ccc-8ccc-cccccccccccc', R='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
let mockAccount: string | null=A, mockRevision=1, mockFocused=true, mockAgreementId: string | string[]=D;
let mockFrom: string | undefined;
const mockContext=jest.fn(), mockSubmit=jest.fn(), mockReputation=jest.fn(), mockAgreement=jest.fn();
const mockListeners=new Set<(state:string)=>void>();
const mockRouter={back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(()=>true)};
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(key==='AppState')return{currentState:'active',addEventListener:(_:string,fn:(state:string)=>void)=>{mockListeners.add(fn);return{remove:()=>mockListeners.delete(fn)};}};
 return ['View','ScrollView','ActivityIndicator'].includes(String(key))?key:Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},useLocalSearchParams:()=>({agreementId:mockAgreementId,from:mockFrom}),
 useFocusEffect:(fn:()=>void)=>require('react').useEffect(()=>mockFocused?fn():undefined,[fn,mockFocused])}));
jest.mock('../../../store/sesija',()=>({useSesija:()=>({user:mockAccount?{id:mockAccount}:null,accountRevision:mockRevision}),
 sesijaSada:()=>({user:mockAccount?{id:mockAccount}:null,accountRevision:mockRevision})}));
jest.mock('../../../lib/idempotencija',()=>({noviUuidZahtevId:()=> 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));
jest.mock('../../../data/supabaseClient',()=>({supabaseKlijent:()=>{throw new Error('Unexpected direct RPC in review presentation test');}}));
jest.mock('../../Text',()=>({T:'T'}));
// The route reads the Dogovor only to show whom the rating is about, through the port; its photo is the route's.
jest.mock('../../../store/uloga',()=>({useIzvor:()=>({dogovor:(...args:unknown[])=>mockAgreement(...args)})}));
jest.mock('../../media/ContextPhotos',()=>({ProfilePhoto:'ProfilePhoto'}));
jest.mock('../../Press',()=>({Press:'Press'}));
jest.mock('../../v2/icons',()=>({V2Icon:'V2Icon'}));
jest.mock('../../../data/reviewsClientService',()=>({
 ...jest.requireActual('../../../data/reviewsClientService'),
 reviewsClientService:{context:(...args:unknown[])=>mockContext(...args),submit:(...args:unknown[])=>mockSubmit(...args),
 reputation:(...args:unknown[])=>mockReputation(...args)}
}));
import ReviewRoute from '../../../app/(app)/oceni-dogovor';
import { AccountReputation, ReputationFigure } from '../AccountReputation';
import { REVIEW_TAGS } from '../../../data/reviewsClientService';
import { sys } from '../../system/tokens';
const context=()=>({accountId:A,agreementId:D,targetAccountId:B,eligible:true,review:null,
 tagCatalog:{version:'PRE_V3_REVIEW_TAGS_V1',maxTags:3,tags:[...REVIEW_TAGS]},authoritative:true});
const receipt=(command:Record<string,unknown>)=>({...command,reviewId:R,reviewerAccountId:A,createdAt:'2026-09-12T10:00:00Z',idempotentReplay:false,authoritative:true});
let tree:ReactTestRenderer;
const texts=()=>tree.root.findAll(node=>String(node.type)==='T').flatMap(node=>node.children.filter(x=>typeof x==='string')).join(' ');
const button=(label:string)=>tree.root.findByProps({accessibilityLabel:label});
const click=(label:string)=>act(()=>button(label).props.onPress());
const settle=async()=>{await act(async()=>{});};
async function render(){await act(async()=>{tree=create(<ReviewRoute/>);});}
const person=(id:string,viSte:boolean,ime:string,uloga:'narucilac'|'uskocer')=>({id,profilId:null,ime,inicijali:ime.slice(0,1),uloga,mesta:null,viSte,telefon:null});
beforeEach(()=>{jest.clearAllMocks();mockAccount=A;mockRevision=1;mockFocused=true;mockAgreementId=D;mockFrom=undefined;
 mockAgreement.mockReset().mockResolvedValue({id:D,naslov:'"Unos ormara"',ucesnici:[person(A,true,'Ja Sam','uskocer'),person(B,false,'Nikola Petrović','narucilac')]});
 mockContext.mockReset().mockResolvedValue({ok:true,podatak:context()});mockSubmit.mockReset();mockReputation.mockReset();
 mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async()=>{await act(async()=>tree?.unmount());});

it('loads the server target/catalog without submitting and requires an explicit 1–5 selection',async()=>{
 await render();expect(mockContext).toHaveBeenCalledWith(D,{accountId:A,accountRevision:1});
 expect(mockSubmit).not.toHaveBeenCalled();expect(button('Sačuvaj ocenu').props.disabled).toBe(true);
 expect(tree.root.findAllByProps({accessibilityRole:'radio'})).toHaveLength(5);
 expect(tree.root.findAllByProps({accessibilityRole:'checkbox'})).toHaveLength(6);
 expect(tree.root.findAll(node=>String(node.type)==='TextInput')).toHaveLength(0);
 click('Ocena 4 od 5');expect(button('Sačuvaj ocenu').props.disabled).toBe(false);
 click('Po dogovoru');click('Pažljivo');click('Na vreme');expect(button('Pouzdano').props.disabled).toBe(true);
});
it('double tap sends one immutable command and only matching server readback shows success',async()=>{
 let finish!:(x:unknown)=>void;mockSubmit.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await render();click('Ocena 5 od 5');click('Pouzdano');const submit=button('Sačuvaj ocenu').props.onPress;
 act(()=>{submit();submit();});expect(mockSubmit).toHaveBeenCalledTimes(1);expect(texts()).not.toContain('Ocena je sačuvana');
 const command=mockSubmit.mock.calls[0][0];expect(command).toEqual({agreementId:D,targetAccountId:B,rating:5,tags:['RELIABLE'],clientRequestId:K});
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false,review:receipt(command)}});
 await act(async()=>finish({ok:true,podatak:receipt(command)}));expect(texts()).toContain('Ocena je sačuvana');
 expect(texts()).toContain('5');expect(mockRouter.back).not.toHaveBeenCalled();
});
it('unknown outcome freezes selection, requires readback, and retries exactly the original command',async()=>{
 mockSubmit.mockResolvedValue({ok:false,kod:'REVIEW_OUTCOME_UNKNOWN',poruka:'Proveri sačuvanu ocenu.'});
 await render();click('Ocena 3 od 5');const staleRating=button('Ocena 1 od 5').props.onPress;
 const staleSave=button('Sačuvaj ocenu').props.onPress;click('Sačuvaj ocenu');await settle();
 act(()=>{staleRating();staleSave();});expect(mockSubmit).toHaveBeenCalledTimes(1);
 expect(button('Ocena 3 od 5').props.accessibilityState.checked).toBe(true);
 click('Proveri sačuvanu ocenu');await settle();act(()=>staleSave());expect(mockSubmit).toHaveBeenCalledTimes(1);
 click('Sačuvaj ocenu ponovo');await settle();expect(mockSubmit).toHaveBeenCalledTimes(2);
 expect(mockSubmit.mock.calls[1]).toEqual(mockSubmit.mock.calls[0]);
});
it('lost acknowledgement resolves from own stored review without another write',async()=>{
 mockSubmit.mockResolvedValue({ok:false,kod:'REVIEW_OUTCOME_UNKNOWN',poruka:'Proveri sačuvanu ocenu.'});
 await render();click('Ocena 4 od 5');click('Sačuvaj ocenu');await settle();
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false,review:receipt(mockSubmit.mock.calls[0][0])}});
 click('Proveri sačuvanu ocenu');await settle();expect(texts()).toContain('Ocena je sačuvana');expect(mockSubmit).toHaveBeenCalledTimes(1);
});
// Round 2c (verifier vf, must 1): Početna opens the rating directly, and its button said "Nazad na Dogovor" while Back
// returned to Početna. The route now names the screen it came from, and Back goes there even with no history.
it('names the way back after the screen it was opened from, and goes there',async()=>{
 const receipted=()=>({ok:true,podatak:{...context(),eligible:false,review:receipt({agreementId:D,targetAccountId:B,rating:5,tags:[],clientRequestId:K})}});
 // Round 6: the top bar's arrow names the same place as the green button, so every way back is found and says one place.
 const ways=(label:string)=>tree.root.findAll(node=>String(node.type)==='Press'&&node.props.accessibilityLabel===label);
 const green=(label:string)=>ways(label).find(node=>[node.props.style].flat(3).some((style:{backgroundColor?:string}|null)=>style?.backgroundColor===sys.color.green));
 mockContext.mockResolvedValue(receipted());await render();
 expect(ways('Nazad na Dogovor')).toHaveLength(2);expect(ways('Nazad na Početnu')).toHaveLength(0);
 await act(async()=>tree.unmount());
 mockFrom='pocetna';await render();
 expect(texts()).toContain('Ocena je sačuvana');expect(ways('Nazad na Dogovor')).toHaveLength(0);expect(ways('Nazad na Početnu')).toHaveLength(2);
 mockRouter.canGoBack.mockReturnValue(false);await act(async()=>green('Nazad na Početnu')!.props.onPress());expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
 mockRouter.canGoBack.mockReturnValue(true);await act(async()=>green('Nazad na Početnu')!.props.onPress());expect(mockRouter.back).toHaveBeenCalledTimes(1);
 // Not yet eligible: the same way back, under the same name.
 await act(async()=>tree.unmount());
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false}});await render();
 expect(texts()).toContain('Ocena još nije dostupna');expect(green('Nazad na Početnu')).toBeDefined();expect(ways('Nazad na Dogovor')).toHaveLength(0);
});
// Round 6: the person being rated leads the screen, from the Dogovor's own participant with the server's target account.
it('shows whom the rating is about, and without a matching person still rates and invents no name',async()=>{
 await render();await settle();
 expect(mockAgreement).toHaveBeenCalledWith(D);
 expect(texts()).toContain('Nikola Petrović');expect(texts()).toContain('Traži pomoć');expect(texts()).toContain('Unos ormara');
 expect(texts()).not.toContain('Ja Sam');
 expect(tree.root.findAllByProps({accessibilityLabel:'Nikola Petrović, Traži pomoć, Unos ormara'})).not.toHaveLength(0);
 await act(async()=>tree.unmount());
 mockAgreement.mockResolvedValue({id:D,naslov:'Unos ormara',ucesnici:[person(A,true,'Ja Sam','uskocer'),person(R,false,'Neko Drugi','narucilac')]});
 await render();await settle();
 expect(texts()).not.toContain('Neko Drugi');expect(texts()).not.toContain('Ja Sam');
 await act(async()=>tree.unmount());
 mockAgreement.mockRejectedValue(new Error('PRIVATE'));mockSubmit.mockResolvedValue({ok:true,podatak:receipt({agreementId:D,targetAccountId:B,rating:4,tags:[],clientRequestId:K})});
 await render();await settle();expect(texts()).not.toContain('PRIVATE');
 click('Ocena 4 od 5');expect(button('Ocena 4 od 5').props.accessibilityHint).toBe('Vrlo dobro');
 await act(async()=>{button('Sačuvaj ocenu').props.onPress();});expect(mockSubmit).toHaveBeenCalledTimes(1);
});
it('a person read that lands after the screen is gone, or after a newer read, draws nothing stale',async()=>{
 let late!:(x:unknown)=>void;mockAgreement.mockImplementationOnce(()=>new Promise(resolve=>{late=resolve;}));
 const errors=jest.spyOn(console,'error').mockImplementation(()=>{});
 try{
  await render();await act(async()=>tree.unmount());
  await act(async()=>late({id:D,naslov:'Stari',ucesnici:[person(B,false,'Zakasnela Osoba','narucilac')]}));
  expect(errors).not.toHaveBeenCalled();
  mockAgreement.mockImplementationOnce(()=>new Promise(resolve=>{late=resolve;}));
  await render();await settle();
  await act(async()=>late({id:D,naslov:'Stari',ucesnici:[person(B,false,'Zakasnela Osoba','narucilac')]}));
  expect(texts()).toContain('Zakasnela Osoba');
 }finally{errors.mockRestore();}
});
it('the saved rating names the person, and three tags stop the rest with a reason',async()=>{
 await render();await settle();
 click('Po dogovoru');click('Pažljivo');click('Na vreme');
 // r6: plain Serbian, matching the section's own "najviše 3" (it said "Izabrano je najviše: 3 oznake.").
 expect(button('Pouzdano').props.accessibilityHint).toBe('Najviše 3 oznake. Skini jednu da izabereš drugu.');
 expect(texts()).toContain('Najviše 3 oznake. Skini jednu da izabereš drugu.');
 await act(async()=>tree.unmount());
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false,review:receipt({agreementId:D,targetAccountId:B,rating:5,tags:['ON_TIME','RELIABLE'],clientRequestId:K})}});
 await render();await settle();
 // r6: the success title is a sentence with its stop, as "Prijava je poslata." is.
 expect(texts()).toContain('Ocena je sačuvana.');expect(texts()).toContain('Nikola Petrović');
 expect(texts()).toContain('Tvoja ocena: 5 od 5');expect(texts()).toContain('Na vreme · Pouzdano');
 expect(tree.root.findAllByProps({accessibilityRole:'checkbox'})).toHaveLength(0);
});
it('server ineligibility and already submitted receipt never expose a new submission',async()=>{
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false}});await render();
 expect(texts()).toContain('Ocena još nije dostupna');expect(tree.root.findAllByProps({accessibilityRole:'radio'})).toHaveLength(0);
 expect(mockSubmit).not.toHaveBeenCalled();
});
it('background invalidates retained actions and foreground requires a fresh server read',async()=>{
 await render();click('Ocena 5 od 5');const oldSave=button('Sačuvaj ocenu').props.onPress;
 act(()=>{mockListeners.forEach(fn=>fn('background'));oldSave();});expect(mockSubmit).not.toHaveBeenCalled();
 await act(async()=>mockListeners.forEach(fn=>fn('active')));expect(mockContext.mock.calls.length).toBeGreaterThan(1);
 act(()=>oldSave());expect(mockSubmit).not.toHaveBeenCalled();
});
it('invalid route and account switch cannot reuse the previous focused write callback',async()=>{
 await render();click('Ocena 5 od 5');const oldSave=button('Sačuvaj ocenu').props.onPress;
 mockAccount=B;mockRevision=2;mockContext.mockResolvedValue({ok:true,podatak:{...context(),accountId:B,targetAccountId:A}});
 await act(async()=>tree.update(<ReviewRoute/>));act(()=>oldSave());expect(mockSubmit).not.toHaveBeenCalled();
 expect(button('Sačuvaj ocenu').props.disabled).toBe(true);
 mockAgreementId=[D];await act(async()=>tree.update(<ReviewRoute/>));expect(texts()).toContain('Ocena nije dostupna');
});
it('reputation distinguishes no reviews from unavailable state and never invents 0.0',async()=>{
 mockReputation.mockResolvedValue({ok:true,podatak:{accountId:A,reviewCount:0,averageRating:null,state:'NO_REVIEWS',authoritative:true}});
 await act(async()=>{tree=create(<AccountReputation accountId={A}/>);});expect(texts()).toContain('Još nema');expect(texts()).toContain('ocena');expect(texts()).not.toContain('0,0');
 mockReputation.mockResolvedValue({ok:false,kod:'REPUTATION_READ_UNAVAILABLE',poruka:'Unavailable'});
 mockRevision=2;await act(async()=>tree.update(<AccountReputation accountId={A}/>));
 expect(texts()).toContain('Ocene trenutno nisu dostupne');expect(texts()).not.toContain('Još nema');
});
// 8 Oct 2026 ("Lice i tri broja"): the reputation is the first of the three figures of the profile. While it reads it is a still shape, not a
// spinner; a failed read is one cell that says so and reads again; reviews show the star, the average and the count under it.
it('reputation reads as a still shape, then the star, the figure and the count under it',async()=>{
 let finish!:(value:unknown)=>void;mockReputation.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>{tree=create(<AccountReputation accountId={A}/>);});
 expect(tree.root.findByProps({accessibilityLabel:'Učitavanje reputacije'}).props.accessibilityRole).toBe('progressbar');
 expect(tree.root.findAll(node=>String(node.type)==='ActivityIndicator')).toHaveLength(0);
 await act(async()=>finish({ok:true,podatak:{accountId:A,reviewCount:12,averageRating:4.8,state:'RATED',authoritative:true}}));
 expect(texts()).toContain('4,8');expect(texts()).toContain('12 ocena');expect(tree.root.findAll(node=>node.props?.kind==='star').length).toBeGreaterThan(0);
});
it('an unavailable reputation offers one cell that reads it again',async()=>{
 mockReputation.mockResolvedValueOnce({ok:false,kod:'REPUTATION_READ_UNAVAILABLE',poruka:'Unavailable'})
  .mockResolvedValueOnce({ok:true,podatak:{accountId:A,reviewCount:0,averageRating:null,state:'NO_REVIEWS',authoritative:true}});
 await act(async()=>{tree=create(<AccountReputation accountId={A}/>);});
 expect(texts()).toContain('Ocene trenutno nisu dostupne');expect(button('Osveži ocene').props.accessibilityRole).toBe('button');
 await act(async()=>{button('Osveži ocene').props.onPress();});
 expect(mockReputation).toHaveBeenCalledTimes(2);expect(texts()).toContain('Još nema');expect(texts()).not.toContain('0,0');
});
// Review of step 9 (2026-09-24): the line is tested on its own for data that is not a reputation. It used to be tested
// only through the profile hub, whose suite-wide resource mock happened to hand it the profile object.
it.each([
 ['a profile object',{identity:{ime:'Ana'},capability:null}],
 ['a count of reviews without an average',{accountId:A,reviewCount:3,averageRating:null,state:'RATED',authoritative:true}],
 ['a count of reviews with an average that is not a number',{accountId:A,reviewCount:3,averageRating:'4,8',state:'RATED',authoritative:true}],
 ['nothing',null],
])('the reputation figure draws nothing for %s, never "undefined"',async(_name,state)=>{
 await act(async()=>{tree=create(<ReputationFigure state={state} onRetry={()=>{}}/>);});
 expect(tree.toJSON()).toBeNull();
});
