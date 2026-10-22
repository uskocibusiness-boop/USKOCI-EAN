import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interviewVoiceInstruction} from '../../functions/_shared/interviewVoiceInstruction.mjs';
import {serviceExecutionInstruction} from '../../functions/_shared/serviceExecutionInstruction.mjs';

// Exact-source safety assertions, not synthetic claims of real Gemini quality.
const source=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const begin=source.indexOf('function instruction()');
const end=source.indexOf('// Exact finish-only utterances');
assert.ok(begin>=0&&end>begin,'worker instruction boundaries must remain inspectable');
const prompt=source.slice(begin,end);
const handler=source.slice(source.indexOf('export async function handleWorkerInterview'));

test('shared Serbian voice and worker interview request ONE fact, not a fixed questionnaire',()=>{
 assert.match(source,/interviewVoiceInstruction\(\)/);
 assert.match(interviewVoiceInstruction(),/Jedno korisno pitanje po poruci/);
 assert.match(prompt,/Ask at most ONE short question per reply/);
 assert.match(prompt,/Accept ALL independently clear facts in one patch/);
 assert.match(prompt,/Do not sound like a form/);
 assert.doesNotMatch(prompt,/Ask up to THREE short, related questions/);
});
test('questions see owned candidate and bounded saved history, without discarding unrelated facts',()=>{
 assert.match(source,/Current owned candidate \(not verified claims\)/);
 assert.match(source,/Server-owned worker profile status: \$\{context\.profileStatus\}/);
 assert.match(handler,/rpc_read_worker_ai_context_service/);
 assert.match(handler,/context\.messages\.slice\(-30\)/);
 assert.match(handler,/text:String\(row\.body\)\.slice\(0,4000\)/);
 assert.match(prompt,/Apply ALL clear supported answers in one patch/);
 assert.match(prompt,/Never recap the whole profile, repeat answered questions/);
});
test('craft scenario keeps actual trade, without offering unrelated errands or courier work',()=>{
 assert.match(prompt,/directly related service only if it changes matching/);
 assert.match(prompt,/Do NOT proactively market unrelated errands, courier work/);
 assert.match(prompt,/discuss them only if they ask for casual\/extra work/);
 assert.match(prompt,/never turn examples into facts without an answer/);
});
test('knowing English or owning a van is not permission to offer translation or transport',()=>{
 assert.match(prompt,/'Znam engleski' is general knowledge, NOT consent/);
 assert.match(prompt,/'Držim časove engleskog' offers tutoring/);
 assert.match(prompt,/'Imam kombi' is equipment, NOT consent/);
 assert.match(prompt,/Never infer an offered job from equipment, knowledge/);
 assert.match(prompt,/Existing tools and vehicles in the candidate are historical data/);
});
test('ON_SITE territory and REMOTE mode retain shared execution authority',()=>{
 assert.match(handler,/serviceExecutionInstruction\('WORKER_CAPABILITY'\)/);
 const execution=serviceExecutionInstruction('WORKER_CAPABILITY');
 assert.match(execution,/only ON_SITE and REMOTE are execution modes/);
 assert.match(execution,/Do not silently replace physical work with advice/);
 assert.match(execution,/An explicitly offered concrete service can inherently establish its initial mode/);
 assert.match(execution,/preserve existing saved modes and handoff constraints/);
 assert.match(prompt,/Working-area questions concern ON_SITE work only/);
 assert.match(prompt,/Do not send legacy patch\.location together with areaRequests/);
});
test('review/Save is required before activation and matching authority',()=>{
 assert.match(prompt,/Every proposed change is in the NACRT/);
 assert.match(prompt,/Only explicit Sačuvaj profil in the review applies the changes/);
 assert.match(prompt,/proactively suggest a single profile review/);
 assert.match(prompt,/Do not say saved, activated, verified or all complete/);
 assert.match(handler,/rpc_complete_worker_ai_turn_service/);
 assert.doesNotMatch(handler,/rpc_taxonomy_bind_reviewed_worker_service/);
 assert.doesNotMatch(handler,/rpc_taxonomy_commit_reviewed_batch_service/);
});
test('first screen welcomes naturally and named sections describe offered skills',()=>{
 const route=readFileSync(new URL('../../../src/app/(app)/profil/razgovor.tsx',import.meta.url),'utf8');
 const facts=readFileSync(new URL('../../../src/ui/workerProfile/workerProfileFacts.ts',import.meta.url),'utf8');
 assert.match(route,/welcome=\{hasProfileContent\?'Ćao! Šta želiš da dopuniš\? 😊':'Ćao! Čime se baviš\? 😊'\}/);
 const welcome=readFileSync(new URL('../../../src/ui/aiFirst/aiInterviewWelcome.ts',import.meta.url),'utf8');
 assert.match(route,/introMessage=\{data\.messages\.length===0 && !unread \? workerInterviewOpening\(hasProfileContent\) : undefined\}/);
 assert.match(welcome,/Drago mi je što si deo USKOČI zajednice/);
 assert.match(welcome,/Ako uključiš obaveštenja/);
 assert.match(welcome,/Za početak, koje vrste zadataka želiš da obavljaš/);
 assert.match(welcome,/na kraju sve pregledaš i potvrđuješ/);
 assert.match(route,/Sve izmene pregledaš pre čuvanja/);
 assert.match(facts,/skills: 'Usluge koje nudiš'/);
 assert.match(facts,/key: 'skills', label: 'Usluge'/);
});
test('new DRAFT city requirement matches activation while REMOTE remains nationwide-capable',()=>{
 assert.match(prompt,/server activation rpc_complete_worker_profile requires a city for a NEW DRAFT/);
 assert.match(prompt,/ask ONE short natural question for the administrative city/);
 assert.match(prompt,/Administrative city does NOT restrict REMOTE matching/);
 assert.match(prompt,/do not reopen the city interview only because an old profile lacks a city/);
 assert.match(prompt,/Never invent a city or infer it from offered service/);
 assert.match(prompt,/not a home street, house number, map pin, GPS point or work radius/);
});
test('activation progress requires actual stored administrative city and country',()=>{
 const facts=readFileSync(new URL('../../../src/ui/workerProfile/workerProfileFacts.ts',import.meta.url),'utf8');
 assert.match(facts,/Activation needs a country and a city/);
 assert.match(facts,/place\.operatingCountryCode && place\.city\.trim\(\)\.length > 0/);
 assert.match(prompt,/If operating country is also unknown, ask only for the highest-priority missing fact per message/);
 assert.doesNotMatch(prompt,/Do not require a home city, address or GPS for a new worker/);
});
