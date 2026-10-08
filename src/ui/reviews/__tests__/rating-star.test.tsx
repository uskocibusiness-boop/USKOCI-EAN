import React from 'react';
import { Animated, Easing, View } from 'react-native';
import { Ellipse, Path } from 'react-native-svg';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../system/tokens';
import { GLOW_MS, RatingStar, STARS_COUNT, STARS_WIDTH, STAR_SLOT, StarGlow } from '../RatingStar';

/**
 * The rating stars as stickers (owner's pick of 8 Oct 2026, "Zvezde kao nalepnice") and the one glow of the saved rating ("Pilula pada,
 * sjaj"). The star is a vector until the owner's own drawing arrives: a full one in the orange enamel, an empty one in cream, one shape.
 * The glow crosses the stars once, only when the rating has just been saved, and never under reduced motion.
 */
let mockReduced = false;
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));

let tree: ReactTestRenderer | undefined;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => { tree?.unmount(); tree = undefined; }); mockReduced = false; jest.restoreAllMocks(); });
const paths = () => tree!.root.findAllByType(Path);

describe('the sticker star', () => {
  it('is 48 dp wide as a touch needs, and five of them with four gaps of 8 are the 272 dp row of both screens', () => {
    expect(STAR_SLOT).toBe(48);
    expect(STARS_COUNT).toBe(5);
    expect(STARS_WIDTH).toBe(5 * 48 + 4 * sys.space.sm);
    expect(STARS_WIDTH).toBe(272);
  });

  it('draws the full star in the orange enamel: the accent face, the darker edge under it, one shine, and a soft shadow on the ground', async () => {
    await render(<RatingStar full />);
    const [edge, face, shine] = paths();
    expect(edge.props.fill).toBe(sys.color.art.accent.edge);
    expect(face.props.fill).toBe(sys.color.art.accent.front);
    expect(shine.props.stroke).toBe(sys.color.art.accent.light);
    expect(tree!.root.findAllByType(Ellipse)).toHaveLength(1);
  });

  it('draws the empty star in cream enamel with the orange halo as its edge: the same shape, so a rating never changes the outline', async () => {
    await render(<RatingStar full={false} />);
    const [edge, face] = paths();
    expect(edge.props.fill).toBe(sys.color.orangeHalo);
    expect(face.props.fill).toBe(sys.color.orangeSoft);
    const empty = [edge.props.d, face.props.d];
    await act(async () => tree!.update(<RatingStar full />));
    expect([paths()[0].props.d, paths()[1].props.d]).toEqual(empty);
  });

  it('is a decoration the words beside it describe: hidden from a screen reader, drawn at the size it is given', async () => {
    await render(<RatingStar full size={32} />);
    const box = tree!.root.findAllByType(View)[0];
    expect(box.props.accessible).toBe(false);
    expect(box.props['aria-hidden']).toBe(true);
    expect(box.props.style).toMatchObject({ width: 32, height: 32 });
  });
});

type TimingConfig = { toValue: number; duration: number; delay?: number; easing: (t: number) => number; useNativeDriver: boolean };
const glowBand = () => tree!.root.findAll(node => typeof node.type === 'string' && node.props.pointerEvents === 'none');

describe('the glow', () => {
  it('is 420 ms: longer than an entrance and shorter than an arrival', () => {
    expect(GLOW_MS).toBe(420);
    expect(GLOW_MS).toBeGreaterThan(sys.motion.enter);
    expect(GLOW_MS).toBeLessThan(sys.motion.arrive.duration);
  });

  it('crosses the stars once on the native driver, on easeOut, after the delay it was given', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<StarGlow width={STARS_WIDTH} play delay={140}><View /></StarGlow>);
    expect(timing).toHaveBeenCalledTimes(1);
    const config = timing.mock.calls[0][1] as unknown as TimingConfig;
    expect(config).toMatchObject({ toValue: 1, duration: 420, delay: 140, useNativeDriver: true });
    const curve = Easing.bezier(...sys.motion.easeOut);
    for (const t of [0, 0.2, 0.6, 1]) expect(config.easing(t)).toBeCloseTo(curve(t), 6);
    expect(glowBand()).toHaveLength(1);
  });

  it('moves only transform and opacity: the band leans and slides, and the stars under it never move', async () => {
    await render(<StarGlow width={STARS_WIDTH} play><View /></StarGlow>);
    const style = JSON.stringify(glowBand()[0].props.style);
    expect(style).toContain('translateX'); expect(style).toContain('skewX'); expect(style).toContain('opacity');
    for (const key of ['"width":0', 'marginLeft', '"left":', 'height']) expect(style.includes(key) && key !== '"left":').toBe(false);
  });

  it('is not there for a rating saved earlier: no band, no motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<StarGlow width={STARS_WIDTH} play={false}><View /></StarGlow>);
    expect(timing).not.toHaveBeenCalled();
    expect(glowBand()).toHaveLength(0);
  });

  it('is not there under reduced motion: the stars are simply there', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<StarGlow width={STARS_WIDTH} play><View /></StarGlow>);
    expect(timing).not.toHaveBeenCalled();
    expect(glowBand()).toHaveLength(0);
  });

  it('clips the band to the row of stars, and keeps the stars as its content', async () => {
    await render(<StarGlow width={STARS_WIDTH} play><View testID="stars" /></StarGlow>);
    expect(tree!.root.findAllByProps({ testID: 'stars' }).length).toBeGreaterThan(0);
    const clip = tree!.root.findAllByType(View)[0];
    expect(clip.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ overflow: 'hidden' }), expect.objectContaining({ width: STARS_WIDTH })]));
  });
});
