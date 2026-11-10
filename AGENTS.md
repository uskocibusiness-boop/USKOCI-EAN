# AGENTS.md — USKOČI

Operativna pravila za postojeći proizvod `uskocibusiness-boop/USKOCI-EAN`. Ovo nije novi izvršni plan ili UX master.

## 1. Svrha i autoritet

Dovršavaj postojeći USKOČI kroz male, povezane i proverljive izmene. Čuvaj korisnikov rad i već potvrđene funkcije.

- Poslednja izričita odluka vlasnika određuje šta proizvod treba da radi i kako treba da izgleda.
- GitHub, lokalne izmene i aktivni DEV opisuju različita stanja. Nijedno nije automatski ispravnije: utvrdi poreklo i efekat razlike. Testovi i ugovori dokazuju samo svoj obim; postojeći kvar nije proizvodno pravilo.
- `docs/plan/CODEX_PLAN_RADA.md` je jedini tehnički izvršni plan i evidencija dokaza. Ne pravi paralelni master ili opšti backlog.
- Povučeni `docs/product/USKOCI_PRODUCT_UX_MASTER.md` ne čitaj, ne rekonstruši, ne citiraj i ne vraćaj iz istorije, drugih grana ili lokalnih kopija. Istorijske reference ga ne vraćaju u upotrebu.
- Opšte veštine za dizajn, Expo ili bazu su pomoć za implementaciju. Ne mogu promeniti odluke vlasnika niti same odobriti nove biblioteke, arhitekturu ili deploy.

## 2. Početak i nastavak rada

Potvrdi repozitorijum, stvarnu radnu granu, HEAD, nekomitovane izmene i noviji remote rad. Sačuvaj tuđe promene; bez hard reset-a i force push-a.

Na početku nastavka pročitaj strukturu postojećeg plana i njegov aktuelni checkpoint. Zatim za pojedinačni zahvat čitaj relevantan ugovor, kod i dokaze. Ne ponavljaj već završenu analizu kada se njeni ulazi nisu promenili.

Aktuelni SHA, CI run, broj migracija i Edge verzije pripadaju datiranom checkpointu, ne trajnim pravilima ovog fajla. Ako su relevantni ulazi isti, koristi prethodni dokaz za isti obim umesto ponavljanja provere. Razlikuj istorijski nalaz od sadašnjeg kvara. U početnom statusu navedi šta je dostupno: lokalni kod, GitHub, DEV, Auth i Android.

## 3. Proizvodne odluke koje treba sačuvati

- Procenjuj postojeću Početnu i njene karusele prema korisničkoj svrsi i poslednjoj odluci vlasnika od 10.11.2026. Dobre funkcije sačuvaj; jasno pokvareno ili zbunjujuće iskustvo popravi u odobrenom obimu. Veće promene rasporeda ili navigacije pripremi kao pregledan pre/posle predlog, bez samovoljnog redizajna.
- Četiri taba su Početna, Zadaci, Dogovori i Poruke. Profil se otvara preko avatara.
- Primarne akcije su tačno „Objavi zadatak“ i „Uskoči i zaradi“. Jedini zvanični slogan je „USKOČI — Vaš partner za svaki zadatak.“ Ne menjaj ove formulacije u druge gramatičke oblike i ne vraćaj istorijske slogane. U ostalom razgovoru i podršci zadrži Vi/Vam/Vas.
- Jedan nalog ima jednu zajedničku reputaciju. Predlog AI-ja nije potvrđena objava ili aktivacija.
- Sačuvaj cenu, valutu, jedinicu obračuna i satnicu po osobi. Ne pretvaraj jednu vrstu cene u drugu bez korisničke potvrde.
- Pre Dogovora javna lokacija je približna; precizna lokacija dostupna je samo učesnicima kada je dozvoljeno. REMOTE ne zahteva izmišljenu adresu; prevoz A→B čuva obe tačke.
- Prvo izdanje je za Srbiju i besplatno korisnicima, bez monetizacije platforme. Tehnička provera nije pravno odobrenje.

## 4. Obim odobrenja i samostalnost

Važi odobrenje koje je vlasnik već dao za konkretan posao; ne traži ga ponovo za istu radnju. Tehničke ispravke koje ostvaruju odobreno ponašanje, bez nove proizvodne odluke, izvršavaj samostalno.

Aktuelni nalog od 10.11.2026. odobrava manje popravke jasno lošeg UX-a, modernizaciju postojećih tokova i usklađivanje teksta sa potvrđenim identitetom. Takve zahvate izvršavaj samostalno. Veću promenu navigacije ili identiteta koja nije odobrena pripremi kao konkretan pre/posle predlog. Ne vraćaj stare ideje samo zato što su bile dokumentovane; ne ruši potvrđene funkcionalnosti.

Produkcija, objavljivanje u prodavnicama, plaćeni pozivi, promene budžeta, tajni i rizične migracije traže odgovarajuće konkretno odobrenje. Instalacija skilla ne predstavlja takvo odobrenje.

## 5. Način implementacije

Uzmi najvažniji otvoreni posao iz aktuelnog plana. Utvrdi uzrok, uradi najmanju povezanu ispravku i proveri ceo promenjeni deo toka. Ako je jedna oblast blokirana pristupom ili infrastrukturom, nastavi nezavisan odobren posao.

- Koristi postojeće komponente, tokene, servise i ugovore. Refaktoriši kada postoji konkretan kvar, dupliranje ili izmereno usko grlo; veličina fajla sama nije razlog.
- AI treba da koristi poznate činjenice, prihvati korisnikovu ispravku i postavi jedno stvarno potrebno pitanje kada podatak nedostaje. Nerazumljiv unos treba razjasniti. Korisnik ne administrira stablo usluga niti bira tehničke identifikatore.
- Korisnik ne potvrđuje tehničku kategoriju ili svaki čvor stabla. AI predlaže semantičko povezivanje, a server ga automatski validira i sprovodi prema ugovoru, bez zahteva da korisnik pogodi kanonski naziv. Stvarno nejasan smisao zahteva pitanje; konačna objava ili aktivacija zahteva korisničku potvrdu.
- Čuvaj vlasništvo, korisničku potvrdu, reviziju, idempotentnost i autorizaciju. Grešku ne rešavaj uklanjanjem te zaštite.
- Čuvaj unos pri grešci i prekidu mreže. Neposredan prikaz poruke nije potvrda serverskog upisa; potvrdi upis autoritativnim odgovorom ili readback-om prema ugovoru.
- Za pogođeni ekran proveri sadržaj, učitavanje, prazan rezultat, grešku, tastaturu i povratak kada su relevantni. Tekst treba da bude kratak, profesionalan i dosledan Vi/Vam/Vas.
- Pomoćne agente koristi za nezavisne zadatke kada ubrzavaju posao. Dodeli jasne granice fajlova; izbegni istovremeno uređivanje istog koda.

## 6. Provera i prenos

Za malu izmenu pokreni direktan regresioni test i relevantnu susednu proveru. Za zaokruženu celinu proveri promenjeni tok i odgovarajuće tipove, SQL ili bezbednosne ugovore. Puni propisani CI pokreći na milestone-u i pre odgovarajuće promocije; ne posle svake male izmene.

Koristi stvarne komande iz aktuelnog `package.json`, workflow-a i operativnog paketa. Ne prilagođavaj test da prihvati kvar, ne briši negativne zaštite i ne označavaj nepokrenut test kao uspešan.

DEV prenosi samo kroz odgovarajući provereni paket sa preflight-om, kompatibilnošću, rollback-om i postflight-om, u okviru odobrenog obima. Sirov kandidat nije deploy paket. Razliku source/DEV označi kao P0 samo kada ugrožava bezbednost, podatke ili ispravnost poslovnog toka; obično još nepreneto odobreno source unapređenje nije samo po sebi kritičan kvar. Ne slabi R01/R10 proveru da bi rezultat bio zelen; razlikuj relevantnu blokadu promocije od nezavisnog source rada.

## 7. Dokazi i izveštaj

Razdvoji SOURCE, lokalni test, CI, DEV, Android i produkcionu spremnost. Navedi konkretan dokaz i njegov obim. Bez pristupa uređaju ili DEV-u ne tvrdi da je provera tamo izvršena. Plaćene modele pozivaj samo unutar izričito odobrenog obima i gornje granice troška, uz zaštitu od dupliranja; važeće odobrenje ne traži ponovo. Ne zaobilazi budžetsku kontrolu, ne povećavaj limit i ne resetuj rezervacije radi oslobađanja limita. Redovni obračun i usaglašavanje stvarnog ishoda kroz predviđeni proverljivi mehanizam ostaju dozvoljeni; odobrena popravka tog koda nije dozvola za proizvoljno prepisivanje evidencije.

Posle povezane celine sažeto navedi: šta je popravljeno, promenjene fajlove, commit/push ako su izvedeni, proveru, šta je preneto i šta ostaje otvoreno. DEV readback je obavezan kada je odobreni deploy stvarno izveden; source-only izmena ne sme biti predstavljena kao DEV rezultat. U postojeći plan dodaj samo potreban checkpoint. Nastavi sledeći odobren posao umesto ponavljanja istorije. Vlasniku objašnjavaj jednostavno na srpskom.
