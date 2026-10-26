import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'GESTURE_SYNTHETIC' }));
import { AiConversationShell, type AiConversationShellProps } from '../../ui/aiFirst/AiConversationShell';
import { HOLD_HINT } from '../../ui/aiFirst/VoiceComposer';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { ScreenChrome } from '../../ui/system/ScreenChrome';
import { SkeletonList } from '../../ui/system/Skeleton';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { DraftCard, IntakeUnavailable } from '../../ui/v2/IntakePresentation';
import { QuietReadState } from '../../ui/v2/QuietReadState';
import { WorkerAiCard } from '../../ui/workerProfile/WorkerAiPresentation';

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
it('both interview screens use the same question-focused shared shell', () => {
  const intake = readFileSync(resolve(__dirname, '../../ui/v2/IntakePresentation.tsx'), 'utf8');
  const worker = readFileSync(resolve(__dirname, '../../app/(app)/profil/razgovor.tsx'), 'utf8');
  expect(intake).toMatch(/<AiConversationShell[\s\S]{0,200}questionFocus/);
  expect(worker).toMatch(/<AiConversationShell[\s\S]{0,200}questionFocus/);
});

it('question focus emphasizes only the latest AI turn and keeps old context readable', async () => {
  const p = props();
  p.questionFocus = true;
  p.messages = [
    { id: 'ai-old', fromAi: true, body: 'Starije pojašnjenje.' },
    { id: 'person', fromAi: false, body: 'U Novom Sadu.' },
    { id: 'ai-next', fromAi: true, body: 'Koliko ljudi ti treba?' },
  ];
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const findText = (value: string) => tree.root.findAllByType('T' as React.ElementType)
    .find(n => n.props.children === value)!;
  const previous = StyleSheet.flatten(findText('Starije pojašnjenje.').props.style);
  const latest = StyleSheet.flatten(findText('Koliko ljudi ti treba?').props.style);
  expect(previous.fontSize).toBeLessThan(latest.fontSize);
  expect(findText('U Novom Sadu.')).toBeDefined();
  expect(p.onSend).not.toHaveBeenCalled();
});

it('shows an instant local onboarding assistant bubble without sending or inventing a server turn', async () => {
  const p=props();
  p.introMessage='Dobrodošlica u USKOČI. Za početak, kakve zadatke želiš?';
  await act(async()=>{tree=create(<AiConversationShell {...p} />);});
  expect(tree.root.findAllByProps({testID:'ai-local-opening'})).toHaveLength(1);
  expect(text()).toContain('Za početak, kakve zadatke želiš?');
  expect(p.onSend).not.toHaveBeenCalled();
  expect(p.onChange).not.toHaveBeenCalled();
  await act(async()=>tree.update(<AiConversationShell {...p} introMessage={undefined}
    messages={[{id:'owned-user',fromAi:false,body:'Krečenje zidova'}]} />));
  expect(tree.root.findAllByProps({testID:'ai-local-opening'})).toHaveLength(0);
  expect(text()).toContain('Krečenje zidova');
  expect(p.onSend).not.toHaveBeenCalled();
});

it('both routes show client welcome only before actual owned messages arrive',()=>{
  const worker = readFileSync(resolve(__dirname, '../../app/(app)/profil/razgovor.tsx'),'utf8');
  const intake = readFileSync(resolve(__dirname, '../../ui/v2/IntakePresentation.tsx'),'utf8');
  expect(worker).toContain('introMessage={data.messages.length===0 && !unread ? workerInterviewOpening(hasProfileContent) : undefined}');
  expect(intake).toContain('introMessage={messages.length===0 && !props.sentMessage ? taskInterviewOpening(!!conversation.review.boundNeedId) : undefined}');
});

it('handles an overlay keyboard on Android without a second height-based window resize', async () => {
  const p = props();
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const container = tree.root.findByType('KeyboardAvoidingView' as React.ElementType);
  expect(container.props.behavior).toBe('padding');
});
it('a correction topic waits until editing is enabled, focuses once, and never changes or sends the unsent draft',async()=>{
  const p=props(),focus=jest.fn(),dismiss=jest.fn();
  const correction={token:'local-topic',target:'task.price' as const,title:'Cena i ponude',hint:'Napiši novi budžet.',onDismiss:dismiss};
  await act(async()=>{tree=create(<AiConversationShell {...p} canEdit={false} correction={correction}/>,{
    createNodeMock:element=>String(element.type)==='TextInput'?{focus}:null,
  });});
  expect(focus).not.toHaveBeenCalled();
  await act(async()=>tree.update(<AiConversationShell {...p} correction={correction}/>));
  expect(focus).toHaveBeenCalledTimes(1);
  await act(async()=>tree.update(<AiConversationShell {...p} value="Još uvek moj unos" correction={correction}/>));
  expect(focus).toHaveBeenCalledTimes(1);expect(p.onChange).not.toHaveBeenCalled();expect(p.onSend).not.toHaveBeenCalled();
  expect(tree.root.findByProps({accessibilityLabel:'Poruka za asistenta'}).props.value).toBe('Još uvek moj unos');
  await act(async()=>tree.root.findByProps({accessibilityLabel:'Zatvori temu izmene'}).props.onPress());
  expect(dismiss).toHaveBeenCalledTimes(1);
});
it('keeps the saved-action footer above the gesture area even when closing precedes keyboardDidHide', async () => {
  const p = props();
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const footer = () => tree.root.findByProps({ testID: 'ai-composer-footer' });
  expect(footer().props.edges).toEqual(['bottom']);
  await act(async () => { mockKeyboard.keyboardDidShow(); });
  expect(footer().props.edges).toEqual([]);
  await act(async () => { tree.update(<AiConversationShell {...p} closed footerAction={<View testID="saved-profile-action" />} />); });
  expect(footer().props.edges).toEqual(['bottom']);
  expect(footer().findAllByProps({ testID: 'ai-composer' })).toHaveLength(0);
  expect(footer().findByProps({ testID: 'saved-profile-action' })).toBeDefined();
  await act(async () => { mockKeyboard.keyboardDidHide(); });
  expect(footer().props.edges).toEqual(['bottom']);
});
it('protects a closed conversation action inside the scroll when the composer and footer are absent', async () => {
  const p = props();
  await act(async () => { tree = create(<AiConversationShell {...p} closed actions={<View testID="saved-in-thread" />} />); });
  expect(tree.root.findByProps({ testID: 'ai-conversation-safe-area' }).props.edges).toEqual(['top', 'bottom']);
  expect(tree.root.findAllByProps({ testID: 'ai-composer-footer' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'ai-conversation-thread' }).findByProps({ testID: 'saved-in-thread' })).toBeDefined();
  await act(async () => { tree.update(<AiConversationShell {...p} closed footerAction={<View />} />); });
  expect(tree.root.findByProps({ testID: 'ai-conversation-safe-area' }).props.edges).toEqual(['top']);
  expect(tree.root.findByProps({ testID: 'ai-composer-footer' }).props.edges).toEqual(['bottom']);
  await act(async () => { tree.update(<AiConversationShell {...p} />); });
  expect(tree.root.findByProps({ testID: 'ai-conversation-safe-area' }).props.edges).toEqual(['top']);
});
it('names the new conversation action visibly and defers its effect to the route confirmation', async () => {
  mockWidth = 320;
  const p = props(), restart = jest.fn(); p.newConversation = { onPress: restart };
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const control = tree.root.findByProps({ accessibilityLabel: 'Novi razgovor' });
  // At 320 dp the chrome must keep the full title width; the action lives by the latest turn.
  expect(tree.root.findByType(ScreenChrome).props.right).toBeUndefined();
  expect(tree.root.findByProps({ testID: 'ai-conversation-thread' }).findByProps({ testID: 'ai-new-conversation' })).toBe(control);
  expect(control.props.accessibilityHint).toMatch(/potvrdu/i);
  expect(control.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'Novi razgovor')).toHaveLength(1);
  expect(control.findAll(node => node.props.name === 'refresh' || node.props.name === 'more')).toHaveLength(0);
  expect(restart).not.toHaveBeenCalled();
  await act(async () => control.props.onPress());
  expect(restart).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<AiConversationShell {...p} newConversation={{ onPress: restart, disabled: true }} />));
  const disabled = tree.root.findByProps({ accessibilityLabel: 'Novi razgovor' });
  expect(disabled.props.accessibilityState.disabled).toBe(true);
  await act(async () => disabled.props.onPress());
  expect(restart).toHaveBeenCalledTimes(1);
});
it('keeps conversation management after the live card at the latest edge', async () => {
  mockWidth = 320;
  const p = props();
  p.messages = Array.from({length: 25}, (_, index) => ({id: `line-${index}`, fromAi: true, body: `Poruka ${index}`}));
  p.cardPlacement = 'end';
  p.card = () => <View testID="live-profile-card" />;
  p.onOptions = jest.fn();
  p.newConversation = {onPress: jest.fn()};
  p.exitAction = <View testID="worker-exit-action" />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const thread = tree.root.findByProps({testID:'ai-conversation-thread'});
  const trailing = thread.findAll(node => ['ai-end-card', 'ai-conversation-management'].includes(node.props.testID))
    .map(node => node.props.testID);
  expect(trailing).toEqual(['ai-end-card', 'ai-conversation-management']);
  const management = thread.findByProps({testID:'ai-conversation-management'});
  expect(thread.findAll(node => ['ai-latest-reply', 'ai-end-card', 'ai-conversation-management'].includes(node.props.testID))
    .map(node => node.props.testID)).toEqual(['ai-latest-reply', 'ai-end-card', 'ai-conversation-management']);
  expect(management.findByProps({testID:'ai-conversation-options'})).toBeDefined();
  expect(management.findByProps({testID:'ai-new-conversation'})).toBeDefined();
  expect(management.findByProps({testID:'worker-exit-action'})).toBeDefined();
});
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
it('offers named conversation tools without an ellipsis and leaves their authority with the screen', async () => {
  const p = props();
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(tree.root.findAll(node => node.props.name === 'more')).toHaveLength(0);
  expect(text()).toContain('Opcije razgovora');
  await act(async () => tree.root.findByProps({ testID: 'ai-conversation-options' }).props.onPress());
  expect(p.onOptions).toHaveBeenCalledTimes(1);
  expect(p.onSend).not.toHaveBeenCalled(); expect(p.onChange).not.toHaveBeenCalled();
});
it('keeps text and voice available but withdraws opening examples when the keyboard needs the space', async () => {
  const p = { ...props(), value: '', voice: voice(), initialInputMode: 'keyboard' as const,
    openings: ['Treba mi pomoć oko selidbe.'] };
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.value).toBe('');
  expect(tree.root.findAllByProps({ testID: 'ai-voice-review' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'ai-opening-examples' })).toBeDefined();
  await act(async () => { mockKeyboard.keyboardDidShow(); });
  expect(tree.root.findAllByProps({ testID: 'ai-opening-examples' })).toHaveLength(0);
  expect(text()).toContain(p.welcome); expect(text()).not.toContain(p.welcomeDetail);
  expect(p.onSend).not.toHaveBeenCalled(); expect(p.onChange).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'ai-voice-review' })).toBeDefined();
  expect(p.voice.controller.begin).not.toHaveBeenCalled();
});
it('places a partial understanding once before the latest question and keeps pending facts after the sent message', async () => {
  const p = { ...props(), card: () => <View testID="known-facts" />, cardPlacement: 'beforeLatestReply' as const,
    messages: [{ id: 'a', fromAi: false, body: 'Budžet 9000' }, { id: 'b', fromAi: true, body: 'Kada ti odgovara?' }] };
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const order = () => tree.root.findByProps({ testID: 'ai-conversation-thread' }).findAll(node =>
    node.props.testID === 'known-facts' || node.props.testID === 'ai-latest-reply').map(node => node.props.testID);
  expect(order()).toEqual(['known-facts', 'ai-latest-reply']);
  await act(async () => tree.update(<AiConversationShell {...p} sentMessage="Sutra" pending busy />));
  expect(tree.root.findAllByProps({ testID: 'known-facts' })).toHaveLength(1);
  expect(text()).toContain('Sutra'); expect(p.onSend).not.toHaveBeenCalled();
});
it('shows command progress without pretending that the assistant is typing', async () => {
  const p = props();
  await act(async () => { tree = create(<AiConversationShell {...p} busy busyLabel="Proveravamo da li je razgovor napušten…" />); });
  expect(text()).toContain('Proveravamo da li je razgovor napušten…');
  expect(text()).not.toContain('Stiže odgovor…');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'USKOČI piše odgovor' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'ai-command-progress' })).toHaveLength(1);
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
it('opens the owned conversation calmly and keeps Back and recovery distinct',async()=>{
  const back=jest.fn(), recover=jest.fn(), retry=jest.fn();
  await act(async()=>{tree=create(<IntakeUnavailable loading error="" back={back} recover={recover} retry={retry}/>);});
  expect(text()).toContain('Otvaramo razgovor');
  expect(text()).toContain('Pripremamo razgovor i proveravamo stanje nacrta.');
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(1);
  expect(tree.root.findByType(ScreenChrome).props.title).toBe('Novi zadatak');
  expect(tree.root.findByType(ScreenChrome).props.right).toBeUndefined();
  expect(tree.root.findAllByType(SkeletonList)).toHaveLength(0);
  expect(tree.root.findAllByType('ActivityIndicator'as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByProps({label:'Otvori prethodni razgovor'})).toHaveLength(0);
  await act(async()=>tree.root.findByType(ScreenChrome).props.onBack());
  expect(back).toHaveBeenCalledTimes(1);
  await act(async()=>tree.update(<IntakeUnavailable loading={false} error="Razgovor nije učitan." back={back} recover={recover} retry={retry}/>));
  expect(tree.root.findAllByType(QuietReadState)).toHaveLength(0);
  expect(text()).toContain('Razgovor nije dostupan');
  expect(text()).toContain('Razgovor nije učitan.');
  await act(async()=>tree.root.findByProps({label:'Otvori prethodni razgovor'}).props.onPress());
  expect(recover).toHaveBeenCalledTimes(1);
  expect(retry).not.toHaveBeenCalled();
  await act(async()=>tree.update(<IntakeUnavailable loading error="" back={back} title="Razgovor o zadatku"/>));
  expect(tree.root.findByType(ScreenChrome).props.title).toBe('Razgovor o zadatku');
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
it.each([undefined, 'end'] as const)('keeps one review reachable while typing with card placement %s', async cardPlacement => {
  const p = props(), review = jest.fn();
  p.cardPlacement = cardPlacement;
  p.messages = [{ id: 'answer', fromAi: true, body: 'U kom gradu radiš?' }];
  p.card = () => <View testID="review-target" onTouchEnd={review} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  await act(async () => { mockKeyboard.keyboardDidShow(); });
  const thread = tree.root.findByProps({ testID: 'ai-conversation-thread' });
  expect(tree.root.findAllByProps({ testID: 'ai-pinned-card' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'ai-end-card' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'review-target' })).toHaveLength(1);
  expect(thread.findByProps({ accessibilityLabel: 'USKOČI: U kom gradu radiš?' })).toBeDefined();
  await act(async () => { thread.findByProps({ testID: 'review-target' }).props.onTouchEnd(); });
  expect(review).toHaveBeenCalledTimes(1);
  await act(async () => { mockKeyboard.keyboardDidHide(); });
  expect(tree.root.findAllByProps({ testID: 'review-target' })).toHaveLength(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.value).toBe(p.value);
  expect(p.onChange).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
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
    const replies: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const inner = {};
    const context = { measureLayout: jest.fn((_ancestor: unknown, success: (x: number, y: number, width: number, height: number) => void) => { measurements.push(success); }) };
    const reply = { measureLayout: jest.fn((_ancestor: unknown, success: (x: number, y: number, width: number, height: number) => void) => { replies.push(success); }) };
    const native = { scrollToEnd: jest.fn(), scrollTo: jest.fn(), measurements, context, inner, replies };
    await act(async () => { tree = create(<AiConversationShell {...p} />, {
      createNodeMock: element => {
        const node = element.props as { testID?: string; innerViewRef?: { current: unknown } };
        if (node.testID === 'ai-conversation-thread') { node.innerViewRef!.current = inner; return native; }
        return node.testID === 'ai-task-context' ? context : node.testID === 'ai-latest-reply' ? reply : null;
      },
    }); });
    return native;
  };
  it('reveals the latest question before a trailing card, but retires a delayed measure when history or another conversation takes ownership', async () => {
    const p = { ...props(), conversationKey: 'one', cardPlacement: 'end' as const,
      messages: [{ id: 'answer', fromAi: true, body: 'Koji termin ti odgovara?' }], card: () => <View testID="review-target" /> };
    const native = await mount(p);
    await act(async () => { scroller().props.onLayout(layout(400)); scroller().props.onContentSizeChange(361, 1200); flushFrame(); });
    await act(async () => native.replies.at(-1)!(0, 500, 320, 100));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 500, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    const delayed = native.replies.at(-1)!;
    await act(async () => { scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(100)); scroller().props.onScrollEndDrag(position(100)); });
    native.scrollTo.mockClear();
    await act(async () => delayed(0, 800, 320, 100));
    expect(native.scrollTo).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ testID: 'ai-latest' }).props.onPress());
    const oldConversation = native.replies.at(-1)!;
    await act(async () => tree.update(<AiConversationShell {...p} conversationKey="two" />));
    native.scrollTo.mockClear();
    await act(async () => oldConversation(0, 900, 320, 100));
    expect(native.scrollTo).not.toHaveBeenCalled();
  });
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
  it('keeps a map explanation after the map, follows the answer and permits an explicit return to the same map', async () => {
    const p = props(); p.conversationKey = 'explanation';
    p.messages = [{ id: 'why', fromAi: false, body: 'Zašto mapa?' }, { id: 'answer', fromAi: true, body: 'Javna lokacija je približna.' }];
    p.context = <View testID="place-editor" />; p.interactiveContextKey = 'place'; p.contextBeforeMessageId = 'answer';
    const native = await mount(p);
    await act(async () => { scroller().props.onLayout(layout(400)); scroller().props.onContentSizeChange(390, 1400); flushFrame(); });
    expect(native.context.measureLayout).not.toHaveBeenCalled();
    expect(native.scrollToEnd).toHaveBeenCalledWith({ animated: false });
    const content = tree.root.findByProps({ testID: 'ai-task-context' }).parent!;
    const items = content.children.filter(child => typeof child !== 'string');
    expect(items.findIndex(child => child.props.testID === 'ai-task-context')).toBeLessThan(items.findIndex(child => child.findAllByProps({ id: 'answer' }).length > 0));
    expect(tree.root.findAllByProps({ testID: 'place-editor' })).toHaveLength(1);
    await act(async () => tree.update(<AiConversationShell {...p} revealInteractiveContext />));
    await act(async () => { flushFrame(); });
    await act(async () => native.measurements.at(-1)!(0, 500, 300, 600));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 500, animated: false });
    expect(p.onSend).not.toHaveBeenCalled();
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


it('shows the understood task and an explicit action to review before publishing', async () => {
  const review = jest.fn(), p = props();
  p.card = compact => <DraftCard summary={{ title: 'Prenos ormara', value: { kind: 'amount', amount: '4.000 RSD', basis: 'ukupno' },
    zone: 'Novi Sad · Liman', schedule: '3. okt · 17:00–19:00', people: '2 osobe' }}
    stillNeeded={null} open busy={false} compact={compact} canReview onReview={review} note={null} reviewAtEnd />;
  p.cardPlacement = 'end';
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(text()).toContain('Prenos ormara'); expect(text()).toContain('Novi Sad · Liman');
  expect(text()).toContain('3. okt · 17:00–19:00'); expect(text()).toContain('Treba 2 osobe'); expect(text()).toContain('4.000 RSD ukupno');
  expect(tree.root.findAllByProps({ testID: 'intake-draft-details' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ label: 'Pregledaj zadatak' })).toHaveLength(1);
  await act(async () => tree.root.findByProps({ label: 'Pregledaj zadatak' }).props.onPress());
  expect(review).toHaveBeenCalledTimes(1);
});

it('keeps an incomplete draft as the name, the facts it has and what is still needed, and does not call it ready', async () => {
  const p = props();
  p.card = compact => <DraftCard summary={{ title: 'Prenos', value: null, zone: '', people: null }}
    stillNeeded="termin · mesto" open busy={false} compact={compact} canReview={false} onReview={jest.fn()} note={null} reviewAtEnd={false} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  expect(text()).toContain('Prenos'); expect(text()).toContain('Još treba: termin · mesto');
  expect(text()).not.toContain('Spremno za pregled');
  // A draft with no fact yet has no row of facts at all; the way to the review is the quiet word, and it waits.
  expect(tree.root.findAllByProps({ testID: 'intake-draft-stickers' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'intake-draft-details' })).toHaveLength(0);
  expect(tree.root.findAllByType('Action' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'intake-draft-review' }).props.disabled).toBe(true);
});

it.each([
  { width: 361, scale: 1.15, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'ukupno' as const }, words: '5.000 RSD ukupno' },
  { width: 361, scale: 1.15, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'po osobi' as const }, words: '5.000 RSD po osobi' },
  { width: 361, scale: 1.15, value: { kind: 'offers' as const }, words: 'Tražim ponude' },
  { width: 361, scale: 1.3, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'ukupno' as const }, words: '5.000 RSD ukupno' },
  { width: 320, scale: 1.15, value: { kind: 'amount' as const, amount: '5.000 RSD', basis: 'ukupno' as const }, words: '5.000 RSD ukupno' },
])('keeps the draft terms whole beside a review that stays a finger high at $width dp / $scale ($words)', async ({ width, scale, value, words }) => {
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
  // The terms are a picture with ALL their words, wrapping when they must and never cut, whatever the size of the text or the card.
  const terms = tree.root.findByProps({ testID: 'intake-draft-stickers' }).findAllByType('T' as React.ElementType).find(node => node.props.children === words)!;
  expect(terms).toBeDefined(); expect(terms.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(read().props.style).minHeight).toBeGreaterThanOrEqual(48);
  allowed = true; await act(async () => tree.update(<AiConversationShell {...p} />));
  await act(async () => read().props.onPress()); expect(review).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({ testID: 'intake-draft-head' }).props.accessibilityLabel).toContain(words);
});

it('keeps a legal long amount complete in a constrained, wrapping line at large text', async () => {
  mockScale = 2;
  const p = props();
  p.card = compact => <DraftCard summary={{ title: 'Veliki posao', value: { kind: 'amount', amount: '100.000.000 RSD', basis: 'ukupno' },
    zone: '', people: null }} stillNeeded={null} open busy={false} compact={compact} canReview onReview={jest.fn()} note={null} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const line = tree.root.findByProps({ testID: 'intake-draft-stickers' });
  expect(StyleSheet.flatten(line.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  const amount = line.findAll(node => node.type === 'T' as React.ElementType && node.props.children === '100.000.000 RSD ukupno')[0];
  expect(amount.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(amount.props.style)).toMatchObject({ flexShrink: 1 });
  expect(StyleSheet.flatten(amount.parent!.props.style)).toMatchObject({ flexShrink: 1, maxWidth: '100%' });
  expect(text()).toContain('100.000.000 RSD'); expect(text()).toContain('ukupno');
  expect(tree.root.findByProps({ testID: 'intake-draft-head' }).props.accessibilityLabel).toContain('100.000.000 RSD ukupno');
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

it('worker disclosure stays local, survives same-owner updates and resets with the stable ownership key', async () => {
  const p = props(), review = jest.fn(); p.conversationKey = 'account:revision:opening-request';
  let disabled = true;
  const profile = { displayName: 'Ana', bio: '', skills: ['Selidbe'], tools: [], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] } };
  p.card = compact => <WorkerAiCard profile={profile} compact={compact} review={review} disabled={disabled} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const disclosure = () => tree.root.findByProps({ testID: 'worker-draft-disclosure' });
  const details = () => tree.root.findAllByProps({ testID: 'worker-draft-details' });
  const reviewTarget = () => tree.root.findByProps({ testID: 'worker-draft-review' });
  expect(details()).toHaveLength(0);
  await act(async () => { disclosure().props.onPress(); reviewTarget().props.onPress(); });
  expect(details()).toHaveLength(1); expect(disclosure().props.accessibilityState.expanded).toBe(true);
  expect(review).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  await act(async () => tree.update(<AiConversationShell {...p} messages={[{ id: 'first-persisted', fromAi: true, body: 'Primljeno' }]} />));
  expect(details()).toHaveLength(1); // A server ID arriving does not replace the stable owned opening key.
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  expect(details()).toHaveLength(0);
  disabled = false;
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  await act(async () => reviewTarget().props.onPress());
  expect(review).toHaveBeenCalledTimes(1);
});

it('the intake card keeps no state of its own: a server id arriving or a new key changes nothing, what is needed stays, and the review waits until it is allowed', async () => {
  const p = props(), review = jest.fn(); p.conversationKey = 'account:revision:opening-request';
  let disabled = true;
  p.card = compact => <DraftCard summary={{ title: 'Selidba', value: null, zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe' }}
    stillNeeded="tačka na mapi" open busy={disabled} compact={compact} canReview={!disabled} onReview={review} note="Proveri detalje pre objave." />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const facts = () => tree.root.findAllByProps({ testID: 'intake-draft-stickers' });
  const reviewTarget = () => tree.root.findByProps({ testID: 'intake-draft-review' });
  // Nothing opens or closes: the facts are simply there, with their words, and the review is disabled until the screen allows it.
  expect(facts()).toHaveLength(1); expect(text()).toContain('Novi Sad'); expect(text()).toContain('Sutra'); expect(text()).toContain('Treba 2 osobe');
  expect(tree.root.findAllByProps({ testID: 'intake-draft-disclosure' })).toHaveLength(0);
  await act(async () => { reviewTarget().props.onPress(); });
  expect(review).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  await act(async () => tree.update(<AiConversationShell {...p} messages={[{ id: 'first-persisted', fromAi: true, body: 'Primljeno' }]} />));
  expect(facts()).toHaveLength(1); expect(text()).toContain('tačka na mapi'); expect(text()).toContain('Proveri detalje pre objave.');
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  expect(facts()).toHaveLength(1); expect(text()).toContain('tačka na mapi');
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

describe('one composer with independent input, gesture and review choices', () => {
  it.each([1.15, 1.3])('starts with voice on 361dp at %s text scale, and preserves an unsent typed draft across explicit switches', async scale => {
    mockWidth = 361; mockScale = scale;
    const p = { ...props(), value: '', voice: voice() };
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Poruka za asistenta' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'ai-voice-review' }).props.accessibilityState.checked).toBe(false);
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    await act(async () => tree.update(<AiConversationShell {...p} value="Moj nedovršeni opis" />));
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    expect(tree.root.findByProps({ testID: 'ai-retained-draft' })).toBeDefined();
    // The control may be an icon; the visible cue and spoken hint must still
    // explain where the retained text is, independently of the composition.
    expect(text()).toMatch(/Neposlata poruka.*tastaturi/);
    expect(tree.root.findByProps({ testID: 'ai-input-mode' }).props).toMatchObject({
      accessibilityLabel: 'Pređi na tastaturu', accessibilityHint: 'Neposlata poruka je sačuvana.',
    });
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.value).toBe('Moj nedovršeni opis');
    expect(p.onChange).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice.controller.begin).not.toHaveBeenCalled();
  });
  it('correction keeps voice selected and does not open a keyboard or alter the draft', async () => {
    const focus = jest.fn(), p = { ...props(), value: '', voice: voice() };
    await act(async () => { tree = create(<AiConversationShell {...p} correction={{ token: 'change', target: 'task.price', title: 'Cena', hint: 'Reci novi budžet.', onDismiss: jest.fn() }} />,
      { createNodeMock: element => String(element.type) === 'TextInput' ? { focus } : null }); });
    expect(focus).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'ai-input-mode' }).props.accessibilityLabel).toBe('Pređi na tastaturu');
    expect(p.onChange).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  });
  it.each(['PERMISSION_PENDING', 'PREPARING', 'STARTING', 'LISTENING', 'FINALIZING'] as const)('does not switch input, preview or gesture during %s, including before React receives the controller state', async phase => {
    let snapshot = idle;
    const c = { ...controller(), getSnapshot: () => snapshot }, p = { ...props(), value: '', voice: voice({ controller: c as never }) };
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    snapshot = { ...idle, phase };
    for (const testID of ['ai-input-mode', 'ai-voice-review', 'ai-voice-gesture']) {
      await act(async () => tree.root.findByProps({ testID }).props.onPress());
    }
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Poruka za asistenta' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'ai-voice-review' }).props.accessibilityState.checked).toBe(false);
    expect(tree.root.findByProps({ testID: 'ai-voice-gesture' }).props.accessibilityLabel).toBe('Govori bez držanja');
    await act(async () => tree.update(<AiConversationShell {...p} voice={voice({ controller: c as never, state: snapshot })} />));
    for (const testID of ['ai-input-mode', 'ai-voice-review', 'ai-voice-gesture']) {
      expect(tree.root.findByProps({ testID }).props.disabled).toBe(true);
      expect(tree.root.findByProps({ testID }).props.accessibilityHint).toMatch(/govorni unos|Završi ili otkaži/);
    }
    expect(c.cancel).not.toHaveBeenCalled(); expect(c.release).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  });
  it.each([false, true])('a reviewed transcript reveals the whole resulting draft only after completion (batched completion %s)', async batched => {
    const p = { ...props(), value: 'Postojeći nacrt. ', voice: voice() };
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-review' }).props.onPress());
    const session = { mode: 'accessible', gestureId: 'g' } as VoiceSnapshot['session'];
    await act(async () => tree.update(<AiConversationShell {...p} voice={voice({ state: { ...idle, phase: 'LISTENING', session } })} />));
    const value = 'Postojeći nacrt. Prepoznati govor.';
    if (!batched) {
      await act(async () => tree.update(<AiConversationShell {...p} value={value} voice={voice({ state: { ...idle, phase: 'FINALIZING', session } })} />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Poruka za asistenta' })).toHaveLength(0);
    }
    await act(async () => tree.update(<AiConversationShell {...p} value={value} voice={voice({ state: { ...idle, session } })} />));
    expect(tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.value).toBe(value);
    expect(tree.root.findByProps({ testID: 'ai-transcript-review' })).toBeDefined();
    await act(async () => tree.update(<AiConversationShell {...p} conversationKey="another-owned-conversation" value={value} />));
    expect(tree.root.findAllByProps({ testID: 'ai-transcript-review' })).toHaveLength(0);
    expect(p.onChange).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  });
  it.each(['PERMISSION_PENDING', 'STARTING', 'LISTENING'] as const)('a cancelled preview capture from %s leaves voice selected without fabricating a draft', async phase => {
    const p = { ...props(), value: '', voice: voice() };
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-review' }).props.onPress());
    await act(async () => tree.update(<AiConversationShell {...p} voice={voice({ state: { ...idle, phase } })} />));
    await act(async () => tree.update(<AiConversationShell {...p} />));
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Poruka za asistenta' })).toHaveLength(0);
    expect(p.onChange).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  });
  it('an old completed review session cannot switch a later explicit voice choice when unrelated draft text changes', async () => {
    const session = { mode: 'accessible', gestureId: 'old' } as VoiceSnapshot['session'];
    const p = { ...props(), voice: voice({ state: { ...idle, session } }) };
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    await act(async () => tree.update(<AiConversationShell {...p} value="Sačuvana dopuna iz povratka" />));
    expect(tree.root.findByProps({ testID: 'ai-input-mode' }).props.accessibilityLabel).toBe('Pređi na tastaturu');
    expect(tree.root.findByProps({ testID: 'ai-retained-draft' })).toBeDefined();
    expect(p.onSend).not.toHaveBeenCalled(); expect(p.onChange).not.toHaveBeenCalled();
  });
  it('empty: one held microphone and no voice-mode entry; text: the round send', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const composer = tree.root.findByProps({ testID: 'ai-composer' });
    expect(composer.findAllByProps({ testID: 'voice-mic' }).length).toBeGreaterThan(0);
    expect(composer.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(0);
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
    expect(tree.root.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(0);
  });
  it('does not offer a resend for an unknown outcome; only an explicit owner retry grant reveals it', async () => {
    const p = props(); p.pending = true; p.canSend = false; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ testID: 'ai-send' })).toHaveLength(0);
    const input = tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' });
    expect(input.props.editable).toBe(false);
    await act(async () => input.props.onChangeText('Ne sme promeniti poslato'));
    expect(p.onChange).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
    const busy = { ...p, busy: true };
    await act(async () => tree.update(<AiConversationShell {...busy} />));
    expect(tree.root.findAllByProps({ testID: 'ai-send' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'ai-send-reason' })).toHaveLength(0);
    expect(text()).toContain('Stiže odgovor…');
    await act(async () => tree.update(<AiConversationShell {...p} canSend />));
    const retry = tree.root.findByProps({ testID: 'ai-send' });
    expect(retry.props).toMatchObject({ accessibilityLabel: 'Pošalji ponovo', disabled: false });
    await act(async () => retry.props.onPress());
    expect(p.onSend).toHaveBeenCalledTimes(1);
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
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Poruka za asistenta' }).props.onChangeText('T'));
    expect(text()).not.toContain(HOLD_HINT);
  });
  // Review r4 ra item 7: once the field has text the waveform gives way to send, so the advice after a tap carries the
  // way to speak without holding; with a draft it opens voice mode with the review on, so speech joins the draft.
  it.each([['with a draft', 'Treba mi prevoz', true], ['with an empty field', '', false]] as const)(
    'the advice switches the same microphone to accessible start/stop %s', async (_name, value, review) => {
      const p = props(); p.value = value; p.canSend = !!value; p.voice = voice();
      await act(async () => { tree = create(<AiConversationShell {...p} />); });
      if (value) await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
      expect(tree.root.findAllByProps({ label: 'Govori bez držanja' })).toHaveLength(0);
      const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onResponderGrant === 'function')[0];
      await act(async () => { mic.props.onResponderGrant({ nativeEvent: { pageY: 200 } }); mic.props.onResponderRelease(); });
      await act(async () => tree.root.findByProps({ label: 'Govori bez držanja' }).props.onPress());
      expect(tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onPress === 'function').length).toBeGreaterThan(0);
      expect(text()).not.toContain(HOLD_HINT);
      // Opening voice mode starts nothing: the one capture is the tap on the held microphone that brought the advice.
      expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice!.controller.begin).toHaveBeenCalledTimes(1);
    });
  // Verify r4b ra item B: Switch Access and Voice Access click the microphone (its `activate` action) instead of holding
  // it; with a draft in the field that click is their only way to speech, so it brings the same advice and its action.
  it('a Switch Access click on the held microphone shows the advice and the way to voice mode, and starts nothing', async () => {
    const p = props(); p.value = 'Treba mi prevoz'; p.canSend = true; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onAccessibilityAction === 'function')[0];
    expect(mic.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    await act(async () => mic.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(text()).toContain(HOLD_HINT);
    expect(p.voice!.controller.begin).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ label: 'Govori bez držanja' }).props.onPress());
    expect(tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onPress === 'function').length).toBeGreaterThan(0);
    expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice!.controller.begin).not.toHaveBeenCalled();
  });
  it('the advice offers no voice mode while the screen cannot take a message', async () => {
    const p = props(); p.value = 'Treba mi prevoz'; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-input-mode' }).props.onPress());
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onResponderGrant === 'function')[0];
    await act(async () => { mic.props.onResponderGrant({ nativeEvent: { pageY: 200 } }); mic.props.onResponderRelease(); });
    expect(tree.root.findAllByProps({ label: 'Govori bez držanja' })).toHaveLength(0);
  });
  it('omits unsupported conversation tools', async () => {
    const p = props(); delete p.onOptions;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opcije razgovora' })).toHaveLength(0);
  });
});

describe('one microphone, no separate AI voice conversation', () => {
  it('keeps finalization without recognized words beside the microphone without inventing a message', async()=>{
    const p=props(); p.value=''; p.voice=voice({state:{...idle,phase:'LISTENING'}});
    await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
    await act(async()=>tree.update(<AiConversationShell {...p} voice={voice({state:{...idle,phase:'FINALIZING'}})}/>));
    expect(tree.root.findAllByProps({testID:'voice-live-transcript'})).toHaveLength(0);
    expect(text()).toContain('Prepoznajemo govor…');
    expect(text()).toContain('Šta ti treba?');
    expect(p.onSend).not.toHaveBeenCalled();
    await act(async()=>tree.update(<AiConversationShell {...p} voice={voice()} sentMessage="Treba mi prevoz" busy pending/>));
    expect(text()).not.toContain('Prepoznajemo govor…');
    expect(text().split('Treba mi prevoz')).toHaveLength(2);
    expect(text()).toContain('Stiže odgovor…');
  });
  it('keeps real live speech beside the microphone, then puts only the sent message and thinking state in history', async()=>{
    const p=props();p.value='';p.voice=voice({state:{...idle,phase:'LISTENING',interimText:'Treba mi prevoz',audioLevel:0.6}});
    await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
    expect(tree.root.findByProps({testID:'ai-conversation-thread'}).findAllByProps({testID:'voice-live-transcript'})).toHaveLength(0);
    expect(tree.root.findByProps({testID:'ai-composer-footer'}).findAllByProps({testID:'voice-live-transcript'}).length).toBeGreaterThan(0);
    expect(text().split('Treba mi prevoz')).toHaveLength(2);
    expect(text()).toContain('Šta ti treba?');
    await act(async()=>tree.update(<AiConversationShell {...p} voice={voice()} sentMessage="Treba mi prevoz" busy pending/>));
    expect(tree.root.findAllByProps({testID:'voice-live-transcript'})).toHaveLength(0);
    expect(text().split('Treba mi prevoz')).toHaveLength(2);
    expect(text()).toContain('Stiže odgovor…');expect(p.onSend).not.toHaveBeenCalled();
  });
  it.each([false, true])('keeps the mode entry absent with reduced motion %s, without starting capture', async reduced => {
    mockReduced = reduced;
    const p = props(); p.value = ''; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'voice-mic' }).length).toBeGreaterThan(0);
    expect(p.voice.controller.begin).not.toHaveBeenCalled();
    expect(p.onSend).not.toHaveBeenCalled();
  });
});
