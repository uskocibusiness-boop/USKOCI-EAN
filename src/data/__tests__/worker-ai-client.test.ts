import {workerAiClientService as service,WORKER_AI_READ_TRANSPORT_UNAVAILABLE,explicitWorkerModes,decodeWorkerAiTurnRecovery,decodeWorkerAiProfile,decodeWorkerAiReview,decodeWorkerAiSnapshot,type WorkerAiProfile,type WorkerAiReview,type WorkerAiSaved} from '../workerAiClientService';
const OWNER='11111111-1111-4111-8111-111111111111',OTHER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CONVERSATION='22222222-2222-4222-8222-222222222222',
 PROFILE='33333333-3333-4333-8333-333333333333',REVIEW='44444444-4444-4444-8444-444444444444',KEY='55555555-5555-4555-8555-555555555555';
let mockSession: {user:{id:string};accountRevision:number;session?:{access_token:string}}={user:{id:OWNER},accountRevision:1};const mockRpc=jest.fn();
const mockStream=jest.fn();
jest.mock('../aiNeedTurnStream',()=>({requestAiTurnStream:(...args:unknown[])=>mockStream(...args)}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockSession}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc})}));
const profile=():WorkerAiProfile=>({displayName:'Petar',bio:'Prenos stvari',skills:['Prenos'],tools:['Kolica'],vehicles:['Kombi'],licenses:[],teamCapacity:3,
 location:{operatingCountryCode:'RS',city:'Beograd',radiusKm:25,approximatePosition:null},availability:{timezone:'Europe/Belgrade',availableNow:true,rules:[],windows:[]}});
const review=():WorkerAiReview=>({schemaVersion:'WORKER_PROFILE_V1',reviewId:REVIEW,conversationId:CONVERSATION,accountId:OWNER,profileId:PROFILE,
 revision:2,profile:profile(),activate:true,missingRequired:[],canAccept:true,expiresAt:'2026-10-01T00:00:00Z',displayedContentDigest:'a'.repeat(64)});
const saved=():WorkerAiSaved=>({reviewId:REVIEW,conversationId:CONVERSATION,accountId:OWNER,profileId:PROFILE,profileStatus:'ACTIVE',saved:true,authoritative:true});
const snapshot=(done=false)=>({schemaVersion:'WORKER_PROFILE_V1',conversationId:CONVERSATION,accountId:OWNER,profileId:PROFILE,status:done?'COMPLETED':'OPEN',
 profileStatus:done?'ACTIVE':'DRAFT',revision:2,candidate:profile(),safety:'ALLOW',stale:done,messages:[],turn:null,review:review(),saved:done?saved():null});
beforeEach(()=>{mockSession={user:{id:OWNER},accountRevision:1};mockRpc.mockReset();mockRpc.mockImplementation(async(name:string)=>({error:null,data:
 name==='rpc_prepare_worker_ai_review'?review():name==='rpc_save_worker_ai_review'?saved():snapshot()}));});
it('distinguishes proved no-response reads from an explicit server refusal',async()=>{
 mockRpc.mockResolvedValueOnce({status:0,data:null,error:{code:'',message:'offline'}});
 await expect(service.read(CONVERSATION)).resolves.toMatchObject({ok:false,kod:WORKER_AI_READ_TRANSPORT_UNAVAILABLE});
 mockRpc.mockResolvedValueOnce({status:403,data:null,error:{code:'42501',message:'WORKER_AI_DENIED'}});
 await expect(service.read(CONVERSATION)).resolves.toMatchObject({ok:false,kod:'WORKER_AI_DENIED'});
});
it('single profile review does not invoke canonical save or per-field confirmation',async()=>{
 await expect(service.prepare(CONVERSATION,2,true)).resolves.toEqual({ok:true,podatak:review()});expect(mockRpc.mock.calls.map(x=>x[0])).toEqual(['rpc_prepare_worker_ai_review']);
});
it('accepts only the exact signed equipment preservation policy while retaining legacy reviews',()=>{
 const old=review();
 expect(decodeWorkerAiReview(old,OWNER,CONVERSATION)).toEqual(old);
 const updated={...old,equipmentPolicy:'PRESERVE_LEGACY_NO_WRITE_V1'};
 expect(decodeWorkerAiReview(updated,OWNER,CONVERSATION)).toEqual(updated);
 expect(decodeWorkerAiReview({...old,equipmentPolicy:'CLEAR'},OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiReview({...updated,otherEquipmentPolicy:true},OWNER,CONVERSATION)).toBeNull();
});
it('allows a slow worker response within55 seconds and retains the same request identity',async()=>{
 jest.useFakeTimers();
 const priorUrl=process.env.EXPO_PUBLIC_SUPABASE_URL,priorKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
 try {
  process.env.EXPO_PUBLIC_SUPABASE_URL='https://synthetic.invalid';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='SYNTHETIC';
  mockSession.session={access_token:'SYNTHETIC'};
  let resolve!:(value:unknown)=>void;mockStream.mockReturnValue(new Promise(done=>{resolve=done;}));
  const before=Date.now(),pending=service.send(CONVERSATION,'Synthetic input',KEY,{onText:()=>{}});
  let settled=false;void pending.then(()=>{settled=true;});
  await jest.advanceTimersByTimeAsync(20000);expect(settled).toBe(false);
  const receipt={turnId:REVIEW,conversationId:CONVERSATION,clientRequestId:KEY,attemptId:PROFILE,state:'SUCCEEDED',retryAllowed:false,authoritative:true};
  resolve({error:null,data:receipt});await expect(pending).resolves.toEqual({ok:true,podatak:receipt});
  expect(mockStream).toHaveBeenCalledTimes(1);expect(mockStream.mock.calls[0][0]).toMatchObject({clientRequestId:KEY,deadline:before+55000});
 } finally {
  if(priorUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=priorUrl;
  if(priorKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=priorKey;
  mockStream.mockReset();jest.useRealTimers();
 }
});
it('explicit save sends only immutable server review identity/digest and one command key',async()=>{
 await expect(service.save(review(),KEY)).resolves.toEqual({ok:true,podatak:saved()});expect(mockRpc).toHaveBeenCalledTimes(1);
 expect(mockRpc).toHaveBeenCalledWith('rpc_save_worker_ai_review',{p_review_id:REVIEW,p_displayed_digest:'a'.repeat(64),p_client_request_id:KEY});
});
it('out-of-owner review and copied task-fact schema cannot become a write',async()=>{
 await expect(service.save({...review(),accountId:OTHER},KEY)).resolves.toMatchObject({ok:false});
 expect(decodeWorkerAiReview({...review(),schemaVersion:'NEED_FACT_V2'},OWNER,CONVERSATION)).toBeNull();expect(mockRpc).not.toHaveBeenCalled();
});
it('late response after account round trip is discarded',async()=>{
 mockRpc.mockImplementation(async()=>{mockSession={user:{id:OWNER},accountRevision:3};return{data:saved(),error:null};});
 await expect(service.save(review(),KEY)).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
});
it('lost response recovers completed immutable review and saved receipt from server',async()=>{
 mockRpc.mockRejectedValueOnce(new Error('LOST_ACK'));await expect(service.save(review(),KEY)).resolves.toMatchObject({ok:false});
 mockRpc.mockResolvedValueOnce({data:snapshot(true),error:null});await expect(service.read(CONVERSATION)).resolves.toMatchObject({ok:true,podatak:{status:'COMPLETED',saved:saved()}});
 expect(mockRpc.mock.calls.map(x=>x[0])).toEqual(['rpc_save_worker_ai_review','rpc_read_worker_ai']);
});
it.each([{profileStatus:'DRAFT'},{profileId:OTHER},{reviewId:OTHER},{saved:false}])('rejects incomplete or foreign final receipt %p',async patch=>{
 mockRpc.mockResolvedValue({data:{...saved(),...patch},error:null});await expect(service.save(review(),KEY)).resolves.toMatchObject({ok:false,kod:'WORKER_AI_INVALID_RESPONSE'});
});
it('profile supports draft empty country/city and rejects hidden verification/precision fields',()=>{
 expect(decodeWorkerAiProfile({...profile(),location:{operatingCountryCode:null,city:'',radiusKm:15,approximatePosition:null}})).not.toBeNull();
 expect(decodeWorkerAiProfile({...profile(),verifiedIdentity:true})).toBeNull();
 expect(decodeWorkerAiProfile({...profile(),location:{...profile().location,approximatePosition:{latitude:44.8123,longitude:20.46}}})).toBeNull();
});
it('review labels remain truthful and profile conversation receipts cannot cross owners',()=>{
 expect(decodeWorkerAiReview({...review(),missingRequired:['Ime'],canAccept:true},OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiSnapshot({...snapshot(),accountId:OTHER},OWNER)).toBeNull();
 expect(decodeWorkerAiSnapshot({...snapshot(true),saved:{...saved(),profileId:OTHER}},OWNER)).toBeNull();
});
it('unsafe SQL details stay out of owner-facing errors',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'WORKER_AI_STALE',details:'PRIVATE_SQL_SENTINEL'}});
 const result=await service.save(review(),KEY);expect(result).toMatchObject({ok:false,kod:'WORKER_AI_STALE'});expect(JSON.stringify(result)).not.toContain('PRIVATE_SQL_SENTINEL');
});

const recovery=()=>({schemaVersion:'WORKER_PROFILE_V1',accountId:OWNER,conversationId:CONVERSATION,profileId:PROFILE,conversationStatus:'OPEN',clientRequestId:KEY,
 turn:null,providerDispatched:false,cancelled:false,canCancel:true,retryAllowed:true,authoritative:true});
it('reads exact opaque command before retry and passes expected owner to cancellation',async()=>{
 mockRpc.mockResolvedValue({data:recovery(),error:null});
 await expect(service.recoverTurn(CONVERSATION,KEY)).resolves.toEqual({ok:true,podatak:recovery()});
 await expect(service.cancelTurn(CONVERSATION,KEY)).resolves.toEqual({ok:true,podatak:recovery()});
 expect(mockRpc.mock.calls).toEqual(['rpc_read_worker_ai_turn_recovery','rpc_cancel_worker_ai_turn'].map(n=>[n,{p_expected_user_id:OWNER,p_conversation_id:CONVERSATION,p_client_request_id:KEY}]));
});
it.each([{accountId:OTHER},{clientRequestId:OTHER},{conversationId:OTHER},{providerDispatched:true},{cancelled:true},{hidden:'private'},{canCancel:false}])('strict recovery rejects foreign/inconsistent receipt %p',patch=>{
 expect(decodeWorkerAiTurnRecovery({...recovery(),...patch},OWNER,CONVERSATION,KEY)).toBeNull();
});
it('cancellation account revision fence rejects late round-trip response',async()=>{
 mockRpc.mockImplementation(async()=>{mockSession={user:{id:OWNER},accountRevision:3};return{data:recovery(),error:null};});
 await expect(service.cancelTurn(CONVERSATION,KEY)).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
});
const dispatchedRecovery=(state:string,cancelled=false)=>({...recovery(),turn:{turnId:OTHER,conversationId:CONVERSATION,
 clientRequestId:KEY,attemptId:OWNER,state,retryAllowed:false,authoritative:true},providerDispatched:true,
 cancelled,canCancel:!cancelled,retryAllowed:false});
it.each(['PROCESSING','UNKNOWN_OUTCOME'])('accepts explicit owner exit from dispatched %s without retry permission',state=>{
 const value=dispatchedRecovery(state);expect(decodeWorkerAiTurnRecovery(value,OWNER,CONVERSATION,KEY)).toEqual(value);
});
it('accepts cancelled FAILED while preserving true dispatch evidence',()=>{
 const value=dispatchedRecovery('FAILED',true);expect(decodeWorkerAiTurnRecovery(value,OWNER,CONVERSATION,KEY)).toEqual(value);
});
it.each([{canCancel:true},{retryAllowed:true},{turn:null},{turn:{...dispatchedRecovery('PROCESSING').turn}},
 {turn:{...dispatchedRecovery('SUCCEEDED').turn}}])('rejects contradictory dispatched cancellation %p',patch=>{
 expect(decodeWorkerAiTurnRecovery({...dispatchedRecovery('FAILED',true),...patch},OWNER,CONVERSATION,KEY)).toBeNull();
});


const SIGNED_CATEGORY='66666666-6666-4666-8666-666666666666';
const signedWorkerReview=()=>({
  ...review(),classificationState:'READY' as const,
  classificationCandidates:[{action:'REUSE_EXISTING' as const,service:'Prenos',mode:'ON_SITE' as const,
    categoryId:SIGNED_CATEGORY,catalogVersion:3,reason:'Verified server canonical identity'}],
  reviewedServiceModes:[{service:'Prenos',mode:'ON_SITE' as const}],
  classificationCatalogVersion:3,classificationCatalogFingerprint:'c'.repeat(32),
});
it('preserves signed per-service handoff and exact category witness without widening the worker modes',()=>{
 const handoff={required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}};
 const base=signedWorkerReview();
 const candidate={...base.classificationCandidates[0],action:'EXTEND_MODE',mode:'REMOTE',categoryLabel:'Prenos',categoryParentId:null,handoff};
 const signed={...base,reviewedServiceModes:[{service:'Prenos',mode:'REMOTE'}],classificationCandidates:[candidate]};
 expect(decodeWorkerAiReview(signed,OWNER,CONVERSATION)).toMatchObject({reviewedServiceModes:signed.reviewedServiceModes,classificationCandidates:[candidate]});
 for(const patch of [{categoryLabel:undefined},{categoryParentId:'bad'},{handoff:{required:true}},{handoff:{...handoff,exactAddress:'PRIVATE 42'}}])
   expect(decodeWorkerAiReview({...signed,classificationCandidates:[{...candidate,...patch}]},OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiReview({...signed,reviewedServiceModes:[{service:'Prenos',mode:'ON_SITE'}],
   classificationCandidates:[{...candidate,mode:'ON_SITE'}]},OWNER,CONVERSATION)).toBeNull();
 expect(mockRpc).not.toHaveBeenCalled();
});
it('accepts signed ON_SITE scope for the actual visible worker skill and preserves one Save',async()=>{
 const signed=signedWorkerReview();
 expect(decodeWorkerAiReview(signed,OWNER,CONVERSATION)).toEqual(signed);
 mockRpc.mockResolvedValueOnce({data:saved(),error:null});
 await expect(service.save(signed,KEY)).resolves.toEqual({ok:true,podatak:saved()});
 expect(mockRpc.mock.calls).toEqual([['rpc_save_worker_ai_review',
   {p_review_id:REVIEW,p_displayed_digest:'a'.repeat(64),p_client_request_id:KEY}]]);
});
it('accepts two explicit modes under one visible service without two approval buttons',()=>{
 const first=signedWorkerReview();
 const twice={...first,reviewedServiceModes:[...first.reviewedServiceModes,{service:'Prenos',mode:'REMOTE'}],
   classificationCandidates:[...first.classificationCandidates,
     {...first.classificationCandidates[0],mode:'REMOTE'}]};
 expect(decodeWorkerAiReview(twice,OWNER,CONVERSATION)).toMatchObject({reviewedServiceModes:twice.reviewedServiceModes});
});
it('accepts a signed new child only when its visible path ends in the reviewed skill',()=>{
 const base=signedWorkerReview();
 const child={action:'CREATE_CHILD',service:'Prenos',mode:'ON_SITE',
   parentId:SIGNED_CATEGORY,parentLabel:'Transport',path:['Prenos'],
   catalogVersion:3,reason:'Owner-reviewed new service under the established parent'};
 expect(decodeWorkerAiReview({...base,classificationCandidates:[child]},OWNER,CONVERSATION))
   .toMatchObject({classificationCandidates:[child]});
 const deep={...child,path:[...Array.from({length:9},(_,i)=>'Grana '+i),'Prenos']};
 expect(decodeWorkerAiReview({...base,classificationCandidates:[deep]},OWNER,CONVERSATION)?.classificationCandidates).toMatchObject([deep]);
 expect(decodeWorkerAiReview({...base,classificationCandidates:[{...child,path:['Druga usluga']}]},OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiReview({...base,classificationCandidates:[{...child,parentId:'bad'}]},OWNER,CONVERSATION)).toBeNull();
});
it('accepts a signed new main branch only with a null parent and reviewed skill',()=>{
 const base=signedWorkerReview();
 const root={action:'CREATE_NEW_BRANCH',service:'Prenos',mode:'ON_SITE',
   parentId:null,parentLabel:null,path:['Nova vrsta pomoći','Prenos'],
   catalogVersion:3,reason:'No established main branch covers this explicit service'};
 expect(decodeWorkerAiReview({...base,classificationCandidates:[root]},OWNER,CONVERSATION))
   .toMatchObject({classificationCandidates:[root]});
 expect(decodeWorkerAiReview({...base,classificationCandidates:[{...root,parentId:SIGNED_CATEGORY}]},OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiReview({...base,classificationCandidates:[{...root,path:['Druga usluga']}]},OWNER,CONVERSATION)).toBeNull();
});
it('pending classification preserves the old skill text but never authorizes fake modes',()=>{
 const pending={...signedWorkerReview(),classificationState:'PENDING_CLASSIFICATION',
   classificationCandidates:[],reviewedServiceModes:[],classificationCatalogVersion:null,classificationCatalogFingerprint:null};
 expect(decodeWorkerAiReview(pending,OWNER,CONVERSATION)).toMatchObject({classificationState:'PENDING_CLASSIFICATION'});
 expect(decodeWorkerAiReview({...pending,reviewedServiceModes:[{service:'Prenos',mode:'ON_SITE'}]},OWNER,CONVERSATION)).toBeNull();
});
it.each([
 {classificationCatalogVersion:4},
 {classificationCatalogFingerprint:'wrong'},
 {reviewedServiceModes:[{service:'Nepostojeća veština',mode:'ON_SITE'}]},
 {reviewedServiceModes:[{service:'Prenos',mode:'REMOTE'}]},
 {reviewedServiceModes:[{service:'Prenos',mode:'ON_SITE'},{service:'Prenos',mode:'ON_SITE'}]},
 {classificationCandidates:[{...signedWorkerReview().classificationCandidates[0],categoryId:'not-a-uuid'}]},
 {classificationCandidates:[]},
 {classificationCandidates:[{...signedWorkerReview().classificationCandidates[0],mode:'REMOTE'}]},
 {classificationCandidates:[{...signedWorkerReview().classificationCandidates[0],extra:'not-authorized'}]},
 {classificationState:'UNKNOWN'},
 {classificationCatalogFingerprint:undefined},
])('rejects contradictory or forged signed worker scope %p',patch=>{
 expect(decodeWorkerAiReview({...signedWorkerReview(),...patch},OWNER,CONVERSATION)).toBeNull();
});
it('does not accept a partial classification contract or foreign signed worker review',async()=>{
 const {reviewedServiceModes:_omit,...partial}=signedWorkerReview();
 expect(decodeWorkerAiReview(partial,OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiReview({...signedWorkerReview(),accountId:OTHER},OWNER,CONVERSATION)).toBeNull();
 await expect(service.save(partial as WorkerAiReview,KEY)).resolves.toMatchObject({ok:false});
 expect(mockRpc).not.toHaveBeenCalled();
});


it('old installed APK mode uses ONLY the untouched legacy prepare/read RPCs',async()=>{
 const prior=process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
 try{
  delete process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
  await expect(service.prepare(CONVERSATION,2,true)).resolves.toMatchObject({ok:true});
  await expect(service.read(CONVERSATION)).resolves.toMatchObject({ok:true});
  expect(mockRpc.mock.calls.map(c=>c[0])).toEqual(['rpc_prepare_worker_ai_review','rpc_read_worker_ai']);
 }finally{
  if(prior===undefined)delete process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
  else process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW=prior;
 }
});
it('explicit OTA opt-in uses versioned signed prepare/read without changing Save RPC',async()=>{
 const prior=process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
 try{
  process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW='true';
  const signed=signedWorkerReview();
  mockRpc.mockImplementation(async (name:string)=>({data:name==='rpc_prepare_worker_ai_review_taxonomy'?signed:
    name==='rpc_read_worker_ai_taxonomy'?{...snapshot(),review:signed}:
    name==='rpc_save_worker_ai_review'?saved():null,error:null}));
  await expect(service.prepare(CONVERSATION,2,true)).resolves.toEqual({ok:true,podatak:signed});
  await expect(service.read(CONVERSATION)).resolves.toMatchObject({ok:true,podatak:{review:signed}});
  await expect(service.save(signed,KEY)).resolves.toMatchObject({ok:true});
  expect(mockRpc.mock.calls.map(c=>c[0])).toEqual([
    'rpc_prepare_worker_ai_review_taxonomy','rpc_read_worker_ai_taxonomy','rpc_save_worker_ai_review']);
 }finally{
  if(prior===undefined)delete process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
  else process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW=prior;
 }
});

it('explicit worker mode contract never assumes scope or silently omits a skill',()=>{
 const skills=['Časovi matematike','Montaža nameštaja'];
 expect(explicitWorkerModes(skills,{})).toBeNull();
 expect(explicitWorkerModes(skills,{'Časovi matematike':'BOTH'})).toBeNull();
 expect(explicitWorkerModes(skills,{'Časovi matematike':'BOTH','Montaža nameštaja':'ON_SITE'}))
  .toEqual([{service:'Časovi matematike',mode:'ON_SITE'},{service:'Časovi matematike',mode:'REMOTE'},
    {service:'Montaža nameštaja',mode:'ON_SITE'}]);
 expect(explicitWorkerModes(['Ponovljeno','Ponovljeno'],{'Ponovljeno':'REMOTE'})).toBeNull();
});
it('manual scope RPC remains disabled unless both signed-review and explicit-mode flags are enabled',async()=>{
 const old=process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES;
 const signed=process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
 try{
  process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES='true';
  process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW='false';
  const result=await service.prepareConfirmed(CONVERSATION,2,true,[{service:'Prenos',mode:'ON_SITE'}]);
  expect(result.ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();
 }finally{
  if(old===undefined)delete process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES;else process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES=old;
  if(signed===undefined)delete process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;else process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW=signed;
 }
});
it('signed manual mode request sends the exact worker-selected service and scope, never a global guess',async()=>{
 const old=process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES;
 const signed=process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;
 try{
  process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES='true';
  process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW='true';
  const pending={...review(),classificationState:'SERVICE_MODE_CONFIRMATION_REQUIRED',
    classificationCandidates:[],reviewedServiceModes:[],classificationCatalogVersion:null,
    classificationCatalogFingerprint:null};
  mockRpc.mockResolvedValueOnce({data:pending,error:null});
  const result=await service.prepareConfirmed(CONVERSATION,2,true,[{service:'Prenos',mode:'ON_SITE'}]);
  expect(result.ok).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith('rpc_prepare_worker_ai_review_taxonomy_confirmed',
   {p_conversation_id:CONVERSATION,p_expected_revision:2,p_activate:true,
    p_selected_modes:[{service:'Prenos',mode:'ON_SITE'}]});
 }finally{
  if(old===undefined)delete process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES;else process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES=old;
  if(signed===undefined)delete process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW;else process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW=signed;
 }
});
