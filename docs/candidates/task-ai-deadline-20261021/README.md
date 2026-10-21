# AI rok za prijave — lokalni kandidat, 2026-10-21

**Status: candidate only.** The guarded Edge source is active on DEV as `uskoci-ai-interview` v118, but `USKOCI_TASK_AI_APPLICATION_DEADLINE_V1` is absent and the candidate path is OFF. Candidate SQL has not been applied to DEV, the client flag remains OFF, and no signed deadline Save/publish has been exercised. `forward_candidate.sql` must not be treated as an applied migration.

**Activation blocker — deadline-only edits:** The current `rpc_confirm_need_edit_from_review` writer confirms the new fact but does not map it to a changed draft Need. It sets `needs.response_deadline=null` while converting an edit to DRAFT, then compares `private.need_full_edit_snapshot` before and after. That snapshot omits `response_deadline`. An edit that changes only this fact therefore raises `NO_MATERIAL_CHANGE` before the unchanged publish RPC can use the signed deadline. This candidate must remain unapplied and both flags OFF until a separately reviewed edit-path solution and live set/change/clear proof exist. A multi-field edit succeeding would not prove deadline-only edits.

## Contract

- `need.response_deadline` is a public, optional, material `NEED_FACT_V2` object. `{ "kind": "AT", "at": "2026-10-26T10:00:00+01:00" }` specifies the final instant for applications. `{ "kind": "NONE" }` explicitly removes a deadline. No fact means the owner has not specified this choice. None of these values changes `need.starts_at` or `need.ends_at`.
- The Edge interview offers this fact only when `USKOCI_TASK_AI_APPLICATION_DEADLINE_V1=true`. Its fact enum, instruction, and guarded clarification are behind that flag. The ordinary required-question list does not contain the optional deadline. A user can answer a server-owned prior deadline question with a bare date/time; a bare execution date in another context cannot set the deadline. The guard requires verbatim evidence from the current user message, a real future instant, an explicit offset, the appropriate `Europe/Belgrade` offset for a nonliteral local date, and an explicit user request for `NONE`.
- The client uses the candidate prepare RPCs only when `EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1=true`. It no longer sends a client-chosen `p_response_deadline` in that mode. The new RPC derives the deadline from the locked conversation fact, then signs it in the existing immutable review envelope. The accepted review digest, source revision, stale-edit checks, save, evaluation, and publish RPCs retain their existing contract. The review displays “Rok za prijave još nije određen” for an absent fact and “Bez posebnog roka” for an explicit `NONE`.
- The review pencil routes a change back through the AI conversation. Existing user-confirmed manual corrections and stale revision fences remain authoritative; the AI does not silently clear a value. The unchanged legacy prepare path is used while the client flag is off.

## Candidate SQL and activation order

`forward_candidate.sql` adds the registry entry and strict validator, seeds a non-null stored deadline when an edit conversation opens, and adds separate legacy-shaped and taxonomy-shaped signed prepare RPCs. It does not replace the existing prepare RPCs or the accept/publish RPCs. A null stored `needs.response_deadline` is seeded as **missing**, never falsely as an explicit `NONE`.

Before treating this candidate as deployable:

1. Compare the actual DEV `pg_proc.prosrc`/`pg_get_functiondef` and ACL for `private.validate_need_v2_fact(text,jsonb)`, `public.rpc_ai_open_need_edit_conversation_v2(uuid)`, both existing prepare variants, `rpc_accept_ai_task_review`, and `rpc_publish_accepted_ai_task_review` with their source predecessors. The local candidate checks existence, but deliberately has no asserted DEV predecessor hashes. Regenerate the copied functions if DEV differs. Confirm the `need_fact_registry` row is absent. Confirm the latest service-handoff and signed taxonomy changes are present.
2. Run a copy of the candidate against a disposable clone of the intended DEV schema (the file ends in `commit`, so do not run it as a rollback test on DEV). Exercise `AT`, `NONE`, and absent facts; malformed timestamp, DST, past date, and extra JSON key rejection; owner-only ACL; same-review idempotency; stale conversation, manual edit, location revision, and policy rejection. Read back the signed envelope and confirm `publicProjection`, `responseDeadline`, digest, and published `needs.response_deadline` agree. Run two-account isolation checks.
3. Resolve and prove the deadline-only edit blocker above. If all proof passes, convert the candidate to a normal reviewed migration and apply it. Deploy the matching Edge source and set the Edge flag, then distribute a client with the client flag. Keep both flags off until their matching server pieces are live. The Edge flag alone cannot make an unknown registry key writable.

**Remaining design limit:** the existing `needs.response_deadline` column stores only an instant or SQL null. It cannot distinguish an earlier explicit `NONE` from a never-specified deadline when a later edit conversation is opened. This candidate preserves the distinction in the current AI facts and signed review, and avoids inventing `NONE` during reopen. Durable historical tri-state across edit reopen needs a separately reviewed persistence design before claiming full lifetime fidelity. The SQL validator checks the explicit offset and civil timestamp; the Edge guard also checks the local Belgrade offset for an interpreted Serbian time. Direct manual/API writers must be covered by database/runtime proof before activation.

**Default-OFF boundary:** The Edge fact and dialogue-question enums both exclude `need.response_deadline` with its flag off; the client uses the legacy prepare RPC. A rollback after deadline facts exist still needs review: the shared client decoder checks fact/envelope deadline consistency even when the client flag is off.

## Local proof

- `npx jest --runInBand --silent src/data/__tests__/task-application-deadline.test.ts src/data/__tests__/v5-review-screen.test.tsx src/data/__tests__/ai-natural-server-guard.test.ts src/data/__tests__/ai-task-review-client.test.ts` — focused contract plus existing review/Edge/client regressions.
- `npx tsc --noEmit --pretty false` — app/Edge TypeScript check.
- `pglast.parse_sql` and `pglast.parse_plpgsql` — SQL and PL/pgSQL syntax parsing only, not execution or semantic schema validation.
- The candidate validator explicitly rejects SQL `NULL` and JSON null for this fact before any object parsing. This preserves the base V2 validator's `V2_FACT_VALUE_REQUIRED` boundary even though `ai_structured_facts.fact_value` is a nullable column; the local SQL assertion checks the guard's presence, while a real database test remains required.

These checks establish source-level behavior only. A real signed accept/publish readback and DEV ACL/migration proof are still required.
