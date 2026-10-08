import type { NeedLocationInput } from '../../../contracts/location';
import type { NeedFactV2Key, NeedTaskGeography } from '../../../contracts/needFactsV2';
import type { JavniProfilProjekcija } from '../../../contracts/projections';
import { needScheduleText } from '../../../data/needDetailPresentation';
import { SCHEDULE_NOT_SET, previewPerson, reviewAsTask, type ReviewSource } from '../reviewAsTask';

/**
 * The task of a review as the people who will read it get it (owner, 8 Oct 2026: "on vidi kako će drugi videti taj zadatak"). The real card and
 * the real page are drawn from this projection, so what matters is that it says exactly what the published task will say, and nothing it does
 * not know: no private fact, no value a fact does not carry, no amount under "Ponude".
 */
type Fact = ReviewSource['publicProjection'][number];
const fact = (key: NeedFactV2Key, value: unknown, extra: Partial<Fact> = {}): Fact => ({ key, value, privacyClass: 'PUBLIC', status: 'CONFIRMED', ...extra });
const review = (facts: Fact[], patch: Partial<ReviewSource> = {}): ReviewSource => ({ reviewId: 'review-1', draftId: null, responseDeadline: null, location: null,
  publicProjection: facts, ...patch });
const STATIONARY: NeedTaskGeography = { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Detelinara', label: 'Lenke Dunđerski' } };
const placed = (geography: NeedTaskGeography, points: { slot: 'start' | 'end' | 'serviceArea'; latitudeE6: number; longitudeE6: number }[],
  exactAddress: string | null = 'Bulevar Evrope 24, stan 7'): NeedLocationInput => ({ taskCountryCode: 'RS', geography, exactAddress, accessNotes: 'Interfon 7',
  resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress }, points: points.map(point => ({ ...point, origin: { kind: 'MANUAL_PIN' as const } })) } });
const FULL: Fact[] = [
  fact('need.title', 'Čišćenje stana'), fact('need.description', 'Stan od 60 m² posle renoviranja.'), fact('need.category', 'Čišćenje'),
  fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 4500), fact('need.price_basis', 'TOTAL'), fact('need.people_needed', 2),
  fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-10-11T07:00:00.000Z'), fact('need.ends_at', '2026-10-11T11:00:00.000Z'),
  fact('need.task_geography', STATIONARY), fact('need.task_country_code', 'RS'), fact('need.required_skills', ['Čišćenje prozora']),
  fact('need.required_tools', ['Usisivač']), fact('need.required_vehicles', []), fact('need.required_licenses', []),
  fact('need.critical_conditions', ['Bez kućnih ljubimaca']), fact('need.minimum_experience_years', 2), fact('need.verified_identity_required', false),
];

describe('a complete review', () => {
  const task = reviewAsTask(review(FULL, { location: placed(STATIONARY, [{ slot: 'start', latitudeE6: 45251234, longitudeE6: 19835000 }]) }));

  it('is the projection of a public task, in the words the published task is drawn in', () => {
    expect(task).toMatchObject({ id: 'review-1', naslov: 'Čišćenje stana', opis: 'Stan od 60 m² posle renoviranja.', statusTekst: 'Traži ponude',
      rokZaPrijaveIso: null, taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade', rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL' });
    // The server writes the area, then the city, with the one `podrucjeTekst`; the street the owner typed (the label) is no part of it.
    expect(task.podrucjeTekst).toBe('Detelinara, Novi Sad');
    expect(task.ponudjenaCena).toEqual({ iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' });
    expect(task.pokrivenost).toEqual({ ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 });
    // The time is the card's own: the task's schedule in its zone, with the zone named on a phone that is not in it (jest runs in UTC).
    expect(task.schedule).toEqual({ kind: 'FIXED_WINDOW', startsAt: '2026-10-11T07:00:00.000Z', endsAt: '2026-10-11T11:00:00.000Z' });
    expect(task.vremeTekst).toBe(needScheduleText(task.schedule!, 'Europe/Belgrade'));
    expect(task.vremeTekst).toMatch(/^11\. okt( \d{4})? · 09:00–13:00 \(po vremenu u Srbiji\)$/);
  });

  it('carries what the task asks of a person, as the detail reads it', () => {
    expect(task.detalji).toEqual({ kategorija: 'Čišćenje', geografija: STATIONARY, rezimLokacije: 'STATIONARY',
      zahtevi: { vestine: ['Čišćenje prozora'], alati: ['Usisivač'], vozila: [], dozvole: [], bitniUslovi: ['Bez kućnih ljubimaca'], iskustvoGodina: 2, potvrdjenIdentitet: false } });
    expect(task.uslovi).toEqual(['Čišćenje prozora', 'Usisivač']);
  });

  it('shows the approximate point a stranger gets (two decimals), and nothing of the exact one', () => {
    expect(task.priblizno).toEqual({ lat: 45.25, lng: 19.84 });
    const text = JSON.stringify(task);
    for (const secret of ['Bulevar Evrope', 'stan 7', 'Interfon', '45.251234', '19.835', '45251234']) expect(text).not.toContain(secret);
  });
});

describe('what a fact does not carry is not drawn', () => {
  it('a review with nothing says nothing: no title, no description, no term, no place, no price', () => {
    const task = reviewAsTask(review([]));
    expect(task.naslov).toBe(''); expect('opis' in task).toBe(false);
    expect(task.schedule).toBeUndefined(); expect(task.vremeTekst).toBe(SCHEDULE_NOT_SET);
    expect(task.podrucjeTekst).toBe('Lokacija nije navedena'); expect(task.priblizno).toBeNull();
    expect(task.rezimCene).toBeUndefined(); expect(task.ponudjenaCena).toBeUndefined(); expect(task.osnovaCene).toBeNull();
    expect(task.pokrivenost.ukupno).toBe(1); expect(task.detalji?.geografija).toBeNull(); expect(task.detalji?.zahtevi.bitniUslovi).toBeNull();
  });

  it('a fact the review marks UNKNOWN, and a private fact, are not values', () => {
    const task = reviewAsTask(review([fact('need.title', 'Skriveno', { status: 'UNKNOWN' }), fact('need.exact_address', 'Privatna 42', { privacyClass: 'PRIVATE' }),
      fact('need.description', 'Opis', { privacyClass: 'PRIVATE' })]));
    expect(task.naslov).toBe(''); expect('opis' in task).toBe(false);
    expect(JSON.stringify(task)).not.toContain('Privatna 42');
  });

  it('a malformed value is no value: a title that is not text, an amount that is not whole, a term that is not a moment', () => {
    const task = reviewAsTask(review([fact('need.title', 42), fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 12.5), fact('need.schedule_kind', 'FIXED_WINDOW'),
      fact('need.starts_at', 'sutra ujutru'), fact('need.people_needed', 0)]));
    expect(task.naslov).toBe(''); expect(task.ponudjenaCena).toBeUndefined();
    expect(task.schedule).toEqual({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: null }); expect(task.vremeTekst).toBe('Tačan termin nije potpun');
    expect(task.pokrivenost.ukupno).toBe(1);
  });

  it('a fixed term with only one end says which end, as the published card does', () => {
    const task = reviewAsTask(review([fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-10-11T07:00:00.000Z')]));
    expect(task.vremeTekst).toMatch(/^Od 11\. okt( \d{4})? · 09:00 \(po vremenu u Srbiji\)$/);
  });

  it('a flexible term is its word, with no clock', () => {
    expect(reviewAsTask(review([fact('need.schedule_kind', 'FLEXIBLE')])).vremeTekst).toBe('Fleksibilno');
    expect(reviewAsTask(review([fact('need.schedule_kind', 'TOMORROW_FLEXIBLE')])).vremeTekst).toBe('Sutra, fleksibilno');
  });
});

describe('the price', () => {
  it('"Ponude" has no amount, even when one is left from before', () => {
    const task = reviewAsTask(review([fact('need.price_mode', 'OFFERS'), fact('need.price_rsd', 1500)]));
    expect(task.rezimCene).toBe('OFFERS'); expect(task.ponudjenaCena).toBeUndefined();
  });
  it('"Moja cena" without an amount shows no amount (never "0 RSD")', () => {
    const task = reviewAsTask(review([fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', null)]));
    expect(task.rezimCene).toBe('MY_PRICE'); expect(task.ponudjenaCena).toBeUndefined();
  });
  it('a retired price mode is no price mode', () => {
    expect(reviewAsTask(review([fact('need.price_mode', 'FASTEST'), fact('need.price_rsd', 1500)])).rezimCene).toBeUndefined();
  });
  it('says what the amount is for only when the task says it', () => {
    expect(reviewAsTask(review([fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 3000), fact('need.price_basis', 'PER_PERSON')])).osnovaCene).toBe('PER_PERSON');
    expect(reviewAsTask(review([fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 3000)])).osnovaCene).toBeNull();
  });
});

describe('the place', () => {
  it('remote work says so, has no area and no point', () => {
    const task = reviewAsTask(review([fact('need.task_geography', { mode: 'REMOTE' })], { location: placed({ mode: 'REMOTE' }, []) }));
    expect(task.podrucjeTekst).toBe('Na daljinu'); expect(task.detalji?.rezimLokacije).toBe('REMOTE'); expect(task.priblizno).toBeNull();
  });
  it('a route keeps its stops, and the area is the start\'s', () => {
    const geography: NeedTaskGeography = { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', area: 'Liman' }, end: { city: 'Beograd', area: 'Vračar' } };
    const task = reviewAsTask(review([fact('need.task_geography', geography)]));
    expect(task.detalji?.geografija).toEqual(geography); expect(task.podrucjeTekst).toBe('Liman, Novi Sad');
  });
  it('the service area stands in for a start that has none, as the server does', () => {
    const geography: NeedTaskGeography = { mode: 'AREA_BASED', serviceArea: { city: 'Beograd', area: 'Zemun' } };
    expect(reviewAsTask(review([fact('need.task_geography', geography)])).podrucjeTekst).toBe('Zemun, Beograd');
  });
  it('a topology that is not one is no place', () => {
    expect(reviewAsTask(review([fact('need.task_geography', { mode: 'STATIONARY' })])).podrucjeTekst).toBe('Lokacija nije navedena');
  });
});

describe('the deadline and the id', () => {
  it('carries the review\'s own deadline: null is "no cutoff"', () => {
    expect(reviewAsTask(review([], { responseDeadline: '2026-10-12T10:15:00.000Z' })).rokZaPrijaveIso).toBe('2026-10-12T10:15:00.000Z');
    expect(reviewAsTask(review([])).rokZaPrijaveIso).toBeNull();
  });
  it('a review bound to a task is that task; a new one is its review', () => {
    expect(reviewAsTask(review([], { draftId: 'need-9' })).id).toBe('need-9');
    expect(reviewAsTask(review([])).id).toBe('review-1');
  });
});

describe('who asks', () => {
  it('is nobody until the public profile is read: no name, no rating, no face', () => {
    const task = reviewAsTask(review([fact('need.title', 'Prenos ormara')]));
    expect(task).toMatchObject({ narucilacProfilId: '', narucilacIme: '', narucilacOcena: null });
    expect('narucilacBrojOcena' in task).toBe(false); expect('narucilacAvatarId' in task).toBe(false);
  });
  it('is the owner as the others read him', () => {
    const task = reviewAsTask(review([]), { profileId: 'profile-1', name: 'Miloš', rating: '4,7', reviewCount: 3, avatarId: 'asset-1' });
    expect(task).toMatchObject({ narucilacProfilId: 'profile-1', narucilacIme: 'Miloš', narucilacOcena: '4,7', narucilacBrojOcena: 3, narucilacAvatarId: 'asset-1' });
  });
});

describe('previewPerson', () => {
  const profile = (patch: Partial<JavniProfilProjekcija['poverenje']> = {}, ime: string | null = 'Miloš P.'): JavniProfilProjekcija => ({ profilId: 'profile-1', uloga: 'narucilac', ime,
    avatarPutanja: null, grad: null, naslov: null, biografija: null,
    poverenje: { ocenaProsek: 4.7, brojRecenzija: 3, zavrseniBroj: 5, identitetVerifikovan: false, ocenaDostupna: true, recenzijeDostupne: true,
      verifikacijaIdentitetaDostupna: false, ...patch } });
  it('takes the name others read, the rating with one decimal and the reviews it stands on', () => {
    expect(previewPerson('profile-1', 'Milos', profile())).toEqual({ profileId: 'profile-1', name: 'Miloš P.', rating: '4,7', reviewCount: 3 });
  });
  it('draws a rating only when the server marks it available, and a count only when it discloses reviews', () => {
    expect(previewPerson('p', 'Milos', profile({ ocenaDostupna: false }))).toMatchObject({ rating: null, reviewCount: 3 });
    expect(previewPerson('p', 'Milos', profile({ recenzijeDostupne: false }))).toMatchObject({ rating: '4,7', reviewCount: null });
    expect(previewPerson('p', 'Milos', profile({ ocenaProsek: null, brojRecenzija: 0 }))).toMatchObject({ rating: null, reviewCount: 0 });
  });
  it('falls back to the name of the account when the public read failed or has no name', () => {
    expect(previewPerson('p', '  Milos  ', null)).toEqual({ profileId: 'p', name: 'Milos', rating: null, reviewCount: null });
    expect(previewPerson('p', 'Milos', profile({}, '  '))).toMatchObject({ name: 'Milos' });
  });
});
