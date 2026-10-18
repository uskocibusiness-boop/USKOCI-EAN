> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

# Round 6 — brief for a parallel cloud session (one unit per session)

The lead session splits round 6 across separate cloud sessions so the units run at the same time (a single session's
workflow runs only two agents at once on a 4-CPU container). You own ONE unit, named in your first message. Everything
you need is in this repository.

## Read first

1. `AGENTS.md`, then `docs/implementation/design-system/cloud-handoff/README.md`.
2. The rules in `docs/implementation/design-system/cloud-handoff/rules/` (binding), and
   `docs/implementation/design-system/OWNER_DECISIONS_20260924.md` (the owner's answers of 2026-09-24, including: task
   photos appear only inside the task detail; "Mogu odmah" saves on its own; no skill labels shown to other people).
3. `USKOCI_MASTER_PLAN_DIZAJNA.md` and `docs/implementation/design-system/r1-emulator-d7152e9f/R1_CRITIQUE.md`.
4. Your unit's spec: `docs/implementation/design-system/r6-specs/<unit>.spec.json` (written by a read-only auditor;
   follow it, and where you find it wrong, do the right thing and say why). The `dogovor-dodaci` unit has no spec yet:
   write it first (step 0 below).

## Setup

- You start on the branch named in your first message (based on `work/uskoci-ui-unification-20260924`). Commit and push
  only to that branch. Never push to `work/uskoci-ui-unification-20260924` or any other branch, never open a pull request.
- `npm ci` (with scripts: its postinstall generates the gitignored `src/ui/referenceEntry/entryReferenceData.ts`, which
  the type check needs; never commit that file).

## Owner rules (binding)

Old HTML/V28/V41/V46 are sources of function and content only — recompose as a premium USKOČI built from zero would;
WHITE app, dark green for the primary action, titles and selection, orange only as a controlled accent (one orange fill
per screen plus dots and badges); one primary action per screen; no eyebrows, no copy that explains where you are, no
"server" wording; Serbian Latin with "ti", no gendered forms; text at least 12 px; touch at least 48 for commands; clear
disabled-with-reason / loading / error / success states; motion only on a real state change, none under reduced motion,
no fact animated; a missing price never looks like an amount and an amount never loses its currency; no category or
skill shown as a label to other people; never invent data; no card inside a card; no dead buttons; read the text scale
through `useTextScale()`/`roundTextScale()`. Legal, privacy and consent TEXT keeps its words and meaning. A task may
show street names (no house number) before a Dogovor. Never weaken a guard, a server call, recovery, revision,
idempotency, consent, read or viewed marking, or a test's intent. No new dependency (expo-speech is not approved).
Payments, prices, providers, store release and data deletion rules are owner decisions. No server, migration, Edge,
key or `verify_jwt` change. The locked entry and sign-in composition (`src/app/auth.tsx`, `src/app/oporavak.tsx`,
`src/ui/auth/*`, `src/ui/entry/*`, `src/ui/referenceEntry/*`) is OUT of scope.

Reuse the shared system (read it before writing anything similar): `sys` tokens (`src/ui/system/tokens.ts`),
ScreenChrome (ROOT / DETAIL with a scroll title and a right slot / FLOW), the sheet family (ProductSheet, ConfirmSheet +
useConfirmSheet, ActionSheet with subtitles, PeekSheet), StateView, Disclosure (with TurningCaret), V2Action (loading /
confirmed / error / reason), Avatar + `inicijali()`, FactArt, Pictogram + PickerTile, TaskFace / ApplicationFace /
CandidateFace, SettingsPresentation, the reduced-motion store (`src/ui/system/motion.ts`), `useTextScale()`, `vreme()`.

## Units

| unit | title | files you own |
| --- | --- | --- |
| `prijava` | Sastavljanje prijave i ocena saradnje | `src/app/(app)/prilike/[id]/prijava.tsx`; the application COMPOSER part of `src/ui/v2/ApplicationSelectionPresentation.tsx` (the `ApplicationSelectionPresentation` function and its helpers) moved into a NEW `src/ui/v2/ApplicationComposerPresentation.tsx` with a re-export from the old module (do not change `CandidateListPresentation` or `CandidateSelectionPresentation` there); `src/app/(app)/oceni-dogovor.tsx`; `src/ui/reviews/AgreementReviewScreen.tsx`; their tests. Gallery route: `src/app/dizajn-prijava.tsx`. |
| `objava` | Pregled pre objave, mesto zadatka i fotografije | `src/app/(app)/pregled-zadatka.tsx`, `src/app/(app)/pregled-nacrta.tsx`, `src/app/(app)/mesto-zadatka.tsx`, `src/ui/location/NeedLocationForm.tsx`, `src/ui/location/LocationPointEditor.tsx`, `src/ui/location/LocationControls.tsx`, `src/ui/location/CountryField.tsx`, `src/app/(app)/fotografije-zadatka.tsx`, `src/ui/media/AuthorizedPhoto.tsx` (visual only), their tests. Gallery route: `src/app/dizajn-objava.tsx`. |
| `dogovor-dodaci` | Pitanja i odgovori, izmene Dogovora, deljenje lokacije i grupni Dogovor | `src/ui/qa/TaskQaScreen.tsx`, `src/app/(app)/pitanja-zadatka.tsx`, `src/ui/agreements/AgreementActionsScreen.tsx`, `src/ui/agreements/AgreementLocationScreen.tsx`, `src/ui/AgreementPrivateLocation.tsx`, `src/ui/groups/GroupConversationScreen.tsx`, `src/ui/media/AgreementPhotoComposer.tsx`, `src/app/dogovor/[id]/izmene.tsx`, `src/app/dogovor/[id]/lokacija.tsx`, `src/app/dogovor/[id]/grupa.tsx`, their tests. Gallery route: `src/app/dizajn-dodaci.tsx`. |

Do not edit files outside your unit except new files for it; if a fix needs another file, say so in the report.
Other units and the discovery screen (`src/app/(app)/zadaci.tsx`, `src/ui/v2/Discovery*`, `src/ui/v2/discovery/*`,
`src/data/marketplaceView.ts`) are being changed in parallel by other sessions.

Briefs from the lead:
- `prijava`: the worker composes ONE application: what they offer (price for the offered scope with its basis, or the
  offer word when the task asks for offers), how many people come, an optional exact time inside the task window, a
  short note, one green send, then the existing explicit review before sending with every guard, revision, idempotency
  and recovery exactly as today. It should feel like a premium checkout step, not a form: the task summarised at the top
  as the task face (bare, no card in a card), clear field states, the reason beside a disabled send. The rating screen:
  one calm screen, the person first (Avatar, name, role), five large stars with labels for screen readers, an optional
  short comment, one green send, an honest success state and the Back label that matches where the person came from
  (Početna, Dogovori, the Dogovor).
- `objava`: the publish review is the moment of truth: the task as others will see it (the public task face and detail
  facts, bare), then what still needs an answer, then one green "Objavi zadatak" whose spinner shows only while
  publishing and the existing guards, editor locks, stale-review and recovery exactly as today; edits as quiet rows. The
  place screen: the map with the approximate public area and the private exact point clearly separated (what others see
  vs what only a Dogovor reveals), honest permission states, one primary action. Task photos: a clean grid with add,
  remove (ConfirmSheet) and upload states (uploading, failed with retry, cancel of an unconfirmed upload exactly as
  today), no dead buttons.
- `dogovor-dodaci`: Q&A as a calm public thread: the question, the owner's answer, honest statuses, the ask composer as
  the same floating pill used in Poruke and the AI chat, the existing guards. Agreement changes and cancellation as a
  serious FLOW (ScreenChrome FLOW, one decision per step, ConfirmSheet for destructive steps, every reason field and
  guard kept, exact wording kept where it is binding). Location sharing: what is shared, with whom, for how long, the
  start/stop controls with their states, never implying a live position that is not live. The group Dogovor
  conversation consistent with Poruke. No dead buttons.

## Steps

0. (`dogovor-dodaci` only) Audit, read-only: read every file in scope, the routes that open them and the tests that pin
   them; write the spec to `docs/implementation/design-system/r6-specs/dogovor-dodaci.spec.json` with, per screen: route,
   purpose, problems (file:line), the new composition top to bottom (shared components, exact Serbian copy where it
   changes, states: empty / loading / error / offline / disabled-with-reason / success, large text and 320 dp),
   what must stay untouched, tests to update; plus owner decisions and risks.
1. Build the unit from the spec.
2. Add the read-only internal gallery route named in the table, guarded exactly like `src/app/dizajn-tabla.tsx`
   (internal build only, no data read or written, every command a no-op), rendering your real presentation components
   with fixture props in their main states, with a scene list of visible labels and an in-screen "Nazad" back to the
   list. Do not edit `dizajn-tabla.tsx`.
3. Verify: `npx tsc --noEmit -p tsconfig.json` clean; changed suites and every suite importing a changed module pass;
   then the FULL `npx jest -w 3 --testTimeout=30000` (a 5 s first-run timeout under load may be re-run alone; report it).
   Keep line endings (LF in this checkout). Commit (English message; end it with the two attribution lines your session
   gives you).
4. Review: launch three reviewer subagents in parallel (Agent tool), each read-only with one lens, and give each your
   commit sha and the spec:
   - `tok` — FLOW and UX: one clear job per screen, reachable without gestures, Back lands where expected, honest and
     complete empty/loading/error/offline/disabled-with-reason/success states, Serbian copy right (gender-free, plural,
     no orientation or "server" copy), nothing invented or promised that the app does not do.
   - `izgled` — VISUAL and accessibility: tokens only, spacing on the scale, text ≥ 12 px, one primary action, orange
     budget, no card inside a card, touch ≥ 48, screen-reader labels/roles/states/hints, large text via useTextScale at
     320–430 dp, reduced motion honoured and no fact animated; the gallery route reads and writes nothing.
   - `zastite` — CORRECTNESS: guards, revisions, idempotency, consent, recovery, read and viewed marking unchanged;
     binding and legal words unchanged; no new dependency; tests updated not weakened; missing tests for new behaviour;
     line-ending churn; files outside the unit; the route test harness.
   Each returns a verdict (ship / fix first) and concrete issues with file:line and the exact fix.
5. Apply every issue that is real and in scope (verify each against the code first; say why you skip any), re-run step
   3, commit.
6. Write `docs/implementation/design-system/r6-<unit>/REPORT.md`: commits, files changed, test counts (Suites/Tests
   lines), the gallery route and its scene labels, deviations from the spec with reasons, each review issue →
   fixed/skipped (why), owner decisions left open, what the emulator check should look at. Commit it and push your
   branch (`git push -u origin <your branch>`; retry network failures up to 4 times with 2/4/8/16 s backoff).
