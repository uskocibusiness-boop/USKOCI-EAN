# R04 Semantic Admission: Single-Word & Synonym Task Publication Unblock

Status: **PREPARED_NOT_APPLIED** on DEV (`leqcwgzvjsxugfgzdmth`).

The task publication screen (`pregled-zadatka.tsx`) previously blocked publishing for single-word service names (such as "Lektura", "Šišanje", "Moler") and unrecorded human-reviewed synonyms with `PENDING_CLASSIFICATION` / "Provera usluge još nije završena", disabling the "Objavi zadatak" action button.

## Cause and bounded correction

1. In `private.taxonomy_risk_triage_v1`:
   - A legacy constraint required multi-word phrases (`v_key !~ '[[:space:]]'` returned `NEEDS_CLARIFICATION`).
   - Correction: removed the space requirement while enforcing minimum length >= 3 characters.
   - Retained strict screening: prohibited/dangerous terms (`BLOCKED`), regulated medical/legal fields (`REVIEW_REQUIRED`), and broad ambiguous catch-alls (`ostalo`, `drugo`, `razno`, `sve`, `svasta`, `bilo sta`, `klima`, `namestaj`, `digitalni zanati`, etc. return `NEEDS_CLARIFICATION`).
2. In `private.taxonomy_review_candidate_projection_v2`:
   - Single unrecorded proposals with `LOW_RISK_CANDIDATE` triage now produce `status: 'READY'` with a valid candidate plan in `classificationCandidates`.
   - Ambiguous proposals remain `PENDING_CLASSIFICATION`.
   - Sensitive or regulated proposals remain `REVIEW_REQUIRED`.
3. In `private.needs_sync_taxonomy_category_trigger_fn`:
   - Resolves `category_id` from both canonical keys and registered aliases in `private.work_taxonomy_aliases`.

## Scope of changes

Only three existing function bodies change:
- `private.taxonomy_risk_triage_v1(text)`
- `private.taxonomy_review_candidate_projection_v2(text,jsonb,jsonb,uuid,uuid)`
- `private.needs_sync_taxonomy_category_trigger_fn()`

Closure state, certificate, digests, export bindings, and erasure programs remain completely unmodified.

## Verification

Run local package verification:
```bash
node --test supabase/operations/dev-alpha/r04-semantic-admission-20261101/package.test.mjs
node supabase/operations/dev-alpha/r04-semantic-admission-20261101/build.mjs --check
```
All 6 package tests pass with zero regressions.
