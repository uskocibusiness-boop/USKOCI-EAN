# Vlasnikove odluke 8. oktobra 2026 (zapis za autoritet)

Doslovne reči vlasnika (glasovni unos, iskvaren) i moje čitanje; svaka kasnija njegova reč ima prednost. Mesto gde je svaka primenjena je navedeno.

| # | Reči (doslovno) | Čitanje / odluka | Primenjeno |
|---|---|---|---|
| 1 | „Može, dobro vam jedno ime za sve.“ | JEDNO ime: menja se samo u Ličnim podacima i upisuje se i u nalog i u radni profil; polja imena u Radnom profilu i kod asistenta nestaju; registracija ostaje prvo upisivanje. | 4e0ea506 (`src/ui/profile/writeWorkName.ts`, `useAccountName.ts`, `src/ui/workerProfile/NameDifference.tsx`) |
| 2 | „Odobravam“ (nacrt proizvoda) — dato pre nego što je video skice pojedinačnih ekrana („Ali ja ne vidim same ekrane…“) | Nacrt `docs/implementation/ui-ux-pass-20261002/NACRT_PROIZVODA_20261008.md` je odobren kao pravac; primedbe po ekranu imaju prednost. | talas „Telefon“ (4e0ea506) |
| 3 | „pregled zadatka pre objave treba da bude kao detaljan pregled zadatka, a ne taksativno… čovek vidi kako će izgledati kad je objavljen. I kartica… to je suština… on treba da vidi tačnu lokaciju, potpunu adresu“ | R2 pregled pre objave = javni zadatak (kartica + detalj), privatna adresa samo vlasniku, bez spiska stavki. | 4e0ea506 (`src/ui/objava/ReviewDetail.tsx`, `reviewAsTask.ts`) |
| 4 | „prikaz kalendara… treba da bude dosta bolje, a ne samo ti neki datumi gore… pregled celog meseca, nedelje, dana… svetska rešenja“ | Raspored = kalendar Mesec · Nedelja · Dan po uzoru na Apple/Google kalendar. | 4e0ea506 (`src/ui/calendar/MonthView.tsx`, `WeekDays.tsx`, `DayView.tsx`) |
| 5 | Zadaci (12:24–12:30): „kad se uđe na mapu dok je lista dole ne vidi se navigacija, tek kad se digne lista na pola ili skroz se pojavljuje… filteri odvojeni od pretrage… lepe fluidne 3D kapsule gore… lako pristupiti listi zadataka koji nisu na mapi… kartica… lista se još uvuče dole… mapa ostane pregledna“ | Na ekranu Zadaci donja traka tabova je SAKRIVENA dok je lista dole ili dok stoji kartica pina (izuzetak od AGENTS 3.6.2 „donja navigacija uvek pokazuje gde si“, samo za ovaj ekran); pretraga odvojena od filtera; kapsule nad mapom; ulaz „nisu na mapi“; kartica pina skroz dole. | 4e0ea506 (`src/ui/v2/DiscoveryPresentation.tsx`, `src/ui/v2/discovery/zadaciBar.ts`, `src/app/(app)/_layout.tsx`) |
| 6 | „zadaci koji su na daljinu… treba da se naznače i da lako budu pristupni“ | Kapsula „Na daljinu“ prva u redu; kartica nosi oznaku „Na daljinu“; ubrojani u „nisu na mapi“. | 4e0ea506 |
| 7 | „Samo napred“ (na predlog da se skorašnje pretrage brišu pri odjavi) | Skorašnje pretrage se brišu pri lokalnoj odjavi. | 4e0ea506 (`src/data/recentSearchesKey.ts`, `authClientService.signOutLocal`) |
| 8 | „Nema potrebe da staješ, idi slobodno do 100%, samo nemoj da staješ.“ | Ukinuto pravilo zaustavljanja agenata na 88 % nedeljnog limita (važi za Claude sesiju). | — |
| 9 | „povezao i mobilni telefon, koristi ga za sve — instaliranje, pregled ekrana, tokova“ | Telefon sme da se koristi za instalaciju (`adb install -r`, sesija ostaje) i pregled; nikad brisanje podataka, odjava, objava/slanje/otkazivanje sa njegovog naloga; dok on gleda, ne dira se. | APK 4e0ea506 instaliran 18:07 |
| 10 | „ti se spremi da predaš dalje rad kodeksu… ultra detaljno forenzički presek“ | Predaja Codexu: `docs/implementation/handoff-codex-20261008/`. | 81b9baa8, 653d1636 |
| 11 | (uveče, o pretrazi na Zadacima) „dobro je da gore bude lupa i ono, i može da se traži, i skoče odatle predlozi, ali možda ne pretraga na mapi nego tek na listi, možda, ili kako god… ne znam“ | SKLONOST, ne odluka: lupa gore ostaje, predlozi ispod polja ostaju; pretraga možda pripada listi, a ne mapi — dva moguća čitanja: (a) polje pretrage se pokazuje tek kad je lista podignuta, (b) potvrđena pretraga odmah podiže listu sa rezultatima (mapa ostaje filtrirana). Preporuka Claude: (b). Codex pokazuje oba na skici/emulatoru pre promene; do vlasnikove reči važi nacrt (lupa gore, rezultati i na mapi i u listi). | — |

Otvorene odluke (nisu date): „Dogovoren“ vs „Dogovoreno“; „⋯“ u Porukama Dogovora; „d“ bez kvačice → „đ“; primena DISCOVERY-GRAD S3; PNG zvezda; brisanje grane `backup/telefon-20261008-1`.


## Naknadna odluka — autonomno završavanje i uređaji (8.10.)

Vlasnik u ovom Codex razgovoru: „imasv sve moej izirit odlike da psujes vse o dsad na dalje iamz dovxzu xa sve nep otreb vise nsita da me ptias..vodi isuavrsava p ak oda je tovja ida xelis od nje da narpvi najbolji amekrtalce app iakd...od zas zabeeli da nsite ne ceka moju ptrvrdu veci ams ddozvu i tprobvtu za sve sto doborm alizim utvris da treba uradii i ens taj dok ne bdue sve perfektno“.

Čitanje: vlasnik daje široko odobrenje da agent autonomno analizira, donosi odluke, dovršava i proverava proizvod i šalje završene izmene na GitHub, bez novih potvrda za svaki paket. Ranija obavezna potvrda svake skice nije uslov za rutinske UI/UX dorade. Ovo nije dokaz završenosti i ne uklanja preflight, rollback, zaštitu podataka i obavezu tačnog izveštavanja. Ne podrazumeva izmišljene cene, pravni identitet ili podatke za prodavnicu.

Potom: „upali soatii  emurator i telfo rksiti ga iams dva proifal pekrvaj sve usavrsavaj sve“ — odobren pregled i proba na emulatoru i povezanom telefonu sa dva postojeća naloga. Ažuriranje preko postojećeg paketa, bez brisanja podataka/sesije. Prvo utvrditi odgovarajući APK, naloge i ograničen scenario; ne slati stare obaveštenja nepovezanim korisnicima.


### Dopuna posle Airbnb slika 14395–14424

Vlasnik precizira da reference prvenstveno određuju nivo kvaliteta stila, jasnoće, boja, oštrog modernog prikaza i lakoće korišćenja cele aplikacije. Agent samostalno osmišljava poboljšanja po svrsi svakog ekrana. Za Discovery izričito traži kontinuitet: podizanje liste prelazi u skrol, vraćanje do vrha u spuštanje liste; tabovi ostaju na HALF/FULL, a skrivaju se na spuštenoj listi. Konkretna primena i granice dokaza: postojeći NACRT_PROIZVODA_20261008.md §16.8. To nije odluka da se kopiraju Airbnb asseti, pet tabova, poslovna pravila ili privatnosni prekidači.


### Oznaka izvora mape — ostaje dole levo

Najnovije pojašnjenje vlasnika: mali natpis izvora ostaje dole levo na samoj mapi. Ne podiže se uz listu niti izabranu karticu samo da bi ostao vidljiv; te površine smeju da ga prekriju. Ovo prevazilazi ranije pravilo da attribution prati sheet. Izvori/linkovi ostaju; nije promena kamere ili ponašanja dugmeta Moja lokacija.

### Naknadne naredbe za razgovore, AI i nastavak rada (09.10)

Čitanje poslednjih vlasnikovih poruka u istom razgovoru, bez pretvaranja namere u dokaz implementacije:

- Jedan zadatak sa više odabranih ljudi ima zajednički pregled učesnika i zajedničku prepisku. Osoba koja traži pomoć bira i privatnu prepisku sa svakim odabranim; učesnici mogu privatno samo sa tom osobom, ne jedni sa drugima. Bilateralni uslovi ne postaju javni grupi.
- Ime i avatar identifikuju pošiljaoca i u privatnim i u grupnim prepiskama.
- U oba AI unosa ostaje mikrofon drži–govori–pusti. Poseban ulaz koji pokreće glasovni razgovor sa AI se za sada uklanja. Stvarni govor/transkript i razmišljanje moraju biti vidljivi; ne simulirati odgovor. Fotografije pripadaju unosu zadatka, ne unosu radnog profila.
- Završna kartica zadatka pojavljuje se tek kada postoje svi obavezni podaci. Lokacija ili sve tačke rute rešavaju se pre sledećeg običnog pitanja; mapa ne treba da se pojavi ispod pitanja o drugoj temi.
- Traži izolovane testove sa hiljadama zadataka po gradovima Srbije i scenarijima za 40.000 korisnika. Broj sintetičkih redova nije dokaz broja istovremeno aktivnih korisnika; potrebni su stvarni RPC tokovi i merenja.
- Poslednja poruka: vlasnik odlazi da spava, izričito ponavlja autonomiju, korišćenje telefona/emulatora, push izmena i nastavak rada bez čekanja. Postojeći automatski nastavak je aktivan. Ne ponavljati zahtev za istu dozvolu; čuvati podatke/sesije, raditi preflight/rollback i vezivati dokaz za tačan izvor i APK. Spremnost za prodavnicu nije obećana ovim odobrenjem.


### 09.10 — ručna instalacija APK, potvrđen push i čišćenje testnih podataka

Vlasnik bira da APK preuzme i instalira sam, a agent radi na emulatoru; ne tražiti ponovo USB. Potvrdio je „APK je instaliran i telefon je povezan“, zatim za jednu stvarnu poruku „Stiglo je i otvara taj razgovor“. To je korisnikova fizička potvrda dolaska i tap putanje; nije nezavisno očitan runtime About niti potvrda svake push kategorije.

Na zahtev da se obrišu stari zadaci, radni profili, Dogovori i obaveštenja, prikazan mu je inventar49zadataka/5naloga i ukrštene veze. Izričito je izabrao: „Svih pet naloga su testni — očisti sve probne podatke“. Autorizovan je reset poslovnih testnih podataka svih pet poznatih naloga, uz sačuvane prijave/lozinke i vezu telefona za push iz istog pitanja. Nije potrebno novo odobrenje istog obuhvata. Odluka ne predstavlja već izvršeno brisanje: prethode privatni backup, tačan manifest, proverljiva transakcija i očuvanje autoriteta/sertifikata, potrošnje i neizvesnih provider ishoda. Ne glumiti account closure niti izbrisati Auth da bi se postigao poslovni reset.


### 09.10 — zaustavi30-minutno automatsko ponavljanje, nastavi tekući rad

Vlasnik: „i ovaj zatak sot se na skvom 30m inuta ppanvlaj zasuravi ga a nastavidlaj iradk ao sam difnsaio“. Čitanje: pauzirati postojeću Codexheartbeat automatizaciju usko-i-kontinuirano-usavr-avanje; tekući rad naUSKOČI nastaviti po dosadašnjem obuhvatu. Tool je potvrdioPAUSED. Ne aktivirati je ponovo niti praviti zamenu bez nove vlasnikove naredbe. Ovo se ne odnosi na redovne serverske poslove aplikacije.


### 09.10 — broj ljudi po prijavi i srazmerna ukupna cena

Vlasnik traži početni broj1, minus/plus i direktan unos broja ljudi koje podnosilac obezbeđuje, uz nastavak UI/UX i emulator provera. Na konkretno pitanje9000RSD ukupno za3osobe izričito bira: „3.000 RSD za jednu osobu — srazmerna podela“. Time menja ranije pravilo TOTAL zahteva sve članove ekipe; obračun za novu prijavu treba da prati pokrivena mesta/ukupno traženih. Ne menja retroaktivno već sačuvane iznose i uslove Dogovora. Poseban slučaj nedeljivog iznosa u celim dinarima postavljen je kao kratko pitanje; odgovor se ne podrazumeva. Primena i APK tek posle usaglašenih server/klijent provera.

### 09.10 — potvrđeno zaokruživanje svake prijave

Na konkretno pitanje10000RSD/3osobe vlasnik izričito odgovara: „Zaokruži na najbliži dinar“. Nova ili izmenjena prijava računa round(ukupna cena zadatka × broj ljudi u prijavi / ukupno traženih ljudi), jednom za celu prijavu;10000/3 daje3333 za jednu i6667 za dve osobe. Prihvaćena je i navedena posledica da tri odvojene prijave po jednoj osobi daju9999. Ne deliti zaokruženu jediničnu cenu pa množiti. Sačuvani Dogovor/pending iznosi ostaju nepromenjeni. Ovo zatvara ranije otvoreno obračunsko pitanje i odobrava usklađenu implementaciju konkretno opisane cene.

### 09.10 — određen plan, presek i kraj rada

Najnoviji zahtev traži profesionalnu timsku analizu trenutnog stanja, šta je završeno, šta sledi i kada je APK spreman; vlasnik izričito ne želi neograničen rad bez jasnog plana i završetka. Prioritet su AI radni profil, stvaranje/izmena zadatka i profila, lokacije/pin/ruta, saradnje, čet/mediji i brzina baze. Čitanje: nastaviti postojeći posao uz ograničene prihvatne scenarije i jasne release uslove; ne pretvoriti raniji „u krug“ nalog u beskonačne estetske iteracije. Postojećih62 redova i master ostaju autoritet evidencije. Izveštaj STATUS_I_KRITERIJUMI_ZAVRSETKA_20261009.md je presek, ne nova paralelna lista. Ovo nije odobrenje javnog izdanja niti promena već pauzirane30-minutne automatizacije.
