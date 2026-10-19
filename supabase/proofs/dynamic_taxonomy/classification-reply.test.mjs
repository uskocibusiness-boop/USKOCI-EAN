import test from 'node:test';
import assert from 'node:assert/strict';
import { withClassificationFeedback } from '../../functions/_shared/classificationReply.mjs';
const turn={safety:'ALLOW',assistantMessage:'Izrada kod izvršioca uz dostavu može biti na daljinu.',
  proposals:[{key:'need.category',value:'3D štampa'}],dialogue:{next:'ANSWER',questionKey:''}};
const feedback={state:'ASK_USER',canOfferReview:false,questions:['Kakav rezultat želiš?'],notice:'Još je nacrt.'};
test('classification question follows the answer and preserves independent facts',()=>{
  const next=withClassificationFeedback(turn,feedback);
  assert.ok(next.assistantMessage.startsWith(turn.assistantMessage));
  assert.ok(next.assistantMessage.endsWith(feedback.questions[0]));
  assert.equal(next.proposals,turn.proposals);
});
test('existing natural question is not doubled',()=>{
  const asked={...turn,assistantMessage:'Kakve figurice želiš da izradimo?'};
  assert.equal(withClassificationFeedback(asked,feedback).assistantMessage,asked.assistantMessage);
});
test('finish cannot claim readiness when a service needs clarification',()=>{
  const next=withClassificationFeedback({...turn,assistantMessage:'Spremno za pregled.',dialogue:{next:'REVIEW',questionKey:''}},feedback,{finishOnly:true});
  assert.equal(next.assistantMessage,feedback.questions[0]);
  assert.equal(next.dialogue.next,'CLARIFY');
  assert.equal(next.dialogue.questionKey,'');
});
test('valid creation proposal may proceed to review but cannot activate anything',()=>{
  assert.equal(withClassificationFeedback(turn,{state:'PENDING',canOfferReview:true}),turn);
});
test('technical classification issue never invents another user question',()=>{
  const next=withClassificationFeedback(turn,{state:'RETRY',canOfferReview:false,questions:[],notice:'Provera trenutno nije dostupna.'});
  assert.ok(next.assistantMessage.endsWith('Provera trenutno nije dostupna.'));
  assert.equal(next.proposals,turn.proposals);
});
test('safety refusal remains unchanged',()=>{
  const blocked={...turn,safety:'BLOCK'};
  assert.equal(withClassificationFeedback(blocked,feedback),blocked);
});
