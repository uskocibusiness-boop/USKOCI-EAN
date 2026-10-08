# Analiza ekrana sa vlasnikovog telefona, 8. oktobar 2026 (APK 6a7b7ac, posle talasa W)

**Izvor.** 42 snimka sa vlasnikovog telefona (12:24–12:30), poslata u četiri grupe, i njegove poruke. Snimci su u sesiji (`.claude/uploads/76affeda…/`), spisak sa opisom po slici je u `scratchpad/VLASNIK_TELEFON_20261008.md`; ekrani koje nije slikao gledaju se u dizajn-laboratoriji pri 361 dp (njegov telefon). Ovo je analiza i plan; dokaz da nešto radi na telefonu daje samo novi APK na telefonu.

**Vlasnikove reči (doslovno, piše glasom) i moje čitanje.**
- „Ima. Nnogo pdulapnih kanri lsieg rapsored slabe pregl3nxsot prrv8se trsks premalo ajsnive natrpano nel9givnih ifna neka ajdnice nema lakoce.... Detlsjni svr naizraj i. Vidi kao svski enrsn i. Tok ze da d eussvri unaoredi slricto mapa“ → *Ima mnogo duplih kartica, loš raspored, slaba preglednost, previše teksta, premalo jasnoće, natrpano, nelogičnih informacija, nema jednostavnosti, nema lakoće. Detaljno sve analiziraj, vidi svaki ekran i tok, da se usavrši i unapredi, isto i mapa.*
- „Sve ekrane pogledaj anaizraj i gledaj gde sta ne valja sta nije po stsndsrdima sta priduc ahrit4ja u strucbi aitbin tim i spple. Tim n3 binrsriki sts bi ikako an ekrane dodali orazivisli po potrrbi oriscrja sta bi nsprsvili kso kdosle prek oekrana kad treba ds se kristi itd“ → *Pogledaj i analiziraj sve ekrane: šta ne valja, šta nije po standardima, šta bi uradio produkt-arhitekta iz struke, Airbnb tim i Apple tim. Ne generički: šta bi i kako dodali na ekrane, osmislili po potrebi korisnika, šta bi napravili, kako idu tokovi preko ekrana, kad se šta koristi.*
- Za mapu posebno: vidi `scratchpad/lab/ZADACI_MAPA_ZADATAK.md` (njegove reči i ugovor ponašanja).

## 1. Dijagnoza: zašto aplikacija deluje nepregledno

Nije problem jedan ekran. Pet istih grešaka se ponavlja svuda, pa se zbir oseća kao „natrpano i nelogično“.

1. **Ista stvar na više mesta.** Raspored ima tri ulaza (Početna, Dogovori, Profil) i u sebi ponavlja Moje zadatke i Moje prijave. Područje rada i Dostupnost stoje i na Profilu i u Radnom profilu. „Mogu odmah“ je na Početnoj nazvano „Slobodan sam sada“. Privatnost i podaci stoji i u Profilu i u Izmeni profila. Podešavanja obaveštenja u oba taba ponavljaju iste globalne blokove (telefon, obaveštenja u aplikaciji, tihi sati). Zadaci prikazuju „Svi zadaci“ dvaput (pilula i prekidač).
2. **Tekst objašnjava umesto da kaže.** Skoro svaki red ima rečenicu-opis ispod naslova („Privatni zahtevi, odgovori i ponovni pregled.“, „Verzija aplikacije se upisuje sama.“, „Isključivanje ne briše listu obaveštenja.“, „Čekaš prijave. Vidiš ih ovde i u zvoncu.“, „· Otvara Dogovor“). Ekrani o privatnosti i pravilima su zidovi rečenica „…još nije dostupno“.
3. **Nelogične informacije.** „Dogovoren“ i odmah iznad „Termin nije dogovoren“. Zadatak „Od 9. okt · 17:00“ u grupi „Bez tačnog termina“. AI u izmeni kaže „potvrdiš objavu“, posle „Razgovor je završen“, a polje za kucanje i dalje stoji. „Dogovoreno 0/1“ i „0/1“ na kartici. Obaveštenja „Dogovor je otkazan“ ne kažu koji zadatak. „Grad“ ima strelicu, a piše da se menja negde drugde. „Mogu odmah · dostupnost“.
4. **Jedna stvar, više reči.** „Fleksibilan raspon“, „Fleksibilan termin“, „Fleksibilno“; „Tražiš ponude“ / „Tražim ponude“; „Slobodan sam sada“ / „Mogu odmah“; „Novi Sad“ / „Novi sad“.
5. **Tehničke greške koje kvare utisak.** Datum „09. okt“ (Android piše dvocifren dan — **popravljeno** u `calendarPresentation.displayDate`, test dodat); fotografija profila čas se vidi čas ne (zaglavlje „M“ pa fotografija); fotografija u **ovalu**; siva prazna kutija umesto fotografije zadatka; bela tačka na prekidaču Aktivni/Završeni; podnaslov taba u Podešavanjima obaveštenja providan, pa se sadržaj vidi kroz njega; „Filteri“ izlazi preko ivice; muški rod „Slobodan sam“.

## 2. Pravila jednostavnosti (standard za svaki ekran; ovo proveravamo, ne ukus)

| # | Pravilo | Kako se vidi da je ispunjeno |
|---|---|---|
| J1 | **Jedna stvar, jedno mesto.** Svaka radnja i svaki podatak ima jedan dom; drugi ekrani vode tamo, ne ponavljaju ga. | Nijedan red/odeljak se ne pojavljuje na dva ekrana istog toka osim brze prečice istog imena (npr. „Mogu odmah“ na Početnoj i u Dostupnosti — isto ime, isto stanje). |
| J2 | **Jedno ime za jednu stvar.** „Mogu odmah“, „Fleksibilno“, „Tražim ponude“, „Termin nije dogovoren“, „Dogovor“, „Prijava“, „Zadatak“. | Pretraga izraza u kodu nalazi jedan oblik. |
| J3 | **Bez meta-teksta.** Nikad „Otvara…“, „Vidiš ih ovde…“, „…se upisuje sama“, „Isključivanje ne briše…“. Red i dugme sami kažu šta rade. | 0 takvih rečenica. |
| J4 | **Podnaslov reda samo kad nosi podatak** (stanje, broj, ime, mesto, vreme). Opis nikad. | Red bez podatka ima samo naslov. |
| J5 | **Najviše jedna rečenica objašnjenja po ekranu**, samo kad bez nje ne bi znao šta da radiš ili kad je pravno/privatnosno obavezna. | Brojanje rečenica po ekranu. |
| J6 | **Nedostupno se ne crta kao funkcija.** Ako je pravno obavezno reći, jedna mirna rečenica (iskrenost ostaje: AGENTS 3.4.5). | Nema više od jednog „nije dostupno“ po ekranu. |
| J7 | **Vrh ekrana:** naslov + najviše JEDAN red kontrola; sadržaj počinje u gornjoj trećini. | Snimak 361 dp. |
| J8 | **Red liste:** naslov 1 red (najviše 2), jedan red podatka, vreme desno; pregled poruke 1 red. | Snimak. |
| J9 | **Svaki red o zadatku kaže KOJI zadatak** (obaveštenja, raspored, poruke, Čeka te). | Gde podatak postoji, naslov zadatka je vidljiv. |
| J10 | **Datum** „9. okt“, „Danas“, „Juče“; 24 h; zona samo uz dogovoreni termin. | Test `displayDate`. |
| J11 | **Bez roda:** „Mogu odmah“, „Nema tvojih zahteva“ (ne „Slobodan sam“, ne „nisi poslao“). | Ratchet za muški/ženski oblik u novom tekstu. |
| J12 | **Prazno stanje:** predmet, jedna rečenica, najviše jedno dugme koje nešto menja; nikad samo „Proveri ponovo“ (osvežava se povlačenjem). | Snimak. |
| J13 | **Lice i fotografija:** uvek krug; dok se učitava inicijal, ne siva ploča; ista fotografija svuda. | Snimak + test oblika. |
| J14 | **Kontrola koja ništa ne radi se ne crta**; red sa strelicom vodi tamo gde se stvar menja. | Svaki red sa strelicom ima odredište. |
| J15 | **Važne radnje se VIDE na ekranu.** Meni „⋯“ nikad nije jedini put do izmene, otkazivanja ili prijave problema; svaka radnja ima jedno mesto (J1), pa ako je vidljiva na ekranu, ne ponavlja se u „⋯“. „⋯“ ostaje samo za retko (npr. podeli). | Na snimku ekrana vide se sve radnje koje taj ekran ima. |

Vlasnik, 12:57 (posle prve analize, uz slike menija „⋯“ na Mom zadatku i na Dogovoru): „Nije slozeno masa stari lepo cisto pregledno i rsnzivovano nego je nabac trkst podupnae kosnde. Tid... Video si i ssm obrsti. Oanju ca k9metan app... Iid koki su lsoe naorav3n3 kande ive ja tri tavkije i jedva se nadju... Nema lakod vtianantoakzivanjazatata preged zadstka uzasni jenasan itd..“ → *Nije složeno lepo, čisto, pregledno i organizovano, nego je nabacan tekst, duplirane komande. Video si i sam. Pažnju na kompletnu aplikaciju… Vidi koliko su loše napravljene komande, ove sa tri tačkice, i jedva se nađu… Nema lakog otkazivanja zadatka, pregled zadatka užasan, itd.* Odatle J15.

## 3. Tokovi (kako bi ih postavio vrhunski tim)

**T1. Tražim pomoć.** Početna „Objavi zadatak“ → razgovor sa asistentom → pregled → objava („Objavljeno“) → moj zadatak čeka → obaveštenje „Nova prijava · *naslov*“ → prijave → izbor → „Dogovoreno!“ → Dogovor (poruke, termin) → gotovo → ocena.
*Gde puca danas:* moj zadatak ne vodi jasno ka prijavama (rečenica „Vidiš ih ovde i u zvoncu“ umesto lica i broja); obaveštenja ne kažu koji zadatak; izmena zadatka priča o „objavi“ i ostavlja polje za kucanje posle kraja.
*Šta radimo:* na mom zadatku jedan blok stanja: „Još nema prijava“ ili lica + „3 prijave“ + jedino zeleno dugme „Pogledaj prijave“; obaveštenje uvek sa naslovom zadatka kad ga podaci imaju; izmena: posle kraja razgovora nestaje polje, ostaje jedno dugme „Pregledaj izmene“.

**T2. Uskačem.** Početna „Uskoči i zaradi“ → Zadaci (mapa) → pin → kartica → detalj → „Pošalji ponudu“ → „Prijava je poslata“ → Moje prijave → izbor → Dogovor → termin → gotovo → ocena.
*Gde puca:* mapa se ne vidi, zadaci van mape se ne nalaze, kontrole guše listu (zadatak Z).

**T3. Šta me čeka.** Danas četiri mesta govore isto (Čeka te, Raspored, Obaveštenja, Poruke). *Podela posla:* **Čeka te** = samo ono što TI moraš da uradiš (najviše 3, svaka sa naslovom zadatka i jednom radnjom); **Raspored** = samo dogovoreni termini (Dogovori), ništa drugo; **Obaveštenja** = istorija događaja; **Poruke** = razgovori.

**T4. Nalog.** Profil je spisak od 13 redova sa opisima. *Šta radimo:* tri kratka odeljka, podnaslov samo sa podatkom, ono što pripada Radnom profilu ide u Radni profil.

## 4. Ekran po ekran

Oznake: **Ne valja** (iz slika), **Radimo** (odluka), **Dodajemo** (šta bi dodao vrhunski tim, samo iz postojećih podataka). Vlasnikovi izbori sa table (Početna B, Kartica A, Detalj A, Profil A, Moji zadaci A, prazna stanja A…) ostaju; ovde se popravlja izvođenje.

### Zadaci (mapa + lista) — zadatak Z, poseban ugovor
Vidi `scratchpad/lab/ZADACI_MAPA_ZADATAK.md`: velika mapa, lista dole, navigacija sakrivena dok je lista dole, pilula pretrage i ODVOJENI filteri, kapsule gore (kao 7. 10.), lak pristup zadacima van mape, kartica pina skroz dole, lista do vrha, „moja lokacija“ centrira, bez +/−, bez „0/1“.

### Početna
- **Ne valja:** kartica „Predloži termin“ ponavlja istu misao („Termin još nije dogovoren.“); red nacrta ima dve rečenice za jedno („Nastavi nacrt / Nacrt još nije objavljen.“); odeljak „Raspored — 1 Dogovor bez tačnog termina“ je prazan sadržaj; „Moji zadaci · 1 nacrt“ ponavlja nacrt; „Slobodan sam sada“ (rod, drugo ime) + „Uključeno. Važi dok ga ne isključiš.“; zaglavlje čas „M“ čas fotografija.
- **Radimo:** Čeka te: naslov radnje + naslov zadatka, bez treće rečenice; nacrt jedan red „Nastavi nacrt“ ispod naslova; slab red rasporeda (bez vremena) se NE crta — veliko vreme sledećeg Dogovora (izbor B) samo kad postoji; „Mogu odmah“ (isto ime kao Dostupnost), podnaslov samo „Uključeno“/ništa; „Moji zadaci“ i „Moje prijave“ ostaju kao dva reda sa brojem.
- **Dodajemo:** kad moj objavljeni zadatak ima nove prijave, u Čeka te red „2 prijave · *naslov*“ (podatak postoji: `homeAttentionClientService` `applicationCount`).

### Moj zadatak (detalj, kao naručilac)
- **Ne valja:** „Čekaš prijave. Vidiš ih ovde i u zvoncu.“; „Tražim ponude“ kao naslov odeljka + rečenica „Svako u prijavi predlaže ukupan iznos.“; „Dogovoreno 0/1“; velika siva kutija sa tačkom umesto fotografije; na mapi znak aplikacije kao oznaka, „Otvori mapu“ prekriva mapu, krupan natpis izvora mape u dva reda ispod nje; „Na jednom mestu · Srbija“; dugačka rečenica o privatnosti.
- **Radimo:** blok stanja na vrhu: „Još nema prijava“ / lica + broj + „Pogledaj prijave“ (jedina zelena radnja); iznos kao red sa sličicom (isto kao kartica: „Tražim ponude“ ili iznos, bez rečenice); broj ljudi samo kad je > 1 („Treba 3 osobe“); fotografije: dok se učitavaju sličica-mesto, ako ne mogu — ne crtaju se (bez prazne ploče); mapa sa običnim pinom mesta, dugme za veliku mapu malo u uglu, natpis izvora mali u jednom redu; privatnost jedna rečenica „Tačnu adresu vidi samo osoba sa kojom se dogovoriš.“; „Na jednom mestu · Srbija“ ukloniti ili zameniti stvarnim mestom.
- **Dodajemo:** „Objavljen pre 2 sata“ (vreme objave postoji) kao tihi podatak; meni „⋯“ ostaje za izmenu/otkazivanje.

- **Radnje (J15, vlasnik 12:57):** „Izmeni zadatak“ i „Otkaži zadatak“ su danas samo u „⋯“ i jedva se nađu. Na ekranu: „Izmeni zadatak“ kao vidljiva sporedna radnja uz blok stanja, „Otkaži zadatak“ kao crveni red na kraju stranice (uz postojeću potvrdu pre otkazivanja); „⋯“ nestaje ako u njemu ništa drugo ne ostane.

### Dogovor (detalj, tab „Pregled“) — vlasnik 12:57, slika menija
- **Ne valja:** sve radnje osim glavne su u „⋯“ (Izmeni uslove, Prijavi problem, Otkaži Dogovor, Prijavi ili blokiraj osobu); koraci se lome usred reči („Dogovore / no“, „Zadatak je / gotov“); objašnjenje od dve rečenice iznad koraka („Kada završiš, izaberi … Druga strana tada potvrđuje…“).
- **Radimo:** glavna radnja koraka (npr. „Zadatak je gotov“) je jedino zeleno dugme; ispod sadržaja odeljak radnji kao redovi sa sličicom: „Izmeni uslove“, „Prijavi problem“, pa odvojeno crveni „Otkaži Dogovor“ i „Prijavi ili blokiraj osobu“ (iste potvrde i tokovi kao danas); „⋯“ nestaje ili ostaje samo za retko; koraci sa kratkim natpisima koji se ne lome („Dogovoreno · Gotovo · Potvrđeno · Ocena“, svaki u jednom redu pri 1,15, pri 1,3 najviše dva reda celim rečima); objašnjenje jedna rečenica („Kad završiš, dodirni „Zadatak je gotov“.“). Vlasnikov raniji izbor „Dogovor (detalj): ostaje kako je“ zamenjen je ovom kasnijom primedbom samo u ovome (radnje, koraci, tekst); izgled ostaje.

### Izmena zadatka (razgovor sa asistentom)
- **Ne valja:** natpis „• Izmena“ iznad naslova (eyebrow); četiri slike bez teksta; „Tražim ponude | Pregledaj izmene“ u dve uske kolone; asistent kaže „…i potvrdiš objavu“ u izmeni; posle „Razgovor je završen“ i dalje stoji „Opiši šta ti treba“.
- **Radimo:** kartica nacrta: naslov + činjenice sa vrednostima (ili bez kartice dok razgovor traje), bez eyebrow-a; kad je razgovor završen: polje za kucanje nestaje, ostaje jedno zeleno „Pregledaj izmene“; tekst kraja u izmeni: „Otvori pregled izmena. Tamo ih potvrđuješ.“ (ako tekst dolazi sa servera, napiši tačno gde i predloži izmenu — server ne diramo).

### Obaveštenja
- **Ne valja:** red „18:54 · Otvara Dogovor“ (meta); dva ista reda „Dogovor je otkazan“ bez imena zadatka; „05. okt“ (popravljeno); siva ikona razgovora.
- **Radimo:** red = događaj (naslov) + **naslov zadatka** kad ga podaci imaju (`inboxTaskTitle`), inače telo poruke; vreme desno; bez „Otvara…“ (pristupačni opis „Otvara Dogovor“ ostaje SAMO za čitač ekrana); ikone u boji uloge (2.5D).
- **Server (za vlasnika/posebni paket):** događaji otkazivanja Dogovora i zadatka nemaju `taskTitle` u metapodacima, pa red ne može da kaže koji je zadatak; predlog paketa: upisati `taskTitle` u metapodatke svih obaveštenja o zadatku/Dogovoru (dokazati na jednokratnoj bazi, pa po stalnom nalogu „PRIMENJUJ DOKAZANE PAKETE SAM“).

### Podešavanja obaveštenja
- **Ne valja:** naslov u dva reda; tabovi „Moji zadaci | Moje prijave“, a u oba isti globalni blokovi (telefon, obaveštenja u aplikaciji, tihi sati); pet sivih objašnjenja; providan lepljivi podnaslov kroz koji se vidi sadržaj; „Stanje slanja na telefon još nije potvrđeno.“
- **Radimo:** JEDAN ekran bez tabova: „Ovaj telefon“ (jedan red stanja + jedno dugme „Poveži ovaj telefon“ dok nije povezan), „Kad objavljuješ zadatke“ (Prijave i poruke; Ostalo), „Kad uskačeš“ (Novi zadaci; Prijave i poruke; Ostalo), „Tihi sati“, „Napredno“; jedna rečenica na dnu: „Ono što isključiš ne stiže ni u aplikaciju ni na telefon.“; kraći naslov „Obaveštenja“ ako ekran nije sam inbox (inače „Podešavanja“). Vrednosti i čuvanje ostaju isti (samo raspored).

### Poruke
- **Ne valja:** red visok: ime u dva reda, pregled poruke u četiri reda, naslov zadatka, datum; katanac bez objašnjenja; bela tačka na prekidaču; prazno ispod jednog reda.
- **Radimo:** red: lice 48, ime (1 red) + vreme desno, pregled 1 red, naslov zadatka 1 red sivo; katanac nestaje (tab „Završeni“ već kaže da je zatvoreno); tačku na prekidaču ukloniti (sistemska komponenta — vidi raspodelu).

### Raspored
- **Ne valja:** meša moje objavljene zadatke, prijave i Dogovore („1 Dogovor · 6 zadataka“); tri izraza za fleksibilno; „Termin nije dogovoren“ iznad „✓ Dogovoren“; zadatak sa datumom u „Bez tačnog termina“; čipovi Sve/Dogovori/Moji zadaci/Moje prijave (četvrti odsečen); crtice i tačkasti krug ispod dana bez značenja; „Četvrtak, 08. okt“ (popravljeno).
- **Radimo:** Raspored = **samo Dogovori** (dogovoreni termini, obe uloge) — kako i sam kaže u Profilu („Dogovoreni termini“); čipovi nestaju; odeljak „Termin još nije dogovoren“ za Dogovore bez termina, svaki sa radnjom „Predloži termin“; oznaka ispod dana = tačka samo za dan sa Dogovorom; jedan izraz „Fleksibilno“. Moji objavljeni zadaci i prijave ostaju u Mojim zadacima i Mojim prijavama.
- **Ulaz:** jedan dom = Dogovori (dugme „Raspored“ tamo već postoji); red „Raspored“ sa Profila i odeljak sa Početne se uklanjaju (Početna zadržava samo veliko vreme sledećeg Dogovora).

### Profil
- **Ne valja:** „M“ iako fotografija postoji; treći broj „Još nema procenta“ krupno u dva reda (pravilo prenosa izbora kaže: čega nema, ne crta se); „Novi Sad“ gore i „Novi sad“ u redovima; Područje rada i Dostupnost i Raspored dupliraju Radni profil i Dogovore; dve različite brave; podnaslovi-opisi; „Odjavi se“ daleko i crveno pored praznog prostora.
- **Radimo:** zaglavlje: fotografija (pouzdano), ime, grad (prikaz sređen: „Novi Sad“), brojevi: ocena + završeno, treći samo kad postoji; odeljci: **Uskakanje** (Radni profil — podnaslov „Aktivan · Moleraj · Novi Sad, 100 km“), **Nalog** (adresa e-pošte kao tihi red, Obaveštenja, Promeni lozinku, Podrška, Prijavi grešku), **Privatnost** (Privatnost i podaci, Blokirane osobe, Izvoz podataka, Pravila i saglasnosti), O aplikaciji („Verzija 1.0.0“), Odjavi se; podnaslov samo sa podatkom (npr. Blokirane osobe „Nema“ / „2 osobe“, Izvoz „Nije tražen“), jedna brava (ista sličica za privatnost).
- **Dodajemo:** red „Kako te drugi vide“ → javni profil (postojeći `PublicProfileSheet`), standard Airbnb-a.

### Izmeni profil
- **Ne valja:** posebno sivo dugme „Sačuvaj ime“ + „Ovo ime je već sačuvano.“; „Grad“ sa strelicom koja ne menja grad; pasus „Javno i privatno“ od pet redova; red „Privatnost i podaci“ (već u Profilu); „M“ bez fotografije.
- **Radimo:** ime se čuva jednim dugmetom koje se pojavi tek kad se ime promeni (ili „Sačuvaj“ u zaglavlju); „Grad“ vodi u Područje rada (ili se ne crta kao red ako nema gde da vodi); privatnost jedna rečenica „Ime, fotografija, grad i ocene vide drugi.“; red Privatnost i podaci uklonjen.

### Fotografija profila
- **Ne valja:** slika u ovalu; siva ploča sa vrtešcom pri učitavanju; „Ukloni fotografiju profila“ uvučeno; tekst pominje „Sačuvaj fotografiju“ kog na ekranu nema.
- **Radimo:** krug (jednaka širina i visina); dok se učitava inicijal u krugu; poravnato dugme; tekst: „Do 10 MB. Pre slanja uklanjamo podatke o mestu i vremenu snimanja.“ — rečenica o „Sačuvaj fotografiju“ samo kad je nova slika izabrana.

### Radni profil
- **Ne valja:** „Mogu odmah · dostupnost“; sivi čip „samo informacija“; alat i vozila kao dugački nizovi sa tačkama (12 vozila u pet redova).
- **Radimo:** Dostupnost: „Mogu odmah“ ili sažetak nedelje; oprema: dva reda „Alat · 10“ i „Vozila · 12“ koji se otvaraju, ili čipovi sa „+7“; čip „samo informacija“ nestaje (ako znači da oprema ne utiče na izbor zadataka, jedna rečenica na ekranu opreme).

### Područje rada
- **Ne valja:** isti radijus na dva mesta (polje „100“ i čipovi 5–100 km); dugo dugme „Pronađi područje za uneti grad“.
- **Radimo:** jedan izbor radijusa (čipovi; vrednost koja nije među njima dobija svoj izabrani čip); grad + mapa; „Prikaži na mapi“; jedno zeleno „Sačuvaj“.

### Dostupnost za rad — uglavnom u redu; „Mogu odmah“ isto ime svuda.

### Podrška i Novi zahtev
- **Ne valja:** „Još nema primljenih zahteva“ (to su MOJI zahtevi); pri pomeranju tekst se seče ispod zaglavlja bez senke; podnaslov u Profilu „Privatni zahtevi, odgovori i ponovni pregled.“
- **Radimo:** „Nema tvojih zahteva.“; zaglavlje dobija pozadinu i tanku liniju kad sadržaj ode ispod; podnaslov u Profilu samo broj otvorenih zahteva kad ih ima.

### Privatnost i podaci, Pravila i saglasnosti, Izvoz, Blokirane osobe, O aplikaciji, Lozinka
- **Ne valja:** zidovi teksta; više „…nije dostupno“; Pravila: ceo ekran za jednu rečenicu + „Proveri ponovo“; Izvoz: slabi sivi koraci; Blokirane: „Proveri ponovo“; „AI“ izgleda kao „Al“ (slova I i l u fontu).
- **Radimo:** svaka činjenica ostaje (pravna iskrenost), ali: naslov odeljka + kratke tačke sa sličicom; sva „nije dostupno“ u jednu rečenicu po ekranu; Pravila: jedan red „Uslovi korišćenja i Politika privatnosti još nisu objavljeni.“ bez dugmeta; Izvoz: jedna rečenica + dugme, koraci samo kad je zahtev poslat; Blokirane: prazno stanje bez „Proveri ponovo“; O aplikaciji i Lozinka ostaju.

## 5. Raspodela posla (talas „Telefon 8. 10.“, svi agenti na Sonnet 5.5, nijedan Fable)

| Agent | Ekrani | Fajlovi (jedan pisac po fajlu) |
|---|---|---|
| Z | Zadaci (mapa + lista), kartica zadatka | `src/ui/v2/DiscoveryPresentation.tsx`, `src/ui/v2/discovery/**`, `DiscoveryMap*`, `TaskCard.tsx`, `TaskFace.tsx`, `(app)/zadaci.tsx`, `(app)/_layout.tsx` (samo traka na Zadacima), `dizajn-zadaci.tsx` |
| P | Početna, Raspored, Obaveštenja, Podešavanja obaveštenja, Poruke | `src/ui/home/**`, `(app)/index.tsx`, `src/ui/calendar/**` (osim `displayDate`, završeno), `(app)/raspored.tsx`, `src/ui/notifications/**`, `(app)/profil/obavestenja.tsx`, `src/ui/messages/**` lista, `(app)/poruke.tsx`, `dizajn-pocetna/kalendar/obavestenja/poruke` |
| R | Profil i nalog | `src/ui/profile/**`, `src/ui/workerProfile/**`, `src/ui/settings/**`, `src/ui/privacy/**`, `src/ui/support/**`, `src/ui/legal/**`, `(app)/profil.tsx`, `(app)/profil/**` (osim `obavestenja.tsx`), `(app)/podrska/**`, njihove galerije |
| T | Moj zadatak, izmena sa asistentom, Moji zadaci, prijave | `src/ui/v2/NeedPresentation.tsx`, `src/ui/v2/ownTask*.ts(x)`, `src/data/ownTaskStanding.ts`, `src/ui/v2/detail/**`, `src/ui/v2/IntakePresentation.tsx`, `src/ui/aiFirst/**`, `src/ui/location/**` (mapa u detalju), `(app)/potrebe/**`, `(app)/potrebe.tsx`, njihove galerije |
| D | Dogovor (detalj, radnje, koraci), lista Dogovora | `src/ui/v2/AgreementPresentation.tsx`, `src/ui/v2/AgreementThreadPresentation.tsx`, `src/ui/v2/AgreementCollectionPresentation.tsx`, `src/ui/agreements/**`, `src/app/dogovor/**`, `(app)/dogovori.tsx`, `dizajn-dogovori.tsx` |
| ja | sistemske komponente koje traže više porodica (lepljivo zaglavlje i sl.), `displayDate`, `usePullRefresh` (bela „tačka“ u Porukama je Androidov znak osvežavanja koji se dizao pri svakom čitanju u pozadini — NE `Segmented`), integracija, testovi, APK | `src/ui/system/**` po potrebi |

## 5a. Vlasnikove odluke posle analize
- **Jedno ime za sve** (8. 10., doslovno: „Može, dobro vam jedno ime za sve.“, na moje pitanje „jedno ime za sve, menja se samo u Ličnim podacima, kao Airbnb — ili posebno ime za rad?“). Danas se ime menja na četiri mesta (registracija, Izmeni profil „Ime za prikaz“, Radni profil „Ime na radnom profilu“, asistent za radni profil „Ime na profilu“), pa se vide dva imena („Milos“ i „Pera peric“). Ugovor: ime se menja samo u Izmeni profil i upisuje se i u nalog i u radni profil; polja imena u Radnom profilu i kod asistenta nestaju; postojeća razlika se usklađuje jednim dodirom osobe; registracija ostaje prvo upisivanje. Izvodi agent R.
- **Potrošnja:** „Nema potrebe da staješ, idi slobodno do 100%, samo nemoj da staješ.“ — pravilo zaustavljanja na 88 % je ukinuto.

## 6. Šta ostaje vlasniku
1. Paket „naslov zadatka u svakom obaveštenju“ (server, gore) — pripremam ga posle ovog talasa; primenjuje se po stalnom nalogu tek kad je dokazan.
2. Na ovoj verziji telefon NIJE povezan za obaveštenja („Ovaj telefon još nije povezan“): to se uključuje dugmetom „Poveži ovaj telefon“ u Podešavanjima obaveštenja (njegov telefon, njegova radnja).
3. Zvezda kao 2.5D crtež (njegov alat ili Codex) — nepromenjeno.
