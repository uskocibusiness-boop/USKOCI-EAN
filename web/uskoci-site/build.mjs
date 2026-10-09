import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const site = resolve(root, 'web/uskoci-site');
const src = resolve(site, 'src');
const dist = resolve(site, 'dist');
const outAssets = resolve(dist, 'assets');

await rm(dist, { recursive: true, force: true });
await mkdir(outAssets, { recursive: true });
await cp(src, dist, { recursive: true });

const assets = [
  ['assets/entry-splash-mark.svg', 'mark.svg'],
  ['assets/brand/uskoci-dimensional-20261003.png', 'brand-dimensional.png'],
  ['assets/brand/entry-v49/requester.webp', 'requester.webp'],
  ['assets/brand/entry-v49/worker.jpg', 'worker.jpg'],
];

for (const [from, to] of assets) {
  await copyFile(resolve(root, from), resolve(outAssets, to));
}

console.log('USKOCI web built:', dist);
