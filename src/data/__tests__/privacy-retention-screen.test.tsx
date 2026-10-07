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
  expect(texts()).toContain('Učitavamo rokove čuvanja'); expect(button('Osveži stanje').disabled).toBe(true);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it('keeps unpublished retention explicit and opens closure through a separate review', async () => {
  await render(); expect(texts()).toContain('Potpun raspored rokova čuvanja još nije dostupan.');
  expect(texts()).toContain('Pregledaj dostupnost, obaveze i pravila čuvanja');
  expect(texts()).not.toContain('fixture duration');
  // Round 5 review: the order pinned the old layout; the two account-data rows now sit right under the visibility, above
  // the retention list, because support's "Izvoz i zatvaranje naloga" leads here. The refresh closes the read blocks.
  expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType).map(node => node.props.accessibilityLabel).filter(label => label !== 'Nazad'))
    .toEqual(['Izvoz podataka', 'Zatvaranje naloga', 'Osveži stanje']);
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
  await act(async () => button('Osveži stanje').onPress());
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
  await act(async () => button('Osveži stanje').onPress());
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
// Round 5 review: the retry of a failed retention read stands right under its note, and there is one refresh on screen.
it('a failed retention read has its retry right under its own note', async () => {
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic')); await render();
  const note = tree.root.findAllByType(InlineNote).find(node => node.props.tone === 'danger')!;
  expect(note.props.children).toBe('Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.');
  const section = note.parent!;
  expect(section.findAllByProps({ label: 'Osveži stanje' }).length).toBeGreaterThan(0);
  expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Osveži stanje')).toHaveLength(1);
});
it('a failed deletion read takes the danger note; a version mismatch stays a plain note', async () => {
  mockExecution.mockRejectedValueOnce(new Error('private transport diagnostic')); await render();
  const block = () => tree.root.findAllByType(InlineNote).find(node =>
    node.findAll(child => child.type === 'T' as React.ElementType &&
      child.props.children === 'Automatsko brisanje napuštenih razgovora').length === 1)!;
  expect(block().props.tone).toBe('danger');
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2'))); mockExecution.mockResolvedValue(ok(execution('fixture-v1')));
  await act(async () => button('Osveži stanje').onPress());
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
  await act(async () => { button('Osveži stanje').onPress(); });
  expect(texts()).toContain('AI razgovori i izdvojeni podaci'); expect(texts()).not.toContain('Učitavamo rokove čuvanja');
  expect(button('Osveži stanje')).toMatchObject({ disabled: true, loading: true });
  await act(async () => { button('Osveži stanje').onPress(); }); expect(mockPolicy).toHaveBeenCalledTimes(2);
  await act(async () => { policyAgain.resolve(ok(policy('fixture-v2'))); executionAgain.resolve(ok(execution('fixture-v2'))); });
  expect(button('Osveži stanje')).toMatchObject({ disabled: false, loading: false });
});
it('a re-read that fails keeps the last published rules and says they could not be renewed, with the refresh as the retry', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); await render();
  mockPolicy.mockRejectedValueOnce(new Error('private transport diagnostic'));
  await act(async () => button('Osveži stanje').onPress());
  expect(texts()).toContain('AI razgovori i izdvojeni podaci'); expect(texts()).toContain('Rokovi čuvanja nisu osveženi. Prikazano je ono što je poslednji put učitano.');
  expect(texts()).not.toContain('private transport');
  expect(tree.root.findAll(node => node.type === 'Press' as React.ElementType && node.props.accessibilityLabel === 'Osveži stanje')).toHaveLength(1);
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2')));
  await act(async () => button('Osveži stanje').onPress());
  expect(texts()).not.toContain('nisu osveženi');
});
