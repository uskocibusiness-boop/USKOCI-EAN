# USKOČI — Unified Gemini Classification Architecture (P0 checkpoint)
Date: 2026-10-14. Scope: DEV `leqcwgzvjsxugfgzdmth`, source branch `feature/unified-gemini-classification-p0-20261014`. Issue #25. **This is an implementation checkpoint, not authorization for rollout.**

## Verified, not inferred
- `work/ultra-master-integration-20261012` HEAD `094b437684c733565ad692f7a105cad94a451fdd`; default GitHub branch remains the older `work/uskoci-ui-unification-20260924`.
- DEV Edge `uskoci-ai-interview` v73 and `uskoci-worker-interview` v26 had **byte-identical primary index.ts** source to the above integration branch before this PR.
- Existing catalog: 141 categories, 17 roots, 120 ON_SITE associations, 21 REMOTE associations, 0 aliases, 0 need snapshots, 59 AI_REVIEWED/ESTABLISHED entries, 6 AI-evidence EQUIVALENT_VERIFIED relations and 54 AI-evidence standard-coverage rows. Catalog-control version 3 and auto-registration true.
- The three actual skating services were created as direct children of `Zanati i popravke`; source `AI_REVIEWED`, state `ESTABLISHED`.
- Legacy `rpc_taxonomy_ensure_path_service` has regex-driven parent selection and defaults unrecognized ON_SITE labels to `zanati i popravke`. Function body does not check `auto_registration_enabled`, lock an advisory key or bump the control version.
- Worker sync uses that ensure-path write on previously unseen skills; requester AI called it before owner review. AI-origin relations must never be proof of competency.
- PR #24 is open/unmerged; its authoritative-worker-sync migration `20261014073604` is already recorded on DEV. Never replay it.
- Catalog RPC paginates consistently: STATIONARY page 1=100, page 2=20; REMOTE page=21; catalogVersion=3 for all pages.
- Existing `worker_execution_mode_choices` records worker-level mode consent; it does not by itself establish a confirmed mode for each canonical service. `private.worker_need_fit_v1` does not read that table, so a per-service mode guard still needs implementation.
- Existing `private.requeue_open_needs_for_worker_v5` should be reused rather than creating a second dispatch implementation.

## Chosen identity model
ONE canonical service entity with stable category UUID + flexible parent_id + aliases (Serbian scripts and vetted synonyms) + independent supported execution modes. REMOTE and ON_SITE are **two UI projections**, not two duplicated trees. On a worker capability, mode must be recorded at service level as independently confirmed preference; on a need, mode is authoritative from the reviewed task. A category's allowed mode is not proof that any particular worker accepts that mode.

Service ≠ occupation ≠ task modifiers ≠ tools ≠ city ≠ duration. Distinct meanings (ice-skating instruction, skate rental, skate sharpening) must remain distinct IDs even though nouns overlap. Alias/equivalence is allowed only when the actual offered capability is the same. A parent category and an AI-neighbor relation confer NO competency.

## Ownership and admission
1. Both Gemini handlers read the same authoritative server catalog. Initially full, paginated and version-fenced (implemented read-only). At scale switch to root overview → candidate lookup → relevant branches; never force the full multi-year tree into a prompt.
2. Both call one structured semantic classifier, with `purpose`, `serviceMeaning`, `modifiers`, `mode`, `catalogVersion`, candidate IDs, `action`, rationale, alternatives and uncertainty. No invented ID accepted. Gemini cannot directly execute SQL.
3. Server independently checks ID, mode, owner-bound session, stale version, duplicates, category aliases, safety, parent/cycle, conflict/risk level. Inability to validate must yield CLARIFY/REVIEW_PENDING. The model can replan using errors. All plan proposals are **non-authoritative**.
4. **Only after the user's final review**, invoke an owner/session-revision-bound service role admission RPC; lock catalog/admission key, check idempotency, dedupe under concurrent requests, perform the accepted INSERT/alias/mode/audit/version bump/worker-or-need binding in one transaction. Candidate NEW_BRANCH and restructure require higher review than CREATE_CHILD. Reparent existing IDs only in separately approved reversible migration. No AI-only VERIFIED coverage or equivalent relation.
5. Worker saved and reviewed list exclusively owns active capability rows; revoked skills become excluded and withdraw related opt-ins (preserve PR #24). No implicit parent competence. If a new service is discovered, worker can propose it before any need exists. Same canonical ID reuse works with reversed publication order.
6. Need owner-reviewed primary ID binds to a concrete need revision/snapshot; mandatory secondary requirements are separately conjunctive. A novel need must stay visible/searchable even when no worker exists. Do not dispatch until the authoritative classification and skill gates are met.
7. Matching = exact canonical ID + worker confirmed service-specific execution mode + owner confirmed need mode + other gates. Related-only discovery is labeled and opt-in; not EXACT. Dispatch consumes confirmed matching signals, never raw AI prose.

## P0 source-only implementation in PR #26
- Shared `classificationEngine.mjs` / `.d.mts`: read-only server catalog loader for both modes with pagination/version checks; owner-review-only proposed plan gate; bounded catalog prompt.
- Worker and requester Edge handlers import exactly the same module; controlled with `USKOCI_TAXONOMY_UNIFIED_SHADOW` (OFF by default).
- Requester source no longer mutates the taxonomy in the middle of the Gemini conversation.
- Pure Node contract tests and source regression tests + dedicated CI. **This does not yet implement Gemini function-calling semantic decisions or atomic commit**.
- **No DEV schema or Edge deployments** in this PR; no phone/push proof.

## Rollout/rollback
1. Lock PR #24 source-to-DEV reconciliation; inventory active functions, grants and migration ledger.
2. Build independent service-only search+plan+validate+commit API with all category references and reversible receipts; test in isolated database.
3. Integrate both AI flows preserving old owner review. Shadow compare catalog candidates and final semantic identity without writes.
4. Add per-service worker mode and need revision binding, canonical positive/negative matcher tests and existing worker requeue.
5. Do not flip write barrier or disable old ensure-path without a verified owner-approved pathway for novel legitimate tasks. New needs must never silently disappear.
6. Release behind server-side flag to test identities, no real-user bulk notification. Proof covers AI→review→save→new/old ID→need→matching, same in opposite order, legacy regression and phone.
7. Roll back Edge feature flag and service-mode integration if any regression; keep catalog UUIDs stable and migrations additive. Restore data through reviewed audit receipts, never truncate categories.

## Open acceptance tests
A/B novel worker and need; C/D both insertion orders; E alias normalization Serbian Latin/Cyrillic; F distinct skating services; G superseded intent; H mode consent; I no workers; J later-worker requeue; K revoked skill; L concurrent upsert; M AI failure/transaction rollback; N auth/RLS/unsafe relation. These are not fully E2E proven in P0. Existing pure tests exercise a subset of the read-only invariants only.

## P1 owner-review cryptographic binding — source-only (14 October 2026)

### Root cause removed in SQL candidate
The first owner-approved admission SQL candidate accepted an arbitrary service-role-provided
`p_plan` after checking only that the owner had a valid AI review and later knew the
`displayedContentDigest`. A review of *something else* was not proof that the user
saw the specific canonical ID, execution mode, and novel branch that would be committed.
Passing the previous disposable PostgreSQL tests was not sufficient to establish this.

In `supabase/candidates/dynamic-taxonomy-20261011/owner-reviewed-admission-v1.sql`,
`rpc_taxonomy_prepare_admission_service` now requires an **exact**
`envelope.classificationProposal` equality with the proposed plan and verifies the
existing review's canonical digest formula independently of the caller:

- Worker: SHA-256 of `(envelope - displayedContentDigest || {baseHash:workerReview.base_hash})::text`.
- Need: SHA-256 of `{envelope:(envelope - displayedContentDigest),policy:needReview.policy_binding}::text`.
- Both require a current, owner-bound, `canAccept=true` review and unexpired digest.

The authenticated `rpc_taxonomy_approve_admission` also requires a persisted
`private.worker_ai_saves` receipt or `private.ai_task_review_commands` acceptance
for the **same owner and review**; plan digest alone is no longer sufficient.
The candidate uses the same client request ID for its current one-plan idempotency
key. It does not require a second UI button: the review's existing save/accept
action is the only intended user-confirmation event. Production integration must
verify the front end actually renders the approved classification as part of the
review, not merely stores it in JSON.

**Compatibility:** Existing DEV review envelopes do not contain
`classificationProposal` and therefore intentionally fail this new admission
gate. **No new SQL or Edge function in this PR was deployed to DEV/PROD.**
Before any activation, the canonical worker/need review constructors must include
the exact visible classification in the envelope *before* computing their
`displayedContentDigest`. The client must render what the digest covers and
then call the existing save/accept action, with additive follow-up admission.

The disposable PG16/17 proof now covers legacy review rejection, undisplayed
semantic variants, cross-account approval, incorrect digest, missing or unrelated
save receipt, replays, worker/need canonical identity, risk in an intermediate
parent label, stale unversioned legacy writers, mode mismatch, and a modified
plan after approval. Source tests and full Deno checks remain independent.

### Known limits — NOT launch-ready

1. This P1 SQL candidate admits **one classification proposal per review**.
   A worker can have many distinct services; these must ultimately be admitted
   as an atomic reviewed **batch** (or with catalog-version re-planning).
   Simply calling the current single-plan transaction repeatedly can make
   later plans stale after the first new category bumps `catalog_version`.
2. Gemini `classificationShadow` has not been persisted into server-owned
   review envelopes, and the app's review UI has not rendered its own classification.
3. This catalog admission only creates/reuses IDs. It intentionally does not
   activate worker capabilities, bind need revisions or authorize dispatch/push.
4. Legacy worker profile synchronization may still create categories on save,
   bypassing owner-reviewed admission. Do not activate the new writer until that
   legacy path is gated or retired safely.
5. Catalog semantic alias deduplication, per-service mode consent, owner revisions,
   concurrent batch proof and Android E2E are still missing.

**Gate before DEV:** atomic multi-service review + correct display projection,
existing saved-review binding, legacy writer retirement, need snapshot/worker
capability reconciliation and explicit matching/notification proof.


## P1.5 multi-service review gate — source-only
`supabase/functions/_shared/classificationBatch.mjs` and its typed declaration
are the new *read-only* shared planner for 1–100 explicitly reviewed service
claims. It reuses the same canonical-ID, parent and scope checker as both
Gemini conversations; rejects repeated service labels or repeated category IDs
within a single mode, treats Cyrillic/Latin spelling variants mapped to one
canonical ID as duplicates, and does **not** infer consent across ON_SITE and
REMOTE. Two separately expressed modes for one service remain separately
reviewable.

Entire batches fail as candidates when any member is stale, contradictory,
unsafe, an unverified alias or a novel branch; individual statuses are retained
for owner review. Even when every entry reuses a pre-existing category, output
is `CANDIDATES_ONLY`, `accepted:false`, `commitAuthority:NONE` and
`requiresAtomicBatch:true`. The limit is a *review payload bound*, not a cap on
the taxonomy's total number of work categories. Node tests prove 3 skating
services, multi-mode, stale versions, duplicates and authority separation.

**Not implemented yet:** a server-owned review that binds the entire service
list into the displayed digest and a single idempotent SQL batch commit which
can create/reuse all reviewed services under one catalog lock and then
reconcile worker/need rows under the existing confirmation. Do not call the
single-service RPC in a loop; the first new category can bump version and
invalidate the remaining plans.


## P1.6 hidden atomic batch and post-save outbox — isolated code proof

**Product rule:** Ordinary users NEVER see category trees, database branches,
canonical UUIDs, synonym admission or a second approval button. The worker
reviews the actual skills and their ordinary-language mode choices; the
requester reviews the category/service and location mode. The existing Save /
Accept / Publish controls remain the only human confirmations.

### Implemented source-only

`supabase/candidates/dynamic-taxonomy-20261011/owner-reviewed-batch-admission-v1.sql`
provides one service-only RPC
`rpc_taxonomy_commit_reviewed_batch_service(owner,requestKey,purpose,reviewId,plans)`.
Within ONE transaction and catalog-control row lock it checks:

- The **existing** owner-bound `worker_ai_saves` or
  `ai_task_review_commands` receipt for exactly the same review/request key.
- The entire `classificationCandidates` array is part of the original
  unexpired review envelope; its SHA-256 digest matches the actual canonical
  worker/need review hash formula. No model-generated plan is a save action.
- The immutable review also signs the catalog version/fingerprint.
- Every worker service label appears in its ordinary profile `skills` list;
  each individual ON_SITE/REMOTE choice has its own reviewed evidence in
  `reviewedServiceModes`. Requester service must match the reviewed
  `need.category`, with mode from reviewed geography. These fields are not
  yet emitted by the *live* canonical review preparers; no fallback inference.
- REUSE uses only a registered established category with supported scope;
  CREATE_CHILD requires a real parent and the **last new leaf exactly equals
  the reviewed service name**. Every ancestry label goes through risk
  screening and collisions cannot silently reparent or create false aliases.
- A batch is bounded to 1–12 reviewed service claims, not a cap on total
  categories. One source catalog version applies to all entries, even when
  earlier entries create child nodes and bump that version inside the
  transaction. Deduplicates both reviewed labels and canonical IDs.
- An error in the second or later entry rolls back **ALL** earlier category
  mutations and audits; a repeated request key replays the original receipt.
- This RPC never inserts worker capabilities, need snapshots, worker relations
  or notifications. Catalog admission is NOT matching authority.

`owner-reviewed-batch-outbox-v1.sql` supplies a **disabled-by-default**
private post-save queue: a DB trigger on the existing worker profile save and
task review acceptance (not Gemini mid-turn), bounded claim with lease token,
receipt-checked settlement, transient error retry, and a reconciliation RPC
for signed saved reviews whose initial enqueue was missed. The background
processor must call the atomic batch RPC and then finalize; only service_role
can use those APIs. A queue failure must not veto the saved user content.
The reconciliation scheduler / Edge worker itself has NOT been implemented
or deployed yet.

Disposable PostgreSQL 16/17 CI adds real SQL proofs for three services in
one worker profile, requester reusing exactly the worker service UUID,
partial-failure transaction rollback, duplicate synonym/ID, unsupported mode,
incorrect leaf, unversioned old catalog writes, idempotent replay after catalog
change, old-saving recovery, bounded claim, stale lease, receipt requirements,
retry backoff, private grants and no dispatch/matching authority. The fixture
simulates NEW signed review envelopes; it does not claim the live app already
provides them.

### Explicit remaining rollout gates

1. Update **both existing canonical review builders** to sign the internally
   generated plan array and catalog fingerprint. Worker review must bind
   independently confirmed per-service modes in user-readable review data;
   requester review must bind actual category and geography. Do NOT show
   category-tree technical details or add another consent tap.
2. Stop/replace the earlier worker save taxonomy writer that auto-creates
   ESTABLISHED categories before this reviewed batch is processed. Coordinate
   with unmerged PR #24 and DEV-applied authoritative worker sync.
3. Implement and schedule the private outbox worker + recovery scan. It must
   not turn a temporary classification failure into an invisible loss of an
   already-published need. Keep unclassified needs visible and queue a
   bounded safe reclassification, never fake matches.
4. Bind admitted worker capabilities and concrete need revisions/snapshots
   under their respective already-confirmed save results. Implement strict
   per-service mode gates + eligible requeue/matching/push. Related results
   need explicit opt-in; do not present them as exact competence.
5. Two-account DEV+HONOR phone proof in both insertion orders, zero-match
   visibility, revoked skills, worker notified when relevant later, rollback,
   stale review, security/privacy, and live actual Gemini semantic accuracy.

**DO NOT deploy candidate SQL or enable the outbox while these are missing.**
