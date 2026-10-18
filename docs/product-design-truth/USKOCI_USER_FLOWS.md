# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI User Flows

Navigation follows the owner-confirmed three-zone correction of 8 September 2026. Bell → Inbox; avatar → Profile. No permanent Home/Profile tab.

## 1. First entry and dual-role account

1. Cold start plays the original USKOČI mark/wordmark sequence with reduced-motion support.
2. User chooses **Meni treba** or **Ja mogu** as current intent.
3. User signs in or creates one account.
4. The app returns to the original protected target when safe; otherwise it opens an authorized tab in the active intent (current shell defaults: requester Zadaci, worker Prijave).
5. Later, the user opens Profile through the avatar and changes intent without creating another account.

Failure flow: an unavailable Auth method stays hidden or explicitly disabled. A failed login preserves email, clears no unrelated context and allows retry. Expired recovery links explain how to request another.

## 2. Naručilac creates a Need with AI

1. Tap center **U / Novi** in MENI TREBA
2. Type or speak the whole request naturally.
3. The user's message appears immediately; the server-side interview processes it.
4. A compact Need card fills title, safe location, time, people and pricing as facts become available.
5. AI asks one concise question only when a required fact is missing or ambiguous.
6. User corrects facts in conversation or structured review.
7. One final action saves a private draft; publication is offered only if the server admission result permits it.
8. Success opens the full Need detail or owner Needs context inside Zadaci with the exact saved values.

Recovery: unsent text survives navigation. A submitted turn uses one client id; timeout shows Retry and never sends a duplicate silently. A stale review is reloaded before save. Account change cancels the old response.

## 3. Naručilac publishes and receives Applications

1. Open a draft from the owner Needs context inside Zadaci.
2. Review the full Need and publication warnings.
3. Publish with an idempotent command.
4. Inbox reports Applications and updates.
5. Open Candidates from the Need.
6. Compare price, arrival, coverage, public trust and application snapshot evidence.
7. Select the exact Application version/hash.
8. The server creates a CONFIRMED Dogovor atomically and the app opens it.

If another device edits the Need or candidate, selection fails stale and reloads the authoritative version. Partial selection preserves remaining slots and remaining search rules.

## 4. Uskočer discovers and applies

1. Open **U / Zadaci** in JA MOGU. Profile readiness and availability remain accessible through the avatar and contextual guidance.
2. Choose List or Map inside Zadaci. The same discovery modes are also accessible from Zadaci in MENI TREBA; Application eligibility remains worker-specific.
3. Search/filter without losing the List/Map result set.
4. Tap a card or map pin; a pin opens a compact sheet.
5. Open full Opportunity detail.
6. Review requester trust, public task facts and remaining places.
7. If profile readiness and deadline allow, compose Application.
8. Submit price, covered slots, proposed time and note.
9. Success opens My Applications.

If the Need revision changes, the form blocks submission and refreshes. Duplicate taps return the same server result. Location denial keeps list discovery working.

## 5. Application lifecycle

1. My Applications groups attention first, then active and terminal items.
2. Submitted → Viewed → Shortlisted are informative states.
3. Stale review required opens the changed Need and asks the worker to update or withdraw.
4. Withdraw is idempotent and clearly irreversible for that version.
5. Selected opens the Dogovor; not selected/closed remains readable history.

## 6. Dogovor execution

1. Both users open the same accepted Dogovor version from their role context.
2. Overview shows people, price, time, route/mode and current next action.
3. Chat is available to participants independently of phone sharing.
4. Either party may share or revoke only their own phone.
5. Exact location appears only when the execution mode and access rules allow it.
6. Either party may propose a change; the other accepts or rejects. Acceptance activates v+1.
7. Either party may cancel according to server rules or report a problem.
8. Worker may mark work done; requester may confirm independently. A server deadline controls the pending state.
9. Canonical completion unlocks mutual review when that backend exists.

## 7. Notifications and deep links

1. Event is written once with a dedupe key.
2. In-app delivery appears under the bell with role context.
3. Tap resolves the current target server-side.
4. App switches role if required and opens the target.
5. Deleted/unauthorized targets show an unavailable state and route to the appropriate Zadaci, Prijave or Dogovori context.

Push follows the same resolution path when provider delivery is enabled; design it now, label current transport unproven.

## 8. Availability and calendar

1. Worker sets Available now with visible expiry.
2. Worker creates weekly rules and one-off unavailable windows.
3. Calendar combines availability with accepted Dogovor obligations.
4. Conflicts are explained before save; server time remains authoritative.

The database foundation exists. The complete UI and cross-Need conflict closure do not.

## 9. Trust, safety and account lifecycle

1. Public profiles show rating/verification only when available.
2. A participant reports a Dogovor problem with preserved context.
3. Completion pauses while a problem is open.
4. Settings controls notification categories and quiet hours per role.
5. Data export and account closure require recent authentication and respect active obligations/retention.

Reviews, identity verification, data export and closure are design targets with missing backend work; no design may simulate successful execution.

