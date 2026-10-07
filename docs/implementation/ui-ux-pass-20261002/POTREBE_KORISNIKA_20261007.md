# USKOČI — šta korisniku treba (pregled očima dve osobe)

**Datum:** 7–8. 10. 2026 · **Radio:** agent za potrebe korisnika (model nasleđen: Sonnet 5.5), samo čitanje · **Izvor:** kod u `USKOCI-CLEAN-spoj-20261006/src` (radno stablo, sa nezavršenim izmenama drugih timova; linije mogu da se pomere), snimci telefona od 7.10. (`emu/phone2`), stariji snimci emulatora, UX plan, `redovi.json`, odluke vlasnika. Nisam dirao kod, server, DEV, telefon ni emulator.

**Oznake uz tvrdnju:** (K) proverio u kodu, fajl:linija pod `src/` · (S) viđeno na snimku · (D) iz dokumenta u repou · (P) pretpostavka, nije proveren.
**Prioritet:** P0 = kvari ili zaustavlja glavni tok ili poverenje, pre prvog pravog korisnika · P1 = jasno povećava korist, uskoro · P2 = poželjno.
**Tim sam?** DA = samo aplikacija, bez novca, cena, pravnog teksta, ključeva, push-a, prodavnice i novih paketa · DELIMIČNO = aplikacija DA, server priprema i dokazuje (primena po stalnom ovlašćenju samo ako ne pomera sertifikat ni privatnost) · NE = traži vlasnika.
Tekstovi u navodnicima koje predlažem su nacrti za pregled: „ti“, bez roda, „zadatak“, nikad „posao“.

---

## 0. Glavni zaključak

Glavni tok (objava → prijava → izbor → Dogovor → poruke → završetak → ocena) postoji i ima pažljiva stanja grešaka i oporavka. Plan od 7.10. uglavnom popravlja izgled i doslednost. Ovaj pregled pita šta korisniku **nedostaje u životu** i nalazi četiri grupe rupa koje plan ne pokriva:

1. **Dan izvršenja.** Broj telefona ne može da se upiše ni podeli; nema „Pozovi“; Dogovor bez tačnog termina nema korak „dogovorite vreme“; nema podsetnika; adresa se ne može zatražiti.
2. **Novac i pravila.** Nigde ne piše kako se plaća, ni 18+, ni šta se ne sme objaviti, ni šta se može očekivati od podrške. Te rečenice odobrava samo vlasnik.
3. **Vest o tome šta se desilo.** Obaveštenje ne kaže o kom je zadatku reč; „nije izabrana“ i „zadatak je istekao“ server (po kodu u repou) nikad ne šalje; donja traka nema značke; za lične razgovore ne postoji „nepročitano“.
4. **Prvi susret.** Prazan razgovor sa AI nema primera (38 od prvih 62 razgovora nikad nije dobilo poruku); osoba koja radi tek pri prijavi sazna da joj treba radni profil; prekidači „Za mene“ i „alat i vozilo nisu uslov“ su isključeni iako je server 7.10. primenjen.

**Šta već valja (ne dirati):** oporavak razgovora sa AI posle prekida; pregled pre objave sa javnim i privatnim mestom; potvrda izbora koja kaže šta se prihvata; poređenje prijava; Dogovor sa koracima, izmenama, otkazivanjem uz razlog i kontrolisanom privatnom lokacijom; Raspored sa arhivom; „Čeka te“; dozvole uz objašnjenje.
**Plan od 7.10. već pokriva (ne ponavljam):** porodica pin–kartica–detalj, kartica prijave, rečnik stanja, starost zadatka, „Za mene“, zvezdica, pretraga u panelu, dijalozi i ikone, Raspored, Objavljeno/Dogovoreno.

---

## 1. Dve osobe i njihovi trenuci

### 1A. Osoba sa zadatkom („Tražiš pomoć“)

| Trenutak | Šta želi | Šta aplikacija daje danas | Šta FALI | Zbunjuje · nervira |
|---|---|---|---|---|
| **Prvi susret: ulaz, registracija** | Da shvati da je za njega, da je besplatno i bezbedno, da ne popunjava mnogo | Ulaz sa dva stuba; registracija: ime, prezime, grad, email, lozinka; potvrda emaila (`app/auth.tsx:381-452`) | Rečenica šta je USKOČI i da je besplatno; 18+ i šta se ne sme objaviti (nigde, K); „Otvori email“ posle registracije | Grad je slobodan tekst: „Novi SAD“ u profilu (S p09); svaka greška registracije je jedna rečenica (`data/authClientService.ts:37`); „pravila još nisu objavljena“ (`auth.tsx:51`) |
| **Dozvole** (obe osobe) | Da ga ništa ne iznenadi | Pitanje sa slikom pre sistemskog prozora za mikrofon, fotografije i lokaciju: „Dozvoli“ / „Ne sada“ (`ui/permissions/permissionAsk.ts`); odbijeno se vraća kroz Podešavanja telefona | Pitanje za obaveštenja je napisano, ali ga ništa ne poziva (`ui/permissions/notificationAsk.ts`); čeka odluku „push na kraju“ | — |
| **Prva objava** | Da opiše svojim rečima i da brzo bude gotovo | Razgovor sa AI (glas, fotografije, mesto na mapi), pregled sa „Još treba“ (`nova.tsx`, `pregled-zadatka.tsx`) | Primeri rečenica (podržani, niko ih ne šalje: `ui/aiFirst/AiConversationShell.tsx:61`); rezervni put kad AI ne radi (ručni unos ukinut; AI je 2.10. pao zbog potrošenog kredita, D); razlog kad AI odbije: „Ovaj zahtev ne može da nastavi kroz AI unos.“ (`data/aiNeedV2Ui.ts:403`) | 38 od prvih 62 razgovora bez ijedne poruke (komentar `nova.tsx:112`); „tačka na mapi“ kao uslov; nacrt sa prošlim terminom (S p53) |
| **Objavljeno i čekanje** | Da zna da je objavljeno i šta sledi | Trenutak „Objavljeno“, pa pregled zadatka; Moj zadatak: „Čekaš prijave. Javićemo ti.“ (`data/ownTaskStanding.ts:58`) | Ne kaže koliko je ljudi obavešteno ni do kada prima prijave (rok je samo u javnom pogledu, `contracts/projections.ts:118`); posle 24 h bez prijava nema saveta | „Javićemo ti“ obećava obaveštenje, a push još nije uključen (D); dva zadatka istog naslova liče jedan na drugi (S p07) |
| **Izbor ljudi** | Da uporedi i izabere pravu osobu | Prijave redom pristizanja ili po ceni, „Uporedi“, ocena i broj ocena, poruka, javni profil; potvrda „Izabrati ovu prijavu?“ (`ui/v2/ApplicationSelectionPresentation.tsx`) | Odbij/sakrij prijavu i privatno pitanje pre izbora (ne postoji, K); alat i vozilo (podatak stiže, ne crta se: `data/candidateClientService.ts:117`; odluka 7.10. kaže da ih vidi); pouzdanost (server 7.10., klijent ne); sort po oceni | Izbor „odmah važi za obe strane“; neizabrane prijave ostaju „Poslata“ |
| **Dogovor: termin, adresa, kontakt** | Da zna kad dolazi, da ga može pozvati i da mu da adresu | Koraci, uslovi, „Kontakt i mesto“, poruke (`app/dogovor/[id].tsx`, `ui/agreements/AgreementSteps.tsx`) | Korak „dogovorite vreme“ kad je termin „nije potvrđen“ (`AgreementWorkspace.tsx:63` kaže samo „Dogovoreno“); broj ne može da se upiše ni podeli (`data/legacyRpcFailure.ts:50`); „Pozovi“ (`tel:` se ne koristi nigde); podsetnik da podeli adresu; rečenica o plaćanju | Dugme „Podeli svoj broj“ (`ui/agreements/agreementMenu.ts:46`) za svaki nalog napravljen emailom vraća grešku; Početna kaže „Ništa ne čeka tvoju odluku“ iako je Dogovor bez termina (S p02, p04) |
| **Dan izvršenja** | Da zna da druga osoba stiže i da je može dobiti | Raspored, Početna „Raspored“, poruke (tekst, slika, glas), „Otvori navigaciju“ kad je adresa podeljena (`ui/location/LocationMapPreview.tsx:131`) | Podsetnik pre termina (odloženo, A22); brze poruke „Krećem“ / „Kasnim“ (plan P3); značka „nova poruka“ — za lične razgovore server ne čuva čitanje (`ui/messages/ConversationInboxPresentation.tsx:139`) | Ne vidi da li je druga strana pročitala poruku |
| **Poruke** (četvrti tab, obe osobe) | Da nađe razgovor i vidi šta je novo | Lista razgovora po Dogovoru i grupi, poslednja poruka i vreme; dodir vodi pravo u taj Dogovor (`app/(app)/poruke.tsx`) | „Nepročitano“ za lične razgovore; razlika aktivni / završeni (R13, R17) | Završeni razgovori stoje pored aktivnih (S p05, p27); ista osoba uz više zadataka izgleda isto |
| **Izmene i otkazivanje** | Da promeni ili otkaže bez svađe | Predlog izmene, povlačenje predloga, otkazivanje uz razlog (slobodan tekst), „Ponovo traži ljude“ | Čipovi razloga (plan 2.3); prikaz ko, kada i zašto je otkazao (server gotov 7.10., klijent čeka, D) | Posle „Prijavi problem“ nema sledećeg koraka: kartica samo kaže da je automatsko završavanje zaustavljeno (`app/dogovor/[id].tsx:474`) |
| **Završetak i ocena** | Da potvrdi i oceni pošteno | „Potvrdi završetak“, pa ocena: zvezdice, oznake, komentar (`ui/reviews/AgreementReviewPresentation.tsx`) | Pre čuvanja ne piše da je ocena konačna (piše tek posle, `:106`); za 1–2 zvezdice nema oznaka problema, sve su pozitivne (`:23`) | Automatsko potvrđivanje („Bez odgovora se Dogovor zatvara sam“) bez podsetnika |
| **Sledeći put** | Da lako ponovi | Moji zadaci › Istorija; „Oceni završen Dogovor“ na Početnoj | „Objavi ponovo“ (plan P2), „Pozovi istu osobu“ (odloženo), sačuvani zadaci (plan) | — |

### 1B. Osoba koja radi („Uskačeš“)

| Trenutak | Šta želi | Šta aplikacija daje danas | Šta FALI | Zbunjuje · nervira |
|---|---|---|---|---|
| **Prvi susret** | Da odmah vidi zadatke, profil kasnije | „Uskoči i zaradi“ vodi na Zadatke; svi zadaci su vidljivi (odluka 7.10.) | Pre prijave nigde ne piše da je potreban radni profil i čemu služi; red „Podesi radni profil“ na Početnoj | Tek pri prijavi: „Bez njega ne možeš da se prijaviš na zadatak“ (`ui/workerProfile/WorkerProfilePresentation.tsx:213`); „Dok je nacrt, zadaci ti se ne nude“ posle odluke da se sve vidi |
| **Radni profil** | Da ga napravi za dva minuta i zna čemu služi | Razgovor (glas ili tekst) ili ručno, pregled, rečenica o obaveštenjima | Red „Na šta ovo utiče“ (plan T4b) | Ekran i dalje tvrdi da alat/vozilo koji nemaš znači „ne možeš da se prijaviš“ (`workerProfileFacts.ts:19`, prekidač isključen, a MATCH-V1 je primenjen 7.10., D) |
| **Traženje** | Da brzo nađe zadatak blizu sebe | Mapa + lista, filteri, „Najnovije prvo“, pin → kartica → detalj (S p03) | „Za mene“ (`workerProfileFacts.ts:26` isključen, server primenjen 7.10.); udaljenost od područja rada; sačuvaj, podeli | Mapa se otvara na celoj Srbiji sa dva pina (S p03); prazna lista ne nudi „Uključi obaveštenja“ ni „Objavi i ti“ (`ui/v2/DiscoveryPresentation.tsx:1116`) |
| **Detalj** | Da odluči da li da se javi | Naslov, cena, mesta, približno mesto, vreme, opis, „Važno“, pitanja i odgovori, ko je objavio, „Sastavi prijavu“ | „Ocena 4,7“ bez broja ocena (`ui/v2/PublicNeedPresentation.tsx:77`; broj postoji, `projections.ts:136`); starost „pre 2 dana“ (plan); preklapanje sa mojim Dogovorom pre pisanja prijave | Broj tuđih prijava je svesno sakriven (`projections.ts:106`) — ne predlažem |
| **Prijava** | Da pošalje ponudu bez greške | Cena, ljudi, tačan termin ili „termin zadatka“, poruka, pregled „Ovo šalješ“ | Preklapanje termina javlja tek posle slanja (`data/applicationSelectionClientService.ts:41`); orijentir za cenu (vlasnik) | — |
| **Čekanje** | Da zna gde je prijava | Moje prijave: Sve, Čeka te, Aktivne, Završene; Poslata, Viđena, Izabrana, Nije izabrana, Povučena | Vest da je izabrana druga osoba ili da je zadatak istekao (događaji se ne šalju, vidi R14) | „Poslata“ ostaje nedeljama; kad se potraga zatvori, stiže „Zadatak je otkazan“ (K: `supabase/candidates/pkg029a_notifications_reach.sql:93`) |
| **Izabran** | Da zna šta dalje | „Izabran si“ (muški rod, plan popravlja), „Otvori Dogovor“ | Isto što u 1A: termin, adresa, kontakt | Obaveštenje ne kaže za koji zadatak |
| **Dan izvršenja** | Da stigne i javi se | Raspored; poruke; adresa tek kad je podeli druga strana; „Zadatak je gotov“ | „Zatraži adresu“; „Pozovi“; „Mogu odmah“ na Početnoj (danas Profil › Dostupnost); podsetnik | „Mogu odmah“ nikad ne ističe sam (D: MATCH-V1 `coalesce(available_now,false)`) |
| **Posle** | Da gradi ugled | Ocena; broj završenih u profilu | „Moja statistika“, „Primljene ocene“, pouzdanost (server 7.10.; klijent ne); sačuvani zadaci (plan) | — |

### 1C. Kad nešto pođe naopako (za obe osobe)

| Situacija | Šta se danas desi | Šta fali |
|---|---|---|
| Nema prijava | „Čekaš prijave“ bez roka; „Još nema prijava“ + „Osveži“ | Savet posle 24 h; „Podeli“; „Izmeni zadatak“ se ne nudi |
| Termin prošao (nacrt) | Objava je blokirana: „Početak termina je već prošao“ (S p53) | Jedno dugme „Izmeni termin“ (plan 3.3) |
| Termin prošao (objavljen) | Čip „Istekao“, „Rok za prijave je istekao bez izbora.“ (`ownTaskStanding.ts:86`) | Obaveštenje; „Objavi ponovo“ (plan) |
| Druga strana otkazala | „Druga strana je otkazala Dogovor. Razlog je u Porukama.“ (S p40) | Koji Dogovor; razlog u samom obaveštenju |
| Druga osoba nije došla | „Prijavi problem“ zaustavlja automatsko završavanje | Sledeći korak: otkaži, ponovo traži, piši podršci (R04) |
| Nema veze ili greška | Svaki ekran ima svoje „Pokušaj ponovo“; isti tekst „Proveri internet vezu“ za svaku grešku | Razlikovati; poslednje učitano (R31) |
| AI ne radi | „AI trenutno nije dostupan“ (D) | Rezervni put; obaveštenje kad se vrati (R19) |
| Blokiranje druge osobe | Iz profila ili Dogovora („Prijavi ili blokiraj osobu“); potvrda kaže posledicu (`ui/safety/SafetyScreen.tsx:28-29`) | Blokiranje iz same prepiske (plan T3c); podnaslov „…i privatne prijave“ u Profilu vara (S p10; plan 3.8) |
| Nalog zatvoren ili ograničen | Poseban ekran za svako; ograničen nalog nema kontakt (odluka d08) | Odluka vlasnika |

### 1D. Odgovori na tvoja pitanja

- **Može li da se vrati korak?** Delimično. Da: nazad čuva nacrt i tekst, povuci prijavu, povuci predlog, opozovi deljenje lokacije. Ne: izbor prijave, brisanje nacrta, završetak, ocena; jedini izlaz je otkazivanje uz razlog.
- **Vidi li se status Dogovora i šta je sledeće?** Da, osim kad nema tačnog termina (R02).
- **Zna li osoba koja radi zašto je dobila obaveštenje?** Ne: „Pojavila se nova prilika koja može da ti odgovara“ bez razloga i bez naziva zadatka (R11, R15).
- **Šta posle „nema prijava“?** Danas ništa (R16).
- **Šta posle isteka termina?** Nacrt ne može da se objavi dok se termin ne izmeni; objavljen dobija „Istekao“ bez obaveštenja i bez „Objavi ponovo“ (R14).
- **Može li da podeli, zove, otvori navigaciju?** Navigaciju da (kad je adresa podeljena); poziv ne (R01); deljenje zadatka ne (R35).
- **Pomoć iz konteksta?** Ne (R32).
- **Pretraga i „Za mene“?** Pretraga u panelu da; „Za mene“ gotov na serveru, prekidač isključen (R28).
- **Sačuvani zadaci?** Ne; odluka d05 je „da“, talas 3.
- **Ocena, poverenje, pouzdanost?** Ocena i broj završenih da; pouzdanost, statistika, primljene ocene i razlog otkazivanja: server gotov, klijent ne (R30).

---

## 2. Stanja ekrana: prvi put, prazno, učitavanje, greška, bez veze

Gde piše „ponovo“, postoji dugme „Pokušaj ponovo“. **Bez veze** nema svoje stanje: vrsta `offline` u `ui/system/StateView.tsx:9` postoji i niko je ne koristi, pa svaka greška glasi „Proveri internet vezu“ (R31).

| Ekran | Prvi put · prazno | Učitavanje | Greška | Nudi sledeći korak? |
|---|---|---|---|---|
| Početna | „Kako radi“ (3 koraka) za novi nalog; „Ništa ne čeka tvoju odluku.“ | skelet | „Pregled trenutno nije učitan“ + „Osveži pregled“ | Da, dva velika dugmeta |
| Zadaci | „Trenutno nema otvorenih zadataka“ + „Osveži zadatke“ | skelet | „Zadatke trenutno nije moguće učitati“ + ponovo; mapa: „Mapa nije učitana“ (S) | Slabo: nema „Objavi zadatak“ ni „Uključi obaveštenja“ |
| Detalj zadatka | — | skelet | ponovo; „Zadatak nije dostupan“ bez dugmeta nazad (plan) | Delimično |
| Prijava (forma) | „Radni profil još nije aktivan“ + „Dopuni radni profil“ | tekst | „Ne znamo da li je prijava stigla“ + „Pošalji istu ponudu“ | Da |
| Moje prijave | „Još nemaš prijavu“ + „Istraži zadatke“ | skelet | ponovo | Da |
| Moji zadaci | „Još nemaš zadatak“ + „Napravi prvi zadatak“ | skelet | ponovo | Da |
| Moj zadatak | „Čekaš prijave. Javićemo ti.“ | skelet | „Zadatak nije dostupan“ + ponovo | Slabo: nema saveta (R16) |
| Prijave (izbor) | „Još nema prijava“ + „Osveži prijave“ | skelet | ponovo | Delimično |
| Dogovori | „Još nemaš Dogovor“ + „Idi na Početnu“ | skelet | ponovo | Slabo: nije „Objavi“ ni „Pronađi“ |
| Dogovor | — | poslednji sadržaj + „Osvežavamo…“ (nova izmena u radnom stablu) | traka „Osveži status Dogovora“ | Da |
| Raspored | „Ništa nije zakazano za ovaj dan.“ | skelet | „Raspored nije učitan“ + ponovo | Delimično |
| Poruke | „Još nema razgovora“ + „Otvori Dogovore“ | skelet | „Razgovori nisu učitani“ | Da; lični razgovori bez „nepročitano“ |
| Obaveštenja | „Nove prijave, poruke i važne promene stižu ovde“ + „Podesi obaveštenja“ | skelet | „Obaveštenja nisu učitana“ | Da |
| Razgovor sa AI | „Reci šta ti treba.“ (bez primera) | „Otvaramo razgovor“ | „Razgovor nije dostupan“; „Proveri ishod“ | Delimično (R18, R19) |
| Profil | „Ime još nije uneto“ | „Učitavamo profil…“ | „Profil trenutno nije dostupan“ | Da |

---

## 3. Rupe i ideje

Format: ekran · prioritet · tim sam? — problem — predlog — dobit — zavisnost.

### A. Dan izvršenja

**R01 · Dogovor › meni „Podeli svoj broj“, „Kontakt i mesto“ · P0 (a) i P1 (b) · DELIMIČNO**
*Problem:* dugme se nudi svakom, a ne može da uspe: broj se čita iz naloga, nalog napravljen emailom ga nema, nijedan ekran ne dozvoljava upis (K: `agreementMenu.ts:46`, `legacyRpcFailure.ts:50`; poznato od 21.9, D: DEEP_READ_LEDGER 8.4, čeka vlasnikov odgovor). I kad broj postoji, prikazan je kao tekst, bez „Pozovi“ (K: `AgreementContactPlace.tsx:37`).
*Predlog:* (a) odmah: dok nalog nema broj, red se ne nudi; umesto njega „Kontakt kroz Poruke“ + „Otvori Poruke“. (b) uz odluku: „Moj broj telefona“ u Profil › Podaci, bez SMS provere; deli se samo uz tvoj izbor po Dogovoru kao do sada; kad broj postoji, „Pozovi“ (`Linking`, `tel:`, bez paketa) i „Kopiraj“.
*Dobit:* na dan izvršenja jedan dodir do „gde si?“. *Zavisnost:* (b) lični podatak = privatnost (vlasnik) + nova serverska funkcija za upis; SMS potvrda = plaćen spoljni nalog (ne predlažem).

**R02 · Dogovor, lista Dogovora, Raspored · P0 · DA**
*Problem:* kad je termin „nije potvrđen“ (zadatak „fleksibilno“), Dogovor kaže samo „Dogovoreno“ i šta se radi na kraju: „Kada završiš, izaberi Zadatak je gotov“ / „Završetak potvrđuješ kada je zadatak obavljen“ (K: `ui/agreements/AgreementWorkspace.tsx:63`); Raspored ga stavlja u „Bez tačnog termina“; Početna kaže „Ništa ne čeka tvoju odluku“ (S p02, p04, p41). Nije jasno čiji je potez da se dogovori vreme; jedini put je „Izmene i otkazivanje“ › termin.
*Predlog:* kad Dogovor nema početak: kartica „Termin još nije dogovoren“ + „Dogovorite tačno vreme u Porukama, pa ga upišite.“ + zeleno „Predloži termin“ (vodi u Izmene sa otvorenim terminom); isti red u „Čeka te“ na Početnoj za obe strane; nestaje kad se predlog prihvati.
*Dobit:* manje promašenih dolazaka. *Zavisnost:* nema (postojeće radnje).

**R03 · Dogovor › „Kontakt i mesto“ · P1 · DA**
*Problem:* adresu mora da podeli osoba sa zadatkom; osoba koja radi vidi samo „Lokacija još nije podeljena sa tobom ili dozvola više ne važi“ (K: `ui/AgreementPrivateLocation.tsx:132`) i ne može da zatraži; nikome ne stiže podsetnik.
*Predlog:* za Dogovor sa fizičkim mestom, u „Sledeći korak“: osobi sa zadatkom „Podeli adresu kad budete spremni“ + dugme; osobi koja radi „Zatraži adresu“ (šalje običnu poruku „Možeš li da podeliš tačnu adresu?“).
*Dobit:* nema „kome da pišem“ trenutaka. *Zavisnost:* nema; deljenje ostaje opozivo.

**R04 · Dogovor › „Prijavi problem“ · P1 · DA**
*Problem:* posle prijave kartica kaže da je automatsko završavanje zaustavljeno i da prijava „ne određuje krivicu“, bez sledećeg koraka (K: `app/dogovor/[id].tsx:474`).
*Predlog:* ispod, tri izlaza: „Dogovorite se u Porukama“ · „Otkaži Dogovor“ (uz razlog; zatim „Ponovo traži ljude“) · „Prijavi nedolazak“ (otvara Podršku sa ovim Dogovorom unapred izabranim; tema „Prijava nedolaska“ već postoji, K: `ui/support/SupportPresentation.tsx:26`).
*Dobit:* nema slepe ulice kad druga strana ne dođe. *Zavisnost:* ne obećavati rok podrške (vlasnik je jedini operater, D: DEEP_READ_LEDGER 7.31).

**R05 · Podsetnik pred termin · P1 · NE (odluka A22)**
*Problem:* zaboravljen termin je čest kvar usluga po dogovoru (P); podsetnik je izričito odložen (A22).
*Predlog:* kad push uđe: dva lokalna podsetnika po Dogovoru (dan ranije uveče, sat ranije), podrazumevano uključena, isključiva u Podešavanjima; bez teksta zadatka na zaključanom ekranu (A20). Lokalno zakazivanje ne traži server (P: `expo-notifications` je već u projektu).
*Dobit:* manje propuštenih termina. *Zavisnost:* odluka vlasnika; push je poslednji.

**R06 · Početna (osoba koja radi) · P2 · DELIMIČNO**
*Problem:* „Mogu odmah“ određuje ko prvi dobija zadatke za danas, a uključuje se tek u Profil › Dostupnost i nikad ne ističe (D: MATCH-V1, `coalesce(available_now,false)`).
*Predlog:* prekidač „Slobodan sam sada“ na Početnoj (isti postojeći unos); istek posle nekoliko sati (P: kolona `available_now_expires_at` postoji u bazi).
*Dobit:* brži odgovor na hitne zadatke. *Zavisnost:* istek = server; prekidač = klijent.

### B. Novac, pravila, podrška (rečenice koje odobrava vlasnik)

**R07 · Dogovor, Prijava, O aplikaciji · P0 · NE**
*Problem:* nigde ne piše kako se plaća (K: u `src` nema nijednog teksta o plaćanju; nađen je samo lažni AI). Aplikacija pokazuje „Dogovoreno ukupno 5.000 RSD“ kao da postoji obračun.
*Predlog (nacrt, usklađen sa odlukom R03 o besplatnom pokretanju):* „USKOČI za sada ne prima novac ni proviziju. Iznos je dogovor između vas dvoje; plaćanje dogovarate direktno.“ — ispod iznosa u Dogovoru, u pregledu prijave i u „O aplikaciji“.
*Dobit:* nema nesporazuma „ko plaća“. *Zavisnost:* poslovni i pravni tekst, novac nije u opsegu tima.

**R08 · Registracija, razgovor, pravila · P0 · NE**
*Problem:* nigde ne piše 18+ ni koji se zadaci ne objavljuju (K: nema u kodu; prodavnica: stavka o uzrastu i zabranjenim vrstama zadataka čeka „TVOJA ODLUKA“, D). Kad AI odbije, kaže „Ovaj zahtev ne može da nastavi kroz AI unos.“ — bez razloga i bez puta dalje, a ručnog unosa nema.
*Predlog:* spisak od 5–6 zabranjenih vrsta zadataka u „Pravila“ + jedna rečenica pri registraciji; pri odbijanju: „Ovakav zadatak ne objavljujemo. Pogledaj pravila ili piši podršci.“ (nacrt).
*Dobit:* manje zbunjenih i pogrešno odbijenih. *Zavisnost:* spisak i uzrast = vlasnik i pravo.

**R09 · Podrška · P1 · NE**
*Problem:* podrška su privatni zahtevi bez operatera osim vlasnika; ništa ne kaže koliko se čeka; nema odgovora na uobičajena pitanja; jezik je administrativan: „predmet“, „podnosilac“, „operater“, „zahtev za ponovni pregled“ (K: `ui/support/SupportPresentation.tsx:22-32`; D: DEEP_READ_LEDGER 7.31).
*Predlog:* „Najčešća pitanja“ (šest stavki: kako se bira, šta ako ne dođe, kako se plaća, kako se briše nalog…) pre „Novi zahtev“; jedna rečenica o odgovoru.
*Dobit:* manje zahteva. *Zavisnost:* rok odgovora = vlasnik; FAQ bez novca i prava sme tim.

**R10 · Dogovor (fizičko mesto) · P2 · NE**
*Problem:* osoba pušta nepoznatu u stan ili ide kod nepoznate, a aplikacija nema reč o prvom viđenju.
*Predlog:* sklopivi red „Pre prvog viđenja“ u Dogovoru: 3 rečenice (dogovorite se u Porukama, javi bliskoj osobi gde si, ako nešto nije kako je dogovoreno — „Prijavi problem“).
*Dobit:* mirnije prvo viđenje. *Zavisnost:* bezbednosni saveti = tekst vlasnika.

### C. Obaveštenja, značke, čekanje

**R11 · Obaveštenja (spisak) · P1 · DELIMIČNO**
*Problem:* red ne kaže o kom je zadatku reč: „Nova prijava — Imaš novu prijavu za Zadatak.“ (S p40; server tekst `supabase/candidates/pkg027c_notification_ti_copy.sql:66`; stavka nema polje sa naslovom, K: `contracts/inbox.ts`). Veliko „Z“ u sredini rečenice liči na grešku; osoba sa tri zadatka mora da otvori svako obaveštenje.
*Predlog:* u spisku (ne na zaključanom ekranu, A20) ispod naslova red sa nazivom zadatka; server vraća `taskTitle` uz stavku ili klijent dopunjuje kroz postojeći „resolve“; ispraviti veliko slovo.
*Dobit:* vidi se šta se desilo bez otvaranja. *Zavisnost:* mala serverska promena čitanja (P: bez sertifikata) ili više poziva klijenta.

**R12 · „Javićemo ti“ · P1 · DA**
*Problem:* Objavljeno i Moj zadatak obećavaju „Javićemo ti“ (K: `app/(app)/pregled-zadatka.tsx:526`, `data/ownTaskStanding.ts:58`, `ui/v2/ownTaskOverview.ts:77`), a obaveštenje na telefonu ne stiže: push je poslednji (D), sva slanja su ugašena (D: ZAVRSNA §3).
*Predlog:* do uključenja push-a: „Prijave vidiš ovde i u zvoncu.“; posle: vraća se „Javićemo ti“. Jedna konstanta.
*Dobit:* poštenje, manje razočaranja. *Zavisnost:* nema.

**R13 · Donja traka, zvonce · P1 · DELIMIČNO**
*Problem:* nijedan tab nema značku (K: `app/(app)/_layout.tsx:207-218`, nema `tabBarBadge`); zvonca nema na Zadacima; lični razgovori nemaju „nepročitano“ (K: `ConversationInboxPresentation.tsx:139`).
*Predlog:* Dogovori: broj iz „Čeka te“ (Početna ga već čita); Poruke: tačka kad ima nepročitanog (grupe odmah, lične kad server dobije stanje čitanja); zvonce na Zadacima (plan 2.8).
*Dobit:* vidi se gde nešto čeka. *Zavisnost:* lične poruke = promena šeme koja pomera sertifikat (D: PREKIDACI) → posebna odluka.

**R14 · Server događaji · P1 · DELIMIČNO**
*Problem:* „nije izabrana“, „istekla“ i istek zadatka postoje samo kao dozvoljene vrednosti, u ugovoru spiska i u tekstu za push; nijedna funkcija u repou ih ne upisuje (K: `RESPONSE_NOT_SELECTED`, `_EXPIRED`, `_SHORTLISTED`, `_STALE` nalaze se samo u `supabase/migrations/20260829210453…`, `…20260905060200…` i `functions/_shared/pushNotificationCopy.mjs`; živi DEV nisam čitao). Osoba čija prijava nije izabrana ili je istekla nikad ne dobije vest; kad se potraga zatvori dobija „Zadatak je otkazan“, što nije tačno.
*Predlog:* pri izboru poslednjeg mesta i pri isteku: „Za ovaj zadatak je izabrana druga osoba.“ / „Zadatak je istekao.“ (tekstovi već postoje u `publicInboxCopy.ts`); osobi sa zadatkom „Zadatak je istekao bez izbora.“
*Dobit:* zatvoren krug za obe strane. *Zavisnost:* server paket (proveriti da li dira sertifikat).

**R15 · „Novi zadatak za tebe“ · P2 · DELIMIČNO**
*Problem:* obaveštenje ne kaže zašto je stiglo: „Pojavila se nova prilika koja može da ti odgovara.“ (K: `ui/notifications/publicInboxCopy.ts`).
*Predlog:* u spisku: „Odgovara tvom području (Novi Sad) i vrsti zadatka (čišćenje)“, iz pravila MATCH-V1 (vrsta zadatka + područje + vreme).
*Dobit:* razume zašto i podesi pravo. *Zavisnost:* server vraća razloge; na zaključanom ekranu bez teksta (A20).

**R16 · Moj zadatak · P1 · DA**
*Problem:* posle 24 h bez ijedne prijave aplikacija ćuti.
*Predlog:* kartica od stvarnih činjenica: „Nema prijava već 24 sata.“ + dugmad iz stvarnog stanja: „Dodaj fotografiju“ (ako je nema), „Proširi termin“ (ako je uzak), „Podeli zadatak“ (R35), „Izmeni zadatak“. Bez izmišljenih brojki.
*Dobit:* prilika pre odustajanja. *Zavisnost:* nema.

**R17 · Poruke · P2 · DA**
*Problem:* završeni i otkazani Dogovori stoje u istoj listi kao aktivni (S p05, p27); brava postoji, a polje `closed` niko ne šalje (K: `ConversationInboxPresentation.tsx:23`, `app/(app)/poruke.tsx`).
*Predlog:* klijent ima listu Dogovora: označi `closed`; čipovi „Aktivni · Završeni“.
*Dobit:* aktivni razgovori na vrhu. *Zavisnost:* nema.

### D. Prvi susret

**R18 · Razgovor sa AI, Početna · P1 · DA**
*Problem:* prazan razgovor nema primere: komponenta ih podržava, niko ih ne prosleđuje (K: `AiConversationShell.tsx:61,305`); 38 od prvih 62 razgovora nikad nije dobilo poruku (K: komentar, uzorak sa DEV-a, ne dokaz uzroka). Početna ne zna za nedovršen nacrt („1 nacrt“ je samo broj u redu, S p02).
*Predlog:* tri primera rečenica, ne kategorije: „Treba mi pomoć oko selidbe u subotu, 2 osobe, Novi Sad.“ Na Početnoj, dok postoji nacrt mlađi od 7 dana: „Nastavi nacrt: {naslov}“.
*Dobit:* više prvih poruka. *Zavisnost:* nema novih poziva AI-ja.

**R19 · Objava kad AI ne radi · P1 · NE**
*Problem:* objava postoji samo preko AI-ja; ručni unos je ukinut odlukom (D: B02/I05); AI je 2.10. pao zbog potrošenog kredita i vlasnik je to video na telefonu (D). Radni profil ima ručnu izmenu, zadatak nema.
*Predlog (pitanje vlasniku):* rezervni obrazac (naslov, opis, mesto, termin, cena) samo dok je AI nedostupan; ili bar „AI je privremeno nedostupan. Nacrt je sačuvan.“ i vest kad se vrati.
*Dobit:* objava ne zavisi od jednog dobavljača. *Zavisnost:* menja raniju odluku.

**R20 · Početna (osoba koja radi) · P1 · DA**
*Problem:* ko izabere „Uskoči i zaradi“ dolazi na Zadatke bez reči o radnom profilu; saznaje tek pri prijavi (K: `WorkerProfilePresentation.tsx:213`, `prilike/[id]/prijava.tsx:216`).
*Predlog:* dok nema aktivnog profila, red na Početnoj: „Podesi radni profil · dobijaš zadatke koji ti odgovaraju“ (otvara razgovor); na detalju sivo „Sastavi prijavu“ sa razlogom (plan).
*Dobit:* nema iznenađenja usred prijave. *Zavisnost:* nema (jedno dodatno čitanje profila).

**R21 · Registracija · P2 · DA**
*Problem:* „Grad“ je slobodan tekst („Novi SAD“ u profilu, S p09); jedna opšta greška (K: `authClientService.ts:37`); posle registracije nema „Otvori email“.
*Predlog:* birač grada (postoje `PlacePicker`, `popularCities.ts`) ili ispravljanje velikog slova; uz grešku „Možda već imaš nalog — prijavi se“; „Otvori email“ (`Linking`).
*Dobit:* čistiji podaci. *Zavisnost:* nema.

**R22 · Profil › Nalog · P1 · DA**
*Problem:* prijavljena osoba ne može da promeni lozinku ni da vidi email; lozinka se menja samo kroz „Zaboravljena lozinka“ kad je odjavljena (K: `updateUser` samo u `data/passwordRecoveryClientService.ts:92`).
*Predlog:* „Promeni lozinku“ (stara + nova) u Profilu; prikaz emaila bez izmene u V1.
*Dobit:* osnovna kontrola naloga. *Zavisnost:* Supabase Auth, bez servera i bez paketa (P).

**R23 · Profil › Podrška (period testiranja) · P1 · DA**
*Problem:* za zatvoreni test (12 testera, 14 dana, odluka 7.10.) tester koji naiđe na grešku mora da ide kroz „Podrška › Novi zahtev“ i sam da opiše šta je koristio; vlasnik je jedini operater.
*Predlog:* „Prijavi grešku u aplikaciji“ (tema „Tehnička pomoć“ već postoji, K: `SupportNewScreen.tsx:21`) sa unapred upisanom verzijom aplikacije (podatak postoji u `ui/BuildIdentity.tsx`) i ekranom na kom je tester bio (P).
*Dobit:* upotrebljivije prijave. *Zavisnost:* nema; bez ličnih podataka.

### E. Biranje i prijava

**R24 · Prijave (osoba sa zadatkom) · P1 · DELIMIČNO**
*Problem:* odluka 7.10. kaže da osoba sa zadatkom vidi alat i vozilo; podatak stiže (`dokazPrijave.alati`, `.vozila`), ne crta se, a komentar još kaže da se „Sposobnosti“ ne prikazuju (K: `ApplicationSelectionPresentation.tsx:391`, odluka 24.9). Nema sorta po oceni; pouzdanost čeka prekidač.
*Predlog:* red „Ima: kombi · bušilica“ na kartici i u listu prijave (samo alat i vozilo); sort „Najbolje ocenjeni“; „Dolazi kako je dogovoreno N%“ čim vlasnik uključi prekidač.
*Dobit:* bolji izbor bez ćaskanja. *Zavisnost:* alat i vozilo = klijent; veštine ostaju skrivene dok vlasnik ne potvrdi; pouzdanost = vlasnik.

**R25 · Detalj i prijava (osoba koja radi) · P1 · DA**
*Problem:* preklapanje sa potvrđenim Dogovorom javlja se tek posle slanja (K: `applicationSelectionClientService.ts:41`); ne vidi se koliko je zadatak daleko od područja rada (podaci postoje: približna tačka zadatka i sačuvana tačka područja, `data/discoveryWorkArea.ts`).
*Predlog:* na detalju sivi redovi „Preklapa se sa tvojim Dogovorom {naslov}“ i „Oko 8 km od tvog područja rada“, bez nove serverske funkcije (postojeća čitanja profila i Dogovora).
*Dobit:* manje odbijenih prijava. *Zavisnost:* nema; udaljenost je približna.

**R26 · Prijave (osoba sa zadatkom) · P2 · NE**
*Problem:* ne može da odbije ni sakrije prijavu, ni da privatno pita kandidata pre izbora (K: nema radnje; `SHORTLISTED` postoji na serveru bez ekrana); neizabrane ostaju „Poslata“.
*Predlog:* „Ne ove“ (sklanja iz liste) + kratko pitanje kandidatu pre izbora; ili samo javna pitanja koja već postoje.
*Dobit:* manje zatrpavanja kad stigne mnogo prijava (MATCH-V1 šalje svima koji odgovaraju). *Zavisnost:* server + nov koncept poruke pre Dogovora.

**R27 · Detalj zadatka · P2 · DA**
*Problem:* „Traži pomoć · Ocena 4,7“ bez broja ocena (K: `PublicNeedPresentation.tsx:77,103`), iako broj stiže (`projections.ts:136`).
*Predlog:* „Ocena 4,7 · 3 ocene“ / „Još nema ocena“.
*Dobit:* poštena slika poverenja. *Zavisnost:* nema.

**R28 · Zadaci, Radni profil · P1 · DA**
*Problem:* `FOR_ME_SWITCH_EXISTS` i `TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY` su isključeni (K: `ui/workerProfile/workerProfileFacts.ts:19,26`) iako su MATCH-V1 i DISCOVERY-ZAMENE primenjeni na DEV (D: dnevnik 228–232, 7.10.); ekran tvrdi staro pravilo.
*Predlog:* uključiti u istom izdanju u kojem je server pročitan nazad (pravilo iz `PREKIDACI_I_ZAVISNOSTI`); proveriti kapsulu „Za mene“.
*Dobit:* ekran govori istinu. *Zavisnost:* samo provera živog stanja servera (čitanje).

### F. Posle zadatka

**R29 · Ocena · P2 · DELIMIČNO**
*Problem:* „Sačuvana ocena se ne menja“ piše tek posle čuvanja (K: `AgreementReviewPresentation.tsx:106`); sve oznake su pozitivne, pa loša ocena nema „zašto“ (K: `:23`).
*Predlog:* pre „Sačuvaj“: „Ocenu posle čuvanja ne možeš da menjaš.“; za 1–2 zvezdice oznake bez roda: „Kašnjenje“, „Termin nije ispoštovan“, „Zadatak nije urađen kako je dogovoreno“.
*Dobit:* informativnije ocene. *Zavisnost:* katalog oznaka je na serveru (proveriti).

**R30 · Profil, javni profil · P1 · DELIMIČNO**
*Problem:* server je 7.10. dobio pouzdanost (od 5 Dogovora), „Moju statistiku“ i spisak primljenih ocena (D: PROFILE-TRUST); klijent to ne crta (K: `ui/system/PublicProfileSheet.tsx:32`); razlog otkazivanja ima gotov prikaz bez čitača (D).
*Predlog:* izgraditi ekrane isključene: Moja statistika (prijave → dogovoreno → završeno), Primljene ocene, red „razlog otkazivanja“ u Dogovoru; uključenje tek po vlasnikovoj reči za dva prekidača privatnosti.
*Dobit:* ugled postaje vidljiv. *Zavisnost:* vidljivost pouzdanosti = vlasnik.

### G. Greške, veza, pomoć

**R31 · Svi ekrani · P2 · DA**
*Problem:* svaka greška glasi „Proveri internet vezu“ i kad je kvar na serveru; vrsta `offline` postoji i ne koristi se (K); nema keša, pa bez mreže ostaje samo greška.
*Predlog:* razlikovati prekid mreže (oblik greške, bez NetInfo, odluka U19) od greške usluge; „Nema veze. Prikazano je poslednje učitano.“ gde već postoji poslednji sadržaj (Početna, Dogovori, Raspored).
*Dobit:* zna se da li da čeka ili da proveri telefon. *Zavisnost:* bez paketa; broj i adresa se i dalje ne čuvaju.

**R32 · Glavni ekrani · P2 · DA**
*Problem:* nema pomoći iz konteksta; „Kako radi“ je samo red za novi nalog (K: `ui/home/HowItWorks.tsx`).
*Predlog:* „?“ u traci Dogovora, razgovora i Rasporeda; panel od 3–4 rečenice (šta znači svaki korak; šta znači „Bez tačnog termina“) + „Podrška“.
*Dobit:* manje pitanja podršci. *Zavisnost:* novac i pravo = vlasnik.

**R33 · Podešavanja obaveštenja · P2 · DA**
*Problem:* sedam prekidača, tihi sati i „Detalji telefona i slanja“, sa nazivima kao „Oporavak“, „Izvršenje i završetak“, „Nalog i ostalo“ (K: `ui/notifications/PushPreferences.tsx:306-347`).
*Predlog:* tri izbora („Novi zadaci“, „Prijave i poruke“, „Sve ostalo“) + „Napredno“.
*Dobit:* razumljivo običnoj osobi. *Zavisnost:* server već čuva kategorije; mapiranje u klijentu.

**R34 · Zatvaranje naloga · P2 · NE**
*Problem:* pravni jezik: „pseudonimni zapisi“, „nepotvrđen mrežni odgovor ne znači da su podaci obrisani“ (K: `ui/closure/ClosurePresentation.tsx:148-151`).
*Predlog:* četiri rečenice običnim jezikom iznad pravnog dela.
*Dobit:* razumljivo pre nepovratne radnje. *Zavisnost:* pravni tekst = vlasnik.

**R35 · Deljenje zadatka · P2 · DELIMIČNO**
*Problem:* nema „Podeli“ (K: nema `Share` u `src`); zadaci se u Srbiji traže i po Viber, WhatsApp i Facebook grupama (P), a korisnika je u početku malo.
*Predlog:* sistemsko „Podeli“ (RN `Share`, bez paketa) sa naslovom i mestom, bez adrese; link tek kad postoji stranica ili prodavnica.
*Dobit:* zadatak stiže do ljudi. *Zavisnost:* link i domen = vlasnik.

---

## 4. Top 15 poteza (po vrednosti za korisnika i lakoći)

| # | Potez | Težina | Tim sam? |
|---|---|---|---|
| 1 | **R02** Korak „dogovorite vreme“ za Dogovor bez termina (+ red na Početnoj) | S–M | DA |
| 2 | **R01a** Skloni „Podeli svoj broj“ dok nema broja; „Kontakt kroz Poruke“ | S | DA |
| 3 | **Paket od tri teksta za vlasnika:** plaćanje (R07), 18+ i zabranjeni zadaci + poruka kad AI odbije (R08), šta se očekuje od podrške (R09) | S | NE |
| 4 | **R18** Primeri u praznom razgovoru + „Nastavi nacrt“ na Početnoj | S | DA |
| 5 | **R11 + R12** Naziv zadatka u obaveštenjima i poštena obećanja do push-a | S–M | DELIMIČNO |
| 6 | **R28** Uključiti „Za mene“ i tekst „alat i vozilo nisu uslov“ (server je primenjen) | S | DA |
| 7 | **R13** Značke na donjoj traci i zvonce na Zadacima | S–M | DELIMIČNO |
| 8 | **R14** Vest „izabrana je druga osoba“ i „zadatak je istekao“ | M | DELIMIČNO |
| 9 | **R25** Preklapanje termina i udaljenost pre prijave | M | DA |
| 10 | **R03** „Zatraži adresu“ / „Podeli adresu kad budete spremni“ | S | DA |
| 11 | **R24** Alat i vozilo na kartici prijave, sort po oceni | S | DELIMIČNO |
| 12 | **R20** „Podesi radni profil“ na Početnoj | S | DA |
| 13 | **R16** Savet posle 24 h bez prijava | S–M | DA |
| 14 | **R22** „Promeni lozinku“ u Profilu | M | DA |
| 15 | **R04** Posle „Prijavi problem“: tri izlaza | S | DA |

**Predlog redosleda:** prvi talas (oko nedelju dana, sve male, bez servera): 1, 2, 3, 4, 6, 12 — rešavaju ono što korisnik odmah primeti: termin, kontakt, novac i pravila, istinitost ekrana, prvu poruku, radni profil. Drugi talas: 5, 7, 10, 15 (klijent; 5 i 7 imaju serverski deo koji može da čeka). Treći: 8, 9, 11, 13, 14 (manji serverski paketi ili više posla). Posle toga R30 (pouzdanost i statistika), R05 (podsetnik, uz odluku vlasnika), R23 (prijava greške za testere, može i ranije) i R31–R33.

**Brojke (35 ideja, R01–R35):** tim sme sam 17 (DA); 10 delimično (klijentski deo DA, server priprema, primena po stalnom ovlašćenju samo ako ne pomera sertifikat ni privatnost: R01, R06, R11, R13, R14, R15, R24, R29, R30, R35); 8 traži vlasnika (NE: R05, R07, R08, R09, R10, R19, R26, R34). Od 15 poteza u Top listi: 10 DA, 4 delimično, 1 paket tekstova za vlasnika.

---

## 5. Šta test sa dva telefona (I01–I32) ne pokriva, i šta nisam proverio

**Scenariji koje vredi dodati:** (1) registracija postojećim emailom, zaboravljena lozinka, potvrda emaila; (2) odbijanje svake dozvole i povratak iz Podešavanja; (3) zadatak bez prijava do isteka; (4) osoba koja nije izabrana; (5) Dogovor bez tačnog termina → dogovor vremena; (6) kontakt na dan izvršenja: broj, poziv, adresa; (7) poruka bez mreže → ponovno slanje; aplikacija u avionskom režimu; (8) problem u Dogovoru → otkazivanje → ponovno traženje; (9) zatvaranje naloga ili blokiranje usred Dogovora; (10) prijava bez radnog profila.

**Za posle V1 (nije proveravano, samo smer):** ponavljajući zadaci („svake nedelje“), „Pozovi istu osobu ponovo“ (odloženo), plaćanje (P1–P12), potvrda identiteta, sinhronizacija sa kalendarom telefona (odloženo).

**Pretpostavke (nisu proverene):** šta vidi osoba kad je zadatak popunjen drugom osobom (nema provere na DEV-u); da lokalni podsetnik ne traži novi paket; da `tel:` radi bez dodatnog podešavanja; da su podaci PROFILE-TRUST dovoljni za karticu; da su „38 od 62“ odustajanja, a ne samo pogledi.

**Nisam mogao da proverim:** DEV i telefon (zabranjeno); laboratorija u pregledaču (server na `localhost:8081` nije odgovarao, pa nema novih snimaka galerije); stvarno ponašanje push-a, spore mreže i TalkBack-a; radno stablo sadrži nezavršene izmene drugih timova, pa se stanje ekrana može razlikovati od snimaka od 7.10.
