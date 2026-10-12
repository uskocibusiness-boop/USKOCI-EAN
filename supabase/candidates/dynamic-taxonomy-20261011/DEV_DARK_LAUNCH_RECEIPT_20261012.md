# USKOČI — private taxonomy dark-launch receipt (12 Oct 2026)

**Explicit owner-approved DEV deployment**, scoped to the canonical Supabase project `leqcwgzvjsxugfgzdmth`. **Not deployed to PROD**.

## Deployment evidence
- [Source-pinned PostgreSQL 16+17 CI run 38183889617](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38183889617): BOTH PASS. This runs the EXACT same atomic SQL file as applied on DEV, checks absent DML grants, verifies AI preview has no authority, proves duplicate migration fails closed.
- Supabase `apply_migration` returned **success:true**.
- Recorded migration `20261011232254_uskoci_private_taxonomy_dark_launch_20261012`. Total migrations increased **239 → 240**.
- Immediately after DEV deploy, read-only SQL showed **15 private work_taxonomy tables**, **10 private taxonomy functions**, `auto_registration_enabled=false`, `catalog_version=1` and **0 category records**.
- Read-only `private.taxonomy_preview_v1('Dresiranje pasa')` returned `PROPOSE_AUTO_PROVISIONAL` / `requiresRequesterReview=true` / `registrationEnabled=false` / `notificationAuthority='NONE'`.
- Read-only `private.taxonomy_existing_ai_category_preview_v1(...)` returned `NOVEL_SERVICE_REVIEW` / `classificationAuthority='NONE'` / `notificationAuthority='NONE'`.
- `service_role` verified **cannot INSERT** `work_taxonomy_categories` or `work_taxonomy_worker_capabilities` and cannot UPDATE `work_taxonomy_control`; `authenticated` cannot SELECT categories and `anon` cannot EXECUTE preview.
- Previously installed matcher body MD5 **`1e698d3d22c887f639e4837a4e588d01`** remained unchanged; 7 existing needs, 0 opportunity deliveries.

## What this accomplishes

New private catalog schema, aliases, sub/category relations, worker capability rows, reviewed task revision snapshots, audit and read-only AI/semantic suggestions exist on **DEV** without turning the feature on. It creates a safe foundation for the existing Gemini NEED_FACT_V2 and worker interview to use later, **not** a second AI. The user-facing app still uses the old matcher and 11 legacy work kinds.

## Deliberate remaining blockers

1. A strictly actor-bound authenticated review transaction must confirm work meaning and original need revision; don't trust client-provided booleans or AI ID suggestions.
2. Curated backfill/identity mapping for 11 existing work kinds, each historical task and worker-confirmed capability, preserving original texts and audit.
3. New taxonomy and canonical `private.worker_need_fit_v1` must be integrated only with full location, time, exclusions, availability, capacity, account-block, RLS and scope constraints. A preliminary capability match **alone** cannot trigger a push.
4. Genuine semantic/homonym/risk admission needs richer verified evidence; the lexical risk triage is incomplete. Auto-registration and service write privileges remain OFF.
5. Reversible, owner-reviewed migrations with full multi-account RPC/FCM/phone evidence; perform isolated 30k-scale record and concurrent HTTP tests.
6. No requestor/worker notification was sent, no provider call, no client OTA and no APK build.

**Rollback policy:** Because the deployment is additive and deliberately inactive, do not drop these tables or metadata casually. If any regression occurs, preserve data, leave registration OFF and remove API integration flags (none were enabled); separately prepare a reviewed, data-preserving rollback. No ad hoc `DROP SCHEMA`.

## Source paths

- `dev-dark-launch-locked.sql`: EXACT guarded additive DEV migration.
- `dark-launch-assert.sql`: isolated proof for default-OFF and no privileges.
- `.github/workflows/taxonomy-dark-launch-locked-pg-proof.yml`: PostgreSQL 16 and 17 tests.
