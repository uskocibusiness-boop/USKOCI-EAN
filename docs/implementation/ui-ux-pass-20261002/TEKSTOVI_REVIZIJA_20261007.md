# USKOČI — revizija tekstova (copy audit), 7.10.2026

Čitano je samo; ništa u aplikaciji, na serveru, DEV-u, telefonu ni emulatoru nije menjano. Ovo je predlog, ne odobrenje: serverski deo traži vlasnikovo „PRIMENI <ime>“ (Edge: i CLI deploy). Mašinski spisak istih predloga: `TEKSTOVI_PREDLOZI_20261007.json` u istom folderu (637 stavki; svaka ima `file`, `line`, `current`, `proposed`, `reason`, `priority`, `kind`, a uz to `category`, `screen`, `mode`). Putanje su relativne u odnosu na `USKOCI-CLEAN-spoj-20261006`. `mode`: `zameni` (zamena teksta u tom fajlu), `nova-migracija` (fajl je već primenjena SQL migracija: menja se novom migracijom, ne ovim fajlom), `rucno` (predlog je uputstvo, ne tekst). `category`: ROD, POSAO, VELIKO, DUGME, GRESKA, PRAZNO, ZARGON, NEDOSLEDNO, DUGO, MNOZINA, TEHNICKO, ULOGA, GLAS, VREME, PRISTUP, CENA, EYEBROW, OSTALO.

## 0. Šta je pregledano

- **Izvor:** integracioni checkout, grana `integration/spoj-20261006`, HEAD `2c41ff8c` plus nezakačeno radno stablo (oko 420 izmenjenih fajlova; stanje u 23:49, 7.10.). Linije u JSON-u su iz tog čitanja; `current` je proveren slovo po slovo na liniji (u snimku i u živom checkoutu); ponovljena provera u 00:38, kad je HEAD već bio `f77300b2`: svih 637 i dalje stoji na istoj liniji. Drugi agenti rade u istom checkoutu, pa pri primeni menjati zamenom `current` → `proposed`, ne po broju linije.
- **Obim:** 587 fajlova pod `src/**` (bez `__tests__` i `app/dizajn-*`), oko 6.200 tekstualnih literala izdvojenih iz sintaksnog stabla (stringovi, JSX tekst, pristupačne oznake, poruke servisnog sloja `src/data`), svi pročitani; provera pokrivenosti: nijedan red sa dijakriticima u navodnicima ili JSX tekstu nije preskočen osim komentara. Server: `supabase/functions/**`, 152 migracije i 117 kandidata u `supabase/candidates` (SQL stringovi), `private.notification_copy_v5` (PKG-027c). Slike sa vlasnikovog telefona (Početna, Zadaci, Dogovori, Poruke, Profil, Raspored, Obaveštenja, O aplikaciji, Privatnost, Izvoz, Pregled): 11.
- **Važan nalaz:** klijentski tekst je već blizu pravila. Plan 2.17 je u kodu većim delom izvršen: nema „Šaljem…“ (131 oblik „mi“, 0 prvog lica jednine), „Probaj“ je ostalo samo u 3 rečenice (dugmad su „Pokušaj ponovo“), nema eyebrow-a na prijavi, nema „da bi snimio“, „Već si se prijavio“, „koje si isključio“, „Pokušaj se ipak računa“, nema reči „server“, „Naručilac“ ni „Uskočer“ u klijentskom tekstu. **Hard-rule problemi su zato gotovo svi serverski** (14 P0, od toga 13 sa servera). Ono što preostaje u klijentu je (a) interni jezik („ishod“, „nije potvrđeno“, „aktuelno“, „sačuvano stanje“, „zahtev“): 352 teksta, od toga 105 u servisnom sloju i 36 dugmadi, (b) 224 poruke bez izlaza, (c) nedoslednost naziva za iste pojmove.

## 1. Pregled problema po vrsti

„Pogodaka“ = broj mesta u kodu koja odgovaraju vrsti; „predloga“ = stavki u JSON-u. Ukupno 637 predloga u 175 fajlova: P0 14, P1 165, P2 458; klijentskih 609, serverskih 28.

| Vrsta | Pogodaka | Najvažniji primer | Ocena |
|---|---|---|---|
| Gramatički rod | 4 | push „Izabran si“ (server + klijentska lista); „Odgovorio vlasnik zadatka“ (`TaskQaInline.tsx:86`); „Onaj ko je objavio zadatak zatvorio je potragu“ (server) | skoro rešeno; ostaje server |
| Reč „posao“ / „Potreba“ / „prilika“ | posao 14 (push 1, klijentska lista 1, poruke asistenta 7, uputstvo modelu 5); Potreba 1; prilika 4 u klijentu + 2 u serverskim tekstovima | „Kada se posao završava?“ (asistent, `uskoci-ai-interview/index.ts:657`); „Druga strana je označila posao kao završen“ (push) | P0 (server) |
| Veliko slovo usred rečenice | 7 (klijent 4, server 3) + uputstvo modelu | „Imaš novu prijavu za Zadatak.“ (vlasnikov telefon, p40); „Još nemaš Zadatak“ (`HomePresentation.tsx:206`) | P0 |
| Dugme bez glagola ili predmeta | 21 dugme od jedne reči (Povuci, Učitaj, Zameni, Odbaci, Ukloni, Izaberi, Kopiraj, Prijavi…); 36 dugmadi „Proveri ishod / Učitaj sačuvano stanje / Osveži stanje / Prikaži aktuelno stanje…“ | „Povuci“ (potvrda povlačenja prijave), „Učitaj“, „Koristi gde sam“ | P1 |
| Greška bez izlaza | 224 kratke poruke „X nije dostupno/učitano/pronađeno“ bez radnje u istoj rečenici (93 u `src/data`; neke imaju dugme ispod); „Greška.“ kao rezervna poruka (2) | „Dogovor nije dostupan.“ (11 puta) | P2, rezervna poruka P1 |
| Prazno stanje bez prave radnje | 4 (+ „Naslov bez poruke“: „Zdravo.“, „Pomoć počinje dogovorom.“) | „Zadaci“: samo „Osveži zadatke“, bez „Objavi zadatak“; „Još nema fotografija“ | P1/P2 |
| Žargon / interni jezik | 352 teksta (105 u `src/data`): „ishod“ 81 · „nije potvrđen/-a“ 132 · „aktuelan“ 60 · „sačuvano stanje/sačuvani zahtev“ 33 · „zahtev“ u značenju koje osoba ne koristi 86 · „prvobitni/ponavljanje/isti zahtev“ 30 (preklapaju se) | „Odgovor je otkazan i podaci su ostali nepromenjeni. Poruka se ipak računa kao poslata, jer je obrada već bila počela.“ | P1 (glavni posao klijentske revizije) |
| Nedoslednost istog pojma | 637 predloga ukupno, 112 u ovoj vrsti, 26 pojmova u rečniku (odeljak 4) | „Dogovor kreiran/sklopljen/napravljen“; „ponuda/prijava“ za isti predmet; „Budžet“ i „Cena“; „kalendar“ i „Raspored“ | P1 |
| Predugi redovi | 8 teksta preko 170 znakova; obaveštenje o glasu (5 rečenica) | `useHoldToTalk.ts:17`, `ClosurePresentation.tsx:206-207` | P2 (pravni tekstovi: vlasnik) |
| Pogrešna množina / slaganje | 3 mesta | „2 od 4 mesta je slobodno“ → „su slobodna“ | P2 |
| Tehnički tekst koji osoba vidi | 10 (+ „pin“ 11) | „USKOČI · 1.0.0 · 2c41ff8 *“ (`BuildIdentity.tsx:24`); „test verzija“; „ISO vreme sa zonom“; „navodnike i zagrade“; „dežurnog operatera“ | P1 |
| Reč „server“ | 0 u korisničkom tekstu (2 u Edge porukama koje klijent ne prikazuje) | — | čisto |
| Nazivi uloga | „Naručilac/Uskočer“ 0 u klijentu (11 u starim SQL tekstovima, svi pokriveni mapom PKG-027c); „radnik/vlasnik/autor“ 11 | „Radnik je javio da je zadatak gotov“ | P1/P2 |
| Glas („ti“, „mi“) | 3 ostatka oblika „vi“ (+1 par u listi push tekstova) | „Dogovorite se“ (`HowItWorks.tsx:23`) | P2 |
| Vreme | 1 | „05. okt“ umesto „5. okt“ (vodeća nula, p40/p53) | P2 |
| Pristupačne oznake | 2 neusklađene sa vidljivim tekstom; 0 engleskih | „Nađi zadatak blizu“ naspram „Pronađi zadatak.“ | P2 |
| Eyebrow / rečenice „gde si“ | 3 | „Jedan nalog, obe mogućnosti“ (O aplikaciji); „Bezbednost“ uvod | P1 |
| Cena | 2 | „Iznos nije sačuvan“ naspram „Cena nije navedena“ | P2 |

## 2. Deset najvažnijih izmena

1. **Push bez roda i bez „posao“** (28 serverskih stavki ukupno): „Izabran si“ → „Tvoja prijava je izabrana“; „označila posao“ → „Zadatak je označen kao gotov“; „Oporavak naloga“ za prijavljen problem → „Prijavljen je problem u Dogovoru“. Klijentska lista (`publicInboxCopy.ts`) već prihvata nove parove (PLANNED); preostaje Edge `pushNotificationCopy.mjs`. Serverski.
2. **Tri obaveštenja u aplikaciji sa „Zadatak“ velikim slovom** (vlasnikov telefon, p40): „Imaš novu prijavu za Zadatak.“, „Stiglo je anonimno pitanje o Zadatku.“, „Jedna prijava za tvoj Zadatak je povučena.“ Nova mala migracija (red u `private.notification_copy_v5` + prepis sačuvanih redova), bez pomeranja sertifikata. Serverski.
3. **Pitanja asistenta kažu „posao“** (7 rečenica) i uputstvo modelu kaže „Zadatka“/„posao“; model ih preuzima. Edge `uskoci-ai-interview/index.ts`. Serverski.
4. **Jedan jezik za „ne znamo da li je uspelo“:** „Ne znamo da li je [radnja] uspela. [Osveži / Proveri].“ umesto „ishod nije potvrđen, proveri sačuvano stanje“ (352 teksta) i jedno dugme „Proveri da li je poslato“ / „Osveži“ umesto 36 varijanti. Klijentski.
5. **Prvi ekran prijave:** naslov „Zdravo.“ ne kaže ništa; tri naziva za oporavak lozinke („Oporavak pristupa“, „Vrati pristup nalogu“, „Oporavak naloga“); poruke „Zahtev … je prihvaćen“ → „Poslali smo ti kod/link“. Klijentski.
6. **„Prijava“ ima tri značenja** (prijava na zadatak, prijavljen problem u Dogovoru, prijavljivanje na nalog) i u toku prijave se naizmenično zove „ponuda“. Razdvojiti: prijava = ceo predmet, ponuda = samo cena; „prijavljen problem“ uvek sa imenicom. Klijentski, uz vlasnikovu odluku.
7. **Poruke bez izlaza i „Greška.“** (rezervna poruka za svaku neprepoznatu grešku u `supabaseIzvor.ts`): svaka dobija radnju („Osveži“, „Vrati se na…“). Klijentski.
8. **Neaktivno glavno dugme** „Potvrdi izmene i objavi“ sa sivom rečenicom „Prvo reši ono što još treba.“ (p53) → „Prvo uradi ono što piše pod „Još treba“.“ Klijentski.
9. **Dogovor:** „Dogovor kreiran“ → „Dogovor je sklopljen“; „Termin nije potvrđen“ → „Termin nije dogovoren“ (zvuči kao da čeka nečiju potvrdu); „Dogovoreno/Završeno/Otkazano“ → „Dogovoren/Završen/Otkazan“ (rod). Klijentski.
10. **Jedan naziv po pojmu:** Raspored (ne kalendar), cena (ne budžet), mesto (ne „lokacija“/„pin“), osoba (ne vlasnik/radnik/autor), lista (ne spisak), „Pokušaj ponovo“, „Obaveštenja → Moji zadaci“ (kartica se danas zove „Zadaci“ kao donja traka). Klijentski.

## 3. Predlozi (ekran · fajl:red · sadašnji tekst · predlog · razlog · prioritet)

Svih 637 je u JSON-u. Ovde: svih 14 P0 i 45 najvažnijih P1. Tekst u tabeli je skraćen; tačan je u JSON-u. Kolona „predlog“ u zagradi znači ručnu izmenu (nije zamena teksta).

### P0

| Ekran | Fajl:red | Sadašnje | Predlog | Razlog | P |
|---|---|---|---|---|---|
| Početna | `src/ui/home/HomePresentation.tsx:206` | Još nemaš Zadatak | Još nemaš zadatak | „zadatak“ se piše malim slovom usred rečenice (vlasnikovo pravilo); jedini ovakav slučaj među… | P0 |
| Obaveštenja (spisak) | `supabase/candidates/pkg027c_notification_ti_copy.sql:66` (nova migracija) | then 'Imaš novu prijavu za Zadatak.' | then 'Imaš novu prijavu za zadatak.' | Vlasnikov telefon (p40_notifications): „Imaš novu prijavu za Zadatak.“ s velikim Z usred rečenice. | P0 |
| Obaveštenja (spisak) | `supabase/candidates/pkg027c_notification_ti_copy.sql:78` (nova migracija) | then 'Stiglo je anonimno pitanje o Zadatku.' | then 'Stiglo je anonimno pitanje o zadatku.' | Veliko Z usred rečenice. | P0 |
| Obaveštenja (spisak) | `supabase/candidates/pkg027c_notification_ti_copy.sql:84` (nova migracija) | then 'Jedna prijava za tvoj Zadatak je povučena.' | then 'Jedna prijava za tvoj zadatak je povučena.' | Veliko Z usred rečenice; tekst nastaje u dve varijante (i „Prijava za tvoj zadatak je povučena.“ u… | P0 |
| Push obaveštenje (zaključan ekran) | `supabase/functions/_shared/pushNotificationCopy.mjs:10` (Edge) | ['Izabran si', 'Tvoja prijava je prihvaćena. Otvori Dogovor.'] | ['Tvoja prijava je izabrana', 'Otvori Dogovor.'] | „Izabran si“ je muški rod (vlasnikovo pravilo: bez roda). | P0 |
| Push obaveštenje (zaključan ekran) | `supabase/functions/_shared/pushNotificationCopy.mjs:22` (Edge) | ['Potvrdi završetak', 'Druga strana je označila posao kao završen.'] | ['Potvrdi završetak', 'Zadatak je označen kao gotov.'] | Zabranjena reč „posao“ na zaključanom ekranu. | P0 |
| Push obaveštenje (zaključan ekran) | `supabase/functions/_shared/pushNotificationCopy.mjs:25` (Edge) | ['Oporavak naloga', 'Otvoren je postupak oporavka naloga.'] | ['Prijavljen je problem u Dogovoru', 'Otvori Dogovor da vidiš prijavljeni problem.'] | Za prijavljen problem u Dogovoru push kaže „Oporavak naloga“ (pogrešan predmet, plan 1.12). | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:600` (Edge) | Za drugi posao izaberi Novi zadatak u opcijama razgovora. Ovaj razgovor čuva prethodni zadatak. | Za drugi zadatak izaberi „Novi zadatak“ u opcijama razgovora. Ovaj razgovor čuva prethodni zadatak. | Odgovor asistenta koji osoba vidi u razgovoru; zabranjena reč „posao“. | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:603` (Edge) | Koji iznos želiš za ceo posao, uz napomenu da li je ukupno ili po osobi? Dnevnica ili satnica još nije cena… | Koji iznos želiš za ceo zadatak, ukupno ili po osobi? Dnevnica ili satnica još nije cena celog zadatka. | „posao“ → „zadatak“; kraća rečenica. | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:640` (Edge) | Koji je tačan datum početka posla? | Koji je tačan datum početka zadatka? | „posao“ → „zadatak“. | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:655` (Edge) | Koju cenu nudiš za ceo posao? | Koju cenu nudiš za ceo zadatak? | „posao“ → „zadatak“. | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:656` (Edge) | Da li je navedena cena ukupno za ceo posao ili po osobi? | Da li je navedena cena ukupno za ceo zadatak ili po osobi? | „posao“ → „zadatak“. | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:657` (Edge) | Kog datuma i u koliko sati posao počinje? | Kog datuma i u koliko sati zadatak počinje? | „posao“ → „zadatak“. | P0 |
| Razgovor sa asistentom | `supabase/functions/uskoci-ai-interview/index.ts:657` (Edge) | Kada se posao završava? | Kada se zadatak završava? | „posao“ → „zadatak“. | P0 |

### P1 (izbor)

| Ekran | Fajl:red | Sadašnje | Predlog | Razlog | P |
|---|---|---|---|---|---|
| Prijava i registracija | `src/app/auth.tsx:302` | 'Zdravo.' | 'Prijavi se ili napravi nalog' | Naslov prvog koraka ne kaže ništa i isti je za prijavu i za registraciju; nova osoba ne zna šta treba da… | P1 |
| Prijava i registracija | `src/app/auth.tsx:204` | Zahtev trenutno nije uspeo. Pokušaj ponovo. | Nešto nije uspelo. Pokušaj ponovo. | „zahtev“ je tehnička reč; prvo što nova osoba vidi kad nešto pođe naopako. | P1 |
| Oporavak lozinke | `src/app/auth.tsx:311` | Zahtev za oporavak je prihvaćen. | Ako nalog postoji, poslali smo ti link za novu lozinku. | Isto; usklađeno sa tekstom na liniji 546. | P1 |
| Oporavak lozinke | `src/app/auth.tsx:298` | 'Vrati pristup nalogu.' | 'Oporavak lozinke' | Tri naziva za istu funkciju: „Oporavak pristupa“ (zaglavlje, 326), „Vrati pristup nalogu“ (naslov),… | P1 |
| Pregled zadatka pred objavu (neaktivno dugme) | `src/app/(app)/pregled-zadatka.tsx:438` | Prvo reši ono što još treba. | Prvo uradi ono što piše pod „Još treba“. | Siva rečenica ispod neaktivnog dugmeta „Potvrdi izmene i objavi“ (vlasnikov telefon, p53_review) mora da… | P1 |
| Pregled zadatka pred objavu | `src/app/(app)/pregled-zadatka.tsx:427` | Objava još nije potvrđena. Proveri ishod pre novog pokušaja. | Ne znamo da li je zadatak objavljen. Proveri to pre novog pokušaja. | „ishod“ je interni izraz; kaže šta se ne zna. | P1 |
| Pregled zadatka pred objavu | `src/app/(app)/pregled-zadatka.tsx:570` | U ovom pregledu je ostao uslov koji aplikacija ne može da proveri. Ukloni ga izričito da nastaviš običnim zadatkom. | Ovaj zadatak traži uslov koji aplikacija ne može da proveri. Ukloni uslov da bi zadatak mogao da se objavi. | „izričito“ i „običnim zadatkom“ su interni izrazi. | P1 |
| Razgovor sa asistentom | `src/app/(app)/nova.tsx:401` | Odgovor je otkazan i podaci su ostali nepromenjeni. Poruka se ipak računa kao poslata, jer je obrada već bila počela. | Odgovor je zaustavljen. Poruka je ipak poslata jer je asistent već počeo da je obrađuje; zadatak je ostao isti. | Najteža rečenica u razgovoru: „podaci“, „računa kao poslata“, „obrada“. | P1 |
| Razgovor sa asistentom | `src/data/aiNeedV2Production.ts:50` | Zahtevi su trenutno ograničeni. Proveri ishod pre ponovnog pokušaja. | Šalješ previše poruka u kratkom roku. Sačekaj trenutak pa pokušaj ponovo. | Najčešća greška u razgovoru sa asistentom; trenutni tekst ne kaže šta se desilo ni šta da se uradi. | P1 |
| Pregled zadatka pred objavu | `src/data/aiNeedV2Ui.ts:323` | Provera identiteta nije dostupna u ovoj test verziji. Izaberi „Ne“ da nastaviš bez tog uslova. | Provera identiteta još nije dostupna. Izaberi „Ne“ da nastaviš bez tog uslova. | Osoba ne treba da vidi „test verzija“. | P1 |
| Pregled zadatka pred objavu | `src/data/aiNeedV2Ui.ts:356` | Termin unesi kao GGGG-MM-DD HH:MM ili kao ISO vreme sa zonom. | Upiši termin kao 2026-10-12 14:30. | „ISO vreme sa zonom“ je tehnički izraz; jedan primer je dovoljan. | P1 |
| Prijava na zadatak | `src/app/(app)/prilike/[id]/prijava.tsx:17` | Sačuvani zahtev prijave mora prvo da se proveri. Izaberi Proveri ishod. | Prvo proveri da li je prethodna prijava poslata. Izaberi „Proveri da li je poslata“. | Dugme se zove isto kao u poruci; „zahtev prijave“ je interni izraz. | P1 |
| Prijava na zadatak | `src/ui/v2/ApplicationComposerPresentation.tsx:316` | Pregledaj ponudu | Pregledaj prijavu | Jedan predmet, dva imena: ekran se zove „Tvoja prijava“, a dugmad naizmenično kažu „ponudu“ i „prijavu“… | P1 |
| Moje prijave | `src/app/(app)/moje-prijave.tsx:64` | Ishod radnje nije potvrđen. Proveri sačuvano stanje pre ponavljanja. | Ne znamo da li je radnja uspela. Osveži listu pa pokušaj ponovo. | „ishod“, „sačuvano stanje“, „ponavljanje“ su interni izrazi; ljudski: ne znamo da li je uspelo. | P1 |
| Moje prijave (potvrda povlačenja) | `src/app/(app)/moje-prijave.tsx:244` | Povuci | Povuci prijavu | Dugme u dijalogu mora da kaže šta radi (glagol + predmet); danas samo „Povuci“. | P1 |
| Kandidati za zadatak | `src/app/(app)/potrebe/[id]/kandidati.tsx:214` | Ponuda je otvorena, ali nije označena kao viđena. Zatvori je i otvori ponovo. | Ponuda je otvorena, ali nismo zabeležili da je pogledana. Zatvori je i otvori ponovo. | „oznaka viđenosti“ je interni pojam (plan 2.17). | P1 |
| Moj zadatak | `src/app/(app)/potrebe/[id]/pregled.tsx:216` | Potraga nije potvrđeno zatvorena. Učitaj trenutno stanje. | Ne znamo da li je potraga zatvorena. Osveži zadatak. | Gramatika: „nije potvrđeno zatvorena“ je pogrešno; i „potraga“ ostaje kao pojam, ali rečenica treba da kaže… | P1 |
| Moj zadatak | `src/app/(app)/potrebe/[id]/pregled.tsx:247` | Izmene pregledaš pre objave. Prihvatanje izmena ponovo pokreće proveru za objavu i postojeće prijave tada moraju da se… | Izmene prvo pregledaš pa objaviš. Posle objave se postojeće prijave ponovo proveravaju. | Prva verzija je prekomplikovana; kaže istu činjenicu. | P1 |
| Dogovor | `src/app/dogovor/[id].tsx:469` | Prijava je tvoja. | Problem je prijavljen sa tvog naloga. | „Prijava je tvoja“ se meša sa „Tvoja prijava“ (prijava na zadatak, linija 567); „prijavljen problem“ je jasno. | P1 |
| Dogovor | `src/app/dogovor/[id].tsx:474` | Prijava sama ne određuje krivicu ili dug. | Prijavljeni problem sam po sebi ne određuje krivicu ili dug. | „Prijava“ znači prijavljen problem; ista rečenica i na liniji 480. | P1 |
| Dogovor | `src/app/dogovor/[id].tsx:332` | Prijava nije potvrđena. Proveri status Dogovora pre ponovnog pokušaja. | Ne znamo da li je problem prijavljen. Osveži Dogovor pa pokušaj ponovo. | „Prijava“ ovde znači prijavljen problem, a „nije potvrđena“ je interni izraz; kaže šta se ne zna. | P1 |
| Dogovor (tok Dogovora) | `src/data/agreementClientService.ts:128` | Dogovor kreiran | Dogovor je sklopljen | „kreiran“ je kalk i bez pomoćnog glagola; na ostalim mestima je „sklopljen“… | P1 |
| Dogovor | `src/data/agreementClientService.ts:364` | Radnik je javio da je zadatak gotov. Potvrdi završetak ili prijavi problem. | Druga strana je javila da je zadatak gotov. Potvrdi završetak ili prijavi problem. | Ostatak aplikacije kaže „druga strana“ (Dogovor) i „osoba koja je objavila zadatak“; „radnik“ je treći naziv… | P1 |
| Dogovor | `src/data/agreementClientService.ts:360` | Termin se preklapa sa potvrđenim Dogovorom. Osveži kalendar. | Termin se preklapa sa drugim Dogovorom. Proveri Raspored. | Funkcija se zove „Raspored“, ne „kalendar“ (vlasnikova odluka 7.10.). | P1 |
| Dogovor (izmena i otkazivanje) | `src/ui/agreements/AgreementActionsPresentation.tsx:267` | Sadržaj prethodnog zahteva nije sačuvan na uređaju. Ponovo unesi iste podatke iz tog pokušaja i isti razlog. Provera… | Prethodni unos nije sačuvan na telefonu. Unesi iste podatke i isti razlog kao prvi put da bismo proverili da li je već stiglo. | Najteži tekst u Dogovoru: „sadržaj zahteva“, „potpuno isti zahtev“. | P1 |
| Dogovori | `src/ui/v2/AgreementPresentation.tsx:42` | Termin nije potvrđen | Termin nije dogovoren | „nije potvrđen“ zvuči kao da čeka nečiju potvrdu; zapravo termin nije dogovoren (fleksibilan Dogovor). | P1 |
| Obaveštenja | `src/ui/notifications/inboxCopy.ts:65` | REQUESTER: 'Zadaci' | REQUESTER: 'Moji zadaci' | Kartica „Zadaci“ u obaveštenjima (vlasnikov telefon, p40_notifications) znači „moji zadaci“, a donja traka… | P1 |
| Podešavanja obaveštenja | `src/ui/notifications/PushPreferences.tsx:225` | Stanje nije potvrđeno. Proveri ga pre ponovnog pokušaja. | Ne možemo da učitamo podešavanja. Pokušaj ponovo. | Prvo što osoba vidi kad podešavanja ne stignu; trenutni tekst ne kaže šta se desilo. | P1 |
| Detalj zadatka (pitanja) | `src/ui/qa/TaskQaInline.tsx:86` | Odgovorio vlasnik zadatka | Odgovor osobe koja je objavila zadatak | „Odgovorio“ je muški rod; „vlasnik“ je drugi naziv uloge. | P1 |
| Pregled zadatka pred objavu | `src/ui/objava/reviewFacts.ts:156` | Podrška još nema dežurnog operatera, pa je najbrže da ga izmeniš i ponovo pošalješ. | Najbrže je da zadatak izmeniš i ponovo pošalješ. | Osoba ne treba da čuje da „podrška nema dežurnog operatera“ (interni podatak o poslovanju); samo šta da uradi. | P1 |
| Dogovor (otkazivanje) | `src/data/supabaseIzvor.ts:448` | 'Greška.' | 'Radnja nije uspela. Pokušaj ponovo.' | Poruka koju osoba vidi kad server odgovori neočekivano; „Greška.“ ne kaže šta se desilo ni šta da uradi. | P1 |
| Zadaci (kartica zadatka) | `src/ui/v2/TaskCard.tsx:93` | Otvori priliku | Otvori zadatak | „prilika“ je stari naziv za zadatak; na svim ostalim mestima piše „zadatak“. | P1 |
| Moj zadatak | `src/ui/v2/NeedPresentation.tsx:208` | Budžet: | Cena: | Svuda drugde je „cena“; „budžet“ je drugi naziv istog (TaskDecision.tsx:34 isto). | P1 |
| Moji zadaci (prazno stanje) | `src/ui/v2/MarketplacePresentation.tsx:159` | Napravi prvi zadatak | Objavi prvi zadatak | Glavno dugme na Početnoj je „Objavi zadatak“; „Napravi“ je drugi glagol za istu radnju (isto u liniji 159… | P1 |
| Moji zadaci / Zadaci (filteri) | `src/ui/v2/MarketplacePresentation.tsx:154` | Obriši uslove | Poništi filtere | Isti pojam se zove „filteri“ (traka) i „uslovi“ (dugme); „obriši“ i „poništi“ se mešaju. | P1 |
| Razgovor sa asistentom | `src/ui/v2/IntakePresentation.tsx:419` | Odustajanje sprečava da kasniji odgovor promeni podatke. Ako je odgovor već počeo da se sprema, poruka se ipak računa… | Ako odustaneš, odgovor asistenta neće promeniti zadatak. Ako je asistent već počeo da odgovara, poruka je ipak poslata. | Ista rečenica u tri fajla (razgovor.tsx:381, nova.tsx, IntakePresentation.tsx); jedan tekst na jednom mestu. | P1 |
| Mesto zadatka | `src/ui/location/LocationPointEditor.tsx:518` | Koristi gde sam | Koristi moju lokaciju | Dugme je rečenični fragment u prvom licu bez objekta; ne razume se šta radi. | P1 |
| Mesto zadatka | `src/ui/location/NeedLocationForm.tsx:16` | Na jednoj lokaciji | Na jednom mestu | Isti izbor se na pregledu zadatka zove „Na jednom mestu“ (aiNeedV2Ui.ts:159). | P1 |
| Moj zadatak (otkazivanje) | `src/ui/needs/NeedLifecycleActions.tsx:22` | Otkaži zadatak | Otkaži zadatak (uz izbor razloga) | Plan 2.3: otkazivanje zadatka danas ide bez razloga, a otkazivanje Dogovora traži razlog; isti obrazac… | P1 |
| Zadaci (prazno stanje) | `src/ui/v2/DiscoveryPresentation.tsx:1116` (ručno) | Trenutno nema otvorenih zadataka | (tekst ostaje; dodati drugu radnju „Objavi zadatak“ uz „Osveži zadatke“) | Prazno stanje „Zadaci“ ima samo radnju „Osveži zadatke“; prvi korisnik sa malo zadataka treba i poziv da… | P1 |
| Razgovor sa asistentom (govorni unos) | `src/features/voice/useHoldToTalk.ts:17` | Zvuk se prolazno šalje Google servisu radi transkripcije. | Zvuk se privremeno šalje Googleu da bi se pretvorio u tekst. | „transkripcija“ je žargon (plan 2.17); tekst obaveštenja ima 5 rečenica; razbiti na dva kratka pasusa (šta… | P1 |
| Profil, O aplikaciji, oporavak lozinke | `src/ui/BuildIdentity.tsx:24` (ručno) | USKOČI · {build.version ?? 'verzija nije zabeležena'} | (u prodavničkom buildu samo „Verzija 1.0.0“; bez skraćenog commit-a i zvezdice) | Uvek vidljiv red na dnu Profila, O aplikaciji i oporavka lozinke kaže „USKOČI · verzija · 7 znakova commit-a… | P1 |
| O aplikaciji | `src/app/(app)/profil/o-aplikaciji.tsx:37` | Jedan nalog, obe mogućnosti | Tražiš pomoć ili uskačeš — na istom nalogu | Nenavedena „obe mogućnosti“; rečenica koja objašnjava gde si (plan 2.17) — poruka je da ista osoba može obe… | P1 |
| Moje prijave | `src/ui/v2/MyApplicationsPresentation.tsx:87` | Tvoja prijava je poslata pre promene zadatka. Zadržavanje čuva ponuđenu cenu, obim, termin i napomenu. | Prijava je poslata pre nego što je zadatak izmenjen. Ako je zadržiš, ostaju ponuđena cena, obim, termin i napomena. | „Zadržavanje“ je apstraktna imenica; rečenica bez roda. | P1 |
| Obaveštenja | `src/ui/notifications/publicInboxCopy.ts:8` (ručno) | 'Pojavila se nova prilika koja može da ti odgovara.' | DODATI par ['Novi zadatak za tebe', 'Pojavio se novi zadatak koji može da ti odgovara.'] u spisak (stari par ostaje) | Klijent mora da zna novi par pre nego što ga server pošalje (komentar u fajlu, linije 42–46). | P1 |

Ostalo (P1 i P2) po jednom obrascu: zameniti „aktuelan“ → „trenutan“ (60 mesta, pravila R12–R15 u JSON-u kao pojedinačne stavke), „Učitaj sačuvano stanje“ → „Pokušaj ponovo“ (7 dugmadi), „Osveži prikaz“ → „Osveži ekran“ (~40), „Nalog je promenjen.“ → „Prijavljen je drugi nalog.“ (12), „Dogovor/Zadatak/Prijava nije dostupan/-a.“ → ista rečenica sa radnjom (R17–R21), „Termin nije potvrđen“ → „Termin nije dogovoren“ (5), „Tražim ponude“ → „Prima ponude“ (5, odluka vlasnika).

## 4. Rečnik: jedan naziv po pojmu

| Pojam | Piše se | Ne piše se |
|---|---|---|
| Ono što osoba objavi | **zadatak** (malo slovo usred rečenice) | posao, posla, poslovi, Potreba, prilika (kao zadatak), oglas, „zahtev“ (za zadatak) |
| Ono što radnik pošalje na zadatak | **prijava** (termin + cena + ljudi + poruka) | „ponuda“ kao naziv cele prijave, aplikacija |
| Samo predložena cena u prijavi | **ponuda** | — |
| Problem u Dogovoru | **prijavljen problem**, „Prijavi problem“ | „prijava“ bez imenice (kolizija sa prijavom na zadatak) |
| Prijava osobe podršci | **prijava osobe** / „Prijavi osobu“ | — |
| Prijavljivanje na nalog | **Prijavi se** (naslov „Prijava“ ostaje) | „Nalog je prijavljen“ u značenju „osoba je prijavljena“ |
| Funkcija i njen ishod | **Dogovor** (veliko D), „Dogovor je sklopljen“, „Dogovoren / Završen / Otkazan“ | dogovor (malim kao ime funkcije), kreiran, napravljen |
| Planer | **Raspored** („Ceo raspored“) | kalendar, Moj plan, agenda, planer |
| Razgovori sa ljudima | **Poruke** (tab), poruka | „razgovor“ za ljude |
| Razgovor sa pomoćnikom | „razgovor sa asistentom“; u rečenici **asistent**; „AI“ samo kao kratka oznaka | „AI je odgovorio“, „USKOČI je odgovorio“ (odluka vlasnika) |
| Vremenski prozor rada | **termin**; „Termin nije dogovoren“ | „Termin nije potvrđen“ |
| Rok za prijave | **rok** | — |
| Mesto zadatka / radnika | **mesto** (zadatak), **područje rada** (radnik) | lokacija (osim lokacije telefona i privatne lokacije u Dogovoru), tačka, **pin** → „oznaka“ |
| Novac | **cena**; „Prima ponude“ kad cene nema; iznos samo uz polje za unos | budžet; „Iznos nije sačuvan“; iznos tamo gde cene nema |
| Osoba | **osoba**, „druga strana“, „osoba koja je objavila zadatak“, „osoba koja radi zadatak“ | korisnik, učesnik (osim u grupnom razgovoru), vlasnik, autor, naručilac, uskočer, radnik (odluka vlasnika) |
| Uloge o sebi / o drugom | „Tražiš pomoć“ / „Uskačeš“; „Traži pomoć“ / „Uskače“ | „Kad ti radiš“, „Kad ti objavljuješ“ |
| Opis o sebi | **O meni** | opis, biografija |
| Radni profil | **radni profil** | profil radnika |
| Spisak | **lista** („Lista zadataka“) | spisak |
| Ponovni pokušaj | **Pokušaj ponovo** | Probaj ponovo, Ponovi |
| Stanje posle neuspeha čitanja | **Osveži** (ekran, listu, Dogovor) | „Učitaj aktuelno stanje“, „Proveri sačuvano stanje“ |
| Nepoznat ishod pisanja | „Ne znamo da li je … uspelo“ + **Proveri** | „ishod nije potvrđen“, „potvrda nije stigla“ |
| Brisanje / skidanje / poništavanje | **Obriši** (trajno: nacrt, tekst), **Ukloni** (stavka iz liste: fotografija, tačka), **Poništi** (filteri, izbor) | „Obriši uslove“ |
| Uređaj | **telefon** | uređaj (osim „Odjavi se sa ovog uređaja“, sistemski izraz) |
| Podrška | **zahtev** (osoba), „podrška“ | „predmet“ (samo u prikazu za operatera) |
| Pomoć ili žalba | **Obrati se podršci** | „Piši podršci“, „Zatraži pregled podrške“ |

**Zabranjene reči u tekstu koji osoba vidi:** posao, posla, poslovi (za zadatak) · Potreba · prilika (za zadatak) · Naručilac · Uskočer · vlasnik · autor · korisnik · server · kalendar · budžet · ishod · aktuelan · „sačuvano stanje“ · „sačuvani zahtev“ · usklađen · izričito · obračun · kontekst · transkript / transkripcija · OTA · runtime · radno stablo · pin · spisak · „Probaj“ · kreiran · formular · „Vi“ oblici (Imate, Otvorite, Dogovorite) · glagolski rod („izabran si“, „odgovorio“) · veliko slovo „Zadatak/Prijava“ usred rečenice.

**Obrasci rečenica (da svaka poruka izgleda kao da ju je napisao isti čovek):**
- Greška: „[Šta se desilo.] [Šta možeš da uradiš.]“ — „Ne možemo da učitamo Dogovore. Proveri vezu i pokušaj ponovo.“
- Nepoznat ishod: „Ne znamo da li je prijava stigla. Proveri to; neće se poslati dvaput.“ (već dobro u `prilike/[id]/prijava.tsx:210`).
- Prazno stanje: jedna rečenica o tome šta je ovde + jedna radnja koja ga popunjava.
- Dugme: glagol + predmet, najviše tri reči („Povuci prijavu“, „Pošalji ponovo“); nikad „OK“, „Potvrdi“, „Povuci“ bez predmeta.
- Navodnici: „…“ (U+201E / U+201C); danas se meša sa „…” i `"` (3 mesta).
- Vreme: „5. okt · 12:00“ (bez vodeće nule, bez sekundi); termin uvek „po vremenu u Srbiji“.
- Množina: uvek kroz `plural()`, uključujući glagol uz brojeve 2–4 („2 mesta su slobodna“).

## 5. Tekstovi koje šalje server, a osoba ih vidi

### 5a. Kojim putem stižu i ko ih menja

| Put | Izvor | Prikaz | Izmena |
|---|---|---|---|
| Push (zaključan ekran) | `supabase/functions/_shared/pushNotificationCopy.mjs` (24 događaja + opšti par) | Android, naslov + telo | **klijent prvo** (dodati par u `src/ui/notifications/publicInboxCopy.ts`; stari par ostaje dok se stari buildovi ne ukinu), **zatim Edge** („PRIMENI“ + CLI deploy). Klijent prihvata samo tačne parove. |
| Obaveštenja u aplikaciji | tabela `notification_deliveries` (naslov/telo); upisuju 17 funkcija kroz `private.emit_event`; od PKG-027c (ledger 176) sve prolazi kroz `private.notification_copy_v5(text)` (`supabase/candidates/pkg027c_notification_ti_copy.sql:57-88`) | spisak obaveštenja (p40) | **serverski**: nova migracija (`create or replace` te funkcije + prepis već sačuvanih redova), po uzoru na pkg027c; ne menjati primenjene migracije; ne pomera sertifikat zatvaranja. |
| Poruke koje server upisuje u razgovor | `⚠️ Prijavljen problem: …` (3 migracije), `Otkazujem Dogovor. Razlog: …` | Poruke, Dogovor | emotikon i prvo lice: P2, funkcija je u zatvorenom izvoru (vlasnikovo odobrenje); „Otkazujem Dogovor. Razlog:“ ne menjati jer ga funkcija parsira (`cancel-info`). |
| Odgovori asistenta i uputstva modelu | `supabase/functions/uskoci-ai-interview/index.ts` (597–670: pitanja za nedostajuća polja; 310–367: uputstvo), `uskoci-worker-interview/index.ts:192` | razgovor sa asistentom | **Edge** („PRIMENI“ + CLI deploy). |
| Podrazumevana imena | `'USKOČI korisnik'` (`cloud_profile_foundation_1_3b.sql:141`, `pkg019:52`) | profil bez imena | P2: „Nova osoba“; pkg027d je već uklonio izmišljene opise. |
| **Ne vide se** | `RAISE EXCEPTION`/`hint` tekstovi u SQL-u (desetine rečenica u „Vi“ obliku, bez dijakritika, sa „Uskocer/Narucilac/Potreba“); Edge `message` polja | klijent ih ne prikazuje (`legacyRpcFailure.ts`: „SQLSTATE, arbitrary message/details/hint … are not UI copy“) | **ne menjati** |
| Potisnuto | `Lokacija nije navedena` (p6_discovery SQL) | klijent ga ne piše (`marketplaceView.ts:263`) | ne menjati (ključ filtera) |

### 5b. Spisak događaja: stanje, predlog, gde

U aplikaciji prikazani tekst je tekst posle mape PKG-027c. Naslovi istog događaja se danas razlikuju između pusha i aplikacije; predlog je jedan naslov na oba mesta.

| Događaj | Push sada (naslov / telo) | U aplikaciji sada (naslov / telo) | Predlog (naslov / telo) | Izmena |
|---|---|---|---|---|
| nov zadatak za osobu | Novi zadatak za tebe / Pojavila se nova prilika koja može da ti odgovara. | Nova prilika koja ti može odgovarati / (naslov zadatka) | **Novi zadatak za tebe** / Pojavio se novi zadatak koji može da ti odgovara. (u aplikaciji telo ostaje naslov zadatka) | klijent + Edge + migracija |
| nova prijava | Nova prijava / Stigla je nova prijava na tvoj zadatak. | Nova prijava / Imaš novu prijavu za **Zadatak**. | Nova prijava / Imaš novu prijavu za zadatak. | migracija |
| prijava izmenjena | Prijava je izmenjena / Jedna prijava na tvoj zadatak je ažurirana. | Prijava je izmenjena / Pregledaj aktuelne uslove prijave. | … / Pregledaj trenutne uslove prijave. | migracija |
| prijava pregledana | Prijava je pregledana / Tvoja prijava je pregledana. | isto | bez izmene | — |
| u užem izboru | **U užem si izboru** / Tvoja prijava je izdvojena za dalji izbor. | — | Tvoja prijava je u užem izboru / Osoba koja je objavila zadatak je zadržala tvoju prijavu. | Edge + klijent |
| prijava izabrana | **Izabran si** / Tvoja prijava je prihvaćena. Otvori Dogovor. | Tvoja prijava je izabrana / Otvori Dogovor za detalje zadatka. | **Tvoja prijava je izabrana** / Otvori Dogovor. | Edge (klijent već zna) |
| prijava nije izabrana | **Prijava je završena** / Za ovaj zadatak je izabrana druga osoba. | — | Prijava nije izabrana / isto (reč „Nije izabrana“ je vlasnikova) | Edge + klijent |
| zadatak izmenjen, prijava traži proveru (RESPONSE_STALE) | Proveri prijavu / Zadatak je promenjen nakon tvoje prijave. | — | Zadatak je izmenjen / Pregledaj izmene i potvrdi svoju prijavu. | Edge + klijent |
| prijava povučena | Prijava je povučena / Jedna prijava više nije aktivna. | Prijava je povučena / Jedna prijava za tvoj **Zadatak** je povučena. (druga putanja: „Prijava za tvoj zadatak je povučena.“) | … / Jedna prijava na tvoj zadatak je povučena. | Edge + migracija |
| potraga zatvorena | — | Potraga je zatvorena / **Onaj ko je objavio zadatak zatvorio je potragu.** Tvoja prijava više nije aktivna. | … / Osoba koja je objavila zadatak zatvorila je potragu. … | funkcija (`pkg029a`) ili mapa |
| zadatak otkazan | Zadatak je otkazan / Zadatak više nije aktivan. | Zadatak je otkazan / Zadatak za koji imaš prijavu je otkazan. | bez izmene | — |
| zadatak izmenjen (NEED_REVISED) | Zadatak je izmenjen / Promenjeni su podaci zadatka koji pratiš. | Zadatak je izmenjen / Pregledaj svoju prijavu pre nastavka. | Zadatak je izmenjen / Zadatak za koji imaš prijavu je izmenjen. (u aplikaciji: „Pregledaj izmene i potvrdi svoju prijavu.“) | Edge + migracija |
| predlog izmene Dogovora | Predložena je izmena Dogovora / Proveri predložene uslove. | Predložena je izmena Dogovora / Pogledaj predlog i odgovori u Dogovoru. | bez izmene | — |
| završetak čeka potvrdu | Potvrdi završetak / Druga strana je označila **posao** kao završen. | Završetak čeka tvoju potvrdu / Dogovor je označen kao završen. | Potvrdi završetak / Zadatak je označen kao gotov. (isti naslov i u aplikaciji) | Edge (klijent već zna) |
| prijavljen problem | **Oporavak naloga** / Otvoren je postupak oporavka naloga. | Prijavljen je problem / Otvori Dogovor da vidiš prijavljeni problem. | Prijavljen je problem u Dogovoru / Otvori Dogovor da vidiš prijavljeni problem. | Edge (+ događaj) |
| Dogovor otkazan | Dogovor je otkazan / Otvori Dogovor da vidiš trenutno stanje. | Dogovor je otkazan / Druga strana je otkazala Dogovor. Razlog je u Porukama. | bez izmene | — |
| nova poruka | Nova poruka u Dogovoru / Imaš novu poruku. | Nova poruka / Imaš novu poruku u Dogovoru. | jedan naslov: Nova poruka u Dogovoru | migracija |
| nova ocena | Stigla ti je nova ocena / Pogledaj novu ocenu saradnje. | Nova ocena / Stigla je ocena za završen Dogovor. | jedan naslov: Stigla ti je nova ocena | migracija |
| pitanje o zadatku | Novo pitanje za zadatak / Stiglo je novo pitanje. | Novo pitanje o **Zadatku** / Stiglo je anonimno pitanje o **Zadatku**. | Novo pitanje o zadatku / Stiglo je anonimno pitanje o zadatku. | migracija (naslov nema red u mapi) |
| odgovor na pitanje | Stigao je odgovor / Na pitanje za zadatak je odgovoreno. | Odgovor na pitanje / Stigao je odgovor na tvoje pitanje. | jedan naslov: Stigao je odgovor | migracija |
| oporavak naloga | Oporavak naloga / Otvoren je postupak oporavka naloga. | — | bez izmene (tek kada to bude pravi događaj) | — |
| opšti par | USKOČI / Imaš novo obaveštenje. Otvori aplikaciju. | Novo obaveštenje / Otvori za trenutne informacije. | bez izmene | — |

## 6. Pitanja za vlasnika

1. Prijava i ponuda: **prijava = ceo predmet, ponuda = samo cena**? (utiče na 7 dugmadi i poruka u toku prijave).
2. Pomoćnik se u tekstu zove „asistent“, a „AI“ ostaje samo kao oznaka („AI pomaže…“)? Danas se meša „AI“ i „USKOČI“.
3. „Prima ponude“ (kartica, detalj, filter) i „Ponude“ (pin) umesto „Tražim ponude“ / „Traži ponude“?
4. „Radnik“ ostaje kao naziv uloge u porukama, ili svuda „osoba koja radi zadatak“ / „druga strana“?
5. HITNO: ako ostaje u V1, treba ženski rod i „oznaka HITNO“ (oko 25 poruka); ako ne, ukloniti tekstove zajedno sa funkcijom (plan 7.10.).
6. „Mogu odmah“ je jedino dugme u prvom licu jednine; je li to namerno?

## 7. Nije pokriveno

- `src/app/dizajn-*` i `__tests__` (po zadatku); `src/data/lazniAi.ts`, `lazniIzvor.ts` (probni izvor, „Potreba“, „Fali podatak“; nisu u produkcijskom putu), `src/ui/referenceEntry/*` (nekorišćen donor sa „Vi“ oblikom).
- Nije proveren TalkBack (samo tekst oznaka), slike/ikone, zvuk glasovnih poruka; tekstovi u uputstvima modela samo tamo gde se vide u odgovoru.
- Sačuvani redovi obaveštenja na DEV-u nisu čitani (zabranjeno); stanje je izvedeno iz izvornog koda (PKG-027c, pkg029a, pkg032a, pkg033a) i sa snimaka telefona.
- Pravni tekstovi (zatvaranje naloga, privatnost, obaveštenje o obradi glasa i fotografija) samo su označeni kao dugi; preformulaciju odobrava vlasnik.
