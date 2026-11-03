# Historical second-provider fixtures

The `.mjs.txt` files retain source from `24ecfca443141027365c62edf55c3859842d8e2e`, normalized to LF with trailing whitespace removed. They are historical evidence, not executable acceptance of the current one-response architecture.

| Retired mechanism | Current acceptance |
| --- | --- |
| Separate provider budget and lifecycle | `background_provider_budget`, `background_completion_lifecycle`, `single_pass_edge`, `complete_first_plan_transport`: one provider, owned completion, cancellation, UNKNOWN accounting and lost ACK. |
| Split capture/readback after completion | `single_pass_edge`, `r06_first_plan_completion`: atomic conversation/catalog completion and exact readback. `background_capture_receipt` still executes advisory clarification store/readback, wrong-owner/revision/content rejection, timeout and nonfatal diagnostics. |
| Background JSON provider transport | `background_provider_transport` executes both current handlers over SSE; `gemini_wire_diagnostics` checks late headers, abort and bounded error details. JSON `Content-Length` rules for the removed second request are obsolete; decoded byte, UTF-8, STOP, truncation, error and no-repeat controls remain. |
| Paid decision cache, TTL and LRU | No such decision cache remains. `background_novel_decision_cache` checks current-input isolation, catalog target/anchor changes, multiple services and typed handoff without model/network calls. The separate catalog and clarification caches are not removed. |
| Tool paging, direct/shadow fallback and split hints | `classification-full-catalog-edge` checks the complete 131-node snapshot in one request, private IDs, new child/root plans, missing/forged/duplicate decisions, readiness copy, modes, physical handoff and saved identity continuity. `single_pass_continuity` retains removal, BOTH, changed-mode and multiple-service negatives. |

Catalog freshness is enforced by the atomic SQL anchor check, covered by `r06_first_plan_completion` and `r04_single_pass_readers`; it no longer depends on a second `META` request. An AI-selected real category ID does not require an exact global alias match. Conflicting saved identities, fabricated IDs, consent and mode checks remain guarded.

Map confirmation and private address behavior remain covered by the active location/Need stream suites and LOCATION SQL cases. This cleanup does not establish hosted Auth, native behavior, provider semantic accuracy, export/erasure completeness or release readiness. None of the retired cases counts as a current PASS.
