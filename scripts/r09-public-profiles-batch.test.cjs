'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { ROOT, preimage, candidate, id, ACTOR, OTHER, deferred, wait, sqlFixture, clientHarness, items, projection, envelope }
  = require('./r09-public-profiles-batch-fixture.cjs');
const rollback = fs.readFileSync(path.join(__dirname, 'sql/r09_public_profiles_batch_20261108.rollback.sql'), 'utf8');
assert.equal(fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261108012344_r09_public_profiles_batch_20261108.sql'), 'utf8'), candidate,
  'The SQL executed by these tests must be exactly the migration shipped to DEV.');
const ids = Array.from({ length: 100 }, (_, i) => id(i + 1));
const signature = 'public.rpc_get_public_profiles_batch(uuid,uuid[])';
const ok = data => ({ data, error: null });
const mockRpc = call => ok(call.name === 'rpc_get_public_profile' ? projection(call.args.p_profile_id) : envelope(call.args.p_profile_ids));

test('actual SQL delegates all visibility, requester/worker and account reputation semantics to the captured reader', async t => {
  const f = await sqlFixture();
  try {
    await f.db.exec(`update public.app_profiles set kind='WORKER' where id='${id(2)}';
      update public.app_profiles set account_id='${id(10001)}' where id='${id(2)}';
      update public.app_profiles set profile_status='INACTIVE' where id='${id(3)}';
      update private.fixture_accounts set closed=true where id='${id(10004)}';
      insert into private.fixture_blocks(actor,target) values('${ACTOR}','${id(10005)}');
      update private.fixture_accounts set world='other' where id='${id(10006)}';`);
    await f.asRole('authenticated');
    await t.test('wrapper has invoker rights; direct profile access stays behind RLS', async () => {
      const meta = await f.metadata(signature);
      assert.equal(meta.definer, false); assert.deepEqual(meta.config, ['search_path=pg_catalog']);
      assert.equal(meta.acl, '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}');
      assert.equal(await f.value('select count(*)::integer as value from public.app_profiles'), 0);
      await assert.rejects(f.value('select count(*) as value from private.fixture_accounts'), /permission denied/);
    });
    await t.test('batch is projection-equivalent to individual reads, including denied and absent ids', async () => {
      const asked = [id(2), id(1), id(3), id(4), id(5), id(6), id(999)];
      const result = await f.batch(asked);
      assert.equal(result.accountId, ACTOR); assert.equal(result.authoritative, true);
      assert.deepEqual(result.profiles.map(entry => entry.profileId), asked);
      for (const entry of result.profiles) assert.deepEqual(entry.profile, await f.one(entry.profileId));
      assert.deepEqual(result.profiles.slice(2).map(entry => entry.profile), [null, null, null, null, null]);
      const worker = result.profiles[0].profile, requester = result.profiles[1].profile;
      assert.equal(worker.role, 'WORKER'); assert.equal(requester.role, 'REQUESTER');
      assert.deepEqual(requester.publicSummary, { headline: null, bio: null });
      assert.equal(worker.publicSummary.headline, 'Private requester headline');
      assert.deepEqual(worker.trust, requester.trust);
      assert.equal(requester.trust.completedCount, 3);
      assert.equal(JSON.stringify(result).includes('private_phone'), false);
      assert.equal(JSON.stringify(result).includes('secret'), false);
    });
    await t.test('empty and maximum batches work; invalid shape, duplicates and foreign owner are refused', async () => {
      assert.deepEqual((await f.batch([])).profiles, []);
      assert.equal((await f.batch(ids)).profiles.length, 100);
      for (const input of [null, [null], [id(1), id(1)], [...ids, id(101)]])
        await assert.rejects(f.batch(input), /PUBLIC_PROFILE_BATCH_INPUT_INVALID/);
      await assert.rejects(f.batch([id(1)], OTHER), /AUTH_CONTEXT_CHANGED/);
      await assert.rejects(f.batch([id(1)], null), /AUTH_CONTEXT_CHANGED/);
      await assert.rejects(f.value(`select public.rpc_get_public_profiles_batch($1,ARRAY[[$2::uuid],[$3::uuid]]) as value`, [ACTOR, id(1), id(2)]),
        /PUBLIC_PROFILE_BATCH_INPUT_INVALID/);
    });
    await t.test('anon cannot execute; service role without a real actor cannot bypass admission', async () => {
      await f.asRole('anon'); await assert.rejects(f.batch([id(1)]), /permission denied/);
      await f.asRole('service_role', null); await assert.rejects(f.batch([id(1)]), /AUTH_REQUIRED/);
      await f.asRole('authenticated', null); await assert.rejects(f.batch([id(1)]), /AUTH_REQUIRED/);
    });
    await t.test('a closed caller gets explicit null answers through unchanged delegated rules', async () => {
      await f.asRole('postgres'); await f.db.query('update private.fixture_accounts set closed=true where id=$1', [ACTOR]);
      await f.asRole('authenticated'); assert.deepEqual((await f.batch([id(1), id(2)])).profiles.map(entry => entry.profile), [null, null]);
    });
  } finally { await f.db.close(); }
});

test('100 authors execute through actual SQL → client → overlay in one RPC, with the legacy four-worker path as control', async () => {
  const f = await sqlFixture();
  try {
    await f.asRole('authenticated');
    let active = 0, peak = 0;
    const h = clientHarness(async call => {
      active++; peak = Math.max(peak, active);
      try {
        await wait(1);
        assert.ok(['rpc_get_public_profile', 'rpc_get_public_profiles_batch'].includes(call.name));
        const value = call.name === 'rpc_get_public_profile' ? await f.one(call.args.p_profile_id)
          : await f.batch(call.args.p_profile_ids, call.args.p_expected_user_id);
        return ok(value);
      } finally { active--; }
    });
    const legacy = h.owner(true); await legacy.load(items(ids));
    assert.equal(h.calls.length, 100); assert.equal(peak, 4);
    const before = legacy.snapshot(); assert.equal(before.profiles.size, 100); legacy.retire();
    h.calls.length = 0; peak = 0;
    const owner = h.owner(); await owner.load(items(ids));
    assert.equal(h.calls.length, 1); assert.equal(peak, 1);
    assert.equal(h.calls[0].name, 'rpc_get_public_profiles_batch');
    assert.deepEqual([...owner.snapshot().profiles], [...before.profiles]);
    assert.equal(owner.snapshot().errors.profiles, false);
    assert.equal((await f.metadata('public.rpc_get_public_profile(uuid)')).body_md5, preimage.body_md5);
    owner.retire();
  } finally { await f.db.close(); }
});

test('SQL guards refuse preimage/postimage drift and rollback removes only the new wrapper', async t => {
  const f = await sqlFixture({ apply: false });
  try {
    const oldMeta = await f.metadata('public.rpc_get_public_profile(uuid)');
    await t.test('changed reader ACL or body cannot admit the wrapper', async () => {
      await f.db.exec('grant execute on function public.rpc_get_public_profile(uuid) to anon;');
      await assert.rejects(f.db.exec(candidate), /PUBLIC_PROFILE_READER_PREIMAGE_CHANGED/);
      assert.equal(await f.value('select to_regprocedure($1)::text as value', [signature]), null);
      await f.db.exec('revoke execute on function public.rpc_get_public_profile(uuid) from anon;');
      await f.db.exec(preimage.definition.replace('v_completed bigint := 0;', 'v_completed bigint := 1;'));
      await assert.rejects(f.db.exec(candidate), /PUBLIC_PROFILE_READER_PREIMAGE_CHANGED/);
      await f.db.exec(preimage.definition); await f.db.exec(candidate);
      await assert.rejects(f.db.exec(candidate), /PUBLIC_PROFILES_BATCH_ALREADY_EXISTS/);
    });
    await t.test('rollback refuses changed rights, then restores exact prior reader/data state', async () => {
      const count = await f.value('select count(*)::integer as value from public.app_profiles');
      await f.db.exec(`grant execute on function ${signature} to anon`);
      await assert.rejects(f.db.exec(rollback), /PUBLIC_PROFILES_BATCH_POSTIMAGE_CHANGED/);
      assert.ok(await f.value('select to_regprocedure($1)::text as value', [signature]));
      await f.db.exec(`revoke execute on function ${signature} from anon`);
      await f.db.exec(rollback);
      assert.equal(await f.value('select to_regprocedure($1)::text as value', [signature]), null);
      assert.deepEqual(await f.metadata('public.rpc_get_public_profile(uuid)'), oldMeta);
      assert.equal(await f.value('select count(*)::integer as value from public.app_profiles'), count);
    });
  } finally { await f.db.close(); }
});

test('empty inputs issue no profile RPC; repeated authors are requested once and only unknown profiles are reused', async () => {
  const h = clientHarness(mockRpc);
  assert.equal((await h.client.javniProfili([])).size, 0); assert.equal(h.calls.length, 0);
  const result = await h.client.javniProfili([id(1), id(1), id(2)]);
  assert.equal(h.calls.length, 1); assert.deepEqual(h.calls[0].args.p_profile_ids, [id(1), id(2)]); assert.equal(result.size, 2);
  h.calls.length = 0; const owner = h.owner();
  await owner.load(items([])); assert.equal(h.calls.length, 0);
  await owner.load(items([id(1), id(1), id(2)])); assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].args.p_profile_ids, [id(1), id(2)]);
  await owner.load(items([id(1), id(2), id(3)]), { reuseProfiles: true });
  assert.equal(h.calls.length, 2); assert.deepEqual(h.calls[1].args.p_profile_ids, [id(3)]);
  await owner.load(items([id(2), id(3)]), { reuseProfiles: true }); assert.equal(h.calls.length, 2);
  assert.deepEqual([...owner.snapshot().profiles.keys()], [id(2), id(3)]); owner.retire();
});

test('explicit absent/denied and changed requester-role answers remove a previously visible profile', async t => {
  for (const next of ['null', 'worker']) await t.test(next, async () => {
    const h = clientHarness(mockRpc), owner = h.owner(); await owner.load(items([id(1)]));
    assert.equal(owner.snapshot().profiles.size, 1);
    h.state.override = call => {
      const data = envelope(call.args.p_profile_ids);
      if (next === 'null') data.profiles[0].profile = null;
      else data.profiles[0].profile.role = 'WORKER';
      return ok(data);
    };
    await owner.load(items([id(1)]));
    assert.equal(owner.snapshot().profiles.size, 0); assert.equal(owner.snapshot().missingProfiles.has(id(1)), true);
    assert.equal(owner.snapshot().errors.profiles, next === 'worker'); owner.retire();
  });
});

test('malformed or foreign receipts never inject a new profile, while a failed read retains its marked-stale known projection', async t => {
  const corruptions = {
    account: data => { data.accountId = OTHER; },
    outerId: data => { data.profiles[0].profileId = id(999); },
    innerId: data => { data.profiles[0].profile.profileId = id(999); },
    duplicate: data => { data.profiles[1] = structuredClone(data.profiles[0]); },
    missing: data => { data.profiles.pop(); },
    extra: data => { data.profiles.push({ profileId: id(999), profile: projection(id(999)) }); },
    authority: data => { data.authoritative = false; },
    rating: data => { data.profiles[0].profile.trust.ratingAverage = 10; },
  };
  for (const [name, corrupt] of Object.entries(corruptions)) await t.test(name, async () => {
    const h = clientHarness(mockRpc), owner = h.owner(); await owner.load(items([id(1)])); const prior = owner.snapshot().profiles.get(id(1));
    h.state.override = call => { const data = envelope(call.args.p_profile_ids); corrupt(data); return ok(data); };
    await owner.load(items([id(1), id(2)]));
    assert.equal(owner.snapshot().profiles.size, 1); assert.deepEqual(owner.snapshot().profiles.get(id(1)), prior);
    assert.equal(owner.snapshot().missingProfiles.has(id(2)), true); assert.equal(owner.snapshot().errors.profiles, true); owner.retire();
  });
});

test('batch authority refusal clears reused as well as newly requested profiles', async () => {
  const h = clientHarness(mockRpc), owner = h.owner(); await owner.load(items([id(1)]));
  h.state.override = () => ({ data: null, error: { message: 'AUTH_REQUIRED' } });
  await owner.load(items([id(1), id(2)]), { reuseProfiles: true });
  assert.equal(owner.snapshot().profiles.size, 0); assert.equal(owner.snapshot().missingProfiles.size, 2);
  assert.equal(owner.snapshot().errors.profiles, true); owner.retire();
});

test('invalid batch inputs and an already aborted signal make no RPC', async () => {
  const h = clientHarness(mockRpc);
  for (const input of [[id(1), null], ['not-an-id'], [...ids, id(101)]]) await assert.rejects(h.client.javniProfili(input), /PUBLIC_PROFILE_BATCH_INPUT_INVALID/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(h.client.javniProfili([id(1)], abort.signal), /PUBLIC_PROFILE_READ_FAILED/);
  assert.equal(h.calls.length, 0);
});

test('a changed account rejects a late receipt and cannot populate a retired overlay', async () => {
  const gate = deferred(), begun = deferred(), h = clientHarness(async call => { begun.resolve(); await gate.promise; return mockRpc(call); });
  const read = h.client.javniProfili; let refusal;
  h.client.javniProfili = async (...args) => {
    try { return await read(...args); } catch (error) { refusal = error.message; throw error; }
  };
  const owner = h.owner(false, () => h.session.user.id === ACTOR && h.session.accountRevision === 1);
  const request = owner.load(items([id(1)])); await begun.promise;
  h.session.user.id = OTHER; h.session.accountRevision++; gate.resolve();
  assert.equal((await request).kind, 'stale'); assert.equal(owner.snapshot().profiles.size, 0);
  assert.equal(refusal, 'AUTH_ACCOUNT_CHANGED'); owner.retire();
});

test('abort settles even when transport ignores it; late replies cannot populate the next generation', async () => {
  const gate = deferred(), begun = deferred(), h = clientHarness(async call => { begun.resolve(); await gate.promise; return mockRpc(call); });
  const owner = h.owner(), pending = owner.load(items([id(1)])); await begun.promise;
  owner.suspend(); assert.equal((await pending).kind, 'stale');
  assert.equal(h.calls[0].signal.aborted, true); assert.equal(owner.snapshot().profiles.size, 0);
  h.state.override = mockRpc; await owner.load(items([id(2)]));
  gate.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual([...owner.snapshot().profiles.keys()], [id(2)]); owner.retire();
});

test('optional injected batch loader rejects foreign map keys and preserves the individual-loader compatibility path', async () => {
  const h = clientHarness(mockRpc), loaders = {
    relations: async () => ({ owned: new Set(), applied: new Set(), relation: () => ({ kind: 'NONE' }) }),
    urgencies: async () => new Map(), profile: async () => { throw Error('SINGLE_MUST_NOT_RUN'); },
    profiles: async () => new Map([[id(999), { profilId: id(999), uloga: 'narucilac' }]]),
  };
  const owner = h.overlay.createDiscoveryV1OverlayOwner(loaders); await owner.load(items([id(1)]));
  assert.equal(owner.snapshot().profiles.size, 0); assert.equal(owner.snapshot().errors.profiles, true); owner.retire();
  const legacy = h.owner(true); await legacy.load(items([id(1), id(2)]));
  assert.equal(legacy.snapshot().profiles.size, 2);
  assert.ok(h.calls.every(call => call.name === 'rpc_get_public_profile')); legacy.retire();
});
