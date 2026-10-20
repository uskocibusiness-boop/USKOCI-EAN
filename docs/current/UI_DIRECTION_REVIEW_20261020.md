# USKOČI — jasan izgled i povezano završavanje

20.10.2026. Odgovor na vlasnikovu ispravku svetle donje navigacije. Ovo je čitljiv pregled postojećeg plana i konkretan predlog kompozicije. **Autoritet ostaje Premium White canon; status i dalje živi u registru 62 toka.** Predlog ekrana nije dokaz njegove implementacije.

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
