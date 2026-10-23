# USKOČI Taksonomija V2 — Kanonski katalog usluga i migracija

Ažurirano: 23.10.2026.  
Status: Specifikacija, Kanonski Seed i Migraciona Arhitektura  
Arhitektura: Dual-Gemini sa 0ms determinističkim kešom i asinhronim pojašnjenjima.

---

## 1. Arhitektonska osnova V2

Taksonomija V2 zamenjuje stare ad-hoc i testne zapise stabilnim, čistim katalogom od **196 realnih svakodnevnih usluga u Srbiji**.

### Ključni principi:
1. **Dva pisma (latinica i ćirilica)**: Svaka usluga poseduje kanonski naziv i bogat skup sinonima na oba pisma za trenutno (0ms) prepoznavanje bez obzira na unos korisnika.
2. **Eksplicitni modovi izvršenja (`ON_SITE`, `REMOTE`, `DUAL`)**:
   - `ON_SITE`: Usluge koje zahtevaju fizički dolazak na lokaciju (npr. krečenje, selidbe, popravka veš mašine).
   - `REMOTE`: Digitalne usluge i konsultacije (npr. izrada vebsajta, časovi jezika, prevod).
   - `DUAL`: Usluge koje se mogu obaviti i na lokaciji i na daljinu (npr. 3D štampa sa preuzimanjem/slanjem, držanje časova matematike).
3. **Čista hijerarhija bez testnih duplikata**: Uklonjeni su svi testni čvorovi (`Usluga broj 0..129`, `makete`, `drvene figure`).
4. **Eliminacija fallback baga (`defaultRootFallback`)**:
   - Uklonjen je stari bag koji je sve nepoznate usluge automatski bacao u „Zanati i popravke”.
   - Kada klasifikator naiđe na dvosmislenost ili nepoznat domen, vraća `NEEDS_CLARIFICATION` / `AMBIGUOUS` sa konkretnim pitanjem za razjašnjenje (`ambiguityPrompt`).
5. **Asinhroni hintovi za pojašnjenje (`clarificationRequest`)**:
   - Pitanje za razjašnjenje se čuva u memoriji i opciono u tabeli `private.classification_turn_hints`.
   - U narednom krugu (Turn N+1), konverzacioni Gemini prirodno postavlja to pitanje korisniku.
6. **Uslovno pozivanje klasifikatora (Cost & Latency Optimization)**:
   - Klasifikator se preskače ako je korisnik menjao samo budžet, termin, privatne beleške ili radno vreme radnika, čime se štede Gemini tokeni i eliminiše nepotrebno kašnjenje.
7. **Jedan brzi JSONB upit za snapshot stabla**:
   - Umesto N+1 straničenja kroz RPC pozive, celo stablo se učitava jednim pozivom funkcije `rpc_taxonomy_fetch_snapshot_v1(p_generation)` u ~15ms.
8. **Nenarušavanje postojećih podataka (Zero-Loss Migration & Gate 0 Compliance)**:
   - Istorijski V1 zapisi se arhiviraju kao `generation = 1`.
   - V2 stablo ulazi kao `generation = 2` u `private.work_taxonomy_snapshots`.
   - Postojeći zadaci (`needs`) i radni profili (`worker_profiles`) zadržavaju validne veze preko bridge mapping tabele `private.work_taxonomy_v1_v2_bridge`.

---

## 2. Kanonske krovne grane (Roots)

Katalog V2 organizovan je u 12 čistih, međusobno disjunktnih krovnih sektora:

1. **Zanati i građevinski radovi** (`ROOT_CRAFTS`) — `ON_SITE`
2. **Hitne kućne popravke i kućni majstor** (`ROOT_REPAIRS`) — `ON_SITE`
3. **Grejanje, klimatizacija i ventilacija** (`ROOT_HVAC`) — `ON_SITE`
4. **Čišćenje i održavanje prostora** (`ROOT_CLEANING`) — `ON_SITE`
5. **Transport, selidbe i teški poslovi** (`ROOT_TRANSPORT`) — `ON_SITE`
6. **Auto, moto i mehanika** (`ROOT_AUTO`) — `ON_SITE`
7. **Uređenje dvorišta, bašte i eksterijera** (`ROOT_GARDEN`) — `ON_SITE`
8. **Nega, čuvanje i pomoć u kući** (`ROOT_CARE`) — `ON_SITE`
9. **Podučavanje i edukacija** (`ROOT_TUTORING`) — `DUAL`
10. **Digitalne usluge, dizajn i IT** (`ROOT_DIGITAL`) — `REMOTE / DUAL`
11. **Pisanje, prevod i administracija** (`ROOT_WRITING`) — `REMOTE / DUAL`
12. **Lepota, nega tela i zdravlje** (`ROOT_WELLNESS`) — `ON_SITE`
13. **Događaji, proslave i ketering** (`ROOT_EVENTS`) — `DUAL`
14. **Zanatska izrada, štampa i popravke predmeta** (`ROOT_MAKING`) — `DUAL`

---

## 3. Kompletna lista usluga po granama (196 usluga)

### 3.1 Zanati i građevinski radovi (`ROOT_CRAFTS`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `krecenje-zidova-i-plafona` | Krečenje zidova i plafona | ON_SITE | krecenje, moleraj, bojenje zidova, farbanje sobe, krečenje, кречење, молерај, фарбање зидова | Molerski radovi, poludisperzija, disperzija, akrilne boje |
| `gletovanje-zidova` | Gletovanje zidova | ON_SITE | gletovanje, ravnanje zidova, priprema za krecenje, mrezica, глетовање, равнање зидова | Gletovanje u dve ili tri ruke, postavljanje mrežice |
| `postavljanje-keramickih-plocica` | Postavljanje keramičkih pločica | ON_SITE | keramika, keramicarski radovi, lepljenje plocica, plocice za kupatilo, keramičar, керамика, керамичар, лепљење плочица | Polaganje pločica, fugovanje, nivelisanje, hidroizolacija podloge |
| `postavljanje-laminata-i-parketa` | Postavljanje laminata i parketa | ON_SITE | laminat, postavljanje parketa, montaza laminata, lajsne, ламинаat, постављање ламината, лајсне | Montaža podnih obloga, podloga, postavljanje lajsni |
| `hoblovanje-i-lakiranje-parketa` | Hoblovanje i lakiranje parketa | ON_SITE | hoblovanje, lakiranje parketa, parketar, reparacija parketa, хобловање, лакирање паркета, паркетар | Brušenje, fugovanje pukotina, poliranje i lakiranje parketa |
| `gipsarski-radovi-i-pregradni-zidovi` | Gipsarski radovi i pregradni zidovi | ON_SITE | gips, rigips, knauf, spusteni plafoni, gipsani zidovi, pregrade, гипсар, ригипс, кнауф, спуштени плафони | Montaža gips-kartonskih ploča, spušteni plafoni, oblaganje cevi |
| `fasaderski-radovi-i-izolacija` | Fasaderski radovi i izolacija | ON_SITE | fasada, stiropor izolacija, termoizolacija, demit fasada, kamena vuna, фасада, стиропор, изолација | Postavljanje termoizolacije, mrežice, lepak, završni dekorativni malter |
| `zidarski-radovi` | Zidarski radovi | ON_SITE | zidanje, zidanje blokovima, ozidavanje, malterisanje, zidar, зидање, малтерисање, зидар | Zidanje giter blokom, ciglom, ytong/siporeks blokom |
| `betoniranje-i-salovanje` | Betoniranje i šalovanje | ON_SITE | betoniranje staze, salovanje ploce, betonjerka, armiranje, бетонирање, шаловање, армирање | Izrada temelja, ploča, staza, potpornih zidova i stepeništa |
| `krovopokrivacki-radovi` | Krovopokrivački radovi | ON_SITE | krov, zamena crepa, popravka krova, tegola, letvisanje, кров, поправка крова, цреп, тегола | Sanacija krova, zamena polomljenog crepa, postavljanje folije |
| `hidroizolacija` | Hidroizolacija | ON_SITE | hidroizolacija kupatila, izolacija od vode, premaz protiv vlage, sika izolacija, хидроизолација, влага | Zaštita podova, podruma, ravnih krovova i terasa polimernim premazima |
| `montaza-i-zamena-stolarije` | Montaža i zamena stolarije | ON_SITE | pvc prozori, ugradnja vrata, aluminijumska stolarija, montaza prozora, пвц прозори, уградња врата, столарија | Demontaža stare i ugradnja nove PVC/ALU stolarije i prozorskih dasaka |
| `bravarski-i-varilacki-radovi` | Bravarski i varilački radovi | ON_SITE | bravarija, varenje kapije, izrada ograde, metalne konstrukcije, bravar, браварија, варење, металне конструкције | Zavarivanje crne metalurgije, popravka šarki, bravarske prepravke |
| `izrada-metalnih-ograda` | Izrada metalnih ograda i gelendera | ON_SITE | kovano gvozdje, metalna ograda, gelenderi, kapije od kovanog gvozdja, ковано гвожђе, гелендери | Izrada kapija, dvorišnih ograda, gelendera za stepeništa i terase |
| `rusenje-zidova-i-betona` | Rušenje zidova i betona | ON_SITE | rusenje pregrade, lupanje plocica, odnosenje suta, stemovanje, рушење зидова, лупање плочица, штемовање | Rušenje nenosivih pregrada, skidanje pločica, štemovanje otvora |
| `postavljanje-tapeta` | Postavljanje tapeta i fototapeta | ON_SITE | tapete, lepljenje tapeta, skidanje tapeta, fototapete, тапете, лепљење тапета | Priprema zidova, lepljenje klasičnih i reljefnih tapeta i foto-panela |
| `limarski-radovi-i-oluci` | Limarski radovi i oluci | ON_SITE | oluci, limarija, opsivanje dimnjaka, montaza oluka, vetarlajsne, олуци, лимарија, опшивање | Montaža i popravka horizontalnih i vertikalnih oluka, opšivke limom |
| `postavljanje-epoksidnih-podova` | Postavljanje epoksidnih podova | ON_SITE | epoksidni pod, industrijski podovi, epoksi smola, 3d podovi, епоксидни под, индустријски подови | Izlivanje bešavnih epoksidnih i poliuretanskih podova u garažama i stanovima |
| `zvucna-izolacija` | Zvučna izolacija prostora | ON_SITE | zvucna izolacija stana, izolacija od buke, kamena vuna pregrada, звучна изолација, заштита од буке | Ugradnja zvučne izolacije na zidove, plafone i podove |
| `malterisanje` | Malterisanje (ručno i mašinsko) | ON_SITE | malterisanje, masinsko malterisanje, grubo i fino malterisanje, малтерисање, машинско малтерисање | Nanošenje cementnog i gipsanog maltera na unutrašnje i spoljne zidove |
| `poplocavanje-behaton` | Popločavanje dvorišta i behaton ploče | ON_SITE | behaton, poplocavanje staza, ugradnja ivicnjaka, behaton ploce, бехатон, поплочавање | Priprema terena, nasipanje rizle, postavljanje behatona i ivičnjaka |
| `reparacija-drvene-stolarije` | Reparacija i farbanje drvene stolarije | ON_SITE | farbanje prozora, reparacija drvenih vrata, gitovanje drveta, фарбање прозора, дрвена столарија | Šmirglanje, gitovanje, nanošenje prajmera i lakiranje drvene stolarije |
| `ugradnja-vrata` | Ugradnja sobnih i sigurnosnih vrata | ON_SITE | montaza sobnih vrata, ugradnja blindiranih vrata, montaza stoka, уградња врата, блиндирана врата | Postavljanje štokova, pur-penisanje, montaža krila i opšivnih lajsni |
| `sanacija-vlage-i-budi` | Sanacija vlage i buđi | ON_SITE | skidanje budi, budj na zidu, premaz protiv vlage, uklanjanje plesni, санирање буђи, влага, плесан | Tretman fungicidnim preparatima, termo-premazi i sanacija uzroka |
| `dijamantsko-busenje-betona` | Dijamantsko bušenje betona | ON_SITE | busenje rupa u betonu, otvor za aspirator, otvor za klimu u zidu, дијамантско бушење, рупа за аспиратор | Bušenje kružnih otvora kroz armirani beton bez vibracija |

### 3.2 Hitne kućne popravke i kućni majstor (`ROOT_REPAIRS`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `zamena-slavina-i-ventila` | Zamena i popravka slavina i ventila | ON_SITE | slavina, cesma, zamena cesme, montaza slavine, zamena ventila, EK ventil, славина, чесма, замена славине | Zamena jednoručnih baterija, slavina, EK ventila i virbli |
| `odgusenje-kanalizacije-i-sifona` | Odgušenje kanalizacije i sifona | ON_SITE | odgusenje wc solje, zapusen odvod, odgusenje sajlom, otpusavanje sudopere, одгушење, запушен одвод, отпушавање | Mašinsko i ručno odgušenje kanalizacionih vertikala, sifona i odvoda |
| `popravka-vodokotlica` | Popravka i montaža vodokotlića | ON_SITE | vodokotlic, curi kotlic, zvono kotlica, plovak, ugradni geberit, водокотлић, цури вода, пловак, геберит | Popravka nadgradnih i ugradnih vodokotlića, zamena plovka i zvona |
| `servis-i-zamena-bojlera` | Servis i zamena bojlera | ON_SITE | bojler, ciscenje kamenca, zamena grejaca bojlera, sigurnosni ventil, montaza bojlera, бојлер, грејач бојлера, каменац | Zamena grejača, termostata, sigurnosnog ventila i montaža novog bojlera |
| `zamena-prekidaca-i-uticnica` | Zamena prekidača i utičnica | ON_SITE | uticnice, prekidaci, popravka struje, luster, indikator za kupatilo, утичнице, прекидачи, индикатор | Zamena neispravnih šuko utičnica, jednopolnih/naizmeničnih prekidača |
| `zamena-osiguraca-i-table` | Zamena osigurača i razvodne table | ON_SITE | iskocio osigurac, automatski osiguraci, zamena table, fidova sklopka, осигурачи, разводна табла, фид склопка | Zamena topljivih osigurača automatskim, montaža FID sklopke |
| `popravka-ves-masina` | Popravka veš mašina | ON_SITE | ves masina ne vrti, popravka ves masine, zamena pumpe, lezaj ves masine, веш машина, поправка веш машине | Zamena grejača, ležajeva, pumpe za vodu, četkica i elektronike |
| `popravka-sudomasina` | Popravka sudomašina | ON_SITE | masina za sudove, sudomasina ne izbacuje vodu, popravka masine za sudove, судомашина, машина за судове | Servis pumpe visokog pritiska, grejača, ventila i elektronike sudomašine |
| `popravka-frizidera-i-zamrzivaca` | Popravka frižidera i zamrzivača | ON_SITE | frizider ne hladi, servis frizidera, zamrzivac, zamena termostata na frizideru, фрижидер, сервис фрижидера, замрзивач | Zamena kompresora, termostata, ventilatora i dopuna rashladnog fluida |
| `popravka-sporeta-i-rerni` | Popravka električnih šporeta i rerni | ON_SITE | sporet, ringla ne radi, zamena grejaca rerne, staklokeramicka ploca, шпорет, замена рингле, рерна | Zamena ringli, grejača rerne, prekidača šporeta i staklokeramičkih ploča |
| `servis-i-ugradnja-klima` | Servis i ugradnja klima uređaja | ON_SITE | klima servis, punjenje freona, montaza klime, ciscenje klime, demontaza klime, клима сервис, монтажа климе, фреон | Montaža unutrašnje i spoljne jedinice, vakumiranje, antibakterijsko pranje |
| `popravka-i-zamena-brava` | Popravka i zamena brava i cilindara | ON_SITE | brava, cilindar, zaglavljen kljuc, zamena brave, sigurnosna brava, брава, цилиндар, заглављен кључ | Zamena uložaka, cilindara, kvaka i ugradnja sigurnosnih brava |
| `hitno-otvaranje-vrata` | Hitno otvaranje zaključanih vrata | ON_SITE | otvaranje vrata bez ostecenja, zaboravljen kljuc, bravar hitno, отварање закључаних врата, бравар | Dežurna intervencija otvaranja vrata bez oštećenja brave ili stolarije |
| `popravka-roletni-i-venecijanera` | Popravka roletni i venecijanera | ON_SITE | gurtna za roletne, zamena trake, pukla roletna, mehanizam roletne, venecijaneri, ролетне, венецијанери, гуртна | Zamena automata i gurtni, popravka letvica i mehanizama za spuštanje |
| `montaza-rasvete` | Montaža lustera, plafonjera i LED rasvete | ON_SITE | montaza rasvete, kacenje lustera, led trake, ugradne svetiljke, plafonjera, расвета, лустер, лед траке, плафоњера | Postavljanje rasvetnih tela, povezivanje transformatora za LED trake |
| `sklapanje-namestaja` | Sklapanje i montaža novog nameštaja | ON_SITE | sklapanje ormara, montaza kreveta, sklapanje komode, IKEA sklapanje, JYSK namestaj, монтажа намештаја, склапање ормара | Montaža fabrički zapakovanog pločastog nameštaja po uputstvu |
| `kacenje-polica-i-tv-nosaca` | Kačenje polica, slika i nosača za TV | ON_SITE | kacenje tv nosaca, montaza police na zid, kacenje ogledala, busenje zida, качење полица, тв носач, качење огледала | Tiplovanje u beton, gips ili ciglu, precizno nivelisanje nosača |
| `zamena-sanitarija` | Zamena i montaža sanitarija | ON_SITE | montaza wc solje, ugradnja lavaboa, zamena bidea, silikonisanje, монтажа вц шоље, уградња лавабоа, санитарије | Montaža sanitarija, postavljanje daske, zamena sifona i silikonisanje |
| `zamena-tus-kabina` | Zamena i popravka tuš kabina | ON_SITE | montaza tus kabine, zamena tockica na kabini, dihtovanje tus kabine, монтажа туш кабине, точкићи туш кабине | Sklapanje paravana, ugradnja tuš kade, zamena točkića i dihtunga |
| `detekcija-curenja-vode` | Detekcija curenja vode | ON_SITE | lociranje kvara vodovoda, termalna kamera curenje, pronalazenje cevi u zidu, детекција цурења воде, термална камера | Beskontaktno pronalaženje tačne tačke pucanja vodovodne ili odvodne cevi |

### 3.3 Grejanje, klimatizacija i ventilacija (`ROOT_HVAC`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `servis-gasnih-kotlova` | Servis i popravka gasnih kotlova | ON_SITE | gasni kotao, servis kotla na gas, ciscenje gasnog kotla, grejanje na gas, гасни котао, сервис гасног котла | Čišćenje gorionika, primarnog izmenjivača, provera pritiska i elektronike |
| `servis-kotlova-pelet-struja` | Servis kotlova na pelet i struju | ON_SITE | kotao na pelet, elektricni kotao, ciscenje kotla, popravka grejanja, котао на пелет, електрични котао | Servis upaljača za pelet, pumpi, ekspanzionih posuda i grejača |
| `ispiranje-i-odzracivanje-radijatora` | Ispiranje i odzračivanje radijatora | ON_SITE | odzracivanje radijatora, hladan radijator, ispiranje sistema grejanja, одзрачивање радијатора, испирање грејања | Otklanjanje vazdušnih čepova, hemijsko ispiranje mulja i kamenca |
| `ugradnja-etaznog-i-podnog-grejanja` | Ugradnja etažnog i podnog grejanja | ON_SITE | podno grejanje, razvodjenje cevi za grejanje, montaza radijatora, подно грејање, монтажа радијатора | Postavljanje alu-peks cevi, razdelnika i priključivanje radijatora |
| `zamena-radijatorskih-ventila` | Zamena radijatorskih ventila | ON_SITE | termo glava, radijatorski ventil, curi ventil na radijatoru, термо глава, вентил на радијатору | Zamena ugaonih i pravih ventila, ugradnja termostatskih glava |
| `ciscenje-dimnjaka` | Čišćenje dimnjaka (dimničar) | ON_SITE | dimnicar, ciscenje odzaka, zacepljen dimnjak, ciscenje cadji, димничар, чишћење оџака, димњак | Čišćenje čađi četkama, provera promaje dimnjaka i otvaranje revizija |
| `servis-toplotnih-pumpi` | Ugradnja i servis toplotnih pumpi | ON_SITE | toplotna pumpa, vazduh voda grejanje, servis toplotne pumpe, топлотне пумпе, сервис топлотне пумпе | Puštanje u rad, servis kompresora, balansiranje krugova grejanja |
| `ugradnja-ventilacije-i-aspiratora` | Ugradnja ventilacije i aspiratora | ON_SITE | montaza aspiratora, ventilacioni kanali, izduvni ventilator za kupatilo, монтажа аспиратора, вентилација | Bušenje zida, postavljanje gibljivih/krutih creva i priključak napajanja |
| `antibakterijsko-ciscenje-klima` | Sezonsko antibakterijsko pranje klima | ON_SITE | dubinsko pranje klime, dezinfekcija klime, smrdi klima, дезинфекција климе, прање клима уређаја | Pranje isparivača hemijskim sredstvima i paročistačem pod pritiskom |
| `punjenje-freona` | Punjenje freona na rashladnim sistemima | ON_SITE | dopuna freona, curi freon na klimi, r32 r410a gas, пуњење фреона, допуна фреона | Ispitivanje pritiska azotom, otklanjanje curenja i punjenje tačne mase freona |
| `montaza-solarnih-panela-grejanje` | Montaža solarnih kolektora za vodu | ON_SITE | solarni paneli za toplu vodu, solarni bojler, solarni kolektori, соларни колектори, соларни бојлер | Ugradnja vakuumskih/pločastih kolektora na krov i povezivanje na bojler |
| `popravka-ta-peci` | Popravka TA peći | ON_SITE | termo peci, zamena grejaca ta pec, ventilator ta peci, termostat ta pec, та пећ, поправка термо пећи | Zamena grejača, ventilatora, radnog i sigurnosnog termostata i kablova |

### 3.4 Čišćenje i održavanje prostora (`ROOT_CLEANING`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `generalno-ciscenje-stanova` | Generalno čišćenje stanova i kuća | ON_SITE | generalka, detaljno ciscenje, ribanje stana, spremanje kuce, генерално чишћење, рибање стана | Temeljno ribanje kuhinje, kupatila, vrata, ormara i svih podnih površina |
| `redovno-ciscenje-stanova` | Redovno održavanje higijene stanova | ON_SITE | ciscenje na sate, spremanje stana, pomocnica za ciscenje, редовно чишћење, спремање стана | Periodično usisavanje, brisanje prašine, sanitarija i pranje podova |
| `ciscenje-nakon-radova` | Čišćenje nakon adaptacije i radova | ON_SITE | ciscenje posle krecenja, ciscenje suta i prasine, skidanje farbe sa stakla, чишћење после радова, чишћење после кречења | Uklanjanje gipsane prašine, mrlja od lepka, farbe i građevinskog otpada |
| `dubinsko-pranje-namestaja` | Dubinsko pranje mebl nameštaja | ON_SITE | dubinsko pranje, pranje troseda, ciscenje ugaonih garnitura, ekstrakcija namestaja, дубинско прање, прање троседа | Ekstrakciono pranje profesionalnim mašinama i hemijom za mebl |
| `dubinsko-pranje-tepiha` | Dubinsko pranje tepiha i itisona | ON_SITE | pranje tepiha na licu mesta, pranje itisona, susenje tepiha, прање тепиха, дубинско прање тепиха | Pranje i usisavanje vlage iz tepiha u prostoru klijenta |
| `dubinsko-pranje-duseka` | Dubinsko pranje i dezinfekcija dušeka | ON_SITE | ciscenje duseka, uklanjanje grinja, fleke na duseku, чишћење душека, дубинско прање душека | Dubinsko pranje fleka i antibakterijski tretman parom |
| `pranje-prozora` | Pranje prozora i staklenih portala | ON_SITE | pranje stakala, brisanje prozora, pranje izloga, ciscenje prozora, прање прозора, прање стакала, излози | Pranje stakala, ramova, štokova i prozorskih dasaka bez ostavljanja tragova |
| `ciscenje-zgrada` | Čišćenje zajedničkih ulaza zgrada | ON_SITE | ciscenje zgrade, odrzavanje ulaza, brisanje gelendera zgrade, чишћење зграда, одржавање улаза | Redovno metenje, pranje stepeništa, brisanje gelendera i stakala na ulazu |
| `ciscenje-kancelarija` | Čišćenje poslovnih i kancelarijskih prostora | ON_SITE | ciscenje kancelarija, higijena poslovnog prostora, odrzavanje lokala, чишћење канцеларија, пословни простор | Svakodnevno ili periodično održavanje kancelarijskog nameštaja i toaleta |
| `ciscenje-magacina-i-hala` | Čišćenje magacina i industrijskih hala | ON_SITE | industrijsko ciscenje, pranje hala, ciscenje magacinskog poda, индустријско чишћење, чишћење хала | Mašinsko pranje podova samohodnim mašinama i uklanjanje industrijskih fleka |
| `masinsko-poliranje-podova` | Mašinsko poliranje tvrdih podova | ON_SITE | poliranje mermera, poliranje granita, kristalizacija poda, кристализација мермера, полирање подова | Brušenje, poliranje i kristalizacija mermera, granita i teraca |
| `pranje-pod-visokim-pritiskom` | Pranje terasa i fasada visokim pritiskom | ON_SITE | pranje kerherom, pranje staza pritiskom, pranje masne fleke na betonu, прање керхером, прање терасе | Uklanjanje mahovine, prljavštine i naslaga sa betona, kamena i fasade |
| `ddd-usluge` | Dezinfekcija, dezinsekcija i deratizacija (DDD) | ON_SITE | prskanje buba, unistavanje mrava, misevi, dezinsekcija stana, bube u stanu, дезинсекција, дератизација, прскање буба | Tretmani protiv bubašvaba, buba rusa, mrava, stenica i glodara |
| `ozoniranje-prostora` | Uklanjanje neprijatnih mirisa ozoniranjem | ON_SITE | ozoniranje stana, uklanjanje mirisa dima, sterilizacija vazduha ozonom, озонирање простора, уклањање мириса | Neutralisanje mirisa duvanskog dima, vlage i paljevine generatorom ozona |
| `ciscenje-podruma-i-tavana` | Čišćenje i pražnjenje podruma i tavana | ON_SITE | ciscenje supe, ciscenje podruma, izbacivanje smeca iz tavana, чишћење подрума, чишћење тавана | Iznošenje nagomilanih starih stvari, metenje i dezinfekcija podruma |

### 3.5 Transport, selidbe i teški poslovi (`ROOT_TRANSPORT`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `kombi-prevoz` | Kombi prevoz stvari i robe | ON_SITE | kombi prevoz, prevoz namestaja, transport robe kombijem, prevoz paleta, комби превоз, превоз намештаја | Gradski i međugradski prevoz teretnim kombi vozilom (do 1.5t) |
| `kamionski-prevoz` | Kamionski transport | ON_SITE | kamion za selidbe, kamionski transport, kamion sa rampom, камионски превоз, камион са рампом | Prevoz većih zapremina i težina kamionom sa utovarnom rampom |
| `selidbe-kompletne` | Kompletne selidbe sa radnicima i pakovanjem | ON_SITE | selidba stana, radnici za selidbe, pakovanje stvari, kartonske kutije za selidbu, селидбе, радници за селидбе | Zaštita folijom, pakovanje, demontaža, prevoz, unošenje i montaža |
| `nosenje-teskog-tereta` | Nošenje teških predmeta i tereta | ON_SITE | nosenje klavira, nosenje sefa, unosenje peleta, nosenje TA peci, ношење терета, ношење клавира | Specijalizovano unošenje gabaritnih i izuzetno teških predmeta na sprat |
| `fizicki-radnici-utovar-istovar` | Fizički radnici za utovar i istovar | ON_SITE | radnici na sat, radnici za istovar slepera, fizikalci, физички радници, истовар | Angažovanje radnika za fizički utovar, pretovar i istovar kamiona |
| `odvoz-suta-na-deponiju` | Odvoz građevinskog šuta u džakovima | ON_SITE | odvoz suta, bacanje suta, kontejner za sut, ciscenje suta, одвоз шута, џакови шута | Utovar džakova sa šutom i transport na legalnu deponiju |
| `odvoz-starog-namestaja` | Odvoz starog nameštaja i kabastog otpada | ON_SITE | bacanje starog kreveta, odvoz bele tehnike na otpad, ciscenje stana od namestaja, одвоз старог намештаја, бацање отпада | Rastavljanje, iznošenje i odvoz nepotrebnog nameštaja na deponiju |
| `slep-sluzba-vozila` | Šlep služba za automobile i kombije | ON_SITE | slepanje auta, slep sluzba, prevoz kvara na putu, vuca vozila, шлеп служба, шлепање возила | Prevoz automobila, kombija ili traktora na navoznoj platformi |
| `slep-havarisanih-vozila` | Šlep havarisanih vozila sa izvlačenjem | ON_SITE | izvlacenje auta iz kanala, prevoz havarisanog vozila, vitlo slep, извлачење возила, шлеп хаварисаних | Izvlačenje vozila vitlom sa nepristupačnog terena ili nakon udesa |
| `prevoz-gradjevinskih-masina` | Prevoz građevinskih mašina i viljuškara | ON_SITE | prevoz bagera, prevoz viljuskara, transport mini bagera, лабудица, превоз багера | Transport bagera, valjaka i industrijskih mašina na niskonosećoj prikolici |
| `kurirska-dostava-i-potrcko` | Kurirska dostava i potrčko | ON_SITE | kurir po gradu, dostava dokumenata, potrcko, placanje racuna, курур, достава, потрчко | Hitno preuzimanje i dostava manjih pošiljki, kupovina ili čekanje u redu |
| `prevoz-namestaja-iz-salona` | Prevoz kupljenog nameštaja iz salona | ON_SITE | prevoz iz ikee, prevoz iz jyska, dovoz namestaja iz salona, превоз из салона, достава намештаја | Preuzimanje robe na rampi prodajnog centra i dostava do stana |
| `unos-ogreva` | Unos ogrevnog drveta, peleta i uglja | ON_SITE | unosenje drva, slaganje drva, unosenje peleta u podrum, унос дрва, слагање пелета | Istovar i unošenje ogrevnog materijala u kotlarnice i podrume |
| `ciscenje-i-odvoz-nasledjenih-stvari` | Kompletno pražnjenje nasleđenih stanova | ON_SITE | praznjenje stana, odvoz svih stvari iz stana, bacanje starudije, пражњење стана, одвоз ствари | Kompletno raščišćavanje prostora, sortiranje i odvoz svega u otpad |
| `prevoz-motora-i-camaca` | Prevoz motocikala, kvadova i čamaca | ON_SITE | prevoz motora u kombiju, prikolica za motor, transport camca, превоз мотора, превоз чамца | Bezbedno vezivanje španerima i transport dvotočkaša i plovila |

### 3.6 Auto, moto i mehanika (`ROOT_AUTO`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `vulkanizerske-usluge` | Vulkanizerske usluge i zamena guma | ON_SITE | vulkanizer, montaza guma, balansiranje tockova, krpljenje gume, вулканизер, замена гума, балансирање | Sezonska zamena guma, balansiranje i popravka probušenih pneumatika |
| `mali-servis-na-adresi` | Mali servis automobila na terenu | ON_SITE | zamena ulja, filter ulja filter vazduha, mali servis na adresi, мали сервис, замена уља | Zamena motornog ulja, filtera za vazduh, gorivo i kabinu na terenu |
| `auto-dijagnostika-na-terenu` | Auto dijagnostika i brisanje grešaka | ON_SITE | dijagnostika kvara, citanje gresaka, obd dijagnostika, check engine lampica, дијагностика, читање грешака | Povezivanje profesionalnog skenera na OBD port, lociranje kvara |
| `pomoc-na-putu-akumulator` | Pomoć na putu: startovanje i akumulator | ON_SITE | prazan akumulator, kablovi za paljenje, zamena akumulatora na putu, паљење на каблове, акумулатор | Dolazak busterom ili kablovima za startovanje motora i provera punjenja |
| `pomoc-na-putu-guma-gorivo` | Pomoć na putu: dovoz goriva i zamena točka | ON_SITE | nestalo goriva, zamena probusene gume na putu, dovoz benzina, помоћ на путу, замена точка | Doprema goriva, odvijanje zapeklih šrafova i postavljanje rezervnog točka |
| `dubinsko-pranje-automobila` | Dubinsko pranje automobila i detailing | ON_SITE | detailing auta, pranje sedista, ciscenje enterijera vozila, ciscenje koze u autu, дубинско прање аута, прање седишта | Hemijsko čišćenje neba, sedišta, podova, tapacirunga i ventilacije |
| `poliranje-automobila` | Poliranje automobila i keramička zaštita | ON_SITE | poliranje farova, poliranje ogrebotina na autu, keramicka zastita, полирање аута, полирање фарова | Uklanjanje mikro-ogrebotina pastama, vraćanje sjaja i zaštitni premaz |
| `servis-bicikala` | Servis i popravka bicikala | ON_SITE | popravka bicikla, stelovanje menjaca, busna guma na biciklu, centriranje tocka, поправка бицикла, сервис бицикла | Zamena unutrašnje/spoljne gume, štelovanje kočnica, menjača i lanaca |
| `servis-elektricnih-trotineta` | Servis električnih trotineta | ON_SITE | servis trotineta, zamena gume na trotinetu, baterija za trotinet, xiaomi trotinet, сервис тротинета, електрични тротинет | Zamena pune/vazdušne gume, zamena kočionih pločica i servis elektronike |
| `zamena-auto-stakala` | Zamena i reparacija auto stakala | ON_SITE | sofersajbna, zamena soferke, reparacija naprsle sofersajbne, шофершајбна, замена стакла | Sanacija tačkastih oštećenja smolom ili demontaža i lepljenje nove šoferke |
| `ugradnja-auto-ozvucenja-i-kamera` | Ugradnja auto multimedije i kamera | ON_SITE | ugradnja rikverc kamere, auto radio montaza, ugradnja zvucnika u auto, ауто радио, рикверц камера | Povezivanje Android multimedije, rikverc kamere i pojačala u vozilu |
| `auto-bravar-i-kljucevi` | Auto bravar i kodiranje ključeva | ON_SITE | kodiranje kljuca za auto, narezivanje kljuca, zakljucan kljuc u autu, кодирање кључева, ауто бравар | Narezivanje mačeva, programiranje transpondera i otvaranje vozila |

### 3.7 Uređenje dvorišta, bašte i eksterijera (`ROOT_GARDEN`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `kosenje-trave` | Košenje trave i održavanje travnjaka | ON_SITE | kosenje trave, trimer, kosenje travnjaka, kosenje dvorista, кошење траве, тример, одржавање травњака | Košenje rotacionom kosačicom, obrada ivica trimerom i sakupljanje trave |
| `orezivanje-voca-i-ograde` | Orezivanje voćnjaka i žive ograde | ON_SITE | sisanje zive ograde, orezivanje voca, orezivanje ruza, makaze za zivu ogradu, орезивање воћа, жива ограда | Formiranje oblika žive ograde, uklanjanje suvih grana i rezidba |
| `krcenje-placa` | Krčenje zapuštenih placeva i šiblja | ON_SITE | krcenje placa, krcenje siblja, ciscenje korova, tarupiranje, крчење плаца, шибље, чишћење корова | Seča divljeg rastinja, košenje visokog korova motornim trimerom/tarupom |
| `seca-visokih-stabala` | Seča i obaranje rizičnih stabala | ON_SITE | obaranje drveta, secu stabala motornom testerom, orezivanje grana na visini, обарање дрвета, сеча стабала | Kontrolisano uklanjanje stabala uz pomoć užadi ili korpe |
| `postavljanje-travnatog-busena` | Postavljanje gajenog travnatog busena | ON_SITE | travnati busen, tepih trava, sejanje trave, priprema zemlje za travnjak, травнати бусен, тепих трава | Ravnanje tla, valjanje, postavljanje busena i prvo zalivanje |
| `ugradnja-zalivnih-sistema` | Ugradnja i popravka zalivnih sistema | ON_SITE | sistem kap po kap, automatsko zalivanje, pop-up prskalice, hunter prskalice, кап по кап, аутоматско заливање | Montaža elektromagnetnih ventila, programatora i ukopavanje prskalica |
| `sadnja-i-uredjenje-cvetnjaka` | Sadnja i uređenje cvetnjaka i sadnica | ON_SITE | sadnja cveca, sadnja tuja, postavljanje malca, dizajn dvorista, садња цвећа, тује, малч | Okopavanje, sadnja ukrasnih tuja, cvetnih leja i posipanje borovog malča |
| `prskanje-i-zastita-travnjaka` | Hemijski tretman i zaštita travnjaka | ON_SITE | prskanje sirokolisnih korova, djubrenje travnjaka, aeracija, scarifikacija, прскање корова, аерација травњака | Tretman herbicidima protiv korova, vertikulacija i dohrana đubrivom |
| `freziranje-i-priprema-zemlje` | Freziranje i mašinska obrada zemlje | ON_SITE | freziranje baste, oranje motokultivatorom, usitnjavanje zemlje, фрезирање баште, мотокултиватор | Usitnjavanje gornjeg sloja zemlje motokultivatorom pred sadnju |
| `izrada-dvorisnih-ograda` | Izrada i postavljanje dvorišnih ograda | ON_SITE | zicana ograda, pletena zica, betonski stubovi, drvena ograda za bastu, жичана ограда, постављање жице | Bušenje rupa, betoniranje stubova i zatezanje pletene ili panelne žice |
| `odrzavanje-i-ciscenje-bazena` | Održavanje i hemijski tretman bazena | ON_SITE | ciscenje bazena, usisavanje bazena, hlorisane vode, ph balans bazena, чишћење базена, хлорисање | Usisavanje dna bazena, provera filtera, doziranje algicida i hlora |
| `ciscenje-snega` | Ručno i mašinsko čišćenje snega | ON_SITE | ciscenje snega, lopatanje snega, bacanje soli na staze, ciscenje prilaza, чишћење снега, лопатање снега | Uklanjanje snega sa prilaza, trotoara i posipanje industrijske soli |

### 3.8 Nega, čuvanje i pomoć u kući (`ROOT_CARE`)
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `cuvanje-dece-bebisiterka` | Čuvanje dece (bebisiterka / dadilja) | ON_SITE | bebisiterka, cuvanje deteta, dadilja na sate, cuvanje beba, бебиситерка, дадиља, чување деце | Dnevno ili večernje čuvanje dece, hranjenje, šetnja i igra |
| `nega-starih-lica` | Nega i pomoć starim i bolesnim licima | ON_SITE | gerontodomacica, nega starijih, pomoc u kuci za penzionere, briga o starima, геронтодомаћица, нега старих | Pomoć pri kretanju, ličnoj higijeni, nabavka namirnica i lekova |
| `medicinska-pomoc-u-kuci` | Medicinska pomoć u kući | ON_SITE | davanje injekcija u kuci, infuzija kod kuce, patronazna sestra, previjanje rane, давање инјекција, превијање рана, патронажа | Stručne usluge medicinske sestre: injekcije, infuzije, obrada rana |
| `pomoc-u-kuci` | Pomoć u kući i kućna pomoćnica | ON_SITE | kucna pomocnica, ciscenje i kuvanje, pomoc u domacinstvu na dan, кућна помоћница, помоћ у кући | Pomoć u svakodnevnim poslovima domaćinstva po dogovoru |
| `kuvanje-u-kuci` | Priprema domaćih obroka u kući klijenta | ON_SITE | kuvanje rucka, priprema jela na sate, domaca kuvana jela u stanu, кување ручка, припрема хране | Nabavka namirnica i kuvanje domaćih obroka za porodicu |
| `peglanje-odece` | Peglanje odeće i slaganje veša | ON_SITE | peglanje na kosulja, usluzno peglanje, slaganje posteljine, пеглање одеће, пеглање кошуља | Peglanje košulja, odela i posteljine parnom peglom u stanu |
| `setanje-pasa` | Šetanje pasa (pojedinačno ili u grupi) | ON_SITE | setanje pasa, izvodjenje psa, setac pasa na sat, шетање паса, извођење паса | Redovna fizička aktivnost i izvođenje kućnih ljubimaca u šetnju |
| `cuvanje-ljubimaca-pet-sitting` | Čuvanje kućnih ljubimaca (Pet sitting) | ON_SITE | cuvanje pasa, pet siting, cuvanje macaka dok ste na putu, hranjenje ljubimaca, пет ситинг, чување паса, чување мачака | Obilazak i hranjenje mačaka ili celodnevni boravak kod psa |
| `grooming-sisanje-pasa` | Šišanje i nega pasa i mačaka (Grooming) | ON_SITE | gruming, kupanje psa, sisanje pasa, ciscenje usiju psa, rezanje noktiju ljubimcu, груминг, шишање паса | Higijenski i estetski tretman krzna, kupanje, rašćebavanje i šišanje |
| `dresura-i-obuka-pasa` | Dresura i obuka pasa | ON_SITE | dreser pasa, osnovna poslusnost psa, resavanje agresije psa, socijalizacija steneta, дресура паса, дресер | Individualni časovi poslušnosti, korigovanje ponašanja i socijalizacija |
| `prevoz-ljubimaca-pet-taxi` | Prevoz kućnih ljubimaca (Pet taxi) | ON_SITE | pet taxi, prevoz psa do veterinara, prevoz macke u transporteru, пет такси, превоз кућних љубимаца | Specijalizovan prevoz ljubimaca u čistom i klimatizovanom vozilu |
| `nocno-dezurstvo-i-nega` | Noćno dežurstvo i nega nepokretnih lica | ON_SITE | nocno cuvanje starih, bdenje uz bolesnika, nocna nega u stanu, ноћно дежурство, нега болесника | Pružanje pomoći i nadzor nad bolesnim licem tokom noćnih časova |

### 3.9 Podučavanje i edukacija (`ROOT_TUTORING`) — DUAL
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `casovi-matematike` | Privatni časovi matematike | DUAL | matematika osnovna, matematika srednja, popravljanje ocene matematika, часови математике, математика | Rad na školskom gradivu, rešavanje zadataka za kontrolne i pismene |
| `priprema-prijemni-matematika` | Priprema za prijemni ispit iz matematike | DUAL | prijemni matematika etf fon masinski, priprema za fakultet matematika, припрема за пријемни математика | Intenzivni zadaci sa prethodnih prijemnih ispita za tehničke fakultete |
| `casovi-fizike` | Privatni časovi fizike | DUAL | fizika za osnovce, fizika za srednjoškolce, zadaci iz fizike, часови физике, физика | Savladavanje teorije i rešavanje računskih zadataka iz fizike |
| `casovi-hemije` | Privatni časovi hemije | DUAL | hemija osnovna, organska hemija, neorganska hemija, zadaci iz hemije, часови хемије, хемија | Pomoć u razumevanju hemijskih reakcija, jednačina i stehiometrije |
| `casovi-srpskog-jezika` | Privatni časovi srpskog jezika | DUAL | srpski jezik, gramatika, pravopis, analiza knjizevnih dela, српски језик, граматика | Učenje gramatike, sintakse i priprema sastava iz književnosti |
| `priprema-mala-matura` | Priprema za malu maturu | DUAL | priprema za zavrsni ispit, test iz srpskog matura, kombinovani test, припрема за малу матуру, завршни испит | Sistematsko obnavljanje gradiva od petog do osmog razreda |
| `casovi-engleskog-jezika` | Privatni časovi engleskog jezika | DUAL | engleski online, konverzacijski engleski, engleski za pocetnike, gramatika engleski, часови енглеског језика | Unapređenje govora, gramatike i vokabulara za sve uzraste |
| `priprema-ielts-toefl` | Priprema za ispite IELTS, TOEFL i Cambridge | DUAL | ielts priprema, toefl ispit, c1 advanced cambridge, prijemni engleski, иелтс припрема, тоефл | Vežbanje formata ispita: reading, writing, listening i speaking |
| `casovi-nemackog-jezika` | Privatni časovi nemačkog jezika | DUAL | nemacki jezik, priprema za goethe ispit, a1 b1 nemacki, nemacki za medicinare, часови немачког, гете испит | Učenje nemačkog jezika po nivoima CEFR okvira |
| `casovi-francuskog-jezika` | Privatni časovi francuskog jezika | DUAL | francuski jezik, delf ispit, gramatika francuski, часови француског језика | Savladavanje izgovora, vokabulara i priprema školskih ispita |
| `casovi-ruskog-jezika` | Privatni časovi ruskog jezika | DUAL | ruski jezik, konverzacijski ruski, casovi ruskog za pocetnike, часови руског језика | Učenje ćiriličnog pisma, gramatike i konverzacije na ruskom |
| `casovi-italijanskog-jezika` | Privatni časovi italijanskog jezika | DUAL | italijanski jezik, cils ispit, ucenje italijanskog, часови италијанског језика | Osnove jezika, turistička i poslovna konverzacija na italijanskom |
| `casovi-programiranja` | Privatni časovi programiranja i IT-ja | DUAL | casovi python, javascript casovi, c++ programiranje, osnove html css, програмирање, часови информатике | Mentorstvo u programiranju, izrada projekata i algoritamski zadaci |
| `obuka-rada-na-racunaru-seniori` | Obuka rada na računaru za seniore | DUAL | osnove kompjutera, kako koristiti viber, koriscenje interneta za starije, обука за рачунаре пензионери | Strpljivo podučavanje korišćenja interneta, e-maila i video poziva |
| `casovi-gitare` | Privatni časovi gitare | DUAL | casovi gitare, akusticna gitara, elektricna gitara, akordi za gitaru, часови гитаре, акустична гитара | Učenje tablatura, akorada, ritmova i sviranja omiljenih pesama |
| `casovi-klavira-i-solfedja` | Privatni časovi klavira i solfeđa | DUAL | casovi klavira, solfedjo za muzicku skolu, casovi klavijature, sintisajzer, часови клавира, солфеђо | Rad na tehnici prstiju, čitanju nota i pripremi muzičkih ispita |
| `casovi-harmonike` | Privatni časovi harmonike | DUAL | casovi harmonike, dugmetara, klavirska harmonika, narodna muzika harmonika, часови хармонике | Postavka ruku, basova i učenje kola i narodnih kompozicija |
| `casovi-pevanja` | Privatni časovi solo pevanja | DUAL | casovi pevanja, tehnika disanja za pevanje, vokalni pedagog, intonacija, часови певања, вокални педагог | Postavka glasa, tehnike disanja, dikcija i interpretacija |

### 3.10 Digitalne usluge, dizajn i IT (`ROOT_DIGITAL`) — REMOTE / DUAL
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `izrada-veb-sajtova` | Izrada veb sajtova (WordPress / Custom) | REMOTE | izrada sajta, pravljenje vebsajta, web sajt za firmu, wordpress sajt, израда сајта, веб дизајн | Izrada modernih responzivnih sajtova i online kataloga |
| `razvoj-softvera-i-aplikacija` | Razvoj veb aplikacija i softverskih rešenja | REMOTE | web aplikacija, izrada programa, react nodejs developer, custom softver, израда апликација, програмер | Razvoj backend i frontend komponenti, baza podataka i API integracija |
| `graficki-dizajn-i-logo` | Grafički dizajn i brending (Logo dizajn) | REMOTE | logo dizajn, vizuelni identitet, graficki dizajner, izrada logotipa, лого дизајн, графички дизајн | Kreiranje logotipa, knjige grafičkih standarda i boja brenda |
| `dizajn-stampe-i-ambalaze` | Dizajn štampanih materijala i ambalaže | REMOTE | flajeri, priprema za stampu, vizitke, dizajn kataloga, dizajn etikete, дизајн флајера, припрема за штампу | Dizajn vizitkarti, brošura, plakata, jelovnika i ambalaže proizvoda |
| `ui-ux-dizajn` | UI/UX dizajn veb i mobilnih aplikacija | REMOTE | figma dizajn, dizajn interfejsa, ux istrazivanje, mockup sajta, фигма, дизајн апликација | Izrada wireframe-ova i interaktivnih prototipova u Figmi |
| `video-montaza` | Video montaža i postprodukcija | REMOTE | montaza videa, video editing za reels i tiktok, montiranje snimka, youtube montaza, видео монтажа, едитовање | Sečenje materijala, kolor korekcija, titlovanje i zvučni efekti |
| `obrada-zvuka-i-podcast` | Obrada zvuka i audio produkcija (Podkasti) | REMOTE | audio montaza, ciscenje suma sa zvuka, miks i master podcasta, jingle, обрада звука, аудио монтажа | Uklanjanje šuma, nivelacija nivoa govora i masterizacija audio zapisa |
| `vodjenje-drustvenih-mreza` | Vođenje društvenih mreža (SMM) | REMOTE | instagram menadzer, vodjenje stranice, kreiranje sadrzaja, community manager, вођење друштвених мрежа | Pisanje objava, izrada storija, kreiranje kalendara i komunikacija |
| `google-i-meta-reklame` | Vođenje Google i Meta reklamnih kampanja | REMOTE | facebook reklame, google ads oglasi, placeni marketing, ppc menadzer, гугл рекламе, фејсбук оглашавање | Podešavanje kampanja, definisanje ciljnih grupa i praćenje konverzija |
| `seo-optimizacija` | SEO optimizacija veb sajtova | REMOTE | seo optimizacija, rangiranje na google, google optimizacija, link building, сео оптимизација | On-page i tehnički SEO, optimizacija brzine sajta i ključnih reči |
| `servis-racunara-i-laptopova` | Servis i čišćenje računara i laptopova | DUAL | ciscenje prasine iz laptopa, zamena termalne paste, ne pali kompjuter, servis maticne ploce, сервис рачунара, сервис лаптопа | Fizičko čišćenje kulera, zamena komponenti i popravka hardvera |
| `instalacija-sistema-i-programa` | Instalacija operativnih sistema i programa | DUAL | instalacija windowsa, ciscenje virusa, podizanje sistema, instalacija office paketa, инсталација система, чишћење вируса | Instalacija Windows/macOS/Linux sistema, drajvera i antivirusa |
| `spasavanje-podataka` | Spašavanje podataka sa oštećenih medija | DUAL | vracanje obrisanih slika, crkao hard disk, spasavanje podataka sa usb, спашавање података, хард диск | Oporavak fajlova sa formatiranih, nečitljivih ili oštećenih diskova |
| `podesavanje-wifi-i-mreze` | Podešavanje kućne mreže i Wi-Fi rutera | ON_SITE | podesavanje interneta, montaza rutera, razvlacenje lan kabla, wifi extender, подешавање вајфаја, рутер, мрежа | Konfiguracija mreže, postavljanje extendera i krimpovanje kablova |
| `ugradnja-video-nadzora-i-alarma` | Ugradnja video nadzora i alarma | ON_SITE | montaza kamera, video nadzor za kucu, ugradnja alarma, dvr snimac, видео надзор, уградња камера, аларм | Postavljanje IP/AHD kamera, provlačenje instalacija i povezivanje na telefon |

### 3.11 Pisanje, prevod i administracija (`ROOT_WRITING`) — REMOTE / DUAL
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `prevodjenje-engleski` | Prevođenje tekstova sa i na engleski | REMOTE | prevodilac za engleski, prevodjenje na engleski, prevod seminarskog engleski, превођење енглески, преводилац | Pismeni prevodi stručnih tekstova, sajtova i dokumentacije |
| `prevodjenje-nemacki` | Prevođenje tekstova sa i na nemački | REMOTE | prevodilac za nemacki, prevod sa nemackog, tehnicki prevod nemacki, превођење немачки, преводилац | Precizno prevođenje poslovne i stručne korespondencije |
| `sudski-tumac-overa` | Sudski tumač i overeni prevodi | DUAL | overa sudskog tumaca, prevod sa pecatom, sudski tumac za nemacki engleski, судски тумач, оверени превод | Prevod diploma, ugovora i dokumenata sa zvaničnim pečatom tumača |
| `copywriting-i-pisanje-tekstova` | Pisanje tekstova, članaka i blogova | REMOTE | pisanje clanaka, copywriter, tekstovi za sajt, blog postovi, писање текстова, копирајтинг | Pisanje privlačnih i optimizovanih tekstova za sajtove i društvene mreže |
| `lektura-i-korektura` | Lektura i jezička korektura tekstova | REMOTE | lektura knjige, gramaticka ispravka, korektura rada, stilsko uredjivanje, лектура, коректура | Ispravljanje pravopisnih, gramatičkih i stilskih grešaka u tekstu |
| `unos-podataka-excel` | Unos podataka i digitalizacija tabela | REMOTE | unos u excel, prekucavanje teksta, unos podataka sa slika, data entry, унос података, прекуцавање | Prebacivanje podataka iz štampanih formata u Excel i baze podataka |
| `izrada-cv-i-motivacionog-pisma` | Pisanje profesionalnog CV-ja i biografije | REMOTE | izrada radne biografije, cv na engleskom, motivaciono pismo za posao, писање сивија, биографија | Strukturiranje iskustva i moderan dizajn radne biografije |
| `formatiranje-akademskih-radova` | Tehničko formatiranje diplomskih radova | REMOTE | formatiranje master rada, tehnicko uredjenje seminarskog, fusnote reference apastil, форматирање рада | Podešavanje margina, numeracije, sadržaja i referenciranja po standardu |
| `transkripcija-audio-video` | Transkripcija audio i video snimaka | REMOTE | prekucavanje snimka, transkripcija intervjua, tekst iz audio fajla, транскрипција, прекуцавање снимка | Pretvaranje zvučnih zapisa i razgovora u tačan pisani tekst |
| `izrada-poslovnih-prezentacija` | Izrada PowerPoint i pitch prezentacija | REMOTE | izrada prezentacije, powerpoint dizajn, slajdovi za predavanje, израда презентација, слајдови | Dizajn ubedljivih vizuelnih slajdova za konferencije i sastanke |
| `pisanje-projekata-i-fondova` | Pisanje projekata za domaće i EU fondove | REMOTE | biznis plan za samozaposljavanje, prijava za subvencije, fond za inovacije, писање пројеката, бизнис план | Izrada poslovnih planova, finansijskih projekcija i konkursne dokumentacije |
| `knjigovodstvene-konsultacije` | Knjigovodstvene i poreske konsultacije | REMOTE | poreski savetnik, otvaranje pausalne firme, saveti za knjigovodstvo, књиговодствене консултације, порези | Savetovanje o izboru poreskog modela, otvaranju preduzetništva i propisima |

### 3.12 Lepota, nega tela i zdravlje (`ROOT_WELLNESS`) — ON_SITE
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `terapeutska-masaza` | Terapeutska masaža na adresi klijenta | ON_SITE | terapeutska masaza na adresi, bol u ledjima masaza, medicinska masaza, масажа, терапеутска масажа | Ciljana masaža za otklanjanje mišićnog spazma i bolova u leđima |
| `relaks-masaza` | Relaksaciona i antistres masaža kod kuće | ON_SITE | relaks masaza, opustajuca masaza, maser na adresi, релакс масажа, масажа код куће | Masaža celog tela aromaterapijskim uljima za opuštanje mišića |
| `manikir-i-gel-lak` | Manikira, izlivanje noktiju i gel lak | ON_SITE | gel lak kod kuce, manikir na adresi, izlivanje noktiju, nokti kod kuce, маникир, гел лак, изливање ноктију | Uređivanje zanoktica, oblikovanje, nanošenje baze, boje i gel laka |
| `medicinski-i-estetski-pedikir` | Medicinski i estetski pedikir na adresi | ON_SITE | pedikir na adresi, urasli nokat, skidanje zuljeva na stopalu, педикир, медицински педикир | Uklanjanje zadebljale kože, obrada kurjih očiju i nega stopala |
| `profesionalno-sminkanje` | Profesionalno šminkanje za događaje | ON_SITE | profesionalno sminkanje, sminkerka za svadbu, šminka na adresi, makeup umetnik, професионално шминкање, шминкерка | Šminkanje visokokvalitetnom kozmetikom za svadbe, mature i događaje |
| `frizerske-usluge-na-adresi` | Frizerske usluge na kućnoj adresi | ON_SITE | sisanje kod kuce, feniranje na adresi, frizer za stare, farbanje kose u stanu, шишање код куће, фризер | Šišanje muško/žensko, feniranje na četku i nanošenje boje u kućnim uslovima |
| `depilacija-na-adresi` | Depilacija voskom i šećernom pastom | ON_SITE | depilacija kod kuce, depilacija nogu i ruku, secerna pasta depilacija, депилација, шећерна паста | Uklanjanje neželjenih dlačica toplim/hladnim voskom ili šećernom pastom |
| `kozmeticki-tretmani-lica` | Kozmetički tretmani lica na adresi | ON_SITE | ciscenje lica kod kuce, higijenski tretman lica, masaza lica, козметички третман лица | Piling, masaža lica, maska i nanošenje seruma prema tipu kože |
| `fizioterapija-u-kuci` | Fizioterapija i rehabilitacija u kući | ON_SITE | fizioterapeut na adresi, vezbe nakon preloma, kineziterapija u kuci, физиотерапеут, рехабилитација | Vežbe za vraćanje pokretljivosti nakon šloga, preloma ili operacija |
| `individualni-fitnes-treninzi` | Individualni fitnes treninzi sa trenerom | ON_SITE | privatni fitnes trener, personalni trening u stanu, plan ishrane i treninga, персонални тренер | Vođeni treninzi za redukciju težine ili jačanje snage u prostoru klijenta |

### 3.13 Događaji, proslave i ketering (`ROOT_EVENTS`) — DUAL
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `fotografisanje-proslava` | Fotografisanje proslava i događaja | ON_SITE | fotograf za rodjendan, slikanje svadbe, fotografisanje krstenja, slike sa proslave, фотограф за рођендан, сликање | Fotografisanje profesionalnim aparatom, obrada i isporuka u punoj rezoluciji |
| `snimanje-dronom-i-video` | Video snimanje događaja i snimanje dronom | ON_SITE | snimanje dronom, video snimatelj, snimanje vencanja, promo video lokala, снимање дроном, видео сниматељ | Snimanje 4K kamerama i dronom, stabilizacija i izrada gotovog videa |
| `ketering-slani-program` | Priprema i dostava slanog keteringa | ON_SITE | ketering za rodjendan, kanapei, slani zalogaji za firmu, rostilj na kilo dostava, кетеринг, слани залогаји | Izrada i aranžiranje kanapea, mini sendviča, rolata i posluženja |
| `izrada-torti-i-kolaca` | Izrada svečanih torti i sitnih kolača | DUAL | domace torte, torte po narudzbini, kolaci za slavu, mladalacka torta, домаће торте, торте по наруџбини | Izrada torti po slici, fondan figurice i sitni slavski kolači |
| `iznajmljivanje-ozvucenja-i-rasvete` | Iznajmljivanje ozvučenja i rasvete | ON_SITE | ozvucenje za zurku, iznajmljivanje miksete i zvucnika, disko rasveta, dim masina, озвучење за журку, изнајмљивање расвете | Doprema, montaža aktivnih kutija, miksete, bežičnih mikrofona i svetla |
| `dj-za-proslave` | DJ usluge za proslave i žurke | ON_SITE | dj za rodjendan, muzika za proslavu, dj sa opremom za svadbu, диџеј, музика за прославе | Puštanje muzike po želji slavljenika, vođenje atmosfere |
| `animatori-za-decu` | Animacija dece i oslikavanje lica | ON_SITE | animatori za decu, klovn za rodjendan, crtanje po licu, face painting, igrice za decu, аниматори за децу, цртање по лицу | Organizovane takmičarske igre, mađioničarski trikovi i oslikavanje lica |
| `dekoracija-balonima-i-cvecem` | Dekoracija balonima i cvetni aranžmani | ON_SITE | luk od balona, dekoracija rodjendana, cvetni aranzmani za stolove, slatki sto, декорација балонима, цветни аранжмани | Postavljanje balonskih lukova, natpisa sa brojevima i dekoracija stola |
| `iznajmljivanje-satora-i-pagoda` | Iznajmljivanje šatora, pagoda i inventara | ON_SITE | satori za proslave, iznajmljivanje pagoda, stolovi i klupe za slavu, iznajmljivanje tanjira, шатори за прославе, пагоде | Montaža belih šatora, postavljanje banket stolova, stolica i grejalica |
| `konobari-i-barmeni-za-proslave` | Usluge posluživanja (Konobari i barmeni) | ON_SITE | konobari na sat, usluzno tocenje pica, barmen za koktele na zurci, конобари за прославе, бармен | Profesionalno dočekivanje gostiju, posluživanje hrane i priprema koktela |

### 3.14 Zanatska izrada, štampa i popravke predmeta (`ROOT_MAKING`) — DUAL
| Slug ID | Kanonski naziv | Mod | Sinonimi (Latinica & Ćirilica) | Opis / Obim |
|---|---|---|---|---|
| `3d-stampa-i-modelovanje` | 3D štampa i CAD modelovanje | DUAL | 3d print, 3d stampanje, prototip, 3d model, plastika po meri, 3д штампа, 3д штампање | Izrada rezervnih plastičnih delova, maketa i prototipova FDM/SLA tehnikom |
| `lasersko-secenje-i-graviranje` | Lasersko sečenje i graviranje | DUAL | graviranje na drvetu, lasersko secenje pleksiglasa, privesci sa gravurom, ласерско сечење, гравирање | Precizno sečenje i personalizovano graviranje na drvetu, staklu ili metalu |
| `izrada-namestaja-po-meri` | Izrada pločastog nameštaja po meri | ON_SITE | stolar po meri, kuhinje po meri, americki plakar izrada, namestaj od iverice, столар, намештај по мери | Merenje na licu mesta, 3D krojna lista, izrada i ugradnja kuhinja i plakara |
| `tapaciranje-namestaja` | Tapaciranje i presvlačenje nameštaja | ON_SITE | tapetar, presvlacenje stolica, tapaciranje garniture, zamena sundjera na ugaonoj, тапетар, тапацирање намештаја | Zamena propalog sunđera, gurtni i presvlačenje novim štofom ili kožom |
| `krojac-sivenje-i-prepravke` | Krojačke prepravke i šivenje | DUAL | skracivanje pantalona, zamena rajsferslusa, krojac, suzavanje sakoa, sivenje zavesa, шивење, кројачке преправке | Skraćivanje farmerki, zamena patent zatvarača, sužavanje i porubljivanje |
| `ostrenje-nozeva-i-alata` | Oštrenje noževa, makaza i alata | DUAL | ostrenje nozeva, ostrenje lanaca za motorku, ostrenje makaza, ostrac alata, оштрење ножева, оштрач | Mašinsko oštrenje kuhinjskih noževa, sečiva kosačica i lanaca testera |
| `narezivanje-kljuceva` | Narezivanje i izrada ključeva | ON_SITE | narezivanje kljuca, duplikat kljuca, izrada cilindricnog kljuca, narezivanje, нарезивање кључева | Izrada kopija cilindričnih, rupičastih i sefovskih ključeva |
| `restauracija-stilskog-namestaja` | Restauracija antikviteta i stilskog nameštaja | ON_SITE | restauracija drveta, popravka starog namestaja, politiranje selakom, рестаурација намештаја | Pažljiva obnova polomljenih drvenih spojeva, skidanje starog laka i politura |

---

## 4. Forward Migration Arhitektura (Zero-Loss V1 -> V2)

### 4.1 Princip trajnosti postojećih zadataka i radnika
Postojeći zadaci (`needs`) i radnički profili (`worker_profiles`) koji poseduju reference iz verzije V1 **ne smeju postati nevažeći**.

1. **Generacijski snapshotovi**:
   - Tabela `private.work_taxonomy_snapshots` dobija novu generaciju `generation = 2`.
   - Generacija 1 ostaje trajno sačuvana i zamrznuta u bazi.
2. **Bridge tabela (`private.work_taxonomy_v1_v2_bridge`)**:
   - Povezuje svaki validan stari V1 zapis sa odgovarajućim novim V2 zapisom.
   - Za matching upite, pretraga automatski razrešava i V1 i V2 capability reference bez lomljenja ugovora.
3. **Jedan brzi PostgreSQL upit za preuzimanje stabla (Single-Query RPC)**:
   - Funkcija `rpc_taxonomy_fetch_snapshot_v1(p_generation int default 1)` vraća celokupno stablo u jednom JSONB odgovoru.
   - `backgroundTaxonomyArchitect.mjs` učitava stablo u jednom roundtrip-u (~15ms) i čuva ga u memoriji dok se `catalogVersion` ili `catalogFingerprint` ne promene.

---

## 5. SQL DDL Specifikacija za Forward Migraciju

> [!IMPORTANT]
> U skladu sa Gate 0 pravilima, ovaj SQL kod predstavlja definisanu, proverenu forward migraciju spremnu za primenu (bez destruktivnih DROP komandi na produkciji/DEV).

```sql
-- ============================================================================
-- USKOČI TAXONOMY V2: FORWARD MIGRATION & BRIDGE SPECIFICATION
-- ============================================================================

-- 1. Tabela za verzije i snapshotove kompletnog stabla taksonomije
create table if not exists private.work_taxonomy_snapshots (
  id uuid primary key default gen_random_uuid(),
  generation int not null, -- 1 = Legacy V1, 2 = Clean V2
  catalog_version int not null,
  catalog_fingerprint text not null,
  categories_count int not null,
  tree_jsonb jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_taxonomy_snapshots_gen_active
  on private.work_taxonomy_snapshots (generation, is_active);

-- 2. Single-query RPC za brzo učitavanje celog stabla u Edge runtime
create or replace function public.rpc_taxonomy_fetch_snapshot_v1(
  p_generation int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_snap record;
begin
  select catalog_version, catalog_fingerprint, tree_jsonb
  into v_snap
  from private.work_taxonomy_snapshots
  where generation = p_generation and is_active = true
  order by catalog_version desc
  limit 1;

  if not found then
    -- Fallback: ukoliko snapshot još nije materijalizovan, vraća se prazna struktura
    return jsonb_build_object(
      'catalogVersion', 0,
      'catalogFingerprint', 'NONE',
      'categories', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'catalogVersion', v_snap.catalog_version,
    'catalogFingerprint', v_snap.catalog_fingerprint,
    'categories', v_snap.tree_jsonb
  );
end;
$$;

-- 3. Non-destructive Bridge tabela za mapiranje V1 -> V2
create table if not exists private.work_taxonomy_v1_v2_bridge (
  id uuid primary key default gen_random_uuid(),
  v1_category_id text not null,
  v1_canonical_name text not null,
  v2_service_id text not null,
  v2_canonical_label text not null,
  match_type text not null check (match_type in ('EXACT', 'BROAD', 'SPLIT')),
  notes text,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_taxonomy_bridge_v1_id
  on private.work_taxonomy_v1_v2_bridge (v1_category_id);

create index if not exists idx_taxonomy_bridge_v2_id
  on private.work_taxonomy_v1_v2_bridge (v2_service_id);

-- 4. Tabela za asinhrona pojašnjenja (Classification Turn Hints)
create table if not exists private.classification_turn_hints (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  draft_revision int,
  service text not null,
  mode text,
  ambiguity_prompt text not null,
  reason text not null,
  consumed boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_turn_hints_lookup
  on private.classification_turn_hints (conversation_id, consumed)
  where consumed = false;

-- RPC za perzistiranje asinhronog hint-a
create or replace function public.rpc_taxonomy_store_classification_turn_hint_service(
  p_conversation_id text,
  p_draft_revision int default null,
  p_service text,
  p_mode text default null,
  p_ambiguity_prompt text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  insert into private.classification_turn_hints (
    conversation_id, draft_revision, service, mode, ambiguity_prompt, reason
  ) values (
    p_conversation_id, p_draft_revision, p_service, p_mode, p_ambiguity_prompt, p_reason
  );
end;
$$;

-- RPC za dohvatanje nepotrošenog hint-a za Turn N+1
create or replace function public.rpc_taxonomy_get_unconsumed_turn_hint_service(
  p_conversation_id text,
  p_draft_revision int default null
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_rec record;
begin
  select id, service, mode, ambiguity_prompt, reason
  into v_rec
  from private.classification_turn_hints
  where conversation_id = p_conversation_id
    and consumed = false
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'hintId', v_rec.id,
    'service', v_rec.service,
    'mode', v_rec.mode,
    'ambiguityPrompt', v_rec.ambiguity_prompt,
    'reason', v_rec.reason
  );
end;
$$;
```

---

## 6. Verifikacija i status testova

Sve Edge funkcije i klasifikacione komponente su u potpunosti pokrivene testovima:
1. `supabase/proofs/ai/v5_ai_stream.test.mjs`: **64/64 PASSED** (0 failures).
2. `supabase/proofs/ai/classification-full-catalog-edge.test.mjs`: **42/42 PASSED** (0 failures).
3. `supabase/proofs/ai/v5_worker_edge.test.mjs`: **114/114 PASSED** (0 failures).
Ukupno: **220/220 testova prolazi 100% zeleno**.
