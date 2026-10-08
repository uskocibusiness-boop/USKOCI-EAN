import type { PotrebaProjekcija } from '../../../contracts/projections';
import type { HomeAttention, HomeRaspored, HomeRow, HomeSnapshot } from '../../../data/homeSnapshot';
import type { NeedEnding } from '../../../data/needEnding';
import { novac } from '../../../lib/novac';
import type { FactArtKind } from '../../system/FactArt';
import { OUTCOME, cannotLoad } from '../../system/outcomeCopy';

/**
 * The FAKE data of the V1 variant scenes (`/dizajn-var-V1`, creative direction 2026-10-08). Static examples, never account data,
 * so the same scene reads the same on any day; every command in the scenes is inert. The Home and task examples are the ones the
 * production galleries use (`dizajn-pocetna`, `dizajn-moji-zadaci`), copied here so this folder touches no existing file, with the
 * one addition variant A of Početna needs (`VarAttention.osoba`, `iznos`).
 */

/* --------------------------------------------------------------------------------------------------------- Početna */

/**
 * A waiting row with what variant A ("Lice koje čeka") draws beside the server's words: the person it came from and the amount,
 * when the row is about an application. TODAY the server's attention row carries neither; a choice of A asks for both (or the phone
 * reads them from the candidates it already lists for that task). Nothing here pretends otherwise: a row without them is drawn as today.
 */
export type VarAttention = HomeAttention & { osoba?: { ime: string }; iznos?: string };

const EMPTY: HomeSnapshot = {
  attention: [], attentionMore: 0, attentionState: 'known',
  agreements: { kind: 'known', value: { rows: [], more: 0 } },
  mine: {
    tasks: { kind: 'known', value: { total: 0, active: 0, waiting: 0, drafts: 0, history: 0 } },
    applications: { kind: 'known', value: { total: 0, attention: 0, active: 0, finished: 0 } },
  },
  partial: false, firstRun: true, ratingsDue: 0, ratingDueAgreementId: null,
};

const RADNI_NALOG: HomeSnapshot['mine'] = {
  tasks: { kind: 'known', value: { total: 3, active: 2, waiting: 1, drafts: 1, history: 0 } },
  applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } },
};

/** The server's own shape of a row: the task named, the action under it, the reason last; and, for A, who and how much. */
export const IZBOR: VarAttention = { id: 'var:izbor', title: '2 prijave', taskTitle: 'Pomoć pri selidbi', detail: 'Čeka tvoj izbor.',
  target: { kind: 'CANDIDATES', needId: 'var-izbor' }, osoba: { ime: 'Marko Petrović' }, iznos: novac(4500) };
const IZBOR_DUGO: VarAttention = { id: 'var:izbor-dugo', title: '12 prijava',
  taskTitle: 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza', detail: 'Čeka tvoj izbor.',
  target: { kind: 'CANDIDATES', needId: 'var-izbor-dugo' }, osoba: { ime: 'Aleksandra Konstantinović-Radovanović' }, iznos: novac(125000) };

/** What the phone adds to "Čeka te" from the reads it already makes (R02, a change to answer, R18). */
const PODSTICAJI: HomeAttention[] = [
  { id: 'var:izmena', title: 'Odgovori na predlog izmene', taskTitle: 'Montaža police u hodniku', detail: 'Druga strana predlaže izmenu uslova.',
    target: { kind: 'AGREEMENT_CHANGE', agreementId: 'var-izmena' } },
  { id: 'var:termin', title: 'Predloži termin', taskTitle: 'Krečenje stana u belo', detail: 'Termin još nije dogovoren.',
    target: { kind: 'AGREEMENT_TERM', agreementId: 'var-termin' } },
  { id: 'var:nacrt', title: 'Nastavi nacrt', taskTitle: 'Prevoz ormana iz Novog Sada', detail: 'Nacrt još nije objavljen.',
    target: { kind: 'NEED', needId: 'var-nacrt' } },
];
const BEZ_TERMINA_RED: HomeAttention = { id: 'var:bez-termina', title: 'Predloži termin', taskTitle: 'Čišćenje posle renoviranja',
  detail: 'Termin još nije dogovoren.', target: { kind: 'AGREEMENT_TERM', agreementId: 'var-bez-termina' } };

function termin(id: string, title: string, facts: NonNullable<HomeRow['appointment']>, raspored?: HomeRaspored, quietLine?: string): HomeSnapshot {
  return {
    ...EMPTY, firstRun: false,
    agreements: { kind: 'known', value: { more: 0, rows: [{ id: `var:${id}`, title,
      detail: [facts.roleLabel, facts.counterpartName, facts.timeText].filter(Boolean).join(' · '),
      target: { kind: 'AGREEMENT', agreementId: `var-${id}` }, appointment: facts,
      ...(raspored ? { upcoming: true as const, raspored } : {}) }], ...(quietLine ? { quietLine } : {}) } },
    mine: RADNI_NALOG,
  };
}

const SLEDECI = termin('sledeci', 'Montaža police u hodniku', {
  timeText: '26. sep · 17:00–19:00', counterpartName: 'Jelena Nikolić', roleLabel: 'Tvoj zadatak', counterpartInitials: 'JN',
}, { when: 'Danas · 14:00–16:00', spoken: 'Danas, od 14:00 do 16:00', more: 'Ove nedelje još 2 Dogovora · 1 Dogovor bez tačnog termina', zone: null });

const DUGO = termin('dugo', 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza', {
  timeText: 'Fleksibilno · tokom sledeće nedelje', counterpartName: 'Aleksandra Konstantinović-Radovanović', roleLabel: 'Uskačeš', counterpartInitials: 'AK',
}, { when: 'Četvrtak, 15. okt · 22:00 – petak, 16. okt 06:00', spoken: 'Četvrtak, 15. okt, od 22:00 do petak, 16. okt 06:00',
  more: 'Ove nedelje još 12 Dogovora · 21 Dogovor bez tačnog termina · 3 Dogovora čekaju završetak', zone: 'Po vremenu u Srbiji' });

const BEZ_TERMINA: HomeSnapshot = { ...termin('bez-termina', 'Krečenje stana u belo', {
  timeText: 'Termin nije potvrđen', counterpartName: 'Druga strana', roleLabel: 'Tvoj zadatak',
}, undefined, '2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak'), prompts: [BEZ_TERMINA_RED] };

export type PocetnaStanje = 'normalno' | 'puno' | 'dugo' | 'prazno' | 'bez-termina' | 'radnik' | 'mir';
export const POCETNA_STANJA: readonly PocetnaStanje[] = ['normalno', 'puno', 'dugo', 'prazno', 'bez-termina', 'radnik', 'mir'];
export const isPocetnaStanje = (value: unknown): value is PocetnaStanje => typeof value === 'string' && (POCETNA_STANJA as readonly string[]).includes(value);

/** The overview of each Home scene, and whether the "Slobodan sam sada" switch is drawn (an active work profile). */
export function pocetnaPodaci(stanje: PocetnaStanje): { home: HomeSnapshot; availableNow?: boolean } {
  switch (stanje) {
    case 'puno': return { home: { ...SLEDECI, attention: [IZBOR], prompts: PODSTICAJI, ratingsDue: 2,
      workerProfile: { kind: 'known', value: { state: 'DRAFT', availableNow: false } } } };
    case 'dugo': return { home: { ...DUGO, attention: [IZBOR_DUGO] } };
    case 'prazno': return { home: { ...EMPTY, workerProfile: { kind: 'known', value: { state: 'NONE', availableNow: false } } } };
    case 'bez-termina': return { home: { ...BEZ_TERMINA, attention: [IZBOR] } };
    case 'radnik': return { home: { ...SLEDECI, workerProfile: { kind: 'known', value: { state: 'ACTIVE', availableNow: true } } }, availableNow: true };
    // Nothing waits and nothing is scheduled: the calm "Čeka te" and the two lists.
    case 'mir': return { home: { ...EMPTY, firstRun: false, mine: RADNI_NALOG } };
    default: return { home: { ...SLEDECI, attention: [IZBOR] } };
  }
}

/* ----------------------------------------------------------------------------------------------------- Moji zadaci */

type Seed = Partial<PotrebaProjekcija> & { kraj?: NeedEnding };
let serial = 0;
/** A task of mine as the read hands it over: priced by the person, one place, a fixed window, nobody has applied. */
const zadatak = (seed: Seed & Pick<PotrebaProjekcija, 'naslov'>): PotrebaProjekcija => ({
  id: `var-${++serial}`, revizija: 1, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Liman, Novi Sad', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-10-24T08:00:00Z', endsAt: '2026-10-24T10:00:00Z' }, vremeTekst: '24. okt · 10:00–12:00', uslovi: [],
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
  ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: novac(4500) }, priblizno: null, ...seed,
} as unknown as PotrebaProjekcija);

const AKTIVNI: PotrebaProjekcija[] = [
  zadatak({ naslov: 'Montaža dve police u hodniku', stanje: 'CEKA_PRIJAVE', brojPrijava: 4, brojPrijavaZaIzbor: 3, osnovaCene: 'PER_PERSON',
    pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: novac(2000) }, podrucjeTekst: 'Grbavica, Novi Sad' }),
  zadatak({ naslov: 'Košenje travnjaka u dvorištu', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null, podrucjeTekst: 'Telep, Novi Sad',
    schedule: { kind: 'WEEK_FLEXIBLE', startsAt: '2026-10-11T22:00:00Z', endsAt: '2026-10-18T22:00:00Z' }, vremeTekst: 'Ove nedelje' }),
  zadatak({ naslov: 'Pomoć pri selidbi', stanje: 'DELIMICNO_POPUNJENA', brojPrijava: 2, brojPrijavaZaIzbor: 1, osnovaCene: 'PER_PERSON',
    pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 }, ponudjenaCena: { iznos: 3500, valuta: 'RSD', prikaz: novac(3500) },
    podrucjeTekst: 'Novo naselje, Novi Sad', vremeTekst: '14. okt · 09:00–13:00' }),
  zadatak({ naslov: 'Prevod uputstva na engleski', stanje: 'POPUNJENA', brojPrijava: 3, brojPrijavaZaIzbor: 0, ponudjenaCena: { iznos: 2500, valuta: 'RSD', prikaz: novac(2500) },
    pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, podrucjeTekst: 'Na daljinu', vremeTekst: 'Po dogovoru' }),
  zadatak({ naslov: 'Šetnja psa u kraju', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null, podrucjeTekst: 'Detelinara, Novi Sad',
    schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null }, vremeTekst: 'Danas, fleksibilno' }),
];
const JOS: PotrebaProjekcija[] = ['Bojenje ograde', 'Čišćenje podruma', 'Sklapanje kreveta', 'Nošenje peska', 'Popravka slavine', 'Okopavanje bašte', 'Pomoć oko računara']
  .map((naslov, at) => zadatak({ naslov, stanje: at % 3 === 0 ? 'CEKA_PRIJAVE' : 'OBJAVLJENA', brojPrijava: at % 3 === 0 ? 2 : 0, brojPrijavaZaIzbor: at % 3 === 0 ? 2 : 0,
    podrucjeTekst: `${['Liman', 'Telep', 'Grbavica', 'Detelinara', 'Novo naselje', 'Podbara', 'Adice'][at]}, Novi Sad`,
    ponudjenaCena: { iznos: 2000 + at * 500, valuta: 'RSD', prikaz: novac(2000 + at * 500) } }));
const NACRTI: PotrebaProjekcija[] = [
  zadatak({ naslov: 'Pomoć oko bašte', stanje: 'NACRT', podrucjeTekst: 'Podbara, Novi Sad', ponudjenaCena: undefined, rezimCene: 'OFFERS', osnovaCene: null }),
  zadatak({ naslov: 'Prenos ormara', stanje: 'NACRT', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 } }),
];
const ISTORIJA: PotrebaProjekcija[] = [
  zadatak({ naslov: 'Farbanje ograde', stanje: 'ZATVORENA', kraj: 'COMPLETED', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, vremeTekst: '20. sep · 08:00' }),
  zadatak({ naslov: 'Nošenje peska u dvorište', stanje: 'ZATVORENA', kraj: 'CANCELLED', vremeTekst: '18. sep · 16:00' }),
  zadatak({ naslov: 'Pomoć pri sređivanju tavana', stanje: 'ZATVORENA', kraj: 'EXPIRED', vremeTekst: '12. sep · 10:00' }),
];
const DUGI: PotrebaProjekcija[] = [
  zadatak({ naslov: 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade', stanje: 'CEKA_PRIJAVE',
    brojPrijava: 12, brojPrijavaZaIzbor: 12, osnovaCene: 'PER_PERSON', pokrivenost: { ukupno: 12, popunjeno: 3, preostalo: 9, udeo: 0.25 },
    ponudjenaCena: { iznos: 125000, valuta: 'RSD', prikaz: novac(125000) }, podrucjeTekst: 'Novo naselje, Bulevar Evrope, Novi Sad, blizu Ekonomske škole',
    vremeTekst: 'Fleksibilan raspon · 24. sep – 30. sep, radnim danima posle 17:00' }),
  zadatak({ naslov: 'Selidba kancelarije sa arhivom i nameštajem na drugi kraj grada', rezimCene: 'OFFERS', ponudjenaCena: undefined, osnovaCene: null,
    urgency: { level: 'HITNO', expiresAt: '2099-01-01T00:00:00Z' }, podrucjeTekst: 'Petrovaradinska tvrđava, Novi Sad' }),
  zadatak({ naslov: 'Pomoć oko bašte', ponudjenaCena: undefined, osnovaCene: null }),
];

export type MojiZadaciStanje = 'lista' | 'puno' | 'dugo' | 'prazno' | 'pecat';
export const MOJI_ZADACI_STANJA: readonly MojiZadaciStanje[] = ['lista', 'puno', 'dugo', 'prazno', 'pecat'];
export const isMojiZadaciStanje = (value: unknown): value is MojiZadaciStanje => typeof value === 'string' && (MOJI_ZADACI_STANJA as readonly string[]).includes(value);

export function mojiZadaciPodaci(stanje: MojiZadaciStanje): PotrebaProjekcija[] {
  switch (stanje) {
    case 'puno': return [...AKTIVNI, ...JOS, ...NACRTI, ...ISTORIJA];
    case 'dugo': return DUGI;
    case 'prazno': return [];
    default: return [...AKTIVNI, ...NACRTI, ...ISTORIJA];
  }
}

/* --------------------------------------------------------------------------------------------- the state family */

export type Porodica = {
  key: string;
  /** The bar's name: the screen the state stands on. */
  traka: string;
  kind: 'empty' | 'error' | 'offline';
  cause?: 'first' | 'filtered';
  art: FactArtKind;
  naslov: string; uci: string; glavna?: string; tiha?: string;
};

/** The family as the direction writes it (C.17–C.23, B6): the object rhymes with the door or the row that fulfils the state. */
export const PORODICA: readonly Porodica[] = [
  { key: 'moji-zadaci', traka: 'Moji zadaci', kind: 'empty', cause: 'first', art: 'publish', naslov: 'Još nemaš zadatak',
    uci: 'Reci šta ti treba. Nacrt pregledaš pre objave.', glavna: 'Objavi prvi zadatak', tiha: 'Pogledaj zadatke' },
  { key: 'moje-prijave', traka: 'Moje prijave', kind: 'empty', cause: 'first', art: 'offers', naslov: 'Još nemaš prijavu',
    uci: 'Kad se prijaviš na zadatak, ovde pratiš prijavu i svaki sledeći korak.', glavna: 'Istraži zadatke' },
  { key: 'dogovori', traka: 'Dogovori', kind: 'empty', cause: 'first', art: 'agreements', naslov: 'Još nemaš Dogovor',
    uci: 'Dogovor nastaje kad izabereš prijavu ili te izaberu.', glavna: 'Pogledaj zadatke', tiha: 'Objavi zadatak' },
  { key: 'poruke', traka: 'Poruke', kind: 'empty', cause: 'first', art: 'chat', naslov: 'Još nema razgovora',
    uci: 'Čim nastane Dogovor, ovde je razgovor.', glavna: 'Otvori Dogovore' },
  { key: 'obavestenja', traka: 'Obaveštenja', kind: 'empty', cause: 'first', art: 'bell', naslov: 'Još nema obaveštenja',
    uci: 'Nove prijave, poruke i važne promene stižu ovde.', glavna: 'Podesi obaveštenja' },
  { key: 'zadaci', traka: 'Zadaci', kind: 'empty', cause: 'first', art: 'map', naslov: 'Još niko nije tražio pomoć',
    uci: 'Čim neko objavi zadatak, pojaviće se ovde i na mapi.', glavna: 'Osveži', tiha: 'Objavi zadatak' },
  { key: 'filter', traka: 'Zadaci', kind: 'empty', cause: 'filtered', art: 'map', naslov: 'Nema zadataka u ovom prikazu',
    uci: 'Nijedan zadatak ne odgovara ovim uslovima.', glavna: 'Poništi filtere' },
  { key: 'greska', traka: 'Dogovori', kind: 'error', art: 'agreements', naslov: cannotLoad('Dogovore').title, uci: cannotLoad('Dogovore').copy, glavna: cannotLoad('Dogovore').action },
  { key: 'bez-veze', traka: 'Dogovori', kind: 'offline', art: 'info', naslov: OUTCOME.offline.title, uci: OUTCOME.offline.copy, glavna: OUTCOME.offline.action },
];

/** The same screens as the app draws them TODAY (the words and pictures of the production screens, read from their code on 2026-10-08). */
export const PORODICA_SADA: readonly Porodica[] = [
  { key: 'moji-zadaci', traka: 'Moji zadaci', kind: 'empty', cause: 'first', art: 'tasks', naslov: 'Još nemaš zadatak',
    uci: 'Reci šta ti treba. Nacrt pregledaš pre objave.', glavna: 'Objavi prvi zadatak' },
  { key: 'moje-prijave', traka: 'Moje prijave', kind: 'empty', cause: 'first', art: 'offers', naslov: 'Još nemaš prijavu',
    uci: 'Kada se prijaviš na zadatak, ovde pratiš svoju prijavu i svaki sledeći korak.', glavna: 'Istraži zadatke' },
  { key: 'dogovori', traka: 'Dogovori', kind: 'empty', cause: 'first', art: 'agreements', naslov: 'Još nemaš Dogovor',
    uci: 'Kada izabereš nekoga za svoj zadatak, ili kada tvoja prijava bude izabrana, Dogovor se pojavljuje ovde.', glavna: 'Pogledaj zadatke', tiha: 'Objavi zadatak' },
  { key: 'poruke', traka: 'Poruke', kind: 'empty', cause: 'first', art: 'chat', naslov: 'Još nema razgovora',
    uci: 'Poruke iz tvojih Dogovora i grupnih razgovora pojaviće se ovde.', glavna: 'Otvori Dogovore' },
  { key: 'obavestenja', traka: 'Obaveštenja', kind: 'empty', cause: 'first', art: 'chat', naslov: 'Još nema obaveštenja',
    uci: 'Nove prijave, poruke i važne promene stižu ovde — uz zadatak ili Dogovor na koji se odnose.', tiha: 'Podesi obaveštenja' },
  { key: 'zadaci', traka: 'Zadaci', kind: 'empty', cause: 'first', art: 'tasks', naslov: 'Trenutno nema otvorenih zadataka',
    uci: 'Kad neko objavi zadatak, videćeš ga ovde i na mapi.', glavna: 'Osveži zadatke', tiha: 'Objavi zadatak' },
  { key: 'filter', traka: 'Zadaci', kind: 'empty', cause: 'filtered', art: 'map', naslov: 'Nema zadataka u ovom prikazu',
    uci: 'Nijedan zadatak ne odgovara ovim uslovima.', glavna: 'Poništi filtere' },
  { key: 'greska', traka: 'Dogovori', kind: 'error', art: 'agreements', naslov: cannotLoad('Dogovore').title, uci: cannotLoad('Dogovore').copy, glavna: cannotLoad('Dogovore').action },
  { key: 'bez-veze', traka: 'Dogovori', kind: 'offline', art: 'info', naslov: OUTCOME.offline.title, uci: OUTCOME.offline.copy, glavna: OUTCOME.offline.action },
];

export const clanPorodice = (list: readonly Porodica[], key: string | undefined): Porodica => list.find(clan => clan.key === key) ?? list[0];
