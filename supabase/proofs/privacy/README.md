# R01 privacy evidence

## Local candidate and executable regression proof

`../../candidates/r01_needs_column_privileges.sql` restores the existing explicit
38-column public contract. It denies all other columns, including the three
private targets, the later `category_id`, and future columns. It changes only
SELECT for PUBLIC/anon/authenticated; it asserts that all other ACL entries remain
unchanged. Effective-privilege postconditions reject inherited access paths.
The single DO statement rolls back completely on failure. Existing RLS, RPCs,
writers and closure certificates are not changed.

The candidate is intentionally outside the migration inventory. It requires
`SET uskoci.r01.disposable = 'LOCAL_ONLY'` and must only be exercised in a disposable
database. Do not set that flag on DEV or promote the file until the HTTP and
compatibility proof below is complete. Use `supabase migration new` when promoting
the reviewed change; never alter the already applied broad-grant migration.

Run from the repository root with the installed, locked development dependencies:

```sh
node --check supabase/proofs/privacy/r01-column-boundary.test.mjs
node --check supabase/proofs/privacy/r01_fixture.mjs
node --check supabase/proofs/privacy/r01_discovery_fixture.mjs
node supabase/proofs/privacy/r01-column-boundary.test.mjs
```

The proof first reproduces access to a foreign synthetic actor/reason, then applies
the real candidate and exercises rejected projections/aliases/filters/order/group,
wildcards, whole-row/computed arguments, public positive controls, owner and
participant RLS, world separation, close-search writing, draft writes, new columns,
stray grants, inherited grants and atomic rollback. It runs current captured
detail/owner RPC bodies and rejects a forged-owner composite. It verifies function
body hashes before installing the fixture. CI runs the same command without a
network or database URL.

`r01_fixture.mjs` is a test-source fixture captured from metadata, not application
data. It is deliberately bounded: injected claims replace Auth; geography is
inert text; account closure/classification, candidate-state, audit and event
internals are fixture substitutes; most triggers/constraints are absent. No
PostgREST, Storage, Realtime, full closure digest, native/OTA or live deployment is
proven by this test. Its fixture certificate check demonstrates that the candidate
does not write those rows, not that real closure certification is valid. Current
owner-page R03 wire incompatibility is characterized, not repaired.

### Current Discovery compatibility addition, 2026-11-01

Fresh read-only DEV metadata at 16:56:40 UTC still shows effective authenticated
SELECT on all 42 Need columns. It also confirms that all ten function bodies in
the original fixture remain current. `r01_discovery_fixture.mjs` adds the exact
current `rpc_discovery_v1(jsonb)` body and six existing `p6_discovery_*` helpers
(helpers captured at 17:02:40 UTC). Only reviewed function source and metadata are
included; no application or Auth rows were read. Every captured body is hash-bound
before installation into the same disposable fixture. The six original Need RLS
policies are also checked against this fresh metadata; current geography and
requirement-detail policies execute with positive synthetic child projections.

The expanded command above passes **16/16** local SQL tests. After applying the
actual LOCAL_ONLY column candidate, positive owned/foreign REMOTE and ON_SITE
tasks survive current Discovery PAGE and EXACT_PUBLIC reads, three cursor pages,
AREA counts, and the existing own-list/page readers. TEST/REAL isolation, closed
and anonymous refusal, missing claims, nonpublic-field absence and direct private
column denial remain enforced. A deliberately regressed whole-row
`covered_slots(n)` call is rejected with `42501`; restoring the exact captured
body restores the successful public read. This is a compatibility proof, not a
runtime code repair or DEV apply.

PGlite has no ICU provider, so this fixture explicitly assigns the required
`sr-Latn-RS-x-icu` name to C collation and uses ASCII inputs. The production
function bodies are unchanged, but Serbian case folding/sorting is **not** proven.
The proof does not execute legacy PostGIS paths, MAP/PLACES, real client decoders,
GoTrue/PostgREST, native/OTA or the complete closure dependency chain. The prior
fixture substitutes and limits above still apply. No R01 parity exception,
expected-catalog change, DEV privilege change or closure digest rebind was made.

Before promotion, the remaining authenticated HTTP/client compatibility gates
below still require a faithful current test target and positive synthetic data.
The controlled migration also needs the current exact ACL preimage/postimage and
a reviewed closure-binding consequence; changing Need ACL changes the erasure
program digest. The LOCAL_ONLY candidate remains unchanged and is not a DEV
operation packet. These tests do not authorize bypassing that guard or recertifying
an already incomplete closure/export contract.

## Metadata and promotion checks

`r01_read_preflight.sql` is a reusable metadata-only snapshot for the Need column boundary. It runs inside a read-only transaction and reads only system catalogs. It inventories privileges, policy expressions, function hashes/ACL/security settings, relevant schema access, default ACL and whitelisted PostgREST settings. It does not invoke application functions or read user/business rows. A successful query is evidence capture, not a passing privacy test.

Run only against the target identified by the connection context. Save its JSON result with the source commit and capture time. The read-only transaction ends with `ROLLBACK`. The query deliberately has no schema changes, grants, fixture writes, digest rebind, deployment or password/token output.

`r01-capture-bootstrap-metadata.sql` additionally inventories the metadata needed
to reconstruct a current disposable application schema: extension versions,
sequence options/ownership (not values), role membership options, event triggers,
unsupported object shapes and the managed Auth relation contract. It returns all
application/helper function hashes and eleven ordered catalog section digests,
including the real `authenticator` pre-request setting. It runs in a read-only
transaction with `search_path=pg_catalog` and bounded timeouts; it does not call
application functions or read application/Auth records. Keep the captured output
in the evidence store, not a public repository export.

Capture format 3 also includes the complete normalized catalog sections and exact
function definitions for reconstructing the disposable target. All sequence bigint
options are decimal strings; JavaScript must never round them during transport.
Format 2 is superseded and must not be used as a bootstrap source. Function/default
text can contain operational literals, so the raw capture remains in managed
evidence storage and generated source receives a publication review.

`r01-bootstrap-parity.mjs` builds a fingerprint-only manifest and compares a later
format-3 capture. It checks sixteen groups, required objects, read-only PostgreSQL
17 capture, pinned search path, unsupported shapes, duplicate consistency and exact
function-definition hashes. It refuses unsafe numeric inputs and incomplete
captures. Differences report identities, field names and hashes, without source
or default literals. There are no blanket managed-platform exceptions: every
difference blocks metadata admission and needs review. Even complete metadata
equality is not proof of Auth/PostgREST behavior, reference fixtures or closure
readiness.

```sh
node supabase/proofs/privacy/r01-bootstrap-parity.test.mjs
node supabase/proofs/privacy/r01-bootstrap-parity.mjs manifest CAPTURE.json
node supabase/proofs/privacy/r01-bootstrap-parity.mjs compare EXPECTED.json CAPTURE.json
```

The query is a capture, not a bootstrap or parity verdict. Function body hashes
can be compared with REV10 directly; definition/expression digests use this new
pinned-path format. A disposable PostgreSQL 17 stack must reproduce the relevant
catalog and resolve differences before real Auth/PostgREST tests. Review managed
platform differences explicitly; do not copy hosted operational roles or replace
managed schemas to force equality. Do not reuse the historical P6 replay as proof
of the current schema. Current capture/comparison identities and remaining work
are recorded in `docs/plan/CODEX_PLAN_RADA.md`.

Fresh DEV metadata on 2026-10-27 still showed authenticated table SELECT and effective SELECT on all three private Need columns; anon SELECT was false. The first isolated candidate should remove the broader SELECT sources and regrant a reviewed explicit public column whitelist in one transaction. PostgreSQL table REVOKE also removes corresponding column grants, so a bare revoke would break readers. Preserve current RLS, authenticated helper access, owner-authorized actions and service consumers. Do not replay old PKG045b or rewrite an applied migration.

Before claiming F21 fixed, execute a current synthetic Auth/PostgREST proof with:

- Two open accounts of the same world and a foreign PUBLISHED/SELECTION Need, including a closed-search private reason marker.
- All three private columns denied through select, alias, filter, order, wildcard and whole-row computed-field routes, with successful public reads as a positive control.
- Owner, legitimate participant and forbidden participant cases; TEST/REAL separation; anon, closed account, malformed and expired sessions.
- Real current client decoding for own list/page, Home preview, legacy/exact landing and discovery PAGE/MAP/PLACES. Preserve `ru4Production.remainingSearchState`, which directly reads allowed `remaining_search_closed_at` by `id`.
- Owner close-search action and foreign-caller denial, retaining permitted statuses and private reason/actor writes.
- Verified current supported native/OTA contracts or a safe controlled refusal for incompatible whole-row clients.

The old `discovery/p6_http_boundary.mjs` uses a pinned historical predecessor and tests only one private column at the HTTP boundary. `discovery/p6_world_boundary_proof.mjs` contributes stronger SQL/world controls but is not current HTTP evidence. Rebase the needed proof onto a faithful disposable target; never run its fixture/writer code against DEV.

Need table ACL participates in the closure erasure-program digest. Inventory the current schema/source/binding chain before choosing a migration. The preflight returns closure-related definitions without calling them. If readiness is already false, replacing the expected digest does not repair missing export/closure projections or copies. Keep fail-closed behavior, explain the exact ACL delta, and do not claim account closure/export readiness from a privacy-only patch.

Default privileges and surplus non-row privileges require a separate, explicit consumer review and a new synthetic object test. Broad service_role EXECUTE grants are not evidence of anon/auth access; inspect effective PUBLIC EXECUTE separately.
