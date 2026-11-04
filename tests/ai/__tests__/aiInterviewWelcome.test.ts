import {workerInterviewOpening,taskInterviewOpening} from '../../../src/features/ai/intake/aiInterviewWelcome';
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
    const source=readFileSync(resolve(__dirname,'../../../supabase/functions/uskoci-worker-interview/index.ts'),'utf8');
    expect(source).toContain('The phone already introduced the flow');
    const voice=readFileSync(resolve(__dirname,'../../../supabase/functions/_shared/interviewVoiceInstruction.mjs'),'utf8');
    expect(source).toContain('interviewVoiceInstruction()');
    expect(voice).toContain('najviše JEDNO pitanje za JEDNU bitnu nepoznanicu');
    expect(voice).toContain('Objavi/Sačuvaj je korisnička potvrda celine');
    expect(voice).toContain('Ne tvrdite da je već objavljeno, sačuvano, aktivirano ili poslato drugima');
    expect(source).toContain('Do not ask for equipment, licenses, certificates or permanent team capacity');
  });
});
