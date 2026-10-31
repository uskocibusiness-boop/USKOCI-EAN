# R07b / D06: hourly rate per person

`r07_hourly_pricing.sql` is a disposable-only candidate, not an applied migration.
It changes nine existing functions and adds two nullable columns. The generator
in `../proofs/ai/generate_hourly_candidate.py` checks the exact captured source and
reproduces the candidate; it has no connection to a live database.

## Amount contract

| Object | Stored amount | Unit |
|---|---|---|
| Need, TOTAL | Whole task budget | TOTAL |
| Need, PER_PERSON | Price for one person | PER_PERSON |
| Need, HOURLY | Rate for one person for one hour | HOURLY |
| Application / Agreement from TOTAL or PER_PERSON | Existing computed amount for the application's headcount | TOTAL |
| Application / Agreement from HOURLY | Unchanged per-person hourly rate | HOURLY |

An application covering two people at 1,200 RSD per person per hour stores 1,200,
not 2,400 or 7,200. A known three-hour duration gives an explanatory 7,200 RSD
calculation; it does not replace the rate or prove actual worked hours. Unknown
duration has no final total. OFFERS retains its existing aggregate offer contract.

`marketplace_responses.price_basis` and `marketplace_response_versions.price_basis`
admit TOTAL, HOURLY or historical NULL. New commands write an explicit unit. NULL
means the legacy aggregate amount and is never reinterpreted using an edited Need.
Readers expose `applicationPriceBasis`; the own-applications page's existing
`priceBasis` still describes the current Need. Agreement terms use `priceBasis`.
The existing Agreement change merge preserves that term and its response guard
rejects an altered unit; neither change RPC needs replacement.

New version hashes include the unit. Request hashes and RPC arguments stay the
same: the command already binds Need revision. Existing receipts replay before
reading today's Need. No historical version, hash, receipt or Agreement is
rewritten. KEEP rejects a unit change with STALE_REVIEW_REQUIRED; an explicit
UPDATE can confirm the new reviewed terms. Selection verifies the stored unit
before any Agreement is created. Function identity, ownership, ACL, security,
configuration, volatility and return type are asserted unchanged atomically.
New edit conversations seed HOURLY as “Po osobi po satu”, keeping the original
typed unit; existing conversations and signed reviews are not rewritten.

## Deployment boundary

Source tests and an isolated PGlite chain are not Auth/PostgREST, managed Supabase,
concurrent-session or device evidence. The candidate refuses to run unless
`uskoci.r07b.disposable=LOCAL_ONLY`; it is outside migration inventory.

The rollout must separate compatible schema expansion from hourly activation.
The new client directly selects the new response column, so the additive schema
must exist first. Old installed Discovery decoders can reject an entire page
containing HOURLY; older candidate/Agreement screens can label a rate as a total.
Therefore supported client build/OTA delivery and a proven minimum-version or
controlled upgrade path are required before enabling hourly publication and
application writers. Merely adding JSON fields or deploying Edge is insufficient.
R07a's compatible price-retraction writer must be present with its matching Edge.
Migration promotion, live API tests, client compatibility and release evidence
remain recorded in the single master plan; this document is a technical proof note.
