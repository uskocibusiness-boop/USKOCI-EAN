import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockDelayRouteFocus = false, mockFocusHookCount = 0;
let mockStartRouteFocus: () => void = () => {}, mockStopRouteFocus: () => void = () => {};
const mockPolicy = jest.fn(), mockExecution = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), navigate: jest.fn(), push: jest.fn() };
jest.mock('../retentionPolicyClientService', () => ({ retentionPolicyClientService: {
  readStatus: () => mockPolicy(), readExecutionStatus: () => mockExecution(),
} }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useRouter: () => mockRouter, useFocusEffect: (effect: () => void | (() => void)) => {
  const React = require('react');
  // The route owns the first focus hook; delay only its event so both independent
  // resource readers can finish before navigation establishes this visit.
  const routeFocus = React.useRef(mockFocusHookCount++ === 0).current;
  React.useEffect(() => {
    if (!mockFocused) return;
    if (!routeFocus || !mockDelayRouteFocus) return effect();
    mockStartRouteFocus = () => { const cleanup = effect(); mockStopRouteFocus = typeof cleanup === 'function' ? cleanup : () => {}; };
    return () => mockStopRouteFocus();
  }, [effect, mockFocused]);
} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
// What the rows "Blokirane osobe", "Izvoz podataka" and "Pravila i saglasnosti" say about themselves is read apart from the schedule (hub-states.test.ts and
// use-hub-states.test.tsx test the mapping and the reads); here it is the value the screen is handed, so the hub is tested for the words it puts on its rows.
let mockHubStates: Record<string, unknown> = {};
const mockUseHubStates = jest.fn((_keys: readonly string[]) => mockHubStates);
jest.mock('../../ui/profile/useHubStates', () => ({ useHubStates: (keys: readonly string[]) => mockUseHubStates(keys) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'ActivityIndicator', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Privacy from '../../app/(app)/profil/privatnost';
import { InlineNote } from '../../ui/privacy/InlineNote';
import { ListRow } from '../../ui/system/ListRow';

const ok = (podatak: unknown) => ({ ok: true, podatak });
const policy = (version = 'fixture-v1') => ({ ready: true, policyVersion: version, effectiveAt: '2026-09-10T00:00:00Z',
  rules: [{ dataClass: 'AI_VOLATILE', purpose: 'synthetic purpose', retentionPeriod: 'fixture duration', deletionTrigger: 'fixture trigger',
    exceptionRule: 'fixture exception', legalBasis: 'fixture basis' }] });
const execution = (version = 'fixture-v1') => ({ engineVersion: 'P3_AI_ABANDONED_UNBOUND_V1', executionAdmitted: true, policyVersion: version,
  datasets: [{ dataset: 'AI_ABANDONED_UNBOUND', dataClass: 'AI_VOLATILE', action: 'DELETE', ready: true, reason: null }],
  unsupportedDataClasses: ['MEDIA_OBJECTS'], storageCleanup: 'NOT_APPLICABLE' });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Privacy />); }); };
const update = async () => { await act(async () => tree.update(<Privacy />)); };
const button = (label: string) => tree.root.findByProps({ label }).props;
/**
 * "Rokovi čuvanja" is the one row of the hub that opens in place (approved draft of the product, 8 Oct 2026, P5), and everything about the schedule is inside it:
 * the skeleton, the sentence that it is not available, the rules, the retry of a read that failed and the automatic deletion. It starts closed on every visit.
 */
const retentionRow = () => tree.root.findByProps({ accessibilityLabel: 'Rokovi čuvanja' });
const openRetention = async () => { await act(async () => retentionRow().props.onPress()); };
const rule = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
/**
 * A re-read is the PULL of the screen (J12: a screen is refreshed by pulling it; owner's phone, 8 Oct 2026: a standing "Osveži" over the rules was noise): the
 * `RefreshControl` the screen hands its scroll. The only standing word is the retry of a read that FAILED, next to the note that says so, inside "Rokovi čuvanja".
 */
const pull = () => tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props as { refreshing: boolean; onRefresh: () => void };
const refreshPresses = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Osveži rokove čuvanja');
const refresh = () => { expect(refreshPresses()).toHaveLength(1); return refreshPresses()[0].props; };
const refreshWord = () => refreshPresses()[0].findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children).join('');
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const pressLabels = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType).map(node => node.props.accessibilityLabel as string).filter(label => label !== 'Nazad');
beforeEach(() => {
  jest.clearAllMocks(); mockPolicy.mockReset(); mockExecution.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockHubStates = {};
  mockDelayRouteFocus = false; mockFocusHookCount = 0; mockStartRouteFocus = () => {}; mockStopRouteFocus = () => {};
  mockRouter.canGoBack.mockReturnValue(true);
  mockPolicy.mockResolvedValue(ok({ ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] }));
  mockExecution.mockResolvedValue(ok({ ...execution(), executionAdmitted: false, policyVersion: null }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each(['narucilac', 'uskocer'])('reads both actual services in parallel for %s with no mutation on entry', async intent => {
  mockIntent = intent; const first = deferred(), second = deferred();
  mockPolicy.mockReturnValueOnce(first.promise); mockExecution.mockReturnValueOnce(second.promise);
  await render(); expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
  // The schedule is inside the row "Rokovi čuvanja", which starts closed: nothing of it is drawn until the person opens it.
  expect(texts()).not.toContain('Učitavamo rokove čuvanja');
  await openRetention();
  expect(texts()).toContain('Učitavamo rokove čuvanja'); expect(refreshPresses()).toHaveLength(0);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it('keeps unpublished retention explicit, ONCE, inside its row, and opens closure through a separate review', async () => {
  await render();
  expect(texts()).not.toContain('još nisu dostupni');
  await openRetention();
  // "Not available" is one calm sentence inside "Rokovi čuvanja"; the deletion section rests on the same schedule, so it is not drawn and says nothing again.
  expect(texts()).toContain('Rokovi čuvanja i automatsko brisanje napuštenih razgovora još nisu dostupni.');
  expect(texts().match(/još nisu dostupni/g)).toHaveLength(1);
  expect(texts()).not.toContain('Automatsko brisanje napuštenih razgovora'); expect(texts()).not.toContain('Trenutno nije dostupno.');
  expect(texts()).toContain('Pregledaj dostupnost, obaveze i pravila čuvanja');
  expect(texts()).not.toContain('fixture duration');
  // The hub: what only tells has its mark, every other row leads somewhere; nothing is pressable after them: a re-read is the pull of the screen
  // (UI/UX pass 2026-10-08, F6; owner's phone the same day).
  expect(pressLabels()).toEqual(['Objašnjenje: Ko šta vidi', 'Rokovi čuvanja', 'Izvoz podataka', 'Blokirane osobe', 'Pravila i saglasnosti', 'Zatvaranje naloga']);
});
it('renders every published rule field and only the narrow matching capability', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render();
  expect(texts()).not.toContain('fixture duration'); await openRetention();
  expect(texts()).not.toContain('fixture duration');
  await act(async () => rule('AI razgovori i izdvojeni podaci').props.onPress());
  for (const value of ['synthetic purpose', 'fixture duration', 'fixture trigger', 'fixture exception', 'fixture basis',
    'samo za napuštene razgovore sa asistentom', 'Ovo nije potvrda da je određeni razgovor obrisan']) expect(texts()).toContain(value);
  expect(texts()).not.toContain('P3_AI_ABANDONED_UNBOUND_V1'); expect(texts()).not.toContain('AI_VOLATILE');
});
it('opens one published rule at a time without turning the row into a data mutation', async () => {
  const value = policy();
  value.rules.push({ ...value.rules[0], dataClass: 'PROFILE_DATA', retentionPeriod: 'second fixture duration' });
  mockPolicy.mockResolvedValue(ok(value)); await render(); await openRetention();
  const first = () => rule('AI razgovori i izdvojeni podaci');
  const second = () => rule('Podaci profila');
  expect(first().props.accessibilityState.expanded).toBe(false);
  await act(async () => first().props.onPress());
  expect(first().props.accessibilityState.expanded).toBe(true);
  await act(async () => second().props.onPress());
  expect(first().props.accessibilityState.expanded).toBe(false);
  expect(second().props.accessibilityState.expanded).toBe(true);
  expect(texts()).toContain('second fixture duration');
  expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it('does not carry expanded legal content across a newly read policy version', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render(); await openRetention();
  await act(async () => rule('AI razgovori i izdvojeni podaci').props.onPress());
  expect(texts()).toContain('fixture duration');
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2')));
  await act(async () => pull().onRefresh());
  // The version itself is no longer drawn on this screen (only the legal documents carry one): the proof that the new read
  // replaced the old one is that its rule is closed again and none of the old rule's text is on screen.
  expect(rule('AI razgovori i izdvojeni podaci').props.accessibilityState.expanded).toBe(false);
  expect(texts()).not.toContain('fixture duration');
});
it('does not combine different policy versions into an admission', async () => {
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2'))); mockExecution.mockResolvedValue(ok(execution('fixture-v1'))); await render(); await openRetention();
  expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena');
  expect(texts()).not.toContain('brisanje je omogućeno');
});
it.each(['policy', 'execution'])('keeps the other reader usable after %s fails without exposing transport details', async failed => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution()));
  (failed === 'policy' ? mockPolicy : mockExecution).mockRejectedValueOnce(new Error('private transport diagnostic'));
  await render(); await openRetention(); expect(texts()).not.toContain('private transport'); expect(texts()).not.toContain('brisanje je omogućeno');
  if (failed === 'execution') {
    await act(async () => rule('AI razgovori i izdvojeni podaci').props.onPress());
    expect(texts()).toContain('fixture duration');
  }
  await act(async () => pull().onRefresh());
  expect(mockPolicy).toHaveBeenCalledTimes(2); expect(mockExecution).toHaveBeenCalledTimes(2);
});
it('opens existing export once after an explicit double tap', async () => {
  await render(); const open = button('Izvoz podataka').onPress;
  await act(async () => { open(); open(); }); expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
});
it.each([['Izvoz podataka', '/profil/izvoz'], ['Blokirane osobe', '/profil/blokirani'], ['Pravila i saglasnosti', '/profil/pravna']])(
  'opens "%s" once after an explicit double tap, on its own screen', async (label, path) => {
    await render(); const open = button(label).onPress;
    await act(async () => { open(); open(); }); expect(mockRouter.navigate.mock.calls).toEqual([[path]]);
  });
it('one way onward at a time: a second row pressed while the first is opening opens nothing', async () => {
  await render();
  await act(async () => { button('Blokirane osobe').onPress(); button('Pravila i saglasnosti').onPress(); button('Izvoz podataka').onPress(); });
  expect(mockRouter.navigate.mock.calls).toEqual([['/profil/blokirani']]);
});
it.each(['account', 'incarnation', 'blur'])('retires retained navigation after %s changes', async change => {
  await render(); const opens = ['Izvoz podataka', 'Blokirane osobe', 'Pravila i saglasnosti'].map(label => button(label).onPress);
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); mockFocused = true; await update(); }
  await act(async () => { for (const open of opens) open(); }); expect(mockRouter.navigate).not.toHaveBeenCalled();
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode retires nothing: retained navigation still opens the export', async () => {
  await render(); const open = button('Izvoz podataka').onPress; mockIntent = 'uskocer';
  await act(async () => open()); expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
});
it.each(['account', 'blur'])('discards late schedule success after %s changes', async change => {
  const old = deferred(); mockPolicy.mockReturnValueOnce(old.promise); await render(); await openRetention();
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else mockFocused = false;
  await update(); await act(async () => old.resolve(ok(policy('retired-fixture'))));
  expect(texts()).not.toContain('retired-fixture'); expect(texts()).not.toContain('fixture duration');
});
it.each([true, false])('returns through available history %s or Profile fallback', async history => {
  mockRouter.canGoBack.mockReturnValue(history); await render();
  const back = tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
  await act(async () => { back(); back(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(history ? 1 : 0);
  expect(mockRouter.replace.mock.calls).toEqual(history ? [] : [['/profil']]);
});
// Round 5: closure is a quiet row that opens the flow over this screen (the Modal host; a route of its own needs the
// tab layout). It opens once for a double tap and never from a retained press of an old account, incarnation or focus.
it('opens the closure flow once after an explicit double tap', async () => {
  await render(); const open = button('Zatvaranje naloga').onPress;
  await act(async () => { open(); open(); });
  expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it.each(['account', 'incarnation', 'blur'])('retires a retained closure entry after %s changes', async change => {
  await render(); const open = button('Zatvaranje naloga').onPress;
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); mockFocused = true; await update(); }
  await act(async () => open());
  expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
});
it('keeps the unpublished and failed retention states off the green confirmation tint', async () => {
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic')); await render(); await openRetention();
  expect(texts()).toContain('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
  const alert = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'alert');
  expect(alert.map(node => node.props.children)).toContain('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
});
// Round 5 review: the retry of a failed retention read stands with its own note, and there is one refresh on screen. Since the
// UI/UX pass 2026-10-08 the retry is the word beside the note that says the read failed, inside the row of the schedule.
it('a failed retention read has its retry beside its own note, inside "Rokovi čuvanja"', async () => {
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic')); await render();
  // Closed, the row shows no retry at all: there is nothing standing over the hub.
  expect(refreshPresses()).toHaveLength(0);
  await openRetention();
  const note = tree.root.findAllByType(InlineNote).find(node => node.props.tone === 'danger')!;
  expect(note.props.children).toBe('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
  const stack = note.parent!;
  expect(stack.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Osveži rokove čuvanja')).toHaveLength(1);
  expect(refreshPresses()).toHaveLength(1);
  mockPolicy.mockResolvedValue(ok(policy())); await act(async () => refresh().onPress());
  expect(tree.root.findAllByType(InlineNote).filter(node => node.props.tone === 'danger')).toHaveLength(0);
});
it('a failed deletion read takes the danger note; a version mismatch stays a plain note', async () => {
  // The deletion section is drawn only with a published schedule (it rests on it).
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockRejectedValueOnce(new Error('private transport diagnostic')); await render(); await openRetention();
  const block = () => tree.root.findAllByType(InlineNote).find(node => node.props.children === 'Dostupnost automatskog brisanja nije potvrđena.')!;
  expect(block().props.tone).toBe('danger');
  expect(block().props.alert).toBe(true);
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2'))); mockExecution.mockResolvedValue(ok(execution('fixture-v1')));
  await act(async () => pull().onRefresh());
  expect(block().props.tone).toBe('neutral'); expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena');
});
it('with a published schedule the deletion says its own state in one line; without one the section is not drawn', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok({ ...execution(), executionAdmitted: false, policyVersion: null })); await render(); await openRetention();
  expect(texts()).toContain('Automatsko brisanje napuštenih razgovora'); expect(texts()).toContain('Trenutno nije dostupno.');
  expect(texts()).not.toContain('još nisu dostupni');
});
it.each(['closure', 'export', 'back'])('establishes usable %s after reads finish before route focus, without another read', async action => {
  mockDelayRouteFocus = true; await render();
  expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
  // Before the route's focus nothing opens, not even the row of the schedule.
  await openRetention(); expect(texts()).not.toContain('još nisu dostupni');
  await act(async () => mockStartRouteFocus());
  await openRetention();
  expect(texts()).toContain('Rokovi čuvanja i automatsko brisanje napuštenih razgovora još nisu dostupni.');
  const press = action === 'closure' ? button('Zatvaranje naloga').onPress : action === 'export'
    ? button('Izvoz podataka').onPress : tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
  await act(async () => { press(); press(); });
  if (action === 'closure') expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(1);
  else if (action === 'export') expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
  else expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
});
it('refocus enables new callbacks while retiring old ones without relying on resource state changes', async () => {
  mockDelayRouteFocus = true; await render();
  await act(async () => mockStartRouteFocus());
  // Establish a render for the original implementation too; the regression here
  // is the next focus event with unchanged, already-loaded resource snapshots.
  await update();
  const oldExport = button('Izvoz podataka').onPress, oldClosure = button('Zatvaranje naloga').onPress, oldRetention = retentionRow().props.onPress;
  const oldBack = tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
  await act(async () => { mockStopRouteFocus(); mockStartRouteFocus(); });
  await act(async () => { oldExport(); oldClosure(); oldBack(); oldRetention(); });
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
  expect(retentionRow().props.accessibilityState.expanded).toBe(false);
  const currentExport = button('Izvoz podataka').onPress;
  await act(async () => { currentExport(); currentExport(); });
  expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
  expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
});
// UI/UX pass 2026-10-07 (team T4c): a re-read that leaves the published rules on screen, no stills of the old set.
it('a re-read the person asks for (the pull) leaves the published rules on screen under the pull\'s own spinner; only the first read is a skeleton', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render(); await openRetention();
  expect(texts()).toContain('AI razgovori i izdvojeni podaci');
  const policyAgain = deferred(), executionAgain = deferred(); mockPolicy.mockReturnValueOnce(policyAgain.promise); mockExecution.mockReturnValueOnce(executionAgain.promise);
  // No standing word of refresh over the rules, and no spinner until the person pulls.
  expect(refreshPresses()).toHaveLength(0); expect(pull().refreshing).toBe(false);
  await act(async () => { pull().onRefresh(); });
  expect(texts()).toContain('AI razgovori i izdvojeni podaci'); expect(texts()).not.toContain('Učitavamo rokove čuvanja');
  // The spinner is the pull's own and stays while the read it started runs; a second pull while it runs asks for nothing more.
  expect(pull().refreshing).toBe(true);
  await act(async () => { pull().onRefresh(); }); expect(mockPolicy).toHaveBeenCalledTimes(2); expect(mockExecution).toHaveBeenCalledTimes(2);
  await act(async () => { policyAgain.resolve(ok(policy('fixture-v2'))); executionAgain.resolve(ok(execution('fixture-v2'))); });
  expect(pull().refreshing).toBe(false);
});
it('a re-read that fails keeps the last published rules and says they could not be renewed, with the pull as the retry', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render(); await openRetention();
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic'));
  await act(async () => pull().onRefresh());
  expect(texts()).toContain('AI razgovori i izdvojeni podaci'); expect(texts()).toContain('Rokovi čuvanja nisu osveženi. Prikazano je ono što je poslednji put učitano.');
  expect(texts()).not.toContain('private transport');
  expect(refreshPresses()).toHaveLength(0);
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2')));
  await act(async () => pull().onRefresh());
  expect(texts()).not.toContain('nisu osveženi');
});
it('a re-read of the automatic deletion that fails is said as not confirmed, never as the old yes', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render(); await openRetention();
  expect(texts()).toContain('Automatsko brisanje je omogućeno samo za napuštene razgovore sa asistentom');
  mockExecution.mockRejectedValueOnce(new Error('private transport diagnostic'));
  await act(async () => pull().onRefresh());
  expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena'); expect(texts()).not.toContain('brisanje je omogućeno');
  expect(texts()).not.toContain('private transport');
});
// UI/UX pass 2026-10-08 (F6, composition spec 4.15) and the approved draft of the product (P5): what only TELLS is a row with its mark and no arrow; what leads
// somewhere is a row with its arrow; the schedule opens in place; there are no section titles.
it('who sees what is a row that only tells, with the three points behind its "ⓘ": no press on the row, no arrow, and the points are not on the screen', async () => {
  await render();
  const row = tree.root.findAll(node => node.type === ListRow && node.props.title === 'Ko šta vidi')[0];
  expect(row).toBeDefined(); expect([row.props.onPress, row.props.arrow]).toEqual([undefined, undefined]);
  const info = tree.root.findAll(node => node.props.testID === 'who-sees-info' && Array.isArray(node.props.lines))[0];
  expect(info.props.title).toBe('Ko šta vidi');
  expect(info.props.lines).toEqual([
    'Opis objavljenog zadatka i njegovo približno mesto vide druge osobe.',
    'Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.',
    'Zadaci na daljinu nemaju adresu ni oznaku na mapi.']);
  for (const line of info.props.lines as string[]) expect([line, texts().includes(line)]).toEqual([line, false]);
});
it('is one list of rows with no section titles, in the order a person asks: who sees what, how long it is kept, the export, the blocked, the rules, the closure', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  const headings = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.variant === 'heading' && node.props.accessibilityRole === 'header');
  expect(headings).toHaveLength(0);
  const order = ['Ko šta vidi', 'Rokovi čuvanja', 'Izvoz podataka', 'Blokirane osobe', 'Pravila i saglasnosti', 'Zatvaranje naloga'].map(word => texts().indexOf(word));
  expect(order.every(at => at >= 0)).toBe(true); expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(texts()).not.toContain('Vidljivost'); expect(texts()).not.toContain('Tvoji podaci');
  expect(texts()).not.toMatch(/\bVerzija\b/);
});
it('starts with "Rokovi čuvanja" closed on every visit; it opens in place and closes again, and the screen stays where it is', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  expect(retentionRow().props.accessibilityState.expanded).toBe(false);
  expect(texts()).not.toContain('AI razgovori i izdvojeni podaci');
  await openRetention();
  expect(retentionRow().props.accessibilityState.expanded).toBe(true); expect(texts()).toContain('AI razgovori i izdvojeni podaci');
  await openRetention();
  expect(retentionRow().props.accessibilityState.expanded).toBe(false); expect(texts()).not.toContain('AI razgovori i izdvojeni podaci');
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  // Opened, then the screen is left and come back to: it is closed again.
  await openRetention(); expect(retentionRow().props.accessibilityState.expanded).toBe(true);
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(retentionRow().props.accessibilityState.expanded).toBe(false);
});
it('asks only for the states its own rows say (the blocked, the export, the rules), so the support inbox is not read here', async () => {
  await render();
  expect(mockUseHubStates).toHaveBeenCalled();
  for (const call of mockUseHubStates.mock.calls) expect(call[0]).toEqual(['blocked', 'export', 'legal']);
});
it('says the state of the rows that have one from what the app read, and nothing on a row whose state could not be read', async () => {
  mockHubStates = { blocked: { count: 2, more: false }, exportPhase: 'READY_AVAILABLE', legal: 'ACCEPTED' };
  await render();
  expect(button('Izvoz podataka').value).toBe('Spreman'); expect(button('Blokirane osobe').value).toBe('2'); expect(button('Pravila i saglasnosti').value).toBe('Prihvaćena');
  mockHubStates = { blocked: { count: 0, more: false }, exportPhase: 'NONE', legal: 'UNPUBLISHED' };
  await update();
  expect(button('Izvoz podataka').value).toBe('Nije tražen'); expect(button('Blokirane osobe').value).toBe('Nema'); expect(button('Pravila i saglasnosti').value).toBe('Još nisu objavljena');
  mockHubStates = {};
  await update();
  for (const label of ['Izvoz podataka', 'Blokirane osobe', 'Pravila i saglasnosti']) expect([label, button(label).value]).toEqual([label, undefined]);
  // A state that could not be read is not said, and no row says "nije dostupno" in its place (J4).
  expect(texts()).not.toMatch(/nije dostupn/i);
});
it('has no standing refresh while the first read runs or when nothing failed: a re-read is the pull of the screen', async () => {
  const first = deferred(); mockPolicy.mockReturnValueOnce(first.promise); await render(); await openRetention();
  expect(refreshPresses()).toHaveLength(0); expect(pull().onRefresh).toBeInstanceOf(Function);
  await act(async () => first.resolve(ok({ ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] })));
  expect(refreshPresses()).toHaveLength(0);
});
it('the only standing word is the retry of a read that FAILED, and its spoken label says what it renews', async () => {
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic')); await render(); await openRetention();
  expect(refresh().accessibilityLabel).toBe('Osveži rokove čuvanja');
  expect(refresh().accessibilityRole).toBe('button'); expect(refreshWord()).toBe('Osveži');
});
