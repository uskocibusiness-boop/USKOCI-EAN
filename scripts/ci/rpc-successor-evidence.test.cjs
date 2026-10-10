'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const successor = require('../control/rpc-successor-evidence.cjs');

const root = path.resolve(__dirname, '../..');
const cases = [
  ['rpc_list_my_agreements', 'rpc_list_my_agreements_page', 'src/data/agreementClientService.ts'],
  ['rpc_send_agreement_message', 'rpc_send_agreement_message_v2', 'src/data/agreementMessageClientService.ts'],
  ['rpc_get_push_device', 'rpc_get_push_device_owned', 'src/data/pushDeviceClientService.ts'],
];

test('actual current client contains the newer exact RPC literals, not old calls', () => {
  for (const [old, modern, filename] of cases) {
    const source = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.match(source, new RegExp("['\\"`]" + modern + "['\\"`]"));
    assert.doesNotMatch(source, new RegExp("['\\"`]" + old + "['\\"`]"));
    const result = successor(old, { [filename]: source }, new Set([filename]));
    assert.equal(result.status_poziva, 'MOGUCA_NOVIJA_KLIJENTSKA_ZAMENA');
    assert.equal(result.kandidat_novijeg_rpc, modern);
    assert.equal(result.dokaz, 'SOURCE_ONLY_NOT_RUNTIME_OR_SEMANTIC_PARITY');
  }
});

test('unreachable module or missing new RPC never becomes a replacement claim', () => {
  for (const [old, modern, filename] of cases) {
    assert.equal(successor(old, { [filename]: "'"+modern+"'" }, new Set()).status_poziva,
      'NIJE_DIREKTNO_REFERENCIRANO_NAMENA_ZA_PROVERU');
    assert.equal(successor(old, { [filename]: 'unrelated' }, new Set([filename])).kandidat_novijeg_rpc,
      undefined);
  }
});

test('unknown or semantically unverified legacy RPC stays unclassified', () => {
  const result = successor('rpc_ai_open_conversation', {
    'src/data/workerAiClientService.ts': "'rpc_open_worker_ai'",
  }, new Set(['src/data/workerAiClientService.ts']));
  assert.equal(result.status_poziva, 'NIJE_DIREKTNO_REFERENCIRANO_NAMENA_ZA_PROVERU');
  assert.equal(result.kandidat_novijeg_rpc, undefined);
});
