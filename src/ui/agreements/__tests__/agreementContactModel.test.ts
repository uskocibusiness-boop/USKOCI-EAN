import { ADDRESS_REQUEST_TEXT, addressWords } from '../agreementContactModel';

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
