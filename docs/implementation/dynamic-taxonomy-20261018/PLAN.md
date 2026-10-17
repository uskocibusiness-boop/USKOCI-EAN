# Dinamička taksonomija: glavni pravci, dubina i međugrane

Stanje 18.10.2026. Ovo je aktivan source plan, ne potvrda da je novi tok pušten na DEV ili u APK. Kanonski DEV: `leqcwgzvjsxugfgzdmth`.

## Značenje vlasnikove odluke

AI razgovor za zadatak i AI razgovor za radni profil dele isti katalog. Korisnik slobodno opisuje šta traži ili šta zaista nudi. AI predlaže najbliži postojeći kanonski pojam ili novu granu na pravom mestu. Katalog može da raste i po širini i po dubini. Korisnik pre čuvanja vidi značenje, režim rada i celu predloženu putanju. Jedan nalog i dalje ima jedinstven identitet; uloga naručioca ili radnika je kontekst radnje, ne drugi nalog.

„Vrh piramide“ je logički opseg `ON_SITE` ili `REMOTE`. Fizički katalog već ima više glavnih kategorija (`parent_id IS NULL`) u tim opsezima; ne treba izmišljati jednu ogromnu kategoriju „Sve“. `CREATE_NEW_BRANCH` dodaje novu glavnu kategoriju u potvrđenom opsegu. `CREATE_CHILD` dodaje jednu ili više novih podgrana ispod postojećeg roditelja na bilo kojoj dubini. `PROPOSE_RESTRUCTURE` predlaže umetanje međugrane iznad već postojećeg čvora; to je zasebna, jače kontrolisana operacija.

**Nema poslovnog maksimuma ukupne dubine stabla.** U jednom atomskom korisničkom predlogu ostaje mali tehnički limit novih čvorova (trenutno šest), ograničenje veličine zahteva i vreme izvršavanja. Ponovljene potvrđene radnje mogu da grade neograničeno mnogo nivoa ukupno. Ta granica po radnji sprečava da jedan pogrešan AI odgovor odjednom napravi stotine čvorova. Baza ima indeks nad `parent_id` i pregled dece po jedan nivo.

## Pravilo odlučivanja za jednu uslugu

1. Uzmi samo posao koji je korisnik eksplicitno opisao/ponudio. Alat, vozilo, znanje jezika ili lokacija sami po sebi nisu ponuda usluge.
2. Odredi `ON_SITE`, `REMOTE` ili traži razjašnjenje. Kod radnika svaka usluga ima zasebno potvrđen režim; isti naziv sme imati oba.
3. Traži tačan kanonski naziv ili proveren alijas u **celom** aktuelnom katalogu. AI-jev UUID bez poklapanja naziva/alijasa nema autoritet.
4. Ako nema ekvivalentnog pojma, poredi postojeće grane po značenju i opsegu. Veza „srodno“ nije isto što i „isto“: npr. 3D modelovanje, 3D štampa i izrada figurica mogu biti povezani, ali ne smeju automatski deliti identitet ni radničku sposobnost.
5. Ako postoji jasan roditelj u istom režimu, predloži `CREATE_CHILD` ispod njega. Ako ne postoji odgovarajući roditelj, predloži `CREATE_NEW_BRANCH` u potvrđenom opsegu. Ako je izbor između više roditelja nejasan, ostavi `PENDING_CLASSIFICATION` i traži kratko razjašnjenje ili pregled.
6. Predlog ne upisuje ništa. Server ga veže za nalog, razgovor, tačnu reviziju činjenica, verziju i fingerprint kataloga. Potpisani pregled prikazuje novu putanju. Posle postojećeg Save/Accept, jedan transakcioni batch writer proverava isti plan ponovo i tek tada daje ID i vezuje ga za sačuvan profil ili zadatak. Neuspeh klasifikacije ne briše sadržaj korisnika.
7. Poklapanje i push dolaze tek iz potvrđene i vezane kategorije uz područje i raspoloživost. „Srodno“ nikada samo po sebi ne daje pravo radniku da prima ponude; alati i vozilo ostaju informacija, ne uslov poklapanja.

## Međugrana i promena postojećeg stabla

Postoje dva različita slučaja:

- Nova putanja bez pomeranja postojećih ID-jeva, npr. `Digitalne usluge → 3D → Izrada figurica`, može biti običan `CREATE_CHILD` sa više novih segmenata. Svaki segment se proverava.
- Umetanje `3D izrada` između već postojećeg roditelja i kategorije `3D štampa` menja putanje postojećih čvorova i možda nasleđivanje u matcheru. AI sme da predloži `PROPOSE_RESTRUCTURE`, ali ne sme to automatski izvršiti kroz običan korisnički Save. Potrebni su ciljna kategorija, očekivani stari roditelj, novi roditelj, lista pogođenih potomaka i veza, provera ciklusa, isti režim, verzija/fingerprint, procena uticaja na matching i tačan revert. Za takvu promenu je potreban operatorski pregled. ID postojećeg čvora ostaje isti ako se promeni samo roditelj.

## Utvrđeno sada

- DEV katalog: 135 kategorija, 17 fizičkih glavnih kategorija, najveća viđena dubina 3, verzija 3. Stari prekidač `auto_registration_enabled=false`; to ne znači da je novo potpisano primanje automatski završeno.
- Poslednja primenjena migracija `20261017223855` podržava potpisani `CREATE_CHILD` pregled ispod postojećeg roditelja. Nema novih Gemini hintova (0), pa nema dokaza stvarnog nastanka čvora.
- Gemini shadow izvor ume da predloži `CREATE_NEW_BRANCH` i `PROPOSE_RESTRUCTURE`, ali dosadašnji capture SQL prima samo `REUSE_EXISTING` i `CREATE_CHILD`; pregled, klijentski dekoder i batch writer takođe odbijaju novu glavnu granu. Zato ona nije aktivna.
- AI katalog trenutno dobija najviše 8 stranica po 100 čvorova po opsegu; to nije model za neograničen rast. Prompt šalje samo relevantnu listu do 96 stavki po intervjuu. Kratki tehnički token „3D“ ranije je bio izbačen iz rangiranja; source je ispravljen i pokriven testom.
- SQL koji gradi putanje za AI imao je granicu 32 pretka. Source kandidat `ai-catalog-context-deep-ancestry-v2.sql` uklanja tu granicu uz zaštitu od ciklusa i vremenski limit; nije primenjen. JS katalog sada prihvata dublje putanje uz ograničenje veličine odgovora.
- Kandidat `gemini-turn-root-hints-v2.sql` proširuje samo neautoritativni capture za novu glavnu granu; ne daje pravo upisa. Nije primenjen.
- Dijagnostičke klase za `INVALID_PLAN` su u Edge source-u, ali nisu deploy-ovane. Pet ranijih logova za task AI pokazuju `INVALID_PLAN`, a DEV hint tabela je prazna.

## Redosled implementacije i dokaza

1. **Popraviti osnovni AI capture.** Očitati flagove bez otkrivanja tajni; uskladiti žive Edge verzije i source; pustiti bezbednu dijagnostiku tek uz posebno odobrenje. Za stvarni novi razgovor klasifikovati razlog `INVALID_PLAN`; ne nagađati na osnovu statusa. Posebno dokazati oba intervjua.
2. **Zatvoriti postojeći `CREATE_CHILD` kraj do kraja.** Kompatibilan klijent, jedna sintetička nova usluga, potpisan prikaz putanje, Save/Accept, outbox, batch, binder, isti ID u profilu i zadatku, bez pogrešnog pusha. Testirati stari katalog, dupli hint, nepostojeći roditelj, pogrešan režim, alijas/koliziju i replay. Nijedan plaćeni AI poziv ili DEV upis nije impliciran samim source radom.
3. **Dodati `CREATE_NEW_BRANCH`.** Capture → potpisan pregled → klijent → batch writer pod `parent_id=NULL` i potvrđenim režimom. Pre upisa proveriti globalnu kanonsku koliziju, proverene alijase, bezbednost svakog novog segmenta i da ne postoji očigledan već uspostavljen ekvivalent. Nejasan slučaj ostaje na pregledu. Testirati oba režima, istovremene upise, idempotentni replay i povratak na prethodnu verziju.
4. **Skalirati semantičku pretragu.** Trenutno učitavanje celog kataloga sa plafonom 800/opseg zameniti serverskim paginiranim kandidatskim pretraživanjem koje uvek radi proveru tačnog naziva/alijasa nad celim katalogom. AI dobija relevantne putanje sa jasno naznačenim da je to uži izbor, a ne dokaz nepostojanja. Meriti broj čvorova, latency i cenu model konteksta na 100, 1.000 i 10.000 čvorova.
5. **Uvesti poseban pregled restrukturiranja.** Predlog sa eksplicitnim `targetCategoryId`, `expectedParentId` i impact digest; bez automatskog izvršenja iz razgovora. Operator može potvrditi atomski reparent uz proveru ciklusa i tačan revert. Prebacivanje postojećih ID-jeva, `MERGED`/`RETIRED`, promene opsega i veza su zasebne operacije.
6. **Release provera.** Celokupan Jest gate, migracioni manifest, nesklad closure certifikata, kompatibilan APK/emulator; telefon samo u vlasnikovom prozoru. Push se dokazuje odvojeno, jednim događajem i jednim uređajem.

## Kriterijum „gotovo“

Jedan nepoznat posao u zadatku i isti posao na radničkom profilu prolaze razgovor, eksplicitni pregled, upis i vezivanje na isti kanonski ID; online i terenski režimi ostaju odvojeni; srodna ali različita usluga ne dobija pogrešan ID; novi glavni pravac se može dodati pod ispravnim opsegom; novi potomak može da se doda ispod već dubokog roditelja; restrukturiranje ne menja postojeće čvorove bez posebnog operatorskog dokaza. Tek tada se može reći da se katalog pametno širi u aplikaciji.

## Source provera ovog prolaza

`classificationEngine.mjs` sada zadržava tehnički token `3D` u izboru relevantnih grana, odbija roditelja u pogrešnom režimu i prihvata postojeće putanje dublje od 32 nivoa (uz veličinski limit odgovora). `classificationGeminiShadow.mjs` čuva `CREATE_NEW_BRANCH` samo kao hint bez autoriteta. Dva SQL kandidata su izvedena iz živih DEV tela uz MD5 preflight; nakon uklanjanja njihovih nameravanih promena, normalizovana tela su jednaka sadašnjim živim telima. SQL parser ih prihvata. Ciljni dinamičko-taksonomski testovi: **137/137**, TypeScript provera: prolaz. Ovi rezultati ne dokazuju SQL izvršavanje kandidata, validan Gemini hint ni kategorijski upis.
