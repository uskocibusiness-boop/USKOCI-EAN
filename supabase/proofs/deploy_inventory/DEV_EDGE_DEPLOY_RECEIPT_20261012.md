# USKOČI DEV Edge parity promotion — 12 October 2026

**User approval:** explicit permission to apply prepared changes on Supabase.
**Target:** canonical DEV `leqcwgzvjsxugfgzdmth`. Not production.
**Source:** `uskocibusiness-boop/USKOCI-EAN`, branch `fix/match-ai-category-fallback-20261010`.
**Status:** two live deployments completed and source-readback verified.

## Worker AI interview

- `uskoci-worker-interview`: v23 → **v24**.
- Server timestamp **2026-10-11T23:07:40.863Z** (12 Oct 01:07:40.863 Belgrade).
- `verify_jwt=true` preserved, `ACTIVE`.
- Deployed GitHub `supabase/functions/uskoci-worker-interview/index.ts` and imports `src/contracts/aiAvailability.ts`, `supabase/functions/_shared/aiTestBudget.ts`, `supabase/functions/_shared/geminiTaskStream.ts`. Entrypoint readback exact match.
- Introduces existing GitHub approved source for better natural questions and explicit AI credit diagnostic failures; no paid Gemini invocation or real worker onboarding performed during deployment.

## Push transport

- `uskoci-push-transport`: v28 → **v29**.
- Server timestamp **2026-10-11T23:07:57.448Z** (12 Oct 01:07:57.448 Belgrade).
- `verify_jwt=false` remains **unchanged** from the pre-existing service-to-service endpoint; code retains server-key authentication. `ACTIVE`.
- Entrypoint `supabase/functions/uskoci-push-transport/index.ts` and shared `supabase/functions/_shared/pushNotificationCopy.mjs` both re-fetched after deployment and **exactly match** the current business GitHub branch.
- Adds `OPPORTUNITY_AVAILABLE` event ID support only in existing recipient/device-bound path with environment gate `EXPO_PUSH_OPPORTUNITY_TARGET_ENABLED=true`. **No environment flag was changed in this deployment**. Actual flag status is not independently audited. No notification sends or provider receipts were triggered as part of this operation.
- Message/notification copy is now source-aligned with repo.

## Database state verified afterwards

- Matcher `private.worker_need_fit_v1(uuid,uuid,boolean)`: MD5 `1e698d3d22c887f639e4837a4e588d01`; recorded migration `20261011230505`.
- 7 total existing tasks, 0 `opportunity_deliveries`, 0 new taxonomy tables.
- Real user phone push enrollment, FCM/Expo receipt, cold/warm notification tap, actual worker Gemini conversation and 30k concurrent API users **not tested** by Edge deployment.

## Remaining blocked work

- Dynamic taxonomy foundation and runtime bindings to AI/publisher, worker confirmed capabilities and canonical dispatch remain **NOT DEPLOYED**.
- User onboarding, notification provider/permission and real Android push proof.
- Migration reconciliation of older direct SQL promotions that predate this formally recorded migration.
- Current GitHub PR is still a **draft**; merging into base and release APK/OTA is separate from Edge/SQL deployment.
