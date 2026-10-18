---
name: uskoci-design-pass-2026-09-23
description: "Owner's design rules from 2026-09-23 (no eyebrows/orientation copy, stalno/ponekad/retko, hold-to-talk sends, Lottie approved, expo-speech not), the forensic UI/UX doc, and what step 0 changed"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-23T08:45:30.739Z
---

> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

On 2026-09-23 the owner asked for a forensic UI/UX analysis of the whole app (table + R4 + V28 + real
screens) and then "brže i kvalitetnije, bez gluposti" — deliver code, not documents.

**Rules he gave (apply everywhere):**
- No eyebrow / no copy explaining where you are: "ako klikne zadatak, nije u prodavnici". Inner screens =
  arrow back (+ one right action); the content's own title leads (task name, person's name). Step 0 made
  `DetailTopBar` and `ProductHeader` one anatomy (no eyebrow, no brand mark, no rule), `SettingsIntro`
  lost kicker + tagline, `SettingsScreen` content has gap 16, `ProductFact prominentAs="label"` so
  "Tražim ponude"/"Cena nije navedena" never wear the amount's style.
- "Šta treba stalno, šta jednom u 2 godine": constant = on the screen; sometimes = panel "Više"; rare =
  settings. Nothing may look "sirovo/kičasto" (his example: a command button in the middle of the
  location screen).
- AI screen: **hold → talk → release → the message goes into the conversation** (done in nova.tsx
  `onTranscript`; accessible start/stop mode keeps the review path). He wants the assistant to feel
  alive: presence at the welcome (breathing brand mark, still under reduced motion) is in; his V28
  Lottie files are awaited for the persona.
- Packages: `lottie-react-native` ~7.3.8 approved ("Da") — wrapper `src/ui/system/LottieArt.tsx`
  (first frame under reduced motion; spoken-or-silent). `expo-speech` (narrator) asked separately, NOT
  approved. No other new package.

**Where the analysis lives:** Claude Doc https://claude.ai/code/artifact/447394ea-56a9-49d8-9aba-46b49637af59
(Serbian; sections per group, cross-cutting table, design-system gaps, execution table at the end).
Repo pointer + evidence: `docs/implementation/design-audit-20260923/`.

**Why:** the app read as "nabacano" because the same thing looked five ways (headers, buttons, cards,
time formats, empties), and repeated orientation copy; the owner wants Wolt/Airbnb-level clarity while
keeping every capability. **How to apply:** fix the shared component, not the screen; one orange
action per screen with a reason beside a grey one; times without seconds and without IANA zones
("po vremenu u Srbiji"); `plural()` on every count; run the full Jest and build both APKs after each
batch; the phone verifies. Related: [[uskoci-v28-identical-look]], [[uskoci-ci-and-tooling-caveats]].
