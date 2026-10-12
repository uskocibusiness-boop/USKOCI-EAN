# USKOČI — Verified hierarchical service coverage, phase 1 (12 October 2026)

**Status: source-only candidate on isolated branch, not an active DEV/PROD matcher.**

## User-defined product rule

AI interviews must interpret *the work itself*, retrieve relevant existing catalog service identities, and prefer a reusable existing identity. Do **not** try to solve semantic understanding by filling a database with thousands of synonym strings. An operator-curated initial catalog should contain real, distinct, meaningful services; variants of phrasing, spelling, city and quantity are *task attributes*, not new service identities.

Examples:
- “moleraj” and “krečenje dnevne sobe” do not automatically produce new catalog entries on each utterance.
- A task may be classified as **Krečenje** under **Molerski radovi**.
- A worker who explicitly confirmed **Molerski radovi** may receive the ordinary standard **Krečenje** child **only once the specific parent→child coverage has been verified in catalog policy**.
- “Specijalna dekorativna tehnika” is not automatically included merely because it lives in the painting family.
- “Fizički poslovi” is not proof of competence to buy tickets in a second city or handle every kind of delivery.
- Buying tickets “in another city” is the same type of service as buying tickets locally; city, urgency, transport and payment are task parameters. Payment/regulated and abuse risks must be checked separately.
- AI suggestions of possible worker services are not worker confirmation: ask the worker what they actually offer and respect explicit exclusions.

## Existing DEV facts (read-only confirmed, 12 October)

14 established **root** categories (11 ON_SITE + 3 REMOTE), 0 children, 0 aliases, 0 worker taxonomy confirmations, 0 category-specific task snapshots, 0 verified cross-category relations. Auto registration OFF. Current canonical `private.worker_need_fit_v1` still matches `needs.category` to profile skills with the legacy work_kinds registry, **not** the hierarchical evaluator in this candidate. The existing `private.taxonomy_capability_tier_v1` supports exact, equivalent and worker-consented related, but did not inherit verified standard descendants.

## Implemented, additive, source-only candidate

- `verified-standard-inheritance.sql` provides a dedicated **operator-confirmed standard coverage edge** with a documented evidence reference and a true direct parent / matching execution mode check.
- Category parent IDs are immutable in this candidate: cannot silently re-parent a service or form a cycle. Previously published IDs and existing user/task records are not touched.
- A parent capability grants *only* reviewed, uninterrupted, established descendant paths. Both category and worker task capability must be confirmed; specialist, unreviewed, retired, mode-incompatible or unrelated work never inherits.
- Target *and intermediate* worker exclusions override parent coverage. The requested primary category plus **every** explicitly mandatory competency is checked.
- Existing `taxonomy_capability_tier_v1` and `worker_need_fit_v1` remain unchanged. The new evaluation is `taxonomy_capability_tier_inherited_v1`, service-only and **not called by live dispatch**; category matching alone is never a push entitlement.
- Verified standalone PostgreSQL CI workflow targets both 16 and 17 with solely synthetic data. No user data, paid AI, Supabase credentials, actual worker writes or push.

## Executed source-only deliverables

- **82 total curated categories/service identities** under two real execution roots: existing 14 seed roots, 1 new ON_SITE everyday-help root, 5 intermediate categories, 62 new distinct service leaves; the seed registers **zero** aliases/synonym strings. Same-city and other-city ticket purchasing share a single `Kupovina karata` identity, not one identity per place.
- **6 operator-reviewed standard child-coverage links** allow ordinary moler, cleaning, ironing and garden tasks while intentionally not granting generic physical work, specialist electrical work, unrelated errands or decorative craft competence.
- `taxonomy_ai_catalog_context_v1(mode,limit,after)`: read-only stable paginated catalog context for future Gemini/worker interview, returning real IDs, parent chain, root scope, catalog version and explicit **NO AUTHORITY** flags. Pagination is max 100 records; cross-mode/invalid ancestry fails closed rather than silently exposing a wrong path.
- `public.rpc_taxonomy_ai_catalog_context_service`: read-only service_role-only PostgREST wrapper, no anonymous/authenticated access.
- Both synthetic PostgreSQL 16 and 17 jobs install the *actual* source candidates and verify the two roots, multi-level paths, eligibility, no alias inflation, opt-outs, permissions and failure on second install.

The read-only catalog context is **not an AI model**, a semantic embedding search service or production classifier. The current paid provider is **not called** in this phase. The exact Gemini-driven candidate retrieval and real human confirmation are still part of the following integration phase.

## Fail-closed, future work needed before any live activation

1. Curate a substantial **service identity** catalog, with reviewed semantic definitions and parent relations, *not a dictionary of synonyms*. Avoid assigning unrelated everyday tasks to an imprecise root purely because no root exists.
2. Gemini retrieves a limited set of relevant server-owned candidate category identities and structured service intent; a server resolver verifies mode, action and object, ambiguity, existing identity, classification version, safety and the exact requester-owned draft revision. AI-created IDs are ignored.
3. Only **genuinely new** service identities can be proposed; unique DB canonical key + approved parent + atomic mode binding + audit prevents duplicates. Safe, bounded provisional admission requires dedicated server authorization, with ambiguous/regulated content going to review; current global auto-create switch stays OFF.
4. Worker interview proposes a short **meaningful** set of nearby service families and concrete tasks, records explicit inclusion/exclusion and execution mode consent via authenticated owner-bound review/save/activate. Do not infer confirmation from AI hints or historical free text.
5. Integrate the one ranked catalog capability evaluator into **both** `Za mene` and dispatch with all canonical hard checks (geo/time/world/identity/account/availability/consent/capacity/exclusions), no parallel matcher, no fallback blanket. Exact one-device push and phone testing are separate gated proofs.
6. Before promoting any SQL to canonical DEV, compare exact current schema/function hashes, run disposable full matcher test and idempotent/revert proof, approve migration, re-read installed definition and prove the actual product E2E on HONOR.

**Rollback principle:** rollback feature evaluation, keep catalog IDs and history. Never blanket-match a family or reclassify existing tasks without user review.
