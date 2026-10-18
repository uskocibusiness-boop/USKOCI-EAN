# Client residual cleanup — 2026-10-18

Base: `06104539`, branch `feature/unified-qa-master-20261017`. Bounded follow-up to the accepted Premium White reset. No backend, live data, build, commit or push was changed by this subtask.

## Removed and aligned

- Removed the unused `WorkerAiManual` component, its draft/part types, private helpers, imports and styles. Before removal its only consumers were dedicated tests and an unused conversation mock; no product route or gallery used it. The active AI draft, signed service-mode review, activation and notifications components remain.
- Removed only the tests for that deleted editor and its unused mock export. Legacy draft command recovery and actual conversation/review tests remain.
- The profile gallery's `Area` now uses the existing `WorkerLocationForm pointOnly` contract, as the product's explicit map-confirmation route does. Saved city/country/radius cannot be edited in this gallery. Ordinary product area corrections continue through AI. Gallery render and no-server/no-storage-mutation checks remain.
- Retired the listed historical appearance gates: exact entry shadow color, Discovery corner radius, fixed footer nesting, fixed icon ordering/count, fixed title line count, duplicate card/detail text counts and caption ordering. Replaced them with meaningful visible-fact, complete-title/amount, accessible identity and privacy assertions, or removed only redundant appearance assertions where the surrounding test already protects behavior.
- Removed a historical HONOR screenshot arithmetic test which never rendered application code. Retained the screen/text-size matrix without hard-coding layout breakpoints; added 320dp / 200% text. Offers, price basis, commands and spoken facts remain checked across it. The existing font measurement proof remains because its helper still has production consumers.

## Exact changed source/test files

1. `src/ui/workerProfile/WorkerAiPresentation.tsx`
2. `src/ui/workerProfile/__tests__/worker-review-parts.test.tsx`
3. `src/ui/workerProfile/__tests__/worker-ai-review.test.tsx`
4. `src/data/__tests__/worker-conversation-parts.test.tsx`
5. `src/designLab/dizajn-profil.tsx`
6. `src/data/__tests__/profile-gallery.test.tsx`
7. `src/data/__tests__/entry-spoj-surface.test.tsx`
8. `src/data/__tests__/v5-tab-navigation.test.tsx`
9. `src/data/__tests__/task-card-layout-class.test.tsx`
10. `src/data/__tests__/task-card-face.test.tsx`
11. `src/data/__tests__/own-task-card.test.tsx`
12. `src/data/__tests__/dizajn-galerija-pregled.test.tsx`

## Verification

`node node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath` with the ten changed test paths listed above: **10 suites / 304 tests PASS, 0 snapshots, 40.216 seconds**.

`rg -n 'WorkerAiManual' src`: no remaining references. `git diff --check`: clean.

`node node_modules/typescript/bin/tsc --noEmit --pretty false`: **PASS, exit 0**. Source hashes are frozen in `work/premium-reset/client-residual-files.json` (SHA256 `7a7260717d1f87ab90d484b0a53e7997244806af161a68ca515a45349dbb57db`).

Retained protections include disabled/busy publication, read-only stored command, application deadline without an unsupported editor, exact-address visibility explanation, remote tasks without physical-location UI, named map/photo actions, signed worker service modes, and actual conversation handoff/draft recovery behavior. This is a targeted regression result; it does not claim native layout, full-suite or APK verification. Parent owns final immutable CI and delivery.
