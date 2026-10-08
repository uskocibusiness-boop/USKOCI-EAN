import React, { useSyncExternalStore } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AgreementMessageError, type AgreementMessageCommand } from '../../contracts/agreementMessages';
import { createAgreementOutbox } from '../agreementOutbox';
const mockAppListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer', AgreementPhotoSheet: 'AgreementPhotoSheet' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementChat } from '../../ui/AgreementChat';
import { forgetAutoResendForTests } from '../../ui/messages/threadModel';

/**
 * AUTO-RESEND (team T3c, 2026-10-07). A message whose send the network left unknown is tried once more by itself, ONLY through the
 * outbox's own `retry(clientMessageId)`: the same retained command with the same client message id. The server below behaves like
 * `rpc_send_agreement_message_v2` (a unique (sender, client message id) and the first message's id on every replay), so the proof
 * that no second message can appear is run against the REAL outbox, not a mock of it. Each message is tried automatically once;
 * the explicit "Proveri" is the person's and stays.
 */
const account = '10000000-0000-4000-8000-000000000001';
const agreement = '20000000-0000-4000-8000-000000000001';
const uuid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A server that stores a message once per (sender, client message id). `plan` is the fate of each call, in order. */
function fakeServer(plan: ('ok' | 'lost-before' | 'lost-after')[]) {
  const stored = new Map<string, string>();
  const calls: string[] = [];
  const send = jest.fn(async (command: AgreementMessageCommand) => {
    calls.push(command.clientMessageId);
    const fate = plan.shift() ?? 'ok';
    if (fate === 'lost-before') throw new AgreementMessageError('UNAVAILABLE');
    const key = `${command.accountId}:${command.clientMessageId}`;
    if (!stored.has(key)) stored.set(key, uuid(stored.size + 1));
    if (fate === 'lost-after') throw new AgreementMessageError('UNAVAILABLE');
    return { messageId: stored.get(key)! };
  });
  return { stored, calls, send };
}

let ids = 0;
function makeOutbox(port: { send: (command: AgreementMessageCommand) => Promise<{ messageId: string }> }, writable = () => true) {
  const memory = new Map<string, string>();
  return createAgreementOutbox({ accountId: account, agreementId: agreement, storage: {
    getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); } },
  messagePort: port, newId: () => `poruka_${String(++ids).padStart(8, '0')}`, isCurrent: () => true, canSendNew: writable });
}

type Outbox = ReturnType<typeof makeOutbox>;
let tree: ReactTestRenderer | undefined;
const refresh = jest.fn().mockResolvedValue(undefined);
function Harness({ outbox, ...over }: { outbox: Outbox } & Partial<React.ComponentProps<typeof AgreementChat>>) {
  const state = useSyncExternalStore(outbox.subscribe, outbox.getSnapshot, outbox.getSnapshot);
  return <AgreementChat messages={[]} loading={false} error={false} writable terminal={false} refresh={refresh}
    refreshWorkspace={jest.fn().mockResolvedValue(undefined)} outbox={outbox} state={state} {...over} />;
}
const mount = async (element: React.ReactElement) => { await act(async () => { tree = create(element, { createNodeMock: node => node.type === ('ScrollView' as never) ? { scrollToEnd: jest.fn(), scrollTo: jest.fn() } : null }); }); };
const until = async (condition: () => boolean) => {
  for (let index = 0; index < 200 && !condition(); index++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 2)); });
  expect(condition()).toBe(true);
};
const quiet = async () => { for (let index = 0; index < 15; index++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 2)); }); };
const emit = async (...states: string[]) => { for (const state of states) await act(async () => { [...mockAppListeners].forEach(listener => listener(state)); }); };
const entries = (outbox: Outbox) => outbox.getSnapshot().entries;
/** The person sends a message while the network is down for it. */
async function sendOne(outbox: Outbox, text = 'Stižem za 10 minuta.') {
  await outbox.start(); outbox.setDraft(text); await outbox.sendDraft();
}
beforeEach(() => { jest.clearAllMocks(); forgetAutoResendForTests(); mockAppListeners.clear(); ids = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1); jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined); });
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.restoreAllMocks(); });

describe('a send whose response was lost after the server stored it', () => {
  it('is retried once when the conversation opens, with the same client message id, and the server still holds ONE message', async () => {
    const server = fakeServer(['lost-after']);
    const outbox = makeOutbox(server);
    await sendOne(outbox);
    expect(entries(outbox)[0]).toMatchObject({ state: 'unknown', error: 'UNAVAILABLE' });
    expect(server.stored.size).toBe(1); expect(server.calls).toEqual(['poruka_00000001']);

    await mount(<Harness outbox={outbox} />);
    await until(() => entries(outbox)[0].state === 'confirmed');
    expect(server.calls).toEqual(['poruka_00000001', 'poruka_00000001']);          // the same id, twice
    expect(server.stored.size).toBe(1);                                              // never a second message
    expect(entries(outbox)[0].messageId).toBe(uuid(1));                              // the id of the message the server already had
    expect(entries(outbox)).toHaveLength(1);
    expect(refresh).toHaveBeenCalled();                                              // the thread reads the stored message back
  });

  it('is never sent a third time by itself: later events find it confirmed', async () => {
    const server = fakeServer(['lost-after']);
    const outbox = makeOutbox(server);
    await sendOne(outbox);
    await mount(<Harness outbox={outbox} />);
    await until(() => entries(outbox)[0].state === 'confirmed');
    await emit('background', 'active', 'inactive', 'active');
    await quiet();
    expect(server.send).toHaveBeenCalledTimes(2);
    expect(server.stored.size).toBe(1);
  });
});

describe('a send the network never delivered', () => {
  it('is tried once by itself and, if the network is still down, left for the person: later returns to the foreground do nothing more', async () => {
    const server = fakeServer(['lost-before', 'lost-before']);
    const outbox = makeOutbox(server);
    await sendOne(outbox);
    expect(server.stored.size).toBe(0);
    await mount(<Harness outbox={outbox} />);
    await until(() => server.send.mock.calls.length === 2);
    await quiet();
    expect(entries(outbox)[0]).toMatchObject({ state: 'unknown', error: 'UNAVAILABLE' });
    await emit('background', 'active'); await quiet();
    await emit('background', 'active'); await quiet();
    expect(server.send).toHaveBeenCalledTimes(2);                                    // once automatically, never more
    expect(server.stored.size).toBe(0);

    // The explicit "Proveri" is the person's and still works, once the network is back: one message, the same id.
    const retry = tree!.root.findByProps({ accessibilityLabel: 'Proveri da li je stigla: Stižem za 10 minuta.' });
    await act(async () => retry.props.onPress());
    await until(() => entries(outbox)[0].state === 'confirmed');
    expect(server.calls).toEqual(['poruka_00000001', 'poruka_00000001', 'poruka_00000001']);
    expect(server.stored.size).toBe(1);
  });

  it('is not tried at the moment of the failure, when the connection is surely down: only on a return to the foreground', async () => {
    const server = fakeServer(['lost-before', 'ok']);
    const outbox = makeOutbox(server);
    await outbox.start();
    await mount(<Harness outbox={outbox} />);
    await act(async () => { outbox.setDraft('Stižem.'); });
    await act(async () => { await outbox.sendDraft(); });
    await quiet();
    expect(entries(outbox)[0]).toMatchObject({ state: 'unknown' });
    expect(server.send).toHaveBeenCalledTimes(1);                                    // no retry just because it failed
    await emit('active');                                                            // "active" again without leaving: not a return
    await quiet();
    expect(server.send).toHaveBeenCalledTimes(1);
    await emit('background', 'active');                                              // a real return
    await until(() => entries(outbox)[0].state === 'confirmed');
    expect(server.calls).toEqual(['poruka_00000001', 'poruka_00000001']);
    expect(server.stored.size).toBe(1);
  });

  it('two events at once still make one retry', async () => {
    const server = fakeServer(['lost-before', 'ok']);
    const outbox = makeOutbox(server);
    await sendOne(outbox);
    await mount(<Harness outbox={outbox} />, );
    await act(async () => { [...mockAppListeners].forEach(listener => listener('background')); [...mockAppListeners].forEach(listener => listener('active'));
      [...mockAppListeners].forEach(listener => listener('background')); [...mockAppListeners].forEach(listener => listener('active')); });
    await until(() => entries(outbox)[0].state === 'confirmed');
    await quiet();
    expect(server.send.mock.calls.length).toBeLessThanOrEqual(2);
    expect(server.stored.size).toBe(1);
  });

  it('is tried when a read that was failing works again', async () => {
    const server = fakeServer(['lost-before', 'ok']);
    const outbox = makeOutbox(server);
    await sendOne(outbox);
    // The thread is opened while its own read is failing: nothing is sent into a thread that cannot be read back.
    await mount(<Harness outbox={outbox} error />);
    await quiet();
    expect(server.send).toHaveBeenCalledTimes(1);
    await act(async () => tree!.update(<Harness outbox={outbox} error={false} />));
    await until(() => entries(outbox)[0].state === 'confirmed');
    expect(server.calls).toEqual(['poruka_00000001', 'poruka_00000001']);
    expect(server.stored.size).toBe(1);
  });
});

describe('what is never retried by itself', () => {
  it('a refusal, a closed Dogovor, a Dogovor that takes no messages, and a message the server already confirmed', async () => {
    // A definite refusal.
    const refuse = { send: jest.fn(async () => { throw new AgreementMessageError('READ_ONLY'); }) };
    const refused = makeOutbox(refuse);
    await sendOne(refused);
    expect(entries(refused)[0]).toMatchObject({ state: 'failed', error: 'READ_ONLY' });
    await mount(<Harness outbox={refused} />);
    await quiet(); await emit('background', 'active'); await quiet();
    expect(refuse.send).toHaveBeenCalledTimes(1);
    await act(async () => tree!.unmount()); tree = undefined;

    // An unknown outcome, but the Dogovor is closed or does not take messages.
    for (const over of [{ terminal: true, writable: false }, { writable: false }] as const) {
      forgetAutoResendForTests();
      const server = fakeServer(['lost-before']);
      const outbox = makeOutbox(server);
      await sendOne(outbox);
      await mount(<Harness outbox={outbox} {...over} />);
      await quiet(); await emit('background', 'active'); await quiet();
      expect(server.send).toHaveBeenCalledTimes(1);
      await act(async () => tree!.unmount()); tree = undefined;
    }

    // Confirmed already.
    forgetAutoResendForTests();
    const fine = fakeServer(['ok']);
    const sent = makeOutbox(fine);
    await sendOne(sent);
    expect(entries(sent)[0].state).toBe('confirmed');
    await mount(<Harness outbox={sent} />);
    await quiet(); await emit('background', 'active'); await quiet();
    expect(fine.send).toHaveBeenCalledTimes(1);
  });

  it.each(['STORAGE_UNAVAILABLE', 'INVALID_RESPONSE', 'CONFLICT'] as const)('an unknown outcome that is %s, not the network, is left for the person', async error => {
    const command = { accountId: account, agreementId: agreement, clientMessageId: 'poruka_00000077', body: 'Stižem.' };
    const snapshot = { phase: 'ready' as const, draft: '', capturing: false, error: null,
      entries: [{ command, state: 'unknown' as const, error, persisted: true, attempt: 1 }] };
    const stub = { subscribe: () => () => {}, getSnapshot: () => snapshot, retry: jest.fn().mockResolvedValue(undefined),
      setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined) } as unknown as Outbox;
    await mount(<Harness outbox={stub} />);
    await quiet(); await emit('background', 'active'); await quiet();
    expect(stub.retry).not.toHaveBeenCalled();
  });

  it('while the network is the cause (or the answer never came), the same stub is retried: the filter is the error and nothing else', async () => {
    const command = { accountId: account, agreementId: agreement, clientMessageId: 'poruka_00000078', body: 'Stižem.' };
    const snapshot = { phase: 'ready' as const, draft: '', capturing: false, error: null,
      entries: [{ command, state: 'unknown' as const, error: 'UNAVAILABLE' as const, persisted: true, attempt: 1 }] };
    const stub = { subscribe: () => () => {}, getSnapshot: () => snapshot, retry: jest.fn().mockResolvedValue(undefined),
      setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined) } as unknown as Outbox;
    await mount(<Harness outbox={stub} />);
    await quiet(); await emit('background', 'active'); await quiet();
    expect(stub.retry).toHaveBeenCalledTimes(1);
    expect(stub.retry).toHaveBeenCalledWith('poruka_00000078');
    expect(stub.sendDraft).not.toHaveBeenCalled();
  });
});

describe('the retry is the outbox\'s own, so the id is the retained one', () => {
  it('never mints a new client message id: the draft path is not touched', async () => {
    const server = fakeServer(['lost-before', 'ok']);
    const outbox = makeOutbox(server);
    const sendDraft = jest.spyOn(outbox, 'sendDraft');
    await sendOne(outbox);
    const draftCalls = sendDraft.mock.calls.length;
    await mount(<Harness outbox={outbox} />);
    await until(() => entries(outbox)[0].state === 'confirmed');
    expect(sendDraft.mock.calls.length).toBe(draftCalls);
    expect(new Set(server.calls).size).toBe(1);
    expect(ids).toBe(1);                                                             // `newId` was called once, for the first send
  });
});
