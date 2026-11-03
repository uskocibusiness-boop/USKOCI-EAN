# R07 current hourly application/Agreement source — 3 November 2026

**SOURCE / ISOLATED TESTS ONLY. NOT DEPLOYED. R07 is not DONE.**

The earlier `r07_hourly_pricing.sql` is a valid historical candidate, but it must
not be replayed onto today's DEV: its two nullable `price_basis` columns were
already installed on 2 November, and several of its function bodies predate the
cityless REMOTE admission, Agreement attention, edit-resume and deadline changes.

## Exact scope

The new `build_current_hourly_candidate.py` reuses the existing reviewed pricing
transformations in `generate_hourly_candidate.py`. It derives nine replacements
from already-public source whose function body hashes were verified against live
DEV system catalogs on 3 November. The capture contains no business/Auth records.
The reused source files also have SHA-256 pins. No existing applied migration,
old fixture capture, deployment manifest or old evidence hash is rewritten.

The generated `../../candidates/r07_hourly_pricing_current.sql` requires the
existing expanded schema and exact current signature/body/owner/ACL/configuration
metadata. A single guarded DO statement changes existing bodies only, checks the
postimage, and preserves actual local function identities and all other catalog
attributes. It adds no columns, endpoint, grant, role or backfill. It does not
change retention/export/closure certificates. Its LOCAL_ONLY flag is not a remote
project identity check and must never be set on DEV to bypass promotion review.

The correction preserves RSD/hour/person without multiplying the offered hourly
rate by team size or inventing a final total. It carries the unit through submit,
immutable response version and hash, stale-response decision, four application
readers, selection and the frozen Agreement. Existing null-unit records remain
legacy TOTAL; they are not reinterpreted from today's edited task. Existing
receipts and accepted Agreement versions are not rewritten. Current signed
REMOTE readiness, attention and edit-resume/deadline behavior are retained.

The already-current Agreement-change writers are not modified. Their real bodies
are exercised to prove that changing the amount retains hourly basis, currency,
headcount and previous immutable versions. A tampered pending proposal cannot
change the unit even when its content hash is recomputed.

## Executed local verification

On Node 22.16.0, PGlite 0.5.8 / PostgreSQL 18.3, TypeScript 6.0.3:

```sh
python supabase/proofs/ai/generate_hourly_candidate.py --check
python supabase/proofs/ai/build_current_hourly_candidate.py --check
node --test --test-reporter=spec scripts/r07b-hourly-chain.test.mjs
node --test --test-reporter=spec --test-concurrency=1 \
  supabase/proofs/ai/r07_current_hourly_chain.test.mjs \
  supabase/proofs/ai/r07_current_hourly_client.test.mjs
node --test --test-reporter=spec supabase/proofs/ai/r06_need_edit_resume.test.mjs
```

Results: the original 25 pricing tests, 16 current SQL cases, one actual mobile
data-adapter/SQL case and 15 neighboring edit/resume tests all passed. Both source
generators passed. The original 25 cases are retained after extracting their
unchanged bounded fixture. The current suite rebuilds synthetic schemas in one
local engine per process to bound Wasm resources; the adapter runs separately.
An earlier many-engine combined run timed out and is not counted as a PASS.

The current baseline first reproduces `UNKNOWN_PRICE_BASIS` and an unsuccessful
actual mobile submit. After installing the candidate into the fixture, the same
real submit/list/page/select adapters accept HOURLY and the SQL Agreement contains
1200 RSD/hour/person with two covered places. Only the adapters' network/session
ports are substituted. The amount is not silently converted into 2400 RSD or a
final job total. Other controls cover TOTAL, PER_PERSON, OFFERS, historical null,
foreign identities, missing identity, world mismatch, stale units, replay,
metadata/schema drift, transaction rollback and closing-account edit refusal.

## Evidence limits and next promotion gate

PGlite 18.3 is not the hosted PostgreSQL 17.6 engine. The fixture has real price,
receipt, version, state and relevant change functions and constraints, but uses
explicit substitutes for Auth identity, world policy, matching/calendar, REMOTE
readiness, closure checks, publication fingerprints and event side effects.
There is no full RLS, GoTrue/PostgREST, concurrent-session, Store/Storage, paid
model, phone or two-account E2E proof in this change. The VM executes real plain
TypeScript adapters; it does not type-check or render the application.

Before a controlled DEV promotion: capture then-current full dependencies/schema
and lifecycle consequences; derive a separate guarded preflight/promotion/
postflight/forward-repair package; execute real PG17 and valid Auth/HTTP positive
and negative acceptance; verify supported old-client behavior or its upgrade gate.
Do not restore a pre-November writer or erase data to make rollback succeed.
Once new immutable hourly versions/Agreements exist, an inverse rollback is not
safe without an explicitly reviewed compatibility/recovery strategy.

**Export is still open.** The captured current export projector includes response
amount/headcount but not the new response unit, and its Agreement projection is
not a complete export of accepted price terms. This candidate does not claim to
fix R10 or bind its already-incomplete certificate. R07 also retains its other
currency-correction, review/abandon, native and complete lifecycle obligations in
the sole `docs/plan/CODEX_PLAN_RADA.md` master.
