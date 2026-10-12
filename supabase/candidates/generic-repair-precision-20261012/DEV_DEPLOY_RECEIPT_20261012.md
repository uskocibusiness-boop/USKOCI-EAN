# USKOČI — owner-approved DEV specialist repair matcher deployment

**Recorded migration:** `20261011230505_uskoci_specialist_repair_match_precision_20261012`
**Target:** canonical DEV `leqcwgzvjsxugfgzdmth` only; NOT production.

User explicitly approved applying changes to Supabase. The scope of this promotion was intentionally limited to the previously tested repair-match precision function, not the incomplete dynamic taxonomy or unverified Edge pushes.

## Preflight (read-only, passed)

- `private.worker_need_fit_v1(uuid,uuid,boolean)` source MD5: `d511b48f7f3b38f52aaffee420108f8a`.
- `private.work_kinds_v5(text[])` source MD5: `78fca96231ddc713cf18990f5a2a34ef`.
- `private.closure_source_digest_v5()`: `c9ae36c11e535e0e78e047cf99e3a14c860344e1ff98f3317be9e106361a21df`.
- Function owner `postgres`, ACL `{postgres=X/postgres}`, `SECURITY DEFINER=true`, volatility STABLE, parallel UNSAFE, search_path `pg_catalog`.
- 0 currently `PUBLISHED` needs, 0 bound active push devices on DEV. The existing `ALL` dispatch mode was left unchanged.

## Executed and verified

The Supabase migration API returned **success:true** for the SQL in `dev-forward-guarded.sql`. The migration now appears in `supabase_migrations.schema_migrations`.

Postflight read-only checks:
- Matcher MD5: **`1e698d3d22c887f639e4837a4e588d01`**, exactly matching the inspected candidate, vs previous `d511b48f7f3b38f52aaffee420108f8a`.
- ACL, owner, security-definer and search_path unchanged; closure digest unchanged.
- Total needs: **7**; opportunity deliveries: **0**; dynamic taxonomy tables: **0**.
- Migration count now **239** (previously 238); migration name exists once.

## Proof and rollback

- [Disposable match+dispatch+rollback CI run 38182500569](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38182500569) = PASS; real canonical SQL matcher and wave on synthetic data with fake local event sink; no live provider push.
- `source-only-function.sql`: original source-only candidate.
- `dev-forward-guarded.sql`: actual guarded migration payload.
- `dev-rollback-guarded.sql`: exact guarded rollback **available, not executed**, restoring predecessor source only if current hash and ACL/closure match.
- `supabase/proofs/deploy_inventory/dev-actual-vs-repo-readonly.sql` updated to expect new hash.
- This is a single function fix. It is NOT a deployment of new work categories, worker-confirmed category UUIDs, new Edge code, phone push, OTA APK or production setup.

## Remaining release gates

1. Formal taxonomy identity/worker confirmation/AI publication/dispatch integration (current DEV still has 11 closed groups).
2. Worker AI interview Edge source drift and targeted push Edge drift.
3. Real user/phone E2E, controlled opportunity delivery, concurrent Auth/RLS+HTTP load proof.
4. Previous SQL edits lacking migration receipts must be reconciled without inventing historical migrations. 
