// Exact current NEED/WORKER handlers with synthetic transports only.
// No provider/database/network calls; background completion is collected by waitUntil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOwnedIntakeHandler } from './owned_intake_edge_runtime.mjs';
import { loadWorkerRecoveryHandler } from './worker_recovery_edge_runtime.mjs';
import { withDialogue } from './dialogue_fixture.mjs';

const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5),rootId=id(6);
const SERVICE='SYNTHETIC_PRIVATE_SERVICE';
const USER='SYNTHETIC_PRIVATE_USER: nudim '+SERVICE+' kod naručioca.';
const REASON='SYNTHETIC_PRIVATE_REASON: potrebno je precizirati vrstu usluge.';
const PROMPT='SYNTHETIC_PRIVATE_QUESTION: koju tačno vrstu usluge želiš?';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const providerResult=body=>json({candidates:[{content:{parts:[{text:JSON.stringify(body)}]},finishReason:'STOP'}]});
const receipt={userMessageId:id(7),assistantMessageId:id(8),proposedCount:1,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true};
const needTurn=(state='SUCCEEDED')=>({conversationId:conversation,clientRequestId:key,state,turnId,retryAllowed:false,
  receipt:state==='SUCCEEDED'?receipt:null});
const workerTurn=(state='SUCCEEDED')=>({conversationId:conversation,clientRequestId:key,state,turnId,attemptId,retryAllowed:false,authoritative:true});
const storeRpc='rpc_taxonomy_store_classification_turn_hint_service';
const captureRpc='rpc_taxonomy_capture_gemini_turn_hints_service';

function fixture(kind,operation,responseFactory,options={}){
  const calls=[],logs=[],background=[],unexpected=[];
  const user=options.user??USER;
  let unchanged=false;
  const requestKey=()=>unchanged?id(10):key;
  const currentTurn=(state='SUCCEEDED')=>({...((kind==='NEED'?needTurn:workerTurn)(state)),
    clientRequestId:requestKey(),turnId:unchanged?id(11):turnId,...(kind==='WORKER'?{attemptId:unchanged?id(12):attemptId}:{})});
  const fact=(fact_key,fact_value,value_type)=>({fact_key,fact_value,value_type,display_value:JSON.stringify(fact_value),
    fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER_TEXT',created_at:'2026-10-27T10:00:00Z'});
  const completedRevision=kind==='NEED'?8:5;
  const mainOutput=kind==='NEED'?withDialogue({safety:'ALLOW',assistantMessage:'Predlog je zabeležen u nacrtu.',
    facts:[{key:'need.category',valueJson:JSON.stringify(SERVICE),displayValue:SERVICE,evidence:user,confidence:1}]}):
    {safety:'ALLOW',assistantMessage:'Predlog je zabeležen u nacrtu.',patch:{skills:[SERVICE]},
      availabilityChange:{kind:'NONE',evidence:''},
      serviceModeChangesJson:JSON.stringify([{service:SERVICE,modes:options.workerModes??['ON_SITE'],evidence:user}])};
  const decision={service:SERVICE,mode:'ON_SITE',action:operation==='store'?'NEEDS_CLARIFICATION':'CREATE_CHILD',
    parentId:operation==='store'?'':rootId,reason:REASON,ambiguityPrompt:PROMPT,handoffKind:'NONE',handoffCity:''};
  const env={SUPABASE_URL:'https://leqcwgzvjsxugfgzdmth.supabase.co',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',
    SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_PROVIDER',
    GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true'};
  const fetch=async(url,init={})=>{
    const address=String(url),body=init.body?JSON.parse(init.body):null;
    calls.push({url:address,body,signal:init.signal});
    const name=new URL(address).pathname.split('/').at(-1);
    if(address.endsWith('/auth/v1/user'))return json({id:account});
    if(address.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
    if(name==='rpc_ai_claim_need_turn_v2_service')return json({turn:currentTurn('PROCESSING'),claim:{attemptId:unchanged?id(12):attemptId,
      leaseExpiresAt:new Date(Date.now()+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',
        history:[{role:'USER',body:'Prethodni opis.',sequence_no:unchanged?7:5},{role:'ASSISTANT',body:'Prethodno pitanje.',sequence_no:unchanged?8:6}],
        activeFacts:[fact('need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad'}},'OBJECT'),
          ...(unchanged?[fact('need.category',SERVICE,'TEXT')]:[])]}}});
    if(name==='rpc_claim_worker_ai_turn_service')return json({acquired:true,turn:currentTurn('PROCESSING')});
    if(name==='rpc_read_worker_ai_context_service')return json({schemaVersion:'WORKER_PROFILE_V1',accountId:account,
      conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',revision:unchanged?5:4,profileStatus:'ACTIVE',
      serviceModeContext:{schemaVersion:'WORKER_SERVICE_MODE_CONTEXT_V1',revision:unchanged?5:4,savedServices:[],draftServices:[],unresolvedServices:[]},
      candidate:{skills:unchanged?[SERVICE]:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:user}]});
    if(name==='rpc_ai_dispatch_need_turn_v2_service')return json(true);
    if(name==='rpc_dispatch_worker_ai_turn_service')return json({dispatched:true,turn:currentTurn('PROCESSING')});
    if(name==='rpc_ai_test_budget_reserve_service')return json({admitted:true,reservationId:id(9),replay:false,code:'AI_TEST_RESERVED'});
    if(name==='rpc_ai_complete_need_turn_v2_service')return json({...currentTurn(),receipt:{...receipt,
      proposedCount:body.p_proposals.length,safety:body.p_safety}});
    if(name==='rpc_complete_worker_ai_turn_service')return json(currentTurn());
    if(name==='rpc_taxonomy_get_unconsumed_turn_hint_service')return json(null);
    if(name==='rpc_taxonomy_fetch_snapshot_v1')return json({catalogVersion:7,catalogFingerprint:'a'.repeat(32),count:1,
      categories:[{categoryId:rootId,parentId:null,label:'Synthetic root',aliases:[],path:['Synthetic root'],isLeaf:false,modes:['ON_SITE']}]});
    if(name===storeRpc||name===captureRpc){
      assert.equal(name,operation==='store'?storeRpc:captureRpc);
      return responseFactory(body);
    }
    if(name==='rpc_ai_test_record_usage_service')return json({recorded:true,authoritative:true,operationId:body.p_operation_id,
      promptTokens:body.p_prompt_tokens,outputTokens:body.p_output_tokens,totalTokens:body.p_total_tokens});
    if(name==='rpc_ai_fail_need_turn_v2_service')return json(currentTurn('FAILED'));
    if(name==='rpc_fail_worker_ai_turn_service')return json(currentTurn('FAILED'));
    if(address.startsWith('https://generativelanguage.googleapis.com/')){
      if(address.includes(':generateContent'))return providerResult(kind==='NEED'?{decisions:[decision]}:{items:options.workerDecisions??[decision]});
      const output=unchanged?(kind==='NEED'?withDialogue({safety:'ALLOW',assistantMessage:'Nacrt je ostao isti.',facts:[]}):
        {safety:'ALLOW',assistantMessage:'Opis je dopunjen.',patch:{bio:'Dopunjen opis.'},availabilityChange:{kind:'NONE',evidence:''}}):mainOutput;
      const data='data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]})+'\n\n';
      return new Response(data,{headers:{'Content-Type':'text/event-stream'}});
    }
    unexpected.push(name);throw new Error('UNEXPECTED_SYNTHETIC_ROUTE');
  };
  const load=kind==='NEED'?loadOwnedIntakeHandler:loadWorkerRecoveryHandler;
  const loaded=load({fetch,env:name=>env[name],log:args=>{logs.push(args);
    if(options.throwLog&&args[0]===kind+'_TAXONOMY_HINT_'+operation.toUpperCase())throw new Error('SYNTHETIC_PRIVATE_LOG_SINK');
  },EdgeRuntime:{waitUntil:promise=>background.push(promise)}});
  const invoke=async()=>{
    const response=await loaded.handler(new Request('https://synthetic.invalid',{method:'POST',
      headers:{Authorization:'Bearer SYNTHETIC',Accept:'text/event-stream','Content-Type':'application/json'},
      body:JSON.stringify({conversationId:conversation,clientRequestId:requestKey(),text:unchanged?'Samo dopuni opis bez promene usluge.':user})}));
    assert.equal(response.status,200);
    const events=(await response.text()).trim().split('\n\n').map(line=>JSON.parse(line.slice(6)));
    assert.ok(background.length>0,'success registers background work');
    await Promise.all(background);
    assert.deepEqual(unexpected,[]);
    assert.equal(events.at(-1).kind,'final','background failure must not fail a durable successful conversation');
    assert.equal(events.at(-1).turn.state,'SUCCEEDED');
    assert.ok(!events.some(event=>event.kind==='safe_error'));
    return events;
  };
  return {calls,logs,completedRevision,invoke,async execute(){
    const events=await invoke();
    assert.equal(calls.filter(call=>call.url.includes('generativelanguage.googleapis.com/')).length,2,'one conversational and one architect call, no retry');
    assert.equal(calls.filter(call=>call.url.includes(':generateContent')).length,1);
    assert.equal(calls.filter(call=>call.url.includes(kind==='NEED'?'rpc_ai_complete_need_turn_v2_service':'rpc_complete_worker_ai_turn_service')).length,1);
    assert.ok(!calls.some(call=>/rpc_(ai_fail_need|fail_worker)|save_worker|publish|commit_admission|push/.test(call.url)));
    const write=calls.filter(call=>call.url.endsWith('/'+(operation==='store'?storeRpc:captureRpc)));
    assert.equal(write.length,1);
    const completion=calls.find(call=>call.url.includes(kind==='NEED'?'rpc_ai_complete_need_turn_v2_service':'rpc_complete_worker_ai_turn_service'));
    assert.ok(calls.indexOf(write[0])>calls.indexOf(completion),'only an owned completed turn persists classification hints');
    assert.equal(completion.body.p_account_id,account);
    assert.equal(completion.body.p_client_request_id,key);
    assert.equal(completion.body.p_attempt_id,attemptId);
    assert.equal(write[0].body.p_conversation_id,conversation);
    if(operation==='store'){
      assert.equal(write[0].body.p_draft_revision,completedRevision);
      assert.equal(write[0].body.p_service,SERVICE);
      assert.equal(write[0].body.p_ambiguity_prompt,PROMPT);
      assert.equal(write[0].body.p_mode,'ON_SITE');
    }else{
      assert.equal(write[0].body.p_account_id,account);
      assert.equal(write[0].body.p_client_request_id,key);
      assert.equal(write[0].body.p_turn_id,turnId);
      assert.equal(write[0].body.p_attempt_id,attemptId);
      assert.equal(write[0].body.p_purpose,kind==='NEED'?'NEED_SERVICE':'WORKER_CAPABILITY');
      assert.equal(write[0].body.p_catalog_version,7);
      assert.equal(write[0].body.p_proposals[0].service,SERVICE);
    }
    const serialized=JSON.stringify(logs);
    for(const privateText of [SERVICE,USER,REASON,PROMPT,account,conversation,key,turnId,attemptId,
      'SYNTHETIC_PRIVATE_TRANSPORT','SYNTHETIC_PRIVATE_HTTP','SYNTHETIC_PRIVATE_LOG_SINK'])assert.ok(!serialized.includes(privateText));
    assert.ok(!logs.some(args=>args[0]==='BG_TAXONOMY_PROVIDER_FAILURE'),'semantic clarification and DB receipts are not provider failures');
    return events;
  },async followup(){
    // Synthetic canonical readback, not a simulated SQL transaction: the completed
    // service is present at the next revision, with no stored hint from failed BG.
    unchanged=true;
    const events=await invoke();
    assert.equal(events.at(-1).turn.clientRequestId,id(10));
    assert.equal(events.at(-1).turn.turnId,id(11));
    assert.equal(calls.filter(call=>call.url.includes(':streamGenerateContent')).length,2);
    assert.equal(calls.filter(call=>call.url.includes(':generateContent')).length,1,'unchanged followup does not retry the failed classifier');
    assert.equal(calls.filter(call=>call.url.endsWith('/'+storeRpc)||call.url.endsWith('/'+captureRpc)).length,1);
    assert.ok(!calls.some(call=>/rpc_(ai_fail_need|fail_worker)|save_worker|publish|commit_admission|push/.test(call.url)));
  }};
}

for(const modes of [['ON_SITE'],['REMOTE'],['ON_SITE','REMOTE']]){
  test(`WORKER real capture path retains complete BOTH or nothing: provider ${modes.join('+')}`,async()=>{
    const f=fixture('WORKER','capture',()=>json({action:'HINT_CAPTURED',authority:'NONE'}),{
      user:'Nudim '+SERVICE+' i kod naručioca i na daljinu.',workerModes:['ON_SITE','REMOTE'],
      workerDecisions:modes.map(mode=>({service:SERVICE,mode,action:'CREATE_CHILD',parentId:rootId,
        reason:REASON,handoffKind:'NONE',handoffCity:''})),
    });
    await f.invoke();
    const captures=f.calls.filter(call=>call.url.endsWith('/'+captureRpc));
    if(modes.length===2){
      assert.equal(captures.length,1);
      assert.deepEqual(captures[0].body.p_proposals.map(p=>p.mode),['ON_SITE','REMOTE']);
      assert.equal(captures[0].body.p_purpose,'WORKER_CAPABILITY');
    }else{
      assert.equal(captures.length,0,'no partial service leaks through the active Edge to capture RPC');
    }
    assert.equal(f.calls.filter(call=>call.url.includes(':generateContent')).length,1);
    assert.ok(!f.calls.some(call=>/save_worker|publish|commit_admission|push/.test(call.url)));
  });
}

for(const kind of ['NEED','WORKER']){
  for(const operation of ['store','capture']){
    test(kind+' valid '+operation+' ACK leaves the success stream and diagnostics clean',async()=>{
      const f=fixture(kind,operation,args=>json(operation==='store'?{stored:true,draftRevision:args.p_draft_revision}:{action:'HINT_CAPTURED',authority:'NONE'}));
      await f.execute();
      assert.ok(!f.logs.some(args=>args[0]===kind+'_TAXONOMY_HINT_STORE'||args[0]===kind+'_TAXONOMY_HINT_CAPTURE'));
    });
  }
  for(const [label,ack] of [['null',null],['false',false],['empty',{}],['false stored',{stored:false,draftRevision:kind==='NEED'?8:5}],
    ['wrong revision',{stored:true,draftRevision:99}]]){
    test(kind+' failed store '+label+' ACK emits fixed nonfatal status',async()=>{
      const f=fixture(kind,'store',()=>json(ack));await f.execute();
      assert.deepEqual(f.logs.filter(args=>args[0]===kind+'_TAXONOMY_HINT_STORE'),[[kind+'_TAXONOMY_HINT_STORE','UNAVAILABLE']]);
    });
  }
  for(const [label,ack] of [['null',null],['false',false],['empty',{}],['wrong action',{action:'OTHER',authority:'NONE'}],
    ['wrong authority',{action:'HINT_CAPTURED',authority:'CONFIRMED'}]]){
    test(kind+' malformed capture '+label+' ACK emits fixed nonfatal status',async()=>{
      const f=fixture(kind,'capture',()=>json(ack));await f.execute();
      assert.deepEqual(f.logs.filter(args=>args[0]===kind+'_TAXONOMY_HINT_CAPTURE'),
        [[kind+'_TAXONOMY_HINT_CAPTURE',kind==='NEED'?'UNAVAILABLE':'RECEIPT_UNEXPECTED']]);
    });
  }
  for(const operation of ['store','capture']){
    test(kind+' '+operation+' failure followed by unchanged canonical input has no automatic background retry',async()=>{
      const f=fixture(kind,operation,()=>json(null));await f.execute();await f.followup();
    });
    test(kind+' '+operation+' diagnostic sink failure cannot replace the successful final conversation',async()=>{
      const f=fixture(kind,operation,()=>json(null),{throwLog:true});await f.execute();
      assert.ok(f.logs.some(args=>args[0]===kind+'_TAXONOMY_HINT_'+operation.toUpperCase()));
    });
    for(const label of ['HTTP','thrown']){
      test(kind+' '+operation+' '+label+' failure emits fixed nonfatal status without retry',async()=>{
        const f=fixture(kind,operation,()=>{if(label==='thrown')throw new Error('SYNTHETIC_PRIVATE_TRANSPORT');
          return json({message:'SYNTHETIC_PRIVATE_HTTP'},503);});
        await f.execute();
        assert.deepEqual(f.logs.filter(args=>args[0]===kind+'_TAXONOMY_HINT_'+operation.toUpperCase()),
          [[kind+'_TAXONOMY_HINT_'+operation.toUpperCase(),'UNAVAILABLE']]);
      });
    }
  }
}
