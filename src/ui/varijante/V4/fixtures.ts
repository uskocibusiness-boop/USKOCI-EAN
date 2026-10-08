import type { DogovorProjekcija, JavniProfilProjekcija, UcesnikProjekcija } from '../../../contracts/projections';
import type { ReviewTag } from '../../../data/reviewsClientService';
import type { MyWorkStats, PublicWorkTrust } from '../../../data/workTrustClientService';
import type { ReviewPerson } from '../../reviews/AgreementReviewPresentation';

/**
 * The FAKE data every V4 scene draws (the lab reads nothing). Modelled on the Dogovori and profile galleries, with one fixed "now"
 * so the day groups ("Danas", "Sutra", "Ove nedelje") read the same whenever the lab runs: Wednesday 8 October 2026, 09:00 in
 * Serbian time. Every instant below is written in UTC (Belgrade is UTC+2 in October), the way the server writes them.
 */
export const NOW = new Date('2026-10-08T07:00:00Z');

export const ME: UcesnikProjekcija = { id: 'ja', profilId: null, ime: 'Ana Petrović', inicijali: 'AP', uloga: 'narucilac', mesta: null, viSte: true, telefon: null };
export const ME_WORKER: UcesnikProjekcija = { ...ME, uloga: 'uskocer', mesta: 1 };
/** My first name, as the app would read it from my own profile; the saved rating of variant B thanks me by it. */
export const MY_FIRST_NAME = ME.ime.split(' ')[0];
const worker = (ime: string, inicijali: string, mesta = 1): UcesnikProjekcija =>
  ({ id: `druga-${inicijali}`, profilId: null, ime, inicijali, uloga: 'uskocer', mesta, viSte: false, telefon: null });
const requester = (ime: string, inicijali: string): UcesnikProjekcija =>
  ({ id: `druga-${inicijali}`, profilId: null, ime, inicijali, uloga: 'narucilac', mesta: null, viSte: false, telefon: null });
const money = (iznos: number) => ({ iznos, valuta: 'RSD', prikaz: `${iznos.toLocaleString('sr-Latn-RS')} RSD` });
const termin = (pocetak: string, kraj: string) => ({ prihvacenPocetak: pocetak, pocinje: pocetak, tacanTermin: { pocetak, kraj } });

export function agreement(id: string, patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija {
  return { id, verzija: 1, naslov: 'Prenos ormana do kombija', stanje: 'CONFIRMED', cena: money(5500),
    vremeTekst: '8. okt · 14:00–16:00', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
    ucesnici: [ME, worker('Marko Jovanović', 'MJ')], rezim: 'FIZICKI',
    kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
    chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null,
    izmenaCeka: null, izvor: { zadatakId: 'zadatak', prijavaId: 'prijava' }, ...termin('2026-10-08T12:00:00Z', '2026-10-08T14:00:00Z'), ...patch };
}

/** The work is reported done; the confirmation is mine (the orange "Potvrdi završetak"). */
export const POTVRDA = agreement('potvrda', { stanje: 'AWAITING_REQUESTER', naslov: 'Montaža police u hodniku', cena: money(2000),
  vremeTekst: '7. okt · 09:00–11:00', putanjaTekst: 'Grbavica, Novi Sad', rokPotvrdeIso: '2026-10-09T07:00:00Z',
  ucesnici: [ME, worker('Stefan Ilić', 'SI')], ...termin('2026-10-07T07:00:00Z', '2026-10-07T09:00:00Z'),
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null },
  hronologija: [{ vremeTekst: '3. okt · 18:12', tekst: 'Dogovor je sklopljen.' }] });
export const DANAS = agreement('danas');
export const SUTRA = agreement('sutra', { naslov: 'Košenje trave u dvorištu', cena: money(3000), vremeTekst: '9. okt · 08:00–12:00',
  putanjaTekst: 'Sremska Kamenica', ucesnici: [ME_WORKER, requester('Jelena Nikolić', 'JN')], ...termin('2026-10-09T06:00:00Z', '2026-10-09T10:00:00Z') });
export const NEDELJA = agreement('nedelja', { naslov: 'Prevod uputstva na engleski', rezim: 'DALJINSKI', putanjaTekst: '', cena: money(6500),
  vremeTekst: '11. okt · 10:00–12:00', pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 },
  ucesnici: [ME, worker('Nikola Marković', 'NM', 2)], ...termin('2026-10-11T08:00:00Z', '2026-10-11T10:00:00Z') });
export const OCENA = agreement('ocena', { stanje: 'COMPLETED', ocenaMoguca: true, stanjeProvereOcene: 'DUE', naslov: 'Pomoć pri selidbi',
  vremeTekst: '4. okt · 10:00–14:00', chatDostupan: false, ucesnici: [ME_WORKER, requester('Milica Stojanović', 'MS')],
  ...termin('2026-10-04T08:00:00Z', '2026-10-04T12:00:00Z') });
export const BEZ_TERMINA = agreement('bez-termina', { naslov: 'Pomoć oko računara', cena: money(1500), vremeTekst: 'Termin nije dogovoren',
  putanjaTekst: 'Podbara, Novi Sad', prihvacenPocetak: null, pocinje: null, tacanTermin: null });
/** The active Dogovori as the list reads them: two that wait for me, one today, one tomorrow, one this week, one with no term. */
export const LIST: DogovorProjekcija[] = [DANAS, POTVRDA, SUTRA, NEDELJA, OCENA, BEZ_TERMINA];

const LONG_TITLE = 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza';
const LONG_NAME = 'Aleksandra Konstantinović-Radovanović';
export const DUGO = agreement('dugo', { naslov: LONG_TITLE, vremeTekst: '8. okt · 22:00 – 9. okt · 06:00 (po vremenu u Srbiji)',
  putanjaTekst: 'Petrovaradinska tvrđava, Petrovaradin, Novi Sad', cena: money(125000), verzija: 2,
  ucesnici: [ME, worker(LONG_NAME, 'AK', 4)], pokrivenost: { ukupno: 4, popunjeno: 4, preostalo: 0, udeo: 1 },
  ...termin('2026-10-08T20:00:00Z', '2026-10-09T04:00:00Z'),
  prihvacenObim: 'Trosed i dve fotelje se iznose sa trećeg sprata bez lifta, pakuju u ćebad i tovare u kombi ispred ulaza. Ključ od podruma donosi Ana.',
  hronologija: [{ vremeTekst: '1. okt · 09:40', tekst: 'Dogovor je sklopljen.' }, { vremeTekst: '5. okt · 17:05', tekst: 'Uslovi su izmenjeni.' }] });
export const DUGO_POTVRDA = agreement('dugo-potvrda', { ...DUGO, id: 'dugo-potvrda', stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-10-10T20:00:00Z',
  naslov: 'Sklapanje garderobera od tri krila sa kliznim vratima i ogledalom u spavaćoj sobi', cena: money(18500),
  ...termin('2026-10-06T07:00:00Z', '2026-10-06T13:00:00Z'), vremeTekst: '6. okt · 09:00–15:00' });
/** The loaded list: long titles, a long name, four people, a changed version, a scope and a window across midnight. */
export const LIST_DUGO: DogovorProjekcija[] = [DUGO_POTVRDA, DUGO, SUTRA, OCENA];

/** The detail in its three phases: the confirmation is mine; the work is agreed and the next move is the other side's; confirmed just now. */
export const DETALJ_CEKA = POTVRDA;
export const DETALJ_DOGOVOREN = DANAS;
export const DETALJ_POTVRDJEN: DogovorProjekcija = { ...POTVRDA, stanje: 'COMPLETED', ocenaMoguca: true, stanjeProvereOcene: 'DUE', rokPotvrdeIso: null,
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null },
  hronologija: [...POTVRDA.hronologija, { vremeTekst: '8. okt · 09:00', tekst: 'Završetak je potvrđen.' }] };
export const DETALJ_DUGO = DUGO_POTVRDA;
export const DETALJ_BEZ_TERMINA = BEZ_TERMINA;

/* --------------------------------------------------------------------------------------------------------- the rating */
export const REVIEW_CATALOG = { maxTags: 3, tags: ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] as ReviewTag[] };
export const REVIEW_PERSON: ReviewPerson = { name: 'Marko Jovanović', initials: 'MJ', profileId: null, role: 'Uskače na tvoj zadatak', task: 'Prenos ormana do kombija' };
export const REVIEW_PERSON_DUGO: ReviewPerson = { name: LONG_NAME, initials: 'AK', profileId: null, role: 'Uskače na tvoj zadatak', task: LONG_TITLE };
export const SAVED_TAGS: ReviewTag[] = ['ON_TIME', 'RELIABLE'];

/* -------------------------------------------------------------------------------------------------------- the profile */
export const STATS: MyWorkStats = { hasWorkerProfile: true, profileId: 'lab-profil', profileStatus: 'ACTIVE', applicationsSent: 14, agreementsMade: 12,
  agreementsCompleted: 9, agreementsActive: 1, cancelledByMe: 1, cancelledByRequester: 1, cancelledSideUnknown: 0, reliabilityPercent: 90,
  reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-10-01', asOf: '2026-10-08T09:00:00+00:00' };
export const STATS_NOV: MyWorkStats = { ...STATS, applicationsSent: 1, agreementsMade: 0, agreementsCompleted: 0, agreementsActive: 0, cancelledByMe: 0,
  cancelledByRequester: 0, reliabilityPercent: null, reliabilityState: 'TOO_FEW', profileStatus: 'DRAFT' };
/** What the reputation read answers for my account. */
export const RATED = { accountId: 'lab', reviewCount: 12, averageRating: 4.8, state: 'RATED', authoritative: true };
export const UNRATED = { accountId: 'lab', reviewCount: 0, averageRating: null, state: 'NO_REVIEWS', authoritative: true };
export const PROFILE_ME = { name: 'Ana Petrović', initials: 'AP', place: 'Novi Sad', email: 'ana.petrovic@example.com' };
export const PROFILE_DUGO = { name: LONG_NAME, initials: 'AK', place: 'Sremska Kamenica, Novi Sad', email: 'aleksandra.konstantinovic.radovanovic@example.com' };

export const PUBLIC: JavniProfilProjekcija = { profilId: 'lab-radnik', uloga: 'uskocer', ime: 'Marko Marić', avatarPutanja: null, grad: 'Novi Sad',
  naslov: 'Selidbe i montaža nameštaja', biografija: 'Radim sa bratom, imamo kombi i trake. Dolazimo tačno.',
  poverenje: { ocenaProsek: 4.8, brojRecenzija: 12, zavrseniBroj: 14, identitetVerifikovan: true, ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: true } };
export const PUBLIC_NOV: JavniProfilProjekcija = { ...PUBLIC, profilId: 'lab-nov', ime: 'Jovan Perić', naslov: null, biografija: null,
  poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 3, identitetVerifikovan: false, ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: true } };
export const PUBLIC_DUGO: JavniProfilProjekcija = { ...PUBLIC, profilId: 'lab-dugo', ime: LONG_NAME, naslov: 'Selidbe stanova i kancelarija sa pakovanjem i montažom nameštaja po meri' };
export const TRUST: PublicWorkTrust = { profileId: 'lab-radnik', self: false, visibility: 'PUBLIC', completedCount: 14, agreedCount: 16, reliabilityPercent: 88,
  reliabilityState: 'AVAILABLE', reliabilityMinimum: 5, memberSince: '2026-03-01' };
export const TRUST_NOV: PublicWorkTrust = { ...TRUST, profileId: 'lab-nov', completedCount: 3, agreedCount: 4, reliabilityPercent: null, reliabilityState: 'TOO_FEW', memberSince: '2026-09-01' };
