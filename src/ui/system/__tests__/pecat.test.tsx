import React from 'react';
import { Animated, Easing } from 'react-native';
import { Circle, Path } from 'react-native-svg';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PECAT_FALL_MS, Pecat } from '../Pecat';
import { STATUS_TONES } from '../StatusChip';
import { sys } from '../tokens';

/**
 * The stamp (owner's pick of 8 Oct 2026, "Pilula pada"): the chip of a state, tilted, that falls once onto what the person laid down.
 * The cases pin what the two screens that use it rely on: the pill is the chip's own (ground, mark, word), it falls in 140 ms on
 * `easeOut` and ticks once as it lands, it is simply there under reduced motion (the tick stays) and still when nothing just happened.
 */
let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
const mockTick = jest.fn();
jest.mock('../haptics', () => ({ tick: (...args: unknown[]) => mockTick(...args) }));
jest.mock('../../Text', () => ({ T: 'T' }));

let tree: ReactTestRenderer | undefined;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => { tree?.unmount(); tree = undefined; }); mockReduced = false; mockTick.mockClear(); jest.restoreAllMocks(); });

type TimingConfig = { toValue: number; duration: number; delay?: number; easing: (t: number) => number; useNativeDriver: boolean };
/** A timing that runs when the test says: `land()` plays the end of the fall, as the native driver reports it. */
function holdTiming() {
  const finish: ((result: { finished: boolean }) => void)[] = [];
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
    start: (callback?: (result: { finished: boolean }) => void) => { if (callback) finish.push(callback); },
    stop: jest.fn(), reset: jest.fn(),
  }) as unknown as Animated.CompositeAnimation);
  return { timing, land: (finished = true) => finish.forEach(callback => callback({ finished })), config: () => timing.mock.calls[0][1] as unknown as TimingConfig };
}
const pill = () => tree!.root.findByProps({ testID: 'pecat' });
const mark = () => tree!.root.findByProps({ testID: 'status-mark' });

describe('the stamp is the chip of its state', () => {
  it('is spoken as its word, once, and draws that word in the label type', async () => {
    await render(<Pecat label="Ocenjeno" tone="green" />);
    expect(pill().props).toMatchObject({ accessible: true, accessibilityRole: 'text', accessibilityLabel: 'Ocenjeno' });
    const word = tree!.root.findAllByType('T' as unknown as React.ElementType);
    expect(word).toHaveLength(1);
    expect(word[0].props).toMatchObject({ variant: 'label', children: 'Ocenjeno', accessible: false });
  });

  it('takes the ground and the word of the chip\'s tone, and the neutral one by default', async () => {
    await render(<Pecat label="Objavljen" tone="green" />);
    const green = JSON.stringify(pill().props.style);
    expect(green).toContain(STATUS_TONES.green.ground);
    await act(async () => tree!.update(<Pecat label="Poslata" />));
    expect(JSON.stringify(pill().props.style)).toContain(STATUS_TONES.neutral.ground);
  });

  it('is tilted by -4 degrees, like a stamp on a receipt', async () => {
    await render(<Pecat label="Ocenjeno" tone="green" />);
    expect(JSON.stringify(pill().props.style)).toContain('"rotate":"-4deg"');
  });

  it('draws a dot for green and a ring for neutral, as the state table does, and the shape it is asked for', async () => {
    await render(<Pecat label="Objavljen" tone="green" />);
    expect(mark().findAllByType(Circle).map(node => node.props.fill)).toEqual([STATUS_TONES.green.mark]);
    await act(async () => tree!.update(<Pecat label="Poslata" tone="neutral" />));
    expect(mark().findAllByType(Circle).map(node => node.props.fill)).toEqual(['none']);
    await act(async () => tree!.update(<Pecat label="Ocenjeno" tone="green" shape="check" />));
    expect(mark().findAllByType(Circle)).toHaveLength(0);
    expect(mark().findAllByType(Path)).toHaveLength(1);
  });
});

describe('the fall', () => {
  it('is 140 ms, shorter than a switch, on the native driver and on easeOut', async () => {
    expect(PECAT_FALL_MS).toBe(140);
    expect(PECAT_FALL_MS).toBeLessThan(sys.motion.toggle);
    const held = holdTiming();
    await render(<Pecat label="Ocenjeno" tone="green" play />);
    expect(held.timing).toHaveBeenCalledTimes(1);
    expect(held.config()).toMatchObject({ toValue: 1, duration: 140, delay: 0, useNativeDriver: true });
    const curve = Easing.bezier(...sys.motion.easeOut);
    for (const t of [0, 0.1, 0.4, 0.8, 1]) expect(held.config().easing(t)).toBeCloseTo(curve(t), 6);
  });

  it('starts after the delay it was given', async () => {
    const held = holdTiming();
    await render(<Pecat label="Ocenjeno" tone="green" play delay={420} />);
    expect(held.config().delay).toBe(420);
  });

  it('ticks lightly once when it lands, and not before, and not when the fall was stopped', async () => {
    const held = holdTiming();
    await render(<Pecat label="Ocenjeno" tone="green" play />);
    expect(mockTick).not.toHaveBeenCalled();
    held.land(false);
    expect(mockTick).not.toHaveBeenCalled();
    held.land(true);
    expect(mockTick.mock.calls).toEqual([['light']]);
  });

  it('makes the tick it is asked for as it lands: success where the stamp is the outcome the server confirmed, also under reduced motion', async () => {
    const held = holdTiming();
    await render(<Pecat label="Ocenjeno" tone="green" tickKind="success" play />);
    held.land();
    expect(mockTick.mock.calls).toEqual([['success']]);
    mockTick.mockClear(); mockReduced = true;
    await act(async () => { tree!.unmount(); });
    await render(<Pecat label="Ocenjeno" tone="green" tickKind="success" play />);
    expect(mockTick.mock.calls).toEqual([['success']]);
  });

  it('is simply there under reduced motion, and the tick stays (a tick is not movement)', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<Pecat label="Ocenjeno" tone="green" play />);
    expect(timing).not.toHaveBeenCalled();
    expect(mockTick.mock.calls).toEqual([['light']]);
  });

  it('is still when nothing just happened: no fall and no tick', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<Pecat label="Ocenjeno" tone="green" />);
    expect(timing).not.toHaveBeenCalled();
    expect(mockTick).not.toHaveBeenCalled();
  });

  it('falls only on opacity and transform: the values it drives are one progress, never a size or a position', async () => {
    const held = holdTiming();
    await render(<Pecat label="Ocenjeno" tone="green" play />);
    expect(held.timing).toHaveBeenCalledTimes(1);
    const style = JSON.stringify(pill().props.style);
    expect(style).toContain('opacity');
    expect(style).toContain('transform');
    for (const key of ['width', 'height', 'top', 'left', 'marginTop', 'translateX']) expect(style).not.toContain(`"${key}"`);
  });
});
