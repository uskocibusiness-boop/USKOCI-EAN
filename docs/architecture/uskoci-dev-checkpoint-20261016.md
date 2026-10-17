# USKOČI DEV integration checkpoint — 16 October 2026

> Current authoritative checkpoint for the **DEV** rollout only. Supersedes dated status statements in the 14 October gate document where they conflict. This is NOT a production or HONOR phone release certificate.

## Active DEV, confirmed
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`; GitHub: `uskocibusiness-boop/USKOCI-EAN`, draft PR #26.
- `uskoci-worker-interview` **v30** and `uskoci-ai-interview` **v80** have the shared optional `classificationShadowJson` provider schema; the previous unconditional DEV hard-OFF was removed. An explicit `USKOCI_TAXONOMY_UNIFIED_SHADOW=false` remains a rollback gate.
- Two **synthetic real-provider** Gemini `:streamGenerateContent` requests succeeded (worker HTTP 200 / requester HTTP 200, encoded optional shadow present and valid). This proves provider schema compatibility, NOT complete signed Save or handset delivery.
- Existing catalog: **141 categories**, **17 roots**, **0 invalid parent references / disconnected nodes**; **0 aliases**, **60 standard coverage rows**. Existing catalog/context RPC paginates ON_SITE 120 and REMOTE 21 with catalog version 3.
- Read-only match probe: one PUBLISHED need × two worker profiles produced **0 eligible**, both blocked by `SIGNED_SERVICE_SCOPE_REQUIRED`. Strict scope is enabled; confirmed worker capability rows, worker per-service modes and need taxonomy snapshots are all **0**. Do NOT count this as a working matcher.
- Background taxonomy cron is scheduled once per minute; its SQL task has succeeded, but zero saved-review outbox/binding receipts means this is NOT proof of successful Save integration.

## DEV changes added on 16 October
- Deployed **additive, versioned** `public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamptz,jsonb)` via Supabase migration version `20261016172724`, name `dev_need_review_taxonomy_versioned_20261016`.
- The original `public.rpc_prepare_ai_task_review` remains **unchanged**; new RPC is EXECUTE-granted only to `authenticated` and not `anon`/PUBLIC.
- Versioned RPC signs `classificationState`, `classificationCandidates`, `classificationCatalogVersion`, `classificationCatalogFingerprint` and `reviewedServiceModes` BEFORE `displayedContentDigest`. Unresolved service/mode yields pending classification, not a fabricated UUID.
- `src/data/aiTaskReviewClientService.ts` is opt-in: `EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW=true` selects the versioned RPC; default and currently installed APK remain on the old RPC. Relevant source contract test added.
- The exact applied migration is mirrored at `supabase/migrations/20261016172724_dev_need_review_taxonomy_versioned_20261016.sql` to avoid new drift.
- Source-only previous worker client opt-in remains `EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW=true`. The server has versioned worker review RPC, but no signed worker review or binder receipt yet.
- Read-only projected examples: Krečenje + ON_SITE => READY/one category/fingerprint 32; Krečenje + REMOTE or unknown service => PENDING_CLASSIFICATION/zero candidates.

## Unfinished, ordered
1. **Review and client canary:** ensure actual user-visible worker service modes and requester category/geography are included in the server-signed review, and verify client decoder + old APK read interoperability. Only activate both client opt-ins in a controlled new preview runtime after tests.
2. **Authoritative saved-review bridge:** same-owner, same-conversation, source revision and digest; after Save/Accept queue reviewed batch, commit catalog admission, and run the already-present **idempotent worker and Need binders**. Preserve unclassified tasks as searchable but not automatically matched. Do NOT promote raw Gemini hints.
3. **Legacy writer reconciliation:** align PR #24 DEV-applied migration with PR #26 migration ledger. Retire old implicit skills/category admission with signed Save path in one staged transaction—not alone.
4. **Matcher recovery:** prove positive exact service and scope, negative nonmatching/REMOTE/withdrawn skills, then requeue when a later worker confirms eligibility. Keep false push prevented; do not broad-enable notifications until this passes.
5. **Phone and release:** two-account E2E, accurate push deep link, location privacy, ON_SITE map pin, agreement, messaging, package/OTA version verification, then UI polish and Google Play policies.

## Operational limits
- Draft PR #26 is not merged. DEV migration does NOT mean the new client has been shipped to phone.
- Never replay DEV-applied migrations blindly. Inspect the actual Supabase migration ledger and GitHub migration sources.
- Do not delete old user profiles/tasks, auto-assign inferred related offers, leak exact owner addresses, or disable signed scope merely to make eligibility nonzero.
- Test-only `uskoci-gemini-schema-smoke` and `uskoci-gemini-provider-probe-dev` are retired by responses returning HTTP 410 and have no active Gemini call code.
