import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const task=readFileSync('supabase/functions/uskoci-ai-interview/index.ts','utf8');
const worker=readFileSync('supabase/functions/uskoci-worker-interview/index.ts','utf8');

test('task validates the supplied decision on semantic change or current clarification',()=>{
 assert.doesNotMatch(task,/onlyNonCoreModified/);
 assert.match(task,/const priorFingerprint=taskClassificationFingerprint/);
 assert.match(task,/const effectiveFingerprint=taskClassificationFingerprint/);
 assert.match(task,/if \(classificationInputChanged \|\| Boolean\(pendingClarificationHint\) \|\| taxonomyDecisions.length > 0\)/);
 assert.match(task,/suppliedDecisions: taxonomyDecisions/);
 assert.doesNotMatch(task,/dualArchitectPromise/);
});

test('worker carries current owned IDs across every new revision using local validation',()=>{
 assert.match(worker,/if \(Array.isArray\(effectiveSkills\) && effectiveSkills.length > 0\)/);
 assert.match(worker,/suppliedDecisions: taxonomyDecisions/);
 assert.match(worker,/serviceModeContext: context.serviceModeContext/);
 assert.match(worker,/messages: context.messages/);
 assert.doesNotMatch(worker,/dualWorkerArchitectPromise|skillsModified \|\| serviceModesModified/);
});
