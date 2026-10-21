# PED02 — bezbedna zamena objavljenog zadatka, 21.10.2026.

Status: IMPLEMENTIRANO U KLIJENTU + PRIMENJENO NA DEV + SQL RUNTIME PROBA. Nema novog APK-a; signed HTTP/Gemini i HONOR nisu potvrđeni. Dopunjuje PED01 koji je samo blokirao rizičnu izmenu. Kategorija C, REQ-05I-13 i deo FLOW02/11.

## Šta korisnik dobija

Izmena kroz AI razgovor i jedan pregled priprema zaseban privatni nacrt. Original ostaje objavljen dok nova verzija ne prođe postojeću proveru i objavljivanje. Tek uspešna objava u istoj transakciji zatvara original i stare prijave. Prijave se ne prenose na nove uslove. Klijent to objašnjava pre potvrde i pri sačuvanom nacrtu; neuspešna provera nije prikazana kao uspešna objava.

Server odbija tuđi pristup, zastareo original, izmenu posle istorijskog izbora/Dogovora i potvrdu bez stvarne materijalne promene. Čuva isti rezervisani ID pri retry-ju, poreklo pri korekciji kandidata i vraća isti rezultat ponovljene objave. UI koristi novi ugovor samo kada ga dobije u nepromenljivom serverskom pregledu; stari pregled ostaje zaštićen PED01 porukom.

## Veza sa izvorom

- `src/data/aiTaskReviewClientService.ts`: strogo dekodira opcioni TASK_REPLACEMENT_V1; command ID mora biti rezervisani targetNeedId i revizija targetBaseRevision+1. Legacy provera ID-a ostaje.
- `src/app/(app)/pregled-zadatka.tsx`: potvrda posledica zamene, oporavak komande, stanje privatnog nacrta i poruka zastarelog originala.
- DEV migracije `20261021101159_staged_task_replacement` i `20261021101527_staged_task_replacement_noop_guard`.
- Oba prepare RPC-a dodaju descriptor pre displayedContentDigest. Accept bira privatni stage writer. Canonical publish poziva privatni finalize unutar iste transakcije, uz postojeći publication decision/context gate.
- Poreklo je u postojećem `private.need_draft_save_commands.result.replacement`; nema novih tabela, statusa niti novog javnog RPC-a. Privatni helperi nisu izvršivi za anon/authenticated. Originalni bound_need_id i fact subject ostaju vezani za original.
- Stare prijave dobijaju EXPIRED. Postojeći NEED_CANCELLED događaj ima tekst koji objašnjava novu verziju; ne preusmerava prijavu na promenjene uslove.
- Materijalno poređenje koristi puni snapshot, uključujući cenu/osnovu, zahteve, fotografije, privatnu lokaciju i typed handoff. Normalizuju se prazni geo/default elementi i izvedeni handoff tekst; povratak kandidata na izvorne uslove odbija se i pri objavi.

## Izvršene provere

`supabase/candidates/published-replacement-20261021/verified.rollback.sql` izvršen na DEV-u. Dokaz `readback.json`: PED02_AUTH_REVERTED=true, fixtureAccountsRemaining=0. Sintetički početni podaci; stvarni RPC pozivi i authenticated SQL uloga za pripremu/prihvatanje/objavu.

1. Neizmenjen pregled → NO_MATERIAL_CHANGE; original i prijava ostaju.
2. Priprema/korekcija/ponavljanje pregleda → isti rezervisani kandidat i trajno poreklo; original bez promena.
3. Tuđi nalog → TASK_REVIEW_NOT_FOUND.
4. Pogrešna publication odluka i zastareo original → bez delimičnog zatvaranja.
5. Stvarni rpc_select_response pre objave → NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR.
6. Kandidat vraćen na originalne uslove → NO_MATERIAL_CHANGE; original i prijava ostaju.
7. Uspešna zamena → original CANCELLED, kandidat PUBLISHED; stara prijava EXPIRED, nijedna preneta, jedan worker događaj.
8. Ponovljena objava → isti receipt. Svi fixture podaci rollback-ovani.

Jest: 197/197 u tri paketa ai-task-review-client, v5-review-screen, ru4-need-edit-client. `npx tsc --noEmit` PASS. Integritet migracija PASS, 181 fizički fajl. Git diff whitespace provera deo završne kontrole.

Prvi pokušaj migracije zaustavljen je zbog nedostajućeg separatora definicija; naredni prošao. Prva proširena fixture proba zaustavljena zbog owner JWT-a tokom kreiranja worker fixture-a; ispravljeno razdvajanjem pripreme fixture-a i proverenih korisničkih poziva, bez isključivanja guardova. Konačne SQL probe prošle.

## Evidencija i bezbedan oporavak

`applied-ledger.json` čuva tačan tekst primenjenih CRLF migracija. Kanonski migration fajlovi po repozitorijumskom ugovoru imaju LF; razlika je zabeležena kao APPLIED_RECORDED_BYTES_DIFFER, uz odvojene izračunate hash-eve, i provereno je da je jedina razlika CRLF→LF i završni prazan red. Ledger receipt je datirani dodatak, nije ponovna provera svih istorijskih migracija.

Ne vraćati slepo stari canonical publish: postojeći kandidati moraju zadržati proveru porekla. Ako treba hitno obustaviti nove zamene, poseban forward containment treba da blokira novu pripremu/prihvatanje, uz zadržan finalize guard za postojeće kandidate. Takav povratni patch nije primenjen ni testiran ovim paketom.

Security advisor sačuvan u `advisors.json`; postojeći nalazi ostaju: 123 RLS tabela bez policy-ja, mutable search path 1, public extension 1, anon definer 2, authenticated definer 194, leaked password protection 1. Ovo nije izveštaj da je bezbednost cele baze završena. Dokumentacija: [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definer pristup](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [lozinke](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Šta još nije potvrđeno

- Signed HTTP/Auth prenos, pravi Gemini i taxonomy binding kroz Edge putanju; evaluator odluka u SQL probi je sintetička NO_PROVIDER_CALLED.
- Stvarna konkurencija u dve transakcije (postojeći row lock pregledan; sekvencijalna select proba nije concurrency test).
- Stvarni upload medija, prekid mreže/restart na telefonu, vizuelna provera i novi APK.
- Deadline-only izmena ostaje zasebna otvorena stavka. Ovaj paket ne završava closure, push cilj, Area V2, grupne medije ili sve 11 scenarija.

Sledeće: zatvoriti ove putanje u postojećem razvojnom okruženju, nastaviti otvorene MVP ugovore i tek po zajedničkoj regresiji praviti instalacioni fajl.
