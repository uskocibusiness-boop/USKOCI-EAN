# R06/R07 — resume the current owned Need edit

APPLIED_DEV, migration `20261102182959` on `leqcwgzvjsxugfgzdmth`.
Source `4b9755364a7f87dc93d456ff4d7fb56ee67092a5`; Full CI41498974039 SUCCESS.
The generated manifest remains the immutable preparation artifact; actual
execution is recorded in [the ledger receipt](../ledger/20261102_need_edit_resume.receipt.json).

The original RPC created a new conversation on every open. A live SQL-role
reproduction opened two distinct IDs inside a rolled-back transaction. The
candidate reuses an OPEN NEED_FACT_V2 edit for the same owner/task/current base.
Completed, abandoned or consumed-review edits remain excluded. Real message
activity outranks empty legacy copies. Existing content is not deleted.
Owner, closure, status, stale base and first-Agreement boundaries remain.

The task row lock serializes openers. Conversation NOWAIT avoids inverse lock
waiting with a turn/review. Only the existing function body changes: no table,
index, signature, permission, provider call or readiness certificate changes.
The unchanged five-field receipt supports existing clients.

## Source and package verification

- Read-only definition/dependency capture: ../../../proofs/ai/r06_need_edit_resume_preimage.json.
- Candidate and test: ../../../proofs/ai/r06_need_edit_resume_candidate.sql and r06_need_edit_resume.test.mjs.
- Four recovery assertions fail against the original function; all14 focused
  tests pass after correction, including catalog postimage, rollback/reapply,
  closed/wrong account, stale base, completion/abandonment, consumed command,
  cancelled task, Agreement and legacy duplicate selection.
- Related mobile checks:3 suites/209 PASS; TypeScript PASS.
- Full41498974039:626 suites/14585 mobile PASS, AI1611 PASS/0FAIL/1 existing TODO;
  SQL/PostGIS/Deno/migration integrity PASS. R0141498973974 remains8/49/3 FAIL.

After R07 migration20261102175412 the guard was rebased to the actual new
schema/source hashes; candidate body and five dependencies were unchanged.
The first apply after Full41495944402 rolled back at the exact postimage guard:
the generator hashed two final newlines while pg_get_functiondef returns one.
Original definition and absence of a new migration were verified afterwards.
A real PostgreSQL catalog regression reproduced the generator error. The
corrected postimage `34c30e54765bccbfe7b3e58a949001d2` preserves strict comparison.
Fresh preflight and corrected apply/postflight all passed. Existing certificate,
source_ready=false and NULL bindings remain unchanged.

## DEV and Android acceptance

Internal APK from4b975536 was signature/source/bundle checked and installed
with `adb install -r` on the already authenticated API36 emulator. Ordinary
owned-task edit/back/reopen and force-stop/cold-start/reopen retain the same
single conversation and all20 facts; their digest is unchanged. The published
task remains revision1. Native edit has zero messages, so populated-history
preservation is an isolated-test result, not a native claim. No paid calls.

Two real overlapping database/native probes were performed: an SQL-role opener
holds the task lock while the actual Auth/native opener waits and then resumes
the same edit; a conversation row lock causes safe refusal/no duplicate and
refresh/reopen recovery. The holder transactions roll back. The latter exposes
generic UNKNOWN copy, which remains a UI follow-up. This is not a concurrent
paid AI-turn proof. An earlier MCP-only attempt did not establish overlap and
is explicitly INCONCLUSIVE. Private screenshots stay in local artifacts.

## Reproducibility and remaining boundary

    node --test supabase/proofs/ai/r06_need_edit_resume.test.mjs
    node supabase/operations/dev-alpha/r06-need-edit-resume-20261102/build.mjs --check

The package pins context, exact function attributes/definition, five dependencies
and closure state. The inverse restores the original body without deleting
conversations. Future changes must account for this applied opener, including
the pending full hourly package. No public registration, production/store
release, R01/R10 waiver, durable first-plan or full R06 completion is implied.
