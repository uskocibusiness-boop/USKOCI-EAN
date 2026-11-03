# R07/R10 — saved price units and accepted history in export

Status: **SOURCE / ISOLATED PASS; LOCAL_ONLY_NOT_DEPLOYED**. This is evidence for
the existing CODEX master, not another plan or permission to apply SQL on DEV.

## Reproduced gap and current source

The current `private.data_export_snapshot` exports the application amount but
omits its saved price basis and immutable revisions. Its Agreement dataset has
metadata only, so the accepted price, unit and subsequent accepted changes are
absent. The existing hourly source candidate already carries these facts through
the real submit, revision, selection and Agreement writers; it is not rewritten
by this change.

`r07-price-export-current.json` records metadata-only DEV reads on 3 November
2026 at 12:23:41 and 12:25:26 UTC, project `leqcwgzvjsxugfgzdmth`, source review
HEAD `79ecdb1b90658dd642c28fd6cbe83463315dd232`. The two export owners and six
unchanged dependencies match the hash-pinned existing public bootstrap. No
business/Auth rows, sessions, credentials or private media were read or included.

`build_price_export_candidate.py` derives
`../../candidates/r07_price_export_current.sql` from those exact predecessors.
It changes only the two existing owners:

- `private.data_export_snapshot`: add saved response basis/current version and
  nested response versions; add nested accepted Agreement versions with amount,
  basis, covered slots, version/status/date and predecessor version.
- `private.data_export_dataset_catalog`: declare those fields in the two existing
  datasets. The existing 73 dataset identities and `OWN_ACCOUNT_V5_11` remain.

Response versions inherit the existing owned-response predicate. Agreement
versions inherit the existing either-participant predicate, regardless of which
participant created a version. No pending proposal, raw `terms`, counterpart
identity, address, content hash or opaque nested object is added. Numeric fields
reuse the existing scalar projector. Missing/null units on valid legacy objects
remain `TOTAL`; invalid units or malformed whole terms become JSON null.
`HOURLY` stays RSD per person per hour, without multiplying by people or guessing
duration. Today's editable Need is not consulted to reinterpret past terms.

## Executed isolated proof

```sh
python supabase/proofs/legal/build_price_export_candidate.py --check
node --test --test-reporter=spec supabase/proofs/legal/r07-price-export.test.mjs
```

Result: **6 PASS / 0 FAIL / 0 SKIP**. The test uses the existing current R07
fixture and its actual submit/revision/select/change functions. It first
reproduces the missing unit/history, then applies the exact candidate and checks:

- All prior export fields, all 73 dataset identities and the six dependency
  bodies remain unchanged; function OIDs, owner, ACL and other metadata persist.
- Amount/unit/history survive selection, an accepted 1200 → 1400 hourly change,
  and a TOTAL → HOURLY response revision. A pending 1700 proposal is absent.
- Both Agreement participants receive accepted versions; the requester receives
  no other user's response export; a foreign account receives neither dataset.
- Legacy NULL units, typed redaction and malformed JSON cannot manufacture a
  rate or expose opaque fields. No hourly amount is converted into a total.
- Missing LOCAL_ONLY opt-in, changed body/dependency, ACL drift and incompatible
  column nullability refuse atomically; successful changes can be rolled back.

The proof executes the exact two installed snapshot branches plus the unchanged
projection/grouping/JSON serialization tail. The binding and account existence
rows are synthetic and limited to these two datasets. The actual catalog also
uses the existing single-pass package's taxonomy inventory and current scope
helper; the package's definition MD5 is checked without rewriting that receipt.

This is PGlite 0.5.8 / PostgreSQL 18.3, not hosted PG17 or a full snapshot/download
test. Auth/world/matching/calendar/readiness/closure/event substitutes are those
explicitly declared by the existing pricing fixture. It does not execute export
policy admission, retention, erasure, Storage, real Auth/PostgREST or a phone UI.

## Promotion boundary

The candidate requires `uskoci.r07_export.disposable=LOCAL_ONLY` and postgres,
checks the exact eight function preimages/security attributes and 21 relevant
column types/nullability, changes two bodies atomically, then verifies postimages
and preserved `pg_proc` attributes. These column checks are a bounded source
guard, not a complete live schema/rollout preflight. Never set this test flag on
DEV to bypass controlled packaging.

Existing dynamic projection/source/erasure digests include these owners and will
change. Their functions, policy binding and readiness/certificate data are not
edited or admitted here. A future hosted package needs then-current preimages,
the combined hourly/export dependencies and old-client compatibility, full
lifecycle implications, hosted PG17/Auth acceptance and a rollback/forward-repair
boundary. Do not copy a new digest into a certificate to force readiness true.
The separate workAreas export candidate remains necessary for its own contract.
