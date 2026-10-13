# USKOČI V5 — Android APK CI forensic findings (2026-10-13)

## Source of evidence

- Canonical branch: `work/ultra-master-integration-20261012`.
- Failed workflow: [run 38344383850](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38344383850), build input `1699e68e616af2dcd4ab7d40c1ad8365d6082e12`.
- Full GitHub job log downloaded via connected GitHub API, job `115122278580`. Jest: 17 failed suites, 164 failed tests, 601 passing suites, 13609 passing tests; TS passed. Native prebuild/Gradle were skipped.
- The log shows `Jest did not exit`; open handles are a separate unproven concern, not the source of 164 assertions.

## Critical systemic defect

The APK workflow sets production-like `EXPO_PUBLIC_*` feature switches and `USKOCI_OTA_TARGET=preview` at **job** level, including during Jest. Legacy/default-off contract tests then import P6, paged reads, voice V2 and Poruke while their fixtures intentionally mock the old/default route. A production EAS fixture is refused because the inherited OTA target remains `preview`. This explains the observed patterns but is not evidence that all actual ON-mode features work correctly.

Correction: workflow commit `e51736b11d7ee9bc9fde60e99f3a9f977414fedc` overrides opt-in flags to `0`, clears EAS target/profile only for the Jest step, and preserves preview job-level flags for real Expo/native build. Commit `484957d72fb5b004b32b591a3ad1ede70bfed5b9` adds a prebuild assertion that 7 preview feature switches remain enabled in the APK environment. Existing explicit opt-in tests still exercise flagged behavior.

Independent EX06 defect: the test's `askOrder` source extractor looked for `].filter(` but the current Edge source uses a Set wrapper; it unintentionally captured the later question labels including **optional** `need.ends_at`. Commit `82ea22c1ce07ede341816354d7b4328506771344` bounds extraction to the real missing-fact filter and asserts that `need.ends_at.requiredForDraft=false`. This does not relax a business-rule assertion.

## Failed suites from original job log

| # | Jest file | Failing cases | Evidence / suspected shared cause | Triage |
|---:|---|---:|---|---|
| 1 | `src/data/__tests__/application-selection-native.test.tsx` | 35 | EX04_CANDIDATES_PAGED=1 with legacy source mocks; missing `Pogledaj prijavu: Milan`; `undefined.props` | Likely Jest environment / test transport; await rerun |
| 2 | `src/data/__tests__/ex06-corpus-contract.test.ts` | 1 | EX06 test extracts beyond `missing` list into questions map; unexpected `need.ends_at` ordering | Confirmed test-source parsing bug; fixed in 82ea22c |
| 3 | `src/data/__tests__/my-applications-native.test.tsx` | 55 | EX04_OWN_APPLICATIONS_PAGED=1 with legacy mock; expected `Još nemaš prijavu`, received `Prijave trenutno nisu dostupne` | Likely Jest isolation; must verify read in ON-mode separately |
| 4 | `src/data/__tests__/marketplace-owned-screens.test.tsx` | 29 | P6_DISCOVERY_READER=1 with legacy route test; `Unexpected Supabase access in route test` | Confirmed mismatch between enabled route and in-memory-only test |
| 5 | `src/ui/__tests__/retired-discovery-routes.test.tsx` | 1 | CONVERSATION_INBOX=1 adds fourth tab; expected three root tabs | Expected behavior changed to 4, but legacy tests evaluate default-off configuration |
| 6 | `src/data/__tests__/v5-tab-navigation.test.tsx` | 1 | CONVERSATION_INBOX=1; expected `[index,zadaci,dogovori]`, received fourth `poruke` | Explicit test already checks 4 when feature=1; default-off test must remain isolated |
| 7 | `src/data/__tests__/agreement-message-history-service.test.ts` | 4 | VOICE_MESSAGES=1 changes default history version; expected V1 RPC success, received `{ok:false}` | Likely Jest environment; distinguish from true V2 issues |
| 8 | `__tests__/tabLayoutSafeAreaContract.test.ts` | 2 | CONVERSATION_INBOX=1; expected three visible tabs | Likely Jest environment |
| 9 | `src/ui/system/__tests__/tab-bar-navigator.test.tsx` | 3 | CONVERSATION_INBOX=1; expected 3 tabs, received 4 | Likely Jest environment; separate four-tab coverage |
| 10 | `scripts/__tests__/eas-preview-guard.test.ts` | 11 | USKOCI_OTA_TARGET=preview leaks into production fixture; `USKOCI_OTA_TARGET_PROFILE_MISMATCH` | Confirmed conflicting global test environment; guard itself correctly refuses profile mixing |
| 11 | `src/data/__tests__/zadaci-legacy-route.test.tsx` | 9 | P6_DISCOVERY_READER=1 with legacy route mocks; `Unexpected transport` | Likely Jest environment; P6 path needs its own integration proof |
| 12 | `src/data/__tests__/agreement-message-history-voice.test.ts` | 2 | VOICE_MESSAGES=1 in default-off test; expected false, received true | Confirmed flag-context mismatch |
| 13 | `src/data/__tests__/pkg011-discovery-intent-transition.test.tsx` | 5 | P6_DISCOVERY_READER=1 with isolated source; `Unexpected Supabase access in route test` | Confirmed flag-context mismatch |
| 14 | `src/data/__tests__/candidates-paged-gate.test.ts` | 1 | EX04_CANDIDATES_PAGED=1 global; `candidatesPagedBuilt(undefined)` expected false, received true | Global default param picked up build env |
| 15 | `src/data/__tests__/discovery-v1-reader-gate.test.ts` | 3 | P6_DISCOVERY_READER=1 global; expected `LEGACY`, received `P6` | Global env versus default-off contract |
| 16 | `src/data/__tests__/own-applications-paged-gate.test.ts` | 1 | EX04_OWN_APPLICATIONS_PAGED=1 global; expected false, received true | Global env versus default-off contract |
| 17 | `src/data/__tests__/own-tasks-paged-gate.test.ts` | 1 | EX04_OWN_TASKS_PAGED=1 global; expected false, received true | Global env versus default-off contract |

**Count verification:** 164 failed cases across 17 suites. These counts come from the failure summary blocks in the original job; they are not 164 independently demonstrated application bugs.

## Safety gates / remaining evidence

- Jest isolation is not a substitute for **live ON-mode** testing. Keep opt-in targeted tests and check server deployment compatibility separately.
- `app.config.js` intentionally rejects mismatched production/preview OTA target. It was not weakened.
- Confirm `npm ci --include=dev`, `npx tsc --noEmit`, and complete `npm test -- --runInBand` in the new CI, then run Expo prebuild and native Gradle.
- The original run contains **no APK artifact**, checksum, phone-cold-start or E2E proof.
- Latest workflow run created for all three code/workflow fixes: [38379075267](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38379075267) (result to be checked; never infer success from triggering).
- Do not publish production OTA, release AAB or mutate production database as part of this diagnostic.
