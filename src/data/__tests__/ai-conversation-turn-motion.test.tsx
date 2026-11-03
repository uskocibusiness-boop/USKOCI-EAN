import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/** Mounted shared-shell checks: ordinary history and a one-time directional
 * arrival. Native primitives/animation builders are controlled ports; this
 * is not a phone render or an animation-frame benchmark. */
const mockKeyboard: Record<string, () => void> = {};
let mockReduced = false;
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) {
    if (key === 'Keyboard') return { addListener: (name: string, cb: () => void) => { mockKeyboard[name] = cb; return { remove: jest.fn() }; }, dismiss: jest.fn() };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, fontScale: 1, scale: 3 });
    if (key === 'AccessibilityInfo') return { isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove: jest.fn() }),
      announceForAccessibility: jest.fn(), isReduceMotionEnabled: async () => false };
    return ['View', 'ScrollView', 'KeyboardAvoidingView', 'TextInput', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: (duration: number) => ({ duration }) },
  // An entrance is a chain (`duration`, `easing`, `withInitialValues`), and its curve comes from Reanimated's own `Easing`.
  FadeInDown: { duration: (duration: number) => { const chain: Record<string, unknown> = { duration, easing: () => chain, withInitialValues: (value: unknown) => { chain.initialValues = value; return chain; } }; return chain; } },
  Easing: { bezier: () => (value: number) => value },
  useReducedMotion: () => false, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value,
  withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/aiFirst/AiAssistantArt', () => ({ AiAssistantArt: 'AiAssistantArt', AiAssistantWelcome: 'AiAssistantWelcome' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'GESTURE_SYNTHETIC' }));
import { AiConversationShell, type AiConversationShellProps } from '../../ui/aiFirst/AiConversationShell';
import { sys } from '../../ui/system/tokens';

let tree: ReactTestRenderer, props: AiConversationShellProps;
const ai = (id: string, body = 'Novi odgovor.') => ({ id, fromAi: true, body });
const user = (id: string, body = 'Moja poruka.') => ({ id, fromAi: false, body });
const draw = async () => { await act(async () => { tree = create(<AiConversationShell {...props} />); }); };
const update = async (patch: Partial<AiConversationShellProps>) => {
  props = { ...props, ...patch };
  await act(async () => { tree.update(<AiConversationShell {...props} />); });
};
const frame = (label: string) => tree.root.findAll(node =>
  ['View', 'AnimatedView'].includes(String(node.type)) && node.props.accessibilityLabel === label)[0];
const content = (body: string) => tree.root.findAll(node => String(node.type) === 'T' && node.props.children === body)[0];
beforeEach(() => {
  mockReduced = false;
  props = { title: 'Novi zadatak', conversationKey: 'account:conversation', card: () => null,
    messages: [user('u0', 'Prvo pitanje.'), ai('a0', 'Raniji odgovor.')], welcome: 'Opišite zadatak', welcomeDetail: '',
    value: '', canEdit: true, canSend: false, pending: false, busy: false,
    onChange: jest.fn(), onSend: jest.fn(), onBack: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

test('existing history uses ordinary views and stays mounted while the composer changes', async () => {
  await draw();
  expect(frame('USKOČI: Raniji odgovor.').type).toBe('View');
  expect(frame('Vi: Prvo pitanje.').type).toBe('View');
  const before = content('Raniji odgovor.');
  await update({ value: 'Dopisujem detalje', canSend: true });
  expect(content('Raniji odgovor.')).toBe(before);
  expect(frame('USKOČI: Raniji odgovor.').props.entering).toBeUndefined();
});

test('new assistant content enters from above with the shared 8dp/240ms motion and retains its host', async () => {
  await draw();
  await update({ messages: [...props.messages, ai('a1')] });
  const host = frame('USKOČI: Novi odgovor.');
  expect(host.type).toBe('AnimatedView');
  expect(host.props.entering).toMatchObject({ duration: sys.motion.enter,
    initialValues: { transform: [{ translateY: -sys.motion.categories.content.reveal.translateY }] } });
  const text = content('Novi odgovor.'), entrance = host.props.entering;
  await update({ value: 'Sledeće pitanje', messages: [...props.messages] });
  expect(frame('USKOČI: Novi odgovor.')).toBe(host);
  expect(content('Novi odgovor.')).toBe(text);
  expect(frame('USKOČI: Novi odgovor.').props.entering).toBe(entrance);
});

test('a new user row enters from below and never remounts when it settles', async () => {
  await draw();
  await update({ messages: [...props.messages, user('u1')] });
  const host = frame('Vi: Moja poruka.');
  expect(host.props.entering).toMatchObject({ duration: sys.motion.enter,
    initialValues: { transform: [{ translateY: sys.motion.categories.content.reveal.translateY }] } });
  await update({ messages: [...props.messages], value: 'Još nešto' });
  expect(frame('Vi: Moja poruka.')).toBe(host);
});

test('stream and local sent preview readback settle as plain canonical rows, without a second entrance', async () => {
  await draw();
  await update({ sentMessage: 'Moja poruka.', streamingText: 'Novi', busy: true });
  await update({ messages: [...props.messages, user('u1'), ai('a1')], sentMessage: null, streamingText: '', busy: false });
  expect(frame('Vi: Moja poruka.').type).toBe('View');
  expect(frame('USKOČI: Novi odgovor.').type).toBe('View');
});

test('reduced-motion arrival stays plain when the preference later allows movement', async () => {
  await draw(); mockReduced = true;
  await update({ messages: [...props.messages, ai('a1')] });
  const host = frame('USKOČI: Novi odgovor.'), text = content('Novi odgovor.');
  expect(host.type).toBe('View');
  mockReduced = false; await update({ value: 'Dalje', messages: [...props.messages] });
  expect(frame('USKOČI: Novi odgovor.')).toBe(host);
  expect(content('Novi odgovor.')).toBe(text);
});

test('reordering or prepending history does not create animated wrappers or replay a conversation', async () => {
  await draw();
  await update({ messages: [ai('older', 'Starija poruka.'), ...props.messages] });
  expect(frame('USKOČI: Starija poruka.').type).toBe('View');
  await update({ conversationKey: 'other:conversation', messages: [ai('new-history', 'Druga istorija.')] });
  expect(frame('USKOČI: Druga istorija.').type).toBe('View');
});
