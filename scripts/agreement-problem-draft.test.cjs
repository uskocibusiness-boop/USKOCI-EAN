const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const load = () => import(require('node:url').pathToFileURL(path.join(__dirname, '..', 'src/ui/agreements/agreementProblemDraft.ts')).href);

test('an unsent problem description survives leaving the Dogovor and is cleared only after a confirmed report', async () => {
  const d = await load();
  const scope = d.agreementProblemDraftScope('acc', 3, 'agr'), other = d.agreementProblemDraftScope('acc', 3, 'agr2');
  assert.equal(d.readAgreementProblemDraft(scope), '');
  d.rememberAgreementProblemDraft(scope, 'Majstor nije došao.');
  assert.equal(d.readAgreementProblemDraft(scope), 'Majstor nije došao.');
  assert.equal(d.readAgreementProblemDraft(other), '', 'never shown on another Dogovor');
  assert.equal(d.readAgreementProblemDraft(d.agreementProblemDraftScope('acc', 4, 'agr')), '', 'never after an account change');
  d.clearAgreementProblemDraft(scope);
  assert.equal(d.readAgreementProblemDraft(scope), '');
  const screen = fs.readFileSync(path.join(__dirname, '..', 'src/app/dogovor/[id].tsx'), 'utf8');
  assert.match(screen, /rememberAgreementProblemDraft\(problemDraftScope, value\)/);
  assert.match(screen, /clearAgreementProblemDraft\(problemDraftScope\);\n\s+return next;/, 'cleared only after the readback confirms the report');
});
