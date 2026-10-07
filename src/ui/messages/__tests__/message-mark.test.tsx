import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../system/tokens';
import { MARK_PATHS, MARK_SEEN_ON_DARK, MARK_WIDTH, MARK_HEIGHT, MessageMark } from '../MessageMark';
import { MARK_WORDS, type MarkKind } from '../threadModel';

/**
 * The ONE small mark by my message (proposal R1): one check when the server holds it, two checks only when the read says it was
 * seen, a quiet dot while it goes, nothing at all for a failed send. No clock, no text; the state is its spoken name.
 */
let tree: ReactTestRenderer | undefined;
const draw = async (kind: MarkKind, live = false) => { await act(async () => { tree = create(<MessageMark kind={kind} live={live} />); }); return tree!; };
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });
const strokes = (t: ReactTestRenderer) => t.root.findAllByType(Path);
const dots = (t: ReactTestRenderer) => t.root.findAllByType(Circle);

describe('the shape tells the state, not the colour alone', () => {
  it('sent is one check', async () => {
    const t = await draw('sent');
    expect(strokes(t).map(path => path.props.d)).toEqual([MARK_PATHS.second]);
    expect(dots(t)).toHaveLength(0);
  });

  it('seen is two checks, in mint, drawn from the same stroke as the one check', async () => {
    const t = await draw('seen');
    expect(strokes(t).map(path => path.props.d)).toEqual([MARK_PATHS.first, MARK_PATHS.second]);
    for (const path of strokes(t)) expect(path.props).toMatchObject({ stroke: MARK_SEEN_ON_DARK, strokeOpacity: 1 });
  });

  it.each(['pending', 'unconfirmed'] as const)('%s is a quiet dot, never a check', async kind => {
    const t = await draw(kind);
    expect(dots(t)).toHaveLength(1); expect(strokes(t)).toHaveLength(0);
    expect(dots(t)[0].props).toMatchObject({ fill: sys.conversation.onUser });
    expect(dots(t)[0].props.fillOpacity).toBeLessThan(1);
  });

  it('a failed send draws no mark at all: the bubble itself goes red and says so', async () => {
    const t = await draw('failed');
    expect(t.toJSON()).toBeNull();
  });

  it('keeps one box for every state, so a mark that changes never moves its line', async () => {
    for (const kind of ['sent', 'seen', 'pending', 'unconfirmed'] as const) {
      const t = await draw(kind);
      const svg = t.root.findByType(Svg);
      expect(svg.props).toMatchObject({ width: MARK_WIDTH, height: MARK_HEIGHT });
      await act(async () => t.unmount()); tree = undefined;
    }
  });

  it('the second check of "seen" lands exactly where the single check of "sent" stands', () => {
    // Both are the same polyline, five and a half points on: the last one never jumps when a message becomes seen.
    expect(MARK_PATHS.second.startsWith('M6.8 6.4')).toBe(true);
    expect(MARK_PATHS.first.startsWith('M1.4 6.4')).toBe(true);
  });
});

describe('the mark is spoken, never written', () => {
  it.each(['sent', 'seen', 'pending', 'unconfirmed'] as const)('%s is an image named by one plain word', async kind => {
    const t = await draw(kind);
    const node = t.root.findAllByProps({ accessibilityRole: 'image' })[0];
    expect(node.props.accessibilityLabel).toBe(MARK_WORDS[kind]);
    expect(node.props.accessible).toBe(true);
    // A mark of the history is quiet: opening a thread must not read out every check.
    expect(node.props.accessibilityLiveRegion).toBe('none');
    // No text of any kind is drawn: the only children are the drawing.
    expect(t.root.findAll(child => String(child.type) === 'Text' || String(child.type) === 'T')).toHaveLength(0);
  });

  it('a mark that can still change (the send of this phone) is announced politely when it does', async () => {
    const t = await draw('pending', true);
    expect(t.root.findAllByProps({ accessibilityRole: 'image' })[0].props.accessibilityLiveRegion).toBe('polite');
  });

  it('has the five words, with diacritics', () => {
    expect(MARK_WORDS.sent).toBe('Poslato'); expect(MARK_WORDS.seen).toBe('Viđeno');
    expect(MARK_WORDS.pending).toBe('Šalje se'); expect(MARK_WORDS.unconfirmed).toBe('Slanje nije potvrđeno'); expect(MARK_WORDS.failed).toBe('Nije poslato');
  });

  it('has no clock: the drawing is a 18 by 12 box', () => {
    expect([MARK_WIDTH, MARK_HEIGHT]).toEqual([18, 12]);
  });
});
