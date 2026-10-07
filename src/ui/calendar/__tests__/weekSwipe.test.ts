import { SWIPE_DISTANCE, SWIPE_FLICK_DISTANCE, SWIPE_FLICK_SPEED, SWIPE_START, startsSwipe, swipeStep } from '../weekSwipe';

// Swipe to change the week: a finger moving LEFT turns to the NEXT week, one moving RIGHT to the previous. Only a clearly sideways
// move counts, so scrolling the day is never taken over and a tap on a day is never a swipe.
describe('swipeStep', () => {
  it('turns to the next week on a long move to the left and to the previous on a long move to the right', () => {
    expect(swipeStep(-SWIPE_DISTANCE, 0, 0)).toBe(1);
    expect(swipeStep(SWIPE_DISTANCE, 0, 0)).toBe(-1);
    expect(swipeStep(-200, 30, -0.1)).toBe(1);
    expect(swipeStep(200, -30, 0.1)).toBe(-1);
  });
  it('does not turn for a slow move that stops short', () => {
    expect(swipeStep(-(SWIPE_DISTANCE - 1), 0, -0.1)).toBe(0);
    expect(swipeStep(SWIPE_DISTANCE - 1, 0, 0.1)).toBe(0);
    expect(swipeStep(0, 0, 0)).toBe(0);
  });
  it('turns for a short, quick flick', () => {
    expect(swipeStep(-SWIPE_FLICK_DISTANCE, 0, -SWIPE_FLICK_SPEED)).toBe(1);
    expect(swipeStep(SWIPE_FLICK_DISTANCE, 0, SWIPE_FLICK_SPEED)).toBe(-1);
    // Quick but too short, or long enough but too slow.
    expect(swipeStep(-(SWIPE_FLICK_DISTANCE - 1), 0, -2)).toBe(0);
    expect(swipeStep(-SWIPE_FLICK_DISTANCE, 0, -(SWIPE_FLICK_SPEED - 0.01))).toBe(0);
  });
  it('needs the move to be at least twice as far across as down, however far it goes', () => {
    expect(swipeStep(-120, 60, -1)).toBe(0);
    expect(swipeStep(-120, 59, -1)).toBe(1);
    expect(swipeStep(-100, 100, -1)).toBe(0);
    expect(swipeStep(0, -200, 0)).toBe(0);
  });
});

describe('startsSwipe', () => {
  it('takes the touch once the move is clearly sideways, either way', () => {
    expect(startsSwipe(SWIPE_START + 1, 0)).toBe(true);
    expect(startsSwipe(-(SWIPE_START + 1), 3)).toBe(true);
  });
  it('leaves the touch to the scroll while the move is short, mostly down, or a tap', () => {
    expect(startsSwipe(SWIPE_START, 0)).toBe(false);
    expect(startsSwipe(30, 15)).toBe(false);
    expect(startsSwipe(3, 80)).toBe(false);
    expect(startsSwipe(0, 0)).toBe(false);
  });
});
