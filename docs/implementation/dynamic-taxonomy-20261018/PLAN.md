# Dinamička taksonomija: glavni pravci, dubina i međugrane

Stanje 18.10.2026. SQL za novu glavnu granu i duboke putanje i obe AI Edge funkcije jesu primenjeni na kanonski DEV `leqcwgzvjsxugfgzdmth`; kompatibilan APK i stvarni AI razgovor za novu uslugu još nisu dokazani. Tačan dokaz je u `supabase/operations/dev-alpha/ledger/20261018_taxonomy_root_and_depth_application.receipt.json`.

## Značenje vlasnikove odluke

AI razgovor za zadatak i AI razgovor za radni profil dele isti katalog. Korisnik slobodno opisuje šta traži ili šta zaista nudi. AI predlaže najbliži postojeći kanonski pojam ili novu granu na pravom mestu. Katalog može da raste i po širini i po dubini. Korisnik pre čuvanja vidi značenje, režim rada i celu predloženu putanju. Jedan nalog i dalje ima jedinstven identitet; uloga naručioca ili radnika je kontekst radnje, ne drugi nalog.

„Vrh piramide“ je logički opseg `ON_SITE` ili `REMOTE`. Fizički katalog već ima više glavnih kategorija (`parent_id IS NULL`) u tim opsezima; ne treba izmišljati jednu ogromnu kategoriju „Sve“. `CREATE_NEW_BRANCH` dodaje novu glavnu kategoriju u potvrđenom opsegu. `CREATE_CHILD` dodaje jednu ili više novih podgrana ispod postojećeg roditelja na bilo kojoj dubini. Vlasnik je 18.10. pojasnio da umetanje međugrane između postojećih čvorova **nije potrebno** za ovaj cilj; ne sprovoditi automatsko premeštanje postojećih kategorija.

**Nema poslovnog maksimuma ukupne dubine stabla.** U jednom atomskom korisničkom predlogu ostaje mali tehnički limit novih čvorova (trenutno šest), ograničenje veličine zahteva i vreme izvršavanja. Ponovljene potvrđene radnje mogu da grade neograničeno mnogo nivoa ukupno. Ta granica po radnji sprečava da jedan pogrešan AI odgovor odjednom napravi stotine čvorova. Baza ima indeks nad `parent_id` i pregled dece po jedan nivo.

## Pravilo odlučivanja za jednu uslugu

1. Uzmi samo posao koji je korisnik eksplicitno opisao/ponudio. Alat, vozilo, znanje jezika ili lokacija sami po sebi nisu ponuda usluge.
2. Odredi `ON_SITE`, `REMOTE` ili traži razjašnjenje. Kod radnika svaka usluga ima zasebno potvrđen režim; isti naziv sme imati oba.
3. Traži tačan kanonski naziv ili proveren alijas u **celom** aktuelnom katalogu. AI-jev UUID bez poklapanja naziva/alijasa nema autoritet.
4. Ako nema ekvivalentnog pojma, poredi postojeće grane po značenju i opsegu. Veza „srodno“ nije isto što i „isto“: npr. 3D modelovanje, 3D štampa i izrada figurica mogu biti povezani, ali ne smeju automatski deliti identitet ni radničku sposobnost.
5. Ako postoji jasan roditelj u istom režimu, predloži `CREATE_CHILD` ispod njega. Ako ne postoji odgovarajući roditelj, predloži `CREATE_NEW_BRANCH` u potvrđenom opsegu. Ako je izbor između više roditelja nejasan, ostavi `PENDING_CLASSIFICATION` i traži kratko razjašnjenje ili pregled.
6. Predlog ne upisuje ništa. Server ga veže za nalog, razgovor, tačnu reviziju činjenica, verziju i fingerprint kataloga. Potpisani pregled prikazuje novu putanju. Posle postojećeg Save/Accept, jedan transakcioni batch writer proverava isti plan ponovo i tek tada daje ID i vezuje ga za sačuvan profil ili zadatak. Neuspeh klasifikacije ne briše sadržaj korisnika.
7. Poklapanje i push dolaze tek iz potvrđene i vezane kategorije uz područje i raspoloživost. „Srodno“ nikada samo po sebi ne daje pravo radniku da prima ponude; alati i vozilo ostaju informacija, ne uslov poklapanja.

## Više novih nivoa bez premeštanja postojećeg stabla

Postoje dva različita slučaja:

- Nova putanja bez pomeranja postojećih ID-jeva, npr. `Digitalne usluge → 3D → Izrada figurica`, može biti običan `CREATE_CHILD` sa više novih segmenata. Svaki segment se proverava.
- Umetanje `3D izrada` između već postojećeg roditelja i kategorije `3D štampa` menja putanje postojećih čvorova i možda nasleđivanje u matcheru. To ostaje izvan ovog rada. AI ne dobija pravo da promeni roditelja postojećeg čvora kroz korisnički Save.

## Utvrđeno sada

- DEV katalog: 135 kategorija, 17 fizičkih glavnih kategorija, najveća viđena dubina 3, verzija 3. Stari prekidač `auto_registration_enabled=false`; to ne znači da je novo potpisano primanje automatski završeno.
- Migracija `20261017223855` podržava potpisani `CREATE_CHILD`. Migracija `20261017230303` dodaje `CREATE_NEW_BRANCH` kroz capture, potpisani pregled, transakcioni batch i oba bindera. Migracija `20261017230429` uklanja fiksni limit 32 pretka u AI katalogu. Nema novih Gemini hintova (0), pa nema dokaza stvarnog nastanka čvora iz pravog razgovora.
- Žive Edge funkcije su `uskoci-worker-interview` v41 i `uskoci-ai-interview` v84; svi njihovi fajlovi su byte-jednaki poslatom source-u na readback-u. Klijentski dekoder/prikaz za oba intervjua je u source-u, ali nije u novom APK-u.
- AI katalog trenutno dobija najviše 8 stranica po 100 čvorova po opsegu; to nije model za neograničen rast. Prompt šalje samo relevantnu listu do 96 stavki po intervjuu. Kratki tehnički token „3D“ ranije je bio izbačen iz rangiranja; source je ispravljen i pokriven testom.
- SQL koji gradi putanje za AI imao je granicu 32 pretka; sada je uklonjena uz zaštitu od ciklusa i vremenski limit. Sintetička putanja od 40 nivoa prošla je u transakcionoj probi i sve probe su vraćene. JS katalog prihvata dublje putanje uz ograničenje veličine odgovora.
- Stari zasebni kandidat `gemini-turn-root-hints-v2.sql` nije primenjen; objedinjeni v3 paket sadrži istu capture izmenu. Ne primenjivati ga naknadno.
- Dijagnostičke klase za `INVALID_PLAN` su u Edge source-u, ali nisu deploy-ovane. Pet ranijih logova za task AI pokazuju `INVALID_PLAN`, a DEV hint tabela je prazna.

## Redosled implementacije i dokaza

1. **Popraviti osnovni AI capture.** Očitati flagove bez otkrivanja tajni; uskladiti žive Edge verzije i source; pustiti bezbednu dijagnostiku tek uz posebno odobrenje. Za stvarni novi razgovor klasifikovati razlog `INVALID_PLAN`; ne nagađati na osnovu statusa. Posebno dokazati oba intervjua.
2. **Zatvoriti postojeći `CREATE_CHILD` kraj do kraja.** Kompatibilan klijent, jedna sintetička nova usluga, potpisan prikaz putanje, Save/Accept, outbox, batch, binder, isti ID u profilu i zadatku, bez pogrešnog pusha. Testirati stari katalog, dupli hint, nepostojeći roditelj, pogrešan režim, alijas/koliziju i replay. Nijedan plaćeni AI poziv ili DEV upis nije impliciran samim source radom.
3. **Dokazati primenjeni `CREATE_NEW_BRANCH` u stvarnom toku.** Capture → potpisan pregled → kompatibilan klijent → batch writer pod `parent_id=NULL` i potvrđenim režimom. Sintetički ON_SITE dvonivovski upis, replay i tačan revert su prošli u `ROLLBACK` probi. Ostaju stvaran razgovor u oba režima, provera kolizija/stale verzije pod opterećenjem i krajnje vezivanje na profil/zadatak. Nejasan slučaj ostaje na pregledu.
4. **Skalirati semantičku pretragu.** Trenutno učitavanje celog kataloga sa plafonom 800/opseg zameniti serverskim paginiranim kandidatskim pretraživanjem koje uvek radi proveru tačnog naziva/alijasa nad celim katalogom. AI dobija relevantne putanje sa jasno naznačenim da je to uži izbor, a ne dokaz nepostojanja. Meriti broj čvorova, latency i cenu model konteksta na 100, 1.000 i 10.000 čvorova.
5. **Ne premeštati postojeće čvorove.** Vlasnikov trenutni cilj pokriva novu glavnu granu, novu granu istog nivoa i više novih potomaka u jednoj potvrdi. Reparent postojećih ID-jeva, `MERGED`/`RETIRED` i promene opsega nisu potrebni za taj tok.
6. **Release provera.** Celokupan Jest gate, migracioni manifest, nesklad closure certifikata, kompatibilan APK/emulator; telefon samo u vlasnikovom prozoru. Push se dokazuje odvojeno, jednim događajem i jednim uređajem.

## Kriterijum „gotovo“

Jedan nepoznat posao u zadatku i isti posao na radničkom profilu prolaze razgovor, eksplicitni pregled, upis i vezivanje na isti kanonski ID; online i terenski režimi ostaju odvojeni; srodna ali različita usluga ne dobija pogrešan ID; novi glavni pravac se može dodati pod ispravnim opsegom; novi potomak može da se doda ispod već dubokog roditelja; restrukturiranje ne menja postojeće čvorove bez posebnog operatorskog dokaza. Tek tada se može reći da se katalog pametno širi u aplikaciji.

## Source provera ovog prolaza

`classificationEngine.mjs` zadržava tehnički token `3D`, odbija roditelja u pogrešnom režimu i prihvata putanje dublje od 32 nivoa. `classificationGeminiShadow.mjs` čuva `CREATE_NEW_BRANCH` kao neautoritativan hint i modelu sada eksplicitno kaže da poslednji segment bude korisnikova usluga, uz najviše šest novih segmenata po potvrdi. DEV transakcione probe pokazale su FAIL pre / PASS posle za root i duboku putanju, sintetički dvonivovski root upis i idempotentni replay. Revert u transakciji vraća tačne prethodne MD5 definicije; closure digest je isti. Ciljni dinamičko-taksonomski testovi: **138/138**; dva klijentska paketa: **80/80**; TypeScript provera: prolaz. Nije potvrđen validan Gemini hint iz stvarnog razgovora, stvarni korisnički upis, vezivanje na profil/zadatak ili push.

Ceo `npm test` gate nije zelen: 607 paketa je prošlo, 12 palo (13.770 prolaznih, 50 palih i 9 preskočenih testova). Pali paketi obuhvataju stare kontrakte navigacije, Reanimated patch i UI/mokove radnog razgovora; ciljni testovi taksonomije su prošli. Ove padove ne prikazivati kao odobrenje za izdavanje APK-a. Izolovani spisak neuspeha je sačuvan u projektnom radnom direktorijumu, van repozitorijuma.

## Uslovi pre tvrdnje da je ceo tok gotov

1. Bez dodatnih neodobrenih Gemini poziva, nastaviti sintetičke i negativne dokaze za `REMOTE`, dubokog roditelja, pogrešan režim, postojeći kanonski naziv/alijas, konkurentni upis i stale fingerprint. Potvrditi da nesiguran međusegment ne prolazi i da transakcija ne ostavlja polovičan upis.
2. Napraviti kompatibilan DEV APK i proveriti potpisani prikaz i Save na emulatoru. Živi SQL/Edge bez tog klijenta nisu ceo proizvodni tok.
3. Za jedan stvarni Gemini test tražiti zasebno ograničeno odobrenje sa providerom, modelom, brojem poziva, plafonom troška i nalozima. Bez validnog hinta iz oba intervjua nije dokazano da Save stvara granu iz običnog razgovora.
4. Pre obećanja neograničenog rasta ukloniti fiksni plafon učitavanja 800 čvorova po režimu. Ukupna dubina nema nametnut poslovni limit, ali pretraga i raspoloživo vreme upita imaju realna tehnička ograničenja.
