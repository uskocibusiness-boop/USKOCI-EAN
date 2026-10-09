import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationPushCopy, PUSH_EVENT_TYPES } from '../../functions/_shared/pushNotificationCopy.mjs';

const expected = {
  OPPORTUNITY_AVAILABLE: ['Novi zadatak za tebe','Pojavila se nova prilika koja može da ti odgovara.'],
  RESPONSE_RECEIVED: ['Nova prijava','Stigla je nova prijava na tvoj zadatak.'],
  RESPONSE_UPDATED: ['Prijava je izmenjena','Jedna prijava na tvoj zadatak je ažurirana.'],
  RESPONSE_VIEWED: ['Prijava je pregledana','Tvoja prijava je pregledana.'],
  RESPONSE_SHORTLISTED: ['U užem si izboru','Tvoja prijava je izdvojena za dalji izbor.'],
  RESPONSE_SELECTED: ['Tvoja prijava je izabrana','Otvori Dogovor.'],
  RESPONSE_NOT_SELECTED: ['Prijava je završena','Za ovaj zadatak je izabrana druga osoba.'],
  RESPONSE_STALE: ['Proveri prijavu','Zadatak je promenjen nakon tvoje prijave.'],
  RESPONSE_WITHDRAWN: ['Prijava je povučena','Jedna prijava više nije aktivna.'],
  RESPONSE_EXPIRED: ['Prijava je istekla','Ova prijava više nije aktivna.'],
  NEED_REVISED: ['Zadatak je izmenjen','Promenjeni su podaci zadatka koji pratiš.'],
  NEED_CANCELLED: ['Zadatak je otkazan','Zadatak više nije aktivan.'],
  AGREEMENT_VERSION_CHANGED: ['Dogovor je ažuriran','Promenjeni su uslovi Dogovora.'],
  AGREEMENT_CHANGE_PROPOSED: ['Predložena je izmena Dogovora','Proveri predložene uslove.'],
  AGREEMENT_CHANGE_REJECTED: ['Izmena nije prihvaćena','Predlog izmene Dogovora nije prihvaćen.'],
  AGREEMENT_CANCELLED: ['Dogovor je otkazan','Otvori Dogovor da vidiš trenutno stanje.'],
  EXECUTION_STATE_CHANGED: ['Status Dogovora je promenjen','Otvori Dogovor da vidiš sledeći korak.'],
  COMPLETION_REQUIRED: ['Potvrdi završetak','Zadatak je označen kao gotov.'],
  MESSAGE_RECEIVED: ['Nova poruka u Dogovoru','Imaš novu poruku.'],
  PRIVATE_ACCESS_GRANTED: ['Podaci Dogovora su dostupni','Otvori Dogovor da vidiš podatke kojima sada imaš pristup.'],
  RECOVERY_OPENED: ['Prijavljen je problem u Dogovoru','Otvori Dogovor da vidiš prijavljeni problem.'],
  REVIEW_RECEIVED: ['Stigla ti je nova ocena','Pogledaj novu ocenu saradnje.'],
  CLARIFICATION_CREATED: ['Novo pitanje za zadatak','Stiglo je novo pitanje.'],
  CLARIFICATION_ANSWERED: ['Stigao je odgovor','Na pitanje za zadatak je odgovoreno.'],
};

test('matrix covers the complete currently admitted event set exactly once', () => {
  assert.deepEqual([...PUSH_EVENT_TYPES].sort(), Object.keys(expected).sort());
  assert.equal(new Set(PUSH_EVENT_TYPES).size, PUSH_EVENT_TYPES.length);
});

test('system push copy never exposes internal side names in any event or priority', () => {
  // The same owner copy rule applies to OS surfaces and the in-app source guard.
  const internalSide = /Uskočer|uskočer|Naruči(lac|oc)|naruči(lac|oc)/;
  const offenders = [];
  for (const eventType of [...PUSH_EVENT_TYPES, 'UNKNOWN_EVENT']) {
    for (const urgency of ['NORMAL', 'HITNO']) {
      const copy = notificationPushCopy(eventType, urgency);
      for (const field of ['title', 'body']) {
        if (internalSide.test(copy[field])) offenders.push(`${eventType}/${urgency}/${field}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

for (const [eventType,[title,body]] of Object.entries(expected)) {
  test(eventType+' has fixed privacy-safe copy', () => {
    assert.deepEqual(notificationPushCopy(eventType), {title,body});
    assert.ok(title.length <= 64);
    assert.ok(body.length <= 120);
  });
}

test('HITNO changes only the opportunity headline, not arbitrary events', () => {
  assert.deepEqual(notificationPushCopy('OPPORTUNITY_AVAILABLE','HITNO'), {
    title:'HITNO — nova prilika', body:'Pojavila se nova prilika koja može da ti odgovara.'
  });
  assert.deepEqual(notificationPushCopy('MESSAGE_RECEIVED','HITNO'), notificationPushCopy('MESSAGE_RECEIVED'));
});

test('unknown/malformed future event fails closed to generic copy', () => {
  const fallback={title:'USKOČI',body:'Imaš novo obaveštenje. Otvori aplikaciju.'};
  for (const value of ['NEW_FUTURE_EVENT','message_received','',null,{},['MESSAGE_RECEIVED']]) {
    assert.deepEqual(notificationPushCopy(value),fallback);
  }
});

test('formatter has no channel for arbitrary message/address/contact text', () => {
  const secret='PRIVATE ADDRESS +381 6x xxx xxxx message body';
  const output=JSON.stringify(notificationPushCopy('MESSAGE_RECEIVED',secret));
  assert.equal(output.includes(secret),false);
  assert.equal(output.includes('+381'),false);
  assert.equal(output.includes('ADDRESS'),false);
});
