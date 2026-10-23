import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewVoiceInstruction} from '../../functions/_shared/interviewVoiceInstruction.mjs';

test('shared USKOČI dialogue has one question, remembers clear answers and does not claim Save authority',()=>{
 const rules=interviewVoiceInstruction();
 assert.match(rules,/Jedno korisno pitanje po poruci/);
 assert.match(rules,/najviše JEDNU informaciju/);
 assert.match(rules,/prihvati sve druge jasne odgovore/);
 assert.match(rules,/ne postavljaj već odgovoreno pitanje/);
 assert.match(rules,/pre potvrde sistema/);
 assert.ok(rules.length < 1600,'do not grow duplicated conversational guidance');
});
