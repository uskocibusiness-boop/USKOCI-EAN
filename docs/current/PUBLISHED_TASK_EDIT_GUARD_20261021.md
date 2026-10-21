# PED01 — zaštita postojeće objave (21.10.2026)

## Status
DEV primenjen: `20261021095622_published_task_edit_containment`.
Ovo privremeno onemogućava novu izmenu objavljenog zadatka. **Bezbedna zamena objave ostaje OTVORENA.**
Klijentski izvor i testovi su dopunjeni; nema novog APK-a niti HONOR potvrde.

## Problem i ponašanje
Raniji accept/edit pisac menjao je isti PUBLISHED/SELECTION zadatak u DRAFT pre nove procene. Ako procena/objava ne uspe, prvobitni zadatak nestaje iz pretrage.
Sada tri ulaza odbijaju novi takav upis sa PUBLISHED_TASK_EDIT_NOT_READY pre mutacije.
Korisnik u pregledu vidi jasno objašnjenje, neaktivno potvrđivanje i povratak u razgovor; izmene u razgovoru ostaju.
Privatni nacrti i oporavak već prihvaćenih istorijskih komandi ostaju na postojećem ugovoru.
Ako čitanje vezanog zadatka ne uspe ili vrati pogrešan ID, ekran nudi ponovno učitavanje; ne nagađa stanje.

## Izvori
- src/app/(app)/pregled-zadatka.tsx: loadSnapshot, publishedEditUnavailable, accept, publishBlocked.
- src/data/aiTaskReviewClientService.ts i aiNeedV2Production.ts: prevod serverskog odbijanja.
- supabase/candidates/published-edit-guard-20261021: candidate.sql, origin.rollback.sql, result.json, rollback.preimage.sql.
- supabase/migrations/20261021095622_published_task_edit_containment.sql: tačan ledger mirror.
- supabase/operations/dev-alpha/ledger/20261021_ped01_physical_suffix.receipt.json: novi dokaz uz jasno označene nasleđene opservacije.
- Testovi ai-task-review-client, v5-review-screen, ru4-need-edit-client.

## Izvršene provere
184 testa / 3 Jest paketa PASS; TypeScript PASS; migration integrity 179 fajlova PASS; git diff --check PASS.
DEV SQL rollback: PUBLISHED i SELECTION, sva tri ulaza odbijena; puni originalni redovi ostaju nepromenjeni, bez novih komandi/revizija.
Stvarni AI opener i correction RPC, DRAFT edit i replay PASS, tuđi vlasnik odbijen.
Početni zadaci i review envelope su sintetički; SELECTION priprema je sintetička, nije izbor izvršioca. Ovo nisu signed HTTP, Gemini niti Android testovi.
Posle rollback-a zasebno čitanje potvrđuje nula PED01 test naloga.
Dva pripremna pokušaja su odbijena postojećim FACT_VALUE_IMMUTABLE/NEED_MUST_START_AS_DRAFT zaštitama. Fixture je ispravljen bez isključivanja zaštita.
Postimage potvrđuje SECURITY DEFINER, search_path=pg_catalog i nepromenjena execute prava; interni writer ostaje nedostupan authenticated ulozi.
Istorijski ACCEPTED i NOT_READY oporavak provereni u klijentskim testovima; to nije nova signed DEV proba istorijskih komandi.

## Security advisor
Rezultat nije globalno čist: INFO RLS-without-policy 123; WARN mutable search_path 1, public extension 1, anon definer 2, authenticated definer 194, leaked-password protection 1.
Brojevi odgovaraju prethodnom CAL01 preseku; prava i Auth postavke nisu menjani.
[Preporuke za RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
[extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[anon definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[lozinke](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Sledeći obavezni paket — stvarna izmena
1. Poseban privatni nacrt nove objave sa trajnom vezom ka originalu; ne prevezivati razgovor privremenim NULL zbog guard_need_edit_base_marker.
2. Proširiti potpisani review/command ugovor sa source identitetom i revizijom. Ne popuštati decodeCommandForReview proveru proizvoljnog ID-ja.
3. Taxonomy binding, mediji i potvrđena lokacija pripadaju kandidatu uz očuvanje provenance; original ostaje aktivan tokom svih provera.
4. Canonical publish mora atomski proveriti original, reviziju, prethodni izbor/Dogovor i kandidat; tek zatim zatvoriti original i objaviti zamenu. Sam wrapper nije dovoljan.
5. Ispravka kandidata, ponovno otvaranje razgovora, lost ACK/replay i brisanje kandidata moraju čuvati ancestry i original.
6. Postojeće prijave ne prenositi kao saglasnost za nove uslove. Definisati obaveštenje, zatvaranje i vezu stare/nove objave.
7. Dokazati neuspešnu procenu, uspešnu zamenu, konkurentan izbor, stale source/candidate, odustajanje, korekcije i ponovljene zahteve; zatim signed HTTP i obe uloge na uređaju.

Povratak rollback.preimage.sql vraća poznatu opasnu putanju: samo operator recovery uz zasebnu odluku. Ne koristiti kao rutinsko uklanjanje zaštite.
