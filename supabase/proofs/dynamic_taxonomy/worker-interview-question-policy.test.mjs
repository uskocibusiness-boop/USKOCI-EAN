import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../functions/uskoci-worker-interview/index.ts',import.meta.url),'utf8');
const prompt=source.slice(source.indexOf('function instruction('),source.indexOf('// Exact finish-only utterances'));
const handler=source.slice(source.indexOf('export async function handleWorkerInterview'));

test('open interview is natural Serbian and asks only one next relevant question',()=>{
 assert.match(prompt,/Speak concise Serbian Latin/);
 assert.match(prompt,/Speak concise Serbian Latin, addressing the person as ti, never Vi\/Vam/);
 assert.match(prompt,/approachable USKOČI coordinator/);
 assert.match(prompt,/not a scripted interviewer or salesperson/);
 assert.match(prompt,/Choose at most ONE next question/);
 assert.match(prompt,/Decide dynamically, never by a fixed checklist/);
 assert.match(prompt,/one to three short sentences/);
 assert.match(prompt,/Do not sound like a form/);
});
test('questions use the FULL stored context and skip facts provided in one answer',()=>{
 for(const rule of [
  'last message and entire saved draft',
  'One answer may supply many facts: patch ALL of them in one turn',
  'skip every covered topic',
  'repeat a previously answered question',
  'invite review naturally rather than adding optional questions',
  'Ask about the distance/radius for accepting tasks ONLY if the worker offers on-site work',
 ])assert.ok(prompt.includes(rule),rule);
 assert.match(handler,/rpc_read_worker_ai_context_service/);
 assert.match(handler,/context\.messages\.slice\(-30\)/);
 assert.match(handler,/context\.candidate/);
 assert.match(handler,/instruction\(context,new Date\(\)\.toISOString\(\)\)/);
});
test('painting scenario: one targeted related question, never automatic courier or side gigs',()=>{
 assert.match(prompt,/directly related service only if it would change which tasks they receive/);
 assert.match(prompt,/Do NOT proactively market unrelated everyday errands/);
 assert.match(prompt,/Discuss those only if the person explicitly asks for casual or extra work/);
 assert.match(prompt,/never an inferred capability/);
});
test('language knowledge and owning a van cannot become offered jobs without explicit consent',()=>{
 assert.match(prompt,/'Znam engleski' is general knowledge, NOT consent to tutoring or translating/);
 assert.match(prompt,/'Držim časove engleskog' offers tutoring/);
 assert.match(prompt,/'Imam kombi' is equipment, NOT consent to transport or removals/);
 assert.match(prompt,/Skills describe work the person explicitly can and wants to offer/);
 assert.match(prompt,/do not add an activity they decline/);
});
test('remote programmer/tutor scenario and on-site painter prioritize only relevant questions',()=>{
 assert.match(prompt,/first clarify which concrete work they actually offer/);
 assert.match(prompt,/next clarify ambiguous on-site versus remote delivery/);
 assert.match(prompt,/working area only for on-site work/);
 assert.match(prompt,/ask about tools or vehicle only where the stated job truly depends/);
 assert.match(prompt,/never demand an on-site travel radius for remote-only tasks/);
 assert.match(prompt,/never encode execution mode as a fake skill/);
});
test('finish stays optional, must not fake Save or allow unauthorized matching',()=>{
 assert.match(prompt,/proactively suggest a single profile review without making them issue a magic finish phrase/);
 assert.match(prompt,/do not open optional questions about tools, availability or the calendar/);
 assert.match(prompt,/Do not say saved, activated, verified or all complete/);
 assert.match(source,/workerFinishReviewMessage/);
 assert.match(handler,/rpc_complete_worker_ai_turn_service/);
 assert.doesNotMatch(handler,/rpc_taxonomy_bind_reviewed_worker_service/);
 assert.doesNotMatch(handler,/rpc_taxonomy_commit_reviewed_batch_service/);
});

test('first-screen interview copy and profile labels describe real offered work',()=>{
 const route=readFileSync(new URL('../../../src/app/(app)/profil/razgovor.tsx',import.meta.url),'utf8');
 const labels=readFileSync(new URL('../../../src/ui/workerProfile/workerProfileFacts.ts',import.meta.url),'utf8');
 const presentation=readFileSync(new URL('../../../src/ui/workerProfile/WorkerAiPresentation.tsx',import.meta.url),'utf8');
 assert.match(route,/welcome=\{hasProfileContent\?'Šta želiš da dopuniš\?':'Čime se baviš\?'\}/);
 assert.match(route,/Ispričaj koje usluge pružaš ili želiš da pružaš/);
 assert.doesNotMatch(route,/svakodnevnu pomoć, poput dostave i nošenja stvari/);
 assert.match(labels,/skills: 'Usluge koje nudiš'/);
 assert.match(labels,/key: 'skills', label: 'Usluge'/);
 assert.match(presentation,/label="Usluge koje nudiš"/);
 assert.match(presentation,/listEditor\('skills','Usluge koje nudiš',skills\)/);
});

test('remote-only draft profile knows the server still requires a city for activation',()=>{
 const draftContext='Server-owned worker profile status (DRAFT requires city before activation; ACTIVE is already active)';
 assert.ok(prompt.includes(draftContext));
 assert.match(prompt,/NEW DRAFT worker profile still requires a city, alongside its country/);
 assert.match(prompt,/city does NOT limit where online tasks appear/);
 assert.match(prompt,/ask ONE natural short question for the city and country before suggesting activation/);
 assert.match(prompt,/don't confuse administrative city with the on-site job radius/);
 assert.match(prompt,/never demand an on-site travel radius for remote-only tasks/);
 assert.match(prompt,/already ACTIVE profile with no city, don't reopen a location interview/);
 assert.match(prompt,/If city and country are already known, skip this question entirely/);
 assert.match(source,/\$\{context\.profileStatus\}/);
});
test('remote activation question is consistent with the server, not an invented AI requirement',()=>{
 const activationSql=readFileSync(new URL('../../../src/ui/workerProfile/workerProfileFacts.ts',import.meta.url),'utf8');
 // The existing client openly models city/country as requirements for activation.
 assert.match(activationSql,/Activation needs a country and a city/);
 assert.match(activationSql,/place\.operatingCountryCode && place\.city\.trim\(\)\.length > 0/);
 assert.doesNotMatch(prompt,/do not demand a city or radius for exclusively remote work/);
});
