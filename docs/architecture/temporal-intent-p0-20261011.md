# USKOČI — P0 Temporal intent contract (11.10.2026)

Status: **SOURCE-ONLY AUDIT / ACCEPTANCE CONTRACT; NOT IMPLEMENTED OR DEPLOYED**.
Scope: existing Gemini NEED_FACT_V2 -> reviewed draft -> canonical publication -> existing MATCH-V1 dispatcher/calendar.
No second AI pipeline, no second dispatcher, no invented task duration, no DEV/PROD SQL write.

## Owner intent (authoritative product requirement)
- "Sutra u 7 neko da mi namesti policu" = **known start**, no asserted task end. AI must not demand estimated duration to finish a normal single-task draft.
- "Do petka" = **completion deadline**, not permanent / unbounded "flexible" and not a worker response deadline.
- "Kad god mozes, ali do petka" = **flexible completion within a fixed deadline**; may display both properties.
- "Do kraja godine" = fixed completion deadline; the server must not mistake it for this week's boundary.
- "Kad god" = no stated date/deadline; only then unbounded flexible.
- "U petak od 9 do 12" = both bounds known and user provided.
- Repeated or multi-day work must not be collapsed into one invented continuous time window.

The existing schema has `needs.schedule_kind`, nullable `starts_at`, nullable `ends_at`, `task_timezone`, and distinct `response_deadline`.
The existing `NEED_FACT_V2` exposes the first three as typed facts; Gemini already receives authoritative Europe/Belgrade server time and forbids inventing a finish.
Keep a **single** canonical time interpretation across AI, human review, SQL, dispatcher, calendar and UI. New semantic variant(s) must be added to the existing model, not a parallel scheduler.

## Current read-only evidence / blockers on canonical DEV (11.10)
1. Deployed `public.rpc_save_need_draft_from_review` MD5 `3dceed88dd27346ce7827ff893eb103c` rejects FIXED_WINDOW without **both** starts_at and ends_at (`FIXED_WINDOW_BOUNDS_REQUIRED`).
2. GitHub `supabase/functions/uskoci-ai-interview/index.ts` explicitly instructs the model that FIXED_WINDOW requires both timestamps, despite the general rule not to invent the end. Deployed Edge v60 differs from Draft PR source.
3. Deployed `private.availability_is_future` requires both start and end. Deployed `private.worker_need_time_tier_v1` MD5 `753027749309ccc110f486cbfb4866e4` has no safe future start-only path: a FIXED_WINDOW with `starts_at` alone falls through to the "available now" path rather than proving availability **at the future start**. Do not enable such input before this is fixed.
4. The same time-tier function computes TOMORROW/WEEK default windows only when **both** fields are absent. An end-only `WEEK_FLEXIBLE` value does not create a worker availability interval, leading to refusal; `FLEXIBLE` end-only can skip worker calendar entirely via its "bilo kad" branch.
5. `private.need_search_time_admitted_v1` MD5 `b830cd07c2a5db101a3a28096256a75b` uses a derived publication-week end for `WEEK_FLEXIBLE` even when an explicit later deadline exists. The explicit end check constrains earlier ends but a later stated end can still be cut short by the derived relative-week boundary.
6. `response_deadline` is only the window for worker *applications*; it is not the task completion deadline.
7. The public task time controls already use named-zone civil instants and DST ambiguity/gap rejection (e.g. `src/data/__tests__/pkg003-timezone.test.ts`), which must remain.

## Proposed minimal target semantics (no production changes in this commit)
Single canonical task time category/intent:
- EXACT_WINDOW: start+end; test full availability coverage and hard calendar conflicts.
- START_ONLY: starts_at required, ends_at absent. Test availability **at the start instant** without manufacturing a multi-hour interval. Explain that duration is agreed with the worker later; no exact full-duration conflict claim.
- COMPLETION_DEADLINE: end-by deadline required; time before it is available for arranging the work; do not label as "bilo kad" without showing the deadline.
- FLEXIBLE_UNTIL: user explicitly allows flexible arrangement but limits the deadline. The deadline must remain authoritative for discovery, notifications and matching.
- UNBOUNDED_FLEXIBLE: neither start nor end; do not invent expiry as task finish. Existing moderation/age-out policy remains independent.
- DAY_OR_PERIOD: explicit day or period without a clock must not become a fictitious hour, especially "sledece nedelje".
- REPEATED: recurring shifts need a separately confirmed pattern; no imaginary continuous interval.

Implementation choice: use the **existing** `needs` and V2 fact contract and extend its schedule semantics as needed. Do not silently repurpose `response_deadline` as an execution deadline. If adding enum values, migrate every consumer (V2 validator, Edge prompt/schema, draft/save/edit, publication decision/readiness, search/expiry, `worker_need_time_tier_v1`, dispatch, calendar readers, task detail/UI, client decoder) together under a source-pinned disposable DB test and rollback. Preserve all existing closures/grants/idempotency.

## Acceptance corpus — must PASS before server or OTA distribution

Anchor for deterministic examples: Sunday **2026-10-11**, `Europe/Belgrade`, date and offset resolved by server.

| Input | Expected interpretation | Required behavior |
| --- | --- | --- |
| Sutra u 7 neka neko namesti policu | START_ONLY, Mon 2026-10-12 07:00 +02:00 | ends_at NULL; do not ask for duration; worker availability at start |
| U petak od 9 do 12 | EXACT_WINDOW, Fri 2026-10-16 09:00–12:00 +02:00 | verify whole interval |
| Okrečiti sobu do petka | COMPLETION_DEADLINE, Fri 2026-10-16 inclusive | store inclusive user intent using a precise exclusive boundary, **not** response_deadline |
| Fleksibilno, kad stignes, ali do petka | FLEXIBLE_UNTIL, completion by Friday | deadline retained and displayed; do not turn into indefinite task |
| Moze bilo kada | UNBOUNDED_FLEXIBLE | no invented date, end or duration |
| Do kraja godine | COMPLETION_DEADLINE, Thu 2026-12-31 inclusive | exclusive bound 2027-01-01 00:00 Europe/Belgrade; no week cutoff |
| Sledece nedelje | DAY_OR_PERIOD, Mon Oct 19 to Sun Oct 25 | date range only, no hour invented |
| Sutra u 7, zapravo u 8 | START_ONLY 08:00; 07:00 superseded | review and description must show only final time |
| Od petka, trajace oko dva dana | start + **user-reported estimate**, not fabricated | distinguish estimated duration vs contractual finish |
| 2026-10-25 u 02:30 | DST repeated local time | ask once for clarification, no silent UTC choice |
| 2027-03-28 u 02:30 | DST nonexistent local time | refuse non-existent civil instant without moving the hour |
| Do petka, prijave do sutra | completion deadline + separate worker application deadline | both displayed with distinct labels |

For every case: Gemini proposal -> typed V2 facts -> human review/edit -> save draft -> canonical publication -> `Za mene` -> targeted dispatch -> expiry/discovery consistency. Test unrelated workers, time-blocked workers, own tasks, canceled search, stale revision, duplicate events and corrections. CI must include real disposable PostgreSQL and first-refusal/full-detail agreement; source-only prompt test is not enough. Authenticated DEV and HONOR phone checks are later owner-approved gates.

## Release sequencing
A. Contract + source pin + negative baseline proof (this document).
B. Implement one atomic reviewable SQL/Edge/mobile candidate, preserving current master matcher and one dispatch path. No PROD.
C. Isolated PostgreSQL 16/17 plus AI structured-output fixture regressions, PRE-P4, TypeScript, source ACL/hash and rollback check.
D. Only on separately authorized DEV promotion: readback, one bounded source-owned requester/worker E2E with global sends OFF; provider then physical HONOR proof.
E. Resolve exact installed preview package/source/native runtime and OTA preflight; create new signed preview APK if native mismatch; distribute JS via OTA only after confirmed compatibility.
F. Store production requires separate PROD backend, legal/store readiness and signed AAB. A green isolated CI is not an Android device proof.

**Do not merge, deploy, publish OTA, send push, create users or trigger dispatch on this document alone.**
