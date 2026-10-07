import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
let mockFocused = true;
const mockContext = jest.fn(), mockOwnerFeed = jest.fn(), mockPublicFeed = jest.fn();
const mockAsk = jest.fn(), mockAnswer = jest.fn(), mockDisposition = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'AppState' ? { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) } : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../data/qaRecoveryClientService', () => ({ qaRecoveryClientService: { context: (...args: unknown[]) => mockContext(...args) } }));
jest.mock('../../../data/preselectionQaClientService', () => ({ preselectionQaClientService: {
  ownerQuestions: (...args: unknown[]) => mockOwnerFeed(...args), publicQa: (...args: unknown[]) => mockPublicFeed(...args),
  askQuestion: (...args: unknown[]) => mockAsk(...args), answerQuestion: (...args: unknown[]) => mockAnswer(...args),
  dispositionQuestion: (...args: unknown[]) => mockDisposition(...args),
} }));
import { useTaskQaInline } from '../useTaskQaInline';

/**
 * The reader behind the section (owner, 2026-10-07): the same two reads the whole thread already makes, in the same order,
 * and nothing else; a failed read is a failure and never an empty thread; and a read that finishes after the account, the
 * task or the version changed is never shown.
 */
const NEED = '22222222-2222-4222-8222-222222222222', OTHER = '33333333-3333-4333-8333-333333333333';
const Q1 = '44444444-4444-4444-8444-444444444441', Q2 = '44444444-4444-4444-8444-444444444442';
const ok = (podatak: unknown) => ({ ok: true, podatak });
const context = (patch: Record<string, unknown> = {}) => ({ accountId: 'account-a', needId: NEED, needRevision: 2, title: 'Montaža police', mode: 'PUBLIC',
  publicRevision: true, activeWorker: true, canAsk: true, canComposeAnswer: false, ratePolicyState: 'READY', questionMaxChars: 500, answerMaxChars: null,
  authoritative: true, ...patch });
const publicRow = (questionId: string, patch: Record<string, unknown> = {}) => ({ questionId, needRevision: 2, questionText: 'Da li ima lift?', answerVersion: 1,
  answerText: 'Nema.', edited: false, answeredAt: '2026-10-05T09:00:00Z', ...patch });
const ownerRow = (questionId: string, patch: Record<string, unknown> = {}) => ({ questionId, needRevision: 2, questionText: 'Da li ima lift?', status: 'PENDING_ANSWER',
  createdAt: '2026-10-04T08:00:00Z', answerVersion: null, answerText: null, edited: false, ...patch });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

let latest: ReturnType<typeof useTaskQaInline>;
function Probe({ needId, revision }: { needId: string | null; revision?: number | null }) {
  latest = useTaskQaInline(needId, revision);
  return null;
}
let tree: ReactTestRenderer;
const render = async (needId: string | null = NEED, revision?: number | null) => { await act(async () => { tree = create(<Probe needId={needId} revision={revision} />); }); };
const update = async (needId: string | null = NEED, revision?: number | null) => { await act(async () => tree.update(<Probe needId={needId} revision={revision} />)); };
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true;
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
  mockContext.mockResolvedValue(ok(context())); mockPublicFeed.mockResolvedValue(ok([])); mockOwnerFeed.mockResolvedValue(ok([]));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('what it reads', () => {
  it('a stranger: the context, then the public thread, for this account and this task, and nothing else', async () => {
    mockPublicFeed.mockResolvedValue(ok([publicRow(Q1), publicRow(Q2, { answeredAt: '2026-10-06T09:00:00Z' })]));
    await render();
    expect(mockContext).toHaveBeenCalledTimes(1);
    expect(mockContext).toHaveBeenCalledWith(NEED, { accountId: 'account-a', accountRevision: 1 });
    expect(mockPublicFeed).toHaveBeenCalledTimes(1); expect(mockPublicFeed).toHaveBeenCalledWith(NEED);
    expect(mockOwnerFeed).not.toHaveBeenCalled();
    expect(latest.state).toMatchObject({ phase: 'ready', viewer: 'PUBLIC', listed: 2, canAsk: true });
    if (latest.state.phase === 'ready') expect(latest.state.shown.map(item => item.questionId)).toEqual([Q2, Q1]);
    // It sends no question, no answer and no disposition: those stay in the whole thread.
    expect(mockAsk).not.toHaveBeenCalled(); expect(mockAnswer).not.toHaveBeenCalled(); expect(mockDisposition).not.toHaveBeenCalled();
  });

  it('the owner: the context says which shape is owed, and the owner\'s thread is read, not the public one', async () => {
    mockContext.mockResolvedValue(ok(context({ mode: 'OWNER', canAsk: false, canComposeAnswer: true })));
    mockOwnerFeed.mockResolvedValue(ok([ownerRow(Q1, { status: 'ANSWERED_PUBLIC', answerVersion: 1, answerText: 'Nema.' }), ownerRow(Q2)]));
    await render();
    expect(mockOwnerFeed).toHaveBeenCalledTimes(1); expect(mockOwnerFeed).toHaveBeenCalledWith(NEED);
    expect(mockPublicFeed).not.toHaveBeenCalled();
    expect(latest.state).toMatchObject({ phase: 'ready', viewer: 'OWNER', waiting: 1, answered: 1, canAnswer: true });
    if (latest.state.phase === 'ready') expect(latest.state.shown.map(item => item.questionId)).toEqual([Q2, Q1]);
  });

  it('reads nothing without a task (a draft, a task that is not loaded yet) and says nothing', async () => {
    await render(null);
    expect(latest.state).toEqual({ phase: 'idle' });
    expect(mockContext).not.toHaveBeenCalled(); expect(mockPublicFeed).not.toHaveBeenCalled(); expect(mockOwnerFeed).not.toHaveBeenCalled();
  });

  it('is loading until the first read lands', async () => {
    const pending = deferred<unknown>();
    mockContext.mockReturnValueOnce(pending.promise);
    await render();
    expect(latest.state).toEqual({ phase: 'loading' });
    await act(async () => pending.resolve(ok(context())));
    expect(latest.state.phase).toBe('ready');
  });

  it('keeps the questions of an earlier version out, as the whole thread does', async () => {
    mockPublicFeed.mockResolvedValue(ok([publicRow(Q1, { needRevision: 1 })]));
    await render();
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 0, olderVersion: true });
  });
});

describe('a read that failed is a failure, never an empty thread', () => {
  it('the context cannot be read: the service\'s own words, and the thread is not read at all', async () => {
    mockContext.mockResolvedValue({ ok: false, kod: 'ACCOUNT_CLOSING', poruka: 'Nalog je u postupku zatvaranja.' });
    await render();
    expect(latest.state).toEqual({ phase: 'error', message: 'Nalog je u postupku zatvaranja.' });
    expect(mockPublicFeed).not.toHaveBeenCalled(); expect(mockOwnerFeed).not.toHaveBeenCalled();
  });

  it.each(['NEED_NOT_FOUND', 'NEED_NOT_PUBLIC', 'INTERACTION_BLOCKED'])('%s: the thread is not shown to this account, which is not the same as the task being gone', async kod => {
    // The whole thread says "Zadatak nije dostupan ovom nalogu" for the first of these; on the task's own screen that would be false.
    mockContext.mockResolvedValue({ ok: false, kod, poruka: 'Zadatak nije dostupan ovom nalogu.' });
    await render();
    expect(latest.state).toEqual({ phase: 'error', message: 'Pitanja za ovaj zadatak nisu dostupna.' });
    mockContext.mockResolvedValue(ok(context()));
    mockPublicFeed.mockResolvedValueOnce({ ok: false, kod, poruka: 'Zadatak više nije javan.' });
    await act(async () => latest.retry());
    expect(latest.state).toEqual({ phase: 'error', message: 'Pitanja za ovaj zadatak nisu dostupna.' });
  });

  it('the thread cannot be read: an error, and a retry that reads again and then shows it', async () => {
    mockPublicFeed.mockResolvedValueOnce({ ok: false, kod: 'PUBLIC_QA_READ_FAILED', poruka: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' });
    await render();
    expect(latest.state).toEqual({ phase: 'error', message: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' });
    mockPublicFeed.mockResolvedValueOnce(ok([publicRow(Q1)]));
    await act(async () => latest.retry());
    expect(mockContext).toHaveBeenCalledTimes(2);
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 1 });
  });

  it('a read that throws is an error with a plain sentence, not an empty thread and not a crash', async () => {
    mockContext.mockRejectedValue(new Error('secret transport internals'));
    await render();
    expect(latest.state.phase).toBe('error');
    expect(JSON.stringify(latest.state)).not.toContain('secret');
    expect((latest.state as { message: string }).message).toBe('Pitanja trenutno nisu učitana. Proveri vezu i pokušaj ponovo.');
  });

  it('a return to the screen shows what it had at once, and when that read fails keeps it, as every other screen does', async () => {
    mockPublicFeed.mockResolvedValue(ok([publicRow(Q1)]));
    await render();
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 1 });
    mockFocused = false; await update();
    const back = deferred<unknown>();
    mockContext.mockReturnValueOnce(back.promise);
    mockFocused = true; await update();
    // The new read is in flight: what was read is still there, not a skeleton and not a blank.
    expect(mockContext).toHaveBeenCalledTimes(2);
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 1 });
    await act(async () => back.resolve({ ok: false, kod: 'QA_CONTEXT_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' }));
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 1 });
  });

  it('a return whose read succeeds replaces what was on screen with what the server now says', async () => {
    mockPublicFeed.mockResolvedValueOnce(ok([publicRow(Q1)]));
    await render();
    mockFocused = false; await update();
    mockPublicFeed.mockResolvedValueOnce(ok([publicRow(Q1), publicRow(Q2, { answeredAt: '2026-10-06T09:00:00Z' })]));
    mockFocused = true; await update();
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 2 });
  });

  it('an empty message from the service falls back to the plain sentence', async () => {
    mockContext.mockResolvedValue({ ok: false, kod: 'X', poruka: '' });
    await render();
    expect(latest.state).toEqual({ phase: 'error', message: 'Pitanja trenutno nisu učitana. Proveri vezu i pokušaj ponovo.' });
  });
});

describe('what it never shows', () => {
  it('a read that finishes after the account changed is dropped, and the new account reads for itself', async () => {
    const old = deferred<unknown>();
    mockContext.mockReturnValueOnce(old.promise).mockResolvedValueOnce(ok(context({ accountId: 'account-b' })));
    await render();
    mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
    await update();
    expect(mockContext).toHaveBeenCalledTimes(2);
    expect(mockContext).toHaveBeenLastCalledWith(NEED, { accountId: 'account-b', accountRevision: 2 });
    mockPublicFeed.mockResolvedValueOnce(ok([publicRow(Q1, { answerText: 'PRIVATE of account-a' })]));
    await act(async () => old.resolve(ok(context())));
    expect(JSON.stringify(latest.state)).not.toContain('PRIVATE');
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 0 });
  });

  it('a new incarnation of the same account (a re-login) starts empty and reads again', async () => {
    await render();
    expect(latest.state.phase).toBe('ready');
    const next = deferred<unknown>();
    mockContext.mockReturnValueOnce(next.promise);
    mockSession = { user: { id: 'account-a' }, accountRevision: 2 };
    await update();
    expect(latest.state).toEqual({ phase: 'loading' });
    expect(mockContext).toHaveBeenLastCalledWith(NEED, { accountId: 'account-a', accountRevision: 2 });
    await act(async () => next.resolve(ok(context())));
    expect(latest.state.phase).toBe('ready');
  });

  it('a read that finishes after the task changed is dropped', async () => {
    const old = deferred<unknown>();
    mockContext.mockReturnValueOnce(old.promise);
    mockPublicFeed.mockResolvedValue(ok([publicRow(Q1, { answerText: 'ANSWER about the first task' })]));
    await render(NEED);
    mockPublicFeed.mockResolvedValue(ok([]));
    await update(OTHER);
    await act(async () => old.resolve(ok(context())));
    expect(JSON.stringify(latest.state)).not.toContain('first task');
    expect(mockContext).toHaveBeenLastCalledWith(OTHER, { accountId: 'account-a', accountRevision: 1 });
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 0 });
  });

  it('reads the thread again when the version of the task changes, so an older question is not shown as current', async () => {
    mockPublicFeed.mockResolvedValue(ok([publicRow(Q1)]));
    await render(NEED, 2);
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 1 });
    mockContext.mockResolvedValue(ok(context({ needRevision: 3 })));
    await update(NEED, 3);
    expect(mockContext).toHaveBeenCalledTimes(2);
    expect(latest.state).toMatchObject({ phase: 'ready', listed: 0, olderVersion: true });
  });

  it('a task that goes away (a draft after an edit) is idle again and shows nothing of what it had', async () => {
    mockPublicFeed.mockResolvedValue(ok([publicRow(Q1)]));
    await render(NEED);
    expect(latest.state.phase).toBe('ready');
    await update(null);
    expect(latest.state).toEqual({ phase: 'idle' });
  });

  it('nothing lands after the screen is gone', async () => {
    const pending = deferred<unknown>();
    mockContext.mockReturnValueOnce(pending.promise);
    await render();
    await act(async () => tree.unmount());
    await act(async () => pending.resolve(ok(context())));
    expect(mockPublicFeed).not.toHaveBeenCalled();
  });
});
