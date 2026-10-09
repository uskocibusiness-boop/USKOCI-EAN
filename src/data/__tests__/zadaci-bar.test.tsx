import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ZadaciBarContext, useZadaciBar, useZadaciBarMotion, zadaciBarStyle, zadaciBarRevealTop, type ZadaciBar } from '../../ui/v2/discovery/zadaciBar';
import { sys } from '../../ui/system/tokens';

/**
 * The bottom navigation on Zadaci (the owner's phone of 8 Oct 2026: "dok je lista dole, donja navigacija se ne vidi; pojavi se kad se lista digne na pola ili skroz").
 * The layout owns the bar and the one value that moves it (0: on show, 1: away); the screen drives that value from its list. What is pinned here is the arithmetic of the
 * bar's style and the rules of the motion: the first answer puts the bar in place at once, later ones slide it on the native driver, a reduced-motion person sees it simply there
 * or gone, and a screen that is not in front or has no layout around it moves nothing.
 */
const base = { backgroundColor: '#fff', borderRadius: 0, height: 56, marginBottom: 24, marginHorizontal: 0, marginTop: 0 };
const makeBar = (hidden = 0.5): ZadaciBar => ({ hidden: new Animated.Value(hidden), height: 80 });
const valueOf = (bar: ZadaciBar) => (bar.hidden as unknown as { __getValue: () => number }).__getValue();

type Run = { value: Animated.Value; config: Record<string, unknown>; start: jest.Mock; stop: jest.Mock };
let runs: Run[] = [];
let tree: ReactTestRenderer;
let motion: ReturnType<typeof useZadaciBarMotion>;
function Probe({ bar, shown, active = true, reduced = false }: { bar: ZadaciBar | null; shown: boolean; active?: boolean; reduced?: boolean }) {
  motion = useZadaciBarMotion({ bar, shown, active, reduced });
  return null;
}
const render = async (props: React.ComponentProps<typeof Probe>) => act(async () => { tree = create(<Probe {...props} />); });
const update = async (props: React.ComponentProps<typeof Probe>) => act(async () => tree.update(<Probe {...props} />));
beforeEach(() => {
  runs = [];
  jest.spyOn(Animated, 'timing').mockImplementation(((value: Animated.Value, config: Record<string, unknown>) => {
    const run: Run = { value, config, start: jest.fn(), stop: jest.fn() }; runs.push(run); return run;
  }) as never);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

describe('the bar\'s style on Zadaci', () => {
  it('keeps the bar as it is and lays it over the bottom of the screen: its margin becomes the white padding inside it, and a translation is all that moves it', () => {
    const bar = makeBar(0);
    const style = StyleSheet.flatten(zadaciBarStyle(base, bar)) as Record<string, any>;
    expect(style).toMatchObject({ backgroundColor: '#fff', borderRadius: 0, marginHorizontal: 0, marginTop: 0 });
    expect(style).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0, marginBottom: 0, height: 56 + 24, paddingBottom: 24 });
    expect(Object.keys(style).filter(key => /^(top|width|flex)/.test(key))).toEqual([]);
    // Discovery moves an outer host; the inner bar retains only static geometry and its own keyboard transform.
    expect(style.transform).toBeUndefined();

  });

  it('does not change what it was given', () => {
    const copy = { ...base };
    zadaciBarStyle(base, makeBar());
    expect(base).toEqual(copy);
  });
});

describe('the context', () => {
  it('is nothing without a layout around the screen (a gallery, a test), and the layout\'s value with one', async () => {
    let seen: ZadaciBar | null | undefined;
    const Reader = () => { seen = useZadaciBar(); return null; };
    await act(async () => { tree = create(<Reader />); });
    expect(seen).toBeNull();
    const bar = makeBar();
    await act(async () => tree.update(<ZadaciBarContext.Provider value={bar}><Reader /></ZadaciBarContext.Provider>));
    expect(seen).toBe(bar);
  });
});

describe('the motion', () => {
  it('puts the bar in place at once on the first answer of a visit: away or on show, with nothing slid', async () => {
    const bar = makeBar(0.5);
    await render({ bar, shown: false });
    expect(valueOf(bar)).toBe(1); expect(runs).toHaveLength(0);
    await act(async () => tree.unmount());
    const other = makeBar(0.5);
    await render({ bar: other, shown: true });
    expect(valueOf(other)).toBe(0); expect(runs).toHaveLength(0);
  });

  it('slides a later answer: in over the enter token, out over the exit token, decelerating, on the native driver', async () => {
    const bar = makeBar();
    await render({ bar, shown: false });
    await update({ bar, shown: true });
    expect(runs).toHaveLength(1);
    expect(runs[0].value).toBe(bar.hidden);
    expect(runs[0].config).toMatchObject({ toValue: 0, duration: sys.motion.enter, useNativeDriver: true });
    expect(typeof runs[0].config.easing).toBe('function');
    expect(runs[0].start).toHaveBeenCalledTimes(1);
    await update({ bar, shown: false });
    expect(runs).toHaveLength(2);
    expect(runs[0].stop).toHaveBeenCalledTimes(1); // the slide that was running is stopped, never left to fight the new one
    expect(runs[1].config).toMatchObject({ toValue: 1, duration: sys.motion.exit, useNativeDriver: true });
    // an answer that is the one already given is not a new slide
    await update({ bar, shown: false });
    expect(runs).toHaveLength(2);
  });

  it('is simply there and simply gone under reduced motion', async () => {
    const bar = makeBar();
    await render({ bar, shown: false, reduced: true });
    await update({ bar, shown: true, reduced: true });
    expect(valueOf(bar)).toBe(0);
    await update({ bar, shown: false, reduced: true });
    expect(valueOf(bar)).toBe(1);
    act(() => motion.announce(true));
    expect(valueOf(bar)).toBe(0);
    expect(runs).toHaveLength(0);
  });

  it('takes the answer one step earlier when the sheet says where it is going, and does it once', async () => {
    const bar = makeBar();
    await render({ bar, shown: false });
    act(() => motion.announce(true));
    expect(runs).toHaveLength(1); expect(runs[0].config).toMatchObject({ toValue: 0, duration: sys.motion.enter });
    // the same answer again changes nothing, and the render that follows (the index has arrived) does not slide it a second time
    act(() => motion.announce(true));
    expect(runs).toHaveLength(1);
    await update({ bar, shown: true });
    expect(runs).toHaveLength(1);
    act(() => motion.announce(false));
    expect(runs).toHaveLength(2); expect(runs[1].config).toMatchObject({ toValue: 1, duration: sys.motion.exit });
  });

  it('never answers before the first answer of the visit, or for a screen that is not in front', async () => {
    const bar = makeBar();
    await render({ bar, shown: true, active: false });
    act(() => motion.announce(false));
    expect(runs).toHaveLength(0); expect(valueOf(bar)).toBe(0.5); // another tab is in front and has the bar as it always had it
    await update({ bar, shown: true, active: true });
    expect(valueOf(bar)).toBe(0); expect(runs).toHaveLength(0); // coming back puts it in place at once
    await update({ bar, shown: true, active: false });
    await update({ bar, shown: false, active: false });
    expect(runs).toHaveLength(0); expect(valueOf(bar)).toBe(0);
    await update({ bar, shown: false, active: true });
    expect(valueOf(bar)).toBe(1); expect(runs).toHaveLength(0);
  });

  it('does nothing without a bar', async () => {
    await render({ bar: null, shown: false });
    act(() => motion.announce(true));
    await update({ bar: null, shown: true });
    expect(runs).toHaveLength(0);
  });

  it('stops the slide that is running when the screen goes', async () => {
    const bar = makeBar();
    await render({ bar, shown: false });
    await update({ bar, shown: true });
    expect(runs[0].stop).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
  });
});

// The native observer uses this threshold, so a cramped HALF must not reveal the bar over PEEK.
it.each([[800, 68, 436], [800, 700, 701]])('reveals navigation at HALF but never PEEK (%i,%i,%i)', (body, peek, half) => {
  const threshold = zadaciBarRevealTop(body, peek, half);
  expect(body - peek <= threshold).toBe(false);
  expect(body - half <= threshold).toBe(true);
});


it('publishes settled native visibility and rejects cancelled animation completion after reversal or blur', async () => {
  const bar = { ...makeBar(), setVisible: jest.fn() };
  await render({ bar, shown: false }); expect(bar.setVisible).toHaveBeenLastCalledWith(false);
  await update({ bar, shown: true }); expect(bar.setVisible).toHaveBeenLastCalledWith(true);
  await update({ bar, shown: false }); const exit = runs.at(-1)!;
  await update({ bar, shown: true });
  act(() => exit.start.mock.calls[0][0]({ finished: true })); expect(bar.setVisible).toHaveBeenLastCalledWith(true);
  await update({ bar, shown: false }); const currentExit = runs.at(-1)!;
  act(() => currentExit.start.mock.calls[0][0]({ finished: true })); expect(bar.setVisible).toHaveBeenLastCalledWith(false);
  await update({ bar, shown: true }); const entering = runs.at(-1)!;
  await update({ bar, shown: true, active: false }); bar.setVisible.mockClear();
  act(() => entering.start.mock.calls[0][0]({ finished: true })); expect(bar.setVisible).not.toHaveBeenCalled();
});
