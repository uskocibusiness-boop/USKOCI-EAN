# USKOČI — izveštaj o realizaciji i pripremi kapaciteta

**Datum: 8. novembar 2026.** Ovo je datirani izveštaj izvedenog rada i njegovih granica. Jedini izvršni autoritet ostaje [CODEX_PLAN_RADA.md](../CODEX_PLAN_RADA.md), a proizvod vodi [Product/UX master](../../product/USKOCI_PRODUCT_UX_MASTER.md), uz najnovije odluke vlasnika.

**Izvedene su stvarne popravke, testovi, GitHub integracija i pet DEV migracija. Kapacitet za 300.000 korisnika nije potvrđen.** Rad je nastavljen na postojećem projektu; koordinator i tri pomoćna agenta koristili su odvojene radne kopije. Nisu promenjena pravila o četiri taba, zajedničkoj reputaciji, najviše šest fotografija zadatka, korisničkoj potvrdi cena ili privatnoj lokaciji. [Izvršni checkpoint](../CODEX_PLAN_RADA.md#aktuelni-izvršni-checkpoint--08112026-kapacitet-push-discovery-dogovori-i-mediji).

## A. ŠTA JE STVARNO POPRAVLJENO

### Obaveštenja: red sada obrađuje ograničene grupe poslova

Prethodni automatski ciklus obrađivao je približno jedno slanje i jednu proveru potvrde. Pri većem broju događaja korisnik je mogao dugo čekati obaveštenje. Transport sada ima odvojene putanje za nova slanja i potvrde: najviše 100 operacija po putanji u jednom ciklusu i četiri paralelna slanja. Sačuvani su zajednički i pojedinačni limiti, deduplikacija i pravičnost uz povećavanje prioriteta starijih poslova.

Poznati neuspeh ima ograničen broj pokušaja; nepoznat ishod ne izaziva slepo ponovno slanje. TTL prati rok važenja, najviše jedan sat, pa telefon koji je privremeno nedostupan više nije automatski vezan za raniji `ttl: 0`. Dodata su očitavanja veličine reda i starosti najstarijeg posla. Izmena je na DEV-u kao **Edge v46**, sa tačno proverenim kodom i SQL-om. Uspešno je izvršen prazan ciklus. To ne potvrđuje Expo isporuku ili prikaz na telefonu. [Lokalni testovi](../../../scripts/r09-push-capacity-20261108.receipt.json), [DEV dokaz](push-capacity-dev-20261108.json).

### Discovery: manje skupog rada pre prikaza relevantnih zadataka

Ranije je veliki skup otvorenih zadataka prolazio kroz skupe projekcije pre sužavanja. Cena, minimalni iznos i način izvršenja sada sužavaju kandidate ranije. Očuvani su rezultati filtera, globalni brojači, približne koordinate, redosled i nastavak stranica. Osam postojećih DEV upita dalo je isti odgovor pre i posle promene.

Podaci autora P6 kartica sada stižu jednim autorizovanim paketom za najviše 100 profila. To uklanja mnoge pojedinačne mrežne zahteve; postojeća bezbednosna pravila javnog profila ostaju. Production reader još koristi LEGACY: ova optimizacija ne znači da je noviji prikaz već uključen svim korisnicima. [Discovery DEV](discovery-capacity-dev-20261108.json), [profili i prava](reader-capacity-dev-20261108.json).

### Matching: vraćen je validan radnik sa udaljenim pinom

Normalna distribucija sa dnevnim limitom mogla je izostaviti radnika čiji je pin udaljen više od 300 km, iako njegovo sačuvano radno područje pokriva zadatak. Popravljen je taj izostavljeni uslov, uz isti glavni matcher, dnevni limit i zaštitu od ponavljanja poziva.

Na izolovanom PostgreSQL/PostGIS primeru udaljenost je bila 356.258 metara: osnovni reader nalazio je jednog kandidata, prethodni ograničeni reader nijednog, a popravljeni jednog. Prošli su slučajevi fizičkog i REMOTE rada, limita, opozvanih mogućnosti i povratka prethodne verzije. Kod je na DEV-u. Četiri postojeća DEV zadatka imala su nula kandidata pre i posle, pa pozitivan dokaz ostaje izolovani test. [Native dokaz](../../../scripts/sql/p0_dispatch_saved_areas_20261108.native-receipt.json), [DEV potvrda](matching-capacity-dev-20261108.json).

### Dogovori: prvo se učitava ono što korisnik gleda

Ekran Dogovora više ne mora prvo preuzeti skoro celu istoriju. Novi reader učitava po 20 **celih grupa zadataka**, uz pretragu, filtere i stabilan nastavak. Jedna grupa može sadržati više bilateralnih saradnji. Sačuvani su prihvaćeni iznosi, jedinice cene, statusi, ocenjivanje i mogućnost ponovnog pokušaja.

Na DEV-u je provereno svih 16 postojećih naloga: dobijeno je svih 12 očekivanih vlasničkih projekcija šest Dogovora, bez tuđih ili duplih redova. Provera je koristila SQL ulogu `authenticated` sa ograničenim testnim JWT tvrdnjama; ona potvrđuje SQL prava i rezultat na malom uzorku, ali nije prijava običnim tokenom preko aplikacije niti veliko opterećenje. Početna i kalendar još imaju stare potrošače cele liste. [DEV provera](reader-capacity-dev-20261108.json), [izolovano merenje](../../../scripts/sql/r09_agreement_groups_20261108.benchmark.json).

### Fotografije: manje ponavljanja i ispravniji rokovi

Posle uspešnog prenosa fotografije klijent sada koristi potvrdu tog prenosa umesto ponovnog čitanja statusa i inventara nakon svakog fajla. Autorizacija, idempotencija i oporavak nepoznatog ishoda ostaju. Prenos ima rok od 55 sekundi sa stvarnim prekidom; čitanje binarnog sadržaja ima ukupnih 30 sekundi kroz autentifikaciju, mrežni odgovor i telo. Uklonjen je unutrašnji rok od 15 sekundi koji je prekidao inače dozvoljene odgovore.

Lokalni URI cache ograničen je na 16 MiB i nova poseta ponovo proverava pravo pristupa privatnoj slici. **To nije izmerena potrošnja RAM-a aplikacije.** Thumbnail nije uveden; original, JavaScript/base64 obrada i stvaran prikaz na telefonu ostaju za proveru. Promenjen je klijent; postojeća unapređena media Edge zaštita nije vraćena na staru verziju. [Test rokova i povezanih regresija](../../../scripts/media-binary-deadline-20261108.receipt.json).

### Tekst i glas: popravljeni konkretni zastoji

Čet koji prati najnovije poruke koristi jedno autorizovano čitanje kada se nove i postojeće poruke preklapaju. Kada postoji rupa ili korisnik čita stariju istoriju, zadržano je dodatno čitanje koje sprečava preskakanje poruka.

Glasovni gest se oslobađa posle odbijene dozvole, neuspelog početka ili spontanog prekida snimanja, pa prethodni pokušaj ne blokira sledeći. Stari hook je u reprodukciji imao osam padova; novi slučajevi i povezane regresije prolaze. Ovo nije dokaz rada mikrofona, reprodukcije ili slanja između dva telefona. [Čet](../../../scripts/agreement-history-refresh-20261108.receipt.json), [glas](../../../scripts/voice-gesture-lifecycle-20261108.receipt.json).

### Poslednje mesto: potvrđena postojeća zaštita

U izolovanoj bazi dve odvojene PostgreSQL konekcije zaista su istovremeno pokušale izbor različitih radnika za jedno mesto. Posle otključavanja uspeo je tačno jedan izbor: jedno zauzeto mesto, jedan Dogovor i jedan zapis izbora. Namerni timeout nije ostavio delimične upise; dva paralelna ista ključa vratila su isti Dogovor. Koordinator je ponovio sva tri scenarija. Ovde je **potvrđena postojeća zaštita**, bez nove poslovne izmene; Auth transport i nepovezani sistemi bili su ograničene testne zamene. [Konkurentni dokaz](../../../scripts/sql/p0_last_slot_concurrency_20261108.receipt.json).

## B. ŠTA JE OPTIMIZOVANO

| Kontrolisani primer | Pre | Posle | Granica merenja |
| --- | ---: | ---: | --- |
| Push ciklus | 1 SEND + 1 RECEIPT | 100 + 100 | Stvarni handler sa kontrolisanim testnim zavisnostima; nije prijem na uređaju |
| Šest uspešnih fotografija | 33 zahteva | 6 zahteva | Bez početnog inventara i zasebnog vezivanja poruke |
| Prvi prikaz među 1.050 saradnji | 11 RPC; 973.813 bajtova | 1 RPC; 22.694 bajta | Izolovani reader; dodatna čitanja kartica nisu uključena |
| Podaci 100 autora P6 kartica | 100 mrežnih RPC | 1 mrežni RPC | Unutrašnjih 100 SQL reader poziva ostaje |
| Osvežavanje preklopljenog najnovijeg četa | 2 RPC | 1 RPC | Praznine i starije sidro opravdano zadržavaju 2 |
| Discovery kalendarske projekcije | 10.009 poziva | 24 poziva | Isti odgovor sa 20 pogodaka u sintetičkom primeru |

Izvori su [push](../../../scripts/r09-push-capacity-20261108.receipt.json), [Dogovori](../../../scripts/sql/r09_agreement_groups_20261108.benchmark.json), [autori](../../../scripts/sql/r09_public_profiles_batch_20261108.receipt.json), [čet](../../../scripts/agreement-history-refresh-20261108.receipt.json) i [Discovery](../../../scripts/sql/p0_discovery_materialization_20261108.benchmark.json); foto rezultat je evidentiran u [izvršnom checkpoint-u](../CODEX_PLAN_RADA.md). Zasebna integracija stvarnog SQL-a i push handlera sa simuliranim Expo servisom obradila je 12 slanja i 12 potvrda bez dupliranja. Ni taj rezultat nije isporuka na telefon.

Native PostgreSQL 17.11/PostGIS 3.5.2 koristio je 10.012 sintetičkih redova i jednog klijenta:

| Discovery upit | p50 pre → posle | p95 pre → posle | p99 pre → posle |
| --- | ---: | ---: | ---: |
| Selektivna lista | 101,38 → 12,98 ms | 109,77 → 14,64 ms | 113,21 → 17,32 ms |
| Nefiltrirana lista | 97,64 → 100,40 ms | 112,75 → 109,75 ms | 114,70 → 156,88 ms |
| Selektivna mapa | 82,09 → 5,90 ms | 84,83 → 6,80 ms | 85,47 → 7,29 ms |

Svaka varijanta ima 25 uzoraka; p99 je njihov maksimum i statistički je slab pokazatelj. Nefiltrirana lista nije dokazano ubrzana. Unutrašnji izvršni plan potvrđuje smanjenje skupog početnog skupa sa 10.009 na 23 reda, uz konačnih 20 pogodaka; privremeni upisi selektivne liste i mape pali su na nulu. Ovo nisu vremena otvaranja ekrana, fizičke mreže ili hiljada paralelnih korisnika. Potrošnja RAM-a telefona i stvarna brzina push isporuke nisu izmerene. [Potpun native zapis](../../../scripts/sql/p0_discovery_materialization_20261108.benchmark.json).

## C. GITHUB I TESTOVI

Repozitorijum je `uskocibusiness-boop/USKOCI-EAN`, grana **`work/uskoci-cist-proizvod-20261104`**. Početni commit je `9cf4f5ee913a3751f83615e134a1e6d7c68300f3`; završni objavljeni aplikacioni source ovog preseka je **`f0ea98106537f5a844721400d5357d5e21689cc1`**. Kasniji završni dokumentacioni commit-i čuvaju isti aplikacioni source; njihov tačan GitHub HEAD naveden je uz završni odgovor i dostupnu istoriju grane.

Pošto CLI nije imao kredencijale za push, 17 commitova preneto je povezanim GitHub API-jem. Proverena je identičnost sadržaja svih stabala, uz kontrolisanu izmenu grane bez prisilnog prepisivanja. Različiti lokalni i udaljeni SHA potiču od commit metapodataka; [mapa prenosa](capacity-github-transfer-20261108.json) čuva poređenje.

Važni fajlovi obuhvataju `uskoci-push-transport/index.ts`, `agreementClientService.ts`, `ownAgreementGroupsPage.ts`, `publicProfileClientService.ts`, `agreementHistoryModel.ts`, `agreementPhotoClientService.ts`, `AuthorizedPhoto.tsx`, glasovne hook-ove i pet SQL migracija. Lokalno je prošlo **963/963 Node testa**, TypeScript i **39/39 provera za 221 SQL fajl**. Jedan raniji integracioni pad bio je zastarela putanja push migracije u testu; ispravljen je, a ceo paket ponovljen. Nema preostalog pada u tom završnom paketu. [Integracioni dokaz](capacity-local-integration-20261108.json).

Na istom objavljenom source-u **QA58 source-checks su prošli**: 963/963, TypeScript bez grešaka, 221 SQL/39 provera. Koordinator je nezavisno preuzeo checks ZIP i proverio digest. [GitHub Actions run 42435554637](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/42435554637). Uspeh tog posla ne daje automatski uspeh celom Android workflow-u.

**Završna QA58 potvrda:** ceo workflow i oba posla su **SUCCESS**, završni status je 08.11.2026. u 02:01:13 UTC. Istorijski recorder ispravno je vratio `SKIPPED_ALREADY_RECORDED`. [APK artefakt 13599613709](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/42435554637/artifacts/13599613709) sadrži `USKOCI-QA-f0ea98106.apk`, **83.409.667 bajtova**, SHA-256 **`34cdb4e5a68eb44df8f039c8874ede5a2d426a84aeec38d06c6205699addca48`**. Paket je `rs.uskoci.preview.qa`, verzija 1.0.0 / code36, ARM64, minSDK24 / target36, kanonski DEV, ugrađen bundle i OTA off/NEVER.

Originalni checks i APK ZIP digest/veličina provereni su prema GitHubu. Nezavisni verifier je potvrdio APK/config iz istog artefakta, source SHA u `assets/app.config`, native marker i isti debug sertifikat kao QA47 prema CI apksigner potvrdi. Pregled 51.548 Hermes stringova našao je samo kanonski DEV Supabase host, bez service-role JWT ili modernog secret literala; to nije potpun audit native binarnih fajlova. Source SHA nije namerna Hermes konstanta; potvrđuje ga ugrađena konfiguracija i isti CI build. `sourceDirty=true` potiče iz dokumentovanog QA podešavanja `app.json`, zato nije proglašen reproduktivan build potpuno neizmenjene kopije.

**Nema instalacije, emulatora, fizičkog telefona ili stvarnog E2E prihvata.** Ovaj QA paket nema Firebase push-proof konfiguraciju; za OS push treba postojeći namenski preview tok. [CI/readback](qa58-ci-readback-20261108.json), [potpun nezavisni APK dokaz](qa58-local-verifier-20261108.json), [source identity ugovor](qa58-source-identity-contract-20261108.json). Novi verifier je zasebno prošao 20/20 lokalnih Python testova; oni nisu dodati broju 963 CI testa.

Na DEV-u su potvrđeni Edge46 i migracije `20261108010233`, `20261108012341`, `20261108012344`, `20261108012644`, `20261108012842`, uz proverene bajtove, prava i povratne skripte. Završni snimak ima 16 korisnika, 18 zadataka, 6 Dogovora, 12 poruka, 38 Storage objekata i 356 migracija. Tri cron posla nisu imala pad u posmatranih 30 minuta; push red je bio prazan. To pokazuje uredan mali DEV presek, ne kapacitet ili isporuku. [Završni DEV zapis](capacity-final-dev-20261108.json).

## D. TABELA STATUSA

| Oblast | Status | Šta status znači |
| --- | --- | --- |
| Push | DELIMIČNO | Kod, testovi i DEV; telefon i reprezentativan red nedokazani |
| Discovery i mapa | DELIMIČNO | Selektivni upiti ubrzani; production LEGACY i globalni rad ostaju |
| Matching | DELIMIČNO | Izostavljeni kandidat popravljen; dispatch zaključavanja otvorena |
| Dogovori | DELIMIČNO | Novi ekran paginiran; drugi ALL potrošači ostaju |
| Tekstualni čet | DELIMIČNO | Manje čitanja; puna reconnect/telefon potvrda nedostaje |
| Fotografije | DELIMIČNO | Zahtevi, rokovi i cache popravljeni; thumbnail nedostaje |
| Glasovne poruke | DELIMIČNO | Gest snimanja popravljen; rok slanja i provera na telefonu ostaju |
| Realtime | DELIMIČNO | Analiziran postojeći tok; recipient projekcija nije uvedena |
| Gemini AI | BLOKIRANO | Postojeći testni budžet odbija novo odobravanje poziva |
| Baza i RLS | DELIMIČNO | Ciljne izmene proverene; širi R01/R10 prihvat otvoren |
| Opterećenje | DELIMIČNO | Izolovani primeri postoje; veliki paralelni miks nije testiran |
| Android | POTREBNA PROVERA NA TELEFONU | QA58 build i preuzeti APK potvrđeni; fizička provera nedostaje |
| Release | BLOKIRANO | Bezbednosni, retention/export i E2E uslovi nisu zatvoreni |

Statusi se odnose na cele oblasti, zato pojedinačna uspešna popravka nije automatski „REŠENO” za čitavu oblast.

## E. ŠTA JOŠ NIJE REŠENO

**P0 — production Discovery.** Stvarni legacy klijent prihvata 5.000, a odbija 5.001 otvoreni zadatak greškom `OPPORTUNITIES_TOO_MANY_PAGES`. To nije broj registrovanih korisnika. Potreban je kontrolisan P6 paritet sa običnom autentifikacijom i Androidom pre uključivanja. Zatim treba rešiti prostorne predfiltere i ponavljanje globalnih brojanja. [Nezavisni pregled i granični test](independent-capacity-review-20261108.json).

**P0 — distribucija i push pod opterećenjem.** `marketplace_tick` i dalje drži dužu zajedničku transakciju; promena mesta zaključavanja sama ne oslobađa već uzete brave. Potreban je zaseban, dokaziv korak za kraće transakcije. Za push treba izmeriti pražnjenje stvarnog reprezentativnog reda, starost poruka, neuspehe i telefone, pa povećavati kapacitet. Sadašnjih 100 SEND po minutnom ciklusu daje najviše 4,32 miliona za 30 dana samo aritmetički, pre zastoja i drugih ograničenja.

**P0 — R01/R10 i izdanje.** Ostaju provere/opoziv starih pristupnih ključeva i stvarnog krajnjeg pristupa. `retention_ai_source_ready=false`, a export policy binding je prazan. Upozorenja za indekse, funkcije i RLS nisu automatski dokazi napada; nisu nasumično dodavani indeksi niti slabljena prava. [Bezbednosni pregled](security-capacity-review-20261108.json), [DEV gate-ovi](capacity-final-dev-20261108.json).

**P1 — mediji i Realtime.** Potrebni su thumbnail, virtuelizovana lista umesto postojećeg ScrollView-a, stvarno merenje memorije i dva telefona sa sporom/prekinutom mrežom. Glasovni upload i dalje ima otvorenu razliku klijentskih 55 i serverskih 60 sekundi. Inbox nema recipient projekciju; filtriranje samo trenutno učitanih Dogovora moglo bi sakriti validan novi događaj. Zato autorizacija nije oslabljena radi manjeg broja događaja. [Realtime nalaz](../../../scripts/ai-capacity-readonly-20261108.receipt.json).

**P1 — AI.** Potvrđeni zapisi poziva koriste `gemini-3.8-flash`; server tajne nisu čitane. Eksplicitni context cache nije aktivan, a njegova ušteda nije izmerena. Testni plafon je 5 USD, interne rezervacije oko 65,49 USD; to nije račun provajdera. Budžet i allowlist nisu menjani, plaćenih proba nije bilo. Potrebna je kontrolisana komercijalna potrošnja i stvarno merenje celog razgovora. [AI dokaz](../../../scripts/ai-capacity-readonly-20261108.receipt.json).

## F. DA LI SMO BLIŽE 300.000 KORISNIKA?

**Da: uklonjen je deo nepotrebnog rada i dokazana je važna zaštita poslednjeg mesta. Nema dokaza da sistem sada podnosi 300.000 aktivnih korisnika.** Registrovani nalozi, mesečno aktivni korisnici (MAU), dnevno aktivni (DAU) i istovremene veze traže različite resurse.

[Troškovni model](capacity-cost-scenarios-20261108.json) pretpostavlja jedan projekat, 30 dana i budući Pro obračun. Današnji DEV je **Free**; ništa nije kupljeno. Compute veličine su budžetski ulazi, ne potvrđeni izbor servera.

| Scenario | Registrovani / MAU / DAU / istovremeni | Otvoreni zadaci | Compute: RAM / CPU / direktne–pooler veze |
| --- | --- | ---: | --- |
| A, mali početak | 1.000 / 500 / 100 / 30 | 100 | Micro: 1 GB / deljeni / 60–200 |
| B, rast | 50.000 / 20.000 / 3.000 / 500 | 5.000 | Large: 8 GB / 2 / 160–800 |
| C, platforma | 300.000 / 100.000 / 30.000 / 3.000 | 30.000 | 2XL: 32 GB / 8 / 380–1.500 |
| D, udarni termin | 300.000 / 100.000 / 30.000 / 10.000 | 30.000 | 4XL: 64 GB / 16 / 480–3.000 |

To nisu dozvoljene granice aplikacije. Pooler konekcije nisu isto što i korisnici ili paralelni skupi upiti. Ne postoji izmerena bezbedna granica istovremenih stvarnih korisnika. Za svaki scenario tek treba meriti CPU, memoriju, čekanja, zaključavanja, spore upite, Realtime i medijsku propusnost sa odgovarajućim miksom radnji. Trošak pretpostavlja jednu Realtime WebSocket vezu po istovremenom korisniku; više uređaja ili serverske pretplate mogu povećati broj veza. Objavljeni standardni Pro limit je 500, odnosno 10.000 bez spend cap-a: B i D su već na tim granicama bez rezerve. C/D zahtevaju odgovarajuću kvotu i dodatno merenje. Stvarna projektna kvota nije ovde očitana ni menjana. [Zvanične kvote](https://supabase.com/docs/guides/realtime/limits), [obračun vršnih veza](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections).

| Mesečna pretpostavka | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| Baza / Storage / izlazni saobraćaj, GB | 1 / 5 / 10 | 20 / 200 / 750 | 100 / 2.000 / 5.000 | 100 / 2.000 / 5.000 |
| Poruke / push | 30.000 / 20.000 | 1 mil. / 0,8 mil. | 15 mil. / 10 mil. | 15 mil. / 10 mil. |
| Edge / Realtime događaji | 0,1 / 0,2 mil. | 3 / 8 mil. | 20 / 50 mil. | 20 / 50 mil. |
| AI razgovori | 500 | 10.000 | 100.000 | 100.000 |
| Supabase, USD | 25,00 | 183,13 | 1.082,97 | 1.702,97 |
| AI, USD | 25,50 | 510,00 | 5.100,00 | 5.100,00 |
| Modelovani zbir, USD | **50,50** | **693,13** | **6.182,97** | **6.802,97** |

AI račun pretpostavlja **8 poziva po razgovoru, ne izmereni prosek**, sa po 6.000 ulaznih i 500 naplativih izlaznih tokena, uključujući razmišljanje. Koristi evidentirane cenovne pretpostavke 0,75/3,75 USD za milion tokena, bez pretpostavljene cache uštede. Za objavljeni period od januara 2027. model beleži dvostruke token cene. Ako bi svih 300.000 naloga bilo MAU, modelovana dodatna Auth stavka iznosi 650 USD, uz zasebno povećanje stvarne aktivnosti. Svi iznosi su procene pod navedenim uslovima, ne fakture ili ponuda kapaciteta. [Obračun i zvanični izvori](capacity-cost-scenarios-20261108.json).

Odvojeni novi DEV presek našao je 40 evidentiranih AI operacija u 11 završenih razgovora za zadatak: prosek 3,64, p50 3, p95 7, raspon 1–8. Četiri završena razgovora za profil imaju 17 operacija: prosek 4,25, p50 2,5, p95 9,95, raspon 1–11. Samo 221 od 1.227 ukupnih usage zapisa povezuje se sa danas sačuvanim razgovorom; dva istorijska dispatch indikatora nisu saglasna sa usage zapisom. Ovaj mali, nepotpun DEV uzorak nije produkcijski prosek, maksimalan broj poziva niti račun. Pretpostavka od osam poziva zato ostaje scenario, ne izmeren standard. [Agregat i metod](ai-conversation-cost-readonly-20261108.json).

**Scenariji C/D već premašuju sadašnji push plafon:** 10 miliona mesečno ne staje u aritmetičkih 4,32 miliona SEND operacija. Finansijski zbir zato nije potvrda izvodljivosti tih scenarija. Korišćeni Expo cenovnik nema zasebnu naknadu za push servis; naša obrada i infrastruktura i dalje koštaju. Model izostavlja poreze, dodatni DEV compute, SMTP/SMS, PITR, dodatne servise, rad i podršku.

Opciono prepoznavanje govora ima odvojen procenjeni trošak: približno 9 USD za 1.000 minuta ili 900 USD za 100.000 minuta prema navedenim pretpostavkama za `gemini-3.5-transcribe-live`. Nije uključeno u tabelu. Primeri koriste zaokruženu objavljenu procenu 0,009 USD/min; tačne navedene token pretpostavke daju 0,008925 USD/min, odnosno 8,925 i 892,50 USD. Glasovne poruke u Dogovoru nisu automatski transkripcija. Za dokaz kapaciteta slede izolovani testovi rastućeg broja paralelnih korisnika, dugotrajnog rada i udara, uz p50/p95/p99, redove, gubitke, greške i trošak po završenom toku.

## G. OBJASNI MI KAO VLASNIKU, NE KAO PROGRAMERU

**Evo šta smo danas zaista popravili na USKOČI-ju.** Sistem sada može da obradi veću grupu obaveštenja po ciklusu. Kada korisnik suzi zadatke po ceni i načinu rada, baza u izmerenim primerima radi znatno manje. Osoba sa dugom istorijom saradnji dobija prvi potreban deo Dogovora umesto cele istorije. Slanje šest fotografija ima manje pratećih provera, a neuspešan početak glasovnog snimanja više ne treba da zadrži prethodni gest.

Popravili smo i konkretan nepravedan ishod: radnik se više ne odbacuje samo zbog udaljenog pina ako njegovo sačuvano radno područje pokriva zadatak. Stvarnim paralelnim pokušajima potvrdili smo da poslednje mesto ne proizvodi dva nova Dogovora.

Sledeći važan dokaz je iskustvo na telefonima: da obaveštenje stigne, fotografija se otvori, glas se snimi i pusti, a prekid mreže ostavi razumljiv i ispravan ishod. Današnji rezultat je upotrebljiv napredak sa dokazima i sačuvanim izmenama. Odobrenje javnog izdanja i obećanje velikog kapaciteta još nisu zasluženi.
