'use strict';
// Controlled model outputs through the actual Edge guards, without provider I/O.
// These prove admission and response behavior, not live-model comprehension.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
const parsed = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const names = ['serbiaTimeParts', 'serbiaMidnight', 'serverTimeContext', 'validTimestamp', 'nextMonthDateEvidence', 'guardTimestampProposals', 'guardConversationTurn'];
const code = names.map(name => {
  const node = parsed.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, `Actual Edge guard ${name} exists`);
  return node.getText(parsed);
}).join('\n');
const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function contract(relative) {
  const source=fs.readFileSync(path.join(root,relative),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={}; new Function('exports',compiled)(exports); return exports;
}
const sandbox = {
  Date, Intl, taskFinishOnly: () => false, applicationDeadlineEnabled: () => true,
  sameFactValue: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  decodeServiceHandoff: require('../supabase/functions/_shared/serviceHandoff.mjs').decodeServiceHandoff,
  decodeTaskApplicationDeadlineFact: contract('src/contracts/taskApplicationDeadline.ts').decodeTaskApplicationDeadlineFact,
  NEED_FACT_V2_DEFINITIONS: contract('src/contracts/needFactsV2.ts').NEED_FACT_V2_DEFINITIONS,
};
vm.runInNewContext(js + '\nthis.run = guardConversationTurn; this.time = serverTimeContext; this.month = nextMonthDateEvidence;', sandbox);
const time = sandbox.time(new Date('2026-11-09T11:00:00Z'));
const fact = (key, value, evidence = '') => ({ key, value, evidence, confidence: 1, displayValue: String(value) });
const active = entries => entries.map(([key, value]) => ({fact_key: key, fact_value: value, status: 'CONFIRMED'}));
const turn = (assistantMessage, proposals = [], questionKey = '', next = 'ASK') => ({
  safety: 'ALLOW', assistantMessage, proposals,
  dialogue: { next, questionKey, taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
});
const run = (value, input, facts = [], history = [], currentTime = time, pendingDeadline = false) =>
  sandbox.run(value, input, history, facts, currentTime, undefined, pendingDeadline);

test('B: facts from the current message prevent a repeated people question', () => {
  const input = 'Treba mi pomoć za prenošenje ormara sutra u Novom Sadu, jedan čovek, nudim 2.000 dinara.';
  const proposals = [fact('need.title','Prenošenje ormara',input),fact('need.category','Nošenje nameštaja',input),
    fact('need.description','Prenošenje ormara',input), fact('need.people_needed',1,'jedan čovek'),
    fact('need.price_mode','MY_PRICE','nudim 2.000 dinara'), fact('need.price_rsd',2000,'2.000 dinara'),
    fact('need.schedule_kind','TOMORROW_FLEXIBLE','sutra'), fact('need.task_country_code','RS',input),
    fact('need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad'}},'u Novom Sadu')];
  const out = run(turn('Koliko ljudi Vam treba?',proposals,'need.people_needed'),input);
  assert.doesNotMatch(out.assistantMessage,/Koliko ljudi/);
  assert.match(out.assistantMessage,/delu grada|ulic|orijentir/i);
  assert.equal(out.proposals.find(p=>p.key==='need.people_needed').value,1);
  assert.notEqual(out.dialogue.questionKey,'need.people_needed');
});

test('A: a known generic description does not suppress one genuinely missing scope question', () => {
  const out = run(turn('Kolika je približna površina sobe koju treba okrečiti?',[],'need.description'),
    'Jedna soba.',active([['need.description','Krečenje sobe'],['need.people_needed',1]]));
  assert.equal(out.assistantMessage,'Kolika je približna površina sobe koju treba okrečiti?');
});

test('H/Q: an explicit spoken correction cannot retain the rejected relative day', () => {
  const facts=active([['need.people_needed',2],['need.price_rsd',2000]]);
  const before=JSON.stringify(facts);
  const out = run(turn('Termin je sutra.',[fact('need.schedule_kind','TOMORROW_FLEXIBLE','sutra')],'','ACK'),
    'Ne sutra, ipak prekosutra.',facts);
  assert.equal(out.safety,'CLARIFY');
  assert.equal(out.proposals.some(p=>p.key==='need.schedule_kind'),false);
  assert.equal(JSON.stringify(facts),before);
});

test('relative month deadline: wrong month is rejected without losing other facts', () => {
  const input = 'Prijave do desetog sledeceg meseca u 17 sati. Trebaju mi dva čoveka.';
  const out = run(turn('Rok je 10. novembra.',[
    fact('need.response_deadline',{kind:'AT',at:'2026-11-10T17:00:00+01:00'},'do desetog sledeceg meseca'),
    fact('need.people_needed',2,'dva čoveka')],'','ACK'),input);
  assert.equal(out.safety,'CLARIFY');
  assert.equal(out.proposals.some(p=>p.key==='need.response_deadline'),false);
  assert.equal(out.proposals.find(p=>p.key==='need.people_needed').value,2);
});

test('shared Worker guidance does not reintroduce equipment/home-city or unrelated-service interviews', async () => {
  const {interviewVoiceInstruction} = await import('../supabase/functions/_shared/interviewVoiceInstruction.mjs');
  const prompt = interviewVoiceInstruction();
  assert.doesNotMatch(prompt,/Pitajte ima li sopstveni alat i prevoz|ko je, čime se bavi.*odakle je|ako je student, ponudite mu/i);
});

for (const [label,input,at,date] of [
  ['Latin','Prijave do desetog sledeceg meseca u 17 sati.','2026-12-10T17:00:00+01:00','2026-11-09T11:00:00Z'],
  ['year boundary','Prijave do 10. sledećeg meseca u 17 sati.','2027-01-10T17:00:00+01:00','2026-12-29T11:00:00Z'],
  ['full phrase with hour','Prijave do desetog sledećeg meseca u 17h.','2026-12-10T17:00:00+01:00','2026-11-09T11:00:00Z'],
  ['Cyrillic','Пријаве до десетог следећег месеца у 17 сати.','2026-12-10T17:00:00+01:00','2026-11-09T11:00:00Z'],
]) test(`relative month deadline accepts correct ${label} calendar date`,()=>{
  const evidence=input.replace(/^(?:Prijave|Пријаве) /u,'').replace(/\.$/u,'');
  const out=run(turn('U redu.',[fact('need.response_deadline',{kind:'AT',at},evidence)],'','ACK'),input,[],[],sandbox.time(new Date(date)));
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value.at,at);
});

test('full date/hour quote still rejects a model that uses the current month',()=>{
  const evidence='do desetog sledećeg meseca u 17h';
  const out=run(turn('U redu.',[fact('need.response_deadline',{kind:'AT',at:'2026-11-10T17:00:00+01:00'},evidence)],'','ACK'),'Prijave '+evidence+'.');
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.length,0);
});

test('an explicit next-month application correction rejects a stale unchanged snapshot',()=>{
  const evidence='do desetog sledećeg meseca';
  const old={kind:'AT',at:'2026-11-10T17:00:00+01:00'};
  const out=run(turn('Rok je ažuriran.',[fact('need.response_deadline',old,evidence)],'','ACK'),
    'Prijave '+evidence+' u 17 sati.',active([['need.response_deadline',old]]));
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.length,0);
  assert.doesNotMatch(out.assistantMessage,/ažuriran/);
});

test('an explicit next-month task correction rejects the old end but preserves it on unrelated input',()=>{
  const evidence='do desetog sledećeg meseca',old='2026-11-11T00:00:00+01:00';
  const facts=active([['need.ends_at',old]]);
  const out=run(turn('Rok je ažuriran.',[fact('need.ends_at',old,evidence)],'','ACK'),
    'Zadatak treba završiti '+evidence+'.',facts);
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.length,0);
  assert.doesNotMatch(out.assistantMessage,/ažuriran/);
  const unrelated=run(turn('U redu.',[fact('need.ends_at',old,evidence)],'','ACK'),'Trebaju mi dva čoveka.',facts);
  assert.equal(unrelated.safety,'ALLOW'); assert.equal(unrelated.proposals.length,0);
  assert.equal(facts[0].fact_value,old);
});

test('date evidence checker leaves ambiguous, quoted and unsupported phrases to the provider',()=>{
  for(const evidence of ['Možda do desetog sledećeg meseca','do desetog ili dvanaestog sledećeg meseca',
    'ne do desetog sledećeg meseca','„do desetog sledećeg meseca“','do Božića','do prvog petka sledećeg meseca'])
    assert.equal(sandbox.month(evidence,'2026-11-09'),null,evidence);
});

test('J plus facts: asking for information preserves the answer and correction context',()=>{
  const reply='Ne, objavu potvrđujete Vi posle pregleda. Zadržan je iznos od 2.000 dinara. Koliko ljudi Vam treba?';
  const out=run(turn(reply,[fact('need.people_needed',2,'dva čoveka')],'need.people_needed'),
    'Trebaju mi dva čoveka. Da li se ovo odmah objavljuje?',active([['need.price_rsd',2000]]));
  assert.equal(out.assistantMessage,reply);
  assert.equal(out.proposals.find(p=>p.key==='need.people_needed').value,2);
});

test('K: the known city and neighborhood are not requested again',()=>{
  const facts=active([['need.description','Čišćenje stana'],['need.people_needed',1],
    ['need.task_geography',{mode:'STATIONARY',start:{city:'Novi Sad',area:'Detelinara'}}]]);
  const out=run(turn('U kom gradu je stan?',[],'need.task_geography'),'Na Detelinari.',facts);
  assert.doesNotMatch(out.assistantMessage,/kom gradu/);
  assert.equal(out.dialogue.questionKey,'need.price_mode');
  assert.equal(out.proposals.length,0);
});

test('G: active Worker prompt requires ON_SITE/BOTH work coverage and keeps REMOTE-only cityless',async()=>{
  const workerSource=fs.readFileSync(path.join(root,'supabase/functions/uskoci-worker-interview/index.ts'),'utf8');
  const workerAst=ts.createSourceFile('worker.ts',workerSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const node=workerAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='instruction');
  assert.ok(node);
  const voice=await import('../supabase/functions/_shared/interviewVoiceInstruction.mjs');
  const intent=await import('../supabase/functions/_shared/conversationIntent.mjs');
  const scope={...voice,...intent,WORKER_AVAILABLE_NOW_ENABLED:false};
  vm.runInNewContext(ts.transpileModule(node.getText(workerAst),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nthis.prompt=instruction();',scope);
  assert.match(scope.prompt,/For ON_SITE, ask for the city and area where the person WANTS TO WORK when that work territory is missing/);
  assert.match(scope.prompt,/BOTH service or a mixed REMOTE\/ON_SITE profile still needs territory for its ON_SITE work/);
  assert.match(scope.prompt,/REMOTE-only digital work does not require a city or physical address/);
  assert.match(scope.prompt,/Keep known areas and ask only the missing extent/);
  assert.match(scope.prompt,/preserve unmentioned services and keep distinct services separate/);
});

test('known two-city work coverage is preserved without another lookup or home address',async()=>{
  const {resolveWorkerAreas}=await import('../supabase/functions/_shared/workerAreaResolver.mjs');
  const ownedAreas=[{kind:'CITY',countryCode:'RS',city:'Novi Sad',label:'Novi Sad',sourceRef:'osm:relation:123',latitude:45.26,longitude:19.83,radiusKm:null},
    {kind:'CITY',countryCode:'RS',city:'Beograd',label:'Beograd',sourceRef:'osm:relation:456',latitude:44.81,longitude:20.46,radiusKm:null}];
  const before=JSON.stringify(ownedAreas);
  const result=await resolveWorkerAreas(ownedAreas.map(area=>({kind:'CITY',countryCode:'RS',query:area.city,radiusKm:null})),{
    ownedAreas,requestJson:()=>{throw Error('Unchanged areas must not require network');},signal:new AbortController().signal});
  assert.deepEqual(result,ownedAreas); assert.equal(JSON.stringify(ownedAreas),before);
});

test('month deadline without a stated hour asks only the missing hour',()=>{
  const input='Prijave do desetog sledeceg meseca.';
  const out=run(turn('U redu.',[fact('need.response_deadline',{kind:'AT',at:'2026-12-10T17:00:00+01:00'},'do desetog sledeceg meseca')],'','ACK'),input);
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.length,0);
  assert.equal(out.assistantMessage,'Do koliko sati 10.12.2026 treba da budu otvorene prijave?');
});

for (const [phrase,hour] of [['u pet popodne','17:00'],['u podne','12:00']]) {
  test(`natural-language hour ${phrase} is not mistaken for a missing hour`,()=>{
    const evidence='do desetog sledećeg meseca';
    const at=`2026-12-10T${hour}:00+01:00`;
    const out=run(turn('U redu.',[fact('need.response_deadline',{kind:'AT',at},evidence)],'','ACK'),`Prijave ${evidence} ${phrase}.`);
    assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value.at,at);
  });
}

test('a date correction can retain the authoritative previously agreed hour',()=>{
  const evidence='do desetog sledećeg meseca';
  const facts=active([['need.response_deadline',{kind:'AT',at:'2026-11-20T17:00:00+01:00'}]]);
  const at='2026-12-10T17:00:00+01:00';
  const out=run(turn('Sat ostaje isti.',[fact('need.response_deadline',{kind:'AT',at},evidence)],'','ACK'),
    `Pomerite rok za prijave ${evidence}, sat ostaje isti.`,facts);
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value.at,at);
});

test('exact date-only correction does not ask again for a known hour, but NONE is not a known hour',()=>{
  const evidence='do desetog sledećeg meseca';
  const at='2026-12-10T17:00:00+01:00';
  for(const prior of [{kind:'AT',at:'2026-11-20T17:00:00+01:00'},{kind:'NONE'}]) {
    const out=run(turn('U redu.',[fact('need.response_deadline',{kind:'AT',at},evidence)],'','ACK'),
      'Prijave '+evidence+'.',active([['need.response_deadline',prior]]));
    assert.equal(out.safety,prior.kind==='AT'?'ALLOW':'CLARIFY');
    assert.equal(out.proposals.length,prior.kind==='AT'?1:0);
  }
});

test('task latest date is not silently turned into an invented start',()=>{
  const input='Zadatak treba završiti do desetog sledećeg meseca.';
  const out=run(turn('U redu.',[fact('need.starts_at','2026-12-10T09:00:00+01:00','do desetog sledećeg meseca')],'','ACK'),input);
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.length,0);
});

test('whole-day task deadline accepts the exclusive midnight after its last included date',()=>{
  const input='Zadatak treba završiti do desetog sledećeg meseca.';
  const out=run(turn('U redu.',[fact('need.ends_at','2026-12-11T00:00:00+01:00','do desetog sledećeg meseca')],'','ACK'),input);
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value,'2026-12-11T00:00:00+01:00');
});

const flexibleTurn = (proposals=[]) => {
  const value=turn('Rok je do 10. decembra 2026.',proposals,'','ACK');
  value.dialogue.schedulePattern='FLEXIBLE_RANGE';
  return value;
};

test('phone regression: a valid latest boundary survives while only the earliest date is requested',()=>{
  const input='Treba mi prevod teksta od 1000 reci sa srpskog na engleski, sve onlajn. Rok je do desetog sledeceg meseca. Nudim ukupno 3000 dinara za jednu osobu.';
  const end=fact('need.ends_at','2026-12-11T00:00:00+01:00','do desetog sledeceg meseca');
  const out=run(flexibleTurn([end,fact('need.schedule_kind','FLEXIBLE','do desetog sledeceg meseca'),
    fact('need.price_mode','MY_PRICE','Nudim ukupno 3000 dinara'),fact('need.price_rsd',3000,'3000 dinara'),
    fact('need.price_basis','TOTAL','ukupno'),fact('need.people_needed',1,'jednu osobu')]),input);
  assert.equal(out.safety,'CLARIFY');
  assert.equal(out.proposals.find(p=>p.key==='need.ends_at')?.value,end.value);
  assert.equal(out.proposals.some(p=>['need.starts_at','need.schedule_kind'].includes(p.key)),false);
  assert.equal(out.proposals.find(p=>p.key==='need.price_rsd')?.value,3000);
  assert.match(out.assistantMessage,/Od kog datuma/);
  assert.doesNotMatch(out.assistantMessage,/do kog datuma|Od kog do kog|danas/i);
  assert.equal(out.dialogue.next,'ASK'); assert.equal(out.dialogue.questionKey,'need.starts_at');
});

test('an earliest boundary survives while only the missing latest date is requested',()=>{
  const start=fact('need.starts_at','2026-12-01T00:00:00+01:00','od prvog decembra');
  const out=run(flexibleTurn([start,fact('need.schedule_kind','FLEXIBLE','od prvog decembra')]),'Može od prvog decembra.');
  assert.equal(out.proposals.find(p=>p.key==='need.starts_at')?.value,start.value);
  assert.equal(out.proposals.some(p=>['need.ends_at','need.schedule_kind'].includes(p.key)),false);
  assert.match(out.assistantMessage,/Do kog datuma/); assert.doesNotMatch(out.assistantMessage,/Od kog/i);
  assert.equal(out.dialogue.questionKey,'need.ends_at');
});

test('a saved latest boundary is preserved and not requested again during another answer',()=>{
  const facts=active([['need.ends_at','2026-12-11T00:00:00+01:00']]),before=JSON.stringify(facts);
  const out=run(flexibleTurn([fact('need.people_needed',2,'dve osobe')]),'Trebaju mi dve osobe.',facts);
  assert.equal(JSON.stringify(facts),before);
  assert.equal(out.proposals.find(p=>p.key==='need.people_needed')?.value,2);
  assert.equal(out.proposals.some(p=>p.key==='need.ends_at'),false);
  assert.equal(out.dialogue.questionKey,'need.starts_at');
  assert.doesNotMatch(out.assistantMessage,/do kog datuma|Od kog do kog/i);
});

test('a new earliest boundary completes the range with the already saved latest boundary',()=>{
  const facts=active([['need.ends_at','2026-12-11T00:00:00+01:00']]);
  const out=run(flexibleTurn([fact('need.starts_at','2026-12-01T00:00:00+01:00','od prvog decembra'),
    fact('need.schedule_kind','FLEXIBLE','od prvog decembra')]),'Može od prvog decembra.',facts);
  assert.equal(out.safety,'ALLOW');
  assert.equal(out.proposals.find(p=>p.key==='need.starts_at')?.value,'2026-12-01T00:00:00+01:00');
  assert.equal(out.proposals.find(p=>p.key==='need.schedule_kind')?.value,'FLEXIBLE');
});

test('partial-range preservation cannot bypass the quoted next-month date guard',()=>{
  const out=run(flexibleTurn([fact('need.ends_at','2026-11-11T00:00:00+01:00','do desetog sledeceg meseca'),
    fact('need.people_needed',2,'dve osobe')]),'Treba završiti do desetog sledeceg meseca. Trebaju mi dve osobe.');
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.some(p=>p.key==='need.ends_at'),false);
  assert.equal(out.proposals.find(p=>p.key==='need.people_needed')?.value,2);
});

test('an invalid application deadline cannot expose an unchecked boundary or incomplete schedule kind',()=>{
  const out=run(flexibleTurn([
    fact('need.response_deadline',{kind:'AT',at:'2026-11-10T17:00:00+01:00'},'do desetog sledeceg meseca u 17 sati'),
    fact('need.ends_at','2026-11-11T00:00:00+01:00','do desetog sledeceg meseca'),
    fact('need.schedule_kind','FLEXIBLE','do desetog sledeceg meseca'),fact('need.people_needed',2,'dve osobe')]),
    'Prijave do desetog sledeceg meseca u 17 sati. Zadatak treba završiti do desetog sledeceg meseca. Trebaju mi dve osobe.');
  assert.equal(out.safety,'CLARIFY');
  assert.equal(out.proposals.some(p=>['need.starts_at','need.ends_at','need.schedule_kind','need.response_deadline'].includes(p.key)),false);
  assert.equal(out.proposals.find(p=>p.key==='need.people_needed')?.value,2);
});

test('an inverted range does not preserve contradictory proposed boundaries',()=>{
  const out=run(flexibleTurn([fact('need.starts_at','2026-12-12T00:00:00+01:00','od dvanaestog decembra'),
    fact('need.ends_at','2026-12-11T00:00:00+01:00','do desetog decembra')]),
    'Od dvanaestog decembra do desetog decembra.');
  assert.equal(out.safety,'CLARIFY');
  assert.equal(out.proposals.some(p=>['need.starts_at','need.ends_at','need.schedule_kind'].includes(p.key)),false);
});

test('an explicit midnight deadline stays on its stated date instead of adding another day',()=>{
  const evidence='do desetog sledećeg meseca u 00:00';
  const out=run(turn('U redu.',[fact('need.ends_at','2026-12-10T00:00:00+01:00',evidence)],'','ACK'),'Zadatak treba završiti '+evidence+'.');
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value,'2026-12-10T00:00:00+01:00');
});

test('several date corrections do not let a bounded recognizer choose an earlier one',()=>{
  const input='Ne sutra, ipak prekosutra. Zapravo, ipak u petak.';
  const out=run(turn('Termin je petak.',[fact('need.starts_at','2026-11-13T09:00:00+01:00','ipak u petak')],'','ACK'),input);
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value,'2026-11-13T09:00:00+01:00');
});

test('invalid next-month day cannot overflow February into March',()=>{
  const input='Prijave do 31. sledeceg meseca u 17 sati.';
  const out=run(turn('U redu.',[fact('need.response_deadline',{kind:'AT',at:'2027-03-03T17:00:00+01:00'},'do 31. sledeceg meseca')],'','ACK'),input,[],[],sandbox.time(new Date('2027-01-09T11:00:00Z')));
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.proposals.length,0);
});

test('H/R: correct new date survives while older unrelated authoritative facts stay untouched',()=>{
  const facts=active([['need.price_rsd',2000],['need.people_needed',1],['need.description','Prenošenje ormara']]);
  const before=JSON.stringify(facts);
  const out=run(turn('Termin je pomeren.',[fact('need.starts_at','2026-11-11T09:00:00+01:00','prekosutra'),
    fact('need.schedule_kind','FIXED_WINDOW','prekosutra')],'','ACK'),'Ne sutra, ipak prekosutra.',facts,
    Array.from({length:40},(_,i)=>({role:i%2?'ASSISTANT':'USER',body:'Raniji razgovor'})));
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals[0].value,'2026-11-11T09:00:00+01:00');
  assert.equal(JSON.stringify(facts),before);
});

test('nonsense clarification retains no model-invented business facts or taxonomy IDs',async()=>{
  const {takeConversationIntent,guardInterviewIntentOutput}=await import('../supabase/functions/_shared/conversationIntent.mjs');
  const input='asdjkl žnj';
  const decision=takeConversationIntent({conversationIntent:{kind:'UNCLEAR',evidence:input}},input);
  const out=guardInterviewIntentOutput({safety:'ALLOW',assistantMessage:'Šta biste želeli da uradite?',facts:[fact('need.category','Krečenje')],
    taxonomyDecisions:[{categoryId:'internal-id'}],dialogue:turn('').dialogue},decision,'NEED');
  assert.equal(out.facts.length,0); assert.equal(out.taxonomyDecisions.length,0); assert.equal(out.safety,'CLARIFY');
  assert.equal(out.assistantMessage,'Šta biste želeli da uradite?');
});

test('E/F/I: explicit Worker ADD, REMOVE and limits preserve unrelated offered services',async()=>{
  const h=await import('../supabase/functions/_shared/conversationIntent.mjs');
  const current='Više ne radim krečenje. Radim elektriku, kosim travu i mogu da unosim nameštaj, ali nemam kombi.';
  const decision=h.takeConversationIntent({conversationIntent:{kind:'WORKER_EDIT_SERVICE',evidence:current}},current);
  const changes=[{action:'REMOVE',service:'Krečenje',replacement:'',evidence:'Više ne radim krečenje'},
    ...['Elektrika','Košenje trave','Unošenje nameštaja'].map(service=>({action:'ADD',service,replacement:'',evidence:current}))];
  const out=h.applyWorkerServiceChanges({safety:'ALLOW',assistantMessage:'U redu.',patch:{bio:'Pomažem pri nošenju, nemam kombi.'}},
    changes,{skills:['Krečenje','Prevođenje']},current,decision);
  assert.equal(out.valid,true); assert.deepEqual(out.output.patch.skills,['Prevođenje','Elektrika','Košenje trave','Unošenje nameštaja']);
  assert.doesNotMatch(out.output.patch.skills.join(','),/Prevoz|kombi/);
});

test('O: opposite-domain handoff clears all proposed writes, with no automatic switch or publication',async()=>{
  const h=await import('../supabase/functions/_shared/conversationIntent.mjs');
  const input='Ne tražim majstora, ja nudim tu uslugu.';
  const decision=h.takeConversationIntent({conversationIntent:{kind:'WORKER_OFFER',evidence:input}},input);
  const out=h.guardInterviewIntentOutput({safety:'ALLOW',assistantMessage:'Objavljeno.',facts:[fact('need.category','Krečenje')],
    dialogue:turn('').dialogue},decision,'NEED');
  assert.equal(out.facts.length,0); assert.match(out.assistantMessage,/radni profil/);
  assert.doesNotMatch(out.assistantMessage,/objavljeno|prebačen|sačuvano/i);
});

test('J: question about publication receives an answer and cannot mutate facts',async()=>{
  const h=await import('../supabase/functions/_shared/conversationIntent.mjs');
  const input="Je l' ovo odmah objavljuje zadatak?";
  const decision=h.takeConversationIntent({conversationIntent:{kind:'QUESTION',evidence:input}},input);
  const reply='Ne, objavu potvrđujete Vi posle pregleda zadatka.';
  const out=h.guardInterviewIntentOutput({safety:'ALLOW',assistantMessage:reply,facts:[fact('need.people_needed',8)],
    dialogue:turn('').dialogue},decision,'NEED');
  assert.equal(out.assistantMessage,reply); assert.equal(out.facts.length,0);
});

test('N: per-person hourly amount remains a unit amount for two people',()=>{
  const input='Potrebna su dva čoveka, 1.200 dinara svakom po satu.';
  const value=turn('U redu.',[fact('need.people_needed',2,'dva čoveka'),fact('need.price_rsd',1200,'1.200 dinara'),
    fact('need.price_mode','MY_PRICE',input),fact('need.price_basis','HOURLY','svakom po satu')],'','ACK');
  value.dialogue.priceUnit='PER_HOUR';
  const out=run(value,input);
  assert.equal(out.safety,'ALLOW'); assert.equal(out.proposals.find(p=>p.key==='need.price_rsd').value,1200);
  assert.equal(out.proposals.find(p=>p.key==='need.price_basis').value,'HOURLY');
});

test('C/S: complete remote draft stops optional questions and retains cityless geography',()=>{
  const facts=active([['need.title','Prevod teksta'],['need.category','Prevođenje'],['need.description','Prevod teksta na engleski'],['need.people_needed',1],['need.price_mode','OFFERS'],
    ['need.schedule_kind','REMOTE_ANYTIME'],['need.task_country_code','RS'],['need.task_geography',{mode:'REMOTE'}],
    ['need.handoff',{required:false}]]);
  const out=run(turn('Koja je Vaša kućna adresa?',[],'need.exact_address'),'Sve je onlajn.',facts);
  assert.equal(out.dialogue.next,'REVIEW'); assert.doesNotMatch(out.assistantMessage,/adresa|grad|\?/i);
  assert.equal(out.proposals.length,0);
});

const remotePhotoFacts = () => active([
  ['need.title','Obrada fotografije'],['need.category','Obrada fotografija'],
  ['need.description','Potrebna je obrada jedne fotografije'],['need.people_needed',1],
  ['need.price_mode','OFFERS'],['need.schedule_kind','REMOTE_ANYTIME'],
  ['need.task_country_code','RS'],['need.task_geography',{mode:'REMOTE'}],['need.handoff',{required:false}],
]);

test('complete REMOTE fields do not erase one still-needed scope clarification',()=>{
  const facts=remotePhotoFacts(),before=JSON.stringify(facts);
  const reply='Da li želite samo uklanjanje pozadine ili i retuširanje fotografije?';
  const out=run({...turn(reply,[],'need.description'),safety:'CLARIFY'},'Fotografiju ću poslati onlajn.',facts);
  assert.equal(out.assistantMessage,reply);
  assert.equal(out.safety,'CLARIFY'); assert.equal(out.dialogue.next,'ASK');
  assert.equal(out.dialogue.questionKey,'need.description');
  assert.equal(JSON.stringify(facts),before); assert.equal(out.proposals.length,0);
});

test('scope clarification retains an independent current correction and never invents work details',()=>{
  const reply='Да ли желите само уклањање позадине или и ретуширање фотографије?';
  const out=run({...turn(reply,[fact('need.people_needed',2,'две особе')],'need.description'),safety:'CLARIFY'},
    'Ипак су потребне две особе.',remotePhotoFacts());
  assert.equal(out.assistantMessage,reply); assert.equal(out.dialogue.next,'ASK');
  assert.equal(out.proposals.length,1); assert.equal(out.proposals[0].value,2);
  assert.equal(out.proposals.some(p=>['need.category','need.description'].includes(p.key)),false);
});

test('known REMOTE count and address questions still stop even when marked CLARIFY',()=>{
  for(const [key,question] of [['need.people_needed','Koliko ljudi Vam treba?'],['need.exact_address','Koja je Vaša kućna adresa?']]){
    const out=run({...turn(question,[],key),safety:'CLARIFY'},'Sve je onlajn.',remotePhotoFacts());
    assert.equal(out.dialogue.next,'REVIEW'); assert.notEqual(out.assistantMessage,question);
    assert.equal(out.proposals.length,0);
  }
});

test('a complete remote task still stops optional description questions without an ambiguity decision',()=>{
  const out=run(turn('Želite li da dodate još detalja?',[],'need.description'),'Ostalo zadržite.',remotePhotoFacts());
  assert.equal(out.dialogue.next,'REVIEW'); assert.doesNotMatch(out.assistantMessage,/\?/u);
});
