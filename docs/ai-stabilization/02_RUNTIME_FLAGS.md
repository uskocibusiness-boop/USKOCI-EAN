# Runtime flags and latency boundaries

This is a source-and-DEV-evidence record, not a dump of secrets.

| Item | What is proven | What is not proven |
| --- | --- | --- |
| Dual Gemini gate | Source enables it in DEV unless `USKOCI_TAXONOMY_DUAL_GEMINI` is exactly `false`; DEV logs include background architect activity. | The stored secret value was not read. |
| Primary interview | Both active DEV edge versions match the current local source at the audited files. | A real user/device transcript was not generated here. |
| Background classifier | It runs after the durable main response and only for semantic change/pending clarification. Historical samples take roughly 6–9 seconds. | That duration is not requester reply latency. |
| Main completion | Sampled logs show requester `NEED_COMPLETE` and worker `WORKER_COMPLETE` timing. | No per-turn full waterfall is persisted yet for auth, preflight hint, provider TTFT, writer and UI paint. |
| Optional preflight hint | Both edges perform an optional, bounded clarification-hint read before the main turn. | Removing/reordering it is not safe until its value and timeout impact are measured. |

## Interpretation rule

The main interview Gemini needs only compact role/extraction/question guidance plus the current verified conversation state. Deterministic rules remain outside it: auth, revision fence, RSD/EUR and date validation, geocoding, signed work areas, review/save, publication, matching, and RLS.

`8967ee21` adds the missing telemetry names `NEED_BG_ARCHITECT` and `WORKER_BG_ARCHITECT`. It does not change execution order, provider calls, or user-facing behavior.
