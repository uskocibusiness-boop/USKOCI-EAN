# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Component Inventory

## Foundations

- Color variables: ground, surface, raised, ink, muted ink, forest, teal, orange action, orange soft, line, success, warning, danger, info.
- Spacing variables: 4, 8, 12, 16, 20, 24, 32, 48.
- Radius variables: 8, 12, 16, 20, 24, pill.
- Typography styles: Display, Title, Heading, Body, Body Strong, Meta, Label, Action, Price/Tabular.
- Motion tokens: press, toggle, enter, exit, sheet spring, reduced motion.
- Elevation: card, sticky control, sheet/modal.

## Brand

- Original U/handshake/pin mark component.
- USKOČI wordmark.
- Animated entry scene and reduced-motion static state.
- U-signal micro-feedback mark for selection/success.

## Controls

- Button: Primary, Secondary, Quiet, Destructive; sizes 44/52/56; idle/pressed/loading/disabled.
- Icon button: bell, back, close, more, map/list, filter, camera, microphone, send.
- Input: text, password, search, money, number, date/time, multiline.
- Choice: chip, segmented control, checkbox, switch, radio row.
- Status badge and gated capability badge.
- Inline validation, banner, toast and retry block.

## Navigation

Use the owner-confirmed three-zone correction from 8 September 2026; previous five-tab variants are superseded.

- Three-zone role bar: MENI TREBA = Zadaci | U / Novi | Dogovori; JA MOGU = Prijave | U / Zadaci | Dogovori.
- Top bar with title, bell → Inbox and avatar → Profile; no permanent Home/Profile bottom items.
- List/Map switch, search/filter entry and owner Needs context inside Zadaci, available in both intents.
- Back/return header preserving source context.
- Role switch control inside Profile.
- Full-screen modal, bottom sheet and confirmation dialog.

## Marketplace

- Need Card / owner variant.
- Opportunity Card / worker variant with requester trust.
- Live AI Need Card.
- Media strip: none, one hero, 2–3 thumbnails, `+N`.
- Price block: fixed RSD / request offers.
- Time block and schedule badge.
- People/coverage block and progress.
- Requirements chips for tools, vehicle, skills and conditions.
- Location summary: approximate / exact authorized / remote / pickup-delivery.
- Map pin, cluster, selected pin and compact pin sheet.
- Search field, filter chips and filter sheet.

## Application and selection

- Application lifecycle card.
- Candidate comparison card.
- Public profile summary row.
- Reputation value with unavailable state.
- Capability snapshot section with self-declared label.
- Stale revision warning.
- Atomic selection confirmation and success transition.

## Dogovor

- Dogovor list card.
- Agreement status hero.
- Accepted-version summary.
- Participant row/team coverage.
- Schedule, price and route tiles.
- Directional phone grant row.
- Exact-location reveal row.
- Timeline event.
- Change proposal diff card.
- Completion deadline card.
- Problem/cancellation action sheet.

## Chat and AI

- User/assistant message bubble.
- Chat composer with stable sending/retry states.
- Typing/processing indicator.
- AI question card.
- Fact row: proposed, inferred, confirmed, unknown, superseded.
- Structured review group and correction sheet.
- Voice recorder/transcript placeholder state.
- Photo attachment/upload placeholder state.

## Calendar and availability

- Day/week calendar.
- Agreement event block.
- Availability rule block.
- Available-now control with expiry.
- Conflict message and resolution sheet.

## Notifications and trust

- Inbox row by family and role.
- Unread badge and mark-all action.
- Target unavailable state.
- Notification preference row and quiet-hours editor.
- Avatar, public profile header and verification unavailable/verified states.
- Rating summary and review card target.
- Safety/report form and case status target.

## System states

- Screen skeleton.
- Empty state with contextual CTA.
- Offline/cached state.
- Retry state.
- Stale/conflict state.
- Success receipt.
- Destructive confirmation.
- Config-disabled feature explanation.

Every component exposes content slots rather than formatting raw backend values. Screens consume role-specific projections and server-provided display values.

