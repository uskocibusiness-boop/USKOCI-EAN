# USKOČI — istraživanje R3: šta kaže struka o „generičkom“ i kako se ekrani dižu na pravi nivo (8. oktobar 2026)

Agent za istraživanje dizajna (Sonnet 5.5, nasleđeno od roditelja). **Samo čitanje i ovaj dokument:** kod, server, DEV, telefon, emulator i git nisu dirani; ništa nije komitovano. Predlog nije odobrenje: važe AGENTS.md 3.1 (kapije vlasnika) i 3.5–3.6 (zaključano). Ovo je tema R3; R1 i R2 nisam video, pa se mogu preklapati.

Oznake: `[ID]` je izvor iz odeljka H (tamo piše je li stranica *pročitana* u ovom radu, *sekundarna* — samo isečak pretrage ili treća strana — ili *nedostupna*). **(T)** = moj zaključak, nije činjenica iz izvora. **(K)** = iz koda ili snimka. Procene truda su moje: S ≤ pola dana agenta, M 1–2 dana, L duže. Nijedan izvor nije prepisan; sve je prepričano, bez tuđih slika, logotipa, boja i tekstova.

Šta sam gledao: 6 serija snimaka laboratorije (`f1`–`f6_posle*`; web prikaz na izmišljenim podacima, **ne telefon**; crvena traka „Received `false`…“ na dnu mnogih snimaka je upozorenje web prikaza (T), nije deo ocene), kod `StateView.tsx`, `SuccessMark.tsx`, `CatalogMoment.tsx`, `Avatar.tsx`, `assets/illustrations/PROVENANCE.json`, i ranije specifikacije (`KOMPOZICIJA_I_RITAM_SPEC`, `MOTION_I_POLISH_SPEC`, `UX_PLAN_PO_EKRANIMA`, `TALASI_REDOSLED`) da se ne ponavlja šta je već odlučeno.

## 0. Sažetak (za vlasnika)

1. **Zašto je generičko.** Ekran ispada generički kad sve odluke ostanu na podrazumevanim vrednostima (ista kartica, ista ikona, isti ton, sve iste veličine), a ne kad je ružan [G2, N4]. Naš novi sistem reda (ivice, razmaci, primitivi) je uklonio „isprekidano“, ali je i ujednačio sve u isti kalup — to je očekivano. **Red je pod, a identitet je plafon (T):** pod je završen, plafon nije ni počet.
2. **Šta pravi razliku** (isto iz pet različitih strana): (a) jedno žarište po ekranu, a ne osam jednakih traka [N3]; (b) naglasak sa jednim značenjem, jer se naglasak troši kad je svuda [H2, L2]; (c) ljudi pamte vrhunac i kraj, pa se trud sliva na ishode, ne na sredinu [L1]; (d) brend je u detaljima — crtež, pokret, glas — a ne u logotipu [G2, H11, S3]; (e) obični ekrani moraju biti savršeno obični, da bi se vrhovi videli [L4, S2].
3. **Šta predlažem:** „pravac u pet rečenica“ (D2), žarište na svakom ekranu, 10 potpisnih trenutaka (E), prazna stanja kao male scene, tihi ostatak, i izbor slikama A/B/C (D6). Nijedna nova zavisnost nije potrebna.
4. **Šta ne radimo:** ne kopiramo tuđ 3D stil ni tuđeg lika — trik koji svi ponove postaje nova šablona (Alegria, G3); bez konfeta i gradijenata; ne animiramo činjenice (iznos, vreme, reč stanja).
5. **Šta može odmah, bez odluke vlasnika i bez novih crteža (T):** ton po situaciji (#14), žarište na ekranu (#1), uloga boje (#9), prazna stanja sa postojećim predmetima (#15), i trenuci E5 (Pečat), E7, E9, E10 — sve sa sredstvima koja već postoje.
6. **Šest najvažnijih tehnika:** B2. **Šta traži vlasnika:** F (9 odluka). **Šta nisam mogao da proverim:** G.

## A. Detektor generičkog

Struka ne daje formulu za originalnost, ali daje provere koje hvataju sivu zonu. Svaki simptom ima proveru od 30 s (da/ne), lek i primer sa naših snimaka. Bodovanje: 0–2 „da“ = ekran ima svoj lik; 3–5 = bezbedno, ali zamenljivo; 6+ = generički. Tihi ekrani (podešavanja, podrška, forme, čet) smeju do 4: tamo je običnost vrlina [L4].

| # | Simptom | Provera (30 s) | Lek | Naš primer (K) |
|---|---|---|---|---|
| 1 | **Ništa samo-naše** | Prekrij znak i ime: stoji li ekran u bilo kojoj aplikaciji za usluge? | Bar jedan „naš“ element: predmet 2.5D, pečat, uskok, glas (D2). Razlika je u slojevima detalja specifičnih za brend, ne u logotipu [G2] | Detalj zadatka, kartica zadatka |
| 2 | **Nema žarišta** | Zamuti snimak (blur 8 px) ili žmirkni: oko staje na jedno pravo mesto, ili na red jednakih traka? | Jedan element 1,5–2× veći ili drugog oblika, ostalo tiše; najviše 3 veličine i 2 velika elementa [N3]. Veličina i oblik su alati M3 Expressive-a koji ne diraju našu zaključanu boju [G1] | Početna: osam jednakih traka |
| 3 | **Isti kalup za različite uloge** | Nabroj uloge u listi (odluka, vest, prečica): imaju li različit oblik? | Oblik prati ulogu: odluka = kartica sa jednom radnjom, prečica = red, vest = tekst. Kartice su za raznorodan sadržaj, liste za istovrstan [N5] | „Čeka te“ i „Moji zadaci“ imaju isti red |
| 4 | **Ikona koja ne razlikuje** | Obriši ikonu: gubi li se išta? Ista ikona 3+ puta na ekranu? | Ukloni, ili zameni onim što razlikuje stavke (lice, predmet, broj). Ponovljena ikona je ukras; reč uz ikonu koja govori isto je ukras, a ikona bez reči mora biti nedvosmislena (T) | Podrška: 3× slušalice; Pretraga: isti pin uz svaki grad |
| 5 | **Prazno stanje iz šablona** | Stavi tri prazna stanja jedno do drugog: razlikuju li se po nečem osim reči? | Svako dobija svoj predmet i svoju radnju na slici + jednu rečenicu koja uči. Prazno stanje je „trenutak učenja“ [N1]; ohrabri, nikad krivica, jedna radnja [S5] | Dogovori, Moji zadaci, Zadaci |
| 6 | **Vrhunac bez ceremonije** | Ishod (poslato, dogovoreno, ocenjeno) izgleda kao običan ekran sa kvačicom? | Potpisni trenutak (E). Ljudi sude po vrhuncu i kraju [L1]; velike poente su ishodi, a ne sredina | „Prijava je poslata“, „Ocena je sačuvana“ |
| 7 | **Reči bez glasa** | Pročitaj 10 naslova naglas: bi li ih rekla svaka aplikacija? | Jedan rečnik + ton po situaciji (svečano / mirno / kratko) [S4, N8, H7] | „Trenutno nema otvorenih zadataka“ |
| 8 | **Boja bez uloge** | Nabroj šta znači zelena na ekranu. Više od dva značenja? | Zelena = jedna radnja; činjenice neutralne ili u predmetu; narandžasta = čeka te. Naglasak se troši kad je svuda [H2, L2] | Kartica zadatka: 3 zelena glifa + zeleni link + zelena radnja |
| 9 | **Slova bez glasa** | Imaju li novac i vreme drugačiji tretman od reči? Naslov ≠ telo? | Veliki težak broj za novac i vreme; naslovi sa karakterom, telo neutralno [H1, H11, S2] | „6.000 RSD“ izgleda kao okolni tekst |
| 10 | **Ljudi bez lica** | Ima li osoba lice? Je li reputacija nešto veće od reda u tabeli? | Lice veliko gde je osoba poenta (kandidat, profil); reputacija kao „kartica poverenja“ (ocena, broj završenih, oznake) — samo stvarni podaci | Profil: „AP“ u sivom krugu + tabela |

### A2. Šest primera sa naših snimaka: „ovo je generičko zato što…“

1. **Početna (`f1_posle_pocetna_waits.png`).** Generičko je zato što su dva velika prozora potpuno ista (ista siva podloga, senka, ikona levo, naslov + rečenica), pa slede pet redova istog kalupa (ikona levo, dva reda teksta, strelica) i još tri reda ispod: kad zamutiš sliku, vidi se osam jednakih traka bez žarišta. „Pomoć pri selidbi · 2 prijave · čeka tvoj izbor“ je odluka sa posledicom, a izgleda isto kao „Moje prijave“, koja je prečica (simptomi 2, 3). *Lek:* prvi red „Čeka te“ postaje žarište (lice osobe + iznos + jedna zelena radnja), ostali tanki redovi; dva jednaka dugmeta ostaju (odluka vlasnika od 6.10.), ali predmet sme da pređe ivicu pločice.
2. **Kartica zadatka (`f2_posle_kartice_1.png`).** Četiri kartice imaju isti skelet: naslov, cena, tri reda sa istim zelenim glifovima (pin, kalendar, info), pa osoba u sivom krugu sa inicijalima. Ništa ne kaže šta je zadatak (ormar, trava, prevod) osim teksta; zameni se naslov i dobijena je bilo koja aplikacija za zadatke (simptomi 1, 4, 8, 10). *Lek:* cena kao jedini težak element, osoba kao lice, glifovi neutralni; predmet iz zadatka kao mali 2.5D „materijal“ samo ako vlasnik dozvoli (pravilo PKG-031 „bez kategorije“, F4).
3. **Detalj zadatka (`f2_posle_detalj.png`).** Uredan spisak činjenica: naslov 28, iznos 24, tri zelena reda, pa četiri odeljka teksta. Prvi pogled ne daje sliku zadatka; posle 5 sekundi ne pamtiš ništa osim zelenog dugmeta, koje je isto na svakom ekranu (simptomi 1, 2). *Lek:* vrh sa predmetom (ili pravom fotografijom, kad postoji) koji prelazi ivicu, iznos kao veliki broj, činjenice u dva reda; „Sastavi prijavu“ ostaje jedina zelena.
4. **Prazna stanja (`f5_posle361_dogovori_empty.png`, `f3_posle_mz_prazno.png`, `f2_posle_lista_prazno.png`).** Isti šablon na tri ekrana: sivi kvadrat sa sitnim predmetom (lanac, tabla), naslov, jedna rečenica, zeleno dugme, ostatak prazan. Reči su dobre („Još nemaš zadatak — Reci šta ti treba“), ali slika je ukras u kutiji, a ne uloga (simptom 5). *Napomena (K):* `StateView.tsx` u najnovijem stablu (F8b, 8.10.) već centrira sliku 96 bez pločice, pa je snimak stariji od koda; kalup ostaje isti (art 96 + naslov + rečenica + dugme na svim ekranima), pa lek važi: svaka scena svoj predmet i radnja (lanac se spaja, prazna tabla čeka olovku, prazna mapa čeka pin).
5. **Ishodi (`f3_posle_pf_poslato.png`, `f5_posle361_ocena_sacuvana.png`).** Dva najvažnija trenutka radnika i naručioca izgledaju kao običan ekran sa sivom kružnicom, zelenom kvačicom i tabelom činjenica. Pravilo „vrhunac i kraj“ [L1] kaže da se baš ovo pamti, a mi smo ih napravili najmanje upečatljivim (simptom 6). *Lek:* E5 i E8.
6. **Profil (`f6_posle_profil_aktivan_1.png`).** Na tržištu poverenja osoba je sivi krug „AP“, a njena reputacija je red u tabeli („Završeni Dogovori 9 / 3“, „Moja statistika“ sa četiri broja udesno); ocena „★ 4,8 · 12 ocena“ je sitan red uz ime (simptomi 2, 9, 10). *Lek:* „kartica poverenja“: veliko lice (96), ocena i broj završenih kao veliki brojevi, tri najčešće oznake iz ocena (Na vreme, Pouzdano) kao pečati — samo ako server već vraća agregat; ne izmišljati.

### A3. Kako se koristi
Pregledač (drugi agent, ne autor ekrana; AGENTS 3.2.2) popunjava tabelu 10 simptoma za svaku varijantu pre nego što stigne vlasniku. Cilj za ekran sa „kreativnom“ obradom: ≤ 2; za tihe ekrane: ≤ 4. Detektor je filter pre vlasnika, ne zamena za njegov izbor (D6).

**Mapa simptom → tehnike iz B:** 1 → #4, #22, #11, #14; 2 → #1, #5, #8; 3 → #1, #8, #16; 4 → #4, #22; 5 → #15, #3, #4; 6 → #2, #12, #17; 7 → #14; 8 → #9, #20; 9 → #6; 10 → #1, #10, #21.

## B. Kutija sa alatom: 24 tehnike

Cena = trud (S/M/L, T) · rizik (n/s/v) · RN performanse (0 = bez uticaja, 1 = mali, 2 = merljivo, meriti pre i posle). Svi alati su već u projektu: Reanimated 4.5.1 i RN `Animated`, `react-native-svg`, `expo-image`, `expo-haptics`, `expo-audio` (odobren samo za glas), `expo-blur`, Lottie (samo likovi i trenuci), `phosphor-react-native`. Skia nije instalirana, pa nema shadera.

| # | Tehnika | Šta je | Primer | Kada | Cena | Zaključano? |
|---|---|---|---|---|---|---|
| 1 | **Jedno žarište po ekranu** | Jedan element 1,5–2× veći ili drugog oblika, ostalo se povlači | Crouton (ADA 2024): čista hijerarhija da pažnja bude na kuvanju, ne na ekranu [P1] | Svaki koren i detalj | S–M · n · 0 | Da. Početna zadržava dva jednaka dugmeta; žarište ide u „Čeka te / Moj plan“ |
| 2 | **Potpisni trenutak** | Dizajniran vrhunac posle ishoda (≤ 1,4 s): slika + 1 pokret + 1 haptika + 1 rečenica | Mailchimp: ilustracija, animacija i humor na dugmetu Pošalji [L1, G6]; Duolingo (ADA 2023: likovi i igra) [P1] | Objavljeno, Prijava poslata, Dogovoreno, Ocena (E) | M · n · 0–1 | Da. Lottie samo likovi i trenuci; preskok traži D3 |
| 3 | **Lik koji glumi stanja** | Jedan lik čija poza je stanje: čeka, slavi, čudi se, miruje | Duolingo; Bears Gratitude (ADA 2024: preslatki likovi) [S3, P1] | Prazna stanja, greške, trenuci | M–L · s · 0–1 | Uz uslov: znak i uvod su zaključani, nove poze su odluka vlasnika (F3) |
| 4 | **Predmet, ne ikona** | Veliki dimenzionalni predmet iz sveta zadatka (papir, pin, mapa, alat) umesto sitne ikone u pločici | Airbnb: 3D ikone u izboru Domovi / Doživljaji / Usluge [S7, sekundarno]; naši `assets/illustrations` | Heroji, prazna stanja | M · s · 1 (PNG ≤ 150 KB, `expo-image`) | Da (smer vlasnika: kurirana dimenzionalna umetnost) |
| 5 | **Probijanje okvira** | Predmet ili broj prelazi ivicu kartice; jedino namerno kršenje reda, uvek na isti način | Preklapanje stvara slojeve [R1]; pozadinska umetnost do ivice [H12] | Heroji, vrh detalja | S · n · 0 | Da. Tekst ostaje u koloni od 20 dp |
| 6 | **Tipografski glas** | Veliki, teški brojevi za novac i vreme; naslovi sa karakterom, telo neutralno | Linear: „Display“ rez istog pisma samo za naslove [S2]; naslovno pismo ≠ pismo tela [H11] | Iznos u Dogovoru, „Danas · 14:00“, ime stvari | S (nova veličina u tokenima) do M (Inter Display = nova datoteka pisma, OFL) · n · 0 | Uz uslov: tekst ≥ 12 px; novo pismo traži vlasnika (F5) |
| 7 | **Taktilna dubina** | Jedan izvor svetla (gore-levo); senka znači „dodirni“; pritisak „spušta“ | Doslednost svetla i višeslojne senke [R1]; senka kao znak dodira [N5]; svi naši predmeti već imaju svetlo gore-levo (K) | Kartice, dugmad, predmeti | S · n · 1 (≤ 6 senki u kadru) | Da |
| 8 | **Asimetrija umesto N jednakih** | Jedan blok širi ili viši od ostalih; neravnomerna mreža | Veličina i oblik su među alatima M3 Expressive-a; Google tvrdi da se ključni elementi uoče i do 4× brže [G1, sopstveno istraživanje] | „Čeka te“ / „Moj plan“ na Početnoj | M · s · 0 | Da. Dva jednaka dugmeta ostaju |
| 9 | **Boja ima ulogu** | Zelena = radnja, narandžasta = čeka te, crna = činjenica; ikone činjenica neutralne | Isto značenje svuda [H2]; naglasak se troši [L2]; Uber Base: skoro crno-belo + jedan akcent [S6, sekundarno] | Svi ekrani | S · s (zeleni tekst `#00845A` na sivoj i blago zelenoj podlozi < 4,5:1, MOTION N5) · 0 | Da |
| 10 | **Stvarni sadržaj kao heroj** | Kad postoji prava fotografija zadatka ili osobe, ona vodi; inače predmet | Airbnb: pun-kadar fotografija [S7, sekundarno]; boja u sloju sadržaja [H11] | Detalj zadatka, kandidat, profil | M · s · 2 (dekodiranje; thumbhash/blurhash u `expo-image`) | Uz uslov: samo prave fotografije, nikad stok ni izmišljeno |
| 11 | **Uskok (potpisni pokret)** | Jedan prepoznatljiv pokret dodira: glavna radnja se podigne i sleti; predmet „poskoči“ | Things 3: dugme „Magic Plus“ za dodavanje stavke sa bilo kog mesta u aplikaciji (dvostruka ADA pobeda) [S8, sekundarno]; igra i otkrivanje [W18] | Glavna zelena radnja, trenuci | S · s · 0 (transform, native driver) | Uz uslov: bez odskoka dok vlasnik ne odluči D3 (F2) |
| 12 | **Haptika kao potpis** | Jedan uzorak samo za „Dogovoreno“ (dva kratka pulsa); ostali ishodi standardni | Jasna veza uzrok–posledica, retko, usklađeno sa slikom [H5, A1] | Ishodi | S · n · 0 | Da (MOTION spec A6) |
| 13 | **Zvuk kao potpis** | Jedan kratak zvuk samo za „Dogovoreno!“, podrazumevano isključen | Zvuk i haptika dopunjuju sliku, a pokret nije jedini način da se prenese informacija [H4] | Dogovoreno | M · s (audio fokus, snimanje glasa, nova datoteka) · 0 | Traži vlasnika (F6). `expo-audio` je odobren samo za glas |
| 14 | **Glas i ton po situaciji** | Jedan rečnik + ton koji se menja: svečano za ishod, mirno za grešku, kratko za radnje | Mailchimp: ton prema raspoloženju čitaoca [S4]; četiri dimenzije tona [N8]; pisanje [H7] | Sve reči | S · n · 0 | Da (ti, bez roda, „zadatak“) |
| 15 | **Prazno stanje kao scena** | Svako prazno stanje: svoj predmet/poza + rečenica koja uči + jedna radnja | NN/g [N1]; Polaris [S5]; Duolingo [S3] | 6–8 praznih stanja | S–M · n · 0–1 | Da (jedna zelena po ekranu) |
| 16 | **Postepeno otkrivanje** | Ekran pokazuje sledeći korak; ostalo je iza „···“ ili u sledećem koraku | Najviše 2 nivoa [N2]; važnije gore i napred [H12] | Dogovor, objava, prijava | M · n · 0 | Da |
| 17 | **Putovanje stanja** | Traka koraka Dogovora kao putanja; marker se pomera kad se stanje promeni dok gledaš | Status po fazama (Uber, ranije pročitano u KOMPOZICIJA §5) | Dogovor detalj | M · s · 0–1 | Da. Marker je kontejner, činjenice se ne animiraju |
| 18 | **Učitavanje sa karakterom** | Skelet iste geometrije + jednokratan „dolazak“ sadržaja | Nikad prazan ekran; placeholderi [H8] | Prvo učitavanje | S · n · 0 | Da (bez petlji, B22) |
| 19 | **Gest kao potpis** | Jedan svojstven gest koji uvek ima i dugme | Paper: dvoprsto okretanje za poništi [G8, staro]; gest prati prst [W18] | Liste | M–L · v · 0–1 | Uz uslov: uvek i kao dugme (A0) |
| 20 | **Mali halo boje sadržaja** | Predmet dobija topao/hladan odsjaj prema vrsti zadatka (halo, ne ploča) | Tide Guide: paleta prati vodu i nebo (ADA 2026) [P1]; boja u sloju sadržaja [H11] | Detalj zadatka, pin | S–M · s · 0 | Uz uslov: samo mali halo (vlasnik je odbio blede velike ploče); bez „kategorije“ |
| 21 | **Lični detalji** | Ime, doba dana, „za 2 h“: stvarni podaci umesto opštih fraza | Gentler Streak: napredak umesto poređenja (ADA 2024) [P1] | Početna, trenuci | S · n · 0 | Da (samo stvarni podaci; bez roda) |
| 22 | **Pisana pravila ilustracije** | Pravila stila: svetlo, ugao, materijal, paleta, silueta na 96 px, margina 12 % | Duolingo: tri oblika, najmanje detalja, ritam [S3]; ilustracije promišljeno [S5]; naš `PROVENANCE.json` već ima recept (K) | Sva umetnost | M · n · 1 | Da |
| 23 | **Doterane kontrole** | Zvezdice, čipovi, brojač osoba, prekidač dobijaju karakter: pritisak, punjenje, tik | Zamena podrazumevanog [R1]; mikrointerakcija: okidač, mali odgovor, kratko [N6] | Ocena, čipovi, brojač | S–M · n · 0 | Da (`select` haptika, bez odskoka) |
| 24 | **Namerno tiho** | Obični ekrani (podešavanja, podrška, forme, čet) rade savršeno kao svuda; kreativnost se čuva za vrhove | Korisnici očekuju poznato [L4]; forme bez novotarija [N10]; Linear: manje šuma [S2]; sadržaj pre brenda [H11] | Podešavanja, forme, čet | S · n · 0 | Da |

### B2. Šest najvažnijih (po uticaju na „nije generičko“ naspram cene)
1. **#1 Jedno žarište po ekranu** — najjeftiniji način da ekran dobije hijerarhiju koju oko traži [N3].
2. **#2 Potpisni trenutak** za četiri ishoda — ljudi pamte vrhunac i kraj [L1]; sada su to najbleđi ekrani.
3. **#4 + #22 Predmet, ne ikona, uz pisana pravila ilustracije** — već imamo 21 crtež i recept; fali pravilo koje ih čini sistemom, ne zbirkom [S3].
4. **#14 Glas i ton po situaciji** — najjeftinije (samo reči) i vidi se na svakom ekranu [S4, N8].
5. **#15 Prazno stanje kao scena** — učestalo je i danas je najviše „iz šablona“ [N1, S5].
6. **#24 Namerno tiho** — disciplina zbog koje se ostalih pet vide; bez nje se nova kreativnost utopi u buku [L2, S2].

### B3. Redosled po koristi / ceni
Jeftino i odmah: #14, #1, #9, #12, #23, #5. Srednje: #2, #15, #8, #16, #7, #21. Skuplje, traži crteže ili odluku: #3, #4/#22, #6, #10, #11, #13, #20. Ostaviti za kasnije: #19 (gest), #17 (putovanje stanja) dok osnova ne prođe telefon.

## C. Šta tvrdi struka (po temama)

Sve je prepričano; **→** označava šta to znači za nas. Zaključana pravila uvek imaju prednost nad savetom iz izvora.

### C0. Nagrađeni rad: šta ga izdvaja
- **Apple Design Awards 2023** (aplikacije): Duolingo (likovi i igra), Flighty (intuitivan interfejs uz Live Activities), Headspace (minimalistički interfejs), Any Distance (deljiva dinamična grafika), Universe (smanjena složenost) [P1]. **2024:** Bears Gratitude (preslatki likovi u dnevniku zahvalnosti), Crouton (čista hijerarhija, bez ometanja), Gentler Streak (ohrabrenje, napredak umesto poređenja), Rooms (nostalgična 8-bit estetika), Procreate Dreams [P1]. **2025:** CapWords (slike postaju interaktivne nalepnice), Watch Duty (jasnoća u hitnim trenucima), Speechify (pristupačnost u jezgru), Feather (2D u 3D) [P1]. **2026** (stranica pročitana 8.10.2026): grug (ručno crtan dnevni savet), Tide Guide (prilagođene animacije, paleta prema vodi i nebu), Moonlitt, Is This Seat Taken? (crtani stil), Guitar Wiz (pristupačnost) [P1].
- **Zajedničko (T):** svaki ima jednu prepoznatljivu autorsku ideju (lik, ručni crtež, paleta koja reaguje na stvarnost, slika→nalepnica) izvedenu dosledno, dok su osnove (jasnoća, pristupačnost) besprekorne. Apple sam kao zajedničko navodi promišljen dizajn, uklapanje u platformu i pristupačnost [P1]. Nijedan nije „običan ekran + lep ukras“.
- **Žiriji mere i upotrebljivost:** Awwwards = dizajn 40 %, upotrebljivost 30 %, kreativnost 20 %, sadržaj 10 % (kreativnost nije definisana na stranici); Webby = sadržaj, struktura i navigacija, vizuelni dizajn, funkcionalnost, interaktivnost, inovacija, ukupan doživljaj; Red Dot = originalnost, kreativnost, snaga inovacije, razumljivost, emocionalni uticaj [P2]. Google Play Best of 2025 ima kategorije (zabava, lični razvoj, svakodnevni alat); javne kriterijume dizajna nisam našao, pa ne tvrdim šta ih izdvaja [P2]. **Zaključak (T):** kreativnost bez jasnoće ne pobeđuje nigde.

### C1. Tipografija
- Hijerarhiju prave težina, veličina i boja zajedno i ona mora da preživi uvećanje teksta; što manje skraćivanja, u uskom prostoru slagati u kolonu [H1].
- Izbegavati tanke težine; ograničiti broj pisama jer ih više zamagljuje hijerarhiju; HIG najmanji tekst 11 pt (naš pod je 12 px) [H1].
- Brendu naslovi, čitljivosti telo: posebno pismo ili težina za naslove, neutralno za telo [H11]; Linear je dodao „Display“ rez istog pisma samo za naslove da dobije izraz bez gubitka čitljivosti [S2]. **→** naš Inter ima Regular do ExtraBold; Display rez je nova datoteka (F5).
- Najviše 3 veličine i najviše 2 velika elementa; najvažnije je najveće [N3]. **→** KOMPOZICIJA D ograničava stilove; ovo je pravilo o *kontrastu* veličina.
- Skala tipova unapred, razmak slova prema veličini, dužina reda; labela je poslednje sredstvo hijerarhije, prvo veličina, težina i boja [R1].
- **(T)** Novac i vreme su glas ovog proizvoda: iznos i termin se čitaju prvi, pa zaslužuju poseban tretman (veći, teži, tabelarni brojevi).

### C2. Boja
- Boja ima jedno značenje; ista boja za dve stvari je šum [H2].
- Boja je za naglasak (status, glavna radnja); u šarenoj aplikaciji trake neka budu jednobojne, u jednobojnoj je brend boja naglasak [H2, H11]. **→** bele površine + jedna zelena radnja je upravo „jednobojna aplikacija sa akcentom“; isti put ima Uber Base [S6].
- Jedan istaknut element među sličnima se pamti, ali isticanje se troši: ako je sve istaknuto, ništa nije [L2]. Ne oslanjati se samo na boju; dodati oblik ili reč [H2, L2].
- Paletu graditi u prostoru boja koji prati ljudski vid (Stripe: CIELAB; Linear: LCH): nijanse istog „nivoa“ imaju predvidiv kontrast, pa žive boje mogu biti i pristupačne [S1, S2].
- Neutrali ne moraju biti čisto sivi (malo boje ih čini doteranim); sivi tekst na obojenoj podlozi je greška [R1]. **→** u sukobu sa „neutralne podloge“ ako se preuveliča; ne menjati bez vlasnika.
- Brend boja živi u sadržaju (fotografije, predmeti), ne u kontrolama [H11]. **→** naša boja već dolazi iz predmeta 2.5D i reči.

### C3. Dubina
- Materijali odvajaju kontrole od sadržaja; staklo je za sloj kontrola, štedljivo, a ne za sadržaj [H3, H12]. **→** naš jedini blur je pozadina pretrage; ostalo bez.
- Jedan izvor svetla za sve senke; senka znači visinu; višeslojne senke deluju stvarnije; preklapanje elemenata stvara slojeve [R1].
- Ravna estetika je odnela signale (šta se dodiruje), a blaga dubina ih vraća; ukrasni „realizam“ pravi gužvu i stari [N9].
- Senka je znak „dodirni“ na kartici; cela kartica treba da bude cilj dodira [N5]. **→** KOMPOZICIJA B to već kaže.
- Manje okvira: odvajati razmakom, kontrastom ili senkom, ne linijom [R1] (već u novom sistemu reda).
- 2.5D („clay“) stil je dodatak ravnom, ne zamena: štedljiva tipografija, jak akcenat i dobar kontrast da ne ispadne detinjasto; može da zastari ako se preteruje [G4]. **→** naša umetnost je „odrasla proizvodna, ne igračka“ (`PROVENANCE.json`): upravo ta granica.

### C4. Razmak
- Početi sa previše razmaka pa smanjivati; razmaci iz jedne skale; ne mora se popuniti ceo ekran [R1].
- Grupisati blizinom, kontejnerom ili linijom; važnije gore i napred; poravnanje i uvlačenje nose odnose [H12, N3].
- Bez neodređenih razmaka (ni blizu ni daleko) [R1].
- Postepeno otkrivanje smanjuje početni sadržaj; najviše 2 nivoa [N2, H12]; panel odozdo je za ograničen zadatak, jedan odjednom, ne za duge tokove [H10].
- Veći razmak ispred naslova odvaja odeljke bolje od linije [N3]. **→** već u KOMPOZICIJA B.
- **(T)** Praznina je najjeftinije žarište: ono što stoji samo, okruženo prazninom, čita se prvo.

### C5. Pokret
- Pokret ima svrhu (status, povratna informacija), ne ukras; kratak, prekidiv, uz haptiku ili zvuk gde pomaže; ne na često korišćenim elementima [H4].
- Ponašanje pre animacije: opruga bez preskoka za alate, preskok samo kad gest ima zamah; svi pokreti su „porodica“ zajedničkog karaktera [W18].
- Odgovor ispod 400 ms; animacija i pokazatelj napretka mogu da prekriju čekanje [L3].
- Mikrointerakcija: okidač → mali odgovor; ne otima pažnju i ne postaje trajna funkcija [N6].
- Haptika: jasna veza uzrok–posledica, ista za isti događaj, kratko i retko, usklađeno sa slikom; na Androidu „manje je više“ i jačina prema važnosti [H5, A1].
- Smanjen pokret ne briše informaciju; pokret nije jedini kanal [H4]. **→** naša R7 i MOTION P8.

### C6. Ilustracija
- Mali skup oblika i pravila (Duolingo: tri osnovna oblika, najmanje detalja, ritam veličina) daje prepoznatljiv stil koji mali tim može da proizvodi [S3].
- Lik sa držanjem nosi karakter; poza je priča [S3].
- Generička ravna „korporativna“ ilustracija (Alegria) postala je sinonim za bezličnost, a do 2023. parodija; stil koji koriste svi prestaje da razlikuje [G3].
- Moda se vrti: ravno → 3D → ravno. Airbnb danas gura 3D ikone [S7], ali kopiranjem se ne dobija identitet; identitet su pravila i predmeti iz sopstvenog sveta [G3, S3].
- Ilustracija na praznom stanju ohrabruje i objašnjava; koristiti promišljeno, ne svuda [S5].
- Vratiti složenost i dubinu: slojevi detalja specifični za brend, ilustracija i pokret [G2].

### C7. Mikrotekst
- Glas se određuje jednom (rečnik, ton), pa se prilagođava situaciji: ozbiljan za grešku, svečan za uspeh [H7, S4].
- Glagoli na dugmadima pre „pametnih“ fraza; isti nazivi svuda; opisni linkovi; veliko/malo slovo birati jednom po vrsti elementa [H7].
- Ton ima četiri dimenzije (formalno–neformalno, ozbiljno–šaljivo, uvažavajuće–drsko, zanosno–činjenično); razlike su male, ali statistički značajne (50 ispitanika) i utiču na poželjnost [N8].
- Prinudna šala je gora od nikakve; kad je čovek zbunjen, nervozan ili pod stresom, ton se prilagođava njemu, a ne šali [S4].
- Greška bez okrivljavanja: šta se desilo i šta da uradi; „mi“ izbegavati u greškama [H7]. **→** naše „ti“, bez „mi“.
- **(T)** Reč „uskoči“ je glas koji nema nijedna konkurentna aplikacija: koristiti je kao refren (naslovi dugmadi, trenuci), ne kao ukras.

### C8. Prazna stanja
- Tri funkcije: status (ovde nema ničeg i to je u redu), učenje (šta će ovde biti), put (dugme) [N1].
- Ne pisati „nema podataka“ dok se još učitava (netačan status) [N1]; skeleti umesto praznine [H8].
- Jedna glavna radnja i objašnjenje vrednosti; ohrabriti, nikad izazvati krivicu; naslov okrenut radnji [S5, H7].
- Pomoć u kontekstu pobeđuje uvod unapred: ljudi preskaču tutorijale i ne pamte ih; uči se radnjom [N7].
- Prazno stanje je prilika za ličnost [R1, sekundarno]; ton prema raspoloženju čitaoca [S4].
- **(T)** Novi nalog vidi prazna stanja prvo: to je prvi utisak koji se ponavlja; kod nas 6–8 ekrana.

### C9. Prvi susret
- Brzo, zabavno, opciono; ljudi treba da razumeju aplikaciju koristeći je [H6].
- Uči radnjom, ne tekstom; saveti u kontekstu umesto jednog dugog toka; jedna radnja po jedna [H6, N7].
- Pravni tekstovi i nebitna podešavanja ne u tok; razumne podrazumevane vrednosti [H6]. **→** naš zaključani red „pravni dokumenti još nisu objavljeni“ ostaje.
- Dozvole na mestu upotrebe uz jednu jasnu rečenicu; pre-prozor sa jednim dugmetom, bez lažnih alarma [H15, H6].
- Pokretanje: prvi ekran je odmah upotrebljiv; brend-uvod pripada onboardingu, ne svakom pokretanju; vratiti prethodno stanje [H9, H11]. **→** naš V4.9 uvod je zaključan i ima „Preskoči“; HIG savetuje da se ne ponavlja pri svakom pokretanju: pitanje za vlasnika samo ako se ikad otvori.
- AI prvi susret: reći šta AI sme i ne sme, dati primere, dozvoliti ispravku, poništi i ponovo [H14]. **→** AI razgovor je naše prvo „a-ha“ (E2).

## D. Plan kreativnosti

**D1. Načelo.** Red je pod, identitet je plafon (T). Sistem reda ostaje i 80 % svakog ekrana ide strogo po njemu. Ekran dobija **jedno žarište** i **jedno „potpisno kršenje“** reda, uvek na isti način (predmet prelazi ivicu, ili je broj veliki). Kreativnost se ne deli ravnomerno nego po budžetu (D4). Oduševljenja se vremenom pretvaraju u očekivanja [G5], a „wow“ trenuci se troše, dok se potpisni pretvaraju u tradiciju brenda [G6]: zato su naši trenuci vezani za brend (pečat, rukovanje), a ne za opšti ukras (konfeti).

**D2. Pravac u pet rečenica** (predlog; vlasnik potvrđuje slikama, F1). Seme jednostranog umetničkog pravca koje se dopunjava svakim izborom:
1. **Predmeti, ne ikone.** Svet USKOČI je od papira, emajla i drveta: svetlo gore-levo, pogled 20° odozgo, smaragd / narandžasta / grafit; odrasla proizvodna umetnost, ne igračka (već u `assets/illustrations/PROVENANCE.json`, K).
2. **Rukovanje.** Znak su dvoje ljudi koji se rukuju; Dogovor je trenutak kad se ruke spoje, naš najviši vrhunac.
3. **Uskok.** Naš glagol je pokret: kratak i odlučan; sleti i smiri se.
4. **Pečat.** Svaka obaveza (prijava, izbor, potvrda, ocena) je pečat: tih, taktilan, jednom.
5. **Glas komšije.** „Ti“ bez roda; kratko; toplo; suvo kad su novac i problemi; uzvičnik samo u „Dogovoreno!“.

**Podrazumevano zabranjeno** (iz detektora): siva kružnica + kvačica; ikona u pločici kao prazno stanje; ista ikona 3×; zeleni glifovi svuda; stok fotografije; gradijenti i konfeti; „mi“ i sve reči koje su pravila vlasnika već zabranila (AGENTS 3.5–3.6); tuđ izgled (3D Airbnb, lik Duolingo). Sam pojam „jedna stvar koju će pamtiti“ preuzet je iz uputstava za izbegavanje podrazumevanog izgleda [G7, sekundarno].

**D3. Proces po ekranu (7 koraka)**
1. **Razvrstaj ekran** (D4): vrh, heroj, prazno/greška ili tiho.
2. **Ugao u jednoj rečenici, pre ijedne slike:** „Ovaj ekran je jedno pitanje: …; pamti se: …; reda kršimo ovako: …“. Primer, Početna: „Šta je sledeće? Pamti se jedna velika kartica sa licem; predmet iz dugmeta prelazi ivicu.“
3. **Tri varijante iz tri različita početka**, ne tri doterivanja iste stvari: **A iz predmeta** (umetnost vodi), **B iz tipografije** (broj/reč vodi), **C iz pokreta** (trenutak vodi). Po jedan agent, bez uvida u tuđe radove, u laboratoriji na izmišljenim podacima, isti okvir telefona i font 1,15. Primeri: D3b, šablon: D3c.
4. **Prosejavanje pre vlasnika:** nezavisni pregled (detektor A, zaključana pravila, veliki tekst 1,15 i 1,3, smanjen pokret). Ono što krši pravilo ne stiže do vlasnika.
5. **Izbor slikom** (D6): vlasnik bira slovom + jednom rečenicom razloga.
6. **Detalj:** izabrana varijanta prolazi kroz sedam detalja: predmet, pokret, haptika, reč, prazno / učitavanje / greška, veliki tekst, smanjen pokret.
7. **Zapamti ukus:** svaki izbor postaje rečenica u pravcu (D2) i, gde može, automatska provera (npr. pretraga zabranjenog šablona u kodu). Svaka odluka smanjuje buduće nagađanje.

**D3b. Četiri primera ugla** (T; svaki unutar zaključanog)

| Ekran | Ugao (jedna rečenica) | A iz predmeta | B iz tipografije | C iz pokreta |
|---|---|---|---|---|
| Početna | „Šta je sledeće?“ | Prvi red „Čeka te“ kao velika kartica; predmet prelazi ivicu | „Danas · 14:00“ kao veliki broj na vrhu, ostalo ispod | Dolazak kartice kad nešto stigne + mirno stanje kao scena (E4, E9) |
| Detalj zadatka | „Šta ću raditi, kada i za koliko?“ | Veliki predmet iz zadatka (ili prava fotografija) preko ivice, činjenice ispod | Iznos 40+ px težak, termin druga veličina, ostalo tiho | „Sastavi prijavu“ se podigne i sleti dok se otvara forma (uskok #11, uz F2) |
| Profil | „Kome verujem?“ | Lice 96 + tri pečata (oznake iz ocena) | „4,8“ i „12 završenih“ kao veliki brojevi, ostalo spisak | Pečati se pojave jednom, pri prvom otvaranju posle novog Dogovora (E8, F7) |
| Prazno: Dogovori | „Ovde će biti ruke koje se rukuju.“ | Postojeći lanac uvećan na 120, jedna karika prelazi ivicu | Jedna velika rečenica sa „Dogovor“ istaknutim, mali predmet | Predmet stiže jednom (`Arrive`) i miruje |

**D3c. Šablon zadatka za agenta varijante** (da tri agenta ne daju tri iste stvari)

```
Ekran: <naziv> · Nivo: vrh | heroj | prazno | tiho · Početak: A predmet | B tipografija | C pokret
Ugao (1 rečenica): <…>   Pamti se (1 stvar): <…>   Pravilo reda kršimo ovako: <…>
Zaključano: bele površine, crn tekst, jedna zelena radnja, narandžasta samo akcent, „ti“ bez roda, „zadatak“,
            uvod V4.9 i HOME potpis, bez nove zavisnosti, tekst ≥ 12 px
Zabranjeno: siva kružnica + kvačica, ikona u pločici, ista ikona 3×, zeleni glifovi svuda, stok fotografije,
            gradijent, konfeti, „mi“
Izlaz: PNG u okviru telefona (font 1,15 i 1,3), 1 rečenica „šta je drugačije“, spisak fajlova koje bi izmena
       dotakla; bez commit-a; ne gledaj druge varijante
```

**D4. Budžet kreativnosti (T): 23 mesta od oko 60 ekrana; ostalo je namerno tiho (#24).**

| Nivo | Šta | Broj | Timovi (`TALASI_REDOSLED`) |
|---|---|---|---|
| **Vrh** (potpisni trenutak, E) | Objavljeno, Prijava poslata, Dogovoreno, Potvrđeno, Ocena, Nacrt je spreman, Prvi susret, Mirno je, Nije poslato → poslato, Neko je uskočio | 10 | T2b, T2a, T3a, T4a, H, T3c, tim AI razgovora (dodeliti) |
| **Heroj** (žarište + predmet) | Početna, detalj zadatka, kartica zadatka / pin, Profil (kartica poverenja), Dogovor detalj | 5 | H, Q i T2b, T1-map2, T4a, T3a |
| **Prazno / greška** | Dogovori, Moji zadaci, Moje prijave, Poruke, Obaveštenja, Zadaci / pretraga, greška ekrana, offline | 8 | S (`StateView`) + po timu slika i reč |
| **Tiho** | Podešavanja, Podrška, Pravila, Privatnost, Izvoz, Lozinka, forme, čet, Raspored | ostalo | samo ton i bez grešaka |

**D5. Ko šta radi** (jedan pisac po fajlu; model se navodi po AGENTS 3.1.9)

| Uloga | Radi | Ne radi |
|---|---|---|
| Vođa pravca (jedan agent) | Piše pravac (D2) i ugao po ekranu (D3.2); brani budžet | Ne piše kod |
| Tri agenta varijanti | Svaki svoju varijantu (A/B/C) u laboratoriji, bez commit-a | Ne gledaju tuđe |
| Ilustrator (ugrađeni `image_gen`) | Crteži po pisanim pravilima (#22): prozirna pozadina, silueta čitljiva na 96 px; svaki novi crtež na odobrenje | Ne menja znak ni uvod |
| Pokret i haptika | Vremenska linija trenutka + mapiranje haptike (MOTION A6), smanjen pokret | Ne animira činjenice |
| Reči (tim W) | Ton po situaciji (#14): „ti“, bez roda, „zadatak“ | Ne koristi „mi“ |
| Izvođač tima (S, H, T2a…) | Ugrađuje izabranu varijantu pomoću primitiva N1–N6 | Ne menja pravac |
| Nezavisni pregled (drugi agent) | Detektor A, test od 5 s, pravila 3.5–3.6 | Ne ocenjuje svoj rad |
| Vlasnik | Bira slikom; odobrava nov crtež, zvuk, pismo, poze | — |

**D6. Tabla izbora: kako vlasnik bira gledajući slike**
- Jedna stranica po sesiji (kao ranije za 75 odluka): za svaku odluku 3 slike telefona iste veličine (A/B/C) + mala slika „Sada“ za poređenje. Ispod svake: *šta je drugačije* (≤ 12 reči) i *šta dobijaš / šta gubiš* (≤ 12 reči). Dugmad: A / B / C / „Nijedna“ + polje za jednu rečenicu.
- Najviše 6 odluka po sesiji (≈ 15 min). Bez stručnih reči. U tabli samo naši crteži: tuđe slike ne stavljamo; reference se opisuju rečima. Trenuci (E) se biraju kratkim video-zapisom od 1,5 s (petlja + završni kadar), ne mirnom slikom: pokret se na slici ne vidi.
- Odgovor ide u registar i u pravac (D3.7). Telefon samo u prozoru „sad“; do tada emulator (AGENTS 3.2.1).

**D7. Kako se proverava da nije generičko**
1. **Detektor** (A): ≤ 2 „da“ za kreativne, ≤ 4 za tihe ekrane.
2. **Test zamućenja** [N3]: blur 8 px; oko staje na žarište koje je ugao najavio.
3. **Test zamene znaka:** prekrij znak; troje (agenti + vlasnik) imenuju vrstu aplikacije; „bilo koja“ = pad.
4. **Test od 5 sekundi:** snimak 5 s, pitanje „šta pamtiš?“; dozvoljen je jedan odgovor i to mora biti ona jedna stvar iz ugla. Pazi: lep ekran povećava toleranciju na greške (aesthetic-usability) [N4], pa se meri *zadatak* („nađi iznos“, „pošalji prijavu“), ne „sviđa li ti se“.
5. **Zaključana pravila** (AGENTS 3.5–3.6): bele površine, jedna zelena radnja, narandžasta akcent, „ti“, „zadatak“, uvod i HOME potpis, bez paketa, tekst ≥ 12 px.
6. **Veliki tekst i smanjen pokret:** 1,15 i 1,3; trenutak ostaje razumljiv bez pokreta; haptika ostaje (R5).
7. **Performanse:** odgovor < 400 ms [L3]; bez petlji osim u fokusu (B22); jedan veliki crtež po ekranu; merenje na telefonu, označeno.
8. **Nezavisnost:** pregled radi drugi agent (AGENTS 3.2.2); vlasnikov izbor je poslednja reč.

**D8. Redosled i rizici**
- **Krug 1 (pravac i vrhovi):** pravac (D2) potvrđen slikama; Dogovoreno!, Objavljeno, Prijava poslata, Ocena; heroj Početne. **Krug 2:** detalj zadatka, Profil, prazna stanja, Nacrt je spreman, Prvi susret. **Krug 3:** detektor preko svih ostalih ekrana + tihe zone.
- **Rizici:** (a) tri varijante konvergiraju na isto → različiti početci (predmet / tipografija / pokret); (b) lepota krije greške [N4] → test zadatka; (c) oduševljenje postaje očekivano [G5] → vrhovi vezani za brend, ne za konfete; (d) nova šablona (Alegria) [G3] → pisana pravila i zabranjena lista; (e) performanse → jedan crtež, bez petlji, merenje; (f) sukob sa pravilima vlasnika → pregled pre izbora.
- **Procena (T):** jedan krug varijanti za 10 vrhova ≈ 30 agent-sati paralelno; vlasnik ≈ 3 sesije po 15 min.

**D9. Prvih pet poteza (T)**
1. **Tabla 1 sa tri odluke:** Početna (A/B/C), prazno stanje „Dogovori“ (A/B/C), Pečat „Prijava poslata“ (A/B/C). Sve tri se izvode bez novog crteža.
2. **Pisana pravila ilustracije** (#22) na jednoj strani, izvedena iz `PROVENANCE.json`: svetlo, ugao, materijal, paleta, silueta na 96 px, margina 12 %.
3. **Ton po situaciji** (#14) + 12 uvek istih reči („Uskoči“, „Dogovor“, „Pečat“…); tim W.
4. **Prazna stanja kao scene:** `StateView` dobija po ekranu jedan od postojećih predmeta i jednu radnju umesto istog kalupa; tim S + timovi ekrana.
5. **Detektor (A) preko snimaka `f1`–`f6`** kao polazna ocena; posle prvog kruga se meri ponovo.

## E. Deset potpisnih trenutaka

**Recept trenutka (T, po MOTION P6):** 1 glavni pokret + najviše 2 prateća + 1 haptika + 1 rečenica glasa + mirovanje; 0,9–1,4 s; dodir preskače na završno stanje; igra se samo kad se ishod upravo desio (`fresh`), a ponovno otvaranje iste priznanice je mirno (kao `SuccessMark`); smanjen pokret = završno stanje, haptika ostaje; nikad se ne animiraju iznos, broj, vreme ni reč stanja; bez petlji (B22). HIG: potvrđuje se bitan završen čin, rutinski ne [H13]; zato samo ovih deset. **Test „naše“ (T, po G6):** trenutak je naš ako se ne može preseliti u tuđu aplikaciju a da ne izgubi smisao (pečat, rukovanje, uskok) i ako nosi element identiteta; konfeti ne prolazi.

**Pet glagola pokreta (T)** daju proizvodu glas pokreta; porodica pokreta zajedničkog karaktera je ono što korisnik uči ponavljanjem [W18]: **Sleti** (predmet se spusti i smiri), **Pečat** (obaveza), **Spoji** (Dogovor), **Nacrtaj** (linija napretka), **Smiri** (mir ili oporavak).

**Alati su već u projektu (bez nove zavisnosti):** RN `Animated` sa native driverom (kao `SuccessMark`), Reanimated za dolazak redova (`Appear`), `react-native-svg`, postojeći PNG crteži, `tick()` iz `system/haptics`; Lottie samo za lik, kad stignu vlasnikove datoteke (V28). Za prvi krug nije potreban nijedan novi crtež: E3, E6 i E9 koriste postojeće (T).

| # | Trenutak (okidač) | Izvedba: slika · pokret · haptika · reč | Napomena (smanjen pokret · pravilo · odluka) |
|---|---|---|---|
| E1 | **Prvi susret** (prvo otvaranje Početne posle prijave, `firstRun`) | Dva predmeta sa dugmadi **sleću** jedan za drugim (`Appear` 240 ms, korak 40; predmet 6 dp naniže, senka se širi); iznad njih „Zdravo, Ana.“; red „Kako radi“ stiže poslednji. Bez haptike (nije ishod). Posle prvog puta Početna miruje | Uvod V4.9 i HOME potpis netaknuti; ovo je samo Početna. Pozdrav proveriti protiv pravila „bez eyebrow-a i orijentacije“. Smanjen pokret: sve odmah |
| E2 | **Nacrt je spreman** (AI razgovor: govor ili tekst postaje nacrt zadatka) | Razumljeno (šta, gde, kada, cena) **sleće** u karticu nacrta po jedno polje (4 × 120 ms, razmak 60) i ostaje; prazno polje ostaje „Dodaj“, ništa se ne izmišlja; ispod „Pregledaj pre objave“ (jedna zelena). Jedan lak tik na poslednjem polju. Reč: „Evo nacrta.“ | Prvo „a-ha“ proizvoda: govoriš, dobiješ karticu. HIG za AI: uvek Izmeni / Ponovo [H14]. Iznos se ne animira. Smanjen pokret: kartica odjednom |
| E3 | **Objavljeno!** (server potvrdi objavu) | 2.5D pin (`assets/resolved-location-pin.png`) **sleće** na papirnu mapu (`assets/illustrations/uskoci-discover-v3.png`) jednim smirenim pokretom i pusti jedan krug koji raste i bledi (600 ms); Success haptika kad pin dodirne mapu (~150 ms). „Objavljeno. Čim neko uskoči, javljamo ti.“ 1,2–1,5 s, pa Zadaci sa pinom novog zadatka izabranim | Bogatija verzija `SuccessMark` 64 iz UX plana 2.9 (isti trenutak); preskok traži D3. Smanjen pokret: pin već na mapi |
| E4 | **Neko je uskočio** (nova prijava dok je Početna otvorena) | „Čeka te“ dobija novi prvi red kao žarište: lice osobe + iznos + „Pogledaj prijavu“ (jedina zelena); ulazi sa desne ivice 12 dp + providnost 240 ms; narandžasta tačka jednom pulsira (1 → 1,25 → 1, 600 ms, bez petlje). Bez haptike (dolazak nije ishod; u pozadini radi push). „Marko uskače na tvoj zadatak.“ | Samo za novi ID (R6); ne ponavlja se pri povratku. Smanjen pokret: red odmah, tačka stoji |
| E5 | **Prijava poslata** (radnik šalje prijavu) | **Pečat** „Poslata“ (oblik statusne pilule, 1,25× veći, nagnut −4°) **pada** na „papir“ prijave: skala 1,25 → 1 + providnost za 140 ms, senka se stisne; Light haptika na dodiru. Ispod ostaje „Ako te izaberu, odmah nastaje Dogovor.“ | Bez novog crteža (tipografski pečat). Isti Pečat u E7 i E8: tako nastaje sistem. Smanjen pokret: pečat odmah, haptika ostaje |
| E6 | **Dogovoreno!** (naručilac izabere prijavu) | Dve figure znaka (zelena i narandžasta) se **spoje**, rukovanje „klikne“ (~500 ms, kritično prigušena opruga, bez odskoka); Confirm / Success haptika na spoju; zatim tri „karte“ stižu redom: osoba, termin, iznos (statični); „Otvori Dogovor“. „Dogovoreno!“ | `BrandRaster.tsx` već deli znak na delove (`BrandRasterMark part`), pa nije potreban novi crtež (K). Znak iz uvoda kao lik trenutka (uvod se ne menja): F3. Kad stigne Lottie V28, menja se samo lik. Smanjen pokret: spojeno odmah |
| E7 | **Potvrđeno** (naručilac potvrdi završetak) | U traci koraka linija se **povuče** do poslednje tačke (skala po X, 240 ms), tačka postaje kvačica; Success haptika; ispod se otvara „Kako je prošla saradnja?“. „Potvrđeno.“ (bez „Bravo!“) | Samo transform. Smanjen pokret: završno stanje |
| E8 | **Ocena** (prva data i prva primljena) | Zvezdice se pune jedna za drugom (3 × 60 ms) sa tikom po zvezdici (`select`); posle čuvanja Pečat „Ocenjeno“ + „Hvala. Ocena pomaže sledećem.“; prvi put još „Prva ocena.“. Kad stigne prva primljena: kartica na Početnoj „Stigla je prva ocena: ★ 5“ (stvarni podaci) | Ocena se posle čuvanja ne menja i poruka to kaže (postojeće pravilo). Pečati i priznanja na profilu: F7 |
| E9 | **Mirno je** (ništa ne čeka tvoju odluku) | Umesto sive kvačice u krugu: mali predmet (kalendar ili sat) sa jednim dolaskom (providnost 240 ms) i „Sve je sređeno.“ + „Ništa ne čeka tvoju odluku.“; bez petlje, bez haptike | Najčešće stanje, zato najtiše. Smanjen pokret: bez dolaska |
| E10 | **Nije poslato → poslato** (poruka nije stigla, pa je ponovo poslata) | Balon koji nije stigao je blago ružičast sa „Pošalji ponovo“; kad uspe, boja se **smiri** u običnu (ukrštanje dva sloja, 240 ms) i pojavi kvačica; ništa se ne pomera (čet ne pomera ništa); Success haptika samo za ponovno slanje koje je čovek pokrenuo. „Poslato.“ | Negativni vrhunac se ublažava iskrenošću i mirom (Uber primer u [L1]). Smanjen pokret: boja odmah |

## F. Šta traži vlasnika (9 odluka, po uticaju)

1. **F1 Pravac u pet rečenica (D2)** — potvrda slikama na prvoj tabli (D6), ne rečima.
2. **F2 Odskok (D3 iz MOTION specifikacije)** — jedan namerni „skok/pop“ samo u trenucima (uskok #11, pečat, Dogovoreno) ili ostajemo bez odskoka.
3. **F3 Znak iz uvoda kao lik u „Dogovoreno!“** (uvod se ne menja) i nove poze lika; vlasnikovi Lottie fajlovi V28 se još čekaju.
4. **F4 Predmet iz zadatka na kartici** (ormar, trava): krši li to „kategorija se ne prikazuje“ (PKG-031)? Ako da, kartica ostaje bez predmeta.
5. **F5 Jedan „Display“ rez pisma** (nova datoteka, OFL, bez paketa) samo za velike brojeve i naslove: da ili ne.
6. **F6 Zvuk za „Dogovoreno!“**: da ili ne (podrazumevano isključen; `expo-audio` je odobren samo za glas).
7. **F7 Pečati i priznanja na profilu** (agregat oznaka iz ocena, prvi završen Dogovor): da ili ne. Pravno i privatnost: nikakvo obećanje anonimnosti, samo stvarni podaci.
8. **F8 Novi crteži**: ko ih pravi i uz koji trošak. Plaćeni generator je svaki put posebna odluka (R16). Predlog za prvi krug: nijedan novi (E3, E6, E9 koriste postojeće).
9. **F9 Budžet**: potvrda 10 vrhova + 5 heroja + 8 praznih stanja (23 mesta) i prozor „sad“ za proveru na telefonu.

## G. Šta nisam mogao da proverim

- **Snimci** su web prikaz laboratorije na izmišljenim podacima, ne telefon: nema tvrdnji o osećaju pokreta, haptike ni brzine. `StateView.tsx` u stablu je noviji od snimaka praznih stanja (A2.4). Nisam video R1 i R2.
- **Nedostupno ili samo naslov:** `m3.material.io`, `airbnb.design` (preusmerava na početnu), `base.uber.com` (nije otvorena), Polaris stranica ilustracija (preusmerena), Atlassian dizajn (prazna), `design.duolingo.com` (preusmerava), Forrester „signature moments“ (404), NN/g Kano i mikrotekst (404), Material 2 prazna stanja (samo naslov), Apple vesti 2024 (404; 2024 iz stranice nagrada), FWA (nisam proverio), „Behind the Design“ (nisam našao). HIG HTML vraća samo naslov, pa je korišćen JSON.
- **Sekundarno** (samo isečak pretrage ili treća strana): Airbnb 3D ikone, Uber Base, Things 3, Kano, signature moments, claymorphism (stanje trenda), Red Dot / Webby / Google Play, „jedna stvar koju će pamtiti“, poze Duolingo likova, Refactoring UI (samo javni spisak saveta; knjiga nije čitana). Wikipedia (Alegria) je enciklopedija, ne istraživanje.
- **Tvrdnje sa ograničenjem:** „do 4× brže“ je Googleovo sopstveno istraživanje (metodologiju nisam video) [G1]; NN/g studija tona ima 50 ispitanika [N8]; članci o homogenizaciji [G2, G8] su stari (2016, odnosno više od decenije), pa važe samo kao uzroci. Procene truda, agent-sati i budžet 23 mesta su moji (T); performanse nisam merio.

## H. Izvori

| ID | Izvor | Adresa | Status |
|---|---|---|---|
| H1–H15 | Apple HIG: typography (H1), color (H2), materials (H3), motion (H4), playing-haptics (H5), onboarding (H6), writing (H7), loading (H8), launching (H9), sheets (H10), branding (H11), layout (H12), feedback (H13), generative-ai (H14), privacy (H15) | `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<strana>.json` | pročitano |
| W18 | WWDC18 „Designing Fluid Interfaces“ | `https://developer.apple.com/videos/play/wwdc2018/803/` | pročitano (sažetak stranice) |
| G1 | Google: istraživanje M3 Expressive | `https://design.google/library/expressive-material-design-google-research` | pročitano |
| A1 | Android: principi haptike | `https://developer.android.com/develop/ui/views/haptics/haptics-principles` | pročitano |
| N1–N10 | NN/g: prazna stanja (N1) `articles/empty-state-interface-design/`, postepeno otkrivanje (N2) `progressive-disclosure/`, vizuelna hijerarhija (N3) `visual-hierarchy-ux-definition/`, aesthetic-usability (N4) `aesthetic-usability-effect/`, kartice (N5) `cards-component/`, mikrointerakcije (N6) `microinteractions/`, onboarding tutorijali (N7) `onboarding-tutorials/`, ton glasa (N8) `tone-of-voice-dimensions/`, skeuomorfizam (N9) `skeuomorphism/`, forme (N10) `web-form-design/` | `https://www.nngroup.com/articles/<…>` | pročitano |
| R1 | Refactoring UI | `https://refactoringui.com/` | pročitano (javni spisak saveta) |
| L1–L4 | Laws of UX: peak-end (L1) `peak-end-rule`, Von Restorff (L2) `von-restorff-effect`, Doherty (L3) `doherty-threshold`, Jakob (L4) `jakobs-law` | `https://lawsofux.com/<…>/` | pročitano |
| S1 | Stripe: pristupačni sistemi boja | `https://stripe.com/blog/accessible-color-systems` | pročitano |
| S2 | Linear: kako smo redizajnirali UI | `https://linear.app/now/how-we-redesigned-the-linear-ui` | pročitano |
| S3 | Duolingo: shape language | `https://blog.duolingo.com/shape-language-duolingos-art-style/` | pročitano (+ isečak o posama likova) |
| S4 | Mailchimp: glas i ton | `https://styleguide.mailchimp.com/voice-and-tone/` | pročitano |
| S5 | Shopify Polaris: prazna stanja | `https://polaris-react.shopify.com/components/layout-and-structure/empty-state` | sekundarno (isečak; stranica preusmerena) |
| S6 | Uber Base (treća strana) | `https://www.superdesign.dev/blog/uber-design-system` | sekundarno |
| S7 | Airbnb 3D ikone (treća strana); Lottie 2017 | `https://superdesign.dev/blog/airbnb-design-system`; `https://www.androidpolice.com/2017/02/02/lottie-airbnbs-new-open-source-tool-effortlessly-creating-app-animations/` | sekundarno (Airbnb vest `news.airbnb.com/product-releases/airbnb-2025-summer-release/` pročitana, ne pominje 3D ikone) |
| S8 | Things 3, opis aplikacije | `https://apps.apple.com/us/app/things-3/id904237743` | sekundarno |
| P1 | Apple Design Awards 2023–2026 | `https://developer.apple.com/design/awards/`, `…/awards/2024`, `https://www.apple.com/newsroom/2023/06/apple-announces-winners-of-the-2023-apple-design-awards/`, `…/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/`, `…/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/` | pročitano |
| P2 | Awwwards `https://www.awwwards.com/about-evaluation/` (pročitano); Webby `https://www.webbyawards.com/judging-criteria/`, Red Dot `https://www.red-dot.org/`, Google Play `https://blog.google/products/google-play/best-apps-games-2025/` | — | Awwwards pročitano; ostalo sekundarno |
| G2 | AIGA Eye on Design (Gosling, 2016): zašto je dizajn aplikacija homogen | `https://eyeondesign.aiga.org/why-app-design-has-become-homogenous-and-how-we-can-fix-it/` | pročitano (staro) |
| G3 | Corporate Memphis | `https://en.wikipedia.org/wiki/Corporate_Memphis` | pročitano (enciklopedija) |
| G4 | Smashing: claymorphism (2022) | `https://smashingmagazine.com/2022/03/claymorphism-css-ui-design-trend/` | pročitano |
| G5 | Kano: oduševljenja postaju očekivanja | `https://www.kanosurveys.com/articles/delighters-in-the-kano-model` | sekundarno |
| G6 | „Signature moments“ (Forrester, Constellation) | `https://go.forrester.com/blogs/15-10-14-differentiate_your_customer_experience_with_signature_moments` (404); `https://www.constellationr.com/media/moments-mattermake-yours-iconic-soon-yu` | sekundarno (isečak) |
| G7 | „Jedna stvar koju će pamtiti“ (uputstvo frontend-design) | `https://skills.sh/anthropics/skills/frontend-design` | sekundarno |
| G8 | VentureBeat: zašto se aplikacije osećaju isto | `https://venturebeat.com/technology/why-all-your-apps-feel-the-same` | pročitano (staro) |
| — | Ranije specifikacije i kod u ovom stablu (K) | `docs/implementation/ui-ux-pass-20261002/{KOMPOZICIJA_I_RITAM,MOTION_I_POLISH,UX_PLAN_PO_EKRANIMA,TALASI_REDOSLED}_*.md`, `OWNER_START_AND_COMPLAINTS_20261002.md`; `src/ui/system/{StateView,SuccessMark,CatalogMoment,Avatar}.tsx`, `src/ui/entry/BrandRaster.tsx`, `assets/illustrations/PROVENANCE.json` | pročitano |

