/**
 * The rules of a state (empty, error, offline, unknown outcome, loading) as something a test can ask (UI/UX pass 2026-10-08, F8b).
 * The rules themselves are written where a person building a screen looks: the header of `StateView.tsx`. This file is the same rules
 * as checks, so a screen's suite can say `expect(stateProblems(...)).toEqual([])` for the state it draws, and so the rules cannot
 * drift into prose that nothing holds. It imports nothing (no React, no native module): it is words in, problems out.
 */

export type StateKindName = 'empty' | 'loading' | 'error' | 'offline' | 'uncertain';

/**
 * Why a list is empty, for the rules that depend on it. `first`: the person has never had one ("Još nemaš zadatak"). `filtered`: they have
 * some, and what they chose to look at (a filter, a search, a tab, the map's area) leaves none ("Nema zadataka u ovom prikazu"). `done`:
 * everything is dealt with ("Ništa ne čeka tvoju odluku").
 */
export type EmptyCause = 'first' | 'filtered' | 'done';

export type StateDescription = {
  kind: StateKindName;
  title: string;
  /** The sentence under the title. */
  body?: string;
  primary?: { label: string };
  quiet?: { label: string };
  /** Only for `empty`. */
  cause?: EmptyCause;
  /** The state draws its picture at the size of a door (`hero` of `StateView`). Only the first time of an empty screen may. */
  hero?: boolean;
};

export type StateProblem =
  /** The state has a title and no sentence: a headline with nothing under it. */
  | 'no-sentence'
  /** The state ends nowhere: an error with nothing to press, or an empty list that is not "done" and offers no way in. */
  | 'no-way-forward'
  /** A wait that offers something to press: nothing can be done while it reads. */
  | 'loading-has-action'
  /** The sentence and the button say the same verb ("... pokušaj ponovo." over a button "Pokušaj ponovo"). */
  | 'repeats-the-action'
  /** The green action and the quiet one carry the same words. */
  | 'same-label-twice'
  /** A list that is empty because of what the person chose to look at says "Još nemaš ...", as if they had nothing. */
  | 'filter-says-first-time'
  /** A list that is empty because the person has never had one speaks about a view ("u ovom prikazu"), as if they had some. */
  | 'first-time-says-filter'
  /** A picture at the size of a door for anything but the first time of an empty list: a filter, "done" and every failure stay quiet at 96. */
  | 'hero-is-for-the-first-time';

/** Lower case, without diacritics, punctuation as single spaces: two phrases are "the same words" when these are the same. */
export function plainWords(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'dj').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The sentence says the button's words again, as a whole phrase: "Proveri vezu i pokušaj ponovo." over "Pokušaj ponovo". */
export function repeatsTheAction(sentence: string, label: string): boolean {
  const words = plainWords(label);
  return words !== '' && ` ${plainWords(sentence)} `.includes(` ${words} `);
}

const FIRST_TIME = /^jos nem/;
const ABOUT_A_VIEW = /\b(?:u ovom prikazu|u ovoj oblasti|na ovom mestu|za ove uslove|ovim uslovima)\b/;

/** What is wrong with a state, in the order of the rules; an empty list is a state that follows all of them. */
export function stateProblems(state: StateDescription): StateProblem[] {
  const problems: StateProblem[] = [];
  const { kind, title, body, primary, quiet, cause, hero } = state;
  if (kind === 'loading') {
    if (primary || quiet) problems.push('loading-has-action');
    return problems;
  }
  if (!body || body.trim() === '') problems.push('no-sentence');
  const needsPrimary = kind !== 'empty';
  const wayIn = primary !== undefined || quiet !== undefined;
  if (needsPrimary ? primary === undefined : !wayIn && cause !== 'done') problems.push('no-way-forward');
  for (const action of [primary, quiet]) {
    if (action && (repeatsTheAction(body ?? '', action.label) || repeatsTheAction(title, action.label))) { problems.push('repeats-the-action'); break; }
  }
  if (primary && quiet && plainWords(primary.label) === plainWords(quiet.label)) problems.push('same-label-twice');
  if (kind === 'empty' && cause === 'filtered' && FIRST_TIME.test(plainWords(title))) problems.push('filter-says-first-time');
  if (kind === 'empty' && cause === 'first' && ABOUT_A_VIEW.test(plainWords(title))) problems.push('first-time-says-filter');
  if (hero && !(kind === 'empty' && cause === 'first')) problems.push('hero-is-for-the-first-time');
  return problems;
}
