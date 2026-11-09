# Saved DRAFT → activation: bounded SOURCE repair (2026-11-09)

Base: `8c9dd14de620c1fa00f4cd7d2fb4d484c91519ce`. Status: **SOURCE + isolated SQL PASS; controlled package PREPARED, not applied by this work**.

The live DEV read-only inspection found two linked failures: reopening an unchanged saved DRAFT preserved profile facts but lost its signed service/mode proposals; activation also required the obsolete city field even when the signed profile already contained valid work areas. The saved phone profile had seven services, a valid Novi Sad CITY area, an empty legacy city, a valid latest DRAFT Save, and no active capabilities. The saved review/profile/source hash/catalogue witnesses matched current state. This diagnosis does not claim successful native activation.

## Changed owners

- `private.worker_ai_service_mode_context_v1`: a fresh revision-0 session with no turns/hints may recover only the newest owned, unchanged signed DRAFT Save. It verifies completed prior conversation, exact current candidate and prior session source hash, receipt/review IDs and ownership, digest, Save within original review validity, current catalogue, every original service, existing leaf ID, mode, risk and handoff. Exact/registered-alias plans use the existing exact projector; semantic plans retain their signed label/parent identity. Recovered items remain **draftServices**, never active capability or notification authority.
- `public.rpc_prepare_worker_ai_review_taxonomy`: consumes that verified untouched DRAFT context through the existing per-service projector. It retains original labels, category IDs, modes and handoff and permits validated workAreas to satisfy the location requirement.
- `private.complete_worker_profile_v1`: accepts valid workAreas only inside the existing fresh signed activation-review checks, including owner/revision/candidate/digest/expiry and current catalogue. The direct legacy no-city activation guard remains.

No new table, flag, classification model, matching shortcut, or certificate update. The five-key context response is unchanged. Non-REUSE saved plans do not enter this new fallback. A changed profile/catalogue or edited conversation requires the existing fresh review path.

## Focused evidence

`node --test scripts/worker-draft-activation.test.cjs`: **10/10 PASS**, zero skipped, 20.8 seconds.

The fixture executes captured real open, resolver, prepare, Save and source-continuity owners:

1. Open → source-bound synthetic proposals → prepare(false) → Save DRAFT → reopen reproduces the old empty context / REVIEW_REQUIRED failure.
2. The candidate recovers all **seven literal services**, including two labels with the same category ID; prepare(true) becomes READY with the original IDs, area and remote handoff.
3. Real SaveActivate returns ACTIVE. Before binder, active capability/mode counts remain zero.
4. The actual signed batch and unchanged binder then retain seven service labels and create six unique active capabilities/modes.
5. REMOTE-only without city/area, BOTH modes, CITY/RADIUS/COUNTRY areas, Save retry and function rollback/reapply pass.
6. Edited revision, removed service, new mode hint, changed profile, wrong owner/digest, invalid-at-Save expiry, catalogue/ID change, malformed signed area and unsigned legacy activation fail closed.
7. A review expired now can be recovered only if its original Save was valid at the time; the new activation review receives its own current expiry.
8. Generated promotion guards reject changed identity and a forced wrong postdigest atomically; generated rollback/reapply preserves function identities and attributes.

This is **synthetic isolated SQL**, with local JWT/geography adapters. Hosted Auth, complete production trigger/RLS behavior, asynchronous queue processing, real push and native acceptance are not proven by it. The real source-continuity trigger runs; queue/push triggers do not. No paid provider calls were made.

## Controlled package

`scripts/sql/worker_draft_activation_20261109.*` follows the existing operation style. Preflight and postflight pin **33 function OIDs, bodies and full attributes**, plus **14 relation owner/ACL/RLS/constraint/policy sets**. Only three function bodies change. Atomic promotion and exact rollback preserve signatures, privileges, stored certificates and user data.

Read-only DEV preflight returned **WORKER_DRAFT_ACTIVATION_PREIMAGE_MATCH** on 2026-11-09. A fresh preflight remains mandatory immediately before a qualified deployment.

Exact read-only substitution of the three new body hashes into the existing closure digest expressions predicts **unchanged** hashes; these owners are outside the registered aggregate inputs:

- source: `acf469c343e33c4126ca96853b4461c8dcdf7271cc22fb36464cc506006dd6ab`
- erasure: `24613a2985b790b6fa4445b021861a2bf25e7bb44d907da148900870bdccb11c`
- schema: `7923a76b5add2e56f2ded9a173dd1638baa346a8742877cecb23aaf634229d50`

Stored certificates remain unchanged and **sourceReady remains false**. This is not R10 recertification.

Frozen artifacts:

- Candidate SHA256: `bd2c695fce5c85d0420a66bf204d6b0014af46e714aa677e7b3a278735b2fb15`
- Promotion SHA256: `4e197b041b89b6109bbcc7f943b9a9e7f92df229497438a89f9cd94b983e7be2` (94,893 bytes)
- Manifest SHA256: `30f4a032eca11b43c5f55e2f5fb57bf83d1b1013f2b3b3d27378891ac60558ff`
- Focused test SHA256: `a40f32d7d2d7376189fe0fae90da87dcd86672718853535b9cb90dc334367af5`

Both deterministic builders pass `--check`. The focused suite is included in the existing `npm test` command. Full CI on the committed candidate, independent operation review, controlled DEV promotion, actual Auth SaveActivate/binder readback and native confirmation remain required. No migration ledger version is invented.
