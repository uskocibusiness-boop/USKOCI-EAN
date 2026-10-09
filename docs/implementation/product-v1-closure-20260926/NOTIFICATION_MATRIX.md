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

| event_type | Push title | Push body A1 | Safe A2 metadata | In-app art/accent | Destination | Emitter evidence | PUSH row | Bounded admission | Physical phone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OPPORTUNITY_AVAILABLE | Novi zadatak za tebe | Pojavila se nova prilika koja može da ti odgovara. | public title; rounded distance/locality; fixed price **or** “Traže se ponude”; remote | task / orange | Opportunity | Captured emitter | Policy-gated | No | Not proved |
| RESPONSE_RECEIVED | Nova prijava | Stigla je nova prijava na tvoj zadatak. | offered price only if contract allows | offer / green | Candidates | Captured emitter | Policy-gated | No | Not proved |
| RESPONSE_UPDATED | Prijava je izmenjena | Jedna prijava na tvoj zadatak je ažurirana. | approved offer summary | offer / green | Candidates | Captured emitter | Policy-gated | No | Not proved |
| RESPONSE_VIEWED | Prijava je pregledana | Tvoja prijava je pregledana. | none | offer / green | My application | Captured emitter | Policy-gated | No | Not proved |
| RESPONSE_SHORTLISTED | U užem si izboru | Tvoja prijava je izdvojena za dalji izbor. | none | offer / green | My application | Not found in captured functions | Not proved | No | Not proved |
| RESPONSE_SELECTED | Tvoja prijava je izabrana | Otvori Dogovor. | accepted price/time summary when server-certified | agreement / green | Agreement | Captured emitter | Policy-gated | No | Not proved |
| RESPONSE_NOT_SELECTED | Prijava je završena | Za ovaj zadatak je izabrana druga osoba. | none | offer / neutral | My application | Not found in captured functions | Not proved | No | Not proved |
| RESPONSE_STALE | Proveri prijavu | Zadatak je promenjen nakon tvoje prijave. | none | offer / orange | My application | Not found in captured functions | Not proved | No | Not proved |
| RESPONSE_WITHDRAWN | Prijava je povučena | Jedna prijava više nije aktivna. | none | offer / neutral | Candidates / application | Captured emitter | Policy-gated | No | Not proved |
| RESPONSE_EXPIRED | Prijava je istekla | Ova prijava više nije aktivna. | none | offer / neutral | My application | Not found in captured functions | Not proved | No | Not proved |
| NEED_REVISED | Zadatak je izmenjen | Promenjeni su podaci zadatka koji pratiš. | public safe summary later | task / orange | Need | Captured emitter | Policy-gated | No | Not proved |
| NEED_CANCELLED | Zadatak je otkazan | Zadatak više nije aktivan. | none | task / neutral | Related application/list | Captured emitter | Policy-gated | No | Not proved |
| AGREEMENT_VERSION_CHANGED | Dogovor je ažuriran | Promenjeni su uslovi Dogovora. | certified price/time summary | agreement / green | Agreement | Captured emitter | Policy-gated | No | Not proved |
| AGREEMENT_CHANGE_PROPOSED | Predložena je izmena Dogovora | Proveri predložene uslove. | certified price/time delta later | agreement / orange | Agreement changes | Captured emitter | Policy-gated | No | Not proved |
| AGREEMENT_CHANGE_REJECTED | Izmena nije prihvaćena | Predlog izmene Dogovora nije prihvaćen. | none | agreement / neutral | Agreement | Captured emitter | Policy-gated | No | Not proved |
| AGREEMENT_CANCELLED | Dogovor je otkazan | Otvori Dogovor da vidiš trenutno stanje. | none | agreement / neutral | Agreement | Captured emitter | Policy-gated | No | Not proved |
| EXECUTION_STATE_CHANGED | Status Dogovora je promenjen | Otvori Dogovor da vidiš sledeći korak. | certified next-action label later | check / green | Agreement | Captured emitter | Policy-gated | No | Not proved |
| COMPLETION_REQUIRED | Potvrdi završetak | Zadatak je označen kao gotov. | confirmation deadline | check / orange | Agreement | Captured emitter | Policy-gated | No | Not proved |
| MESSAGE_RECEIVED | Nova poruka u Dogovoru | Imaš novu poruku. | **never message text** | chat / green | Agreement → Messages | Captured private-message emitters | Policy-gated | MESSAGE only | One delivery + tap confirmed by owner |
| PRIVATE_ACCESS_GRANTED | Podaci Dogovora su dostupni | Otvori Dogovor da vidiš podatke kojima sada imaš pristup. | never private data itself | lock / green | Agreement | Not found in captured functions | Not proved | No | Not proved |
| RECOVERY_OPENED | Prijavljen je problem u Dogovoru | Otvori Dogovor da vidiš prijavljeni problem. | none | shield / neutral | Agreement problem | Captured emitter | Policy-gated | No | Not proved |
| REVIEW_RECEIVED | Stigla ti je nova ocena | Pogledaj novu ocenu saradnje. | rating only if product policy explicitly allows it | star / warm | Reputation/review | Captured emitter | Policy-gated | No | Not proved |
| CLARIFICATION_CREATED | Novo pitanje za zadatak | Stiglo je novo pitanje. | public task label later | chat / orange | Task Q&A | Captured emitter | Policy-gated | No | Not proved |
| CLARIFICATION_ANSWERED | Stigao je odgovor | Na pitanje za zadatak je odgovoreno. | public task label later | chat / green | Task Q&A | Captured emitter | Policy-gated | No | Not proved |

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

## Observed delivery coverage — 2026-10-09

Read-only inventory of the captured canonical schema and applied single-target package:19 event types have actual emitters through `private.emit_event`; five contract rows above have no emitter found in that snapshot. A policy-gated PUSH row may be CREATED or SUPPRESSED; neither proves delivery. The applied bounded transport accepts only MESSAGE_RECEIVED. Global and target sending flags remain OFF after the one completed proof.

Private MESSAGE_RECEIVED covers text/photo/voice emitters in source. The owner's physical confirmation covers one text message and opening its intended chat, not every subtype. `rpc_send_group_message_v5` writes group messages/visibility but has no emit_event in the captured definition; group push remains an explicit gap.

OPPORTUNITY_AVAILABLE has the natural matching emitter, but requires a new bounded admission/begin/CHECK package with current need revision, unexpired READY opportunity, active eligible profile, open search/time and unfilled slots. Recheck immediately before SEND. Existing generic INBOX payload is available; direct task navigation and actual new-task phone delivery remain unproved. Existing MESSAGE journals must survive any extension/rollback.

Sources: `supabase/migrations/20260829210536_clean_emit_event_engine.sql`, `supabase/migrations/20260912090000_clean_pre_v3_event_semantics.sql`, `supabase/migrations/20260913002405_clean_v5_group_conversation.sql`, `supabase/candidates/match-v1b-remote-waves-20261007/candidate.sql`, `supabase/proofs/push_single_target/promotion/candidate.sql`, `supabase/operations/dev-alpha/ledger/20261009_push_single_target_v1_application.receipt.json`; private captured schema retained separately. This is source/snapshot evidence, not a new live delivery test.
