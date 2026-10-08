import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { HOME_WAITING_LIMIT, composeHome, draftIsFresh, needsTerm, type HomeReads } from '../homeSnapshot';

const ME = 'me', OTHER = 'other';
const need = (id: string, patch: Partial<PotrebaProjekcija> = {}): PotrebaProjekcija => ({ id, revizija: 1, naslov: `Zadatak ${id}`, opis: '',
  stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'sutra 17–19', podrucjeTekst: 'Liman',
  uslovi: [], brojPrijava: 0, ...patch } as PotrebaProjekcija);
const application = (id: string, patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: id, potrebaId: `n-${id}`,
  potrebaRevizija: 1, prijavaRevizija: 1, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: `Tuđ zadatak ${id}`, opis: '',
  cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' }, pokrivaMesta: 1, napomena: '', podrucjeTekst: 'Detelinara', vremeTekst: 'subota',
  dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const agreement = (id: string, mine: 'narucilac' | 'uskocer', patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija => ({ id, verzija: 1,
  naslov: `Dogovor ${id}`, stanje: 'CONFIRMED', cena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' }, vremeTekst: 'danas 17h', putanjaTekst: '',
  pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: ME, profilId: null, ime: 'Ja', inicijali: 'JA', uloga: mine, mesta: null, viSte: true, telefon: null },
    { id: OTHER, profilId: null, ime: 'Jelena', inicijali: 'JE', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', mesta: 1, viSte: false, telefon: null }],
  rezim: 'FIZICKI', kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, ...patch });
const known = <T,>(value: T) => ({ kind: 'known' as const, value });
it('unknown review eligibility keeps the active appointment but cannot claim an exact count or a singleton shortcut', () => {
  const home = composeHome({ needs: known([]), applications: known([]), agreements: known([
    agreement('next', 'uskocer'),
    agreement('due', 'uskocer', { stanje: 'COMPLETED', ocenaMoguca: true, stanjeProvereOcene: 'DUE' }),
    agreement('unknown', 'uskocer', { stanje: 'COMPLETED', ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' }),
  ]) });
  expect(home.ratingsDue).toBeNull(); expect(home.ratingDueAgreementId).toBeNull(); expect(home.partial).toBe(true);
  expect(home.agreements).toMatchObject({ kind: 'known', value: { rows: [{ id: 'agreement:next' }] } });
});
const reads = (patch: Partial<HomeReads> = {}): HomeReads => ({ needs: known([]), applications: known([]), agreements: known([]), ...patch });

test('PKG-035: history stays visible but only selectable applications require attention', () => {
  const historical = Object.assign(need('history', { brojPrijava: 7 }), { brojPrijavaZaIzbor: 0 });
  const actionable = Object.assign(need('choice', { brojPrijava: 9 }), { brojPrijavaZaIzbor: 2 });
  const home = composeHome(reads({ needs: known([historical, actionable]) }));
  expect(home.attention).toEqual([{ id: 'need:choice:applications', title: '2 prijave',
    detail: 'Zadatak choice · čeka tvoj izbor', target: { kind: 'CANDIDATES', needId: 'choice' } }]);
  expect(home.attentionMore).toBe(0);
  // Both stay active tasks (history is not hidden); only the one with a selectable application waits for a choice.
  // (The activity preview that showed "7 prijava" is retired, 2026-09-23; the count is Početna's "Moji zadaci" row.)
  expect(home.mine.tasks).toEqual(known({ total: 2, active: 2, waiting: 1, drafts: 0, history: 0 }));
});

test('PKG-035: historical totals never substitute for an unknown actionable count', () => {
  const home = composeHome(reads({ needs: known([need('legacy', { brojPrijava: 7 })]) }));
  expect(home.attention).toEqual([]);
});

describe('Početna — composed from the reads that already exist, with no mode', () => {
  it('an account with nothing has no attention, no rows and no invented numbers, and is a first run', () => {
    expect(composeHome(reads())).toEqual({ attention: [], attentionMore: 0, agreements: known({ rows: [], more: 0 }),
      mine: { tasks: known({ total: 0, active: 0, waiting: 0, drafts: 0, history: 0 }), applications: known({ total: 0, attention: 0, active: 0, finished: 0 }) },
      // ratingDueAgreementId (2026-09-24): the empty account has no rating to open.
      partial: false, firstRun: true, ratingsDue: 0, ratingDueAgreementId: null });
  });

  it('is a first run only when every read answered and nothing exists at all', () => {
    expect(composeHome(reads({ needs: known([need('done', { stanje: 'ZATVORENA' })]) })).firstRun).toBe(false);
    expect(composeHome(reads({ agreements: known([agreement('old', 'uskocer', { stanje: 'COMPLETED' })]) })).firstRun).toBe(false);
    expect(composeHome(reads({ applications: { kind: 'unavailable' } })).firstRun).toBe(false);
    expect(composeHome(reads(), { kind: 'unavailable' }).firstRun).toBe(false);
    expect(composeHome(reads(), { kind: 'known', value: { rows: [], more: 0, asOf: '2026-09-23T10:00:00Z' } }).firstRun).toBe(true);
  });

  it("names the completed Dogovori that still wait for my rating, the same ones Dogovori/Aktivni lists (2026-09-23)", () => {
    const home = composeHome(reads({ agreements: known([agreement("done-1", "uskocer", { stanje: "COMPLETED", ocenaMoguca: true }),
      agreement("done-2", "uskocer", { stanje: "COMPLETED", ocenaMoguca: true }), agreement("rated", "uskocer", { stanje: "COMPLETED", ocenaMoguca: false }),
      agreement("soon", "narucilac")]) }));
    expect(home.ratingsDue).toBe(2);
    // A completed Dogovor is not a next one: the scheduled list keeps only the confirmed one.
    expect(home.agreements).toEqual(known({ more: 0, rows: [expect.objectContaining({ id: "agreement:soon" })] }));
  });

  it('holds both sides of one account at once and says on the next Dogovor what I am to it', () => {
    const home = composeHome(reads({ needs: known([need('a')]), applications: known([application('c')]),
      agreements: known([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]) }));
    expect(home.mine).toEqual({ tasks: known({ total: 1, active: 1, waiting: 0, drafts: 0, history: 0 }),
      applications: known({ total: 1, attention: 0, active: 1, finished: 0 }) });
    // One next Dogovor (2026-09-23); the other is one tab away and is counted, not dropped.
    // The other side's profile id and initials ride along for their face (2026-10-07); a Dogovor with no accepted instant has no Raspored.
    expect(home.agreements).toEqual(known({ more: 1, rows: [
      { id: 'agreement:g-a', title: 'Dogovor g-a', detail: 'Tvoj zadatak · Jelena · danas 17h', target: { kind: 'AGREEMENT', agreementId: 'g-a' },
        appointment: { timeText: 'danas 17h', counterpartName: 'Jelena', roleLabel: 'Tvoj zadatak', counterpartProfileId: null, counterpartInitials: 'JE' } }] }));
    expect(composeHome(reads({ agreements: known([agreement('g-c', 'uskocer')]) })).agreements).toEqual(known({ more: 0, rows: [
      { id: 'agreement:g-c', title: 'Dogovor g-c', detail: 'Uskačeš · Jelena · danas 17h', target: { kind: 'AGREEMENT', agreementId: 'g-c' },
        appointment: { timeText: 'danas 17h', counterpartName: 'Jelena', roleLabel: 'Uskačeš', counterpartProfileId: null, counterpartInitials: 'JE' } }] }));
    expect(home.firstRun).toBe(false);
  });

  it.each(['25. sep · 17:00–19:00', 'Fleksibilno · tokom sledeće nedelje', ''])(
    'keeps the supplied appointment time %j and person separate without deriving a date from the sorting key', timeText => {
      const source = agreement('structured', 'uskocer', { vremeTekst: timeText, pocinje: '2026-09-25T09:00:00Z' });
      source.ucesnici[1].ime = 'Jelena · Servis';
      const home = composeHome(reads({ agreements: known([source]) }));
      expect(home.agreements.kind).toBe('known');
      if (home.agreements.kind !== 'known') return;
      expect(home.agreements.value.rows[0]).toMatchObject({
        appointment: { timeText, counterpartName: 'Jelena · Servis', roleLabel: 'Uskačeš' },
        detail: ['Uskačeš', 'Jelena · Servis', timeText].filter(Boolean).join(' · '),
      });
    });

  it('does not invent a role or date when the Agreement has no participant or time display', () => {
    const home = composeHome(reads({ agreements: known([agreement('unknown', 'uskocer', { ucesnici: [], vremeTekst: '' })]) }));
    expect(home.agreements).toEqual(known({ more: 0, rows: [{
      id: 'agreement:unknown', title: 'Dogovor unknown', target: { kind: 'AGREEMENT', agreementId: 'unknown' },
      detail: 'Druga strana', appointment: { timeText: '', counterpartName: 'Druga strana', roleLabel: null,
        counterpartProfileId: null, counterpartInitials: null },
    }] }));
  });

  it('orders attention by what blocks a person first, bounds it, and counts the rest honestly', () => {
    const home = composeHome(reads({
      needs: known([need('a', { brojPrijava: 3, brojPrijavaZaIzbor: 3 }), need('b', { brojPrijava: 1, brojPrijavaZaIzbor: 1 })]),
      applications: known([application('c', { stanje: 'STALE_REVIEW_REQUIRED', promenjenaPotreba: true })]),
      agreements: known([agreement('g', 'narucilac', { stanje: 'AWAITING_REQUESTER' }), agreement('p', 'uskocer', { problemOtvoren: true })]) }));
    expect(home.attention.map(item => item.id)).toEqual(['agreement:g:confirm', 'agreement:p:problem', 'application:c:stale']);
    expect(home.attention[0]).toEqual({ id: 'agreement:g:confirm', title: 'Potvrdi završetak', detail: 'Dogovor g · završetak je označen i čeka tvoju potvrdu',
      target: { kind: 'AGREEMENT', agreementId: 'g' } });
    expect(home.attentionMore).toBe(2);
  });

  it('words the attention flag the server set on an application without guessing its reason', () => {
    const home = composeHome(reads({ applications: known([application('c', { traziPaznju: true })]) }));
    expect(home.attention).toEqual([{ id: 'application:c:attention', title: 'Prijava traži tvoju pažnju', detail: 'Tuđ zadatak c · otvori svoju prijavu',
      target: { kind: 'APPLICATION', applicationId: 'c' } }]);
  });

  it('a worker waiting for the requester is not asked to confirm anything', () => {
    expect(composeHome(reads({ agreements: known([agreement('g', 'uskocer', { stanje: 'AWAITING_REQUESTER' })]) })).attention).toEqual([]);
  });

  it('a section that could not be read is unavailable, never empty or zero, and the rest still stands', () => {
    const home = composeHome(reads({ needs: { kind: 'unavailable' }, applications: known([application('c')]) }));
    expect(home.partial).toBe(true); expect(home.firstRun).toBe(false);
    expect(home.mine).toEqual({ tasks: { kind: 'unavailable' }, applications: known({ total: 1, attention: 0, active: 1, finished: 0 }) });
    expect(composeHome(reads({ needs: { kind: 'unavailable' }, applications: { kind: 'unavailable' } })).mine)
      .toEqual({ tasks: { kind: 'unavailable' }, applications: { kind: 'unavailable' } });
    expect(composeHome(reads({ agreements: { kind: 'unavailable' } })).agreements).toEqual({ kind: 'unavailable' });
  });

  it('counts each side by the rule of the list it opens, and shows the one next Dogovor', () => {
    const home = composeHome(reads({
      needs: known([...Array.from({ length: 6 }, (_, i) => need(`n${i}`)), need('choice', { brojPrijava: 2, brojPrijavaZaIzbor: 2 }),
        need('done', { stanje: 'ZATVORENA' }), need('draft', { stanje: 'NACRT' })]),
      applications: known([application('x'), application('y'), application('t', { traziPaznju: true }), application('w', { stanje: 'WITHDRAWN' }),
        application('s', { stanje: 'SELECTED', dogovorId: 'g' })]),
      agreements: known([agreement('1', 'narucilac'), agreement('2', 'uskocer'), agreement('3', 'uskocer'), agreement('old', 'uskocer', { stanje: 'COMPLETED' })]) }));
    // Moji zadaci: Aktivni 7 (one of them waits for a choice), Nacrti 1, Istorija 1.
    expect(home.mine.tasks).toEqual(known({ total: 9, active: 7, waiting: 1, drafts: 1, history: 1 }));
    // Moje prijave: Čeka te 1, Aktivne 2, Završene 2 (withdrawn and selected).
    expect(home.mine.applications).toEqual(known({ total: 5, attention: 1, active: 2, finished: 2 }));
    expect(home.agreements).toEqual(known({ more: 2, rows: [expect.objectContaining({ id: 'agreement:1' })] }));
  });

  it('a draft is counted as a draft, never as an active task', () => {
    const home = composeHome(reads({ needs: known([need('d', { stanje: 'NACRT', brojPrijavaZaIzbor: 1 })]) }));
    expect(home.mine.tasks).toEqual(known({ total: 1, active: 0, waiting: 0, drafts: 1, history: 0 }));
  });
});

// "Moje aktivnosti" redirects to Početna since 2026-09-24 (it had no entry left), so its composition and the cases
// that held it are gone; Početna's own doors and "Čeka te" are covered above and in v3-home-screen.

describe('one completed Dogovor waiting for my rating (emulator critique A1, 2026-09-24)', () => {
  const done = (id: string, due: boolean) => agreement(id, 'uskocer', { stanje: 'COMPLETED', ocenaMoguca: due });
  it('names the one Dogovor the read already gave, so Početna can open its rating in one tap', () => {
    const home = composeHome(reads({ agreements: known([done('only', true), done('rated', false), agreement('soon', 'narucilac')]) }));
    expect(home.ratingsDue).toBe(1); expect(home.ratingDueAgreementId).toBe('only');
  });
  it('names none when several wait or the Dogovori could not be read: Početna then opens Dogovori', () => {
    expect(composeHome(reads({ agreements: known([done('a', true), done('b', true)]) })).ratingDueAgreementId).toBeNull();
    expect(composeHome(reads({ agreements: { kind: 'unavailable' } })).ratingDueAgreementId).toBeNull();
  });
});

describe('the next accepted appointment', () => {
  const now = Date.parse('2026-09-27T10:00:00Z');
  it('shows the soonest accepted future term, ahead of undated or past active Agreements', () => {
    const rows = [
      agreement('awaiting', 'narucilac', { stanje: 'AWAITING_REQUESTER', prihvacenPocetak: '2026-09-26T09:00:00Z' }),
      agreement('later', 'narucilac', { prihvacenPocetak: '2026-09-29T09:00:00Z' }),
      agreement('undated', 'uskocer', { pocinje: '2026-09-27T11:00:00Z' }),
      agreement('soonest', 'uskocer', { prihvacenPocetak: '2026-09-28T07:00:00Z', pocinje: '2026-09-30T07:00:00Z' }),
    ];
    const home = composeHome(reads({ agreements: known(rows) }), undefined, now);
    expect(home.agreements.kind).toBe('known');
    if (home.agreements.kind !== 'known') return;
    expect(home.agreements.value.rows).toEqual([expect.objectContaining({ id: 'agreement:soonest', upcoming: true })]);
    expect(home.agreements.value.more).toBe(3);
    const rest = composeHome(reads({ agreements: known(rows.filter(row => row.id !== 'soonest')) }), undefined, now);
    expect(rest.agreements.kind === 'known' ? rest.agreements.value.rows.map(row => row.id) : null).toEqual(['agreement:later']);
  });

  it.each([undefined, null, 'not-a-date', '2026-02-30T09:00:00Z', '2026-09-26T09:00:00Z'])(
    'keeps a neutral server-ordered fallback for accepted start %j, regardless of source-task dates', accepted => {
      const home = composeHome(reads({ agreements: known([
        agreement('first', 'uskocer', { prihvacenPocetak: accepted, pocinje: '2026-10-01T09:00:00Z' }),
        agreement('second', 'narucilac', { pocinje: '2026-09-28T09:00:00Z' }),
      ]) }), undefined, now);
      expect(home.agreements).toEqual(known({ more: 1, rows: [expect.objectContaining({ id: 'agreement:first' })] }));
      if (home.agreements.kind === 'known') expect(home.agreements.value.rows[0]).not.toHaveProperty('upcoming');
    });

  it('compares accepted instants across offsets, preserves tie order and leaves the display text unchanged', () => {
    const source = [
      agreement('later', 'uskocer', { prihvacenPocetak: '2026-09-28T08:30:00Z' }),
      agreement('first-tie', 'uskocer', { prihvacenPocetak: '2026-09-28T10:00:00+02:00', vremeTekst: '28. sep · 10:00' }),
      agreement('second-tie', 'uskocer', { prihvacenPocetak: '2026-09-28T08:00:00Z' }),
    ];
    const home = composeHome(reads({ agreements: known(source) }), undefined, now);
    expect(home.agreements).toEqual(known({ more: 2, rows: [expect.objectContaining({ id: 'agreement:first-tie', upcoming: true,
      appointment: expect.objectContaining({ timeText: '28. sep · 10:00' }) })] }));
    expect(source.map(row => row.id)).toEqual(['later', 'first-tie', 'second-tie']);
  });

  it('never calls awaiting completion or completed work upcoming, even with a future accepted timestamp', () => {
    const accepted = '2026-09-28T08:00:00Z';
    const home = composeHome(reads({ agreements: known([
      agreement('done', 'uskocer', { stanje: 'COMPLETED', ocenaMoguca: true, prihvacenPocetak: accepted }),
      agreement('awaiting', 'narucilac', { stanje: 'AWAITING_REQUESTER', prihvacenPocetak: accepted }),
    ]) }), undefined, now);
    expect(home.agreements).toEqual(known({ more: 0, rows: [expect.objectContaining({ id: 'agreement:awaiting' })] }));
    if (home.agreements.kind === 'known') expect(home.agreements.value.rows[0]).not.toHaveProperty('upcoming');
    expect(home.ratingsDue).toBe(1); expect(home.ratingDueAgreementId).toBe('done');
  });
});

// Coordinator, 2026-10-07: on the owner's account Početna used to show "Aktivni Dogovor … Termin nije potvrđen". A Dogovor
// with no day to show it on must not vanish: with no appointment ahead it is counted in one quiet line, in Dogovori. Two kinds
// have no day: a term that is not confirmed (no start, no end), and a confirmed Dogovor whose exact term has passed unfinished.
describe('Raspored without a card: active Dogovori with no day to show them on', () => {
  const now = Date.parse('2026-09-27T10:00:00Z');
  const unconfirmed = (id: string, mine: 'narucilac' | 'uskocer' = 'uskocer', patch: Partial<DogovorProjekcija> = {}) =>
    agreement(id, mine, { vremeTekst: 'Termin nije potvrđen', prihvacenPocetak: null, tacanTermin: null, ...patch });
  /** Confirmed, its exact term ended on 26 September (before "now") and nobody has marked it done. */
  const overdue = (id: string, patch: Partial<DogovorProjekcija> = {}) => agreement(id, 'uskocer', { prihvacenPocetak: '2026-09-26T07:00:00Z',
    tacanTermin: { pocetak: '2026-09-26T07:00:00Z', kraj: '2026-09-26T08:00:00Z' }, ...patch });
  const quiet = (home: ReturnType<typeof composeHome>) => home.agreements.kind === 'known' ? home.agreements.value.quietLine : null;
  const quietKey = (home: ReturnType<typeof composeHome>) => home.agreements.kind === 'known' ? 'quietLine' in home.agreements.value : null;

  it('a term that is not confirmed stays on Početna as one quiet line, with the Dogovor itself a row without Raspored words', () => {
    const home = composeHome(reads({ agreements: known([unconfirmed('krecenje', 'narucilac')]) }), undefined, now);
    expect(home.agreements).toEqual(known({ more: 0, quietLine: '1 Dogovor bez tačnog termina',
      rows: [expect.objectContaining({ id: 'agreement:krecenje', appointment: expect.objectContaining({ timeText: 'Termin nije potvrđen' }) })] }));
    if (home.agreements.kind === 'known') {
      expect(home.agreements.value.rows[0]).not.toHaveProperty('raspored'); expect(home.agreements.value.rows[0]).not.toHaveProperty('upcoming');
    }
  });

  it.each([[2, '2 Dogovora bez tačnog termina'], [5, '5 Dogovora bez tačnog termina'], [21, '21 Dogovor bez tačnog termina']])(
    'counts %i of them in its Serbian form', (count, line) => {
      const home = composeHome(reads({ agreements: known(Array.from({ length: count }, (_, index) => unconfirmed(`n${index}`))) }), undefined, now);
      expect(quiet(home)).toBe(line);
    });

  it('a confirmed Dogovor whose exact term has passed unfinished is counted as waiting to be finished, with the verb agreeing', () => {
    expect(quiet(composeHome(reads({ agreements: known([overdue('a')]) }), undefined, now))).toBe('1 Dogovor čeka završetak');
    expect(quiet(composeHome(reads({ agreements: known([overdue('a'), overdue('b')]) }), undefined, now))).toBe('2 Dogovora čekaju završetak');
    expect(quiet(composeHome(reads({ agreements: known([overdue('a'), overdue('b'), overdue('c'), overdue('d'), overdue('e')]) }), undefined, now)))
      .toBe('5 Dogovora čeka završetak');
    // Joined with " · " to the other part, the unconfirmed ones first.
    expect(quiet(composeHome(reads({ agreements: known([overdue('a'), overdue('b'), unconfirmed('flex')]) }), undefined, now)))
      .toBe('1 Dogovor bez tačnog termina · 2 Dogovora čekaju završetak');
  });

  it('is left to the card when an appointment lies ahead: the same counts ride in the card\'s own grey line', () => {
    const home = composeHome(reads({ agreements: known([agreement('soon', 'uskocer', { prihvacenPocetak: '2026-09-28T07:00:00Z',
      tacanTermin: { pocetak: '2026-09-28T07:00:00Z', kraj: '2026-09-28T08:00:00Z' } }), unconfirmed('krecenje'), overdue('a')]) }), undefined, now, 'Europe/Belgrade');
    expect(quietKey(home)).toBe(false);
    expect(home.agreements.kind === 'known' ? home.agreements.value.rows[0].raspored : null).toMatchObject({
      when: 'Sutra · 09:00–10:00', more: '1 Dogovor bez tačnog termina · 1 Dogovor čeka završetak' });
  });

  it('says nothing when no active Dogovor has lost its day, and a Dogovori read that failed is still unavailable', () => {
    for (const agreements of [[], [agreement('unknown', 'uskocer')], [unconfirmed('done', 'uskocer', { stanje: 'COMPLETED' })],
      // Marked done, finished or cancelled: nobody is waiting for it to be finished.
      [overdue('marked', { stanje: 'AWAITING_REQUESTER' }), overdue('finished', { stanje: 'COMPLETED' }), overdue('cancelled', { stanje: 'CANCELLED' })]]) {
      const home = composeHome(reads({ agreements: known(agreements) }), undefined, now);
      expect(quietKey(home)).toBe(false);
    }
    expect(composeHome(reads({ agreements: { kind: 'unavailable' } }), undefined, now).agreements).toEqual({ kind: 'unavailable' });
  });

  it('cannot tell without a term or a clock: a lone start has no end to have passed, and an unreadable "now" passes nothing', () => {
    // A start with no end is a Dogovor with no exact term, not one that waits to be finished.
    expect(quiet(composeHome(reads({ agreements: known([agreement('lone', 'uskocer', { prihvacenPocetak: '2026-09-26T07:00:00Z', tacanTermin: null })]) }), undefined, now)))
      .toBe('1 Dogovor bez tačnog termina');
    expect(quietKey(composeHome(reads({ agreements: known([overdue('a')]) }), undefined, Number.NaN))).toBe(false);
  });
});

// UI/UX pass, 2026-10-08 (F1): "Početna ne laže". Things that wait for me and that only the reads Home already makes can tell
// (R02 a Dogovor with no term, a change the other side proposed, R18 a draft) join the server's rows in "Čeka te", after them.
describe('what the phone adds to "Čeka te" (R02, a change to answer, R18)', () => {
  const now = Date.parse('2026-09-27T10:00:00Z');
  /** A confirmed Dogovor whose accepted terms say neither a window nor a start. */
  const termless = (id: string, patch: Partial<DogovorProjekcija> = {}) => agreement(id, 'narucilac', { naslov: `Krečenje ${id}`,
    prihvacenPocetak: null, tacanTermin: null, ...patch });
  const prompts = (home: ReturnType<typeof composeHome>) => (home.prompts ?? []).map(row => [row.id, row.title, row.taskTitle, row.detail, row.target]);

  it('names a confirmed Dogovor with no term and opens the form that proposes one (R02), for either side', () => {
    for (const mine of ['narucilac', 'uskocer'] as const) {
      const home = composeHome(reads({ agreements: known([agreement('k', mine, { naslov: 'Krečenje stana', prihvacenPocetak: null, tacanTermin: null })]) }), undefined, now);
      expect(prompts(home)).toEqual([['agreement:k:term', 'Predloži termin', 'Krečenje stana', 'Termin još nije dogovoren.', { kind: 'AGREEMENT_TERM', agreementId: 'k' }]]);
      expect(home.promptsMore).toBeUndefined();
    }
  });

  it('says nothing about a term it cannot know: a list that did not read the terms, a lone start, a finished or marked-done Dogovor', () => {
    for (const row of [agreement('unread', 'uskocer'), termless('lone', { prihvacenPocetak: '2026-09-28T07:00:00Z' }),
      termless('window', { prihvacenPocetak: '2026-09-28T07:00:00Z', tacanTermin: { pocetak: '2026-09-28T07:00:00Z', kraj: '2026-09-28T08:00:00Z' } }),
      termless('done', { stanje: 'COMPLETED' }), termless('marked', { stanje: 'AWAITING_REQUESTER' }), termless('cancelled', { stanje: 'CANCELLED' })]) {
      expect([row.id, needsTerm(row), composeHome(reads({ agreements: known([row]) }), undefined, now).prompts]).toEqual([row.id, false, undefined]);
    }
    expect(needsTerm(termless('yes'))).toBe(true);
  });

  it('a change that is already waiting gives the term to that change: no second row, and the other side\'s proposal is a row of its own', () => {
    const mine = termless('mine', { izmenaCeka: { predlogId: 'p1', mojPredlog: true } });
    expect(composeHome(reads({ agreements: known([mine]) }), undefined, now).prompts).toBeUndefined();
    const theirs = termless('theirs', { naslov: 'Montaža police', izmenaCeka: { predlogId: 'p2', mojPredlog: false } });
    expect(prompts(composeHome(reads({ agreements: known([theirs]) }), undefined, now))).toEqual([
      ['agreement:theirs:change', 'Odgovori na predlog izmene', 'Montaža police', 'Druga strana predlaže izmenu uslova.', { kind: 'AGREEMENT_CHANGE', agreementId: 'theirs' }]]);
  });

  it('offers one draft with a title to continue (R18); a draft with no title, and a published task, are not offered', () => {
    const draft = (id: string, patch: Partial<PotrebaProjekcija> = {}) => need(id, { stanje: 'NACRT', naslov: `Nacrt ${id}`, ...patch });
    const home = composeHome(reads({ needs: known([draft('a'), draft('b'), need('published')]) }), undefined, now);
    expect(prompts(home)).toEqual([['need:a:draft', 'Nastavi nacrt', 'Nacrt a', 'Nacrt još nije objavljen.', { kind: 'NEED', needId: 'a' }]]);
    expect(composeHome(reads({ needs: known([draft('empty', { naslov: '   ' })]) }), undefined, now).prompts).toBeUndefined();
    expect(composeHome(reads({ needs: known([need('published')]) }), undefined, now).prompts).toBeUndefined();
  });

  it('applies the seven days as soon as the read says when the draft was last changed, and an age it cannot read is not an old one', () => {
    const day = 86_400_000, at = (days: number) => new Date(now - days * day).toISOString();
    expect([draftIsFresh(at(1), now), draftIsFresh(at(7), now), draftIsFresh(at(8), now)]).toEqual([true, true, false]);
    for (const unknown of [undefined, null, 'not a date']) expect(draftIsFresh(unknown, now)).toBe(true);
    expect(draftIsFresh(at(30), Number.NaN)).toBe(true);
    const old = Object.assign(need('old', { stanje: 'NACRT', naslov: 'Stari nacrt' }), { azurirano: at(30) });
    const fresh = Object.assign(need('fresh', { stanje: 'NACRT', naslov: 'Svež nacrt' }), { azurirano: at(2) });
    expect(prompts(composeHome(reads({ needs: known([old]) }), undefined, now))).toEqual([]);
    expect(prompts(composeHome(reads({ needs: known([fresh]) }), undefined, now)).map(row => row[0])).toEqual(['need:fresh:draft']);
  });

  it('puts the waiting change first, then the term, then the draft, behind the server\'s own rows, four rows together at most', () => {
    const rows = [termless('t1'), termless('t2'), termless('c', { izmenaCeka: { predlogId: 'p', mojPredlog: false } })];
    const needs = known([need('d', { stanje: 'NACRT', naslov: 'Nacrt d' })]);
    const alone = composeHome(reads({ agreements: known(rows), needs }), undefined, now);
    expect((alone.prompts ?? []).map(row => row.id)).toEqual(['agreement:c:change', 'agreement:t1:term', 'agreement:t2:term', 'need:d:draft']);
    expect(alone.promptsMore).toBeUndefined();
    // With two of the server's rows there are two places left, and what did not fit is counted, never dropped silently.
    const server = { kind: 'known' as const, value: { rows: [0, 1].map(index => ({ id: `s${index}`, title: 'Potvrdi završetak', detail: 'x',
      target: { kind: 'AGREEMENT' as const, agreementId: `s${index}` } })), more: 0, asOf: '2026-09-27T09:00:00Z' } };
    const crowded = composeHome(reads({ agreements: known(rows), needs }), server, now);
    expect(HOME_WAITING_LIMIT).toBe(4);
    expect((crowded.prompts ?? []).map(row => row.id)).toEqual(['agreement:c:change', 'agreement:t1:term']);
    expect(crowded.promptsMore).toBe(2);
    expect(crowded.attention).toHaveLength(2); expect(crowded.attentionMore).toBe(0);
  });

  it('a prompt is not a count of the server: attention, its "more" and the first run are what they were', () => {
    const home = composeHome(reads({ agreements: known([termless('t')]) }), undefined, now);
    expect(home.attention).toEqual([]); expect(home.attentionMore).toBe(0); expect(home.firstRun).toBe(false);
  });
});

describe('the work profile (R20, R06)', () => {
  const now = Date.parse('2026-09-27T10:00:00Z');
  const profile = (patch: object) => composeHome(reads({ workerProfile: known({ stanje: 'ACTIVE', dostupanOdmah: false, ...patch } as never) }), undefined, now).workerProfile;

  it('is absent when it was not read, and says "none" for an account that has no profile', () => {
    expect(composeHome(reads(), undefined, now)).not.toHaveProperty('workerProfile');
    expect(composeHome(reads({ workerProfile: known(null) }), undefined, now).workerProfile).toEqual(known({ state: 'NONE', availableNow: false }));
  });

  it('carries the state and the status of a profile that exists', () => {
    expect(profile({ stanje: 'DRAFT' })).toEqual(known({ state: 'DRAFT', availableNow: false }));
    expect(profile({ stanje: 'ACTIVE', dostupanOdmah: true })).toEqual(known({ state: 'ACTIVE', availableNow: true }));
    expect(profile({ stanje: 'SUSPENDED' })).toEqual(known({ state: 'SUSPENDED', availableNow: false }));
  });

  it('a profile that could not be read is unavailable, and it never makes the screen partial', () => {
    const home = composeHome(reads({ workerProfile: { kind: 'unavailable' } }), { kind: 'known', value: { rows: [], more: 0, asOf: '2026-09-27T09:00:00Z' } }, now);
    expect(home.workerProfile).toEqual({ kind: 'unavailable' });
    expect(home.partial).toBe(false); expect(home.firstRun).toBe(true);
  });
});
