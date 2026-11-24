'use strict';
// Actual production route, composer and page owner. Native hosts
// and RPC transport are substitutes: this is not Android or hosted Auth proof.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { React, RTR, createHarness, deferred, mount, nodes, target, press, unmount } = require('./ux-component-harness.cjs');
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = ID(1), B = ID(2), AT = '2026-11-08T10:00:00.000001Z', CREATED = '2026-11-08T09:00:00.123456Z';
const known = value => ({ kind: 'known', value });
const dataSeams = { 'src/store/sesija.ts': { sesijaSada: () => ({}) }, 'src/ui/system/Skeleton.tsx': { SkeletonList: 'SkeletonList' },
  'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('Unexpected transport'); } } };
const row = n => ({ id: ID(n), needId: ID(n + 10000), version: 2, title: `Saradnja ${n}`, reason: 'TERM', changeId: null, createdAt: CREATED });
function page(offset = 0, total = 45, accountId = A, viewAt = AT) {
  const remaining = Math.max(0, total - offset), items = Array.from({ length: Math.min(20, remaining) }, (_, i) => row(9000 - offset - i));
  const hasMore = remaining > 20, last = items.at(-1);
  return { schemaVersion: 1, accountId, asOf: viewAt, viewAt, counts: { total, remaining }, items, hasMore,
    nextCursor: hasMore ? { schemaVersion: 1, accountId, viewAt, at: last.createdAt, id: last.id } : null };
}
function summary(extra = {}) {
  return { schemaVersion: 1, accountId: A, asOf: AT,
    counts: { hasAny: true, active: 46, upcoming: 1, withoutExactTerm: 45, awaitingFinish: 0, remainingThisWeek: 0 },
    next: { id: ID(500), needId: ID(10500), version: 3, title: 'Sledeća potvrđena saradnja', role: 'narucilac',
      counterpartProfileId: ID(50), counterpartName: 'Miloš Šljivić', startAt: '2030-11-09T10:00:00Z', endAt: null },
    ratings: { due: 1, agreementId: ID(700) },
    prompts: { total: 45, changes: 0, terms: 45, items: page().items.slice(0, 4) }, ...extra };
}
const pure = createHarness(dataSeams), { composeHome } = pure.load('src/data/homeSnapshot.ts');
const compose = (s = summary(), attention = known({ rows: [], more: 0, asOf: AT })) =>
  composeHome({ needs: known([]), applications: known([]), agreements: known(s) }, attention, Date.parse(AT), 'Europe/Belgrade');

test('Home summary retains history-only hasAny and independent ratings when attention fails', () => {
  const s = summary({ counts: { hasAny: true, active: 0, upcoming: 0, withoutExactTerm: 0, awaitingFinish: 0, remainingThisWeek: 0 },
    next: null, prompts: { total: 0, changes: 0, terms: 0, items: [] } });
  const home = compose(s, { kind: 'unavailable' });
  assert.equal(home.firstRun, false); assert.equal(home.agreements.kind, 'known'); assert.deepEqual(home.agreements.value.rows, []);
  assert.equal(home.ratingsDue, 1); assert.equal(home.ratingDueAgreementId, ID(700)); assert.equal(home.partial, true);
  assert.equal(compose({ ...s, ratings: { due: 0, agreementId: null } }).firstRun, false);
});
test('Home uses exact bounded next/counts and never invents a full commercial Agreement projection', () => {
  const home = compose(summary({ counts: { ...summary().counts, remainingThisWeek: 9, upcoming: 10 } }));
  assert.equal(home.agreements.value.rows.length, 1); assert.equal(home.agreements.value.rows[0].target.agreementId, ID(500));
  assert.equal(home.agreements.value.more, 45); assert.match(home.agreements.value.rows[0].raspored.more, /9 Dogovora/);
  assert.equal(home.agreements.value.rows[0].appointment.counterpartInitials, 'MŠ');
  assert.equal(home.agreements.value.rows[0].appointment.roleLabel, 'Vaš zadatak');
  assert.equal(home.agreementItems, undefined); assert.equal(home.prompts.length, 4); assert.equal(home.promptsMore, 41);
  assert.deepEqual(home.allPrompts, []); assert.equal(home.agreementPrompts.total, 45);
});
test('Home summary does not mistake a start-only term for an unagreed term or a full window', () => {
  const home = compose();
  assert.match(home.agreements.value.rows[0].raspored.when, /od 11:00/);
  assert.equal(home.prompts.some(p => p.target.agreementId === ID(500)), false);
  const quiet = compose(summary({ next: null, counts: { hasAny: true, active: 46, upcoming: 0, withoutExactTerm: 45, awaitingFinish: 1, remainingThisWeek: 0 } }));
  assert.deepEqual(quiet.agreements.value.rows, []); assert.equal(quiet.agreements.value.more, 46);
  assert.match(quiet.agreements.value.quietLine, /45 Dogovora bez tačnog termina/); assert.match(quiet.agreements.value.quietLine, /1 Dogovor čeka završetak/);
});
test('Home cannot keep calling an expired retained appointment next or invent its successor', () => {
  const s = summary({ next: { ...summary().next, startAt: '2026-11-08T09:00:00Z', endAt: '2026-11-08T10:01:00Z' } });
  const home = composeHome({ needs: known([]), applications: known([]), agreements: known(s) },
    known({ rows: [], more: 0, asOf: AT }), Date.parse('2026-11-08T10:01:00Z'));
  assert.equal(home.agreements.kind, 'unavailable'); assert.equal(home.partial, true); assert.equal(home.firstRun, false);
  assert.equal(home.ratingsDue, 1); assert.equal(home.agreementPrompts.total, 45);
});

function ownerHarness(reply = async request => page(request.cursor ? 20 : 0), timerModules = {}) {
  let current = true; const calls = [];
  const h = createHarness(dataSeams, timerModules), Owner = h.load('src/data/homeAgreementPromptOwner.ts').HomeAgreementPromptOwner;
  const owner = new Owner(A, { current: () => current, read: request => { calls.push(request); return reply(request); } });
  return { owner, calls, retire: () => { current = false; } };
}
test('Home prompt owner reads only on demand and keeps one bounded page across all pages', async () => {
  let offset = 0;
  const h = ownerHarness(async request => { if (!request.cursor) offset = 0; const result = page(offset, 1001); offset += 20; return result; });
  assert.equal(h.calls.length, 0); await h.owner.start(); assert.equal(h.calls.length, 1);
  const seen = new Set(h.owner.getSnapshot().page.items.map(r => r.id));
  while (h.owner.getSnapshot().page.hasMore) {
    const before = h.calls.length; await h.owner.next(); assert.equal(h.calls.length, before + 1);
    const current = h.owner.getSnapshot().page; assert.ok(current.items.length <= 20);
    current.items.forEach(r => { assert.equal(seen.has(r.id), false); seen.add(r.id); });
  }
  assert.equal(seen.size, 1001); assert.equal(h.calls.length, 51); assert.equal(h.owner.getSnapshot().page.items.length, 1);
  await h.owner.next(); assert.equal(h.calls.length, 51); await h.owner.refresh(); assert.equal(h.calls.length, 52);
  assert.equal(h.calls.at(-1).cursor, null); assert.equal(h.owner.getSnapshot().index, 0); h.owner.dispose();
});
test('Home failed next page retains known rows, retries the same cursor once, and never replays automatically', async () => {
  let failure = true;
  const h = ownerHarness(async request => {
    if (request.cursor && failure) throw Error('NETWORK_ERROR'); return page(request.cursor ? 20 : 0, 25);
  });
  await h.owner.start(); const first = h.owner.getSnapshot().page;
  await h.owner.next(); assert.equal(h.owner.getSnapshot().page, first); assert.equal(h.owner.getSnapshot().error, 'unavailable');
  assert.equal(h.calls.length, 2); await h.owner.next(); assert.equal(h.calls.length, 2);
  failure = false; await h.owner.retry(); assert.deepEqual(h.calls[2].cursor, h.calls[1].cursor);
  assert.equal(h.owner.getSnapshot().page.items.length, 5); assert.equal(h.owner.getSnapshot().index, 1); h.owner.dispose();
});
test('Home expired traversal requires explicit restart and never loses the last confirmed page', async () => {
  const h = ownerHarness(async request => { if (request.cursor) throw Error('HOME_PROMPTS_EXPIRED'); return page(); });
  await h.owner.start(); const first = h.owner.getSnapshot().page;
  await h.owner.next(); assert.equal(h.owner.getSnapshot().error, 'expired'); assert.equal(h.owner.getSnapshot().page, first);
  await h.owner.retry(); await h.owner.next(); assert.equal(h.calls.length, 2);
  await h.owner.refresh(); assert.equal(h.calls.length, 3); assert.equal(h.calls.at(-1).cursor, null); assert.equal(h.owner.getSnapshot().error, null); h.owner.dispose();
});
test('Home double press, timeout and late completion cannot add a duplicate request or replace known rows', async () => {
  const pending = deferred(), timers = [];
  const h = ownerHarness(() => pending.promise, { 'src/data/homeAgreementPromptOwner.ts': { setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {} } });
  const read = h.owner.start(); await h.owner.start(); await h.owner.refresh(); assert.equal(h.calls.length, 1);
  assert.equal(timers[0].ms, 15000); timers[0].fn(); await read;
  assert.equal(h.calls[0].signal.aborted, true); assert.equal(h.owner.getSnapshot().error, 'unavailable');
  pending.resolve(page()); await Promise.resolve(); assert.equal(h.owner.getSnapshot().page, null); assert.equal(h.calls.length, 1); h.owner.dispose();
});
test('Home rejects foreign, repeated and retired page responses', async () => {
  const foreign = ownerHarness(async () => page(0, 45, B)); await foreign.owner.start();
  assert.equal(foreign.owner.getSnapshot().page, null); assert.equal(foreign.owner.getSnapshot().error, 'unavailable'); foreign.owner.dispose();
  const repeated = ownerHarness(async () => page()); await repeated.owner.start(); const first = repeated.owner.getSnapshot().page;
  await repeated.owner.next(); assert.equal(repeated.owner.getSnapshot().page, first); assert.equal(repeated.owner.getSnapshot().error, 'unavailable'); repeated.owner.dispose();
  const pending = deferred(), retired = ownerHarness(() => pending.promise); const read = retired.owner.start();
  retired.retire(); pending.resolve(page()); await read; assert.equal(retired.owner.getSnapshot().page, null);
  await retired.owner.refresh(); assert.equal(retired.calls.length, 1); retired.owner.dispose();
});

test('ProductSheet resets only a changed bounded page viewport and keeps the dialog mounted', async () => {
  const h = createHarness(), scrolls = []; let mounts = 0;
  h.native.Modal = p => { React.useEffect(() => { mounts++; }, []); return React.createElement('Modal', p, p.children); };
  h.native.Pressable = 'Pressable'; h.native.KeyboardAvoidingView = 'KeyboardAvoidingView';
  h.native.ScrollView = React.forwardRef((p, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: value => scrolls.push(value) }), []);
    return React.createElement('NativeScrollView', p, p.children);
  });
  h.stubs['react-native-gesture-handler'] = { GestureHandlerRootView: 'GestureHandlerRootView' };
  h.stubs['react-native-safe-area-context'] = { SafeAreaInsetsContext: React.createContext(null) };
  h.stubs['src/hooks/useSystemReducedMotion.ts'] = { useSystemReducedMotion: () => true };
  h.stubs['src/ui/system/tokens.ts'].sheetLift = { detached: {} };
  h.stubs['react-native-reanimated'] = { ...h.stubs['react-native-reanimated'], __esModule: true,
    cancelAnimation: () => {}, useSharedValue: value => ({ value }) };
  const C = h.load('src/ui/product/ProductSheet.tsx').ProductSheet, props = { onClose: () => {}, children: () => null };
  const r = await mount(C, props); assert.equal(scrolls.length, 0);
  await RTR.act(async () => r.update(React.createElement(C, { ...props, contentKey: 'first' })));
  assert.deepEqual(scrolls, [{ y: 0, animated: false }]);
  await RTR.act(async () => r.update(React.createElement(C, { ...props, contentKey: 'first', title: 'Updated copy' })));
  assert.equal(scrolls.length, 1);
  await RTR.act(async () => r.update(React.createElement(C, { ...props, contentKey: 'second' })));
  assert.equal(scrolls.length, 2); assert.equal(mounts, 1); await unmount(r);
});
test('Home S01 shows one next appointment and no "Čeka Vas" section (owner decision 2026-11-20)', async () => {
  const h = createHarness(dataSeams);
  const C = h.load('src/ui/home/HomePresentation.tsx').HomePresentation, noop = () => {};
  const r = await mount(C, { home: compose(), active: true, loading: false, refreshing: false, error: false,
    onPublish: noop, onEarn: noop, onProfile: noop, onOpen: noop, onRatings: noop, onMyTasks: noop, onMyApplications: noop, onRefresh: noop });
  assert.equal(nodes(r, n => n.type === 'Section' && n.props.title === 'Sledeće').length, 1);
  assert.equal(nodes(r, n => n.type === 'Section' && n.props.title === 'Čeka Vas').length, 0);
  const labels = nodes(r, n => typeof n.props?.title === 'string' || typeof n.props?.label === 'string' || typeof n.props?.accessibilityLabel === 'string')
    .map(n => [n.props.title, n.props.label, n.props.accessibilityLabel].filter(v => typeof v === 'string').join(' ')).join(' | ');
  assert.doesNotMatch(labels, /Čeka Vas|Prikažite pregled obaveza|Saradnja 9000|Ocenite/);
  for (const name of ['TaskCard', 'OwnTaskCard', 'ApplicationCard', 'AgreementRow']) assert.equal(nodes(r, n => n.type === name).length, 0);
  await unmount(r);
});

async function routeHarness({ initialFailure = false } = {}) {
  const calls = [], states = new Set(), navigation = [], session = { user: { id: A }, accountRevision: 1 };
  let failSummary = initialFailure;
  const source = {
    mojePotrebe: async () => [], mojePrijaveStrana: async (request, options) => { calls.push(['applications', request, options]);
      return { counts: { total: 0, active: 0, attention: 0, finished: 0 }, items: [] }; },
    dogovoriZaPocetnu: async options => { calls.push(['summary', options]); if (failSummary) throw Error('MISSING_RPC'); return summary({ accountId: session.user.id }); },
    podsetniciDogovoraZaPocetnu: async () => assert.fail('Home must not page "Čeka Vas" prompts'),
    mojiDogovori: async () => assert.fail('Home must not read ALL Agreement history'),
    prilikeZaPocetnu: async () => [],
    paznjaZaPocetnu: async () => assert.fail('Home must not read the "Čeka Vas" attention list'),
    mojRadnikProfil: async () => null,
  };
  const h = createHarness({
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/store/uloga.ts': { useIzvor: () => source, izvorSada: () => source },
    'src/data/aiCorrectionIntent.ts': { rememberAiCorrection: () => null },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => ID(999) },
    'expo-router': { router: { navigate: x => navigation.push(x), push: x => navigation.push(x) }, useFocusEffect: fn => React.useEffect(fn, [fn]) },
  });
  h.native.AppState = { currentState: 'active', addEventListener: (_, fn) => { states.add(fn); return { remove: () => states.delete(fn) }; } };
  for (const [file, name] of [['src/ui/home/HomePresentation.tsx', 'HomePresentation'], ['src/ui/home/IntakeResume.tsx', 'IntakeResume'],
    ['src/ui/media/ContextPhotos.tsx', 'ProfilePhoto'], ['src/ui/system/ActualUserAvatar.tsx', 'ActualUserAvatar']]) h.stubs[file] = { [name]: h.host(name) };
  const C = h.load('src/app/(app)/index.tsx').default, r = await mount(C, {});
  const props = () => nodes(r, n => n.type === 'HomePresentation')[0].props;
  return { r, C, h, calls, props, states, source, session, navigation, fail: () => { failSummary = true; }, stop: () => unmount(r) };
}
test('Mounted Home retains its verified summary on partial refresh failure without ALL fallback', async () => {
  const h = await routeHarness();
  assert.deepEqual(h.calls.map(c => c[0]).filter(name => name === 'applications' || name === 'summary'), ['applications', 'summary']);
  const applicationRead = h.calls.find(c => c[0] === 'applications');
  assert.ok(applicationRead[2]?.signal instanceof AbortSignal, 'application page must receive its section cancellation signal');
  assert.equal(applicationRead[2].signal.aborted, true, 'completed application read retires its transport signal');
  assert.equal(h.calls.some(c => c[0] === 'attention' || c[0] === 'prompts'), false, 'Home no longer reads "Čeka Vas"');
  assert.equal(h.calls[0][1].limit, 6); assert.equal(h.props().home.agreements.value.rows.length, 1);
  assert.equal(h.props().home.ratingsDue, 1); assert.equal(h.props().home.agreementPrompts.total, 45);
  h.fail(); await RTR.act(async () => h.props().onRefresh());
  assert.equal(h.props().home.agreements.kind, 'known'); assert.equal(h.props().stale, true);
  assert.equal(h.props().home.agreements.value.rows[0].target.agreementId, ID(500));
  assert.deepEqual(h.calls.map(c => c[0]).filter(name => name === 'applications' || name === 'summary'), ['applications', 'summary', 'applications', 'summary']); await h.stop();
});
test('Mounted Home initial missing summary stays unavailable, never an empty account or an ALL fallback', async () => {
  const h = await routeHarness({ initialFailure: true });
  assert.equal(h.props().home.agreements.kind, 'unavailable'); assert.equal(h.props().home.partial, true);
  assert.equal(h.props().home.firstRun, false); assert.deepEqual(h.calls.map(c => c[0]).filter(name => name === 'applications' || name === 'summary'), ['applications', 'summary']); await h.stop();
});
test('Mounted Home focus, account revision and source ownership retire stale navigation callbacks', async () => {
  const h = await routeHarness(), old = h.props();
  await RTR.act(async () => { h.h.native.AppState.currentState = 'background'; for (const fn of [...h.states]) fn('background'); });
  assert.equal(h.props().home, null);
  await RTR.act(async () => old.onOpen({ kind: 'AGREEMENT', agreementId: ID(500) })); assert.equal(h.navigation.length, 0);
  await RTR.act(async () => { h.h.native.AppState.currentState = 'active'; for (const fn of [...h.states]) fn('active'); });
  const active = h.props();
  await RTR.act(async () => { h.session.user = { id: B }; h.session.accountRevision++; h.r.update(React.createElement(h.C)); });
  await RTR.act(async () => active.onOpen({ kind: 'AGREEMENT', agreementId: ID(500) })); assert.equal(h.navigation.length, 0);
  assert.equal(h.props().home.agreementPrompts.accountId, B);
  await RTR.act(async () => { h.session.user = { id: A }; h.session.accountRevision++; h.r.update(React.createElement(h.C)); });
  assert.equal(h.props().home.agreementPrompts.accountId, A); await h.stop();
});

test('Own task page service contract forwards Home cancellation through the receipt and RPC transport', () => {
  const fs = require('node:fs');
  const service = fs.readFileSync('src/data/needClientService.ts', 'utf8');
  const ports = fs.readFileSync('src/data/ports.ts', 'utf8');
  assert.match(ports, /mojePotrebeStrana\(request: OwnTasksPageRequest, options\?: \{ includeUrgency\?: boolean; signal\?: AbortSignal \}\)/);
  assert.match(service, /const signal = options\?\.signal;[\s\S]*?if \(signal\?\.aborted\) throw new Error\('OWN_TASKS_PAGE_RETIRED'\);[\s\S]*?readOwnedResult\(\{[\s\S]*?signal,[\s\S]*?request: readSignal =>[\s\S]*?rpc\.abortSignal\(readSignal\)/);
  assert.match(service, /if \(signal\?\.aborted\) throw new Error\('OWN_TASKS_PAGE_RETIRED'\);[\s\S]*?readNeedUrgencies\(documents, signal\)[\s\S]*?if \(signal\?\.aborted\) throw new Error\('OWN_TASKS_PAGE_RETIRED'\)/);
});


test('Own task page cancellation settles an abort-ignoring receipt and is classified as retirement', async () => {
  const fs = require('node:fs');
  const h = createHarness({
    'src/store/sesija.ts': { sesijaSada: () => ({ user: { id: A }, accountRevision: 1 }) },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({}) },
  });
  const { readOwnedResult } = h.load('src/data/serverReceipt.ts');
  const controller = new AbortController();
  let transportSignal, resolveTransport;
  const receiptPromise = readOwnedResult({
    signal: controller.signal,
    request: signal => {
      transportSignal = signal;
      return new Promise(resolve => { resolveTransport = resolve; });
    },
    decode: value => value === 'valid' ? value : null,
    errors: {}, fallback: 'OWN_TASKS_PAGE_UNAVAILABLE', invalid: 'OWN_TASKS_PAGE_INVALID',
  });
  controller.abort();
  const receipt = await receiptPromise;
  assert.equal(transportSignal.aborted, true, 'the owned RPC transport must receive cancellation');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.kod, 'OWN_TASKS_PAGE_UNAVAILABLE', 'the receipt helper fails closed when transport ignores abort');
  resolveTransport({ data: 'valid', error: null });
  await Promise.resolve();
  assert.equal(receipt.ok, false, 'a late successful response cannot replace the cancelled receipt');

  const service = fs.readFileSync('src/data/needClientService.ts', 'utf8');
  const start = service.indexOf('const result = await readOwnedResult({', service.indexOf('async mojePotrebeStrana'));
  const retired = service.indexOf("if (signal?.aborted) throw new Error('OWN_TASKS_PAGE_RETIRED');", start);
  const unavailable = service.indexOf('if (!result.ok) throw new Error(result.kod);', start);
  assert.ok(start >= 0 && retired > start && unavailable > retired,
    'service must classify an aborted page as retired before exposing the receipt fallback');
});
