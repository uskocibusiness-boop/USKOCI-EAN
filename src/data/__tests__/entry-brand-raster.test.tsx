import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BrandRasterMark, BrandRasterWords } from '../../ui/entry/BrandRaster';

jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', G: 'G', Path: 'Path', Rect: 'Rect', Defs: 'Defs', ClipPath: 'ClipPath', Image: 'SvgImage', Use: 'Use', LinearGradient: 'LinearGradient', RadialGradient: 'RadialGradient', Stop: 'Stop' }));
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });

it('passes atlas normalization through the real native SVG transform extractor', async () => {
  // A plain G silently ignores its native-only matrix prop during React render.
  // Browser adapters accepted it, so source screenshots missed the Android crop.
  const extractTransform = jest.requireActual('react-native-svg/lib/commonjs/lib/extract/extractTransform').default;
  for (const [element, source, expected] of [
    [<BrandRasterMark id="mark" />, [145, 66, 725, 670], [0, 0, 280, 291]],
    [<BrandRasterWords id="words" />, [699, 66, 1925, 670], [143, 174, 359, 278]],
  ] as const) {
    await act(async () => { tree = create(element); });
    const group = tree.root.findAllByType('G' as React.ElementType).find(node => node.props.matrix || String(node.props.transform).startsWith('matrix('))!;
    const [a, b, c, d, e, f] = extractTransform(group.props);
    const mapped = [a * source[0] + c * source[1] + e, b * source[0] + d * source[1] + f,
      a * source[2] + c * source[3] + e, b * source[2] + d * source[3] + f];
    mapped.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 5));
    await act(async () => tree.unmount());
  }
});

