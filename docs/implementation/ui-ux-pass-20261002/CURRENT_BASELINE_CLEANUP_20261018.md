# USKOČI — šta je nagomilano i kako završiti jednu povezanu aplikaciju

Datum: 18.10.2026. Početni izvor inventara: `938df57d81e98821255d361afd6b6201e996889d`, grana `feature/unified-qa-master-20261017`, aktivni checkout `USKOCI-EAN`. Ovo je datirani nalaz i predlog izvođenja uz postojeći LIVE plan i `docs/control/redovi.json`. Nije novi master niti potvrda završenosti aplikacije.

## 1. Direktan odgovor

Da, nagomilavanje postoji. Najjasnije je u ulaznoj dokumentaciji, razvojnim rutama i prelazu između novog AI razgovora i starog sačuvanog radnog profila. Postoje i komponente koje više nisu povezane sa ekranima. Problem nije moguće rešiti brisanjem svega što se zove „v2“, „staro“ ili ima septembarski datum: veliki deo takvog koda i testova je još aktivan i čuva važne poslovne granice.

Preporuka je da se očisti postojeći aktivni projekat, da ostane jedna implementacija svakog korisničkog puta i da se istorija ukloni iz svakodnevnog ulaza u rad. Novi klon „USKOCI-FINAL-NOVO“ dodao bi još jedno mesto za zabunu. Čist radni prostor znači da znaš šta je proizvod, šta je laboratorija, šta je dokaz i šta je istorija — ne da je prethodni rad nepovratno obrisan.

## 2. Šta je zaista pregledano

- `git status`, poslednjih pet commit-a, stvarna grana i remote.
- Git inventar, `src/app/` rute, aktivne UI porodice, statički graf lokalnih import/export/require zavisnosti pomoću instaliranog TypeScript parsera.
- `README.md`, AGENTS, authority index, dizajnerski master, owner direction, UX nacrt, skill registry, control pravila i postojeći registar.
- Root i app navigacija, redirect rute, worker saved profile, AI/profile prikaz, Home/radar reference, aktuelni tokeni i primeri galerija.
- `app.json`, `app.config.js`, `eas.json`, `metro.config.cjs`, `jest.config.cjs`, `.gitignore`, postinstall i `scripts/build-identity.cjs`.
- Jest discovery komandom `node node_modules/jest/bin/jest.js --listTests --runInBand --json`.
- Postojeće slike Home, worker profila i Zadaci na emulatoru od 18.10, plus poreklo i spisak ranije galerije sa 21 snimkom od 17.10. Nije ponovljen kompletan obilazak svih ekrana niti je svaka od 21 stare slike ponovo vizuelno pregledana u ovom paketu.

Ovaj paket nije izvršio puni `npm test`, novi APK build, instalaciju, plaćeni AI poziv, push ili novu DEV promenu. Slike nisu nov dokaz za početni HEAD ovog inventara. Raniji server rezultati citirani niže potiču iz zasebnih receipt-a.

## 3. Izmereno stanje pre ovog sređivanja dokumentacije

| Stavka | Nalaz | Kako tumačiti |
| --- | ---: | --- |
| Tracked fajlovi | 6.337 | Obuhvataju izvor, dokumentaciju, SQL, CI i dokaze |
| Zbir veličina tracked fajlova | 321.328.961 bajt | Oko 306 MiB sadržaja; nije veličina APK-a niti celog Git istorijata |
| Fajlovi pod `docs/` | 2.917 | Velika količina datiranog znanja i dokaza |
| Slike PNG/JPEG/WebP pod `docs/` | 673 | Sama prisutnost ne znači da ulaze u mobilni bundle |
| Fajlovi pod `supabase/` | 1.563 | Uključuju istoriju, kandidata i dokaze; ne predstavljaju broj aktivnih funkcija |
| Fajlovi pod `src/` | 1.323 | Runtime i testovi zajedno |
| Runtime source fajlovi | 715 | Bez test/mock fajlova prema pravilima inventara |
| Route/support fajlovi u `src/app/` | 74 | Nisu 74 različita korisnička ekrana |
| `dizajn-*` rute | 21 | Razvojne galerije unutar router stabla |
| Ostali route/support fajlovi | 53 | Uključuju layoute, redirect-e i native intent |
| Runtime fajlovi dostupni statičkim grafom | 690 | Konzervativna procena iz svih ruta i entry-ja |
| Kandidati koje graf nije dosegao | 25 | Predlog za proveru, ne spisak za automatsko brisanje |
| Fajlovi dosegnuti samo iz dizajn ruta | 32 | 21 ruta i 11 dodatnih komponenti |
| Jest otkriveni testni fajlovi | 620 | Discovery; nije tvrdnja da je 620 paketa prošlo |
| APK fajlovi tracked u Gitu | 0 | Stari APK-ovi mogu postojati van Git-a |

Mašinski spisak: `CURRENT_BASELINE_INVENTORY_20261018.json`. Brojevi su pre dodavanja arhive i ovog izveštaja. Graf prati literalne lokalne importe/eksporte i `require`, uključuje više native varijanti konzervativno. Ne zamenjuje Metro bundle proveru, platformsku analizu, build skripte ili stvarno ponašanje.

## 4. Konkretni nalazi

### A. Zastareli dokumenti su se predstavljali kao aktuelni

Root README i AGENTS imenovali su `work/uskoci-ui-unification-20260924`, dok je aktivna grana `feature/unified-qa-master-20261017`. Authority index je još sadržao septembarski SAFE STOP, LIVE108, „OpenAI primary“, stare APK/commit pokazivače i tvrdnju da RC2 sadržaj nije primljen. AGENTS i noviji dokazi već su te tvrdnje menjali. Stari indeks je kao aktivne tokene navodio nepostojeći `src/ui/v2/tokens.ts`.

Dizajnerski master imao je oko 55 KB različitih datiranih „trenutnih“ preseka, uključujući raniju GitHub 403 blokadu. Owner direction je sadržao i stare zelene naslove i kasniji zahtev za tamne naslove, kao i raniji zastoj radi analize posle već datog odobrenja. UX nacrt je opisivao tri taba i ručno uređivanje radnog profila. Takav ulaz može navesti sledećeg agenta da ponovi završeni posao ili vrati napušten dizajn.

**Šta je urađeno sada:** sačuvani su originalni bajtovi osam ulaznih dokumenata, sa SHA-256 manifestom. Postojeći current README postao je kratko „Počni ovde“. Authority index, dizajnerski master i owner direction dobili su jedan jasan aktuelni sadržaj. Root README i AGENTS vode tim putem; septembarski nacrt i skill lista jasno su označeni kao datirane reference. AGENTS poslovna pravila, sigurnost i rezervisane dozvole ostaju. Ovo je čišćenje ulaza, ne tvrdnja da je pregledano i preuređeno svih 2.917 dokumenata.

### B. Razvojni prikazi su deo router stabla

Postoji 21 `dizajn-*` ruta: početna, AI, AI mesto, mapa, objava, zadaci, dogovori, poruke, profil, kandidati, moji zadaci, prijave, prijava, prijava-forma, kalendar, obaveštenja, privatnost, sistem, tabla, dodaci i katalog27.

Većina dopušta prikaz kada je `__DEV__` ili package završava sa `.dev`; neke traže tačno `rs.uskoci.dev`. To ograničava pristup pri izvršavanju, ali nije dokaz da komponente i njihovi resursi ne ulaze u release bundle. Galerije su korisne za QA; njihovo prisustvo ne znači da korisnik ima 21 dodatni javni ekran.

**Predlog:** izdvojiti laboratorijske ulaze iz proizvoda na nivou podržane build/router konfiguracije, uz korišćenje istih stvarnih komponenti. Proveriti manifest ruta i release bundle, pa native otvaranje/deep link. Ne praviti drugu punu aplikaciju niti uništavati galerije. Runtime sakrivanje nije dovoljno za tvrdnju „uklonjeno iz APK-a“.

### C. Neke komponente postoje, ali nisu povezane

Primeri kandidata su `RadarIcon.tsx`, `HomeIllustration.tsx`, `ReferenceEntryHero.tsx`, `LottieArt.tsx`, `ui/v2/icons.tsx`, pojedini art elementi i `ReviewCommentsSection.tsx`. Deo njih je i dalje vezan za testove, a platform-specific `.web` fajlovi prirodno traže zasebnu proveru.

Posebno: `RadarIcon.tsx` eksportuje `AnimatedRadar`, ali aktuelne prezentacije ga ne uvoze prema grafu i dopunskoj pretrazi. Ranije poboljšanje petlje u tom fajlu nije dokaz vidljivog radara na Početnoj. Ovo ispravlja preširoko ranije tumačenje source napretka: bolji kod komponente i njeno povezivanje su dva različita posla.

**Predlog:** za svaku stavku odlučiti „povezati“, „zadržati kao test/lab“, „zadržati za platformu“ ili „ukloniti posle zamene“. Radar, koji vlasnik traži na kartici „Uskoči i zaradi“, treba povezati i pregledati, umesto ga obrisati zato što trenutno nije korišćen. Ovaj paket nije menjao tu vezu.

### D. Novo AI iskustvo završava na starom sačuvanom profilu

`WorkerProfileSaved.tsx` prikazuje sažetak veština, zatim slične chip-ove, dugme „Uredi kroz razgovor“, ručni „Gde“, „Mogu odmah“, nedeljni raspored i opremu. Na pregledanoj slici „3D printovanje / 3D štampa“ deluju kao ponavljanje iste usluge. Čovek ne zna da li profil menja kroz razgovor, redove, zasebnu lokaciju ili raspored.

Stariji saved draft oblik ima grad/radijus, ali ne kompletnu potvrđenu projekciju režima i teritorije po usluzi. Novi AI review je ranije dobio ispravku za remote-only; to ne znači da je sačuvani profil potpuno usklađen.

**Predlog:** jedan pregled „Šta radiš / Gde radiš / Kada primaš zadatke“ izveden iz potvrđenog modela. Jedan glavni ulaz „Izmeni kroz razgovor“, uz mogućnost da konkretan red otvori taj razgovor sa kontekstom. Ne prikazivati prazan alat/vozilo kao obavezu. Ne spajati različite sposobnosti samo zato što slično zvuče; deduplikacija ide preko kanonskog ID-ja/alijasa. Prazan/null stari podatak ne sme glumiti potvrđeni REMOTE ili region.

### E. Postoji skrivena zavisnost od starog HTML donora

`npm ci` preko postinstall-a poziva `scripts/sync-entry-reference-assets.cjs`. On čita `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html` i pravi city/font/entry podatke. Statički runtime graf te resurse povezuje sa nepovezanim `ReferenceEntryHero`, ali je build korak i dalje stvaran.

**Posledica:** brisanje svih starih HTML/slika „radi čistoće“ može srušiti instalaciju zavisnosti. Najpre proveriti potrošače, odlučiti da li se resurs zadržava kao direktan odobren asset ili uklanja, promeniti generator/potrošače/testove zajedno i proveriti clean install/build. Istorijski izvor zatim može ostati arhiviran.

### F. Neki nazivi izgledaju stari, ali su neophodni

`src/ui/v2/` sadrži 75 runtime modula aktivne prezentacije. Brisanje ili masovno preimenovanje tog foldera ne bi poboljšalo UX. `src/ui/system/tokens.ts` je zajednička osnova; `aiFirst/tokens.ts` uglavnom mapira postojeći sistem, pa nije dokaz nove nezavisne palete.

`/mapa` i `/prilike` preusmeravaju na `/zadaci`, a `/moje-aktivnosti` na početnu. To su kompatibilni linkovi, ne tri kompletna stara ekrana. `/prilike/[id]` i prijava i dalje imaju poslovnu ulogu. Navigacija ima zaštite za Back, završenu objavu, prijavu, recovery i odloženi push/deep link. Ne uklanjati ih zbog naziva.

### G. „Najnoviji APK“ nije dovoljno određen

Konfiguracija ima package/runtime/channel i OTA updates. APK može imati svoju osnovu i zatim učitan noviji JS update; broj verzije ili datum kopiranja fajla ne govori sve. `scripts/build-identity.cjs` već čuva `sourceCommit`, `sourceDirty` i `backendTarget`, a `backendRelease` s pravom ostavlja null: klijent ne može potvrditi stanje baze.

**Predlog za svaki prihvaćeni paket:** jedan mali manifest sa Git SHA/dirty, APK SHA-256, package/versionCode/runtime/channel, stvarnim OTA update ID/SHA ako postoji, datumom DEV snapshot-a, Edge/migration receipt-ima, tačnim test run-om i slikama označenim rutom/uređajem/izvorom. Koristiti postojeći buildIdentity, ne još jedan konkurentski sistem verzionisanja. Manifest ne sadrži ključeve, JWT ili lične razgovore.

## 5. Šta slike stvarno govore

Galerija sa 21 snimkom od 17.10. je istorijski pregled HONOR preview aplikacije. Nije dokaz sadašnjeg HEAD-a, niti je odjavljeni početni ekran u njoj potpuno obuhvaćen.

Slika `USKOCI_EMULATOR_HOME_AFTER_FIX_20261018.png` još prikazuje „Bezbedniji dogovor“, dok novija `uskoci-home-ui-after-20261018.png` prikazuje Početnu bez te kartice. Sam naziv AFTER_FIX stoga nije dovoljno pouzdan za izbor reference. U novijem prikazu ostaju velike početne pločice i dosta prostora oko praznog „Čeka te“. Worker slika pokazuje duplirane usluge i mešavinu AI/ručnih kontrola. Zadaci slika pokazuje više slojeva iznad mape, velike markere i filtere koji traže jasniju hijerarhiju.

**Vizuelna ocena:** identitet postoji, ali se ekrani ne ponašaju uvek kao jedna celina. Ponavljanje informacija, preveliki prazni odeljci, više ravnopravnih kontrola i različiti obrasci izmene podižu napor korisnika. Potrebno je preuređenje celih povezanih putanja, ne samo bojenje i zamena ikonica.

## 6. Šta je dobro i treba sačuvati

- Jedan nalog za obe namere; nema razloga za odvojene radničke/naručilačke profile.
- Postojeći backend ugovori, autentikacija, RLS, revizije, idempotentnost i recovery čuvaju stvarne operacije.
- AI intervju, potpisan pregled i potvrda predstavljaju dobru osnovu; treba poravnati prikaz i sačuvani model.
- Zajednički tokeni, kontrolni elementi i originalna ilustracija već postoje. Potrebno ih je dosledno koristiti, ne graditi novi paralelni design system.
- Postoje jasna izdvajanja izvora, DEV primene, build-a i uređajskih dokaza. Problem je čitljivost i starost ulaznih pokazivača, ne nedostatak istorije.
- Postoji velika regresiona zaštita. Testovi treba da prate aktuelno ponašanje, ali datum nastanka nije razlog za brisanje.

## 7. Predloženi kompletan UX

### Početna

Dva jasna ulaza: „Objavi zadatak“ i „Uskoči i zaradi“, sa dovoljno identiteta, ali tako da korisna sadržina ne ostane ispod prvog ekrana. Odmah potom nastavak započetog razgovora ili konkretna obaveza. Ako nema ničega što čeka, nema velikog praznog odeljka. Aktuelne stavke prikazivati stvarnim nazivom; „Za tebe“ tek kada rezultat zaista dolazi iz matching-a. Sopstveni zadatak ne prikazivati kao preporuku za rad.

### Dodavanje zadatka kroz AI

Jedan razgovor, jedna smislena dopuna u datom trenutku, kratak sažetak prepoznatih činjenica. AI ne ponavlja ono što već zna. Na kraju pun pregled i jasna komanda za objavu. Korisnik može da ispravi rečenicom bez vraćanja kroz niz formulara. Potvrda lokacije je mala fokusirana radnja kada je neophodna, sa očuvanim razgovorom.

Primer 3D figurica: izrada kod izvršioca uz slanje/preuzimanje nije dolazak na adresu naručioca. Grad preuzimanja nije automatski mesto terenskog rada. Dostava i adresa ne smeju prerano postati javni podaci. Gost može da započne razgovor, a prijava treba da sačuva njegov nacrt i vrati ga na isti korak, prema postojećim dozvolama upisa.

### Radni profil kroz AI

„Čime se baviš?“ → razjasni režim rada → za terenski deo područje → dostupnost kada je bitna → razumljiv pregled. Ne uvoditi obavezan spisak alata/vozila. Profil mora da razlikuje mesto stanovanja od pokrivenosti. Ako osoba radi više usluga u različitim oblastima, model i prikaz to ne smeju sabiti u jedan pogrešan radijus.

„Cela Srbija“, „Vojvodina“, „Novi Sad i okolina“ i ruta zahtevaju različit potvrđeni oblik, ne samo lepu rečenicu. UI prikazuje šta je protumačeno i omogućava ispravku. Posle čuvanja isti potvrđeni podaci moraju da stignu do matching-a i obaveštenja.

### Zadaci, mapa i filteri

Jasan izbor na daljinu/na terenu, bez suvišnih plutajućih kapsula. Lista ima čitljive kartice i korisna prazna stanja. Mapa služi geografskim zadacima; remote ne treba izmišljenu tačku. Jedan filter prostor sa stvarnim aktivnim vrednostima, jasnim resetom i brojem rezultata samo kada server stvarno daje tu informaciju.

Za mnogo zadataka ne crtati sve pojedinačne kartice i markere. Iskoristiti postojeći discovery ugovor, pregledati njegove granice, server agregaciju/grupisanje, viewport, straničenje i stabilan izbor stavke. Proveriti realan broj zahteva, povratak na isto mesto i reakciju na pomeranje mape. Ne uvoditi drugi discovery sistem zbog vizuelnog redizajna.

### Detalj, ponuda, dogovor, poruke

Detalj daje dovoljno činjenica za odluku; ponuda sledi bez ponovljenog unosa poznatog. Dogovor prikazuje kratak kontekst zadatka, potvrđene uslove i jednu sledeću radnju, uz razgovor. Broj učesnika/slotova mora biti razumljiv bez tri slična broja u istom naslovu. Tačni kontakti i lokacije ostaju vezani za postojeće dozvole. Poruke otvaraju odgovarajući razgovor direktno; Back vraća na očekivano mesto. Privatni i grupni tokovi proveravaju se zasebno.

### Identitet, logo, ikone i animacije

Jedan čist master originalnog znaka i njegove odgovarajuće izvedenice za app ikonu, splash i prikaz u aplikaciji. Oštrina zavisi od stvarnog izvora, dimenzije, skaliranja i načina prikaza; samo oznaka HD ne rešava odsecanje ili zamućenje. Pre nove animacije proveriti originalni asset i njegovu geometriju.

Kratka uvodna sekvenca može zadržati spajanje i namig, ali prijava/ulaz ne smeju da čekaju dug obavezan film pri svakom pokretanju. Izabrati jedan jezik ilustracije, jasne male kontrolne znakove i retke naglašene trenutke. Radar na Home kartici povezati prema želji vlasnika, kontrolisati fokus/pozadinu i Reduce Motion. Ne animirati svaki naslov, red i karticu. Nativna glatkoća i Android otpornost proveravaju se na tačnom buildu.

## 8. Redosled čišćenja i završavanja

Ovo je redosled rada unutar postojećih redova, ne još jedan tracker.

| Paket | Konkretna promena | Dokaz završetka |
| --- | --- | --- |
| Ulaz u projekat | Kratak current ulaz, uklonjene zastarele tvrdnje iz aktivnih indeksa, istorija sa hash-evima | Urađeno u ovom dokumentacionom paketu; linkovi/arhiva/generatori proveravaju se zasebno |
| Identitet isporuke | Povezati postojeći buildIdentity sa APK/OTA/DEV/test/slika dokazima | Iz aplikacije i manifesta nedvosmisleno vidljiv isti izvor |
| Proizvod i laboratorija | Izolovati `dizajn-*` ulaze, proveriti asset/build zavisnosti | Release route/bundle dokaz + clean build; QA prikazi i dalje rade svojim putem |
| AI → profil → potvrđeni podaci | Jedan edit put, per-service mode/coverage, bez starog paralelnog upitnika | Izgovoreno → protumačeno → potvrđeno → sačuvano → ponovo pročitano, uključujući ispravku |
| Home → Zadaci → prijava | Ukloniti praznu hijerarhiju, uskladiti listu/mapu/filtere i povratak | Native cela putanja, greška/offline/loading i stanje filtera |
| Dogovor → razgovor → završetak | Kratak kontekst, jasni uslovi, privatnost i sledeća akcija | Odvojeni lični/grupni tokovi; ništa se ne „potvrđuje“ samo animacijom |
| Brend i motion | Jedna originalna asset osnova, povezan radar, kontrolisane sekvence | Tačan native prikaz, Reduce Motion, pozadina, čitljivost i frame/ANR provera |
| Završno uklanjanje ostataka | Ukloniti dokazano nepovezane komponente, duple stilove, obsolete test expectations i neupotrebljen build korak | Bez izgubljene funkcije/deep link-a; ciljani testovi, zatim puna integraciona regresija i završni APK |

Svaki paket menja postojeći tok na mestu. Ako je potrebna privremena zamena iza kontrolisanog uslova, mora imati tačno imenovan izlaz i uklanjanje starog puta. Ne ostavljati trajno „old“, „new“, „v3“, „v4“ implementacije za isti ekran.

## 9. Šta ne treba čistiti po nazivu ili datumu

- Primenjene Supabase migracije, ledger, revert i failed dokaze; oni su sled porekla, ne ekran aplikacije.
- RLS, auth, revision, idempotency, privacy i recovery testove zbog toga što su stari.
- Kompatibilne redirect-e pre provere svih deep link/push/Back potrošača.
- `.web` varijante na osnovu Android import grafa.
- Originalne brand/HTML izvore pre raskidanja stvarne build zavisnosti.
- Arhivu izvan aktivnog ulaza samo da bi statistika fajlova izgledala bolje.
- Tuđe lokalne promene: na početku su već postojali izmenjen `eas.json` i necommitovan `supabase/candidates/register_3d_print_taxonomy.sql`; ovaj paket ih ne preuzima.

## 10. Testovi i poštena tvrdnja o kvalitetu

Aktuelni discovery daje 620 testnih fajlova; ranijih 195 paketa / 4.069 testova nije sadašnji inventar. Broj ne govori koliko testovi pokrivaju stvarne putanje. Puni test suite nije pokrenut u ovom dokumentacionom paketu.

Za refaktor: zadržati testove korisničkog ishoda i poslovnih granica; pregledati testove koji samo zaključavaju stari tekst, import ime ili raspored. Stari mock za nekorišćeni Home/Entry nije razlog da se komponenta zauvek čuva. Ali brisanje testa bez zamene pokrića može sakriti regresiju. Svaki uklonjeni test treba da ima razlog: obrisana mogućnost, duplikat, ili važeći naslednik koji proverava isti rizik. Puna regresija ima smisla na povezanoj integraciji i pre finalnog APK-a, ne posle pomeranja svake margine.

## 11. Supabase i matching — otvorena stvar koju dizajn ne sme sakriti

Prethodni paket `WORKER_COVERAGE_IMPLEMENTATION_20261018.md` razlikuje primenjeni country guard od nepriključenog regionalnog kandidata. Country guard je primenjen na DEV migracijom `20261018075854`; regionalni `coverage-core.candidate.sql` nije aktiviran niti ima pozivaoca u aktuelnom matching-u. Sintetički PostGIS dokaz ne dokazuje ceo AI/dispatch/push tok.

Da regioni zaista rade potrebni su potvrđena projekcija kroz intervju, potpisan upis, model/čitanje, teritorijalni katalog i dispatch kandidat izbor koji ne odbacuje radnika pre konačne procene. Sačuvano prethodno neslaganje closure sertifikata zahteva zasebno rešavanje; nije promenjeno ovim čišćenjem.

Zato nije tačno reći „sve radi savršeno, ostaje samo dizajn“. Vizuelni prikaz mora da bude jasan, ali mora da predstavlja stvarno podržane podatke. Push se dokazuje celom vezom: potvrđen profil → podoban zadatak → događaj → ciljna isporuka → provider receipt → otvaranje odgovarajućeg ekrana, uz postojeće odobrenje za takav test. Ovaj paket nije slao obaveštenja.

## 12. Završni kriterijum

Čista aplikacija ima jedan aktuelni ulaz za razvoj, jedan prikaz svakog poslovnog toka, razumljivu hijerarhiju i dokaze vezane za tačnu isporuku. Istorija ostaje dostupna, ali ne upravlja sadašnjim ekranom. AI, profil, matching i obaveštenja moraju koristiti isti potvrđeni smisao usluge, mesta i vremena.

U ovom paketu završeni su inventar i sređivanje ulaznih smernica. Preostaju izdvajanje laboratorije, konkretne promene ekrana, povezivanje radara, završavanje regionalnog toka, objedinjena native provera i jedno jasno označeno aktuelno izdanje. Nijedan runtime fajl ili test nije obrisan, baza i APK nisu promenjeni ovim paketom.

## 13. Provera ovog dokumentacionog paketa

- Osam arhiviranih originala provereno je prema SHA-256 manifestu i bajtovima početnog Git commit-a: sve se poklapa.
- Pet neizmenjenih blokova AGENTS pravila (dozvole, verifikacija, privatnost, poslovna pravila i uslovna pravila) poređeno je sa originalom. Izmene su u redosledu čitanja, zastareloj grani i izričitoj primeni nove dizajnerske slobode.
- Provereno je 48 lokalnih linkova u aktivnim ulaznim dokumentima; nijedan ne nedostaje.
- Registar i dalje ima istih 62 reda. Nijedan `telefon` dokaz ili status nije promenjen ovim paketom.
- Runtime/build/backend tracked diff van postojećeg tuđeg `eas.json` nije dodat. Postojeći necommitovan SQL kandidat ostaje odvojen.
- `node scripts/control/osvezi.mjs` je izvršen; generator prijavljuje 0 poziva aplikacije ka funkciji koje nema u snapshot-u. Ovo je strukturna provera nad datiranim snapshot-om, ne novi live poziv ili funkcionalni PASS.
- Postojeći LIVE generator i njegov `--check` prolaze; `git diff --check` prolazi.
- Puni Jest, novi APK i test na uređaju nisu izvršeni u ovom dokumentacionom paketu. Hosted tabla nije ponovo objavljena; lokalni generisani prikaz jeste osvežen.
