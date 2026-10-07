import { SUPPORT_HAS_DUTY_OPERATOR, manualCheckCopy } from '../reviewFacts';

/**
 * Owner decision d07 (2026-10-07): while support has no operator on duty, a task held for a manual check offers ONLY "Izmeni zadatak".
 * The request to support stood right under the sentence that says nobody is on duty. The day an operator exists it is one line
 * (`SUPPORT_HAS_DUTY_OPERATOR`): the entry returns and the sentence stops saying nobody is on duty. The screen suite (v5-review-screen)
 * proves the entry is not drawn; this pins the switch and the two sentences, which are the same words with one clause less.
 */
describe('a task held for a manual check', () => {
  it('has no operator on duty yet, so the review offers no request to support', () => {
    expect(SUPPORT_HAS_DUTY_OPERATOR).toBe(false);
  });

  it('says so while nobody is on duty, and names the way that works', () => {
    const copy = manualCheckCopy();
    expect(copy).toBe(manualCheckCopy(false));
    expect(copy).toBe('Zadatak zahteva ručnu proveru i još nije objavljen. Podrška još nema dežurnog operatera, pa je najbrže da ga izmeniš i ponovo pošalješ.');
  });

  it('stops saying nobody is on duty the day somebody is, and keeps the fact', () => {
    const copy = manualCheckCopy(true);
    expect(copy).toBe('Zadatak zahteva ručnu proveru i još nije objavljen.');
    expect(copy).not.toMatch(/dežurn/);
    expect(manualCheckCopy(false).startsWith(copy)).toBe(true);
  });
});
