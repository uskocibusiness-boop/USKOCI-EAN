/** Contact details in an application note (owner decision: contacts are exchanged
 * after the Agreement). Same format rule as private.text_has_contact_v1 on DEV
 * (migration 20261122105256): a run of 8+ digits that is not a date, an e-mail,
 * a link or an @handle. Format recognition only, never a word list. */
const DATE = /[0-9]{1,2}\.\s?[0-9]{1,2}\.(\s?[0-9]{2,4}\.?)?/g;
const PHONE = /[0-9]([\s./-]?[0-9]){7,}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/i;
const LINK = /(https?:\/\/|www\.)/i;
const HANDLE = /(^|\s)@[A-Za-z0-9_.]{3,}/;

export function textHasContact(text: string | null | undefined): boolean {
  if (typeof text !== 'string' || !text) return false;
  return PHONE.test(text.replace(DATE, ' ')) || EMAIL.test(text) || LINK.test(text) || HANDLE.test(text);
}

export const APPLICATION_NOTE_CONTACT_MESSAGE =
  'Broj telefona, mejl i linkove ne šaljite u prijavi. Kontakt razmenjujete u porukama kada se dogovorite. Uklonite ih i pošaljite prijavu ponovo.';
