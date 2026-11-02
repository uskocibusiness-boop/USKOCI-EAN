# R06/R07 — resume the current owned Need edit

PREPARED_NOT_APPLIED. Existing RPC and unchanged five-field mobile receipt.
02 November continuation: the same candidate/function body (postimage
f7b516da8af8c7797ef2f58438319df7) is rebased ONLY to the observed closure
schema/source after R07 migration20261102175412. No certificate/readiness or
function dependency was changed. Fresh live SQL-role reproduction inside a
rolled-back transaction opens two different conversations for the same task;
neither trial conversation is persisted. All13 focused isolated checks pass.
The re-derived promotion still requires fresh preflight and relevant full CI.
The 02 November native probe lost the ordinary route to a saved edit because
every call to rpc_ai_open_need_edit_conversation_v2 inserted a new conversation.
The original messages/facts remained on the server.

The candidate reuses an OPEN NEED_FACT_V2 edit for the same owner/task and
current non-null base marker. A conversation with a consumed review command,
completion or abandonment is excluded. Real message activity takes precedence
over newer empty legacy duplicates. No old conversation or user content is
deleted. Changed task state, owner, closure and first-Agreement locks remain.
Stale edits remain available in history; a fresh edit uses the current base.

The existing task row lock serializes openers. Conversation locking uses
NOWAIT so a simultaneous turn/review cannot cause an inverse lock wait or a
silent new copy. A busy conversation must be retried after that operation.
Multi-session contention still requires PostgreSQL/DEV acceptance; PGlite
sequential tests do not prove concurrent transactions.

Only the existing function body changes. No table, index, signature, privilege,
model call, UI flow, applied migration or certificate is replaced. The caller
needs no new mobile build. Reusing an existing row explicitly checks account
closure because the insertion trigger would otherwise not run.

## Proof and promotion

- Captured read-only DEV definition, attributes and dependencies:
  ../../../proofs/ai/r06_need_edit_resume_preimage.json
- Four recovery assertions fail against the original definition.
- 12 isolated PostgreSQL tests plus the raw-candidate refusal test pass after the fix, including rollback/reapply,
  closed/wrong account, stale base, completed/abandoned, consumed command,
  cancelled task, Agreement and legacy duplicate selection.
- Existing actual mobile opener/owner screen contracts: 2 suites / 30 PASS.
- Full CI41483609100 SUCCESS on 5d98952d: 626 mobile suites / 14584 tests; AI1599 PASS / 0FAIL / 1 existing TODO; TypeScript/Deno/SQL/PostGIS/integrity PASS.
- Fresh read-only DEV preflight: R06_EDIT_RESUME_PREIMAGE_MATCH.
- R0141483609292 FAILURE remains 8 strict / 49 effective / 3 managed-net.
- DEV/native/concurrent-transaction acceptance remains separate and OPEN.

Run:

    node --test supabase/proofs/ai/r06_need_edit_resume.test.mjs
    node build.mjs --check

The guarded package pins DEV context, exact function attributes and definition,
five dependency definitions and the existing closure state. It allows only one
function body delta. It deliberately requires source_ready=false and NULL
bindings to remain unchanged, not to become ready. The inverse restores the
original definition without deleting newly created conversations.

Before a controlled promotion: relevant full CI, fresh preflight, current-schema
lock/compatibility review and authorization for this exact DEV operation.
Then promotion.sql, postflight.sql, ordinary Android open/back/restart/reopen
with the same conversation/facts and no provider call; include a concurrent
turn and competing opener before calling the recovery DONE.
No public registration, production or store release is authorized by this package.

