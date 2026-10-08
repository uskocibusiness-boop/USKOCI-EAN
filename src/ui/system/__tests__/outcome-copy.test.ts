import { FACT_KINDS } from '../FactArt';
import { CHECKING, CHECK_SPOKEN, OFFLINE_LINE, OUTCOME, OUTCOME_ACTION, UNCERTAIN_ABOUT, cannotLoad } from '../outcomeCopy';
import { repeatsTheAction, stateProblems } from '../stateRules';

/**
 * The one table of the words of trouble (UI/UX pass 2026-10-08, F8b; text revision 2026-10-07, finding 4: about 350 sentences said
 * "ishod nije potvrđen" and 36 buttons said "Proveri ishod", "Učitaj sačuvano stanje", "Osveži stanje"). The table is what the other
 * screens import, so what it says has to be right: honest, in one voice, and never the same verb on the sentence and on the button.
 */
const lines = [
  ...Object.entries(OUTCOME).map(([name, words]) => [name, words] as const),
  ['cannotLoad', cannotLoad('Dogovore')] as const,
];
const everyString = [
  ...lines.flatMap(([, words]) => [words.title, words.copy, words.action]),
  ...Object.values(UNCERTAIN_ABOUT).map(about => about.title),
  OFFLINE_LINE.withLast, OFFLINE_LINE.bare, OFFLINE_LINE.action, CHECKING, CHECK_SPOKEN, ...Object.values(OUTCOME_ACTION),
];

/** The words the text revision forbids in what a person reads (the vocabulary table, "Zabranjene reči"), plus the ones this table could slip into. */
const FORBIDDEN = /\bishod\w*|\baktuel\w*|sačuvano stanje|sačuvani zahtev|\bzahtev\b.*\bpotvrđen|\bserver\w*|\bProbaj\b|\bkreiran\w*|\bposao\b|\bposla\b|\bNaručilac\b|\bUskočer\b|\bnije potvrđen\w*/i;

describe('the table says one thing, the same way', () => {
  it('every title is one line without a full stop, and every sentence ends with one', () => {
    for (const [name, words] of lines) {
      expect([name, words.title.includes('.'), words.title.length <= 48]).toEqual([name, false, true]);
      expect([name, /[.…]$/.test(words.copy)]).toEqual([name, true]);
    }
    for (const [name, about] of Object.entries(UNCERTAIN_ABOUT)) expect([name, about.title.endsWith('.')]).toEqual([name, false]);
  });

  it('uses none of the words the revision forbids, and no "ti" that is a "Vi"', () => {
    expect(everyString.filter(text => FORBIDDEN.test(text))).toEqual([]);
    expect(everyString.filter(text => /\b(?:Proverite|Pokušajte|Sačekajte|Uključite)\b/.test(text))).toEqual([]);
  });

  it('the buttons are three words and each is one verb of the app\'s own vocabulary: Pokušaj ponovo, Proveri, Osveži', () => {
    expect(OUTCOME_ACTION).toEqual({ retry: 'Pokušaj ponovo', check: 'Proveri', refresh: 'Osveži' });
    for (const action of Object.values(OUTCOME_ACTION)) expect([action, action.split(' ').length <= 2]).toEqual([action, true]);
    expect(OUTCOME.failed.action).toBe(OUTCOME_ACTION.retry);
    expect(OUTCOME.uncertain.action).toBe(OUTCOME_ACTION.check);
    expect(OFFLINE_LINE.action).toBe(OUTCOME_ACTION.refresh);
  });

  it('a screen reader\'s name for the check button carries the word that is written on it', () => {
    expect(CHECK_SPOKEN.toLowerCase().includes(OUTCOME_ACTION.check.toLowerCase())).toBe(true);
  });
});

describe('what each situation says', () => {
  it('failed says nothing was saved; unknown says it does not know, and why; neither promises what it cannot know', () => {
    expect(OUTCOME.failed).toEqual({ title: 'Nije uspelo', copy: 'Ništa nije sačuvano.', action: 'Pokušaj ponovo' });
    expect(OUTCOME.uncertain.title).toBe('Ne znamo da li je uspelo');
    expect(OUTCOME.uncertain.copy).toBe('Odgovor nije stigao.');
    expect(OUTCOME.uncertain.copy).not.toMatch(/neće se|sigurno|garant/i);
    // "Nije uspelo" is the line for a thing the app KNOWS did not happen; the unknown one never says so.
    expect(OUTCOME.uncertain.title).not.toMatch(/nije uspelo|nije sačuvano/i);
  });

  it('a lost connection is told apart from a service that is down, and the second says it is not the person\'s phone', () => {
    expect(OUTCOME.offline.title).toBe('Nema internet veze');
    expect(OUTCOME.unavailable.title).toBe('Usluga trenutno nije dostupna');
    expect(OUTCOME.unavailable.copy).toMatch(/Nije do tvog telefona/);
    expect(OUTCOME.offline.copy).not.toBe(OUTCOME.unavailable.copy);
  });

  it('a read that did not arrive names the thing the screen passes in, already in the accusative', () => {
    expect(cannotLoad('Dogovore')).toEqual({ title: 'Ne možemo da učitamo Dogovore', copy: 'Proveri vezu.', action: 'Pokušaj ponovo' });
    expect(cannotLoad('zadatke').title).toBe('Ne možemo da učitamo zadatke');
  });

  it('the strip under the bar is a line, not a screen: with the last thing loaded, or bare', () => {
    expect(OFFLINE_LINE.withLast).toBe('Nema veze. Prikazano je poslednje učitano.');
    expect(OFFLINE_LINE.bare).toBe('Nema veze.');
  });
});

describe('no line repeats the verb of its own button', () => {
  it.each(lines)('%s: the sentence and the title say something else than the button', (_name, words) => {
    expect(repeatsTheAction(words.copy, words.action)).toBe(false);
    expect(repeatsTheAction(words.title, words.action)).toBe(false);
  });

  it.each(lines)('%s follows the rules of a state when it is drawn as one', (name, words) => {
    const kind = name === 'uncertain' ? 'uncertain' : name === 'offline' ? 'offline' : 'error';
    expect(stateProblems({ kind, title: words.title, body: words.copy, primary: { label: words.action } })).toEqual([]);
  });
});

describe('the subjects of an unknown outcome', () => {
  it('each says "Ne znamo da li je/su ..." with the verb in the form its noun needs, and stands for itself with a picture of the app', () => {
    for (const [name, about] of Object.entries(UNCERTAIN_ABOUT)) {
      expect([name, /^Ne znamo da li (?:je|su) /.test(about.title)]).toEqual([name, true]);
      expect([name, (FACT_KINDS as readonly string[]).includes(about.art)]).toEqual([name, true]);
    }
  });

  it('keeps the vocabulary: "zadatak" in lower case, "Dogovor" in capitals, "prijava" for what is sent to a task, "problem" for what is reported', () => {
    expect(UNCERTAIN_ABOUT.application.title).toBe('Ne znamo da li je prijava stigla');
    expect(UNCERTAIN_ABOUT.publication.title).toBe('Ne znamo da li je zadatak objavljen');
    expect(UNCERTAIN_ABOUT.agreementCancel.title).toBe('Ne znamo da li je Dogovor otkazan');
    expect(UNCERTAIN_ABOUT.problem.title).toBe('Ne znamo da li je problem prijavljen');
    expect(UNCERTAIN_ABOUT.generic.title).toBe(OUTCOME.uncertain.title);
  });

  it('has no two subjects with the same title', () => {
    const titles = Object.values(UNCERTAIN_ABOUT).map(about => about.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
