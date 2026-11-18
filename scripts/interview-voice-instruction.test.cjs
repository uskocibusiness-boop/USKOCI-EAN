const test = require('node:test');
const assert = require('node:assert/strict');

const { interviewVoiceInstruction } = await import('../supabase/functions/_shared/interviewVoiceInstruction.mjs');

test('shared interview voice keeps tone and script rules separate from business roles', () => {
  const voice = interviewVoiceInstruction();
  assert.ok(voice.includes('USKOČI GLAS I TON'));
  assert.ok(voice.includes('PISMO-OGLEDALO'));
  assert.ok(voice.includes('RAZGOVORNI STIL'));
  assert.doesNotMatch(voice, /ULOGA NEED|ULOGA WORKER|DOMAĆIN|MAJSTOR|POMOĆNIK/u);
  assert.doesNotMatch(voice, /naručilac|uskočer/u);
});

test('shared voice requires respectful Serbian and follows the latest message script', () => {
  const voice = interviewVoiceInstruction();
  assert.match(voice, /Vi\/Vam\/Vas/u);
  assert.match(voice, /ćirilicom/u);
  assert.match(voice, /latinicom/u);
  assert.match(voice, /Odgovorite na direktno pitanje/u);
});
