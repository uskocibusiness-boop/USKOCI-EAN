# USKOČI Notification Matrix — V1

Status: **A1 product contract; copy-v2 SOURCE TESTED on 2026-10-09, NOT DEPLOYED**.

The current source includes the three copy-v2 pairs below (`RESPONSE_SELECTED`, `COMPLETION_REQUIRED`, `RECOVERY_OPENED`), with old and new client presentation compatibility tested. DEV Edge24 still uses the previous three pairs; deployment is separate. Earlier `RESPONSE_VIEWED` / `RESPONSE_NOT_SELECTED` neutral corrections are already part of frozen Edge24. This matrix describes text and intended destinations; it does not prove every event emitter, automatic dispatch or physical delivery. The 2026-10-09 single-target phone test uses Edge24, not this new formatter.

System notifications are OS-owned surfaces. The app icon can carry the USKOČI green/orange identity, but the OS must not be expected to render “USKO” green and “ČI” orange inside the system header. The in-app Inbox may render the full two-tone brand treatment.

## Global rules

- App/system header: **USKOČI**.
- Lock-screen copy is short and privacy-safe.
- Never include chat body, voice transcript, phone/email, private address, safety report narrative or arbitrary user-authored text.
- Push payload carries only a minimal safe destination/event reference.
- If a dynamic fact is unavailable, omit it.
- `HITNO` may raise priority only where the user has opted into the existing urgent/quiet-hours rule.
- Price formatting comes only from canonical price-model facts.
- Distance comes only from approved approximate/public geography facts.

## Matrix

| event_type | Push title | Push body A1 | Safe A2 metadata | In-app art/accent | Destination |
| --- | --- | --- | --- | --- | --- |
| OPPORTUNITY_AVAILABLE | Novi zadatak za tebe | Pojavila se nova prilika koja može da ti odgovara. | public title; rounded distance/locality; fixed price **or** “Traže se ponude”; remote | task / orange | Opportunity |
| RESPONSE_RECEIVED | Nova prijava | Stigla je nova prijava na tvoj zadatak. | offered price only if contract allows | offer / green | Candidates |
| RESPONSE_UPDATED | Prijava je izmenjena | Jedna prijava na tvoj zadatak je ažurirana. | approved offer summary | offer / green | Candidates |
| RESPONSE_VIEWED | Prijava je pregledana | Tvoja prijava je pregledana. | none | offer / green | My application |
| RESPONSE_SHORTLISTED | U užem si izboru | Tvoja prijava je izdvojena za dalji izbor. | none | offer / green | My application |
| RESPONSE_SELECTED | Tvoja prijava je izabrana | Otvori Dogovor. | accepted price/time summary when server-certified | agreement / green | Agreement |
| RESPONSE_NOT_SELECTED | Prijava je završena | Za ovaj zadatak je izabrana druga osoba. | none | offer / neutral | My application |
| RESPONSE_STALE | Proveri prijavu | Zadatak je promenjen nakon tvoje prijave. | none | offer / orange | My application |
| RESPONSE_WITHDRAWN | Prijava je povučena | Jedna prijava više nije aktivna. | none | offer / neutral | Candidates / application |
| RESPONSE_EXPIRED | Prijava je istekla | Ova prijava više nije aktivna. | none | offer / neutral | My application |
| NEED_REVISED | Zadatak je izmenjen | Promenjeni su podaci zadatka koji pratiš. | public safe summary later | task / orange | Need |
| NEED_CANCELLED | Zadatak je otkazan | Zadatak više nije aktivan. | none | task / neutral | Related application/list |
| AGREEMENT_VERSION_CHANGED | Dogovor je ažuriran | Promenjeni su uslovi Dogovora. | certified price/time summary | agreement / green | Agreement |
| AGREEMENT_CHANGE_PROPOSED | Predložena je izmena Dogovora | Proveri predložene uslove. | certified price/time delta later | agreement / orange | Agreement changes |
| AGREEMENT_CHANGE_REJECTED | Izmena nije prihvaćena | Predlog izmene Dogovora nije prihvaćen. | none | agreement / neutral | Agreement |
| AGREEMENT_CANCELLED | Dogovor je otkazan | Otvori Dogovor da vidiš trenutno stanje. | none | agreement / neutral | Agreement |
| EXECUTION_STATE_CHANGED | Status Dogovora je promenjen | Otvori Dogovor da vidiš sledeći korak. | certified next-action label later | check / green | Agreement |
| COMPLETION_REQUIRED | Potvrdi završetak | Zadatak je označen kao gotov. | confirmation deadline | check / orange | Agreement |
| MESSAGE_RECEIVED | Nova poruka u Dogovoru | Imaš novu poruku. | **never message text** | chat / green | Agreement → Messages |
| PRIVATE_ACCESS_GRANTED | Podaci Dogovora su dostupni | Otvori Dogovor da vidiš podatke kojima sada imaš pristup. | never private data itself | lock / green | Agreement |
| RECOVERY_OPENED | Prijavljen je problem u Dogovoru | Otvori Dogovor da vidiš prijavljeni problem. | none | shield / neutral | Agreement problem |
| REVIEW_RECEIVED | Stigla ti je nova ocena | Pogledaj novu ocenu saradnje. | rating only if product policy explicitly allows it | star / warm | Reputation/review |
| CLARIFICATION_CREATED | Novo pitanje za zadatak | Stiglo je novo pitanje. | public task label later | chat / orange | Task Q&A |
| CLARIFICATION_ANSWERED | Stigao je odgovor | Na pitanje za zadatak je odgovoreno. | public task label later | chat / green | Task Q&A |

## Opportunity A2 examples

Fixed price:

**Novi zadatak za tebe**  
Montaža nameštaja  
📍 1,8 km od tebe · Ponuđeno: 3.000 RSD

Offers:

**Novi zadatak za tebe**  
Prenos nameštaja  
📍 Novi Sad · Traže se ponude

Remote:

**Novi zadatak za tebe**  
Pomoć oko Excel tabele  
🌐 Može na daljinu · Traže se ponude

These examples are not permission to synthesize missing facts. The server formatter gets explicit safe fact fields or omits the line.

## HITNO

For a real urgent opportunity whose existing policy allows urgent push:

**HITNO — nova prilika**  
Potrebna je pomoć uskoro.  
[optional safe distance/locality] · [fixed price or offers]

Do not turn ordinary events into high-priority notifications for visual effect.

## In-app Inbox

Inbox can use stronger brand treatment than the system surface:

- two-tone USKO / ČI brand mark at the screen/header level;
- event-specific FactArt icon;
- green for positive/action-ready states;
- orange for new/attention/urgent states;
- neutral ink for terminal/rejected/cancelled states;
- no colored card flood: keep current white rows/hairlines, unread dot and clear hierarchy.

## Implementation boundary

A1 formatter should be a strict allowlist keyed by `event_type`. Unknown event type falls back to:

- title: **USKOČI**
- body: **Imaš novo obaveštenje. Otvori aplikaciju.**

A2 must consume a typed, server-curated facts object. It must never parse arbitrary `payload` keys ad hoc in the Edge worker.
