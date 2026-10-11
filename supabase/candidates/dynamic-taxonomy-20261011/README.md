# Dynamic taxonomy: isolated PostgreSQL foundation (11 Oct 2026)

Status: **Candidate with disposable PostgreSQL proof. NOT DEPLOYED.**
No DEV/PROD SQL, live dispatch, cron, queue, Edge, push or OTA was changed.

This complements the existing 11 October architecture RFC and does NOT replace
the separately tested one-function interim matching-category fallback candidate.

## Disposable PostgreSQL proof

The GitHub workflow at .github/workflows/taxonomy-foundation-pg-proof.yml runs:
1. disposable-fixture.sql (synthetic needs table, dummy database roles).
2. catalog-foundation.sql (private relational taxonomy with default-OFF switch).
3. disposable-assert.sql (normalization, safe denial, unique categories, 50 new kinds, history preservation).
4. capability-tier.sql (read-only skill ranking; no dispatch or events).
5. disposable-capability-assert.sql (molers, movers, cleaners, opt-in, explicit multiple skills).
6. Two simultaneous inserts for the same new normalized kind; exactly one ID survives.

Only a local PostgreSQL 16 service container is used, without Supabase credentials
or any external notification transport.

## Implemented candidate structure

- Private catalog with stable UUID, canonical identity, nullable parent, state,
  version and supersession reference.
- Locale-specific aliases with collision-safe normalized uniqueness;
  Serbian Cyrillic/Latin transliteration and removal of common diacritics.
- Versioned, directed and evidence-bearing relations. AI-suggested relatedness
  does not grant capability.
- Worker-confirmed competence, explicit opt-in, excludes and per-worker related
  acceptance bound to a relation version.
- Task-revision classification snapshots plus explicit required category rows.
- Durable audit rows and bounded/idempotent registration.
- The server-only registration gate defaults to DISABLED; no user/AI grants.

Important: the low-risk policy string passed into the candidate registrar is
**trusted-caller input, not independent proof**. A separate server-validated policy
gateway and identity binding are essential before permitting any automatic writes.
Do not expose the registrar to a public or user-supplied RPC.

## Hard limitations (NOT YET DONE)

- AI classification service, homonym/domain adjudication, actual automated
  low-risk admission, regulated-content review, rate limiting, and model audits.
- Historical migration/backfill of original eleven kinds or task/worker data.
- User review/correction UI and worker capability confirmation source.
- Integration into the canonical hard eligibility function and dispatcher.
- Exact location/radius, time, closure, ownership, exclusions, blocks,
  capacity and delivery controls inside the new capability routine:
  these MUST be preserved by the current canonical matcher.
- Zero-match requester diagnostics, retry/re-evaluation, provider receipts,
  one-device tap proof, notification event integration.
- Postgres query plans with 40,000 profiles / thousands of categories,
  Auth/RLS full-stack proof, rollback source pinning and official CLI migration.
- Hierarchy cycle guard and multilingual homonym collision policy.

## Safe forward path

First complete trusted policy admission and identity-bound classification,
then source-pinned eleven-kind backfill, UX confirmation, and a single canonical
matcher integration under all existing hard gates. Next prove notifications and
dispatch diagnostically in disposable tests. Only after that prepare a reviewed
CLI migration, read-only live preflight, scoped owner approval and feature flags.

## Safe rollback (only if eventually installed after explicit approval)

Disable catalog auto-registration and app integration feature flags in a
separately authorized transaction. Preserve catalog/history records and existing
11-kind fallback. Never DROP tables as an automatic rollback, never sweep a
backlog into global push, and never treat re-enabling cron as harmless.


## Incremental safety and read-only preview (11 October continuation)

- The service role now has only **column-level UPDATE** access to
  work_taxonomy_control.catalog_version and updated_at. It CANNOT enable the
  automatic-registration switch or change the operator-controlled hourly budget.
- New category creation is bounded by max_auto_creates_per_hour (default 100),
  enforced under a row lock. This is **not a lifetime category ceiling**.
  Canonical/alias reuse does not consume that hourly budget.
- The registration function independently runs taxonomy_risk_triage_v1; an
  untrusted LOW_RISK_VERIFIED parameter alone cannot authorize a category.
  Rules and permitted action *vocabulary* are server/operator-owned **data**,
  not an 11-kind catalog or a general AI safety model. Examples:
  photographing a celebration / dog training / 3D printing are low-risk
  candidates; drone service / solar panels require review; explicit explosive
  manufacture is blocked; unknown/unclear actions need clarification.
- **IMPORTANT**: The triage is deliberately incomplete and lexical. It is NOT
  legally/regulatorily sufficient, cannot replace full context-sensitive content
  safety or requester identity verification, and MUST NOT be treated as a
  production-ready automatic admission gate. In particular, the service still
  receives an owner-reviewed boolean supplied by its caller, not a separately
  authenticated need/revision proof. The runtime switch must remain OFF.
- catalog-preview.sql adds taxonomy_preview_v1: a read-only server-only preview
  that resolves canonical labels and normalized aliases across locales, refuses
  cross-locale ambiguous collisions, and returns REUSE_EXISTING,
  PROPOSE_AUTO_PROVISIONAL, CLARIFY, REJECT, or SAFETY_REVIEW. It neither invents
  a category ID for a novel proposal nor inserts anything nor creates events.
- Explicit worker opt-out of the **target** category now overrides even an
  otherwise verified equivalent/related skill match. The disposable tests
  prove this for both equivalent and individually consented related offers.
- Normalized alias lookups have a standalone index for locale-independent
  matching, avoiding a catalog-wide synonym scan on each preview.

The UI, actual publish transaction, safe context-aware auto-admission,
requester/worker identity confirmation, full dispatcher and any external push
remain **unintegrated**. Preview and risk evaluation have only isolated tests.
No DEV/PROD mutation, no real notification, no deployment. These are
incremental candidate milestones, not a launch certificate.

## Work identity is not task scope: painting a room vs an apartment

The additional candidate service-meaning.sql stores separately:
- A verified **work intent** (canonical action + object, stable service UUID).
- Verified action surfaces (e.g., krečenje and farbanje).
- Verified place, target and size phrases including bounded numeric quantities.

**Molerski radovi → Krečenje zidova** is one work identity. Variants
such as 'Krečenje sobe', 'Krečenje stana', 'Krečenje 2 sobe',
'Krečenje stanova', Cyrillic forms and 'Farbanje zidova' resolve to
the same category ID, not separate work kinds.

Both preview and guarded registration call the same verified meaning resolver.
Only a COMPLETE, validated scope matches. Unverified phrases are routed
to clarification instead of creating a duplicate or silently notifying.
Painting woodwork or cars is NOT equivalent to wall painting; gletovanje
is a distinct trade skill under the same broader family.

Quantity, room, address and dimensions remain task attributes, not new
work-category identities. The catalog has no fixed count limit and its
verified vocabulary can grow as data without central matcher rewrites.

**LIMITATION:** Sample meaning mappings are fixture-controlled, not generated
by a running AI understanding arbitrary free text. Complex sentences such
as 'Treba mi neko da okreči dnevnu sobu od 25 m2' still require a trustworthy
AI action/object/scope extractor plus deterministic server validation and
requester review. No model's similarity alone can grant worker eligibility.

Acceptance is tested in disposable-meaning-assert.sql, using real isolated
PostgreSQL; not an installed DEV feature. The foundation SQL depends on
service-meaning.sql and must not be applied alone. Operator approval,
formal CLI migration, authenticated entrypoint and rollback remain blocked.
