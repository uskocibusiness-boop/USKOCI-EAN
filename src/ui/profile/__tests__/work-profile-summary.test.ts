import { workProfileSummary } from '../workProfileSummary';
const onSiteSummary = (profile: Parameters<typeof workProfileSummary>[0]) => workProfileSummary(profile, { kind: 'confirmed', modes: ['ON_SITE'] });

/**
 * The ONE line under "Radni profil" on the profile (owner's phone, 8 Oct 2026): its state, its first skill (and how many more there are) and its
 * area. The area, the week and the equipment are not rows of the profile any more; this line says what matters about them.
 */
describe('what the work profile says about itself in one line', () => {
  it('is the state, the first skill with how many more, and the city with its radius', () => {
    expect(onSiteSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Novi Sad', radijusKm: 100 })).toBe('Aktivan · Moleraj · Dolazak: Novi Sad, do 100 km');
    expect(onSiteSummary({ stanje: 'ACTIVE', vestine: ['Moleraj', 'Keramika', 'Parket'], grad: 'Novi Sad', radijusKm: 100 }))
      .toBe('Aktivan · Moleraj +2 · Dolazak: Novi Sad, do 100 km');
    expect(onSiteSummary({ stanje: 'DRAFT', vestine: ['Selidbe', 'Nošenje'], grad: 'Beograd', radijusKm: 20 })).toBe('Nacrt · Selidbe +1 · Dolazak: Beograd, do 20 km');
  });

  it('writes the city as a city is written, without changing what is stored', () => {
    expect(onSiteSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Novi sad', radijusKm: 100 })).toBe('Aktivan · Moleraj · Dolazak: Novi Sad, do 100 km');
    expect(onSiteSummary({ stanje: 'ACTIVE', grad: 'NOVI SAD' })).toBe('Aktivan · Dolazak: Novi Sad');
  });

  it('says only what exists: no skills, no city, no radius are left out, never filled in', () => {
    expect(onSiteSummary({ stanje: 'DRAFT' })).toBe('Nacrt');
    expect(onSiteSummary({ stanje: 'DRAFT', vestine: [], grad: '   ', radijusKm: 20 })).toBe('Nacrt');
    expect(onSiteSummary({ stanje: 'ACTIVE', vestine: ['  ', 'Moleraj'], grad: 'Kula' })).toBe('Aktivan · Moleraj · Dolazak: Kula');
    expect(onSiteSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Kula', radijusKm: 0 })).toBe('Aktivan · Moleraj · Dolazak: Kula');
    expect(onSiteSummary({ stanje: 'ACTIVE', vestine: ['Moleraj'], grad: 'Kula', radijusKm: Number.NaN })).toBe('Aktivan · Moleraj · Dolazak: Kula');
  });

  it('clips one very long skill, and keeps the others in the work profile where the whole list is', () => {
    const long = 'Montaža i demontaža nameštaja po meri sa dostavom i ugradnjom';
    const line = onSiteSummary({ stanje: 'ACTIVE', vestine: [long, 'Selidbe'], grad: 'Novi Sad', radijusKm: 50 })!;
    expect(line.startsWith('Aktivan · Montaža i demontaža nameštaja po…')).toBe(true);
    expect(line.endsWith('+1 · Dolazak: Novi Sad, do 50 km')).toBe(true);
  });

  it('says that no profile is not set up, what to do for a suspended one, and nothing for a state it does not know', () => {
    expect(onSiteSummary(null)).toBe('Još nije podešen');
    expect(onSiteSummary({ stanje: 'SUSPENDED', vestine: ['Moleraj'], grad: 'Novi Sad', radijusKm: 100 })).toBe('Suspendovan. Obrati se podršci.');
    expect(onSiteSummary({ stanje: null, vestine: ['Moleraj'], grad: 'Novi Sad' })).toBeUndefined();
    expect(onSiteSummary({ stanje: 'CLOSED' as never })).toBeUndefined();
  });

  it('has no grammatical gender of the person and no explanation of itself', () => {
    for (const profile of [{ stanje: 'ACTIVE' as const }, { stanje: 'DRAFT' as const }, { stanje: 'SUSPENDED' as const }, null]) {
      const line = onSiteSummary(profile) ?? '';
      expect(line).not.toMatch(/podesio|podešena|aktivna|zadaci ti se ne nude|ne možeš da se prijaviš/i);
    }
  });
});


it('uses confirmed mode only, without deriving remote or on-site work from skills/city', () => {
  const profile = { stanje: 'ACTIVE' as const, vestine: ['3D štampa'], grad: 'Novi Sad', radijusKm: 15 };
  expect(workProfileSummary(profile, { kind: 'confirmed', modes: ['REMOTE'] })).toBe('Aktivan · 3D štampa · Na daljinu');
  expect(workProfileSummary(profile, { kind: 'confirmed', modes: ['ON_SITE', 'REMOTE'] })).toBe('Aktivan · 3D štampa · Na daljinu · Dolazak: Novi Sad, do 15 km');
  for (const kind of ['loading', 'unavailable', 'unconfirmed'] as const) {
    expect(workProfileSummary(profile, { kind })).toBe('Aktivan · 3D štampa');
  }
  expect(workProfileSummary(profile)).toBe('Aktivan · 3D štampa');
});
