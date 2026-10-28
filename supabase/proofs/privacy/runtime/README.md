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

The runner now uses the explicitly identified **disposable derivative**
`2.116.0-r01-no-webhook`, not the unmodified released CLI. The pinned upstream
[startup source](https://github.com/supabase/cli/blob/997a1e69a4a83466964ed874d3a604c88a7b3866/apps/cli-go/internal/db/start/start.go)
unconditionally inserts its legacy `templates/webhook.sql` into a new database.
That separate template adds `supabase_functions`, role/default privileges and
an event trigger, and changes pg_net GET/POST to SECURITY DEFINER. Those are
observed disposable-only additions, not part of the captured DEV baseline.

`cli-bootstrap-build.mjs` fetches the exact upstream commit, verifies a clean
checkout and SHA-256 for the affected source, untouched webhook template,
go.mod and go.sum, and removes only the single 22-byte concatenation expression.
The source before and after has a pinned hash. It compiles with the pinned,
SHA-256-verified Go 1.26.10 distribution and checksum-verified read-only module
resolution; final source status may contain only this one change. It publishes
the source/toolchain/binary hashes and fixed failure categories, while download
and build logs stay private. No script changes a managed object's owner or
privileges after database startup. Service images and migration histories remain
unchanged. The runtime accepts only that build receipt and binary hash, including
for cleanup, and checks actual absence of the legacy schema/function/event
trigger and actual invoker mode of both pg_net functions before application DDL.

This removes a demonstrated source of divergence; it is **not** a waiver for
remaining differences or a claim that the derivative reproduces the whole hosted
platform. The original generated SQL, expected fingerprints and strict comparison
are unchanged. A nonzero strict comparison still fails and prevents fixtures and
HTTP/candidate execution. See `r01-relevance.md` for the separate evidence needed
before narrowing admission; that document does not currently enable admission.

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

`auth-search-indexes.sql` recreates only the four captured, nonunique Auth user
search indexes. They match the pinned Auth v2.196.0
[index worker](https://github.com/supabase/auth/blob/v2.196.0/internal/indexworker/indexworker.go),
whose [configuration](https://github.com/supabase/auth/blob/v2.196.0/internal/conf/configuration.go)
defaults to disabled. This separate prerequisite runs atomically as the existing
`supabase_auth_admin` owner via transaction-local `SET ROLE` from the admitted
`supabase_admin` socket session, before application DDL. No Auth database password
is read. It refuses an existing application or nonempty Auth users table.
It changes no ownership, role, ACL or table definition. Its source hash is included
in the runtime receipt; full strict catalog comparison still checks every index.

`platform-effective.sql` collects read-only effective Storage privileges, role
reachability, schema permissions and routine metadata for pgcrypto, uuid-ossp,
pg_stat_statements and pg_net. It invokes no application or extension routines.
The baseline fingerprints come from a separate read-only DEV capture. The same
query runs after disposable bootstrap, even when strict catalog comparison finds
differences. Its report hashes identities and string values; only validated
boolean capability fields are public. Exact query bytes are bound to the baseline.
This diagnostic does not accept any of the 13 remaining catalog differences or
claim full extension dependency, Auth, HTTP or application behavior coverage.
