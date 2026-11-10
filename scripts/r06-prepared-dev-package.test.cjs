'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('./r06-pre-provider-input-fixture.cjs');
const { PROJECT, GUARDED_TABLES, NEW_FUNCTIONS, ADDED_COLUMNS, sourceContract, tableSql, functionSql, buildPackage } = require('./r06-prepared-dev-package.cjs');
const native = process.env.USKOCI_R06_PACKAGE_NATIVE === '1';
const runtime = native ? require('./p0-discovery-native-benchmark.cjs') : null;

const clone = value => JSON.parse(JSON.stringify(value));
const q = value => "'" + value.replaceAll("'", "''") + "'";
async function captureFixture(f) {
  // The existing reduced SQL fixture omits RLS on these two read dependencies.
  // Use their captured enabled state for the operation gate; this does not
  // pretend to install or test the complete hosted reader-policy graph.
  await f.db.exec('alter table private.retention_holds enable row level security; alter table public.ai_messages enable row level security; set search_path=pg_catalog');
  const system_identifier = await f.value('select system_identifier::text as value from pg_control_system()');
  const tables = [];
  for (const relation of GUARDED_TABLES) tables.push((await f.db.query(tableSql(q(relation)))).rows[0].jsonb_build_object);
  const functions = [];
  for (const { signature } of sourceContract().pins) functions.push((await f.db.query(functionSql(q(signature)))).rows[0].jsonb_build_object);
  return { projectRef: PROJECT, database: 'postgres', system_identifier, tables, functions };
}

test('R06 dormant DEV operation preserves old owners and rolls back only unused preparation', async t => {
  const f = native ? await runtime.startFixture(Driver => fixture({ Driver, native: true })) : await fixture();
  const reject = async (sql, pattern) => {
    await assert.rejects(f.db.exec(sql), pattern);
    await f.db.exec('rollback');
  };
  try {
    const capture = await captureFixture(f);
    const operation = buildPackage(capture);
    const projectionBefore = await f.value('select private.data_export_projection_sha_v5() as value');
    await t.test('read-only preflight succeeds without adding an object or changing a budget', async () => {
      const budgetBefore = await f.value("select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) as value from private.ai_test_budget_v5 b");
      await f.db.exec(operation.preflight);
      assert.equal(await f.value('select to_regprocedure($1) is null as value', [NEW_FUNCTIONS[0]]), true);
      assert.equal(await f.value('select private.data_export_projection_sha_v5() as value'), projectionBefore);
      assert.deepEqual(await f.value("select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) as value from private.ai_test_budget_v5 b"), budgetBefore);
    });
    await t.test('foreign project identity is rejected before any schema mutation', async () => {
      const other = { ...capture, system_identifier: String(BigInt(capture.system_identifier) + 1n) };
      await reject(buildPackage(other).install, /R06_DEV_PROJECT_MISMATCH/);
      assert.equal(await f.value('select to_regprocedure($1) is null as value', [NEW_FUNCTIONS[0]]), true);
    });
    await t.test('an unexpected owner ACL is rejected without laundering its privileges', async () => {
      const signature = 'private.data_export_dataset_catalog()';
      await f.db.exec(`grant execute on function ${signature} to service_role`);
      await reject(operation.install, /R06_DEV_PREIMAGE_FUNCTION_DRIFT/);
      assert.equal(await f.value("select has_function_privilege('service_role',$1,'EXECUTE') as value", [signature]), true);
      await f.db.exec(`revoke execute on function ${signature} from service_role`);
      await f.db.exec(operation.preflight);
    });
    await t.test('an unexpected owner body is rejected before adding a column', async () => {
      const signature = 'private.data_export_dataset_catalog()';
      const original = capture.functions.find(fn => fn.signature === signature).definition;
      await f.db.exec(original.replace('AS $function$', 'AS $function$\n-- independent drift\n'));
      await reject(operation.install, /R06_DEV_PREIMAGE_FUNCTION_DRIFT/);
      await f.db.exec(original);
      assert.equal(await f.value("select count(*)::int as value from pg_attribute where attrelid='private.ai_need_turn_commands'::regclass and attname='prepared_input' and not attisdropped"), 0);
    });
    await t.test('a new dependency or table column is rejected instead of silently replaced', async () => {
      await f.db.exec('alter table private.ai_need_turn_commands add column independent_guard text');
      await reject(operation.install, /R06_DEV_TABLE_DRIFT/);
      await f.db.exec('alter table private.ai_need_turn_commands drop column independent_guard');
    });
    await t.test('canonical-message and retention dependencies cannot drift behind the new cleanup owner', async () => {
      await f.db.exec('alter table private.retention_holds add column independent_hold_drift boolean');
      await reject(operation.install, /R06_DEV_TABLE_DRIFT:private.retention_holds/);
      await f.db.exec('alter table private.retention_holds drop column independent_hold_drift');
      await f.db.exec('alter table public.ai_messages disable row level security');
      await reject(operation.install, /R06_DEV_TABLE_DRIFT:public.ai_messages/);
      await f.db.exec('alter table public.ai_messages enable row level security');
      const original = capture.functions.find(fn => fn.signature === 'private.closure_account_key(uuid)').definition;
      await f.db.exec(original.replace('AS $function$', 'AS $function$\n-- lock identity drift\n'));
      await reject(operation.install, /R06_DEV_PREIMAGE_FUNCTION_DRIFT:private.closure_account_key/);
      await f.db.exec(original);
      await f.db.exec(operation.preflight);
    });
    await t.test('an active turn requires a drain but the read-only preflight remains usable', async () => {
      await f.seed('NEED_SERVICE');
      await f.db.exec(operation.preflight);
      await reject(operation.install, /R06_DEV_ACTIVE_TURN_DRAIN_REQUIRED/);
      await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
    });
    let beforeRows;
    await t.test('atomic install and exact postflight preserve existing rows and private authority', async () => {
      beforeRows = await f.value("select jsonb_agg(to_jsonb(t)) as value from private.ai_need_turn_commands t");
      await f.db.exec(operation.install);
      await f.db.exec(operation.postflight);
      const afterRows = await f.value("select jsonb_agg(to_jsonb(t)-$1::text[]) as value from private.ai_need_turn_commands t", [ADDED_COLUMNS]);
      assert.deepEqual(afterRows, beforeRows);
      for (const signature of NEW_FUNCTIONS) for (const role of ['anon', 'authenticated']) {
        assert.equal(await f.value("select has_function_privilege($1,$2,'EXECUTE') as value", [role, signature]), false);
      }
      assert.equal(await f.value('select jsonb_array_length(private.data_export_dataset_catalog()) as value'), 73);
      await reject(operation.install, /R06_DEV_(?:PREIMAGE_FUNCTION_DRIFT|TABLE_DRIFT|ALREADY_INSTALLED)/);
      await f.db.exec(operation.postflight);
    });
    await t.test('postflight and rollback reject a weakened prepared constraint without changing rows', async () => {
      const definition = await f.value("select pg_get_constraintdef(oid) as value from pg_constraint where conrelid='private.ai_need_turn_commands'::regclass and conname='r06_prepared_input_shape'");
      await f.db.exec('alter table private.ai_need_turn_commands drop constraint r06_prepared_input_shape,add constraint r06_prepared_input_shape check(true)');
      await reject(operation.postflight, /R06_DEV_CONSTRAINT_DRIFT/);
      await reject(operation.rollback, /R06_DEV_CONSTRAINT_DRIFT/);
      assert.equal(await f.value('select to_regprocedure($1) is not null as value', [NEW_FUNCTIONS[0]]), true);
      await f.db.exec('alter table private.ai_need_turn_commands drop constraint r06_prepared_input_shape,add constraint r06_prepared_input_shape ' + definition);
      await f.db.exec(operation.postflight);
    });
    await t.test('old unprepared client dispatch still delegates to the unchanged owner', async () => {
      await f.seed('NEED_SERVICE');
      const result = await f.dispatch('NEED_SERVICE');
      assert.equal(result, true);
      await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
      assert.equal(await f.value('select provider_dispatched as value from private.ai_need_turn_commands'), true);
    });
    await t.test('unused structural rollback restores full export contract and retains old client markers', async () => {
      const row = await f.value('select to_jsonb(t)-$1::text[] as value from private.ai_need_turn_commands t', [ADDED_COLUMNS]);
      await f.db.exec(operation.rollback);
      await f.db.exec(operation.preflight);
      assert.deepEqual(await f.value('select to_jsonb(t) as value from private.ai_need_turn_commands t'), row);
      assert.equal(await f.value('select private.data_export_projection_sha_v5() as value'), projectionBefore);
      for (const signature of NEW_FUNCTIONS) assert.equal(await f.value('select to_regprocedure($1) is null as value', [signature]), true);
    });
    await t.test('used snapshots and reservation tombstones cannot be discarded by structural rollback', async () => {
      await f.db.exec(operation.install);
      await f.seed('NEED_SERVICE');
      await f.prepare('NEED_SERVICE');
      await f.db.exec("update private.ai_need_turn_commands set state='FAILED'");
      const row = await f.value('select to_jsonb(t) as value from private.ai_need_turn_commands t');
      const budget = await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b');
      await reject(operation.rollback, /R06_DEV_ROLLBACK_REQUIRES_UNUSED_PREPARATION/);
      assert.deepEqual(await f.value('select to_jsonb(t) as value from private.ai_need_turn_commands t'), row);
      assert.deepEqual(await f.value('select to_jsonb(b) as value from private.ai_test_budget_v5 b'), budget);
      await f.db.exec(operation.postflight);
    });
  } finally {
    if (native) await runtime.stopFixture(); else await f.db.close();
  }
});

test('R06 package generation refuses fabricated source identities and altered guard bodies', () => {
  const stored = path.join(__dirname, 'sql/r06_prepared_dev_20261110.preimage.json');
  const capture = JSON.parse(fs.readFileSync(stored, 'utf8'));
  const foreign = clone(capture); foreign.projectRef = 'fvyqqudqvizjrxaflhex';
  assert.throws(() => buildPackage(foreign), /Expected values/);
  const drift = clone(capture); drift.functions[0].definition += '\n-- forged extra SQL';
  assert.throws(() => buildPackage(drift), /captured SQL function body/);
});

test('R06 checked-in operation remains bound to the reviewed capture and both source contracts', () => {
  const prefix = path.join(__dirname, 'sql/r06_prepared_dev_20261110');
  const capture = JSON.parse(fs.readFileSync(prefix + '.preimage.json', 'utf8'));
  const generated = buildPackage(capture);
  for (const phase of ['preflight', 'install', 'postflight', 'rollback']) {
    assert.equal(fs.readFileSync(prefix + '.' + phase + '.sql', 'utf8'), generated[phase], phase + ' must be regenerated and reviewed after a source change');
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(prefix + '.manifest.json', 'utf8')), generated.manifest);
});
