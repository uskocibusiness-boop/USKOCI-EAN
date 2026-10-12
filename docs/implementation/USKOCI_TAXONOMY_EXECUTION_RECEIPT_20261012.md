# USKOČI — dynamic taxonomy work execution receipt, 12 October 2026

**Status:** first non-operational catalog on canonical DEV, 11 legacy family anchors, 30k-record capability proof. **NOT** a completed automatic category creation or end-to-end mobile release.

Target Supabase DEV: `leqcwgzvjsxugfgzdmth`; GitHub `uskocibusiness-boop/USKOCI-EAN`, draft PR #6 branch `fix/match-ai-category-fallback-20261010`.

## 1 — Private catalog dark launch: DEPLOYED

Migration **`20261011232254_uskoci_private_taxonomy_dark_launch_20261012`** added 15 private tables, 10 private functions, confirmed catalog version 1, no categories, `auto_registration_enabled=false`. Runtime `service_role` lacks DML on catalog and role-bound review tables; `authenticated`/ `anon` cannot read/execute privileged catalog operations. No dispatch/AI Edge active path was replaced.

CI [PostgreSQL 16/17 run 38183889617](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38183889617): 2/2 PASS, exact atomic payload `supabase/candidates/dynamic-taxonomy-20261011/dev-dark-launch-locked.sql`. Live postflight: no dispatch, no user data write, 7 existing needs, 0 opportunity deliveries, installed matcher unchanged. AI preview of `Dresiranje pasa`: `PROPOSE_AUTO_PROVISIONAL` with explicit review and notification authority NONE. Existing Gemini fact adapter: `NOVEL_SERVICE_REVIEW`, no authority.

## 2 — Legacy family IDs: DEPLOYED

Migration **`20261011232838_uskoci_taxonomy_legacy_family_anchors_20261012`** installed 11 durable `SYSTEM` / `ESTABLISHED` family IDs, with `private.work_taxonomy_legacy_kind_map`, 11 rows, all `authority='NONE'`, `family_only=true`, private SELECT-only. Auto registration remains OFF, 0 worker capability confirmations, 0 task revision snapshots. Existing matcher hash remains `1e698d3d22c887f639e4837a4e588d01`, old needs 7 and opportunity_deliveries 0. **Total registered migrations: 241**.

CI [PostgreSQL 16/17 run 38184291162](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38184291162): 2/2 PASS. Exact SQL: `supabase/candidates/dynamic-taxonomy-20261011/dev-seed-legacy-families.sql`.

Important: These are broad *family* identities, NOT permission to assign a worker to an entire family and notify them about every specialist child service.

## 3 — 20k worker + 10k task capability proof: PASS only in isolated PG

[GitHub Actions run 38184175824](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38184175824) executed **60** distinct synthetic services, **20,000** worker capability rows, **10,000** task revision classification rows, **600 EXACT positive / 600 NO_SAFE_MATCH negative** checks and one deliberately unreviewed task revision denial. Runtime ~52.6ms for these **1,200 sequential capability checks** in that isolated runner, NOT an HTTP throughput measure. No Auth/RLS client requests, no real 30k simultaneous workers, no push transport or Dogovor. Data were **not inserted into canonical DEV**.

Code `disposable-30k-capabilities.sql` and `.github/workflows/taxonomy-30k-capability-disposable.yml`.

## 4 — Critical legacy backfill finding (read-only DEV)

Read-only preview `legacy-backfill-preflight-readonly.sql` compared old tasks and worker skills with new family identity:
- Existing needs: **4/7 exact family-name strings**, **3/7 aliased or compound requiring requester review** (`Pomoć u kući i selidbe`, `Prevoz putnika`, `transport`).
- Active worker skill mentions: **3 exact family-name strings**, **3 requiring worker reconfirmation** (including `Nošenje kesa i stvari`, `popravke`, `stolarija`).
- **No row was automatically rewritten.** Even exact family-label correspondence is not proof of actual specialist eligibility.

## 5 — Still blocked, in sequence

1. Trusted actor-bound requester review and worker-confirmed capability authoring; do not trust client `reviewed=true`, AI-invented category UUID, or user-mutable metadata.
2. Strong semantic identity deduplication, review of risky/regulated services and provenance-rich automatic admission that works for arbitrary legitimate service labels, without unbounded spam. Current risk triage is conservative lexical-only.
3. Canonical matcher/dispatch integration preserving all location, time, exclusions, block, capacity, revisions and consent gates. No automatic notification entitlement merely because a family overlaps.
4. Controlled DB/Auth/RLS E2E, zero-match diagnostic, queue/inbox and FCM push proof with enrolled HONOR device.
5. 30k concurrent HTTP benchmark on an *isolated* full stack, complete application lifecycle (publish, apply, accept/reject, agreement, message, cancel, edit, remove).
6. EAS preview APK and real phone install/OTA proof. Do not point production profile at DEV or merge PR #6 unreviewed.

## 6 — Supabase advisors observed

Security advisor showed existing WARNs including public extension, `SECURITY DEFINER` function grants and leaked-password protection; performance advisor noted unindexed foreign keys / RLS initplan / multiple permissive policies. These are not automatically fixed by taxonomy migrations. See:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

**Explicit nonclaims:** The new catalog is installed but **not yet connected to the live publication/worker AI, matching or dispatch paths**. Auto registration is OFF. The currently installed old matcher still performs actual dispatch. Do not claim full dynamic-category product feature is released.
