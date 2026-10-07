import React from 'react';
import { KeyboardAvoidingView, StyleSheet, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * D12 flag ON: the rating screen with the optional written comment, over the REAL services (the facade and the legacy review
 * service) and a mocked database call. Only the build flag and the answers of the backend differ from the flag-off baseline
 * (`oceni-dogovor-flag-off-baseline.test.tsx`, whose snapshot was recorded before the comment client existed).
 */
jest.setTimeout(60_000);
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', R = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const mockAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', mockAgreementId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const mockRpc = jest.fn(), mockAgreement = jest.fn();
let mockRequestCount = 0;
const mockListeners = new Set<(state: string) => void>();
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_: string, listener: (state: string) => void) => {
      mockListeners.add(listener); return { remove: () => { mockListeners.delete(listener); } }; } };
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ agreementId: mockAgreementId }),
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccountId }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: 1 }) }));
// A new id for every new attempt, the same id for a replay of one: the tests read the ids off the request bodies.
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => `cccccccc-cccc-4ccc-8ccc-${String(++mockRequestCount).padStart(12, '0')}` }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => ({ dogovor: (...args: unknown[]) => mockAgreement(...args) }) }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/system/SuccessMark', () => ({ SuccessMark: 'SuccessMark' }));
import ReviewRoute from '../../app/(app)/oceni-dogovor';
import { REVIEW_TAGS } from '../reviewsClientService';
import { resetReviewCommentCapability } from '../reviewCommentsClientService';
import { REVIEW_COMMENT_MESSAGES } from '../reviewCommentText';
import { REVIEW_COMMENT_NOTICE } from '../../ui/reviews/ReviewCommentField';
import { sys } from '../../ui/system/tokens';

const FLAG = 'EXPO_PUBLIC_D12_REVIEW_COMMENT';
const SECRET = 'Tajni komentar 12345 qwertz';
const policy = { supported: true, maxLength: 500, version: 'REVIEW_COMMENT_V1' };
const context = (patch: Record<string, unknown> = {}) => ({ accountId: A, agreementId: D, targetAccountId: B, eligible: true, review: null,
  tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [...REVIEW_TAGS] }, commentPolicy: policy, authoritative: true, ...patch });
type Body = { p_agreement_id: string; p_target_account_id: string; p_rating: number; p_tags: string[]; p_client_request_id: string; p_comment?: string };
const receipt = (body: Body, comment: string | null) => ({ agreementId: body.p_agreement_id, targetAccountId: body.p_target_account_id, rating: body.p_rating,
  tags: body.p_tags, clientRequestId: body.p_client_request_id, reviewId: R, reviewerAccountId: A, createdAt: '2026-10-02T06:49:50.123456+00:00',
  idempotentReplay: false, authoritative: true, comment });
const person = (id: string, viSte: boolean, ime: string, uloga: 'narucilac' | 'uskocer') => ({ id, profilId: null, ime, inicijali: ime.slice(0, 1), uloga, mesta: null, viSte, telefon: null });

/** What the backend answers, by function; a test overrides what it needs. */
const server: { get: () => unknown; submit: (body: Body) => unknown } = { get: () => ({ data: context(), error: null }), submit: () => ({ data: null, error: null }) };
const names = () => mockRpc.mock.calls.map(call => call[0] as string);
const submits = () => mockRpc.mock.calls.filter(call => call[0] === 'rpc_submit_agreement_review_v2').map(call => call[1] as Body);

let tree: ReactTestRenderer;
const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const action = (label: string) => tree.root.findByProps({ label });
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const input = () => tree.root.findAllByType(TextInput)[0];
const settle = async () => { await act(async () => {}); };
async function render() { await act(async () => { tree = create(<ReviewRoute />); }); await settle(); }
const rate = async (value: number) => act(async () => press(`Ocena ${value} od 5`).props.onPress());
const openField = async () => act(async () => press('Dodaj komentar').props.onPress());
const type = async (text: string) => act(async () => input().props.onChangeText(text));
const save = async () => { await act(async () => action('Sačuvaj ocenu').props.onPress()); await settle(); };
const background = async () => act(async () => mockListeners.forEach(listener => listener('background')));
const foreground = async () => { await act(async () => mockListeners.forEach(listener => listener('active'))); await settle(); };

beforeEach(() => {
  process.env[FLAG] = '1'; resetReviewCommentCapability(); mockRequestCount = 0;
  jest.clearAllMocks(); mockListeners.clear();
  mockAgreement.mockReset().mockResolvedValue({ id: D, naslov: '"Unos ormara"', ucesnici: [person(A, true, 'Ja Sam', 'uskocer'), person(B, false, 'Nikola Petrović', 'narucilac')] });
  server.get = () => ({ data: context(), error: null });
  server.submit = (body: Body) => ({ data: receipt(body, body.p_comment ?? null), error: null });
  mockRpc.mockReset().mockImplementation(async (name: string, body: unknown) => {
    if (name === 'rpc_get_my_agreement_review_v2') return server.get();
    if (name === 'rpc_submit_agreement_review_v2') return server.submit(body as Body);
    throw new Error(`Unexpected rpc ${name}`);
  });
});
afterEach(async () => { delete process.env[FLAG]; await act(async () => tree?.unmount()); });

describe('with the flag on and a backend that has the package', () => {
  it('reads through v2 only, offers the comment as ONE quiet row, and keeps the save above the keyboard', async () => {
    await render();
    expect(names()).toEqual(['rpc_get_my_agreement_review_v2']);
    expect(mockRpc).toHaveBeenCalledWith('rpc_get_my_agreement_review_v2', { p_agreement_id: D });
    expect(press('Dodaj komentar')).toBeDefined();
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(texts()).not.toContain(REVIEW_COMMENT_NOTICE);
    const avoiding = tree.root.findAllByType(KeyboardAvoidingView);
    expect(avoiding).toHaveLength(1);
    expect(avoiding[0].findAll(node => node.props?.label === 'Sačuvaj ocenu').length).toBeGreaterThan(0);
    // One primary action: the one green save, and nothing else with a label of its own.
    expect(tree.root.findAll(node => String(node.type) === 'Action')).toHaveLength(1);
  });

  it('a stars-only rating is sent through v2 with the five keys and no comment, and the saved view has no comment line', async () => {
    await render();
    await rate(4); await save();
    expect(submits()).toEqual([{ p_agreement_id: D, p_target_account_id: B, p_rating: 4, p_tags: [], p_client_request_id: 'cccccccc-cccc-4ccc-8ccc-000000000001' }]);
    expect(Object.keys(submits()[0]).sort()).toEqual(['p_agreement_id', 'p_client_request_id', 'p_rating', 'p_tags', 'p_target_account_id']);
  });

  it('opening the field shows it, the notice ONCE and no counter; the row is gone and the keyboard may rise', async () => {
    await render();
    await openField();
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(input().props).toMatchObject({ multiline: true, editable: true, accessibilityLabel: 'Komentar o saradnji', value: '' });
    expect(texts().filter(text => text === REVIEW_COMMENT_NOTICE)).toHaveLength(1);
    expect(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Dodaj komentar')).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLiveRegion: 'polite' }).filter(node => String(node.type) === 'T' && /znak/.test(String(node.children[0])))).toHaveLength(0);
  });

  it('a comment goes through v2 trimmed and composed, once, and the saved receipt shows the stored comment', async () => {
    await render();
    await rate(5); await openField();
    await type(`  Odlična saradnja.\r\nVrlo uredno.  `);
    let stored = '';
    server.submit = (body: Body) => { stored = body.p_comment ?? ''; return { data: receipt(body, body.p_comment ?? null), error: null }; };
    server.get = () => ({ data: context(stored ? { eligible: false, review: receipt({ p_agreement_id: D, p_target_account_id: B, p_rating: 5, p_tags: [], p_client_request_id: 'cccccccc-cccc-4ccc-8ccc-000000000001' }, stored) } : {}), error: null });
    await save();
    expect(submits()).toHaveLength(1);
    expect(submits()[0].p_comment).toBe('Odlična saradnja.\nVrlo uredno.');
    expect(names()).toEqual(['rpc_get_my_agreement_review_v2', 'rpc_submit_agreement_review_v2', 'rpc_get_my_agreement_review_v2']);
    expect(texts()).toContain('Ocena je sačuvana.');
    expect(texts()).toContain('Tvoj komentar');
    expect(texts()).toContain('Odlična saradnja.\nVrlo uredno.');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('says how much room is left near the limit, and a comment over it is not sent: the save is grey and says why', async () => {
    await render();
    await rate(3); await openField();
    await type('a'.repeat(450));
    expect(texts()).toContain('Još 50 znakova');
    await type('a'.repeat(501));
    expect(texts()).toContain('Skrati za 1 znak');
    expect(StyleSheet.flatten(input().props.style).borderColor).toBe(sys.color.danger);
    const button = action('Sačuvaj ocenu');
    expect(button.props.disabled).toBe(true);
    expect(button.props.reason).toBe(REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_TOO_LONG);
    await act(async () => button.props.onPress());
    expect(submits()).toHaveLength(0);
    await type('a'.repeat(500));
    expect(action('Sačuvaj ocenu').props.disabled).toBe(false);
    expect(action('Sačuvaj ocenu').props.reason).toBeNull();
  });

  it('a comment that is only blank is no comment: the review goes without one and the save was never held back', async () => {
    await render();
    await rate(2); await openField(); await type('   \n  ');
    expect(action('Sačuvaj ocenu').props.disabled).toBe(false);
    await save();
    expect(submits()).toHaveLength(1);
    expect(submits()[0]).not.toHaveProperty('p_comment');
  });

  it('the typed comment survives a trip to the background and back, with the field still open', async () => {
    await render();
    await rate(5); await openField(); await type('Sve pohvale.');
    await background();
    // While the screen reads again nothing editable is on screen; the text is in the screen, not in the field.
    await foreground();
    expect(names().filter(name => name === 'rpc_get_my_agreement_review_v2')).toHaveLength(2);
    expect(input().props.value).toBe('Sve pohvale.');
    expect(texts().filter(text => text === REVIEW_COMMENT_NOTICE)).toHaveLength(1);
    // The whole draft is the screen's: the stars are where they were, and the save is not held back.
    expect(press('Ocena 5 od 5').props.accessibilityState.checked).toBe(true);
    expect(action('Sačuvaj ocenu').props.disabled).toBe(false);
    expect(submits()).toHaveLength(0);
  });
});

describe('when the server refuses the comment itself', () => {
  const refuse = (name: string) => { server.submit = () => ({ data: null, error: { code: '22023', message: name, details: SECRET, hint: SECRET } }); };

  it.each([
    ['REVIEW_COMMENT_CONTACT_NOT_PUBLIC', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_CONTACT_NOT_PUBLIC],
    ['REVIEW_COMMENT_INVALID', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_INVALID],
    ['REVIEW_COMMENT_TOO_LONG', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_TOO_LONG],
  ])('%s releases the attempt: the stars and the text stay, the field stays editable, the save says why until the text changes', async (name, sentence) => {
    refuse(name);
    await render();
    await rate(4); await openField(); await type('Ovo je moj komentar');
    await save();
    expect(submits()).toHaveLength(1);
    // No unknown-outcome mode: nothing to check, nothing frozen.
    expect(tree.root.findAll(node => String(node.type) === 'Action' && node.props.label === 'Proveri sačuvanu ocenu')).toHaveLength(0);
    expect(texts()).not.toContain('Čuvamo tvoj prvobitni izbor dok proveravaš ishod slanja.');
    expect(press('Ocena 4 od 5').props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(input().props).toMatchObject({ editable: true, value: 'Ovo je moj komentar' });
    expect(StyleSheet.flatten(input().props.style).borderColor).toBe(sys.color.danger);
    expect(action('Sačuvaj ocenu').props).toMatchObject({ disabled: true, reason: sentence });
    // The sentence is said once, under the save; no second notice carries it, and it never shows a code or the backend's words.
    expect(tree.root.findAll(node => node.props?.accessibilityRole === 'alert')).toHaveLength(0);
    expect(JSON.stringify(texts())).not.toContain(SECRET);
    expect(JSON.stringify(texts())).not.toMatch(/REVIEW_|22023/);
    // Editing releases the save, and the next send is a NEW attempt with its own request id and the corrected text.
    server.submit = (body: Body) => ({ data: receipt(body, body.p_comment ?? null), error: null });
    await type('Ovo je ispravljen komentar');
    expect(action('Sačuvaj ocenu').props).toMatchObject({ disabled: false, reason: null });
    expect(StyleSheet.flatten(input().props.style).borderColor).not.toBe(sys.color.danger);
    await save();
    expect(submits()).toHaveLength(2);
    expect(submits()[1]).toMatchObject({ p_comment: 'Ovo je ispravljen komentar', p_rating: 4 });
    expect(submits()[1].p_client_request_id).not.toBe(submits()[0].p_client_request_id);
  });

  it('typing the very text that was refused brings the sentence back, and a different text does not', async () => {
    refuse('REVIEW_COMMENT_CONTACT_NOT_PUBLIC');
    await render();
    await rate(4); await openField(); await type('prvi'); await save();
    expect(action('Sačuvaj ocenu').props.disabled).toBe(true);
    await type('drugi');
    expect(action('Sačuvaj ocenu').props.disabled).toBe(false);
    await type('prvi');
    expect(action('Sačuvaj ocenu').props.disabled).toBe(true);
  });

  it('a refusal does not turn the next send into "Ponovi istu ocenu"', async () => {
    refuse('REVIEW_COMMENT_INVALID');
    await render();
    await rate(4); await openField(); await type('x'); await save();
    server.submit = (body: Body) => ({ data: receipt(body, body.p_comment ?? null), error: null });
    await type('y');
    expect(action('Sačuvaj ocenu').props.label).toBe('Sačuvaj ocenu');
  });
});

describe('when the outcome of the send is unknown', () => {
  it('freezes the choice with the comment, checks first, and replays EXACTLY the same command', async () => {
    server.submit = () => { throw new Error(SECRET); };
    await render();
    await rate(5); await openField(); await type('Sve pohvale.');
    await save();
    expect(submits()).toHaveLength(1);
    expect(action('Proveri sačuvanu ocenu')).toBeDefined();
    expect(input().props.editable).toBe(false);
    expect(texts()).toContain('Čuvamo tvoj prvobitni izbor dok proveravaš ishod slanja.');
    await act(async () => { input().props.onChangeText('Promenjeno.'); });
    expect(input().props.value).toBe('Sve pohvale.');
    // Checking finds no stored review, so the same command is offered again.
    await act(async () => action('Proveri sačuvanu ocenu').props.onPress()); await settle();
    server.submit = (body: Body) => ({ data: { ...receipt(body, body.p_comment ?? null), idempotentReplay: true }, error: null });
    await act(async () => action('Sačuvaj ocenu ponovo').props.onPress()); await settle();
    expect(submits()).toHaveLength(2);
    expect(submits()[1]).toEqual(submits()[0]);
    expect(submits()[0].p_comment).toBe('Sve pohvale.');
  });

  it('an echo that is not what was sent is an error state: the review is saved, so the person is sent to check it', async () => {
    server.submit = (body: Body) => ({ data: receipt(body, 'Neki drugi tekst'), error: null });
    await render();
    await rate(5); await openField(); await type('Sve pohvale.');
    await save();
    expect(texts()).not.toContain('Ocena je sačuvana.');
    expect(action('Proveri sačuvanu ocenu')).toBeDefined();
    expect(texts()).toContain(REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_MISMATCH);
    expect(input().props.editable).toBe(false);
  });
});

describe('when the backend has no D12 package', () => {
  it('the first read falls back to the legacy pair and the screen is the legacy screen: no row, no field, no avoiding view', async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'rpc_get_my_agreement_review_v2') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      if (name === 'rpc_get_my_agreement_review') return { data: { ...context(), commentPolicy: undefined }, error: null };
      throw new Error(`Unexpected rpc ${name}`);
    });
    await render();
    expect(names()).toEqual(['rpc_get_my_agreement_review_v2', 'rpc_get_my_agreement_review']);
    expect(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Dodaj komentar')).toHaveLength(0);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
    expect(press('Ocena 3 od 5')).toBeDefined();
  });

  it('the backend that loses the function after the field was drawn: the comment is never sent without it, and clearing it sends the review the legacy way', async () => {
    await render();
    await rate(4); await openField(); await type('Sve pohvale.');
    mockRpc.mockImplementation(async (name: string, body: unknown) => {
      if (name === 'rpc_submit_agreement_review_v2') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      if (name === 'rpc_submit_agreement_review') return { data: receipt({ ...(body as Body), p_comment: undefined } as Body, null), error: null };
      if (name === 'rpc_get_my_agreement_review') return { data: { ...context({ eligible: false, review: null }), commentPolicy: undefined }, error: null };
      throw new Error(`Unexpected rpc ${name}`);
    });
    await save();
    // Refused once, in plain words, and the legacy function never saw the comment.
    expect(names().filter(name => name === 'rpc_submit_agreement_review')).toHaveLength(0);
    expect(action('Sačuvaj ocenu').props).toMatchObject({ disabled: true, reason: REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_UNAVAILABLE });
    await type('');
    expect(action('Sačuvaj ocenu').props.disabled).toBe(false);
    mockRpc.mockClear();
    await save();
    expect(names()).toEqual(['rpc_submit_agreement_review', 'rpc_get_my_agreement_review']);
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_agreement_id: D, p_target_account_id: B, p_rating: 4, p_tags: [], p_client_request_id: expect.any(String) });
  });
});

describe('the flag is off in this build', () => {
  it('nothing new is asked, drawn or sent, even against a backend that has the package', async () => {
    delete process.env[FLAG];
    mockRpc.mockImplementation(async (name: string, body: unknown) => {
      if (name === 'rpc_get_my_agreement_review') return { data: { ...context(), commentPolicy: undefined }, error: null };
      if (name === 'rpc_submit_agreement_review') return { data: receipt({ ...(body as Body), p_comment: undefined } as Body, null), error: null };
      throw new Error(`Unexpected rpc ${name}`);
    });
    await render();
    await rate(5); await save();
    expect(names().filter(name => name.includes('v2') || name.includes('comments'))).toEqual([]);
    expect(names()[0]).toBe('rpc_get_my_agreement_review');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Dodaj komentar')).toHaveLength(0);
  });
});

describe('the comment text goes nowhere but the screen and the request', () => {
  it('no console call receives it, whatever happens: a send, a refusal, an unknown outcome, an echo that differs', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map(channel => jest.spyOn(console, channel).mockImplementation(() => {}));
    try {
      await render();
      await rate(5); await openField(); await type(SECRET);
      server.submit = () => ({ data: null, error: { code: '22023', message: 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', details: SECRET, hint: SECRET } });
      await save();
      await type(`${SECRET} 2`);
      server.submit = () => { throw new Error(SECRET); };
      await save();
      await act(async () => action('Proveri sačuvanu ocenu').props.onPress()); await settle();
      server.submit = (body: Body) => ({ data: receipt(body, `${SECRET} otherwise`), error: null });
      await act(async () => action('Sačuvaj ocenu ponovo').props.onPress()); await settle();
      for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('Tajni');
    } finally { for (const spy of spies) spy.mockRestore(); }
  });
});
