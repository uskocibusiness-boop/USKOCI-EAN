jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockOwner}));
import { groupConversationService as service,groupBodyHash,parseGroupJournal,type GroupJournal } from '../groupConversationService';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',ID='20000000-0000-4000-8000-000000000001',G='30000000-0000-4000-8000-000000000001',K='40000000-0000-4000-8000-000000000001',M='50000000-0000-4000-8000-000000000001';
const mockRpc=jest.fn();let mockOwner={user:{id:A},accountRevision:3};const account={accountId:A,accountRevision:3};
const j:GroupJournal={version:1,groupId:G,clientRequestId:K,bodySha256:groupBodyHash('Zajednička poruka')};
const time='2026-09-13T12:00:00.123456Z',ok=(data:unknown)=>({data,error:null});
const context=()=>({accountId:A,agreementId:ID,needId:ID,available:true,authoritative:true,group:{groupId:G,title:'Zadatak',canSend:true,terminal:false,role:'PARTICIPANT',members:[{accountId:A,profileId:A,displayName:'Ana',role:'PARTICIPANT'}],management:null,managementNextId:null,unreadCount:1}});
const message=(sequence='1')=>({messageId:M,sequence,senderAccountId:B,body:'Zajednička poruka',createdAt:time,mine:false});
const page=()=>({accountId:A,groupId:G,messages:[message()],nextBeforeSequence:null,nextAfterSequence:null,authoritative:true});
const receipt=()=>({accountId:A,groupId:G,clientRequestId:K,messageId:M,sequence:'1',bodySha256:j.bodySha256,createdAt:time,idempotentReplay:false,authoritative:true});
beforeEach(()=>{mockRpc.mockReset();mockOwner={user:{id:A},accountRevision:3};});
it('reads exact owned Agreement context and keeps role-sensitive management absent for a participant',async()=>{
 mockRpc.mockResolvedValue(ok(context()));expect(await service.context(ID,account)).toEqual({ok:true,podatak:context()});
 expect(mockRpc).toHaveBeenCalledWith('rpc_read_group_context_v5',{p_expected_user_id:A,p_agreement_id:ID,p_management_after_id:null});
});
it.each([{accountId:B},{agreementId:B},{available:false},{authoritative:false},{secret:'PRIVATE'}])('rejects hostile context envelope %#',async patch=>{
 mockRpc.mockResolvedValue(ok({...context(),...patch}));expect((await service.context(ID,account)).ok).toBe(false);
});
it.each([{management:[]},{managementNextId:K},{canSend:true,terminal:true},{unreadCount:-1},{unreadCount:0.1},{role:'ADMIN'},
 {members:[{accountId:B,profileId:B,displayName:'Peer',role:'PARTICIPANT',price:5000}]},{members:context().group.members.concat(context().group.members)},
 {members:[{accountId:A,profileId:A,displayName:'',role:'PARTICIPANT'}]}])('rejects private leaks or contradictory group authority %#',async patch=>{
 mockRpc.mockResolvedValue(ok({...context(),group:{...context().group,...patch}}));expect((await service.context(ID,account)).ok).toBe(false);
});
it('accepts requester management with actual canonical execution states and bounded cursor',async()=>{
 const data={...context(),group:{...context().group,role:'REQUESTER',management:[{agreementId:ID,accountId:B,status:'CONFIRMED',executionState:'AWAITING_REQUESTER',problemOpened:false}]}};
 mockRpc.mockResolvedValue(ok(data));expect((await service.context(ID,account)).ok).toBe(true);
 mockRpc.mockResolvedValue(ok({...data,group:{...data.group,managementNextId:ID}}));expect((await service.context(ID,account)).ok).toBe(false);
});
it('accepts former-member empty roster and unavailable bilateral context without invented authority',async()=>{
 mockRpc.mockResolvedValue(ok({...context(),group:{...context().group,canSend:false,members:[]}}));expect((await service.context(ID,account)).ok).toBe(true);
 mockRpc.mockResolvedValue(ok({...context(),available:false,group:null}));expect((await service.context(ID,account)).ok).toBe(true);
});
it('reads bounded chronological message page and preserves server precision',async()=>{
 mockRpc.mockResolvedValue(ok(page()));expect(await service.messages(G,account)).toEqual({ok:true,podatak:page()});
 expect(mockRpc.mock.calls[0][1]).toEqual({p_expected_user_id:A,p_group_id:G,p_after_sequence:null,p_before_sequence:null});
});
it.each([{mine:true},{sequence:'0'},{sequence:'01'},{sequence:'9007199254740991'},{body:''},{body:' x '},{body:'x'.repeat(2001)},
 {createdAt:'today'},{senderAccountId:'bad'},{privateTerms:'LEAK'}])('rejects malformed or private message fields %#',async patch=>{
 mockRpc.mockResolvedValue(ok({...page(),messages:[{...message(),...patch}]}));expect((await service.messages(G,account)).ok).toBe(false);
});
it('rejects duplicate IDs, descending order, cursor conflicts and pages over50',async()=>{
 for(const messages of [[message(),message('2')],[message('2'),{...message(),messageId:K}],Array.from({length:51},(_,i)=>({...message(String(i+1)),messageId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`}))]){
  mockRpc.mockResolvedValue(ok({...page(),messages}));expect((await service.messages(G,account)).ok).toBe(false);
 }
 mockRpc.mockResolvedValue(ok(page()));expect((await service.messages(G,account,{after:'1'})).ok).toBe(false);
 expect((await service.messages(G,account,{before:'1'})).ok).toBe(false);
 mockRpc.mockResolvedValue(ok({...page(),nextBeforeSequence:'3'}));expect((await service.messages(G,account)).ok).toBe(false);
});
it('rejects invalid cursors before IO',async()=>{
 for(const cursor of [{after:'1',before:'2'},{after:'-1'},{before:'0'},{after:'9007199254740991'}])expect((await service.messages(G,account,cursor)).ok).toBe(false);
 expect(mockRpc).not.toHaveBeenCalled();
});
it('stores only four opaque fields and rejects altered or oversized journals',()=>{
 expect(parseGroupJournal(JSON.stringify(j))).toEqual(j);
 for(const patch of [{body:'PRIVATE'},{groupId:'bad'},{clientRequestId:'bad'},{version:2},{bodySha256:'A'.repeat(64)}])expect(()=>parseGroupJournal(JSON.stringify({...j,...patch}))).toThrow();
 expect(()=>parseGroupJournal('x'.repeat(513))).toThrow();
});
it('reads actor/key receipt, checks hash, then accepts send only with exact payload',async()=>{
 const found={accountId:A,groupId:G,clientRequestId:K,found:true,receipt:receipt(),authoritative:true};mockRpc.mockResolvedValue(ok(found));
 expect(await service.recover(j,account)).toEqual({ok:true,podatak:{found:true,receipt:receipt()}});
 mockRpc.mockResolvedValue(ok(receipt()));expect((await service.send(j,'Zajednička poruka',account)).ok).toBe(true);
 mockRpc.mockClear();expect((await service.send(j,'Druga poruka',account)).ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();
 // The same sentence the controller says for the same case (`GroupConversationController.retry`): one wording for a text that differs from the sent one.
 expect(await service.send(j,'Druga poruka',account)).toMatchObject({ok:false,kod:'GROUP_MESSAGE_KEY_REUSED',poruka:'Tekst se razlikuje od poslate poruke. Upiši istu poruku, bez izmena.'});
});
it.each([{accountId:B},{groupId:ID},{clientRequestId:M},{bodySha256:'b'.repeat(64)},{sequence:'0'},{authoritative:false},{body:'PRIVATE'}])('rejects wrong command receipts %#',async patch=>{
 mockRpc.mockResolvedValue(ok({...receipt(),...patch}));expect((await service.send(j,'Zajednička poruka',account)).ok).toBe(false);
});
it('marks only bounded IDs and decodes actual count without optimistic unread inference',async()=>{
 mockRpc.mockResolvedValue(ok({accountId:A,groupId:G,markedCount:1,authoritative:true}));expect(await service.markRead(G,[M],account)).toEqual({ok:true,podatak:{markedCount:1}});
 mockRpc.mockResolvedValue(ok({accountId:A,groupId:G,markedCount:2,authoritative:true}));expect((await service.markRead(G,[M],account)).ok).toBe(false);
 mockRpc.mockClear();for(const ids of [[],[M,M],['bad']])expect((await service.markRead(G,ids,account)).ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();
});
it('fences account changes before request and after a late response; arbitrary server text stays hidden',async()=>{
 mockOwner.accountRevision=4;expect((await service.context(ID,account)).ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();mockOwner.accountRevision=3;
 mockRpc.mockImplementation(async()=>{mockOwner.user.id=B;return ok(context());});expect(await service.context(ID,account)).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
 mockOwner.user.id=A;mockRpc.mockResolvedValue({data:null,error:{message:'SECRET PROVIDER TEXT'}});expect(JSON.stringify(await service.context(ID,account))).not.toContain('SECRET');
});
it('binds receipt identity and mark count to immutable command arguments across pending IO',async()=>{
 let done!:(v:unknown)=>void;mockRpc.mockImplementation(()=>new Promise(resolve=>{done=resolve;}));
 const command={...j},owner={...account},pending=service.send(command,'Zajednička poruka',owner);
 command.groupId=ID;command.bodySha256='b'.repeat(64);owner.accountId=B;done(ok(receipt()));expect((await pending).ok).toBe(true);
 const ids=[M],marked=service.markRead(G,ids,account);ids.push(K);done(ok({accountId:A,groupId:G,markedCount:2,authoritative:true}));expect((await marked).ok).toBe(false);
});


it('classifies only an opted-in message-page SDK status-zero failure; context and writes stay generic',async()=>{
 const noResponse={data:null,error:{message:'TypeError: private transport details',code:''},status:0,statusText:''};
 mockRpc.mockResolvedValue(noResponse);
 expect(await service.messages(G,account)).toMatchObject({ok:false,kod:'GROUP_PAGE_TRANSPORT_UNAVAILABLE'});
 expect(await service.context(ID,account)).toMatchObject({ok:false,kod:'GROUP_UNCONFIRMED'});
 expect(await service.send(j,'Zajednička poruka',account)).toMatchObject({ok:false,kod:'GROUP_UNCONFIRMED'});
 expect(JSON.stringify(await service.messages(G,account))).not.toContain('private transport details');
});
it.each([
 [{data:null,error:{message:'GROUP_NOT_AVAILABLE',code:'42501'},status:403},'GROUP_NOT_AVAILABLE'],
 [{data:null,error:{message:'AUTH_CONTEXT_CHANGED',code:'28000'},status:401},'AUTH_CONTEXT_CHANGED'],
 [{data:null,error:{message:'unknown denial',code:''},status:401},'GROUP_UNCONFIRMED'],
 [{data:null,error:{message:'unknown failure',code:''}},'GROUP_UNCONFIRMED'],
 [{data:null,error:null,status:200},'GROUP_RECEIPT_INVALID'],
])('never classifies a denial, unmapped response or invalid receipt as page transport failure %#',async(response,kod)=>{
 mockRpc.mockResolvedValue(response);expect(await service.messages(G,account)).toMatchObject({ok:false,kod});
});
it('uses only its own bounded read timeout and lets an account change take precedence',async()=>{
 jest.useFakeTimers();
 try{
  mockRpc.mockImplementation(()=>new Promise(()=>{}));
  const pageRead=service.messages(G,account);jest.advanceTimersByTime(15_000);
  expect(await pageRead).toMatchObject({ok:false,kod:'GROUP_PAGE_TRANSPORT_UNAVAILABLE'});
  const contextRead=service.context(ID,account);jest.advanceTimersByTime(15_000);
  expect(await contextRead).toMatchObject({ok:false,kod:'GROUP_UNCONFIRMED'});
  const stale=service.messages(G,account);mockOwner.accountRevision++;jest.advanceTimersByTime(15_000);
  expect(await stale).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
 }finally{jest.useRealTimers();}
 mockOwner.accountRevision=3;mockRpc.mockRejectedValue(new Error('RPC_RECEIPT_TIMEOUT'));
 expect(await service.messages(G,account)).toMatchObject({ok:false,kod:'GROUP_UNCONFIRMED'});
});
