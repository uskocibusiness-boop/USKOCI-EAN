# AI razgovori — nastavak 19.10.2026.

## Polazni presek

Grana `feature/unified-qa-master-20261017`, osvežena na `69be6fde` (docs child funkcionalnog `f18ea85d`). Radno stablo bilo čisto. Prethodni emulator build **39172584706** za `f18ea85d` je SUCCESS: TypeScript, puna regresija i APK. To nije dokaz instalacije novih izmena iz ovog paketa.

## Povezana celina

- **Task Edge:** dnevnica/satnica i ponovljene smene više ne odbacuju nezavisno navedene odgovore. Broj ljudi i mesto mogu da se zabeleže dok se problematičan uslov razjašnjava. Cena, zavisni termini i sintetisani naslov/opis se ne predstavljaju kao potvrđeni. Svi postojeći guard-ovi datuma, vremenske zone, promene posla i safety ostaju. Pet novih slučajeva prvo je palo na starom kodu.
- **Worker razgovor:** nastavljen otvoreni nacrt je označen; sačuvani profil nije izmenjen samim ulaskom. Jedna akcija „Izmeni kroz razgovor“ zamenjuje dugmad uz svaku sekciju pregleda. Isti conversationId, server nacrt i neposlat tekst ostaju; nema automatskog slanja/čuvanja.
- **Zajednička AI tastatura:** Android `KeyboardAvoidingView` meri preklapanje tastature pomoću padding ponašanja, kao i iOS. Na zatečenom emulatoru je dokazano da tastatura pokriva input/send i da tap može pogoditi slovo tastature. APK 0ca2b699 je zatim dokazao input/send iznad tastature na 361/390/412 dp pri fontu 1,0 i 1,3. Dodatna proba otkrila je da kraj razgovora sa karticom potiskuje odgovor pri kucanju; dopuna 2df06add premešta istu karticu u skrol iznad poruka dok je tastatura otvorena. Unit test nije zamena za native geometriju.
- **Profil:** vrednost dostupnosti ide ispod naslova kako veliki tekst ne bi lomio sam naziv.
- **Testovi:** istorijski zahtev za „Izmeni“ uz svaki deo i tačan redosled dekorativnih sekcija zamenjen je proverom jednog dostupnog ulaza, sačuvanih podataka, veličine dodira, zabrane nedozvoljenog pisanja i istog razgovora.

## Provere pre primene

TypeScript PASS. Posle konačnih izmena: 6 ciljanih Jest grupa / 209 testova PASS, 137 Node Edge provera PASS. Pre toga dodatno 7 grupa / 245 testova PASS na ranijem preseku paketa. To nisu dva odvojena ukupna zbirna rezultata.

Izvorni paket je commit **0ca2b6991e156f99bf6fcb4d14f0be8cfd5717a8**, objavljen na zajedničkoj grani. CI **39199573841** završio je punu regresiju: **621 grupa / 13.871 test PASS**, 0 padova i 0 preskočenih. Preuzet je originalni Jest JSON, artifact **12163383105**. Native build se vodi zasebno.

Task Edge **v100** je ACTIVE na DEV-u. Svih devet fajlova pročitano je sa servera i poređeno sa Git sadržajem navedenog commita: **0 razlika**. U prvom paketu Worker Edge nije menjan; naknadna korekcija v54 opisana je niže. [Receipt primene](../../supabase/operations/dev-alpha/ledger/20261019_ai_partial_answers_edge.receipt.json) sadrži hash svakog fajla i prethodnu verziju za vraćanje. Nema SQL migracije u ovoj celini.

## Stvarni razgovori i granice

Emulator, postojeći testni nalog Milos. Budžet najviše 12 poziva / 3 USD rezervacije; nema objave zadatka, čuvanja profila ili push probe u ovoj rundi. Zatečeni AI nacrt (krečenje) razlikuje se od sačuvanog profila (3D). Prvi stvarno poslati upit zadržao je krečenje u Novom Sadu do 30 km i dodao 3D figurice koje se izrađuju kod izvršioca pa šalju. AI i potpisani pregled su pokazali ON_SITE za krečenje i REMOTE za 3D. Prethodni tap preko tastature nije poslao poruku; broje se stvarni server pozivi, ne UI pokušaji. Završna potrošnja i naknadni scenariji navedeni su niže iz server evidencije.

### Provereni slučajevi pre instalacije novog APK-a

Zatečeni APK na ekranu O aplikaciji prijavljuje `2a6e7df82172f13ca37eb7e11d36142ef08fbe9e`, dirty, ugrađeni update `b458d8a9`, preview/runtime `uskoci-v1-preview-r1`. Sledeći rezultati zato dokazuju aktivan server i postojeći klijentski tok, ne novu native ispravku.

| Slučaj | Pročitana činjenica i ishod |
| --- | --- |
| Dodaj 3D izradu uz postojeće krečenje | Krečenje ON_SITE, 3D figurice REMOTE u istom potpisanom worker pregledu. |
| Ukloni samo krečenje | Ostaje 3D usluga, Novi Sad/30 km i 3D štampač; raspored nije izmišljen. |
| Ponedeljkom i sredom 16–20 | Serverski nacrt ima weekdays [1,3], 16:00–20:00, Europe/Belgrade, availableNow=false; isto piše na pregledu. |
| 3D figurice uz satnicu 1.200 | Upisani su broj ljudi=1, REMOTE, RS i REMOTE_ANYTIME. Nema lažnog ukupnog budžeta; traži se iznos za ceo posao. |
| Odgovor samo „5.000 ukupno, ostalo isto“ | Sastavljen naslov/opis iz ranijeg konteksta; 5.000 MY_PRICE, 1 osoba, REMOTE i fleksibilno vreme, bez ponovnog intervjua. |
| Iz pregleda: ponude i dve osobe | Isti razgovor, OFFERS i people=2 na kartici i pregledu, isti opis i način rada. |

Potpisani task review je READY/canAccept=true, REUSE_EXISTING, REMOTE, categoryId `d5e890a0-2502-4901-8803-7462b8ca6d24`, katalog 4. To dokazuje povezivanje postojeće kategorije; ne dokazuje nastanak nove grane ili isporuku push-a.

Pri promeni na ponude prethodni iznos ostaje u vlasničkoj istoriji/fact skupu, ali UI ne prikazuje cenu kao važeću. Pročitan aktivan `rpc_save_need_draft_from_review` izričito postavlja cenu na NULL kada mode nije MY_PRICE. U ovoj rundi nije pozvan Save/Publish da bi se tvrdio nov nastali javni zadatak.

## Dodatno otkrivena i primenjena korekcija dostupnosti

Stvarni mešoviti zahtev (grad/radijus ostaje, ponedeljak 18–20, sreda 16–20) na Worker v53 vratio je tekst da je promena uneta, ali candidate revision 10 je zadržao pravilo [1,3] 16–20. Ovaj pokušaj je **FAIL za semantiku promene**, iako je transport uspeo. Nije označen kao uspešan test. Sama SQL operacija `private.worker_ai_patch`, pozvana bez upisa, pravilno je razdvojila dane. Time je izolovan problem AI izlaza, a ne dokazana greška kalendarskog upisa.

Commit **11dc5e2fef291dde906cfb321ba68ac55bc49fba** dodaje obavezan provider-only `availabilityChange` (NONE/PATCH/CLARIFY + citat korisničke poruke), proveru da prijavljena izmena ima stvarnu kalendarsku operaciju i primer izmene jednog dana. Nema novog client ili SQL wire polja: namera se proverava i uklanja pre postojećeg RPC-ja. Nedostajuća operacija, nedokazano poreklo ili kontradikcija daju razjašnjenje uz očuvanje nezavisnih podataka. Nema automatskog drugog plaćenog poziva. Ovo je dodatna zaštita konzistentnosti, ne dokaz da je svaka prirodna rečenica pravilno protumačena.

Worker Edge **v54 ACTIVE**, svih 7 fajlova jednako pročitanom Git izvoru. [Receipt](../../supabase/operations/dev-alpha/ledger/20261019_worker_availability_edge.receipt.json). Prethodni kompletan v53 paket sačuvan za vraćanje. Ciljane Node Edge/alias/auth/stream provere: **155/155**, od toga worker handler 68/68. Nema SQL migracije.

| Naknadna stvarna proba | Rezultat |
| --- | --- |
| Cela Vojvodina + nova terenska montaža | AI otvoreno kaže da automatska regionalna pokrivenost nije podržana, traži grad/radijus i ne predstavlja region kao podešen matching. |
| Prekid mreže pri slanju | Tekst ostaje; unknown ishod ima „Proveri razgovor“. Pre ponovnog slanja kandidat/revision i broj turnova nisu promenjeni. Posle provere i povratka mreže jedno ponovno slanje pravi jedan novi turn. Vazdušni režim emulatora ima kratko zakašnjenje gašenja mreže; ovo je dokaz prekida/oporavka, ne merenje svih offline režima. |
| Posle v54: promeni samo ponedeljak na 18–20 | Candidate revision 11: ponedeljak [1] 18–20, sreda [3] 16–20; oba termina vidljiva na pregledu. |
| Posle v54: grad/radijus i remote ostaju; ponedeljak 19–20 | Candidate revision 12: ponedeljak 19–20, sreda 16–20, Novi Sad/30 km i dve usluge ostaju. |
| Pregled → jedna „Izmeni kroz razgovor“ | Na APK-u 0ca2b699 jedna akcija, isti razgovor i sačuvan neposlati testni tekst; nema slanja ili Save kao posledice navigacije. |

Završna evidencija: **10 stvarnih AI rezervacija, 2,50 USD rezervisanog budžeta, 0,133212 USD MEASURED obračunate potrošnje** unutar unapred ograničenih 12 poziva / 3 USD. Evidencija aplikacije nije račun dobavljača. Jedan pokušaj pre ispravke tastature i pokušaj tokom prekida mreže nisu dodatni provider pozivi. Sačuvani profil ima isti source hash; 0 Save zapisa ovog razgovora. Task conversation ostaje OPEN sa bound_need_id=NULL: nije napravljen/objavljen novi zadatak, nije slat push.

## Native paket i fizička provera

Prvi novi APK **0ca2b699**, CI **39199573841 SUCCESS**, artifact **12163987451**, SHA256 `e5667497170cb7c9838af653b6e5b22d09db877efd475b6ecfc675cf5fecd800`, instaliran `adb install -r` uz očuvanu prijavu. Hash instaliranog base.apk jednak je artifact hash-u. Šest kombinacija širine 361/390/412 dp × font 1,0/1,3 potvrđuje da input i slanje nisu prekriveni tastaturom. To je ograničeni native dokaz AI toka, ne svih ekrana.

Dopuna prikaza poruke **2df06add28d63ca7e4ddf7b07ba4eb025cd47160** ima TypeScript PASS i 228 ciljanih Jest testova PASS. CI **39202330027** ima **621 grupa / 13.873 test PASS**, bez padova/preskakanja. Build **SUCCESS**, novi APK instaliran uz očuvanu sesiju; lokalni i instalirani hash su `6a6e479a5b71f58575fb6bc08cfb02626f18b1282344b18e11dd7a57094d62d5`. Ekran O aplikaciji potvrđuje izvor 2df06add i runtime uskoci-v1-preview-r1, kanal preview, ugrađeni sadržaj 3c570fe9; ekran O aplikaciji prikazuje 2df06add (dirty). Ponovljena matrica 361/390/412 dp × font 1,0/1,3 ima 6/6 input/send kontrola iznad tastature, uz fizički pregled slika. Pri kucanju kartica više ne zauzima kraj razgovora. [Manifest](evidence/AI_CONVERSATION_NATIVE_20261019.json). Worker-only commit 11dc5e2f ne menja klijentski bundle iz 2df06add.

APK je **x86_64 za emulator, rs.uskoci.preview**, ne ARM64 paket za telefon. Production/store prihvatanje nije podignuto. U prebuild dokazu oba paketa postoji isključivo promena package.json Android/iOS skripti sa expo start na expo run; to objašnjava dirty oznaku buildIdentity, ne prikriva neproverenu izmenu aplikacijskog koda.

Na završnom APK-u ponovo je otvoren isti task razgovor i pregled: „Tražim ponude“, dve osobe, izrada kod izvođača i slanje na adresu u Srbiji. Olovka „Izmeni, Mesto“ i dalje postoji i ostaje otvorena AI-only migracija. Jedan warm deep-link ka O aplikaciji nije promenio ekran radnog razgovora; O aplikaciji je potom otvoreno redovnim putem kroz profil. Cold deep-link ka task razgovoru uspešno je vratio očekivani conversationId. To je zabeleženo opažanje za narednu navigacionu proveru, ne potvrda da sve push/deep-link putanje rade.

Emulator je vraćen na zatečena podešavanja 1264×2728, density 560, font 1,15 i isključen vazdušni režim. Neposlati testni tekst unosa je uklonjen; nema objave ili čuvanja profila kao posledice ove provere.


## Otvoreno — nije predstavljeno kao završeno

1. Regionalna pokrivenost (Vojvodina/cela Srbija/više oblasti) kroz AI → profil → matching/dispatch i sve tačke rute. Postojeći grad/radijus nije taj model.
2. Ponovljene smene i složeni termini. Ovaj paket čuva ostale odgovore i jasno traži podržan termin; ne dodaje novi serverski kalendar.
3. Preostala ručna potvrda načina rada u nepotvrđenom worker pregledu i obična polja u location toku zahtevaju posebnu migraciju na AI uz očuvanje ljudske potvrde mape i signed review ugovora.
4. Potpun tok dva naloga: objava → matching → isporučen push → ispravan deep-link → Dogovor → završetak.
5. Sažeci Home zadataka/Dogovora i nezavisno učitavanje osnovnih sekcija.
6. Novi povezani vizuelni talasi, grupni media/voice, strukturisano deljenje lokacije/kontakta, production/store priprema. Pri povratku posle prekida mreže zabeležen je i prolazan nedostupan profil pre uspešnog učitavanja, pa loading/recovery kompozicija zahteva dalji polish. Worker pregled još duplira dnevni raspored starim opisnim label-om posle deljenja dana; izvor dana/vremena je tačan, ali opis treba pojednostaviti u narednom UI talasu.
7. Provera i ciljane zakrpe zavisnosti pre release-a: `npm audit --omit=dev` prijavio je 40 pogođenih čvorova dependency grafa (1 critical/34 high/5 moderate), sa sedam osnovnih paketa/advisory grupa. To nije dokaz 40 ranjivosti dostupnih iz mobilne aplikacije: velik deo lanca pripada Metro/CLI/build alatima. `shell-quote` 1.10.0 i ostale prijavljene verzije postoje i u lockfile-u. Bez slepog `audit fix --force` — ponuđene promene uključuju vraćanje Expo/RN na stare glavne verzije. Potrebni su proverena dostižnost, kompatibilne zakrpe i zaseban clean build.

Lokalni `node_modules` je postojeći junction ka `USKOCI-CLEAN/node_modules`. Nije brisan niti prepisivan zajednički direktorijum. Repo/izvor je EAN na navedenoj grani; gore navedeni CI koristi čist checkout i `npm ci` iz aktuelnog lockfile-a, pa je on dokaz punog dependency/test preseka. Lokalnu izolaciju zavisnosti treba rešiti posebno, uz očuvanje drugih procesa koji koriste taj zajednički direktorijum.

## Konkretan sledeći UI tok

- **Razgovor:** jedan composer, poslednja korisna poruka, sažeta kartica nacrta. Sporedne napomene ne smeju potisnuti unos kada je tastatura otvorena. Dugo objašnjenje može da se skroluje; nova poruka ne otima poziciju čitanja.
- **Pregled zadatka:** naslov/opis i četiri odluke — budžet ili ponude, broj ljudi, termin, način/mesto rada. Jedna AI izmena i eksplicitna objava. Vlasnički identitet, pomoćni tekstovi i opcije treba da budu sekundarni; remote zadatak ne treba voditi kroz obrazac fizičke lokacije.
- **Radni profil:** odvojiti sačuvano od nacrta, prikazati svaku uslugu uz njen stvarno potvrđeni način rada. Područje samo gde je terenski relevantno; raspored čitljivim srpskim rečima; alat/vozilo samo kao dobrovoljnu informaciju.
- **Početna:** zadržati dve namere i jedan nalog; prednost dati sledećoj obavezi i radnji koja čeka korisnika. Ostale liste i brojila prikazati prema stvarnim podacima, bez izmišljenog matching-a.
- **Zadaci:** zadržati postojeći MapLibre/cluster/BottomSheet temelj, unaprediti kartice, filtere i kontinuitet mapa/lista. Postojeći paket već ima Reanimated, gesture-handler, BottomSheet i expo-image; nova biblioteka treba da rešava dokazani nedostatak.
- **Dogovor/čet:** uslovi i sledeća radnja ispred dodatnih detalja. Privatna lokacija/kontakt kroz svestan tok koji server zaista dozvoljava; ne obećavati opoziv starih tekstualnih poruka.

Ovo dopunjuje postojeće talase Premium White canona. Nije tvrdnja da su navedene kompozicije već implementirane u ovom APK-u.

Nastavak prati postojeći LIVE plan: prvo pouzdanost i jasnoća oba AI toka, zatim globalni sistem/Početna, Zadaci, prijave, Dogovori/čet i profil. Nema novog paralelnog glavnog plana niti tvrdnje da je ceo proizvod prihvaćen.




## Nastavak: detaljne lokacije i vođenje razgovora (19.10, 05:44 UTC)

Polazni HEAD 0dc4a853. Izvor AI paketa 97c3f86b, korekcija typed-context testa 85497a1a, klijentski prikaz odgovora a73a78f4. Jedan povezani nastavak postojećeg plana.

### Stvarne probe i otkrivene greške

- Task v100 je iz „prevoz stola“ predložio jednu osobu; iz „Iz centra. Sutra bilo kada.“ uz odredište Zemun/Beograd izveo je i polazište Beograd. To su semantički FAIL nalazi. Posle v101 isti niz pita iz centra kog grada; nema people činjenice pre izričitog korisničkog odgovora. Sutra/odredište ostaju.
- Novi Sad/Spens → Gardoš/Zemun, jedna osoba, ponude: fact struktura POINT_TO_POINT ispravna. Naknadna promena samo polazišta na Petrovaradinsku tvrđavu u prvoj probi čuva odredište. Guard sada dopunjuje pojedinačne start/waypoint/end tačke i ne preskače nepotvrđenu mapu pri REVIEW odgovoru.
- „Zašto mapa?“: v101 objašnjava proveru mesta i približan javni prikaz; to nije potvrda pune route matching pokrivenosti. Direktan odgovor je sačuvan na serveru. U APK 2df06add bio je sakriven jer se CONTINUE pogrešno držao iza all-point confirmation gate-a. a73a78f4 prikazuje CONTINUE odmah, mapu pre naknadnog odgovora bez novih činjenica, i daje eksplicitan povratak na mapu. Nema automatske potvrde.
- Worker: online/teren za pomoć oko računara; cela Vojvodina iskreno odbijena kao nepodržan automatski region, ponuđen grad/radijus. Novi Sad/30 km; zatim samo grad Beograd uz očuvan radijus 30 i ostale podatke. Prompt v55 uklanja konfliktno nuđenje celog regiona i razlikuje administrativni grad, područje dolaska i online rad.
- Posle „računari samo online, 3D kod mene uz slanje“ hint snapshot revizije 5 ima obe usluge REMOTE, ali signed review ostaje PENDING_CLASSIFICATION. To NIJE uspeh end-to-end povezivanja. Običan candidate ne sadrži autoritativne per-service mode činjenice; hint nije saglasnost.
- „Novi razgovor“ radnika je na starom APK-u napustio server razgovor, ali retained route ref držao isti CID pa je ekran ostao završen bez unosa. Eksplicitni entryKey resetuje ref i komponentu; obična promena teme čuva CID i neposlat tekst.

### DEV primena i preostali klasifikacioni problem

Task **v101 ACTIVE**, Worker **v55 ACTIVE**, 9/9 i 7/7 fajlova jednako Git97c3f86b nakon LF normalizacije. [Edge receipt](../../supabase/operations/dev-alpha/ledger/20261019_ai_location_guidance_edge.receipt.json). Prethodni kompletni v100/v54 paketi su sačuvani za vraćanje.

U običnom AI-only pregledu `rpc_prepare_worker_ai_review_taxonomy` bio je vezan `taxonomy_review_exact_projection_v1`, iako potvrđeni ručni put već koristi candidate planner. Migracija **20261019061858_worker_ai_review_candidate_projection** vodi trenutne vlasničke predloge kroz postojeći `taxonomy_review_candidate_projection_v2`, uz REUSE_ALIAS/CREATE_NEW_BRANCH u proverenom skupu akcija. Predecessor md5 c0f07a6cfac8c55ac05267b09998d5d8; readback c489c2e2ac2105e4fa0c4c3ac15a6243; obrnuta zamena tačno vraća predecessor digest. Anon execute=false, authenticated=true; owner check, postojeći 3D REMOTE i nepromenjena procena rizika prošli SQL postflight. Katalog ostao4/135 kategorija u trenutku primene. [Receipt](../../supabase/operations/dev-alpha/ledger/20261019_worker_review_candidate_application.receipt.json).

Ova veza sama nije rešila primer „Pomoć oko računara“: i candidate helper vraća PENDING_CLASSIFICATION, jer `taxonomy_risk_triage_v1` traži početni normalizovani action sa serverske liste. „Pomoć“ i „instalacija“ nisu na listi. Nema alias kolizije; roditelj Digitalne usluge ima oba režima. To je potvrđen preostali ugovor AI → klasifikacija, ne razlog da se globalno isključe zaštite. Sledeći rad mora da doda konkretno, razumljivo razjašnjenje i uskladi imenovanje/politiku bez prisiljavanja korisnika da zna tehničke reči. Nije dokazana nova grana/Save/dispatch ovim testom.

### Provere i računanje potrošnje

258 Node testova PASS; prvobitna dva Jest paketa/94 PASS; typed map test28 PASS; naknadna tri paketa/240 PASS za prikaz i redosled. Ciljane grupe se preklapaju. TypeScript PASS. Puna regresija za a73a78f4, run39208880951, artifact12166823075: **621/621 grupa, 13.877/13.877 testova, bez preskočenih**. Prvi run39207389350 imao jedan pad (boolean umesto LocationContext u testu), očuvan kao istorija. Posredni run39208215486 otkazan posle regresije da se ne isporuči APK bez naknadno otkrivene ispravke vidljivosti odgovora.

**16 sopstvenih provider poziva**, 4 USD rezervacija, **0,226792 USD MEASURED**, 0 nepoznatih ishoda; nije račun dobavljača. Izolovano po konkretnim clientRequestId, ne ukupnim aktivnostima naloga. Nema Save profila, task Publish ili push poziva koje je izvršio agent. Nacrti c4bbf412… i 4661848f… imaju bound_need_id=NULL.

### Paralelno korišćenje naloga

Worker dokaz završava se revizijom5. U 06:19:41 UTC pojavile su se dodatne glasovne poruke koje agent nije poslao; od 06:21:16 postoji tuđi Save istog razgovora. Pre toga source hash je potvrđivao nepromenjen sačuvani profil. Posle toga nema smisla tvrditi da je ceo nalog ostao nepromenjen. Tuđi novi nacrt nije napušten niti prepisan. Neuspešan pokušaj otvaranja pregleda revizije5 vratio je STALE kada je drugi akter već napravio reviziju7; to je zaštita od konflikta, a poruka „Profil je promenjen“ je preširoka jer može biti promenjen sam nacrt.

### Native status

APK a73a78f4, run 39208880951, instaliran -r; base.apk SHA256 788a96379ad3abd0c60375f07e6c20a5048a24bb1995c7fe4bdf33c25537ceca jednak artifact-u. Native rezultati: PASS: task explanation readable before map confirmation, explicit return to map, 361/390/412 dp at font 1.0/1.3; closed worker conversation resumes current draft rather than retaining abandoned ID. No claim that active draft restart or a fresh writable worker conversation was tested..

[Manifest](evidence/AI_LOCATION_GUIDANCE_20261019.json) odvaja potvrđen server, CI, APK, instalaciju i fizičke provere. Stara radnička konverzacija koju je drugi akter nastavio nije restartovana radi testa. Telefon, ceo UI i release nisu prihvaćeni.

### Sledeći prioriteti

1. AI → klasifikacija → signed review readiness: konkretni nazivi, svi načini po usluzi, jasna prepreka u razgovoru pre Save.
2. Preostali AI-only location editor, kraći geocoder tekst, statusi pojedinačnih tačaka; sačuvati ljudsku potvrdu i privatnost.
3. Region/cela država/više područja i sve tačke rute kroz matching/dispatch; dve izolovane testne osobe i stvarni push.
4. Povezani Premium White talasi; ova dopuna ne predstavlja kompletnu preradu izgleda.

Vlasnik je naknadno potvrdio da sam isprobava na telefonu. Emulator je korišćen za nezavisnu native proveru; njegov aktivni razgovor nije napuštan niti menjan. Proba entryKey obuhvatila je samo već ABANDONED razgovor → nastavak aktuelnog nacrta, koji je u tom trenutku imao zaštitnu blokadu iz vlasnikove probe. Nije proglašeno da je provereno napuštanje OPEN razgovora niti nov writable nacrt.
