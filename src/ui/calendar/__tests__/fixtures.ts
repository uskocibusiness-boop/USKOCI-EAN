import type { DogovorProjekcija, MojaPrijavaProjekcija, NeedScheduleProjection, PotrebaProjekcija, ApplicationTaskFacts } from '../../../contracts/projections';
import type { WorkerCalendarEvent } from '../../../contracts/workerCalendar';
import { civilInstant } from '../calendarPresentation';

/**
 * The reads the planner and the archive are tested with: a Dogovor, a task, an application and a schedule row as the app's own reads
 * give them. Shared by the planner's suites so that a field added to a projection is added in one place.
 */

/** A moment at a Serbian clock on a civil day ("2026-10-07", "09:00"): tests state times the way people read them, in any zone. */
export const serbian = (day: string, clock: string): string => civilInstant(day, clock, 'Europe/Belgrade').value as string;

export const eventOf = (id: string, agreementId: string, startsAt: string, endsAt: string, version = 1): WorkerCalendarEvent =>
  ({ eventId: id, agreementId, agreementVersion: version, startsAt, endsAt, agreementStatus: 'CONFIRMED', source: 'AGREEMENT' });

/** A Dogovor in which I am the requester ("Tvoj zadatak"), agreed, with no exact term; `patch` changes what a case needs. */
export const agreementOf = (id: string, patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija => ({
  id, verzija: 1, naslov: 'Pomoć oko krečenja stana', stanje: 'CONFIRMED', cena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' },
  vremeTekst: '', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
    { id: 'other', profilId: null, ime: 'Marko', inicijali: 'M', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null,
  izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, tacanTermin: null, ...patch,
} as DogovorProjekcija);

/** The same Dogovor with me as the worker ("Uskačeš"). */
export const workerAgreementOf = (id: string, patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija => agreementOf(id, { ucesnici: [
  { id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: 'uskocer', mesta: 1, viSte: true, telefon: null },
  { id: 'other', profilId: null, ime: 'Ana', inicijali: 'A', uloga: 'narucilac', mesta: null, viSte: false, telefon: null }], ...patch });

export const windowOf = (pocetak: string, kraj: string) => ({ pocetak, kraj });
export const fixedWindow = (startsAt: string | null, endsAt: string | null): NeedScheduleProjection => ({ kind: 'FIXED_WINDOW', startsAt, endsAt });

/** One of my own tasks, published, with a fixed window on 2026-09-24 unless `patch` says otherwise. */
export const needOf = (id: string, patch: Partial<PotrebaProjekcija> = {}): PotrebaProjekcija => ({
  id, revizija: 1, naslov: 'Selidba', opis: '', stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 },
  vremeTekst: 'Fleksibilan termin', podrucjeTekst: 'Detelinara, Novi Sad', uslovi: [], brojPrijava: 0, brojPrijavaZaIzbor: 0,
  schedule: fixedWindow('2026-09-24T08:00:00Z', '2026-09-24T10:00:00Z'), ...patch,
} as PotrebaProjekcija);

/** The task facts the paged read adds to an application, which carry the task's exact window. */
export const taskFacts = (raspored: NeedScheduleProjection): ApplicationTaskFacts =>
  ({ raspored, rezimLokacije: null, vremenskaZona: null, rezimCene: 'OFFERS', osnovaCene: null, potrebnoMesta: 1 });

/** One of my applications, sent, with no term the read could place (the whole-list read carries the task's time as words only). */
export const applicationOf = (id: string, patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({
  prijavaId: id, potrebaId: `need-${id}`, potrebaRevizija: 1, prijavaRevizija: 1, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Košenje trave',
  opis: '', cena: { iznos: 1500, valuta: 'RSD', prikaz: '1.500 RSD' }, pokrivaMesta: 1, napomena: '', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Fleksibilno', dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch,
});

/** The word the app never uses for a task (owner, 2026-10-07: only "zadatak"), in each form, as a whole word ("Poslata" is another word). */
export const NO_POSAO = /(posao|posla|poslu|poslom|poslovi|poslova|poslove|poslovima)/i;
