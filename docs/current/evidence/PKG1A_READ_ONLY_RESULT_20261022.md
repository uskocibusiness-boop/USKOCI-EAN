# USKOČI — Paket 1A: provenance evidence and boundary

**Source:** `uskocibusiness-boop/USKOCI-EAN` at `ababbdbcc70ee08df4408cfb318a5d028188d168` on `feature/unified-qa-master-20261017`.
**DEV:** `leqcwgzvjsxugfgzdmth`. **Observation:** `2026-10-22T03:55:07.706685Z`.

This change is **documentation and offline checks only**, not a schema migration, deployment, AI fix or account-closure release.

- DEV migration catalog contained **307 versions**, of which **217 have no recorded name or SQL text**. Do not mistake absent recorded text for missing functionality.
- Archived exact SQL for migration `20261021104742` (a rollback test, **NOT to execute**): `supabase/operations/dev-alpha/ledger/20261021104742_closure_executor_rollback_probe.sql.txt`, 8,583 bytes, SHA-256 `160b0bb8101530664ab0422c513fe90429ae078da606aeaea10c8861e1209507`.
- Candidate version mappings `20261019071732 → 20261019074443` and `20261019085714 → 20261019092405` remain **UNPROVEN**. Never reapply either version on the basis of this note.
- Account closure was **not ready** in the inspection: the live digest differed from stored policy hashes and binding checks failed. **Do not perform an account-erasure run or interpret this historical observation as a dynamic feature gate.**
- Prior registry `live_history_snapshot.migration_count=87` represents an **older historical baseline**, NOT a live count. The new observation is append-only and leaves that baseline intact.
- See `supabase/operations/dev-alpha/ledger/20261022_pkg1a_readonly_receipt.json` and `docs/control/PKG1A_PUBLIC_TABLE_GRANTS.md`.

Verification from repository root:

```bash
node scripts/pkg1a_audit.mjs
node --test scripts/__tests__/pkg1a_audit.test.mjs
```

**Not done:** full provenance reconciliation of rows lacking statement bytes; migrations, RLS changes, RPC behavior repair, AI prompt tuning, full CI, 2-user Android E2E. All need separate work and evidence.
