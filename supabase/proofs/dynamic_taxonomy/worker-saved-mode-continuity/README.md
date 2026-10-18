# Worker saved-mode review continuity — isolated proof

## Scope

The reproduced regression was a new untouched worker conversation losing an already saved, exact REMOTE service mode when the owner opened the review without an AI turn. The previous review builder only read same-session Gemini hints. This package changes one function, `public.rpc_prepare_worker_ai_review_taxonomy(uuid,integer,boolean)`.

The fallback only applies to revision 0, with no turns or hints and the complete candidate equal to the current profile. The existing locked profile/base hash guard still applies. It requires the latest successful ACTIVE Save, valid signed review, exact admission/binding/request provenance, current explicit choice timestamps, active per-service mode and non-excluded confirmed capability. The current exact category/alias resolver must still return the very same category. Both explicitly saved modes are retained together. A partial or ambiguous set fails closed.

Historical review expiration does not expire already saved consent; the original Save must have occurred inside its review window. Fresh revision-0 reviews are revalidated on every request so an earlier READY review cannot mask a withdrawal. No migration writes profile, capability, mode, category, conversation, notification or certificate records.

## Files and execution order

1. `fixture.sql` creates disposable synthetic tables, helper stubs and sample saved records; it includes `exact-dependencies.sql` via psql `\\ir`.
2. `before.sql` restores the exact read-only DEV predecessor and its ACL.
3. `assert-before.sql` **passes when the original regression is reproduced**. It also checks the exact predecessor MD5.
4. Apply `supabase/migrations/20261018124717_worker_saved_mode_review_continuity.sql` with `psql -X --single-transaction -v ON_ERROR_STOP=1 -f ...`.
5. `assert.sql` checks continuity, signatures, ACL and rejection cases, then calls the actual Save and actual binder and reopens another fresh review.
6. Restore `before.sql`, repeat `assert-before.sql`, reapply the migration and repeat `assert.sql`.

Run only on a new disposable PostgreSQL database. Fixture files deliberately create roles/schemas and truncate synthetic tables. Never run these fixture/assertion files against DEV or production.

## What is real and what is isolated

Captured exact live definitions are used for the predecessor review RPC, current profile initial/source/hash, taxonomy normalization/fingerprint/exact projection, Save RPC and worker binder. Their source is retained without private user records.

The fixture supplies minimal table shapes and stubs for closure checks, location and availability infrastructure. The initial historical Save and admission result are synthetic records. The final round trip executes the actual Save and actual binder; taxonomy admission is seeded from the newly signed plans. This proves the review/Save/binder/reopen boundary, not provider behavior, RLS of every table, independent admission logic, push delivery or device acceptance.

Negative cases cover changed service/profile/revision, a turn with unchanged candidate, stale hints, stale profile base, a later identical profile write, revoked mode, excluded/legacy capability, review/request/timestamp/binding/digest mismatch, altered signed content, changed or legacy global choice, newer unbound Save, retired category/mode, moved/ambiguous alias, incomplete two-mode consent and another owner. The existing current-hint path is retained.

## Exact predecessor and live read-only preflight

- Predecessor `pg_get_functiondef` MD5: `f0b4b83e5aba8b0a6e834f35f97a72c9`.
- Migration refuses a different predecessor. It uses CREATE OR REPLACE, preserving existing owner and ACL; it does not grant new access.
- A read-only DEV predicate probe returned all 18 continuity guards true and one exact retained service-mode item for the reproduced fresh session. Only booleans/counts were recorded; no raw conversation text is committed.
- Before application, root must run the isolated PostgreSQL proof, then read back the changed function, ACL/config and closure digests after applying.

## Closure impact

Read-only inspection found this review RPC absent from both closure function lists and with zero trigger references. No table, table ACL, trigger or covered function is changed. Therefore this single-function package is expected to preserve:
- source digest `88cab17911f89a7d8d800ae229db568dd2aaed106395ad8acc3207917acd72ec`;
- erasure program digest `90d60aa9529996103b91ca54fb4be94770d6862453fbe521f878c603d6ab3f1e`.

The pre-existing certified digest mismatch/retention blocker remains. This package does not rebind or claim to repair that certificate.
