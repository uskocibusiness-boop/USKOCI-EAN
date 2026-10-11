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
