import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiClassificationShadowInstruction, inspectGeminiClassificationShadow, classificationTurnFeedback }
  from '../../functions/_shared/classificationGeminiShadow.mjs';
import { withClassificationFeedback } from '../../functions/_shared/classificationReply.mjs';

for (const purpose of ['NEED_SERVICE', 'WORKER_CAPABILITY']) {
  for (const phase of ['direct', 'research']) {
    test(`${purpose}/${phase} metadata instruction respects one necessary question per turn`, () => {
      const text = geminiClassificationShadowInstruction(purpose, phase);
      assert.ok(text.includes('at most ONE necessary question per turn'));
      assert.doesNotMatch(text, /THREE (?:related|semantic) questions/);
      assert.ok(text.includes('FULL SNAPSHOT'));
      assert.ok(text.includes('never owner consent'));
    });
  }

  test(`${purpose} asks one unresolved question without losing the other issues`, () => {
    const services = ['Popravka predmeta', 'Izrada ukrasa', 'Organizacija prostora'];
    const catalog = {catalogVersion: 9, categories: []};
    const plans = services.map(service => ({service, mode: 'REMOTE', action: 'ASK_CLARIFICATION',
      categoryId: '', parentId: '', proposedPath: [], reason: 'The intended concrete work still needs clarification.', catalogVersion: 9}));
    const base = {assistantMessage: 'Spremno za pregled.', safety: 'ALLOW', facts: [],
      dialogue: {next: 'REVIEW', questionKey: ''}};
    const inspected = inspectGeminiClassificationShadow({...base, classificationShadowJson: JSON.stringify(plans)}, catalog, purpose);
    const original = structuredClone(inspected);
    const feedback = classificationTurnFeedback(inspected, {purpose, services, readyForReview: true});
    assert.equal(feedback.state, 'ASK_USER');
    assert.equal(feedback.canOfferReview, false);
    assert.equal(feedback.questions.length, 1);
    assert.equal(feedback.issues.length, 3);
    assert.ok(feedback.questions[0].includes(services[0]));
    assert.deepEqual(inspected, original);
    const reply = withClassificationFeedback(base, feedback, {finishOnly: true});
    assert.equal((reply.assistantMessage.match(/\?/g) ?? []).length, 1);
    assert.equal(reply.dialogue.next, 'CLARIFY');
    assert.deepEqual(reply.facts, base.facts);
    const next = classificationTurnFeedback({...inspected, issues: inspected.issues.slice(1)},
      {purpose, services: services.slice(1), readyForReview: true});
    assert.equal(next.issues.length, 2);
    assert.equal(next.questions.length, 1);
    assert.ok(next.questions[0].includes(services[1]));
  });
}
