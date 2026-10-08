import { authFieldMessages, firstInvalidField, isEmailAddress, tidyCity, validateAuthForm, type AuthFormValues } from '../authValidation';
import { defaultAuthMethods } from '../authMethods';

/** What is wrong with the sign-in and sign-up fields before anything is sent, and the defaults the form stands on without the check. */
const full: AuthFormValues = { ime: 'Ana', prezime: 'Petrović', grad: 'Novi Sad', email: 'ana@example.test', lozinka: 'password' };

describe('validateAuthForm', () => {
  it('asks a sign-in only for an email and a password, and a password of any length', () => {
    expect(validateAuthForm('LOGIN', { ...full, ime: '', prezime: '', grad: '', lozinka: 'a' })).toEqual({});
    expect(validateAuthForm('LOGIN', { ime: '', prezime: '', grad: '', email: '', lozinka: '' })).toEqual({
      email: authFieldMessages.emailMissing, lozinka: authFieldMessages.lozinkaMissing });
  });

  it('asks a sign-up for a name, a surname, a city, an email and a password of at least six characters', () => {
    expect(validateAuthForm('SIGNUP', full)).toEqual({});
    expect(validateAuthForm('SIGNUP', { ime: ' ', prezime: '', grad: '  ', email: '', lozinka: '' })).toEqual({
      ime: 'Unesi ime.', prezime: 'Unesi prezime.', grad: 'Unesi grad.', email: 'Unesi email.', lozinka: 'Unesi lozinku.' });
    expect(validateAuthForm('SIGNUP', { ...full, lozinka: '12345' })).toEqual({ lozinka: 'Lozinka mora imati najmanje 6 znakova.' });
    expect(validateAuthForm('SIGNUP', { ...full, lozinka: '123456' })).toEqual({});
  });

  it('says an address that is not one, and lets a spaced one through (it is trimmed when sent)', () => {
    expect(validateAuthForm('LOGIN', { ...full, email: 'ana@example' })).toEqual({ email: 'Unesi ispravnu email adresu.' });
    expect(validateAuthForm('LOGIN', { ...full, email: 'ana example.test' })).toEqual({ email: 'Unesi ispravnu email adresu.' });
    expect(validateAuthForm('LOGIN', { ...full, email: '  ana@example.test  ' })).toEqual({});
    expect([isEmailAddress('a@b.rs'), isEmailAddress('a@b'), isEmailAddress('@b.rs'), isEmailAddress('')]).toEqual([true, false, false, false]);
  });

  it('names the first wrong field top to bottom, so it can take the focus', () => {
    expect(firstInvalidField({})).toBeNull();
    expect(firstInvalidField({ lozinka: 'x', email: 'y' })).toBe('email');
    expect(firstInvalidField({ lozinka: 'x', grad: 'y', ime: 'z' })).toBe('ime');
  });

  it('every sentence is plain Serbian in the "ti" voice, short, with a full stop and without the words of the engine', () => {
    for (const sentence of Object.values(authFieldMessages)) {
      expect(sentence).toMatch(/\.$/);
      expect(sentence).not.toMatch(/server|zahtev|greška|neispravn|nevalidn|polje/i);
      expect(sentence.length).toBeLessThan(60);
    }
  });
});

describe('tidyCity', () => {
  it.each([['NovI SAD', 'Novi Sad'], ['NOVI SAD', 'Novi Sad'], ['novi sad', 'Novi Sad'], ['  Beograd ', 'Beograd'], ['Sremska Kamenica', 'Sremska Kamenica'],
    ['ŠID', 'Šid'], ['', '']])('keeps %j as %j', (typed, kept) => {
    expect(tidyCity(typed)).toBe(kept);
  });
});

describe('defaultAuthMethods: what the form stands on while the check is slow or failed', () => {
  const REDIRECT = 'EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL';
  const before = process.env[REDIRECT];
  afterEach(() => { if (before === undefined) delete process.env[REDIRECT]; else process.env[REDIRECT] = before; });

  it('is email and password, with sign-up offered, no phone, and a confirmation expected', () => {
    delete process.env[REDIRECT];
    expect(defaultAuthMethods()).toEqual({ emailPassword: true, emailSignup: true, phoneOtp: false, emailConfirmationRequired: true, passwordRecovery: false });
  });

  it('offers recovery of a password exactly when this build has the one redirect it needs', () => {
    process.env[REDIRECT] = 'uskociapp://oporavak';
    expect(defaultAuthMethods().passwordRecovery).toBe(true);
    process.env[REDIRECT] = 'https://example.test/anything';
    expect(defaultAuthMethods().passwordRecovery).toBe(false);
  });
});
