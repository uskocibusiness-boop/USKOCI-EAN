> **ISTORIJSKI VIZUELNI IZVOR — povučena aktivna smernica, 18.10.2026.** Jedini važeći izgled i UX vodi [Premium White canon](../PREMIUM_WHITE_CANON.md), sa devet talasa, jednim pregledom i jednom akcijom „Izmeni kroz razgovor“. Aktuelni rad počinje u [indeksu](../../../current/README_USKOCI_LIVE_MASTER_PLAN.md). Donji datirani tekst, prethodni rezultati i citati ostaju sačuvani; njihove reči „current“, „binding“, „locked“, „apply everywhere“ i stare procedure nisu novi nalozi. Povlačenje se odnosi na estetiku, kompoziciju i prevaziđeni tok; ne ukida privatnost, prava, očuvanje podataka, pristupačnost, revizije ili recovery. Njihov stvarni ugovor proverava se u aktuelnom kodu/serveru. Ovaj banner ne dokazuje implementaciju niti isporuku novog UI-ja.

---

FINAL PRODUCT RUNBOOK (2026-09-28): read docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md for the detailed continuation contract, P0–P7 implementation/exit criteria, all62 control-row coverage, deep UI states, performance budgets, cleanup, exact evidence and store/rollout gates. This is planning only, not new runtime/DEV/device acceptance. Keep docs/control/redovi.json as the sole tracker. Start with the original FULL-return fix and publish/map/list continuity; two privacy branches remain deferred to the final whole-app pass.

OWNER ORDER UPDATE (2026-09-28): the owner explicitly defers the two Sep27 privacy branches (AI context minimization d18e830a and processor inventory 1ab01e78) to the final whole-app privacy pass before public release. Keep them recorded as NOT INTEGRATED / NOT APPLIED; do not start their integration now. Current priority is the original FULL-return defect and publication/map/list continuity, followed by the existing P0–P7 plan. This changes scheduling only, not the application scope or status of already applied packages.

BRANCH / FIRST-ENTRY AUDIT (2026-09-28): read docs/implementation/product-v1-closure-20260926/finalization-20260927/BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md. Earlier all-branches-consolidated wording was too broad. Canonical d7b98abd is synchronized, but two September27 privacy branches (AI context minimization d18e830a; processor inventory 1ab01e78) are NOT integrated/applied. Default GitHub branch remains older clean-alpha-backend/a047bc0e. Fresh DEV ledger210 and11ACTIVE Edge functions; privacy context filter absent and old technical inventory retained. Registration-email return, editable personal locality, city-first Discovery and consistency across both AI conversations remain open. This is a read-only audit, not new runtime/device acceptance.

CURRENT ROUND 32 ROLLBACK (2026-09-28 local): canonical commit 36c57b84 restores runtime 10739a44; the exact emulator APK is restored and its installed hash matches. Candidate 2b2cf4d7 and its phone APK are rejected after repeated Android ANR. Read docs/implementation/product-v1-closure-20260926/finalization-20260927/ROUND_32_NATIVE_RECEIPT.json and ROUND_32_ANR_DIAGNOSIS.md. The original FULL navigation-return bug remains open. DEV ledger 210 / push Edge v22 are unchanged; phone USB is absent and the hosted dashboard invalid_argument error is unresolved. Older checkpoints below are historical.

# USKOČI UI unification — cloud handoff (2026-09-24)

## Current checkpoint — finalization Round31

Canonical branch: `work/uskoci-ui-unification-20260924`; latest pushed client source: `10739a440611fc32e3bd6d9ee6dd66a5479e091b`.
Start with [AGENTS.md](../../../../AGENTS.md), [Round31](../../product-v1-closure-20260926/finalization-20260927/ROUND_31_NATIVE_CORRECTIONS.md)
and [its exact check record](../../product-v1-closure-20260926/finalization-20260927/ROUND_31_CHECKS.json).
Ordinary UI/flow refinement with critical review is authorized, preserving TaskCard/Peek; focused checks and consolidated emulator/device build, install and verification are authorized.
Server, certificate, dependency, payment and secret boundaries remain. The `10739a44` corrections are pushed source; their matching APK installation/native acceptance is not established by this handoff.

The dated workflow, “current head” sections and progress tables below are historical handoff records. Their status and older approval/test pauses do not supersede the current references above; still-applicable safety constraints remain in force.

## Historical checkpoint — 2026-09-25 cohesion package

Continue from `USKOCI_MASTER_PLAN_DIZAJNA.md`'s current execution checkpoint and
`../r7-cohesion-20260925/REPORT.md` / `RECEIPT.json`. Earlier “done” rows below retain their original scope/date;
gallery checks are not current-build whole-flow or phone acceptance. The integrated recovery source was b9aed185;
9956d3ee separately removed the redundant place-confirmation checkbox. The R7 receipt binds subsequent work to
its exact source/APK. No server or payment work is part of this client package.

The owner moved this work to a Claude Code cloud session to use the cloud session credits. This folder is everything
the cloud session needs that used to live only on the owner's PC.

## Read first

1. `AGENTS.md` (repo root) and `USKOCI_MASTER_PLAN_DIZAJNA.md` (the audit, the shared components and the owner's
   12-step order).
2. `rules/` — the working rules copied from the local agent memory. The binding ones:
   - `uskoci-autonomous-perfection-directive.md` — act as the whole senior team; decide everything except money,
     prices, payment provider, paid map/API keys, legal or privacy wording, serious-privacy permissions, destructive
     production changes, the business model and store release.
   - `uskoci-design-lead-directive.md` and `uskoci-design-pass-2026-09-23.md` — the design rules (old HTML is a source
     of function only; no eyebrows or orientation copy; one primary action; hold-to-talk sends on release; Lottie
     approved, expo-speech NOT approved).
   - `uskoci-owner-decisions-2026-09-24.md` — the voice notice wording is approved; a task may show street names (no
     house number) before a Dogovor.
   - `uskoci-ai-chat-reference-gemini.md` — the AI chat look.
   - `uskoci-ci-and-tooling-caveats.md`, `uskoci-route-test-harness-caveats.md`, `uskoci-local-windows-proof-caveats.md`
     — test and CI traps (Android font scale 1.3 arrives as 1.2999 → `useTextScale()`; tracked `outputs/` fixtures are
     type-checked; new supabaseClient imports crash screen suites; workflow scripts must be LF).
   - `uskoci-owner-evidence-first-rule.md` — read the real code before claiming anything; no blind fixes.
3. The receipts in `docs/implementation/design-system/r1-emulator-d7152e9f/` … `r4-emulator-f88216cd/` and
   `OWNER_DECISIONS_20260924.md`.

## Standing boundaries (unchanged)

- Work only on `work/uskoci-ui-unification-20260924`. Never change `clean-alpha-backend`, never merge the quarantine
  branch `repair/ru0-ru1-backend-20260902`, never commit the untracked
  `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql`, `.impeccable/` or the untracked
  files under `outputs/native-product-review-20260922/`.
- No server, migration, Edge, key or `verify_jwt` change in this UI work. No new dependency without the owner.
- No secrets, passwords or tokens anywhere. No paid AI or map calls.
- Serbian Latin with "ti", no gendered forms, no "server" wording; text ≥ 12 px; touch ≥ 48; never invent data.

## Where the work stands

| Owner step | State |
| --- | --- |
| 1 Audit | done |
| 2 Design system and shared components | done, emulator-verified |
| 3 Navigation, headers, bottom bar | done, emulator-verified |
| 4 Map, pins, filters | done, emulator-verified; rebuilt 24.09 as Discovery V47 (Airbnb model) — in code, emulator check pending |
| 5 Task card, task detail, Moje prijave | done, emulator-verified |
| 6 AI conversation (Gemini-style) | done, emulator-verified through the `dizajn-ai` gallery |
| 7 Incoming applications, candidate choice | done, emulator-verified through `dizajn-kandidati` |
| 8 Dogovori, Pregled, Poruke | done, emulator-verified through `dizajn-dogovori` and the real screens |
| 9–11 Profile, calendar, notifications/settings, privacy/support | built and emulator-checked on 644cab09; round 5b and 5c review fixes in code (5c emulator check pending) |
| 12 Remaining screens and whole-app regression | round 6 screens done in code (emulator check pending); whole-app sweep paused with 181 findings in `../r6-sweep/FINDINGS.json` |

Proof workflows green on b4531ef: PKG-004, 005, 006, 007, 008, 010, 042, 046, 050 (earlier on f88216cd: PKG-003, 047). RU-2 Edge RN source proof fails for a
pre-existing reason (its pinned strings were removed before this branch; last green 2026-09-03).

## Current head

See the last section of this file (updated at handoff).

## How to continue (any agent: Claude Code, Codex or a person)

Round 6 is done; `round6.workflow.js` is kept as history (it needs Claude's Workflow tool). Everything below works
with a plain shell.

1. `git fetch origin && git checkout work/uskoci-ui-unification-20260924 && git pull`, then `npm ci` (its postinstall
   generates the gitignored `src/ui/referenceEntry/entryReferenceData.ts`; with `--ignore-scripts` run
   `node scripts/sync-entry-reference-assets.cjs` yourself).
2. Work the "Next, in this order" list in the "Current head" section below. One writer per file; the owner's local
   session owns payments and PKG-051.
3. Verify every change: `npx tsc --noEmit -p tsconfig.json` and the full Jest
   `npx jest -w 3 --testTimeout=30000 --testPathIgnorePatterns '<rootDir>/.claude/' '/node_modules/'` (expect about
   302 suites / 5,882 tests; a first-run 5 s timeout under load passes when re-run alone). Read the rules in
   `rules/` first (text scale via `useTextScale()`, the route test harness traps, LF line endings).
4. Push, then dispatch the emulator APK (`gh workflow run build-android-dev-apk.yml --ref
   work/uskoci-ui-unification-20260924 -f target=emulator`) and every `pkg0*` proof workflow whose `push.paths` match
   the changed files (they run only on `work/pre-v3-engine-integration-20260911` by themselves, so dispatch them on
   this branch). The owner's PC does the emulator screenshots (`adb install -r`, galleries `uskociapp://dizajn-*`,
   emulator in Europe/Belgrade).
5. Record evidence in `docs/implementation/design-system/r<N>-…/`, update `docs/control/redovi.json`, run
   `node scripts/control/osvezi.mjs`, commit, and republish `docs/control/out/tabla.html` to the control table page.

## Open owner items

- Payment-ready UX (99 RSD connection fee, subscription, platform fee, HITNO): waits for the owner's P1–P12 decisions
  in `docs/implementation/research/PAYMENT_READY_ARCHITECTURE_20260923.md`.
- Geocoder for public release (LocationIQ paid vs the state address register), shared vocabulary for vehicles and
  tools, the four calendar wording choices and what "Mogu odmah" means to others (listed in the round-5 calendar
  report), the binding four-sentence candidate choice confirmation (kept word for word).

## Current head (updated 2026-09-24 evening by the cloud session)

Any agent (Claude or Codex) continues from here. The earlier "current head" text (bc127755, round 5c to do first) is
history: round 5c and round 6 are done.

**Branch** `work/uskoci-ui-unification-20260924` (the cloud session also mirrors it to `…-poazkl`). Head: see
`git log -1`; code head `b4531ef` plus docs. Nothing was merged into `main`. No server, migration, Edge, key or DEV
change was made by the cloud session.

**Done on 2026-09-24 in the cloud session** (all in code and tests, NOT yet seen on the emulator or a phone):
- Round 5c: the verifier leftovers of `round5b/*-verify-*.md` in five areas (profil, kalendar, obavestenja,
  privatnost/podrska, r4).
- Owner decisions 1–7 (see `../OWNER_DECISIONS_20260924.md`): "Mogu odmah" saves on its own; no skill labels in the
  offer; export step "Ova kopija se ne može sačuvati."; no "server" wording in receipts; photos only in task detail.
- Discovery V47 (the Zadaci tab on the Airbnb interaction model: search pill, step-card panel Gde/Kada/Kako se radi/
  Koliko vas dolazi/Cena, quick chips, list follows the map, "Bez tačke na mapi", one floating pin card, "Mapa" pill,
  remembered state) plus 21 fixes from three independent reviews; one reset label "Obriši uslove".
- Round 6 in three parallel cloud sessions, each with a three-lens review applied: `../r6-prijava/REPORT.md`,
  `../r6-objava/REPORT.md`, `../r6-dogovor-dodaci/REPORT.md` (specs in `../r6-specs/`). Galleries:
  `uskociapp://dizajn-prijava`, `dizajn-objava`, `dizajn-dodaci`.
- Verification on `b4531ef`: `tsc` clean; full Jest **302 suites / 5,882 tests**; proofs green: PKG-004, 005, 006, 007,
  008, 010, 042, 046, 050; emulator APK run `36038648243` (artifact `USKOCI-DEV-APK`).
- Control table rows updated (`docs/control/redovi.json`, 24.09 uveče notes) and recomputed.

**Next, in this order**
1. **Emulator loop on the owner's PC** for `b4531ef`: DONE 2026-09-24 late evening (local session). Build 36038648243
   installed on the emulator; the Zadaci tab and the three galleries photographed (27 + 24 + 28 scenes) and critiqued
   by two lenses with a code-aware skeptic per finding: **113 confirmed findings** (2 high, 36 medium, 75 low) in
   `docs/implementation/design-system/r6-emulator-b4531ef/FINDINGS.json`, the fix order per file in `R6_CRITIQUE.md`,
   the receipt in `R6_RECEIPT.json`. Still owed: widths 320–430 dp and font scale 1.3, real flows, TalkBack.
   **Fix what the pictures show** = the "Fix first" table of `R6_CRITIQUE.md`, one writer per file.
   **Split, 2026-09-24 23:30 (so two agents never touch one file):** the owner's local Claude session takes rows 1–6,
   8, 11–14 and the ResolvedPinMap half of 15 (ProductSheet, CalendarControls, Skeleton, StateView, the application
   composer and its route, ResolvedPinMap, Q&A + PillComposer, Izmene + a new shared FlowFooter, group conversation,
   AgreementPhotoComposer). **Codex / the next agent takes rows 7, 9, 10, 16 and the DiscoveryMap half of 15**
   (pregled-zadatka, ReviewPresentation, NeedLocationForm, TaskPhotosPresentation, fotografije-zadatka, Discovery*)
   together with the owner's evening decisions a–d, which live in those same files.
2. **Owner decisions of 2026-09-24 evening, not yet built:**
   - a. "U blizini" NOW (owner: "Da, odmah"): add `expo-location` with `npx expo install expo-location` (approved),
     ask the foreground permission only when the person taps "U blizini", use the position only to centre the map,
     never store or send it.
   - b. Remove "Trenutna lokacija" (sharing where I am now) from the Dogovor: its screen, route
     `/dogovor/[id]/lokacija` and entry points. KEEP the exact task address grant (`AgreementPrivateLocation`). Delete
     nothing on the server.
   - c. Written comment with a rating: YES. Needs a server package first (candidate + disposable proof + contract:
     column, length, who sees it, report path, retention on closure); DEV only on the owner's "primeni"; then the UI.
   - d. Remove the place confirmation checkbox ("Javno mesto i privatni podaci su provereni.", also the remote and the
     worker-area variants): pressing save is the confirmation (the client still sends `confirmed: true`).
   - e. Past special availability dates are never deleted automatically (no change needed).
3. **Whole-app sweep findings:** `../r6-sweep/FINDINGS.json` — 181 findings (24 major: 22 confirmed, 2 unchecked; 157
   minor/polish unchecked). The run was paused to save usage. Re-verify each against the current code, then fix with
   one fixer per area.
4. After each step: tsc + full Jest, push, dispatch the emulator APK and the proofs whose paths match, update
   `docs/control/redovi.json` + `node scripts/control/osvezi.mjs`, republish the control table.

**Coordination.** The owner's local session is building PKG-051 (versioned platform price list at 0 RSD). Payments
and the price list belong to it; the cloud session did not touch those files. It must `git fetch origin` and merge
`origin/work/uskoci-ui-unification-20260924` before its next push (no rebase, no force push).

**Still the owner's:** the payment model (free now; later Google Play billing, e.g. via RevenueCat, and/or a web
"USKOČI kredit" with DinaCard/Visa; KupujemProdajem-style paid visibility discussed), legal documents, the geocoder,
the production database, Play Console and the closed test.

## Handoff to Codex — 2026-09-24, 23:55 (owner: "Codex takes over what was not finished, from this moment")

> **Update 2026-09-25 (local session, on return):** this section is history. Codex's recovery
> (`../r6-integration-20260925/REPORT.md`, commit `b9aed185`) integrated the four fix groups, the ResolvedPinMap
> branch and the Izmene work (branch `wip/r6fix-izmene` is therefore integrated and may be deleted), connected the
> six Skeleton callers, and verified 305 suites / 5,921 tests, an APK (run 36065599150) and the emulator at
> 320–430 dp with font scale 1.3. The local session's own ResolvedPinMap cherry-pick was dropped in favour of
> Codex's reviewed version at merge. What remains is Codex's "Still separate work" list below.

**Historical interruption state** (the following was left locally; see the 2026-09-25 integration update below):

- PKG-051a (platform price list at 0 RSD) is proven and APPLIED to DEV (ledger 202); nothing more to do there.
- Round-6 emulator check of build b4531ef4: `../r6-emulator-b4531ef/` (contact sheets, `FINDINGS.json` with 113
  confirmed findings, `R6_CRITIQUE.md` with the fix order per file, `R6_RECEIPT.json`).
- Fixes already integrated from that list (each fixer ran tsc + its focused suites; the combined full Jest result is in
  the commit that carries this section):
  - `97653c2d` system: one-row ProductSheet header (the × no longer drops under the title), `clock` FactArt on time
    fields, Skeleton variants `thread` / `facts` / `preview` / `face` / `person`, StateView on the gutter with a
    full-width action. **Callers still to switch to the new variants:** `src/ui/qa/TaskQaPresentation.tsx:60` →
    `{count:3, variant:'thread'}`; `src/ui/agreements/AgreementActionsPresentation.tsx:90` → `{count:1, rows:3,
    variant:'facts'}`; `src/app/(app)/pregled-zadatka.tsx:403` and `src/app/dizajn-objava.tsx:115` → `{count:1,
    rows:3, variant:'preview'}`; `src/ui/v2/ApplicationComposerPresentation.tsx:120` → `variant:'face'`;
    `src/ui/reviews/AgreementReviewPresentation.tsx:79` → `{count:1, variant:'person'}`.
  - `b1f394e6` prijava: 20 findings in the application composer, its route, the rating screen and the gallery.
  - `94a550d7` dodaci: group conversation in the Poruke look, photo tray commands that say why.
  - `25dd5d13` dodaci: Q&A recovery panel in plain Serbian, reasoned retry, a way to the Radni profil, honest message
    tones, PillComposer `above` slot on the page gutter.
  - Izmene (rows 12 + lows: FlowFooter, AgreementActionsPresentation, `counterpartName` in decodeChangeWorkspace) and
    ResolvedPinMap (rows 8 and 15: approximate area instead of an exact pin, muted attribution tint, mode-specific
    label) were being finished by two agents when the owner stopped the session; if their commits are on the branch,
    `git log` shows them right after `25dd5d13`; if not, their work is on local branches `r6fix-izmene` /
    `r6fix-pinmap` in the owner's PC checkout and Codex should redo those two rows from `FINDINGS.json`.

**Codex takes, from this moment (one writer per file, `git fetch` + merge before every push, no rebase, no force):**

1. The remaining "Fix first" rows of `../r6-emulator-b4531ef/R6_CRITIQUE.md`: 7 (publish review), 9 (place form),
   10 (task photos), 16 (Zadaci pin card / sunk sheet / cluster), the DiscoveryMap half of 15, plus any of 12 / 8 / 15
   not on the branch (see above), and the six skeleton-variant caller switches listed above.
2. The owner's evening decisions a–d (README "Next, in this order", step 2): remove "Trenutna lokacija" (the lokacija
   skeptic's checklist is the last entry of the dodaci lokacija group in `FINDINGS.json`), no place checkbox,
   "U blizini" with `expo-location`, the rating-comment server package (candidate + disposable proof + contract; DEV
   only on the owner's "primeni").
3. After each step: `npx tsc --noEmit -p tsconfig.json`, full Jest, push, dispatch the emulator APK
   (`gh workflow run build-android-dev-apk.yml --ref work/uskoci-ui-unification-20260924 -f target=emulator`) and the
   proofs whose paths match; re-walk the galleries on the emulator (`uskociapp://dizajn-*`; leave a scene with the
   gallery's own "Nazad na scene" button — Android Back on a scene exits the app; if the emulator turns all black,
   cold-boot it with `-no-snapshot-load` and set the time zone with `adb shell service call alarm 3 s16
   Europe/Belgrade`); then the widths 320–430 dp and font scale 1.3, the real flows and TalkBack, which this check did
   not cover.
4. Do NOT work inside `.claude/worktrees/uskoci-kompletan-audit-2e715e` (the owner's Claude checkout): use
   `USKOCI-CLEAN` or your own worktree. Never commit the untracked
   `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql`, `.impeccable/` or
   `outputs/…` scratch files; payments and the price list stay with the owner's Claude session.

## Codex integration — 2026-09-25

The four local commits through `25dd5d13` are preserved, together with the interrupted `r6fix-pinmap` and
`r6fix-izmene` work. All six Skeleton call sites are now switched. Do not redo these two agents' work from scratch.
Review found and corrected two additional issues: map credit touch targets and misleading Q&A recovery text for
acknowledged processing. TypeScript is clean; full Jest: **305 suites / 5,921 tests passed**, with a worker teardown
warning. Report and exact-build verification status:
`../r6-integration-20260925/REPORT.md`. CI/build/device evidence is separate from this source result.

Work is in a separate Codex worktree, pushed to the same working branch; the original Claude checkout is intact.
Remaining owner decisions a–d, other R6 findings and release gates remain open. No DEV/Edge, payment, key, frozen
migration or dependency change was made in this integration.

Completion of this bounded recovery: source `b9aed185`, APK `36065599150` and all five matched proofs passed.
The APK is installed on the emulator and the selected gallery/large-text checks are documented in
`../r6-integration-20260925/RECEIPT.json`. Phone, full keyboard, TalkBack and live write journeys are not accepted.
The control state is regenerated; external artifact upload remains pending because filechooser automation timed out.
Continue with the report's Next bounded package, not another import of the recovered agents.
