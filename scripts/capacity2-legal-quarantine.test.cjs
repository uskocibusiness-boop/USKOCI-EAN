'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fixture, preimage } = require('./capacity2-legal-quarantine-fixture.cjs');
const termsHash = preimage.documents.find(d => d.document_kind === 'TERMS').content_sha256;
const privacyHash = preimage.documents.find(d => d.document_kind === 'PRIVACY').content_sha256;
const reviewedAcceptSql = 'select public.rpc_accept_reviewed_legal_bundle($1,$2,$3) as value';

test('real prior RPCs wrongly report ready; exact quarantine closes both and preserves audit contents and ACL', async () => {
 const f = await fixture();
 try {
  const before = await f.snapshot();
  const bundle = await f.asRole('anon', 'select public.rpc_get_legal_bundle() as value');
  const processor = await f.asRole('authenticated', 'select public.rpc_get_processor_map_status() as value');
  assert.equal(bundle.ready, true); assert.equal(bundle.documents.length, 2);
  assert.equal(processor.ready, true);
  assert.equal(processor.counselReference, preimage.processorMaps[0].counsel_reference);
  assert.equal(before.acceptances.length, 0);
  await f.run();
  const after = await f.snapshot();
  assert.deepEqual(await f.asRole('anon', 'select public.rpc_get_legal_bundle() as value'), {
   ready: false, acceptedCurrentBundle: false, documents: [], reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED',
  });
  assert.deepEqual(await f.asRole('authenticated', 'select public.rpc_get_processor_map_status() as value'), {
   ready: false, reason: 'PROCESSOR_MAP_NOT_PUBLISHED', technicalProviderCount: 4,
   requiredCurrentProviders: 3, runtimeProviderGateAdmitted: false,
  });
  for (const key of ['entries', 'inventory', 'acceptances', 'functions', 'tableSecurity']) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.documents.length, 2); assert.equal(after.maps.length, 1);
  for (let i = 0; i < after.documents.length; i++) {
   const row = after.documents[i];
   assert.equal(row.is_active, false); assert.ok(row.retired_at);
   assert.deepEqual({ ...row, is_active: true, retired_at: null }, before.documents[i]);
  }
  assert.ok(after.maps[0].retired_at);
  assert.deepEqual({ ...after.maps[0], retired_at: null }, before.maps[0]);
  await assert.rejects(f.asRole('authenticated', 'select public.rpc_accept_legal_bundle($1) as value', ['quarantine_test_request_1']),
   /LEGAL_DOCUMENTS_NOT_PUBLISHED/);
  await assert.rejects(f.asRole('authenticated', reviewedAcceptSql, ['quarantine_test_request_2', termsHash, privacyHash]),
   /LEGAL_DOCUMENTS_NOT_PUBLISHED/);
  const readback = await f.asRole('authenticated', 'select public.rpc_read_my_legal_acceptance($1) as value', ['quarantine_test_request_2']);
  assert.equal(readback.found, false); assert.equal(readback.receipt, null); assert.equal(readback.authoritative, true);
  assert.equal((await f.snapshot()).acceptances.length, 0);
 } finally { await f.db.close(); }
});

test('unrelated historical acceptances, future drafts and retired processor rows survive byte for byte', async () => {
 const f = await fixture();
 try {
  const historical = [];
  for (const d of preimage.documents) {
   const old = { ...d, id: randomUUID(), version_label: 'fixture_old', is_active: false, retired_at: '2026-11-07T23:59:00Z' };
   await f.insert('private.legal_document_versions', old); historical.push(old);
   await f.insert('private.legal_document_versions', { ...d, id: randomUUID(), version_label: 'fixture_future', is_active: false,
    published_at: '2099-01-01T00:00:00Z', effective_at: '2099-01-01T00:00:00Z' });
  }
  const terms = historical.find(d => d.document_kind === 'TERMS'), privacy = historical.find(d => d.document_kind === 'PRIVACY');
  await f.insert('public.account_legal_acceptance_events', { id: randomUUID(), account_id: f.accountId, request_id: 'fixture_old_acceptance_1',
   terms_document_id: terms.id, terms_version_label: terms.version_label, terms_content_sha256: terms.content_sha256,
   privacy_document_id: privacy.id, privacy_version_label: privacy.version_label, privacy_content_sha256: privacy.content_sha256 });
  const oldMap = { ...f.map, id: randomUUID(), map_version: 'fixture_old', retired_at: '2026-11-07T23:59:00Z' };
  await f.insert('private.processor_map_sets', oldMap);
  await f.insert('private.processor_map_entries', { ...preimage.processorEntries[0], id: randomUUID(), map_id: oldMap.id });
  const before = await f.snapshot();
  await f.run(); const after = await f.snapshot();
  const unrelated = d => d.version_label !== 'v1.0-20261108';
  assert.deepEqual(after.documents.filter(unrelated), before.documents.filter(unrelated));
  assert.deepEqual(after.maps.filter(m => m.id !== f.map.id), before.maps.filter(m => m.id !== f.map.id));
  for (const key of ['entries', 'inventory', 'acceptances', 'functions', 'tableSecurity']) assert.deepEqual(after[key], before[key], key);
  const historicalReceipt = await f.asRole('authenticated', 'select public.rpc_read_my_legal_acceptance($1) as value', ['fixture_old_acceptance_1']);
  assert.equal(historicalReceipt.found, true); assert.equal(historicalReceipt.receipt.termsVersion, 'fixture_old');
 } finally { await f.db.close(); }
});

test('a newly accepted target bundle stops the withdrawal atomically for review', async () => {
 const f = await fixture();
 try {
  assert.equal((await f.asRole('authenticated', reviewedAcceptSql, ['fixture_target_acceptance_1', termsHash, privacyHash])).accepted, true);
  const before = await f.snapshot();
  await assert.rejects(f.run(), /R12_QUARANTINE_ACCEPTANCE_REQUIRES_REVIEW/);
  assert.deepEqual(await f.snapshot(), before);
 } finally { await f.db.close(); }
});

test('current LegalReviewController stops offering acceptance after the real RPC refresh reports withdrawn documents', async () => {
 const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
 const source = fs.readFileSync(path.join(__dirname, '../src/ui/legal/legalReview.ts'), 'utf8');
 const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
 const mod = { exports: {} }; new Function('module', 'exports', 'require', compiled)(mod, mod.exports, require);
 const { LegalReviewController, reviewedDocuments } = mod.exports;
 const f = await fixture(); let calls = 0, controller;
 try {
  controller = new LegalReviewController({ isOwner: () => true, newId: () => 'controller_quarantine_request',
   readBundle: async () => ({ ok: true, podatak: await f.value('select public.rpc_get_legal_bundle() as value') }),
   readProcessors: async () => ({ ok: true, podatak: await f.value('select public.rpc_get_processor_map_status() as value') }),
   accept: async () => { calls++; throw new Error('No acceptance should be sent after withdrawal'); },
   readAcceptance: async () => { throw new Error('No pending intent exists'); },
  });
  const loaded = new Promise(resolve => { const off = controller.subscribe(() => { if (!controller.snapshot().loading) { off(); resolve(); } }); });
  controller.activate(); await loaded;
  assert.ok(reviewedDocuments(controller.snapshot().bundle));
  assert.equal(controller.snapshot().processors.ready, true);
  await f.run(); await controller.refresh();
  assert.equal(controller.snapshot().bundle.ready, false);
  assert.equal(controller.snapshot().processors.ready, false);
  assert.equal(reviewedDocuments(controller.snapshot().bundle), null);
  await controller.accept();
  assert.equal(calls, 0); assert.equal(controller.snapshot().receipt, null); assert.equal(controller.snapshot().pending, null);
 } finally { controller?.deactivate(); await f.db.close(); }
});

test('changed or missing documents, map approval and provider claims each fail their exact drift guard', async t => {
 const cases = [
  ['document hash', "update private.legal_document_versions set content_sha256=repeat('a',64) where document_kind='TERMS'", 'DOCUMENT'],
  ['document URL', "update private.legal_document_versions set public_url='https://example.invalid/changed' where document_kind='PRIVACY'", 'DOCUMENT'],
  ['document already retired', "update private.legal_document_versions set is_active=false,retired_at=clock_timestamp() where document_kind='TERMS'", 'DOCUMENT'],
  ['document missing', "delete from private.legal_document_versions where document_kind='PRIVACY'", 'DOCUMENT'],
  ['map counsel reference', "update private.processor_map_sets set counsel_reference='A separately changed reference'", 'MAP'],
  ['map effective time', "update private.processor_map_sets set effective_at=effective_at+interval '1 second'", 'MAP'],
  ['provider DPA claim', "update private.processor_map_entries set dpa_reference='A separately changed DPA reference' where provider_code='OPENAI_AI'", 'ENTRIES'],
  ['provider entry missing', "delete from private.processor_map_entries where provider_code='OPENAI_AI'", 'ENTRIES'],
 ];
 for (const [name, mutation, guard] of cases) await t.test(name, async () => {
  const f = await fixture();
  try {
   await f.db.exec(mutation); const before = await f.snapshot();
   await assert.rejects(f.run(), new RegExp('R12_QUARANTINE_' + guard + '_PREIMAGE_DRIFT'));
   assert.deepEqual(await f.snapshot(), before);
  } finally { await f.db.close(); }
 });
});

test('repeating the migration does not silently overwrite an already withdrawn snapshot', async () => {
 const f = await fixture();
 try {
  await f.run(); const before = await f.snapshot();
  await assert.rejects(f.run(), /R12_QUARANTINE_DOCUMENT_PREIMAGE_DRIFT/);
  assert.deepEqual(await f.snapshot(), before);
 } finally { await f.db.close(); }
});

test('client roles cannot read or republish the quarantined private registry', async () => {
 const f = await fixture();
 try {
  await f.run(); const before = await f.snapshot();
  for (const role of ['anon', 'authenticated']) {
   await assert.rejects(f.asRole(role, 'select count(*) as value from private.legal_document_versions'), /permission denied/);
   await assert.rejects(f.asRole(role, "update private.legal_document_versions set is_active=true,retired_at=null returning id as value"), /permission denied/);
   await assert.rejects(f.asRole(role, 'select count(*) as value from private.processor_map_entries'), /permission denied/);
   await assert.rejects(f.asRole(role, 'select count(*) as value from public.account_legal_acceptance_events'), /permission denied/);
  }
  assert.deepEqual(await f.snapshot(), before);
 } finally { await f.db.close(); }
});
