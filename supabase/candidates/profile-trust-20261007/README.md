# PROFILE-TRUST — the worker's trust profile (Airbnb host / Uber driver style), 2026-10-07

**Ukratko za vlasnika (srpski):**
- Javni profil Uskočera dobija: broj završenih Dogovora (kao i danas), broj Dogovora, pouzdanost u procentima i „Na USKOČI od“ (mesec).
- Pouzdanost = završeni / (završeni + oni koje je SAM radnik otkazao). Otkazivanje naručioca se ne računa protiv radnika. Ispod 5 takvih Dogovora procenat se ne prikazuje.
- Ko vidi pouzdanost, broj Dogovora i „od kada“ je TVOJA odluka o privatnosti: dok ne kažeš, vidi ih samo osoba sama (`OWN_ONLY`). Jedna skripta to menja u „svi prijavljeni koji vide profil“ (`PUBLIC`) i nazad.
- Osoba vidi i svoj tok „Poslate prijave → Dogovoreno → Završeno“; broj prijava nikad nije javan.
- Osoba vidi svoje primljene ocene. Druga tvoja odluka: da li se ocene BEZ komentara pokazuju pojedinačno sa licem autora (`ALL`) ili, kao do sada za D12, samo one sa komentarom (`COMMENTED_ONLY`, podrazumevano). Komentar autora koji je osobu blokirao se vidi, a lice autora je sakriveno (tvoja odluka A09).
- Nova tabela ne postoji; sertifikat se ne pomera; ništa nije primenjeno na DEV. Reč za primenu: **„PRIMENI PROFILE-TRUST“** (posle CANCEL-INFO).

**Status: SOURCE ONLY, NOT APPLIED.** Canonical DEV `leqcwgzvjsxugfgzdmth` only on the owner's exact word **`PRIMENI PROFILE-TRUST`**, and only **after CANCEL-INFO** (the side of a cancellation has ONE definition, `private.agreement_cancellation_facts_v1`, pinned here; the candidate refuses without it). Independent of ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE (any order; both orders proven). ZONE-PERF has been applied on DEV since 2026-10-07 19:22 (migration `20261007192233`, ledger 228); the read-only preflight on DEV after that: `dependencyDrift: []`, `readShapesAsExpected: true` (D12's comment table present), `newFunctionsAndRowsAbsent: true`, certificate `3a785d42…` ready, 7 reviews, 0 comments, 5 active worker profiles. Proof: `.github/workflows/profile-trust-cancel-info-proof.yml` (disposable database only).

## One deviation from the request, on purpose: the key is the PROFILE id

The request named `rpc_public_work_trust_v1(p_account_id uuid)`. The function takes **`p_profile_id`**, like `rpc_get_public_profile`: the client holds a public profile id on the public profile sheet and on every candidate card (`KandidatProjekcija.radnikProfilId`: "nikada auth/account id"), and another person's account id only inside a Dogovor. An account-keyed read could not be called from the two places the trust block is shown. A WORKER profile belongs to exactly one account (`unique(account_id, kind)`), so the numbers are the same. A REQUESTER profile id answers `null` (no work-trust block for the requester face in V1; a mirrored requester rule would be a function-only follow-up).

## Definition WORK_TRUST_V1 (exact)

For one WORKER profile `P` of account `A`, over `public.agreements` with `worker_account_id = A and worker_profile_id = P`:

| field | rule |
| --- | --- |
| `completedCount` | `status = 'COMPLETED'` — the **same set** as `trust.completedCount` of `rpc_get_public_profile` (`worker_profile_id = P and status = 'COMPLETED'`; the account condition is the index path, equal because a profile has one account; DEV check 2026-10-07: 0 mismatches over 5 worker profiles, and the postflight re-checks every worker profile) |
| `agreedCount` | every Dogovor of the profile as worker, any status |
| cancelled by the worker | `status = 'CANCELLED'` and CANCEL-INFO's `cancelledBy = 'WORKER'` |
| qualifying | completed + cancelled by the worker |
| `reliabilityPercent` | `floor(100 * completed / qualifying)` as an integer; **`null` while qualifying < 5** |
| not counted (either way) | cancelled by the requester; a cancellation whose side is no longer recorded (`cancelledBy: null`); open Dogovori (`CONFIRMED`, also when the worker said "gotovo"); legacy `SUPERSEDED` |
| `memberSince` | first day of the month of `app_profiles.created_at` of the WORKER profile, Europe/Belgrade, `YYYY-MM-01` (the profile is created at sign-up) |

"After the agreement became binding": a Dogovor row exists only once the requester selected the application (it is created `CONFIRMED`), so every cancellation by the worker counts. `floor` and not `round`: 199 completed and 1 cancellation is 99 %, never "100 %". Statuses used: `agreements.status` ∈ {CONFIRMED, SUPERSEDED, CANCELLED, COMPLETED}; the execution states (CONFIRMED, AWAITING_REQUESTER, COMPLETED, CANCELLED) are not needed.

Truth table the proof asserts (seeded with real accounts, see Evidence):

| worker | Dogovori | completed | cancelled by worker | by requester | side unknown | open | reliabilityPercent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W0 | 0 | 0 | 0 | 0 | 0 | 0 | null (0 qualifying) |
| W3 | 3 | 2 | 1 | 0 | 0 | 0 | null (3) |
| W4 | 4 | 4 | 0 | 0 | 0 | 0 | null (4) |
| W5 | 5 | 4 | 1 (after "gotovo") | 0 | 0 | 0 | 80 |
| W5R | 7 | 5 | 0 | 2 | 0 | 0 | 100 (requester cancellations do not count) |
| W12 | 12 | 9 | 1 | 1 | 0 | 1 | 90 |
| WU | 9 | 5 | 2 (one while blocked, one whose event was erased) | 1 | 1 | 0 | 71 (5/7; counting the unknown side would give 62) |

## Visibility — the owner's privacy decision (not made yet)

One data row, `private.marketplace_config` key **`profile_trust_visibility`**, written by the candidate as `{"schema": "PROFILE_TRUST_VISIBILITY_V1", "mode": "OWN_ONLY", "owner": "PROFILE-TRUST 2026-10-07"}`.

- **`OWN_ONLY` (default):** `agreedCount`, `reliabilityPercent` and `memberSince` are returned only to the person themself; every other admitted viewer gets them as `null` with `reliabilityState: "HIDDEN"`. `completedCount` keeps exactly the exposure of today's public profile. `agreedCount` is gated with the others because `agreedCount − completedCount` would otherwise show how many Dogovori did not end in completion.
- **`PUBLIC`:** any authenticated viewer who may see the person's public profile (the same gates as `rpc_get_public_profile`: ACTIVE profile, neither side closing, no block either way, same world) reads them.
- **Fail closed:** anything other than exactly `"PUBLIC"` (no row, another word, lower case, another JSON type) reads as `OWN_ONLY` (proven).
- Switch scripts (one guarded `update` of one row, refuse unless the row is in the expected mode; a state-changing DEV write: only on the owner's exact word):
  - `switch-public.sql` → word **`PRIMENI PROFILE-TRUST JAVNO`**
  - `switch-own-only.sql` → word **`PRIMENI PROFILE-TRUST SAMO-JA`**

## Received reviews — a second owner decision (not made yet)

One data row, key **`received_reviews_detail`**, default `{"schema": "RECEIVED_REVIEWS_DETAIL_V1", "mode": "COMMENTED_ONLY", ...}`.

- **`COMMENTED_ONLY` (default):** the list holds the reviews whose comment the reviewed person may read (below); star-only reviews stay **aggregate-only**, as the accepted D12 default decided for the public list (an author who gave only stars was never told the reviewed person would see them one by one with the author's face). `totalCount` and `notListedCount` make the list add up to the public `reviewCount`.
- **`ALL`:** every received review is listed one by one (stars, tags, date, the author's face when allowed, the comment when allowed). This is new disclosure of individual star ratings and tags to the reviewed person (Uber shows drivers only the average; Airbnb shows hosts the public reviews) — the owner decides.
- Switches: `switch-reviews-all.sql` → **`PRIMENI PROFILE-TRUST SVE-OCENE`**, `switch-reviews-commented-only.sql` → **`PRIMENI PROFILE-TRUST SAMO-KOMENTARI`**.

Comment rules (the D12 reader `rpc_list_review_comments_v1` with the reviewed person as viewer, plus owner decision **A09**):

| situation | listed in COMMENTED_ONLY | reviewer face | comment |
| --- | --- | --- | --- |
| ordinary commented review | yes | shown (`masked: false`) | shown |
| the **author blocked the reviewed person** (A09) | yes | **masked** | **shown**; `agreementId` returned so it can be reported |
| the **reviewed person blocked the author** | no | masked | not shown (the viewer's own block, as in D12) |
| comment hidden by moderation (`hidden_at`) | no | shown | not shown |
| author under a closure restriction | no | masked | not shown (the closure erases it) |
| author in another world (TEST/REAL) | no | masked | not shown |
| author's profile not ACTIVE | no | masked | not shown |
| star-only review | no (ALL: yes) | shown | none |

The stars of every review count in the public aggregate whatever this list shows.

## Client contract (EXECUTE: `authenticated` only; never `anon`)

**`rpc_public_work_trust_v1(p_profile_id uuid)`** → `null` (unknown, not an ACTIVE WORKER profile, closing viewer or subject, blocked pair, other world) or:

```json
{"schema": "PUBLIC_WORK_TRUST_V1", "profileId": "uuid", "role": "WORKER", "self": false, "visibility": "OWN_ONLY",
 "completedCount": 9, "agreedCount": null, "reliabilityPercent": null, "reliabilityState": "HIDDEN | TOO_FEW | AVAILABLE",
 "reliabilityMinimum": 5, "memberSince": null, "definition": "WORK_TRUST_V1", "authoritative": true}
```
(self or `PUBLIC`: `agreedCount` 12, `reliabilityPercent` 90, `memberSince` "2026-10-01", `reliabilityState` "AVAILABLE" or "TOO_FEW"). Errors: `AUTH_REQUIRED` (42501), `PROFILE_ID_REQUIRED` (22023).

**`rpc_my_work_stats_v1()`** (the caller only; no parameter):

```json
{"schema": "MY_WORK_STATS_V1", "hasWorkerProfile": true, "profileId": "uuid", "profileStatus": "ACTIVE",
 "applicationsSent": 14, "agreementsMade": 12, "agreementsCompleted": 9, "agreementsActive": 1,
 "cancelledByMe": 1, "cancelledByRequester": 1, "cancelledSideUnknown": 0,
 "reliabilityPercent": 90, "reliabilityState": "AVAILABLE", "reliabilityMinimum": 5, "memberSince": "2026-10-01",
 "definition": "WORK_TRUST_V1", "asOf": "timestamptz", "authoritative": true}
```
`applicationsSent` = applications of the caller's worker profile that left the draft state (any later status: viewed, selected, not selected, withdrawn, expired, stale). Errors: `AUTH_REQUIRED` (42501), `ACCOUNT_CLOSING` (42501).

**`rpc_list_received_reviews_v1(p_limit integer default 20, p_after text default null)`** (the caller's received reviews, newest first):

```json
{"schema": "RECEIVED_REVIEWS_V1", "mode": "COMMENTED_ONLY | ALL",
 "items": [{"reviewId": "uuid", "rating": 2, "tags": ["AS_AGREED"], "createdAt": "timestamptz", "agreementId": "uuid",
            "taskTitle": "text", "receivedAs": "WORKER | REQUESTER",
            "reviewer": {"profileId": null, "role": "REQUESTER", "displayName": null, "avatarPath": null, "masked": true},
            "comment": "text | null"}],
 "hasMore": false, "nextAfter": "2026-10-07T18:23:45.123456Z|<reviewId> | null", "limit": 20,
 "totalCount": 8, "notListedCount": 6, "asOf": "timestamptz", "authoritative": true}
```
`p_limit` is clamped to 1..50 (null → 20); `p_after` is the opaque `nextAfter` of the previous page (anything else: `INVALID_PAGE`, 22023). Order `(createdAt desc, reviewId desc)`, stable under inserts. `avatarPath` is returned exactly as `rpc_get_public_profile` returns it (it may embed the author's account id, the owner-accepted 2026-09-22 disclosure). Errors: `AUTH_REQUIRED`, `ACCOUNT_CLOSING`, `INVALID_PAGE`. Never `40001`.

## Exact boundaries

| object | change |
| --- | --- |
| `public.rpc_public_work_trust_v1(uuid)`, `public.rpc_my_work_stats_v1()`, `public.rpc_list_received_reviews_v1(integer,text)` | NEW, plpgsql, STABLE, SECURITY DEFINER, `search_path=pg_catalog`, ACL `{postgres=X/postgres,authenticated=X/postgres}` |
| `private.work_trust_counts_v1(uuid)`, `private.profile_trust_visibility_v1()`, `private.received_reviews_detail_v1()` | NEW, SQL, STABLE, SECURITY DEFINER, `search_path=pg_catalog`, ACL `{postgres=X/postgres}` |
| `private.marketplace_config` | two data rows: `profile_trust_visibility`, `received_reviews_detail` |
| pinned, unchanged | `rpc_get_public_profile` `9ecc0b69…`, `safety_pair_blocked` `698fb21a…`, `closure_account_restricted` `f4999250…`, `accounts_same_world` `16f541f9…`, `account_visibility_world` `876cfc16…`, `account_lineage` `c0860253…`, CANCEL-INFO `agreement_cancellation_facts_v1` (md5 in `manifest.json`); the read shapes of the eight tables it reads, including D12's `private.agreement_review_comments_v1` |

**Closure certificate: does not move.** None of the six functions is a certified signature or a trigger function; no table/column/constraint/trigger/policy/grant on an existing object changes; the two rows are data. The apply and the revert assert both digests unchanged and the certificate ready (DEV `3a785d42…` / `2027655d…`). No errcode `40001` anywhere (B24).

## Evidence

**Proof run [37675024181](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37675024181) (commit `4b4c7585`): job `behavior` success (43 of 43 checks), job `order` success (5 of 5).** Disposable database only, real Auth and PostgREST, no DEV access, no provider, no push. The first run [37673616896](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37673616896) (`3c68ad8d`): `order` success; `behavior` stopped after 7 green checks on a defect of the proof harness (circular JSON in its report), fixed without touching a candidate file.

Fidelity (bounded relevant-body fidelity, not global DEV equivalence): the MATCH-V1 proof chain with its 23 pinned DEV bodies; all six PROFILE-TRUST dependencies and the CANCEL-INFO ones byte-identical to DEV on the chain. **The chain does not replay D12**, so `surface.mjs` installs a read-equivalent D12 surface: a table with DEV's columns and CHECK constraints in the uncertified schema `proof_d12_surface`, the view `private.agreement_review_comments_v1` over it (views are outside both closure digests: the chain certificate is asserted unchanged) and the exact DEV text of the D12 reader `rpc_list_review_comments_v1` (`0712dcb3…`) as the reference. Not reproduced: the forbidden-character CHECK, the two triggers and RLS of the DEV table (fixture comments are plain ASCII written as the owner and only read through the functions under test). On DEV the owner role `postgres` has BYPASSRLS and owns both FORCE-RLS review tables (read-only check 2026-10-07: a definer function reads all 7 reviews), so the definer readers see the same rows there.

Seed (real accounts through the product writers; 12 labelled bypasses for what the product has no writer for on this chain: display names, a closure's deleted event / replaced text, a moderated comment, a suspended profile, a closure request, the nine fixture comments): 7 workers, 9 requester accounts, 40 Dogovori, 9 reviews. What it showed:

- **WORK_TRUST_V1 truth table** equal to the seeding oracle for all seven workers (the table above): 0/3/4 qualifying → null, W5 80, W12 90, W5R 100 (requester cancellations not counted), WU 71 (the unknown side not counted). `applicationsSent` includes a pending and a withdrawn application (W12: 14).
- **completedCount** equals `rpc_get_public_profile(...).trust.completedCount` for every worker.
- **OWN_ONLY**: another viewer gets `completedCount` only (`HIDDEN`), the person themself everything; **fail closed** for `EVERYONE`, `public`, a JSON string and no row; **PUBLIC** via `switch-public.sql`: every admitted viewer reads `agreedCount`, `reliabilityPercent`, `memberSince`; the switch refuses from the wrong state; `switch-own-only.sql` hides again.
- **Gates**: unknown id, a REQUESTER profile, a block either way (also in PUBLIC mode), another world, a suspended profile, a closure-restricted subject → `null`; a closing viewer → `null` in SQL and `ACCOUNT_CLOSING` from the PostgREST pre-request guard; null id → `PROFILE_ID_REQUIRED`; anonymous → denied on all three reads; own reads of a closing account → `ACCOUNT_CLOSING`; an account without a worker face → zeros and null.
- **Received reviews**: COMMENTED_ONLY = exactly the DEV D12 reader's items for the reviewed person **plus** the A09 comment of the author who blocked them (face masked, comment and `agreementId` present); `totalCount` 8, `notListedCount` 6. ALL mode: the eight reviews with face/comment exactly by the table above (closure-restricted, suspended, other-world author masked without comment; moderated comment hidden with the face shown; the person's own block masks and hides; the author's block masks and shows; star-only shown without comment). Keyset pages of 3 stable and complete; limit clamped 1..50 (null → 20); six malformed cursors → `INVALID_PAGE`; another account sees only its own received review; the public aggregate still counts all eight.
- Grants: the three RPCs EXECUTE for `authenticated` only (not anon, PUBLIC, service_role), the three helpers owner-only, all SECURITY DEFINER, STABLE, `search_path=pg_catalog`. FAIL before (PGRST202), refusals atomic (drift, missing CANCEL-INFO, revert before apply, repeated apply, CANCEL-INFO revert while PROFILE-TRUST is applied), exact revert of catalog, config rows and certificate, FAIL again after the revert, no new `40001`.

Timing on the seeded set (server execution, a cold call in a fresh backend, then warm median; CI hardware):

| read | cold ms | warm ms | through PostgREST |
| --- | --- | --- | --- |
| `rpc_public_work_trust_v1` (W12, 12 Dogovori) | 8.6 | 2.4 | 6 ms |
| `rpc_my_work_stats_v1` (W12) | 8.1 | 2.2 | 6 ms |
| `rpc_list_received_reviews_v1(20)` (W12, 8 reviews, ALL) | 12.1 | 4.7 | 8 ms |
| for comparison `rpc_get_public_profile` (W12) | 4.4 | 0.5 | |

Cost grows linearly with one person's Dogovori and received reviews (one lookup of the cancellation event and message per cancelled Dogovor; two block lookups, a closure and two world lookups per review); no per-request scan of other people's rows.

Order (job `order`): A the chain without the three: applies, answers, reverts exactly; D **DEV as it is now, ZONE-PERF alone**: the same answers byte for byte, our revert returns exactly that state; B ZONE-PERF → MATCH-V1 → DISCOVERY-ZAMENE first: the same answers, our revert returns the three-applied catalog, theirs the base; C ours first: the same answers, their revert returns our catalog, ours the base; the certificate never moves.

## Apply order on the owner's word

0. CANCEL-INFO applied (`PRIMENI CANCEL-INFO`).
1. `preflight.readonly.sql` → `certificateReady`, `cancelInfoApplied`, `readShapesAsExpected`, `newFunctionsAndRowsAbsent` true; `dependencyDrift` `[]`; `agreementWorkerProfileOfAnotherAccount` 0.
2. `candidate.sql` as one migration (`candidate.in-transaction.sql` for a wrapper with its own transaction).
3. `postflight.readonly.sql` → `newFunctions`, `anonCannotExecute`, `authenticatedCanExecute`, `configRowsAtDefault` true; `completedCountMismatches` 0; certificate equal to the preflight; receipt in `supabase/operations/dev-alpha/ledger/`.

**Revert:** `revert.sql` drops the six functions and deletes both rows whatever mode they were switched to (code + configuration rollback; no user data is touched). Then CANCEL-INFO may be reverted.

## Privacy decisions left to the owner

1. `profile_trust_visibility`: `OWN_ONLY` (default) or `PUBLIC`.
2. `received_reviews_detail`: `COMMENTED_ONLY` (default) or `ALL`.
3. Tags of listed reviews are returned to the reviewed person (today only the author sees their own tags). The six tags are all positive (AS_AGREED, CAREFUL, CLEAR_COMMUNICATION, ON_TIME, RELIABLE, RESPECTFUL).
4. A comment by someone the reviewed person blocked stays hidden from them (D12's viewer rule); A09 covers only the other direction. If the owner wants the reviewed person to read even those (masked), it is a one-line function change.
5. No text anywhere may promise anonymity (A10): an individually listed review is attributable through its Dogovor (agreementId and task title are the person's own data).

## Not included

No requester-face trust block, no response-time or acceptance-rate metric, no cached score column, no change to `rpc_get_public_profile` or the D12 readers (the D12a follow-up for the PUBLIC list, A09 + A11 role-scoped, stays its own package), no client code.

## Files

`build_candidate.py` (generator, `--check`; reads CANCEL-INFO's manifest), `live-functions.json` (exact DEV bodies of the six pinned dependencies, read-only readback 2026-10-07), `candidate.sql`, `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `switch-public.sql`, `switch-own-only.sql`, `switch-reviews-all.sql`, `switch-reviews-commented-only.sql`, `manifest.json`. Offline check: `python supabase/proofs/profile-trust/check_source.py`. Runtime proof: `supabase/proofs/profile-trust/`.
