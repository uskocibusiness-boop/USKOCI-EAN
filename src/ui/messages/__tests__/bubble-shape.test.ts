import type { ViewStyle } from 'react-native';
import { BUBBLE_JOINT, bubbleGap, bubbleShape } from '../bubbleShape';
import { sys } from '../../system/tokens';

/**
 * One bubble shape for text, photo and voice (proposal R). The big corner is the card corner; the corner on the sender's side
 * that joins a neighbour, and the tail at the bottom of a run, are the 8 step.
 */
const big = sys.radius.card;
const corners = (style: ViewStyle) => ({ tl: style.borderTopLeftRadius, tr: style.borderTopRightRadius,
  bl: style.borderBottomLeftRadius, br: style.borderBottomRightRadius });

describe('corners', () => {
  it('a lone bubble has only its tail corner small, on the sender\'s side', () => {
    expect(corners(bubbleShape({ mine: true, first: true, last: true }))).toEqual({ tl: big, tr: big, bl: big, br: BUBBLE_JOINT });
    expect(corners(bubbleShape({ mine: false, first: true, last: true }))).toEqual({ tl: big, tr: big, bl: BUBBLE_JOINT, br: big });
  });

  it('the first of a run is all big, the middle joins above only, the last joins above and carries the tail', () => {
    expect(corners(bubbleShape({ mine: true, first: true, last: false }))).toEqual({ tl: big, tr: big, bl: big, br: big });
    expect(corners(bubbleShape({ mine: true, first: false, last: false }))).toEqual({ tl: big, tr: BUBBLE_JOINT, bl: big, br: big });
    expect(corners(bubbleShape({ mine: true, first: false, last: true }))).toEqual({ tl: big, tr: BUBBLE_JOINT, bl: big, br: BUBBLE_JOINT });
    expect(corners(bubbleShape({ mine: false, first: false, last: true }))).toEqual({ tl: BUBBLE_JOINT, tr: big, bl: BUBBLE_JOINT, br: big });
  });

  it('the small corner is the 8 step and the big one the card corner, both from the token scale', () => {
    expect(BUBBLE_JOINT).toBe(sys.space.sm);
    expect(big).toBe(24);
  });
});

describe('surfaces', () => {
  it('mine is charcoal on the right; theirs white with the card edge on the left', () => {
    expect(bubbleShape({ mine: true, first: true, last: true })).toMatchObject({ alignSelf: 'flex-end', backgroundColor: sys.conversation.user });
    expect(bubbleShape({ mine: false, first: true, last: true })).toMatchObject({ alignSelf: 'flex-start', backgroundColor: sys.conversation.surface,
      borderWidth: 1, borderColor: sys.conversation.edge });
  });

  it('a failed send of mine goes to the danger wash, in the same shape, with no border added', () => {
    const failed = bubbleShape({ mine: true, first: true, last: true, failed: true });
    expect(failed.backgroundColor).toBe(sys.color.dangerSoft);
    expect(failed.borderWidth).toBeUndefined();
  });
});

describe('air', () => {
  it('a new run leaves room, a bubble of the same run sits close, and the one under a separator needs little', () => {
    expect(bubbleGap(true, false)).toBe(sys.space.md);
    expect(bubbleGap(false, false)).toBe(3);
    expect(bubbleGap(true, true)).toBe(sys.space.xs);
  });
});
