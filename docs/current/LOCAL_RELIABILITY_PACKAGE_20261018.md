# Prvi lokalni paket posle read-only audita

**Istorijski lokalni presek.** Naknadno odobrenje, primena, otkrivena regresija i potvrđena forward ispravka su u [DEV izveštaju](DEV_RELIABILITY_APPLICATION_20261018.md). Tadašnji dokaz ispod nije naknadno pretvoren u DEV/phone dokaz.

Polazište: `aa61d04e265811f2f5a6139b7c03d70611b8d793`, grana `feature/unified-qa-master-20261017`. Konkretno odobrenje vlasnika odnosi se na kod, lokalne SQL kandidate i testove. **Nema živih upisa u Supabase, push-a, OTA, novog APK-a niti instalacije.** Ovo nije novi glavni plan niti završeni redizajn.

## Šta je promenjeno

| Oblast | Lokalni rezultat | Granica |
| --- | --- | --- |
| Build paritet | EAS preview/production manifesti imaju tri EX04 proizvodne zastavice kao CI/OTA. Zajednička provera odbija njihovo odsustvo ili pogrešnu vrednost. | Produkcija ostaje blokirana dok nema zaseban potvrđen backend. |
| Pogrešna zabrana u testu | Stari prefix-wide test zabranjivao je i tri stvarne proizvodne zastavice. Sada dozvoljava tačno te tri, a testno smanjivanje stranica i dalje zabranjuje u release konfiguraciji. | Test nije obrisan niti su zaštite testnog režima isključene. |
| Aktuelni zadaci na Početnoj | Nova metoda `prilikeZaPocetnu` traži najviše tri tuđa javna zadatka kroz postojeći `rpc_list_open_tasks_v3`, bez paginacionog obilaska. | SQL režim još nije primenjen; klijent ne sme samostalno u objavu. Nije matching niti ukupan broj zadataka. |
| Dopuna kartica | Najviše tri različita autora, postojeće ograničenje dopune hitnosti; validacija, account revision i AbortSignal ostaju. | Ovo nije merenje korisničke brzine. Lične liste u Home core-u još se čitaju postojećim putem. |
| Tri taxonomy konflikta | Kandidat menja samo SQLSTATE determinističkog stale-catalog konflikta, `40001` → `PT409`, uz istu poruku i poslovnu logiku. | Prava admission/binding operacija i HTTP ponašanje nisu izvršeni na DEV-u. |
| Oporavak | Strogi hash/metadata guard, atomsko odbijanje drifta, nepromenjen closure digest pri budućoj primeni i tačan revert. | Nema automatskog prepisivanja tuđeg novijeg izvora niti relaxed režima. |

Stari Home put mogao je da obiđe do 25 stranica po 200 javnih zadataka i tek potom prikaže tri. Novi preview pravi jedan kolekcijski zahtev za tri; sopstveni, popunjeni i zadaci sa isteklim rokom za prijavu isključuju se na serveru pre limita. Mapa/discovery i exact-ID javni detalj nisu prevezani na ovaj preview. Tri je trenutni budžet pregleda, ne nepromenljivo pravilo dizajna.

## Dokazi

- Povezani Jest: **208/208**, pet fajlova (Home route/preview, bounded čitač, EAS guard i test-page guard).
- Node/build/OTA/assets/boundary: **44/44**. Provera vlasništva aktuelnog izvora: PASS.
- Lokalni PostgreSQL/PGlite: **9/9**, uključujući pre-image reprodukciju, invoker/RLS, javnu allowlistu, filtriranje pre limita, auth/invalid input, nepromenjene obične/exact/cursor/bbox fixture rezultate, metadata i byte-exact revert.
- TypeScript: PASS posle ispravke tipa testne parametrizacije.
- Prva puna regresija: 623/624 fajla, 13838 uspešnih i 1 neuspešna provera. Jedini pad bio je preširoka zabrana EX04 proizvodnih zastavica; ciljano ispravljeno i ponovo provereno.
- Završna puna regresija: **624/624 fajla, 13839/13839 provera, 3/3 snapshot-a, 0 preskočenih; exit 0** (239,986 s za testove). Jest je posle završetka kratko prijavio otvoreni asinhroni posao, pa se sam normalno završio; ništa nije force-exit-ovano. Dodatni `--detectOpenHandles` na četiri pogođena fajla prošao je **206/206**, exit 0, bez prijave otvorenih handle-ova. To ne utvrđuje poreklo početnog upozorenja cele suite.

Mašinski rezime i hash-evi pogođenog izvora: [RELIABILITY_PACKAGE_20261018.json](evidence/RELIABILITY_PACKAGE_20261018.json). Registar i LIVE projekcija su osveženi bez promene phone/release prihvatanja. Opcioni `gh` CI lookup u ovom okruženju nije vratio sveže rezultate, pa generisani `ci` ostaje nepoznat (`null`); raniji datirani CI dokazi i Git istorija nisu potvrda novog paketa.

Lokalni PG dokaz koristi realna pročitana tela četiri funkcije, ali **nije replay cele Supabase šeme**. Taxonomy tela se transformišu bez izvršavanja zavisnih poslovnih operacija; izvršavaju se izdvojeni deterministički raise-ovi. Closure je fixture, geografija je box-backed zamena, ne PostGIS. Nisu dokazani stvarni gateway retry/HTTP, kanonski RLS lanac, prostorne performanse ni native tok novog paketa.

## Nastavak i predaja

SQL izvor, strogi forward/revert i reprodukcija: [kandidat](../../supabase/candidates/home-read-reliability-20261018/README.md). Ne menjati istorijske migracije. Pre bilo kakve primene ponovo proveriti aktuelna tela/ACL, dokazati paket na stvarnom migracionom/PostGIS/PostgREST lancu, napraviti novu CLI forward migraciju pod odgovarajućim ovlašćenjem, primeniti backend pa klijent. Nema tihog fallback-a na stari full-list walk. Ako backend odbije novi filter, optional odeljak prikazuje grešku i retry, ne lažno prazan uspeh.

Sledeća tehnička celina: zbirni/ograničeni Home core read model bez gubitka tačnih brojeva i pažnje, uz merenje stvarnog toka. Vizuelni nastavak ostaje jedini Premium White canon: ikone/globalni sistem/Početna, zatim povezani ekrani. AI vreme/rokovi, regionalna pokrivenost/rute, dogovori, više izvršilaca, čet i push ostaju zasebne otvorene funkcionalne celine. Ni ovaj paket ni prolaz testova ne dokazuju da su rešene.
