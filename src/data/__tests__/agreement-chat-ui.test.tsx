import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OutboxSnapshot } from '../agreementOutbox';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer', AgreementPhotoSheet: 'AgreementPhotoSheet' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
jest.mock('../../ui/system/haptics', () => ({ tick: jest.fn(), forgetTicks: jest.fn() }));
import { tick } from '../../ui/system/haptics';
import { AgreementChat, CLOSED_SENTENCE, messageSpoken } from '../../ui/AgreementChat';
import { forgetAutoResendForTests, takeAutoResend } from '../../ui/messages/threadModel';

const account = '10000000-0000-4000-8000-000000000001';
const agreement = '20000000-0000-4000-8000-000000000001';
const command = { accountId: account, agreementId: agreement, clientMessageId: 'poruka_retry_123', body: 'Stižem uskoro.' };
// The mark by my message, found by its spoken word (the small mark draws no text).
const marks = (word: string) => tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityLabel === word && node.props.accessibilityRole === 'image');
const localBubbles = () => tree.root.findAll(node => String(node.type) === 'View' && String(node.props.testID ?? '').startsWith('agreement-local-message-'));
const outbox = { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined) } as any;
let state: OutboxSnapshot;
let tree: ReactTestRenderer;
let props: React.ComponentProps<typeof AgreementChat>;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
// Review r4 rd item 2: a bubble is heard as the message itself ("Ti: <tekst>, Danas, 12:00"); it was "Poruka: <ime>", which
// hid the text and the time. A bubble is found by who wrote it, the start of that label.
const held = (who: string) => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string'
  && node.props.accessibilityLabel.startsWith(`${who}: `))[0];
const scrollToEnd = jest.fn();
const scrollTo = jest.fn();
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const scrollEvent = (y: number, height = 600, content = 3000) => ({ nativeEvent: {
  contentOffset: { y }, layoutMeasurement: { height }, contentSize: { height: content },
} });
const flushFrames = async () => act(async () => {
  const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0));
});
async function render(overrides: Partial<typeof props> = {}) {
  await act(async () => { tree = create(<AgreementChat {...props} {...overrides} />, {
    createNodeMock: element => element.type === ('ScrollView' as any) ? { scrollToEnd, scrollTo } : null,
  }); });
}
beforeEach(() => {
  jest.clearAllMocks();
  // These cases are about the person's own retry. The automatic retry (once per message, on opening the thread, on the return
  // to the foreground or when a failing read works again) has its own suite, so the fixture message is spent here.
  forgetAutoResendForTests();
  takeAutoResend([{ command, state: 'unknown', persisted: true, attempt: 1 }]);
  frames.clear(); frameId = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => { if (id != null) frames.delete(id); });
  state = { phase: 'ready', draft: 'Nova poruka', capturing: false, entries: [], error: null };
  props = { messages: [], loading: false, error: false, writable: true, terminal: false,
    refresh: jest.fn().mockResolvedValue(undefined), refreshWorkspace: jest.fn().mockResolvedValue(undefined), outbox, state };
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
describe('D03 actual message component', () => {
  it('lands a notification anchor at its measured row and waits for native visibility before acknowledging it',async()=>{
    const messages=['older','target','newer'].map(id=>({id,telo:id,moja:false,posiljalacIme:'Marko',vremeTekst:'12:00',procitano:null}));
    const readingPosition={current:{following:false,offset:0,anchor:{messageId:'target',within:0}}};
    const onDisplayedMessageIds=jest.fn();
    await render({messages,readingPosition,hasOlder:true,hasNewer:true,onDisplayedMessageIds});
    const scroll=tree.root.findByProps({testID:'agreement-chat-history'});
    await act(async()=>{
      scroll.props.onLayout({nativeEvent:{layout:{height:200}}});scroll.props.onContentSizeChange(390,2000);
      tree.root.findByProps({testID:'agreement-message-row-older'}).props.onLayout({nativeEvent:{layout:{y:100}}});
    });
    await flushFrames();expect(scrollTo).not.toHaveBeenCalled();expect(onDisplayedMessageIds).not.toHaveBeenCalled();
    await act(async()=>{
      tree.root.findByProps({testID:'agreement-message-row-target'}).props.onLayout({nativeEvent:{layout:{y:700}}});
      tree.root.findByProps({testID:'agreement-message-bubble-target'}).props.onLayout({nativeEvent:{layout:{y:0,height:80}}});
    });
    await flushFrames();
    expect(scrollTo).toHaveBeenLastCalledWith({y:700,animated:false});expect(scrollToEnd).not.toHaveBeenCalled();
    expect(onDisplayedMessageIds).not.toHaveBeenCalled();
    await act(async()=>scroll.props.onScroll(scrollEvent(700,200,2000)));await flushFrames();
    expect(onDisplayedMessageIds).toHaveBeenLastCalledWith(['target']);
  });
  it('never injects hydrated or evicted confirmed receipts into an older window but keeps newly confirmed sends', async () => {
    const messageId = '30000000-0000-4000-8000-000000000001';
    const confirmed = { command, state: 'confirmed' as const, messageId, persisted: true, attempt: 1 };
    await render({ state: { ...state, entries: [confirmed] }, hasNewer: true });
    expect(texts()).not.toContain('Stižem uskoro.');
    await act(async () => tree.unmount());
    await render(); // A new command can transition directly to confirmed in one batched render.
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, entries: [confirmed] }} />));
    // The newly confirmed send stands in its own bubble with the one check, until the read returns it.
    expect(texts()).toContain('Stižem uskoro.'); expect(localBubbles()).toHaveLength(1); expect(marks('Poslato')).toHaveLength(1);
    const canonical = { id: messageId, telo: command.body, moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null,
      posiljalacAccountId: account, clientMessageId: command.clientMessageId };
    await act(async () => tree.update(<AgreementChat {...props} messages={[canonical]} state={{ ...state, entries: [confirmed] }} />));
    // The read's own row replaces it: one bubble with the text, no local copy.
    expect(localBubbles()).toHaveLength(0); expect(texts().split('Stižem uskoro.')).toHaveLength(2);
    await act(async () => tree.update(<AgreementChat {...props} messages={[]} hasNewer state={{ ...state, entries: [confirmed] }} />));
    expect(texts()).not.toContain('Stižem uskoro.'); expect(localBubbles()).toHaveLength(0); expect(marks('Poslato')).toHaveLength(0);
    const unknown = { command: { ...command, clientMessageId: 'another_send_attempt' }, state: 'unknown' as const, persisted: true, attempt: 1 };
    await act(async () => tree.update(<AgreementChat {...props} messages={[]} hasNewer state={{ ...state, entries: [confirmed, unknown] }} />));
    expect(texts()).toContain('Ne znamo da li je stigla');
  });

  it('recovers a missing saved anchor with one explicit latest action even without a newer cursor', async () => {
    const readingPosition = { current: { following: false, offset: 540, anchor: { messageId: 'gone', within: 40 } } };
    const onShowLatest = jest.fn().mockResolvedValue(undefined);
    await render({ readingPosition, error: true, onShowLatest });
    await act(async () => button('Najnovije poruke').props.onPress());
    expect(onShowLatest).toHaveBeenCalledTimes(1);
    expect(readingPosition.current.following).toBe(true);
    expect(readingPosition.current.anchor).toBeUndefined();
  });

  it('retires middle-row geometry even when the first message is unchanged', async () => {
    const messages = ['first', 'held'].map(id => ({ id, telo: id, moja: false, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }));
    const onDisplayedMessageIds = jest.fn();
    await render({ messages, onDisplayedMessageIds });
    await act(async () => {
      const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
      scroll.props.onLayout({ nativeEvent: { layout: { height: 200 } } }); scroll.props.onContentSizeChange(390, 2000);
      tree.root.findByProps({ testID: 'agreement-message-row-held' }).props.onLayout({ nativeEvent: { layout: { y: 500 } } });
      tree.root.findByProps({ testID: 'agreement-message-bubble-held' }).props.onLayout({ nativeEvent: { layout: { y: 0, height: 80 } } });
      scroll.props.onScroll(scrollEvent(450, 200, 2000));
    });
    await flushFrames(); expect(onDisplayedMessageIds).toHaveBeenCalledWith(['held']); onDisplayedMessageIds.mockClear();
    const expanded = [messages[0], { ...messages[0], id: 'inserted' }, messages[1]];
    await act(async () => tree.update(<AgreementChat {...props} messages={expanded} onDisplayedMessageIds={onDisplayedMessageIds} />));
    await act(async () => tree.root.findByProps({ testID: 'agreement-chat-history' }).props.onScroll(scrollEvent(450, 200, 2100)));
    await flushFrames(); expect(onDisplayedMessageIds).not.toHaveBeenCalled();
  });

  it('acknowledges only measured incoming bubbles in the observed viewport, not the loaded page or day label', async () => {
    const messages = ['offscreen', 'visible', 'mine', 'day-only'].map((id, index) => ({ id, telo: id,
      moja: index === 2, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }));
    const onDisplayedMessageIds = jest.fn();
    await render({ messages, onDisplayedMessageIds });
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 200 } } });
      scroll.props.onContentSizeChange(390, 2000);
      for (const [id, y, bubbleY] of [['offscreen', 0, 20], ['visible', 500, 20], ['mine', 550, 20], ['day-only', 635, 40]] as const) {
        tree.root.findByProps({ testID: `agreement-message-row-${id}` }).props.onLayout({ nativeEvent: { layout: { y } } });
        tree.root.findByProps({ testID: `agreement-message-bubble-${id}` }).props.onLayout({ nativeEvent: { layout: { y: bubbleY, height: 80 } } });
      }
    });
    await flushFrames();
    expect(onDisplayedMessageIds).not.toHaveBeenCalled(); // Programmatic following is not proof of a displayed row.
    await act(async () => scroll.props.onScroll(scrollEvent(450, 200, 2000)));
    await flushFrames();
    expect(onDisplayedMessageIds).toHaveBeenLastCalledWith(['visible']);
    onDisplayedMessageIds.mockClear();
    const staleRow = tree.root.findByProps({ testID: 'agreement-message-row-visible' }).props.onLayout;
    const staleScroll = scroll.props.onScroll;
    await act(async () => tree.update(<AgreementChat {...props} messages={[]} onDisplayedMessageIds={onDisplayedMessageIds} error />));
    await act(async () => { staleRow({ nativeEvent: { layout: { y: 500 } } }); staleScroll(scrollEvent(450, 200, 2000)); });
    await flushFrames();
    expect(onDisplayedMessageIds).not.toHaveBeenCalled();
  });

  it('keeps the exact held message when an older page is prepended and does not treat a window end as latest', async () => {
    const messages = ['first', 'held', 'last'].map(id => ({ id, telo: id, moja: false, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }));
    const readingPosition: React.ComponentProps<typeof AgreementChat>['readingPosition'] = { current: { following: false, offset: 540, anchor: { messageId: 'held', within: 40 } } };
    let finish!: () => void;
    const onLoadOlder = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const onShowLatest = jest.fn().mockResolvedValue(undefined);
    await render({ messages, readingPosition, hasOlder: true, hasNewer: true, onLoadOlder, onShowLatest });
    await act(async () => {
      const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
      scroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } }); scroll.props.onContentSizeChange(390, 3000);
      tree.root.findByProps({ testID: 'agreement-message-row-held' }).props.onLayout({ nativeEvent: { layout: { y: 500 } } });
    });
    await flushFrames();
    await act(async () => button('Učitaj starije poruke').props.onPress());
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
    const expanded = [{ ...messages[0], id: 'older' }, ...messages];
    await act(async () => tree.update(<AgreementChat {...props} messages={expanded} readingPosition={readingPosition}
      hasOlder hasNewer onLoadOlder={onLoadOlder} onShowLatest={onShowLatest} />));
    await act(async () => {
      tree.root.findByProps({ testID: 'agreement-chat-history' }).props.onContentSizeChange(390, 3300);
      tree.root.findByProps({ testID: 'agreement-message-row-held' }).props.onLayout({ nativeEvent: { layout: { y: 800 } } });
      finish();
    });
    await flushFrames();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 840, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => {
      const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
      scroll.props.onScrollBeginDrag(scrollEvent(2700, 600, 3300)); scroll.props.onScrollEndDrag(scrollEvent(2700, 600, 3300));
    });
    expect(readingPosition.current.following).toBe(false);
    await act(async () => button('Najnovije poruke').props.onPress());
    expect(onShowLatest).toHaveBeenCalledTimes(1);
    expect(readingPosition.current.following).toBe(true);
  });

  it('keeps history, writing and photo recovery while refresh progress and its failure have separate feedback', async () => {
    const history = [{ id: '30000000-0000-4000-8000-000000000001', telo: 'Prethodna poruka', moja: false,
      posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }];
    const photos = { loaded: true, busy: false, hasSelection: true, ready: false, agreementId: agreement,
      items: [], message: 'Fotografija čeka ponovni pokušaj.', canSubmit: () => false, refresh: jest.fn().mockResolvedValue(undefined) } as any;
    const pending = { ...state, entries: [{ command, state: 'unknown' as const, persisted: true, attempt: 1 }] };
    await render({ messages: history, photos, state: pending, refreshing: true });
    expect(tree.root.findByType('ScrollView' as any).props.refreshControl.props.refreshing).toBe(true);
    expect(button('Osveži poruke').props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(texts()).toContain('Prethodna poruka'); expect(texts()).toContain('Ne znamo da li je stigla');
    expect(button('Napiši poruku').props.value).toBe('Nova poruka');
    expect(tree.root.findByType('AgreementPhotoComposer' as any).props.photos).toBe(photos);
    await act(async () => tree.update(<AgreementChat {...props} messages={history} photos={photos} state={pending} refreshError />));
    expect(texts()).toContain('Nove poruke nisu proverene.'); expect(texts()).not.toContain('Poruke nisu učitane');
    expect(texts()).toContain('Prethodna poruka'); expect(texts()).toContain('Ne znamo da li je stigla');
    expect(button('Napiši poruku').props.value).toBe('Nova poruka');
    expect(tree.root.findByType('ScrollView' as any).props.refreshControl.props.refreshing).toBe(false);
    await act(async () => button('Ponovo proveri nove poruke').props.onPress());
    expect(props.refresh).toHaveBeenCalledTimes(1);
    await act(async () => button(`Proveri da li je stigla: ${command.body}`).props.onPress());
    expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
    expect(photos.refresh).toHaveBeenCalledTimes(1);
  });

  it('restores the same historical message after the foreground gate remounts a fresh transcript', async () => {
    const messages = ['first', 'held', 'last'].map(id => ({ id, telo: id, moja: false, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }));
    const readingPosition: React.ComponentProps<typeof AgreementChat>['readingPosition'] = { current: { following: true, offset: 0 } };
    await render({ messages, readingPosition });
    await act(async () => {
      tree.root.findByProps({ testID: 'agreement-message-row-held' }).props.onLayout({ nativeEvent: { layout: { y: 500 } } });
      const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
      scroll.props.onScrollBeginDrag(scrollEvent(540)); scroll.props.onScrollEndDrag(scrollEvent(540));
    });
    expect(readingPosition.current).toEqual({ following: false, offset: 540, anchor: { messageId: 'held', within: 40 } });
    await act(async () => tree.unmount());
    scrollToEnd.mockClear(); scrollTo.mockClear();
    const recovered = { ...state, entries: [{ command, state: 'unknown' as const, persisted: true, attempt: 1 }] };
    await render({ messages: [], loading: true, readingPosition });
    await act(async () => tree.update(<AgreementChat {...props} messages={messages} state={recovered} readingPosition={readingPosition} />));
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
      scroll.props.onContentSizeChange(390, 3400);
    });
    await flushFrames();
    expect(scrollTo).not.toHaveBeenCalled(); // The saved row is not laid out yet.
    await act(async () => tree.root.findByProps({ testID: 'agreement-message-row-held' }).props.onLayout({ nativeEvent: { layout: { y: 680 } } }));
    await flushFrames();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 720, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(button('Najnovije poruke')).toBeTruthy();
  });

  it('retains historical reading intent through StrictMode effect replay', async () => {
    const setup = jest.fn(); const cleanup = jest.fn();
    function ReplayWitness() { React.useEffect(() => { setup(); return cleanup; }, []); return null; }
    const readingPosition = { current: { following: false, offset: 540 } };
    await act(async () => { tree = create(<React.StrictMode><ReplayWitness />
      <AgreementChat {...props} readingPosition={readingPosition} /></React.StrictMode>, {
      createNodeMock: element => element.type === ('ScrollView' as any) ? { scrollToEnd, scrollTo } : null,
    }); });
    expect(setup).toHaveBeenCalledTimes(2); expect(cleanup).toHaveBeenCalledTimes(1);
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } }); scroll.props.onContentSizeChange(390, 3000);
    });
    await flushFrames();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 540, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('lets a new reading gesture cancel restoration instead of pulling the reader back', async () => {
    const readingPosition = { current: { following: false, offset: 800 } };
    await render({ readingPosition });
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
      scroll.props.onContentSizeChange(390, 3000);
      scroll.props.onScrollBeginDrag(scrollEvent(400)); scroll.props.onScrollEndDrag(scrollEvent(400));
    });
    await flushFrames();
    expect(scrollTo).not.toHaveBeenCalled(); expect(scrollToEnd).not.toHaveBeenCalled();
    expect(readingPosition.current.offset).toBe(400);
  });

  it('does not let retired native callbacks overwrite the remounted chat reading intent', async () => {
    const readingPosition = { current: { following: false, offset: 800 } };
    await render({ readingPosition });
    const retiredScroll = tree.root.findByProps({ testID: 'agreement-chat-history' }).props.onScrollEndDrag;
    const retiredContext = tree.root.findByProps({ testID: 'agreement-chat-context' }).props.onLayout;
    await act(async () => tree.unmount());
    readingPosition.current = { following: false, offset: 420 };
    await render({ readingPosition });
    await act(async () => {
      retiredScroll(scrollEvent(1800)); retiredContext({ nativeEvent: { layout: { height: 700 } } });
    });
    expect(readingPosition.current).toEqual({ following: false, offset: 420 });
  });

  it('clamps the old offset when a saved anchor no longer exists in the fresh read', async () => {
    const readingPosition = { current: { following: false, offset: 2500, anchor: { messageId: 'missing', within: 10 } } };
    await render({ readingPosition });
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } }); scroll.props.onContentSizeChange(390, 1000);
    });
    await flushFrames();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 400, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('offers draft storage recovery without hiding ready unknown-command retry', async () => {
    await render({ state: { ...state, error: 'STORAGE_UNAVAILABLE',
      entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] } });
    expect(button('Napiši poruku').props.value).toBe(state.draft);
    expect(button(`Proveri da li je stigla: ${command.body}`)).toBeTruthy();
    await act(async () => button('Ponovo učitaj sačuvane poruke').props.onPress());
    expect(outbox.start).toHaveBeenCalledTimes(1);
  });

  it('retires photo preparations after exact retry using the current controller and ignores a departed owner', async () => {
    let settle!: () => void;
    outbox.retry.mockImplementationOnce(() => new Promise<void>(resolve => { settle = resolve; }));
    const oldPhotos = { loaded: true, busy: false, hasSelection: false, items: [], agreementId: agreement, refresh: jest.fn() } as any;
    const newPhotos = { ...oldPhotos, refresh: jest.fn().mockResolvedValue(undefined) };
    const pending = { ...state, entries: [{ command, state: 'unknown' as const, persisted: true, attempt: 1 }] };
    await render({ state: pending, photos: oldPhotos });
    await act(async () => button(`Proveri da li je stigla: ${command.body}`).props.onPress());
    await act(async () => tree.update(<AgreementChat {...props} state={pending} photos={newPhotos} />));
    await act(async () => settle());
    expect(oldPhotos.refresh).not.toHaveBeenCalled(); expect(newPhotos.refresh).toHaveBeenCalledTimes(1);
    outbox.retry.mockImplementationOnce(() => new Promise<void>(resolve => { settle = resolve; }));
    await act(async () => button(`Proveri da li je stigla: ${command.body}`).props.onPress());
    await act(async () => tree.unmount());
    await act(async () => settle());
    expect(newPhotos.refresh).toHaveBeenCalledTimes(1); expect(props.refresh).toHaveBeenCalledTimes(1);
  });

  it('preserves older-history reading position when retained-refresh feedback changes height', async () => {
    await render({ messages: [{ id: 'message', telo: 'Starija poruka', moja: false, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }] });
    const history = tree.root.findByProps({ testID: 'agreement-chat-history' });
    const context = () => tree.root.findByProps({ testID: 'agreement-chat-context' });
    expect(context().findByProps({ accessibilityLabel: 'Osveži poruke' })).toBeTruthy();
    await act(async () => {
      context().props.onLayout({ nativeEvent: { layout: { height: 48 } } });
      history.props.onScrollBeginDrag(scrollEvent(200)); history.props.onScrollEndDrag(scrollEvent(200));
    });
    scrollToEnd.mockClear();
    await act(async () => tree.update(<AgreementChat {...props} messages={[{ id: 'message', telo: 'Starija poruka', moja: false, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }]} refreshError />));
    expect(context().findByProps({ accessibilityLabel: 'Ponovo proveri nove poruke' })).toBeTruthy();
    await act(async () => context().props.onLayout({ nativeEvent: { layout: { height: 90 } } }));
    // The notice replaced the 48-high action; only its additional 42 shifts the message.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 242, animated: false });
    await act(async () => tree.update(<AgreementChat {...props} messages={[{ id: 'message', telo: 'Starija poruka', moja: false, posiljalacIme: 'Marko', vremeTekst: '12:00', procitano: null }]} refreshing />));
    await act(async () => context().props.onLayout({ nativeEvent: { layout: { height: 48 } } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled(); expect(button('Najnovije poruke')).toBeTruthy();
  });

  it('sends one explicit photo-only command and preserves a pending selection instead of silently sending text alone', async () => {
    const attachments = { agreementVersion: 3, assetIds: ['40000000-0000-4000-8000-000000000001'] };
    const photos = { loaded: true, busy: false, ready: true, hasSelection: true, agreementId: agreement,
      canSubmit: jest.fn(() => true), capture: jest.fn(() => attachments), refresh: jest.fn().mockResolvedValue(undefined) } as any;
    await render({ state: { ...state, draft: '' }, photos });
    expect(button('Pošalji poruku').props.disabled).toBe(false); expect(outbox.sendDraft).not.toHaveBeenCalled();
    await act(async () => button('Pošalji poruku').props.onPress()); expect(outbox.sendDraft).toHaveBeenCalledWith(attachments);
    expect(photos.refresh).toHaveBeenCalledTimes(1);
    const retained = button('Pošalji poruku').props.onPress;
    photos.canSubmit.mockReturnValue(false);
    await act(async () => retained()); expect(outbox.sendDraft).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, ready: false }} />));
    expect(button('Pošalji poruku').props.disabled).toBe(true);
  });
  it('reads historical photographs under exact Agreement/message IDs and refuses false local reconciliation on attachment mismatch', async () => {
    const photo = { assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const };
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 3, clientMessageId: command.clientMessageId,
      posiljalacAccountId: account, telo: command.body, moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null, fotografije: [photo] };
    const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, canSubmit: () => false } as any;
    const pending = { command: { ...command, photos: { agreementVersion: 2, assetIds: [photo.assetId] } }, state: 'unknown' as const, persisted: true, attempt: 1 };
    await render({ messages: [read], terminal: true, writable: false, photos, state: { ...state, entries: [pending] } });
    const images = tree.root.findAllByType('AuthorizedPhoto' as React.ElementType);
    expect(images[0].props).toMatchObject({ assetId: photo.assetId, agreementId: agreement, messageId: read.id });
    expect(texts()).toContain('Ne znamo da li je stigla');
    await act(async () => tree.update(<AgreementChat {...props} photos={photos} messages={[read]} state={{ ...state,
      entries: [{ ...pending, command: { ...pending.command, photos: { ...pending.command.photos, agreementVersion: 3 } } }] }} />));
    expect(texts()).not.toContain('Ne znamo da li je stigla');
  });
  it('permits explicit support selection of a photo-only message without changing its canonical empty body', async () => {
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 3, clientMessageId: 'photo_message_key',
      posiljalacAccountId: account, telo: '', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null,
      fotografije: [{ assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const }] };
    const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, canSubmit: () => false } as any;
    await render({ messages: [read], photos, support: { canAct: () => true, navigate: jest.fn() } });
    // A photo-only message is heard as its photos, with its day, its clock and, for mine, its state.
    expect(held('Ti').props.accessibilityLabel).toBe('Ti: 1 fotografija, Danas, 12:00, poslato');
    // Retry belongs to AuthorizedPhoto; no accessible message button may swallow that separate action. The photo is held
    // (long press) through a wrapper that is itself no stop, so sighted people can offer the message to support from the photo.
    expect(held('Ti').findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
    const photoHold = tree.root.findByType('AuthorizedPhoto' as React.ElementType).parent!;
    expect(photoHold.props.accessible).toBe(false); expect(photoHold.props.accessibilityLabel).toBeUndefined();
    expect(photoHold.props.onLongPress).toBe(held('Ti').props.onLongPress);
    // The support entry no longer stands under every message; it belongs to the one being held.
    await act(async () => held('Ti').props.onLongPress());
    const entry = tree.root.findByType('SupportContextEntry' as React.ElementType).props;
    expect(entry.previewText).toContain('Privatne fotografije uz ovu poruku: 1');
    expect(entry.reference).toEqual({ kind: 'AGREEMENT_MESSAGE', id: read.id, revision: 3 }); expect(read.telo).toBe('');
    expect(outbox.sendDraft).not.toHaveBeenCalled();
  });
  // A message summary still names its text and photos, while each image has a separate accessible recovery action.
  it('hears a message with text and photos as both, and a message with neither as a message without text', async () => {
    const photo = { assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const };
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 3, clientMessageId: 'photo_message_key',
      posiljalacAccountId: account, telo: 'Evo kako izgleda', moja: false, posiljalacIme: 'Milan', vremeTekst: '24. sep · 12:00', procitano: null,
      fotografije: [photo, { ...photo, assetId: '40000000-0000-4000-8000-000000000002' }] };
    const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, canSubmit: () => false } as any;
    await render({ messages: [read], photos });
    expect(held('Milan').props.accessibilityLabel).toBe('Milan: Evo kako izgleda, 2 fotografije, 24. sep, 12:00');
    expect(held('Milan').findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
    expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(2);
    expect(messageSpoken({ moja: true, posiljalacIme: 'Ja', telo: '', fotografije: [] }, { day: null, clock: '12:00' })).toBe('Ti: poruka bez teksta, 12:00');
  });
  it('shows latest history initially, preserves an older reading position, and follows an explicit outgoing message', async () => {
    await render();
    const scroll = tree.root.findByType('ScrollView' as any);
    await act(async () => scroll.props.onContentSizeChange(300, 3000));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    scrollToEnd.mockClear();
    await act(async () => scroll.props.onScrollBeginDrag(scrollEvent(2400)));
    await act(async () => scroll.props.onScroll({ nativeEvent: {
      contentOffset: { y: 400 }, layoutMeasurement: { height: 600 }, contentSize: { height: 3000 },
    } }));
    await act(async () => scroll.props.onScrollEndDrag(scrollEvent(400)));
    await act(async () => scroll.props.onContentSizeChange(300, 3200));
    expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => button('Pošalji poruku').props.onPress());
    // A fast response may be first rendered as confirmed, without a sending frame.
    const sending: OutboxSnapshot = { ...state, entries: [{ command, state: 'confirmed', persisted: true, attempt: 1 }] };
    await act(async () => tree.update(<AgreementChat {...props} state={sending} />));
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    scrollToEnd.mockClear();
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...sending,
      entries: [{ ...sending.entries[0], state: 'unknown' }] }} />));
    expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => scroll.props.onLayout());
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    expect(outbox.sendDraft).toHaveBeenCalledTimes(1);
    expect(outbox.retry).not.toHaveBeenCalled();
  });
  it('keeps following through keyboard geometry events and cancels queued follow when the person reads history', async () => {
    await render();
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => scroll.props.onContentSizeChange(300, 3000));
    await flushFrames(); scrollToEnd.mockClear();
    // Android emits a non-bottom offset while the keyboard and compact context are still laying out.
    await act(async () => scroll.props.onScroll(scrollEvent(2400, 280, 3350)));
    await act(async () => scroll.props.onLayout());
    await act(async () => scroll.props.onContentSizeChange(300, 3350));
    expect(scrollToEnd).toHaveBeenCalled();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Najnovije poruke' })).toHaveLength(0);
    await act(async () => scroll.props.onScrollBeginDrag(scrollEvent(500, 280, 3350)));
    await act(async () => scroll.props.onScrollEndDrag(scrollEvent(500, 280, 3350)));
    scrollToEnd.mockClear(); await flushFrames();
    await act(async () => scroll.props.onLayout());
    await act(async () => scroll.props.onContentSizeChange(300, 3500));
    expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => button('Najnovije poruke').props.onPress());
    expect(scrollToEnd).toHaveBeenCalled();
    expect(outbox.sendDraft).not.toHaveBeenCalled();
  });
  it('preserves the history message position when context enters and leaves above it', async () => {
    await render();
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    const context = tree.root.findByProps({ testID: 'agreement-chat-context' });
    await act(async () => context.props.onLayout({ nativeEvent: { layout: { height: 0 } } }));
    await act(async () => scroll.props.onScrollBeginDrag(scrollEvent(600)));
    await act(async () => scroll.props.onScrollEndDrag(scrollEvent(600)));
    scrollToEnd.mockClear();
    await act(async () => context.props.onLayout({ nativeEvent: { layout: { height: 240 } } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 840, animated: false });
    await act(async () => scroll.props.onScroll(scrollEvent(500, 280, 3240)));
    await act(async () => context.props.onLayout({ nativeEvent: { layout: { height: 0 } } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 600, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(outbox.sendDraft).not.toHaveBeenCalled();
  });
  it('treats accessibility history navigation as intentional without sending or retrying', async () => {
    await render();
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => scroll.props.onScroll(scrollEvent(2400)));
    await act(async () => scroll.props.onAccessibilityAction({ nativeEvent: { actionName: 'scrollBackward' } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 1920, animated: false });
    scrollToEnd.mockClear();
    await act(async () => scroll.props.onLayout());
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(button('Najnovije poruke')).toBeTruthy();
    await act(async () => scroll.props.onAccessibilityAction({ nativeEvent: { actionName: 'scrollForward' } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 2400, animated: false });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Najnovije poruke' })).toHaveLength(0);
    expect(outbox.sendDraft).not.toHaveBeenCalled();
    expect(outbox.retry).not.toHaveBeenCalled();
  });
  it('distinguishes successful empty, loading and failed reads', async () => {
    await render(); expect(texts()).toContain('Napiši prvu poruku');
    await act(async () => tree.update(<AgreementChat {...props} error />));
    expect(texts()).toContain('Poruke nisu učitane'); expect(texts()).not.toContain('Napiši prvu poruku');
    await act(async () => button('Ponovo učitaj poruke').props.onPress());
    expect(props.refresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AgreementChat {...props} loading />));
    expect(texts()).not.toContain('Napiši prvu poruku');
  });
  it('preserves composer text in offline/error state and keeps it outside the history scroller', async () => {
    await render({ error: true });
    expect(button('Napiši poruku').props.value).toBe('Nova poruka');
    const scroll = tree.root.findByType('ScrollView' as any);
    expect(scroll.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
    // The screen owns the one KAV; a nested KAV loses the header origin on Android.
    expect(tree.root.findAllByType('KeyboardAvoidingView' as any)).toHaveLength(0);
    expect(button('Pošalji poruku')).toBeTruthy();
  });
  it('returns to the photo controls when explicitly opening them from older history', async () => {
    const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, items: [], message: null,
      versionConflict: false, canSubmit: () => false, capture: () => null } as any;
    await render({ photos });
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => scroll.props.onContentSizeChange(300, 3000));
    await act(async () => scroll.props.onScrollBeginDrag(scrollEvent(2700, 300)));
    await act(async () => scroll.props.onScroll({ nativeEvent: {
      contentOffset: { y: 400 }, layoutMeasurement: { height: 300 }, contentSize: { height: 3000 },
    } }));
    await act(async () => scroll.props.onScrollEndDrag(scrollEvent(400, 300)));
    scrollToEnd.mockClear();
    // The "+" opens the shared photo sheet (owner, 2026-10-07); asking there for the earlier prepared photos opens the tray.
    await act(async () => button('Dodaj fotografije').props.onPress());
    expect(tree.root.findByType('AgreementPhotoSheet' as any).props.photos).toBe(photos);
    await act(async () => tree.root.findByType('AgreementPhotoSheet' as any).props.onShowSaved());
    expect(scroll.findByType('AgreementPhotoComposer' as any).props).toMatchObject({ photos, showSaved: true });
    await act(async () => scroll.props.onContentSizeChange(300, 3600));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(outbox.sendDraft).not.toHaveBeenCalled();
  });
  it('unknown delivery has exact-command retry and no invented sent/read state', async () => {
    state = { ...state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] };
    await render({ state });
    expect(texts()).toContain('Ne znamo da li je stigla'); expect(texts()).not.toContain('Poslato');
    expect(texts()).not.toContain('Pročitano'); expect(texts()).not.toContain('Isporučeno');
    await act(async () => button(`Proveri da li je stigla: ${command.body}`).props.onPress());
    expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
  });
  it('an answer the app cannot read says what is not known, once, and the one button is the check (the word of `outcomeCopy`)', async () => {
    state = { ...state, error: 'INVALID_RESPONSE', entries: [{ command, state: 'unknown', error: 'INVALID_RESPONSE', persisted: true, attempt: 1 }] };
    await render({ state });
    expect(texts()).toContain('Ne znamo da li je poruka stigla. Neće se poslati dvaput.');
    // The line describes; the button commands ("Proveri"), and the line does not say the button's verb a second time.
    expect(texts()).not.toContain('Proveri;'); expect(texts()).not.toContain('Pokušaj ponovo;');
    expect(button(`Proveri da li je stigla: ${command.body}`).findByType('T' as React.ElementType).children).toEqual(['Proveri']);
  });
  it('an in-flight message does not block composing another message', async () => {
    await render({ state: { ...state, entries: [{ command, state: 'sending', persisted: true, attempt: 1 }] } });
    expect(button('Pošalji poruku').props.disabled).toBe(false);
    await act(async () => button('Pošalji poruku').props.onPress());
    expect(outbox.sendDraft).toHaveBeenCalledTimes(1);
  });
  it('terminal state blocks new text/send but leaves unknown-intent retry', async () => {
    await render({ terminal: true, writable: false, state: { ...state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] } });
    // A finished Dogovor draws no field and no send at all (owner, 2026-09-23); the one line says it is read-only.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji poruku' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži status Dogovora' })).toHaveLength(0);
    expect(texts()).toContain(CLOSED_SENTENCE);
    await act(async () => button(`Proveri da li je stigla: ${command.body}`).props.onPress());
    expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
  });
  it('server reconciliation suppresses the local duplicate only for matching sender/key/body', async () => {
    const pending = { command, state: 'unknown' as const, persisted: true, attempt: 1 };
    const read = { id: 'message-1', clientMessageId: command.clientMessageId, posiljalacAccountId: account,
      telo: command.body, moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null };
    await render({ state: { ...state, entries: [pending] }, messages: [read] });
    expect(texts().split(command.body)).toHaveLength(2);
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, entries: [pending] }} messages={[{ ...read, posiljalacAccountId: 'another-account' }]} />));
    expect(texts().split(command.body)).toHaveLength(3);
  });
  it('uses Unicode code points for the 2,000-character limit and preserves over-limit text', async () => {
    await render({ state: { ...state, draft: '😀'.repeat(2000) } });
    expect(button('Pošalji poruku').props.disabled).toBe(false);
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, draft: '😀'.repeat(2001) }} />));
    expect(button('Pošalji poruku').props.disabled).toBe(true);
    expect(button('Napiši poruku').props.value).toBe('😀'.repeat(2001));
    expect(texts()).toContain('skrati poruku');
  });
  it('shows actionable storage failure and retains the draft', async () => {
    await render({ state: { ...state, phase: 'error', error: 'STORAGE_UNAVAILABLE' } });
    expect(button('Pošalji poruku').props.disabled).toBe(true);
    expect(button('Napiši poruku').props.value).toBe('Nova poruka');
    await act(async () => button('Ponovo učitaj sačuvane poruke').props.onPress());
    expect(outbox.start).toHaveBeenCalledTimes(1);
  });
  it('offers only a canonical selected historical message, with its persisted version independent of current writable state', async () => {
    const support = { canAct: jest.fn(() => true), navigate: jest.fn() };
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 2, clientMessageId: null,
      posiljalacAccountId: account, telo: 'Samo ova stara poruka.', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null };
    await render({ messages: [read], terminal: true, writable: false, support });
    // The support entry no longer stands under every message; it belongs to the one being held.
    await act(async () => held('Ti').props.onLongPress());
    // It stands under the bubble as a sibling, never inside the bubble's press, so a screen reader reaches its buttons.
    const supportNode = tree.root.findByType('SupportContextEntry' as React.ElementType);
    expect(held('Ti').findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
    expect(supportNode.props.label).toBe('Izaberi ovu poruku za podršku');
    const entry = supportNode.props;
    expect(entry.reference).toEqual({ kind: 'AGREEMENT_MESSAGE', id: read.id, revision: 2 });
    expect(entry.previewText).toBe(read.telo); expect(entry.canAct()).toBe(true);
    expect(outbox.sendDraft).not.toHaveBeenCalled(); expect(support.navigate).not.toHaveBeenCalled();
    await act(async () => tree.update(<AgreementChat {...props} messages={[{ ...read, dogovorVerzija: 5 }]} support={support} />));
    expect(entry.canAct()).toBe(false);
    expect(tree.root.findByType('SupportContextEntry' as React.ElementType).props.reference.revision).toBe(5);
  });
  // Owner step 8: a calm, modern conversation. The other person on the left on the wash, mine on the right on pale green,
  // the clock small and muted, a day named once above its messages, and a floating pill composer.
  describe('the look of the conversation', () => {
    const { sys } = require('../../ui/system/tokens');
    const { messageMoment } = require('../../ui/AgreementChat');
    const flat = (style: unknown): Record<string, unknown> => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : (style as Record<string, unknown>) ?? {};
    const other = '10000000-0000-4000-8000-000000000002';
    const message = (id: string, moja: boolean, telo: string, vremeTekst: string) => ({ id: `30000000-0000-4000-8000-00000000000${id}`, dogovorVerzija: 1,
      clientMessageId: null, posiljalacAccountId: moja ? account : other, posiljalacIme: moja ? 'Ja' : 'Marko', moja, telo, vremeTekst, procitano: null });
    const bubble = (sender: string) => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string'
      && node.props.accessibilityLabel.startsWith(`${sender}: `));
    const lines = () => tree.root.findAll(node => String(node.type) === 'T').map(node => node.children.filter(child => typeof child === 'string').join(''));
    it('reads the day and the clock from the words the read wrote, and invents no day', () => {
      expect(messageMoment('23. sep · 14:05')).toEqual({ day: '23. sep', clock: '14:05' });
      expect(messageMoment('23. sep 2025 · 09:00')).toEqual({ day: '23. sep 2025', clock: '09:00' });
      expect(messageMoment('14:05')).toEqual({ day: 'Danas', clock: '14:05' });
      expect(messageMoment('sada')).toEqual({ day: null, clock: 'sada' });
    });
    it('names each day once above its messages, today with the clock of its first message, and draws no clock in a bubble', async () => {
      await render({ messages: [message('1', false, 'Stižem u 10.', '23. sep · 09:40'), message('2', true, 'Važi.', '23. sep · 09:41'),
        message('3', false, 'Evo me.', '10:02'), message('4', false, 'Kod ulaza sam.', '10:03')] });
      const days = tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
      expect(days).toEqual(['23. sep', 'Danas · 10:02']);
      // The proposal's bubble holds its words and the one small mark, never a clock: the lines above say when.
      for (const clock of ['09:40', '09:41', '10:03']) expect(lines()).not.toContain(clock);
      expect(lines().some(line => line.includes('23. sep ·'))).toBe(false);
      expect(lines()).toEqual(expect.arrayContaining(['Stižem u 10.', 'Važi.', 'Evo me.', 'Kod ulaza sam.']));
    });
    it('distinguishes speakers with readable white and charcoal surfaces while keeping names, times and the state in the spoken message', async () => {
      await render({ messages: [message('1', false, 'Zdravo', '10:00'), message('2', true, 'Ćao', '10:01')] });
      expect(flat(bubble('Marko')[0].props.style)).toMatchObject({ alignSelf: 'flex-start', backgroundColor: sys.conversation.surface,
        borderWidth: 1, borderColor: sys.conversation.edge });
      expect(flat(bubble('Ti')[0].props.style)).toMatchObject({ alignSelf: 'flex-end', backgroundColor: sys.conversation.user });
      // The name is heard with the bubble, not drawn in it: the bar above already names the person. Review r4 rd item 2:
      // what the bubble says and when is heard with it too, and for my message how far it has got.
      expect(bubble('Marko')[0].props.accessibilityLabel).toBe('Marko: Zdravo, Danas, 10:00');
      expect(bubble('Ti')[0].props.accessibilityLabel).toBe('Ti: Ćao, Danas, 10:01, poslato');
      expect(lines()).not.toContain('Marko');
      const mine = bubble('Ti')[0].findAll(node => String(node.type) === 'T');
      expect(mine.map(node => flat(node.props.style).color)).toEqual([sys.conversation.onUser]);
      expect(texts()).not.toContain('Povuci naniže');
    });
    it('keeps the multiline draft and reserved send target in one stable writing row', async () => {
      await render();
      const send = button('Pošalji poruku');
      expect(flat(send.props.style)).toMatchObject({ width: 48, height: 48 });
      const circle = (node: typeof send) => flat(node.findAll(child => String(child.type) === 'View')[0].props.style);
      // The send is the one green primary of the screen (white glyph); grey while nothing can go.
      expect(circle(send).backgroundColor).toBe(sys.color.green); expect(flat(send.props.style).opacity).toBeUndefined();
      const commandSlot = send.parent!;
      const writingRow = commandSlot.parent!;
      const pill = writingRow.parent!;
      expect(flat(commandSlot.props.style)).toMatchObject({ width: 48, height: 48, flexShrink: 0 });
      expect(flat(writingRow.props.style)).toMatchObject({ flexDirection: 'row' });
      expect(flat(pill.props.style)).toMatchObject({ backgroundColor: sys.conversation.surface, borderRadius: sys.radius.sheet });
      const input = pill.findByProps({ accessibilityLabel: 'Napiši poruku' });
      expect(input.props.multiline).toBe(true);
      expect(input.parent).toBe(writingRow);
      expect(writingRow.children.indexOf(input)).toBeLessThan(writingRow.children.indexOf(commandSlot));
      expect(flat(input.props.style)).toMatchObject({ flex: 1 });
      await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, draft: '' }} />));
      expect(button('Pošalji poruku').props.disabled).toBe(true);
      expect(circle(button('Pošalji poruku')).backgroundColor).toBe(sys.color.control);
    });
    // Owner, 2026-10-07: the "+" is the shared photo sheet (Galerija, Kamera), the same one the task conversation opens; the
    // tray above writing shows only what is prepared, and a chosen photo is never hidden.
    it('opens the shared photo sheet from the pill\'s "+" and never hides a chosen photo', async () => {
      const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, items: [], message: null,
        versionConflict: false, canSubmit: () => false, capture: () => null, refresh: jest.fn() } as any;
      await render({ photos });
      const sheets = () => tree.root.findAllByType('AgreementPhotoSheet' as React.ElementType);
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      expect(sheets()).toHaveLength(0);
      expect(button('Dodaj fotografije').props.accessibilityState).toEqual({ disabled: false });
      await act(async () => button('Dodaj fotografije').props.onPress());
      expect(sheets()).toHaveLength(1);
      expect(sheets()[0].props).toMatchObject({ photos, capturing: false });
      // Nothing is prepared yet, so no tray is drawn behind the sheet.
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      await act(async () => sheets()[0].props.onClose());
      expect(sheets()).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, hasSelection: true }} />));
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(1);
      // More can be added while photos wait: the "+" stays live and opens the same sheet.
      expect(button('Dodaj fotografije').props.disabled).toBe(false);
      // A closed Dogovor draws no photo tools at all.
      await act(async () => tree.update(<AgreementChat {...props} terminal writable={false} photos={{ ...photos, hasSelection: true }} />));
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj fotografije' })).toHaveLength(0);
    });
    // The tray stands while something about the photos is to be read (a prepared photo, a notice, a changed Dogovor) or the
    // earlier prepared photos were asked for; after a send that asked-for list folds away again.
    it('draws the tray only for what is prepared or asked for, and folds the earlier photos away after a send', async () => {
      const photos = { loaded: true, busy: false, ready: true, hasSelection: false, agreementId: agreement, items: [], message: null,
        versionConflict: false, saved: [], canSubmit: () => true, capture: () => null, refresh: jest.fn().mockResolvedValue(undefined) } as any;
      const trays = () => tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType);
      await render({ photos });
      await act(async () => button('Dodaj fotografije').props.onPress());
      await act(async () => tree.root.findByType('AgreementPhotoSheet' as React.ElementType).props.onShowSaved());
      expect(trays()).toHaveLength(1); expect(trays()[0].props.showSaved).toBe(true);
      await act(async () => button('Pošalji poruku').props.onPress());
      expect(trays()).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, message: 'Dozvoli pristup kameri.' }} />));
      expect(trays()).toHaveLength(1); expect(trays()[0].props.showSaved).toBe(false);
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, versionConflict: true, items: [{}] }} />));
      expect(trays()).toHaveLength(1);
      await act(async () => tree.update(<AgreementChat {...props} photos={photos} />));
      expect(trays()).toHaveLength(0);
      expect(button('Dodaj fotografije').props.accessibilityHint).toBe('Galerija ili kamera.');
    });
    // Review r4 rd item 4: with no live update and a pull a screen reader cannot easily make, the refresh is an action.
    // Verify r4b rd item 4 (was: no action in the empty thread, and one on a closed Dogovor): the empty thread is where
    // someone waits for the other side's first message, so it has the action; a closed Dogovor takes no new message, a
    // failed read has its own retry, and the first read's spinner stands alone.
    it('offers a quiet refresh at the head of the thread and in the empty thread, and none where nothing new can come', async () => {
      await render({ messages: [message('1', false, 'Zdravo', '10:00')] });
      await act(async () => button('Osveži poruke').props.onPress());
      expect(props.refresh).toHaveBeenCalledTimes(1);
      await act(async () => tree.update(<AgreementChat {...props} messages={[]} />));
      expect(texts()).toContain('Napiši prvu poruku');
      // Verify r4c item 2: in the empty thread the action stands under the empty state's words, never above its drawing.
      expect(texts().indexOf('Osveži poruke')).toBeGreaterThan(texts().indexOf('Poruke vide samo učesnici ovog Dogovora.'));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' }).filter(node => String(node.type) === 'Press')).toHaveLength(1);
      await act(async () => button('Osveži poruke').props.onPress());
      expect(props.refresh).toHaveBeenCalledTimes(2);
      await act(async () => tree.update(<AgreementChat {...props} terminal writable={false} messages={[message('1', false, 'Zdravo', '10:00')]} />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' })).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} error />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' })).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} loading messages={[]} />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' })).toHaveLength(0);
    });
    // Review r4 rd item 8: the first read's spinner stands in the middle, like every other state.
    it('centres the first read and sits a read thread on the composer', async () => {
      const container = () => flat(tree.root.findAll(node => String(node.type) === 'ScrollView')[0].props.contentContainerStyle);
      await render({ loading: true });
      expect(container().justifyContent).toBe('center');
      await act(async () => tree.update(<AgreementChat {...props} messages={[message('1', false, 'Zdravo', '10:00')]} />));
      expect(container().justifyContent).toBe('flex-end');
    });
    it('keeps a failed send in place with its reason and the retry of that exact message', async () => {
      await render({ messages: [message('1', false, 'Zdravo', '10:00')],
        state: { ...state, entries: [{ command, state: 'failed', error: 'UNAVAILABLE', persisted: true, attempt: 2 }] } });
      expect(texts()).toContain('Nije poslato'); expect(texts()).toContain('Veza je prekinuta. Ne znamo da li je poruka stigla.');
      await act(async () => button(`Ponovi slanje poruke ${command.body}`).props.onPress());
      expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId); expect(props.refresh).toHaveBeenCalledTimes(1);
    });
    it('says a closed Dogovor is closed, true of a finished and of a cancelled one', async () => {
      await render({ terminal: true, writable: false });
      expect(texts()).toContain(CLOSED_SENTENCE); expect(texts()).not.toContain('završen');
    });
  });
  it('does not select an unconfirmed local outbox item, failed read, or missing message version', async () => {
    const support = { canAct: () => true, navigate: jest.fn() };
    await render({ support, state: { ...state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] },
      messages: [{ id: '30000000-0000-4000-8000-000000000001', telo: 'Legacy display', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null }] });
    expect(tree.root.findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
    await act(async () => tree.update(<AgreementChat {...props} support={support} error messages={[{ id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 2,
      telo: 'Stale read', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null }]} />));
    expect(tree.root.findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
  });
});

/**
 * Haptics of the conversation (motion item M-03, rule R5: a tick is an outcome). A send that FAILED ticks once; a wait does not.
 * Haptics are not motion, so `conversation-has-no-motion` stays true of this file's subject.
 */
describe('a failed send ticks once', () => {
  const failed = (attempt: number, clientMessageId = command.clientMessageId) =>
    ({ command: { ...command, clientMessageId }, state: 'failed' as const, error: 'UNAVAILABLE' as const, persisted: true, attempt });
  const withEntries = (entries: OutboxSnapshot['entries']) => <AgreementChat {...props} state={{ ...state, entries }} />;
  const ticks = () => (tick as jest.Mock).mock.calls.map(call => call[0]);

  it('ticks `error` when a send fails after the thread was open, and not again for the same attempt', async () => {
    await render();
    expect(ticks()).toEqual([]);
    await act(async () => tree.update(withEntries([failed(1)])));
    expect(ticks()).toEqual(['error']);
    await act(async () => tree.update(withEntries([failed(1)])));
    await act(async () => tree.update(<AgreementChat {...props} messages={[]} refreshing state={{ ...state, entries: [failed(1)] }} />));
    expect(ticks()).toEqual(['error']);
  });

  it('a new attempt that fails is a new failure, and another message that fails is one too', async () => {
    await render();
    await act(async () => tree.update(withEntries([failed(1)])));
    await act(async () => tree.update(withEntries([failed(2)])));
    await act(async () => tree.update(withEntries([failed(2), failed(1, 'druga_poruka_456')])));
    expect(ticks()).toEqual(['error', 'error', 'error']);
  });

  it('what had already failed when the thread opened is not news, and a send that is only unconfirmed is a wait, not a failure', async () => {
    await render({ state: { ...state, entries: [failed(1)] } });
    expect(ticks()).toEqual([]);
    await act(async () => tree.update(withEntries([failed(1), { command: { ...command, clientMessageId: 'unknown_send' }, state: 'unknown', persisted: true, attempt: 1 }])));
    expect(ticks()).toEqual([]);
  });

  it('waits for the saved sends to be read before it counts anything', async () => {
    await render({ state: { ...state, phase: 'loading', entries: [] } });
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, phase: 'ready', entries: [failed(1)] }} />));
    // The first ready state is the baseline: a failed send from an earlier visit is not a failure that just happened.
    expect(ticks()).toEqual([]);
  });
});
