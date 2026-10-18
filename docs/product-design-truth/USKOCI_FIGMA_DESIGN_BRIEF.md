# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Figma Design Brief

## Assignment

Design the final production mobile experience for the existing USKOČI React Native marketplace. Preserve product semantics and backend authority. Replace the current visual scaffold with a coherent, premium consumer interface that is immediately understandable, young, human, fast and trustworthy.

## Mandatory inputs

Before designing, read:

1. `USKOCI_PRODUCT_CANON.md`
2. `USKOCI_SCREEN_INVENTORY.md`
3. `USKOCI_SCREEN_STATE_MATRIX.json`
4. `USKOCI_USER_FLOWS.md`
5. `USKOCI_INFORMATION_ARCHITECTURE.md`
6. `DESIGN.md`
7. `USKOCI_COMPONENT_INVENTORY.md`
8. `USKOCI_DESIGN_IMPLEMENTATION_GAP.md`

## Truth boundary

- Canonical source: Git `38e9a38`.
- Live data model: Supabase `leqcwgzvjsxugfgzdmth`, 87 migrations, Edge AI v11.
- Open PR behavior is shown as pending only.
- Never invent ratings, verification, exact address, media, voice, push delivery, review submission, payments or enabled HITNO.
- A gated target may be designed with an explicit disabled/unavailable state.

## Locked semantics

- One account, two intents.
- Need → Application → Selection → Dogovor → Execution → Completion → Review.
- Selection is atomic and immediately creates CONFIRMED Dogovor.
- Revisions and stale states must be visible.
- Chat does not depend on phone sharing.
- Phone sharing is directional.
- Exact location depends on execution mode and access rules.
- No required “Krenuo/Stigao” ladder.
- Current platform fee policy is promotional 0 RSD; no checkout/wallet UI.

## Locked navigation

- MENI TREBA (Naručilac): Zadaci | U / Novi | Dogovori.
- JA MOGU (Uskočer): Prijave | U / Zadaci | Dogovori.
- Bell → Notifications / Inbox. Avatar → Profile, including the intent switch. No permanent Home or Profile tab. Map/List are modes inside Zadaci, accessible in both intents; access to public discovery does not grant Application or private-data permissions.
- This explicit owner correction supersedes the earlier five-tab brief; the current three-zone source is not a navigation gap.

## Figma structure

Create a new non-destructive page named **USKOČI · Product Directions · 2026-09-08** in the existing SPOJ file. Keep historical pages intact.

Sections:

1. Read me / product truth
2. Preserved brand assets
3. Direction A foundations
4. Direction A representative screens
5. Direction B foundations
6. Direction B representative screens
7. Direction C foundations
8. Direction C representative screens
9. Comparison and decision criteria
10. Selected direction — reserved

## Three required directions

Each direction must cover the same nine representative surfaces:

1. Zadaci entry in MENI TREBA (shared discovery plus owner Needs/drafts context)
2. Zadaci discovery in JA MOGU (worker opportunities context)
3. Need / Opportunity full detail
4. Map with selected pin sheet
5. AI Need creation with live card
6. Candidate selection
7. Dogovor overview
8. Chat
9. Profile

### Direction A — Human Utility

Warm editorial surfaces, generous breathing room, real people and place cues, strong sentence-case typography, tactile cards and a calm forest/orange brand signal. Best for trust and immediate comprehension.

### Direction B — Signal Map

Map and live availability as the visual spine, denser information, compact floating controls, stronger U-signal geometry and quick thumb interactions. Best for workers and high-frequency marketplace use.

### Direction C — Conversational Concierge

Conversation and contextual summaries lead. Softer modular panels, live Need card transformations, progressive disclosure and expressive but restrained motion. Best for reducing creation friction.

The directions must differ in composition, type scale, card construction, navigation treatment, density, map behavior, imagery, motion and interaction philosophy. They may share the original logo and product semantics.

## Representative content

Use realistic Serbian Latin content such as:

- “Dostava punjača iz Novog Sada u Petrovaradin”
- Lenke Dunđerski, Novi Sad → Beogradska, Petrovaradin; show exact street numbers only in owner/authorized Agreement contexts
- “Danas, što pre”
- “Tražim ponude”
- “1 osoba”

Use a second physical-help example that requires two people and a vehicle to test dense cards and multi-slot coverage.

## Deliverable quality

- Build variables and text/effect styles before final screens.
- Use auto layout and reusable components/variants.
- Name layers by product function.
- Include loading, empty, error, offline, stale, success and disabled examples for representative components.
- Verify 390×844, 360×800 and 430×932.
- Validate contrast, 44pt targets, keyboard avoidance and reduced motion.
- Show product status annotations outside phone frames; never place implementation jargon in the consumer UI.

