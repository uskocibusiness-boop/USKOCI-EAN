# DEV reliability application — 18.10.2026.

Primenjeno na DEV `leqcwgzvjsxugfgzdmth`, ne na produkciju. Izvor prethodnog lokalnog paketa je objavljen kao `f2eec00917534d98522c8d4f9f3f230982815c26` (isti testirani tree). Novi APK/OTA nije napravljen niti instaliran.

## Stvarni rezultat

- Početni pregled koristi postojeći javni RPC, najviše tri tuđa otvorena zadatka; nije personalizovani matching. Nema full-list fallback-a ni novog vizuelnog redizajna Početne.
- Tri taxonomy deterministička stale-catalog konflikta sada su `PT409`, ne `40001`. Poslovne odluke, poruke, zaključavanje i service-only pristup nisu promenjeni. Prave serialization greške nisu presretnute.
- Javni reader ostaje SECURITY INVOKER. Nisu dodati grantovi, polise, tabele ili privatna polja. Identitet vlasnika zadatka nije otkriven klijentu.

## Pronađena regresija i oporavak

Prva migracija `20261018201142` uvela je uslov nad `needs.requester_account_id`. DEV namerno ne daje SELECT nad tom kolonom; planiranje je zato odbijalo i obične pozive. Lokalna fixture je davala ceo SELECT i propustila stvarno ograničenje. To je stvaran neuspeh, ne uspešna isporuka.

Nova forward migracija `20261018201253` odmah je vratila prethodni reader, uz zadržane taxonomy ispravke. Zatim je `20261018201517` primenila proverenu varijantu: postojeći sopstveni profil/RLS i nepromenljiva veza profila sa vlasnikom zadatka. Nema proširivanja prava niti prelaska na SECURITY DEFINER. Sva tri zapisa ostaju u dnevniku; nijedan primenjen fajl nije naknadno prepravljen. Lokalni nazivi odgovaraju stvarno dodeljenim DEV verzijama i SQL tekstovi su bajt-tačni.

## Dokazi i njihove granice

- PostgreSQL/PGlite **27/27**, uključujući novu reprodukciju 42501 pod ograničenjima kolona i ispravku. Prava taxonomy tela sa pgcrypto izvršavaju signed review, saglasnost, stale prepare/commit/batch, ponavljanje i atomsko odbijanje. To nije ceo Supabase/Auth/Storage lanac.
- Klijent: **208/208**, pet povezanih Jest fajlova; TypeScript PASS. Ranija puna regresija 624/624 / 13839/13839 važi za prethodni aplikacioni izvor; ovaj paket ne menja aplikacioni TS.
- Stvarni DEV: tri postojeća naloga, stvarni RLS/kolone i PostGIS. Preview rezultati **0 / 3 / 0**, tačno po vlasništvu i vidljivosti. Ordinary/exact/viewport/cursor rezultati pre i posle imaju iste sažetke. Test je read-only, bez fixture naloga i poslovnih upisa.
- Ledger **285 → 288**. Tela četiri funkcije, owner/ACL/config/security/volatility/komentari i nepromenjen closure digest su pročitani posle primene. Advisor nalazi su isti pre i posle, ne nula.
- Raniji closure sertifikat se i dalje ne poklapa sa izvorom; aktivna politika čuvanja nedostaje. Nema re-bind-a, brisanja naloga niti izmišljenih pravnih rokova. Closure/taxonomy kandidat mora dobiti sveže preimages posle ove izmene.

[Mašinski dokaz](evidence/DEV_RELIABILITY_APPLICATION_20261018.json) čuva tri migracije, hash-eve, anonimizovane rezultate uloga i granice. SQL probe je `supabase/proofs/home-read-reliability-20261018/dev-role-read.sql`; poslednji generator je `invoker-fix.cjs`, a prvobitni `forward.sql` je istorijski neuspešan kandidat i ne koristi se za novu primenu.

## Integritet migracionog izvora

Otkriven je preegzistirajući manjak 18 SQL fajlova u manifestu, plus tri nove migracije. Sada 168 fizičkih fajlova ima checksum registraciju; zamrznuti istorijski replay 87+60 ostaje nepromenjen, a 21 novi sufiks ima zasebno dokazanu klasifikaciju. Tačno podudaranje dnevnika, različiti zabeleženi bajtovi i nepotvrđena live veza NISU izjednačeni. Checksum registracija nije potvrda da su različiti stari fajlovi bezbedni za replay. Negativni testovi odbijaju lažne tvrdnje o primeni, pogrešan projekat, hash, verziju i klasifikaciju.

Postojeći Home parity CI dobija aktuelni ograničeni posao bez tajni/DEV pristupa; istorijski skupi replay ostaje na svojoj istorijskoj grani. Zastarela provera koja je tražila stari entry-map u AGENTS usklađena je sa aktuelnim manifestom vlasništva; fake-source i sigurnosne provere ostaju.

Završne dodatne provere: integritet 168 migracionih fajlova i 13 negativnih/participant testova PASS; CI/control Node **51/51**; build/assets/boundary Node **38/38**; aktuelno vlasništvo izvora, YAML obe izmenjene procedure i LIVE konzistentnost PASS. Raniji pad CI testa o starom entry-map-u je reprodukovan i ispravljen prema aktuelnom AGENTS/owner manifestu, bez vraćanja starog autoriteta. Inventory klasifikacija: 12 tačnih ledger tekstova, 4 sa različitim tekstom, 5 bez potvrđene live veze.

Marker `NATIVE_RELIABILITY_REQUEST_20261018.json` pokreće postojeći preview APK workflow pri objavi tačnog ovog paketa (ARM64 za telefon). To je zahtev za build, ne dokaz uspeha ili instalacije. Workflow ponavlja SQL/integritet i punu aplikacionu regresiju pre pakovanja; nema proizvodne objave ni automatske zamene instalacije korisnika.

Objavljeno kao `73e1915b38151c7dca23bc90a864a96912832d9f`, tačan tree `db3427bdea863a219b412815649ef23f267d4b6c`. APK run `39163340552` je stvarno pokrenut; SQL/integritet i preview identitet u njemu su prošli. U trenutku ovog zapisa build nije završen. Odvojeni Home CI run `39163339322` odbijen je pre pokretanja poslova: `runner.temp` nije dozvoljen u job-level `env`. Ispravka koristi `$RUNNER_TEMP` tek u izvršnom koraku, kao već uspešan APK korak; dodatni negativni test odbija originalni mutant. Ovo je CI konfiguracioni propust, ne novi DEV pad.

## Ostaje otvoreno

DEV PostgREST HTTP stale konflikt, kompletan migracioni replay, reprezentativno opterećenje, APK/uređaj i dva naloga kroz ceo tok nisu dokazani. Home core lične kolekcije se još čitaju širokim putem. Vizuelni rad, AI vreme/lokacije/rute, Dogovori, grupni čet i obaveštenja ostaju otvorene povezane celine, ne rešene ovim paketom.
