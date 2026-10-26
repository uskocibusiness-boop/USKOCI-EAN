import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const task=readFileSync('supabase/functions/uskoci-ai-interview/index.ts','utf8');
const worker=readFileSync('supabase/functions/uskoci-worker-interview/index.ts','utf8');

test('task background classifier runs on semantic fingerprint change or an exact pending clarification',()=>{
 assert.doesNotMatch(task,/onlyNonCoreModified/);
 assert.match(task,/const priorFingerprint=taskClassificationFingerprint/);
 assert.match(task,/const effectiveFingerprint=taskClassificationFingerprint/);
 assert.match(task,/if \(classificationInputChanged \|\| Boolean\(pendingClarificationHint\)\)/);
});

test('worker same-list patch is not a classification change while explicit mode evidence remains relevant',()=>{
 assert.match(worker,/workerSkillsFingerprint\(output\.patch\.skills\)!==workerSkillsFingerprint\(context\.candidate\?\.skills\)/);
 // A nonempty metadata string is not a mode change. The active dual path
 // requires a valid offered service plus evidence from this USER turn.
 assert.match(worker,/const serviceModesModified=workerModeRequests\(serviceModeChangesJson,\s*\{messages:\[\{role:'USER',body:input\.text\}\]\},offered\)\.size>0/);
 assert.match(worker,/skillsModified \|\| serviceModesModified \|\| Boolean\(pendingWorkerClarificationHint\)/);
});
