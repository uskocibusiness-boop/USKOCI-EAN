import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Reading ONE notification without opening it (T4a, 2026-10-07): the confirmed read is kept beside the inbox model and laid over
 * its page. These pin the rules the model keeps for its own commands: one at a time, nothing for a screen that is no longer the
 * person's, nothing shown before the server answered, a failure that changes nothing, and a store that belongs to ONE model.
 */
const mockService = jest.fn();
jest.mock('../../data/inboxClientService', () => ({ inboxClientService: { read: (...args: unknown[]) => mockService(...args) } }));
import { useInboxReads } from '../../ui/notifications/useInboxReads';

type Api = ReturnType<typeof useInboxReads>;
let api: Api;
let tree: ReactTestRenderer;
let owns = true;
const MODEL_A = {}, MODEL_B = {};
const unread = (id: string) => ({ id, readAt: null });
function Probe({ owner, read }: { owner: object; read?: (id: string) => Promise<string> }) {
  api = useInboxReads(owner, () => owns, read);
  return null;
}
const draw = async (owner: object = MODEL_A, read?: (id: string) => Promise<string>) => { await act(async () => { tree = create(<Probe owner={owner} read={read} />); }); };
const redraw = async (owner: object, read?: (id: string) => Promise<string>) => { await act(async () => { tree.update(<Probe owner={owner} read={read} />); }); };
beforeEach(() => { jest.clearAllMocks(); owns = true; mockService.mockReset().mockResolvedValue('2026-10-07T10:05:00Z'); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('reads through the very service a tapped row uses, and keeps the moment the server gave back', async () => {
  await draw();
  let done: boolean | undefined;
  await act(async () => { done = await api.markRead(unread('a')); });
  expect(done).toBe(true);
  expect(mockService.mock.calls).toEqual([['a']]);
  expect(api.stamps).toEqual({ a: '2026-10-07T10:05:00Z' });
  expect(api.pending).toBeNull(); expect(api.failed).toBe(false);
});

it('shows the row at work while the server has not answered, and nothing as read yet', async () => {
  let answer!: (value: string) => void;
  mockService.mockReturnValueOnce(new Promise<string>(resolve => { answer = resolve; }));
  await draw();
  let done: Promise<boolean>;
  await act(async () => { done = api.markRead(unread('a')); });
  expect(api.pending).toBe('a'); expect(api.stamps).toEqual({});
  await act(async () => { answer('2026-10-07T10:05:00Z'); await done; });
  expect(api.pending).toBeNull(); expect(api.stamps).toEqual({ a: '2026-10-07T10:05:00Z' });
});

it('one command at a time: a second one asked while the first runs is refused, and sends nothing', async () => {
  let answer!: (value: string) => void;
  mockService.mockReturnValueOnce(new Promise<string>(resolve => { answer = resolve; }));
  await draw();
  let first: Promise<boolean>, second: boolean | undefined;
  await act(async () => { first = api.markRead(unread('a')); second = await api.markRead(unread('b')); });
  expect(second).toBe(false); expect(mockService).toHaveBeenCalledTimes(1);
  await act(async () => { answer('2026-10-07T10:05:00Z'); await first; });
  // And once it is done the next one is welcome.
  await act(async () => { await api.markRead(unread('b')); });
  expect(mockService.mock.calls).toEqual([['a'], ['b']]);
  expect(Object.keys(api.stamps)).toEqual(['a', 'b']);
});

it('a row that is already read is not asked about again', async () => {
  await draw();
  await act(async () => { expect(await api.markRead({ id: 'a', readAt: '2026-10-07T09:00:00Z' })).toBe(false); });
  expect(mockService).not.toHaveBeenCalled();
});

it('a failure changes nothing, is remembered as a failure, and is forgotten when the list is read again', async () => {
  mockService.mockRejectedValueOnce(new Error('INBOX_REQUEST_UNCONFIRMED'));
  await draw();
  await act(async () => { expect(await api.markRead(unread('a'))).toBe(false); });
  expect(api.failed).toBe(true); expect(api.stamps).toEqual({}); expect(api.pending).toBeNull();
  await act(async () => { api.forgetFailure(); });
  expect(api.failed).toBe(false);
  // The next try is a fresh one and clears a failure the moment it starts.
  mockService.mockRejectedValueOnce(new Error('x'));
  await act(async () => { await api.markRead(unread('a')); });
  expect(api.failed).toBe(true);
  await act(async () => { await api.markRead(unread('a')); });
  expect(api.failed).toBe(false); expect(Object.keys(api.stamps)).toEqual(['a']);
});

it('sends nothing for a screen that is no longer the person\'s', async () => {
  await draw(); owns = false;
  await act(async () => { expect(await api.markRead(unread('a'))).toBe(false); });
  expect(mockService).not.toHaveBeenCalled(); expect(api.pending).toBeNull();
});

it('does not keep or show an answer that arrives after the screen was left', async () => {
  let answer!: (value: string) => void;
  mockService.mockReturnValueOnce(new Promise<string>(resolve => { answer = resolve; }));
  await draw();
  let done: Promise<boolean>;
  await act(async () => { done = api.markRead(unread('a')); });
  owns = false;
  await act(async () => { answer('2026-10-07T10:05:00Z'); expect(await done).toBe(false); });
  expect(api.stamps).toEqual({}); expect(api.pending).toBeNull(); expect(api.failed).toBe(false);
});

it('a failure that arrives after the screen was left is not held against the next visit', async () => {
  let fail!: (error: Error) => void;
  mockService.mockReturnValueOnce(new Promise<string>((_, reject) => { fail = reject; }));
  await draw();
  let done: Promise<boolean>;
  await act(async () => { done = api.markRead(unread('a')); });
  owns = false;
  await act(async () => { fail(new Error('late')); await done; });
  expect(api.failed).toBe(false); expect(api.pending).toBeNull();
});

it('what is kept belongs to ONE model: another set or another account starts with nothing, and coming back finds nothing either', async () => {
  await draw(MODEL_A);
  await act(async () => { await api.markRead(unread('a')); });
  expect(Object.keys(api.stamps)).toEqual(['a']);
  await redraw(MODEL_B);
  expect(api.stamps).toEqual({}); expect(api.pending).toBeNull(); expect(api.failed).toBe(false);
  // A read that lands under the new model is kept for the new model only.
  await act(async () => { await api.markRead(unread('b')); });
  expect(Object.keys(api.stamps)).toEqual(['b']);
  await redraw(MODEL_A);
  expect(api.stamps).toEqual({});
});

it('uses the read it is handed instead of the service, so a gallery or a test never reaches the network', async () => {
  const handed = jest.fn().mockResolvedValue('2026-10-07T10:06:00Z');
  await draw(MODEL_A, handed);
  await act(async () => { await api.markRead(unread('z')); });
  expect(handed.mock.calls).toEqual([['z']]); expect(mockService).not.toHaveBeenCalled();
  expect(api.stamps).toEqual({ z: '2026-10-07T10:06:00Z' });
});
