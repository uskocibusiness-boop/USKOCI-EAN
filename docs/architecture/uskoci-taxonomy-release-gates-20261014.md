# USKOČI — forensic integration and rollout gates, 14 October 2026

Status: **SOURCE-ONLY, NOT SAFE TO ENABLE**. Branch `feature/unified-gemini-classification-p0-20261014`, draft PR #26 against `work/ultra-master-integration-20261012`. Never treat green isolated CI as a deployed APK or production readiness certificate.

## Verified state (read-only Supabase DEV)
- DEV `leqcwgzvjsxugfgzdmth`: 141 categories, 17 root nodes, zero registered aliases, zero confirmed need taxonomy snapshots, catalog_version 3, legacy auto-registration setting TRUE.
- Existing DEV AI functions: `uskoci-ai-interview` v73 still attempts `rpc_taxonomy_ensure_path_service` during conversation; `uskoci-worker-interview` v26 does not use the new shared shadow classifier.
- DEV worker profile trigger calls `private.sync_worker_skills_to_taxonomy_capabilities`, itself still calling the legacy ensure-path writer on unknown labels.
- PR #24 (authoritative worker skills reconciliation) has a migration already applied on DEV but remains unmerged. Resolve Git migration history/source drift before merge. Never replay migrations blindly.
- Current `worker_need_fit_v1` does NOT require per-service REMOTE/ON_SITE confirmation. Per-service confirmed mode rows do not exist live.
- Three separate ice-skating services are under the inaccurate `Zanati i popravke` parent. Do not reparent opportunistically without operator-reviewed reversible audit.

## What PR #26 now provides (not activated)
1. Shared catalog reader and shadow Gemini classifier behind `USKOCI_TAXONOMY_UNIFIED_SHADOW` OFF. Strict canonical service identity check, cross-script Serbian text equivalence, unknown/unsafe plans deferred to review. AI cannot grant skills.
2. Candidate single- and multi-service owner-review admission SQL, fingerprinted/digested source review, matching save receipts and idempotent bounded atomic catalog mutations. Atomic batch now refuses a wrong existing category UUID unless the reviewed service matches the canonical key or a persisted server-owned alias.
3. Pending saved review processing candidate: private outbox + reconciliation/lease/finalization SQL, default OFF, and `uskoci-taxonomy-postsave-worker` Edge function (source only) behind BOTH `USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED=true` and `USKOCI_TAXONOMY_CATALOG_ONLY_ACK=true`. Worker can **only** return `CATALOG_ONLY_TICK`: no needs, worker matching or push authorization. Delayed processing accepts a valid saved review based on original save time, not worker execution time.
4. Safe worker profile synchronization candidate: `worker-no-implicit-admission-v1.sql`; no novel category writer. Current confirmed existing ON_SITE skills are reused; unsupported REMOTE-only and unknown labels remain safely in the ordinary profile's skill list awaiting reconciliation. Removed skills and related opt-ins are still revoked. **Do not apply this alone:** otherwise novel services would remain unmatched indefinitely.
5. Strict per-service execution scope candidate: `taxonomy-strict-worker-mode-v1.sql` with a private confirmed-service/mode table, signed-save evidence requirement and default-OFF control; `worker-need-fit-strict-scope-v1.sql` matcher replacement candidate. A global REMOTE/ON_SITE choice is necessary but NOT sufficient; the service and current requester revision must also be signed. Only exact validated category identity is covered in this initial strict mode; related/inherited matching requires separate proof.
6. Disposable PostgreSQL 16/17 contract proofs: atomic review+outbox, safe worker sync, per-service scope, worker/need shared semantics and no false automatic notification authority. Node and Deno checks test the typed Edge handlers. No DEV writes were performed for these changes.

## Mandatory implementation order — do not skip

### Gate A: review builder + visible consent
- Build the worker's `reviewedServiceModes` from **individual explicitly accepted services and modes**, not generic location preference or model speculation.
- The canonical `rpc_prepare_worker_ai_review` and `rpc_prepare_ai_task_review` must sign server-derived `classificationCandidates`, `classificationCatalogVersion` and `classificationCatalogFingerprint` *before* computing `displayedContentDigest`. The client MUST render precisely the ordinary-language skills/category and modes included in that signature. No technical category tree or second approval button in UI.
- The provider's transient Gemini shadow data is currently discarded; implement safe server-owned validated proposal capture (with ownership, turn identity, latest source review and stale gating). Genuine novel services need verified parent decisions and alias review; do not force an arbitrary legacy root or one of 11 fixed categories.

### Gate B: new saved-review binding (not present)
- After existing Save/Accept, catalog batch admission commits/reuses category UUIDs. Write an **idempotent audited binder** verifying same owner/save/request/review and profile revision; it must persist per-service worker scope confirmations and a verified need revision snapshot. The existing SQL batch intentionally grants NONE of these.
- On conflict or stale mode, do NOT infer authorization. Preserve the saved text, surface an internal pending-resolution status and retry/replan without silently losing the need.
- Switch off the old AI mid-turn ensure path and the worker auto-create path as ONE staged release. The database auto-registration flag by itself does not establish that every old service-only writer has stopped.

### Gate C: dispatcher, mode and notification
- Wire current need snapshot and confirmed worker per-service modes into matcher/dispatcher; scope guard remains OFF until binders and reviewed data are populated. A blank/new worker scope table would block legitimate matches.
- Positive and negative proofs: exact ability vs similar service, excluded skills, consent withdrawn, REMOTE vs ON_SITE, location radius, schedule, required skills, related offers explicit opt-in.
- A published need with zero eligible workers remains published/searchable. Requeue it when a relevant worker becomes confirmed later; **no fabricated exact matches or push**.

### Gate D: DEV and preview phone
- In a disposable DEV tenant, use two independent accounts. Test order worker->need and need->worker; multiple skills; an unseen service; alias collisions; false match/false push prevention; expiration; retry; stale catalog; profile delete/re-add; safety review.
- Test full app cycle on HONOR Android 16: Gemini interview, precise map confirmation/private address, displayed review, save/publish, discovery, offer, selection, agreement, message and push tap to exact screen. Validate installed APK/OTA runtime actually contains changed code.
- Restore/check category count, controls, job leases and privilege grants. Review RLS and Edge service-role isolation. Avoid changing production while any gate fails.

### Gate E: UX, legal and release
- Freeze functional contracts; polish Premium WHITE design, accessible labels, clear native Serbian, search/map continuity and pending resolution copy.
- Complete Play Console internal/closed tests, test account instructions, privacy/terms/data deletion/Data safety and final production AAB only after device QA. Apple store follows independent review.

## Rollback principles
1. Feature env gates OFF: `USKOCI_TAXONOMY_UNIFIED_SHADOW`, `USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED`, `USKOCI_TAXONOMY_CATALOG_ONLY_ACK`.
2. DB outbox control `enabled=false`; matcher per-service scope control `enabled=false`. Never delete user skills/tasks, taxonomy identities, accepted reviews, queue receipts or audit.
3. Release and SQL migrations are separate reversible steps; test roll-forward/roll-back on DEV BEFORE enabling production.
4. Observe transport only by sanitized status/code, never log private task text, owner IDs, location, review JSON or API keys.

**Current STOP verdict:** New candidate SQL, disabled worker and matcher exist only as GitHub source. They are not live DEV migrations, and are not matched to a tested Android build. PR must remain Draft.
