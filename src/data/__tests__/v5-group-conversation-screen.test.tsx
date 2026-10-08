import React from 'react';
import {StyleSheet} from 'react-native';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',ID='20000000-0000-4000-8000-000000000001',G='30000000-0000-4000-8000-000000000001',KEY='40000000-0000-4000-8000-000000000001',M='50000000-0000-4000-8000-000000000001';
let mockSession={user:{id:A},accountRevision:1},mockIntent='uskocer',mockFocused=true,mockForeground='active';
const mockListeners=new Set<(value:string)=>void>(),mockStorage={getItem:jest.fn(),setItem:jest.fn(),removeItem:jest.fn()},mockPush=jest.fn(),mockBack=jest.fn(),mockReplace=jest.fn();
let mockCanGoBack=true;
const mockService={context:jest.fn(),messages:jest.fn(),recover:jest.fn(),send:jest.fn(),markRead:jest.fn()};
jest.mock('../groupConversationService',()=>{const actual=jest.requireActual('../groupConversationService');return{...actual,groupConversationService:{
 context:(...args:unknown[])=>mockService.context(...args),messages:(...args:unknown[])=>mockService.messages(...args),recover:(...args:unknown[])=>mockService.recover(...args),
 send:(...args:unknown[])=>mockService.send(...args),markRead:(...args:unknown[])=>mockService.markRead(...args)}};});
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({})}));
jest.mock('../../store/sesija',()=>({useSesija:()=>mockSession,sesijaSada:()=>mockSession}));
jest.mock('../../store/uloga',()=>({useUloga:()=>mockIntent,ulogaSada:()=>mockIntent}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=>'40000000-0000-4000-8000-000000000001'}));
jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:(...args:unknown[])=>mockStorage.getItem(...args),
 setItem:(...args:unknown[])=>mockStorage.setItem(...args),removeItem:(...args:unknown[])=>mockStorage.removeItem(...args)}}));
jest.mock('expo-router',()=>({router:{push:(...args:unknown[])=>mockPush(...args),canGoBack:()=>mockCanGoBack,back:()=>mockBack(),replace:(...args:unknown[])=>mockReplace(...args)},useFocusEffect:(effect:()=>void)=>require('react').useEffect(()=>mockFocused?effect():undefined,[effect,mockFocused])}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(['View','TextInput','KeyboardAvoidingView'].includes(String(key)))return String(key);
 if(key==='FlatList')return (p:any)=>require('react').createElement('List',p,p.ListHeaderComponent,p.data.map((item:any,index:number)=>require('react').createElement('Row',{key:item.messageId},p.renderItem({item,index}))),p.ListFooterComponent);
 if(key==='AppState')return{get currentState(){return mockForeground;},addEventListener:(_name:string,listener:(value:string)=>void)=>{mockListeners.add(listener);return{remove:()=>mockListeners.delete(listener)};}};
 return Reflect.get(target,key);
 }});});
jest.mock('../../ui/Text',()=>({T:'T'}));jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));jest.mock('../../ui/media/ContextPhotos',()=>({ProfilePhoto:'Avatar'}));
jest.mock('../../ui/support/SupportContextEntry',()=>({SupportContextEntry:'SupportContextEntry'}));
import {GroupConversationScreen} from '../../ui/groups/GroupConversationScreen';
import {GroupConversationEntry} from '../../ui/groups/GroupConversationEntry';
import {ConversationChannels,privateConversationChoices} from '../../ui/groups/ConversationChannels';
import type {GroupContext} from '../groupConversationService';
import {groupBodyHash} from '../groupConversationService';
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'GROUP_UNCONFIRMED',poruka:'Ishod nije potvrđen.'};
const context=(role='PARTICIPANT')=>({accountId:A,agreementId:ID,needId:ID,available:true,authoritative:true,group:{groupId:G,title:'Zajednički Zadatak',canSend:true,terminal:false,role,
 members:[{accountId:B,profileId:B,displayName:'Bojana',role:'PARTICIPANT'}],management:role==='REQUESTER'?[{agreementId:ID,accountId:B,status:'CONFIRMED',executionState:'AWAITING_REQUESTER',problemOpened:true}]:null,managementNextId:null,unreadCount:1}});
const message={messageId:M,sequence:'1',senderAccountId:B,body:'Nalazimo se ispred ulaza.',createdAt:'2026-09-13T12:00:00Z',mine:false};
const journal={version:1,groupId:G,clientRequestId:KEY,bodySha256:groupBodyHash('Prvobitna poruka')};
let tree:ReactTestRenderer|undefined,entry=false;
const page=()=>entry?<GroupConversationEntry agreementId={ID}/>:<GroupConversationScreen agreementId={ID}/>;
const render=async()=>{await act(async()=>{tree=create(page());});};
const action=(label:string)=>tree!.root.findByProps({label}).props;
// Round 6: the send is the pill's round button, named by what it does; found on the outermost element that carries the name.
const send=(label:string)=>tree!.root.findAll(node=>typeof node.type!=='string'&&node.props.accessibilityLabel===label)[0]?.props;
// A message is held (long press) to offer it to support, as in Poruke.
const hold=async(body:string)=>{await act(async()=>tree!.root.findAll(node=>typeof node.type!=='string'&&String(node.props.accessibilityLabel??'').includes(body))[0].props.onLongPress());};
const tap=async(label:string)=>{await act(async()=>action(label).onPress());};
const change=async(value:string)=>{await act(async()=>tree!.root.findByType('TextInput' as never).props.onChangeText(value));};
const text=()=>tree!.toJSON()===null?'null':tree!.root.findAllByType('T' as never).map(node=>node.children.filter(child=>typeof child==='string').join('')).join(' ');
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
beforeEach(()=>{jest.clearAllMocks();for(const group of [mockStorage,mockService])for(const fn of Object.values(group))fn.mockReset();
 mockSession={user:{id:A},accountRevision:1};mockIntent='uskocer';mockFocused=true;mockForeground='active';entry=false;mockCanGoBack=true;
 mockStorage.getItem.mockResolvedValue(null);mockStorage.setItem.mockResolvedValue(undefined);mockStorage.removeItem.mockResolvedValue(undefined);
 mockService.context.mockResolvedValue(ok(context()));mockService.messages.mockResolvedValue(ok({messages:[message],nextBeforeSequence:null,nextAfterSequence:null}));
 mockService.recover.mockResolvedValue(ok({found:false,receipt:null}));mockService.send.mockResolvedValue(unknown);mockService.markRead.mockResolvedValue(ok({markedCount:1}));
});
afterEach(async()=>{await act(async()=>tree?.unmount());tree=undefined;expect(mockListeners.size).toBe(0);mockListeners.clear();});
it('renders actual common message, member names/avatars and keeps individual management absent for peers',async()=>{
 await render();expect(text()).toContain(message.body);expect(text()).toContain('svom privatnom Dogovoru');await tap('Učesnici razgovora');expect(text()).toContain('Bojana');
 expect(tree!.root.findAllByType('Avatar' as never)).toHaveLength(1);expect(text()).not.toContain('Tvoji pojedinačni Dogovori');expect(mockService.send).not.toHaveBeenCalled();expect(mockService.markRead).not.toHaveBeenCalled();
});
it('shows only requester management and routes to the exact canonical individual Agreement',async()=>{
 // Round 6: the block is the requester's own, so the finish waits on "tvoju" confirmation (it said the impersonal "Čeka potvrdu završetka").
 mockService.context.mockResolvedValue(ok(context('REQUESTER')));await render();await tap('Učesnici razgovora');expect(text()).toContain('samo ti');expect(text()).toContain('Bojana · Čeka tvoju potvrdu završetka');
 await tap('Otvori pojedinačni Dogovor');expect(mockPush).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID}});
});
it('offers a participant only the requester privately, never another participant', async()=>{
 await render();
 expect(privateConversationChoices(context() as GroupContext)).toEqual([{id:ID,name:'Osoba koja traži pomoć'}]);
 const channels=tree!.root.findByType(ConversationChannels).props;
 await act(async()=>channels.onPrivate(B));expect(mockPush).not.toHaveBeenCalled();
 await act(async()=>channels.onPrivate(ID));expect(mockPush).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID,tab:'poruke'}});
});
it('keeps two authorized private Agreements distinct even for the same person', async()=>{
 const c=context('REQUESTER');c.group.management!.push({...c.group.management![0],agreementId:KEY});
 mockService.context.mockResolvedValue(ok(c));await render();
 expect(privateConversationChoices(c as GroupContext)).toEqual([{id:ID,name:'Bojana · Dogovor 1'},{id:KEY,name:'Bojana · Dogovor 2'}]);
 await act(async()=>tree!.root.findByType(ConversationChannels).props.onPrivate(KEY));
 expect(mockPush).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:KEY,tab:'poruke'}});
});
it.each(['blur','background','ABA'])('rejects a retained private-channel choice after %s',async kind=>{
 await render();const choose=tree!.root.findByType(ConversationChannels).props.onPrivate;
 await act(async()=>{if(kind==='blur')mockFocused=false;else if(kind==='ABA')mockSession={user:{id:A},accountRevision:3};
 else{mockForeground='background';[...mockListeners].forEach(fn=>fn('background'));}tree!.update(page());});
 await act(async()=>choose(ID));expect(mockPush).not.toHaveBeenCalled();
});
it('shows sender identity with the message before opening the people panel',async()=>{
 await render();expect(tree!.root.findByProps({testID:`group-message-sender-${M}`})).toBeDefined();
 expect(tree!.root.findAllByType('Avatar' as never)).toHaveLength(0); // no photo fetch per message run
 expect(text()).toContain('Bojana');expect(text()).toContain(message.body);
});
it('the overview lists the authoritative roster and only the allowed private target',async()=>{
 entry=true;await render();expect(text()).toContain('Učesnici zadatka');expect(text()).toContain('Bojana');
 expect(tree!.root.findAllByProps({label:'Privatno: Bojana'})).toHaveLength(0);
 await tap('Privatno: Osoba koja traži pomoć');expect(mockPush).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID,tab:'poruke'}});
});
it('pages requester choices once, deduplicates IDs and keeps prior choices on a failed next read',async()=>{
 entry=true;const c=context('REQUESTER');const first={...c,group:{...c.group,managementNextId:ID}};
 mockService.context.mockResolvedValueOnce(ok(first));await render();
 const gate=deferred<unknown>();mockService.context.mockReturnValueOnce(gate.promise);
 const more=action('Još privatnih razgovora').onPress;await act(async()=>{more();more();});
 expect(mockService.context).toHaveBeenCalledTimes(2);
 await act(async()=>gate.resolve(ok({...c,group:{...c.group,management:[c.group.management![0],{...c.group.management![0],agreementId:KEY}],managementNextId:KEY}})));
 expect(tree!.root.findAllByProps({label:'Privatno: Bojana · Dogovor 1'})).toHaveLength(1);
 expect(tree!.root.findAllByProps({label:'Privatno: Bojana · Dogovor 2'})).toHaveLength(1);
 mockService.context.mockResolvedValueOnce(unknown);await tap('Još privatnih razgovora');
 expect(text()).toContain('Nisu učitani svi privatni razgovori');expect(action('Privatno: Bojana · Dogovor 2')).toBeDefined();
});
it('marks the reader in the people panel and anchors the thread to the composer, a state to the middle, as Poruke does',async()=>{
 const me={accountId:A,profileId:A,displayName:'Ana',role:'REQUESTER'};
 mockService.context.mockResolvedValue(ok({...context('REQUESTER'),group:{...context('REQUESTER').group,members:[me,...context().group.members]}}));
 await render();await tap('Učesnici razgovora');expect(text()).toContain('Ti · Traži pomoć');expect(text()).not.toContain('Ti · Učesnik');
 const style=()=>StyleSheet.flatten(tree!.root.findByType('List' as never).props.contentContainerStyle);
 expect(style()).toMatchObject({flexGrow:1,justifyContent:'flex-end'});
 mockService.messages.mockResolvedValue(ok({messages:[],nextBeforeSequence:null,nextAfterSequence:null}));await tap('Osveži poruke');
 expect(style().justifyContent).toBe('center');expect(text()).toContain('Vidiš poruke od svog ulaska u grupu. Napiši prvu.');expect(action('Osveži poruke')).toBeDefined();
});
it('has one send action, latches concurrent retained callbacks and persists no plaintext',async()=>{
 await render();await change('Prvobitna poruka');const gate=deferred<void>();mockStorage.setItem.mockReturnValue(gate.promise);const old=send('Pošalji poruku grupi').onPress;
 await act(async()=>{old();old();});expect(mockStorage.setItem).toHaveBeenCalledTimes(1);expect(mockService.send).not.toHaveBeenCalled();
 await act(async()=>gate.resolve());expect(mockService.send).toHaveBeenCalledTimes(1);expect(mockStorage.setItem.mock.calls[0][1]).not.toContain('Prvobitna poruka');
 expect(action('Proveri da li je poruka stigla')).toBeDefined();expect(send('Pošalji poruku grupi')).toBeUndefined();
});
it('restart reads original key and requires exact re-entry before same-key retry',async()=>{
 mockStorage.getItem.mockResolvedValue(JSON.stringify(journal));await render();expect(mockService.send).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
 await change('Promenjena poruka');await act(async()=>send('Ponovi slanje iste poruke').onPress());expect(mockService.send).not.toHaveBeenCalled();expect(text()).toContain('razlikuje');
 await change('Prvobitna poruka');await act(async()=>send('Ponovi slanje iste poruke').onPress());expect(mockService.send.mock.calls[0][0]).toEqual(journal);expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it('confirmed receipt clears composer and automatically shows the authoritative page, never a fabricated message',async()=>{
 await render();await change('Prvobitna poruka');mockService.send.mockResolvedValue(ok({...journal,messageId:KEY}));await act(async()=>send('Pošalji poruku grupi').onPress());
 expect(text()).not.toContain('Prvobitna poruka');expect(text()).toContain(message.body);
 expect(mockStorage.removeItem).toHaveBeenCalledTimes(1);expect(mockService.send).toHaveBeenCalledTimes(1);
 expect(tree!.root.findByType('TextInput' as never).props.value).toBe('');
});
it.each(['blur','background'])('restores an unsent draft after %s only in the same authorized conversation',async kind=>{
 await render();await change('Još nisam poslao');
 await act(async()=>{if(kind==='blur')mockFocused=false;else{mockForeground='background';[...mockListeners].forEach(fn=>fn('background'));}tree!.update(page());});
 await act(async()=>{if(kind==='blur')mockFocused=true;else{mockForeground='active';[...mockListeners].forEach(fn=>fn('active'));}tree!.update(page());});
 expect(tree!.root.findByType('TextInput' as never).props.value).toBe('Još nisam poslao');
 expect(mockService.send).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it.each(['account','ABA','group','permission'])('does not restore an unsent draft after %s changes',async kind=>{
 await render();await change('Privatan nacrt');
 await act(async()=>{mockFocused=false;tree!.update(page());});
 if(kind==='account')mockSession={user:{id:B},accountRevision:2};
 if(kind==='ABA')mockSession={user:{id:A},accountRevision:3};
 if(kind==='group')mockService.context.mockResolvedValue(ok({...context(),group:{...context().group,groupId:ID}}));
 if(kind==='permission')mockService.context.mockResolvedValue(ok({...context(),group:{...context().group,canSend:false}}));
 await act(async()=>{mockFocused=true;tree!.update(page());});
 expect(tree!.root.findAllByType('TextInput' as never).every(node=>!node.props.value)).toBe(true);
 expect(mockService.send).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it('read-only and bilateral contexts offer no composer or fabricated group members',async()=>{
 mockService.context.mockResolvedValue(ok({...context(),group:{...context().group,canSend:false,terminal:true,members:[]}}));await render();expect(tree!.root.findAllByType('TextInput' as never)).toHaveLength(0);expect(text()).toContain('Razgovor je završen');
 // Round 6: a finished conversation offers no "Osveži poruke" (nothing new can arrive, as in Poruke); the pull-down refresh stays.
 expect(tree!.root.findAllByProps({label:'Osveži poruke'})).toHaveLength(0);
 mockService.context.mockResolvedValue(ok({...context(),available:false,group:null}));await act(async()=>tree!.root.findByType('List' as never).props.onRefresh());
 expect(text()).toContain('najmanje dve osobe');expect(tree!.root.findAllByProps({label:'Učesnici razgovora'})).toHaveLength(0);
});
it('marks only truly viewable rows and retains SafeArea/whole-screen keyboard avoidance with scalable input',async()=>{
 await render();expect(mockService.markRead).not.toHaveBeenCalled();const list=tree!.root.findByType('List' as never).props;
 expect(list.viewabilityConfig).toEqual({viewAreaCoveragePercentThreshold:60,minimumViewTime:600});
 await act(async()=>list.onViewableItemsChanged({viewableItems:[{item:message,isViewable:true},{item:{...message,messageId:ID},isViewable:false}]}));
 expect(mockService.markRead).toHaveBeenCalledWith(G,[M],{accountId:A,accountRevision:1});
 expect(tree!.root.findByType('KeyboardAvoidingView' as never).parent!.type).toBe('SafeAreaView');expect(tree!.root.findByType('TextInput' as never).props.multiline).toBe(true);
});
it.each(['blur','account','ABA','background'])('fences retained send/read-marker callbacks and late responses after %s',async kind=>{
 await render();await change('Prvobitna poruka');const gate=deferred<void>();mockStorage.setItem.mockReturnValue(gate.promise);const old=send('Pošalji poruku grupi').onPress,visible=tree!.root.findByType('List' as never).props.onViewableItemsChanged;
 await act(async()=>old());await act(async()=>{if(kind==='blur')mockFocused=false;else if(kind==='account')mockSession={user:{id:B},accountRevision:2};else if(kind==='ABA')mockSession={user:{id:A},accountRevision:3};
 else{mockForeground='background';[...mockListeners].forEach(fn=>fn('background'));}tree!.update(page());});
 await act(async()=>{gate.resolve();old();visible({viewableItems:[{item:message,isViewable:true}]});});expect(mockService.send).not.toHaveBeenCalled();expect(mockService.markRead).not.toHaveBeenCalled();
});
// Owner decision 1 (2026-09-19): the app has no global mode, and a Dogovor works the same for both of its
// sides from the relation it carries itself. 'role' used to be a row of the table above.
it('a flip of the retired app mode retires nothing: the retained send still goes out to this group',async()=>{
 await render();await change('Prvobitna poruka');const old=send('Pošalji poruku grupi').onPress;
 await act(async()=>{mockIntent='narucilac';tree!.update(page());});
 await act(async()=>old());expect(mockService.send).toHaveBeenCalledTimes(1);
});
it('entry becomes reachable only after authoritative group context and routes exact Agreement identity',async()=>{
 entry=true;await render();await tap('Grupni razgovor · 1 nepročitano');expect(mockPush).toHaveBeenCalledWith({pathname:'/dogovor/[id]/grupa',params:{id:ID}});
});
it('entry hides unsupported group and discards late availability after account transition',async()=>{
 entry=true;const gate=deferred<unknown>();mockService.context.mockReturnValueOnce(gate.promise).mockResolvedValue(ok({...context(),group:null,available:false}));await render();expect(text()).toBe('null');
 // The absence now explains itself, so the new account reads why there is no group rather than a
 // blank. What this test is about is unchanged: the late answer for the old account is discarded,
 // no entry appears, and nothing navigates.
 await act(async()=>{mockSession={user:{id:B},accountRevision:2};tree!.update(page());gate.resolve(ok(context()));});
 expect(text()).toBe('Grupni razgovor se otvara kad su za ovaj zadatak izabrane najmanje dve osobe.');
 expect(mockPush).not.toHaveBeenCalled();
});
it('selects only an actually visible group message and preserves the read-only support exit',async()=>{
 mockService.context.mockResolvedValue(ok({...context(),group:{...context().group,canSend:false,terminal:true}}));await render();
 expect(tree!.root.findAllByType('SupportContextEntry' as never)).toHaveLength(0);await hold(message.body);
 const entry=tree!.root.findByType('SupportContextEntry' as never).props;
 expect(entry.reference).toEqual({kind:'GROUP_MESSAGE',id:M,revision:null});expect(entry.previewText).toBe(message.body);
 expect(entry.canAct()).toBe(true);expect(mockService.send).not.toHaveBeenCalled();
 await act(async()=>{entry.navigate(()=>mockPush('/selected-support'));});expect(mockPush).toHaveBeenCalledWith('/selected-support');
 expect(entry.canAct()).toBe(false);expect(mockService.send).not.toHaveBeenCalled();
});
it('removes support choices when an authoritative refresh withdraws message visibility',async()=>{
 await render();await hold(message.body);const entry=tree!.root.findByType('SupportContextEntry' as never).props;
 mockService.messages.mockResolvedValue(ok({messages:[],nextBeforeSequence:null,nextAfterSequence:null}));await tap('Osveži poruke');
 expect(tree!.root.findAllByType('SupportContextEntry' as never)).toHaveLength(0);expect(entry.canAct()).toBe(false);
 await act(async()=>entry.navigate(()=>mockPush('/must-not-open')));expect(mockPush).not.toHaveBeenCalled();
});
it('back returns to the Dogovor it came from, and opens it anew only without a stack',async()=>{
 await render();await act(async()=>tree!.root.findByProps({label:'Nazad na Dogovor'}).props.onPress());expect(mockBack).toHaveBeenCalledTimes(1);expect(mockPush).not.toHaveBeenCalled();
 mockCanGoBack=false;await act(async()=>tree!.root.findByProps({label:'Nazad na Dogovor'}).props.onPress());
 expect(mockReplace).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID}});
});
it('names the sender once at the start of their turn and speaks each message with who and when',async()=>{
 mockService.messages.mockResolvedValue(ok({messages:[message,{...message,messageId:KEY,sequence:'2',body:'Ja sam tu.'}],nextBeforeSequence:null,nextAfterSequence:null}));
 await render();expect(text().split('Bojana').length-1).toBe(1);
 expect(tree!.root.findAll(node=>typeof node.type!=='string'&&String(node.props.accessibilityLabel??'').startsWith('Bojana: Ja sam tu.'))).not.toHaveLength(0);
});
it('offers a message to support with a plain tap, so no gesture is needed',async()=>{
 await render();expect(tree!.root.findAllByType('SupportContextEntry' as never)).toHaveLength(0);
 const bubble=tree!.root.findAll(node=>typeof node.type!=='string'&&String(node.props.accessibilityLabel??'').includes(message.body))[0].props;
 expect(bubble.accessibilityRole).toBe('button');await act(async()=>bubble.onPress());
 expect(tree!.root.findByType('SupportContextEntry' as never).props.reference).toEqual({kind:'GROUP_MESSAGE',id:M,revision:null});
 expect(text().split('Razgovor je završen').length-1).toBe(0);expect(mockService.send).not.toHaveBeenCalled();
});


it('keeps failed older-page history readable with an explicit retry and clears it when the route blurs',async()=>{
 mockService.messages.mockResolvedValueOnce(ok({messages:[message],nextBeforeSequence:'1',nextAfterSequence:null}));await render();
 mockService.messages.mockResolvedValueOnce({ok:false,kod:'GROUP_PAGE_TRANSPORT_UNAVAILABLE',poruka:'Veza je prekinuta.'});await tap('Starije poruke');
 expect(text()).toContain(message.body);expect(text()).toContain('Starije poruke nisu učitane');expect(text()).not.toContain('Razgovor nije učitan');
 expect(action('Ponovo učitaj starije poruke').disabled).toBe(false);expect(send('Pošalji poruku grupi')).toBeUndefined();
 const oldRetry=action('Ponovo učitaj starije poruke').onPress;
 await act(async()=>{mockFocused=false;tree!.update(page());});
 expect(text()).not.toContain(message.body);const reads=mockService.messages.mock.calls.length;
 await act(async()=>oldRetry());expect(mockService.messages).toHaveBeenCalledTimes(reads);expect(mockService.send).not.toHaveBeenCalled();expect(mockService.markRead).not.toHaveBeenCalled();
});
