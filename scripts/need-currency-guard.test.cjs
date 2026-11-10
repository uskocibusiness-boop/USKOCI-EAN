'use strict';
/** Exercise the EXACT TypeScript guard from the Edge function without calling Gemini,
 * PostgREST, or billing. AST extraction fails if it disappears or is renamed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'uskoci-ai-interview', 'index.ts'), 'utf8');
const parsed = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const ast = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'guardConversationTurn');
assert.ok(ast, 'live Need price guard must remain present');
const { outputText, diagnostics } = ts.transpileModule(ast.getText(parsed), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
});
assert.equal(diagnostics.length, 0);
const sandbox = {
  guardTimestampProposals: turn => turn,
  taskFinishOnly: () => false,
  applicationDeadlineEnabled: () => false,
  sameFactValue: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  decodeServiceHandoff: () => null,
  NEED_FACT_V2_DEFINITIONS: {},
  Date,
};
vm.runInNewContext(outputText + '\nthis.extractedGuard = guardConversationTurn;', sandbox, { timeout: 1000 });
const run = sandbox.extractedGuard;
const time = { nowUtc:'2026-11-07T00:00:00Z', localDate:'2026-11-07', timeZone:'Europe/Belgrade' };
const turn = (message, facts = [], next = 'ACK') => ({
  safety: 'ALLOW', assistantMessage: message,
  proposals: facts.map(([key, value]) => ({ key, value, displayValue: String(value),
    confidence: 1, evidence: message })),
  dialogue: { next, questionKey: '', taskRelation:'CONTINUE', priceUnit:'UNSPECIFIED', schedulePattern:'UNSPECIFIED' },
});
const entries = out => JSON.parse(JSON.stringify(out.proposals));
const rsdFacts = [
  ['need.description','Potrebno je krečenje sobe'],
  ['need.price_mode','MY_PRICE'],
  ['need.price_rsd',50],
  ['need.price_basis','TOTAL'],
];
test('50 EUR never becomes 50 RSD; task description survives', () => {
  const out = run(turn('Cena je 50 evra', rsdFacts), 'Cena je 50 evra', [], [], time);
  assert.equal(out.safety, 'CLARIFY');
  assert.equal(entries(out).some(x => x.key === 'need.price_rsd'), false);
  assert.equal(entries(out).some(x => x.key === 'need.description'), true);
  assert.match(out.assistantMessage, /RSD/);
});
test('50 € cannot leak via REVIEW safety', () => {
  const review = turn('Cena je 50 €', rsdFacts);
  review.safety = 'REVIEW';
  const out = run(review, 'Cena je 50 €', [], [], time);
  assert.equal(out.safety, 'REVIEW');
  assert.equal(entries(out).some(x => x.key === 'need.price_rsd'), false);
  assert.match(out.assistantMessage, /RSD/);
});
test('explicit RSD remains RSD and keeps its value', () => {
  const out = run(turn('Cena je 50 RSD', rsdFacts), 'Cena je 50 RSD', [], [], time);
  assert.equal(entries(out).find(x => x.key === 'need.price_rsd')?.value, 50);
  assert.equal(out.priceRetraction, undefined);
});
test('EUR-only correction invalidates earlier RSD consent', () => {
  const active = [{ fact_key:'need.price_rsd', fact_value:50, status:'CONFIRMED' }];
  const history = [{ role:'USER', body:'Cena je 50' },{role:'ASSISTANT',body:'Koja je cena?' }];
  const out = run(turn('Mislio sam u evrima'), 'Mislio sam u evrima', history, active, time);
  assert.equal(out.priceRetraction, 'UNSUPPORTED_CURRENCY');
  assert.equal(entries(out).length, 0);
  assert.equal(out.safety, 'CLARIFY');
});
test('expense EUR with separate RSD task price does not corrupt task amount', () => {
  const sentence = 'Materijal košta 50 evra; cena rada je 2.000 RSD';
  const out = run(turn(sentence, [['need.price_mode','MY_PRICE'], ['need.price_rsd',2000]]),
    sentence, [], [], time);
  assert.equal(entries(out).find(x => x.key === 'need.price_rsd')?.value, 2000);
  assert.equal(out.priceRetraction, undefined);
});
test('plain 2 workers do not silently become a price', () => {
  const out = run(turn('Trebaju mi 2 radnika', [['need.price_rsd',2], ['need.people_needed',2]]),
    'Trebaju mi 2 radnika', [], [], time);
  assert.equal(entries(out).some(x => x.key === 'need.price_rsd'), false);
  assert.equal(entries(out).find(x => x.key === 'need.people_needed')?.value, 2);
});
test('prompt does not instruct Gemini to store EUR as a RSD fact', () => {
  assert.doesNotMatch(source, /store the exact stated amount \(50\)/);
  assert.match(source, /NEVER put its numeral in need.price_rsd/);
});

const knownPrice = basis => [
  {fact_key:'need.price_mode',fact_value:'MY_PRICE',status:'CONFIRMED'},
  {fact_key:'need.price_rsd',fact_value:1200,status:'CONFIRMED'},
  {fact_key:'need.price_basis',fact_value:basis,status:'CONFIRMED'},
  {fact_key:'need.people_needed',fact_value:2,status:'CONFIRMED'},
];
for(const [text,basis] of [['Promeni na 1.500.','HOURLY'],['Промени на 1.500.','PER_PERSON'],['Povećaj cenu na 1500.','TOTAL']]) {
  test('amount-only correction keeps known units and unrelated facts: '+text,()=>{
    const input=turn('Sada je ukupno 1.500 RSD za jednu osobu.',[
      ['need.price_rsd',1500],['need.price_basis','TOTAL'],['need.people_needed',1],
      ['need.starts_at','2026-11-11T09:00:00+01:00']]);
    input.dialogue.priceUnit='WHOLE_JOB';
    const facts=knownPrice(basis),before=JSON.stringify(facts);
    const out=run(input,text,[{role:'ASSISTANT',body:'Koji iznos želite da postavite?'}],facts,time);
    assert.equal(entries(out).find(p=>p.key==='need.price_rsd')?.value,1500);
    assert.equal(entries(out).some(p=>p.key!=='need.price_rsd'),false);
    assert.equal(JSON.stringify(facts),before);
    assert.doesNotMatch(out.assistantMessage,/za jednu osobu/);
    if(basis==='HOURLY') assert.match(out.assistantMessage,/po osobi po satu/);
    if(basis==='PER_PERSON') assert.match(out.assistantMessage,/po osobi/);
  });
}

test('bare price answer cannot silently change the established unit',()=>{
  const input=turn('Cena je ukupno 1500 RSD.',[['need.price_rsd',1500],['need.price_basis','TOTAL']]);
  input.dialogue.priceUnit='WHOLE_JOB';
  const out=run(input,'1500',[{role:'ASSISTANT',body:'Koju satnicu u dinarima nudite?'}],knownPrice('HOURLY'),time);
  assert.equal(entries(out).find(p=>p.key==='need.price_rsd')?.value,1500);
  assert.equal(entries(out).some(p=>p.key==='need.price_basis'),false);
  assert.doesNotMatch(out.assistantMessage,/ukupno/);
});

test('amount-only correction refuses an ungrounded model value including independent-looking fields',()=>{
  const input=turn('Cena je 2500 RSD za jednu osobu.',[['need.price_rsd',2500],['need.price_basis','TOTAL'],['need.people_needed',1]]);
  const out=run(input,'Promeni cenu na 1500 RSD.',[],knownPrice('HOURLY'),time);
  assert.equal(out.safety,'CLARIFY');
  assert.equal(entries(out).length,0);
  assert.doesNotMatch(out.assistantMessage,/2500|za jednu osobu/);
});

test('ambiguous number or correction after a non-price question does not inherit price authority',()=>{
  for(const [text,history] of [
    ['Promeni na 1500.',[{role:'ASSISTANT',body:'Kada treba da počne posao?'}]],
    ['1500',[{role:'ASSISTANT',body:'Koliko ljudi Vam treba?'}]],
    ['1500',[]],
  ]) {
    const out=run(turn('Cena je 1500 RSD.',[['need.price_rsd',1500]]),text,history,knownPrice('HOURLY'),time);
    assert.equal(entries(out).some(p=>p.key==='need.price_rsd'),false,text);
    assert.doesNotMatch(out.assistantMessage,/1500 RSD/);
  }
});

test('an explicit new price unit is not frozen by the amount-only correction guard',()=>{
  const text='Promeni cenu na 1500 RSD ukupno.';
  const input=turn('Cena je 1500 RSD ukupno.',[['need.price_rsd',1500],['need.price_basis','TOTAL']]);
  input.dialogue.priceUnit='WHOLE_JOB';
  const out=run(input,text,[],knownPrice('HOURLY'),time);
  assert.equal(entries(out).find(p=>p.key==='need.price_rsd')?.value,1500);
  assert.equal(entries(out).find(p=>p.key==='need.price_basis')?.value,'TOTAL');
});

test('amount-only euro correction and REVIEW safety retain their existing protections',()=>{
  const euro=run(turn('Cena je 1500 RSD.',[['need.price_rsd',1500],['need.price_basis','TOTAL']]),
    'Promeni cenu na 1500 EUR.',[],knownPrice('HOURLY'),time);
  assert.equal(euro.safety,'CLARIFY');assert.equal(euro.priceRetraction,'UNSUPPORTED_CURRENCY');
  assert.equal(entries(euro).length,0);
  const input=turn('Cena je ukupno 1500 RSD.',[['need.price_rsd',1500],['need.price_basis','TOTAL']]);
  input.safety='REVIEW';
  const out=run(input,'Promeni cenu na 1500 RSD.',[],knownPrice('HOURLY'),time);
  assert.equal(out.safety,'REVIEW');
  assert.equal(entries(out).some(p=>p.key==='need.price_basis'),false);
  assert.doesNotMatch(out.assistantMessage,/Iznos u nacrtu je/);
});

test('bounded amount correction keeps the maximum supported integer and never guesses a missing unit',()=>{
  const maximum=run(turn('Cena je 100000000 RSD.',[['need.price_rsd',100000000],['need.price_basis','TOTAL']]),
    'Promeni cenu na 100.000.000 RSD.',[],knownPrice('HOURLY'),time);
  assert.equal(entries(maximum).find(p=>p.key==='need.price_rsd')?.value,100000000);
  assert.equal(entries(maximum).some(p=>p.key==='need.price_basis'),false);
  const unknown=knownPrice('HOURLY').map(f=>f.fact_key==='need.price_basis'?{...f,status:'UNKNOWN'}:f);
  const out=run(turn('Cena je 1500 RSD.',[['need.price_rsd',1500]]),'Promeni cenu na 1500 RSD.',[],unknown,time);
  assert.equal(entries(out).find(p=>p.key==='need.price_rsd')?.value,1500);
  assert.equal(entries(out).some(p=>p.key==='need.price_basis'),false);
  assert.doesNotMatch(out.assistantMessage,/po osobi po satu/);
});
