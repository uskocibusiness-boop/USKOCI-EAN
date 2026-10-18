# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI — aktuelni dizajnerski pravac

Ažurirano 18.10.2026. Putanja ostaje ista da postojeće veze rade. Ovo je dizajnerski pravac u postojećem planu, ne drugi registar statusa.

## Odluka vlasnika i obim

Najnoviji zahtev je da aplikacija dobije jasan sadašnji izgled i tokove, bez gomilanja starih ekrana i smernica, uz slobodu za redizajn. Prethodni SPOJ/V28/V41/V46 rasporedi, veličine pločica i tačne motion sekvence više nisu obavezna vizuelna kompozicija. Čuvamo prepoznatljiv USKOČI identitet i poreklo originalnih resursa. Ne tvrdimo da su novi logo, animacija ili ekrani već izrađeni.

Jedan nalog istovremeno može da objavljuje zadatke i radi. AI razgovor je glavni način pravljenja zadatka i uređivanja radnog profila. Korisnik govori prirodno; aplikacija jasno pokazuje šta je razumela i traži potvrdu bitnih podataka. Pregled pre upisa, izbor između nejasnih mesta, mapa za potvrdu i eksplicitno slanje ostaju korisne kontrole, ne paralelni ručni upitnik.

Kategorije i njihovi ID-jevi ostaju u pozadini. Alati i vozila nisu obavezan intervju niti uslov matching-a prema odluci vlasnika; postojeću serversku primenu proveriti posebno. Promena prikaza sama ne dokazuje promenu dispatch-a.

## Vizuelna osnova

**Najnovija dopuna vlasnika, 18.10.2026:** premium Apple jasnoća i fluidnost, stručno prilagođene USKOČI. Svaki ekran može da se prekomponuje; nepotrebni tekstovi, obrasci i ponovljene informacije se uklanjaju. Sledeća osnova je smer, a ne zaključan recept. Stare zabrane redizajna i pojedinačne dozvole za rutinske izmene su ukinute u aktuelnom AGENTS.md. Gotova kvalitetna rešenja mogu da se ugrade uz proveru licence, native kompatibilnosti i svrhe.

- Bele čitljive površine, taman osnovni tekst, siva pomoćna informacija. Zelena označava jasnu glavnu akciju/izbor; narandžasta nosi prepoznatljivost i pažnju u smislenom kontekstu.
- Inter i postojeći sistemski tokeni su radna osnova. Jedan sistem kontrola i razmaka. Ne uvoditi još jednu paletu ili „v6“ porodicu paralelnih ekrana.
- Jedna dominantna radnja po koraku. Činjenice imaju prednost nad ilustracijom. Kartica samo kada grupisanje pomaže razumevanju ili otvara konkretnu stavku.
- Originalni 2.5D crteži su selektivni akcenti; strelica, zatvaranje, filter i navigacija ostaju jasni kontrolni znakovi. Nedostajuća informacija nije dekorativno popunjena izmišljenim podatkom.
- Dizajnirati na običnoj veličini teksta; proveriti uski ekran i uvećan tekst kao otpornost, bez odsečenih komandi. Sačuvati sistemske accessibility oznake, tastaturu, safe area i dodirne površine.

## Povezane porodice ekrana

| Porodica | Šta treba da bude jednostavno |
| --- | --- |
| Ulaz i prijava | Prepoznatljiv znak, razumljiva vrednost, vidljiva prijava/registracija; uvod ne odlaže upotrebu |
| Početna | „Objavi zadatak“ i „Uskoči i zaradi“, nastavak započetog i stvarno aktuelne stavke; bez praznih odeljaka i opštih savetodavnih kartica |
| AI zadatak | Reci šta treba → razjasni samo nedostajuće → pregled → eksplicitna objava; kratak sažetak tokom razgovora, pun pregled na kraju |
| AI radni profil | Šta radiš → kako/gde radiš ako je terenski → dostupnost kada je bitna → potvrda; kasnije jedan jasan ulaz „Izmeni kroz razgovor“ |
| Sačuvani profil | Razumljiv prikaz potvrđenih usluga i pokrivenosti, bez duplih alijasa, lažnog radijusa za remote i obaveznih praznih redova opreme |
| Zadaci | Razumljiv izbor „Na daljinu / Na terenu“, korisna lista i fizička mapa; jedan uredan prostor filtera, sačuvano stanje pri povratku |
| Detalj i ponuda | Dovoljno stvarnih podataka za odluku, jedna jasna prijava, pregled stvarnih uslova pre slanja |
| Dogovor i poruke | Kratak kontekst zadatka, prihvaćeni uslovi i sledeća radnja uz razgovor; privatni podaci ostaju iza odgovarajućih dozvola |
| Profil i podešavanja | Lični identitet i radne usluge u istom nalogu; podešavanja kratko grupisana, opasne radnje jasno odvojene |

Početna, Zadaci, Dogovori i Poruke su postojeća četiri glavna odredišta. Nema automatskog vraćanja tri taba iz septembarskog nacrta. Svako spajanje ili uklanjanje odredišta mora da sačuva dostupnost funkcija, push/deep link i povratak.

## Mesto i prirodni razgovor

Izrada figurice kod izvršioca uz slanje ili preuzimanje nije automatski terenski dolazak kod naručioca. Ne tražiti kućnu tačku na mapi samo zato što je spomenut grad. Dostava/preuzimanje su detalji izvršenja. Za terenski zadatak treba razjasniti stvarno mesto rada; za radnika razdvojiti prebivalište od teritorije usluge.

„Novi Sad“, „Novi Sad i okolina“, „cela Vojvodina“, „cela Srbija“ i ruta nisu ista geometrija. AI sme da predloži tumačenje, a potvrđeni model mora da ga sačuva tako da profil, matching i obaveštenja koriste isti smisao. Dok nisu povezani potvrda, upis, čitanje i dispatch, region prikazan tekstom nije završen regionalni matching.

## Animacije

Motion treba da objasni promenu ili da kratko izrazi identitet: dodir, otvaranje, slanje, potvrda. Radar pripada kartici „Uskoči i zaradi“ prema ispravci vlasnika; proveriti stvarno povezivanje u kodu pre tvrdnje da radi. Ne uvoditi beskrajno kretanje na svakoj kartici. Transform/opacity na nativnom driver-u gde odgovara, bez ponovnog aktiviranja ranijeg Reanimated problema. Petlje staju u pozadini i van aktivnog ekrana; Reduce Motion daje mirno jasno stanje. Brzina i broj animacija proveravaju se u stvarnom native prikazu.

## Izvršenje i dokazi

Prvo svrha i povezana putanja, zatim kompozicija, stvarna stanja (učitavanje/prazno/greška/offline/uspeh), implementacija i ciljana provera ponašanja. Nakon smislene grupe promena: build iz poznatog izvora, emulator, pregled vrha/sredine/dna, tastature i povratka. Trenutna dozvola je emulator; fizički telefon samo u posebno odobrenom prozoru. Ne praviti APK za svaku malu stilsku izmenu.

Stari UX nacrt ostaje trag ranijeg rešenja; razliku zabeležiti u pogođenim redovima i izveštaju. Vlasnik je 18.10. dao trajno „PRIMENI” za povezano usavršavanje i primenu. Rutinske odluke, provereni serverski paketi i objedinjeni APK ne čekaju novo odobrenje. Raditi veće celine i proveravati ih zajedno, uz ranije provere konkretnih rizika za podatke i isporuku. Autentifikacija, vlasništvo, privatnost, stvarni podaci i potvrda poslovnog upisa ostaju deo proizvoda; izvršenje i ograničeni testovi prate AGENTS §3.1.

Prethodna verzija ovog dokumenta sačuvana je [neizmenjena](../authority/history/entry-cleanup-20261018/docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md). Ne čitati je kao naredbu da se vrati star izgled.
