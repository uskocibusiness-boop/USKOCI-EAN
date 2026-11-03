// Actual catalog loader, isolated synthetic RPC data only: no database/provider I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFullCatalogTree } from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const fingerprint = 'c'.repeat(32);
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const node = (n, patch = {}) => ({ categoryId: id(n), parentId: null, isLeaf: true,
  label: `Service ${n}`, aliases: [], modes: ['REMOTE'], path: [`Service ${n}`], pathIds: [id(n)], ...patch });
const snapshot = (version, categories) => ({ catalogVersion: version, catalogFingerprint: fingerprint,
  count: categories.length, categories });
const page = (version, operation, items, nextCursor = null) => ({ operation, scope: 'ALL',
  catalogVersion: version, catalogFingerprint: fingerprint, count: items.length, items, nextCursor });
const warm = (version, categories) => loadFullCatalogTree(async () => snapshot(version, categories));
const aborted = error => error instanceof Error && error.message === 'FULL_CATALOG_ABORTED';

function fallback(version, roots, children = {}, onCall) {
  const calls = [];
  const rpc = async (name, args, signal, timeout) => {
    const operation = name === 'rpc_taxonomy_fetch_snapshot_v1' ? 'SNAPSHOT' : args.p_query.operation;
    const call = { name, operation, args, signal, timeout };
    calls.push(call);
    const custom = onCall?.(call, calls);
    if (custom !== undefined) return custom;
    if (operation === 'SNAPSHOT') throw new Error('SYNTHETIC_SNAPSHOT_UNAVAILABLE');
    assert.equal(name, 'rpc_taxonomy_query_catalog_service');
    if (operation === 'META') return { catalogVersion: version, catalogFingerprint: fingerprint };
    return page(version, operation, operation === 'ROOTS' ? roots : children[args.p_query.categoryId] ?? []);
  };
  return { rpc, calls };
}

for (const field of ['label', 'aliases']) {
  test(`same admission metadata cannot certify current ${field} after snapshot failure`, async () => {
    const version = field === 'label' ? 9701001 : 9701002;
    const before = node(1, { label: 'Old label', aliases: ['Old alias'] });
    const current = { ...before, [field]: field === 'label' ? 'New label' : ['New alias'] };
    await warm(version, [before]);
    const f = fallback(version, [current]);
    const result = await loadFullCatalogTree(f.rpc);
    assert.deepEqual(result.categories[0][field], current[field]);
    assert.deepEqual(f.calls.map(call => call.operation), ['SNAPSHOT', 'META', 'ROOTS']);
  });
}

test('same metadata cannot turn a failed current page into an old complete result', async () => {
  const version = 9701003;
  await warm(version, [node(1)]);
  const f = fallback(version, [], {}, call => {
    if (call.operation === 'ROOTS') throw new Error('SYNTHETIC_CURRENT_PAGE_FAILED');
  });
  await assert.rejects(loadFullCatalogTree(f.rpc), /SYNTHETIC_CURRENT_PAGE_FAILED/);
  assert.equal(f.calls.at(-1).operation, 'ROOTS');
});

test('same metadata cannot hide a malformed current paged hierarchy', async () => {
  const version = 9701004;
  await warm(version, [node(1)]);
  const f = fallback(version, [node(2, { parentId: id(404) })]);
  await assert.rejects(loadFullCatalogTree(f.rpc), /FULL_CATALOG_ITEM_INVALID/);
});

test('a pre-aborted load invokes no RPC and returns no catalog', async () => {
  const controller = new AbortController();
  controller.abort(new Error('PRIVATE_ABORT_DETAIL'));
  let calls = 0;
  await assert.rejects(loadFullCatalogTree(async () => {
    calls += 1;
    return snapshot(9701005, [node(1)]);
  }, controller.signal), aborted);
  assert.equal(calls, 0);
});

test('a successful late snapshot after abort cannot become a complete catalog', async () => {
  const controller = new AbortController();
  let finish;
  let calls = 0;
  const pending = loadFullCatalogTree(async () => {
    calls += 1;
    return new Promise(resolve => { finish = resolve; });
  }, controller.signal);
  controller.abort();
  finish(snapshot(9701006, [node(1)]));
  await assert.rejects(pending, aborted);
  assert.equal(calls, 1, 'abort must not initiate a fallback');
});

test('snapshot rejection caused by caller abort does not start META fallback', async () => {
  const controller = new AbortController();
  let calls = 0;
  const rpc = async () => {
    calls += 1;
    if (calls === 1) {
      controller.abort();
      throw new Error('SYNTHETIC_ABORTED_SNAPSHOT');
    }
    throw new Error('UNEXPECTED_FALLBACK');
  };
  await assert.rejects(loadFullCatalogTree(rpc, controller.signal), aborted);
  assert.equal(calls, 1);
});

test('abort while receiving META does not start ROOTS', async () => {
  const controller = new AbortController();
  const f = fallback(9701008, [node(1)], {}, call => {
    if (call.operation === 'META') controller.abort();
  });
  await assert.rejects(loadFullCatalogTree(f.rpc, controller.signal), aborted);
  assert.deepEqual(f.calls.map(call => call.operation), ['SNAPSHOT', 'META']);
});

test('abort after a ROOTS cursor page stops before the next page', async () => {
  const controller = new AbortController();
  const f = fallback(9701009, [], {}, call => {
    if (call.operation === 'ROOTS' && !call.args.p_query.cursor) {
      controller.abort();
      return page(9701009, 'ROOTS', [node(1)], 'NEXT_ROOT_PAGE');
    }
  });
  await assert.rejects(loadFullCatalogTree(f.rpc, controller.signal), aborted);
  assert.equal(f.calls.filter(call => call.operation === 'ROOTS').length, 1);
});

test('abort at the first queued child prevents the rest of that batch and later batches', async () => {
  const controller = new AbortController();
  const roots = Array.from({ length: 18 }, (_, index) => node(index + 1, { isLeaf: false }));
  const children = Object.fromEntries(roots.map((root, index) =>
    [root.categoryId, [node(100 + index, { parentId: root.categoryId })]]));
  const f = fallback(9701010, roots, children, call => {
    if (call.operation === 'CHILDREN') controller.abort();
  });
  await assert.rejects(loadFullCatalogTree(f.rpc, controller.signal), aborted);
  assert.equal(f.calls.filter(call => call.operation === 'CHILDREN').length, 1);
});

test('abort while receiving the final leaf page cannot publish a complete result', async () => {
  const controller = new AbortController();
  const root = node(1, { isLeaf: false }), child = node(2, { parentId: id(1) });
  const f = fallback(9701011, [root], { [root.categoryId]: [child] }, call => {
    if (call.operation === 'CHILDREN') controller.abort();
  });
  await assert.rejects(loadFullCatalogTree(f.rpc, controller.signal), aborted);
  assert.equal(f.calls.length, 4);
});

for (const wrapped of [false, true]) {
  test(`positive complete snapshot keeps the existing ${wrapped ? 'wrapped' : 'raw'} RPC contract`, async () => {
    const controller = new AbortController();
    let calls = 0;
    const result = await loadFullCatalogTree(async (name, args, signal, timeout) => {
      calls += 1;
      assert.equal(name, 'rpc_taxonomy_fetch_snapshot_v1');
      assert.deepEqual(args, { p_generation: 1 });
      assert.equal(signal, controller.signal);
      assert.equal(timeout, 2500);
      const data = snapshot(9701012, [node(1)]);
      return wrapped ? { ok: true, data } : data;
    }, controller.signal);
    assert.equal(result.verifiedComplete, true);
    assert.equal(result.categories.length, 1);
    assert.equal(calls, 1);
  });
}

test('ordinary snapshot failure still completes the bounded walk with existing call timeouts', async () => {
  const controller = new AbortController();
  const root = node(1, { isLeaf: false }), child = node(2, { parentId: id(1) });
  const f = fallback(9701014, [root], { [root.categoryId]: [child] });
  const result = await loadFullCatalogTree(f.rpc, controller.signal);
  assert.equal(result.verifiedComplete, true);
  assert.deepEqual(result.categories.map(item => item.categoryId), [root.categoryId, child.categoryId]);
  assert.deepEqual(f.calls.map(call => call.timeout), [2500, 3000, 4000, 4000]);
  assert.ok(f.calls.every(call => call.signal === controller.signal));
  assert.equal(f.calls[3].args.p_query.catalogVersion, 9701014);
  assert.equal(f.calls[3].args.p_query.catalogFingerprint, fingerprint);
  assert.ok(f.calls.slice(2).every(call => call.args.p_query.limit === 100));
});
