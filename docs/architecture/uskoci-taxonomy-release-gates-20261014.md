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


## Gate A progress checkpoint — 14 Oct, post-PR #26 continued commits

**SOURCE ONLY / NOT DEPLOYED:** The shared Gemini inspector now returns a separate
`reviewProposals` array for validated exact canonical reuse or proposed child
under a known parent with an explicit mode. It strips these hints from the old
authoritative worker/need output and rejects ambiguous mode, stale/fabricated IDs,
unverified aliases, repeated service meaning, unsafe and semantically mismatched
claims. These are STILL UNTRUSTED suggestions and cannot authorize admission.

Both actual Edge handlers now have an additional **default-OFF**
`USKOCI_TAXONOMY_SHADOW_CAPTURE` branch after their pre-existing successful
turn-completion RPC. It invokes an owner/conversation/turn/attempt-bound
service-role RPC to persist a bounded, non-authoritative hint receipt. Any RPC
error is isolated from successful customer turn completion. The initial
`USKOCI_TAXONOMY_UNIFIED_SHADOW` remains default OFF as well.

New **source-only** SQL candidate:
`supabase/candidates/dynamic-taxonomy-20261011/gemini-turn-review-hints-v1.sql`.
It creates a private RLS-protected turn-hint ledger and rejects false owners,
unfinished turns, non-service JWT, mismatched replay, missing service mode and
oversized/malformed batches. It stores a source fingerprint for later stale-review
checking; it never creates categories, worker capabilities, need snapshots, notices
or eligibility. It must NOT be installed alone or used as signed owner approval.

Isolated, disposable PostgreSQL 16/17 proof:
`https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38599139999`
**SUCCESS**, both matrix versions. Updated shared Gemini Node/Deno proof:
`https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38599140232`
**SUCCESS**. Neither proof represents a live Gemini provider call or device receipt.

DEV preflight still read-only: 141 taxonomy categories, 17 roots, catalog version 3,
legacy auto-registration TRUE, no new hint table, no reviewed outbox table,
requester interview v73 and worker interview v26. Legacy ensure-path is still
referenced by worker sync; old registrar still exists. Two active minute crons
remain: `uskoci_edge_workers` and `uskoci_marketplace_tick`.

**Next mandatory Gate A work:** no current review builder consumes the captured
hints. A trusted server-owned projection must (a) reconcile ALL services with
the CURRENT saved worker skills / need.category and explicitly selected per-service
mode, (b) validate same owner, conversation, latest source revision and catalog
fingerprint, (c) make the exact ordinary Serbian projection visible to the user,
(d) sign classificationCandidates and reviewedServiceModes in the existing
canonical review digest, and (e) connect the existing Save/Accept receipt to
atomic admission and idempotent worker/need revision binding. Do NOT directly
promote a Gemini hint into owner consent. Legacy writer shutdown, strict matcher,
requeue and push are still BLOCKED behind these gates.

Stop/rollback: leave both shadow flags OFF; no database change on DEV or PROD
was made in this checkpoint. PR remains Draft. The hints schema and optional
capture are additive, not a rollback of the user's saved skills or needs.


## Gate A/B follow-on checkpoint — continued implementation (14 October 2026)

**SOURCE ONLY. None of the following SQL or client changes are deployed on DEV,
production, EAS preview or HONOR device. Draft PR #26 must stay DRAFT.**

- Added `supabase/functions/_shared/classificationOwnerReview.mjs` with
  source-only fail-closed owner projection and explicit per-service worker modes.
  Unknown service/mode, proposed unsafe child, semantic mismatch, duplicate model
  hint, unsupported REMOTE/ON_SITE, and no explicit worker consent cannot become
  `READY`. Exact known canonical services deterministically reuse UUIDs;
  never treat broad parent/related AI evidence as competence. Tested by
  `classification-owner-review.test.mjs` in Node workflow.
- Added `owner-review-exact-projection-v1.sql` as a **private** indexed
  canonical / registered-alias resolver for review builders only. It signs
  zero candidate entries if even one reviewed claim or mode is unresolved,
  verifies catalog version **and full fingerprint**, and returns ordinary
  service and mode alongside canonical ID. It is not an RPC and grants no
  API role access. PG16/17 disposable proof:
  https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38602079008
  (SUCCESS, both matrix versions).
- Created `need-review-signed-classification-v1.sql` using the **actual
  DEV-defined canonical** `rpc_prepare_ai_task_review` function as its
  baseline; read-only source retrieval, no DEV write. It derives the primary
  service from authoritative review facts and scope from confirmed geography
  (REMOTE, STATIONARY, POINT_TO_POINT, MULTI_STOP, AREA_BASED), adds signed
  `classificationState`, `classificationCandidates`,
  `classificationCatalogVersion`, `classificationCatalogFingerprint`,
  and `reviewedServiceModes` **BEFORE** the existing digest formula.
  It skips old cached reviews without signed fields instead of silently
  treating a legacy review as classification approval. New SQL parses in
  disposable PG16/17 alongside the private resolver. Novel/uncertain needs
  retain original Save/Accept eligibility; no fabricated canonical ID.
- Extended `src/data/aiTaskReviewClientService.ts` with backwards-compatible
  **strict** decoding for old or complete signed review envelopes; a signed
  category must exactly equal the ordinary `need.category` visible fact
  and the reviewed geography mode, otherwise decode fails. Added Jest
  positive/negative tests and guarded explanatory notice on
  `src/app/(app)/pregled-zadatka.tsx` **only for new signed pending reviews**.
  Jest proof: https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38602785955
  (SUCCESS). Additional TypeScript check now required by CI, awaiting fresh run.
- Added first Gate B `owner-reviewed-need-binder-v1.sql`, gated service-role
  helper requiring exact owner, accepted Save receipt, committed batch receipt,
  recomputed signed review digest, current Need revision, primary service,
  compatible location mode and established canonical ID. It never overwrites
  a disagreeing historical snapshot or a different Need category UUID.
  Category link, CONFIRMED owner-reviewed revision snapshot, and one immutable
  idempotency receipt share a single transaction; response explicitly grants
  NO dispatcher or notification authority. It preserves the original Need
  revision, text, price, geography, headcount and publish state.
  PG16/17 isolated positive/negative proof:
  https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38603902246
  (SUCCESS, both matrix versions). Note the source constraint extension adds
  OWNER_REVIEWED_BATCH without deleting historical snapshot rows.

**Mandatory unfinished linkage** (do NOT bypass it):
1. Worker mode confirmation must be captured **per visible saved service**;
   the current worker AI review UI and `rpc_prepare_worker_ai_review`
   do not support this yet. The existing global mode inference after Save is
   NOT sufficient authorization for per-service matching.
2. Worker review must sign classification+explicit modes in the existing
   `displayedContentDigest`; client review must show these precise modes,
   with no extra technical taxonomy approval screen.
3. A server-owned bridge must carry validated captured Gemini hints into the
   current owner/revision-bound review, handle new low-risk child branches and
   risk/alias review, and preserve failed classification as pending. The exact
   projection is only the safe existing-identity part of Gate A.
4. Post-save outbox currently performs **CATALOG ONLY**. Need binder is not
   invoked by the background processor; no worker capability binder exists yet.
   Wire both with revision fences, observable pending/retry and one release plan.
5. Reconcile PR #24 migration ledger before eventual merge and coordinate
   replacement of both legacy category writers. Do not activate new matcher,
   per-service guard, requeue, broad push or production promotion yet.
6. The rollout must verify old APK / OTA reader compatibility before any
   change to the canonical live `rpc_prepare_ai_task_review`. Changing the
   signed envelope while an old client rejects extra keys would be a regression.
   Preview test accounts need an explicit gated rollout strategy.

**Rollback:** leave `USKOCI_TAXONOMY_UNIFIED_SHADOW`,
`USKOCI_TAXONOMY_SHADOW_CAPTURE`,
`USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED` and
`USKOCI_TAXONOMY_CATALOG_ONLY_ACK` OFF. No new DEV/PROD migration was
executed in this continuation; leave historical users/tasks intact.
