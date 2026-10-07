import type { DogovorProjekcija } from '../../../contracts/projections';
import type { Ishod } from '../../../data/ports';
import type { ReviewContext } from '../../../data/reviewsClientService';
import { GIVEN_CONCURRENCY, GIVEN_STEP, afterNextGiven, afterRetryGiven, failedGiven, finishedAgreements, givenRating, hasOlderGiven, newestFirst,
  nextGiven, readGivenStep, startGiven, type GivenRating } from '../givenRatings';

/**
 * "Date" on the ratings screen (T4a, 2026-10-07): the ratings a person gave, built only from what the app already reads, the
 * person's finished Dogovori and the review the person left on each. These pin that nothing is made up (a receipt that could not
 * be read is "could not be read", never "not rated"), that the walk is bounded, and that a step nobody wants any more is thrown away.
 */
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', THEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const agreement = (id: string, patch: Record<string, unknown> = {}) => ({ id, naslov: `Zadatak ${id}`, stanje: 'COMPLETED',
  ucesnici: [{ id: ME, profilId: 'p-me', ime: 'Ja', inicijali: 'J', uloga: 'narucilac', mesta: null, viSte: true, telefon: null },
    { id: THEM, profilId: 'p-them', ime: '  Marko Marković ', inicijali: 'MM', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }], ...patch }) as unknown as DogovorProjekcija;
const context = (id: string, review: Record<string, unknown> | null, target = THEM) => ({ accountId: ME, agreementId: id, targetAccountId: target, eligible: review === null,
  review: review && { reviewId: `r-${id}`, agreementId: id, reviewerAccountId: ME, targetAccountId: target, tags: [], clientRequestId: 'c', idempotentReplay: false, authoritative: true, ...review },
  authoritative: true, tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [] } }) as unknown as ReviewContext;
const ok = (value: ReviewContext): Ishod<ReviewContext> => ({ ok: true, podatak: value });
const stars = (rating: number, createdAt: string, extra: Record<string, unknown> = {}) => ({ rating, createdAt, ...extra });

describe('which Dogovori can have been rated', () => {
  it('only the finished ones, in the order the list came', () => {
    const list = [agreement('a'), agreement('b', { stanje: 'CONFIRMED' }), agreement('c', { stanje: 'CANCELLED' }), agreement('d'), agreement('e', { stanje: 'AWAITING_REQUESTER' })];
    expect(finishedAgreements(list).map(item => item.id)).toEqual(['a', 'd']);
    expect(finishedAgreements([])).toEqual([]);
  });
});

describe('one rating the person gave', () => {
  it('is the review of the receipt with the Dogovor\'s title and the other side as the Dogovor named them', () => {
    const row = givenRating(agreement('a'), context('a', stars(4, '2026-10-01T10:00:00Z')))!;
    expect(row).toEqual({ agreementId: 'a', rating: 4, createdAt: '2026-10-01T10:00:00Z', title: 'Zadatak a', comment: null,
      person: { name: 'Marko Marković', initials: 'MM', profileId: 'p-them' } });
  });

  it('is nothing when the receipt says the person has not rated (the rating is still due, or its time has passed)', () => {
    expect(givenRating(agreement('a'), context('a', null))).toBeNull();
  });

  it('keeps the other side absent when the Dogovor does not name them: no name is made up', () => {
    const row = givenRating(agreement('a', { ucesnici: [] }), context('a', stars(5, '2026-10-01T10:00:00Z')))!;
    expect(row.person).toBeNull();
    const blank = givenRating(agreement('a', { ucesnici: [{ id: THEM, profilId: null, ime: '   ', inicijali: '', uloga: 'uskocer' }] }), context('a', stars(5, '2026-10-01T10:00:00Z')))!;
    expect(blank.person).toEqual({ name: null, initials: null, profileId: null });
  });

  it.each([['a written comment', 'Odlična saradnja.', 'Odlična saradnja.'], ['a blank one', '   ', null], ['none', null, null], ['a build without comments', undefined, null]])(
    'carries %s as the comment only where there is text', (_name, written, shown) => {
      expect(givenRating(agreement('a'), context('a', stars(5, '2026-10-01T10:00:00Z', { comment: written })))!.comment).toBe(shown);
    });
});

describe('newest rating first', () => {
  const row = (agreementId: string, createdAt: string) => ({ agreementId, rating: 5, createdAt, title: '', comment: null, person: null }) as GivenRating;
  it('orders by the day the rating was left, and keeps the list\'s own order for the same instant', () => {
    const sorted = newestFirst([row('old', '2026-09-01T10:00:00Z'), row('same-1', '2026-10-01T10:00:00Z'), row('new', '2026-10-05T10:00:00Z'), row('same-2', '2026-10-01T10:00:00Z')]);
    expect(sorted.map(item => item.agreementId)).toEqual(['new', 'same-1', 'same-2', 'old']);
  });
});

describe('a step', () => {
  const ids = (count: number) => Array.from({ length: count }, (_, index) => agreement(`d${index}`));
  const always = () => true;

  it('asks about each Dogovor once and gives back the ratings newest first', async () => {
    const asked: string[] = [];
    const answers: Record<string, ReviewContext> = {
      d0: context('d0', stars(5, '2026-10-01T10:00:00Z')), d1: context('d1', null), d2: context('d2', stars(3, '2026-10-04T10:00:00Z')) };
    const step = await readGivenStep(ids(3), async id => { asked.push(id); return ok(answers[id]); }, always);
    expect(asked.sort()).toEqual(['d0', 'd1', 'd2']);
    expect(step!.rows.map(row => [row.agreementId, row.rating])).toEqual([['d2', 3], ['d0', 5]]);
    expect(step!.failed).toEqual([]);
  });

  it('counts a receipt that could not be read as one that could not be read: a refusal and a thrown error both', async () => {
    const step = await readGivenStep(ids(3), async id => {
      if (id === 'd0') throw new Error('network');
      if (id === 'd1') return { ok: false, kod: 'REVIEW_READ_UNAVAILABLE', poruka: 'x' } as Ishod<ReviewContext>;
      return ok(context(id, stars(4, '2026-10-01T10:00:00Z')));
    }, always);
    expect(step!.failed.sort()).toEqual(['d0', 'd1']); expect(step!.rows.map(row => row.agreementId)).toEqual(['d2']);
  });

  it('counts a Dogovor whose receipt is malformed as one that could not be read, and the step still ends', async () => {
    const broken = agreement('d1', { ucesnici: undefined });
    const step = await readGivenStep([agreement('d0'), broken, agreement('d2')], async id => id === 'd0' ? undefined as unknown as Ishod<ReviewContext>
      : ok(context(id, stars(4, '2026-10-01T10:00:00Z'))), always);
    expect(step!.failed.sort()).toEqual(['d0', 'd1']); expect(step!.rows.map(row => row.agreementId)).toEqual(['d2']);
  });

  it(`reads at most ${GIVEN_CONCURRENCY} receipts at once`, async () => {
    let inFlight = 0, most = 0;
    await readGivenStep(ids(12), async id => {
      inFlight += 1; most = Math.max(most, inFlight);
      await Promise.resolve(); await Promise.resolve();
      inFlight -= 1; return ok(context(id, null));
    }, always);
    expect(most).toBe(GIVEN_CONCURRENCY);
  });

  it('answers at once for nothing to ask', async () => {
    expect(await readGivenStep([], async () => { throw new Error('never'); }, always)).toEqual({ rows: [], failed: [] });
  });

  it('is thrown away, and stops asking, when it is no longer wanted', async () => {
    let wanted = true; const asked: string[] = [];
    const step = await readGivenStep(ids(10), async id => { asked.push(id); wanted = false; return ok(context(id, stars(5, '2026-10-01T10:00:00Z'))); }, () => wanted);
    expect(step).toBeNull();
    expect(asked.length).toBeLessThanOrEqual(GIVEN_CONCURRENCY);
  });
});

describe('the walk over the finished Dogovori', () => {
  const many = (count: number) => Array.from({ length: count }, (_, index) => agreement(`d${index}`));
  const row = (agreementId: string, createdAt = '2026-10-01T10:00:00Z') => ({ agreementId, rating: 5, createdAt, title: '', comment: null, person: null }) as GivenRating;

  it(`takes ${GIVEN_STEP} at a time, newest first, and knows whether older ones are left`, () => {
    const state = startGiven([...many(40), agreement('x', { stanje: 'CANCELLED' })]);
    expect(state.finished).toHaveLength(40); expect(state.asked).toBe(0);
    expect(nextGiven(state).map(item => item.id)).toEqual(many(GIVEN_STEP).map(item => item.id));
    expect(hasOlderGiven(state)).toBe(true);
    const done = afterNextGiven(afterNextGiven(afterNextGiven(state, { rows: [], failed: [] }, GIVEN_STEP), { rows: [], failed: [] }, GIVEN_STEP), { rows: [], failed: [] }, 10);
    expect(done.asked).toBe(40); expect(hasOlderGiven(done)).toBe(false); expect(nextGiven(done)).toEqual([]);
  });

  it('adds the ratings of a step without ever listing a Dogovor twice, newest first', () => {
    const state = afterNextGiven(startGiven(many(4)), { rows: [row('d0', '2026-10-01T10:00:00Z')], failed: [] }, 2);
    const next = afterNextGiven(state, { rows: [row('d0', '2026-10-01T10:00:00Z'), row('d3', '2026-10-09T10:00:00Z')], failed: [] }, 2);
    expect(next.rows.map(item => item.agreementId)).toEqual(['d3', 'd0']);
  });

  it('remembers the Dogovori it could not ask about, and a second try replaces exactly those', () => {
    const first = afterNextGiven(startGiven(many(4)), { rows: [row('d1')], failed: ['d0', 'd2'] }, 4);
    expect(first.failed).toEqual(['d0', 'd2']); expect(failedGiven(first).map(item => item.id)).toEqual(['d0', 'd2']);
    const again = afterRetryGiven(first, { rows: [row('d0', '2026-10-02T10:00:00Z')], failed: ['d2'] }, ['d0', 'd2']);
    expect(again.failed).toEqual(['d2']); expect(again.rows.map(item => item.agreementId)).toEqual(['d0', 'd1']);
    expect(again.asked).toBe(4);
    const none = afterRetryGiven(again, { rows: [], failed: [] }, ['d2']);
    expect(none.failed).toEqual([]); expect(failedGiven(none)).toEqual([]);
  });
});
