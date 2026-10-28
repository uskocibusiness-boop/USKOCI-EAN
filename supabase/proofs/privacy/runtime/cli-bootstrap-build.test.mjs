import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {applyPinnedOmission, cliSource, omitLegacyWebhook, validateCliReceipt} from './cli-bootstrap-build.mjs';
import {validateNoLegacyWebhook} from './run.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
test('pinned omission preserves every byte outside the one initial-schema expression', () => {
  const source = Buffer.from('first\n` + webhookSchema + `\nlast\n');
  const target = Buffer.from('first\nlast\n');
  const contract = {source_sha256:hash(source),omitted_expression:'` + webhookSchema + `\n',patched_sha256:hash(target)};
  assert.deepEqual(applyPinnedOmission(source,contract),target);
  assert.throws(() => applyPinnedOmission(Buffer.from('different\n'),contract),/SOURCE_DRIFT/);
  assert.throws(() => applyPinnedOmission(source,{...contract,patched_sha256:'a'.repeat(64)}),/PATCH_DRIFT/);
  for (const changed of ['', 'missing', 'first']) {
    assert.throws(() => applyPinnedOmission(source,{...contract,omitted_expression:changed}));
  }
  const duplicated = Buffer.concat([source,source]);
  assert.throws(() => applyPinnedOmission(duplicated,{...contract,source_sha256:hash(duplicated)}),/CARDINALITY/);
  assert.throws(() => omitLegacyWebhook(source),/SOURCE_DRIFT/);
});

const sourceHash = hash(readFileSync(new URL('./cli-bootstrap-source.json',import.meta.url)));
const receipt = () => ({unit:'R01_CLI_BOOTSTRAP_BUILD',result:'BUILT',
  upstream_commit:cliSource.upstream_commit,upstream_version:cliSource.upstream_version,
  build_version:cliSource.build_version,go_version:cliSource.go_version,
  go_archive_sha256:cliSource.go_archive_sha256,source_manifest_sha256:sourceHash,
  patched_source_sha256:cliSource.patched_sha256,binary_sha256:'b'.repeat(64),
  source_clean_before_patch:true,exact_patch_only:true,modules_verified:true,managed_object_rewrites:false,
  upstream_source_hashes:structuredClone(cliSource.source_files)});
test('runtime refuses an official or unbound derivative binary, drifted toolchain and unverified sources', () => {
  validateCliReceipt(receipt(),'b'.repeat(64),sourceHash);
  for (const mutation of [{result:'FAIL'},{build_version:'2.116.0'},
    {upstream_commit:'a'.repeat(40)},{go_version:'go1.27.3'},
    {go_archive_sha256:'a'.repeat(64)},{patched_source_sha256:'a'.repeat(64)},
    {source_clean_before_patch:false},{exact_patch_only:false},{modules_verified:false},
    {managed_object_rewrites:true},{upstream_source_hashes:{}}]) {
    assert.throws(() => validateCliReceipt({...receipt(),...mutation},'b'.repeat(64),sourceHash));
  }
  assert.throws(() => validateCliReceipt(receipt(),'c'.repeat(64),sourceHash));
  assert.throws(() => validateCliReceipt(receipt(),'b'.repeat(64),'c'.repeat(64)));
});

test('bootstrap admission requires absent legacy hooks and actual invoker pg_net functions', () => {
  const valid = {webhook_schema_absent:true,webhook_function_absent:true,webhook_event_absent:true,
    net_get_invoker:true,net_post_invoker:true};
  validateNoLegacyWebhook(valid);
  for (const key of Object.keys(valid)) {
    for (const value of [false,null,'true',undefined]) {
      assert.throws(() => validateNoLegacyWebhook({...valid,[key]:value}),/LEGACY_WEBHOOK_BOOTSTRAP_PRESENT/);
    }
  }
  assert.throws(() => validateNoLegacyWebhook(null));
});
