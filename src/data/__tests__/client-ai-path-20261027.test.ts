// Independent synthetic client review. No Supabase, provider or device I/O.
import { aiTaskReviewClientService as service, type AiTaskReviewEnvelope, type AiTaskPublicationCommand } from '../aiTaskReviewClientService';

const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const OWNER=id(1),CONVERSATION=id(2),REVIEW=id(3),KEY='abcdefab-1111-4111-8111-111111111114',OTHER_KEY=id(5),NEED=id(6);
const mockSession={user:{id:OWNER},accountRevision:1};
const mockRpc=jest.fn(),mockInvoke=jest.fn(),mockGetSession=jest.fn();
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockSession}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc,functions:{invoke:mockInvoke},auth:{getSession:mockGetSession}})}));
const answer=(data:unknown)=>({data,error:null});
const review=():AiTaskReviewEnvelope=>({
 reviewId:REVIEW,accountId:OWNER,conversationId:CONVERSATION,schemaVersion:'NEED_FACT_V2',draftId:null,draftRevision:0,
 displayedContentDigest:'a'.repeat(64),factsRevision:'b'.repeat(64),sourceTurnRevision:2,geographyRevision:'c'.repeat(64),
 expiresAt:'2099-10-01T00:00:00Z',responseDeadline:null,publicProjection:[],ownerPrivateProjection:[],
 location:{taskCountryCode:'RS',geography:{mode:'REMOTE'},exactAddress:null,accessNotes:null,resolvedLocation:null},
 missingRequired:[],canAccept:true,safety:'ALLOW',
});
const accepted=(key=KEY):AiTaskPublicationCommand=>({reviewId:REVIEW,clientRequestId:key,needId:NEED,needRevision:1,
 state:'ACCEPTED',evaluation:null,published:null,authoritative:true});
const evaluated=(key=KEY):AiTaskPublicationCommand=>({...accepted(key),state:'EVALUATED',evaluation:{kind:'DECISION',decision:{
 decisionId:id(7),decisionSequence:1,needId:NEED,needRevision:1,canonicalFingerprint:'d'.repeat(64),
 policyBundleId:id(8),policyVersion:1,jurisdiction:'RS',outcome:'ALLOW',decisionAt:'2026-10-27T12:00:00Z',
 ruleIds:['SYNTHETIC_RULE'],safeReasonCodes:[],publishable:true,authoritative:true,
}}});
const published=(key=KEY):AiTaskPublicationCommand=>({...evaluated(key),state:'PUBLISHED',published:{needId:NEED,status:'PUBLISHED',
 publishedAt:'2026-10-27T12:00:01Z',responseDeadline:null,idempotentReplay:false}});
beforeEach(()=>{
 mockRpc.mockReset();mockInvoke.mockReset();mockGetSession.mockReset();
 mockGetSession.mockResolvedValue({data:{session:{user:{id:OWNER},access_token:'SYNTHETIC_ONLY'}},error:null});
});

it('same owned review and exact submitted command key remains a valid draft receipt',async()=>{
 mockRpc.mockResolvedValueOnce(answer(accepted()));
 await expect(service.acceptAsDraft({review:review(),clientRequestId:KEY})).resolves.toEqual({ok:true,podatak:accepted()});
 expect(mockRpc).toHaveBeenCalledWith('rpc_accept_ai_task_review',{
  p_review_id:REVIEW,p_displayed_content_digest:'a'.repeat(64),p_client_request_id:KEY,
 });
 expect(mockInvoke).not.toHaveBeenCalled();
});

it('canonical UUID case is equivalent at acceptance without changing the sent command',async()=>{
 mockRpc.mockResolvedValueOnce(answer(accepted()));
 await expect(service.acceptAsDraft({review:review(),clientRequestId:KEY.toUpperCase()}))
  .resolves.toEqual({ok:true,podatak:accepted()});
 expect(mockRpc.mock.calls[0][1].p_client_request_id).toBe(KEY.toUpperCase());
});

it('same review accepted under a new key recovers its earlier canonical command key',async()=>{
 mockRpc.mockResolvedValueOnce(answer(accepted(OTHER_KEY)));
 await expect(service.acceptAsDraft({review:review(),clientRequestId:KEY}))
  .resolves.toEqual({ok:true,podatak:accepted(OTHER_KEY)});
 expect(mockRpc).toHaveBeenCalledTimes(1);expect(mockInvoke).not.toHaveBeenCalled();
});

it('acceptAndPublish safely resumes the existing review command even when acceptance used a new key',async()=>{
 let stored=accepted(OTHER_KEY);
 mockRpc.mockImplementation(async(name:string)=>{
  if(name==='rpc_accept_ai_task_review')return answer(stored);
  if(name==='rpc_read_ai_task_review')return answer({review:review(),command:stored});
  if(name==='rpc_publish_accepted_ai_task_review'){stored=published(OTHER_KEY);return answer(stored);}
  throw new Error('UNEXPECTED_RPC');
 });
 mockInvoke.mockImplementation(async()=>{stored=evaluated(OTHER_KEY);return answer(stored.evaluation);});
 await expect(service.acceptAndPublish({review:review(),clientRequestId:KEY}))
  .resolves.toEqual({ok:true,podatak:published(OTHER_KEY)});
 expect(mockInvoke).toHaveBeenCalledTimes(1);
 expect(mockRpc).toHaveBeenCalledWith('rpc_publish_accepted_ai_task_review',{
  p_review_id:REVIEW,p_client_request_id:OTHER_KEY,
 });
 const callsBefore=mockRpc.mock.calls.length;
 await expect(service.resume(stored)).resolves.toEqual({ok:true,podatak:published(OTHER_KEY)});
 expect(mockRpc.mock.calls.slice(callsBefore).map(call=>call[0])).toEqual(['rpc_read_ai_task_review']);
 expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it('a different review receipt remains invalid before any evaluator dispatch',async()=>{
 mockRpc.mockResolvedValueOnce(answer({...accepted(OTHER_KEY),reviewId:id(9)}));
 await expect(service.acceptAndPublish({review:review(),clientRequestId:KEY}))
  .resolves.toMatchObject({ok:false,kod:'TASK_REVIEW_INVALID_RESPONSE'});
 expect(mockInvoke).not.toHaveBeenCalled();expect(mockGetSession).not.toHaveBeenCalled();
});

it('C01: readback after evaluation cannot switch the original command key before publishing',async()=>{
 let afterEvaluation=false;
 mockRpc.mockImplementation(async(name:string)=>{
  if(name==='rpc_read_ai_task_review')return answer({review:review(),command:afterEvaluation?evaluated(OTHER_KEY):accepted()});
  if(name==='rpc_publish_accepted_ai_task_review')return answer(published(OTHER_KEY));
  throw new Error('UNEXPECTED_RPC');
 });
 mockInvoke.mockImplementation(async()=>{afterEvaluation=true;return answer(evaluated().evaluation);});
 await expect(service.resume(accepted())).resolves.toMatchObject({ok:false,kod:'TASK_REVIEW_COMMAND_MISMATCH'});
 expect(mockInvoke).toHaveBeenCalledTimes(1);
 expect(mockRpc.mock.calls.some(call=>call[0]==='rpc_publish_accepted_ai_task_review')).toBe(false);
});

it('C01: publication receipt must retain the evaluated command key',async()=>{
 mockRpc.mockImplementation(async(name:string)=>{
  if(name==='rpc_read_ai_task_review')return answer({review:review(),command:evaluated()});
  if(name==='rpc_publish_accepted_ai_task_review')return answer(published(OTHER_KEY));
  throw new Error('UNEXPECTED_RPC');
 });
 await expect(service.resume(evaluated())).resolves.toMatchObject({ok:false,kod:'TASK_REVIEW_INVALID_RESPONSE'});
 expect(mockInvoke).not.toHaveBeenCalled();
});

it.each(['ACCEPTED','EVALUATED','PUBLISHED'] as const)('canonical %s recovery permits the same UUID in another case',async state=>{
 let stored=state==='ACCEPTED'?accepted():state==='EVALUATED'?evaluated():published();
 mockRpc.mockImplementation(async(name:string)=>{
  if(name==='rpc_read_ai_task_review')return answer({review:review(),command:stored});
  if(name==='rpc_publish_accepted_ai_task_review'){stored=published(KEY.toUpperCase());return answer(stored);}
  throw new Error('UNEXPECTED_RPC');
 });
 mockInvoke.mockImplementation(async()=>{stored=evaluated();return answer(stored.evaluation);});
 await expect(service.resume({...stored,clientRequestId:KEY.toUpperCase()}))
  .resolves.toMatchObject({ok:true,podatak:{state:'PUBLISHED'}});
 expect(mockInvoke).toHaveBeenCalledTimes(state==='ACCEPTED'?1:0);
 const callsBefore=mockRpc.mock.calls.length;
 await expect(service.resume(published())).resolves.toMatchObject({ok:true,podatak:{state:'PUBLISHED'}});
 expect(mockRpc.mock.calls.slice(callsBefore).map(call=>call[0])).toEqual(['rpc_read_ai_task_review']);
 expect(mockInvoke).toHaveBeenCalledTimes(state==='ACCEPTED'?1:0);
});

it('canonical latest recovery may discover another existing command; it does not dispatch any side effect',async()=>{
 mockRpc.mockResolvedValueOnce(answer({review:review(),command:accepted(OTHER_KEY)}));
 await expect(service.readLatest(CONVERSATION)).resolves.toEqual({ok:true,podatak:{review:review(),command:accepted(OTHER_KEY)}});
 expect(mockRpc.mock.calls.map(call=>call[0])).toEqual(['rpc_read_latest_ai_task_review']);
 expect(mockInvoke).not.toHaveBeenCalled();
});

it('C01: the initially selected key stays frozen while evaluation is pending',async()=>{
 const selected={...accepted()};let afterEvaluation=false;
 mockRpc.mockImplementation(async(name:string)=>{
  if(name==='rpc_read_ai_task_review')return answer({review:review(),command:afterEvaluation?evaluated(OTHER_KEY):accepted()});
  if(name==='rpc_publish_accepted_ai_task_review')return answer(published(OTHER_KEY));
  throw new Error('UNEXPECTED_RPC');
 });
 mockInvoke.mockImplementation(async()=>{selected.clientRequestId=OTHER_KEY;afterEvaluation=true;return answer(evaluated().evaluation);});
 await expect(service.resume(selected)).resolves.toMatchObject({ok:false,kod:'TASK_REVIEW_COMMAND_MISMATCH'});
 expect(mockRpc.mock.calls.some(call=>call[0]==='rpc_publish_accepted_ai_task_review')).toBe(false);
});
