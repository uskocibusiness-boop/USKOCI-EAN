# R08: controlled DEV package, 2026-11-01

This is an execution packet under the existing CODEX master, not a new plan.
Target: `leqcwgzvjsxugfgzdmth`, PostgreSQL `170006`, database `postgres`.
Status: **PREPARED_NOT_APPLIED**. No Edge/mobile deployment or device acceptance
is represented by this packet. R01 strict parity is unchanged and remains open.

The seven owners were captured read-only at 13:42:39 UTC and their dependencies
at 13:45:02 UTC. `preimage.json` preserves exact definitions, OIDs, owner and ACL.
`dependencies.json` pins 44 unchanged functions and 31 relations, including RLS,
policies, columns, constraints and trigger definitions/function hashes. This is
the explicit dependency set of this packet, not a claim of full dynamic call-graph
closure. The exact generated read-only `preflight.sql` passed on DEV. That proves
metadata agreement only; it does not prove Save + Activate.

## What changes

Seven existing function definitions change, three private functions are added.
There are no new business tables, fields, role grants or RLS changes. New helpers
are inaccessible to `anon`, `authenticated`, and `service_role`. Existing public
RPC signatures and ACLs are preserved. The original LOCAL_ONLY candidate remains
unchanged: `build.mjs` executes it in disposable PGlite, checks the seven captured
preimages and emits the resulting exact definitions. It does not strip its guard
or execute it against DEV.

A first cityless activation requires the exact server-signed, current, complete
REMOTE review for already established service identities/modes. Save activates
before writing the receipt; that receipt drives the existing outbox and binding.
Matching/application/selection remain closed until the durable binding exists.
Unknown services, mode extensions, ON_SITE/BOTH and stale/unsigned review data do
not acquire remote activation authority. No city is invented.

## Review and execution

From the repository root:

```text
node supabase/operations/dev-alpha/r08-remote-only-20261101/build.mjs --check
node --test supabase/operations/dev-alpha/r08-remote-only-20261101/package.test.mjs
node --test supabase/operations/dev-alpha/r08-remote-only-20261101/acceptance.test.mjs
node --test supabase/proofs/ai/r08_remote_only_activation.test.mjs
```

1. Independently bind the connector/connection to the target project. The local
   `uskoci.r08.dev_target` setting expresses intent; it is not server identity.
2. Run `preflight.sql` read-only immediately before execution. A drift refusal
   requires a new capture/review; do not edit expected hashes to bypass it.
3. Review `manifest.json` and the exact generated forward transaction from
   generated `promotion.sql`. It includes 3-second lock and 30-second
   statement timeouts, original OID/body/owner/ACL/dependency guards and final
   postimage guards. Forward/revert files themselves are transaction fragments.
4. Apply **promotion.sql** using the existing controlled migration procedure after coordinator
   review. This packet has not been applied. The Supabase `execute_sql` connector
   requires `apply_migration` for DDL; do not send the forward through that reader
   as a substitute. A pre-apply DDL rollback rehearsal requires a permitted direct
   PostgreSQL connection. A migration-history write is not a rollback rehearsal.
   The promotion executes the exact forward, validates the fixture trigger surface,
   creates SAVEPOINT `r08_acceptance`, and executes `acceptance.sql`. A failed
   assertion aborts the migration. Success rolls back the entire synthetic fixture,
   checks its absence and final definitions, then commits only the code. Do not
   execute the bare acceptance fragment with a standalone COMMIT.
5. Run `postflight.sql`, then the real Auth/Android acceptance described below.
   Retain the exact SQL hashes,
   project/version, timestamp and separate outcomes. Never label metadata PASS as
   functional PASS.

## Recovery boundary

Preparation validation: **19/19** tests passed (7 packet, 2 acceptance transaction,
10 existing R08 regression tests); deterministic generation check passed. These
are local results, not hosted functional acceptance.

`rollback.sql` restores all seven captured definitions and drops only the three
new helpers, using RESTRICT and exact postimage/dependency guards. It refuses any
ACTIVE worker with an empty/one-character city. It deletes no application data.
Its safe operational window is **before application use** of the promoted path.
After a new review or successful Save, restoring code is not data rollback;
cached reviews and ACTIVE cityless profiles require a reviewed forward repair or
specific compensation. Do not bypass the refusal or fabricate a location.
Before first use, the rollback is checked in disposable PGlite for exact body/ACL
restoration. Hosted PostgreSQL 17 rollback execution is still a separate gate.

## Compatibility and remaining acceptance

The 14:00:34 UTC read-only fixture audit is `acceptance-dependencies.json`: 17
relations, all their noninternal triggers/rules and 15 selected path helpers.
Auth bootstrap writes account/profiles only. Save writes its review receipt and
transactional taxonomy outbox; binder writes confirmed modes/capabilities and a
binding receipt. Its requeue trigger writes only `private.dispatch_schedule`,
which has no triggers or rules. These uncommitted entries cannot be consumed by
other workers and are discarded at the savepoint. The fixture changes no catalog
identity/mode: it reuses the existing REMOTE service `Izrada jednostavnog sajta`.
It is explicitly TEST lineage. There is no provider, HTTP, push or email call in
the reviewed fixture path. Exact trigger/function guards refuse drift before the
fixture runs. The same guard passed read-only against DEV; no DML has run there.

`acceptance.test.mjs` executes the exact fragment with the existing limited R08
PGlite fixture, including the captured Auth bootstrap trigger and real
prepare/save/readback/batch/binder definitions. Both success/fixture rollback and
failure/enclosing-DDL rollback pass. The fixture still substitutes closure/requeue
and omits hosted RLS/PostGIS; only a successful promotion will establish the
hosted PostgreSQL dependency result. The prebinding check here is the durable
scope predicate, not a completed application/matching/push proof.

This SQL packet contains no Edge payload. Live versions last inspected by the
coordinator are Worker 104 / Need 151 / post-save 6. The existing post-save
batch/binder RPC contract is retained. Coordinate the smallest reviewed Worker
prompt change and matching mobile preview; deploying the whole branch may include
unrelated dependencies. Current mobile source understands the explicit refusal
and creates a fresh signed review if the user chooses Save Draft. Older clients
must not invent a city or suppress the server refusal.

Minimum hosted SQL acceptance: actual prepare and Save under authenticated role
and synthetic owner claims; ACTIVE with `city=''`; receipt/readback bound to the
same owner/review; no durable matching authority before binder; actual existing
batch and binder under service role; durable REMOTE authority after binder;
unsigned activation and foreign-owner Save denied. All fixtures roll back. DDL
commits only if all checks pass in the reviewed promotion; a separate pre-apply
rollback rehearsal must roll back DDL as well. This is PostgreSQL/RLS/RPC dependency evidence, not GoTrue sign-in,
Gemini, PostgREST, outbox transport, push delivery or Android evidence.

Minimum user acceptance after controlled rollout: a genuine confirmed test Auth
account, fresh REMOTE-only interview without a city, human review, Save+Activate,
authoritative server readback, outbox/binder completion and a matching task. Repeat
stale/retry/account-switch and ON_SITE/BOTH negatives using the existing R08
contract. Test billing/provider availability, notifications and two-device flow
remain their separate contracts; this packet cannot close them.
