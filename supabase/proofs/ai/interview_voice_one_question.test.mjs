import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewVoiceInstruction} from '../../functions/_shared/interviewVoiceInstruction.mjs';

test('shared USKOČI dialogue has one question, remembers clear answers and does not claim Save authority',()=>{
 const rules=interviewVoiceInstruction();
 assert.match(rules,/najviše JEDNO pitanje/);
 assert.match(rules,/JEDNU bitnu nepoznanicu/);
 assert.match(rules,/izdvojite sve jasne podatke/);
 assert.match(rules,/Bez spojenih pitanja, ponavljanja poznatog/);
 assert.match(rules,/Ne tvrdite da je već objavljeno, sačuvano, aktivirano/);
 assert.ok(rules.length < 1600,'do not grow duplicated conversational guidance');
});
