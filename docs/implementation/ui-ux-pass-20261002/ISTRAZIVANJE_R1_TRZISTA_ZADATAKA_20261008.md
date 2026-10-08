# R1 — Tržišta zadataka i usluga: šta rade najbolji i šta od toga uzimamo (8. 10. 2026)

Istraživanje bez izmena koda i bez commit-a (istraživač, model Sonnet 5.5). Cilj: da „bezbedno generički" izgled pređe u premium, čist, jasan i kreativan. Ništa se ne kopira 1:1: uzima se IDEJA, prilagođava se i kombinuje (vlasnik, 8. 10.: od Airbnb-a i svetskih aplikacija samo izgled, lepota i jasnoća, nikad funkcije, sadržaj ili slike).

**Legenda.** [V] = video sam sliku ekrana u ovoj sesiji (App Store snimci preko iTunes API-ja, zvanični sajtovi). [O] = nisam video, iz opisa/izvora. „≈" = procena sa slike (460 px ≈ ekran 390 pt, ±10–15 %), nije merenje koda. Sve viđeno je izlog (marketinški snimci, idealizovani; Airtasker ≈ nov. 2024), ne stvarna upotreba; pokret nisam mogao da ocenim. Skraćenice: AT Airtasker, TR TaskRabbit, TT Thumbtack, UC Urban Company, USK = USKOČI. Tabela „naš ekran → reference → ideja" je na kraju (§9); 29 rešenja (R-01…R-29).

**Zaključano i sužava ideje:** nijedna kategorija se ne prikazuje ljudima (PKG-031); bela površina, crn tekst; jedna zelena radnja po ekranu, narandžasta samo akcenat; „zadatak" (nikad „posao"), „ti" bez roda; bez izmišljenih podataka (cena koje nema ne liči na iznos); nema nove zavisnosti ni fonta bez odobrenja (bundlovan je samo Inter); Početna zadržava dva velika ulaza i V4.9 potpis; nova plaćena AI upotreba traži posebno dopuštenje; 2.5D nalepnice (28 dp na karticama) i maskota su naš potpis.

## 1. Naša slika stanja (lab snimci f1–f6 „posle", 8. 10.)
- **Dobro:** red (ivica 20, razmaci 4–48, jedna zelena radnja, bele površine, inset linije), 2.5D nalepnice u redovima Početne i u „Spremno za pregled", maskota robot u razgovoru, jasna stanja (Čeka tvoju potvrdu, Bira se · 3, 4 koraka Dogovora).
- **Generički:** (1) nema „heroja": najveći objekat na kartici zadatka je tekst 18/24, a ikone na kartici su ravni zeleni znaci (snimci su možda stariji od pravila „2.5D 28 dp"); (2) lica su inicijali na sivom krugu, ništa ne gradi poverenje; (3) zadatak, Dogovor, prijava i termin imaju isti oblik kartice, pa nema ritma ni važnosti; (4) Početna: dva skoro ista siva ulaza, „Čeka te" liči na podešavanja; (5) Kandidati: čip „Poslata" na svakom, a „Uporedi" je vertikalni niz blokova, ne poređenje; (6) Detalj, Prijava, Ocena su formular bez vrhunca (nema trenutka „Dogovoreno!"/„Objavljeno!"); (7) razgovor bez konteksta zadatka; (8) prazna stanja: mala sličica 64 poravnata levo umesto centrirane scene 96; (9) kartica zadatka ≈ 215 dp (cilj ≤ 200).

## 2. Deset najvažnijih saznanja
1. **Premium = manje kutija, jači naslov.** AT ekran zadatka nema nijednu karticu: naslov ≈ 32 pt kondenzovan, tri reda sa linijskom ikonom 18 pt, siva ispuna umesto okvira; kartica postoji samo za ponudu. Mi smo već na redu (Screen/Section/ListRow); sledi jača tipografija i manje okvira.
2. **Svi smanjuju izbor:** jedno pitanje po ekranu + jedno dugme (AT, Bark, MyHammer); grupe sa razlogom (TT); „top 5" (Bark); „Sorted by" (TR).
3. **Dokaz „sličnog" pobeđuje zvezdice:** „50 TV mounting tasks" (TR), „88 similar jobs near you" (TT), „98 % completion rate" (AT).
4. **Cena je najveći broj u redu i uvek desno** (AT „$160", TR „$65/hr", UC).
5. **3D/2.5D je sada glavni tok:** Airbnb 2025 (tab-traka, opcije, linija putovanja) i UC (mreža usluga) → naš potpis je trend, ne rizik; lica ostaju fotografije (TR, TT, Fiverr, Košnica).
6. **Ličnost je odvojen sloj:** AT stavlja ilustrovane likove preko fotografija samo u brend trenucima, UI ostaje miran. Njihovo istraživanje: konkurenti „izgledali isto, čak i boje i semiotika" (Qualtrics) — generičko je rizik broj jedan.
7. **Razgovor pripada predmetu:** traka sa zadatkom/cenom/stanjem, sistemske poruke, napomena o bezbednosti baš u tom trenutku (AT, TR, Airbnb, Fiverr).
8. **Posle izbora sledi „šta sad":** TT „You're booked. Now what?", Airbnb Trips; stanje = jedan korak + jedna sledeća radnja.
9. **Značke se zarađuju po javnom pravilu** (Airbnb „Guest favorite", TT „Top Pro") — suprotno je plaćeno isticanje (Fix4You).
10. **Smirenje na mestu odluke, ne na stranici pravila:** rečenica pored dugmeta (TR), oznaka „PAYMENT SECURE" (AT), traka garancije (Angi). Region (Znam Majstora, Košnica, Fix4You) je imenik/oglasi bez toka objava → ponude → Dogovor → ocena: prostor je naš, ali samo ako je izgled na Airbnb nivou.

**Recept:** Airbnb ljuska (bela, jedan objekat-heroj po zapisu, mala siva meta, zaobljenost 16–24) + Airtasker tok (jedno pitanje, jedno dugme) + TT/TR dokaz („slično, blizu tebe") + naš 2.5D potpis i maskota u trenucima.

## 3. Airtasker
**Šta ga čini „premium i čistim" (10 osobina; snimci [V], izvori):**
1. Jedna boja radnje: živo plava (≈ #0B63F6) na beloj i svetlo lavandasto-sivoj; tamno plava umesto crne za tekst; narandžasta samo zvezde; limeta samo promo traka.
2. Hijerarhija tipom: naslovi ≈ 32–36 pt, kondenzovani, teški (PP Formula, Design Week), telo 15–16 pt neutralno; nema trećeg fonta.
3. Ekran zadatka bez kartica: red = linijska ikona 18 pt + tekst 16 pt (mesto, datum, budžet sa sitnim „Budget"), bez linija.
4. Polja i blokovi su siva ispuna (≈ #F3F3F7), bez okvira, radijus ≈ 8–12; i „dostupnost" i „poruka" u ponudi su isti sivi blokovi.
5. Jedno veliko dugme: pun širine, pilula ≈ 50 pt, na dnu; sekundarno = svetla podloga.
6. Tok bez šuma: strelica nazad + tanka traka napretka (≈ 100×4 pt); pomoć desno ispod polja.
7. Ponuda je fiksni šablon: lice 48 · ime + plavi štit · ★ 4,8 (18) · „98 % completion rate ⓘ" · cena desno 18/700 · dostupnost · poruka.
8. Segment sa brojem u oznaci („Offers 4"), aktivni = puna tamna pilula.
9. Razgovor: traka konteksta (zadatak, osoba, cena, stanje) + 2 brze radnje + miran blok napomene (narandžasti štit); mehurovi beli/tamni, vreme ispod.
10. „Ownable" sloj samo u brend trenucima: ilustrovani likovi preko stvarnih fotografija, sjaj zvezdica, animiran logo (rebrend Studio Koto, jan. 2023; 6 meseci planiranja, 6 nedelja izvedbe; narandžasta „nije rezonirala", plava jeste).

**Šta je kod njih slabo (da ne ponovimo):**
- „Accept" je dugme direktno u kartici ponude [V]: brz ali impulsivan izbor; poređenje ponuda nisam video [O]. Mi imamo „Uporedi", ali mora biti pravo poređenje.
- Tri jednako jaka dugmeta u razgovoru/zadatku (Accept, Release payment, View task): nema jedne glavne radnje (mi: jedna zelena).
- Kondenzovani VELIKI naslovi pod uglom na sajtu: teže se čitaju; za Č Ć Š Ž Đ treba proveriti glifove. Mi: Inter 700–800.
- Korisnici (ProductReview, Trustpilot) [O]: „dvostruko naplaćivanje" (provizija i poručiocu i izvođaču; članstvo „$0 Connection Fees"), cena se menja posle dodele, krediti umesto povrata pri otkazivanju u poslednji čas, slaba pomoć posle incidenta. Mi: jasno ko plaća šta kad dođu plaćanja; bez izmene cene mimo novog Dogovora.
- Marketinški ton u proizvodu (hero, sjaj): u aplikaciji ličnost samo u trenucima (R-03).

## 4. Rešenja
Format: Radi → Zašto → Ideja → USKOČI (ekran, komponenta, nalepnica, kartica ili ne, pokret, kombinacija) → Rizik. Nazivi komponenti su iz `src/ui/system` (Screen, Section, ListRow, FactRow, KeyValueRow, Surface, FlowFooter, StatusChip, Segmented, PickerTile, ProductSheet, StateView, FactArt).

### Početna i prvi susret
**R-01 · Airbnb (2025) — pilula pretrage i tri taba sa 3D ikonama [V; sistem: Domus/PhocusWire, O]**
- **Radi:** bela pilula „Start your search" ≈ 58 pt, pun radijus, jedna meka senka; ispod tri taba sa 3D ikonom ≈ 42 pt (kuća, balon, zvonce) i nazivom 14 pt; aktivni ima kratku crnu crtu, novi nose tamnu značku „NEW"; zatim redovi sa fotografijama radijusa ≈ 16 i dvolinijskim potpisom (naziv + siva meta).
- **Zašto:** jedan objekat-heroj po zoni, malo teksta; predmet je i navigacija i značenje (prepoznavanje umesto čitanja).
- **Ideja:** materijalna ikona vodi pogled, ostalo miruje.
- **USKOČI:** `TabBarItem`: aktivni tab dobija 2.5D nalepnicu 28 dp (`home`, `map`, `agreements`) sa „pop" 1,0→1,08 (spring ≈ 180 ms; bez pokreta uz Reduce Motion), neaktivni ostaju sivi linijski; pilula nad mapom Zadataka u dva reda („Novi Sad · 41 zadatak" / „Za mene · Bilo kada") + ikona filtera desno umesto „···" (`Surface float`, bez kartica). Kombinuj: Airbnb ljuska + naš sticker.
- **Rizik:** traka uvek mora da kaže gde si (3.6.2), zato samo aktivni u 2.5D; dva velika ulaza Početne i V4.9 se ne diraju.

**R-02 · Urban Company — mreža 3D pločica na sivoj podlozi + traka lične koristi [V]**
- **Radi:** polje „Search for 'AC service'" (okvir 1 pt, radijus ≈ 8); mreža 3×2, pločica ≈ 108×71 pt, svetlo siva, radijus ≈ 8, 3D render predmeta (usisivač, bušilica, kanta boje) + oznaka 13 pt u dva reda ispod; iznad mreže ljubičasta traka sa perforiranom ivicom („uštedeo si ₹830"); ispod baner „New · Home solutions store".
- **Zašto:** predmet = značenje bez čitanja; ujednačen format daje ritam; traka daje ličnu vrednost odmah.
- **Ideja:** 3D predmeti na neutralnom sivom kao glavni jezik ulaza (aplikacija sa 1,2 M ocena koristi isti princip kao naš sticker).
- **USKOČI:** „Kako radi" (prazna Početna): tri pločice ≈ 104×104 sa `task-launch`, `agreements`, `star`; u AI razgovoru „Na primer": 6 pločica-rečenica („Selim se", „Sklapam nameštaj", „Krečim sobu") sa `vehicle`/`tool`/`work-kit`, tap ubacuje rečenicu; traka lične koristi „Ove nedelje: 2 Dogovora" iz postojeće rečenice u Rasporedu. Pločica = `Surface panel` bez senke (ne kartica). Kombinuj: Airbnb tipografija ispod.
- **Rizik:** pločice su primeri rečenica, NE kategorije (PKG-031); najviše 6; dva ulaza Početne ostaju.

**R-03 · Airtasker — ilustrovani likovi preko fotografije (brend sloj) [V + Koto/Design Week, O]**
- **Radi:** plavi likovi (kofer sa alatom, ključ sa krilima) „rade" ono što fotografija prikazuje; ogroman beli kondenzovani naslov na plavoj ploči (radijus ≈ 20–24); animiran logo koji maše; sve ilustracije u jednoj plavoj. Cilj (Design Week): ilustracija ističe zadatak koji se obavlja i čini fotografiju „ownable".
- **Zašto:** prepoznatljivost bez dodavanja UI elemenata; lik objašnjava radnju.
- **Ideja:** ličnost kao odvojen sloj, rezervisan za trenutke.
- **USKOČI:** 2.5D nalepnica statusa preko ugla fotografije zadatka (sličica 72 dp iz R-10): `agreements` kad je Dogovoreno, `star` kad čeka ocenu; maskota/lanac „uskoči" jednom pri prvom prikazu (`LottieArt`: samo likovi i trenuci, 1× po prikazu). 3D logotip ostaje samo na ulazu i Početnoj. Kombinuj: Airbnb bela pilula-labela na fotografiji (R-10) nosi tu nalepnicu.
- **Rizik:** nikad preko lica i privatnih detalja; nalepnica ne sme da tvrdi stanje zadatka bez podatka (kvačicu smeju samo `check`/`agreements`/`shield`); fotografije korisnika traže moderaciju (odluka vlasnika).

**R-04 · Thumbtack — „Your plan" i „Your team" [V]**
- **Radi:** projekti grupisani po fazi („Booked", „Planned") u karticama: sličica, naziv, status sa tačkom („Booked for April 2…", „In progress · Sun, April 7"), jedna plava veza; „Your team": sačuvani majstori — lice sa zelenom tačkom, ★ (broj), „Hired for lawn care", traka „Next booking…", tri radnje u redu (Book · Message · More).
- **Zašto:** „moje" grupisano po fazi, ne po vrsti; ponovno angažovanje u jednom dodiru.
- **Ideja:** lični pregled po fazi + „moji ljudi".
- **USKOČI:** Moji zadaci: odeljci „Čeka tvoj izbor · Dogovoreno · Završeno" (`Section` + brojač), red = `OwnTaskCard` bez dodatnih veza; „Ponovo pozovi" (osoba sa kojom si završio; lice 40 + 2 radnje) → izvan V1. Kombinuj: Airbnb „Trips" zaglavlje (R-20).
- **Rizik:** V1 nema omiljene/ponovni poziv; „online" tačka traži odluku o privatnosti i server.

**R-05 · Airtasker — prvi susret: tri koraka, pravi završeni zadaci kao dokaz, trojka zaštite [V hero i traka članstva; ostalo iz teksta sajta, O]**
- **Radi:** hero = tamno plava ploča (radijus ≈ 20–24) sa ogromnim naslovom i likovima; ispod dva dugmeta jedno ispod drugog (puno plavo „Post your task for free" i svetlo „Earn money as a Tasker"); „Post your first task in seconds" sa tri koraka (opiši šta treba · odredi budžet · primi ponude i izaberi); pločice sa nazivom + jednom rečenicom; traka „See what others are getting done" sa karticama stvarno završenih zadataka (naslov, cena, 5 zvezdica); trojka zaštite (sigurna uplata · prave ocene · osiguranje); priče izvođača (R-25); limeta traka članstva.
- **Zašto:** tri koraka skidaju strah od nepoznatog procesa; stvarni zadaci sa cenama dokazuju da tržište radi i daju okvir za cenu; trojka zaštite odgovara na tri najčešća straha.
- **Ideja:** proces u tri koraka + „šta su drugi već dogovorili" + tri zaštite.
- **USKOČI:** prazna Početna: „Kako radi" (već 3 stavke) postaje 3 pločice sa nalepnicama (R-02) i po jednom rečenicom; traka „Nedavno dogovoreno u Novom Sadu" (3 anonimne stavke: naslov, ukupno, ★) SAMO ako ima stvarnih završenih i uz pravilo privatnosti; „Tri zaštite" kao jedan `Surface note` u „O aplikaciji"/profilu: `shield` „Identitet potvrđen", `check` „Ocene tek posle završenog zadatka", `lock` „Adresa se deli tek kad budete spremni". Dva velika ulaza ostaju (AT takođe ima dva dugmeta, jedno jače). Kombinuj: Airbnb tipografija i mirna siva meta ispod pločica.
- **Rizik:** javni prikaz završenih zadataka je pitanje privatnosti i pravila (odluka vlasnika); bez izmišljenih primera; „osiguranje" nemamo — ne tvrditi; pločice-rečenice, ne kategorije.

### Objava zadatka
**R-06 · Airtasker — jedno pitanje po ekranu [V]**
- **Radi:** strelica nazad + tanka traka napretka (≈ 100×4 pt); naslov „Start with a title" ≈ 32–36 pt kondenzovan; podnaslov 15 pt siv; polje bez okvira, siva ispuna, radijus ≈ 12, visina ≈ 56; pomoć desno ispod („Minimum 10 characters"); pun „Continue" (pilula ≈ 50 pt) ostaje iznad tastature.
- **Zašto:** jedan izbor (Hick), jasna svrha ekrana, napredak se oseća bez teksta „korak 2 od 7".
- **Ideja:** svaki korak = jedan jasan zahtev + jedno dugme.
- **USKOČI:** AI razgovor ostaje glavni put; za „Još treba: Opis · Lokacija" (Pregled) dodati „Popuni redom": `ProductSheet` sa jednim poljem, `FactArt` 96 dp na vrhu (`pin` mesto, `calendar` vreme, `money` cena), naslov `pageTitle` 28/33, polje 52, jedno zeleno „Dalje" u `FlowFooter`, tanka linija napretka (3 od 5); nalepnica „uskoči" 220 ms (`Arrive`). Kartica: ne. Kombinuj: Airbnb velike zaobljenosti i beo prostor; izbori iz R-07.
- **Rizik:** ne sme da duplira razgovor (jedno polje traži samo jedan tok); naslov u Inter 700, ne kondenzovan.

**R-07 · Bark + MyHammer + Airbnb (domaćin) — kartice izbora sa predmetom [V]**
- **Radi:** Bark: strelica · naziv usluge · tanka plava traka · ×; pitanje ≈ 22 pt; opcije kao bele kartice (okvir 1 pt, radijus ≈ 8) sa radio levo + „Other" sa poljem. MyHammer: „SCHRITT 4 VON 7" + traka; opcije u 2 kolone sa linijskom ilustracijom kuće i radiom u uglu; dno „Zurück" (kontura) + „Weiter" (puno). Airbnb „What would you like to host?": tri kartice ≈ 80 pt, 3D ikona ≈ 56 pt desno, izabrana = okvir 2 pt crn.
- **Zašto:** tapne se, ne kuca; predmet pojašnjava pitanje; široka meta (Fitts).
- **Ideja:** izbor tipa = velika dodirna kartica sa predmetom.
- **USKOČI:** izbor roka („Tačno vreme · Raspon · Fleksibilno"), cene („Imam cenu · Tražim ponude"), mesta („Kod mene · Na daljinu") kao `PickerTile`, 2 kolone, nalepnica 48 dp desno (`clock`, `money`, `offers`, `home`, `remote`), izabrano = okvir 2 pt tamno + kvačica; zeleno je samo „Dalje". Kombinuj: Airbnb okvir/senka, Bark progres.
- **Rizik:** bez novih vrsta kontejnera (ratchet `surface-kinds`); „Nazad" je tiho dugme, ne druga zelena.

**R-08 · Upwork — AI nacrt unutar razgovora [V]**
- **Radi:** razgovor sa pomoćnikom („Uma") → AI pita za primer → sastavi „Cover letter" u kartici sa tankom limeta ivicom i blagom podlogom, ispod puno zeleno „Insert cover letter"; naslov ekrana u crnom „zarezu" spojenom sa belom pločom.
- **Zašto:** AI tekst je vidljivo poseban objekat i ulazi tek na tvoju radnju (kontrola).
- **Ideja:** nacrt kao samostalan objekat sa jednom radnjom.
- **USKOČI:** Prijava → „Poruka uz prijavu": „Predloži poruku" otvara nacrt iz radnog profila + činjenica zadatka (vozilo, alat, termin) u `Surface note`, radnja „Ubaci"; u objavi isti obrazac već živi (živa kartica nacrta). Kombinuj: Gemini pilula iz razgovora.
- **Rizik:** nova plaćena AI upotreba traži posebno dopuštenje (3.1.6); nacrt ne sme da izmisli vozilo/alat koji nisu u profilu; nikad auto-slanje.

**R-09 · Fiverr — jezik potrebe u prvom licu i plutajuća „Chat" pilula [V]**
- **Radi:** kampanja: fotografija osobe na zasićenoj boji + rečenica „I need an audio engineer…" (serif, ključna reč podvučena); strana ponude: galerija sa brojačem „1 of 5" + srce/deli, traka prodavca (lice sa zelenom tačkom + „Top Rated Seller" ▾), naslov ≈ 20 pt, opis 3 reda „…more", paketi kao tabovi sa cenama ($210 | $130 | $75), dole desno bela pilula „Chat" sa licem i tačkom prisutnosti.
- **Zašto:** jezik potrebe, ne kategorije; kontakt je uvek na dohvat bez takmičenja sa glavnim dugmetom.
- **Ideja:** pitanje poručiocu kao mala plutajuća pilula sa licem.
- **USKOČI:** Detalj zadatka: `float` pilula „Pitaj" sa licem osobe koja je objavila, levo od zelenog „Sastavi prijavu" (pitanja o zadatku već postoje); brojač „1/3" na fotografijama. Kombinuj: Airbnb lepljiva traka (R-11).
- **Rizik:** samo jedna zelena; pilula se skuplja na lice pri skrolu; „online" nije u V1.

### Zadaci i detalj zadatka
**R-10 · Airbnb — kartica bez kutije: objekat, labela na fotografiji, dvolinijski potpis [V]**
- **Radi:** fotografija ≈ 16:15, radijus ≈ 16–18, tačkice galerije; bela pilula „Guest favorite" gore levo (12–13 pt/600), srce gore desno; ispod naslov 16/600 levo + „★ 4,92 (24)" desno; siva linija 15 pt; cena 16/600 podvučena. Oko kartice nema okvira ni senke.
- **Zašto:** pogled ide slika → naslov → cena; labela daje razlog za pola sekunde; bez kutije manje šuma.
- **Ideja:** kartica = predmet + jedna labela razloga + dve linije teksta.
- **USKOČI:** `TaskCard`: levo kvadrat 72 dp (fotografija zadatka ili 2.5D nalepnica na neutralno sivoj podlozi, radijus 16), desno naslov 18/24 (2 reda) + `priceRow` gore desno; ispod „Liman · 1,2 km · 12. okt 10:00" i dva sitna čipa uslova („Zgrada bez lifta", „Kombi"); dno: lice 32 + ime + ★ → ≈ 170 dp (danas ≈ 215). Labela razloga preko sličice: „Blizu", „Tvoj termin", „Imaš kombi". `Surface record` ostaje (senka = „dodirni"). Kombinuj: Airbnb pilula-labela + TT razlog (R-15).
- **Rizik:** fotografije korisnika nisu uvek dobre → fallback nalepnica u istom okviru; „po vremenu u Srbiji" u kartici skratiti (puno u Detalju); „Blizu" traži lokaciju (odobrenje).

**R-11 · Airtasker (+ Airbnb lepljiva traka [O]) — pogled na zadatak: naslov, tri reda, segment sa brojem [V]**
- **Radi:** naslov ≈ 30 pt kondenzovan; tri reda (mesto, datum, budžet sa sitnim „Budget"; linijske ikone 18 pt, tekst 16 pt) bez linija; kratak opis; segment „Offers 4 | Questions" (≈ 48 pt, aktivni = puna tamna pilula); ponude odmah ispod.
- **Zašto:** sve za odluku bez skrola; broj u segmentu kaže gde je akcija.
- **Ideja:** činjenice kao redovi bez kutija; segment sa brojem.
- **USKOČI:** Detalj (radnik): `pageTitle` 28/33, jedna linija „Liman · 12. okt 10:00–12:00 · 2 osobe", 2.5D `FactRow` 28 samo za mesto/vreme/ljude; cena `priceLarge` + „ukupno"; lepljiva traka: cena levo + zeleno „Sastavi prijavu" desno (cena ostaje vidljiva); „Objavio" = `ListRow` sa licem 56, ocenom i „Dolazi kako je dogovoreno 90 %". Moj zadatak (poručilac): `Segmented` „Prijave 3 | Pitanja 1", prva prijava odmah ispod. Kartica: ne. Kombinuj: Airbnb lepljiva traka sa cenom (u istom `FlowFooter`).
- **Rizik:** bez cene = „Cena po dogovoru" mutno, nikad iznos; lepljiva traka je `FlowFooter` (jedina zelena).

**R-12 · Urban Company + Jobber — termin kao prozori [V]**
- **Radi:** UC: „Select date and time — approx. 4 hrs"; datumski čipovi, mreža 3 kolone slotova (bela, okvir, radijus ≈ 8); izabrani = ljubičasti okvir + lavanda ispuna; ugao slota nosi „+₹20" (ćilibar) ili „−₹20" (zelena). Jobber: „Preferred arrival time" kao prozori (9–11, 13–15, 15–17) sa poljima za potvrdu + mini kalendar.
- **Zašto:** ljudi biraju prozor, ne minut; razlika u ceni po terminu vidi se odmah.
- **Ideja:** prozori kao izbor jednim dodirom.
- **USKOČI:** Prijava → „Termin": umesto reda koji vodi u izbor, 3–4 čipa u jednom redu: „Kao u zadatku · 26. okt 09:00–11:00" (oznaka „Traži se"), „Prepodne", „Popodne", „Predloži drugo" → kalendar; ispod „po vremenu u Srbiji" (zaključano). Bez cene po terminu (V1 = 0 RSD). Kombinuj: Airbnb outline kartice izbora (R-07).
- **Rizik:** čipovi moraju da se mapiraju na polje koje server već zna (opseg); ±cena nije u opsegu V1.

### Prijava (ponuda)
**R-13 · TaskRabbit (+ Angi) — „Review and confirm": jedna smirujuća rečenica, pa zbir [V]**
- **Radi:** gore ikona kartice + rečenica da naplata ne počinje dok zadatak nije završen; blok „Mounting" + datum/vreme (linijske ikone) + malo lice „Dave R."; redovi „Payment …7898 ›", „Promos · Add code", „Price Details" (Hourly Rate $40/hr, Trust and Support Fee $10/hr ⓘ, Total Rate $50/hr podebljano); sitan tekst uslova; pun zeleno „Confirm and chat". Angi: „Book and pay in the app" + mint traka garancije + „See your price".
- **Zašto:** strah se rešava pre dugmeta; svaki red je jedan podatak; dugme vodi pravo u razgovor.
- **Ideja:** jedna rečenica smirenja + zbir + jedno dugme.
- **USKOČI:** „Ovo šalješ" (`ProductSheet`): prvi red `Surface note` + `shield` 24: „Prijava je besplatna. Ako te izaberu, odmah nastaje Dogovor."; `KeyValueRow` (Ponuda 4.500 RSD · Ljudi · Termin), poruka; zeleno „Pošalji ovu prijavu"; posle „Prijava je poslata" sa `check` i „Otvori moje prijave" (već). Kombinuj: Airbnb velike zaobljenosti 24 u sheet-u.
- **Rizik:** mint traka (Angi) je odbačena (vlasnik: bez mint panela) → neutralni `note`; tvrdnja o garanciji samo ako stvarno postoji (3.4.5).

### Kandidati i izbor
**R-14 · Airtasker — anatomija ponude [V]**
- **Radi:** lice ≈ 48 pt (fotografija) · ime + plavi štit · „4.8 ★ (18)" · „98 % completion rate ⓘ" · cena desno 18/700 · pun plavi „Accept" ≈ 36–40 pt · „Availability: Today · Wed 21 Nov" u sivom bloku sa podebljanom oznakom · poruka u sivom bloku.
- **Zašto:** isti šablon u svakoj kartici → oko skenira vertikalno (cena uvek desno); ⓘ objašnjava metriku; poverenje (štit + % završenih) uz ime.
- **Ideja:** fiksni šablon od pet redova.
- **USKOČI:** `CandidateFace`/`PrijavaCard`: lice 56 (fotografija; inicijali samo kao rezerva), ime + `shield` 20 ako je identitet potvrđen, „★ 4,8 (11)" ili „Nova ocena", „Dolazi kako je dogovoreno 88 % ⓘ", cena desno `priceRow` + „ukupno · 2 osobe"; „Termin" i „Ima" kao 2 `FactRow`; poruka 2 reda u `note`. „Izaberi" NIJE na kartici: tap otvara `ProductSheet` sa jednim zelenim „Izaberi ovu prijavu". Dodatno (naša ideja, nije viđeno): „Poklapa uslove: ✓ Trake za nošenje ✓ Kombi" sa `tool` 24. Kombinuj: TT razlog (R-15) kao labela iznad kartice; Airbnb mirna siva meta.
- **Rizik:** direktni „Accept" u listi izaziva slučajan izbor; „poklapa uslove" mora da dolazi iz stvarnih polja.

**R-15 · Thumbtack — rezultati po razlogu + brojke „slično blizu tebe" [V]**
- **Radi:** svaka kartica ima gornju traku (svetlo plava) sa razlogom: „Highly rated", „Frequently hired", „Responds quickly"; unutra lice ≈ 68 pt, ime + „Top Pro", „Exceptional 5.0 ★★★★★ (60)" zeleno, mesto, „Contact for price", citat recenzije u sivom bloku, brojke sa ikonama: „350 hires", „51 similar jobs done near you", „Responds in about a day".
- **Zašto:** vidi se zašto je neko gore (poverenje u poredak); grupe smanjuju izbor; brojke su konkretnije od zvezdica.
- **Ideja:** svaki prikaz nosi jednu istinitu rečenicu „zašto baš on".
- **USKOČI:** Kandidati: umesto čipa „Poslata" na svakom — jedna labela iz podataka: „Najniža cena", „Najbliži", „Najviše sličnih zadataka", „Odgovorio prvi" (samo ako je tačno i ima ≥ 2 kandidata); u kartici „4 slična zadatka završena" i „Dolazi kako je dogovoreno 88 %"; poslednja recenzija samo ako postoji. Labela = `StatusChip` neutralan; `Surface record`. Isti princip za listu „Za mene" (R-10). Kombinuj: Airbnb pilula-labela umesto gornje trake u boji (bez pale podloge).
- **Rizik:** „Najbolji" je tvrdnja — samo merljivo; 3 recenzije = „Nova ocena", ne ★ 5,0 kao dokaz (3.4.3 bez izmišljanja).

**R-16 · TaskRabbit — „Select a Tasker": iskustvo u ovom zadatku i značke [V]**
- **Radi:** pilule filtera (pune zelene „Within A Week", „Flexible"; konturna „Price"); „Sorted By: Recommended" 12 pt centrirano sa linijama; red: lice ≈ 90 pt, ime 17/600, cena desno „$65/hr" 17/700, „★ 5.0 (30 ratings)", zeleno podebljano „50 TV mounting tasks", sivo „80 mounting tasks overall", isečak biografije u sivom bloku + zelena veza „See profile"; značke „ELITE" (pehar) i „GREAT VALUE".
- **Zašto:** iskustvo u baš ovom zadatku jače je od opšte ocene; „Sorted by" otkriva logiku.
- **Ideja:** broj sličnih završenih kao glavni dokaz uz ocenu.
- **USKOČI:** red kandidata: „12 sličnih zadataka" (bez naziva vrste rada) zelenom podebljano + sivo „14 završenih ukupno"; „Sortirano: Redom pristizanja ▾" već imamo — dodati „Najbolje poklapanje" kad su uslovi poznati; isečak poruke ostaje (2 reda) u `note`. Kombinuj: Airbnb mirna meta (siva, 14–15 pt).
- **Rizik:** „sličan" treba objašnjenje bez prikaza kategorije; samo stvarni brojevi.

**R-17 · Bark + Upwork — radnje nad listom: „top 5", tonalno + puno, izdvajanje [V Bark; O Upwork]**
- **Radi:** Bark: tabovi „Matches (77) | Replies (2)"; blok „RECOMMENDED" sa rečenicom da zatražiš odgovore od prvih 5 i dugmetom; kartica: kvadrat-logo, ime + štit, ★ 4,5 (65), mesto, 3 tačke, par dugmadi „View profile" (svetlo plavo, tonalno) + „Request reply" (puno plavo). Upwork (pomoć): predlozi se mogu izdvojiti, poslati poruka, zaposliti, odbiti ili arhivirati; tabovi „Shortlisted / Messaged / Archived"; Job Success Score uz ime.
- **Zašto:** sistem predlaže broj, čovek ne mora da proučava sve; tonalno + puno razlikuje primarno i sekundarno.
- **Ideja:** „uzmi 3 najbolja i uporedi" + jedna primarna radnja.
- **USKOČI:** „Uporedi" postaje prava tabela: do 3 kolone × redovi (Cena · Termin · Ljudi · Uslovi ✓ · Dolazi % · Slični) sa tihim markerom najbolje vrednosti u redu (tačka + reč, ne samo boja); zvezdica „Izdvoji" na kartici (tihi `Glyph`); podnožje: zeleno „Uporedi izdvojene (3)". Kombinuj: TT razlog (R-15) kao zaglavlje kolone.
- **Rizik:** na 361 dp tri kolone su tesne → dve kolone + bočni skrol za treću; Upwork deo nisam video [O].

### Moji zadaci, Dogovor, Raspored, Poruke, Ocena
**R-18 · MyHammer — brojači stanja + jedno dugme [V]**
- **Radi:** kartica zadatka („Malerarbeiten: 31 m²; zwei Räume; Wände ›"); dve kutije jedna uz drugu: „0 · Interessenten · čeka tvoj izbor" i „2 · Ausgewählt · kontakt razmenjen" (aktivna ljubičasto); puno „Handwerker ansehen"; ispod „Auftrag erledigt? Bewertung abgeben".
- **Zašto:** dva broja daju celu sliku; jedno dugme = sledeći korak; ocena je na istom mestu kad je gotovo.
- **Ideja:** stanje kao dva broja, ne rečenica.
- **USKOČI:** `OwnTaskCard`: umesto čipa + dve rečenice, dva broja „Prijave 3 · Izabrano 0/2" sa 2.5D `offers`/`users` 24 dp; „noga" kao danas („Uporedi ih i izaberi"); narandžasta tačka samo kad čeka tvoju odluku. Kartica: da (dodirljiv zapis). Kombinuj: TT grupisanje „Your plan" (R-04).
- **Rizik:** „0/2" se sudara sa „0/2 popunjeno" na javnoj kartici — različito značenje (izabrano vs. popunjena mesta), izabrati različite reči.

**R-19 · Thumbtack — „You're booked. Now what?" [V]**
- **Radi:** velika zelena kvačica u krugu; naslov potvrde sa datumom i vremenom ≈ 20 pt; mini kartica osobe (lice, ocena); pitanje „šta sad"; jedna kartica sa jednim zahtevom („Add photos to finalize price" + tamno dugme) i tamno „Got it".
- **Zašto:** vrhunac (peak-end) + jasno šta sledi, bez praznine posle odluke.
- **Ideja:** potvrda + jedan sledeći korak.
- **USKOČI:** posle „Izaberi ovu prijavu" (i kod izabrane osobe) ekran „Dogovor je nastao": 2.5D `agreements` 96 (jednom „uskoči"/`SuccessMark`), osoba (lice 56), „Šta sad?" kao 1–2 `ListRow` (Dogovorite vreme · Dodaj fotografije), jedno zeleno „Otvori Dogovor"; u Dogovoru gore jedna kartica „sledeći korak" umesto 9 blokova. Isto za „Objavljeno" (poručilac): sličica zadatka + R-03 nalepnica. Kombinuj: Airbnb velika zaobljenost i jedan objekat-heroj.
- **Rizik:** samo jedan sledeći korak (ne lista od pet); „Dodaj fotografije" proveriti sa postojećim funkcijama.

**R-20 · Airbnb Trips + Jobber Calendar — raspored kao vremenska linija [V]**
- **Radi:** Airbnb: zaglavna kartica sa fotografijom, pilula „Today", naslov, datumi, linija, adresa + siva „Get directions"; ispod linija dana: datum-balon („Thu 22", pun krug) levo i male kartice stavki sa 3D ikonom ≈ 56 („Check in after 3:00 PM"). Jobber: „Day | List | Map"; nedeljna traka sa punim zelenim krugom za danas; kolone po ljudima; blokovi tamni; isprekidan „ghost" cilj pri prevlačenju.
- **Zašto:** vreme je glavna osa; „danas" je uvek istaknuto.
- **Ideja:** dan kao vertikalna linija sa datum-balonom i malim zapisima.
- **USKOČI:** Raspored (`AgendaScreen`): pilula „Danas"; levo datum-balon (zeleni krug za danas), desno `AgendaRow` kao `Surface record` sa vremenom kao prvim redom (`note`, tabelarne cifre) i `StatusChip`; prazan dan = jedan `note`; kartica „Raspored" na Početnoj dobija pilulu „Danas" + 2.5D `clock`; 4 koraka Dogovora ostaju tanka linija sa tačkama. Kombinuj: Airbnb karta „Today".
- **Rizik:** „Get directions" otkriva adresu — kod nas tek posle „Podeli adresu"; „Map" režim kasnije (Angi pokazuje putanju dom → izvođač sa licem na kraju [V]).

**R-21 · Airtasker — „Release payment": potvrda završetka u jednom fokusiranom koraku [V]**
- **Radi:** ekran + ×; lice ≈ 70 pt centrirano + ime ≈ 18 pt; pitanje da li si zadovoljan urađenim; zelena oznaka sa lokotom „PAYMENT SECURE" (sitna velika slova); red „Task price $160.00"; četiri pune opcije bakšiša ≈ 52 pt (izabrana = tamno plava); sitni uslovi; puno dugme.
- **Zašto:** jedan fokus, lice čini odluku ličnom, sigurnost je u istom pogledu kao radnja.
- **Ideja:** završetak kao mali svečani ekran sa licem.
- **USKOČI:** poručilac „Potvrdi završetak" → `ProductSheet`: lice 72 + „Da li je [Ime] završio zadatak?"; zeleno „Da, završeno je" + tiho „Još nije"; odmah isti tok „Kako je prošla saradnja?" (zvezdice 44 dp, haptički „tik", `Appear`), do 3 oznake kao čipovi, `FlowFooter` sa „Ocenu posle čuvanja ne možeš da menjaš"; posle čuvanja `SuccessMark` + 2.5D `star` (jednom). Bez bakšiša i plaćanja (V1 = 0 RSD). Kombinuj: Airbnb tipografija ispod lica.
- **Rizik:** poručilac ne može da otkaže posle „gotovo" (pravilo ostaje); ne mešati potvrdu sa plaćanjem.

**R-22 · Jobber — odobrenje: jedna jaka + jedna tiha, zbir u plutajućoj kartici [V]**
- **Radi:** pregled ponude sa stavkama (neke „Optional" zeleno); preko dna plutajuća bela kartica: „Quote Total" ≈ 26 pt/700, polje za potpis, tamno „Approve & Pay Deposit" (puno) + „Request Changes" (kontura) jedno ispod drugog.
- **Zašto:** iznos koji odobravaš je u istom pogledu kao radnja; tiha alternativa je uvek tu.
- **Ideja:** radnja i iznos u jednom plutajućem bloku.
- **USKOČI:** „Predlog izmene čeka tvoj odgovor" (amber `note`, već): ispod „Termin: 08:00–12:00 → 10:00–14:00" kao dva reda sa strelicom i razlogom; podnožje: zeleno „Prihvati predlog" + tiho „Predloži drugo" + tekstualno „Odbij" sa `ConfirmSheet`; sve u `FlowFooter` (jedna zelena). Kombinuj: Airbnb mirna siva meta ispod radnje.
- **Rizik:** tri radnje → samo jedna zelena; „po vremenu u Srbiji" uz svaki termin.

**R-23 · Airtasker + Airbnb + TaskRabbit + Fiverr — razgovor vezan za predmet [V]**
- **Radi:** AT: traka pod zaglavljem: lice 40 · naziv zadatka 16/600 · ime sivo · cena desno · stanje; dva tonalna čipa („Release payment", „View task"); blok napomene (lavandasto-siva podloga, narandžasti štit, 13 pt); mehur primljen beo sa licem 36, poslat tamno plav, vreme ispod. Airbnb: zaglavlje: lice + ime + kontekst linija (datum · naziv) + pilula „Details". TR: tabovi „Receipt | Task Info | Chat", sistemska poruka centrirano sivo („zakazan termin…"). Fiverr: mini kartica „Ova poruka se odnosi na:" sa sličicom.
- **Zašto:** razgovor ima predmet; sistemske poruke čuvaju istoriju dogovora; napomena stiže baš kad treba.
- **Ideja:** traka konteksta + sistemske linije + bezbednosna napomena u pravom trenutku.
- **USKOČI:** uz „Pregled | Poruke": ispod zaglavlja traka (lice 32 · „Prenos ormana do kombija" · „5.500 RSD" · `StatusChip` „Dogovoreno" · čip „Predloži termin"), ≤ 64 dp i skroluje sa listom; sistemske poruke („Predložen novi termin 28. sep 10:00–14:00") kao centrirane sive linije; napomena samo uz prvu poruku i kad neko traži broj/adresu: `note` + `lock`: „Broj i adresu deli tek kad budete spremni."; lista Poruka već nosi kontekst-liniju (lice 56). Kartica: ne (redovi). Kombinuj: Airbnb zaglavlje sa kontekst-linijom i pilulom „Details".
- **Rizik:** traka ne sme da jede visinu (tastatura); „Pošalji ponovo" i poštena stanja slanja ostaju.

### Profil i poverenje
**R-24 · Thumbtack — profil „Overview": poverenje kao lista sa ikonama [V]**
- **Radi:** lice ≈ 68 pt, ime ≈ 20 pt, „Online now – responds in about 30 minutes" (zelena tačka), čipovi „Top Pro" i „Exceptional 5.0★ (102)", zeleno „Free on-site estimate"; okvir „Your project…" + tamno „Check availability"; „About this pro" 3 reda + „Read more"; „Overview": ikona + red („Hired 499 times", „88 similar jobs done near you", „Background checked", „License verified", „12 employees", „5 years in business").
- **Zašto:** poverenje se skenira kao lista činjenica sa ikonama; „slično blizu tebe" je lično.
- **Ideja:** „pregled" kao 6 kratkih činjenica sa ikonom.
- **USKOČI:** `PublicProfileSheet`: gore „tri broja" u jednom redu: „4,8 ★ · 12 ocena" | „14 završenih" | „88 % dolazi" (veliki broj, sitna oznaka); ispod `FactRow` 2.5D: `shield` „Identitet je potvrđen", `check` „Završeno 14 zadataka", `calendar` „Na USKOČI-ju od marta 2026", `vehicle` „Ima kombi"; „O meni"; „Prijavi ili blokiraj" ostaje tiho na dnu. Kombinuj: Airbnb velika lica (96) i beli prostor.
- **Rizik:** samo potvrđene činjenice; „online / odgovara za…" nije u V1 — izostaviti.

**R-25 · Airtasker — priča o izvođaču: dva broja + potvrde + citat [V tekst sajta; raspored nisam gledao]**
- **Radi:** kartica: ime, „Overall rating 5 · 73 ratings" i „Completion rate 97 % · 73 ratings" kao dva velika broja, „Specialities: …", kratka lična biografija (2–3 rečenice), čipovi potvrde „Digital iD", „Payment Method", „Mobile", „What the reviews say" + citat sa imenom.
- **Zašto:** dve brojke + tri potvrde + glas stvarne osobe = poverenje za 5 sekundi.
- **Ideja:** broj, potvrda, citat.
- **USKOČI:** javni profil: dva-tri broja (R-24), „Potvrđeno": male 2.5D oznake `shield` (identitet), `phone` (telefon), `check` po stvarnom stanju, i jedan citat poslednje ocene sa imenom i datumom (ako postoji); „Ocene" ostaju (`ListRow`, zvezdice, oznake saradnje). Kombinuj: Airbnb velika lica i beli prostor.
- **Rizik:** biografija ne sme biti izmišljena; citat samo po pravilu privatnosti (komentar ocene je u DEV iza zastavice D12).

**R-26 · Airbnb + Thumbtack — značka koja se zarađuje po javnom pravilu [V + izvori, O]**
- **Radi:** Airbnb „Guest favorite" (bela pilula na fotografiji): prosečno > 4,9, najmanje 5 recenzija u 4 godine (1 u poslednje 2), niska stopa otkazivanja (≈ 1 %), ocene po kategorijama; gornjih 1/5/10 %. Thumbtack „Top Pro": ≥ 10 angažovanja u 12 meseci, ≥ 4,8, ≥ 5 verifikovanih recenzija; ≈ 4 % izvođača (Pro Center; danas ide preko nivoa „Platinum"). TR „ELITE" sa peharom.
- **Zašto:** značka je nagrada za ponašanje; javno pravilo → veruje se.
- **Ideja:** jedna značka, javno pravilo, retka.
- **USKOČI:** „Pouzdan" (jedna značka; novi 2.5D pehar/medalja — jedini novi sticker) = završeni Dogovori ≥ N i „Dolazi kako je dogovoreno" ≥ X % u 12 meseci (N i X odlučuje vlasnik; objaviti „Kako se dobija"); prikaz: pilula na licu u kartici kandidata i u profilu; ne kao filter „samo pouzdani". Kombinuj: Airbnb bela pilula-labela na licu.
- **Rizik:** nikad za plaćanje (Fix4You „Premium oglas" je suprotno); mora biti istinito izračunato na serveru; ne zaobilazi „≤ 3 recenzije = Nova ocena".

### Prazna stanja i region
**R-27 · Upwork + NN/g — prazan razgovor kao „soba dobrodošlice" [V + članak]**
- **Radi:** Upwork: ilustracija (ruke koje drže stranicu) + dobrodošlica u „sobu za poruke" + ko je unutra („samo ti i dvoje drugih") + šta se sme (ćaskanje, fajlovi, poziv); zatim razdelnik dana i poruke sa licima, fajl-kartice (PDF/DOC + veličina). NN/g: prazno stanje (1) kaže status sistema, (2) daje „learning cue" šta će se ovde pojaviti, (3) nudi direktan put.
- **Zašto:** prazno nije greška nego uvod; kaže ko je tu i šta može.
- **Ideja:** prazno = uvod + jedan put.
- **USKOČI:** `StateView`: centrirano, nalepnica 96 (`messages`/`tasks`/`offers`/`agreements`), `title` 21, `copy` ≤ 280 širine, 1 zelena + ≤ 1 tiha, na ≈ 1/3 visine (spec T7); prvi razgovor u Dogovoru: „Ovo je razgovor o zadatku ‘Prenos ormana’. Tu ste ti i Marko." + 2 predloga poruke kao čipovi („Kada ti odgovara?", „Imam kombi"); „Još nemaš zadatak" prebaciti sa leve 64 na centar 96. Kombinuj: Airbnb mirna tipografija.
- **Rizik:** predlozi poruka su skraćeni odgovori, ne AI; bez izmišljene „aktivnosti".

**R-28 · Košnica (RS) — profil izvođača sa fotografijom preko cele širine [V]**
- **Radi:** „Zdravo! Šta ti treba danas?" + polje „Pretraži" + čipovi sa linijskom ikonom (Čišćenje, Moler, Privatni časovi, Električar…); „Izdvajamo": fotografija 3:2 + naziv + „★ 4,9 (8)"; profil: fotografija preko cele širine, naziv, adresa sa pinom, „★★★★½ 4,9 · 36 recenzija" (podvučeno), „Usluge" sa linijskim ikonama, opis; razgovor: svetlo plav poslati i beli primljeni mehur sa licem; slogan „Opis. Slike. Usluge. Cene."
- **Zašto:** najbliži lokalni primer čistoće; fotografija rada daje poverenje; ipak je imenik (nema objave zadatka, ponuda, Dogovora ni ocene u toku).
- **Ideja:** velika fotografija rada + čipovi sa ikonom.
- **USKOČI:** javni profil radnika: traka 3–4 fotografije radova (`photo`) i „Radi: selidbe, nošenje" kao čipovi iz profila (bez kategorije); naša razlika je tok i dokaz iz Dogovora. Kombinuj: Airbnb tipografija ispod fotografija.
- **Rizik:** fotografije radova = moderacija i privatnost; portfolio kao nova funkcija bez odluke vlasnika ne planirati.

**R-29 · Znam Majstora / Fix4You (RS) / Housecall Pro — šta NE ponoviti [V]**
- **Radi:** Znam Majstora: oglas „Najveća baza majstora svih profila u Srbiji!" na jednobojnoj narandžastoj ploči; ekrani tamni, konturni: „Dodaj uslugu" sa čipovima tipova, „Filteri" (fizičko/pravno lice, mesta kao čipovi, klizač cene 500–10.000+, „Cena po dogovoru", valuta RSD/EUR). Fix4You: lista oglasa u plavim okvirima, palac gore/dole 0/0, čipovi „Dogovor · Gotovina · Subotica", izbor „Standardni (besplatan) / Istaknut / Premium" za kredite. Housecall Pro (strana pružaoca): procena kao niz sivih kartica (Status · Customer sa Street View slikom · Line Items) + traka od 4 ikona-akcije; marketing „8+ hours saved per week".
- **Zašto je slabo:** imenik/oglasi bez toka (objava → ponude → Dogovor → ocena); gusto, konturno, tamno; plaćeno isticanje; administrativni izgled.
- **Ideja:** razlika koju možemo da pokažemo: bela, mirna, 2.5D, tok sa Dogovorom i ocenom.
- **USKOČI:** preuzeti samo jasan izbor „Cena po dogovoru" (kod nas „Tražim ponude"); ne preuzimati valutu, plaćeno isticanje, palac gore/dole, tamne konturne ekrane. Kombinuj: samo mirna Airbnb/AT ljuska.
- **Rizik:** naša prednost postoji samo ako izgled i brzina stignu Airbnb nivo.

## 5. Opšta pravila izgleda izvedena iz istraživanja
- **Boja:** jedna boja radnje (kod nas zelena), neutralno siva za ispune i kontrole, narandžasta samo akcenat. Nalepnice: krem/slonovača osnova + jedan akcent po predmetu (naš set već tako izgleda: torba sa alatom, etiketa, slušalice). Angi drži jednu boju za sve ikone i zvezde [V]; UC stavlja predmete na neutralnu sivu [V].
- **Tipografija:** naslov 28–34 Inter 700–800 (AT ≈ 32–36 kondenzovano), cena je najveći broj u redu (tabelarne cifre), siva meta 14–15 pt, najviše 5 stilova po ekranu (već u spec-u).
- **Površine:** siva ispuna umesto okvira za polja i blokove (AT); bela kartica sa senkom samo za zapis koji se dodiruje; nikad kartica u kartici.
- **Zaobljenost:** velike površine 16–24, pločice i polja 8–12, pilule pun radijus (Airbnb, AT, UC) — isti raspon kao naš sistem.
- **Objekat po zapisu:** sličica/nalepnica 72 dp na kartici, lice 56 na osobi, 96 na praznom stanju i u trenucima.
- **Poverenje:** lice + štit + % + broj sličnih (TT, TR, AT) u jednom redu; sve iz stvarnih podataka, ništa izmišljeno.
- **Obaveštenja:** nisam našao javni snimak za AT/TR/TT; primeniti princip iz R-23 (red = nalepnica po tipu + naslov + jedna rečenica + vreme, tačka samo za nepročitano, grupe Danas/Juče — već imamo).

## 6. Redosled ulaganja i odluke vlasnika
- **Predlog redosleda (uticaj/napor):** (1) `TaskCard` sa sličicom i razlogom (R-10, R-15); (2) Kandidati: šablon + tabela poređenja (R-14, R-17); (3) potvrda završetka + ocena u jednom toku (R-21); (4) traka konteksta u razgovoru (R-23); (5) profil: tri broja + potvrde (R-24, R-25); (6) aktivni tab u 2.5D (R-01); (7) „Šta sad?" posle izbora (R-19); (8) centrirana prazna stanja (R-27).
- **Kartica ili ne, po ekranu:** Početna: ulazi da, ostalo redovi; Zadaci/Kandidati/Moji zadaci/Raspored: kartica (`record`); Detalj, Prijava, Ocena, Profil, Poruke, Dogovor detalj: bez kartica (odeljci i redovi); Pregled objave: jedan `panel`; prazno: bez kartice.
- **Pokret (naš predlog, nije viđeno u referencama):** „pop" 1,0→1,08 na aktivnom tabu; „uskoči" nalepnice 220 ms pri prvom prikazu; zvezdice sa haptičkim „tik"; jedan Lottie trenutak (Dogovoreno, ocena sačuvana); sve uz Reduce Motion = bez pokreta.
- **Odluke vlasnika:** (a) fotografije na kartici zadatka i fotografije radova (moderacija, privatnost); (b) novi font za naslove (danas samo Inter; bez odobrenja ne dodavati); (c) značka „Pouzdan": N i X; (d) AI „Predloži poruku" (plaćeni AI); (e) „online"/odziv i „Ponovo pozovi" (V1+); (f) sličnih zadataka i „Blizu" (lokacija, dovoljno podataka); (g) novi 2.5D pehar/medalja.
- **Pravac u jednoj rečenici:** mirna bela Airbnb ljuska, jaka tipografija (Inter 700–800, naslovi 28–34), jedan objekat po zapisu (sličica 72 dp ili 2.5D nalepnica), dokaz brojem, ličnost samo u trenucima.

## 7. Izvori (adrese)
- Airtasker: https://apps.apple.com/au/app/airtasker/id512137061 (snimci 1–6), https://www.airtasker.com/au/ (tekst sajta), https://brandfetch.com/blog/airtasker-new-logo-and-brand, https://www.qualtrics.com/articles/strategy-research/airtasker-brand-revolution/, https://www.designweek.co.uk/issues/16-20-january-2023/airtasker-studio-koto-brand-overhaul/ (403, iz isečka pretrage), https://support.airtasker.com/hc/en-us/sections/206365347-Placing-an-offer-on-tasks, https://www.productreview.com.au/listings/airtasker, https://www.trustpilot.com/review/www.airtasker.com
- TaskRabbit: https://apps.apple.com/us/app/taskrabbit-handyman-more/id374165361, https://bighuman.com/work/taskrabbit, https://venturebeat.com/commerce/taskrabbits-app-update-focuses-on-getting-tasks-done-in-under-90-minutes
- Thumbtack: https://apps.apple.com/us/app/thumbtack-home-service-pros/id852703300, https://pro-center.thumbtack.com/?p=21959, https://thumbprint.design/, https://www.figma.com/blog/how-thumbtack-structures-their-design-system/, https://www.consumeraffairs.com/homeowners/thumbtack.html
- Airbnb: https://apps.apple.com/us/app/airbnb/id401626263, https://www.phocuswire.com/airbnb-summer-release-2025-experiences-services-short-term-rentals, https://www.domusweb.it/en/news/gallery/2025/05/16/airbnb-experience-app-design.html (403), https://www.airbnb.com/help/article/3495, https://news.airbnb.com/airbnb-introduces-guest-favorites/
- Fiverr https://apps.apple.com/us/app/fiverr-freelance-services/id346080608; Upwork https://apps.apple.com/us/app/upwork/id1446736499, https://support.upwork.com/hc/en-us/articles/18010402882195--Review-job-proposals; Angi https://apps.apple.com/us/app/angi-find-local-home-services/id432633172; Jobber https://apps.apple.com/us/app/jobber-field-service-software/id1014146758; Housecall Pro https://apps.apple.com/us/app/housecall-pro-field-service/id692833651; Bark https://apps.apple.com/gb/app/bark-find-experts-save-time/id6738500754; Urban Company https://apps.apple.com/in/app/urban-company-home-services/id1032480595
- Region: https://apps.apple.com/rs/app/znam-majstora/id6476107762, https://apps.apple.com/rs/app/id6503902420 (Košnica), https://itunes.apple.com/search?term=fix4you&country=rs&entity=software, MyHammer https://itunes.apple.com/search?term=myhammer&country=de&entity=software, Fixly https://itunes.apple.com/search?term=fixly&country=pl&entity=software, https://biznis.rs/vesti/srbija/moj-majstor-rs-kraj-ere-jurcanja-i-potrage-za-majstorom-po-preporuci/
- Metod: iTunes Search API (JSON sa adresama snimaka) → slike sa mzstatic.com pregledane jedna po jedna; NN/g https://www.nngroup.com/articles/empty-state-interface-design/

## 8. Šta mi je nedostajalo da vidim
- Stvarnu Airtasker aplikaciju: Browse (lista + mapa), „Make an offer", profil izvođača, obaveštenja (sajt je iza prijave/geo; „Browse" je vraćao 404). Isto: TaskRabbit profil/kalendar, Thumbtack tok pitanja i inbox, Fiverr isporuka, Upwork lista predloga (samo tekst pomoći), Airbnb stranica oglasa i obaveštenja, Daibau.rs i Moj-Majstor.rs.
- Pokret i mikro-interakcije (samo statične slike); stvarne mere (±10–15 %); podatke o korišćenju i A/B rezultate.
- Sve je izlog sa idealizovanim podacima; za konačnu odluku treba probati 2–3 aplikacije uživo na telefonu.

## 9. Tabela: naš ekran → najbolje reference → predlog ideje
| Naš ekran | Najbolje reference | Predlog ideje (jedna rečenica) |
|---|---|---|
| Početna | R-01 Airbnb, R-02 UC, R-04 TT (+R-03) | Dva velika ulaza ostaju; aktivni tab = 2.5D nalepnica; „Kako radi" kao 3 pločice; „Čeka te" grupisano po fazi; „Danas" pilula na kartici rasporeda. |
| Zadaci — lista/kartica | R-10 Airbnb, R-15 TT, R-01 | `TaskCard` sa sličicom 72 (foto ili nalepnica), cena desno gore, dva reda činjenica, labela razloga („Blizu", „Imaš kombi"), ≈ 170 dp. |
| Detalj zadatka | R-11 AT, R-09 Fiverr | Naslov + jedna linija činjenica, lepljiva traka cena + zelena radnja, pilula „Pitaj" sa licem, „Objavio" kao red sa licem 56 i „dolazi %". |
| Objava — razgovor | R-02, R-08, R-09 | Primeri kao pločice-rečenice sa nalepnicom; AI nacrt kao poseban objekat; jezik potrebe u prvom licu. |
| Objava — pregled | R-06, R-07, R-13 | „Popuni redom" jedno polje po koraku sa nalepnicom 96; izbori kao `PickerTile`; rečenica smirenja iznad zelenog dugmeta. |
| Objava — Objavljeno | R-19, R-03 | Ekran „Dogovor/objava je tu": nalepnica 96 jednom, sličica zadatka, jedan sledeći korak. |
| Prijava (ponuda) | R-12, R-13, R-08 | Termin kao prozori (čipovi), „Ovo šalješ" sa jednom rečenicom smirenja, „Predloži poruku" iz profila. |
| Kandidati / poređenje | R-14, R-15, R-16, R-17 | Šablon od 5 redova sa licem 56 i „dolazi %", labela razloga umesto „Poslata", „sličnih zadataka", stvarna tabela do 3 kolone, „Izaberi" tek u sheet-u. |
| Moji zadaci | R-18 MyHammer, R-04 TT | Dva broja („Prijave 3 · Izabrano 0/2") + odeljci po fazi; narandžasta tačka samo kad čeka tebe. |
| Dogovor (detalj/koraci) | R-19, R-20, R-21, R-22 | Jedna kartica „sledeći korak", 4 koraka kao tanka linija, „Potvrdi završetak" sa licem, predlog izmene sa starim → novim. |
| Poruke | R-23 AT/Airbnb/TR/Fiverr, R-27 | Traka konteksta zadatka (≤ 64 dp), sistemske linije, napomena u pravom trenutku, dobrodošlica u prazan razgovor. |
| Ocena | R-21, R-19 | Nastavak potvrde završetka: lice 72, zvezdice 44 sa haptikom, do 3 oznake, jedan trenutak sa 2.5D zvezdom. |
| Profil radnika | R-24, R-25, R-26, R-28 | Tri broja na vrhu, 4–6 `FactRow` 2.5D potvrda, jedan citat ocene, značka „Pouzdan" po javnom pravilu, fotografije radova (odluka). |
| Prazna stanja | R-27, R-02, NN/g | Centrirano, nalepnica 96, jedna zelena + jedna tiha, uvod umesto prazne stranice, primeri rečenica. |
