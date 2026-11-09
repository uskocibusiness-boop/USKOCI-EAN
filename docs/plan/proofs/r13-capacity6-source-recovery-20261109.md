# R13 — provenance gate for capacity6 recovery, 2026-11-09

**Result: integration BLOCKED on missing source; no SQL or DEV change.** This is a bounded source-recovery proof, not a new plan or claim that R13 is complete.

## Scope and identities

- Active repository: `uskocibusiness-boop/USKOCI-EAN`, branch `work/uskoci-cist-proizvod-20261104`, HEAD `2d8ada07cc4e10616cc9c15619b9d87319cd0479`.
- Read-only older checkout: `C:/Users/user/Desktop/USKOCI-CISTO`, branch `work/rev14-review-f17`, HEAD `d8975895d33dfd0d684f43e09e901e9976fdf8e2`. Existing untracked `.codex-remote-attachments/` was preserved.
- Referenced producing snapshot in the historical consolidation proof: `b20346b1e8e2bcd200c6394379d5826f77a3acee`.
- No runtime, migration, CI workflow, package script, budget, Cron, credential or master-plan modification in this inspection. No paid calls. No DEV query or deploy by this reviewer.

## What was actually found

The active checkout contains the original guarded dispatch/profile and six-phase marketplace candidates. The profile helper **already retains the account tie at an identical cutoff**, and the existing regression checks that the same cutoff cannot replay the profile or rewind the watermark. Reimplementing that fix would duplicate existing work.

The historical `forensic-consolidation-20261109.json` records a newer capacity6 package with INOUT diagnostics and a separate installer mismatch: committed installer profile body `c7ded0820d08f0e3a8d0a27263661753`, corrected candidate/rollout/rollback body `c61e23c67edc2a7592bcd604a845eaf3`. It also preserves a seven-line installer diff. That is evidence about the earlier files, **not the full missing executable package**.

The following checks did not recover that package:

1. Active checkout: no `capacity6*` or `r13_dispatch_transaction*` files.
2. Older checkout: `git cat-file -t b20346b1e8e2bcd200c6394379d5826f77a3acee` failed; object absent.
3. GitHub `GET /repos/uskocibusiness-boop/USKOCI-EAN/git/trees/b20346b1e8e2bcd200c6394379d5826f77a3acee` returned HTTP 404. This establishes current non-retrievability through that request; it does not establish deletion or loss everywhere.
4. GitHub recursive tree for current older-branch remote HEAD `a3623973450130fcf0e770f9ed28f315f366d5b2` contained no matching filenames.
5. Filename searches across this task's directory, Documents, attachments and user files (excluding AppData, node_modules and Git object payloads) found no matching package. Other machines, archives and chats were not exhaustively searched.

## Existing verification reused, not rerun

The local `verification/finish-suite-20261109.log` from this execution already contains **8/8 profile-step** and **5/5 marketplace-wrapper** passes. Relevant source/test files are unchanged from the snapshot that ran those checks; their identities are recorded below. These checks include source-only/ACL denial, 101 tied profiles, exact 30-second cutoff with no replay, 200-Need atomic profile enqueue, eligibility parity, LADDER/ALL behavior, enqueue rollback/retry, invalid watermark/time, six-phase ordering, independent transactions, raw batch forwarding, late-phase rollback/retry and rejection inside an outer transaction.

They are PGlite/local checks with the documented captured/stubbed boundaries. They do not verify the missing capacity6 installer, a full hosted trigger/FK graph, scheduler concurrency on DEV, transport delivery or Android push. No unchanged test was repeated solely to produce another green count. Historical capacity6 33/33 and wake 6/6 reports were not rerun and are not promoted to current-source proof.

| File | SHA-256 of working-tree bytes |
| --- | --- |
| `scripts/sql/r13_dispatch_cooperative_candidate.sql` | `d2d97f4a303b188678e85f69e7e624cce0a0a82b0b360eb0e00b9f7acee26d71` |
| `scripts/sql/r13_marketplace_cooperative_candidate.sql` | `ce4bce60f9dfbe9bc9933073814a1b82f9d362ec9fdd4afe604683ce4303c2a4` |
| `scripts/r13-profile-sweep-fixture.cjs` | `14f6bbcc0131f7bac5d6ff3ca6c84bcff55b4ff09ef27d753ba519e6ec7f2837` |
| `scripts/r13-profile-sweep.test.cjs` | `e7606ff3ac028da1b3cf3469496ad36fc299bf9065be8bb193137a8afb36333b` |
| `scripts/r13-marketplace-cooperative.test.cjs` | `7a10f1c801b095b424827bd9941aa817d79426e11a2fcaa202231442f00b8cf2` |
| `docs/plan/proofs/forensic-consolidation-20261109.json` | `021991d7858012db2a82e4ca41e01a94a1dde03a8b55f5bbdcd29bc0c9c65353` |

## Safe next step

Recover the **exact complete package** from the original producing checkout/chat or a preserved archive: `capacity6_dispatch_split_candidate.sql`, installer `r13_dispatch_transaction_routines_post_r09_20261108.sql`, rollout/rollback, captured preimages, fixture/test runners and their proof manifests. Verify the recorded hashes, apply the already-described cutoff installer alignment to the recovered full source, then test the complete linked package.

Do not synthesize an installer from the historical seven-line diff, rewrite an already-built diagnostics mechanism from its description, or deploy the older active-branch candidate as a substitute. Relevant hosted trigger/FK/ACL, overlap/restart, exact Cron transition and rollback acceptance still precede activation. Other independent AI/mobile/R06 work can continue while source recovery is pending.
