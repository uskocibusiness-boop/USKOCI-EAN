# REV10 / REV14 first implementation slice

Continuation and current R01–R12 status are maintained in the same [CODEX_PLAN_RADA.md](../plan/CODEX_PLAN_RADA.md#112a-aktuelni-izvršni-status--28102026). This file records the historical 2026-10-27 slice only; it is not a separate plan or the latest R01 implementation status.

Base: `a9692e11942609bab9406215c3e407d79589dafa`, `uskocibusiness-boop/USKOCI-EAN`, `feature/uskoci-cisto`. Local working branch: `work/rev14-review-f17`. Original user packages remain the reference: REV10 is the R01–R12 operational plan; REV14 is the target UX architecture and is not implementation evidence.

## F17: useful, bounded Discovery read failures

The legacy Discovery route previously converted a boolean error flag to the visible text `true`. The shared resource discarded the original reason, and the error UI always attributed failure to the internet connection. The resource now retains only a finite category alongside the compatible boolean. The route and presentation pass that typed category to the list state. UI copy uses formal address and distinguishes authentication, access, transport, timeout, contract and unknown failures without rendering provider prose, SQL details, URLs or stack traces.

Existing account/revision/focus/generation guards, cancellation, coalescing, retained refresh data and successful readback semantics remain in place. Retry still invokes the guarded read. This does not implement MAP/PLACES compatibility, fix partial map failures or close R02 as a whole. It is a local source/test improvement, with native and deployed behavior still unverified.

## R01: current metadata evidence

`supabase/proofs/privacy/r01_read_preflight.sql` captures only metadata in a read-only transaction. It was executed on confirmed DEV `leqcwgzvjsxugfgzdmth` on 2026-10-27; all 21 named functions existed. `authenticated` still had table SELECT and effective access to `requester_account_id`, `remaining_search_closed_by_account_id` and `remaining_search_close_reason`; anon did not. No application rows were read or written.

After inspecting the invoked closure function chain, a separate read-only status check confirmed `retention_ai_source_ready=false` and no current erasure binding. Both source certificates existed but did not match the current digest. These are pre-change facts; no ACL migration, digest rebind or deployment was performed. Export binding was not invoked and remains unverified in this slice.

F21 remains open until a reviewed explicit public-column boundary passes current synthetic Auth/PostgREST negative and positive controls without breaking legitimate readers. A catalog snapshot, local unit test or blanket permission failure is not that proof. See the privacy proof README for the concrete continuation.

## Validation

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed.
- Focused Jest: 8 suites, 347 tests passed in two disjoint runs (5 suites / 62 tests; 3 suites / 285 tests). Commands use `node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --silent --runTestsByPath` with the selected paths. The first run without `--detectOpenHandles` hit Windows `spawn EPERM` before running tests; serial execution required no project config change.
- Independent review checked error wording, typed propagation, retry and account/focus ownership. Contract wording must cover both response decoding failure and request rejection before rows are returned.
- Existing installed dependencies were reused with the unchanged package-lock; no new dependency installation or update.
- No native build, physical-device run, live AI calls or external deployment in this slice.
