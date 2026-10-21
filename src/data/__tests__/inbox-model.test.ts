import { createInboxModel } from '../inboxModel';
import type { InboxItem, InboxPage, InboxPort } from '../../contracts/inbox';
const at='2026-09-07T07:00:00Z';
const row=(id='1'): InboxItem=>({id,role:'WORKER',readAt:null,occurredAt:at,eventType:'RESPONSE_SELECTED',family:'responses',title:'Izabrani ste',body:'Otvori Dogovor.'});
const page=(items=[row()],hasMore=false): InboxPage=>({items,hasMore,unreadCount:items.length,asOf:at});
const deferred=<T,>()=>{let resolve!:(v:T)=>void;let reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
function setup() {
  const port={list:jest.fn().mockResolvedValue(page()),read:jest.fn().mockResolvedValue(at),
    readAll:jest.fn().mockResolvedValue(1),resolve:jest.fn().mockResolvedValue({kind:'AGREEMENT',id:'a',role:'WORKER'})} satisfies InboxPort;
  let current=true;
  const model=createInboxModel(port,'WORKER',()=>current);
  return {port,model,logout:()=>{current=false;}};
}
describe('Inbox lifecycle and command ownership',()=>{
  it('keeps the verified application read within the row visit and owner Need',async()=>{
    const {port}=setup(), application={...row(),eventType:'RESPONSE_RECEIVED',role:'REQUESTER' as const};
    port.list.mockResolvedValue(page([application]));
    port.resolve.mockResolvedValue({kind:'CANDIDATES',id:'need-1',role:'REQUESTER'});
    const exact={kind:'CANDIDATE',id:'need-1',responseId:'response-1',role:'REQUESTER'};
    const resolveApplication=jest.fn().mockResolvedValue(exact);
    const model=createInboxModel(port,null,()=>true,undefined,resolveApplication);
    model.start();await flush();
    expect(await model.open(application)).toEqual(exact);
    expect(resolveApplication).toHaveBeenCalledWith(application.id,'need-1',expect.any(AbortSignal));
    expect(port.read).toHaveBeenCalledWith(application.id);
  });
  it('never opens a late application target after the Inbox visit ends',async()=>{
    const {port}=setup(), application={...row(),eventType:'RESPONSE_RECEIVED',role:'REQUESTER' as const};
    port.list.mockResolvedValue(page([application]));
    port.resolve.mockResolvedValue({kind:'CANDIDATES',id:'need-1',role:'REQUESTER'});
    const pending=deferred<any>(), resolveApplication=jest.fn().mockReturnValue(pending.promise);
    const model=createInboxModel(port,null,()=>true,undefined,resolveApplication);
    model.start();await flush();const opened=model.open(application);await flush();
    model.stop();expect(resolveApplication.mock.calls[0][2].aborted).toBe(true);
    pending.resolve({kind:'CANDIDATE',id:'need-1',responseId:'response-1',role:'REQUESTER'});
    expect(await opened).toBeNull();
  });
  it('uses the exact message target and never reads the event or falls back to an Agreement guess',async()=>{
    const {port}=setup(), message={...row(),eventType:'MESSAGE_RECEIVED'};
    port.list.mockResolvedValue(page([message]));
    const target={kind:'AGREEMENT_MESSAGE',id:'agreement',messageId:'message',eventId:message.id,role:'WORKER'};
    const resolveMessage=jest.fn().mockResolvedValue(target);
    const model=createInboxModel(port,null,()=>true,resolveMessage);
    model.start();await flush();
    expect(await model.open(message)).toEqual(target);
    expect(resolveMessage).toHaveBeenCalledWith(message.id,expect.any(AbortSignal));
    expect(port.resolve).not.toHaveBeenCalled();expect(port.read).not.toHaveBeenCalled();
    expect(model.snapshot().page?.unreadCount).toBe(1);
  });
  it.each(['missing','unavailable','error','wrong event','wrong role','generic'] as const)(
    'never guesses or acknowledges a message target when %s',async mode=>{
      const {port}=setup(),message={...row(),eventType:'MESSAGE_RECEIVED'};
      port.list.mockResolvedValue(page([message]));
      const exact={kind:'AGREEMENT_MESSAGE',id:'agreement',messageId:'message',eventId:message.id,role:'WORKER'};
      const resolve=jest.fn().mockResolvedValue(mode==='unavailable'?{kind:'UNAVAILABLE'}:
        mode==='wrong event'?{...exact,eventId:'other'}:mode==='wrong role'?{...exact,role:'REQUESTER'}:
          mode==='generic'?{kind:'AGREEMENT',id:'agreement',role:'WORKER'}:exact);
      if(mode==='error')resolve.mockRejectedValue(new Error('unconfirmed'));
      const model=createInboxModel(port,null,()=>true,mode==='missing'?undefined:resolve);
      model.start();await flush();const result=await model.open(message);
      expect(result).toEqual(mode==='unavailable'?{kind:'UNAVAILABLE'}:null);
      expect(port.resolve).not.toHaveBeenCalled();expect(port.read).not.toHaveBeenCalled();
      expect(model.snapshot().page?.unreadCount).toBe(1);
      expect(model.snapshot()).toMatchObject(mode==='unavailable'?{unavailable:true,error:null}:{error:'action'});
    });
  it.each(['stop','account'] as const)('retires exact-message navigation after %s',async mode=>{
    const {port}=setup(),message={...row(),eventType:'MESSAGE_RECEIVED'};
    port.list.mockResolvedValue(page([message]));let current=true;
    const pending=deferred<any>(), resolve=jest.fn().mockReturnValue(pending.promise);
    const model=createInboxModel(port,null,()=>current,resolve);
    model.start();await flush();const opened=model.open(message);await flush();
    expect(await model.open(message)).toBeNull();expect(resolve).toHaveBeenCalledTimes(1);
    if(mode==='stop'){model.stop();expect(resolve.mock.calls[0][1].aborted).toBe(true);}else current=false;
    pending.resolve({kind:'AGREEMENT_MESSAGE',id:'agreement',messageId:'message',eventId:message.id,role:'WORKER'});
    expect(await opened).toBeNull();expect(port.read).not.toHaveBeenCalled();expect(port.resolve).not.toHaveBeenCalled();
  });
  it('never displays a late page after logout or blur',async()=>{
    for (const method of ['logout','blur']) {
      const {port,model,logout}=setup();const pending=deferred<InboxPage>();port.list.mockReturnValue(pending.promise);
      model.start();if(method==='logout')logout();else model.stop();
      pending.resolve(page());await flush();expect(model.snapshot().page).toBeNull();
    }
  });
  it('latest refresh wins and a load failure is not an authoritative empty state',async()=>{
    const {port,model}=setup();const first=deferred<InboxPage>();port.list.mockReturnValueOnce(first.promise);
    model.start();await model.refresh();first.resolve(page([row('old')]));await flush();
    expect(model.snapshot().page?.items[0].id).toBe('1');
    port.list.mockRejectedValueOnce(new Error('offline'));await model.refresh();
    expect(model.snapshot().error).toBe('load');expect(model.snapshot().page?.items).toHaveLength(1);
  });
  it('initial failure stays distinct from successful empty',async()=>{
    const {port,model}=setup();port.list.mockRejectedValueOnce(new Error());model.start();await flush();
    expect(model.snapshot()).toMatchObject({page:null,error:'load',loading:false});
    port.list.mockResolvedValueOnce(page([]));await model.refresh();expect(model.snapshot().page?.items).toEqual([]);
  });
  it('serializes paging and merges by event identity',async()=>{
    const {port,model}=setup();port.list.mockResolvedValueOnce(page([row()],true));model.start();await flush();
    const pending=deferred<InboxPage>();port.list.mockReturnValueOnce(pending.promise);
    const running=model.more();await model.more();expect(port.list).toHaveBeenCalledTimes(2);
    expect(port.list).toHaveBeenLastCalledWith('WORKER',{at,id:'1'});
    pending.resolve(page([row(),row('2')]));await running;
    expect(model.snapshot().page?.items.map(x=>x.id)).toEqual(['1','2']);
  });
  it('refresh invalidates in-flight pagination',async()=>{
    const {port,model}=setup();port.list.mockResolvedValueOnce(page([row()],true));model.start();await flush();
    const old=deferred<InboxPage>();port.list.mockReturnValueOnce(old.promise);const pending=model.more();
    port.list.mockResolvedValueOnce(page([row('new')]));await model.refresh();old.resolve(page([row('old')]));await pending;
    expect(model.snapshot().page?.items.map(x=>x.id)).toEqual(['new']);
  });
  it('does not mark read on failure or navigate before server acknowledgment',async()=>{
    const {port,model}=setup();model.start();await flush();port.read.mockRejectedValueOnce(new Error());
    expect(await model.open(row())).toBeNull();expect(model.snapshot().page?.items[0].readAt).toBeNull();expect(port.resolve).not.toHaveBeenCalled();
    expect(await model.open(row())).toMatchObject({kind:'AGREEMENT'});
    expect(model.snapshot().page?.items[0].readAt).toBe(at);expect(model.snapshot().page?.unreadCount).toBe(0);
  });
  it('suppresses duplicate taps and navigation resolved after account loss',async()=>{
    const {port,model,logout}=setup();model.start();await flush();const pending=deferred<unknown>();port.resolve.mockReturnValue(pending.promise);
    const opened=model.open(row());await flush();expect(await model.open(row())).toBeNull();
    logout();pending.resolve({kind:'AGREEMENT',id:'a',role:'WORKER'});expect(await opened).toBeNull();
    expect(port.read).toHaveBeenCalledTimes(1);
  });
  it('preserves read ack if resolver is unavailable and supports retry after error',async()=>{
    const {port,model}=setup();model.start();await flush();port.resolve.mockRejectedValueOnce(new Error());
    await model.open(row());expect(model.snapshot().error).toBe('action');expect(model.snapshot().page?.unreadCount).toBe(0);
    port.resolve.mockResolvedValueOnce({kind:'UNAVAILABLE'});await model.open(row());
    expect(model.snapshot()).toMatchObject({error:null,unavailable:true});expect(model.snapshot().page?.unreadCount).toBe(0);
  });
  it('read-all uses server asOf and then reads authoritative arrivals/count',async()=>{
    const {port,model}=setup();model.start();await flush();port.list.mockResolvedValueOnce(page([row('new')]));
    await model.readAll();expect(port.readAll).toHaveBeenCalledWith(at,'WORKER');
    expect(model.snapshot().page?.unreadCount).toBe(1);expect(model.snapshot().page?.items[0].id).toBe('new');
  });
  it('failed read-all leaves counts untouched and restart clears abandoned actions',async()=>{
    const {port,model}=setup();model.start();await flush();port.readAll.mockRejectedValueOnce(new Error());
    await model.readAll();expect(model.snapshot()).toMatchObject({acting:null,error:'action'});expect(model.snapshot().page?.unreadCount).toBe(1);
    const pending=deferred<string>();port.read.mockReturnValueOnce(pending.promise);const opened=model.open(row());model.stop();model.start();await flush();
    pending.resolve(at);expect(await opened).toBeNull();expect(model.snapshot().acting).toBeNull();
  });
});
