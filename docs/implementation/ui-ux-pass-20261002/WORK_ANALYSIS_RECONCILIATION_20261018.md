# USKOČI — komentar Work analize i usaglašen nastavak rada

Datum: 18.10.2026. Pročitano svih 18 odeljaka, 20 nalaza F01–F20 i prilog sa 62 reda iz dostavljene analize. Ovo je dopuna postojećeg LIVE plana i registra, ne novi master ili potvrda završene aplikacije.

## 1. Zaključak

Work analiza je korisna, tehnički konkretna i uglavnom dobro razlikuje implementaciju od dokaza rada. Slažem se sa njenom glavnom ocenom: postoji razvijeno jezgro; najveći preostali posao je povezivanje novih razgovora, potvrđenih podataka, matching-a, obaveštenja i jedne proverene isporuke.

Moj prethodni pregled dodaje precizniji inventar nagomilavanja i poslednje dostupne slike. Work analiza dodaje važne nalaze o production proveri, različitim build zastavicama, worker helper-u i neusaglašenosti nasleđivanja sposobnosti sa potvrđenim režimom rada. Te nalaze sam sada ciljano proverio.

Ne bih vraćao projekat na početak niti pravio još jednu kopiju aplikacije. Zadržao bih aktivni `USKOCI-EAN`, postojeći poslovni model, zajedničke UI elemente i jedan registar. Nastavak treba organizovati kroz povezane pakete sa proverljivim izlazom. Funkcionalni i vizuelni deo istog toka završavaju se zajedno.

## 2. Tačan obim i poreklo

| Izvor | Identitet i granica |
| --- | --- |
| Dostavljeni HTML | `USKOCI_DUBINSKA_ANALIZA_20261018.html`, 120.396 bajtova; SHA-256 `dd0a3b519c0efc3277786612e31d67f2201b325d9a2c11d72f98273710140dbf` |
| Work puni test | Prema dostavljenom izveštaju: `a575838c9dcc3235b24c6421885a9d4dc2e82840`, 620/620 grupa, 13.832/13.832 testa, 6 snapshot-a; 141 dodatna Node provera |
| Work završni izvor | `938df57d81e98821255d361afd6b6201e996889d`; pet novijih commit-a posle punog testa, uz prijavljenih 188 ciljanih UI i 3 geografske source provere |
| Sadašnji početni HEAD | `1b1d9d1f739cd98940f30150fb8defe5283c379a`, ista grana `feature/unified-qa-master-20261017`; razlika od 938df57d je dokumentaciono sređivanje |
| Lokalno stanje | `eas.json` već ima necommitovane izmene; zaseban 3D SQL kandidat je necommitovan. Ne pripisujem ih ovom radu |
| Nove provere ove sesije | Read-only Supabase metapodaci, closure/legal, tri geografske/taksonomske funkcije, agregati i advisori; kompletan readback obe AI Edge funkcije; lokalni production guard bez build-a/mrežnog poziva; poređenje commit-ovane i lokalne konfiguracije |
| Nije rađeno | Nova primena na server, promena korisničkih podataka, plaćen AI poziv, push, novi APK, nov pregled uređaja, ponavljanje punog Jest-a ili penetracioni test |

Work rezultat punog Jest-a prihvatam kao jasno označen izveštaj te sesije. Priloženi HTML ne sadrži sirove test izlaze; nisam ga pretvorio u svoj ponovljen PASS. Moj raniji discovery od 620 fajlova potvrđuje inventar, ne prolaznost. Oba nalaza mogu biti istovremeno tačna. Za završni kandidat treba sačuvati sirovi rezultat i tačan izvor, jednom na mestu integracije.

## 3. Šta je sada nezavisno potvrđeno

### Isporuka i Edge

1. **Production guard zaista prihvata DEV.** Lokalno sam učitao commit-ovanu production konfiguraciju i pozvao postojeći `validatePreview`. Rezultat: package `rs.uskoci`, DEV URL, guard prihvata. Nije napravljen AAB i ništa nije objavljeno. Guard treba da odbije DEV u production režimu već sada; stvarni production projekat može doći kasnije, kroz postojeću vlasnikovu odluku.
2. **Tri nove zastavice nisu jednako isporučene.** U commit-ovanom EAS preview-u ih nema; u lokalno izmenjenom `eas.json` sve tri su `true`. U dva pročitana APK workflow-a nisu izričito navedene; poseban OTA workflow ih uključuje. Nepoznat spoljašnji EAS env ne sme se smatrati dokazanim. Lokalna konfiguracija nije automatski konfiguracija CI APK-a.
3. **Requester Edge v89 poklapa se 9/9 fajlova sa sadašnjim izvorom; worker v44 poklapa se 5/6.** Razlika je `classificationGeminiShadow.mjs`. Live SHA je `13238d2bed7364687eb3c0510aea21e4bb3cf817ed8ff5a5c456b64470e181ba`, repo SHA `6162cedad8e1bff5dca357a63c581030438a99db6eb59493ea6941576939a534`.
4. **Razlika helper-a ima objašnjeno poreklo.** Receipt `20261018070011_dev_ai_interview_prompt_readback.receipt.json` kaže da je pri objavi samo dve instrukcije namerno sačuvana aktivna worker zavisnost. Njegovo „6/6“ znači jednakost poslatom paketu, a ne jednakost svih fajlova repo HEAD-u. To nije dokaz da je deployment izgubio fajl; jeste otvoreno usaglašavanje paketa. Raniju formulaciju „obe funkcije potpuno usaglašene“ treba čitati sa ovim ograničenjem.

### Živa baza — čitanja oko 08:36–08:38 UTC

- Projekat je ACTIVE_HEALTHY; 280 migracija, poslednja `20261018075854`.
- Closure live digest `88cab17911f89a7d8d800ae229db568dd2aaed106395ad8acc3207917acd72ec` razlikuje se od potvrđenog `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`; `retention_ai_source_ready()` je false.
- Pravni reader vraća `ready=false`, `LEGAL_DOCUMENTS_NOT_PUBLISHED`.
- Katalog: 135 kategorija, 3 alijasa, 56 standard-coverage veza.
- Postoje 2 worker capability reda, 2 Need binding reda, **0 worker binding redova i 0 potvrđenih service-mode redova**.
- Novi outbox i binding su uključeni; stroži scope gate je isključen.
- Živi `taxonomy_scope_eligible_v1` traži mode zapis baš za kategoriju zadatka; matcher sposobnosti dopušta provereno `INHERITED_STANDARD` nasleđivanje. Rizik aktivacije je stvaran; nije potvrđen novi kvar trenutno isključenog gate-a.
- Živi `candidate_profile_ids` za fizički zadatak prvo uzima poznate tačke u 300 km, a fallback dopunjava samo profile bez poznate tačke. Buduća regionalna pokrivenost zahteva i promenu ovog ranijeg izbora kandidata.
- Security advisori ponavljaju 192 authenticated i 2 anon SECURITY DEFINER upozorenja, jedan mutable search_path i isključenu leaked-password zaštitu. Performance advisori ponavljaju 93 FK, 18 initplan i 5 multiple-policy upozorenja; dodatno navode 7 tabela bez primarnog ključa i 15 unused-index stavki. To su kandidati za proveru, ne potvrđene ranjivosti niti nalog za masovno menjanje šeme.

Broj 0 worker binding-a ne dokazuje da RPC nikada ne može da radi. Dokazuje da u ovom skupu nema sačuvanog rezultata novog worker lanca. Postojeće nasleđene sposobnosti i stare putanje zato moraju ostati jasno označene dok se ne završi kompatibilna migracija.

## 4. Komentar svih 20 Work nalaza

| Nalaz | Moja ocena i dopuna | Radnja / redovi |
| --- | --- | --- |
| F01 — closure mismatch, P0 | Potvrđeno uživo. Ne menjati samo hash da bi indikator bio zelen. Uskladiti stvarni obuhvat izvoza/brisanja i izuzetke | Inventar novih podataka, dokaz i izolovana recertifikacija; N09–N11, S04 |
| F02 — production prihvata DEV, P0 | Potvrđeno lokalnim izvršenjem guard-a. Ne treba čekati otvaranje production projekta da bi se pogrešan cilj odbio | Source guard i negativne provere, zatim odvojena production priprema; S04, N01–N04 |
| F03 — legal nije objavljen, P0 | Potvrđeno runtime reader-om. Primljeni nacrti i aktivan objavljen paket su različiti nivoi | Završiti odobren sadržaj i izvršno povezivanje; N04, N09–N11 |
| F04 — nema objedinjene release potvrde, P0 | Saglasan na osnovu pregledanih dokaza. Stari PASS i novija slika ne spajaju se automatski | Jedan kandidat, manifest i povezani prolaz; svi pogođeni redovi |
| F05 — različite build zastavice, P1 | Potvrđeno, uz dopunu da lokalna necommitovana ispravka već postoji. Ona nije isporučena | Uskladiti podržane build/OTA puteve i eksplicitne env izvore; A06–A07, B00–B04, S04 |
| F06 — worker shared helper, P1 | Potvrđeno 5/6 prema repo-u. Stara zavisnost je namerno sačuvana pri uskoj prompt objavi; novu punu objavu pripremiti kao jasan paket | Test obe uloge, ceo dependency manifest, tačan readback; A02, B00, S04 |
| F07 — novi worker binding/mode tok, P1 | Potvrđene nule i isključen gate. Inherited sposobnost i exact-mode predicate treba uskladiti pre aktivacije | Worker Save/readback, eksplicitni režimi, stari profili i negativni match; B00–B04, P04 |
| F08 — grana i CI, P1 | Aktuelna grana je potvrđena. Broj 783 je datirani Work presek, nije moj novi izračun. Stari default nije automatski nova linija rada | CI i status checks vezati za stvarnu integracionu granu; S04 |
| F09 — nova grana nije dokaz reuse-a, P1 | Saglasan. Postojeća 3D kategorija i dva Need binding-a ne dokazuju novu granu kroz Gemini | Kontrolisana nova usluga, više segmenata, konkurentni isti naziv, isti ID; A02, A06–A07, B00 |
| F10 — push UNKNOWN, P1 | Work navodi konkretan istorijski ishod; u ovoj sesiji ga nisam ponovo čitao niti slao. Ne pretvarati provider accepted u prikaz na uređaju | Korelacija starog ishoda, pa odobren jedan novi događaj; P01–P04, D03 |
| F11 — Edge 503, P1 | Brojevi pripadaju imenovanom 24h prozoru. Nije dokazana stopa kvara svake fotografije ili razgovora | Povezati request/error/deployment pre popravke; A05, D04, S03 |
| F12 — region nije aktivan, P1 | Potvrđeno kodom i postojećim receipt-om. Vlasnik već želi prirodne regione; ne svoditi zahtev trajno na radijus | Potvrđen region po usluzi kroz ceo model; B00–B04 |
| F13 — 300 km prefilter, P1 | Potvrđeno živom definicijom. Popravka samo konačnog matcher-a ne može vratiti odbačenog kandidata | Coverage-aware kandidati, paging/dedupe/limit, tek zatim dispatch; B04, P04 |
| F14 — definers, P1 | Brojevi potvrđeni advisor-om. Namenjeni RPC nije automatski ranjivost; eventualni dokazani pristup tuđim podacima postaje P0 | Caller/owner/account-open provere i negativni scenariji; N06–N11, S04 |
| F15 — brojčani minimum budžeta, P2 | Postoje kategorije „Sa iznosom / Tražim ponude“. Numerički minimum nije glavni uslov završenog AI/worker toka | Zajednički PAGE/MAP/PLACES uslov, bez lokalnog filtriranja jedne stranice; B05 |
| F16 — veliki UI fajlovi, P2 | Veličina povećava održavanje, ali nije sama po sebi kvar. Ne odlagati koristan UX zbog masovnog preimenovanja | Razdvojiti vlasnike stanja dok se popravlja odgovarajuća porodica; B04, D02–D05 |
| F17 — rast kataloga, P2 | Potvrđeni loader 20×100, prompt 96 u oba intervju poziva i ancestry granica 32. Dubina 3 je sadržaj, ne zabrana dubljeg stabla | Verzija/cache/relevantne grane; jasno definisane tehničke granice i dokaz novih nivoa |
| F18 — Home čitanja, P2 | Šest paralelnih čitanja potvrđeno. Sam broj šest ne dokazuje lošu latenciju | Izmeriti aktivan put, ukloniti dokazano suvišno; A01, A09, B10–B12, D01 |
| F19 — DB dug, P2 | Brojevi advisora potvrđeni. Ne dodavati svih 93 indeksa niti brisati 15 „unused“ bez plana i reprezentativnog uzorka | EXPLAIN i stvarne putanje, zatim male dokazane izmene; S04 |
| F20 — vizuelna doslednost, P2 | Aktivni Entry/Intake imaju 10/11 dp izuzetke. `ReferenceEntryHero` nije dosegnut aktivnim route grafom; njegov font nije dokaz vidljivog problema | Prioritet stvarnim ekranima, čitljivost i keyboard/Back; odgovarajuće UI porodice |

## 5. Šta bih izmenio u preporukama Work analize

### 5.1. UX ne bih ostavljao kao ceo naknadni projekat

Predlog „prvo svi funkcionalni tokovi, pa svih osam vizuelnih porodica“ može izazvati dvostruki rad. Zajedno treba završavati podatke i ekran koji ih pokazuje: AI → pregled → sačuvani profil → odgovarajući zadatak. Na kraju sledi jedan zajednički vizuelni prolaz za preostale nedoslednosti.

### 5.2. Sačuvati dve namere na Početnoj, slobodno promeniti njihovu veličinu

Dva velika ulaza iz Work teksta tretiram kao opis sadašnjeg rešenja. Vlasnik je kasnije dao slobodu za redizajn. Namere „Objavi zadatak“ i „Uskoči i zaradi“ ostaju, a raspored može biti kompaktniji da sledeća korisna stavka stane na prvi ekran. Prazan „Čeka te“ ne treba čuvati samo zato što je u nacrtu.

### 5.3. AI ostaje glavni način izmene profila

Work predlaže da kalendar i „Mogu odmah“ ostanu konkretne kontrole. Kalendar za pregled obaveza ima jasnu svrhu. Za izmene usluga, teritorije i radnog vremena polazim od vlasnikove želje da se rade kroz razgovor. Klik na činjenicu može otvoriti isti razgovor sa kontekstom. Ne bih automatski vraćao ručni editor radijusa/rasporeda kao obavezan paralelni put. Eventualni brzi status mora imati jedno nedvosmisleno značenje i sačuvati isti autoritativni podatak.

### 5.4. Region ostaje deo zahteva

Work korektno kaže da se može isporučiti samo pošteno prikazan lokalni krug, ali vlasnik je već tražio Srbiju, Vojvodinu, više gradova i prirodni govor. Regionalnu podršku zato vodim kao aktivan zahtev za završavanje. Privremeno jasno ograničenje može sprečiti pogrešno obećanje; ono ne zatvara taj zahtev.

### 5.5. Korisnik ne treba da uređuje stablo kategorija

Potvrđuje razumljivo ime usluge, režim i područje. Puna taksonomska putanja može biti sekundarno objašnjenje kada postoji stvarna dvosmislenost, a ne glavni obrazac. ID, action enum i tehnička dubina pripadaju sistemu. Uređeno širenje stabla ne daje automatski novu sposobnost svakom radniku u srodnoj grani.

### 5.6. Zamrzavanje dolazi posle prihvatanja

Prihvaćenu porodicu ne redizajnirati bez razloga. Ali najnovija vlasnikova sloboda obuhvata Entry/Home/logo kompoziciju. Ne zaključavati sadašnju animaciju samo zato što postoji u starom master-u. Sačuvati brend i originalne resurse; izabranu novu kompoziciju zamrznuti kada stvarno prođe pregled.

### 5.7. Prilog sa 62 reda je indeks, ne nov svež spisak grešaka

Prilog pošteno zadržava stare napomene. One nisu sve aktuelan nalog za rad: A16 i dalje prenosi staro vraćanje HITNO, iako ga isti Work tekst pravilno vodi van sadašnjeg V1; više redova ponavlja stare APK-ove i nedostajuće dokaze. Postojeći registar treba dopuniti preciznim sledećim korakom, uz očuvanje istorije. Datum novog HTML-a ne osvežava automatski stare redove.

## 6. Usaglašen redosled izvođenja

Oznake ispod služe čitanju ovog predloga. Statusi ostaju u postojećih 62 reda; ne otvara se drugi tracker.

### Paket 1 — jedna proverljiva DEV isporuka

**Prvo:** pregledati lokalni `eas.json` diff i objediniti podržane preview APK/OTA konfiguracije. Pripremiti worker helper promenu u celom paketu, sa očekivanim hash-evima. Dodati production guard koji odbija DEV i ne prihvata nepoznat production cilj. Nadograditi postojeći build identity jednim receipt-om koji vezuje source, dirty stanje, flags, native runtime, APK hash/OTA update i DEV snapshot.

**Granica:** usklađivanje zastavica nije dozvola da se uključi strict scope nad nula mode redova. Nova Edge primena mora imati konkretan pripremljen paket pod postojećom dozvolom, bez uzgrednog plaćenog AI poziva. Ne stvarati novi production nalog/projekat iz UI zadatka.

**Gotovo kada:** više nema neobjašnjene razlike između podržanih build puteva; svaki aktivni legacy put je nameran i označen; production negativni slučaj je odbijen; poznato je šta tačno ide u sledeći emulator APK.

### Paket 2 — model usluge, potvrde i teritorije

**Rad:** jedna potvrđena predstava po usluzi: kanonski ID, šta je osoba stvarno prihvatila, REMOTE/ON_SITE, odgovarajuće područje i relevantna dostupnost. Razdvojiti grad profila, mesto izvođenja i predaju rezultata. Uskladiti exact/equivalent/inherited sposobnost sa potvrđenim režimom kroz proverene veze. Obraditi stari profil bez tih redova, povučenu uslugu, ponovljen Save i zakasneli odgovor.

**Region:** nastaviti postojeći kandidat; verzionisani izvori područja i geometrija, više oblasti bez izmišljenog jednog velikog kruga, rute sa jasno potvrđenim obuhvatom. Uključiti u izvoz/brisanje i rešiti closure obuhvat pre aktivacije novih ličnih podataka. Novi digest je rezultat dokazanog programa, ne zamena za dokaz.

**Gotovo kada:** opis → pregled → Save → binding → ponovno čitanje daju iste podatke; nepoznat/nesačuvan deo nije prikazan kao aktivan. Kod za novu kategoriju podržava više segmenata, bez slučajnih duplikata i bez automatskog dodeljivanja svih srodnih sposobnosti.

### Paket 3 — AI zadatak i radni profil kao završena porodica ekrana

**Rad:** jedan smislen razgovor, kratko „Za sada“, pitanja samo za stvarno nedostajuće, jasan završni pregled. Izmenjen podatak može da se ispravi rečenicom. Sačuvani profil prikazuje isti potvrđeni model i jedan glavni AI ulaz za izmene; ukloniti duplirane alijase i praznu obaveznu opremu. Mapa ostaje fokusirana potvrda kada je potrebna. Gost i prijava čuvaju nacrt, uz stvarno podržane dozvole.

**Primeri:** figurice izrađene kod izvršioca i poslate u Novi Sad ostaju remote izvršenje; „živim u NS, montiram po Vojvodini“ razdvaja grad od područja; „imam kombi“ ne izmišlja ponuđenu uslugu prevoza; ispravljena ili odbijena usluga ne vraća se posle zakašnjelog odgovora.

**Gotovo kada:** create/edit/save/reopen radi na istom native kandidatu; tastatura, Back, prekid, greška i nepotvrđen ishod su jasni; čovek vidi šta je sačuvao i šta još nije aktivno.

### Paket 4 — matching, kandidati i jedno obaveštenje

**Rad:** isti potvrđeni model kroz candidate selection, konačni fit, personalizovani prikaz i dispatch. Proveriti raniji krug 300 km, dedupe pre limita, paging i ponovnu procenu otvorenih zadataka kada se profil izmeni. Strogi režim uključiti tek sa kompatibilnim podacima i dokazima. Javni pregled i ručna prijava ostaju dostupni prema postojećim pravilima; nepostojanje personalizovanog match-a samo po sebi nije nova zabrana.

**Dokaz:** naručilac A i različiti radnik B. Pozitivan match, negativna usluga, pogrešan režim, van područja, nerelevantna dostupnost i proverena šira sposobnost za uži zadatak. Za odobren push događaj vezati event, primaoca, delivery, provider ticket/receipt i otvaranje pravog zadatka/niti. UNKNOWN rešavati bez slepog ponovnog slanja.

**Gotovo kada:** isti zadatak daje objašnjiv i dosledan rezultat od potvrđenog profila do ciljne isporuke. Emulator ostaje tekući uređaj za rad; fizički push/prikaz potvrđuje se u vlasnikovom odobrenom prozoru. Emulator ili provider ticket se ne preimenuju u dokaz telefona.

### Paket 5 — Home, Discovery, detalj, ponuda i izbor

**Rad:** korisna Početna sa dve namere, nastavkom i stvarnim obavezama; bez velikih praznih sekcija. „Aktuelni zadaci“ dok nema stvarnog personalizovanog rezultata. Jasna remote/teren podela, jedan prostor filtera, sačuvan viewport i Back. Na mapi mnogo zadataka prikazivati kroz postojeće grupisanje i čitanja, uz merenje. Detalj i ponuda imaju stvarne uslove, osnovicu cene, broj ljudi i jedan jasan sledeći korak.

**Gotovo kada:** Home → Zadaci → detalj → ponuda → izbor → Dogovor prolazi; broj, mapa i lista se slažu; nepotpuno učitavanje ili prazna cena ne glume stvarne rezultate. Numerički budžet se dodaje samo kroz zajednički ugovor, nakon glavnog toka.

### Paket 6 — Dogovor, poruke, mediji, profil i vizuelno završavanje

**Rad:** sidreni kontekst zadatka, prihvaćeni uslovi i sledeća radnja, uz neposredan razgovor. Privatni i grupni kanal imaju jasnu razliku. Rešavati stvarno reprodukovane media greške. Završetak, ocene i javni profil koriste iste serverske činjenice. Ujednačiti razmake, font, kontrolne ikonice i selektivne ilustracije.

**Brend i motion:** kvalitetan originalni master znaka; kratka uvodna sekvenca sa vidljivim login/signup; povezati radar na kartici „Uskoči i zaradi“, umesto popravljanja nepovezane komponente. Fokus/pozadina/Reduce Motion su deo prihvatanja. Prvo nacrtati normalna i prazna stanja, zatim dodati pokret koji objašnjava radnju.

**Čišćenje:** izdvojiti dizajn laboratoriju iz proizvodnog bundle-a, ukloniti dokazano zamenjene komponente i zastarele testne pretpostavke. Stari HTML build ulaz ne brisati pre zamene postinstall zavisnosti. Refaktor ide po vlasniku stanja, bez druge paralelne implementacije.

**Gotovo kada:** privatni i grupni tok, media recovery, ocena, normalan/veći tekst, tastatura i navigacija prolaze na kandidatu; prihvaćene porodice više se ne redizajniraju bez novog razloga.

### Paket 7 — javno izdanje

**Rad:** odvojeni production backend i konfiguracija, stvarni auth/email/redirect, odobreni pravni paket, dokaz izvoza/brisanja, nalazima vođena sigurnosna provera, backup/restore, Firebase za stvarni package, potpisan AAB, podrška i tačan prikaz prikupljenih podataka. Pregledati dependabot upozorenja na relevantnoj grani; upozorenje starog default-a nije automatski potvrđena ranjivost ove isporuke.

**Gotovo kada:** nema otvorenog P0 za tu isporuku, puni test izlaz i svi obavezni native scenariji vezani su za isti kandidat, poznat je rollback i vlasnik odluči o javnoj objavi. Ovo poređenje ne daje novo odobrenje za javno izdanje.

## 7. Obavezni završni scenariji

Zadržavam Work J01–J14: nalog/recovery; lokalna objava; remote sa predajom; novi worker profil; izmena profila; nova grana; Discovery; ponuda/izbor; ponovno traženje; privatni/grupni chat; push; završetak/ocena; drugi nalog/privatnost; izvoz/brisanje.

Dopunjujem ih konkretnim uslovima:

- **J04/J05:** Save mora napraviti ili namerno ažurirati binding i service-mode, ne samo lep review. Regionalni upis uključuje čitanje istog identiteta/verzije područja.
- **J06:** nova putanja sa više novih segmenata i konkurentni isti zahtev; proveriti i reuse. ID se čuva, ponovljen pokušaj ne duplira uslugu.
- **J07/J11:** pozitivna šira potvrđena sposobnost → uži zadatak i negativan pogrešan režim; kandidat koji radi u regionu, a njegova lična tačka je van starog kruga 300 km.
- **J11:** događaj pripada drugom nalogu. Samopoklapanje ili simulirani fit nisu dovoljan završni dokaz. Provider accepted, provider receipt, prikaz i tap su odvojeni koraci.
- **J13/J14:** outbox/review/hint/snapshot podaci i stari JWT obuhvaćeni su važećim pravilima, uz testne podatke u dozvoljenom okruženju.
- **Sve porodice:** status dokaza navodi source, flags, APK/OTA, DEV presek, uređaj i granicu. Nema procenta „gotovo“ izvedenog iz broja testova.

## 8. Šta radimo prvo, a šta ne otvaramo ponovo

Prvi izvršni paket je usaglašavanje konfiguracije isporuke i helper-a, uz analizu closure obuhvata. Odmah zatim ide završavanje AI → potvrđen worker model → sačuvani prikaz, zajedno sa odgovarajućim UX-om. To najdirektnije rešava pitanje „zašto ono što kažem AI-ju posle ne upravlja zadacima i obaveštenjima kako očekujem“.

Zadržavamo jedan nalog, četiri glavna odredišta, postojeći Discovery, server komande i recovery. Ne pokrećemo nov backend/AI sistem, novi dizajnerski framework, masovno brisanje testova ili novu radnu kopiju. Plaćanja/escrow, zaseban HITNO, iOS paritet i novi dekorativni sistemi ostaju van tekućeg paketa prema postojećim odlukama.

Rok se određuje posle prvog povezanog prolaza i identifikovanih prepreka. Za svaki paket postoji konkretan izlaz; rad se ne produžava proizvoljnim poliranjem prihvaćenih ekrana.

## 9. Izvori i tehnički trag

- Dostavljeni HTML je pročitan kao analiza, bez izvršavanja njegovog JavaScript-a. Njegov tačan hash je u §2.
- Prethodni inventar i sređivanje: `CURRENT_BASELINE_CLEANUP_20261018.md`, commit `1b1d9d1f`.
- Izvršivi production guard: `scripts/check-eas-preview.cjs:87`; ciljevi u `app.config.js` i `eas.json`.
- Build zastavice: oba APK workflow-a i `dev-android-preview-ota-20261014.yml`; lokalni `eas.json` odvojen od HEAD-a.
- Edge receipt: `supabase/operations/dev-alpha/ledger/20261018070011_dev_ai_interview_prompt_readback.receipt.json`; ceo živi paket ponovo pročitan ove sesije.
- Regionalni dokaz i granice: `docs/implementation/v5-ai-first/WORKER_COVERAGE_IMPLEMENTATION_20261018.md`.
- Žive definicije: `private.taxonomy_scope_eligible_v1`, `private.taxonomy_requirement_tier_inherited_v1`, `private.candidate_profile_ids`; čitane bez primene ili promene kontrola.
- [Expo runtime kompatibilnost](https://docs.expo.dev/eas-update/runtime-versions/): native sloj i OTA moraju odgovarati; promena native koda zahteva odgovarajući novi build. To nije dijagnoza prethodnog konkretnog pada.
- [Supabase privileged-function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [multiple policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Ovaj paket je pregled, nezavisna read-only provera i usaglašavanje narednog rada. Ne zatvara F01–F20, ne menja runtime, ne objavljuje novi Edge/APK i ne podiže telefon/release status.
