# Disposable current-schema admission

The `r01-disposable-schema.yml` PR workflow starts a new local Supabase project
inside the Ubuntu runner's temporary directory. It executes only the reviewed
generated `bootstrap/current-application.sql`, after checking its generation
manifest hash, exact CLI/PostgreSQL/extension versions and local container
identity. Admission requires the registered `supabase_privileged_role` group and
effective inherited `USAGE` for NOSUPERUSER `postgres`; bare membership does not
pass. These conditions match the read-only DEV observation. There are no historical migration replays, fixtures, candidate ACL
changes, hosted project links, API credentials or business records.

The independent `r01-bootstrap-parity.mjs` checker compares the actual capture
with `bootstrap/current-catalog-fingerprints.json`. Any difference fails the job.
Managed role, schema, ownership and extension differences are not exceptions.
An initial failed comparison is diagnostic evidence, not a successful bootstrap
or a reason to edit managed schemas until they happen to match.

Only versions, image digests, source hashes, stage exit codes, SQLSTATEs,
bounded guard names, numeric source line locations and a comparison
whose object identities are hashed are uploaded. Full SQL output, server logs,
raw catalog/function definitions and any local service configuration remain in
the ephemeral runner directory. Cleanup always stops only this job's owned
project with `--no-backup`; the workflow never requests `--all`.

`config.toml` explicitly enables the captured legacy default exposure behavior.
The source generator reconstructs application defaults/ACLs, and strict parity
checks the resulting catalog. This is baseline reproduction, not an ACL fix.

Runtime source checks can be run without a database:

```sh
node --test supabase/proofs/privacy/runtime/run.test.mjs
node supabase/proofs/privacy/runtime/run.mjs check-source
```

`run` and `stop` refuse execution outside a Linux GitHub Actions pull request
targeting `feature/uskoci-cisto`. The stack includes Auth, PostgREST, Storage and
Realtime so their managed relations exist, but this job does not create Auth
sessions or test any HTTP authorization boundary. Metadata equality alone does
not close R01/F21.

The pinned CLI's [service image inventory](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli-go/pkg/config/templates/Dockerfile)
defines the runtime images. Its [configuration loader](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli-go/pkg/config/config.go)
supports the explicit service version files used here. The
[PostgreSQL image source](https://raw.githubusercontent.com/supabase/postgres/17.6.1.165/README.md)
lists PostgreSQL 17.6 and PostGIS 3.3.7; actual versions are still checked at runtime.

Managed differences also produce a diagnostic artifact with per-field and
per-column hashes and ACL tuples (hashed grantee/grantor, privilege code and
grant option). ACL ordering is normalized only in this diagnostic view; the
strict comparator still rejects every catalog difference. NULL and empty ACLs
remain distinct. No raw names, SQL expressions or setting values are published.
Unknown field names are counted but never echoed. Unknown ACL quoting refuses
diagnostics rather than exposing raw text. Each diagnostic row is logged
separately to avoid truncating the complete report into one oversized log line.
The report is bound to the validated capture and does not admit fixtures or
change any schema, platform configuration, role or privilege.

The Storage and Realtime pins override the CLI defaults: Storage v1.80.0
and Realtime v2.148.3 match the observed service migration frontier (Storage 73;
Realtime 20261009120000). Fifteen recent Storage source hashes match the DEV
ledger using postgres-migrations' SHA1(basename + SQL); fifteen recent Realtime
migration identifiers match the selected tag. The runner admits exactly these
recent ledger entries on the disposable server before application bootstrap.
This establishes a catalog-compatible candidate, not the deployed service binary
version. Later Storage tags introduce migration 74 and were not selected.
No managed privileges/owners are rewritten to obtain parity.

Realtime v2.148.4 has a source tag but its image returned 404 from both public
registries. The selected v2.148.3 image is available for Linux amd64 and all 91
tenant migration paths and Git blob hashes match v2.148.4. Runtime ledger
admission remains mandatory. A startup failure publishes only fixed diagnostic
categories and output hashes; unknown messages remain private.
