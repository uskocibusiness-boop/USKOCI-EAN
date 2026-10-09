# USKOČI — nezavisni pre-release / forensic audit

**Presek: 9. oktobar 2026. · izvor `6311804dbac2323069e927f9a8dc49f8f0bb1f14` · verdict: 🟠 NO-GO.**

Ovo je audit postojećeg proizvoda i dokazni prilog jedinom registru `docs/control/redovi.json`, ne novi master plan. Aplikacioni kod, podaci, dozvole, tajne, server programi i potpis nisu menjani. Nije objavljen release niti kreiran novi APK za ovaj audit. Četiri izvršioca obradila su dvadeset stručnih perspektiva; to nisu dvadeset nezavisnih ljudskih sertifikacija. Delegirani pregledi bili su read-only.

## A. Finalni verdict

**USKOČI ima koherentnu, znatno implementiranu osnovu, ali danas nije spreman za javnu V1 niti za obećanje da će sutra pouzdano primiti 10.000 novih ljudi.** Razlog nije potreba za još jednim opštim redizajnom. Nedostaju produkcioni artefakt i okruženje, objavljene pravne/podatkovne politike, kompletan dokaz osnovnog poslovnog kruga, dokaz završene privatnosti/brisanja, pokrivenost obećanih obaveštenja i prihvatljive performanse velikog Discovery skupa.

Nema novog potvrđenog katastrofalnog curenja podataka ili P0 exploita u ovom auditu. To **nije** potvrda bezbednosti: nezavisni dubinski skener nije uspeo da se pokrene. Postoje potvrđeni P1 release blokatori i blokirajući nedostajući dokazi. Njih ne pretvaramo u izmišljene ranjivosti niti ih skrivamo iza proseka.

## B–C. Ocena i procena spremnosti

**Ukupna stručna ocena: 58/100. Planska procena V1 spremnosti: oko 60%.** Obe su procene zrelosti proizvoda i dokaza, ne procenat ispravnih funkcija, izvršenog koda ili preostalih radnih sati. Ne postoji pouzdan imenilac za precizniji procenat. Nijedan prosek ne ukida release blokator. Ocena za bezbednost označava zrelost dostupnih kontrola/dokaza, ne merenu otpornost na napad.

| Oblast | /100 | Osnova / glavno ograničenje |
|---|---:|---|
| Core functionality | 76 | Povezani tokovi i stvarni raniji poslovni dokazi; aktuelni kompletan krug nedokazan |
| UX | 69 | Jasne namere, ali nastavak AI intake i komunikaciona stanja imaju praznine |
| Visual polish | 76 | 20 aktuelnih prikaza pregledano; mapa bez naziva, sve grane nisu pregledane |
| Design consistency | 84 | Stvaran zajednički `sys`, komponente i identitet |
| Information architecture | 73 | Četiri jasna taba; privatni unread i nacrti nisu potpuno rešeni |
| Performance | 40 | Izolovani Discovery timeout-i; stvarni phone TTI/CPU/battery nisu izmereni |
| Stability | 58 | Oporavak i zaštite postoje; nema aktuelnog kompletnog torture/device prolaza |
| Backend correctness | 71 | 237 ledger stavki, vezivanje izvora, integracioni dokazi; ready≠poslovni uspeh |
| Security | 45 | Kontrole i istorijski negativni testovi postoje; nezavisna aktuelna provera blokirana |
| Privacy | 28 | Politike nisu objavljene; export binding null; zatvaranje nije dokazano od početka do kraja |
| Accessibility | 62 | Skaliranje/semantika postoje; TalkBack/fokus/kontrast svih stanja nisu potvrđeni |
| Trust & Safety | 60 | Report/block i privatni support postoje; operativna moderacija/AI prijava otvoreni |
| Test confidence | 60 | Jaki seams/SQL dokazi; testovi nisu dokaz native medija ili fizičkog push-a |
| Code quality | 72 | Koherentne granice i ownership; 16 velikih fajlova, nekoliko read-model praznina |
| Maintainability | 65 | Stvarno zajedništvo sistema; složen registar i slaba produkciona dijagnostika |
| Release engineering | 35 | Dobar preview trag; produkcioni paket i završna regresija/CI nisu zatvoreni |
| Google Play readiness | 25 | Pravni URL-ovi/politike, potpis, AAB, Firebase, 16KB i Console dokazi otvoreni |
| Apple App Store readiness | 10 | Nema bundleID/IPA/APNs/device dokaza; Android APK nije iOS proizvod |
| Overall product coherence | 73 | Jedan proizvod, a ne zbir nezavisnih aplikacija |
| Overall V1 readiness | 58 | NO-GO bez obzira na vizuelni napredak |

## Šta je stvarno obuhvaćeno

Pregledani su inventar svih 704 aplikacionih TS/TSX fajlova, 74 route/layout fajla (21 je razvojna galerija), 28 UI porodica i svih 62 postojećih funkcionalnih redova. To je potpuni **strukturni inventar**, uz ciljano dubinsko čitanje, ne ručno semantičko dokazivanje svakog reda koda. Sveže su pročitani kanonski Git, live Supabase katalog/advisori/readiness, Edge inventar, release konfiguracija, APK manifest/potpis/native biblioteke, CI i javni URL-ovi. Otvoreno i direktno vizuelno pregledano je 20 aktuelnih route prikaza na emulatoru; dodatno Home, povratak iz detalja i tri položaja liste.

**Nije izvršeno:** novi fizički phone prolaz, fresh install/novi login/logout/reset lozinke, pisanje svih poslovnih grana na ovom APK-u, puna moderacija, realna eliminacija disposable Auth+Storage naloga, sve jezičke varijante stvarnog AI provajdera, TalkBack, kompletan offline/HTTP fault matrix, 16KB runtime ili server test 40.000 korisnika. Ovo su vidljive rupe pokrivenosti, ne prećutni PASS. Zahtev za potpunim auditom zato nije isto što i uspešno završena sertifikacija svih traženih testova.

Terminologija: **IMPLEMENTIRANO**=postoji kod; **POVEZANO**=poziv/route/dependency postoji; **TESTIRANO**=konkretan test sa navedenim datumom/verzijom; **EMULATOR**=tačno opisano native stanje; **DOKAZANO NA UREĐAJU**=fizički uređaj i tačan artefakt; **PRODUKCIJSKI SPREMNO**=svi obavezni release kriterijumi za isti kandidat. Nijedna od prvih pet oznaka sama ne daje šestu.

## D. Deset najvažnijih release blokatora / nezatvorenih kriterijuma

Svi su **P1 MUST FIX / PROVE BEFORE RELEASE**: problem se otklanja, a nedostajući dokaz se pribavlja. P0 je rezervisan za potvrđen katastrofalan problem; broj deset nije deset potvrđenih bezbednosnih ranjivosti.

| ID | Problem i rizik | Dokaz | Najmanji izlazni kriterijum |
|---|---|---|---|
| R01 | Pravni/podatkovni paket nije objavljen — STORE REJECTION, PRIVACY | Live 0 aktivnih dokumenata, 0 objavljenih processor mapa, export binding null; `/privacy`, `/terms`, `/support`, `/delete-account`, `/privacy-choices`, `/safety` svi 404; native Pravna isto potvrđuje | Stvarni odobreni operator/politike/periodi/provajderi; objavljeni URL-ovi i tačan app/Console acceptance binding |
| R02 | Nema prihvaćenog produkcionog release artefakta/okruženja — REGRESSION, STORE | Production=`rs.uskoci` ali DEV backend, nema Firebase client; pronađeni ce23 je preview/debug-key, ne AAB | Jedan tačan production AAB, prava upload/Play signatura, produkcioni projekat i tajne/OTA; manifest i hash verifikovani |
| R03 | Brisanje naloga i izvoz nisu dokazani kroz celu izvršnu putanju — PRIVACY, DATA LOSS RISK pri lošoj popravci | Adapter binding postoji, legalPolicyAttested=false, executions={}, export policy null; raniji zahtev na emulatoru je REQUESTED, uz „Pripremi kopiju“; priprema još nije pokrenuta | Disposable nalog: stvarno Storage/relational/Auth brisanje, stale-session zabrana, korisnički status i uski retention izuzetak; stvarna isporuka izvoza/istek |
| R04 | Native 16KB kompatibilnost nije završena — STORE, CRASH RISK | 28/28 LOAD+ZIP PASS, ali 24 GNU_RELRO kraja ne prolaze dodatnu formulu aktuelne Android dokumentacije; MapLibre nezavisno potvrđen | Rebuild kompatibilnih native zavisnosti i test finalnog AAB-a na 16KB sistemu; ne tvrditi da je pad već reprodukovan |
| R05 | Aktuelni integrisani poslovni krug nema završni dokaz — REGRESSION, DATA LOSS/UX RISK | Matrica 62 reda: raniji source/SQL/phone dokazi različitih verzija; ce23 headcount fixture nije stvarna prijava | Dva naloga na istom kandidatu: AI profil → AI zadatak → pin/foto → prijava → izbor → privatni/grupni chat → izmena/otkaz/zamena → završetak/ocena, readback i restart |
| R06 | Push za ključne događaje nije kompletno isporučen — UX ABANDONMENT | Jedan privatni MESSAGE dokaz postoji; OPPORTUNITY kandidat lokalno, grupni emitter nije zatvoren; production Firebase odsutan | Novi odgovarajući zadatak i obećani grupni/privatni događaji: event→target→provider→aktuelni uređaj→tačan deep link; bez globalnog pražnjenja reda |
| R07 | Discovery nije prihvatljiv za veliki skup/konkurentnost — PERFORMANCE | Istorijski C4 p95 6,707s; C16 warmup timeout-i; sveža izolovana 40k provera 3/4 timeout uz 8s limit | Ispravka sa jednakim rezultatima/privatnošću, realan izolovani workload, definisan SLO, CPU/IO/generator granice, stabilan P95 |
| R08 | Aktuelna nezavisna bezbednosna potvrda/dependency trijaža nedostaje — SECURITY | Deep Scan nije startovao zbog managed filesystem profila; npm 63 affected-package zapisa (1critical), advisori zahtevaju razvrstavanje | Osposobljen nezavisni scan + autentifikovani negativni RPC/RLS/storage/deeplink testovi; sve HIGH/CRITICAL zatvorene ili dokazano neprimenljive |
| R09 | Kontinuitet AI i lokacija/mape nisu prihvaćeni — UX ABANDONMENT | Unbound intake nema jasan resume posle uspešnog turna/restarta; ce23 native viewport i posle učitavanja bez naziva; multi-stop/ručni pin end-to-end otvoreni | Vidljiv account-scoped resume; poznati nazivi/pinovi/klasteri; lat/cyr, correction, ručno pomeren pin, čuvanje/reopen i javno/privatno razdvajanje |
| R10 | AI/UGC disclosure i operativni release gate nisu završeni — PRIVACY, STORE | AI dobija istoriju/adresu/access notes; nema tekstualnog consent/report toka u pregledanom ulazu; zastarela govorna notice; CI 0 koraka/billing; aktuelna lokalna regresija beleži FAIL G04-5 u p5-matching-field-contract.test.ts zbog nedostajućeg source markera (zastareo tekstualni marker; nije utvrđena ponašajna regresija); operativna moderacija/crash signal nisu dokazani | Usklađene dozvole/obaveštenja/AI prijava, stvarni support/moderation postupak, razjašnjen regresioni FAIL i aktuelna CI, finalne store deklaracije; staging rollout/rollback dokaz |

Evidencija R01–R04/R10: [release pregled](evidence/forensic-20261009/release/RELEASE_FORENSIC_REPORT.md) i njegove primarne policy veze. R05/R06: [62 reda](evidence/forensic-20261009/source/backend-capabilities.md). R07: [novo merenje](evidence/forensic-20261009/backend/isolated-read-probe.json). R08: [source pregled](evidence/forensic-20261009/source/REPORT.md). R09: [UX pregled](evidence/forensic-20261009/design/DESIGN_UX_FORENSIC_6311804d.md) i native receipt.

## E. Deset stvari koje najviše kvare utisak korisniku

| # | Problem → korisnik misli / očekuje → najmanja dorada |
|---|---|
|1|AI razgovor nije lako nastaviti posle restarta → „moraću sve ponovo“ / očekuje prethodni razgovor → explicit resume samo svog aktivnog intake-a; nije potvrđen gubitak server podataka |
|2|Mapa bez vidljivih naziva → „gde sam i da li je pin tačan?“ / očekuje ulice i naselja → prvo izolovati renderer/glyph/style i popraviti konkretan uzrok |
|3|Novi filteri uz stare rezultate dok RPC traje → „ovo ne filtrira“ / očekuje primenjene rezultate → zadržati sadržaj, ali označiti osvežavanje i primenjene kriterijume |
|4|Kasna pretraga ili timeout uklanja sadržaj → „aplikacija se pokvarila“ / očekuje brz rezultat i oporavak → backend perf + jasan retry bez lažne svežine |
|5|Važno obaveštenje za novi zadatak/grupu nije dokazano → „niko mi se ne javlja“ / očekuje pouzdanu novu priliku → završiti ciljanu isporuku |
|6|Privatni unread je unknown → korisnik teško uočava nov odgovor / očekuje tačan signal → pravi privatni read-model, ne izmišljeni broj |
|7|„Čim nastane Dogovor, ovde je razgovor“ i prazan inbox → „gde je Dogovor?“ / SQL traži prvu poruku → tačan tekst uz postojeći ulaz u Dogovore |
|8|Neobjavljena pravila i nedokazan završni tok izvoza → „kome da verujem?“ / očekuje stvarne uslove i realizovan zahtev → zatvoriti R01/R03, ne samo sakriti poruku |
|9|Profil kaže „Nova ocena“ i „još nema ocena“ → očekuje novu primljenu ocenu → neutralno „Bez ocena“; `ProfileFigures.tsx:47` |
|10|Govorna privatnost opisuje stari režim; Alat izgleda kao obavezan AI korak → očekuje dosledan jedan mikrofon i jasnu opcionalnost → uskladiti notice i oznaku; bez novog glasovnog režima |

P1 su 1/2/5/8 uz povezane gate-ove; 3/4/6/7/9 su P2, opcionalni progress alat P3. Native list cycle je pokazao i „Mapa“ dugme nad već spuštenom listom; to je P2 reprodukcioni kandidat za dodatni settled check, ne potvrđen trajni kvar celog sheet podsistema.

## F. Deset tehničkih rizika

1. Mešanje DEV/preview/production identiteta, Firebase/OTA/potpisa i dokaza različitih buildova.
2. Spor Discovery i nestabilan plan nad velikim skupom; apsolutni brojevi sintetičkih redova nisu kapacitet korisnika.
3. Dependency advisori nisu razvrstani prema runtime/build putanji; automatski `audit fix --force` predlog čak uključuje neprimeren Expo downgrade.
4. 16KB prebuilt native biblioteke nisu potpuno dokazane; LOAD+ZIP provera sama nije dovoljna.
5. Nepotpuni privatni unread, group emitter i opportunity delivery stvaraju razliku između poslovnog stanja i pažnje korisnika.
6. Source digest/cron success mogu izgledati zeleno dok legal/export/deletion outcome nisu spremni.
7. Gubitak ulaza u sačuvan unbound AI razgovor; state journal nije isto što i vidljiva lista prethodnih razgovora.
8. Produkcioni `AppErrorBoundary` nema pronađen trajan crash-report tok; PushRuntime neke izuzetke namerno guta bez bezbednog operativnog razloga.
9. Mockovani native/list/audio testovi mogu proći dok stvarni IME/gesture/codec/upload/playback ne rade.
10. 16 velikih fajlova i istorijski paralelni checkout-i povećavaju cenu sigurnog menjanja; rešenje nije masovno brisanje pred release.

## G. FREEZE — ne dirati pre release-a

- Četiri postojeća taba, dve namere istog naloga, osnovni raspored početne i kratki uvodni tekst. Ne vraćati istorijski nacrt sa tri taba.
- Premium white, duboka zelena/kontrolisana narandžasta, postojeće `sys` vrednosti, originalni artwork, zajednički Press/ListRow/Sheet/CTA obrasci. Ne uvoditi drugi UI kit.
- Već čitljiv pregled prijave, jasno razdvojeni broj ljudi/cena i vlasnikovo srazmerno zaokruživanje na ceo dinar. Ne menjati postojeće ugovorene cene.
- Jedan mikrofon za AI unos; fotografije zadatka bez fotografija u AI radnom profilu. Ne vraćati odbačeni glasovni razgovor.
- Privatni lokacijski grant, javna približna lokacija, participant-scoped komunikacija, granice otkazanog učesnika, authoritative readback i idempotentne komande.
- Razdvojiti „primljeno“, „obrađeno“, „izvršeno“, „dostavljeno“. Sačuvati korektne fail-closed poruke umesto izmišljanja uspeha.
- Kalendar, availability, profilne sekcije i mirni prazni prikazi u pregledanim stanjima: bez opšteg redizajna; dozvoljene samo konkretne korekcije nalaza.

FREEZE znači sačuvati dobro rešenje, ne preskočiti test zavisnosti na finalnom kandidatu.

## H–I. Funkcionalno, ali nedovoljno dokazano / može posle V1

AI objava i radni profil imaju stvarne ranije uspehe, ali izmene, prekidi, kraj razgovora, srpska pisma, glas i više lokacija nisu kompletno prihvaćeni na jednom sadašnjem kandidatu. Prijave/Dogovori imaju realne SQL zaštite; inertni pregled ne dokazuje live izbor, zamenu i otkaz. Chat tekst ima raniji stvarni delivery; glas/fotografije/grupa nemaju ceo aktuelni native krug. Push nije jedan prekidač: proven MESSAGE nije dokaz OPPORTUNITY ili svakog od 19 emitovanih tipova. Export/closure imaju ozbiljan izvršni kod, ali nema aktuelnog završenog korisničkog ishoda.

Posle V1 mogu: kozmetičke razlike bez uticaja na čitljivost, nove animacije/ilustracije, šira personalizacija, proširene preference, road-route geometrija ako se V1 jasno ograniči na potvrđene stanice i spoljašnju navigaciju, refaktor velikih stabilnih komponenti, provereno uklanjanje neupotrebljenih artwork-a, iOS kao zaseban release. Privatni unread može se fazirati samo uz jasno prihvaćen pouzdan alternativni signal; ne nazivati komunikaciju završenom dok korisnik propušta bitan odgovor.

## J. Konačan redosled rada — rizik × uticaj × verovatnoća × cena

| Paket | Konkretno uraditi | Dokaz završetka / STOP uslov |
|---|---|---|
|1. Release istina i privatnost|Stvarni operator, odobrene politike/provajderi/periodi, javni legal/support/delete URL-ovi, AI notice/consent/report, izvoz i zatvaranje|Anonimni URL 200 + identične verzije u aplikaciji/Console; disposable closure/export dokaz; ako politika/ovlašćenje nedostaje, ostaje javno označen blocker |
|2. Osnovni tok i pažnja|AI resume, task/profile edits, lokacija/pin/ruta, opportunity/group push; samo konkretne UX korekcije ovog izveštaja|Jedan kontinuiran dvo-naložni scenario sa save/readback/restart/cancel/replacement; sve obećane poruke stignu pravom primaocu i otvore pravi sadržaj |
|3. Performanse i bezbednost|Discovery plan/queries, pending signal, dokaz istih rezultata i dozvola; nezavisni security scan/dependency triage|Izolovan workload sa 40.000 korisnika u populaciji jasno različit od aktivne konkurentnosti; throughput/p50/p95/greške/generator/CPU/IO; nema otvorenih primenljivih HIGH/CRITICAL nalaza |
|4. Jedan production kandidat|Pravi backend/identity/Firebase/potpis/AAB, ispravljeni native 16KB artefakti, minimalna bezbedna dijagnostika|Tačan source/binary/config/certificate; 16KB runtime, permissions, fresh install+upgrade, deep link, offline/retry, TalkBack/large fonts i real-device osnovni krug |
|5. Review paket|Aktuelna CI, Data Safety/privacy/uslovi, screenshotovi, content rating, review access, monitoring/staged rollout/rollback|Svi obavezni gate-ovi PASS za isti kandidat; explicit odobrenje konkretnog release paketa pre objave |

Predlog operativnog prihvatanja performansi, **još nije dokaz niti obećanje**: prvo reprezentativni C1/C4/C16/C32, ukupna populacija 40.000, mešavina browse/chat/application/cancel/edit, najmanje 15 min stabilnog dela posle warmup-a; nijedan generator-propušten start sakriven, error budget i P95 unapred zapisani. Razumna početna meta Discovery HTTP P95 ≤ 1,5 s na dogovorenom opterećenju, bez timeout-a i sa očuvanom autorizacijom. Ako postojeći plan to ne može, prvo popravka, ne podizanje SLO da test bude zelen. 10.000 preuzimanja nije 10.000 istovremenih zahteva. Raspored po danima sada nije pouzdan jer signing/politike/CI imaju spoljne zavisnosti; završetak je konačan skup navedenih gate-ova, ne beskonačan redizajn.

## Dvadeset stručnih perspektiva

| Uloga | Procena | Zašto |
|---|---|---|
|A Principal Mobile Engineer|Koherentna osnova; uslovno prihvatljivo posle zatvaranja tokova|Ownership/fencing/idempotency postoje; nema razloga za arhitektonsko prepisivanje |
|B Android Release Engineer|NO-GO|Preview/debug potpis ≠ production AAB; Firebase/16KB/runtime dokaz otvoreni |
|C iOS Release Engineer|NO-GO / zaseban opseg|Nema bundleID, IPA/signing/APNs niti real-device testa |
|D Backend/Supabase Architect|Delimično potvrđeno|Live katalog/Edge/cron/source binding pročitani, ali važni capability outcomes otvoreni |
|E PostgreSQL/RLS Engineer|Autorizacija nije sertifikovana|Advisori razvrstani kao signali, ne automatski exploit; aktuelni adversarial/plan acceptance otvoreni |
|F Application Security Engineer|NOT VERIFIED|Managed Deep Scan pre-start failure; nema novog nezavisnog security verdict-a |
|G Privacy reviewer|NO-GO|Politike/processor map/export i krajnje brisanje nedokazani |
|H QA lead|Jaki uski dokazi, nedostaje finalni povezani prolaz|Posebno mocks/native/provider/physical granice |
|I Performance/Reliability|NO-GO za veliki rast|Merljivi Discovery timeout-i; nema workload-a sa 40.000 korisnika |
|J Product Designer|FREEZE osnovu|Čitljivi pregledani ekrani; mapa i konkretne kontradikcije imaju prednost nad novim artwork-om |
|K UX Researcher|Potreban continuity/attention završetak|Nema prave studije na novim ljudima; AI resume/private unread su konkretne prepreke |
|L Design System Specialist|Stvaran design system|Tokeni/komponente su prisutni i korišćeni; gallery-only nije dokaz rollout-a |
|M Accessibility|NOT VERIFIED kompletno|Veliki tekst/semantika delimično; nema TalkBack/focus audit-a svih grana |
|N Product Manager|NO-GO; konačnih 5 paketa|Release kvalitativno odvojen od „može da se koristi“ |
|O Activation specialist|Dobre dve namere, slab prekinuti intake|Jasan početak; korisnik mora naći nedovršeno |
|P Trust & Safety|Delimično|Report/block postoje; pravila, AI prijava i operativna reakcija nisu zatvoreni |
|Q Store compliance|NO-GO|Dokazani pravni/deletion/config propusti i nepripremljen review paket |
|R DevOps/CI/CD|NO-GO|Tačan release chain nema PASS; poslednja CI billing blokada nije test-pass |
|S Observability reviewer|Nedovoljno|Nema pronađenog produkcionog crash-report puta; javni release zahteva dijagnostiku bez sadržaja/PII |
|T Novi obični korisnik (simulirana perspektiva)|Osnovne namere su vidljive; pouzdanost celog toka nije potvrđena|Ekrani objašnjavaju objavi/uskoči; korisnik može se izgubiti posle restart-a ili propustiti privatni odgovor |

## Repository i source forenzika

Kanonski checkout je `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006`, branch `integration/spoj-20261006`. Pre audita čist. Sveži fetch: oba kanonska remote ref-a `novi/integration/spoj-20261006` i `novi/work/uskoci-ui-unification-20260924` na 6311804d, 0/0. Aplikacioni sadržaj jednak ce23; doc delta ne daje nov runtime dokaz. GitHub default/`origin/clean-alpha-backend` je istorijski, nije release branch.

Pronađeno 35 checkout-a i 363 ref-a. Osam checkout-a ima tracked izmene; to nije dokaz osam aktivnih pisaca. Stari UI branch ima 5 topološki jedinstvenih commit-a: `git cherry` nalazi 4 patch-ekvivalentna već u kanonskom izvoru i 1 doc/evidence-only (`636d1d40`). Nije pronađena time izgubljena nova app implementacija. Untracked fajlovi svih tuđih checkout-a nisu potpuno inventarisani; ništa nije obrisano/merge-ovano. [Inventar](evidence/forensic-20261009/source/repository-inventory.json).

**Odgovor „nov UI preko starog sistema?“:** zajednički sistem je stvaran, sa jednim produkcionim ulazom, service granicama i zaštitama. Istovremeno postoje istorijske verzije RPC ulaza, galerije/test seams i veliki moduli. To nije dokaz potpuno očišćenog sistema, ali nije ni nalaz druge paralelne aktivne aplikacije. Nazivi v1/v2/v5 sami nisu legacy dokaz.

- 685/704 = 97,30% statički dostupno iz svih route/build korena; 653/704 = 92,76% bez gallery korena. **Nije procenat stvarno izvršenog sistema.**
- 15 fajlova test-only; 4 bez pronađenog statičkog poziva (WorkProfileArt, CalendarArt, PeopleArt, ToolArt). **Nula fajlova je ovim auditom dokazana kao bezbedna za trenutno brisanje.**
- 0 bajt-po-bajt identičnih celih TS/TSX duplikata, 0 TODO/FIXME/HACK i 0 ts-ignore; ne znači 0 tehničkog duga. Semantičko copy/paste poklapanje i cirkularnosti nisu iscrpno dokazani.
- 16 fajlova > 500 linija čini 12,69% sirovih aplikacionih linija. To je proxy koncentracije održavanja. **Procenat tehničkog duga i legacy koda nije pouzdano izmeren** i ne izmišljamo ga.
- 41 runtime + 6 dev direktnih dependency-ja; 37 ima noviju verziju. 0 importa nije dovoljan razlog za brisanje native/config/peer dependency-ja. Package audit je 63 affected zapisa, ne 63 nezavisne exploitable greške.

Ne dirati pre release-a: fake adapter koji je eksplicitno gated za test (build odbija fake composition), gallery fixtures potrebne za QA, sertifikovane SQL granice, stari ugovoreni iznosi, istorijski dokazi, Auth/session ownership i rollback trag. Čistiti tek imenovane proverene mrtve artefakte uz bundle/test diff, bez masovnog refaktora.

## Backend, capability i security granice

Sveže live: PostgreSQL 17.6, 237 ledger stavki, 260 public RPC, 125 public/private tabela, 91 app/storage policy; 11 Edge funkcija ACTIVE. Dva cron-a, 2.874 run-a u 24 h, 0 failed u viđenom pregledu. Source/certified digest oba 0201a7cc…a4acb, retention source ready=true. Ovo dokazuje katalog/identitet i cron status, ne dozvole običnog korisnika, poslovne ishode ili brzinu.

**APP OČEKUJE, SERVER NE GARANTUJE:** sastavljanje celog izvoz/brisanje/push/prod lanca i relevantne politike, performanse query-ja i signal pročitano/dostavljeno. Snapshot nema statički pozvan RPC koji potpuno nedostaje, ali postojanje endpoint-a nije odgovor na tih sedam problema. **SERVER UME, APP NE KORISTI:** svih 13 stavki razvrstano je kao stariji/alternativni wrapper, Edge poziv ili interni guard, bez automatske liste 13 nedostajućih dugmadi. [Pojedinačne lokacije i zamene](evidence/forensic-20261009/design/RPC13_DISCOVERY_SUPPLEMENT_6311804d.md).

Fresh security advisori: 88 RLS-enabled-no-policy INFO, 1 extension-in-public WARN, 2 anon-definer-executable WARN, 184 authenticated-definer-executable WARN, 1 leaked-password-protection WARN. Performance: 91 unindexed-FK INFO, 18 auth-RLS-initplan WARN, 15 unused-index INFO, 5 multiple-permissive-policy WARN. RPC-only private tabele bez javnih politika mogu biti namerne. Ne uklanjati RLS ili masovno dodavati indekse na osnovu broja upozorenja.

Dubinski security tool nije startovao: **`Deep Scan cannot safely start a read-only worker: the parent must provide a managed filesystem permission profile.`** Tačan [SKILL.md](C:/Users/user/.codex/plugins/cache/openai-curated-remote/codex-security/0.1.32/skills/deep-security-scan/SKILL.md) kaže: “An invocation failure before a scan starts is still a blocker; do not create a replacement scan or infer results.” Nije otvoren zamenski scan niti izmišljeni security nalazi. Security token usage/coverage nisu dostupni; ne predstavljamo ih kao nulu. Daybreak pristup takođe nije odobren, pa zaštićeni rezultati možda nisu dostupni.

| Traženi praktični napad | Aktuelni status |
|---|---|
|Čitanje tuđeg profila/privatne lokacije/chat-a|NOT VERIFIED u novom nezavisnom adversarial prolazu; istorijski guard/SQL dokazi nisu novi penetration test |
|Izmena tuđeg zadatka/manipulisan ID|NOT VERIFIED za aktuelni public deployment; source/authenticated chain istorija u matrici 62 reda |
|Nedozvoljen Agreement/state bypass/replay|Postoje stvarni izolovani negative/race dokazi; kompletna sadašnja matrica nije ponovljena |
|Storage/public URL/upload injection|Sanitizer/owned binary paths postoje; novi direktni napadi nisu izvršeni |
|Deep-link injection/session/account switching|Source fencing i ciljane testove razlikovati od real-device maliciozne ulazne matrice |
|HIGH/CRITICAL nalaz|Nema novog validiranog app exploita za rangiranje; critical npm advisory je dependency triage, ne potvrđena mobilna ranjivost |

## Functional, map i torture pokrivenost

[62-row feature matrica](evidence/forensic-20261009/source/backend-capabilities.md) sadrži IMPLEMENTED/CONNECTED/TEST/CURRENT NATIVE/PHONE/PRODUCTION i putanje/hash/RPC dokaze po redu. [74-route inventar](evidence/forensic-20261009/design/DESIGN_UX_FORENSIC_6311804d.json) i [20 native prikaza](evidence/forensic-20261009/native/route-receipt.json) se dopunjuju; inventar ne glumi potpuni klik svakog dugmeta.

Aktuelni native: Home nakon 5 cold + 5 warm vraćanja uspešan, sesija očuvana; zadaci/lista, task detail/Back, profil/AI ulazi, moje prijave, moji zadaci, kalendar/dostupnost, privatnost/izvoz/pravna, notification settings/block/ratings/safety/support/about otvoreni. Tri count-button ciklusa pomeraju listu i povratak iz detalja zadržava isti task/list state. To nije dokaz kvalitetne drag fizike pod hiljadama pinova. Oznaka izvora mape (©) ostaje vezana za mapu i može biti prekriven listom, po vlasnikovom zahtevu.

Mapa na ce23 prikazuje geometriju, ali u pregledanom viewport-u i posle uklanjanja loading teksta nema vidljivih naziva. Postojeća preferenca srpske latinice u mapStyle ne dokazuje da native glyph sloj radi. Uzrok nije izolovan; ne pripisivati automatski MapLibre verziji ili geocoder-u. Pravi geocoder, ručni final coordinate, privacy projections i ordered-stop preview postoje u source/istorijskim testovima; GPS-denied/off, pogrešan rezultat, actual drag→save→reopen, više stanica, full lat/cyr real-provider test ostaju obavezni.

Torture: prvobitni 30 cold / 30 warm ActivityManager harness završio timeout-om na warm komandi 120 s, pre finalnog upisa uzoraka. Nema lažnih percentila iz izgubljenih podataka. Zaseban 5 + 5 launch proverava vidljiv Home i oporavak; u zadržanom exit-info nema novog crash/ANR dokaza, samo namerni FORCE STOP. Nema tvrdnje da su svi brzi double tap/back-in-flight/401/403/404/409/429/500/malformed/offline/date/Unicode scenariji sada prođeni na native. Za njih unit/seam test nije zamena za završni uređajski scenario.

## Performanse — merene vrednosti i korisnički efekat

| Eksperiment | Populacija / konkurentnost | Rezultat | Šta sme da se zaključi |
|---|---|---|---|
| Istorijski izolovani HTTP Discovery, C1 | 40.000 sintetičkih zadataka; 2 Auth naloga, 1 viewer; 1 istovremeni reader | 77 uspešnih, 0 grešaka; 1,28 zahteva/s; P50 567 ms, P95 2.055 ms | Spor rep odgovora već pri C1; ovo nije 40.000 korisnika |
| Isti HTTP eksperiment, C4 | 4 istovremena reader-a; 15 s warmup + 60 s merenja | 86 uspešnih, 0 grešaka; 1,43 zahteva/s; P50 1.995 ms, P95 6.707 ms | Višesekundno čekanje; u aplikaciji sadržaj tokom čekanja zavisi od ulazne radnje, opisane ispod |
| Isti HTTP eksperiment, C16 | 16 aktivnih reader-a tokom warmup-a | 27 započetih, 22 uspešna, 5 HTTP 500 / SQLSTATE 57014; stabilni deo merenja nije počeo; C32 nije izvršen | Kapacitet nije prihvaćen; nema validnog C16 P95 |
| Sveži read-only SQL, 09.10. | 40.000 novih + 49 zadržanih zadataka; 5 korisnika, 1 reader, bez HTTP-a; PostgreSQL 17.11, isti RPC MD5 kao na DEV-u 17.6 | Automatski plan: timeout posle 8,307 s; uspeh za 7,760 s, count 40.007, odgovor 5.592 B; timeout posle 8,267 s. Forsirani generički plan: timeout posle 8,424 s. Limit upita: 8 s. | Reprodukovana slaba margina na izolovanom deljenom hostu; 3 od 4 timeout-a nisu stopa greške produkcije |
| ce23 cold/reopen, 5 + 5 | x86 Android 16 emulator; isti nalog, font 1,15 | Home vidljiv u 10/10 pokretanja. Cold gornja granica 7,30–10,89 s; warm 5,75–6,75 s. | UIAutomator čekanje ulazi u broj; **NIJE korisnički TTI**. Sam posmatrač traje 2,38–3,48 s; nema korektnog startup P95 |
| Memorijski snimak na Home ekranu | ce23 DEV x86, jedan trenutak | PSS 265.662 KB; RSS 424.688 KB | Nije trend curenja memorije niti potrošnja telefona; CPU, baterija i frejmovi nisu mereni |

Istorijski izvor: `evidence/discovery-concurrency-37868724376/load-report.json`, `load-summary.md`, `source-binding.txt`, `teardown.txt`; 2 CPU / shared CI i ograničenja generatora ostaju uz rezultate. Novo: `evidence/forensic-20261009/backend/isolated-read-probe.json`; program/count unchanged. Nema hiljada testnih naloga na stvarnom DEV-u.

Korisnički efekat je konkretan: cold-open/explicit refresh brišu staru mapu/listu i prikazuju skeleton; promena filtera zadržava stari snapshot i odmah menja kapsule bez jasnog pending signala; timeout nakon 15 s prikazuje error/retry umesto liste. Paging čuva redove, ali loadingMore nema neposredni state commit. [Tačne code lokacije](evidence/forensic-20261009/design/RPC13_DISCOVERY_SUPPLEMENT_6311804d.md). Optimizacija servera i mali feedback fix imaju veći značaj od nove animacije.

## Dizajn, jezik, IA i pristupačnost

Stvarni sistem: beli neutralni background, tamni ink, zelena/narandžasta boja brenda, semantic state palette, zajednička type/weight/space/radius/shadow skala, Press/CTA/ListRow/input/sheet/avatars/badges. [Izdvojeni konkretni tokeni i izuzeci](evidence/forensic-20261009/design/DESIGN_UX_FORENSIC_6311804d.md). Ne uvoditi drugi framework da bi se rešila dva teksta.

U pregledanih 20 stanja nema očigledno odsečenih ključnih tekstova ili CTA kontrola. To nije sertifikat svih screen-width/font/keyboard varijanti. Raniji ce23 review layout na fontu 1,0/1,30 je stvarno pregledan. Nije izvršen sveobuhvatan kontrastni proračun niti TalkBack/focus/reduced-motion test; store/accessibility status ostaje NOT VERIFIED. Sve srpske kopije nisu semantički pregledane reč-po-reč; konkretni nalazi su inbox, „Nova ocena“, „Nema veze“ offline i zastarelo obaveštenje o privatnosti govornog unosa.

Procena na osnovu pregledanih ekrana, bez studije sa novim korisnicima: osnovna poruka proizvoda je objavim šta mi treba ili ponudim pomoć istim nalogom; Zadaci su traženje, Dogovori obaveze, Poruke komunikacija. Ne treba vraćati stari MENI TREBA / JA MOGU kao odvojene naloge. Zbunjujući trenutak je nastavak nezavršenog intake-a, prazna komunikacija bez prve poruke i nevidljiv privatni unread. To su konkretni tokovi za korekciju, ne nova informacijska arhitektura.

## Privatnost, trust i account deletion

[Mapa 13 putanja](evidence/forensic-20261009/release/privacy-data-map.json) i čitljiva [tabela u release dodatku](evidence/forensic-20261009/release/RELEASE_FORENSIC_REPORT.md) navode poreklo→provider→storage→visibility→retention/deletion→code za email/ime/avatar/GPS/adrese/javnu oblast/poruke/foto/AI/glas/ocene/safety/push/export. Numerički periodi i provider-side retention ne izvode se iz toga što SQL kolona postoji. Precizna adresa/access notes mogu do Gemini-ja; task photo evaluator šalje odabrane fotografije; LocationIQ/OpenFreeMap/spoljašnje mape su dodatni tokovi.

AI transkripcija i Agreement audio imaju različit životni vek. Privatne glasovne poruke se čuvaju; tvrdnja „ne čuvamo audio“ mora ostati izričito samo za AI transkripciju, uz proverene provider uslove. Potrebne su stvarne usklađene store deklaracije, ne prekopirani stari draft.

Zatvaranje postoji: prepare/review/start/read, stabilna komanda, Storage delete + readback, relational erasure, Auth soft-delete, final guard. Pseudonimni subject i uski dokazni izuzeci su svesno različiti od običnih ličnih podataka. Source binding ready sa legalPolicyAttested=false i executions={} **nije** uspešno izvršeno brisanje. Nismo obrisali nijedan postojeći nalog da bismo glumili test. Ranije odobreno čišćenje pet testnih naloga je sačuvalo Auth/push i nije account deletion test.

Trust postoji u report/block/grant/reputation strukturi, ali novi korisnik još nema kompletan dokaz javnih pravila, operativne moderacije i pouzdane pažnje. Ne dodavati lažne verified badges ili administrativne tvrdnje. UGC/AI report/SLA/appeal i kontakt treba da budu stvarne operativne mogućnosti.

## Test suite i release dokaz

729 tracked JS/TS test fajlova; 604 ulazi u default Jest obrazac; 422 deklarira mock-ove, 113 fake timers, 2 conditional skip mesta. To nisu procenat pokrivenosti ili flaky rate. Korisni ownership/race testovi nisu isto što i realni native codec/gesture/IME. Izvorni string assertion može otkriti uklonjen marker i ipak propustiti pogrešno ponašanje. [Primeri i linije](evidence/forensic-20261009/source/REPORT.md).

**Aktuelna sveža regresija:** TypeScript `tsc --noEmit` exit 0. Aktuelni puni Jest: 603/604 suite-ova PASS, 1 FAIL; 13476 testova PASS, 1 FAIL, 9 pending. Ovo je lokalna regresija tačnog izvora; SQL/provider/device runner-i nisu njome automatski pokrenuti. [Receipt i sažetak](evidence/forensic-20261009/source/full-regression-summary.json).

Dodatno je izvršen stvarni transpajlirani AI Edge handler u izolovanom VM-u: **94/94 PASS**, bez pravog provider/network poziva. Jedini puni Jest FAIL je zastareli G04-5 marker i istorijska tvrdnja o iskustvu; MATCH-V1 više ne primenjuje taj uslov. Ne vraćati aktuelnu proveru potpunosti AI pregleda na staru logiku. [Trijaža i minimalna popravka testa](evidence/forensic-20261009/source/FAILED_TEST_TRIAGE.md).


CI 37956120590 / job 113906951450 ima 0 pokrenutih koraka zbog billing/spending limita. To nije greška app assertion-a niti CI PASS. Lokalni test ne postaje remote CI zelen. Prethodni full 603/13.391 na a481 je istorija. Produkcijski OTA/runtime, signatura i store permissions moraju biti dokazani na finalnom artefaktu.

Primarni release izvori provereni 09.10: [Google User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [Android 16KB](https://developer.android.com/guide/practices/page-sizes), [UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), [AI policy](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en), [Apple Review](https://developer.apple.com/app-store/review/guidelines/). Detaljnih 20 PASS/FAIL/NOT VERIFIED/NA store stavki je u [store-matrix](evidence/forensic-20261009/release/store-matrix.json). API 36 PASS odnosi se na ce23 APK, ne nepostojeći pregledani production AAB. iOS je NOT READY, ne Android PASS.

## Završni release gate

| GATE | STATUS | DOKAZ | BLOKIRA RELEASE? |
|---|---|---|---|
| Core flows | NOT VERIFIED ceo aktuelni krug | 62-row matrica; 20 read-only native prikaza | DA |
| Authentication | PARTIAL | Sesija očuvana u 10/10 pokretanja; fresh login/logout/recovery nisu ponovljeni | DA |
| Task creation | PARTIAL | Raniji stvarni publish; aktuelni welcome; resume/edit/finish-only otvoreni | DA |
| Applications | PARTIAL | Ledger 237, rounding SQL proof, ce23 inertni broj ljudi i pregled | DA |
| Agreements | PARTIAL | Connected SQL; aktuelni cancel/replacement/completion krug otvoren | DA |
| Chat | PARTIAL | Raniji privatni tekst; kompletan grupni/audio/photo native tok nije dokazan | DA |
| Location | PARTIAL | Source/geocoder dokazi; current drag/reopen/private/multi-stop otvoreni | DA |
| Map | FAIL prihvatnog pregleda | ce23 geometrija bez vidljivih naziva; list/detail/Back delimično PASS | DA |
| Notifications | PARTIAL / FAIL pokrivenosti | Jedan owner-confirmed MESSAGE; opportunity/group/production otvoreni | DA |
| Account deletion | NOT VERIFIED | Adapter binding postoji, legal false, execution prazno; bez punog Auth/Storage testa | DA |
| Security | NOT VERIFIED | Managed scan pre-start error; dependency triage otvoren | DA |
| Privacy | FAIL | 0 legal dokumenata / 0 processor mapa / export binding null / URL404 | DA |
| Performance | FAIL prihvatnog kriterijuma | C4 P95 ~6,7 s; C16 timeout-i; sveži izolovani SQL timeout-i | DA |
| Crash stability | NOT VERIFIED release | 10 uspešnih povrataka na Home; prvi harness timeout; 16KB runtime neproveren | DA |
| Visual polish | PARTIAL; osnova FREEZE | 20 stanja pregledano; mapa i sve varijante nisu prihvaćeni | Samo ozbiljni nalazi |
| UX | PARTIAL | AI resume, private unread, pending filter i copy nalazi | DA za ključne tokove |
| Accessibility | NOT VERIFIED cela aplikacija | Veliki tekst delimično; nema TalkBack/focus/contrast matrice | DA za osnovne kontrole |
| Store compliance | FAIL | Legal/deletion/AI/config/declarations otvoreni | DA |
| Production build | NOT VERIFIED | Nema pronađenog AAB; production konfiguracija vodi na DEV | DA |
| Signing | FAIL za dostavljeni release kandidat | Preview APK koristi debug ključ; pravi upload/Play potpis nije proveren | DA |
| CI | BLOCKED; lokalni Jest FAIL | CI 0 koraka/billing; lokalno 603/604 suite-a, jedan zastareli source-text test pada | DA ili dokumentovana ekvivalentna reproduktivna release provera |
| Real-device test | NOT VERIFIED aktuelni kandidat | Fizički telefon nije povezan; ranija push potvrda ograničena | DA |

**NE — USKOČI V1 JOŠ NE BIH POSLAO NA STORE REVIEW.**

Najmanji skup koji odgovor pretvara u DA: objaviti i stvarno povezati pravni/privacy/deletion/export paket; zatvoriti AI resume/lokaciju/push i povezani dvo-naložni poslovni tok; rešiti Discovery kapacitet i aktuelnu security/dependency proveru; proizvesti jedan ispravno potpisan production AAB sa Firebase/16KB, potvrditi ga na uređaju i završiti Console deklaracije/CI/operativni rollback. Nije potreban novi opšti redizajn.
