import { ABOUT_CLIP, VISIBLE_TO_OTHERS, aboutDetail, cityDetail, clipText } from '../ProfileEditPresentation';

/**
 * The words of "Lični podaci" (it was "Izmeni profil" until 8 Oct 2026) that are not the name (T4a, 2026-10-07): "O meni" as written, clipped honestly; the city as the answer of its
 * row; and, since the owner's phone of 8 Oct 2026, ONE sentence about what is public (what is private is said on the privacy screen).
 */
describe('a stretch of "O meni"', () => {
  it('is the text itself when it fits, with its line breaks and runs of spaces made single spaces', () => {
    expect(clipText('Radim sa bratom.\n\n  Imamo   kombi.')).toBe('Radim sa bratom. Imamo kombi.');
    expect(clipText('   ')).toBe('');
  });

  it(`is cut after ${ABOUT_CLIP} letters with an ellipsis, never in the middle of a letter and never with a space before it`, () => {
    const exact = 'a'.repeat(ABOUT_CLIP);
    expect(clipText(exact)).toBe(exact);
    const over = clipText(`${'a'.repeat(ABOUT_CLIP - 1)} ${'b'.repeat(20)}`);
    expect(over).toBe(`${'a'.repeat(ABOUT_CLIP - 1)}…`);
    // A letter outside the basic plane is one letter, not two halves.
    const emoji = clipText(`${'😀'.repeat(ABOUT_CLIP + 5)}`);
    expect(Array.from(emoji)).toHaveLength(ABOUT_CLIP + 1);
    expect(emoji.endsWith('…')).toBe(true); expect(emoji).not.toMatch(/[\uD800-\uDBFF]$/);
  });
});

describe('what the "O meni" row says', () => {
  it('is the text as written, or the one word that invites the person to write it; the row itself leads to where it is written', () => {
    expect(aboutDetail({ kind: 'text', text: 'Radim sa bratom.' })).toBe('Radim sa bratom.');
    expect(aboutDetail({ kind: 'empty' })).toBe('Dodaj opis');
    expect(aboutDetail({ kind: 'none' })).toBe('Dodaj opis');
    expect(aboutDetail({ kind: 'error' })).toBe('Opis trenutno nije dostupan');
    expect(aboutDetail({ kind: 'loading' })).toBe('Učitavamo…');
  });

  it('explains no part of the screen: nothing of it says where a thing is written or how it changes', () => {
    for (const view of [{ kind: 'empty' }, { kind: 'none' }, { kind: 'error' }, { kind: 'loading' }] as const) {
      expect(aboutDetail(view)).not.toMatch(/piše se|radnom profilu|menja se/i);
    }
  });
});

describe('what the "Grad" row answers', () => {
  it('is the city of the work area, or why there is none, in the row\'s own words and never a sentence', () => {
    expect(cityDetail({ kind: 'city', city: 'Novi Sad' })).toBe('Novi Sad');
    expect(cityDetail({ kind: 'none' })).toBe('Još nije podešen');
    expect(cityDetail({ kind: 'error' })).toBe('Nije dostupan');
    expect(cityDetail({ kind: 'loading' })).toBe('Učitavamo…');
  });
});

describe('what is public', () => {
  it('says who sees the profile in one sentence', () => {
    expect(VISIBLE_TO_OTHERS).toBe('Ime, fotografija, grad, „O meni“ i ocene vide drugi.');
  });

  it('promises no anonymity and uses no word of the engine or of the law', () => {
    expect(VISIBLE_TO_OTHERS).not.toMatch(/anonim|server|zakon|GDPR|Naručilac|Uskočer|korisnik/i);
  });
});
