# R10 saved work areas export — narrow LOCAL_ONLY correction

The current DEV `private.data_export_worker_candidate_v5(jsonb)` drops `workAreas`.
Its consumers include the owned AI draft/review export branches and worker reset
archive projection. The current helper's body MD5 is
`aa9c5f1b7ab4711cda7cb16905de55a4`.

`r10-work-areas-current.json` records ten current function definitions/metadata
from read-only DEV queries on 1 November 2026. It contains no business rows.
`../../candidates/r10_worker_area_export_projection.sql` changes only the existing
worker candidate projection, reusing the eight typed fields from the older WAR01
candidate. It does not apply the other stale WAR01 owners, create a second export
path, change ACLs, invent location facts, or admit a source certificate.
It requires the explicit `uskoci.r10.disposable=LOCAL_ONLY` opt-in supplied only
by the isolated test. Never set this flag on DEV to bypass promotion review.

Run `node --test supabase/proofs/legal/r10-work-areas-export.test.mjs`.
The test first reproduces missing areas with the captured current helper, then
executes the exact candidate with its predecessor/owner/ACL guard. It verifies:

- COUNTRY/CITY/RADIUS typed projection and ordering, malformed JSON, extra-field
  redaction, unchanged other profile fields and private function privileges.
- The exact two current snapshot SELECT branches, including both record-owner
  and conversation-owner predicates, against synthetic positive/foreign rows.
- The complete current reset/archive projector and real dependent helper bodies,
  including owned sessions/reviews, foreign nested copies and opaque fields.
- Refusal on source drift; no retention, certificate or policy mutation.

The mixed area fixture exercises projection ordering and historical stored data;
it is not a claim that a mixed COUNTRY/CITY profile passes current Save validation.
This is isolated PGlite execution, not the full snapshot/admission pipeline,
PostgREST/Auth, downloadable export delivery, Storage erasure or account closure.
The current whole source/export/erasure binding remains unadmitted. The dynamic
projection digest already includes this helper and changes when the helper
changes. A reviewed forward package must therefore include exact current
preimages, schema/source roster review, bootstrap/upgrade and rollback proof and
the existing R10 admission procedure before hosted application. Do not copy the
new digest into a certificate merely to make readiness return true.
