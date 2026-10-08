# INBOX-NASLOV — ime zadatka u svakom obaveštenju (vlasnik, 8. 10. 2026)

**Status: SAMO IZVORNI KOD, NIJE PRIMENJENO.** Kanonski DEV `leqcwgzvjsxugfgzdmth` primenjuje integrator po vlasnikovom stalnom nalogu za dokazane pakete. Dokaz: `.github/workflows/inbox-naslov-proof.yml` (jednokratna baza, nikad DEV); zeleno pokretanje **37784417178** (commit `5ff3b86a`, ovo telo): ponašanje **14/14 PASS**, opterećenje **2/2 PASS**.

## Ukratko za vlasnika

- **Svako obaveštenje nosi ime svog zadatka.** „Dogovor je otkazan“ sada kaže i koji je („Montaža police u hodniku“). Aplikacija je već spremna i to pokazuje kao drugi red; nova verzija aplikacije nije potrebna, a stare verzije novo polje samo preskaču.
- **Ime vidi samo ko sme:** naručilac tog zadatka, radnik te prijave, obe strane Dogovora, radnik kome je zadatak ponuđen (ime je već u tekstu ponude) i radnik koji se na taj zadatak prijavio. Svi ostali, i svako obaveštenje o zadatku koji je obrisan ili izbrisan zatvaranjem naloga, dobijaju prazno (`null`) i red izgleda kao danas.
- **Samo ime zadatka:** bez adrese, opisa, cene i imena osobe. Zaključan ekran (push) se ne menja (pravilo A20).
- **Sve ostalo je isto, bajt po bajt:** tekst, redosled, stranice, broj nepročitanih i greške (dokazano na 174 stranice, 5 naloga, 3 filtera, 4 veličine stranice).
- **Brzina:** stranica od 100 obaveštenja (čita se 101) kod radnika sa 10.000 obaveštenja: oko 8,4 → 8,9 ms; podrazumevana stranica od 30: 6,6 → 7,2 ms (CI, medijana od 11 poziva). Najgori veštački slučaj (100 otkazivanja tuđih zadataka sa po 200 prijava, na koje se nije prijavio): 3,1 → 10,5 ms.
- **Bezbednost:** menja se samo telo jedne funkcije čitanja; nema nove tabele, kolone, okidača, politike, indeksa ni prava. Sertifikat zatvaranja se ne pomera (proverava se u istoj transakciji). Tačan povratak: `revert.sql`.
- **Tvoje odluke (nijedna ne blokira primenu):** (1) obaveštenja o pitanjima (CLARIFICATION) ostaju bez imena zadatka (ugovor ih ne navodi; na DEV-u ih danas nema); (2) prikazuje se današnje ime zadatka, i kad ga je naručilac posle izmenio.

## What changes, exactly

One function body, by three anchored edits (`body.diff`, `patches.json`) of the DEV body of `public.rpc_list_inbox(text,integer,timestamp with time zone,uuid)` (read read-only on 2026-10-08, `live-functions.json`: `md5(prosrc)` `b7928c50…`, `md5(pg_get_functiondef)` `4a9f079a…`, the PKG-027c postimage):

1. every item gets the key **`taskTitle`** (string or `null`); every other key and value is built by the same expression as before (jsonb orders the keys, so the text of an item without `taskTitle` is the old text);
2. the page of events also carries `entity_type` and `entity_id` of the same row (same filter, order and `limit p_limit+1`);
3. one `left join lateral` per listed event (at most 101 rows), at most one row (`limit 1`): primary-key lookups, and for a NEED event to someone who is neither its requester nor offered it, one index range over the applications of that one task (`marketplace_responses_need_idx`):
   - **NEED** → that need, when the caller is its requester, or the event is `OPPORTUNITY_AVAILABLE` (the offer already names the task), or the caller applied to it (any application row of his on that need, any status — every Dogovor comes from an application, so this also covers the worker of a Dogovor; DEV sends `NEED_CANCELLED` exactly to such workers);
   - **RESPONSE** → the need of that application, when the caller is its worker or the requester of its need;
   - **AGREEMENT** → the need of that Dogovor, when the caller is its requester or its worker;
   - **anything else is `null`**: another entity kind (`CLARIFICATION`), a missing row (deleted task, unknown id), a task an account closure erased (the certified `private.closure_redaction_patch_v5` writes title `Obrisan zadatak` and category `OBRISANO`; either marker hides the title), and every caller without that right.

Unchanged and asserted: signature, `plpgsql`, `STABLE`, `SECURITY DEFINER`, `search_path=pg_catalog`, owner `postgres`, ACL `{postgres=X/postgres,authenticated=X/postgres}`, no comment, every pg_proc field but `prosrc` (`to_jsonb(p)-'prosrc'`), the guards and their errors (`AUTH_REQUIRED` 28000, `INVALID_ROLE` / `INVALID_PAGE` 22023), the unread count, paging, `hasMore`, `asOf`. After: `md5(prosrc)` `bd46f06f…`, `md5(pg_get_functiondef)` `4897d93c…`.

Difference to row security, on purpose: the reader is `SECURITY DEFINER` (as before), so the rights are written out in it. Under the table policies a worker who only applied can no longer read a task once it is cancelled (`needs_participant_read` wants a confirmed Dogovor); the inbox now names such a task to him — its title only — because the contract asks for exactly that case ("Dogovor je otkazan", "Zadatak je otkazan"). Blocks are not consulted: a person keeps seeing, in his own inbox, the title of a task he shares with the other side.

## Exact boundaries and guards

- `candidate.sql` (one transaction) and `candidate.in-transaction.sql` (the same without `begin`/`commit`, for a wrapper that brings its own transaction). Order: a repeated application or any variant that already carries the key is named first (`INBOX_NASLOV_ALREADY_OR_PARTIALLY_APPLIED`) → predecessor: body md5, definition md5 and metadata (`INBOX_NASLOV_PREDECESSOR_DRIFT`) → dependency `private.category_of_event(text)` `85389285…` (`INBOX_NASLOV_DEPENDENCY_DRIFT`) → the 15 columns the lookups read, type and NOT NULL (`INBOX_NASLOV_SCHEMA_DRIFT`) → the erasure markers in `private.closure_redaction_patch_v5` (`INBOX_NASLOV_ERASURE_MARKER_DRIFT`) → certificate ready (`INBOX_NASLOV_CERTIFICATE_NOT_READY`) → body replaced with preimage, payload, definition, anchor, postimage and metadata checks (`…_PREIMAGE_DRIFT`, `…_PAYLOAD_DRIFT`, `…_DEFINITION_DRIFT`, `…_BODY_ANCHOR_DRIFT`, `…_POSTIMAGE_OR_METADATA_DRIFT`) → reader after (`INBOX_NASLOV_READER_DRIFT`) → certificate unchanged and ready (`INBOX_NASLOV_CERTIFICATE_MOVED`, `…_NOT_READY_AFTER`). Every refusal is errcode `55000`; nothing in the package carries errcode `40001` (B24).
- `revert.sql`: refuses unless the reader is exactly the postimage (`INBOX_NASLOV_REVERT_PREIMAGE_DRIFT`), restores the DEV body `b7928c50…` (definition `4a9f079a…`) with the same checks, asserts the certificate unchanged. Code rollback only: the package writes no data.
- `preflight.readonly.sql` / `postflight.readonly.sql`: one read-only `select` each. This preflight (the file of this commit) was run read-only on canonical DEV on 2026-10-08 after the last proof run (ledger 234, latest `20261008000839`, the reader still `b7928c50…`): `readerIsDev`, `dependencies`, `columns`, `erasureMarkers`, `certificateReady` true, `alreadyApplied` false, `retriedLiteralFunctions` 0, 85 events (NEED 29, RESPONSE 30, AGREEMENT 26), at most 39 for one person, certificate `3a785d42…` / `2027655d…`.
- Every SQL file is pure ASCII: the one non-ASCII letter of the body (`š` of „Novo obaveštenje“) is `chr(353)` between dollar-quoted runs. Apply the bytes of the git blob (LF); a CRLF copy changes the payload and is refused (`…_PAYLOAD_DRIFT`), atomically.

## Certificate

**Does not move.** None of `private.closure_source_digest_v5`, `closure_schema_digest_v5_139`, `closure_erasure_program_digest_v5` or `retention_ai_source_ready` names `rpc_list_inbox` (read on DEV), and a function body is not schema. The apply and the revert assert `closure_source_digest_v5()` and `closure_erasure_program_digest_v5()` equal before and after and the certificate ready, in the same transaction; the proof asserts it again from outside after every step.

## Apply order (integrator, on the standing order for proven packages)

1. `preflight.readonly.sql` → `readerIsDev`, `dependencies`, `columns`, `erasureMarkers`, `certificateReady` true; `alreadyApplied` false; `retriedLiteralFunctions` 0.
2. `candidate.sql` as one migration (or `candidate.in-transaction.sql` inside a wrapper), byte-exact; `md5(statements[1])` of the ledger row = `manifest.json` `artifact_md5`.
3. `postflight.readonly.sql` → `readerAfter`, `dependencies`, `columns`, `erasureMarkers`, `certificateReady` true; certificate equal to the preflight; receipt in `supabase/operations/dev-alpha/ledger/`.
4. The app needs no new build (`src/data/inboxClientService.ts` already reads `taskTitle`, `src/ui/notifications/inboxCopy.ts` `inboxTaskTitle` shows it).

Revert: `revert.sql`. A later package that replaces `rpc_list_inbox` must pin the postimage `bd46f06f…`.

## Dokaz

Workflow `.github/workflows/inbox-naslov-proof.yml`, two jobs from their own fresh disposable chain each (the chain of the DISCOVERY-GRAD proof: live79 → source147 → … → EX06e R3, then ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE with their DEV files; `supabase/proofs/match-v1/chain.mjs`, `fidelity.mjs` and `supabase/proofs/discovery-grad/predecessors.mjs` byte-identical to `candidate/discovery-grad-20261008`), then `supabase/proofs/inbox-naslov/predecessors.mjs` admits only the DEV body of the reader, its dependency, the 15 columns, the required indexes and the erasure markers. Real Auth and PostgREST, loopback only, no DEV access, no provider, no push.

- **Green run 37784417178** (commit `5ff3b86a`, the body of this package, postimage `bd46f06f…`): `behavior` **14/14 PASS**, `load` **2/2 PASS**. Earlier: run 37782930670 (commit `f0e0d025`, the same SQL with a less exact comment in the body, postimage `f1daee8c…`): 14/14 and 2/2; run 37781816542 (commit `faecdfba`): load green, behaviour stopped at its first query (`operator is not unique: text || "char"` in the proof's own schema fingerprint, not in the package; fixed by a cast).
- Chain admission (`predecessor-fidelity.json`): reader `b7928c50…` / definition `4a9f079a…`, metadata, `category_of_event` `85389285…`, the 15 columns, all 15 DEV indexes of the five tables and the erasure markers equal DEV; `emit_event`, `notification_copy_v5`, `rpc_mark_activity_event_read` and `rpc_resolve_activity_event` equal DEV too (observed); `closure_redaction_patch_v5` differs from DEV on the chain (later DEV re-certifications), its two markers are present.
- **FAIL before:** on the DEV body none of the 41 listed notifications of 5 real accounts carries `taskTitle`.
- **PASS after:** every item carries `taskTitle`, equal to an independent oracle of the contract over the stored rows and to a hand-written table of 33 cases: each of the 11 (entity, event) pairs DEV holds shown with its title (incl. "Dogovor je otkazan" to both sides), the requester's own task, a worker who applied (`NEED_REVISED`, `NEED_CANCELLED`), an offer to a worker who never applied; `null` for no right (5 cases: cancellation, application and Dogovor of others; the Dogovor and the selected application of another worker on the task he applied to), an unknown row of each kind, a `CLARIFICATION`, a task erased by the certified `closure_redaction_patch_v5` (5 cases over NEED, RESPONSE and AGREEMENT) and a deleted task; a suppressed in-app delivery stays unlisted. The 9 notifications the product flows wrote themselves (`rpc_submit_response` x5, `rpc_select_response` x2, `rpc_withdraw_response`, `rpc_cancel_need`) agree with the oracle.
- **Byte identity:** 60 walks (5 accounts x role null / REQUESTER / WORKER x page size 1, 2, 7, 100), 174 pages: the jsonb text of every page without `asOf` and without `taskTitle` equal before and after; the same through PostgREST for every account; errors identical (`22023 INVALID_ROLE`, `22023 INVALID_PAGE` x5, `28000 AUTH_REQUIRED`, `42501` for anon in SQL and over HTTP); today's client decoder and the one with `taskTitle` both accept every answer.
- **Isolation:** every account lists exactly its own visible events; of this proof's tasks the outsider sees only the one offered to him; nobody sees the deleted or the erased title; an account without events gets an empty page.
- **Refusals (atomic, catalog, schema fingerprint and certificate unchanged after each):** revert before apply, predecessor drift (a changed DEV body), dependency drift, schema drift (`needs.category` nullable), erasure-marker drift, certificate not ready, payload drift, repeated application, another variant that already carries `taskTitle`, revert twice; the wrapper variant applies and rolls back whole.
- **Apply:** only the reader changed in the catalog of `public`/`private` (its pg_proc metadata unchanged), tables/columns/constraints/indexes/policies/triggers/grants unchanged, postflight green, certificate unchanged; **revert** restores body, definition, catalog, schema fingerprint, certificate and every BEFORE page byte for byte; apply → revert cycle closes; retried-literal count unchanged.
- **Load**, 10,000 notifications of one worker (14,006 in all, 3,001 tasks, 7,501 applications, 601 Dogovori), server time of one call as the signed-in person, median (minimum) of 11 warm calls after a discarded warm-up round, ms (CI runner; DEV hardware differs):

| request | items (with title) | DEV body | INBOX-NASLOV | after revert |
|---|---|---|---|---|
| worker, 30 (the app default) | 30 (28) | 6.58 (6.40) | 7.22 (6.76) | 7.33 (6.43) |
| worker, 100 (101 rows read) | 100 (95) | 8.37 (7.81) | 8.91 (7.86) | 7.42 (6.89) |
| worker, role WORKER, 100 | 100 (95) | 7.78 (7.43) | 9.87 (8.90) | 7.86 (7.51) |
| worker, 100 from the middle (cursor) | 100 (95) | 8.59 (8.28) | 9.53 (8.76) | 8.26 (8.03) |
| requester, 100 | 100 (100) | 3.05 (2.91) | 4.89 (3.58) | 3.59 (2.96) |
| worst case: 100 cancellations of tasks with 200 applications each, never applied to | 100 (0) | 3.06 (2.95) | 10.49 (8.83) | 3.57 (2.94) |

HTTP (PostgREST, worker, 100 items, median of 5): 13.2 → 14.8 ms (run 37782930670: 14.2 → 16.3 ms). The title costs about 5–20 µs per listed item; the worst case pays the check "did he apply" over every application of a crowded task (`marketplace_responses_need_idx`), which the product never triggers (it sends task cancellations and revisions only to those who applied, where the check stops at their row). Every answer was byte-identical to the DEV body's without `taskTitle`. Medians on a shared runner are noisy (run 37782930670 had 12.4 ms for the default page after the revert); the minima are the steadier figure.

**Not proven:** DEV timings (only CI hardware); the app showing the second line on a phone (the client is ready, not part of this package); PostgREST at scale beyond 10,000 notifications of one person; an account closure run end to end (the erased task was written with the certified patch function, not by a full closure).

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (the DEV body, read-only readback), `candidate.sql`, `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`. Proof: `supabase/proofs/inbox-naslov/` (`check_source.py`, `common.mjs`, `predecessors.mjs`, `runtime.proof.mjs`, `load.proof.mjs`).
