# USKOČI AI — baseline i granice dokaza

Presek: 2026-10-26 UTC (rad je nastavljen 27.10. po lokalnom vremenu).
Repo `uskocibusiness-boop/USKOCI-EAN`, grana `feature/uskoci-cisto`.
Početni lokalni i ponovo provereni GitHub HEAD: `70ac69c3a78d8de062f0c0790b18de78a9c54d6e`.
DEV: `leqcwgzvjsxugfgzdmth`. Produkcija nije proveravana niti menjana.

## Aktivne putanje i verzije

Ranije potvrđen DEV: task v151, worker v104, post-save v5, ACTIVE. Novije lokalne popravke iz ove etape NISU deployovane; ranija source parity provera ne znači da sadašnji lokalni HEAD odgovara deployed bundle-u.

NEED: `nova.tsx → aiNeedTurnStream.ts/aiNeedV2Production.ts → uskoci-ai-interview → durable facts/review → publish/binder/matching`.

WORKER: `profil/razgovor.tsx → workerAiClientService.ts → uskoci-worker-interview → signed review/Save → category/mode/area binding`.

Post-save worker obrađuje gotove planove, ne klasifikuje prazne pending redove. Postojeći minutni cron nije menjan. BG klasifikacija može početi pre completion RPC-a; trajno beleženje rezultata registruje se posle uspešnog completion-a. Sam klasifikator ne objavljuje i ne šalje obaveštenja.

Oba razgovora proveravaju korisnika preko Auth servisa. Samo platform `verify_jwt=false` nije dovoljan zaključak o autorizaciji.

## F0 nije zatvoren

- `01B_FILE_REVIEW_LEDGER.csv`: svi git-index putevi, SHA256 radnih bajtova, tip i status pregleda. NOT_CONTENT_REVIEWED nije završen audit.
- `reviewed-files.json`: samo potpuno pročitani fajlovi sa reviewer-om i hash-om; promena bajtova poništava potvrdu.
- `01_DEPENDENCY_GRAPH.csv`: statički graf iz šest entrypoint-a; RPC literal i istorijska SQL definicija nisu dokaz runtime aktivacije. evidence_line pripada source fajlu za IMPORT/RPC_LITERAL, target SQL fajlu za SQL_DEFINITION_CANDIDATE.
- Potpuna lista aktivnih pisaca/privilegija/triggera, dinamički pozivi, OTA verzija i puna ručna pokrivenost ostaju otvoreni.
- Realni baseline sa test nalozima i telefonom nije pokrenut; zahteva posebno odobrenje.
- Nema novih migracija, masovnog brisanja ili uklanjanja legacy funkcija pre F0 gate-a.

## GitHub / CI

PR #40/#41/#42 ostaju OPEN prema ČISTO grani, nisu spojeni. Potpuni sadržaj svih PR nije ponovno pregledan u ovoj etapi. Welcome očekivanje iz #40 rešeno je ranijim commitom.

Početni CI run `40414037404`, SHA `70ac69c3`: SUCCESS. To nije dokaz za noviji commit.

Poređenje sa `feature/unified-qa-master-20261017` SHA `456328d9b6de16b97c3b75a5fd620efc1d0224df` potvrđuje uklanjanje brojnih istorijskih workflow-a i novi ci-clean.yml. Potrebna je matrica ekvivalentne pokrivenosti; ne vraćati naslepo workflow koji deployuje ili poziva live servis. Ova etapa uključuje nove offline regresije u ČISTO CI.

Dozvoljeno: read-only DEV/GitHub, lokalne izmene, offline testovi, commit/push razvojne grane. Bez DEV deploy-a, produkcije, migracija, stvarnih obaveštenja ili masovne obrade pending redova.
