import { readFileSync } from 'fs';
import { join } from 'path';
import { ABOUT_CLIP, SHARED_ONLY_BY_RULES, VISIBLE_TO_OTHERS, aboutDetail, cityDetail, clipText } from '../ProfileEditPresentation';

/**
 * The words of "Izmeni profil" that are not the name (T4a, 2026-10-07): "O meni" as written, clipped honestly; the city; and the
 * two sentences about what is public and what is private, the second exactly as the privacy screen has it.
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
  it('is the text as written, or the honest reason there is none, and where it is written', () => {
    expect(aboutDetail({ kind: 'text', text: 'Radim sa bratom.' })).toBe('Radim sa bratom.');
    expect(aboutDetail({ kind: 'empty' })).toBe('Još nije napisano. Dodaj ga u radnom profilu.');
    expect(aboutDetail({ kind: 'none' })).toBe('Piše se u radnom profilu.');
    expect(aboutDetail({ kind: 'error' })).toBe('Opis trenutno nije dostupan. Piše se u radnom profilu.');
    expect(aboutDetail({ kind: 'loading' })).toBe('Učitavamo…');
  });
});

describe('what the "Grad" row says', () => {
  it('is the city of the work area, or why there is none', () => {
    expect(cityDetail({ kind: 'city', city: 'Novi Sad' })).toBe('Novi Sad');
    expect(cityDetail({ kind: 'none' })).toBe('Još nije podešen.');
    expect(cityDetail({ kind: 'error' })).toBe('Grad trenutno nije dostupan.');
    expect(cityDetail({ kind: 'loading' })).toBe('Učitavamo…');
  });
});

describe('what is public and what is private', () => {
  it('says who sees the profile, and keeps the second sentence exactly as the privacy screen says it', () => {
    expect(VISIBLE_TO_OTHERS).toBe('Ime, fotografija, grad, „O meni“ i ocene vide druge osobe.');
    expect(SHARED_ONLY_BY_RULES).toBe('Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.');
  });

  it('reuses the privacy screen\'s own sentence rather than writing a second one: if that one changes, this one must follow', () => {
    const privacy = readFileSync(join(__dirname, '..', '..', 'privacy', 'PrivacyPresentation.tsx'), 'utf8');
    expect(privacy).toContain(SHARED_ONLY_BY_RULES);
  });

  it('promises no anonymity and uses no word of the engine or of the law', () => {
    expect(`${VISIBLE_TO_OTHERS} ${SHARED_ONLY_BY_RULES}`).not.toMatch(/anonim|server|zakon|GDPR|Naručilac|Uskočer|korisnik/i);
  });
});
