# R07 application attention after a completed Agreement

Status: **PREPARED_NOT_APPLIED**. This package has performed no hosted writes.
The [preparation receipt](preparation-receipt.json) records the successful exact
read-only DEV preflight and local verification; it is not an application receipt.

The installed Android app showed a selected application under `Čeka te` even
though its exact Agreement was completed and its review was already stored.
Current Product master S06 requires a real pending action in `Čeka Vas` and keeps
terminal application history separate. The selection itself remains a truthful
historical fact: this correction preserves `SELECTED`, the Agreement ID, prices,
people, revisions and all existing command permissions.

## Cause and bounded correction

The 2026-11-01 17:37:56 UTC DEV capture proves that both readers emit attention
for every `SELECTED` application. `private.own_application_rows` also assigns
rank 0 to every such row, so page scopes and counts agree with the wrong signal.
The real current SQL plus `applicationClientService`, `ownApplicationsPage` and
`myApplicationsView` reproduced `attention=true`, attention count 1 and history
count 0 for a completed Agreement. A desired-history assertion failed before
the correction. No account/business rows were written on DEV for this test.

Only three existing function bodies change:

- `private.own_application_rows(uuid)` computes attention rank from the existing
  latest linked Agreement. `STALE_REVIEW_REQUIRED` keeps its existing attention.
  A selected row needs a nonterminal witness: Agreement status `CONFIRMED` or
  `SUPERSEDED` and effective execution state `CONFIRMED` or `AWAITING_REQUESTER`.
  As in the existing Agreement projection, missing execution falls back to the
  Agreement status. Physical `COMPLETED`/`CANCELLED` always suppress attention.
- `rpc_list_my_applications_page` emits attention from that same rank; scope,
  counts and cursor ordering therefore use one decision.
- `rpc_list_my_applications` applies the same decision to its whole-list flag
  and ordering, retaining the supported fallback reader.

The latest linked Agreement is authoritative, not parent Need completion or a
different worker's relationship. A missing Agreement does not invent a pending
action. Its stored selected application still has its existing truthful status.
No new read/acknowledgment marker or client-only hiding rule is introduced.
Completion/rating actions remain in their existing Agreement domain.

The earlier PKG042 proof already distinguishes completed Agreement history while
preserving the selected status/link. The later EX04B proof includes `sel_done`
but derives its expected attention set from the old whole-list reader. Those
historical candidates remain unchanged. Any future R07 hourly/EX04 promotion
must retain this corrected distinction and use a fresh reviewed preimage.

## Admission and recovery

`preimage.json` pins 12 function definitions and all `pg_proc` attributes. None
of the three changed readers is in the captured closure source/erasure function
rosters. Both directions require the entire schema/source/erasure digest,
certificate, readiness and binding object unchanged. R10 remains blocked with
`source_ready=false` and NULL export/erasure bindings. A hidden digest dependency
aborts the transaction; this package does not recertify or activate anything.

The operation creates no table, function, grant, RLS policy, business row or
provider/push call. Its temporary catalog snapshot allows only the three exact
body changes and rejects any other function metadata/addition/removal delta.
Original function signatures, OIDs, owners, ACLs and settings must remain exact.
The DEV connector must bind `leqcwgzvjsxugfgzdmth`; the GUC alone is not identity.

1. Run `node --test supabase/operations/dev-alpha/r07-application-attention-20261101/package.test.mjs`
   and `node supabase/operations/dev-alpha/r07-application-attention-20261101/build.mjs --check`.
2. Review the three exact body differences and `manifest.json`; run `preflight.sql`
   read-only against canonical DEV. Any new live drift requires a fresh review.
3. Root owns any controlled `apply_migration` of exact `promotion.sql`. The
   transaction checks preimages, applies all three bodies, tests Auth-required
   refusal and NULL-owner queries, then checks catalog/closure postconditions.
4. Run `postflight.sql`, then read the existing signed-in Android application:
   the completed selection is absent from attention, present in previous
   applications, opens the same completed Agreement and retains its saved
   review/read-only messages. Verify counts and refresh; separately verify a
   current selected Agreement and a stale application still demand attention.
5. If needed, apply exact reviewed `rollback.sql` through the same procedure.
   It restores the former three bodies and their known false-attention behavior;
   there is no data compensation. Never silently reapply a stale old candidate.

## Evidence limits

Seven isolated tests pass using exact captured SQL and the real current client.
They cover 19 lifecycle cases, including completed/cancelled/awaiting/missing
execution, parent-versus-bilateral state, stale revision, missing/latest
Agreement, all four scopes, first-page counts, limits 1/2/3/30, microsecond ties,
foreign/empty owner, no Auth/anonymous denial, invalid cursor/scope, exact inverse
rollback and rejection of an unrelated function delta.

Auth claims and calendar-conflict=false are explicit local fixture substitutes;
most production constraints/triggers and the PostgREST closure pre-request hook
are not exercised locally. Hosted acceptance reads no existing business rows:
only Auth-required refusal and NULL-owner query compatibility. Real two-account
Auth, installed Android behavior, old client fleet, full R01/R10 and public
release readiness require their separate evidence. No DEV application or native
success is claimed by preparation or a local PASS.
