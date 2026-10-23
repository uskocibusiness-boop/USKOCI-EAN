// Exact source under synthetic I/O. Not a provider or deployed-stream proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {withDialogue} from './dialogue_fixture.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const receipt={userMessageId:id(6),assistantMessageId:id(7),proposedCount:0,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true};
const turn=(state='SUCCEEDED')=>({conversationId:conversation,clientRequestId:key,state,turnId,retryAllowed:false,receipt:state==='SUCCEEDED'?receipt:null});
const oneNodeCatalog=(body,node)=>{
 const q=body.p_query,labels=[node.label,...node.aliases],matches=q.scope!=='ON_SITE'&&q.operation!=='META'&&
  (q.operation==='EXACT'?labels.includes(q.text):q.operation==='SEARCH'?labels.some(label=>label.includes(q.text)):
   q.operation==='RESOLVE'?q.categoryIds.includes(node.categoryId):q.operation==='ROOTS');
 const items=matches?[{...node,modes:['REMOTE'],pathIds:[node.categoryId]}]:[];
 return {schemaVersion:'TAXONOMY_CATALOG_QUERY_V1',action:'CATALOG_QUERY',operation:q.operation,scope:q.scope,
  catalogVersion:7,catalogFingerprint:'a'.repeat(32),items,count:items.length,nextCursor:null,
  classificationAuthority:'NONE',capabilityAuthority:'NONE',notificationAuthority:'NONE'};
};
function fixture(config={}){
 const calls=[];const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',
   AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_PROVIDER',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',...config.env};
 const message=config.message??'Čujem te. Pregledaj zadatak 🟢.';
 const raw=JSON.stringify(withDialogue(config.output??{safety:'ALLOW',assistantMessage:message,facts:[]}));
 const providerStream=()=>{
   const fragments=config.fragments??Array.from(raw); // Real provider deltas, split at every character.
   const encoded=fragments.map((text,i)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(i===fragments.length-1?{finishReason:config.finishReason??'STOP'}:{})}]})+'\r\n\r\n').join('');
   const bytes=new TextEncoder().encode(encoded);
   return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=13)controller.enqueue(bytes.slice(i,i+13));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
 };
 const fetch=async(url,init={})=>{
   const body=init.body?JSON.parse(init.body):null;calls.push({url:String(url),body,init,abortedAtCall:init.signal?.aborted});
   if(url.endsWith('/auth/v1/user'))return json({id:account});
   if(url.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
   if(url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))return config.dispatch?.(body)??json(true);
  if(url.endsWith('/rpc_ai_claim_need_turn_v2_service')||url.endsWith('/rpc_ai_claim_need_location_turn_v1_service'))return json({turn:turn(config.replay?'SUCCEEDED':'PROCESSING'),claim:config.replay?null:{attemptId,leaseExpiresAt:new Date(Date.now()+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:config.history??[],activeFacts:config.activeFacts??[]}}});
   if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(config.budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
   if(url.startsWith('https://generativelanguage.googleapis.com/'))return config.provider?.(init)??(config.locationContext
    ?json({candidates:[{content:{parts:[{text:raw}]},finishReason:'STOP'}]}):providerStream());
   if(url.endsWith('/rpc_ai_complete_need_location_turn_v1_service')){const c=config.locationContext;return json({
    turn:{...turn(),receipt:{...receipt,proposedCount:body.p_proposals.length,safety:body.p_safety}},
    location:{version:1,promptToken:c.promptToken,reviewRevision:c.reviewRevision,slot:c.slot,proposalId:c.proposal?.id??null,action:body.p_location_action}});}
   if(url.endsWith('/rpc_ai_complete_need_turn_v2_service')){if(config.completionError)throw Error('SYNTHETIC_COMPLETION_ACK_LOST');return json({...turn(),...(config.badReceipt?{turnId:id(99)}:{}),receipt:{...receipt,proposedCount:body.p_proposals.length,safety:body.p_safety}});}
   if(url.endsWith('/rpc_ai_fail_need_turn_v2_service'))return json(config.failureReceipt??turn('FAILED'));
   if(url.endsWith('/rpc_ai_test_record_usage_service'))return json({recorded:true,authoritative:true,operationId:body.p_operation_id,
    promptTokens:body.p_prompt_tokens,outputTokens:body.p_output_tokens,totalTokens:body.p_total_tokens});
   if(url.endsWith('/rpc_taxonomy_query_catalog_service'))return json(config.catalog(body));
   if(url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'))return config.capture?.(body)??json({action:'HINT_CAPTURED',authority:'NONE'});
   assert.fail('UNEXPECTED_ROUTE');
 };
 const {handler}=loadOwnedIntakeHandler({fetch,env:name=>env[name],setTimeout:config.setTimeout});
 return {calls,message,invoke:()=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC',Accept:config.locationContext?'application/json':'text/event-stream','Content-Type':'application/json',...config.headers},body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:config.text??'SYNTHETIC_USER_TEXT',...(config.locationContext?{mode:'locationReply',locationContext:config.locationContext}:{})})}))};
}
async function events(f){const response=await f.invoke();assert.match(response.headers.get('content-type'),/text\/event-stream/);return (await response.text()).trim().split('\n\n').map(e=>JSON.parse(e.slice(6)));}
for(const phase of ['PROPOSAL','UNRESOLVED'])test('review cannot skip the current '+phase+' map decision',async()=>{
 const locationContext={version:1,promptToken:id(31),reviewRevision:'a'.repeat(64),slot:'start',phase,
  question:'Da li je ovo polazište?',query:'PRIVATNO_MESTO',proposal:phase==='PROPOSAL'?{id:id(32),label:'PRIVATNA_ADRESA'}:null,alternatives:[]};
 const f=fixture({locationContext,output:{safety:'ALLOW',assistantMessage:'Sve je spremno, objavi.',facts:[],
  dialogue:{next:'REVIEW',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'},
  locationDecision:{action:'CONTINUE',proposalId:'NONE',explicitConfirmation:false,hasCorrection:false,hasUncertainty:false}}});
 const r=await f.invoke();assert.equal(r.status,200);
 const write=f.calls.find(x=>x.url.endsWith('/rpc_ai_complete_need_location_turn_v1_service')).body;
 assert.match(write.p_assistant_message,phase==='PROPOSAL'?/proveriš predloženo mesto na mapi/:/U kom je gradu/);
 assert.ok(!write.p_assistant_message.includes('PRIVAT'));assert.deepEqual(write.p_proposals,[]);assert.equal(write.p_location_action,'CONTINUE');
});
for(const knownHandoff of [false,true])test('switching to remote ignores the obsolete map and checks handoff, known='+knownHandoff,async()=>{
 const locationContext={version:1,promptToken:id(31),reviewRevision:'a'.repeat(64),slot:'start',phase:'PROPOSAL',
  question:'Da li je ovo mesto?',query:'Prethodno mesto',proposal:{id:id(32),label:'Prethodno mesto'},alternatives:[]};
 const message='Predlog je sada na daljinu. Pogledaj ažurirani pregled.';
 const f=fixture({locationContext,output:{safety:'ALLOW',assistantMessage:message,
  facts:[{key:'need.task_geography',valueJson:'{"mode":"REMOTE"}',displayValue:'Na daljinu',evidence:'Može na daljinu',confidence:1},
    ...(knownHandoff?[{key:'need.handoff',valueJson:'{"required":false}',displayValue:'Bez fizičke predaje',evidence:'Samo digitalni fajl',confidence:1}]:[])],
  dialogue:{next:'REVIEW',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'},
  locationDecision:{action:'CORRECT',proposalId:'NONE',explicitConfirmation:false,hasCorrection:true,hasUncertainty:false}}});
 const r=await f.invoke();assert.equal(r.status,200);
 const write=f.calls.find(x=>x.url.endsWith('/rpc_ai_complete_need_location_turn_v1_service')).body;
 if(knownHandoff)assert.equal(write.p_assistant_message,message);
 else assert.match(write.p_assistant_message,/Kako preuzimaš rezultat/);
 assert.doesNotMatch(write.p_assistant_message,/mesto na mapi|polazište/);
 assert.equal(write.p_proposals[0].value.mode,'REMOTE');
});
const providers=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const writes=f=>f.calls.filter(c=>c.url.endsWith('/rpc_ai_complete_need_turn_v2_service'));
const failures=f=>f.calls.filter(c=>c.url.endsWith('/rpc_ai_fail_need_turn_v2_service'));
const activeFact=(key,value,valueType='TEXT')=>({fact_key:key,fact_value:value,value_type:valueType,display_value:JSON.stringify(value),
 fact_schema_version:'NEED_FACT_V2',status:'CONFIRMED',source:'USER_TEXT',created_at:'2026-10-18T12:00:00Z'});

// These fixtures prove the instruction delivered to the real handler's provider
// boundary and its existing ambiguity guard, not Gemini's language understanding.
for(const relation of ['UNCLEAR','DIFFERENT_TASK'])test(`work replacement ${relation} preserves old terms and asks before applying new work`,async()=>{
 const activeFacts=[activeFact('need.category','Krečenje'),activeFact('need.price_rsd',5000,'INTEGER'),
  activeFact('need.schedule_kind','TOMORROW_FLEXIBLE','ENUM'),
  activeFact('need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad'}},'OBJECT')];
 const previous=JSON.stringify(activeFacts);
 const f=fixture({activeFacts,text:'Umesto krečenja treba mi prevoz.',output:{safety:'ALLOW',assistantMessage:'Promenio sam posao.',
  facts:[{key:'need.category',valueJson:'"Prevoz stvari"',displayValue:'Prevoz stvari',evidence:'prevoz',confidence:1}],
  dialogue:{next:'CLARIFY',questionKey:'NONE',taskRelation:relation,priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'}}});
 const es=await events(f);assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 const write=writes(f);assert.equal(write.length,1);assert.equal(write[0].body.p_safety,'CLARIFY');assert.deepEqual(write[0].body.p_proposals,[]);
 assert.equal(JSON.stringify(activeFacts),previous);assert.ok(!write[0].body.p_assistant_message.includes('Promenio sam posao'));
 const instruction=providers(f)[0].body.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.ok(instruction.includes('Za promenu vrste posla prvo razjasni'));
 assert.ok(instruction.includes('koji raniji termin, budžet i mesto i dalje važe'));
 assert.ok(instruction.includes('Ne šalji promenu vrste, naslova ili opisa dok to nije jasno'));
 assert.ok(instruction.includes('najviše JEDNU nepoznatu informaciju kroz jedno kratko pitanje'));
 assert.ok(!instruction.includes('najviše tri kratka, povezana pitanja'));
 assert.ok(!instruction.includes('sa krečenja pređe na drugu uslugu), dialogue.taskRelation ostaje CONTINUE'));
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

test('ordinary correction of the same task keeps unrelated terms and remains a proposal',async()=>{
 const activeFacts=[activeFact('need.price_mode','MY_PRICE','ENUM'),activeFact('need.price_rsd',5000,'INTEGER'),
  activeFact('need.schedule_kind','TOMORROW_FLEXIBLE','ENUM')];
 const f=fixture({activeFacts,text:'Promeni samo ukupnu cenu za ceo posao na 6000 dinara.',output:{safety:'ALLOW',
  assistantMessage:'Cena je u nacrtu 6.000 dinara.',facts:[{key:'need.price_rsd',valueJson:'6000',displayValue:'6.000 RSD',evidence:'6000 dinara',confidence:1}],
  dialogue:{next:'ACK',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'WHOLE_JOB',schedulePattern:'UNSPECIFIED'}}});
 assert.equal((await events(f)).at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.deepEqual(writes(f)[0].body.p_proposals.map(p=>[p.key,p.value]),[['need.price_rsd',6000]]);
 assert.equal(activeFacts[2].fact_value,'TOMORROW_FLEXIBLE');
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

test('same-draft work replacement can ask which terms remain without changing them',async()=>{
 const activeFacts=[activeFact('need.category','Krečenje'),activeFact('need.price_rsd',5000,'INTEGER'),
  activeFact('need.schedule_kind','TOMORROW_FLEXIBLE','ENUM')];
 const message='Menjamo ovaj nacrt u prevoz. Da li ostaju isti termin i budžet, i koja je ruta?';
 const f=fixture({activeFacts,text:'Menjam ovaj isti zadatak, umesto krečenja treba mi prevoz.',output:{safety:'CLARIFY',assistantMessage:message,facts:[],
  dialogue:{next:'CLARIFY',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'}}});
 const es=await events(f);assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.deepEqual(writes(f)[0].body.p_proposals,[]);assert.equal(writes(f)[0].body.p_assistant_message,message);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),message);
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

const proposedFact=(key,value,evidence)=>({key,valueJson:JSON.stringify(value),displayValue:typeof value==='string'?value:JSON.stringify(value),evidence,confidence:1});
const rangeDialogue={next:'ACK',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'FLEXIBLE_RANGE'};
const rangeFacts=[proposedFact('need.schedule_kind','FLEXIBLE','naredne nedelje'),
 proposedFact('need.starts_at','2026-10-19T00:00:00+02:00','naredne nedelje'),
 proposedFact('need.ends_at','2026-10-26T00:00:00+01:00','naredne nedelje')];
const paintingFacts=()=>[
 ...[['need.title','Krečenje stana'],['need.description','Krečenje 50 m² površine poda, bez gletovanja. Materijal imam.'],
  ['need.category','Krečenje zidova'],['need.people_needed',1],['need.price_mode','OFFERS'],['need.task_country_code','RS'],
  ['need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad'}}]].map(([key,value])=>activeFact(key,value,
   typeof value==='number'?'INTEGER':typeof value==='object'?'OBJECT':'TEXT')),
 ...rangeFacts.map(p=>activeFact(p.key,JSON.parse(p.valueJson),p.key==='need.schedule_kind'?'ENUM':'TIMESTAMPTZ')),
];

for(const next of ['ASK','ANSWER'])test(`direct date explanation ${next} survives a still-incomplete city-only place`,async()=>{
 const activeFacts=paintingFacts(),original=JSON.stringify(activeFacts);
 const message=next==='ASK'?'To znači od 19. do 25. oktobra, bilo koji dan. U kom delu grada je stan?'
  :'To znači od 19. do 25. oktobra, bilo koji dan. Ostali detalji posla ostaju isti.';
 const f=fixture({activeFacts,text:'Termin ostaje naredne nedelje, bilo koji dan, i zelim ponude. Ukratko mi reci od kog do kog datuma to znaci i zadrzi sve ostalo o poslu.',
  output:{safety:'ALLOW',assistantMessage:message,facts:[proposedFact('need.price_mode','OFFERS','zelim ponude')],
   dialogue:{...rangeDialogue,next,questionKey:next==='ASK'?'need.task_geography':'NONE'}}});
 const es=await events(f),write=writes(f)[0].body;
 assert.equal(write.p_assistant_message,message);assert.equal(write.p_safety,'ALLOW');assert.deepEqual(write.p_proposals,[]);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),message);
 assert.equal(JSON.stringify(activeFacts),original);assert.equal(providers(f).length,1);
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push|save_need_location/.test(c.url)));
});

test('known private address does not become a new city-only question or a public answer',async()=>{
 const privateAddress='SYNTHETIC_PRIVATE_ADDRESS_17';
 const f=fixture({activeFacts:[...paintingFacts(),activeFact('need.exact_address',privateAddress)],text:'Da li još treba lokacija?',
  output:{safety:'ALLOW',assistantMessage:`Da li je mesto ${privateAddress}?`,facts:[],
   dialogue:{...rangeDialogue,next:'ASK',questionKey:'need.task_geography'}}});
 const es=await events(f),write=writes(f)[0].body;
 assert.equal(write.p_assistant_message,'Hajde da proverimo predlog mesta na mapi. Pomeri pin ako treba, pa potvrdi tačku.');
 assert.ok(!write.p_assistant_message.includes(privateAddress));assert.ok(!JSON.stringify(es).includes(privateAddress));
 assert.deepEqual(write.p_proposals,[]);
});

test('date consistency still precedes preserving a model reply about an incomplete place',async()=>{
 const f=fixture({activeFacts:paintingFacts(),text:'Termin je taj period, samo razjasni datume.',output:{safety:'ALLOW',
  assistantMessage:'Datumi su spremni. U kom delu grada je stan?',
  facts:[proposedFact('need.ends_at','2026-10-26T00:00:00+02:00','taj period')],
  dialogue:{...rangeDialogue,next:'ASK',questionKey:'need.task_geography'}}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'CLARIFY');assert.match(write.p_assistant_message,/lokalnom vremenu u Srbiji/);
 assert.deepEqual(write.p_proposals,[]);
});

for(const action of ['CONTINUE','CONFIRM_DISPLAYED'])test(`visible unresolved place with a date question keeps location action bounded: ${action}`,async()=>{
 const locationContext={version:1,promptToken:id(31),reviewRevision:'a'.repeat(64),slot:'start',phase:'UNRESOLVED',
  question:'U kom delu grada je posao?',query:'SYNTHETIC_PRIVATE_LOCATION_QUERY',proposal:null,alternatives:[]};
 const message='Termin je od 19. do 25. oktobra, bilo koji dan. Ostali detalji posla ostaju isti.';
 const f=fixture({locationContext,activeFacts:paintingFacts(),text:'Ukratko mi reci od kog do kog datuma je termin.',output:{
  safety:'ALLOW',assistantMessage:message,facts:[],dialogue:{...rangeDialogue,next:'ANSWER',questionKey:'NONE'},
  locationDecision:{action,proposalId:action==='CONTINUE'?'NONE':id(32),explicitConfirmation:action!=='CONTINUE',hasCorrection:false,hasUncertainty:false}}});
 const response=await f.invoke();assert.equal(response.status,action==='CONTINUE'?200:502);
 const locationWrites=f.calls.filter(c=>c.url.endsWith('/rpc_ai_complete_need_location_turn_v1_service'));
 if(action==='CONTINUE'){
  assert.equal(locationWrites.length,1);const write=locationWrites[0].body;
  assert.equal(write.p_assistant_message,message);assert.equal(write.p_location_action,'CONTINUE');assert.deepEqual(write.p_proposals,[]);
  assert.ok(!write.p_assistant_message.includes(locationContext.query));
  assert.equal((await response.json()).location.action,'CONTINUE');
  assert.ok(providers(f)[0].body.systemInstruction.parts.some(p=>p.text.includes('Prikazano pitanje o mestu ne zaključava temu razgovora')));
 }else assert.equal(locationWrites.length,0);
 assert.equal(providers(f).length,1);
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push|save_need_location/.test(c.url)));
});

test('owned handler delivers one semantic question budget and rejects a provider-declared range without bounds while keeping task facts',async()=>{
 const f=fixture({text:'Treba mi krecenje stana od 50 kvadrata u Novom Sadu naredne nedelje. Materijal imam.',
  output:{safety:'ALLOW',assistantMessage:'Termin je fleksibilan, spremno je.',dialogue:rangeDialogue,
   facts:[proposedFact('need.description','Krečenje stana od 50 m² u Novom Sadu naredne nedelje. Materijal obezbeđuje naručilac.','Materijal imam'),rangeFacts[0]]}});
 const es=await events(f),write=writes(f)[0].body,provider=providers(f)[0].body;
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);assert.equal(write.p_safety,'CLARIFY');
 assert.deepEqual(write.p_proposals.map(p=>p.key),['need.description']);
 assert.match(write.p_assistant_message,/Od kog do kog datuma/);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),write.p_assistant_message);
 const instruction=provider.systemInstruction.parts.map(p=>p.text).join('\n');
 assert.equal(instruction.split('Jedinstveno pravilo pitanja:').length-1,1);
 assert.ok(instruction.includes('najviše JEDNU nepoznatu informaciju kroz jedno kratko pitanje'));
 assert.ok(instruction.includes('Ne sakrivajte drugi zahtev u nabrajanju'));
 assert.ok(instruction.includes('Sve jasne činjenice iz cele korisnikove poruke predložite odmah'));
 assert.ok(instruction.includes('Ako je već rečeno Materijal imam, ne pitajte ko kupuje boju'));
 assert.ok(instruction.includes('WEEK_FLEXIBLE znači samo ovu kalendarsku nedelju'));
 assert.ok(instruction.includes('ne smeju postati FLEXIBLE bez granica'));
 // This checks the real outbound prompt, not natural-language model accuracy.
 assert.ok(instruction.includes('Svaka predložena izmena je u NACRTU, i kada uređujemo postojeći zadatak'));
 assert.ok(instruction.includes('U nacrtu je sada taj budžet; ostalo ostaje nepromenjeno'));
 assert.ok(instruction.includes('Nakon objave drugi mogu da pošalju ponude; ne obećavaj odziv'));
 assert.ok(instruction.includes('AI predlog ili poruka objavi nisu ljudska potvrda niti objava'));
 assert.ok(provider.generationConfig.responseSchema.properties.dialogue.properties.schedulePattern.enum.includes('FLEXIBLE_RANGE'));
 // The new enum belongs only to the provider interpretation. SQL command,
 // durable receipt and client SSE keep their existing exact public contracts.
 assert.ok(!JSON.stringify(write).includes('FLEXIBLE_RANGE'));assert.ok(!Object.hasOwn(write,'p_dialogue'));
 assert.ok(!JSON.stringify(es).includes('schedulePattern'));
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

test('partial reply preserves offers while an earlier next-week range remains unresolved',async()=>{
 const activeFacts=[activeFact('need.description','Krečenje naredne nedelje. Materijal imam.'),activeFact('need.schedule_kind','FLEXIBLE','ENUM')];
 const original=JSON.stringify(activeFacts);
 const f=fixture({activeFacts,history:[{role:'USER',body:'Krečenje stana u Novom Sadu naredne nedelje. Materijal imam.',sequence_no:1}],
  text:'50m2 je povrsina poda. Bez gletovanja. Otvoren sam za ponude, dan u narednoj nedelji je fleksibilan.',
  output:{safety:'ALLOW',assistantMessage:'U kom delu grada je stan?',dialogue:{...rangeDialogue,next:'ASK',questionKey:'need.task_geography'},
   facts:[proposedFact('need.price_mode','OFFERS','Otvoren sam za ponude'),
    proposedFact('need.description','Krečenje stana od 50 m² površine poda naredne nedelje, bez gletovanja. Materijal imam.','50m2 je povrsina poda. Bez gletovanja.') ]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'CLARIFY');assert.deepEqual(write.p_proposals.map(p=>p.key),['need.price_mode','need.description']);
 assert.match(write.p_assistant_message,/Od kog do kog datuma/);assert.equal(JSON.stringify(activeFacts),original);
 assert.ok(JSON.stringify(providers(f)[0].body.contents).includes('naredne nedelje. Materijal imam.'));
 assert.ok(!write.p_proposals.some(p=>p.key==='need.starts_at'||p.key==='need.ends_at'));
});

test('complete flexible next-week bounds survive actual completion including distinct DST offsets',async()=>{
 const message='Dan je fleksibilan između 19. i 25. oktobra. U kom delu grada je posao?';
 const f=fixture({text:'Bilo kog dana naredne nedelje, od 19. do 25. oktobra.',output:{safety:'ALLOW',assistantMessage:message,
  dialogue:{...rangeDialogue,next:'ANSWER'},facts:rangeFacts}});
 const es=await events(f),write=writes(f)[0].body;
 assert.equal(write.p_safety,'ALLOW');assert.equal(write.p_assistant_message,message);
 assert.deepEqual(write.p_proposals.map(p=>[p.key,p.value]),rangeFacts.map(p=>[p.key,JSON.parse(p.valueJson)]));
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.ok(!JSON.stringify(write).includes('FLEXIBLE_RANGE'));assert.ok(!JSON.stringify(es).includes('schedulePattern'));
});

test('wrong autumn DST offset cannot reach the owned fact writer; unrelated partial answers survive',async()=>{
 const f=fixture({text:'Naredne nedelje, od 19. do 25. oktobra. Otvoren sam za ponude.',
  output:{safety:'ALLOW',assistantMessage:'Termin je spreman.',dialogue:rangeDialogue,
   facts:[...rangeFacts.slice(0,2),proposedFact('need.ends_at','2026-10-26T00:00:00+02:00','od 19. do 25. oktobra'),
    proposedFact('need.price_mode','OFFERS','Otvoren sam za ponude')]}});
 const es=await events(f),write=writes(f)[0].body;
 assert.equal(es.at(-1).kind,'final');assert.equal(providers(f).length,1);
 assert.equal(write.p_safety,'CLARIFY');
 assert.deepEqual(write.p_proposals.map(p=>[p.key,p.value]),[['need.price_mode','OFFERS']]);
 assert.match(write.p_assistant_message,/lokalnom vremenu u Srbiji/);
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),write.p_assistant_message);
 assert.ok(!f.calls.some(c=>/save_draft|publish|commit_admission|push/.test(c.url)));
});

for(const [label,value] of [
 ['spring gap before offset','2026-03-29T02:30:00+01:00'],
 ['spring gap after offset','2026-03-29T02:30:00+02:00'],
 ['spring wrong future offset','2026-03-30T00:00:00+01:00'],
 ['invalid calendar day','2026-02-30T09:00:00+01:00'],
 ['missing offset','2026-10-26T09:00:00'],
 ['missing SQL-required seconds','2026-10-26T09:00+01:00'],
 ['another zone without literal source','2026-10-26T09:00:00+09:00'],
])test(`new timestamp ${label} is clarified without moving the instant`,async()=>{
 const f=fixture({text:'Tada po lokalnom vremenu.',output:{safety:'ALLOW',assistantMessage:'Sačuvano.',
  dialogue:{...rangeDialogue,schedulePattern:'SINGLE'},facts:[proposedFact('need.schedule_kind','FIXED_WINDOW','tada'),
   proposedFact('need.starts_at',value,'tada'),proposedFact('need.people_needed',2,'dve osobe')]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'CLARIFY');
 assert.deepEqual(write.p_proposals.map(p=>[p.key,p.value]),[['need.people_needed',2]]);
 assert.equal(providers(f).length,1);
});

for(const value of ['2026-10-25T02:30:00+02:00','2026-10-25T02:30:00+01:00',
 '2026-03-29T03:30:00+02:00','2026-10-26T09:00:00.123456+01:00'])
test(`valid local timestamp ${value} keeps its exact offset and precision`,async()=>{
 const f=fixture({text:'U dogovoreno lokalno vreme.',output:{safety:'ALLOW',assistantMessage:'Predlog je spreman.',
  dialogue:{...rangeDialogue,schedulePattern:'SINGLE'},facts:[proposedFact('need.schedule_kind','FIXED_WINDOW','termin'),
   proposedFact('need.starts_at',value,'termin')]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'ALLOW');assert.equal(write.p_proposals.find(p=>p.key==='need.starts_at').value,value);
});

for(const value of ['2026-10-26T00:00:00Z','2026-10-26T00:00:00+02:00','2026-10-26T09:00:00+09:00'])
test(`explicit user ISO instant ${value} is not silently converted to task-local time`,async()=>{
 const f=fixture({text:`Početak je tačno ${value}.`,output:{safety:'ALLOW',assistantMessage:'Predlog je spreman.',
  dialogue:{...rangeDialogue,schedulePattern:'SINGLE'},facts:[proposedFact('need.schedule_kind','FIXED_WINDOW',value),
   proposedFact('need.starts_at',value,value)]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'ALLOW');assert.equal(write.p_proposals.find(p=>p.key==='need.starts_at').value,value);
});

test('time consistency guard never downgrades a policy REVIEW',async()=>{
 const message='Ovaj zahtev zahteva proveru pravila.';
 const f=fixture({text:'Sintetički zahtev.',output:{safety:'REVIEW',assistantMessage:message,
  dialogue:rangeDialogue,facts:[...rangeFacts.slice(0,2),proposedFact('need.ends_at','2026-10-26T00:00:00+02:00','naredne nedelje')]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'REVIEW');assert.equal(write.p_assistant_message,message);assert.deepEqual(write.p_proposals,[]);
});

test('complete active range survives a later price-only reply without repeating time questions',async()=>{
 const activeFacts=rangeFacts.map(p=>activeFact(p.key,JSON.parse(p.valueJson),p.key==='need.schedule_kind'?'ENUM':'TIMESTAMPTZ'));
 const message='U redu, možeš da primiš ponude.';
 const f=fixture({activeFacts,text:'Otvoren sam za ponude.',output:{safety:'ALLOW',assistantMessage:message,
  dialogue:rangeDialogue,facts:[proposedFact('need.price_mode','OFFERS','Otvoren sam za ponude')]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'ALLOW');assert.equal(write.p_assistant_message,message);
 assert.deepEqual(write.p_proposals.map(p=>[p.key,p.value]),[['need.price_mode','OFFERS']]);
});

for(const [label,facts] of [
 ['start only',[rangeFacts[0],rangeFacts[1]]],
 ['reversed',[rangeFacts[0],rangeFacts[2],proposedFact('need.starts_at','2026-10-27T00:00:00+01:00','27. oktobra')]],
 ['offset missing',[rangeFacts[0],proposedFact('need.starts_at','2026-10-19T00:00:00','19. oktobra'),rangeFacts[2]]],
 ['wrong current-week kind',[{...rangeFacts[0],valueJson:'"WEEK_FLEXIBLE"'},...rangeFacts.slice(1)]],
])test(`provider-declared flexible range ${label} cannot persist a widened schedule`,async()=>{
 const f=fixture({text:'U ograničenom periodu koji smo pomenuli.',output:{safety:'ALLOW',assistantMessage:'Spremno.',dialogue:rangeDialogue,
  facts:[...facts,proposedFact('need.price_mode','OFFERS','ponude')]}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'CLARIFY');assert.deepEqual(write.p_proposals.map(p=>[p.key,p.value]),[['need.price_mode','OFFERS']]);
 assert.match(write.p_assistant_message,/Od kog do kog datuma/);
});

for(const [label,pattern,facts] of [
 ['true anytime','UNSPECIFIED',[proposedFact('need.schedule_kind','FLEXIBLE','bilo kada')]],
 ['earliest start only','SINGLE',[rangeFacts[0],rangeFacts[1]]],
 ['completion deadline only','SINGLE',[proposedFact('need.schedule_kind','REMOTE_ANYTIME','na daljinu'),rangeFacts[2]]],
])test(`${label} remains valid without inventing a second bound`,async()=>{
 const message='Sačuvano za pregled.';
 const f=fixture({text:'Sintetički jasan vremenski zahtev.',output:{safety:'ALLOW',assistantMessage:message,
  dialogue:{...rangeDialogue,schedulePattern:pattern},facts}});
 await events(f);const write=writes(f)[0].body;
 assert.equal(write.p_safety,'ALLOW');assert.equal(write.p_assistant_message,message);
 assert.deepEqual(write.p_proposals.map(p=>[p.key,p.value]),facts.map(p=>[p.key,JSON.parse(p.valueJson)]));
});

test('invalid fallback Need output still settles complete provider thinking usage once',async()=>{
 const f=fixture({provider:()=>new Response('data: '+JSON.stringify({candidates:[{
   content:{parts:[{text:'{"safety":"ALLOW","facts":"INVALID"}'}]},finishReason:'STOP'}],
   usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:5,cachedContentTokenCount:40,totalTokenCount:125}})+'\n\n',
   {headers:{'Content-Type':'text/event-stream'}})});
 const es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,0);
 const usage=f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_record_usage_service'));
 assert.equal(providers(f).length,1);assert.equal(usage.length,1);
 assert.equal(usage[0].body.p_prompt_tokens,100);assert.equal(usage[0].body.p_output_tokens,25);
 assert.equal(usage[0].body.p_total_tokens,125);assert.equal(usage[0].abortedAtCall,false);
});

test('confirmed Need finishes the stream and records usage even with the optional catalog disabled',async()=>{
 const output=withDialogue({safety:'ALLOW',assistantMessage:'Predlog je spreman za pregled.',facts:[]});
 const usageMetadata={promptTokenCount:100, candidatesTokenCount:20, totalTokenCount:120};
 const f=fixture({provider:()=>new Response('data: '+JSON.stringify({candidates:[{
   content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],usageMetadata})+'\n\n',
   {headers:{'Content-Type':'text/event-stream'}})});
 const es=await events(f);
 assert.deepEqual(es.map(e=>e.kind),['accepted','text_delta','final']);
 assert.equal(writes(f).length,1);assert.equal(failures(f).length,0);assert.equal(providers(f).length,1);
 const usage=f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_record_usage_service'));
 assert.equal(usage.length,1);assert.equal(usage[0].body.p_operation_id,key);
 assert.equal(usage[0].body.p_total_tokens,120);
});

for(const captureFails of [false,true])test(`Need catalog survives through completion; optional hint capture failure=${captureFails} cannot lose final or usage`,async()=>{
 const category=id(20),service='Izrada digitalnih maketa',handoff={required:false};
 const proposal={service,mode:'REMOTE',action:'REUSE_EXISTING',categoryId:category,parentId:'',proposedPath:[],reason:'Explicit synthetic service matches catalog identity',catalogVersion:7,handoff};
 const output=withDialogue({safety:'ALLOW',assistantMessage:'Predlog je spreman za pregled.',facts:[],classificationShadowJson:JSON.stringify([proposal])});
 const f=fixture({env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
   activeFacts:[activeFact('need.category',service),activeFact('need.task_geography',{mode:'REMOTE'},'OBJECT'),activeFact('need.handoff',handoff,'OBJECT')],
   text:'Nastavljamo isti zadatak izrade digitalnih maketa. Predaje se samo digitalni fajl.',
   catalog:body=>oneNodeCatalog(body,{categoryId:category,parentId:null,label:service,aliases:[],path:[service],isLeaf:true}),
  capture:()=>captureFails?new Response('{}',{status:503}):json({action:'HINT_CAPTURED',authority:'NONE'}),
   provider:()=>json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}],
    usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:0,totalTokenCount:120}})});
 const es=await events(f);
 assert.deepEqual(es.map(e=>e.kind),['accepted','text_delta','final']);assert.equal(providers(f).length,1);assert.equal(failures(f).length,0);
 const capture=f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.equal(capture.length,1);assert.equal(capture[0].body.p_proposals[0].categoryId,category);
 assert.ok(f.calls.indexOf(capture[0])>f.calls.indexOf(writes(f)[0]));
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rpc_ai_test_record_usage_service')).length,1);
 assert.ok(!f.calls.some(c=>/ensure_path|commit_admission|publish|push/.test(c.url)));
});

for(const registered of [true,false])test(`Need actual handler captures only server-registered alias=${registered} after owned completion`,async()=>{
 const category=id(20),service='3D štampa',handoff={required:true,shippingCountries:['RS']};
 const proposal={service,mode:'REMOTE',action:'REUSE_ALIAS',categoryId:category,parentId:'',proposedPath:[],reason:'Explicit synthetic task service and remote mode.',catalogVersion:7,handoff};
 const output=withDialogue({safety:'ALLOW',assistantMessage:'Proveri nacrt.',facts:[],classificationShadowJson:JSON.stringify([proposal])});
 const f=fixture({env:{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true',USKOCI_TAXONOMY_SHADOW_CAPTURE:'true'},
   activeFacts:[activeFact('need.category',service),activeFact('need.task_geography',{mode:'REMOTE'},'OBJECT'),activeFact('need.handoff',handoff,'OBJECT')],
   text:'Nastavljamo isti zadatak 3D štampe kod izvršioca i slanje kurirskom službom u Srbiji.',
   catalog:body=>oneNodeCatalog(body,{categoryId:category,parentId:null,label:'3D printovanje',aliases:registered?[service]:[],path:['3D printovanje'],isLeaf:true}),
   provider:()=>json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]}),
 });
 const es=await events(f);
 assert.equal(es.at(-1).kind,'final');assert.equal(writes(f).length,1);assert.equal(providers(f).length,1);assert.equal(failures(f).length,0);
 const capture=f.calls.filter(c=>c.url.endsWith('/rpc_taxonomy_capture_gemini_turn_hints_service'));
 assert.equal(capture.length,registered?1:0);
 if(registered){
  assert.deepEqual(capture[0].body.p_proposals,[{...proposal,action:'REUSE_EXISTING'}]);
  assert.ok(f.calls.indexOf(capture[0])>f.calls.indexOf(writes(f)[0]));
 }
 assert.ok(!f.calls.some(c=>/ensure_path|commit_admission|publish|push/.test(c.url)));
});

for(const taxonomy of [false,true]) for(const payload of [
 {promptFeedback:{blockReason:'SAFETY'}},
 {candidates:[{finishReason:'SAFETY'}]},
 {candidates:[{safetyRatings:[{blocked:true}],finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(withDialogue({safety:'ALLOW',assistantMessage:'Ne sme biti prihvaćeno.',facts:[]}))}]}}]},
])test(`provider refusal does not persist BLOCK; catalog=${taxonomy}`,async()=>{
 const service='Izrada digitalnih maketa';
 const f=fixture({env:taxonomy?{USKOCI_TAXONOMY_UNIFIED_SHADOW:'true'}:{},
  activeFacts:[activeFact('need.category',service),activeFact('need.task_geography',{mode:'REMOTE'},'OBJECT')],
  catalog:body=>oneNodeCatalog(body,{categoryId:id(20),parentId:null,label:service,aliases:[],path:[service],isLeaf:true}),
  provider:()=>{const response={...payload,usageMetadata:{promptTokenCount:100,candidatesTokenCount:0,totalTokenCount:100}};
    return taxonomy?json(response):new Response('data: '+JSON.stringify(response)+'\n\n',
      {headers:{'Content-Type':'text/event-stream'}});}});
 const es=await events(f);
 assert.equal(es.at(-1).kind,'safe_error');
 assert.ok(!es.some(e=>e.kind==='text_delta'||e.kind==='final'));
 assert.equal(writes(f).length,0);assert.equal(failures(f).length,1);
 assert.equal(providers(f).length,1);
 assert.match(providers(f)[0].url,taxonomy ? /:generateContent$/ : /:streamGenerateContent\?alt=sse$/);
 assert.ok(!f.calls.some(c=>/publish|commit_admission|push/.test(c.url)));
});

test('a validated policy BLOCK remains authoritative and has no proposed facts',async()=>{
 const f=fixture({output:{safety:'BLOCK',assistantMessage:'Ne mogu da pomognem sa tim zahtevom.',facts:[]}});
 const es=await events(f);
 assert.equal(es.at(-1).kind,'final');assert.equal(writes(f).length,1);
 assert.equal(writes(f)[0].body.p_safety,'BLOCK');assert.deepEqual(writes(f)[0].body.p_proposals,[]);
 assert.equal(failures(f).length,0);
});

for(const diagnostics of [false,true]) for(const status of [402,429])
test(`SSE provider ${status}, diagnostics=${diagnostics}: one safe terminal error, no prose or successful receipt`,async()=>{
 const f=fixture({headers:diagnostics?{'x-client-info':'uskoci-app/ai-availability-v1'}:{},
  provider:()=>new Response('PRIVATE_PROVIDER_SECRET AI_CREDITS_UNAVAILABLE',{status})}),es=await events(f);
 assert.equal(es.at(-1).code,diagnostics&&status===402?'AI_CREDITS_UNAVAILABLE':'AI_TURN_NOT_CONFIRMED');
 assert.equal(es.filter(e=>e.kind==='safe_error').length,1);
 assert.ok(!es.some(e=>e.kind==='text_delta'||e.kind==='final'));
 assert.ok(!JSON.stringify(es).includes('PRIVATE_PROVIDER_SECRET'));
 assert.equal(providers(f).length,1);assert.equal(writes(f).length,0);assert.equal(failures(f).length,1);
 assert.equal(failures(f)[0].body.p_attempt_id,attemptId);
});

for(const config of [{finishReason:'MAX_TOKENS'}, {provider:async()=>{throw Error('SYNTHETIC_NETWORK');}},
 {provider:async()=>new Response('{}',{status:429,headers:{'Content-Type':'application/json'}})}])
test('post-dispatch provider failure settles the same attempt without text or another provider call',async()=>{
 const f=fixture(config),es=await events(f);
 assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,0);assert.equal(providers(f).length,1);
 assert.equal(failures(f).length,1);assert.equal(failures(f)[0].body.p_attempt_id,attemptId);
 assert.equal(failures(f)[0].abortedAtCall,false);assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('lost completion acknowledgement only attempts metadata settlement and does not publish unconfirmed text',async()=>{
 const f=fixture({completionError:true,failureReceipt:turn()}),es=await events(f);
 assert.equal(writes(f).length,1);assert.equal(failures(f).length,1);assert.equal(providers(f).length,1);
 assert.equal(es.at(-1).kind,'safe_error');assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('provider stream has a thirty-second bound and timeout settles independently',async()=>{
 const timers=[];
 const f=fixture({setTimeout:(fn,ms)=>{timers.push(ms);return setTimeout(fn,ms===30000||ms===12000?5:ms);},
  provider:async()=>new Promise(()=>{})});
 const es=await events(f);assert.ok(timers.includes(30000));assert.ok(!timers.includes(12000));
 assert.equal(es.at(-1).kind,'safe_error');assert.equal(failures(f).length,1);assert.equal(providers(f).length,1);
});
test('actual handler streams real safe Unicode prefixes and finalizes through existing owned writer',async()=>{
 const f=fixture(),es=await events(f);assert.equal(es[0].kind,'accepted');assert.equal(es.at(-1).kind,'final');
 assert.deepEqual(es.at(-1).turn,turn());assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),f.message);
 for(let i=0;i<es.length;i++){assert.equal(es[i].sequence,i+1);assert.equal(es[i].attemptId,attemptId);assert.equal(es[i].turnId,turnId);}
 assert.equal(writes(f).length,1);assert.equal(writes(f)[0].body.p_assistant_message,f.message);
 assert.equal(providers(f).length,1);assert.match(providers(f)[0].url,/:streamGenerateContent\?alt=sse$/);
 assert.equal(providers(f)[0].body.generationConfig.maxOutputTokens,8192);
 assert.ok(!JSON.stringify(es).includes('SYNTHETIC_PROVIDER'));assert.ok(!JSON.stringify(es).includes('valueJson'));
});
test('claim replay is bounded JSON with no second provider reservation or call',async()=>{
 const f=fixture({replay:true}),r=await f.invoke();assert.deepEqual(await r.json(),turn());assert.equal(providers(f).length,0);assert.equal(f.calls.filter(c=>c.url.includes('budget')).length,0);
});
for(const budget of [{admitted:false,reservationId:null,replay:false,code:'AI_TEST_BUDGET_EXHAUSTED'},
 {admitted:false,reservationId:id(8),replay:true,code:'AI_TEST_OPERATION_REPLAY'}])test('budget denial/replay performs no provider call',async()=>{
 const f=fixture({budget}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(providers(f).length,0);assert.equal(writes(f).length,0);
});
test('paid processing gate must be explicitly enabled',async()=>{const f=fixture({env:{USKOCI_GEMINI_PAID_TEST_ENABLED:''}});assert.equal((await events(f)).at(-1).kind,'safe_error');assert.equal(providers(f).length,0);});
test('truncated output shows neither unvalidated prose nor a successful card receipt',async()=>{
 const f=fixture({finishReason:'MAX_TOKENS'}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,0);assert.ok(!es.some(e=>e.kind==='final'));
 assert.ok(!es.some(e=>e.kind==='text_delta'));
});
test('wrong authoritative receipt produces no text or stream final',async()=>{const f=fixture({badReceipt:true}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(writes(f).length,1);assert.ok(!es.some(e=>e.kind==='text_delta'));});
test('nested/escaped assistantMessage keys cannot leak non-assistant JSON into text',async()=>{
 const f=fixture({fragments:['{"facts":[{"key":"need.description","valueJson":"{\\"assistantMessage\\":\\"PRIVATE\\"}","displayValue":"private","evidence":"x","confidence":1}],',
 '"safety":"ALLOW","assistantMessage":"Javan odgovor."}']});
 const es=await events(f);assert.ok(!es.some(e=>e.kind==='text_delta'));
 assert.equal(es.at(-1).kind,'safe_error','nested object is not a valid description fact');
 assert.ok(!JSON.stringify(es).includes('PRIVATE'));
});
