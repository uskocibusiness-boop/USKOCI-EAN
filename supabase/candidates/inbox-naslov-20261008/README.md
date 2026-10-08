# INBOX-NASLOV — ime zadatka u svakom obaveštenju (vlasnik, 8. 10. 2026)

**Status: SAMO IZVORNI KOD, NIJE PRIMENJENO.** Kanonski DEV `leqcwgzvjsxugfgzdmth` primenjuje integrator po vlasnikovom stalnom nalogu za dokazane pakete, tek posle zelenog dokaza. Dokaz: `.github/workflows/inbox-naslov-proof.yml` (jednokratna baza, nikad DEV) — rezultat se upisuje ovde kad se run završi.

## Ukratko za vlasnika

- **Svako obaveštenje nosi ime svog zadatka.** „Dogovor je otkazan“ sada kaže i koji je („Montaža police u hodniku“). Aplikacija je već spremna i to pokazuje kao drugi red; nova verzija aplikacije nije potrebna, a stare verzije novo polje samo preskaču.
- **Ime vidi samo ko sme:** naručilac tog zadatka, radnik te prijave, obe strane Dogovora, radnik kome je zadatak ponuđen (ime je već u tekstu ponude) i radnik koji se na taj zadatak prijavio. Svi ostali, i svako obaveštenje o zadatku koji je obrisan ili izbrisan zatvaranjem naloga, dobijaju prazno (`null`) i red izgleda kao danas.
- **Samo ime zadatka:** bez adrese, opisa, cene i imena osobe. Zaključan ekran (push) se ne menja (pravilo A20).
- **Sve ostalo je isto, bajt po bajt:** tekst, redosled, stranice, broj nepročitanih i greške.
- **Bezbednost:** menja se samo telo jedne funkcije čitanja; nema nove tabele, kolone, okidača, politike, indeksa ni prava. Sertifikat zatvaranja se ne pomera (proverava se u istoj transakciji). Tačan povratak: `revert.sql`.
- **Tvoje odluke (nijedna ne blokira primenu):** (1) obaveštenja o pitanjima (CLARIFICATION) ostaju bez imena zadatka (ugovor ih ne navodi; na DEV-u ih danas nema); (2) prikazuje se današnje ime zadatka, i kad ga je naručilac posle izmenio.

## What changes, exactly

One function body, by three anchored edits (`body.diff`, `patches.json`) of the DEV body of `public.rpc_list_inbox(text,integer,timestamp with time zone,uuid)` (read read-only on 2026-10-08, `live-functions.json`: `md5(prosrc)` `b7928c50…`, `md5(pg_get_functiondef)` `4a9f079a…`, the PKG-027c postimage):

1. every item gets the key **`taskTitle`** (string or `null`); every other key and value is built by the same expression as before (jsonb orders the keys, so the text of an item without `taskTitle` is the old text);
2. the page of events also carries `entity_type` and `entity_id` of the same row (same filter, order and `limit p_limit+1`);
3. one `left join lateral` per listed event (at most 101 rows): primary-key lookups only, at most one row, `limit 1`:
   - **NEED** → that need, when the caller is its requester, or the event is `OPPORTUNITY_AVAILABLE` (the offer already names the task), or the caller applied to it (any application row of his on that need, any status — every Dogovor comes from an application, so this also covers the worker of a Dogovor; DEV sends `NEED_CANCELLED` exactly to such workers);
   - **RESPONSE** → the need of that application, when the caller is its worker or the requester of its need;
   - **AGREEMENT** → the need of that Dogovor, when the caller is its requester or its worker;
   - **anything else is `null`**: another entity kind (`CLARIFICATION`), a missing row (deleted task, unknown id), a task an account closure erased (the certified `private.closure_redaction_patch_v5` writes title `Obrisan zadatak` and category `OBRISANO`; either marker hides the title), and every caller without that right.

Unchanged and asserted: signature, `plpgsql`, `STABLE`, `SECURITY DEFINER`, `search_path=pg_catalog`, owner `postgres`, ACL `{postgres=X/postgres,authenticated=X/postgres}`, no comment, every pg_proc field but `prosrc` (`to_jsonb(p)-'prosrc'`), the guards and their errors (`AUTH_REQUIRED` 28000, `INVALID_ROLE` / `INVALID_PAGE` 22023), the unread count, paging, `hasMore`, `asOf`. After: `md5(prosrc)` `f1daee8c…`, `md5(pg_get_functiondef)` `ac85e817…`.

Difference to row security, on purpose: the reader is `SECURITY DEFINER` (as before), so the rights are written out in it. Under the table policies a worker who only applied can no longer read a task once it is cancelled (`needs_participant_read` wants a confirmed Dogovor); the inbox now names such a task to him — its title only — because the contract asks for exactly that case ("Dogovor je otkazan", "Zadatak je otkazan"). Blocks are not consulted: a person keeps seeing, in his own inbox, the title of a task he shares with the other side.

## Exact boundaries and guards

- `candidate.sql` (one transaction) and `candidate.in-transaction.sql` (the same without `begin`/`commit`, for a wrapper that brings its own transaction). Order: a repeated application or any variant that already carries the key is named first (`INBOX_NASLOV_ALREADY_OR_PARTIALLY_APPLIED`) → predecessor: body md5, definition md5 and metadata (`INBOX_NASLOV_PREDECESSOR_DRIFT`) → dependency `private.category_of_event(text)` `85389285…` (`INBOX_NASLOV_DEPENDENCY_DRIFT`) → the 15 columns the lookups read, type and NOT NULL (`INBOX_NASLOV_SCHEMA_DRIFT`) → the erasure markers in `private.closure_redaction_patch_v5` (`INBOX_NASLOV_ERASURE_MARKER_DRIFT`) → certificate ready (`INBOX_NASLOV_CERTIFICATE_NOT_READY`) → body replaced with preimage, payload, definition, anchor, postimage and metadata checks (`…_PREIMAGE_DRIFT`, `…_PAYLOAD_DRIFT`, `…_DEFINITION_DRIFT`, `…_BODY_ANCHOR_DRIFT`, `…_POSTIMAGE_OR_METADATA_DRIFT`) → reader after (`INBOX_NASLOV_READER_DRIFT`) → certificate unchanged and ready (`INBOX_NASLOV_CERTIFICATE_MOVED`, `…_NOT_READY_AFTER`). Every refusal is errcode `55000`; nothing in the package carries errcode `40001` (B24).
- `revert.sql`: refuses unless the reader is exactly the postimage (`INBOX_NASLOV_REVERT_PREIMAGE_DRIFT`), restores the DEV body `b7928c50…` (definition `4a9f079a…`) with the same checks, asserts the certificate unchanged. Code rollback only: the package writes no data.
- `preflight.readonly.sql` / `postflight.readonly.sql`: one read-only `select` each. The preflight was run read-only on canonical DEV on 2026-10-08 (ledger 234, latest `20261008000839`): `readerIsDev`, `dependencies`, `columns`, `erasureMarkers`, `certificateReady` true, `alreadyApplied` false, `retriedLiteralFunctions` 0, 85 events (NEED 29, RESPONSE 30, AGREEMENT 26), at most 39 for one person, certificate `3a785d42…` / `2027655d…`.
- Every SQL file is pure ASCII: the one non-ASCII letter of the body (`š` of „Novo obaveštenje“) is `chr(353)` between dollar-quoted runs. Apply the bytes of the git blob (LF); a CRLF copy changes the payload and is refused (`…_PAYLOAD_DRIFT`), atomically.

## Certificate

**Does not move.** None of `private.closure_source_digest_v5`, `closure_schema_digest_v5_139`, `closure_erasure_program_digest_v5` or `retention_ai_source_ready` names `rpc_list_inbox` (read on DEV), and a function body is not schema. The apply and the revert assert `closure_source_digest_v5()` and `closure_erasure_program_digest_v5()` equal before and after and the certificate ready, in the same transaction; the proof asserts it again from outside after every step.

## Apply order (integrator, on the standing order for proven packages)

1. `preflight.readonly.sql` → `readerIsDev`, `dependencies`, `columns`, `erasureMarkers`, `certificateReady` true; `alreadyApplied` false; `retriedLiteralFunctions` 0.
2. `candidate.sql` as one migration (or `candidate.in-transaction.sql` inside a wrapper), byte-exact; `md5(statements[1])` of the ledger row = `manifest.json` `artifact_md5`.
3. `postflight.readonly.sql` → `readerAfter`, `dependencies`, `columns`, `erasureMarkers`, `certificateReady` true; certificate equal to the preflight; receipt in `supabase/operations/dev-alpha/ledger/`.
4. The app needs no new build (`src/data/inboxClientService.ts` already reads `taskTitle`, `src/ui/notifications/inboxCopy.ts` `inboxTaskTitle` shows it).

Revert: `revert.sql`. A later package that replaces `rpc_list_inbox` must pin the postimage `f1daee8c…`.

## Dokaz

Workflow `.github/workflows/inbox-naslov-proof.yml`, two jobs from their own fresh disposable chain each (the chain of the DISCOVERY-GRAD proof: live79 → source147 → … → EX06e R3, then ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE with their DEV files; `supabase/proofs/match-v1/chain.mjs`, `fidelity.mjs` and `supabase/proofs/discovery-grad/predecessors.mjs` byte-identical to `candidate/discovery-grad-20261008`), then `supabase/proofs/inbox-naslov/predecessors.mjs` admits only the DEV body of the reader, its dependency, the 15 columns, the required indexes and the erasure markers. Real Auth and PostgREST, loopback only, no DEV access, no provider, no push.

(Results are written here after the run.)

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (the DEV body, read-only readback), `candidate.sql`, `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`. Proof: `supabase/proofs/inbox-naslov/` (`check_source.py`, `common.mjs`, `predecessors.mjs`, `runtime.proof.mjs`, `load.proof.mjs`).
