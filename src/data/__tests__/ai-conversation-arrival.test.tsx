import React, { StrictMode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockAnnounce = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'AccessibilityInfo' ? { announceForAccessibility: (text: string) => mockAnnounce(text) } : Reflect.get(target, key);
  } });
});
import { useConversationArrival, type ConversationArrivalInput } from '../../ui/aiFirst/useConversationArrival';
const ai = (id: string, body = 'Odgovor je spreman.') => ({ id, fromAi: true, body });
const user = (id: string, body = 'Treba mi pomoć.') => ({ id, fromAi: false, body });
let tree: ReactTestRenderer, input: ConversationArrivalInput, arrival: ReturnType<typeof useConversationArrival>;
const Harness = () => { arrival = useConversationArrival(input); return null; };
const render = async (strict = false) => act(async () => { tree = create(strict ? <StrictMode><Harness /></StrictMode> : <Harness />); });
const update = async (patch: Partial<ConversationArrivalInput>, strict = false) => {
  input = { ...input, ...patch };
  await act(async () => tree.update(strict ? <StrictMode><Harness /></StrictMode> : <Harness />));
};
beforeEach(() => { input = { messages: [], streamingText: '', sentMessage: null, busy: false, conversationKey: 'account:conversation' };
  mockAnnounce.mockClear(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

test('initial history stays still and silent on repeat renders and recovery refreshes', async () => {
  input.messages = [user('u1'), ai('a1')]; await render();
  expect(arrival.shouldEnter('u1')).toBe(false); expect(arrival.shouldEnter('a1')).toBe(false);
  await update({ messages: [...input.messages], busy: true }); await update({ busy: false });
  expect(arrival.shouldEnter('a1')).toBe(false); expect(mockAnnounce).not.toHaveBeenCalled();
});
test('asynchronous initial history is silent, including an initially busy restored intent with no text', async () => {
  input.busy = true; await render(); await update({ busy: false });
  await update({ messages: [user('u1'), ai('a1'), user('u2'), ai('a2')] });
  expect(input.messages.every(message => !arrival.shouldEnter(message.id))).toBe(true); expect(mockAnnounce).not.toHaveBeenCalled();
});
test('a first local sent preview is replaced without entrance, and its completed answer arrives once', async () => {
  await render(); await update({ sentMessage: 'Treba mi pomoć.', busy: true });
  await update({ messages: [user('u1'), ai('a1')], sentMessage: null, busy: false });
  expect(arrival.shouldEnter('u1')).toBe(false); expect(arrival.shouldEnter('a1')).toBe(true);
  // Reading the result twice must not consume it during render (including a double StrictMode render).
  expect(arrival.shouldEnter('a1')).toBe(true); expect(mockAnnounce.mock.calls).toEqual([['USKOČI: Odgovor je spreman.']]);
  await update({ messages: [...input.messages] }); expect(arrival.shouldEnter('a1')).toBe(false); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('a stream never speaks by fragment and its persisted replacement does not enter a second time', async () => {
  input.messages = [user('u1'), ai('a1')]; await render();
  await update({ sentMessage: 'Novo pitanje', busy: true, streamingText: 'Novi' });
  await update({ streamingText: 'Novi odgovor' }); await update({ streamingText: 'Novi odgovor je spreman.' });
  expect(mockAnnounce).not.toHaveBeenCalled();
  await update({ messages: [...input.messages, user('u2', 'Novo pitanje'), ai('a2', 'Novi odgovor je spreman.')], streamingText: '', sentMessage: null, busy: false });
  expect(arrival.shouldEnter('u2')).toBe(false); expect(arrival.shouldEnter('a2')).toBe(false);
  expect(mockAnnounce.mock.calls).toEqual([['USKOČI: Novi odgovor je spreman.']]);
});
test('a cleared stream survives an unknown outcome until the eventual canonical answer, without per-retry speech', async () => {
  input.messages = [user('u1'), ai('a1')]; await render();
  await update({ sentMessage: 'Novo pitanje', streamingText: 'Stvaran delimičan odgovor', busy: true });
  await update({ streamingText: '', busy: false }); await update({ busy: true }); await update({ busy: false });
  expect(mockAnnounce).not.toHaveBeenCalled();
  await update({ messages: [...input.messages, user('u2', 'Novo pitanje'), ai('a2', 'Stvaran dovršen odgovor')], sentMessage: null });
  expect(arrival.shouldEnter('a2')).toBe(false); expect(mockAnnounce).toHaveBeenCalledTimes(1);
  await update({ busy: true }); await update({ busy: false }); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('a streamed first turn can arrive after history was initially empty', async () => {
  await render(); await update({ sentMessage: 'Treba mi pomoć.', streamingText: 'Odgovor', busy: true });
  await update({ messages: [user('u1'), ai('a1')], streamingText: '', sentMessage: null, busy: false });
  expect(arrival.shouldEnter('u1')).toBe(false); expect(arrival.shouldEnter('a1')).toBe(false); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('canonical user readback before completion does not lose the stream identity', async () => {
  input.messages = [user('u1'), ai('a1')]; await render();
  await update({ sentMessage: 'Novo pitanje', streamingText: 'Novi', busy: true });
  await update({ messages: [...input.messages, user('u2', 'Novo pitanje')], sentMessage: null });
  expect(arrival.shouldEnter('u2')).toBe(false);
  await update({ streamingText: '', busy: false });
  await update({ messages: [...input.messages, ai('a2', 'Novi odgovor')] });
  expect(arrival.shouldEnter('a2')).toBe(false); expect(mockAnnounce.mock.calls).toEqual([['USKOČI: Novi odgovor']]);
});
test('an overlap where the canonical answer arrives before stream cleanup is consumed only once', async () => {
  input.messages = [user('u1')]; await render(); await update({ streamingText: 'Odgovor' });
  await update({ messages: [...input.messages, ai('a1')] }); expect(arrival.shouldEnter('a1')).toBe(false);
  await update({ streamingText: 'Odgovor je spreman.' }); await update({ streamingText: '' });
  await update({ sentMessage: 'Drugo pitanje' });
  await update({ messages: [...input.messages, user('u2', 'Drugo pitanje'), ai('a2')], sentMessage: null });
  expect(arrival.shouldEnter('a2')).toBe(true); expect(mockAnnounce).toHaveBeenCalledTimes(2);
});
test('same answer text with a different actual ID is a distinct completed answer', async () => {
  input.messages = [user('u1'), ai('a1')]; await render();
  await update({ messages: [...input.messages, user('u2'), ai('a2')] });
  expect(arrival.shouldEnter('a2')).toBe(true); expect(mockAnnounce).toHaveBeenCalledTimes(1);
  await update({ messages: [...input.messages, user('u3'), ai('a3')] });
  expect(arrival.shouldEnter('a3')).toBe(true); expect(mockAnnounce).toHaveBeenCalledTimes(2);
});
test('prepending older history does not announce or animate it; an appended answer still arrives', async () => {
  input.messages = [user('u2'), ai('a2')]; await render();
  await update({ messages: [user('u1'), ai('a1'), ...input.messages, user('u3'), ai('a3')] });
  expect(arrival.shouldEnter('a1')).toBe(false); expect(arrival.shouldEnter('u1')).toBe(false); expect(arrival.shouldEnter('a3')).toBe(true);
  expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('temporary disappearance and readback of known IDs does not replay them', async () => {
  input.messages = [user('u1')]; await render(); await update({ messages: [...input.messages, ai('a1')] });
  await update({ messages: [] }); await update({ messages: [user('u1'), ai('a1')] });
  expect(arrival.shouldEnter('a1')).toBe(false); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('conversation/account replacement silently resets history and stream ownership', async () => {
  input.messages = [user('u1')]; await render(); await update({ streamingText: 'Stari odgovor', busy: true });
  await update({ conversationKey: 'another-account:another-conversation', messages: [user('u1'), ai('a1')], streamingText: '', busy: false });
  expect(arrival.shouldEnter('a1')).toBe(false); expect(mockAnnounce).not.toHaveBeenCalled();
  await update({ messages: [...input.messages, user('u2'), ai('a2')] });
  expect(arrival.shouldEnter('a2')).toBe(true); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('StrictMode and repeated props do not double-announce or consume the render decision', async () => {
  input.messages = [user('u1')]; await render(true);
  await update({ messages: [...input.messages, ai('a1')] }, true);
  expect(arrival.shouldEnter('a1')).toBe(true); expect(mockAnnounce).toHaveBeenCalledTimes(1);
  await update({ messages: [...input.messages] }, true);
  expect(arrival.shouldEnter('a1')).toBe(false); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});
test('an initial read with older history and the first visible local turn announces only that new answer', async () => {
  await render(); await update({ sentMessage: 'Novo pitanje', busy: true });
  await update({ messages: [user('old-u'), ai('old-a'), user('new-u', 'Novo pitanje'), ai('new-a', 'Nov odgovor')], sentMessage: null });
  expect(arrival.shouldEnter('old-a')).toBe(false); expect(arrival.shouldEnter('new-u')).toBe(false);
  expect(mockAnnounce.mock.calls).toEqual([['USKOČI: Nov odgovor']]);
});
test('a failed stream does not suppress a later separate turn that never streamed', async () => {
  input.messages = [user('u1'), ai('a1')]; await render();
  await update({ sentMessage: 'Pokušaj koji nije završen', streamingText: 'Deo odgovora', busy: true });
  await update({ streamingText: '', sentMessage: null, busy: false });
  expect(mockAnnounce).not.toHaveBeenCalled();
  await update({ sentMessage: 'Novo pitanje', busy: true });
  await update({ messages: [...input.messages, user('u2', 'Novo pitanje'), ai('a2')], sentMessage: null, busy: false });
  expect(arrival.shouldEnter('a2')).toBe(true); expect(mockAnnounce).toHaveBeenCalledTimes(1);
});


test('stream fragments do not copy a long canonical history ledger; a real arrival copies it once', async () => {
  input.messages = Array.from({ length: 1000 }, (_, index) => ai(`history-${index}`));
  await render();
  const iterate = Set.prototype[Symbol.iterator];
  let historyCopies = 0;
  const spy = jest.spyOn(Set.prototype, Symbol.iterator).mockImplementation(function (this: Set<unknown>) {
    if (this.has('history-0')) historyCopies++;
    return iterate.call(this);
  });
  try {
    for (let index = 0; index < 30; index++) await update({ streamingText: `Pristigli deo ${index}`, busy: true });
    expect(historyCopies).toBe(0);
    expect(mockAnnounce).not.toHaveBeenCalled();
    await update({ messages: [...input.messages, ai('new', 'Potvrđen odgovor.')], streamingText: '', busy: false });
    expect(historyCopies).toBe(1);
    expect(arrival.shouldEnter('new')).toBe(false);
    expect(mockAnnounce.mock.calls).toEqual([['USKOČI: Potvrđen odgovor.']]);
    await update({ messages: [...input.messages] });
    expect(historyCopies).toBe(1); expect(mockAnnounce).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); }
});
