import type { OwnerPreselectionQuestion, PublicPreselectionQa } from '../../../contracts/preselectionQa';
import { INLINE_LIMIT, buildQaInline, pitanja, qaCountLine, waitingWords } from '../taskQaInlineModel';

/**
 * The questions of a task as its own screens show them (owner, 2026-10-07): the server's two shapes of one thread, in the
 * order a person reads them, with the counts the section speaks. Questions are anonymous: no shape carries an asker, and
 * nothing here may grow one.
 */
const REV = 2;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asked = (n: number, patch: Partial<OwnerPreselectionQuestion> = {}): OwnerPreselectionQuestion => ({
  questionId: id(n), needRevision: REV, questionText: `Pitanje ${n}`, status: 'PENDING_ANSWER', createdAt: `2026-10-0${n}T08:00:00Z`,
  answerVersion: null, answerText: null, edited: false, ...patch });
const answeredOwner = (n: number, patch: Partial<OwnerPreselectionQuestion> = {}): OwnerPreselectionQuestion =>
  asked(n, { status: 'ANSWERED_PUBLIC', answerVersion: 1, answerText: `Odgovor ${n}`, ...patch });
const answeredPublic = (n: number, patch: Partial<PublicPreselectionQa> = {}): PublicPreselectionQa => ({
  questionId: id(n), needRevision: REV, questionText: `Pitanje ${n}`, answerVersion: 1, answerText: `Odgovor ${n}`, edited: false,
  answeredAt: `2026-10-0${n}T09:00:00Z`, ...patch });
const owner = { mode: 'OWNER' as const, needRevision: REV, canAsk: false, canComposeAnswer: true };
const stranger = { mode: 'PUBLIC' as const, needRevision: REV, canAsk: true, canComposeAnswer: false };
const ids = (items: { questionId: string }[]) => items.map(item => item.questionId);

describe('a stranger\'s thread (the public read)', () => {
  it('lists the answered questions of the version on screen, the newest answer first', () => {
    const model = buildQaInline(stranger, [answeredPublic(1), answeredPublic(3), answeredPublic(2)]);
    expect(model).toMatchObject({ viewer: 'PUBLIC', listed: 3, answered: 3, waiting: 0, all: 3, olderVersion: false, canAsk: true, canAnswer: false });
    expect(ids(model.shown)).toEqual([id(3), id(2), id(1)]);
  });

  it('shows at most three and keeps the whole count for the way to the rest', () => {
    expect(INLINE_LIMIT).toBe(3);
    const model = buildQaInline(stranger, [1, 2, 3, 4, 5].map(n => answeredPublic(n)));
    expect(ids(model.shown)).toEqual([id(5), id(4), id(3)]);
    expect(model).toMatchObject({ listed: 5, all: 5, answered: 5 });
  });

  it('keeps a question about an earlier version out of the list and says that some are kept out', () => {
    const model = buildQaInline(stranger, [answeredPublic(1), answeredPublic(2, { needRevision: 1 })]);
    expect(ids(model.shown)).toEqual([id(1)]);
    expect(model).toMatchObject({ listed: 1, all: 1, olderVersion: true });
    const onlyOld = buildQaInline(stranger, [answeredPublic(2, { needRevision: 1 })]);
    expect(onlyOld).toMatchObject({ shown: [], listed: 0, all: 0, olderVersion: true });
  });

  it('is an honest empty thread when nothing was asked, and says "can ask" only as the server did', () => {
    expect(buildQaInline(stranger, [])).toMatchObject({ shown: [], listed: 0, all: 0, olderVersion: false, canAsk: true });
    expect(buildQaInline({ ...stranger, canAsk: false }, []).canAsk).toBe(false);
  });

  it('gives each item its answer, its edit mark and when it was given, and nothing about who asked', () => {
    const [item] = buildQaInline(stranger, [answeredPublic(1, { edited: true, answerVersion: 2 })]).shown;
    expect(item).toEqual({ questionId: id(1), question: 'Pitanje 1', answer: 'Odgovor 1', edited: true, answeredAt: '2026-10-01T09:00:00Z', askedAt: null });
    expect(Object.keys(item).sort()).toEqual(['answer', 'answeredAt', 'askedAt', 'edited', 'question', 'questionId']);
  });
});

describe('the owner\'s thread (the owner read)', () => {
  it('puts the waiting questions first, the longest waiting first, then the answered, the newest first', () => {
    const model = buildQaInline(owner, [answeredOwner(1), asked(3), answeredOwner(2), asked(4), asked(5, { createdAt: '2026-09-30T08:00:00Z' })]);
    expect(ids(model.shown)).toEqual([id(5), id(3), id(4)]);
    const all = buildQaInline(owner, [answeredOwner(1), asked(3), answeredOwner(2), asked(4)]);
    expect(ids(all.shown)).toEqual([id(3), id(4), id(2)]);
    expect(all).toMatchObject({ viewer: 'OWNER', listed: 4, waiting: 2, answered: 2, all: 4, canAnswer: true, canAsk: false });
  });

  it('shows a waiting question without an answer and an answered one with it', () => {
    const [waiting, answered] = buildQaInline(owner, [asked(1), answeredOwner(2, { edited: true, answerVersion: 2 })]).shown;
    expect(waiting).toEqual({ questionId: id(1), question: 'Pitanje 1', answer: null, edited: false, answeredAt: null, askedAt: '2026-10-01T08:00:00Z' });
    // The owner's read has when the question was asked, not when it was answered; no moment is made up for the answer.
    expect(answered).toEqual({ questionId: id(2), question: 'Pitanje 2', answer: 'Odgovor 2', edited: true, answeredAt: null, askedAt: '2026-10-02T08:00:00Z' });
  });

  it('leaves skipped and reported questions out of the list and out of the count', () => {
    const model = buildQaInline(owner, [asked(1), asked(2, { status: 'IGNORED' }), asked(3, { status: 'REPORTED' })]);
    expect(ids(model.shown)).toEqual([id(1)]);
    expect(model).toMatchObject({ listed: 1, waiting: 1, all: 1, olderVersion: false });
    expect(buildQaInline(owner, [asked(2, { status: 'IGNORED' })])).toMatchObject({ shown: [], listed: 0, all: 0 });
  });

  it('keeps earlier versions out of the list but counts them for the whole thread, and says so', () => {
    const model = buildQaInline(owner, [asked(1), asked(2, { needRevision: 1 }), answeredOwner(3, { needRevision: 1 })]);
    expect(ids(model.shown)).toEqual([id(1)]);
    expect(model).toMatchObject({ listed: 1, waiting: 1, all: 3, olderVersion: true });
  });

  it('a waiting question cannot be answered when the server does not allow answering', () => {
    expect(buildQaInline({ ...owner, canComposeAnswer: false }, [asked(1)]).canAnswer).toBe(false);
  });

  it('breaks a tie in time by the id, so the order never flickers between two reads', () => {
    const same = '2026-10-01T08:00:00Z';
    const forward = buildQaInline(owner, [asked(2, { createdAt: same }), asked(1, { createdAt: same })]);
    const backward = buildQaInline(owner, [asked(1, { createdAt: same }), asked(2, { createdAt: same })]);
    expect(ids(forward.shown)).toEqual([id(1), id(2)]);
    expect(ids(backward.shown)).toEqual(ids(forward.shown));
  });
});

describe('the words of the counts', () => {
  it('counts questions in the form the number asks for', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22].map(pitanja)).toEqual(['1 pitanje', '2 pitanja', '4 pitanja', '5 pitanja', '11 pitanja', '12 pitanja', '21 pitanje', '22 pitanja']);
  });

  it('says how many are answered, and "sva odgovorena" when every one is', () => {
    expect(qaCountLine(3, 2)).toBe('3 pitanja · 2 odgovorena');
    expect(qaCountLine(5, 1)).toBe('5 pitanja · 1 odgovoreno');
    expect(qaCountLine(12, 5)).toBe('12 pitanja · 5 odgovorenih');
    expect(qaCountLine(2, 2)).toBe('2 pitanja · sva odgovorena');
    expect(qaCountLine(1, 1)).toBe('1 pitanje · odgovoreno');
    // None answered says only how many, as "0 odgovorenih" would be noise beside a waiting count.
    expect(qaCountLine(2, 0)).toBe('2 pitanja');
    expect(qaCountLine(0, 0)).toBeNull();
  });

  it('says how many wait, with the verb of the number', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(waitingWords)).toEqual(['1 čeka odgovor', '2 čekaju odgovor', '4 čekaju odgovor', '5 čeka odgovor',
      '11 čeka odgovor', '12 čeka odgovor', '21 čeka odgovor', '22 čekaju odgovor', '25 čeka odgovor']);
  });
});
