# Regression and E2E evidence ledger

## Reproduced and corrected locally

| Case | Root cause | Fix | Verification |
| --- | --- | --- | --- |
| CI welcome assertion failed after prompt condensation | Test expected a removed long-form sentence. | `0fff6e4c` asserts the current concise copy. | Focused Jest: 5/5; full suite: 621 suites / 14,131 tests. |
| Worker prompt lost functional safety instructions | Condensation removed rules rather than merely shrinking duplicate text. | `8cacf889` restores compact rules for multi-fact patches, related work, city/privacy, and truthful completion. | Worker proofs: 127/127. |
| Background classifier time appeared as `UNKNOWN` | Telemetry vocabulary lacked two active phase names. | `8967ee21` names requester/worker background architecture phases. | Relevant AI proofs: 261/261. |

## Not yet a claimed E2E pass

No test account was used to invoke a real Gemini turn, save an AI draft, publish it, match it, or send a push. Therefore these remain required DEV E2E cases, not completed work:

1. Requester: on-site, remote/handoff, flexible date, EUR, and ready-to-review flows.
2. Worker: city plus signed radius, remote-only, replacement skill list, and save/reopen behavior.
3. Cross-path: semantic change causes one background classifier capture; price/date/address-only edits do not.
4. Publication/matching: a newly published need must carry a canonical `category_id`; inspect the two historical null-category publications before adding any enforcement.

The execution constraint remains: no DEV invocation, deployment, data write, or real notification without explicit approval.
