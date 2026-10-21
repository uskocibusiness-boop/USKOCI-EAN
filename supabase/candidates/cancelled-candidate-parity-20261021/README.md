# CCP02 — DEV applied supplement

The newer origin.rollback.sql ran on DEV with triggers enabled and transaction rollback. The exact parity migration 20261021085952 is applied. See docs/current/CANCELLED_CANDIDATE_DEV_20261021.md for evidence and limits. It proves real cancellation from a synthetic 3/3 fixture to 2/3, not real replacement selection or native E2E. The original CCP01 clone-only runner and historical limitations below remain unchanged; do not run that runner against DEV.

# CCP01 — canceled Agreement candidate parity

This is a **source-only, unexecuted database regression** for [forward.sql](forward.sql). It is deliberately outside `supabase/migrations`; neither DEV nor production has received this candidate through this package.

## What the proof exercises

On a disposable current-schema clone that already has the candidate function bodies, [projection.regression.sql](projection.regression.sql) inserts one task requiring three people and four responses. Three responses have active Agreements (`3/3`). The requester reads both `rpc_list_need_candidates` and `rpc_list_need_candidates_page` and sees the selected three. A worker then calls the **real** `rpc_cancel_agreement`; the proof checks the Agreement, selection, and response become `CANCELLED`, `CANCELLED`, and `NOT_SELECTED`, and capacity becomes `2/3`. Both requester readers must now label the canceled response `CLOSED`, never `SELECTED`, while the other two remain `SELECTED`. The worker's own application reader must also say `CLOSED`.

The proof then inserts a **synthetic replacement selection** to restore `3/3`, and checks both requester readers again. This final fixture isolates projection parity; it does **not** prove `rpc_select_response` accepts a replacement under current matching, timing, price, and concurrency rules. It verifies a second authenticated requester cannot read either candidate endpoint. Anonymous access is denied. All proof rows are inside one transaction ending in `ROLLBACK`; the historical canceled Agreement remains present until rollback so the bug is observable.

## Run only on a disposable loopback clone

The runner refuses all database URLs except `postgresql://postgres:…@127.0.0.1:54322/postgres` and does not inherit libpq connection overrides such as `PGHOSTADDR`. A local port can still be forwarded to a remote database, so verify the disposable container or process identity independently before **any** manual application of [forward.sql](forward.sql). The clone must reproduce the current DEV function preimages; `forward.sql` checks their MD5 values. The runner cannot apply that file; after independent clone verification and separate manual candidate setup, it runs only the rollback proof:

```powershell
$env:CCP_DISPOSABLE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
node supabase/candidates/cancelled-candidate-parity-20261021/run.local.mjs --source-check
node supabase/candidates/cancelled-candidate-parity-20261021/run.local.mjs
```

`--source-check` checks file shape and the loopback URL guard without connecting to a database. There is deliberately no `--apply` option or automatic SQL promotion.

The manually prepared candidate function change persists in the disposable clone; the proof fixture does not. Never point this runner at DEV or production.

## Current evidence and promotion gate

On 21 October 2026, this host had no `psql`, Docker, or Supabase CLI on `PATH`, and `127.0.0.1:54322` refused connections. Therefore **the SQL proof has not run**. `node --check` and source-shape checks passed; a local `pglast` parser accepted the candidate (6 statements) and the proof after removing psql directives (49 statements). These are syntax/source checks, not PostgreSQL behavior.

Before promotion: execute this proof on a disposable clone; add a real authenticated HTTP flow with `rpc_select_response` for the replacement, verify both reader ACLs and unchanged closure digest/certificate after applying the candidate, test rollback, then run a signed two-account DEV/Android scenario. Do not claim the `3/3 → 2/3 → 3/3` user journey finished from this projection fixture alone.
