/** Privacy-safe system-push copy. No user-authored text or entity data enters this function. */
const GENERIC = Object.freeze({ title: 'USKOČI', body: 'Imaš novo obaveštenje. Otvori aplikaciju.' });

const COPY = Object.freeze({
  OPPORTUNITY_AVAILABLE: ['Novi zadatak za tebe', 'Pojavila se nova prilika koja može da ti odgovara.'],
  RESPONSE_RECEIVED: ['Nova prijava', 'Stigla je nova prijava na tvoj zadatak.'],
  RESPONSE_UPDATED: ['Prijava je izmenjena', 'Jedna prijava na tvoj zadatak je ažurirana.'],
  RESPONSE_VIEWED: ['Prijava je pregledana', 'Tvoja prijava je pregledana.'],
  RESPONSE_SHORTLISTED: ['U užem si izboru', 'Tvoja prijava je izdvojena za dalji izbor.'],
  RESPONSE_SELECTED: ['Tvoja prijava je izabrana', 'Otvori Dogovor.'],
  RESPONSE_NOT_SELECTED: ['Prijava je završena', 'Za ovaj zadatak je izabrana druga osoba.'],
  RESPONSE_STALE: ['Proveri prijavu', 'Zadatak je promenjen nakon tvoje prijave.'],
  RESPONSE_WITHDRAWN: ['Prijava je povučena', 'Jedna prijava više nije aktivna.'],
  RESPONSE_EXPIRED: ['Prijava je istekla', 'Ova prijava više nije aktivna.'],
  NEED_REVISED: ['Zadatak je izmenjen', 'Promenjeni su podaci zadatka koji pratiš.'],
  NEED_CANCELLED: ['Zadatak je otkazan', 'Zadatak više nije aktivan.'],
  AGREEMENT_VERSION_CHANGED: ['Dogovor je ažuriran', 'Promenjeni su uslovi Dogovora.'],
  AGREEMENT_CHANGE_PROPOSED: ['Predložena je izmena Dogovora', 'Proveri predložene uslove.'],
  AGREEMENT_CHANGE_REJECTED: ['Izmena nije prihvaćena', 'Predlog izmene Dogovora nije prihvaćen.'],
  AGREEMENT_CANCELLED: ['Dogovor je otkazan', 'Otvori Dogovor da vidiš trenutno stanje.'],
  EXECUTION_STATE_CHANGED: ['Status Dogovora je promenjen', 'Otvori Dogovor da vidiš sledeći korak.'],
  COMPLETION_REQUIRED: ['Potvrdi završetak', 'Zadatak je označen kao gotov.'],
  MESSAGE_RECEIVED: ['Nova poruka u Dogovoru', 'Imaš novu poruku.'],
  PRIVATE_ACCESS_GRANTED: ['Podaci Dogovora su dostupni', 'Otvori Dogovor da vidiš podatke kojima sada imaš pristup.'],
  RECOVERY_OPENED: ['Prijavljen je problem u Dogovoru', 'Otvori Dogovor da vidiš prijavljeni problem.'],
  REVIEW_RECEIVED: ['Stigla ti je nova ocena', 'Pogledaj novu ocenu saradnje.'],
  CLARIFICATION_CREATED: ['Novo pitanje za zadatak', 'Stiglo je novo pitanje.'],
  CLARIFICATION_ANSWERED: ['Stigao je odgovor', 'Na pitanje za zadatak je odgovoreno.'],
});

export const PUSH_EVENT_TYPES = Object.freeze(Object.keys(COPY));

export function notificationPushCopy(eventType, urgency = 'NORMAL') {
  if (typeof eventType !== 'string' || !Object.hasOwn(COPY, eventType)) return GENERIC;
  const [baseTitle, body] = COPY[eventType];
  const urgentOpportunity = urgency === 'HITNO' && eventType === 'OPPORTUNITY_AVAILABLE';
  return Object.freeze({ title: urgentOpportunity ? 'HITNO — nova prilika' : baseTitle, body });
}
