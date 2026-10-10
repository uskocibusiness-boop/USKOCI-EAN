import { createActivityOpportunityTargetService, decodeActivityOpportunityTarget } from '../activityOpportunityTargetService';
const mockSession={user:{id:'11111111-1111-4111-8111-111111111111'},accountRevision:1,sessionEpoch:1};
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockSession}));
const eventId='22222222-2222-4222-8222-222222222222',needId='33333333-3333-4333-8333-333333333333';
const envelope={schema:'ACTIVITY_OPPORTUNITY_TARGET_V1',accountId:mockSession.user.id,authoritative:true};
const valid={...envelope,kind:'OPPORTUNITY',eventId,needId,role:'WORKER'};
test('strict opportunity receipt admits only the recipient-bound event id and a worker need',()=>{
 expect(decodeActivityOpportunityTarget(valid,mockSession.user.id,eventId)).toEqual(valid);
 expect(decodeActivityOpportunityTarget({...envelope,kind:'UNAVAILABLE'},mockSession.user.id,eventId)).toEqual({...envelope,kind:'UNAVAILABLE'});
 for(const wrong of [{...valid,accountId:needId},{...valid,eventId:needId},{...valid,role:'REQUESTER'},{...valid,url:'/prilike/private'},{...valid,needId:'bad'},{...valid,authoritative:false},{...valid,schema:'WRONG'},{...envelope,kind:'UNAVAILABLE',needId}])
   expect(decodeActivityOpportunityTarget(wrong,mockSession.user.id,eventId)).toBeNull();
});
test('service requests one fixed RPC, never reads or marks messages, and verifies Auth receipt',async()=>{
 const rpc=jest.fn().mockResolvedValue({data:valid,error:null});
 const service=createActivityOpportunityTargetService(rpc);
 const response=await service.resolve(eventId,{}, {accountId:mockSession.user.id,accountRevision:1});
 expect(response).toEqual({ok:true,podatak:valid});
 expect(rpc).toHaveBeenCalledTimes(1);
 expect(rpc).toHaveBeenCalledWith('rpc_resolve_activity_opportunity_v1',
  {p_expected_user_id:mockSession.user.id,p_event_id:eventId},expect.any(AbortSignal));
});
test('missing RPC or wrong event fails closed, never guessing a task',async()=>{
 for(const output of [{data:null,error:{message:'missing'}},{data:{...valid,eventId:needId},error:null},{data:null,error:null}]){
  const service=createActivityOpportunityTargetService(jest.fn().mockResolvedValue(output));
  expect((await service.resolve(eventId)).ok).toBe(false);
 }
});

test('caller abort promptly releases an ignored network read without guessing a task',async()=>{
 let finish!: (value:unknown)=>void;
 const request=new jest.fn().mockImplementation((_name:string,_args:unknown,_signal:AbortSignal)=>
  new Promise<unknown>(resolve=>{finish=resolve;}));
 const service=createActivityOpportunityTargetService(request);
 const controller=new AbortController();
 const pending=service.resolve(eventId,{signal:controller.signal});
 await Promise.resolve();
 const nativeSignal=request.mock.calls[0][2] as AbortSignal;
 controller.abort();
 const result=await pending;
 expect(result).toEqual({ok:false,kod:'ACTIVITY_OPPORTUNITY_CANCELLED',poruka:'Čitanje je prekinuto.'});
 expect(nativeSignal.aborted).toBe(true);
 finish({data:valid,error:null});
 await Promise.resolve();
 expect(request).toHaveBeenCalledTimes(1);
});
test('changed session refuses the late response even when the request succeeds',async()=>{
 let finish!: (value:unknown)=>void;
 const request=jest.fn().mockImplementation(()=>new Promise<unknown>(resolve=>{finish=resolve;}));
 const service=createActivityOpportunityTargetService(request);
 const pending=service.resolve(eventId);
 await Promise.resolve();
 mockSession.accountRevision=2;
 try {
  finish({data:valid,error:null});
  const result=await pending;
  expect(result.ok).toBe(false);
  if(!result.ok) expect(result.kod).toBe('AUTH_ACCOUNT_CHANGED');
 } finally {mockSession.accountRevision=1;}
});
