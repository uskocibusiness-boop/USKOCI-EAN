# USKOČI — kompletan predlog UI/UX-a i povezanog završavanja

20.10.2026. Prošireno posle pet vlasnikovih Airbnb referenci: `14410`, `14416`, `14413`, `14401`, `14395`. Ovo je tekstualni blueprint celog proizvoda, uz presek dokazanog rada. **Autoritet ostaje Premium White canon; status i dalje živi u registru 62 toka.** Predlog ekrana nije dokaz njegove implementacije. Ovo nije još jedan paralelni design canon.

**Najkraće:** treba ozbiljno prekomponovati ključne ekrane i povezati ih sa stvarnim poslovnim stanjima. Promena navigacije je završena mala celina. Dovršen redizajn, brzi AI i kompletan put od objave do recenzije još nisu isporučeni kao jedan proizvod.

### Kako čitati

- §1–2: smer i stvarno stanje.
- §3–7: sažeti ekrani, plan, fizički nalazi i postojeći kod.
- **§8–12: analiza referenci, nova organizacija i detaljna kompozicija ekrana.**
- **§13–17: podaci, AI, ikonice, motion, klijent i server.**
- **§18–20: redosled isporuke, čišćenje i dokaz završetka.**

Source presek za ovaj prošireni predlog: `f2d90c79`, grana `feature/unified-qa-master-20261017`, čisto stablo pre dopune. Izgrađen i instaliran emulator APK je iz `47cbd0e2`; kasniji commit sadrži dokumentaciju i jedan komentar. [CI 39370415630](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39370415630): **622 paketa / 14.016 testova, bez padova i preskočenih testova**. Hash i tačan opseg fizičke provere su u `evidence/LIGHT_NAVIGATION_20261020.json`. To nije potvrda javne spremnosti.

## 1. Koji dizajn radimo

**Svetao, miran USKOČI sa jasnim radnjama.** Bela osnova, taman tekst, zelena kao glavni akcenat, topla narandžasta za objavu i potrebnu pažnju, plava za informaciju. Blage tonirane površine razdvajaju sadržaj. Velike tamne plohe i mnogo sjajnih predmeta ne treba da preuzmu ekran.

Postojao je plan u devet talasa, ali je do sada isporučivan deo po deo uz rešavanje servera i klijenta. Ceo proizvod zato još nema dovršen i ujednačen izgled. Tamna navigacija bila je jedna prethodna implementaciona odluka; vlasnik je sada korigovao taj smer. Canon je usklađen, pa je budući agent ne treba ponovo vratiti kao obavezno pravilo.

### Dve uloge ikonografije

- **Kontrole:** jednostavni vektorski simboli za navigaciju, Back, pretragu, filter, zatvaranje, prilog i mikrofon. Ujednačena optička veličina i debljina. Nazivi ostaju kada simbol sam nije dovoljan.
- **Sadržaj:** kvalitetna 2.5D ilustracija kada pomaže razumevanju namere, vrste zadatka ili praznog stanja. Ne treba svaki podatak, dugme i tab da bude mala ilustracija.

Donji meni sada koristi postojeći centralni Glyph/Phosphor sistem. Nema nove biblioteke niti druge palete. Izabrani tab dobija zelen simbol, jasnu varijantu oblika, naziv i blagu zelenu podlogu; neizabrani su čitljivi i neutralni. Kontrola zadržava dovoljnu dodirnu površinu i kada je simbol manji.

To prati princip poznatih odredišta, ikone i naziva iz [zvaničnih Material smernica](https://github.com/material-components/material-components-android/blob/master/docs/components/BottomNavigation.md). Njihove tačne dimenzije i Android implementacija nisu preuzeti kao novi freeze za Expo aplikaciju.

### Vizuelna pravila koja daju koherentnost

1. Prvo se vidi **šta gledam**, zatim najvažniji podatak i sledeća radnja.
2. Jedna primarna akcija u konkretnom trenutku; ostale imaju manju vizuelnu težinu.
3. Kartica postoji kada predstavlja celinu ili radnju. Sitne činjenice ne zahtevaju svaka svoju karticu i senku.
4. Status ima razumljiv tekst, oblik i stvarnu server činjenicu. Boja sama nije status.
5. Veliki naslov ne sme da potisne sve korisne činjenice ispod prvog ekrana. Duži naslov se prelama, bez gubitka sadržaja.
6. Fotografija se prikazuje kada je stvarna i pomaže odluci. Nema dekorativne lažne fotografije zadatka.
7. Motion objašnjava promenu. Ne animira se ponovo svaki refresh, a Reduce Motion ostaje poštovan.
8. Isto značenje ima dosledan token i naziv. Kartica tuđeg zadatka i kartica mog zadatka imaju drugačiji prioritet.

## 2. Šta je sada stanje proizvoda

| Celina | Dokazano u navedenom opsegu | Otvoreno |
|---|---|---|
| Osnova | Jedan nalog, obe perspektive, aktivan canon i centralni sistem | Završna doslednost svih ekrana |
| AI zadatak i radnik | DEV Task 116 / Worker 71; stvarni razgovori, jedan pregled i kontrolisan Save; konkretne korekcije i čuvanje činjenica | Brzina, cena, širi skup promena, ceo voice tok i trajna pozadinska klasifikacija |
| Katalog / UUID | Čitanje aktuelnog stabla, stvarna nova grana posle Save-a, ponovno korišćenje ID-ja i proširenje načina rada | Širi povezani scenario i skaliranje uz merene troškove |
| Matching | Pozitivni i negativni primeri, uključujući izradu sa slanjem/preuzimanjem | Regionalno pokrivanje, sve tačke rute i povezani dispatch |
| Push | Nova prijava stigla na HONOR; klik otvorio Obaveštenja; odgovarajući red na emulatoru vodi na prijave | Sve vrste događaja, direktni ciljevi, grupni lifecycle i oporavak |
| Klijent / izgled | Novi delovi Početne, detalja, pretrage i composera; sada korekcija navigacije | Dogovori, čet, profil i ostali talasi još nisu kompletno završeni |
| Posao od početka do kraja | Postoje poslovni moduli, statusi i pojedinačni dokazi | Nova objedinjena proba dva/više naloga do završetka i recenzije |
| Izdavanje | Postoji preview build i emulator | Registracija/email, privacy/brisanje, dependency upozorenja, uslovi za spoljašnju probu i Play izdanje |

Brzina ostaje stvaran problem: poslednji ograničeni AI primer trajao je **10,710 s**, dva poziva modelu, **0,020685 USD internog evidentiranog troška**. Nije dovoljno popraviti boje dok razgovor toliko čeka. Ranija merenja upućuju na uzastopno generisanje modela kao glavni deo trajanja. Nova proba nije kontrolisan dokaz ubrzanja.

Ranije viđen prazan native detalj ostaje otvoren. Današnje kontrole ga nisu ponovile; novi router testovi nisu zamena za utvrđivanje uzroka.

## 3. Kompozicija ekrana — šta tačno treba da dobije korisnik

### Početna — „Šta sada treba da uradim?“

**Predlog:** mirnije zaglavlje sa logom, obaveštenjima i profilom; dve jasne namere „Objavi zadatak“ i „Pronađi zadatak“, zatim stvarno najvažnija obaveza. Naziv „Uskoči i zaradi“ ostaje postojeća vlasnička formulacija dok se posebno ne promeni; to nije statistika potvrđene isplate.

- Aktivni Dogovor ili prijava koja čeka odluku ima prednost nad opštim prečicama.
- Nastavak razgovora je kompaktan red sa kontekstom; ne zauzima pola ekrana.
- Moji zadaci i Moje prijave su lako dostupni, uz tačne brojeve samo kada projekcija daje celinu.
- Aktuelni zadaci se ne nazivaju „Za tebe“ bez stvarnog personalizovanog rezultata.
- Prazna Početna nudi prvu korisnu radnju. Greška jedne sekcije ne blokira sve ostalo.

**Šta čuvamo:** dve namere, jedan nalog, postojeće odvojeno učitavanje, pravi podaci.  
**Šta menjamo sledeće:** relativnu veličinu velikih kartica, ponovljene razmake i prioritet obaveza.  
**Zavisnost:** tačan sažetak aktivnih obaveza; ne izračunavati ukupne statistike iz jedne stranice.

### Zadaci — „Nađi posao koji mi odgovara“

**Mapu zadržati uz doradu.** Postojeći MapLibre i sheet nisu razlog za novi map engine.

- Pretraga i Filteri čine jednu jasnu kontrolnu zonu.
- Terenski i udaljeni zadaci jasno se razlikuju. REMOTE nema izmišljeni pin.
- Brzi filteri imaju čitljive nazive i stvarno stanje izbora; aktivni filteri i reset su vidljivi.
- Lista i mapa prikazuju isti kriterijum. Pomeranje ne pokreće nekontrolisane zahteve.
- Pin → kratak preview → detalj. Izabrani pin ima jasno stanje, bez dekorativnog povećanja koje zaklanja mapu.
- „Pretraži ovu oblast“ ima smisla samo kada se područje zaista promenilo.
- Sheet čuva položaj, lista čuva scroll, povratak iz detalja vraća isti kontekst.

**Šta čuvamo:** postojeće pločice, geografiju, privatnost i sheet mehanizam.  
**Šta proveravamo:** značenje Back strelice na glavnom odredištu; broj i veličinu kontrola; praznu oblast naspram filtera bez rezultata; veliki skup pinova.  
**Zavisnost:** isti server filteri za mapu/listu i poštene granice približne lokacije.

### Kartica i detalj zadatka — „Da li ovo odgovara meni?“

**Izvršilac:** naslov, budžet ili „Tražim ponude“, termin, mesto/udaljenost ili „Na daljinu“, broj mesta, objavljivač i tačna reputacija, moja prijava, primarna akcija.

**Vlasnik:** naslov i status, broj prijava, izabrani i preostala mesta, termin, šta čeka odgovor, „Pogledaj prijave“. Izmena kroz razgovor dobija manju težinu i poštuje granicu prvog izbora.

- Detalj ima čitljiv naslov, kompaktan pregled ključnih činjenica, opis, stvarne fotografije i jasnu donju akciju.
- Duži naslovi ne smeju pretvoriti ceo vrh u tri ogromna reda i sakriti opis/obavezu.
- „Ukupno“ i „po osobi“ stoje uz iznos. Budžet, ponuda i prihvaćen iznos nisu isti podatak.
- Privatna adresa ne ulazi u javni detalj.

**Šta čuvamo:** postojeću zajedničku projekciju činjenica i role-specific akcije.  
**Sledeća dorada:** bolji odnos naslova, činjenica i opisa; manje ponovljenih oznaka.  
**Zavisnost:** status i iznosi iz odgovarajuće revizije, tačni brojevi mesta.

### AI zadatak i radni profil — „Reci svojim rečima“

- Kratak, topao odgovor; AI pita samo ono što zaista nedostaje.
- Composer je glavna radna površina: mikrofon, prebacivanje na tastaturu, prilog kada postoji podrška.
- Snimanje, transkripcija, slanje i greška imaju različit vidljiv prikaz. Ne prikazivati lažnu live transkripciju.
- Jedna sažeta živa kartica pokazuje kako AI razume zahtev. Korisnik je može pregledati bez ponavljanja celog sažetka u svakoj poruci.
- Mapa/tačke se pojavljuju kada treba potvrditi razjašnjenu lokaciju. Regionalno pokrivanje nije samo krug nacrtan na mapi.
- Jedan pregled i „Izmeni kroz razgovor“. Nema ručnih formulara za poslovne detalje.
- „Pripremam pregled“ ili „Proveravam uslugu“ samo kada sistem stvarno radi taj posao. Poruka o čekanju nije zamena za ubrzanje.

**Šta čuvamo:** conversation/draft identitet, revizije, neposlat tekst, eksplicitni Save.  
**Sledeći posao:** izmereno skraćivanje kritičnog puta i usklađen živi sažetak; zatim povezani voice/location primeri.  
**Zavisnost:** razdvajanje brzog odgovora i klasifikacije bez prihvatanja zastarelog UUID-ja.

### Prijave i kandidati — „Koga da izaberem?“

- Jedan kandidat po jasnoj kartici: fotografija, ime, ocena i broj recenzija, njegova ponuda, obuhvat ljudi i poruka.
- Na vrhu: koliko ljudi još treba i koliko prijava čeka. Ne mešati broj prijava sa brojem ljudi.
- Prijava ima status iz perspektive onoga ko je šalje. Ne ponavljati CTA koji je već izvršen.
- Izbor jasno kaže osobu/osobe i iznos pre potvrde. Posle uspeha otvara pravi Dogovor.
- Pri konkurentnoj promeni kapaciteta UI osvežava činjenice i objašnjava šta se promenilo.

**Zavisnost:** potpuna projekcija, revizija prijave i kapacitet. UI ne izmišlja dostupnost kandidata.

### Dogovor — „Šta smo dogovorili i ko šta čeka?“

- Jasan status i naslov, zatim sledeća radnja.
- Sažeti uslovi: obim, prihvaćen iznos, termin/okvir, opšta oblast ili način izvršenja.
- Učesnici i ulaz u grupni razgovor; vlasnik jasno bira i privatni kanal konkretnog izvršioca.
- Kratak timeline stvarnih događaja. Obični razgovor ne mora da se duplira u timeline-u.
- Završetak, potvrda i otkaz su različiti događaji; prikaz ne svodi otkaz na uspešno završen posao.
- Telefon/adresa ne izlaze automatski. Deljenje ostaje svesno.

**Zavisnost:** grupni prikaz više saradnji ne sme tiho spojiti njihove zasebne iznose, prava i završetke. Novo ponašanje termina/otkaza mora imati serverski ugovor.

### Poruke — „Razgovaram sa pravom osobom“

- Lista razgovora razlikuje grupu i privatni kanal; vidi se zadatak, poslednji dozvoljeni sadržaj i stvarno nepročitano stanje.
- U razgovoru: kompaktna kartica zadatka, jasan naziv grupe/primaoca, poruke i stabilan composer.
- Slika, glas i tekst imaju slanje/čekanje/grešku/ponovni pokušaj. Nepoznat ishod najpre proverava rezultat.
- Prelazak iz grupe u privatni kanal ne prenosi nacrt ili prilog drugom primaocu.
- Nema „online“ ni potvrde čitanja ako server ne daje pouzdanu činjenicu.
- Bivši član vidi dozvoljenu istoriju, bez novih poruka, priloga i push-a. Novi član dobija samo ono što važeća grupna politika dozvoljava.

**Zavisnost:** grupni mediji, članstvo i pristup prilozima; ne uvoditi samo lepo dugme bez slanja i reprodukcije.

### Profil — „Ko je ova osoba?“

- Jedna mirna profil kartica: fotografija, ime, ocena i broj recenzija.
- Dodir ocene vodi na stvarne recenzije. Opis i ponuđene usluge dolaze iz potvrđenog radnog profila.
- Dokazani završeni poslovi prikazuju se uz jasno značenje uloge.
- Moj privatni pregled i tuđ javni profil imaju različite informacije.
- „Izmeni kroz razgovor“ menja radni deo; identitet i fotografija imaju svoje direktne kontrole.
- Portfolio i značke ostaju van prve verzije prema vlasnikovoj odluci.

**Zavisnost:** agregati za dozvoljeni i potpuno učitani skup; nema lažne zarade ili reputacionog skora.

### Obaveštenja, podešavanja i pomoć

- Obaveštenje kaže šta se dogodilo, za koji zadatak i šta korisnik može dalje.
- Cilj se autorizuje pri otvaranju. Stari/otkazani događaj ima razumljiv ekran.
- Podešavanja su grupisana kao nalog, privatnost, obaveštenja i pomoć; tehnički nazivi ne postaju meniji.
- Brisanje/izvoz, odjava i oporavak imaju stvarno potvrđen ishod.
- Loading, empty, offline i error nisu jedan generički prazan ekran.

## 4. Kako zatvaramo postojeći plan

Postojećih devet talasa ostaje mapa obuhvata. Implementacione celine povezuju susedne ekrane i zajedničke server ugovore:

1. **Globalna korekcija:** svetla navigacija, smireniji kontrolni simboli, veliki tekst i stabilan Back. Ovaj korak je upravo implementiran; uređajski dokaz se beleži posebno.
2. **AI i jedan kompletan posao:** brz i tačan nacrt → pregled → objava → prijava → izbor → Dogovor → poruka → potvrđen završetak. Na tom putu odmah doraditi prikaz koji smeta razumevanju.
3. **Oblasti i više ljudi:** isti model pokrivenosti kroz AI, Save, matching i dispatch; kapacitet i grupni kanali, slike/glas i članstvo.
4. **Koherentan vizuelni prolaz:** Početna, Zadaci, prijave, Dogovor, Poruke i Profil prema gornjoj kompoziciji, uz uklanjanje svake zamenjene komponente.
5. **Spoljašnja kontrolisana proba:** nova registracija/email, privatnost, brisanje, oporavak, neophodne dependency i operaterske provere, APK/AAB i testeri.

Ne čekamo da ceo backend bude savršen da bi izgled napredovao. Za svaki povezani ekran paralelno zatvaramo tačne podatke, korisničku radnju, oporavak i kompoziciju. Ne predstavljamo odsutan backend kao gotov UI.

## 5. Kada nešto smemo nazvati završenim

- Podaci i akcije su tačni za obe strane.
- Korisnik razume sledeći korak bez objašnjenja developera.
- Back vraća kontekst; tastatura i safe area ne zaklanjaju radnju.
- Privatnost i dozvole su proverene, uključujući negativan primer.
- Relevantni testovi prolaze; puna regresija ide uz povezani native paket.
- Stvaran APK je pregledan na emulatoru na reprezentativnim širinama i fontovima.
- Prikaz i kompletan tok imaju odvojeno označen dokaz.

**Nema poštenog procenta završenosti na osnovu broja testova.** Imamo ozbiljnu funkcionalnu osnovu, delimično ujednačen UI i nekoliko jasno određenih većih celina koje još treba završiti. Cilj sledećih paketa je da te celine zatvaramo kao stvaran korisnički put.

## 6. Dodatni fizički pregled — šta konkretno treba unaprediti

Pregledani su i Dogovori, Poruke i Profil na instaliranom `a18f31af`, 361 dp/font 1,15, 20.10.2026. u 06:36–06:37 po lokalnom vremenu. Ovo su datirani snimci pre svetle navigacije, sa postojećim Milos nalogom; nisu makete niti dokaz svih stanja.

| Ekran | Viđeno | Ocena i konkretna dorada |
|---|---|---|
| Dogovori | Naslov, Aktivni/Istorija, kalendar, dodatni red Sve/Tražim pomoć/Uskačem; prazan aktivni skup i veliko „Pogledaj istoriju“ | Čitljivo i funkcionalno, ali dve velike zone filtriranja prethode praznom sadržaju. Sačuvati dostupnost filtera, smanjiti njihovu vizuelnu težinu. Prazno stanje treba da objasni nastanak Dogovora; istorija je primarna samo kada korisnik zaista ima koristan nastavak tamo. |
| Poruke | Brend logo u vrhu, Aktivni/Završeni, prazna lista; naziv odredišta vidi se u donjoj navigaciji | Ujednačiti zaglavlje sa ostalim glavnim odredištima: jasan naslov „Poruke“. Sačuvati razliku aktivno/završeno, a za prvi razgovor kratko objasniti da se razgovor vezuje za Dogovor. Ne nuditi izmišljen chat ili lažan nepročitani broj. |
| Profil | Veliki avatar, ime, grad, „Još nema ocena“, „1 završen“, javni pregled i radni profil; odmah zatim podaci naloga | Osnova je pregledna. Identitet i reputaciju povezati u jednu kompaktniju celinu, a podaci naloga ostaju niže/uz podešavanja. „1 završen“ traži jasnu imenicu i značenje uloge. Sažetak „Na daljinu · Novi Sad, 30 km“ treba razdvojiti prema uslugama/načinu rada kako ne bi izgledalo da REMOTE zavisi od radijusa. Potrebno je proveriti projekciju pre izmene teksta. |

Početna, mapa i detalj ranije su pregledani iz galerije stvarnog `a18f31af` APK-a. Mapa je kandidat za **zadržavanje uz doradu**, a ne promenu biblioteke. Glavna zajednička slabost je raspodela prostora i prioriteta: previše velikih kontrola i dekoracije ima približno istu težinu. Svetla navigacija uklanja jedan takav izvor težine; ostali ekrani imaju naredne zasebne pakete.

## 7. Gde se sledeći paket stvarno implementira

Ovo su aktuelne porodice komponenti, ne nalog da se pravi paralelni UI:

| Celina | Polazni izvor | Šta sačuvati pri rekompoziciji |
|---|---|---|
| Globalne kontrole | `src/ui/system/Glyph.tsx`, `TabBarItem.tsx`, `ScreenHeader.tsx`, `tokens.ts`, `src/theme/colorTokens.ts` | Jedan registar simbola/tokena, dostupna imena, dovoljno velika površina i semantika selekcije |
| Početna | `src/ui/home/HomePresentation.tsx`, `src/data/homeSnapshot.ts` | Odvojeni error/retry za profil i prilike, server-owned brojevi i pravi ciljevi |
| Mapa / lista | `src/ui/v2/DiscoveryPresentation.tsx`, `DiscoveryMap.tsx`, `discovery/` | Postojeći map renderer i sheet, filter/kontekst, privatnost približnih lokacija |
| Moji zadaci | `src/ui/v2/MarketplacePresentation.tsx`, `OwnTaskCard.tsx` | Brojevi iz servera kada je lista straničena; ne prikazivati učitani deo kao ukupno |
| Dogovor | `src/ui/v2/AgreementPresentation.tsx`, `src/ui/agreements/` | Posebni statusi završetka/otkaza, sačuvani iznos/termin, coarse lokacija i dozvoljeni učesnici |
| Poruke | `src/ui/messages/ConversationInboxPresentation.tsx`, `src/ui/AgreementChat.tsx`, `src/ui/groups/` | Posebni grupni i privatni primaoci, istorija, oporavak slanja, dozvola za medije |
| Profil | `src/ui/profile/ProfileHubPresentation.tsx`, povezani javni prikaz i reviews | Jedan identitet, tačna reputacija, razlika privatnih podataka i javnih usluga |

U Home komentaru je pronađen još jedan zastareo pokazivač „Current owner direction“ ka dokumentu od 22.09. Preusmeren je na aktuelni canon. To je ispravka autoriteta u komentaru, bez promene poslovnog ponašanja.

## 8. Šta pet referenci zaista pokazuje

Ovo je procena vidljivih slika koje je vlasnik poslao, a ne tvrdnja da je pregledana cela Airbnb aplikacija ili njen kod.

| Referenca | Šta je kvalitetno u kompoziciji | Konkretna primena u USKOČI |
|---|---|---|
| `14410` — Filteri | Jasne grupe, tekst uz ilustraciju, prepoznat izbor, stalno dostupna završna radnja | Jedan sheet za filtere zadataka, primenjeni kriterijumi odvojeni od nacrta filtera, reset i „Prikaži rezultate“. Broj uz dugme samo ako imamo tačan rezultat celog upita. |
| `14416` — Profil | Identitet ima glavnu površinu; ostale opcije imaju manju težinu; jednostavna navigacija | Jedna USKOČI kartica osobe, ocena kao ulaz u recenzije, radne usluge ispod; lična podešavanja izdvojena. Ne praviti turističke pločice koje ne služe našem proizvodu. |
| `14413` — Poruke | Naziv odredišta, jedna prepoznatljiva ilustracija, kratko objašnjenje i sledeći korak | Prvo prazno stanje objašnjava da razgovori nastaju uz Dogovor; korisnik ide na svoje prijave/zadatke prema kontekstu. „Nema rezultata pretrage“ dobija drugu poruku. |
| `14401` — Fokusiran korak pretrage | Prethodno izabrano sažeto; pažnja na jednom nerešenom pitanju | AI potvrda lokacije ili rute prikazuje samo ono što treba razrešiti. Kalendar sme u filter pretrage; ne vraćamo ručni wizard za kreiranje zadatka. |
| `14395` — Istraživanje | Jasna pretraga, nastavak prethodne namere, slike uz sadržaj, promenljiv ritam sekcija | Nastavak AI nacrta i stvarno relevantne prilike; fotografije zadatka kada postoje, originalna ilustracija kada ne postoje. Ne preuzimati dekorativne karusele bez korisničke svrhe. |

Posebno važna pouka: kvalitet ovih slika nije samo u senkama. Svaka oblast ima prepoznatljivu ulogu, tekst ima rang, a ilustracija dobija prostor samo gde pomaže. To je moja dizajnerska procena referenci.

Airbnb je u svom izdanju iz maja 2025. povezao novi početni pregled, plan aktivnosti, poruke i profil u jednu aplikaciju. To podržava princip zajedničkog toka, ali nije specifikacija USKOČI funkcija. Njegova plaćanja, društveno povezivanje gostiju i turistička struktura ne ulaze automatski u naš proizvod. [Zvanično izdanje](https://news.airbnb.com/product-releases/airbnb-2025-summer-release).

## 9. Iskrena procena sadašnjeg izgleda

**Dobra osnova postoji:** čist tekst, dosta praznog prostora, centralne boje, originalan znak, prepoznatljive namere, map renderer, funkcionalni sheet i nova mirnija navigacija. Nije potrebno menjati tehnologiju da bi proizvod izgledao mnogo bolje.

**Glavni problem je kompozicija i odnos sadržaja, a zatim doslednost ponašanja.**

1. **Početna:** dve velike, gotovo iste horizontalne kartice zauzimaju visok deo ekrana. Korisnička obaveza dolazi znatno niže. Ista težina ne govori šta je važno danas.
2. **Zaglavlja:** negde je naziv ekrana, negde veliki brend. Korisnik u Porukama treba odmah da pročita „Poruke“. Brend ne mora na svakom ekranu ponavljati isti veliki početak.
3. **Obaveštenja i avatar:** na pregledanim ekranima deluju kao veliki zasebni predmeti. Malo funkcionalno zvono u jasnom dodirnom polju bilo bi mirnije; raskošnija ilustracija pripada sadržaju.
4. **Dogovori:** veliki filteri, drugi red filtera i velika akcija preuzimaju ekran čak i kada nema aktivnog sadržaja.
5. **Prazne Poruke:** trenutno objašnjenje uglavnom preusmerava na drugu karticu. Novom korisniku ne objašnjava dovoljno kako da dođe do prvog razgovora.
6. **Mapa:** gornja kapsula sabira Back, pretragu, filtere i dodatni meni; ispod je još niz velikih kapsula. Kontrole zauzimaju mnogo prostora. Sama podloga nije dokazana kao problem. Na jednoj široko zumiranoj slici ne može se zaključiti da pinovi ne rade.
7. **Kartice:** previše porodica koristi sličnu veliku zaobljenu površinu, pa pregled zadatka, komanda i obaveza mogu izgledati ravnopravno.
8. **2.5D materijali:** radar, sjajno zvono, logo i sitne ilustracije nisu optički ista porodica. Potrebna je zajednička art direkcija, uz jednostavnije operativne kontrole.
9. **Korisnički tok:** tehnički dobar RPC ne rešava pitanje gde se vraća Back, šta se čuva pri promeni kanala i da li je čekanje jasno. To mora biti deo svakog ekrana.

Zato preporučujem ozbiljniju rekompoziciju Početne, Dogovora, Poruka i profila. Mapu i detalje treba prilagoditi povezanoj celini. Neću označiti neviđeno stanje kao loše samo na osnovu naziva komponente.

## 10. Jedna jasna organizacija aplikacije

### Glavna odredišta

Zadržati četiri razumljiva odredišta: **Početna · Zadaci · Dogovori · Poruke**. Profil ostaje na avataru, obaveštenja na zvonu. Nema trajnog prekidača „sada si naručilac/sada si radnik“. Lokalni filter „Moji zadaci / Moje prijave“ ne menja identitet.

Moja preporuka za sledeću kompoziciju: glavna navigacija ostaje dostupna i u običnom istraživanju mape. Nestaje u fokusiranom toku, kao što su potvrda lokacije, fotografija preko celog ekrana ili pisanje AI zadatka. Korenski ekran Zadaci tada nema obaveznu Back strelicu koja izgleda kao izlazak iz cele aplikacije. To je **predlog promene postojećeg ponašanja**, koji tek treba potvrditi native probom i proverom prostora iznad sheet-a.

Četiri ravnopravna odredišta odgovaraju Android smernici za tri do pet glavnih destinacija. Primena je naš izbor; izgled, broj unutrašnjih kartica i tokovi nisu kopija Material aplikacije. [Android navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns).

### Tri različite vrste površina

- **Glavni ekran:** stabilno odredište i lista sadržaja. Naslov objašnjava gde sam.
- **Detalj:** jedan zadatak, osoba ili Dogovor; dovoljno prostora za čitanje. Back vraća na tačno prethodno mesto.
- **Sheet ili kratki dijalog:** jedna ograničena odluka, filter, potvrda ili izbor primaoca. Nije odlagalište za dugačak poslovni tok.

Ne treba svaki postojeći route izbrisati da bi nestao iz korisničkog toka. Stari deep link može postati bezbedan adapter ka jednom aktuelnom ekranu. Prvo prevezati sve ulaze i povratke; tek onda ukloniti duplu implementaciju.

### Povezani putevi

```text
OBJAVLJUJEM
Početna → AI zadatak → jedan pregled → objava
→ Moj zadatak → kandidati → izbor → Dogovor
→ grupa ili privatni razgovor → izvršenje → potvrda završetka → recenzija

USKAČEM
Početna / Zadaci → mapa ili lista → detalj → prijava
→ Moje prijave → izabran → moj Dogovor
→ razgovor → prijava završetka → potvrđeno → recenzija

MENJAM SVOJ RAD
Profil → sačuvani radni profil → isti AI razgovor
→ jedan pregled → Sačuvaj → pročitan potvrđeni profil
```

Nastavci istog procesa koriste isti identitet razgovora i server nacrta. Različiti procesi, kao zadatak i radni profil, imaju zasebne kontekste. Nijedan razgovor ne sme neprimetno promeniti aktivni profil, objavu ili tuđ Dogovor.

## 11. Detaljan tekstualni blueprint glavnih ekrana

Sve kompozicije u ovom odeljku su **predlog ciljane izvedbe**. Primeri iznosa, datuma i brojeva ljudi služe objašnjenju, nisu podaci o stvarnom korisniku.

### 11.1 Početna — pregled dana i dve namere

**Vrh:** manji USKOČI znak, funkcionalno zvono sa stvarnim indikatorom i avatar. Kratak naslov prema situaciji, bez obaveznog marketinškog slogana.

**Ako postoji obaveza:** prva sadržajna celina kaže, na primer, „Čeka tvoj izbor“ i prikazuje konkretan zadatak, broj prijava i „Pogledaj prijave“. Predstojeći Dogovor pokazuje stvarni termin i ulaz u Dogovor. Obaveza ima viši prioritet od preporučenog sadržaja.

**Ako nema obaveze:** dve namere imaju glavno mesto. Predlog je kompaktan par različito toniranih kartica: topli ton i originalna ilustracija beleške za objavu, blagi zeleni ton i radar za pronalaženje zadatka. Na uskom ekranu ili velikom tekstu prelaze u redove; nema prisilnog presecanja naziva.

**Sledeće:** sažet nastavak konkretnog nacrta; zatim „Moji zadaci“ i „Moje prijave“, kao brze radnje manjeg intenziteta. Lista prilika dolazi ispod, uz razlog preporuke samo kada ga sistem zaista ima.

**Ritam:** jedna istaknuta obaveza, zatim mirniji redovi, pa sadržajne kartice. Ne praviti pet hero kartica jednu ispod druge. Ne dodavati obavezan horizontalni kalendar praznom nalogu.

**Klik i povratak:** obaveza ide direktno na kandidata/potvrdu/Dogovor koji traži akciju. Back vraća scroll. Nova obaveza ne preuređuje ekran ispod prsta dok korisnik čita; osveženje se prikazuje mirno.

**Podaci:** zadržati odvojeno učitavanje profila i prilika. Nedostupan zbir nije nula. Ako akcija u međuvremenu više nije dostupna, otvoriti aktuelni predmet i objasniti promenu.

### 11.2 Zadaci — jedna pretraga, dva prikaza

**Vrh:** kompaktna pretraga koja prikazuje upit ili oblast. Pored nje jasno dugme Filteri sa brojem aktivnih kriterijuma. Dodatni meni postoji samo ako ima korisne radnje koje ne pripadaju filterima.

**Ispod:** razumljiv izbor „Na lokaciji / Na daljinu“, bez poistovećivanja načina rada sa globalnom ulogom korisnika. Kratke prečice poput Danas, Vikend ili Tražim ponude koriste isti filter model.

**Mapa:** grupisani pinovi za područje; dodir grupe približava ili otvara skup. Izabrani pin vizuelno i pristupačno odgovara jednom preview-u. Javni pin je približan; privatne tačke ne ulaze u podatke za javni renderer.

**Lista u sheet-u:** u kratkom položaju broj/objašnjenje rezultata i početak sadržaja; u srednjem deo mape i kartice; u punom lista sa stabilnim naslovom i filterima. Ne zaključavati identične fizičke visine za sve fontove i uređaje. Pomeranje sheet-a ne resetuje pretragu.

**REMOTE:** rezultati prelaze u listu, uz oznaku načina predaje kada je bitna. Izrada figurice sa slanjem nema lažan pin kod naručioca. Lokalno preuzimanje je zaseban uslov, a ne dokaz terenskog rada.

**Pomeranje:** „Pretraži ovu oblast“ pojavljuje se tek kada se viewport razlikuje od poslednjeg potvrđenog upita. Spor prethodni odgovor ne sme zameniti noviji skup. Udaljenost je označena kao približna i postoji samo uz legitiman referentni položaj.

**Veliki skup:** server upit i paginacija ostaju autoritet; ne crtati hiljade React kartica/pinova. Ne navoditi ukupan broj kao tačan ako imamo samo stranicu ili ograničeni klaster. Performanse meriti sa realnim gustim skupom i dugim naslovima.

**Back:** prvo zatvara otvoren filter/preview prema hijerarhiji, zatim vraća prethodno odredište. Povratak iz detalja čuva kriterijume, viewport, izabrani pin, položaj sheet-a i scroll liste.

### 11.3 Filteri — jedna korisna odluka

**Kompozicija:** naslov i Zatvori; kratke grupe „Način rada“, „Kada“, „Budžet“, „Vrsta zadatka“ samo prema stvarnoj podršci. Naprednije uslove sklopiti iza razumljivog otvaranja, ne napraviti drugi čarobnjak.

**Budžet:** odvojiti zadatke sa iznosom od „Tražim ponude“. Raspon mora jasno reći da li se odnosi na ukupan budžet ili po osobi; različite osnove se ne porede neobjašnjeno.

**Dno:** Reset i jedno „Prikaži rezultate“. „Prikaži 27 zadataka“ samo uz tačan server broj za trenutno izabrani upit. Dok broj nije poznat ostaje neutralni naziv, bez izmišljenog broja.

**Stanje:** promene unutar sheet-a su nacrt filtera. Zatvaranje bez primene vraća prethodno primenjeno stanje. Posle primene aktivni kriterijumi su vidljivi i mogu pojedinačno da se uklone.

**Razlika od AI izmene:** ovo su kriterijumi pretrage, ne ručno uređivanje poslovnog zadatka. Zato direktan izbor dana, iznosa ili područja u filteru ne krši AI-first tok.

### 11.4 Kartice zadataka — porodica prema ulozi

| Kontekst | Kompozicija od vrha ka dnu | Primarna radnja |
|---|---|---|
| Tuđ zadatak | Mala stvarna slika ili jasna ilustracija; naslov; budžet/ponude; termin i oblast; mesta; osoba/reputacija; stanje moje prijave | Otvori detalj; prijava iz detalja |
| Moj zadatak | Naslov i status; šta čeka mene; broj prijava; izabrani/preostali; termin | Pogledaj prijave ili Dogovor |
| Moja prijava | Naslov; „Čeka izbor“ / aktuelni ishod; moja poslata ponuda; obuhvat ljudi; termin | Pregled prijave ili otvaranje Dogovora |
| Map preview | Najkraći prepoznatljiv naslov, budžet, termin/oblast i mesta; bez dugog opisa | Pogledaj zadatak |
| Završen predmet | Naslov, ishod i stvarni datum, sažet identitet druge strane | Istorija / Oceni kada je dozvoljeno |

Velika fotografija nije obavezna za iznošenje stvari ili sitnu pomoć. Kada nema medija, manja originalna ilustracija i dobra tipografija bolji su od ogromne generisane fotografije koja liči na stvaran posao.

Popunjenost ima jedan glavni iskaz: **„3 od 5 mesta popunjeno“**, a akcioni kontekst po potrebi „Traže se još 2 osobe“. „Tvoja prijava: 3 osobe“ je drugi podatak. Ne stavljati tri brojke bez objašnjenja u isti niz.

### 11.5 Detalj zadatka — prvo razumevanje, zatim odluka

**Vrh:** Back i kontekstne pomoćne radnje; naziv zadatka velik, levo poravnat radi dugih naslova i lakšeg skeniranja. Centralno poravnavanje ne bih uveo kao obavezno pravilo za višeredne radne naslove.

**Prvi sadržaj:** budžet ili „Tražim ponude“, odmah sa osnovom ukupno/po osobi. Zatim kompaktni redovi: kada, gde/kako, koliko ljudi. To nije mreža šest jednakih velikih pločica.

**Glavni deo:** „Šta treba uraditi“, stvarne fotografije, posebni uslovi kada postoje. Ruta ima sažet redosled tačaka i javni pregled dozvoljene geografije. Opis ne ponavlja automatski budžet i datume koji se menjaju.

**Osoba:** mala kartica objavljivača sa imenom, ocenom i brojem recenzija kada postoje. Dodir vodi na javni profil.

**Dno:** izvršilac vidi „Prijavi se“ ili svoje aktuelno stanje. Vlasnik vidi „Pogledaj prijave“, broj koji čeka i preostala mesta. Fiksna donja akcija ima prostor iznad sistemske trake i ne prekriva kraj sadržaja.

**Nedostupnost:** istekao, zatvoren, popunjen, sopstveni zadatak i prethodna prijava imaju posebno objašnjenje. Nema dugmeta koje samo posle dodira saopšti već poznatu zabranu.

### 11.6 Moji zadaci i Moje prijave — radni pregledi

Ovo su odvojeni razumljivi pregledi iz Početne, bez dva profila. Naslov, pretraga kada ima smisla, kompaktan statusni filter i odgovarajuća porodica kartice.

**Moji zadaci:** istaknuti one gde vlasnik treba da bira, odgovori ili popuni mesta. Nacrt nije aktivna objava. Arhiva nije brisanje.

**Moje prijave:** jasno razdvojiti čekanje, izbor i završenu/neuspešnu prijavu. Odbijanje, povlačenje, istek i zatvaranje zbog ponovne objave nisu isti razlog. Poslata ponuda ostaje ono što je stvarno poslato.

Brojevi iz više stranica dolaze iz agregata; lokalno filtriranje učitane stranice ne dobija naslov „Sve prijave“ ako nije kompletno. Back posle detalja vraća isti red.

### 11.7 Slanje prijave i izbor kandidata

**Prijava:** kompaktan sažetak zadatka, iznos ponude kada ga tok traži, broj ljudi koje prijava predstavlja kada je podržan, poruka i „Pošalji prijavu“. Ovo su podaci ponude; ne prepravljaju zadatak.

Posle slanja ostaje pregled poslata ponuda + stvarni status. Pri gubitku odgovora proverava se idempotentni ishod pre ponavljanja. Ako nema radnog profila, nudimo razumljiv nastavak istog procesa kroz AI, a ne slepi izlazak na Početnu.

**Kandidati:** na vrhu potreban i preostali broj ljudi. Kartica kandidata: osoba, recenzije, poruka, ponuda, obuhvat. Njegova tvrdnja nije automatski „verifikovano“. Nema oznake da je video zadatak ako nema takve server činjenice.

**Izbor:** jedna kratka potvrda navodi koga biram, koliko mesta zauzima i koji iznos prihvatam. Pritisak ne označava uspeh pre potvrde servera. Ako je kapacitet promenjen, osvežiti preostala mesta i vratiti odluku korisniku.

**Granica:** mogućnost prijave za više osoba nije dokaz da svi imaju identitet, članstvo ili pristup četu. To mora pratiti postojeći ugovor i jasno imenovanog odgovornog podnosioca.

### 11.8 Dogovori — pregled obaveza

**Lista:** naslov „Dogovori“, zatim sažet izbor Aktivni/Istorija. Filter perspektive je manji i ne zauzima veliki samostalni red ako skup to ne zahteva. Kalendar je sekundarni prikaz stvarnih termina, ne obavezna sekcija svakom korisniku.

**Kartica:** sledeća obaveza ili termin imaju prednost; zatim naslov, učesnici i prihvaćeni uslovi. Primeri: „Čeka tvoju potvrdu završetka“, „Sutra u 15:00“, „Tražimo još jednu osobu“. Poslednji iskaz samo kada je potraga stvarno aktivna.

**Prazno:** korisnik bez Dogovora dobija objašnjenje kako nastaje i radnju prema svojoj aktuelnoj aktivnosti. Korisniku sa istorijom nuditi istoriju mirno, bez praznog ekrana sa jedinim ogromnim zelenim dugmetom.

### 11.9 Detalj Dogovora — zajednički radni prostor

**Vrh:** naslov zadatka, jasan status i najvažnija naredna radnja. „Čeka se druga strana“ navodi šta se čeka, bez pretvaranja čekanja u grešku.

**Uslovi:** sažet obim, dogovoreni iznos, termin/okvir, opšta oblast ili predaja. Posebna pravila važe za moje pojedinačne uslove i ukupni pregled vlasnika. Pojedinačne privatne finansijske uslove ne otkrivati drugim izvršiocima.

**Učesnici:** grupa prikazuje jednog vlasnika i izabrane izvršioce. Vlasnik dobija „Poruka“ uz odgovarajuću osobu i jedan „Grupni razgovor“. Izvršilac ima grupu i privatni razgovor sa vlasnikom, bez novog privatnog kanala ka kolegama.

**Tok događaja:** kratak niz stvarnih ključnih događaja: izbor, potvrđen termin, prijavljen završetak, potvrda ili otkaz. Detaljna istorija je proširiva. Nema lažnog „Korak 4 gotov“ dok jedan član još čeka potvrdu.

**Završetak:** izvršilac prijavljuje završetak svoje saradnje; vlasnik potvrđuje odgovarajući obuhvat. Grupni naslov ne sme potvrditi sve pojedinačne saradnje bez jasnog serverskog pravila i korisničke odluke.

**Otkaz:** odvojena sekundarna radnja sa konkretnim posledicama. Otkaz jedne saradnje nije otkaz celog zadatka. Posle izlaska jasno se prikazuje arhivski pristup i eventualna potraga za zamenom.

**Privatnost:** kontakt/adresa nisu dekorativni redovi glavnog pregleda. Deljenje ima imenovane primaoce i pravilo pristupa. Uslovi i čet ostaju povezani, ali ne dupliraju sve podatke.

### 11.10 Poruke — lista i pravi razgovor

**Lista:** jasan naslov „Poruke“, po potrebi pretraga, kompaktno aktivno/arhiva. Svaki red: osoba ili grupa, zadatak, poslednja dozvoljena poruka, vreme i istinito nepročitano stanje. Grupni kanal ima znak grupe i naziv zadatka, privatni kanal lice i ime.

**Razgovor:** zaglavlje primaoca; ispod sklopivo sidro zadatka sa statusom i otvaranjem Dogovora. Dok se čita istorija, sidro ne zauzima trećinu ekrana. Sistemski događaji imaju drugačiji tretman od poruke osobe.

**Composer za ljude:** tekst, prilog i mikrofon. Slanje glasovnog snimka ne izjednačavati sa AI transkripcijom. Snimak ima trajanje, otkazivanje i razumljiv način slanja; pristupačna alternativa ne traži isključivo precizan dug pritisak.

**Mediji:** fotografija sa stvarnim upload stanjem, pregled preko celog ekrana; glas sa reprodukcijom, trajanjem i greškom preuzimanja. Menjanje kanala zaustavlja ili kontroliše audio; nikada ne šalje pripremljenu sliku drugoj osobi.

**Čitanje:** nova poruka ne prekida čitanje starijih; pojavljuje se „Nove poruke“ uz povratak na dno. Otvaranje već čitanog razgovora vraća smislen položaj. Offline poruka ostaje lokalna i vidljivo nepotvrđena.

**Grupa:** ime pošiljaoca je jasno. Novi član prema odluci vlasnika vidi raniju grupnu istoriju; dobrovoljno izašli član dobija samo dozvoljenu istoriju do izlaska. Ti uslovi moraju važiti i za direktni URL priloga, Realtime, cache i push.

**Ne dodavati sada:** lažan online status, read-receipt bez ugovora, peer privatne poruke, bogate reakcije samo radi sličnosti sa drugim aplikacijama. Reply može biti koristan naredni dodatak, ali tek uz stabilan message ID, citat i pravila obrisane poruke.

### 11.11 Profil i radni profil

**Moj profil:** jedna kvalitetna, umereno izdignuta identitetska kartica. Fotografija, ime, ocena sa brojem recenzija, precizno nazvani završeni Dogovori. Ispod radni sažetak, javni pregled i podešavanja.

**Javni profil:** iste potvrđene javne činjenice, opis i ponuđene usluge; odvojeno kako osoba radi i gde. Ne prikazivati privatne podatke naloga. Dve perspektive mogu imati razdvojene tačne metrike, ali ne dva identiteta.

**Radni profil:** usluge, opis, područje i dostupnost čine uredan pregled, sa jednim „Izmeni kroz razgovor“. Nema olovke uz svaki podatak ni paralelnog ručnog uređivača. Jasno razlikovati sačuvan nacrt, aktivan profil i problem koji sprečava dobijanje prilika.

**Recenzije:** dodir ocene otvara listu autor–ocena–komentar–vreme, uz dozvoljeni kontekst. „Još nema ocena“ je potpuno stanje, bez nule koja izgleda kao loša ocena. Javno se ocenjuju potvrđeno završene saradnje.

**Prvo izdanje:** bez portfolija i znački. Identitetska fotografija se ne koristi kao dokaz veštine. „Vrednost završenih Dogovora“ eventualno pripada privatnom pregledu uz potpun server agregat, a ne kao neproverena javna „zarada“.

### 11.12 Obaveštenja i podešavanja

**Obaveštenja:** ikona događaja, jasan naslov, kontekst zadatka, vreme i nepročitano stanje. Dodir otvara tačan dozvoljen predmet. Za nestao ili otkazan predmet postoji objašnjenje i povratak, bez beskonačnog loadera.

**Predlog ciljanja push-a:** nova prijava → kandidati tog zadatka; nova poruka → konkretan kanal; izbor → moj Dogovor; završetak → odluka o završetku. Ovaj predlog zahteva usklađen payload/server i klijent. Današnji dokaz sa telefona potvrđuje otvaranje Obaveštenja, ne sve ove direktne ulaze.

**Podešavanja:** Nalog i prijava; Privatnost; Obaveštenja; Pomoć; O aplikaciji. Radne usluge se uređuju kroz radni profil. Dozvola operativnog sistema i korisnička preferencija obaveštenja prikazuju se odvojeno.

**Oporavak i sigurnost:** izvoz, brisanje, prijava problema, blokiranje i email recovery imaju stvarna stanja zahteva. Brisanje naloga nije isto što i skrivanje sa ekrana. Operativna/pravna spremnost mora biti posebno potvrđena.

## 12. AI i geografske površine — bez ručnih poslovnih formulara

### Razgovor o zadatku

1. Kratak naslov „Novi zadatak“, Back i po potrebi sažetak nacrta.
2. Jednostavna početna rečenica, npr. „Reci šta ti treba — pomoći ću ti da složimo zadatak 🙂“. Nema obaveznog smeška u svakoj poruci niti tokom greške ili otkaza.
3. Poruke ostaju glavni prostor. AI postavlja prirodna povezana pitanja samo za bitno što nedostaje. Ne ponavlja sav sažetak posle svakog odgovora.
4. Živi sažetak je sklopiv i ažurira se potvrđenim server odgovorom. Ne gura poslednju poruku van ekrana.
5. Snimanje ima srednji mikrofon, prilog levo kada je podržan i tastaturu desno. Pri kucanju tekst dobija prostor; isti raspored nije obavezna geometrija svakog stanja.
6. Opcija „Pregledaj pre slanja“ je dostupna i čitljiva. Puštanje mikrofona bez nje šalje prepoznati tekst AI-ju, ne objavljuje zadatak.
7. „Pregledaj zadatak“ otvara jedini pregled kada potrebne činjenice i obavezne provere dozvoljavaju. Ne prikazivati spremnost dok je ključna klasifikacija zastarela.

### Razgovor o radnom profilu

Ista porodica composera i sažetka, drugačiji smisao pitanja: **šta nudiš, gde radiš i kada si raspoloživ**. Alat/vozilo se ne iznuđuju kao obavezna anketa. Ako korisnik kaže „imam kombi“, pitati šta želi da radi sa njim samo kada namera nije jasna.

Primer: „Radim molerske radove u Novom Sadu i do 100 km okolo, radnim danima posle 15.“ AI treba da sačuva sve tri činjenice, razjasni nepoznato polazište kruga i važnu dostupnost, pa potvrdi razumevanje. Ne treba ponovo pitati grad, radius i dane kao da prethodna poruka nije pročitana.

Srodnu uslugu može predložiti kao izbor, ali ne dodaje je automatski. Ne vodi korisnika kroz tehničko stablo niti prikazuje UUID.

### Jedan pregled

Pregled koristi isti način prikaza činjenica kao objavljeni zadatak/sačuvani profil: korisnik vidi kakav rezultat dobija. Ima jednu „Izmeni kroz razgovor“ i jednu završnu akciju. Kod izmene AI prima postojeću reviziju i traženu korekciju. Ne počinje intervju od nule.

**Snimanje ili transkripcija u toku:** pregled ne sme tiho odbaciti glas. Neposlata poruka nije potvrđena činjenica. **Objava nepoznatog ishoda:** proveriti isti zahtev pre novog pokušaja; ne kreirati drugu objavu.

### Kada se pojavljuje mapa

| Šta korisnik kaže | Šta AI prvo razume | Šta se prikazuje korisniku | Šta mora potvrditi server |
|---|---|---|---|
| „U Futoškoj u Novom Sadu“ | Mesto rada, uz eventualno nejasan broj | Kandidat adrese/oblasti i pin za ljudsku potvrdu | Razrešenu tačku, nivo tačnosti i privatnost |
| „Od Limana do Petrovaradina“ | Ruta, ne dva nepovezana zadatka | Redosled polazište–odredište, razjašnjenje nepreciznih tačaka | Potvrđene potrebne tačke i način izvršenja |
| „Novi Sad i 100 km okolo“ | Krug rada od potvrđenog centra | Centar, vidljivi obuhvat i tekstualni sažetak | Isti centar/radius kroz Save i matching |
| „Cela Vojvodina“ | Administrativna oblast | Prepoznata oblast, razumljiva granica i sažetak | Kanonski region/geometriju, ne improvizovani radius |
| „Novi Sad i Beograd“ | Dve oblasti | Dva obuhvata, bez izmišljene povezanosti između njih | Uniju dozvoljenih područja |
| „Izradim pa pošaljem“ | Rad kod izvršioca uz fizičku predaju | Na daljinu + slanje/preuzimanje, bez pina kod naručioca | Režim i pravila predaje kao odvojene činjenice |

Poslednja tri složena geografska slučaja ne smeju biti proglašena gotovim na osnovu nacrtane mape. Regionalni model i provera svih potrebnih tačaka ostaju otvoreni.

Mapu otvaramo kada je korisno da osoba vidi i potvrdi razumevanje. Ne otvaramo je posle svake poruke koja slučajno pominje grad. Promena usluge iz remote u teren poništava nevažeće zavisne pretpostavke kroz server reviziju, uz jasno pitanje, bez tihog brisanja nepovezanih činjenica.

## 13. Podaci i privatnost određuju izgled

Tabela je ugovor koji treba potvrditi za svaku relevantnu projekciju, ne tvrdnja da su svi agregati i tipovi poruka već implementirani.

| Informacija | Autoritet i vidljivost | Pravilo prikaza |
|---|---|---|
| Naslov, opis, broj ljudi | Server nacrt pre Save-a; objava posle potvrde | Živi sažetak nije javni zadatak. Prikaz označava kontekst. |
| Kategorija/UUID | Kanonska klasifikacija prihvaćena serverom | Korisnik vidi razumljivu uslugu. Predlog kategorije ne glumi aktivno vezivanje. |
| Budžet | Potvrđena objava | „Budžet“, valuta, ukupno/po osobi; prazno nije nula. |
| Ponuda | Konkretna prijava i njena revizija | Vidi je ovlašćena strana. Ne zamenjuje budžet svim korisnicima. |
| Dogovoreni iznos | Prihvaćeni pojedinačni uslovi | Ne dokaz isplate. Grupni zbir samo za ovlašćenu perspektivu i potpun skup. |
| Potrebni/izabrani/preostali | Aktuelna serverska projekcija kapaciteta | Broj prijava nije broj osoba. Ne računati ukupno iz jednog učitanog dela. |
| Status prijave/Dogovora | Serversko stanje | Tekst i radnja zavise od moje uloge i dozvola. |
| Vreme izvršenja i rok prijave | Različita strukturirana polja | Ne prikazivati rok za prijavu kao termin rada. Početak bez kraja ne dobija izmišljeno trajanje. |
| Opšta lokacija | Javna približna projekcija | Mapa i kartica koriste samo dozvoljeno; ne izvode tačnu adresu iz privatne geometrije. |
| Privatna lokacija/ruta | Zaštićeni podaci i konkretna dozvola | Svesno deljenje odgovarajućoj osobi; više tačaka zahteva prava za svaku. |
| Radno područje | Potvrđen profil, model pokrivenosti | Regionalni naziv nije funkcionalan dok Save/matching ne dele isto značenje. |
| Dostupnost | Potvrđen raspored/profil | Ne izjednačavati „svakog radnog dana posle 15“ sa jednim višednevnim intervalom. |
| Ime/fotografija | Identitet i dozvoljena javna projekcija | Ne prikazivati email/telefon kao zamenu za ime. |
| Ocene/recenzije | Ovlašćene recenzije potvrđenih završetaka | Broj, prosek i listu vezati za isti skup i jasno značenje uloge. |
| Završeni poslovi | Potpun server agregat | Razlikovati završene pojedinačne saradnje i objavljene zadatke. |
| Usluge, veštine, alat, vozilo | Potvrđeni radni profil, različite činjenice | Posedovanje alata nije potvrda da nudi povezanu uslugu. |
| Poruka | Server kanal + membership + message ID | Lokalna pending poruka jasno odvojena; ne prenosi se u drugi kanal. |
| Slika/glas | Medijski zapis, autorizacija i dozvola kanala | Upload nije poslata poruka. URL keš ne sme zaobići prestanak pristupa. |
| Online/pročitano | Samo pouzdana podržana server činjenica | Bez nagađanja na osnovu otvorenog ekrana ili uspešnog slanja. |
| Obaveštenje/push | Događaj, inbox, transport i receipt su različiti slojevi | Prihvaćeno kod provajdera nije isto što i prikaz/klik na uređaju. |
| Statistika vrednosti | Potpuni autorizovani agregati | Ne izvoditi „zarađeno“ bez evidencije isplate, niti zbir iz prve stranice. |

### Svesno deljenje

Predlog četa ima opciju „Podeli lokaciju/kontakt“ sa jasnim primaocem. Postojeće bilateralne dozvole treba iskoristiti gde odgovaraju. Strukturisana grupna kartica sa opozivom zahteva zaseban dokaz da isti tip poruke i backend to podržavaju.

Običan tekst, fotografija ili glas sa adresom ostaju poruka: ne obećavamo da mogu biti povučeni iz sećanja, kopije ili tuđeg snimka ekrana. Ako budući član vidi celu grupnu istoriju, korisnik to mora razumeti pre slanja osetljivog sadržaja grupi. Novi član ne dobija automatski privatni bilateralni grant.

### Promene, otkazivanje i ponovna objava

- Pre prijava: izmena kroz isti AI kontekst i potvrđen pregled.
- Posle pristiglih prijava, pre bilo kog prvog izbora: „Izmeni i ponovo objavi“, uz transakcionu zamenu i jasne posledice. Stare prijave se ne sele u novu objavu.
- Posle prvog izbora: nema tihog menjanja prihvaćenih uslova. U prvom izdanju samo dogovoreni ograničeni tok preciziranja vremena unutar prihvaćenog fleksibilnog okvira, uz potvrdu pogođenih učesnika.
- Otkaz se ne blokira zahtevom za tuđu dozvolu. UI pre potvrde kaže da li se otkazuje moja saradnja ili ceo zadatak.
- Potraga za zamenom kreće samo u dozvoljenoj fazi; ne otvara otkazan/završen zadatak. Vlasnik i dalje bira.
- Otkaz nije uspešan završetak i ne daje javnu recenziju po potvrđenom obuhvatu prve verzije.

Ne uvoditi opšti komplikovani pregovarački sistem za svako polje u prvom izdanju. To bi proširilo i UI i state machine izvan sada dogovorenog obuhvata.

## 14. Originalan vizuelni sistem

### Površine i tipografija

**Osnova:** svetao ekran i taman tekst; blago tonirana pozadina može odvojiti radni pregled od sadržaja. Bele kartice koriste tanku liniju ili diskretnu senku prema ulozi. Nema obaveze da svaki ekran bude identično čisto beo niti da svaka kartica bude odignuta.

**Pet uloga:** hero za glavni identitet/nameru; sadržajna kartica za zadatak/osobu; kompaktan red za poruku/obaveštenje; inset za činjenice; sheet za odluku. To su varijante postojećeg Surface sistema, bez drugog nezavisnog UI framework-a.

**Tipografija:** postojeća skala već ima čitljive veličine i može se unaprediti kroz upotrebu: naziv odredišta, naslov zadatka, sekcija, osnovni tekst, pomoćni podatak. Ne menjati font nasumično po ekranima. Dugi naslov i veliki sistemski font dobijaju dodatnu visinu; ne rešavati kompoziciju automatskim smanjivanjem teksta.

**Raspored:** veliki razmak između različitih značenja, manji između povezanih činjenica. Dosledno poravnanje početka teksta i kontrola. Kartica se ne ugnježđuje u tri druge kartice samo radi senke.

**Boje:** zelena pripada identitetu, odabiru i glavnim pozitivnim radnjama; narandžasta objavi/pažnji; plava komunikaciji/prijavi; topli žuti ton čekanju ili vremenu gde ima smisla; crvena grešci/opasnoj radnji. Status uvek ima tekst. Svetla narandžasta nije automatski čitljiv tekst na belom — postojeći `orangeInk` i kontrastni parovi ostaju relevantni.

Ovo su semantičke uloge, ne zabrana novih usklađenih nijansi. Novi token ide u centralni izvor; ekran ne uvodi svoju drugu paletu.

### Ikone: šta bih stvarno promenio

| Namena | Predlog originalnog motiva | Gde se koristi |
|---|---|---|
| Objavi | Topla narandžasta beleška sa olovkom, jednostavna silueta | Početna i prazno stanje mojih zadataka |
| Pronađi | Zeleni radar, čistiji materijal i kontrolisan pokret | Namenska kartica Početne |
| Moje prijave | Plavi papirni avion sa diskretnom dubinom | Pregled prijava i odgovarajuća prazna stanja |
| Dogovor | Dva spojena zaobljena elementa ili originalni znak saradnje | Prazno stanje/uvod; komanda koristi jednostavan simbol |
| Poruke | Dvobojni oblačići u plavo-zelenoj porodici | Prazno stanje; lista koristi avatar i tekst |
| Osoba/tim | Topli koralni i neutralni oblici ljudi | Kapacitet i grupni pregled kada je ilustracija korisna |
| Vreme | Jasan mali kalendar/sat, žuti detalj | Ilustracije; red činjenice koristi mali vektorski znak |
| Remote/predaja | Ekran za digitalno, paket za slanje, mesto susreta za preuzimanje | Razlikuje način izvršenja od predaje |
| Obaveštenja | Jednostavno zvono kao funkcionalna kontrola; bogatiji motiv samo u objašnjenju/praznom stanju | Zaglavlje i lista obaveštenja |
| Lokacija | Čist zeleni pin sa jasnom izabranom siluetom | Kontrola/preview; mapa ne koristi skupu 3D animaciju svakog pina |
| Greška/offline | Neutralna mala ilustracija uz konkretan tekst i retry | Oporavak, bez dramatične dekoracije |

**Art pravac:** sličan ugao, jedan smer svetla, mat/saten materijal, malo detalja, prepoznatljiva silueta. Ne mešati hromirano zvono, ravni radar i plastični avatar kao tri različita sveta.

Prvo napraviti probnu porodicu od nekoliko ključnih ilustracija i oceniti je u stvarnoj veličini u aplikaciji. Tek zatim širiti komplet. Generisane raster ilustracije imaju dovoljno rezolucije i čist providan rub; funkcionalni mali simboli ostaju vektorski. Ovaj izveštaj **ne sadrži novogenerisani komplet niti tvrdi da je ugrađen**.

Logo zadržati kao identitet i proceniti rubove, veličine i animaciju u realnom prikazu. Nema potrebe ponovo ga izmišljati da bi ostatak aplikacije dobio profesionalnu kompoziciju. Nove ilustracije nisu Airbnb asset-i.

### Gde ikona može zameniti tekst

Back, zatvaranje, lupa, prilog, reprodukcija i tastatura mogu biti simboli uz accessibility label. „Objavi“, „Potvrdi završetak“, „Otkaži“, „Tražim ponude“ i razlika privatno/grupa ne postaju nejasne slike bez teksta. Broj nepročitanih i izabrano stanje imaju dodatnu semantiku, ne samo boju.

## 15. Motion koji pomaže radu

Koristiti postojeće centralne kategorije `press`, `feedback`, `content`, `navigation`, `sheet`, `assistant`. Različite komponente dobijaju kontrolisane varijante, ne jednu zaključanu brzinu.

| Događaj | Svrha i izvedba | Reduce Motion / kontrola |
|---|---|---|
| Dodir kontrole | Kratak odgovor dodira, bez odlaganja akcije | Statično odabrano stanje ili minimalan prelaz |
| Kartica → detalj | Zadržati osećaj da je otvoren isti predmet; stabilan native prelaz | Direktan prikaz, isti sadržaj |
| Pin → preview | Jasno povezati odabrani pin i sažetak | Odmah odabrani pin i kartica |
| Sheet peek/half/full | Kontinuitet pod prstom, ispravan odnos liste i mape | Dostupne komande za širenje/skupljanje, razumljiv krajnji položaj |
| Filter primenjen | Vidljiva promena kriterijuma i rezultata bez resetovanja svega | Odmah tačan skup; bez serije dolaznih animacija |
| AI sluša/obrađuje | Razlikovati snimanje, prepisivanje i slanje | Statičan simbol, tekst i trajanje; ne lažni talas zvuka |
| Radar/znak | Kratak izraz identiteta u vidljivoj kartici | Statičan kadar; pauza van ekrana i u pozadini |
| Prijava/izbor potvrđeni | Mirna promena statusa i opciona haptika nakon stvarne potvrde | Isti tekst i naredna radnja bez pokreta |
| Poruka/upload | Stvarni pending, napredak i rezultat | Pristupačan tekst; napredak samo ako ga transport zna |
| Skeleton → sadržaj | Zadržati raspored i sprečiti skok | Direktna zamena bez obaveznog shimmer-a |
| Novi rezultati | Nenametljivo obavestiti, ne preurediti listu tokom čitanja | Tekstualni indikator / svesno osveženje |

Reanimated 4 podržava sistemsko Reduce Motion ponašanje; integracija mora sačuvati i postojeće upravljanje fokusom/AppState, otkazivanjem i promenama pristupačnosti. Sam izbor biblioteke to ne završava. [Zvanična dokumentacija](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/).

**Važna tehnička razlika:** shared-element efekat je dozvoljena dizajnerska mogućnost, ali dokumentacija trenutno označava Reanimated shared transitions kao eksperimentalne i nepreporučene za produkciju. Za prvo izdanje predlažem stabilan native prelaz koji postiže kontinuitet; eksperimentalni API nije uslov premium izgleda. Ovo je konkretna tehnička procena, a ne vraćanje stare estetske zabrane. [Status API-ja](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/).

## 16. Klijent, AI i server — šta treba dovršiti

### 16.1 Može se odmah rekomponovati uz postojeće ugovore

- Prioriteti Početne, naslovi glavnih odredišta, mirnije zvono i avatar.
- Različite porodice kartica na osnovu već dostupnih tačnih činjenica.
- Kompaktniji filteri, statusni redovi, jasniji prazni prikazi.
- Čitljiviji pregled sačuvanog radnog profila i direktan ulaz u isti AI razgovor.
- Dosledno formatiranje novca, vremena i popunjenosti.
- Povezivanje postojećih autoritativnih podataka sa boljom kompozicijom, bez novog business stanja.

„Može klijentski“ ne znači da je bez provere: svaki adapter mora sačuvati prava, revizije i ponašanje kada podaci nedostaju.

### 16.2 Klijentski posao koji je više od stila

| Oblast | Potrebna garancija |
|---|---|
| Navigacija | Tipiziran predmet/ulaz, stabilan Back, bez duplih ruta i praznog povratka |
| Obnova aplikacije | Posle restart-a vratiti legitimni razgovor/nacrt i proveriti sesiju; ne obnoviti tuđ privatni cache |
| Mapa | Query i viewport odvojeni; isti filteri u mapi/listi; povratak bez resetovanja |
| Asinhroni zahtevi | Kasni odgovor ne prepisuje noviji ekran, nalog ili reviziju |
| Poruke | Nacrt po kanalu i nalogu, idempotentno slanje, oporavak nepoznatog ishoda |
| Mediji | Učitavanje, lokalna priprema, upload, vezivanje poruke i reprodukcija kao različita stanja |
| Tastatura/safe area | Input i slanje dostupni na svim proveravanim širinama/fontovima |
| Liste | Stabilni ključevi, razumno učitavanje, očuvana pozicija; bez fiksne visine koja lomi veliki tekst |
| Deep link/push | Sačekati prijavu i autorizaciju, pa otvoriti odgovarajući predmet; ponovljen klik ne umnožava stack |
| Offline | Prikaz keša kao zastarelog, razlikovanje čitanja i bezbedno odložive radnje |
| Pristupačnost | Smislen fokus, naziv, uloga, izbor; poruke greške i status dostupni čitaču ekrana |
| Performanse | Meriti u release APK-u, odvojeno JS/UI rad i mrežno čekanje |

Zvanična RN 0.86 dokumentacija razlikuje JS i native rad i traži proveru performansi u release režimu. To koristimo za izbor merenja; ne prepisujemo svaki primer optimizacije na liste promenljive visine. [React Native 0.86](https://reactnative.dev/docs/0.86/performance).

### 16.3 Zahteva server ugovor ili dodatni povezan dokaz

- Kanonske oblasti rada, višestruke oblasti i provera potrebnih tačaka rute.
- Pouzdano izvođenje dnevnih i višednevnih vremenskih uslova kroz Save i matching.
- Grupne fotografije i glas: potpuna media autorizacija, članstvo, istorija i prestanak pristupa.
- Jedan korisnički prikaz grupnog Dogovora uz pravilne pojedinačne iznose, kapacitete i završetke.
- Atomska ponovna objava pre prvog izbora, istorija i obaveštenja svim pogođenim kandidatima.
- Preciziranje fleksibilnog termina uz potvrdu onih na koje utiče.
- Otkaz, dopuštena potraga za zamenom i deduplikovana obaveštenja.
- Potpuni reputacioni/aktivnosni agregati gde ih UI traži.
- Pouzdani specifični push ciljevi, više događaja i foreground/background/cold start.

Neke osnove već postoje. Ova lista označava ono što nije dovoljno zatvoreno za obećanje celog ponašanja, a ne da sve treba pisati od nule.

### 16.4 Kako ubrzati oba AI razgovora bez gubitka kontrole

**Prvo meriti:** vreme do prvog korisnog odgovora, do završetka poruke, do spremnog pregleda i do Save-a; broj modelski poziva, ulaz/izlaz tokeni, katalog, validacija i geokodiranje. Posebno hladan početak, kratak nastavak, promena usluge i nova kategorija.

**Brz put:** razgovor koristi najnovije činjenice i relevantni kontekst. Ne prepričava celu taksonomiju ili sva pravila svakom upitu. Kratka promena budžeta ne pokreće ponovno istraživanje stabla ako usluga nije promenjena.

**Pozadinski put:** semantička klasifikacija može raditi odvojeno kada ne menja sledeće neophodno pitanje. Ima trajni posao, verziju nacrta i katalog reviziju; rezultat starije poruke ne sme prepisati novu nameru. Bez pouzdanog izvršavanja ne prebacivati posao samo u nezaštićen „fire-and-forget“.

**Granica:** UI može nastaviti razgovor dok se proverava usluga, ali ne obećava „Spremno za objavu“ ako obavezni rezultat još nije validan. Objavi/Sačuvaj proverava istu reviziju koju je korisnik pregledao.

**Širenje kataloga:** čitanje i predlaganje tokom razgovora; kanonsko vezivanje i dopuštena promena stabla u kontrolisanoj potvrđenoj fazi. Predlog nikada ne aktivira radnika, zadatak, matching ili push.

**Prompt:** topao kratak srpski, povremeni smisleni smajlić, pamćenje korekcije, pitati bitno. Tehničke zabrane koje server potpuno sprovodi ne moraju biti ponovljene pet puta u instrukciji. Zadržati semantička pravila potrebna modelu da ne izmišlja.

**Dokaz uspeha:** isti scenariji pre/posle, distribucija trajanja i stvarni trošak; tačnost i broj potrebnih korekcija uz brzinu. Ne obećavati „delić sekunde“ za ceo višekoračni razgovor. Streaming može učiniti početak odgovora ranije vidljivim, ali sam ne skraćuje ukupan posao.

## 17. Gotove komponente, smernice i alati

Ne treba novi veliki UI paket koji bi doneo još jedan dizajn. Najveću korist sada daju već uvedeni mehanizmi sa našom kompozicijom.

| Smernica/alат | Stvarni izvor | Korist / odluka | Ograničenje |
|---|---|---|---|
| `uskoci-design` | `C:/Users/user/.codex/skills/uskoci-design/SKILL.md` | Pročitano u ovom radu; kontekst proizvoda, postojeći canon i stvarni ekrani | Vlasnikov noviji smer ima prednost nad istorijskim estetskim detaljem |
| `mobile-app-ui-design` | `C:/Users/user/.agents/skills/mobile-app-ui-design/SKILL.md` | Pročitano; hijerarhija, prikazi i korisnički tok | Web primer nije neposredno RN kod; nema novog dimenzionog freeze-a |
| Android navigation | Zvanična dokumentacija povezana u §10 | Poznata glavna odredišta i manje sekundarne kontrole | Ne kopirati vizuelni identitet Android demonstracije |
| Gorhom bottom sheet | `@gorhom/bottom-sheet` već u projektu; [v5 dokumentacija](https://gorhom.dev/react-native-bottom-sheet/) | Zadržati sheet, gestove, keyboard integraciju; menjati sadržaj i kompoziciju | Pregledna stranica nije sertifikat kompatibilnosti svake kombinacije zavisnosti |
| MapLibre | Već korišćen renderer u Discovery | Sačuvati mapu, doterati kontrole, pin i preview | Gustina, klasteri i javna geografija traže stvaran dokaz |
| Glyph / Phosphor | `src/ui/system/Glyph.tsx`, postojeća zavisnost | Jedna porodica funkcionalnih simbola; već upotrebljena u novoj navigaciji | Ne pretvarati svaki simbol u novu sliku |
| Reanimated / native motion | Postojeće zavisnosti; zvanični izvori u §15 | Lifecycle, Reduce Motion, sheet i statusni prelazi | Eksperimentalni shared transitions nisu default za release |
| RN 0.86 performance | Zvanična verzionisana dokumentacija u §16 | Meriti pravi runtime i uzrok sporosti | Novi list engine samo uz konkretno dokazano usko grlo |
| Generisanje ilustracija | Dostupan image-generation alat | Originalna 2.5D porodica posle definisanja uloge i probe u komponenti | U ovom paketu slike nisu generisane; ne preuzimati tuđe brand asset-e |
| Postojeći chat transport | Privatni/grupni moduli i Supabase ugovori projekta | Sačuvati autoritet, message ID i membership | Gotov chat UI ne rešava naše prava, istoriju ili individualne Dogovore |

Gorhom dokumentacija opisuje snapping, list/scroll integraciju i keyboard podršku, pa je razumno krenuti od postojećeg mehanizma umesto uvođenja drugog. Njena uvodna stranica navodi starije Reanimated kompatibilnosti; stvarna instalirana kombinacija mora proći naše native provere, ne pretpostavku sa naslovne strane.

Nije instaliran novi skill, plugin ili dependency. Za ovaj korak nisu potrebni Figma nalog, promena map engine-a ni migracija na gotovu chat platformu. Dodatni alat se uvodi kada rešava konkretan nedostatak; dobar alat sam ne određuje korisnički tok.

## 18. Inventar ekrana i pomoćnih površina

Klasifikacija predstavlja **preporučeni obim promene**, ne automatski dokaz kvara: A zadržati, B polish, C unaprediti, D ozbiljno prekomponovati, E spojiti/pojednostaviti. Za deo sekundarnih ekrana preporuka je iz koda i ugovora; kompletan svež fizički pregled svih njihovih stanja još nije završen.

| Celina / postojeći ulaz | Klasa | Cilj i primarna radnja | Sledeći ekran / kontekst |
|---|---|---|---|
| Početna `index` | D | Obaveza + dve namere, bez velikih ravnopravnih panela | AI, Zadaci ili konkretna obaveza |
| Globalna navigacija | B | Nova svetla osnova; dovršiti doslednost na mapi | Sačuvan root svakog taba |
| Zadaci `zadaci` / Discovery | C | Jedna pretraga, mapa/lista, manji chrome | Preview → detalj |
| Filteri / pretraga | C | Jedan sheet, jasan Apply/reset | Isti viewport/query kontekst |
| Map preview / pin | C | Isti izabrani predmet, jasan kratki pregled | Detalj, pa isti pin |
| Tuđ detalj `prilike/[id]` | C | Naslov, ključne činjenice, opis, primarna prijava | Prijava / javni profil |
| Moj detalj `potrebe/[id]/pregled` | C | Stanje objave, prijave, kapacitet i sledeća radnja | Kandidati / Dogovor / AI |
| Moji zadaci `potrebe` | C | Operativne kartice prema vlasniku | Moj detalj |
| Moje prijave `moje-prijave` | C | Moja ponuda i stvaran ishod | Prijava / Dogovor |
| Slanje prijave `prilike/[id]/prijava` | C | Kratka razumljiva ponuda, potvrđen ishod | Pregled poslate prijave |
| Kandidati `potrebe/[id]/kandidati` | C | Osoba + ponuda + obuhvat, bez suvišnih koraka | Izbor → Dogovor |
| AI zadatak `nova` | C | Prirodan razgovor, sažetak i dobar composer | Jedan pregled |
| Review `pregled-nacrta`, povezani pregledi | E | Jedan korisnički review, zajedničke činjenice | Objavljeno / isti razgovor |
| Potvrda mesta `mesto-zadatka` | C | Jasan predmet potvrde, pin i privatnost | Isti AI nacrt/review |
| Ruta / više tačaka | C | Razumljiv sled i potvrda tačaka | Isti razgovor, bez gubitka redosleda |
| Fotografije zadatka | B | Dodavanje/pregled/greška i očuvanje nacrta | Prethodni predmet |
| Lista Dogovora `dogovori` | D | Obaveze pre velikih filtera | Tačan Dogovor |
| Dogovor `dogovor/[id]` | D | Uslovi, sledeća radnja, učesnici, istorija | Čet / završetak / otkaz |
| Predlog termina/izmene | E | Samo dopuštena kratka odluka, bez drugog editora | Isti Dogovor i nova verzija ako potvrđeno |
| Poruke `poruke` | D | Pravi naslov, kanali i smisleno prazno stanje | Tačan privatni/grupni kanal |
| Privatni razgovor | C | Stabilan composer, kontekst i slanje | Dogovor / profil / medij |
| Grupa `dogovor/[id]/grupa` | C | Učesnici, fotografije/glas, članstvo | Isti predmet; privatno samo dozvoljeno |
| Pregled medija / snimanje | C | Fokusirana radnja, vidljiv upload/reprodukcija | Isti kanal i nacrt |
| Moj profil `profil` | D | Identitet, reputacija i radni sažetak | Javni pregled / radni razgovor / podešavanja |
| Javni profil | C | Samo potrebne javne činjenice i recenzije | Nazad na kandidata/zadatak |
| Radni profil `profil/radnik` | C | Čitljiv sačuvani rezultat i jedan AI ulaz | Isti razgovor |
| Radni AI `profil/razgovor` | C | Usluge, oblast, vreme; isti razgovorni sistem | Jedan profil review |
| Stari radni podeditori | E | Proveriti stvarne pozive i preusmeriti u odgovarajući AI kontekst | Nema paralelnog ručnog poslovnog unosa |
| Raspored `raspored` | B/C | Stvarni termini, pregled obaveza | Dogovor; dostupnost kroz AI |
| Recenzije / `oceni-dogovor` | B | Jasan dozvoljen predmet, ocena i komentar | Potvrđen završeni Dogovor |
| Obaveštenja `obavestenja` | C | Događaj → konkretna radnja | Autorizovan predmet |
| Podešavanja / privatnost | C | Grupe prema korisničkom jeziku | Namenski nalog/permission tok |
| Identitet, fotografija, lozinka | B | Direktne privatne kontrole i oporavak | Moj profil |
| Podrška / prijava problema | B | Kontekst predmeta i praćenje stvarnog zahteva | Isti predmet / lista zahteva |
| Auth / oporavak / welcome | B/C | Jasan ulaz i povratak posle prijave | Sačuvani legitimni cilj |
| O aplikaciji | A/B | Tačan build i privatnost tehničkih detalja | Povratak bez gubitka konteksta |

Ne brisati `profil/dostupnost` ili `profil/lokacija` samo zbog imena. Najpre proveriti da li su editor, prikaz, potvrda mape ili adapter. Samo stvarni paralelni poslovni editor treba povući; legitimna geografska potvrda ostaje.

### Zajedničko za svaki red

- **Loading:** okvir očekivanog sadržaja; nema broja 0 umesto nedostupnog podatka.
- **Empty:** objašnjenje prve upotrebe ili praznog filtera, sa odgovarajućom radnjom.
- **Error:** lokalni retry gde je moguće; ostatak ekrana ostaje upotrebljiv.
- **Offline:** poslednji poznati sadržaj sa označenom svežinom; odluka koja traži server ne glumi uspeh.
- **Unknown write:** proveriti ishod istog zahteva, bez dupliranja objave, izbora ili poruke.
- **Veliki tekst:** prelamanje, dovoljno dodirno polje, razumna promena slaganja i scroll.
- **Back:** povratak na isti upit, karticu, razgovor ili nacrt; ne sistematski na Početnu.
- **Fokus i tastatura:** jasan red čitanja, bez input-a iza sticky CTA, bez gubitka neposlatog.
- **Privatnost:** dozvola se proverava i u podacima/akciji; sakriveno dugme nije zaštita.
- **Motion:** razumljiv statični ekvivalent, lifecycle i odsustvo ponavljanja na svakom refresh-u.

## 19. Kako se posao vodi i isporučuje

### Jedna povezana jedinica rada

Za svaku celinu isti redosled:

**svrha korisnika → postojeće činjenice/akcije → skica kompozicije → pozitivna i negativna stanja → klijent/server izmene → stvaran tok → slike → uklanjanje zamenjenog sloja.**

Uloge stručnog tima koristimo kao kontrolne perspektive: product ograničava opseg; UX proverava radnju i povratak; visual definiše hijerarhiju; client čuva stanje; backend potvrđuje ugovor; privacy proverava vidljivost; QA i performance traže dokaz. To nije tvrdnja da su ovaj dokument ili aplikaciju nezavisno odobrili zaposleni stručnjaci ili više agenata.

### Konkretan naredni redosled

Postojeći devetotalasni plan ostaje autoritet obuhvata. Sledeće su isporučive celine unutar njega, ne nova konkurentska lista statusa.

1. **Dovršiti globalnu doslednost i ključne skice u native komponentama.** Svetla navigacija je dokazano napravljena. Slede zaglavlje, zvono/avatar, home prioritet, kartica izvršioca/vlasnika i odnos mape prema navigaciji. Proveriti jedan stvaran zadatak u novoj kompoziciji pre širenja na sve liste.
2. **Zatvoriti AI → pregled → objava kao povezanu celinu.** Meriti oba razgovora, pojednostaviti duplirana pravila, rešiti kritični put, mikrofon i tačan prikaz lokacije. Uporedo primeniti dogovorenu kompoziciju. Nema proglašenja brzine na osnovu lepog loadera.
3. **Zatvoriti oblast → matching → prijava → izbor.** Dovršiti obuhvate i vremenske uslove, role-specific detalje i kandidate. Isti potvrđen podatak mora stići u matching i korisničku karticu. Dva naloga proveravaju stvaran rezultat.
4. **Zatvoriti Dogovor → razgovor → završetak.** Nova kompozicija Dogovora i Poruka, individualni/grupni kanali, fotografija/glas, članstvo, otkaz i istorija. Jasno odvojiti nedovršene serverske delove.
5. **Profil, recenzije i završni tokovi.** Jedan kvalitetan profil, tačne metrike, obaveštenja/deep link, podešavanja, privacy i podrška. Bez portfolija i novih sporednih funkcija koje odlažu prvu probu.
6. **Kontrolisana Android proba.** Tačan build, novi nalog, kompletan posao, više ljudi, loša mreža i stvarni push. Zatim uslovi operatera i distribucije. Javna objava nije automatska posledica zelenog CI-ja.

Ovo ne znači da izgled ponovo ostaje za kraj. Svaki funkcionalni paket odmah nosi ciljanu kompoziciju svojih ekrana. Prvi mali set iz tačke 1 određuje izgled narednih porodica.

### Šta ćemo svesno odložiti

Portfolio i značke; društveno povezivanje izvršilaca; online/presence sistem; opšti pregovarački editor svih uslova; novčanik/plaćanje; eksperimentalne animacije kao uslov izdanja; gostujući AI i iOS za prvu Android probu. To su odluke o isporučivom obuhvatu, ne trajne zabrane budućeg razvoja.

## 20. Čišćenje i dokaz kvaliteta

### Kako čistimo bez ponovnog nagomilavanja

Za svaku zamenjenu porodicu zabeležiti: stari owner, novi owner, ko je poziva, funkcionalni paritet i migrirane testove. Prevezati rute, galerije, deep link i native entry; zatim ukloniti stvarno nepozvan kod i dupli stil. Ne ostavljati trajni „novi v3“ uz stari isti tok.

Stare estetske assertions menjati pojedinačno: npr. tačna zelena pozadina navigacije → čitljiv kontrast i prepoznat izbor; tačan red dekorativnih pločica → prisustvo potrebnih činjenica i ispravna akcija; jedna motion vrednost → Reduce Motion, cancel i stabilan završetak. Test koji u istom fajlu štiti privatnost ili očuvanje nacrta ostaje.

Komentari sa datumom stare vizuelne odluke nisu novi aktivni autoritet. `colorTokens` i dalje ima takve istorijske komentare; treba ih usaglašavati pri zahvatanju porodice. To nije dokaz da su sve stare zabrane već fizički uklonjene. Centralni token sistem, Surface i motion ostaju jedni.

### Scenariji koji moraju stvarno proći

| Scenario | Šta dokazuje |
|---|---|
| Jednostavan terenski zadatak, dva naloga | Razgovor, mapa, pregled, objava, prijava, izbor, Dogovor, poruka, završetak i recenzija |
| Remote fizički predmet, slanje i lokalno preuzimanje | Režim i predaja; matching bez lažnog zahteva odlaska kod naručioca |
| Promena budžeta, broja ljudi, usluge i načina rada | Isti nacrt, pravilne zavisne promene i očuvane nepovezane činjenice |
| Nova i postojeća usluga | Tačan canonical UUID, Save granica, ponovno korišćenje i deduplikacija |
| Grad/radius, region, više oblasti, ruta | Isti model kroz AI, Save, prikaz, matching i dispatch |
| Više izvršilaca i privatni/grupni kanali | Kapacitet, pojedinačni iznosi, dozvole i jasno razlikovanje primalaca |
| Slika i glas, ulazak i izlazak iz grupe | Pristup istoriji/medijima pre i posle granice članstva |
| Ponovna objava pre prvog izbora i konkurentan izbor | Atomski ishod, istorija, zatvaranje prijava i prava granica izmene |
| Otkaz jednog člana i otkaz celog zadatka | Ispravna zamena i zabrana ponovnog otvaranja završenog/otkazanog predmeta |
| Mreža pukne posle Save/Send/Select | Bez duplih upisa i lažnog uspeha; vidljiv oporavak |
| App background/restart, veliki font, Back | Očuvan kontekst, nema skrivenih komandi ili privatnog cache curenja |
| Stvarni push u zatvorenu i otvorenu aplikaciju | Isporuka, klik, autorizovan cilj i pravilno nepročitano stanje |

Reprezentativna vizuelna matrica: 361/390/412 dp, normalan i veliki font, loading/empty/error/offline, relevantne obe uloge i grupni slučaj. Aktuelna aplikacija je light-only. Ne pišemo dark PASS bez implementiranog dark sistema.

Meriti vreme do korisne radnje, broj nepotrebnih koraka, očuvanje konteksta, scroll/gesture odziv i AI trošak. „Lepše“ oceniti na istom sadržaju pre i posle; ne porediti praznu novu maketu sa starim punim ekranom i tvrditi dobitak.

### Trenutna granica

Najnoviji emulator dokaz potvrđuje svetlu navigaciju, šest Home layout uzoraka i dodire glavnih odredišta. Postoji napravljen i instaliran APK, sa zelenom punom regresijom. **Ovaj novi dokument ne potvrđuje da su gore opisani ekrani već implementirani.**

Otvoreni su AI brzina/trošak, regionalni model, celoviti grupni mediji/članstvo, objedinjeni put dva naloga i završni release zahtevi. Raniji povremeni prazan native detalj i problem povratka posle konfiguracionih promena ostaju otvoreni. Supabase stanje u §2 je prethodno zabeležen dokaz; pri pisanju ove dopune nije obavljena nova puna serverska revizija.

**Sledeći konkretan rezultat treba da bude mali povezani native skup: Početna → Zadaci/filter → detalj iste objave, sa karticom za obe perspektive, novom hijerarhijom i sačuvanim ponašanjem.** Time se smer vidi na pravom sadržaju. Istovremeno se AI kritični put zatvara kao zasebna tehnička celina u istom postojećem planu. Nakon toga isti jezik se prenosi u prijavu, Dogovor i čet.

Posao je završen tek kada taj jezik i ponašanje prođu ceo dozvoljeni korisnički put, odgovarajući build i stvarne uređajske provere. Broj testova, broj nacrtanih ikonica i broj novih dokumenata nisu zamena za taj rezultat.
