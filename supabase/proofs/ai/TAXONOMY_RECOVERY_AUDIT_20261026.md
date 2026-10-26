# USKOČI ČISTO — drugi Gemini: dokaz i granice oporavka

**Status:** read-only DEV audit + deterministic synthetic tests. **Not an acceptance test with real authenticated user and paid Gemini.** 2026-10-26. 
**Canonical source:** `uskocibusiness-boop/USKOCI-EAN`, `feature/uskoci-cisto` at `c9ddc5d5e9454a4badfce348d0a4fec901e67f35`.
**DEV:** `leqcwgzvjsxugfgzdmth`.

## Verified live observations (snapshot, counts may change)
- Catalog post-save cron executes every minute, enabled; 1440 successful cron **invocations** in 24 hours (not evidence every downstream job finished).
- Outbox: 32 total; 23 NEED and 6 WORKER jobs committed + bound. Three more WORKER jobs require review (two binding review, one catalog review).
- Separately, `work_taxonomy_pending_reviews_v1`: nine OPEN reviews (three NEED `PENDING_CLASSIFICATION`; six WORKER `REVIEW_REQUIRED`). **None** share a matching `source_review_id`, request key and owner with a job in the automatic outbox. Do not claim these are nine silently failed Geminis; some may legitimately need owner action.
- `private.taxonomy_pending_saved_event_v1` and `private.taxonomy_queue_review_after_save_v1` are enabled triggers. `private.taxonomy_reconcile_pending_reviews_v1` exists. The scheduled post-save Edge worker calls outbox reconciliation/claim/admission and binding, but **does not call the Gemini classifier to resolve pending reviews**. No cron job directly invokes `taxonomy_reconcile_pending_reviews_v1`.
- Actual Edge log aggregates for last-day interval: five `BG_GEMINI_ARCHITECT_FALLBACK` and four `BG_WORKER_GEMINI_ARCHITECT_FALLBACK` entries. These **cannot be matched to specific pending reviews** without safe correlation evidence.
- The background helper catches provider HTTP/JSON errors and returns a synthetic `NEEDS_CLARIFICATION` prompt even for transient unavailability, where the user may have described the service unambiguously. It must not be mistaken for a classifier-confirmed ambiguity.
- The post-save outbox does bounded retries of temporary failures (exponential delay; max four retries after initial claim), but it only processes already signed classification plans, not fresh Gemini inference.

## Verdict on the other assistant's four ideas
1. **JSON/timeouts/retry:** partly missing in second-Gemini architect; cannot naively retry paid inference without admission, stable idempotency, accounting and bounded waits. First fix error classification/observability.
2. **Source revision fence:** existing for signed need revisions, reviewed worker snapshots and stored hint revisions; keep it. Audit individual gaps rather than replacing version control.
3. **Persist incomplete classification after Save:** partly implemented via `work_taxonomy_pending_reviews_v1` and triggers, but no evidenced automatic completion. Needs an explicit scope/status policy.
4. **Background re-invocation:** absent for unresolved signed reviews; existing outbox is a different mechanism and must not be represented as a complete fresh-classification retry path.

## Implementation decision gates BEFORE any runtime change
- For each source review, confirm approved immutable source digest and currently authoritative task/profile revision.
- Split `TECHNICAL_RETRYABLE` (e.g., HTTP 429/503 or malformed provider JSON) from `SEMANTIC_AMBIGUITY`, `HUMAN_CONFIRMATION_REQUIRED`, `STALE_SOURCE` and `PERMANENT_FAILURE`.
- Do **not** replay anything that awaits user consent, is stale, or would alter selected service, mode, category, dispatch/push, or private location.
- For any approved technical retry, use an idempotent, bounded, durable operation with per-attempt paid-call admission and accounting, maximum attempts, lease recovery, backoff and dead-letter/manual review. No unbounded automatic billing.
- Keep user Save independent of classification and keep the signed review + latest revision as authority; never silently publish or match based on the Gemini output.
- Add controlled authenticated **test-account** DEV scenarios as a second stage: need conversation; worker conversation; signed Review + Save; accurate catalog binding for current revision; matching; notifications (suppressed or isolated to test devices). Avoid sending messages to real users.
- Observe actual provider failures under masking; never log task text, private address, user IDs, prompt bodies or model API keys.

## Automated proof delivered with this change
- `taxonomy_recovery_diagnostic.test.mjs`: synthetic, **no external network** and no writes. It confirms the current error behavior, that invalid classifications never create a category, and that existing outbox retries are bounded by SQL-controlled leases.
- `taxonomy_recovery_readonly.sql`: rerunnable read-only DEV health audit with no user identifiers.
- CI runs the synthetic cases as part of AI proof step.

**Caution:** The tests call the CURRENT behavior diagnostic, not the desired long-term contract. When error categorization is improved, update the diagnostic expectations in the same carefully reviewed change.
