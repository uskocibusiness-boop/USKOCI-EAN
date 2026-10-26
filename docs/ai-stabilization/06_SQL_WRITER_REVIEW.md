# F0 — SQL writer, trigger and signed-binding review

Snapshot: DEV `leqcwgzvjsxugfgzdmth`; source branch `feature/uskoci-cisto`, audit started at `5e7790e8445e09f38275ec19bdb86e8948c66558`.
Observed definitions/metadata: 2026-10-26 23:33–23:45 UTC (2026-10-27 local date).
All 42 selected function bodies were read in full; their MD5 was rechecked and SHA256 collected at 23:45:17 UTC without drift.
This is a scoped F0 evidence artifact, **not completion of F0, not a repaired database, not a deploy approval**.

No remote DDL, DML, mutating RPC, messages, notifications, deployments, commits or pushes were performed by this review. No private message/profile contents were needed. CLI catalog reads are not application authentication/E2E tests. Supabase skills and CLI query help were read before the database inspection.

## Deliverables and coverage

- `06_SQL_WRITER_MATRIX.csv`: 42 live function bodies; exact signature, source hash, owner, security mode, raw EXECUTE ACL, source-matched migration ranges, read/write summaries, caller evidence, revision/consent guard and test limitations.
- `06_SQL_WRITER_READONLY.sql`: reproducible SELECT-only metadata/source/ACL/constraint/configuration queries. Function definitions are selected, never invoked.
- `review-sql-20261027.json`: exact local file SHA256 and FULL/PARTIAL status. Matching one function body does not mark its entire migration FULL.
- `supabase/proofs/taxonomy/live_writer_characterization.test.mjs`: local in-memory PGlite characterization, 17 subcases plus parent test = 18 assertions reported by Node test runner.

The matrix contains selected relevant writers and adjacent guards, not every writer/transitive dependency in the database. Static callers are source evidence, not invocation telemetry. Missing source hits are not proof a function is dead or safe to delete. Local source is not claimed deployed. The matrix's lexical discovery query is deliberately broader than fully read bodies; only its 42 listed bodies have FULL live review.

## Findings first

### S11 — live text trigger can overwrite category identity; binder itself is ID-only

Verified enabled trigger:

```sql
CREATE TRIGGER needs_sync_taxonomy_category_trg
BEFORE INSERT OR UPDATE OF category ON public.needs
FOR EACH ROW EXECUTE FUNCTION private.needs_sync_taxonomy_category_trigger_fn();
```

Live body MD5: `3244c0fd784d722ece2e3ace8688bfe7`.
It selects into `NEW.category_id` from normalized **canonical_key only**, excluding RETIRED but allowing AUTO_PROVISIONAL. It has no existing-ID/signed-snapshot preservation gate. If the full text lookup fails and text contains "/", it retries only the final path leaf. No registered alias lookup occurs. A nonempty unrecognized label makes the target NULL.

Synthetic results with the exact live body and normalizer:

1. INSERT with canonical label A and supplied ID B becomes ID A.
2. UPDATE of category_id only preserves B: the UPDATE-OF-category trigger does not run.
3. One UPDATE naming both category and category_id lets the text trigger overwrite the requested ID.
4. A registered alias label clears existing category_id; the alias table is ignored by this trigger.
5. After an ID-only repair, even `SET category=category` with that alias clears the ID again.
6. Blank label is rejected by the real needs category CHECK, rather than silently creating a reachable blank-label state. Live metadata additionally confirms category NOT NULL; category_id nullable.
7. An unrelated parent prefix plus valid leaf still maps to the leaf category.
8. AUTO_PROVISIONAL category can be projected because the gate is only non-RETIRED.
9. The category foreign key still rejects an unknown ID.

This demonstrates a **reproducible trigger contract risk**, not an observed corruption incident against existing users. It does not prove matching bypass: strict signed scope/snapshot checks remain independently required.

Actual reviewed writer ordering:

| Writer | SQL category write | Trigger relative to signed binding |
|---|---|---|
| rpc_save_need_draft_from_review | INSERT category, not category_id | Text trigger before draft is inserted; later saved-review outbox/binder |
| stage_task_replacement | INSERT category, not category_id | Text trigger before staged draft; old need is not canceled here |
| rpc_confirm_need_edit_from_review | UPDATE category/revision/status; no category_id | Text trigger on draft edit before later signed binding |
| rpc_taxonomy_bind_reviewed_need_service | UPDATE category_id only | Does **not** invoke UPDATE-OF-category trigger |
| rpc_confirm_need_edit | Contains later UPDATE category | New-edit branch raises PUBLISHED_TASK_EDIT_NOT_READY before that write; not an active new-edit writer |

No inspected reachable application SQL writer sets both category and category_id in the same statement. The two-column test proves PostgreSQL precedence in the bounded fixture, not a currently observed app statement. Direct authenticated owner/DRAFT table writes are a privilege surface, not evidence that the UI currently sends both columns.

The signed need binder rejects conflicting existing non-null category_id or an existing revision snapshot; it does not blindly correct conflict. It binds matching review/request/digest/revision and inserts a signed snapshot and receipt atomically. Preserve those gates.

Historical source `20261013193000_uskoci_needs_category_sync_trigger.sql` was read fully: it lacks the live slash-leaf fallback. No exact current body was found in the scoped migration-body hash scan. Do not replay that old migration as the fix. First establish source provenance and design a forward change preserving pending publication, revision ownership and signed binding.

### S12 — display-text changes can revoke old eligibility; additions do not blanket-revoke

Verified enabled trigger:

```sql
CREATE TRIGGER worker_profile_sync_taxonomy_capabilities_trg
AFTER INSERT OR UPDATE OF skills ON public.app_profiles
FOR EACH ROW WHEN (new.kind='WORKER')
EXECUTE FUNCTION private.worker_profile_sync_taxonomy_capabilities_trg_fn();
```

Live sync body MD5: `8bfb57431cd6a6fcff2e1e80fe8b5fbc`.
Source match: `20261021104455_closure_taxonomy_archive_copy_coverage.sql:1752-1834`.
The historical 20261014 migration is not the current complete sync body.

The current sync locks the actual worker profile and verifies the supplied skills equal its saved skills. Each label must be 3..120 characters and uniquely match an ESTABLISHED category's canonical key or registered alias, with some category mode present. That match only retains already-existing capabilities. It does not create/revive authority, infer ON_SITE, refresh retained confirmation timestamps or enqueue matching.

Synthetic tests prove:

- Adding an unknown new service while retaining the old canonical label leaves the existing capability active and creates no new capability.
- A registered alias rename retains the existing capability.
- An unregistered synonymous display rename excludes the old capability and removes its related opt-in; this trigger does not deactivate the separate signed mode history row.
- Text re-add alone does not revive an excluded capability.
- Explicit empty skills revokes the active capability while preserving history.
- Supplied stale skill list is rejected against the locked current profile.

This distinguishes the real identity-loss risk from the broader, unsupported claim that any added unknown service revokes all old services. A future fix cannot simply stop revocation: explicit service withdrawal and consent boundaries must remain effective.

Known writers:

- `rpc_save_worker_ai_review` writes profile skills **before** inserting worker_ai_saves. The AFTER-skills sync therefore runs before pending/outbox creation and before asynchronous signed binding.
- `src/data/workerProfileClientService.ts` is a separate owner-filtered direct REST insert/update writer. Its whitelist accepts `vestine` and maps it to `skills`; account-generation/receipt checks do not make those labels signed taxonomy consent.
- FULL-read `src/lib/capabilityTerms.ts` permits up to 50 items, each up to 500 Unicode characters; SQL retention admits only 3..120-character labels. This is a boundary mismatch, not proof that any arbitrary >120 label has an existing category identity.
- FULL-read `workerProfileDraft.ts` builds changed-field skills commands. The read caller ranges in profil/radnik.tsx show the form passes the command to the same writer.
- A partial caller read of prilike/[id]/prijava.tsx shows optional add-category-to-profile after a successful application, appending the task category through the same writer. This optional append is **not** semantic taxonomy admission or signed mode consent.
- `rpc_taxonomy_assign_worker_categories_service` is a legacy service-only writer: grants/revives capabilities, appends labels to skills and invokes the trigger indirectly. It lacks the current signed review binding contract. No current app/Edge caller was found in the scoped source search, but runtime non-use is unproved.

The signed worker binder remains separate and strong: exact saved owner/review/request/digest; latest Save and current profile/skills; established identity and explicit per-service modes; old mode deactivation; durable receipt; no invented related-service consent.

### S08 — registered alias identity is supported, arbitrary semantic synonym is not

`taxonomy_review_candidate_projection_v2` first uses the exact projection. Both that path and the live batch's REUSE/EXTEND identity validation require a unique canonical or registered-alias match. Merely attaching a known UUID to a different unregistered service label does not satisfy this gate.

The two S08 fixture tests execute only the live identity SELECT predicate:
registered alias resolves to A, unregistered synonym resolves to no ID. They do **not** execute a complete signed batch, model classification, candidate-proposal workflow or catalog concurrency.

Keep the UUID/owner/review/catalog/signature guards. A future semantic-identity solution must produce a reviewable server-bound identity/alias contract; removing the check or granting nearest-parent capability would defeat the existing consent boundary.

## Saved review → catalog commit → signed binding

1. Need/worker preparation signs the current displayed facts, candidate proposal and explicitly reviewed service modes. Pending classification can be visible and still saveable when core facts are ready.
2. Save/accept writes the actual draft/profile and durable saved command. Skills/category triggers run during these writes.
3. AFTER-saved triggers either enqueue complete candidate plans/fingerprint into the outbox or record eligible pending state. Zero candidates is not automatic retry work. Exceptions are sanitized LOGs and do not undo a successful owner Save.
4. The post-save Edge source reconciles missing eligible outbox records, claims bounded leased batches, commits reviewed catalog plans, finalizes the result, and optionally calls the bounded binding coordinator.
5. Catalog commit returns a receipt requiring separate binding; it is not worker eligibility, need matching or notification authority.
6. Need binder writes only category_id plus signed snapshot/receipt. Worker binder writes exact saved-service capabilities plus signed per-service modes/receipt.
7. Binding receipt triggers may enqueue/requeue work only after rechecking current signed state. Requeue is not notification delivery; downstream matching still owns area/time/budget/capacity/scope/duplicate checks.

No function in this audit was called to exercise this flow remotely. The local post-save Edge source was read, including another agent's in-progress transport fix; no claim is made that the fix is deployed.

Finalize retry classification from the live body: TIMEOUT, NETWORK_UNAVAILABLE and TEMPORARY_UNAVAILABLE retry while attempts < 5; other codes, including BATCH_REVIEW_REQUIRED, go REVIEW_REQUIRED. Bind-ready uses its own SQLSTATE retry set (PT409, 40001, 40P01, 55P03, 57014) and bound.

## Privileges and configuration snapshot

All 42 reviewed functions are owned by postgres. Most mutating entrypoints are SECURITY DEFINER with fixed search_path; the matrix retains the precise ACL. Helper normalizer/projection/legacy registration functions are SECURITY INVOKER. Two private trigger functions have NULL proacl (default function EXECUTE), but private schema has no anon/authenticated USAGE: do not misreport them as publicly callable endpoints.

- private schema: postgres CREATE/USAGE; service_role USAGE; anon/authenticated no USAGE.
- public.app_profiles: RLS enabled, not forced; authenticated INSERT/UPDATE owner policies; service role writes allowed.
- public.needs: RLS enabled, not forced; authenticated owner INSERT/UPDATE constrained to DRAFT. No claim about every SELECT privacy policy is made by this writer audit.
- categories, aliases, capabilities, need snapshots: RLS enabled, no direct authenticated writes, service_role SELECT-only in observed ACLs.
- confirmed worker modes: RLS enabled, postgres-only observed ACL.
- review outbox: RLS disabled but postgres-only observed ACL. This alone is not evidence of public exposure; nested-definer effects require the separate full privilege analysis.

Configuration read at this snapshot: catalog_version 11; auto_registration_enabled false; pending/outbox/binding/strict_scope enabled true. Catalog auto-registration being off does not disable the signed reviewed-batch path. `rpc_taxonomy_ensure_path_service` always raises its disabled-path exception. The old invoker low-risk registrar remains present but disabled by configuration and lacks direct service table-write grants.

## Adjacent client contract finding: canonical replay key

Live `rpc_accept_ai_task_review` first rejects a request key already used for a different review. If the same review already has a command, it returns that canonical command even when the new supplied request key is different and unused. It does so before the new-work expiry/source checks.

Therefore an accept response's canonical clientRequestId need not equal the newly supplied key. Owner/review identity still must match. This contract was sent to the client and helper reviewers before they finalized their local receipt validation. This report does not claim their current implementation state.

The absent `rpc_prepare_ai_task_review_deadline_taxonomy` was independently checked in pg_proc. The conversation-path reviewer found deadline feature flag unconfigured in checked runtime configuration, so this is a conditional future rollout incompatibility, not a proven currently active missing-RPC incident.

## Test limitations and next gate

PGlite runs PostgreSQL semantics in a disposable in-memory fixture. Four exact live bodies are embedded and MD5-checked: normalizer, needs text trigger, worker sync and its trigger adapter. The fixture recreates only the relevant columns, category FK/CHECK and trigger definitions; closure/erasure dependencies are explicit stubs. It is **not full deployed schema/role/RLS/trigger equivalence**, production PostgreSQL infrastructure, real concurrency, full signed review/Save/binder, matching, UI or delivery E2E.

The proof deliberately passes while reproducing undesirable behavior. It must not be used as a green release signal. No schema, migration or historical applied file was modified to suppress the behavior.

Before S11/S12 repair: finish the writer/caller/provenance gate, decide how display text carries stable reviewed service identity across direct profile edits, write red-to-green contract tests including explicit withdrawal/alias/unknown/retired/revision conflict, and only then prepare a small forward candidate change. DEV deployment and mutating E2E still require separate owner approval. The pending ledger recovery and complete matching transitive graph remain open in the wider MASTER plan.

