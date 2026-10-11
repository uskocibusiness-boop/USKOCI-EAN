# USKOČI RFC — Growing work taxonomy and zero-match escalation (11 Oct 2026)

**Status:** SOURCE-ONLY DESIGN PROPOSAL, NOT IMPLEMENTED, NOT APPROVED FOR LIVE. No SQL/Edge/provider/cron/push is executed by this document. This does **not** replace the separately tested one-function AI-category fallback in PR #6.

## Product requirement: automatic growth, owner clarification 11 Oct 2026
**Supersedes the earlier human-curator gate for every novel category.** The catalog starts with the existing eleven work kinds but has NO upper bound on new kinds or subkinds. AI must not squeeze unfamiliar work into an unrelated one of eleven buckets. When a suitable existing identity exists, attach the task to it; if no suitable identity exists, atomically create a new **automatically admitted, provisional** identity, immediately visible/searchable and reusable for other tasks. A human is not needed to approve each ordinary new category. Human correction remains available, never an operational bottleneck.

The growth mechanism must not equate "published" with "push sent". A new category can be real and available for browse/search immediately while still having zero qualified opted-in workers; that state must be visible rather than masked by broadcasting to nearby unrelated people. Semantic connections are suggestions, not proof of a worker capability. Ensure zero **silent** no-matches, not a false guarantee of at least one recipient.

**Live scope:** No runtime taxonomy tables or automatic registration are deployed; this is a source-only architecture request, with separate migration and E2E approval required. Existing closed 11-kind matcher is not this design.

### Verified current state (read-only, canonical DEV)
- `public.needs.category` is plain text and `required_skills` is text array; `public.app_profiles.skills` is text array. There is no relational taxonomy/subcategory table.
- `private.work_kinds_v5(text[])` folds Latin/Cyrillic variants and maps configurable stems to a **closed, source-coded set of 11** work kinds. Existing registry recognises 'krečenje stana', 'farbanje', 'moleri' as `MOLERSKI_RADOVI`; new alias stems for these eleven kinds are data-configurable, but a twelfth kind needs a function/code change.
- Live `private.worker_need_fit_v1` MD5 `ab221f0091d78856bb42f702ddecd016`: empty `required_skills` makes `service=true` regardless of the task category. PR #6 candidate `d18c47226723ffbbec474aa4547e1af1` fixes this with exact/category-to-kind mapping but deliberately **does not** implement adjacent-skill expansion. Candidate not installed.
- `private.dispatch_cheap_candidate_admitted` consumes this shared match rule; `private.dispatch_tick` and `private.dispatch_next_wave` persist recipients, events and channel deliveries. No alternative nearest-related-competence tier exists.
- 11 October snapshot: 2 active worker profiles, 0 identified moler workers; global dispatch cron runs every minute, mode ALL ceiling 10000, 3 queued needs. Not safe to treat this as a real-world delivery proof.
- Historical `supabase/ADAPTIVE_DISPATCH_DESIGN.md` describes adaptive batch/radius policy but is a 29 August **proposal**, not evidence of today's taxonomy fallback implementation.

## Semantic model: an open-ended, automatically growing catalog
Introduce versioned entities, after isolated migrations and tests:
- `work_category`: immutable internal UUID, globally unique normalised identity key, open-ended parent UUID (may be null), localized display names, created-by `AI | SYSTEM | REVIEWER`, state `AUTO_PROVISIONAL | ESTABLISHED | RETIRED`, catalog version, task-use counts and lineage to replacements.
- `work_alias`: normalised alias/script/language mapped to one category ID with unique collision protection and provenance. Recognise "krečenje"/"krecenje"/"кречење", but never merge merely because strings look alike.
- `work_relation`: versioned directed edges `PARENT_OF | EQUIVALENT_CONFIRMED | RELATED_SUGGESTED | RELATED_CAPABILITY_CONFIRMED | INCOMPATIBLE`. Relations are not interchangeable. `RELATED_SUGGESTED` is NEVER a push entitlement.
- `worker_capability`: explicit worker-selected (or worker-confirmed AI interview) categories/subcategories, capability-specific confidence and opt-in for *related* opportunity suggestions. An AI inference about a worker alone cannot authorize physical notification.
- `need_capability`: user-reviewed task snapshot of proposed category/subcategory/required_skills and matching policy/catalog version per need revision. Explicit required skills take precedence over inferred descriptions.
- `classification_audit`: task revision, candidate IDs, confidence, automatic-create or alias decision, model/prompt/catalog version, correction and duplicate-merge receipts. No raw private exact address or worker identity leakage.

Example open hierarchy (illustrative, NOT hardcoded as the universe):
`KUCA_RENOVIRANJE` -> `MOLERSKI_RADOVI` -> `KRECENJE_ZIDOVA`, `GLETOVANJE`, `FARBANJE_STOLARIJE`.
If an owner publishes a new legitimate job ("montaža pametne brave", "podešavanje 3D štampača", "popravka solarnih panela"), the system creates an appropriate new branch or subbranch rather than mapping all of them to `SITNE_POPRAVKE`. The parent may be **unset** when ambiguous; do not invent a false relationship to satisfy a tree UI.

### Synchronous classification and auto-creation state machine
1. AI proposes a **plain-language work meaning** (action + object + domain), supporting optional primary, subcategory, explicit skills and 1–N candidate relations; server fetches plausible existing categories by alias/full-text and semantic index (vector similarity only for *retrieval*, never authorization).
2. First exact alias/canonical match; if multiple conflicting matches, ask the owner to correct the proposed job meaning at review. Then consider model-assisted semantic equivalence with a conservative calibrated confidence threshold *and deterministic evidence/identity checks*; a merely similar task is not necessarily equivalent.
3. If **no defensible equivalent** exists, `CREATE_AUTO_PROVISIONAL` in one authenticated bounded transaction: ensure a normalized identity key, check collisions/uniqueness under concurrency, create category and alias, optionally attach a proven parent, record audit and return stable ID. This does **not** require operator or human moderation for ordinary work. Repeated simultaneous first tasks must reuse the same category rather than create ten copies.
4. The category is immediately usable for task classification, listing, search and future new worker capability selection. `AUTO_PROVISIONAL` means new/unproven *matching semantics*, **not** hidden or forbidden to publish. Do not promote to `ESTABLISHED` solely due to a model assertion; consolidate on repeat use, independently confirmed associations or later worker/owner corrections. Autocomplete and display must not make new leaf nodes inaccessible.
5. AI may propose merges, splits and additional synonym aliases; apply only reversible, audited, collision-safe transitions with confidence/evidence policies. Safe automated alias growth is allowed when independently verified; never silently redirect historical need revisions or retroactively send notifications. The task author can correct a bad classification, causing a new revision.
6. Bad/empty/abusive labels, unsafe tasks or ambiguous claims yield `CLARIFY_CLASSIFICATION` or content safety review, **not** unchecked catalog pollution. An interrupted AI analysis must not fail the publication path silently: persist an unresolved classification state with a clear owner action, never make a wildcard.

An infinite *number* of categories is the design goal, **not** unbounded compute or unlimited unsolicited notifications. Apply rate limits, minimum quality constraints, low-cost duplicate checks and versioned candidate paging; garbage/double entries are detected and merged without losing audit/history. AI can update the interpretation of new words as the marketplace grows, but real worker skills and privacy restrictions remain authoritative.

## Candidate admission: growable tiers, never weaker hard safeguards
1. **EXACT**: confirmed task kind or explicit requirements match worker-confirmed capability.
2. **EQUIVALENT**: cross-script spelling, proven synonym or same meaning maps to one stable canonical identity; this is not broad fuzzy matching.
3. **ADJACENT_CONFIRMED**: category is new or lacks exact supply; consider versioned nearby capabilities only where worker has **confirmed ability to perform that task** or accepted a clearly labelled related-work opt-in. Relatedness itself cannot stand in for competence or worker consent. New catalog IDs without worker equivalents do not magically identify qualified recipients.
4. **NO_SAFE_CANDIDATE**: observable `NO_MATCHING_WORKERS`, `ALL_NOTIFICATIONS_DISABLED`, `OUTSIDE_AREA`, `NO_TIME_COVERAGE`, `CLASSIFICATION_UNCLEAR`, or `TRANSPORT_PENDING` with a requester-visible correction/action. The task stays browseable for new workers. Never call zero matches a successful delivery.

Always retain hard constraints for open status, time, person/world/closure/block, own task, verified identity where supported, profile exclusions, availability and calendar, *worker-approved* radius and consent. Urgent flags do not loosen ability/identity. Do not silently broaden the worker's chosen area. Do not broadcast a new category to all profiles with the same parent.

## Lifecycle and performance requirements
- Classification happens on draft review and publish/revision; automatic category/subcategory registration is a bounded, idempotent server operation at publish if no defensible existing match exists. The publisher can correct the suggestion; the signed-in publish/revision transaction is authoritative. A worker interview similarly lets the worker confirm any new capability instead of being limited to 11 checkboxes.
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
| O | Legitimate novel job not among eleven kinds | First publisher | Auto-create stable provisional category, publish/search now, no wildcard delivery |
| P | Same unknown job published simultaneously | Two owners | One canonical ID/alias, idempotent race-safe upsert |
| Q | Same meaning with changed Cyrillic/Latin diacritics | Later publisher | Existing ID reused, no duplicate |
| R | Semantic lookalike but different skill ("popravka brave" vs "podešavanje digitalne brave") | Non-specialist worker | Do not equate work without evidence; no unrelated push |
| S | New category, worker interview confirms it later | Qualified worker | New relevant open needs considered, no duplicate to old recipients |
| T | Model generates nonsense or ambiguous category | Any publisher | Clear correction/safety state; no catalog spam or broad push |
| U | New branch or subcategory | Existing task and worker records | Historical revision stays pinned; no retroactive notification blast |
| V | AI gets two semantically ambiguous candidate parents | Any task | Create honest provisional root or request correction; no forced parent |


## Implementation order / promotion gates
1. Keep separately tested PR #6 immediate AI-category fallback as an **interim correctness repair**. It does not satisfy auto-growth.
2. Automatic taxonomy is the default architectural decision: no fixed list and no mandatory manual category approval. Confirm only *notification-consent policy* separately: adjacent suggestions default to in-app unless worker opted into this precise push category.
3. Implement a data-driven registry and versioned category/alias/relations, with automatic `CREATE_AUTO_PROVISIONAL` and transaction-safe duplication prevention. Keep private write APIs, RLS/SECURITY DEFINER audit and conservative abuse protection. Do not edit existing production schema now.
4. Isolated deterministic source tests plus disposable Postgres proof for new/duplicate/synonym/ambiguous/unsafe categories, rollback and 40k-profile performance. Model-assisted semantic proposals are not independently trustworthy test fixtures: include deliberately ambiguous/adversarial output.
5. Build user correction and worker self-confirmed capability flows, then bounded tiered dispatch with explicit reasons for zero matches, category versioning and per-worker consent; feature flags remain OFF.
6. After separate explicit approval: dedicated DEV rehearsal isolates existing cron/backlog, verifies two test identities, real exact/nonmatch/adjacent capability, zero-match requester feedback, one authorized device and one provider push. No global real-world broadcast.
7. Reversible staged rollout with rate-limit/duplicate/incorrect-category dashboards and measurable no-match metrics. Registry growth may be automatic; broadcast privileges remain deliberately non-automatic.

## Owner-friendly definition of ready
A requester publishing "Krečenje stana na Limanu" should see a sensible verified category and subcategory; a moler should receive a single relevant opportunity if available/consenting; a cleaner should not; an opted-in adjacent qualified handyman may see a labelled related opportunity; if nobody can do it the publisher learns that fact and can change a concrete constraint. No silent broadcast, no hidden zero, no fake delivery claim.

**Automatic catalog-growth acceptance:** Publishing a *novel* legitimate task should create a reusable provisional category in the same safe transaction with zero forced mapping into the initial eleven. The category must become immediately discoverable, and a worker may later confirm that exact skill. This categorization result does not assert an available worker or successfully received push.
