import type { DogovorProjekcija, UcesnikProjekcija } from '../../../contracts/projections';
import {
  AGREEMENT_GROUP_ORDER, AGREEMENT_GROUP_TITLES, agreementAttention, agreementChip, agreementGroupOf, agreementInProgress, agreementWhen,
  cancellationLine, filterHistory, groupActiveAgreements, isActiveAgreement, type AgreementGroupKey,
} from '../agreementListModel';

/**
 * The Dogovori list decides without drawing (plan 2.6): who waits for me, which group of Aktivni a Dogovor stands in, how its
 * time reads, which chip it wears. Every day is the day in SERBIAN time, taken from the accepted instant; Jest runs in UTC, so a
 * day that is computed from the phone's zone would fail these cases at the midnight edges.
 *
 * "Now" is Wednesday 7 October 2026, 12:00 in Belgrade (10:00 UTC, CEST = UTC+2): the week is Monday 5 to Sunday 11 October.
 */
const NOW = new Date('2026-10-07T10:00:00Z');
const person = (uloga: 'narucilac' | 'uskocer', me: boolean): UcesnikProjekcija =>
  ({ id: me ? 'me' : 'other', profilId: null, ime: me ? 'Ja' : 'Marko', inicijali: me ? 'JA' : 'MA', uloga, mesta: null, viSte: me, telefon: null });
const agreement = (id: string, patch: Partial<DogovorProjekcija> = {}, mine: 'narucilac' | 'uskocer' = 'narucilac'): DogovorProjekcija => ({
  id, verzija: 1, naslov: `Zadatak ${id}`, stanje: 'CONFIRMED', cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' },
  vremeTekst: 'Termin nije potvrđen', putanjaTekst: 'Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
  ucesnici: [person(mine, true), person(mine === 'narucilac' ? 'uskocer' : 'narucilac', false)], rezim: 'FIZICKI',
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null,
  izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, ...patch });
const starting = (iso: string, patch: Partial<DogovorProjekcija> = {}) => ({ prihvacenPocetak: iso, ...patch });
const groupOf = (iso: string | null, now = NOW, patch: Partial<DogovorProjekcija> = {}): AgreementGroupKey =>
  agreementGroupOf(agreement('x', { prihvacenPocetak: iso, ...patch }), now);

describe('the day groups, taken in Serbian time from the accepted start', () => {
  it('names the six groups of the plan in its order, and the one more it needs for a day already behind us', () => {
    expect(AGREEMENT_GROUP_ORDER.map(key => AGREEMENT_GROUP_TITLES[key])).toEqual(
      ['Čeka tebe', 'Ranije', 'Danas', 'Sutra', 'Ove nedelje', 'Kasnije', 'Bez tačnog termina']);
  });

  it('puts today, tomorrow, the rest of this week, later, and no term in their groups', () => {
    expect(groupOf('2026-10-07T14:00:00Z')).toBe('today');         // 16:00 today
    expect(groupOf('2026-10-08T07:00:00Z')).toBe('tomorrow');      // Thursday 09:00
    expect(groupOf('2026-10-09T10:00:00Z')).toBe('week');          // Friday
    expect(groupOf('2026-10-11T18:00:00Z')).toBe('week');          // Sunday 20:00 is still this week
    expect(groupOf('2026-10-12T07:00:00Z')).toBe('later');         // next Monday
    expect(groupOf('2026-12-24T10:00:00Z')).toBe('later');
    expect(groupOf(null)).toBe('undated');
    expect(groupOf('not a time')).toBe('undated');
    expect(groupOf('2026-02-30T10:00:00Z')).toBe('undated');       // an impossible date is no term, not a guess
  });

  it('puts an active Dogovor whose day is behind us under "Ranije", not under "Danas"', () => {
    expect(groupOf('2026-10-06T10:00:00Z')).toBe('past');
    expect(groupOf('2026-09-01T10:00:00Z', NOW, { stanje: 'AWAITING_REQUESTER', ucesnici: [person('uskocer', true), person('narucilac', false)] })).toBe('past');
  });

  it('cuts the day at Serbian midnight, not at UTC midnight and not at the phone\'s', () => {
    // 21:59:59Z is 23:59:59 on the 7th in Belgrade; 22:00:00Z is 00:00:00 on the 8th.
    const justBefore = new Date('2026-10-07T21:59:30Z');
    expect(groupOf('2026-10-07T21:59:59Z', justBefore)).toBe('today');
    expect(groupOf('2026-10-07T22:00:00Z', justBefore)).toBe('tomorrow');
    // A UTC reading would call 22:30Z on the 7th "today" (it is 00:30 on the 8th) and 00:30Z on the 8th "tomorrow" (it is 02:30).
    expect(groupOf('2026-10-07T22:30:00Z', NOW)).toBe('tomorrow');
    expect(groupOf('2026-10-07T23:59:59Z', NOW)).toBe('tomorrow');
    // One second later it is the 8th in Belgrade: the Dogovor that was "today" is now behind us.
    const afterMidnight = new Date('2026-10-07T22:00:00Z');
    expect(groupOf('2026-10-07T21:59:59Z', afterMidnight)).toBe('past');
    expect(groupOf('2026-10-08T21:59:59Z', afterMidnight)).toBe('today');
    expect(groupOf('2026-10-08T22:00:00Z', afterMidnight)).toBe('tomorrow');
  });

  it('cuts the week on Sunday night in Serbian time', () => {
    // 22:00Z on Sunday 11th is Monday 12th 00:00 in Belgrade: next week.
    expect(groupOf('2026-10-11T21:59:59Z')).toBe('week');
    expect(groupOf('2026-10-11T22:00:00Z')).toBe('later');
    // On a Sunday the next day is Monday, which is "Sutra" and not "Ove nedelje"; and a Saturday's tomorrow is the week's last day.
    const sunday = new Date('2026-10-11T10:00:00Z');
    expect(groupOf('2026-10-12T07:00:00Z', sunday)).toBe('tomorrow');
    expect(groupOf('2026-10-13T07:00:00Z', sunday)).toBe('later');
    const saturday = new Date('2026-10-10T10:00:00Z');
    expect(groupOf('2026-10-11T10:00:00Z', saturday)).toBe('tomorrow');
    expect(groupOf('2026-10-12T10:00:00Z', saturday)).toBe('later');
  });

  it('counts days, not 24-hour spans, across the autumn clock change (25 October 2026, 03:00 CEST becomes 02:00 CET)', () => {
    const saturdayNight = new Date('2026-10-24T20:00:00Z'); // 22:00 on Saturday the 24th, still CEST
    expect(groupOf('2026-10-25T22:30:00Z', saturdayNight)).toBe('tomorrow'); // 23:30 on the 25th, CET: 26.5 hours away, still tomorrow
    expect(groupOf('2026-10-25T23:00:00Z', saturdayNight)).toBe('later');    // 00:00 on Monday the 26th
    expect(groupOf('2026-10-24T22:30:00Z', saturdayNight)).toBe('tomorrow'); // 00:30 on the 25th, CEST: two and a half hours away
  });

  it('keeps a Dogovor that is under way today even when it began on an earlier day', () => {
    const overnight = starting('2026-10-06T20:00:00Z', { tacanTermin: { pocetak: '2026-10-06T20:00:00Z', kraj: '2026-10-08T06:00:00Z' } });
    expect(agreementInProgress(agreement('n', overnight), NOW)).toBe(true);
    expect(agreementGroupOf(agreement('n', overnight), NOW)).toBe('today');
    const ended = starting('2026-10-06T20:00:00Z', { tacanTermin: { pocetak: '2026-10-06T20:00:00Z', kraj: '2026-10-06T22:00:00Z' } });
    expect(agreementGroupOf(agreement('e', ended), NOW)).toBe('past');
    // A start with no end claims no "under way": there is no end to be inside of.
    expect(agreementInProgress(agreement('s', starting('2026-10-07T08:00:00Z')), NOW)).toBe(false);
  });
});

describe('"Čeka tebe": everything with an orange foot, always first', () => {
  const asWorker = (patch: Partial<DogovorProjekcija>) => agreement('w', patch, 'uskocer');
  it('is a change the other side proposed, a completion I confirm, a rating that is due, and a rating that could not be read', () => {
    expect(agreementAttention(agreement('a', { izmenaCeka: { predlogId: 'p', mojPredlog: false } }))?.kind).toBe('change');
    expect(agreementAttention(agreement('b', { stanje: 'AWAITING_REQUESTER' }))?.kind).toBe('confirm');
    expect(agreementAttention(agreement('c', { stanje: 'COMPLETED', ocenaMoguca: true }))?.kind).toBe('rate');
    expect(agreementAttention(agreement('d', { stanje: 'COMPLETED', stanjeProvereOcene: 'UNAVAILABLE' }))?.kind).toBe('check-rating');
    // Whatever their day, each of the four stands first, under "Čeka tebe" - a date far ahead (or far behind) does not move it.
    for (const patch of [{ izmenaCeka: { predlogId: 'p', mojPredlog: false } }, { stanje: 'AWAITING_REQUESTER' as const },
      { stanje: 'COMPLETED' as const, ocenaMoguca: true }, { stanje: 'COMPLETED' as const, stanjeProvereOcene: 'UNAVAILABLE' as const }]) {
      expect(groupOf('2026-12-20T10:00:00Z', NOW, patch)).toBe('waiting');
      expect(groupOf('2026-01-20T10:00:00Z', NOW, patch)).toBe('waiting');
      expect(groupOf(null, NOW, patch)).toBe('waiting');
    }
  });

  it('is not my own proposal, a completion the other side confirms, or an ordinary agreed Dogovor', () => {
    expect(agreementAttention(agreement('a', { izmenaCeka: { predlogId: 'p', mojPredlog: true } }))).toBeNull();
    expect(agreementAttention(asWorker({ stanje: 'AWAITING_REQUESTER' }))).toBeNull();
    expect(agreementAttention(agreement('c', { stanje: 'AWAITING_REQUESTER', izmenaCeka: { predlogId: 'p', mojPredlog: true } }))).toBeNull();
    expect(agreementAttention(agreement('d'))).toBeNull();
    expect(groupOf('2026-10-07T14:00:00Z', NOW, { izmenaCeka: { predlogId: 'p', mojPredlog: true } })).toBe('today');
  });

  it('keeps a Dogovor that waits only for my rating among the active ones, and moves it to Istorija once rated', () => {
    const due = agreement('due', { stanje: 'COMPLETED', ocenaMoguca: true });
    const rated = agreement('rated', { stanje: 'COMPLETED', ocenaMoguca: false });
    const unreadable = agreement('unread', { stanje: 'COMPLETED', ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' });
    expect([due, rated, unreadable, agreement('open'), agreement('gone', { stanje: 'CANCELLED' })].map(isActiveAgreement)).toEqual([true, false, true, true, false]);
    expect(groupActiveAgreements([due], NOW).map(group => group.key)).toEqual(['waiting']);
  });
});

describe('the Aktivni list as groups', () => {
  it('lists the groups in the plan\'s order and leaves the empty ones out', () => {
    const items = [
      agreement('undated'), agreement('later', starting('2026-11-02T10:00:00Z')), agreement('week', starting('2026-10-10T10:00:00Z')),
      agreement('tomorrow', starting('2026-10-08T10:00:00Z')), agreement('today', starting('2026-10-07T15:00:00Z')),
      agreement('past', starting('2026-10-01T10:00:00Z')), agreement('waiting', { stanje: 'AWAITING_REQUESTER', ...starting('2026-12-01T10:00:00Z') }),
    ];
    const groups = groupActiveAgreements(items, NOW);
    expect(groups.map(group => group.key)).toEqual(['waiting', 'past', 'today', 'tomorrow', 'week', 'later', 'undated']);
    expect(groups.map(group => group.title)).toEqual(['Čeka tebe', 'Ranije', 'Danas', 'Sutra', 'Ove nedelje', 'Kasnije', 'Bez tačnog termina']);
    expect(groups.map(group => group.items.map(item => item.id))).toEqual([['waiting'], ['past'], ['today'], ['tomorrow'], ['week'], ['later'], ['undated']]);
    expect(groupActiveAgreements([agreement('today', starting('2026-10-07T15:00:00Z'))], NOW).map(group => group.key)).toEqual(['today']);
    expect(groupActiveAgreements([], NOW)).toEqual([]);
  });

  it('orders a group by the accepted instant, with offsets and microseconds, then no term in the server\'s order', () => {
    const items = [
      agreement('c', starting('2026-10-07T13:00:00.000002Z')),
      agreement('no-term-1'),
      agreement('a', starting('2026-10-07T15:00:00.000001+02:00')),   // 13:00:00.000001Z
      agreement('no-term-2'),
      agreement('b', starting('2026-10-07T13:00:00.000001Z')),         // the same instant as "a"
      agreement('late', starting('2026-10-07T20:00:00Z')),
    ];
    const [today, undated] = groupActiveAgreements(items, NOW);
    expect(today.items.map(item => item.id)).toEqual(['a', 'b', 'c', 'late']);
    expect(undated.items.map(item => item.id)).toEqual(['no-term-1', 'no-term-2']);
  });

  it('keeps a rating that could not be read after the Dogovori that really wait, whatever its date', () => {
    const items = [
      agreement('old-unknown', { stanje: 'COMPLETED', stanjeProvereOcene: 'UNAVAILABLE', ...starting('2026-01-01T10:00:00Z') }),
      agreement('due', { stanje: 'COMPLETED', ocenaMoguca: true, stanjeProvereOcene: 'DUE', ...starting('2026-09-24T10:00:00Z') }),
      agreement('confirm', { stanje: 'AWAITING_REQUESTER', ...starting('2026-10-01T10:00:00Z') }),
    ];
    const [waiting] = groupActiveAgreements(items, NOW);
    expect(waiting.key).toBe('waiting');
    expect(waiting.items.map(item => item.id)).toEqual(['due', 'confirm', 'old-unknown']);
  });

  it('takes the order from the accepted start, not from the task\'s own start', () => {
    const items = [
      agreement('task-only', { pocinje: '2026-10-07T08:00:00Z' }),
      agreement('rescheduled', { pocinje: '2026-10-07T08:00:00Z', ...starting('2026-10-07T19:00:00Z') }),
      agreement('earlier', { pocinje: '2026-10-09T08:00:00Z', ...starting('2026-10-07T11:00:00Z') }),
    ];
    const groups = groupActiveAgreements(items, NOW);
    expect(groups.map(group => group.key)).toEqual(['today', 'undated']);
    expect(groups[0].items.map(item => item.id)).toEqual(['earlier', 'rescheduled']);
    expect(groups[1].items.map(item => item.id)).toEqual(['task-only']);
  });
});

describe('Istorija chips', () => {
  const items = [agreement('done', { stanje: 'COMPLETED' }), agreement('off', { stanje: 'CANCELLED' }), agreement('done-2', { stanje: 'COMPLETED' })];
  it('shows all, only the completed, or only the cancelled, in the server\'s order', () => {
    expect(filterHistory(items, 'all').map(item => item.id)).toEqual(['done', 'off', 'done-2']);
    expect(filterHistory(items, 'completed').map(item => item.id)).toEqual(['done', 'done-2']);
    expect(filterHistory(items, 'cancelled').map(item => item.id)).toEqual(['off']);
  });
});

describe('the time on a card', () => {
  it('writes today and tomorrow as a word and a clock, in Serbian time, with the end when the window ends the same day', () => {
    expect(agreementWhen(agreement('a', { ...starting('2026-10-07T12:00:00Z'), tacanTermin: { pocetak: '2026-10-07T12:00:00Z', kraj: '2026-10-07T13:30:00Z' } }), NOW)).toBe('Danas 14:00–15:30');
    expect(agreementWhen(agreement('b', starting('2026-10-07T12:00:00Z')), NOW)).toBe('Danas 14:00');
    expect(agreementWhen(agreement('c', starting('2026-10-08T07:30:00Z')), NOW)).toBe('Sutra 09:30');
    // 22:30Z on the 7th is half past midnight on the 8th in Belgrade: tomorrow, not today.
    expect(agreementWhen(agreement('d', starting('2026-10-07T22:30:00Z')), NOW)).toBe('Sutra 00:30');
  });

  it('writes any other day in the app\'s one time format, with the year only when it is not the current one', () => {
    expect(agreementWhen(agreement('a', starting('2026-10-09T10:00:00Z')), NOW)).toBe('9. okt · 12:00');
    expect(agreementWhen(agreement('b', starting('2027-01-05T10:00:00Z')), NOW)).toBe('5. jan 2027 · 11:00');
    expect(agreementWhen(agreement('c', { ...starting('2026-10-09T10:00:00Z'), tacanTermin: { pocetak: '2026-10-09T10:00:00Z', kraj: '2026-10-09T12:30:00Z' } }), NOW)).toBe('9. okt · 12:00–14:30');
  });

  it('writes a window that crosses midnight whole, with both days', () => {
    const night = { ...starting('2026-10-07T20:00:00Z'), tacanTermin: { pocetak: '2026-10-07T20:00:00Z', kraj: '2026-10-08T04:00:00Z' } };
    expect(agreementWhen(agreement('n', night), NOW)).toBe('7. okt · 22:00 – 8. okt · 06:00');
  });

  it('says nothing when the accepted terms carry no start, so the card falls back to the adapter\'s sentence', () => {
    expect(agreementWhen(agreement('a'), NOW)).toBeNull();
    expect(agreementWhen(agreement('b', { prihvacenPocetak: null }), NOW)).toBeNull();
    expect(agreementWhen(agreement('c', { prihvacenPocetak: 'garbage' }), NOW)).toBeNull();
    // The task's own start is never a stand-in for it.
    expect(agreementWhen(agreement('d', { pocinje: '2026-10-07T12:00:00Z' }), NOW)).toBeNull();
  });
});

describe('the state chip', () => {
  const live = starting('2026-10-09T10:00:00Z');
  it('says Dogovoren until the agreed time arrives and U toku while it is under way', () => {
    expect(agreementChip(agreement('a', live), NOW)).toEqual({ kind: 'status', key: 'task.agreed' });
    const now = { ...starting('2026-10-07T09:00:00Z'), tacanTermin: { pocetak: '2026-10-07T09:00:00Z', kraj: '2026-10-07T11:00:00Z' } };
    expect(agreementChip(agreement('b', now), NOW)).toEqual({ kind: 'status', key: 'task.now' });
    expect(agreementChip(agreement('c', now), new Date('2026-10-07T11:00:00Z'))).toEqual({ kind: 'status', key: 'task.agreed' });
  });

  it('says Čeka potvrdu, orange only when the confirmation is mine, then Završen or Otkazan', () => {
    expect(agreementChip(agreement('a', { stanje: 'AWAITING_REQUESTER' }), NOW)).toEqual({ kind: 'awaiting', mine: true });
    expect(agreementChip(agreement('b', { stanje: 'AWAITING_REQUESTER' }, 'uskocer'), NOW)).toEqual({ kind: 'awaiting', mine: false });
    // A proposal of mine blocks the confirmation: no orange foot, so no orange chip either.
    expect(agreementChip(agreement('c', { stanje: 'AWAITING_REQUESTER', izmenaCeka: { predlogId: 'p', mojPredlog: true } }), NOW)).toEqual({ kind: 'awaiting', mine: false });
    expect(agreementChip(agreement('d', { stanje: 'COMPLETED' }), NOW)).toEqual({ kind: 'status', key: 'task.completed' });
    expect(agreementChip(agreement('e', { stanje: 'CANCELLED' }), NOW)).toEqual({ kind: 'status', key: 'task.cancelled' });
  });
});

describe('who cancelled, when and why - only from what the Dogovor carries', () => {
  it('is just "Otkazano" when the Dogovor carries none of the three, and invents nothing', () => {
    expect(cancellationLine(undefined)).toBe('Otkazano');
    expect(cancellationLine(null)).toBe('Otkazano');
    expect(cancellationLine({})).toBe('Otkazano');
    expect(cancellationLine({ at: null, by: '  ', reason: '' })).toBe('Otkazano');
  });

  it('adds each of the three that it is given, in the order date, person, reason', () => {
    expect(cancellationLine({ at: '2026-10-05T12:00:00Z', by: 'Marko', reason: 'Promenio se termin' }, NOW)).toBe('Otkazano 5. okt · 14:00 · Marko · Promenio se termin');
    expect(cancellationLine({ by: 'Ti' })).toBe('Otkazano · Ti');
    expect(cancellationLine({ reason: 'Rešeno je drugačije' })).toBe('Otkazano · Rešeno je drugačije');
    expect(cancellationLine({ at: '2026-10-05T12:00:00Z' }, NOW)).toBe('Otkazano 5. okt · 14:00');
  });
});
