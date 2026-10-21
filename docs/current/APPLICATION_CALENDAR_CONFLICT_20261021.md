# CAL01 — zauzet termin u prijavama, 21.10.2026.

## Promena i smisao
Za izvršioca koji ima dve prijave u istom terminu i vlasnika koji bira ljude.
Aktivni server je već odbijao preklopljen izbor, ali vlasnik je video generički STALE, a izvršilac običnu poslatu prijavu.
Dodato je read-only objašnjenje calendarConflict u oba cela i oba straničena reader-a.
Nema novog lifecycle statusa, automatskog povlačenja ili arhiviranja prijave.

- Vlasnik: „Termin zauzet · preklapa se sa drugim Dogovorom.”
- Izvršilac: „Termin zauzet · imaš drugi Dogovor u ovo vreme. Prijava ostaje sačuvana.”
- Izbor je onemogućen kada je flag potvrđen; server ostaje konačni autoritet.
- Povlačenje sopstvene prijave ostaje moguće po postojećem serverskom canWithdraw.
- Posle oslobađanja termina sledeće čitanje uklanja objašnjenje. Ostali uslovi, rokovi i kapacitet i dalje odlučuju o izboru.
- Ne otkriva se identitet, adresa, cena ili ID drugog Dogovora.

Klasa: B/C — preciznije postojeće UX stanje i dopuna ugovora za čitanje.
Deo FLOW03/04/05/11, Master izbora i kalendara; ne zatvara kompletne scenarije.

## Primena
DEV leqcwgzvjsxugfgzdmth: migracija 20261021093741_application_calendar_conflict_read.
Exact ledger MD5 6ce2a71faaa0d0b983d8a44d5600b88d; SHA256 b9ad5a756b5eb51bfc612e4bb6d4a787ad142c14acbd6f032a193af4785bc7b7; 23543 bytes.
Četiri javna reader-a zadržavaju postojeće provere vlasništva i ACL authenticated/postgres.
Novi private.application_calendar_conflict_v1(uuid) ima samo postgres EXECUTE.
Polje je aditivno; odsutno polje u starijem odgovoru ne izmišlja konflikt. Pogrešan tip odbija se u klijentu.
Writer-i, pravila izbora i otkazivanja nisu menjani.

Izvori:
- src/data/applicationClientService.ts i candidateClientService.ts
- src/contracts/projections.ts
- src/ui/v2/ApplicationFace.tsx i CandidateFace.tsx
- supabase/candidates/calendar-conflict-read-20261021/origin.rollback.sql
- isto: result.json i rollback.preimage.sql
- supabase/operations/dev-alpha/ledger/20261021_cal01_physical_suffix.receipt.json

## Izvršene provere
- Stvarni rpc_select_response za prvi Dogovor; druga preklopljena prijava odbijena sa CALENDAR_CONFLICT razlogom.
- Susedni interval koji počinje tačno na kraju prvog nije blokiran reader-om.
- Vlasnički puni/straničeni read i izvršiočev puni/straničeni read vraćaju razlog.
- Start-only zadatak u zauzetom trenutku: razlog i canSelect=false; writer odbija izbor.
- Stvarni rpc_cancel_agreement oslobađa interval; razlog nestaje kod obe strane.
- Ponovni izbor druge prijave sa istim ključem prethodno odbijenog zahteva prolazi.
- Direktan authenticated poziv privatnog helper-a odbijen; tuđ vlasnički reader odbijen.
- ROLLBACK, zaseban read potvrđuje nula CAL01 test naloga.
- 180/180 Jest testova u četiri paketa PASS; prikaz razloga, dostupnost povlačenja, nestanak nakon osvežavanja, screen-reader tekst, neispravni flag i zaštita izbora.
- TypeScript PASS; migration integrity PASS (178 fajlova); git diff --check PASS.
- React pregled: postojeće kartice i semantički warn tekst; nema novih hookova, efekata, fetch-a ili zavisnosti; tekst je u zajedničkom čitljivom/spoken modelu.

Dva pokušaja migracije odbijena su zbog razdvajača kopiranih pg_get_functiondef definicija. Pre treće primene potvrđen je neizmenjen preimage i nepostojanje helper-a. Ispravljena SQL sintaksa je primenjena i proverena.
Dodatna start-only priprema odbijena je jer je pokušala da izmeni objavljen fixture; priprema je prebačena u početni insert, bez ukidanja guarda.

## Granice i sledeći rad
Početne objave/prijave su sintetički SQL podaci. Ovo nisu signed Auth HTTP ili Android testovi.
Nisu provereni istovremeni izbori dve transakcije, sve vremenske zone niti kompletna prvobitna objava.
Nema novog APK-a, Figma izmene ili vizuelne potvrde na HONOR-u.
Server dopuna je aktivna; novi tekst klijenta stiže tek sa sledećim build-om.
Sledeće P0: bezbedna izmena objavljenog zadatka; zatim signed/native oba ugla i konkurentni izbor.

## Security advisor
Advisor je pokrenut; rezultat nije čist globalni audit. Prijavljuje 123 INFO RLS-without-policy, WARN search-path (1), public extension (1), anon definer (2), authenticated definer (194), leaked-password protection (1).
Nisu automatski menjani postojeći ACL-i ili Auth postavke. Novi helper nije izložen klijentu.
Reference: [RLS lint](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [anon definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
