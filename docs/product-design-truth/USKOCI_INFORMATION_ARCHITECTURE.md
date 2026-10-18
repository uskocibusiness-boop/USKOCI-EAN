# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Information Architecture

## Global shell

Owner-confirmed correction, 8 September 2026: the following three-zone architecture supersedes the earlier five-tab brief. The canonical three-zone shell is aligned with this decision. Shared discovery coverage is a separate implementation boundary.

```text
Launch
├─ Brand introduction
├─ Intent: Meni treba / Ja mogu
├─ Authentication / Registration / Recovery
└─ Authenticated app
   ├─ Bell → Notifications / Inbox
   ├─ Avatar → Profile / intent switch / Settings
   ├─ MENI TREBA (Naručilac)
   │  ├─ Zadaci
   │  ├─ U / Novi (New Need)
   │  └─ Dogovori
   └─ JA MOGU (Uskočer)
      ├─ Prijave
      ├─ U / Zadaci
      └─ Dogovori
```

Home and Profile are not permanent bottom tabs. Both intents can browse Zadaci through List and Map. The center U creates a Need in MENI TREBA and opens Zadaci in JA MOGU.

## Shared hierarchy

- **Zadaci discovery** — reached from Zadaci in MENI TREBA and U / Zadaci in JA MOGU
  - shared List / Map modes
  - search and filters
  - compact task cards
  - clusters/pins → compact pin sheet
  - full public task detail
  - public requester profile
  - Application composer only when the worker identity/profile and server eligibility allow it
- **Notifications** — reached from the bell
  - role filter/context
  - unread/read feed
  - resolved deep link
  - unavailable target state
- **Profile hub** — reached from the avatar
  - current intent switch
  - personal/requester profile
  - worker profile
  - skills/tools/licenses/vehicles
  - availability/calendar
  - reputation and verification
  - Settings
- **Settings**
  - notification preferences
  - account and sessions
  - privacy and data rights
  - support and safety
  - terms and privacy policy
  - account closure

## Naručilac hierarchy

- **Zadaci**
  - shared task discovery with List / Map modes
  - owner-only Needs/drafts context, clearly distinguished from public discovery
    - lifecycle filters and compact owner Need cards
    - full Need detail
      - edit through AI/manual correction
      - structured review
      - publish
      - candidate list/comparison
      - close remaining search
      - cancel
- **U / Novi**
  - AI conversation
  - live compact card
  - optional voice/media when available
  - structured review
  - save draft / publish
- **Dogovori** → shared Dogovor workspace

## Uskočer hierarchy

- **Prijave**
  - lifecycle list and Applications requiring attention
  - stale review
  - withdraw
  - open selected Dogovor
- **U / Zadaci** → shared discovery
  - profile readiness guidance where needed for Application eligibility
  - full Opportunity detail and eligible Application entry
- **Dogovori** → shared Dogovor workspace

Useful context from the superseded separate Home concepts belongs in Zadaci, Prijave, Dogovori or avatar → Profile. R01/W01 remain historical matrix records, not required new screens or implementation debt.

## Dogovor workspace

```text
Dogovor list
└─ Dogovor workspace
   ├─ Pregled
   │  ├─ accepted version
   │  ├─ participants and coverage
   │  ├─ price and schedule
   │  ├─ route / exact location access
   │  ├─ directional phone sharing
   │  └─ embedded timeline
   ├─ Poruke
   ├─ Propose / respond to change
   ├─ Cancel
   ├─ Report problem
   └─ Completion
      └─ Review (target; backend missing)
```

## Navigation rules

- Back returns to the exact originating list, filter, map viewport or Inbox context.
- Switching intent preserves identity and should preserve per-role tab history.
- A push or Inbox deep link sets the correct role context before opening its target.
- A stale or deleted target resolves to an honest unavailable state with a route back to the relevant top-level zone.
- Shared discovery does not relax owner/worker permissions, expose exact private geography, or allow an owner to apply to their own Need.
- Full details are full screens. Compact cards and map sheets never become scroll-heavy substitutes for detail.
