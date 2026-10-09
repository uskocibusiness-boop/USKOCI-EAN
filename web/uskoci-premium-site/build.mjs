import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const parts = ['00', '01', '02', '03', '04', '05'];
const encoded = (await Promise.all(
  parts.map((part) => readFile(resolve(root, `site-lite.b64.part${part}`), 'utf8')),
)).join('');

const dist = resolve(root, 'dist');
const archive = resolve(root, 'site-lite.tar.gz');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(archive, Buffer.from(encoded, 'base64'));
execFileSync('tar', ['-xzf', archive, '-C', dist], { stdio: 'inherit' });

console.log('USKOČI premium site restored to dist');
