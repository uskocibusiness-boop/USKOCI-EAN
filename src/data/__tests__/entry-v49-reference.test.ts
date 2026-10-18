import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryV49Intro, entryV49Intent, entryV49Layout } from '../../ui/entry/entryV49Math';
import { requesterNoteXml, workerNoteXml } from '../../ui/entry/entryV49Notes';
import reference from './fixtures/entry-v49-chrome.json';
import provenance from '../../../assets/brand/entry-v49/provenance.json';

const root = join(__dirname, '../../..');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
it('binds the four native assets and vector adapter to the exact owner V4.9 bytes', () => {
  expect(reference.sourceSha256).toBe(provenance.sourceSha256);
  expect(provenance.sourceBytes).toBeGreaterThan(0);
  for (const asset of provenance.assets) {
    const bytes = readFileSync(join(root, 'assets/brand/entry-v49', asset.name));
    expect(bytes.length).toBe(asset.bytes); expect(sha(bytes)).toBe(asset.sha256);
  }
  expect(sha(requesterNoteXml)).toBe(provenance.assets[2].sha256);
  expect(sha(workerNoteXml)).toBe(provenance.assets[3].sha256);
  expect(requesterNoteXml + workerNoteXml).not.toMatch(/<script|<image|href=|<foreignObject/i);
});
it('names both original portraits by their actual embedded format without re-encoding', () => {
  const requester = provenance.assets[0]; const worker = provenance.assets[1];
  expect(requester.mime).toBe('image/webp'); expect(requester.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(worker.mime).toBe('image/jpeg'); expect(worker.sha256).toMatch(/^[0-9a-f]{64}$/);
  const webp = readFileSync(join(root, 'assets/brand/entry-v49', requester.name));
  const jpeg = readFileSync(join(root, 'assets/brand/entry-v49', worker.name));
  expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(jpeg.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  expect(jpeg.subarray(-2).toString('hex')).toBe('ffd9');
  const entry = readFileSync(join(root, 'src/ui/entry/EntryWelcome.tsx'), 'utf8');
  expect(entry).toContain("require('../../../assets/brand/entry-v49/requester.webp')");
  expect(entry).toContain("require('../../../assets/brand/entry-v49/worker.jpg')");
  expect(entry).not.toContain('entry-v49/worker.png');
});
// Historical Chrome coordinates remain fixtures, not a layout authority.
it.each([0, 300, 1400, 3000, 4400, 6000])('entry artwork has bounded finite state at %i ms',time=>{
  const intro=entryV49Intro(time);
  for(const part of [intro.copy,intro.photo,intro.note]){
    expect(part.opacity).toBeGreaterThanOrEqual(0);expect(part.opacity).toBeLessThanOrEqual(1);expect(Number.isFinite(part.y)).toBe(true);
  }
  expect(intro.seam).toBeGreaterThanOrEqual(0);expect(intro.seam).toBeLessThanOrEqual(1);
  const intent=entryV49Intent(time,390,reference.layout.photoH);
  for(const [key,value] of Object.entries(intent)){expect(Number.isFinite(value)).toBe(true);if(/Opacity|Open$/.test(key)){expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(1);}}
});
it.each([0, 100, 3730, 4380])('renders all parts immediately under reduced motion at %i ms', time => {
  expect(entryV49Intro(time, true)).toEqual({ copy: { opacity: 1, y: 0 }, photo: { opacity: 1, y: 0 }, note: { opacity: 1, y: 0 }, seam: 1 });
});
it.each([[361, 780, 1], [390, 844, 1], [412, 900, 1], [361, 780, 2], [390, 844, 2], [412, 900, 2], [844, 390, 2]])('keeps measured content ordered and safely scrollable at %i×%i scale%i', (width, height, scale) => {
  const layout = entryV49Layout(width, height, scale, { brand: 244, copy: 160, note: 112, footer: 210 }, 48, 34);
  expect(layout.brandY).toBeGreaterThanOrEqual(48);
  expect(layout.copyY).toBeGreaterThan(layout.brandY + 244);
  expect(layout.photoY).toBeGreaterThan(layout.copyY + 160);
  expect(layout.noteY).toBeGreaterThan(layout.photoY + layout.photoH);
  expect(layout.footY).toBeGreaterThan(layout.noteY + layout.noteH);
  expect(layout.height).toBeGreaterThanOrEqual(layout.footY + 210 + 34);
  expect(layout.photoH).toBeGreaterThan(0);
});
it('does not compress the authored photos to fit larger hit targets or repeatedly apply the V396 delta', () => {
  const normal = entryV49Layout(390, 844, 1, reference.layout);
  const native = entryV49Layout(390, 844, 1, { ...reference.layout, footer: 108 });
  expect(native.photoH).toBe(normal.photoH); expect(native.footY).toBe(normal.footY);
  expect(native.height).toBeGreaterThan(normal.height);
  expect(entryV49Layout(390, 844, 1, { ...reference.layout, footer: 108 })).toEqual(native);
});
it.each([[390, 844, 1, 52, 24], [390, 844, 2, 52, 24], [320, 568, 1, 48, 34], [844, 390, 2, 48, 34]])(
  'keeps image geometry stable when only system safe-area insets change at %i×%i scale%i', (width, height, scale, top, bottom) => {
    const measured = scale === 1 ? reference.layout : reference.largeLayout;
    const authored = entryV49Layout(width, height, scale, measured);
    const native = entryV49Layout(width, height, scale, measured, top, bottom);
    const shift = Math.max(0, top - authored.brandY);
    expect(native.photoH).toBeCloseTo(authored.photoH, 8);
    expect(native.motionPhotoH).toBeCloseTo(authored.motionPhotoH, 8);
    expect(native.photoW).toBe(authored.photoW);
    for (const key of ['brandY', 'copyY', 'photoY', 'noteY', 'footY'] as const)
      expect(native[key]).toBeCloseTo(authored[key] + shift, 8);
    expect(native.height).toBeGreaterThanOrEqual(native.footY + native.footH + bottom);
  });
