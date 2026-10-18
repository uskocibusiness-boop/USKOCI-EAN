---
name: uskoci-autonomous-perfection-directive
description: "Owner's 2026-09-23 late AUTONOMOUS PRODUCT COMPLETION directive — act as the whole senior team, decide everything except the listed approval gates; emulator (not the phone) for all QA; the 20-step order; maps, payment-ready and subscription prep"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-23T21:28:42.446Z
---

> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

On 2026-09-23 (late night) the owner sent "USKOČI — AUTONOMOUS PRODUCT COMPLETION / PERFECTION DIRECTIVE" and, with it,
"probavaj na emulatoru a ne telefonu, isključi telefon, koristi emulator za sve".

- **Role:** product lead, mobile UI/UX, design-system lead, RN engineer, Supabase engineer, QA, visual/UX critic,
  accessibility, performance, security and release reviewer. Do not wait for him on small decisions.
- **Stop and ask ONLY for:** real payments, prices of purchases/subscriptions, the payment provider, Google Maps/API
  billing, external accounts or API keys, legal or privacy decisions, a new permission with serious privacy
  consequences, a destructive production DB migration, deleting production data, a change of the core business
  model, a production/store release. Everything else: take the senior decision and continue.
- **QA device:** the Android emulator (AVD `USKOCI_V5_TEST`, build target `emulator`), not the HONOR phone.
- **Per screen loop:** audit → redesign plan → implement → types → tests → build → install on the emulator → open the
  screen → screenshot → visual, UX and accessibility critique (at least two separate critics: UX and VISUAL, whose
  job is to find what is still wrong) → fix → screenshot again, until clean, clear, readable, modern, premium, fast,
  logical, consistent. Code/tests passing is not "done".
- **Order (his section 22):** finish the current plan/agents → consolidate → screen sketches/plan → lock the new IA
  (DISCOVERY / MOJE AKTIVNOSTI / DOGOVORI without duplication) → TaskCard/Detail → Prijave → Dogovor → Poruke →
  Novi zadatak → Map/List → helper profile → vehicles/tools/skills/availability → calendar → notifications →
  profile/settings → payment-ready UX → full end-to-end flow pass (requester and worker, every button, every
  server contract) → performance/security/accessibility → final visual consistency → release-readiness audit.
- **Also required:** research best marketplaces for principles (never copy layout/assets/identity); cards as ONE system
  (TaskCard, ApplicationCard, AgreementCard; price very easy to see, no chip per fact, no inner lines, no six colours);
  pictograms may get premium semi-3D (soft depth, soft shadow, slight lift) mainly on pickers, never emoji/toy/2015
  skeuomorphism, board at 24/32/40/48 on a real device; serious map analysis (MapLibre vs Google vs others, cost,
  licences, privacy, keys; make the provider swappable; NO paid Google API or keys without him); payment-ready
  architecture and UX (connection fee e.g. 99 RSD, subscription, platform fee, HITNO; states pending/success/failed/
  retry/cancelled/refunded; no real transactions, no provider); subscription only with real value, prices his.
- **Commits:** one finished unit per commit; checkpoints = tests, types, build, device QA, screenshots, critic, commit.
- **Parallel agents** where they really speed up (research, critics, contract audit, tests), but ONE lead decides and
  keeps one design language.

**Why:** he wants a serious 2026 commercial product, not an MVP, and does not want to be asked about small things.
**How to apply:** keep going autonomously; only the gates above stop the work. Supersedes "use the USB phone" in
[[uskoci-design-lead-directive]] for QA; the rules in [[uskoci-design-lead-directive]] and [[uskoci-design-pass-2026-09-23]]
still hold.
