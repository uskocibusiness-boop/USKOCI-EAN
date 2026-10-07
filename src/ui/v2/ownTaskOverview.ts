import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { endingOf } from '../../data/needEnding';
import { readinessCopy, type NeedPublicationReadiness } from '../../data/needPublicationReadiness';
import { applicationsWaitSentence, ownTaskStanding, type TaskChip } from '../../data/ownTaskStanding';
import { nedostajeOsoba, plural, prijava as prijave } from '../system/plural';

/** The application as the object of "Imaš": "1 prijavu", "2 prijave", "5 prijava". */
const prijavu = (count: number) => plural(count, 'prijavu', 'prijave', 'prijava');

/**
 * How many people a task still needs, as a sentence the verb agrees with (plan 3.5): "Nedostaje još jedna osoba.", "Nedostaju još 2
 * osobe.", "Nedostaje još 5 osoba.", "Nedostaje još 21 osoba.". The verb follows the number the way the noun does: plural for 2 to 4
 * (and 22 to 24, never 12 to 14), singular for the rest. It was "Nedostaje još 2 ljudi".
 */
export const missingPeople = nedostajeOsoba;

/**
 * What the owner's OWN task page says about itself (plan 2.2, 2.10.5 and 3.5; owner, 2026-10-07: "vidno i lako razumljivo"):
 * ONE state, ONE next step in grey words, at most ONE green action, and the quiet ways in that the green one does not already
 * offer. Pure: it reads the task the screen already has (and, when the screen has read it, the search state for the missing
 * places) and nothing else, so the page, its tests and the list of "Moji zadaci" (`data/ownTaskStanding`, whose chip this
 * borrows) agree on what a task is called. Nothing here asks the server anything.
 *
 * Nothing is invented. A word the read cannot support is not drawn:
 * - "Bira se · N" and "Uporedi prijave" need the server's own count of applications to choose among; an unknown count says
 *   "Pogledaj prijave" and never a number;
 * - "Dogovor je otkazan" is said ONLY when it is certain. The search state counts every Dogovor and the places the live ones cover;
 *   a completed Dogovor covers places and a cancelled one does not, so a task that has Dogovori and covers NO place has only
 *   cancelled ones. With a place covered the same two counts cannot tell a cancelled Dogovor from a completed one, and the page
 *   then says what the task is doing now and nothing about the past;
 * - the green action is the owner's move. When there is nothing for the owner to do ("Čekaš prijave"), there is no green action.
 */

/** What the page needs of the search state (`rpc_get_need_search_state`, read by the screen's recovery controller). */
export type OverviewSearch = Pick<NeedSearchState,
  'status' | 'coveredSlots' | 'searchAuthority' | 'searchTimeAdmitted' | 'agreementCount' | 'activeAgreementCount'>;

/** Which callback the green action calls; the page maps it, this file never holds a handler. */
export type OverviewPrimaryKind = 'REVIEW' | 'EDIT' | 'CANDIDATES' | 'AGREEMENTS';
export type OverviewPrimary = {
  kind: OverviewPrimaryKind;
  label: string;
  /** What a screen reader hears when the words alone do not say what the number beside them means. */
  spoken?: string;
};

export type Overview = {
  /** The one chip at the top; null when no honest word exists (an archived task, a closed one whose ending was not carried). */
  chip: TaskChip | null;
  /** The one next step, in grey words, under the title. */
  sentence: string | null;
  /** The closed search, said once and word for word as it always was ("1 od 2 dogovoreno · preostala potraga je zatvorena"). */
  note: string | null;
  /** The one green action. Null when there is nothing for the owner to do, or when the screen's own recovery action replaces it. */
  primary: OverviewPrimary | null;
  /**
   * A draft the gate holds back for a reason that is not the owner's to fix (photos still being processed, the rules or the
   * check not ready): no green action, and the page offers to read again instead.
   */
  waits: boolean;
  /** Quiet rows that lead where the green action does not: the applications, the Dogovori. */
  rows: { applications: boolean; agreements: boolean };
};

/** The gate's answers that wait, or are not the owner's doing; the owner can only read again. */
const WAIT_CODES: ReadonlySet<string> = new Set(['PUBLIC_MEDIA_NOT_READY', 'POLICY_NOT_READY', 'POLICY_CONTENT_NOT_READY', 'EVALUATOR_UNAVAILABLE']);
/** The gate's answers the owner fixes in the conversation (the place, the country). */
const FIX_CODES: ReadonlySet<string> = new Set(['LOCATION_INCOMPLETE', 'COUNTRY_NOT_READY']);

const OPEN = new Set(['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA']);
const NOTE_STATES = new Set(['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA', 'POPUNJENA']);

/** A draft is private, and the one action says what it does. */
export const DRAFT_NEXT = 'Nacrt je privatan. Pregledaj ga i objavi.';
/** The words for a published task nobody has applied to yet (`ownTaskStanding` says the same under its card). */
const WAITING_FOR_FIRST = 'Čekaš prijave. Javićemo ti.';

export function ownTaskOverview(input: {
  need: PotrebaProjekcija;
  /** The remaining search was closed by the owner (`ru4Production.remainingSearchState`). */
  remainingClosed: boolean;
  /** What the publication gate said about a draft; absent means not asked. */
  readiness?: NeedPublicationReadiness | null;
  /** What the screen read about the search, and whether its own section about the search is on the screen (then it speaks for the search). */
  search?: { state: OverviewSearch | null; speaks: boolean } | null;
  /** The footer's action is replaced by the search recovery's own; whatever this page would have offered there becomes a quiet row. */
  overridden?: boolean;
  /** The screen can open the Dogovori. */
  canOpenAgreements?: boolean;
  now?: Date;
}): Overview {
  const { need, remainingClosed } = input;
  const standing = ownTaskStanding(need, input.now ?? new Date());
  const { popunjeno, ukupno } = need.pokrivenost;
  const total = need.brojPrijava;
  const raw = need.brojPrijavaZaIzbor;
  const waiting = typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  const state = input.search?.state ?? null;
  const speaks = input.search?.speaks === true;

  if (need.stanje === 'NACRT') {
    const gate = input.readiness ?? { kind: 'UNKNOWN' as const };
    const held = readinessCopy(gate) !== null;
    const code = gate.kind === 'NOT_READY' ? gate.code : null;
    const waits = !!code && WAIT_CODES.has(code);
    const primary: OverviewPrimary | null = !held ? { kind: 'REVIEW', label: 'Pregledaj za objavu' }
      : waits ? null
        // The place and the country are fixed where they are asked, in the conversation. The copy of every other answer sends the
        // owner to the review ("Otvori pregled da vidiš šta nedostaje"), which lists what is missing.
        : code && FIX_CODES.has(code) ? { kind: 'EDIT', label: 'Otvori razgovor i dopuni' }
          : { kind: 'REVIEW', label: 'Pregledaj za objavu' };
    return { chip: standing.chip, sentence: held ? null : DRAFT_NEXT, note: null, primary, waits,
      rows: { applications: false, agreements: false } };
  }

  const open = OPEN.has(need.stanje);
  const closed = remainingClosed || state?.searchAuthority === 'CLOSED';
  // The search no longer takes applications for the missing places: the owner closed it, or its time is over. Then "Čekaš prijave"
  // would be untrue, and what the search is doing is said by its own section (or by the closed-search line) and not by this page.
  const quiet = closed || speaks || (!!state && !state.searchTimeAdmitted);
  const cancelled = open && !!state && (state.status === 'PUBLISHED' || state.status === 'SELECTION')
    && state.coveredSlots === 0 && state.agreementCount > 0;
  const canChoose = open && !closed && (waiting ?? 0) > 0;
  const canLook = open && !closed && waiting === null && total > 0;

  // The chip is the list's own word. A search the owner closed cannot take a choice, so it is not "Bira se".
  let chip = standing.chip;
  if (closed && (need.stanje === 'OBJAVLJENA' || need.stanje === 'CEKA_PRIJAVE')) chip = { status: 'task.published' };
  else if (closed && need.stanje === 'DELIMICNO_POPUNJENA') chip = { status: 'task.agreed', detail: `${popunjeno} od ${ukupno}` };
  else if (need.stanje === 'OBJAVLJENA' && canChoose) chip = { status: 'task.choosing', detail: String(waiting) };
  else if (need.stanje === 'POPUNJENA' && popunjeno < ukupno && chip && !chip.detail) chip = { ...chip, detail: `${popunjeno} od ${ukupno}` };

  // Places are not Dogovori: one Dogovor can cover both places. Several Dogovori are said only when the search state counted them.
  const live = state ? state.activeAgreementCount : 0;
  let primary: OverviewPrimary | null = null;
  if (canChoose) {
    const label = cancelled ? 'Izaberi drugu prijavu' : waiting === 1 ? 'Pogledaj prijavu' : 'Uporedi prijave';
    primary = { kind: 'CANDIDATES', label, spoken: `${label}, ${prijave(waiting!)} za izbor` };
  } else if (canLook) {
    primary = { kind: 'CANDIDATES', label: 'Pogledaj prijave', spoken: `Pogledaj prijave, ukupno ${prijave(total)}` };
  } else if (need.stanje !== 'ZATVORENA' && popunjeno > 0 && input.canOpenAgreements) {
    primary = { kind: 'AGREEMENTS', label: live > 1 ? 'Otvori Dogovore' : 'Otvori Dogovor' };
  }
  if (input.overridden) primary = null;

  /** What the task is doing now. The search section, when it is on the screen, and the closed-search line speak for themselves. */
  const present = (): string | null => {
    switch (need.stanje) {
      case 'OBJAVLJENA':
        if (quiet) return null;
        if (canChoose) return applicationsWaitSentence(waiting!);
        if (cancelled) return 'Tvoj zadatak opet prima prijave.';
        if (total > 0 && waiting === null) return `Imaš ${prijavu(total)}. ${total === 1 ? 'Pogledaj je.' : 'Pogledaj ih.'}`;
        if (total > 0 && waiting === 0) return 'Trenutno nema prijava za izbor. Javićemo ti kad stigne nova.';
        return standing.next ?? WAITING_FOR_FIRST;
      case 'CEKA_PRIJAVE':
      case 'DELIMICNO_POPUNJENA':
        return quiet ? null : standing.next;
      case 'POPUNJENA':
        // A search closed early leaves places open: the note says "1 od 2 dogovoreno", and "all places" would be untrue.
        if (speaks || popunjeno < ukupno) return null;
        return standing.chip?.status === 'task.now' ? 'Dogovoreni termin je počeo.' : 'Sva mesta su dogovorena.';
      case 'ZATVORENA':
        return endingOf(need) === 'COMPLETED' ? 'Zadatak je završen.' : standing.next;
      default:
        return null;
    }
  };
  const sentence = [cancelled ? 'Dogovor je otkazan.' : null, present()].filter(Boolean).join(' ') || null;

  return {
    chip, sentence,
    note: remainingClosed && popunjeno < ukupno && NOTE_STATES.has(need.stanje)
      ? `${popunjeno} od ${ukupno} dogovoreno · preostala potraga je zatvorena` : null,
    primary, waits: false,
    rows: {
      applications: total > 0 && primary?.kind !== 'CANDIDATES',
      agreements: popunjeno > 0 && !!input.canOpenAgreements && primary?.kind !== 'AGREEMENTS',
    },
  };
}
