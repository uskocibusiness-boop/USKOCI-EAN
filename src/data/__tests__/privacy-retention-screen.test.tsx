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
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'ActivityIndicator', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Privacy from '../../app/(app)/profil/privatnost';
import { InlineNote } from '../../ui/privacy/InlineNote';

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
/** The one refresh of the screen: a word at the end of the title of "Rokovi čuvanja" (a `Section` action), absent while the first read runs. */
const refreshPresses = () => tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Osveži rokove čuvanja');
const refresh = () => { expect(refreshPresses()).toHaveLength(1); return refreshPresses()[0].props; };
const refreshWord = () => refreshPresses()[0].findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children).join('');
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.clearAllMocks(); mockPolicy.mockReset(); mockExecution.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true;
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
  expect(texts()).toContain('Učitavamo rokove čuvanja'); expect(refreshPresses()).toHaveLength(0);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it('keeps unpublished retention explicit and opens closure through a separate review', async () => {
  await render(); expect(texts()).toContain('Potpun raspored rokova čuvanja još nije dostupan.');
  expect(texts()).toContain('Pregledaj dostupnost, obaveze i pravila čuvanja');
  expect(texts()).not.toContain('fixture duration');
  // Round 5 review: the two account-data rows sit right under the visibility, above the retention list, because support's
  // "Izvoz i zatvaranje naloga" leads here. The refresh is one word at the end of the title of the section it renews, so it
  // comes after them (UI/UX pass 2026-10-08, F6).
  expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType).map(node => node.props.accessibilityLabel).filter(label => label !== 'Nazad'))
    .toEqual(['Izvoz podataka', 'Zatvaranje naloga', 'Osveži rokove čuvanja']);
});
it('renders every published rule field and only the narrow matching capability', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render();
  expect(texts()).not.toContain('fixture duration');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'AI razgovori i izdvojeni podaci' }).props.onPress());
  for (const value of ['synthetic purpose', 'fixture duration', 'fixture trigger', 'fixture exception', 'fixture basis',
    'samo za napuštene AI razgovore', 'Ovo nije potvrda da je određeni razgovor obrisan']) expect(texts()).toContain(value);
  expect(texts()).not.toContain('P3_AI_ABANDONED_UNBOUND_V1'); expect(texts()).not.toContain('AI_VOLATILE');
});
it('opens one published rule at a time without turning the row into a data mutation', async () => {
  const value = policy();
  value.rules.push({ ...value.rules[0], dataClass: 'PROFILE_DATA', retentionPeriod: 'second fixture duration' });
  mockPolicy.mockResolvedValue(ok(value)); await render();
  const first = () => tree.root.findByProps({ accessibilityLabel: 'AI razgovori i izdvojeni podaci' });
  const second = () => tree.root.findByProps({ accessibilityLabel: 'Podaci profila' });
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
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'AI razgovori i izdvojeni podaci' }).props.onPress());
  expect(texts()).toContain('fixture duration');
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2')));
  await act(async () => refresh().onPress());
  // The version itself is no longer drawn on this screen (only the legal documents carry one): the proof that the new read
  // replaced the old one is that its rule is closed again and none of the old rule's text is on screen.
  expect(tree.root.findByProps({ accessibilityLabel: 'AI razgovori i izdvojeni podaci' }).props.accessibilityState.expanded).toBe(false);
  expect(texts()).not.toContain('fixture duration');
});
it('does not combine different policy versions into an admission', async () => {
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2'))); mockExecution.mockResolvedValue(ok(execution('fixture-v1'))); await render();
  expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena');
  expect(texts()).not.toContain('brisanje je omogućeno');
});
it.each(['policy', 'execution'])('keeps the other reader usable after %s fails without exposing transport details', async failed => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution()));
  (failed === 'policy' ? mockPolicy : mockExecution).mockRejectedValueOnce(new Error('private transport diagnostic'));
  await render(); expect(texts()).not.toContain('private transport'); expect(texts()).not.toContain('brisanje je omogućeno');
  if (failed === 'execution') {
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'AI razgovori i izdvojeni podaci' }).props.onPress());
    expect(texts()).toContain('fixture duration');
  }
  await act(async () => refresh().onPress());
  expect(mockPolicy).toHaveBeenCalledTimes(2); expect(mockExecution).toHaveBeenCalledTimes(2);
});
it('opens existing export once after an explicit double tap', async () => {
  await render(); const open = button('Izvoz podataka').onPress;
  await act(async () => { open(); open(); }); expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
});
it.each(['account', 'incarnation', 'blur'])('retires retained navigation after %s changes', async change => {
  await render(); const open = button('Izvoz podataka').onPress;
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); mockFocused = true; await update(); }
  await act(async () => open()); expect(mockRouter.navigate).not.toHaveBeenCalled();
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode retires nothing: retained navigation still opens the export', async () => {
  await render(); const open = button('Izvoz podataka').onPress; mockIntent = 'uskocer';
  await act(async () => open()); expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
});
it.each(['account', 'blur'])('discards late schedule success after %s changes', async change => {
  const old = deferred(); mockPolicy.mockReturnValueOnce(old.promise); await render();
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
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic')); await render();
  expect(texts()).toContain('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
  const alert = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'alert');
  expect(alert.map(node => node.props.children)).toContain('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
});
// Round 5 review: the retry of a failed retention read stands with its own section, and there is one refresh on screen. Since the
// UI/UX pass 2026-10-08 the retry is the word at the end of the title of the section whose note says it failed.
it('a failed retention read has its retry in the title of its own section, over its own note', async () => {
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic')); await render();
  const note = tree.root.findAllByType(InlineNote).find(node => node.props.tone === 'danger')!;
  expect(note.props.children).toBe('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
  const section = note.parent!;
  expect(section.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Osveži rokove čuvanja')).toHaveLength(1);
  expect(section.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'header').map(node => node.children.join(''))).toEqual(['Rokovi čuvanja']);
  expect(refreshPresses()).toHaveLength(1);
  mockPolicy.mockResolvedValue(ok(policy())); await act(async () => refresh().onPress());
  expect(tree.root.findAllByType(InlineNote).filter(node => node.props.tone === 'danger')).toHaveLength(0);
});
it('a failed deletion read takes the danger note; a version mismatch stays a plain note', async () => {
  mockExecution.mockRejectedValueOnce(new Error('private transport diagnostic')); await render();
  const block = () => tree.root.findAllByType(InlineNote).find(node => node.props.children === 'Dostupnost automatskog brisanja nije potvrđena.')!;
  expect(block().props.tone).toBe('danger');
  expect(block().props.alert).toBe(true);
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2'))); mockExecution.mockResolvedValue(ok(execution('fixture-v1')));
  await act(async () => refresh().onPress());
  expect(block().props.tone).toBe('neutral'); expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena');
});
it.each(['closure', 'export', 'back'])('establishes usable %s after reads finish before route focus, without another read', async action => {
  mockDelayRouteFocus = true; await render();
  expect(texts()).toContain('Potpun raspored rokova čuvanja još nije dostupan.');
  expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
  await act(async () => mockStartRouteFocus());
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
  const oldExport = button('Izvoz podataka').onPress, oldClosure = button('Zatvaranje naloga').onPress;
  const oldBack = tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
  await act(async () => { mockStopRouteFocus(); mockStartRouteFocus(); });
  await act(async () => { oldExport(); oldClosure(); oldBack(); });
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
  const currentExport = button('Izvoz podataka').onPress;
  await act(async () => { currentExport(); currentExport(); });
  expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
  expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
});
// UI/UX pass 2026-10-07 (team T4c): plain groups, a re-read that leaves the published rules on screen, no stills of the old set.
it('names its groups in plain words: who sees what, your data, how long it is kept', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  expect(texts()).toContain('Ko šta vidi'); expect(texts()).toContain('Tvoji podaci'); expect(texts()).toContain('Rokovi čuvanja');
  expect(texts()).not.toContain('Vidljivost');
  expect(texts()).not.toMatch(/\bVerzija\b/);
});
it('a re-read the person asks for leaves the published rules on screen under the refresh at work; only the first read is a skeleton', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render();
  expect(texts()).toContain('AI razgovori i izdvojeni podaci');
  const policyAgain = deferred(), executionAgain = deferred(); mockPolicy.mockReturnValueOnce(policyAgain.promise); mockExecution.mockReturnValueOnce(executionAgain.promise);
  expect(refreshWord()).toBe('Osveži');
  await act(async () => { refresh().onPress(); });
  expect(texts()).toContain('AI razgovori i izdvojeni podaci'); expect(texts()).not.toContain('Učitavamo rokove čuvanja');
  // The word says it is at work, and a second press while it is at work asks for nothing more.
  expect(refreshWord()).toBe('Osvežavamo…');
  await act(async () => { refresh().onPress(); }); expect(mockPolicy).toHaveBeenCalledTimes(2); expect(mockExecution).toHaveBeenCalledTimes(2);
  await act(async () => { policyAgain.resolve(ok(policy('fixture-v2'))); executionAgain.resolve(ok(execution('fixture-v2'))); });
  expect(refreshWord()).toBe('Osveži');
});
it('a re-read that fails keeps the last published rules and says they could not be renewed, with the refresh as the retry', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic'));
  await act(async () => refresh().onPress());
  expect(texts()).toContain('AI razgovori i izdvojeni podaci'); expect(texts()).toContain('Rokovi čuvanja nisu osveženi. Prikazano je ono što je poslednji put učitano.');
  expect(texts()).not.toContain('private transport');
  expect(refreshPresses()).toHaveLength(1);
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2')));
  await act(async () => refresh().onPress());
  expect(texts()).not.toContain('nisu osveženi');
});
it('a re-read of the automatic deletion that fails is said as not confirmed, never as the old yes', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render();
  expect(texts()).toContain('Automatsko brisanje je omogućeno samo za napuštene AI razgovore');
  mockExecution.mockRejectedValueOnce(new Error('private transport diagnostic'));
  await act(async () => refresh().onPress());
  expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena'); expect(texts()).not.toContain('brisanje je omogućeno');
  expect(texts()).not.toContain('private transport');
});
// UI/UX pass 2026-10-08 (F6, composition spec 4.15): what only TELLS is a line with no picture and no arrow; what leads somewhere is a
// row with its arrow; the sections are named by the system's heading, and the two data rows stand on the screen's one edge.
it('who sees what are two lines that tell: no press, no picture, no arrow, and nothing that looks like a link', async () => {
  await render();
  for (const title of ['Javni podaci zadatka', 'Lokacija i kontakt']) {
    const rows = tree.root.findAll(node => node.props.title === title);
    expect(rows).toHaveLength(1);
    expect([title, rows[0].props.onPress, rows[0].props.leading, rows[0].props.arrow]).toEqual([title, undefined, undefined, undefined]);
  }
});
it('names the four groups with the system heading, in the order a person asks', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  const headings = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.variant === 'heading' && node.props.accessibilityRole === 'header')
    .map(node => node.children.join(''));
  expect(headings).toEqual(['Ko šta vidi', 'Tvoji podaci', 'Rokovi čuvanja', 'Automatsko brisanje napuštenih razgovora']);
});
it('keeps the refresh out of the way until there is something to renew, and says in its spoken label what it renews', async () => {
  const first = deferred(); mockPolicy.mockReturnValueOnce(first.promise); await render();
  expect(refreshPresses()).toHaveLength(0);
  await act(async () => first.resolve(ok({ ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] })));
  expect(refresh().accessibilityLabel).toBe('Osveži rokove čuvanja');
  expect(refresh().accessibilityRole).toBe('button');
});
