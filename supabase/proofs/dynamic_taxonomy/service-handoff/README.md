# Service handoff: disposable PostgreSQL proof

This suite applies the real parent-mode and service-handoff migrations to a synthetic database on PostgreSQL 16 and 17. It never connects to Supabase, invokes AI, publishes a task, dispatches, or sends notifications. Workflow permissions are `contents: read`; it uses no repository or backend secrets.

## Execute in order

1. `psql -X -v ON_ERROR_STOP=1 -f supabase/proofs/dynamic_taxonomy/service-handoff/fixture.sql`
2. `psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261019104047_taxonomy_parent_navigation_and_mode_admission.sql`
3. `psql -X -v ON_ERROR_STOP=1 -f supabase/proofs/dynamic_taxonomy/service-handoff/assert-before.sql`
4. `psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261019104604_service_handoff_signed_matching.sql`
5. `psql -X -v ON_ERROR_STOP=1 -f supabase/proofs/dynamic_taxonomy/service-handoff/assert.sql`

`fixture.sql` extends the existing parent-mode fixture. `before.sql` contains twelve captured DEV predecessor definitions; `predecessors.json` records source-file SHA-256 and function-body MD5. The two binder captures must load **before** the parent-mode migration. The handoff migration's own twelve exact predecessor-body checks remain enabled.

## Actual behavior exercised

- Typed handoff validator and table constraints; malformed shapes, duplicate/lowercase country codes and private-address fields are rejected.
- Serbian display text, country order and the distinction between unknown and explicit `required:false`.
- Shipping-country overlap, same-city pickup, differing cities/countries, alternative shipping-or-pickup, absent legacy data and missing worker consent.
- Real reviewed worker batch admission and binder: no capability before synthetic Save boundary, exact handoff persistence and idempotent replay.
- Real durable saved-mode context and handoff preservation: bio-only edit keeps prior handoff, explicit replacement wins, revoked or draft-only data is not a saved baseline.
- Real handoff matching subgate: current exact worker/category/REMOTE mode plus corresponding Save receipt is required for a physical handoff. This is **not** a proof of the complete service/time/area matcher.
- Real need batch and binder: signed/saved handoff parity, mismatch rollback, legacy missing REMOTE handoff rejection, DRAFT retained, no notification authority.
- The real predecessor prepares a cached READY task review without handoff. The new preparer must bypass it, return a fresh non-acceptable PENDING classification with `need.handoff` missing and null READY metadata, then accept explicit digital handoff.
- Both real task writer entrypoints reject missing REMOTE handoff before any canonical write. No successful task Save/edit is claimed by this check.
- Actual publication fingerprint: legacy null is byte-equivalent, handoff alone and pickup-city changes are material, private address remains outside the returned receipt.

## Boundaries and limits

`boundaries.sql` explicitly supplies synthetic identity/source hash, existing profile, closure status, location normalization, country, policy and fact-read inputs. Unrelated fact validation is a narrow fixture boundary; the new handoff validator itself is real. Existing Save receipts and owner-accepted need commands are synthetic: this proves post-Save binding and replay contracts, **not** a full signed Save RPC, Auth/RLS, outbox worker, mobile journey or publication.

The captured `worker_need_fit_v1`, worker review preparers and edit-conversation opener are loaded and replaced by the actual migration, but their full bodies are not exercised. Preservation is exercised through the real saved-context and preservation helper. The reduced relation shapes exist only to compile those captures; production schema equality is not claimed. The account/source helper is deliberately fixed in this fixture, so account changes and source-hash invalidation require their existing separate proofs.

All after-migration assertion data is inside `BEGIN` / `ROLLBACK`; the workflow database is disposable. Do not run this fixture against DEV or production. Local verification on the Windows authoring host is syntax/hash/include verification only because PostgreSQL/psql is not installed. Green PostgreSQL evidence must come from the workflow run.
