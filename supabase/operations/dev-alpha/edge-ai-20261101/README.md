# R04/R06/R08 — complete AI Edge DEV package

Target only `leqcwgzvjsxugfgzdmth`. This is an execution
packet under the existing master. It contains no production changes or SQL DDL.

**Latest: DEV source promotion verified on 2026-11-01.** Need **154** and Worker
**107** were independently retrieved and matched exactly (23/21 files). Six
bounded rejected-access probes passed; the exact 25-RPC read-only postflight also
passed. See **`applied-receipt.json`** for timestamps, hashes and precise limits.
This is not an accepted real-user interview, paid model call, signed Save/publish,
matching/push/device flow, privacy closure or public-release approval.

`manifest.json` and `config-review.json` are frozen prepared-state evidence. See
the separate **`config-receipt.json` for the latest configuration status**; the
applied-receipt template is not deployment evidence. When actual promotion occurs,
the coordinator records it separately in `applied-receipt.json`. Do not rewrite
the prepared manifest to make later actions look previously verified.

The six non-secret settings were subsequently verified after a dashboard reload.
Two config writes advanced platform versions to **Need 153 / Worker 106**, while
every original source byte, compressed bundle hash and function identity stayed
unchanged. `deployment-baseline.json` pins this verified current baseline and
references the exact original source snapshots. `--verify-live before` requires
153/106; historical 151/104 metadata is accepted only by `before-config`. The
candidate/rollback readback must be newer than the current 153/106 baseline.

`before.need.json` and `before.worker.json` preserve exact retrieved v151/v104
source strings and metadata, including original bundle hashes. `source-files.json`
contains the complete import closure from commit
`53a3220d58643ee30e6646b6be04c807f9c1eb19`: Need 23 files, Worker 21, union 26.
`manifest.json` pins every source file and rollback capture. There is no partial
prompt patch or old-handler variant. All source is scanned for common credential
literal formats; environment variable references are retained, secret values are
not supplied. No runtime Deno config/import map exists in this pinned closure.
In a shallow CI checkout without the pinned commit, verification accepts the
frozen snapshot only when every current HEAD source byte is identical. Source
drift refuses verification; retain the pinned Git history for later recovery.

## Before promotion

1. Bind the connector externally to this DEV project. Run `build.mjs --check` and
   the package tests. Confirm required source CI and independent review outcomes;
   a generated manifest is not a test result or deployment authorization.
2. Run `preflight.sql` read-only immediately before promotion. It pins all 25
   current RPC identities, definitions, owners, ACLs and effective execute rights.
   All are service-role-only. The only new source RPC, the capture-receipt reader,
   remains absent and **its flag must remain OFF/absent**. The first-plan durable
   SQL candidate/wrappers are not called by these handlers. Drift requires review
   and recapture; do not edit expected hashes to force a pass.
3. Complete `config-review.json` using the real dashboard's non-secret values or
   known-value digests. Existing v151/v104 treated absent taxonomy flags as enabled
   on this DEV URL. New source requires explicit flags and DEV scope/project
   admission. Preserve existing behavior with the six listed taxonomy values;
   preserve existing provider/model/paid-test credentials and settings. Leave
   receipt-readback and application-deadline flags absent/OFF. This package does
   not set any flag. Budget cap enforcement is currently disabled; source changes
   do not constitute an operational budget approval or a public-release policy.
4. Fetch both current Edge functions immediately before replacing either. Save
   their exact results and run `--verify-live before` below. Preserve existing
   `verify_jwt=false`: both complete handlers verify the caller through Auth before
   service RPCs. Do not substitute a partial handler or weaken that verification.

## Offline payloads and verification

From the repository root, use
`supabase/operations/dev-alpha/edge-ai-20261101/build.mjs` as `<build>`:

```text
node <build> --check
node --test supabase/operations/dev-alpha/edge-ai-20261101/package.test.mjs
node <build> --verify-live before uskoci-ai-interview <fresh-need-capture.json>
node <build> --verify-live before uskoci-worker-interview <fresh-worker-capture.json>
node <build> --emit candidate uskoci-ai-interview
node <build> --emit candidate uskoci-worker-interview
```

Emit commands only return exact JSON payloads; they never connect or deploy. The
coordinator supplies the approved connector link to the deployment tool. Promote
one whole function at a time. Each deployment starts serving immediately; the two
function updates are not atomic. The existing SQL ABIs are shared by both old and
new bundles. After each deployment, retrieve its exact metadata/files and run:

```text
node <build> --verify-live candidate <slug> <fresh-capture.json>
```

Require a new ACTIVE version, the same function identity/JWT/import-map policy,
and every expected source byte. Re-run the RPC preflight after both deployments.
Perform bounded OPTIONS, missing-Authorization and malformed-auth probes only;
do not create accounts/conversations, send valid paid requests or infer model
success from these probes. Record status/body code, new version, bundle hash and
timestamp. Such probes establish only handler reachability and rejected access.
The optional `probe.mjs --run-rejected-access` command performs exactly those six
fixed-DEV requests, using only its hardcoded deliberately invalid token. It has a
10-second bound per request, rejects redirects and caps responses at 4 KiB. It
prints status/code only, never raw response text or a real credential. Its offline
tests are `node --test .../edge-ai-20261101/probe.test.mjs`; tests perform no HTTP.

## Recovery

Before overwrite, verify the deployed candidate is still exactly ours. Use
`--emit rollback <slug>` to return that function's exact original source payload.
Restore only the affected function, or both if their combined behavior requires
it; every rollback creates a **new** Edge version. Then use `--verify-live rollback`
against the new readback and repeat bounded probes and RPC metadata checks.
Keep the explicit preserving taxonomy flags; they also preserve old DEV behavior.
Do not restore metadata version numbers or claim the compressed bundle hash must
be identical after repackaging. Per-file exact source comparison is mandatory.

Restoring source does not undo committed turns, usage/reservations, consent,
categories, bindings or newly activated R08 cityless profiles. SQL rollback and
forward recovery have their own package controls. Do not reset accounts or invent
a location to make a code rollback appear successful.

## Evidence limits

The current AI suite completed 1,477 PASS / 0 FAIL / 1 existing TODO (1,478 total).
That TODO is real R07a Auth/Save/publish integration. The RPC capture is metadata
evidence. No genuine Auth/Gemini round trip, Android installation, push flow,
privacy/R10 closure, production promotion or public-launch approval is provided.
R08/F10 SQL packages remain separate; their coordinator records determine actual
deployment state. This package must not overwrite their acceptance evidence.
