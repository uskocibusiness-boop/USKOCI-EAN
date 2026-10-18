# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Figma Make Master Prompt

Build a high-fidelity, interactive mobile prototype for the existing USKOČI React Native product. This is not a new marketplace concept. Use the supplied Product Canon, Screen Inventory, State Matrix, User Flows, Information Architecture, Design Rules, Component Inventory and Implementation Gap as authoritative context.

USKOČI's promise is: **Meni treba. Ja mogu.** One account can act as both Naručilac and Uskočer.

Preserve this exact domain flow:

`Need → Application → Selection → Dogovor → Execution → Completion → Review`

Preserve these rules:

- Selection binds the exact Need revision and Application version/hash and immediately creates a CONFIRMED Dogovor.
- AI proposes structured facts; the human confirms or corrects them. AI never publishes silently.
- Chat is participant-only and independent of phone sharing.
- Phone sharing is directional.
- Exact address is private and appears only for the owner or authorized Dogovor participants. Discovery uses approximate geography.
- Ratings and verification appear only when their availability is true.
- Do not create payments, wallet, escrow or checkout. The current platform connection policy is promotional 0 RSD.
- Keep voice, media, reviews, full calendar, verification and HITNO visually gated wherever implementation is missing or disabled.

Use this locked navigation:

- MENI TREBA (Naručilac): Zadaci | U / Novi | Dogovori
- JA MOGU (Uskočer): Prijave | U / Zadaci | Dogovori
- Bell → Notifications / Inbox. Avatar → Profile, including the intent switch. No permanent Home or Profile tab. Map/List are modes inside Zadaci, accessible in both intents; access to public discovery does not grant Application or private-data permissions.
- This latest owner-confirmed three-zone decision supersedes the earlier five-tab reconstruction brief. Preserve the aligned canonical shell semantics.

Create three genuinely different directions before expanding a full app:

1. **Human Utility:** warm editorial composition, generous spacing, tactile information-complete cards, human imagery and calm trust.
2. **Signal Map:** spatial discovery first, denser data, floating thumb controls, compact cards and stronger U-signal geometry.
3. **Conversational Concierge:** conversation first, live structured summaries, progressive panels and fluid card transformation.

For each direction create these nine representative screens at 390×844:

1. Zadaci in MENI TREBA, including owner Needs/drafts context
2. Zadaci in JA MOGU, showing worker opportunities
3. full Need/Opportunity detail
4. Map with selected pin bottom sheet
5. AI Need creation with chat, live compact Need card and one missing-fact question
6. Candidate comparison/selection
7. Dogovor overview
8. Agreement chat
9. Profile with role switch

Use the existing original U/handshake/pin logo asset. Do not preserve the current scaffold's layout merely because it exists.

Use realistic Serbian Latin data. One sample Need is “Dostava punjača iz Novog Sada u Petrovaradin”, today as soon as possible, one person, request for offers. Public worker views show only safe location. Use another example requiring two people and a vehicle to test coverage and conditions.

Cards must show what, where, when, fixed price or offers, number of people, critical requirements and status. Worker discovery also shows real requester name/avatar/rating only when available. A compact card never becomes a scrolling detail. Tapping it opens a full-screen detail with description, gallery, map/route, time, price, people, requirements, requester trust and a sticky contextual CTA.

AI creation must feel fast: show the user's message immediately, show processing, update the live card, ask only one concise required question, allow corrections and end with one clear Save draft or Publish action. Include explicit offline, timeout/retry and stale-review states that preserve input.

Build a reusable variable-driven system: color, typography, spacing, radius, elevation and motion tokens; buttons, inputs, chips, three-zone navigation with a central U action/destination, Need/Opportunity/Application/Dogovor cards, map pins/sheets, AI/chat elements, calendar/availability elements, notifications, trust badges and complete system states.

Visual target: premium, young, light, human, recognizable, trustworthy and feasible in Expo/React Native. Use a 4pt grid, 44pt targets, accessible contrast, safe areas, keyboard-safe composers and reduced-motion variants. Orange is a precise brand/action signal; forest/teal builds trust; avoid generic SaaS dashboard styling, excessive gradients, glass and ornamental animation.

Annotate design-only gated targets outside device frames. Consumer screens must never say “RPC”, “migration”, “backend”, “PR” or other implementation language.

Stop after the three directions and a comparison board. Do not generate the full final application until a direction is selected.

