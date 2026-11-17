'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Need and Worker use separate role instructions, not a mixed shared business prompt', async () => {
  const [{ interviewVoiceInstruction }, { needConversationInstruction }, { workerConversationInstruction }, { needConversationIntentInstruction }, { workerConversationIntentInstruction }] = await Promise.all([
    import('../supabase/functions/_shared/interviewVoiceInstruction.mjs'),
    import('../supabase/functions/_shared/needConversationInstruction.mjs'),
    import('../supabase/functions/_shared/workerConversationInstruction.mjs'),
    import('../supabase/functions/_shared/needConversationIntentInstruction.mjs'),
    import('../supabase/functions/_shared/workerConversationIntentInstruction.mjs'),
  ]);
  const voice = interviewVoiceInstruction();
  const need = needConversationInstruction();
  const worker = workerConversationInstruction();
  const needIntent = needConversationIntentInstruction();
  const workerIntent = workerConversationIntentInstruction();
  assert.match(voice, /prirodnim, tečnim srpskim jezikom/u);
  assert.doesNotMatch(voice, /DOMAĆIN|MAJSTOR|POMAGAČ|radni profil|zadatak koji korisnik želi/u);
  assert.match(need, /ULOGA NEED/u);
  assert.match(need, /JEDAN konkretan zadatak/u);
  assert.match(need, /ne sastavljate spisak usluga koje korisnik nudi/iu);
  assert.match(worker, /ULOGA WORKER/u);
  assert.match(worker, /šta ume/u);
  assert.match(worker, /nijedan primer.*ne postaje usluga/u);
  assert.match(worker, /ne pravite zadatak za korisnika/u);
  assert.match(needIntent, /CURRENT INTERVIEW DOMAIN=NEED/u);
  assert.match(needIntent, /„Ja mogu“ assistant/u);
  assert.doesNotMatch(needIntent, /CURRENT INTERVIEW DOMAIN=WORKER/u);
  assert.match(workerIntent, /CURRENT INTERVIEW DOMAIN=WORKER/u);
  assert.match(workerIntent, /„Meni treba“ assistant/u);
  assert.doesNotMatch(workerIntent, /CURRENT INTERVIEW DOMAIN=NEED/u);
  const needEdge = fs.readFileSync(path.join(root, 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
  const workerEdge = fs.readFileSync(path.join(root, 'supabase/functions/uskoci-worker-interview/index.ts'), 'utf8');
  assert.match(needEdge, /needConversationInstruction\(\)/u);
  assert.match(needEdge, /needConversationIntentInstruction\(\)/u);
  assert.match(workerEdge, /workerConversationInstruction\(\)/u);
  assert.match(workerEdge, /workerConversationIntentInstruction\(\)/u);
  assert.doesNotMatch(needEdge, /workerConversationInstruction|workerConversationIntentInstruction/u);
  assert.doesNotMatch(workerEdge, /needConversationInstruction|needConversationIntentInstruction/u);
});
