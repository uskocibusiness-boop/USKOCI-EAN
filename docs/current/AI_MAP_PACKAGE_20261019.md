# USKOČI — AI razgovori, jedan pregled i potvrda mape

Datum: 19.10.2026. · Drugi povezani paket · DEV i Android emulator

## Status isporuke

Runtime izvor: **7f202518e85b8ac0e9a7ee18b93cbb6b12024ea3**, grana feature/unified-qa-master-20261017. Povezani prethodnici: 7ab681fb, 4f198604 i 24736a79. Završni CI run **39298019592**: **621 paket / 13.968 testova / 0 padova / 0 preskakanja / 3 snapshot-a — PASS**.

**Završni APK je napravljen, instaliran sa install -r i proveren na emulatoru.** SHA-256: 624a1fd6e6e00f627d3f791c00b050e79923a87e68d32c585af83ad4fb4f57aa. Izvučeni instalirani base.apk ima isti hash. About prikazuje pun izvor 7f202518 i ugrađeni OTA 48ddc4d2, potvrđeno i posle hladnih pokretanja. APK je x86_64 za emulator; telefon i javno izdanje nisu prihvaćeni ovim dokazom.

DEV projekat: **leqcwgzvjsxugfgzdmth**. Nema SQL migracije u ovom paketu.

| Servis | Aktivna verzija | Dokaz |
| --- | ---: | --- |
| uskoci-ai-interview | 108 | Pročitan i upoređen sadržaj svih 16 datoteka |
| uskoci-worker-interview | 61 | Pročitan i upoređen sadržaj svih 14 datoteka |
| uskoci-location-search | 24 | Pročitan sadržaj, podudaranje sa izvorom, verify_jwt=true |

Prethodni Edge paketi sačuvani su za vraćanje. Tačni hash-evi i rezultati su u [evidenciji](evidence/AI_MAP_PACKAGE_20261019.json).

## Šta je promenjeno

### 1. Semantičke izmene ostaju u AI razgovoru

Pregled zadatka više ne nudi paralelni ručni izbor države, načina rada, topologije ili adrese. Pre čuvanja, „Izmeni kroz razgovor“ vraća u isti razgovor i čuva neposlati tekst. Stara ruta mesto-zadatka preusmerava na postojeći pregled; nema zaseban izvor čitanja/upisa.

Mapa ostaje namenski alat za ljudsku potvrdu tačaka koje je razgovor opisao. To nije drugi editor značenja zadatka. Pretraga služi pronalaženju fizičkog pina. Promena stvarnog mesta ili režima rada pripada razgovoru.

### 2. Čuvanje nacrta i objava imaju različite uslove

Živa proba je otkrila da canAccept znači da se privatni nacrt može sačuvati; ne znači da je zadatak spreman za objavu. Server je već odbijao objavu bez potvrđene fizičke lokacije. Novi klijent sada unapred blokira „Objavi“, objašnjava da nedostaju potvrđene tačke i daje jednu akciju za mapu. „Sačuvaj nacrt“ ostaje moguće.

Obuhvaćeni su STATIONARY, POINT_TO_POINT, MULTI_STOP i AREA_BASED. REMOTE ne zahteva mapu. Svaka obavezna tačka mora biti potvrđena i odgovarati svom slotu. Nova nepotvrđena promena blokira primenu; odbacivanje vraća prethodnu potvrđenu tačku.

### 3. Sačuvani nacrt nastavlja se kao isti zadatak

Posle SaveDraft-a, „Potvrdi mesto nacrta“ otvara postojeći serverski tok izmene **istog Need-a**. Tada je potreban novi edit conversationId, jer je prethodni razgovor završen čuvanjem. To je različito od povratka pre Save-a, gde conversationId ostaje isti.

Poznata geografija otvara pregled/mapu; nepoznata vraća na AI dopunu. Neizvestan ishod prvo se čita sa servera, bez ponavljanja Save-a. Read-only provera osam postojećih nacrta očuvala je postojeće category_id vrednosti; nije pokretala novu AI klasifikaciju.

### 4. Uklonjen je rizik zastarelog GPS callback-a

Asinhroni GPS primenjuje rezultat kroz aktuelni callback uz proveru vlasnika i zahteva. Ponovni render više ne može ostaviti stari pin potvrđen, a novi vidljiv. Dve regresije su pre ispravke reprodukovale grešku. Native proba GPS dozvole/realnog signala nije izvedena; ovaj nalaz ima ciljane automatizovane dokaze.

### 5. Konsolidovana su uputstva oba AI servisa

Uklonjeno je ponavljanje instrukcija, uz očuvanje ugovora handlera, šema, alata i granice Save/Publish. Ostaju kanonski naziv usluge, ceo snapshot usluga radnika, istraživanje kataloga/nova grana, način rada, predaja rezultata, privatnost i korekcije.

Sintetički zahtevi kroz stvarne handlere manji su sa 44.586 na 39.959 bajtova za zadatak i sa 37.116 na 30.213 za radni profil. **10,38% i 18,60% su smanjenja bajtova zahteva; nisu dokaz tih procenata uštede tokena, novca ili vremena.**

### 6. Popravljen je početni upit adrese

Na emulatoru je početni upit ponavljao ulicu iz privatne adrese i javnog opisa. Novi klijent koristi preciznu adresu i dodaje samo nedostajući kontekst. Poređenje poštuje cele uzastopne reči, srpska pisma i dijakritike; ne prepisuje originalne činjenice, prikaz, binding ili koordinate.

Na DEV-u je uvedena dijagnostika bez sadržaja korisničkog unosa. Tri ograničena endpoint poziva pokazala su: upstream 200 → PROVIDER_NORMALIZE → COORDINATE_INVALID → MISSING_OR_TYPE. Bar jedan rezultat nema koordinatu ili ima neodgovarajući tip. Nije potvrđen problem prijave, timeout ili pogrešna država. Raw provider telo nije pregledano niti logovano.

Četvrti poziv, sa tačnim očišćenim upitom novog klijenta, vratio je 200. Parser nije popušten i ne izmišlja pin. Logovi nemaju upit, adresu, koordinate, telo/URL providera, token ili korisnički identifikator. To je ciljano otklonjena greška, ne garancija da će svaka adresa biti pronađena.

## Stvarne AI probe i potrošnja

Osam logičkih poruka, **15 poziva modela**, 149.521 ulazni i 6.275 izlaznih tokena. Ukupna **interna procena 0,135679 USD**; provider račun nije nezavisno potvrđen. Cache pogodak nije dokazan.

| Scenario | Model pozivi | Odgovor |
| --- | ---: | ---: |
| 3D izrada kod izvršioca uz slanje | 2 | 25,305 s |
| Izmena samo budžeta na 5.000 RSD | 1 | 7,668 s |
| Digitalna prezentacija, REMOTE | 2 | 12,195 s |
| Fizički moleraj pogrešno nazvan online | 2 | 8,633 s |
| Radni profil: samo lokalno preuzimanje | 2 | 9,562 s |
| Radni profil: promena na slanje | 1 | 5,671 s |
| Stacionarno mesto | 2 | 10,287 s |
| Ruta sa dve tačke | 3 | 16,367 s |

Prosek je 11,961 s. **Pouzdano ubrzanje nije dokazano.** Dve kratke izmene već završavaju u jednom pozivu; pet početnih opisa zadatka troši 11 od 15 poziva. Ista dva modelska kruga traju 8,6–25,3 s, pa broj krugova nije jedino objašnjenje.

Pre i posle razgovora upoređeno je pet kanonskih otisaka: zadaci, njihove veze sa kategorijama, radni profil, njegove veze i katalog. Ostali su isti pre eksplicitnog Save-a. Privremeni AI pristup QA naloga zatvoren je po završetku proba. Nije izvršena objava, aktivacija radnika, matching ili push.

### Nalaz koji još ostaje

Stacionarni moleraj dobio je dodatna pitanja o gletovanju/materijalu i tekst da povezivanje usluge još čeka proveru, dok je naknadni pregled već bio READY. Statusnu dopunu odgovora treba uskladiti sa završenom klasifikacijom. Takođe je u odgovoru na budžet korišćena reč „cena“; terminologiju treba dosledno vezati za budžet/ponudu/dogovoreni iznos. Ovaj paket nije potvrda savršenih AI odgovora.

## Native provere — checkpoint 24736a79

Run 39291376956 je uspešno napravio APK nakon 621 paketa / 13.959 testova. SHA-256 APK-a: c1032aedaa809ec8cd6f2e57edef451a4c163c19ba602951261a1146b0d83977. Instaliran je sa install -r; izvučeni base.apk ima isti hash, About prikazuje izvor 24736a79 i embedded OTA 811ec9f7.

Na izolovanom Android korisniku 10 i QA nalogu, bez prepisivanja Miloševog razgovora, fizički je provereno:

- jedan pregled → mapa → isti pregled;
- SaveDraft → isti Need → novi edit razgovor → mapa;
- ruta: 1/2 tačke blokira primenu, 2/2 je omogućava;
- REMOTE pregled ne traži mapu;
- povratak čuva neposlati tekst; testni marker zatim uklonjen bez slanja;
- pomeranje pina poništava njegovu potvrdu i blokira primenu; odbacivanje vraća prethodnu potvrdu;
- pregled i mapa na 361, 390 i 412 dp, pri font scale 1,0 i 1,3;
- bez mreže prikazuje se greška i „Pokušaj ponovo“; vraćanje mreže vraća isti pregled.

Sačuvan je tačno jedan novi privatni DRAFT: 5bfc90fb-2dee-4090-a5eb-bd20a9dfbc2e, sa postojećom kategorijom 1434222c-f43a-460f-9b8a-abc567fbb378. Njegova naknadna potvrda mape pripremljena je u edit pregledu, ali nije objavljena: kanonski Need ostao je DRAFT / rev1 / 0 potvrđenih tačaka. U vezanom pregledu ponuđena je objava; ona nije pritisnuta. Ovo nije dokaz konačnog čuvanja izmenjenih tačaka u objavljenom zadatku.

Šest QA nacrta posle Save-a ima 0 objava, 0 dispatch rounds, 0 opportunity deliveries i 0 povezanih NEED događaja/obaveštenja. Brojevi se odnose na te zadatke, ne na globalnu bazu.

Automatska pretraga iz checkpoint-a prvo je reprodukovala geokodersku grešku; oporavak je tada izveden ručno kraćim upitom. Automatski očišćen upit dodatno je potvrđen u završnom 7f202518 APK-u, kako je opisano ispod.

Aplikacija je podešena na light. Nisu fizički potvrđeni dark tema, TalkBack, brzina skrolovanja/FPS ili GPS signal. Četiri pogrešna početna testna deep-link snimka i privremeni loading snimci odvojeni su od potvrđenih rezultata; uspešne provere imaju zasebne valid snimke.

## Završna native potvrda — 7f202518

Na istom sačuvanom DRAFT-u, redovnom akcijom „Potvrdi mesto nacrta“, otvoren je novi edit razgovor 1bd3a33f-1760-4a29-bd32-23e732bc2941 vezan za isti Need 5bfc90fb-2dee-4090-a5eb-bd20a9dfbc2e. Nije kreiran drugi zadatak.

Mapa je **automatski** ponudila Bulevar oslobođenja 50, Novi Sad, bez ručnog unosa ili skraćivanja pretrage. Pre potvrde: 0/1 i Primeni blokirano. Posle ljudske potvrde: 1/1 i Primeni omogućeno. Primena vraća na isti pregled; Objavi postaje omogućeno, ali nije pritisnuto. REMOTE pregled je zasebno otvoren i ne traži mapu.

Završno SQL čitanje potvrđuje istih šest DRAFT zapisa, bez publikacije, dispatch-a i obaveštenja; kanonske tačke sačuvanog zadatka nisu promenjene bez objave/čuvanja. Nije bilo dodatnih AI poziva u ovoj finalnoj native proveri.

Emulator je vraćen na originalnog Android korisnika 0, rezoluciju 1264×2728, density 560, njegov font 1,15 i mrežu. Originalna prijava i Početna vizuelno su potvrđene. U originalnoj sesiji dodatno je proveren isti runtime 7f202518 / embedded OTA 48ddc4d2. QA korisnik 10 ostaje odvojen, font 1,0. Telefon nije korišćen.

Oznaka „lokalne izmene“ u About potiče iz CI prebuild koraka. Receipt, sačuvani prebuild diff, pun izvor i instalirani hash omogućavaju proveru; oznaka sama po sebi nije nepoznata lokalna verzija.

## Automatizovane provere

| Oblast | Rezultat |
| --- | --- |
| AI i klasifikacione Node provere | 313 PASS; AST potvrđuje opseg promene instrukcija |
| Mapa/GPS | 134 PASS, uključujući dve reprodukovane regresije |
| Spremnost objave/pregled | 183 PASS |
| Oporavak sačuvanog nacrta | 219 PASS, uključujući 13 novih scenarija |
| Acceptance harness | 15 PASS |
| Početni upit adrese | 214 povezanih PASS, uključujući 9 novih scenarija |
| Stvarni handler geokodera | 30 PASS |
| TypeScript | PASS |
| Završna puna regresija, 7f202518 | 621 paket / 13.968 testova, bez padova/preskakanja |

Ciljane grupe se preklapaju; ne sabiraju se kao nezavisna ukupna količina testova.

### Sačuvana istorija neuspeha i ispravki

Lokalna puna regresija započeta pre GPS ispravke zabeležila je dve nove GPS regresije i devet Windows/Bash preskakanja. To je pre-fix dokaz. Run 39287567426 otkazan je zbog dodatne UI ispravke; run 39289078927 na 4f198604 imao je 621/13.946 PASS i otkazan je pre APK-a zbog oporavka sačuvanog nacrta. Uspešan checkpoint 24736a79 ostaje zaseban od završnog 7f202518.

Acceptance skript je prvobitno pogrešno očekivao canAccept=false bez pina. Pročitane su žive SQL funkcije i utvrđeno da je čuvanje nacrta dozvoljeno. Provera je ispravljena da razlikuje opis lokacije, potvrđenu tačku i objavu. Sačuvan odgovor ponovo je proveren offline, bez ponavljanja modelskog poziva; poslat je samo preostali scenario rute. Originalni prekinuti zapis nije obrisan.

## Šta je sledeće

1. **Merljivo ubrzanje oba AI toka.** Dopuniti postojeće bezsadržajne metrike za admission, provider, settlement i paralelni tool batch, stvarni FINAL/TOOL_CALLS/INVALID odgovor i postojeće token/cache podatke. Bez novih privatnih logova ili paralelnog telemetry autoriteta. Tek potom menjati deo koji stvarno troši vreme.
2. **Ciljano uklanjanje ponovljene klasifikacije.** Fresh EXACT/alias provera poznatih seed usluga može pomoći nekim korekcijama, ali ne rešava većinu početnih opisa. Finalni verify, svež katalog i Save/Publish ostaju. Low thinking i paralelni tool batch već postoje. Stabilan prefiks/cache treba meriti, ne pretpostavljati; [zvanična Google dokumentacija](https://ai.google.dev/gemini-api/docs/caching).
3. **UX mape/pregleda.** Sažeta ulica i broj + grad, detaljan provider opis po potrebi; jasna razlika „predlog“, „potvrđeno“ i „primenjeno“; pregled svih tačaka rute iznad dugog opisa. Discovery sažetak polaska i detalji rute imaju različitu svrhu. Ukloniti ponovljeno „Na daljinu“ u vremenskom sažetku gde ne nosi novu informaciju.
4. **Područje i matching.** Potvrditi regionalni obuhvat i pokrivenost svih obaveznih tačaka rute. Potvrda pina nije dokaz dovršenog regionalnog dispatch-a.
5. **Dva naloga, stvarna objava i push.** Proći sačuvan zadatak → objava → odgovarajući radnik → obaveštenje → pravilan ekran → prijava → izbor → Dogovor. Odvojiti prihvatanje push servisa od stvarnog prikaza na uređaju.
6. **Preostali proizvodni talasi.** Grupne fotografije/glas, privatna komunikacija naručioca sa izabranim članom, otkaz/zamena i recenzije; zatim povezan vizuelni polish i uklanjanje zamenjenih slojeva.

Ovaj paket ne zatvara celu aplikaciju, javno izdanje, telefon, regionalni rad ili pouzdanu isporuku push-a. Njegov rezultat su konkretniji AI/pregled/mapa tok i dokazi njihovih granica.
