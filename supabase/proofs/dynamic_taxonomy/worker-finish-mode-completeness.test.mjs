import test from 'node:test';
import assert from 'node:assert/strict';
import {workerServicesMissingScope,workerFinishReviewMessage}
  from '../../functions/_shared/classificationGeminiShadow.mjs';

test('4 offered skills and 2 hinted modes produce two missing confirmations, never implicit consent',()=>{
 const skills=['Krečenje','Gletovanje','Montaža nameštaja','IT podrška'];
 const hints=[{service:'Krečenje',mode:'ON_SITE'}, {service:'Gletovanje',mode:'ON_SITE'}];
 const result=workerServicesMissingScope(skills,hints);
 assert.deepEqual(result,{count:2,labels:['Montaža nameštaja','IT podrška']});
 const message=workerFinishReviewMessage(skills,hints,true);
 assert.match(message,/Otvori pregled profila/);
 assert.match(message,/Montaža nameštaja/);
 assert.match(message,/IT podrška/);
 assert.match(message,/bez automatskog povezivanja/);
 assert.doesNotMatch(message,/profil je sačuvan|profil je aktiviran/i);
});
test('explicit mode is required; UNCONFIRMED, duplicates and unknown service cannot hide missing skill',()=>{
 const skills=['Krečenje','Gletovanje','GLETOVANJE','Montaža nameštaja'];
 const hints=[{service:'Кречење',mode:'ON_SITE'}, {service:'Gletovanje',mode:'UNCONFIRMED'},
   {service:'Krečenje',mode:'ON_SITE'}, {service:'Nov posao',mode:'REMOTE'}];
 assert.deepEqual(workerServicesMissingScope(skills,hints),
  {count:2,labels:['Gletovanje','Montaža nameštaja']});
});
test('all modes covered or missing catalog preserves short finish and optional review',()=>{
 const skills=['Krečenje','Gletovanje'];
 const hints=[{service:'Krečenje',mode:'ON_SITE'},{service:'Gletovanje',mode:'ON_SITE'}];
 const expected='Otvori pregled profila. Tamo možeš da dopuniš podatke i potvrdiš čuvanje.';
 assert.equal(workerFinishReviewMessage(skills,hints,true),expected);
 assert.equal(workerFinishReviewMessage(skills,[],false),expected);
 assert.deepEqual(workerServicesMissingScope([],hints),{count:0,labels:[]});
});
test('finish guidance is bounded and does not enter a mandatory question loop',()=>{
 const skills=Array.from({length:45},(_,i)=>'Usluga broj '+(i+1));
 const msg=workerFinishReviewMessage(skills,[],true);
 assert.match(msg,/Usluga broj 1/);
 assert.match(msg,/Usluga broj 2/);
 assert.match(msg,/i još 43 usluga/);
 assert.ok(msg.length<500);
 assert.doesNotMatch(msg,/Usluga broj 45/);
 assert.match(msg,/Možeš to razjasniti u razgovoru, ili sačuvati profil/);
});
// Actual finish output after mode preservation is exercised through the real
// worker handler in proofs/ai/v5_worker_edge.test.mjs, not source formatting.
