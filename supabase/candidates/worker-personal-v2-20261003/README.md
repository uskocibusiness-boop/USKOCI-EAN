# WPP02 — izolovan kandidat radnih preferenci V2

**IMPLEMENTED SOURCE CANDIDATE — NOT DEPLOY READY.** SQL postoji, ali nije primenjen niti izvršen na PostgreSQL-u. Nema client/Edge importa ili aktivacije. Ne primenjivati samostalno: potpuni AI, export i certificate paket nedostaje.

[Ugovor i preostali rad](../../../docs/implementation/ui-ux-pass-20261002/WORKER_V2_CONTRACT_20261003.md) ostaje granica celog V2. Ovaj konkretni **WPP02-A** rez implementira:

- Četiri preference kolone, strogu validaciju i postojeći authority guard.
- Privatni owned read/replace primitive, bez public RPC-a i bez EXECUTE granta aplikacionim ulogama.
- Isti dispatch-only predicate u detailed i cheap selekciji; postojeći manual/hard/score uslovi ostaju.
- Kompatibilnu pauzu koja čuva podatke, blokira novi upis i zaustavlja automatsku selekciju profila sa novim filterima; eksplicitni resume tačnih pauziranih tela.

| Fajl | Namena |
| --- | --- |
| `canonical.sql`, `build_sql_candidate.py` | Izvor novih privatnih funkcija/kolona i reproduktivne minimalne izmene postojećih tela. |
| `candidate.sql` | Transakcioni forward SQL; 11 funkcijskih baseline pinova plus stvarne kolone/constraints/triggers/RLS/ACL/owner preconditions. Nije migration/admission. |
| `compatible-rollback.sql`, `resume.sql` | Tačni body + signature/security metadata pinovi; bez DROP kolona ili gubitka napomena. |
| `body.diff`, `sql-manifest.json` | Tri izmenjene postojeće funkcije, četiri nove privatne funkcije i SHA256 artefakata. |
| `check_sql_source.py` | Lokalni PostgreSQL/PLpgSQL grammar parser i osam relevantnih source granica. Nije izvršavanje baze. |
| `runtime.proof.mjs` | Pripremljen stvarni Auth/PostgREST/PostgreSQL dokaz na postojećem loopback disposable lancu. **NOT RUN.** |
| `contract.json`, `preferences.contract.mjs` | Širi predlog V2 i čista izvršiva specifikacija; bez runtime povezivanja. |
| `preferences.contract.test.mjs` | 18 lokalnih semantičkih/pin provera; obuhvata 24 HITNO kombinacije. |
| `evidence/sql-baseline-*.json` | Naknadno snimljeni stvarni metadata autoriteti za SQL rez; bez korisničkih redova. |
| `LOCAL_CHECKS.json` | Istorijski receipt prvog ugovora od 2026-10-03; njegovi hashovi pripadaju tom koraku. |
| `SQL_SOURCE_CHECKS.json` | Aktuelni lokalni SQL source rezultat i otvoreni runtime uslovi. |
| `APPLICATION_BOUNDARY.md` | Tačan budući approval/admission artefakt i uslovi; nije zahtev za primenu ovog parcijalnog paketa. |

Lokalno, bez nove zavisnosti:

Pre implementacije pročitani su [Supabase changelog](https://supabase.com/changelog), [funkcije i njihove dozvole](https://supabase.com/docs/guides/database/functions) i [PostgreSQL 17 zaključavanje](https://www.postgresql.org/docs/17/explicit-locking.html). Markdown changelog endpoint nije bio čitljiv kroz web alat, pa je korišćena zvanična HTML stranica. Nije menjana verzija baze, CLI-ja ili runtime zavisnosti.

```text
python supabase/candidates/worker-personal-v2-20261003/check_sql_source.py
node --test supabase/candidates/worker-personal-v2-20261003/preferences.contract.test.mjs
node --check supabase/candidates/worker-personal-v2-20261003/runtime.proof.mjs
```

Izvršeno: **8 source/grammar granica PASS; 18 Node testova PASS; runtime JS syntax PASS; novi workflow YAML parsiran postojećom yaml zavisnošću.** Ispravljeni su i ponovo parsirani raniji nedostajući DDL separator i lokalno Windows UTF-8 čitanje. Python PyYAML nije instaliran; nije dodat.

Novi [manual-only disposable workflow](../../../.github/workflows/worker-personal-v2-candidate-proof.yml) koristi isti WPP01 istorijski replay, iste dependency/action verzije i aktuelne stroge relevantne preconditions. Ne proglašava ceo replay identičnim DEV-u. Ovaj računar nema psql/Postgres/Docker/WSL; root je prijavio nedostupan GitHub Actions pristup. **Nema PostgreSQL ili CI rezultata za WPP02.** Prvi runtime može otkriti nepodudaranje relevantne šeme u starom replay-u; precondition se tada popravlja stvarnim dokazom, ne uklanja.

`workNotes` čuva tačan opis „Mogu da nosim, ne mogu da prevozim”. Nije izvršiv filter. Ne izvoditi široku zabranu `SELIDBE_PREVOZ` niti obećavati da odgovarajući poslovi neće stizati.

Zatečeni `retention_policy_sets=0` i `export binding=null` nisu popravljeni. Novi SQL menja closure digest i namerno ne prepisuje sertifikat. Iskustvo 0–80 nije menjano; nula se ne reinterpretira u null ili drugu poslovnu semantiku.

Čuvaju se postojeći admin/service authority izuzeci; auth proveru vlasništva dodatno sprovodi privatni writer i postojeći guard-ovi. Ovaj rez ne tvrdi da menja trusted SQL administratorske privilegije. Ne uvodi notification-preference merge, registry/source-hash/review vezivanje, session V2, AI save/recovery, export projekciju, legal policy ili certificate admission.
