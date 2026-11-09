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

## Historical legacy-draft blocker before shared-reuse promotion

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

## Follow-up: owned mode history and a concrete service explanation

After the separately recorded shared-reuse SQL promotion, Worker 151 still
asked about courier execution again when the user clarified `Fizički poslovi`.
The owned SQL context at revision 3 had empty saved/draft modes and all seven
services unresolved. Its prior hint was DEFERRED; the resolved-hints view emits
no proposals for it, and a turn without a plan advances the source fingerprint.
The earlier explicit USER answer still existed in conversation history. The
Edge builder accepts only current saved/draft choices or quoted mode metadata,
so omitted metadata became the named-service fallback question.

The SOURCE follow-up changes only the Worker provider instructions:

- Missing validated mode metadata is distinguished from an unanswered human
  question. The same paid response must reconstruct complete per-service mode
  sets from owned USER history with original quotes, respecting later changes
  and the scope of historical group answers. Old rejected category IDs remain
  untrusted; all proposed identities are classified and checked afresh.
- A current concrete explanation of an existing broad service uses the existing
  scoped `serviceChanges.REPLACE` contract with current-user evidence, then
  classifies the replacement. Other services remain unchanged. This does not
  authorize stylistic renaming or guessing a narrower activity.

There is no new parser heuristic, SQL reader/writer, inference call or relaxed
authority check. The actual Edge harness uses both exact phone utterances,
revision 3 with empty mode context, controlled provider output and the captured
catalog identities. It retains six unrelated labels, replaces only the explained
broad label, captures seven fresh proposals, preserves REMOTE/ON_SITE and the
explicit absence of transport, and does not ask for courier mode again. Negative
cases reject assistant-only/invented evidence and use of a historical quote to
authorize a current service rename. One reserve/dispatch/model/completion path
is asserted; no Save or activation is issued.

The same four-file focused command above now passes **92/92**, zero skipped;
`npx tsc --noEmit --pretty false` passes with no diagnostics. This is a prompt
and guarded-handler regression, **not proof of natural provider recovery** and
not a new DEV/phone result. The separate phone repeat that explicitly restated
the modes is not counted as natural-history recovery.

The phone also exposed a prose mismatch: SQL can resolve a fresh semantic plan
while the earlier Edge text says the review is not ready. A bounded follow-up
now uses `Podaci iz razgovora su sačuvani.` only when a capture plan exists,
there is no clarification/failure/missing mode, and every unresolved service
has a retained REUSE_EXISTING or EXTEND_MODE proposal. The builder already
removes incomplete or conflicting mode sets before this boundary. The reply
acknowledges durable conversation data after completion; it claims neither
READY nor profile Save/activation. Actual missing-plan/validation failures keep
their existing fallback, and real answers/questions retain priority. Positive
and negative tests exercise that distinction; the signed SQL review remains
authoritative. This text correction is SOURCE-only until separately deployed.
