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

/**
 * R09 current contract: UNKNOWN is never a trigger for a write. Verify reads the
 * authorized history and exact-key reconciliation; resend is an explicit act.
 * The fake service still models a unique message per (sender, clientMessageId).
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
beforeEach(() => { jest.clearAllMocks(); mockAppListeners.clear(); ids = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1); jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined); });
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.restoreAllMocks(); });

describe('unknown send is read-only until the person explicitly resends', () => {
  it('opening and checking a lost-after-send receipt performs no second write; canonical read confirms it', async () => {
    const server = fakeServer(['lost-after']), outbox = makeOutbox(server);
    await sendOne(outbox);
    expect(entries(outbox)[0]).toMatchObject({ state: 'unknown', error: 'UNAVAILABLE' });
    expect(server.stored.size).toBe(1);
    await mount(<Harness outbox={outbox} />);
    await quiet();
    expect(server.calls).toEqual(['poruka_00000001']);
    const action = tree!.root.findByProps({ accessibilityLabel: 'Proveri da li je stigla: Stižem za 10 minuta.' });
    await act(async () => action.props.onPress());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(server.calls).toEqual(['poruka_00000001']);
    const command = entries(outbox)[0].command;
    await act(async () => outbox.reconcile([{ senderAccountId: account, clientMessageId: command.clientMessageId,
      messageId: uuid(1), body: command.body }]));
    expect(entries(outbox)[0]).toMatchObject({ state: 'confirmed', messageId: uuid(1) });
    expect(server.stored.size).toBe(1);
    expect(server.send).toHaveBeenCalledTimes(1);
  });

  it('foreground, repeated active, reconnect and re-opening cannot retry an unknown write', async () => {
    const server = fakeServer(['lost-before', 'ok']), outbox = makeOutbox(server);
    await sendOne(outbox);
    await mount(<Harness outbox={outbox} error />);
    await emit('background', 'active', 'inactive', 'active', 'active');
    await act(async () => tree!.update(<Harness outbox={outbox} error={false} />));
    await quiet();
    await act(async () => tree!.unmount()); tree = undefined;
    await mount(<Harness outbox={outbox} />);
    await quiet();
    expect(entries(outbox)[0].state).toBe('unknown');
    expect(server.calls).toEqual(['poruka_00000001']);
    expect(server.stored.size).toBe(0);
  });

  it('checking an absent message does not send; a separate explicit resend uses the original id', async () => {
    const server = fakeServer(['lost-before', 'ok']), outbox = makeOutbox(server);
    const sendDraft = jest.spyOn(outbox, 'sendDraft');
    await sendOne(outbox);
    const firstDraftCalls = sendDraft.mock.calls.length;
    await mount(<Harness outbox={outbox} />);
    await act(async () => tree!.root.findByProps({
      accessibilityLabel: 'Proveri da li je stigla: Stižem za 10 minuta.',
    }).props.onPress());
    expect(entries(outbox)[0].state).toBe('unknown');
    expect(server.calls).toEqual(['poruka_00000001']);
    await act(async () => tree!.root.findByProps({
      accessibilityLabel: 'Ponovi slanje poruke Stižem za 10 minuta.',
    }).props.onPress());
    await until(() => entries(outbox)[0].state === 'confirmed');
    expect(server.calls).toEqual(['poruka_00000001', 'poruka_00000001']);
    expect(server.stored.size).toBe(1);
    expect(sendDraft.mock.calls.length).toBe(firstDraftCalls);
    expect(ids).toBe(1);
  });

  it('failed-before-send remains UNKNOWN after explicit resend if offline, without further automatic attempts', async () => {
    const server = fakeServer(['lost-before', 'lost-before', 'ok']), outbox = makeOutbox(server);
    await sendOne(outbox);
    await mount(<Harness outbox={outbox} />);
    await act(async () => tree!.root.findByProps({
      accessibilityLabel: 'Ponovi slanje poruke Stižem za 10 minuta.',
    }).props.onPress());
    await quiet();
    expect(entries(outbox)[0].state).toBe('unknown');
    expect(server.calls).toHaveLength(2);
    await emit('background', 'active', 'background', 'active');
    await quiet();
    expect(server.calls).toHaveLength(2);
    expect(server.stored.size).toBe(0);
  });

  it('closed/read-only Dogovori allow a read-only check but expose no resend button', async () => {
    for (const over of [{ terminal: true, writable: false }, { writable: false }] as const) {
      const server = fakeServer(['lost-before']), outbox = makeOutbox(server);
      await sendOne(outbox);
      await mount(<Harness outbox={outbox} {...over} />);
      expect(tree!.root.findAllByProps({ accessibilityLabel: 'Ponovi slanje poruke Stižem za 10 minuta.' })).toHaveLength(0);
      await act(async () => tree!.root.findByProps({
        accessibilityLabel: 'Proveri da li je stigla: Stižem za 10 minuta.',
      }).props.onPress());
      expect(server.send).toHaveBeenCalledTimes(1);
      await emit('background', 'active');
      expect(server.send).toHaveBeenCalledTimes(1);
      await act(async () => tree!.unmount()); tree = undefined;
    }
  });

  it('server refusal never auto-retries; an explicit retry still requires a writable screen', async () => {
    const refused = { send: jest.fn(async () => { throw new AgreementMessageError('READ_ONLY'); }) };
    const outbox = makeOutbox(refused);
    await sendOne(outbox);
    expect(entries(outbox)[0].state).toBe('failed');
    await mount(<Harness outbox={outbox} />);
    await emit('background', 'active');
    expect(refused.send).toHaveBeenCalledTimes(1);
    await act(async () => tree!.root.findByProps({
      accessibilityLabel: 'Ponovi slanje poruke Stižem za 10 minuta.',
    }).props.onPress());
    await quiet();
    expect(refused.send).toHaveBeenCalledTimes(2);
  });

  it.each(['STORAGE_UNAVAILABLE', 'INVALID_RESPONSE', 'CONFLICT', 'UNAVAILABLE'] as const)(
    '%s unknown recovery never sends without explicit intent', async error => {
      const command = { accountId: account, agreementId: agreement, clientMessageId: 'poruka_00000077', body: 'Stižem.' };
      const snapshot = { phase: 'ready' as const, draft: '', capturing: false, error: null,
        entries: [{ command, state: 'unknown' as const, error, persisted: true, attempt: 1 }] };
      const stub = { subscribe: () => () => {}, getSnapshot: () => snapshot, retry: jest.fn().mockResolvedValue(undefined),
        setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined) } as unknown as Outbox;
      await mount(<Harness outbox={stub} />);
      await quiet(); await emit('background', 'active');
      await act(async () => tree!.root.findByProps({
        accessibilityLabel: 'Proveri da li je stigla: Stižem.',
      }).props.onPress());
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(stub.retry).not.toHaveBeenCalled();
      expect(stub.sendDraft).not.toHaveBeenCalled();
    });
});
