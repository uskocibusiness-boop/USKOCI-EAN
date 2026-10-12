# Interim specialist repair precision — disposable proof, NOT deployed

**Problem (verified against canonical DEV read-only, 12 Oct 2026):**
`private.work_kinds_v5('{Popravka laptopa}')` and `private.work_kinds_v5('{Popravka 3D štampača}')` both return `{SITNE_POPRAVKE}`. The installed matcher thus infers eligibility from a shared **generic** work-family label even though worker capability is not confirmed for the actual specialist job.

**Proposed change (source-only, no DEV/PROD write):**
`source-only-function.sql` is the complete matcher body derived from current installed/candidate `private.worker_need_fit_v1` MD5 `d511b48f7f3b38f52aaffee420108f8a`, with one narrow change. Its fallback still permits verified legacy aliases from other work families, but excludes **generic SITNE_POPRAVKE family overlap** as an implicit worker capability entitlement. Exact confirmed category text matches still pass. The true long-term solution is a stable worker-confirmed UUID work identity from dynamic taxonomy, not a cascade of string heuristics.

**Provenance and tests:**
- `disposable-fixture.sql`: specialist laptop worker, specialist 3D printer worker, generic handyman, two different task categories, fake sessions/calendar.
- `candidate-assert.sql`: exact positive matches, negative cross-specialist and generic-handyman matches, existing cleaning remains matched, and actual `private.dispatch_next_wave` sends only to the confirmed 3D specialist using a **local synthetic event sink**.
- `.github/workflows/generic-repair-precision-disposable.yml`: disposable PostgreSQL 16 service, current matcher known false positive, candidate SQL change, test, restore original function and prove original behavior returned.

**CRITICAL limits:**
- Candidate is NOT a reviewed or deployable migration. It intentionally has no canonical DEV write guard, source+ACL+closure digest transactional release package, integration rollback or real Auth/RLS/FCM proof; **never run it on real Supabase**.
- New matcher still depends on 11 pre-existing closed kinds for most aliases; not a general synonym/semantic classifier.
- This interim guard intentionally prefers **missing a speculative opportunity** over sending specialist work to a person who confirmed only unrelated general repairs. Owner must review impact on legitimate existing generic-handyman use cases.
- Full dynamic taxonomy integration, human-confirmed worker capability, review, zero-match diagnostics, safety and full end-to-end proof must precede release. No current Android APK relies on this candidate.
