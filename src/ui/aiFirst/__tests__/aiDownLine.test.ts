import { AI_CREDITS_UNAVAILABLE_COPY } from '../../../contracts/aiAvailability';
import { AI_DOWN_WITH_DRAFT, SEND_UNCONFIRMED_CODE, aiDownLine, conversationErrorLine } from '../aiDownLine';

/** R19: the assistant is down and the draft is safe, said once and only when it is true. */
describe('aiDownLine', () => {
  it('says the draft is saved when the assistant is down and there is a draft', () => {
    expect(aiDownLine('AI trenutno nije dostupan.', true)).toBe(AI_DOWN_WITH_DRAFT);
    expect(aiDownLine(AI_CREDITS_UNAVAILABLE_COPY, true)).toBe(AI_DOWN_WITH_DRAFT);
    expect(AI_DOWN_WITH_DRAFT).toBe('AI je privremeno nedostupan. Nacrt je sačuvan.');
  });

  it('never promises a saved draft where there is none', () => {
    expect(aiDownLine('AI trenutno nije dostupan.', false)).toBe('AI trenutno nije dostupan.');
    expect(aiDownLine(AI_CREDITS_UNAVAILABLE_COPY, false)).toBe(AI_CREDITS_UNAVAILABLE_COPY);
  });

  it('leaves every other error, and no error, as it is', () => {
    expect(aiDownLine('Veza je prekinuta.', true)).toBe('Veza je prekinuta.');
    expect(aiDownLine(null, true)).toBeNull();
    expect(aiDownLine('', true)).toBe('');
  });
});

/** One sentence for "we are not sure the message arrived", not two. */
describe('conversationErrorLine', () => {
  const GENERIC = 'Ishod radnje nije potvrđen. Osveži prikaz pre ponovnog pokušaja.';
  const STATUS = 'Ne znamo da li je poruka poslata.';

  it('does not say a send that may not have arrived twice: the status line and the one button say it', () => {
    expect(SEND_UNCONFIRMED_CODE).toBe('AI_TURN_SEND_UNCONFIRMED');
    expect(conversationErrorLine(GENERIC, { hasDraft: true, unconfirmedSend: GENERIC, statusCopy: STATUS })).toBeNull();
  });

  it('keeps the line when there is no status line to say it instead', () => {
    expect(conversationErrorLine(GENERIC, { hasDraft: true, unconfirmedSend: GENERIC, statusCopy: null })).toBe(GENERIC);
  });

  it('keeps every other failure, even while the status says the delivery is not known', () => {
    expect(conversationErrorLine('Poruka nije poslata. Pokušaj ponovo.', { hasDraft: true, unconfirmedSend: GENERIC, statusCopy: STATUS }))
      .toBe('Poruka nije poslata. Pokušaj ponovo.');
    expect(conversationErrorLine('AI trenutno nije dostupan.', { hasDraft: true, unconfirmedSend: null, statusCopy: STATUS })).toBe(AI_DOWN_WITH_DRAFT);
  });

  it('says nothing when there is nothing to say', () => {
    expect(conversationErrorLine(null, { hasDraft: true, unconfirmedSend: GENERIC, statusCopy: STATUS })).toBeNull();
  });
});
