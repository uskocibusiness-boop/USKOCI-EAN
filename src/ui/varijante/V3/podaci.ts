import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija, PrilikaProjekcija } from '../../../contracts/projections';
import type { ConversationMessage } from '../../aiFirst/AiConversationShell';
import type { Summary } from '../../v2/draftSummary';
import { candidateRatingFigure } from '../../v2/ApplicationSelectionPresentation';
import { candidateHas, candidateStatus, candidateTime, candidateValue } from '../../v2/CandidateFace';

/**
 * Lažni podaci laboratorije za grupu V3 (Kandidati + „Dogovoreno!“, AI razgovor + nacrt + „Objavljeno“, Prijava poslata).
 * Ništa se ne čita i ne piše; brojevi, imena i termini su primeri iste vrste kao u `dizajn-kandidati`, `dizajn-ai` i
 * `dizajn-prijava-forma`. Svaka „činjenica“ na ekranu dolazi odavde, nijedna se ne računa izmišljanjem (razlog uz prijavu
 * je merljiv iz ovih polja, vidi `razlogPrijave`).
 */

/* ------------------------------------------------------------------------------------------------ zadatak i ljudi */

export const ZADATAK = { id: 'var-v3-zadatak', revizija: 3, naslov: 'Unos ormara na treći sprat', podrucjeTekst: 'Liman 2, Novi Sad',
  vremeTekst: '26. sep · 10:00–12:00', stanje: 'CEKA_PRIJAVE', pokrivenost: { ukupno: 3, popunjeno: 0, preostalo: 3, udeo: 0 },
  rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined, taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:00:00Z' },
  uslovi: [], brojPrijava: 3, brojPrijavaZaIzbor: 2 } as unknown as PotrebaProjekcija;

export const ZADATAK_DUG = { ...ZADATAK, naslov: 'Pomoć oko selidbe dvosobnog stana sa trećeg sprata bez lifta, uz rasklapanje ormara i kreveta',
  podrucjeTekst: 'Lenke Dunđerski, Novi Sad → Dositejeva, Novi Sad', vremeTekst: 'Fleksibilan raspon · 26. okt – 30. okt',
  schedule: { kind: 'FLEXIBLE', startsAt: '2026-10-26T00:00:00Z', endsAt: '2026-10-30T22:00:00Z' },
  pokrivenost: { ukupno: 4, popunjeno: 1, preostalo: 3, udeo: 0.25 } } as unknown as PotrebaProjekcija;

export const prilika = (need: PotrebaProjekcija) => ({ ...need, primaNovePrijave: true, rokZaPrijaveIso: null }) as unknown as PrilikaProjekcija;

/** Osoba koja je objavila zadatak (primer; u aplikaciji dolazi iz naloga). Lice „ti“ u trenutku „Dogovoreno!“ i red „poslato · …“ u prijavi. */
export const VLASNIK = { ime: 'Marija Ilić', inicijali: 'MI' };

const dokaz = (patch: Partial<KandidatProjekcija['dokazPrijave']> = {}): KandidatProjekcija['dokazPrijave'] => ({ sema: 'APPLICATION_V1_SELF_DECLARED',
  kapacitetTima: 2, vestine: [], alati: ['Trake za nošenje'], vozila: ['Kombi'], licence: [], ...patch });
const kandidat = (patch: Partial<KandidatProjekcija>): KandidatProjekcija => ({ prijavaId: 'var-1', radnikProfilId: 'var-profil-1', potrebaRevizija: 3,
  verzija: 1, hash: 'a'.repeat(64), ime: 'Milan Petrović', inicijali: 'MP', ocenaTekst: '4,8', recenzijeTekst: '11 ocena',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3, dolazakTekst: '', prevozTekst: '',
  napomena: 'Dolazimo nas dvojica sa trakama. Kombi može da stane ispred ulaza, ormar nosimo rasklopljen.', stanje: 'SELECTABLE', mozeIzabrati: true,
  predlozeniPocetak: '2026-09-26T08:00:00Z', predlozeniKraj: '2026-09-26T10:00:00Z', dokazPrijave: dokaz(), razlogPreporuke: null, ...patch });

/** Tri prijave: jedna sa kombijem i predlogom termina, jedna najjeftinija bez ocene, jedna sa najvišom ocenom čiji zadatak je izmenjen. */
export const KANDIDATI: KandidatProjekcija[] = [kandidat({}),
  kandidat({ prijavaId: 'var-2', radnikProfilId: 'var-profil-2', ime: 'Ana Jovanović', inicijali: 'AJ', ocenaTekst: '—', recenzijeTekst: '3 završena zadatka',
    cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' }, pokrivaMesta: 1, napomena: 'Mogu sama, imam iskustva sa ormarima.', predlozeniPocetak: null, predlozeniKraj: null,
    dokazPrijave: dokaz({ vozila: [], alati: [] }) }),
  kandidat({ prijavaId: 'var-3', radnikProfilId: 'var-profil-3', ime: 'Nikola Ilić', inicijali: 'NI', ocenaTekst: '5', recenzijeTekst: '2 ocene',
    cena: { iznos: 5200, valuta: 'RSD', prikaz: '5.200 RSD' }, stanje: 'STALE', mozeIzabrati: false, napomena: 'Mogu i posle 16h.' })];

/** Opterećeno stanje: duga imena, velik iznos, duga poruka, prijava bez ikakvih podataka o opremi. */
export const KANDIDATI_DUGO: KandidatProjekcija[] = [
  kandidat({ prijavaId: 'var-4', ime: 'Aleksandra Stefanović-Radosavljević', inicijali: 'AS', recenzijeTekst: '128 ocena',
    cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' }, pokrivaMesta: 3,
    napomena: 'Imamo iskustva sa selidbama stanova i kancelarija, donosimo sav alat, ćebad za zaštitu nameštaja i folije za pod. Klavir nosimo sa posebnim kaiševima.' }),
  kandidat({ prijavaId: 'var-5', radnikProfilId: 'var-profil-5', ime: 'Konstantin Dimitrijević Mladenović', inicijali: 'KD', ocenaTekst: '—', recenzijeTekst: '',
    cena: { iznos: 18500, valuta: 'RSD', prikaz: '18.500 RSD' }, pokrivaMesta: 1, predlozeniPocetak: '2026-09-26T20:00:00Z', predlozeniKraj: '2026-09-27T06:30:00Z',
    dokazPrijave: dokaz({ vozila: ['Kamion sa rampom'], alati: ['Kolica', 'Kaiševi', 'Ćebad'] }) }),
  kandidat({ prijavaId: 'var-6', radnikProfilId: 'var-profil-6', ime: 'Ime nije dostupno', inicijali: '', ocenaTekst: '—', recenzijeTekst: '0 ocena',
    stanje: 'OVERFILL', mozeIzabrati: false, pokrivaMesta: 4, napomena: '',
    dokazPrijave: { sema: 'LEGACY_UNPROVEN', kapacitetTima: null, vestine: null, alati: null, vozila: null, licence: null } })];

export const PROFIL = { profilId: 'var-profil-1', uloga: 'radnik', ime: 'Milan Petrović', avatarPutanja: null, grad: 'Novi Sad',
  naslov: 'Selidbe i nošenje tereta', biografija: 'Radim sa bratom, imamo kombi i trake. Dolazimo tačno.',
  poverenje: { ocenaProsek: 4.8, brojRecenzija: 11, zavrseniBroj: 14, identitetVerifikovan: true, ocenaDostupna: true, recenzijeDostupne: true,
    verifikacijaIdentitetaDostupna: true } } as unknown as JavniProfilProjekcija;

/* ------------------------------------------------------------------------------------------------ razlog uz prijavu (merljiv) */

export type Razlog = { text: string; tone: 'muted' | 'warn' | 'green' };

/** Najniži iznos i najviša ocena među prijavama koje se mogu izabrati: dve mere koje lista zna bez servera. */
function mere(list: readonly KandidatProjekcija[]) {
  const birljive = list.filter(k => k.stanje === 'SELECTABLE' && candidateValue(k).kind === 'amount');
  const najniza = birljive.length ? Math.min(...birljive.map(k => k.cena.iznos)) : null;
  const ocene = list.map(k => ({ k, figure: candidateRatingFigure(k) })).filter(entry => entry.figure && entry.figure.count > 0);
  const najvisa = ocene.length ? Math.max(...ocene.map(entry => entry.figure!.rating)) : null;
  return { najniza, najvisa };
}

/**
 * Jedna oznaka razloga umesto čipa „Poslata“ (R1 R-15, pravac B5): svaka prijava u ovoj listi je poslata, pa to ne piše; piše ono
 * što se MERI i razlikuje je od drugih. Redom: razlog zašto se ne može izabrati (uvek, upozorenje) · najniža cena · najviša ocena ·
 * vozilo koje osoba ima · dolazi u terminu zadatka. Kad ništa od toga ne važi, nema oznake: nikad „Najbolji“, nikad izmišljeno.
 */
export function razlogPrijave(k: KandidatProjekcija, list: readonly KandidatProjekcija[], timezone?: string | null): Razlog | null {
  const stanje = candidateStatus(k);
  if (stanje) return { text: stanje.text, tone: stanje.tone };
  const { najniza, najvisa } = mere(list);
  const value = candidateValue(k), figure = candidateRatingFigure(k);
  if (najniza !== null && value.kind === 'amount' && k.cena.iznos === najniza && list.filter(o => o.stanje === 'SELECTABLE').length > 1) return { text: 'Najniža cena', tone: 'green' };
  if (najvisa !== null && figure && figure.count > 0 && figure.rating === najvisa && list.length > 1) return { text: 'Najviša ocena', tone: 'green' };
  // Vozilo i alat već stoje u redu „Ima“ kartice, pa nisu razlog; termin zadatka bez predloga jeste merljiva razlika.
  if (candidateTime(k, timezone) === null) return { text: 'Dolazi u terminu zadatka', tone: 'muted' };
  return null;
}

/** Iznos je broj 700 tabular, a valuta ide u `meta` (pravac B5): „4.500 RSD“ → ['4.500', 'RSD']. Bez valute: drugi deo prazan. */
export function razdvojIznos(amount: string): [string, string] {
  const at = amount.lastIndexOf(' ');
  return at > 0 ? [amount.slice(0, at), amount.slice(at + 1)] : [amount, ''];
}

/** Šta se izabralo: tri reda trenutka „Dogovoreno!“ iz prijave i zadatka (ljudi, termin, iznos), bez ičega izmišljenog. */
export function dogovorenoRedovi(k: KandidatProjekcija, need: PotrebaProjekcija) {
  const value = candidateValue(k), has = candidateHas(k);
  const termin = candidateTime(k, need.taskTimezone) ?? need.vremeTekst;
  return {
    ljudi: `Ti i ${k.ime}`,
    // The time text already says "(po vremenu u Srbiji)" when it comes from the app's formatter; it is added only when it is missing.
    termin: /po vremenu u Srbiji/.test(termin) ? termin : `${termin} · po vremenu u Srbiji`,
    iznos: value.kind === 'amount' ? `${value.amount} ${value.basis}` : 'Cena nije navedena',
    ima: has ? has.text.replace(/^Ima: /, '') : null,
  };
}

/* ------------------------------------------------------------------------------------------------ razgovor i nacrt */

export const PRIMERI = ['Treba mi pomoć oko selidbe u subotu, 2 osobe, Novi Sad.', 'Treba mi neko da sastavi ormar u petak popodne.',
  'Treba mi neko da okreči sobu, tražim ponude.'] as const;

export const RAZGOVOR: ConversationMessage[] = [
  { id: 'u1', fromAi: false, body: 'Treba mi pomoć da prenesem orman i nekoliko kutija sa trećeg sprata, zgrada nema lift.' },
  { id: 'a1', fromAi: true, body: 'Razumem — orman i kutije, treći sprat bez lifta. Kada bi to trebalo da se uradi, i koliko bi ljudi bilo dovoljno?' },
  { id: 'u2', fromAi: false, body: 'Sutra posle podne. Mislim da su dovoljna dvojica, Liman 2.' },
  { id: 'a2', fromAi: true, body: 'Beležim: sutra posle podne, dve osobe, Liman 2. Sve je tu. Pregledaj zadatak, pa ga objavi kad ti odgovara.' },
];

/** Nacrt posle ovog razgovora: četiri činjenice su tu, opis još nije. Isti oblik kao `publicSummary`. */
export const NACRT: Summary = { title: 'Prenos ormana i kutija sa trećeg sprata', zone: 'Novi Sad · Liman 2', schedule: 'Sutra',
  value: { kind: 'amount', amount: '5.000 RSD', basis: 'ukupno' }, people: '2 osobe' };
export const NACRT_JOS_TREBA = 'Opis';

export const NACRT_DUG: Summary = { title: 'Selidba kompletnog dvosobnog stana sa klavirom, dve garderobe i radnim stolom iz Novog Sada u Sremsku Kamenicu',
  zone: 'Novi Sad · Grbavica → Sremska Kamenica', schedule: 'Ove nedelje', value: { kind: 'amount', amount: '1.250.000 RSD', basis: 'po osobi' }, people: '14 osoba' };
export const RAZGOVOR_DUG: ConversationMessage[] = [
  { id: 'd1', fromAi: false, body: `${NACRT_DUG.title}. Imam i veliku vitrinu sa staklom koja mora posebno da se upakuje i prenese vrlo pažljivo.` },
  { id: 'd2', fromAi: true, body: 'Razumem: kompletna selidba sa klavirom, garderobama i vitrinom sa staklom. Za klavir obično treba četiri osobe i posebni kaiševi. Da li je klavir uspravni ili klavir sa repom, i na kom je spratu?' },
  { id: 'd3', fromAi: false, body: 'Uspravni, treći sprat bez lifta. Ove nedelje, 14 ljudi, 1.250.000 po osobi.' },
  { id: 'd4', fromAi: true, body: 'Beležim sve. Pregledaj zadatak, pa ga objavi kad ti odgovara.' },
];

/** Šta aplikacija sme da obeća posle objave (R12, 2026-10-07): slanje obaveštenja je isključeno, pa se obećava mesto, ne poruka. */
export const OBJAVLJENO_RED = 'Čim neko uskoči, videćeš prijavu ovde i u zvoncu.';

/* ------------------------------------------------------------------------------------------------ prijava */

export const PRIJAVA = { iznos: '4.500 RSD', osnova: 'ukupno', ljudi: '2 osobe', termin: '26. sep · 10:00–12:00',
  poruka: 'Dolazimo nas dvojica sa trakama i kombijem.' };
export const PRIJAVA_DUGA = { iznos: '125.000 RSD', osnova: 'ukupno', ljudi: '3 osobe', termin: 'Fleksibilan raspon · 26. okt – 30. okt',
  poruka: 'Imamo iskustva sa selidbama stanova i kancelarija, donosimo sav alat, ćebad za zaštitu nameštaja i folije za pod. Klavir nosimo sa posebnim kaiševima.' };
export const PRIJAVA_RECENICA = 'Ako te izaberu, odmah nastaje Dogovor.';
