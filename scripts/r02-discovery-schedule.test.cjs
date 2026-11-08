'use strict';
// Actual current DEV reader, actual RLS/ACL and client wire decoder, isolated
// PGlite. The inherited account-world/matcher/geography seams are synthetic.
// USKOCI_R02_BEFORE=1 deliberately executes the unchanged reader as a negative
// control for the work bound; it must fail, never qualify as a passing check.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const sql = name => fs.readFileSync(path.join(__dirname, 'sql', name), 'utf8');
const preimage = JSON.parse(sql('r02_discovery_schedule_20261108.preimage.json'));
const source = fs.readFileSync(path.join(__dirname, 'r05-discovery-contract.test.cjs'), 'utf8');
const parsed = ts.createSourceFile('fixture.cjs', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const start = parsed.statements.find(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)
  && n.expression.expression.getText(parsed) === 'test');
assert.ok(start);
const baseline = new Function('require', '__dirname', source.slice(0, start.getStart(parsed))
  + '\nreturn { fixture, filter, page, clean, id, A, B, C, N, D, OTHER, CLOSED };')(require, __dirname);
const { filter, page, clean, id, A, B, C, N, D, OTHER, CLOSED } = baseline;
const forward = () => process.env.USKOCI_R02_BEFORE === '1' ? '' : sql('r02_discovery_schedule_20261108.sql');

test('R02 no-time-filter Discovery avoids a full calendar traversal without changing results', async t => {
  const f = await baseline.fixture(), { db, value, actor, raw, decode, add } = f;
  try {
    await db.exec(preimage.definition);
    const originalMeta = await value("select to_jsonb(p) as value from pg_proc p where oid='public.rpc_discovery_v1(jsonb)'::regprocedure");
    const compare = async (request, who = B) => {
      await db.exec('reset role'); await db.exec(preimage.definition); await actor(who);
      const before = await raw(request);
      await db.exec('reset role'); await db.exec(forward()); await actor(who);
      const after = await raw(before.anchor ? { ...request, anchor: before.anchor } : request);
      assert.deepEqual(clean(after), clean(before)); decode(after);
      return { before, after };
    };
    await t.test('all wire modes, filters, global counts and visibility remain equivalent', async () => {
      for (const change of [{}, { where: 'remote' }, { where: 'onsite' }, { price: 'OFFERS' },
        { price: 'MY_PRICE', minBudgetRsd: 1100 }, { text: 'Lektura' }, { text: 'НИШ' },
        { place: 'Nis' }, { places: 3 }, { forMe: true }, { when: 'today' }, { when: 'tomorrow' },
        { when: 'week' }, { when: 'weekend' }, { when: 'next7' },
        { dates: { from: '2099-01-01', to: '2099-01-02' } }]) {
        await compare(page(change, { limit: 2 }));
        await compare({ mode: 'MAP', filter: filter(change), anchor: null, bounds: [-180, -90, 180, 90], grid: 24 });
        await compare({ mode: 'PLACES', filter: filter(change), anchor: null, prefix: '', facetArea: null, limit: 2, after: null });
      }
      for (const needId of [N, id(2), D, OTHER, CLOSED]) await compare({ mode: 'EXACT_PUBLIC', needId });
      for (const who of [A, B, C]) await compare(page(), who);
    });
    await t.test('guarded forward change and rollback preserve the exact definition and reject drift', async t => {
      if (process.env.USKOCI_R02_BEFORE === '1') { t.skip('Negative control executes the original reader only'); return; }
      await db.exec('reset role'); await db.exec(preimage.definition);
      const original = await value("select pg_get_functiondef('public.rpc_discovery_v1(jsonb)'::regprocedure) as value");
      await db.exec(forward());
      const changed = await value("select pg_get_functiondef('public.rpc_discovery_v1(jsonb)'::regprocedure) as value");
      assert.notEqual(changed, original);
      await assert.rejects(db.exec(forward()), /R02_DISCOVERY_SCHEDULE_PREIMAGE_DRIFT/);
      assert.equal(await value("select pg_get_functiondef('public.rpc_discovery_v1(jsonb)'::regprocedure) as value"), changed);
      await db.exec(sql('r02_discovery_schedule_20261108.rollback.sql'));
      assert.equal(await value("select pg_get_functiondef('public.rpc_discovery_v1(jsonb)'::regprocedure) as value"), original);
      await assert.rejects(db.exec(sql('r02_discovery_schedule_20261108.rollback.sql')), /R02_DISCOVERY_SCHEDULE_ROLLBACK_DRIFT/);
      await db.exec(original.replace('begin', 'begin\n-- unrelated future source change'));
      const future = await value("select pg_get_functiondef('public.rpc_discovery_v1(jsonb)'::regprocedure) as value");
      await assert.rejects(db.exec(forward()), /R02_DISCOVERY_SCHEDULE_PREIMAGE_DRIFT/);
      assert.equal(await value("select pg_get_functiondef('public.rpc_discovery_v1(jsonb)'::regprocedure) as value"), future);
      await db.exec(original);
    });
    await t.test('schedule availability survives no-time-filter and unrelated price/mode filters', async () => {
      await db.exec('reset role;begin');
      try {
      await add(30, { schedule_kind: 'FIXED_WINDOW', execution_location_mode: 'STATIONARY',
        starts_at: '2099-01-01T10:00:00Z', ends_at: '2099-01-01T12:00:00Z' });
      for (const change of [{}, { where: 'remote' }, { price: 'OFFERS' }]) {
        const { after } = await compare(page(change));
        assert.equal(after.availability.hasKnownSchedule, true);
      }
      await db.exec('reset role');
      await db.query("update public.needs set status='DRAFT'");
      const { after } = await compare(page());
      assert.equal(after.availability.hasKnownSchedule, false);
      } finally { await db.exec('reset role;rollback'); }
    });
    await t.test('30000 open tasks return 50 rows and exact counts with bounded calendar work', async () => {
      await db.exec('reset role');
      const columns = JSON.parse(sql('r05_discovery_contract_20261107.preimage.json')).needsState.columns
        .map(c => c.name).filter(n => n !== 'approx_geog');
      const template = await value('select to_jsonb(n) as value from public.needs n where id=$1', [N]);
      await db.query(`insert into public.needs(${columns.join(',')}) select ${columns.map(n => 'x.' + n).join(',')}
        from generate_series(1,30000) g(i) cross join lateral jsonb_populate_record(null::public.needs,$1::jsonb||jsonb_build_object(
        'id',md5('r02-schedule-scale-'||g.i)::uuid,'title','R02 synthetic capacity '||g.i,
        'schedule_kind','FIXED_WINDOW','starts_at','2099-01-01T10:00:00Z','ends_at','2099-01-01T12:00:00Z')) x`, [template]);
      const days = await value("select pg_get_functiondef('public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)'::regprocedure) as value");
      await db.exec(days.replace('public.p6_discovery_days(', 'public.r02_original_discovery_days('));
      await db.exec(`create sequence public.r02_days_calls minvalue 0 start 0;
        grant usage,select on sequence public.r02_days_calls to authenticated;
        create or replace function public.p6_discovery_days(kind text,starts timestamptz,ends timestamptz,zone text,anchor_at timestamptz)
        returns text[] language plpgsql stable set search_path=pg_catalog as $$begin
          perform nextval('public.r02_days_calls');
          return public.r02_original_discovery_days(kind,starts,ends,zone,anchor_at);end$$;`);
      const measure = async (optimized, anchor = null, request = page({}, { limit: 50 })) => {
        await db.exec('reset role'); await db.exec(preimage.definition);
        if (optimized) await db.exec(forward());
        await db.exec('alter sequence public.r02_days_calls restart with 0'); await actor(B);
        const result = await raw({ ...request, anchor }); decode(result);
        const calls = await value('select case when is_called then last_value+1 else 0 end::int as value from public.r02_days_calls');
        return { result, calls };
      };
      const before = await measure(false), after = await measure(true, before.result.anchor);
      assert.deepEqual(clean(after.result), clean(before.result));
      assert.equal(after.result.items.length, 50); assert.equal(after.result.hasMore, true);
      assert.ok(after.result.counts.listed >= 30000);
      assert.ok(before.calls >= 30000);
      // The raw EXISTS may inspect the original fixture's undated rows first,
      // then stops at the first known schedule. It does not visit all 30000.
      assert.ok(after.calls <= 20, `calendar helper calls must be bounded by the first known schedule: ${after.calls}`);
      const datedBefore = await measure(false, null, page({ when: 'today' }));
      const datedAfter = await measure(true, datedBefore.result.anchor, page({ when: 'today' }));
      assert.deepEqual(clean(datedAfter.result), clean(datedBefore.result));
      assert.ok(datedAfter.calls >= 30000, 'a real time filter must still inspect the actual task schedule');
      t.diagnostic(JSON.stringify({ rows: after.result.counts.listed, pageRows: 50,
        unfilteredCalendarCalls: { before: before.calls, after: after.calls },
        timeFilterCalendarCalls: datedAfter.calls, boundary: 'Isolated real SQL, synthetic identities/geography; no hosted or native latency claim.' }));
    });
    await t.test('privileges, errors and ownership are not relaxed', async () => {
      await db.exec('reset role');
      const current = await value("select to_jsonb(p) as value from pg_proc p where oid='public.rpc_discovery_v1(jsonb)'::regprocedure");
      const { prosrc: oldBody, ...oldMeta } = originalMeta, { prosrc: newBody, ...newMeta } = current;
      assert.deepEqual(newMeta, oldMeta);
      await actor(B);
      for (const q of ['select * from public.needs', 'select remaining_search_close_reason from public.needs'])
        await assert.rejects(db.query(q), e => e.code === '42501');
      await db.exec("set fixture.closed='true'"); await assert.rejects(raw(page()), e => e.message === 'ACCOUNT_CLOSING');
      await db.exec("set fixture.closed='false'"); await actor(null, 'anon'); await assert.rejects(raw(page()), e => e.code === '42501');
      await actor(null); await assert.rejects(raw(page()), e => e.message === 'AUTH_REQUIRED');
    });
  } finally { await db.close(); }
});
