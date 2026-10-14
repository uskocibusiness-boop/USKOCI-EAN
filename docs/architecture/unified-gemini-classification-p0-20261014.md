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
