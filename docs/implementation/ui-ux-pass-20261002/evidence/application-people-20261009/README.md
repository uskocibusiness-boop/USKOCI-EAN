# Application headcount and proportional-price candidate — 9 October2026

Owner requested default1, minus/plus and numeric entry, then expressly chose9000RSD/3people =>3000RSD/person. Source uses one native counter for new/edited applications and the original required headcount for proportional prices. Stored application/Dogovor totals are never divided again; frozen commands retain their bytes.

Source checkpoint:339 tests/11suites, typecheck0. Local PostgreSQL17.11:8925 price vectors (1311 exact results,7614 fractional rejections) plus wrong-price probes. RPC proof uses synthetic direct-DML seeded parties/tasks, then authenticating-role SQL calls with original triggers enabled:1+2partial applications/agreements, actual open-task OVERFILL, wrong/zero/over-required offers, identical/changed replay, staleUPDATE and legacyKEEP. Setup compatibility advances only the isolated clone audit sequence from1 to37. All business fixture rows roll back.

Candidate modifies only private.assert_application_price_v5 TOTAL branch; no new table/function/ACL or stored row. Exact function metadata and all five caller bodies remain unchanged. Both certificate rows, nonnull digests and binding are validated; negative tests corrupt each certificate separately and prove rejection. Full certificate rows, closure source/program digests and readiness are compared in the same transaction; no DEV recertification. The local baseline is a child of the independently audited closure108 fixture; its source literal/certificate translation is pinned to the full local and DEV catalog diagnostic snapshots, which are local fixture compatibility, not a production certificate.

Revert has an executable admission guard and takes table locks before checking: it refuses when a partial TOTAL response version exists. Its successful pre-admission path and refusal after real local partial submissions were executed. After any such admission prefer a compatible forward fix, never delete/rewrite terms to make an old helper fit.

The attached Python/SQL files are the exact historical local harnesses, with SHA pins in receipts; they refer to the retained isolated fixture and local runtime, not a clean-machine provisioning system. No remote connection is used by these harnesses. Current integer-only candidate refuses fractional results; the owner rounding question is pending and this is NOT an approved decision to disallow fractions permanently. No DEV apply/APK/store acceptance is implied.

Primary implementation references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL numeric operators](https://www.postgresql.org/docs/17/functions-math.html). Supabase changelog and17.11 notices inspected; no index/operator changes are in this package.

Independent read-only final review: certificate/admission/replay guards closed; no further blocking findings within this scoped candidate. One QA invocation used five incorrect test file paths (194 tests passed, five file-load failures); corrected invocation retained separately. Rounding remains pending.

## Superseding owner decision and DEV application

Owner chose nearest whole-dinar rounding. Current candidate uses round(total × application headcount / original required headcount), once per application. The earlier exact-only candidate is historical.341 source tests/11suites + tsc0; both client and SQL cover8925 vectors with independent integer oracle (8041valid,884round-to-zero refusals under existing positive-price rule). Local real SQL RPC additionally selects3333+6667 for10000/3 and refuses6666.

Applied on canonical DEV as20261009153350, ledger236→237; exact stored statement MD5=d5295a26e190a78d8ceeadb685208641, candidate SHA=759db115d465f1edb7bd82c850dd1057c768d135bb345210952ebbb7947249c3. Helper metadata/ACL/comments, five callers, full certificates/binding and readiness unchanged; read-only DEV amount probes passed; advisory groups unchanged. See ledger receipt. No live business-row changes, push or new phone release. The9fc70507 internal APK was built/attested but superseded before installation by the rounding decision; next build contains the final rule.
