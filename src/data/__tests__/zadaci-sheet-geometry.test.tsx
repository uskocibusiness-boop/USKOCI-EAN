import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../ui/system/tokens';
import { SHEET_SPRING } from '../../ui/product/ProductSheet';
import { CONTROL_GAP, CONTROL_SIZE, ZOOM_WIDTH, controlsRowWidth, controlsTop, fullSheetTop, sheetEdge } from '../../ui/v2/discovery/mapClearBand';
import { SHEET_FULL, SHEET_HALF, SHEET_LOWERED, handleHint, listViewport, nextSheetIndex, snapHeights } from '../../ui/v2/discovery/sheetSnaps';

// The Zadaci list sheet's heights, the handle's cycle and the row of map controls that rides the sheet, as arithmetic on measured
// pixels. The sheet itself (a drag, the spring on a phone) is checked on the device; what is pinned here is where it stops and
// what stands above it.

const mockSpring = jest.fn(), mockTiming = jest.fn();
jest.mock('react-native-reanimated', () => {
  const React = require('react'), shared = jest.requireActual('../../../__mocks__/react-native-reanimated');
  return { ...shared,
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useAnimatedStyle: (updater: () => object) => updater(),
    withSpring: (...args: unknown[]) => { mockSpring(...args); return { spring: args[0] }; },
    withTiming: (...args: unknown[]) => { mockTiming(...args); return { timing: args[0] }; },
  };
});
import { useCoverValue, useRidingStyle } from '../../ui/v2/discovery/mapControls';

describe('the handle goes to the next height and comes round', () => {
  it('cycles lowered, half, full, lowered', () => {
    expect([SHEET_LOWERED, SHEET_HALF, SHEET_FULL]).toEqual([0, 1, 2]);
    expect(nextSheetIndex(0)).toBe(1);
    expect(nextSheetIndex(1)).toBe(2);
    expect(nextSheetIndex(2)).toBe(0);
    // three taps are one full turn, from any stop
    for (const start of [0, 1, 2] as const) expect(nextSheetIndex(nextSheetIndex(nextSheetIndex(start)))).toBe(start);
  });

  it('starts at half for a stop that is not one of the three (the sheet has not reported yet)', () => {
    for (const odd of [-1, 3, Number.NaN, 1.5]) expect(nextSheetIndex(odd)).toBe(1);
  });

  it('tells a screen reader what a tap does from each stop, in Serbian', () => {
    expect(handleHint(0)).toBe('Podiže listu do pola.');
    expect(handleHint(1)).toBe('Otvara celu listu.');
    expect(handleHint(2)).toBe('Spušta listu i prikazuje mapu.');
  });
});

describe('the three heights', () => {
  const body = { bodyHeight: 800, fullTop: 140, collapsed: 68, hidden: 1, cardShown: false, margin: 12 };

  it('are the top line, half the body, and the whole body under the strip', () => {
    expect(snapHeights(body)).toEqual([68, 400, 660]);
  });

  it('keep the full height below the strip: the map stays visible above the list', () => {
    const [, , full] = snapHeights(body);
    expect(800 - Number(full)).toBe(body.fullTop);
    // a taller strip (larger text, a wrapped credit line) shortens the full list and nothing else
    expect(snapHeights({ ...body, fullTop: 180 })).toEqual([68, 400, 620]);
  });

  it('never let half reach full or sink under the top line', () => {
    expect(snapHeights({ ...body, bodyHeight: 300, fullTop: 140 })).toEqual([68, 148, 160]);
    const [low, half, full] = snapHeights({ ...body, bodyHeight: 500, fullTop: 140, collapsed: 68 });
    expect(Number(low)).toBeLessThan(Number(half)); expect(Number(half)).toBeLessThan(Number(full));
  });

  it('sink the lowest stop to a sliver behind a pin card, and give the top line back when the card goes', () => {
    expect(snapHeights({ ...body, cardShown: true })[0]).toBe(1);
    expect(snapHeights({ ...body, cardShown: true }).slice(1)).toEqual(snapHeights(body).slice(1));
  });

  it('are percentages until the body is measured', () => {
    expect(snapHeights({ ...body, bodyHeight: 0 })).toEqual([68, '50%', '88%']);
  });

  it('give the list its own viewport: the full sheet less what stays pinned above the rows', () => {
    expect(listViewport(660, 68, 58)).toBe(534);
    expect(listViewport(660, 0, 58)).toBe(602); // a tall header scrolls with the rows, the chips stay pinned
    expect(listViewport(40, 68, 58)).toBe(0);
  });
});

describe('the strip of map above the full list', () => {
  it('stands between the search pill and the list, one row high, when there is a map or "U blizini"', () => {
    expect(fullSheetTop(68, 12, 48, true)).toBe(68 + 12 + 48 + 12);
  });

  it('is only the gap under the pill when there is neither', () => {
    expect(fullSheetTop(68, 12, 48, false)).toBe(80);
  });

  it('grows with the row: a credit line that wraps makes the strip taller, never the controls overlap it', () => {
    expect(fullSheetTop(68, 12, 64, true) - fullSheetTop(68, 12, 48, true)).toBe(16);
  });
});

describe('the row of map controls rides the sheet', () => {
  const row = 48, gap = 12, minTop = 80; // the strip's top at the full stop

  it('stands directly above the sheet, one gap up', () => {
    expect(controlsTop(sheetEdge(660, 800, 0), row, gap, minTop)).toBe(660 - gap - row);
    expect(controlsTop(sheetEdge(400, 800, 0), row, gap, minTop)).toBe(400 - gap - row);
  });

  it('moves one pixel for one pixel of the sheet (it is the sheet, not a spring of its own)', () => {
    const at = (sheetTop: number) => controlsTop(sheetEdge(sheetTop, 800, 0), row, gap, minTop);
    expect(at(500) - at(510)).toBe(-10);
    expect(at(300) - at(290)).toBe(10);
  });

  it('ends in the strip when the sheet is full: never behind the list, never above the strip', () => {
    const fullTop = fullSheetTop(68, gap, row, true); // 140
    expect(controlsTop(sheetEdge(fullTop, 800, 0), row, gap, minTop)).toBe(minTop);
    expect(minTop).toBe(68 + gap);
    // a sheet dragged a little past its last stop (it cannot stretch, but a frame can arrive early) holds the row at the strip
    expect(controlsTop(sheetEdge(fullTop - 30, 800, 0), row, gap, minTop)).toBe(minTop);
    // the row's bottom stays above the list's top edge all the way
    for (const top of [fullTop, 200, 400, 700]) {
      const rowTop = controlsTop(sheetEdge(top, 800, 0), row, gap, minTop);
      expect(rowTop + row).toBeLessThanOrEqual(top - gap + 0.0001);
    }
  });

  it('stands above a pin card when the card lies higher than the sheet', () => {
    // the list is sunk to a sliver, a 300 high card covers the bottom of the map
    expect(sheetEdge(799, 800, 300)).toBe(500);
    expect(controlsTop(sheetEdge(799, 800, 300), row, gap, minTop)).toBe(500 - gap - row);
    // a card that is lower than the sheet's top changes nothing
    expect(sheetEdge(400, 800, 100)).toBe(400);
    // no card (and a negative cover is no cover at all)
    expect(sheetEdge(400, 800, -20)).toBe(400);
  });

  it('is as wide as its controls: the zoom capsule, then "U blizini"', () => {
    expect([CONTROL_SIZE, CONTROL_GAP, ZOOM_WIDTH]).toEqual([44, 8, 89]);
    expect(controlsRowWidth(true, false)).toBe(89);
    expect(controlsRowWidth(false, true)).toBe(44);
    expect(controlsRowWidth(true, true)).toBe(89 + 8 + 44);
    expect(controlsRowWidth(false, false)).toBe(0);
  });
});

describe('nothing overshoots', () => {
  it('the sheet settles on the one clamped spring', () => {
    expect(SHEET_SPRING).toEqual(sys.motion.sheetSpring);
    expect(sys.motion.sheetSpring.overshootClamping).toBe(true);
  });

  let tree: ReactTestRenderer | undefined;
  let cover: { value: unknown } | undefined;
  let style: { transform: { translateY: number }[] } | undefined;
  function Probe({ card, reduced }: { card: number; reduced: boolean }) {
    const value = useCoverValue(card, reduced);
    cover = value;
    style = useRidingStyle({ sheetTop: { value: 600 } as never, cover: value as never, height: 800, rowHeight: 48, gap: 12, minTop: 80 }) as never;
    return null;
  }
  const render = async (card: number, reduced = false) => act(async () => {
    if (tree) tree.update(<Probe card={card} reduced={reduced} />); else tree = create(<Probe card={card} reduced={reduced} />);
  });
  beforeEach(() => { mockSpring.mockClear(); mockTiming.mockClear(); cover = undefined; style = undefined; });
  afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });

  it('a card coming up moves the controls on the sheet spring, which is clamped', async () => {
    await render(0);
    expect(cover!.value).toBe(0);
    await render(300);
    expect(mockSpring).toHaveBeenCalledTimes(1);
    expect(mockSpring.mock.calls[0][0]).toBe(300);
    expect(mockSpring.mock.calls[0][1]).toEqual(sys.motion.sheetSpring);
    expect(mockSpring.mock.calls[0][1].overshootClamping).toBe(true);
    expect(mockTiming).not.toHaveBeenCalled();
  });

  it('a card going moves them on the short closing timing, quicker than the opening', async () => {
    await render(300); mockSpring.mockClear();
    await act(async () => { (cover as { value: unknown }).value = 300; });
    await render(0);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    expect(mockTiming.mock.calls[0][0]).toBe(0);
    expect(mockTiming.mock.calls[0][1].duration).toBe(sys.motion.sheetClose);
    expect(mockTiming.mock.calls[0][1].duration).toBeLessThan(sys.motion.camera);
    expect(mockSpring).not.toHaveBeenCalled();
  });

  it('under reduced motion the controls are simply there', async () => {
    await render(0, true);
    await render(300, true);
    expect(mockSpring).not.toHaveBeenCalled(); expect(mockTiming).not.toHaveBeenCalled();
    expect(cover!.value).toBe(300);
  });

  it('the row is placed from the sheet and the cover on the UI thread', async () => {
    await render(0);
    expect(style!.transform[0].translateY).toBe(600 - 12 - 48);
    await act(async () => { (cover as { value: unknown }).value = 400; });
    await render(400, true);
    expect(style!.transform[0].translateY).toBe(400 - 12 - 48);
  });

  it('spells no motion number of its own: the spring and the timing are the system\'s', () => {
    // the one-token-source ratchet counts literals; this keeps the two files that move the controls off it
    const fs = require('fs'), path = require('path');
    for (const file of ['src/ui/v2/discovery/mapControls.ts', 'src/ui/v2/discovery/sheetSnaps.ts', 'src/ui/v2/discovery/DiscoveryListSheet.tsx']) {
      const source = fs.readFileSync(path.join(__dirname, '../../..', file), 'utf8');
      expect(source).not.toMatch(/\b(?:damping|dampingRatio|stiffness):\s*\d/);
      expect(source).not.toMatch(/\bduration:\s*[1-9]/);
    }
  });
});

describe('the list sheet never stretches', () => {
  // The sheet stops where its stops are: Gorhom's over-drag would pull it past the first and last stop and let it bounce back.
  it('turns the over-drag off and settles on the system spring (or at once under reduced motion)', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '../../ui/v2/discovery/DiscoveryListSheet.tsx'), 'utf8');
    expect(source).toMatch(/enableOverDrag=\{false\}/);
    expect(source).toMatch(/animationConfigs=\{reduced \? \{ duration: 0 \} : SHEET_SPRING\}/);
  });
});
