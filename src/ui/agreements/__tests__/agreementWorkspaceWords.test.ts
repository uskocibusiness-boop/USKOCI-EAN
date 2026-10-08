jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'V2Action' }));
import { agreementNextStep, agreementQuietLine, agreementWaitsForMe, RATING_WAITS_FOR_ME } from '../AgreementWorkspace';

/**
 * The words of the Dogovor's step and of its footer (plan 2.6, item 7): the app says "zadatak", never "posao"; the worker's
 * word is "Zadatak je gotov" and the requester's "Potvrdi završetak", the same on the button, in the review and in the sentences
 * around them; and no number of hours is written in the code - the deadline is the server's.
 */
const none = { waits: false, mine: null as boolean | null };

describe('the sentence that stands where no button does', () => {
  const line = (patch: Partial<Parameters<typeof agreementQuietLine>[0]> = {}) =>
    agreementQuietLine({ state: 'CONFIRMED', party: true, worker: false, otherName: 'Marko', change: none, permissionsKnown: true, ...patch });

  it('names the other side while it is their move: the confirmation, or the answer to my proposal', () => {
    // The worker has reported the work done: the confirmation is the requester\'s, and it is said whether or not the permissions were read.
    expect(line({ state: 'AWAITING_REQUESTER', worker: true })).toBe('Čeka da Marko potvrdi završetak.');
    expect(line({ state: 'AWAITING_REQUESTER', worker: true, permissionsKnown: false })).toBe('Čeka da Marko potvrdi završetak.');
    expect(line({ state: 'CONFIRMED', change: { waits: true, mine: true } })).toBe('Čeka da Marko odgovori na tvoj predlog izmene.');
    expect(line({ state: 'AWAITING_REQUESTER', worker: true, change: { waits: true, mine: true } })).toBe('Čeka da Marko odgovori na tvoj predlog izmene.');
  });

  it('tells the one who asked for the work whose move it is while the work is under way, not that completion is "not available"', () => {
    // Nothing to press, and not a fault: the worker is to report the work done. Said only once the permissions were read, like the rest.
    expect(line({ state: 'CONFIRMED' })).toBe('Čeka da Marko javi da je zadatak gotov.');
    expect(line({ state: 'CONFIRMED', otherName: null })).toBe('Čeka da druga strana javi da je zadatak gotov.');
    expect(line({ state: 'CONFIRMED', otherName: 'Druga strana' })).toBe('Čeka da druga strana javi da je zadatak gotov.');
    expect(line({ state: 'CONFIRMED', permissionsKnown: false })).toBeNull();
  });

  it('says the permission is not there when the server denied it, to the side whose move it would be', () => {
    expect(line({ state: 'AWAITING_REQUESTER' })).toBe('Završetak trenutno nije dostupan.');
    expect(line({ state: 'CONFIRMED', worker: true })).toBe('Završetak trenutno nije dostupan.');
  });

  it('says a proposal waits when it cannot say whose it is, or when it is the other side\'s but not mine to answer', () => {
    expect(line({ change: { waits: true, mine: null } })).toBe('Predlog izmene čeka odgovor.');
    expect(line({ change: { waits: true, mine: false } })).toBe('Predlog izmene čeka odgovor.');
  });

  it('says the end of a Dogovor in words: finished or cancelled', () => {
    expect(line({ state: 'COMPLETED' })).toBe('Dogovor je završen.');
    expect(line({ state: 'CANCELLED' })).toBe('Dogovor je otkazan.');
    // A finished or cancelled Dogovor says it whether or not the permissions were read, and whatever a stale proposal says.
    expect(line({ state: 'COMPLETED', permissionsKnown: false, change: { waits: true, mine: true } })).toBe('Dogovor je završen.');
    expect(line({ state: 'CANCELLED', permissionsKnown: false })).toBe('Dogovor je otkazan.');
  });

  it('says nothing it cannot stand behind: unread permissions, or someone who is not a side of the Dogovor', () => {
    expect(line({ permissionsKnown: false })).toBeNull();
    expect(line({ party: false })).toBeNull();
    expect(line({ party: false, state: 'COMPLETED' })).toBeNull();
  });

  it('does not invent a name when the Dogovor does not carry one, and does not write the app\'s own stand-in as if it were a name', () => {
    expect(line({ otherName: undefined, change: { waits: true, mine: true } })).toBe('Čeka da druga strana odgovori na tvoj predlog izmene.');
    expect(line({ otherName: '   ', change: { waits: true, mine: true } })).toBe('Čeka da druga strana odgovori na tvoj predlog izmene.');
    // "Druga strana" is what the Dogovor reader puts where a name is missing; mid-sentence it is lower case.
    expect(line({ otherName: 'Druga strana', state: 'AWAITING_REQUESTER', worker: true })).toBe('Čeka da druga strana potvrdi završetak.');
  });

  it('writes a name as the subject of its sentence, never declined', () => {
    expect(line({ otherName: 'Jelena Nikolić', state: 'AWAITING_REQUESTER', worker: true })).toBe('Čeka da Jelena Nikolić potvrdi završetak.');
  });
});

describe('one pair of words for finishing the work', () => {
  const step = (patch: Partial<Parameters<typeof agreementNextStep>[0]> = {}) => agreementNextStep({ state: 'CONFIRMED', party: true, worker: true, change: none,
    ownRating: 'NOT_APPLICABLE', problemOpen: false, deadline: 'Do 18. sep · 12:00', ...patch });

  it('tells the worker to pick "Zadatak je gotov" - the button\'s own words - and promises no hours', () => {
    expect(step().body).toBe('Kada završiš, izaberi „Zadatak je gotov“. Druga strana tada potvrđuje završetak ili prijavljuje problem.');
    expect(step().body).not.toMatch(/\d+\s?h|označi završetak/);
  });

  it('tells the requester that the confirmation is theirs once the task is done', () => {
    expect(step({ worker: false }).body).toBe('Završetak potvrđuješ kada je zadatak obavljen.');
  });

  it('says the server\'s deadline, written for the person, and not a hard-coded one', () => {
    expect(step({ state: 'AWAITING_REQUESTER' }).body).toBe('Do 18. sep · 12:00. Bez odgovora se Dogovor zatvara sam.');
    expect(step({ state: 'AWAITING_REQUESTER', deadline: 'Rok trenutno nije dostupan' }).body).toBe('Rok trenutno nije dostupan. Bez odgovora se Dogovor zatvara sam.');
    expect(step({ state: 'AWAITING_REQUESTER', problemOpen: true }).body).toBe('Prijavljen je problem — automatski završetak je zaustavljen.');
  });

  it('never says "posao" in any state, for either side', () => {
    const states = ['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED', 'CANCELLED'] as const;
    for (const state of states) for (const worker of [true, false]) for (const ownRating of ['DUE', 'GIVEN', 'CLOSED', 'UNKNOWN', 'NOT_APPLICABLE'] as const) {
      for (const change of [none, { waits: true, mine: true }, { waits: true, mine: false }, { waits: true, mine: null }]) {
        const said = step({ state, worker, ownRating, change });
        expect(`${said.title} ${said.body ?? ''}`.toLowerCase()).not.toMatch(/\bposao\b|\bposla\b|\bposlu\b/);
      }
    }
    expect(RATING_WAITS_FOR_ME.toLowerCase()).not.toContain('posao');
    expect(agreementWaitsForMe({ state: 'AWAITING_REQUESTER', requester: true, change: none, ownRating: 'NOT_APPLICABLE' })).toBe('Završetak je označen i čeka tvoju potvrdu');
  });
});
