# Controlled internal DEV delivery

Target: `leqcwgzvjsxugfgzdmth`. This is the existing R04/R06 package, not a new master.
Global R01/R10 remain open. The prior internal-DEV exception in the applied
`r04-semantic-admission-20261101/README.md` applies only to designated TEST use;
it does not permit a public rollout or manufactured lifecycle certification.

The package now independently projects the exact schema/source/erasure digests
from a fresh read-only catalog capture. The existing certificate, false readiness
and NULL export/erasure bindings remain unchanged. New JSONB storage and the three
changed lifecycle bodies are accounted for; these checks do not certify them.

Promotion is one transaction: exact preimage/ACL/relations, DDL, exact postimage,
then rollback-only synthetic acceptance against the actual DEV schema. Acceptance
uses a new synthetic Auth row without password/session/email, real SQL roles,
Worker completion/replay/readback, signed review, Save+Activate without city,
batch/binder, foreign-owner denial, actual inventory export and erasure planning.
All fixture rows are rolled back before commit. Any assertion aborts all DDL.
This is not a real login, Gemini call, full account erasure or Android proof.
Full lifecycle orchestration remains a release blocker; its guards stay closed.

Require full CI on the delivery source, then fresh preflight. Apply the guarded
transaction through the DEV migration tool and verify postflight plus absence of
fixture IDs. Record the returned migration version; never invent one. Before Edge
delivery, verify both current versions/files against the captured before bundles.
`edge-package.mjs` emits complete candidate/rollback payloads and validates import
closure and exact file hashes. Deploy only after SQL POSTIMAGE_MATCH; fetch and
compare each deployed bundle. Do not change JWT, provider, budget or rollout flags.

Before first resolution, restore both old handlers before using SQL rollback.
Once any real resolution exists, retain additive storage and use forward recovery.
Never delete user data to satisfy the inverse guard. The application-service and
deadline operations have separate unchanged-closure preimages; apply those first
or recapture their closure expectation after this package, never skip a guard.
