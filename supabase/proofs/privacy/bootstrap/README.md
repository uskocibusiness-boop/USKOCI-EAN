# Disposable current-schema source

`generate.py` creates reproducible application DDL from the immutable, private,
read-only catalog capture. It is an offline generator: it neither connects to a
database nor copies business, reference, certificate, Auth, Vault or cron rows.
The source capture is format 3, with sequence numbers encoded as decimal strings
to preserve PostgreSQL int64 values through JSON transports. The default SHA256
pin is `c222414ac222f2beee07f954165abf61ad4bf8b8ba4eebea91e0143784b1a36e`.

Run with Python 3.10+ and its standard library:

```sh
python -B supabase/proofs/privacy/bootstrap/generate.py \
  --capture /managed/evidence/20261028-bootstrap-metadata-v3.json \
  --output-directory /prepared/managed/temporary/directory
python -B -m unittest discover -s supabase/proofs/privacy/bootstrap -p 'test_*.py'
```

The output directory must already exist, be outside this repository and have no
conflicting output files. The three outputs are `current-application.sql`,
`current-generation-manifest.json` and `current-generation-coverage.json`.
Publication is a separate review step. The generation manifest records object
provenance; `../r01-bootstrap-parity.mjs` owns the independent runtime comparison.
Never publish the raw capture or reinterpret generation as successful parity.

The generated SQL restores 167 application tables, 9 sequences, 682 functions,
1,099 constraints (six arise from constraint triggers), 364 indexes, 91 policies,
173 application hooks and one application event trigger. It preserves column
ordinals, generated columns, identity options, RLS, ACLs, nullable ACLs and the
application pre-request hook. It restores only `postgres` default ACLs in the
three application namespaces before creating application objects. Managed owner
defaults and operational role definitions remain the platform's responsibility.

The independent runner must create a fresh, isolated local Supabase PostgreSQL 17
database named `postgres`, verify the loopback target, then install the captured
extension versions/schemas. The generated manifest lists all eight prerequisites.
Supautils must register `supautils.privileged_role` in `pg_settings` with context
`sighup` and value `supabase_privileged_role`, as confirmed in the current DEV
catalog. The `postgres` role must have immediately inherited privileges
(`pg_has_role(..., 'USAGE')`), and remain NOSUPERUSER. Membership without
inheritance is insufficient. Supautils supplies the supported ability to create
an event trigger owned by that role. No role elevation or admin finalizer is used.
The `public` schema owner must be `pg_database_owner`, and existing `private` and
`rls_private` schemas, if any, must be owned by `postgres`. The Auth, Storage and
Realtime managed table contracts must already exist. Exact platform parity is
checked afterward, including differences outside this generated application DDL.

Execute on that admitted target as `postgres` in one psql session, without echoing
SQL and with errors fatal:

```sh
psql -X --set=ON_ERROR_STOP=1 --username=postgres --dbname=postgres \
  --command="SET uskoci.r01.bootstrap='LOCAL_ONLY'" \
  --file=current-application.sql
```

The marker is an explicit runtime contract, not proof that a connection is local.
The runner owns that independent check. The SQL requires empty application
namespaces and runs in one transaction. It will fail closed on mismatched platform
prerequisites. A second run is intentionally refused. It does not apply the R01
candidate or claim that Auth, PostgREST, application fixtures or behavior passed.

The publication scan checks function definitions and catalog expressions for
secret-shaped literals and calls requiring review. Dynamic SQL, outbound HTTP,
Vault access and URL-pattern warnings require explicit review before running any
fixture that could execute those functions. Creating their definitions does not
invoke them. Keep scheduled jobs and provider integrations inactive in the
disposable runtime.

Supabase's supported event trigger contract is documented at
<https://supabase.com/docs/guides/database/postgres/event-triggers> and
<https://github.com/supabase/supautils>.
