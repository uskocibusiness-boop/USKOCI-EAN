# Worker service-mode context — candidate, 2026-10-18

## Reproduced failure and bounded correction

A fresh worker conversation correctly reopened the saved REMOTE profile, but a later request to change only the bio produced a new review with both REMOTE and ON_SITE. That review was not saved. The provider context contained candidate skills/location but no owner-confirmed per-service mode baseline. The category catalog supporting two modes is not the owner's consent.

This candidate changes only the service-role context reader and adds one private read helper. It does not change review, Save, admission, binding, matching, dispatch or notification functions and creates no new consent, categories, sessions or data columns. The companion Edge preservation guard is required: this SQL alone supplies facts, not a provider-enforcement guarantee.

## Additive return contract

`context.serviceModeContext`:

```json
{
  "schemaVersion": "WORKER_SERVICE_MODE_CONTEXT_V1",
  "revision": 1,
  "savedServices": [
    {"service": "3D štampa", "mode": "REMOTE", "categoryId": "<existing category UUID>"}
  ],
  "draftServices": [],
  "unresolvedServices": []
}
```

- `savedServices`: exact surviving candidate skill + current saved profile + timely signed Save + committed batch + exact binding + active per-service confirmation + current non-excluded confirmed capability + explicit current global choice. The original review can now be expired if Save was timely. It never infers modes from a city, catalog availability or related work.
- `draftServices`: separate current-candidate/revision/base-bound, current-catalog, exact-category hints. These are proposals only, not an authority baseline. A bad existing draft offering both modes remains visibly separate from saved REMOTE.
- `unresolvedServices`: exact candidate skill strings with no verified saved or current-draft mode context. It does not assert that a mode has been approved. New unmapped skills do not erase the valid saved baseline of another surviving skill.
- Arrays are distinct and deterministically ordered. Entries are individual service/mode pairs.
- Changed/removed/duplicate-ambiguous skill strings, moved/ambiguous aliases, retired categories/modes, stale profiles and wrong owner/source/binding/digest never inherit authority.
- Revoking one confirmed mode omits that mode; an independently still-active signed mode can remain. Later changed global consent invalidates the prior full binding, conservatively.
- The helper is STABLE SECURITY INVOKER, with no PUBLIC/client/service-role execute grant. Only the existing service-role SECURITY DEFINER reader exposes this additive context. All reads share a statement snapshot. Existing later source/revision checks in commit/Save remain necessary.

## Source boundary and pins

Target predecessor:

- `public.rpc_read_worker_ai_context_service(uuid,uuid)`
- MD5 of exact `pg_get_functiondef`: `24b1dbfde5aa4dfa1277b5ac294effe0`
- Owner postgres; STABLE; SECURITY DEFINER; search_path pg_catalog.
- Existing ACL `{postgres=X/postgres,service_role=X/postgres}` is preserved by CREATE OR REPLACE.
- New helper must not already exist. Both checks are executable preconditions.

`before.sql` is the exact captured predecessor plus its restrictive ACL. `revert.sql` restores it and drops only this new helper. It is a psql script because it includes before.sql; for the management API send the actual before.sql contents followed by the DROP, not the psql meta-command.

The helper reuses the provenance predicates of applied migration `20261018124717_worker_saved_mode_review_continuity.sql`. It intentionally compares the prior signed profile with today's saved `worker_ai_initial`, rather than with an edited draft candidate. It does not require an untouched revision zero session. Exact service survival and current profile base still apply.

## Disposable proof

All identities/content in this proof are synthetic. No real user conversation is checked into the repository.

Reuse:
- existing worker-saved-mode continuity fixture, actual source/hash/initial/exact projection/Save/binder definitions;
- applied continuity migration;
- exact captured worker document and turn-document functions in `exact-context-dependencies.sql`.

Only unrelated closure, location and availability infrastructure retains the existing fixture's documented isolation stubs. The current reader/auth/source/cancelled-message behavior and actual Save/binder execute as captured functions. Admission material for the second Save is explicit fixture data, not a claim of a live admission transaction.

Run in a fresh disposable PostgreSQL database with psql ON_ERROR_STOP=1:

1. `fixture.sql`
2. `assert-before.sql` — PASS reproduces the actual missing-baseline seam.
3. `candidate.sql`
4. `assert.sql`
5. `revert.sql`
6. `assert-before.sql` — exact predecessor MD5 and observed failure restored.
7. `candidate.sql`
8. `assert.sql`

The assertions exercise:
- expired original review after timely Save;
- actual bio-only draft with two-mode hints while saved baseline stays REMOTE;
- unmapped skill addition, removal/replacement, alias ambiguity;
- explicit both-mode saved baseline and single-mode revocation;
- excluded/legacy capabilities, wrong review/request/timestamp/binding/digest;
- global withdrawal and legacy consent; newer unbound Save;
- retired categories/modes and moved aliases;
- stale/other-owner/old-catalog/wrong-category draft hints;
- service-role guard, ownership, closed/review-blocked/stale sessions;
- exact cancelled USER-message exclusion, other owned history preserved;
- ACL and stable invoker helper;
- actual second Save + actual binder + new session with a further bio edit;
- context reads causing no new consent/Save/binding rows.

At preparation time no PostgreSQL proof has run locally (no local PostgreSQL). CI execution is required before application. This is not a real-device or new paid-provider result.

## Closure digest impact and application evidence

Read-only inspection covered the actual current closure source function's 108-function list, program function roster plus redaction-trigger functions, schema digest table/constraint/trigger scope, agreement-invalidation four-function surface and agreement-voice storage surface. The context reader is outside those rosters and is not a trigger. The new helper is not listed or attached as a trigger. This function-only candidate changes no covered table, ACL, trigger or publication metadata.

Expected direct impact: unchanged closure source/program digests. Measure before and after; do not infer a renewed certificate. The already reported certificate mismatch / retention=false remains separate and is not repaired or rebound by this candidate.

Root is the sole DEV writer. Before application capture predecessor MD5/ACL and closure digests; after application capture both new function definitions/MD5/ACL and digest comparison. SQL application and companion Edge deployment must precede a bounded actual bio-only conversation regression check. The old pending bad review must remain unsaved or be replaced by a new valid review.

