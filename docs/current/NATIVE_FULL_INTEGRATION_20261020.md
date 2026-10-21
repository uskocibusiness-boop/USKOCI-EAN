# USKOČI — celovita native integracija — aktivni izvorni rad

20.10.2026. Dopuna postojećeg Master plana posle odluke vlasnika o modalima, novoj ikonografiji i instalaciji tek na kraju kruga.

## 1. Šta je dogovoreno

1. **Mapa ostaje osnova.** Sačuvati postojeće pinove/kartice, kameru, selekciju, gestove, panel i povratak. Organizovati gornju pretragu i filtere; udaljeni zadaci dobijaju zasebnu listu bez izmišljenih geografskih pinova.
2. **Ostali modali u sredinu.** Potvrde, prijave, kandidati, izbori, kratke forme i meniji dobijaju zajednički centrirani prozor. Dugi tokovi ostaju posebni ekrani. Naslov, zatvaranje i primarna radnja ostaju dostupni; sadržaj može da skroluje. OS dozvole/picker-i nisu aplikacioni donji paneli.
3. **Nova 2.5D porodica.** Prirodne raznovrsne boje, isti materijal, perspektiva i svetlo. Plavi papirni avion za prijave/slanje. Radar se uklanja. Brend zadržava belu, zelenu i narandžastu, ali predmeti nisu svi zeleni.
4. **Robot.** Postojeći USKOČI identitet koristi se u oba AI razgovora. Pregledati stvarnu integraciju i motion; ne tvrditi da postoje pokreti ruke ili govor bez odgovarajućih resursa i funkcije.
5. **Jedan nalog, obe perspektive.** Objavljivač bira i vodi, izvršilac se prijavljuje i izvršava. Istom nalogu nije potreban globalni prekidač uloge. Svaki konkretan ekran određuje prava iz postojećeg autoritativnog stanja.
6. **Celina po Figmi.** Zadržati dobru organizaciju Podešavanja i Profila. Preneti glavne ekrane, međuekrane, modale, prazna/loading/error/offline/pending/unknown/stale/success stanja i realne akcije.
7. **Instalacija na kraju kruga.** Tokom rada: izvor, asseti, mapiranje, ciljane provere i objedinjena regresija. Posle povezanog kandidata: build, instalacija, vizuelna i funkcionalna provera na uređaju, korekcije i ponovna provera. Stvarnu tastaturu/gestove/performance nije moguće potvrditi bez tog završnog pokretanja.

Ove odluke određuju obim. Stvarna implementacija i preostali rad su u §7; početni presek §2 je sačuvan kao istorija.

## 2. Početni presek pre implementacije (istorija ovog kruga)

Repo: `C:\Users\user\Desktop\USKOCI ZAVRSAVANJE\USKOCI-EAN`, grana `feature/unified-qa-master-20261017`, lokalni kandidat iznad `70bc79f250b33ae706a068579c3527dfbf297792`.

- Prvi native paket je već lokalno implementiran: detalj obe perspektive, prikaz iznosa/kapaciteta, forma/pregled prijave i kandidati. Raniji dokaz ima 11 grupa / 272 testa i ograničen emulator prolaz. Taj rezultat nije nova provera celog proizvoda.
- Figma konekcija je sada uspela. Readback 12 ciljnih prikaza je u `FIGMA_READBACK.json`. Dokument sadrži 18 imenovanih stranica. Nije rađena nova potpuna provera svih veza.
- Podešavanja `2:144`: Nalog → Lični podaci / Pristup nalogu; Tvoje iskustvo → Obaveštenja / Privatnost; Pomoć → Podrška / O aplikaciji; Odjava.
- Profil `2:126`: javni profil, radni profil, moje prijave, podešavanja, podrška, raspored i aktivnost. To je izvor strukture koju treba preneti, ne drugi sistem naloga.
- `ProductSheet.tsx` trenutno koristi Gorhom donji panel. Kandidati, pregled prijave, akcioni meniji, kalendar i druge oblasti imaju zajedničke pozive. `ConfirmSheet` već ima centralni dijalog za kratke potvrde i posebnu sheet varijantu; potrebno je objediniti ponašanje.
- Mapa koristi zasebne `DiscoveryListSheet.tsx` i `PeekSheet.tsx`. One uvoze motion konstante iz `ProductSheet`; migracija opšteg modala zato mora sačuvati ili izdvojiti te konstante, bez promene fizike mape.
- Gornja pretraga ima sopstveni `discovery/SearchSheet.tsx`; nije dovoljno promeniti samo `ProductSheet`.
- Radar je i dalje u `src/ui/home/HomePresentation.tsx:109`. U ovom pripremnom koraku nije uklonjen iz runtime-a.
- `AiAssistantArt.tsx` koristi `assets/ai/uskoci-assistant.png`, veličine 24/88/128 i postojeće animacije. PNG je vizuelno pregledan. Stariji PROVENANCE tekst opisuje raniji trenutak i nije potpun opis sadašnjeg motion koda.
- U mapiranju prvog paketa ispravljen je pogrešan Figma ID kandidata: `10:211` je moja poslata prijava; kandidat Marko je `119:962` prema registru Figme. Implementacija kandidata time nije menjana.

## 3. Gde Figma još nije dokaz gotove implementacije

Ovo je ciljana lista za proveru, ne novo proglašenje svih prethodnih nalaza aktivnim.

| Razlika | Dokaz / granica | Potrebno zatvaranje |
|---|---|---|
| Svi modali centrirani | Novi zahtev; postojeći `ProductSheet` je donji panel | Jedan centralni host, Back, dirty/busy guard, fokus, tastatura, skrol i dostupna stopa |
| Grupne fotografije i glas | Trenutni `GroupMessage`/`GroupReceipt` u `groupConversationService.ts` su tekstualni; Figma pokazuje medijske scenarije | Proveriti/definisati backend podršku, članstvo, storage i receipts; ne povezivati grupu sa privatnim adapterom naslepo |
| Grupna izmena termina | Kritični ugovori navode pojedinačni agreement servis | Proveriti atomarnost/pravila potrebnih saglasnosti i svaki odgovor; demo „svi prihvatili“ nije dokaz |
| Sačuvaj pa aktiviraj profil | `workerAiClientService.prepare(..., activate)` nosi aktivacionu nameru | Utvrditi stvarni pregled i receipt za drugi korak; bez izmišljenog activate RPC-a |
| Ponovo objavi izmenjen zadatak | Prototip i ugovori imaju otvorenu transakcionu vezu | Potvrditi dozvoljen put; ne sastavljati nezavisno brisanje i objavu |
| Sve akcije i 11 scenarija | Poslednji Figma D izveštaj: 210 prikaza/stanja/vodiča i 786 čvorova reakcija, 0 svih Master scenarija potvrđenih u celini u tom paketu | Proći primarne/destruktivne radnje, sve povratke i obe perspektive; brojač čvorova nije broj funkcija |
| Native ponašanje | Figma ne dokazuje kameru, tastaturu, OS Back, TalkBack, prekide veze ili FPS | Završna provera stvarnog objedinjenog kandidata nakon instalacije |

Živi Supabase nije čitan ili menjan u ovom pripremnom koraku. Nijedan otvoreni serverski ugovor nije proglašen isporučenim.

## 4. Redosled jednog povezanog kruga

| Celina | Sadržaj | Kriterijum završetka izvora |
|---|---|---|
| INT-01 — kontrolni inventar | Postojeći zahtevi, Figma IDs, ruta, komponenta, akcija, servis, stanja | Svaki potreban prikaz ima vlasnika i status; bez pogrešnih ID-eva ili demo akcija predstavljenih kao stvarne |
| INT-02 — zajednički sistem | Centrirani modali, kontrole, tokeni, 2.5D asseti, robot, motion | Jedan sistem; mapa izuzeta; nema radara; svaka ikona ima namenu i poreklo |
| INT-03 — okvir, profil i podešavanja | Početna, navigacija, moj/javni/radni profil, lični podaci, privatnost, obaveštenja i pomoć | Preneta odobrena struktura; svaki red vodi do stvarnog ekrana i razumljivog povratka |
| INT-04 — pronalaženje i zadaci | Gornja pretraga/filteri, remote lista, detalj, prijava i kandidati | Isti kontekst pri Back-u; javna/privatna geografija i kapacitet; obe perspektive |
| INT-05 — Dogovori i komunikacija | Pregled, članovi, pojedinačni uslovi, nedostaju ljudi, izmene, privatni/grupni čet, mediji | Samo dozvoljene akcije; tačan primalac, broj mesta, status i receipt; dokumentovana podrška medijima |
| INT-06 — AI i pomoćni tokovi | Zadatak/radni profil, živa kartica, lokacija, pregled, save/publish/aktivacija, raspored | Nema gubitka nacrta ili potvrđenih činjenica; jasna razlika između nacrta, sačuvanog i aktivnog |
| INT-07 — završetak i izuzeci | Ocene, problem, otkazivanje, auth, odjava, zatvaranje naloga, greške i oporavak | Primarne/destruktivne radnje, dirty/pending/unknown i privatnost imaju konkretan ishod |
| INT-08 — objedinjena kontrola | Tipovi, ugovorni/ponašajni testovi, asseti, svi ekrani i akcije, vizuelna specifikacija | Nema preostalih nepovezanih potrebnih akcija; otvorene funkcionalne razlike jasno rešene ili eksplicitno van MVP-a |
| INT-09 — build i stvarna provera | Jedan povezani testni APK, uređaj/emulator, dva naloga, mreža, tastatura, motion, povratci | Dokaz za stvarni izvor/paket i svaki scenario; korekcije na osnovu nalaza; posebno release prihvatanje |

Ovo su kontrolne celine istog posla, ne obaveza da se korisnik zaustavlja i traži odobrenje posle svake.

## 5. Ugovor svakog ekrana

Svaki ekran dobija: svrhu, sadržaj, kontekst uloge, primarnu/sekundarne radnje, kod/servis, Back i obnovu stanja.

Stanja se primenjuju prema prirodi funkcije, uz obrazložen N/A gde nisu potrebna:

- prvo učitavanje i osvežavanje postojećeg sadržaja;
- nema podataka / nema rezultata;
- uspešan sadržaj i dozvoljene akcije;
- greška, prekid interneta i sačuvan unos;
- zastareli podaci / izmenjeno članstvo ili dozvole;
- slanje, dokazano odbijanje, nepoznat ishod i potvrđen uspeh;
- odustajanje, gubitak fokusa, povratak i promena naloga;
- veći font, mali ekran, čitač ekrana, Reduce Motion i tastatura.

## 6. Ikonografija i motion

Prvo inventar semantičkih namena, zatim stvarni pojedinačni asseti. Nova generacija zamenjuje ilustracije kroz zajednički registar, uz proveru svake male veličine, providnosti, margina, svetla i čitljivosti. Navigacione kontrole ostaju vektorske. Statusi imaju tekst/oblik uz boju. Ne menjati logo bez zasebne odluke.

Modal: kratak opacity/scale ulaz, bez translate sa dna, centriran u raspoloživom prostoru. Dugi sadržaj skroluje; odustajanje ne gubi unos bez postojeće zaštite. Reduce Motion uklanja pomeranje. Blur je dozvoljen samo kada pomaže čitanju slojeva, uz običnu zatamnjenu pozadinu kao pouzdan fallback. Mapa zadržava svoje opruge/gestove.

## 7. Stvarno implementirano u ovom krugu

Lokalni izvor; nijedan novi APK, instalacija, OTA, Git push ili živi backend upis.

### INT-02-MODALS

Centrirani kratki aplikacioni dijalozi; tastatura, dirty/busy i single-close zaštite; fullscreen pretraga; postojeći map paneli i njihove konstante sačuvani.

Dokaz: `src/ui/product/ProductSheet.tsx`, `src/ui/v2/discovery/SearchSheet.tsx`, `src/ui/agreements/AgreementCompletionReview.tsx`.

### INT-02-ART

20 novih originalnih WebP ilustracija, prirodne boje, avion za prijave; radar uklonjen sa Početne. Robot zadržan. Kontrolne i male statusne ikone ostaju vektorske.

Dokaz: `src/ui/system/materialSubjects.ts`, `assets/illustrations/natural-v1/manifest.json`, `src/ui/home/HomePresentation.tsx`.

### INT-03-PROFILE

Posebna podešavanja i povezane destinacije. Prvobitni profil nije vizuelno preneo Figmu; naknadna ispravka prema čvoru 2:126 dokumentovana je ispod.

Dokaz: `src/ui/profile/ProfileHubPresentation.tsx`, `src/ui/settings/AccountSettingsPresentation.tsx`, `src/app/(app)/profil/podesavanja.tsx`.

### INT-04-DISCOVERY

Zasebna pretraga i filteri, podrazumevano zadaci na lokaciji, remote u odvojenom režimu; reset ne vraća mešanje; kamera i gestovi zadržani.

Dokaz: `src/data/discoveryWorkMode.ts`, `src/ui/v2/discovery/DiscoverySearchBar.tsx`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx`, `src/ui/v2/DiscoveryPresentation.tsx`.

### INT-05-TERMS

Prihvaćeni iznos pojedinačne saradnje i označeni redovi mesto/termin/ljudi; kompaktan kontekst poruka ostaje kompaktan; nepoznata cena nije nula.

Dokaz: `src/ui/v2/AgreementPresentation.tsx`.

### INT-06-ACTIVATION

Prvi pregled podrazumeva čuvanje bez aktivacije. Sa sačuvanog nacrta postoji pregled za aktivaciju, isti postojeći RPC i eksplicitna potvrda. Očuvana neposlata poruka, prethodno izabran režim, revision/idempotency i potvrđen readback.

Dokaz: `src/app/(app)/profil/radnik.tsx`, `src/app/(app)/profil/razgovor.tsx`.

### INT-05-GROUP-CONTEXT

Učesnici zadatka pre privatne saradnje; loading/error/retry umesto praznog mesta. Cena i status ostaju pojedinačni, za obe uloge.

Dokaz: `src/ui/agreements/AgreementOverview.tsx`, `src/ui/groups/GroupConversationEntry.tsx`.

### INT-06-EDIT-CONSEQUENCE

Završni pregled objašnjava privremeno povlačenje zadatka dok se izmene proveravaju. Neuspeh ostaje privatan nacrt; bez lažnog uspeha ili obećanja atomarne zamene.

Dokaz: `src/app/(app)/pregled-zadatka.tsx`, `src/app/(app)/potrebe/[id]/pregled.tsx`.

### INT-07-AUTH-LAYOUT

Duga forma prijave/registracije koristi ceo ekran, kraća stanja centrirani prikaz. Očuvani auth, Back, unos, keyboard reveal i recovery.

Dokaz: `src/ui/auth/AuthSheet.tsx`.

## 8. Provere i granice

- Objedinjeni poslednji rezultati: **623 test grupa, 14015 PASS, 0 FAIL, 9 preskočenih testova**. Ovo je puna regresija plus ciljane popravke, ne jedan neprekinuti prolaz na zamrznutom izvoru. Početni neuspesi su sačuvani u evidenciji.
- 368 testova dijaloga/kalendara/kandidata/prijava/grupe/pravnih ekrana; 193 testa pregleda i izmene zadatka; 97 testova workspace-a Dogovora; 43 testa Podešavanja i grupe. Skupovi se preklapaju — ne sabirati ih kao nove testove.
- TypeScript: `tsc --noEmit` je završen sa izlaznim kodom 0. Dokaz `native-integration-typecheck-final.log`.
- RN-web: ispravljeni fontovi; proverena geometrija kratkog i dugog dijaloga na 390×844 i 320×568. To ne potvrđuje Android tastaturu, TalkBack, gestove ili FPS.
- DEV: read-only čitanje definicija; grupni tekst, radna lokacija, worker Save/aktivacija, bilateralni predlog i task review/objava. Nema upisa korisničkih podataka.
- Popis: **65 specifikacionih površina**, sa preciznim rutama/komponentama i hash-evima; **786 Figma čvorova reakcija**. To nisu brojevi novoimplementiranih ekrana ili proverenih handler-a. **0 svih 11 Master scenarija** potvrđeno na ovom novom native kandidatu.

## 9. Preostali rad do konačnog kandidata

- **OPEN-GROUP-MEDIA (P0):** Grupne slike/glas: server-owned upload, storage pristup po članstvu/sekvenci i receipt; postojeći grupni servis tekstualan. Nije implementirano ni primenjeno ovim krugom.
- **OPEN-GROUP-TERMS (P0):** Usaglasiti odobreni fleksibilni termin sa postojećim opštim bilateralnim izmenama; dokazati saglasnost potrebnih učesnika, bez niza nezavisnih RPC-a koji glume atomarnost.
- **OPEN-REGIONS-REPUBLISH (P0):** DEV potvrđuje grad/radijus i izmenu istog zadatka preko DRAFT. Regionalni Save/read/matching/dispatch i nova atomarna replacement objava sa istorijom nisu implementirani.
- **OPEN-FLOW-COVERAGE (P0):** Svih 65 specifikacionih površina sada ima precizne native vlasnike. 786 Figma reakcija ostaje owner mapping; svaka radnja i svih 11 Master scenarija još nisu potvrđeni u novom APK-u.
- **OPEN-NATIVE-QA (P0):** Posle integracije jedinstven APK, stvarna tastatura/Back/gestovi/veći font, dva naloga, offline/unknown recovery i push ciljevi. Nijedna nova instalacija u ovom krugu.
- **OPEN-AI-ADMISSION-DEADLINE (P0):** AI promena roka za prijave nema završen ugovor; rok izvršenja nije rok za prijave. Ne vraćati paralelni ručni editor.
- **OPEN-RELEASE-OPERATIONS (P0_RELEASE):** Stvarni operater, važeći pravni tekstovi/politike i uslovi javnog izdanja zahtevaju potvrđene podatke. Tehnički testovi ih ne potvrđuju.

Sledeća funkcionalna celina: grupni mediji i serverski model saglasnosti/izmene; zatim regionalna pokrivenost i replacement objava. Za svaki ugovor: izvor → kontrolisani test → odobrena primena → readback → klijent. Tek posle zatvaranja potrebnih ugovora i izvorne integracije sledi novi instalacioni fajl. Native provera svih scenarija zatim se radi na tom kandidatu. Celina nije proglašena završenom.

## 10. Sačuvani vizuelni prikazi

`podesavanja-prikaz.png` i `profil-prikaz.png`: stvarne prezentacione komponente sa probnim podacima na 390×844, prikazane kroz RN-web. Nisu fotografije novog APK-a. Prikaz sadrži vidljivu oznaku probe. `git diff --check` je prošao.

## Ispravka vizuelnog prenosa profila — 20.10.2026.

Vlasnik je ispravno uočio da prethodni profil nije preneo izgled iz Figme. Ranije su reorganizovane destinacije i ilustracije, a zadržana je stara otvorena lista. To nije bio završen vizuelni prenos.

Sada je pregledan stvarni Figma čvor `nZwxDeRClrrecngX09bimy / 2:126`, uključujući njegov screenshot i design context. Preneti su svetlo platno, bela kartica identiteta, javni profil unutar nje, pojedinačne kartice odredišta, tipografija, razmaci i meka elevacija.

Native prilagođavanja: kružna fotografija 88 dp sa postojećom radnjom izmene; stvarni grad i reputacija; završeni Dogovori ostaju dostupni; „Moji zadaci” vodi u postojeće `/potrebe`. Lični podaci ostaju u Podešavanjima. Nema izmišljenih ocena niti upisa demo podataka.

Provera: **8 ciljanih suite-ova, 169 testova prošlo; TypeScript exit 0**. Vizuelni RN-web pregled: 390×844, dugo ime i pokazne brojke na 320×568, učitavanje, neuspešno čitanje sa ponovnim pokušajem i nedostajuće ime. Raniji testovi koji su zabranjivali karticu zamenjeni su proverom povezanih podataka i navigacije.

Ovo je ispravka ekrana Moj profil. Android font, TalkBack, native senke i gestovi čekaju zajednički build. Nije napravljen niti instaliran novi APK, server nije menjan.

Dokaz: `profileVisualCorrection` u postojećoj JSON evidenciji, source hash-evi i kontrolni snimci `profil-figma-ispravka.png` i `profil-dugo-ime-320.png`. Raniji `profil-prikaz.png` ostaje istorijski dokaz prethodne kompozicije.

## Pregled prenosa i kompaktne komande — 20.10.2026.

Vlasnik prihvata novi izgled profila, traži statistiku, kompaktnije sekundarne akcije i proveru koliko je ostatak Figme stvarno prenet.

### Promene ovog kruga

- Podešavanja sada prate stvarni Figma čvor `2:144`: svetlo platno, tri bele grupe, sitne komande, sve postojeće destinacije. Odjava je kompaktan simbol sa tekstom; email identifikuje nalog. Ostaju Prijavi grešku i Pravila/saglasnosti iako ih pojednostavljeni uzor ne razrađuje.
- Profil i Podešavanja dele `AccountHeader`; profil zadržava prethodno ispravljenu kompoziciju `2:126`.
- Izmena i brisanje nacrta su ikone u zaglavlju sa 48 dp dodirnim površinama. Brisanje i dalje otvara postojeću centriranu potvrdu i iste lifecycle/receipt kontrole. Objavljeni zadatak nema lažno direktno brisanje.
- Kartice sopstvenih objavljenih zadataka sada pokazuju izabrano/potrebno čak i za 0/2 i 0/1, odvojeno od prijava. Nacrt kaže „Treba 2 osobe”, bez izbornih oznaka pre objave. Nepoznata popunjenost nije nula.
- Dodatne slike na svakoj profilnoj/podešavanjima kartici nisu dodate: vlasnik prihvata mirniju kompoziciju. Postojeće 2.5D činjenice zadatka ostaju.

### Statistika profila

`AccountReputation` već čita prosečnu ocenu i broj recenzija. `ProfileWorkSummary` sabira završene **Dogovore** po stvarnim ulogama. To nije broj jedinstvenih zadataka: isti zadatak može imati više pojedinačnih saradnji. Nedostupni podaci imaju loading/error/retry, nisu izmišljena nula.

Ukupna vrednost dogovorenih poslova nije dodata. Postojeći `MyWorkStats` ugovor ne nosi takav zbir. Potrebna je precizna agregacija prihvaćenih uslova po valuti i ulozi, sa otkazima/izmenama; to se ne može dobiti iz budžeta oglasa ili samo učitane stranice. Nije tvrdnja o zaradi ili isplati. Nije menjan backend.

### Stvarno stanje prenosa

Sveže su vizuelno pročitani Figma čvorovi Podešavanja `2:144`, Moji zadaci `25:334`, Dogovori `2:105`, Poruke `2:114`, Obaveštenja `2:135`, sačuvani radni profil `6:213`; profil `2:126` je već pročitan prethodnim krugom.

| Oblast | Nalaz |
|---|---|
| Moj profil | Preneta kompozicija, stvarni reader-i i navigacija; Android kandidat još nije proveren. |
| Podešavanja | Ovog kruga prenete grupe i komande; 8 odredišta očuvano. |
| Moji zadaci / nacrt | Doterane komande i popunjenost; postojeća bogatija kartica i 2.5D elementi očuvani. Nije tvrdnja da je svaki detalj zadatka završen. |
| Radni profil | Save/aktivacija ranije povezani; vertikalna kartična kompozicija iz Figme još nije kompletno preneta. |
| Dogovori | Postoje stvarni read/lifecycle/role tokovi; ostaje vizuelno usaglašavanje liste, detalja i svih stanja oba učesnika. |
| Poruke | Native još koristi TimedRow listu. Figma search nema stvarni kompletan search ugovor. Grupne slike/glas ostaju OPEN-GROUP-MEDIA. |
| Obaveštenja | Stara kompozicija redova; potreban prenos hijerarhije kartica uz očuvanje ciljeva i recovery-a. Figma kontrolni QA blok se ne prenosi u proizvod. |

Preostalih 65 specifikacionih površina se vodi u postojećem inventaru. Pronađeni source vlasnici nisu dokaz završenog vizuelnog prenosa. Broj 786 je broj Figma čvorova reakcija, ne broj proverenih native handler-a. Svih 11 Master scenarija i dalje čekaju proveru na jednom završnom native kandidatu.

### Provera

**10 ciljanih suite-ova / 299 PASS / 0 FAIL / 0 SKIP; TypeScript exit 0; git diff --check exit 0.**
U prvom prolazu sedam starih očekivanja za raspored/tekst je palo; ažurirana su prema novom vlasnikovom zahtevu, uz zadržane route, odustajanje, receipt i ownership kontrole. Nije ponavljana puna regresija. Posle prolaza promenjeni su samo objašnjavajući komentari.

RN-web provera stvarnih prezentacionih komponenti: profil sa pokaznim brojkama, Podešavanja 390×844 i 320×568, nacrt 390×844 i 320×568, kartice sa osam prijava i odvojenim 0/2 i 1/2. Sve komande nacrta 48×48, redovi Podešavanja najmanje 48, nema horizontalnog preliva na 320; završna odjava dostupna skrolovanjem. Ovo ne potvrđuje Android tastaturu, TalkBack, FPS, push niti backend izvršenje.

Dokaz: `accountAndActionsReview` u postojećoj JSON evidenciji, precizni source hash-evi, test log i novi kontrolni snimci. Demo ocena 4,8 / 12 i 18 završenih postoji samo u proof harness-u. Novi APK nije napravljen/instaliran; nema server promena, git push-a ili Figma izmene.

### Sledeći redosled

Prvo radni profil, Dogovori, Poruke i Obaveštenja kao stvarne kompozicije sa svim potrebnim stanjima. Potom dovršiti vizuelni/action audit ostatka inventara i otvorene funkcionalne ugovore iz odeljka 9. Tek nakon završene integracije i source provera ide jedan kandidat, pa kompletan native prolaz. Nijedna otvorena funkcionalna stavka nije zatvorena ovim vizuelnim krugom.

## Presek svih tokova — 20.10.2026.

Izveštajni audit na zahtev vlasnika. Runtime, Figma i server nisu menjani; nema builda/instalacije. Prethodna granica ostaje: 65 mapiranih specifikacionih površina i 786 Figma čvorova reakcija nisu kompletan prenos; 0/11 svih Master scenarija potvrđeno je na ovom novom objedinjenom native kandidatu.

Svež DEV read-only potvrđuje rpc_select_response i worker_calendar_conflict, otkazivanje/rpc_cancel_agreement, uslovljeno ponovno otvaranje preostale potrage, kao i uključene okidače koji preko refresh_worker_calendar_event oslobađaju termin kada Dogovor više nije CONFIRMED. To su pročitane definicije, ne izvršen višekorisnički scenario.

**OPEN-TEMPORAL-FREEZE-UX:** lokalni TIME_CONFLICT_FROZEN nije završen ugovor. Aktivni need_candidate_states_v5 koristi STALE za nepodobnost; candidateClientService ne prihvata frozen stanje; sopstvene prijave nemaju privremeni status. Stara private.candidate_projection(uuid) iz lokalnog SQL predloga nije instalirana na DEV-u. Predlog se ne primenjuje naslepo. Potrebno povezati autoritativni razlog, obe projekcije, oba UI ugla i uslovljeni povratak podobnosti.

**OPEN-APPLICATIONS-ACTIVE-ARCHIVE:** Moje prijave počinju na Sve, server izabrane prijave računa u pažnju. Potrebno Aktuelne kao početak, jasno privremeno pauziranje i istorija sa razlozima; prihvaćene vode u Dogovore. Proveriti prioritet revizije pre zatvorenog stanja u private.my_application_state. Ne rešavati samo preimenovanjem tabova.

Zatvaranje naloga postoji kao imenovan ulaz u Privatnost i podaci, sa pregledom ograničenja i eksplicitnom potvrdom. Preporuka: zadržati naziv i potvrdu, ne svesti nepovratnu radnju na usamljenu kantu. Brisanje nacrta ima kompaktnu ikonu, objavljen zadatak otkazivanje, a zadatak sa izabranim ljudima vodi u Dogovore.

Profil/Podešavanja imaju stvarno prenetu kompoziciju; radni profil, Dogovori, Poruke i Obaveštenja i dalje imaju otvoren vizuelni prenos/validaciju. Otvoreni grupni mediji/saglasnosti, regionalna pokrivenost, atomarna zamena objave i AI rok prijava ostaju u registru. Stari i ciljani testovi nisu proglašeni novim završnim prolazom.

Dokaz: productFlowAudit u postojećoj evidenciji; NATIVE_FLOW_SERVER_READONLY_20261020.json sadrži datirane definicije. Potpun korisnički presek i kopija dokaza su u outputs/USKOCI-INTEGRACIJA-20261020/PRESEK_SVIH_TOKOVA_20261020.md i .json ovog radnog razgovora.

## Dodatak — jedinstveni filteri i mirna međustanja (najnoviji vlasnikov nalog)

Ovaj nalog menja raniji predlog iz istog dokumenta da mapa ima zasebnu gornju pretragu: na mapi je sada jedna komanda **Filteri**. U njoj su potvrđeno mesto preko LocationIQ, način rada, model cene i vreme. Pretraga mesta ostaje u filteru, a potvrđeni predlog pomera native kameru na približnu oblast; P6 oblast se čita nakon smirivanja kamere. Red „Svi zadaci na lokaciji” bira isključivo rad na lokaciji. Mapa zadržava pinove, kartice, gestove i tri položaja panela. Potvrđena oznaka mesta pamti se lokalno po nalogu samo uz istu smirenu P6 oblast; pri promeni oblasti se briše. Izvori: `src/ui/v2/discovery/DiscoverySearchBar.tsx`, `DiscoverySearchPanel.tsx`, `src/ui/v2/DiscoveryPresentation.tsx`, `src/data/confirmedDiscoveryMapPlace.ts`. Native E2E još nije izveden.

Polje najmanje fiksne cene ima lokalni klijentski ugovor, ali je iza `EXPO_PUBLIC_P6_MIN_BUDGET_FILTER=1`. SQL u `supabase/candidates/discovery-min-price-20261020/` je neprimenjen kandidat bez PostgreSQL izvršnog dokaza; DEV RPC i pravi build nisu promenjeni. Kombinacija „Ponude + minimum” nije dozvoljena, a u „Oba + minimum” ponude ostaju u rezultatima. Ne prikazivati minimum kao aktivnu mogućnost pre server readback-a.

Uklonjeni su gornji meni sa tri tačke u task AI razgovoru i generički naslovi aktivnog nacrta. Uklanjanje aktivnog nacrta koristi postojeći `abandon` i proveru ishoda; to nije trajno brisanje istorije. Potvrđeno `OPEN` stanje ostaje dostupno čak i kada lista privremeno nije učitana. Task i radni AI zadržavaju poslednji učitan razgovor posle dokazanog prekida čitanja, uz zaključano slanje/čuvanje do nove potvrde; serversko odbijanje ostaje autoritativno. Radni AI nema potvrđen list/archive/delete ugovor. Izvori: `src/ui/aiFirst/AiConversationShell.tsx`, `src/ui/home/IntakeResume.tsx`, `src/data/aiOpenIntakes.ts`, `src/hooks/useOwnedEditor.ts`, `src/app/(app)/nova.tsx`, `src/data/workerAiClientService.ts`, `src/app/(app)/profil/razgovor.tsx`. Stvarnu istoriju radnog razgovora ne obećavati bez server ugovora.

Prva čitanja prijave, izbora kandidata, Dogovora, oba detalja zadatka, radnog profila, izmena Dogovora, zatvaranja naloga i ocene sada koriste mirna označena stanja umesto sivih lažnih kartica. Izvor: `src/ui/v2/QuietReadState.tsx` i vlasnici ekrana. Greške i oporavak ostaju zasebna stanja. Ciljano integrisano: 18 Jest grupa, 1004/1004 PASS, TypeScript exit 0, `git diff --check` exit 0. Ovo nije native/APK prohod. Figma statusi REQ-02-09, REQ-05C-10, REQ-05C-12 i REQ-07-10 ostaju native nepotvrđeni.

## Dodatna međustanja i provera ugovora — 21.10.2026.

Prvo čitanje grupe, pitanja na zadatku, javnog profila, AI radne teme i četa Dogovora više ne prikazuje sive lažne redove ili prazninu. Moj profil i njegova nezavisna čitanja ocena i završenih Dogovora sada imaju imenovan tekst umesto sivih privremenih brojki. Izvori: `src/ui/groups/GroupConversationEntry.tsx`, `src/ui/qa/TaskQaPresentation.tsx`, `TaskQaInline.tsx`, `src/ui/system/PublicProfileSheet.tsx`, `src/ui/workerProfile/WorkerAiTopicEntry.tsx`, `src/ui/AgreementChat.tsx`, `src/ui/profile/ProfileHubPresentation.tsx`, `ProfileFigures.tsx`. Ciljano: profil 4 suite-a 122/122; ostala prva čitanja 5 suite-ova 217/217; čet Dogovora 2 suite-a 79/79. Skupove ne sabirati kao jedinstven novi prolaz.

Naslov task AI aktivnog nacrta oslanja se na potvrđen `need.title`, a ne na inferenciju (`src/data/aiOpenIntakes.ts`). Radni AI nema potvrđeno server listanje/arhiviranje/brisanje istorije; bez njega se takva radnja ne dodaje samo kao ikona. Proveren kandidat za P6 minimum cene ima 5/5 statičkih SQL provera i 162/162 ciljanih klijentskih, ali nema izolovani PostgreSQL 17 izvršni dokaz na ovom hostu. Flag ostaje isključen, SQL nije primenjen na DEV ili produkciju. Donja navigacija nad listom Zadataka je statički namenjena da ostane vidljiva; 3 ciljana suite-a 42/42 prolaze. HONOR izgled i dalje treba proveriti na jednom završnom kandidatu.

Novi unos prijave zadržava neposlate podatke pri Back/remount-u u procesu, ključem `[accountId, accountRevision, needId]` (`src/data/applicationComposerDraftMemory.ts`, `src/app/(app)/prilike/[id]/prijava.tsx`). Čim je tačna komanda trajno uhvaćena, ta memorija se briše; nepoznat ishod pripada postojećem journal-u. Ovo ne obećava oporavak posle gašenja procesa. Ciljano: 3 suite-a 72/72, TSC i diff check prolaze; Jest open-handle upozorenje ostaje, native Back nije proveren.

Moje prijave sada čuva započetu izmenu kroz gubitak fokusa, pozadinu i read; pri Back/tab/close ili drugoj radnji koja odbacuje tekst traži izričitu potvrdu. Nacrt pripada tačnoj reviziji prijave i zadatka: promenjena projekcija zadržava upisani tekst, ali blokira Save. Potvrđen UPDATE ga briše posle readback-a. Izvor: `src/app/(app)/moje-prijave.tsx`, `src/ui/v2/MyApplicationsPresentation.tsx`; ciljani test 62/62, TSC i diff check exit 0. Native Android Back/gest nije proveren.

Read-only audit mape/liste: nema potvrđene P1 regresije u izvoru. Filteri su jedina primarna gornja komanda; potvrđena LocationIQ tačka ide u kameru tek po primeni; mapa i lista dele viewport, FULL lista ima povratak na mapu, kraj rezerviše visinu navigacije, a pin ima ciljanu karticu. Dokaz: `DiscoverySearchBar.tsx`, `DiscoverySearchPanel.tsx`, `DiscoveryPresentation.tsx`, `DiscoveryMap.tsx`, `DiscoveryPeek.tsx`, `ZadaciNavigationBar.tsx`; 6 ciljnih suite-ova 420/420 PASS uz native mock. Stvarni touch/gest/kamera na HONOR-u nije potvrđen.

Zajednički AI razgovor sada pokazuje imenovan „Novi razgovor” pri kraju niti umesto zagonetne refresh ikonice u desnom delu zaglavlja. Radni AI ima zaseban „Napusti razgovor” sa potvrdom i `api.abandon` + readback istog razgovora; samo potvrđen `ABANDONED` vodi na radni profil, a OPEN/neuspešno čitanje zadržava neposlati tekst i oporavak. Izvori: `src/ui/aiFirst/AiConversationShell.tsx`, `src/app/(app)/profil/razgovor.tsx`. Ciljano 3 suite-a 333/333, TSC/diff check exit 0. Kontrola na 320 dp je statička; stvarni Android raspored nije pregledan. Server history delete i dalje nema ugovor.

### Nezavisni pregled i regresija — 21.10.2026.

Ulaz sa konkretnim `prijavaId` ne sakriva nesnimljenu izmenu druge prijave: potvrda odlučuje o odbacivanju, a zastareli callback druge revizije naloga nema dejstvo (`src/app/(app)/moje-prijave.tsx`; 64/64 fokusiranih testova, TSC). Mapa potvrđuje LocationIQ oznaku samo uz kadar koji sadrži njenu tačku; tuđ kadar može osvežiti P6, ali ne može da sačuva pogrešan naziv (`DiscoveryPresentation.tsx`; 238/238 fokusiranih testova, TSC). Oba toka čekaju native probu gestova i kamere.

Prvi puni Jest prolaz pronašao je zastarela očekivanja kompozicije i nedostajuću izolaciju process-local memorije neposlate prijave između testova; promenjeni su testovi, bez slabljenja produkcionog ownership-a ili cache-a. Završni objedinjeni prolaz bez opterećenog Firebase testa: **627/627 suite-ova, 14.151 PASS, 9 SKIP, 0 FAIL**; Firebase konfiguracija odvojeno **13/13 PASS**. Njegov child process je u prvom punom nizu prešao tvrdi rok od 15 sekundi, a izolovano radi. `npx tsc --noEmit --pretty false`, `git diff --check` i JSON parsiranje `redovi.json` exit 0. Jest je zahtevao `--forceExit` zbog otvorenog asinhronog handle-a; poreklo nije istraženo. Ne upisivati 628/628 kao rezultat jednog procesa ili native prihvatanje.

Registar `docs/control/redovi.json` je dopunjen za A02/B00/B04/B05/B09/B10/B11 bez zatvaranja toka. `node scripts/control/osvezi.mjs` i LIVE refresh/check su prošli; 62 reda, 0 done, 52 native-device i 10 open. Ovo je klasifikacija pre novog kandidata i dvonaložnog HONOR prohoda, ne automatsko prihvatanje ekrana.

### Kompozicija povezanih ekrana — 21.10.2026.

Filter panel sada počinje mestom na mapi; način rada, cena i vreme slede, a pretraga zadataka je sekundarna radnja posle filtera. Posebna pretraga i tri tačke nisu vraćene na mapu (`DiscoverySearchPanel.tsx`, `DiscoverySearchBar.tsx`).

Dogovori na listi i u detalju prikazuju ulogu trenutnog korisnika. Prihvaćena cena i obuhvat pripadaju pojedinačnoj saradnji; `pokrivenost` na ovom read-u nije autoritet da su prijave za ceo zadatak otvorene (`AgreementListCard.tsx`, `AgreementOverview.tsx`, `AgreementOverviewParts.tsx`, `agreementListModel.ts`). Poruke pokazuju stvarni kontekst zadatka i vreme, status završenosti samo kada je potvrđen, a privatni izbor poruke za Podršku ostaje dostupan TalkBack-u (`ConversationInboxPresentation.tsx`, `GroupConversationPresentation.tsx`, `AgreementChat.tsx`). Obaveštenja pri osvežavanju čuvaju poslednji potvrđen sadržaj/prazno stanje i izričito objašnjavaju neuspeh (`InboxPresentation.tsx`).

Zajednički ciljani prolaz posle ovih izmena: **16 Jest suite-ova, 758/758 PASS**, TypeScript i diff check exit 0. Prethodni puni 627/627 + odvojeni Firebase 13/13 prethodi ovom paketu. Jest open-handle upozorenje ostaje. `adb devices -l` vidi samo emulator, pa ovo nije HONOR vizuelni niti celoviti dvonaložni dokaz. Nema novog APK-a, DEV/server ili Figma izmene. AI history delete, P6 minimum cene, task-wide otvaranje/zamena, grupni lifecycle u Inbox-u i svih 11 Master scenarija ostaju otvoreni.

### Lokalni povezani UI prolaz — 21.10.2026.

Nastavak po najnovijem vlasnikovom nalogu u postojećem Expo izvoru. Mapa ima samo `Filteri` kao gornju primarnu radnju; potvrđeno mesto preko LocationIQ, način rada, model cene i datum su u centriranom panelu. Novi nepotvrđen tekst mesta ne nasleđuje stari centar. P6 promena mesta čeka nove `map.wholeBounds` pre automatskog uklapanja kamere, a ručni gest ga otkazuje. Povratak posle greške čuva nameru do izričitog retry-a. Polje najmanje fiksne cene ostaje isključeno dok aktivni DEV P6 ne dobije ugovor; `Oba + minimum` mora zadržati ponude. Izvori: `DiscoverySearchPanel.tsx`, `DiscoveryPresentation.tsx`, `confirmedDiscoveryMapPlace.ts`.

Task i worker AI napuštanje/novi razgovor proveravaju isti CID i status posle izgubljene ili odbačene potvrde. Neposlat tekst ostaje kad ishod nije potvrdan; worker ručna provera ne započinje drugi read dok prvi traje. Lista na Početnoj govori samo o razgovorima koji se mogu nastaviti; „Napusti” izričito nije trajno brisanje. Read-only DEV katalog nema potvrđen owner list/hide/delete API za celu AI istoriju (`AI_CONVERSATION_HISTORY_CONTRACT_20261021.md`). Izvori: `nova.tsx`, `profil/razgovor.tsx`, `IntakeResume.tsx`.

Prvi ulaz omogućava „Prijavi se” i „Napravi nalog” tokom dekorativnog introa (`EntryWelcome.tsx`), bez obaveznog „Preskoči”. Moje prijave običnim ulazom čitaju `ACTIVE` kao „Čekaju odgovor”; `ATTENTION`, `HISTORY` i `ALL` ostaju zasebni, a ulaz sa `prijavaId` počinje u `ALL`. Read-only DEV definicija potvrđuje da `SELECTED` pripada `ATTENTION`; to nije novi upis. Javni profil razlikuje prazan server rezultat od read greške, podrška ne prikazuje paginiran broj kao tačan, a Dogovor tekst otkazivanja ne obećava automatski novu potragu. Prva čitanja користе мирно именовано стање уместо сивих лажних картица. Извори: `moje-prijave.tsx`, `MyApplicationsPresentation.tsx`, `PublicProfileSheet.tsx`, `hubStates.ts`, `AgreementOverviewParts.tsx`, `QuietReadState.tsx`.

Cross-flow source audit je potvrdio neposredne route/readback granice za radnik zadatak→prijava→Moje prijave i owner kandidati→izbor→Dogovor, ali nije izvršio dva naloga. Task-wide `2/3` posle jednog otkazivanja nije autoritativno dostupan na listi Dogovora (`DOGOVOR_TASK_CAPACITY_GAP_20261021.md`), privremeni vremenski freeze prijava nema dogovoren server status u obe projekcije, a push „Nova prijava” nema potvrđen event ID za direktan fokus na baš tu prijavu (`PUSH_NOVA_PRIJAVA_TARGET_GAP_20261021.md`). Ne izvoditi ove statuse iz samog izgleda.

Prvi široki Jest prolaz imao je 624/627 PASS; tri stara testa još su tražila „Traži/Treba N osoba” na live detalju umesto ugovorenog `x/y izabrano`. Samo ta zastarela očekivanja su usklađena, uz očuvanu zasebnu proveru broja prijava. Završni zajednički prolaz nakon svih izmena: **627/627 suite-ova, 14.197 PASS, 9 SKIP, 0 FAIL, 3/3 snapshot-a**, JSON `success: true`. Izdvojeni Firebase je **13/13 PASS**; TSC i `git diff --check` exit 0. Jest i dalje zahteva `--forceExit` zbog otvorenog handle-a. Native HONOR nije viđen u ADB-u (samo `emulator-5554`), nema novog APK/OTA, nema DEV/production/Figma/GitHub promene. Detaljan dokaz i granice: `outputs/USKOCI-NATIVE-20261020/STATUS_POVEZANOG_UI_20261021.md` u radnom prostoru ovog razgovora.
