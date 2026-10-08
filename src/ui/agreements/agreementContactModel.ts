/**
 * What "Kontakt i mesto" of a Dogovor offers, decided without drawing anything (UI pass 2026-10-08, ideas R01a and R03 of
 * `POTREBE_KORISNIKA_20261007.md`). Pure on purpose: the section draws it, and the tests pin it with no screen.
 *
 * The number. Sharing is directed (mine is not theirs). "Podeli svoj broj" used to be offered to everyone, and it could not succeed
 * for an account that has no number: the server reads the number from the ACCOUNT, an account made with an email has none, and no
 * screen can add one (deep read 8.4, `PHONE_NOT_SET`). So the row is offered only to an account that HAS a number (the session's
 * user says so), or to one that already shared it (so it can be withdrawn). Anyone else is told, once, where contact happens: in
 * Poruke. A number the other side shared is written, and a call is one tap away.
 *
 * The address. The requester owns it and shares it when ready; the worker cannot ask for it anywhere but in the conversation, so
 * the section offers "Zatraži adresu", which takes them to Poruke with the question already written (never sent for them).
 */

/** The question "Zatraži adresu" writes into the conversation's draft; the person reads it and sends it. */
export const ADDRESS_REQUEST_TEXT = 'Možeš li da podeliš tačnu adresu?';

export type MyNumberOffer =
  /** An account with a number that has not shared it: "Podeli svoj broj". */
  | 'share'
  /** The number is shared: "Opozovi deljenje broja". */
  | 'withdraw'
  /** An account without a number that shared nothing: contact goes through Poruke. */
  | 'messages'
  /** The Dogovor is over, or the person is not a side of it: nothing to offer. */
  | 'none';

export function myNumberOffer({ active, canShare, shared, accountHasNumber }: {
  /** The Dogovor is agreed or waiting for its confirmation: the only states with anything left to share. */
  active: boolean;
  /** I am a side of the Dogovor (the command is mine to give). */
  canShare: boolean;
  shared: boolean;
  /** The signed-in account carries a phone number (the session's user). */
  accountHasNumber: boolean;
}): MyNumberOffer {
  if (!active || !canShare) return 'none';
  if (shared) return 'withdraw';
  return accountHasNumber ? 'share' : 'messages';
}

/**
 * A `tel:` link for a number a person wrote, or null when it is not a number worth dialling. Only digits and a leading "+" stay
 * (spaces, dashes and brackets are for the eye), and at least six digits are needed: anything shorter is not a phone number.
 */
export function telHref(number: string | null | undefined): string | null {
  if (typeof number !== 'string') return null;
  const lead = number.trim().startsWith('+') ? '+' : '';
  const digits = number.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15 ? `tel:${lead}${digits}` : null;
}

/**
 * How the address is said to each side while the Dogovor is agreed, from what the grant says. The requester owns the address:
 * until it is shared they are told to share it when they are ready, afterwards how long it lasts. The worker is told the address is
 * not shared yet and where to ask for it.
 */
export type AddressWords = { title: string; ask: boolean };
export function addressWords({ requester, granted }: { requester: boolean; granted: boolean }): AddressWords {
  if (requester) return { title: granted ? 'Adresa je podeljena u ovom Dogovoru.' : 'Podeli adresu kad budete spremni.', ask: false };
  return granted ? { title: 'Adresa je podeljena. Možeš da je pogledaš.', ask: false }
    : { title: 'Adresa još nije podeljena.', ask: true };
}
