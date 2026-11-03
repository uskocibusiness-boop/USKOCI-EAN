# R05 indexed saved-area retrieval — LOCAL_ONLY candidate

Run local source/control-flow checks:

```sh
node --test supabase/proofs/ai/r05_saved_area_retrieval.test.mjs supabase/proofs/ai/r05_saved_area_postgis_runner.test.mjs
```

Run the actual PostgreSQL 17.6/PostGIS 3.3.7 proof with local Linux Docker:

```sh
node supabase/proofs/r05/run_saved_area_postgis_proof.mjs
```

The runner reads the existing R01 image pin, creates one isolated container with
no network, ports or mounts, uses its Unix socket, executes a transaction ending
in ROLLBACK, and removes only that container. It accepts no database URL or
Supabase project. `--write-sql` emits the same SQL without starting Docker.
SQL, query plans and a success/cleanup receipt go to `artifacts/r05-postgis/`.

The candidate adds GIN COUNTRY/CITY keys, GiST RADIUS centers and a latest-Save
btree over the existing private review/Save records. It introduces no table,
trigger, duplicated location record, public RPC or new Save owner. Invalid or
erased review JSON contributes no index keys. A matching historical or unsaved
review is never sufficient: the owned latest saved review, ordered exactly as
`worker_saved_areas_v1`, remains authoritative. Expiry after acceptance does not
erase that authority. Index maintenance follows normal INSERT/UPDATE/DELETE,
including existing retention erasure.

RADIUS retrieval uses a 201 km spherical superset of the validator's maximum
200 km radius, including the canonical haversine's rounding. All up to five
centers participate. The existing exact area evaluator then rejects broad
false positives; the worker status, ownership, final dispatch gate, notification
cap, nearby order, no-pin fallback and REMOTE branch remain in their owners.
No raw examined-row cap, guessed location or new routing interpretation is added.

PGlite executes the actual reader/helper bodies and candidate SQL, with explicitly
synthetic PostGIS and final admission boundaries. It executes real core PostgreSQL
GIN/latest-Save plans, **not** a spatial index. The separate Docker proof executes
the unchanged real GiST DDL, actual superset EXPLAIN ANALYZE on 4,000 irrelevant
reviews, the saved-area rescue and 960 rounded-radius boundary pairs. Its final
dispatch gate remains a fixture stub; this is not full dispatch, R01 admission,
Auth, DEV, device or production acceptance.

The old 129-reader-call witness remains as a negative-control mutant. The indexed
case reads one relevant saved area and zero in the no-match fixture. This does
not establish a fixed upper bound on all dispatch work: many historical matching
reviews, nationwide workers or later final-gate rejections can still cost work.
No persisted examined cursor has been introduced. If a hard per-invocation budget
is required, need/revision-bound continuation must be implemented separately,
without declaring an unfinished scan exhausted.

Before DEV promotion: fresh exact preimages and table/index metadata, real plan
receipt, current R10 retention/export/digest review, forward/rollback package,
and the same pair through retrieval, exact fit, For Me and actual dispatch. The
full candidate's LOCAL_ONLY admission remains intact; these reduced fixtures do
not execute or bypass that live admission block. No active migration is changed.
