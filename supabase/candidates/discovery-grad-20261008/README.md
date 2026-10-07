# DISCOVERY-GRAD — pretraga razume grad i ne zavisi od kvačica (odluka vlasnika d14, 7.10.2026)

**Status: SAMO IZVORNI KOD, NIJE PRIMENJENO.** Kanonski DEV `leqcwgzvjsxugfgzdmth` samo na tačnu reč vlasnika **`PRIMENI DISCOVERY-GRAD`**, i samo posle DISCOVERY-ZAMENE (na DEV-u je primenjen, ledger 232). Dokaz: `.github/workflows/discovery-grad-proof.yml` (jednokratna baza, nikad DEV). Rezultati dokaza su u odeljku „Dokaz“ ispod.

## Ukratko za vlasnika

- **Mesto je sada grad.** Kad izabereš „Novi Sad“, dobiješ SVE zadatke u Novom Sadu (Liman, Detelinara, Petrovaradin kao deo Novog Sada…), a ne samo one gde piše tačno „Novi Sad“. Deo grada („Detelinara, Novi Sad“) i dalje daje samo taj deo.
- **Kvačice, velika slova i ćirilica ne smetaju**, u oba smera, i u rečima i u mestima: „cistim“ nalazi „čistim“, „Cacak“ = „Čačak“, „Djordje“ = „Đorđe“, „Нови Сад“ = „Novi Sad“, „elektricne“ nalazi veštinu „Električne instalacije“.
- **Lista mesta može da bude lista gradova** sa brojem („Novi Sad · 23“). To je nov, neobavezan izbor (`groupBy: "CITY"`); broj je tačno ono što filter mesta onda pokaže. Bez tog izbora lista je ista kao danas, samo što su „Čačak“ i „Cacak“ jedno mesto.
- **Šta se ne menja:** redosled, mapa, „Za mene“, brojevi, sidra i kursori. Zahtev bez reči i bez mesta daje isti odgovor bajt po bajt (dokazano).
- **Bezbednost:** jedna nova pomoćna funkcija i jedno telo funkcije. Nema nove tabele, kolone, okidača, politike ni ekstenzije (`unaccent` nije potreban). Sertifikat zatvaranja se ne pomera (proverava se u istoj transakciji). Tačan povratak: `revert.sql`.
- **Tvoje odluke (nijedna ne blokira primenu):** (1) da li i „d“ bez kvačice treba da nađe „đ“ („Dorde“ → „Đorđe“); sada važi „dj“ kako je odlučeno; (2) kad se spoje dva pisanja istog mesta, lista pokazuje najnovije napisano (kao i danas za velika/mala slova); (3) brzina „S3“ je predlog sledećeg paketa (brojevi ispod).

## What changes, exactly

One new helper and anchored edits of one body (`body.diff`, `patches.json`):

- **`public.discovery_fold_v1(text) returns text`** — `language plpgsql`, `IMMUTABLE`, SECURITY INVOKER, `search_path=pg_catalog`, owner `postgres`, EXECUTE `authenticated` only (`{postgres=X/postgres,authenticated=X/postgres}`, the ACL of the `p6_discovery_*` helpers it sits next to). Lower case with the Serbian ICU collation, then Serbian Latin and Serbian Cyrillic letters to plain Latin, letter by letter: č ć → c, š → s, ž → z, **đ → dj**, Cyrillic ђ → dj, љ → lj, њ → nj, џ → dz, ћ ч ц → c and every other Serbian Cyrillic letter to its Latin letter. Nothing else changes (other letters, digits, punctuation and white space stay). The body is one `return` of one expression and pure ASCII (every non-ASCII letter is `chr(n)`), so no transport can rewrite an escape. PL/pgSQL on purpose: a SQL function with a locked `search_path` cannot be inlined and starts the executor on every call (measured 8.5 µs per call in the first proof run); a PL/pgSQL simple expression does not. It is only for **finding**: no shown text, key or stored value passes through it.
- **`public.rpc_discovery_v1(jsonb)`** (predecessor = the DEV body `dc69802e…`, the DISCOVERY-ZAMENE postimage; after `58b501af…`; language, volatility, `search_path`, owner, ACL and comment unchanged and asserted):
  - **words** (`filter.text`): found in the title, the place text and the needed skills, tools and vehicles (the same text as before, in the same order) after the fold of both sides; one fold per task over that whole text (the fold costs more than the place text, so the old title-first pass is gone);
  - **place** (`filter.place`, PAGE and MAP): a task matches when the folded place equals its **whole place text** (as before) **or its city**. The city is `approximate_city`; for a task that names no city it is the last part of its place text after a comma (`"Vračar, Beograd"` → `Beograd`). Remote tasks and tasks with no place text never match a place (as before); a task **without a point** but with a city matches, and in an area scope it is listed in its own section (as before). The decision is made **once per request for the distinct (area, city) texts** of the open tasks (a short list `place_keys`, length-prefixed so no two texts share a key); each task then only looks up its own key, instead of computing its place text twice per task as before;
  - **PLACES**: rows are merged by the fold (texts that differ only by Serbian letters, case or script are one row; case was already merged); the PLACES `prefix` is found through the fold; the optional request key **`groupBy`** (`"AREA"` = today, `"CITY"` = one row per city) — see `CLIENT_CONTRACT.md`;
  - nothing else: `forMe`, scopes, sections, paging, the map grid, counts, availability, EXACT_PUBLIC and every response shape are the same text. The PLACES arm inside the general statement is unreachable (the dedicated PLACES block returns first, since P6 places cost v1) and is left as it is.

### Differences for requests WITHOUT the new key (the goal of the package, nothing else)

1. `filter.text` non-empty: more tasks can match (other spellings). **No task found before is lost**: the fold maps each letter to one or two letters and never removes one, so a word that occurred before still occurs (proved: 0 lost of tens of thousands of title/word pairs).
2. `filter.place` non-empty: a city name now lists the whole city; a whole place text with a comma lists what it listed before (plus other spellings of the same text).
3. PLACES: two place texts that differ only by Serbian letters or script become one row (sum of both counts; the shown text is the most recently published spelling, the rule of today for case); a `prefix` finds them without the letters.
4. Unchanged: `filterKey`, anchors and cursors of every request (the filter key is built from the same request text as before; only PLACES with `groupBy: "CITY"` gets another key). A chain opened before the apply continues after it without a refusal; for at most the 30 minutes of its anchor it can see the new matches from its next page on.

## Exact boundaries and guards

- `candidate.sql` (one transaction) and `candidate.in-transaction.sql` (the same without `begin`/`commit`, for a wrapper that brings its own transaction): certificate ready → a repeated or partial application is named first (`DISCOVERY_GRAD_ALREADY_OR_PARTIALLY_APPLIED`) → predecessor pin (`DISCOVERY_GRAD_PREDECESSOR_DRIFT`) → six dependency pins (`DISCOVERY_GRAD_DEPENDENCY_DRIFT`: `p6_discovery_key`, `p6_discovery_trim`, `p6_discovery_unquote`, `p6_discovery_area`, `discovery_for_me_state_v1`, `discovery_for_me_v1`, DEV md5 of 2026-10-08) → the ICU collation (`DISCOVERY_GRAD_COLLATION_MISSING`) → helper created, revoked, granted → body replaced with preimage, payload, anchor, postimage and metadata checks (`…_PREIMAGE_DRIFT`, `…_PAYLOAD_DRIFT`, `…_BODY_ANCHOR_DRIFT`, `…_POSTIMAGE_OR_METADATA_DRIFT`) → helper metadata and ACL (`DISCOVERY_GRAD_HELPER_DRIFT`) → the fold truth table of 26 probes, Latin and Cyrillic, both cases, NULL and empty (`DISCOVERY_GRAD_FOLD_TRUTH_TABLE`) → reader md5 and ACL → certificate unchanged and ready. Every refusal is errcode `55000`; the package has no errcode `40001` (B24).
- `revert.sql`: refuses unless the reader is exactly the postimage and the helper exactly as created, and refuses while any other function body calls the helper (`DISCOVERY_GRAD_REVERT_HELPER_IN_USE`); restores the DEV body `dc69802e…`, drops the helper, asserts the certificate unchanged. Code rollback only: the package writes no data.
- `preflight.readonly.sql` / `postflight.readonly.sql`: read-only; every flag true, the truth table again on the server, the certificate value, the count of functions with the retried literal (0 on DEV).

## Certificate

**Does not move.** `closure_source_digest_v5` hashes a fixed list of 99 functions plus the schema digest and the erasure program digest; `rpc_discovery_v1` is not in it (DISCOVERY-ZAMENE replaced the same body with the certificate unchanged on DEV) and a new non-trigger function is not hashed. The apply and the revert assert `closure_source_digest_v5()` and `closure_erasure_program_digest_v5()` equal before and after (DEV `3a785d42…` / `2027655d…`) and the certificate ready, in the same transaction.

## Apply order (root session, on the owner's word)

1. `preflight.readonly.sql` → `readerIsDiscoveryZamene`, `dependencies`, `helperAbsent`, `collationReady`, `certificateReady` true; `retriedLiteralFunctions` 0.
2. `candidate.sql` as one migration (or `candidate.in-transaction.sql` inside a wrapper), byte-exact.
3. `postflight.readonly.sql` → `readerAfter`, `helper`, `dependencies`, `certificateReady` true, `foldTruthTableMismatches` 0, certificate equal to the preflight; receipt in `supabase/operations/dev-alpha/ledger/`.
4. The app needs no new build for (1) and (2) of "Ukratko"; city rows in "Gde" need the client change of `CLIENT_CONTRACT.md`.

Independent of MATCH-V1B (it touches no Discovery body). A later package that replaces `rpc_discovery_v1` must pin this postimage.

## Speed (S3 is a proposal, not in this package)

The fold costs only requests that carry words or a place; requests without them run the same work as before (measured, see "Dokaz"). The reader still reads every open task per PAGE and MAP call; the per-row cost that dominates is the days helper (`p6_discovery_days`, a PL/pgSQL function with an exception block: one subtransaction per call), which every PAGE call computes for every open task even without a time filter, only to answer `availability.hasKnownSchedule`. **S3 (next package):** compute days only with a time filter and answer `hasKnownSchedule` with an `exists` that stops at the first dated task, then filter the area first through the existing spatial index. It was not added here: it changes the PAGE path of every request, which this package keeps byte-identical by construction; the load job measures its size (below).

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (the DEV body, read-only readback, md5 `dc69802e…`, 33,812 characters), `candidate.sql`, `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`, `CLIENT_CONTRACT.md`. Proof: `supabase/proofs/discovery-grad/` (`check_source.py`, `predecessors.mjs`, `runtime.proof.mjs`, `load.proof.mjs`).

## Dokaz

Pending the first green run of `.github/workflows/discovery-grad-proof.yml`.
