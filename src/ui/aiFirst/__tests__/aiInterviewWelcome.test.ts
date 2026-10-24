import {workerInterviewOpening,taskInterviewOpening} from '../aiInterviewWelcome';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('first USKOČI AI welcome',()=>{
  test('new worker understands membership, optional notifications, interview and one opening question',()=>{
    const text=workerInterviewOpening(false);
    expect(text).toContain('USKOČI zajednic');
    expect(text).toContain('zadatke koji odgovaraju');
    expect(text).toContain('pitanje po pitanje');
    expect(text).toContain('potvrđujete');
    expect(text.split('?')).toHaveLength(2);
    expect(text).not.toMatch(/profil je aktiviran|obaveštenja su uključena/i);
  });
  test('worker with existing profile is asked only for a change without fake Save',()=>{
    const text=workerInterviewOpening(true);
    expect(text).toContain('ponovo tu');
    expect(text).toContain('ostavljamo kako jesu');
    expect(text).toContain('tek kada ih pregledate i sačuvate');
    expect(text.split('?')).toHaveLength(2);
    expect(text).not.toContain('Za početak, koje vrste zadataka');
  });
  test('new requester is led to the task in plain Serbian, then owner review',()=>{
    const text=taskInterviewOpening(false);
    expect(text).toContain('pitanje samo kada je potrebno');
    expect(text).toContain('Ništa ne objavljujemo bez Vaše potvrde');
    expect(text.split('?')).toHaveLength(2);
  });
  test('existing task change keeps known details and waits for owner approval',()=>{
    const text=taskInterviewOpening(true);
    expect(text).toContain('ostale poznate podatke u nacrtu');
    expect(text).toContain('pregledate i potvrdite');
    expect(text.split('?')).toHaveLength(2);
  });
  test('worker LLM is instructed not to repeat onboarding or request unsupported fields',()=>{
    const source=readFileSync(resolve(__dirname,'../../../../supabase/functions/uskoci-worker-interview/index.ts'),'utf8');
    expect(source).toContain('The phone already shows the opening introduction');
    expect(source).toContain('Ask at most ONE short question per reply');
    expect(source).toContain('Only explicit Sačuvaj profil in the review applies the changes');
  });
});
