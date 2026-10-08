import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import type { VoiceSnapshot } from '../../features/voice/holdToTalk';
let mockHeight = 844, mockWidth = 390, mockScale = 1, mockReduced = false;
const mockKeyboard: Record<string, () => void> = {};
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) {
    if (key === 'Keyboard') return { addListener: (name: string, cb: () => void) => {
      mockKeyboard[name] = cb; return { remove: jest.fn() };
    }, dismiss: jest.fn() };
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: mockHeight, fontScale: mockScale, scale: 3 });
    if (key === 'AccessibilityInfo') return { isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove: jest.fn() }),
      announceForAccessibility: jest.fn(), isReduceMotionEnabled: async () => mockReduced };
    return ['View', 'ScrollView', 'KeyboardAvoidingView', 'TextInput', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
// The shell now reaches the sheet engine, which imports react-native-gesture-handler, and gesture-handler wraps one of its
// own views with `createAnimatedComponent` when it loads. The harness hands that component back unchanged.
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: (duration: number) => ({ duration }) },
  // An entrance is a chain (`duration`, `easing`, `withInitialValues`), and its curve comes from Reanimated's own `Easing`.
  FadeInDown: { duration: (duration: number) => { const chain: Record<string, unknown> = { duration, easing: () => chain, withInitialValues: () => chain }; return chain; } },
  Easing: { bezier: () => (value: number) => value },
  useReducedMotion: () => false, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value,
  withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
// One reduced-motion store (ui/system/motion): the shell, its chrome and voice mode read it; the harness sets it.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'GESTURE_SYNTHETIC' }));
import { AiConversationShell, type AiConversationShellProps } from '../../ui/aiFirst/AiConversationShell';
import { HOLD_HINT, VoiceMode } from '../../ui/aiFirst/VoiceComposer';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { DraftCard, IntakeUnavailable } from '../../ui/v2/IntakePresentation';
import { WorkerAiCard } from '../../ui/workerProfile/WorkerAiPresentation';
import { CardValue } from '../../ui/v2/TaskFace';

let tree: ReactTestRenderer;
const idle: VoiceSnapshot = { phase: 'IDLE', session: null, finalText: '', interimText: '', audioLevel: null, fallbackText: '', error: null };
const controller = () => ({ begin: jest.fn(() => true), release: jest.fn(), cancel: jest.fn(), useFallback: jest.fn(), getSnapshot: () => idle });
const voice = (patch: Partial<NonNullable<AiConversationShellProps['voice']>> = {}) => ({ controller: controller() as never, state: idle,
  disabled: false, onKeepText: jest.fn(() => true), ...patch }) as NonNullable<AiConversationShellProps['voice']>;
// Review r4 ra item 15: the shell's dead `subtitle` prop is gone (the chrome drew nothing for it), so the helper no longer passes one.
const props = (): AiConversationShellProps => ({title:'Novi zadatak',card:jest.fn(()=>null),
  messages:[],welcome:'Šta ti treba?',welcomeDetail:'Opiši zadatak.',value:'Sačuvana poruka',canEdit:true,
  canSend:false,pending:false,busy:false,onChange:jest.fn(),onSend:jest.fn(),onBack:jest.fn(),onOptions:jest.fn()});
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(()=>{mockHeight=844;mockWidth=390;mockScale=1;mockReduced=false;});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('keeps recovery scrollable and composer reachable, without discarding a pending draft',async()=>{
  const p=props();p.pending=true;p.status=<>Provera ishoda je dostupna.</>;
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const thread=tree.root.findByProps({testID:'ai-conversation-thread'});
  expect(thread.findByProps({testID:'ai-recovery-in-thread'})).toBeDefined();
  const footer=tree.root.findByProps({testID:'ai-composer-footer'});
  expect(footer.findAllByProps({testID:'ai-recovery-in-thread'})).toHaveLength(0);
  expect(footer.findByProps({accessibilityLabel:'Poruka za asistenta'}).props.value).toBe('Sačuvana poruka');
  expect(p.card).toHaveBeenLastCalledWith(true);
  expect(StyleSheet.flatten(thread.props.style).minHeight).toBe(0);
  expect(p.onSend).not.toHaveBeenCalled();
});
it.each([
  { state: 'recovered pending', patch: { pending: true }, marks: 0 },
  { state: 'waiting for an answer', patch: { busy: true }, marks: 0 },
  { state: 'recovered processing', patch: { pending: true, busy: true }, marks: 0 },
  { state: 'real streamed answer', patch: { busy: true, streamingText: 'Stvarni odgovor' }, marks: 1 },
])('keeps welcome separate from $state and identifies only real answer text', async ({ patch, marks }) => {
  const p = props(); p.conversationKey = 'owned-conversation';
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(text()).toContain(p.welcome); expect(text()).toContain(p.welcomeDetail);
  expect(tree.root.findAllByProps({ testID: 'ai-assistant-mark' })).toHaveLength(0);
  await act(async () => tree.update(<AiConversationShell {...p} {...patch} />));
  expect(text()).not.toContain(p.welcome); expect(text()).not.toContain(p.welcomeDetail);
  expect(tree.root.findAllByProps({ testID: 'ai-assistant-mark' })).toHaveLength(marks);
  if (patch.streamingText) expect(text()).toContain(patch.streamingText);
  else if (patch.busy) expect(tree.root.findAllByProps({ accessibilityLabel: 'USKOČI piše odgovor' })).toHaveLength(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.value).toBe(p.value);
  expect(p.onSend).not.toHaveBeenCalled(); expect(p.onChange).not.toHaveBeenCalled();
  await act(async () => tree.update(<AiConversationShell {...p} />));
  expect(text()).toContain(p.welcome);
  expect(tree.root.findAllByProps({ testID: 'ai-assistant-mark' })).toHaveLength(0);
});
// Owner, 2026-10-07: "Neću da mi na dnu stoji ništa... To ostane u četu i ide gore sa drugim porukama." A note of the
// conversation's own history (the confirmed place) is an ordinary item of the message list, in the order it happened.
it('draws a history note inside the message list after the message it followed, never in a docked region',async()=>{
  const p=props();p.messages=[{id:'a',fromAi:true,body:'Gde je mesto?'},{id:'b',fromAi:false,body:'Bulevar oslobođenja 65'},
    {id:'c',fromAi:true,body:'Kada ti treba?'}];
  p.threadNotes=[{key:'place',afterMessageId:'b',node:<View testID="place-note"/>}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const order=()=>tree.root.findByProps({testID:'ai-conversation-thread'}).findAll(node=>node.props.testID==='place-note'
    ||(typeof node.props.accessibilityLabel==='string'&&/^(Ti|USKOČI): /.test(node.props.accessibilityLabel)))
    .map(node=>node.props.testID??node.props.accessibilityLabel);
  expect(order()).toEqual(['USKOČI: Gde je mesto?','Ti: Bulevar oslobođenja 65','place-note','USKOČI: Kada ti treba?']);
  for(const region of ['ai-composer-footer','ai-pinned-card']) expect(tree.root.findAllByProps({testID:region}).flatMap(node=>node.findAllByProps({testID:'place-note'}))).toHaveLength(0);
  // A later message goes below it; an anchor that is no longer in the thread puts the note after the last message.
  await act(async()=>tree.update(<AiConversationShell {...p} messages={[...p.messages,{id:'d',fromAi:false,body:'Sutra.'}]}/>));
  expect(order()).toEqual(['USKOČI: Gde je mesto?','Ti: Bulevar oslobođenja 65','place-note','USKOČI: Kada ti treba?','Ti: Sutra.']);
  await act(async()=>tree.update(<AiConversationShell {...p} threadNotes={[{key:'place',afterMessageId:'gone',node:<View testID="place-note"/>}]}/>));
  expect(order()).toEqual(['USKOČI: Gde je mesto?','Ti: Bulevar oslobođenja 65','USKOČI: Kada ti treba?','place-note']);
  expect(p.onSend).not.toHaveBeenCalled();
});
it('offers a way in before the first word, and one tap puts it in the message',async()=>{
  // 38 of the first 62 conversations never received a single message: the screen opened, said
  // "Reci šta ti treba" over an empty card, and was left. An opening is a start, not a command,
  // so it lands in the composer for the person to finish rather than being sent for them.
  const p=props();p.openings=['Treba mi prevoz','Treba mi majstor'];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const opening=tree.root.findByProps({accessibilityLabel:'Treba mi prevoz'});
  await act(async()=>opening.props.onPress());
  expect(p.onChange).toHaveBeenCalledWith('Treba mi prevoz ');
  expect(p.onSend).not.toHaveBeenCalled();
});
// UX needs R18, composition 4.6: the openings are sentences in rows of one section, parted by the system's one divider, not boxes with an edge each.
it('draws the openings as the rows of one section named "Na primer", a sentence each and no box of its own',async()=>{
  const p=props();p.openings=['Treba mi pomoć oko selidbe u subotu, 2 osobe, Novi Sad.','Treba mi neko da sastavi ormar u petak popodne.'];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(text()).toContain('Na primer');
  const rows=tree.root.findAll(node=>node.type==='Press'as React.ElementType&&(p.openings as string[]).includes(node.props.accessibilityLabel));
  expect(rows).toHaveLength(2);
  for(const row of rows){const style=StyleSheet.flatten(row.props.style);expect(style.borderWidth).toBeUndefined();expect(style.minHeight).toBeGreaterThanOrEqual(48);}
  expect(text()).toContain(p.openings[0]);
});
// Rule R6: a spinner lives only inside a button. The opening of a conversation shows the shape of what is coming and one quiet sentence.
it('the opening of a conversation is a skeleton and one quiet sentence, never a spinner',async()=>{
  await act(async()=>{tree=create(<IntakeUnavailable loading error="" back={jest.fn()}/>);});
  expect(text()).toContain('Otvaramo razgovor');
  expect(tree.root.findAllByType('ActivityIndicator'as React.ElementType)).toHaveLength(0);
});
it('hides the pinned area entirely when there is nothing yet to pin',async()=>{
  const p=props();p.card=jest.fn(()=>null);
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(tree.root.findAllByProps({testID:'ai-pinned-card'})).toHaveLength(0);
});
it.each([{height:844,scale:2},{height:420,scale:1}])('keeps one reachable review inside the scroll on constrained geometry %o',async({height,scale})=>{
  mockHeight=height;mockScale=scale;const p=props(), review=jest.fn();
  p.card=()=> <View testID="review-target" onTouchEnd={review}/>;
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const thread=tree.root.findByProps({testID:'ai-conversation-thread'});
  expect(tree.root.findAllByProps({testID:'ai-pinned-card'})).toHaveLength(0);
  expect(tree.root.findAllByProps({testID:'review-target'})).toHaveLength(1);
  await act(async()=>thread.findByProps({testID:'review-target'}).props.onTouchEnd());
  expect(review).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({accessibilityLabel:'Poruka za asistenta'}).props.editable).toBe(true);
  expect(p.onSend).not.toHaveBeenCalled();
});
it('does not offer openings once the conversation has started, or while it cannot be edited',async()=>{
  const p=props();p.openings=['Treba mi prevoz'];p.messages=[{id:'m1',fromAi:false,body:'Treba mi krečenje'}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(tree.root.findAllByProps({accessibilityLabel:'Treba mi prevoz'})).toHaveLength(0);
  const closed=props();closed.openings=['Treba mi prevoz'];closed.canEdit=false;
  await act(async()=>tree.update(<AiConversationShell {...closed}/>));
  expect(tree.root.findAllByProps({accessibilityLabel:'Treba mi prevoz'})).toHaveLength(0);
});
it('an empty status fragment does not permanently collapse a normal task card',async()=>{
  const p=props();p.status=<></>;
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(p.card).toHaveBeenLastCalledWith(false);
  await act(async()=>mockKeyboard.keyboardDidShow());expect(p.card).toHaveBeenLastCalledWith(true);
  await act(async()=>mockKeyboard.keyboardDidHide());expect(p.card).toHaveBeenLastCalledWith(false);
});
it('offers a return to the latest answer without taking the reader away from earlier messages',async()=>{
  const p=props();p.messages=[{id:'a',fromAi:true,body:'Kada ti odgovara?'}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const scroll=(offset:number)=>tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScroll({
    nativeEvent:{contentOffset:{y:offset},contentSize:{height:1200},layoutMeasurement:{height:400}}});
  await act(async()=>{tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScrollBeginDrag();scroll(200);});
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(1);
  await act(async()=>tree.update(<AiConversationShell {...p} messages={[...p.messages,{id:'b',fromAi:true,body:'Možeš i kasnije da dopuniš.'}]}/>));
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(1);
  expect(p.onSend).not.toHaveBeenCalled();expect(p.onChange).not.toHaveBeenCalled();
  await act(async()=>tree.root.findByProps({testID:'ai-latest'}).props.onPress());
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(0);
  // Android may send a throttled intermediate event but finish the animation without another onScroll.
  await act(async()=>scroll(300));
  await act(async()=>tree.root.findByProps({testID:'ai-conversation-thread'}).props.onMomentumScrollEnd({
    nativeEvent:{contentOffset:{y:800},contentSize:{height:1200},layoutMeasurement:{height:400}}}));
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(0);
});
it('a different conversation drops the previous scroll hint',async()=>{
  const p=props();p.conversationKey='first';p.messages=[{id:'a',fromAi:true,body:'Prvi razgovor'}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  await act(async()=>{
    tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScrollBeginDrag();
    tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScroll({
      nativeEvent:{contentOffset:{y:0},contentSize:{height:1200},layoutMeasurement:{height:400}}});
  });
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(1);
  await act(async()=>tree.update(<AiConversationShell {...p} conversationKey="second"/>));
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(0);
});
it.each([{height:640,scale:1},{height:844,scale:2}])('compacts without disabling editing on constrained geometry %o',async({height,scale})=>{
  mockHeight=height;mockScale=scale;const p=props();
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(p.card).toHaveBeenLastCalledWith(true);
  expect(tree.root.findByProps({accessibilityLabel:'Poruka za asistenta'}).props.editable).toBe(true);
});

describe('deliberate reading intent', () => {
  let frames: Map<number, FrameRequestCallback>, frameId: number;
  beforeEach(() => {
    frames = new Map(); frameId = 0;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => { if (id != null) frames.delete(id); });
  });
  afterEach(() => { jest.restoreAllMocks(); });
  const flushFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); };
  const scroller = () => tree.root.findByProps({ testID: 'ai-conversation-thread' });
  const position = (y: number, height = 1200, viewport = 400) => ({ nativeEvent: {
    contentOffset: { y }, contentSize: { height }, layoutMeasurement: { height: viewport },
  } });
  const layout = (height: number) => ({ nativeEvent: { layout: { height } } });
  const mount = async (p: AiConversationShellProps) => {
    const measurements: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const inner = {};
    const context = { measureLayout: jest.fn((_ancestor: unknown, success: (x: number, y: number, width: number, height: number) => void) => { measurements.push(success); }) };
    const native = { scrollToEnd: jest.fn(), scrollTo: jest.fn(), measurements, context, inner };
    await act(async () => { tree = create(<AiConversationShell {...p} />, {
      createNodeMock: element => {
        const node = element.props as { testID?: string; innerViewRef?: { current: unknown } };
        if (node.testID === 'ai-conversation-thread') { node.innerViewRef!.current = inner; return native; }
        return node.testID === 'ai-task-context' ? context : null;
      },
    }); });
    return native;
  };
  it('follows the first pending turn across content and keyboard geometry, but cancels queued following on drag', async () => {
    const p = props(), native = await mount(p);
    await act(async () => { scroller().props.onLayout(layout(500)); scroller().props.onContentSizeChange(390, 700); flushFrame(); });
    expect(native.scrollToEnd).not.toHaveBeenCalled(); // Keep the untouched welcome at its beginning.
    await act(async () => tree.update(<AiConversationShell {...p} pending sentMessage="Prva poruka" />));
    await act(async () => { scroller().props.onContentSizeChange(390, 900); mockKeyboard.keyboardDidShow(); scroller().props.onLayout(layout(300)); });
    expect(native.scrollToEnd).toHaveBeenCalledWith({ animated: false });
    await act(async () => scroller().props.onScroll(position(0, 900, 300)));
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(0);
    native.scrollToEnd.mockClear();
    await act(async () => {
      scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(100, 900, 300));
      scroller().props.onScrollEndDrag(position(100, 900, 300)); flushFrame();
    });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
  });
  it('reveals an owned editor top once, ignores local height changes, then follows normally after it closes', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Potvrdi mesto' }];
    p.context = <View testID="place-editor" />; p.interactiveContextKey = 'place-1';
    const native = await mount(p);
    await act(async () => {
      scroller().props.onLayout(layout(400));
      tree.root.findByProps({ testID: 'ai-task-context' }).props.onLayout(layout(100));
      scroller().props.onContentSizeChange(390, 1400); flushFrame();
    });
    expect(native.context.measureLayout).toHaveBeenCalledWith(native.inner, expect.any(Function), expect.any(Function));
    await act(async () => native.measurements[0](0, 636, 300, 500));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 636, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    native.scrollTo.mockClear();
    await act(async () => {
      tree.root.findByProps({ testID: 'ai-task-context' }).props.onLayout(layout(500));
      scroller().props.onContentSizeChange(390, 1800); mockKeyboard.keyboardDidShow();
      scroller().props.onLayout(layout(250)); flushFrame();
    });
    expect(native.scrollTo).not.toHaveBeenCalled(); expect(native.scrollToEnd).not.toHaveBeenCalled();
    await act(async () => tree.update(<AiConversationShell {...p} interactiveContextKey={undefined} />));
    await act(async () => { scroller().props.onContentSizeChange(390, 1900); flushFrame(); });
    expect(native.scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(p.onSend).not.toHaveBeenCalled();
  });
  it.each([636, 820])('requires a fresh native measurement for a replacement owner, even without a layout event (y=%s)', async y => {
    const p = props(); p.conversationKey = 'conversation-a'; p.context = <View />; p.interactiveContextKey = 'place-a';
    const native = await mount(p);
    await act(async () => {
      scroller().props.onLayout(layout(400));
      scroller().props.onContentSizeChange(390, 800);
      flushFrame();
    });
    expect(native.measurements).toHaveLength(1);
    const oldMeasurement = native.measurements[0];
    // Same mounted wrapper and no onLayout: the new owner must request its own measurement anyway.
    await act(async () => tree.update(<AiConversationShell {...p} conversationKey="conversation-b" interactiveContextKey="place-b" />));
    await act(async () => flushFrame());
    expect(native.measurements).toHaveLength(2);
    await act(async () => oldMeasurement(0, 636, 300, 500));
    expect(native.scrollTo).not.toHaveBeenCalled();
    await act(async () => native.measurements[1](0, y, 300, 500));
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
  });
  it('cancels a pending editor reveal for deliberate history scrolling and never reclaims that offset', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Potvrdi mesto' }];
    p.context = <View />; p.interactiveContextKey = 'place-1';
    const native = await mount(p);
    await act(async () => {
      tree.root.findByProps({ testID: 'ai-task-context' }).props.onLayout({ nativeEvent: { layout: { y: 620 } } });
      scroller().props.onScrollBeginDrag(); scroller().props.onScrollEndDrag(position(200)); flushFrame();
    });
    expect(native.scrollTo).not.toHaveBeenCalled(); expect(native.scrollToEnd).not.toHaveBeenCalled();
    await act(async () => {
      scroller().props.onContentSizeChange(390, 1800); scroller().props.onLayout(layout(250)); flushFrame();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
  });
  // A tap on the confirmed place, which may sit far up the thread, opens its editor at the end: an explicit request reveals
  // that editor even while earlier messages are being read, which an editor that merely appeared never does.
  it('reveals an explicitly requested editor while earlier messages are being read', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    const native = await mount(p);
    await act(async () => {
      scroller().props.onLayout(layout(400)); flushFrame();
      scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(100)); scroller().props.onScrollEndDrag(position(100));
    });
    native.scrollTo.mockClear(); native.scrollToEnd.mockClear();
    await act(async () => tree.update(<AiConversationShell {...p} context={<View />} interactiveContextKey="place-saved" revealInteractiveContext />));
    await act(async () => flushFrame());
    expect(native.context.measureLayout).toHaveBeenCalledTimes(1);
    await act(async () => native.measurements[0](0, 880, 300, 200));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 880, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    // The same editor without an explicit request keeps the reader where they are.
    await act(async () => tree.update(<AiConversationShell {...p} />));
    native.scrollTo.mockClear(); native.context.measureLayout.mockClear();
    await act(async () => {
      scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(100)); scroller().props.onScrollEndDrag(position(100));
    });
    await act(async () => tree.update(<AiConversationShell {...p} context={<View />} interactiveContextKey="place-other" />));
    await act(async () => flushFrame());
    expect(native.context.measureLayout).not.toHaveBeenCalled(); expect(native.scrollTo).not.toHaveBeenCalled();
  });
  it('preserves the deliberate history offset when context, viewport and streaming content change', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    const native = await mount(p);
    await act(async () => {
      flushFrame(); scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(200));
      scroller().props.onScrollEndDrag(position(200));
    });
    native.scrollToEnd.mockClear();
    await act(async () => {
      // Native clamping is geometry, not a new place chosen by the reader.
      scroller().props.onScroll(position(140)); mockKeyboard.keyboardDidShow();
      scroller().props.onLayout(layout(250)); scroller().props.onContentSizeChange(390, 1600); flushFrame();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    await act(async () => tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(120)));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 320, animated: false });
    await act(async () => {
      tree.update(<AiConversationShell {...p} streamingText="Novi deo odgovora" />);
      tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(0));
      scroller().props.onContentSizeChange(390, 1800); flushFrame();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
  });
  it.each([0, 80])('keeps an anchor inside the old summary at %s when details expand', async offset => {
    mockScale = 2;
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    p.card = () => <View testID="summary" />;
    const native = await mount(p);
    const context = () => tree.root.findByProps({ testID: 'ai-inline-context' });
    await act(async () => {
      flushFrame(); context().props.onLayout(layout(180));
      scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(offset));
      scroller().props.onScrollEndDrag(position(offset));
    });
    native.scrollTo.mockClear(); native.scrollToEnd.mockClear();
    await act(async () => { context().props.onLayout(layout(340)); scroller().props.onContentSizeChange(320, 1360); flushFrame(); });
    expect(native.scrollTo).not.toHaveBeenCalled(); expect(native.scrollToEnd).not.toHaveBeenCalled();
    await act(async () => scroller().props.onLayout(layout(350)));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: offset, animated: false });
  });
  it('keeps the visible top in place when inline context is first inserted', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    const native = await mount(p);
    await act(async () => {
      flushFrame(); scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(0));
      scroller().props.onScrollEndDrag(position(0));
    });
    native.scrollTo.mockClear();
    await act(async () => tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(180)));
    expect(native.scrollTo).not.toHaveBeenCalled();
  });
  it('reserves space for latest while reading an expanded draft and preserves its review action', async () => {
    mockScale = 2;
    const p = props(), review = jest.fn();
    p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    p.card = () => <View testID="expanded-review" onTouchEnd={review} />;
    const native = await mount(p);
    await act(async () => {
      flushFrame();
      tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(360));
      scroller().props.onScrollBeginDrag(); scroller().props.onScrollEndDrag(position(80));
    });
    const region = tree.root.findByProps({ testID: 'ai-latest-region' });
    const latest = tree.root.findByProps({ testID: 'ai-latest' });
    expect(scroller().findAllByProps({ testID: 'ai-latest-region' })).toHaveLength(0);
    expect(StyleSheet.flatten(region.props.style).position).not.toBe('absolute');
    expect(StyleSheet.flatten(latest.props.style).position).not.toBe('absolute');
    native.scrollToEnd.mockClear();
    await act(async () => {
      scroller().props.onLayout(layout(304));
      scroller().findByProps({ testID: 'expanded-review' }).props.onTouchEnd();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 80, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    expect(review).toHaveBeenCalledTimes(1);
    await act(async () => latest.props.onPress());
    expect(tree.root.findAllByProps({ testID: 'ai-latest-region' })).toHaveLength(0);
    expect(p.onSend).not.toHaveBeenCalled();
  });
  it('treats accessible history scrolling as intent and resumes following only through latest or an enabled send', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Pitanje' }];
    const native = await mount(p);
    await act(async () => {
      flushFrame(); scroller().props.onScroll(position(800));
      scroller().props.onAccessibilityAction({ nativeEvent: { actionName: 'scrollBackward' } });
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 500, animated: false });
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
    await act(async () => tree.root.findByProps({ testID: 'ai-send' }).props.onPress());
    expect(p.onSend).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
    await act(async () => tree.root.findByProps({ testID: 'ai-latest' }).props.onPress());
    await act(async () => scroller().props.onScroll(position(600)));
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(0);
    await act(async () => {
      scroller().props.onAccessibilityAction({ nativeEvent: { actionName: 'scrollBackward' } });
      tree.update(<AiConversationShell {...p} canSend />);
    });
    await act(async () => tree.root.findByProps({ testID: 'ai-send' }).props.onPress());
    expect(p.onSend).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(0);
  });
});


it('shows a complete task in the thread with its decision facts, one review primary and a quiet edit entry', async () => {
  const review = jest.fn(), p = props();
  p.card = compact => <DraftCard summary={{ title: 'Prenos ormara', value: { kind: 'amount', amount: '4.000 RSD', basis: 'ukupno' },
    zone: 'Novi Sad · Liman', schedule: '3. okt · 17:00–19:00', people: '2 osobe' }}
    stillNeeded={null} open busy={false} compact={compact} canReview onReview={review} note={null} reviewAtEnd />;
  p.cardPlacement = 'end';
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(text()).toContain('Spremno za pregled');
  expect(text()).toContain('Prenos ormara'); expect(text()).toContain('Novi Sad · Liman');
  expect(text()).toContain('3. okt · 17:00–19:00'); expect(text()).toContain('2 osobe'); expect(text()).toContain('4.000 RSD');
  expect(tree.root.findAllByProps({ testID: 'intake-draft-disclosure' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'intake-draft-review' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'intake-draft-details' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ label: 'Pregledaj i objavi' })).toHaveLength(1);
  await act(async () => tree.root.findByProps({ label: 'Pregledaj i objavi' }).props.onPress());
  expect(review).toHaveBeenCalledTimes(1);
});

it('keeps an incomplete draft collapsible and does not call it ready', async () => {
  const p = props();
  p.card = compact => <DraftCard summary={{ title: 'Prenos', value: null, zone: '', people: null }}
    stillNeeded="termin · mesto" open busy={false} compact={compact} canReview={false} onReview={jest.fn()} note={null} reviewAtEnd={false} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(text()).toContain('Nacrt'); expect(text()).not.toContain('Spremno za pregled');
  expect(tree.root.findAllByProps({ testID: 'intake-draft-disclosure' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'intake-draft-details' })).toHaveLength(0);
});

it.each([
  { width: 361, scale: 1.15, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'ukupno' as const }, words: '5.000 RSD ukupno', brief: true },
  { width: 361, scale: 1.15, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'po osobi' as const }, words: '5.000 RSD po osobi', brief: true },
  { width: 361, scale: 1.15, value: { kind: 'offers' as const }, words: 'Tražim ponude', brief: true },
  { width: 361, scale: 1.3, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'ukupno' as const }, words: '5.000 RSD ukupno', brief: false },
  { width: 320, scale: 1.15, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'ukupno' as const }, words: '5.000 RSD ukupno', brief: false },
])('keeps compact draft terms and review authority at $width dp / $scale ($words)', async ({ width, scale, value, words, brief }) => {
  mockWidth = width; mockScale = scale;
  const p = props(), review = jest.fn(); let allowed = false;
  p.pending = true;
  p.card = compact => <DraftCard summary={{ title: 'Prenos ormara i kutija', value, zone: '', people: null }}
    stillNeeded="Opis · Lokacija" open busy compact={compact} canReview={allowed} onReview={review} note={null} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(text()).toContain(words); expect(text()).toContain('Još treba: Opis · Lokacija');
  const read = () => tree.root.findByProps({ testID: 'intake-draft-review' });
  expect(read().props.accessibilityLabel).toBe('Pregledaj zadatak');
  expect(read().props.disabled).toBe(true); await act(async () => read().props.onPress());
  expect(review).not.toHaveBeenCalled();
  const displayed = tree.root.findByProps({ testID: 'intake-draft-value' });
  if (brief) {
    expect(displayed.findAllByType(CardValue)).toHaveLength(0);
    const terms = displayed.findByType('T' as React.ElementType);
    expect(terms.props.children).toBe(words); expect(terms.props.numberOfLines).toBeUndefined();
    expect(read().findByType('T' as React.ElementType).props.children).toBe('Pregledaj');
  } else {
    expect(displayed.findByType(CardValue).props.value).toEqual(value);
    expect(StyleSheet.flatten(displayed.parent!.props.style).flexDirection).toBe('column');
  }
  allowed = true; await act(async () => tree.update(<AiConversationShell {...p} />));
  await act(async () => read().props.onPress()); expect(review).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({ testID: 'intake-draft-disclosure' }).props.accessibilityValue.text).toContain(words);
});

it('keeps a legal long amount complete in a constrained, wrapping value row at large text', async () => {
  mockScale = 2;
  const p = props();
  p.card = compact => <DraftCard summary={{ title: 'Veliki posao', value: { kind: 'amount', amount: '100.000.000 RSD', basis: 'ukupno' },
    zone: '', people: null }} stillNeeded={null} open busy={false} compact={compact} canReview onReview={jest.fn()} note={null} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const value = tree.root.findByProps({ testID: 'intake-draft-value' });
  expect(StyleSheet.flatten(value.props.style)).toMatchObject({ minWidth: 0, maxWidth: '100%', width: '100%', flexShrink: 1 });
  expect(StyleSheet.flatten(value.parent!.props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
  expect(value.findByType(CardValue).props.large).toBe(true);
  const amount = value.findAll(node => node.type === 'T' as React.ElementType && node.props.children === '100.000.000 RSD')[0];
  expect(amount.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(amount.props.style)).toMatchObject({ flexShrink: 1, maxWidth: '100%' });
  expect(text()).toContain('100.000.000 RSD'); expect(text()).toContain('ukupno');
  expect(tree.root.findByProps({ testID: 'intake-draft-disclosure' }).props.accessibilityValue.text).toContain('100.000.000 RSD ukupno');
});

it('shows the small USKOČI mark once per consecutive group while retaining the identity of every accessible turn', async () => {
  const p = props(); p.messages = [
    { id: 'a', fromAi: true, body: 'Prvo pitanje' }, { id: 'b', fromAi: true, body: 'Dopuna pitanja' },
    { id: 'u', fromAi: false, body: 'Odgovor' }, { id: 'c', fromAi: true, body: 'Sledeće pitanje' },
  ];
  await act(async () => { tree = create(<AiConversationShell {...p} streamingText="Dopuna" />); });
  expect(tree.root.findAllByProps({ testID: 'ai-assistant-mark' })).toHaveLength(2);
  for (const message of p.messages) expect(tree.root.findAllByProps({ accessibilityLabel: `${message.fromAi ? 'USKOČI' : 'Ti'}: ${message.body}` })).toHaveLength(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'USKOČI: Dopuna' }).props.accessibilityLiveRegion).toBe('none');
});

it.each(['intake', 'worker'] as const)('%s disclosure stays local, survives same-owner updates and resets with the stable ownership key', async kind => {
  const p = props(), review = jest.fn(); p.conversationKey = 'account:revision:opening-request';
  let disabled = true;
  const profile = { displayName: 'Ana', bio: '', skills: ['Selidbe'], tools: [], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] } };
  p.card = compact => kind === 'intake'
    ? <DraftCard summary={{ title: 'Selidba', value: null, zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe' }}
        stillNeeded="tačka na mapi" open busy={disabled} compact={compact} canReview={!disabled} onReview={review} note="Proveri detalje pre objave." />
    : <WorkerAiCard profile={profile} compact={compact} review={review} disabled={disabled} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const prefix = kind === 'intake' ? 'intake' : 'worker';
  const disclosure = () => tree.root.findByProps({ testID: `${prefix}-draft-disclosure` });
  const details = () => tree.root.findAllByProps({ testID: `${prefix}-draft-details` });
  const reviewTarget = () => tree.root.findByProps({ testID: `${prefix}-draft-review` });
  expect(details()).toHaveLength(0);
  await act(async () => { disclosure().props.onPress(); reviewTarget().props.onPress(); });
  expect(details()).toHaveLength(1); expect(disclosure().props.accessibilityState.expanded).toBe(true);
  expect(review).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  await act(async () => tree.update(<AiConversationShell {...p} messages={[{ id: 'first-persisted', fromAi: true, body: 'Primljeno' }]} />));
  expect(details()).toHaveLength(1); // A server ID arriving does not replace the stable owned opening key.
  if (kind === 'intake') { expect(text()).toContain('tačka na mapi'); expect(text()).toContain('Proveri detalje pre objave.'); }
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  expect(details()).toHaveLength(0);
  disabled = false;
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  await act(async () => reviewTarget().props.onPress());
  expect(review).toHaveBeenCalledTimes(1);
});

it('explains speech privacy in an in-app notice with one button, not a system alert',async()=>{
  // 2026-09-24: the (i) of the old voice bar is a quiet link under the welcome now (and the (i) of voice mode).
  const p=props();p.value='';p.voice=voice();
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  await act(async()=>tree.root.findByProps({accessibilityLabel:'O govornom unosu i privatnosti'}).props.onPress());
  const notice=tree.root.findByType(ConfirmSheet);
  expect(notice.props).toMatchObject({title:'Govorni unos i privatnost',message:VOICE_PROCESSING_NOTICE,confirmLabel:'U redu',cancelLabel:null});
  expect(notice.findAllByProps({testID:'confirm-sheet-cancel'})).toHaveLength(0);
  await act(async()=>notice.findByProps({testID:'confirm-sheet-confirm'}).props.onPress());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
});

describe('the floating composer (owner step 6, Gemini reference)', () => {
  it('empty: the microphone and the voice-mode button, no send; text: the round send instead', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const composer = tree.root.findByProps({ testID: 'ai-composer' });
    expect(composer.findAllByProps({ testID: 'voice-mic' }).length).toBeGreaterThan(0);
    expect(composer.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'ai-send' })).toHaveLength(0);
    const typed = { ...p, value: 'Treba mi prevoz', canSend: true };
    await act(async () => tree.update(<AiConversationShell {...typed} />));
    expect(tree.root.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(0);
    const send = tree.root.findByProps({ testID: 'ai-send' });
    expect(send.props).toMatchObject({ accessibilityLabel: 'Pošalji poruku', disabled: false });
    await act(async () => send.props.onPress());
    // The shell only asks: the screen's own send, with every guard it has, decides.
    expect(p.onSend).toHaveBeenCalledTimes(1);
  });
  it('whitespace is not text: the send stays away until something is written', async () => {
    const p = props(); p.value = '   '; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ testID: 'ai-send' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(1);
  });
  it('pending: the send is the same message again, disabled, and says why to the eye and to a screen reader', async () => {
    const p = props(); p.pending = true; p.canSend = false; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const send = tree.root.findByProps({ testID: 'ai-send' });
    expect(send.props).toMatchObject({ accessibilityLabel: 'Pošalji ponovo', disabled: true, accessibilityState: { disabled: true },
      accessibilityHint: 'Prethodna poruka još nije poslata. Proveri razgovor.' });
    expect(tree.root.findByProps({ testID: 'ai-send-reason' }).props.children).toBe('Prethodna poruka još nije poslata. Proveri razgovor.');
    const busy = { ...p, busy: true };
    await act(async () => tree.update(<AiConversationShell {...busy} />));
    expect(tree.root.findByProps({ testID: 'ai-send' }).props.accessibilityHint).toBe('Poruka se šalje.');
    // While it is being sent the thread itself says so ("Stiže odgovor…" or the streamed answer); nothing more is docked
    // above the composer (owner, 2026-10-07: nothing may stay at the bottom). The button still says why to a screen reader.
    expect(tree.root.findAllByProps({ testID: 'ai-send-reason' })).toHaveLength(0);
    expect(text()).toContain('Stiže odgovor…');
  });
  it('a send that can go says nothing extra', async () => {
    const p = props(); p.canSend = true;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ testID: 'ai-send-reason' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'ai-send' }).props.accessibilityHint).toBeUndefined();
  });
  it('"+" is drawn only when there is something to attach to, and says when it cannot be used', async () => {
    const p = props();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Fotografije zadatka' })).toHaveLength(0);
    const onPress = jest.fn();
    const attach = { ...p, attach: { label: 'Fotografije zadatka', onPress, disabled: true } };
    await act(async () => tree.update(<AiConversationShell {...attach} />));
    const plus = tree.root.findByProps({ accessibilityLabel: 'Fotografije zadatka' });
    expect(plus.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  });
  it('a tap on the held microphone explains itself above the composer; typing takes the advice away', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onResponderGrant === 'function')[0];
    await act(async () => { mic.props.onResponderGrant({ nativeEvent: { pageY: 200 } }); mic.props.onResponderRelease(); });
    expect(text()).toContain(HOLD_HINT);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.onChangeText('T'));
    expect(text()).not.toContain(HOLD_HINT);
  });
  // Review r4 ra item 7: once the field has text the waveform gives way to send, so the advice after a tap carries the
  // way to speak without holding; with a draft it opens voice mode with the review on, so speech joins the draft.
  it.each([['with a draft', 'Treba mi prevoz', true], ['with an empty field', '', false]] as const)(
    'the advice after a tap opens voice mode without holding %s', async (_name, value, review) => {
      const p = props(); p.value = value; p.canSend = !!value; p.voice = voice();
      await act(async () => { tree = create(<AiConversationShell {...p} />); });
      expect(tree.root.findAllByProps({ label: 'Govori bez držanja' })).toHaveLength(0);
      const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onResponderGrant === 'function')[0];
      await act(async () => { mic.props.onResponderGrant({ nativeEvent: { pageY: 200 } }); mic.props.onResponderRelease(); });
      await act(async () => tree.root.findByProps({ label: 'Govori bez držanja' }).props.onPress());
      expect(tree.root.findByType(VoiceMode).props.reviewFirst).toBe(review);
      expect(text()).not.toContain(HOLD_HINT);
      // Opening voice mode starts nothing: the one capture is the tap on the held microphone that brought the advice.
      expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice!.controller.begin).toHaveBeenCalledTimes(1);
    });
  // Verify r4b ra item B: Switch Access and Voice Access click the microphone (its `activate` action) instead of holding
  // it; with a draft in the field that click is their only way to speech, so it brings the same advice and its action.
  it('a Switch Access click on the held microphone shows the advice and the way to voice mode, and starts nothing', async () => {
    const p = props(); p.value = 'Treba mi prevoz'; p.canSend = true; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onAccessibilityAction === 'function')[0];
    expect(mic.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    await act(async () => mic.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(text()).toContain(HOLD_HINT);
    expect(p.voice!.controller.begin).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ label: 'Govori bez držanja' }).props.onPress());
    expect(tree.root.findByType(VoiceMode).props.reviewFirst).toBe(true);
    expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice!.controller.begin).not.toHaveBeenCalled();
  });
  it('the advice offers no voice mode while the screen cannot take a message', async () => {
    const p = props(); p.value = 'Treba mi prevoz'; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onResponderGrant === 'function')[0];
    await act(async () => { mic.props.onResponderGrant({ nativeEvent: { pageY: 200 } }); mic.props.onResponderRelease(); });
    expect(tree.root.findAllByProps({ label: 'Govori bez držanja' })).toHaveLength(0);
  });
  it('the chrome has no "···" when the screen has nothing to put behind it', async () => {
    const p = props(); delete p.onOptions;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opcije' })).toHaveLength(0);
  });
});

describe('voice mode', () => {
  it('opens from the waveform, shows the last exchange as text, and closes without touching the microphone', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    p.messages = [{ id: 'u', fromAi: false, body: 'Treba mi prevoz.' }, { id: 'a', fromAi: true, body: 'Odakle i dokle?' }];
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(0);
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    const mode = tree.root.findByType(VoiceMode);
    expect(mode.props).toMatchObject({ answer: 'Odakle i dokle?', said: 'Treba mi prevoz.', thinking: false });
    expect(text()).toContain('Odakle i dokle?');
    await act(async () => tree.root.findByProps({ testID: 'voice-mode-close' }).props.onPress());
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(0);
    expect(p.voice.controller.cancel).not.toHaveBeenCalled();
    expect(p.onSend).not.toHaveBeenCalled();
  });
  it('the waveform is disabled while the screen cannot take a message', async () => {
    const p = props(); p.value = ''; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findByProps({ testID: 'ai-voice-mode' }).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  });
  it('opens voice mode without capture, using the reduced-motion modal policy', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    mockReduced = true;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    expect(tree.root.findByType(VoiceMode).findAll(node => node.props.animationType !== undefined)[0].props.animationType).toBe('none');
    expect(tree.root.findByProps({ testID: 'voice-glow' }).props.importantForAccessibility).toBe('no-hide-descendants');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Razgovor glasom').length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
    mockReduced = false;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    expect(tree.root.findByType(VoiceMode).findAll(node => node.props.animationType !== undefined)[0].props.animationType).toBe('fade');
    expect(p.voice!.controller.begin).not.toHaveBeenCalled();
    expect(p.voice!.controller.release).not.toHaveBeenCalled();
    expect(p.onSend).not.toHaveBeenCalled();
    // Measured level / idle / background / reduced-motion resets are covered in voice-composer-controls.
  });
  it('a reviewed capture lands in the field and voice mode steps aside for it', async () => {
    const p = props(); p.value = ''; const v = voice(); p.voice = v;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Pregledaj tekst pre slanja' && node.props.onPress)[0].props.onPress());
    await act(async () => tree.root.findAll(node => node.props.testID === 'voice-mode-mic' && node.props.onPress)[0].props.onPress());
    expect(v.controller.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
    const session = { accountId: 'a', accountRevision: 1, conversationId: 'c', generation: 1, gestureId: 'GESTURE_SYNTHETIC', startedAt: 0, mode: 'accessible' as const };
    for (const phase of ['LISTENING', 'FINALIZING'] as const)
      await act(async () => tree.update(<AiConversationShell {...p} voice={{ ...v, state: { ...idle, phase, session } }} />));
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(1);
    await act(async () => tree.update(<AiConversationShell {...p} value="Treba mi prevoz." voice={{ ...v, state: { ...idle, session } }} />));
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(0);
  });
});

it('gives an active point question a compact draft while retaining disclosure, safety and review guards', async () => {
  const p = props(), review = jest.fn();
  p.card = compact => <DraftCard summary={{ title: 'Pomoć oko selidbe iz Novog Sada', value: null, zone: 'Novi Sad', people: '1 osoba' }}
    stillNeeded="Cena · Termin · tačka na mapi" open busy={false} compact={compact} canReview={false}
    onReview={review} note="Proveri detalje pre objave." locationEditing />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const disclosure = () => tree.root.findByProps({ testID: 'intake-draft-disclosure' });
  expect(text()).toContain('Nacrt'); expect(text()).toContain('Proveri detalje pre objave.');
  expect(disclosure().props.accessibilityValue.text).toContain('Pomoć oko selidbe iz Novog Sada');
  expect(text()).not.toContain('Još treba:');
  expect(tree.root.findAllByProps({ testID: 'intake-draft-review' })).toHaveLength(0);
  await act(async () => disclosure().props.onPress());
  expect(text()).toContain('Još treba: Cena · Termin · tačka na mapi');
  expect(text()).toContain('Novi Sad'); expect(text()).toContain('1 osoba');
  const reviewTarget = tree.root.findByProps({ testID: 'intake-draft-review' });
  expect(reviewTarget.props.accessibilityState.disabled).toBe(true);
  await act(async () => reviewTarget.props.onPress());
  expect(review).not.toHaveBeenCalled();
  await act(async () => disclosure().props.onPress());
  expect(text()).not.toContain('Još treba:'); expect(text()).toContain('Proveri detalje pre objave.');
});
