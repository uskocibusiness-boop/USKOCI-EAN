# R07a: withdraw superseded price consent

When a user corrects a confirmed RSD price to EUR or an amount without a confirmed
currency, the old amount must stop being an active agreed price. The current
writer only adds proposals, so an empty clarification previously left the old
confirmed price available to review.

The Edge guard now adds a reserved `INVALIDATE_PRICE` control to the existing
owned completion call. The control is generated after strict model parsing;
model output cannot supply it. It is accepted only for a clarification/review
about the same task, with no replacement price facts in that transaction.

The candidate updates the existing service writer, preserving its signature,
owner, grants, security mode and search path. Under the existing conversation
lock it supersedes active price mode, amount and basis together with the turn's
messages and any independent valid proposals. Historical values and confirmation
provenance remain unchanged. No null/UNKNOWN fact or new client payload shape is
introduced. Removing the active required price mode makes existing review report
missing price consent; an unrelated ALLOW turn cannot restore it. A later explicit
RSD choice creates new facts requiring confirmation. OFFERS remains an explicit
choice, with no currency conversion or automatic fallback.

The reserved control does not count as a proposed fact. Ordinary receipts still
report 0–12 proposed facts. Unknown, duplicated, misplaced or price-conflicting
controls fail atomically. Existing completion context/attempt/expiry/cancellation
and replay checks run before the writer. A successful replay returns its existing
receipt without retracting a newer price. No separate retraction request is sent.

## Verification and delivery boundary

`node --test supabase/proofs/ai/currency_correction_characterization.test.mjs`
now tests the corrected outcome using actual Edge guard code, the candidate
writer, captured review/confirmation/source functions, the actual fact-write
trigger and current owned completion/context/status bodies. Relevant body hashes
were rechecked read-only on DEV on 2026-10-28. It is a narrow PGlite fixture:
closure admission/exemption are stubbed, transport/Auth and concurrent database
sessions are absent. It does not prove full signed accept/Save/publication,
retention, physical devices or deployment. The separate hourly mismatch remains
an explicit characterization, not an R07b completion claim.

The regression also calls `price_review_boundary_fixture.mjs`: seven additional
cases run the current prepare/accept/direct-save/publish functions. An actual
prepared review with a confirmed price is rejected after retraction, including
after a later ALLOW or return to the same amount. A refreshed incomplete review
cannot be accepted; direct save reports missing `need.price_mode`. New RSD and
explicit OFFERS produce fresh acceptable reviews. Publishing without an accepted
command is refused. These cases bring the focused run to 26 passing tests.

This is a boundary proof: geography and policy are fixed synthetic fixtures,
and valid acceptance intentionally raises a sentinel before location saving or
fact confirmation. No draft or publication is successfully written. Real media
source helpers run on an empty asset table. The seven main review/media body
hashes were rechecked read-only on DEV; the leaf location validator comes from
the unchanged canonical bootstrap. Full authenticated acceptance and publication
remain unproven. Combined Edge/SQL regression: 173 passed, one integration TODO.

`ai_edge_context.test.mjs` runs the actual handler with synthetic transport. It
checks retraction delivery, model-control rejection and that a failed write or
incorrect receipt cannot return a confirmed success.

The SQL file is an opt-in local candidate, **not an applied migration**. It
requires `SET uskoci.r07.disposable = 'LOCAL_ONLY'` and refuses an unexpected
writer body. Do not deploy the changed Edge handler alone: the old database
rejects its reserved control. Required next proof is the current full schema and
real Auth/Data API, signed review/accept/Save/publish, including an already
prepared review, positive RSD/OFFERS recovery and the location-turn path. Only
after that proof should the candidate be promoted through `supabase migration
new` and rolled out SQL first, then Edge. No DEV objects or data were changed.
