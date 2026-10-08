import type { OutboxEntry } from '../../../data/agreementOutbox';
import {
  GROUP_GAP_MS, MARK_WORDS, PAUSE_MS, autoResendKey, buildThread, dayLabel, entryMark, forgetAutoResendForTests, messageMoment,
  qualifiesForAutoResend, readMark, serbianParts, takeAutoResend, threadMoment, type ThreadMessage,
} from '../threadModel';

/**
 * The thread as a pure function (team T3c). 7 October 2026 is a Wednesday and Serbia is on summer time (UTC+2) until the 25th,
 * so "now" below is 14:00 on Wednesday the 7th in Belgrade. The suite runs with TZ=UTC: nothing here may depend on the phone's zone.
 */
const NOW = new Date('2026-10-07T12:00:00Z');
let counter = 0;
const message = (at: string | null, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: `m${++counter}`, moja: false, posiljalacAccountId: 'druga', posiljalacIme: 'Marko', telo: 'tekst', vremeTekst: '', procitano: null,
  ...(at ? { createdAt: at } : {}), ...over,
});
const mine = (at: string | null, over: Partial<ThreadMessage> = {}) => message(at, { moja: true, posiljalacAccountId: 'ja', posiljalacIme: 'Ja', ...over });
const shape = (messages: ThreadMessage[]) => buildThread(messages, NOW).map(e => ({ separator: e.separator, first: e.first, last: e.last }));

describe('the name of a day in Serbian time', () => {
  it('says Danas, Juče, then the weekday for six days, then the date, with the year only when it is not the current one', () => {
    const today = '2026-10-07';
    expect(dayLabel('2026-10-07', today)).toBe('Danas');
    expect(dayLabel('2026-10-06', today)).toBe('Juče');
    expect(dayLabel('2026-10-05', today)).toBe('Ponedeljak');
    expect(dayLabel('2026-10-04', today)).toBe('Nedelja');
    expect(dayLabel('2026-10-01', today)).toBe('Četvrtak');
    // A week back would repeat today's weekday: the date takes over.
    expect(dayLabel('2026-09-30', today)).toBe('30. sep');
    expect(dayLabel('2025-12-31', today)).toBe('31. dec 2025');
    // A day after today (a phone clock behind the server's) is a date, never "Danas".
    expect(dayLabel('2026-10-08', today)).toBe('8. okt');
  });

  it('cuts the day at Serbian midnight, not at the phone\'s (TZ=UTC here)', () => {
    const today = '2026-10-07';
    // 22:30 UTC on the 6th is 00:30 on the 7th in Belgrade (UTC+2).
    expect(threadMoment({ createdAt: '2026-10-06T22:30:00.123456+00:00', vremeTekst: '' }, today))
      .toMatchObject({ day: 'Danas', dayKey: '2026-10-07', clock: '00:30' });
    // 21:59 UTC is still 23:59 on the 6th.
    expect(threadMoment({ createdAt: '2026-10-06T21:59:00Z', vremeTekst: '' }, today))
      .toMatchObject({ day: 'Juče', dayKey: '2026-10-06', clock: '23:59' });
  });

  it('keeps summer and winter time apart: after the clocks go back on 25 October Belgrade is UTC+1', () => {
    expect(threadMoment({ createdAt: '2026-10-26T08:00:00Z', vremeTekst: '' }, '2026-10-26')).toMatchObject({ clock: '09:00' });
    expect(threadMoment({ createdAt: '2026-10-24T08:00:00Z', vremeTekst: '' }, '2026-10-26')).toMatchObject({ clock: '10:00' });
  });

  it('agrees with the shared Serbian-day helpers at every quarter hour around both clock changes and at midnight', () => {
    // One cached formatter (a thread asks for a hundred at once) must give exactly what serbianDayOf / serbianClock give.
    const { serbianClock, serbianDayOf } = require('../../calendar/serbianDays');
    for (const around of ['2026-03-29T01:00:00Z', '2026-10-25T01:00:00Z', '2026-12-31T22:00:00Z', '2026-06-30T21:30:00Z']) {
      for (let quarter = -16; quarter <= 16; quarter++) {
        const at = new Date(Date.parse(around) + quarter * 15 * 60_000).toISOString();
        const parts = serbianParts(Date.parse(at));
        expect([at, parts]).toEqual([at, { day: serbianDayOf(at), clock: serbianClock(at) }]);
      }
    }
    expect(serbianParts(Number.NaN)).toBeNull();
  });
});

describe('the words of a read without an instant', () => {
  it('reads the day and the clock from the words and invents no day', () => {
    expect(messageMoment('23. sep · 14:05')).toEqual({ day: '23. sep', clock: '14:05' });
    expect(messageMoment('23. sep 2025 · 09:00')).toEqual({ day: '23. sep 2025', clock: '09:00' });
    expect(messageMoment('14:05')).toEqual({ day: 'Danas', clock: '14:05' });
    expect(messageMoment('sada')).toEqual({ day: null, clock: 'sada' });
  });

  it('prefers the instant when the read has one, and falls back to the words when the instant is unreadable', () => {
    expect(threadMoment({ createdAt: '2026-10-07T12:14:00Z', vremeTekst: '23. sep · 09:00' }, '2026-10-07')).toMatchObject({ day: 'Danas', clock: '14:14' });
    expect(threadMoment({ createdAt: 'not an instant', vremeTekst: '23. sep · 09:00' }, '2026-10-07')).toMatchObject({ day: '23. sep', clock: '09:00', ms: null });
  });
});

describe('separators', () => {
  it('opens a day line before the first message, names today with its clock and every other day by its name alone', () => {
    const rows = shape([
      message('2026-10-05T08:00:00Z'), message('2026-10-06T10:00:00Z'), message('2026-10-07T11:00:00Z'),
    ]);
    expect(rows.map(row => row.separator)).toEqual(['Ponedeljak', 'Juče', 'Danas · 13:00']);
  });

  it('opens no second line inside one day while the pauses are short', () => {
    expect(shape([message('2026-10-07T08:00:00Z'), message('2026-10-07T08:20:00Z'), message('2026-10-07T08:59:00Z')]).map(row => row.separator))
      .toEqual(['Danas · 10:00', null, null]);
  });

  it('opens a line with the clock after a pause of an hour, on any day', () => {
    const rows = shape([
      message('2026-10-06T08:00:00Z'), message('2026-10-06T09:00:00Z'),
      message('2026-10-07T08:00:00Z'), message('2026-10-07T10:30:00Z'),
    ]);
    expect(rows.map(row => row.separator)).toEqual(['Juče', 'Juče · 11:00', 'Danas · 10:00', 'Danas · 12:30']);
    expect(PAUSE_MS).toBe(3_600_000);
  });

  it('keeps the words of a message that has no instant, once per day, and opens no line for a stand-in such as "sada"', () => {
    const rows = shape([
      message(null, { vremeTekst: '23. sep · 09:40' }), message(null, { vremeTekst: '23. sep · 09:41', moja: true, posiljalacAccountId: 'ja' }),
      message(null, { vremeTekst: '10:02' }), message(null, { vremeTekst: '10:03' }), message(null, { vremeTekst: 'sada' }),
    ]);
    expect(rows.map(row => row.separator)).toEqual(['23. sep', null, 'Danas · 10:02', null, null]);
  });

  it('never invents a pause between messages that carry no instant', () => {
    const rows = shape([message(null, { vremeTekst: '09:00' }), message(null, { vremeTekst: '17:00' })]);
    expect(rows.map(row => row.separator)).toEqual(['Danas · 09:00', null]);
  });
});

describe('runs: grouped bubbles share one tail', () => {
  it('puts messages of one sender within five minutes in one run, first and last marking its ends', () => {
    expect(shape([
      message('2026-10-07T08:00:00Z'), message('2026-10-07T08:01:00Z'), message('2026-10-07T08:03:00Z'),
    ])).toEqual([
      { separator: 'Danas · 10:00', first: true, last: false },
      { separator: null, first: false, last: false },
      { separator: null, first: false, last: true },
    ]);
  });

  it('a lone bubble is both first and last, and so is the one after another person', () => {
    expect(shape([message('2026-10-07T08:00:00Z'), mine('2026-10-07T08:01:00Z'), message('2026-10-07T08:02:00Z')]))
      .toEqual([
        { separator: 'Danas · 10:00', first: true, last: true },
        { separator: null, first: true, last: true },
        { separator: null, first: true, last: true },
      ]);
  });

  it('breaks the run after more than five minutes and keeps it at exactly five', () => {
    const at = (minutes: number) => new Date(Date.parse('2026-10-07T08:00:00Z') + minutes * 60_000).toISOString();
    expect(shape([message(at(0)), message(at(5))]).map(row => [row.first, row.last])).toEqual([[true, false], [false, true]]);
    expect(shape([message(at(0)), message(at(6))]).map(row => [row.first, row.last])).toEqual([[true, true], [true, true]]);
    expect(GROUP_GAP_MS).toBe(300_000);
  });

  it('never joins runs across a separator, and tells two people apart by their account, not their display name', () => {
    expect(shape([message('2026-10-06T08:00:00Z'), message('2026-10-07T08:00:00Z')]).map(row => [row.first, row.last])).toEqual([[true, true], [true, true]]);
    expect(shape([message('2026-10-07T08:00:00Z', { posiljalacAccountId: 'a' }), message('2026-10-07T08:01:00Z', { posiljalacAccountId: 'b' })])
      .map(row => [row.first, row.last])).toEqual([[true, true], [true, true]]);
  });

  it('keeps neighbours without an instant in one run on one day', () => {
    expect(shape([message(null, { vremeTekst: '09:00' }), message(null, { vremeTekst: '09:30' })]).map(row => [row.first, row.last])).toEqual([[true, false], [false, true]]);
  });
});

describe('the small mark by my message', () => {
  it('is sent for a message the read holds, and seen ONLY when the projection says procitano === true', () => {
    expect(readMark({ moja: true, procitano: null })).toBe('sent');
    expect(readMark({ moja: true, procitano: false })).toBe('sent');
    expect(readMark({ moja: true, procitano: true })).toBe('seen');
  });

  it('is never drawn by the other person\'s message, whatever procitano says', () => {
    expect(readMark({ moja: false, procitano: true })).toBeNull();
    expect(readMark({ moja: false, procitano: null })).toBeNull();
  });

  it('follows the outbox for a message the read has not returned yet', () => {
    expect(entryMark({ state: 'sending' })).toBe('pending');
    expect(entryMark({ state: 'confirmed' })).toBe('sent');
    expect(entryMark({ state: 'unknown' })).toBe('unconfirmed');
    expect(entryMark({ state: 'failed' })).toBe('failed');
  });

  it('has one plain word per state, with diacritics, for the screen reader', () => {
    expect(MARK_WORDS).toEqual({ sent: 'Poslato', seen: 'Viđeno', pending: 'Šalje se', unconfirmed: 'Ne znamo da li je stigla', failed: 'Nije poslato' });
  });
});

describe('auto-resend selection', () => {
  const command = (id: string) => ({ accountId: 'ja', agreementId: 'dogovor', clientMessageId: id, body: 'Stižem.' });
  const entry = (id: string, over: Partial<OutboxEntry> = {}): OutboxEntry => ({ command: command(id), state: 'unknown', error: 'UNAVAILABLE', persisted: true, attempt: 1, ...over });
  beforeEach(() => forgetAutoResendForTests());

  it('takes only an unknown outcome that came from the network (or was interrupted), kept on disk', () => {
    expect(qualifiesForAutoResend(entry('a'))).toBe(true);
    expect(qualifiesForAutoResend(entry('a', { error: undefined }))).toBe(true);
    for (const over of [{ state: 'sending' }, { state: 'confirmed' }, { state: 'failed' }, { error: 'STORAGE_UNAVAILABLE' }, { error: 'INVALID_RESPONSE' },
      { error: 'READ_ONLY' }, { persisted: false }] as Partial<OutboxEntry>[]) expect(qualifiesForAutoResend(entry('a', over))).toBe(false);
  });

  it('gives each message out once, remembering it before the retry starts', () => {
    const list = [entry('poruka_00000001'), entry('poruka_00000002', { state: 'failed' }), entry('poruka_00000003', { error: undefined })];
    expect(takeAutoResend(list).map(e => e.command.clientMessageId)).toEqual(['poruka_00000001', 'poruka_00000003']);
    expect(takeAutoResend(list)).toEqual([]);
    expect(takeAutoResend([entry('poruka_00000004')]).map(e => e.command.clientMessageId)).toEqual(['poruka_00000004']);
  });

  it('keys a message by account, Dogovor and client message id, so another Dogovor with the same id is its own message', () => {
    const other = entry('poruka_00000001', { command: { ...command('poruka_00000001'), agreementId: 'drugi' } });
    expect(autoResendKey(entry('poruka_00000001'))).not.toBe(autoResendKey(other));
    expect(takeAutoResend([entry('poruka_00000001')])).toHaveLength(1);
    expect(takeAutoResend([other])).toHaveLength(1);
  });

  it('keeps a bounded memory', () => {
    for (let index = 0; index < 260; index++) takeAutoResend([entry(`poruka_${String(index).padStart(8, '0')}`)]);
    // The oldest was forgotten, the newest is still remembered.
    expect(takeAutoResend([entry('poruka_00000000')])).toHaveLength(1);
    expect(takeAutoResend([entry('poruka_00000259')])).toHaveLength(0);
  });
});
