// An Edge-owned TypeScript contract must have a Deno-resolvable type specifier.
// This test reads the actual source and does not hit provider or database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const need=readFileSync(resolve(root,'src/contracts/needFactsV2.ts'),'utf8');
const handoff=readFileSync(resolve(root,'src/contracts/serviceHandoff.ts'),'utf8');
test('Edge type import has explicit .ts extension for Deno',()=>{
 assert.match(need,/import\(['"]\.\/serviceHandoff\.ts['"]\)\.ServiceHandoff/);
 assert.doesNotMatch(need,/import\(['"]\.\/serviceHandoff['"]\)/);
 assert.match(handoff,/export type \{ ServiceHandoff \} from ['"]\.\.\/\.\.\/supabase\/functions\/_shared\/serviceHandoff\.mjs['"]/);
});
