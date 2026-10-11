# Isolated specialist repair matcher proof — 12 Oct 2026

**Actual outcome:** **PASS**.

**Proof:** [GitHub Actions run 38182500569](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38182500569), job `114597849116`, workflow `generic-repair-precision-disposable.yml`, source commit `f017c65ab67dca022f3b8e51400ecc4f6f4ca104`.

Verified in **disposable PostgreSQL 16**, with fake accounts, profiles and task rows:
1. The current/previous USKOČI matcher demonstrably admitted a **laptop repair** worker for a **3D printer repair** task due to the shared old `SITNE_POPRAVKE` family.
2. After substituting the next **source-only** matcher, exact confirmed laptop and 3D printer repair workers remained eligible for their own task.
3. Cross-specialist and generic-handyman guessed eligibility was blocked.
4. Existing cleaning task matching continued to work.
5. A real captured `private.dispatch_next_wave` call, using local-only notification adapter, delivered to **exactly one confirmed 3D printer specialist**, not the unrelated workers.
6. Reinstalling the original function restored the original baseline, validating isolated source rollback behavior.

Extracted log evidence:
- `REPAIR_PRECISION_PASS: exact confirmed specialists yes, cross-domain and generic guesses no`
- `REPAIR_PRECISION_REAL_DISPATCH_PASS: exact printer expert only`
- `REPAIR_PRECISION_SOURCE_ONLY_PASS; NO DEV/PROD ACCESS`

**Boundary:** The source candidate is NOT an authorized DEV deployment or audited migration. It lacks the guarded canonical source/ACL/digest transaction, migration history, performance proof, real Auth/RLS/FCM consent and phone proof. It is an **interim** fix for one broad family; full dynamic taxonomy remains uninstalled and required. Treat it as a candidate test, not a release certificate.

Latest canonical DEV comparison in `supabase/proofs/deploy_inventory/dev-actual-vs-repo-readonly.sql` reported **14/14 SQL sources matching**, 11 legacy kinds, **0 dynamic taxonomy tables/functions** and 2 index.ts Edge source differences (worker AI, push transport).
