import type { PotrebaProjekcija } from '../../contracts/projections';
import type { NeedPublicationReadiness } from '../needPublicationReadiness';
import { APPLICATION_PROMISE, applicationsWaitSentence, ownTaskStanding } from '../ownTaskStanding';
import { STATUS_CHIPS } from '../../ui/system/StatusChip';
import { DRAFT_NEXT, NARROW_TERM_HOURS, NO_APPLICATIONS_AFTER_HOURS, NO_APPLICATIONS_HELP_LABEL, NO_APPLICATIONS_HELP_ON, missingPeople, noApplicationsHelp, ownTaskOverview, type Overview, type OverviewSearch } from '../../ui/v2/ownTaskOverview';

/**
 * The owner's own task page says ONE state, ONE next step and at most ONE green action (plan 2.2, 3.5; owner 2026-10-07). This is the
 * pure model behind it, state by state, so the page, the list of "Moji zadaci" and the tests agree, and so that nothing is said that the
 * read cannot support: "Dogovor je otkazan" only when it is certain, "Bira se" only with applications to choose among, no green
 * action when nothing is the owner's to do.
 */
const NOW = new Date('2026-10-07T12:00:00Z');
const HALF = { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 };
const FULL = { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 };
const task = (patch: Partial<PotrebaProjekcija> & { kraj?: string } = {}): PotrebaProjekcija => ({ id: 't1', revizija: 1, naslov: 'Krečenje zida', opis: '',
  stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra, fleksibilno', podrucjeTekst: 'Novi Sad', uslovi: [],
  brojPrijava: 0, brojPrijavaZaIzbor: 0, ...patch } as PotrebaProjekcija);
const search = (patch: Partial<OverviewSearch> = {}): OverviewSearch => ({ status: 'PUBLISHED', coveredSlots: 0, searchAuthority: 'OPEN',
  searchTimeAdmitted: true, agreementCount: 0, activeAgreementCount: 0, ...patch });
type Extra = Partial<Parameters<typeof ownTaskOverview>[0]>;
const view = (patch: Parameters<typeof task>[0] = {}, extra: Extra = {}): Overview =>
  ownTaskOverview({ need: task(patch), remainingClosed: false, canOpenAgreements: true, now: NOW, ...extra });
const word = (overview: Overview) => overview.chip ? STATUS_CHIPS[overview.chip.status].word + (overview.chip.detail ? ` · ${overview.chip.detail}` : '') : null;
const borrowed = (patch: Parameters<typeof task>[0]) => ownTaskStanding(task(patch), NOW).next;

describe('state by state: one chip, one grey sentence, at most one green action', () => {
  it('a draft is "Nacrt", says it is private, and its one action reviews it', () => {
    const draft = view({ stanje: 'NACRT' });
    expect(word(draft)).toBe('Nacrt');
    expect(draft.sentence).toBe(DRAFT_NEXT);
    expect(draft.primary).toEqual({ kind: 'REVIEW', label: 'Pregledaj za objavu' });
    expect(draft.rows).toEqual({ applications: false, agreements: false });
  });

  it('a published task nobody applied to is "Objavljen", waits, and has no green action', () => {
    const waiting = view({ stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 });
    expect(word(waiting)).toBe('Objavljen');
    // The words are the list's own ("Moji zadaci" says the same under the card), so the page and the list cannot disagree.
    expect(waiting.sentence).toBe(borrowed({ stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 0 }));
    expect(waiting.sentence).toBeTruthy();
    expect(waiting.primary).toBeNull();
    // An unknown count that the task has no applications for either says the same thing.
    expect(view({ stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: undefined }).sentence).toBe(waiting.sentence);
  });

  it('applications that exist but cannot be chosen are said, kept one quiet row away, and are no reason for a green action', () => {
    const none = view({ stanje: 'OBJAVLJENA', brojPrijava: 4, brojPrijavaZaIzbor: 0 });
    expect(none.sentence).toBe(APPLICATION_PROMISE.noneToChoose);
    expect(none.primary).toBeNull();
    expect(none.rows).toEqual({ applications: true, agreements: false });
  });

  it('an unknown count of choosable applications says the total and never "Uporedi" or a number it does not have', () => {
    const unknown = view({ stanje: 'OBJAVLJENA', brojPrijava: 5, brojPrijavaZaIzbor: undefined });
    expect(word(unknown)).toBe('Objavljen');
    expect(unknown.sentence).toBe('Imaš 5 prijava. Pogledaj ih.');
    expect(unknown.primary).toEqual({ kind: 'CANDIDATES', label: 'Pogledaj prijave', spoken: 'Pogledaj prijave, ukupno 5 prijava' });
    expect(view({ stanje: 'OBJAVLJENA', brojPrijava: 1, brojPrijavaZaIzbor: undefined }).sentence).toBe('Imaš 1 prijavu. Pogledaj je.');
  });

  it('applications to choose among: "Bira se · N", the sentence says compare and choose, and the one green action is "Uporedi prijave"', () => {
    const choosing = view({ stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 3 });
    expect(word(choosing)).toBe('Bira se · 3');
    expect(choosing.chip).toEqual({ status: 'task.choosing', detail: '3' });
    expect(STATUS_CHIPS['task.choosing'].tone).toBe('attention');   // it waits for the owner: the orange one
    expect(choosing.sentence).toBe(applicationsWaitSentence(3));
    expect(choosing.sentence).toMatch(/^Imaš 3 prijave\. /);
    expect(choosing.primary).toEqual({ kind: 'CANDIDATES', label: 'Uporedi prijave', spoken: 'Uporedi prijave, 3 prijave za izbor' });
    // The green action opens the list, so a row that opens the same list is not drawn.
    expect(choosing.rows.applications).toBe(false);
  });

  it('one application is read and chosen, not compared', () => {
    const one = view({ stanje: 'CEKA_PRIJAVE', brojPrijava: 1, brojPrijavaZaIzbor: 1 });
    expect(one.sentence).toBe(applicationsWaitSentence(1));
    expect(one.sentence).toMatch(/^Imaš 1 prijavu\. /);
    expect(one.primary).toMatchObject({ kind: 'CANDIDATES', label: 'Pogledaj prijavu' });
  });

  it('a task that is partly agreed says how many; with applications left it is "Bira se", without them it is "Dogovoren · 1 od 2"', () => {
    const more = view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 2 });
    expect(word(more)).toBe('Bira se · 2');
    expect(more.sentence).toBe(borrowed({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 2 }));
    expect(more.sentence).toBe(`Dogovoreno 1 od 2. ${applicationsWaitSentence(2)}`);
    expect(more.primary).toMatchObject({ kind: 'CANDIDATES', label: 'Uporedi prijave' });
    // The Dogovor is still one quiet row away.
    expect(more.rows.agreements).toBe(true);
    const alone = view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 });
    expect(word(alone)).toBe('Dogovoren · 1 od 2');
    expect(alone.sentence).toBe(borrowed({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 }));
    expect(alone.sentence).toMatch(/^Dogovoreno 1 od 2\./);
    expect(alone.primary).toEqual({ kind: 'AGREEMENTS', label: 'Otvori Dogovor' });
  });

  it('every place agreed is "Dogovoren" and the one green action opens the Dogovor, in the plural when there are several', () => {
    const full = view({ stanje: 'POPUNJENA', pokrivenost: FULL });
    expect(word(full)).toBe('Dogovoren');
    expect(full.sentence).toBe('Sva mesta su dogovorena.');
    expect(full.primary).toEqual({ kind: 'AGREEMENTS', label: 'Otvori Dogovor' });
    expect(full.rows.agreements).toBe(false);
    const two = view({ stanje: 'POPUNJENA', pokrivenost: FULL }, { search: { speaks: false, state: search({ status: 'ACTIVE', coveredSlots: 2, agreementCount: 2, activeAgreementCount: 2 }) } });
    expect(two.primary).toEqual({ kind: 'AGREEMENTS', label: 'Otvori Dogovore' });
    // One Dogovor that covers both places is one Dogovor.
    const one = view({ stanje: 'POPUNJENA', pokrivenost: FULL }, { search: { speaks: false, state: search({ status: 'ACTIVE', coveredSlots: 2, agreementCount: 1, activeAgreementCount: 1 }) } });
    expect(one.primary?.label).toBe('Otvori Dogovor');
  });

  it('when the agreed time has come it is "U toku"', () => {
    const fixed = { kind: 'FIXED_WINDOW' as const, startsAt: '2026-10-07T11:00:00Z', endsAt: '2026-10-07T13:00:00Z' };
    const now = view({ stanje: 'POPUNJENA', pokrivenost: FULL, schedule: fixed });
    expect(word(now)).toBe('U toku');
    expect(now.sentence).toBe('Dogovoreni termin je počeo.');
    expect(now.primary?.label).toBe('Otvori Dogovor');
    // A flexible term is never "U toku": the Dogovor may carry another time that this page does not read.
    expect(word(view({ stanje: 'POPUNJENA', pokrivenost: FULL, schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null } }))).toBe('Dogovoren');
  });

  it.each([
    ['COMPLETED', 'Završen', 'Zadatak je završen.'],
    ['CANCELLED', 'Otkazan', borrowed({ stanje: 'ZATVORENA', kraj: 'CANCELLED' })],
    ['EXPIRED', 'Istekao', borrowed({ stanje: 'ZATVORENA', kraj: 'EXPIRED' })],
  ])('a task that ended %s is "%s", says so, and has no green action', (kraj, chip, sentence) => {
    const ended = view({ stanje: 'ZATVORENA', kraj });
    expect(word(ended)).toBe(chip); expect(ended.sentence).toBe(sentence); expect(ended.primary).toBeNull();
  });

  it('a closed task whose ending was not carried, and an archived one, wear no chip rather than a wrong one', () => {
    for (const kraj of [undefined, 'ARCHIVED']) {
      const ended = view({ stanje: 'ZATVORENA', ...(kraj ? { kraj } : {}) });
      expect(ended.chip).toBeNull(); expect(ended.sentence).toBe(borrowed({ stanje: 'ZATVORENA', ...(kraj ? { kraj } : {}) })); expect(ended.primary).toBeNull();
    }
  });

  it('a closed task keeps its Dogovori and its applications one quiet row away, never as a green action', () => {
    const done = view({ stanje: 'ZATVORENA', kraj: 'COMPLETED', pokrivenost: FULL, brojPrijava: 3, brojPrijavaZaIzbor: 0 });
    expect(done.primary).toBeNull(); expect(done.rows).toEqual({ applications: true, agreements: true });
  });

  it('never says "Čeka prijave", in any state', () => {
    const everything = [
      view({ stanje: 'NACRT' }), view({ stanje: 'OBJAVLJENA' }), view({ stanje: 'CEKA_PRIJAVE', brojPrijava: 2, brojPrijavaZaIzbor: 2 }),
      view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 }), view({ stanje: 'POPUNJENA', pokrivenost: FULL }),
      view({ stanje: 'ZATVORENA', kraj: 'CANCELLED' }), view({ stanje: 'ZATVORENA', kraj: 'EXPIRED' }),
    ];
    for (const overview of everything) expect(JSON.stringify(overview)).not.toMatch(/Čeka prijave/);
  });
});

describe('the search continues after a Dogovor is cancelled (said only when it is certain)', () => {
  const cancelled = (patch: Partial<OverviewSearch> = {}) => search({ coveredSlots: 0, agreementCount: 1, activeAgreementCount: 0, ...patch });

  it('a task that has Dogovori and covers no place has only cancelled ones, and says what it is doing now', () => {
    const again = view({ stanje: 'OBJAVLJENA', brojPrijava: 1, brojPrijavaZaIzbor: 0 }, { search: { state: cancelled(), speaks: false } });
    expect(again.sentence).toBe('Dogovor je otkazan. Tvoj zadatak opet prima prijave.');
    expect(word(again)).toBe('Objavljen'); expect(again.primary).toBeNull();
  });

  it('where applications still wait, the green action is "Izaberi drugu prijavu"', () => {
    const other = view({ stanje: 'CEKA_PRIJAVE', brojPrijava: 2, brojPrijavaZaIzbor: 2 }, { search: { state: cancelled(), speaks: false } });
    expect(other.sentence).toBe(`Dogovor je otkazan. ${applicationsWaitSentence(2)}`);
    expect(other.primary).toEqual({ kind: 'CANDIDATES', label: 'Izaberi drugu prijavu', spoken: 'Izaberi drugu prijavu, 2 prijave za izbor' });
    expect(word(other)).toBe('Bira se · 2');
  });

  it('a search the owner closed survives the cancellation: the page says the Dogovor ended and the closed search says the rest', () => {
    const closed = view({ stanje: 'OBJAVLJENA', brojPrijava: 1, brojPrijavaZaIzbor: 1 },
      { remainingClosed: true, search: { state: cancelled({ searchAuthority: 'CLOSED' }), speaks: false } });
    expect(closed.sentence).toBe('Dogovor je otkazan.');
    expect(closed.note).toBe('0 od 2 dogovoreno · preostala potraga je zatvorena');
    // A closed search takes no choice: not "Bira se", and no "Izaberi drugu prijavu".
    expect(word(closed)).toBe('Objavljen'); expect(closed.primary).toBeNull();
  });

  it('while the screen\'s search section is drawn it says the search itself, and the page adds only what happened', () => {
    const speaking = view({ stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 }, { search: { state: cancelled({ searchTimeAdmitted: false }), speaks: true } });
    expect(speaking.sentence).toBe('Dogovor je otkazan.');
    // Past its time the search does not "take applications again", with or without the section.
    expect(view({ stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 }, { search: { state: cancelled({ searchTimeAdmitted: false }), speaks: false } }).sentence)
      .toBe('Dogovor je otkazan.');
  });

  it('is not claimed when a place is covered (the counts cannot tell a cancelled Dogovor from a completed one), or when nothing was read', () => {
    const covered = view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijavaZaIzbor: 0 },
      { search: { state: search({ coveredSlots: 1, agreementCount: 2, activeAgreementCount: 1 }), speaks: false } });
    expect(covered.sentence).not.toMatch(/otkazan/);
    expect(view({ stanje: 'OBJAVLJENA', brojPrijava: 1, brojPrijavaZaIzbor: 0 }).sentence).not.toMatch(/otkazan/);
    expect(view({ stanje: 'OBJAVLJENA', brojPrijava: 1, brojPrijavaZaIzbor: 0 }, { search: { state: null, speaks: false } }).sentence).not.toMatch(/otkazan/);
    // No Dogovor ever, nothing cancelled.
    expect(view({ stanje: 'OBJAVLJENA' }, { search: { state: search(), speaks: false } }).sentence).not.toMatch(/otkazan/);
  });

  it('is never said about a draft or a task that ended', () => {
    for (const patch of [{ stanje: 'NACRT' as const }, { stanje: 'ZATVORENA' as const, kraj: 'CANCELLED' }]) {
      expect(view(patch, { search: { state: cancelled({ status: 'CANCELLED' }), speaks: false } }).sentence ?? '').not.toMatch(/Dogovor je otkazan/);
    }
  });
});

describe('the search closed by the owner', () => {
  it('is said once, word for word, and a closed search is never "Sva mesta su dogovorena"', () => {
    const early = view({ stanje: 'POPUNJENA', pokrivenost: HALF }, { remainingClosed: true });
    expect(early.note).toBe('1 od 2 dogovoreno · preostala potraga je zatvorena');
    expect(early.sentence).toBeNull();
    expect(word(early)).toBe('Dogovoren · 1 od 2');
    expect(early.primary).toMatchObject({ kind: 'AGREEMENTS' });
    for (const stanje of ['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA'] as const) {
      expect(view({ stanje, pokrivenost: HALF }, { remainingClosed: true }).note).toBe('1 od 2 dogovoreno · preostala potraga je zatvorena');
    }
    for (const stanje of ['NACRT', 'ZATVORENA'] as const) expect(view({ stanje, pokrivenost: HALF }, { remainingClosed: true }).note).toBeNull();
    expect(view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF }).note).toBeNull();
  });

  it('takes no choice: applications that wait are not "Bira se" and not a green action while the search is closed', () => {
    const closed = view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 2 }, { remainingClosed: true });
    expect(word(closed)).toBe('Dogovoren · 1 od 2');
    expect(closed.primary).toMatchObject({ kind: 'AGREEMENTS' });
  });
});

describe('a draft the publication gate holds back', () => {
  const held = (code: string, missingSlots: string[] = []): NeedPublicationReadiness => ({ kind: 'NOT_READY', code, missingSlots });
  const draft = (readiness?: NeedPublicationReadiness | null) => view({ stanje: 'NACRT' }, { readiness });

  it.each(['LOCATION_INCOMPLETE', 'COUNTRY_NOT_READY'])('%s is fixed in the conversation, so the one green action opens it', code => {
    const overview = draft(held(code));
    expect(overview.primary).toEqual({ kind: 'EDIT', label: 'Otvori razgovor i dopuni' });
    expect(overview.waits).toBe(false); expect(overview.sentence).toBeNull();
  });

  it.each(['PUBLIC_MEDIA_NOT_READY', 'POLICY_NOT_READY', 'POLICY_CONTENT_NOT_READY', 'EVALUATOR_UNAVAILABLE'])(
    '%s waits, or is not the owner\'s doing: no green action, and the page offers to read again', code => {
      const overview = draft(held(code));
      expect(overview.primary).toBeNull(); expect(overview.waits).toBe(true);
    });

  it('an answer the app does not know sends the owner to the review, which lists what is missing', () => {
    expect(draft(held('SOMETHING_ELSE')).primary).toEqual({ kind: 'REVIEW', label: 'Pregledaj za objavu' });
  });

  it.each([undefined, null, { kind: 'UNKNOWN' } as const, { kind: 'READY' } as const])('with %j the draft simply reviews', readiness => {
    const overview = draft(readiness as NeedPublicationReadiness | null | undefined);
    expect(overview.primary).toEqual({ kind: 'REVIEW', label: 'Pregledaj za objavu' }); expect(overview.sentence).toBe(DRAFT_NEXT); expect(overview.waits).toBe(false);
  });
});

describe('the green action', () => {
  it('is replaced, never joined, by the search recovery\'s own action, and what it replaced becomes a quiet row', () => {
    const agreed = view({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: HALF, brojPrijava: 2, brojPrijavaZaIzbor: 0 }, { overridden: true });
    expect(agreed.primary).toBeNull(); expect(agreed.rows).toEqual({ applications: true, agreements: true });
  });

  it('opens the Dogovori only when the screen can', () => {
    const without = view({ stanje: 'POPUNJENA', pokrivenost: FULL }, { canOpenAgreements: false });
    expect(without.primary).toBeNull(); expect(without.rows.agreements).toBe(false);
  });

  it('is never offered for a task that ended or has nothing to wait for: the sentence says what it waits for instead', () => {
    for (const patch of [{ stanje: 'ZATVORENA' as const, kraj: 'COMPLETED', pokrivenost: FULL }, { stanje: 'ZATVORENA' as const, kraj: 'CANCELLED' },
      { stanje: 'ZATVORENA' as const, kraj: 'EXPIRED' }, { stanje: 'OBJAVLJENA' as const }]) {
      const overview = view(patch);
      expect(overview.primary).toBeNull(); expect(overview.sentence).toBeTruthy();
    }
  });
});

describe('how many people a task still needs', () => {
  it('agrees the verb with the number, the way the noun agrees: it was "Nedostaje još 2 ljudi"', () => {
    expect([1, 2, 3, 4, 5, 11, 12, 14, 20, 21, 22, 25, 101, 102, 112].map(missingPeople)).toEqual([
      'Nedostaje još jedna osoba.', 'Nedostaju još 2 osobe.', 'Nedostaju još 3 osobe.', 'Nedostaju još 4 osobe.', 'Nedostaje još 5 osoba.',
      'Nedostaje još 11 osoba.', 'Nedostaje još 12 osoba.', 'Nedostaje još 14 osoba.', 'Nedostaje još 20 osoba.', 'Nedostaje još 21 osoba.',
      'Nedostaju još 22 osobe.', 'Nedostaje još 25 osoba.', 'Nedostaje još 101 osoba.', 'Nedostaju još 102 osobe.', 'Nedostaje još 112 osoba.']);
    for (const count of [1, 2, 5]) expect(missingPeople(count)).not.toMatch(/ljudi/);
  });
});

/**
 * R16 (2026-10-07): after a day without a single application the page says so, with the real ways to change it. Built behind a switch, OFF:
 * the owner's read of a task has no time of publication and no photo count yet (TRAŽI SERVER), and the card never guesses either.
 */
describe('R16: a day without an application, built behind a switch', () => {
  const published = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
  const WINDOW = (hours: number) => ({ kind: 'FIXED_WINDOW' as const, startsAt: '2026-10-10T08:00:00Z', endsAt: new Date(Date.parse('2026-10-10T08:00:00Z') + hours * 3_600_000).toISOString() });
  const help = (patch: Partial<PotrebaProjekcija> = {}, extra: Partial<Parameters<typeof noApplicationsHelp>[0]> = {}) =>
    noApplicationsHelp({ need: task({ stanje: 'OBJAVLJENA', brojPrijava: 0, schedule: WINDOW(4), ...patch }), now: NOW, on: true, publishedAt: published(30), photoCount: 0, canShare: true, canEdit: true, ...extra });

  it('is off, and says nothing, whatever the task and the data are', () => {
    expect(NO_APPLICATIONS_HELP_ON).toBe(false);
    expect(noApplicationsHelp({ need: task({ stanje: 'OBJAVLJENA', brojPrijava: 0 }), now: NOW, publishedAt: published(300), photoCount: 0, canShare: true, canEdit: true })).toBeNull();
  });

  it('says it from 24 hours, never before, for a published task that nobody applied to', () => {
    expect(NO_APPLICATIONS_AFTER_HOURS).toBe(24);
    expect(help({}, { publishedAt: published(23.9) })).toBeNull();
    expect(help({}, { publishedAt: published(24) })).toMatchObject({ sentence: 'Nema prijava već 24 sata.' });
    expect(help({}, { publishedAt: published(300) })).not.toBeNull();
    // Somebody applied, or the task is not a published one that waits: it is not silent.
    expect(help({ brojPrijava: 1 })).toBeNull();
    for (const stanje of ['NACRT', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA', 'POPUNJENA', 'ZATVORENA'] as const) expect(help({ stanje })).toBeNull();
  });

  it('is nothing without a time that is a time: it never guesses how long it has been', () => {
    for (const publishedAt of [null, undefined, '', 'sutra', '2026-10-05', '2026-13-45T10:00:00Z', 1_700_000_000_000 as unknown as string]) expect(help({}, { publishedAt })).toBeNull();
  });

  it('offers each real way only when this task makes it a real thing to do', () => {
    // A photo only when the task is KNOWN to have none; an unknown count is not zero.
    expect(help({}, { photoCount: 0 })!.actions).toContain('PHOTO');
    for (const photoCount of [1, 4, null, undefined]) expect(help({}, { photoCount })!.actions).not.toContain('PHOTO');
    // A term is "narrow" when it is fixed and no longer than two hours.
    expect(NARROW_TERM_HOURS).toBe(2);
    expect(help({ schedule: WINDOW(2) })!.actions).toContain('WIDEN_TERM');
    for (const schedule of [WINDOW(2.5), { kind: 'FLEXIBLE' as const, startsAt: '2026-10-10T08:00:00Z', endsAt: '2026-10-10T09:00:00Z' }, undefined]) expect(help({ schedule })!.actions).not.toContain('WIDEN_TERM');
    // What the page cannot do is not offered: the term is widened by editing, and a share needs a share sheet.
    expect(help({ schedule: WINDOW(1) }, { canEdit: false, canShare: true })!.actions).toEqual(['PHOTO', 'SHARE']);
    expect(help({}, { canShare: false })!.actions).toEqual(['PHOTO', 'EDIT']);
    expect(help({ schedule: WINDOW(1) })!.actions).toEqual(['PHOTO', 'WIDEN_TERM', 'SHARE', 'EDIT']);
  });

  it('is no card at all when no way is real: a card with nothing to press only complains', () => {
    expect(help({}, { photoCount: 3, canShare: false, canEdit: false })).toBeNull();
    expect(Object.keys(NO_APPLICATIONS_HELP_LABEL)).toEqual(['PHOTO', 'WIDEN_TERM', 'SHARE', 'EDIT']);
    expect(Object.values(NO_APPLICATIONS_HELP_LABEL)).toEqual(['Dodaj fotografiju', 'Proširi termin', 'Podeli zadatak', 'Izmeni zadatak']);
  });
});
