import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code = readFileSync(new URL('../../../.github/workflows/ci-clean.yml', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(line => !line.trimStart().startsWith('#')).join('\n');
const joined = code.replace(/\\\n\s*/g, ' ');

test('clean CI checks all three AI Edge entrypoints with pinned Deno and no remote imports', () => {
  assert.match(code, /uses: denoland\/setup-deno@[a-f0-9]{40}/);
  assert.match(code, /deno-version: v2\.5\.6/);
  const command = joined.split('\n').find(line => line.includes('deno check '));
  assert.ok(command, 'an executable Deno check step is required');
  for (const flag of ['--no-config', '--no-lock', '--no-npm', '--no-remote']) assert.ok(command.includes(flag), flag);
  for (const route of ['uskoci-ai-interview', 'uskoci-worker-interview', 'uskoci-taxonomy-postsave-worker']) {
    assert.ok(command.includes(`supabase/functions/${route}/index.ts`), route);
  }
  assert.doesNotMatch(command, /--no-check|\|\|/);
});

test('cross-mode, handoff, aliases and clarification regressions are executed by clean CI', () => {
  for (const name of ['classification-gemini-shadow', 'service-handoff', 'worker-existing-identity-recovery',
    'classification-direct-reply', 'classification-verified-alias', 'classification-turn-feedback',
    'classification-gemini-shadow-source']) {
    const path = `supabase/proofs/dynamic_taxonomy/${name}.test.mjs`;
    assert.ok(joined.split('\n').some(line => line.includes('node --test ') && line.includes(path)), path);
  }
});

test('the offline check workflow has no deployment or secret-backed operation', () => {
  assert.match(code, /permissions:\s*\n\s+contents: read/);
  assert.match(code, /persist-credentials: false/);
  assert.doesNotMatch(code, /secrets\.|continue-on-error|supabase (?:db push|functions deploy)|eas (?:update|submit|build)/);
  assert.ok(joined.split('\n').some(line => line.includes('node --test ') &&
    line.includes('supabase/proofs/taxonomy/live_writer_characterization.test.mjs')));
});
