import type { NeedDetailProjection, PrilikaProjekcija } from '../../../contracts/projections';
import { novac } from '../../../lib/novac';
import type { TaskCardRelation } from '../../v2/TaskFace';

/**
 * Lažni podaci laboratorije za grupu V2 (kartica, peek, detalj, pretraga). Ništa odavde ne čita ni ne piše: svaki zadatak je primer,
 * svaka osoba izmišljena za laboratoriju, svaka komanda nema. Isti oblik kao `src/app/dizajn-zadaci.tsx`, prošireno sa:
 * - `a7`, opterećen zadatak (dug naslov, dugo ime, četiri činjenice, HITNO, prijava poslata) za stanje „dugo“;
 * - fiksnim „profilom radnika“ laboratorije iz kog kartica izvodi RAZLOG („Imaš kombi“, „Blizu“), nikad ocenu „najbolji“;
 * - pouzdanošću koju bi dao server (`dolaziKakoJeDogovoreno`) samo za jednog objavljivača, da se vidi i prisustvo i odsustvo.
 */
const rules = (patch: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection['zahtevi'] => ({ vestine: [], alati: [], vozila: [], dozvole: [],
  bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch });

type Seed = Partial<PrilikaProjekcija> & Pick<PrilikaProjekcija, 'id' | 'naslov'>;
export const task = (seed: Seed): PrilikaProjekcija => ({
  statusTekst: 'Otvoren', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Liman, Novi Sad', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-12T08:00:00Z', endsAt: '2026-10-12T10:00:00Z' }, vremeTekst: '12. okt · 10:00–12:00',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], narucilacProfilId: `profil-${seed.id}`, narucilacAvatarId: null,
  narucilacIme: 'Marija Ilić', narucilacOcena: '4,7', narucilacBrojOcena: 3, priblizno: { lat: 45.25, lng: 19.84 }, rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
  ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: novac(6000) },
  detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules() }, ...seed });

export const OPIS_KRATAK = 'Ormar je rasklopljen u kutijama, u prizemlju zgrade. Treba ga uneti na treći sprat i ostaviti u sobi. Zgrada nema lift.';
export const OPIS_DUG = 'Selimo se iz stana na trećem spratu u kuću na Telepu. Zgrada nema lift, a stepenište je usko i ima dva oštra zavoja. '
  + 'Najteži komad je veliki ormar sa ogledalom koji mora da se rasklopi pre nošenja, pa opet sklopi u kući. Ima još jedan trosed, dva kreveta, '
  + 'frižider i oko trideset kutija. Kombi dolazi u 9, parking je ispred zgrade. Posle nošenja treba sve rasporediti po sobama kako kažemo. '
  + 'Računamo oko pet sati rada za tri osobe. Pauza za ručak je uključena, piće obezbeđeno.';

export const ZADACI: PrilikaProjekcija[] = [
  task({ id: 'a1', naslov: 'Unos ormara na treći sprat', opis: OPIS_KRATAK,
    detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ bitniUslovi: ['Zgrada bez lifta'], alati: ['Trake za nošenje'] }) } }),
  task({ id: 'a2', naslov: 'Košenje travnjaka u dvorištu', podrucjeTekst: 'Telep, Novi Sad', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null,
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Dragan Petrović', narucilacOcena: null, narucilacBrojOcena: 0,
    schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-10-12T00:00:00Z', endsAt: '2026-10-18T21:00:00Z' }, vremeTekst: 'Ove nedelje',
    opis: 'Dvorište je oko 300 kvadrata, trava je visoka. Kosilicu imamo, trimer ne.' }),
  task({ id: 'a3', naslov: 'Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara', podrucjeTekst: 'Grbavica, Novi Sad',
    pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 }, osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 3500, valuta: 'RSD', prikaz: novac(3500) },
    narucilacIme: 'Aleksandra Stojanović-Petrović', narucilacOcena: '4,9', narucilacBrojOcena: 128, opis: OPIS_DUG,
    detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ vozila: ['Kombi'] }) } }),
  task({ id: 'a4', naslov: 'Prevod kratkog uputstva na engleski', podrucjeTekst: 'Na daljinu', priblizno: null, rezimCene: 'MY_PRICE', osnovaCene: null,
    ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: novac(2500) }, pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 },
    narucilacIme: 'Milan Đorđević', narucilacOcena: '4,5', narucilacBrojOcena: 21,
    detalji: { kategorija: 'Administrativna pomoć', geografija: { mode: 'REMOTE' }, rezimLokacije: 'REMOTE', zahtevi: rules() },
    schedule: { kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null }, vremeTekst: 'Po dogovoru' }),
  task({ id: 'a5', naslov: 'Šetnja psa u kraju', podrucjeTekst: 'Detelinara, Novi Sad', rezimCene: 'MY_PRICE', ponudjenaCena: undefined, osnovaCene: null,
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Jelena N.', narucilacOcena: '5,0', narucilacBrojOcena: 1,
    schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null }, vremeTekst: 'Danas, fleksibilno' }),
  task({ id: 'a6', naslov: 'Montaža dve police', podrucjeTekst: 'Novo naselje, Novi Sad', ponudjenaCena: { iznos: 1800, valuta: 'RSD', prikaz: novac(1800) },
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, narucilacIme: 'Nikola Ilić', narucilacOcena: '4,2', narucilacBrojOcena: 14,
    detalji: { kategorija: 'Montaža', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: rules({ alati: ['Bušilica'] }) } }),
];

/** Opterećen zadatak: dug naslov, dugo ime, četiri činjenice, HITNO koje još važi i prijava koja je već poslata. */
export const ZADATAK_DUG: PrilikaProjekcija = task({ id: 'a7',
  naslov: 'Prenos klavira, troseda i dvadeset kutija knjiga iz stana na četvrtom spratu u kuću na Petrovaradinu, bez lifta',
  podrucjeTekst: 'Petrovaradin, Novi Sad', pokrivenost: { ukupno: 4, popunjeno: 1, preostalo: 3, udeo: 0.25 }, osnovaCene: 'PER_PERSON',
  ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: novac(4500) }, narucilacIme: 'Aleksandra Konstantinović-Radovanović', narucilacOcena: '4,8', narucilacBrojOcena: 57,
  urgency: { level: 'HITNO', expiresAt: '2027-01-01T00:00:00Z' }, opis: OPIS_DUG,
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-15T20:00:00Z', endsAt: '2026-10-16T04:00:00Z' }, vremeTekst: '15. okt · 22:00 – 16. okt · 06:00',
  detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: 'STATIONARY',
    zahtevi: rules({ bitniUslovi: ['Zgrada bez lifta', 'Usko stepenište'], vozila: ['Kombi'], alati: ['Trake za nošenje', 'Kolica'], vestine: ['Nošenje klavira'], iskustvoGodina: 2 }) } });

/** Koliko je zadatak star, kako to lista zna (nikad izmišljeno u aplikaciji; ovde je laboratorijska tabela). */
export const STAROST: Record<string, string> = { a1: 'pre 2 dana', a2: 'Upravo', a3: 'pre 3 sata', a4: 'juče', a5: 'pre 25 min', a6: 'pre 2 nedelje', a7: 'pre 40 min' };
export const starostOd = (id: string): string | null => STAROST[id] ?? null;

/** Šta sam ja ovom zadatku (iz sopstvenih zadataka i prijava, kao što lista zna). */
export const ODNOS: Partial<Record<string, TaskCardRelation>> = { a5: 'APPLIED', a6: 'OWNED', a7: 'APPLIED' };

/**
 * Laboratorijski „radni profil“ i udaljenost: iz njih kartica izvodi jedan MERLJIV razlog („Imaš kombi“, „Blizu · oko 1 km“), nikad sud
 * („Najbolji“). U aplikaciji isto dolazi iz radnog profila i `TaskFitContext` (R25); gde podatka nema, razloga nema.
 */
const PROFIL = { vozila: ['Kombi'], alati: ['Bušilica'] } as const;
const UDALJENOST_KM: Record<string, number> = { a1: 1.2, a6: 8.4, a7: 2.4 };
const BLIZU_KM = 3;
export function razlogZa(item: PrilikaProjekcija): string | null {
  const needs = item.detalji?.zahtevi;
  const vehicle = needs?.vozila?.find(v => PROFIL.vozila.some(mine => mine.toLocaleLowerCase('sr-Latn-RS') === v.toLocaleLowerCase('sr-Latn-RS')));
  if (vehicle) return `Imaš ${vehicle.toLocaleLowerCase('sr-Latn-RS')}`;
  const tool = needs?.alati?.find(a => PROFIL.alati.some(mine => mine.toLocaleLowerCase('sr-Latn-RS') === a.toLocaleLowerCase('sr-Latn-RS')));
  if (tool) return `Imaš ${tool.toLocaleLowerCase('sr-Latn-RS')}`;
  const km = UDALJENOST_KM[item.id];
  if (typeof km === 'number' && km <= BLIZU_KM) return `Blizu · oko ${Math.max(1, Math.round(km))} km`;
  return null;
}

/** „Dolazi kako je dogovoreno“, kako bi je dao server (prekidač privatnosti vlasnika): samo za jednog objavljivača, da se vidi i odsustvo. */
export const POUZDANOST: Record<string, { dosao: number; od: number }> = { 'profil-a1': { dosao: 9, od: 10 } };

/** Gradovi i delovi grada kako ih daje server za „Gde“. */
export type Grad = { text: string; count: number | null };
export const GRADOVI: Grad[] = [{ text: 'Novi Sad', count: 23 }, { text: 'Beograd', count: 13 }, { text: 'Subotica', count: 4 }, { text: 'Niš', count: 2 }];
export const DELOVI_LIMAN: Grad[] = [{ text: 'Liman, Novi Sad', count: 9 }, { text: 'Limanski park, Novi Sad', count: 2 }];
export const SVUDA_BROJ = 41;
export const OBLAST_BROJ = 7;
export const NA_DALJINU_BROJ = 5;
/** „Sada“ pretrage: fiksno, da dani kalendara miruju. */
export const SADA = new Date('2026-10-12T08:00:00Z');
