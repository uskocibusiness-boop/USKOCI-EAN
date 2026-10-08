# DISCOVERY-GRAD — pretraga razume grad i ne zavisi od kvačica (odluka vlasnika d14, 7.10.2026)

**Status: SAMO IZVORNI KOD, NIJE PRIMENJENO.** Kanonski DEV `leqcwgzvjsxugfgzdmth` samo na tačnu reč vlasnika **`PRIMENI DISCOVERY-GRAD`**, i samo posle DISCOVERY-ZAMENE (na DEV-u je primenjen, ledger 232). Neobavezni deo **S3** ima svoju reč: **`PRIMENI DISCOVERY-GRAD S3`**. Dokaz: `.github/workflows/discovery-grad-proof.yml` (jednokratna baza, nikad DEV); poslednje zeleno pokretanje **37704756107** (commit `c96dedec`).

## Ukratko za vlasnika

- **Mesto je sada grad.** Kad izabereš „Novi Sad“, dobiješ SVE zadatke u Novom Sadu (Liman, Detelinara…, i zadatke bez tačke na mapi), a ne samo one gde piše tačno „Novi Sad“. Deo grada („Detelinara, Novi Sad“) i dalje daje samo taj deo. Zadaci na daljinu i zadaci bez ikakvog mesta nikad nisu „u mestu“.
- **Kvačice, velika slova i ćirilica ne smetaju**, u oba smera, u rečima, u mestima i u pretrazi liste mesta: „cistim“ nalazi „čistim“, „Cacak“ = „Čačak“, „Djordje“ = „Đorđe“ (đ = „dj“), „Нови Сад“ = „Novi Sad“, „elektricne“ nalazi veštinu „Električne instalacije“. Ništa što se nalazilo do sada ne nestaje (dokazano na 154.308 parova naslov–reč: 0 izgubljenih).
- **Lista mesta može da bude lista gradova** sa brojem („Novi Sad · 23“): nov, neobavezan izbor `groupBy: "CITY"`; broj reda je tačno ono što filter mesta onda pokaže (dokazano za svaki red). Bez tog izbora lista je ista kao danas, samo su „Čačak“ i „Cacak“ jedno mesto.
- **Brže:** filter mesta je 3–6 puta brži nego danas (2.000 otvorenih zadataka: oko 125 → 38 ms, sa S3 19 ms). Pretraga reči je oko 20 ms sporija (oko 80 → 98 ms; sa S3 oko 85 ms), jer se svaki zadatak čita bez kvačica. Sve ostalo je isto.
- **S3 (neobavezno):** obična strana zadataka danas za svaki otvoren zadatak računa dane i kad nije izabrano vreme; sa S3 to radi samo kad je vreme izabrano. Obična strana je oko četvrtinu brža (30 → 22 ms na 2.000 zadataka), a svi odgovori su isti (dokazano).
- **Šta se ne menja:** redosled, mapa, „Za mene“, brojevi, sidra i kursori. Zahtev bez reči i bez mesta daje isti odgovor bajt po bajt (dokazano na 18 vrsta zahteva).
- **Bezbednost:** jedna nova pomoćna funkcija i jedno telo funkcije (S3: samo telo). Nema nove tabele, kolone, okidača, politike ni ekstenzije (`unaccent` nije potreban). Sertifikat zatvaranja se ne pomera (proverava se u istoj transakciji). Tačan povratak: `revert.sql` (i `s3-revert.sql` pre njega, ako je S3 primenjen).
- **Tvoje odluke (nijedna ne blokira primenu):** (1) da li i „d“ bez kvačice treba da nađe „đ“ („Dorde“ → „Đorđe“); sada važi „dj“ kako je odlučeno; (2) da li primeniti S3; (3) kad se spoje dva pisanja istog mesta, lista pokazuje poslednje objavljeno pisanje (isto pravilo kao danas za velika/mala slova).

## What changes, exactly

One new helper and anchored edits of one body (`body.diff`, `patches.json`):

- **`public.discovery_fold_v1(text) returns text`** — `language plpgsql`, `IMMUTABLE`, SECURITY INVOKER, `search_path=pg_catalog`, owner `postgres`, EXECUTE `authenticated` only (`{postgres=X/postgres,authenticated=X/postgres}`, the ACL of the `p6_discovery_*` helpers it sits next to). Lower case with the Serbian ICU collation, then Serbian Latin and Serbian Cyrillic letters to plain Latin, letter by letter: č ć → c, š → s, ž → z, **đ → dj**, Cyrillic ђ → dj, љ → lj, њ → nj, џ → dz, ћ ч ц → c and every other Serbian Cyrillic letter to its Latin letter. Nothing else changes (other letters, digits, punctuation and white space stay). The body is one `return` of one expression and pure ASCII (every non-ASCII letter is `chr(n)`), so no transport can rewrite an escape. PL/pgSQL on purpose: a SQL function with a locked `search_path` cannot be inlined and starts the executor on every call; a PL/pgSQL simple expression does not. It is only for **finding**: no shown text, key or stored value passes through it.
- **`public.rpc_discovery_v1(jsonb)`** (predecessor = the DEV body `dc69802e…`, the DISCOVERY-ZAMENE postimage; after `a9b09859…`; language, volatility, `search_path`, owner, ACL and comment unchanged and asserted):
  - **words** (`filter.text`): found in the title, the place text and the needed skills, tools and vehicles (the same text as before, in the same order) after the fold of both sides, one fold per task over that whole text;
  - **place** (`filter.place`, PAGE and MAP): a task matches when the folded place equals its **whole place text** (as before) **or its city**. The city is `approximate_city`; for a task that names no city it is the last part of its place text after a comma (`"Vračar, Beograd"` → `Beograd`). Remote tasks and tasks with no place text never match a place (as before); a task **without a point** but with a city matches, and in an area scope it is listed in its own section (as before). The decision is made **once per distinct (area, city) text** of the rows the reader already read (`place_keys`, length-prefixed keys, behind two `OFFSET 0` fences so the planner cannot push the test back to once per task), instead of computing the place text twice per task as before;
  - **PLACES**: rows are merged by the fold (texts that differ only by Serbian letters, case or script are one row; case was already merged); the PLACES `prefix` is found through the fold; the optional request key **`groupBy`** (`"AREA"` = today, `"CITY"` = one row per city) — see `CLIENT_CONTRACT.md`;
  - nothing else: `forMe`, scopes, sections, paging, the map grid, counts, availability, EXACT_PUBLIC and every response shape are the same text. The PLACES arm inside the general statement is unreachable (the dedicated PLACES block returns first, since P6 places cost v1) and is left as it is.

### Differences for requests WITHOUT the new key (the goal of the package, nothing else)

1. `filter.text` non-empty: more tasks can match (other spellings). **No task found before is lost**: the fold maps each letter to one or two letters and never removes one, so a word that occurred before still occurs (proved: 0 lost of 154,308 title/word pairs, 3,279 gained).
2. `filter.place` non-empty: a city name now lists the whole city; a whole place text with a comma lists what it listed before (plus other spellings of the same text).
3. PLACES: two place texts that differ only by Serbian letters or script become one row (sum of both counts; the shown text is the most recently published spelling, the rule of today for case); a `prefix` finds them without the letters.
4. Unchanged: `filterKey`, anchors and cursors of every request (the filter key is built from the same request text as before; only PLACES with `groupBy: "CITY"` gets another key). A chain opened before the apply continues after it without a refusal (proved); for at most the 30 minutes of its anchor it can see the new matches from its next page on.

## The optional part S3 (`s3-*.sql`, own owner word)

Every PAGE call computes the days of **every** open task (`p6_discovery_days`, PL/pgSQL with an exception block, about 5–11 µs a task) even without a time filter, only to answer `availability.hasKnownSchedule`. S3 computes them only for a time filter (as MAP and PLACES already do) and answers `hasKnownSchedule` with an `EXISTS` that stops at the first task with known days. Without a time filter the days feed nothing else (`time_ok` and the `undated` count read them only when a time is wanted), so every answer stays the same: proved on 20 kinds of request with their anchors (all time words, a date range, area, point, words, place, MAP, PLACES, CITY, EXACT_PUBLIC, "Za mene"), including `availability` and an `undated` task, before / after S3 / after its revert. The function profile shows a default page calling the days helper once instead of 2,000 times. Two edits of the same body (`s3-body.diff`, `s3-patches.json`); pins the DISCOVERY-GRAD body `a9b09859…` and the helper; after `225edbb8…`; `revert.sql` refuses while S3 is applied (`DISCOVERY_GRAD_REVERT_REQUIRES_S3_REVERT_FIRST`). Not done (a separate package): the area filter in the first step, which `counts.mapped` (all tasks of the filter, whatever the area) prevents without a second, cheaper count.

## Exact boundaries and guards

- `candidate.sql` (one transaction) and `candidate.in-transaction.sql` (the same without `begin`/`commit`, for a wrapper that brings its own transaction): certificate ready → a repeated or partial application is named first (`DISCOVERY_GRAD_ALREADY_OR_PARTIALLY_APPLIED`) → predecessor pin (`DISCOVERY_GRAD_PREDECESSOR_DRIFT`) → six dependency pins (`DISCOVERY_GRAD_DEPENDENCY_DRIFT`: `p6_discovery_key`, `p6_discovery_trim`, `p6_discovery_unquote`, `p6_discovery_area`, `discovery_for_me_state_v1`, `discovery_for_me_v1`, DEV md5 of 2026-10-08) → the ICU collation (`DISCOVERY_GRAD_COLLATION_MISSING`) → helper created, revoked, granted → body replaced with preimage, payload, anchor, postimage and metadata checks (`…_PREIMAGE_DRIFT`, `…_PAYLOAD_DRIFT`, `…_BODY_ANCHOR_DRIFT`, `…_POSTIMAGE_OR_METADATA_DRIFT`) → helper metadata and ACL (`DISCOVERY_GRAD_HELPER_DRIFT`) → the fold truth table of 26 probes, Latin and Cyrillic, both cases, NULL and empty (`DISCOVERY_GRAD_FOLD_TRUTH_TABLE`) → reader md5 and ACL → certificate unchanged and ready. Every refusal is errcode `55000`; the package has no errcode `40001` (B24).
- `revert.sql`: refuses while S3 is applied, unless the reader is exactly the postimage and the helper exactly as created, and while any other function body calls the helper (`DISCOVERY_GRAD_REVERT_HELPER_IN_USE`); restores the DEV body `dc69802e…`, drops the helper, asserts the certificate unchanged. Code rollback only: the package writes no data.
- `s3-candidate.sql` / `s3-candidate.in-transaction.sql` / `s3-revert.sql`: the same guards for the one body (`DISCOVERY_GRAD_S3_ALREADY_APPLIED`, `DISCOVERY_GRAD_S3_REQUIRES_DISCOVERY_GRAD`, `DISCOVERY_GRAD_S3_REVERT_PREIMAGE_DRIFT`, certificate unchanged).
- `preflight.readonly.sql` / `postflight.readonly.sql` / `s3-postflight.readonly.sql`: read-only; every flag true, the truth table again on the server, the certificate value, the count of functions with the retried literal (0 on DEV). The preflight was run read-only on canonical DEV on 2026-10-08: ledger 232, `readerIsDiscoveryZamene`, `dependencies`, `helperAbsent`, `collationReady`, `certificateReady` all true, retried literal 0, 6 open tasks, 0 open tasks without a city but with a comma in the area; and again after MATCH-V1B was applied to DEV (ledger 233, `20261007230023`): the same flags true, `private.worker_need_match_v1` unchanged (`ef94ef7d…`). MATCH-V1B changes only the dispatch, no body DISCOVERY-GRAD replaces or calls (the proof chain does not replay it).

## Certificate

**Does not move.** `closure_source_digest_v5` hashes a fixed list of 99 functions plus the schema digest and the erasure program digest; `rpc_discovery_v1` is not in it (DISCOVERY-ZAMENE replaced the same body with the certificate unchanged on DEV) and a new non-trigger function is not hashed. The apply and the revert (and S3 with its revert) assert `closure_source_digest_v5()` and `closure_erasure_program_digest_v5()` equal before and after (DEV `3a785d42…` / `2027655d…`) and the certificate ready, in the same transaction; the proof asserts it again from outside after each step.

## Apply order (root session, on the owner's word)

1. `preflight.readonly.sql` → `readerIsDiscoveryZamene`, `dependencies`, `helperAbsent`, `collationReady`, `certificateReady` true; `retriedLiteralFunctions` 0.
2. `candidate.sql` as one migration (or `candidate.in-transaction.sql` inside a wrapper), byte-exact.
3. `postflight.readonly.sql` → `readerAfter`, `helper`, `dependencies`, `certificateReady` true, `foldTruthTableMismatches` 0, certificate equal to the preflight; receipt in `supabase/operations/dev-alpha/ledger/`.
4. Only on `PRIMENI DISCOVERY-GRAD S3`: `s3-candidate.sql`, then `s3-postflight.readonly.sql` (`readerS3`, `helper`, `certificateReady` true).
5. The app needs no new build for the city filter and the folding; city rows in "Gde" need the client change of `CLIENT_CONTRACT.md`.

Revert: `s3-revert.sql` (if S3 was applied), then `revert.sql`. Independent of MATCH-V1B (it touches no Discovery body). A later package that replaces `rpc_discovery_v1` must pin the postimage it finds (`a9b09859…`, or `225edbb8…` with S3).

## Dokaz

Workflow `.github/workflows/discovery-grad-proof.yml`, two jobs from their own fresh disposable chain each (live79 → source147 → … → EX06e R3, 23 relevant bodies equal to DEV, then ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE with their DEV files, then the reader and the six bodies DISCOVERY-GRAD calls equal to the DEV md5; `covered_slots` equal once CRLF is read as LF). Real Auth and PostgREST, loopback only, no DEV access, no provider, no push.

- **Final run 37704756107** (commit `c96dedec`): `behavior` **21/21 PASS**, `load` **5/5 PASS**. Earlier runs: 37698392779 (BEFORE, refusals, apply, byte identity, AFTER and PLACES green; one wrong test expectation about "Za mene"), 37700211544, 37701418593 and 37702604926 (all green; each load table drove a speed fix), 37704053644 (green, first with S3).
- Behaviour: the owner's cases FAIL on the DEV body and PASS after (34 text and place cases with exact task sets); 18 kinds of request without the new key byte-identical with their anchors; filterKeys and anchors unchanged; refusals atomic (revert first, predecessor, dependency, truth table, payload, S3 without DISCOVERY-GRAD, repeated apply); the wrapper variant applies and rolls back whole; city rows of PLACES equal what the place filter lists; the client decoder invariants hold; "Za mene" is still the rule set; the fold is monotone; the helper is not executable by anon; S3 byte-identical on 20 kinds of request and back after its revert; the exact revert restores the catalog of `public`/`private`, the certificate and the BEFORE answers byte for byte.
- Load, 2,000 open tasks, server time of one call as the signed-in viewer, median (minimum) of 11 warm calls, ms (CI runner; DEV hardware differs):

| request | DEV body | DISCOVERY-GRAD | + S3 |
|---|---|---|---|
| default page | 33.6 (30.1) | 31.2 (29.6) | 23.6 (21.7) |
| words "ciscenje" (finds 0 → 267) | 80.7 (78.2) | 98.9 (97.2) | 87.3 (82.5) |
| words with no hit | 80.5 (78.9) | 91.7 (89.7) | 78.4 (76.5) |
| place "Novi Sad" (finds 100 → 366) | 156.2 (125.4) | 45.1 (37.5) | 20.2 (18.9) |
| place "Liman, Novi Sad" | 125.9 (117.7) | 22.5 (20.4) | 12.8 (12.3) |
| map, place "Novi Sad" | 141.2 (105.2) | 16.2 (14.9) | 25.2 (14.5) |
| map, default | 24.8 (21.3) | 22.1 (21.5) | 22.1 (20.8) |
| PLACES default / CITY | 14.6 (14.1) / – | 16.0 (15.5) / 16.3 (15.6) | 14.8 (14.2) / 15.6 (14.9) |

Per call: the fold about 4–10 µs, `p6_discovery_key` 10–20 µs, `p6_discovery_days` 5–11 µs per open task. Function profile of one "Novi Sad" call: DEV body 7,702 calls of `p6_discovery_trim` and 3,801 of `p6_discovery_key`; DISCOVERY-GRAD 281 and 133.

**Not proven:** DEV timings (only CI hardware); native app or phone; PostgREST at scale beyond 2,000 open tasks; the client side of `groupBy: "CITY"` (no client code here); decomposed Unicode input (NFD; phone keyboards send composed letters) is not folded.

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (the DEV body, read-only readback, md5 `dc69802e…`, 33,812 characters), `candidate.sql`, `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `s3-candidate.sql`, `s3-candidate.in-transaction.sql`, `s3-revert.sql`, `s3-postflight.readonly.sql`, `s3-body.diff`, `s3-patches.json`, `manifest.json`, `CLIENT_CONTRACT.md`. Proof: `supabase/proofs/discovery-grad/` (`check_source.py`, `predecessors.mjs`, `runtime.proof.mjs`, `load.proof.mjs`).
