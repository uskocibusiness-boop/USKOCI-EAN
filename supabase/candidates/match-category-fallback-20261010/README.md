# Matching fallback: AI category → worker skill-kind

**Status: prepared source candidate; real function SQL, exact revert and guarded transactions PASS in disposable PostgreSQL 16 with synthetic fixtures. NOT applied to DEV or PROD. NOT a full certificate/HTTP/provider/phone proof or authorization for promotion.**

## Observed defect (canonical DEV, read-only 2026-10-10)
- The active task AI v60 makes `need.category` mandatory and `need.required_skills` optional. The server function `private.worker_need_fit_v1(uuid,uuid,boolean)` treated an empty required-skills array as a universal skill match.
- Of 1 published task, 1 had no required skills but had a recognized category; both active worker profiles counted as service matches **before** distance/time gates, even without relevant skills.
- Read-only, zero-write simulation against that same pair of current DEV profiles: previous `service` 2/2, proposed `service` 0/2. **This is not a proof of a future task, dispatch, provider or physical push.** The zero matches still have area reasons.

## Exactly what changes
- One shared function: `private.worker_need_fit_v1(uuid,uuid,boolean)` (its output feeds both `Za mene` and matching/dispatch).
- Nonempty explicit `required_skills` keeps authority; when empty, use the already-confirmed `needs.category` as one term.
- Keep exact case-fold matching and the **existing** `private.work_kinds_v5` closed 11-kind alias system; no new categories, prompt, task column, mobile dependencies, RLS or event types.
- **No wildcard** on an absent/unknown category; it matches only if workers use a matching exact term or the existing kind vocabulary recognizes both sides. This narrows *automatic matching*; it does not change the existing hard-block/manual-response policies.
- No changes to tool/vehicle/experience/budget gates or same-area/time rules. Verify opportunity event admission separately.

## Atomic rollback/drift guard
- `candidate.sql` requires predecessor `prosrc` MD5 `ab221f0091d78856bb42f702ddecd016` and checks exact successor MD5 `d18c47226723ffbbec474aa4547e1af1`.
- `revert.sql` refuses anything other than the exact successor before reinstating the exact previous body.
- Both are transaction-wrapped; they check function grant/security metadata and the closure source digest. A certificate-digest change forces rollback. Neither changes existing task rows or old notification queues.
- MD5 identifies source drift only; not an authorization token or cryptographic security claim.

## Proof still required (do NOT run on canonical DEV)
1. **PASS:** Source contract and actual PostgreSQL 16 execution in GitHub Actions (including exact candidate/revert/reapply). [Run 38064158343](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38064158343) checks the anonymized active-worker skill categories with three matching kinds, three unrelated kinds, wrong city, fast dispatch and OWN_NEED. This is a disposable scenario, not a provider send.
2. On an **isolated, disposable faithful DB restore**, prove full SQL before/after: 1) category-only cleaning task + cleaning worker match; 2) unrelated moving worker not matched; 3) empty/unrecognized category does not broadcast; 4) explicit required skills override unrelated category; 5) identical `Za mene`/dispatch decisions; 6) manual response/own task/identity/world/exclusions remain correct; 7) remote vs nearby vs same-city/no-GPS, calendar, urgent, edits and revisions; 8) exact revert/reapply, unchanged closure digest/ACL/RLS and no mutated fixtures.
3. Recheck live exact predecessor SHA, owner decision gate, DEV transaction receipt and readback **before any promotion**. General continuation or push enthusiasm is **not** permission for a server write, Edge deploy, global push or notification send.
4. After safe promotion: one **new naturally published task**, one matching/nonmatching worker, a bounded `OPPORTUNITY_AVAILABLE` sender proof with confirmed device, no historic backlog, and actual phone tap; only then consider broadening to other event types.

## Separate known blockers
- Two active DEV worker profiles have city/radius but NULL approximate match centers; area matching falls back to exact normalized city string, not radius when point absent.
- Pan-to-propose map changes remain in separate **Draft PR #5** and require task-city/point consistency and HONOR proof.
- Bounded OPPORTUNITY push transport candidate is separate and not deployed. The completed single MESSAGE push receipt does not prove it.
