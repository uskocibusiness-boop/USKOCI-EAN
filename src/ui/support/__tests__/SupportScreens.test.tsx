import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SupportDetail, SupportIntent, SupportKind, SupportReference } from '../../../data/supportCaseTypes';
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000001', K = '30000000-0000-4000-8000-000000000001', E = '40000000-0000-4000-8000-000000000001';
const D = '50000000-0000-4000-8000-000000000001', AP = '60000000-0000-4000-8000-000000000001';
const time = '2026-09-13T05:00:00Z';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true, mockAppState = 'active';
const mockListeners = new Set<(value: string) => void>();
const mockBack: { handlers: (() => boolean)[] } = { handlers: [] };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
const mockService = { capabilities: jest.fn(), inbox: jest.fn(), detail: jest.fn(), loadPending: jest.fn(), prepare: jest.fn(),
  submit: jest.fn(), recover: jest.fn(), cancel: jest.fn(), markRead: jest.fn() }, mockAgreements = jest.fn();
jest.mock('../../../data/supportCaseClientService', () => ({ get supportCaseClientService() { return mockService; } }));
jest.mock('../../../data/agreementClientService', () => ({ agreementClientService: { mojiDogovori: (...args: unknown[]) => mockAgreements(...args) } }));
jest.mock('../../../data/supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (fn: () => void) => require('react').useEffect(() => mockFocused ? fn() : undefined, [fn, mockFocused]) }));
jest.mock('react-native', () => { const rn = jest.requireActual('react-native'); return new Proxy(rn, { get(target, key) {
  if (key === 'AppState') return { get currentState() { return mockAppState; }, addEventListener: (_: string, fn: (value: string) => void) => {
    mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) }; } };
  if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
    mockBack.handlers.push(handler); return { remove: () => { mockBack.handlers = mockBack.handlers.filter(item => item !== handler); } }; } };
  return ['View', 'TextInput', 'ActivityIndicator', 'KeyboardAvoidingView', 'ScrollView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
// The screen renders its footer (the one primary action) as a child, as the real one pins it under the scroll.
jest.mock('../../settings/SettingsPresentation', () => ({ SettingsAction: 'Action', SettingsGroup: 'Group', SettingsIntro: 'Intro',
  SettingsPanel: 'Panel', SettingsRow: 'Row', SettingsInfo: 'Info', SettingsText: 'T',
  SettingsScreen: ({ children, footer, ...props }: any) => require('react').createElement('Screen', props, children, footer) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
import { SupportNewScreen, supportRouteReference } from '../SupportNewScreen';
import { SupportDetailScreen } from '../SupportDetailScreen';
import { SupportInboxScreen } from '../SupportInboxScreen';
import { SupportReferenceView } from '../SupportReferenceView';
import { ConfirmSheet } from '../../system/ConfirmSheet';
import { InlineNote } from '../../privacy/InlineNote';
const ok = (podatak: unknown) => ({ ok: true, podatak }), unknown = { ok: false, kod: 'UNKNOWN', poruka: 'Sačekaj proveru.' };
const journal = (kind: SupportKind = 'CREATE'): SupportIntent => ({ version: 1, accountId: A, clientRequestId: K, kind, caseId: kind === 'CREATE' ? null : C,
  expectedRevision: kind === 'CREATE' ? null : 2, inputSha256: 'a'.repeat(64) });
const absent = () => ok({ accountId: A, clientRequestId: K, state: 'ABSENT', kind: null, caseId: null, expectedRevision: null, inputSha256: null, receipt: null, authoritative: true });
function detail(): SupportDetail { return { accountId: A, case: { id: C, caseNumber: '71', authorAccountId: A, title: 'Problem sa prikazom',
  desiredOutcome: 'Da razjasnimo', channel: 'SERVICE', topic: 'TECHNICAL', status: 'IN_REVIEW', revision: 2, lastSequence: '9', createdAt: time, updatedAt: time, context: {} },
  viewerRole: 'AUTHOR', operatorAvailable: false, allowedActions: ['AUTHOR_REPLY', 'APPEAL'],
  events: [{ id: E, caseId: C, sequence: '2', kind: 'AUTHOR_REPLY', authorRole: 'AUTHOR', body: 'Privatna dopuna', createdAt: time, decisionId: null, appealId: null }],
  decisions: [{ id: D, caseId: C, caseRevision: 2, outcome: 'REJECTED', reasonCode: 'REVIEWED', explanation: 'Pregledana odluka', effect: 'NONE', evidenceIds: [], priorDecisionId: null, createdAt: time, reviewType: 'INITIAL' }],
  appeals: [], evidence: [], nextAfterSequence: '2', authoritative: true }; }
let tree: ReactTestRenderer, screen: 'NEW' | 'DETAIL' | 'INBOX' = 'NEW', reference: SupportReference | null | 'INVALID' = null, routeKey = true;
const element = () => <React.Fragment key={routeKey ? `${mockSession.user.id}:${mockSession.accountRevision}` : 'MOUNTED'}>
  {screen === 'NEW' ? <SupportNewScreen reference={reference} /> : screen === 'DETAIL' ? <SupportDetailScreen caseId={C} /> : <SupportInboxScreen />}
</React.Fragment>;
const render = async () => { await act(async () => { tree = create(element()); }); };
const update = async () => { await act(async () => tree.update(element())); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const actions = (label: string) => tree.root.findAllByProps({ label });
const hostPress = (label: string) => tree.root.find(node => node.type === ('Press' as React.ElementType)
  && node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label).props;
const field = (label: string) => tree.root.findByProps({ accessibilityLabel: label }).props;
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(n => n.children.filter(x => typeof x === 'string')).join(' ');
async function type(label: string, value: string) { await act(async () => field(label).onChangeText(value)); }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => {
  jest.clearAllMocks(); Object.values(mockService).forEach(fn => fn.mockReset()); mockAgreements.mockReset();
  screen = 'NEW'; reference = null; routeKey = true; mockSession = { user: { id: A }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockAppState = 'active';
  mockBack.handlers = [];
  mockService.capabilities.mockResolvedValue(ok({ accountId: A, operatorAvailable: false, canCreate: true, authoritative: true }));
  mockService.loadPending.mockResolvedValue(null); mockService.recover.mockResolvedValue(absent()); mockService.submit.mockResolvedValue(unknown); mockService.cancel.mockResolvedValue(unknown);
  mockService.detail.mockResolvedValue(ok(detail())); mockService.markRead.mockResolvedValue(ok({ sequence: '9' }));
  mockService.inbox.mockResolvedValue(ok({ accountId: A, mode: 'OWN', operatorAvailable: false, cases: [], nextBeforeCaseNumber: null, authoritative: true }));
  mockService.prepare.mockImplementation((kind: SupportKind, caseId: string | null, revision: number | null, payload: object) => ({
    intent: { ...journal(kind), caseId, expectedRevision: revision }, payloadText: JSON.stringify(payload) }));
  mockAgreements.mockResolvedValue([{ id: C, verzija: 4, naslov: 'Stvarni sopstveni Dogovor' }]);
});
afterEach(async () => { await act(async () => tree?.unmount()); expect(mockListeners.size).toBe(0); expect(mockBack.handlers).toHaveLength(0); });

it('uses a private create form with optional outcome, scalar limits and no safety category replacement', async () => {
  await render(); expect(text()).toContain('Zahtev vide podnosilac'); expect(actions('Pošalji privatni zahtev')[0].props.disabled).toBe(true);
  // A grey send button says why it is grey (owner rule, 2026-09-23): the reason is the button's own.
  expect(action('Pošalji privatni zahtev').reason).toBe('Za slanje su potrebni naslov i opis.');
  await type('Kratak naslov', 'Pomoć'); await type('Opis zahteva', '🙂'.repeat(4000));
  expect(action('Pošalji privatni zahtev').disabled).toBe(false); expect(action('Pošalji privatni zahtev').reason).toBeNull();
  await type('Opis zahteva', '🙂'.repeat(4001));
  expect(action('Pošalji privatni zahtev').disabled).toBe(true); expect(text()).toContain('Skrati tekst');
  expect(mockService.prepare).not.toHaveBeenCalled(); expect(actions('Bezbednost')).toHaveLength(0);
});
it('a topic that needs a Dogovor says so under the grey send button until one is chosen', async () => {
  await render(); await act(async () => hostPress('Tema zahteva').onPress()); await act(async () => action('Prijava nedolaska').onPress());
  await type('Kratak naslov', 'Nedolazak'); await type('Opis zahteva', 'Nisam našao saradnika.');
  expect(action('Pošalji privatni zahtev').disabled).toBe(true); expect(action('Pošalji privatni zahtev').reason).toContain('Izaberi Dogovor iznad');
  await act(async () => action('Izaberi Dogovor').onPress()); await act(async () => action('Stvarni sopstveni Dogovor').onPress());
  expect(action('Pošalji privatni zahtev').disabled).toBe(false); expect(action('Pošalji privatni zahtev').reason).toBeNull();
});
it('does not submit a retained button after the visible draft changes', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Prva verzija');
  const retained = action('Pošalji privatni zahtev').onPress; await type('Opis zahteva', 'Prikazana nova verzija');
  await act(async () => retained()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Pošalji privatni zahtev').onPress()); expect(mockService.prepare.mock.calls[0][3].body).toBe('Prikazana nova verzija');
});
it('selects a current owned Agreement and serializes only its id and revision on an explicit send', async () => {
  await render(); await act(async () => hostPress('Tema zahteva').onPress()); await act(async () => action('Prijava nedolaska').onPress());
  await type('Kratak naslov', 'Nedolazak'); await type('Opis zahteva', 'Nisam našao saradnika.');
  expect(action('Pošalji privatni zahtev').disabled).toBe(true); expect(mockAgreements).not.toHaveBeenCalled();
  await act(async () => action('Izaberi Dogovor').onPress()); await act(async () => action('Stvarni sopstveni Dogovor').onPress());
  await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(mockService.prepare).toHaveBeenCalledWith('CREATE', null, null, { channel: 'TASK', topic: 'NO_SHOW', title: 'Nedolazak',
    body: 'Nisam našao saradnika.', desiredOutcome: null, context: { kind: 'AGREEMENT', id: C, revision: 4 }, evidence: [] }, expect.objectContaining({ accountId: A, accountRevision: 1 }));
  expect(mockService.submit).toHaveBeenCalledTimes(1);
});
it('preserves only the selected message as evidence when its request is attached to a current Agreement', async () => {
  reference = { kind: 'AGREEMENT_MESSAGE', id: E, revision: 2 }; await render();
  await act(async () => hostPress('Tema zahteva').onPress()); await act(async () => action('Prijava nedolaska').onPress()); await act(async () => action('Izaberi Dogovor').onPress());
  await act(async () => action('Stvarni sopstveni Dogovor').onPress());
  await type('Kratak naslov', 'Nedolazak'); await type('Opis zahteva', 'Pogledaj izabranu poruku.');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(mockService.prepare.mock.calls[0][3]).toMatchObject({ context: { kind: 'AGREEMENT', id: C, revision: 4 }, evidence: [reference] });
});
it('explicitly removing selected evidence also removes its standalone message context and fences an old send', async () => {
  reference = { kind: 'GROUP_MESSAGE', id: E, revision: null }; await render();
  await type('Kratak naslov', 'Pomoć'); await type('Opis zahteva', 'Samo moj opis.'); const old = action('Pošalji privatni zahtev').onPress;
  await act(async () => action('Ukloni izabranu poruku iz zahteva').onPress()); await act(async () => old()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Pošalji privatni zahtev').onPress()); expect(mockService.prepare.mock.calls[0][3]).toMatchObject({ context: null, evidence: [] });
});
it('keeps in-memory text disabled during unknown readback, then permits only explicit same-command replay', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Sačuvaj ovaj RAM tekst');
  const lateChange = field('Opis zahteva').onChangeText;
  await act(async () => action('Pošalji privatni zahtev').onPress()); expect(field('Opis zahteva').editable).toBe(false);
  await act(async () => { lateChange('Late native change'); field('Opis zahteva').onChangeText('Disabled native change'); });
  expect(field('Opis zahteva').value).toBe('Sačuvaj ovaj RAM tekst');
  await act(async () => action('Proveri ishod').onPress());
  expect(field('Opis zahteva').value).toBe('Sačuvaj ovaj RAM tekst'); expect(mockService.submit).toHaveBeenCalledTimes(1);
  const replay = tree.root.findAllByType('Action' as React.ElementType).find(n => /Pošalji ponovo|Ponovo pošalji/.test(n.props.label));
  expect(replay).toBeDefined();
});
it('restores only opaque unknown state after remount and does not replay the previous narrative', async () => {
  mockService.loadPending.mockResolvedValue(journal()); await render();
  expect(field('Opis zahteva').value).toBe(''); expect(field('Opis zahteva').editable).toBe(false);
  expect(text()).toContain('Potvrda još nije pronađena'); expect(mockService.submit).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Action' as React.ElementType).some(n => /Pošalji ponovo|Ponovo pošalji/.test(n.props.label))).toBe(false);
});
it.each(['blur', 'background', 'account ABA'] as const)('clears private form and fences retained submit on %s', async change => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Privatni RAM tekst'); const retained = action('Pošalji privatni zahtev').onPress;
  if (change === 'blur') { mockFocused = false; await update(); }
  else if (change === 'background') await act(async () => { mockAppState = 'background'; mockListeners.forEach(fn => fn('background')); });
  else { mockSession = { user: { id: A }, accountRevision: 3 }; await update(); }
  await act(async () => retained()); expect(mockService.submit).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Opis zahteva' }).every(n => n.props.value === '')).toBe(true);
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode keeps the private form and lets the retained submit go out', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Privatni RAM tekst'); const retained = action('Pošalji privatni zahtev').onPress;
  mockIntent = 'uskocer'; await update();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Opis zahteva' }).some(n => n.props.value === 'Privatni RAM tekst')).toBe(true);
  await act(async () => retained()); expect(mockService.submit).toHaveBeenCalledTimes(1);
});
it.each(['account', 'account ABA', 'blur/focus', 'context'] as const)('a reused mounted screen resets every local draft on %s without relying on its route key', async change => {
  routeKey = false; reference = { kind: 'AGREEMENT', id: C, revision: 2 }; await render();
  await type('Kratak naslov', 'Stari naslov'); await type('Opis zahteva', 'Privatni tekst prethodne inkarnacije'); await type('Željeni ishod', 'Stari ishod');
  await act(async () => action('Izaberi Dogovor').onPress());
  expect(action('Pošalji privatni zahtev').disabled).toBe(false);
  const retained = action('Pošalji privatni zahtev').onPress;
  if (change === 'blur/focus') { mockFocused = false; await update(); mockFocused = true; }
  else if (change === 'account') mockSession = { user: { id: B }, accountRevision: 2 };
  else if (change === 'account ABA') mockSession = { user: { id: A }, accountRevision: 3 };
  else reference = { kind: 'TASK_REVIEW', id: D, revision: null };
  await update(); await act(async () => retained()); expect(mockService.prepare).not.toHaveBeenCalled();
  for (const label of ['Kratak naslov', 'Opis zahteva', 'Željeni ishod']) expect(field(label).value).toBe('');
  expect(actions('Stvarni sopstveni Dogovor')).toHaveLength(0);
  expect(action('Pošalji privatni zahtev').disabled).toBe(true);
  if (change === 'context') {
    await act(async () => hostPress('Tema zahteva').onPress());
    expect(action('Pregled odluke o objavi').selected).toBe(true);
  }
});
it('does not expose a previous account case from a late detail read', async () => {
  screen = 'DETAIL'; const held = deferred(); mockService.detail.mockReturnValueOnce(held.promise); await render();
  mockSession = { user: { id: B }, accountRevision: 2 }; mockService.detail.mockResolvedValue({ ok: false, poruka: 'Nije dostupno.' }); await update();
  await act(async () => held.resolve(ok(detail()))); expect(text()).not.toContain('Privatna dopuna');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Tekst poruke' })).toHaveLength(0);
});
it('author role never renders operator controls despite a contradictory allowedActions list', async () => {
  screen = 'DETAIL'; mockService.detail.mockResolvedValue(ok({ ...detail(), operatorAvailable: true,
    allowedActions: ['CLAIM', 'DECIDE', 'CLOSE', 'OPERATOR_REPLY', 'AUTHOR_REPLY'] })); await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Tekst poruke' })).toHaveLength(1);
  for (const label of ['Preuzmi predmet', 'Donesi odluku', 'Zatvori obrađeni predmet', 'Zatraži dopunu']) expect(actions(label)).toHaveLength(0);
  expect(field('Tekst poruke').placeholder).toBe('Napiši dopunu…');
  expect(mockService.submit).not.toHaveBeenCalled();
});
it('opens a real decision appeal and submits its exact id only after the author writes a reason', async () => {
  screen = 'DETAIL'; await render();
  await act(async () => action('Zatraži ponovni pregled').onPress()); expect(text()).toContain('ne predstavlja nezavisan žalbeni organ');
  await type('Razlog i nove činjenice', 'Nova činjenica'); await act(async () => action('Pošalji zahtev za ponovni pregled').onPress());
  expect(mockService.prepare).toHaveBeenCalledWith('APPEAL', C, 2, { decisionId: D, body: 'Nova činjenica' }, expect.objectContaining({ accountId: A }));
});
it('does not submit a retained reply after its draft has changed, and sends the words on screen', async () => {
  screen = 'DETAIL'; await render();
  expect(field('Pošalji poruku').disabled).toBe(true); expect(field('Pošalji poruku').accessibilityHint).toBe('Unesi tekst pre slanja.');
  await type('Tekst poruke', 'Uneta dopuna');
  expect(field('Pošalji poruku').disabled).toBe(false); expect(field('Pošalji poruku').accessibilityHint).toBeUndefined();
  const retained = field('Pošalji poruku').onPress; await type('Tekst poruke', 'Promenjena dopuna');
  await act(async () => retained()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => field('Pošalji poruku').onPress());
  expect(mockService.prepare).toHaveBeenCalledWith('AUTHOR_REPLY', C, 2, { body: 'Promenjena dopuna', evidence: [] }, expect.objectContaining({ accountId: A }));
  // The outcome is unknown here: the words stay in the field, not editable, until a readback settles it.
  expect(field('Tekst poruke').value).toBe('Promenjena dopuna'); expect(field('Tekst poruke').editable).toBe(false);
});
it('operator reconsideration uses only the actual server appeal and does not infer independent review', async () => {
  screen = 'DETAIL'; mockService.detail.mockResolvedValue(ok({ ...detail(), viewerRole: 'OPERATOR', operatorAvailable: true, allowedActions: ['DECIDE_APPEAL'],
    appeals: [{ id: AP, caseId: C, decisionId: D, status: 'IN_REVIEW', decisionResultId: null, createdAt: time }] })); await render();
  await act(async () => action('Odluči o ponovnom pregledu').onPress()); await type('Oznaka razloga', 'RECHECKED'); await type('Obrazloženje', 'Pregledan poslati dokaz');
  await act(async () => action('Sačuvaj odluku').onPress()); expect(mockService.prepare).toHaveBeenCalledWith('DECIDE_APPEAL', C, 2,
    { outcome: 'ACCEPTED', reasonCode: 'RECHECKED', body: 'Pregledan poslati dokaz', evidenceIds: [], appealId: AP }, expect.any(Object));
});
it('a decision can cite only a selected evidence id from this visible case page', async () => {
  screen = 'DETAIL'; const evidence = { id: B, eventId: E, createdAt: time, reference: { kind: 'AGREEMENT_MESSAGE', id: K, revision: 2,
    content: { agreementId: C, body: 'Samo namerno izabrana poruka', createdAt: time, mine: true } } };
  mockService.detail.mockResolvedValue(ok({ ...detail(), viewerRole: 'OPERATOR', operatorAvailable: true,
    allowedActions: ['DECIDE'], evidence: [evidence] })); await render(); await act(async () => action('Donesi odluku').onPress());
  await type('Oznaka razloga', 'REVIEWED'); await type('Obrazloženje', 'Pogledan označen dokaz');
  const stale = action('Sačuvaj odluku').onPress; await act(async () => action('Izabrana poruka iz Dogovora').onPress());
  await act(async () => stale()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Sačuvaj odluku').onPress()); expect(mockService.prepare.mock.calls[0][3].evidenceIds).toEqual([B]);
});
it('marks only the displayed page explicitly and never uses the unseen case lastSequence', async () => {
  screen = 'DETAIL'; await render(); expect(mockService.markRead).not.toHaveBeenCalled();
  await act(async () => action('Označi prikazane događaje kao pročitane').onPress());
  expect(mockService.markRead).toHaveBeenCalledWith(C, '2', expect.any(Object)); expect(text()).toContain('Prikazani događaji');
});
it('a person\'s own inbox has no intro: the list explains itself, and its one action is in the footer', async () => {
  screen = 'INBOX'; await render();
  expect(tree.root.findAllByType('Intro' as React.ElementType)).toHaveLength(0);
  expect(text()).not.toContain('Prati svaki odgovor');
  // The empty state keeps its sentence and has no action of its own; the brand action is in the frame's footer.
  expect(text()).toContain('Još nema primljenih zahteva');
  expect(actions('Novi zahtev')).toHaveLength(1);
});
it('shows the operator inbox entry only when the server grants it to this account', async () => {
  screen = 'INBOX'; await render(); expect(actions('Otvori sve zahteve')).toHaveLength(0);
  mockService.capabilities.mockResolvedValue(ok({ accountId: A, operatorAvailable: true, canCreate: true, authoritative: true }));
  await act(async () => action('Osveži zahteve').onPress()); expect(actions('Otvori sve zahteve')).toHaveLength(1);
  expect(mockService.submit).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});
it.each([{ contextKind: 'TASK', contextId: C }, { contextKind: 'TASK_REVIEW', contextId: C, contextRevision: '1' },
  { contextKind: ['TASK'], contextId: C, contextRevision: '1' }, { contextKind: 'AGREEMENT', contextId: C, contextRevision: '01' },
  { contextKind: 'TASK', contextId: 'https://private.example', contextRevision: '1' }])('rejects malformed route references %#', params => {
  expect(supportRouteReference(params)).toBe('INVALID'); expect(mockService.submit).not.toHaveBeenCalled();
});
it('renders only strictly decoded selected media with case scope, never a raw object or URL', async () => {
  const value = { kind: 'TASK' as const, id: D, revision: 2, content: { title: 'Izabrani Zadatak', description: 'Opis dokaza', status: 'PUBLISHED', createdAt: time,
    executionMode: 'STATIONARY', countryCode: 'RS', submitterRole: 'REQUESTER', media: [{ assetId: E, sha256: 'a'.repeat(64), width: 1200, height: 900 }] } };
  await act(async () => { tree = create(<SupportReferenceView value={value} caseId={C} />); });
  expect(tree.root.findByType('AuthorizedPhoto' as React.ElementType).props).toMatchObject({ assetId: E, caseId: C });
  expect(text()).toContain('Opis dokaza');
  await act(async () => tree.update(<SupportReferenceView value={{ ...value, content: { ...value.content, privateAddress: 'DO NOT RENDER' } }} caseId={C} />));
  expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0); expect(text()).not.toContain('DO NOT RENDER');
  expect(text()).toContain('nije potvrđen');
});
it('renders a photo-only selected private message through case authorization without opening the Agreement or its other media', async () => {
  const value = { kind: 'AGREEMENT_MESSAGE' as const, id: E, revision: 3, content: { agreementId: D, body: '', createdAt: time, mine: true,
    media: [{ assetId: K, sha256: 'a'.repeat(64), width: 1600, height: 900 }] } };
  await act(async () => { tree = create(<SupportReferenceView value={value} caseId={C} />); });
  const image = tree.root.findByType('AuthorizedPhoto' as React.ElementType).props;
  expect(image).toMatchObject({ assetId: K, caseId: C }); expect(image.agreementId).toBeUndefined(); expect(image.messageId).toBeUndefined();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(text()).not.toContain(D);
});
// Round 5 (owner step 11b).
it('Back with typed words asks first; keeping them keeps them, and an empty form leaves at once', async () => {
  await render(); await type('Opis zahteva', 'Nesačuvan tekst');
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  const sheet = tree.root.findByType(ConfirmSheet);
  expect(sheet.props).toMatchObject({ title: 'Odbaciti zahtev?', message: 'Uneti tekst neće biti sačuvan.', confirmLabel: 'Odbaci',
    cancelLabel: 'Nastavi pisanje', tone: 'danger' });
  await act(async () => sheet.findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(field('Opis zahteva').value).toBe('Nesačuvan tekst');
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  await type('Opis zahteva', '');
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(mockRouter.replace).toHaveBeenCalledWith('/podrska');
});
it('the topics are one radio group: the chosen one is said as checked, never by a prefix', async () => {
  await render();
  expect(hostPress('Tema zahteva')).toMatchObject({ accessibilityState: { expanded: false }, accessibilityValue: { text: 'Tehnička pomoć' } });
  expect(tree.root.findAllByProps({ accessibilityRole: 'radiogroup' })).toHaveLength(0);
  await act(async () => hostPress('Tema zahteva').onPress());
  expect(hostPress('Tema zahteva').accessibilityState.expanded).toBe(true);
  expect(action('Tehnička pomoć')).toMatchObject({ kind: 'radio', selected: true });
  await act(async () => action('Drugo').onPress());
  expect(hostPress('Tema zahteva')).toMatchObject({ accessibilityState: { expanded: false }, accessibilityValue: { text: 'Drugo' } });
  expect(tree.root.findAllByProps({ accessibilityRole: 'radiogroup' })).toHaveLength(0);
  await act(async () => hostPress('Tema zahteva').onPress());
  expect(action('Drugo').selected).toBe(true); expect(action('Tehnička pomoć').selected).toBe(false);
  expect(text()).not.toContain('Izabrano:');
});
it('an inbox row says what the request is about, its state and news in words, and shows its number before the time', async () => {
  screen = 'INBOX';
  mockService.inbox.mockResolvedValue(ok({ accountId: A, mode: 'OWN', operatorAvailable: false, authoritative: true, nextBeforeCaseNumber: null,
    cases: [{ id: C, caseNumber: '71', channel: 'SERVICE', topic: 'TECHNICAL', status: 'WAITING_FOR_AUTHOR', revision: 2, lastSequence: '9',
      createdAt: time, updatedAt: time, context: null, unread: true }] }));
  await render();
  const row = tree.root.findByProps({ topic: 'Tehnička pomoć' });
  expect(row.props).toMatchObject({ status: 'WAITING_FOR_AUTHOR', unread: true, caseNumber: '71' });
  const press = row.findByType('Press' as React.ElementType);
  expect(press.props.accessibilityLabel).toMatch(/^Tehnička pomoć, Čeka tvoju dopunu, novo, .+, zahtev #71$/);
  // Round 5 review: the number is shown again (it pinned the old look, number only spoken). Two requests on one topic
  // differ by it, and it is the number the confirmation and the request's own screen name.
  // Round 5c: the number leads, so the time's own " · " does not make three parts of one line.
  expect(text()).toContain('Čeka tvoju dopunu'); expect(text()).toMatch(/#71 · \S/); expect(text()).not.toMatch(/ · #71/);
  await act(async () => press.props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/podrska/[id]', params: { id: C } });
});
it('a failed inbox read is one state with its own retry, not a second refresh below it', async () => {
  screen = 'INBOX'; mockService.inbox.mockResolvedValue({ ok: false, poruka: 'Zahtevi trenutno nisu dostupni.' }); await render();
  expect(text()).toContain('Zahtevi nisu učitani'); expect(text()).toContain('Zahtevi trenutno nisu dostupni.');
  expect(actions('Osveži zahteve')).toHaveLength(1);
  // Round 5 review: the capabilities loaded (canCreate), yet the footer's green action waits for the list, so the error's
  // own retry is the screen's one primary.
  expect(actions('Novi privatni zahtev')).toHaveLength(0);
  await act(async () => action('Osveži zahteve').onPress()); expect(mockService.inbox).toHaveBeenCalledTimes(2);
});
it('a decision stands where the thread is, with the appeal beside it and its limits said', async () => {
  screen = 'DETAIL'; await render();
  expect(text()).toContain('Odluka o zahtevu'); expect(text()).toContain('Zahtev je odbijen'); expect(text()).toContain('Pregledana odluka');
  expect(text()).toContain('sama ne menja zadatak, Dogovor, novčani iznos ili ocenu');
  expect(actions('Zatraži ponovni pregled')).toHaveLength(1);
  // The chrome names the case by its title; the number is under it.
  expect(tree.root.findByProps({ variant: 'detail' }).props).toMatchObject({ title: 'Problem sa prikazom', subtitle: 'Zahtev #71' });
});
// Round 5 review fixes (privatnost-review-tok / -izgled / -zastite).
const committed = (kind: SupportKind, caseRevision: number) => ok({ accountId: A, clientRequestId: K, authoritative: true, state: 'COMMITTED', kind,
  caseId: C, expectedRevision: kind === 'CREATE' ? null : 2, inputSha256: 'a'.repeat(64), receipt: { accountId: A, clientRequestId: K, kind, caseId: C,
    caseNumber: '71', expectedRevision: kind === 'CREATE' ? null : 2, inputSha256: 'a'.repeat(64), eventId: E, sequence: '10', caseRevision, createdAt: time, authoritative: true } });
const hardwareBack = () => mockBack.handlers[mockBack.handlers.length - 1]();
const notes = () => tree.root.findAllByType(InlineNote).map(node => ({ tone: node.props.tone, text: node.props.children }));
it('Android Back with typed words asks first; an empty form lets the system Back through', async () => {
  await render(); expect(mockBack.handlers).toHaveLength(1);
  let handled = false; await act(async () => { handled = hardwareBack(); }); expect(handled).toBe(false);
  await type('Opis zahteva', 'Nesačuvan tekst');
  await act(async () => { handled = hardwareBack(); }); expect(handled).toBe(true);
  expect(tree.root.findByType(ConfirmSheet).props).toMatchObject({ title: 'Odbaciti zahtev?', confirmLabel: 'Odbaci', cancelLabel: 'Nastavi pisanje' });
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(field('Opis zahteva').value).toBe('Nesačuvan tekst');
  await act(async () => tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith('/podrska');
});
it('leaving for export and closure with typed words asks first, and goes once confirmed', async () => {
  await render(); await act(async () => hostPress('Tema zahteva').onPress()); await act(async () => action('Privatnost i prava').onPress()); await type('Opis zahteva', 'Nesačuvan tekst');
  await act(async () => action('Otvori izvoz i zatvaranje naloga').onPress());
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(1);
  await act(async () => tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/profil/privatnost');
});
it('the confirmed request replaces this form, so Back from the case does not land on an empty form', async () => {
  mockService.submit.mockResolvedValue(committed('CREATE', 1)); await render();
  await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis'); await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(text()).toContain('Potvrđen zahtev #71');
  await act(async () => action('Otvori zahtev').onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/podrska/[id]', params: { id: C } }); expect(mockRouter.push).not.toHaveBeenCalled();
});
it('an unconfirmed send says why the send is grey, and its words are drawn as waiting, never as failed', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(action('Pošalji privatni zahtev')).toMatchObject({ disabled: true, reason: 'Najpre proveri prethodno slanje.' });
  // The send may already have reached support: while it is unconfirmed its words wait with the check, not as a failure.
  expect(notes()).toContainEqual({ tone: 'warn', text: 'Sačekaj proveru.' });
  expect(notes().filter(note => note.tone === 'danger')).toHaveLength(0);
  // Unconfirmed words may already be with support: leaving does not claim they will be lost.
  let handled = true; await act(async () => { handled = hardwareBack(); }); expect(handled).toBe(false);
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
});
it('a stopped send is drawn as plain information, not as a failure', async () => {
  mockService.cancel.mockResolvedValue(ok({ accountId: A, clientRequestId: K, authoritative: true, state: 'CANCELLED', kind: null, caseId: null,
    expectedRevision: null, inputSha256: null, receipt: null }));
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis');
  await act(async () => action('Pošalji privatni zahtev').onPress()); await act(async () => action('Zaustavi prethodno slanje').onPress());
  expect(notes()).toContainEqual({ tone: 'neutral', text: 'Prvobitno slanje je zaustavljeno. Ranije primljen predmet ostaje sačuvan.' });
});
it('a request opened from a Dogovor message says once what it attaches, and keeps the sentence about what it does not', async () => {
  reference = { kind: 'AGREEMENT_MESSAGE', id: E, revision: 2 }; await render();
  expect(text()).toContain('Uz zahtev se šalje ovaj kontekst. Ostali razgovori i privatni podaci nisu automatski priloženi.');
  expect(text()).toContain('Prilaže se samo namerno izabrana poruka');
  expect(text().match(/Poruka iz privatnog Dogovora/g)).toHaveLength(1); expect(text()).not.toContain('Izabrana poruka iz Dogovora');
});
it('the topics and the decision are each one radio group for a screen reader', async () => {
  await render();
  await act(async () => hostPress('Tema zahteva').onPress());
  const group = tree.root.findByProps({ accessibilityRole: 'radiogroup' });
  expect(group.props.accessibilityLabel).toBe('Tema zahteva'); expect(group.findAllByProps({ kind: 'radio' }).length).toBeGreaterThan(5);
});
it('a confirmed reply clears its words with the new revision; a reload at the same revision keeps them', async () => {
  screen = 'DETAIL'; await render(); await type('Tekst poruke', 'Uneta dopuna');
  await act(async () => field('Pošalji poruku').onPress());
  await act(async () => action('Proveri ishod').onPress());
  expect(field('Tekst poruke').value).toBe('Uneta dopuna');
  mockService.cancel.mockResolvedValue(ok({ accountId: A, clientRequestId: K, authoritative: true, state: 'CANCELLED', kind: null, caseId: null,
    expectedRevision: null, inputSha256: null, receipt: null }));
  await act(async () => action('Zaustavi prethodno slanje').onPress());
  expect(field('Tekst poruke').value).toBe('Uneta dopuna');
  mockService.submit.mockResolvedValue(committed('AUTHOR_REPLY', 3));
  mockService.detail.mockResolvedValue(ok({ ...detail(), case: { ...detail().case, revision: 3 } }));
  await act(async () => field('Pošalji poruku').onPress());
  expect(field('Tekst poruke').value).toBe('');
});
// Round 5 review (tok 11): a new revision the other side made (an operator's reply read on refresh) used to wipe the
// person's half-typed reply; only their own confirmed reply clears it now.
it('the other side moving the case on keeps a half-typed reply, and a stale press still sends nothing', async () => {
  screen = 'DETAIL'; await render(); await type('Tekst poruke', 'Pola dopune');
  const stale = field('Pošalji poruku').onPress;
  mockService.detail.mockResolvedValue(ok({ ...detail(), case: { ...detail().case, revision: 3 } }));
  await act(async () => action('Osveži predmet').onPress());
  expect(field('Tekst poruke').value).toBe('Pola dopune');
  await act(async () => stale()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => field('Pošalji poruku').onPress());
  expect(mockService.prepare).toHaveBeenCalledWith('AUTHOR_REPLY', C, 3, { body: 'Pola dopune', evidence: [] }, expect.objectContaining({ accountId: A }));
});
it('a failed mark with nothing unconfirmed is drawn as failed, and spoken as an alert', async () => {
  screen = 'DETAIL'; mockService.markRead.mockResolvedValue({ ok: false, poruka: 'Označavanje nije potvrđeno.' }); await render();
  await act(async () => action('Označi prikazane događaje kao pročitane').onPress());
  const line = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Označavanje nije potvrđeno.');
  expect(line).toHaveLength(1); expect(line[0].props).toMatchObject({ tone: 'danger', accessibilityRole: 'alert' });
});
it('the send spins only for its own reply, and a text over the limit says why it is grey', async () => {
  screen = 'DETAIL'; const held = deferred(); mockService.markRead.mockReturnValue(held.promise); await render();
  await act(async () => action('Označi prikazane događaje kao pročitane').onPress());
  expect(field('Pošalji poruku').accessibilityState.busy).toBe(false);
  await act(async () => held.resolve(ok({ sequence: '9' })));
  expect(field('Tekst poruke').maxLength).toBe(8000);
  await type('Tekst poruke', 'a'.repeat(4001));
  expect(field('Pošalji poruku')).toMatchObject({ disabled: true, accessibilityHint: 'Skrati tekst pre slanja.' });
});
it('a reload closes the decision sheet, so it does not come back by itself when the same revision returns', async () => {
  screen = 'DETAIL'; await render();
  await act(async () => action('Zatraži ponovni pregled').onPress()); expect(actions('Pošalji zahtev za ponovni pregled')).toHaveLength(1);
  await act(async () => action('Osveži predmet').onPress());
  expect(mockService.detail).toHaveBeenCalledTimes(2); expect(actions('Pošalji zahtev za ponovni pregled')).toHaveLength(0);
});
// Round 5c review (privatnost-verify-iskustvo / -zastite).
it('stopping an unconfirmed send spins the stop, never the send, and the send says why it waits', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  const held = deferred(); mockService.cancel.mockReturnValueOnce(held.promise);
  await act(async () => action('Zaustavi prethodno slanje').onPress());
  expect(action('Zaustavi prethodno slanje')).toMatchObject({ loading: true, disabled: true });
  expect(action('Proveri ishod').loading).toBe(false);
  expect(action('Pošalji privatni zahtev')).toMatchObject({ loading: false, disabled: true, reason: 'Najpre proveri prethodno slanje.' });
  await act(async () => held.resolve(unknown));
  expect(action('Zaustavi prethodno slanje').loading).toBe(false);
});
it('a replay spins its own button, and the absent confirmation is said once, by the panel', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  await act(async () => action('Proveri ishod').onPress());
  expect(text()).toContain('Potvrda još nije pronađena.'); expect(text()).not.toContain('Potvrda prethodne radnje još nije pronađena.');
  expect(notes().filter(note => note.tone === 'warn')).toHaveLength(1);
  const held = deferred(); mockService.submit.mockReturnValueOnce(held.promise);
  await act(async () => action('Pošalji ponovo').onPress());
  expect(action('Pošalji ponovo')).toMatchObject({ loading: true, disabled: true });
  expect(action('Pošalji privatni zahtev').loading).toBe(false); expect(action('Zaustavi prethodno slanje').loading).toBe(false);
  await act(async () => held.resolve(unknown));
});
it('the check of an unconfirmed send spins its own button while it reads', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  const held = deferred(); mockService.recover.mockReturnValueOnce(held.promise);
  await act(async () => action('Proveri ishod').onPress());
  expect(action('Proveri ishod')).toMatchObject({ loading: true, disabled: true });
  expect(action('Zaustavi prethodno slanje').loading).toBe(false); expect(action('Pošalji privatni zahtev').loading).toBe(false);
  await act(async () => held.resolve(absent()));
});
it('"Odbaci" still leaves when the read it was asked during settles while the question is open', async () => {
  mockService.prepare.mockImplementationOnce(() => { throw new Error('lost'); });
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Nesačuvan tekst');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  const held = deferred(); mockService.capabilities.mockReturnValueOnce(held.promise);
  await act(async () => action('Proveri dostupnost').onPress());
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(1);
  await act(async () => held.resolve(ok({ accountId: A, operatorAvailable: false, canCreate: true, authoritative: true })));
  await act(async () => tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith('/podrska');
});
it('stopping an unconfirmed reply does not spin the reply\'s send', async () => {
  screen = 'DETAIL'; await render(); await type('Tekst poruke', 'Uneta dopuna');
  await act(async () => field('Pošalji poruku').onPress());
  const held = deferred(); mockService.cancel.mockReturnValueOnce(held.promise);
  await act(async () => action('Zaustavi prethodno slanje').onPress());
  expect(action('Zaustavi prethodno slanje').loading).toBe(true);
  expect(field('Pošalji poruku').accessibilityState.busy).toBe(false);
  await act(async () => held.resolve(unknown));
});
it('a failed mark while a reply is unconfirmed is drawn as failed, and the reply\'s words wait', async () => {
  screen = 'DETAIL'; mockService.markRead.mockResolvedValue({ ok: false, poruka: 'Označavanje nije potvrđeno.' }); await render();
  await type('Tekst poruke', 'Uneta dopuna'); await act(async () => field('Pošalji poruku').onPress());
  const waiting = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Sačekaj proveru.');
  expect(waiting).toHaveLength(1); expect(waiting[0].props.tone).toBe('ink');
  await act(async () => action('Označi prikazane događaje kao pročitane').onPress());
  const line = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Označavanje nije potvrđeno.');
  expect(line).toHaveLength(1); expect(line[0].props).toMatchObject({ tone: 'danger', accessibilityRole: 'alert' });
});
it('a locked, empty reply field waiting on an unconfirmed reply says to check it, not to type', async () => {
  screen = 'DETAIL'; mockService.loadPending.mockResolvedValue(journal('AUTHOR_REPLY')); await render();
  expect(field('Tekst poruke')).toMatchObject({ value: '', editable: false });
  expect(field('Pošalji poruku')).toMatchObject({ disabled: true, accessibilityHint: 'Najpre proveri prethodno slanje.' });
  // The absent confirmation is the recovery panel's own words; the composer does not repeat them.
  expect(text()).not.toContain('Potvrda prethodne radnje još nije pronađena.');
});
// UI/UX pass 2026-10-07 (team T4c): Podrška on the same composition and states as the rest of the app.
const inboxRow = (id: string, caseNumber: string, status: string, over: Record<string, unknown> = {}) => ({ id, caseNumber, channel: 'SERVICE', topic: 'TECHNICAL', status,
  revision: 1, lastSequence: '1', createdAt: time, updatedAt: time, context: null, unread: false, ...over });
const inboxOf = (cases: unknown[], over: Record<string, unknown> = {}) => ok({ accountId: A, mode: 'OWN', operatorAvailable: false, authoritative: true, nextBeforeCaseNumber: null, cases, ...over });
const hostsByTestId = (testID: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
it('an inbox row shows the five states as the app\'s one chip: a mark and a word, never a faded ghost', async () => {
  screen = 'INBOX';
  const states = ['RECEIVED', 'IN_REVIEW', 'WAITING_FOR_AUTHOR', 'DECIDED', 'CLOSED'];
  mockService.inbox.mockResolvedValue(inboxOf(states.map((status, index) => inboxRow(`60000000-0000-4000-8000-00000000000${index + 1}`, String(80 + index), status))));
  await render();
  const chips = hostsByTestId('status-chip');
  expect(chips.map(chip => chip.props.accessibilityLabel)).toEqual(['Čeka pregled', 'U obradi', 'Čeka tvoju dopunu', 'Odgovoreno', 'Zatvoren']);
  // Each chip is a mark and its word: the state is never carried by colour alone.
  for (const chip of chips) expect(chip.findAll(node => node.props.testID === 'status-mark').length).toBeGreaterThan(0);
  // Nothing on the list is drawn at a lowered opacity: a row that waits draws its words in the muted ink.
  const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  for (const node of tree.root.findAll(item => typeof item.type === 'string' && item.props.style)) expect(flat(node.props.style).opacity).toBeUndefined();
});
it('the one green action is grey with its reason when this account cannot start a request, and when one waits to be checked', async () => {
  screen = 'INBOX';
  mockService.capabilities.mockResolvedValue(ok({ accountId: A, operatorAvailable: false, canCreate: false, authoritative: true }));
  await render();
  expect(action('Novi zahtev')).toMatchObject({ disabled: true, reason: 'Novi zahtev trenutno nije dostupan ovom nalogu.' });
  await act(async () => tree.unmount());
  mockService.capabilities.mockResolvedValue(ok({ accountId: A, operatorAvailable: false, canCreate: true, authoritative: true }));
  mockService.loadPending.mockResolvedValue(journal()); await render();
  expect(action('Novi zahtev')).toMatchObject({ disabled: true, reason: 'Najpre proveri prethodno slanje.' });
  expect(actions('Proveri ishod')).toHaveLength(1);
});
it('the empty list says one sentence and offers its one action in the footer, not a second one in the state', async () => {
  screen = 'INBOX'; await render();
  expect(text()).toContain('Još nema primljenih zahteva'); expect(text()).toContain('Zahteve i odgovore podrške vidiš ovde.');
  expect(actions('Novi zahtev')).toHaveLength(1);
  // The rows to blocked people and to privacy are plain words, not "privatne prijave i blokiranja".
  expect(actions('Blokirane osobe')).toHaveLength(1); expect(actions('Privatnost i podaci')).toHaveLength(1);
  expect(text()).not.toContain('Privatne prijave i blokiranja'); expect(text()).not.toContain('inbox');
});
it('a refresh the person asks for keeps the list on screen under its own spinner; only the first read is a skeleton', async () => {
  screen = 'INBOX';
  mockService.inbox.mockResolvedValue(inboxOf([inboxRow(C, '71', 'IN_REVIEW')]));
  const first = deferred(); mockService.inbox.mockReturnValueOnce(first.promise); await render();
  expect(text()).toContain('Učitavamo sačuvano stanje'); expect(actions('Osveži zahteve')).toHaveLength(0);
  await act(async () => first.resolve(inboxOf([inboxRow(C, '71', 'IN_REVIEW')])));
  expect(text()).toContain('#71'); expect(text()).not.toContain('Učitavamo sačuvano stanje');
  const again = deferred(); mockService.inbox.mockReturnValueOnce(again.promise);
  await act(async () => { void action('Osveži zahteve').onPress(); });
  // Still reading, and the list, the footer's action and the refresh are all still there.
  expect(text()).toContain('#71'); expect(text()).not.toContain('Učitavamo sačuvano stanje');
  expect(action('Osveži zahteve')).toMatchObject({ loading: true, disabled: true }); expect(actions('Novi zahtev')).toHaveLength(1);
  await act(async () => again.resolve(inboxOf([inboxRow(C, '71', 'CLOSED')])));
  expect(action('Osveži zahteve').loading).toBe(false); expect(text()).toContain('Zatvoren');
});
it('a failed refresh does not leave the old list as if it were current: the error is one state with its own retry', async () => {
  screen = 'INBOX';
  mockService.inbox.mockResolvedValueOnce(inboxOf([inboxRow(C, '71', 'IN_REVIEW')]));
  await render(); expect(text()).toContain('#71');
  mockService.inbox.mockResolvedValueOnce({ ok: false, poruka: 'Zahtevi trenutno nisu dostupni.' });
  await act(async () => action('Osveži zahteve').onPress());
  expect(text()).toContain('Zahtevi nisu učitani'); expect(text()).not.toContain('#71'); expect(actions('Osveži zahteve')).toHaveLength(1);
  expect(actions('Novi zahtev')).toHaveLength(0);
});
it('a case being read again stays on screen: the conversation and the typed reply wait grey under the spinner', async () => {
  screen = 'DETAIL'; await render(); await type('Tekst poruke', 'Pola dopune');
  const again = deferred(); mockService.detail.mockReturnValueOnce(again.promise);
  await act(async () => { void action('Osveži predmet').onPress(); });
  expect(text()).toContain('Privatna dopuna'); expect(text()).not.toContain('Učitavamo sačuvano stanje');
  expect(action('Osveži predmet')).toMatchObject({ loading: true, disabled: true });
  expect(field('Tekst poruke')).toMatchObject({ value: 'Pola dopune', editable: false });
  expect(field('Pošalji poruku').disabled).toBe(true);
  await act(async () => again.resolve(ok(detail())));
  expect(field('Tekst poruke')).toMatchObject({ value: 'Pola dopune', editable: true });
});
it('the first read of a case is a skeleton, and a failed read says what happened with one retry', async () => {
  screen = 'DETAIL'; const first = deferred(); mockService.detail.mockReturnValueOnce(first.promise); await render();
  expect(text()).toContain('Učitavamo sačuvano stanje'); expect(actions('Osveži predmet')).toHaveLength(0);
  await act(async () => first.resolve({ ok: false, poruka: 'Zahtev trenutno nije dostupan.' }));
  expect(text()).toContain('Zahtev nije učitan'); expect(text()).toContain('Zahtev trenutno nije dostupan.'); expect(actions('Osveži predmet')).toHaveLength(1);
});
const operatorDetail = (allowedActions: SupportKind[]) => ({ ...detail(), viewerRole: 'OPERATOR' as const, operatorAvailable: true, allowedActions });
it('closing a processed case asks first in the centred dialog with what follows, and only the confirm sends it', async () => {
  screen = 'DETAIL'; mockService.detail.mockResolvedValue(ok(operatorDetail(['CLOSE']))); await render();
  await act(async () => action('Zatvori obrađeni predmet').onPress());
  expect(mockService.prepare).not.toHaveBeenCalled();
  expect(tree.root.findByType(ConfirmSheet).props).toMatchObject({ title: 'Zatvoriti predmet?', confirmLabel: 'Zatvori predmet', tone: 'danger',
    message: 'Predmet se zatvara i dopune više nisu moguće. Odluka i razgovor ostaju u istoriji.' });
  await act(async () => tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Zatvori obrađeni predmet').onPress());
  const press = tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress;
  await act(async () => { press(); press(); });
  expect(mockService.prepare).toHaveBeenCalledTimes(1);
  expect(mockService.prepare).toHaveBeenCalledWith('CLOSE', C, 2, {}, expect.objectContaining({ accountId: A }));
});
it('a question about closing is retired when the case moves on, so a late confirm sends nothing', async () => {
  screen = 'DETAIL'; mockService.detail.mockResolvedValue(ok(operatorDetail(['CLOSE']))); await render();
  await act(async () => action('Zatvori obrađeni predmet').onPress());
  const late = tree.root.findByType(ConfirmSheet).props.onConfirm;
  mockService.detail.mockResolvedValue(ok({ ...operatorDetail(['CLOSE']), case: { ...detail().case, revision: 3 } }));
  await act(async () => action('Osveži predmet').onPress());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  await act(async () => { late(); }); expect(mockService.prepare).not.toHaveBeenCalled();
});
it('a request for another review is said as that, never as a "žalba"', async () => {
  screen = 'DETAIL';
  mockService.detail.mockResolvedValue(ok({ ...operatorDetail(['CLAIM_APPEAL']), appeals: [{ id: AP, caseId: C, decisionId: D, status: 'RECEIVED', decisionResultId: null, createdAt: time }] }));
  await render();
  expect(text()).toContain('Zahtev za ponovni pregled je primljen'); expect(text()).not.toMatch(/[Žž]alb/);
  await act(async () => tree.unmount());
  mockService.detail.mockResolvedValue(ok(detail())); await render();
  await act(async () => action('Zatraži ponovni pregled').onPress());
  expect(text()).toContain('ne predstavlja nezavisan žalbeni organ'); expect(text()).not.toContain('Žalba');
});
it('the new request has no explaining sentence above its form, and its receipt says where the answer will be, not when', async () => {
  await render();
  expect(tree.root.findAllByType('Intro' as React.ElementType)).toHaveLength(0); expect(text()).not.toContain('Izaberi temu i napiši');
  await act(async () => tree.unmount());
  mockService.submit.mockResolvedValue(committed('CREATE', 1)); await render();
  await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Opis'); await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(text()).toContain('Potvrđen zahtev #71'); expect(text()).toContain('Odgovor ćeš naći u Podršci.');
  expect(text()).not.toMatch(/čim|brzo|u roku|za \d+ (sat|dan)/);
});
it.each(['DETAIL', 'INBOX'] as const)('what a re-read keeps on screen is never kept past the visit: after the app was in the background the old private %s is not drawn again while it is read once more', async kind => {
  screen = kind; mockService.inbox.mockResolvedValue(inboxOf([inboxRow(C, '71', 'IN_REVIEW')]));
  const mark = kind === 'DETAIL' ? 'Privatna dopuna' : '#71';
  await render(); expect(text()).toContain(mark);
  const held = deferred(); (kind === 'DETAIL' ? mockService.detail : mockService.inbox).mockReturnValueOnce(held.promise);
  await act(async () => { mockAppState = 'background'; mockListeners.forEach(fn => fn('background')); });
  expect(text()).not.toContain(mark);
  await act(async () => { mockAppState = 'active'; mockListeners.forEach(fn => fn('active')); });
  // The new visit reads again: its first read is a skeleton, never what the earlier visit had read.
  expect(text()).toContain('Učitavamo sačuvano stanje'); expect(text()).not.toContain(mark);
  await act(async () => held.resolve(kind === 'DETAIL' ? ok(detail()) : inboxOf([inboxRow(C, '71', 'IN_REVIEW')])));
  expect(text()).toContain(mark);
});
