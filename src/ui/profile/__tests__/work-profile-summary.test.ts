import { workProfileSummary } from '../workProfileSummary';

/**
 * The ONE line under "Radni profil" on the profile (owner's phone, 8 Oct 2026): its state, its first skill (and how many more there are) and its
 * area. The area, the week and the equipment are not rows of the profile any more; this line says what matters about them.
 */
describe('what the work profile says about itself in one line', () => {
  it('is the state, the first skill with how many more, and the city with its radius', () => {
    expect(workProfileSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Novi Sad', radijusKm: 100 })).toBe('Aktivan · Moleraj · Novi Sad, 100 km');
    expect(workProfileSummary({ stanje: 'ACTIVE', vestine: ['Moleraj', 'Keramika', 'Parket'], grad: 'Novi Sad', radijusKm: 100 }))
      .toBe('Aktivan · Moleraj +2 · Novi Sad, 100 km');
    expect(workProfileSummary({ stanje: 'DRAFT', vestine: ['Selidbe', 'Nošenje'], grad: 'Beograd', radijusKm: 20 })).toBe('Nacrt · Selidbe +1 · Beograd, 20 km');
  });

  it('writes the city as a city is written, without changing what is stored', () => {
    expect(workProfileSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Novi sad', radijusKm: 100 })).toBe('Aktivan · Moleraj · Novi Sad, 100 km');
    expect(workProfileSummary({ stanje: 'ACTIVE', grad: 'NOVI SAD' })).toBe('Aktivan · Novi Sad');
  });

  it('says only what exists: no skills, no city, no radius are left out, never filled in', () => {
    expect(workProfileSummary({ stanje: 'DRAFT' })).toBe('Nacrt');
    expect(workProfileSummary({ stanje: 'DRAFT', vestine: [], grad: '   ', radijusKm: 20 })).toBe('Nacrt');
    expect(workProfileSummary({ stanje: 'ACTIVE', vestine: ['  ', 'Moleraj'], grad: 'Kula' })).toBe('Aktivan · Moleraj · Kula');
    expect(workProfileSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Kula', radijusKm: 0 })).toBe('Aktivan · Moleraj · Kula');
    expect(workProfileSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Kula', radijusKm: Number.NaN })).toBe('Aktivan · Moleraj · Kula');
  });

  it('clips one very long skill, and keeps the others in the work profile where the whole list is', () => {
    const long = 'Montaža i demontaža nameštaja po meri sa dostavom i ugradnjom';
    const line = workProfileSummary({ stanje: 'ACTIVE', vestine: [long, 'Selidbe'], grad: 'Novi Sad', radijusKm: 50 })!;
    expect(line.startsWith('Aktivan · Montaža i demontaža nameštaja po…')).toBe(true);
    expect(line.endsWith('+1 · Novi Sad, 50 km')).toBe(true);
  });

  it('says that no profile is not set up, what to do for a suspended one, and nothing for a state it does not know', () => {
    expect(workProfileSummary(null)).toBe('Još nije podešen');
    expect(workProfileSummary({ stanje: 'SUSPENDED', vestine: ['Moleraj'], grad: 'Novi Sad', radijusKm: 100 })).toBe('Suspendovan. Obrati se podršci.');
    expect(workProfileSummary({ stanje: null, vestine: ['Moleraj'], grad: 'Novi Sad' })).toBeUndefined();
    expect(workProfileSummary({ stanje: 'CLOSED' as never })).toBeUndefined();
  });

  it('has no grammatical gender of the person and no explanation of itself', () => {
    for (const profile of [{ stanje: 'ACTIVE' as const }, { stanje: 'DRAFT' as const }, { stanje: 'SUSPENDED' as const }, null]) {
      const line = workProfileSummary(profile) ?? '';
      expect(line).not.toMatch(/podesio|podešena|aktivna|zadaci ti se ne nude|ne možeš da se prijaviš/i);
    }
  });
});
