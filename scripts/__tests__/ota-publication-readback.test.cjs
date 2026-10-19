'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { expectedPublication, selectPublicationGroup, verifyPublicationView } = require('../ota-publication-readback.cjs');

const expected = expectedPublication('a'.repeat(40), '123');
const group = '11111111-1111-4111-8111-111111111111';
const otherGroup = '22222222-2222-4222-8222-222222222222';
function listed(message = `"${expected.message}" (28 seconds ago by qa)`) {
  return { currentPage: [{ group, branch: expected.branch, runtimeVersion: expected.runtimeVersion,
    platforms: 'android', isRollBackToEmbedded: false, message }] };
}
function raw() {
  return [{ id: '33333333-3333-4333-8333-333333333333', group, branch: expected.branch,
    message: expected.message, runtimeVersion: expected.runtimeVersion, platform: 'android',
    isRollBackToEmbedded: false, gitCommitHash: expected.sourceSha,
    manifestPermalink: 'sensitive-provider-field-must-not-escape' }];
}

test('decorated list finds a candidate and raw view proves the exact release', () => {
  const selected = selectPublicationGroup(listed(), expected);
  const receipt = verifyPublicationView(raw(), selected, expected);
  assert.equal(receipt.group, group);
  assert.equal(receipt.sourceSha, expected.sourceSha);
  assert.equal(receipt.updateId, raw()[0].id);
  assert.equal(receipt.platform, 'android');
  assert.equal(Object.hasOwn(receipt, 'manifestPermalink'), false);
  assert.equal(JSON.stringify(receipt).includes('sensitive-provider-field'), false);
});
test('undecorated list still selects the same exact publication', () => {
  assert.equal(selectPublicationGroup(listed(expected.message), expected), group);
});
for (const [name, mutation] of [
  ['different run', x => { x.currentPage[0].message = `"${expected.message}4" (now by qa)`; }],
  ['different source', x => { x.currentPage[0].message = x.currentPage[0].message.replace('a'.repeat(40), 'b'.repeat(40)); }],
  ['quoted text without presentation suffix', x => { x.currentPage[0].message = `"${expected.message}"`; }],
  ['wrong branch', x => { x.currentPage[0].branch = 'production'; }],
  ['wrong runtime', x => { x.currentPage[0].runtimeVersion = 'old'; }],
  ['mixed platforms', x => { x.currentPage[0].platforms = 'ios, android'; }],
  ['rollback', x => { x.currentPage[0].isRollBackToEmbedded = true; }],
  ['unknown rollback state', x => { delete x.currentPage[0].isRollBackToEmbedded; }],
  ['invalid group', x => { x.currentPage[0].group = '--other-option'; }],
]) test(`list refuses ${name}`, () => {
  const input = listed(); mutation(input);
  assert.throws(() => selectPublicationGroup(input, expected), /OTA_READBACK_GROUP_MISSING/);
});
test('missing or ambiguous list outcomes never select the latest row by guess', () => {
  assert.throws(() => selectPublicationGroup({}, expected), /OTA_READBACK_LIST_INVALID/);
  assert.throws(() => selectPublicationGroup({ currentPage: [] }, expected), /OTA_READBACK_GROUP_MISSING/);
  const input = listed(); input.currentPage.push({ ...input.currentPage[0], group: otherGroup });
  assert.throws(() => selectPublicationGroup(input, expected), /OTA_READBACK_GROUP_AMBIGUOUS/);
});
for (const [field, value] of [
  ['gitCommitHash', 'b'.repeat(40)], ['gitCommitHash', undefined],
  ['branch', 'production'], ['platform', 'ios'], ['runtimeVersion', 'old'],
  ['message', `${expected.message}4`], ['message', `"${expected.message}" (now by qa)`],
  ['group', otherGroup], ['id', null], ['isRollBackToEmbedded', true], ['isRollBackToEmbedded', undefined],
]) test(`raw view rejects ${field}=${String(value)}`, () => {
  const input = raw(); input[0][field] = value;
  assert.throws(() => verifyPublicationView(input, group, expected), /OTA_READBACK_PUBLICATION_IDENTITY_MISMATCH/);
});
test('raw view must have exactly one Android update in the selected group', () => {
  for (const input of [null, {}, [], [...raw(), ...raw()]])
    assert.throws(() => verifyPublicationView(input, group, expected), /OTA_READBACK_VIEW_MISSING_OR_AMBIGUOUS/);
});
test('expectations require a complete source identity and run ID', () => {
  assert.throws(() => expectedPublication('abcdef', '123'), /OTA_READBACK_EXPECTATION_INVALID/);
  assert.throws(() => expectedPublication(expected.sourceSha, '123 other'), /OTA_READBACK_EXPECTATION_INVALID/);
});
