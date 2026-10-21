# F01 current DEV extension — 21 October 2026

Main agent applied `migration-with-proof.sql` to DEV `leqcwgzvjsxugfgzdmth` successfully. The embedded rollback assertions passed. Parent owns the exact migration ledger/name.

## Confirmed scope

- 24 existing functions extended, 14 private helpers, 40 owner/closure guards over 20 AI/taxonomy/archive relations.
- Actual readback: 96 redaction relations and 73 export datasets.
- Handoff data included in worker modes, historical reset projection and owned Need requirements export.
- Existing closure/hold/owner restrictions remain; helpers have no PUBLIC/anon/authenticated/service_role execute grant.
- Runtime assertions proved owned export includes owner canary/handoff, excludes peer and opaque lease; all 20 additions return a concrete erasure patch; scoped hold, closing-owner write and owner-change checks enforce barriers. All fixture rows rolled back.
- No retention-policy activation, external export delivery, persistent certificate change, Storage operation or Auth deletion occurred.

## Exact predecessor repair

First apply refused `public.need_requirement_details`, atomically. Cause: readback used default search_path while migration explicitly uses pg_catalog. FK names and geography type text differ by search_path. Re-captured exact table metadata under pg_catalog, retained every guard, regenerated, then tested the **literal migration prefix** with same BEGIN/SET LOCAL/preflight and ROLLBACK successfully before parent reapplied.

Generator: `python rebase.py`, `node build.mjs`, `node build.mjs --check`. Historical F01 and previous subset candidate preserved unchanged. Canonical candidate SQL uses LF. `migration-with-proof.sql` is candidate without final COMMIT, then `proof.sql`, then COMMIT.

## Remaining gate

Readback after application: source `caf054295faeb2912b3fc538b7ba23e1dfbc62027d64a98299cc87ced02acbde`, readiness false, binding null. Source changes from other active packages can change that hash again. The ten structural readiness predicates passed under pg_catalog; source digest equality remained false. No blind digest rebinding performed.

`executor-rollback-proof.sql` is a separate TEST ONLY candidate. It provisionally binds current source within an always-rolled-back subtransaction, calls real authenticated prepare/review/start and service relational executor, and refuses fake external Auth completion. It neither admits current source permanently nor proves Storage/Auth integration. Its run status is recorded separately after parent execution.

Final admission must freeze all area/group/review changes, review the source/data-copy roster, pass actual executor proof, then use exact guarded forward certification. Real Auth/Storage adapter smoke remains necessary on a disposable account before claiming complete closure.
