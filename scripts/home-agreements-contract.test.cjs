'use strict';
// Execute the new Home data contract on the real captured Agreement/review SQL
// fixture, with real client decoders and transport fences. Default: PostgreSQL
// WASM. The opt-in native runner supplies PostgreSQL 17; neither is DEV/Android.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { randomUUID, createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createReviewFixture } = require('./r08-blind-reviews-fixture.cjs');
const { createHarness, deferred } = require('./ux-component-harness.cjs');
const read = name => fs.readFileSync(path.join(__dirname, 'sql', name), 'utf8');
const candidate = read('home_agreements_summary_20261108.sql');
const rollback = read('home_agreements_summary_20261108.rollback.sql');
const known = value => ({ kind: 'known', value });

function registerHomeAgreementTests(createFixture = createReviewFixture) {
test('Home purpose-specific Agreement summary and bounded prompt pages', async t => {
  const f = await createFixture();
  try {
    await f.db.exec(f.ratingCandidate); await f.db.exec(read('r09_agreement_groups_20261108.sql'));
    const catalog = () => f.rows("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,md5(p.prosrc) as body,p.proacl::text as acl,p.proconfig,p.proowner::regrole::text as owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.proname not in('home_agreement_facts_v1','rpc_home_agreements_summary_v1','rpc_home_agreement_prompts_page_v1') order by 1,2,3");
    const beforeCatalog = await catalog();
    await f.db.exec(candidate);
    const sqlSummary = () => f.value('select public.rpc_home_agreements_summary_v1() as value');
    const sqlPage = (limit = 20, cursor = null) => f.value('select public.rpc_home_agreement_prompts_page_v1($1,$2) as value', [limit, cursor]);
    const session = { user: { id: f.REQUESTER }, accountRevision: 1 }, calls = [];
    let largeHistoryProof;
    const h = createHarness({
      'src/store/sesija.ts': { sesijaSada: () => session },
      'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ auth: { getUser: async () => ({ data: { user: session.user }, error: null }) },
        rpc: (name, args) => {
          const operation = async signal => {
            const call = { name, args, signal }; calls.push(call); assert.equal(signal?.aborted ?? false, false);
            try {
              const data = name === 'rpc_home_agreements_summary_v1' ? await sqlSummary()
                : name === 'rpc_home_agreement_prompts_page_v1' ? await sqlPage(args.p_limit, args.p_cursor)
                  : name === 'rpc_list_my_agreements_page' ? await f.value('select public.rpc_list_my_agreements_page($1,$2,$3,$4) as value', [args.p_scope, args.p_limit, args.p_before_at, args.p_before_id])
                    : assert.fail('Unexpected RPC ' + name);
              call.responseBytes = Buffer.byteLength(JSON.stringify(data)); return { data, error: null };
            } catch (error) { return { data: null, error: { message: error.message, code: error.code } }; }
          };
          return { abortSignal: operation, then: (ok, fail) => operation().then(ok, fail) };
        } }) },
      'src/data/agreementRatingsRead.ts': { ratingReadOwnerCurrent: owner => owner.accountId === session.user?.id && owner.accountRevision === session.accountRevision,
        withAgreementRatings: async () => assert.fail('No per-row review call') },
    });
    const client = h.load('src/data/homeAgreementsClientService.ts').homeAgreementsClientService;
    const contract = h.load('src/data/homeAgreementsContract.ts');
    const legacy = h.load('src/data/agreementClientService.ts').agreementClientService;
    const { composeHome } = h.load('src/data/homeSnapshot.ts');
    const { acceptedTerm, notOver, withoutTermCount, awaitingFinishCount, serbianWeek, inWeek } = h.load('src/ui/home/raspored.ts');
    const proposal = async (a, mine = false) => {
      const id = randomUUID();
      await f.db.query("insert into public.agreement_change_proposals(id,agreement_id,base_version,proposed_terms,content_hash,client_request_id,proposed_by_account_id) values($1,$2,1,$3,$4,$5,$6)",
        [id, a.id, a.terms, 'a'.repeat(64), randomUUID(), mine ? f.REQUESTER : f.WORKER]);
      return id;
    };
    await f.actor(f.REQUESTER);
    await t.test('empty account returns one strict bounded summary, not history', async () => {
      calls.length = 0; const s = await client.summary();
      assert.deepEqual(s.counts, { hasAny: false, active: 0, upcoming: 0, withoutExactTerm: 0, awaitingFinish: 0, remainingThisWeek: 0 });
      assert.equal(s.next, null); assert.deepEqual(s.prompts.items, []); assert.equal(s.ratings.due, 0);
      assert.deepEqual(calls.map(c => c.name), ['rpc_home_agreements_summary_v1']);
    });
    const history = await f.completed(337);
    await t.test('history-only hasAny survives an empty active scope', async () => {
      const s = await client.summary(), all = await legacy.mojiDogovori();
      assert.equal(s.counts.hasAny, true); assert.equal(s.counts.active, 0); assert.equal(s.ratings.due, 0);
      const base = { needs: known([]), applications: known([]) };
      assert.equal(composeHome({ ...base, agreements: known(all) }).firstRun, false);
      assert.equal(composeHome({ ...base, agreements: known([]) }).firstRun, true, 'Existing first-ACTIVE substitution is demonstrably wrong');
      assert.equal(composeHome({ ...base, agreements: known(s) }, known({ rows: [], more: 0, asOf: s.asOf })).firstRun, false);
    });
    const due = await f.completed();
    await t.test('review eligibility is exact and independent of the attention RPC', async () => {
      calls.length = 0; const s = await client.summary();
      assert.deepEqual(s.ratings, { due: 1, agreementId: due.id });
      assert.equal(calls.some(c => /attention|review/.test(c.name)), false);
      assert.equal((await f.own(due)).eligible, true);
      const home = composeHome({ needs: known([]), applications: known([]), agreements: known(s) }, { kind: 'unavailable' });
      assert.equal(home.ratingsDue, 1); assert.equal(home.ratingDueAgreementId, due.id);
    });
    const changes = [];
    for (let i = 0; i < 21; i++) { const a = await f.agreement(); await proposal(a); changes.push(a); }
    const now = Date.parse(await f.value('select statement_timestamp()::text as value'));
    const near = await f.agreement({ start: new Date(now + 600000).toISOString(), end: new Date(now + 660000).toISOString() });
    await t.test('nearest accepted appointment survives 21 higher-attention groups', async () => {
      const view = { section: 'active', role: 'all', outcome: 'all', confirmationOnly: false, query: '' };
      const page = await f.value('select public.rpc_list_my_agreement_groups_page($1,20,null) as value', [view]);
      assert.equal(page.groups.some(g => g.items.some(a => a.id === near.id)), false);
      const s = await client.summary(); assert.equal(s.next.id, near.id); assert.equal(s.counts.active, 22);
      assert.equal(s.prompts.total, 21); assert.equal(s.prompts.items.length, 4);
      const home = composeHome({ needs: known([]), applications: known([]), agreements: known(s) }, known({ rows: [], more: 0, asOf: s.asOf }));
      assert.equal(home.agreements.value.rows[0].target.agreementId, near.id); assert.equal(home.agreements.value.more, 21);
      assert.equal(home.agreementPrompts.total, 21); assert.equal(home.promptsMore, 17);
      await f.db.query("update public.needs set starts_at='2035-01-01T00:00:00Z' where id=$1", [near.need]);
      assert.equal((await client.summary()).next.startAt, s.next.startAt, 'Parent task time cannot replace accepted terms');
    });
    const loose = [];
    for (let i = 0; i < 5; i++) loose.push(await f.agreement({ noInterval: true }));
    await proposal(loose[0], true);
    const underway = await f.agreement({ start: new Date(now - 600000).toISOString(), end: new Date(now + 300000).toISOString() });
    const overdue = await f.agreement({ start: new Date(now - 3600000).toISOString(), end: new Date(now - 1800000).toISOString() });
    const startOnly = await f.agreement({ noInterval: true, terms: { declared_start_at: new Date(now + 360000).toISOString() } });
    await t.test('global counts match the existing full-history composer semantics', async () => {
      const s = await client.summary(), all = await legacy.mojiDogovori();
      const at = BigInt(Date.parse(s.asOf)) * 1000n;
      const active = all.filter(a => ['CONFIRMED', 'AWAITING_REQUESTER'].includes(a.stanje));
      const upcoming = active.filter(a => a.stanje === 'CONFIRMED' && acceptedTerm(a) && notOver(acceptedTerm(a), at));
      const week = serbianWeek(new Date(s.asOf));
      assert.equal(s.counts.active, active.length); assert.equal(s.counts.upcoming, upcoming.length);
      assert.equal(s.counts.withoutExactTerm, withoutTermCount(all)); assert.equal(s.counts.awaitingFinish, awaitingFinishCount(all, at));
      assert.equal(s.counts.remainingThisWeek, upcoming.filter(a => a.id !== s.next.id && acceptedTerm(a).endAt !== null && inWeek(acceptedTerm(a), week)).length);
      assert.equal(s.next.id, underway.id); assert.equal(s.prompts.total, 25); assert.equal(s.prompts.terms, 4);
      assert.equal(s.prompts.changes, 21); assert.equal(s.counts.awaitingFinish, 1);
      assert.ok(upcoming.some(a => a.id === startOnly.id)); assert.ok(!s.prompts.items.some(a => a.id === loose[0].id));
      const base = { needs: known([]), applications: known([]) }, attention = known({ rows: [], more: 0, asOf: s.asOf });
      const before = composeHome({ ...base, agreements: known(all) }, attention, Date.parse(s.asOf), 'Europe/Belgrade');
      const after = composeHome({ ...base, agreements: known(s) }, attention, Date.parse(s.asOf), 'Europe/Belgrade');
      assert.deepEqual(after.agreements.value.rows[0].target, before.agreements.value.rows[0].target);
      assert.deepEqual(after.agreements.value.rows[0].raspored, before.agreements.value.rows[0].raspored);
      assert.equal(after.agreements.value.more, before.agreements.value.more);
      assert.equal(after.promptsMore, before.promptsMore); assert.equal(after.firstRun, before.firstRun);
    });
    let firstPage;
    await t.test('explicit 20-row pages cover every prompt exactly once and never auto-walk', async () => {
      calls.length = 0; firstPage = await client.promptsPage({ limit: 20, cursor: null });
      assert.equal(calls.length, 1); assert.equal(firstPage.items.length, 20); assert.equal(firstPage.hasMore, true);
      const second = await client.promptsPage({ limit: 20, cursor: firstPage.nextCursor });
      assert.equal(calls.length, 2); assert.equal(second.items.length, 5); assert.equal(second.hasMore, false);
      assert.equal(second.viewAt, firstPage.viewAt);
      assert.equal(new Set([...firstPage.items, ...second.items].map(row => row.id)).size, 25);
      assert.equal(firstPage.counts.remaining, 25); assert.equal(second.counts.remaining, 5);
    });
    await t.test('microsecond ties preserve exact immutable creation/id order', async () => {
      await f.db.query("update public.agreements set created_at='2026-11-01T10:00:00.123456Z' where id=any($1::uuid[])", [loose.map(a => a.id)]);
      const seen = []; let cursor = null;
      do { const page = await client.promptsPage({ limit: 3, cursor }); seen.push(...page.items); cursor = page.nextCursor; } while (cursor);
      assert.equal(seen.length, 25); assert.equal(new Set(seen.map(a => a.id)).size, 25);
      assert.ok(seen.filter(a => loose.some(x => x.id === a.id)).every(a => h.load('src/lib/calendarTime.ts').calendarInstant(a.createdAt) % 1000000n === 123456n));
    });
    await t.test('changed reason cannot move an already-read prompt behind the cursor', async () => {
      const first = await client.promptsPage({ limit: 20, cursor: null });
      const changed = first.items.find(a => a.reason === 'CHANGE'); assert.ok(changed);
      await f.db.query("update public.agreement_versions set terms=terms-'proposed_start_at'-'proposed_end_at' where agreement_id=$1", [changed.id]);
      await f.db.query("update public.agreement_change_proposals set status='WITHDRAWN' where agreement_id=$1", [changed.id]);
      const next = await client.promptsPage({ limit: 20, cursor: first.nextCursor });
      assert.equal(next.items.some(a => a.id === changed.id), false);
      assert.equal((await client.promptsPage({ limit: 20, cursor: null })).items.find(a => a.id === changed.id).reason, 'TERM');
    });
    await t.test('closure and new creation during traversal use live eligibility and explicit refresh', async () => {
      const first = await client.promptsPage({ limit: 20, cursor: null });
      const remaining = await client.promptsPage({ limit: 20, cursor: first.nextCursor });
      const removed = remaining.items[0]; await f.cancel(removed.id);
      const added = await f.agreement({ noInterval: true });
      const next = await client.promptsPage({ limit: 20, cursor: first.nextCursor });
      assert.equal(next.items.some(a => a.id === removed.id || a.id === added.id), false);
      const refreshed = await client.promptsPage({ limit: 20, cursor: null });
      assert.equal(refreshed.items[0].id, added.id);
    });
    await t.test('other participant has their role and only prompts that require them', async () => {
      session.user = { id: f.WORKER }; session.accountRevision++; await f.actor(f.WORKER);
      const s = await client.summary(); assert.equal(s.next.role, 'uskocer'); assert.equal(s.next.counterpartProfileId, f.REQUESTER_PROFILE);
      assert.equal(s.prompts.changes, 1, 'Only requester self-proposal asks the worker');
      session.user = { id: f.REQUESTER }; session.accountRevision++; await f.actor(f.REQUESTER);
    });
    await t.test('foreign/anonymous/closing identities and foreign cursors are denied or empty', async () => {
      await f.actor(f.FOREIGN); assert.equal((await sqlSummary()).counts.hasAny, false);
      assert.deepEqual((await sqlPage()).items, []);
      await f.fails(() => sqlPage(20, firstPage.nextCursor), 'HOME_PROMPTS_INVALID_PAGE');
      await f.actor(null); await f.fails(sqlSummary, 'AUTH_REQUIRED'); await f.fails(sqlPage, 'AUTH_REQUIRED');
      await f.actor(f.REQUESTER); await f.close(f.REQUESTER);
      try { await f.fails(sqlSummary, 'ACCOUNT_CLOSING'); await f.fails(sqlPage, 'ACCOUNT_CLOSING'); } finally { await f.reopen(); }
    });
    await t.test('invalid/null cursor fields, limits, future/expired traversal cannot be silently accepted', async () => {
      const valid = (await client.promptsPage({ limit: 1, cursor: null })).nextCursor;
      for (const limit of [0, 31, -1, null]) await f.fails(() => sqlPage(limit), 'HOME_PROMPTS_INVALID_PAGE');
      for (const key of ['schemaVersion', 'accountId', 'viewAt', 'at', 'id']) await f.fails(() => sqlPage(1, { ...valid, [key]: null }), 'HOME_PROMPTS_INVALID_PAGE');
      for (const bad of [{ ...valid, extra: true }, { ...valid, viewAt: '9999-01-01T00:00:00Z' }, { ...valid, at: '9999-01-01T00:00:00Z' }])
        await f.fails(() => sqlPage(1, bad), 'HOME_PROMPTS_INVALID_PAGE');
      const old = new Date(Date.now() - 31 * 60000).toISOString();
      await f.fails(() => sqlPage(1, { ...valid, viewAt: old, at: old }), 'HOME_PROMPTS_EXPIRED');
    });
    await t.test('strict decoders reject corrupted counts, private extra fields and reused continuations', async () => {
      const raw = await sqlSummary(); assert.ok(contract.decodeHomeAgreementsSummary(raw, f.REQUESTER));
      const rejectSummary = change => { const copy = structuredClone(raw); change(copy); assert.equal(contract.decodeHomeAgreementsSummary(copy, f.REQUESTER), null); };
      for (const change of [r => r.accountId = f.FOREIGN, r => r.counts.active = -1, r => r.counts.hasAny = false,
        r => r.counts.upcoming = r.counts.active + 1, r => r.next = null, r => r.next.endAt = r.next.startAt,
        r => r.next.phone = 'never public', r => r.prompts.items.push(r.prompts.items[0]), r => r.prompts.total++,
        r => r.ratings.agreementId = null, r => r.privateAddress = 'not requested']) rejectSummary(change);
      const page = await sqlPage(2), request = { limit: 2, cursor: null };
      assert.ok(contract.decodeHomeAgreementPromptPage(page, request, f.REQUESTER));
      for (const change of [r => r.items.reverse(), r => r.nextCursor.id = randomUUID(), r => r.counts.remaining++,
        r => r.hasMore = false, r => r.items[0].changeId = r.items[0].reason === 'CHANGE' ? null : randomUUID(),
        r => r.items[0].phone = 'never public', r => r.accountId = f.FOREIGN]) {
        const copy = structuredClone(page); change(copy); assert.equal(contract.decodeHomeAgreementPromptPage(copy, request, f.REQUESTER), null);
      }
      assert.equal(contract.decodeHomeAgreementPromptPage(page, { limit: 2, cursor: page.nextCursor }, f.REQUESTER), null);
    });
    await t.test('new reader exposes no private address, telephone, terms or unrelated identity', async () => {
      const s = await sqlSummary(), p = await sqlPage();
      for (const value of [s.next, ...s.prompts.items, ...p.items]) for (const key of ['phone', 'theirPhone', 'address', 'exactLocation', 'terms', 'requesterAccountId', 'workerAccountId'])
        assert.equal(Object.hasOwn(value, key), false);
      assert.equal(Buffer.byteLength(JSON.stringify(s)) < 6000, true);
    });
    await t.test('redacted DEV readback compares the actual readers under authenticated with no mutation', async () => {
      const source = read('home_agreements_summary_20261108.readback.sql');
      try {
        await f.db.exec(source.replace(/ROLLBACK;\s*$/, ''));
        const proof = await f.value("select current_setting('uskoci.home.readback')::jsonb as value");
        assert.ok(proof.accounts.length >= 3);
        for (const item of proof.accounts) {
          assert.equal(item.status, 'CHECKED', JSON.stringify(item)); assert.equal(item.role, 'authenticated');
          for (const key of ['accountBinding','summaryCountsMatch','nextMatches','ratingsMatch','allPromptIdsMatch','promptCountMatches','privatePromptFieldsAbsent'])
            assert.equal(item[key], true, key + ': ' + JSON.stringify(item));
        }
        const serialized = JSON.stringify(proof);
        for (const id of [f.REQUESTER, f.WORKER, f.FOREIGN, near.id]) assert.equal(serialized.includes(id), false);
      } finally { await f.db.exec('ROLLBACK'); }
    });
    await t.test('2101 historical Agreements break the old full walk while the summary remains one bounded read', async () => {
      const cancelled = await f.agreement({ noInterval: true }); await f.cancel(cancelled);
      const before = await client.summary();
      await f.db.exec("create temporary table home_history_ids as select i,md5('home-a-'||i)::uuid as a,md5('home-r-'||i)::uuid as r,md5('home-s-'||i)::uuid as s from generate_series(1,2101)i");
      const schema = JSON.parse(read('r08_agreement_cancellation_20261107.fixture-schema.json'));
      for (const [table, where, value, patch] of [
        ['public.marketplace_responses', 'id', cancelled.response, "jsonb_build_object('id',g.r)"],
        ['public.need_selections', 'id', cancelled.selection, "jsonb_build_object('id',g.s,'response_id',g.r,'client_request_id',g.s)"],
        ['public.agreements', 'id', cancelled.id, "jsonb_build_object('id',g.a,'selected_response_id',g.r,'selection_id',g.s)"],
        ['public.agreement_versions', 'agreement_id', cancelled.id, "jsonb_build_object('agreement_id',g.a)"],
        ['public.agreement_execution', 'agreement_id', cancelled.id, "jsonb_build_object('agreement_id',g.a)"],
      ]) {
        const template = await f.value(`select to_jsonb(t) as value from ${table} t where ${where}=$1 limit 1`, [value]);
        const columns = schema.tables.find(t => t.name === table).columns.filter(c => !c.generated).map(c => c.name);
        await f.db.query(`insert into ${table}(${columns.join(',')}) select ${columns.map(c => 'x.' + c).join(',')} from home_history_ids g
          cross join lateral jsonb_populate_record(null::${table},$1::jsonb||${patch}) x`, [template]);
      }
      calls.length = 0; let start = process.hrtime.bigint();
      await assert.rejects(legacy.mojiDogovori(), /AGREEMENT_LIST_TOO_MANY_PAGES/);
      const old = { result: 'AGREEMENT_LIST_TOO_MANY_PAGES', rpcCalls: calls.length,
        responseBytes: calls.reduce((sum, c) => sum + c.responseBytes, 0), elapsedMs: Number(process.hrtime.bigint() - start) / 1e6 };
      calls.length = 0; start = process.hrtime.bigint(); const after = await client.summary();
      const current = { result: 'VALIDATED_COMPLETE_SUMMARY', rpcCalls: calls.length,
        responseBytes: calls.reduce((sum, c) => sum + c.responseBytes, 0), elapsedMs: Number(process.hrtime.bigint() - start) / 1e6 };
      assert.equal(calls.length, 1); assert.deepEqual(after.counts, before.counts); assert.deepEqual(after.next, before.next);
      assert.deepEqual(after.ratings, before.ratings); assert.deepEqual(after.prompts, before.prompts);
      assert.ok(Buffer.byteLength(JSON.stringify(after)) < 6000);
      const samples = [], promptSamples = [];
      for (let sample = 0; sample < 25; sample++) {
        start = process.hrtime.bigint(); await sqlSummary(); samples.push(Number(process.hrtime.bigint() - start) / 1e6);
        start = process.hrtime.bigint(); await sqlPage(); promptSamples.push(Number(process.hrtime.bigint() - start) / 1e6);
      }
      const measured = values => {
        const sorted = [...values].sort((a,b) => a-b), percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
        return { samples: values.length, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), minMs: sorted[0], maxMs: sorted.at(-1) };
      };
      const prompt = await sqlPage();
      largeHistoryProof = { historicalClones: 2101, totalAgreements: await f.value('select count(*)::int as value from public.agreements'),
        old, current, counts: after.counts, promptCount: after.prompts.total,
        boundedPromptPage: { total: prompt.counts.total, rows: prompt.items.length, responseBytes: Buffer.byteLength(JSON.stringify(prompt)), maxRows: 20 },
        warmSqlRoundTrip: { summary: measured(samples), promptPage: measured(promptSamples) },
        boundary: `${f.homeProofRuntime ?? 'Local PostgreSQL WASM'} fixture, actual old/new SQL and clients. Old/new client comparison is a single observation; 25 warm SQL round trips per bounded reader are isolated, not hosted/Android latency or concurrent capacity.` };
    });
    await t.test('only proposed authenticated public entries execute; helper and existing ACL remain private', async () => {
      for (const signature of ['public.rpc_home_agreements_summary_v1()', 'public.rpc_home_agreement_prompts_page_v1(integer,jsonb)']) {
        assert.equal(await f.value(`select has_function_privilege('anon','${signature}','execute') as value`), false);
        assert.equal(await f.value(`select has_function_privilege('authenticated','${signature}','execute') as value`), true);
        assert.equal(await f.value(`select has_function_privilege('service_role','${signature}','execute') as value`), false);
      }
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await f.value(`select has_function_privilege('${role}','private.home_agreement_facts_v1()','execute') as value`), false);
      await f.db.exec('set role authenticated'); try { assert.ok((await sqlSummary()).counts.active > 0); assert.ok((await sqlPage()).items.length > 0); } finally { await f.db.exec('reset role'); }
      await f.db.exec('set role anon'); try { await f.fails(sqlSummary, 'permission denied'); await f.fails(sqlPage, 'permission denied'); } finally { await f.db.exec('reset role'); }
      assert.deepEqual(await catalog(), beforeCatalog);
    });
    await t.test('guarded apply and rollback refuse drift and restore exactly the previous function catalog', async () => {
      await f.fails(() => f.db.exec(candidate), 'HOME_AGREEMENTS_ALREADY_EXISTS'); await f.db.exec('rollback');
      await f.db.exec('alter function private.home_agreement_facts_v1() set search_path=public');
      await f.fails(() => f.db.exec(rollback), 'HOME_AGREEMENTS_ROLLBACK_MISMATCH'); await f.db.exec('rollback');
      await f.db.exec('alter function private.home_agreement_facts_v1() set search_path=pg_catalog');
      await f.db.exec(rollback);
      assert.equal(await f.value("select to_regprocedure('public.rpc_home_agreements_summary_v1()') is null and to_regprocedure('public.rpc_home_agreement_prompts_page_v1(integer,jsonb)') is null and to_regprocedure('private.home_agreement_facts_v1()') is null as value"), true);
      assert.deepEqual(await catalog(), beforeCatalog);
      const original = await f.value("select pg_get_functiondef('public.rpc_home_attention()'::regprocedure) as value");
      await f.db.exec("create or replace function public.rpc_home_attention() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$begin return '{}'::jsonb;end$$");
      await f.fails(() => f.db.exec(candidate), 'HOME_AGREEMENTS_PREIMAGE_MISMATCH'); await f.db.exec('rollback');
      await f.db.exec(original);
      await f.db.exec('grant execute on function public.rpc_home_attention() to anon');
      await f.fails(() => f.db.exec(candidate), 'HOME_AGREEMENTS_AUTHORITY_MISMATCH'); await f.db.exec('rollback');
      await f.db.exec('revoke execute on function public.rpc_home_attention() from anon');
      assert.deepEqual(await catalog(), beforeCatalog); await f.db.exec(candidate);
    });
    if (process.env.USKOCI_HOME_DATA_RECEIPT) {
      const additions = await f.rows("select p.oid::regprocedure::text as signature,md5(p.prosrc) as bodyMd5,p.prosecdef as definer,p.provolatile::text as volatility,p.proconfig as config,p.proacl::text as acl,pg_get_userbyid(p.proowner) as owner from pg_proc p where p.oid in('private.home_agreement_facts_v1()'::regprocedure,'public.rpc_home_agreements_summary_v1()'::regprocedure,'public.rpc_home_agreement_prompts_page_v1(integer,jsonb)'::regprocedure) order by signature");
      const root = path.resolve(__dirname, '..'), sourceFiles = {};
      for (const name of ['scripts/home-agreements-contract.test.cjs', 'scripts/home-agreements-native.cjs', 'scripts/sql/home_agreements_summary_20261108.sql',
        'scripts/sql/home_agreements_summary_20261108.rollback.sql', 'scripts/sql/home_agreements_summary_20261108.readback.sql',
        'src/data/homeAgreementsContract.ts', 'src/data/homeAgreementsClientService.ts'])
        sourceFiles[name] = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
      fs.writeFileSync(process.env.USKOCI_HOME_DATA_RECEIPT, JSON.stringify({ observedAt: new Date().toISOString(),
        sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceFiles,
        runtime: f.homeProofRuntime ?? 'Local PostgreSQL WASM', postgresVersion: await f.value('select version() as value'),
        newObjects: additions, largeHistoryProof, existingFunctionCatalogUnchanged: true,
        liveMutations: 0, clientRouted: true, routeProofSuite: 'scripts/home-summary-integration.test.cjs',
        limitation: 'Isolated actual SQL with existing review/cancellation fixture seams. Proposed ACL has not been granted on DEV by this suite; ordinary hosted Auth and Android are not exercised for this new contract.' }, null, 2) + '\n');
    }
  } finally { await f.db.close(); }
});
test('Home service rejects late account/visit reads and does not replay a failed request', async t => {
  const A = '22222222-2222-4222-8222-222222222222', B = '33333333-3333-4333-8333-333333333333';
  const session = { user: { id: A }, accountRevision: 1 }, calls = [];
  let next = deferred();
  const h = createHarness({
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ rpc: (name, args) => ({ abortSignal: signal => {
      calls.push({ name, args, signal }); return next.promise;
    } }) }) },
  });
  const client = h.load('src/data/homeAgreementsClientService.ts').homeAgreementsClientService;
  await t.test('account A-B-A revision change rejects the original answer', async () => {
    const work = client.summary(); session.user = { id: B }; session.accountRevision++;
    session.user = { id: A }; session.accountRevision++; next.resolve({ data: {}, error: null });
    await assert.rejects(work, /AUTH_ACCOUNT_CHANGED/); assert.equal(calls.length, 1);
  });
  await t.test('abort releases a non-cooperative transport and forwards the abort signal', async () => {
    next = deferred(); const controller = new AbortController(), work = client.summary({ signal: controller.signal });
    controller.abort(); await assert.rejects(work, /HOME_AGREEMENTS_UNAVAILABLE/);
    assert.equal(calls.at(-1).signal.aborted, true); assert.equal(calls.length, 2); next.resolve({ data: {}, error: null });
  });
  await t.test('malformed or foreign cursor fails locally with no RPC', async () => {
    const count = calls.length;
    await assert.rejects(client.promptsPage({ limit: 31, cursor: null }), /HOME_PROMPTS_INVALID_PAGE/);
    await assert.rejects(client.promptsPage({ limit: 20, cursor: { schemaVersion: 1, accountId: B, viewAt: '2026-11-08T12:00:00Z', at: '2026-11-08T11:00:00Z', id: A } }), /HOME_PROMPTS_INVALID_PAGE/);
    assert.equal(calls.length, count);
  });
});
}

module.exports = { registerHomeAgreementTests };
if (require.main === module) registerHomeAgreementTests();
