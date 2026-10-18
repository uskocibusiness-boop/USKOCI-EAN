# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Product Canon

## Evidence boundary

This product canon was reconstructed on 8 September 2026 from canonical Git commit `38e9a38f7c9713cc7061f347eb083d84022dcdfd`, the live Supabase project `leqcwgzvjsxugfgzdmth` with 87 migrations and Edge Function `uskoci-ai-interview` v11, the current governing product documents, and the owner's latest decisions. Open PRs are evidence of work in progress, never canonical behavior.

Navigation correction, 8 September 2026: the owner explicitly reconfirmed the three-zone model below. This supersedes the five-tab instruction in the earlier reconstruction brief and the resulting design handoff. The broader code/live evidence above retains its original observation boundary; this correction adds no new live capability claim.

- **MENI TREBA (Naručilac):** Zadaci | U / Novi | Dogovori
- **JA MOGU (Uskočer):** Prijave | U / Zadaci | Dogovori

The account is singular. The intent changes; identity does not. The bell opens Notifications / Inbox, and the avatar opens Profile with the intent switch. Home and Profile are not permanent bottom tabs. Map and List belong inside Zadaci and are accessible in both intents. Public browsing never grants worker Application rights or private-location access.

The canonical `src/app/(app)/_layout.tsx` at checked commit `0e6951e357efeae8477c2325d752ceef7f013611` already implements three visible zones with Profile hidden from the bottom bar. That shell is aligned with the decision, not navigation debt. Shared Map/List access in both intents retains its separately recorded partial/pending implementation status.

## Product promise

**USKOČI — Meni treba. Ja mogu.**

USKOČI is a two-sided local services marketplace. A person describes help they need, receives Applications from people who can help, selects the exact offer, and both sides execute the resulting Dogovor. The same person may be a Naručilac today and an Uskočer tomorrow.

The surface must be simple even when the engine is strict. The user should see the next useful action, while the server owns authorization, revisions, idempotency, deadlines, privacy and lifecycle transitions.

## Canonical object model

1. A **Need / Potreba** belongs to a requester and has a revision. It carries title, description, schedule, safe geography, exact private geography where applicable, required people, conditions and either a requester price or a request for offers.
2. An **Application / Prijava** belongs to a worker and a precise Need revision. It carries a price, covered slots, proposed time, note and a snapshot of self-declared capabilities.
3. A **Selection / Izbor** binds the exact Need revision and exact Application version/hash. It is atomic and idempotent.
4. A successful Selection immediately creates a **CONFIRMED Dogovor**. There is no extra acceptance step.
5. A **Dogovor** is versioned. It owns execution state, participants, price, schedule, route mode, directional contact sharing, exact-location access, chat, change proposals, cancellation, problem state and completion.
6. **Completion** may be initiated by the worker or confirmed directly by the requester. A worker mark opens a server-held 48-hour requester window. An open problem prevents automatic closure.
7. A **Review** follows canonical completion. The product requires it, but the current database does not yet contain a complete review engine.

## Core marketplace flow

```text
NEED → APPLICATION → SELECTION → DOGOVOR → EXECUTION → COMPLETION → REVIEW
```

The flow is revision-aware. If a Need or Application changes, the user must review the new truth. The interface must never silently reuse an old selection, application or review token.

## Naručilac experience

Zadaci is the requester entry surface: it offers task discovery in List/Map and an owner-only view of the user's own Needs and drafts. Attention belongs with the relevant Need or Dogovor instead of a separate Home tab. The center U / Novi opens Need creation.

Need creation supports natural language first. AI may propose structured facts, but cannot claim that the user confirmed something they did not. The intended interaction is:

1. the user speaks or types normally;
2. AI updates a compact live Need card;
3. AI asks only for a genuinely required or ambiguous fact;
4. the user may correct any visible fact;
5. one final human action saves a draft or publishes when the server admits it.

The compact card is a preview of the marketplace card. It shows what, where, when, price/offers and people at a glance. It is not the full detail page.

The full Need detail is a whole screen: title, description, gallery, schedule, price, people, conditions, map/route, current state and contextual next action. Drafts must not show candidate counts or “candidate offers” as if already published.

Candidate selection compares real Applications. It must show the worker's public identity, available reputation, price, arrival, coverage, note and the exact capability evidence captured with that Application. Selecting creates the Dogovor atomically.

## Uskočer experience

The worker uses Prijave for Application attention, U / Zadaci for discovery, and Dogovori for accepted work. Profile and availability are reached through the avatar. There is no separate worker Home tab.

Zadaci discovery is available in both intents and has synchronized List and Map modes. Public cards show a clear task summary, safe location, time, price/offers, required people and requester trust information only when the backend provides it. Pins use approximate geography. A pin opens a compact bottom sheet; the sheet opens the full Opportunity detail.

The full detail reveals no private address. It provides enough information to decide whether to apply. The Application form captures price, covered slots, proposed time and note. Submission is idempotent and tied to the current Need revision.

My Applications is a lifecycle view: submitted, viewed, shortlisted, stale review required, withdrawn, selected or closed. A selected Application opens the resulting Dogovor.

## Dogovor experience

Both roles use the same Dogovor model with role-appropriate actions. The overview presents the accepted version, price, schedule, route, participants and current state. Chat works independently from contact sharing.

Phone sharing is directional: sharing my number does not reveal the other person's number. Exact location follows the execution mode and agreement access rules. Remote work has no physical address.

Changes are bilateral proposals. Accepting a valid proposal activates the next Agreement version. Cancellation is unilateral and affects the selected allocation. Reporting a problem is distinct from cancellation and blocks automatic completion.

The retired “Krenuo sam / Stigao sam” ladder must not reappear as required steps.

## Trust, privacy and safety

- Public discovery receives approximate geography and public projections, never raw internal rows.
- Exact address is visible to the requester and to participants only when the Dogovor rules allow it.
- Ratings, review counts and verification badges appear only when the server projection says they are available.
- Application capability evidence is self-declared unless a separate verification result exists.
- AI provider keys and service authority stay server-side.
- Presentation code consumes contracts, hooks and client services. It does not decide authorization, deadlines, publication eligibility or lifecycle transitions.

## Notifications

The in-app Inbox is part of the live product. Events cover opportunity availability, Application lifecycle, Need revisions/cancellation, Selection, Dogovor changes, execution, completion, messages, private access and clarifications. Notification preferences exist live per role context. Push device and attempt infrastructure exists, but real provider delivery and handset receipt are not yet product-proven.

## Commercial state

The current connection policy records a promotional platform cost of **0 RSD** to the requester at Selection. This is not the task price, worker payment, wallet balance, deposit or proof of a payment integration. The design must not show checkout, wallet or a paid platform fee as active.

## Capability status

| Area | Product canon | Current implementation |
|---|---|---|
| Brand intro and Auth | Required | Implemented and physically proven in scoped journeys |
| Three-zone role navigation | Latest owner-confirmed decision | Canonical shell aligned; final visual treatment remains separate |
| Need list/detail | Required | Implemented as scaffold; detail partial |
| AI Need interview/review/draft | Required | Partial; server authority live, actual provider success unproven |
| Publish | Required | RPC/foundation exists; admission policy remains gated |
| Opportunities list | Required | Implemented scaffold |
| Map/list inside Zadaci for both intents | Required | Source-proven in pending PR, not canonical; shared discovery coverage remains partial |
| Application and candidate selection | Required | Implemented with server authority; UI needs redesign |
| Dogovor and chat | Required | Implemented; broader lifecycle UX partial |
| Notification Inbox | Required | Implemented |
| Push delivery | Required | Registry/preferences exist; real delivery proof missing |
| Availability/calendar | Required | Backend partial; complete UI missing |
| Reviews/reputation | Required | Projection placeholders exist; review engine missing |
| Voice and media | Required design target | Not implemented |
| HITNO | Required gated capability | Foundation exists; config-disabled |
| Verification/data rights/account closure | Required | Not implemented |

## Design principle

**Maximum capability, minimum visible complexity.** Every screen has one dominant next action. Advanced controls appear when their context makes them useful. Error, offline, stale, empty and success states preserve user work and explain what happens next.

