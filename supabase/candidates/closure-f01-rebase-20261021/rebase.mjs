import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const original = JSON.parse(readFileSync(dir + '../closure-taxonomy-20261018/predecessor.json', 'utf8'));
const readback = JSON.parse(readFileSync(dir + 'readback_manifest.json', 'utf8'));
const drift = JSON.parse(readFileSync(dir + 'live_drift_readback.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const md5 = text => createHash('md5').update(text).digest('hex');
const canonical = value => JSON.stringify(sort(value));
const sort = value => Array.isArray(value)
  ? value.map(sort)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]))
    : value;

const changedSignatures = new Set([
  'public.rpc_taxonomy_bind_reviewed_need_service(uuid, uuid, uuid, uuid, integer)',
  'public.rpc_taxonomy_bind_reviewed_worker_service(uuid, uuid, uuid, uuid)',
  'public.rpc_taxonomy_capture_gemini_turn_hints_service(uuid, uuid, uuid, uuid, uuid, text, bigint, jsonb)',
  'public.rpc_taxonomy_commit_admission_service(uuid)',
  'public.rpc_taxonomy_commit_reviewed_batch_service(uuid, uuid, text, uuid, jsonb)',
  'public.rpc_taxonomy_prepare_admission_service(uuid, uuid, text, uuid, jsonb)',
]);

assert.equal(readback.projectRef, 'leqcwgzvjsxugfgzdmth');
assert.equal(drift.projectRef, readback.projectRef);
assert.equal(readback.executingClosureCount, 0);
assert.equal(readback.sourceCertificate, drift.sourceCertificate);
assert.equal(readback.erasureCertificate, drift.erasureCertificate);
assert.equal(readback.sourceDigest, drift.sourceDigest);
assert.equal(readback.programDigest, drift.programDigest);
assert.equal(readback.functions.length, 34);
assert.equal(readback.tables.length, 20);
assert.equal(drift.functions.length, changedSignatures.size);
assert.equal(readback.sourceCertificate, original.certified);

const bySignature = new Map(readback.functions.map(x => [x.signature, x]));
const driftBySignature = new Map(drift.functions.map(x => [x.signature, x]));
assert.equal(bySignature.size, original.functions.length);
assert.equal(driftBySignature.size, changedSignatures.size);
const predecessor = structuredClone(original);
for (const f of predecessor.functions) {
  const live = bySignature.get(f.signature);
  assert.ok(live?.found, `F01_FUNCTION_MISSING:${f.signature}`);
  const replacement = driftBySignature.get(f.signature);
  assert.equal(Boolean(replacement), changedSignatures.has(f.signature), `F01_UNEXPECTED_BODY_DRIFT:${f.signature}`);
  if (replacement) {
    assert.equal(replacement.bodyMd5, live.bodyMd5);
    assert.equal(replacement.owner, live.owner);
    assert.equal(replacement.acl, live.acl);
    assert.deepEqual(replacement.config, live.config);
    f.definition = replacement.definition;
    f.bodyMd5 = replacement.bodyMd5;
  } else {
    assert.equal(f.bodyMd5, live.bodyMd5, `F01_UNEXPECTED_BODY_DRIFT:${f.signature}`);
  }
  assert.equal(md5(f.definition), live.definitionMd5, `F01_DEFINITION_DRIFT:${f.signature}`);
  assert.equal(f.owner, live.owner, `F01_OWNER_DRIFT:${f.signature}`);
  assert.equal(f.acl, live.acl, `F01_ACL_DRIFT:${f.signature}`);
  assert.deepEqual(f.config, live.config, `F01_CONFIG_DRIFT:${f.signature}`);
  assert.equal(f.definer, live.securityDefiner, `F01_DEFINER_DRIFT:${f.signature}`);
  assert.equal(f.language, live.language, `F01_LANGUAGE_DRIFT:${f.signature}`);
  f.definitionMd5 = live.definitionMd5;
  f.volatility = live.volatility;
}

const byTable = new Map(readback.tables.map(x => [x.name, x]));
assert.equal(byTable.size, original.tables.length);
for (const t of predecessor.tables) {
  const live = byTable.get(t.name);
  assert.ok(live?.found, `F01_TABLE_MISSING:${t.name}`);
  assert.equal(t.owner, live.owner, `F01_TABLE_OWNER_DRIFT:${t.name}`);
  assert.equal(t.acl, live.acl, `F01_TABLE_ACL_DRIFT:${t.name}`);
  assert.equal(t.rls, live.rls, `F01_TABLE_RLS_DRIFT:${t.name}`);
  assert.equal(t.forceRls, live.forceRls, `F01_TABLE_FORCE_RLS_DRIFT:${t.name}`);
  assert.equal(live.kind, 'r', `F01_TABLE_KIND_DRIFT:${t.name}`);
  assert.deepEqual(live.policies, [], `F01_TABLE_POLICY_DRIFT:${t.name}`);
  if (t.name === 'private.taxonomy_confirmed_worker_modes_v1') {
    const added = live.shape.columns.filter(x => x.name === 'handoff');
    assert.equal(added.length, 1);
    assert.equal(canonical(added[0]), canonical({name:'handoff',type:'jsonb',notNull:false,default:null,identity:'',generated:''}));
    assert.equal(canonical(t.columns), canonical(live.shape.columns.filter(x => x.name !== 'handoff')));
  } else {
    assert.equal(canonical(t.columns), canonical(live.shape.columns), `F01_COLUMNS_DRIFT:${t.name}`);
  }
  assert.equal(canonical(t.triggers ?? []), canonical(live.shape.triggers), `F01_TRIGGERS_DRIFT:${t.name}`);
  if (t.name === 'private.taxonomy_confirmed_worker_modes_v1') {
    const added = live.shape.constraints.filter(x => x.name === 'worker_handoff_valid');
    assert.equal(added.length, 1);
    assert.equal(added[0].type, 'c');
    assert.equal(added[0].definition, "CHECK (((handoff IS NULL) OR ((execution_scope = 'REMOTE'::text) AND private.taxonomy_handoff_valid_v1(handoff))))");
    assert.equal(canonical(t.constraints ?? []), canonical(live.shape.constraints.filter(x => x.name !== 'worker_handoff_valid')));
  } else {
    assert.equal(canonical(t.constraints ?? []), canonical(live.shape.constraints), `F01_CONSTRAINTS_DRIFT:${t.name}`);
  }
  t.columns = live.shape.columns;
  t.constraints = live.shape.constraints;
  t.triggers = live.shape.triggers;
  t.kind = live.kind;
  t.policies = live.policies;
}

const snapshot = {
  status: 'VERIFIED_SUBSET_ONLY_NOT_DEPLOYABLE',
  scope: '34 historical F01 function signatures and 20 historical F01 tables',
  projectRef: readback.projectRef,
  capturedAt: readback.capturedAt,
  sourceDigest: readback.sourceDigest,
  erasureProgramDigest: readback.programDigest,
  sourceCertificate: readback.sourceCertificate,
  erasureCertificate: readback.erasureCertificate,
  readbackSha256: sha(readFileSync(dir + 'readback_manifest.json')),
  historicalBaseline: '../closure-taxonomy-20261018/predecessor.json',
  functions: predecessor.functions,
  tables: predecessor.tables,
};

const content = JSON.stringify(snapshot, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(readFileSync(dir + 'verified_subset_snapshot.json', 'utf8'), content);
else writeFileSync(dir + 'verified_subset_snapshot.json', content);
console.log(JSON.stringify({source: 'READ_ONLY_DEV_SUBSET', functions: snapshot.functions.length,
  changedBodies: changedSignatures.size, tables: predecessor.tables.length,
  changedTables: 1, readbackSha256: snapshot.readbackSha256,
  sourceDigest: snapshot.sourceDigest, certified: false}));
