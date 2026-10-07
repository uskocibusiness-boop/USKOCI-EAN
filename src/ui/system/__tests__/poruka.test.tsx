import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import * as Haptics from 'expo-haptics';
import { PORUKA_MAX_WIDTH, PORUKA_MS, PorukaHost, poruka } from '../Poruka';
import { sheetLift, sys } from '../tokens';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: { Success: 'success', Error: 'error' } }));

/**
 * "Poruka" (plan 2.4): the one short outcome bar. One host is mounted once; a screen calls `poruka.show(...)` and renders
 * nothing. These cases pin what the plan asks of it: one at a time, 4 s (6 s with an action), announced to a screen reader,
 * a success tick only when the server confirmed, 240 ms in and 160 ms out on the native driver, nothing but appearing under
 * reduced motion.
 */
let tree: ReactTestRenderer;
const CLEARANCE = 96;
const render = async (clearance = CLEARANCE) => { await act(async () => { tree = create(<PorukaHost clearance={clearance} />); }); };
const show = async (...args: Parameters<typeof poruka.show>) => { let id = 0; await act(async () => { id = poruka.show(...args); }); return id; };
const hide = async (id?: number) => { await act(async () => { poruka.hide(id); }); };
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
/** The bar as the host drew it (animated values resolved to numbers), and the Animated view that was asked for (the values themselves). */
const bar = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'poruka')[0];
const asked = () => tree.root.findByProps({ testID: 'poruka' });
const bars = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'poruka');
/** What positions the bar: the layer around it. */
const layerOf = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.pointerEvents === 'box-none')[0];
const texts = () => tree.root.findAll(node => node.type === ('T' as unknown as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string'));
const action = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.testID === 'poruka-action')[0];
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const timings = (spy: jest.SpyInstance) => spy.mock.calls.map(([, config]) => config as { toValue: number; duration: number; useNativeDriver: boolean });

beforeEach(() => { jest.useFakeTimers(); poruka.hide(); jest.mocked(Haptics.notificationAsync).mockClear(); });
afterEach(async () => { await act(async () => tree?.unmount()); poruka.hide(); mockReduced = false; jest.useRealTimers(); jest.restoreAllMocks(); });

describe('Poruka: what is drawn', () => {
  it('draws nothing while there is no message, and draws it the moment one is shown', async () => {
    await render();
    expect(tree.toJSON()).toBeNull();
    await show({ text: 'Nacrt je obrisan.' });
    expect(bars()).toHaveLength(1); expect(texts()).toEqual(['Nacrt je obrisan.']);
    await hide();
    await advance(sys.motion.exit + 40);
    expect(tree.toJSON()).toBeNull();
  });

  it('is a white capsule on the lift of a sheet, black 15 px words, 16 dp in from both edges and 16 above what it must clear', async () => {
    await render();
    await show({ text: 'Nacrt je obrisan.' });
    expect(flat(bar())).toMatchObject({ backgroundColor: sys.color.surface, borderRadius: sys.radius.sheet, maxWidth: PORUKA_MAX_WIDTH, minHeight: 52,
      ...sheetLift.detached });
    const words = tree.root.findAll(node => node.type === ('T' as unknown as React.ElementType))[0];
    expect(words.props).toMatchObject({ variant: 'copy', numberOfLines: 3 });
    expect(sys.type.copy.fontSize).toBe(15);
    expect(flat(words).color).toBe(sys.color.ink);
    expect(flat(layerOf())).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: CLEARANCE + 16 });
    expect(layerOf().props.pointerEvents).toBe('box-none');
    // Wherever the layout puts the bar, the message floats the same 16 above it.
    await act(async () => tree.unmount());
    await render(40);
    await show({ text: 'Drugo.' });
    expect(flat(layerOf()).bottom).toBe(56);
  });

  it('carries one green text button at most, a full 44 to touch, and no button when there is no action', async () => {
    await render();
    await show({ text: 'Blokiranje je sačuvano.' });
    expect(action()).toBeUndefined();
    await show({ text: 'Blokiranje je sačuvano.', action: { label: 'Vrati', onPress: jest.fn() } });
    expect(action().props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Vrati' });
    expect(flat(action()).minHeight).toBeGreaterThanOrEqual(44); expect(flat(action()).minWidth).toBeGreaterThanOrEqual(44);
    const label = action().findAll(node => node.type === ('T' as unknown as React.ElementType))[0];
    expect(flat(label).color).toBe(sys.color.green);
    expect(label.props.children).toBe('Vrati');
    expect(sys.touch.min).toBeGreaterThanOrEqual(44);
  });

  it('runs its action once, after taking the message away, so an action that shows a message of its own keeps it', async () => {
    await render();
    const log: string[] = [];
    await show({ text: 'Blokiranje je sačuvano.', action: { label: 'Vrati', onPress: () => { log.push(`shown:${poruka.current()?.text ?? 'none'}`); poruka.show({ text: 'Blokiranje je uklonjeno.' }); } } });
    await act(async () => { action().props.onPress(); });
    expect(log).toEqual(['shown:none']);
    expect(poruka.current()?.text).toBe('Blokiranje je uklonjeno.');
    expect(texts()).toEqual(['Blokiranje je uklonjeno.']);
    expect(action()).toBeUndefined();
  });

  it('shows nothing for an empty text, and hides only the message it was asked about', async () => {
    await render();
    expect(poruka.show({ text: '   ' })).toBe(0); expect(poruka.current()).toBeNull();
    const first = await show({ text: 'Prva.' });
    const second = await show({ text: 'Druga.' });
    expect(second).toBeGreaterThan(first);
    await hide(first);
    expect(texts()).toEqual(['Druga.']);
    await hide(second);
    expect(poruka.current()).toBeNull();
  });
});

describe('Poruka: one at a time, and for how long', () => {
  it('a new message replaces the one on show, and the old one\'s time never takes the new one away', async () => {
    await render();
    await show({ text: 'Prva.' });
    await advance(3000);
    await show({ text: 'Druga.' });
    expect(bars()).toHaveLength(1); expect(texts()).toEqual(['Druga.']);
    // The first would have gone at 4 s; the second has had 2 s of its 4.
    await advance(2000);
    expect(texts()).toEqual(['Druga.']);
    await advance(2000);
    expect(poruka.current()).toBeNull();
    await advance(sys.motion.exit + 40);
    expect(tree.toJSON()).toBeNull();
  });

  it('stays 4 s, or 6 s when it carries an action, and then leaves over 160 ms', async () => {
    expect(PORUKA_MS).toEqual({ plain: 4000, action: 6000 });
    await render();
    await show({ text: 'Nacrt je obrisan.' });
    await advance(PORUKA_MS.plain - 1);
    expect(poruka.current()).not.toBeNull(); expect(bar().props.pointerEvents).toBe('auto');
    await advance(1);
    // Taken away: still drawn while it leaves, and not to be pressed.
    expect(poruka.current()).toBeNull(); expect(bars()).toHaveLength(1); expect(bar().props.pointerEvents).toBe('none');
    await advance(sys.motion.exit + 40);
    expect(bars()).toHaveLength(0);
    await show({ text: 'Blokiranje je sačuvano.', action: { label: 'Vrati', onPress: jest.fn() } });
    await advance(PORUKA_MS.action - 1);
    expect(poruka.current()).not.toBeNull();
    await advance(1);
    expect(poruka.current()).toBeNull();
    // While it leaves, its button does nothing.
    expect(action().props.disabled).toBe(true);
    await advance(sys.motion.exit + 40);
    expect(tree.toJSON()).toBeNull();
  });

  it('a message that arrives while the last one is leaving takes its place, and the leaving does not take it away', async () => {
    await render();
    await show({ text: 'Prva.' });
    await hide();
    await advance(sys.motion.exit / 2);
    await show({ text: 'Druga.' });
    expect(texts()).toEqual(['Druga.']); expect(bar().props.pointerEvents).toBe('auto');
    await advance(sys.motion.exit + 40);
    expect(texts()).toEqual(['Druga.']);
  });
});

describe('Poruka: what a person and a screen reader get', () => {
  it('reads each message out to a screen reader once when it appears, and not again when the screen draws again', async () => {
    // The preset's AccessibilityInfo is already a mock that keeps its calls across tests: start from none.
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    await render();
    await show({ text: 'Nacrt je obrisan.' });
    expect(announce).toHaveBeenCalledTimes(1); expect(announce).toHaveBeenLastCalledWith('Nacrt je obrisan.');
    await act(async () => { tree.update(<PorukaHost clearance={CLEARANCE + 8} />); });
    expect(announce).toHaveBeenCalledTimes(1);
    await show({ text: 'Blokiranje je sačuvano.' });
    expect(announce).toHaveBeenCalledTimes(2); expect(announce).toHaveBeenLastCalledWith('Blokiranje je sačuvano.');
  });

  it('ticks a success only when the caller says the server confirmed it', async () => {
    await render();
    await show({ text: 'Dostupnost je sačuvana.' });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    await show({ text: 'Dostupnost je sačuvana.', confirmed: false });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    await show({ text: 'Dostupnost je sačuvana.', confirmed: true });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
    // A haptic that is not there is silence, never a crash.
    jest.mocked(Haptics.notificationAsync).mockImplementationOnce(() => { throw new Error('no haptics'); });
    await show({ text: 'Opet.', confirmed: true });
    expect(texts()).toEqual(['Opet.']);
  });
});

describe('Poruka: the store and its hosts', () => {
  it('takes a message away by itself after its time even when no host is mounted, so it never turns up minutes later', async () => {
    poruka.show({ text: 'Nacrt je obrisan.' });
    await advance(PORUKA_MS.plain - 1);
    expect(poruka.current()?.text).toBe('Nacrt je obrisan.');
    // A host that mounts now draws what is left of it, not a fresh 4 s.
    await render();
    expect(texts()).toEqual(['Nacrt je obrisan.']);
    await advance(1);
    expect(poruka.current()).toBeNull();
    await advance(sys.motion.exit + 40);
    expect(tree.toJSON()).toBeNull();
    await show({ text: 'Blokiranje je sačuvano.', action: { label: 'Vrati', onPress: jest.fn() } });
    await advance(PORUKA_MS.action - 1);
    expect(poruka.current()).not.toBeNull();
    await advance(1);
    expect(poruka.current()).toBeNull();
  });

  it('is safe to mount more than one host (a screen above the navigator mounts its own): it is read out and ticked once, and each draws it', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    await act(async () => { tree = create(<><PorukaHost clearance={CLEARANCE} /><PorukaHost clearance={0} /></>); });
    await show({ text: 'Dogovor je otkazan.', confirmed: true });
    expect(bars()).toHaveLength(2);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.pointerEvents === 'box-none').map(node => flat(node).bottom))
      .toEqual([CLEARANCE + 16, 16]);
    // One action press hides it for both, and the time is the store's, so it ends once for both.
    await advance(PORUKA_MS.plain);
    expect(poruka.current()).toBeNull();
    await advance(sys.motion.exit + 40);
    expect(tree.toJSON()).toBeNull();
    // A host that mounts while the message is on show does not read it out again: the first one to draw it said it.
    await act(async () => tree.unmount());
    announce.mockClear();
    await show({ text: 'Druga.' });
    await act(async () => { tree = create(<PorukaHost clearance={CLEARANCE} />); });
    expect(announce).toHaveBeenCalledTimes(1);
    await act(async () => { tree.update(<><PorukaHost clearance={CLEARANCE} /><PorukaHost clearance={0} /></>); });
    expect(bars()).toHaveLength(2); expect(announce).toHaveBeenCalledTimes(1);
  });
});

describe('Poruka: motion', () => {
  it('rises 8 dp and fades in over 240 ms and leaves over 160 ms, on the native driver and the decelerating curve', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render();
    await show({ text: 'Nacrt je obrisan.' });
    expect(sys.motion.enter).toBe(240); expect(sys.motion.exit).toBe(160);
    const entering = timings(timing);
    expect(entering).toHaveLength(2);
    expect(entering.map(call => call.toValue).sort()).toEqual([0, 1]);
    for (const call of entering) expect(call).toMatchObject({ duration: 240, useNativeDriver: true, easing: expect.any(Function) });
    // It starts transparent and 8 dp low, so the first frame is not the finished bar.
    const style = flat(asked());
    const valueOf = (value: unknown) => (value as { __getValue(): number }).__getValue();
    expect(valueOf(style.opacity)).toBe(0);
    expect(valueOf((style.transform as unknown as { translateY: unknown }[])[0].translateY)).toBe(8);
    timing.mockClear();
    await hide();
    const leaving = timings(timing);
    expect(leaving.map(call => call.toValue).sort((a, b) => a - b)).toEqual([0, 8]);
    for (const call of leaving) expect(call).toMatchObject({ duration: 160, useNativeDriver: true });
  });

  it('only appears and disappears under reduced motion: no timing, no animated style, gone at once', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render();
    await show({ text: 'Nacrt je obrisan.' });
    expect(timing).not.toHaveBeenCalled();
    expect(flat(bar()).opacity).toBeUndefined(); expect(flat(bar()).transform).toBeUndefined();
    await hide();
    expect(bars()).toHaveLength(0);
    expect(timing).not.toHaveBeenCalled();
  });
});
