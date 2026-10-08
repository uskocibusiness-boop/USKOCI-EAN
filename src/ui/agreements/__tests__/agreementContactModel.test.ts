import { ADDRESS_REQUEST_TEXT, addressWords, myNumberOffer, telHref } from '../agreementContactModel';

/** R01a / R03 (UI pass 2026-10-08): what "Kontakt i mesto" offers, from what the Dogovor and the account say. */
describe('myNumberOffer: "Podeli svoj broj" is offered only to an account that can share one', () => {
  const live = { active: true, canShare: true, shared: false, accountHasNumber: true };

  it('offers sharing to an account with a number that has not shared it, and withdrawing once it has', () => {
    expect(myNumberOffer(live)).toBe('share');
    expect(myNumberOffer({ ...live, shared: true })).toBe('withdraw');
  });

  it('does not offer what cannot succeed: an account without a number is sent to Poruke', () => {
    expect(myNumberOffer({ ...live, accountHasNumber: false })).toBe('messages');
  });

  it('lets a shared number be withdrawn even if the session no longer says the account has one', () => {
    expect(myNumberOffer({ ...live, shared: true, accountHasNumber: false })).toBe('withdraw');
  });

  it('offers nothing once the Dogovor is over, or to someone who is not a side of it', () => {
    expect(myNumberOffer({ ...live, active: false })).toBe('none');
    expect(myNumberOffer({ ...live, canShare: false })).toBe('none');
    expect(myNumberOffer({ ...live, active: false, shared: true, accountHasNumber: false })).toBe('none');
  });
});

describe('telHref', () => {
  it.each([
    ['+381 64 123 4567', 'tel:+381641234567'], ['064/123-456', 'tel:064123456'], ['  (011) 234 5678 ', 'tel:0112345678'],
    ['+381641234567', 'tel:+381641234567'],
  ])('%s dials %s', (written, href) => { expect(telHref(written)).toBe(href); });

  it.each([null, undefined, '', '   ', 'nije podeljen', '12345', '+1', 'abc', '1234567890123456'])('is no number to dial: %p', written => {
    expect(telHref(written as never)).toBeNull();
  });

  it('keeps a plus only at the start', () => {
    expect(telHref('064+123456')).toBe('tel:064123456');
  });
});

describe('addressWords: the address is said to each side by its own grant', () => {
  it('tells the requester to share it when they are ready, and later that it is shared', () => {
    expect(addressWords({ requester: true, granted: false })).toEqual({ title: 'Podeli adresu kad budete spremni.', ask: false });
    expect(addressWords({ requester: true, granted: true })).toEqual({ title: 'Adresa je podeljena u ovom Dogovoru.', ask: false });
  });

  it('tells the worker it is not shared yet, and offers the one way to ask for it', () => {
    expect(addressWords({ requester: false, granted: false })).toEqual({ title: 'Adresa još nije podeljena.', ask: true });
    expect(addressWords({ requester: false, granted: true }).ask).toBe(false);
  });

  it('writes the question in the plain voice, with no gender and no "Naručilac"', () => {
    expect(ADDRESS_REQUEST_TEXT).toBe('Možeš li da podeliš tačnu adresu?');
  });
});
