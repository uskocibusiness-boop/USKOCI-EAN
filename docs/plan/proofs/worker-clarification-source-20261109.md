# Worker clarification repair — 2026-11-09

Source-only repair following the phone test against the new preview APK and
Worker DEV 150. No deployment, paid call, profile Save, migration or mobile
change was performed by this repair.

The Worker proposal builder now distinguishes services without any validated
current or owned saved/draft execution choice from provider/catalog failures.
For the first such service, the final assistant response names that service and
asks whether the person works on site, online or both. A validated concrete-work
clarification still takes precedence. Invalid fresh declarations and conflicting
prior identities do not become a request to repeat an already supplied mode.

The Worker instruction also requires clarification of a genuinely broad offer,
preserving its original label and all independent facts. It does not infer a
narrower service or remove the old offer. Equivalent new offers may be expressed
as one specific natural addition preserving all stated work; this instruction
does not merge already persisted services.

Validation: **88/88 tests PASS**, zero skipped/cancelled, with:

```text
node --test scripts/ai-classification-feedback.test.cjs scripts/conversation-intent-integration.test.cjs scripts/conversation-intent-server.test.cjs scripts/taxonomy-compact-bypass.test.cjs
```

`npx tsc --noEmit --pretty false` also completed successfully with no diagnostics;
the changed-file diff passed `git diff --check`.

The actual Edge-handler harness uses the phone's first user utterance with
controlled provider output, synthetic catalog/legacy context and mocked SQL.
It retains five existing plus two new services, retains the explicit absence of
a van, preserves independently supported new mode proposals, asks specifically
about courier work, then accepts `Na lokaciji.` only for that service. The next
question names the next unconfirmed service. This proves the server wiring and
existing quote binding; it does not prove live-model behavior or resolve the
real SQL collision. Local log: `../verification/worker-clarification-source-20261109.log`.

## Remaining live legacy-draft blocker

The subsequent real phone turn supplied explicit modes, but both `Kurirske
dostave` and `Nabavka i kupovina` mapped to the same category/mode. The unchanged
live resolver and batch contract reject that duplicate with `CATALOG_CONFLICT`.
The separate broad `Fizički poslovi` label requires concrete-work clarification.
See `worker-catalog-conflict-20261109.md` and its exact SQL fixture.

No automatic normalization or metadata-only deduplication was added. The signed
review requires consistent candidate services and per-service proposals; dropping
only one proposal would break that contract. Joining original labels without
checking each original also risks bypassing exact-label safety triage. A valid
catalog ID/alias does not prove original-label safety, and no existing read-only
public RPC supplies that per-original triage proof. A future bounded solution
must preserve descriptions, owned bindings, full mode/handoff sets and those
safety checks. The existing failed draft is preserved and is **not repaired** by
this clarification change.
