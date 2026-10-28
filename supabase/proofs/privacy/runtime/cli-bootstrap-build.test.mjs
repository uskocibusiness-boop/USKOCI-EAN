import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {applyPinnedOmission, cliSource, omitLegacyWebhook, validateCliReceipt, startupSourceLinks, validateStartupSourceChain} from './cli-bootstrap-build.mjs';
import {compareManagedNetHook, managedNetHookObservation} from './managed-net-hook.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
test('pinned omission preserves every byte outside the one initial-schema expression', () => {
  const source = Buffer.from('first\n' + cliSource.omitted_expression + 'last\n');
  const target = Buffer.from('first\nlast\n');
  const contract = {source_sha256:hash(source),omitted_expression:cliSource.omitted_expression,patched_sha256:hash(target)};
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
  sidecar_sha256:'c'.repeat(64),bun_version:cliSource.bun_version,bun_archive_sha256:cliSource.bun_archive_sha256,
  pnpm_version:cliSource.pnpm_version,pnpm_archive_integrity:cliSource.pnpm_archive_integrity,
  source_clean_before_patch:true,exact_patch_only:true,modules_verified:true,managed_object_rewrites:false,
  active_startup_path_verified:true,actual_container_spec_verified:true,frozen_dependencies:true,
  start_stop_services_help_verified:true,
  upstream_source_hashes:structuredClone(cliSource.source_files)});
test('runtime refuses an official or unbound derivative binary, drifted toolchain and unverified sources', () => {
  validateCliReceipt(receipt(),'b'.repeat(64),sourceHash,'c'.repeat(64));
  for (const mutation of [{result:'FAIL'},{build_version:'2.116.0'},
    {upstream_commit:'a'.repeat(40)},{go_version:'go1.27.3'},
    {go_archive_sha256:'a'.repeat(64)},{patched_source_sha256:'a'.repeat(64)},
    {source_clean_before_patch:false},{exact_patch_only:false},{modules_verified:false},
    {managed_object_rewrites:true},{upstream_source_hashes:{}},{sidecar_sha256:'a'.repeat(64)},
    {bun_version:'1.3.0'},{pnpm_version:'10.0.0'},{frozen_dependencies:false},
    {active_startup_path_verified:false},{actual_container_spec_verified:false},{start_stop_services_help_verified:false}]) {
    assert.throws(() => validateCliReceipt({...receipt(),...mutation},'b'.repeat(64),sourceHash,'c'.repeat(64)));
  }
  assert.throws(() => validateCliReceipt(receipt(),'c'.repeat(64),sourceHash));
  assert.throws(() => validateCliReceipt(receipt(),'b'.repeat(64),'c'.repeat(64)));
});

test('the admitted entrypoint leads through the actual registered start handler to the patched TS constructor', () => {
  const sources = new Map(startupSourceLinks);
  validateStartupSourceChain(path => sources.get(path));
  assert.equal(startupSourceLinks[0][0],cliSource.entrypoint);
  assert.equal(startupSourceLinks.at(-1)[0],cliSource.patch_path);
  assert.match(cliSource.patch_path,/legacy\/shared\/db-bootstrap\/postgres.service.ts$/);
  for (const [path] of startupSourceLinks) {
    assert.ok(cliSource.source_files[path]);
    assert.throws(() => validateStartupSourceChain(name => name === path ? 'unrelated Go sidecar' : sources.get(name)),/ACTIVE_STARTUP_PATH/);
  }
});

const hookBaseline = JSON.parse(readFileSync(new URL('./managed-net-hook-expected.json', import.meta.url)));
const hookQueryHash = hash(readFileSync(new URL('./managed-net-hook.sql', import.meta.url)));
test('managed hook accepts the exact DEV native helper/event presence and invoker functions', () => {
  assert.equal(hookBaseline.observed.helper.security_definer, false);
  assert.ok(hookBaseline.observed.event);
  const result = compareManagedNetHook(hookBaseline, hookBaseline.observed, hookQueryHash);
  assert.equal(result.equal, true);
  assert.deepEqual(result.differences, []);
});

test('managed hook rejects missing objects, SECURITY DEFINER, changed body, ACL or event target', () => {
  for (const [field, value] of [
    ['helper', null], ['event', null], ['webhook_schema_absent', false],
    ['net_get_invoker', false], ['net_post_invoker', null],
    ['helper.security_definer', true], ['helper.body_md5', '0'.repeat(32)],
    ['helper.definition_md5', '0'.repeat(32)], ['helper.acl_md5', '0'.repeat(32)],
    ['helper.config_md5', null], ['helper.owner_md5', '0'.repeat(32)],
    ['event.function_md5', '0'.repeat(32)], ['event.event_md5', '0'.repeat(32)],
    ['event.enabled_md5', '0'.repeat(32)], ['event.tags_md5', '0'.repeat(32)],
  ]) {
    const observed = structuredClone(hookBaseline.observed);
    const parts = field.split('.');
    if (parts.length === 1) observed[field] = value;
    else observed[parts[0]][parts[1]] = value;
    // Missing metadata remains publishable evidence, never a successful assertion.
    assert.deepEqual(managedNetHookObservation(observed), observed);
    const result = compareManagedNetHook(hookBaseline, observed, hookQueryHash);
    assert.equal(result.equal, false);
    assert.deepEqual(result.differences, [field]);
  }
});

test('managed hook rejects query drift, malformed captures and raw unapproved values', () => {
  assert.throws(() => compareManagedNetHook(hookBaseline, hookBaseline.observed, '0'.repeat(64)));
  for (const mutate of [
    data => {data.net_get_invoker = 'true';},
    data => {data.helper.body_md5 = 'PRIVATE_SOURCE_MARKER';},
    data => {data.helper.definition = 'PRIVATE_SOURCE_MARKER';},
    data => {delete data.event;},
    data => {data.extra = 'PRIVATE_SOURCE_MARKER';},
    data => {data.event = [];},
  ]) {
    const data = structuredClone(hookBaseline.observed);
    mutate(data);
    assert.throws(() => managedNetHookObservation(data), /MANAGED_NET_HOOK_FORMAT_REFUSED/);
  }
  assert.throws(() => managedNetHookObservation(null));
});
