import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

/**
 * One question at a time (T4b1, 2026-10-07, M1): with `questionFocus` the latest message of the assistant is THE question,
 * drawn large while it waits for an answer, and what came before it is quieter. Off by default: the task conversation keeps
 * one size for every turn. Nothing is typed out or invented: the sizes follow the messages the screen hands in.
 */
const mockKeyboard: Record<string, () => void> = {};
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
  FadeInDown: { duration: (duration: number) => ({ duration, withInitialValues: () => ({ duration }) }) },
  useReducedMotion: () => false, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value,
  withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'GESTURE_SYNTHETIC' }));
import { AiConversationShell, type AiConversationShellProps } from '../../ui/aiFirst/AiConversationShell';
import { sys } from '../../ui/system/tokens';

let tree: ReactTestRenderer;
const base = (): AiConversationShellProps => ({ title: 'Radni profil', card: () => null, messages: [], welcome: 'Šta ti treba?', welcomeDetail: 'Opiši.',
  value: '', canEdit: true, canSend: false, pending: false, busy: false, onChange: jest.fn(), onSend: jest.fn(), onBack: jest.fn() });
const thread = [
  { id: 'a1', fromAi: true, body: 'Gde najčešće radiš?' },
  { id: 'u1', fromAi: false, body: 'Novi Beograd, do 15 km' },
  { id: 'a2', fromAi: true, body: 'Koje zadatke najradije preuzimaš?' },
];
const render = async (patch: Partial<AiConversationShellProps>) => { await act(async () => { tree = create(<AiConversationShell {...base()} {...patch} />); }); };
const style = (body: string) => StyleSheet.flatten(tree.root.findAll(node => node.type === ('T' as unknown as React.ElementType) && node.props.children === body)[0].props.style);
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('questionFocus', () => {
  it('is off by default: every turn of the assistant keeps the one speech size', async () => {
    await render({ messages: thread });
    expect(style('Gde najčešće radiš?')).toMatchObject({ fontSize: sys.type.speech.fontSize, color: sys.color.ink });
    expect(style('Koje zadatke najradije preuzimaš?')).toMatchObject({ fontSize: sys.type.speech.fontSize, color: sys.color.ink });
  });

  it('draws the latest question large and the earlier one quiet, and the person\'s own words as before', async () => {
    await render({ messages: thread, questionFocus: true });
    expect(style('Koje zadatke najradije preuzimaš?')).toMatchObject({ fontSize: sys.type.speechLarge.fontSize, lineHeight: sys.type.speechLarge.lineHeight, color: sys.color.ink });
    expect(style('Gde najčešće radiš?')).toMatchObject({ fontSize: sys.type.copy.fontSize, color: sys.color.muted });
    expect(style('Novi Beograd, do 15 km').fontSize).toBe(sys.type.body.fontSize);
    // No text is below the 12 px floor, and a screen reader still hears who said what.
    expect(style('Gde najčešće radiš?').fontSize).toBeGreaterThanOrEqual(12);
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'USKOČI: Koje zadatke najradije preuzimaš?').length).toBeGreaterThan(0);
  });

  it('has no question while the person\'s message is the last one: the earlier answer of the assistant is quiet', async () => {
    await render({ messages: thread.slice(0, 2), questionFocus: true });
    expect(style('Gde najčešće radiš?')).toMatchObject({ fontSize: sys.type.copy.fontSize });
  });

  it('a sentence just sent and not yet read back makes the last answer an earlier one, and the streamed answer is the question', async () => {
    await render({ messages: thread, questionFocus: true, sentMessage: 'Montaža nameštaja' });
    expect(style('Koje zadatke najradije preuzimaš?')).toMatchObject({ fontSize: sys.type.copy.fontSize });
    await act(async () => tree.update(<AiConversationShell {...base()} messages={thread} questionFocus sentMessage="Montaža nameštaja" streamingText="Gde si dostupan?" />));
    expect(style('Gde si dostupan?')).toMatchObject({ fontSize: sys.type.speechLarge.fontSize });
    expect(style('Koje zadatke najradije preuzimaš?')).toMatchObject({ fontSize: sys.type.copy.fontSize });
  });

  it('a streamed answer without the focus keeps the speech size too', async () => {
    await render({ messages: thread, streamingText: 'Gde si dostupan?' });
    expect(style('Gde si dostupan?')).toMatchObject({ fontSize: sys.type.speech.fontSize });
  });
});
