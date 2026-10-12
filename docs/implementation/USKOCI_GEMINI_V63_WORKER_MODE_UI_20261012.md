# USKOČI — Gemini v63 read-only taxonomy shadow + worker-mode UI receipt

**Date:** 12 Oct 2026. DEV project `leqcwgzvjsxugfgzdmth`. No production deployment, no app OTA yet.

## Live Gemini Edge promotion (DEPLOYED)

- `uskoci-ai-interview` Edge **v62 → v63**, status `ACTIVE`, `verify_jwt=true`.
- Diff from v62 verified exact: **one new import and one guarded read-only scoped preview block**; original six source files unchanged. New seventh file `supabase/functions/_shared/taxonomyScopedShadow.mjs`.
- Live 7-file source readback **identical to the business GitHub branch**.
- Code accepts only server-owned verified V2 typed facts and provider proposals, extracts `need.category`, `need.task_geography.mode`, `need.description`, and explicit `need.required_skills`. It never derives mode from category name.
- It calls **`public.rpc_taxonomy_ai_scoped_preview_service` with service_role**, bounded to 2200 ms and only when mode + category exist. All outputs are **non-authoritative shadow diagnostics** (allowlisted action code only, no raw description or exact address in logs); failures are caught and never grant publication/dispatch authority or a second paid Gemini attempt.
- [GitHub Actions scoped Gemini pure proof 38186909735](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38186909735): PASS; direct pure code runtime spot-check also passed remote job, no-mode denial, unknown-mode denial, and authority fail-closed tests.
- Existing V2 AI completion receipt and worker AI function not changed; no actual provider-paid/phone conversation was invoked in this release. HTTP error rates and full runtime E2E must be checked separately.

## Worker execution mode preferences (DEPLOYED)

- Recorded migration `20261012001052_uskoci_worker_explicit_execution_modes_20261012`, migration total **245**.
- `private.worker_execution_mode_choices` RLS-enabled with 0 pre-populated worker preferences; only authenticated owner-bound `public.rpc_get_worker_execution_modes` and `public.rpc_set_worker_execution_modes` can access it.
- Existing seven tasks, zero opportunity deliveries, source hash of matcher `1e698d3d22c887f639e4837a4e588d01`, auto taxonomy registration OFF all unchanged.
- [CI isolated PG16/17 owner-bound proof 38186783684](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38186783684) 2/2 PASS.

## New mobile source changes — **NOT INSTALLED on phone**

- `src/data/workerExecutionModeClientService.ts` — current session/account-revision fencing, real owner-work-profile ID, explicit mode choice, mandatory saved RPC readback before success, stale account protection and no silent defaults.
- `src/app/(app)/profil/nacin-rada.tsx` — new standalone premium-white choice screen with `Na lokaciji`/ `Na daljinu` checkboxes, disclosure, save/refresh, unsaved-change exit confirmation, guarded auth/session, account-switched result fencing.
- `src/ui/workerProfile/WorkerProfilePresentation.tsx` — profile settings row labelled `Način rada`, disabled before the worker profile exists; navigates to new screen.
- `src/data/__tests__/worker-execution-mode-client.test.ts` — authenticated read, remote-only/both, write ACK loss, owner change, invalid/missing data and mode defaults.
- [Dedicated Jest + TS CI](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38187577707) was **QUEUED** when first checked; cannot claim test PASS until an actual successful run.
- This client UI is not in current installed Android preview APK and has no OTA phone proof. Existing worker profile still requires city/radius even if the worker chooses REMOTE-only; no change to activation logic was made.

## Next release gates

1. Wait for mobile TS/Jest source proof and fix all failures before any OTA.
2. Add worker-confirmed **concrete service/category UUIDs** and atomic owner/revision-bound requester review: the new worker mode choice alone is not skill consent.
3. Integrate both mode consent and exact confirmed capability in canonical matcher, preserving geography only for ON_SITE, time, blocks, privacy, exclusions, capacity and opt-in. No family/category relationship can authorize a notification.
4. Test real Auth JWT RPC use, Gemini V2 conversation shadow logs, and two real worker accounts (remote-only vs on-site-only) before controlled phone push.
5. EAS preview OTA/APK, phone proof, then isolated load and store release QA.
