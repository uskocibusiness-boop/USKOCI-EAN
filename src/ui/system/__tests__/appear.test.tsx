import { readFileSync } from 'fs';
import { join } from 'path';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Appear, ROWS_THAT_ARRIVE, useAppear } from '../Appear';
import { sys } from '../tokens';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
// The shared Reanimated stand-in, except that the entrance every row asks for is RECORDED (its duration and its delay, the curve
// it was given and the position it starts from), so the stagger and the feel a row gets can be read back. Rows are recorded in
// the order they mount. `Easing.bezier` hands back its own four numbers, so the curve that was asked for can be compared.
type Entrance = { duration: number; delay: number; easing?: unknown; initial?: Record<string, unknown> };
const mockEntrances: Entrance[] = [];
jest.mock('react-native-reanimated', () => {
  const base = jest.requireActual('../../../../__mocks__/react-native-reanimated.js');
  const recording = {
    duration(duration: number) {
      const record: { duration: number; delay: number; easing?: unknown; initial?: Record<string, unknown> } = { duration, delay: 0 };
      mockEntrances.push(record);
      const chain: Record<string, unknown> = {};
      for (const method of ['springify', 'withCallback', 'reduceMotion', 'build']) chain[method] = () => chain;
      chain.delay = (delay: number) => { record.delay = delay; return chain; };
      chain.easing = (easing: unknown) => { record.easing = easing; return chain; };
      chain.withInitialValues = (initial: Record<string, unknown>) => { record.initial = initial; return chain; };
      return chain;
    },
  };
  return { ...base, Easing: { ...base.Easing, bezier: (...points: number[]) => ({ bezier: points }) }, FadeInDown: recording };
});

/**
 * Motion in this app is feedback, never decoration. That is one rule with two halves and both are
 * here: a row that was already on screen when it opened has nothing to announce, and a row that
 * arrives while the person is looking does.
 */
describe('a row arriving in a list', () => {
  let tree: ReactTestRenderer;
  let rows: { key: string; animate: boolean }[] = [];
  afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; rows = []; mockEntrances.length = 0; });

  /** Stands in for a list: it settles what it is about to draw, then asks about each row. */
  function List({ keys, viewKey, afterLoading }: { keys: string[]; viewKey?: string; afterLoading?: boolean }) {
    const appear = useAppear();
    appear.settle(keys, viewKey, afterLoading === undefined ? undefined : { afterLoading });
    rows = keys.map(key => ({ key, animate: appear.isNew(key) }));
    return <>{keys.map((key, index) => <Appear key={key} index={index} animate={rows[index].animate}>
      <View testID={key} />
    </Appear>)}</>;
  }
  const draw = async (keys: string[]) => { await act(async () => { tree = create(<List keys={keys} />); }); };
  const redraw = async (keys: string[]) => { await act(async () => tree.update(<List keys={keys} />)); };
  const animate = () => rows.map(row => row.animate);

  it('is silent for what was already there, and for the same rows read again', async () => {
    await draw(['a', 'b']);
    expect(animate()).toEqual([false, false]);
    await redraw(['a', 'b']);
    expect(animate()).toEqual([false, false]);
  });

  it('animates the row that was not there before, once', async () => {
    await draw(['a', 'b']);
    await redraw(['a', 'b', 'c']);
    expect(animate()).toEqual([false, false, true]);
    // Having arrived, it is part of the list: a later read leaves it alone.
    await redraw(['a', 'b', 'c']);
    expect(animate()).toEqual([false, false, false]);
  });

  it('switching to existing history or a filter is silent, while a later incoming record still enters once', async () => {
    await act(async () => { tree = create(<List keys={['active']} viewKey="active" />); });
    await act(async () => tree.update(<List keys={['past-1', 'past-2']} viewKey="history" />));
    expect(animate()).toEqual([false, false]);
    await act(async () => tree.update(<List keys={['past-1', 'past-2', 'just-completed']} viewKey="history" />));
    expect(animate()).toEqual([false, false, true]);
    await act(async () => tree.update(<List keys={['active']} viewKey="active" />));
    expect(animate()).toEqual([false]);
    await act(async () => tree.update(<List keys={['past-1', 'past-2', 'just-completed']} viewKey="history" />));
    expect(animate()).toEqual([false, false, false]);
  });

  /** Only `Appear` ever sets one, so this counts the rows actually asking to animate. */
  const entrances = () => tree.root.findAll(node => typeof node.type === 'string' && !!node.props.entering).length;
  /** The rows that are drawn on a Reanimated view at all (B22: a settled row must not carry one). */
  const animatedViews = () => tree.root.findAllByType(Animated.View).length;

  it('carries an entrance only for the row the list called new', async () => {
    await draw(['a']);
    expect(entrances()).toBe(0);
    await redraw(['a', 'b']);
    expect(entrances()).toBe(1);
  });

  it('does nothing at all when the system asks for less motion', async () => {
    mockReduced = true;
    await draw(['a']);
    await redraw(['a', 'b']);
    expect(entrances()).toBe(0);
    expect(animatedViews()).toBe(0);
  });

  describe('which rows are drawn on an animated view (B22)', () => {
    it('a row that was already there is a plain View: no Reanimated view for a settled list', async () => {
      await draw(['a', 'b', 'c']);
      expect(animatedViews()).toBe(0);
      await redraw(['a', 'b', 'c']);
      expect(animatedViews()).toBe(0);
    });

    it('only the arriving row carries an animated view', async () => {
      await draw(['a', 'b']);
      await redraw(['a', 'b', 'c']);
      expect(animatedViews()).toBe(1);
    });

    /** Counts how often the row's own content is mounted: an element-type switch above it would remount it. */
    let mounts: Record<string, number> = {};
    function Probe({ id }: { id: string }) { useEffect(() => { mounts[id] = (mounts[id] ?? 0) + 1; }, [id]); return <View testID={`probe-${id}`} />; }
    const one = (animateIt: boolean) => <Appear index={0} animate={animateIt}><Probe id="row" /></Appear>;
    beforeEach(() => { mounts = {}; });

    it('a row that mounted settled never becomes an animated view, even if it is later asked to animate', async () => {
      await act(async () => { tree = create(one(false)); });
      expect(animatedViews()).toBe(0);
      await act(async () => tree.update(one(true)));
      expect(animatedViews()).toBe(0);
      expect(entrances()).toBe(0);
      expect(mounts.row).toBe(1);
    });

    it('a row that mounted arriving keeps its element when the list stops calling it new: nothing remounts', async () => {
      await act(async () => { tree = create(one(true)); });
      expect(animatedViews()).toBe(1);
      expect(entrances()).toBe(1);
      const entering = tree.root.findAll(node => typeof node.type === 'string' && !!node.props.entering)[0].props.entering;
      await act(async () => tree.update(one(false)));
      expect(animatedViews()).toBe(1);
      expect(mounts.row).toBe(1);
      // The entrance given at mount is not rebuilt or dropped on a later render.
      expect(tree.root.findAll(node => typeof node.type === 'string' && !!node.props.entering)[0].props.entering).toBe(entering);
    });

    it('reduced motion read at mount keeps a row plain, and turning it on later does not swap an arriving row', async () => {
      mockReduced = true;
      await act(async () => { tree = create(one(true)); });
      expect(animatedViews()).toBe(0);
      mockReduced = false;
      await act(async () => tree.update(one(true)));
      expect(animatedViews()).toBe(0);
      expect(mounts.row).toBe(1);
    });
  });

  // Wave-1 review, minor (b): rule R4 says at most six rows arrive, and the stagger step stops there. The cap on the DELAY was
  // not pinned: with `Math.min(index, ROWS_THAT_ARRIVE)` turned into `index`, a 40-row page waited 1.6 s for its last row.
  describe('the stagger stops at the sixth row (R4)', () => {
    it('steps by sys.motion.stagger per row, and gives every row past the sixth the delay of the sixth', async () => {
      await draw(['a']);
      const fresh = Array.from({ length: 12 }, (_, at) => `n${at}`);
      await redraw(['a', ...fresh]);
      // The twelve new rows sit at list positions 1 to 12 and mount in that order.
      const delays = mockEntrances.map(entrance => entrance.delay);
      expect(delays).toHaveLength(12);
      expect(delays.slice(0, ROWS_THAT_ARRIVE)).toEqual([1, 2, 3, 4, 5, 6].map(position => position * sys.motion.stagger));
      const last = ROWS_THAT_ARRIVE * sys.motion.stagger;
      expect(delays.slice(ROWS_THAT_ARRIVE)).toEqual(Array(12 - ROWS_THAT_ARRIVE).fill(last));
      expect(Math.max(...delays)).toBe(last);
    });

    it('a row that arrives at position 40 waits no longer than the one at position 6, and every entrance is one enter long', async () => {
      await act(async () => { tree = create(<Appear index={ROWS_THAT_ARRIVE}><View /></Appear>); });
      const sixth = mockEntrances[mockEntrances.length - 1].delay;
      await act(async () => tree.unmount());
      await act(async () => { tree = create(<Appear index={40}><View /></Appear>); });
      const far = mockEntrances[mockEntrances.length - 1];
      expect(far.delay).toBe(sixth);
      expect(far.delay).toBe(ROWS_THAT_ARRIVE * sys.motion.stagger);
      expect(far.duration).toBe(sys.motion.enter);
    });
  });

  // Motion pass, M-01b (spec N1): the entrance every row has. Reanimated's preset, left alone, runs on a quadratic ease-in-out (2 %
  // of the way after the first tenth of the time, so it starts late) and starts 25 dp low (a shove for a whole card). Rule R2
  // wants an entrance to decelerate, and the rise is the outcome bar's own 8 dp.
  describe('the entrance of one row decelerates and rises 8 dp (R2)', () => {
    /** Where the row starts, in dp below its place, whichever of the two equivalent ways Reanimated is told (flat, or a `transform` list). */
    const rise = (entrance: Entrance) => {
      const initial = entrance.initial ?? {};
      return (initial.translateY ?? (initial.transform as { translateY?: number }[] | undefined)?.[0]?.translateY) as number | undefined;
    };

    it('is given easeOut explicitly, the one curve of every entrance', async () => {
      await act(async () => { tree = create(<Appear index={2}><View /></Appear>); });
      expect(mockEntrances).toHaveLength(1);
      expect(mockEntrances[0].easing).toEqual({ bezier: [...sys.motion.easeOut] });
    });

    it('starts 8 dp below its place, the rise of the outcome bar, not the 25 dp of the preset', async () => {
      await act(async () => { tree = create(<Appear><View /></Appear>); });
      expect(rise(mockEntrances[0])).toBe(8);
      expect(sys.space.sm).toBe(8);
    });

    it('gives every row of a list the same curve and the same rise, whatever its position', async () => {
      await draw(['a']);
      await redraw(['a', ...Array.from({ length: 8 }, (_, at) => `n${at}`)]);
      expect(mockEntrances).toHaveLength(8);
      for (const entrance of mockEntrances) {
        expect(entrance.easing).toEqual({ bezier: [...sys.motion.easeOut] });
        expect(rise(entrance)).toBe(8);
        expect(entrance.duration).toBe(sys.motion.enter);
      }
    });

    it('asks for no entrance at all under reduced motion: nothing moves, so there is nothing to shape', async () => {
      mockReduced = true;
      await draw(['a']);
      await redraw(['a', 'b', 'c']);
      expect(mockEntrances).toHaveLength(0);
    });
  });

  it('keeps each doc on its own declaration: the list\'s memory is documented on useAppear, not on the constant above it', () => {
    const source = readFileSync(join(__dirname, '../Appear.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(source).toMatch(/\/\*\*(?:(?!\*\/)[^])*useAppear\(\)`? belongs to the list, not to the row(?:(?!\*\/)[^])*\*\/\nexport function useAppear\(/);
    expect(source).toMatch(/\/\*\*(?:(?!\*\/)[^])*rule R4(?:(?!\*\/)[^])*\*\/\nexport const ROWS_THAT_ARRIVE = 6;/);
  });

  describe('the first list after a skeleton arrives once (afterLoading)', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => `row-${index}`);

    it('without the option the first list is what was already there: a warm return stays still', async () => {
      await act(async () => { tree = create(<List keys={many(3)} viewKey="all" />); });
      expect(animate()).toEqual([false, false, false]);
      expect(animatedViews()).toBe(0);
    });

    it('with the option the rows arrive, once, and the same rows read again are silent', async () => {
      await act(async () => { tree = create(<List keys={many(3)} afterLoading />); });
      expect(animate()).toEqual([true, true, true]);
      expect(animatedViews()).toBe(3);
      await act(async () => tree.update(<List keys={many(3)} afterLoading />));
      expect(animate()).toEqual([false, false, false]);
    });

    it('a view key given on the very first call does not turn the arrival into a baseline', async () => {
      await act(async () => { tree = create(<List keys={many(2)} viewKey="all" afterLoading />); });
      expect(animate()).toEqual([true, true]);
    });

    it('only the first rows arrive, never a whole page of animated views', async () => {
      await act(async () => { tree = create(<List keys={many(ROWS_THAT_ARRIVE + 10)} afterLoading />); });
      expect(animate().filter(Boolean)).toHaveLength(ROWS_THAT_ARRIVE);
      expect(animate().slice(0, ROWS_THAT_ARRIVE).every(Boolean)).toBe(true);
      expect(animatedViews()).toBe(ROWS_THAT_ARRIVE);
    });

    it('still skeleton (no rows yet) then the first rows: they arrive; a filter change afterwards stays still', async () => {
      await act(async () => { tree = create(<List keys={[]} viewKey="all" afterLoading />); });
      await act(async () => tree.update(<List keys={many(2)} viewKey="all" afterLoading />));
      expect(animate()).toEqual([true, true]);
      await act(async () => tree.update(<List keys={['other-1', 'other-2']} viewKey="filtered" afterLoading />));
      expect(animate()).toEqual([false, false]);
    });

    it('is an arrival once: a later list that had no rows is not a second skeleton', async () => {
      await act(async () => { tree = create(<List keys={many(2)} afterLoading />); });
      await act(async () => tree.update(<List keys={[]} afterLoading />));
      await act(async () => tree.update(<List keys={many(2)} afterLoading />));
      expect(animate()).toEqual([false, false]);
    });

    it('makes no motion at all under reduced motion', async () => {
      mockReduced = true;
      await act(async () => { tree = create(<List keys={many(3)} afterLoading />); });
      expect(animatedViews()).toBe(0);
      expect(entrances()).toBe(0);
    });
  });
});
