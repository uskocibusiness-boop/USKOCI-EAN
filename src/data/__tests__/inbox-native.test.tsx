import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { trenutak } from '../../lib/trenutak';
import { inboxEventArt } from '../../ui/notifications/InboxPresentation';
import { Appear } from '../../ui/system/Appear';
import { ConversationArt } from '../../ui/system/ConversationArt';
import { FactArt } from '../../ui/system/FactArt';
import { ListRow } from '../../ui/system/ListRow';
const mockRouter={push:jest.fn(),back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(()=>true)};
const mockRole=jest.fn(), mockModel={canNavigate:jest.fn(()=>true),open:jest.fn(),readAll:jest.fn(),refresh:jest.fn(),more:jest.fn()};
let mockIntent='narucilac';
const at='2026-09-10T12:00:00Z';
const item={id:'event',eventType:'RESPONSE_SELECTED',title:'Vaša Prijava je izabrana',body:'Otvori Dogovor.',readAt:null,occurredAt:at,role:'WORKER',family:'responses'};
let mockState:any;
// The list and the sheet are made once: a component made anew on every property read is a new type on every render, which
// remounted the whole list each time and hid whether the screen keeps its nodes (round 5c, 2026-09-24).
jest.mock('react-native',()=>{const native=jest.requireActual('react-native'),React=require('react');
  const Modal=({visible,children,...props}:any)=>visible?React.createElement('Modal',props,children):null;
  const FlatList=({data,renderItem,ListHeaderComponent,ListEmptyComponent,ListFooterComponent,...props}:any)=>React.createElement('FlatList',props,ListHeaderComponent,
    data.length?data.map((item:any)=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent,ListFooterComponent);
  return new Proxy(native,{get(target,key){
  if(['View','ActivityIndicator'].includes(String(key)))return key;
  if(key==='Modal')return Modal;
  if(key==='FlatList')return FlatList;
  return Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({top:0,bottom:24,left:0,right:0})}));
// This screen lies above the tab navigator that mounts the Poruka host, so it mounts its own; here the store is a spy and the host a named element.
const mockPoruka=jest.fn();
jest.mock('../../ui/system/Poruka',()=>({PorukaHost:'PorukaHost',poruka:{show:(...args:unknown[])=>mockPoruka(...args),hide:jest.fn()}}));
// Reading one row without opening it (the swipe) uses the call a tapped row uses; the model has no command for it.
const mockReadOne=jest.fn();
jest.mock('../../data/inboxClientService',()=>({inboxClientService:{read:(...args:unknown[])=>mockReadOne(...args)}}));
jest.mock('react-native-svg',()=>({__esModule:true,default:'Svg',SvgXml:'NativeSvgXml',Path:'Path',Circle:'Circle',Rect:'Rect',Ellipse:'Ellipse',Defs:'Defs',LinearGradient:'LinearGradient',Stop:'Stop'}));
jest.mock('../../ui/system/motion',()=>({useReducedMotion:()=>false}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},Stack:{Screen:'StackScreen'},useFocusEffect:(effect:()=>void)=>require('react').useEffect(effect,[effect])}));
jest.mock('../../store/uloga',()=>({postaviUlogu:(role:string)=>mockRole(role),useUloga:()=>mockIntent,ulogaSada:()=>mockIntent}));
jest.mock('../../hooks/useInbox',()=>({useInbox:()=>({state:mockState,model:mockModel})}));
jest.mock('../../hooks/useMessagePushIngress',()=>({useMessagePushIngress:()=>({phase:null,cancel:jest.fn(),retry:jest.fn()})}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
import Inbox from '../../app/obavestenja';
let tree:ReactTestRenderer;
const presses=()=>tree.root.findAllByType('Press' as React.ElementType);
const press=(label:string)=>presses().find(node=>node.props.accessibilityLabel===label)!;
// A row's spoken label ends with its day and clock ("…. Danas, 14:05"), which depend on the runner's date and zone.
const row=(prefix:string)=>presses().find(node=>typeof node.props.accessibilityLabel==='string'&&node.props.accessibilityLabel.startsWith(prefix))!;
const unreadRow=(title=item.title,body=item.body)=>row(`Nepročitano. ${title}. ${body}`);
const strings=(node:ReactTestInstance)=>node.findAllByType('T' as React.ElementType).flatMap(t=>t.children.filter(child=>typeof child==='string'));
const text=()=>strings(tree.root).join(' ');
const drawn=(kind:string)=>tree.root.findAll(node=>typeof node.type!=='string'&&node.props?.kind===kind,{deep:false}).length;
const headers=()=>tree.root.findAllByType('T' as React.ElementType).filter(node=>node.props.accessibilityRole==='header').map(node=>node.children.join(''));
const render=async()=>act(async()=>{tree=create(<Inbox/>);});
const openItem=async()=>act(async()=>unreadRow().props.onPress());
// "Označi sve" is the action at the end of the first day's heading; a screen reader hears it with how many it settles.
const readAllPress=()=>presses().find(node=>typeof node.props.accessibilityLabel==='string'&&node.props.accessibilityLabel.startsWith('Označi sve kao pročitano'));
/** The picture of a row: the app's own illustration of its kind, quiet once the row is read. */
const picture=(prefix:string)=>row(prefix).findAll(node=>typeof node.type!=='string'&&node.props?.kind!==undefined&&node.props?.size===32)[0];
beforeEach(()=>{jest.clearAllMocks();mockIntent='narucilac';mockModel.canNavigate.mockReturnValue(true);mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'WORKER'});
  mockState={page:{items:[],unreadCount:0,hasMore:false,asOf:at},loading:false,paging:false,acting:null,error:null,unavailable:false};});
afterEach(async()=>{await act(async()=>tree?.unmount());});
test('successful empty is the first encounter of the screen: the bell at the size of a door, the one green way and one owned settings destination',async()=>{
  // "Predmet vrata" (the owner's pick of 2026-10-08): the picture is the object of the screen, the bell, at 144, and not the conversation art of a message.
  await render();expect(text()).toContain('Još nema obaveštenja');expect(tree.root.findAllByType(ConversationArt.type)).toHaveLength(0);
  expect(tree.root.findAllByType(FactArt.type).filter(node=>node.props.kind==='bell'&&node.props.size===144)).toHaveLength(1);
  expect(text()).toContain('Nove prijave, poruke i važne promene stižu ovde.');expect(text()).not.toContain('uz zadatak ili Dogovor na koji se odnose');
  // The SPOJ V2 vector and its eyebrow ("Na jednom mestu") are gone: an empty list says so the way every list does.
  expect(tree.root.findAllByType('NativeSvgXml' as React.ElementType)).toHaveLength(0);expect(text()).not.toContain('Na jednom mestu');
  const settings=press('Podesi obaveštenja');await act(async()=>{settings.props.onPress();settings.props.onPress();});
  expect(mockRouter.push.mock.calls).toEqual([['/profil/obavestenja']]);
});
// Round-5 review (2026-09-24): from a list filtered to one set, the gear opens that set's settings.
test('the gear of a filtered list opens the settings on that set; "Sve" names none',async()=>{
  await render();
  await act(async()=>press('Moje prijave').props.onPress());
  await act(async()=>press('Podesi obaveštenja').props.onPress());
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/profil/obavestenja',params:{skup:'WORKER'}}]]);
});
test('a filtered empty list names what it is empty of, without the settings shortcut',async()=>{
  await render();
  await act(async()=>press('Moji zadaci').props.onPress());
  expect(text()).toContain('Još nema obaveštenja o tvojim zadacima');expect(text()).not.toContain('Nove Prijave, poruke');
  expect(presses().filter(node=>node.props.accessibilityLabel==='Podesi obaveštenja')).toHaveLength(1);
  await act(async()=>press('Moje prijave').props.onPress());
  expect(text()).toContain('Još nema obaveštenja o tvojim prijavama');
});
test('the first read shows the breathing placeholders under the tabs, not a bare spinner',async()=>{
  mockState={...mockState,page:null,loading:true};await render();
  expect(text()).toContain('Učitavamo obaveštenja…');expect(press('Sve')).toBeDefined();
  expect(text()).not.toContain('Još nema obaveštenja');
});
test.each(['load','action','page'])('%s failure preserves last data without asserting a successful empty state',async error=>{
  mockState={...mockState,error,page:error==='load'?null:{...mockState.page,items:[item],unreadCount:1}};await render();
  expect(text()).not.toContain('Još nema obaveštenja');expect(text()).toContain(error==='load'?'pokušaj ponovo da učitaš obaveštenja.':'Do tada vidiš poslednja učitana obaveštenja.');
  if(error!=='load')expect(text()).toContain(item.title);
});
test('a failed page of older events is said next to the button that loads them, not at the top',async()=>{
  mockState={...mockState,error:'page',page:{...mockState.page,items:[item],unreadCount:1,hasMore:true}};await render();
  const copy=text();
  expect(copy).toContain('Starija obaveštenja nisu učitana.');
  expect(copy.indexOf('Starija obaveštenja nisu učitana.')).toBeGreaterThan(copy.indexOf(item.title));
  expect(copy).not.toContain('Ne znamo da li je radnja uspela.');expect(copy).not.toContain('Obaveštenja nisu osvežena.');
  await act(async()=>press('Učitaj starija obaveštenja').props.onPress());
  expect(mockModel.more).toHaveBeenCalledTimes(1);expect(mockModel.refresh).not.toHaveBeenCalled();
});
test('an action that failed with a page offers a re-read in the notice, drawn on the quiet wash, never orange',async()=>{
  mockState={...mockState,error:'action',page:{...mockState.page,items:[item],unreadCount:1}};await render();
  expect(text()).toContain('Ne znamo da li je radnja uspela.');
  // The button reads the list again; "Pokušaj ponovo" promised to repeat the action (round-5 review, 2026-09-24).
  expect(presses().filter(node=>node.props.accessibilityLabel==='Pokušaj ponovo')).toHaveLength(0);
  await act(async()=>press('Osveži obaveštenja').props.onPress());expect(mockModel.refresh).toHaveBeenCalledTimes(1);
  const fills=tree.root.findAll(node=>typeof node.type==='string').map(node=>StyleSheet.flatten(node.props.style)?.backgroundColor);
  expect(fills).not.toContain('#FFF5E9');
});
// Round-5 review (2026-09-24): motion only for an event that really arrived. An older page is fetched, not arrived, and a
// filter's first page is what was there; both used to fade in row by row.
test('only an event newer than the list moves; an older page and a new filter\'s first page stay still',async()=>{
  const minutesAgo=(minutes:number)=>new Date(Date.parse(at)-minutes*60_000).toISOString();
  const moving=()=>tree.root.findAllByType(Appear).filter(node=>node.props.animate).map(node=>node.props.children.props.item.id);
  mockState.page={...mockState.page,items:[{...item,id:'a',occurredAt:minutesAgo(10)},{...item,id:'b',occurredAt:minutesAgo(20)}],unreadCount:2,hasMore:true};
  await render();
  expect(moving()).toEqual([]);
  mockState={...mockState,page:{...mockState.page,items:[{...item,id:'new',occurredAt:minutesAgo(1)},...mockState.page.items]}};
  await act(async()=>tree.update(<Inbox/>));
  expect(moving()).toEqual(['new']);
  mockState={...mockState,page:{...mockState.page,items:[...mockState.page.items,{...item,id:'older',occurredAt:minutesAgo(600)}]}};
  await act(async()=>tree.update(<Inbox/>));
  expect(moving()).toEqual([]);
  // Another filter is another list: its first page, even with an event newer than anything shown before, is not news.
  mockState={...mockState,page:{...mockState.page,items:[{...item,id:'requester',occurredAt:minutesAgo(0)},{...item,id:'r2',occurredAt:minutesAgo(30)}]}};
  await act(async()=>press('Moji zadaci').props.onPress());
  expect(moving()).toEqual([]);
});
// Round 5c (2026-09-24): the list stays mounted across a filter switch. Keying it by the filter threw away the tab a
// screen reader had just pressed (its focus was lost and "izabrano" never spoken) and rebuilt every row and the header.
test('switching the filter keeps the same tab control and list, and the new filter\'s first page still stays still',async()=>{
  const minutesAgo=(minutes:number)=>new Date(Date.parse(at)-minutes*60_000).toISOString();
  const moving=()=>tree.root.findAllByType(Appear).filter(node=>node.props.animate).map(node=>node.props.children.props.item.id);
  mockState.page={...mockState.page,items:[{...item,id:'a',occurredAt:minutesAgo(10)}],unreadCount:1};
  // The renderer's own host node (shared by a fiber and its alternate) is made once per mount: the same object after the
  // switch means the same mounted node.
  const host=(node:ReactTestInstance)=>(node as unknown as {_fiber:{stateNode:object}})._fiber.stateNode;
  await render();
  const tab=host(press('Moje prijave')), list=host(tree.root.findByType('FlatList' as React.ElementType));
  expect(tab).toBeTruthy();
  mockState={...mockState,page:{...mockState.page,items:[{...item,id:'worker',occurredAt:minutesAgo(0)}]}};
  await act(async()=>press('Moje prijave').props.onPress());
  // Compared as booleans: a failing `toBe` on host nodes would try to print the whole renderer tree.
  expect(host(press('Moje prijave'))===tab).toBe(true);
  expect(host(tree.root.findByType('FlatList' as React.ElementType))===list).toBe(true);
  expect(press('Moje prijave').props.accessibilityState).toEqual(expect.objectContaining({selected:true}));
  expect(moving()).toEqual([]);
  // A newer event arriving in that filter while it is open is news again.
  mockState={...mockState,page:{...mockState.page,items:[{...item,id:'fresh',occurredAt:new Date(Date.parse(at)+60_000).toISOString()},...mockState.page.items]}};
  await act(async()=>tree.update(<Inbox/>));
  expect(moving()).toEqual(['fresh']);
});
test('events are grouped under their day, the day said once',async()=>{
  const now=new Date(), today=now.toISOString(), earlier=new Date(now.getTime()-60_000).toISOString();
  const yesterday=new Date(now.getTime()-24*3600_000).toISOString(), old='2025-03-14T10:00:00Z';
  mockState.page.items=[{...item,id:'a',occurredAt:today},{...item,id:'b',occurredAt:earlier},{...item,id:'c',occurredAt:yesterday},{...item,id:'d',occurredAt:old}];
  mockState.page.unreadCount=4;await render();
  // One header per run of the same day (two events a minute apart share "Danas"; across midnight they would not).
  const days=[today,earlier,yesterday,old].map(value=>trenutak(value)!.dan).filter((day,index,all)=>index===0||all[index-1]!==day);
  expect(headers().filter(label=>label!=='Obaveštenja')).toEqual(days);
  expect(days).toEqual(expect.arrayContaining(['Danas','Juče']));expect(days.length).toBeLessThanOrEqual(4);
  expect(trenutak(old)!.dan).toMatch(/2025$/);
  // The row says its day and clock to a screen reader, after the words it shows.
  const moment=trenutak(old)!;
  expect(presses().some(node=>node.props.accessibilityLabel===`Nepročitano. ${item.title}. ${item.body}. ${moment.dan}, ${moment.sat}`)).toBe(true);
});
test('unread is a dot and a picture in colour, never a tinted card or an orange icon well',async()=>{
  mockState.page.items=[{...item,id:'a'},{...item,id:'b',readAt:at,title:'Pročitan naslov'},{...item,id:'c'}];mockState.page.unreadCount=2;await render();
  expect(tree.root.findAll(node=>node.props.testID==='inbox-unread-dot'&&typeof node.type==='string')).toHaveLength(2);
  const rows=presses().filter(node=>/^(Nepročitano|Pročitano)\. /.test(node.props.accessibilityLabel??''));
  expect(rows).toHaveLength(3);
  for(const node of rows){const style=StyleSheet.flatten(node.props.style);expect(style.backgroundColor).toBeUndefined();expect(style.borderRadius).toBeUndefined();expect(style.borderColor).not.toBe('#C9D6CF');}
  const fills=tree.root.findAll(node=>typeof node.type==='string').map(node=>StyleSheet.flatten(node.props.style)?.backgroundColor);
  expect(fills).not.toContain('#FFF5E9');
  // The row is the system's one row (ListRow): the same type for both; what tells the two apart is the dot and the colour of the picture.
  expect(row(`Pročitano. Pročitan naslov.`).findAllByType('T' as React.ElementType)[0].props.variant).toBe('bodyStrong');
  expect(unreadRow().findAllByType('T' as React.ElementType)[0].props.variant).toBe('bodyStrong');
  expect(picture('Pročitano. Pročitan naslov.').props.muted).toBe(true); expect(picture(`Nepročitano. ${item.title}.`).props.muted).toBe(false);
  // The row's arrow is the row's own (the system draws one on every row that is touched); the list adds none.
  expect(tree.root.findAllByType(ListRow)).toHaveLength(3);
});
test('"Označi sve" is the end of the first day\'s heading, reads everything once and shows its own spinner while it works',async()=>{
  mockState.page.items=[item];mockState.page.unreadCount=1;await render();
  const readAll=readAllPress()!;expect(readAll).toBeDefined();
  // Said as the action it is, with how many it settles; the word on the screen is the short one, and it is a 48 dp touch.
  expect(readAll.props.accessibilityLabel).toBe('Označi sve kao pročitano, 1 nepročitano');
  expect(StyleSheet.flatten(readAll.props.style).minHeight).toBeGreaterThanOrEqual(48);
  expect(strings(readAll)).toEqual(['Označi sve']);
  // It stands in the heading of the first day, not in a row of its own: the heading's own line holds the day and the action.
  expect(readAll.parent!.findAllByType('T' as React.ElementType).some(node=>node.props.accessibilityRole==='header')).toBe(true);
  await act(async()=>readAll.props.onPress());expect(mockModel.readAll).toHaveBeenCalledTimes(1);
  mockState={...mockState,acting:'all'};await act(async()=>tree.update(<Inbox/>));
  expect(readAllPress()!.props.accessibilityState).toEqual({disabled:true,busy:true});
  // The rows stay as they are while it works (the model ignores a press meanwhile), and none claims to be at work itself.
  expect(unreadRow().props.accessibilityState).toEqual({disabled:false});
  mockState={...mockState,acting:null,page:{...mockState.page,items:[{...item,readAt:at}],unreadCount:0}};
  await act(async()=>tree.update(<Inbox/>));
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Nema nepročitanih obaveštenja.');
  expect(readAllPress()).toBeUndefined();
});
test('the row being opened turns its picture into a spinner; the others wait',async()=>{
  mockState={...mockState,acting:'b',page:{...mockState.page,items:[{...item,id:'a'},{...item,id:'b',title:'Druga'}],unreadCount:2}};await render();
  expect(row('Nepročitano. Druga.').findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(1);
  // The row at work is the one that waits (its words go grey, nothing can be pressed on it); the others are as they were, and the model
  // ignores a press on them while it works.
  expect(row('Nepročitano. Druga.').props.accessibilityState).toEqual({disabled:true});
  expect(unreadRow().findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(0);
  expect(unreadRow().props.accessibilityState).toEqual({disabled:false});
});
test('a new task for you leads with the task itself, the only row the data lets lead with the task',async()=>{
  const title='Nova prilika koja ti može odgovarati', body='Prenos ormana do kombija';
  mockState.page.items=[{...item,eventType:'OPPORTUNITY_AVAILABLE',family:'opportunities',title,body}];mockState.page.unreadCount=1;await render();
  expect(strings(unreadRow(title,body)).slice(0,2)).toEqual([body,title]);
});
test.each([
  ['CLARIFICATION_CREATED','narucilac',{kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'}],
  ['CLARIFICATION_ANSWERED','uskocer',{kind:'OPPORTUNITY',id:'actual-need',role:'WORKER'}],
])('%s opens the questions themselves, not the Zadatak they are somewhere inside',async(eventType,intent,target)=>{
  // The server can only answer a CLARIFICATION with the Need it belongs to, so both sides used to
  // land on the task. The event type is the part that says it was about a question.
  mockIntent=intent;mockModel.open.mockResolvedValue(target);
  mockState.page.items=[{...item,eventType,role:target.role}];mockState.page.unreadCount=1;await render();
  await openItem();
  // The link says whose task the questions are about, so the way back needs no app-wide mode.
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/pitanja-zadatka',params:{needId:'actual-need',own:target.kind==='OWN_NEED'?'1':'0'}}]]);
});
test('an event about the Zadatak itself still opens the Zadatak',async()=>{
  mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_REVISED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/potrebe/[id]/pregled',params:{id:'actual-need'}}]]);
});
// Owner decision 1 (2026-09-19): a notification opens the thing it is about. It used to stop at a sheet
// that asked to switch the whole app into "the other intent" first, and one confirm did both.
test.each(['narucilac','uskocer'])('a Dogovor I work on opens directly, with no sheet and no mode change, whatever the app last was (%s)',async last=>{
  mockIntent=last;mockState.page.items=[item];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockModel.open).toHaveBeenCalledWith(item);expect(mockRole).not.toHaveBeenCalled();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
  expect(text()).not.toContain('Prelaziš u');expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
});
test.each(['narucilac','uskocer'])('a notification about my own task opens my view of that task directly (%s)',async last=>{
  mockIntent=last;mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_REVISED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRole).not.toHaveBeenCalled();expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/potrebe/[id]/pregled',params:{id:'actual-need'}}]]);
});
test('an event of the current intent opens directly without touching the saved intent',async()=>{
  mockIntent='uskocer';mockState.page.items=[item];await render();
  await openItem();
  expect(mockRole).not.toHaveBeenCalled();expect(text()).not.toContain('Prelazite u');
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
});
test('retired ownership suppresses late target and retained settings actions',async()=>{
  let done!:(value:unknown)=>void;mockModel.open.mockReturnValueOnce(new Promise(resolve=>{done=resolve;}));
  mockState.page.items=[item];await render();
  let pending!:Promise<void>;await act(async()=>{pending=unreadRow().props.onPress();});
  mockModel.canNavigate.mockReturnValue(false);await act(async()=>done({kind:'AGREEMENT',id:'old',role:'WORKER'}));await pending;
  expect(text()).not.toContain('Prelazite u');
  await act(async()=>press('Podesi obaveštenja').props.onPress());expect(mockRole).not.toHaveBeenCalled();expect(mockRouter.push).not.toHaveBeenCalled();
});
test('ownership retired before the target resolves opens nothing, and there is no sheet left to confirm',async()=>{
  mockState.page.items=[item];mockModel.canNavigate.mockReturnValue(false);await render();await openItem();
  expect(mockRole).not.toHaveBeenCalled();expect(mockRouter.push).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({label:'Pređi i otvori'})).toHaveLength(0);
});
// F14 / PG06: the server answers with the thing the event is about; the event type says which part of
// it the person came for. Everything else keeps the overview, where the next step is stated.
test('a message opens the conversation, not the overview it lives behind',async()=>{
  mockModel.open.mockResolvedValue({kind:'AGREEMENT_MESSAGE',id:'actual-agreement',messageId:'exact-message',eventId:item.id,role:'WORKER'});
  mockState.page.items=[{...item,eventType:'MESSAGE_RECEIVED'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement',tab:'poruke',messageId:'exact-message'}}]]);
});
test('a proposed change opens the change itself',async()=>{
  mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'AGREEMENT_CHANGE_PROPOSED'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]/izmene',params:{id:'actual-agreement'}}]]);
});
test.each(['AGREEMENT_CHANGE_REJECTED','AGREEMENT_VERSION_CHANGED','EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED'])
('%s keeps the Dogovor overview',async eventType=>{
  mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
});
test('a cancelled Zadatak sends the person who applied to their own offers, not to the dead task',async()=>{
  mockModel.open.mockResolvedValue({kind:'OPPORTUNITY',id:'actual-need',role:'WORKER'});
  mockState.page.items=[{...item,eventType:'NEED_CANCELLED',role:'WORKER'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/moje-prijave',params:{}}]]);
});
test('the owner cancelling their own Zadatak still lands on that task',async()=>{
  mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_CANCELLED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/potrebe/[id]/pregled',params:{id:'actual-need'}}]]);
});

// The icon says what kind of thing happened: a message is a speech bubble, a completion is a check — seen
// the other way round on a device on 2026-09-23, because the map went by family alone.
test('a new message wears the speech bubble and a completion the check, whatever family the server files them under',async()=>{
  // Each event keeps its own subject; chat uses the existing original material illustration.
  mockState.page.items=[{...item,id:'m',eventType:'MESSAGE_RECEIVED',family:'dogovor'},{...item,id:'c',eventType:'EXECUTION_STATE_CHANGED',family:'execution'},{...item,id:'a',eventType:'AGREEMENT_CHANGE_PROPOSED',family:'dogovor'}];
  mockState.page.unreadCount=3;await render();
  const messageRow = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && String(node.props.accessibilityLabel).startsWith('Nepročitano.')).find(node => node.findAllByType(ConversationArt.type).length > 0);
  expect(messageRow).toBeDefined();
  expect(messageRow!.findByType(ConversationArt.type).props.size).toBe(32);
  expect([drawn('check'),drawn('agreements')]).toEqual([1,1]);
});
test('a task change, a cancellation and a question are drawn as what they are, not as offers',()=>{
  expect(inboxEventArt('NEED_REVISED','responses')).toBe('tasks');
  expect(inboxEventArt('NEED_CANCELLED','responses')).toBe('tasks');
  expect(inboxEventArt('CLARIFICATION_CREATED','responses')).toBe('chat');
  expect(inboxEventArt('CLARIFICATION_ANSWERED','responses')).toBe('chat');
  expect(inboxEventArt('PRIVATE_ACCESS_GRANTED','dogovor')).toBe('lock');
  expect(inboxEventArt('REVIEW_RECEIVED','dogovor')).toBe('star');
  expect(inboxEventArt('COMPLETION_REQUIRED','dogovor')).toBe('check');
  expect(inboxEventArt('RESPONSE_SELECTED','responses')).toBe('offers');
  expect(inboxEventArt('SOMETHING_NEW','recovery')).toBe('shield');
  expect(inboxEventArt('SOMETHING_NEW','account')).toBe('bell');
});

// ---------------------------------------------------------------------------------------------------------------------
// T4a (2026-10-07): the owner's words for the tabs, where a tap goes, and settling one row without opening it (the swipe).
// ---------------------------------------------------------------------------------------------------------------------
test('the three tabs carry the owner\'s words, exactly, and the old names are nowhere on the screen',async()=>{
  const {INBOX_FILTERS}=require('../../ui/notifications/InboxPresentation');
  expect(INBOX_FILTERS.map((filter:{label:string})=>filter.label)).toEqual(['Sve','Moji zadaci','Moje prijave']);
  mockState.page.items=[item];mockState.page.unreadCount=1;await render();
  const tabs=presses().filter(node=>node.props.accessibilityRole==='tab');
  // "Zadaci" is the tab of OTHER people's tasks, so it is not also the name of a set here (2026-10-08).
  expect(tabs.map(node=>node.props.accessibilityLabel)).toEqual(['Sve','Moji zadaci','Moje prijave']);
  expect(text()).not.toMatch(/Poslovi|poslov|posao/);
});
test('under every row, with the clock, the screen says where a tap goes; a screen reader hears it as the row\'s hint',async()=>{
  const ago=(minutes:number)=>new Date(Date.parse(at)-minutes*60_000).toISOString();
  mockState.page.items=[
    {...item,id:'m',eventType:'MESSAGE_RECEIVED',family:'dogovor',title:'Nova poruka',body:'Imaš novu poruku u Dogovoru.',occurredAt:ago(1)},
    {...item,id:'c',eventType:'COMPLETION_REQUIRED',family:'execution',role:'REQUESTER',title:'Završetak čeka tvoju potvrdu',body:'Dogovor je označen kao završen.',occurredAt:ago(2)},
    {...item,id:'o',eventType:'OPPORTUNITY_AVAILABLE',family:'opportunities',title:'Nova prilika koja ti može odgovarati',body:'Prenos ormana',occurredAt:ago(3)},
    {...item,id:'x',eventType:'SOMETHING_NEW',family:'account',title:'Nešto novo',body:'Nešto se desilo.',occurredAt:ago(4)},
  ];mockState.page.unreadCount=4;await render();
  const clock=(minutes:number)=>trenutak(ago(minutes))!.sat;
  expect(text()).toContain(`${clock(1)} · Otvara poruku u Dogovoru`);
  expect(text()).toContain(`${clock(2)} · Otvara Dogovor`);
  expect(text()).toContain(`${clock(3)} · Otvara zadatak`);
  // An event the table does not know says only its clock: a destination is never made up.
  expect(text()).toContain(clock(4));expect(text()).not.toContain(`${clock(4)} ·`);
  expect(row('Nepročitano. Nešto novo.').props.accessibilityHint).toBeUndefined();
  expect(row('Nepročitano. Nova prilika koja ti može odgovarati.').props.accessibilityHint).toBe('Otvara zadatak.');
  expect(row('Nepročitano. Nova poruka.').props.accessibilityHint).toBe('Otvara poruku u Dogovoru.');
});
test('an unread row has the dot and a picture in colour; both rows are the one row of the system, with one type scale',async()=>{
  mockState.page.items=[{...item,id:'u',title:'Nepročitan',body:'Telo'},{...item,id:'r',title:'Pročitan',body:'Telo',readAt:at}];mockState.page.unreadCount=1;await render();
  const variants=(prefix:string)=>row(prefix).findAllByType('T' as React.ElementType).slice(0,2).map(node=>[node.props.variant,node.props.tone]);
  // The title is 16/24 in ink, the line under it 14/20 in grey, for every row; weight and tone no longer say read or unread (the dot and the picture do).
  expect(variants('Nepročitano. Nepročitan.')).toEqual([['bodyStrong','ink'],['note','muted']]);
  expect(variants('Pročitano. Pročitan.')).toEqual([['bodyStrong','ink'],['note','muted']]);
  expect(tree.root.findAll(node=>node.props.testID==='inbox-unread-dot'&&typeof node.type==='string')).toHaveLength(1);
  expect(picture('Nepročitano. Nepročitan.').props.muted).toBe(false);expect(picture('Pročitano. Pročitan.').props.muted).toBe(true);
});

const stamp='2026-09-10T12:05:00Z';
const unreadItems=()=>[{...item,id:'a',title:'Prva',body:'Telo prve.'},{...item,id:'b',title:'Druga',body:'Telo druge.'},{...item,id:'r',title:'Pročitana',body:'Telo.',readAt:at}];
const swipeActions=()=>presses().filter(node=>node.props.accessibilityLabel==='Pročitano');
const settle=async()=>act(async()=>{await Promise.resolve();await Promise.resolve();});
describe('settling one row without opening it',()=>{
  beforeEach(()=>{mockReadOne.mockReset().mockResolvedValue(stamp);mockState.page.items=unreadItems();mockState.page.unreadCount=2;});
  test('only an unread row has the command under it, and it is the very call a tapped row makes',async()=>{
    await render();
    expect(swipeActions()).toHaveLength(2);
    await act(async()=>swipeActions()[0].props.onPress());await settle();
    expect(mockReadOne.mock.calls).toEqual([['a']]);
    // Nothing was opened: no resolver, no navigation, the model's own commands untouched.
    expect(mockModel.open).not.toHaveBeenCalled();expect(mockRouter.push).not.toHaveBeenCalled();
    expect(swipeActions()).toHaveLength(1);
  });
  test('the row reads as read, the count above the list goes down by one, and the outcome is said once after the server answered',async()=>{
    await render();expect(readAllPress()!.props.accessibilityLabel).toContain('2 nepročitana');
    await act(async()=>swipeActions()[0].props.onPress());await settle();
    expect(row('Pročitano. Prva.')).toBeDefined();expect(unreadRow('Prva','Telo prve.')).toBeUndefined();
    expect(readAllPress()!.props.accessibilityLabel).toContain('1 nepročitano');
    expect(mockPoruka.mock.calls).toEqual([[{text:'Označeno kao pročitano.',confirmed:true}]]);
    expect(tree.root.findAll(node=>node.props.testID==='inbox-unread-dot'&&typeof node.type==='string')).toHaveLength(1);
  });
  test('the last unread row read this way takes the count row and the dots away, and says so to a screen reader',async()=>{
    mockState.page.items=[{...item,id:'a',title:'Prva',body:'Telo prve.'}];mockState.page.unreadCount=1;await render();
    await act(async()=>swipeActions()[0].props.onPress());await settle();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Nema nepročitanih obaveštenja.');
    expect(readAllPress()).toBeUndefined();
  });
  test('nothing shows as read before the server answered, and the row at work is the only one that spins',async()=>{
    let answer!:(value:string)=>void;mockReadOne.mockReturnValueOnce(new Promise<string>(resolve=>{answer=resolve;}));
    await render();
    await act(async()=>swipeActions()[0].props.onPress());
    expect(unreadRow('Prva','Telo prve.')).toBeDefined();expect(mockPoruka).not.toHaveBeenCalled();
    expect(unreadRow('Prva','Telo prve.').findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(1);
    // The others do not spin, and their command waits with the one that runs (one command at a time, below).
    expect(unreadRow('Druga','Telo druge.').findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(0);
    await act(async()=>{answer(stamp);});await settle();
    expect(row('Pročitano. Prva.')).toBeDefined();
  });
  test('one command at a time: a second press while the first is running sends nothing',async()=>{
    let answer!:(value:string)=>void;mockReadOne.mockReturnValueOnce(new Promise<string>(resolve=>{answer=resolve;}));
    await render();
    const [first,second]=swipeActions();
    await act(async()=>{first.props.onPress();second.props.onPress();});
    expect(mockReadOne).toHaveBeenCalledTimes(1);
    await act(async()=>{answer(stamp);});await settle();
  });
  test('a failure changes nothing, says so in the one notice an unconfirmed action uses, and the notice reads the list again',async()=>{
    mockReadOne.mockRejectedValue(new Error('INBOX_REQUEST_FAILED'));
    await render();
    await act(async()=>swipeActions()[0].props.onPress());await settle();
    expect(unreadRow('Prva','Telo prve.')).toBeDefined();expect(mockPoruka).not.toHaveBeenCalled();
    expect(text()).toContain('Ne znamo da li je radnja uspela.');expect(readAllPress()!.props.accessibilityLabel).toContain('2 nepročitana');
    await act(async()=>press('Osveži obaveštenja').props.onPress());
    expect(mockModel.refresh).toHaveBeenCalledTimes(1);expect(text()).not.toContain('Ne znamo da li je radnja uspela.');
  });
  test('a screen that is no longer the person\'s sends nothing',async()=>{
    await render();mockModel.canNavigate.mockReturnValue(false);
    await act(async()=>swipeActions()[0].props.onPress());await settle();
    expect(mockReadOne).not.toHaveBeenCalled();expect(mockPoruka).not.toHaveBeenCalled();
  });
  test('an answer that arrives after the screen was left is not shown or said',async()=>{
    let answer!:(value:string)=>void;mockReadOne.mockReturnValueOnce(new Promise<string>(resolve=>{answer=resolve;}));
    await render();
    await act(async()=>swipeActions()[0].props.onPress());
    mockModel.canNavigate.mockReturnValue(false);
    await act(async()=>{answer(stamp);});await settle();
    expect(mockPoruka).not.toHaveBeenCalled();expect(unreadRow('Prva','Telo prve.')).toBeDefined();
  });
  test('a message notification can be settled too: it is the person\'s explicit command, not the opening of the conversation',async()=>{
    mockState.page.items=[{...item,id:'m',eventType:'MESSAGE_RECEIVED',family:'dogovor',title:'Nova poruka',body:'Imaš novu poruku u Dogovoru.'}];mockState.page.unreadCount=1;
    await render();
    await act(async()=>swipeActions()[0].props.onPress());await settle();
    expect(mockReadOne.mock.calls).toEqual([['m']]);expect(mockModel.open).not.toHaveBeenCalled();
  });
  test('a screen reader is offered the same command in the row\'s actions menu, only for an unread row',async()=>{
    await render();
    // The list hands the actions to the system row (`ListRow`), which passes them on to the row's press once it takes them: this is
    // what the list asks for. The row's own press is read in a device check, not here.
    const rows=tree.root.findAllByType(ListRow);
    const unread=rows.find(node=>String(node.props.accessibilityLabel).startsWith('Nepročitano. Prva.'))!, read=rows.find(node=>String(node.props.accessibilityLabel).startsWith('Pročitano. Pročitana.'))!;
    expect(unread.props.accessibilityActions).toEqual([{name:'markRead',label:'Označi kao pročitano'}]);
    expect(read.props.accessibilityActions).toBeUndefined();
    // Another action name does nothing; the named one does the same as the swipe.
    await act(async()=>unread.props.onAccessibilityAction({nativeEvent:{actionName:'activate'}}));await settle();
    expect(mockReadOne).not.toHaveBeenCalled();
    await act(async()=>unread.props.onAccessibilityAction({nativeEvent:{actionName:'markRead'}}));await settle();
    expect(mockReadOne.mock.calls).toEqual([['a']]);
  });
  test('tapping a row still opens what it is about and reads it by the model, never by this command',async()=>{
    await render();
    await act(async()=>unreadRow('Prva','Telo prve.').props.onPress());
    expect(mockModel.open).toHaveBeenCalledTimes(1);expect(mockReadOne).not.toHaveBeenCalled();
  });
  test('this screen mounts its own Poruka host, clear of the system gesture area',async()=>{
    await render();
    const hosts=tree.root.findAllByType('PorukaHost' as React.ElementType);
    expect(hosts).toHaveLength(1);expect(hosts[0].props.clearance).toBe(24);
  });
});

// A civil day in Serbia ends at its own midnight, not at the one of the device or of UTC (the list groups on `trenutak`).
describe('the day groups follow the Serbian civil day',()=>{
  const {inboxRows}=require('../../ui/notifications/InboxPresentation');
  const BELGRADE='Europe/Belgrade';
  const labels=(items:{id:string;occurredAt:string}[],sada:string)=>inboxRows(items.map(({id,occurredAt})=>({...item,id,occurredAt})),{zona:BELGRADE,sada:new Date(sada)})
    .map((row:{kind:string;label?:string;id:string})=>row.kind==='day'?`# ${row.label}`:row.id);
  test('half past midnight in Serbia is already today, though UTC still says yesterday',()=>{
    // 22:30 UTC on 6 October is 00:30 on 7 October in Belgrade (UTC+2); 21:30 UTC is 23:30 on the 6th.
    expect(labels([{id:'after',occurredAt:'2026-10-06T22:30:00Z'},{id:'before',occurredAt:'2026-10-06T21:30:00Z'}],'2026-10-07T10:00:00Z'))
      .toEqual(['# Danas','after','# Juče','before']);
  });
  test('the same two moments are one day when "now" is late the same evening',()=>{
    expect(labels([{id:'a',occurredAt:'2026-10-06T21:30:00Z'},{id:'b',occurredAt:'2026-10-06T10:00:00Z'}],'2026-10-06T21:45:00Z'))
      .toEqual(['# Danas','a','b']);
  });
  test('the change from summer to winter time moves the midnight an hour, and the groups follow it',()=>{
    // Clocks go back on Sunday 25 October 2026: 23:30 UTC on the 24th is 00:30 CET on the 25th.
    expect(labels([{id:'late',occurredAt:'2026-10-24T23:30:00Z'},{id:'early',occurredAt:'2026-10-24T21:30:00Z'}],'2026-10-25T12:00:00Z'))
      .toEqual(['# Danas','late','# Juče','early']);
  });
  test('an older day is dated, the year only when it is not this one, and a moment that cannot be read gets no day of its own',()=>{
    expect(labels([{id:'now',occurredAt:'2026-10-07T08:00:00Z'},{id:'old',occurredAt:'2026-03-02T09:00:00Z'},{id:'bad',occurredAt:'not a date'},{id:'last',occurredAt:'2025-12-31T09:00:00Z'}],'2026-10-07T10:00:00Z'))
      .toEqual(['# Danas','now','# 2. mar','old','bad','# 31. dec 2025','last']);
  });
});
