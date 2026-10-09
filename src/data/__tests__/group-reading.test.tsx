import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { GroupMessage } from '../groupConversationService';
import { useGroupReading } from '../../ui/groups/useGroupReading';

let mockForeground = 'active';
const mockListeners = new Set<(value: string) => void>();
jest.mock('react-native', () => new Proxy(jest.requireActual('react-native'), { get(target, key) {
 if (key !== 'AppState') return Reflect.get(target, key);
 return {
  get currentState() { return mockForeground; },
  addEventListener: (_: string, listener: (value: string) => void) => {
    mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
  },
}; } }));
type Input = Parameters<typeof useGroupReading>[0];
const message = (id: string): GroupMessage => ({ messageId: id, sequence: id, senderAccountId: 'other', body: `Message ${id}`, createdAt: '2026-10-09T00:00:00Z', mine: false });
const scroll = (offset = 0) => ({ nativeEvent: { contentOffset: { x: 0, y: offset }, layoutMeasurement: { width: 360, height: 500 }, contentSize: { width: 360, height: 2000 } } }) as any;
const observation = (item: GroupMessage) => ({ viewableItems: [{ item, key: item.messageId, index: 0, isViewable: true }] });
let reading: ReturnType<typeof useGroupReading>, tree: ReactTestRenderer | undefined, input: Input, scope = 1;
const end = jest.fn(), offset = jest.fn(), frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const originalRequest = global.requestAnimationFrame, originalCancel = global.cancelAnimationFrame;
function Harness(props: Input) {
  reading = useGroupReading(props);
  reading.list.current = { scrollToEnd: end, scrollToOffset: offset } as any;
  return null;
}
const render = async (patch: Partial<Input> = {}) => {
  input = { ...input, ...patch };
  await act(async () => { if (tree) tree.update(<Harness key={scope} {...input} />); else tree = create(<Harness key={scope} {...input} />); });
};
const layout = async () => { await act(async () => { reading.onLayout(500); reading.onContentSizeChange(360, 2000); }); };
const flush = async () => { const pending = [...frames.values()]; frames.clear(); await act(async () => pending.forEach(callback => callback(0))); };
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockForeground = 'active'; scope = 1; frames.clear();
  global.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
  global.cancelAnimationFrame = id => { if (id != null) frames.delete(id); };
  input = { messages: [message('1'), message('2')], ready: true, covered: false, onVisible: jest.fn() };
});
afterEach(async () => {
  await act(async () => tree?.unmount()); tree = undefined;
  expect(mockListeners.size).toBe(0); expect(frames.size).toBe(0);
  global.requestAnimationFrame = originalRequest; global.cancelAnimationFrame = originalCancel;
  jest.useRealTimers();
});

it('opens at the latest only after both native measurements, without animation or read ACK', async () => {
  await render(); expect(end).not.toHaveBeenCalled();
  await act(async () => reading.onContentSizeChange(360, 2000)); expect(end).not.toHaveBeenCalled();
  await act(async () => reading.onLayout(500)); await flush();
  expect(end).toHaveBeenCalledTimes(2); expect(end).toHaveBeenLastCalledWith({ animated: false });
  expect(input.onVisible).not.toHaveBeenCalled();
});
it('cancels a queued settle when a finger starts reading, including an already retained RAF callback', async () => {
  await render(); await layout(); const queued = [...frames.values()][0]; end.mockClear();
  await act(async () => { reading.onScrollBeginDrag(); reading.onScroll(scroll(400)); queued(0); });
  expect(end).not.toHaveBeenCalled(); expect(reading.showLatest).toBe(true);
});
it('follows content and keyboard resizing at the bottom, but neither while reading history', async () => {
  await render(); await layout(); await flush(); end.mockClear();
  await act(async () => reading.onLayout(300)); expect(end).toHaveBeenCalled(); await flush(); end.mockClear();
  await act(async () => { reading.onScrollBeginDrag(); reading.onScrollEndDrag(scroll(300)); });
  await render({ messages: [...input.messages, message('3')] });
  await act(async () => { reading.onContentSizeChange(360, 2300); reading.onLayout(500); }); await flush();
  expect(end).not.toHaveBeenCalled(); expect(reading.showLatest).toBe(true);
});
it('an older-page prepend retains reading mode and the explicit latest action resumes following', async () => {
  await render(); await layout(); await flush(); end.mockClear();
  await act(async () => reading.readOlder());
  await render({ ready: false }); await render({ ready: true, messages: [message('0'), ...input.messages] });
  await act(async () => reading.onContentSizeChange(360, 2300)); expect(end).not.toHaveBeenCalled();
  expect(reading.readingLost).toBe(false);
  await act(async () => reading.chooseLatest()); expect(end).toHaveBeenCalled(); expect(reading.showLatest).toBe(false);
});
it('opening and closing a sheet keeps history in place without a blind offset restore', async () => {
  await render(); await layout(); await flush();
  await act(async () => { reading.onScrollBeginDrag(); reading.onScrollEndDrag(scroll(400)); }); end.mockClear();
  await act(async () => reading.cover()); await render({ covered: true }); await render({ covered: false });
  expect(end).not.toHaveBeenCalled(); expect(offset).not.toHaveBeenCalled(); expect(reading.showLatest).toBe(true);
});
it('rejects a pending native dwell callback after a quick sheet open/close; only a new observation may ACK', async () => {
  await render(); const stale = reading.onVisible;
  await act(async () => reading.cover()); await render({ covered: true }); const covered = reading.onVisible;
  await render({ covered: false });
  await act(async () => { stale(observation(input.messages[0])); covered(observation(input.messages[0])); });
  expect(input.onVisible).not.toHaveBeenCalled();
  await act(async () => reading.onVisible(observation(input.messages[0])));
  expect(input.onVisible).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(600));
  expect(input.onVisible).toHaveBeenCalledTimes(1);
});
it('restarts the full dwell after closing a cover over unchanged native geometry, never the old deadline', async () => {
  await render(); await layout(); await flush();
  // FlatList calls the newest props through its stable wrapper. There is no native timer with minimumViewTime=0.
  const nativeWrapper = () => reading.onVisible(observation(input.messages[0]));
  await act(async () => { nativeWrapper(); jest.advanceTimersByTime(500); reading.cover(); });
  await render({ covered: true }); await act(async () => jest.advanceTimersByTime(1000));
  expect(input.onVisible).not.toHaveBeenCalled();
  await render({ covered: false }); await act(async () => jest.advanceTimersByTime(599));
  expect(input.onVisible).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1)); expect(input.onVisible).toHaveBeenCalledTimes(1);
});
it('changed geometry invalidates a hidden observation until native visibility is observed again', async () => {
  await render(); await layout(); await flush(); await act(async () => reading.onVisible(observation(input.messages[0])));
  await act(async () => reading.cover()); await render({ covered: true });
  await act(async () => reading.onLayout(300)); await render({ covered: false });
  await act(async () => jest.advanceTimersByTime(1000)); expect(input.onVisible).not.toHaveBeenCalled();
  await act(async () => { reading.onVisible(observation(input.messages[0])); jest.advanceTimersByTime(600); });
  expect(input.onVisible).toHaveBeenCalledTimes(1);
});
it('accessible history scrolling suspends following without requiring a drag event', async () => {
  await render(); await layout(); await flush(); end.mockClear();
  await act(async () => reading.onAccessibilityAction('scrollBackward'));
  expect(offset).toHaveBeenCalledWith({ offset: 0, animated: false }); expect(reading.showLatest).toBe(true);
  await act(async () => reading.onContentSizeChange(360, 2300)); expect(end).not.toHaveBeenCalled();
});
it('rejects an observation for the previous page even when the index is the same', async () => {
  await render(); const stale = reading.onVisible;
  await render({ messages: [message('9')] }); await act(async () => stale(observation(message('1'))));
  expect(input.onVisible).not.toHaveBeenCalled();
});
it('warns when a fresh authoritative page removes the reading anchor without forcing the latest', async () => {
  await render(); await layout(); await flush();
  await act(async () => { reading.onVisible(observation(input.messages[0])); reading.onScrollBeginDrag(); reading.onScrollEndDrag(scroll(200)); });
  end.mockClear(); await render({ ready: false }); await render({ ready: true, messages: [message('9'), message('10')] });
  expect(reading.readingLost).toBe(true); expect(reading.showLatest).toBe(true); expect(end).not.toHaveBeenCalled();
  await act(async () => reading.chooseLatest()); expect(reading.readingLost).toBe(false); expect(end).toHaveBeenCalled();
});
it('does not call an append, prepend or retained anchor a lost position', async () => {
  await render(); await act(async () => { reading.readOlder(); reading.onVisible(observation(input.messages[1])); });
  await render({ messages: [message('0'), ...input.messages, message('3')] }); expect(reading.readingLost).toBe(false);
  await render({ messages: [message('2'), message('3')] }); expect(reading.readingLost).toBe(false);
});
it('does not invent a lost-position warning for an access/error purge or initial empty state', async () => {
  await render(); await act(async () => reading.readOlder());
  await render({ ready: false, messages: [] }); expect(reading.readingLost).toBe(false);
});
it('explains an authoritative empty replacement when the prior reading position is gone', async () => {
  await render(); await act(async () => reading.readOlder()); await render({ messages: [] });
  expect(reading.readingLost).toBe(true); expect(end).not.toHaveBeenCalled();
});
it('conservatively waits for native visibility again after scrolling with an unchanged visible-index set', async () => {
  await render(); await act(async () => { reading.onVisible(observation(input.messages[0])); reading.onScroll(scroll(10)); jest.advanceTimersByTime(600); });
  expect(input.onVisible).not.toHaveBeenCalled();
});
it('does not send a read receipt from a non-ready state or a pending dwell during send', async () => {
  await render(); await act(async () => reading.onVisible(observation(input.messages[0])));
  await render({ ready: false }); await act(async () => jest.advanceTimersByTime(600));
  expect(input.onVisible).not.toHaveBeenCalled();
});
it('a new account/group generation cannot be moved or acknowledged by old callbacks', async () => {
  await render(); await layout(); const old = reading, queued = [...frames.values()][0];
  scope++; await render(); end.mockClear();
  await act(async () => { queued(0); old.onVisible(observation(message('1'))); old.chooseLatest(); });
  expect(end).not.toHaveBeenCalled(); expect(input.onVisible).not.toHaveBeenCalled();
});
it('background cancels queued scroll and pending visibility, even before route cleanup', async () => {
  await render(); await layout(); const queued = [...frames.values()][0], old = reading.onVisible; end.mockClear();
  await act(async () => { mockForeground = 'background'; mockListeners.forEach(fn => fn('background')); queued(0); old(observation(message('1'))); });
  expect(end).not.toHaveBeenCalled(); expect(input.onVisible).not.toHaveBeenCalled();
});
