---
name: uskoci-design-lead-directive
description: "Owner's 2026-09-23 night MASTER UI/UX directive — design-lead mode, order A–G, two visual levels, chrome discipline, per-screen phone-screenshot loop; old HTML (V28/V41/V46) = function source only, redesign composition from zero"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-23T17:55:36.128Z
---

> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

On 2026-09-23 (night) the owner sent a master UI/UX directive and a binding addendum. The rules:

- **Stop random visual patches.** After the icon checkpoint, work as design lead: PRODUCT STRATEGY → UX ARCHITECTURE →
  DESIGN SYSTEM → COMPONENTS → SCREENS → IMPLEMENTATION → REAL DEVICE QA → POLISH. Decide small things yourself; show
  him a choice only when two truly different strategic directions exist.
- **Order:** A finish icon pass (tests, phone QA, stable commit) → B document the standard toolset → C full design/UX/
  component audit → D master design system → E icon + pictogram board (checked on the phone at 20/24/32/40/48) →
  F screen priority → G implement screen by screen (1 Zadaci/discovery, 2 TaskCard, 3 Task detail, 4 creation, 5 map/
  list, 6 Prijave, 7 Dogovor, 8 Poruke, 9 helper profile/onboarding, 10 vehicle/tool/skill picker, 11 notifications,
  12 rest).
- **Two visual levels, one language:** PICKER style (real things to choose: category, services, skills, vehicles,
  tools, onboarding) = premium pictograms, 2-column grid, big targets, whitespace, clear selected state; FUNCTIONAL style
  (tasks, map, list, detail, Prijave, Dogovori, chat, calendar, notifications, settings) = calm, dense where needed,
  fewer boxes, simple icons. The green/orange FactArt direction is liked and stays.
- **Screen chrome discipline:** classify every screen ROOT / DETAIL / FLOW / CONTEXT. Bottom nav only on ROOT hubs
  (Zadaci, Mapa, Dogovori). Detail/flow/chat/agreement/other profile/rating/onboarding: back or close, minimal header,
  one contextual action. No duplicated titles (header + big title + card label). "Ne ulepšavaj višak — ukloni ga."
- **Binding addendum:** no screen is done because code or tests pass. For EVERY screen: implement → run on the HONOR
  phone → screenshot → critique (headers, nav, focus, one primary, boxes/borders/shadows, text size, spacing, price/time/
  place/status, icon consistency, premium/calm, template feel, what can be removed) → fix → screenshot again; repeat
  until it truly looks finished.
- **Old HTML is product documentation, not design authority (owner, 2026-09-23 late).** V28/V41/V46 are sources of
  FUNCTION, content, business logic, needed data and flows only. Their layout, composition, header, cards and element
  order are NOT binding. For every screen ask: "if I built USKOČI from zero today as a premium app, would I organise
  this screen like this?" If no, redesign the composition from scratch (reorder, remove, merge, split, change how facts
  are shown, drop a header, use picker layout where better). Keep FUNCTION and FLOW; the old LOOK is not kept. Key
  screens loop REDESIGN → phone SCREENSHOT → critical analysis → REDESIGN until it looks like the new USKOČI, not a
  repainted prototype. This supersedes "follow V46/V41 composition" anywhere below.
- References: his V46 HTML (`Downloads/USKOCI_V46.html`, 2026-09-23) shows functions and the target calm (nav hidden
  off root, one green sticky primary, few cards), not a layout to copy. Reference images (service-type 2-column picker
  with 3D pictograms) are a QUALITY bar only — never copy their identity or assets.

**Why:** he saw a template-like app built by patches; he wants one USKOČI design language at release quality.
**How to apply:** before touching any screen, write its ROOT/DETAIL/FLOW/CONTEXT class, first focus, one primary, and
what to remove; after implementing, run the phone screenshot loop. See [[uskoci-ship-mode-skills]],
[[uskoci-design-pass-2026-09-23]], [[uskoci-v28-identical-look]].
