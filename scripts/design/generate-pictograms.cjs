// Generates src/ui/system/Pictogram.tsx from scripts/design/pictograms.cjs (one source for the app and the board).
// Run: node scripts/design/generate-pictograms.cjs
const fs = require('fs');
const path = require('path');
delete require.cache[require.resolve('./pictograms.cjs')];
const { K } = require('./pictograms.cjs');

const tag = { circle: 'Circle', ellipse: 'Ellipse', path: 'Path', rect: 'Rect', g: 'G' };
const NUM = /^(cx|cy|r|rx|ry|x|y|width|height|opacity|strokeWidth)$/;
function jsx(svg) {
  return svg
    .replace(/<(\/?)(circle|ellipse|path|rect|g)\b/g, (_, slash, t) => `<${slash}${tag[t]}`)
    .replace(/stroke-width=/g, 'strokeWidth=').replace(/stroke-linecap=/g, 'strokeLinecap=').replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/(\w+)="\{grad\}"/g, (_, k) => `${k}={grad}`)
    .replace(/(\w+)="\{(front|edge|light|soft)\}"/g, (_, k, v) => `${k}={c.${v}}`)
    .replace(/(\w+)="([-\d.]+)"/g, (m, k, v) => (NUM.test(k) ? `${k}={${v}}` : m));
}

const kinds = Object.keys(K);
const cases = kinds.map(id => `    case '${id}': return <>${jsx(K[id].svg.join(''))}</>;`).join('\n');
const catalog = kinds.map(id => `  { kind: '${id}', label: '${K[id].label}', group: '${K[id].group}' },`).join('\n');

const out = `import { memo, useId, type ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { MATERIAL_SUBJECTS } from './materialSubjects';
import { sys } from './tokens';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * USKOČI pictograms: the picker level of the one icon language (the owner's master UI/UX directive, 2026-09-23).
 *
 * FactArt draws facts; a pictogram draws a real thing a person chooses: a
 * vehicle, a tool, a kind of work, a team size. It keeps FactArt's 32-unit canvas, its green and orange tones, the
 * ground shadow, the darker edge under the face and the light shine, and adds a soft vertical gradient on the face for
 * the volume a picker screen calls for. Use it at 32 px and above (48–64 in a picker tile); below 32 use FactArt.
 * A pictogram is decorative: the label beside it carries the meaning, so it is hidden from screen readers.
 *
 * Generated from scripts/design/pictograms.cjs by scripts/design/generate-pictograms.cjs; edit the drawings there and regenerate.
 */
export type PictogramKind = ${kinds.map(id => `'${id}'`).join(' | ')};
export type PictogramGroup = 'vozila' | 'alat' | 'usluge' | 'ljudi';

export const pictogramCatalog: readonly { kind: PictogramKind; label: string; group: PictogramGroup }[] = [
${catalog}
];

type Tone = { front: string; edge: string; light: string; soft: string; top: string };
const GREEN: Tone = sys.pictogram.green;
const ORANGE: Tone = sys.pictogram.orange;
const MUTED: Tone = sys.pictogram.muted;
const ORANGE_KINDS: readonly PictogramKind[] = [${kinds.filter(id => K[id].tone === 'orange').map(id => `'${id}'`).join(', ')}];

function drawing(kind: PictogramKind, c: Tone, grad: string): ReactNode {
  switch (kind) {
${cases}
  }
}

function PictogramBase({ kind, size = 48, disabled = false }: { kind: PictogramKind; size?: number; disabled?: boolean }) {
  const tone = disabled ? MUTED : ORANGE_KINDS.includes(kind) ? ORANGE : GREEN;
  const id = \`pg\${useId().replace(/[^a-zA-Z0-9]/g, '')}\`;
  // Only exact subjects use bundled artwork. Different tools/vehicles keep distinct drawings;
  // disabled choices retain the muted vector, not a colored image with ambiguous state.
  const subject = kind === 'kombi' ? MATERIAL_SUBJECTS.vehicle : kind === 'laptop' ? MATERIAL_SUBJECTS.remote : undefined;
  if (subject && !disabled && size >= 32) return <View aria-hidden style={{ width: size, height: size }}>
    <Image source={subject} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory" transition={0} />
  </View>;
  return <View aria-hidden style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={tone.top} /><Stop offset="0.62" stopColor={tone.front} /></LinearGradient></Defs>
      {drawing(kind, tone, \`url(#\${id})\`)}
    </Svg>
  </View>;
}

export const Pictogram = memo(PictogramBase);
`;
const target = process.argv[2] || path.resolve(__dirname, '../../src/ui/system/Pictogram.tsx');
fs.writeFileSync(target, out);
console.log('wrote', target, kinds.length, 'kinds');
