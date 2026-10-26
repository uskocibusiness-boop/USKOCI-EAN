# DEV database evidence — aggregate, read-only

**Scope:** Supabase DEV `leqcwgzvjsxugfgzdmth`, 2026-10-26. Queries used aggregate schema/count data only; no account identifiers, message text, addresses, or coordinates were recorded.

| Evidence | Result | Meaning |
| --- | ---: | --- |
| `private.work_taxonomy_categories` | 153 rows, all `ESTABLISHED` | The active canonical catalog is present. |
| `public.needs` with `PUBLISHED` status | 8 with `category_id`, 2 without | Real integrity signal: the publication/matching path needs a focused provenance audit before any repair. This does **not** prove the current AI publication path created the two nulls. |
| `public.needs` with `DRAFT` status | 10 with `category_id` | Current data contains categorized drafts. |
| `public.ai_conversations` | NEED_INTAKE: 60 open / 32 completed / 16 abandoned; PROFILE: 7 open / 16 completed / 19 abandoned | Both conversation purposes are live in DEV. Counts are a snapshot, not a success-rate calculation. |
| `private.classification_turn_hints` | 2 consumed rows | Revision-scoped hint persistence is in use. Labels and message content were intentionally not retained here. |

## Migration provenance boundary

DEV records current logical AI migrations under different historical version labels from this working tree. The local manifest/provenance evidence added in `0fff6e4c` marks these as `APPLIED_RECORDED_BYTES_DIFFER`.

That classification means exactly this: a related DEV change is recorded, but local bytes must not be re-run, renamed, or treated as a proven semantic duplicate. Any future database repair must be a new append-only migration after a fresh function/table preimage. No migration was applied during this stabilization work.

## Deferred measurements

The pending-review view did not return within the bounded CLI collection window. It is recorded as **not collected**, not as zero or healthy. Investigate its query plan/definition separately before treating it as a runtime incident.
