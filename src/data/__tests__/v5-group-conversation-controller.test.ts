jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>({})}));
import { GroupConversationController } from '../../ui/groups/GroupConversationController';
import { groupBodyHash,type GroupJournal,type GroupContext,type GroupManagement } from '../groupConversationService';
const A='10000000-0000-4000-8000-000000000001',ID='20000000-0000-4000-8000-000000000001',G='30000000-0000-4000-8000-000000000001',K='40000000-0000-4000-8000-000000000001',M='50000000-0000-4000-8000-000000000001';
const j:GroupJournal={version:1,groupId:G,clientRequestId:K,bodySha256:groupBodyHash('Privatna zajednička poruka')};
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'GROUP_UNCONFIRMED',poruka:'Proveri ishod.'};
const context=()=>({accountId:A,agreementId:ID,needId:ID,available:true,authoritative:true as const,group:{groupId:G,title:'Zadatak',canSend:true,terminal:false,role:'PARTICIPANT',members:[],management:null,managementNextId:null,unreadCount:1}});
const message=(sequence='1')=>({messageId:M,sequence,senderAccountId:A,body:'Privatna zajednička poruka',createdAt:'2026-09-13T12:00:00Z',mine:true});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
function fixture(raw:string|null=null){let current=true;const storage={getItem:jest.fn().mockResolvedValue(raw),setItem:jest.fn().mockResolvedValue(undefined),removeItem:jest.fn().mockResolvedValue(undefined)};
 const service={context:jest.fn().mockResolvedValue(ok(context())),messages:jest.fn().mockResolvedValue(ok({messages:[message()],nextBeforeSequence:null,nextAfterSequence:null})),
 recover:jest.fn().mockResolvedValue(ok({found:false,receipt:null})),send:jest.fn().mockResolvedValue(unknown),markRead:jest.fn().mockResolvedValue(ok({markedCount:1}))};
 const uuid=jest.fn(()=>K),controller=new GroupConversationController({agreementId:ID,account:{accountId:A,accountRevision:1},current:()=>current,storage,service:service as never,uuid});
 return{controller,storage,service,uuid,setCurrent:(v:boolean)=>{current=v;}};
}
const management=(n:number):GroupManagement=>({agreementId:`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`,
 accountId:K,status:'CONFIRMED',executionState:'CONFIRMED',problemOpened:false});
const managed=(rows:GroupManagement[],next:string|null):GroupContext=>({...context(),group:{...context().group,
 role:'REQUESTER',management:rows,managementNextId:next}});
async function expandedManagement(count=51){
 const f=fixture(),rows=Array.from({length:count},(_,i)=>management(i+1));
 f.service.context.mockResolvedValueOnce(ok(managed(rows.slice(0,50),rows[49].agreementId)));
 await f.controller.load();
 f.service.context.mockResolvedValueOnce(ok(managed(rows.slice(50),count===100?rows[99].agreementId:null)));
 await f.controller.managementNext();return{...f,rows};
}
it.each([51,100])('read ACK preserves %i explicitly loaded private targets and cursor with one authority read',async count=>{
 const f=await expandedManagement(count),old=f.controller.snapshot().context!;
 const fresh=managed([{...f.rows[0],status:'CANCELLED',executionState:'CANCELLED'},...f.rows.slice(1,50)],f.rows[49].agreementId);
 fresh.group!.unreadCount=0;fresh.group!.canSend=false;fresh.group!.terminal=true;
 f.service.context.mockResolvedValue(ok(fresh));const before=f.service.context.mock.calls.length;
 const sizes:number[]=[];const off=f.controller.subscribe(()=>sizes.push(f.controller.snapshot().context?.group?.management?.length??0));
 await f.controller.markVisible([M]);off();
 const actual=f.controller.snapshot().context!.group!;
 expect(actual.management).toHaveLength(count);expect(sizes).toEqual([count]);
 expect(actual.management![0]).toMatchObject({status:'CANCELLED',executionState:'CANCELLED'});
 expect(actual).toMatchObject({members:[],unreadCount:0,canSend:false,terminal:true,managementNextId:old.group!.managementNextId});
 expect(actual.management!.at(-1)).toEqual(f.rows.at(-1));
 expect(f.service.context).toHaveBeenCalledTimes(before+1);
 await f.controller.refresh();expect(f.controller.snapshot().context!.group!.management).toHaveLength(50);
});
it('ACK first-page insertions keep the loaded tail without duplicates; a complete smaller response retires it',async()=>{
 const f=await expandedManagement(),inserted=management(0);
 f.service.context.mockResolvedValueOnce(ok(managed([inserted,...f.rows.slice(0,49)],f.rows[48].agreementId)));
 await f.controller.markVisible([M]);
 expect(f.controller.snapshot().context!.group!.management).toEqual([inserted,...f.rows]);
 f.service.context.mockResolvedValueOnce(ok(managed(f.rows.slice(0,10),null)));
 await f.controller.markVisible([M]);expect(f.controller.snapshot().context!.group!.management).toHaveLength(10);
});
it('ACK advances the refreshed prefix and drops its removed rows while keeping the loaded suffix cursor',async()=>{
 const f=await expandedManagement(100),fresh=f.rows.slice(10,60).map(row=>({...row,problemOpened:true}));
 f.service.context.mockResolvedValueOnce(ok(managed(fresh,f.rows[59].agreementId)));
 await f.controller.markVisible([M]);
 expect(f.controller.snapshot().context!.group).toMatchObject({management:[...fresh,...f.rows.slice(60)],managementNextId:f.rows[99].agreementId});
});
it.each(['denied','unavailable','account','agreement','need','group','participant'] as const)(
 'ACK never keeps expanded management across %s authority',async change=>{
  const f=await expandedManagement(),fresh=managed(f.rows.slice(0,50),f.rows[49].agreementId);
  if(change==='unavailable'){fresh.available=false;fresh.group=null;}
  if(change==='account')fresh.accountId=K;if(change==='agreement')fresh.agreementId=K;if(change==='need')fresh.needId=K;
  if(change==='group')fresh.group!.groupId=K;
  if(change==='participant'){fresh.group!.role='PARTICIPANT';fresh.group!.management=null;fresh.group!.managementNextId=null;}
  f.service.context.mockResolvedValueOnce(change==='denied'?unknown:ok(fresh));await f.controller.markVisible([M]);
  expect(f.controller.snapshot().context?.group?.management??[]).not.toContainEqual(f.rows[50]);
 });
it.each(['refresh','next','send','dispose','account'] as const)('late ACK context cannot replace newer %s',async change=>{
 const f=await expandedManagement(100),gate=deferred<unknown>(),entered=deferred<void>();
 f.service.context.mockImplementationOnce(()=>{entered.resolve();return gate.promise;});
 const ack=f.controller.markVisible([M]);await entered.promise;
 if(change==='refresh'){f.service.context.mockResolvedValueOnce(ok(managed([management(200)],null)));await f.controller.refresh();}
 if(change==='next'){f.service.context.mockResolvedValueOnce(ok(managed([management(101)],null)));await f.controller.managementNext();}
 if(change==='send')await f.controller.send('Nova poruka dok se potvrđuje čitanje.');
 if(change==='dispose')f.controller.dispose();if(change==='account')f.setCurrent(false);
 const current=f.controller.snapshot();gate.resolve(ok(managed(f.rows.slice(0,50),f.rows[49].agreementId)));await ack;
 expect(f.controller.snapshot()).toBe(current);
});
it('persists opaque identity before one dispatch despite concurrent retained taps',async()=>{
 const f=fixture(),gate=deferred<void>();await f.controller.load();f.storage.setItem.mockReturnValue(gate.promise);
 const first=f.controller.send('  Privatna zajednička poruka  ');void f.controller.send('Druga poruka');expect(f.service.send).not.toHaveBeenCalled();
 expect(f.storage.setItem).toHaveBeenCalledTimes(1);expect(JSON.parse(f.storage.setItem.mock.calls[0][1])).toEqual(j);expect(f.storage.setItem.mock.calls[0][1]).not.toMatch(/Privatna|poruka/);
 gate.resolve();await first;expect(f.service.send).toHaveBeenCalledTimes(1);expect(f.uuid).toHaveBeenCalledTimes(1);expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',canRetry:false});
});
it('restart reads exact key only; absent receipt requires same hashed reentry and explicit retry',async()=>{
 const f=fixture(JSON.stringify(j));await f.controller.load();expect(f.service.recover).toHaveBeenCalledWith(j,{accountId:A,accountRevision:1});
 expect(f.service.send).not.toHaveBeenCalled();expect(f.uuid).not.toHaveBeenCalled();expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',canRetry:true});
 await f.controller.retry('Druga poruka');expect(f.service.send).not.toHaveBeenCalled();await f.controller.retry('Privatna zajednička poruka');
 expect(f.service.send).toHaveBeenCalledWith(j,'Privatna zajednička poruka',{accountId:A,accountRevision:1});expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.uuid).not.toHaveBeenCalled();
});
it('read failure or read-only context prevents retry and never creates a replacement key',async()=>{
 const f=fixture(JSON.stringify(j));f.service.recover.mockResolvedValue(unknown);await f.controller.load();await f.controller.retry('Privatna zajednička poruka');expect(f.service.send).not.toHaveBeenCalled();
 f.service.recover.mockResolvedValue(ok({found:false,receipt:null}));f.service.context.mockResolvedValue(ok({...context(),group:{...context().group,canSend:false}}));
 await f.controller.refresh();expect(f.controller.snapshot().canRetry).toBe(false);await f.controller.retry('Privatna zajednička poruka');expect(f.service.send).not.toHaveBeenCalled();
});
it('restores authoritative receipt and resumes the real page without another tap or another send',async()=>{
 const f=fixture(JSON.stringify(j)),receipt={...j,messageId:M};f.service.recover.mockResolvedValue(ok({found:true,receipt}));await f.controller.load();
 expect(f.storage.removeItem).toHaveBeenCalledTimes(1);expect(f.controller.snapshot()).toMatchObject({phase:'READY',journal:null,messages:[message()]});
 expect(f.service.messages).toHaveBeenCalledTimes(1);expect(f.service.send).not.toHaveBeenCalled();
 await f.controller.acknowledge();expect(f.storage.removeItem).toHaveBeenCalledTimes(1);
});
it('a confirmed send stays confirmed if local cleanup fails; continuing retries cleanup, never delivery',async()=>{
 const f=fixture();await f.controller.load();f.storage.removeItem.mockRejectedValueOnce(new Error('DISK'));
 f.service.send.mockResolvedValue(ok({...j,messageId:M}));await f.controller.send('Privatna zajednička poruka');
 expect(f.controller.snapshot()).toMatchObject({phase:'CONFIRMED',canRetry:false,journal:j});
 await f.controller.retry('Privatna zajednička poruka');expect(f.service.send).toHaveBeenCalledTimes(1);
 await f.controller.acknowledge();expect(f.controller.snapshot()).toMatchObject({phase:'READY',journal:null});
 expect(f.service.send).toHaveBeenCalledTimes(1);
});
it('a late confirmed cleanup cannot restore a disposed conversation',async()=>{
 const f=fixture(),gate=deferred<void>(),entered=deferred<void>();await f.controller.load();f.storage.removeItem.mockImplementation(()=>{entered.resolve();return gate.promise;});
 f.service.send.mockResolvedValue(ok({...j,messageId:M}));const sending=f.controller.send('Privatna zajednička poruka');
 await entered.promise;expect(f.controller.snapshot().phase).toBe('CONFIRMED');
 f.controller.dispose();gate.resolve();await sending;
 expect(f.controller.snapshot().context).toBeNull();expect(f.service.messages).toHaveBeenCalledTimes(1);
});
it('storage failure never dispatches, and malformed/wrong-group journals cannot enable a fresh send',async()=>{
 const f=fixture();await f.controller.load();f.storage.setItem.mockRejectedValue(new Error('DISK'));await f.controller.send('Privatna zajednička poruka');expect(f.service.send).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('ERROR');
 const wrong=fixture(JSON.stringify({...j,groupId:ID}));await wrong.controller.load();await wrong.controller.refresh();await wrong.controller.send('Nov tekst');
 await wrong.controller.retry('Privatna zajednička poruka');expect(wrong.service.recover).not.toHaveBeenCalled();expect(wrong.service.send).not.toHaveBeenCalled();expect(wrong.controller.snapshot().phase).toBe('ERROR');
 const corrupt=fixture(JSON.stringify({...j,body:'SECRET'}));await corrupt.controller.load();expect(corrupt.service.context).not.toHaveBeenCalled();expect(corrupt.service.send).not.toHaveBeenCalled();
});
it.each(['account','dispose'])('fences late IO after %s change and keeps unsent body out of storage',async kind=>{
 const f=fixture(),gate=deferred<void>();await f.controller.load();f.storage.setItem.mockReturnValue(gate.promise);const pending=f.controller.send('Privatna zajednička poruka');
 if(kind==='account')f.setCurrent(false);else f.controller.dispose();gate.resolve();await pending;expect(f.service.send).not.toHaveBeenCalled();
});
it('never auto marks page rows and filters viewable IDs against the actual loaded owned page',async()=>{
 const f=fixture();await f.controller.load();expect(f.service.markRead).not.toHaveBeenCalled();await f.controller.markVisible([M,M,ID]);expect(f.service.markRead).toHaveBeenCalledWith(G,[M],{accountId:A,accountRevision:1});
 expect(f.service.context).toHaveBeenCalledTimes(2);
});
it('loads older pages with strict server cursor and retains chronological message identity',async()=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message('2')],nextBeforeSequence:'2',nextAfterSequence:null}));await f.controller.load();
 f.service.messages.mockResolvedValueOnce(ok({messages:[{...message(),messageId:K}],nextBeforeSequence:null,nextAfterSequence:'1'}));await f.controller.older();
 expect(f.service.messages.mock.calls[1][2]).toEqual({before:'2'});expect(f.controller.snapshot().messages.map(m=>m.sequence)).toEqual(['1','2']);
});
it('confirmed delivery cannot be repeated while its authoritative reread is pending or fails',async()=>{
 const f=fixture(),gate=deferred<unknown>(),entered=deferred<void>();await f.controller.load();
 f.service.messages.mockImplementationOnce(()=>{entered.resolve();return gate.promise;});
 f.service.send.mockResolvedValue(ok({...j,messageId:M}));const sending=f.controller.send('Privatna zajednička poruka');
 await entered.promise;expect(f.controller.snapshot().phase).toBe('LOADING');
 await f.controller.send('Druga poruka');expect(f.service.send).toHaveBeenCalledTimes(1);
 gate.resolve(unknown);await sending;expect(f.controller.snapshot().phase).toBe('ERROR');
 await f.controller.send('Druga poruka');expect(f.service.send).toHaveBeenCalledTimes(1);
 expect(f.storage.removeItem).toHaveBeenCalledTimes(1);
});
it('corrupt journal remains unreadable across refresh and cannot be overwritten by a new command',async()=>{
 const f=fixture(JSON.stringify({...j,body:'CORRUPT PRIVATE DATA'}));await f.controller.load();await f.controller.refresh();await f.controller.send('Nova poruka');
 expect(f.storage.getItem).toHaveBeenCalledTimes(2);expect(f.service.context).not.toHaveBeenCalled();expect(f.service.send).not.toHaveBeenCalled();expect(f.storage.setItem).not.toHaveBeenCalled();
 f.storage.getItem.mockResolvedValue(JSON.stringify(j));await f.controller.refresh();expect(f.service.recover).toHaveBeenCalledWith(j,{accountId:A,accountRevision:1});
 expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',journal:j});expect(f.storage.setItem).not.toHaveBeenCalled();
});
it('failed authority refresh clears displayed content and cursor before exposing recovery',async()=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message()],nextBeforeSequence:'1',nextAfterSequence:null}));await f.controller.load();
 expect(f.controller.snapshot().messages).toHaveLength(1);f.service.context.mockResolvedValue(unknown);await f.controller.refresh();
 expect(f.controller.snapshot()).toMatchObject({phase:'ERROR',context:null,messages:[],before:null});
});
it('message read denial and now-unavailable context cannot retain previously visible group rows',async()=>{
 const f=fixture();await f.controller.load();f.service.messages.mockResolvedValue(unknown);await f.controller.refresh();expect(f.controller.snapshot().messages).toEqual([]);
 f.service.messages.mockResolvedValue(ok({messages:[message()],nextBeforeSequence:null,nextAfterSequence:null}));await f.controller.refresh();expect(f.controller.snapshot().messages).toHaveLength(1);
 f.service.context.mockResolvedValue(ok({...context(),available:false,group:null}));await f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({phase:'READY',messages:[],before:null});
});


it('retains only same-context older history on transport failure, without enabling sends or read marking, then retries the exact cursor',async()=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message('2')],nextBeforeSequence:'2',nextAfterSequence:null}));await f.controller.load();
 const loaded=f.controller.snapshot().messages;
 f.service.messages.mockResolvedValueOnce({ok:false,kod:'GROUP_PAGE_TRANSPORT_UNAVAILABLE',poruka:'Veza je prekinuta.'});await f.controller.older();
 expect(f.controller.snapshot()).toMatchObject({phase:'ERROR',olderPageUnavailable:true,before:'2'});expect(f.controller.snapshot().messages).toBe(loaded);
 await f.controller.send('Nova poruka');await f.controller.markVisible([M]);expect(f.service.send).not.toHaveBeenCalled();expect(f.service.markRead).not.toHaveBeenCalled();
 f.service.messages.mockResolvedValueOnce(ok({messages:[{...message(),messageId:K}],nextBeforeSequence:null,nextAfterSequence:'1'}));await f.controller.older();
 expect(f.service.messages.mock.calls.slice(1).map(call=>call[2])).toEqual([{before:'2'},{before:'2'}]);
 expect(f.controller.snapshot()).toMatchObject({phase:'READY',olderPageUnavailable:false,before:null});expect(f.controller.snapshot().messages.map(m=>m.sequence)).toEqual(['1','2']);
});
it.each(['GROUP_UNCONFIRMED','GROUP_NOT_AVAILABLE','AUTH_CONTEXT_CHANGED','AUTH_ACCOUNT_CHANGED','GROUP_RECEIPT_INVALID'])('clears older transcript and context for non-transport failure %s',async kod=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message('2')],nextBeforeSequence:'2',nextAfterSequence:null}));await f.controller.load();
 f.service.messages.mockResolvedValue({ok:false,kod,poruka:'Nije dostupno.'});await f.controller.older();
 expect(f.controller.snapshot()).toMatchObject({phase:'ERROR',olderPageUnavailable:false,context:null,messages:[],before:null});
});
it('transport failure cannot retain initial/refresh data and disposal retires retained older history',async()=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message('2')],nextBeforeSequence:'2',nextAfterSequence:null}));await f.controller.load();
 f.service.messages.mockResolvedValue({ok:false,kod:'GROUP_PAGE_TRANSPORT_UNAVAILABLE',poruka:'Veza je prekinuta.'});await f.controller.older();
 expect(f.controller.snapshot().messages).toHaveLength(1);await f.controller.refresh();
 expect(f.controller.snapshot()).toMatchObject({phase:'ERROR',olderPageUnavailable:false,context:null,messages:[],before:null});
 const pending=fixture(),gate=deferred<unknown>();pending.service.messages.mockResolvedValueOnce(ok({messages:[message('2')],nextBeforeSequence:'2',nextAfterSequence:null}));await pending.controller.load();
 pending.service.messages.mockReturnValue(gate.promise);const older=pending.controller.older();pending.controller.dispose();gate.resolve({ok:false,kod:'GROUP_PAGE_TRANSPORT_UNAVAILABLE',poruka:'Veza.'});await older;
 expect(pending.controller.snapshot()).toMatchObject({messages:[],context:null,olderPageUnavailable:false});
});
