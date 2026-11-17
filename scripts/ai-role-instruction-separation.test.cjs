'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Need and Worker use separate role instructions, not a mixed shared business prompt', async () => {
  const [{ interviewVoiceInstruction }, { needConversationInstruction }, { workerConversationInstruction }] = await Promise.all([
    import('../supabase/functions/_shared/interviewVoiceInstruction.mjs'),
    import('../supabase/functions/_shared/needConversationInstruction.mjs'),
    import('../supabase/functions/_shared/workerConversationInstruction.mjs'),
  ]);
  const voice = interviewVoiceInstruction();
  const need = needConversationInstruction();
  const worker = workerConversationInstruction();
  assert.match(voice, /prirodnim, tečnim srpskim jezikom/u);
  assert.doesNotMatch(voice, /DOMAĆIN|MAJSTOR|POMAGAČ|radni profil|zadatak koji korisnik želi/u);
  assert.match(need, /ULOGA NEED/u);
  assert.match(need, /jedan konkretan zadatak/u);
  assert.match(need, /ne sastavljate spisak usluga koje korisnik nudi/u);
  assert.match(worker, /ULOGA WORKER/u);
  assert.match(worker, /šta ume/u);
  assert.match(worker, /nijedan primer.*ne postaje usluga/u);
  assert.match(worker, /ne pravite zadatak za korisnika/u);
  const needEdge = fs.readFileSync(path.join(root, 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
  const workerEdge = fs.readFileSync(path.join(root, 'supabase/functions/uskoci-worker-interview/index.ts'), 'utf8');
  assert.match(needEdge, /needConversationInstruction\(\)/u);
  assert.match(workerEdge, /workerConversationInstruction\(\)/u);
  assert.doesNotMatch(needEdge, /workerConversationInstruction/u);
  assert.doesNotMatch(workerEdge, /needConversationInstruction/u);
});
