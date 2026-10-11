# USKOČI — existing Gemini ↔ scoped taxonomy bridge execution receipt

**Date:** 12 Oct 2026 (Europe/Belgrade).
**Canonical DEV:** `leqcwgzvjsxugfgzdmth`.
**Source:** `uskocibusiness-boop/USKOCI-EAN`, PR #6 draft branch.

## Verified deployment

Applied Supabase migration **`20261011234652_uskoci_ai_worker_scoped_taxonomy_preview_20261012`** using owner-approved additive, read-only source `supabase/candidates/dynamic-taxonomy-20261011/dev-scoped-ai-worker-readonly-bridge.sql`.
Supabase returned `success:true`; live migration list now contains **243** records. No database task/worker write operation, no notification emission and no catalog auto-registration.

[GitHub Actions PostgreSQL 16 and 17 proof 38185458898](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38185458898): **2/2 PASS**. Both reconstructed the exact 3 already installed taxonomy core migrations, installed the scoped preview functions and asserted output, wrong-mode rejection, broad family exclusion, unknown-category review, impossible `service_role` catalogue DML, and no public user EXECUTE permissions.

### Installed functions

- `private.taxonomy_existing_ai_scoped_preview_v1(execution_location_mode, need.category, need.description, need.required_skills)` — builds on existing Gemini V2 fact shapes, requires a valid task mode, checks the category ID belongs in that execution mode, rejects families as leaf authorities, adds requester review/mode-binding requirements for novel service identities.
- `private.taxonomy_worker_scoped_capability_preview_v1(execution_location_mode, worker_skill)` — reads ONE existing WORKER_PROFILE_V1 skill proposal, validates mode, refuses family-only skill entitlements and always insists on explicit worker review before any authority.

Both functions are `STABLE SECURITY INVOKER`, private-schema only, `service_role` EXECUTE and with `classificationAuthority/capabilityAuthority='NONE'`, `notificationAuthority='NONE'`. The AI claims and database snapshots remain advisory only.

### Actual DEV postflight

- Existing `needs=7`, `opportunity_deliveries=0`, `work_taxonomy_categories=14`, `worker capabilities=0`, `need snapshots=0`, `auto_registration_enabled=false`.
- Matcher MD5 unchanged: `1e698d3d22c887f639e4837a4e588d01`.
- `REMOTE + Dresiranje pasa` returns `NOVEL_SERVICE_REVIEW`, `executionScope=REMOTE`, `requiresModeBinding=true`, no class/notification authority.
- `WRONG` execution mode returns `CLARIFY`.
- `REMOTE + Izrada logotipa` (not yet registered as a leaf in DEV) returns `PROPOSE_AUTO_PROVISIONAL` and `requiresExplicitWorkerConfirmation=true`, no capability authority.
- Direct `authenticated`/ `anon` EXECUTE privilege remains denied.

## Additional operational review

Read-only check of deployed `private.candidate_profile_ids_v1b`, `private.dispatch_remote_wave_v1b`, `private.remote_wave_candidates_v1b`, and matcher found that REMOTE work already avoids geographic ST_DWithin by using remote/non-geographic worker rotation, but still requires canonical matching, calendar and other hard gates. No new dispatch RPC was deployed.

The worker AI and `public.app_profiles` still lack a dedicated, worker-confirmed choice of accepting `ON_SITE` versus `REMOTE` assignments, while worker profile currently requires `city` and `radius_km`. This is a critical next integration step. Never infer remote permission solely from a skill like design, education, or programming.

## Service-only RPC hardening incident

An initial additive public RPC migration was **rejected and rolled back atomically**, because Supabase's **explicit default function EXECUTE grants** give both `anon` and `authenticated` access to new `public` functions, not merely through `PUBLIC`. Read-only introspection confirmed default ACLs. The rejected migration DID NOT create functions or a migration record.

Corrected source `dev-service-only-scoped-ai-rpc.sql` now explicitly `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` and grants back service_role only. Dedicated GitHub test reproduces Supabase public-schema default grants before source installation. **This service-only RPC is not to be called installed until both corrected CI jobs PASS and live privileges are verified.**

## Final service RPC and existing Gemini task assistant promotion

- Corrected RPC permissions after reproducing Supabase default function grants; exact `dev-service-only-scoped-ai-rpc.sql` passed [PG16 and PG17 run 38185857924](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38185857924), **2/2 PASS**.
- Owner-approved DEV `apply_migration` returned `success:true` for **`20261011235509_uskoci_taxonomy_service_scoped_preview_rpc_20261012`**, now **244 recorded migrations**.
- Read-only DEV postflight: `public.rpc_taxonomy_ai_scoped_preview_service` and `public.rpc_taxonomy_worker_scoped_preview_service` are EXECUTE **true only for service_role** and **false for authenticated and anon**; actual scoped preview responses remain `classificationAuthority/capabilityAuthority='NONE'` and `notificationAuthority='NONE'`. Existing task count 7, deliveries 0, matcher unchanged and registry flag OFF.
- Active `uskoci-ai-interview` Edge Function updated **v61 → v62**, status ACTIVE, JWT verification true; deployed only ONE new guidance line differentiating `NA LOKACIJI` vs `NA DALJINU`, refusing to guess mode from category and honoring user-confirmed mode. Old six-file bundle retained; all six files were read back and exact matched. [AI category matching source safety CI run 38185857975](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38185857975), **3/3 PASS** (source, PostgreSQL, PostGIS). No Gemini provider turn, real app E2E, profile saving or push transport was exercised.
- **Limit:** The active Gemini Edge v62 prompt is now mode-aware, but still does not itself call the new scoped service RPC as part of the conversation completion or save; that wiring and actor-bound confirmation require a separate guarded integration and user/worker E2E.

## Still NOT done

These previews are not yet invoked by the active mobile UI or Edge conversational turn. The live worker/profile and task saving RPCs still use legacy fields, and the old matcher still governs notifications. No new Gemini provider-turn, identity-bound task/worker confirmation flow, category CRUD, mode-specific remote worker onboarding, live FCM push or new APK E2E has been proven. All new category-writing privileges remain OFF.
