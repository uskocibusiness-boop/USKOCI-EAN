import { plainWords, repeatsTheAction, stateProblems, type StateDescription } from '../stateRules';

/**
 * The rules of a state, as checks (UI/UX pass 2026-10-08, F8b). The prose is the header of `StateView.tsx`; this holds that the prose
 * and the checks say the same thing, and that each rule catches the mistake it is for and lets the right wording through.
 */
const state = (extra: Partial<StateDescription> & Pick<StateDescription, 'kind' | 'title'>): StateDescription => extra;

describe('every state has a sentence and a way forward', () => {
  it('a first-time empty list with its sentence and its one action follows the rules', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'first', title: 'Još nemaš zadatak', body: 'Reci šta ti treba. Nacrt pregledaš pre objave.',
      primary: { label: 'Objavi prvi zadatak' } }))).toEqual([]);
  });

  it('a headline with nothing under it has no sentence', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'first', title: 'Još nemaš zadatak', primary: { label: 'Objavi prvi zadatak' } }))).toEqual(['no-sentence']);
    expect(stateProblems(state({ kind: 'error', title: 'Nije uspelo', body: '   ', primary: { label: 'Pokušaj ponovo' } }))).toEqual(['no-sentence']);
  });

  it('an error, a lost connection and an unknown outcome each need the one button; an empty list needs a way in unless everything is done', () => {
    for (const kind of ['error', 'offline', 'uncertain'] as const) {
      expect([kind, stateProblems(state({ kind, title: 'T', body: 'Rečenica.' }))]).toEqual([kind, ['no-way-forward']]);
      // A quiet action alone is not the way forward of a failure: the one thing to do is the button.
      expect([kind, stateProblems(state({ kind, title: 'T', body: 'Rečenica.', quiet: { label: 'Nazad' } }))]).toEqual([kind, ['no-way-forward']]);
    }
    expect(stateProblems(state({ kind: 'empty', cause: 'first', title: 'Još nemaš Dogovor', body: 'Dogovor se pojavljuje ovde.' }))).toEqual(['no-way-forward']);
    expect(stateProblems(state({ kind: 'empty', cause: 'first', title: 'Još nemaš Dogovor', body: 'Dogovor se pojavljuje ovde.', quiet: { label: 'Pogledaj zadatke' } }))).toEqual([]);
    expect(stateProblems(state({ kind: 'empty', cause: 'done', title: 'Ništa ne čeka tvoju odluku', body: 'Kad se nešto promeni, javljamo ti.' }))).toEqual([]);
  });

  it('a wait offers nothing to press: nothing can be done while it reads, and its title is its one sentence', () => {
    expect(stateProblems(state({ kind: 'loading', title: 'Učitavamo Dogovore…' }))).toEqual([]);
    expect(stateProblems(state({ kind: 'loading', title: 'Učitavamo Dogovore…', primary: { label: 'Otkaži' } }))).toEqual(['loading-has-action']);
  });
});

describe('the sentence and the button never say the same thing twice', () => {
  it('finds a verb repeated as a whole phrase, whatever the case, the diacritics or the punctuation', () => {
    expect(repeatsTheAction('Proveri vezu i pokušaj ponovo.', 'Pokušaj ponovo')).toBe(true);
    expect(repeatsTheAction('Nismo dobili odgovor. POKUSAJ PONOVO!', 'Pokušaj ponovo')).toBe(true);
    expect(repeatsTheAction('Proveri da vidiš šta je sačuvano.', 'Proveri')).toBe(true);
    expect(repeatsTheAction('Odgovor nije stigao, pa ne znamo šta je sačuvano.', 'Proveri')).toBe(false);
    // A word that merely contains the button's word is not the button's word.
    expect(repeatsTheAction('Proverili smo vezu.', 'Proveri')).toBe(false);
    expect(repeatsTheAction('Nije do tvog telefona. Sačekaj malo.', 'Pokušaj ponovo')).toBe(false);
    expect(repeatsTheAction('Bilo šta.', '')).toBe(false);
  });

  it('allows explanatory wording to repeat a command without losing the recovery action', () => {
    expect(stateProblems(state({ kind: 'error', title: 'Ne možemo da učitamo Dogovore', body: 'Proveri internet vezu i pokušaj ponovo.',
      primary: { label: 'Pokušaj ponovo' } }))).toEqual([]);
    expect(stateProblems(state({ kind: 'error', title: 'Ne možemo da učitamo Dogovore', body: 'Proveri vezu.', primary: { label: 'Pokušaj ponovo' } }))).toEqual([]);
  });

  it('flags duplicate labels on the primary and secondary actions', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'first', title: 'Još nemaš Dogovor', body: 'Dogovor se pojavljuje ovde.',
      primary: { label: 'Pogledaj zadatke' }, quiet: { label: 'pogledaj zadatke' } }))).toEqual(['same-label-twice']);
  });
});

describe('what an empty list says depends on why it is empty', () => {
  it('the first time speaks to a person who has none: "Još nemaš ...", and never about a view', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'first', title: 'Nema zadataka u ovom prikazu', body: 'Promeni pretragu ili filtere.',
      primary: { label: 'Objavi prvi zadatak' } }))).toEqual(['first-time-says-filter']);
  });

  it('a filter speaks about the view and offers a filter reset; it never says "Još nemaš ..."', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'filtered', title: 'Nema zadataka u ovom prikazu', body: 'Promeni pretragu ili filtere.',
      primary: { label: 'Poništi filtere' } }))).toEqual([]);
    expect(stateProblems(state({ kind: 'empty', cause: 'filtered', title: 'Još nemaš zadatak', body: 'Promeni pretragu ili filtere.',
      primary: { label: 'Poništi filtere' } }))).toEqual(['filter-says-first-time']);
    expect(stateProblems(state({ kind: 'empty', cause: 'filtered', title: 'Još nema zadataka', body: 'Promeni pretragu ili filtere.',
      primary: { label: 'Poništi filtere' } }))).toEqual(['filter-says-first-time']);
  });

  it('reports every problem there is, in the order of the rules', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'filtered', title: 'Još nemaš zadatak' }))).toEqual(['no-sentence', 'no-way-forward', 'filter-says-first-time']);
  });
});

describe('plain words', () => {
  it('lower-cases, drops the diacritics and the punctuation, and keeps đ readable', () => {
    expect(plainWords('  Pokušaj, ponovo! ')).toBe('pokusaj ponovo');
    expect(plainWords('Đurđevdan — čaj, šećer, žuto')).toBe('djurdjevdan caj secer zuto');
    expect(plainWords('…')).toBe('');
  });
});

// The behavioral cases above cover each state rule. Historical header wording,
// including the old "one green action" instruction, is not an executable contract.

describe('artwork emphasis is independent of the state meaning', () => {
  const first = { kind: 'empty' as const, cause: 'first' as const, title: 'Još nemaš zadatak', body: 'Reci šta ti treba. Nacrt pregledaš pre objave.',
    primary: { label: 'Objavi prvi zadatak' }, quiet: { label: 'Pogledaj zadatke' } };

  it('lets the first time of an empty screen be a hero, and says nothing of a state that is not one', () => {
    expect(stateProblems(state({ ...first, hero: true }))).toEqual([]);
    expect(stateProblems(state({ ...first }))).toEqual([]);
    expect(stateProblems(state({ ...first, hero: false, cause: 'filtered', title: 'Nema zadataka u ovom prikazu', body: 'Promeni pretragu ili filtere.' }))).toEqual([]);
  });

  it('allows emphasis for filtered, completed and failure states while preserving their words', () => {
    expect(stateProblems(state({ kind: 'empty', cause: 'filtered', hero: true, title: 'Nema zadataka u ovom prikazu', body: 'Promeni pretragu ili filtere.',
      primary: { label: 'Poništi filtere' } }))).toEqual([]);
    expect(stateProblems(state({ kind: 'empty', cause: 'done', hero: true, title: 'Ništa ne čeka tvoju odluku', body: 'Kad se nešto promeni, javićemo ti.' }))).toEqual([]);
    expect(stateProblems(state({ kind: 'error', hero: true, title: 'Ne možemo da učitamo Dogovore', body: 'Proveri vezu.', primary: { label: 'Pokušaj ponovo' } }))).toEqual([]);
  });
});
