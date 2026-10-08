import { createInboxService } from '../inboxClientService';
jest.mock('../supabaseClient',()=>({supabaseKlijent:jest.fn()}));
const id='12345678-1234-1234-1234-123456789012';
const at='2026-09-07T07:00:00Z';
const event={id,eventType:'RESPONSE_SELECTED',role:'WORKER',occurredAt:at,readAt:null,
  title:'Vaša prijava je izabrana',body:'Otvori Dogovor.',family:'responses'};
describe('Inbox production adapter',()=>{
  // INBOX-NASLOV (owner's phone, 8 Oct 2026: "Dogovor je otkazan" twice and no word of which task): the read may carry the task's title.
  it('keeps the task title the read carries, and reads a row without one as before',async()=>{
    const titled={...event,id:'12345678-1234-1234-1234-123456789013',taskTitle:'Krečenje stana od 80 m²'};
    const untitled={...event,id:'12345678-1234-1234-1234-123456789014',taskTitle:null};
    const blank={...event,id:'12345678-1234-1234-1234-123456789015',taskTitle:'   '};
    const rpc=jest.fn().mockResolvedValue({data:{items:[titled,untitled,blank,event],unreadCount:0,hasMore:false,asOf:at},error:null});
    const result=await createInboxService(rpc).list(null);
    expect(result.items.map(item=>item.taskTitle)).toEqual(['Krečenje stana od 80 m²',undefined,undefined,undefined]);
    expect('taskTitle' in result.items[1]).toBe(false);
  });
  it('refuses a task title that is not text',async()=>{
    const rpc=jest.fn().mockResolvedValue({data:{items:[{...event,taskTitle:7}],unreadCount:0,hasMore:false,asOf:at},error:null});
    await expect(createInboxService(rpc).list(null)).rejects.toThrow('INBOX_INVALID_PROJECTION');
  });
  it('sends paired cursor and role and returns only a validated projection',async()=>{
    const rpc=jest.fn().mockResolvedValue({data:{items:[event],unreadCount:1,hasMore:false,asOf:at},error:null});
    const result=await createInboxService(rpc).list('WORKER',{id,at},20);
    expect(rpc).toHaveBeenCalledWith('rpc_list_inbox',{p_role:'WORKER',p_limit:20,p_before_id:id,p_before_at:at});
    expect(result.items).toEqual([event]);
  });
  it('never converts an API failure into empty Inbox or zero unread',async()=>{
    const rpc=jest.fn().mockResolvedValue({data:null,error:{message:'private SQL error'}});
    await expect(createInboxService(rpc).list(null)).rejects.toThrow('INBOX_REQUEST_FAILED');
  });
  it('bounds a hung command without inventing its acknowledgment and allows a fresh authoritative read',async()=>{
    jest.useFakeTimers();
    try {
      let resolve!: (value: {data:unknown;error:null}) => void;
      const rpc=jest.fn().mockReturnValueOnce(new Promise<{data:unknown;error:null}>(done=>{resolve=done;}));
      const service=createInboxService(rpc), pending=service.read(id);
      const rejected=expect(pending).rejects.toThrow('INBOX_REQUEST_UNCONFIRMED');
      await jest.advanceTimersByTimeAsync(15_000); await rejected;
      resolve({data:at,error:null}); await Promise.resolve();
      rpc.mockResolvedValueOnce({data:{items:[{...event,readAt:at}],unreadCount:0,hasMore:false,asOf:at},error:null});
      expect((await service.list(null)).items[0].readAt).toBe(at);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });
  it('invokes mark-all transport synchronously before another account can replace the model owner',async()=>{
    let actor='account-a';const requests:{name:string;actor:string}[]=[];
    const rpc=jest.fn((name:string)=>{requests.push({name,actor});return Promise.resolve({data:1,error:null});});
    const pending=createInboxService(rpc).readAll(at,'WORKER');actor='account-b';
    expect(requests).toEqual([{name:'rpc_mark_inbox_read',actor:'account-a'}]);
    expect(await pending).toBe(1);
  });
  it.each([null,{}, {items:[],unreadCount:0,hasMore:true,asOf:at},
    {items:[event,event],unreadCount:1,hasMore:false,asOf:at},
    {items:[{...event,readAt:'invalid'}],unreadCount:1,hasMore:false,asOf:at}])('rejects malformed results',async(data)=>{
    await expect(createInboxService(jest.fn().mockResolvedValue({data,error:null})).list(null)).rejects.toThrow();
  });
  it('requires server read acknowledgment; it does not manufacture timestamps',async()=>{
    const rpc=jest.fn().mockResolvedValue({data:at,error:null});
    expect(await createInboxService(rpc).read(id)).toBe(at);
    expect(rpc).toHaveBeenCalledWith('rpc_mark_activity_event_read',{p_event_id:id});
    rpc.mockResolvedValue({data:null,error:null});
    await expect(createInboxService(rpc).read(id)).rejects.toThrow();
  });
  it('uses server snapshot boundary for mark-all and rejects arbitrary route targets',async()=>{
    const rpc=jest.fn().mockResolvedValue({data:2,error:null});
    expect(await createInboxService(rpc).readAll(at,'REQUESTER')).toBe(2);
    expect(rpc).toHaveBeenCalledWith('rpc_mark_inbox_read',{p_through:at,p_role:'REQUESTER'});
    rpc.mockResolvedValue({data:{kind:'ARBITRARY',id,role:'WORKER',route:'/admin'},error:null});
    await expect(createInboxService(rpc).resolve(id)).rejects.toThrow();
    rpc.mockResolvedValue({data:{kind:'UNAVAILABLE'},error:null});
    expect(await createInboxService(rpc).resolve(id)).toEqual({kind:'UNAVAILABLE'});
  });
});
