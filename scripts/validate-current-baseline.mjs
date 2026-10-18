// Validate the current handoff's file ownership, not historical screen composition.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/current/CURRENT_BASELINE_20261018.json'), 'utf8'));
const owners = Object.entries(manifest.activeOwners);
const verified = [];
for (const [purpose, relative] of owners) {
  if (typeof relative !== 'string') throw new Error(`Invalid owner for ${purpose}`);
  const resolved = path.resolve(root, relative);
  const within = path.relative(root, resolved);
  if (within.startsWith('..') || path.isAbsolute(within) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Missing or external owner: ${purpose}`);
  }
  verified.push({ purpose, path: relative });
}
console.log(JSON.stringify({ status: 'PASS', activeOwners: verified, scope: 'File ownership only; no fixed palette, layout, icon count, radius or motion implementation.' }, null, 2));
