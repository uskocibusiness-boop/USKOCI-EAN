# MATCH-V1 + DISCOVERY-ZAMENE disposable proof

Run by `.github/workflows/match-v1-discovery-zamene-proof.yml` (push to `candidate/match-v1-20261007` on these paths, or `workflow_dispatch` once the file is on the default branch). Loopback database only; no DEV, provider, device or push.

1. `check_source.py` — both generators byte-exact (`--check`), every SQL file, DO block and function body parsed (pglast 8.4), rule boundaries: no tool/vehicle/experience/fee gate, no `40001`, no trigger/table/policy/index statement.
2. `chain.mjs` — live79 → source147 → PKG027…PKG042 → PKG042a…PKG050a → Discovery P0 → PKG045b (P0) → P6 rollout v3 → EX04d → EX06a → EX06b → WPP01 → EX06e R2 alignment → EX06e R3, in canonical DEV order.
3. `fidelity.mjs` — the 23 relevant bodies equal the captured DEV bodies (only an exact B24 `40001`→`PT409` conversion is admitted). Bounded relevant-body fidelity, not global DEV equivalence.
4. `runtime.proof.mjs` — real Auth + PostgREST: BEFORE (DEV bodies: the old gates hold), drift and order refusals (atomic), MATCH-V1 applied (every case flips), DISCOVERY-ZAMENE applied ("Za mene" = exactly the rule set, default unchanged byte for byte), exact reverts (catalog and certificate restored), REVERTED (old behaviour again).
