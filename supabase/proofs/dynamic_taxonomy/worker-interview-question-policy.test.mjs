import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interviewVoiceInstruction} from '../../functions/_shared/interviewVoiceInstruction.mjs';
import {serviceExecutionInstruction} from '../../functions/_shared/serviceExecutionInstruction.mjs';
import {singlePassFixture} from '../ai/single_pass_edge_fixture.mjs';
import {capturedParts} from '../../../src/ui/workerProfile/workerProfileFacts.ts';

// Inspect the composed prompt actually sent by the current handler. This proves
// instruction wiring, not the quality of an unsampled real model response.
const source=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('export async function handleWorkerInterview'));
const fixture=singlePassFixture('WORKER');
await fixture.invoke();
const request=fixture.calls.find(call=>call.url.startsWith('https://generativelanguage.googleapis.com/')).body;
const prompt=request.systemInstruction.parts.map(part=>part.text).join('\n');
const voice=interviewVoiceInstruction();

test('shared Serbian voice and worker interview request ONE fact, not a fixed questionnaire',()=>{
 assert.ok(prompt.includes(voice),'shared policy must actually reach the model');
 assert.match(prompt,/najviše JEDNO pitanje za JEDNU bitnu nepoznanicu/);
 assert.match(prompt,/Bez spojenih pitanja, ponavljanja poznatog\/celog pregleda/);
 assert.match(prompt,/izdvojite sve jasne podatke, sačuvajte delimične odgovore/);
 assert.match(prompt,/Na korisnikovo pitanje odgovorite pre svog/);
 assert.doesNotMatch(prompt,/Ask up to THREE short, related questions/);
});
test('questions see owned candidate and bounded saved history, without discarding unrelated facts',()=>{
 assert.match(prompt,/Owned candidate \(not verified claims\)/);
 assert.match(prompt,/Server-owned worker profile status:/);
 assert.match(handler,/rpc_read_worker_ai_context_service/);
 assert.match(handler,/context\.messages\.slice\(-30\)/);
 assert.match(handler,/text:String\(row\.body\)\.slice\(0,4000\)/);
 assert.match(prompt,/Record independent clear corrections while clarifying another/);
 assert.ok(request.contents.some(row=>row.role==='user'&&row.parts[0].text.includes('Radim lekturu')));
});
test('craft scenario keeps actual trade, without offering unrelated errands or courier work',()=>{
 assert.match(prompt,/Related-service suggestions require explicit agreement/);
 assert.match(prompt,/never add examples as offers or market unrelated errands to a professional/);
 assert.match(prompt,/ONE person actually offers/);
 assert.match(prompt,/Do not interview them about an imaginary customer task/);
});
test('knowing English or owning a van is not permission to offer translation or transport',()=>{
 assert.match(prompt,/English knowledge\/van ownership do not imply translation\/transport/);
 assert.match(prompt,/Equipment is read-only\/private: omit edits/);
 assert.match(prompt,/Do not present old equipment as review\/matching evidence or invent experience/);
 assert.match(prompt,/skills is the COMPLETE offered list: preserve unremoved services/);
});
test('ON_SITE territory and REMOTE mode retain shared execution authority',()=>{
 assert.ok(prompt.includes(serviceExecutionInstruction('WORKER_CAPABILITY')));
 assert.match(prompt,/BOTH = both scopes, not a third mode/);
 assert.match(prompt,/never substitute advice\/design/);
 assert.match(prompt,/An obvious initial scope can establish mode/);
 assert.match(prompt,/preserve unchanged saved\/draft IDs, including mode\/handoff edits/);
 assert.match(prompt,/ON_SITE patch\.areaRequests is a COMPLETE list/);
 assert.match(prompt,/no coordinates\/sourceRef\/workAreas or simultaneous legacy patch\.location/);
});
test('only server-confirmed review and explicit Save grant business authority',()=>{
 assert.match(prompt,/Izmene su NACRT/);
 assert.match(prompt,/Bez poziva na pregled: aplikacija ga nudi tek uz serverom potvrđene podatke i povezivanje usluga/);
 assert.match(prompt,/Objavi\/Sačuvaj je korisnička potvrda celine/);
 assert.match(prompt,/Ne tvrdite da je već objavljeno, sačuvano, aktivirano ili poslato drugima/);
 assert.match(prompt,/These remain draft choices until explicit Save/);
 assert.ok(fixture.calls.some(call=>call.name==='rpc_complete_worker_ai_turn_with_first_plan_service'));
 assert.ok(!fixture.calls.some(call=>/rpc_taxonomy_(bind_reviewed_worker|commit_reviewed_batch)_service/.test(call.name)));
});
test('optional biography does not add a mandatory interview or confirmation turn',()=>{
 assert.match(prompt,/Calendar detail\/bio are optional/);
 assert.match(prompt,/When routing is clear and bio absent, offer drafting once without delaying review/);
 assert.match(prompt,/explicit request\/acceptance gets 2–3 sentences from known facts/);
 assert.match(prompt,/no invented credentials\/equipment\/reliability\/contact details\/promises/);
 assert.match(prompt,/bio holds introduction\/limits, not matching filters/);
 assert.match(prompt,/fix only that claim in the SAME patch/);
 assert.doesNotMatch(prompt,/Da li Vam odgovara ovakav opis/);
});
test('first screen welcomes naturally and named sections describe offered skills',()=>{
 const route=readFileSync(new URL('../../../src/app/(app)/profil/razgovor.tsx',import.meta.url),'utf8');
 const facts=readFileSync(new URL('../../../src/ui/workerProfile/workerProfileFacts.ts',import.meta.url),'utf8');
 assert.match(route,/welcome=\{hasProfileContent\?'Dobar dan! Šta želite da dopunite\? 🧡':'Dobar dan! Čime se bavite\? 🧡'\}/);
 const welcome=readFileSync(new URL('../../../src/ui/aiFirst/aiInterviewWelcome.ts',import.meta.url),'utf8');
 assert.match(route,/introMessage=\{data\.messages\.length===0 && !unread \? workerInterviewOpening\(hasProfileContent\) : undefined\}/);
 assert.match(welcome,/Dobro došli u USKOČI zajednicu/);
 assert.match(welcome,/Za početak, koje vrste poslova ili usluga želite da ponudite/);
 assert.match(welcome,/na kraju sve mirno pregledate i potvrđujete/);
 assert.match(welcome,/izmene važe tek kada ih pregledate i sačuvate/);
 assert.match(facts,/skills: 'Usluge koje nudite'/);
 assert.match(facts,/key: 'skills', label: 'Usluge'/);
});
test('only signed canonical REMOTE readiness may omit city; proposals and ON_SITE/BOTH retain their guards',()=>{
 const candidate=readFileSync(new URL('../../candidates/r08_remote_only_activation.sql',import.meta.url),'utf8');
 assert.match(candidate,/LOCAL_ONLY, NEVER a migration/);
 assert.match(prompt,/REMOTE-only needs no city/);
 assert.match(prompt,/aplikacija ga nudi tek uz serverom potvrđene podatke i povezivanje usluga/);
 assert.match(prompt,/not Publish\/Save or proof of either write/);
 // Isolated candidate, not DEV rollout. ON_SITE, including BOTH represented
 // by two modes, fails the city-free gate; proposals cannot invent categories.
 assert.match(candidate,/m->>'mode' IS DISTINCT FROM 'REMOTE'/);
 assert.match(candidate,/p->>'action' IS DISTINCT FROM 'REUSE_EXISTING'/);
 assert.match(candidate,/private\.taxonomy_review_exact_projection_v1\('WORKER_CAPABILITY'/);
 assert.match(candidate,/and private\.worker_remote_review_ready_v1\(doc\) IS NOT TRUE/);
 assert.match(candidate,/else missing:=missing\|\|'"Mesto rada"'::jsonb; end if;/);
 assert.match(prompt,/genuinely unclear execution, ON_SITE territory/);
 assert.match(prompt,/No home city\/address\/GPS interview/);
 assert.match(prompt,/Country is not inferred from language/);
 assert.doesNotMatch(prompt,/requires a city for a NEW DRAFT, even for REMOTE work/);
});
test('literal location progress needs both supplied country and city; it never establishes activation or residence',()=>{
 // This legacy factual helper is not a server readiness decision or an active
 // UI gate. An absent location stays absent even when signed REMOTE can activate.
 for(const [operatingCountryCode,city,expected] of [
  [null,'',false],['RS','',false],[null,'Novi Sad',false],['RS','  ',false],['RS','Novi Sad',true],
 ]){
  const profile={skills:['Izrada logotipa'],location:{operatingCountryCode,city},
   availability:{availableNow:false,rules:[],windows:[]}};
  const before=structuredClone(profile);
  assert.equal(capturedParts(profile).find(part=>part.key==='area').done,expected);
  assert.deepEqual(profile,before,'progress must not fabricate a country or city');
 }
 assert.match(prompt,/No home city\/address\/GPS interview/);
 assert.match(prompt,/Country is not inferred from language/);
 assert.match(prompt,/najviše JEDNO pitanje za JEDNU bitnu nepoznanicu/);
});
