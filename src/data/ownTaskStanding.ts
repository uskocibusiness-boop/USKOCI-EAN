import type { PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { plural } from '../ui/system/plural';
import type { StatusKey } from '../ui/system/StatusChip';
import { endingOf } from './needEnding';

/**
 * Where one of MY tasks stands, in the owner's eight words (decision 2026-10-07): Nacrt, Objavljen, Bira se, Dogovoren, U toku,
 * Završen, Otkazan, Istekao; and the ONE next step, in grey words, that the row says under them (plan 2.2, 3.5). Pure: it reads the
 * task the screen already has and nothing else, so the list, the tests and a later Arhiva all agree on what a task is called.
 *
 * Nothing here is invented. A word the read cannot support is not drawn:
 * - "Bira se · N" needs the server's own count of applications to choose among (`brojPrijavaZaIzbor`); an unknown count says nothing, never zero;
 * - "Završen", "Otkazan" and "Istekao" need the raw ending the server sent (`kraj`, see `needEnding.ts`); a closed task whose ending was not
 *   carried, and an ARCHIVED one (the table has no word for it and nothing in the app sets it), get no chip and a plain sentence;
 * - "U toku" is the task's OWN fixed window reaching today's time while the task is going. A Dogovor may carry a changed time that this
 *   list does not read, so a flexible term ("Sutra, fleksibilno") is never "U toku": it stays "Dogovoren";
 * - "Sva mesta su dogovorena" is said only when every place IS agreed. A search closed with places still open is "Potraga je zatvorena" and
 *   how many are agreed ("Dogovoren · 1 od 2"): the read folds both into one stanje, so the coverage is what tells them apart.
 */
export type TaskChip = { status: StatusKey; /** What the word alone cannot say, after a dot ("Bira se · 3"). */ detail?: string };
export type OwnTaskStanding = {
  /** The one chip the row wears; null when no honest word exists. */
  chip: TaskChip | null;
  /** The one next step in grey words; null when there is nothing to say. */
  next: string | null;
  /** True when `next` is the way to the applications waiting for my choice: the row's foot opens them. */
  toApplications: boolean;
};

/** The agreed places of a task whose every place is agreed, and whose own fixed window has begun and not yet ended. */
function agreedTimeHasCome(item: PotrebaProjekcija, now: Date): boolean {
  const schedule = item.schedule;
  if (!schedule || schedule.kind !== 'FIXED_WINDOW') return false;
  const from = calendarInstant(schedule.startsAt);
  if (from === null) return false;
  const to = calendarInstant(schedule.endsAt);
  const at = BigInt(now.getTime()) * 1000n;
  return at >= from && (to === null || at < to);
}

/** "Imaš 3 prijave. Uporedi ih i izaberi." One application has nothing to compare, so it is only read and chosen. */
export function applicationsWaitSentence(count: number): string {
  const wait = plural(count, 'prijavu', 'prijave', 'prijava');
  return count === 1 ? `Imaš ${wait}. Pogledaj je i izaberi.` : `Imaš ${wait}. Uporedi ih i izaberi.`;
}

export function ownTaskStanding(item: PotrebaProjekcija, now: Date = new Date()): OwnTaskStanding {
  const count = item.brojPrijavaZaIzbor;
  const waiting = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
  const { popunjeno, ukupno } = item.pokrivenost;
  const none = (chip: TaskChip | null, next: string | null): OwnTaskStanding => ({ chip, next, toApplications: false });
  switch (item.stanje) {
    case 'NACRT':
      return none({ status: 'task.draft' }, 'Nacrt nije objavljen. Nastavi uređivanje.');
    case 'OBJAVLJENA':
      // Not yet read as "no applications": an unknown count says nothing.
      return none({ status: 'task.published' }, waiting === 0 ? 'Čekaš prijave. Javićemo ti.' : null);
    case 'CEKA_PRIJAVE':
      return waiting !== null && waiting > 0
        ? { chip: { status: 'task.choosing', detail: String(waiting) }, next: applicationsWaitSentence(waiting), toApplications: true }
        : none({ status: 'task.choosing' }, null);
    case 'DELIMICNO_POPUNJENA': {
      const agreed = `Dogovoreno ${popunjeno} od ${ukupno}.`;
      if (waiting !== null && waiting > 0) {
        return { chip: { status: 'task.choosing', detail: String(waiting) }, next: `${agreed} ${applicationsWaitSentence(waiting)}`, toApplications: true };
      }
      return none({ status: 'task.agreed', detail: `${popunjeno} od ${ukupno}` },
        waiting === 0 ? `${agreed} Čekaš prijave za ostala mesta.` : agreed);
    }
    case 'POPUNJENA': {
      // The read folds the server's ACTIVE into POPUNJENA whatever the coverage is, and a search that was closed with places still open
      // (the owner stopped looking for the rest) is ACTIVE with fewer places agreed than needed. "Sva mesta su dogovorena" is a fact only of
      // full coverage; with open places the true thing to say is that the search is closed, and how many are agreed.
      const everyPlace = popunjeno >= ukupno;
      const detail = everyPlace ? {} : { detail: `${popunjeno} od ${ukupno}` };
      const closed = `Potraga je zatvorena. Dogovoreno ${popunjeno} od ${ukupno}.`;
      return agreedTimeHasCome(item, now)
        ? none({ status: 'task.now', ...detail }, everyPlace ? 'Dogovoreni termin je počeo. Dogovor vidiš u Dogovorima.' : `Dogovoreni termin je počeo. ${closed}`)
        : none({ status: 'task.agreed', ...detail }, everyPlace ? 'Sva mesta su dogovorena. Dogovor vidiš u Dogovorima.' : closed);
    }
    case 'ZATVORENA':
      switch (endingOf(item)) {
        case 'COMPLETED': return none({ status: 'task.completed' }, null);
        case 'CANCELLED': return none({ status: 'task.cancelled' }, 'Otkazan zadatak ne prima prijave.');
        case 'EXPIRED': return none({ status: 'task.expired' }, 'Rok za prijave je istekao bez izbora.');
        case 'ARCHIVED': return none(null, 'Zadatak je u arhivi.');
        default: return none(null, 'Zadatak je zatvoren.');
      }
  }
}
