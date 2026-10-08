import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { DIALOG_MAX_WIDTH } from '../../system/ConfirmSheet';
import { brandAction, sys } from '../../system/tokens';
import { Press } from '../../Press';
import { PermissionAskHost } from '../PermissionAskHost';
import { PERMISSION_ASK_COPY, askInContext, permissionAsk, type PermissionAskAnswer, type PermissionKind, type PermissionNeed } from '../permissionAsk';

let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), mockReact = require('react');
  // The native Modal owns Back; the double keeps its one callback reachable and is drawn only while it is visible.
  const Modal = ({ visible, children, ...props }: any) => visible ? mockReact.createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));

/**
 * Permissions in context (design proposal N, owner 2026-10-07): right before the system asks, a small dialog with a picture, ONE
 * question and "Nastavi" / "Ne sada". The system window follows only on "Nastavi"; "Ne sada" asks the system nothing.
 */
let tree: ReactTestRenderer | undefined;
const mount = async (element: React.ReactElement = <PermissionAskHost />) => { await act(async () => { tree = create(element); }); };
const root = () => tree!.root;
const byTestId = (testID: string) => root().findByProps({ testID });
const has = (testID: string) => root().findAllByProps({ testID }).length > 0;
const texts = () => root().findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const modals = () => root().findAll(node => node.type === ('Modal' as unknown as React.ElementType));
const flat = (style: unknown): Record<string, any> => (StyleSheet.flatten(style as never) ?? {}) as Record<string, any>;
const press = async (instance: ReactTestInstance) => { await act(async () => { instance.props.onPress(); }); };
/** Asks, and collects the answer when it comes. */
function ask(kind: PermissionKind) {
  const result: { answer?: PermissionAskAnswer } = {};
  const promise = permissionAsk.ask(kind).then(answer => { result.answer = answer; });
  return { result, settled: async () => { await act(async () => { await promise; }); } };
}
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; mockReduced = false; });

describe('without a host to draw it', () => {
  it('answers "allow" at once: the feature behaves exactly as it did before the question existed', async () => {
    expect(permissionAsk.hasHost()).toBe(false);
    for (const kind of Object.keys(PERMISSION_ASK_COPY) as PermissionKind[]) expect(await permissionAsk.ask(kind)).toBe('allow');
  });
});

describe('the question', () => {
  it.each(Object.keys(PERMISSION_ASK_COPY) as PermissionKind[])('%s: a picture, ONE question, one sentence, a green "Nastavi" and a quiet "Ne sada"', async kind => {
    await mount();
    const { result } = ask(kind);
    await act(async () => {});
    const copy = PERMISSION_ASK_COPY[kind];
    expect(texts()).toBe([copy.title, copy.message, copy.allow, copy.later].join(' | '));
    expect(root().findByProps({ accessibilityRole: 'header' }).props.children).toBe(copy.title);
    // The picture is a fact picture of 64 dp and carries no meaning of its own for a screen reader.
    const art = root().findAll(node => typeof node.type !== 'string' && node.props.kind !== undefined && node.props.size === 64);
    expect([...new Set(art.map(node => node.props.kind))]).toEqual([copy.art]);
    expect(root().findAll(node => typeof node.type !== 'string' && node.props.kind !== undefined && node.props.size !== 64)).toHaveLength(0);
    // The only commands are the two answers (the dim behind the card is the tap-outside area, not a Press).
    expect(root().findAllByType(Press).map(node => node.props.accessibilityLabel)).toEqual(['Nastavi', 'Ne sada']);
    expect(flat(byTestId('permission-ask-allow').props.style)).toMatchObject({ backgroundColor: sys.color.green, minHeight: brandAction.minHeight, borderRadius: sys.radius.primary });
    expect(flat(byTestId('permission-ask-later').props.style).backgroundColor).toBeUndefined();
    expect(flat(byTestId('permission-ask-later').props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(flat(byTestId('permission-ask-allow').findByType('T' as unknown as React.ElementType).props.style).color).toBe(sys.color.onGreen);
    expect(result.answer).toBeUndefined();
    await press(byTestId('permission-ask-later'));
  });

  it('says exactly the words of the design proposal, in the "ti" voice, with no gender, no side names and no "server"', () => {
    expect(Object.fromEntries(Object.entries(PERMISSION_ASK_COPY).map(([kind, copy]) => [kind, [copy.title, copy.message]]))).toEqual({
      microphone: ['Da snimiš glasovnu poruku?', 'Snima se samo dok držiš dugme.'],
      photos: ['Da dodaš fotografiju?', 'Dodaju se samo slike koje izabereš.'],
      location: ['Da nađemo zadatke u blizini?', 'Samo dok je aplikacija otvorena.'],
      notifications: ['Da ti javimo kad stigne odgovor?', 'Samo o tvojim zadacima i Dogovorima.'],
    });
    for (const copy of Object.values(PERMISSION_ASK_COPY)) {
      expect([copy.allow, copy.later]).toEqual(['Nastavi', 'Ne sada']);
      for (const sentence of [copy.title, copy.message]) {
        expect(sentence).not.toMatch(/naručilac|uskočer|posao|poslovi|server|aplikacija će/i);
        expect(sentence).not.toMatch(/\b(sam|bio|bila|uneo|unela|snimio|snimila|dodao|dodala)\b/i);
      }
      // One question per dialog.
      expect(copy.title.match(/\?/g)).toHaveLength(1);
    }
  });

  it('is a centred dialog in the app\'s own measure: a native Modal, a white card at most 340 wide, the dim as the tap-outside area', async () => {
    await mount();
    ask('microphone'); await act(async () => {});
    expect(modals()).toHaveLength(1);
    expect(modals()[0].props).toMatchObject({ transparent: true, statusBarTranslucent: true, animationType: 'fade' });
    const card = root().findAll(node => typeof node.type !== 'string' && node.props.accessibilityViewIsModal !== undefined)[0];
    expect(flat(card.props.style)).toMatchObject({ width: '100%', maxWidth: DIALOG_MAX_WIDTH, backgroundColor: sys.color.surface, borderRadius: sys.radius.card });
    expect(flat(byTestId('permission-ask-scrim').props.style)).toMatchObject({ backgroundColor: sys.color.dim, position: 'absolute' });
    expect(byTestId('permission-ask-scrim').props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Zatvori', accessibilityHint: 'Zatvara pitanje bez dozvole.' });
    await press(byTestId('permission-ask-later'));
  });

  it('only appears and disappears under reduced motion: no fade, no scale', async () => {
    mockReduced = true;
    await mount();
    ask('location'); await act(async () => {});
    expect(modals()[0].props.animationType).toBe('none');
    const card = root().findAll(node => typeof node.type !== 'string' && node.props.accessibilityViewIsModal !== undefined)[0];
    expect(JSON.stringify(flat(card.props.style))).not.toContain('scale');
    await press(byTestId('permission-ask-later'));
  });
});

describe('the answer', () => {
  it('"Nastavi" lets the feature go on to the system\'s window, and the dialog is gone', async () => {
    await mount();
    const { result, settled } = ask('microphone'); await act(async () => {});
    await press(byTestId('permission-ask-allow')); await settled();
    expect(result.answer).toBe('allow'); expect(modals()).toHaveLength(0);
  });

  it('"Ne sada" asks the system nothing: the answer is "later"', async () => {
    await mount();
    const { result, settled } = ask('photos'); await act(async () => {});
    await press(byTestId('permission-ask-later')); await settled();
    expect(result.answer).toBe('later'); expect(modals()).toHaveLength(0);
  });

  it('Back and a tap outside the card are the same "no"', async () => {
    await mount();
    for (const close of [() => modals()[0].props.onRequestClose(), () => byTestId('permission-ask-scrim').props.onPress()]) {
      const { result, settled } = ask('location'); await act(async () => {});
      await act(async () => { close(); }); await settled();
      expect(result.answer).toBe('later'); expect(modals()).toHaveLength(0);
    }
  });

  it('is answered once: a second tap, or Back after "Nastavi", does not answer the question that follows', async () => {
    await mount();
    const first = ask('microphone'), second = ask('location'); await act(async () => {});
    expect(texts()).toContain(PERMISSION_ASK_COPY.microphone.title); expect(texts()).not.toContain(PERMISSION_ASK_COPY.location.title);
    const allow = byTestId('permission-ask-allow').props.onPress, close = modals()[0].props.onRequestClose;
    await act(async () => { allow(); allow(); close(); });
    await first.settled();
    expect(first.result.answer).toBe('allow');
    // The next question is on show, untouched by the first one's late taps.
    expect(second.result.answer).toBeUndefined();
    expect(texts()).toContain(PERMISSION_ASK_COPY.location.title);
    await press(byTestId('permission-ask-later')); await second.settled();
    expect(second.result.answer).toBe('later'); expect(modals()).toHaveLength(0);
  });

  it('asks in the order it was asked, one at a time', async () => {
    await mount();
    const kinds: PermissionKind[] = ['microphone', 'photos', 'location'];
    const asked = kinds.map(kind => ask(kind)); await act(async () => {});
    const seen: string[] = [];
    for (const item of asked) {
      seen.push(root().findByProps({ accessibilityRole: 'header' }).props.children);
      await press(byTestId('permission-ask-allow')); await item.settled();
    }
    expect(seen).toEqual(kinds.map(kind => PERMISSION_ASK_COPY[kind].title));
  });
});

describe('the host', () => {
  it('is mounted once: a second host does not draw a second dialog over the first', async () => {
    await mount(<><PermissionAskHost /><PermissionAskHost /></>);
    ask('microphone'); await act(async () => {});
    expect(modals()).toHaveLength(1);
    await press(byTestId('permission-ask-later'));
  });

  it('when it goes, a question that was waiting is "later", and a question asked afterwards is "allow"', async () => {
    await mount();
    const { result, settled } = ask('notifications'); await act(async () => {});
    expect(modals()).toHaveLength(1);
    await act(async () => tree!.unmount()); tree = undefined; await settled();
    expect(result.answer).toBe('later'); expect(permissionAsk.hasHost()).toBe(false);
    expect(await permissionAsk.ask('notifications')).toBe('allow');
  });

  it('when the first of two hosts goes, the second takes over the question that was open', async () => {
    const both = <><PermissionAskHost /><PermissionAskHost key="second" /></>;
    await mount(both);
    ask('photos'); await act(async () => {});
    expect(modals()).toHaveLength(1);
    await act(async () => { tree!.update(<><PermissionAskHost key="second" /></>); });
    expect(modals()).toHaveLength(1); expect(has('permission-ask')).toBe(true);
    await press(byTestId('permission-ask-later'));
  });
});

describe('askInContext: the dialog comes only when the system is about to ask', () => {
  const run = async (need: () => Promise<PermissionNeed>) => {
    const answer: { value?: PermissionAskAnswer } = {};
    const promise = askInContext('microphone', need).then(value => { answer.value = value; });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    return { answer, promise };
  };
  it.each<PermissionNeed>(['granted', 'blocked', 'unknown'])('%s: no dialog, straight on', async need => {
    await mount();
    const { answer, promise } = await run(async () => need); await act(async () => { await promise; });
    expect(answer.value).toBe('allow'); expect(modals()).toHaveLength(0);
  });
  it('a state that cannot be read is not guessed at: straight on', async () => {
    await mount();
    const { answer, promise } = await run(async () => { throw new Error('native module missing'); });
    await act(async () => { await promise; });
    expect(answer.value).toBe('allow'); expect(modals()).toHaveLength(0);
  });
  it.each<[PermissionAskAnswer, string]>([['allow', 'permission-ask-allow'], ['later', 'permission-ask-later']])('"ask": the dialog is drawn, and its answer (%s) is the result', async (expected, button) => {
    await mount();
    const { answer, promise } = await run(async () => 'ask');
    expect(modals()).toHaveLength(1); expect(answer.value).toBeUndefined();
    await press(byTestId(button)); await act(async () => { await promise; });
    expect(answer.value).toBe(expected);
  });
});
