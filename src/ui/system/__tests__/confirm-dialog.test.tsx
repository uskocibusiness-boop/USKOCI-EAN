import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import { ConfirmSheet, DIALOG_MAX_WIDTH, SLOW_COMMAND_MS, confirmFormOf, useConfirmSheet, type ConfirmRequest } from '../ConfirmSheet';
import { brandAction, sheetLift, sys } from '../tokens';
import { Press } from '../../Press';

let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), mockReact = require('react');
  // The native Modal owns Back; the double keeps its one callback reachable (one function, so the tree is not rebuilt on every read).
  const Modal = ({ visible, children, ...props }: any) => visible ? mockReact.createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));

/**
 * The short question is a CENTRED DIALOG (owner 2026-10-07, plan 2.20): a white card, corner 24, a soft shadow, the screen
 * dimmed to 0.35, at most 340 wide. It keeps the contract the bottom sheet had, case for case (sheets.test.tsx holds those
 * cases for the sheet form): one confirm that runs once, a busy state while its command runs, every other ending routed to the
 * cancel path. What is new here: the dialog LEAVES (140 ms) after its screen has already been told it is over, and the form a
 * request is drawn in is chosen by one rule.
 */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const byTestId = (testID: string, root: ReactTestInstance = tree.root) => root.findByProps({ testID });
const has = (testID: string) => tree.root.findAllByProps({ testID }).length > 0;
const texts = (root: ReactTestInstance = tree.root) => root.findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const modals = () => tree.root.findAll(node => node.type === ('Modal' as unknown as React.ElementType));
const modal = () => tree.root.findByType('Modal' as unknown as React.ElementType);
const scrim = () => byTestId('confirm-sheet-scrim');
const press = async (instance: ReactTestInstance) => { await act(async () => { instance.props.onPress(); }); };
const deferred = () => { let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
/** The card: the one view that holds the title. */
const card = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityViewIsModal !== undefined)[0];
const layer = () => byTestId('confirm-dialog');
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.useRealTimers(); jest.restoreAllMocks(); });

const request = (patch: Partial<ConfirmRequest> = {}): ConfirmRequest => ({ title: 'Povući prijavu?',
  message: 'Prijava više neće biti aktivna.', confirmLabel: 'Povuci', ...patch });

describe('ConfirmSheet as a centred dialog', () => {
  it('asks with a title, one sentence, one confirm and one quiet cancel', async () => {
    await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(texts()).toContain('Povući prijavu?'); expect(texts()).toContain('Prijava više neće biti aktivna.');
    expect(byTestId('confirm-sheet-confirm').props.accessibilityLabel).toBe('Povuci');
    expect(byTestId('confirm-sheet-cancel').props.accessibilityLabel).toBe('Odustani');
    // The only commands are those two (the tap-outside area is not a Press): the card has no × of its own.
    expect(tree.root.findAllByType(Press).map(node => node.props.accessibilityLabel)).toEqual(['Povuci', 'Odustani']);
    expect(flat(byTestId('confirm-sheet-confirm').props.style).backgroundColor).toBe(sys.color.green);
    expect(flat(byTestId('confirm-sheet-cancel').props.style).backgroundColor).toBeUndefined();
    expect(flat(byTestId('confirm-sheet-cancel').props.style).minHeight).toBeGreaterThanOrEqual(48);
    // The confirm is the one primary action: brandAction's measure and corner, and the label in onGreen.
    expect(flat(byTestId('confirm-sheet-confirm').props.style)).toMatchObject({ minHeight: brandAction.minHeight, borderRadius: sys.radius.primary });
    expect(flat(byTestId('confirm-sheet-confirm').findByType('T' as unknown as React.ElementType).props.style).color).toBe(sys.color.onGreen);
    // The title is the card's heading for a screen reader.
    expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Povući prijavu?');
  });

  it('is a white card with corner 24 and a soft shadow, at most 340 wide, over a screen dimmed to 0.35, in a native Modal', async () => {
    await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(flat(card().props.style)).toMatchObject({ width: '100%', maxWidth: DIALOG_MAX_WIDTH, backgroundColor: sys.color.surface,
      borderRadius: sys.radius.card, ...sheetLift.detached });
    expect(DIALOG_MAX_WIDTH).toBe(340); expect(sys.radius.card).toBe(24);
    // The dim is a colour of its own, 0.35 black: #00000059 is 89/255.
    expect(sys.color.dim).toBe('#00000059'); expect(parseInt(sys.color.dim.slice(7), 16) / 255).toBeCloseTo(0.35, 2);
    // The dim is the tap-outside area, filling the window behind the card.
    expect(flat(scrim().props.style)).toMatchObject({ backgroundColor: sys.color.dim, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    expect(flat(layer().props.style)).toMatchObject({ flex: 1, alignItems: 'center', justifyContent: 'center', padding: sys.space.xl });
    expect(modal().props).toMatchObject({ transparent: true, statusBarTranslucent: true, animationType: 'fade' });
    // It is a dialog, not the bottom sheet engine.
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(0);
  });

  it('draws a destructive confirm in the danger colour, at the primary\'s measure', async () => {
    await render(<ConfirmSheet {...request({ tone: 'danger' })} onClosed={jest.fn()} />);
    expect(flat(byTestId('confirm-sheet-confirm').props.style)).toMatchObject({ backgroundColor: sys.color.danger, minHeight: brandAction.minHeight });
  });

  it('keeps a long sentence scrollable while the title and the two commands stay put, and never taller than the window less 24 each side', async () => {
    await render(<ConfirmSheet {...request({ message: 'Dugačka rečenica. '.repeat(60) })} onClosed={jest.fn()} />);
    const scroll = tree.root.findByType('ScrollView' as unknown as React.ElementType);
    expect(texts(scroll)).toContain('Dugačka rečenica.');
    expect(texts(scroll)).not.toContain('Povući prijavu?');
    expect(scroll.findAllByType(Press)).toHaveLength(0);
    expect(flat(scroll.props.style)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    expect(flat(card().props.style).maxHeight).toBeGreaterThan(0);
    expect(flat(card().props.style).maxHeight % 1).toBe(0);
  });

  // Round 2c (verifier vs, must 1), as for the sheet: "says nothing" must not be said in English, and an area that does nothing
  // is not visited at all.
  it('says what a tap outside does to the question, and is not visited while the command it started runs', async () => {
    const command = deferred();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={jest.fn()} />);
    expect(scrim().props).toMatchObject({ accessible: true, accessibilityRole: 'button', accessibilityLabel: 'Zatvori', accessibilityHint: 'Zatvara pitanje bez potvrde.' });
    await press(byTestId('confirm-sheet-confirm'));
    expect(scrim().props.accessible).toBe(false);
    // Never empty, so nothing has a reason to put an English default in its place.
    expect(scrim().props.accessibilityHint).toBe('Zatvori');
    await act(async () => { command.resolve(); await command.promise; });
  });

  it('turns the pressed confirm busy in place, without drawing the card or its buttons again', async () => {
    const command = deferred();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={jest.fn()} />);
    const confirm = byTestId('confirm-sheet-confirm'), cardBefore = card();
    await press(confirm);
    expect(byTestId('confirm-sheet-confirm').props.accessibilityState).toEqual({ disabled: true, busy: true });
    // The same nodes: a screen reader keeps its place on the button just pressed.
    expect(byTestId('confirm-sheet-confirm')).toBe(confirm); expect(card()).toBe(cardBefore);
    await act(async () => { tree.update(<ConfirmSheet {...request({ message: 'Druga rečenica.', onConfirm: () => command.promise })} onClosed={jest.fn()} />); });
    expect(byTestId('confirm-sheet-confirm')).toBe(confirm); expect(card()).toBe(cardBefore);
    await act(async () => { command.resolve(); await command.promise; });
  });

  it('runs a confirm once, however often it is pressed, then closes without cancelling', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    const confirm = byTestId('confirm-sheet-confirm').props.onPress, cancel = byTestId('confirm-sheet-cancel').props.onPress;
    await act(async () => { confirm(); confirm(); cancel(); });
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('stays busy and cannot be left while the command it started runs, and reports nothing itself', async () => {
    const command = deferred(), onCancel = jest.fn(), onClosed = jest.fn();
    const onConfirm = jest.fn(() => command.promise);
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    const confirm = byTestId('confirm-sheet-confirm');
    expect(confirm.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, busy: true } });
    expect(confirm.findAllByType('ActivityIndicator' as unknown as React.ElementType)).toHaveLength(1);
    expect(byTestId('confirm-sheet-cancel').props.disabled).toBe(true);
    // The quiet way out is grey while it cannot be used, not a faded ghost of itself.
    expect(flat(byTestId('confirm-sheet-cancel').findByType('T' as unknown as React.ElementType).props.style).color).toBe(sys.color.muted);
    expect(flat(byTestId('confirm-sheet-cancel').props.style).opacity).toBeUndefined();
    // No way out while it runs: not the confirm again, not cancel, not Back, not a tap outside.
    await press(confirm); await press(byTestId('confirm-sheet-cancel')); await act(async () => { modal().props.onRequestClose(); });
    await act(async () => { scrim().props.onPress(); });
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(onClosed).not.toHaveBeenCalled();
    const before = texts();
    await act(async () => { command.resolve(); await command.promise; });
    expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(texts()).toBe(before);
  });

  it('lets Back and a tap outside close the window once the command runs long, without cancelling or repeating it', async () => {
    jest.useFakeTimers();
    const command = deferred(), onCancel = jest.fn(), onClosed = jest.fn();
    const onConfirm = jest.fn(() => command.promise);
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    await act(async () => { jest.advanceTimersByTime(SLOW_COMMAND_MS - 1); });
    await act(async () => { modal().props.onRequestClose(); });
    expect(onClosed).not.toHaveBeenCalled(); expect(scrim().props.accessible).toBe(false);
    await act(async () => { jest.advanceTimersByTime(1); });
    // Still the same busy confirm, and still no cancel: the command runs on and the screen that owns it says so.
    expect(byTestId('confirm-sheet-confirm').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(byTestId('confirm-sheet-cancel').props.disabled).toBe(true);
    // A tap outside now only closes the window; it no longer answers the question, and it says so in Serbian.
    expect(scrim().props).toMatchObject({ accessible: true, accessibilityHint: 'Zatvara prozor; radnja se nastavlja.' });
    await act(async () => { modal().props.onRequestClose(); });
    expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled();
    await act(async () => { command.resolve(); await command.promise; });
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes after a command that fails, leaving the failure to the screen that owns it', async () => {
    const command = deferred(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    await act(async () => { command.reject(new Error('server')); await command.promise.catch(() => undefined); });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('cancel runs the cancel path once, and a confirm pressed after it does nothing', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    const confirm = byTestId('confirm-sheet-confirm').props.onPress;
    await press(byTestId('confirm-sheet-cancel')); await act(async () => { confirm(); });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it.each(['Back', 'a tap outside'])('%s is a cancel', async route => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await act(async () => { if (route === 'Back') modal().props.onRequestClose(); else scrim().props.onPress(); });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('a notice has one button and nothing to cancel', async () => {
    const onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ title: 'Govorni unos i privatnost', confirmLabel: 'U redu', cancelLabel: null })} onClosed={onClosed} />);
    expect(has('confirm-sheet-cancel')).toBe(false);
    // It asks nothing, so a tap outside closes a notice, not a question.
    expect(scrim().props.accessibilityHint).toBe('Zatvara obaveštenje.');
    await press(byTestId('confirm-sheet-confirm')); expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

/** What `Animated.timing` was asked to do, one entry per call. */
const timings = (spy: jest.SpyInstance) => spy.mock.calls.map(([value, config]) => ({ value, ...(config as object) })) as
  { value: Animated.Value; toValue: number; duration: number; useNativeDriver: boolean; easing: unknown }[];

describe('the motion of a dialog', () => {
  it('opens on a scale from 0.96 over 200 ms, decelerating, on the native driver, inside the Modal\'s own fade', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(sys.motion.dialog).toEqual({ enter: 200, from: 0.96 });
    // The window fades in (and out) by itself; the card scales in. One timing, nothing else of ours.
    expect(modal().props.animationType).toBe('fade');
    const calls = timings(timing);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ toValue: 1, duration: sys.motion.dialog.enter, useNativeDriver: true, easing: expect.any(Function) });
    // It starts small, so the first frame is not the finished card.
    const scale = flat(card().props.style).transform[0].scale as Animated.Value;
    expect(scale).toBeInstanceOf(Animated.Value);
    expect((scale as unknown as { __getValue(): number }).__getValue()).toBe(sys.motion.dialog.from);
    expect(calls[0].value).toBe(scale);
  });

  it('is simply there under reduced motion: the Modal does not fade, the card does not scale, no timing at all', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(timing).not.toHaveBeenCalled();
    expect(modal().props.animationType).toBe('none');
    expect(flat(card().props.style).transform).toBeUndefined();
    // The caller's own reading wins, as the other sheets take it.
    await act(async () => tree.unmount());
    mockReduced = false;
    await render(<ConfirmSheet {...request()} reduced onClosed={jest.fn()} />);
    expect(timing).not.toHaveBeenCalled(); expect(modal().props.animationType).toBe('none');
    await act(async () => tree.unmount());
    mockReduced = true;
    await render(<ConfirmSheet {...request()} reduced={false} onClosed={jest.fn()} />);
    expect(modal().props.animationType).toBe('fade'); expect(timing).toHaveBeenCalledTimes(1);
  });
});

describe('a dialog asked through useConfirmSheet', () => {
  let api: ReturnType<typeof useConfirmSheet>;
  function Screen({ reduced }: { reduced?: boolean }) { api = useConfirmSheet({ reduced }); return <>{api.sheet}</>; }
  const ask = (patch: Partial<ConfirmRequest> = {}) => act(async () => { api.ask(request(patch)); });

  it('draws nothing until a dialog has been asked, then one native Modal while it is open', async () => {
    await render(<Screen />);
    expect(modals()).toHaveLength(0); expect(api.sheet).toBeNull();
    await ask();
    expect(modals()).toHaveLength(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(1);
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(0); expect(api.open).toBe(true);
  });

  // The screen is told the moment the question is answered, and the dialog is gone from the tree with it: the platform lets
  // the Modal's window fade out after React has dropped it, so nothing of the card is left on the tree to read or press.
  it('is over for the screen, and gone from its tree, the moment it is answered', async () => {
    const onConfirm = jest.fn();
    await render(<Screen />); await ask({ onConfirm });
    await press(byTestId('confirm-sheet-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(modals()).toHaveLength(0);
    expect(api.open).toBe(false); expect(api.sheet).toBeNull(); expect(texts()).toBe('');
    // And so it is for a cancel, a Back and a question retired by its screen.
    await ask(); await press(byTestId('confirm-sheet-cancel')); expect(modals()).toHaveLength(0); expect(texts()).toBe('');
    await ask(); await act(async () => { modal().props.onRequestClose(); }); expect(modals()).toHaveLength(0); expect(texts()).toBe('');
    const onCancel = jest.fn();
    await ask({ onCancel }); await act(async () => { api.close(); });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(modals()).toHaveLength(0); expect(texts()).toBe('');
  });

  it('shows a new question at once when it is asked over an open one, and the old one ends as a cancel', async () => {
    const old = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await render(<Screen />); await ask({ title: 'Staro?', ...old });
    await ask({ title: 'Novo?' });
    expect(tree.root.findAllByType(ConfirmSheet).map(node => node.props.title)).toEqual(['Novo?']);
    expect(modals()).toHaveLength(1); expect(old.onCancel).toHaveBeenCalledTimes(1); expect(old.onConfirm).not.toHaveBeenCalled();
    // Back belongs to the new question.
    const onCancel = jest.fn();
    await act(async () => { api.ask(request({ title: 'Treće?', onCancel })); });
    await act(async () => { modal().props.onRequestClose(); });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('follows the caller\'s reading of reduced motion for the Modal\'s fade', async () => {
    await render(<Screen reduced />); await ask();
    expect(modal().props.animationType).toBe('none');
    await act(async () => tree.unmount());
    await render(<Screen />); await ask();
    expect(modal().props.animationType).toBe('fade');
  });
});

describe('which form a question is drawn in', () => {
  let api: ReturnType<typeof useConfirmSheet>;
  function Screen() { api = useConfirmSheet(); return <>{api.sheet}</>; }

  // ONE rule (`confirmFormOf`): extra content needs the sheet; otherwise the request's own word; otherwise a dialog. A request
  // with neither field, which is every call site today, is a dialog; nothing changes form by itself.
  it('is a dialog unless the request carries extra content or asks for the sheet', () => {
    expect(confirmFormOf({})).toBe('dialog');
    expect(confirmFormOf({ form: 'dialog' })).toBe('dialog');
    expect(confirmFormOf({ form: 'sheet' })).toBe('sheet');
    expect(confirmFormOf({ extra: <Text>Razlog</Text> })).toBe('sheet');
    expect(confirmFormOf({ form: 'dialog', extra: <Text>Razlog</Text> })).toBe('sheet');
    expect(confirmFormOf({ extra: 'Razlog' })).toBe('sheet');
    for (const nothing of [undefined, null, false]) expect(confirmFormOf({ extra: nothing })).toBe('dialog');
  });

  it('draws a plain request as a dialog, and extra content or form "sheet" as the bottom sheet, through the same hook', async () => {
    await render(<Screen />);
    await act(async () => { api.ask(request()); });
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(0); expect(has('confirm-dialog')).toBe(true);
    await act(async () => { api.ask(request({ extra: <Text testID="reasons">Izaberi razlog</Text> })); });
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1); expect(has('confirm-dialog')).toBe(false);
    // The extra content stands under the sentence, inside the sheet, and the two commands are the sheet's pinned footer.
    expect(has('reasons')).toBe(true); expect(byTestId('product-sheet-footer').findAllByType(Press)).toHaveLength(2);
    await act(async () => { api.ask(request({ form: 'sheet' })); });
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1); expect(has('reasons')).toBe(false); expect(has('confirm-dialog')).toBe(false);
    await act(async () => { api.ask(request({ form: 'dialog', extra: <Text>Razlog</Text> })); });
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1); expect(has('confirm-dialog')).toBe(false);
    await act(async () => { api.ask(request()); });
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(0); expect(has('confirm-dialog')).toBe(true);
  });

  it('a question that is a sheet answers like a sheet, and the sheet and the dialog share the one contract', async () => {
    await render(<Screen />);
    const onConfirm = jest.fn();
    await act(async () => { api.ask(request({ extra: <Text>Razlog</Text>, onConfirm })); });
    await press(byTestId('confirm-sheet-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    // The same two commands carry the same test ids in both forms, so a screen's suite does not care which form it got.
    for (const patch of [{}, { form: 'sheet' as const }]) {
      await act(async () => { api.ask(request(patch)); });
      expect([patch, byTestId('confirm-sheet-confirm').props.accessibilityLabel, byTestId('confirm-sheet-cancel').props.accessibilityLabel])
        .toEqual([patch, 'Povuci', 'Odustani']);
      await press(byTestId('confirm-sheet-cancel'));
    }
  });

  it('a dialog drawn on its own (no hook) is a Modal that is over as soon as it is answered', async () => {
    const onClosed = jest.fn();
    await render(<ConfirmSheet {...request()} onClosed={onClosed} />);
    expect(modals()).toHaveLength(1); expect(has('confirm-dialog')).toBe(true);
    await press(byTestId('confirm-sheet-cancel'));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});
