import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewVoiceInstruction} from '../../functions/_shared/interviewVoiceInstruction.mjs';

test('shared USKOČI dialogue has one question, remembers clear answers and does not claim Save authority',()=>{
 const rules=interviewVoiceInstruction();
 assert.match(rules,/Jedno korisno pitanje po poruci/);
 assert.match(rules,/najviše JEDNU informaciju/);
 assert.match(rules,/Prihvatite sve jasne podatke/);
 assert.match(rules,/ne pitajte već odgovoreno/);
 assert.match(rules,/bez potvrde sistema/);
 assert.ok(rules.length < 1600,'do not grow duplicated conversational guidance');
});
