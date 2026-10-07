import { uskociMapColors } from '../mapAppearance';
import { sys } from '../../system/tokens';

test('a colored public map preserves geometry, source, filtering, widths, zoom limits and label contents', () => {
  const style = {
    version: 8, sources: { public: { type: 'vector', url: 'https://tiles.example/public' } },
    layers: [
      { id: 'water', type: 'fill', source: 'public', 'source-layer': 'water', minzoom: 4, maxzoom: 18,
        filter: ['==', 'class', 'lake'], paint: { 'fill-color': '#eeeeee', 'fill-opacity': 0.7 } },
      { id: 'highway_major_inner', type: 'line', source: 'public', paint: { 'line-color': '#eeeeee', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 16, 8] } },
      { id: 'label_city', type: 'symbol', layout: { 'text-field': ['get', 'name:sr-Latn'], 'text-size': 16 }, paint: { 'text-halo-width': 1.5 } },
    ],
  };
  const before = JSON.stringify(style), result = uskociMapColors(style);
  expect(JSON.stringify(style)).toBe(before);
  expect(result.sources).toBe(style.sources);
  expect(result.layers[0]).toEqual({ ...style.layers[0], paint: { ...style.layers[0].paint, 'fill-color': sys.map.water } });
  expect(result.layers[1]).toEqual({ ...style.layers[1], paint: { ...style.layers[1].paint, 'line-color': sys.map.roadMajor } });
  expect(result.layers[2].layout).toBe(style.layers[2].layout);
  expect(result.layers[2].paint).toMatchObject({ 'text-halo-width': 1.5, 'text-color': sys.map.label });
});

test('an unknown provider layer or a changed layer type retains its original appearance', () => {
  const layers = [
    { id: 'new_park', type: 'fill', paint: { 'fill-color': '#123456' } },
    { id: 'water', type: 'line', paint: { 'line-color': '#123456' } },
    { id: 'constructor', type: 'fill', paint: { 'fill-color': '#123456' } },
  ];
  const result = uskociMapColors({ layers });
  layers.forEach((layer, i) => expect(result.layers[i]).toBe(layer));
  expect(uskociMapColors({ name: 'missing', layers: undefined })).toEqual({ name: 'missing', layers: undefined });
});

test('blue water and green geographic parks remain distinct from a warm light urban background', () => {
  const rgb = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  for (const color of [sys.map.ground, sys.map.residential]) {
    const channels = rgb(color);
    expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(10);
    expect(Math.min(...channels)).toBeGreaterThanOrEqual(220);
  }
  const [red, green, blue] = rgb(sys.map.water);
  expect(blue - red).toBeGreaterThan(65); expect(green - red).toBeGreaterThan(40);
  for (const color of [sys.map.park, sys.map.woodland]) {
    const [r, g, b] = rgb(color);
    expect(g).toBeGreaterThan(r); expect(g - b).toBeGreaterThan(40);
  }
});

// Owner 2026-10-07: "obojenije, da se vide lepo ulice". Streets must read against the ground at a glance.
test('streets stand out: white minor streets on a darker ground, firm edges and tinted main streets', () => {
  const rgb = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const luminance = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  expect(luminance(sys.map.road) - luminance(sys.map.ground)).toBeGreaterThanOrEqual(12);
  expect(luminance(sys.map.ground) - luminance(sys.map.roadEdge)).toBeGreaterThanOrEqual(30);
  const [r, , b] = rgb(sys.map.roadMajor);
  expect(r - b).toBeGreaterThanOrEqual(60);
  expect(luminance(sys.map.roadMajor) - luminance(sys.map.roadMajorEdge)).toBeGreaterThanOrEqual(25);
  const layers = ['highway_minor', 'highway_major_inner', 'highway_major_casing'].map(id => ({ id, type: 'line', paint: {} }));
  const colors = uskociMapColors({ layers }).layers.map(layer => (layer.paint as Record<string, string>)['line-color']);
  expect(colors).toEqual([sys.map.road, sys.map.roadMajor, sys.map.roadMajorEdge]);
});
