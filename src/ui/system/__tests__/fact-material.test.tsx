import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'expo-image';
import Svg from 'react-native-svg';
import { FactArt } from '../FactArt';

type FactArtProps = React.ComponentProps<typeof FactArt>;

describe('material subjects keep semantic and small-mark boundaries', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });
  async function render(props: FactArtProps) {
    await act(async () => { tree = create(<FactArt {...props} />); });
    return tree.root;
  }
  it('bundles decorative art without a network request or entrance fade', async () => {
    const root = await render({ kind: 'pin', size: 28 });
    const art = root.findByType(Image);
    expect(art.props.source).toBe(require('../../../../assets/illustrations/natural-v1/pin.webp'));
    expect(art.props).toMatchObject({ contentFit: 'contain', transition: 0, accessible: false, allowDownscaling: true });
    expect(art.props.style).toEqual({ width: 28, height: 28 });
    expect(root.findAllByType(Svg)).toHaveLength(0);
  });
  it.each<FactArtProps>([
    { kind: 'pin', size: 24 },
    { kind: 'pin', size: 18, cut: 'art' },
    { kind: 'pin', size: 40, cut: 'mark' },
    { kind: 'pin', size: 40, muted: true },
    { kind: 'pin', size: 40, tone: 'danger' },
    { kind: 'agreements', size: 40, role: 'waiting' },
    { kind: 'agreements', size: 40, role: 'confirmed' },
    { kind: 'chat', size: 40, role: 'ai' },
  ])('preserves vector meaning for %j', async props => {
    const root = await render(props);
    expect(root.findAllByType(Image)).toHaveLength(0);
    expect(root.findAllByType(Svg)).toHaveLength(1);
  });
  it('allows a deliberately chosen decorative 24dp illustration', async () => {
    const root = await render({ kind: 'offers', size: 24, cut: 'art' });
    expect(root.findAllByType(Image)).toHaveLength(1);
  });
});
