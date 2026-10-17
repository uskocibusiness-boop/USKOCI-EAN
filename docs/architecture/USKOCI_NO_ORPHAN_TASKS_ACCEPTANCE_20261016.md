# USKOČI — NO ORPHAN TASKS / automatic classification acceptance contract
Date: 2026-10-16
Scope: source-only implementation contract for DEV, **not** a completed rollout.
Goal: a requester does not need to choose a technical taxonomy category. Every task must either have a verified, server-bound service identity before automated dispatch, or be in an explicitly recoverable, visibly pending state. Never silently advertise matchmaking success.

## Canonical flow
1. Gemini may propose `REUSE_EXISTING`, `REUSE_ALIAS`, `CREATE_CHILD`, or clarification. It cannot commit category UUIDs, worker skill grants, job selections, or notifications.
2. Resolve the service using established canonical identity and VERIFIED aliases, with language/script normalization. Morphological similarity is **not** an identity grant unless the server has vetted an alias. If an input contains a displayed parent path (for example `Briga o ljubimcima / Dresura pasa`), preserve the human-reviewed leaf and parent context distinctly; do not compare the concatenated display path to a leaf canonical key, silently strip path segments, or infer qualifications from ancestry.
3. If one established UUID and execution scope are verified, sign that exact identity in the user-visible review **before** computing `displayedContentDigest`; owner confirmation is required.
4. A truly new service is a proposed `CREATE_CHILD` candidate, requiring a valid parent, distinct service meaning, supported execution scope, evidence and owner-reviewed admission. Creation must be transactional, duplicate-resistant, idempotent and queued for retry without deleting user content. Low-confidence, ambiguous or unsafe proposals require clarification or review, never unrestricted category creation.
5. A successful human Save/Accept is not itself taxonomy authorization. The post-Save outbox must receive a committed, bound category for the **current need revision**; worker skill/mode bindings must come from that worker's own confirmed Save. Catalog writes, need binding, worker binding, matching, and push are separate auditable stages.
6. Strict dispatch and the `Za mene` surface must fail closed without these signed scopes. Show the task in normal discovery where allowed, but do not claim that workers were notified. For categories with no qualified workers, keep the task discoverable by relevant public search and surface an honest availability state; any related-category outreach requires independently verified relevant capability or explicit opt-in, not a generic ancestor grant.
7. User-facing category-pending information is a temporary exception/recovery state, not normal perpetual UI. Ordinary tasks must resolve in-line. If classification is unresolved at publishing time, do not silently show it as matched or dispatched; retain an identifiable recoverable state, retry safely, and ask a meaningful natural-language clarification only if necessary. Never disclose UUIDs, outbox or SQL terms to end users.

## Audited DEV state (2026-10-16)
- Canonical project: `leqcwgzvjsxugfgzdmth` (PG 17). Control flags for strict scope, binding and outbox are enabled; old automatic category registration is disabled.
- One published task has category display text `Briga o ljubimcima / Dresura pasa` and no `category_id`; current signed need snapshots, worker capabilities/mode grants, worker/need bindings and review outbox rows are empty.
- `rpc_prepare_ai_task_review` on DEV still returns the legacy unsigned review contract; source candidate `supabase/candidates/dynamic-taxonomy-20261011/need-review-signed-classification-v1.sql` is not yet promoted.
- Worker client chooses signed review RPC only with `EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW=true`; current legacy path lacks taxonomy consent. Server `rpc_prepare_worker_ai_review_taxonomy` exists but its presence alone does not activate the client.
- `private.taxonomy_review_exact_projection_v1` only resolves canonical labels or stored aliases; it does **not** auto-propose `CREATE_CHILD`. Path-to-leaf handling, validated novel-meaning proposals, and signed admission still need integrated tests.
- Existing active worker and existing published task are same-account, correctly blocked by `OWN_NEED`; future E2E must use distinct accounts.

## Non-negotiable acceptance proofs before DEV enablement
- For a known canonical label and a separately vetted alias: one UUID, current signed Need revision, matching explicit worker capability+scope, one idempotent outbox binding, eligible match for a **different** worker account, no unauthorized push.
- For a new safe service: exact human-reviewed service meaning and mode, proposed `CREATE_CHILD`, one transactional child and alias reconciliation under concurrency/replay, bound Need revision, subsequent eligible worker handling only after worker consent. Unknown/unsafe service does not bypass review or fabricate skill authorization.
- Cyrillic/Latin same written phrase coalesce; grammatical variants coalesce only when aliases explicitly admit them. Distinct services cannot be merged by the model.
- Repeat/expiry/revision-change/foreign-account/ambiguous-parent/wrong-mode must reject or safely retry without duplicate categories, lost Saves, leaked addresses or spurious notifications.
- Full two-account physical phone test: requester publishes, independent worker sees qualified opportunity, applies, requester accepts, agreement/calendar conflict is blocked, push opens precise task; observe provider receipt and backend records. Calendar one-hour travel buffer is a **separate unimplemented requirement**, not a current fact.
- CI on disposable Postgres and client mocks are necessary, but not substitute for current DEV owner session or device proof. Run `supabase/proofs/dynamic_taxonomy/dev-strict-match-readiness-readonly.sql` and inspect actual source revision before each promotion.

## Rollout order
1. Source-only tests for path/alias/CREATE_CHILD proposal, reviewed digest, owner and scope authority; disposable Postgres proof.
2. Versioned signed worker and Need review availability, behind explicit preview flags; maintain old APK parsing compatibility. Never hot-switch production before a proven preview.
3. Reviewed admission + post-Save outbox/binders with real user approval, idempotent retries and read-only evidence.
4. Observe current signed Need/worker scope and test matcher per distinct account, availability and push; only then consider normal release UX and production infrastructure.
5. Keep PR draft until server, CI, preview OTA and phone receipts agree. No live DEV data repair, destructive migrations or `service_role` secrets in repository.
