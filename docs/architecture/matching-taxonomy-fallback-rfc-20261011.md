# USKOČI RFC — Growing work taxonomy and zero-match escalation (11 Oct 2026)

**Status:** SOURCE-ONLY DESIGN PROPOSAL, NOT IMPLEMENTED, NOT APPROVED FOR LIVE. No SQL/Edge/provider/cron/push is executed by this document. This does **not** replace the separately tested one-function AI-category fallback in PR #6.

## Product requirement (owner feedback 11 Oct 2026)
A published task must not *silently* reach nobody simply because the publisher and worker described related work with different words. USKOČI should recognise a job, distinguish a main kind and specific subkind, and expand to **appropriately qualified, consenting** adjacent workers when exact matches are unavailable. “At least one person” is a *best-effort discovery and transparent escalation goal*, never a promise to send an irrelevant or unsafe push. A marketplace with zero qualified/available workers cannot guarantee a recipient.

### Verified current state (read-only, canonical DEV)
- `public.needs.category` is plain text and `required_skills` is text array; `public.app_profiles.skills` is text array. There is no relational taxonomy/subcategory table.
- `private.work_kinds_v5(text[])` folds Latin/Cyrillic variants and maps configurable stems to a **closed, source-coded set of 11** work kinds. Existing registry recognises 'krečenje stana', 'farbanje', 'moleri' as `MOLERSKI_RADOVI`; new alias stems for these eleven kinds are data-configurable, but a twelfth kind needs a function/code change.
- Live `private.worker_need_fit_v1` MD5 `ab221f0091d78856bb42f702ddecd016`: empty `required_skills` makes `service=true` regardless of the task category. PR #6 candidate `d18c47226723ffbbec474aa4547e1af1` fixes this with exact/category-to-kind mapping but deliberately **does not** implement adjacent-skill expansion. Candidate not installed.
- `private.dispatch_cheap_candidate_admitted` consumes this shared match rule; `private.dispatch_tick` and `private.dispatch_next_wave` persist recipients, events and channel deliveries. No alternative nearest-related-competence tier exists.
- 11 October snapshot: 2 active worker profiles, 0 identified moler workers; global dispatch cron runs every minute, mode ALL ceiling 10000, 3 queued needs. Not safe to treat this as a real-world delivery proof.
- Historical `supabase/ADAPTIVE_DISPATCH_DESIGN.md` describes adaptive batch/radius policy but is a 29 August **proposal**, not evidence of today's taxonomy fallback implementation.

## Semantic model: stable work identities, not guessed strings
Introduce (after review, migration and faithful disposable proof) versioned entities:
- `work_category`: stable internal ID/code, display names per language, parent ID nullable, status `ACTIVE | DEPRECATED | REVIEW`, effective version; unlimited hierarchy depth but at most 2–3 shown in UI.
- `work_alias`: alias/stem/language -> category ID; provenance (`CURATED | CONFIRMED_AI_SUGGESTION`), active version, ambiguity and collision checks; alternate scripts/spellings normalised.
- `work_relation`: directed category pair, typed edge `IS_A | CLOSE_SERVICE | NEEDS_SPECIALIST | INCOMPATIBLE`, bounded confidence and curator-approved policy. Parent-child alone is **not** a claim that any sibling is qualified.
- `worker_capability`: account/profile -> category ID, self-confirmed capability level (primary, also-does, conditional), opt-in for adjacent offers and travel radius; do not infer qualification solely from a past click.
- `need_capability`: immutable task-revision snapshot of user-reviewed primary category, optional subcategory, explicit requirements and classification/catalog version. The text and detailed skill requirements remain visible and take precedence over an AI guess.
- `classification_audit`: raw words, proposed IDs, version, confidence bands, ambiguity decision and human correction for debugging; exclude exact addresses and unnecessary private details.

Example (illustrative; not a deployed vocabulary):
`USLUGE_U_DOMU` -> `MOLERSKI_RADOVI` -> `KRECENJE_ZIDOVA`, `GLETOVANJE`, `FARBANJE_STOLARIJE`.
`GENERALNO_ODRZAVANJE` may be marked `CLOSE_SERVICE` to painting **only** for workers who explicitly confirm painting capability. `CISCENJE`, `SELIDBE_PREVOZ` are not eligible merely because they are in the same city.

## Candidate admission: ordered tiers, never a widening of hard constraints
1. **EXACT**: confirmed task subkind or explicit required skills match the worker's self-confirmed capability. Try all nearby/time-admissible exact candidates first.
2. **EQUIVALENT**: aliases, script variation or curator-confirmed synonyms map to identical canonical work ID. This is exact-equivalent, not AI fuzzy guesses.
3. **ADJACENT_OPT_IN**: only for a *curated, versioned, explicitly approved* nearby service relation **and** a worker who confirmed they perform this type of work and opted in to related-task notices. Conservative contact budget, deduplication per need revision and tier; mark copy internally/visibly as “Srodan zadatak” and let worker judge details.
4. **NO_SAFE_CANDIDATE**: durable, observable result `NO_MATCHING_WORKERS` or `ALL_NOTIFICATIONS_DISABLED` / `OUTSIDE_AREA` / `NO_TIME_COVERAGE` / `CLASSIFICATION_UNCLEAR` / `TRANSPORT_PENDING` (distinct causes, not guessed). Notify the *requester within the app* that no relevant worker was reached; offer to clarify category, broaden an allowed radius/term, or share the task. Retain public browse/search visibility. Do not claim push delivery before provider receipt and device verification.

Always retain non-negotiable filters: closed task, execution window, consent / push prefs, inactive/closed/blocked profiles, own task, separation of account worlds, exclusion categories, required identity where supported, time and calendar collision, worker's own maximum travel radius and city/country constraints. No automatic widening of a worker's radius and no bypass of an explicit task required skill or exclusion. Urgency can shorten cadence but cannot eliminate qualifications.

**No fabricated candidates:** if no capable eligible consenting worker exists, zero notifications is the correct safe answer. The product goal is **zero silent failures**, not **zero honest zeros**. Distinguish:
- `candidates_exact`, `candidates_equivalent`, `candidates_adjacent_opt_in`;
- `eligible`, `event_created`, `in_app_created`, `push_queued`, `provider_accepted`, `receipt_confirmed`, `tap_opened`, `application_submitted`.
“Sent” is not “received”, and “no push” can coexist with a visible task.

## Lifecycle and performance requirements
- Classification happens on draft review and publish/revision; the publisher sees “Kategorija / potkategorija” and can correct it. AI is a proposer, server snapshot plus publish confirmation is authoritative.
- On publication: enqueue once; dispatch `EXACT/EQUIVALENT` first. If their admitted count is zero or materially insufficient, evaluate `ADJACENT_OPT_IN` according to bounded rollout policy; do not keep spinning every minute without an observable reason and backoff. If no eligible candidate, store a status and give requester an action.
- Profile changes, new workers, renewed availability and taxonomy version changes can cause targeted re-evaluation of **still-open** needs, never unrestricted re-notify old revisions. Avoid scanning all tasks each tick: indexed capability pairs, area prefilter, bounded keyset paging, version/watermark, idempotency keys for each task revision and recipient.
- Respect current transactional cap (1000 recipient notifications per transaction) and mode ALL/LADDER/remotewave logic; do not add a new unbounded global notifier or silently turn on global push.
- Capture `classification_version` and `policy_version` in a private structured decision record; user-facing explanation may say “Uskačem jer nudim molerske radove i radim u Novom Sadu,” without exposing exact private address or other workers.
- New categories/additional aliases are **data changes gated by validation**, not arbitrary new SQL functions, and must be reviewed when safety-sensitive. Suggest new synonym/subcategory from repeated edits or observed worker selections, but do not self-activate based on a single AI suggestion.
- Operational dashboards should alert on anomalous `zero_eligible_rate`, unclassified tasks, no deliveries after enqueue SLA, high rejection rate, token/push provider failure and backlog. Alerts must separate real no-supply from software failure.
- Feature flags OFF by default, sampled/admission-bounded DEV only after owner authorization; deterministic versioned rollback of catalog/policy and no retroactive fan-out.

## Concrete contract acceptance fixtures (disposable database, no DEV mutations)
| Case | Task | Worker | Expected |
| --- | --- | --- | --- |
| A | Krečenje stana, Novi Sad | Painting/moler, Novi Sad, available | EXACT/EQUIVALENT, 1 event |
| B | Krečenje stana, Novi Sad | House cleaning only, same building | NEVER notified |
| C | Krečenje stana, Novi Sad | Moving only, same building | NEVER notified |
| D | Krečenje stana, Novi Sad | General handyman who explicitly opted into painting and related offers | ADJACENT_OPT_IN with reason |
| E | Krečenje stana, Novi Sad | Painting worker in Belgrade outside own radius | NEVER notified; radius cannot grow without consent |
| F | Unclassified task | Unrelated skills | No wildcard; publisher correction / status |
| G | New category/subcategory added to catalog | Worker opted-in with new capability | Recognised by data version, no SQL code change |
| H | Worker became matching after publish | Still-open task, existing recipients | Notify newly admitted only; no duplicates |
| I | All push toggles OFF, eligible worker present | Worker allows in-app only | In-app if allowed; do not claim delivered push |
| J | Cancelled task, expired window, account closure/block | Any worker | No event, no push, no redirect |
| K | 10k matching workers, many tasks | Worker pool | Bounded tick, lock budget, indexed plan and fair paging |
| L | No eligible workers despite all tiers | Requester | Explicit zero-match status with safe next actions; never spam |
| M | AI chooses ambiguous category, user corrects it | Another revision | Only reviewed category is authoritative; scoped recompute |
| N | Existing event, stale task revision | Push provider delayed receipt | Server denies stale exact-route resolution |

## Implementation order / promotion gates
1. Keep candidate PR #6 category fallback as isolated correctness fix; promote only with separate explicit authorization and safety/DEV E2E proof. Never treat it as semantic expansion.
2. **RFC acceptance first**: agree on whether `ADJACENT_OPT_IN` can generate a device push, or only in-app until worker opts in. Default here: only in-app, no physical push until explicit worker choice.
3. Data-only taxonomy schema candidate; RLS/definer/permission review; seed migration mapping existing 11 kinds and all old skill strings; reclassification review before usage; disposable Postgres proof + rollback + perf at 40k profiles.
4. Read-only categorisation preview and diagnostic counts without dispatch/push; mobile category/subcategory review; explicit worker capability checkboxes.
5. Bounded ranked-tier dispatcher behind OFF feature flag with durable no-match outcomes; synthetic positive/negative fixtures, anti-spam/closure/expiry and exact dedupe proofs.
6. Separately authorized DEV staging with cron isolation, two distinct test accounts and one physical device, preview OTA/proven resolver, verified exact in-app and one recipient push. Never sweep historic backlog or run global tick as a test.
7. Gradual opt-in, operational zero-match and push-delivery metrics, rollback rehearsal, production go/no-go review.

## Owner-friendly definition of ready
A requester publishing "Krečenje stana na Limanu" should see a sensible verified category and subcategory; a moler should receive a single relevant opportunity if available/consenting; a cleaner should not; an opted-in adjacent qualified handyman may see a labelled related opportunity; if nobody can do it the publisher learns that fact and can change a concrete constraint. No silent broadcast, no hidden zero, no fake delivery claim.
