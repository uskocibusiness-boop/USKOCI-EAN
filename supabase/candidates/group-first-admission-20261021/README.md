# GRP01 — first-admission group history

DEV applied 2026-10-21 by the parent integrator with the embedded rollback proof passing. Live sync definition read back as MD5 `7baf710f06301f8808006bea46f98e6e`. Main integration ledger owns migration registration. Candidate prepared 2026-10-21. Owner direction: a newly selected person reads prior group history; a departed person receives no future messages.

## Scope

- Replaces only `private.group_sync_agreement_v5(public.agreements)`; keeps its existing permissions and trigger wiring.
- First-ever account admission into an existing group creates eligible per-message read grants for history through the locked group sequence.
- No global backfill for existing members, repeat sync, unblock or rejoin. Joined sequence remains the forward-message boundary.
- Restriction on the new member or group owner, an owner/member safety block, restricted historical sender, or sender/member safety block prevents the corresponding historical grant.
- Shared closure/safety locks precede eligibility checks. Same locked group row serializes this with group sends. Exclusive safety/closure barriers do not lock group/domain rows (existing send contract).
- Existing cancelled-member readonly and forward delivery behavior remains. History grants never emit push or duplicate group messages.
- Group UI empty copy no longer claims all readers only see messages since joining.

## Apply and verify

The parent integrator must pass `candidate.sql` followed by `proof.rollback.sql` in ONE migration call. The proof failure must roll back the function replacement too. Candidate has exact preimage checks for sync, group read/send/access and closure/safety key/check functions plus private execution rights. Refresh live definitions and review any mismatch; do not remove the gates to bypass a mismatch.

The parent must then save exact ledger bytes/hash and final definition, run the proof again, and update closure source-digest admission after this function change. No deployment was done by this subagent.

## Existing-server preflight evidence

- Proposed new-history assertion correctly failed against the old server with `GRP01_FIRST_ADMISSION_HISTORY`; the transaction rolled back.
- `baseline-preflight.rollback.sql` asserts OLD behavior (zero old messages for a new member), and passes the whole fixture setup: authenticated SQL role selection, send, read, cancellation and reselection; zero fixture accounts remaining. Result is `baseline-preflight.result.json`.
- `proof.rollback.sql` instead requires all three old messages on unrestricted first admission and only the owner's old message with one closure-restricted and one blocked sender. It checks repeat/unblock, restricted recipient/requester block, cancellation, absence gap and rejoin, and runs deferred constraints before deliberate rollback.
- The fixture uses synthetic auth/profile/task/response seed rows. Actual public selection, group send/read/context/cancel operations run as authenticated SQL role. Restricted-admission defense additionally resets ONLY synthetic memberships/grants in nested rollback scopes. This is not signed HTTP, cross-session concurrency, provider, push delivery or device proof.
- Group UI suite: `src/data/__tests__/v5-group-conversation-screen.test.tsx`, 47 tests passed after empty-copy change.

## Rollback

`rollback.preimage.sql` restores the preceding function and comment for FUTURE admissions. It cannot undo already read history. Do not delete grants after rollout under the guise of rollback. Final runtime verification belongs to the parent integration report.
