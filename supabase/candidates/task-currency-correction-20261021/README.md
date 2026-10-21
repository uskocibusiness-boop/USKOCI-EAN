# CUR01 — atomska korekcija već aktivne RSD cene

**Status, 21.10.2026: source-only, blokiran nakon nezavisnog pregleda.** Ovo nije migracija,
DEV primena, SQL runtime PASS, potpisan tok ni potvrda da je postojeća objava
bezbedna. U ovoj fascikli su namerno rollback-only SQL skica, statički parser,
read-only assertion šablon i precizna matrica za izolovanu bazu. Ništa nije
poslato na DEV. Ne kopirati SQL u `supabase/migrations`.

## Dokaz pre izmene

Read-only katalog kanonskog DEV projekta `leqcwgzvjsxugfgzdmth` je pokazao:

| Stavka | Readback |
| --- | --- |
| `retention_ai_source_ready()` | `false` |
| `closure_source_digest_v5()` | `e064bf5bd995c9b846495f9f808c2910ba56d21f5fcb56b84ad98514d569bb79` |
| `closure_source_v5.sha256` i `closure_erasure_source_v5.sha256` | `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb` |
| `closure_binding_v5()`, `closure_erasure_binding_v5()` | oba `NULL` |
| Direktan UPDATE za `authenticated`/`anon` nad AI razgovorom i činjenicama | sva četiri `false` |
| `ai_conversations.price_resolution_state` | ne postoji |

Relevantni živi MD5 `pg_proc.prosrc` su pinovani u SQL skici. Posebno,
`rpc_ai_claim_need_turn_v2_service` je na DEV-u SQL omotač
(`0b3c7f1d276a3b4349aeebee4f111af7`) oko
`private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)`
(`114bd0b4b9d6e60a0abb0d0d64e63c69`). Ta pomoćna funkcija nije u
primenjenom repozitorijumskom nizu migracija, a koristi je i lokacijski claim.
Skica zato pinovano umeće korekciju u zajednički helper, posle idempotency i
location-context provera, pre context hasha. Svih 12 izabranih live patch
ankera je read-only provereno; prvi pokušaj da se cilja stari javni claim
odbačen je jer na DEV-u nema taj blok.

## Šta je zapisano u kandidatu

- `EUR/evra/евра/€` se proverava kroz celu validnu poruku do 4000 znakova,
  uključujući prvi turn bez prethodne cene. Kasniji price signal u
  `RSD_READY`/`OFFERS_READY` ili uz postojeću cenu pod conversation pa Need
  zaključavanjem atomarno superseduje tri aktivna price fakta i postavlja
  `UNRESOLVED`. Već prihvaćen DRAFT Need se ne menja u claim-u. PUBLISHED i
  SELECTION vraćaju `PRICE_CORRECTION_REQUIRES_REPLACEMENT`. Ograničena fraza
  „po osobi”/„ukupno” bilo gde u kasnijoj poruci (npr. „to je po osobi”,
  „samo ukupno”, „ipak po osobi, ne ukupno”), cela poruka od 1–2 cifre i
  izričita kratka ispravka takođe poništavaju prethodni READY; broj ljudi
  ili datum u dužoj rečenici ne aktivira novo pravilo za 1–2 cifre.
- Hash turn konteksta i review source uključuju stanje. Writer čuva nezavisne
  predloge, ali ne priznaje izmišljenu RSD konverziju. Novi RSD amount mora
  biti jedini novčani iznos u jednostavnoj celoj izjavi o ceni zadatka.
  `5.000 RSD` se čita kao 5000; sporedni trošak, dva iznosa ili nejasno
  razdvajanje hiljada traže pojašnjenje. Broj potrebnih ljudi mora biti
  poznat: za jednog nema `price_basis`, za više ljudi mora biti izričit.
  OFFERS mora biti izričit izbor. Tokom pending korekcije dupli modelovi
  `need.price_mode`, `need.price_rsd` ili `need.price_basis` odbacuju ceo
  price triple pre postojeće writer petlje, dok nezavisni validni fakti
  ostaju. Failure/cancel/lease ne vraćaju staru cenu.
- Prethodno otvoreni NEED_INTAKE nacrti sa aktivnim price faktima ili već
  sačuvanom DRAFT cenom dobijaju `UNRESOLVED` bez tihog brisanja činjenica.
  One postaju zastarele za pregled i objavu dok ih potpisan owner turn ne
  superseduje. Vezan priced PUBLISHED/SELECTION, drugi non-DRAFT Need ili
  svaki zatvoren razgovor sa aktivnim price faktom (i kada `bound_need_id`
  nije popunjen) prekidaju transakciju sa
  `CUR01_HISTORICAL_PUBLISHED_OR_CLOSED_PRICE_INVENTORY_REQUIRED`. Njihov
  owner-visible tretman i broj moraju biti popisani pre forward verzije.
  Otvoren razgovor sa starom šemom i aktivnim price faktima zasebno prekida
  skicu sa `CUR01_HISTORICAL_LEGACY_PRICE_INVENTORY_REQUIRED`, jer novi V2
  claim ne bi mogao da ga razreši.
- Oba prepare puta vraćaju `canAccept=false` i poruku za nerešenu cenu.
  Accept proverava stanje/source pod lockom, a READY → NORMAL radi u istoj
  transakciji kao save. Direktni novi draft/edit writer odbijaju pending
  stanje; stari isti receipt ostaje read-only replay.
- Need-locked publication context odbija svaki vezani pending razgovor i
  proverava `MY_PRICE`/RSD/basis i `OFFERS` bez iznosa. Postojeći kanonski
  publisher koristi taj context; stari publish receipt ostaje samo čitanje.

SQL je namerno omeđen jednim `BEGIN`, završnim obaveznim exception-om i
`ROLLBACK`, bez `COMMIT`. Čak i ako se početni gate jednog dana popravi,
trenutni fajl ne može postati forward migracija. Statička provera:

```text
python supabase/candidates/task-currency-correction-20261021/validate_static.py
STATIC PARSE ONLY: 26 candidate SQL statements, 4 assertion statements; rollback-only gate present
```

`ISOLATED_ASSERTIONS.sql` je SQL šablon za čitanje konkretnih sintetičkih
fixture-a posle istorijskog karantina/claim/failure/RSD/OFFERS/accept radnji. Pglast parsira 4
izjave. `AFTER_ACCEPT` proverava sačuvani Need mode, RSD iznos i basis (ili
`OFFERS` bez iznosa/basis-a), kao i novu DRAFT reviziju i `NORMAL` marker;
tačna očekivanja se predaju kroz `cur01.proof_expected_*` parametre iz matrice.
Nije izvršen na bazi i ne proizvodi PASS.

## Obavezni zavisni redosled

1. Read-only identifikovati zašto je DEV closure digest već različit od oba
   sačuvana SHA i zašto je exact AI retention whitelist nevažeći. Uporediti
   `pg_get_functiondef`, ACL, kolone, constraint-e i trigere sa stvarno
   primenjenim migracijama, naročito DEV-only location claim helper.
2. Na **provereno izolovanoj** bazi napraviti posebnu forward popravku
   retention whitelist-a i closure/erasure source binding-a. Ne menjati samo
   SHA: proveriti policy `sourceSha256` i njegov content hash, AI brisanje,
   retention, pravila čuvanja i obuhvat nove kolone. Dobiti
   `retention_ai_source_ready=true` i oba non-NULL binding-a pre CUR01.
3. Pre forward verzije popisati istorijske vezane priced Need-ove. DRAFT
   otvoreni razgovori mogu u karantin; PUBLISHED/SELECTION, drugi non-DRAFT
   statusi i zatvoreni razgovori zahtevaju zasebnu odluku i dokaz da ranija
   objava nije tiho promenjena. Klijent mora označiti prikaz stare cene kao
   zastareo dok je marker `UNRESOLVED`.
4. Tek tada preneti skicu u pregledanu forward migraciju sa svežim MD5/ACL
   pinovima; proveriti da oba claim puta, oba prepare puta, writer, accept,
   draft/edit save i kanonska objava imaju ista pravila. Dovršiti closure
   rebind za novu kolonu u toj istoj transakciji.
5. Na izolovanoj bazi izvršiti `REGRESSION_MATRIX.md` sa dve SQL sesije i
   potpisane Edge/owner prohode. Readback definicija, ACL, digest-a i
   `ISOLATED_ASSERTIONS.sql` čini tek tada SQL/runtime dokaz.
6. Posle tog dokaza razmatrati DEV migraciju i zatim signed klijent prohod.
   PUBLISHED/SELECTION korekcija traži zaseban novi task ID i atomski
   replacement tok; CUR01 ga ne implementira.

## Poznate granice skice

- Nema izvršnog PostgreSQL/PLpgSQL testa, dve sesije, fixture-a ni provere
  closure erasure posle nove kolone. Statički parser proverava spoljašnji SQL,
  ne dinamički generisane definicije niti PL/pgSQL runtime.
- Detektor valute je namerno konzervativan: kratka EUR poruka može zaustaviti
  pregled i kada se odnosi na drugi trošak. Propust drugačije formulisanog
  ispravka mora se tražiti signed regresijom i dopuniti pre primene.
- RSD provera prihvata samo jednostavnu celu izjavu, pa složena poruka može
  zahtevati još jedan odgovor. Tokom nerešene korekcije, ako korisnik u istoj
  poruci prvi put navede broj ljudi i RSD cenu, writer može sačuvati broj
  ljudi, ali cena ostaje
  `UNRESOLVED` do zasebne potvrde cene: filter čita samo prethodno potvrđen
  `need.people_needed`, a izdvajanje iznosa odbija mešovitu izjavu. To je
  namerno konzervativna granica skice, ne završen prirodan AI tok.
  Numerički signal uz READY ili već sačuvanu
  cenu može konzervativno zaustaviti cenu i kada se odnosi na datum/adresu.
  To treba proveriti sa stvarnim AI razgovorom i ublažiti bez otvaranja stale
  price putanje.
- Skica nema dokaz da istorijska DRAFT vrednost nije prikazana kao nova
  važeća cena u svim klijentskim prikazima, niti izvršen test fact/retention
  trigger-a posle promene. Ovo su zasebni acceptance uslovi.
- Izričito biranje ponuda i RSD basis prepoznaju samo uske formulacije. To je
  fail-closed nacrt, ne dokazana jezička pokrivenost.
- Samostalna poruka „20” dok je READY namerno poništava staru cenu, ali ne
  potvrđuje novu bez RSD jedinice. Ona može biti i kratak odgovor na drugo
  pitanje; taj UX rizik zahteva signed probu pre forward porta.
- Fraza „ukupno” u nevezanoj rečenici („ukupno dve kutije materijala”) može
  konzervativno poništiti READY cenu. Ovo je svesno fail-closed ponašanje,
  ali test razgovora mora pokazati da dodatno pojašnjenje nije prečesto.
- Ne zamenjuje atomski replacement objavljenog zadatka niti rešava širi
  dvo-valutni ugovor za writer, ponude, Dogovor, matching i filtere.
